/* ======================================================================
 * MachineData.ts — Genel ekonomi sabitleri
 *
 * Makine, reçete ve eşya tanımları `src/factory/simulation/` altındaki
 * kayıt defterlerindedir; burada yalnız oyun geneli sabitler tutulur.
 * ====================================================================== */

/* ---- Genel ekonomi sabitleri ---- */

/** Tıklama başına temel üretim */
export const BASE_CLICK_POWER = 1;

/**
 * ÜRET düğmesinin bir basışta kazandırdığı para, aşamalara göre (DEC-050). İlk on değer
 * 1.–10. aşama sürerken geçerlidir; sonuncusu on aşama da bitince kalıcı olur. Menzil
 * basamakları ve gelir çarpanı tıklamayı büyütmez: geç oyunda ana gelir yine fabrikadır.
 */
export const CLICK_POWER_BY_STAGE: readonly number[] = [1, 2, 3, 5, 8, 12, 18, 25, 35, 50, 75];

/** Tamamlanan aşama sayısına göre ÜRET düğmesinin basış başına kazancı ($) */
export function getClickPowerForStage(completedStages: number): number {
  const index = Math.max(0, Math.min(CLICK_POWER_BY_STAGE.length - 1, Math.floor(completedStages)));
  return CLICK_POWER_BY_STAGE[index];
}

/** Offline üretim üst sınırı (saniye) — 4 saat */
export const MAX_OFFLINE_SECONDS = 4 * 60 * 60;

/** Offline üretim verimlilik çarpanı (0–1) */
export const OFFLINE_EFFICIENCY = 0.5;

/** Otomatik kayıt aralığı (ms) */
export const AUTO_SAVE_INTERVAL_MS = 30_000;
