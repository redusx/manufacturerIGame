/* ======================================================================
 * src/factory/input/PlacementController.ts — İnşa ve Yerleşim Kontrolcüsü
 *
 * Seçilen makine, konveyör veya lojistik biriminin ızgara üzerinde
 * fare/dokunma ile canlı hayalet önizlemesini (ghost preview), ızgara
 * kenetlenmesini (snapping), geçerlilik renklendirmesini (yeşil/kırmızı),
 * $R$ tuşuyla 90° döndürmeyi ve inşa onayını yöneten Phaser 3 kontrolcüsü.
 *
 * docs/ART_DIRECTION.md ve src/ui/theme.ts standartlarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import {
  type Direction,
  type GridCoord,
  type MachineDefinition,
} from '../types.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { GridCoordinates } from '../view/GridCoordinates.ts';
import { ConveyorGeometry } from '../view/ConveyorGeometry.ts';
import {
  PlacementMath,
  type PlacementItemType,
  type PlacementValidationResult,
  type PlacementExecuteResult,
} from './PlacementMath.ts';
import { PALETTE } from '../../ui/theme.ts';

export interface PlacementItem {
  type: PlacementItemType;
  machineDef?: MachineDefinition;
}

export interface PlacementControllerConfig {
  tileSize?: number;
  originX?: number;
  originY?: number;
  autoCloseMachines?: boolean;
  onPlaced?: (result: PlacementExecuteResult) => void;
  onCancel?: () => void;
}

export class PlacementController {
  readonly scene: Phaser.Scene;
  readonly grid: GridMap;
  readonly logistics: LogisticsNetwork;
  readonly engine: ProductionEngine;
  readonly economy: FactoryEconomy;

  readonly tileSize: number;
  private originX: number;
  private originY: number;
  private autoCloseMachines: boolean;

  /** İnşa modu etkin mi? */
  private _isActive = false;

  /** İnşa edilmek üzere seçilen öğe */
  private selectedItem: PlacementItem | null = null;

  /** Mevcut yerleşim rotasyonu */
  private currentRotation: Direction = 'NORTH';

  /** İmlecin bulunduğu anlık ızgara kök koordinatı */
  private currentCoord: GridCoord = { x: 0, y: 0 };

  /** Son geçerlilik değerlendirmesi */
  private lastValidation: PlacementValidationResult | null = null;

  /** Hayalet önizleme konteyneri */
  private ghostContainer: Phaser.GameObjects.Container;
  private ghostBoxGraphics: Phaser.GameObjects.Graphics;
  private ghostSprite: Phaser.GameObjects.Sprite | null = null;
  private ghostPortGraphics: Phaser.GameObjects.Graphics;

  /** Klavye dinleyicisi */
  private keyR?: Phaser.Input.Keyboard.Key;
  private keyEsc?: Phaser.Input.Keyboard.Key;

  /** Olay geri çağırmaları */
  onPlaced?: (result: PlacementExecuteResult) => void;
  onCancel?: () => void;

  constructor(
    scene: Phaser.Scene,
    grid: GridMap,
    logistics: LogisticsNetwork,
    engine: ProductionEngine,
    economy: FactoryEconomy,
    config: PlacementControllerConfig = {},
  ) {
    this.scene = scene;
    this.grid = grid;
    this.logistics = logistics;
    this.engine = engine;
    this.economy = economy;

    this.tileSize = config.tileSize ?? GridCoordinates.DEFAULT_TILE_SIZE;
    this.originX = config.originX ?? 0;
    this.originY = config.originY ?? 0;
    this.autoCloseMachines = config.autoCloseMachines ?? false;
    this.onPlaced = config.onPlaced;
    this.onCancel = config.onCancel;

    // Hayalet önizleme katmanı (depth 120: zemin ve bantların üstü, UI altı)
    this.ghostContainer = this.scene.add.container(0, 0).setDepth(120).setVisible(false);
    this.ghostBoxGraphics = this.scene.add.graphics();
    this.ghostPortGraphics = this.scene.add.graphics();
    this.ghostContainer.add([this.ghostBoxGraphics, this.ghostPortGraphics]);

    this.bindInputs();
  }

  get isActive(): boolean {
    return this._isActive;
  }

  get currentItem(): PlacementItem | null {
    return this.selectedItem;
  }

  get rotation(): Direction {
    return this.currentRotation;
  }

  // -------------------------------------------------------------
  // GİRDİ BAĞLANTILARI
  // -------------------------------------------------------------

  private bindInputs(): void {
    this.scene.input.on('pointermove', this.handlePointerMove, this);
    this.scene.input.on('pointerdown', this.handlePointerDown, this);

    if (this.scene.input.keyboard) {
      this.keyR = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
      this.keyR.on('down', () => {
        if (this._isActive) {
          this.rotate(true);
        }
      });

      this.keyEsc = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      this.keyEsc.on('down', () => {
        if (this._isActive) {
          this.cancelPlacement();
        }
      });
    }
  }

  // -------------------------------------------------------------
  // İNŞA MODU YÖNETİMİ
  // -------------------------------------------------------------

  /**
   * Belirtilen öğe için yerleşim modunu başlatır.
   */
  startPlacement(item: PlacementItem): void {
    this.selectedItem = item;
    this._isActive = true;
    this.currentRotation = 'NORTH';
    this.ghostContainer.setVisible(true);

    this.setupGhostSprite();
    this.updateGhostVisuals();
  }

  /**
   * Yerleşim modunu iptal eder ve hayaleti gizler.
   */
  cancelPlacement(): void {
    this._isActive = false;
    this.selectedItem = null;
    this.ghostContainer.setVisible(false);

    if (this.ghostSprite) {
      this.ghostSprite.destroy();
      this.ghostSprite = null;
    }

    if (this.onCancel) {
      this.onCancel();
    }
  }

  /**
   * Yerleşim yönünü 90 derece döndürür ($R$ tuşu).
   */
  rotate(clockwise = true): void {
    this.currentRotation = PlacementMath.rotateDirection(this.currentRotation, clockwise);
    this.updateGhostVisuals();
  }

  // -------------------------------------------------------------
  // FARE VE DOKUNMA DİNLENMESİ
  // -------------------------------------------------------------

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this._isActive || !this.selectedItem) return;

    const worldPoint = pointer.positionToCamera(this.scene.cameras.main) as Phaser.Math.Vector2;
    const gridCoord = GridCoordinates.worldToGrid(
      worldPoint.x,
      worldPoint.y,
      this.tileSize,
      this.originX,
      this.originY,
    );

    if (gridCoord.x !== this.currentCoord.x || gridCoord.y !== this.currentCoord.y) {
      this.currentCoord = gridCoord;
      this.updateGhostPosition();
      this.updateGhostVisuals();
    }
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this._isActive || !this.selectedItem) return;

    // Sağ tık: İptal
    if (pointer.button === 2) {
      this.cancelPlacement();
      return;
    }

    // Sol tık veya dokunma: İnşa et
    if (pointer.button === 0 || pointer.button === -1) {
      this.tryPlaceCurrent();
    }
  }

  /**
   * Anlık konuma yerleşimi gerçekleştirmeyi dener.
   */
  private tryPlaceCurrent(): void {
    if (!this.selectedItem) return;

    const dimensions = this.economy.getCurrentFactoryDimensions();
    const result = PlacementMath.executePlacement({
      grid: this.grid,
      economy: this.economy,
      engine: this.engine,
      logistics: this.logistics,
      rootCoord: this.currentCoord,
      itemType: this.selectedItem.type,
      direction: this.currentRotation,
      machineDef: this.selectedItem.machineDef,
      unlockedBounds: dimensions,
    });

    if (result.success) {
      this.playBuildPunchEffect();

      if (this.onPlaced) {
        this.onPlaced(result);
      }

      if (this.selectedItem.type === 'MACHINE' && this.autoCloseMachines) {
        this.cancelPlacement();
      } else {
        // Yeni konumu tekrar doğrula
        this.updateGhostVisuals();
      }
    } else {
      this.playErrorShakeEffect();
    }
  }

  // -------------------------------------------------------------
  // HAYALET ÖNİZLEME ÇİZİMİ (GHOST VISUALS)
  // -------------------------------------------------------------

  private setupGhostSprite(): void {
    if (this.ghostSprite) {
      this.ghostSprite.destroy();
      this.ghostSprite = null;
    }

    if (!this.selectedItem) return;

    if (this.selectedItem.type === 'MACHINE' && this.selectedItem.machineDef) {
      const def = this.selectedItem.machineDef;
      const textureKey = this.getMachineTextureKey(def.id);

      if (this.scene.textures.exists(textureKey)) {
        this.ghostSprite = this.scene.add.sprite(0, 0, textureKey);
        this.ghostSprite.setAlpha(0.65);
        this.ghostContainer.add(this.ghostSprite);
      }
    } else if (this.selectedItem.type === 'CONVEYOR') {
      if (this.scene.textures.exists('conveyor_belt')) {
        this.ghostSprite = this.scene.add.sprite(0, 0, 'conveyor_belt');
        this.ghostSprite.setAlpha(0.7);
        this.ghostContainer.add(this.ghostSprite);
      }
    }
  }

  private updateGhostPosition(): void {
    const worldPos = GridCoordinates.gridToWorld(
      this.currentCoord,
      this.tileSize,
      this.originX,
      this.originY,
    );
    this.ghostContainer.setPosition(worldPos.x, worldPos.y);
  }

  private updateGhostVisuals(): void {
    if (!this.selectedItem) return;

    const dimensions = this.economy.getCurrentFactoryDimensions();
    const validation = PlacementMath.validatePlacement({
      grid: this.grid,
      economy: this.economy,
      rootCoord: this.currentCoord,
      itemType: this.selectedItem.type,
      direction: this.currentRotation,
      machineDef: this.selectedItem.machineDef,
      unlockedBounds: dimensions,
    });
    this.lastValidation = validation;

    const effW = validation.effectiveFootprint.width;
    const effH = validation.effectiveFootprint.height;
    const pixelW = effW * this.tileSize;
    const pixelH = effH * this.tileSize;

    const isValid = validation.isValid;
    const tintColor = isValid ? PALETTE.successGreen : PALETTE.dangerRed;
    const fillColor = isValid ? PALETTE.successGreen : PALETTE.dangerRed;

    // 1. Zemin Kutusunu Çiz
    this.ghostBoxGraphics.clear();
    this.ghostBoxGraphics.fillStyle(fillColor, isValid ? 0.35 : 0.45);
    this.ghostBoxGraphics.fillRect(0, 0, pixelW, pixelH);

    this.ghostBoxGraphics.lineStyle(1, tintColor, 0.95);
    this.ghostBoxGraphics.strokeRect(0, 0, pixelW, pixelH);

    // 2. Sprite Konum ve Rotasyonunu Güncelle
    if (this.ghostSprite) {
      this.ghostSprite.setPosition(pixelW * 0.5, pixelH * 0.5);
      this.ghostSprite.setTint(tintColor);

      if (this.selectedItem.type === 'CONVEYOR') {
        const rad = ConveyorGeometry.directionToAngleRad(this.currentRotation);
        this.ghostSprite.setRotation(rad);
        this.ghostSprite.setDisplaySize(this.tileSize, this.tileSize);
      } else if (this.selectedItem.type === 'MACHINE' && this.selectedItem.machineDef) {
        const rotDeg = PlacementMath.directionToRotationDeg(this.currentRotation);
        this.ghostSprite.setAngle(rotDeg);
        this.ghostSprite.setDisplaySize(pixelW, pixelH);
      }
    }

    // 3. Port Oklarını Çiz (Yalnızca makineler için)
    this.ghostPortGraphics.clear();
    if (this.selectedItem.type === 'MACHINE' && validation.previewPorts.length > 0) {
      const halfTile = this.tileSize * 0.5;

      for (const port of validation.previewPorts) {
        // Makine içi yerel merkez
        const localCenterX = port.localCoord.x * this.tileSize + halfTile;
        const localCenterY = port.localCoord.y * this.tileSize + halfTile;

        const arrowDir = port.type === 'OUTPUT' ? port.direction : this.getOpposite(port.direction);
        const arrowRad = ConveyorGeometry.directionToAngleRad(arrowDir);
        const arrowColor = port.type === 'INPUT' ? PALETTE.successGreen : PALETTE.factoryAmber;

        // Port kenar oku
        this.ghostPortGraphics.fillStyle(arrowColor, 0.9);
        this.ghostPortGraphics.lineStyle(1, PALETTE.borderDark, 1.0);

        // Küçük ok üçgeni
        const arrowLen = 8;
        const tipX = localCenterX + Math.cos(arrowRad) * 10;
        const tipY = localCenterY + Math.sin(arrowRad) * 10;

        const leftX = tipX - Math.cos(arrowRad - 0.5) * arrowLen;
        const leftY = tipY - Math.sin(arrowRad - 0.5) * arrowLen;
        const rightX = tipX - Math.cos(arrowRad + 0.5) * arrowLen;
        const rightY = tipY - Math.sin(arrowRad + 0.5) * arrowLen;

        this.ghostPortGraphics.beginPath();
        this.ghostPortGraphics.moveTo(tipX, tipY);
        this.ghostPortGraphics.lineTo(leftX, leftY);
        this.ghostPortGraphics.lineTo(rightX, rightY);
        this.ghostPortGraphics.closePath();
        this.ghostPortGraphics.fillPath();
        this.ghostPortGraphics.strokePath();
      }
    }
  }

  // -------------------------------------------------------------
  // DOKUNSAL GERİBİLDİRİM VE SES / EFEKT
  // -------------------------------------------------------------

  /** İnşa başarılı olduğunda dokunsal ölçekleme zıplaması */
  private playBuildPunchEffect(): void {
    this.scene.tweens.add({
      targets: this.ghostContainer,
      scaleX: 1.15,
      scaleY: 1.15,
      duration: 60,
      yoyo: true,
      ease: 'Back.easeOut',
    });

    // İnşa partikülü
    if (this.scene.textures.exists('star_pixel')) {
      const worldCenter = GridCoordinates.gridToWorldCenter(
        this.currentCoord,
        this.tileSize,
        this.originX,
        this.originY,
      );
      for (let i = 0; i < 4; i++) {
        const spark = this.scene.add
          .sprite(worldCenter.x, worldCenter.y, 'star_pixel')
          .setDepth(130);
        const angle = Math.random() * Math.PI * 2;
        const dist = 12 + Math.random() * 8;

        this.scene.tweens.add({
          targets: spark,
          x: worldCenter.x + Math.cos(angle) * dist,
          y: worldCenter.y + Math.sin(angle) * dist,
          alpha: 0,
          scale: 0.2,
          duration: 300,
          ease: 'Quad.easeOut',
          onComplete: () => spark.destroy(),
        });
      }
    }
  }

  /** Geçersiz yerleşime tıklandığında kırmızı hata sarsıntısı */
  private playErrorShakeEffect(): void {
    const curX = this.ghostContainer.x;
    this.scene.tweens.add({
      targets: this.ghostContainer,
      x: curX + 3,
      duration: 35,
      yoyo: true,
      repeat: 2,
      ease: 'Sine.easeInOut',
      onComplete: () => {
        this.ghostContainer.setX(curX);
      },
    });
  }

  // -------------------------------------------------------------
  // YARDIMCILAR
  // -------------------------------------------------------------

  private getMachineTextureKey(machineId: string): string {
    const keyMap: Record<string, string> = {
      crusher: 'machine_press',
      smelter: 'machine_bench',
      press: 'machine_press',
      cutter: 'machine_welder',
      refinery: 'machine_automation',
      assembler: 'machine_automation',
    };
    return keyMap[machineId] ?? 'machine_press';
  }

  private getOpposite(dir: Direction): Direction {
    const opp: Record<Direction, Direction> = {
      NORTH: 'SOUTH',
      SOUTH: 'NORTH',
      EAST: 'WEST',
      WEST: 'EAST',
    };
    return opp[dir];
  }

  updateOrigin(originX: number, originY: number): void {
    this.originX = originX;
    this.originY = originY;
    if (this._isActive) {
      this.updateGhostPosition();
    }
  }

  destroy(): void {
    this.scene.input.off('pointermove', this.handlePointerMove, this);
    this.scene.input.off('pointerdown', this.handlePointerDown, this);

    if (this.keyR) this.keyR.destroy();
    if (this.keyEsc) this.keyEsc.destroy();

    this.ghostContainer.destroy();
  }
}
