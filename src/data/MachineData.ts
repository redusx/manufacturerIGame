/* ======================================================================
 * MachineData.ts — Genel ekonomi sabitleri
 *
 * Makine, reçete ve eşya tanımları `src/factory/simulation/` altındaki
 * kayıt defterlerindedir; burada yalnız oyun geneli sabitler tutulur.
 * ====================================================================== */

/* ---- Genel ekonomi sabitleri ---- */

/** Tıklama başına temel üretim */
export const BASE_CLICK_POWER = 1;

/** Offline üretim üst sınırı (saniye) — 4 saat */
export const MAX_OFFLINE_SECONDS = 4 * 60 * 60;

/** Offline üretim verimlilik çarpanı (0–1) */
export const OFFLINE_EFFICIENCY = 0.5;

/** Otomatik kayıt aralığı (ms) */
export const AUTO_SAVE_INTERVAL_MS = 30_000;
