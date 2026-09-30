/* ======================================================================
 * SaveManager.ts — Tarayıcı localStorage kayıt/yükleme ve offline ilerleme
 *
 * Oyun mantığından ayrıdır; EconomySaveData arayüzü üzerinden çalışır.
 * İleride CrazyGames cloud save'e geçiş bu modülde yapılır.
 * ====================================================================== */

import Decimal, { type DecimalSource } from 'break_eternity.js';
import { D, D_ZERO } from '../utils/decimal';
import type { EconomySaveData } from '../economy/EconomyManager';
import {
  MAX_OFFLINE_SECONDS,
  OFFLINE_EFFICIENCY,
} from '../data/MachineData';

const SAVE_KEY = 'manufacturer_save';
const SAVE_VERSION = 2; // Decimal serileştirme ile sürüm 2

interface SaveEnvelope {
  version: number;
  data: EconomySaveData;
}

/* ---- Varsayılan (boş) kayıt ---- */
function defaultSaveData(): EconomySaveData {
  return {
    resources: '0',
    totalEarned: '0',
    machines: [],
    completedGoals: [],
    rocketUpgrades: { hull: 1, engine: 1, wings: 1, boost: 1 },
    flightStats: { totalFlights: 0, bestDistance: 0, bestScore: 0 },
    timestamp: Date.now(),
  };
}

/* ---- API ---- */

export const SaveManager = {
  /** Kayıt verisini localStorage'a yazar */
  save(data: EconomySaveData): void {
    try {
      const envelope: SaveEnvelope = { version: SAVE_VERSION, data };
      localStorage.setItem(SAVE_KEY, JSON.stringify(envelope));
    } catch {
      console.warn('[SaveManager] Kayıt yazılamadı.');
    }
  },

  /**
   * localStorage'dan kayıt verisini okur.
   * Bozuk veya eski veri varsa geriye dönük uyumlulukla yükler veya sıfırlar.
   * @returns { data, wasCorrupted }
   */
  load(): { data: EconomySaveData; wasCorrupted: boolean } {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (!raw) return { data: defaultSaveData(), wasCorrupted: false };

      const parsed: unknown = JSON.parse(raw);
      if (!isValidEnvelope(parsed)) {
        console.warn('[SaveManager] Kayıt verisi geçersiz; sıfırlandı.');
        return { data: defaultSaveData(), wasCorrupted: true };
      }

      const envelope = parsed as SaveEnvelope;

      // Sürüm 1 veya 2 kabul edilir (v1 geriye dönük sayı olarak kaydedilmişti)
      if (envelope.version !== SAVE_VERSION && envelope.version !== 1) {
        console.warn('[SaveManager] Bilinmeyen kayıt sürümü; sıfırlandı.');
        return { data: defaultSaveData(), wasCorrupted: true };
      }

      return { data: envelope.data, wasCorrupted: false };
    } catch {
      console.warn('[SaveManager] Kayıt okunamadı; sıfırlandı.');
      return { data: defaultSaveData(), wasCorrupted: true };
    }
  },

  /** Kaydı tamamen siler */
  clear(): void {
    localStorage.removeItem(SAVE_KEY);
  },

  /**
   * Offline ilerleme hesaplar.
   * @param savedTimestamp Son kayıt anı (ms)
   * @param productionPerSecond Çevrimdışıyken aktif olan toplam üretim/sn
   * @returns Kazanılan kaynak (Decimal) ve geçen saniye
   */
  calculateOfflineGains(
    savedTimestamp: number,
    productionPerSecond: DecimalSource,
  ): { gained: Decimal; elapsedSec: number } {
    const now = Date.now();
    let elapsedSec = (now - savedTimestamp) / 1000;

    // Negatif veya çok küçük süreleri yoksay
    if (elapsedSec < 5) return { gained: D_ZERO, elapsedSec: 0 };

    // Üst sınır uygula
    elapsedSec = Math.min(elapsedSec, MAX_OFFLINE_SECONDS);

    const pps = D(productionPerSecond);
    const gained = pps.mul(elapsedSec).mul(OFFLINE_EFFICIENCY).floor();
    return { gained, elapsedSec };
  },
};

/* ---- Doğrulama yardımcısı ---- */

function isValidEnvelope(obj: unknown): obj is SaveEnvelope {
  if (typeof obj !== 'object' || obj === null) return false;
  const o = obj as Record<string, unknown>;
  if (typeof o['version'] !== 'number') return false;
  if (typeof o['data'] !== 'object' || o['data'] === null) return false;
  const d = o['data'] as Record<string, unknown>;
  const resValid = typeof d['resources'] === 'number' || typeof d['resources'] === 'string';
  return resValid && typeof d['timestamp'] === 'number';
}
