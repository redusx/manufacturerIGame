/* ======================================================================
 * src/leaderboard/LeaderboardService.ts — Lider tablosu (saf)
 *
 * Oyuncuların rekor mesafelerine göre sıralandığı tablo. Sıralamayı tutan
 * sağlayıcı dışarıdan takılır:
 *  - 'online': oyunun kendi skor sunucusu (docs/LEADERBOARD.md'deki sözleşme),
 *  - 'sample': geliştirme sürümünde arayüzü denemek için örnek pilotlar,
 *  - 'local' : sağlayıcı yokken. Başka oyuncu gösterilmez; oyuncunun rekoru menzil
 *              hedefleriyle birlikte sıralanır.
 * Örnek veya yerel tablo hiçbir zaman gerçek oyuncu sıralaması gibi sunulmaz;
 * pencere hangi kipte olduğunu yazar.
 *
 * Saf TypeScript — Phaser ve DOM bağımlılığı yoktur.
 * ====================================================================== */

import { RANGE_LADDER } from '../flight/RangeLadder.ts';

export type LeaderboardMode = 'online' | 'sample' | 'local';

/** Sağlayıcının döndürdüğü ham satır */
export interface LeaderboardScore {
  /** Oyuncunun kalıcı kimliği (varsa); oyuncunun kendi satırını bulmak için */
  id?: string;
  name: string;
  distanceMeters: number;
}

export interface LeaderboardProvider {
  readonly mode: Exclude<LeaderboardMode, 'local'>;
  /** En iyi `limit` satır, mesafeye göre azalan */
  fetchTop(limit: number): Promise<LeaderboardScore[]>;
  /** Oyuncunun rekorunu gönderir (sunucu yalnızca daha iyi olanı saklar) */
  submit(score: LeaderboardScore): Promise<void>;
}

export interface LeaderboardEntry {
  rank: number;
  name: string;
  distanceMeters: number;
  isPlayer: boolean;
  /** Yerel kipte: oyuncu değil, menzil hedefi satırı */
  isBenchmark: boolean;
}

export interface LeaderboardSnapshot {
  mode: LeaderboardMode;
  entries: LeaderboardEntry[];
  /** Oyuncunun sırası; tabloda yoksa (rekoru yok ya da ilk N dışında) null */
  playerRank: number | null;
  /** Sunucuya ulaşılamadıysa true: yerel tablo gösterilir */
  failed: boolean;
}

export interface LeaderboardPlayer {
  id: string;
  name: string;
  bestDistance: number;
}

export const LEADERBOARD_LIMIT = 50;

export class LeaderboardService {
  private provider: LeaderboardProvider | null;

  constructor(provider: LeaderboardProvider | null = null) {
    this.provider = provider;
  }

  setProvider(provider: LeaderboardProvider | null): void {
    this.provider = provider;
  }

  get mode(): LeaderboardMode {
    return this.provider?.mode ?? 'local';
  }

  /** Oyuncunun rekorunu sağlayıcıya bildirir; sağlayıcı yoksa veya hata olursa sessizce geçer */
  async submit(player: LeaderboardPlayer): Promise<boolean> {
    if (!this.provider || player.bestDistance <= 0) return false;
    try {
      await this.provider.submit({
        id: player.id,
        name: player.name,
        distanceMeters: Math.floor(player.bestDistance),
      });
      return true;
    } catch {
      return false;
    }
  }

  /** Gösterilecek tabloyu kurar: sağlayıcının satırları + oyuncunun kendi satırı */
  async snapshot(player: LeaderboardPlayer): Promise<LeaderboardSnapshot> {
    if (!this.provider) return LeaderboardService.localSnapshot(player, false);

    let scores: LeaderboardScore[];
    try {
      scores = await this.provider.fetchTop(LEADERBOARD_LIMIT);
    } catch {
      return LeaderboardService.localSnapshot(player, true);
    }
    return LeaderboardService.rank(this.provider.mode, scores, player);
  }

  /** Satırları mesafeye göre sıralar ve oyuncunun satırını (yoksa ekleyerek) işaretler */
  static rank(mode: LeaderboardMode, scores: LeaderboardScore[], player: LeaderboardPlayer): LeaderboardSnapshot {
    const rows = scores
      .filter((score) => Number.isFinite(score.distanceMeters) && score.distanceMeters > 0)
      .map((score) => ({
        name: score.name,
        distanceMeters: Math.floor(score.distanceMeters),
        isPlayer: score.id !== undefined && score.id === player.id,
      }));

    // Oyuncunun güncel rekoru sunucudakinden yeni olabilir: kendi satırı yerelden gelir
    const own = rows.find((row) => row.isPlayer);
    if (own) {
      own.distanceMeters = Math.max(own.distanceMeters, Math.floor(player.bestDistance));
      own.name = player.name;
    } else if (player.bestDistance > 0) {
      rows.push({ name: player.name, distanceMeters: Math.floor(player.bestDistance), isPlayer: true });
    }

    rows.sort((a, b) => b.distanceMeters - a.distanceMeters);
    const entries = rows.map((row, index) => ({ ...row, rank: index + 1, isBenchmark: false }));
    return {
      mode,
      entries,
      playerRank: entries.find((entry) => entry.isPlayer)?.rank ?? null,
      failed: false,
    };
  }

  /**
   * Sunucu yokken gösterilen tablo: başka oyuncu uydurulmaz. Oyuncunun rekoru, menzil
   * merdiveninin hedefleriyle birlikte sıralanır ("Mars Yörüngesi 20 km" gibi).
   */
  static localSnapshot(player: LeaderboardPlayer, failed: boolean): LeaderboardSnapshot {
    const rows = RANGE_LADDER.map((rung) => ({
      name: rung.name,
      distanceMeters: rung.targetMeters,
      isPlayer: false,
      isBenchmark: true,
    }));
    if (player.bestDistance > 0) {
      rows.push({
        name: player.name,
        distanceMeters: Math.floor(player.bestDistance),
        isPlayer: true,
        isBenchmark: false,
      });
    }
    // Eşitlikte oyuncu hedefin üstünde görünür (hedefe ulaşmıştır)
    rows.sort((a, b) => b.distanceMeters - a.distanceMeters || Number(b.isPlayer) - Number(a.isPlayer));
    const entries = rows.map((row, index) => ({ ...row, rank: index + 1 }));
    return {
      mode: 'local',
      entries,
      playerRank: entries.find((entry) => entry.isPlayer)?.rank ?? null,
      failed,
    };
  }
}
