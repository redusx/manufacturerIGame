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
import type { RocketHangarBridge } from '../factory/simulation/RocketHangarBridge';
import type { FactoryEconomy } from '../factory/simulation/FactoryEconomy';
import { FlightReturnHelper } from './FlightReturnHelper';
import {
  type FlightBody,
  type FlightStats,
  applyCrystal,
  computeFlightStats,
  createFlightBody,
  currentSpeedKmH,
  obstacleDamage,
  stepFlight,
} from '../flight/FlightPhysics.ts';
import { RANGE_LADDER, RangeLadder } from '../flight/RangeLadder.ts';
import { MAX_ROCKET_LEVEL } from '../data/RocketData.ts';
import { PALETTE, FONT_FAMILY, SEMANTIC, FLIGHT_SKY_TONES } from '../ui/theme';
import { formatDistance } from '../utils/format';
import { UiLayer } from '../ui/system/UiLayer.ts';
import { FlightHud } from '../ui/FlightHud.ts';
import { FlightReportModal } from '../ui/FlightReportModal.ts';
import { sound } from '../audio/SoundManager.ts';
import { fx } from '../effects/PixelParticleManager.ts';
import { crazyGames } from '../integration/CrazyGamesSDK.ts';
import { ads } from '../ads/ads.ts';

/** Reklam izlenince uçuş priminin çıktığı kat (M9-E R2) */
const FLIGHT_AD_BONUS_MULTIPLIER = 3;

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

/** Bu bölgeden (5 km, Derin Uzay) itibaren gökyüzünde bulut çizilmez */
const CLOUDLESS_ZONE_INDEX = 5;

type FlightState = 'countdown' | 'launching' | 'flying' | 'crashed' | 'landed' | 'finished';

export class FlightScene extends Phaser.Scene {
  private economy!: EconomyManager;
  private bridge?: RocketHangarBridge;
  private factoryEconomy?: FactoryEconomy;

  /* Roket Geliştirme Seviyeleri */
  private hullLevel = 1;
  private engineLevel = 1;
  private wingsLevel = 1;
  private boostLevel = 1;

  /** Modül seviyelerinden türeyen uçuş değerleri ve roketin anlık durumu (saf fizik modülü) */
  private stats: FlightStats = computeFlightStats({ hull: 1, engine: 1, wings: 1, boost: 1 });
  private body: FlightBody = createFlightBody(this.stats, 0.5);
  private currentHP = 100;

  private flightState: FlightState = 'countdown';
  private rocketScreenX = 140;
  private rocketScreenY = 240;
  /** Roketin içinde bulunduğu menzil bölgesi (geçilen basamak sayısı) */
  private zoneIndex = 0;
  /** Uçuş başlamadan önceki rekor; HUD'daki "hedef" bunu geçen ilk basamaktır */
  private previousBest = 0;

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
  private groundTileSprite!: Phaser.GameObjects.TileSprite;
  private stars: Array<{ sprite: Phaser.GameObjects.Image; speed: number }> = [];
  private mountains: Array<{ sprite: Phaser.GameObjects.Image; speed: number }> = [];
  private clouds: Array<{ sprite: Phaser.GameObjects.Image; speed: number }> = [];

  /* Engeller ve Nesneler */
  private obstacles: ObstacleEntity[] = [];
  private collectibles: CollectibleEntity[] = [];
  private obstacleSpawnTimer = 0;
  private collectibleSpawnTimer = 0;

  /* Arayüz: uçuş dünyasından ayrı kamerada, arayüz ölçeğiyle çizilir */
  private ui!: UiLayer;
  private hud!: FlightHud;
  private reportModal!: FlightReportModal;

  /** Uçuş dünyasının görünen boyutu (dünya birimi); fizik ve yerleşim bununla çalışır */
  private viewW = 360;
  private viewH = 640;

  /* Fırlatma Güç Göstergesi (Rampa Mini-Oyunu) */
  private launchPowerTimer = 0;
  private currentLaunchPower = 0.5;
  private isLaunchLocked = false;

  private pointerHoldingBoost = false;
  /** Uçuş sonunda hesaplanan prim (rapor kapanınca fabrikaya aktarılır) */
  private reportTotal = 0;
  /** Uçuş primine uygulanan reklam çarpanı (izlenmediyse 1) */
  private reportRewardMultiplier = 1;

  /* Kontroller */
  private keySpace!: Phaser.Input.Keyboard.Key;

  constructor() {
    super({ key: 'FlightScene' });
  }

  init(data: {
    economy: EconomyManager;
    bridge?: RocketHangarBridge;
    factoryEconomy?: FactoryEconomy;
  }): void {
    this.economy = data.economy;
    this.bridge = data.bridge;
    this.factoryEconomy = data.factoryEconomy;
  }

  create(): void {
    // Arayüz ayrı bir kamerada çizilir; ana kamera uçuş dünyasını çizer. Bundan sonra
    // sahneye eklenen her nesne dünyaya aittir, arayüz kökleri katman tarafından ayrılır.
    const uiCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.ui = new UiLayer(this, uiCamera);
    this.ui.addWorldCamera(this.cameras.main);
    this.applyWorldCamera();

    const w = this.viewW;
    const h = this.viewH;

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
    this.hullLevel = this.bridge
      ? this.bridge.getModuleLevel('hull')
      : this.economy.getRocketUpgradeLevel('hull');
    this.engineLevel = this.bridge
      ? this.bridge.getModuleLevel('engine')
      : this.economy.getRocketUpgradeLevel('engine');
    this.wingsLevel = this.bridge
      ? this.bridge.getModuleLevel('wings')
      : this.economy.getRocketUpgradeLevel('wings');
    this.boostLevel = this.bridge
      ? this.bridge.getModuleLevel('boost')
      : this.economy.getRocketUpgradeLevel('boost');

    this.stats = computeFlightStats({
      hull: this.hullLevel,
      engine: this.engineLevel,
      wings: this.wingsLevel,
      boost: this.boostLevel,
    });
    // Rampadaki roket: fırlatma gücü belli olunca gövde yeniden kurulur
    this.body = createFlightBody(this.stats, 0.5);
    this.body.vx = 0;
    this.body.vy = 0;
    this.body.altitude = 0;
    this.currentHP = this.stats.maxHp;
    this.zoneIndex = 0;
    this.previousBest = this.bridge
      ? this.bridge.getFlightStats().bestDistance
      : this.economy.stats.bestDistance;

    this.flightState = 'countdown';
    this.flightScore = 0;
    this.collectedGears = 0;
    this.collectedCrystals = 0;
    this.dodgedObstacles = 0;
    this.invulnerableTimer = 0;
    this.obstacles = [];
    this.collectibles = [];

    // 1. Arka Plan
    this.cameras.main.setBackgroundColor(FLIGHT_SKY_TONES[0]);

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
    this.createRocket();

    // 5. Arayüz: üst çubuk, nitro düğmesi, fırlatma göstergesi ve uçuş sonu raporu
    this.launchPowerTimer = 0;
    this.isLaunchLocked = false;
    this.pointerHoldingBoost = false;
    this.hud = new FlightHud(this.ui, {
      onNitroDown: () => {
        if (this.flightState === 'flying') this.pointerHoldingBoost = true;
      },
      onNitroUp: () => {
        this.pointerHoldingBoost = false;
      },
    });
    this.reportRewardMultiplier = 1;
    // Reklamla prim katlama (R2): reklam sunulamıyorsa düğme çizilmez, izlenemezse prim değişmez
    this.reportModal = new FlightReportModal(this.ui, () => this.returnToFactory(this.reportTotal), {
      multiplier: FLIGHT_AD_BONUS_MULTIPLIER,
      isOffered: () => ads.isOffered('flight_bonus'),
      cooldownRemaining: () => ads.cooldownRemaining('flight_bonus'),
      request: async () => (await ads.show('flight_bonus')) === 'rewarded',
      onApplied: (totalCash) => {
        this.reportTotal = totalCash;
        this.reportRewardMultiplier = FLIGHT_AD_BONUS_MULTIPLIER;
        sound.playMilestone();
      },
    });

    // 6. Kontroller (SPACE, Sol Tık & Tüm Ekran Dokunmatik)
    this.setupControls(w, h);

    // Pencere boyutu veya arayüz ölçeği değişince dünya kamerası ve arayüz yeniden yerleşir
    this.ui.onLayout(() => this.handleResize());
    this.refreshHUD();
  }

  /**
   * Uçuş dünyasını ekrana sığdırır. Dünya, tuval cihaz çözünürlüğünde çizilse de
   * eskisiyle aynı büyüklükte görünür: en az 360x640 dünya birimi görünür kalır.
   */
  private applyWorldCamera(): void {
    const m = this.ui.metrics;
    const cssScale = Math.max(1, Math.min(m.cssWidth / 360, m.cssHeight / 640));
    // Piksel sanat bozulmasın diye zoom yarım adımlara oturtulur (ART_DIRECTION §3)
    const zoom = Math.max(0.5, Math.floor((cssScale * m.renderScale) / 0.5 + 1e-6) * 0.5);

    const camera = this.cameras.main;
    camera.setViewport(0, 0, m.canvasWidth, m.canvasHeight);
    camera.setOrigin(0, 0);
    camera.setScroll(0, 0);
    camera.setZoom(zoom);

    this.viewW = m.canvasWidth / zoom;
    this.viewH = m.canvasHeight / zoom;
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
    this.rocketContainer.rotation = this.body.angle;

    this.flameSprite = this.add.image(-28, 0, 'flame_idle').setOrigin(1, 0.5).setScale(1.7).setVisible(false);
    this.rocketContainer.add(this.flameSprite);

    const engineKey = `rocket_engine_${Math.min(MAX_ROCKET_LEVEL, Math.max(1, this.engineLevel))}`;
    this.engineSprite = this.add.image(-16, 0, engineKey).setOrigin(0.5).setScale(1.8);
    this.rocketContainer.add(this.engineSprite);

    const tankKey = `rocket_tank_${Math.min(MAX_ROCKET_LEVEL, Math.max(1, this.boostLevel))}`;
    this.tankSprite = this.add.image(-4, 0, tankKey).setOrigin(0.5).setScale(1.8);
    this.rocketContainer.add(this.tankSprite);

    const wingsKey = `rocket_wings_${Math.min(MAX_ROCKET_LEVEL, Math.max(1, this.wingsLevel))}`;
    this.wingsSprite = this.add.image(-8, 0, wingsKey).setOrigin(0.5).setScale(1.8);
    this.rocketContainer.add(this.wingsSprite);

    const hullKey = `rocket_hull_${Math.min(MAX_ROCKET_LEVEL, Math.max(1, this.hullLevel))}`;
    this.hullSprite = this.add.image(4, 0, hullKey).setOrigin(0.5).setScale(1.8);
    this.rocketContainer.add(this.hullSprite);
  }

  /* ================================================================
   * FIRLATMA RAMPASI GÜÇ BARI MİNİ-OYUNU
   * ================================================================ */

  private triggerLaunchFromMeter(): void {
    if (this.isLaunchLocked || this.flightState !== 'countdown') return;
    this.isLaunchLocked = true;

    // Minimum %25, maksimum %100 güç
    const powerRatio = Phaser.Math.Clamp(this.currentLaunchPower, 0.25, 1.0);
    this.body = createFlightBody(this.stats, powerRatio);

    const percent = Math.round(powerRatio * 100);

    if (powerRatio >= 0.88) {
      this.hud.announce(`Mükemmel fırlatma! %${percent}`, SEMANTIC.moneyHex);
    } else if (powerRatio >= 0.6) {
      this.hud.announce(`İyi fırlatma! %${percent}`, SEMANTIC.primaryHex);
    } else {
      this.hud.announce(`Zayıf fırlatma: %${percent}`, SEMANTIC.warningHex);
    }
    this.hud.hideLaunchMeter();

    this.blastOff();
  }

  /** İlk fırlatma ivmesi */
  private blastOff(): void {
    this.flightState = 'flying';
    crazyGames.gameplayStart();
    this.flameSprite.setVisible(true);
    if (this.textures.exists('flame_idle')) {
      this.flameSprite.setTexture('flame_idle');
    }

    // Gövde triggerLaunchFromMeter'da fırlatma gücüyle kuruldu (-60° çıkış açısı)
    this.rocketContainer.rotation = this.body.angle;

    sound.playLaunch();
    fx.emitSparkles(this, this.rocketScreenX - 25, this.rocketScreenY + 20, 20, PALETTE.factoryAmber);
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
   * HER KARE GÜNCELLEME (UPDATE) & FİZİK MOTORU
   * ================================================================ */

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    if (this.flightState === 'countdown') {
      // Fırlatma barının osilasyonu (0 ile 1 arası gidip gelme)
      this.launchPowerTimer += dt * 3.6;
      this.currentLaunchPower = (Math.sin(this.launchPowerTimer) + 1) / 2;

      this.hud.setLaunchPower(this.currentLaunchPower);
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
  }

  private handleFlightInput(dt: number): void {
    // Nitro: SPACE tuşu, nitro düğmesi veya ekrana basılı tutma
    const boostHeld = Boolean(this.keySpace?.isDown || this.pointerHoldingBoost);
    const wasBoosting = this.body.isBoosting;

    // İtiş, nitro, yer çekimi, süzülme, mesafe: saf fizik modülü
    const distanceDelta = stepFlight(this.body, this.stats, boostHeld, dt);
    this.flightScore += Math.round(distanceDelta * 1.8);

    if (this.body.isBoosting) {
      if (!wasBoosting) sound.playBoost();
      if (Math.random() < 0.25) {
        this.cameras.main.shake(50, 0.003);
      }
    }

    // 3. Alev Görseli
    if (this.body.isBoosting) {
      this.flameSprite.setVisible(true);
      if (this.textures.exists('flame_boost')) this.flameSprite.setTexture('flame_boost');
      this.flameSprite.setScale(2.2, 1.8);
    } else if (this.body.isThrusting) {
      this.flameSprite.setVisible(true);
      if (this.textures.exists('flame_idle')) this.flameSprite.setTexture('flame_idle');
      this.flameSprite.setScale(1.7, 1.3);
    } else {
      this.flameSprite.setVisible(false);
    }
  }

  private updateFlightPhysics(dt: number): void {
    this.updateZone();

    // 7. Zemin Çarpışması / İniş Kontrolü
    if (this.body.altitude <= 0) {
      this.handleGroundImpact(dt);
    }

    // Roket rotasyonu
    this.rocketContainer.rotation = this.body.angle;

    // Hasar dokunulmazlık efekti
    if (this.invulnerableTimer > 0) {
      this.invulnerableTimer -= dt;
      this.rocketContainer.setAlpha(Math.sin(this.invulnerableTimer * 30) > 0 ? 0.35 : 1.0);
    } else {
      this.rocketContainer.setAlpha(1.0);
    }
  }

  /**
   * Menzil bölgesi: roket bir basamağı geçtiğinde duyurulur ve gökyüzü o bölgenin
   * tonuna döner. "Daha ileri gitmenin" ekrandaki karşılığıdır.
   */
  private updateZone(): void {
    const zone = RangeLadder.zoneIndex(this.body.distance);
    if (zone === this.zoneIndex) return;
    this.zoneIndex = zone;
    this.applyZoneSky();

    const rung = RANGE_LADDER[zone - 1];
    if (rung) {
      this.hud.announce(`${rung.name} · ${formatDistance(rung.targetMeters)}`, SEMANTIC.rocketHex);
      sound.playCoin();
    }
  }

  /** Bölgenin gökyüzü tonu; derin uzaydan (5 km) sonra bulut kalmaz */
  private applyZoneSky(): void {
    const tone = FLIGHT_SKY_TONES[Math.min(this.zoneIndex, FLIGHT_SKY_TONES.length - 1)];
    this.cameras.main.setBackgroundColor(tone);
    const cloudsVisible = this.zoneIndex < CLOUDLESS_ZONE_INDEX;
    for (const cloud of this.clouds) {
      cloud.sprite.setVisible(cloudsVisible);
    }
  }

  /** Zemin teması: Kullanıcı İsteği: Yere düştüğü anda doğrudan patlar (sekme ve kayma kaldırıldı) */
  private handleGroundImpact(_dt: number): void {
    if (this.flightState === 'crashed' || this.flightState === 'finished') return;
    this.body.altitude = 0;
    this.currentHP = 0;

    this.cameras.main.shake(350, 0.016);
    this.spawnExplosionSparks(this.rocketScreenX, this.rocketScreenY + 10);
    this.endFlight(true, 'Yere Çakıldı');
  }

  /* ================================================================
   * PARALLAX, KAMERA VE YÜKSEKLİK İLLÜZYONU
   * ================================================================ */

  private updateParallaxAndCamera(dt: number): void {
    const w = this.viewW;
    const h = this.viewH;
    const groundH = 45;
    const baseGroundY = h - groundH;

    // 1. Dikey Kamera ve Roket Ekran Pozisyonu:
    // Roket fırlatma rampasındayken zemin seviyesindedir.
    // İrtifa arttıkça kamera roketi kademeli olarak ekranın dikey merkezine alır.
    // Asla tavana takılma olmaz; yukarı doğru sonsuz hareket hissi verilir.
    const centerScreenY = h * 0.48;
    const dynamicLeadY = Phaser.Math.Clamp(this.body.vy * 0.12, -45, 45);
    const targetScreenY = centerScreenY + dynamicLeadY;

    if (this.body.altitude < 120) {
      // Yer seviyesinden kalkış geçişi
      const progress = this.body.altitude / 120;
      this.rocketScreenY = Phaser.Math.Linear(baseGroundY - 26, targetScreenY, progress);
      const groundVisualY = baseGroundY + this.body.altitude * 0.85;
      this.groundTileSprite.y = groundVisualY;
      if (this.launchPlatform) this.launchPlatform.y = groundVisualY;
      if (this.launchGantry) this.launchGantry.y = groundVisualY - 5;
    } else {
      // Yüksek irtifada pürüzsüz dinamik takip
      this.rocketScreenY = Phaser.Math.Linear(this.rocketScreenY, targetScreenY, 0.08);
      // Zemin ve rampa ekranın altına kayarak gözden kaybolur
      const groundVisualY = baseGroundY + (this.body.altitude - 120) + 102;
      this.groundTileSprite.y = groundVisualY;
      if (this.launchPlatform) this.launchPlatform.y = groundVisualY;
      if (this.launchGantry) this.launchGantry.y = groundVisualY - 5;
    }

    this.rocketContainer.setPosition(this.rocketScreenX, this.rocketScreenY);

    // 2. Dikey ve Yatay Sonsuz Gökyüzü / Uzay Döngüsü (TileSprite)
    // Roket yükseldikçe (vy < 0) arka plan aşağı doğru sonsuz loop yapar, sınır/tavan yoktur
    const speedX = this.body.vx;
    const speedY = -this.body.vy;



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
    const w = this.viewW;
    const h = this.viewH;
    const speedY = -this.body.vy;

    // Engel üretimi (Yalnızca havada iken)
    if (this.body.altitude > 40) {
      this.obstacleSpawnTimer += dt;
      const interval = Phaser.Math.Clamp(2.0 - (this.body.distance / 2500), 0.8, 2.0);

      if (this.obstacleSpawnTimer >= interval) {
        this.obstacleSpawnTimer = 0;
        this.spawnObstacle(w, h);
      }
    }

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obs = this.obstacles[i];
      obs.x -= (this.body.vx * obs.speedMultiplier + 40) * dt;
      obs.y += speedY * dt;
      obs.sprite.setPosition(obs.x, obs.y);
      obs.sprite.rotation += dt * 0.9;

      // Kaçınma kontrolü
      if (!obs.hasCollided && !obs.hasBeenDodged && obs.x < this.rocketScreenX - 35) {
        obs.hasBeenDodged = true;
        this.dodgedObstacles++;
        this.flightScore += 20;
        this.showFloatingNotice(obs.x, obs.y - 15, 'KAÇILDI!', SEMANTIC.primaryHex);
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
    const w = this.viewW;
    const h = this.viewH;
    const speedY = -this.body.vy;

    this.collectibleSpawnTimer += dt;
    if (this.collectibleSpawnTimer >= 1.4) {
      this.collectibleSpawnTimer = 0;
      this.spawnCollectible(w, h);
    }

    for (let i = this.collectibles.length - 1; i >= 0; i--) {
      const col = this.collectibles[i];
      col.x -= (this.body.vx * 0.9 + 20) * dt;
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
    sound.playCoin();
    fx.emitSparkles(this, this.rocketScreenX, this.rocketScreenY, 8, PALETTE.resourceGold);

    if (item.type === 'gear') {
      this.collectedGears++;
      this.flightScore += 30;
      this.showFloatingNotice(this.rocketScreenX, this.rocketScreenY - 20, '+1 DİŞLİ', SEMANTIC.moneyHex);
    } else if (item.type === 'crystal') {
      this.collectedCrystals++;
      this.flightScore += 65;
      // Sabit miktarda yakıt ve nitro doldurur (seviyeden bağımsız)
      applyCrystal(this.body, this.stats);
      this.showFloatingNotice(this.rocketScreenX, this.rocketScreenY - 20, 'YAKIT + NİTRO', SEMANTIC.rocketHex);
    } else if (item.type === 'repair') {
      this.currentHP = Math.min(this.stats.maxHp, this.currentHP + 35);
      this.showFloatingNotice(this.rocketScreenX, this.rocketScreenY - 20, '+35 HP', SEMANTIC.primaryHex);
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
    // İleri bölgelerde engeller daha sert vurur; gövde seviyesi hasarı böler
    const damage = obstacleDamage(amount, this.stats, RangeLadder.obstacleDamageMultiplier(this.body.distance));
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
    sound.playHit();
    fx.emitExplosion(this, x, y, 16);

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
      // Dünyada çizilen yazı, dünya kamerasının zoom'unda keskin üretilir
      resolution: this.cameras.main.zoom,
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
    this.hud.update({
      distance: this.body.distance,
      altitude: this.body.altitude * 0.25,
      speed: currentSpeedKmH(this.body, this.stats),
      earned: this.calculateTotalEarnedResources(),
      hp: this.currentHP,
      maxHp: this.stats.maxHp,
      fuel: this.body.fuel,
      maxFuel: this.stats.fuelCapacity,
      boost: this.body.boost,
      maxBoost: this.stats.boostCapacity,
      isBoosting: this.body.isBoosting,
      nextTargetMeters: RangeLadder.next(Math.max(this.previousBest, this.body.distance))?.targetMeters ?? null,
    });
  }

  private calculateTotalEarnedResources(): number {
    const breakdown = FlightReturnHelper.calculateRewardBreakdown(
      {
        distanceMeters: this.body.distance,
        maxAltitudeMeters: this.body.maxAltitude,
        gearsCollected: this.collectedGears,
        crystalsCollected: this.collectedCrystals,
        dodgedObstacles: this.dodgedObstacles,
        rangeScale: this.stats.rangeScale,
      },
      this.factoryEconomy?.getRevenuePerSec(),
    );
    return breakdown.totalCash;
  }

  /* ================================================================
   * UÇUŞ SONU VE DETAYLI RAPOR PANELİ
   * ================================================================ */

  private endFlight(isCrash: boolean, reasonText: string): void {
    // Sadece bir kez çalışsın: crashed veya finished state'inde tekrar çalışma
    if (this.flightState === 'crashed' || this.flightState === 'finished') return;
    this.flightState = isCrash ? 'crashed' : 'finished';
    crazyGames.gameplayStop();

    if (isCrash) {
      this.spawnExplosionSparks(this.rocketScreenX, this.rocketScreenY);
      this.rocketContainer.setVisible(false);
    }

    const totalResources = this.calculateTotalEarnedResources();

    this.time.delayedCall(450, () => {
      this.showFlightReport(isCrash, reasonText, totalResources);
    });
  }

  private showFlightReport(isCrash: boolean, reasonText: string, totalResources: number): void {
    const prevBest = this.bridge
      ? this.bridge.getFlightStats().bestDistance
      : this.economy.stats.bestDistance;
    const currentMultiplier = this.factoryEconomy ? this.factoryEconomy.revenueMultiplier : 1.0;

    const view = FlightReturnHelper.buildReportViewModel({
      distance: this.body.distance,
      durationSec: this.body.duration,
      maxAltitude: this.body.maxAltitude,
      maxSpeedKmH: this.body.maxSpeed,
      gears: this.collectedGears,
      crystals: this.collectedCrystals,
      dodgedObstacles: this.dodgedObstacles,
      flightScore: this.flightScore,
      isCrash,
      previousBestDistance: prevBest,
      currentRevenueMultiplier: currentMultiplier,
      incomePerSec: this.factoryEconomy?.getRevenuePerSec(),
      rangeScale: this.stats.rangeScale,
    });

    if (view.isNewBestDistance || view.unlockedMilestones.length > 0) {
      crazyGames.happytime();
      sound.playMilestone();
      fx.emitConfetti(this, this.ui.width / 2, this.ui.height / 2, 28, 'ui');
    }

    this.reportTotal = totalResources;
    this.reportRewardMultiplier = 1;
    this.hud.setVisible(false);
    this.reportModal.showReport({
      isCrash,
      reason: reasonText,
      totalCash: totalResources,
      gears: this.collectedGears,
      crystals: this.collectedCrystals,
      view,
    });
  }

  private returnToFactory(totalResources: number): void {
    if (this.bridge && this.factoryEconomy) {
      // 1. Kilometre taşlarını ve uçuş gelirini fabrika ekonomisine aktar
      this.bridge.processFlightResult(
        {
          distanceMeters: this.body.distance,
          partsCollected: this.collectedGears,
          crystalsCollected: this.collectedCrystals,
          dodgedObstacles: this.dodgedObstacles,
          altitudeMeters: this.body.maxAltitude,
          rangeScale: this.stats.rangeScale,
          rewardMultiplier: this.reportRewardMultiplier,
        },
        this.factoryEconomy,
      );

      // 2. Mesafe ve skor istatistiklerini kaydet (gelir zaten processFlightResult ile tek seferde eklendi)
      this.economy.recordFlightResult(
        Math.floor(this.body.distance),
        this.flightScore,
        0,
      );
    } else {
      this.economy.recordFlightResult(
        Math.floor(this.body.distance),
        this.flightScore,
        totalResources,
      );
    }

    this.scene.stop('FlightScene');
    this.scene.resume('GameScene');

    const gameScene = this.scene.get('GameScene') as any;
    if (gameScene && typeof gameScene.onReturnFromFlight === 'function') {
      gameScene.onReturnFromFlight(totalResources, Math.floor(this.body.distance));
    }
  }

  /** Pencere boyutu veya arayüz ölçeği değişince dünya kamerasını ve arayüzü yeniden yerleştirir */
  private handleResize(): void {
    this.applyWorldCamera();
    this.groundTileSprite.setSize(this.viewW, 45);
    this.hud.layout();
  }
}
