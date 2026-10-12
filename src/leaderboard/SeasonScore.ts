/* ======================================================================
 * src/leaderboard/SeasonScore.ts — Haftalık sezonda hangi uçuş gönderilir (saf)
 *
 * CrazyGames lider tablosu haftalık sezonlarla çalışır ve her pazartesi sıfırlanır
 * (docs.crazygames.com/sdk/leaderboards). Bu yüzden tüm zamanların rekoru değil,
 * içinde bulunulan sezonun en iyi uçuşu gönderilir: yeni haftada ilk uçuş, eski
 * rekorun altında kalsa da sıralamaya girer.
 *
 * Bir uçuş yalnızca o sezonda daha önce gönderilenden iyiyse gönderilir. Böylece
 * platform bir oyuncunun en iyi skorunu da saklasa son skorunu da saklasa tabloda
 * görünen değer aynıdır: sezonun en iyisi.
 *
 * Saf TypeScript — Phaser ve DOM bağımlılığı yoktur.
 * ====================================================================== */

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;
/**
 * Sezonun döndüğü an: pazartesi 07:00 UTC (1970-01-05 07:00 UTC'den itibaren haftalar).
 * Doküman bir sayfada 07:00, diğerinde 09:00 diyor; erken olan alındı ki yeni sezonun
 * ilk uçuşu hiçbir durumda atlanmasın.
 */
const SEASON_EPOCH_MS = (4 * 24 + 7) * 60 * 60 * 1000;

/** Gönderilebilecek en büyük mesafe (metre). Geliştirici panelindeki "Max" ile aynı olmalı */
export const LEADERBOARD_MAX_SCORE = 2_000_000;

export interface SeasonScoreState {
  /** Son gönderimin yapıldığı sezonun sıra numarası */
  season: number;
  /** O sezonda gönderilen en iyi mesafe (metre) */
  best: number;
}

/** Verilen anın içinde bulunduğu sezonun sıra numarası */
export function seasonIndexAt(nowMs: number): number {
  return Math.floor((nowMs - SEASON_EPOCH_MS) / WEEK_MS);
}

/** Uçuş mesafesini gönderilecek sayıya çevirir (tam metre); geçersizse null */
export function toLeaderboardScore(distanceMeters: number): number | null {
  if (!Number.isFinite(distanceMeters)) return null;
  const score = Math.floor(distanceMeters);
  if (score <= 0 || score > LEADERBOARD_MAX_SCORE) return null;
  return score;
}

/** Bu sezonda şimdiye dek gönderilen en iyi mesafe; yeni sezonda 0 */
export function seasonBest(state: SeasonScoreState | null, nowMs: number): number {
  return state && state.season === seasonIndexAt(nowMs) ? state.best : 0;
}

/** Skor bu sezonun en iyisiyse gönderilmelidir */
export function shouldSubmit(state: SeasonScoreState | null, score: number, nowMs: number): boolean {
  return score > seasonBest(state, nowMs);
}

/** Gönderimden sonraki durum */
export function afterSubmit(score: number, nowMs: number): SeasonScoreState {
  return { season: seasonIndexAt(nowMs), best: score };
}
