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
import { isPointerInsideViewport, isPointerOverUi, pointerToGrid } from './WorldPointer.ts';

export interface PlacementItem {
  type: PlacementItemType;
  machineDef?: MachineDefinition;
  sourceCoord?: GridCoord;
  /** INTAKE_NEW için: kurulacak girişin vereceği hammadde */
  intakeItemId?: string;
}

export interface PlacementControllerConfig {
  tileSize?: number;
  originX?: number;
  originY?: number;
  autoCloseMachines?: boolean;
  camera?: Phaser.Cameras.Scene2D.Camera;
  onPlaced?: (result: PlacementExecuteResult) => void;
  onCancel?: () => void;
}

export class PlacementController {
  readonly scene: Phaser.Scene;
  readonly grid: GridMap;
  readonly logistics: LogisticsNetwork;
  readonly engine: ProductionEngine;
  readonly economy: FactoryEconomy;
  private camera: Phaser.Cameras.Scene2D.Camera;

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

  /**
   * Sürükleyerek bant çizimi: basılı tutulurken son geçilen hücre ve son hareket yönü.
   * Bant, imleç hücreden çıkarken çıkış yönüne bakacak şekilde döşenir.
   */
  private beltStroke: { last: GridCoord; direction: Direction | null } | null = null;

  /** Hayalet önizleme konteyneri */
  readonly ghostContainer: Phaser.GameObjects.Container;
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
    this.camera = config.camera ?? scene.cameras.main;

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

  setCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    this.camera = camera;
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
    this.scene.input.on('pointerup', this.handlePointerUp, this);

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

    // Hayalet önceki oturumun hücresinde kalmasın: farede imlecin altına,
    // dokunmatikte (hover olmadığı için) görünen alanın ortasına al.
    const pointer = this.scene.input.activePointer;
    this.currentCoord = pointer.wasTouch ? this.getViewCenterCoord() : this.coordUnder(pointer);
    this.updateGhostPosition();

    this.setupGhostSprite();
    this.updateGhostVisuals();
  }

  /**
   * Dokunmatikte yerleşim iki adımlıdır (önce önizle, sonra aynı yere dokunup onayla).
   * Ucuz ve seri döşenen düz bant bunun dışındadır; tek dokunuşla kurulur.
   */
  get needsTouchConfirm(): boolean {
    return this.selectedItem !== null && this.selectedItem.type !== 'CONVEYOR';
  }

  /** Kamera kaydığında/yakınlaştığında fare imlecinin altındaki hücreyi yeniden eşler. */
  update(): void {
    if (!this._isActive || !this.selectedItem) return;

    const pointer = this.scene.input.activePointer;
    if (pointer.wasTouch) return;

    this.moveGhostTo(this.coordUnder(pointer));
  }

  /**
   * Yerleşim modunu iptal eder ve hayaleti gizler.
   */
  cancelPlacement(): void {
    this._isActive = false;
    this.selectedItem = null;
    this.beltStroke = null;
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

  private coordUnder(pointer: Phaser.Input.Pointer): GridCoord {
    return pointerToGrid(pointer, this.camera, this.tileSize, this.originX, this.originY);
  }

  private getViewCenterCoord(): GridCoord {
    const view = this.camera.worldView;
    return GridCoordinates.worldToGrid(
      view.centerX,
      view.centerY,
      this.tileSize,
      this.originX,
      this.originY,
    );
  }

  private moveGhostTo(coord: GridCoord): void {
    if (coord.x === this.currentCoord.x && coord.y === this.currentCoord.y) return;

    this.currentCoord = coord;
    this.updateGhostPosition();
    this.updateGhostVisuals();
  }

  /** Hücre, hayaletin şu an kapladığı alanın içinde mi? */
  private isInsideGhost(coord: GridCoord): boolean {
    const footprint = this.lastValidation?.effectiveFootprint ?? { width: 1, height: 1 };
    return (
      coord.x >= this.currentCoord.x &&
      coord.x < this.currentCoord.x + footprint.width &&
      coord.y >= this.currentCoord.y &&
      coord.y < this.currentCoord.y + footprint.height
    );
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this._isActive || !this.selectedItem) return;

    const coord = this.coordUnder(pointer);

    if (this.beltStroke && pointer.isDown) {
      // Geçilen her hücreye, bir sonrakine bakan bant döşe
      for (const next of PlacementMath.stepsBetween(this.beltStroke.last, coord)) {
        const direction = PlacementMath.directionBetween(this.beltStroke.last, next);
        if (!direction) break;
        this.placeBeltAt(this.beltStroke.last, direction);
        if (!this.beltStroke) return; // yerleşim modu bu sırada kapandı
        this.beltStroke.last = next;
        this.beltStroke.direction = direction;
      }
    }

    this.moveGhostTo(coord);
  }

  /** Sürükleme bittiğinde çizginin son hücresini (tek tıkta tek bandı) döşer */
  private handlePointerUp(): void {
    const stroke = this.beltStroke;
    this.beltStroke = null;
    if (!stroke || !this._isActive || this.selectedItem?.type !== 'CONVEYOR') return;

    const isSingleClick = stroke.direction === null;
    this.placeBeltAt(stroke.last, stroke.direction ?? this.currentRotation, !isSingleClick);
  }

  /**
   * Çizim sırasında tek bir hücreye bant döşer. Sürüklerken dolu hücrelerin üstünden
   * geçmek olağandır; `quiet` iken başarısız yerleşim hata sarsıntısı vermez.
   */
  private placeBeltAt(coord: GridCoord, direction: Direction, quiet = true): void {
    this.currentRotation = direction;
    this.currentCoord = coord;
    this.updateGhostPosition();
    this.tryPlaceCurrent(quiet);
  }

  private handlePointerDown(
    pointer: Phaser.Input.Pointer,
    currentlyOver?: Phaser.GameObjects.GameObject[],
  ): void {
    if (!this._isActive || !this.selectedItem) return;

    // UI'a yapılan basış (ör. katalogdaki "İNŞA ET") zemine yerleşim sayılmaz
    if (isPointerOverUi(currentlyOver, this.camera)) return;
    if (!isPointerInsideViewport(pointer, this.camera)) return;

    // Sağ tık: İptal
    if (pointer.button === 2) {
      this.cancelPlacement();
      return;
    }

    // Sol tık veya dokunma dışındaki tuşları yoksay
    if (pointer.button !== 0 && pointer.button !== -1) return;

    const pressed = this.coordUnder(pointer);

    if (pointer.wasTouch && this.needsTouchConfirm) {
      // İlk dokunuş hayaleti taşır; hayaletin üstüne ikinci dokunuş kurar
      if (!this.isInsideGhost(pressed)) {
        this.moveGhostTo(pressed);
        return;
      }
    } else {
      // Her zaman gerçekten basılan hücreye kur (imleç hareketi gelmemiş olabilir)
      this.moveGhostTo(pressed);
    }

    // Bant basınca değil bırakınca döşenir: basılı tutup sürüklemek hat çizer
    if (this.selectedItem.type === 'CONVEYOR') {
      this.beltStroke = { last: pressed, direction: null };
      return;
    }

    this.tryPlaceCurrent();
  }

  /**
   * Anlık konuma yerleşimi gerçekleştirmeyi dener.
   */
  private tryPlaceCurrent(quiet = false): void {
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
      sourceCoord: this.selectedItem.sourceCoord,
      intakeItemId: this.selectedItem.intakeItemId,
    });

    if (result.success) {
      this.playBuildPunchEffect();

      if (this.onPlaced) {
        this.onPlaced(result);
      }

      if (
        (this.selectedItem.type === 'MACHINE' && this.autoCloseMachines) ||
        this.selectedItem.type === 'INTAKE_MOVE' ||
        this.selectedItem.type === 'EXPORT_MOVE' ||
        this.selectedItem.type === 'INTAKE_NEW'
      ) {
        this.cancelPlacement();
      } else {
        // Yeni konumu tekrar doğrula
        this.updateGhostVisuals();
      }
    } else if (!quiet) {
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
    } else if (this.selectedItem.type === 'INTAKE_MOVE' || this.selectedItem.type === 'INTAKE_NEW') {
      if (this.scene.textures.exists('factory_intake')) {
        this.ghostSprite = this.scene.add.sprite(0, 0, 'factory_intake');
        this.ghostSprite.setAlpha(0.8);
        this.ghostContainer.add(this.ghostSprite);
      }
    } else if (this.selectedItem.type === 'EXPORT_MOVE') {
      if (this.scene.textures.exists('shipping_crate')) {
        this.ghostSprite = this.scene.add.sprite(0, 0, 'shipping_crate');
        this.ghostSprite.setAlpha(0.8);
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
      sourceCoord: this.selectedItem.sourceCoord,
      intakeItemId: this.selectedItem.intakeItemId,
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
      } else if (
        this.selectedItem.type === 'INTAKE_MOVE' ||
        this.selectedItem.type === 'EXPORT_MOVE' ||
        this.selectedItem.type === 'INTAKE_NEW'
      ) {
        this.ghostSprite.setAngle(0);
        this.ghostSprite.setDisplaySize(this.tileSize, this.tileSize);
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
    this.scene.input.off('pointerup', this.handlePointerUp, this);

    if (this.keyR) this.keyR.destroy();
    if (this.keyEsc) this.keyEsc.destroy();

    this.ghostContainer.destroy();
  }
}
