/* ======================================================================
 * src/factory/persistence/SaveManager.ts — Birleşik Kalıcı Kayıt ve Yükleme Motoru
 *
 * Tüm fabrika durumunu, simülasyon ekonomisini, roket hangarı parça stoklarını,
 * kilometre taşlarını, yan kontratları ve çevrimdışı ilerlemeyi yöneten
 * kalıcı depolama yöneticisi (docs/MASTER_PLAN.md TASK-120).
 *
 * Sorumluluklar:
 * - LocalStorage ve StorageLike arayüzü ile sıfır bağımlılıklı depolama
 * - Çoklu alt sistem (Ekonomi, Hangar, Parseller, Kontratlar, Müfredat) serileştirmesi
 * - Geriye dönük uyumluluk ve otomatik sürüm yükseltme (v1/v2 -> v3)
 * - Bozuk JSON ve depolama kota aşımı durumunda hatasız kurtarma (Graceful Recovery)
 * - Metin tabanlı kayıt dışa/içe aktarma (Player Backup / Restore String)
 * - Çevrimdışı (offline) gelir hesabı (4 saate kadar, %50 verim)
 *
 * Saf TypeScript — Node 24 native testleri ile %100 test edilebilir.
 * ====================================================================== */

import Decimal, { type DecimalSource } from 'break_eternity.js';
import { D, D_ZERO } from '../../utils/decimal.ts';
import type { EconomySaveData } from '../../economy/EconomyManager.ts';
import type { EconomyState, FactorySaveData } from '../types.ts';
import type { RocketHangarSaveData } from '../simulation/RocketHangarBridge.ts';
import type { MilestoneState } from '../progression/MilestoneManager.ts';
import type { ContractSaveData } from '../progression/ContractManager.ts';
import {
  MAX_OFFLINE_SECONDS,
  OFFLINE_EFFICIENCY,
} from '../../data/MachineData.ts';

export const SAVE_KEY = 'manufacturer_unified_save_v3';
export const LEGACY_SAVE_KEY = 'manufacturer_save';
export const CURRENT_SAVE_VERSION = 3;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface UnifiedGameSaveData {
  version: number;
  timestamp: number;
  /** Phase 0-3 Arcade / Incremental Ekonomi Durumu */
  economy: EconomySaveData;
  /** Phase 1-5 Fabrika Simülasyon Ekonomisi (Sermaye, Parseller, Çarpan) */
  factoryEconomy?: EconomyState;
  /** Phase 5 Roket Hangarı (Modül Seviyeleri, Havacılık Parça Stoğu, Kariyer Uçuşları) */
  hangar?: RocketHangarSaveData;
  /** Phase 4 Fabrika Kilometre Taşları ve İlerleme Durumu */
  milestones?: MilestoneState;
  /** Phase 4 Hızlı Yan Siparişler / Kontratlar */
  contracts?: ContractSaveData;
  /** Phase 1-2 Izgara, Bantlar ve Makineler Düzeni */
  factoryLayout?: FactorySaveData;
}

export interface LoadResult {
  data: UnifiedGameSaveData;
  isNewGame: boolean;
  wasCorrupted: boolean;
  wasMigrated: boolean;
}

/** Varsayılan, sıfırdan başlayan kayıt şablonu oluşturur */
export function createDefaultSaveData(): UnifiedGameSaveData {
  const now = Date.now();
  return {
    version: CURRENT_SAVE_VERSION,
    timestamp: now,
    economy: {
      resources: '0',
      totalEarned: '0',
      machines: [],
      completedGoals: [],
      rocketUpgrades: { hull: 1, engine: 1, wings: 1, boost: 1 },
      flightStats: { totalFlights: 0, bestDistance: 0, bestScore: 0 },
      timestamp: now,
    },
    factoryEconomy: {
      money: 0,
      totalEarned: 0,
      unlockedPlots: [0],
      revenueMultiplier: 1.0,
    },
    hangar: {
      levels: { hull: 1, engine: 1, wings: 1, boost: 1 },
      inventory: {},
      flightStats: {
        totalFlights: 0,
        totalDistance: 0,
        bestDistance: 0,
        totalCashEarned: 0,
      },
    },
    milestones: {
      currentMilestoneIndex: 0,
      completedMilestoneIds: [],
      exportedItemCounts: {},
      unlockedMachineIds: [],
      unlockedFeatureIds: [],
    },
    contracts: {
      available: [],
      active: [],
      completedContractIds: [],
      totalCompletedCount: 0,
      totalRewardsEarned: 0,
    },
  };
}

export const defaultUnifiedSaveData = createDefaultSaveData;

export class SaveManager {
  private static defaultStorage: StorageLike | null = null;

  /**
   * Headless testler ve özel ortamlar için varsayılan depolama adaptörü tanımlar.
   */
  public static setDefaultStorage(storage: StorageLike | null): void {
    this.defaultStorage = storage;
  }

  /**
   * Tarayıcı depolama adaptörünü döner.
   */
  private static getStorage(customStorage?: StorageLike): StorageLike | null {
    if (customStorage) return customStorage;
    if (this.defaultStorage) return this.defaultStorage;
    if (typeof localStorage !== 'undefined') return localStorage;
    return null;
  }

  /**
   * Birleşik oyun verisini depolamaya kaydeder.
   * @param data Kaydedilecek birleşik veri
   * @param storage İsteğe bağlı özel depolama adaptörü (headless testler için)
   * @param key Depolama anahtarı
   * @returns Başarılı ise true
   */
  static save(
    data: UnifiedGameSaveData,
    storage?: StorageLike,
    key = SAVE_KEY,
  ): boolean {
    const store = this.getStorage(storage);
    if (!store) {
      console.warn('[SaveManager] Depolama ortamı bulunamadı.');
      return false;
    }

    try {
      const payload: UnifiedGameSaveData = {
        ...data,
        version: CURRENT_SAVE_VERSION,
        timestamp: Date.now(),
      };
      const json = JSON.stringify(payload);
      store.setItem(key, json);
      return true;
    } catch (err) {
      console.warn('[SaveManager] Kayıt yazılamadı (Kota aşımı veya engelli):', err);
      return false;
    }
  }

  /**
   * Depolamadan kayıt verisini okur.
   * - Kayıt yoksa: `isNewGame: true`
   * - Eski v1/v2 kaydı varsa: Otomatik olarak v3 formatına yükseltir (`wasMigrated: true`)
   * - Bozuk/hasarlı JSON varsa: Varsayılan kayıtla başlar (`wasCorrupted: true`)
   */
  static load(storage?: StorageLike, key = SAVE_KEY): LoadResult {
    const store = this.getStorage(storage);
    if (!store) {
      return {
        data: createDefaultSaveData(),
        isNewGame: true,
        wasCorrupted: false,
        wasMigrated: false,
      };
    }

    // 1. Yeni sürüm (v3) kaydını kontrol et
    try {
      const raw = store.getItem(key);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (this.isValidUnifiedSave(parsed)) {
          return {
            data: parsed,
            isNewGame: false,
            wasCorrupted: false,
            wasMigrated: false,
          };
        } else {
          console.warn('[SaveManager] v3 kaydı şemaya uymuyor; sıfırlanıyor.');
          return {
            data: createDefaultSaveData(),
            isNewGame: false,
            wasCorrupted: true,
            wasMigrated: false,
          };
        }
      }
    } catch (err) {
      console.warn('[SaveManager] v3 kaydı okunamadı / bozuk JSON:', err);
      return {
        data: createDefaultSaveData(),
        isNewGame: false,
        wasCorrupted: true,
        wasMigrated: false,
      };
    }

    // 2. Eski sürüm (v1/v2) legacy kaydını kontrol et ve göç ettir (Migration)
    try {
      const legacyRaw = store.getItem(LEGACY_SAVE_KEY);
      if (legacyRaw) {
        const legacyParsed = JSON.parse(legacyRaw);
        if (this.isValidLegacyEnvelope(legacyParsed)) {
          const migrated = this.migrateLegacySave(legacyParsed.data);
          // Yeni formatta kaydet
          this.save(migrated, store, key);
          return {
            data: migrated,
            isNewGame: false,
            wasCorrupted: false,
            wasMigrated: true,
          };
        }
      }
    } catch (err) {
      console.warn('[SaveManager] Legacy kayıt okunamadı:', err);
    }

    // 3. Hiç kayıt yok -> Yeni oyun
    return {
      data: createDefaultSaveData(),
      isNewGame: true,
      wasCorrupted: false,
      wasMigrated: false,
    };
  }

  /**
   * Kayıtlı veriyi tamamen siler (Sıfırdan Başla / Hard Reset).
   */
  static clear(storage?: StorageLike, key = SAVE_KEY): boolean {
    const store = this.getStorage(storage);
    if (!store) return false;

    try {
      store.removeItem(key);
      store.removeItem(LEGACY_SAVE_KEY);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Depolamada geçerli bir kayıt var mı?
   */
  static hasSave(storage?: StorageLike, key = SAVE_KEY): boolean {
    const store = this.getStorage(storage);
    if (!store) return false;
    return store.getItem(key) !== null || store.getItem(LEGACY_SAVE_KEY) !== null;
  }

  /**
   * Kayıt verisini Base64 kodlu taşınabilir metin dizgisine dönüştürür (Player Export).
   */
  static exportSaveString(data: UnifiedGameSaveData): string {
    const json = JSON.stringify(data);
    if (typeof btoa !== 'undefined') {
      return btoa(unescape(encodeURIComponent(json)));
    }
    const nodeBuffer = (globalThis as unknown as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer;
    if (nodeBuffer) {
      return nodeBuffer.from(json, 'utf-8').toString('base64');
    }
    return '';
  }

  /**
   * Oyuncunun girdiği metin dizgisinden kayıt verisini geri yükler ve doğrular (Player Import).
   */
  static importSaveString(
    saveString: string,
  ): { data?: UnifiedGameSaveData; success: boolean; error?: string } {
    if (!saveString || typeof saveString !== 'string') {
      return { success: false, error: 'Kayıt metni boş veya geçersiz' };
    }

    try {
      let json: string;
      const trimmed = saveString.trim();

      // Base64 veya doğrudan JSON kontrolü
      if (trimmed.startsWith('{')) {
        json = trimmed;
      } else {
        if (typeof atob !== 'undefined') {
          json = decodeURIComponent(escape(atob(trimmed)));
        } else {
          const nodeBuffer = (globalThis as unknown as { Buffer?: { from: (s: string, enc: string) => { toString: (enc: string) => string } } }).Buffer;
          if (nodeBuffer) {
            json = nodeBuffer.from(trimmed, 'base64').toString('utf-8');
          } else {
            return { success: false, error: 'Base64 ortamı bulunamadı' };
          }
        }
      }

      const parsed = JSON.parse(json);
      if (this.isValidUnifiedSave(parsed)) {
        return { data: parsed, success: true };
      } else if (this.isValidLegacyEnvelope(parsed)) {
        return { data: this.migrateLegacySave(parsed.data), success: true };
      }

      return { success: false, error: 'Bilinmeyen veya desteklenmeyen kayıt formatı' };
    } catch (err) {
      return { success: false, error: `Kayıt çözülemedi: ${String(err)}` };
    }
  }

  /**
   * Çevrimdışı (offline) kalınan süre boyunca üretilen kaynağı hesaplar.
   * @param savedTimestamp Son kayıt anı (milisaniye)
   * @param productionPerSecond Saniyelik temel üretim debisi (DecimalSource)
   * @param maxSeconds Maksimum çevrimdışı üretim süresi (varsayılan: 4 saat = 14,400s)
   * @param efficiency Çevrimdışı üretim verimi (varsayılan: %50 = 0.50)
   */
  static calculateOfflineGains(
    savedTimestamp: number,
    productionPerSecond: DecimalSource,
    maxSeconds: number = MAX_OFFLINE_SECONDS,
    efficiency: number = OFFLINE_EFFICIENCY,
  ): { gained: Decimal; elapsedSec: number } {
    const now = Date.now();
    let elapsedSec = (now - savedTimestamp) / 1000;

    // Negatif veya çok küçük süreleri (5 saniyenin altı) yoksay
    if (elapsedSec < 5) {
      return { gained: D_ZERO, elapsedSec: 0 };
    }

    // Üst sınır uygula (maksimum 4 saat)
    elapsedSec = Math.min(elapsedSec, maxSeconds);

    const pps = D(productionPerSecond);
    const gained = pps.mul(elapsedSec).mul(efficiency).floor();
    return { gained, elapsedSec };
  }

  // -------------------------------------------------------------
  // ŞEMA DOĞRULAMA VE GÖÇ YARDIMCILARI
  // -------------------------------------------------------------

  private static isValidUnifiedSave(obj: unknown): obj is UnifiedGameSaveData {
    if (!obj || typeof obj !== 'object') return false;
    const o = obj as Record<string, unknown>;

    if (typeof o['version'] !== 'number' || o['version'] < 1) return false;
    if (typeof o['timestamp'] !== 'number') return false;
    if (!o['economy'] || typeof o['economy'] !== 'object') return false;

    const econ = o['economy'] as Record<string, unknown>;
    const resValid =
      typeof econ['resources'] === 'string' || typeof econ['resources'] === 'number';
    return resValid;
  }

  private static isValidLegacyEnvelope(
    obj: unknown,
  ): obj is { version: number; data: EconomySaveData } {
    if (!obj || typeof obj !== 'object') return false;
    const o = obj as Record<string, unknown>;

    if (typeof o['version'] !== 'number') return false;
    if (!o['data'] || typeof o['data'] !== 'object') return false;

    const d = o['data'] as Record<string, unknown>;
    const resValid = typeof d['resources'] === 'string' || typeof d['resources'] === 'number';
    return resValid && typeof d['timestamp'] === 'number';
  }

  private static migrateLegacySave(legacy: EconomySaveData): UnifiedGameSaveData {
    const defaultData = createDefaultSaveData();

    // Hangar seviyelerini ve uçuş istatistiklerini legacy veriden eşitle
    const hullLvl = Number(legacy.rocketUpgrades?.['hull']) || 1;
    const engineLvl = Number(legacy.rocketUpgrades?.['engine']) || 1;
    const wingsLvl = Number(legacy.rocketUpgrades?.['wings']) || 1;
    const boostLvl = Number(legacy.rocketUpgrades?.['boost']) || 1;

    return {
      version: CURRENT_SAVE_VERSION,
      timestamp: legacy.timestamp || Date.now(),
      economy: {
        resources: String(legacy.resources ?? '0'),
        totalEarned: String(legacy.totalEarned ?? '0'),
        machines: Array.isArray(legacy.machines) ? legacy.machines : [],
        completedGoals: Array.isArray(legacy.completedGoals) ? legacy.completedGoals : [],
        rocketUpgrades: {
          hull: hullLvl,
          engine: engineLvl,
          wings: wingsLvl,
          boost: boostLvl,
        },
        flightStats: {
          totalFlights: Number(legacy.flightStats?.totalFlights) || 0,
          bestDistance: Number(legacy.flightStats?.bestDistance) || 0,
          bestScore: Number(legacy.flightStats?.bestScore) || 0,
        },
        timestamp: legacy.timestamp || Date.now(),
      },
      factoryEconomy: {
        money: 0,
        totalEarned: 0,
        unlockedPlots: [0],
        revenueMultiplier: 1.0,
      },
      hangar: {
        levels: {
          hull: hullLvl,
          engine: engineLvl,
          wings: wingsLvl,
          boost: boostLvl,
        },
        inventory: {},
        flightStats: {
          totalFlights: Number(legacy.flightStats?.totalFlights) || 0,
          totalDistance: Number(legacy.flightStats?.bestDistance) || 0,
          bestDistance: Number(legacy.flightStats?.bestDistance) || 0,
          totalCashEarned: 0,
        },
      },
      milestones: defaultData.milestones,
      contracts: defaultData.contracts,
    };
  }
}
