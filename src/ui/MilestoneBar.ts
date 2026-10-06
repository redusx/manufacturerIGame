/* ======================================================================
 * MilestoneBar.ts — Sıradaki hedef / kilometre taşı ilerleme çubuğu
 * Tamamen gerçek piksel-art raster dokuları ile oluşturuldu (docs/ART_DIRECTION.md)
 * ====================================================================== */

import Phaser from 'phaser';
import type { MilestoneProgress } from '../factory/progression/MilestoneManager.ts';
import { formatNumber, formatDuration } from '../utils/format';
import { PALETTE, FONT_FAMILY, PixelUIHelper } from './theme';

export class MilestoneBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;

  private cardBg!: Phaser.GameObjects.NineSlice;
  private barSlotSlice!: Phaser.GameObjects.NineSlice;
  private barFillSlice!: Phaser.GameObjects.NineSlice;
  private trophyIcon!: Phaser.GameObjects.Image;
  private labelText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;

  private barW = 300;
  private barH = 30;
  private currentProgress = 0;
  private targetProgress = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;
    this.container = scene.add.container(0, 0).setDepth(90);
    this.create();
  }

  private create(): void {
    const s = this.scene;
    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    // 1. Kart Arka Planı (9-Slice)
    this.cardBg = PixelUIHelper.createCard(s, 0, 0, 100, 30);
    this.container.add(this.cardBg);

    // 2. Kupa İkonu (Gerçek Piksel Raster Sprite'ı)
    this.trophyIcon = s.add.image(0, 0, 'icon_trophy').setOrigin(0.5, 0.5).setScale(1.1);
    this.container.add(this.trophyIcon);

    // 3. Hedef Başlığı ve Sayacı
    this.labelText = s.add.text(0, 0, 'Sıradaki Hedef', {
      ...font,
      fontSize: '11px',
      color: PALETTE.textPrimary,
      fontStyle: 'bold',
      stroke: '#05070e',
      strokeThickness: 2,
    }).setOrigin(0, 0.5);
    this.container.add(this.labelText);

    // 4. İlerleme Yüzdesi ve Tahmini Süre Metni
    this.progressText = s.add.text(0, 0, '%0', {
      ...font,
      fontSize: '11px',
      color: PALETTE.resourceGoldHex,
      fontStyle: 'bold',
      stroke: '#05070e',
      strokeThickness: 2,
    }).setOrigin(1, 0.5);
    this.container.add(this.progressText);

    // 5. Piksel Oluk Yuvası (Raster 9-Slice)
    this.barSlotSlice = s.add.nineslice(0, 0, 'ui_bar_slot', 0, 100, 8, 4, 4, 4, 4).setOrigin(0, 0);
    this.container.add(this.barSlotSlice);

    // 6. Altın İlerleme Dolgusu (Raster 9-Slice)
    this.barFillSlice = s.add.nineslice(1, 1, 'ui_bar_fill_gold', 0, 10, 6, 2, 2, 2, 2).setOrigin(0, 0);
    this.container.add(this.barFillSlice);
  }

  /**
   * Aktif aşamayı gösterir: sıra numarası, henüz tamamlanmamış ilk koşul ve sayacı.
   * Para koşullarında, ölçülen gelire göre tahmini kalan süre de eklenir.
   */
  updateMilestone(
    progress: MilestoneProgress | null,
    completedCount: number,
    totalCount: number,
    revenuePerSec = 0,
  ): void {
    this.container.setVisible(true);

    if (!progress) {
      this.targetProgress = 1;
      this.currentProgress = 1;
      this.labelText.setText('🏆 Tüm aşamalar tamamlandı!');
      this.progressText.setText('%100');
      this.drawBar();
      return;
    }

    this.targetProgress = Phaser.Math.Clamp(progress.overallPercentage, 0, 1);
    this.currentProgress = Phaser.Math.Linear(this.currentProgress, this.targetProgress, 0.2);

    const pending = progress.conditions.find((c) => !c.isMet) ?? progress.conditions[0];
    const isMoney = pending.type === 'TOTAL_EARNED' || pending.type === 'CURRENT_BALANCE';

    let counter = '';
    if (isMoney) {
      counter = ` ($${formatNumber(pending.current)}/$${formatNumber(pending.target)})`;
    } else if (pending.type !== 'UNLOCK_PLOT') {
      counter = ` (${Math.floor(pending.current)}/${pending.target})`;
    }
    this.labelText.setText(`${completedCount + 1}/${totalCount} · ${pending.description}${counter}`);

    let etaStr = '';
    if (isMoney && revenuePerSec > 0 && pending.target > pending.current) {
      const etaSec = (pending.target - pending.current) / revenuePerSec;
      if (etaSec < 86400) {
        etaStr = ` — ~${formatDuration(etaSec)}`;
      }
    }
    const percentStr = `%${Math.floor(this.targetProgress * 100)}`;
    this.progressText.setText(`${percentStr}${etaStr}`);

    // Dar ekranda görev metniyle çakışıyorsa tahmini süreyi bırak
    const labelRight = this.labelText.x + this.labelText.width;
    if (etaStr && labelRight > this.progressText.x - this.progressText.width - 6) {
      this.progressText.setText(percentStr);
    }

    this.drawBar();
  }

  layout(x: number, y: number, w: number, sf: number): void {
    this.barW = Math.max(160, w);
    this.barH = Math.round(30 * sf);
    this.container.setPosition(x, y);

    this.cardBg.setSize(this.barW, this.barH);

    const pad = Math.round(10 * sf);
    const topRowY = Math.round(9 * sf);
    const botRowY = Math.round(20 * sf);

    this.trophyIcon.setPosition(pad + Math.round(8 * sf), topRowY);
    this.trophyIcon.setScale(Math.max(0.85, sf * 0.95));

    this.labelText.setPosition(pad + Math.round(22 * sf), topRowY);
    this.labelText.setFontSize(`${Math.max(9.5, Math.round(10.5 * sf))}px`);

    this.progressText.setPosition(this.barW - pad, topRowY);
    this.progressText.setFontSize(`${Math.max(9.5, Math.round(10.5 * sf))}px`);

    const slotX = pad;
    const slotW = this.barW - pad * 2;
    const slotH = Math.max(6, Math.round(7 * sf));

    this.barSlotSlice.setPosition(slotX, botRowY);
    this.barSlotSlice.setSize(slotW, slotH);

    this.barFillSlice.setPosition(slotX + 1, botRowY + 1);

    this.drawBar();
  }

  private drawBar(): void {
    const pad = Math.round(10 * (this.barH / 30));
    const slotW = this.barW - pad * 2;
    const slotH = this.barSlotSlice.height;

    const fillW = Math.max(0, Math.floor((slotW - 2) * this.currentProgress));
    if (fillW > 2) {
      this.barFillSlice.setVisible(true);
      this.barFillSlice.setSize(fillW, Math.max(4, slotH - 2));
    } else {
      this.barFillSlice.setVisible(false);
    }
  }

  playGoalReachedEffect(): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.04, scaleY: 1.04,
      duration: 100, yoyo: true,
      ease: 'Back.easeOut',
    });
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }

  ignoreCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    camera.ignore([this.container]);
  }
}