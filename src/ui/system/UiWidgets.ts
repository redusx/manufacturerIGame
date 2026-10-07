/* ======================================================================
 * src/ui/system/UiWidgets.ts — Küçük ortak arayüz parçaları
 *
 * İlerleme çubuğu, durum rozeti, seviye noktaları, ayırıcı çizgi, kart ve
 * bildirim (toast). Hepsi raster piksel-sanat dokulardan kurulur ve renklerini
 * temadaki anlamsal renklerden alır.
 * ====================================================================== */

import Phaser from 'phaser';
import { SEMANTIC, SPACE, type UiTextVariant } from '../theme.ts';
import { UiLayer } from './UiLayer.ts';

export type UiBarColor = 'gold' | 'green' | 'cyan' | 'red';

const BAR_COLORS: Readonly<Record<UiBarColor, number>> = {
  gold: SEMANTIC.money,
  green: SEMANTIC.primary,
  cyan: SEMANTIC.rocket,
  red: SEMANTIC.danger,
};

/** Piksel oluk + düz renk dolgu şeklinde ilerleme çubuğu (sol üst köşeden yerleşir) */
export class UiProgressBar extends Phaser.GameObjects.Container {
  private readonly slot: Phaser.GameObjects.NineSlice;
  private readonly fill: Phaser.GameObjects.Image;
  private readonly shine: Phaser.GameObjects.Image;
  private barWidth: number;
  private readonly barHeight: number;
  private ratio = 0;

  constructor(scene: Phaser.Scene, x: number, y: number, width: number, height = 10, color: UiBarColor = 'gold') {
    super(scene, x, y);
    this.barWidth = width;
    this.barHeight = height;

    this.slot = scene.add.nineslice(0, 0, 'ui_bar_slot', 0, width, height, 4, 4, 4, 4).setOrigin(0, 0);
    this.fill = scene.add.image(2, 2, 'ui2_px').setOrigin(0, 0).setTint(BAR_COLORS[color]).setVisible(false);
    // Üst kenarda 1 birimlik açık vurgu (ART_DIRECTION §4)
    this.shine = scene.add.image(2, 2, 'ui2_px').setOrigin(0, 0).setAlpha(0.35).setVisible(false);
    this.add([this.slot, this.fill, this.shine]);
  }

  setColor(color: UiBarColor): this {
    this.fill.setTint(BAR_COLORS[color]);
    return this;
  }

  setBarWidth(width: number): this {
    this.barWidth = width;
    this.slot.setSize(width, this.barHeight);
    return this.setProgress(this.ratio);
  }

  /** 0..1 arası doluluk */
  setProgress(ratio: number): this {
    this.ratio = Phaser.Math.Clamp(ratio, 0, 1);
    const fillWidth = Math.floor((this.barWidth - 4) * this.ratio);
    const visible = fillWidth >= 1;
    this.fill.setVisible(visible);
    this.shine.setVisible(visible);
    if (visible) {
      this.fill.setDisplaySize(fillWidth, this.barHeight - 4);
      this.shine.setDisplaySize(fillWidth, 1);
    }
    return this;
  }
}

/**
 * Renkli konturlu küçük durum rozeti. Durum yalnız renkle anlatılmaz:
 * rozet her zaman bir metin (ve isteğe bağlı ikon) taşır.
 */
export class UiChip extends Phaser.GameObjects.Container {
  private readonly bg: Phaser.GameObjects.NineSlice;
  private readonly label: Phaser.GameObjects.Text;
  private readonly icon: Phaser.GameObjects.Image | null = null;
  private readonly chipHeight: number;
  private lastText: string | null = null;
  private lastColor: number | null = null;

  constructor(
    layer: UiLayer,
    x: number,
    y: number,
    text: string,
    color: number,
    options: { icon?: string; variant?: UiTextVariant; height?: number } = {},
  ) {
    super(layer.scene, x, y);
    this.chipHeight = options.height ?? 22;

    this.bg = layer.scene.add.nineslice(0, 0, 'ui2_chip', 0, 40, this.chipHeight, 4, 4, 4, 4).setOrigin(0, 0);
    this.add(this.bg);

    if (options.icon) {
      this.icon = layer.scene.add.image(0, 0, options.icon).setOrigin(0, 0.5);
      this.add(this.icon);
    }

    this.label = layer.text(0, 0, text, options.variant ?? 'captionBold').setOrigin(0, 0.5);
    this.add(this.label);

    this.setChip(text, color);
  }

  /** Rozetin metnini ve rengini günceller; genişlik metne göre ayarlanır */
  setChip(text: string, color: number): this {
    // Her karede çağrılabilir: değişmediyse metni yeniden üretme
    if (text === this.lastText && color === this.lastColor) return this;
    this.lastText = text;
    this.lastColor = color;
    this.label.setText(text);
    this.bg.setTint(color);
    this.label.setColor(`#${color.toString(16).padStart(6, '0')}`);

    let cursor = SPACE.sm - 2;
    if (this.icon) {
      this.icon.setPosition(cursor, this.chipHeight / 2).setTint(color);
      cursor += this.icon.displayWidth + 4;
    }
    this.label.setPosition(cursor, this.chipHeight / 2);
    this.bg.setSize(Math.ceil(cursor + this.label.width + SPACE.sm - 2), this.chipHeight);
    return this;
  }

  get chipWidth(): number {
    return this.bg.width;
  }
}

/** Kart zemini (9-slice, sol üst köşeden) */
export function createCard(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
): Phaser.GameObjects.NineSlice {
  return scene.add.nineslice(x, y, 'ui_card_bg', 0, width, height, 6, 6, 6, 6).setOrigin(0, 0);
}

/** İç bölme zemini: karttan bir ton koyu (ikon kutusu, bilgi satırı) */
export function createInset(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
): Phaser.GameObjects.NineSlice {
  return scene.add.nineslice(x, y, 'ui_panel_hud', 0, width, height, 6, 6, 6, 6).setOrigin(0, 0);
}

/** Yatay ayırıcı çizgi */
export function createDivider(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  color: number = 0x242f4c,
): Phaser.GameObjects.Image {
  return scene.add.image(x, y, 'ui2_px').setOrigin(0, 0).setDisplaySize(width, 1).setTint(color);
}

/** Seçili / vurgulu kart çerçevesi (ortası boş) */
export function createFrame(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  color: number,
): Phaser.GameObjects.NineSlice {
  return scene.add.nineslice(x, y, 'ui2_frame', 0, width, height, 4, 4, 4, 4).setOrigin(0, 0).setTint(color);
}

/** Seviye noktaları: dolu olanlar altın, boş olanlar soluk */
export function createPips(
  scene: Phaser.Scene,
  x: number,
  y: number,
  total: number,
  filled: number,
  color: number = SEMANTIC.money,
): Phaser.GameObjects.Container {
  const container = scene.add.container(x, y);
  for (let i = 0; i < total; i++) {
    const pip = scene.add.image(i * 10, 0, 'ui2_pip').setOrigin(0, 0.5);
    pip.setTint(i < filled ? color : 0x3d4e7a);
    container.add(pip);
  }
  return container;
}

export type UiToastKind = 'info' | 'success' | 'warning' | 'danger' | 'reward';

const TOAST_STYLE: Readonly<Record<UiToastKind, { color: number; icon: string }>> = {
  info: { color: SEMANTIC.rocket, icon: 'ui2_icon_info' },
  success: { color: SEMANTIC.primary, icon: 'icon_check' },
  warning: { color: SEMANTIC.warning, icon: 'ui2_icon_warning' },
  danger: { color: SEMANTIC.danger, icon: 'ui2_icon_warning' },
  reward: { color: SEMANTIC.money, icon: 'icon_trophy' },
};

/**
 * Ekranın üst ortasında kısa süre görünen bildirim. Yeni bildirim eskisinin
 * yerini alır. Her türün kendi rengi ve ikonu vardır.
 */
export class UiToast {
  private readonly layer: UiLayer;
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.NineSlice;
  private readonly frame: Phaser.GameObjects.NineSlice;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly label: Phaser.GameObjects.Text;
  private tween: Phaser.Tweens.Tween | null = null;
  private anchorY = 100;

  constructor(layer: UiLayer, depth = 400) {
    this.layer = layer;
    const scene = layer.scene;
    this.root = layer.container(depth).setVisible(false);

    this.bg = scene.add.nineslice(0, 0, 'ui_toast_bg', 0, 100, 40, 6, 6, 6, 6).setOrigin(0.5, 0);
    this.frame = scene.add.nineslice(0, 0, 'ui2_frame_thin', 0, 100, 40, 4, 4, 4, 4).setOrigin(0.5, 0);
    this.icon = scene.add.image(0, 0, 'icon_check').setOrigin(0.5);
    this.label = layer.text(0, 0, '', 'bodyBold', { align: 'left' }).setOrigin(0, 0.5);
    this.root.add([this.bg, this.frame, this.icon, this.label]);

    // Yeni açılan pencerenin içeriğini eski bildirim örtmesin
    layer.onModalOpened(() => this.dismiss());
  }

  /** Görünen bildirimi hemen kaldırır */
  dismiss(): void {
    this.tween?.stop();
    this.tween = null;
    this.root.setVisible(false);
  }

  /** Bildirimin üst kenarının ekrandaki yeri (HUD ve hedef kartının altı) */
  setAnchor(y: number): void {
    this.anchorY = y;
  }

  show(message: string, kind: UiToastKind = 'info'): void {
    const style = TOAST_STYLE[kind];
    const m = this.layer.metrics;
    const maxWidth = Math.min(380, m.width - m.safe.left - m.safe.right - SPACE.lg);
    const iconSpace = 16 + SPACE.sm;

    this.label.setWordWrapWidth(maxWidth - SPACE.md * 2 - iconSpace, true).setText(message);
    const width = Math.ceil(this.label.width + SPACE.md * 2 + iconSpace);
    const height = Math.max(40, Math.ceil(this.label.height + SPACE.md * 1.5));

    this.bg.setSize(width, height);
    this.frame.setSize(width, height).setTint(style.color);
    this.icon.setTexture(style.icon).setPosition(-width / 2 + SPACE.md + 8, height / 2);
    if (style.icon.startsWith('ui2_')) {
      this.icon.setTint(style.color);
    } else {
      this.icon.clearTint();
    }
    this.label.setPosition(-width / 2 + SPACE.md + iconSpace, height / 2);

    this.tween?.stop();
    this.root.setVisible(true).setAlpha(1).setPosition(Math.round(m.width / 2), this.anchorY - 8);
    this.layer.scene.tweens.add({
      targets: this.root,
      y: this.anchorY,
      duration: 140,
      ease: 'Back.easeOut',
    });
    this.tween = this.layer.scene.tweens.add({
      targets: this.root,
      alpha: 0,
      delay: 2600,
      duration: 400,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.root.setVisible(false);
        this.tween = null;
      },
    });
  }
}
