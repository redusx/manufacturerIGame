/* ======================================================================
 * src/ui/system/UiLayer.ts — Sahnenin arayüz katmanı
 *
 * Bir sahnedeki arayüzün ortak zemini:
 *  - Arayüz kamerası: zoom'u UiMetrics'ten gelir, sol üst köşe (0,0) arayüz
 *    birimidir. Bileşenler tuval pikseliyle değil arayüz birimiyle yerleşir.
 *  - Kamera ayrımı: sahneye eklenen her nesne varsayılan olarak "dünya"dır ve
 *    arayüz kamerasında çizilmez; `adopt` edilen kökler yalnız arayüz kamerasında
 *    çizilir. Elle "ignore" listesi tutmaya gerek kalmaz.
 *  - Keskin yazı: sahnede oluşturulan her metin, çizileceği zoom'un
 *    çözünürlüğünde üretilir; ölçek değişince yeniden üretilir.
 *  - Pencere yığını, klavye odağı ve yerleşim (resize / ölçek) bildirimi.
 * ====================================================================== */

import Phaser from 'phaser';
import { UiHost } from './UiHost.ts';
import type { UiMetrics } from './UiMetrics.ts';
import { FONT_FAMILY, SEMANTIC, TYPE_SCALE, type UiTextVariant } from '../theme.ts';

type Camera = Phaser.Cameras.Scene2D.Camera;
type GameObject = Phaser.GameObjects.GameObject;

export interface UiTextOptions {
  color?: string;
  align?: 'left' | 'center' | 'right';
  /** Bu genişlikte satır kırılır (arayüz birimi) */
  wrapWidth?: number;
  /** Renkli zemin üstünde okunurluk için koyu kontur */
  stroke?: boolean;
  lineSpacing?: number;
}

/** Klavyeyle odaklanıp etkinleştirilebilen arayüz öğesi (ör. UiButton) */
export interface UiFocusable {
  /** Odak şu an alınabilir mi (görünür ve etkin)? */
  canFocus(): boolean;
  /** Arayüz birimi cinsinden ekran konumu ve boyutu */
  getFocusBounds(): Phaser.Geom.Rectangle;
  setFocused(focused: boolean): void;
  activate(): void;
}

/** Açık bir pencerenin katmana tanıttığı arayüz */
export interface UiModalHandle {
  /** Esc veya geri eylemi: pencere kapanabiliyorsa kapanır */
  requestClose(): void;
  /** Enter/Space ile tetiklenecek ana eylem (varsa) */
  activatePrimary(): boolean;
  /** Bu pencerenin klavyeyle gezilebilen öğeleri */
  getFocusables(): UiFocusable[];
  /** Odaklanan öğe görünür alana kaydırılsın */
  revealFocus?(target: UiFocusable): void;
}

/**
 * Dünya üzerinde durup ekranda sabit boyutta kalsın diye ölçeklenen etiket
 * konteynerlerinin adı (ör. kilitli parsel rozeti). Metinleri ölçekle orantılı çizilir.
 */
export const SCREEN_LABEL_NAME = 'screen-label';

const layers = new WeakMap<Phaser.Scene, UiLayer>();

export class UiLayer {
  readonly scene: Phaser.Scene;
  /** Arayüzü çizen kamera */
  readonly camera: Camera;

  private readonly worldCameras: Camera[] = [];
  private readonly roots = new Set<GameObject>();
  private readonly layoutListeners: Array<() => void> = [];
  private readonly modalOpenListeners: Array<() => void> = [];
  private readonly modalStack: UiModalHandle[] = [];
  private readonly baseFocusables: UiFocusable[] = [];

  private focused: UiFocusable | null = null;
  private unsubscribeHost: (() => void) | null = null;
  private originalTextFactory: ((...args: unknown[]) => Phaser.GameObjects.Text) | null = null;

  /** Pencere yokken Esc basılınca (ör. etkin aracı iptal etmek için) */
  onEscape: (() => void) | null = null;

  /**
   * Dünya kamerasının o anki zoom'u. Dünyada çizilen metinler (ör. yüzen "+$6")
   * bu çözünürlükte üretilir ki yakınlaştırınca bulanmasın; sahne güncel tutar.
   */
  worldTextResolution = 1;

  /** Sahnenin arayüz katmanı (yoksa undefined) */
  static get(scene: Phaser.Scene): UiLayer | undefined {
    return layers.get(scene);
  }

  constructor(scene: Phaser.Scene, uiCamera: Camera) {
    this.scene = scene;
    this.camera = uiCamera;
    layers.set(scene, this);

    this.installCameraSeparation();
    this.installCrispText();
    this.forceVertexRounding();
    this.bindKeyboard();

    this.applyMetrics();
    this.unsubscribeHost = UiHost.onChange(() => this.handleMetricsChanged());

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  // -------------------------------------------------------------
  // ÖLÇÜLER
  // -------------------------------------------------------------

  get metrics(): UiMetrics {
    return UiHost.metrics;
  }

  /** Arayüz birimi cinsinden ekran genişliği */
  get width(): number {
    return UiHost.metrics.width;
  }

  get height(): number {
    return UiHost.metrics.height;
  }

  /** Bir arayüz biriminin tuval pikseli karşılığı */
  get zoom(): number {
    return UiHost.metrics.zoom;
  }

  /** Yerleşim yeniden hesaplanacağında (pencere boyutu, ölçek tercihi) çağrılır */
  onLayout(listener: () => void): void {
    this.layoutListeners.push(listener);
  }

  private handleMetricsChanged(): void {
    this.applyMetrics();
    for (const listener of this.layoutListeners) {
      listener();
    }
  }

  private applyMetrics(): void {
    const m = UiHost.metrics;
    this.camera.setViewport(0, 0, m.canvasWidth, m.canvasHeight);
    this.camera.setOrigin(0, 0);
    this.camera.setScroll(0, 0);
    this.camera.setZoom(m.zoom);

    for (const root of this.roots) {
      UiLayer.applyTextResolution(root, m.zoom);
    }
  }

  // -------------------------------------------------------------
  // KAMERA AYRIMI (ARAYÜZ / DÜNYA)
  // -------------------------------------------------------------

  /** Dünyayı çizen bir kamerayı tanıtır; arayüz kökleri bu kamerada çizilmez */
  addWorldCamera(camera: Camera): void {
    this.worldCameras.push(camera);
    for (const root of this.roots) {
      camera.ignore(root);
    }
  }

  /** Nesneyi arayüz kökü yapar: yalnız arayüz kamerasında çizilir */
  adopt<T extends GameObject>(object: T): T {
    this.roots.add(object);
    this.markAsUi(object);
    UiLayer.applyTextResolution(object, this.zoom);
    object.once(Phaser.GameObjects.Events.DESTROY, () => this.roots.delete(object));
    return object;
  }

  /** Arayüz kökü olarak boş bir kapsayıcı oluşturur */
  container(depth = 0): Phaser.GameObjects.Container {
    return this.adopt(this.scene.add.container(0, 0).setDepth(depth));
  }

  private markAsUi(object: GameObject): void {
    const filterable = object as GameObject & { cameraFilter: number };
    filterable.cameraFilter &= ~this.camera.id;
    for (const camera of this.worldCameras) {
      camera.ignore(object);
    }
  }

  private installCameraSeparation(): void {
    const events = this.scene.events;

    // Sahneye doğrudan eklenen her nesne dünyaya aittir; arayüz kökleri `adopt` ile ayrılır.
    const onAdded = (object: GameObject): void => {
      if (this.roots.has(object)) {
        this.markAsUi(object);
      } else {
        this.camera.ignore(object);
      }
    };
    // Bir kapsayıcıya giren nesne kendi filtresini bırakır; görünürlüğü kökü belirler.
    const onRemoved = (object: GameObject): void => {
      if (!this.roots.has(object)) {
        (object as GameObject & { cameraFilter: number }).cameraFilter = 0;
      }
    };

    events.on(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
    events.on(Phaser.Scenes.Events.REMOVED_FROM_SCENE, onRemoved);
    events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      events.off(Phaser.Scenes.Events.ADDED_TO_SCENE, onAdded);
      events.off(Phaser.Scenes.Events.REMOVED_FROM_SCENE, onRemoved);
    });
  }

  /**
   * Kesirli zoom'da Phaser köşe yuvarlamayı kapatır; yazı ve piksel dokular yarım
   * piksele oturup bozulur. Arayüz kamerasında yuvarlama her zaman açık tutulur.
   */
  private forceVertexRounding(): void {
    const camera = this.camera as Camera & { preRender: () => void; renderRoundPixels: boolean };
    const basePreRender = camera.preRender.bind(camera);
    camera.preRender = () => {
      basePreRender();
      camera.renderRoundPixels = true;
    };
  }

  // -------------------------------------------------------------
  // YAZI
  // -------------------------------------------------------------

  /** Tasarım sisteminin yazı ölçeğinden bir metin oluşturur */
  text(
    x: number,
    y: number,
    content: string,
    variant: UiTextVariant = 'body',
    options: UiTextOptions = {},
  ): Phaser.GameObjects.Text {
    const type = TYPE_SCALE[variant];
    const style: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
      fontSize: `${type.size}px`,
      fontStyle: type.bold ? 'bold' : 'normal',
      color: options.color ?? SEMANTIC.textPrimary,
      align: options.align ?? 'left',
    };
    if (options.wrapWidth !== undefined) {
      style.wordWrap = { width: options.wrapWidth, useAdvancedWrap: true };
    }
    if (options.lineSpacing !== undefined) {
      style.lineSpacing = options.lineSpacing;
    }
    if (options.stroke) {
      style.stroke = SEMANTIC.outlineHex;
      style.strokeThickness = 3;
    }
    return this.scene.add.text(x, y, content, style);
  }

  /** Metni verilen genişliğe sığdırır; sığmıyorsa sonunu "…" ile keser */
  static ellipsize(text: Phaser.GameObjects.Text, content: string, maxWidth: number): void {
    text.setText(content);
    if (text.width <= maxWidth) return;

    let low = 0;
    let high = content.length;
    while (low < high) {
      const mid = Math.ceil((low + high) / 2);
      text.setText(`${content.slice(0, mid).trimEnd()}…`);
      if (text.width <= maxWidth) {
        low = mid;
      } else {
        high = mid - 1;
      }
    }
    text.setText(low > 0 ? `${content.slice(0, low).trimEnd()}…` : '…');
  }

  /**
   * Metni önce yazı boyutunu `minSize`'a kadar küçülterek, yetmezse "…" ile kısaltarak
   * verilen genişliğe sığdırır. Her çağrıda yeni oluşturulan başlıklar için uygundur.
   */
  static fit(text: Phaser.GameObjects.Text, content: string, maxWidth: number, minSize = 12): void {
    text.setText(content);
    let size = parseInt(String(text.style.fontSize), 10);
    while (text.width > maxWidth && size > minSize) {
      size -= 1;
      text.setFontSize(size);
    }
    if (text.width > maxWidth) {
      UiLayer.ellipsize(text, content, maxWidth);
    }
  }

  /** Bir nesnenin (ve kapsayıcıysa alt öğelerinin) metinlerini verilen çözünürlükte üretir */
  static applyTextResolution(object: GameObject, resolution: number): void {
    if (object instanceof Phaser.GameObjects.Text) {
      if (object.style.resolution !== resolution) {
        object.setResolution(resolution);
      }
    } else if (object instanceof Phaser.GameObjects.Container) {
      // Ekranda sabit boyutta tutulan etiketler büyütüldükleri oranda daha yoğun çizilir
      const childResolution = object.name === SCREEN_LABEL_NAME ? resolution * object.scaleX : resolution;
      for (const child of object.list) {
        UiLayer.applyTextResolution(child, childResolution);
      }
    }
  }

  /** Sahnede oluşturulan her metin varsayılan olarak arayüz zoom'unun çözünürlüğünde üretilir */
  private installCrispText(): void {
    const factory = this.scene.add as unknown as {
      text: (...args: unknown[]) => Phaser.GameObjects.Text;
    };
    const original = factory.text;
    this.originalTextFactory = original;

    factory.text = (x: unknown, y: unknown, content: unknown, style: unknown) => {
      const withResolution = {
        resolution: this.zoom,
        ...((style as Phaser.Types.GameObjects.Text.TextStyle | undefined) ?? {}),
      };
      return original.call(this.scene.add, x, y, content, withResolution);
    };
  }

  // -------------------------------------------------------------
  // İMLEÇ
  // -------------------------------------------------------------

  /** İmlecin arayüz birimi cinsinden konumu */
  pointerPosition(pointer: Phaser.Input.Pointer): { x: number; y: number } {
    return {
      x: (pointer.x - this.camera.x) / this.camera.zoom,
      y: (pointer.y - this.camera.y) / this.camera.zoom,
    };
  }

  /** Basılan nokta ile şu anki nokta arasındaki mesafe (arayüz birimi) */
  pointerDragDistance(pointer: Phaser.Input.Pointer): number {
    return Phaser.Math.Distance.Between(pointer.downX, pointer.downY, pointer.x, pointer.y) / this.zoom;
  }

  // -------------------------------------------------------------
  // PENCERE YIĞINI
  // -------------------------------------------------------------

  /** Herhangi bir pencere açık mı? Açıkken dünya girdisi ve araç kısayolları kapalıdır. */
  get isModalOpen(): boolean {
    return this.modalStack.length > 0;
  }

  get modalCount(): number {
    return this.modalStack.length;
  }

  pushModal(modal: UiModalHandle): void {
    if (!this.modalStack.includes(modal)) {
      this.modalStack.push(modal);
      this.setFocus(null);
      for (const listener of this.modalOpenListeners) listener();
    }
  }

  /** Bir pencere açıldığında haber verir (ör. eski bildirimi kaldırmak için) */
  onModalOpened(listener: () => void): void {
    this.modalOpenListeners.push(listener);
  }

  removeModal(modal: UiModalHandle): void {
    const index = this.modalStack.indexOf(modal);
    if (index !== -1) {
      this.modalStack.splice(index, 1);
      this.setFocus(null);
    }
  }

  /** Verilen pencere yığının en üstünde mi (girdiyi o mu alıyor)? */
  isTopModal(modal: UiModalHandle): boolean {
    return this.topModal === modal;
  }

  private get topModal(): UiModalHandle | null {
    return this.modalStack[this.modalStack.length - 1] ?? null;
  }

  // -------------------------------------------------------------
  // KLAVYE VE ODAK
  // -------------------------------------------------------------

  /** Pencere açık değilken klavyeyle gezilebilen öğeler (araç çubuğu, HUD) */
  registerFocusable(focusable: UiFocusable): void {
    this.baseFocusables.push(focusable);
  }

  /** Fare/dokunma kullanılınca klavye odağı gizlenir */
  clearFocus(): void {
    this.setFocus(null);
  }

  private setFocus(target: UiFocusable | null): void {
    if (this.focused === target) return;
    this.focused?.setFocused(false);
    this.focused = target;
    target?.setFocused(true);
    if (target) {
      this.topModal?.revealFocus?.(target);
    }
  }

  private currentFocusables(): UiFocusable[] {
    const source = this.topModal ? this.topModal.getFocusables() : this.baseFocusables;
    return source.filter((f) => f.canFocus());
  }

  /** Odağı sıradaki / önceki öğeye taşır */
  private moveFocusLinear(step: 1 | -1): void {
    const items = this.currentFocusables();
    if (items.length === 0) return;
    const index = this.focused ? items.indexOf(this.focused) : -1;
    const next = index === -1 ? (step === 1 ? 0 : items.length - 1) : (index + step + items.length) % items.length;
    this.setFocus(items[next]);
  }

  /** Odağı verilen yöndeki en yakın öğeye taşır */
  private moveFocusDirectional(dx: number, dy: number): void {
    const items = this.currentFocusables();
    if (items.length === 0) return;
    if (!this.focused || !items.includes(this.focused)) {
      this.setFocus(items[0]);
      return;
    }

    const from = this.focused.getFocusBounds();
    let best: UiFocusable | null = null;
    let bestScore = Infinity;
    for (const item of items) {
      if (item === this.focused) continue;
      const to = item.getFocusBounds();
      const offsetX = to.centerX - from.centerX;
      const offsetY = to.centerY - from.centerY;
      const along = offsetX * dx + offsetY * dy;
      if (along <= 1) continue; // istenen yönde değil
      const across = Math.abs(offsetX * dy) + Math.abs(offsetY * dx);
      const score = along + across * 3;
      if (score < bestScore) {
        bestScore = score;
        best = item;
      }
    }
    if (best) this.setFocus(best);
  }

  private bindKeyboard(): void {
    const keyboard = this.scene.input.keyboard;
    if (!keyboard) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      const modal = this.topModal;

      switch (event.key) {
        case 'Escape':
          if (modal) {
            modal.requestClose();
          } else {
            this.setFocus(null);
            this.onEscape?.();
          }
          break;
        case 'Tab':
          event.preventDefault();
          this.moveFocusLinear(event.shiftKey ? -1 : 1);
          break;
        case 'Enter':
          if (this.focused && this.focused.canFocus()) {
            this.focused.activate();
          } else if (modal) {
            modal.activatePrimary();
          }
          break;
        case ' ':
          if (this.focused && this.focused.canFocus()) {
            event.preventDefault();
            this.focused.activate();
          } else if (modal && modal.activatePrimary()) {
            event.preventDefault();
          }
          break;
        case 'ArrowDown':
        case 'ArrowUp':
        case 'ArrowLeft':
        case 'ArrowRight':
          // Pencere açıkken oklar odağı gezdirir; kapalıyken kamerayı kaydırır
          if (modal) {
            event.preventDefault();
            const dx = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
            const dy = event.key === 'ArrowDown' ? 1 : event.key === 'ArrowUp' ? -1 : 0;
            this.moveFocusDirectional(dx, dy);
          }
          break;
        default:
          break;
      }
    };

    // Fare veya dokunma kullanılınca klavye odak halkası gizlenir
    const onPointerDown = (): void => this.setFocus(null);

    keyboard.on('keydown', onKeyDown);
    this.scene.input.on('pointerdown', onPointerDown);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      keyboard.off('keydown', onKeyDown);
      this.scene.input.off('pointerdown', onPointerDown);
    });
  }

  /** Enter/Space'in odaktaki bir düğmeyi tetikleyeceği durumda true döner */
  get hasKeyboardFocus(): boolean {
    return this.focused !== null && this.focused.canFocus();
  }

  // -------------------------------------------------------------
  // TEMİZLİK
  // -------------------------------------------------------------

  private destroy(): void {
    this.unsubscribeHost?.();
    this.unsubscribeHost = null;

    if (this.originalTextFactory) {
      (this.scene.add as unknown as { text: unknown }).text = this.originalTextFactory;
      this.originalTextFactory = null;
    }

    this.layoutListeners.length = 0;
    this.modalOpenListeners.length = 0;
    this.modalStack.length = 0;
    this.baseFocusables.length = 0;
    this.focused = null;
    this.roots.clear();
    this.worldCameras.length = 0;
    layers.delete(this.scene);
  }
}
