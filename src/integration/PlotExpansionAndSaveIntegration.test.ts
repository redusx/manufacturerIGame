/* ======================================================================
 * src/integration/PlotExpansionAndSaveIntegration.test.ts
 *
 * TASK-INT-06: Parsel Genişletme ve Fabrika Kayıt/Yükleme Entegrasyon Testleri
 *
 * Sorumluluklar:
 * 1. PlotExpansionManager sıralı kilit açılımı, delta karo hesaplamaları ve bakiye düşümü
 * 2. Dinamik yerleşim sınırları: Parsel genişledikçe PlacementMath'in yeni alanlara izin vermesi
 * 3. SaveManager v3 & FactorySerializer uçtan uca kayıt ve yükleme bütünlüğü (Round-Trip)
 * 4. Bozuk kayıt (corrupted JSON) durumunda güvenli varsayılan fabrika geri yüklemesi
 * ====================================================================== */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { EconomyManager } from '../economy/EconomyManager.ts';
import { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';
import { GridMap } from '../factory/simulation/GridMap.ts';
import { LogisticsNetwork } from '../factory/simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../factory/simulation/ProductionEngine.ts';
import { MachineEntity } from '../factory/simulation/MachineEntity.ts';
import { defaultMachineRegistry } from '../factory/simulation/MachineRegistry.ts';
import { FactorySerializer } from '../factory/simulation/FactorySerializer.ts';
import { SaveManager, type StorageLike } from '../save/SaveManager.ts';
import { PlotExpansionManager } from '../factory/progression/PlotExpansionManager.ts';
import { PlacementMath } from '../factory/input/PlacementMath.ts';

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

describe('TASK-INT-06: Plot Expansion & Save/Load Integration Tests', () => {
  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    SaveManager.setDefaultStorage(memoryStorage);
  });

  it('1. PlotExpansionManager: Sequential unlock enforcement, delta coords and unified cash deduction', () => {
    const economy = new EconomyManager();
    economy.addResources(100000); // Bol bakiye
    const factoryEconomy = new FactoryEconomy(0, undefined, economy);
    const grid = new GridMap(24, 24);
    const plotManager = new PlotExpansionManager(factoryEconomy, grid);

    // Başlangıç: Sadece Plot 0 (8x8) açık
    assert.strictEqual(plotManager.unlockedPlotCount, 1);
    assert.strictEqual(plotManager.isPlotUnlocked(0), true);
    assert.strictEqual(plotManager.isPlotUnlocked(1), false);
    assert.deepStrictEqual(plotManager.getCurrentBounds(), { width: 8, height: 8 });

    // Kural: Sıradaki parsel açılmadan ileriki parsel (Plot 2) açılamaz
    const skipAttempt = plotManager.unlockPlot(2);
    assert.strictEqual(skipAttempt.success, false);
    assert.strictEqual(skipAttempt.error, 'PREVIOUS_PLOT_REQUIRED');

    // Plot 1 açma ($500)
    const initialCash = economy.resources.toNumber();
    const unlock1 = plotManager.unlockPlot(1);
    assert.strictEqual(unlock1.success, true);
    assert.strictEqual(unlock1.plotIndex, 1);
    assert.strictEqual(unlock1.cost, 500);
    assert.deepStrictEqual(unlock1.oldBounds, { width: 8, height: 8 });
    assert.deepStrictEqual(unlock1.newBounds, { width: 12, height: 8 });
    assert.strictEqual(unlock1.newlyUnlockedCoords.length, 32); // 4x8 yeni karo
    assert.strictEqual(economy.resources.toNumber(), initialCash - 500);

    // Tekrar açmaya çalışıldığında ALREADY_UNLOCKED hatası
    const duplicateAttempt = plotManager.unlockPlot(1);
    assert.strictEqual(duplicateAttempt.success, false);
    assert.strictEqual(duplicateAttempt.error, 'ALREADY_UNLOCKED');

    // Plot 2 açma ($2,500) -> 16x12
    const unlock2 = plotManager.unlockPlot(2);
    assert.strictEqual(unlock2.success, true);
    assert.deepStrictEqual(unlock2.newBounds, { width: 16, height: 12 });
    assert.strictEqual(unlock2.newlyUnlockedCoords.length, 96);

    // Plot 3 ($10,000) ve Plot 4 ($50,000) açma -> 24x24 Mega Fabrika
    const unlock3 = plotManager.unlockPlot(3);
    assert.strictEqual(unlock3.success, true);
    assert.deepStrictEqual(unlock3.newBounds, { width: 20, height: 16 });

    const unlock4 = plotManager.unlockPlot(4);
    assert.strictEqual(unlock4.success, true);
    assert.deepStrictEqual(unlock4.newBounds, { width: 24, height: 24 });
    assert.strictEqual(plotManager.isAllPlotsUnlocked, true);
  });

  it('2. Dynamic Placement Bounds: Expands permitted build area as plots are unlocked', () => {
    const economy = new EconomyManager();
    economy.addResources(5000);
    const factoryEconomy = new FactoryEconomy(0, undefined, economy);
    const grid = new GridMap(24, 24);
    const plotManager = new PlotExpansionManager(factoryEconomy, grid);

    const crusherDef = defaultMachineRegistry.getOrThrow('crusher');

    // 1. Durum: Başlangıç 8x8 parseli
    // (5, 5) 8x8 içinde -> Geçerli
    const validInStarter = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 5, y: 5 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: crusherDef,
      unlockedBounds: factoryEconomy.getCurrentFactoryDimensions(),
    });
    assert.strictEqual(validInStarter.isValid, true);

    // (10, 2) 8x8 dışında -> Kilitli Parsel (LOCKED_PLOT)
    const lockedInStarter = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 10, y: 2 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: crusherDef,
      unlockedBounds: factoryEconomy.getCurrentFactoryDimensions(),
    });
    assert.strictEqual(lockedInStarter.isValid, false);
    assert.strictEqual(lockedInStarter.reason, 'LOCKED_PLOT');

    // 2. Durum: Plot 1 açıldıktan sonra (12x8)
    plotManager.unlockPlot(1);
    assert.deepStrictEqual(factoryEconomy.getCurrentFactoryDimensions(), { width: 12, height: 8 });

    // (10, 2) artık 12x8 içinde -> Geçerli!
    const validInPlot1 = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 10, y: 2 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: crusherDef,
      unlockedBounds: factoryEconomy.getCurrentFactoryDimensions(),
    });
    assert.strictEqual(validInPlot1.isValid, true);

    // (14, 2) hala 12x8 dışında -> Kilitli
    const lockedInPlot1 = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 14, y: 2 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: crusherDef,
      unlockedBounds: factoryEconomy.getCurrentFactoryDimensions(),
    });
    assert.strictEqual(lockedInPlot1.isValid, false);
    assert.strictEqual(lockedInPlot1.reason, 'LOCKED_PLOT');
  });

  it('3. Full Save/Load Round-Trip: Preserves unlocked plots, machines with upgrades, and conveyors', () => {
    const economy = new EconomyManager();
    economy.addResources(25000);
    const factoryEconomy = new FactoryEconomy(0, undefined, economy);
    const grid = new GridMap(24, 24);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const plotManager = new PlotExpansionManager(factoryEconomy, grid);

    // 1. Parselleri genişlet (Plot 0, Plot 1, Plot 2 -> 16x12)
    plotManager.unlockPlot(1);
    plotManager.unlockPlot(2);

    // 2. Sabit Giriş ve Çıkış
    grid.setIntake(1, 0, 'iron_ore', 1.0);
    grid.setExport(14, 10);

    // 3. Konveyörler yerleştir
    logistics.addConveyor({ x: 1, y: 1 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 2 }, 'SOUTH', 1.0);

    // 4. Makine yerleştir ve geliştir (Fırın Seviye 3)
    const smelterDef = defaultMachineRegistry.getOrThrow('smelter');
    const smelter = new MachineEntity('smelter_advanced', smelterDef, { x: 2, y: 2 }, 0);
    smelter.setRecipe('recipe_smelt_iron_ingot');
    engine.addMachine(smelter, 3); // Seviye 3
    assert.strictEqual(engine.getMachineLevel('smelter_advanced'), 3);

    // 5. Kaydet
    const layout = FactorySerializer.serialize(grid, logistics, engine, factoryEconomy);
    SaveManager.save(economy.serialize(), {
      factoryEconomy,
      factoryLayout: layout,
    });

    // 6. Sıfırdan yeni nesneler oluştur ve yükle
    const newGrid = new GridMap(24, 24);
    const newLogistics = new LogisticsNetwork(newGrid);
    const newEngine = new ProductionEngine(newGrid, newLogistics);
    const newEconomy = new EconomyManager();
    const newFactoryEconomy = new FactoryEconomy(0, undefined, newEconomy);

    const { data } = SaveManager.loadUnified();
    newEconomy.deserialize(data.economy);

    assert.ok(data.factoryEconomy);
    newFactoryEconomy.unlockedPlots = new Set(data.factoryEconomy.unlockedPlots);

    assert.ok(data.factoryLayout);
    // Intakes
    if (data.factoryLayout.intakes) {
      for (const intake of data.factoryLayout.intakes) {
        newGrid.setIntake(intake.coord.x, intake.coord.y, intake.itemId, intake.intervalSec);
      }
    }
    // Exports
    if (data.factoryLayout.exports) {
      for (const exp of data.factoryLayout.exports) {
        newGrid.setExport(exp.x, exp.y);
      }
    }
    // Conveyors & Machines
    newLogistics.loadFromSerialized(data.factoryLayout.conveyors);
    newEngine.loadFromSerialized(data.factoryLayout.machines);

    // 7. Doğrulamalar
    assert.deepStrictEqual(Array.from(newFactoryEconomy.unlockedPlots).sort(), [0, 1, 2]);
    assert.deepStrictEqual(newFactoryEconomy.getCurrentFactoryDimensions(), { width: 16, height: 12 });

    const restoredMachine = newEngine.getMachine('smelter_advanced');
    assert.ok(restoredMachine);
    assert.strictEqual(restoredMachine.defId, 'smelter');
    assert.strictEqual(restoredMachine.activeRecipeId, 'recipe_smelt_iron_ingot');
    assert.strictEqual(newEngine.getMachineLevel('smelter_advanced'), 3);
    assert.strictEqual(restoredMachine.coord.x, 2);
    assert.strictEqual(restoredMachine.coord.y, 2);

    assert.ok(newLogistics.getConveyor(1, 1));
    assert.ok(newLogistics.getConveyor(1, 2));
    assert.ok(newGrid.getCell(1, 0)?.intakeData);
    assert.strictEqual(newGrid.getCell(14, 10)?.type, 'EXPORT');
  });

  it('4. Corrupted Save Fallback: Safely recovers to default state on corrupt storage', () => {
    // Depolamaya bozuk/anlamsız JSON yaz
    memoryStorage.setItem('manufacturer_unified_save_v3', '{ invalid_json: true, corrupt ...');

    const result = SaveManager.loadUnified();
    assert.strictEqual(result.wasCorrupted, true);
    assert.ok(result.data);
    assert.strictEqual(result.data.version, 3);
    assert.deepStrictEqual(result.data.factoryEconomy?.unlockedPlots, [0]);
  });
});
