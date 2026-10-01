/* ======================================================================
 * src/factory/input/SmartBeltPathfinder.test.ts — Akıllı Konveyör Birim Testleri
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SmartBeltPathfinder } from './SmartBeltPathfinder.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';
import { MachineEntity } from '../simulation/MachineEntity.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { defaultMachineRegistry } from '../simulation/MachineRegistry.ts';

describe('SmartBeltPathfinder Geometry & Distance', () => {
  it('manhattan distance should calculate orthogonal distance accurately', () => {
    assert.equal(SmartBeltPathfinder.manhattan({ x: 1, y: 1 }, { x: 4, y: 5 }), 3 + 4);
    assert.equal(SmartBeltPathfinder.manhattan({ x: 5, y: 2 }, { x: 5, y: 2 }), 0);
  });
});

describe('SmartBeltPathfinder A* Routing Scenarios', () => {
  it('Should generate straight horizontal conveyor line', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const economy = new FactoryEconomy(500);

    const res = SmartBeltPathfinder.findPath({
      grid,
      logistics,
      economy,
      startCoord: { x: 1, y: 2 },
      endCoord: { x: 4, y: 2 },
    });

    assert.equal(res.success, true);
    assert.equal(res.steps.length, 4);
    assert.equal(res.totalCost, 4 * 5); // 4 karo * $5
    assert.equal(res.canAfford, true);

    // Tüm adımlar doğuya bakmalı
    for (const step of res.steps) {
      assert.equal(step.direction, 'EAST');
    }
  });

  it('Should generate clean L-shaped corner instead of stairs', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const economy = new FactoryEconomy(500);

    const res = SmartBeltPathfinder.findPath({
      grid,
      logistics,
      economy,
      startCoord: { x: 1, y: 1 },
      endCoord: { x: 3, y: 3 },
    });

    assert.equal(res.success, true);
    assert.equal(res.steps.length, 5); // (1,1)->(2,1)->(3,1)->(3,2)->(3,3)

    // Viraj sayısı tam 1 olmalı (temel L dönüşü)
    let turns = 0;
    for (let i = 0; i < res.steps.length - 1; i++) {
      if (res.steps[i].direction !== res.steps[i + 1].direction) {
        turns++;
      }
    }
    assert.equal(turns, 1, 'Pathfinder should make exactly 1 clean turn instead of zigzagging');
  });

  it('Should detour cleanly around obstacles and walls', () => {
    const grid = new GridMap(8, 8);
    // (2, 2) koordinatına engel koy
    grid.setObstacle(2, 2);
    const logistics = new LogisticsNetwork(grid);
    const economy = new FactoryEconomy(500);

    // (1, 2)'den (3, 2)'ye direkt yatay yol kapalı
    const res = SmartBeltPathfinder.findPath({
      grid,
      logistics,
      economy,
      startCoord: { x: 1, y: 2 },
      endCoord: { x: 3, y: 2 },
    });

    assert.equal(res.success, true);
    // Engelli hücre yolda bulunmamalı
    for (const step of res.steps) {
      assert.ok(!(step.coord.x === 2 && step.coord.y === 2), 'Path must not step on obstacle');
    }
  });

  it('Should reject paths outside unlocked factory plots', () => {
    const grid = new GridMap(16, 16);
    const logistics = new LogisticsNetwork(grid);
    const economy = new FactoryEconomy(500);

    const res = SmartBeltPathfinder.findPath({
      grid,
      logistics,
      economy,
      startCoord: { x: 2, y: 2 },
      endCoord: { x: 10, y: 2 },
      unlockedBounds: { width: 8, height: 8 },
    });

    assert.equal(res.success, false);
    assert.equal(res.failureReason, 'LOCKED_PLOT');
  });

  it('Should report canAfford false when player lacks cash', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const economy = new FactoryEconomy(10); // $10 var, 4 karo = $20

    const res = SmartBeltPathfinder.findPath({
      grid,
      logistics,
      economy,
      startCoord: { x: 1, y: 1 },
      endCoord: { x: 4, y: 1 },
    });

    assert.equal(res.success, true);
    assert.equal(res.totalCost, 20);
    assert.equal(res.canAfford, false);
  });
});

describe('SmartBeltPathfinder Machine-to-Machine & Execution', () => {
  it('executePath should charge economy and build conveyors in network', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const economy = new FactoryEconomy(100);

    const path = SmartBeltPathfinder.findPath({
      grid,
      logistics,
      economy,
      startCoord: { x: 1, y: 1 },
      endCoord: { x: 3, y: 1 },
    });

    const initialMoney = economy.money;
    const executed = SmartBeltPathfinder.executePath(logistics, economy, path);

    assert.equal(executed, true);
    assert.equal(economy.money, initialMoney - path.totalCost);
    assert.equal(logistics.conveyorCount, 3);
    assert.equal(grid.getCellType(1, 1), 'CONVEYOR');
    assert.equal(grid.getCellType(2, 1), 'CONVEYOR');
    assert.equal(grid.getCellType(3, 1), 'CONVEYOR');
  });

  it('findPathBetweenMachines should automatically connect Machine A output to Machine B input', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(1000);

    const crusherDef = defaultMachineRegistry.get('crusher')!;
    const cutterDef = defaultMachineRegistry.get('cutter')!;

    // Makine 1: (2, 1) Kırıcı (Çıkışı Güneyde, out_main: (0, 0) lokal, Güney) -> (2, 1)
    const m1 = new MachineEntity('crusher_1', crusherDef, { x: 2, y: 1 }, 0);
    engine.addMachine(m1);

    // Makine 2: (2, 4) Kesici (Girişi Kuzeyde, in_main: (0, 0) lokal, Kuzey) -> (2, 4)
    const m2 = new MachineEntity('cutter_1', cutterDef, { x: 2, y: 4 }, 0);
    engine.addMachine(m2);

    const path = SmartBeltPathfinder.findPathBetweenMachines({
      fromMachineId: 'crusher_1',
      toMachineId: 'cutter_1',
      engine,
      grid,
      logistics,
      economy,
    });

    assert.equal(path.success, true);
    // Kırıcının güney çıkışının önündeki hücre (2, 2) ile Kesicinin kuzey girişinin önündeki hücre (2, 3)
    assert.equal(path.steps.length, 2);
    assert.deepEqual(path.steps[0].coord, { x: 2, y: 2 });
    assert.equal(path.steps[0].direction, 'SOUTH');
    assert.deepEqual(path.steps[1].coord, { x: 2, y: 3 });
    assert.equal(path.steps[1].direction, 'SOUTH');
  });
});
