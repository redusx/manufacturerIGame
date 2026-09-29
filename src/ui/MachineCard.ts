/* ======================================================================
 * MachineCard.ts — Tek bir makine için görsel kart bileşeni (Decimal destekli)
 *
 * İçerir: makine ikonu, ad, seviye, üretim hızı, sıradaki kilometre taşı,
 * satın alma/yükseltme butonu (fiyat ve eksik göstergeli), kilit durumu.
 * ====================================================================== */

import Phaser from 'phaser';
import type { MachineDefinition, LevelMilestone } from '../data/MachineData';
import { formatNumber } from '../utils/format';
import { RESOURCE_NAME } from '../data/MachineData';
import type { Decimal } from '../utils/decimal';

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

  /* Grafik öğeleri */
  private bg!: Phaser.GameObjects.Graphics;
  private machineVisual!: Phaser.GameObjects.Graphics;
  private iconText!: Phaser.GameObjects.Text;
  private nameText!: Phaser.GameObjects.Text;
  private levelText!: Phaser.GameObjects.Text;
  private prodText!: Phaser.GameObjects.Text;
  private milestoneBadgeText!: Phaser.GameObjects.Text;
  private btnBg!: Phaser.GameObjects.Graphics;
  private btnLabel!: Phaser.GameObjects.Text;
  private btnZone!: Phaser.GameObjects.Zone;

  /* Kilitli durumu */
  private lockOverlay!: Phaser.GameObjects.Graphics;
  private lockText!: Phaser.GameObjects.Text;
  private lockRequirement!: Phaser.GameObjects.Text;

  /* Boyutlar */
  private cardW = 0;
  private cardH = 0;
  private _btnW = 95;
  private _btnH = 26;

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
      fontFamily: 'Arial, Helvetica, sans-serif',
    };

    this.bg = s.add.graphics();
    this.container.add(this.bg);

    this.machineVisual = s.add.graphics();
    this.container.add(this.machineVisual);

    this.iconText = s.add.text(0, 0, '', { ...font, fontSize: '26px' }).setOrigin(0.5);
    this.container.add(this.iconText);

    this.nameText = s.add.text(0, 0, '', {
      ...font, fontSize: '13px', color: '#e8e8e8', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.container.add(this.nameText);

    this.levelText = s.add.text(0, 0, '', {
      ...font, fontSize: '11px', color: '#8888a0',
    }).setOrigin(0, 0.5);
    this.container.add(this.levelText);

    this.prodText = s.add.text(0, 0, '', {
      ...font, fontSize: '11px', color: '#2ecc71',
    }).setOrigin(0, 0.5);
    this.container.add(this.prodText);

    this.milestoneBadgeText = s.add.text(0, 0, '', {
      ...font, fontSize: '9px', color: '#f4a261', fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.container.add(this.milestoneBadgeText);

    this.btnBg = s.add.graphics();
    this.container.add(this.btnBg);

    this.btnLabel = s.add.text(0, 0, '', {
      ...font, fontSize: '11px', color: '#0f0e17', fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.container.add(this.btnLabel);

    this.btnZone = s.add.zone(0, 0, 1, 1)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onClick());
    this.container.add(this.btnZone);

    // Kilit katmanı
    this.lockOverlay = s.add.graphics();
    this.container.add(this.lockOverlay);

    this.lockText = s.add.text(0, 0, '🔒', { ...font, fontSize: '22px' }).setOrigin(0.5);
    this.container.add(this.lockText);

    this.lockRequirement = s.add.text(0, 0, '', {
      ...font, fontSize: '11px', color: '#7a7a90', align: 'center',
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

    this.iconText.setText(def.icon);
    this.nameText.setText(def.name);

    if (unlocked) {
      this.lockOverlay.setVisible(false);
      this.lockText.setVisible(false);
      this.lockRequirement.setVisible(false);

      this.machineVisual.setVisible(true);
      this.iconText.setVisible(true);
      this.nameText.setVisible(true);
      this.levelText.setVisible(true);
      this.prodText.setVisible(true);
      this.milestoneBadgeText.setVisible(true);
      this.btnBg.setVisible(true);
      this.btnLabel.setVisible(true);
      this.btnZone.setVisible(true);

      if (level === 0) {
        this.levelText.setText('Satın alınmadı');
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

      // Buton stili
      this.drawButton(canAfford ? 0x2ecc71 : 0x2a2a3e);
      this.btnLabel.setColor(canAfford ? '#0f0e17' : '#7a7a8e');
      this.btnZone.input!.enabled = canAfford;

      // Makine mini görseli
      this.drawMachineVisual(def, level);
    } else {
      // Kilitli durum
      this.machineVisual.setVisible(false);
      this.iconText.setVisible(false);
      this.nameText.setVisible(false);
      this.levelText.setVisible(false);
      this.prodText.setVisible(false);
      this.milestoneBadgeText.setVisible(false);
      this.btnBg.setVisible(false);
      this.btnLabel.setVisible(false);
      this.btnZone.setVisible(false);

      this.lockOverlay.setVisible(true);
      this.lockText.setVisible(true);
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

    // Kart Arka planı
    this.bg.clear();
    this.bg.fillStyle(0x151528, 0.95);
    this.bg.fillRoundedRect(0, 0, w, h, 8);
    this.bg.lineStyle(1, 0x2e3856, 0.7);
    this.bg.strokeRoundedRect(0, 0, w, h, 8);

    const pad = 10 * sf;
    const iconSize = 34 * sf;

    // İkon
    this.iconText.setPosition(pad + iconSize / 2, h / 2 - 2);
    this.iconText.setFontSize(`${Math.round(20 * sf)}px`);

    // Metin alanı
    const textX = pad + iconSize + 8 * sf;
    this.nameText.setPosition(textX, h * 0.20);
    this.nameText.setFontSize(`${Math.round(12 * sf)}px`);

    this.levelText.setPosition(textX, h * 0.44);
    this.levelText.setFontSize(`${Math.round(10 * sf)}px`);

    this.prodText.setPosition(textX, h * 0.66);
    this.prodText.setFontSize(`${Math.round(10 * sf)}px`);

    this.milestoneBadgeText.setPosition(textX, h * 0.86);
    this.milestoneBadgeText.setFontSize(`${Math.round(8.5 * sf)}px`);

    // Buton (sağ taraf)
    this._btnW = Math.round(92 * sf);
    this._btnH = Math.round(36 * sf);
    const btnX = w - pad - this._btnW;
    const btnY = h / 2 - this._btnH / 2;

    this.btnBg.setPosition(btnX, btnY);
    this.btnLabel.setPosition(btnX + this._btnW / 2, btnY + this._btnH / 2);
    this.btnLabel.setFontSize(`${Math.round(10 * sf)}px`);
    this.btnZone.setPosition(btnX + this._btnW / 2, btnY + this._btnH / 2);
    this.btnZone.setSize(this._btnW, this._btnH);

    this.drawButton(0x2a2a3e);

    // Kilit katmanı
    this.lockOverlay.clear();
    this.lockOverlay.fillStyle(0x0a0a14, 0.85);
    this.lockOverlay.fillRoundedRect(0, 0, w, h, 8);

    this.lockText.setPosition(w / 2, h / 2 - 14);
    this.lockText.setFontSize(`${Math.round(18 * sf)}px`);
    this.lockRequirement.setPosition(w / 2, h / 2 + 12);
    this.lockRequirement.setFontSize(`${Math.round(10 * sf)}px`);
  }

  /** Satın alma / yükseltme animasyonu */
  playPurchaseEffect(): void {
    this.scene.tweens.add({
      targets: this.container,
      scaleX: 1.03, scaleY: 1.03,
      duration: 90, yoyo: true,
      ease: 'Back.easeOut',
    });

    const cx = this.container.x + this.cardW / 2;
    const cy = this.container.y + this.cardH / 2;
    for (let i = 0; i < 6; i++) {
      const angle = (Math.PI * 2 * i) / 6;
      const p = this.scene.add.circle(cx, cy, 3, 0x2ecc71, 0.9).setDepth(60);
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

  /** Kilit açılma animasyonu */
  playUnlockEffect(): void {
    this.scene.tweens.add({
      targets: this.lockOverlay,
      alpha: 0,
      duration: 450,
      ease: 'Quad.easeOut',
    });
    this.scene.tweens.add({
      targets: [this.lockText, this.lockRequirement],
      alpha: 0, y: '-=15',
      duration: 350,
      ease: 'Quad.easeOut',
    });
  }

  /* ---- Çizim yardımcıları ---- */

  private drawButton(color: number): void {
    const g = this.btnBg;
    g.clear();
    g.fillStyle(color, 1);
    g.fillRoundedRect(0, 0, this._btnW, this._btnH, 6);
  }

  private drawMachineVisual(def: MachineDefinition, level: number): void {
    const g = this.machineVisual;
    g.clear();

    if (level === 0) return;

    const ix = this.iconText.x;
    const iy = this.iconText.y;

    // Seviye noktaları (5'e kadar)
    const dotCount = Math.min(level, 5);
    g.fillStyle(def.color, 0.8);
    for (let i = 0; i < dotCount; i++) {
      g.fillCircle(ix - 10 + i * 5, iy + 17, 2);
    }
  }
}
