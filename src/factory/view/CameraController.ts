/* ======================================================================
 * src/factory/view/CameraController.ts — Fabrika Katı Kamera Kontrolcüsü
 *
 * Fabrika zemininde yumuşak ve gecikmesiz kaydırma (Pan / sürükleme),
 * fare tekerleği ve dokunmatik ile yakınlaştırma (Zoom), sınırlandırma (Clamping),
 * WASD / yön tuşları desteği ve fabrikaya/makineye odaklanma (Focus)
 * işlemlerini yöneten Phaser 3 kontrolcüsü.
 *
 * docs/ART_DIRECTION.md sub-pixel rounding kurallarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { GridCoord } from '../types.ts';
import { CameraMath, type CameraBounds } from './CameraMath.ts';
import { GridCoordinates } from './GridCoordinates.ts';
import type { GridView } from './GridView.ts';

export interface CameraControllerConfig {
  minZoom?: number;
  maxZoom?: number;
  zoomStep?: number;
  padding?: number;
  enableKeyboard?: boolean;
  enableWheelZoom?: boolean;
  enableDragPan?: boolean;
  keyboardPanSpeed?: number;
}

export class CameraController {
  readonly scene: Phaser.Scene;
  readonly camera: Phaser.Cameras.Scene2D.Camera;

  readonly minZoom: number;
  readonly maxZoom: number;
  readonly zoomStep: number;
  readonly padding: number;
  readonly keyboardPanSpeed: number;

  private enableKeyboard: boolean;
  private enableWheelZoom: boolean;
  private enableDragPan: boolean;

  /** Fabrika dünya sınırları */
  private worldWidth = 256;
  private worldHeight = 256;

  /** Sürükleme durumu */
  private isDragging = false;
  private dragStartPointerX = 0;
  private dragStartPointerY = 0;
  private dragStartCameraX = 0;
  private dragStartCameraY = 0;

  /** Klavye tuşları */
  private cursors?: Phaser.Types.Input.Keyboard.CursorKeys;
  private wasdKeys?: {
    W: Phaser.Input.Keyboard.Key;
    A: Phaser.Input.Keyboard.Key;
    S: Phaser.Input.Keyboard.Key;
    D: Phaser.Input.Keyboard.Key;
  };

  /** Etkinlik durumu (Modal pencereler açıkken kamera durdurulabilir) */
  private enabled = true;

  /** Olay dinleyicisi referansları (Temiz imha için) */
  private onWheelBound: (
    pointer: Phaser.Input.Pointer,
    gameObjects: Phaser.GameObjects.GameObject[],
    deltaX: number,
    deltaY: number,
    deltaZ: number,
  ) => void;
  private onPointerDownBound: (pointer: Phaser.Input.Pointer) => void;
  private onPointerMoveBound: (pointer: Phaser.Input.Pointer) => void;
  private onPointerUpBound: (pointer: Phaser.Input.Pointer) => void;

  constructor(
    scene: Phaser.Scene,
    config: CameraControllerConfig = {},
    camera: Phaser.Cameras.Scene2D.Camera = scene.cameras.main,
  ) {
    this.scene = scene;
    this.camera = camera;

    this.minZoom = config.minZoom ?? CameraMath.DEFAULT_MIN_ZOOM;
    this.maxZoom = config.maxZoom ?? CameraMath.DEFAULT_MAX_ZOOM;
    this.zoomStep = config.zoomStep ?? CameraMath.DEFAULT_ZOOM_STEP;
    this.padding = config.padding ?? 64;
    this.keyboardPanSpeed = config.keyboardPanSpeed ?? 400; // px/s

    this.enableKeyboard = config.enableKeyboard ?? true;
    this.enableWheelZoom = config.enableWheelZoom ?? true;
    this.enableDragPan = config.enableDragPan ?? true;

    // Kamera ayarları
    this.camera.setRoundPixels(true);

    // Olay fonksiyonlarını bağla
    this.onWheelBound = this.handleWheel.bind(this);
    this.onPointerDownBound = this.handlePointerDown.bind(this);
    this.onPointerMoveBound = this.handlePointerMove.bind(this);
    this.onPointerUpBound = this.handlePointerUp.bind(this);

    this.setupInputs();
  }

  // -------------------------------------------------------------
  // GİRDİ BAĞLANTILARI (INPUT HOOKS)
  // -------------------------------------------------------------

  private setupInputs(): void {
    if (!this.scene.input) return;

    // Fare tekerleği zoom
    if (this.enableWheelZoom) {
      this.scene.input.on('wheel', this.onWheelBound);
    }

    // Sürükleme (Drag-pan)
    if (this.enableDragPan) {
      this.scene.input.on('pointerdown', this.onPointerDownBound);
      this.scene.input.on('pointermove', this.onPointerMoveBound);
      this.scene.input.on('pointerup', this.onPointerUpBound);
    }

    // Klavye kontrolleri
    if (this.enableKeyboard && this.scene.input.keyboard) {
      this.cursors = this.scene.input.keyboard.createCursorKeys();
      this.wasdKeys = {
        W: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.W),
        A: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A),
        S: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.S),
        D: this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D),
      };
    }
  }

  // -------------------------------------------------------------
  // FARE VE DOKUNMATİK ETKİLEŞİMİ (WHEEL & DRAG)
  // -------------------------------------------------------------

  private handleWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    if (!this.enabled) return;

    const direction = deltaY < 0 ? 1 : -1;
    this.zoomStepAtPointer(direction, pointer.x, pointer.y);
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled) return;

    // Orta tuş (wheel button) veya sol tık ile sürükleme
    // Sürükleme başlangıcı: sol tık (button 0) veya orta tuş (button 1)
    if (pointer.button === 0 || pointer.button === 1) {
      this.isDragging = true;
      this.dragStartPointerX = pointer.x;
      this.dragStartPointerY = pointer.y;
      this.dragStartCameraX = this.camera.scrollX;
      this.dragStartCameraY = this.camera.scrollY;
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled || !this.isDragging) return;

    // Fare hareket farkını zoom faktörüne bölerek kameraya uygula
    const dx = (this.dragStartPointerX - pointer.x) / this.camera.zoom;
    const dy = (this.dragStartPointerY - pointer.y) / this.camera.zoom;

    const targetX = this.dragStartCameraX + dx;
    const targetY = this.dragStartCameraY + dy;

    this.setScroll(targetX, targetY);
  }

  private handlePointerUp(): void {
    this.isDragging = false;
  }

  // -------------------------------------------------------------
  // YAKINLAŞTIRMA (ZOOM) VE İMLEÇ MERKEZİ (ANCHOR)
  // -------------------------------------------------------------

  /**
   * Fare imlecinin işaret ettiği noktayı sabitleyerek zoom yapar.
   */
  zoomStepAtPointer(direction: 1 | -1, pointerScreenX: number, pointerScreenY: number): void {
    const currentZoom = this.camera.zoom;
    const nextZoom = CameraMath.getNextDiscreteZoom(
      currentZoom,
      direction,
      this.zoomStep,
      this.minZoom,
      this.maxZoom,
    );

    if (nextZoom === currentZoom) return;

    // İmlecin zoom öncesi dünya koordinatı
    const worldPointBefore = this.camera.getWorldPoint(pointerScreenX, pointerScreenY);

    this.camera.setZoom(nextZoom);

    // Zoom sonrası imlecin yeni dünya koordinatı
    const worldPointAfter = this.camera.getWorldPoint(pointerScreenX, pointerScreenY);

    // Kaymayı telafi et
    const newScrollX = this.camera.scrollX + (worldPointBefore.x - worldPointAfter.x);
    const newScrollY = this.camera.scrollY + (worldPointBefore.y - worldPointAfter.y);

    this.setScroll(newScrollX, newScrollY);
  }

  zoomIn(): void {
    const nextZoom = CameraMath.getNextDiscreteZoom(
      this.camera.zoom,
      1,
      this.zoomStep,
      this.minZoom,
      this.maxZoom,
    );
    this.setZoom(nextZoom);
  }

  zoomOut(): void {
    const nextZoom = CameraMath.getNextDiscreteZoom(
      this.camera.zoom,
      -1,
      this.zoomStep,
      this.minZoom,
      this.maxZoom,
    );
    this.setZoom(nextZoom);
  }

  setZoom(zoom: number): void {
    const clamped = CameraMath.clampZoom(zoom, this.minZoom, this.maxZoom);
    this.camera.setZoom(clamped);
    this.clampCurrentPosition();
  }

  // -------------------------------------------------------------
  // KONUMLANDIRMA VE SINIRLANDIRMA (SCROLL & CLAMP)
  // -------------------------------------------------------------

  /**
   * Kamerayı sınırlar içinde kalacak şekilde belirtilen dünya koordinatına taşır.
   */
  setScroll(scrollX: number, scrollY: number): void {
    const bounds = this.getPanBounds();
    const clamped = CameraMath.clampPosition(scrollX, scrollY, bounds);
    this.camera.setScroll(clamped.x, clamped.y);
  }

  private clampCurrentPosition(): void {
    this.setScroll(this.camera.scrollX, this.camera.scrollY);
  }

  private getPanBounds(): CameraBounds {
    const viewport = {
      width: this.camera.width,
      height: this.camera.height,
    };
    return CameraMath.computePanBounds(
      this.worldWidth,
      this.worldHeight,
      viewport,
      this.camera.zoom,
      this.padding,
    );
  }

  // -------------------------------------------------------------
  // DÜNYA BOYUTU VE HİZALAMA (GRID BINDING & CENTERING)
  // -------------------------------------------------------------

  /**
   * Fabrika dünya piksel boyutlarını günceller (parsel açılımlarında çağrılır).
   */
  setWorldSize(width: number, height: number): void {
    this.worldWidth = Math.max(32, width);
    this.worldHeight = Math.max(32, height);
    this.clampCurrentPosition();
  }

  /**
   * Bir GridView nesnesine bağlanarak parsel genişliğini otomatik alır.
   */
  attachGridView(gridView: GridView): void {
    this.setWorldSize(
      gridView.getActivePixelWidth(),
      gridView.getActivePixelHeight(),
    );
  }

  /**
   * Kamerayı fabrikanın tam ortasına hizalar.
   */
  centerOnFactory(): void {
    const viewport = {
      width: this.camera.width,
      height: this.camera.height,
    };
    const centerPos = CameraMath.computeCenterPosition(
      this.worldWidth,
      this.worldHeight,
      viewport,
      this.camera.zoom,
    );
    this.setScroll(centerPos.x, centerPos.y);
  }

  /**
   * Belirtilen karo koordinatına yumuşak veya anlık odaklanır.
   */
  focusOnGridCoord(
    coord: GridCoord,
    tileSize = GridCoordinates.DEFAULT_TILE_SIZE,
    smooth = true,
  ): void {
    const centerWorld = GridCoordinates.gridToWorldCenter(coord, tileSize);
    const viewport = {
      width: this.camera.width,
      height: this.camera.height,
    };
    const targetScroll = CameraMath.computeFocusPosition(
      centerWorld.x,
      centerWorld.y,
      viewport,
      this.camera.zoom,
    );

    const bounds = this.getPanBounds();
    const clamped = CameraMath.clampPosition(
      targetScroll.x,
      targetScroll.y,
      bounds,
    );

    if (smooth) {
      this.camera.pan(clamped.x, clamped.y, 400, 'Quad.easeOut');
    } else {
      this.setScroll(clamped.x, clamped.y);
    }
  }

  // -------------------------------------------------------------
  // DÖNGÜ GÜNCELLEMESİ (UPDATE & KEYBOARD)
  // -------------------------------------------------------------

  /**
   * Sahnenin update() döngüsünde çağrılır; WASD ve yön tuşlarıyla kaydırma sağlar.
   */
  update(deltaSec: number): void {
    if (!this.enabled || !this.enableKeyboard) return;

    let moveX = 0;
    let moveY = 0;

    const left = this.cursors?.left.isDown || this.wasdKeys?.A.isDown;
    const right = this.cursors?.right.isDown || this.wasdKeys?.D.isDown;
    const up = this.cursors?.up.isDown || this.wasdKeys?.W.isDown;
    const down = this.cursors?.down.isDown || this.wasdKeys?.S.isDown;

    if (left) moveX -= 1;
    if (right) moveX += 1;
    if (up) moveY -= 1;
    if (down) moveY += 1;

    if (moveX !== 0 || moveY !== 0) {
      const step = (this.keyboardPanSpeed * deltaSec) / this.camera.zoom;
      const targetX = this.camera.scrollX + moveX * step;
      const targetY = this.camera.scrollY + moveY * step;
      this.setScroll(targetX, targetY);
    }
  }

  // -------------------------------------------------------------
  // DURUM YÖNETİMİ VE TEMİZLİK (LIFECYCLE)
  // -------------------------------------------------------------

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.isDragging = false;
    }
  }

  destroy(): void {
    if (this.scene.input) {
      this.scene.input.off('wheel', this.onWheelBound);
      this.scene.input.off('pointerdown', this.onPointerDownBound);
      this.scene.input.off('pointermove', this.onPointerMoveBound);
      this.scene.input.off('pointerup', this.onPointerUpBound);
    }
  }
}
