/* ======================================================================
 * src/factory/input/DemolishMath.test.ts — Yıkım ve Taşıma Birim Testleri
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { DemolishMath } from './DemolishMath.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';
import { MachineEntity } from '../simulation/MachineEntity.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { defaultMachineRegistry } from '../simulation/MachineRegistry.ts';
import { CONVEYOR_BUILD_COST, SPLITTER_BUILD_COST } from './PlacementMath.ts';

describe('DemolishMath Inspection & Protected Objects', () => {
  it('Should reject demolition on empty, obstacle, intake, and export cells', () => {
    const grid = new GridMap(8, 8);
    grid.setObstacle(1, 1);
    grid.setIntake(2, 0, 'iron_ore');
    grid.setExport(7, 7);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(0);

    // Boş hücre
    const rEmpty = DemolishMath.inspectTarget({ grid, logistics, engine, economy, coord: { x: 0, y: 0 } });
    assert.equal(rEmpty.canDemolish, false);
    assert.equal(rEmpty.blockReason, 'EMPTY');

    // Engel
    const rObs = DemolishMath.inspectTarget({ grid, logistics, engine, economy, coord: { x: 1, y: 1 } });
    assert.equal(rObs.canDemolish, false);
    assert.equal(rObs.blockReason, 'PROTECTED_OBSTACLE');

    // Hammadde Silosu
    const rIntake = DemolishMath.inspectTarget({ grid, logistics, engine, economy, coord: { x: 2, y: 0 } });
    assert.equal(rIntake.canDemolish, false);
    assert.equal(rIntake.blockReason, 'PROTECTED_INTAKE');

    // İhracat Sandığı
    const rExport = DemolishMath.inspectTarget({ grid, logistics, engine, economy, coord: { x: 7, y: 7 } });
    assert.equal(rExport.canDemolish, false);
    assert.equal(rExport.blockReason, 'PROTECTED_EXPORT');

    // Sınır dışı
    const rOut = DemolishMath.inspectTarget({ grid, logistics, engine, economy, coord: { x: 99, y: 99 } });
    assert.equal(rOut.canDemolish, false);
    assert.equal(rOut.blockReason, 'OUT_OF_BOUNDS');
  });
});

describe('DemolishMath Conveyor & Logistics Dismantling', () => {
  it('Should dismantle conveyor and refund 100% build cost', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(100);

    logistics.addConveyor({ x: 2, y: 2 }, 'EAST');
    assert.equal(logistics.conveyorCount, 1);

    const info = DemolishMath.inspectTarget({ grid, logistics, engine, economy, coord: { x: 2, y: 2 } });
    assert.equal(info.canDemolish, true);
    assert.equal(info.targetType, 'CONVEYOR');
    assert.equal(info.refundAmount, CONVEYOR_BUILD_COST);

    const initialMoney = economy.money;
    const res = DemolishMath.executeDemolish({ grid, logistics, engine, economy, coord: { x: 2, y: 2 } });

    assert.equal(res.success, true);
    assert.equal(res.refundAmount, CONVEYOR_BUILD_COST);
    assert.equal(economy.money, initialMoney + CONVEYOR_BUILD_COST);
    assert.equal(grid.getCellType(2, 2), 'EMPTY');
    assert.equal(logistics.conveyorCount, 0);
  });

  it('Should dismantle splitter and refund full splitter cost', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(0);

    logistics.addSplitter({ x: 3, y: 3 }, 'NORTH', ['EAST', 'WEST']);
    assert.ok(logistics.getSplitter(3, 3) !== undefined);

    const res = DemolishMath.executeDemolish({ grid, logistics, engine, economy, coord: { x: 3, y: 3 } });
    assert.equal(res.success, true);
    assert.equal(res.refundAmount, SPLITTER_BUILD_COST);
    assert.equal(economy.money, SPLITTER_BUILD_COST);
    assert.equal(grid.getCellType(3, 3), 'EMPTY');
    assert.ok(logistics.getSplitter(3, 3) === undefined);
  });
});

describe('DemolishMath Machine Dismantling & 100% Capital Refund', () => {
  it('Should demolish Level 1 machine and refund base cost', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(0);

    const crusherDef = defaultMachineRegistry.get('crusher')!;
    const machine = new MachineEntity('crusher_test', crusherDef, { x: 2, y: 2 }, 0);
    engine.addMachine(machine, 1);

    const info = DemolishMath.inspectTarget({ grid, logistics, engine, economy, coord: { x: 2, y: 2 } });
    assert.equal(info.canDemolish, true);
    assert.equal(info.targetType, 'MACHINE');
    assert.equal(info.refundAmount, crusherDef.baseCost);

    const res = DemolishMath.executeDemolish({ grid, logistics, engine, economy, coord: { x: 2, y: 2 } });
    assert.equal(res.success, true);
    assert.equal(res.refundAmount, crusherDef.baseCost);
    assert.equal(economy.money, crusherDef.baseCost);
    assert.equal(grid.getCellType(2, 2), 'EMPTY');
    assert.equal(engine.machineCount, 0);
  });

  it('Should refund 100% of base cost PLUS all upgrade costs for upgraded machine', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(0);

    const crusherDef = defaultMachineRegistry.get('crusher')!;
    const machine = new MachineEntity('crusher_upgraded', crusherDef, { x: 2, y: 2 }, 0);
    engine.addMachine(machine, 3); // Seviye 3

    const expectedRefund = economy.getTotalMachineInvestment(crusherDef.baseCost, 3);
    assert.ok(expectedRefund > crusherDef.baseCost);

    const res = DemolishMath.executeDemolish({ grid, logistics, engine, economy, coord: { x: 2, y: 2 } });
    assert.equal(res.success, true);
    assert.equal(res.refundAmount, expectedRefund);
    assert.equal(economy.money, expectedRefund);
  });

  it('Demolishing multi-tile 2x2 Assembler from any cell should free all 4 cells', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(0);

    const assemblerDef = defaultMachineRegistry.get('assembler')!; // 2x2
    const assembler = new MachineEntity('asm_1', assemblerDef, { x: 1, y: 1 }, 0);
    engine.addMachine(assembler, 1);

    // (2, 2) hücresinden (sağ alt köşesi) yıkmayı dene
    const info = DemolishMath.inspectTarget({ grid, logistics, engine, economy, coord: { x: 2, y: 2 } });
    assert.equal(info.canDemolish, true);
    assert.equal(info.instanceId, 'asm_1');
    assert.equal(info.occupiedCoords.length, 4);

    const res = DemolishMath.executeDemolish({ grid, logistics, engine, economy, coord: { x: 2, y: 2 } });
    assert.equal(res.success, true);
    assert.equal(res.freedCoords.length, 4);

    // 4 hücrenin hepsi EMPTY olmalı
    assert.equal(grid.getCellType(1, 1), 'EMPTY');
    assert.equal(grid.getCellType(2, 1), 'EMPTY');
    assert.equal(grid.getCellType(1, 2), 'EMPTY');
    assert.equal(grid.getCellType(2, 2), 'EMPTY');
    assert.equal(engine.machineCount, 0);
  });

  it('inspectArea should scan region and deduplicate multi-tile machines', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(0);

    // 2x2 Assembler (1, 1) -> (1,1), (2,1), (1,2), (2,2)
    const asmDef = defaultMachineRegistry.get('assembler')!;
    engine.addMachine(new MachineEntity('asm_area', asmDef, { x: 1, y: 1 }, 0));

    // 2 Konveyör
    logistics.addConveyor({ x: 3, y: 1 }, 'EAST');
    logistics.addConveyor({ x: 3, y: 2 }, 'EAST');

    // (0, 0) ile (3, 3) arasını tara
    const area = DemolishMath.inspectArea(grid, logistics, engine, economy, { x: 0, y: 0 }, { x: 3, y: 3 });

    // 1 makine + 2 konveyör = 3 hedef
    assert.equal(area.targets.length, 3);
    assert.equal(area.totalRefund, asmDef.baseCost + CONVEYOR_BUILD_COST * 2);
    assert.equal(area.affectedCoords.length, 6); // 4 makine hücresi + 2 konveyör
  });
});
