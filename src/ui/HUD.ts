/* ======================================================================
 * HUD.ts — Üst bilgi çubuğu (kaynak, üretim hızı, ayarlar butonu)
 * Tamamen gerçek piksel-art raster dokuları ile oluşturuldu (docs/ART_DIRECTION.md)
 * ====================================================================== */

import Phaser from 'phaser';
import type { DecimalSource } from 'break_eternity.js';
import { D } from '../utils/decimal';
import { formatNumber, formatRate } from '../utils/format';
import { RESOURCE_NAME } from '../data/MachineData';
import { PALETTE, FONT_FAMILY, PixelUIHelper } from './theme';

export class HUD {
  private scene: Phaser.Scene;

  private bg!: Phaser.GameObjects.NineSlice;
  private resourcePillBg!: Phaser.GameObjects.NineSlice;
  private ratePillBg!: Phaser.GameObjects.NineSlice;
  private flightPillBg!: Phaser.GameObjects.NineSlice;
  private coinSprite: Phaser.GameObjects.Sprite | null = null;
  private resourceText!: Phaser.GameObjects.Text;
  private gearIcon!: Phaser.GameObjects.Image;
  private rateText!: Phaser.GameObjects.Text;
  private trophyIcon!: Phaser.GameObjects.Image;
  private flightBadgeText!: Phaser.GameObjects.Text;
  private settingsBtnBg!: Phaser.GameObjects.NineSlice;
  private settingsBtnIcon!: Phaser.GameObjects.Image;
  private settingsZone!: Phaser.GameObjects.Zone;

  private onSettingsClick: () => void;

  constructor(scene: Phaser.Scene, onSettingsClick: () => void) {
    this.scene = scene;
    this.onSettingsClick = onSettingsClick;
    this.create();
  }

  private create(): void {
    const s = this.scene;
    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    // 1. Üst Panel Arka Planı (9-Slice Raster)
    this.bg = PixelUIHelper.createPanel(s, 0, 0, 100, 48).setDepth(100);

    // 2. Telemetri Kapsül Arka Planları (Beveled 9-Slice Bezels)
    this.resourcePillBg = PixelUIHelper.createCard(s, 0, 0, 100, 32).setDepth(101).setOrigin(0, 0.5);
    this.ratePillBg = PixelUIHelper.createCard(s, 0, 0, 100, 28).setDepth(101).setOrigin(0, 0.5);
    this.flightPillBg = PixelUIHelper.createCard(s, 0, 0, 100, 28).setDepth(101).setOrigin(1, 0.5);

    // 3. Dönen Altın Sikke Sprite'ı (Piksel Asset)
    if (s.textures.exists('coin_gold')) {
      this.coinSprite = s.add.sprite(0, 0, 'coin_gold', 0)
        .setOrigin(0.5)
        .setScale(2)
        .setDepth(103);

      if (s.anims.exists('coin_gold_spin')) {
        this.coinSprite.play('coin_gold_spin');
      }
    } else {
      this.coinSprite = s.add.sprite(0, 0, 'icon_coin')
        .setOrigin(0.5)
        .setScale(1.5)
        .setDepth(103);
    }

    // 4. Kaynak Sayısı Metni (Piksel Konturlu Yüksek Kontrast)
    this.resourceText = s.add.text(0, 0, '0', {
      ...font,
      fontSize: '20px',
      color: PALETTE.resourceGoldHex,
      fontStyle: 'bold',
      stroke: '#05070e',
      strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(103);

    // 5. Üretim Hızı İkonu ve Metni
    this.gearIcon = s.add.image(0, 0, 'icon_gear').setOrigin(0.5).setScale(1.2).setDepth(103);
    this.rateText = s.add.text(0, 0, '', {
      ...font,
      fontSize: '11.5px',
      color: '#2ecc71',
      fontStyle: 'bold',
      stroke: '#05070e',
      strokeThickness: 2,
    }).setOrigin(0, 0.5).setDepth(103);

    // 6. Uçuş Rekor İkonu ve Rozeti (Sağa dayalı)
    this.trophyIcon = s.add.image(0, 0, 'icon_trophy').setOrigin(0.5).setScale(1.1).setDepth(103);
    this.flightBadgeText = s.add.text(0, 0, 'Rekor: 0m', {
      ...font,
      fontSize: '12px',
      color: PALETTE.rocketCyanHex,
      fontStyle: 'bold',
      stroke: '#05070e',
      strokeThickness: 2,
    }).setOrigin(1, 0.5).setDepth(103);

    // 7. Ayarlar Butonu (Piksel 9-Slice Buton + icon_settings)
    this.settingsBtnBg = PixelUIHelper.createButton(s, 0, 0, 32, 32, 'disabled').setDepth(102);
    this.settingsBtnIcon = s.add.image(0, 0, 'icon_settings').setOrigin(0.5).setScale(1.3).setDepth(103);

    this.settingsZone = s.add.zone(0, 0, 34, 34)
      .setOrigin(0.5)
      .setDepth(104)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onSettingsClick())
      .on('pointerover', () => {
        this.settingsBtnBg.setTexture('btn_green_hover');
      })
      .on('pointerout', () => {
        this.settingsBtnBg.setTexture('btn_disabled');
      });
  }

  update(resources: DecimalSource, perSecond: DecimalSource, bestDistance = 0): void {
    const resDec = D(resources);
    const ppsDec = D(perSecond);

    this.resourceText.setText(formatNumber(resDec));
    if (ppsDec.gt(0)) {
      this.rateText.setText(`+${formatRate(ppsDec)} ${RESOURCE_NAME}/sn`);
    } else {
      this.rateText.setText('0 /sn (Tıkla!)');
    }
    this.flightBadgeText.setText(`Rekor: ${bestDistance}m`);

    // Metin uzunlukları değiştiğinde aralıkları anında dinamik olarak yeniden ayarla
    this.repositionTextElements();
  }

  private baseCoinScale = 1.6;
  private cachedW = 800;
  private cachedSf = 1.0;

  layout(w: number, _h: number, sf: number): void {
    this.cachedW = w;
    this.cachedSf = sf;

    const barH = Math.round(48 * sf);
    const pad = Math.round(14 * sf);

    // 1. Üst Panel 9-Slice
    this.bg.setPosition(0, 0);
    this.bg.setSize(w, barH);

    // 2. Dönen Altın Sikke Boyutu
    const coinX = pad + Math.round(16 * sf);
    const coinY = barH / 2;

    this.baseCoinScale = Math.max(1.3, sf * 1.6);
    if (this.coinSprite) {
      this.scene.tweens.killTweensOf(this.coinSprite);
      this.coinSprite.setPosition(coinX, coinY);
      this.coinSprite.setScale(this.baseCoinScale);
    }

    this.resourceText.setFontSize(`${Math.max(14, Math.round(20 * sf))}px`);
    this.rateText.setFontSize(`${Math.max(9, Math.round(11 * sf))}px`);
    this.flightBadgeText.setFontSize(`${Math.max(9, Math.round(11 * sf))}px`);

    this.gearIcon.setScale(Math.max(0.8, sf * 1.0));
    this.trophyIcon.setScale(Math.max(0.8, sf * 1.0));

    // 4. Ayarlar Butonu (Sağ Kenar)
    const btnSize = Math.round(32 * sf);
    const btnX = w - pad - btnSize / 2;
    const btnY = barH / 2;

    this.settingsBtnBg.setPosition(btnX, btnY);
    this.settingsBtnBg.setSize(btnSize, btnSize);
    this.settingsBtnIcon.setPosition(btnX, btnY);
    this.settingsBtnIcon.setScale(Math.max(0.9, sf * 1.2));
    this.settingsZone.setPosition(btnX, btnY);
    this.settingsZone.setSize(btnSize + 4, btnSize + 4);

    // Dinamik metin konumlandırma
    this.repositionTextElements();
  }

  private repositionTextElements(): void {
    const sf = this.cachedSf;
    const w = this.cachedW;
    const barH = Math.round(48 * sf);
    const pad = Math.round(14 * sf);
    const coinY = barH / 2;

    // 1. Altın sikke ve para kapsülü
    const pillPad = Math.round(6 * sf);
    const resW = this.resourceText.width;
    const resPillW = Math.round(resW + 42 * sf);
    const resPillH = Math.round(32 * sf);

    this.resourcePillBg.setPosition(pad, coinY);
    this.resourcePillBg.setSize(resPillW, resPillH);

    const coinX = pad + Math.round(16 * sf);
    if (this.coinSprite) {
      this.coinSprite.setPosition(coinX, coinY);
    }
    const resX = coinX + Math.round(16 * sf);
    this.resourceText.setPosition(resX, coinY);

    // 2. Üretim hızı kapsülü (Telemetri Rozeti)
    const rateW = this.rateText.width;
    const ratePillX = pad + resPillW + Math.round(10 * sf);
    const ratePillW = Math.round(rateW + 32 * sf);
    const ratePillH = Math.round(28 * sf);

    this.ratePillBg.setPosition(ratePillX, coinY);
    this.ratePillBg.setSize(ratePillW, ratePillH);

    const gearX = ratePillX + Math.round(14 * sf);
    this.gearIcon.setPosition(gearX, coinY);
    this.rateText.setPosition(gearX + Math.round(12 * sf), coinY);

    // 3. Ayarlar butonu konumu
    const btnSize = Math.round(32 * sf);
    const btnX = w - pad - btnSize / 2;

    // 4. Uçuş Rekor Rozeti Kapsülü — Sağa dayalı
    const badgeW = this.flightBadgeText.width;
    const flightMargin = Math.round(16 * sf);
    const flightRight = btnX - btnSize / 2 - flightMargin;
    const flightPillW = Math.round(badgeW + 34 * sf);
    const flightPillH = Math.round(28 * sf);

    this.flightPillBg.setPosition(flightRight, coinY);
    this.flightPillBg.setSize(flightPillW, flightPillH);

    this.flightBadgeText.setPosition(flightRight - Math.round(8 * sf), coinY);
    this.trophyIcon.setPosition(flightRight - badgeW - Math.round(18 * sf), coinY);
  }

  pulse(): void {
    if (this.coinSprite) {
      // Önce eski tweenleri durdur ve scale'i kesin olarak sıfırla
      this.scene.tweens.killTweensOf(this.coinSprite);
      this.coinSprite.setScale(this.baseCoinScale);
      this.coinSprite.setAlpha(1);
      const targetScale = this.baseCoinScale * 1.18;
      this.scene.tweens.add({
        targets: this.coinSprite,
        scaleX: targetScale,
        scaleY: targetScale,
        duration: 65,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => {
          if (this.coinSprite) {
            this.coinSprite.setScale(this.baseCoinScale);
          }
        },
      });
    }

    this.scene.tweens.killTweensOf(this.resourceText);
    this.resourceText.setScale(1);
    this.scene.tweens.add({
      targets: this.resourceText,
      scaleX: 1.08,
      scaleY: 1.08,
      duration: 65,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        this.resourceText.setScale(1);
      },
    });
  }

  getResourceTargetPos(): { x: number; y: number } {
    if (this.coinSprite) {
      return { x: this.coinSprite.x, y: this.coinSprite.y };
    }
    return { x: 30, y: 24 };
  }

  ignoreCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    const list: (Phaser.GameObjects.GameObject | null)[] = [
      this.bg,
      this.resourcePillBg,
      this.ratePillBg,
      this.flightPillBg,
      this.coinSprite,
      this.resourceText,
      this.gearIcon,
      this.rateText,
      this.trophyIcon,
      this.flightBadgeText,
      this.settingsBtnBg,
      this.settingsBtnIcon,
      this.settingsZone,
    ];
    camera.ignore(list.filter((x): x is Phaser.GameObjects.GameObject => x !== null));
  }
}