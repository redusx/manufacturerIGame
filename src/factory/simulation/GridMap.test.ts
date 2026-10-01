/* ======================================================================
 * src/factory/simulation/GridMap.test.ts — Mekânsal Izgara Birim Testi
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GridMap } from './GridMap.ts';

describe('GridMap Spatial Engine', () => {
  it('Should initialize grid with correct dimensions and all EMPTY cells', () => {
    const grid = new GridMap(8, 6);
    assert.equal(grid.width, 8);
    assert.equal(grid.height, 6);

    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 8; x++) {
        assert.equal(grid.getCellType(x, y), 'EMPTY');
        assert.equal(grid.isCellEmpty(x, y), true);
      }
    }
  });

  it('isInBounds() should accurately detect valid and out-of-bounds coordinates', () => {
    const grid = new GridMap(10, 10);
    assert.equal(grid.isInBounds(0, 0), true);
    assert.equal(grid.isInBounds(9, 9), true);
    assert.equal(grid.isInBounds(-1, 0), false);
    assert.equal(grid.isInBounds(0, -1), false);
    assert.equal(grid.isInBounds(10, 5), false);
    assert.equal(grid.isInBounds(5, 10), false);
  });

  it('setObstacle, setIntake and setExport should mark special fixed cells', () => {
    const grid = new GridMap(5, 5);

    grid.setObstacle(2, 2);
    assert.equal(grid.getCellType(2, 2), 'OBSTACLE');
    assert.equal(grid.isCellEmpty(2, 2), false);

    grid.setIntake(0, 1, 'iron_ore', 1.5);
    const intakeCell = grid.getCell(0, 1);
    assert.equal(intakeCell?.type, 'INTAKE');
    assert.equal(intakeCell?.intakeData?.itemId, 'iron_ore');
    assert.equal(intakeCell?.intakeData?.intervalSec, 1.5);

    grid.setExport(4, 3);
    assert.equal(grid.getCellType(4, 3), 'EXPORT');
  });

  it('Conveyor placement and removal should update cell state cleanly', () => {
    const grid = new GridMap(6, 6);

    assert.equal(grid.canPlaceConveyor(2, 1), true);
    grid.setConveyor(2, 1);
    assert.equal(grid.getCellType(2, 1), 'CONVEYOR');
    assert.equal(grid.canPlaceConveyor(2, 1), false);

    grid.removeConveyor(2, 1);
    assert.equal(grid.getCellType(2, 1), 'EMPTY');
    assert.equal(grid.canPlaceConveyor(2, 1), true);
  });

  it('Multi-tile machine (2x2) placement should occupy all 4 footprint tiles', () => {
    const grid = new GridMap(8, 8);

    assert.equal(grid.canPlaceMachine(3, 3, 2, 2), true);
    grid.placeMachine('assembler_1', 3, 3, 2, 2);

    // 4 hücrenin de MACHINE tipinde ve assembler_1 köküne bağlı olduğu doğrulanmalı
    for (let dy = 0; dy < 2; dy++) {
      for (let dx = 0; dx < 2; dx++) {
        const x = 3 + dx;
        const y = 3 + dy;
        assert.equal(grid.getCellType(x, y), 'MACHINE');
        assert.equal(grid.isCellEmpty(x, y), false);

        const info = grid.getMachineAt(x, y);
        assert.ok(info !== null);
        assert.equal(info.instanceId, 'assembler_1');
        assert.deepEqual(info.rootCoord, { x: 3, y: 3 });
      }
    }
  });

  it('canPlaceMachine() should prevent placement overlapping obstacles or out of bounds', () => {
    const grid = new GridMap(5, 5);
    grid.setObstacle(2, 2);

    // 2x2 makine engel ile çakışırsa
    assert.equal(grid.canPlaceMachine(1, 1, 2, 2), false); // (2, 2) engeline çarpar
    assert.equal(grid.canPlaceMachine(2, 2, 2, 2), false);

    // Izgara dışına taşarsa
    assert.equal(grid.canPlaceMachine(4, 4, 2, 2), false); // sağ ve alt sınır dışı
    assert.equal(grid.canPlaceMachine(4, 0, 2, 1), false); // sağ sınır dışı

    // Engel olmayan yere sığmalı
    assert.equal(grid.canPlaceMachine(0, 0, 2, 2), true);
  });

  it('removeMachine() should free up all cells back to EMPTY', () => {
    const grid = new GridMap(6, 6);
    grid.placeMachine('refinery_1', 1, 1, 2, 2);

    assert.equal(grid.isCellEmpty(1, 1), false);
    assert.equal(grid.isCellEmpty(2, 2), false);

    grid.removeMachine('refinery_1');

    assert.equal(grid.isCellEmpty(1, 1), true);
    assert.equal(grid.isCellEmpty(2, 1), true);
    assert.equal(grid.isCellEmpty(1, 2), true);
    assert.equal(grid.isCellEmpty(2, 2), true);
    assert.equal(grid.getMachineAt(1, 1), null);
  });
});
