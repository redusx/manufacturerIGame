/* ======================================================================
 * src/leaderboard/leaderboard.ts — Oyunun lider tablosu servisi
 *
 * Sağlayıcı tek yerden seçilir:
 *  - `VITE_LEADERBOARD_URL` tanımlıysa oyunun kendi skor sunucusu ('online'),
 *  - değilse geliştirme sürümünde örnek pilotlar ('sample'),
 *  - yayın sürümünde sunucu yoksa yerel tablo ('local': yalnız oyuncu ve menzil hedefleri).
 * Ayrıca CrazyGames'in kendi lider tablosuna (davetli oyunlar; sıralamayı CrazyGames
 * kendi panelinde gösterir) skor gönderilir: `VITE_CRAZYGAMES_LEADERBOARD_KEY` gerekir.
 * Ayrıntı: docs/LEADERBOARD.md
 * ====================================================================== */

import { crazyGames } from '../integration/CrazyGamesSDK.ts';
import { LeaderboardService, type LeaderboardPlayer } from './LeaderboardService.ts';
import { RemoteLeaderboardProvider, SampleLeaderboardProvider } from './providers.ts';

const PILOT_STORAGE_KEY = 'manufacturer_pilot_v1';

const env = (import.meta as unknown as { env?: Record<string, string | boolean | undefined> }).env ?? {};
const remoteUrl = typeof env.VITE_LEADERBOARD_URL === 'string' ? env.VITE_LEADERBOARD_URL.trim() : '';
const crazyGamesKey =
  typeof env.VITE_CRAZYGAMES_LEADERBOARD_KEY === 'string' ? env.VITE_CRAZYGAMES_LEADERBOARD_KEY.trim() : '';

export const leaderboard = new LeaderboardService(
  remoteUrl ? new RemoteLeaderboardProvider(remoteUrl) : env.DEV === true ? new SampleLeaderboardProvider() : null,
);

interface PilotIdentity {
  id: string;
  name: string;
}

let cachedPilot: PilotIdentity | null = null;

/** Oyuncunun kalıcı kimliği ve tabloda görünen adı (tarayıcıda saklanır) */
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

/** Yeni rekoru sağlayıcılara bildirir (oyunun sunucusu ve varsa CrazyGames tablosu) */
export function submitRecord(bestDistance: number): void {
  void leaderboard.submit(currentPlayer(bestDistance));
  if (crazyGamesKey) void crazyGames.submitLeaderboardScore(Math.floor(bestDistance), crazyGamesKey);
}
