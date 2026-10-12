/* ======================================================================
 * src/leaderboard/leaderboard.ts — Oyunun lider tablosu bağlantıları
 *
 * Sıralamayı CrazyGames tutar (DEC-054): her tamamlanan uçuşun mesafesi, o haftanın
 * en iyisiyse SDK ile CrazyGames lider tablosuna gönderilir. Sıralama CrazyGames'in
 * kendi arayüzünde görünür; SDK'da listeyi okuyan bir çağrı yoktur, bu yüzden oyun
 * içi pencere başka oyuncu göstermez (uydurma satır da göstermez).
 *
 * Gereken yapılandırma: `VITE_CRAZYGAMES_LEADERBOARD_KEY` (geliştirici panelinde üretilen
 * istemci şifreleme anahtarı). Yoksa oyun aynen çalışır, yalnızca skor gönderilmez.
 * Sunucu tarafı API anahtarı buraya ASLA konmaz: tarayıcıya giden pakette herkes okur.
 *
 * İsteğe bağlı: `VITE_LEADERBOARD_URL` tanımlıysa oyunun kendi skor sunucusu da
 * kullanılır ve pencere o sunucunun listesini gösterir (docs/LEADERBOARD.md).
 * ====================================================================== */

import { crazyGames } from '../integration/CrazyGamesSDK.ts';
import { LeaderboardService, type LeaderboardPlayer } from './LeaderboardService.ts';
import { RemoteLeaderboardProvider } from './providers.ts';
import {
  afterSubmit,
  seasonBest,
  shouldSubmit,
  toLeaderboardScore,
  type SeasonScoreState,
} from './SeasonScore.ts';

const PILOT_STORAGE_KEY = 'manufacturer_pilot_v1';
const SEASON_STORAGE_KEY = 'manufacturer_cg_leaderboard_v1';

const env = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env ?? {};
const remoteUrl = typeof env.VITE_LEADERBOARD_URL === 'string' ? env.VITE_LEADERBOARD_URL.trim() : '';
const crazyGamesKey =
  typeof env.VITE_CRAZYGAMES_LEADERBOARD_KEY === 'string' ? env.VITE_CRAZYGAMES_LEADERBOARD_KEY.trim() : '';

export const leaderboard = new LeaderboardService(remoteUrl ? new RemoteLeaderboardProvider(remoteUrl) : null);

interface PilotIdentity {
  id: string;
  name: string;
}

let cachedPilot: PilotIdentity | null = null;

/** Oyuncunun kalıcı kimliği ve adı (yalnızca oyunun kendi skor sunucusu bağlıyken kullanılır) */
export function getPilot(): PilotIdentity {
  if (cachedPilot) return cachedPilot;
  try {
    const raw = localStorage.getItem(PILOT_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<PilotIdentity>) : null;
    if (parsed && typeof parsed.id === 'string' && typeof parsed.name === 'string') {
      cachedPilot = { id: parsed.id, name: parsed.name };
      return cachedPilot;
    }
  } catch {
    // Depolama kapalıysa bu oturumluk kimlik üretilir
  }
  const suffix = Math.floor(1000 + Math.random() * 9000);
  const id = `p-${Date.now().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
  cachedPilot = { id, name: `Pilot ${suffix}` };
  try {
    localStorage.setItem(PILOT_STORAGE_KEY, JSON.stringify(cachedPilot));
  } catch {
    // Depolama kapalıysa kimlik yalnız bu oturumda geçerlidir
  }
  return cachedPilot;
}

/** Tabloya yazılacak oyuncu: kimlik + güncel rekor */
export function currentPlayer(bestDistance: number): LeaderboardPlayer {
  const pilot = getPilot();
  return { id: pilot.id, name: pilot.name, bestDistance };
}

// ---------------------------------------------------------------------
// CrazyGames lider tablosu
// ---------------------------------------------------------------------

/** Son uçuşun skoruna ne olduğu */
export type ScoreSubmitStatus =
  /** CrazyGames'e gönderildi (sunucu her zaman "başarılı" der; doğrulama onların tarafındadır) */
  | 'sent'
  /** Bu haftanın en iyisi değildi; gönderilmedi */
  | 'not-season-best'
  /** Lider tablosu bu ortamda etkin değil (SDK yok ya da anahtar tanımlı değil) */
  | 'disabled'
  /** Mesafe geçersiz (sıfır, sayı değil ya da izin verilen sınırın üstünde) */
  | 'invalid'
  /** Gönderim sırasında hata oldu */
  | 'failed';

export interface CrazyGamesBoardState {
  /** Skor gönderimi çalışıyor mu? (SDK hazır ve anahtar tanımlı) */
  enabled: boolean;
  /** Bu hafta gönderilen en iyi mesafe (metre); yoksa 0 */
  seasonBest: number;
  /** Bu oturumdaki son uçuşun skoruna ne olduğu; henüz uçulmadıysa null */
  lastStatus: ScoreSubmitStatus | null;
}

let lastStatus: ScoreSubmitStatus | null = null;
let warnedMissingKey = false;

function loadSeasonState(): SeasonScoreState | null {
  try {
    const raw = localStorage.getItem(SEASON_STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Partial<SeasonScoreState>) : null;
    if (parsed && Number.isFinite(parsed.season) && Number.isFinite(parsed.best)) {
      return { season: parsed.season as number, best: parsed.best as number };
    }
  } catch {
    // Depolama kapalıysa durum yalnız bu oturumda tutulur
  }
  return memorySeasonState;
}

let memorySeasonState: SeasonScoreState | null = null;

function saveSeasonState(state: SeasonScoreState): void {
  memorySeasonState = state;
  try {
    localStorage.setItem(SEASON_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Depolama kapalıysa bellekteki kopya yeter
  }
}

/** CrazyGames lider tablosuna skor gönderilebiliyor mu? */
export function isCrazyGamesBoardEnabled(): boolean {
  if (!crazyGames.canSubmitScore) return false;
  if (!crazyGamesKey) {
    if (!warnedMissingKey) {
      warnedMissingKey = true;
      console.warn(
        '[Lider tablosu] VITE_CRAZYGAMES_LEADERBOARD_KEY tanımlı değil: skor gönderilmiyor. ' +
          'Anahtar CrazyGames geliştirici panelinde üretilir (docs/LEADERBOARD.md).',
      );
    }
    return false;
  }
  return true;
}

export function getCrazyGamesBoardState(now: number = Date.now()): CrazyGamesBoardState {
  return {
    enabled: isCrazyGamesBoardEnabled(),
    seasonBest: seasonBest(loadSeasonState(), now),
    lastStatus,
  };
}

/**
 * Tamamlanan bir uçuşun mesafesini lider tablolarına bildirir. Uçuş başına bir kez,
 * uçuştan fabrikaya dönülürken çağrılır; kayıt yüklenirken ya da sahne değişirken çağrılmaz.
 * `bestDistance` tüm zamanların rekorudur ve yalnızca oyunun kendi sunucusu (varsa) içindir.
 */
export async function submitFlightDistance(distanceMeters: number, bestDistance: number): Promise<ScoreSubmitStatus> {
  void leaderboard.submit(currentPlayer(bestDistance));

  const now = Date.now();
  const score = toLeaderboardScore(distanceMeters);
  if (!isCrazyGamesBoardEnabled()) {
    lastStatus = 'disabled';
  } else if (score === null) {
    lastStatus = 'invalid';
  } else if (!shouldSubmit(loadSeasonState(), score, now)) {
    lastStatus = 'not-season-best';
  } else if (await crazyGames.submitLeaderboardScore(score, crazyGamesKey)) {
    saveSeasonState(afterSubmit(score, now));
    lastStatus = 'sent';
  } else {
    lastStatus = 'failed';
  }
  return lastStatus;
}
