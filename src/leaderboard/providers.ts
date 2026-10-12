/* ======================================================================
 * src/leaderboard/providers.ts — Lider tablosu sağlayıcıları
 *
 * RemoteLeaderboardProvider: oyunun kendi skor sunucusuyla konuşur. Sözleşme
 * docs/LEADERBOARD.md'dedir:
 *   GET  {url}/top?limit=50  ->  [{ "id": "...", "name": "...", "distance": 12345 }]
 *   POST {url}/score         <-  { "id": "...", "name": "...", "distance": 12345 }
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
