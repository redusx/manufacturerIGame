/* ======================================================================
 * src/leaderboard/providers.ts — Lider tablosu sağlayıcıları
 *
 * RemoteLeaderboardProvider: oyunun kendi skor sunucusuyla konuşur. Sözleşme
 * docs/LEADERBOARD.md'dedir:
 *   GET  {url}/top?limit=50  ->  [{ "id": "...", "name": "...", "distance": 12345 }]
 *   POST {url}/score         <-  { "id": "...", "name": "...", "distance": 12345 }
 *
 * SampleLeaderboardProvider: yalnız geliştirme sürümünde, arayüzü denemek için
 * örnek pilotlar üretir. Pencere bunun örnek veri olduğunu açıkça yazar.
 * ====================================================================== */

import type { LeaderboardProvider, LeaderboardScore } from './LeaderboardService.ts';

interface RemoteRow {
  id?: unknown;
  name?: unknown;
  distance?: unknown;
}

const REQUEST_TIMEOUT_MS = 6000;

export class RemoteLeaderboardProvider implements LeaderboardProvider {
  readonly mode = 'online' as const;
  private readonly baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  private async request(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, { ...init, signal: controller.signal });
      if (!response.ok) throw new Error(`Lider tablosu sunucusu ${response.status} döndü`);
      return response;
    } finally {
      clearTimeout(timer);
    }
  }

  async fetchTop(limit: number): Promise<LeaderboardScore[]> {
    const response = await this.request(`/top?limit=${limit}`);
    const rows = (await response.json()) as RemoteRow[];
    if (!Array.isArray(rows)) throw new Error('Lider tablosu yanıtı liste değil');
    return rows
      .filter((row) => typeof row.name === 'string' && typeof row.distance === 'number')
      .map((row) => ({
        id: typeof row.id === 'string' ? row.id : undefined,
        // Ad sunucudan gelir: uzunluğu sınırlanır, yalnızca yazı olarak çizilir
        name: (row.name as string).slice(0, 20),
        distanceMeters: row.distance as number,
      }));
  }

  async submit(score: LeaderboardScore): Promise<void> {
    await this.request('/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: score.id, name: score.name, distance: score.distanceMeters }),
    });
  }
}

/** Örnek pilotlar: gerçek oyuncu değildir (geliştirme sürümü) */
const SAMPLE_PILOTS: ReadonlyArray<[string, number]> = [
  ['Örnek Pilot A', 86400],
  ['Örnek Pilot B', 61250],
  ['Örnek Pilot C', 42800],
  ['Örnek Pilot D', 30100],
  ['Örnek Pilot E', 21700],
  ['Örnek Pilot F', 15300],
  ['Örnek Pilot G', 10900],
  ['Örnek Pilot H', 7400],
  ['Örnek Pilot I', 5150],
  ['Örnek Pilot J', 2600],
  ['Örnek Pilot K', 1100],
  ['Örnek Pilot L', 420],
];

export class SampleLeaderboardProvider implements LeaderboardProvider {
  readonly mode = 'sample' as const;

  async fetchTop(limit: number): Promise<LeaderboardScore[]> {
    return SAMPLE_PILOTS.slice(0, limit).map(([name, distanceMeters], index) => ({
      id: `sample-${index}`,
      name,
      distanceMeters,
    }));
  }

  async submit(): Promise<void> {
    // Örnek tabloda saklanacak bir şey yok
  }
}
