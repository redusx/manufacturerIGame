/* ======================================================================
 * CatalogInfoModals.ts — Katalogdaki bilgi pencereleri
 *
 * MachineInfoModal: bir makineyi kurmadan önce ne yaptığını gösterir —
 * reçeteleri (girdi ve çıktı adetleriyle), çevrim süresi, saniyelik üretim.
 * ItemPriceModal: bütün eşyaların sevkiyat sandığındaki birim satış fiyatı.
 * İkisi de eşya, reçete ve makine kayıtlarındaki gerçek değerleri okur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { MachineDefinition } from '../factory/types.ts';
import { defaultItemRegistry } from '../factory/simulation/ItemRegistry.ts';
import { defaultRecipeRegistry } from '../factory/simulation/RecipeRegistry.ts';
import { MACHINE_SPRITE_TILE, machineThumbScale } from '../factory/view/MachineSprites.ts';
import { formatNumber } from '../utils/format.ts';
import { SEMANTIC, SPACE } from './theme.ts';
import type { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { createCard, createDivider, createInset } from './system/UiWidgets.ts';

/** Katalogun üstünde açılırlar */
const INFO_DEPTH = 260;

function itemName(itemId: string): string {
  return defaultItemRegistry.get(itemId)?.name ?? itemId;
}

function itemIcon(scene: Phaser.Scene, itemId: string): Phaser.GameObjects.Image {
  const item = defaultItemRegistry.get(itemId);
  const icon = scene.add.image(0, 0, item?.spriteKey ?? 'pickup_gear').setOrigin(0.5);
  if (item?.colorTint !== undefined) icon.setTint(item.colorTint);
  icon.setScale(Math.min(1, 16 / Math.max(icon.width, icon.height)));
  return icon;
}

/** Kuruşlu fiyatlar yuvarlanmadan gösterilir ($0.50) */
function formatPrice(value: number): string {
  return Number.isInteger(value) ? formatNumber(value) : value.toFixed(2);
}

function describeStacks(stacks: ReadonlyArray<{ itemId: string; count: number }>): string {
  return stacks.map((stack) => `${stack.count}× ${itemName(stack.itemId)}`).join('  +  ');
}

export class MachineInfoModal extends UiModal {
  private def: MachineDefinition | null = null;

  constructor(layer: UiLayer) {
    super(layer, { title: '', maxWidth: 460, depth: INFO_DEPTH, accent: SEMANTIC.secondary });
  }

  showFor(def: MachineDefinition): void {
    this.def = def;
    this.setTitle(def.name);
    this.open();
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const def = this.def;
    if (!def) return 0;
    const scene = this.scene;
    const layer = this.layer;
    let y = 0;

    // --- Özet: görsel, açıklama, boyut ve bedel ---------------------------
    const headH = 80;
    body.add(createInset(scene, 0, y, width, headH));
    const sprite = scene.add.image(SPACE.sm + 32, y + headH / 2, def.spriteBaseKey, 0).setOrigin(0.5);
    sprite.setScale(
      machineThumbScale(def.width * MACHINE_SPRITE_TILE, def.height * MACHINE_SPRITE_TILE, 64),
    );
    body.add(sprite);
    const textX = SPACE.sm + 72;
    body.add(
      layer.text(textX, y + 8, def.description, 'caption', {
        color: SEMANTIC.textPrimary,
        wrapWidth: width - textX - SPACE.sm,
      }),
    );
    body.add(
      layer.text(
        textX,
        y + headH - 22,
        `Alan ${def.width}x${def.height}  ·  Bedel $${formatNumber(def.baseCost)}`,
        'captionBold',
        { color: SEMANTIC.moneyHex },
      ),
    );
    y += headH + SPACE.sm;

    const inputs = def.ports.filter((port) => port.type === 'INPUT').length;
    const outputs = def.ports.filter((port) => port.type === 'OUTPUT').length;
    const hint = layer.text(
      0,
      y,
      `Yeşil ok girdi (${inputs}), turuncu ok çıktı (${outputs}) yönüdür. Girdi her kenardan alınır; ürün yalnızca turuncu oktan çıkar.`,
      'caption',
      { color: SEMANTIC.textMuted, wrapWidth: width },
    );
    body.add(hint);
    y += hint.height + SPACE.md;

    // --- Reçeteler: girdi -> çıktı, adetleriyle -----------------------------
    const title = layer.text(0, y, 'ÜRETEBİLDİKLERİ', 'captionBold', { color: SEMANTIC.moneyHex });
    body.add(title);
    body.add(createDivider(scene, title.width + SPACE.sm, y + 8, width - title.width - SPACE.sm));
    y += 22;

    for (const recipeId of def.supportedRecipeIds) {
      const recipe = defaultRecipeRegistry.get(recipeId);
      if (!recipe) continue;

      const pad = SPACE.sm;
      const inner = width - pad * 2;
      const main = recipe.outputs[0];

      const outIcon = main ? itemIcon(scene, main.itemId) : null;
      const outName = layer.text(pad + 22, 0, main ? itemName(main.itemId) : recipe.name, 'bodyBold');
      const inText = layer.text(pad, 0, `Girdi: ${describeStacks(recipe.inputs)}`, 'caption', {
        color: SEMANTIC.textPrimary,
        wrapWidth: inner,
      });
      const outText = layer.text(pad, 0, `Çıktı: ${describeStacks(recipe.outputs)}`, 'caption', {
        color: SEMANTIC.primaryHex,
        wrapWidth: inner,
      });
      const perSec = main ? main.count / recipe.processingTimeSec : 0;
      const value = main ? (defaultItemRegistry.get(main.itemId)?.baseValue ?? 0) : 0;
      const rateText = layer.text(
        pad,
        0,
        `Çevrim ${recipe.processingTimeSec.toFixed(1)} sn  ·  ${perSec.toFixed(2)} adet/sn  ·  birim $${formatPrice(value)}`,
        'caption',
        { color: SEMANTIC.textMuted, wrapWidth: inner },
      );

      let cursor = pad;
      outName.setY(cursor);
      outIcon?.setPosition(pad + 8, cursor + outName.height / 2);
      cursor += outName.height + 4;
      inText.setY(cursor);
      cursor += inText.height + 2;
      outText.setY(cursor);
      cursor += outText.height + 2;
      rateText.setY(cursor);
      cursor += rateText.height + pad;

      const card = scene.add.container(0, y);
      card.add(createCard(scene, 0, 0, width, cursor));
      if (outIcon) card.add(outIcon);
      card.add([outName, inText, outText, rateText]);
      body.add(card);
      y += cursor + SPACE.sm;
    }

    return y - SPACE.sm;
  }
}

const TIER_TITLES: readonly string[] = [
  'HAMMADDELER',
  'İŞLENMİŞ MALZEMELER',
  'PARÇALAR',
  'BİLEŞENLER',
  'ROKET SİSTEMLERİ',
];

export class ItemPriceModal extends UiModal {
  constructor(layer: UiLayer) {
    super(layer, { title: 'Birim Fiyat Listesi', maxWidth: 420, depth: INFO_DEPTH, accent: SEMANTIC.money });
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const scene = this.scene;
    const layer = this.layer;
    let y = 0;

    const note = layer.text(
      0,
      y,
      'Sevkiyat sandığına ulaşan her ürünün temel satış fiyatı. Gelir çarpanın varsa bu fiyatın üstüne eklenir.',
      'caption',
      { color: SEMANTIC.textMuted, wrapWidth: width },
    );
    body.add(note);
    y += note.height + SPACE.md;

    const rowH = 26;
    TIER_TITLES.forEach((tierTitle, tier) => {
      const items = defaultItemRegistry.getByTier(tier);
      if (items.length === 0) return;

      const title = layer.text(0, y, tierTitle, 'captionBold', { color: SEMANTIC.moneyHex });
      body.add(title);
      body.add(createDivider(scene, title.width + SPACE.sm, y + 8, width - title.width - SPACE.sm));
      y += 22;

      body.add(createInset(scene, 0, y, width, items.length * rowH + SPACE.xs * 2));
      y += SPACE.xs;
      for (const item of items) {
        const centerY = y + rowH / 2;
        body.add(itemIcon(scene, item.id).setPosition(SPACE.sm + 8, centerY));
        const price = layer
          .text(width - SPACE.sm, centerY, `$${formatPrice(item.baseValue)}`, 'bodyBold', {
            color: SEMANTIC.moneyHex,
          })
          .setOrigin(1, 0.5);
        const name = layer.text(SPACE.sm + 24, centerY, item.name, 'body').setOrigin(0, 0.5);
        const maxWidth = width - SPACE.sm * 3 - 24 - price.width;
        if (name.width > maxWidth) {
          name.setFontSize(11);
        }
        body.add([name, price]);
        y += rowH;
      }
      y += SPACE.xs + SPACE.md;
    });

    return y - SPACE.md;
  }
}
