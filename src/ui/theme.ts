/**
 * Central Pixel Art Theme & Design System for Manufacturer
 * Defined in docs/ART_DIRECTION.md
 */

export const PALETTE = {
  // Deep Backgrounds
  bgDeep: 0x070913,
  bgDeepHex: '#070913',
  panelBg: 0x0e1220,
  panelBgHex: '#0e1220',
  cardBg: 0x141a2e,
  cardBgHex: '#141a2e',
  modalOverlay: 0x070913,

  // Borders & Bevels
  borderDark: 0x242f4c,
  borderDarkHex: '#242f4c',
  borderHighlight: 0x3d4e7a,
  borderHighlightHex: '#3d4e7a',
  borderLight: 0x4f649c,
  borderLightHex: '#4f649c',

  // Typography
  textPrimary: '#f5f6fa',
  textMuted: '#8c9bb3',
  textDark: '#0b0e17',

  // Semantic & Role Accents
  resourceGold: 0xffd166,
  resourceGoldHex: '#ffd166',
  factoryAmber: 0xf4a261,
  factoryAmberHex: '#f4a261',
  rocketCyan: 0x00d2d3,
  rocketCyanHex: '#00d2d3',
  successGreen: 0x2ecc71,
  successGreenHex: '#2ecc71',
  warningOrange: 0xf39c12,
  warningOrangeHex: '#f39c12',
  dangerRed: 0xe74c3c,
  dangerRedHex: '#e74c3c',

  // Button States
  btnDisabled: 0x22293e,
  btnDisabledHex: '#22293e',
  btnDisabledBorder: 0x3d4e7a,
  btnDisabledText: '#6f7e9a',

  btnAffordable: 0x27ae60,
  btnAffordableHover: 0x2ecc71,
  btnAffordableText: '#08170e',

  btnAction: 0xf4a261,
  btnActionHover: 0xf6b27e,
  btnActionText: '#1f1003',

  btnCyan: 0x00b4b5,
  btnCyanHover: 0x00d2d3,
  btnCyanText: '#021818',
};

export const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

export const FONT_SIZES = {
  header: '20px',
  title: '15px',
  body: '12px',
  stat: '11px',
  badge: '10px',
  micro: '9px',
};

/**
 * Common Pixel-Art UI drawing helper routines for crisp Phaser Graphics
 */
export class PixelUIHelper {
  /**
   * Draw a multi-layered pixel beveled panel
   */
  static drawPanel(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor = PALETTE.cardBg,
    alpha = 1
  ): void {
    g.fillStyle(fillColor, alpha);
    g.fillRect(x, y, w, h);

    // Dark outer border
    g.lineStyle(1, PALETTE.borderDark, 1);
    g.strokeRect(x, y, w, h);

    // 1px inner highlight (top & left)
    g.lineStyle(1, PALETTE.borderHighlight, 0.9);
    g.lineBetween(x + 1, y + 1, x + w - 2, y + 1);
    g.lineBetween(x + 1, y + 1, x + 1, y + h - 2);

    // 1px inner shadow (bottom & right)
    g.lineStyle(1, 0x000000, 0.4);
    g.lineBetween(x + 1, y + h - 1, x + w - 1, y + h - 1);
    g.lineBetween(x + w - 1, y + 1, x + w - 1, y + h - 1);
  }

  /**
   * Draw a beveled pixel button
   */
  static drawButton(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    fillColor: number,
    borderColor = PALETTE.borderDark,
    highlightColor = 0xffffff,
    highlightAlpha = 0.25
  ): void {
    // Fill
    g.fillStyle(fillColor, 1);
    g.fillRect(x, y, w, h);

    // Border
    g.lineStyle(1, borderColor, 1);
    g.strokeRect(x, y, w, h);

    // Top & left 1px bevel highlight
    if (highlightAlpha > 0) {
      g.lineStyle(1, highlightColor, highlightAlpha);
      g.lineBetween(x + 1, y + 1, x + w - 2, y + 1);
      g.lineBetween(x + 1, y + 1, x + 1, y + h - 2);
    }

    // Bottom & right 1px bevel shadow
    g.lineStyle(1, 0x000000, 0.45);
    g.lineBetween(x + 1, y + h - 1, x + w - 1, y + h - 1);
    g.lineBetween(x + w - 1, y + 1, x + w - 1, y + h - 1);
  }

  /**
   * Draw a beveled pixel progress/status bar (Fallback graphics or legacy)
   */
  static drawProgressBar(
    g: Phaser.GameObjects.Graphics,
    x: number,
    y: number,
    w: number,
    h: number,
    progress: number,
    fillColor: number,
    bgColor = 0x0e1220,
    accentGlow = true
  ): void {
    const clampedProgress = Phaser.Math.Clamp(progress, 0, 1);

    // Bar background
    g.fillStyle(bgColor, 1);
    g.fillRect(x, y, w, h);

    // Border
    g.lineStyle(1, PALETTE.borderDark, 1);
    g.strokeRect(x, y, w, h);

    // Fill
    const fillW = Math.floor((w - 2) * clampedProgress);
    if (fillW > 0) {
      g.fillStyle(fillColor, 1);
      g.fillRect(x + 1, y + 1, fillW, h - 2);

      if (accentGlow && h > 4) {
        // 1px top highlight across filled section
        g.lineStyle(1, 0xffffff, 0.4);
        g.lineBetween(x + 1, y + 1, x + fillW, y + 1);
      }
    }

    // Bottom inner shadow
    g.lineStyle(1, 0x000000, 0.5);
    g.lineBetween(x + 1, y + h - 1, x + w - 1, y + h - 1);
  }

  /* =========================================================================
   * RASTER PIXEL-ART NINE-SLICE UI GENERATORS
   * ========================================================================= */

  /**
   * Create a true raster pixel art card background (9-slice)
   */
  static createCard(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number
  ): Phaser.GameObjects.NineSlice {
    return scene.add.nineslice(x, y, 'ui_card_bg', 0, w, h, 6, 6, 6, 6).setOrigin(0, 0);
  }

  /**
   * Create a true raster pixel art HUD / Header panel (9-slice)
   */
  static createPanel(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number
  ): Phaser.GameObjects.NineSlice {
    return scene.add.nineslice(x, y, 'ui_panel_hud', 0, w, h, 6, 6, 6, 6).setOrigin(0, 0);
  }

  /**
   * Create a true raster pixel art dialog / modal frame (9-slice)
   */
  static createModal(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number
  ): Phaser.GameObjects.NineSlice {
    return scene.add.nineslice(x, y, 'ui_modal_bg', 0, w, h, 8, 8, 8, 8).setOrigin(0.5, 0.5);
  }

  /**
   * Create a true raster pixel art toast / notification box (9-slice)
   */
  static createToast(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number
  ): Phaser.GameObjects.NineSlice {
    return scene.add.nineslice(x, y, 'ui_toast_bg', 0, w, h, 6, 6, 6, 6).setOrigin(0.5, 0.5);
  }

  /**
   * Create a true raster pixel art button (9-slice)
   */
  static createButton(
    scene: Phaser.Scene,
    x: number,
    y: number,
    w: number,
    h: number,
    type: 'green' | 'disabled' | 'danger' | 'manual' | 'launch' | 'tabActive' | 'tabInactive' = 'green'
  ): Phaser.GameObjects.NineSlice {
    let key = 'btn_green_normal';
    let corner = 6;
    if (type === 'disabled') {
      key = 'btn_disabled';
    } else if (type === 'danger') {
      key = 'btn_danger_normal';
    } else if (type === 'manual') {
      key = 'btn_manual_normal';
      corner = 8;
    } else if (type === 'launch') {
      key = 'btn_launch_normal';
      corner = 8;
    } else if (type === 'tabActive') {
      key = 'btn_tab_active';
      corner = 4;
    } else if (type === 'tabInactive') {
      key = 'btn_tab_inactive';
      corner = 4;
    }
    return scene.add.nineslice(x, y, key, 0, w, h, corner, corner, corner, corner).setOrigin(0.5, 0.5);
  }
}
