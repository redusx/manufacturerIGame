/* ======================================================================
 * MilestoneBar.ts — Sıradaki hedef / kilometre taşı ilerleme çubuğu
 * ====================================================================== */

import Phaser from 'phaser';
import type { FactoryGoal } from '../data/MachineData';
import { formatNumber } from '../utils/format';
import type { Decimal } from '../utils/decimal';

export class MilestoneBar {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;

  private bg!: Phaser.GameObjects.Graphics;
  private fillGraphics!: Phaser.GameObjects.Graphics;
  private iconText!: Phaser.GameObjects.Text;
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
      fontFamily: 'Arial, Helvetica, sans-serif',
    };

    this.bg = s.add.graphics();
    this.container.add(this.bg);

    this.fillGraphics = s.add.graphics();
    this.container.add(this.fillGraphics);

    this.iconText = s.add.text(0, 0, '🎯', { ...font, fontSize: '13px' }).setOrigin(0, 0.5);
    this.container.add(this.iconText);

    this.labelText = s.add.text(0, 0, 'Sıradaki Hedef', {
      ...font, fontSize: '11px', color: '#e8e8e8', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.container.add(this.labelText);

    this.progressText = s.add.text(0, 0, '%0', {
      ...font, fontSize: '11px', color: '#2ecc71', fontStyle: 'bold',
    }).setOrigin(1, 0.5);
    this.container.add(this.progressText);
  }

  updateGoal(goalInfo: {
    goal: FactoryGoal;
    progress: number;
    current: Decimal;
    target: Decimal;
  } | null): void {
    if (!goalInfo) {
      this.container.setVisible(false);
      return;
    }

    this.container.setVisible(true);
    const { goal, progress, current, target } = goalInfo;
    this.targetProgress = Phaser.Math.Clamp(progress, 0, 1);

    // Yumuşak ilerleme interpolasyonu
    this.currentProgress = Phaser.Math.Linear(this.currentProgress, this.targetProgress, 0.2);

    const percent = Math.floor(this.targetProgress * 100);
    this.labelText.setText(`${goal.name}: ${formatNumber(current)} / ${formatNumber(target)}`);
    this.progressText.setText(`%${percent}`);

    this.drawBar();
  }

  layout(x: number, y: number, w: number, sf: number): void {
    this.barW = Math.max(160, w);
    this.barH = Math.round(20 * sf);
    this.container.setPosition(x, y);

    const cy = this.barH / 2;
    const pad = Math.round(8 * sf);

    this.iconText.setPosition(pad, cy);
    this.iconText.setFontSize(`${Math.round(12 * sf)}px`);

    this.labelText.setPosition(pad + 18 * sf, cy);
    this.labelText.setFontSize(`${Math.round(10 * sf)}px`);

    this.progressText.setPosition(this.barW - pad, cy);
    this.progressText.setFontSize(`${Math.round(10 * sf)}px`);

    this.drawBar();
  }

  private drawBar(): void {
    const w = this.barW;
    const h = this.barH;

    // Arka plan
    this.bg.clear();
    this.bg.fillStyle(0x131325, 0.9);
    this.bg.fillRoundedRect(0, 0, w, h, 6);
    this.bg.lineStyle(1, 0x2e3856, 0.8);
    this.bg.strokeRoundedRect(0, 0, w, h, 6);

    // İlerleme dolgusu
    this.fillGraphics.clear();
    const fillW = Math.max(0, (w - 2) * this.currentProgress);
    if (fillW > 4) {
      this.fillGraphics.fillStyle(0x2ecc71, 0.35);
      this.fillGraphics.fillRoundedRect(1, 1, fillW, h - 2, 5);
      this.fillGraphics.fillStyle(0x2ecc71, 0.7);
      this.fillGraphics.fillRect(1, h - 3, fillW, 2);
    }
  }

  /** Tamamlanma kutlama animasyonu */
  playGoalReachedEffect(): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.05, scaleY: 1.05,
      duration: 150, yoyo: true,
      ease: 'Back.easeOut',
    });
  }
}
