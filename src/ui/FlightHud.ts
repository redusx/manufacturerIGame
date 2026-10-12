/* ======================================================================
 * FlightHud.ts — Uçuş ekranı arayüzü
 *
 * Uçuş sırasında bakılan her şey: üstte mesafe (en büyük), irtifa, hız ve
 * biriken prim; altında gövde ve yakıt çubukları; ekranın altında basılı
 * tutulan nitro düğmesi; kalkıştan önce fırlatma gücü göstergesi.
 * Uçuş dünyasından bağımsız olarak arayüz kamerasında, arayüz ölçeğiyle çizilir.
 * ====================================================================== */

import Phaser from 'phaser';
import { formatDistance, formatNumber } from '../utils/format';
import { BUTTON_LABEL_COLORS, PALETTE, SEMANTIC, SPACE, brightOf, uiIcon } from './theme';
import type { UiLayer } from './system/UiLayer.ts';
import { UiProgressBar } from './system/UiWidgets.ts';

export interface FlightHudState {
  distance: number;
  altitude: number;
  speed: number;
  earned: number;
  hp: number;
  maxHp: number;
  fuel: number;
  maxFuel: number;
  boost: number;
  maxBoost: number;
  isBoosting: boolean;
  /** Sıradaki menzil hedefi (metre); hepsi geçildiyse null */
  nextTargetMeters: number | null;
}

export interface FlightHudCallbacks {
  onNitroDown: () => void;
  onNitroUp: () => void;
}

const BAR_HEIGHT = 48;
const NITRO_HEIGHT = 56;

export class FlightHud {
  private readonly layer: UiLayer;
  private readonly root: Phaser.GameObjects.Container;

  // Üst çubuk
  private readonly topBg: Phaser.GameObjects.NineSlice;
  private readonly distanceIcon: Phaser.GameObjects.Image;
  private readonly distanceText: Phaser.GameObjects.Text;
  private readonly detailText: Phaser.GameObjects.Text;
  private readonly coin: Phaser.GameObjects.Image;
  private readonly earnedText: Phaser.GameObjects.Text;

  // Gövde ve yakıt çubukları
  private readonly hpIcon: Phaser.GameObjects.Image;
  private readonly hpBar: UiProgressBar;
  private readonly fuelIcon: Phaser.GameObjects.Image;
  private readonly fuelBar: UiProgressBar;

  // Nitro düğmesi (basılı tutulur)
  private readonly nitro: Phaser.GameObjects.Container;
  private readonly nitroBg: Phaser.GameObjects.NineSlice;
  private readonly nitroFill: Phaser.GameObjects.Image;
  private readonly nitroLabel: Phaser.GameObjects.Text;
  private readonly nitroHint: Phaser.GameObjects.Text;
  private readonly nitroZone: Phaser.GameObjects.Zone;
  private nitroWidth = 220;
  private nitroPressed = false;

  // Fırlatma göstergesi: imleç çubukta gidip gelir, ortadaki yeşil bölge mükemmel fırlatmadır
  private readonly meter: Phaser.GameObjects.Container;
  private readonly meterGoodZone: Phaser.GameObjects.Image;
  private readonly meterPerfectZone: Phaser.GameObjects.Image;
  private readonly meterMarker: Phaser.GameObjects.Container;
  private readonly meterPercent: Phaser.GameObjects.Text;
  private readonly meterPadLabel: Phaser.GameObjects.Text;
  /** En dar ekrana (270 birim) kenar boşluğuyla sığar */
  private static readonly METER_WIDTH = 252;
  private static readonly METER_HEIGHT = 166;
  private static readonly TRACK_HEIGHT = 22;

  constructor(layer: UiLayer, callbacks: FlightHudCallbacks) {
    this.layer = layer;
    const scene = layer.scene;
    this.root = layer.container(100);

    this.topBg = scene.add.nineslice(0, 0, 'ui2_bar_bg', 0, 100, BAR_HEIGHT, 6, 6, 6, 6).setOrigin(0, 0);
    this.distanceIcon = scene.add.image(0, 0, 'icon_flag').setOrigin(0.5).setScale(1.5);
    this.distanceText = layer.text(0, 0, '0 m', 'display', { stroke: true }).setOrigin(0, 0.5);
    this.detailText = layer.text(0, 0, '', 'caption', { color: SEMANTIC.textMuted }).setOrigin(0, 0.5);
    this.coin = scene.add.image(0, 0, 'icon_coin').setOrigin(0.5).setScale(1.5);
    this.earnedText = layer.text(0, 0, '+$0', 'title', { color: SEMANTIC.primaryHex, stroke: true }).setOrigin(1, 0.5);
    this.root.add([this.topBg, this.distanceIcon, this.distanceText, this.detailText, this.coin, this.earnedText]);

    this.hpIcon = scene.add.image(0, 0, 'icon_heart').setOrigin(0.5);
    this.hpBar = new UiProgressBar(scene, 0, 0, 96, 10, 'green');
    this.fuelIcon = scene.add.image(0, 0, uiIcon('drop')).setOrigin(0.5).setTint(SEMANTIC.factory);
    this.fuelBar = new UiProgressBar(scene, 0, 0, 96, 10, 'gold');
    this.root.add([this.hpIcon, this.hpBar, this.fuelIcon, this.fuelBar]);

    // --- Nitro düğmesi ---------------------------------------------------
    this.nitro = scene.add.container(0, 0);
    this.nitroBg = scene.add
      .nineslice(0, 0, 'ui2_btn_secondary_normal', 0, this.nitroWidth, NITRO_HEIGHT, 4, 4, 4, 6)
      .setOrigin(0.5);
    // Kalan nitro düğmenin içinde dolgu olarak görünür
    this.nitroFill = scene.add.image(0, 0, 'ui2_px').setOrigin(0, 0.5).setTint(SEMANTIC.rocket);
    this.nitroLabel = layer.text(0, 0, 'NİTRO', 'button', { stroke: true }).setOrigin(0.5);
    this.nitroHint = layer.text(0, 0, 'Basılı tut', 'caption', { stroke: true }).setOrigin(0.5);
    this.nitroZone = scene.add.zone(0, 0, this.nitroWidth, NITRO_HEIGHT).setOrigin(0.5).setInteractive();
    this.nitroZone
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.nitroPressed = true;
        callbacks.onNitroDown();
      })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
        this.nitroPressed = false;
        callbacks.onNitroUp();
      })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
        this.nitroPressed = false;
        callbacks.onNitroUp();
      });
    this.nitro.add([this.nitroBg, this.nitroFill, this.nitroLabel, this.nitroHint, this.nitroZone]);
    // Kalkıştan önce nitro kullanılamaz; düğme rampadaki roketi de örtmesin
    this.nitro.setVisible(false);
    this.root.add(this.nitro);

    // --- Fırlatma gücü göstergesi ---------------------------------------------
    const mw = FlightHud.METER_WIDTH;
    const mh = FlightHud.METER_HEIGHT;
    this.meter = scene.add.container(0, 0);
    this.meter.add(scene.add.nineslice(0, 0, 'ui_modal_bg', 0, mw, mh, 8, 8, 8, 8).setOrigin(0.5));
    this.meter.add(
      layer
        .text(-mw / 2 + SPACE.lg, -mh / 2 + 24, 'FIRLATMA GÜCÜ', 'heading', { color: SEMANTIC.moneyHex })
        .setOrigin(0, 0.5),
    );
    // Çubuk: koyu yuva, içinde "iyi" (altın) ve "mükemmel" (yeşil) bölgeler, üstünde imleç
    const trackW = FlightHud.trackWidth;
    const trackH = FlightHud.TRACK_HEIGHT;
    const trackY = -mh / 2 + 44 + trackH / 2;
    this.meter.add(scene.add.nineslice(0, trackY, 'ui_bar_slot', 0, trackW, trackH, 4, 4, 4, 4).setOrigin(0.5));
    this.meterGoodZone = scene.add.image(0, trackY, 'ui2_px').setOrigin(0.5).setTint(SEMANTIC.money).setAlpha(0.45);
    this.meterPerfectZone = scene.add.image(0, trackY, 'ui2_px').setOrigin(0.5).setTint(SEMANTIC.primary);
    this.meter.add([this.meterGoodZone, this.meterPerfectZone]);

    this.meterMarker = scene.add.container(0, trackY);
    this.meterMarker.add(
      scene.add.image(0, 0, 'ui2_px').setOrigin(0.5).setDisplaySize(6, trackH + 10).setTint(PALETTE.bgDeep),
    );
    this.meterMarker.add(scene.add.image(0, 0, 'ui2_px').setOrigin(0.5).setDisplaySize(2, trackH + 6));
    this.meter.add(this.meterMarker);

    this.meterPercent = layer.text(0, trackY + trackH / 2 + 14, '%50', 'bodyBold', { stroke: true }).setOrigin(0.5);
    this.meter.add(this.meterPercent);
    this.meterPadLabel = layer
      .text(0, -mh / 2 + 24, '', 'caption', { color: SEMANTIC.textMuted })
      .setOrigin(0, 0.5);
    this.meter.add(this.meterPadLabel);
    this.configureLaunchMeter(0.4, 0.1, 1);
    // Düğme görünümlü çağrı; tüm ekran dokunuşu fırlatır
    this.meter.add(
      scene.add
        .nineslice(0, mh / 2 - 46, 'ui2_btn_primary_normal', 0, mw - SPACE.lg * 2, 44, 4, 4, 4, 6)
        .setOrigin(0.5),
    );
    this.meter.add(
      layer.text(0, mh / 2 - 47, 'ATEŞLE', 'button', { color: BUTTON_LABEL_COLORS.primary }).setOrigin(0.5),
    );
    this.meter.add(
      layer
        .text(0, mh / 2 - 14, 'İmleç yeşil bölgedeyken dokun veya Boşluk', 'caption', { color: SEMANTIC.textMuted })
        .setOrigin(0.5),
    );
    this.root.add(this.meter);

    this.layout();
  }

  layout(): void {
    const m = this.layer.metrics;
    const top = m.safe.top;
    const centerY = top + BAR_HEIGHT / 2;
    const left = m.safe.left + SPACE.sm;
    const right = m.width - m.safe.right - SPACE.sm;

    this.topBg.setPosition(0, 0).setSize(m.width, top + BAR_HEIGHT);
    this.distanceIcon.setPosition(left + 12, centerY);
    this.distanceText.setPosition(left + 30, centerY - 7);
    this.detailText.setPosition(left + 30, centerY + 13);
    this.earnedText.setPosition(right, centerY);

    // Gövde ve yakıt çubukları üst çubuğun hemen altında
    const barsY = top + BAR_HEIGHT + SPACE.sm;
    this.hpIcon.setPosition(left + 8, barsY + 5);
    this.hpBar.setPosition(left + 20, barsY);
    this.fuelIcon.setPosition(left + 136, barsY + 5);
    this.fuelBar.setPosition(left + 148, barsY);

    this.nitroWidth = Math.min(260, m.width - m.safe.left - m.safe.right - SPACE.lg * 2);
    this.nitro.setPosition(Math.round(m.width / 2), m.height - m.safe.bottom - SPACE.md - NITRO_HEIGHT / 2);
    this.nitroBg.setSize(this.nitroWidth, NITRO_HEIGHT);
    this.nitroZone.setSize(this.nitroWidth, NITRO_HEIGHT);
    this.nitroLabel.setPosition(0, -9);
    this.nitroHint.setPosition(0, 10);

    // Gösterge ekranın üst yarısında durur; kısa ekranda gövde/yakıt çubuklarının altına iner
    const meterTop = barsY + 10 + SPACE.sm;
    this.meter.setPosition(
      Math.round(m.width / 2),
      Math.round(Math.max(m.height * 0.42, meterTop + FlightHud.METER_HEIGHT / 2)),
    );
  }

  update(state: FlightHudState): void {
    this.distanceText.setText(formatDistance(state.distance));
    this.earnedText.setText(`+$${formatNumber(state.earned)}`);
    this.coin.setPosition(this.earnedText.x - this.earnedText.width - 16, this.earnedText.y);

    // Hız ve yerden yükseklik her zaman görünür; sıradaki hedef yalnız yer varsa eklenir
    const flight = `Hız ${Math.round(state.speed)} · İrtifa ${formatDistance(state.altitude)}`;
    this.detailText.setText(
      state.nextTargetMeters === null ? flight : `Hedef ${formatDistance(state.nextTargetMeters)} · ${flight}`,
    );
    if (this.detailText.x + this.detailText.width > this.coin.x - 16) {
      this.detailText.setText(flight);
    }

    const hpRatio = state.maxHp > 0 ? state.hp / state.maxHp : 0;
    this.hpBar.setProgress(hpRatio).setColor(hpRatio <= 0.35 ? 'red' : 'green');
    this.fuelBar.setProgress(state.maxFuel > 0 ? state.fuel / state.maxFuel : 0);

    // Nitro: kalan miktar düğmenin içini doldurur; biterse düğme söner
    const boostRatio = state.maxBoost > 0 ? Phaser.Math.Clamp(state.boost / state.maxBoost, 0, 1) : 0;
    const innerWidth = this.nitroWidth - 8;
    this.nitroFill
      .setPosition(-this.nitroWidth / 2 + 4, -2)
      .setDisplaySize(Math.max(0, innerWidth * boostRatio), NITRO_HEIGHT - 12)
      .setVisible(boostRatio > 0)
      .setAlpha(state.isBoosting ? 1 : 0.75);
    const pressed = this.nitroPressed && boostRatio > 0;
    this.nitroBg.setTexture(
      boostRatio <= 0 ? 'ui2_btn_disabled_normal' : pressed ? 'ui2_btn_secondary_pressed' : 'ui2_btn_secondary_normal',
    );
    this.nitroLabel.setText(boostRatio <= 0 ? 'NİTRO BİTTİ' : 'NİTRO');
    this.nitroHint.setVisible(boostRatio > 0);
  }

  private static get trackWidth(): number {
    return FlightHud.METER_WIDTH - SPACE.lg * 2;
  }

  /**
   * Göstergenin bölgelerini rampa seviyesine göre kurar.
   * @param goodWidth "İyi" bölgenin çubuğa oranı (0..1)
   * @param perfectWidth "Mükemmel" bölgenin çubuğa oranı (0..1); rampa yükseldikçe genişler
   */
  configureLaunchMeter(goodWidth: number, perfectWidth: number, padLevel: number): void {
    const inner = FlightHud.trackWidth - 4;
    const height = FlightHud.TRACK_HEIGHT - 6;
    this.meterGoodZone.setDisplaySize(Math.round(inner * goodWidth), height);
    this.meterPerfectZone.setDisplaySize(Math.max(4, Math.round(inner * perfectWidth)), height);
    this.meterPadLabel.setText(`Rampa Sv.${padLevel}`);
    this.meterPadLabel.setX(FlightHud.METER_WIDTH / 2 - SPACE.lg - this.meterPadLabel.width);
  }

  /** İmlecin konumu (0..1) ve o anda ateşlenirse elde edilecek güç (0..1) */
  setLaunchMarker(position: number, power: number, perfect: boolean): void {
    const inner = FlightHud.trackWidth - 4;
    this.meterMarker.x = Math.round((position - 0.5) * inner);
    this.meterPercent
      .setText(perfect ? 'MÜKEMMEL' : `%${Math.round(power * 100)}`)
      .setColor(brightOf(perfect ? SEMANTIC.primaryHex : SEMANTIC.textPrimary));
  }

  /** Kalkışla birlikte fırlatma göstergesi kapanır, nitro düğmesi belirir */
  hideLaunchMeter(): void {
    this.layer.scene.tweens.add({
      targets: this.meter,
      alpha: 0,
      duration: 160,
      onComplete: () => this.meter.setVisible(false),
    });
    this.nitro.setVisible(true).setAlpha(0);
    this.layer.scene.tweens.add({ targets: this.nitro, alpha: 1, duration: 200 });
  }

  /** Ekranın ortasında kısa süre görünen büyük duyuru (fırlatma kalitesi) */
  announce(text: string, color: string): void {
    const m = this.layer.metrics;
    const label = this.layer
      .text(Math.round(m.width / 2), Math.round(m.height * 0.3), text, 'title', { color, stroke: true })
      .setOrigin(0.5);
    this.root.add(label);
    this.layer.scene.tweens.add({
      targets: label,
      y: label.y - 24,
      alpha: 0,
      delay: 500,
      duration: 500,
      ease: 'Quad.easeOut',
      onComplete: () => label.destroy(),
    });
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }
}
