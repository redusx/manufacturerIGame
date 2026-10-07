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
  /** Sığdırmada fabrikanın çevresinde bırakılan ekran pikseli boşluk */
  private static readonly FIT_MARGIN_PX = 12;

  readonly scene: Phaser.Scene;
  readonly camera: Phaser.Cameras.Scene2D.Camera;

  /** Mantıksal (CSS pikseli başına) zoom sınırları; gerçek kamera zoom'u `pixelScale` ile çarpılır */
  private readonly baseMinZoom: number;
  private readonly baseMaxZoom: number;
  private readonly baseZoomStep: number;
  readonly padding: number;
  private readonly baseKeyboardPanSpeed: number;

  /**
   * Tuval pikseli / CSS pikseli. Tuval cihaz çözünürlüğünde çizildiği için dünya
   * aynı fiziksel boyutta görünsün diye bütün zoom değerleri bununla ölçeklenir.
   */
  private pixelScale = 1;

  private enableKeyboard: boolean;
  private enableWheelZoom: boolean;
  private enableDragPan: boolean;

  /** Aktif (açılmış) fabrika alanı: ortalama ve sığdırma buna göre yapılır */
  private worldWidth = 256;
  private worldHeight = 256;

  /** Kaydırılabilir içerik alanı: aktif alan + sıradaki kilitli parsel */
  private contentWidth = 256;
  private contentHeight = 256;

  /** Boyutların otomatik okunduğu ızgara görünümü */
  private gridView?: GridView;

  /**
   * Görüş alanının altında, sığdırma ve ortalamada boş bırakılacak şerit (tuval pikseli).
   * Orada yüzen bir arayüz çubuğu (etkin araç çubuğu) fabrikanın alt sırasını örtmesin diye.
   */
  private fitInsetBottom = 0;

  /** Sürükleme durumu */
  private isDragging = false;
  private dragStartPointerX = 0;
  private dragStartPointerY = 0;
  private dragStartCameraX = 0;
  private dragStartCameraY = 0;

  /** İki parmak hareketi (yakınlaştırma + kaydırma) sürerken tutulan durum */
  private pinch: { startDistance: number; startZoom: number; lastMidX: number; lastMidY: number } | null = null;
  /** Son basışta iki parmak hareketi yapıldı mı? (bırakış tıklama sayılmasın diye) */
  private gestureConsumed = false;

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

    this.baseMinZoom = config.minZoom ?? CameraMath.DEFAULT_MIN_ZOOM;
    this.baseMaxZoom = config.maxZoom ?? CameraMath.DEFAULT_MAX_ZOOM;
    this.baseZoomStep = config.zoomStep ?? CameraMath.DEFAULT_ZOOM_STEP;
    this.padding = config.padding ?? 64;
    this.baseKeyboardPanSpeed = config.keyboardPanSpeed ?? 400; // CSS px/s

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
  // CİHAZ ÇÖZÜNÜRLÜĞÜ (PIXEL SCALE)
  // -------------------------------------------------------------

  get minZoom(): number {
    return this.snapZoom(this.baseMinZoom * this.pixelScale);
  }

  get maxZoom(): number {
    return this.snapZoom(this.baseMaxZoom * this.pixelScale);
  }

  /** Tekerlek / kısayol ile bir adımda değişen zoom miktarı (tuval pikseli cinsinden) */
  get zoomStep(): number {
    if (this.pixelScale < 1.5) return this.baseZoomStep;
    return 0.5 * Math.max(1, Math.round(this.pixelScale / 2));
  }

  private get keyboardPanSpeed(): number {
    return this.baseKeyboardPanSpeed * this.pixelScale;
  }

  /** Piksel sanat bozulmasın diye zoom, adımın tam katına oturtulur */
  private snapZoom(zoom: number): number {
    const step = this.pixelScale < 1.5 ? this.baseZoomStep : 0.5;
    return Math.max(step, Math.round(zoom / step) * step);
  }

  /** Fabrikayı sığdırırken denenen zoom kademeleri (büyükten küçüğe) */
  private getFitLevels(): number[] {
    if (this.pixelScale < 1.5) {
      return CameraMath.FIT_ZOOM_LEVELS.map((level) => level * this.pixelScale);
    }
    const levels: number[] = [];
    for (let zoom = this.maxZoom; zoom >= this.minZoom - 1e-6; zoom -= 0.5) {
      levels.push(Number(zoom.toFixed(2)));
    }
    return levels;
  }

  /**
   * Tuvalin çizim ölçeğini bildirir (UiMetrics.renderScale). Mevcut zoom aynı
   * fiziksel büyüklükte kalacak şekilde yeniden ölçeklenir.
   */
  setPixelScale(scale: number): void {
    const next = Math.max(1, scale);
    if (next === this.pixelScale) return;
    const logicalZoom = this.camera.zoom / this.pixelScale;
    this.pixelScale = next;
    this.camera.setZoom(CameraMath.clampZoom(this.snapZoom(logicalZoom * next), this.minZoom, this.maxZoom));
    this.clampCurrentPosition();
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

    // İki parmakla yakınlaştırma için ikinci dokunma imleci
    if (this.scene.input.manager.pointersTotal < 2) {
      this.scene.input.addPointer(1);
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

  isPointerInViewport(pointer: Phaser.Input.Pointer): boolean {
    const cam = this.camera;
    return (
      pointer.x >= cam.x &&
      pointer.x <= cam.x + cam.width &&
      pointer.y >= cam.y &&
      pointer.y <= cam.y + cam.height
    );
  }

  private handleWheel(
    pointer: Phaser.Input.Pointer,
    _gameObjects: Phaser.GameObjects.GameObject[],
    _deltaX: number,
    deltaY: number,
  ): void {
    if (!this.enabled || !this.isPointerInViewport(pointer)) return;

    const direction = deltaY < 0 ? 1 : -1;
    this.zoomStepAtPointer(direction, pointer.x, pointer.y);
  }

  /** Dışarıdan sol tık pan izni denetleyicisi (örn. inşa modunda sol tık yerleşim içindir) */
  public canPan?: () => boolean;

  /** İki parmak aynı anda ekranda mı? Araçlar bu sırada tek parmak girdisini yoksayar. */
  get isMultiTouch(): boolean {
    const input = this.scene.input;
    return Boolean(input.pointer1?.isDown && input.pointer2?.isDown);
  }

  /** Bu basış sırasında iki parmak hareketi yapıldıysa bırakış tıklama sayılmamalıdır */
  get wasGesture(): boolean {
    return this.gestureConsumed;
  }

  private handlePointerDown(pointer: Phaser.Input.Pointer): void {
    if (!this.isMultiTouch) {
      this.gestureConsumed = false;
    }
    if (!this.enabled || !this.isPointerInViewport(pointer)) return;

    // Farede kamera sağ (veya orta) tuş basılı tutularak kaydırılır; sol tuş seçim,
    // yerleştirme ve çizim içindir. Dokunmatikte tek parmak kaydırır (araç etkin değilse).
    const canDrag = pointer.wasTouch
      ? !this.canPan || this.canPan()
      : pointer.button === 2 || pointer.button === 1;

    if (canDrag) {
      this.isDragging = true;
      this.dragStartPointerX = pointer.x;
      this.dragStartPointerY = pointer.y;
      this.dragStartCameraX = this.camera.scrollX;
      this.dragStartCameraY = this.camera.scrollY;
    }
  }

  private handlePointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.enabled || !this.isDragging || this.pinch) return;

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

    // Kamera matrisi ancak bir sonraki çizimde güncellendiği için getWorldPoint burada
    // eski zoom'u okur; imleç sabitlemesi bu yüzden analitik hesaplanır.
    const anchored = CameraMath.computeAnchoredScroll(
      this.camera.scrollX,
      this.camera.scrollY,
      { x: pointerScreenX - this.camera.x, y: pointerScreenY - this.camera.y },
      { width: this.camera.width, height: this.camera.height },
      currentZoom,
      nextZoom,
    );

    this.camera.setZoom(nextZoom);
    this.setScroll(anchored.x, anchored.y);
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
      this.contentWidth,
      this.contentHeight,
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
   * İçerik boyutu verilmezse aktif alanla aynı kabul edilir.
   */
  setWorldSize(
    width: number,
    height: number,
    contentWidth = width,
    contentHeight = height,
  ): void {
    this.worldWidth = Math.max(32, width);
    this.worldHeight = Math.max(32, height);
    this.contentWidth = Math.max(this.worldWidth, contentWidth);
    this.contentHeight = Math.max(this.worldHeight, contentHeight);
    this.clampCurrentPosition();
  }

  /**
   * Kamera viewport alanını belirler ve sınırları günceller.
   */
  setViewport(x: number, y: number, width: number, height: number): void {
    this.camera.setViewport(Math.round(x), Math.round(y), Math.round(width), Math.round(height));
    this.clampCurrentPosition();
  }

  /** Sığdırmada görüş alanının altında boş bırakılacak şeridi ayarlar (tuval pikseli) */
  setFitInsetBottom(pixels: number): void {
    this.fitInsetBottom = Math.max(0, pixels);
  }

  /**
   * Bir GridView nesnesine bağlanarak parsel genişliğini otomatik alır.
   */
  attachGridView(gridView: GridView): void {
    this.gridView = gridView;
    this.syncWorldSizeFromGrid();
  }

  private syncWorldSizeFromGrid(): void {
    if (!this.gridView) return;

    const content = this.gridView.getContentPixelSize();
    this.setWorldSize(
      this.gridView.getActivePixelWidth(),
      this.gridView.getActivePixelHeight(),
      content.width,
      content.height,
    );
  }

  /**
   * Kamerayı fabrikaya ortalar. Sıradaki kilitli parsel de görüş alanına sığıyorsa
   * (o eksende) fabrika + parsel birlikte ortalanır ki satın alma rozeti kesilmesin.
   */
  centerOnFactory(): void {
    const viewport = {
      width: this.camera.width,
      height: this.camera.height,
    };
    const usableHeight = Math.max(1, viewport.height - this.fitInsetBottom);
    const visibleW = viewport.width / this.camera.zoom;
    const visibleH = usableHeight / this.camera.zoom;

    const focusWidth = this.contentWidth <= visibleW ? this.contentWidth : this.worldWidth;
    const focusHeight = this.contentHeight <= visibleH ? this.contentHeight : this.worldHeight;

    const centerPos = CameraMath.computeCenterPosition(focusWidth, focusHeight, viewport);
    // Alttaki boş şerit kadar yukarı ortala (şeridin yarısı kadar dünya kayması)
    const insetShift = this.fitInsetBottom / 2 / this.camera.zoom;
    this.setScroll(centerPos.x, centerPos.y + insetShift);
  }

  /**
   * Aktif fabrikayı görüş alanına sığacak en büyük kademede yakınlaştırır ve ortalar.
   * Açılışta, pencere boyutu değiştiğinde ve parsel açıldığında çağrılır.
   */
  fitToFactory(): void {
    this.syncWorldSizeFromGrid();

    const fitZoom = CameraMath.computeFitZoom(
      this.worldWidth,
      this.worldHeight,
      { width: this.camera.width, height: Math.max(1, this.camera.height - this.fitInsetBottom) },
      CameraController.FIT_MARGIN_PX * this.pixelScale,
      this.gridView?.tileSize ?? GridCoordinates.DEFAULT_TILE_SIZE,
      this.getFitLevels(),
      this.pixelScale,
    );
    this.camera.setZoom(CameraMath.clampZoom(fitZoom, this.minZoom, this.maxZoom));
    this.centerOnFactory();
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
    this.updatePinch();
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
  // İKİ PARMAK HAREKETİ (PINCH ZOOM + PAN)
  // -------------------------------------------------------------

  /**
   * İki parmak ekrandayken aradaki mesafe zoom'u, orta noktanın hareketi kaydırmayı
   * belirler. Yerleştirme ve söküm modunda da çalışır; böylece dokunmatikte araç
   * bırakılmadan fabrikada gezilebilir. Parmaklar kalkınca zoom en yakın kademeye oturur.
   */
  private updatePinch(): void {
    const input = this.scene.input;
    const a = input.pointer1;
    const b = input.pointer2;
    const active = this.enabled && Boolean(a?.isDown && b?.isDown);

    if (!active || !a || !b) {
      if (this.pinch) {
        const snapped = CameraMath.clampZoom(this.snapZoom(this.camera.zoom), this.minZoom, this.maxZoom);
        this.zoomAround(snapped, this.pinch.lastMidX, this.pinch.lastMidY);
        this.pinch = null;
      }
      // Bütün parmaklar kalktıysa hareket bitmiştir. Bayrak burada (bırakış olayları
      // işlendikten sonra) temizlenir; bir sonraki basışa bırakılırsa nesnelerin kendi
      // 'pointerdown' dinleyicileri kameranınkinden önce çalıştığı için ilk dokunuş yutulur.
      if (!a?.isDown && !b?.isDown) {
        this.gestureConsumed = false;
      }
      return;
    }

    const midX = (a.x + b.x) / 2;
    const midY = (a.y + b.y) / 2;
    const distance = Math.max(1, Phaser.Math.Distance.Between(a.x, a.y, b.x, b.y));

    if (!this.pinch) {
      if (!this.isPointerInViewport(a) && !this.isPointerInViewport(b)) return;
      this.pinch = { startDistance: distance, startZoom: this.camera.zoom, lastMidX: midX, lastMidY: midY };
      this.isDragging = false;
      this.gestureConsumed = true;
      return;
    }

    const targetZoom = CameraMath.clampZoom(
      this.pinch.startZoom * (distance / this.pinch.startDistance),
      this.minZoom,
      this.maxZoom,
    );
    this.zoomAround(targetZoom, midX, midY);

    // Orta nokta kaydıkça fabrika parmakların altında birlikte kayar
    const dx = (this.pinch.lastMidX - midX) / this.camera.zoom;
    const dy = (this.pinch.lastMidY - midY) / this.camera.zoom;
    this.camera.setScroll(this.camera.scrollX + dx, this.camera.scrollY + dy);
    this.clampCurrentPositionUnrounded();

    this.pinch.lastMidX = midX;
    this.pinch.lastMidY = midY;
  }

  /** Ekrandaki bir noktayı sabit tutarak zoom'u değiştirir */
  private zoomAround(zoom: number, screenX: number, screenY: number): void {
    if (zoom === this.camera.zoom) return;
    const anchored = CameraMath.computeAnchoredScroll(
      this.camera.scrollX,
      this.camera.scrollY,
      { x: screenX - this.camera.x, y: screenY - this.camera.y },
      { width: this.camera.width, height: this.camera.height },
      this.camera.zoom,
      zoom,
    );
    this.camera.setZoom(zoom);
    this.camera.setScroll(anchored.x, anchored.y);
    this.clampCurrentPositionUnrounded();
  }

  /** Sürekli harekette titremesin diye yuvarlamadan sınırlar */
  private clampCurrentPositionUnrounded(): void {
    const bounds = this.getPanBounds();
    const minX = Math.min(bounds.minX, bounds.maxX);
    const maxX = Math.max(bounds.minX, bounds.maxX);
    const minY = Math.min(bounds.minY, bounds.maxY);
    const maxY = Math.max(bounds.minY, bounds.maxY);
    this.camera.setScroll(
      Phaser.Math.Clamp(this.camera.scrollX, minX, maxX),
      Phaser.Math.Clamp(this.camera.scrollY, minY, maxY),
    );
  }

  // -------------------------------------------------------------
  // DURUM YÖNETİMİ VE TEMİZLİK (LIFECYCLE)
  // -------------------------------------------------------------

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (!enabled) {
      this.isDragging = false;
      this.pinch = null;
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
