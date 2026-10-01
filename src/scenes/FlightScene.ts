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

  /* Fırlatma Güç Göstergesi (Rampa Mini-Oyunu) */
  private launchMeterContainer!: Phaser.GameObjects.Container;
  private launchBarSlot!: Phaser.GameObjects.NineSlice;
  private launchBarFill!: Phaser.GameObjects.NineSlice;
  private launchPowerText!: Phaser.GameObjects.Text;
  private launchPowerTimer = 0;
  private currentLaunchPower = 0.5;
  private isLaunchLocked = false;

  /* Ortalanmış Nitro Butonu & İç Barı */
  private nitroBtnContainer!: Phaser.GameObjects.Container;
  private nitroBtnBg!: Phaser.GameObjects.NineSlice;
  private nitroBarFill!: Phaser.GameObjects.NineSlice;
  private nitroBtnText!: Phaser.GameObjects.Text;
  private nitroBtnSubtext!: Phaser.GameObjects.Text;
  private pointerHoldingBoost = false;

  /* Kontroller */
  private keySpace!: Phaser.Input.Keyboard.Key;

  /* Uçuş Sonu Raporu */
  private reportContainer!: Phaser.GameObjects.Container;

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

    // 4. Roket Nesnesi (Başlangıçta rampada dikeyden 30° açılı: -60° yükseliş açısı)
    this.rocketScreenX = rampX + 16;
    this.rocketScreenY = rampY - 26;
    this.currentAngle = -Phaser.Math.DegToRad(60);
    this.createRocket();

    // 5. HUD ve Ortalanmış Nitro Butonu
    this.createHUD();

    // 6. Kontroller (SPACE, Sol Tık & Tüm Ekran Dokunmatik)
    this.setupControls(w, h);

    // 7. Uçuş Sonu Rapor Paneli
    this.createReportPanel(w, h);

    // 8. Fırlatma Rampası Güç Barı Mini-Oyunu
    this.createLaunchMeter(w, h);

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

    const engineKey = `rocket_engine_${Math.min(3, Math.max(1, this.engineLevel))}`;
    this.engineSprite = this.add.image(-16, 0, engineKey).setOrigin(0.5).setScale(1.8);
    this.rocketContainer.add(this.engineSprite);

    const tankKey = `rocket_tank_${Math.min(3, Math.max(1, this.boostLevel))}`;
    this.tankSprite = this.add.image(-4, 0, tankKey).setOrigin(0.5).setScale(1.8);
    this.rocketContainer.add(this.tankSprite);

    const wingsKey = `rocket_wings_${Math.min(3, Math.max(1, this.wingsLevel))}`;
    this.wingsSprite = this.add.image(-8, 0, wingsKey).setOrigin(0.5).setScale(1.8);
    this.rocketContainer.add(this.wingsSprite);

    const hullKey = `rocket_hull_${Math.min(3, Math.max(1, this.hullLevel))}`;
    this.hullSprite = this.add.image(4, 0, hullKey).setOrigin(0.5).setScale(1.8);
    this.rocketContainer.add(this.hullSprite);
  }

  /* ================================================================
   * FIRLATMA RAMPASI GÜÇ BARI MİNİ-OYUNU
   * ================================================================ */

  private createLaunchMeter(w: number, h: number): void {
    this.launchMeterContainer = this.add.container(w / 2, h * 0.44).setDepth(150);

    const cardW = 260;
    const cardH = 105;

    const bgCard = PixelUIHelper.createCard(this, 0, 0, cardW, cardH).setOrigin(0.5);
    this.launchMeterContainer.add(bgCard);

    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    const title = this.add.text(0, -32, '🚀 FIRLATMA GÜCÜ', {
      ...font, fontSize: '13px', color: PALETTE.resourceGoldHex, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.launchMeterContainer.add(title);

    // Bar Yuvası
    const slotW = 200;
    const slotH = 18;
    this.launchBarSlot = this.add.nineslice(0, -6, 'ui_bar_slot', 0, slotW, slotH, 4, 4, 4, 4)
      .setOrigin(0.5);
    this.launchMeterContainer.add(this.launchBarSlot);

    // Bar Dolgusu
    this.launchBarFill = this.add.nineslice(-slotW / 2 + 2, -6, 'ui_bar_fill_gold', 0, 10, slotH - 4, 2, 2, 2, 2)
      .setOrigin(0, 0.5);
    this.launchMeterContainer.add(this.launchBarFill);

    // Yüzde Metni
    this.launchPowerText = this.add.text(0, -6, '%50', {
      ...font, fontSize: '10px', color: '#ffffff', fontStyle: 'bold', stroke: '#0a0d1a', strokeThickness: 3,
    }).setOrigin(0.5);
    this.launchMeterContainer.add(this.launchPowerText);

    // Ateşle Butonu & Talimatı
    const btnW = 200;
    const btnH = 28;
    const btnBg = PixelUIHelper.createButton(this, 0, 26, btnW, btnH, 'green');
    this.launchMeterContainer.add(btnBg);

    const btnText = this.add.text(0, 26, '🔥 ATEŞLE! (TIKLA / SPACE)', {
      ...font, fontSize: '11px', color: PALETTE.btnAffordableText, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.launchMeterContainer.add(btnText);

    const zone = this.add.zone(0, 0, cardW + 20, cardH + 20)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.triggerLaunchFromMeter());
    this.launchMeterContainer.add(zone);

    this.launchPowerTimer = 0;
    this.isLaunchLocked = false;
  }

  private triggerLaunchFromMeter(): void {
    if (this.isLaunchLocked || this.flightState !== 'countdown') return;
    this.isLaunchLocked = true;

    // Minimum %25, maksimum %100 güç
    const powerRatio = Phaser.Math.Clamp(this.currentLaunchPower, 0.25, 1.0);
    this.launchVelocity = getLaunchVelocity(this.engineLevel) * (0.45 + 0.55 * powerRatio);

    const w = this.scale.width;
    const h = this.scale.height;
    const percent = Math.round(powerRatio * 100);

    if (powerRatio >= 0.88) {
      this.showFloatingNotice(w / 2, h * 0.44 - 68, `⭐ MÜKEMMEL FIRLATMA! %${percent}`, '#f1c40f');
    } else if (powerRatio >= 0.60) {
      this.showFloatingNotice(w / 2, h * 0.44 - 68, `👍 İYİ FIRLATMA! %${percent}`, '#2ecc71');
    } else {
      this.showFloatingNotice(w / 2, h * 0.44 - 68, `⚠️ ORTA FIRLATMA! %${percent}`, '#e67e22');
    }

    this.tweens.add({
      targets: this.launchMeterContainer,
      alpha: 0,
      scaleX: 0.8,
      scaleY: 0.8,
      duration: 180,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.launchMeterContainer.setVisible(false);
      },
    });

    this.blastOff();
  }

  /** İlk fırlatma ivmesi */
  private blastOff(): void {
    this.flightState = 'flying';
    this.flameSprite.setVisible(true);
    if (this.textures.exists('flame_idle')) {
      this.flameSprite.setTexture('flame_idle');
    }

    // Kullanıcı İsteği: Dikeyden 30 derece açıyla (-60° yükseliş açısı) fırlatma
    const launchAngle = -Phaser.Math.DegToRad(60);
    this.currentAngle = launchAngle;
    this.rocketContainer.rotation = launchAngle;

    this.altitude = 5;
    this.vx = Math.cos(launchAngle) * this.launchVelocity;
    this.vy = Math.sin(launchAngle) * this.launchVelocity;

    this.spawnLaunchPuff(this.rocketScreenX - 25, this.rocketScreenY + 20);
    this.cameras.main.shake(300, 0.008);
  }

  private spawnLaunchPuff(x: number, y: number): void {
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
   * KONTROLLER (SPACE, FARE SOL TIK VE TÜM EKRAN DOKUNMATİK)
   * ================================================================ */

  private setupControls(_w: number, _h: number): void {
    // 1. Klavye: SPACE tuşu
    if (this.input.keyboard) {
      this.keySpace = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
      this.input.keyboard.on('keydown-SPACE', () => {
        if (this.flightState === 'countdown') {
          this.triggerLaunchFromMeter();
        }
      });
    }

    // 2. Fare Sol Tık ve Dokunmatik: Tüm ekranı kapsayan dokunmatik kontrol
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (pointer.button !== 0 && pointer.button !== undefined) return;
      if (this.flightState === 'countdown') {
        this.triggerLaunchFromMeter();
      } else if (this.flightState === 'flying') {
        this.pointerHoldingBoost = true;
      }
    });

    this.input.on('pointerup', () => {
      this.pointerHoldingBoost = false;
    });
  }

  /* ================================================================
   * HUD VE ORTALANMIŞ NİTRO BUTONU
   * ================================================================ */

  private createHUD(): void {
    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    const w = this.scale.width;
    const h = this.scale.height;

    this.hudBgSlice = PixelUIHelper.createPanel(this, 0, 0, w, 52).setDepth(80);

    // Sol: Mesafe, İrtifa, Hız
    this.distText = this.add.text(16, 10, '📏 Mesafe: 0 m', {
      ...font, fontSize: '12px', color: PALETTE.textPrimary, fontStyle: 'bold',
    }).setDepth(82);

    this.altText = this.add.text(16, 26, '☁ İrtifa: 0 m', {
      ...font, fontSize: '11px', color: PALETTE.rocketCyanHex, fontStyle: 'bold',
    }).setDepth(82);

    this.speedText = this.add.text(150, 10, '⚡ Hız: 0 km/s', {
      ...font, fontSize: '11px', color: PALETTE.resourceGoldHex, fontStyle: 'bold',
    }).setDepth(82);

    // Orta: Kazanılan Kaynak ve Skor
    this.earnedText = this.add.text(w / 2, 12, `+0 ${RESOURCE_NAME}`, {
      ...font, fontSize: '15px', color: PALETTE.successGreenHex, fontStyle: 'bold',
    }).setDepth(82).setOrigin(0.5, 0);

    this.scoreText = this.add.text(w / 2, 31, '⭐ Skor: 0', {
      ...font, fontSize: '11px', color: PALETTE.resourceGoldHex, fontStyle: 'bold',
    }).setDepth(82).setOrigin(0.5, 0);

    // Altın sikke ikonu
    if (this.textures.exists('coin_gold')) {
      this.coinSprite = this.add.sprite(0, 0, 'coin_gold', 0).setScale(1.6).setDepth(82);
      if (this.anims.exists('coin_gold_spin')) {
        this.coinSprite.play('coin_gold_spin');
      }
    }

    // Ortalanmış Nitro Butonu & İç Barı
    this.createNitroButton(w, h);

    this.updateHUDLayout();
  }

  private createNitroButton(w: number, h: number): void {
    const btnW = 200;
    const btnH = 46;

    this.nitroBtnContainer = this.add.container(w / 2, h - 45).setDepth(110);

    this.nitroBtnBg = PixelUIHelper.createButton(this, 0, 0, btnW, btnH, 'launch');
    this.nitroBtnContainer.add(this.nitroBtnBg);

    // Butonun içine entegre nitro dolum barı
    const maxFillW = btnW - 8;
    this.nitroBarFill = this.add.nineslice(-btnW / 2 + 4, 0, 'ui_bar_fill_cyan', 0, maxFillW, btnH - 8, 3, 3, 3, 3)
      .setOrigin(0, 0.5)
      .setAlpha(0.85);
    this.nitroBtnContainer.add(this.nitroBarFill);

    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    this.nitroBtnText = this.add.text(0, -6, '⚡ NİTRO BOOST', {
      ...font, fontSize: '13px', color: '#ffffff', fontStyle: 'bold', stroke: '#051818', strokeThickness: 3,
    }).setOrigin(0.5);
    this.nitroBtnContainer.add(this.nitroBtnText);

    this.nitroBtnSubtext = this.add.text(0, 10, '[BOŞLUK / EKRANA BASILI TUT]', {
      ...font, fontSize: '9px', color: '#e0f8ff', fontStyle: 'bold', stroke: '#051818', strokeThickness: 2,
    }).setOrigin(0.5);
    this.nitroBtnContainer.add(this.nitroBtnSubtext);

    const zone = this.add.zone(0, 0, btnW, btnH)
      .setOrigin(0.5)
      .setInteractive()
      .on('pointerdown', () => {
        if (this.flightState === 'flying') {
          this.pointerHoldingBoost = true;
        }
      })
      .on('pointerup', () => {
        this.pointerHoldingBoost = false;
      })
      .on('pointerout', () => {
        this.pointerHoldingBoost = false;
      });
    this.nitroBtnContainer.add(zone);
  }

  private updateHUDLayout(): void {
    const w = this.scale.width;
    const h = this.scale.height;

    this.hudBgSlice.setSize(w, 52);
    this.earnedText.setPosition(w / 2, 12);
    this.scoreText.setPosition(w / 2, 31);

    if (this.coinSprite) {
      this.coinSprite.setPosition(w / 2 - this.earnedText.width / 2 - 14, 20);
    }

    if (this.nitroBtnContainer) {
      this.nitroBtnContainer.setPosition(w / 2, h - 45);
    }

    if (this.launchMeterContainer && this.launchMeterContainer.visible) {
      this.launchMeterContainer.setPosition(w / 2, h * 0.44);
    }
  }

  /* ================================================================
   * HER KARE GÜNCELLEME (UPDATE) & FİZİK MOTORU
   * ================================================================ */

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    if (this.flightState === 'countdown') {
      // Fırlatma barının osilasyonu (0 ile 1 arası gidip gelme)
      this.launchPowerTimer += dt * 3.6;
      this.currentLaunchPower = (Math.sin(this.launchPowerTimer) + 1) / 2;

      const slotW = 200;
      const fillW = Math.max(4, Math.floor((slotW - 4) * this.currentLaunchPower));
      this.launchBarFill.setSize(fillW, 12);

      const percent = Math.round(this.currentLaunchPower * 100);
      this.launchPowerText.setText(`%${percent}`);
      if (percent >= 85) {
        this.launchBarFill.setTexture('ui_bar_fill_green');
        this.launchPowerText.setColor(PALETTE.resourceGoldHex);
      } else {
        this.launchBarFill.setTexture('ui_bar_fill_gold');
        this.launchPowerText.setColor('#ffffff');
      }

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
    }

    this.refreshHUD();
    this.economy.tick(dt);
  }

  private handleFlightInput(dt: number): void {
    // Boost kontrolü: SPACE tuşu, fare sol tık veya dokunmatik ekran basılı tutma
    const boostActive = (this.keySpace?.isDown || this.pointerHoldingBoost);

    // 1. Sürekli Ana Motor İtişi (Fuel varsa sürekli çalışır, fırlatmanın momentumuyla gider)
    if (this.currentFuel > 0) {
      this.isThrusting = true;
      this.currentFuel = Math.max(0, this.currentFuel - dt);

      // Kullanıcı İsteği: Ekstra aşırı itici güç olmayacak, roket fırlatmanın etkisiyle gidecek
      const cruiseThrust = this.mainThrust * 0.35;
      this.vx += Math.cos(this.currentAngle) * cruiseThrust * dt;
      this.vy += Math.sin(this.currentAngle) * cruiseThrust * dt;
    } else {
      this.isThrusting = false;
    }

    // 2. Süpersonik Boost (Nitro) & Kafa Dikme Mekaniği
    if (boostActive && this.currentBoost > 0) {
      this.isBoosting = true;
      this.currentBoost = Math.max(0, this.currentBoost - dt);

      // İleri güçlü ivmelenme
      const boostThrust = this.mainThrust * BOOST_SPEED_MULTIPLIER;
      this.vx += Math.cos(this.currentAngle) * boostThrust * dt;
      this.vy += Math.sin(this.currentAngle) * boostThrust * dt;

      // Kullanıcı İsteği: Boost basıldığında kafa dikilmeye giderek daha fazla ilerleme sağlanacak
      const pitchUpSpeed = (2.2 + this.wingsLevel * 0.4) * dt;
      this.currentAngle -= pitchUpSpeed;
      // Dikeyden geriye (-55°) devrilmesini engelle (maksimum tırmanış açısı)
      this.currentAngle = Math.max(-Phaser.Math.DegToRad(55), this.currentAngle);

      if (Math.random() < 0.25) {
        this.cameras.main.shake(50, 0.003);
      }
    } else {
      this.isBoosting = false;
    }

    // 3. Alev Görseli
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
    const GRAVITY = 380; // px/s² yer çekimi ivmesi

    // 1. Yer Çekimi
    this.vy += GRAVITY * dt;

    // 2. Aerodinamik Kaldırma Kuvveti (Lift - Kanat Seviyesine Göre Süzülme)
    const aoa = -this.currentAngle; // Burun yukarı açısı
    if (this.vx > 40 && aoa > -0.2 && aoa < Phaser.Math.DegToRad(40)) {
      const glideLift = this.vx * (0.32 + Math.cos(aoa) * 0.38) * this.liftCoeff * 0.8;
      const maxLift = GRAVITY * 0.70;
      const lift = Math.min(maxLift, glideLift);
      this.vy -= lift * dt;
    }

    // 3. Hava Direnci (Drag) - Aşırı hız kaybı yaşanmadan dengeli sürtünme
    const dragCoeff = 0.00018 / (1 + this.wingsLevel * 0.18);
    this.vx -= (this.vx * Math.abs(this.vx) * dragCoeff) * dt;
    this.vx = Math.max(0, this.vx);

    // 4. İrtifa ve Mesafe Entegrasyonu
    this.altitude = Math.max(0, this.altitude - this.vy * dt);
    const distDelta = (this.vx * dt) * 0.1;
    this.distance += distDelta;
    this.flightDuration += dt;

    const currentSpeedKmH = Math.round(Math.sqrt(this.vx * this.vx + this.vy * this.vy) * 0.7);
    this.maxSpeed = Math.max(this.maxSpeed, currentSpeedKmH);
    this.maxAltitude = Math.max(this.maxAltitude, Math.round(this.altitude * 0.25));
    this.flightScore += Math.round(distDelta * 1.8);

    // 5. Yer Çekimi Dönüşü (Gravity Turn) & Kafa Eğme Mekaniği:
    // Boost basılı değilken roket yükselirken burnunu tepe noktasına (yatay 0°) doğru kıvırır,
    // alçalırken ise kademeli olarak burnunu yere doğru eğerek doğal parabolik düşüşe geçer.
    if (!this.isBoosting) {
      const flightPathAngle = Math.atan2(this.vy, Math.max(50, this.vx));

      let targetAngle: number;
      if (this.vy < 0) {
        // Tırmanış fazı: Tepe noktasına doğru burnunu yatırır (0°'yi aşmaz)
        targetAngle = Math.min(0, flightPathAngle);
      } else {
        // Alçalış fazı: Kafasını yere doğru eğer (maksimum +52° dalış açısı)
        targetAngle = Math.min(Phaser.Math.DegToRad(52), flightPathAngle);
      }

      // Yakıt varken yumuşak süzülüş, yakıt bittiğinde kafa daha hızlı yere eğilir
      const pitchDownRate = (this.currentFuel > 0 ? 0.95 : 1.5) * dt;
      this.currentAngle = Phaser.Math.Angle.RotateTo(this.currentAngle, targetAngle, pitchDownRate);

      // Tırmanırken geriye aşırı dikilmesini engelle
      this.currentAngle = Math.max(-Phaser.Math.DegToRad(60), this.currentAngle);
    }

    // 7. Zemin Çarpışması / İniş Kontrolü
    if (this.altitude <= 0) {
      this.handleGroundImpact(dt);
    }

    // Roket rotasyonu
    this.rocketContainer.rotation = this.currentAngle;

    // Hasar dokunulmazlık efekti
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      this.rocketContainer.setAlpha(Math.sin(this.invulnerableTimer * 30) > 0 ? 0.35 : 1.0);
    } else {
      this.rocketContainer.setAlpha(1.0);
    }
  }

  /** Zemin teması: Kullanıcı İsteği: Yere düştüğü anda doğrudan patlar (sekme ve kayma kaldırıldı) */
  private handleGroundImpact(_dt: number): void {
    if (this.flightState === 'crashed' || this.flightState === 'finished') return;
    this.altitude = 0;
    this.currentHP = 0;

    this.cameras.main.shake(350, 0.016);
    this.spawnExplosionSparks(this.rocketScreenX, this.rocketScreenY + 10);
    this.endFlight(true, 'Yere Çakıldı');
  }

  /* ================================================================
   * PARALLAX, KAMERA VE YÜKSEKLİK İLLÜZYONU
   * ================================================================ */

  private updateParallaxAndCamera(dt: number): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const groundH = 45;
    const baseGroundY = h - groundH;

    // 1. Dikey Kamera ve Roket Ekran Pozisyonu:
    // Roket fırlatma rampasındayken zemin seviyesindedir.
    // İrtifa arttıkça kamera roketi kademeli olarak ekranın dikey merkezine alır.
    // Asla tavana takılma olmaz; yukarı doğru sonsuz hareket hissi verilir.
    const centerScreenY = h * 0.48;
    const dynamicLeadY = Phaser.Math.Clamp(this.vy * 0.12, -45, 45);
    const targetScreenY = centerScreenY + dynamicLeadY;

    if (this.altitude < 120) {
      // Yer seviyesinden kalkış geçişi
      const progress = this.altitude / 120;
      this.rocketScreenY = Phaser.Math.Linear(baseGroundY - 26, targetScreenY, progress);
      const groundVisualY = baseGroundY + this.altitude * 0.85;
      this.groundTileSprite.y = groundVisualY;
      if (this.launchPlatform) this.launchPlatform.y = groundVisualY;
      if (this.launchGantry) this.launchGantry.y = groundVisualY - 5;
    } else {
      // Yüksek irtifada pürüzsüz dinamik takip
      this.rocketScreenY = Phaser.Math.Linear(this.rocketScreenY, targetScreenY, 0.08);
      // Zemin ve rampa ekranın altına kayarak gözden kaybolur
      const groundVisualY = baseGroundY + (this.altitude - 120) + 102;
      this.groundTileSprite.y = groundVisualY;
      if (this.launchPlatform) this.launchPlatform.y = groundVisualY;
      if (this.launchGantry) this.launchGantry.y = groundVisualY - 5;
    }

    this.rocketContainer.setPosition(this.rocketScreenX, this.rocketScreenY);

    // 2. Dikey ve Yatay Sonsuz Gökyüzü / Uzay Döngüsü (TileSprite)
    // Roket yükseldikçe (vy < 0) arka plan aşağı doğru sonsuz loop yapar, sınır/tavan yoktur
    const speedX = this.vx;
    const speedY = -this.vy;

    this.skyTileSprite.tilePositionX += speedX * dt * 0.12;
    this.skyTileSprite.tilePositionY -= speedY * dt * 0.35;

    // 3. Fırlatma platformunu geride bırakma
    if (this.launchPlatform) {
      this.launchPlatform.x -= speedX * dt;
      if (this.launchPlatform.x < -160) {
        this.launchPlatform.destroy();
        this.launchPlatform = null;
      }
    }
    if (this.launchGantry) {
      this.launchGantry.x -= speedX * dt;
      if (this.launchGantry.x < -160) {
        this.launchGantry.destroy();
        this.launchGantry = null;
      }
    }

    // 4. Yıldızlar (2D Sonsuz Parallaks: Hem dikey hem yatay wrap)
    for (const s of this.stars) {
      s.sprite.x -= speedX * s.speed * dt;
      s.sprite.y += speedY * s.speed * 0.45 * dt;

      if (s.sprite.x < -15) {
        s.sprite.x = w + Phaser.Math.Between(10, 30);
        s.sprite.y = Phaser.Math.Between(0, h);
      } else if (s.sprite.x > w + 15) {
        s.sprite.x = -10;
        s.sprite.y = Phaser.Math.Between(0, h);
      }

      // Dikey sonsuz loop
      if (s.sprite.y > h + 20) {
        s.sprite.y = -15;
        s.sprite.x = Phaser.Math.Between(0, w);
      } else if (s.sprite.y < -20) {
        s.sprite.y = h + 15;
        s.sprite.x = Phaser.Math.Between(0, w);
      }
    }

    // 5. Dağlar (Zemine bağlıdır, roket yükseldikçe ekranın altına kayar)
    for (const m of this.mountains) {
      m.sprite.x -= speedX * m.speed * dt;
      if (m.sprite.x < -160) {
        m.sprite.x += (this.mountains.length * 140);
      }
      m.sprite.y = (h - 35) + Math.max(0, this.altitude * 0.85);
    }

    // 6. Bulutlar (Atmosfer katmanı, dikey ve yatay sonsuz parallaks)
    for (const c of this.clouds) {
      c.sprite.x -= speedX * c.speed * dt;
      c.sprite.y += speedY * c.speed * 0.65 * dt;

      if (c.sprite.x < -90) {
        c.sprite.x = w + Phaser.Math.Between(20, 80);
        c.sprite.y = Phaser.Math.Between(30, h - 50);
      } else if (c.sprite.x > w + 90) {
        c.sprite.x = -80;
        c.sprite.y = Phaser.Math.Between(30, h - 50);
      }

      // Dikey döngü
      if (c.sprite.y > h + 90) {
        c.sprite.y = -70;
        c.sprite.x = Phaser.Math.Between(0, w);
      } else if (c.sprite.y < -90) {
        c.sprite.y = h + 70;
        c.sprite.x = Phaser.Math.Between(0, w);
      }
    }

    // Zemin tile kaydırma
    this.groundTileSprite.tilePositionX += speedX * dt;
  }

  /* ================================================================
   * ENGELLER VE KAÇINMA (DODGE)
   * ================================================================ */

  private updateObstacles(dt: number): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const speedY = -this.vy;

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
      obs.y += speedY * dt;
      obs.sprite.setPosition(obs.x, obs.y);
      obs.sprite.rotation += dt * 0.9;

      // Kaçınma kontrolü
      if (!obs.hasCollided && !obs.hasBeenDodged && obs.x < this.rocketScreenX - 35) {
        obs.hasBeenDodged = true;
        this.dodgedObstacles++;
        this.flightScore += 20;
        this.showFloatingNotice(obs.x, obs.y - 15, '✨ KAÇILDI!', '#2ecc71');
      }

      // Ekran dışına çıkınca yok et (yatay veya dikey)
      if (obs.x < -70 || obs.y < -120 || obs.y > h + 120) {
        obs.sprite.destroy();
        this.obstacles.splice(i, 1);
      }
    }
  }

  private spawnObstacle(w: number, h: number): void {
    const types = ['obstacle_asteroid', 'obstacle_drone', 'obstacle_debris'];
    const type = Phaser.Utils.Array.GetRandom(types);

    // Roketin uçuş koridorunda dikey olarak spawn et
    const spawnY = Phaser.Math.Clamp(
      this.rocketScreenY + Phaser.Math.Between(-110, 110),
      60,
      h - 70
    );
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
    const speedY = -this.vy;

    this.collectibleSpawnTimer += dt;
    if (this.collectibleSpawnTimer >= 1.4) {
      this.collectibleSpawnTimer = 0;
      this.spawnCollectible(w, h);
    }

    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const col = this.collectibles[i];
      col.x -= (this.vx * 0.9 + 20) * dt;
      col.y += speedY * dt;

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

      if (col.x < -50 || col.y < -120 || col.y > h + 120) {
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

    // Roketin uçuş koridorunda dikey olarak spawn et
    const spawnY = Phaser.Math.Clamp(
      this.rocketScreenY + Phaser.Math.Between(-100, 100),
      60,
      h - 70
    );
    const sprite = this.add.image(w + 30, spawnY, key).setDepth(14).setScale(1.7);

    this.tweens.add({
      targets: sprite,
      scaleX: 1.9,
      scaleY: 1.9,
      duration: 450,
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

    // this.refreshBars();
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
    this.createNitroButton(w, h);
  }
}