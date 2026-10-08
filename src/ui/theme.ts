/**
 * Merkezi tema: renk paleti (docs/ART_DIRECTION.md §2) ve UI 2.0 tasarım
 * belirteçleri (docs/UI_UX_SYSTEM.md). Arayüzdeki her renk, yazı boyutu ve
 * boşluk buradan gelir.
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
  btnDisabledText: '#8c9bb3', // was #6f7e9a

  btnAffordable: 0x2ecc71, // was 0x27ae60
  btnAffordableHover: 0x2ecc71,
  btnAffordableText: '#0b0e17', // was #08170e

  btnAction: 0xf4a261,
  btnActionHover: 0xf4a261, // was 0xf6b27e
  btnActionText: '#0b0e17', // was #1f1003

  btnCyan: 0x00d2d3, // was 0x00b4b5
  btnCyanHover: 0x00d2d3,
  btnCyanText: '#0b0e17', // was #021818
};

/** ART_DIRECTION §5: temiz, yüksek okunabilirlikli sans-serif (her platformda hazır bulunur) */
/**
 * Uçuş bölgelerinin gökyüzü tonları (bölge indeksiyle seçilir). Kalkışta lacivert
 * atmosfer, ilerledikçe uzayın koyu tonları; son tonlar tekrar eder.
 */
export const FLIGHT_SKY_TONES: readonly number[] = [
  0x0f1b33, // Kalkış
  0x0d172c, // İlk Tırmanış
  0x0b1325, // Stratosfer
  0x0a0f20, // Alçak Yörünge
  0x090c1a, // Yörünge İstasyonu
  0x070913, // Derin Uzay
  0x0c0a1c, // Ay Geçişi
  0x120a1f, // Ay Üssü
  0x190b1a, // Mars Transferi
  0x1c0d14, // Mars Yörüngesi
  0x15110f, // Asteroit Kuşağı
  0x1a140c, // Jüpiter
  0x101613, // Satürn Halkaları
  0x0a161a, // Uranüs
  0x091226, // Neptün
];

export const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

/* =========================================================================
 * UI 2.0 TASARIM BELİRTEÇLERİ (docs/UI_UX_SYSTEM.md)
 * Tüm ölçüler arayüz birimidir; ekrandaki gerçek boyutu UiMetrics.zoom belirler.
 * ========================================================================= */

/**
 * Anlamsal renkler: bir anlam her ekranda aynı renkle gösterilir.
 * Hepsi ART_DIRECTION §2 paletinden gelir.
 */
export const SEMANTIC = {
  /** Ana eylem / satın alınabilir / olumlu sonuç */
  primary: PALETTE.successGreen,
  primaryHex: PALETTE.successGreenHex,
  /** İkincil, nötr eylem */
  secondary: PALETTE.borderLight,
  secondaryHex: PALETTE.borderLightHex,
  /** Para, fiyat, kaynak, ilerleme */
  money: PALETTE.resourceGold,
  moneyHex: PALETTE.resourceGoldHex,
  /** Fabrika / elle üretim */
  factory: PALETTE.factoryAmber,
  factoryHex: PALETTE.factoryAmberHex,
  /** Roket, hangar, uçuş */
  rocket: PALETTE.rocketCyan,
  rocketHex: PALETTE.rocketCyanHex,
  /** Uyarı ve kilitli içerik */
  warning: PALETTE.warningOrange,
  warningHex: PALETTE.warningOrangeHex,
  /** Tehlikeli / geri alınamaz eylem, hata */
  danger: PALETTE.dangerRed,
  dangerHex: PALETTE.dangerRedHex,
  /** Devre dışı */
  disabled: PALETTE.btnDisabled,
  disabledHex: PALETTE.btnDisabledHex,
  textPrimary: PALETTE.textPrimary,
  textMuted: PALETTE.textMuted,
  textOnBright: PALETTE.textDark,
  textOnDark: '#ffffff',
  /** Metin ve ikon konturu */
  outlineHex: '#070913',
} as const;

export type UiTextVariant =
  | 'display'
  | 'title'
  | 'heading'
  | 'button'
  | 'buttonSmall'
  | 'body'
  | 'bodyBold'
  | 'caption'
  | 'captionBold';

/** Yazı ölçeği. En küçük yazı 11 birimdir (ART_DIRECTION alt sınırı 9). */
export const TYPE_SCALE: Readonly<Record<UiTextVariant, { size: number; bold: boolean }>> = {
  display: { size: 22, bold: true },
  title: { size: 18, bold: true },
  heading: { size: 15, bold: true },
  button: { size: 14, bold: true },
  buttonSmall: { size: 12, bold: true },
  body: { size: 13, bold: false },
  bodyBold: { size: 13, bold: true },
  caption: { size: 11, bold: false },
  captionBold: { size: 11, bold: true },
};

export const SPACE = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 } as const;

/** Dokunma hedefinin en küçük kenarı (görsel daha küçük olsa bile basılabilir alan bu kadardır) */
export const TOUCH_MIN = 44;

export type UiButtonVariant = 'primary' | 'secondary' | 'rocket' | 'factory' | 'gold' | 'danger';

/** Düğme varyantlarının etiket rengi: parlak gövdede koyu, koyu gövdede açık yazı */
export const BUTTON_LABEL_COLORS: Readonly<Record<UiButtonVariant | 'disabled', string>> = {
  primary: SEMANTIC.textOnBright,
  secondary: SEMANTIC.textOnDark,
  rocket: SEMANTIC.textOnBright,
  factory: SEMANTIC.textOnBright,
  gold: SEMANTIC.textOnBright,
  danger: SEMANTIC.textOnDark,
  disabled: SEMANTIC.textMuted,
};

/** UI 2.0 dokuları (public/assets/ui/, tools/generate_ui_assets.py üretir) */
const UI_BUTTON_STATES: ReadonlyArray<[string, readonly string[]]> = [
  ['primary', ['normal', 'hover', 'pressed']],
  ['secondary', ['normal', 'hover', 'pressed']],
  ['rocket', ['normal', 'hover', 'pressed']],
  ['factory', ['normal', 'hover', 'pressed']],
  ['gold', ['normal', 'hover', 'pressed']],
  ['danger', ['normal', 'hover', 'pressed']],
  ['disabled', ['normal']],
];

const UI_ICON_NAMES = [
  'arrow_right', 'belt', 'chevron_down', 'clock', 'crate', 'drop', 'expand', 'fullscreen', 'hand',
  'info', 'intake', 'lock', 'plus', 'rotate', 'sound_off', 'sound_on', 'star', 'textsize', 'trash',
  'up', 'video', 'warning', 'wrench',
] as const;

export type UiIconName = (typeof UI_ICON_NAMES)[number];

/** Doku anahtarı -> dosya yolu; sahnenin preload aşamasında yüklenir */
export const UI_TEXTURES: ReadonlyArray<{ key: string; path: string }> = [
  ...UI_BUTTON_STATES.flatMap(([variant, states]) =>
    states.map((state) => ({
      key: `ui2_btn_${variant}_${state}`,
      path: `assets/ui/btn_${variant}_${state}.png`,
    })),
  ),
  ...UI_ICON_NAMES.map((name) => ({ key: `ui2_icon_${name}`, path: `assets/ui/icon_${name}.png` })),
  { key: 'ui2_frame', path: 'assets/ui/frame.png' },
  { key: 'ui2_frame_thin', path: 'assets/ui/frame_thin.png' },
  { key: 'ui2_chip', path: 'assets/ui/chip.png' },
  { key: 'ui2_header', path: 'assets/ui/header.png' },
  { key: 'ui2_px', path: 'assets/ui/px.png' },
  { key: 'ui2_scroll_thumb', path: 'assets/ui/scroll_thumb.png' },
  { key: 'ui2_pip', path: 'assets/ui/pip.png' },
];

/** UI 2.0 ikon dokusunun anahtarı */
export function uiIcon(name: UiIconName): string {
  return `ui2_icon_${name}`;
}
