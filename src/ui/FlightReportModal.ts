/* ======================================================================
 * FlightReportModal.ts — Uçuş sonu raporu
 *
 * Uçuş bitince ne olduğunu ve ne kazanıldığını gösterir. En önemli sonuç
 * (uçuş primi ve fabrikanın kaç saniyelik geliri ettiği) en büyük öğedir;
 * tek eylem fabrikaya dönmektir.
 * ====================================================================== */

import Phaser from 'phaser';
import { RangeLadder } from '../flight/RangeLadder.ts';
import type { FlightReportViewModel } from '../scenes/FlightReturnHelper.ts';
import { formatDistance, formatNumber } from '../utils/format.ts';
import { SEMANTIC, SPACE, uiIcon } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import type { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { createInset } from './system/UiWidgets.ts';

export interface FlightReportData {
  isCrash: boolean;
  reason: string;
  totalCash: number;
  gears: number;
  crystals: number;
  view: FlightReportViewModel;
}

export class FlightReportModal extends UiModal {
  private data: FlightReportData | null = null;
  private returnButton: UiButton | null = null;
  private readonly onReturn: () => void;

  constructor(layer: UiLayer, onReturn: () => void) {
    // Rapor yalnız "Fabrikaya dön" ile kapanır
    super(layer, { title: '', maxWidth: 400, dismissible: false, accent: SEMANTIC.rocket });
    this.onReturn = onReturn;
  }

  showReport(data: FlightReportData): void {
    this.data = data;
    if (data.isCrash) {
      this.setTitle(data.reason);
      this.setAccent(SEMANTIC.danger);
    } else if (data.view.isNewBestDistance) {
      this.setTitle('Yeni mesafe rekoru!');
      this.setAccent(SEMANTIC.money);
    } else {
      this.setTitle('Uçuş tamamlandı');
      this.setAccent(SEMANTIC.rocket);
    }
    this.open();
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const data = this.data;
    if (!data) return 0;
    const layer = this.layer;
    const scene = this.scene;
    const view = data.view;
    let y = 0;

    // Uçuş primi: raporun en büyük öğesi
    const primH = 80;
    body.add(createInset(scene, 0, y, width, primH));
    body.add(layer.text(width / 2, y + 16, 'UÇUŞ PRİMİ', 'captionBold', { color: SEMANTIC.textMuted }).setOrigin(0.5));
    body.add(
      layer
        .text(width / 2, y + 42, `+$${formatNumber(data.totalCash)}`, 'display', { color: SEMANTIC.moneyHex, stroke: true })
        .setOrigin(0.5),
    );
    body.add(
      layer
        .text(width / 2, y + 66, `Fabrikanın ${view.breakdown.incomeSeconds} saniyelik geliri`, 'caption', {
          color: SEMANTIC.textMuted,
        })
        .setOrigin(0.5),
    );
    y += primH + SPACE.sm;

    // Yeni ulaşılan menziller: her birinin kalıcı ödülü
    if (view.unlockedMilestones.length > 0) {
      const lines = view.unlockedMilestones
        .map(
          (rung) =>
            `${rung.name} (${formatDistance(rung.targetMeters)}): ${RangeLadder.describeRewards(rung).join(' · ')}`,
        )
        .join('\n');
      const title = layer.text(SPACE.md + 20, y + SPACE.sm, 'Yeni menzile ulaştın!', 'bodyBold', {
        color: SEMANTIC.moneyHex,
      });
      const banner = layer.text(SPACE.md + 20, title.y + title.height + 2, lines, 'caption', {
        color: SEMANTIC.textPrimary,
        wrapWidth: width - SPACE.md * 2 - 20,
      });
      const bannerH = title.height + 2 + banner.height + SPACE.sm * 2;
      body.add(createInset(scene, 0, y, width, bannerH));
      body.add(scene.add.image(SPACE.md + 6, y + SPACE.sm + title.height / 2, 'icon_trophy').setOrigin(0.5));
      body.add([title, banner]);
      y += bannerH + SPACE.sm;
    }

    // Sıradaki menzil hedefi: daha ileri gitmek için neyin kaldığı
    if (view.nextTarget) {
      const target = view.nextTarget;
      const head = layer.text(
        SPACE.md + 20,
        y + SPACE.sm,
        `Sıradaki hedef: ${formatDistance(target.targetMeters)} (${target.name})`,
        'bodyBold',
        { color: SEMANTIC.rocketHex, wrapWidth: width - SPACE.md * 2 - 20 },
      );
      const detail = layer.text(
        SPACE.md + 20,
        head.y + head.height + 2,
        `Hedefe ${formatDistance(target.remainingMeters)} kaldı · Ödül: ${target.rewards.join(' · ')}`,
        'caption',
        { color: SEMANTIC.textMuted, wrapWidth: width - SPACE.md * 2 - 20 },
      );
      const targetH = head.height + 2 + detail.height + SPACE.sm * 2;
      body.add(createInset(scene, 0, y, width, targetH));
      body.add(scene.add.image(SPACE.md + 6, y + SPACE.sm + head.height / 2, 'icon_rocket').setOrigin(0.5));
      body.add([head, detail]);
      y += targetH + SPACE.sm;
    }

    // Uçuş ayrıntıları
    const rows: Array<[string, number | undefined, string, string]> = [
      ['icon_flag', undefined, 'Mesafe', view.distanceText],
      [uiIcon('up'), SEMANTIC.rocket, 'En yüksek irtifa', view.maxAltitudeText],
      [uiIcon('clock'), 0x8c9bb3, 'Havada kalma', view.durationText],
      ['icon_gear', undefined, 'Toplanan dişli', `${data.gears} adet`],
      [uiIcon('star'), SEMANTIC.rocket, 'Toplanan kristal', `${data.crystals} adet`],
    ];
    const rowH = 26;
    body.add(createInset(scene, 0, y, width, rows.length * rowH + SPACE.sm));
    rows.forEach(([icon, tint, label, value], index) => {
      const centerY = y + SPACE.xs + rowH / 2 + index * rowH;
      const image = scene.add.image(SPACE.md + 4, centerY, icon).setOrigin(0.5);
      if (tint !== undefined) image.setTint(tint);
      body.add(image);
      body.add(layer.text(SPACE.md + 20, centerY, label, 'body', { color: SEMANTIC.textMuted }).setOrigin(0, 0.5));
      body.add(layer.text(width - SPACE.md, centerY, value, 'bodyBold').setOrigin(1, 0.5));
    });
    y += rows.length * rowH + SPACE.sm;

    return y;
  }

  protected buildFooter(footer: Phaser.GameObjects.Container, width: number): number {
    const height = 52;
    this.returnButton = new UiButton(this.layer, width / 2, height / 2, {
      width,
      height,
      variant: 'primary',
      label: 'FABRİKAYA DÖN',
      icon: 'icon_factory',
      iconScale: 1.5,
      onClick: () => {
        this.close();
        this.onReturn();
      },
    });
    footer.add(this.returnButton);
    return height;
  }

  protected primaryButton(): UiButton | null {
    return this.returnButton;
  }
}
