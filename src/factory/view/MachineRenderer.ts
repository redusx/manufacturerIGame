/* ======================================================================
 * src/factory/view/MachineRenderer.ts — 2D Makine Görselleştirme Katmanı
 *
 * Fabrikadaki tüm makinelerin ızgara üzerindeki gövde sprite'larını,
 * çalışan hareketli parça animasyonlarını (piston/mengene salınımı),
 * dinamik giriş/çıkış port oklarını ve seviye rozetlerini render eder.
 *
 * docs/ART_DIRECTION.md ve src/ui/theme.ts standartlarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { ProductionEngine } from '../simulation/ProductionEngine.ts';
import type { MachineEntity } from '../simulation/MachineEntity.ts';
import {
  MachineVisualGeometry,
  type MachineVisualBounds,
  type PortVisualData,
} from './MachineVisualGeometry.ts';
import { GridCoordinates } from './GridCoordinates.ts';
import { PALETTE, FONT_FAMILY } from '../../ui/theme.ts';
import { bindWorldTap } from '../input/WorldPointer.ts';

export interface MachineRendererConfig {
  tileSize?: number;
  originX?: number;
  originY?: number;
}

interface MachineVisualBay {
  machine: MachineEntity;
  container: Phaser.GameObjects.Container;
  baseSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  activePartSprite?: Phaser.GameObjects.Sprite;
  portGraphicsContainer: Phaser.GameObjects.Container;
  levelBadgeText?: Phaser.GameObjects.Text;
  animTimer: number;
}

export class MachineRenderer {
  readonly scene: Phaser.Scene;
  readonly engine: ProductionEngine;
  readonly tileSize: number;

  private originX: number;
  private originY: number;

  /** Kök Phaser Konteyneri */
  readonly rootContainer: Phaser.GameObjects.Container;

  /** instanceId -> Görsel makine yuvası */
  private visualBays = new Map<string, MachineVisualBay>();

  /** Makineye tıklandığında tetiklenen callback (Inspector modalı için) */
  onMachineClicked?: (machine: MachineEntity) => void;

  /** Basış bir tıklamayı başlatabilir mi? (Araç etkinken basış araca aittir) */
  canStartClick?: () => boolean;

  constructor(
    scene: Phaser.Scene,
    engine: ProductionEngine,
    config: MachineRendererConfig = {},
  ) {
    this.scene = scene;
    this.engine = engine;
    this.tileSize = config.tileSize ?? GridCoordinates.DEFAULT_TILE_SIZE;
    this.originX = config.originX ?? 0;
    this.originY = config.originY ?? 0;

    // Kök konteyneri oluştur
    this.rootContainer = scene.add.container(this.originX, this.originY);

    // İlk çizimi oluştur
    this.rebuild();
  }

  // -------------------------------------------------------------
  // KONUM VE DÖNÜŞÜMLER
  // -------------------------------------------------------------

  setOrigin(x: number, y: number): void {
    this.originX = Math.round(x);
    this.originY = Math.round(y);
    this.rootContainer.setPosition(this.originX, this.originY);
  }

  // -------------------------------------------------------------
  // YENİDEN İNŞA VE GÜNCELLEME (REBUILD & UPDATE)
  // -------------------------------------------------------------

  /**
   * Tüm makineleri ProductionEngine'den okuyup görsel nesnelerini sıfırdan oluşturur.
   */
  rebuild(): void {
    this.clear();

    const machines = this.engine.getAllMachines();
    for (const machine of machines) {
      this.createMachineVisual(machine);
    }
  }

  /**
   * Tekil bir makine için Phaser görsel nesnelerini oluşturur.
   */
  private createMachineVisual(machine: MachineEntity): void {
    const bounds: MachineVisualBounds = MachineVisualGeometry.computeBounds(
      machine.coord,
      machine.effectiveWidth,
      machine.effectiveHeight,
      machine.rotation,
      this.tileSize,
      0,
      0,
    );

    // Makine merkezinde ana konteyner
    const bayContainer = this.scene.add.container(bounds.centerX, bounds.centerY);

    // 1. Taban Kaidesi / Şasi (Derin çelik arka plan gölgesi)
    const baseBed = this.scene.add.rectangle(
      0,
      0,
      bounds.pixelW - 2,
      bounds.pixelH - 2,
      PALETTE.cardBg,
    );
    bayContainer.add(baseBed);

    // 2. Makine Gövde Sprite'ı
    let baseSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
    if (this.scene.textures.exists(machine.def.spriteBaseKey)) {
      const sprite = this.scene.add.sprite(0, 0, machine.def.spriteBaseKey);
      sprite.setOrigin(0.5, 0.5);
      sprite.setRotation(bounds.rotationRad);
      // Sprite boyutunu ayak izi boyutuna ölçekle (64x64 baz alınır)
      const scaleX = bounds.pixelW / 64;
      const scaleY = bounds.pixelH / 64;
      sprite.setScale(scaleX, scaleY);
      bayContainer.add(sprite);
      baseSprite = sprite;
    } else {
      // Doku yoksa endüstriyel koyu dikdörtgen
      const rect = this.scene.add.rectangle(
        0,
        0,
        bounds.pixelW - 4,
        bounds.pixelH - 4,
        PALETTE.panelBg,
      );
      rect.setRotation(bounds.rotationRad);
      bayContainer.add(rect);
      baseSprite = rect;
    }

    // 3. Çalışan Hareketli Parça Sprite'ı (Moving Part)
    let activePartSprite: Phaser.GameObjects.Sprite | undefined;
    if (
      machine.def.spriteActiveKey &&
      this.scene.textures.exists(machine.def.spriteActiveKey)
    ) {
      const part = this.scene.add.sprite(0, 0, machine.def.spriteActiveKey);
      part.setOrigin(0.5, 0.5);
      part.setRotation(bounds.rotationRad);
      // Hareketli parça ölçeklemesi
      const scaleX = (bounds.pixelW / 64) * 0.9;
      const scaleY = (bounds.pixelH / 64) * 0.9;
      part.setScale(scaleX, scaleY);
      bayContainer.add(part);
      activePartSprite = part;
    }

    // 4. Port Göstergeleri (INPUT / OUTPUT Okları)
    const portContainer = this.scene.add.container(0, 0);
    bayContainer.add(portContainer);

    this.renderPortIndicators(machine, bounds, portContainer);

    // 5. Seviye Rozeti (Level Badge: Lv.N)
    const level = this.engine.getMachineLevel(machine.instanceId);
    const badgeBg = this.scene.add.rectangle(
      -bounds.pixelW * 0.5 + 14,
      -bounds.pixelH * 0.5 + 8,
      24,
      12,
      PALETTE.borderDark,
    );
    badgeBg.setOrigin(0.5, 0.5);
    bayContainer.add(badgeBg);

    const levelText = this.scene.add.text(
      -bounds.pixelW * 0.5 + 14,
      -bounds.pixelH * 0.5 + 8,
      `Lv.${level}`,
      {
        fontFamily: FONT_FAMILY,
        fontSize: '9px',
        color: PALETTE.resourceGoldHex,
        fontStyle: 'bold',
      },
    );
    levelText.setOrigin(0.5, 0.5);
    bayContainer.add(levelText);

    // 6. Etkileşim Alanı (Tıklama Bölgesi)
    const hitZone = this.scene.add.zone(0, 0, bounds.pixelW, bounds.pixelH);
    hitZone.setInteractive({ useHandCursor: true });
    bindWorldTap(
      hitZone,
      () => {
        if (this.onMachineClicked) {
          this.onMachineClicked(machine);
        }
      },
      () => (this.canStartClick ? this.canStartClick() : true),
    );
    bayContainer.add(hitZone);

    this.rootContainer.add(bayContainer);

    this.visualBays.set(machine.instanceId, {
      machine,
      container: bayContainer,
      baseSprite,
      activePartSprite,
      portGraphicsContainer: portContainer,
      levelBadgeText: levelText,
      animTimer: 0,
    });
  }

  /**
   * Port giriş ve çıkış oklarını çizer.
   */
  private renderPortIndicators(
    machine: MachineEntity,
    bounds: MachineVisualBounds,
    portContainer: Phaser.GameObjects.Container,
  ): void {
    const worldPorts = machine.getWorldPorts();
    const portVisuals: PortVisualData[] = MachineVisualGeometry.computePortVisuals(
      worldPorts,
      this.tileSize,
      0,
      0,
    );

    for (const pv of portVisuals) {
      // Bay container merkezine göre bağıl koordinat
      const localX = pv.arrowWorldX - bounds.centerX;
      const localY = pv.arrowWorldY - bounds.centerY;

      const isInput = pv.type === 'INPUT';
      const color = isInput ? PALETTE.successGreen : PALETTE.factoryAmber;

      // Küçük piksel gösterge oku (8x8 dikdörtgen taban)
      const arrowIndicator = this.scene.add.rectangle(
        localX,
        localY,
        6,
        6,
        color,
      );
      arrowIndicator.setOrigin(0.5, 0.5);
      arrowIndicator.setRotation(pv.arrowAngleRad);
      portContainer.add(arrowIndicator);
    }
  }

  /**
   * Her render karesinde çağrılır.
   * Makinelerin animasyon sayaçlarını ilerletir ve çalışan parçaların
   * fiziksel piston salınımını günceller.
   *
   * @param dt Geçen kare süresi (saniye)
   */
  update(dt: number): void {
    if (dt <= 0) return;

    for (const bay of this.visualBays.values()) {
      const machine = bay.machine;

      // 1. Seviye metnini senkronize et
      if (bay.levelBadgeText) {
        const currentLevel = this.engine.getMachineLevel(machine.instanceId);
        const expected = `Lv.${currentLevel}`;
        if (bay.levelBadgeText.text !== expected) {
          bay.levelBadgeText.setText(expected);
        }
      }

      // 2. Hareketli parça animasyonu (yalnızca PROCESSING durumunda)
      if (bay.activePartSprite) {
        if (machine.status === 'PROCESSING') {
          bay.animTimer += dt;
          const offset = MachineVisualGeometry.computeActivePartOffset(
            machine.status,
            bay.animTimer,
            3.0,
          );
          bay.activePartSprite.setPosition(offset.offsetX, offset.offsetY);
        } else {
          bay.activePartSprite.setPosition(0, 0);
          bay.animTimer = 0;
        }
      }
    }
  }

  /**
   * Belirli bir makine görsel yuvasını döner.
   */
  getBay(instanceId: string): MachineVisualBay | undefined {
    return this.visualBays.get(instanceId);
  }

  /**
   * Tüm makine görsellerini temizler.
   */
  clear(): void {
    for (const bay of this.visualBays.values()) {
      bay.container.destroy();
    }
    this.visualBays.clear();
    this.rootContainer.removeAll(true);
  }

  /**
   * Render katmanını tamamen sonlandırır ve imha eder.
   */
  destroy(): void {
    this.clear();
    this.rootContainer.destroy();
  }
}
