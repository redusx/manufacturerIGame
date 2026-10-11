/* ======================================================================
 * src/flight/GroundThemes.ts — Uçuş bölgelerinin gezegen yüzeyleri (saf)
 *
 * Roketin kalktığı ve düştüğü zemin, içinde bulunulan menzil bölgesinin
 * yüzeyidir: Dünya'da çayır, çöl ve buzul; sonra Ay, Mars, asteroit kuşağı
 * ve dış gezegenler. Dokular tools/generate_flight_ground.py ile üretilir.
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur.
 * ====================================================================== */

export const GROUND_THEMES = [
  'field',
  'desert',
  'ice',
  'moon',
  'mars',
  'asteroid',
  'jupiter',
  'saturn',
  'uranus',
  'neptune',
] as const;

export type GroundTheme = (typeof GROUND_THEMES)[number];

/** Yüzey dokusunun yüksekliği (piksel) */
export const GROUND_TILE_HEIGHT = 64;
/** Dokuda zemin çizgisinin (roketin çarptığı seviye) satırı; tümsekler bunun üstüne taşar */
export const GROUND_SURFACE_ROW = 16;

/** Bölge indeksi (geçilen menzil basamağı sayısı) -> yüzey; son bölgeden sonrası Neptün'dür */
const THEME_BY_ZONE: readonly GroundTheme[] = [
  'field', // Kalkış
  'field', // İlk Tırmanış
  'desert', // Stratosfer
  'desert', // Alçak Yörünge
  'ice', // Yörünge İstasyonu
  'ice', // Derin Uzay
  'moon', // Ay Geçişi
  'moon', // Ay Üssü
  'mars', // Mars Transferi
  'mars', // Mars Yörüngesi
  'asteroid', // Asteroit Kuşağı
  'jupiter', // Jüpiter
  'saturn', // Satürn Halkaları
  'uranus', // Uranüs
  'neptune', // Neptün
];

export function groundThemeForZone(zoneIndex: number): GroundTheme {
  const index = Math.min(THEME_BY_ZONE.length - 1, Math.max(0, Math.floor(zoneIndex)));
  return THEME_BY_ZONE[index];
}

/** Yüzeyin Phaser doku anahtarı */
export function groundTextureKey(theme: GroundTheme): string {
  return `flight_ground_${theme}`;
}

/** Yüzey dokusunun `public/` altındaki yolu */
export function groundTexturePath(theme: GroundTheme): string {
  return `assets/flight/ground_${theme}.png`;
}
