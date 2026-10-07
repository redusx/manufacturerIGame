/* ======================================================================
 * ToolContextBar.ts — Etkin araç çubuğu
 *
 * Yerleştirme veya söküm aracı etkinken ne yapıldığını ve nasıl bitirileceğini
 * söyler: ne yerleştiriliyor, bedeli ne, sıradaki adım ne. Eylemler her zaman
 * aynı yerdedir: Döndür, (dokunmatikte) Onayla ve İptal.
 * ====================================================================== */

import Phaser from 'phaser';
import { SEMANTIC, SPACE, uiIcon } from './theme';
import { UiButton } from './system/UiButton.ts';
import { UiLayer } from './system/UiLayer.ts';

export interface ToolContextState {
  /** Araç ikonu (doku anahtarı) */
  icon: string;
  iconTint?: number;
  /** "Yüksek Sıcaklık Fırını · $250" */
  title: string;
  /** Sıradaki adım: "Bir hücreye dokun, sonra Onayla" */
  hint: string;
  tone: 'build' | 'demolish';
  canRotate: boolean;
  /** Dokunmatikte seçilen hücreyi onaylama düğmesi */
  showConfirm: boolean;
  confirmEnabled: boolean;
  /** Yön önizlemesi açık: iptal düğmesi yeşil "tamam" düğmesine dönüşür */
  rotating?: boolean;
}

export interface ToolContextCallbacks {
  onRotate: () => void;
  onConfirm: () => void;
  onCancel: () => void;
}

const BAR_HEIGHT = 52;
const ACTION_SIZE = 40;

export class ToolContextBar {
  private readonly layer: UiLayer;
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.NineSlice;
  private readonly frame: Phaser.GameObjects.NineSlice;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly hintText: Phaser.GameObjects.Text;
  private readonly rotateButton: UiButton;
  private readonly confirmButton: UiButton;
  private readonly cancelButton: UiButton;

  private state: ToolContextState | null = null;
  private barWidth = 300;
  private signature = '';

  constructor(layer: UiLayer, callbacks: ToolContextCallbacks) {
    this.layer = layer;
    const scene = layer.scene;
    this.root = layer.container(70).setVisible(false);

    this.bg = scene.add.nineslice(0, 0, 'ui_toast_bg', 0, 100, BAR_HEIGHT, 6, 6, 6, 6).setOrigin(0, 0);
    this.frame = scene.add.nineslice(0, 0, 'ui2_frame_thin', 0, 100, BAR_HEIGHT, 4, 4, 4, 4).setOrigin(0, 0);
    this.icon = scene.add.image(0, 0, 'icon_factory').setOrigin(0.5);
    this.titleText = layer.text(0, 0, '', 'bodyBold').setOrigin(0, 0.5);
    this.hintText = layer.text(0, 0, '', 'caption', { color: SEMANTIC.textMuted }).setOrigin(0, 0.5);
    this.root.add([this.bg, this.frame, this.icon, this.titleText, this.hintText]);

    const action = (
      icon: string,
      variant: 'primary' | 'secondary' | 'danger',
      onClick: () => void,
      iconTint?: number,
    ): UiButton => {
      const button = new UiButton(layer, 0, 0, {
        width: ACTION_SIZE,
        height: ACTION_SIZE,
        variant,
        icon,
        iconScale: 1.5,
        iconTint,
        onClick,
      });
      this.root.add(button);
      layer.registerFocusable(button);
      return button;
    };

    this.rotateButton = action(uiIcon('rotate'), 'secondary', callbacks.onRotate, 0xffffff);
    this.confirmButton = action('icon_check', 'primary', callbacks.onConfirm);
    this.cancelButton = action('icon_close', 'danger', callbacks.onCancel);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  static get height(): number {
    return BAR_HEIGHT;
  }

  /** Çubuğu yatayda `centerX` çevresine, alt kenarı `bottomY` olacak şekilde yerleştirir */
  layout(centerX: number, bottomY: number, maxWidth: number): void {
    this.barWidth = Math.min(480, Math.max(240, maxWidth));
    this.root.setPosition(Math.round(centerX - this.barWidth / 2), Math.round(bottomY - BAR_HEIGHT));
    this.signature = '';
    this.render();
  }

  show(state: ToolContextState): void {
    this.state = state;
    this.root.setVisible(true);
    this.render();
  }

  hide(): void {
    this.state = null;
    this.signature = '';
    this.root.setVisible(false);
  }

  private render(): void {
    const state = this.state;
    if (!state) return;

    const signature = JSON.stringify(state) + this.barWidth;
    if (signature === this.signature) return;
    this.signature = signature;

    const w = this.barWidth;
    const centerY = BAR_HEIGHT / 2;
    const accent = state.tone === 'demolish' ? SEMANTIC.danger : SEMANTIC.primary;

    this.bg.setSize(w, BAR_HEIGHT);
    this.frame.setSize(w, BAR_HEIGHT).setTint(accent);

    // Eylemler sağdan sola: İptal, Onayla, Döndür
    let right = w - SPACE.sm - ACTION_SIZE / 2;
    this.cancelButton.setPosition(right, centerY);
    if (state.rotating) {
      this.cancelButton.setVariant('primary').setIcon('icon_check');
    } else {
      this.cancelButton.setVariant('danger').setIcon('icon_close');
    }
    right -= ACTION_SIZE + SPACE.xs + 2;

    this.confirmButton.setVisible(state.showConfirm).setEnabled(state.confirmEnabled);
    if (state.showConfirm) {
      this.confirmButton.setPosition(right, centerY);
      right -= ACTION_SIZE + SPACE.xs + 2;
    }

    this.rotateButton.setVisible(state.canRotate);
    if (state.canRotate) {
      this.rotateButton.setPosition(right, centerY);
      right -= ACTION_SIZE + SPACE.xs + 2;
    }

    const iconX = SPACE.sm + 14;
    this.icon.setTexture(state.icon).setPosition(iconX, centerY);
    // İkon kaynağı 16 veya 48 piksel olabilir; kutuya sığacak şekilde ölçeklenir
    const iconScale = Math.min(1.5, 28 / Math.max(this.icon.width, this.icon.height));
    this.icon.setScale(iconScale);
    if (state.iconTint !== undefined) {
      this.icon.setTint(state.iconTint);
    } else {
      this.icon.clearTint();
    }

    const textX = iconX + 14 + SPACE.sm;
    const textMax = right + ACTION_SIZE / 2 - SPACE.sm - textX;
    this.titleText.setPosition(textX, centerY - 9);
    this.hintText.setPosition(textX, centerY + 9);
    UiLayer.ellipsize(this.titleText, state.title, textMax);
    UiLayer.ellipsize(this.hintText, state.hint, textMax);
  }
}
