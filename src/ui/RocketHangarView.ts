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
  ROCKET_UPGRADES,
  getMaxHullHP,
  getFlightSpeed,
  getMaxBoostDuration,
  getFuelCapacity,
  type RocketUpgradeDef,
} from '../data/RocketData';
import type { RocketHangarBridge, RocketModuleCategory } from '../factory/simulation/RocketHangarBridge';
import type { FactoryEconomy } from '../factory/simulation/FactoryEconomy';
import { defaultItemRegistry } from '../factory/simulation/ItemRegistry.ts';
import { FLIGHT_DISTANCE_MILESTONES } from '../scenes/FlightReturnHelper.ts';
import { formatNumber } from '../utils/format';
import { SEMANTIC, SPACE, uiIcon } from './theme';
import { UiButton } from './system/UiButton.ts';
import { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { UiChip, UiProgressBar, createCard, createInset, createPips } from './system/UiWidgets.ts';

type ModuleState = 'max' | 'ready' | 'quick' | 'missingParts' | 'missingCash';

interface ModuleCardRef {
  category: RocketModuleCategory;
  partRows: Array<{ itemId: string; required: number; countText: Phaser.GameObjects.Text; bar: UiProgressBar }>;
}

const LIVE_REFRESH_INTERVAL_MS = 150;
const PREVIEW_HEIGHT = 128;

export class RocketHangarView extends UiModal {
  private readonly economy: EconomyManager;
  private readonly onLaunch: () => void;
  private readonly hangarBridge: RocketHangarBridge;
  private readonly factoryEconomy: FactoryEconomy;
  private readonly onDenied: (message: string) => void;

  private rocketContainer: Phaser.GameObjects.Container | null = null;
  private launchButton: UiButton | null = null;
  private cardRefs: ModuleCardRef[] = [];
  private structureSignature = '';
  private lastLiveRefresh = 0;
  private isLaunching = false;

  constructor(
    layer: UiLayer,
    economy: EconomyManager,
    onLaunch: () => void,
    hangarBridge: RocketHangarBridge,
    factoryEconomy: FactoryEconomy,
    onDenied: (message: string) => void = () => undefined,
  ) {
    super(layer, { title: 'Roket Hangarı', maxWidth: 760, depth: 205, accent: SEMANTIC.rocket });
    this.economy = economy;
    this.onLaunch = onLaunch;
    this.hangarBridge = hangarBridge;
    this.factoryEconomy = factoryEconomy;
    this.onDenied = onDenied;
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

    const hasParts = this.hangarBridge.hasRequiredParts(category);
    if (hasParts) {
      return this.factoryEconomy.canAfford(cost.cashCost) ? 'ready' : 'missingCash';
    }
    return this.hangarBridge.canAffordQuickBuild(category, this.factoryEconomy) ? 'quick' : 'missingParts';
  }

  private computeStructureSignature(): string {
    return ROCKET_UPGRADES.map((def) => `${def.id}:${this.levelOf(def.id as RocketModuleCategory)}:${this.stateOf(def)}`).join('|');
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
    if (scene.textures.exists('launch_pad')) {
      pad.add(scene.add.image(-40, 4, 'launch_pad').setOrigin(0.5, 0.7).setScale(1.5));
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
    const stats: Array<[string, string, number]> = [
      ['icon_heart', `${getMaxHullHP(this.levelOf('hull'))} HP`, SEMANTIC.danger],
      ['icon_lightning', `Hız ${getFlightSpeed(this.levelOf('engine'))}`, SEMANTIC.rocket],
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

    // Rekor ve sıradaki mesafe hedefi: uçmanın fabrikaya ne kazandırdığı
    const best = this.hangarBridge.getFlightStats().bestDistance || this.economy.stats.bestDistance;
    const nextTarget = FLIGHT_DISTANCE_MILESTONES.find((milestone) => milestone.targetMeters > best);
    const record = layer.text(0, y, `Rekor: ${best} m`, 'bodyBold', { color: SEMANTIC.rocketHex });
    body.add(record);
    y += record.height + 2;
    const goalText = nextTarget
      ? `Sonraki hedef ${formatNumber(nextTarget.targetMeters)} m: kalıcı +%${Math.round(nextTarget.multiplierBonus * 100)} fabrika geliri`
      : 'Tüm mesafe hedefleri tamamlandı.';
    const goal = layer.text(0, y, goalText, 'caption', { color: SEMANTIC.textMuted, wrapWidth: width });
    body.add(goal);
    y += goal.height;

    return y;
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
      const partCount = state === 'max' ? 0 : (cost?.requiredParts.length ?? 0);

      const textHeight = 50 + partCount * 30;
      const cardHeight = Math.max(72, textHeight + SPACE.sm) + (stacked && state !== 'max' ? buttonHeight + SPACE.sm : 0);
      const card = scene.add.container(x, y);
      card.add(createCard(scene, 0, 0, width, cardHeight));

      // Modülün o seviyedeki görseli
      card.add(createInset(scene, SPACE.sm, SPACE.sm, 48, 48));
      const spriteKey = `${def.spritePrefix}${Math.min(3, Math.max(1, level))}`;
      if (scene.textures.exists(spriteKey)) {
        card.add(scene.add.image(SPACE.sm + 24, SPACE.sm + 24, spriteKey).setOrigin(0.5).setScale(2));
      }

      const textX = SPACE.sm + 48 + SPACE.sm;
      const name = layer.text(textX, SPACE.sm, '', 'heading');
      UiLayer.fit(name, def.name, textRight - textX - 36);
      card.add(name);
      card.add(createPips(scene, textRight - 28, SPACE.sm + 9, def.maxLevel, level));

      const stat = layer.text(textX, SPACE.sm + 22, '', 'caption', { color: SEMANTIC.textMuted });
      UiLayer.ellipsize(stat, def.getStatText(level), textRight - textX);
      card.add(stat);

      const ref: ModuleCardRef = { category, partRows: [] };
      if (state === 'max') {
        card.add(new UiChip(layer, textX, SPACE.sm + 40, 'En üst seviye', SEMANTIC.primary, { icon: 'icon_check' }));
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

        const buttonX = stacked ? width / 2 : width - SPACE.sm - buttonWidth / 2;
        const buttonY = stacked ? cardHeight - SPACE.sm - buttonHeight / 2 : cardHeight / 2;
        card.add(this.buildModuleButton(def, state, buttonX, buttonY, buttonWidth, buttonHeight));
      }

      this.cardRefs.push(ref);
      body.add(card);
      y += cardHeight + SPACE.sm;
    }

    return y - SPACE.sm - startY;
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
    const quickCost = this.hangarBridge.getTotalUpgradeCostWithMissingParts(category);

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
        onClick: () => this.upgrade(category, true),
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
          missingParts
            ? 'Parçalar eksik: fabrikada üretip sevkiyat sandığına ulaştır, kendiliğinden hangara gelir.'
            : `Yetersiz bakiye: $${formatNumber(Math.ceil(Math.max(0, cash - this.factoryEconomy.money)))} daha gerekli.`,
        ),
    });
    button.setEnabled(false);
    return button;
  }

  protected buildFooter(footer: Phaser.GameObjects.Container, width: number): number {
    const height = 52;
    const buttonWidth = Math.min(width, 360);
    this.launchButton = new UiButton(this.layer, width / 2, height / 2, {
      width: buttonWidth,
      height,
      variant: 'rocket',
      label: 'UÇUŞU BAŞLAT',
      icon: 'icon_rocket',
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

  private upgrade(category: RocketModuleCategory, quickBuild: boolean): void {
    const upgraded = this.hangarBridge.upgradeModule(category, this.factoryEconomy, quickBuild);
    if (!upgraded) return;
    // Kasa sınıfı roket seviyelerini de saklar; olay dinleyicileri ses ve efekt verir
    this.economy.setRocketUpgradeLevel(category, this.hangarBridge.getModuleLevel(category));
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
