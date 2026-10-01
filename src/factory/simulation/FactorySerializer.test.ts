/* ======================================================================
 * src/factory/simulation/FactorySerializer.test.ts — Fabrika Kayıt ve Yükleme Testleri
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GridMap } from './GridMap.ts';
import { LogisticsNetwork } from './LogisticsNetwork.ts';
import { ProductionEngine } from './ProductionEngine.ts';
import { FactoryEconomy } from './FactoryEconomy.ts';
import { MachineEntity } from './MachineEntity.ts';
import { defaultMachineRegistry } from './MachineRegistry.ts';
import { defaultRecipeRegistry } from './RecipeRegistry.ts';
import { defaultItemRegistry } from './ItemRegistry.ts';
import {
  FactorySerializer,
  type StorageLike,
} from './FactorySerializer.ts';

describe('FactorySerializer Complete State Conservation', () => {
  it('Should serialize and deserialize a minimal factory with 100% fidelity', () => {
    const grid = new GridMap(8, 8);
    grid.setObstacle(2, 2);
    grid.setIntake(0, 3, 'iron_ore', 1.5);
    grid.setExport(7, 3);

    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(250);

    const saveData = FactorySerializer.serialize(grid, logistics, engine, economy, {
      levelId: 'chapter_1',
      completedMilestones: ['m_first_steps'],
    });

    assert.equal(saveData.version, 1);
    assert.equal(saveData.factoryWidth, 8);
    assert.equal(saveData.factoryHeight, 8);
    assert.equal(saveData.levelId, 'chapter_1');
    assert.equal(saveData.money, 250);
    assert.equal(saveData.obstacles?.length, 1);
    assert.deepEqual(saveData.obstacles?.[0], { x: 2, y: 2 });
    assert.equal(saveData.intakes?.length, 1);
    assert.equal(saveData.intakes?.[0].itemId, 'iron_ore');
    assert.equal(saveData.intakes?.[0].intervalSec, 1.5);
    assert.equal(saveData.exports?.length, 1);
    assert.deepEqual(saveData.exports?.[0], { x: 7, y: 3 });

    // Deserializasyon
    const restored = FactorySerializer.deserialize(saveData);

    assert.equal(restored.grid.width, 8);
    assert.equal(restored.grid.height, 8);
    assert.equal(restored.grid.getCellType(2, 2), 'OBSTACLE');
    assert.equal(restored.grid.getCellType(0, 3), 'INTAKE');
    assert.equal(restored.grid.getCell(0, 3)?.intakeData?.itemId, 'iron_ore');
    assert.equal(restored.grid.getCell(0, 3)?.intakeData?.intervalSec, 1.5);
    assert.equal(restored.grid.getCellType(7, 3), 'EXPORT');
    assert.equal(restored.economy.money, 250);
    assert.equal(restored.saveData.levelId, 'chapter_1');
  });

  it('Should serialize and restore active machines, levels, timers, and internal buffers', () => {
    const grid = new GridMap(10, 6);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(1000);

    // Kırıcı makine ekle
    const crusherDef = defaultMachineRegistry.getOrThrow('crusher');
    const crusher = new MachineEntity('crusher_1', crusherDef, { x: 2, y: 2 }, 0, 'recipe_crush_iron_ore');
    crusher.addInput('iron_ore', 4);
    crusher.addOutput('iron_powder', 3);
    crusher.status = 'PROCESSING';
    crusher.progressSec = 0.65;

    engine.addMachine(crusher, 3); // Seviye 3 makine
    assert.equal(engine.getMachineLevel('crusher_1'), 3);

    // Dökümcü makine ekle
    const smelterDef = defaultMachineRegistry.getOrThrow('smelter');
    const smelter = new MachineEntity('smelter_1', smelterDef, { x: 5, y: 2 }, 0, 'recipe_smelt_iron_ingot');
    smelter.addInput('iron_powder', 2);
    smelter.status = 'WAITING_INPUT';

    engine.addMachine(smelter, 1);

    // Serileştir ve JSON'a çevir
    const jsonStr = FactorySerializer.serializeToJson(grid, logistics, engine, economy, {}, true);
    assert.ok(jsonStr.includes('"crusher_1"'));
    assert.ok(jsonStr.includes('"level": 3'));

    // JSON'dan geri yükle
    const restored = FactorySerializer.deserializeFromJson(jsonStr);

    assert.equal(restored.engine.machineCount, 2);

    const restoredCrusher = restored.engine.getMachine('crusher_1');
    assert.ok(restoredCrusher);
    assert.equal(restoredCrusher.coord.x, 2);
    assert.equal(restoredCrusher.coord.y, 2);
    assert.equal(restoredCrusher.status, 'PROCESSING');
    assert.equal(restoredCrusher.progressSec, 0.65);
    assert.equal(restoredCrusher.getInputCount('iron_ore'), 4);
    assert.equal(restoredCrusher.getOutputCount('iron_powder'), 3);
    assert.equal(restored.engine.getMachineLevel('crusher_1'), 3);
    assert.equal(restored.engine.getSpeedMultiplier('crusher_1'), 1.4); // 1.0 + (3-1)*0.2 = 1.4x

    const restoredSmelter = restored.engine.getMachine('smelter_1');
    assert.ok(restoredSmelter);
    assert.equal(restoredSmelter.status, 'WAITING_INPUT');
    assert.equal(restoredSmelter.getInputCount('iron_powder'), 2);
    assert.equal(restored.engine.getMachineLevel('smelter_1'), 1);
  });

  it('Should preserve conveyors with moving items and exact progress positions', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(500);

    const belt1 = logistics.addConveyor({ x: 1, y: 1 }, 'EAST', 1.0);
    belt1.acceptItem('gear', 0.0);
    belt1.tick(0.6); // İlk eşya 0.6'ya ilerler
    belt1.acceptItem('iron_plate', 0.0); // İkinci eşya kabul edilir

    const belt2 = logistics.addConveyor({ x: 2, y: 1 }, 'SOUTH', 1.0);
    belt2.acceptItem('wire', 0.0);
    belt2.tick(0.45);


    const saveData = FactorySerializer.serialize(grid, logistics, engine, economy);
    assert.equal(saveData.conveyors.length, 2);

    const restored = FactorySerializer.deserialize(saveData);
    assert.equal(restored.logistics.conveyorCount, 2);

    const restoredBelt1 = restored.logistics.getConveyor(1, 1);
    assert.ok(restoredBelt1);
    assert.equal(restoredBelt1.direction, 'EAST');
    assert.equal(restoredBelt1.itemCount, 2);

    const items1 = restoredBelt1.getItems();
    assert.ok(items1.some((it) => it.itemId === 'gear'));
    assert.ok(items1.some((it) => it.itemId === 'iron_plate'));

    const restoredBelt2 = restored.logistics.getConveyor(2, 1);
    assert.ok(restoredBelt2);
    assert.equal(restoredBelt2.direction, 'SOUTH');
    assert.equal(restoredBelt2.itemCount, 1);
    assert.equal(restoredBelt2.getItems()[0].itemId, 'wire');
    assert.ok(Math.abs(restoredBelt2.getItems()[0].progress - 0.45) < 0.05);
  });

  it('Should preserve Splitters and Mergers with internal slots and orientations', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(0);

    const splitter = logistics.addSplitter({ x: 2, y: 2 }, 'EAST', ['EAST', 'SOUTH']);
    splitter.acceptItem('iron_ore', 0.4);

    const merger = logistics.addMerger({ x: 5, y: 2 }, ['EAST', 'NORTH'], 'EAST');
    merger.acceptItemFrom('NORTH', 'copper_ore', 0.6);

    const saveData = FactorySerializer.serialize(grid, logistics, engine, economy);
    const restored = FactorySerializer.deserialize(saveData);

    const restoredSplitter = restored.logistics.getSplitter(2, 2);
    assert.ok(restoredSplitter, 'Splitter must be restored');
    assert.equal(restoredSplitter.inputDirection, 'EAST');
    assert.deepEqual(restoredSplitter.outputDirections, ['EAST', 'SOUTH']);
    assert.equal(restoredSplitter.itemCount, 1);
    assert.equal(restoredSplitter.getItems()[0].itemId, 'iron_ore');

    const restoredMerger = restored.logistics.getMerger(5, 2);
    assert.ok(restoredMerger, 'Merger must be restored');
    assert.equal(restoredMerger.outputDirection, 'EAST');
    assert.deepEqual(restoredMerger.inputDirections, ['EAST', 'NORTH']);
    assert.equal(restoredMerger.itemCount, 1);
    assert.equal(restoredMerger.getItems()[0].itemId, 'copper_ore');
  });

  it('Should preserve incremental economy state: money, totalEarned, plots, and multiplier', () => {
    const grid = new GridMap(12, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(0);

    economy.addMoney(5000, 'EXPORT');
    economy.unlockPlot(1); // 500$ harca, Parsel 1'i aç
    economy.revenueMultiplier = 1.75;

    assert.equal(economy.money, 4500);
    assert.equal(economy.totalEarned, 5000);
    assert.ok(economy.isPlotUnlocked(1));

    const saveData = FactorySerializer.serialize(grid, logistics, engine, economy);
    assert.equal(saveData.economy.money, 4500);
    assert.equal(saveData.economy.totalEarned, 5000);
    assert.equal(saveData.economy.revenueMultiplier, 1.75);
    assert.deepEqual(saveData.economy.unlockedPlots.sort(), [0, 1]);

    const restored = FactorySerializer.deserialize(saveData);
    assert.equal(restored.economy.money, 4500);
    assert.equal(restored.economy.totalEarned, 5000);
    assert.equal(restored.economy.revenueMultiplier, 1.75);
    assert.ok(restored.economy.isPlotUnlocked(0));
    assert.ok(restored.economy.isPlotUnlocked(1));
    assert.equal(restored.economy.isPlotUnlocked(2), false);
  });

  it('Should resume active simulation seamlessly after deserialization', () => {
    // Pipeline: INTAKE (1, 0) -> Belt (1, 1, SOUTH) -> Crusher (1, 2) -> Belt (1, 3, SOUTH) -> EXPORT (1, 4)
    const grid = new GridMap(4, 6);
    grid.setIntake(1, 0, 'iron_ore', 0.5);
    grid.setExport(1, 4);

    const logistics = new LogisticsNetwork(grid);
    logistics.addConveyor({ x: 1, y: 1 }, 'SOUTH', 3.0);
    logistics.addConveyor({ x: 1, y: 3 }, 'SOUTH', 3.0);

    const engine = new ProductionEngine(grid, logistics);
    const crusherDef = defaultMachineRegistry.getOrThrow('crusher');
    const crusher = new MachineEntity('c1', crusherDef, { x: 1, y: 2 }, 0, 'recipe_crush_iron_ore');
    engine.addMachine(crusher, 2);

    const economy = new FactoryEconomy(0);
    logistics.onItemDelivered = (evt) => {
      economy.exportItem(evt.itemId);
    };

    // 2 saniye çalıştır: girdi çekilsin ve üretim başlasın
    for (let t = 0; t < 20; t++) {
      logistics.tick(0.1);
      engine.tick(0.1);
      economy.tick(0.1);
    }

    // Bu noktada kaydet
    const jsonSave = FactorySerializer.serializeToJson(grid, logistics, engine, economy);

    // Yeni temiz ortamda geri yükle
    const restored = FactorySerializer.deserializeFromJson(jsonSave);

    // Simülasyona kaldığı yerden 15 saniye devam et
    const startingMoney = restored.economy.money;
    for (let t = 0; t < 150; t++) {
      restored.logistics.tick(0.1);
      restored.engine.tick(0.1);
      restored.economy.tick(0.1);
    }

    assert.ok(
      restored.economy.money > startingMoney,
      `Restored factory should resume production and earn money (Before: ${startingMoney}, After: ${restored.economy.money})`,
    );
  });

  it('Storage adapter: saveToStorage, loadFromStorage, hasSave, and clearStorage', () => {
    const memoryStorage = new Map<string, string>();
    const mockStorage: StorageLike = {
      getItem: (key) => memoryStorage.get(key) || null,
      setItem: (key, val) => {
        memoryStorage.set(key, val);
      },
      removeItem: (key) => {
        memoryStorage.delete(key);
      },
    };

    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(777);

    const saveData = FactorySerializer.serialize(grid, logistics, engine, economy);

    const key = 'test_slot_1';
    assert.equal(FactorySerializer.hasSave(key, mockStorage), false);

    const saved = FactorySerializer.saveToStorage(saveData, key, mockStorage);
    assert.equal(saved, true);
    assert.equal(FactorySerializer.hasSave(key, mockStorage), true);

    const loaded = FactorySerializer.loadFromStorage(key, mockStorage);
    assert.ok(loaded);
    assert.equal(loaded?.money, 777);
    assert.equal(loaded?.factoryWidth, 8);

    const cleared = FactorySerializer.clearStorage(key, mockStorage);
    assert.equal(cleared, true);
    assert.equal(FactorySerializer.hasSave(key, mockStorage), false);
    assert.equal(FactorySerializer.loadFromStorage(key, mockStorage), null);
  });

  it('Validation: reject corrupted or invalid save schemas', () => {
    assert.equal(FactorySerializer.validateSaveData(null).valid, false);
    assert.equal(FactorySerializer.validateSaveData({}).valid, false);
    assert.equal(FactorySerializer.validateSaveData({ version: -1 }).valid, false);
    assert.equal(
      FactorySerializer.validateSaveData({
        version: 999, // Future version
        factoryWidth: 8,
        factoryHeight: 8,
      }).valid,
      false,
    );
    assert.equal(
      FactorySerializer.validateSaveData({
        version: 1,
        factoryWidth: -5,
        factoryHeight: 8,
      }).valid,
      false,
    );
  });
});
