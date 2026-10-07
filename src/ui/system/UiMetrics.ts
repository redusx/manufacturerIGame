/* ======================================================================
 * src/ui/system/UiMetrics.ts — Ekran ölçüleri ve arayüz ölçeği hesabı
 *
 * Tarayıcı penceresinden (CSS boyutu, cihaz piksel oranı, güvenli alan,
 * oyuncunun ölçek tercihi) arayüzün kullanacağı tek ölçü setini üretir:
 *  - tuvalin gerçek piksel boyutu (cihaz çözünürlüğünde çizim),
 *  - arayüz kamerasının zoom'u (bir arayüz biriminin kaç tuval pikseli olduğu),
 *  - arayüz birimi cinsinden ekran boyutu, güvenli alan ve yerleşim sınıfı.
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur. Ayrıntı: docs/UI_UX_SYSTEM.md
 * ====================================================================== */

export type UiScalePreset = 'small' | 'normal' | 'large' | 'xlarge';

export const UI_SCALE_PRESETS: readonly UiScalePreset[] = ['small', 'normal', 'large', 'xlarge'];

/** Ayar ekranında görünen adlar */
export const UI_SCALE_LABELS: Readonly<Record<UiScalePreset, string>> = {
  small: 'Küçük',
  normal: 'Normal',
  large: 'Büyük',
  xlarge: 'Çok Büyük',
};

/** Tercihin "Normal"e göre hedeflediği büyüklük oranı */
const PRESET_FACTORS: Readonly<Record<UiScalePreset, number>> = {
  small: 0.8,
  normal: 1,
  large: 1.2,
  xlarge: 1.4,
};

export interface Insets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export const ZERO_INSETS: Readonly<Insets> = Object.freeze({ top: 0, right: 0, bottom: 0, left: 0 });

export interface ViewportInput {
  /** Pencerenin CSS piksel boyutu */
  cssWidth: number;
  cssHeight: number;
  /** window.devicePixelRatio */
  devicePixelRatio: number;
  /** env(safe-area-inset-*) değerleri, CSS pikseli */
  safeArea?: Insets;
  preset?: UiScalePreset;
}

/** Yerleşim arketipi: bileşenler düzenlerini buna göre seçer */
export type UiLayoutMode =
  /** Dikey ekran (telefon ve dikey tablet): bilgi dikey akar, pencereler alttan açılır */
  | 'portrait'
  /** Kısa yatay ekran (yatay telefon): araç çubuğu yana geçer, pencereler tüm yüksekliği kullanır */
  | 'landscapeCompact'
  /** Geniş yatay ekran (masaüstü, yatay tablet) */
  | 'landscape';

export interface UiMetrics {
  /** Tuval pikseli / CSS pikseli (cihaz çözünürlüğünde çizim) */
  renderScale: number;
  canvasWidth: number;
  canvasHeight: number;
  cssWidth: number;
  cssHeight: number;
  /** Bir arayüz biriminin tuval pikseli karşılığı; arayüz kamerasının zoom'u */
  zoom: number;
  /** Arayüz birimi cinsinden ekran boyutu */
  width: number;
  height: number;
  /** Arayüz birimi cinsinden güvenli alan boşlukları */
  safe: Insets;
  mode: UiLayoutMode;
  /** Oyuncunun seçtiği tercih */
  preset: UiScalePreset;
  /** Dört tercihin bu ekrandaki zoom karşılıkları (ekrana sığmayanlar aynı değere çekilir) */
  presetZooms: Readonly<Record<UiScalePreset, number>>;
}

/** Piksel sanatın bozulmaması için zoom yalnız bu adımın katları olur (ART_DIRECTION §3) */
export const ZOOM_STEP = 0.5;

/** Cihaz piksel oranı bundan büyük olsa da tuval daha yüksek çözünürlükte çizilmez */
export const MAX_RENDER_SCALE = 3;

/** Tuvalin toplam piksel bütçesi (yaklaşık 4K); aşılırsa çizim çözünürlüğü düşer */
export const MAX_CANVAS_PIXELS = 8_400_000;

/** "Normal" ölçeğin hedeflediği arayüz ekranı (birim): bu kadar alan görünecek şekilde büyütülür */
const REFERENCE_SIZE = {
  portrait: { width: 360, height: 600 },
  landscape: { width: 800, height: 450 },
} as const;

/** Düzenlerin kırılmadan çalıştığı en küçük arayüz ekranı; ölçek bunun altına inecek kadar büyüyemez */
export const MIN_UI_SIZE = {
  portrait: { width: 300, height: 480 },
  landscape: { width: 480, height: 300 },
} as const;

/** Bu yükseklikten kısa yatay ekran "kısa yatay" (yatay telefon) sayılır */
const COMPACT_LANDSCAPE_MAX_HEIGHT = 430;

function floorToStep(value: number): number {
  return Math.floor(value / ZOOM_STEP + 1e-6) * ZOOM_STEP;
}

function roundToStep(value: number): number {
  return Math.round(value / ZOOM_STEP) * ZOOM_STEP;
}

/** Tuvalin CSS pikseli başına kaç gerçek pikselle çizileceği */
export function computeRenderScale(cssWidth: number, cssHeight: number, devicePixelRatio: number): number {
  const dpr = Number.isFinite(devicePixelRatio) && devicePixelRatio > 0 ? devicePixelRatio : 1;
  const budget = Math.sqrt(MAX_CANVAS_PIXELS / Math.max(1, cssWidth * cssHeight));
  const scale = Math.min(dpr, MAX_RENDER_SCALE, budget);
  // Bütçe yüzünden düşürülen ölçek tarayıcıda yeniden örneklenir; piksel sanat
  // bozulmasın diye yarım adımlara yuvarlanır. Tam cihaz oranı olduğu gibi kalır.
  return scale < dpr ? Math.max(1, floorToStep(scale)) : Math.max(1, scale);
}

/**
 * Bir ekran için dört tercihin zoom değerlerini üretir. Tercihler birbirinden
 * en az bir adım ayrışır; ekrana sığmayanlar izin verilen en büyük değere çekilir.
 */
export function computePresetZooms(
  canvasWidth: number,
  canvasHeight: number,
  renderScale: number,
): Record<UiScalePreset, number> {
  const portrait = canvasHeight >= canvasWidth;
  const reference = portrait ? REFERENCE_SIZE.portrait : REFERENCE_SIZE.landscape;
  const minimum = portrait ? MIN_UI_SIZE.portrait : MIN_UI_SIZE.landscape;

  // Arayüz en küçük düzenin altına inmesin
  const maxZoom = Math.max(
    ZOOM_STEP,
    floorToStep(Math.min(canvasWidth / minimum.width, canvasHeight / minimum.height)),
  );
  // "Normal" ölçek bir arayüz birimini bir CSS pikselinden küçük göstermesin
  const normalFloor = Math.max(ZOOM_STEP, roundToStep(renderScale));
  const fitted = floorToStep(Math.min(canvasWidth / reference.width, canvasHeight / reference.height));
  const normal = Math.min(maxZoom, Math.max(normalFloor, fitted));

  const smallFloor = Math.max(ZOOM_STEP, roundToStep(renderScale * 0.75));
  const small = Math.max(
    Math.min(smallFloor, normal),
    Math.min(normal - ZOOM_STEP, roundToStep(normal * PRESET_FACTORS.small)),
  );
  const large = Math.min(maxZoom, Math.max(normal + ZOOM_STEP, roundToStep(normal * PRESET_FACTORS.large)));
  const xlarge = Math.min(maxZoom, Math.max(large + ZOOM_STEP, roundToStep(normal * PRESET_FACTORS.xlarge)));

  return { small, normal, large, xlarge };
}

export function computeUiMetrics(input: ViewportInput): UiMetrics {
  const cssWidth = Math.max(1, input.cssWidth);
  const cssHeight = Math.max(1, input.cssHeight);
  const preset = input.preset ?? 'normal';
  const safeCss = input.safeArea ?? ZERO_INSETS;

  const renderScale = computeRenderScale(cssWidth, cssHeight, input.devicePixelRatio);
  const canvasWidth = Math.max(1, Math.round(cssWidth * renderScale));
  const canvasHeight = Math.max(1, Math.round(cssHeight * renderScale));

  const zooms = computePresetZooms(canvasWidth, canvasHeight, renderScale);
  const zoom = zooms[preset];

  const width = canvasWidth / zoom;
  const height = canvasHeight / zoom;

  let mode: UiLayoutMode = 'portrait';
  if (width > height) {
    mode = height < COMPACT_LANDSCAPE_MAX_HEIGHT ? 'landscapeCompact' : 'landscape';
  }

  // CSS pikseli -> arayüz birimi
  const unitsPerCss = renderScale / zoom;
  const safe: Insets = {
    top: safeCss.top * unitsPerCss,
    right: safeCss.right * unitsPerCss,
    bottom: safeCss.bottom * unitsPerCss,
    left: safeCss.left * unitsPerCss,
  };

  return {
    renderScale,
    canvasWidth,
    canvasHeight,
    cssWidth,
    cssHeight,
    zoom,
    width,
    height,
    safe,
    mode,
    preset,
    presetZooms: zooms,
  };
}

/**
 * Bir tercih bu ekranda kendinden küçük tercihle aynı sonucu veriyorsa (ekrana
 * sığmadığı için aşağı çekildiyse) seçmenin etkisi yoktur.
 */
export function isPresetEffective(metrics: UiMetrics, preset: UiScalePreset): boolean {
  const index = UI_SCALE_PRESETS.indexOf(preset);
  if (index <= 0) return true;
  return metrics.presetZooms[preset] > metrics.presetZooms[UI_SCALE_PRESETS[index - 1]];
}
