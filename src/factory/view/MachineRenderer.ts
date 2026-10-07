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
} from './MachineVisualGeometry.ts';
import { GridCoordinates } from './GridCoordinates.ts';
import { PALETTE, FONT_FAMILY } from '../../ui/theme.ts';
import { bindWorldTap } from '../input/WorldPointer.ts';
import { DIRECTION_VECTORS, OPPOSITE_DIRECTIONS } from '../types.ts';
import { ConveyorGeometry } from './ConveyorGeometry.ts';
import {
  MACHINE_WORK_FPS,
  MACHINE_WORK_FRAMES,
  PORT_ARROW_IN,
  PORT_ARROW_OUT,
  machineTextureKey,
} from './MachineSprites.ts';

export interface MachineRendererConfig {
  tileSize?: number;
  originX?: number;
  originY?: number;
}

interface MachineVisualBay {
  machine: MachineEntity;
  container: Phaser.GameObjects.Container;
  baseSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
  /** Çıkış okları; çıkış tıkandığında yanıp sönerler */
  outputArrows: Phaser.GameObjects.Image[];
  portGraphicsContainer: Phaser.GameObjects.Container;
  levelBadgeText?: Phaser.GameObjects.Text;
  animTimer: number;
  /** Gösterilen animasyon karesi ve ok durumu (yalnız değişince güncellenir) */
  frame: number;
  arrowAlpha: number;
  arrowBlocked: boolean;
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

    // 1. Makine gövdesi: resim döndürülmez, yönü oklar gösterir. Katalogdaki ve
    //    yerleştirme hayaletindeki dokunun aynısıdır (MachineSprites).
    const textureKey = machineTextureKey(machine.def, machine.rotation);
    let baseSprite: Phaser.GameObjects.Sprite | Phaser.GameObjects.Rectangle;
    if (this.scene.textures.exists(textureKey)) {
      const sprite = this.scene.add.sprite(0, 0, textureKey, 0);
      sprite.setOrigin(0.5, 0.5);
      sprite.setDisplaySize(bounds.pixelW, bounds.pixelH);
      bayContainer.add(sprite);
      baseSprite = sprite;
    } else {
      const rect = this.scene.add.rectangle(0, 0, bounds.pixelW - 4, bounds.pixelH - 4, PALETTE.panelBg);
      bayContainer.add(rect);
      baseSprite = rect;
    }

    // 4. Port Göstergeleri (INPUT / OUTPUT Okları)
    const portContainer = this.scene.add.container(0, 0);
    bayContainer.add(portContainer);

    const outputArrows = this.renderPortIndicators(machine, bounds, portContainer);

    // 5. Seviye rozeti: makine resmini örtmesin diye sol-üst köşede, zeminsiz ve
    //    konturlu yazıdır; 1. seviyede (varsayılan) hiç gösterilmez.
    const level = this.engine.getMachineLevel(machine.instanceId);
    const levelText = this.scene.add.text(
      -bounds.pixelW * 0.5 + 1,
      -bounds.pixelH * 0.5,
      `Lv.${level}`,
      {
        fontFamily: FONT_FAMILY,
        fontSize: '9px',
        color: PALETTE.resourceGoldHex,
        fontStyle: 'bold',
        stroke: '#0c1020',
        strokeThickness: 3,
      },
    );
    levelText.setOrigin(0, 0.5);
    levelText.setVisible(level > 1);
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
      outputArrows,
      portGraphicsContainer: portContainer,
      levelBadgeText: levelText,
      animTimer: 0,
      frame: 0,
      arrowAlpha: 1,
      arrowBlocked: false,
    });
  }

  /**
   * Port oklarını çizer: yeşil ok girdinin makineye girdiği, turuncu ok ürünün
   * çıktığı kenarı ve yönü gösterir. Ok, hücre kenarının tam üstünde durur.
   * Çıkış oklarını döner (çıkış tıkandığında yanıp sönerler).
   */
  private renderPortIndicators(
    machine: MachineEntity,
    bounds: MachineVisualBounds,
    portContainer: Phaser.GameObjects.Container,
  ): Phaser.GameObjects.Image[] {
    const outputArrows: Phaser.GameObjects.Image[] = [];
    const half = this.tileSize * 0.5;

    for (const port of machine.getWorldPorts()) {
      const vec = DIRECTION_VECTORS[port.direction];
      const isInput = port.type === 'INPUT';
      // Ok akış yönüne bakar: giriş içeri, çıkış dışarı
      const flow = isInput ? OPPOSITE_DIRECTIONS[port.direction] : port.direction;

      const arrow = this.scene.add.image(
        Math.round(port.worldCoord.x * this.tileSize + half + vec.dx * half - bounds.centerX),
        Math.round(port.worldCoord.y * this.tileSize + half + vec.dy * half - bounds.centerY),
        isInput ? PORT_ARROW_IN : PORT_ARROW_OUT,
      );
      arrow.setOrigin(0.5, 0.5);
      arrow.setRotation(ConveyorGeometry.directionToAngleRad(flow));
      portContainer.add(arrow);
      if (!isInput) outputArrows.push(arrow);
    }
    return outputArrows;
  }

  /**
   * Her render karesinde çağrılır: seviye rozetini eşitler, çalışan makinenin
   * animasyon karesini ilerletir, çıkışı tıkalı makinenin çıkış okunu yakıp söndürür.
   *
   * @param dt Geçen kare süresi (saniye)
   */
  update(dt: number): void {
    if (dt <= 0) return;

    for (const bay of this.visualBays.values()) {
      const machine = bay.machine;

      if (bay.levelBadgeText) {
        const expected = `Lv.${this.engine.getMachineLevel(machine.instanceId)}`;
        if (bay.levelBadgeText.text !== expected) {
          bay.levelBadgeText.setText(expected);
          bay.levelBadgeText.setVisible(expected !== 'Lv.1');
        }
      }

      bay.animTimer += dt;

      if (bay.baseSprite instanceof Phaser.GameObjects.Sprite) {
        const frame =
          machine.status === 'PROCESSING'
            ? 1 + (Math.floor(bay.animTimer * MACHINE_WORK_FPS) % MACHINE_WORK_FRAMES)
            : 0;
        if (bay.frame !== frame) {
          bay.frame = frame;
          bay.baseSprite.setFrame(frame);
        }
      }

      const blocked = machine.status === 'BLOCKED_OUTPUT';
      const blinkOn = !blocked || Math.floor(bay.animTimer * 3) % 2 === 0;
      const alpha = blinkOn ? 1 : 0.25;
      const tinted = blocked;
      if (bay.arrowAlpha !== alpha || bay.arrowBlocked !== tinted) {
        bay.arrowAlpha = alpha;
        bay.arrowBlocked = tinted;
        for (const arrow of bay.outputArrows) {
          arrow.setAlpha(alpha);
          if (tinted) arrow.setTint(PALETTE.dangerRed);
          else arrow.clearTint();
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
