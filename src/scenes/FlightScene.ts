/* ======================================================================
 * FlightScene.ts — Parabolik Yer Çekimi, Roket Fiziği ve Uçuş Sahnesi
 *
 * Mekanikler:
 * - Parabolik Rampa Fırlatması: Başlangıç ivmesi ile gökyüzüne atılış
 * - Gerçekçi Yer Çekimi (Gravity): Roket havada kaldıkça aşağı çekilir
 * - İtici Motor (Thrust) ve Yakıt (Fuel): Sınırlı yakıtla itiş gücü
 * - Süpersonik Nitro Boost: Yüksek hızlanma ve tırmanma enerjisi
 * - Aerodinamik Kanat Kaldırma Gücü (Lift & Glide): Eğim açısına göre süzülme
 * - Zemin Çarpışması, Sekme ve Yere Çakılma Fiziği (Ground Crash & Bouncing)
 * - HUD: Anlık İrtifa, Mesafe, Hız, Gövde HP, Yakıt ve Nitro barları
 * - Havada toplanabilir yakıt kristalleri, tamir kitleri ve dişliler
 * - Uçuş Sonu Detaylı Rapor: Mesafe, Havada Kalma Süresi, Maksimum İrtifa
 * ====================================================================== */

import Phaser from 'phaser';
import type { EconomyManager } from '../economy/EconomyManager';
import {
  DISTANCE_RESOURCE_RATE,
  PART_PICKUP_VALUE,
  CRYSTAL_PICKUP_VALUE,
  DODGE_BONUS_VALUE,
  BOOST_SPEED_MULTIPLIER,
  getMaxHullHP,
  getMaxBoostDuration,
  getFuelCapacity,
  getMainThrust,
  getLaunchVelocity,
  getSteeringAgility,
  getLiftEfficiency,
  getGroundBounce,
} from '../data/RocketData';
import { formatNumber } from '../utils/format';
import { RESOURCE_NAME } from '../data/MachineData';
import { PALETTE, FONT_FAMILY, PixelUIHelper } from '../ui/theme';

interface ObstacleEntity {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  width: number;
  height: number;
  radius: number;
  speedMultiplier: number;
  hasCollided: boolean;
  hasBeenDodged: boolean;
  type: string;
}

interface CollectibleEntity {
  sprite: Phaser.GameObjects.Image;
  x: number;
  y: number;
  radius: number;
  type: 'gear' | 'crystal' | 'repair';
  value: number;
  isCollected: boolean;
}

type FlightState = 'countdown' | 'launching' | 'flying' | 'crashed' | 'landed' | 'finished';

export class FlightScene extends Phaser.Scene {
  private economy!: EconomyManager;

  /* Roket Geliştirme Seviyeleri */
  private hullLevel = 1;
  private engineLevel = 1;
  private wingsLevel = 1;
  private boostLevel = 1;

  /* Fizik ve Stat Parametreleri */
  private maxHP = 100;
  private currentHP = 100;
  private fuelCapacity = 4.0;
  private currentFuel = 4.0;
  private boostCapacity = 3.5;
  private currentBoost = 3.5;

  private launchVelocity = 380;
  private mainThrust = 400;
  private steerAgility = 2.5;
  private liftCoeff = 0.45;
  private groundBounce = 0.45;

  /* Hız, Konum ve Açı */
  private flightState: FlightState = 'countdown';
  private rocketScreenX = 140;
  private rocketScreenY = 240;
  private altitude = 0;       // Yükseklik (metre cinsinden sanal irtifa)
  private distance = 0;       // Yatay uçuş mesafesi (metre)
  private maxAltitude = 0;
  private maxSpeed = 0;
  private flightDuration = 0;  // Havada kalma süresi (saniye)

  private vx = 0;             // Yatay hız (px/s)
  private vy = 0;             // Dikey hız (px/s, aşağı yönlü pozitif)
  private currentAngle = 0;   // Radyan açısı (negatif: burun yukarı, pozitif: burun aşağı)

  private isThrusting = false;
  private isBoosting = false;
  private invulnerableTimer = 0;
  private flightScore = 0;
  private collectedGears = 0;
  private collectedCrystals = 0;
  private dodgedObstacles = 0;

  /* Görsel Nesneler */
  private rocketContainer!: Phaser.GameObjects.Container;
  private hullSprite!: Phaser.GameObjects.Image;
  private engineSprite!: Phaser.GameObjects.Image;
  private wingsSprite!: Phaser.GameObjects.Image;
  private tankSprite!: Phaser.GameObjects.Image;
  private flameSprite!: Phaser.GameObjects.Image;
  private launchPlatform: Phaser.GameObjects.Image | null = null;
  private launchGantry: Phaser.GameObjects.Image | null = null;

  /* Zemin ve Parallaks */
  private skyTileSprite!: Phaser.GameObjects.TileSprite;
  private groundTileSprite!: Phaser.GameObjects.TileSprite;
  private stars: Array<{ sprite: Phaser.GameObjects.Image; speed: number }> = [];
  private mountains: Array<{ sprite: Phaser.GameObjects.Image; speed: number }> = [];
  private clouds: Array<{ sprite: Phaser.GameObjects.Image; speed: number }> = [];

  /* Engeller ve Nesneler */
  private obstacles: ObstacleEntity[] = [];
  private collectibles: CollectibleEntity[] = [];
  private obstacleSpawnTimer = 0;
  private collectibleSpawnTimer = 0;

  /* HUD */
  private hudBgSlice!: Phaser.GameObjects.NineSlice;
  private distText!: Phaser.GameObjects.Text;
  private altText!: Phaser.GameObjects.Text;
  private speedText!: Phaser.GameObjects.Text;
  private scoreText!: Phaser.GameObjects.Text;
  private earnedText!: Phaser.GameObjects.Text;
  private coinSprite: Phaser.GameObjects.Sprite | null = null;

  // Barlar: HP, Yakıt, Nitro
  private hpBarSlot!: Phaser.GameObjects.NineSlice;
  private hpBarFill!: Phaser.GameObjects.NineSlice;
  private hpLabel!: Phaser.GameObjects.Text;

  private fuelBarSlot!: Phaser.GameObjects.NineSlice;
  private fuelBarFill!: Phaser.GameObjects.NineSlice;
  private fuelLabel!: Phaser.GameObjects.Text;

  private boostBarSlot!: Phaser.GameObjects.NineSlice;
  private boostBarFill!: Phaser.GameObjects.NineSlice;
  private boostLabel!: Phaser.GameObjects.Text;

  /* Kontroller */
  private cursors!: Phaser.Types.Input.Keyboard.CursorKeys;
  private keyW!: Phaser.Input.Keyboard.Key;
  private keyA!: Phaser.Input.Keyboard.Key;
  private keyS!: Phaser.Input.Keyboard.Key;
  private keyD!: Phaser.Input.Keyboard.Key;
  private keySpace!: Phaser.Input.Keyboard.Key;
  private keyShift!: Phaser.Input.Keyboard.Key;

  private touchPitchUp = false;
  private touchPitchDown = false;
  private touchThrust = false;
  private touchBoost = false;
  private touchControlsContainer!: Phaser.GameObjects.Container;

  /* Uçuş Sonu Raporu */
  private reportContainer!: Phaser.GameObjects.Container;
  private countdownText: Phaser.GameObjects.Text | null = null;

  constructor() {
    super({ key: 'FlightScene' });
  }

  init(data: { economy: EconomyManager }): void {
    this.economy = data.economy;
  }

  create(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Piksel art animasyonları (GameScene'den paylaşılmış olabilir, yoksa burada tanımla)
    if (!this.anims.exists('hit_spark_anim') && this.textures.exists('hit_spark')) {
      this.anims.create({
        key: 'hit_spark_anim',
        frames: this.anims.generateFrameNumbers('hit_spark', { start: 0, end: 35 }),
        frameRate: 30,
        repeat: 0,
      });
    }
    if (!this.anims.exists('fire_explosion_anim') && this.textures.exists('fire_explosion')) {
      this.anims.create({
        key: 'fire_explosion_anim',
        frames: this.anims.generateFrameNumbers('fire_explosion', { start: 0, end: 63 }),
        frameRate: 30,
        repeat: 0,
      });
    }
    if (!this.anims.exists('coin_gold_spin') && this.textures.exists('coin_gold')) {
      this.anims.create({
        key: 'coin_gold_spin',
        frames: this.anims.generateFrameNumbers('coin_gold', { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
    }

    // Seviyeleri ve fizik parametrelerini yükle
    this.hullLevel = this.economy.getRocketUpgradeLevel('hull');
    this.engineLevel = this.economy.getRocketUpgradeLevel('engine');
    this.wingsLevel = this.economy.getRocketUpgradeLevel('wings');
    this.boostLevel = this.economy.getRocketUpgradeLevel('boost');

    this.maxHP = getMaxHullHP(this.hullLevel);
    this.currentHP = this.maxHP;
    this.fuelCapacity = getFuelCapacity(this.engineLevel);
    this.currentFuel = this.fuelCapacity;
    this.boostCapacity = getMaxBoostDuration(this.boostLevel);
    this.currentBoost = this.boostCapacity;

    this.launchVelocity = getLaunchVelocity(this.engineLevel);
    this.mainThrust = getMainThrust(this.engineLevel);
    this.steerAgility = getSteeringAgility(this.wingsLevel);
    this.liftCoeff = getLiftEfficiency(this.wingsLevel);
    this.groundBounce = getGroundBounce(this.hullLevel);

    this.flightState = 'countdown';
    this.distance = 0;
    this.altitude = 0;
    this.maxAltitude = 0;
    this.maxSpeed = 0;
    this.flightDuration = 0;
    this.flightScore = 0;
    this.collectedGears = 0;
    this.collectedCrystals = 0;
    this.dodgedObstacles = 0;
    this.invulnerableTimer = 0;
    this.obstacles = [];
    this.collectibles = [];

    // 1. Arka Plan Tile
    this.skyTileSprite = this.add.tileSprite(0, 0, w, h, 'sky_band_space').setOrigin(0, 0).setDepth(0);

    // 2. Parallaks Katmanları
    this.createParallaxLayers(w, h);

    // 3. Fırlatma Pisti ve Zemin
    const groundH = 45;
    this.groundTileSprite = this.add.tileSprite(0, h - groundH, w, groundH, 'flight_ground')
      .setOrigin(0, 0)
      .setDepth(8);

    // Başlangıç rampası
    const rampX = 130;
    const rampY = h - groundH;
    if (this.textures.exists('launch_platform')) {
      this.launchPlatform = this.add.image(rampX, rampY, 'launch_platform').setOrigin(0.5, 1).setDepth(8).setScale(1.7);
    }
    if (this.textures.exists('launch_pad')) {
      this.launchGantry = this.add.image(rampX - 35, rampY - 5, 'launch_pad').setOrigin(0.5, 1).setDepth(9).setScale(1.7);
    }

    // 4. Roket Nesnesi (Başlangıçta rampada 48 derece açılı)
    this.rocketScreenX = rampX + 15;
    this.rocketScreenY = rampY - 32;
    this.currentAngle = -Phaser.Math.DegToRad(48);
    this.createRocket();

    // 5. HUD
    this.createHUD();

    // 6. Kontroller
    this.setupControls(w, h);

    // 7. Uçuş Sonu Rapor Paneli
    this.createReportPanel(w, h);

    // 8. Fırlatma Geri Sayımı
    this.startLaunchSequence();

    // Yeniden boyutlandırma dinleyicisi
    this.scale.on('resize', () => this.handleResize());
  }

  /* ================================================================
   * PARALLAX VE ARKA PLAN
   * ================================================================ */

  private createParallaxLayers(w: number, h: number): void {
    this.stars = [];
    this.mountains = [];
    this.clouds = [];

    if (this.textures.exists('star_pixel')) {
      for (let i = 0; i < 40; i++) {
        const x = Phaser.Math.Between(0, w);
        const y = Phaser.Math.Between(10, h * 0.8);
        const star = this.add.image(x, y, 'star_pixel').setDepth(2).setAlpha(Phaser.Math.FloatBetween(0.35, 0.9));
        star.setScale(Phaser.Math.FloatBetween(0.8, 1.5));
        this.stars.push({ sprite: star, speed: Phaser.Math.FloatBetween(0.12, 0.3) });
      }
    }

    if (this.textures.exists('mountain_pixel')) {
      const count = Math.ceil(w / 120) + 3;
      for (let i = 0; i < count; i++) {
        const m = this.add.image(i * 140, h - 35, 'mountain_pixel').setOrigin(0, 1).setDepth(4);
        m.setScale(2.5, Phaser.Math.FloatBetween(1.8, 2.8));
        this.mountains.push({ sprite: m, speed: 0.4 });
      }
    }

    if (this.textures.exists('cloud_pixel')) {
      for (let i = 0; i < 9; i++) {
        const c = this.add.image(Phaser.Math.Between(0, w), Phaser.Math.Between(60, h * 0.7), 'cloud_pixel')
          .setDepth(6)
          .setAlpha(0.65);
        c.setScale(Phaser.Math.FloatBetween(1.6, 2.5));
        this.clouds.push({ sprite: c, speed: Phaser.Math.FloatBetween(0.65, 1.0) });
      }
    }
  }

  /* ================================================================
   * ROKET MONTAJI
   * ================================================================ */

  private createRocket(): void {
    this.rocketContainer = this.add.container(this.rocketScreenX, this.rocketScreenY).setDepth(20);
    this.rocketContainer.rotation = this.currentAngle;

    this.flameSprite = this.add.image(-28, 0, 'flame_idle').setOrigin(1, 0.5).setScale(1.7).setVisible(false);
    this.rocketContainer.add(this.flameSprite);

    const engineKey = `rocket_engine_${this.engineLevel}`;
    this.engineSprite = this.add.image(-16, 0, engineKey).setOrigin(0.5).setScale(1.8);
    this.rocketContainer.add(this.engineSprite);

    const tankKey = `rocket_tank_${this.boostLevel}`;
    this.tankSprite = this.add.image(-4, 0, tankKey).setOrigin(0.5).setScale(1.8);
    this.rocketContainer.add(this.tankSprite);

    const wingsKey = `rocket_wings_${this.wingsLevel}`;
    this.wingsSprite = this.add.image(-8, 0, wingsKey).setOrigin(0.5).setScale(1.8);
    this.rocketContainer.add(this.wingsSprite);

    const hullKey = `rocket_hull_${this.hullLevel}`;
    this.hullSprite = this.add.image(4, 0, hullKey).setOrigin(0.5).setScale(1.8);
    this.rocketContainer.add(this.hullSprite);
  }

  /* ================================================================
   * FIRLATMA GERİ SAYIMI & PARABOLİK MANCILIK
   * ================================================================ */

  private startLaunchSequence(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    this.countdownText = this.add.text(w / 2, h * 0.38, '3', {
      fontFamily: FONT_FAMILY,
      fontSize: '44px',
      color: PALETTE.resourceGoldHex,
      fontStyle: 'bold',
      stroke: '#0c1020',
      strokeThickness: 6,
    }).setOrigin(0.5).setDepth(150);

    let count = 3;
    const timer = this.time.addEvent({
      delay: 700,
      repeat: 3,
      callback: () => {
        count--;
        if (count > 0) {
          this.countdownText?.setText(`${count}`);
          this.cameras.main.shake(120, 0.004);
        } else if (count === 0) {
          this.countdownText?.setText('🚀 ATEŞLE!');
          this.countdownText?.setColor(PALETTE.successGreenHex);
          this.blastOff();
        } else {
          this.countdownText?.destroy();
          this.countdownText = null;
        }
      },
    });
  }

  /** Parabolik ilk fırlatma ivmesi */
  private blastOff(): void {
    this.flightState = 'flying';
    this.flameSprite.setVisible(true);

    // Mancınık fırlatma hızı
    const launchAngle = -Phaser.Math.DegToRad(48);
    this.vx = Math.cos(launchAngle) * this.launchVelocity;
    this.vy = Math.sin(launchAngle) * this.launchVelocity;

    // Fırlatma duman ve kıvılcım patlaması
    this.spawnLaunchPuff(this.rocketScreenX - 25, this.rocketScreenY + 20);
    this.cameras.main.shake(300, 0.008);
  }

  private spawnLaunchPuff(x: number, y: number): void {
    // Piksel kıvılcım ve duman - gerçek raster sprite'larla
    for (let i = 0; i < 14; i++) {
      const angle = Phaser.Math.FloatBetween(Math.PI * 0.4, Math.PI * 1.2);
      const spd = Phaser.Math.Between(35, 140);
      const key = i % 3 === 0 ? 'pickup_gear' : (i % 3 === 1 ? 'star_pixel' : 'pickup_crystal');
      const p = this.add.image(x, y, key)
        .setDepth(15)
        .setScale(Phaser.Math.FloatBetween(0.5, 1.1))
        .setAlpha(0.9)
        .setTint(i % 2 === 0 ? 0xffa502 : 0xc8c8c8);
      this.tweens.add({
        targets: p,
        x: x + Math.cos(angle) * spd,
        y: y + Math.sin(angle) * spd,
        alpha: 0,
        scaleX: 0.15,
        scaleY: 0.15,
        duration: Phaser.Math.Between(380, 650),
        onComplete: () => p.destroy(),
      });
    }
  }

  /* ================================================================
   * KONTROLLER (KLAVYE & DOKUNMATİK)
   * ================================================================ */

  private setupControls(w: number, h: number): void {
    if (this.input.keyboard) {
      this.cursors = this.input.keyboard.createCursorKeys();
      this.keyW = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W);
      this.keyA = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyS = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S);
      this.keyD = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.keyShift = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SHIFT);
    }

    this.touchControlsContainer = this.add.container(0, 0).setDepth(100);
    this.createTouchButtons(w, h);
  }

  private createTouchButtons(w: number, h: number): void {
    this.touchControlsContainer.removeAll(true);

    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: '14px',
      color: PALETTE.textPrimary,
      fontStyle: 'bold',
    };

    // Sol Alt: Eğim Yönlendirme (Pitch Up / Pitch Down)
    const leftX = 50;
    const botY = h - 55;
    const btnSize = 44;

    const makePitchBtn = (ox: number, oy: number, label: string, onDown: () => void, onUp: () => void) => {
      const btnBg = PixelUIHelper.createButton(this, ox, oy, btnSize, btnSize, 'disabled');
      this.touchControlsContainer.add(btnBg);

      const t = this.add.text(ox, oy, label, { ...font, fontSize: '18px' }).setOrigin(0.5);
      this.touchControlsContainer.add(t);

      const zone = this.add.zone(ox, oy, btnSize + 10, btnSize + 10)
        .setOrigin(0.5)
        .setInteractive()
        .on('pointerdown', () => {
          btnBg.setTexture('btn_green_pressed');
          onDown();
        })
        .on('pointerup', () => {
          btnBg.setTexture('btn_disabled');
          onUp();
        })
        .on('pointerout', () => {
          btnBg.setTexture('btn_disabled');
          onUp();
        });
      this.touchControlsContainer.add(zone);
    };

    makePitchBtn(leftX, botY - 30, '▲', () => { this.touchPitchUp = true; }, () => { this.touchPitchUp = false; });
    makePitchBtn(leftX + 54, botY - 30, '▼', () => { this.touchPitchDown = true; }, () => { this.touchPitchDown = false; });

    // Sağ Alt: Ana İtici Motor ve Boost Konsol Düğmeleri
    const rightX = w - 140;
    const bW = 80;
    const bH = 46;

    // 1. Ana İtici Butonu
    const thrustBg = PixelUIHelper.createButton(this, rightX, botY - 26, bW, bH, 'manual');
    this.touchControlsContainer.add(thrustBg);

    const thrustText = this.add.text(rightX, botY - 26, '🔥 İTİCİ', {
      ...font, fontSize: '13px', color: '#1f1003',
    }).setOrigin(0.5);
    this.touchControlsContainer.add(thrustText);

    const thrustZone = this.add.zone(rightX, botY - 26, bW + 10, bH + 10)
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => {
        this.touchThrust = true;
        thrustBg.setTexture('btn_manual_pressed');
      })
      .on('pointerup', () => {
        this.touchThrust = false;
        thrustBg.setTexture('btn_manual_normal');
      })
      .on('pointerout', () => {
        this.touchThrust = false;
        thrustBg.setTexture('btn_manual_normal');
      });
    this.touchControlsContainer.add(thrustZone);

    // 2. Boost (Nitro) Butonu
    const boostX = rightX + bW + 14;
    const boostBg = PixelUIHelper.createButton(this, boostX, botY - 26, bW, bH, 'launch');
    this.touchControlsContainer.add(boostBg);

    const boostText = this.add.text(boostX, botY - 26, '⚡ BOOST', {
      ...font, fontSize: '13px', color: PALETTE.btnCyanText,
    }).setOrigin(0.5);
    this.touchControlsContainer.add(boostText);

    const boostZone = this.add.zone(boostX, botY - 26, bW + 10, bH + 10)
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => {
        this.touchBoost = true;
        boostBg.setTexture('btn_launch_pressed');
      })
      .on('pointerup', () => {
        this.touchBoost = false;
        boostBg.setTexture('btn_launch_normal');
      })
      .on('pointerout', () => {
        this.touchBoost = false;
        boostBg.setTexture('btn_launch_normal');
      });
    this.touchControlsContainer.add(boostZone);
  }

  /* ================================================================
   * HUD (TELEMETRİ, İRTİFA, HIZ VE ENERJİ BARLARI)
   * ================================================================ */

  private createHUD(): void {
    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    this.hudBgSlice = PixelUIHelper.createPanel(this, 0, 0, 100, 60).setDepth(80);

    // Sol: Mesafe, İrtifa, Hız
    this.distText = this.add.text(16, 12, '📏 Mesafe: 0 m', {
      ...font, fontSize: '12px', color: PALETTE.textPrimary, fontStyle: 'bold',
    }).setDepth(82);

    this.altText = this.add.text(16, 28, '☁ İrtifa: 0 m', {
      ...font, fontSize: '11px', color: PALETTE.rocketCyanHex, fontStyle: 'bold',
    }).setDepth(82);

    this.speedText = this.add.text(16, 44, '⚡ Hız: 0 km/s', {
      ...font, fontSize: '11px', color: PALETTE.resourceGoldHex, fontStyle: 'bold',
    }).setDepth(82);

    // Orta: Kazanılan Kaynak
    this.earnedText = this.add.text(200, 16, `+0 ${RESOURCE_NAME}`, {
      ...font, fontSize: '15px', color: PALETTE.successGreenHex, fontStyle: 'bold',
    }).setDepth(82).setOrigin(0.5, 0);

    this.scoreText = this.add.text(200, 36, '⭐ Skor: 0', {
      ...font, fontSize: '11px', color: PALETTE.resourceGoldHex, fontStyle: 'bold',
    }).setDepth(82).setOrigin(0.5, 0);

    // Altın sikke animasyon ikonu
    if (this.textures.exists('coin_gold')) {
      this.coinSprite = this.add.sprite(0, 0, 'coin_gold', 0).setScale(1.6).setDepth(82);
      if (this.anims.exists('coin_gold_spin')) {
        this.coinSprite.play('coin_gold_spin');
      }
    }

    // Sağ: HP, Yakıt, Nitro Barları
    this.hpLabel = this.add.text(0, 0, 'ZIRH', { ...font, fontSize: '9px', color: PALETTE.textPrimary, fontStyle: 'bold' }).setDepth(82).setOrigin(1, 0.5);
    this.hpBarSlot = this.add.nineslice(0, 0, 'ui_bar_slot', 0, 90, 10, 4, 4, 4, 4).setDepth(81).setOrigin(0, 0.5);
    this.hpBarFill = this.add.nineslice(0, 0, 'ui_bar_fill_green', 0, 10, 6, 2, 2, 2, 2).setDepth(82).setOrigin(0, 0.5);

    this.fuelLabel = this.add.text(0, 0, 'YAKIT', { ...font, fontSize: '9px', color: PALETTE.resourceGoldHex, fontStyle: 'bold' }).setDepth(82).setOrigin(1, 0.5);
    this.fuelBarSlot = this.add.nineslice(0, 0, 'ui_bar_slot', 0, 90, 10, 4, 4, 4, 4).setDepth(81).setOrigin(0, 0.5);
    this.fuelBarFill = this.add.nineslice(0, 0, 'ui_bar_fill_gold', 0, 10, 6, 2, 2, 2, 2).setDepth(82).setOrigin(0, 0.5);

    this.boostLabel = this.add.text(0, 0, 'NİTRO', { ...font, fontSize: '9px', color: PALETTE.rocketCyanHex, fontStyle: 'bold' }).setDepth(82).setOrigin(1, 0.5);
    this.boostBarSlot = this.add.nineslice(0, 0, 'ui_bar_slot', 0, 90, 10, 4, 4, 4, 4).setDepth(81).setOrigin(0, 0.5);
    this.boostBarFill = this.add.nineslice(0, 0, 'ui_bar_fill_cyan', 0, 10, 6, 2, 2, 2, 2).setDepth(82).setOrigin(0, 0.5);

    this.updateHUDLayout();
  }

  private updateHUDLayout(): void {
    const w = this.scale.width;
    const barH = 62;

    this.hudBgSlice.setSize(w, barH);
    this.earnedText.setPosition(w / 2, 14);
    this.scoreText.setPosition(w / 2, 36);

    if (this.coinSprite) {
      this.coinSprite.setPosition(w / 2 - this.earnedText.width / 2 - 14, 22);
    }

    const rightPad = w - 16;
    const barW = 86;
    const barX = rightPad - barW;

    // 1. Zırh (HP)
    this.hpLabel.setPosition(barX - 8, 14);
    this.hpBarSlot.setPosition(barX, 14);
    this.hpBarSlot.setSize(barW, 10);

    // 2. Motor Yakıtı
    this.fuelLabel.setPosition(barX - 8, 30);
    this.fuelBarSlot.setPosition(barX, 30);
    this.fuelBarSlot.setSize(barW, 10);

    // 3. Nitro
    this.boostLabel.setPosition(barX - 8, 46);
    this.boostBarSlot.setPosition(barX, 46);
    this.boostBarSlot.setSize(barW, 10);

    this.refreshBars();
  }

  private refreshBars(): void {
    const barW = 86;

    // HP Bar
    const hpRatio = Phaser.Math.Clamp(this.currentHP / this.maxHP, 0, 1);
    const hpFillW = Math.max(0, Math.floor((barW - 4) * hpRatio));
    if (hpFillW > 2) {
      this.hpBarFill.setVisible(true);
      this.hpBarFill.setPosition(this.hpBarSlot.x + 2, this.hpBarSlot.y);
      this.hpBarFill.setSize(hpFillW, 6);
      this.hpBarFill.setTexture(hpRatio > 0.25 ? 'ui_bar_fill_green' : 'ui_bar_fill_red');
    } else {
      this.hpBarFill.setVisible(false);
    }

    // Yakıt Barı
    const fuelRatio = Phaser.Math.Clamp(this.currentFuel / this.fuelCapacity, 0, 1);
    const fuelFillW = Math.max(0, Math.floor((barW - 4) * fuelRatio));
    if (fuelFillW > 2) {
      this.fuelBarFill.setVisible(true);
      this.fuelBarFill.setPosition(this.fuelBarSlot.x + 2, this.fuelBarSlot.y);
      this.fuelBarFill.setSize(fuelFillW, 6);
    } else {
      this.fuelBarFill.setVisible(false);
    }

    // Nitro Barı
    const boostRatio = Phaser.Math.Clamp(this.currentBoost / this.boostCapacity, 0, 1);
    const boostFillW = Math.max(0, Math.floor((barW - 4) * boostRatio));
    if (boostFillW > 2) {
      this.boostBarFill.setVisible(true);
      this.boostBarFill.setPosition(this.boostBarSlot.x + 2, this.boostBarSlot.y);
      this.boostBarFill.setSize(boostFillW, 6);
    } else {
      this.boostBarFill.setVisible(false);
    }
  }

  /* ================================================================
   * HER KARE GÜNCELLEME (UPDATE) & FİZİK MOTORU
   * ================================================================ */

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    if (this.flightState === 'countdown') {
      this.economy.tick(dt);
      return;
    }

    if (this.flightState === 'flying') {
      this.handleFlightInput(dt);
      this.updateFlightPhysics(dt);
      this.updateParallaxAndCamera(dt);
      this.updateObstacles(dt);
      this.updateCollectibles(dt);
      this.checkCollisions();
    } else if (this.flightState === 'landed') {
      // Zeminde kayma / yavaşlama
      this.updateSkidding(dt);
      this.updateParallaxAndCamera(dt);
    }

    this.refreshHUD();
    this.economy.tick(dt);
  }

  private handleFlightInput(dt: number): void {
    const pitchUp = (this.cursors?.left?.isDown || this.keyA?.isDown || this.touchPitchUp);
    const pitchDown = (this.cursors?.right?.isDown || this.keyD?.isDown || this.cursors?.down?.isDown || this.keyS?.isDown || this.touchPitchDown);
    const thrust = (this.keySpace?.isDown || this.keyW?.isDown || this.cursors?.up?.isDown || this.touchThrust);
    const boost = (this.keyShift?.isDown || this.touchBoost);

    // 1. Eğim Kontrolü (Pitch Angle)
    if (pitchUp) {
      this.currentAngle -= this.steerAgility * dt;
    }
    if (pitchDown) {
      this.currentAngle += this.steerAgility * dt;
    }

    // Açı sınırlandırması (-75° dik tırmanış ile +75° dik dalış)
    this.currentAngle = Phaser.Math.Clamp(this.currentAngle, -Phaser.Math.DegToRad(75), Phaser.Math.DegToRad(75));

    // Aerodinamik yönelim: Hız varken veya düşüşe geçtiğinde burun doğal olarak düşer / uçuş yönüne döner
    if (!pitchUp && !pitchDown) {
      const flightPathAngle = Math.atan2(this.vy, Math.max(15, this.vx));
      this.currentAngle = Phaser.Math.Angle.RotateTo(this.currentAngle, flightPathAngle, 1.2 * dt);
    }

    // 2. Ana Motor İtişi (Thrust)
    if (thrust && this.currentFuel > 0) {
      this.isThrusting = true;
      this.currentFuel = Math.max(0, this.currentFuel - dt);

      const ax = Math.cos(this.currentAngle) * this.mainThrust;
      const ay = Math.sin(this.currentAngle) * this.mainThrust;
      this.vx += ax * dt;
      this.vy += ay * dt;
    } else {
      this.isThrusting = false;
    }

    // 3. Süpersonik Boost (Nitro)
    if (boost && this.currentBoost > 0) {
      this.isBoosting = true;
      this.currentBoost = Math.max(0, this.currentBoost - dt);

      const boostThrust = this.mainThrust * BOOST_SPEED_MULTIPLIER;
      const bx = Math.cos(this.currentAngle) * boostThrust;
      const by = Math.sin(this.currentAngle) * boostThrust;
      this.vx += bx * dt;
      this.vy += by * dt;

      if (Math.random() < 0.25) {
        this.cameras.main.shake(50, 0.003);
      }
    } else {
      this.isBoosting = false;
    }

    // 4. Alev ve Egzoz Görseli
    if (this.isBoosting) {
      this.flameSprite.setVisible(true);
      if (this.textures.exists('flame_boost')) this.flameSprite.setTexture('flame_boost');
      this.flameSprite.setScale(2.2, 1.8);
    } else if (this.isThrusting) {
      this.flameSprite.setVisible(true);
      if (this.textures.exists('flame_idle')) this.flameSprite.setTexture('flame_idle');
      this.flameSprite.setScale(1.7, 1.3);
    } else {
      this.flameSprite.setVisible(false);
    }
  }

  private updateFlightPhysics(dt: number): void {
    const GRAVITY = 420; // px/s² — belirgin, tatmin edici yer çekimi ivmesi (kullanıcı isteği: daha kolay düşmeli)

    // 1. Yer Çekimi her karede aşağı doğru çeker
    this.vy += GRAVITY * dt;

    // 2. Aerodinamik Kaldırma Kuvveti (Lift - Kanat Seviyesine Bağlı)
    const aoa = -this.currentAngle; // Burun yukarı açısı
    if (this.vx > 25 && aoa > 0 && aoa < Phaser.Math.DegToRad(28)) {
      // Yalnızca 0° - 28° arası dar hücum açısında süzülme lift üretir (asla yer çekimini yenip sonsuz yükselemez)
      const maxGlideLift = GRAVITY * 0.65;
      const glideLift = this.vx * Math.sin(aoa * 2) * this.liftCoeff;
      const lift = Math.min(maxGlideLift, glideLift);
      this.vy -= lift * dt;
    }

    // 3. Yukarı Tırmanırken Yer Çekimi Hızı Azaltır (Climb Energy Loss & Stall)
    if (aoa > 0) {
      // Burnu yukarı kaldırdıkça yer çekimi ileri hızı hızla tüketir
      this.vx -= (GRAVITY * Math.sin(aoa) * 0.75) * dt;
      // Dik burun açısında (30° üstü) kanat tutunma kaybı (Stall) ve frenleme
      if (aoa >= Phaser.Math.DegToRad(30)) {
        this.vx -= 130 * dt;
      }
    }

    // 4. Standart Hava Direnci (Drag)
    const dragCoeff = 0.00035 / (1 + this.wingsLevel * 0.18);
    this.vx -= (this.vx * Math.abs(this.vx) * dragCoeff) * dt;

    // Minimum ileri hız 0
    this.vx = Math.max(0, this.vx);

    // 5. İrtifa ve Mesafe Entegrasyonu
    this.altitude = Math.max(0, this.altitude - this.vy * dt);
    const distDelta = (this.vx * dt) * 0.1;
    this.distance += distDelta;
    this.flightDuration += dt;

    const currentSpeedKmH = Math.round(Math.sqrt(this.vx * this.vx + this.vy * this.vy) * 0.7);
    this.maxSpeed = Math.max(this.maxSpeed, currentSpeedKmH);
    this.maxAltitude = Math.max(this.maxAltitude, Math.round(this.altitude * 0.25));

    // Mesafe skoru
    this.flightScore += Math.round(distDelta * 1.8);

    // 6. Stall & Burun Düşmesi (İtiş yokken hız bittiğinde veya alçalırken burun yer çekimiyle aşağı döner)
    if (!this.isThrusting && !this.isBoosting && (this.vx < 60 || this.vy > 40)) {
      const naturalFallAngle = Math.atan2(this.vy, Math.max(15, this.vx));
      this.currentAngle = Phaser.Math.Angle.RotateTo(this.currentAngle, naturalFallAngle, 1.4 * dt);
    }

    // 5. Zemin Çarpışması / İniş Kontrolü
    if (this.altitude <= 0) {
      this.handleGroundImpact(dt);
    }

    // Roket rotasyonu
    this.rocketContainer.rotation = this.currentAngle;

    // Yanıp sönme (hasar dokunulmazlığı)
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      this.rocketContainer.setAlpha(Math.sin(this.invulnerableTimer * 30) > 0 ? 0.35 : 1.0);
    } else {
      this.rocketContainer.setAlpha(1.0);
    }
  }

  /** Zemin teması, sekme veya yere çakılma */
  private handleGroundImpact(_dt: number): void {
    this.altitude = 0;
    const downSpeed = this.vy;

    // Sert Çarpma (Yüksek dikey hız)
    if (downSpeed > 140) {
      const baseDamage = Math.round((downSpeed - 70) * 0.45);
      const damage = Math.max(12, Math.round(baseDamage / (1 + this.hullLevel * 0.35)));
      this.currentHP -= damage;

      this.cameras.main.shake(250, 0.012);
      this.spawnExplosionSparks(this.rocketScreenX, this.rocketScreenY + 15);

      if (this.currentHP > 0) {
        // GÖVDE DAYANDI: SEKME (Bounce)
        this.vy = -downSpeed * this.groundBounce;
        this.vx *= 0.65;
        this.altitude = 4;
        this.currentAngle = -Phaser.Math.DegToRad(15);
        this.showFloatingNotice(this.rocketScreenX, this.rocketScreenY - 20, `💥 SEKME! -${damage} HP`, '#e74c3c');
      } else {
        // GÖVDE PARÇALANDI: YERE ÇAKILDI
        this.currentHP = 0;
        this.endFlight(true, 'Yere Çakıldı');
      }
    } else {
      // Yumuşak temas: ZEMİNDE KAYMA VE İNİŞ (Skid)
      this.flightState = 'landed';
      this.vy = 0;
      this.currentAngle = 0;
      this.flameSprite.setVisible(false);
      this.showFloatingNotice(this.rocketScreenX, this.rocketScreenY - 20, '🛬 ZEMİNE İNDİ (Kayıyor)', '#2ecc71');
    }
  }

  /** Zeminde kayma fazı */
  private updateSkidding(dt: number): void {
    const FRICTION = 220; // px/s² zemin sürtünmesi
    this.vx = Math.max(0, this.vx - FRICTION * dt);
    this.distance += (this.vx * dt) * 0.1;
    this.currentAngle = Phaser.Math.Linear(this.currentAngle, 0, 0.2);

    // Sürtünme tozu - piksel raster sprite
    if (this.vx > 20 && Math.random() < 0.4) {
      const p = this.add.image(this.rocketScreenX - 20, this.rocketScreenY + 12, 'star_pixel')
        .setDepth(18)
        .setScale(0.6)
        .setAlpha(0.65)
        .setTint(0xb2bec3);
      this.tweens.add({
        targets: p,
        x: p.x - 22,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 280,
        onComplete: () => p.destroy(),
      });
    }

    if (this.vx <= 8) {
      this.vx = 0;
      this.endFlight(false, 'Başarılı İniş');
    }
  }

  /* ================================================================
   * PARALLAX, KAMERA VE YÜKSEKLİK İLLÜZYONU
   * ================================================================ */

  private updateParallaxAndCamera(dt: number): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const groundH = 45;
    const baseGroundY = h - groundH;

    // Roket ekran konumu: Yükseklik arttıkça kamera roketi takip eder
    const maxVisibleAlt = h * 0.55;
    if (this.altitude < maxVisibleAlt) {
      this.rocketScreenY = baseGroundY - this.altitude;
      this.groundTileSprite.y = baseGroundY;
      if (this.launchPlatform) this.launchPlatform.y = baseGroundY;
      if (this.launchGantry) this.launchGantry.y = baseGroundY - 5;
    } else {
      // Yüksek irtifada roket ekranın ortasında kalır, zemin aşağı kayar
      this.rocketScreenY = baseGroundY - maxVisibleAlt;
      const cameraOffsetY = this.altitude - maxVisibleAlt;
      this.groundTileSprite.y = baseGroundY + cameraOffsetY;
      if (this.launchPlatform) this.launchPlatform.y = baseGroundY + cameraOffsetY;
      if (this.launchGantry) this.launchGantry.y = baseGroundY - 5 + cameraOffsetY;
    }

    this.rocketContainer.setPosition(this.rocketScreenX, this.rocketScreenY);

    // Yatay Parallaks
    const speed = this.vx;

    // Fırlatma platformunu geride bırak
    if (this.launchPlatform) {
      this.launchPlatform.x -= speed * dt;
      if (this.launchPlatform.x < -160) {
        this.launchPlatform.destroy();
        this.launchPlatform = null;
      }
    }
    if (this.launchGantry) {
      this.launchGantry.x -= speed * dt;
      if (this.launchGantry.x < -160) {
        this.launchGantry.destroy();
        this.launchGantry = null;
      }
    }

    // Yıldızlar
    for (const s of this.stars) {
      s.sprite.x -= speed * s.speed * dt;
      if (s.sprite.x < -10) {
        s.sprite.x = w + Phaser.Math.Between(10, 40);
        s.sprite.y = Phaser.Math.Between(10, h * 0.8);
      }
    }

    // Dağlar
    for (const m of this.mountains) {
      m.sprite.x -= speed * m.speed * dt;
      if (m.sprite.x < -160) {
        m.sprite.x += (this.mountains.length * 140);
      }
    }

    // Bulutlar
    for (const c of this.clouds) {
      c.sprite.x -= speed * c.speed * dt;
      if (c.sprite.x < -80) {
        c.sprite.x = w + Phaser.Math.Between(20, 80);
        c.sprite.y = Phaser.Math.Between(60, h * 0.7);
      }
    }

    // Zemin tile kaydırma
    this.groundTileSprite.tilePositionX += speed * dt;
  }

  /* ================================================================
   * ENGELLER VE KAÇINMA (DODGE)
   * ================================================================ */

  private updateObstacles(dt: number): void {
    const w = this.scale.width;
    const h = this.scale.height;

    // Engel üretimi (Yalnızca havada iken)
    if (this.altitude > 40) {
      this.obstacleSpawnTimer += dt;
      const interval = Phaser.Math.Clamp(2.0 - (this.distance / 2500), 0.8, 2.0);

      if (this.obstacleSpawnTimer >= interval) {
        this.obstacleSpawnTimer = 0;
        this.spawnObstacle(w, h);
      }
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= (this.vx * obs.speedMultiplier + 40) * dt;
      obs.sprite.setPosition(obs.x, obs.y);
      obs.sprite.rotation += dt * 0.9;

      // Kaçınma kontrolü
      if (!obs.hasCollided && !obs.hasBeenDodged && obs.x < this.rocketScreenX - 35) {
        obs.hasBeenDodged = true;
        this.dodgedObstacles++;
        this.flightScore += 20;
        this.showFloatingNotice(obs.x, obs.y - 15, '✨ KAÇILDI!', '#2ecc71');
      }

      if (obs.x < -60) {
        obs.sprite.destroy();
        this.obstacles.splice(i, 1);
      }
    }
  }

  private spawnObstacle(w: number, h: number): void {
    const types = ['obstacle_asteroid', 'obstacle_drone', 'obstacle_debris'];
    const type = Phaser.Utils.Array.GetRandom(types);

    const spawnY = Phaser.Math.Between(75, h - 85);
    const sprite = this.add.image(w + 40, spawnY, type).setDepth(15).setScale(1.7);

    this.obstacles.push({
      sprite,
      x: w + 40,
      y: spawnY,
      width: 30,
      height: 30,
      radius: 16,
      speedMultiplier: Phaser.Math.FloatBetween(0.85, 1.25),
      hasCollided: false,
      hasBeenDodged: false,
      type,
    });
  }

  /* ================================================================
   * TOPLANABİLİR PARÇALAR (DİŞLİ, YAKIT/KRİSTAL, TAMİR)
   * ================================================================ */

  private updateCollectibles(dt: number): void {
    const w = this.scale.width;
    const h = this.scale.height;

    this.collectibleSpawnTimer += dt;
    if (this.collectibleSpawnTimer >= 1.4) {
      this.collectibleSpawnTimer = 0;
      this.spawnCollectible(w, h);
    }

    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const col = this.collectibles[i];
      col.x -= (this.vx * 0.9 + 20) * dt;

      // Manyetik çekim
      const dist = Phaser.Math.Distance.Between(this.rocketScreenX, this.rocketScreenY, col.x, col.y);
      if (dist < 75) {
        col.x += (this.rocketScreenX - col.x) * dt * 4.5;
        col.y += (this.rocketScreenY - col.y) * dt * 4.5;
      }

      col.sprite.setPosition(col.x, col.y);

      if (dist < 26 && !col.isCollected) {
        col.isCollected = true;
        this.collectItem(col);
        col.sprite.destroy();
        this.collectibles.splice(i, 1);
        continue;
      }

      if (col.x < -40) {
        col.sprite.destroy();
        this.collectibles.splice(i, 1);
      }
    }
  }

  private spawnCollectible(w: number, h: number): void {
    const rand = Math.random();
    let type: 'gear' | 'crystal' | 'repair' = 'gear';
    let key = 'pickup_gear';

    if (rand < 0.55) {
      type = 'gear';
      key = 'pickup_gear';
    } else if (rand < 0.88) {
      type = 'crystal';
      key = 'pickup_crystal';
    } else {
      type = 'repair';
      key = 'pickup_repair';
    }

    const spawnY = Phaser.Math.Between(80, h - 85);
    const sprite = this.add.image(w + 30, spawnY, key).setDepth(14).setScale(1.7);

    this.tweens.add({
      targets: sprite,
      y: spawnY + 5,
      duration: 500,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.collectibles.push({
      sprite,
      x: w + 30,
      y: spawnY,
      radius: 14,
      type,
      value: 1,
      isCollected: false,
    });
  }

  private collectItem(item: CollectibleEntity): void {
    if (item.type === 'gear') {
      this.collectedGears++;
      this.flightScore += 30;
      this.showFloatingNotice(this.rocketScreenX, this.rocketScreenY - 20, `+${PART_PICKUP_VALUE} ⚙`, '#f1c40f');
    } else if (item.type === 'crystal') {
      this.collectedCrystals++;
      this.flightScore += 65;
      // Hem motor yakıtını hem de nitroyu doldurur!
      this.currentFuel = Math.min(this.fuelCapacity, this.currentFuel + this.fuelCapacity * 0.25);
      this.currentBoost = Math.min(this.boostCapacity, this.currentBoost + this.boostCapacity * 0.35);
      this.showFloatingNotice(this.rocketScreenX, this.rocketScreenY - 20, '⚡ YAKIT & NİTRO +%', '#00d2d3');
    } else if (item.type === 'repair') {
      this.currentHP = Math.min(this.maxHP, this.currentHP + 35);
      this.showFloatingNotice(this.rocketScreenX, this.rocketScreenY - 20, '+35 HP', '#2ecc71');
    }

    // Işıltı parçacıkları - piksel raster sprite
    for (let i = 0; i < 6; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const key = i % 2 === 0 ? 'star_pixel' : 'pickup_gear';
      const p = this.add.image(this.rocketScreenX, this.rocketScreenY, key)
        .setDepth(30)
        .setScale(0.8)
        .setTint(0xffd166);
      this.tweens.add({
        targets: p,
        x: p.x + Math.cos(angle) * 22,
        y: p.y + Math.sin(angle) * 22,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 240,
        onComplete: () => p.destroy(),
      });
    }
  }

  /* ================================================================
   * ENGEL ÇARPIŞMALARI
   * ================================================================ */

  private checkCollisions(): void {
    if (this.invulnerableTimer > 0) return;

    for (const obs of this.obstacles) {
      if (obs.hasCollided) continue;

      const dist = Phaser.Math.Distance.Between(this.rocketScreenX, this.rocketScreenY, obs.x, obs.y);
      if (dist < (obs.radius + 14)) {
        obs.hasCollided = true;
        this.takeObstacleDamage(25);
        this.spawnExplosionSparks(obs.x, obs.y);
        break;
      }
    }
  }

  private takeObstacleDamage(amount: number): void {
    const damage = Math.max(10, Math.round(amount / (1 + this.hullLevel * 0.3)));
    this.currentHP -= damage;
    this.invulnerableTimer = 0.8;

    this.cameras.main.shake(200, 0.008);
    this.cameras.main.flash(120, 255, 0, 0);

    if (this.currentHP <= 0) {
      this.currentHP = 0;
      this.endFlight(true, 'Havada Engele Çarptı');
    }
  }

  private spawnExplosionSparks(x: number, y: number): void {
    // Çarpışma kıvılcımı — önce hit_spark spritesheet animasyonu
    if (this.anims.exists('hit_spark_anim')) {
      const fx = this.add.sprite(x, y, 'hit_spark', 0)
        .setDepth(40)
        .setScale(1.4);
      fx.play('hit_spark_anim');
      fx.on('animationcomplete', () => fx.destroy());
    }

    // Ek kıvılcım partikülleri - raster piksel sprite
    for (let i = 0; i < 10; i++) {
      const angle = Phaser.Math.FloatBetween(0, Math.PI * 2);
      const dist = Phaser.Math.Between(18, 46);
      const key = i % 2 === 0 ? 'star_pixel' : 'pickup_gear';
      const spark = this.add.image(x, y, key)
        .setDepth(40)
        .setScale(0.7)
        .setTint(0xff4757);
      this.tweens.add({
        targets: spark,
        x: x + Math.cos(angle) * dist,
        y: y + Math.sin(angle) * dist,
        alpha: 0,
        scaleX: 0.1,
        scaleY: 0.1,
        duration: 320,
        onComplete: () => spark.destroy(),
      });
    }
  }

  private showFloatingNotice(x: number, y: number, text: string, color: string): void {
    const t = this.add.text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontSize: '13px',
      color,
      fontStyle: 'bold',
      stroke: '#0c1020',
      strokeThickness: 3,
    }).setOrigin(0.5).setDepth(60);

    this.tweens.add({
      targets: t,
      y: y - 25,
      alpha: 0,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => t.destroy(),
    });
  }

  /* ================================================================
   * HUD YENİLEME
   * ================================================================ */

  private refreshHUD(): void {
    this.distText.setText(`📏 Mesafe: ${Math.floor(this.distance)} m`);
    this.altText.setText(`☁ İrtifa: ${Math.round(this.altitude * 0.25)} m`);

    const currentSpeed = Math.round(Math.sqrt(this.vx * this.vx + this.vy * this.vy) * 0.7);
    this.speedText.setText(`⚡ Hız: ${currentSpeed} km/s`);

    const totalEarned = this.calculateTotalEarnedResources();
    this.earnedText.setText(`+${formatNumber(totalEarned)} ${RESOURCE_NAME}`);
    this.scoreText.setText(`⭐ Skor: ${this.flightScore}`);

    this.refreshBars();
  }

  private calculateTotalEarnedResources(): number {
    const distGains = Math.floor((this.distance / 10) * DISTANCE_RESOURCE_RATE);
    const altGains = Math.floor(this.maxAltitude * 0.4);
    const gearGains = this.collectedGears * PART_PICKUP_VALUE;
    const crystalGains = this.collectedCrystals * CRYSTAL_PICKUP_VALUE;
    const dodgeGains = this.dodgedObstacles * DODGE_BONUS_VALUE;
    return distGains + altGains + gearGains + crystalGains + dodgeGains;
  }

  /* ================================================================
   * UÇUŞ SONU VE DETAYLI RAPOR PANELİ
   * ================================================================ */

  private endFlight(isCrash: boolean, reasonText: string): void {
    // Sadece bir kez çalışsın: crashed veya finished state'inde tekrar çalışma
    if (this.flightState === 'crashed' || this.flightState === 'finished') return;
    this.flightState = isCrash ? 'crashed' : 'finished';

    if (isCrash) {
      this.spawnExplosionSparks(this.rocketScreenX, this.rocketScreenY);
      this.rocketContainer.setVisible(false);
    }

    const totalResources = this.calculateTotalEarnedResources();

    this.time.delayedCall(450, () => {
      this.showFlightReport(isCrash, reasonText, totalResources);
    });
  }

  private createReportPanel(w: number, h: number): void {
    this.reportContainer = this.add.container(w / 2, h / 2).setDepth(200).setVisible(false);
  }

  private showFlightReport(isCrash: boolean, reasonText: string, totalResources: number): void {
    const w = this.scale.width;
    const h = this.scale.height;

    this.reportContainer.setPosition(w / 2, h / 2);
    this.reportContainer.removeAll(true);
    this.reportContainer.setVisible(true);

    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    const panelW = Math.min(380, w - 24);
    const panelH = 340;

    const bgModal = PixelUIHelper.createModal(this, 0, 0, panelW, panelH);
    this.reportContainer.add(bgModal);

    // Başlık
    const titleText = this.add.text(
      0,
      -panelH / 2 + 26,
      isCrash ? `💥 ${reasonText.toUpperCase()}` : '🏆 BAŞARILI UÇUŞ VE İNİŞ!',
      { ...font, fontSize: '15px', color: isCrash ? PALETTE.dangerRedHex : PALETTE.resourceGoldHex, fontStyle: 'bold' },
    ).setOrigin(0.5);
    this.reportContainer.add(titleText);

    // İstatistik Verileri
    const items = [
      { label: '📏 Ulaşılan Mesafe:', val: `${Math.floor(this.distance)} m` },
      { label: '⏱ Havada Kalma Süresi:', val: `${this.flightDuration.toFixed(1)} sn` },
      { label: '☁ Maksimum İrtifa:', val: `${this.maxAltitude} m` },
      { label: '⚡ Maksimum Hız:', val: `${this.maxSpeed} km/s` },
      { label: '⚙ Toplanan Parçalar:', val: `${this.collectedGears} adet` },
      { label: '💎 Enerji Kristalleri:', val: `${this.collectedCrystals} adet` },
      { label: '⭐ Toplam Uçuş Skoru:', val: `${this.flightScore} puan` },
    ];

    let rowY = -panelH / 2 + 58;
    for (const item of items) {
      const lbl = this.add.text(-panelW / 2 + 22, rowY, item.label, {
        ...font, fontSize: '11.5px', color: PALETTE.textMuted,
      }).setOrigin(0, 0.5);

      const val = this.add.text(panelW / 2 - 22, rowY, item.val, {
        ...font, fontSize: '11.5px', color: PALETTE.textPrimary, fontStyle: 'bold',
      }).setOrigin(1, 0.5);

      this.reportContainer.add(lbl);
      this.reportContainer.add(val);
      rowY += 23;
    }

    // Toplam Kazanım Kartı
    const gainBoxY = rowY + 12;
    const gainBox = PixelUIHelper.createCard(this, 0, gainBoxY, panelW - 36, 36).setOrigin(0.5, 0.5);
    this.reportContainer.add(gainBox);

    const gainText = this.add.text(
      0,
      gainBoxY,
      `+${formatNumber(totalResources)} ${RESOURCE_NAME} KAZANILDI!`,
      { ...font, fontSize: '13.5px', color: PALETTE.successGreenHex, fontStyle: 'bold' },
    ).setOrigin(0.5);
    this.reportContainer.add(gainText);

    // Fabrikaya Dön Butonu
    const btnY = panelH / 2 - 28;
    const btnW = panelW - 50;
    const btnH = 40;

    const returnBtn = PixelUIHelper.createButton(this, 0, btnY, btnW, btnH, 'manual');
    this.reportContainer.add(returnBtn);

    const btnText = this.add.text(0, btnY, '🏭 FABRİKAYA DÖN (Geliştirme Yap)', {
      ...font, fontSize: '12.5px', color: '#1f1003', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.reportContainer.add(btnText);

    const returnZone = this.add.zone(0, btnY, btnW, btnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        returnBtn.setTexture('btn_manual_pressed');
        this.returnToFactory(totalResources);
      })
      .on('pointerover', () => {
        returnBtn.setTexture('btn_manual_hover');
      })
      .on('pointerout', () => {
        returnBtn.setTexture('btn_manual_normal');
      });
    this.reportContainer.add(returnZone);

    this.reportContainer.setScale(0.85);
    this.tweens.add({
      targets: this.reportContainer,
      scaleX: 1, scaleY: 1,
      duration: 180,
      ease: 'Back.easeOut',
    });
  }

  private returnToFactory(totalResources: number): void {
    this.economy.recordFlightResult(
      Math.floor(this.distance),
      this.flightScore,
      totalResources,
    );

    this.scene.stop('FlightScene');
    this.scene.resume('GameScene');

    const gameScene = this.scene.get('GameScene') as any;
    if (gameScene && typeof gameScene.onReturnFromFlight === 'function') {
      gameScene.onReturnFromFlight(totalResources, Math.floor(this.distance));
    }
  }

  private handleResize(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.updateHUDLayout();
    this.createTouchButtons(w, h);
  }
}
