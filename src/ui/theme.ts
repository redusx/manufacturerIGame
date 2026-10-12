/**
 * Merkezi tema: renk paleti (docs/ART_DIRECTION.md §2) ve UI 2.0 tasarım
 * belirteçleri (docs/UI_UX_SYSTEM.md). Arayüzdeki her renk, yazı boyutu ve
 * boşluk buradan gelir.
 */

export const PALETTE = {
  // Deep Backgrounds
  bgDeep: 0x0a1330,
  bgDeepHex: '#0a1330',
  panelBg: 0x14244a,
  panelBgHex: '#14244a',
  cardBg: 0x1a2d58,
  cardBgHex: '#1a2d58',
  modalOverlay: 0x070913,

  // Borders & Bevels
  borderDark: 0x2b4380,
  borderDarkHex: '#2b4380',
  borderHighlight: 0x4a6bbd,
  borderHighlightHex: '#4a6bbd',
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
 * Arayüz zeminleri açıktır (krem pencere, açık kahve çubuk; tools/generate_theme_assets.py),
 * bu yüzden panelin üstündeki yazılar koyudur ("mürekkep" tonları). Parlak karşılıkları
 * konturlu yazılarda ve koyu zeminlerde (dünya, uçuş, renkli düğmeler) kullanılır.
 */
const INK = {
  text: '#33241a',
  muted: '#6b543c',
  money: '#96580a',
  primary: '#1b7f45',
  rocket: '#086f78',
  factory: '#a8521a',
  warning: '#a55a00',
  danger: '#b93626',
  secondary: '#3f5490',
} as const;

/** Mürekkep tonu -> koyu zeminde okunan parlak karşılığı */
const BRIGHT_OF_INK: Readonly<Record<string, string>> = {
  [INK.text]: PALETTE.textPrimary,
  [INK.muted]: '#d8ccb8',
  [INK.money]: PALETTE.resourceGoldHex,
  [INK.primary]: PALETTE.successGreenHex,
  [INK.rocket]: PALETTE.rocketCyanHex,
  [INK.factory]: PALETTE.factoryAmberHex,
  [INK.warning]: PALETTE.warningOrangeHex,
  [INK.danger]: PALETTE.dangerRedHex,
  [INK.secondary]: PALETTE.borderLightHex,
};

/**
 * Panel üstü (mürekkep) yazı renginin koyu zemindeki parlak karşılığı. Konturlu yazılar,
 * dünyada yüzen yazılar ve uçuş ekranındaki duyurular bununla boyanır.
 */
export function brightOf(colorHex: string): string {
  return BRIGHT_OF_INK[colorHex] ?? colorHex;
}

/**
 * Anlamsal renkler: bir anlam her ekranda aynı renkle gösterilir. Sayısal değerler
 * (ikon, çubuk, rozet, düğme) parlaktır; `...Hex` değerleri panel üstündeki yazı içindir.
 */
export const SEMANTIC = {
  /** Ana eylem / satın alınabilir / olumlu sonuç */
  primary: PALETTE.successGreen,
  primaryHex: INK.primary,
  /** İkincil, nötr eylem */
  secondary: PALETTE.borderLight,
  secondaryHex: INK.secondary,
  /** Para, fiyat, kaynak, ilerleme */
  money: PALETTE.resourceGold,
  moneyHex: INK.money,
  /** Fabrika / elle üretim */
  factory: PALETTE.factoryAmber,
  factoryHex: INK.factory,
  /** Roket, hangar, uçuş */
  rocket: PALETTE.rocketCyan,
  rocketHex: INK.rocket,
  /** Uyarı ve kilitli içerik */
  warning: PALETTE.warningOrange,
  warningHex: INK.warning,
  /** Tehlikeli / geri alınamaz eylem, hata */
  danger: PALETTE.dangerRed,
  dangerHex: INK.danger,
  /** Devre dışı */
  disabled: PALETTE.btnDisabled,
  disabledHex: PALETTE.btnDisabledHex,
  textPrimary: INK.text,
  textMuted: INK.muted,
  textOnBright: PALETTE.textDark,
  textOnDark: '#ffffff',
  /** Metin ve ikon konturu */
  outlineHex: '#070913',
  /** Panel üstündeki çizgiler: ayırıcı, seçim ve odak çerçevesi, kaydırma tutamağı */
  divider: 0xc9a877,
  ink: 0x33241a,
  /** Açık zeminde soluk ikon (tamamlanmamış, ikincil) */
  iconMuted: 0x8a7558,
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
  // Devre dışı düğme soluk ten rengidir; etiketi bir ton koyusu
  disabled: '#8a7558',
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
  'arrow_right', 'belt', 'chevron_down', 'clock', 'conveyor', 'crate', 'drop', 'expand', 'fullscreen',
  'hand', 'hangar', 'info', 'intake', 'lock', 'merger', 'minus', 'mouse', 'plus', 'rotate', 'sound_off',
  'sound_on', 'splitter', 'star', 'textsize', 'touch', 'trash', 'up', 'video', 'warning', 'wrench',
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
  // Tema dokuları (tools/generate_theme_assets.py): çubuklar ve panellerin ince ızgarası
  { key: 'ui2_bar_bg', path: 'assets/ui/bar_bg.png' },
  { key: 'ui2_dock_bg', path: 'assets/ui/dock_bg.png' },
  { key: 'ui2_pattern', path: 'assets/ui/pattern.png' },
];

/** UI 2.0 ikon dokusunun anahtarı */
export function uiIcon(name: UiIconName): string {
  return `ui2_icon_${name}`;
}
