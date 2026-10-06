/* ======================================================================
 * src/factory/view/MachineInspectorHelper.test.ts
 *
 * MachineInspectorHelper saf matematik ve durum yönetim testleri.
 * Node 24 native test koşucusu ile çalışır; Phaser bağımlılığı yoktur.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MachineInspectorHelper } from './MachineInspectorHelper.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { MachineEntity } from '../simulation/MachineEntity.ts';
import { defaultMachineRegistry } from '../simulation/MachineRegistry.ts';
import { defaultRecipeRegistry } from '../simulation/RecipeRegistry.ts';
import { defaultItemRegistry } from '../simulation/ItemRegistry.ts';

describe('MachineInspectorHelper Headless Unit Tests', () => {
  it('getStatusMeta should return accurate labels and palette colors for all states', () => {
    const processing = MachineInspectorHelper.getStatusMeta('PROCESSING');
    assert.strictEqual(processing.label, 'Çalışıyor');
    assert.strictEqual(processing.colorHex, '#2ecc71');

    const waiting = MachineInspectorHelper.getStatusMeta('WAITING_INPUT');
    assert.strictEqual(waiting.label, 'Girdi Bekliyor');
    assert.strictEqual(waiting.colorHex, '#f39c12');

    const blocked = MachineInspectorHelper.getStatusMeta('BLOCKED_OUTPUT');
    assert.strictEqual(blocked.label, 'Çıkış Tıkalı');
    assert.strictEqual(blocked.colorHex, '#e74c3c');

    const idle = MachineInspectorHelper.getStatusMeta('IDLE');
    assert.strictEqual(idle.label, 'Boşta / Bekliyor');
  });

  it('formatMoney, formatSpeed and formatBufferRatio should produce clean pixel UI strings', () => {
    assert.strictEqual(MachineInspectorHelper.formatMoney(45), '$45 ⚙');
    assert.strictEqual(MachineInspectorHelper.formatMoney(12500), '$12.5k ⚙');
    assert.strictEqual(MachineInspectorHelper.formatMoney(2500000), '$2.50M ⚙');

    assert.strictEqual(MachineInspectorHelper.formatSpeed(1), 'x1.00');
    assert.strictEqual(MachineInspectorHelper.formatSpeed(1.2), 'x1.20');

    assert.strictEqual(MachineInspectorHelper.formatBufferRatio(3, 10), '3 / 10');
  });

  it('inspect should extract full machine inspection data correctly', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(100);

    const crusherDef = defaultMachineRegistry.get('crusher')!;
    const machine = new MachineEntity('crusher_1', crusherDef, { x: 2, y: 2 });
    engine.addMachine(machine, 1);

    // Initial inspection
    const data = MachineInspectorHelper.inspect(machine, engine, economy);
    assert.strictEqual(data.instanceId, 'crusher_1');
    assert.strictEqual(data.name, 'Endüstriyel Kırıcı');
    assert.strictEqual(data.level, 1);
    assert.strictEqual(data.speedMultiplier, 1.0);
    assert.strictEqual(data.nextSpeedMultiplier, 1.2);
    assert.strictEqual(data.upgradeCost, Math.round(crusherDef.baseCost * 1.15));
    assert.strictEqual(data.canAffordUpgrade, 100 >= data.upgradeCost);
    assert.strictEqual(data.activeRecipeId, 'recipe_crush_iron_ore');
    assert.strictEqual(data.availableRecipes.length, crusherDef.supportedRecipeIds.length);

    // Verify buffer tracking
    machine.addInput('iron_ore', 3);
    machine.addOutput('iron_powder', 2);

    const dataWithBuffers = MachineInspectorHelper.inspect(machine, engine, economy);
    const inputOre = dataWithBuffers.inputBuffers.find((b) => b.itemId === 'iron_ore');
    assert.ok(inputOre);
    assert.strictEqual(inputOre.count, 3);
    assert.strictEqual(inputOre.capacity, crusherDef.inputBufferCapacity);
    assert.strictEqual(inputOre.percentage, 3 / crusherDef.inputBufferCapacity);

    const outputDust = dataWithBuffers.outputBuffers.find((b) => b.itemId === 'iron_powder');
    assert.ok(outputDust);
    assert.strictEqual(outputDust.count, 2);
    assert.strictEqual(outputDust.capacity, crusherDef.outputBufferCapacity);

    // Gösterilen iade, sökümün gerçekten ödediği tutarla aynıdır: yalnızca makine yatırımı.
    // Tampondaki eşyalar ödenmez (DemolishMath.executeDemolish de onları ödemez).
    const expectedRefund = crusherDef.baseCost;
    assert.strictEqual(dataWithBuffers.demolishRefund, expectedRefund);
  });

  it('performUpgrade should enforce balance check and upgrade machine stats', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(10); // Not enough for crusher upgrade (baseCost 100 -> upgrade 115)

    const crusherDef = defaultMachineRegistry.get('crusher')!;
    const machine = new MachineEntity('crusher_test', crusherDef, { x: 1, y: 1 });
    engine.addMachine(machine, 1);

    // Fail upgrade due to lack of funds
    const failResult = MachineInspectorHelper.performUpgrade(machine, engine, economy);
    assert.strictEqual(failResult.success, false);
    assert.strictEqual(failResult.newLevel, 1);
    assert.strictEqual(failResult.error, 'Yetersiz Bakiye');
    assert.strictEqual(engine.getMachineLevel('crusher_test'), 1);

    // Add funds and succeed
    economy.addMoney(500, 'EXPORT');
    const balanceBefore = economy.money;
    const expectedCost = economy.getMachineUpgradeCost(crusherDef.baseCost, 1);

    const successResult = MachineInspectorHelper.performUpgrade(machine, engine, economy);
    assert.strictEqual(successResult.success, true);
    assert.strictEqual(successResult.newLevel, 2);
    assert.strictEqual(successResult.cost, expectedCost);
    assert.strictEqual(successResult.newSpeedMultiplier, 1.2);
    assert.strictEqual(engine.getMachineLevel('crusher_test'), 2);
    assert.strictEqual(economy.money, balanceBefore - expectedCost);
  });

  it('selectRecipe should switch supported recipes and reject unsupported ones', () => {
    const smelterDef = defaultMachineRegistry.get('smelter')!;
    const machine = new MachineEntity('smelter_1', smelterDef, { x: 3, y: 3 });

    // Initial recipe
    assert.strictEqual(machine.activeRecipeId, 'recipe_smelt_iron_ingot');

    // Switch to copper smelting
    const res1 = MachineInspectorHelper.selectRecipe(machine, 'recipe_smelt_copper_ingot');
    assert.strictEqual(res1.success, true);
    assert.strictEqual(machine.activeRecipeId, 'recipe_smelt_copper_ingot');

    // Try unsupported recipe (e.g. crushing recipe)
    const res2 = MachineInspectorHelper.selectRecipe(machine, 'recipe_crush_copper_ore');
    assert.strictEqual(res2.success, false);
    assert.strictEqual(machine.activeRecipeId, 'recipe_smelt_copper_ingot'); // Unchanged
  });
});
