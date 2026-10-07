/* ======================================================================
 * src/factory/view/MachineInspectorModal.ts — Makine penceresi
 *
 * Bir makineye dokununca açılır ve yukarıdan aşağı şu sırayla okunur:
 * durum ve seviye → ne ürettiği ve ne hızla → reçete (girdi → çıktı) →
 * reçete seçimi → depolar → yükseltme. Ana eylem (Yükselt) ve tehlikeli
 * eylem (Sök) pencerenin altında sabittir.
 *
 * Canlı değerler (durum, depolar, üretim çevrimi) açıkken sürekli yenilenir;
 * pencerenin yapısı yalnız makine, seviye veya reçete değişince yeniden kurulur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { MachineEntity } from '../simulation/MachineEntity.ts';
import type { ProductionEngine } from '../simulation/ProductionEngine.ts';
import type { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { RecipeRegistry, defaultRecipeRegistry } from '../simulation/RecipeRegistry.ts';
import { ItemRegistry, defaultItemRegistry } from '../simulation/ItemRegistry.ts';
import {
  MachineInspectorHelper,
  type InspectorBufferItem,
  type MachineInspectorData,
} from './MachineInspectorHelper.ts';
import { formatNumber } from '../../utils/format.ts';
import { SEMANTIC, SPACE, uiIcon } from '../../ui/theme.ts';
import { UiButton } from '../../ui/system/UiButton.ts';
import type { UiLayer } from '../../ui/system/UiLayer.ts';
import { UiModal } from '../../ui/system/UiModal.ts';
import {
  UiChip,
  UiProgressBar,
  createDivider,
  createInset,
  type UiBarColor,
} from '../../ui/system/UiWidgets.ts';

export interface MachineInspectorModalConfig {
  onUpgrade?: (machine: MachineEntity, newLevel: number) => void;
  /** Parası yetmeyen yükseltme düğmesine basılınca */
  onUpgradeDenied?: () => void;
  onRecipeChanged?: (machine: MachineEntity, recipeId: string) => void;
  onDemolishRequested?: (machine: MachineEntity) => void;
  onClose?: () => void;
}

interface BufferRow {
  itemId: string;
  kind: 'input' | 'output';
  countText: Phaser.GameObjects.Text;
  bar: UiProgressBar;
}

/** Canlı değerlerin yenilenme aralığı (ms) */
const LIVE_REFRESH_INTERVAL_MS = 100;

/** Durum yalnız renkle değil, ikon ve metinle de anlatılır */
const STATUS_ICONS: Readonly<Record<string, string>> = {
  PROCESSING: 'icon_check',
  WAITING_INPUT: uiIcon('clock'),
  BLOCKED_OUTPUT: uiIcon('warning'),
  IDLE: uiIcon('info'),
};

export class MachineInspectorModal extends UiModal {
  private readonly engine: ProductionEngine;
  private readonly economy: FactoryEconomy;
  private readonly recipeRegistry: RecipeRegistry;
  private readonly itemRegistry: ItemRegistry;
  private readonly callbacks: MachineInspectorModalConfig;

  private targetMachine: MachineEntity | null = null;
  private structureSignature = '';
  private lastLiveRefresh = 0;

  // Canlı güncellenen öğeler
  private statusChip: UiChip | null = null;
  private statusChipRight = 0;
  private cycleBar: UiProgressBar | null = null;
  private bufferRows: BufferRow[] = [];
  private upgradeButton: UiButton | null = null;

  constructor(
    layer: UiLayer,
    engine: ProductionEngine,
    economy: FactoryEconomy,
    config: MachineInspectorModalConfig = {},
    recipeRegistry: RecipeRegistry = defaultRecipeRegistry,
    itemRegistry: ItemRegistry = defaultItemRegistry,
  ) {
    super(layer, { title: '', maxWidth: 440, accent: SEMANTIC.factory });
    this.engine = engine;
    this.economy = economy;
    this.callbacks = config;
    this.recipeRegistry = recipeRegistry;
    this.itemRegistry = itemRegistry;
  }

  /** Verilen makineyi incelemek üzere pencereyi açar */
  openFor(machine: MachineEntity): void {
    this.targetMachine = machine;
    this.setTitle(machine.def.name);
    this.open();
  }

  protected onClosedInternal(): void {
    this.targetMachine = null;
    this.structureSignature = '';
    this.statusChip = null;
    this.cycleBar = null;
    this.bufferRows = [];
    this.upgradeButton = null;
    this.callbacks.onClose?.();
  }

  private inspect(): MachineInspectorData | null {
    if (!this.targetMachine) return null;
    // Makine başka bir yolla söküldüyse pencere de kapanır
    if (!this.engine.getMachine(this.targetMachine.instanceId)) return null;
    return MachineInspectorHelper.inspect(
      this.targetMachine,
      this.engine,
      this.economy,
      this.recipeRegistry,
      this.itemRegistry,
    );
  }

  private signatureOf(data: MachineInspectorData): string {
    return [
      data.instanceId,
      data.level,
      data.activeRecipeId ?? '-',
      data.inputBuffers.map((b) => b.itemId).join(','),
      data.outputBuffers.map((b) => b.itemId).join(','),
    ].join('|');
  }

  // -------------------------------------------------------------
  // CANLI YENİLEME
  // -------------------------------------------------------------

  /** Açıkken her karede çağrılır; canlı değerleri belirli aralıkla yeniler */
  refresh(): void {
    if (!this.isOpen) return;
    const now = this.scene.time.now;
    if (now - this.lastLiveRefresh < LIVE_REFRESH_INTERVAL_MS) return;
    this.lastLiveRefresh = now;

    const data = this.inspect();
    if (!data) {
      this.close();
      return;
    }
    if (this.signatureOf(data) !== this.structureSignature) {
      this.rebuild();
      return;
    }
    this.applyLiveValues(data);
  }

  private applyLiveValues(data: MachineInspectorData): void {
    if (this.statusChip) {
      this.statusChip.setChip(data.statusLabel, data.statusColorInt);
      this.statusChip.setX(this.statusChipRight - this.statusChip.chipWidth);
    }
    this.cycleBar?.setProgress(data.status === 'PROCESSING' ? data.progressRatio : 0);

    for (const row of this.bufferRows) {
      const source = row.kind === 'input' ? data.inputBuffers : data.outputBuffers;
      const buffer = source.find((b) => b.itemId === row.itemId);
      if (!buffer) continue;
      row.countText.setText(`${buffer.count}/${buffer.capacity}`);
      row.bar.setProgress(buffer.percentage);
      row.bar.setColor(this.bufferColor(row.kind, buffer, data));
    }

    this.upgradeButton?.setEnabled(data.canAffordUpgrade);
  }

  /** Dolu çıktı deposu (hat tıkalı) kırmızı gösterilir */
  private bufferColor(kind: 'input' | 'output', buffer: InspectorBufferItem, data: MachineInspectorData): UiBarColor {
    if (kind === 'input') return 'cyan';
    return data.status === 'BLOCKED_OUTPUT' && buffer.percentage >= 1 ? 'red' : 'green';
  }

  // -------------------------------------------------------------
  // İÇERİK
  // -------------------------------------------------------------

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const data = this.inspect();
    this.bufferRows = [];
    this.statusChip = null;
    this.cycleBar = null;
    if (!data || !this.targetMachine) return 0;
    this.structureSignature = this.signatureOf(data);

    const scene = this.scene;
    const layer = this.layer;
    const machine = this.targetMachine;
    let y = 0;

    const section = (title: string): void => {
      const text = layer.text(0, y, title, 'captionBold', { color: SEMANTIC.moneyHex });
      body.add(text);
      body.add(createDivider(scene, text.width + SPACE.sm, y + 8, width - text.width - SPACE.sm));
      y += 22;
    };

    // --- Durum ve seviye ---------------------------------------------------
    const statusH = 72;
    body.add(createInset(scene, 0, y, width, statusH));
    const sprite = scene.add.image(SPACE.sm + 28, y + 32, machine.def.spriteBaseKey ?? 'machine_bench').setOrigin(0.5);
    sprite.setScale(Math.min(1, 48 / Math.max(sprite.width, sprite.height)));
    body.add(sprite);

    const infoX = SPACE.sm + 64;
    body.add(layer.text(infoX, y + 12, `Seviye ${data.level}`, 'heading'));
    body.add(
      layer.text(infoX, y + 34, `Hız ${MachineInspectorHelper.formatSpeed(data.speedMultiplier)}`, 'caption', {
        color: SEMANTIC.textMuted,
      }),
    );

    this.statusChipRight = width - SPACE.sm;
    this.statusChip = new UiChip(layer, 0, y + 10, data.statusLabel, data.statusColorInt, {
      icon: STATUS_ICONS[data.status] ?? uiIcon('info'),
    });
    this.statusChip.setX(this.statusChipRight - this.statusChip.chipWidth);
    body.add(this.statusChip);

    // Üretim çevriminin ilerlemesi
    this.cycleBar = new UiProgressBar(scene, SPACE.sm, y + statusH - 16, width - SPACE.sm * 2, 8, 'gold');
    body.add(this.cycleBar);
    y += statusH + SPACE.md;

    // --- Üretim: ne üretiyor, ne hızla --------------------------------------
    const activeRecipe = data.availableRecipes.find((r) => r.isActive) ?? null;
    section('ÜRETİM');
    if (activeRecipe && activeRecipe.outputs.length > 0) {
      const output = activeRecipe.outputs[0];
      const cycleSec = activeRecipe.processingTimeSec / data.speedMultiplier;
      const perSec = output.count / cycleSec;

      const rate = layer.text(0, y, `${perSec.toFixed(2)} / sn`, 'display', { color: SEMANTIC.moneyHex, stroke: true });
      body.add(rate);
      const outIcon = this.itemIcon(output.itemId).setPosition(rate.width + SPACE.md + 8, y + rate.height / 2);
      body.add(outIcon);
      body.add(
        layer
          .text(rate.width + SPACE.md + 22, y + rate.height / 2, output.name, 'bodyBold', {
            wrapWidth: width - rate.width - SPACE.md - 22,
          })
          .setOrigin(0, 0.5),
      );
      y += rate.height + SPACE.sm;

      // Reçete akışı: girdiler → çıktılar
      y = this.addRecipeFlow(body, width, y, activeRecipe.inputs, activeRecipe.outputs);
      body.add(
        layer.text(0, y, `Bir çevrim ${cycleSec.toFixed(1)} sn sürer.`, 'caption', { color: SEMANTIC.textMuted }),
      );
      y += 18 + SPACE.sm;
    } else {
      const empty = layer.text(0, y, 'Reçete seçilmedi; makine üretmiyor.', 'body', {
        color: SEMANTIC.warningHex,
        wrapWidth: width,
      });
      body.add(empty);
      y += empty.height + SPACE.md;
    }

    // --- Reçete seçimi --------------------------------------------------------
    if (data.availableRecipes.length > 1) {
      section('REÇETE SEÇ');
      const columns = width >= 360 ? 2 : 1;
      const gap = SPACE.sm;
      const chipWidth = (width - gap * (columns - 1)) / columns;
      const chipHeight = 44;

      data.availableRecipes.forEach((recipe, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const outputId = recipe.outputs[0]?.itemId;
        const item = outputId ? this.itemRegistry.get(outputId) : undefined;
        const button = new UiButton(layer, column * (chipWidth + gap) + chipWidth / 2, y + row * (chipHeight + gap) + chipHeight / 2, {
          width: chipWidth,
          height: chipHeight,
          variant: recipe.isActive ? 'primary' : 'secondary',
          label: recipe.outputs[0]?.name ?? recipe.name,
          textVariant: 'buttonSmall',
          icon: recipe.isActive ? 'icon_check' : item?.spriteKey,
          iconTint: recipe.isActive ? undefined : item?.colorTint,
          onClick: () => this.selectRecipe(recipe.recipeId),
        });
        button.setSelected(recipe.isActive);
        body.add(button);
      });
      y += Math.ceil(data.availableRecipes.length / columns) * (chipHeight + gap) + SPACE.xs;
    }

    // --- Depolar ------------------------------------------------------------------
    section('DEPO');
    const bufferRow = (kind: 'input' | 'output', buffer: InspectorBufferItem): void => {
      const label = `${kind === 'input' ? 'Girdi' : 'Çıktı'} · ${buffer.name}`;
      const countText = layer
        .text(width, y, `${buffer.count}/${buffer.capacity}`, 'captionBold')
        .setOrigin(1, 0);
      const labelText = layer.text(0, y, label, 'caption', { color: SEMANTIC.textMuted });
      const bar = new UiProgressBar(scene, 0, y + 17, width, 10, this.bufferColor(kind, buffer, data));
      bar.setProgress(buffer.percentage);
      body.add([labelText, countText, bar]);
      this.bufferRows.push({ itemId: buffer.itemId, kind, countText, bar });
      y += 34;
    };
    data.inputBuffers.forEach((buffer) => bufferRow('input', buffer));
    data.outputBuffers.forEach((buffer) => bufferRow('output', buffer));
    y += SPACE.xs;

    // --- Yükseltme özeti ------------------------------------------------------------
    section('YÜKSELTME');
    const upgradeH = 44;
    body.add(createInset(scene, 0, y, width, upgradeH));
    body.add(scene.add.image(SPACE.md + 4, y + upgradeH / 2, uiIcon('up')).setOrigin(0.5).setTint(SEMANTIC.primary));
    body.add(
      layer
        .text(SPACE.md + 20, y + upgradeH / 2, `Seviye ${data.level} → ${data.level + 1}`, 'bodyBold')
        .setOrigin(0, 0.5),
    );
    body.add(
      layer
        .text(
          width - SPACE.md,
          y + upgradeH / 2,
          `Hız ${MachineInspectorHelper.formatSpeed(data.speedMultiplier)} → ${MachineInspectorHelper.formatSpeed(data.nextSpeedMultiplier)}`,
          'bodyBold',
          { color: SEMANTIC.primaryHex },
        )
        .setOrigin(1, 0.5),
    );
    y += upgradeH;

    this.applyLiveValues(data);
    return y;
  }

  /** "1× Demir Tozu → 1× Demir Külçe" akışını ikonlarla dizer; satıra sığmayanı alta alır */
  private addRecipeFlow(
    body: Phaser.GameObjects.Container,
    width: number,
    startY: number,
    inputs: { itemId: string; name: string; count: number }[],
    outputs: { itemId: string; name: string; count: number }[],
  ): number {
    const lineHeight = 24;
    let x = 0;
    let y = startY;

    const place = (tokenWidth: number): { x: number; y: number } => {
      if (x > 0 && x + tokenWidth > width) {
        x = 0;
        y += lineHeight;
      }
      const position = { x, y };
      x += tokenWidth + SPACE.sm;
      return position;
    };

    const addItem = (entry: { itemId: string; name: string; count: number }): void => {
      const text = this.layer.text(0, 0, `${entry.count}× ${entry.name}`, 'body').setOrigin(0, 0.5);
      const at = place(20 + text.width);
      const icon = this.itemIcon(entry.itemId).setPosition(at.x + 8, at.y + lineHeight / 2);
      text.setPosition(at.x + 20, at.y + lineHeight / 2);
      body.add([icon, text]);
    };

    inputs.forEach(addItem);
    const arrowAt = place(16);
    body.add(
      this.scene.add
        .image(arrowAt.x + 8, arrowAt.y + lineHeight / 2, uiIcon('arrow_right'))
        .setOrigin(0.5)
        .setTint(SEMANTIC.money),
    );
    outputs.forEach(addItem);

    return y + lineHeight + SPACE.xs;
  }

  /** Eşyanın bantta görünen sprite'ı (renk tonuyla) */
  private itemIcon(itemId: string): Phaser.GameObjects.Image {
    const item = this.itemRegistry.get(itemId);
    const icon = this.scene.add.image(0, 0, item?.spriteKey ?? 'pickup_gear').setOrigin(0.5);
    if (item?.colorTint !== undefined) icon.setTint(item.colorTint);
    icon.setScale(Math.min(1, 16 / Math.max(icon.width, icon.height)));
    return icon;
  }

  protected buildFooter(footer: Phaser.GameObjects.Container, width: number): number {
    const data = this.inspect();
    if (!data) return 0;

    const height = 48;
    const gap = SPACE.sm;
    const demolishWidth = Math.max(96, Math.round(width * 0.34));
    const upgradeWidth = width - demolishWidth - gap;

    const demolishButton = new UiButton(this.layer, demolishWidth / 2, height / 2, {
      width: demolishWidth,
      height,
      variant: 'danger',
      label: 'SÖK',
      sublabel: `+$${formatNumber(data.demolishRefund)} iade`,
      silent: true,
      onClick: () => this.demolish(),
    });

    this.upgradeButton = new UiButton(this.layer, demolishWidth + gap + upgradeWidth / 2, height / 2, {
      width: upgradeWidth,
      height,
      variant: 'primary',
      label: 'YÜKSELT',
      sublabel: `$${formatNumber(data.upgradeCost)}`,
      silent: true,
      onClick: () => this.upgrade(),
      onDisabledClick: () => this.callbacks.onUpgradeDenied?.(),
    });
    this.upgradeButton.setEnabled(data.canAffordUpgrade);

    footer.add([demolishButton, this.upgradeButton]);
    return height;
  }

  protected primaryButton(): UiButton | null {
    return this.upgradeButton;
  }

  // -------------------------------------------------------------
  // EYLEMLER
  // -------------------------------------------------------------

  private upgrade(): void {
    if (!this.targetMachine) return;
    const result = MachineInspectorHelper.performUpgrade(this.targetMachine, this.engine, this.economy);
    if (result.success) {
      const machine = this.targetMachine;
      this.rebuild();
      this.callbacks.onUpgrade?.(machine, result.newLevel);
    } else {
      this.callbacks.onUpgradeDenied?.();
    }
  }

  private selectRecipe(recipeId: string): void {
    if (!this.targetMachine || this.targetMachine.activeRecipeId === recipeId) return;
    const result = MachineInspectorHelper.selectRecipe(this.targetMachine, recipeId);
    if (result.success) {
      const machine = this.targetMachine;
      this.rebuild();
      this.callbacks.onRecipeChanged?.(machine, recipeId);
    }
  }

  private demolish(): void {
    const machine = this.targetMachine;
    if (!machine) return;
    this.close();
    this.callbacks.onDemolishRequested?.(machine);
  }
}
