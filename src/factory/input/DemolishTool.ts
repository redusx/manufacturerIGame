/* ======================================================================
 * src/factory/input/DemolishTool.ts — Yıkım ve Taşıma Aracı
 *
 * Fabrikadaki herhangi bir makine, konveyör bandı veya lojistik birimini
 * %100 sermaye iadesiyle (DEC-007) sökmeyi, tehlike desenli (hazard X)
 * kırmızı hayalet vurgusu ile önizlemeyi ve dokunsal geri bildirimle
 * yıkım işlemini yürüten Phaser 3 araç kontrolcüsü.
 *
 * docs/ART_DIRECTION.md, DEC-007 ve src/ui/theme.ts standartlarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { GridCoord } from '../types.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { GridCoordinates } from '../view/GridCoordinates.ts';
import {
  DemolishMath,
  type DemolishTargetInfo,
  type DemolishExecuteResult,
} from './DemolishMath.ts';
import { PALETTE, FONT_FAMILY } from '../../ui/theme.ts';
import { isPointerInsideViewport, isPointerOverUi, pointerToGrid } from './WorldPointer.ts';

/** Hiçbir hücreyi göstermeyen koordinat (dokunmatikte ilk dokunuşa kadar hedef yok) */
const NO_COORD: GridCoord = { x: -1, y: -1 };

export interface DemolishToolConfig {
  tileSize?: number;
  originX?: number;
  originY?: number;
  camera?: Phaser.Cameras.Scene2D.Camera;
  onDemolished?: (result: DemolishExecuteResult) => void;
  onCancel?: () => void;
  onProtectedClicked?: (name: string) => void;
}

export class DemolishTool {
  readonly scene: Phaser.Scene;
  readonly grid: GridMap;
  readonly logistics: LogisticsNetwork;
  readonly engine: ProductionEngine;
  readonly economy: FactoryEconomy;
  private camera: Phaser.Cameras.Scene2D.Camera;

  readonly tileSize: number;
  private originX: number;
  private originY: number;

  /** Araç aktif mi? */
  private _isActive = false;

  /** Anlık fare imleci koordinatı */
  private currentCoord: GridCoord = { x: 0, y: 0 };

  /** Anlık hedefin bilgisi */
  private currentTarget: DemolishTargetInfo | null = null;

  /** Görsel önizleme konteyneri */
  readonly overlayContainer: Phaser.GameObjects.Container;
  private highlightGraphics: Phaser.GameObjects.Graphics;
  private badgeText: Phaser.GameObjects.Text;

  /** Olay geri çağırmaları */
  onDemolished?: (result: DemolishExecuteResult) => void;
  onCancel?: () => void;
  onProtectedClicked?: (name: string) => void;

  constructor(
    scene: Phaser.Scene,
    grid: GridMap,
    logistics: LogisticsNetwork,
    engine: ProductionEngine,
    economy: FactoryEconomy,
    config: DemolishToolConfig = {},
  ) {
    this.scene = scene;
    this.grid = grid;
    this.logistics = logistics;
    this.engine = engine;
    this.economy = economy;
    this.camera = config.camera ?? scene.cameras.main;

    this.tileSize = config.tileSize ?? GridCoordinates.DEFAULT_TILE_SIZE;
    this.originX = config.originX ?? 0;
    this.originY = config.originY ?? 0;
    this.onDemolished = config.onDemolished;
    this.onCancel = config.onCancel;
    this.onProtectedClicked = config.onProtectedClicked;

    // Yıkım önizleme katmanı (depth 125: makinelerin ve bantların üstü)
    this.overlayContainer = this.scene.add.container(0, 0).setDepth(125).setVisible(false);
    this.highlightGraphics = this.scene.add.graphics();

    this.badgeText = this.scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '10px',
        color: PALETTE.dangerRedHex,
        stroke: '#0c1020',
        strokeThickness: 3,
      })
      .setOrigin(0.5, 1.2)
      .setVisible(false);

    this.overlayContainer.add([this.highlightGraphics, this.badgeText]);

    this.bindInputs();
  }

  setCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.camera = camera;
  }

  get isActive(): boolean {
    return this._isActive;
  }

  /**
   * Girdi geçici olarak kapalı mı? (pencere açık, iki parmak hareketi sürüyor)
   * Sahne tarafından verilir; kapalıyken basışlar söküm sayılmaz.
   */
  isInputBlocked?: () => boolean;

  /** İşaretli, sökülebilir bir hedef var mı? */
  get hasDemolishTarget(): boolean {
    return this._isActive && (this.currentTarget?.canDemolish ?? false);
  }

  /** İşaretli hedefin adı (yoksa null) */
  get targetName(): string | null {
    return this.hasDemolishTarget ? (this.currentTarget?.name ?? null) : null;
  }

  /** İşaretli hedefi söker (dokunmatikteki "Onayla" düğmesi) */
  confirmDemolish(): void {
    if (!this._isActive) return;
    this.executeDemolishCurrent();
  }

  // -------------------------------------------------------------
  // GİRDİ BAĞLANTILARI
  // -------------------------------------------------------------

  private bindInputs(): void {
    this.scene.input.on('pointermove', this.handlePointerMove, this);
    this.scene.input.on('pointerdown', this.handlePointerDown, this);

    if (this.scene.input.keyboard) {
      const keyEsc = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      keyEsc.on('down', () => {
        if (this._isActive) {
          this.cancelTool();
        }
      });

      const keyX = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.X);
      keyX.on('down', () => {
        if (this._isActive) {
          this.cancelTool();
        } else {
          this.activate();
        }
      });
    }
  }

  // -------------------------------------------------------------
  // YAŞAM DÖNGÜSÜ (AKTİF / PASİF)
  // -------------------------------------------------------------

  activate(): void {
    this._isActive = true;
    this.overlayContainer.setVisible(true);

    // Önceki oturumdan kalan hedefle başlama: farede imlecin altını, dokunmatikte hiçbir şeyi hedefle
    const pointer = this.scene.input.activePointer;
    this.currentCoord = pointer.wasTouch ? NO_COORD : this.coordUnder(pointer);
    this.updateTarget();
  }

  /** Kamera kaydığında/yakınlaştığında fare imlecinin altındaki hedefi yeniden eşler. */
  update(): void {
    if (!this._isActive) return;

    const pointer = this.scene.input.activePointer;
    if (pointer.wasTouch) return;

    this.moveTargetTo(this.coordUnder(pointer));
  }

  deactivate(): void {
    this._isActive = false;
    this.clearVisuals();
    this.overlayContainer.setVisible(false);
  }

  cancelTool(): void {
    this.deactivate();
    if (this.onCancel) {
      this.onCancel();
    }
  }

  // -------------------------------------------------------------
  // İMLEÇ VE TIKLAMA İŞLEMLERİ
  // -------------------------------------------------------------

  private coordUnder(pointer: Phaser.Input.Pointer): GridCoord {
    return pointerToGrid(pointer, this.camera, this.tileSize, this.originX, this.originY);
  }

  private moveTargetTo(coord: GridCoord): void {
    if (coord.x === this.currentCoord.x && coord.y === this.currentCoord.y) return;

    this.currentCoord = coord;
    this.updateTarget();
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this._isActive || this.isInputBlocked?.()) return;
    // Dokunmatikte parmağı sürüklemek hedefi değiştirmez; hedef dokunuşla seçilir
    if (pointer.wasTouch) return;

    this.moveTargetTo(this.coordUnder(pointer));
  }

  private handlePointerDown(
    pointer: Phaser.Input.Pointer,
    currentlyOver?: Phaser.GameObjects.GameObject[],
  ): void {
    if (!this._isActive || this.isInputBlocked?.()) return;

    // UI'a yapılan basış (ör. katalogdaki "SÖK") zeminde söküm sayılmaz
    if (isPointerOverUi(currentlyOver, this.camera)) return;
    if (!isPointerInsideViewport(pointer, this.camera)) return;

    // Sağ tık: Araçtan çık
    if (pointer.button === 2) {
      this.cancelTool();
      return;
    }

    // Sol tık veya dokunma dışındaki tuşları yoksay
    if (pointer.button !== 0 && pointer.button !== -1) return;

    const pressed = this.coordUnder(pointer);
    const wasHighlighted =
      this.currentTarget?.occupiedCoords.some((c) => c.x === pressed.x && c.y === pressed.y) ??
      false;

    // Her zaman gerçekten basılan hücreyi hedefle (imleç hareketi gelmemiş olabilir)
    this.moveTargetTo(pressed);

    // Dokunmatikte ilk dokunuş sökülecek nesneyi işaretler, ikincisi söker
    if (pointer.wasTouch && !wasHighlighted && this.currentTarget?.canDemolish) return;

    this.executeDemolishCurrent();
  }

  private updateTarget(): void {
    const info = DemolishMath.inspectTarget({
      grid: this.grid,
      logistics: this.logistics,
      engine: this.engine,
      economy: this.economy,
      coord: this.currentCoord,
    });

    this.currentTarget = info;
    this.renderHighlight(info);
  }

  private executeDemolishCurrent(): void {
    if (!this.currentTarget || !this.currentTarget.canDemolish) {
      if (
        this.currentTarget &&
        (this.currentTarget.blockReason === 'PROTECTED_INTAKE' ||
          this.currentTarget.blockReason === 'PROTECTED_EXPORT')
      ) {
        this.playErrorShakeEffect();
        if (this.onProtectedClicked) {
          this.onProtectedClicked(this.currentTarget.name);
        }
      }
      return;
    }

    const result = DemolishMath.executeDemolish({
      grid: this.grid,
      logistics: this.logistics,
      engine: this.engine,
      economy: this.economy,
      coord: this.currentCoord,
    });

    if (result.success) {
      this.playDemolishFeedback(result);

      if (this.onDemolished) {
        this.onDemolished(result);
      }

      // Yeni hücre durumunu tekrar incele
      this.updateTarget();
    }
  }

  // -------------------------------------------------------------
  // GÖRSEL GERİBİLDİRİM VE TEHLİKE VURGUSU (VISUAL JUICE)
  // -------------------------------------------------------------

  private renderHighlight(info: DemolishTargetInfo): void {
    this.highlightGraphics.clear();

    if (!info.canDemolish || info.occupiedCoords.length === 0) {
      this.badgeText.setVisible(false);
      return;
    }

    const dangerColor = PALETTE.dangerRed;
    this.highlightGraphics.fillStyle(dangerColor, 0.4);
    this.highlightGraphics.lineStyle(1.5, dangerColor, 0.95);

    let topMinY = Infinity;
    let topCenterX = 0;

    for (const c of info.occupiedCoords) {
      const worldPos = GridCoordinates.gridToWorld(
        c,
        this.tileSize,
        this.originX,
        this.originY,
      );

      // Kırmızı zemin ve sınır
      this.highlightGraphics.fillRect(worldPos.x, worldPos.y, this.tileSize, this.tileSize);
      this.highlightGraphics.strokeRect(worldPos.x, worldPos.y, this.tileSize, this.tileSize);

      // Tehlike "X" deseni
      this.highlightGraphics.lineBetween(
        worldPos.x + 4,
        worldPos.y + 4,
        worldPos.x + this.tileSize - 4,
        worldPos.y + this.tileSize - 4,
      );
      this.highlightGraphics.lineBetween(
        worldPos.x + this.tileSize - 4,
        worldPos.y + 4,
        worldPos.x + 4,
        worldPos.y + this.tileSize - 4,
      );

      if (worldPos.y < topMinY) {
        topMinY = worldPos.y;
        topCenterX = worldPos.x + this.tileSize * 0.5;
      }
    }

    // Yıkım rozeti: Ad ve İade Tutarı
    const label = `SÖK: ${info.name} (+$${info.refundAmount})`;
    this.badgeText
      .setPosition(topCenterX, topMinY - 6)
      .setText(label)
      .setVisible(true);
  }

  private playDemolishFeedback(result: DemolishExecuteResult): void {
    // 1. Yüzen İade Metni
    const firstCoord = result.freedCoords[0] ?? this.currentCoord;
    const center = GridCoordinates.gridToWorldCenter(
      firstCoord,
      this.tileSize,
      this.originX,
      this.originY,
    );

    const floatingText = this.scene.add
      .text(center.x, center.y, `+$${result.refundAmount} iade`, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        color: PALETTE.resourceGoldHex,
        fontStyle: 'bold',
        stroke: '#0c1020',
        strokeThickness: 3,
      })
      .setOrigin(0.5)
      .setDepth(150);

    this.scene.tweens.add({
      targets: floatingText,
      y: center.y - 28,
      alpha: 0,
      duration: 650,
      ease: 'Quad.easeOut',
      onComplete: () => floatingText.destroy(),
    });

    // 2. Yıkım Kıvılcım & Parçacık Patlaması
    if (this.scene.textures.exists('star_pixel')) {
      for (const c of result.freedCoords) {
        const tileCenter = GridCoordinates.gridToWorldCenter(
          c,
          this.tileSize,
          this.originX,
          this.originY,
        );

        for (let i = 0; i < 4; i++) {
          const spark = this.scene.add
            .sprite(tileCenter.x, tileCenter.y, 'star_pixel')
            .setDepth(140)
            .setTint(PALETTE.dangerRed);

          const angle = Math.random() * Math.PI * 2;
          const dist = 14 + Math.random() * 10;

          this.scene.tweens.add({
            targets: spark,
            x: tileCenter.x + Math.cos(angle) * dist,
            y: tileCenter.y + Math.sin(angle) * dist,
            alpha: 0,
            scale: 0.25,
            duration: 300 + Math.random() * 150,
            ease: 'Quad.easeOut',
            onComplete: () => spark.destroy(),
          });
        }
      }
    }
  }

  private playErrorShakeEffect(): void {
    if (this.camera) {
      this.camera.shake(120, 0.003);
    }
  }

  private clearVisuals(): void {
    this.highlightGraphics.clear();
    this.badgeText.setVisible(false);
  }

  updateOrigin(originX: number, originY: number): void {
    this.originX = originX;
    this.originY = originY;
    if (this._isActive) {
      this.updateTarget();
    }
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerdown', this.handlePointerDown, this);
    this.overlayContainer.destroy();
  }
}
