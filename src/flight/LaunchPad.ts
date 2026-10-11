/* ======================================================================
 * src/flight/LaunchPad.ts — Fırlatma rampası ve fırlatma göstergesi (saf)
 *
 * Kalkıştan önce bir imleç çubuğun üstünde sabit hızla gidip gelir; oyuncu
 * imleç ortadaki dar "mükemmel" bölgedeyken ateşler. Bölgenin dışına düşen
 * her fırlatma, bölgeden uzaklaştıkça güç kaybeder. Rampa yükseltildikçe
 * mükemmel bölge genişler: aynı isabet daha kolay tutturulur.
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur.
 * ====================================================================== */

/** Rampanın ulaşabileceği en yüksek seviye */
export const MAX_LAUNCH_PAD_LEVEL = 10;

/**
 * Rampayı `seviye`ye çıkarmanın nakit bedeli (dizin = hedef seviye). Rampa roket
 * modülü değildir: parça istemez ve roket sınıfını etkilemez. Bedel her seviyede
 * 4–7 katına çıkar; son seviyeler oyunun en uzak hedefleridir.
 */
const LAUNCH_PAD_UPGRADE_COSTS: readonly number[] = [
  0,
  0,
  10_000,
  60_000,
  400_000,
  2_500_000,
  15_000_000,
  90_000_000,
  500_000_000,
  2_500_000_000,
  10_000_000_000,
];

/**
 * Mükemmel bölgenin çubuğa oranı (dizin = rampa seviyesi). Son seviyede bölge çubuğun
 * tamamını kaplar: her fırlatma mükemmeldir.
 */
const PERFECT_ZONE_WIDTHS: readonly number[] = [0, 0.08, 0.12, 0.17, 0.23, 0.3, 0.38, 0.48, 0.6, 0.78, 1];

/** Reklam izleyerek alınan rampa yükseltmesindeki indirim oranı */
export const LAUNCH_PAD_AD_DISCOUNT = 0.2;

/** İmlecin çubuğu bir uçtan diğerine geçme süresi (saniye) */
export const LAUNCH_MARKER_SWEEP_SEC = 0.85;

/** Bölgenin dışında güç en fazla bu kadar düşer (çubuğun ucunda) */
const MIN_LAUNCH_POWER = 0.25;
/** Bu gücün üstü "iyi" fırlatma sayılır */
const GOOD_LAUNCH_POWER = 0.7;

/** Mükemmel fırlatmanın uçuş primine eklediği fabrika geliri süresi (saniye) */
export const PERFECT_LAUNCH_BONUS_SECONDS = 20;

export type LaunchQuality = 'perfect' | 'good' | 'weak';

export interface LaunchResult {
  /** Rampadan çıkış gücü (0,25..1) */
  power: number;
  quality: LaunchQuality;
  /** Uçuş primine eklenen gelir süresi (saniye) */
  bonusSeconds: number;
}

function clampLevel(level: number): number {
  return Math.min(MAX_LAUNCH_PAD_LEVEL, Math.max(1, Math.floor(level)));
}

/** Mükemmel bölgenin çubuğa oranı (0..1) */
export function getPerfectZoneWidth(level: number): number {
  return PERFECT_ZONE_WIDTHS[clampLevel(level)];
}

/** "İyi" bölgenin (mükemmel bölge dahil) çubuğa oranı; gösterge bunu altınla boyar */
export function getGoodZoneWidth(level: number): number {
  const perfect = getPerfectZoneWidth(level);
  const falloff = (1 - GOOD_LAUNCH_POWER) / (1 - MIN_LAUNCH_POWER);
  return perfect + (1 - perfect) * falloff;
}

/**
 * Sıradaki rampa seviyesinin bedeli; rampa son seviyedeyse null.
 * @param discount Bedelden düşülecek oran (0..1; reklam indirimi)
 */
export function getLaunchPadUpgradeCost(level: number, discount = 0): number | null {
  const current = clampLevel(level);
  if (current >= MAX_LAUNCH_PAD_LEVEL) return null;
  return Math.round(LAUNCH_PAD_UPGRADE_COSTS[current + 1] * (1 - Math.min(1, Math.max(0, discount))));
}

/** Rampanın o seviyedeki çiziminin doku anahtarı (tools/generate_launch_pad.py) */
export function launchPadTextureKey(level: number): string {
  return `launch_pad_${clampLevel(level)}`;
}

/** İmlecin `timeSec` anındaki konumu (0..1): sabit hızla uçtan uca gidip gelir */
export function launchMarkerPosition(timeSec: number): number {
  const phase = (Math.max(0, timeSec) / LAUNCH_MARKER_SWEEP_SEC) % 2;
  return phase <= 1 ? phase : 2 - phase;
}

/** İmleç `position` (0..1) konumundayken ateşlenen fırlatmanın sonucu */
export function evaluateLaunch(position: number, level: number): LaunchResult {
  const half = getPerfectZoneWidth(level) / 2;
  const offset = Math.abs(Math.min(1, Math.max(0, position)) - 0.5);
  if (offset <= half) {
    return { power: 1, quality: 'perfect', bonusSeconds: PERFECT_LAUNCH_BONUS_SECONDS };
  }

  // Bölgenin kenarından çubuğun ucuna doğru güç doğrusal düşer
  const distance = (offset - half) / (0.5 - half);
  const power = 1 - (1 - MIN_LAUNCH_POWER) * distance;
  return { power, quality: power >= GOOD_LAUNCH_POWER ? 'good' : 'weak', bonusSeconds: 0 };
}
