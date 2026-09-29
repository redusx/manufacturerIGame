/* ======================================================================
 * HUD.ts — Üst bilgi çubuğu (kaynak, üretim hızı, ayarlar butonu)
 * ====================================================================== */

import Phaser from 'phaser';
import type { DecimalSource } from 'break_eternity.js';
import { D } from '../utils/decimal';
import { formatNumber } from '../utils/format';
import { RESOURCE_NAME } from '../data/MachineData';

export class HUD {
  private scene: Phaser.Scene;

  private bg!: Phaser.GameObjects.Graphics;
  private resourceIcon!: Phaser.GameObjects.Text;
  private resourceText!: Phaser.GameObjects.Text;
  private rateText!: Phaser.GameObjects.Text;
  private settingsBtn!: Phaser.GameObjects.Text;

  private onSettingsClick: () => void;

  constructor(scene: Phaser.Scene, onSettingsClick: () => void) {
    this.scene = scene;
    this.onSettingsClick = onSettingsClick;
    this.create();
  }

  private create(): void {
    const s = this.scene;
    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Arial, Helvetica, sans-serif',
    };

    this.bg = s.add.graphics().setDepth(100);

    this.resourceIcon = s.add.text(0, 0, '⚙', { ...font, fontSize: '22px' })
      .setOrigin(0, 0.5).setDepth(101);

    this.resourceText = s.add.text(0, 0, '0', {
      ...font, fontSize: '22px', color: '#f4a261', fontStyle: 'bold',
    }).setOrigin(0, 0.5).setDepth(101);

    this.rateText = s.add.text(0, 0, '', {
      ...font, fontSize: '13px', color: '#8888a0',
    }).setOrigin(0, 0.5).setDepth(101);

    this.settingsBtn = s.add.text(0, 0, '⚙', {
      ...font, fontSize: '24px', color: '#8888a0',
    }).setOrigin(1, 0.5).setDepth(101)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onSettingsClick())
      .on('pointerover', () => this.settingsBtn.setColor('#d4d4e0'))
      .on('pointerout', () => this.settingsBtn.setColor('#8888a0'));
  }

  update(resources: DecimalSource, perSecond: DecimalSource): void {
    const resDec = D(resources);
    const ppsDec = D(perSecond);

    this.resourceText.setText(formatNumber(resDec));
    if (ppsDec.gt(0)) {
      this.rateText.setText(`+${formatNumber(ppsDec)} ${RESOURCE_NAME}/sn`);
    } else {
      this.rateText.setText('0 /sn (Tıkla!)');
    }
  }

  layout(w: number, _h: number, sf: number): void {
    const barH = Math.round(48 * sf);
    const pad = Math.round(14 * sf);

    this.bg.clear();
    // Glassmorphism-style dark header
    this.bg.fillStyle(0x0c0c1a, 0.95);
    this.bg.fillRect(0, 0, w, barH);
    this.bg.lineStyle(1, 0x2e3856, 0.7);
    this.bg.lineBetween(0, barH, w, barH);

    // Accent line along top edge
    this.bg.fillStyle(0xf4a261, 0.8);
    this.bg.fillRect(0, 0, Math.min(w, 240 * sf), 2);

    const cy = barH / 2;

    this.resourceIcon.setPosition(pad, cy);
    this.resourceIcon.setFontSize(`${Math.round(22 * sf)}px`);

    this.resourceText.setPosition(pad + 30 * sf, cy - 2);
    this.resourceText.setFontSize(`${Math.round(22 * sf)}px`);

    this.rateText.setPosition(pad + 30 * sf, cy + 18 * sf);
    this.rateText.setFontSize(`${Math.round(11 * sf)}px`);

    this.settingsBtn.setPosition(w - pad, cy);
    this.settingsBtn.setFontSize(`${Math.round(22 * sf)}px`);
  }

  /** Kaynak ikonunun ve metninin ekran koordinatını döndürür */
  getResourceTargetPos(): { x: number; y: number } {
    return {
      x: this.resourceText.x + 30,
      y: this.resourceText.y,
    };
  }

  /** Kaynak metnine vurgu efekti */
  pulse(): void {
    this.scene.tweens.add({
      targets: [this.resourceText, this.resourceIcon],
      scaleX: 1.18, scaleY: 1.18,
      duration: 70, yoyo: true,
      ease: 'Quad.easeOut',
    });
  }
}
