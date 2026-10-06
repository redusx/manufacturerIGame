/* ======================================================================
 * SaveManager.ts — Tarayıcı localStorage kayıt/yükleme ve offline ilerleme
 *
 * NOT: Bu modül, birleşik kalıcı depolama motoru olan
 * `src/factory/persistence/SaveManager.ts` üzerine inşa edilmiş geriye dönük
 * uyumluluk köprüsüdür. Yeni kodlar doğrudan birleşik yöneticiden faydalanabilir.
 * ====================================================================== */

import Decimal, { type DecimalSource } from 'break_eternity.js';
import type { EconomySaveData } from '../economy/EconomyManager.ts';
import type { FactorySaveData } from '../factory/types.ts';
import {
  SaveManager as UnifiedSaveManager,
  type UnifiedGameSaveData,
  type StorageLike,
  SAVE_KEY,
  LEGACY_SAVE_KEY,
  CURRENT_SAVE_VERSION,
  defaultUnifiedSaveData,
} from '../factory/persistence/SaveManager.ts';

export {
  UnifiedSaveManager,
  type UnifiedGameSaveData,
  type StorageLike,
  SAVE_KEY,
  LEGACY_SAVE_KEY,
  CURRENT_SAVE_VERSION,
  defaultUnifiedSaveData,
};

/* ---- Geriye Dönük Uyumluluk API ---- */

export const SaveManager = {
  /**
   * Headless testler ve özel ortamlar için varsayılan depolama adaptörü tanımlar.
   */
  setDefaultStorage(storage: StorageLike | null): void {
    UnifiedSaveManager.setDefaultStorage(storage);
  },

  /**
   * Ekonomi ve fabrika verilerini birleşik kayıt sistemine aktarır ve kaydeder.
   */
  save(
    data: EconomySaveData,
    extra?: {
      factoryEconomy?: {
        money: number;
        totalEarned: number;
        unlockedPlots: Set<number> | number[];
        revenueMultiplier: number;
        revenuePerSec?: number;
      };
      hangar?: { serialize(): any };
      factoryLayout?: FactorySaveData;
      milestones?: UnifiedGameSaveData['milestones'];
    },
    storage?: StorageLike,
  ): void {
    const current = UnifiedSaveManager.load(storage).data;
    current.economy = data;
    if (extra?.factoryEconomy) {
      current.factoryEconomy = {
        money: extra.factoryEconomy.money,
        totalEarned: extra.factoryEconomy.totalEarned,
        unlockedPlots: Array.from(extra.factoryEconomy.unlockedPlots),
        revenueMultiplier: extra.factoryEconomy.revenueMultiplier,
        revenuePerSec: extra.factoryEconomy.revenuePerSec,
      };
    }
    if (extra?.hangar) {
      current.hangar = extra.hangar.serialize();
    }
    if (extra?.factoryLayout) {
      current.factoryLayout = extra.factoryLayout;
    }
    if (extra?.milestones) {
      current.milestones = extra.milestones;
    }
    UnifiedSaveManager.save(current, storage);
  },

  /**
   * Birleşik kayıttan ekonomi verisini okur.
   */
  load(storage?: StorageLike): { data: EconomySaveData; wasCorrupted: boolean } {
    const res = UnifiedSaveManager.load(storage);
    return {
      data: res.data.economy,
      wasCorrupted: res.wasCorrupted,
    };
  },

  /**
   * Birleşik kaydın tüm alanlarını (ekonomi, parseller, hangar) okur.
   */
  loadUnified(storage?: StorageLike): { data: UnifiedGameSaveData; wasCorrupted: boolean } {
    return UnifiedSaveManager.load(storage);
  },

  /**
   * Tüm kayıt verilerini (v1, v2 ve v3) temizler.
   */
  clear(storage?: StorageLike): void {
    UnifiedSaveManager.clear(storage);
  },

  /**
   * Çevrimdışı ilerleme kazancını hesaplar.
   */
  calculateOfflineGains(
    savedTimestamp: number,
    productionPerSecond: DecimalSource,
  ): { gained: Decimal; elapsedSec: number } {
    return UnifiedSaveManager.calculateOfflineGains(savedTimestamp, productionPerSecond);
  },

  /**
   * Mevcut kaydı oyuncu yedekleme metni (Base64) olarak dışa aktarır.
   */
  exportSaveString(): string {
    return UnifiedSaveManager.exportSaveString(UnifiedSaveManager.load().data);
  },

  /**
   * Oyuncu yedekleme metnini içe aktarır ve kaydeder.
   */
  importSaveString(saveString: string): boolean {
    const res = UnifiedSaveManager.importSaveString(saveString);
    if (!res.success || !res.data) return false;
    return UnifiedSaveManager.save(res.data);
  },
};
