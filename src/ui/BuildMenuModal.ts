/* ======================================================================
 * src/ui/BuildMenuModal.ts — İnşa kataloğu
 *
 * Fabrikaya eklenebilecek her şey tek listede, bölümlere ayrılmış kartlarla:
 * lojistik, makineler, hammadde girişleri, genişleme ve taşıma. Her kart ne
 * olduğunu (ikon + ad), ne işe yaradığını (ne ürettiği), kapladığı alanı ve
 * bedelini gösterir; tek bir büyük düğmeyle seçilir. Kilitli kart hangi aşamada
 * açılacağını, parası yetmeyen kart ne kadar eksik olduğunu söyler.
 * ====================================================================== */

import Phaser from 'phaser';
import { defaultMachineRegistry } from '../factory/simulation/MachineRegistry.ts';
import { defaultRecipeRegistry } from '../factory/simulation/RecipeRegistry.ts';
import { defaultItemRegistry } from '../factory/simulation/ItemRegistry.ts';
import {
  CONVEYOR_BUILD_COST,
  SPLITTER_BUILD_COST,
  MERGER_BUILD_COST,
  INTAKE_BUILD_COSTS,
} from '../factory/input/PlacementMath.ts';
import type { PlacementItem } from '../factory/input/PlacementController.ts';
import type { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';
import { formatNumber } from '../utils/format.ts';
import { SEMANTIC, SPACE, uiIcon } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { createCard, createDivider, createInset } from './system/UiWidgets.ts';

export interface CatalogPlotInfo {
  index: number;
  name: string;
  cost: number;
  width: number;
  height: number;
}

export interface BuildMenuModalConfig {
  onSelectItem: (item: PlacementItem) => void;
  /**
   * Kart henüz kilitliyse onu açacak aşamanın numarasını döner; açıksa null.
   * Kart kimlikleri: 'conveyor', 'splitter', 'merger', makine tanım kimliği veya
   * `intake_new_<hammadde>`.
   */
  getLockStage?: (cardId: string) => number | null;
  /** Satın alınabilecek sıradaki parsel (hepsi açıksa null) */
  getNextPlot?: () => CatalogPlotInfo | null;
  onExpandPlot?: (plotIndex: number) => void;
  /** Kilitli veya parası yetmeyen karta basılınca gösterilecek açıklama */
  onDenied?: (message: string) => void;
}

/** Yeni hammadde girişi kartlarının kimlik öneki (`intake_new_<hammadde>`) */
export const INTAKE_CARD_PREFIX = 'intake_new_';

interface CatalogEntry {
  id: string;
  name: string;
  /** Ne işe yaradığı: tek satırlık, somut */
  detail: string;
  cost: number;
  /** Kapladığı alan ("2x1"); alan kaplamıyorsa boş */
  size: string;
  icon: string;
  iconScale: number;
  action: 'build' | 'move' | 'expand';
  item?: PlacementItem;
  plotIndex?: number;
}

interface CatalogSection {
  title: string;
  entries: CatalogEntry[];
}

interface CardRef {
  entry: CatalogEntry;
  button: UiButton;
}

const CARD_HEIGHT = 84;
const CARD_HEIGHT_STACKED = 116;
const CARD_GAP = SPACE.sm;
const ICON_BOX = 56;
const SIDE_CTA_WIDTH = 108;

export class BuildMenuModal extends UiModal {
  private readonly economy: FactoryEconomy;
  private readonly callbacks: BuildMenuModalConfig;
  private cards: CardRef[] = [];
  /** Kartların yapısını belirleyen durum (kilitler, sıradaki parsel); değişince liste yeniden kurulur */
  private structureSignature = '';

  constructor(layer: UiLayer, economy: FactoryEconomy, config: BuildMenuModalConfig) {
    super(layer, { title: 'İnşa Kataloğu', maxWidth: 920, accent: SEMANTIC.primary });
    this.economy = economy;
    this.callbacks = config;
  }

  // -------------------------------------------------------------
  // İÇERİK
  // -------------------------------------------------------------

  private getSections(): CatalogSection[] {
    const sections: CatalogSection[] = [];

    sections.push({
      title: 'LOJİSTİK',
      entries: [
        {
          id: 'conveyor',
          name: 'Konveyör Bandı',
          detail: 'Ürünleri taşır. Sürükleyerek çizilir.',
          cost: CONVEYOR_BUILD_COST,
          size: '1x1',
          icon: uiIcon('belt'),
          iconScale: 2.5,
          action: 'build',
          item: { type: 'CONVEYOR' },
        },
        {
          id: 'splitter',
          name: 'Akış Ayırıcı',
          detail: 'Bir hattı iki hatta eşit böler.',
          cost: SPLITTER_BUILD_COST,
          size: '1x1',
          icon: uiIcon('belt'),
          iconScale: 2.5,
          action: 'build',
          item: { type: 'SPLITTER' },
        },
        {
          id: 'merger',
          name: 'Akış Birleştirici',
          detail: 'İki hattı tek hatta toplar.',
          cost: MERGER_BUILD_COST,
          size: '1x1',
          icon: uiIcon('belt'),
          iconScale: 2.5,
          action: 'build',
          item: { type: 'MERGER' },
        },
      ],
    });

    sections.push({
      title: 'MAKİNELER',
      entries: defaultMachineRegistry.getAll().map((machine) => ({
        id: machine.id,
        name: machine.name,
        detail: `Üretir: ${this.describeOutputs(machine.supportedRecipeIds)}`,
        cost: machine.baseCost,
        size: `${machine.width}x${machine.height}`,
        icon: machine.spriteBaseKey ?? 'machine_bench',
        iconScale: 1,
        action: 'build' as const,
        item: { type: 'MACHINE' as const, machineDef: machine },
      })),
    });

    sections.push({
      title: 'HAMMADDE GİRİŞLERİ',
      entries: Object.entries(INTAKE_BUILD_COSTS).map(([itemId, cost]) => {
        const itemName = defaultItemRegistry.get(itemId)?.name ?? itemId;
        return {
          id: `${INTAKE_CARD_PREFIX}${itemId}`,
          name: `${itemName} Girişi`,
          detail: `Saniyede 1 ${itemName} verir.`,
          cost,
          size: '1x1',
          icon: uiIcon('intake'),
          iconScale: 2.5,
          action: 'build' as const,
          item: { type: 'INTAKE_NEW' as const, intakeItemId: itemId },
        };
      }),
    });

    const plot = this.callbacks.getNextPlot?.() ?? null;
    if (plot) {
      sections.push({
        title: 'GENİŞLEME',
        entries: [
          {
            id: `plot_${plot.index}`,
            name: plot.name,
            detail: `Fabrika alanını ${plot.width}x${plot.height} hücreye büyütür.`,
            cost: plot.cost,
            size: '',
            icon: uiIcon('expand'),
            iconScale: 2.5,
            action: 'expand',
            plotIndex: plot.index,
          },
        ],
      });
    }

    sections.push({
      title: 'TAŞIMA',
      entries: [
        {
          id: 'intake_move',
          name: 'Hammadde Girişini Taşı',
          detail: 'İlk girişin yerini değiştirir. Diğerleri için girişe dokun.',
          cost: 0,
          size: '',
          icon: uiIcon('intake'),
          iconScale: 2.5,
          action: 'move',
          item: { type: 'INTAKE_MOVE' },
        },
        {
          id: 'export_move',
          name: 'Sevkiyat Sandığını Taşı',
          detail: 'Ürünlerin satıldığı sandığın yerini değiştirir.',
          cost: 0,
          size: '',
          icon: uiIcon('crate'),
          iconScale: 2.5,
          action: 'move',
          item: { type: 'EXPORT_MOVE' },
        },
      ],
    });

    return sections;
  }

  /** Makinenin reçetelerinin ana çıktıları: "Demir Tozu, Bakır Tozu" */
  private describeOutputs(recipeIds: readonly string[]): string {
    const names: string[] = [];
    for (const recipeId of recipeIds) {
      const outputId = defaultRecipeRegistry.get(recipeId)?.outputs[0]?.itemId;
      const name = outputId ? defaultItemRegistry.get(outputId)?.name : undefined;
      if (name && !names.includes(name)) names.push(name);
    }
    return names.length > 3 ? `${names.slice(0, 3).join(', ')} +${names.length - 3}` : names.join(', ');
  }

  private lockStageOf(entry: CatalogEntry): number | null {
    if (entry.action !== 'build') return null;
    return this.callbacks.getLockStage?.(entry.id) ?? null;
  }

  /** Yapıyı belirleyen durum: kartların kilitleri ve sıradaki parsel (her karede ucuzca hesaplanır) */
  private computeStructureSignature(): string {
    const locks = this.cards.map(({ entry }) => `${entry.id}:${this.lockStageOf(entry) ?? '-'}`).join('|');
    return `${this.callbacks.getNextPlot?.()?.index ?? '-'}#${locks}`;
  }

  // -------------------------------------------------------------
  // YERLEŞİM
  // -------------------------------------------------------------

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    this.cards = [];

    const columns = width >= 900 ? 3 : width >= 560 ? 2 : 1;
    const cardWidth = Math.floor((width - CARD_GAP * (columns - 1)) / columns);
    // Dar kartta düğme yazının yanına gelince ad kesilir; düğme alta iner
    const stacked = cardWidth < 400;
    const cardHeight = stacked ? CARD_HEIGHT_STACKED : CARD_HEIGHT;

    let y = 0;
    for (const section of this.getSections()) {
      const title = this.layer.text(0, y, section.title, 'captionBold', { color: SEMANTIC.moneyHex });
      body.add(title);
      body.add(createDivider(this.scene, title.width + SPACE.sm, y + 8, width - title.width - SPACE.sm));
      y += 22;

      section.entries.forEach((entry, index) => {
        const column = index % columns;
        const row = Math.floor(index / columns);
        const card = this.buildCard(entry, cardWidth, cardHeight, stacked);
        card.setPosition(column * (cardWidth + CARD_GAP), y + row * (cardHeight + CARD_GAP));
        body.add(card);
      });

      const rows = Math.ceil(section.entries.length / columns);
      y += rows * (cardHeight + CARD_GAP) + SPACE.xs;
    }

    this.structureSignature = this.computeStructureSignature();
    this.refresh();
    return y - CARD_GAP;
  }

  private buildCard(
    entry: CatalogEntry,
    cardWidth: number,
    cardHeight: number,
    stacked: boolean,
  ): Phaser.GameObjects.Container {
    const scene = this.scene;
    const layer = this.layer;
    const card = scene.add.container(0, 0);
    const lockStage = this.lockStageOf(entry);

    card.add(createCard(scene, 0, 0, cardWidth, cardHeight));

    // İkon kutusu ve kapladığı alan
    const boxX = SPACE.sm;
    const boxY = SPACE.sm + 4;
    card.add(createInset(scene, boxX, boxY, ICON_BOX, ICON_BOX));
    const icon = scene.add
      .image(boxX + ICON_BOX / 2, boxY + ICON_BOX / 2, entry.icon)
      .setOrigin(0.5)
      .setScale(entry.iconScale);
    if (lockStage !== null) icon.setAlpha(0.45);
    card.add(icon);
    if (entry.size) {
      card.add(
        layer
          .text(boxX + ICON_BOX - 3, boxY + ICON_BOX - 2, entry.size, 'captionBold', {
            color: SEMANTIC.moneyHex,
            stroke: true,
          })
          .setOrigin(1, 1),
      );
    }

    // Ad ve açıklama
    const textX = boxX + ICON_BOX + SPACE.sm;
    const textWidth = cardWidth - textX - SPACE.sm - (stacked ? 0 : SIDE_CTA_WIDTH + SPACE.sm);
    const name = layer.text(textX, SPACE.sm + 2, '', 'heading');
    UiLayer.fit(name, entry.name, textWidth);
    card.add(name);
    card.add(
      layer.text(textX, SPACE.sm + 24, entry.detail, 'caption', {
        color: SEMANTIC.textMuted,
        wrapWidth: textWidth,
      }),
    );

    // Eylem düğmesi
    const buttonWidth = stacked ? cardWidth - textX - SPACE.sm : SIDE_CTA_WIDTH;
    const buttonHeight = stacked ? 40 : 48;
    const buttonX = stacked ? textX + buttonWidth / 2 : cardWidth - SPACE.sm - buttonWidth / 2;
    const buttonY = stacked ? cardHeight - SPACE.sm - buttonHeight / 2 : cardHeight / 2;

    let button: UiButton;
    if (lockStage !== null) {
      button = new UiButton(layer, buttonX, buttonY, {
        width: buttonWidth,
        height: buttonHeight,
        label: `Aşama ${lockStage}`,
        icon: uiIcon('lock'),
        iconTint: SEMANTIC.warning,
        textVariant: 'buttonSmall',
        onClick: () => undefined,
        onDisabledClick: () =>
          this.callbacks.onDenied?.(`${entry.name}, ${lockStage}. aşama tamamlanınca açılır.`),
      });
      button.setEnabled(false);
    } else {
      const verb = entry.action === 'move' ? 'TAŞI' : entry.action === 'expand' ? 'AÇ' : 'KUR';
      button = new UiButton(layer, buttonX, buttonY, {
        width: buttonWidth,
        height: buttonHeight,
        variant: entry.action === 'move' ? 'secondary' : 'primary',
        label: verb,
        sublabel: entry.cost > 0 ? `$${formatNumber(entry.cost)}` : 'Ücretsiz',
        onClick: () => this.select(entry),
        onDisabledClick: () => {
          const missing = Math.max(0, entry.cost - this.economy.money);
          this.callbacks.onDenied?.(`Yetersiz bakiye: $${formatNumber(Math.ceil(missing))} daha gerekli.`);
        },
      });
    }
    card.add(button);
    this.cards.push({ entry, button });

    return card;
  }

  private select(entry: CatalogEntry): void {
    if (entry.action === 'expand' && entry.plotIndex !== undefined) {
      this.callbacks.onExpandPlot?.(entry.plotIndex);
      return;
    }
    if (entry.item) {
      this.callbacks.onSelectItem(entry.item);
    }
  }

  /** Açıkken her karede çağrılır: paranın yetip yetmediğine göre düğmeleri günceller */
  refresh(): void {
    if (!this.isOpen) return;

    // Bir aşama tamamlanıp kilit açıldıysa veya parsel alındıysa liste yeniden kurulur
    if (this.computeStructureSignature() !== this.structureSignature) {
      this.rebuild();
      return;
    }

    for (const { entry, button } of this.cards) {
      if (this.lockStageOf(entry) !== null) continue;
      button.setEnabled(entry.cost <= 0 || this.economy.canAfford(entry.cost));
    }
  }
}
