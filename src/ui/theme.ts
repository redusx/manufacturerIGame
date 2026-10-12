/**
 * Merkezi tema: renk paleti (docs/ART_DIRECTION.md §2) ve UI 2.0 tasarım
 * belirteçleri (docs/UI_UX_SYSTEM.md). Arayüzdeki her renk, yazı boyutu ve
 * boşluk buradan gelir.
 *
 * Renk sistemi üç katmandır:
 *  1. BASE  — oyunun 16 renkli ana paleti. Şehir arka planı yalnızca bunları kullanır.
 *  2. TONE  — iki ana rengin adlandırılmış karışımı olan yardımcı tonlar (krem yüzeyler,
 *             beton, gece tonları). Başka hiçbir yerde serbest hex tanımlanmaz.
 *  3. PALETTE / SEMANTIC — kullanım amacına göre adlandırılmış roller (yüzey, yazı, vurgu).
 *
 * Çizim betikleri aynı tabloları tools/palette.py içinden okur; ikisi birlikte güncellenir.
 */

/** 16 renkli ana palet (soldan sağa palet görselindeki sırayla) */
export const BASE = {
  sand: 0xe1b670, // açık kahve
  copper: 0xb96925, // bakır
  brown: 0x68392e, // kahve
  umber: 0x201300, // en koyu kahve: kontur ve yazı
  olive: 0x404e21,
  green: 0x45944f,
  mint: 0x77d3b2,
  sky: 0x96bfff,
  blue: 0x038ac2,
  teal: 0x01515e,
  navy: 0x001437,
  plum: 0x503e66, // koyu mor: nötr düğme, yol
  purple: 0xa762a9,
  pink: 0xefa3c8,
  white: 0xffffff,
  black: 0x000000,
} as const;

/** İki rengin doğrusal karışımı: t=0 -> a, t=1 -> b */
export function mixColor(a: number, b: number, t: number): number {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const ca = (a >> shift) & 255;
    const cb = (b >> shift) & 255;
    out |= Math.floor(ca + (cb - ca) * t + 0.5) << shift;
  }
  return out;
}

export function toHex(color: number): string {
  return `#${color.toString(16).padStart(6, '0')}`;
}

/** Türetilmiş yardımcı tonlar (tools/palette.py -> TONE ile aynı) */
export const TONE = {
  // Açık yüzeyler
  cream: mixColor(BASE.sand, BASE.white, 0.62), // pencere dolgusu
  creamLight: mixColor(BASE.sand, BASE.white, 0.8), // kart dolgusu
  tan: mixColor(BASE.sand, BASE.white, 0.38), // iç bölme
  tanBar: mixColor(BASE.sand, BASE.white, 0.14), // üst çubuk, araç çubuğu tablası
  tanDark: mixColor(BASE.sand, BASE.copper, 0.35), // ayırıcı çizgi, çerçeve gölgesi
  // Dünya (koyu) yüzeyleri
  nightDeep: mixColor(BASE.navy, BASE.plum, 0.3),
  night: mixColor(BASE.navy, BASE.plum, 0.55),
  lilac: mixColor(BASE.plum, BASE.sky, 0.45),
  mist: mixColor(BASE.plum, BASE.white, 0.62), // koyu zeminde soluk yazı
  // Devre dışı düğme etiketi ve soluk ikon
  faded: mixColor(BASE.brown, BASE.sand, 0.25),
  fadedLight: mixColor(BASE.brown, BASE.sand, 0.55),
} as const;

/**
 * Dünya (koyu zemin) rolleri: fabrika sahnesinin tabanı, dünyadaki etiketler ve uçuş
 * ekranı. Vurgu renkleri ana paletin orta tonlarıdır; koyu zeminde ve açık zeminde
 * (ikon, çubuk dolgusu, başlık şeridi) aynı renk kullanılır.
 */
export const PALETTE = {
  // Koyu zeminler
  bgDeep: BASE.navy,
  bgDeepHex: toHex(BASE.navy),
  panelBg: TONE.nightDeep,
  panelBgHex: toHex(TONE.nightDeep),
  cardBg: TONE.night,
  cardBgHex: toHex(TONE.night),
  /** Pencere arkasındaki karartma */
  modalOverlay: BASE.umber,

  // Çizgiler
  borderDark: BASE.plum,
  borderDarkHex: toHex(BASE.plum),
  borderHighlight: BASE.sky,
  borderLight: TONE.lilac,
  borderLightHex: toHex(TONE.lilac),

  // Koyu zemindeki yazı
  textPrimary: toHex(BASE.white),
  textMuted: toHex(TONE.mist),
  textDark: toHex(BASE.umber),

  // Vurgular
  resourceGold: BASE.sand,
  resourceGoldHex: toHex(BASE.sand),
  factoryAmber: BASE.copper,
  factoryAmberHex: toHex(BASE.copper),
  rocketCyan: BASE.blue,
  rocketCyanHex: toHex(BASE.blue),
  successGreen: BASE.green,
  successGreenHex: toHex(BASE.green),
  warningOrange: BASE.copper,
  warningOrangeHex: toHex(BASE.copper),
  dangerRed: BASE.purple,
  dangerRedHex: toHex(BASE.purple),

  // Dünyadaki devre dışı rozet
  btnDisabled: TONE.nightDeep,
  btnDisabledHex: toHex(TONE.nightDeep),
};

/**
 * Uçuş bölgelerinin gökyüzü tonları (bölge indeksiyle seçilir). Kalkışta lacivert
 * atmosfer, ilerledikçe uzayın koyu tonları; her ton ana paletin iki renginin karışımıdır.
 */
export const FLIGHT_SKY_TONES: readonly number[] = [
  mixColor(BASE.navy, BASE.blue, 0.1), // Kalkış
  mixColor(BASE.navy, BASE.blue, 0.05), // İlk Tırmanış
  BASE.navy, // Stratosfer
  mixColor(BASE.navy, BASE.black, 0.25), // Alçak Yörünge
  mixColor(BASE.navy, BASE.black, 0.45), // Yörünge İstasyonu
  mixColor(BASE.navy, BASE.black, 0.65), // Derin Uzay
  mixColor(BASE.black, BASE.plum, 0.18), // Ay Geçişi
  mixColor(BASE.black, BASE.plum, 0.3), // Ay Üssü
  mixColor(BASE.black, BASE.purple, 0.14), // Mars Transferi
  mixColor(BASE.black, BASE.brown, 0.3), // Mars Yörüngesi
  mixColor(BASE.black, BASE.umber, 0.75), // Asteroit Kuşağı
  BASE.umber, // Jüpiter
  mixColor(BASE.black, BASE.olive, 0.32), // Satürn Halkaları
  mixColor(BASE.black, BASE.teal, 0.3), // Uranüs
  mixColor(BASE.navy, BASE.black, 0.3), // Neptün
];

/** ART_DIRECTION §5: temiz, yüksek okunabilirlikli sans-serif (her platformda hazır bulunur) */
export const FONT_FAMILY = 'Arial, Helvetica, sans-serif';

/* =========================================================================
 * UI 2.0 TASARIM BELİRTEÇLERİ (docs/UI_UX_SYSTEM.md)
 * Tüm ölçüler arayüz birimidir; ekrandaki gerçek boyutu UiMetrics.zoom belirler.
 * ========================================================================= */

/**
 * Arayüz zeminleri açıktır (krem pencere, açık kahve çubuk; tools/generate_theme_assets.py),
 * bu yüzden panelin üstündeki yazılar koyudur ("mürekkep" tonları: vurgu renginin bir koyusu).
 * Parlak karşılıkları konturlu yazılarda ve koyu zeminlerde (dünya, uçuş, rozet) kullanılır.
 */
const INK = {
  text: toHex(BASE.umber),
  muted: toHex(BASE.brown),
  money: toHex(mixColor(BASE.copper, BASE.brown, 0.6)),
  primary: toHex(mixColor(BASE.green, BASE.olive, 0.7)),
  rocket: toHex(mixColor(BASE.blue, BASE.teal, 0.7)),
  factory: toHex(mixColor(BASE.copper, BASE.brown, 0.5)),
  warning: toHex(mixColor(BASE.copper, BASE.brown, 0.55)),
  danger: toHex(mixColor(BASE.purple, BASE.plum, 0.55)),
  secondary: toHex(BASE.plum),
} as const;

/** Mürekkep tonu -> koyu zeminde okunan açık karşılığı */
const BRIGHT_OF_INK: Readonly<Record<string, string>> = {
  [INK.text]: toHex(BASE.white),
  [INK.muted]: toHex(TONE.tan),
  [INK.money]: toHex(BASE.sand),
  [INK.primary]: toHex(BASE.mint),
  [INK.rocket]: toHex(BASE.sky),
  [INK.factory]: toHex(TONE.tanDark),
  [INK.warning]: toHex(TONE.tanDark),
  [INK.danger]: toHex(BASE.pink),
  [INK.secondary]: toHex(BASE.sky),
};

/**
 * Panel üstü (mürekkep) yazı renginin koyu zemindeki parlak karşılığı. Konturlu yazılar,
 * dünyada yüzen yazılar ve uçuş ekranındaki duyurular bununla boyanır.
 */
export function brightOf(colorHex: string): string {
  return BRIGHT_OF_INK[colorHex] ?? colorHex;
}

/** Vurgu renginin koyu rozet içinde okunan açık tonu (yeşil -> nane, mavi -> açık mavi...) */
const ON_DARK: Readonly<Record<number, number>> = {
  [BASE.green]: BASE.mint,
  [BASE.blue]: BASE.sky,
  [BASE.copper]: TONE.tanDark,
  [BASE.purple]: BASE.pink,
  [BASE.plum]: BASE.sky,
};

export function onDark(color: number): number {
  return ON_DARK[color] ?? color;
}

/** Düz renk dolgunun (başlık şeridi, renkli düğme) üstündeki yazı: açık dolguda koyu, diğerlerinde beyaz */
export function inkOn(fill: number): string {
  const channel = (shift: number): number => {
    const c = ((fill >> shift) & 255) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const luminance = 0.2126 * channel(16) + 0.7152 * channel(8) + 0.0722 * channel(0);
  return luminance > 0.36 ? toHex(BASE.umber) : toHex(BASE.white);
}

/**
 * Anlamsal renkler: bir anlam her ekranda aynı renkle gösterilir. Sayısal değerler
 * (ikon, çubuk, rozet, başlık şeridi, düğme gövdesi) ana paletin orta tonlarıdır;
 * `...Hex` değerleri panel üstündeki yazı içindir.
 */
export const SEMANTIC = {
  /** Ana eylem / satın alınabilir / olumlu sonuç */
  primary: BASE.green,
  primaryHex: INK.primary,
  /** İkincil, nötr eylem */
  secondary: BASE.plum,
  secondaryHex: INK.secondary,
  /** Para, fiyat, kaynak, ilerleme */
  money: BASE.sand,
  moneyHex: INK.money,
  /** Fabrika / elle üretim */
  factory: BASE.copper,
  factoryHex: INK.factory,
  /** Roket, hangar, uçuş */
  rocket: BASE.blue,
  rocketHex: INK.rocket,
  /** Uyarı ve kilitli içerik */
  warning: BASE.copper,
  warningHex: INK.warning,
  /** Tehlikeli / geri alınamaz eylem, hata, hasar (palette kırmızı yok: mor ailesi) */
  danger: BASE.purple,
  dangerHex: INK.danger,
  /** Devre dışı */
  disabled: TONE.tan,
  disabledHex: toHex(TONE.tan),
  textPrimary: INK.text,
  textMuted: INK.muted,
  textOnBright: toHex(BASE.umber),
  textOnDark: toHex(BASE.white),
  /** Metin ve ikon konturu */
  outlineHex: toHex(BASE.umber),
  /** Panel üstündeki çizgiler: ayırıcı, seçim ve odak çerçevesi, kaydırma tutamağı */
  divider: TONE.tanDark,
  ink: BASE.umber,
  /** Açık zeminde soluk ikon (tamamlanmamış, ikincil) */
  iconMuted: TONE.fadedLight,
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

/**
 * Düğme varyantlarının etiket rengi. Gövdeler ana paletin orta tonlarıdır (yeşil, mavi,
 * bakır, mor, koyu mor): üstlerinde beyaz yazı okunur. Yalnızca açık kahve (gold) gövdede
 * koyu yazı kullanılır.
 */
export const BUTTON_LABEL_COLORS: Readonly<Record<UiButtonVariant | 'disabled', string>> = {
  primary: SEMANTIC.textOnDark,
  secondary: SEMANTIC.textOnDark,
  rocket: SEMANTIC.textOnDark,
  factory: SEMANTIC.textOnDark,
  gold: SEMANTIC.textOnBright,
  danger: SEMANTIC.textOnDark,
  // Devre dışı düğme soluk açık kahvedir; etiketi okunur kalacak kadar koyu
  disabled: toHex(TONE.faded),
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
