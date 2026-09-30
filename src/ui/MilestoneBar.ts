/* ======================================================================
 * MilestoneBar.ts — Sıradaki hedef / kilometre taşı ilerleme çubuğu
 * Tamamen gerçek piksel-art raster dokuları ile oluşturuldu (docs/ART_DIRECTION.md)
 * ====================================================================== */

import Phaser from 'phaser';
import type { FactoryGoal } from '../data/MachineData';
import { formatNumber, formatDuration } from '../utils/format';
import type { Decimal } from '../utils/decimal';
import { PALETTE, FONT_FAMILY } from './theme';

export class MilestoneBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;

  private barSlotSlice!: Phaser.GameObjects.NineSlice;
  private barFillSlice!: Phaser.GameObjects.NineSlice;
  private trophyIcon!: Phaser.GameObjects.Image;
  private labelText!: Phaser.GameObjects.Text;
  private progressText!: Phaser.GameObjects.Text;

  private barW = 300;
  private barH = 22;
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

    // 1. Piksel Oluk Yuvası (Raster 9-Slice)
    this.barSlotSlice = s.add.nineslice(0, 0, 'ui_bar_slot', 0, 100, 20, 4, 4, 4, 4).setOrigin(0, 0);
    this.container.add(this.barSlotSlice);

    // 2. Altın İlerleme Dolgusu (Raster 9-Slice)
    this.barFillSlice = s.add.nineslice(2, 2, 'ui_bar_fill_gold', 0, 10, 16, 2, 2, 2, 2).setOrigin(0, 0);
    this.container.add(this.barFillSlice);

    // 3. Kupa İkonu (Gerçek Piksel Raster Sprite'ı)
    this.trophyIcon = s.add.image(0, 0, 'icon_trophy').setOrigin(0, 0.5).setScale(1.1);
    this.container.add(this.trophyIcon);

    this.labelText = s.add.text(0, 0, 'Sıradaki Hedef', {
      ...font,
      fontSize: '11px',
      color: PALETTE.textPrimary,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.container.add(this.labelText);

    this.progressText = s.add.text(0, 0, '%0', {
      ...font,
      fontSize: '11px',
      color: PALETTE.resourceGoldHex,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    this.container.add(this.progressText);
  }

  updateGoal(goalInfo: {
    goal: FactoryGoal;
    progress: number;
    current: Decimal;
    target: Decimal;
  } | null, pps?: Decimal): void {
    if (!goalInfo) {
      this.container.setVisible(false);
      return;
    }

    this.container.setVisible(true);
    const { goal, progress, current, target } = goalInfo;
    this.targetProgress = Phaser.Math.Clamp(progress, 0, 1);

    this.currentProgress = Phaser.Math.Linear(this.currentProgress, this.targetProgress, 0.2);

    const percent = Math.floor(this.targetProgress * 100);
    this.labelText.setText(`${goal.name}: ${formatNumber(current)} / ${formatNumber(target)}`);

    // Tahmini süre hesaplama
    let etaStr = '';
    if (pps && pps.gt(0) && target.gt(current)) {
      const remaining = target.sub(current);
      const etaSec = remaining.div(pps).toNumber();
      if (etaSec < 86400) { // 24 saatten kısa ise göster
        etaStr = ` — ~${formatDuration(etaSec)}`;
      }
    }

    this.progressText.setText(`%${percent}${etaStr}`);

    this.drawBar();
  }

  layout(x: number, y: number, w: number, sf: number): void {
    this.barW = Math.max(160, w);
    this.barH = Math.round(20 * sf);
    this.container.setPosition(x, y);

    const cy = this.barH / 2;
    const pad = Math.round(8 * sf);

    this.barSlotSlice.setSize(this.barW, this.barH);

    this.trophyIcon.setPosition(pad, cy);
    this.trophyIcon.setScale(Math.max(0.8, sf * 0.95));

    this.labelText.setPosition(pad + Math.round(18 * sf), cy);
    this.labelText.setFontSize(`${Math.max(9, Math.round(10 * sf))}px`);

    this.progressText.setPosition(this.barW - pad, cy);
    this.progressText.setFontSize(`${Math.max(9, Math.round(10 * sf))}px`);

    this.drawBar();
  }

  private drawBar(): void {
    const w = this.barW;
    const h = this.barH;

    const fillW = Math.max(0, Math.floor((w - 4) * this.currentProgress));
    if (fillW > 2) {
      this.barFillSlice.setVisible(true);
      this.barFillSlice.setSize(fillW, h - 4);
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
}
