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
import { SEMANTIC, SPACE, TYPE_SCALE, uiIcon } from './theme';
import { UiButton } from './system/UiButton.ts';
import { UiChip } from './system/UiWidgets.ts';
import type { UiLayer } from './system/UiLayer.ts';

/** Çubuğun güvenli alan hariç yüksekliği (arayüz birimi) */
export const HUD_BAR_HEIGHT = 48;
/** Dar ekrandaki kupa (lider tablosu) düğmesinin kenarı */
const TROPHY_BUTTON_SIZE = 30;
/** Gelir rozetinin yanındaki takviye reklamı düğmesinin kenarı */
const BOOST_AD_BUTTON_SIZE = 26;

export class HUD {
  private readonly layer: UiLayer;
  private readonly root: Phaser.GameObjects.Container;

  private readonly bg: Phaser.GameObjects.NineSlice;
  private readonly pattern: Phaser.GameObjects.TileSprite;
  private readonly coin: Phaser.GameObjects.Sprite;
  private readonly moneyText: Phaser.GameObjects.Text;
  private readonly incomeChip: UiChip;
  private readonly recordIcon: Phaser.GameObjects.Image;
  private readonly recordText: Phaser.GameObjects.Text;
  private readonly recordZone: Phaser.GameObjects.Zone;
  /** Dar ekranda rekor yazısının yerine geçen, lider tablosunu açan kupa düğmesi */
  private readonly trophyButton: UiButton;
  private readonly settingsButton: UiButton;
  /**
   * Tam ekran düğmesi: yatay tutulan telefonda tarayıcı çubukları yüksekliğin çoğunu
   * alır. Tarayıcı izin veriyorsa (iPhone Safari vermez) tek dokunuşla tam ekrana geçilir.
   */
  private readonly fullscreenButton: UiButton;
  private showFullscreen = false;
  /** Para ve gelir bölümünün tamamı basılabilir: Takviye penceresini açar */
  private readonly incomeZone: Phaser.GameObjects.Zone;
  /**
   * Gelir takviyesi reklamla artırılabiliyorken gelir rozetinin yanında beliren küçük,
   * nabız gibi atan düğme. Reklamı kendisi başlatmaz; Takviye penceresini açar.
   */
  private readonly boostAdButton: UiButton;
  private boostAdAvailable = false;
  private boostAdPulse: Phaser.Tweens.Tween | null = null;
  /** Dar ekranda para yazısı bir kademe küçülür ki rozet ve düğme sığsın */
  private moneyCompact = false;

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

  /**
   * @param onIncomeClick Para/gelir bölümüne dokununca (Takviye penceresi). Bölüm bir
   * reklam düğmesi değildir; yalnızca süreli gelir çarpanının durumunu gösterir.
   */
  constructor(
    layer: UiLayer,
    onSettingsClick: () => void,
    onIncomeClick?: () => void,
    /** Rekor bölümüne (ya da dar ekrandaki kupa düğmesine) dokununca: lider tablosu */
    onRecordClick?: () => void,
  ) {
    this.layer = layer;
    const scene = layer.scene;
    this.root = layer.container(100);

    // Üst çubuk: tema dolgusu, altında pirinç şerit ve üstünde ince ızgara dokusu
    this.bg = scene.add.nineslice(0, 0, 'ui2_bar_bg', 0, 100, HUD_BAR_HEIGHT, 6, 6, 6, 6).setOrigin(0, 0);
    this.pattern = scene.add.tileSprite(0, 0, 100, HUD_BAR_HEIGHT, 'ui2_pattern').setOrigin(0, 0);
    this.root.add([this.bg, this.pattern]);

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
    // Rekor bölümü basılabilir: lider tablosunu açar. Dar ekranda yazı sığmaz; yerine kupa düğmesi gelir.
    this.recordZone = scene.add.zone(0, 0, 80, HUD_BAR_HEIGHT).setOrigin(0, 0);
    this.root.add(this.recordZone);
    if (onRecordClick) {
      this.recordZone.setInteractive({ useHandCursor: true });
      this.recordZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
        if (layer.pointerDragDistance(pointer) <= 10) onRecordClick();
      });
    }
    this.trophyButton = new UiButton(layer, 0, 0, {
      width: TROPHY_BUTTON_SIZE,
      height: TROPHY_BUTTON_SIZE,
      variant: 'secondary',
      icon: 'icon_trophy',
      onClick: () => onRecordClick?.(),
    });
    this.trophyButton.setVisible(false);
    this.root.add(this.trophyButton);

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

    this.fullscreenButton = new UiButton(layer, 0, 0, {
      width: 40,
      height: 40,
      variant: 'gold',
      icon: uiIcon('fullscreen'),
      onClick: () => {
        void document.documentElement.requestFullscreen?.().catch(() => undefined);
      },
    });
    this.fullscreenButton.setVisible(false);
    this.root.add(this.fullscreenButton);

    this.incomeZone = scene.add.zone(0, 0, 100, HUD_BAR_HEIGHT).setOrigin(0, 0);
    this.root.add(this.incomeZone);

    this.boostAdButton = new UiButton(layer, 0, 0, {
      width: BOOST_AD_BUTTON_SIZE,
      height: BOOST_AD_BUTTON_SIZE,
      variant: 'gold',
      icon: uiIcon('video'),
      onClick: () => onIncomeClick?.(),
    });
    this.boostAdButton.setVisible(false);
    this.root.add(this.boostAdButton);
    if (onIncomeClick) {
      this.incomeZone.setInteractive({ useHandCursor: true });
      this.incomeZone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
        if (layer.pointerDragDistance(pointer) <= 10) onIncomeClick();
      });
    }
  }

  /** Çubuğun alt kenarı (güvenli alan dahil); altındaki içerik buradan başlar */
  get bottom(): number {
    return this.barBottom;
  }

  /** Lider tablosunu açan öğenin dikdörtgeni (rekor bölümü ya da kupa düğmesi); yoksa null */
  get recordBounds(): { x: number; y: number; width: number; height: number } | null {
    if (this.trophyButton.visible) {
      const bounds = this.trophyButton.getFocusBounds();
      return { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height };
    }
    if (!this.recordIcon.visible) return null;
    return { x: this.recordZone.x, y: this.centerY - 16, width: this.recordZone.width, height: 32 };
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
    // Tam ekran düğmesi yalnız işe yaradığı yerde görünür: dokunmatik, kısa yatay ekran,
    // tarayıcı destekliyor ve henüz tam ekranda değil
    this.showFullscreen =
      m.mode === 'landscapeCompact' &&
      this.layer.scene.sys.game.device.input.touch &&
      typeof document !== 'undefined' &&
      document.fullscreenEnabled === true &&
      document.fullscreenElement === null;

    this.bg.setPosition(0, 0).setSize(m.width, this.barBottom);
    this.pattern.setPosition(1, 2).setSize(m.width - 2, this.barBottom - 6);
    this.settingsButton.setPosition(this.rightEdge - 20, this.centerY);
    this.coin.setPosition(this.leftEdge + 12, this.centerY);
    this.moneyText.setPosition(this.leftEdge + 30, this.centerY);

    this.reposition();
  }

  /**
   * @param boostLabel Süreli gelir takviyesi etkinse göstergesi ("×2 08:41"); değilse boş
   * @param boostAdAvailable Takviye şu an reklam izleyerek artırılabiliyor mu?
   */
  update(
    resources: DecimalSource,
    perSecond: DecimalSource,
    bestDistance = 0,
    boostLabel = '',
    boostAdAvailable = false,
  ): void {
    this.boostAdAvailable = boostAdAvailable;
    this.moneyText.setText(`$${formatNumber(D(resources))}`);
    const income = `+$${formatRate(D(perSecond))}/sn`;
    // Takviye etkinken rozet altına döner ve kalan süreyi gösterir
    this.incomeChip.setChip(
      boostLabel ? `${income} · ${boostLabel}` : income,
      boostLabel ? SEMANTIC.money : SEMANTIC.primary,
    );
    this.bestDistance = bestDistance;
    this.recordText.setText(formatDistance(bestDistance));
    this.reposition();
  }

  /** Metin genişlikleri değişince blokları yeniden dizer; sığmayan gelir rozeti gizlenir */
  private reposition(): void {
    let settingsLeft = this.rightEdge - 40 - SPACE.sm;
    this.fullscreenButton.setVisible(this.showFullscreen);
    if (this.showFullscreen) {
      this.fullscreenButton.setPosition(settingsLeft - 20, this.centerY);
      settingsLeft -= 40 + SPACE.sm;
    }

    let rightStart = settingsLeft;
    // Rekor her zaman gösterilir (uçuş yoksa "0 m"): lider tablosunun giriş noktasıdır
    const recordVisible = this.showRecord;
    this.recordIcon.setVisible(recordVisible);
    this.recordText.setVisible(recordVisible);
    if (recordVisible) {
      const recordWidth = 16 + 4 + this.recordText.width;
      rightStart = settingsLeft - recordWidth - SPACE.sm;
      this.recordIcon.setPosition(rightStart + 8, this.centerY);
      this.recordText.setPosition(rightStart + 20, this.centerY);
      this.recordZone
        .setPosition(rightStart - SPACE.xs, this.centerY - HUD_BAR_HEIGHT / 2)
        .setSize(recordWidth + SPACE.sm, HUD_BAR_HEIGHT);
    }
    if (this.recordZone.input) this.recordZone.input.enabled = recordVisible;

    // Dar ekranda kupa düğmesi: yalnızca para ve gelir rozetine yer kalıyorsa
    const trophyLeft = settingsLeft - TROPHY_BUTTON_SIZE - SPACE.xs;
    const neededLeft = this.moneyText.x + this.moneyText.width + SPACE.sm + this.incomeChip.chipWidth;
    const trophyVisible = !recordVisible && neededLeft <= trophyLeft;
    this.trophyButton.setVisible(trophyVisible);
    if (trophyVisible) {
      this.trophyButton.setPosition(trophyLeft + TROPHY_BUTTON_SIZE / 2, this.centerY);
      rightStart = trophyLeft;
    }
    this.rightGroupStart = rightStart;

    const adWidth = this.boostAdAvailable ? BOOST_AD_BUTTON_SIZE + SPACE.xs : 0;
    this.fitMoneyText(rightStart - this.moneyText.x - SPACE.sm - this.incomeChip.chipWidth - adWidth);

    const moneyEnd = this.moneyText.x + this.moneyText.width;
    const chipX = moneyEnd + SPACE.sm;
    const chipFits = chipX + this.incomeChip.chipWidth <= rightStart;
    this.incomeChip.setVisible(chipFits).setPosition(chipX, this.centerY - 13);
    this.leftGroupEnd = chipFits ? chipX + this.incomeChip.chipWidth : moneyEnd;

    // Reklam düğmesi rozetin hemen sağında; rozetle birlikte sığmıyorsa gösterilmez
    const adX = this.leftGroupEnd + SPACE.xs + BOOST_AD_BUTTON_SIZE / 2;
    const adFits = this.boostAdAvailable && chipFits && adX + BOOST_AD_BUTTON_SIZE / 2 <= rightStart;
    this.setBoostAdVisible(adFits);
    if (adFits) {
      this.boostAdButton.setPosition(adX, this.centerY);
      this.leftGroupEnd = adX + BOOST_AD_BUTTON_SIZE / 2;
    }
    this.incomeZone
      .setPosition(this.leftEdge, this.centerY - HUD_BAR_HEIGHT / 2)
      .setSize(Math.max(44, this.leftGroupEnd - this.leftEdge), HUD_BAR_HEIGHT);
  }

  /**
   * Para yazısını, rozet ve düğmeye `available` kadar yer kalacak biçimde bir kademe
   * küçültür veya eski boyutuna döndürür. Her karede yazıyı yeniden üretmemek için
   * genişlik orandan kestirilir.
   */
  private fitMoneyText(available: number): void {
    const large = TYPE_SCALE.display.size;
    const small = TYPE_SCALE.title.size;
    const width = this.moneyText.width;
    if (!this.moneyCompact && width > available) {
      this.moneyCompact = true;
      this.moneyText.setFontSize(small);
    } else if (this.moneyCompact && (width * large) / small + SPACE.sm <= available) {
      this.moneyCompact = false;
      this.moneyText.setFontSize(large);
    }
  }

  private setBoostAdVisible(visible: boolean): void {
    if (this.boostAdButton.visible === visible) return;
    this.boostAdButton.setVisible(visible);
    this.boostAdPulse?.stop();
    this.boostAdPulse = null;
    this.boostAdButton.setScale(1);
    if (visible) {
      // Dikkat çekmek için hafifçe büyüyüp küçülür
      this.boostAdPulse = this.layer.scene.tweens.add({
        targets: this.boostAdButton,
        scale: 1.14,
        duration: 650,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });
    }
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
