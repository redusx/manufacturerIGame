/* ======================================================================
 * src/factory/input/PlacementMath.test.ts — İnşa ve Yerleşim Birim Testleri
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  PlacementMath,
  CONVEYOR_BUILD_COST,
} from './PlacementMath.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { defaultMachineRegistry } from '../simulation/MachineRegistry.ts';

describe('PlacementMath Rotation & Footprint Mathematics', () => {
  it('rotateDirection should rotate clockwise and counter-clockwise correctly', () => {
    assert.equal(PlacementMath.rotateDirection('NORTH', true), 'EAST');
    assert.equal(PlacementMath.rotateDirection('EAST', true), 'SOUTH');
    assert.equal(PlacementMath.rotateDirection('SOUTH', true), 'WEST');
    assert.equal(PlacementMath.rotateDirection('WEST', true), 'NORTH');

    assert.equal(PlacementMath.rotateDirection('NORTH', false), 'WEST');
    assert.equal(PlacementMath.rotateDirection('WEST', false), 'SOUTH');
  });

  it('directionToRotationDeg and rotationDegToDirection should be symmetric', () => {
    assert.equal(PlacementMath.directionToRotationDeg('NORTH'), 0);
    assert.equal(PlacementMath.directionToRotationDeg('EAST'), 90);
    assert.equal(PlacementMath.directionToRotationDeg('SOUTH'), 180);
    assert.equal(PlacementMath.directionToRotationDeg('WEST'), 270);

    assert.equal(PlacementMath.rotationDegToDirection(0), 'NORTH');
    assert.equal(PlacementMath.rotationDegToDirection(90), 'EAST');
    assert.equal(PlacementMath.rotationDegToDirection(180), 'SOUTH');
    assert.equal(PlacementMath.rotationDegToDirection(270), 'WEST');
  });

  it('getEffectiveFootprint should transpose dimensions at 90 and 270 degrees', () => {
    const footprint = { width: 2, height: 1 };
    // Kuzey ve Güneyde orijinal boyut
    assert.deepEqual(PlacementMath.getEffectiveFootprint(footprint, 'NORTH'), { width: 2, height: 1 });
    assert.deepEqual(PlacementMath.getEffectiveFootprint(footprint, 'SOUTH'), { width: 2, height: 1 });

    // Doğu ve Batıda transpoze boyut
    assert.deepEqual(PlacementMath.getEffectiveFootprint(footprint, 'EAST'), { width: 1, height: 2 });
    assert.deepEqual(PlacementMath.getEffectiveFootprint(footprint, 'WEST'), { width: 1, height: 2 });

    // Kare 2x2 her zaman 2x2
    const square = { width: 2, height: 2 };
    assert.deepEqual(PlacementMath.getEffectiveFootprint(square, 'EAST'), { width: 2, height: 2 });
  });

  it('computeOccupiedCoords should list all grid cells in footprint', () => {
    const coords = PlacementMath.computeOccupiedCoords({ x: 2, y: 3 }, { width: 2, height: 2 });
    assert.equal(coords.length, 4);
    assert.deepEqual(coords, [
      { x: 2, y: 3 },
      { x: 3, y: 3 },
      { x: 2, y: 4 },
      { x: 3, y: 4 },
    ]);
  });
});

describe('PlacementMath Validation Rules', () => {
  it('Should reject out-of-bounds placements', () => {
    const grid = new GridMap(8, 8);
    const economy = new FactoryEconomy(1000);
    const crusher = defaultMachineRegistry.get('crusher')!; // 1x1

    // 8x8 ızgarada (8, 0) sınır dışıdır
    const v1 = PlacementMath.validatePlacement({
      grid,
      economy,
      rootCoord: { x: 8, y: 0 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: crusher,
    });
    assert.equal(v1.isValid, false);
    assert.equal(v1.reason, 'OUT_OF_BOUNDS');

    // 2x2 Assembler (7, 7)'de sağ ve alttan taşar
    const assembler = defaultMachineRegistry.get('assembler')!; // 2x2
    const v2 = PlacementMath.validatePlacement({
      grid,
      economy,
      rootCoord: { x: 7, y: 7 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: assembler,
    });
    assert.equal(v2.isValid, false);
    assert.equal(v2.reason, 'OUT_OF_BOUNDS');
  });

  it('Should reject placements in locked expansion plots', () => {
    const grid = new GridMap(16, 16);
    const economy = new FactoryEconomy(1000);
    const crusher = defaultMachineRegistry.get('crusher')!;

    // Henüz yalnızca 8x8 parsel açıkken (8, 2) koordinatı kilitlidir
    const result = PlacementMath.validatePlacement({
      grid,
      economy,
      rootCoord: { x: 8, y: 2 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: crusher,
      unlockedBounds: { width: 8, height: 8 },
    });

    assert.equal(result.isValid, false);
    assert.equal(result.reason, 'LOCKED_PLOT');
  });

  it('Should reject placements on occupied cells', () => {
    const grid = new GridMap(8, 8);
    grid.setObstacle(3, 3);
    const economy = new FactoryEconomy(1000);
    const crusher = defaultMachineRegistry.get('crusher')!;

    const result = PlacementMath.validatePlacement({
      grid,
      economy,
      rootCoord: { x: 3, y: 3 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: crusher,
    });

    assert.equal(result.isValid, false);
    assert.equal(result.reason, 'CELL_OCCUPIED');
  });

  it('Should reject placements when economy cannot afford cost', () => {
    const grid = new GridMap(8, 8);
    const economy = new FactoryEconomy(10); // Yetersiz bakiye ($10)
    const crusher = defaultMachineRegistry.get('crusher')!; // $100

    const result = PlacementMath.validatePlacement({
      grid,
      economy,
      rootCoord: { x: 2, y: 2 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: crusher,
    });

    assert.equal(result.isValid, false);
    assert.equal(result.reason, 'NOT_ENOUGH_MONEY');
    assert.equal(result.canAfford, false);
    assert.equal(result.cost, crusher.baseCost);
  });

  it('Should approve valid placements and output preview ports', () => {
    const grid = new GridMap(8, 8);
    const economy = new FactoryEconomy(500);
    const crusher = defaultMachineRegistry.get('crusher')!;

    const result = PlacementMath.validatePlacement({
      grid,
      economy,
      rootCoord: { x: 2, y: 2 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: crusher,
      unlockedBounds: { width: 8, height: 8 },
    });

    assert.equal(result.isValid, true);
    assert.equal(result.reason, undefined);
    assert.equal(result.canAfford, true);
    assert.equal(result.previewPorts.length, crusher.ports.length);
  });
});

describe('PlacementMath Execution Integration', () => {
  it('executePlacement should place machine, charge economy, and register with engine', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(500);
    const crusher = defaultMachineRegistry.get('crusher')!;

    const initialMoney = economy.money;
    const res = PlacementMath.executePlacement({
      grid,
      economy,
      engine,
      logistics,
      rootCoord: { x: 3, y: 3 },
      itemType: 'MACHINE',
      direction: 'NORTH',
      machineDef: crusher,
    });

    assert.equal(res.success, true);
    assert.ok(res.instanceId !== undefined);
    assert.equal(res.spentMoney, crusher.baseCost);
    assert.equal(economy.money, initialMoney - crusher.baseCost);

    // Izgara hücresi MACHINE olmalı
    assert.equal(grid.getCellType(3, 3), 'MACHINE');
    assert.equal(engine.machineCount, 1);
  });

  it('executePlacement should place conveyor belt and charge build cost', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const economy = new FactoryEconomy(100);

    const res = PlacementMath.executePlacement({
      grid,
      economy,
      logistics,
      rootCoord: { x: 4, y: 2 },
      itemType: 'CONVEYOR',
      direction: 'EAST',
    });

    assert.equal(res.success, true);
    assert.equal(res.spentMoney, CONVEYOR_BUILD_COST);
    assert.equal(economy.money, 100 - CONVEYOR_BUILD_COST);
    assert.equal(grid.getCellType(4, 2), 'CONVEYOR');
    assert.equal(logistics.conveyorCount, 1);
  });
});
