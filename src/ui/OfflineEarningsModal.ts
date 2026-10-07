/* ======================================================================
 * src/ui/OfflineEarningsModal.ts — Çevrimdışı kazanç penceresi
 *
 * Oyuncu geri döndüğünde yokluğunda biriken parayı gösterir. En önemli bilgi
 * (kazanılan para) en büyük öğedir; ana eylem "Topla", ikincil eylem reklamla
 * ikiye katlamadır. Pencereyi kapatmak normal ödülü toplar.
 * ====================================================================== */

import Phaser from 'phaser';
import type Decimal from 'break_eternity.js';
import { SEMANTIC, SPACE, uiIcon } from './theme.ts';
import { MAX_OFFLINE_CAP_HOURS } from '../flight/RangeLadder.ts';
import { formatOfflineDuration, type OfflineEarningsReport } from './OfflineEarningsHelper.ts';
import { UiButton } from './system/UiButton.ts';
import type { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { createInset } from './system/UiWidgets.ts';

export interface OfflineEarningsModalConfig {
  onClaim: (gained: Decimal) => void;
  onDoubleClaim?: (gained: Decimal) => void;
}

export class OfflineEarningsModal extends UiModal {
  private readonly callbacks: OfflineEarningsModalConfig;
  private report: OfflineEarningsReport | null = null;
  private claimButton: UiButton | null = null;

  constructor(layer: UiLayer, config: OfflineEarningsModalConfig) {
    super(layer, { title: 'Fabrika Raporu', maxWidth: 380, depth: 260, accent: SEMANTIC.money });
    this.callbacks = config;
  }

  /** Pencereyi verilen çevrimdışı raporuyla açar */
  showReport(report: OfflineEarningsReport): void {
    if (!report.isEligible) return;
    this.report = report;
    this.setTitle(report.welcomeTitle);
    this.open();
  }

  /** [X], dışarı dokunma ve Esc normal ödülü toplar */
  requestClose(): void {
    this.claim(false);
  }

  private claim(doubled: boolean): void {
    const report = this.report;
    if (!report) {
      this.close();
      return;
    }
    this.report = null;
    this.close();
    if (doubled && this.callbacks.onDoubleClaim) {
      this.callbacks.onDoubleClaim(report.doubledEarnings);
    } else {
      this.callbacks.onClaim(report.baseEarnings);
    }
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const report = this.report;
    if (!report) return 0;
    const layer = this.layer;
    let y = 0;

    const message = layer.text(0, y, report.welcomeMessage, 'body', { color: SEMANTIC.textMuted, wrapWidth: width });
    body.add(message);
    y += message.height + SPACE.md;

    // Biriken para: pencerenin en büyük öğesi
    const earnH = 76;
    body.add(createInset(this.scene, 0, y, width, earnH));
    body.add(layer.text(width / 2, y + 18, 'BİRİKEN KAZANÇ', 'captionBold', { color: SEMANTIC.textMuted }).setOrigin(0.5));
    const coin = this.scene.add.image(0, y + 48, 'icon_coin').setOrigin(0.5).setScale(1.5);
    const amount = layer
      .text(0, y + 48, `+$${report.formattedBaseEarnings}`, 'display', { color: SEMANTIC.moneyHex, stroke: true })
      .setOrigin(0, 0.5);
    const groupWidth = 24 + 6 + amount.width;
    coin.setX(width / 2 - groupWidth / 2 + 12);
    amount.setX(width / 2 - groupWidth / 2 + 30);
    body.add([coin, amount]);
    y += earnH + SPACE.sm;

    // Ayrıntı satırları
    const rows: Array<[string, string, string]> = [
      [uiIcon('clock'), 'Uzakta kalınan süre', report.formattedDuration],
      [uiIcon('wrench'), 'Çevrimdışı verim', `%${report.efficiencyPercent}`],
    ];
    const rowH = 28;
    body.add(createInset(this.scene, 0, y, width, rows.length * rowH + SPACE.sm));
    rows.forEach(([icon, label, value], i) => {
      const centerY = y + SPACE.xs + rowH / 2 + i * rowH;
      body.add(this.scene.add.image(SPACE.md + 4, centerY, icon).setOrigin(0.5).setTint(0x8c9bb3));
      body.add(layer.text(SPACE.md + 20, centerY, label, 'body', { color: SEMANTIC.textMuted }).setOrigin(0, 0.5));
      body.add(layer.text(width - SPACE.md, centerY, value, 'bodyBold').setOrigin(1, 0.5));
    });
    y += rows.length * rowH + SPACE.sm;

    if (report.wasCapped) {
      y += SPACE.sm;
      // Süre sınırı menzil basamaklarıyla uzar (4 → 8 → 12 saat)
      const capText = `En fazla ${formatOfflineDuration(report.capSeconds)}lik kazanç birikir.`;
      const hint = report.capSeconds < MAX_OFFLINE_CAP_HOURS * 3600 ? ' Daha uzak menzil bu süreyi uzatır.' : '';
      const warning = layer.text(0, y, capText + hint, 'caption', {
        color: SEMANTIC.warningHex,
        wrapWidth: width,
      });
      body.add(warning);
      y += warning.height;
    }

    return y;
  }

  protected buildFooter(footer: Phaser.GameObjects.Container, width: number): number {
    const report = this.report;
    if (!report) return 0;
    const height = 48;
    let y = 0;

    this.claimButton = new UiButton(this.layer, width / 2, y + height / 2, {
      width,
      height,
      variant: 'primary',
      label: `TOPLA  +$${report.formattedBaseEarnings}`,
      onClick: () => this.claim(false),
    });
    footer.add(this.claimButton);
    y += height;

    if (this.callbacks.onDoubleClaim) {
      y += SPACE.sm;
      const doubleButton = new UiButton(this.layer, width / 2, y + height / 2, {
        width,
        height,
        variant: 'gold',
        label: `2X İÇİN REKLAM İZLE  +$${report.formattedDoubledEarnings}`,
        textVariant: 'buttonSmall',
        onClick: () => this.claim(true),
      });
      footer.add(doubleButton);
      y += height;
    }

    return y;
  }

  protected primaryButton(): UiButton | null {
    return this.claimButton;
  }
}
