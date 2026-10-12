/* ======================================================================
 * src/leaderboard/LeaderboardService.ts — Oyunun kendi skor sunucusundaki tablo (saf)
 *
 * İsteğe bağlı yol: `VITE_LEADERBOARD_URL` ile bir skor sunucusu bağlanırsa oyuncuların
 * rekor mesafeleri oradan okunur ve pencerede listelenir ('online').
 * Sunucu yoksa ('local') hiçbir satır üretilmez: başka oyuncu uydurulmaz, yerel kayıt
 * sıralama gibi sunulmaz. Asıl sıralama CrazyGames'tedir (leaderboard.ts).
 *
 * Saf TypeScript — Phaser ve DOM bağımlılığı yoktur.
 * ====================================================================== */

export type LeaderboardMode = 'online' | 'local';

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
}

export interface LeaderboardSnapshot {
  mode: LeaderboardMode;
  entries: LeaderboardEntry[];
  /** Oyuncunun sırası; tabloda yoksa (rekoru yok ya da ilk N dışında) null */
  playerRank: number | null;
  /** Sunucuya ulaşılamadıysa true: liste gösterilemez */
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
    const entries = rows.map((row, index) => ({ ...row, rank: index + 1 }));
    return {
      mode,
      entries,
      playerRank: entries.find((entry) => entry.isPlayer)?.rank ?? null,
      failed: false,
    };
  }

  /** Sunucu yokken ya da ulaşılamadığında: satır yok (başka oyuncu uydurulmaz) */
  static localSnapshot(_player: LeaderboardPlayer, failed: boolean): LeaderboardSnapshot {
    return { mode: 'local', entries: [], playerRank: null, failed };
  }
}
