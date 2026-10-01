/* ======================================================================
 * src/factory/types.test.ts — Temel Veri Tipleri Birim Testi
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  DIRECTION_VECTORS,
  OPPOSITE_DIRECTIONS,
  type Direction,
  type ItemDefinition,
  type RecipeDefinition,
  type MachineDefinition,
} from './types.ts';

describe('Factory Types & Vectors', () => {
  it('Direction vectors should correctly map Cartesian delta coordinates', () => {
    assert.deepEqual(DIRECTION_VECTORS.NORTH, { dx: 0, dy: -1 });
    assert.deepEqual(DIRECTION_VECTORS.EAST, { dx: 1, dy: 0 });
    assert.deepEqual(DIRECTION_VECTORS.SOUTH, { dx: 0, dy: 1 });
    assert.deepEqual(DIRECTION_VECTORS.WEST, { dx: -1, dy: 0 });
  });

  it('Opposite directions should be symmetric inverses', () => {
    const directions: Direction[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
    for (const dir of directions) {
      const opp = OPPOSITE_DIRECTIONS[dir];
      assert.equal(OPPOSITE_DIRECTIONS[opp], dir);
    }
  });

  it('ItemDefinition interface should instantiate properly', () => {
    const testItem: ItemDefinition = {
      id: 'iron_ore',
      name: 'Demir Cevheri',
      tier: 0,
      baseValue: 1,
      spriteKey: 'pickup_gear',
    };
    assert.equal(testItem.id, 'iron_ore');
    assert.equal(testItem.tier, 0);
  });

  it('RecipeDefinition interface should support multiple inputs and outputs', () => {
    const testRecipe: RecipeDefinition = {
      id: 'recipe_assemble_motor',
      name: 'Basit Motor Montajı',
      category: 'assembling',
      inputs: [
        { itemId: 'iron_plate', count: 1 },
        { itemId: 'copper_wire', count: 2 },
      ],
      outputs: [{ itemId: 'simple_motor', count: 1 }],
      processingTimeSec: 4.0,
    };
    assert.equal(testRecipe.inputs.length, 2);
    assert.equal(testRecipe.outputs[0].itemId, 'simple_motor');
  });

  it('MachineDefinition should configure input and output ports', () => {
    const testMachine: MachineDefinition = {
      id: 'assembler',
      name: 'Montaj Tezgahı',
      description: 'İki bileşeni birleştirir.',
      width: 2,
      height: 2,
      category: 'assembling',
      baseCost: 200,
      supportedRecipeIds: ['recipe_assemble_motor'],
      ports: [
        { id: 'in_1', type: 'INPUT', localX: 0, localY: 0, direction: 'NORTH' },
        { id: 'in_2', type: 'INPUT', localX: 1, localY: 0, direction: 'NORTH' },
        { id: 'out_1', type: 'OUTPUT', localX: 0, localY: 1, direction: 'SOUTH' },
      ],
      spriteBaseKey: 'machine_bench',
      inputBufferCapacity: 5,
      outputBufferCapacity: 5,
    };
    assert.equal(testMachine.ports.length, 3);
    assert.equal(testMachine.width, 2);
    assert.equal(testMachine.height, 2);
  });
});
