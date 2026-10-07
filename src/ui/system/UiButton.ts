/* ======================================================================
 * src/ui/system/UiButton.ts — Ortak düğme bileşeni
 *
 * Oyundaki bütün düğmeler bu bileşenden üretilir: aynı piksel-sanat gövde,
 * aynı durumlar (normal, üzerinde, basılı, devre dışı, seçili, klavye odağı)
 * ve aynı davranış. Düğme bırakınca tetiklenir; basılı iken parmak
 * kaydırılırsa (liste kaydırma) tetiklenmez. Basılabilir alan görselden
 * küçük olamaz (TOUCH_MIN).
 * ====================================================================== */

import Phaser from 'phaser';
import { sound } from '../../audio/SoundManager.ts';
import {
  BUTTON_LABEL_COLORS,
  SEMANTIC,
  TOUCH_MIN,
  TYPE_SCALE,
  type UiButtonVariant,
  type UiTextVariant,
} from '../theme.ts';
import { UiLayer, type UiFocusable } from './UiLayer.ts';

export interface UiButtonConfig {
  width: number;
  height: number;
  variant?: UiButtonVariant;
  label?: string;
  /** Etiketin altındaki ikinci, küçük satır */
  sublabel?: string;
  /** İkon doku anahtarı */
  icon?: string;
  /** Beyaz çizilmiş ikonu boyamak için; verilmezse ikon kendi renkleriyle çizilir */
  iconTint?: number;
  iconScale?: number;
  /** 'row': ikon solda, etiket sağda · 'column': ikon üstte, etiket altta */
  layout?: 'row' | 'column';
  textVariant?: UiTextVariant;
  onClick: () => void;
  /** Devre dışıyken basılırsa (ör. "yetersiz bakiye" bildirimi için) */
  onDisabledClick?: () => void;
  /** Tıklama sesi çalınmasın (eylemin kendi sesi varsa) */
  silent?: boolean;
}

/** Bu kadar arayüz biriminden fazla sürüklenen basış tıklama sayılmaz */
const DRAG_CANCEL_DISTANCE = 10;
const PRESS_OFFSET = 2;
const MIN_LABEL_SIZE = 11;

export class UiButton extends Phaser.GameObjects.Container implements UiFocusable {
  private readonly layer: UiLayer;
  private readonly config: UiButtonConfig;

  private readonly bg: Phaser.GameObjects.NineSlice;
  private readonly content: Phaser.GameObjects.Container;
  private readonly labelText: Phaser.GameObjects.Text | null = null;
  private readonly sublabelText: Phaser.GameObjects.Text | null = null;
  private readonly iconImage: Phaser.GameObjects.Image | null = null;
  private readonly selectedFrame: Phaser.GameObjects.NineSlice;
  private readonly focusFrame: Phaser.GameObjects.NineSlice;
  private readonly zone: Phaser.GameObjects.Zone;

  private variant: UiButtonVariant;
  private buttonWidth: number;
  private buttonHeight: number;
  private isEnabled = true;
  private isPressed = false;
  private isHovered = false;
  private isSelected = false;
  /** Kaydırılan bir listede görünür alanın dışına çıkınca basılamaz olur */
  private isClipped = false;
  private readonly labelBaseSize: number;
  /** Etiketin kısaltılmamış tam hâli */
  private labelFull = '';

  constructor(layer: UiLayer, x: number, y: number, config: UiButtonConfig) {
    super(layer.scene, x, y);
    this.layer = layer;
    this.config = config;
    this.variant = config.variant ?? 'primary';
    this.buttonWidth = config.width;
    this.buttonHeight = config.height;

    const scene = layer.scene;
    const textVariant = config.textVariant ?? 'button';
    this.labelBaseSize = TYPE_SCALE[textVariant].size;

    this.bg = scene.add
      .nineslice(0, 0, this.textureFor('normal'), 0, config.width, config.height, 4, 4, 4, 6)
      .setOrigin(0.5);
    this.add(this.bg);

    this.content = scene.add.container(0, 0);
    this.add(this.content);

    if (config.icon) {
      this.iconImage = scene.add.image(0, 0, config.icon).setOrigin(0.5).setScale(config.iconScale ?? 1);
      if (config.iconTint !== undefined) this.iconImage.setTint(config.iconTint);
      this.content.add(this.iconImage);
    }

    if (config.label !== undefined) {
      this.labelFull = config.label;
      this.labelText = layer
        .text(0, 0, config.label, textVariant, { color: BUTTON_LABEL_COLORS[this.variant], align: 'center' })
        .setOrigin(0.5);
      this.content.add(this.labelText);
    }

    if (config.sublabel !== undefined) {
      this.sublabelText = layer
        .text(0, 0, config.sublabel, 'caption', { color: BUTTON_LABEL_COLORS[this.variant], align: 'center' })
        .setOrigin(0.5);
      this.content.add(this.sublabelText);
    }

    this.selectedFrame = scene.add
      .nineslice(0, 0, 'ui2_frame', 0, config.width + 4, config.height + 4, 4, 4, 4, 4)
      .setOrigin(0.5)
      .setTint(SEMANTIC.money)
      .setVisible(false);
    this.add(this.selectedFrame);

    this.focusFrame = scene.add
      .nineslice(0, 0, 'ui2_frame', 0, config.width + 8, config.height + 8, 4, 4, 4, 4)
      .setOrigin(0.5)
      .setTint(0xffffff)
      .setVisible(false);
    this.add(this.focusFrame);

    this.zone = scene.add
      .zone(0, 0, Math.max(config.width, TOUCH_MIN), Math.max(config.height, TOUCH_MIN))
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true });
    this.add(this.zone);
    this.bindPointer();

    this.layoutContent();
    this.refreshVisual();
  }

  // -------------------------------------------------------------
  // DIŞ ARAYÜZ
  // -------------------------------------------------------------

  get enabled(): boolean {
    return this.isEnabled;
  }

  setEnabled(enabled: boolean): this {
    if (this.isEnabled === enabled) return this;
    this.isEnabled = enabled;
    this.isPressed = false;
    this.refreshVisual();
    return this;
  }

  setVariant(variant: UiButtonVariant): this {
    if (this.variant === variant) return this;
    this.variant = variant;
    this.refreshVisual();
    return this;
  }

  setLabel(label: string): this {
    if (this.labelText && this.labelFull !== label) {
      this.labelFull = label;
      this.labelText.setText(label);
      this.layoutContent();
    }
    return this;
  }

  setSublabel(sublabel: string): this {
    if (this.sublabelText && this.sublabelText.text !== sublabel) {
      this.sublabelText.setText(sublabel);
      this.layoutContent();
    }
    return this;
  }

  /** İkonu döndürür (ör. yön oku); radyan */
  setIconRotation(radians: number): this {
    this.iconImage?.setRotation(radians);
    return this;
  }

  setIcon(textureKey: string, tint?: number): this {
    if (this.iconImage) {
      this.iconImage.setTexture(textureKey);
      if (tint !== undefined) {
        this.iconImage.setTint(tint);
      } else {
        this.iconImage.clearTint();
      }
    }
    return this;
  }

  /** Seçili durum (ör. etkin araç): altın çerçeve ile gösterilir */
  setSelected(selected: boolean): this {
    this.isSelected = selected;
    this.selectedFrame.setVisible(selected);
    return this;
  }

  /** Düğmenin görsel boyutunu değiştirir (yerleşim yeniden hesaplanırken) */
  resize(width: number, height: number): this {
    if (width === this.buttonWidth && height === this.buttonHeight) return this;
    this.buttonWidth = width;
    this.buttonHeight = height;
    this.bg.setSize(width, height);
    this.selectedFrame.setSize(width + 4, height + 4);
    this.focusFrame.setSize(width + 8, height + 8);
    // Zone.setSize isabet dikdörtgenini de yeniden boyutlandırır
    this.zone.setSize(Math.max(width, TOUCH_MIN), Math.max(height, TOUCH_MIN));
    this.layoutContent();
    return this;
  }

  get buttonSize(): { width: number; height: number } {
    return { width: this.buttonWidth, height: this.buttonHeight };
  }

  /** Kaydırılan listede görünür alanın dışındaysa basılamaz (UiScrollArea yönetir) */
  setClipped(clipped: boolean): void {
    if (this.isClipped === clipped) return;
    this.isClipped = clipped;
    if (this.zone.input) this.zone.input.enabled = !clipped;
    if (clipped) {
      this.isPressed = false;
      this.isHovered = false;
      this.refreshVisual();
    }
  }

  // -------------------------------------------------------------
  // KLAVYE ODAĞI (UiFocusable)
  // -------------------------------------------------------------

  canFocus(): boolean {
    if (!this.isEnabled || this.isClipped || !this.active) return false;
    // Kendisi veya üst kapsayıcılarından biri gizliyse odaklanamaz
    let node: Phaser.GameObjects.Container | null = this;
    while (node) {
      if (!node.visible) return false;
      node = node.parentContainer;
    }
    return true;
  }

  getFocusBounds(): Phaser.Geom.Rectangle {
    const matrix = this.getWorldTransformMatrix();
    return new Phaser.Geom.Rectangle(
      matrix.tx - this.buttonWidth / 2,
      matrix.ty - this.buttonHeight / 2,
      this.buttonWidth,
      this.buttonHeight,
    );
  }

  setFocused(focused: boolean): void {
    this.focusFrame.setVisible(focused);
  }

  activate(): void {
    this.fire();
  }

  // -------------------------------------------------------------
  // İÇ İŞLEYİŞ
  // -------------------------------------------------------------

  private textureFor(state: 'normal' | 'hover' | 'pressed'): string {
    return this.isEnabled ? `ui2_btn_${this.variant}_${state}` : 'ui2_btn_disabled_normal';
  }

  private bindPointer(): void {
    this.zone
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, () => {
        this.isPressed = true;
        this.refreshVisual();
      })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
        if (!this.isPressed) return;
        this.isPressed = false;
        this.refreshVisual();
        // Parmağı kaydırarak bırakmak (liste kaydırma) tıklama değildir
        if (this.layer.pointerDragDistance(pointer) > DRAG_CANCEL_DISTANCE) return;
        this.fire();
      })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OVER, () => {
        this.isHovered = true;
        this.refreshVisual();
      })
      .on(Phaser.Input.Events.GAMEOBJECT_POINTER_OUT, () => {
        this.isHovered = false;
        this.isPressed = false;
        this.refreshVisual();
      });
  }

  private fire(): void {
    if (!this.isEnabled) {
      this.playDeniedFeedback();
      this.config.onDisabledClick?.();
      return;
    }
    if (!this.config.silent) {
      sound.initContext();
      sound.playClick();
    }
    this.config.onClick();
  }

  /** Devre dışı düğmeye basılınca kısa bir sarsıntı: "olmadı" hissi */
  private playDeniedFeedback(): void {
    this.scene.tweens.killTweensOf(this.content);
    this.content.x = 0;
    this.scene.tweens.add({
      targets: this.content,
      x: { from: -3, to: 0 },
      duration: 160,
      ease: 'Bounce.easeOut',
    });
  }

  private refreshVisual(): void {
    const pressed = this.isPressed && this.isEnabled;
    const state = pressed ? 'pressed' : this.isHovered ? 'hover' : 'normal';
    this.bg.setTexture(this.textureFor(state));
    this.content.y = pressed ? PRESS_OFFSET : 0;

    const color = BUTTON_LABEL_COLORS[this.isEnabled ? this.variant : 'disabled'];
    this.labelText?.setColor(color);
    this.sublabelText?.setColor(color);
    this.iconImage?.setAlpha(this.isEnabled ? 1 : 0.5);
  }

  /** İkon, etiket ve alt etiketi düğmenin içine ortalar; taşan etiketi küçültür */
  private layoutContent(): void {
    // Dikey (ikon üstte) düğmeler dardır; etikete olabildiğince yer bırakılır
    const padding = this.config.layout === 'column' ? 2 : 8;
    const innerWidth = this.buttonWidth - padding * 2;
    // Alttaki "dudak" yüzünden görsel merkez 1 birim yukarıdadır
    const centerY = -1;

    const icon = this.iconImage;
    const label = this.labelText;
    const sub = this.sublabelText;
    const column = this.config.layout === 'column';

    const iconW = icon ? icon.displayWidth : 0;
    const iconH = icon ? icon.displayHeight : 0;
    const gap = icon && (label || sub) ? (column ? 2 : 6) : 0;

    if (label) {
      const available = column ? innerWidth : innerWidth - iconW - gap;
      this.fitLabel(label, available);
    }

    const textH = (label ? label.height : 0) + (sub ? sub.height : 0);
    const textW = Math.max(label ? label.width : 0, sub ? sub.width : 0);

    if (column) {
      const totalH = iconH + gap + textH;
      let cursor = centerY - totalH / 2;
      if (icon) {
        icon.setPosition(0, cursor + iconH / 2);
        cursor += iconH + gap;
      }
      if (label) {
        label.setPosition(0, cursor + label.height / 2);
        cursor += label.height;
      }
      if (sub) sub.setPosition(0, cursor + sub.height / 2);
      return;
    }

    const totalW = iconW + gap + textW;
    let left = -totalW / 2;
    if (icon) {
      icon.setPosition(left + iconW / 2, centerY);
      left += iconW + gap;
    }
    const textCenterX = left + textW / 2;
    let top = centerY - textH / 2;
    if (label) {
      label.setPosition(textCenterX, top + label.height / 2);
      top += label.height;
    }
    if (sub) sub.setPosition(textCenterX, top + sub.height / 2);
  }

  /** Etiket düğmeye sığana kadar punto küçültülür; yine sığmazsa sonu kesilir */
  private fitLabel(label: Phaser.GameObjects.Text, available: number): void {
    let size = this.labelBaseSize;
    label.setFontSize(size).setText(this.labelFull);
    while (label.width > available && size > MIN_LABEL_SIZE) {
      size -= 1;
      label.setFontSize(size);
    }
    if (label.width > available) {
      UiLayer.ellipsize(label, this.labelFull, available);
    }
  }
}
