/* ======================================================================
 * HUD.ts — Üst bilgi çubuğu
 *
 * Oyuncunun en sık baktığı iki değer öndedir: kasadaki para (büyük, altın) ve
 * saniyelik gelir (yeşil rozet). Uçuş rekoru ikincil bilgidir ve yalnız yer
 * varsa görünür. Sağda ayarlar düğmesi durur. Çubuk güvenli alanın (çentik)
 * altından başlar ve fabrikayı kapatmayacak kadar incedir.
 * ====================================================================== */

import Phaser from 'phaser';
import type { DecimalSource } from 'break_eternity.js';
import { D } from '../utils/decimal';
import { formatDistance, formatNumber, formatRate } from '../utils/format';
import { SEMANTIC, SPACE } from './theme';
import { UiButton } from './system/UiButton.ts';
import { UiChip } from './system/UiWidgets.ts';
import type { UiLayer } from './system/UiLayer.ts';

/** Çubuğun güvenli alan hariç yüksekliği (arayüz birimi) */
export const HUD_BAR_HEIGHT = 48;

export class HUD {
  private readonly layer: UiLayer;
  private readonly root: Phaser.GameObjects.Container;

  private readonly bg: Phaser.GameObjects.NineSlice;
  private readonly coin: Phaser.GameObjects.Sprite;
  private readonly moneyText: Phaser.GameObjects.Text;
  private readonly incomeChip: UiChip;
  private readonly recordIcon: Phaser.GameObjects.Image;
  private readonly recordText: Phaser.GameObjects.Text;
  private readonly settingsButton: UiButton;

  private barBottom = HUD_BAR_HEIGHT;
  private centerY = HUD_BAR_HEIGHT / 2;
  private leftEdge: number = SPACE.sm;
  private rightEdge = 300;
  private showRecord = false;
  private bestDistance = 0;
  /** Para ve gelir bloğunun bittiği yer; yatay düzende hedef kartı buradan başlar */
  private leftGroupEnd = 0;
  /** Sağ bloğun (rekor + ayarlar) başladığı yer */
  private rightGroupStart = 0;

  constructor(layer: UiLayer, onSettingsClick: () => void) {
    this.layer = layer;
    const scene = layer.scene;
    this.root = layer.container(100);

    this.bg = scene.add.nineslice(0, 0, 'ui_panel_hud', 0, 100, HUD_BAR_HEIGHT, 6, 6, 6, 6).setOrigin(0, 0);
    this.root.add(this.bg);

    this.coin = scene.add.sprite(0, 0, scene.textures.exists('coin_gold') ? 'coin_gold' : 'icon_coin', 0);
    this.coin.setOrigin(0.5).setScale(1.5);
    if (scene.anims.exists('coin_gold_spin')) {
      this.coin.play('coin_gold_spin');
    }
    this.root.add(this.coin);

    this.moneyText = layer.text(0, 0, '$0', 'display', { color: SEMANTIC.moneyHex, stroke: true }).setOrigin(0, 0.5);
    this.root.add(this.moneyText);

    this.incomeChip = new UiChip(layer, 0, 0, '+$0/sn', SEMANTIC.primary, { variant: 'bodyBold', height: 26 });
    this.root.add(this.incomeChip);

    this.recordIcon = scene.add.image(0, 0, 'icon_trophy').setOrigin(0.5);
    this.recordText = layer.text(0, 0, '0 m', 'captionBold', { color: SEMANTIC.rocketHex }).setOrigin(0, 0.5);
    this.root.add([this.recordIcon, this.recordText]);

    this.settingsButton = new UiButton(layer, 0, 0, {
      width: 40,
      height: 40,
      variant: 'secondary',
      icon: 'icon_settings',
      iconScale: 1.5,
      onClick: onSettingsClick,
    });
    this.root.add(this.settingsButton);
    layer.registerFocusable(this.settingsButton);
  }

  /** Çubuğun alt kenarı (güvenli alan dahil); altındaki içerik buradan başlar */
  get bottom(): number {
    return this.barBottom;
  }

  /** Yatay düzende hedef kartının sığabileceği boş aralık */
  get freeSlot(): { left: number; right: number; centerY: number } {
    return { left: this.leftGroupEnd, right: this.rightGroupStart, centerY: this.centerY };
  }

  layout(): void {
    const m = this.layer.metrics;
    this.barBottom = m.safe.top + HUD_BAR_HEIGHT;
    this.centerY = m.safe.top + HUD_BAR_HEIGHT / 2;
    this.leftEdge = m.safe.left + SPACE.sm;
    this.rightEdge = m.width - m.safe.right - SPACE.sm;
    // Rekor ikincil bilgidir: dar ekranda para ve gelire yer açmak için gizlenir
    this.showRecord = m.width >= 560;

    this.bg.setPosition(0, 0).setSize(m.width, this.barBottom);
    this.settingsButton.setPosition(this.rightEdge - 20, this.centerY);
    this.coin.setPosition(this.leftEdge + 12, this.centerY);
    this.moneyText.setPosition(this.leftEdge + 30, this.centerY);

    this.reposition();
  }

  update(resources: DecimalSource, perSecond: DecimalSource, bestDistance = 0): void {
    this.moneyText.setText(`$${formatNumber(D(resources))}`);
    this.incomeChip.setChip(`+$${formatRate(D(perSecond))}/sn`, SEMANTIC.primary);
    this.bestDistance = bestDistance;
    this.recordText.setText(formatDistance(bestDistance));
    this.reposition();
  }

  /** Metin genişlikleri değişince blokları yeniden dizer; sığmayan gelir rozeti gizlenir */
  private reposition(): void {
    const settingsLeft = this.rightEdge - 40 - SPACE.sm;

    let rightStart = settingsLeft;
    const recordVisible = this.showRecord && this.bestDistance > 0;
    this.recordIcon.setVisible(recordVisible);
    this.recordText.setVisible(recordVisible);
    if (recordVisible) {
      const recordWidth = 16 + 4 + this.recordText.width;
      rightStart = settingsLeft - recordWidth - SPACE.sm;
      this.recordIcon.setPosition(rightStart + 8, this.centerY);
      this.recordText.setPosition(rightStart + 20, this.centerY);
    }
    this.rightGroupStart = rightStart;

    const moneyEnd = this.moneyText.x + this.moneyText.width;
    const chipX = moneyEnd + SPACE.sm;
    const chipFits = chipX + this.incomeChip.chipWidth <= rightStart;
    this.incomeChip.setVisible(chipFits).setPosition(chipX, this.centerY - 13);
    this.leftGroupEnd = chipFits ? chipX + this.incomeChip.chipWidth : moneyEnd;
  }

  /** Para kazanıldığında kısa bir vurgu */
  pulse(): void {
    const tweens = this.layer.scene.tweens;
    tweens.killTweensOf(this.coin);
    this.coin.setScale(1.5);
    tweens.add({
      targets: this.coin,
      scale: 1.8,
      duration: 70,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => this.coin.setScale(1.5),
    });
  }

  /** Uçan sikkelerin hedefi (arayüz birimi) */
  getResourceTargetPos(): { x: number; y: number } {
    return { x: this.coin.x, y: this.coin.y };
  }
}
