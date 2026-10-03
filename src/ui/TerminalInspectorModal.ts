/* ======================================================================
 * src/ui/TerminalInspectorModal.ts — Hammadde Giriş & Sevkiyat Taşıma Modalı
 *
 * Fabrikadaki hammadde giriş silosu (INTAKE) ve sevkiyat sandığı (EXPORT)
 * düğümlerinin konumunu, durumunu görüntüleyen ve oyuncunun "TAŞI" seçeneğiyle
 * bu terminalleri boş bir hücreye taşımasını başlatan piksel art modalı.
 *
 * docs/ART_DIRECTION.md ve src/ui/theme.ts standartlarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { GridCoord } from '../factory/types.ts';
import { PALETTE, FONT_FAMILY, PixelUIHelper } from './theme.ts';

export type TerminalType = 'INTAKE' | 'EXPORT' | 'CHOICE';

export interface TerminalInspectorModalConfig {
  onRelocate: (type: 'INTAKE' | 'EXPORT', sourceCoord?: GridCoord) => void;
  onClose?: () => void;
}

export class TerminalInspectorModal {
  readonly scene: Phaser.Scene;
  readonly onRelocate: (type: 'INTAKE' | 'EXPORT', sourceCoord?: GridCoord) => void;
  readonly onClose?: () => void;

  public container: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private panelBlocker: Phaser.GameObjects.Rectangle;
  private modalBg: Phaser.GameObjects.NineSlice;

  private titleText: Phaser.GameObjects.Text;
  private closeBtnBg: Phaser.GameObjects.NineSlice;
  private closeBtnIcon: Phaser.GameObjects.Image;
  private closeZone: Phaser.GameObjects.Zone;

  // İçerik konteyneri
  private contentContainer: Phaser.GameObjects.Container;

  private _isOpen = false;
  private modalW = 420;
  private modalH = 320;

  constructor(scene: Phaser.Scene, config: TerminalInspectorModalConfig) {
    this.scene = scene;
    this.onRelocate = config.onRelocate;
    this.onClose = config.onClose;

    this.container = scene.add.container(0, 0).setDepth(210).setVisible(false);

    // 1. Ekran Karartma Katmanı
    this.backdrop = scene.add.rectangle(0, 0, 100, 100, 0x05070e, 0.75)
      .setOrigin(0, 0)
      .setInteractive()
      .on('pointerdown', () => this.close());
    this.container.add(this.backdrop);

    // 2. Tıklama Engelleyici
    this.panelBlocker = scene.add.rectangle(0, 0, this.modalW, this.modalH, 0x000000, 0.001)
      .setOrigin(0.5, 0.5)
      .setInteractive()
      .on('pointerdown', (_p: any, _x: number, _y: number, e?: Phaser.Types.Input.EventData) => {
        e?.stopPropagation();
      });
    this.container.add(this.panelBlocker);

    // 3. Modal 9-Slice Çerçeve
    this.modalBg = PixelUIHelper.createModal(scene, 0, 0, this.modalW, this.modalH);
    this.container.add(this.modalBg);

    const font = { fontFamily: FONT_FAMILY };

    // 4. Başlık
    this.titleText = scene.add.text(0, -this.modalH / 2 + 24, 'TERMİNAL İNCELEME & TAŞIMA', {
      ...font,
      fontSize: '13px',
      color: PALETTE.textPrimary,
      fontStyle: 'bold',
      stroke: '#080c18',
      strokeThickness: 2,
    }).setOrigin(0.5, 0.5);
    this.container.add(this.titleText);

    // 5. Kapatma Butonu [X]
    const closeX = this.modalW / 2 - 24;
    const closeY = -this.modalH / 2 + 24;
    this.closeBtnBg = PixelUIHelper.createButton(scene, closeX, closeY, 26, 26, 'danger');
    this.container.add(this.closeBtnBg);

    this.closeBtnIcon = scene.add.image(closeX, closeY, 'icon_close').setOrigin(0.5).setScale(0.9);
    this.container.add(this.closeBtnIcon);

    this.closeZone = scene.add.zone(closeX, closeY, 30, 30)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.close())
      .on('pointerover', () => this.closeBtnBg.setTexture('btn_danger_pressed'))
      .on('pointerout', () => this.closeBtnBg.setTexture('btn_danger_normal'));
    this.container.add(this.closeZone);

    // 6. Dinamik İçerik Konteyneri
    this.contentContainer = scene.add.container(0, 0);
    this.container.add(this.contentContainer);
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  /**
   * Modalı belirli bir terminal tipi veya seçim için açar
   */
  open(type: TerminalType, coord?: GridCoord): void {
    this._isOpen = true;
    this.container.setVisible(true);
    this.renderContent(type, coord);
    this.layout(this.scene.scale.width, this.scene.scale.height);
  }

  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.container.setVisible(false);
    if (this.onClose) this.onClose();
  }

  ignoreCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    camera.ignore([this.container]);
  }

  layout(w: number, h: number): void {
    this.backdrop.setPosition(0, 0).setSize(w, h);
    this.container.setPosition(w / 2, h / 2);
  }

  private renderContent(type: TerminalType, coord?: GridCoord): void {
    this.contentContainer.removeAll(true);
    const font = { fontFamily: FONT_FAMILY };

    if (type === 'CHOICE') {
      this.titleText.setText('TERMİNAL TAŞIMA SEÇENEĞİ');

      const descText = this.scene.add.text(0, -70, 'Taşımak istediğiniz istasyonu seçin:\n(Taşıma işlemi tamamen ücretsizdir)', {
        ...font,
        fontSize: '9.5px',
        color: PALETTE.textMuted,
        align: 'center',
        lineSpacing: 4,
      }).setOrigin(0.5);
      this.contentContainer.add(descText);

      // 1. Hammadde Giriş Butonu
      const btn1Y = -10;
      const btn1Bg = PixelUIHelper.createButton(this.scene, 0, btn1Y, 280, 42, 'launch');
      this.contentContainer.add(btn1Bg);

      const btn1Text = this.scene.add.text(0, btn1Y - 6, '📦 HAMMADDE GİRİŞİNİ TAŞI', {
        ...font,
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const btn1Sub = this.scene.add.text(0, btn1Y + 9, 'Giriş Silosu (Demir Cevheri Tedariği)', {
        ...font,
        fontSize: '8px',
        color: '#dcfce7',
      }).setOrigin(0.5);
      this.contentContainer.add([btn1Text, btn1Sub]);

      const zone1 = this.scene.add.zone(0, btn1Y, 280, 42)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.close();
          this.onRelocate('INTAKE');
        })
        .on('pointerover', () => btn1Bg.setTexture('btn_launch_pressed'))
        .on('pointerout', () => btn1Bg.setTexture('btn_launch_normal'));
      this.contentContainer.add(zone1);

      // 2. Sevkiyat Sandığı Butonu
      const btn2Y = 48;
      const btn2Bg = PixelUIHelper.createButton(this.scene, 0, btn2Y, 280, 42, 'green');
      this.contentContainer.add(btn2Bg);

      const btn2Text = this.scene.add.text(0, btn2Y - 6, '🚚 SEVKİYAT SANDIĞINI TAŞI', {
        ...font,
        fontSize: '11px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      const btn2Sub = this.scene.add.text(0, btn2Y + 9, 'Çıkış Terminali (Satış ve Gelir Noktası)', {
        ...font,
        fontSize: '8px',
        color: '#fef08a',
      }).setOrigin(0.5);
      this.contentContainer.add([btn2Text, btn2Sub]);

      const zone2 = this.scene.add.zone(0, btn2Y, 280, 42)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          this.close();
          this.onRelocate('EXPORT');
        })
        .on('pointerover', () => btn2Bg.setTexture('btn_green_pressed'))
        .on('pointerout', () => btn2Bg.setTexture('btn_green_normal'));
      this.contentContainer.add(zone2);

      // Kapat Butonu
      const cancelY = 106;
      const cancelBg = PixelUIHelper.createButton(this.scene, 0, cancelY, 140, 26, 'danger');
      this.contentContainer.add(cancelBg);

      const cancelText = this.scene.add.text(0, cancelY, 'İPTAL', {
        ...font,
        fontSize: '10px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.contentContainer.add(cancelText);

      const cancelZone = this.scene.add.zone(0, cancelY, 140, 26)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.close())
        .on('pointerover', () => cancelBg.setTexture('btn_danger_pressed'))
        .on('pointerout', () => cancelBg.setTexture('btn_danger_normal'));
      this.contentContainer.add(cancelZone);

      return;
    }

    // Belirli bir terminal (INTAKE veya EXPORT)
    const isIntake = type === 'INTAKE';
    this.titleText.setText(isIntake ? 'HAMMADDE GİRİŞ SİLOSU' : 'SEVKİYAT SANDIĞI');

    // Sol Taraf: Görsel Önizleme Kutusu
    const boxX = -130;
    const boxY = -15;
    const boxBg = PixelUIHelper.createCard(this.scene, boxX - 44, boxY - 44, 88, 88);
    this.contentContainer.add(boxBg);

    const textureKey = isIntake ? 'factory_intake' : 'shipping_crate';
    if (this.scene.textures.exists(textureKey)) {
      const sprite = this.scene.add.image(boxX, boxY - 4, textureKey).setDisplaySize(48, 48);
      this.contentContainer.add(sprite);
    } else {
      const fallback = this.scene.add.rectangle(
        boxX, boxY - 4, 48, 48,
        isIntake ? PALETTE.factoryAmber : PALETTE.resourceGold
      );
      this.contentContainer.add(fallback);
    }

    const typeBadge = this.scene.add.text(boxX, boxY + 28, isIntake ? 'GİRİŞ (IN)' : 'ÇIKIŞ (OUT)', {
      ...font,
      fontSize: '8px',
      color: isIntake ? PALETTE.factoryAmberHex : PALETTE.resourceGoldHex,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.contentContainer.add(typeBadge);

    // Sağ Taraf: Bilgiler
    const infoX = -60;
    const infoY = -65;

    const locStr = coord ? `(${coord.x}, ${coord.y})` : 'Mevcut Konum';
    const locText = this.scene.add.text(infoX, infoY, `Konum: ${locStr}`, {
      ...font,
      fontSize: '10px',
      color: PALETTE.textPrimary,
      fontStyle: 'bold',
    });
    this.contentContainer.add(locText);

    const statusText = this.scene.add.text(infoX, infoY + 18, 'Durum: AKTİF ÇALIŞIYOR', {
      ...font,
      fontSize: '9px',
      color: PALETTE.successGreenHex,
      fontStyle: 'bold',
    });
    this.contentContainer.add(statusText);

    const descMsg = isIntake
      ? 'Fabrikaya düzenli ham cevher akışı sağlar. Yanına konveyör bağlayarak cevherleri kırıcılara sevk edebilirsiniz.'
      : 'Bantlarla taşınan tüm mamul ürünleri otomatik olarak nakde ($) dönüştürür ve kasanıza aktarır.';

    const descText = this.scene.add.text(infoX, infoY + 36, descMsg, {
      ...font,
      fontSize: '8.5px',
      color: PALETTE.textMuted,
      wordWrap: { width: 220 },
      lineSpacing: 2,
    });
    this.contentContainer.add(descText);

    const costBadge = this.scene.add.text(infoX, infoY + 85, 'Taşıma Maliyeti: ÜCRETSİZ ($0)', {
      ...font,
      fontSize: '8.5px',
      color: PALETTE.successGreenHex,
      fontStyle: 'bold',
    });
    this.contentContainer.add(costBadge);

    // Alt Butonlar: [ 🚀 BU TERMİNALİ TAŞI ] ve [ KAPAT ]
    const btnMoveY = 82;
    const btnMoveBg = PixelUIHelper.createButton(this.scene, 0, btnMoveY, 240, 36, 'launch');
    this.contentContainer.add(btnMoveBg);

    const btnMoveText = this.scene.add.text(0, btnMoveY - 1, '🚀 BU TERMİNALİ TAŞI', {
      ...font,
      fontSize: '11px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.contentContainer.add(btnMoveText);

    const zoneMove = this.scene.add.zone(0, btnMoveY, 240, 36)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.close();
        this.onRelocate(isIntake ? 'INTAKE' : 'EXPORT', coord);
      })
      .on('pointerover', () => btnMoveBg.setTexture('btn_launch_pressed'))
      .on('pointerout', () => btnMoveBg.setTexture('btn_launch_normal'));
    this.contentContainer.add(zoneMove);

    const btnCloseY = 124;
    const btnCloseBg = PixelUIHelper.createButton(this.scene, 0, btnCloseY, 120, 24, 'danger');
    this.contentContainer.add(btnCloseBg);

    const btnCloseText = this.scene.add.text(0, btnCloseY - 1, 'KAPAT', {
      ...font,
      fontSize: '9.5px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.contentContainer.add(btnCloseText);

    const zoneClose = this.scene.add.zone(0, btnCloseY, 120, 24)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.close())
      .on('pointerover', () => btnCloseBg.setTexture('btn_danger_pressed'))
      .on('pointerout', () => btnCloseBg.setTexture('btn_danger_normal'));
    this.contentContainer.add(zoneClose);
  }
}
