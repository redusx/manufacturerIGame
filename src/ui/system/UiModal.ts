/* ======================================================================
 * src/ui/system/UiModal.ts — Ortak pencere (modal / alt sayfa) bileşeni
 *
 * Oyundaki bütün pencereler bu sınıftan türer; çerçeve, başlık şeridi, kapatma
 * düğmesi, kaydırılan içerik, sabit eylem alanı ve giriş davranışı tek yerdedir:
 *  - Dikey ekranda alttan açılan tam genişlikte sayfa, yatay ekranda ortalanmış pencere.
 *  - İçerik ekrana sığmazsa pencere değil içerik kayar (sürükle, tekerlek, klavye).
 *  - Arkadaki karartma tüm ekranı kaplar: pencere açıkken dünyaya tıklanamaz.
 *  - Kapatma: [X], pencere dışına dokunma veya Esc. Enter ana eylemi tetikler.
 *
 * Alt sınıf yalnız içeriği kurar (`buildBody`, isteğe bağlı `buildFooter`).
 * ====================================================================== */

import Phaser from 'phaser';
import { SEMANTIC, SPACE } from '../theme.ts';
import { UiButton } from './UiButton.ts';
import { UiLayer, type UiFocusable, type UiModalHandle } from './UiLayer.ts';

export interface UiModalConfig {
  title: string;
  /** Başlık şeridinin rengi; ekranın kimliğini verir */
  accent?: number;
  /** İçeriğin en fazla genişliği (arayüz birimi) */
  maxWidth?: number;
  /** [X], dışarı dokunma ve Esc ile kapanabilir mi? */
  dismissible?: boolean;
  depth?: number;
  onClosed?: () => void;
}

const HEADER_HEIGHT = 48;
const PADDING = SPACE.md;
const BODY_TOP_GAP = SPACE.sm;
const SCROLL_DRAG_THRESHOLD = 6;
const BACKDROP_COLOR = 0x05070e;
const BACKDROP_ALPHA = 0.72;

export abstract class UiModal implements UiModalHandle {
  protected readonly layer: UiLayer;
  protected readonly scene: Phaser.Scene;
  private readonly config: UiModalConfig;

  /** Arayüz kökü; kamera ayrımı için katmana tanıtılmıştır */
  readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly panelLayer: Phaser.GameObjects.Container;
  private readonly panelBlocker: Phaser.GameObjects.Zone;
  private readonly panel: Phaser.GameObjects.NineSlice;
  private readonly headerBg: Phaser.GameObjects.NineSlice;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly closeButton: UiButton | null = null;
  private readonly handle: Phaser.GameObjects.Image;
  protected readonly body: Phaser.GameObjects.Container;
  protected readonly footer: Phaser.GameObjects.Container;
  private readonly scrollThumb: Phaser.GameObjects.NineSlice;
  private readonly maskGraphics: Phaser.GameObjects.Graphics;

  private title: string;
  private opened = false;
  private backdropPressed = false;
  private openTween: Phaser.Tweens.Tween | null = null;
  private slideOffset = 0;

  // Son yerleşimin ölçüleri (arayüz birimi)
  private panelX = 0;
  private panelY = 0;
  private panelW = 0;
  private panelH = 0;
  private viewportH = 0;
  private bodyHeight = 0;
  private scrollY = 0;
  private contentLeft = 0;
  /** İçeriğin kullanabileceği genişlik; alt sınıflar düzenlerini buna göre kurar */
  protected contentWidth = 0;

  private dragStartY: number | null = null;
  private dragStartScroll = 0;
  private isDragScrolling = false;

  constructor(layer: UiLayer, config: UiModalConfig) {
    this.layer = layer;
    this.scene = layer.scene;
    this.config = config;
    this.title = config.title;

    const scene = this.scene;
    this.root = layer.container(config.depth ?? 200).setVisible(false);

    // Karartma tüm ekranı kaplar ve tıklamayı yutar: pencere açıkken dünyaya ulaşılamaz
    this.backdrop = scene.add
      .rectangle(0, 0, 10, 10, BACKDROP_COLOR, BACKDROP_ALPHA)
      .setOrigin(0, 0)
      .setInteractive();
    this.backdrop.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
      this.backdropPressed = true;
    });
    this.backdrop.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, () => {
      if (this.backdropPressed) this.requestClose();
      this.backdropPressed = false;
    });
    this.root.add(this.backdrop);

    this.panelLayer = scene.add.container(0, 0);
    this.root.add(this.panelLayer);

    // Pencerenin kendisine yapılan basış karartmaya düşüp pencereyi kapatmasın
    this.panelBlocker = scene.add.zone(0, 0, 10, 10).setOrigin(0, 0).setInteractive();
    this.panelLayer.add(this.panelBlocker);

    this.panel = scene.add.nineslice(0, 0, 'ui_modal_bg', 0, 100, 100, 8, 8, 8, 8).setOrigin(0, 0);
    this.panelLayer.add(this.panel);

    this.headerBg = scene.add
      .nineslice(0, 0, 'ui2_header', 0, 100, HEADER_HEIGHT - 8, 4, 4, 4, 4)
      .setOrigin(0, 0)
      .setTint(config.accent ?? SEMANTIC.secondary);
    this.panelLayer.add(this.headerBg);

    this.handle = scene.add.image(0, 0, 'ui2_px').setOrigin(0.5).setTint(0x000000).setAlpha(0.35);
    this.panelLayer.add(this.handle);

    this.titleText = layer.text(0, 0, config.title, 'title', { color: SEMANTIC.textOnBright }).setOrigin(0, 0.5);
    this.panelLayer.add(this.titleText);

    this.body = scene.add.container(0, 0);
    this.panelLayer.add(this.body);

    this.maskGraphics = scene.make.graphics({}, false);
    this.body.setMask(this.maskGraphics.createGeometryMask());

    this.footer = scene.add.container(0, 0);
    this.panelLayer.add(this.footer);

    this.scrollThumb = scene.add
      .nineslice(0, 0, 'ui2_scroll_thumb', 0, 6, 24, 2, 2, 2, 2)
      .setOrigin(0, 0)
      .setTint(SEMANTIC.money)
      .setVisible(false);
    this.panelLayer.add(this.scrollThumb);

    if (config.dismissible !== false) {
      this.closeButton = new UiButton(layer, 0, 0, {
        width: 36,
        height: 36,
        variant: 'secondary',
        icon: 'icon_close',
        iconScale: 1.5,
        onClick: () => this.requestClose(),
      });
      this.panelLayer.add(this.closeButton);
    }

    layer.onLayout(() => {
      if (this.opened) this.rebuild();
    });

    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unbindScrollInput();
      this.maskGraphics.destroy();
    });
  }

  // -------------------------------------------------------------
  // ALT SINIFIN KURDUĞU İÇERİK
  // -------------------------------------------------------------

  /** İçeriği `body` içine kurar (sol üst 0,0; genişlik `width`) ve yüksekliğini döner */
  protected abstract buildBody(body: Phaser.GameObjects.Container, width: number): number;

  /** Kaymayan alt eylem alanını kurar ve yüksekliğini döner (0 = alan yok) */
  protected buildFooter(_footer: Phaser.GameObjects.Container, _width: number): number {
    return 0;
  }

  /** Enter ile tetiklenecek ana eylem düğmesi */
  protected primaryButton(): UiButton | null {
    return null;
  }

  /** Pencere açıldıktan hemen sonra */
  protected onOpened(): void {}

  /** Pencere kapandıktan hemen sonra */
  protected onClosedInternal(): void {}

  // -------------------------------------------------------------
  // YAŞAM DÖNGÜSÜ
  // -------------------------------------------------------------

  get isOpen(): boolean {
    return this.opened;
  }

  open(): void {
    if (this.opened) {
      this.rebuild();
      return;
    }
    this.opened = true;
    this.scrollY = 0;
    this.root.setVisible(true);
    this.layer.pushModal(this);
    this.bindScrollInput();
    this.rebuild();
    this.onOpened();
    this.playOpenAnimation();
  }

  close(): void {
    if (!this.opened) return;
    this.opened = false;
    this.openTween?.stop();
    this.openTween = null;
    this.unbindScrollInput();
    this.layer.removeModal(this);
    this.root.setVisible(false);
    this.body.removeAll(true);
    this.footer.removeAll(true);
    this.onClosedInternal();
    this.config.onClosed?.();
  }

  setTitle(title: string): void {
    this.title = title;
    this.titleText.setText(title);
  }

  setAccent(color: number): void {
    this.headerBg.setTint(color);
  }

  // UiModalHandle ------------------------------------------------

  requestClose(): void {
    if (this.config.dismissible === false) return;
    this.close();
  }

  activatePrimary(): boolean {
    const button = this.primaryButton();
    if (!button || !button.canFocus()) return false;
    button.activate();
    return true;
  }

  getFocusables(): UiFocusable[] {
    const result: UiFocusable[] = [];
    const collect = (container: Phaser.GameObjects.Container): void => {
      for (const child of container.list) {
        if (child instanceof UiButton) {
          result.push(child);
        } else if (child instanceof Phaser.GameObjects.Container) {
          collect(child);
        }
      }
    };
    collect(this.body);
    collect(this.footer);
    if (this.closeButton) result.push(this.closeButton);
    return result;
  }

  revealFocus(target: UiFocusable): void {
    if (!(target instanceof UiButton) || !this.isInsideBody(target)) return;
    const bounds = target.getFocusBounds();
    const top = this.viewportTop;
    if (bounds.top < top) {
      this.scrollTo(this.scrollY - (top - bounds.top) - SPACE.sm);
    } else if (bounds.bottom > top + this.viewportH) {
      this.scrollTo(this.scrollY + (bounds.bottom - (top + this.viewportH)) + SPACE.sm);
    }
  }

  // -------------------------------------------------------------
  // YERLEŞİM
  // -------------------------------------------------------------

  /** İçeriği baştan kurar ve pencereyi ekrana yerleştirir (yapı değiştiğinde çağrılır) */
  protected rebuild(): void {
    if (!this.opened) return;
    const m = this.layer.metrics;
    const sheet = m.mode === 'portrait';
    const maxWidth = this.config.maxWidth ?? 420;

    let availableHeight: number;
    if (sheet) {
      this.panelW = m.width;
      this.panelX = 0;
      this.contentLeft = PADDING + m.safe.left;
      this.contentWidth = m.width - PADDING * 2 - m.safe.left - m.safe.right;
      availableHeight = m.height - m.safe.top - SPACE.lg;
    } else {
      const margin = m.mode === 'landscapeCompact' ? SPACE.xs : SPACE.lg;
      const usable = m.width - m.safe.left - m.safe.right - margin * 2;
      this.panelW = Math.min(maxWidth + PADDING * 2, usable);
      this.panelX = Math.round(m.safe.left + margin + (usable - this.panelW) / 2);
      this.contentLeft = this.panelX + PADDING;
      this.contentWidth = this.panelW - PADDING * 2;
      availableHeight = m.height - m.safe.top - m.safe.bottom - margin * 2;
    }

    this.body.removeAll(true);
    this.footer.removeAll(true);
    this.bodyHeight = Math.ceil(this.buildBody(this.body, this.contentWidth));
    const footerContent = Math.ceil(this.buildFooter(this.footer, this.contentWidth));
    const footerHeight = footerContent > 0 ? footerContent + SPACE.sm : 0;
    const bottomPad = PADDING + (sheet ? m.safe.bottom : 0);

    const chrome = HEADER_HEIGHT + BODY_TOP_GAP + footerHeight + bottomPad;
    this.viewportH = Math.max(40, Math.min(this.bodyHeight, availableHeight - chrome));
    this.panelH = chrome + this.viewportH;
    this.panelY = sheet
      ? m.height - this.panelH
      : Math.round(m.safe.top + (m.height - m.safe.top - m.safe.bottom - this.panelH) / 2);

    this.backdrop.setSize(m.width, m.height);
    // Etkileşim alanı da boyutla birlikte büyümeli
    const backdropHit = this.backdrop.input?.hitArea as Phaser.Geom.Rectangle | undefined;
    backdropHit?.setSize(m.width, m.height);

    this.panelBlocker.setPosition(this.panelX, this.panelY).setSize(this.panelW, this.panelH);
    this.panel.setPosition(this.panelX, this.panelY).setSize(this.panelW, this.panelH);

    this.headerBg.setPosition(this.panelX + 4, this.panelY + 4).setSize(this.panelW - 8, HEADER_HEIGHT - 8);
    const headerCenterY = this.panelY + HEADER_HEIGHT / 2;
    const closeSpace = this.closeButton ? 44 : 0;
    this.titleText.setPosition(this.contentLeft + 2, headerCenterY);
    UiLayer.ellipsize(this.titleText, this.title, this.contentWidth - closeSpace - 4);
    this.closeButton?.setPosition(this.panelX + this.panelW - PADDING - 16, headerCenterY);

    // Alttan açılan sayfada üstte küçük bir tutamak çizgisi
    this.handle
      .setVisible(sheet)
      .setPosition(this.panelX + this.panelW / 2, this.panelY + 7)
      .setDisplaySize(36, 3);

    this.footer.setPosition(this.contentLeft, this.panelY + HEADER_HEIGHT + BODY_TOP_GAP + this.viewportH + SPACE.sm);

    this.scrollTo(this.scrollY);
  }

  private get viewportTop(): number {
    return this.panelY + HEADER_HEIGHT + BODY_TOP_GAP;
  }

  private get maxScroll(): number {
    return Math.max(0, this.bodyHeight - this.viewportH);
  }

  /** İçeriğin kaydırma konumunu ayarlar; görünür alanın dışındaki düğmeleri kapatır */
  protected scrollTo(value: number): void {
    this.scrollY = Phaser.Math.Clamp(value, 0, this.maxScroll);
    this.body.setPosition(this.contentLeft, this.viewportTop - this.scrollY);

    this.maskGraphics.clear();
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(this.panelX, this.viewportTop + this.slideOffset - 2, this.panelW, this.viewportH + 4);

    const scrollable = this.maxScroll > 0;
    this.scrollThumb.setVisible(scrollable);
    if (scrollable) {
      const trackH = this.viewportH;
      const thumbH = Math.max(24, Math.round((this.viewportH / this.bodyHeight) * trackH));
      const progress = this.scrollY / this.maxScroll;
      this.scrollThumb
        .setPosition(this.panelX + this.panelW - 9, this.viewportTop + progress * (trackH - thumbH))
        .setSize(6, thumbH);
    }

    this.updateClipping(this.body);
  }

  private updateClipping(container: Phaser.GameObjects.Container): void {
    const top = this.viewportTop;
    const bottom = top + this.viewportH;
    const visit = (node: Phaser.GameObjects.Container, offsetY: number): void => {
      for (const child of node.list) {
        if (child instanceof UiButton) {
          const centerY = offsetY + child.y;
          const half = child.buttonSize.height / 2;
          // Yarısından fazlası görünmeyen düğmeye basılamaz
          child.setClipped(centerY + half * 0.2 < top || centerY - half * 0.2 > bottom);
        } else if (child instanceof Phaser.GameObjects.Container) {
          visit(child, offsetY + child.y);
        }
      }
    };
    visit(container, container.y);
  }

  private isInsideBody(button: UiButton): boolean {
    let node: Phaser.GameObjects.Container | null = button.parentContainer;
    while (node) {
      if (node === this.body) return true;
      node = node.parentContainer;
    }
    return false;
  }

  // -------------------------------------------------------------
  // AÇILIŞ ANİMASYONU
  // -------------------------------------------------------------

  private playOpenAnimation(): void {
    const sheet = this.layer.metrics.mode === 'portrait';
    const state = { t: 0 };
    const apply = (): void => {
      this.root.setAlpha(Math.min(1, state.t * 1.5));
      this.slideOffset = Math.round((1 - state.t) * (sheet ? 28 : 10));
      this.panelLayer.y = this.slideOffset;
      this.scrollTo(this.scrollY);
    };
    apply();
    this.openTween = this.scene.tweens.add({
      targets: state,
      t: 1,
      duration: 150,
      ease: 'Cubic.easeOut',
      onUpdate: apply,
      onComplete: () => {
        state.t = 1;
        apply();
        this.openTween = null;
      },
    });
  }

  // -------------------------------------------------------------
  // KAYDIRMA GİRDİSİ
  // -------------------------------------------------------------

  private readonly handlePointerDown = (pointer: Phaser.Input.Pointer): void => {
    if (!this.isTopModal()) return;
    const p = this.layer.pointerPosition(pointer);
    const insideViewport =
      p.x >= this.panelX &&
      p.x <= this.panelX + this.panelW &&
      p.y >= this.viewportTop &&
      p.y <= this.viewportTop + this.viewportH;
    this.dragStartY = insideViewport ? p.y : null;
    this.dragStartScroll = this.scrollY;
    this.isDragScrolling = false;
  };

  private readonly handlePointerMove = (pointer: Phaser.Input.Pointer): void => {
    if (this.dragStartY === null || !pointer.isDown) return;
    const delta = this.layer.pointerPosition(pointer).y - this.dragStartY;
    if (!this.isDragScrolling && Math.abs(delta) < SCROLL_DRAG_THRESHOLD) return;
    this.isDragScrolling = true;
    this.scrollTo(this.dragStartScroll - delta);
  };

  private readonly handlePointerUp = (): void => {
    this.dragStartY = null;
    this.isDragScrolling = false;
  };

  private readonly handleWheel = (
    _pointer: Phaser.Input.Pointer,
    _over: unknown,
    _deltaX: number,
    deltaY: number,
  ): void => {
    if (!this.isTopModal()) return;
    this.scrollTo(this.scrollY + deltaY * 0.5);
  };

  private readonly handleScrollKeys = (event: KeyboardEvent): void => {
    if (!this.isTopModal()) return;
    if (event.key === 'PageDown') this.scrollTo(this.scrollY + this.viewportH * 0.8);
    if (event.key === 'PageUp') this.scrollTo(this.scrollY - this.viewportH * 0.8);
    if (event.key === 'Home') this.scrollTo(0);
    if (event.key === 'End') this.scrollTo(this.maxScroll);
  };

  private isTopModal(): boolean {
    return this.opened && this.layer.isTopModal(this);
  }

  private scrollBound = false;

  private bindScrollInput(): void {
    if (this.scrollBound) return;
    this.scrollBound = true;
    const input = this.scene.input;
    input.on(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    input.on(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    input.on(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    input.on(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    input.keyboard?.on('keydown', this.handleScrollKeys);
  }

  private unbindScrollInput(): void {
    if (!this.scrollBound) return;
    this.scrollBound = false;
    const input = this.scene.input;
    input.off(Phaser.Input.Events.POINTER_DOWN, this.handlePointerDown);
    input.off(Phaser.Input.Events.POINTER_MOVE, this.handlePointerMove);
    input.off(Phaser.Input.Events.POINTER_UP, this.handlePointerUp);
    input.off(Phaser.Input.Events.POINTER_WHEEL, this.handleWheel);
    input.keyboard?.off('keydown', this.handleScrollKeys);
  }
}
