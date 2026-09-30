/* ======================================================================
 * MachineCard.ts — Tek bir makine için görsel kart bileşeni (Decimal destekli)
 * Tamamen gerçek piksel-art raster dokuları ile oluşturuldu (docs/ART_DIRECTION.md)
 * ====================================================================== */

import Phaser from 'phaser';
import type { MachineDefinition, LevelMilestone } from '../data/MachineData';
import { formatNumber } from '../utils/format';
import { RESOURCE_NAME } from '../data/MachineData';
import type { Decimal } from '../utils/decimal';
import { PALETTE, FONT_FAMILY, PixelUIHelper } from './theme';

export interface MachineCardData {
  definition: MachineDefinition;
  level: number;
  cost: Decimal;
  productionPerSec: Decimal;
  currentResources: Decimal;
  canAfford: boolean;
  unlocked: boolean;
  milestoneMul: number;
  nextMilestone: LevelMilestone | null;
}

export class MachineCard {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;

  /* Raster Dokular ve UI */
  private bg!: Phaser.GameObjects.NineSlice;
  private machineIconSprite!: Phaser.GameObjects.Sprite;
  private nameText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private prodText!: Phaser.GameObjects.Text;
  private milestoneBadgeText!: Phaser.GameObjects.Text;
  private btnBg!: Phaser.GameObjects.NineSlice;
  private btnLabel!: Phaser.GameObjects.Text;
  private btnZone!: Phaser.GameObjects.Zone;

  /* Kilitli durumu */
  private lockOverlay!: Phaser.GameObjects.NineSlice;
  private lockIcon!: Phaser.GameObjects.Image;
  private lockRequirement!: Phaser.GameObjects.Text;

  /* Boyutlar */
  private cardW = 0;
  private cardH = 0;
  private _btnW = 95;
  private _btnH = 26;
  private isAffordable = false;

  private onClick: () => void;

  constructor(scene: Phaser.Scene, onClick: () => void) {
    this.scene = scene;
    this.onClick = onClick;

    this.container = scene.add.container(0, 0).setDepth(50);
    this.createElements();
  }

  getContainer(): Phaser.GameObjects.Container {
    return this.container;
  }

  /* ---- Oluşturma ---- */

  private createElements(): void {
    const s = this.scene;
    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    // 1. Kart Arka Planı (Raster 9-Slice)
    this.bg = PixelUIHelper.createCard(s, 0, 0, 100, 50);
    this.container.add(this.bg);

    // 2. Makine İkonu (Gerçek Piksel Raster Sprite'ı)
    this.machineIconSprite = s.add.sprite(0, 0, 'machine_bench').setOrigin(0.5, 0.5);
    this.container.add(this.machineIconSprite);

    // 3. Başlık ve İstatistik Metinleri
    this.nameText = s.add.text(0, 0, '', {
      ...font, fontSize: '12.5px', color: PALETTE.textPrimary, fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.container.add(this.nameText);

    this.levelText = s.add.text(0, 0, '', {
      ...font, fontSize: '10.5px', color: PALETTE.textMuted,
    }).setOrigin(0, 0.5);
    this.container.add(this.levelText);

    this.prodText = s.add.text(0, 0, '', {
      ...font, fontSize: '10.5px', color: PALETTE.successGreenHex, fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.container.add(this.prodText);

    this.milestoneBadgeText = s.add.text(0, 0, '', {
      ...font, fontSize: '9px', color: PALETTE.factoryAmberHex, fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.container.add(this.milestoneBadgeText);

    // 4. Raster 9-Slice Buton
    this.btnBg = PixelUIHelper.createButton(s, 0, 0, this._btnW, this._btnH, 'green');
    this.container.add(this.btnBg);

    this.btnLabel = s.add.text(0, 0, '', {
      ...font, fontSize: '10.5px', color: PALETTE.btnAffordableText, fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.btnLabel);

    this.btnZone = s.add.zone(0, 0, 1, 1)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onClick())
      .on('pointerover', () => {
        if (this.isAffordable) {
          this.btnBg.setTexture('btn_green_hover');
        }
      })
      .on('pointerout', () => {
        if (this.isAffordable) {
          this.btnBg.setTexture('btn_green_normal');
        }
      });
    this.container.add(this.btnZone);

    // 5. Kilit Katmanı (Raster Dokular)
    this.lockOverlay = PixelUIHelper.createModal(s, 0, 0, 100, 50).setTint(0x141828);
    this.container.add(this.lockOverlay);

    this.lockIcon = s.add.image(0, 0, 'icon_close').setOrigin(0.5).setScale(1.2);
    this.container.add(this.lockIcon);

    this.lockRequirement = s.add.text(0, 0, '', {
      ...font, fontSize: '10.5px', color: PALETTE.textMuted, align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.lockRequirement);
  }

  /* ---- Güncelleme ---- */

  update(data: MachineCardData): void {
    const {
      definition: def,
      level,
      cost,
      productionPerSec,
      currentResources,
      canAfford,
      unlocked,
      milestoneMul,
      nextMilestone,
    } = data;

    this.isAffordable = canAfford;
    this.nameText.setText(def.name);

    // Makineye özel raster ikon dokusu
    const machineKeys: Record<string, string> = {
      assembler: 'machine_bench',
      press: 'machine_press',
      welder: 'machine_welder',
      automation: 'machine_automation',
    };
    const key = machineKeys[def.id] || 'machine_bench';
    this.machineIconSprite.setTexture(key);

    if (unlocked) {
      this.lockOverlay.setVisible(false);
      this.lockIcon.setVisible(false);
      this.lockRequirement.setVisible(false);

      this.machineIconSprite.setVisible(true);
      this.nameText.setVisible(true);
      this.levelText.setVisible(true);
      this.prodText.setVisible(true);
      this.milestoneBadgeText.setVisible(true);
      this.btnBg.setVisible(true);
      this.btnLabel.setVisible(true);
      this.btnZone.setVisible(true);

      if (level === 0) {
        this.levelText.setText('Kurulum Yapılmadı');
        this.prodText.setText(`+${formatNumber(def.baseProduction)} ${RESOURCE_NAME}/sn`);
        this.milestoneBadgeText.setText('');
        if (canAfford) {
          this.btnLabel.setText(`Satın Al\n⚙ ${formatNumber(cost)}`);
        } else {
          const diff = cost.sub(currentResources);
          this.btnLabel.setText(`⚙ ${formatNumber(cost)}\n(-${formatNumber(diff)})`);
        }
      } else {
        this.levelText.setText(`Sv. ${level}${milestoneMul > 1 ? ` (${milestoneMul}x)` : ''}`);
        this.prodText.setText(`+${formatNumber(productionPerSec)} ${RESOURCE_NAME}/sn`);

        if (nextMilestone) {
          const left = nextMilestone.level - level;
          this.milestoneBadgeText.setText(`Sv. ${nextMilestone.level} → ${nextMilestone.label} (${left} kaldı)`);
        } else {
          this.milestoneBadgeText.setText('Maksimum Bonus!');
        }

        if (canAfford) {
          this.btnLabel.setText(`Yükselt\n⚙ ${formatNumber(cost)}`);
        } else {
          const diff = cost.sub(currentResources);
          this.btnLabel.setText(`⚙ ${formatNumber(cost)}\n(-${formatNumber(diff)})`);
        }
      }

      // Buton Raster Dokusu Durumu (Satın Alınabilir vs Devre Dışı)
      if (canAfford) {
        this.btnBg.setTexture('btn_green_normal');
        this.btnLabel.setColor(PALETTE.btnAffordableText);
        this.btnZone.input!.enabled = true;
      } else {
        this.btnBg.setTexture('btn_disabled');
        this.btnLabel.setColor(PALETTE.btnDisabledText);
        this.btnZone.input!.enabled = false;
      }

      // Makine ikon tint'i
      if (level === 0) {
        this.machineIconSprite.setTint(0x7f8c8d);
      } else {
        this.machineIconSprite.clearTint();
      }
    } else {
      // Kilitli durum
      this.machineIconSprite.setVisible(false);
      this.nameText.setVisible(false);
      this.levelText.setVisible(false);
      this.prodText.setVisible(false);
      this.milestoneBadgeText.setVisible(false);
      this.btnBg.setVisible(false);
      this.btnLabel.setVisible(false);
      this.btnZone.setVisible(false);

      this.lockOverlay.setVisible(true);
      this.lockIcon.setVisible(true);
      this.lockRequirement.setVisible(true);
      this.lockRequirement.setText(
        `${def.name}\n${formatNumber(def.unlockAt)} ${RESOURCE_NAME} kazanılınca açılır`,
      );
    }
  }

  /* ---- Yerleşim ---- */

  layout(x: number, y: number, w: number, h: number, sf: number): void {
    this.cardW = w;
    this.cardH = h;
    this.container.setPosition(x, y);

    // Kart Arka Planı (9-Slice)
    this.bg.setPosition(0, 0);
    this.bg.setSize(w, h);

    const pad = Math.round(10 * sf);
    const iconW = Math.round(36 * sf);

    // Makine İkonu (Gerçek Piksel Raster Sprite'ı)
    this.machineIconSprite.setPosition(pad + iconW / 2, h / 2);
    this.machineIconSprite.setScale(Math.max(0.65, sf * 0.7));

    // Metin alanı
    const textX = pad + iconW + Math.round(8 * sf);
    this.nameText.setPosition(textX, h * 0.20);
    this.nameText.setFontSize(`${Math.round(12 * sf)}px`);

    this.levelText.setPosition(textX, h * 0.44);
    this.levelText.setFontSize(`${Math.round(10 * sf)}px`);

    this.prodText.setPosition(textX, h * 0.66);
    this.prodText.setFontSize(`${Math.round(10 * sf)}px`);

    this.milestoneBadgeText.setPosition(textX, h * 0.86);
    this.milestoneBadgeText.setFontSize(`${Math.round(8.5 * sf)}px`);

    // Buton (Sağ taraf)
    this._btnW = Math.round(96 * sf);
    this._btnH = Math.round(38 * sf);
    const btnCx = w - pad - this._btnW / 2;
    const btnCy = h / 2;

    this.btnBg.setPosition(btnCx, btnCy);
    this.btnBg.setSize(this._btnW, this._btnH);

    this.btnLabel.setPosition(btnCx, btnCy);
    this.btnLabel.setFontSize(`${Math.round(9.5 * sf)}px`);

    this.btnZone.setPosition(btnCx, btnCy);
    this.btnZone.setSize(this._btnW, this._btnH);

    // Kilit Katmanı
    this.lockOverlay.setPosition(w / 2, h / 2);
    this.lockOverlay.setSize(w, h);

    this.lockIcon.setPosition(w / 2, h / 2 - 12);
    this.lockRequirement.setPosition(w / 2, h / 2 + 12);
    this.lockRequirement.setFontSize(`${Math.round(10 * sf)}px`);
  }

  /** Satın alma / yükseltme animasyonu */
  playPurchaseEffect(): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.03, scaleY: 1.03,
      duration: 80, yoyo: true,
      ease: 'Back.easeOut',
    });

    const cx = this.container.x + this.cardW / 2;
    const cy = this.container.y + this.cardH / 2;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const p = this.scene.add.image(cx, cy, 'icon_coin').setScale(0.8).setDepth(60);
      this.scene.tweens.add({
        targets: p,
        x: cx + Math.cos(angle) * 35,
        y: cy + Math.sin(angle) * 35,
        alpha: 0, scale: 0.2,
        duration: 350, ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }
  }

  /** Kilit açılma anı efekti */
  playUnlockEffect(): void {
    this.scene.tweens.add({
      targets: this.lockOverlay,
      alpha: 0,
      duration: 450,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: [this.lockIcon, this.lockRequirement],
      alpha: 0, y: '-=15',
      duration: 350,
      ease: 'Quad.easeOut',
    });
  }
}
