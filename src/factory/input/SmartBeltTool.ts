/* ======================================================================
 * src/factory/input/SmartBeltTool.ts — Akıllı Konveyör Çizim Aracı
 *
 * Oyuncunun fabrika ızgarası üzerinde sürükle-bırak (drag & drop) veya
 * iki nokta seçerek (Point A -> Point B) tek hamlede engellerin etrafından
 * dolaşan, L-şekilli temiz hatlara sahip konveyör hatları döşemesini sağlayan
 * Phaser 3 görsel aracı.
 *
 * docs/ART_DIRECTION.md, DEC-008 ve src/ui/theme.ts standartlarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { GridCoord } from '../types.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { GridCoordinates } from '../view/GridCoordinates.ts';
import { ConveyorGeometry } from '../view/ConveyorGeometry.ts';
import {
  SmartBeltPathfinder,
  type BeltPathResult,
} from './SmartBeltPathfinder.ts';
import { PALETTE, FONT_FAMILY } from '../../ui/theme.ts';

export interface SmartBeltToolConfig {
  tileSize?: number;
  originX?: number;
  originY?: number;
  onPathBuilt?: (result: BeltPathResult) => void;
  onCancel?: () => void;
}

export class SmartBeltTool {
  readonly scene: Phaser.Scene;
  readonly grid: GridMap;
  readonly logistics: LogisticsNetwork;
  readonly engine?: ProductionEngine;
  readonly economy: FactoryEconomy;

  readonly tileSize: number;
  private originX: number;
  private originY: number;

  /** Araç aktif mi? */
  private _isActive = false;

  /** Sürükleme başladı mı? */
  private isDragging = false;

  /** Başlangıç ve anlık bitiş koordinatları */
  private startCoord: GridCoord | null = null;
  private currentEndCoord: GridCoord | null = null;

  /** Son hesaplanan yol sonucu */
  private lastResult: BeltPathResult | null = null;

  /** Önizleme grafik nesneleri */
  private previewContainer: Phaser.GameObjects.Container;
  private pathGraphics: Phaser.GameObjects.Graphics;
  private arrowGraphics: Phaser.GameObjects.Graphics;
  private costBadgeText: Phaser.GameObjects.Text;

  /** Olay geri çağırmaları */
  onPathBuilt?: (result: BeltPathResult) => void;
  onCancel?: () => void;

  constructor(
    scene: Phaser.Scene,
    grid: GridMap,
    logistics: LogisticsNetwork,
    economy: FactoryEconomy,
    config: SmartBeltToolConfig = {},
    engine?: ProductionEngine,
  ) {
    this.scene = scene;
    this.grid = grid;
    this.logistics = logistics;
    this.economy = economy;
    this.engine = engine;

    this.tileSize = config.tileSize ?? GridCoordinates.DEFAULT_TILE_SIZE;
    this.originX = config.originX ?? 0;
    this.originY = config.originY ?? 0;
    this.onPathBuilt = config.onPathBuilt;
    this.onCancel = config.onCancel;

    // Önizleme katmanı (depth 115: makinelerin ve bantların üstü)
    this.previewContainer = this.scene.add.container(0, 0).setDepth(115).setVisible(false);
    this.pathGraphics = this.scene.add.graphics();
    this.arrowGraphics = this.scene.add.graphics();

    this.costBadgeText = this.scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        color: PALETTE.resourceGoldHex,
        stroke: '#0c1020',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1.2)
      .setVisible(false);

    this.previewContainer.add([
      this.pathGraphics,
      this.arrowGraphics,
      this.costBadgeText,
    ]);

    this.bindInputs();
  }

  get isActive(): boolean {
    return this._isActive;
  }

  // -------------------------------------------------------------
  // GİRDİ BAĞLANTILARI
  // -------------------------------------------------------------

  private bindInputs(): void {
    this.scene.input.on('pointerdown', this.handlePointerDown, this);
    this.scene.input.on('pointermove', this.handlePointerMove, this);
    this.scene.input.on('pointerup', this.handlePointerUp, this);

    if (this.scene.input.keyboard) {
      const keyEsc = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      keyEsc.on('down', () => {
        if (this._isActive) {
          this.cancelTool();
        }
      });
    }
  }

  // -------------------------------------------------------------
  // ARAÇ DURUMU (AKTİF / PASİF)
  // -------------------------------------------------------------

  activate(): void {
    this._isActive = true;
    this.isDragging = false;
    this.startCoord = null;
    this.currentEndCoord = null;
    this.lastResult = null;
    this.previewContainer.setVisible(true);
  }

  deactivate(): void {
    this._isActive = false;
    this.isDragging = false;
    this.startCoord = null;
    this.currentEndCoord = null;
    this.lastResult = null;
    this.clearGraphics();
    this.previewContainer.setVisible(false);
  }

  cancelTool(): void {
    this.deactivate();
    if (this.onCancel) {
      this.onCancel();
    }
  }

  // -------------------------------------------------------------
  // FARE VE SÜRÜKLEME DİNLENMESİ
  // -------------------------------------------------------------

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this._isActive) return;

    // Sağ tık: İptal
    if (pointer.button === 2) {
      this.cancelTool();
      return;
    }

    // Sol tık: Başlangıç noktasını belirle
    if (pointer.button === 0 || pointer.button === -1) {
      const worldPoint = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
      const coord = GridCoordinates.worldToGrid(
        worldPoint.x,
        worldPoint.y,
        this.tileSize,
        this.originX,
        this.originY,
      );

      if (this.grid.isInBounds(coord.x, coord.y)) {
        this.isDragging = true;
        this.startCoord = coord;
        this.currentEndCoord = coord;
        this.updatePathPreview();
      }
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this._isActive || !this.isDragging || !this.startCoord) return;

    const worldPoint = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    const coord = GridCoordinates.worldToGrid(
      worldPoint.x,
      worldPoint.y,
      this.tileSize,
      this.originX,
      this.originY,
    );

    if (
      !this.currentEndCoord ||
      coord.x !== this.currentEndCoord.x ||
      coord.y !== this.currentEndCoord.y
    ) {
      this.currentEndCoord = coord;
      this.updatePathPreview();
    }
  }

  private handlePointerUp(pointer: Phaser.Input.Pointer): void {
    if (!this._isActive || !this.isDragging || !this.startCoord) return;

    if (pointer.button === 0 || pointer.button === -1) {
      this.isDragging = false;

      if (this.lastResult && this.lastResult.success && this.lastResult.canAfford) {
        this.executeCurrentPath();
      } else {
        this.clearGraphics();
      }

      this.startCoord = null;
      this.currentEndCoord = null;
      this.lastResult = null;
    }
  }

  // -------------------------------------------------------------
  // YOL HESAPLAMA VE ÇİZİMİ
  // -------------------------------------------------------------

  private updatePathPreview(): void {
    if (!this.startCoord || !this.currentEndCoord) {
      this.clearGraphics();
      return;
    }

    if (
      this.startCoord.x === this.currentEndCoord.x &&
      this.startCoord.y === this.currentEndCoord.y
    ) {
      this.clearGraphics();
      return;
    }

    const dimensions = this.economy.getCurrentFactoryDimensions();
    const result = SmartBeltPathfinder.findPath({
      grid: this.grid,
      logistics: this.logistics,
      economy: this.economy,
      startCoord: this.startCoord,
      endCoord: this.currentEndCoord,
      unlockedBounds: dimensions,
    });

    this.lastResult = result;
    this.renderPath(result);
  }

  private renderPath(result: BeltPathResult): void {
    this.pathGraphics.clear();
    this.arrowGraphics.clear();

    if (!result.success || result.steps.length === 0) {
      this.costBadgeText.setVisible(false);
      return;
    }

    const isValid = result.success;
    const canAfford = result.canAfford;

    let tileFillColor = PALETTE.successGreen;
    let borderColor = PALETTE.successGreen;
    let arrowColor = PALETTE.resourceGold;

    if (!canAfford) {
      tileFillColor = PALETTE.warningOrange;
      borderColor = PALETTE.warningOrange;
      arrowColor = PALETTE.warningOrange;
    }

    const halfTile = this.tileSize * 0.5;

    // 1. Her karo için arka plan ve çerçeve çiz
    this.pathGraphics.fillStyle(tileFillColor, 0.4);
    this.pathGraphics.lineStyle(1, borderColor, 0.9);

    for (const step of result.steps) {
      const worldPos = GridCoordinates.gridToWorld(
        step.coord,
        this.tileSize,
        this.originX,
        this.originY,
      );

      this.pathGraphics.fillRect(worldPos.x, worldPos.y, this.tileSize, this.tileSize);
      this.pathGraphics.strokeRect(worldPos.x, worldPos.y, this.tileSize, this.tileSize);

      // Yön oku çiz
      const cx = worldPos.x + halfTile;
      const cy = worldPos.y + halfTile;
      const rad = ConveyorGeometry.directionToAngleRad(step.direction);

      this.arrowGraphics.fillStyle(arrowColor, 0.95);
      this.arrowGraphics.lineStyle(1, PALETTE.borderDark, 1.0);

      const arrowLen = 7;
      const tipX = cx + Math.cos(rad) * 9;
      const tipY = cy + Math.sin(rad) * 9;

      const leftX = tipX - Math.cos(rad - 0.5) * arrowLen;
      const leftY = tipY - Math.sin(rad - 0.5) * arrowLen;
      const rightX = tipX - Math.cos(rad + 0.5) * arrowLen;
      const rightY = tipY - Math.sin(rad + 0.5) * arrowLen;

      this.arrowGraphics.beginPath();
      this.arrowGraphics.moveTo(tipX, tipY);
      this.arrowGraphics.lineTo(leftX, leftY);
      this.arrowGraphics.lineTo(rightX, rightY);
      this.arrowGraphics.closePath();
      this.arrowGraphics.fillPath();
      this.arrowGraphics.strokePath();
    }

    // 2. Maliyet rozetini güncelle
    if (this.currentEndCoord) {
      const endWorldCenter = GridCoordinates.gridToWorldCenter(
        this.currentEndCoord,
        this.tileSize,
        this.originX,
        this.originY,
      );

      const badgeText = canAfford
        ? `${result.steps.length} Bant ($${result.totalCost} ⚙)`
        : `YETERSİZ ($${result.totalCost} ⚙)`;

      this.costBadgeText
        .setPosition(endWorldCenter.x, endWorldCenter.y - 12)
        .setText(badgeText)
        .setColor(canAfford ? PALETTE.resourceGoldHex : PALETTE.dangerRedHex)
        .setVisible(true);
    }
  }

  private clearGraphics(): void {
    this.pathGraphics.clear();
    this.arrowGraphics.clear();
    this.costBadgeText.setVisible(false);
  }

  // -------------------------------------------------------------
  // İNŞA EYLEMİ VE GERİBİLDİRİM
  // -------------------------------------------------------------

  private executeCurrentPath(): void {
    if (!this.lastResult) return;

    const success = SmartBeltPathfinder.executePath(
      this.logistics,
      this.economy,
      this.lastResult,
    );

    if (success) {
      this.playBuildSuccessFeedback(this.lastResult);

      if (this.onPathBuilt) {
        this.onPathBuilt(this.lastResult);
      }
    }

    this.clearGraphics();
  }

  /**
   * İki makineyi doğrudan tek tıkla otomatik bağlar (Makine A -> Makine B).
   */
  connectMachines(fromMachineId: string, toMachineId: string): boolean {
    if (!this.engine) return false;

    const dimensions = this.economy.getCurrentFactoryDimensions();
    const result = SmartBeltPathfinder.findPathBetweenMachines({
      fromMachineId,
      toMachineId,
      engine: this.engine,
      grid: this.grid,
      logistics: this.logistics,
      economy: this.economy,
      unlockedBounds: dimensions,
    });

    if (result.success && result.canAfford) {
      const executed = SmartBeltPathfinder.executePath(
        this.logistics,
        this.economy,
        result,
      );
      if (executed) {
        this.playBuildSuccessFeedback(result);
        if (this.onPathBuilt) {
          this.onPathBuilt(result);
        }
        return true;
      }
    }
    return false;
  }

  private playBuildSuccessFeedback(result: BeltPathResult): void {
    if (this.scene.textures.exists('star_pixel')) {
      for (const step of result.steps) {
        const center = GridCoordinates.gridToWorldCenter(
          step.coord,
          this.tileSize,
          this.originX,
          this.originY,
        );
        const spark = this.scene.add
          .sprite(center.x, center.y, 'star_pixel')
          .setDepth(130);

        this.scene.tweens.add({
          targets: spark,
          y: center.y - 12,
          alpha: 0,
          scale: 0.3,
          duration: 250,
          ease: 'Quad.easeOut',
          onComplete: () => spark.destroy(),
        });
      }
    }
  }

  updateOrigin(originX: number, originY: number): void {
    this.originX = originX;
    this.originY = originY;
  }

  destroy(): void {
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerup', this.handlePointerUp, this);

    this.previewContainer.destroy();
  }
}
