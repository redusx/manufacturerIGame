/* ======================================================================
 * src/factory/input/ClickCollectController.ts — Tıkla & Topla Etkileşim Kontrolcüsü
 *
 * Fabrika zeminine, hammadde silolarına (INTAKE) ve konveyör bantlarındaki
 * eşyalara yapılan tıklamaları dinleyen, anında kısa döngü (short loop)
 * ödülleri dağıtan, yüzen para metinleri (+ $N ⚙) ve piksel geribildirimleri
 * üreten Phaser 3 giriş yöneticisi.
 *
 * docs/ART_DIRECTION.md ve src/ui/theme.ts standartlarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { GridCoord } from '../types.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { ItemRegistry, defaultItemRegistry } from '../simulation/ItemRegistry.ts';
import { GridCoordinates } from '../view/GridCoordinates.ts';
import {
  ClickCollectMath,
  ClickComboTracker,
  type ClickCollectResult,
} from './ClickCollectMath.ts';
import { PALETTE, FONT_FAMILY } from '../../ui/theme.ts';

export interface ClickCollectConfig {
  tileSize?: number;
  originX?: number;
  originY?: number;
  allowFloorClick?: boolean;
  minClickIntervalMs?: number;
  comboResetWindowMs?: number;
  onMachineClick?: (machineInstanceId: string, coord: GridCoord) => void;
  onCollect?: (result: ClickCollectResult) => void;
}

export class ClickCollectController {
  readonly scene: Phaser.Scene;
  readonly grid: GridMap;
  readonly logistics: LogisticsNetwork;
  readonly economy: FactoryEconomy;
  readonly itemRegistry: ItemRegistry;

  readonly tileSize: number;
  private originX: number;
  private originY: number;
  private allowFloorClick: boolean;

  /** Tıklama serisi ve anti-spam takipçisi */
  readonly comboTracker: ClickComboTracker;

  /** Etkileşim aktif mi? (İnşaat veya yıkım modunda kapatılabilir) */
  enabled = true;

  /** Makineye tıklandığında tetiklenen callback (TASK-091 Inspector Modal için) */
  onMachineClick?: (machineInstanceId: string, coord: GridCoord) => void;

  /** Herhangi bir başarılı toplama veya tıklamada tetiklenen callback */
  onCollect?: (result: ClickCollectResult) => void;

  /** Yüzen metinlerin eklendiği Phaser konteyneri */
  private textContainer: Phaser.GameObjects.Container;

  constructor(
    scene: Phaser.Scene,
    grid: GridMap,
    logistics: LogisticsNetwork,
    economy: FactoryEconomy,
    config: ClickCollectConfig = {},
    itemRegistry: ItemRegistry = defaultItemRegistry,
  ) {
    this.scene = scene;
    this.grid = grid;
    this.logistics = logistics;
    this.economy = economy;
    this.itemRegistry = itemRegistry;

    this.tileSize = config.tileSize ?? GridCoordinates.DEFAULT_TILE_SIZE;
    this.originX = config.originX ?? 0;
    this.originY = config.originY ?? 0;
    this.allowFloorClick = config.allowFloorClick ?? true;
    this.onMachineClick = config.onMachineClick;
    this.onCollect = config.onCollect;

    this.comboTracker = new ClickComboTracker(
      config.minClickIntervalMs ?? 40,
      config.comboResetWindowMs ?? 900,
    );

    this.textContainer = this.scene.add.container(0, 0).setDepth(150);

    this.bindEvents();
  }

  // -------------------------------------------------------------
  // GİRİŞ DİNLEME VE ETKİLEŞİM
  // -------------------------------------------------------------

  private bindEvents(): void {
    this.scene.input.on('pointerdown', this.handlePointerDown, this);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled) return;

    // Yalnızca sol fare tıkı veya birincil dokunma
    if (pointer.button !== 0 && pointer.button !== -1) return;

    // Kamera koordinatından dünya piksel koordinatını al
    const worldPoint = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    const worldX = worldPoint.x;
    const worldY = worldPoint.y;

    this.executeClick(worldX, worldY);
  }

  /**
   * Belirtilen dünya koordinatında tıklama eylemini çalıştırır.
   * Sahne içi manuel üretim butonlarından da doğrudan çağrılabilir.
   */
  executeClick(worldX: number, worldY: number): ClickCollectResult {
    const result = ClickCollectMath.handleClick(
      {
        worldX,
        worldY,
        grid: this.grid,
        logistics: this.logistics,
        economy: this.economy,
        itemRegistry: this.itemRegistry,
        tileSize: this.tileSize,
        originX: this.originX,
        originY: this.originY,
        allowFloorClick: this.allowFloorClick,
        currentTimeMs: Date.now(),
      },
      this.comboTracker,
    );

    if (result.type === 'MACHINE' && result.machineInstanceId) {
      if (this.onMachineClick) {
        this.onMachineClick(result.machineInstanceId, result.gridCoord);
      }
      return result;
    }

    if (result.success) {
      this.showFloatingNotice(result.worldX, result.worldY, result.text, result.textColor);
      this.playTactilePop(result);

      if (this.onCollect) {
        this.onCollect(result);
      }
    }

    return result;
  }

  /**
   * HUD veya harici butonlardan manuel tıklamayı tetikler.
   */
  triggerManualClick(): ClickCollectResult {
    // Fabrika merkezini varsayılan koordinat olarak kullan
    const centerX = this.originX + Math.floor((this.grid.width * this.tileSize) / 2);
    const centerY = this.originY + Math.floor((this.grid.height * this.tileSize) / 2);
    return this.executeClick(centerX, centerY);
  }

  // -------------------------------------------------------------
  // GÖRSEL GERİBİLDİRİM VE YÜZEN METİNLER (FEEDBACK & JUICE)
  // -------------------------------------------------------------

  /**
   * Yüzen kazanç metnini (+ $N ⚙) gösterir ve yukarı süzerek yok eder.
   */
  private showFloatingNotice(
    x: number,
    y: number,
    text: string,
    color = PALETTE.resourceGoldHex,
  ): void {
    if (!text) return;

    const motion = ClickCollectMath.computeFloatingTextMotion(y, 28, 550);

    const textObj = this.scene.add
      .text(x, y, text, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        color,
        fontStyle: 'bold',
        stroke: '#0c1020',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setScale(motion.initialScale);

    this.textContainer.add(textObj);

    // Büyüme ve yukarı süzülme animasyonu
    this.scene.tweens.add({
      targets: textObj,
      y: motion.targetY,
      alpha: motion.finalAlpha,
      scaleX: motion.peakScale,
      scaleY: motion.peakScale,
      duration: motion.durationMs,
      ease: 'Quad.easeOut',
      onComplete: () => {
        textObj.destroy();
      },
    });
  }

  /**
   * Tıklanan hedefin türüne göre dokunsal piksel animasyonu oynatır.
   */
  private playTactilePop(result: ClickCollectResult): void {
    // Eşya toplandıysa veya silodan hammadde çıkarıldıysa mikro kıvılcım efekti
    if (result.type === 'CONVEYOR_ITEM' || result.type === 'INTAKE') {
      const textureKey = this.scene.textures.exists('star_pixel')
        ? 'star_pixel'
        : undefined;

      if (textureKey) {
        const sparkCount = result.type === 'INTAKE' ? 4 : 2;
        for (let i = 0; i < sparkCount; i++) {
          const angle = Math.random() * Math.PI * 2;
          const dist = 12 + Math.random() * 10;
          const spark = this.scene.add
            .sprite(result.worldX, result.worldY, textureKey)
            .setDepth(140)
            .setScale(1.0);

          this.scene.tweens.add({
            targets: spark,
            x: result.worldX + Math.cos(angle) * dist,
            y: result.worldY + Math.sin(angle) * dist,
            alpha: 0,
            scaleX: 0.3,
            scaleY: 0.3,
            duration: 350 + Math.random() * 150,
            ease: 'Quad.easeOut',
            onComplete: () => spark.destroy(),
          });
        }
      }
    }
  }

  // -------------------------------------------------------------
  // TEMİZLİK VE YAŞAM DÖNGÜSÜ
  // -------------------------------------------------------------

  updateOrigin(originX: number, originY: number): void {
    this.originX = originX;
    this.originY = originY;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.textContainer.destroy();
    this.comboTracker.reset();
  }
}
