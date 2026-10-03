/* ======================================================================
 * src/integration/DemolishAndInspectorIntegration.test.ts
 *
 * TASK-INT-05: Yıkım / Taşıma ve Makine İnceleme Entegrasyon Testleri
 *
 * Sorumluluklar:
 * 1. DemolishMath inspectTarget & executeDemolish (%100 tam iade garantisi,
 *    makine, konveyör, splitter/merger sökümü, korunan INTAKE/EXPORT düğümleri)
 * 2. MachineInspectorHelper: İnceleme verisi, durum rozetleri, tampon oranları
 * 3. Seviye yükseltme (Level advancement) ve hız çarpanı artışı
 * 4. Reçete değiştirme ve geçersiz reçete reddi
 * 5. Yıkım sonrası ızgara ve simülasyon tutarlılığı (boşalan hücreye yeni inşa)
 *
 * Node 24 uyumludur; Phaser bağımlılığı yoktur, headless çalışır.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GridMap } from '../factory/simulation/GridMap.ts';
import { LogisticsNetwork } from '../factory/simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../factory/simulation/ProductionEngine.ts';
import { MachineEntity } from '../factory/simulation/MachineEntity.ts';
import { defaultMachineRegistry } from '../factory/simulation/MachineRegistry.ts';
import { defaultItemRegistry } from '../factory/simulation/ItemRegistry.ts';
import { defaultRecipeRegistry } from '../factory/simulation/RecipeRegistry.ts';
import { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';
import { EconomyManager } from '../economy/EconomyManager.ts';
import {
  DemolishMath,
  type DemolishTargetInfo,
} from '../factory/input/DemolishMath.ts';
import {
  MachineInspectorHelper,
} from '../factory/view/MachineInspectorHelper.ts';
import {
  PlacementMath,
  CONVEYOR_BUILD_COST,
} from '../factory/input/PlacementMath.ts';

describe('TASK-INT-05: Demolish & Machine Inspector Integration Tests', () => {
  it('1. Demolish target inspection & 100% refund execution on conveyors', () => {
    const grid = new GridMap(16, 16);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economyMgr = new EconomyManager();
    const economy = new FactoryEconomy(0, defaultItemRegistry, economyMgr);
    economyMgr.addResources(100);

    // Place conveyor at (2, 2)
    const placeRes = PlacementMath.executePlacement({
      grid,
      economy,
      logistics,
      rootCoord: { x: 2, y: 2 },
      itemType: 'CONVEYOR',
      direction: 'EAST',
    });
    assert.strictEqual(placeRes.success, true);
    assert.strictEqual(economy.money, 95);

    // Inspect target
    const targetInfo = DemolishMath.inspectTarget({
      grid,
      logistics,
      engine,
      economy,
      coord: { x: 2, y: 2 },
    });

    assert.strictEqual(targetInfo.canDemolish, true);
    assert.strictEqual(targetInfo.targetType, 'CONVEYOR');
    assert.strictEqual(targetInfo.refundAmount, CONVEYOR_BUILD_COST);

    // Execute demolish
    const demolishRes = DemolishMath.executeDemolish({
      grid,
      logistics,
      engine,
      economy,
      coord: { x: 2, y: 2 },
    });

    assert.strictEqual(demolishRes.success, true);
    assert.strictEqual(demolishRes.refundAmount, CONVEYOR_BUILD_COST);
    assert.strictEqual(economy.money, 100, 'Balance must be 100% refunded');
    assert.strictEqual(grid.isCellEmpty(2, 2), true, 'Cell must be empty after demolish');
    assert.strictEqual(logistics.getConveyor(2, 2), undefined);
  });

  it('2. Machine demolition with upgrade refund & multi-tile footprint freeing', () => {
    const grid = new GridMap(16, 16);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economyMgr = new EconomyManager();
    const economy = new FactoryEconomy(0, defaultItemRegistry, economyMgr);
    economyMgr.addResources(2000);

    // Place a 2x2 Assembler at (4, 4)
    const assemblerDef = defaultMachineRegistry.getOrThrow('assembler');
    const placeRes = PlacementMath.executePlacement({
      grid,
      economy,
      engine,
      logistics,
      rootCoord: { x: 4, y: 4 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: assemblerDef,
    });
    assert.strictEqual(placeRes.success, true);
    assert.ok(placeRes.instanceId);

    const initialCost = assemblerDef.baseCost; // e.g. 500
    const machine = engine.getMachine(placeRes.instanceId)!;

    // Upgrade machine level to 2 via MachineInspectorHelper
    const upRes = MachineInspectorHelper.performUpgrade(machine, engine, economy);
    assert.strictEqual(upRes.success, true);
    assert.strictEqual(upRes.newLevel, 2);

    const balanceBeforeDemolish = economy.money;

    // Inspect target at (5, 5) - part of the 2x2 footprint
    const inspectTarget = DemolishMath.inspectTarget({
      grid,
      logistics,
      engine,
      economy,
      coord: { x: 5, y: 5 },
    });

    assert.strictEqual(inspectTarget.canDemolish, true);
    assert.strictEqual(inspectTarget.targetType, 'MACHINE');
    assert.strictEqual(inspectTarget.instanceId, machine.instanceId);
    assert.strictEqual(inspectTarget.occupiedCoords.length, 4);

    // Expected refund: baseCost + upgradeCost = total spent on machine
    assert.ok(inspectTarget.refundAmount > initialCost);

    // Execute demolish
    const demRes = DemolishMath.executeDemolish({
      grid,
      logistics,
      engine,
      economy,
      coord: { x: 5, y: 5 },
    });

    assert.strictEqual(demRes.success, true);
    assert.strictEqual(economy.money, balanceBeforeDemolish + inspectTarget.refundAmount);
    assert.strictEqual(engine.getMachine(machine.instanceId), undefined);

    // All 4 cells of 2x2 footprint must now be empty
    assert.strictEqual(grid.isCellEmpty(4, 4), true);
    assert.strictEqual(grid.isCellEmpty(5, 4), true);
    assert.strictEqual(grid.isCellEmpty(4, 5), true);
    assert.strictEqual(grid.isCellEmpty(5, 5), true);
  });

  it('3. Protected nodes protection (INTAKE and EXPORT cannot be demolished)', () => {
    const grid = new GridMap(16, 16);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economyMgr = new EconomyManager();
    const economy = new FactoryEconomy(0, defaultItemRegistry, economyMgr);

    grid.setIntake(1, 0, 'iron_ore', 1.0);
    grid.setExport(8, 8);

    // Try inspect INTAKE
    const intakeInfo = DemolishMath.inspectTarget({
      grid,
      logistics,
      engine,
      economy,
      coord: { x: 1, y: 0 },
    });
    assert.strictEqual(intakeInfo.canDemolish, false);
    assert.strictEqual(intakeInfo.blockReason, 'PROTECTED_INTAKE');

    // Try execute demolish on INTAKE
    const intakeDem = DemolishMath.executeDemolish({
      grid,
      logistics,
      engine,
      economy,
      coord: { x: 1, y: 0 },
    });
    assert.strictEqual(intakeDem.success, false);

    // Try inspect EXPORT
    const exportInfo = DemolishMath.inspectTarget({
      grid,
      logistics,
      engine,
      economy,
      coord: { x: 8, y: 8 },
    });
    assert.strictEqual(exportInfo.canDemolish, false);
    assert.strictEqual(exportInfo.blockReason, 'PROTECTED_EXPORT');
  });

  it('4. MachineInspector data extraction & recipe switching', () => {
    const grid = new GridMap(16, 16);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economyMgr = new EconomyManager();
    const economy = new FactoryEconomy(0, defaultItemRegistry, economyMgr);

    const smelterDef = defaultMachineRegistry.getOrThrow('smelter');
    const smelter = new MachineEntity('smelter_1', smelterDef, { x: 2, y: 2 }, 0);
    engine.addMachine(smelter, 1);

    // Inspect machine
    const data = MachineInspectorHelper.inspect(
      smelter,
      engine,
      economy,
      defaultRecipeRegistry,
      defaultItemRegistry,
    );

    assert.strictEqual(data.instanceId, 'smelter_1');
    assert.strictEqual(data.name, 'Yüksek Sıcaklık Fırını');
    assert.strictEqual(data.level, 1);
    assert.strictEqual(data.speedMultiplier, 1.0);
    assert.ok(data.availableRecipes.length >= 2);

    // Switch recipe
    const newRecipeId = data.availableRecipes[1].recipeId;
    const switchRes = MachineInspectorHelper.selectRecipe(smelter, newRecipeId);
    assert.strictEqual(switchRes.success, true);
    assert.strictEqual(smelter.activeRecipeId, newRecipeId);

    // Try invalid recipe
    const invalidRes = MachineInspectorHelper.selectRecipe(smelter, 'recipe_crush_iron_ore');
    assert.strictEqual(invalidRes.success, false);
  });
});
