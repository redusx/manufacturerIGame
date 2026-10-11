/* ======================================================================
 * ZoomControls.ts — Fabrika haritasının yakınlaştırma düğmeleri
 *
 * Fabrika görüş alanının sağ üst köşesinde durur: artı, geçerli oran ve eksi.
 * Her basış küçük bir adımdır (tekerlek ve iki parmak hareketinden daha ince);
 * basılı tutunca adımlar art arda gelir. Oyuncu haritayı tam istediği büyüklüğe getirebilir.
 * ====================================================================== */

import Phaser from 'phaser';
import { SEMANTIC, SPACE, uiIcon } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import type { UiLayer } from './system/UiLayer.ts';

export interface ZoomControlsCallbacks {
  onZoomIn: () => void;
  onZoomOut: () => void;
}

const BUTTON_SIZE = 36;
const LABEL_HEIGHT = 18;

export class ZoomControls {
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.NineSlice;
  private readonly inButton: UiButton;
  private readonly outButton: UiButton;
  private readonly label: Phaser.GameObjects.Text;
  private shownPercent = -1;

  /** Düğme sütununun genişliği ve yüksekliği (arayüz birimi) */
  static readonly width = BUTTON_SIZE + SPACE.xs * 2;
  static readonly height = BUTTON_SIZE * 2 + LABEL_HEIGHT + SPACE.xs * 2;

  constructor(layer: UiLayer, callbacks: ZoomControlsCallbacks) {
    const scene = layer.scene;
    this.root = layer.container(55);

    this.bg = scene.add
      .nineslice(0, 0, 'ui_panel_hud', 0, ZoomControls.width, ZoomControls.height, 6, 6, 6, 6)
      .setOrigin(0, 0)
      .setAlpha(0.9);
    this.root.add(this.bg);

    const centerX = ZoomControls.width / 2;
    this.inButton = new UiButton(layer, centerX, SPACE.xs + BUTTON_SIZE / 2, {
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      variant: 'secondary',
      icon: uiIcon('plus'),
      silent: true,
      onClick: callbacks.onZoomIn,
      onHold: callbacks.onZoomIn,
    });
    this.label = layer
      .text(centerX, SPACE.xs + BUTTON_SIZE + LABEL_HEIGHT / 2, '%100', 'captionBold', { color: SEMANTIC.moneyHex })
      .setOrigin(0.5);
    this.outButton = new UiButton(layer, centerX, SPACE.xs + BUTTON_SIZE + LABEL_HEIGHT + BUTTON_SIZE / 2, {
      width: BUTTON_SIZE,
      height: BUTTON_SIZE,
      variant: 'secondary',
      icon: uiIcon('minus'),
      silent: true,
      onClick: callbacks.onZoomOut,
      onHold: callbacks.onZoomOut,
    });
    this.root.add([this.inButton, this.label, this.outButton]);
    layer.registerFocusable(this.inButton);
    layer.registerFocusable(this.outButton);
  }

  /** Sütunun sol üst köşesini yerleştirir (arayüz birimi) */
  layout(x: number, y: number): void {
    this.root.setPosition(Math.round(x), Math.round(y));
  }

  /**
   * Geçerli oranı ve sınırlara dayanıp dayanmadığını gösterir.
   * @param percent Yakınlaştırma oranı (100 = bir dünya pikseli bir CSS pikseli)
   */
  update(percent: number, canZoomIn: boolean, canZoomOut: boolean): void {
    if (percent !== this.shownPercent) {
      this.shownPercent = percent;
      this.label.setText(`%${percent}`);
    }
    this.inButton.setEnabled(canZoomIn);
    this.outButton.setEnabled(canZoomOut);
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }
}
