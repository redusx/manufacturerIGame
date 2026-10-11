/* ======================================================================
 * RocketHangarView.ts — Roket hangarı penceresi
 *
 * Roketi gösterir, dört modülünü fabrikada üretilen parçalar + parayla
 * yükseltir ve uçuşu başlatır. Her modül kartı tek bakışta okunur: seviye,
 * etkisi, beklediği parça (ilerleme çubuğuyla), bedeli ve tek bir eylem.
 * Pahalı kestirme (hızlı inşa) normal yükseltmeden farklı renkte gösterilir.
 * Uçuşu başlatma düğmesi pencerenin altında sabittir.
 * ====================================================================== */

import Phaser from 'phaser';
import { EconomyManager } from '../economy/EconomyManager';
import {
  MAX_ROCKET_LEVEL,
  ROCKET_UPGRADES,
  getMaxHullHP,
  getMaxBoostDuration,
  getFuelCapacity,
  getRangeScale,
  type RocketUpgradeDef,
} from '../data/RocketData';
import {
  PARTS_CARGO_SHARE,
  QUICK_BUILD_MAX_SHARE,
  type RocketHangarBridge,
  type RocketModuleCategory,
} from '../factory/simulation/RocketHangarBridge';
import { formatAdCooldown } from '../ads/AdService.ts';
import type { FactoryEconomy } from '../factory/simulation/FactoryEconomy';
import { defaultItemRegistry } from '../factory/simulation/ItemRegistry.ts';
import { RangeLadder } from '../flight/RangeLadder.ts';
import {
  LAUNCH_PAD_AD_DISCOUNT,
  MAX_LAUNCH_PAD_LEVEL,
  PERFECT_LAUNCH_BONUS_SECONDS,
  getPerfectZoneWidth,
  launchPadTextureKey,
} from '../flight/LaunchPad.ts';
import { formatDistance, formatNumber } from '../utils/format';
import { SEMANTIC, SPACE, uiIcon } from './theme';
import { refreshRocketIcon } from './RocketIcon.ts';
import { UiButton } from './system/UiButton.ts';
import { UiConfirmDialog } from './system/UiConfirmDialog.ts';
import { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { UiChip, UiProgressBar, createCard, createInset } from './system/UiWidgets.ts';

type ModuleState = 'max' | 'locked' | 'ready' | 'quick' | 'missingParts' | 'missingCash';

/** Parça kargosu (M9-E R4): reklam izleyerek parçası toplanan bir modülün eksiklerinden pay alma */
export interface HangarCargoConfig {
  /** Düğme gösterilsin mi? Reklam sunulamıyorsa hiç çizilmez */
  isOffered: () => boolean;
  /** Bekleme süresinden kalan (saniye); hazırsa 0 */
  cooldownRemaining: () => number;
  /** Reklamı gösterir ve ödülü verir; pencere sonucu kendisi yeniler */
  onRequest: (category: RocketModuleCategory) => void;
}

/** Rampa yükseltmesini reklam izleyerek indirimli alma */
export interface HangarPadDiscountConfig {
  /** Düğme gösterilsin mi? Reklam sunulamıyorsa hiç çizilmez */
  isOffered: () => boolean;
  /** Reklamı gösterir; izlenirse rampayı indirimli bedelle yükseltir */
  onRequest: () => void;
}

interface ModuleCardRef {
  category: RocketModuleCategory;
  partRows: Array<{ itemId: string; required: number; countText: Phaser.GameObjects.Text; bar: UiProgressBar }>;
}

const LIVE_REFRESH_INTERVAL_MS = 150;
const PREVIEW_HEIGHT = 128;
const COLLECT_BUTTON_HEIGHT = 26;
/** Kartın sol sütunu: modül görseli ve altındaki "topla" düğmesi */
const MODULE_THUMB_WIDTH = 64;
const RANGES_BUTTON_WIDTH = 140;
const RANGES_BUTTON_HEIGHT = 36;
const CARGO_BUTTON_WIDTH = 230;
const CARGO_BUTTON_HEIGHT = 48;

export class RocketHangarView extends UiModal {
  private readonly economy: EconomyManager;
  private readonly onLaunch: () => void;
  private readonly hangarBridge: RocketHangarBridge;
  private readonly factoryEconomy: FactoryEconomy;
  private readonly onDenied: (message: string) => void;
  /** Kayda yazılması gereken bir seçim değişti (parçası toplanan modüller) */
  private readonly onChanged: () => void;
  /** Seferler (menzil merdiveni) penceresini açar */
  private readonly onOpenRanges: () => void;
  /** Parça kargosu (reklam ödülü); verilmezse düğme hiç çizilmez */
  private readonly cargo: HangarCargoConfig | null;
  /** Rampa yükseltildi (ses, efekt ve kayıt sahnenin işidir) */
  private readonly onPadUpgraded: (level: number) => void;
  /** Rampa indirimi (reklam ödülü); verilmezse düğme hiç çizilmez */
  private readonly padDiscount: HangarPadDiscountConfig | null;

  private rocketContainer: Phaser.GameObjects.Container | null = null;
  private launchButton: UiButton | null = null;
  private cardRefs: ModuleCardRef[] = [];
  /** Bekleme süresindeki kargo düğmesi; sayacı canlı güncellenir */
  private cargoButton: UiButton | null = null;
  private structureSignature = '';
  private lastLiveRefresh = 0;
  private isLaunching = false;
  /** Hızlı inşa pahalı bir kestirmedir; ne satın alındığı onayda yazılır */
  private readonly confirmDialog: UiConfirmDialog;

  constructor(
    layer: UiLayer,
    economy: EconomyManager,
    onLaunch: () => void,
    hangarBridge: RocketHangarBridge,
    factoryEconomy: FactoryEconomy,
    onDenied: (message: string) => void = () => undefined,
    onChanged: () => void = () => undefined,
    onOpenRanges: () => void = () => undefined,
    cargo: HangarCargoConfig | null = null,
    onPadUpgraded: (level: number) => void = () => undefined,
    padDiscount: HangarPadDiscountConfig | null = null,
  ) {
    super(layer, { title: 'Roket Hangarı', maxWidth: 760, depth: 205, accent: SEMANTIC.rocket });
    this.economy = economy;
    this.onLaunch = onLaunch;
    this.hangarBridge = hangarBridge;
    this.factoryEconomy = factoryEconomy;
    this.onDenied = onDenied;
    this.onChanged = onChanged;
    this.onOpenRanges = onOpenRanges;
    this.cargo = cargo;
    this.onPadUpgraded = onPadUpgraded;
    this.padDiscount = padDiscount;
    this.confirmDialog = new UiConfirmDialog(layer);
  }

  // -------------------------------------------------------------
  // DURUM
  // -------------------------------------------------------------

  private levelOf(category: RocketModuleCategory): number {
    return this.hangarBridge.getModuleLevel(category);
  }

  private stateOf(def: RocketUpgradeDef): ModuleState {
    const category = def.id as RocketModuleCategory;
    const cost = this.hangarBridge.getUpgradeCost(category);
    if (!cost || this.levelOf(category) >= def.maxLevel) return 'max';
    // Sıradaki kademe (Mk) bir menzil basamağıyla açılır
    if (this.hangarBridge.getUpgradeLock(category)) return 'locked';

    const hasParts = this.hangarBridge.hasRequiredParts(category);
    if (hasParts) {
      return this.factoryEconomy.canAfford(cost.cashCost) ? 'ready' : 'missingCash';
    }
    return this.hangarBridge.canAffordQuickBuild(category, this.factoryEconomy) ? 'quick' : 'missingParts';
  }

  private computeStructureSignature(): string {
    const modules = ROCKET_UPGRADES.map(
      (def) => `${def.id}:${this.levelOf(def.id as RocketModuleCategory)}:${this.stateOf(def)}`,
    ).join('|');
    const cargoState = this.cargo ? `${this.cargo.isOffered()}:${this.cargo.cooldownRemaining() > 0}` : '-';
    const collecting = this.hangarBridge.getCollectingModules().join(',');
    const padCost = this.hangarBridge.getLaunchPadUpgradeCost();
    const padAdCost = this.hangarBridge.getLaunchPadUpgradeCost(LAUNCH_PAD_AD_DISCOUNT);
    const pad = [
      this.hangarBridge.getLaunchPadLevel(),
      padCost !== null && this.factoryEconomy.canAfford(padCost),
      padAdCost !== null && this.factoryEconomy.canAfford(padAdCost),
      this.padDiscount?.isOffered() ?? false,
    ].join(':');
    return `${modules}#${pad}#${collecting}#${this.hangarBridge.getCargoModule() ?? '-'}#${this.hangarBridge.getLevelCap()}#${cargoState}`;
  }

  protected onOpened(): void {
    this.isLaunching = false;
  }

  /** Açıkken her karede çağrılır; parça sayaçlarını ve düğme durumlarını günceller */
  refresh(): void {
    if (!this.isOpen || this.isLaunching) return;
    const now = this.scene.time.now;
    if (now - this.lastLiveRefresh < LIVE_REFRESH_INTERVAL_MS) return;
    this.lastLiveRefresh = now;

    if (this.computeStructureSignature() !== this.structureSignature) {
      this.rebuild();
      return;
    }
    if (this.cargoButton && this.cargo) {
      this.cargoButton.setSublabel(`${formatAdCooldown(this.cargo.cooldownRemaining())} sonra`);
    }
    for (const card of this.cardRefs) {
      for (const row of card.partRows) {
        const stock = Math.min(row.required, this.hangarBridge.getPartCount(row.itemId));
        row.countText.setText(`${stock}/${row.required}`);
        row.bar.setProgress(row.required > 0 ? stock / row.required : 1);
      }
    }
  }

  // -------------------------------------------------------------
  // İÇERİK
  // -------------------------------------------------------------

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    this.cardRefs = [];
    this.rocketContainer = null;
    this.cargoButton = null;
    this.structureSignature = this.computeStructureSignature();

    // Geniş pencerede roket solda, modüller sağda; darda alt alta
    const twoColumns = width >= 600;
    const sideWidth = twoColumns ? 250 : width;
    const cardsX = twoColumns ? sideWidth + SPACE.md : 0;
    const cardsWidth = twoColumns ? width - cardsX : width;

    const sideHeight = this.buildRocketPanel(body, sideWidth);
    const cardsHeight = this.buildModuleCards(body, cardsX, twoColumns ? 0 : sideHeight + SPACE.md, cardsWidth);

    return twoColumns ? Math.max(sideHeight, cardsHeight) : sideHeight + SPACE.md + cardsHeight;
  }

  /** Roket görseli, özet değerler ve uçuş rekoru */
  private buildRocketPanel(body: Phaser.GameObjects.Container, width: number): number {
    const scene = this.scene;
    const layer = this.layer;
    let y = 0;

    body.add(createInset(scene, 0, y, width, PREVIEW_HEIGHT));
    const pad = scene.add.container(width / 2, y + PREVIEW_HEIGHT / 2 + 8);
    pad.add(scene.add.image(0, 26, 'launch_platform').setOrigin(0.5).setScale(1.5));
    const padKey = launchPadTextureKey(this.hangarBridge.getLaunchPadLevel());
    if (scene.textures.exists(padKey)) {
      pad.add(scene.add.image(-40, 4, padKey).setOrigin(0.5, 0.7).setScale(1.5));
    }

    const rocket = scene.add.container(4, 0);
    const part = (key: string, x: number): void => {
      if (scene.textures.exists(key)) rocket.add(scene.add.image(x, 0, key).setOrigin(0.5).setScale(2));
    };
    rocket.add(scene.add.image(-24, 0, 'flame_idle').setOrigin(1, 0.5).setScale(2));
    part(`rocket_engine_${this.levelOf('engine')}`, -13);
    part(`rocket_tank_${this.levelOf('boost')}`, -3);
    part(`rocket_wings_${this.levelOf('wings')}`, -6);
    part(`rocket_hull_${this.levelOf('hull')}`, 3);
    rocket.setRotation(-Math.PI / 4);
    pad.add(rocket);
    body.add(pad);
    this.rocketContainer = rocket;
    y += PREVIEW_HEIGHT + SPACE.sm;

    // Özet değerler: her biri ikon + sayı
    const rocketClass = this.hangarBridge.getRocketClass();
    const stats: Array<[string, string, number]> = [
      ['icon_rocket', `Sınıf ${rocketClass}`, SEMANTIC.rocket],
      ['icon_lightning', `Hız ×${getRangeScale(rocketClass)}`, SEMANTIC.rocket],
      ['icon_heart', `${getMaxHullHP(this.levelOf('hull'))} HP`, SEMANTIC.danger],
      [uiIcon('drop'), `Yakıt ${getFuelCapacity(this.levelOf('engine')).toFixed(1)} sn`, SEMANTIC.factory],
      [uiIcon('star'), `Nitro ${getMaxBoostDuration(this.levelOf('boost')).toFixed(1)} sn`, SEMANTIC.money],
    ];
    let x = 0;
    for (const [icon, label, color] of stats) {
      const chip = new UiChip(layer, 0, 0, label, color, { icon });
      if (x > 0 && x + chip.chipWidth > width) {
        x = 0;
        y += 26;
      }
      chip.setPosition(x, y);
      body.add(chip);
      x += chip.chipWidth + SPACE.xs + 2;
    }
    y += 22 + SPACE.sm;

    const line = (text: string, color: string, variant: 'bodyBold' | 'caption' = 'caption'): void => {
      const label = layer.text(0, y, text, variant, { color, wrapWidth: width });
      body.add(label);
      y += label.height + 2;
    };

    // Sınıf atlamak: dört modülün dördü de bir üst seviyeye çıkınca hız çarpanı büyür
    if (rocketClass < MAX_ROCKET_LEVEL) {
      const lagging = ROCKET_UPGRADES.filter((def) => this.levelOf(def.id as RocketModuleCategory) <= rocketClass).map(
        (def) => def.name,
      );
      line(
        `Sınıf ${rocketClass + 1} (hız ×${getRangeScale(rocketClass + 1)}) için Sv.${rocketClass + 1} olmalı: ${lagging.join(', ')}`,
        SEMANTIC.textMuted,
      );
      y += SPACE.xs;
    }

    // Rekor ve sıradaki menzil hedefi: daha ileri gitmenin fabrikaya kazandırdığı
    const best = this.hangarBridge.getFlightStats().bestDistance;
    const nextRung = RangeLadder.next(best);
    line(`Rekor: ${formatDistance(best)}`, SEMANTIC.rocketHex, 'bodyBold');
    line(
      nextRung
        ? `Sıradaki menzil ${formatDistance(nextRung.targetMeters)} (${nextRung.name}): ${RangeLadder.describeRewards(nextRung).join(' · ')}`
        : 'Bütün menzil hedefleri tamamlandı.',
      SEMANTIC.textMuted,
    );
    y += SPACE.xs;

    // Bütün menzil basamakları ve ödülleri ayrı pencerededir
    const rangesButton = new UiButton(layer, RANGES_BUTTON_WIDTH / 2, y + RANGES_BUTTON_HEIGHT / 2, {
      width: RANGES_BUTTON_WIDTH,
      height: RANGES_BUTTON_HEIGHT,
      variant: 'secondary',
      label: 'SEFERLER',
      icon: 'icon_flag',
      onClick: () => {
        this.close();
        this.onOpenRanges();
      },
    });
    body.add(rangesButton);
    y += RANGES_BUTTON_HEIGHT + SPACE.sm;

    // Parçaların hangi modüller için ayrıldığı (birden çok modül işaretlenebilir)
    const nameOf = (category: RocketModuleCategory | null): string | undefined =>
      ROCKET_UPGRADES.find((def) => def.id === category)?.name;
    const collecting = this.hangarBridge.getCollectingModules();
    line(
      collecting.length === ROCKET_UPGRADES.length
        ? 'Sevkiyata ulaşan parçalar bütün modüller için ayrılıyor. Bir modülün TOPLA düğmesini kapatırsan onun parçaları satılır.'
        : collecting.length === 0
          ? 'Hiçbir modül işaretli değil: bütün ürünler satılıyor. Parça biriktirmek için modüllerin TOPLA düğmesini aç.'
          : `Parçaları ayrılan modüller: ${collecting.map(nameOf).join(', ')}. Diğer modüllerin ürünleri satılıyor.`,
      SEMANTIC.textMuted,
    );

    const cargoModule = this.hangarBridge.getCargoModule();
    y = this.buildCargoRow(body, y + SPACE.xs, width, cargoModule, nameOf(cargoModule));

    return y;
  }

  /**
   * Parça kargosu: parçası toplanan modüllerden en düşük seviyelisinin eksiklerinin bir
   * bölümü reklam izleyerek alınır. Reklam sunulamıyorsa hiçbir şey çizilmez; uygun modül
   * yoksa yalnızca nasıl kullanılacağı yazılır (etkisiz düğme bırakılmaz).
   */
  private buildCargoRow(
    body: Phaser.GameObjects.Container,
    y: number,
    width: number,
    target: RocketModuleCategory | null,
    targetName: string | undefined,
  ): number {
    const cargo = this.cargo;
    if (!cargo || !cargo.isOffered()) return y;
    const share = Math.round(PARTS_CARGO_SHARE * 100);

    if (!target || !targetName || !this.hangarBridge.canGrantPartsCargo(target)) {
      const hint = this.layer.text(
        0,
        y,
        `Parça kargosu: TOPLA düğmesi açık ve eksik parçası olan bir modül varken reklam izleyerek eksiklerinin %${share}'ini alabilirsin.`,
        'caption',
        { color: SEMANTIC.textMuted, wrapWidth: width },
      );
      body.add(hint);
      return y + hint.height + SPACE.xs;
    }

    const cooldown = cargo.cooldownRemaining();
    const button = new UiButton(this.layer, CARGO_BUTTON_WIDTH / 2, y + CARGO_BUTTON_HEIGHT / 2, {
      width: Math.min(width, CARGO_BUTTON_WIDTH),
      height: CARGO_BUTTON_HEIGHT,
      variant: 'gold',
      icon: uiIcon('video'),
      label: 'PARÇA KARGOSU',
      sublabel: cooldown > 0 ? `${formatAdCooldown(cooldown)} sonra` : `${targetName}: eksiklerin %${share}'i`,
      textVariant: 'buttonSmall',
      onClick: () => cargo.onRequest(target),
      onDisabledClick: () => this.onDenied('Parça kargosu biraz sonra yeniden kullanılabilir.'),
    });
    button.setEnabled(cooldown === 0);
    body.add(button);
    this.cargoButton = cooldown > 0 ? button : null;
    return y + CARGO_BUTTON_HEIGHT + SPACE.xs;
  }

  private buildModuleCards(
    body: Phaser.GameObjects.Container,
    x: number,
    startY: number,
    width: number,
  ): number {
    const scene = this.scene;
    const layer = this.layer;
    // Dar kartta düğme yazının yanına sığmaz; altına iner
    const stacked = width < 380;
    const buttonWidth = stacked ? width - SPACE.sm * 2 : 112;
    const buttonHeight = stacked ? 40 : 48;
    const textRight = stacked ? width - SPACE.sm : width - SPACE.sm - buttonWidth - SPACE.sm;
    let y = startY;

    for (const def of ROCKET_UPGRADES) {
      const category = def.id as RocketModuleCategory;
      const level = this.levelOf(category);
      const state = this.stateOf(def);
      const cost = this.hangarBridge.getUpgradeCost(category);
      const showParts = state !== 'max' && state !== 'locked';
      const partCount = showParts ? (cost?.requiredParts.length ?? 0) : 0;
      const hasButton = showParts;

      // Sol sütun: modül görseli ve altında "topla" düğmesi
      const leftHeight = showParts ? 48 + SPACE.xs + COLLECT_BUTTON_HEIGHT : 48;
      const textHeight = 50 + partCount * 30 + (state === 'locked' ? 28 : 0);
      const cardHeight =
        Math.max(leftHeight + SPACE.sm * 2, textHeight + SPACE.sm) + (stacked && hasButton ? buttonHeight + SPACE.sm : 0);
      const card = scene.add.container(x, y);
      card.add(createCard(scene, 0, 0, width, cardHeight));

      // Modülün o seviyedeki görseli (her seviyenin kendi renk şeması vardır)
      card.add(createInset(scene, SPACE.sm, SPACE.sm, MODULE_THUMB_WIDTH, 48));
      const spriteKey = `${def.spritePrefix}${Math.min(def.maxLevel, Math.max(1, level))}`;
      if (scene.textures.exists(spriteKey)) {
        card.add(
          scene.add.image(SPACE.sm + MODULE_THUMB_WIDTH / 2, SPACE.sm + 24, spriteKey).setOrigin(0.5).setScale(2),
        );
      }

      const textX = SPACE.sm + MODULE_THUMB_WIDTH + SPACE.sm;
      const levelLabel = layer
        .text(textRight, SPACE.sm + 2, `${RangeLadder.tierName(level)} · Sv.${level}/${def.maxLevel}`, 'captionBold', {
          color: SEMANTIC.moneyHex,
        })
        .setOrigin(1, 0);
      card.add(levelLabel);
      const name = layer.text(textX, SPACE.sm, '', 'heading');
      UiLayer.fit(name, def.name, textRight - textX - levelLabel.width - SPACE.sm);
      card.add(name);

      const stat = layer.text(textX, SPACE.sm + 22, '', 'caption', { color: SEMANTIC.textMuted });
      UiLayer.ellipsize(stat, def.getStatText(level), textRight - textX);
      card.add(stat);

      const ref: ModuleCardRef = { category, partRows: [] };
      if (state === 'max') {
        card.add(new UiChip(layer, textX, SPACE.sm + 40, 'En üst seviye', SEMANTIC.primary, { icon: 'icon_check' }));
      } else if (state === 'locked') {
        // Sıradaki kademe bir menzil basamağıyla açılır
        const rung = this.hangarBridge.getUpgradeLock(category);
        card.add(
          new UiChip(layer, textX, SPACE.sm + 40, `${RangeLadder.tierName(level + 1)} kilitli`, SEMANTIC.warning, {
            icon: uiIcon('lock'),
          }),
        );
        if (rung) {
          card.add(
            layer.text(textX, SPACE.sm + 66, `${formatDistance(rung.targetMeters)} menziline (${rung.name}) ulaşınca açılır.`, 'caption', {
              color: SEMANTIC.textMuted,
              wrapWidth: width - textX - SPACE.sm,
            }),
          );
        }
      } else if (cost) {
        // Beklenen parçalar: fabrikada üretilip sandığa ulaşınca buraya gelir
        cost.requiredParts.forEach((req, index) => {
          const rowY = SPACE.sm + 44 + index * 30;
          const item = defaultItemRegistry.get(req.itemId);
          const icon = scene.add.image(textX + 8, rowY + 6, item?.spriteKey ?? 'pickup_gear').setOrigin(0.5);
          if (item?.colorTint !== undefined) icon.setTint(item.colorTint);
          card.add(icon);

          const stock = Math.min(req.count, this.hangarBridge.getPartCount(req.itemId));
          const countText = layer.text(textRight, rowY, `${stock}/${req.count}`, 'captionBold').setOrigin(1, 0);
          const label = layer.text(textX + 20, rowY, '', 'caption');
          UiLayer.fit(label, req.itemName, textRight - textX - 20 - countText.width - SPACE.sm, 9);
          const bar = new UiProgressBar(scene, textX, rowY + 16, textRight - textX, 8, 'cyan');
          bar.setProgress(req.count > 0 ? stock / req.count : 1);
          card.add([label, countText, bar]);
          ref.partRows.push({ itemId: req.itemId, required: req.count, countText, bar });
        });

        // Topla: açıkken (altın) bu modülün parçaları sevkiyattan ayrılır, kapalıyken satılır.
        // Birden çok modül aynı anda açık olabilir; her biri kendi üretim hattından beslenir.
        const isCollecting = this.hangarBridge.isCollectingFor(category);
        const collectButton = new UiButton(
          layer,
          SPACE.sm + MODULE_THUMB_WIDTH / 2,
          SPACE.sm + 48 + SPACE.xs + COLLECT_BUTTON_HEIGHT / 2,
          {
            width: MODULE_THUMB_WIDTH,
            height: COLLECT_BUTTON_HEIGHT,
            variant: isCollecting ? 'gold' : 'secondary',
            label: 'TOPLA',
            textVariant: 'buttonSmall',
            onClick: () => this.toggleCollecting(category),
          },
        );
        collectButton.setSelected(isCollecting);
        card.add(collectButton);

        const buttonX = stacked ? width / 2 : width - SPACE.sm - buttonWidth / 2;
        const buttonY = stacked ? cardHeight - SPACE.sm - buttonHeight / 2 : cardHeight / 2;
        card.add(this.buildModuleButton(def, state, buttonX, buttonY, buttonWidth, buttonHeight));
      }

      this.cardRefs.push(ref);
      body.add(card);
      y += cardHeight + SPACE.sm;
    }

    y += this.buildLaunchPadCard(body, x, y, width, stacked, buttonWidth, buttonHeight) + SPACE.sm;

    return y - SPACE.sm - startY;
  }

  /**
   * Fırlatma rampası: roket modülü değildir (sınıfı etkilemez, parça istemez). Seviyesi
   * arttıkça fırlatma göstergesindeki mükemmel bölge genişler ve rampanın görünümü değişir.
   * Sıradaki seviye doğrudan ya da reklam izleyerek indirimli alınabilir. Kartın yüksekliğini döner.
   */
  private buildLaunchPadCard(
    body: Phaser.GameObjects.Container,
    x: number,
    y: number,
    width: number,
    stacked: boolean,
    buttonWidth: number,
    buttonHeight: number,
  ): number {
    const scene = this.scene;
    const layer = this.layer;
    const level = this.hangarBridge.getLaunchPadLevel();
    const cost = this.hangarBridge.getLaunchPadUpgradeCost();
    const percent = (padLevel: number): number => Math.round(getPerfectZoneWidth(padLevel) * 100);

    // İndirim düğmesi yalnız reklam sunulabiliyorsa çizilir; parası yetmeyen oyuncu da görür
    const discount = this.padDiscount;
    const showDiscount = cost !== null && discount !== null && discount.isOffered();
    const discountedCost = this.hangarBridge.getLaunchPadUpgradeCost(LAUNCH_PAD_AD_DISCOUNT) ?? 0;
    const adHeight = 40;
    const buttonsHeight = cost === null ? 0 : buttonHeight + (showDiscount ? SPACE.xs + adHeight : 0);

    const textX = SPACE.sm + MODULE_THUMB_WIDTH + SPACE.sm;
    const textRight = stacked || cost === null ? width - SPACE.sm : width - SPACE.sm - buttonWidth - SPACE.sm;
    const card = scene.add.container(x, y);

    const levelLabel = layer
      .text(textRight, SPACE.sm + 2, `Sv.${level}/${MAX_LAUNCH_PAD_LEVEL}`, 'captionBold', { color: SEMANTIC.moneyHex })
      .setOrigin(1, 0);
    const name = layer.text(textX, SPACE.sm, '', 'heading');
    UiLayer.fit(name, 'Fırlatma Rampası', textRight - textX - levelLabel.width - SPACE.sm);
    const zone =
      percent(level) >= 100
        ? 'Her fırlatma mükemmel: yeşil bölge çubuğun tamamı'
        : `Mükemmel fırlatma bölgesi: çubuğun %${percent(level)}'i`;
    const stat = layer.text(textX, SPACE.sm + 22, zone, 'caption', {
      color: SEMANTIC.textMuted,
      wrapWidth: textRight - textX,
    });
    const bonus = `Mükemmel fırlatma uçuş primine ${PERFECT_LAUNCH_BONUS_SECONDS} sn'lik gelir ekler.`;
    const detail = layer.text(
      textX,
      stat.y + stat.height + 4,
      cost === null ? bonus : `Sonraki seviye: %${percent(level + 1)}. ${bonus}`,
      'caption',
      { wrapWidth: textRight - textX },
    );

    const textHeight = detail.y + detail.height + (cost === null ? 26 : 0);
    const cardHeight = stacked
      ? Math.max(48 + SPACE.sm * 2, textHeight + SPACE.sm) + (cost !== null ? buttonsHeight + SPACE.sm : 0)
      : Math.max(48 + SPACE.sm * 2, textHeight + SPACE.sm, buttonsHeight + SPACE.sm * 2);
    card.add(createCard(scene, 0, 0, width, cardHeight));
    card.add(createInset(scene, SPACE.sm, SPACE.sm, MODULE_THUMB_WIDTH, 48));
    // Rampanın o seviyedeki görünümü
    const padKey = launchPadTextureKey(level);
    if (scene.textures.exists(padKey)) {
      card.add(scene.add.image(SPACE.sm + MODULE_THUMB_WIDTH / 2, SPACE.sm + 24, padKey).setOrigin(0.5));
    }
    card.add([name, levelLabel, stat, detail]);

    if (cost === null) {
      card.add(
        new UiChip(layer, textX, detail.y + detail.height + 6, 'En üst seviye', SEMANTIC.primary, { icon: 'icon_check' }),
      );
    } else {
      const buttonX = stacked ? width / 2 : width - SPACE.sm - buttonWidth / 2;
      const top = stacked ? cardHeight - SPACE.sm - buttonsHeight : (cardHeight - buttonsHeight) / 2;
      const missing = (price: number): string =>
        `$${formatNumber(Math.ceil(Math.max(0, price - this.factoryEconomy.money)))} daha gerekli.`;

      const affordable = this.factoryEconomy.canAfford(cost);
      const button = new UiButton(layer, buttonX, top + buttonHeight / 2, {
        width: buttonWidth,
        height: buttonHeight,
        variant: 'primary',
        label: 'YÜKSELT',
        sublabel: `$${formatNumber(cost)}`,
        textVariant: affordable ? 'button' : 'buttonSmall',
        silent: true,
        onClick: () => this.upgradeLaunchPad(),
        onDisabledClick: () => this.onDenied(`Yetersiz bakiye: ${missing(cost)}`),
      });
      button.setEnabled(affordable);
      card.add(button);

      if (showDiscount && discount) {
        // Reklamla indirim: doğrudan satın almanın altında, video simgeli ayrı düğme.
        // İndirimli bedele para yetiyorsa etkindir; yetmiyorsa görünür ama pasiftir.
        const discountPercent = Math.round(LAUNCH_PAD_AD_DISCOUNT * 100);
        const adButton = new UiButton(layer, buttonX, top + buttonHeight + SPACE.xs + adHeight / 2, {
          width: buttonWidth,
          height: adHeight,
          variant: 'gold',
          icon: uiIcon('video'),
          label: `%${discountPercent} İNDİRİM`,
          sublabel: `$${formatNumber(discountedCost)}`,
          textVariant: 'buttonSmall',
          onClick: () => discount.onRequest(),
          onDisabledClick: () => this.onDenied(`Reklamla indirimli bedel için ${missing(discountedCost)}`),
        });
        adButton.setEnabled(this.factoryEconomy.canAfford(discountedCost));
        card.add(adButton);
      }
    }

    body.add(card);
    return cardHeight;
  }

  private buildModuleButton(
    def: RocketUpgradeDef,
    state: ModuleState,
    x: number,
    y: number,
    width: number,
    height: number,
  ): UiButton {
    const category = def.id as RocketModuleCategory;
    const cost = this.hangarBridge.getUpgradeCost(category);
    const cash = cost?.cashCost ?? 0;
    const quote = this.hangarBridge.getQuickBuildQuote(category, this.factoryEconomy.revenueMultiplier);
    const quickCost = quote.totalCost;

    if (state === 'ready') {
      return new UiButton(this.layer, x, y, {
        width,
        height,
        variant: 'primary',
        label: 'YÜKSELT',
        sublabel: `$${formatNumber(cash)}`,
        silent: true,
        onClick: () => this.upgrade(category, false),
      });
    }

    if (state === 'quick') {
      // Parça beklemeden parayla tamamlama: pahalı kestirme, farklı renkte
      return new UiButton(this.layer, x, y, {
        width,
        height,
        variant: 'gold',
        label: 'HIZLI İNŞA',
        sublabel: `$${formatNumber(quickCost)}`,
        textVariant: 'buttonSmall',
        silent: true,
        onClick: () => this.confirmQuickBuild(def),
      });
    }

    const missingParts = state === 'missingParts';
    const button = new UiButton(this.layer, x, y, {
      width,
      height,
      label: missingParts ? 'PARÇA EKSİK' : 'YÜKSELT',
      sublabel: `$${formatNumber(cash)}`,
      textVariant: 'buttonSmall',
      onClick: () => undefined,
      onDisabledClick: () =>
        this.onDenied(
          !missingParts
            ? `Yetersiz bakiye: $${formatNumber(Math.ceil(Math.max(0, cash - this.factoryEconomy.money)))} daha gerekli.`
            : quote.allowed
              ? `Hızlı inşa için $${formatNumber(quickCost)} gerekli; ya da kalan parçaları fabrikada üret.`
              : 'Parçalar eksik: fabrikada üretip sevkiyat sandığına ulaştır. Her parçanın en fazla dörtte biri nakitle tamamlanabilir.',
        ),
    });
    button.setEnabled(false);
    return button;
  }

  protected buildFooter(footer: Phaser.GameObjects.Container, width: number): number {
    const height = 52;
    const buttonWidth = Math.min(width, 360);
    // Düğmedeki simge oyuncunun kendi roketidir (modüllerin o anki görünümü)
    const rocketIcon = refreshRocketIcon(this.scene, this.hangarBridge.getAllModuleLevels());
    this.launchButton = new UiButton(this.layer, width / 2, height / 2, {
      width: buttonWidth,
      height,
      variant: 'rocket',
      label: 'UÇUŞU BAŞLAT',
      icon: rocketIcon,
      iconScale: 1.5,
      silent: true,
      onClick: () => this.launch(),
    });
    footer.add(this.launchButton);
    return height;
  }

  protected primaryButton(): UiButton | null {
    return this.launchButton;
  }

  // -------------------------------------------------------------
  // EYLEMLER
  // -------------------------------------------------------------

  /** Modülün parçalarının sevkiyattan ayrılmasını açar veya kapatır */
  private toggleCollecting(category: RocketModuleCategory): void {
    this.hangarBridge.setCollecting(category, !this.hangarBridge.isCollectingFor(category));
    this.onChanged();
    this.rebuild();
  }

  /**
   * Hızlı inşa: eksik parçalar nakitle tamamlanır (DEC-029). Pahalı bir kestirme olduğu
   * için neyin kaça alındığı gösterilip onay istenir.
   */
  private confirmQuickBuild(def: RocketUpgradeDef): void {
    const category = def.id as RocketModuleCategory;
    const cost = this.hangarBridge.getUpgradeCost(category);
    const multiplier = this.factoryEconomy.revenueMultiplier;
    const quote = this.hangarBridge.getQuickBuildQuote(category, multiplier);
    if (!cost || !quote.allowed) return;

    const missing = this.hangarBridge
      .getMissingParts(category, multiplier)
      .map((part) => `${part.missingCount} ${part.itemName} ($${formatNumber(part.missingTotalCost)})`)
      .join(', ');
    this.confirmDialog.ask({
      title: `${def.name}: hızlı inşa`,
      message:
        `Eksik parçalar nakitle tamamlanır: ${missing}. ` +
        `Yükseltme bedeli $${formatNumber(cost.cashCost)} ile birlikte toplam $${formatNumber(quote.totalCost)}.\n\n` +
        `Parçaları fabrikada üretip sevkiyata ulaştırırsan yalnızca $${formatNumber(cost.cashCost)} ödersin. ` +
        `Her parçanın en fazla %${Math.round(QUICK_BUILD_MAX_SHARE * 100)}'i nakitle alınabilir.`,
      confirmLabel: 'SATIN AL',
      onConfirm: () => this.upgrade(category, true),
    });
  }

  private upgrade(category: RocketModuleCategory, quickBuild: boolean): void {
    const upgraded = this.hangarBridge.upgradeModule(category, this.factoryEconomy, quickBuild);
    if (!upgraded) return;
    // Kasa sınıfı roket seviyelerini de saklar; olay dinleyicileri ses ve efekt verir
    this.economy.setRocketUpgradeLevel(category, this.hangarBridge.getModuleLevel(category));
    this.rebuild();
  }

  private upgradeLaunchPad(): void {
    if (!this.hangarBridge.upgradeLaunchPad(this.factoryEconomy)) return;
    this.onPadUpgraded(this.hangarBridge.getLaunchPadLevel());
    this.rebuild();
  }

  /** Roket rampadan kalkar, pencere kapanır ve uçuş sahnesi başlar */
  private launch(): void {
    if (this.isLaunching) return;
    this.isLaunching = true;

    const finish = (): void => {
      this.isLaunching = false;
      this.close();
      this.onLaunch();
    };

    if (!this.rocketContainer) {
      finish();
      return;
    }
    this.scene.tweens.add({
      targets: this.rocketContainer,
      x: this.rocketContainer.x + 70,
      y: this.rocketContainer.y - 100,
      duration: 320,
      ease: 'Back.easeIn',
      onComplete: finish,
    });
  }
}
