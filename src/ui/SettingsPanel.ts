/* ======================================================================
 * SettingsPanel.ts — Ayarlar paneli (kayıt sıfırlama onayı ile)
 * ====================================================================== */

import Phaser from 'phaser';

export class SettingsPanel {
  private scene: Phaser.Scene;
  private container!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Graphics;
  private panel!: Phaser.GameObjects.Graphics;
  private titleText!: Phaser.GameObjects.Text;
  private resetBtn!: Phaser.GameObjects.Text;
  private closeBtn!: Phaser.GameObjects.Text;
  private confirmGroup!: Phaser.GameObjects.Container;

  private _visible = false;
  private onReset: () => void;

  constructor(scene: Phaser.Scene, onReset: () => void) {
    this.scene = scene;
    this.onReset = onReset;
    this.create();
  }

  get visible(): boolean { return this._visible; }

  private create(): void {
    const s = this.scene;
    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Arial, Helvetica, sans-serif',
    };

    this.container = s.add.container(0, 0).setDepth(200).setVisible(false);

    // Yarı saydam arka plan
    this.overlay = s.add.graphics();
    this.overlay.setInteractive(
      new Phaser.Geom.Rectangle(0, 0, 2000, 2000),
      Phaser.Geom.Rectangle.Contains,
    );
    this.overlay.on('pointerdown', () => this.hide());
    this.container.add(this.overlay);

    // Panel arka planı
    this.panel = s.add.graphics();
    this.container.add(this.panel);

    // Başlık
    this.titleText = s.add.text(0, 0, 'Ayarlar', {
      ...font, fontSize: '22px', color: '#d4d4e0', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    // Kapat butonu
    this.closeBtn = s.add.text(0, 0, '✕', {
      ...font, fontSize: '20px', color: '#8888a0',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hide())
      .on('pointerover', () => this.closeBtn.setColor('#ffffff'))
      .on('pointerout', () => this.closeBtn.setColor('#8888a0'));
    this.container.add(this.closeBtn);

    // Kayıt sıfırla butonu
    this.resetBtn = s.add.text(0, 0, '🗑  Kaydı Sıfırla', {
      ...font, fontSize: '16px', color: '#e76f51',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.showConfirm())
      .on('pointerover', () => this.resetBtn.setAlpha(0.7))
      .on('pointerout', () => this.resetBtn.setAlpha(1));
    this.container.add(this.resetBtn);

    // Onay grubu
    this.confirmGroup = s.add.container(0, 0).setVisible(false);

    const confirmText = s.add.text(0, -20, 'Emin misin? Tüm ilerleme silinecek.', {
      ...font, fontSize: '13px', color: '#e8e8e8', align: 'center',
      wordWrap: { width: 240 },
    }).setOrigin(0.5);
    this.confirmGroup.add(confirmText);

    const yesBtn = s.add.text(-50, 15, '✓ Evet', {
      ...font, fontSize: '15px', color: '#2ecc71', fontStyle: 'bold',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.onReset();
        this.hide();
      });
    this.confirmGroup.add(yesBtn);

    const noBtn = s.add.text(50, 15, '✗ Hayır', {
      ...font, fontSize: '15px', color: '#e76f51', fontStyle: 'bold',
    }).setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.confirmGroup.setVisible(false));
    this.confirmGroup.add(noBtn);

    this.container.add(this.confirmGroup);
  }

  show(): void {
    this._visible = true;
    this.confirmGroup.setVisible(false);
    this.container.setVisible(true);
    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  hide(): void {
    this._visible = false;
    this.container.setVisible(false);
  }

  private showConfirm(): void {
    this.confirmGroup.setVisible(true);
  }

  layout(w: number, h: number): void {
    if (!this._visible) return;

    const cx = w / 2;
    const cy = h / 2;
    const pw = Math.min(300, w * 0.85);
    const ph = 200;

    this.overlay.clear();
    this.overlay.fillStyle(0x000000, 0.6);
    this.overlay.fillRect(0, 0, w, h);

    this.panel.clear();
    this.panel.fillStyle(0x1a1a2e, 1);
    this.panel.fillRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 12);
    this.panel.lineStyle(1, 0x3a3a5a, 0.8);
    this.panel.strokeRoundedRect(cx - pw / 2, cy - ph / 2, pw, ph, 12);

    this.titleText.setPosition(cx, cy - ph / 2 + 30);
    this.closeBtn.setPosition(cx + pw / 2 - 20, cy - ph / 2 + 20);
    this.resetBtn.setPosition(cx, cy + 5);
    this.confirmGroup.setPosition(cx, cy + 50);
  }
}
