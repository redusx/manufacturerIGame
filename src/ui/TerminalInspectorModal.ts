/* ======================================================================
 * src/ui/TerminalInspectorModal.ts — Giriş ve sevkiyat penceresi
 *
 * Fabrikanın iki ucunu anlatır: hammadde girişi (ne verir, ne hızla) ve
 * sevkiyat sandığı (ne işe yarar, ne kazandırıyor). İkisi de taşınabilir; giriş
 * ayrıca sökülebilir (son kurulanın bedeli iade edilir), sandık sökülemez.
 * ====================================================================== */

import Phaser from 'phaser';
import type { GridCoord } from '../factory/types.ts';
import { formatNumber, formatRate } from '../utils/format.ts';
import { SEMANTIC, SPACE, uiIcon } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import type { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { UiChip, createInset } from './system/UiWidgets.ts';

export type TerminalType = 'INTAKE' | 'EXPORT' | 'CHOICE';

export interface TerminalInspectorModalConfig {
  onRelocate: (type: 'INTAKE' | 'EXPORT', sourceCoord?: GridCoord) => void;
  /** Yeni giriş kurmak için kataloğu açar */
  onOpenCatalog?: () => void;
  /** İncelenen girişin verdiği hammaddenin adı */
  getIntakeItemName?: (coord?: GridCoord) => string | undefined;
  /** Fabrikanın ölçülen saniyelik geliri */
  getRevenuePerSec?: () => number;
  /** İncelenen giriş sökülürse iade edilecek tutar */
  getIntakeRefund?: (coord: GridCoord) => number;
  /** İncelenen girişi söker; verilmezse "Sök" düğmesi çizilmez */
  onDemolishIntake?: (coord: GridCoord) => void;
}

export class TerminalInspectorModal extends UiModal {
  private readonly callbacks: TerminalInspectorModalConfig;
  private shownType: TerminalType = 'CHOICE';
  private shownCoord?: GridCoord;
  private relocateButton: UiButton | null = null;

  constructor(layer: UiLayer, config: TerminalInspectorModalConfig) {
    super(layer, { title: '', maxWidth: 380, accent: SEMANTIC.factory });
    this.callbacks = config;
  }

  /** Pencereyi belirli bir uç (veya ikisinden birini seçtirmek) için açar */
  openFor(type: TerminalType, coord?: GridCoord): void {
    this.shownType = type;
    this.shownCoord = coord;

    if (type === 'INTAKE') {
      const item = this.callbacks.getIntakeItemName?.(coord) ?? 'Hammadde';
      this.setTitle(`${item} Girişi`);
      this.setAccent(SEMANTIC.secondary);
    } else if (type === 'EXPORT') {
      this.setTitle('Sevkiyat Sandığı');
      this.setAccent(SEMANTIC.factory);
    } else {
      this.setTitle('Hangisini taşıyacaksın?');
      this.setAccent(SEMANTIC.secondary);
    }
    this.open();
  }

  private relocate(type: 'INTAKE' | 'EXPORT'): void {
    const coord = this.shownType === type ? this.shownCoord : undefined;
    this.close();
    this.callbacks.onRelocate(type, coord);
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const layer = this.layer;
    const scene = this.scene;

    if (this.shownType === 'CHOICE') {
      const note = layer.text(0, 0, 'Taşımak ücretsizdir. Seçtikten sonra yeni yerini gösterirsin.', 'body', {
        color: SEMANTIC.textMuted,
        wrapWidth: width,
      });
      body.add(note);
      let y = note.height + SPACE.md;

      const option = (label: string, sublabel: string, icon: string, type: 'INTAKE' | 'EXPORT'): void => {
        const button = new UiButton(layer, width / 2, y + 28, {
          width,
          height: 56,
          variant: 'secondary',
          label,
          sublabel,
          icon,
          iconScale: 1.5,
          onClick: () => this.relocate(type),
        });
        body.add(button);
        y += 56 + SPACE.sm;
      };
      option('HAMMADDE GİRİŞİ', 'Cevherin fabrikaya girdiği yer', uiIcon('intake'), 'INTAKE');
      option('SEVKİYAT SANDIĞI', 'Ürünlerin satıldığı yer', uiIcon('crate'), 'EXPORT');
      return y - SPACE.sm;
    }

    const isIntake = this.shownType === 'INTAKE';
    const item = this.callbacks.getIntakeItemName?.(this.shownCoord) ?? 'hammadde';
    const boxH = 72;
    body.add(createInset(scene, 0, 0, width, boxH));

    const icon = scene.add
      .image(SPACE.md + 20, boxH / 2, isIntake ? uiIcon('intake') : uiIcon('crate'))
      .setOrigin(0.5)
      .setScale(2);
    body.add(icon);

    const textX = SPACE.md + 48;
    const headline = isIntake ? `Saniyede 1 ${item}` : 'Buraya ulaşan her ürün satılır';
    const headlineText = layer.text(textX, 16, headline, 'bodyBold', { wrapWidth: width - textX - SPACE.md });
    body.add(headlineText);

    const chipY = Math.max(42, 16 + headlineText.height + 6);
    if (isIntake) {
      body.add(new UiChip(layer, textX, chipY, 'Çalışıyor', SEMANTIC.primary, { icon: 'icon_check' }));
    } else {
      const rate = this.callbacks.getRevenuePerSec?.() ?? 0;
      body.add(new UiChip(layer, textX, chipY, `+$${formatRate(rate)}/sn`, SEMANTIC.primary, { icon: 'icon_coin' }));
    }

    let y = Math.max(boxH, chipY + 26) + SPACE.md;
    const help = isIntake
      ? 'Okun gösterdiği kenara bant döşeyip hammaddeyi makinelere taşı. Daha fazla hammadde için katalogdan yeni giriş kur. Giriş taşınabilir veya sökülebilir; sökünce son kurduğun girişin bedeli iade edilir.'
      : 'Ürünleri bantla buraya getir; her ürün değeri kadar para kazandırır. Roketin beklediği parçalar satılmaz, hangara gider.';
    const helpText = layer.text(0, y, help, 'body', { color: SEMANTIC.textMuted, wrapWidth: width });
    body.add(helpText);
    y += helpText.height;
    return y;
  }

  protected buildFooter(footer: Phaser.GameObjects.Container, width: number): number {
    if (this.shownType === 'CHOICE') {
      this.relocateButton = null;
      return 0;
    }
    const type = this.shownType;
    const height = 48;
    const showCatalog = type === 'INTAKE' && this.callbacks.onOpenCatalog !== undefined;
    const gap = SPACE.sm;

    // Sök düğmesi makine penceresindeki gibi solda ve kırmızıdır
    const coord = this.shownCoord;
    const onDemolish = this.callbacks.onDemolishIntake;
    let left = 0;
    if (type === 'INTAKE' && coord && onDemolish) {
      const demolishWidth = Math.max(84, Math.round(width * 0.27));
      const refund = this.callbacks.getIntakeRefund?.(coord) ?? 0;
      footer.add(
        new UiButton(this.layer, demolishWidth / 2, height / 2, {
          width: demolishWidth,
          height,
          variant: 'remove',
          label: 'SÖK',
          sublabel: refund > 0 ? `+$${formatNumber(refund)} iade` : 'İade yok',
          silent: true,
          onClick: () => {
            this.close();
            onDemolish(coord);
          },
        }),
      );
      left = demolishWidth + gap;
    }

    const remaining = width - left;
    const buttonWidth = showCatalog ? (remaining - gap) / 2 : remaining;

    this.relocateButton = new UiButton(this.layer, left + buttonWidth / 2, height / 2, {
      width: buttonWidth,
      height,
      variant: 'primary',
      label: 'TAŞI',
      sublabel: 'Ücretsiz',
      onClick: () => this.relocate(type),
    });
    footer.add(this.relocateButton);

    if (showCatalog) {
      const catalogButton = new UiButton(this.layer, left + buttonWidth + gap + buttonWidth / 2, height / 2, {
        width: buttonWidth,
        height,
        variant: 'secondary',
        label: 'YENİ GİRİŞ',
        sublabel: 'Katalog',
        onClick: () => {
          this.close();
          this.callbacks.onOpenCatalog?.();
        },
      });
      footer.add(catalogButton);
    }
    return height;
  }

  protected primaryButton(): UiButton | null {
    return this.relocateButton;
  }
}
