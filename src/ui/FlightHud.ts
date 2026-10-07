/* ======================================================================
 * FlightHud.ts — Uçuş ekranı arayüzü
 *
 * Uçuş sırasında bakılan her şey: üstte mesafe (en büyük), irtifa, hız ve
 * biriken prim; altında gövde ve yakıt çubukları; ekranın altında basılı
 * tutulan nitro düğmesi; kalkıştan önce fırlatma gücü göstergesi.
 * Uçuş dünyasından bağımsız olarak arayüz kamerasında, arayüz ölçeğiyle çizilir.
 * ====================================================================== */

import Phaser from 'phaser';
import { formatNumber } from '../utils/format';
import { SEMANTIC, SPACE, uiIcon } from './theme';
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

  // Fırlatma gücü göstergesi
  private readonly meter: Phaser.GameObjects.Container;
  private readonly meterBar: UiProgressBar;
  private readonly meterPercent: Phaser.GameObjects.Text;
  private static readonly METER_WIDTH = 280;
  private static readonly METER_HEIGHT = 148;

  constructor(layer: UiLayer, callbacks: FlightHudCallbacks) {
    this.layer = layer;
    const scene = layer.scene;
    this.root = layer.container(100);

    this.topBg = scene.add.nineslice(0, 0, 'ui_panel_hud', 0, 100, BAR_HEIGHT, 6, 6, 6, 6).setOrigin(0, 0);
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
      layer.text(0, -mh / 2 + 24, 'FIRLATMA GÜCÜ', 'heading', { color: SEMANTIC.moneyHex }).setOrigin(0.5),
    );
    this.meterBar = new UiProgressBar(scene, -mw / 2 + SPACE.lg, -mh / 2 + 44, mw - SPACE.lg * 2, 22, 'gold');
    this.meter.add(this.meterBar);
    this.meterPercent = layer.text(0, -mh / 2 + 55, '%50', 'bodyBold', { stroke: true }).setOrigin(0.5);
    this.meter.add(this.meterPercent);
    // Düğme görünümlü çağrı; tüm ekran dokunuşu fırlatır
    this.meter.add(
      scene.add
        .nineslice(0, mh / 2 - 46, 'ui2_btn_primary_normal', 0, mw - SPACE.lg * 2, 44, 4, 4, 4, 6)
        .setOrigin(0.5),
    );
    this.meter.add(
      layer.text(0, mh / 2 - 47, 'ATEŞLE', 'button', { color: SEMANTIC.textOnBright }).setOrigin(0.5),
    );
    this.meter.add(
      layer
        .text(0, mh / 2 - 14, 'Çubuk doluyken dokun veya Boşluk', 'caption', { color: SEMANTIC.textMuted })
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

    this.meter.setPosition(Math.round(m.width / 2), Math.round(m.height * 0.42));
  }

  update(state: FlightHudState): void {
    this.distanceText.setText(`${Math.floor(state.distance)} m`);
    this.detailText.setText(`İrtifa ${Math.round(state.altitude)} m · Hız ${Math.round(state.speed)}`);
    this.earnedText.setText(`+$${formatNumber(state.earned)}`);
    this.coin.setPosition(this.earnedText.x - this.earnedText.width - 16, this.earnedText.y);

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

  /** Fırlatma gücü göstergesi: 0..1 */
  setLaunchPower(power: number): void {
    const percent = Math.round(power * 100);
    this.meterBar.setProgress(power).setColor(percent >= 85 ? 'green' : 'gold');
    this.meterPercent.setText(`%${percent}`);
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
