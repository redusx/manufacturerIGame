/* ======================================================================
 * src/factory/view/MachineStatusIndicator.ts — Makine Durum İkaz ve Partikül Sistemi
 *
 * Fabrikadaki makinelerin girdi açlığı (WAITING_INPUT / sarı ikaz),
 * çıkış tıkanıklığı (BLOCKED_OUTPUT / kırmızı ikaz) ve üretim çalışma
 * durumlarını (PROCESSING / kıvılcım partikülleri) Phaser 3 sahnesinde
 * canlı animasyonlarla görselleştirir.
 *
 * docs/ART_DIRECTION.md ve src/ui/theme.ts standartlarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { ProductionEngine } from '../simulation/ProductionEngine.ts';
import type { MachineRenderer } from './MachineRenderer.ts';
import {
  MachineStatusHelper,
  type ParticleSpawnPoint,
  type StatusBadgeConfig,
} from './MachineStatusHelper.ts';
import {
  MachineVisualGeometry,
  type MachineVisualBounds,
} from './MachineVisualGeometry.ts';
import { PALETTE, FONT_FAMILY } from '../../ui/theme.ts';

interface ActiveSpark {
  sprite: Phaser.GameObjects.Sprite;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  active: boolean;
}

interface MachineBadgeBay {
  instanceId: string;
  badgeContainer: Phaser.GameObjects.Container;
  badgeBg: Phaser.GameObjects.Rectangle;
  badgeIcon: Phaser.GameObjects.Sprite | Phaser.GameObjects.Text;
  pulseTimer: number;
  sparkCooldown: number;
}

export class MachineStatusIndicator {
  readonly scene: Phaser.Scene;
  readonly engine: ProductionEngine;
  readonly machineRenderer: MachineRenderer;

  /** Kök Phaser Konteyneri */
  readonly rootContainer: Phaser.GameObjects.Container;

  /** instanceId -> Makine İkaz Yuvası */
  private badgeBays = new Map<string, MachineBadgeBay>();

  /** Kıvılcım partikül sprite havuzu (GC önleme) */
  private sparkPool: ActiveSpark[] = [];
  private readonly MAX_SPARKS = 24;

  constructor(
    scene: Phaser.Scene,
    engine: ProductionEngine,
    machineRenderer: MachineRenderer,
  ) {
    this.scene = scene;
    this.engine = engine;
    this.machineRenderer = machineRenderer;

    this.rootContainer = scene.add.container(0, 0);

    // Kıvılcım havuzunu başlat
    this.initSparkPool();

    // İlk ikaz rozetlerini oluştur
    this.rebuild();
  }

  /**
   * Kıvılcım sprite havuzunu önceden tahsis eder.
   */
  private initSparkPool(): void {
    const hasTexture = this.scene.textures.exists('star_pixel');

    for (let i = 0; i < this.MAX_SPARKS; i++) {
      let sprite: Phaser.GameObjects.Sprite;
      if (hasTexture) {
        sprite = this.scene.add.sprite(0, 0, 'star_pixel');
      } else {
        sprite = this.scene.add.sprite(0, 0, '__DEFAULT');
      }
      sprite.setOrigin(0.5, 0.5);
      sprite.setVisible(false);
      sprite.setActive(false);
      sprite.setTint(PALETTE.resourceGold);
      this.rootContainer.add(sprite);

      this.sparkPool.push({
        sprite,
        vx: 0,
        vy: 0,
        life: 0,
        maxLife: 1,
        active: false,
      });
    }
  }

  // -------------------------------------------------------------
  // YENİDEN İNŞA (REBUILD)
  // -------------------------------------------------------------

  /**
   * Tüm makinelerin ikaz rozetlerini güncel makine listesine göre yeniden kurar.
   */
  rebuild(): void {
    this.clearBadges();

    const machines = this.engine.getAllMachines();
    for (const machine of machines) {
      const bay = this.machineRenderer.getBay(machine.instanceId);
      if (!bay) continue;

      const bounds: MachineVisualBounds = MachineVisualGeometry.computeBounds(
        machine.coord,
        machine.effectiveWidth,
        machine.effectiveHeight,
        machine.rotation,
        this.machineRenderer.tileSize,
      );

      // Rozet konumu (sağ-üst köşe)
      const relPos = MachineStatusHelper.computeBadgeRelativePosition(
        bounds.pixelW,
        bounds.pixelH,
        7,
      );

      const badgeContainer = this.scene.add.container(relPos.x, relPos.y);

      // Rozet arka planı (14x14 beveled kare)
      const badgeBg = this.scene.add.rectangle(0, 0, 14, 14, PALETTE.cardBg);
      badgeBg.setOrigin(0.5, 0.5);
      badgeBg.setStrokeStyle(1, PALETTE.warningOrange);
      badgeContainer.add(badgeBg);

      // Rozet ikonu (doku varsa sprite, yoksa piksel text)
      let badgeIcon: Phaser.GameObjects.Sprite | Phaser.GameObjects.Text;
      if (this.scene.textures.exists('icon_lightning')) {
        const iconSprite = this.scene.add.sprite(0, 0, 'icon_lightning');
        iconSprite.setOrigin(0.5, 0.5);
        iconSprite.setScale(0.65);
        badgeContainer.add(iconSprite);
        badgeIcon = iconSprite;
      } else {
        const text = this.scene.add.text(0, 0, '!', {
          fontFamily: FONT_FAMILY,
          fontSize: '10px',
          color: PALETTE.warningOrangeHex,
          fontStyle: 'bold',
        });
        text.setOrigin(0.5, 0.5);
        badgeContainer.add(text);
        badgeIcon = text;
      }

      badgeContainer.setVisible(false);
      bay.container.add(badgeContainer);

      this.badgeBays.set(machine.instanceId, {
        instanceId: machine.instanceId,
        badgeContainer,
        badgeBg,
        badgeIcon,
        pulseTimer: 0,
        sparkCooldown: 0,
      });
    }
  }

  // -------------------------------------------------------------
  // GÜNCELLEME (UPDATE LOOP)
  // -------------------------------------------------------------

  /**
   * Her render karesinde çağrılır.
   * Rozet görünürlüğünü, nabız (pulse) alfalarını ve kıvılcım partiküllerini günceller.
   *
   * @param dt Geçen kare süresi (saniye)
   */
  update(dt: number): void {
    if (dt <= 0) return;

    // 1. İkaz Rozetlerini Güncelle
    for (const [instanceId, badgeBay] of this.badgeBays.entries()) {
      const machine = this.engine.getMachine(instanceId);
      if (!machine) continue;

      const badgeConfig: StatusBadgeConfig = MachineStatusHelper.getBadgeConfig(
        machine.status,
      );

      if (badgeConfig.isWarning) {
        badgeBay.badgeContainer.setVisible(true);
        badgeBay.pulseTimer += dt;

        // Nabız alfa değeri
        const alpha = MachineStatusHelper.computePulseAlpha(
          machine.status,
          badgeBay.pulseTimer,
        );
        badgeBay.badgeContainer.setAlpha(alpha);

        // Renk ve doku senkronizasyonu
        badgeBay.badgeBg.setStrokeStyle(1, badgeConfig.colorNum);
        if ('setTexture' in badgeBay.badgeIcon && this.scene.textures.exists(badgeConfig.iconKey)) {
          badgeBay.badgeIcon.setTexture(badgeConfig.iconKey);
          badgeBay.badgeIcon.setTint(badgeConfig.colorNum);
        } else if ('setText' in badgeBay.badgeIcon) {
          badgeBay.badgeIcon.setColor(badgeConfig.colorHex);
          badgeBay.badgeIcon.setText(machine.status === 'BLOCKED_OUTPUT' ? 'X' : '!');
        }
      } else {
        badgeBay.badgeContainer.setVisible(false);
        badgeBay.pulseTimer = 0;
      }

      // 2. Çalışan Makine Kıvılcımları (PROCESSING durumunda)
      if (machine.status === 'PROCESSING') {
        badgeBay.sparkCooldown -= dt;
        if (badgeBay.sparkCooldown <= 0) {
          // 400ms aralıklarla yeni kıvılcım fırlat
          badgeBay.sparkCooldown = 0.35 + Math.random() * 0.2;
          this.spawnSparkForMachine(machine);
        }
      } else {
        badgeBay.sparkCooldown = 0;
      }
    }

    // 3. Aktif Kıvılcımları İlerlet
    for (const spark of this.sparkPool) {
      if (!spark.active) continue;

      spark.life -= dt * 1000;
      if (spark.life <= 0) {
        spark.active = false;
        spark.sprite.setVisible(false);
        spark.sprite.setActive(false);
        continue;
      }

      spark.sprite.x += spark.vx * dt;
      spark.sprite.y += spark.vy * dt;

      // Kalan ömre göre sönme (fade-out)
      const progress = Math.max(0, spark.life / spark.maxLife);
      spark.sprite.setAlpha(progress);
    }
  }

  /**
   * Çalışan bir makine için havuzdan bir kıvılcım partikülü fırlatır.
   */
  private spawnSparkForMachine(machine: import('../simulation/MachineEntity.ts').MachineEntity): void {
    const bay = this.machineRenderer.getBay(machine.instanceId);
    if (!bay) return;

    // Boşta kıvılcım bul
    const spark = this.sparkPool.find((s) => !s.active);
    if (!spark) return;

    const bounds: MachineVisualBounds = MachineVisualGeometry.computeBounds(
      machine.coord,
      machine.effectiveWidth,
      machine.effectiveHeight,
      machine.rotation,
      this.machineRenderer.tileSize,
    );

    const data: ParticleSpawnPoint = MachineStatusHelper.computeSparkSpawn(bounds);

    spark.active = true;
    spark.life = data.lifespanMs;
    spark.maxLife = data.lifespanMs;
    spark.vx = data.vx;
    spark.vy = data.vy;

    spark.sprite.setPosition(data.x, data.y);
    spark.sprite.setScale(data.scale);
    spark.sprite.setAlpha(1.0);
    spark.sprite.setVisible(true);
    spark.sprite.setActive(true);
  }

  // -------------------------------------------------------------
  // TEMİZLİK VE İMHA
  // -------------------------------------------------------------

  private clearBadges(): void {
    for (const bay of this.badgeBays.values()) {
      bay.badgeContainer.destroy();
    }
    this.badgeBays.clear();
  }

  /**
   * Tüm durum göstergesi bileşenlerini imha eder.
   */
  destroy(): void {
    this.clearBadges();
    for (const spark of this.sparkPool) {
      spark.sprite.destroy();
    }
    this.sparkPool.length = 0;
    this.rootContainer.destroy();
  }
}
