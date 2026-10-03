/* ======================================================================
 * src/factory/persistence/SaveManager.test.ts
 *
 * Kalıcı Kayıt ve Yükleme Yöneticisi (SaveManager) headless birim testleri.
 * Node 24 native test koşucusu: `node --experimental-strip-types --test`
 * ====================================================================== */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import {
  SaveManager,
  createDefaultSaveData,
  SAVE_KEY,
  LEGACY_SAVE_KEY,
  CURRENT_SAVE_VERSION,
  type StorageLike,
  type UnifiedGameSaveData,
} from './SaveManager.ts';
import { D } from '../../utils/decimal.ts';

class MemoryStorage implements StorageLike {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }
}

describe('SaveManager Headless Unit Tests', () => {
  let storage: MemoryStorage;

  beforeEach(() => {
    storage = new MemoryStorage();
  });

  it('Should generate a valid default save data template', () => {
    const data = createDefaultSaveData();

    assert.strictEqual(data.version, CURRENT_SAVE_VERSION);
    assert.strictEqual(data.economy.resources, '0');
    assert.strictEqual(data.economy.totalEarned, '0');
    assert.strictEqual(data.economy.rocketUpgrades.hull, 1);
    assert.strictEqual(data.economy.rocketUpgrades.engine, 1);
    assert.strictEqual(data.factoryEconomy?.money, 0);
    assert.strictEqual(data.factoryEconomy?.revenueMultiplier, 1.0);
    assert.deepStrictEqual(data.factoryEconomy?.unlockedPlots, [0]);
    assert.strictEqual(data.hangar?.levels.hull, 1);
    assert.strictEqual(data.hangar?.flightStats.bestDistance, 0);
    assert.ok(data.timestamp > 0);
  });

  it('Should save and load complete game state with 100% data fidelity', () => {
    const data = createDefaultSaveData();
    data.economy.resources = '4500';
    data.economy.totalEarned = '12000';
    data.economy.machines = [{ id: 'assembler', level: 3, totalProduced: '250' }];
    data.factoryEconomy = {
      money: 1250,
      totalEarned: 8000,
      unlockedPlots: [0, 1],
      revenueMultiplier: 1.30,
    };
    data.hangar = {
      levels: { hull: 2, engine: 2, wings: 1, boost: 2 },
      inventory: { reinforced_frame: 4, electric_motor: 1 },
      flightStats: {
        totalFlights: 3,
        totalDistance: 2500,
        bestDistance: 1200,
        totalCashEarned: 840,
      },
    };

    const saved = SaveManager.save(data, storage);
    assert.strictEqual(saved, true);
    assert.strictEqual(SaveManager.hasSave(storage), true);

    const result = SaveManager.load(storage);
    assert.strictEqual(result.isNewGame, false);
    assert.strictEqual(result.wasCorrupted, false);
    assert.strictEqual(result.wasMigrated, false);

    assert.strictEqual(result.data.version, CURRENT_SAVE_VERSION);
    assert.strictEqual(result.data.economy.resources, '4500');
    assert.strictEqual(result.data.economy.totalEarned, '12000');
    assert.strictEqual(result.data.factoryEconomy?.money, 1250);
    assert.strictEqual(result.data.factoryEconomy?.revenueMultiplier, 1.30);
    assert.deepStrictEqual(result.data.factoryEconomy?.unlockedPlots, [0, 1]);
    assert.strictEqual(result.data.hangar?.levels.hull, 2);
    assert.strictEqual(result.data.hangar?.inventory['reinforced_frame'], 4);
    assert.strictEqual(result.data.hangar?.flightStats.bestDistance, 1200);
  });

  it('Should return isNewGame true when loading from an empty storage', () => {
    assert.strictEqual(SaveManager.hasSave(storage), false);
    const result = SaveManager.load(storage);

    assert.strictEqual(result.isNewGame, true);
    assert.strictEqual(result.wasCorrupted, false);
    assert.strictEqual(result.wasMigrated, false);
    assert.strictEqual(result.data.version, CURRENT_SAVE_VERSION);
    assert.strictEqual(result.data.economy.resources, '0');
  });

  it('Should seamlessly migrate legacy v1/v2 save data to unified v3 format', () => {
    // Legacy save envelope (Phase 0)
    const legacyEnvelope = {
      version: 2,
      data: {
        resources: '15000',
        totalEarned: '40000',
        machines: [{ id: 'press', level: 2, totalProduced: '500' }],
        completedGoals: ['goal_press_unlock'],
        rocketUpgrades: { hull: 2, engine: 3, wings: 1, boost: 2 },
        flightStats: { totalFlights: 4, bestDistance: 850, bestScore: 1900 },
        timestamp: Date.now() - 3600000, // 1 saat önce
      },
    };

    storage.setItem(LEGACY_SAVE_KEY, JSON.stringify(legacyEnvelope));
    assert.strictEqual(SaveManager.hasSave(storage), true);

    const result = SaveManager.load(storage);
    assert.strictEqual(result.isNewGame, false);
    assert.strictEqual(result.wasMigrated, true);
    assert.strictEqual(result.wasCorrupted, false);

    // Göç ettirilen alanlar
    assert.strictEqual(result.data.version, CURRENT_SAVE_VERSION);
    assert.strictEqual(result.data.economy.resources, '15000');
    assert.strictEqual(result.data.hangar?.levels.hull, 2);
    assert.strictEqual(result.data.hangar?.levels.engine, 3);
    assert.strictEqual(result.data.hangar?.flightStats.bestDistance, 850);
    assert.strictEqual(result.data.hangar?.flightStats.totalFlights, 4);

    // Göç sonrasında v3 kaydı da depolanmış olmalı
    assert.ok(storage.getItem(SAVE_KEY) !== null);
  });

  it('Should handle corrupted JSON gracefully without crashing', () => {
    storage.setItem(SAVE_KEY, '{"broken json: ...');
    const result = SaveManager.load(storage);

    assert.strictEqual(result.wasCorrupted, true);
    assert.strictEqual(result.isNewGame, false);
    assert.strictEqual(result.data.version, CURRENT_SAVE_VERSION);
    assert.strictEqual(result.data.economy.resources, '0');
  });

  it('Should clear all save files completely on clear()', () => {
    const data = createDefaultSaveData();
    SaveManager.save(data, storage);
    storage.setItem(LEGACY_SAVE_KEY, '{}');

    assert.strictEqual(SaveManager.hasSave(storage), true);

    const cleared = SaveManager.clear(storage);
    assert.strictEqual(cleared, true);
    assert.strictEqual(SaveManager.hasSave(storage), false);
    assert.strictEqual(storage.getItem(SAVE_KEY), null);
    assert.strictEqual(storage.getItem(LEGACY_SAVE_KEY), null);
  });

  it('Should support export and import of save string (Player Backup)', () => {
    const data = createDefaultSaveData();
    data.economy.resources = '9999';
    data.hangar = {
      levels: { hull: 3, engine: 3, wings: 2, boost: 1 },
      inventory: { aero_hull_plate: 8 },
      flightStats: { totalFlights: 10, totalDistance: 15000, bestDistance: 5000, totalCashEarned: 4000 },
    };

    // Dışa aktar
    const saveString = SaveManager.exportSaveString(data);
    assert.ok(typeof saveString === 'string');
    assert.ok(saveString.length > 20);

    // İçe aktar
    const imported = SaveManager.importSaveString(saveString);
    assert.strictEqual(imported.success, true);
    assert.ok(imported.data);
    assert.strictEqual(imported.data.economy.resources, '9999');
    assert.strictEqual(imported.data.hangar?.levels.hull, 3);
    assert.strictEqual(imported.data.hangar?.inventory['aero_hull_plate'], 8);

    // Geçersiz string ile içe aktarma testi
    const failedImport = SaveManager.importSaveString('invalid-gibberish-string');
    assert.strictEqual(failedImport.success, false);
    assert.ok(failedImport.error);
  });

  it('Should calculate offline progression accurately with time limits and efficiency', () => {
    const now = Date.now();

    // 1. 5 saniyeden kısa süre -> Kazanç 0
    const shortGains = SaveManager.calculateOfflineGains(now - 3000, 10);
    assert.strictEqual(shortGains.gained.toNumber(), 0);
    assert.strictEqual(shortGains.elapsedSec, 0);

    // 2. 100 saniye, 10 pps, %50 verim: 100 * 10 * 0.5 = 500 kaynak
    const normalGains = SaveManager.calculateOfflineGains(now - 100000, 10);
    assert.strictEqual(normalGains.gained.toNumber(), 500);
    assert.strictEqual(Math.round(normalGains.elapsedSec), 100);

    // 3. 20,000 saniye (4 saatlik 14,400s sınırını aşar):
    // 14,400s * 10 * 0.5 = 72,000 kaynak
    const maxGains = SaveManager.calculateOfflineGains(now - 20000000, 10);
    assert.strictEqual(maxGains.gained.toNumber(), 72000);
    assert.strictEqual(maxGains.elapsedSec, 14400);

    // 4. Decimal pps desteği
    const bigGains = SaveManager.calculateOfflineGains(now - 200000, D(100)); // 200s * 100 * 0.5 = 10,000
    assert.strictEqual(bigGains.gained.toNumber(), 10000);
  });
});
