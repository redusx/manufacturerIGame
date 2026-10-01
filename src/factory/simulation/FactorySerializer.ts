/* ======================================================================
 * src/factory/simulation/FactorySerializer.ts — Fabrika Serileştirme Motoru
 *
 * Tüm fabrika durumunu (ızgara boyutları, sabit silolar ve ihracat kapıları,
 * konveyör bantları üzerindeki eşyalarla birlikte, tüm makinelerin
 * üretim durumu, tamponları, seviyeleri ve oyuncunun incremental ekonomisini)
 * tek bir JSON şemasına (FactorySaveData) dönüştürür ve %100 durum
 * korunumuyla geri yükler.
 * Phaser bağımlılığı yoktur; tarayıcı (localStorage) ve Node.js uyumludur.
 * ====================================================================== */

import type {
  FactorySaveData,
  IntakeCellData,
} from '../types.ts';
import { GridMap } from './GridMap.ts';
import { LogisticsNetwork } from './LogisticsNetwork.ts';
import { ProductionEngine } from './ProductionEngine.ts';
import { FactoryEconomy } from './FactoryEconomy.ts';
import { MachineRegistry, defaultMachineRegistry } from './MachineRegistry.ts';
import { RecipeRegistry, defaultRecipeRegistry } from './RecipeRegistry.ts';
import { ItemRegistry, defaultItemRegistry } from './ItemRegistry.ts';

export interface FactoryInstance {
  grid: GridMap;
  logistics: LogisticsNetwork;
  engine: ProductionEngine;
  economy: FactoryEconomy;
  saveData: FactorySaveData;
}

export interface SerializeOptions {
  levelId?: string;
  completedMilestones?: string[];
  completedContractIds?: string[];
  unlockedTechIds?: string[];
}

export interface DeserializeOptions {
  machineRegistry?: MachineRegistry;
  recipeRegistry?: RecipeRegistry;
  itemRegistry?: ItemRegistry;
  defaultBeltSpeed?: number;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class FactorySerializer {
  public static readonly CURRENT_VERSION = 1;
  public static readonly DEFAULT_STORAGE_KEY = 'manufacturer_factory_save_v1';

  // -------------------------------------------------------------
  // SERİLEŞTİRME (OBJECT & JSON)
  // -------------------------------------------------------------

  /**
   * Çalışma zamanındaki fabrika bileşenlerini tek bir FactorySaveData nesnesine serileştirir.
   */
  static serialize(
    grid: GridMap,
    logistics: LogisticsNetwork,
    engine: ProductionEngine,
    economy: FactoryEconomy,
    options: SerializeOptions = {},
  ): FactorySaveData {
    // 1. Sabit arazi elemanlarını topla
    const obstacles = grid.getObstacleCells().map((c) => ({
      x: c.coord.x,
      y: c.coord.y,
    }));

    const intakes: IntakeCellData[] = grid.getIntakeCells().map((c) => ({
      coord: { x: c.coord.x, y: c.coord.y },
      itemId: c.intakeData!.itemId,
      intervalSec: c.intakeData!.intervalSec,
      timerSec: c.intakeData!.timerSec,
    }));

    const exports = grid.getExportCells().map((c) => ({
      x: c.coord.x,
      y: c.coord.y,
    }));

    // 2. Dinamik varlıkları serileştir
    const machines = engine.serialize();
    const conveyors = logistics.serialize();
    const economyState = economy.serialize();

    return {
      version: this.CURRENT_VERSION,
      timestamp: Date.now(),
      levelId: options.levelId,
      factoryWidth: grid.width,
      factoryHeight: grid.height,
      obstacles: obstacles.length > 0 ? obstacles : undefined,
      intakes: intakes.length > 0 ? intakes : undefined,
      exports: exports.length > 0 ? exports : undefined,
      machines,
      conveyors,
      economy: economyState,
      money: economyState.money,
      completedMilestones: options.completedMilestones,
      completedContractIds: options.completedContractIds,
      unlockedTechIds: options.unlockedTechIds,
    };
  }

  /**
   * Fabrikayı JSON dizgisine (string) dönüştürür.
   */
  static serializeToJson(
    grid: GridMap,
    logistics: LogisticsNetwork,
    engine: ProductionEngine,
    economy: FactoryEconomy,
    options: SerializeOptions = {},
    pretty = false,
  ): string {
    const data = this.serialize(grid, logistics, engine, economy, options);
    return JSON.stringify(data, null, pretty ? 2 : undefined);
  }

  // -------------------------------------------------------------
  // DOĞRULAMA (VALIDATION)
  // -------------------------------------------------------------

  /**
   * Serileştirilmiş verinin geçerli bir fabrika kayıt formatında olduğunu denetler.
   */
  static validateSaveData(data: unknown): ValidationResult {
    if (!data || typeof data !== 'object') {
      return { valid: false, error: 'Kayıt verisi bir nesne değil' };
    }

    const d = data as Partial<FactorySaveData>;

    if (typeof d.version !== 'number' || d.version <= 0) {
      return { valid: false, error: `Geçersiz kayıt sürümü: ${d.version}` };
    }

    if (d.version > this.CURRENT_VERSION) {
      return {
        valid: false,
        error: `Desteklenmeyen yeni kayıt sürümü: ${d.version} (Mevcut: ${this.CURRENT_VERSION})`,
      };
    }

    if (
      typeof d.factoryWidth !== 'number' ||
      d.factoryWidth <= 0 ||
      typeof d.factoryHeight !== 'number' ||
      d.factoryHeight <= 0
    ) {
      return {
        valid: false,
        error: `Geçersiz ızgara boyutları: ${d.factoryWidth}x${d.factoryHeight}`,
      };
    }

    if (!Array.isArray(d.machines)) {
      return { valid: false, error: 'Makineler dizisi eksik' };
    }

    if (!Array.isArray(d.conveyors)) {
      return { valid: false, error: 'Konveyörler dizisi eksik' };
    }

    if (!d.economy || typeof d.economy !== 'object') {
      return { valid: false, error: 'Ekonomi verisi eksik' };
    }

    return { valid: true };
  }

  // -------------------------------------------------------------
  // GERİ YÜKLEME (DESERIALIZATION)
  // -------------------------------------------------------------

  /**
   * FactorySaveData nesnesinden tam işlevsel bir fabrika örneği (FactoryInstance) oluşturur.
   */
  static deserialize(
    saveData: FactorySaveData,
    options: DeserializeOptions = {},
  ): FactoryInstance {
    const validation = this.validateSaveData(saveData);
    if (!validation.valid) {
      throw new Error(`[FactorySerializer] Kayıt doğrulanamadı: ${validation.error}`);
    }

    const machineRegistry = options.machineRegistry || defaultMachineRegistry;
    const recipeRegistry = options.recipeRegistry || defaultRecipeRegistry;
    const itemRegistry = options.itemRegistry || defaultItemRegistry;

    // 1. Izgara oluştur
    const grid = new GridMap(saveData.factoryWidth, saveData.factoryHeight);

    // Sabit engelleri yerleştir
    if (saveData.obstacles) {
      for (const obs of saveData.obstacles) {
        if (grid.isInBounds(obs.x, obs.y)) {
          grid.setObstacle(obs.x, obs.y);
        }
      }
    }

    // Sabit hammadde giriş silolarını yerleştir
    if (saveData.intakes) {
      for (const intake of saveData.intakes) {
        if (grid.isInBounds(intake.coord.x, intake.coord.y)) {
          grid.setIntake(
            intake.coord.x,
            intake.coord.y,
            intake.itemId,
            intake.intervalSec,
          );
          if (intake.timerSec !== undefined) {
            const cell = grid.getCell(intake.coord.x, intake.coord.y);
            if (cell && cell.intakeData) {
              cell.intakeData.timerSec = intake.timerSec;
            }
          }
        }
      }
    }

    // Sabit ihracat sandıklarını yerleştir
    if (saveData.exports) {
      for (const exp of saveData.exports) {
        if (grid.isInBounds(exp.x, exp.y)) {
          grid.setExport(exp.x, exp.y);
        }
      }
    }

    // 2. Lojistik ağını oluştur ve konveyörleri yükle
    const logistics = new LogisticsNetwork(grid);
    logistics.loadFromSerialized(saveData.conveyors, options.defaultBeltSpeed || 1.0);

    // 3. Üretim motorunu oluştur ve makineleri yükle
    const engine = new ProductionEngine(
      grid,
      logistics,
      recipeRegistry,
      machineRegistry,
    );
    engine.loadFromSerialized(saveData.machines);

    // 4. Ekonomi motorunu oluştur ve durumu yükle
    const economy = new FactoryEconomy(0, itemRegistry);
    economy.loadFromSerialized(saveData.economy);

    // 5. İhracat teslimat dinleyicisini bağla
    logistics.onItemDelivered = (event) => {
      economy.exportItem(event.itemId);
    };

    return {
      grid,
      logistics,
      engine,
      economy,
      saveData,
    };
  }

  /**
   * JSON dizgisinden fabrikayı geri yükler.
   */
  static deserializeFromJson(
    jsonStr: string,
    options: DeserializeOptions = {},
  ): FactoryInstance {
    let parsed: unknown;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (err) {
      throw new Error(`[FactorySerializer] Geçersiz JSON verisi: ${(err as Error).message}`);
    }

    return this.deserialize(parsed as FactorySaveData, options);
  }

  // -------------------------------------------------------------
  // DEPOLAMA ENTEGRASYONU (LOCAL STORAGE)
  // -------------------------------------------------------------

  /**
   * Tarayıcı localStorage'ına (veya verilen depolama adaptörüne) kaydeder.
   */
  static saveToStorage(
    saveData: FactorySaveData,
    storageKey: string = this.DEFAULT_STORAGE_KEY,
    storage?: StorageLike,
  ): boolean {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) {
      console.warn('[FactorySerializer] Uygun depolama alanı bulunamadı.');
      return false;
    }

    try {
      const json = JSON.stringify(saveData);
      store.setItem(storageKey, json);
      return true;
    } catch (err) {
      console.error('[FactorySerializer] Kayıt yazılamadı:', err);
      return false;
    }
  }

  /**
   * Tarayıcı localStorage'ından kaydı okur.
   */
  static loadFromStorage(
    storageKey: string = this.DEFAULT_STORAGE_KEY,
    storage?: StorageLike,
  ): FactorySaveData | null {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) {
      return null;
    }

    try {
      const raw = store.getItem(storageKey);
      if (!raw) return null;

      const parsed: unknown = JSON.parse(raw);
      const validation = this.validateSaveData(parsed);
      if (!validation.valid) {
        console.warn('[FactorySerializer] Kayıt doğrulanamadı:', validation.error);
        return null;
      }

      return parsed as FactorySaveData;
    } catch (err) {
      console.error('[FactorySerializer] Kayıt okunamadı:', err);
      return null;
    }
  }

  /**
   * Kayıtlı bir fabrika verisi var mı?
   */
  static hasSave(
    storageKey: string = this.DEFAULT_STORAGE_KEY,
    storage?: StorageLike,
  ): boolean {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return false;
    return store.getItem(storageKey) !== null;
  }

  /**
   * Kayıtlı veriyi depolamadan siler.
   */
  static clearStorage(
    storageKey: string = this.DEFAULT_STORAGE_KEY,
    storage?: StorageLike,
  ): boolean {
    const store = storage || (typeof localStorage !== 'undefined' ? localStorage : null);
    if (!store) return false;
    store.removeItem(storageKey);
    return true;
  }
}
