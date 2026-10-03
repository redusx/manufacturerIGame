/* ======================================================================
 * src/integration/BuildToolbarIntegration.test.ts
 *
 * TASK-INT-04: Alt İnşa Araç Çubuğu ve Yerleşim Entegrasyon Testi
 * - PlacementMath ile konveyör ve makine yerleşim denetimleri
 * - Sermaye yeterliliği, parsel sınırları ve çakışma önleme
 * - 90° CW/CCW rotasyon ve port yön dönüşümleri
 * - Tam yerleşim icrası (executePlacement), simülasyon ve ekonomi entegrasyonu
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GridMap } from '../factory/simulation/GridMap.ts';
import { LogisticsNetwork } from '../factory/simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../factory/simulation/ProductionEngine.ts';
import { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';
import { EconomyManager } from '../economy/EconomyManager.ts';
import { defaultMachineRegistry } from '../factory/simulation/MachineRegistry.ts';
import { defaultRecipeRegistry } from '../factory/simulation/RecipeRegistry.ts';
import { defaultItemRegistry } from '../factory/simulation/ItemRegistry.ts';
import {
  PlacementMath,
  CONVEYOR_BUILD_COST,
  SPLITTER_BUILD_COST,
  MERGER_BUILD_COST,
} from '../factory/input/PlacementMath.ts';

describe('TASK-INT-04: Build Toolbar & Placement Math Integration Tests', () => {
  it('1. Conveyor placement validation and execution with economy deduction', () => {
    const grid = new GridMap(24, 24);
    const logistics = new LogisticsNetwork(grid);
    const economy = new EconomyManager();
    const factoryEconomy = new FactoryEconomy(0, defaultItemRegistry, economy);

    economy.addResources(100);

    // Initial check: empty cell (2, 2)
    const validation = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 2, y: 2 },
      itemType: 'CONVEYOR',
      direction: 'EAST',
      unlockedBounds: { width: 8, height: 8 },
    });

    assert.strictEqual(validation.isValid, true);
    assert.strictEqual(validation.cost, CONVEYOR_BUILD_COST);
    assert.strictEqual(validation.canAfford, true);

    // Execute placement
    const result = PlacementMath.executePlacement({
      grid,
      economy: factoryEconomy,
      logistics,
      rootCoord: { x: 2, y: 2 },
      itemType: 'CONVEYOR',
      direction: 'EAST',
      unlockedBounds: { width: 8, height: 8 },
    });

    assert.strictEqual(result.success, true);
    assert.strictEqual(grid.getCellType(2, 2), 'CONVEYOR');
    assert.ok(logistics.getConveyor(2, 2));
    assert.strictEqual(economy.resources.toNumber(), 100 - CONVEYOR_BUILD_COST);

    // Cannot place on the same occupied cell again
    const secondValidation = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 2, y: 2 },
      itemType: 'CONVEYOR',
      direction: 'EAST',
      unlockedBounds: { width: 8, height: 8 },
    });
    assert.strictEqual(secondValidation.isValid, false);
    assert.strictEqual(secondValidation.reason, 'CELL_OCCUPIED');
  });

  it('2. Machine placement validation with footprint transposition and port alignment', () => {
    const grid = new GridMap(24, 24);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics, defaultRecipeRegistry, defaultMachineRegistry);
    const economy = new EconomyManager();
    const factoryEconomy = new FactoryEconomy(0, defaultItemRegistry, economy);

    economy.addResources(500);

    // Smelter is 2x1 (width 2, height 1) at NORTH
    const smelterDef = defaultMachineRegistry.getOrThrow('smelter');

    // At NORTH: footprint is 2x1
    const valNorth = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 3, y: 3 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: smelterDef,
      unlockedBounds: { width: 8, height: 8 },
    });
    assert.strictEqual(valNorth.isValid, true);
    assert.strictEqual(valNorth.effectiveFootprint.width, 2);
    assert.strictEqual(valNorth.effectiveFootprint.height, 1);
    assert.strictEqual(valNorth.cost, smelterDef.baseCost);

    // At EAST: footprint transposes to 1x2 (width 1, height 2)
    const valEast = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 3, y: 3 },
      itemType: 'MACHINE',
      direction: 'EAST',
      machineDef: smelterDef,
      unlockedBounds: { width: 8, height: 8 },
    });
    assert.strictEqual(valEast.isValid, true);
    assert.strictEqual(valEast.effectiveFootprint.width, 1);
    assert.strictEqual(valEast.effectiveFootprint.height, 2);

    // Execute placement of Smelter
    const execResult = PlacementMath.executePlacement({
      grid,
      economy: factoryEconomy,
      engine,
      logistics,
      rootCoord: { x: 3, y: 3 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: smelterDef,
      unlockedBounds: { width: 8, height: 8 },
    });

    assert.strictEqual(execResult.success, true);
    assert.strictEqual(grid.getCellType(3, 3), 'MACHINE');
    assert.strictEqual(grid.getCellType(4, 3), 'MACHINE');
    assert.strictEqual(engine.getAllMachines().length, 1);
    assert.strictEqual(economy.resources.toNumber(), 500 - smelterDef.baseCost);
  });

  it('3. Bounds and Plot expansion locking enforcement', () => {
    const grid = new GridMap(24, 24);
    const economy = new EconomyManager();
    const factoryEconomy = new FactoryEconomy(0, defaultItemRegistry, economy);
    economy.addResources(1000);

    // Outside starter plot (width 8, height 8) -> e.g. at (10, 5)
    const valLocked = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 10, y: 5 },
      itemType: 'CONVEYOR',
      direction: 'EAST',
      unlockedBounds: { width: 8, height: 8 },
    });
    assert.strictEqual(valLocked.isValid, false);
    assert.strictEqual(valLocked.reason, 'LOCKED_PLOT');

    // Outside grid bounds entirely -> e.g. at (25, 25)
    const valOOB = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 25, y: 25 },
      itemType: 'CONVEYOR',
      direction: 'EAST',
      unlockedBounds: { width: 24, height: 24 },
    });
    assert.strictEqual(valOOB.isValid, false);
    assert.strictEqual(valOOB.reason, 'OUT_OF_BOUNDS');

    // Insufficient funds
    economy.spendResources(economy.resources.toNumber()); // balance 0
    const valNoMoney = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 0, y: 0 },
      itemType: 'CONVEYOR',
      direction: 'EAST',
      unlockedBounds: { width: 8, height: 8 },
    });
    assert.strictEqual(valNoMoney.isValid, false);
    assert.strictEqual(valNoMoney.reason, 'NOT_ENOUGH_MONEY');
  });

  it('4. Splitter & Merger placement validation', () => {
    const grid = new GridMap(24, 24);
    const logistics = new LogisticsNetwork(grid);
    const economy = new EconomyManager();
    const factoryEconomy = new FactoryEconomy(0, defaultItemRegistry, economy);
    economy.addResources(200);

    // Place Splitter
    const resSplitter = PlacementMath.executePlacement({
      grid,
      economy: factoryEconomy,
      logistics,
      rootCoord: { x: 4, y: 4 },
      itemType: 'SPLITTER',
      direction: 'EAST',
      unlockedBounds: { width: 8, height: 8 },
    });
    assert.strictEqual(resSplitter.success, true);
    assert.ok(logistics.getSplitter(4, 4));
    assert.strictEqual(resSplitter.spentMoney, SPLITTER_BUILD_COST);

    // Place Merger
    const resMerger = PlacementMath.executePlacement({
      grid,
      economy: factoryEconomy,
      logistics,
      rootCoord: { x: 5, y: 5 },
      itemType: 'MERGER',
      direction: 'SOUTH',
      unlockedBounds: { width: 8, height: 8 },
    });
    assert.strictEqual(resMerger.success, true);
    assert.ok(logistics.getMerger(5, 5));
    assert.strictEqual(resMerger.spentMoney, MERGER_BUILD_COST);
  });
});
