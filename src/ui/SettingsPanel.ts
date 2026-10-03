/* ======================================================================
 * SettingsPanel.ts — Ayarlar paneli (ses kontrolü ve kayıt sıfırlama onayı ile)
 * Tamamen gerçek piksel-art raster dokuları ile oluşturuldu (docs/ART_DIRECTION.md)
 * ====================================================================== */

import Phaser from 'phaser';
import { PALETTE, FONT_FAMILY, PixelUIHelper } from './theme.ts';
import { sound } from '../audio/SoundManager.ts';

export class SettingsPanel {
  private scene: Phaser.Scene;
  public container!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Rectangle;
  private panelBlocker!: Phaser.GameObjects.Rectangle;
  private panelSlice!: Phaser.GameObjects.NineSlice;
  private titleText!: Phaser.GameObjects.Text;

  // Ses Butonu
  private soundBtnBg!: Phaser.GameObjects.NineSlice;
  private soundBtnText!: Phaser.GameObjects.Text;
  private soundBtnZone!: Phaser.GameObjects.Zone;

  // Sıfırlama Butonu
  private resetBtnBg!: Phaser.GameObjects.NineSlice;
  private resetBtnText!: Phaser.GameObjects.Text;
  private resetZone!: Phaser.GameObjects.Zone;
  private closeIcon!: Phaser.GameObjects.Image;
  private closeZone!: Phaser.GameObjects.Zone;

  private confirmGroup!: Phaser.GameObjects.Container;
  private confirmBgSlice!: Phaser.GameObjects.NineSlice;
  private yesBtnBg!: Phaser.GameObjects.NineSlice;
  private noBtnBg!: Phaser.GameObjects.NineSlice;

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
      fontFamily: FONT_FAMILY,
    };

    this.container = s.add.container(0, 0).setDepth(200).setVisible(false);

    // Yarı saydam koyu arka plan (Yalnızca dışarı tıklanınca kapatır)
    this.overlay = s.add.rectangle(0, 0, 4000, 4000, 0x070913, 0.75)
      .setOrigin(0.5, 0.5)
      .setInteractive()
      .on('pointerdown', () => this.hide());
    this.container.add(this.overlay);

    // Modal Gövdesi Tıklama Engelleyici (Pencere içine tıklanınca kapanmasını önler)
    this.panelBlocker = s.add.rectangle(0, 0, 280, 270, 0x000000, 0.001)
      .setOrigin(0.5, 0.5)
      .setInteractive()
      .on('pointerdown', (_pointer: any, _lx: number, _ly: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation();
      });
    this.container.add(this.panelBlocker);

    // Modal Arka Planı (Raster 9-Slice)
    this.panelSlice = PixelUIHelper.createModal(s, 0, 0, 280, 270);
    this.container.add(this.panelSlice);

    // Başlık
    this.titleText = s.add.text(0, -95, '⚙ AYARLAR', {
      ...font, fontSize: '15px', color: PALETTE.resourceGoldHex, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.titleText);

    // Kapat butonu (Piksel Kırmızı Çarpı İkonu)
    this.closeIcon = s.add.image(115, -95, 'icon_close').setOrigin(0.5).setScale(1.2);
    this.closeZone = s.add.zone(115, -95, 28, 28)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        sound.playClick();
        this.hide();
      })
      .on('pointerover', () => this.closeIcon.setScale(1.35))
      .on('pointerout', () => this.closeIcon.setScale(1.2));
    this.container.add([this.closeIcon, this.closeZone]);

    // 1. Ses Efektleri Aç / Kapat Butonu (Raster Cyan Launch Butonu)
    const soundLabel = sound.isMuted() ? '🔇 Ses: KAPALI' : '🔊 Ses: AÇIK';
    this.soundBtnBg = PixelUIHelper.createButton(s, 0, -40, 200, 36, 'launch');
    this.container.add(this.soundBtnBg);

    this.soundBtnText = s.add.text(0, -40, soundLabel, {
      ...font, fontSize: '11px', color: PALETTE.textDark, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.soundBtnText);

    this.soundBtnZone = s.add.zone(0, -40, 200, 36)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        const muted = sound.toggleMute();
        this.soundBtnText.setText(muted ? '🔇 Ses: KAPALI' : '🔊 Ses: AÇIK');
        if (!muted) {
          sound.playClick();
        }
      })
      .on('pointerover', () => this.soundBtnBg.setScale(1.02))
      .on('pointerout', () => this.soundBtnBg.setScale(1.0));
    this.container.add(this.soundBtnZone);

    // 2. Kayıt sıfırla butonu (Raster Tehlike Butonu)
    this.resetBtnBg = PixelUIHelper.createButton(s, 0, 10, 200, 36, 'danger');
    this.container.add(this.resetBtnBg);

    this.resetBtnText = s.add.text(0, 10, '🗑 Kaydı Sıfırla', {
      ...font, fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.resetBtnText);

    this.resetZone = s.add.zone(0, 10, 200, 36)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        sound.playClick();
        this.resetBtnBg.setTexture('btn_danger_pressed');
        this.showConfirm();
      })
      .on('pointerup', () => {
        this.resetBtnBg.setTexture('btn_danger_normal');
      })
      .on('pointerover', () => {
        this.resetBtnBg.setScale(1.02);
      })
      .on('pointerout', () => {
        this.resetBtnBg.setScale(1.0);
        this.resetBtnBg.setTexture('btn_danger_normal');
      });
    this.container.add(this.resetZone);

    // Onay Grubu (Kayıt Sıfırlama)
    this.confirmGroup = s.add.container(0, 65).setVisible(false);

    this.confirmBgSlice = PixelUIHelper.createCard(s, 0, 0, 240, 95).setOrigin(0.5, 0.5);
    this.confirmGroup.add(this.confirmBgSlice);

    const confirmText = s.add.text(0, -20, 'Emin misin? Tüm fabrika ve roket verisi silinecek!', {
      ...font, fontSize: '10px', color: PALETTE.textPrimary, align: 'center',
      wordWrap: { width: 220 },
    }).setOrigin(0.5);
    this.confirmGroup.add(confirmText);

    // Evet Butonu (Raster Yeşil Buton)
    this.yesBtnBg = PixelUIHelper.createButton(s, -55, 18, 80, 28, 'green');
    const yesBtn = s.add.text(-55, 18, '✓ Evet', {
      ...font, fontSize: '10px', color: PALETTE.btnAffordableText, fontStyle: 'bold',
    }).setOrigin(0.5);
    const yesZone = s.add.zone(-55, 18, 80, 28)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        sound.playDemolish();
        this.yesBtnBg.setTexture('btn_green_pressed');
        this.onReset();
        this.hide();
      });
    this.confirmGroup.add([this.yesBtnBg, yesBtn, yesZone]);

    // Hayır Butonu (Raster Koyu Buton)
    this.noBtnBg = PixelUIHelper.createButton(s, 55, 18, 80, 28, 'disabled');
    const noBtn = s.add.text(55, 18, '✗ İptal', {
      ...font, fontSize: '10px', color: PALETTE.textPrimary, fontStyle: 'bold',
    }).setOrigin(0.5);
    const noZone = s.add.zone(55, 18, 80, 28)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        sound.playClick();
        this.confirmGroup.setVisible(false);
      });
    this.confirmGroup.add([this.noBtnBg, noBtn, noZone]);

    this.container.add(this.confirmGroup);
  }

  show(): void {
    sound.initContext();
    sound.playClick();
    this._visible = true;
    this.soundBtnText.setText(sound.isMuted() ? '🔇 Ses: KAPALI' : '🔊 Ses: AÇIK');
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
    this.container.setPosition(w / 2, h / 2);
    const sf = Phaser.Math.Clamp(Math.min(w, h) / 480, 0.7, 1.2);

    const modalW = Math.min(320 * sf, w - 30);
    const modalH = Math.min(270 * sf, h - 40);

    this.overlay.setSize(w * 2, h * 2);
    this.panelBlocker.setSize(modalW, modalH);
    this.panelSlice.setSize(modalW, modalH);

    this.titleText.setPosition(0, -modalH / 2 + 25 * sf);
    this.closeIcon.setPosition(modalW / 2 - 22 * sf, -modalH / 2 + 25 * sf);
    this.closeZone.setPosition(modalW / 2 - 22 * sf, -modalH / 2 + 25 * sf);

    this.soundBtnBg.setPosition(0, -modalH * 0.16);
    this.soundBtnText.setPosition(0, -modalH * 0.16);
    this.soundBtnZone.setPosition(0, -modalH * 0.16);

    this.resetBtnBg.setPosition(0, modalH * 0.04);
    this.resetBtnText.setPosition(0, modalH * 0.04);
    this.resetZone.setPosition(0, modalH * 0.04);

    this.confirmGroup.setPosition(0, modalH * 0.22);
    this.confirmBgSlice.setSize(modalW - 30, Math.round(95 * sf));
  }
}
