/* ======================================================================
 * src/integration/ConveyorFlowIntegration.test.ts
 *
 * TASK-INT-03: 2D Konveyör ve Eşya Akışı Entegrasyon Testi
 * - LogisticsNetwork ve ProductionEngine tam simülasyon adımları (Tick)
 * - INTAKE -> Konveyör -> Kırıcı Makine -> Virajlı Konveyör -> EXPORT tam hat testi
 * - ItemFlowTracker dünya koordinatları ve 90° viraj enterpolasyonu
 * - FactorySerializer ile konveyör ve makine yerleşiminin kalıcılığı
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GridMap } from '../factory/simulation/GridMap.ts';
import { LogisticsNetwork, type DeliveredItemEvent } from '../factory/simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../factory/simulation/ProductionEngine.ts';
import { MachineEntity } from '../factory/simulation/MachineEntity.ts';
import { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';
import { EconomyManager } from '../economy/EconomyManager.ts';
import { defaultMachineRegistry } from '../factory/simulation/MachineRegistry.ts';
import { defaultRecipeRegistry } from '../factory/simulation/RecipeRegistry.ts';
import { defaultItemRegistry } from '../factory/simulation/ItemRegistry.ts';
import { ItemFlowTracker } from '../factory/view/ItemFlowTracker.ts';
import { ConveyorGeometry } from '../factory/view/ConveyorGeometry.ts';
import { FactorySerializer } from '../factory/simulation/FactorySerializer.ts';
import { SaveManager, type StorageLike } from '../save/SaveManager.ts';

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
}

describe('TASK-INT-03: 2D Conveyor & Item Flow Integration Tests', () => {
  it('1. LogisticsNetwork & ProductionEngine full pipeline: INTAKE -> Belt -> Crusher -> Corner Belt -> EXPORT', () => {
    const grid = new GridMap(24, 24);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics, defaultRecipeRegistry, defaultMachineRegistry);
    const economy = new EconomyManager();
    const factoryEconomy = new FactoryEconomy(0, defaultItemRegistry, economy);

    // 1. INTAKE at (1, 0) emitting iron_ore every 1.0s
    grid.setIntake(1, 0, 'iron_ore', 1.0);

    // 2. Belts leading into Crusher: (1, 1) and (1, 2)
    logistics.addConveyor({ x: 1, y: 1 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 2 }, 'SOUTH', 1.0);

    // 3. Crusher machine at (1, 3) (recipe: recipe_crush_iron_ore, takes iron_ore, outputs iron_powder)
    const crusherDef = defaultMachineRegistry.getOrThrow('crusher');
    const crusher = new MachineEntity('test_crusher', crusherDef, { x: 1, y: 3 }, 0);
    crusher.setRecipe('recipe_crush_iron_ore');
    engine.addMachine(crusher);

    // 4. Belts leading away from Crusher to corner: (1, 4), (1, 5), (1, 6)
    logistics.addConveyor({ x: 1, y: 4 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 5 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 6 }, 'SOUTH', 1.0);

    // 5. 90° Turn at (1, 7) EAST
    logistics.addConveyor({ x: 1, y: 7 }, 'EAST', 1.0);

    // 6. Belts leading to EXPORT: (2, 7), (3, 7), (4, 7), (5, 7)
    logistics.addConveyor({ x: 2, y: 7 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 3, y: 7 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 4, y: 7 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 5, y: 7 }, 'EAST', 1.0);

    // 7. EXPORT terminal at (6, 7)
    grid.setExport(6, 7);

    const deliveredItems: DeliveredItemEvent[] = [];
    logistics.onItemDelivered = (event) => {
      deliveredItems.push(event);
      factoryEconomy.exportItem(event.itemId);
    };

    // Simulate for 20 seconds at dt = 0.5s (40 steps)
    const dt = 0.5;
    for (let t = 0; t < 40; t++) {
      logistics.tick(dt);
      engine.tick(dt);
      factoryEconomy.tick(dt);
    }

    // Ore must have been processed by Crusher and delivered as iron_powder
    assert.ok(deliveredItems.length > 0, 'At least one item should have been exported');
    assert.strictEqual(deliveredItems[0].itemId, 'iron_powder', 'Item delivered should be iron_powder');
    assert.strictEqual(deliveredItems[0].exportCoord.x, 6);
    assert.strictEqual(deliveredItems[0].exportCoord.y, 7);

    // Economy must have earned money from export
    assert.ok(economy.resources.toNumber() > 0, 'Economy cash must have increased from export');
  });

  it('2. ItemFlowTracker: Smooth coordinate interpolation and 90° corner geometry', () => {
    const grid = new GridMap(24, 24);
    const logistics = new LogisticsNetwork(grid);

    // Corner layout: (1, 6) SOUTH -> (1, 7) EAST -> (2, 7) EAST
    const b1 = logistics.addConveyor({ x: 1, y: 6 }, 'SOUTH', 1.0);
    const b2 = logistics.addConveyor({ x: 1, y: 7 }, 'EAST', 1.0);
    const b3 = logistics.addConveyor({ x: 2, y: 7 }, 'EAST', 1.0);

    // Add item on corner belt at progress 0.5
    b2.acceptItem('iron_powder', 0.5);

    // Determine corner geometry
    const inDirs = ConveyorGeometry.getIncomingDirections(b2.coord, [
      { coord: b1.coord, direction: b1.direction },
      { coord: b2.coord, direction: b2.direction },
      { coord: b3.coord, direction: b3.direction },
    ]);
    const turnInfo = ConveyorGeometry.determineTileInfo(b2.coord, b2.direction, inDirs);
    assert.strictEqual(turnInfo.shape, 'CORNER_LEFT', 'Should detect 90° left corner from SOUTH to EAST');

    // Collect renderable items
    const items = ItemFlowTracker.collectRenderableItems(logistics, 32, 0, 0);
    assert.strictEqual(items.length, 1);
    assert.strictEqual(items[0].itemId, 'iron_powder');
    assert.strictEqual(items[0].coord.x, 1);
    assert.strictEqual(items[0].coord.y, 7);

    // Pixel position should be inside cell (1, 7) -> world bounds [32..64, 224..256]
    assert.ok(items[0].worldX >= 32 && items[0].worldX <= 64);
    assert.ok(items[0].worldY >= 224 && items[0].worldY <= 256);
  });

  it('3. FactorySerializer: Complete layout serialization and state preservation', () => {
    const grid = new GridMap(24, 24);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics, defaultRecipeRegistry, defaultMachineRegistry);
    const economy = new FactoryEconomy(0, defaultItemRegistry);

    grid.setIntake(1, 0, 'iron_ore', 1.0);
    grid.setExport(6, 7);

    const crusherDef = defaultMachineRegistry.getOrThrow('crusher');
    const crusher = new MachineEntity('c1', crusherDef, { x: 1, y: 3 }, 0);
    crusher.setRecipe('recipe_crush_iron_ore');
    crusher.addInput('iron_ore');
    engine.addMachine(crusher);

    logistics.addConveyor({ x: 1, y: 1 }, 'SOUTH', 1.0);
    const b2 = logistics.addConveyor({ x: 1, y: 2 }, 'SOUTH', 1.0);
    b2.acceptItem('iron_ore', 0.8);

    // Serialize
    const saveData = FactorySerializer.serialize(grid, logistics, engine, economy);
    assert.strictEqual(saveData.conveyors.length, 2);
    assert.strictEqual(saveData.machines.length, 1);
    assert.strictEqual(saveData.machines[0].instanceId, 'c1');
    assert.strictEqual(saveData.machines[0].activeRecipeId, 'recipe_crush_iron_ore');

    // Create fresh instance and restore
    const freshGrid = new GridMap(24, 24);
    const freshLogistics = new LogisticsNetwork(freshGrid);
    const freshEngine = new ProductionEngine(freshGrid, freshLogistics, defaultRecipeRegistry, defaultMachineRegistry);

    freshLogistics.loadFromSerialized(saveData.conveyors);
    freshEngine.loadFromSerialized(saveData.machines);

    assert.strictEqual(freshLogistics.conveyorCount, 2);
    assert.strictEqual(freshEngine.getAllMachines().length, 1);
    const restoredMachine = freshEngine.getMachine('c1');
    assert.ok(restoredMachine);
    assert.strictEqual(restoredMachine.activeRecipeId, 'recipe_crush_iron_ore');
    assert.strictEqual(restoredMachine.getInputCount('iron_ore'), 1);
  });

  it('4. SaveManager v3 factoryLayout round-trip integration', () => {
    const memoryStore = new MemoryStorage();
    SaveManager.setDefaultStorage(memoryStore);

    const grid = new GridMap(24, 24);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics, defaultRecipeRegistry, defaultMachineRegistry);
    const economy = new EconomyManager();
    const factoryEconomy = new FactoryEconomy(0, defaultItemRegistry, economy);

    grid.setIntake(1, 0, 'iron_ore', 1.0);
    grid.setExport(6, 7);
    logistics.addConveyor({ x: 1, y: 1 }, 'SOUTH', 1.0);

    const layout = FactorySerializer.serialize(grid, logistics, engine, factoryEconomy);

    SaveManager.save(economy.serialize(), {
      factoryEconomy,
      factoryLayout: layout,
    });

    const { data } = SaveManager.loadUnified();
    assert.ok(data.factoryLayout);
    assert.strictEqual(data.factoryLayout.conveyors.length, 1);
    assert.strictEqual(data.factoryLayout.conveyors[0].coord.x, 1);
    assert.strictEqual(data.factoryLayout.conveyors[0].coord.y, 1);

    SaveManager.setDefaultStorage(null);
  });
});
