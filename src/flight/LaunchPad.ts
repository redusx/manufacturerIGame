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
export const MAX_LAUNCH_PAD_LEVEL = 5;

/**
 * Rampayı `seviye`ye çıkarmanın nakit bedeli (dizin = hedef seviye). Rampa roket
 * modülü değildir: parça istemez ve roket sınıfını etkilemez.
 */
const LAUNCH_PAD_UPGRADE_COSTS: readonly number[] = [0, 0, 1500, 12000, 90000, 600000];

/** Mükemmel bölgenin çubuğa oranı (dizin = rampa seviyesi) */
const PERFECT_ZONE_WIDTHS: readonly number[] = [0, 0.08, 0.12, 0.16, 0.21, 0.27];

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

/** Sıradaki rampa seviyesinin bedeli; rampa son seviyedeyse null */
export function getLaunchPadUpgradeCost(level: number): number | null {
  const current = clampLevel(level);
  return current >= MAX_LAUNCH_PAD_LEVEL ? null : LAUNCH_PAD_UPGRADE_COSTS[current + 1];
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
