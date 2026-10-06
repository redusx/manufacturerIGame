/* ======================================================================
 * src/factory/simulation/MachineRegistry.test.ts — Makine Kataloğu Birim Testi
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  MachineRegistry,
  defaultMachineRegistry,
  getRotatedPort,
} from './MachineRegistry.ts';
import { RecipeRegistry, defaultRecipeRegistry } from './RecipeRegistry.ts';
import type { MachinePort } from '../types.ts';

describe('MachineRegistry', () => {
  it('defaultMachineRegistry should contain 6 core machines', () => {
    assert.equal(defaultMachineRegistry.count, 6);
    assert.ok(defaultMachineRegistry.has('crusher'));
    assert.ok(defaultMachineRegistry.has('smelter'));
    assert.ok(defaultMachineRegistry.has('press'));
    assert.ok(defaultMachineRegistry.has('cutter'));
    assert.ok(defaultMachineRegistry.has('assembler'));
    assert.ok(defaultMachineRegistry.has('refinery'));
  });

  it('validateAgainst() should succeed against defaultRecipeRegistry', () => {
    assert.doesNotThrow(() => {
      defaultMachineRegistry.validateAgainst(defaultRecipeRegistry);
    });
  });

  it('Cutter should have 1 input port and 2 output ports (main + scrap byproduct)', () => {
    const cutter = defaultMachineRegistry.getOrThrow('cutter');
    const inputs = cutter.ports.filter((p) => p.type === 'INPUT');
    const outputs = cutter.ports.filter((p) => p.type === 'OUTPUT');

    assert.equal(inputs.length, 1);
    assert.equal(outputs.length, 2);
    assert.equal(outputs.some((p) => p.id === 'out_scrap'), true);
  });

  it('Assembler should have 3 input ports and 1 output port on a 2x2 footprint', () => {
    const assembler = defaultMachineRegistry.getOrThrow('assembler');
    assert.equal(assembler.width, 2);
    assert.equal(assembler.height, 2);

    const inputs = assembler.ports.filter((p) => p.type === 'INPUT');
    const outputs = assembler.ports.filter((p) => p.type === 'OUTPUT');

    assert.equal(inputs.length, 3);
    assert.equal(outputs.length, 1);
  });

  it('validateAgainst() should catch category mismatch between machine and recipe', () => {
    const customRegistry = new MachineRegistry();
    customRegistry.register({
      id: 'faulty_crusher',
      name: 'Hatalı Kırıcı',
      description: 'Test',
      width: 1,
      height: 1,
      category: 'crushing',
      baseCost: 100,
      supportedRecipeIds: ['recipe_smelt_iron_ingot'], // Fırın reçetesi Kırıcıya atanamaz!
      ports: [],
      spriteBaseKey: 'test',
      inputBufferCapacity: 5,
      outputBufferCapacity: 5,
    });

    assert.throws(
      () => customRegistry.validateAgainst(defaultRecipeRegistry),
      /kategorisi ile reçete 'recipe_smelt_iron_ingot' \(smelting\) kategorisi uyuşmuyor/,
    );
  });
});

describe('Machine Port Rotation Geometry', () => {
  it('1x1 machine ports should rotate clockwise around origin', () => {
    const northPort: MachinePort = {
      id: 'in',
      type: 'INPUT',
      localX: 0,
      localY: 0,
      direction: 'NORTH',
    };

    // 0 derece
    assert.deepEqual(getRotatedPort(northPort, 1, 1, 0), {
      localX: 0,
      localY: 0,
      direction: 'NORTH',
    });

    // 90 derece CW
    assert.deepEqual(getRotatedPort(northPort, 1, 1, 90), {
      localX: 0,
      localY: 0,
      direction: 'EAST',
    });

    // 180 derece
    assert.deepEqual(getRotatedPort(northPort, 1, 1, 180), {
      localX: 0,
      localY: 0,
      direction: 'SOUTH',
    });

    // 270 derece
    assert.deepEqual(getRotatedPort(northPort, 1, 1, 270), {
      localX: 0,
      localY: 0,
      direction: 'WEST',
    });
  });

  it('2x1 rectangular machine ports should transpose coordinates and dimensions on rotation', () => {
    // 2x1 Fırın: Giriş (0, 0) Batı'ya bakar, Çıkış (1, 0) Doğu'ya bakar
    const inputPort: MachinePort = {
      id: 'in',
      type: 'INPUT',
      localX: 0,
      localY: 0,
      direction: 'WEST',
    };
    const outputPort: MachinePort = {
      id: 'out',
      type: 'OUTPUT',
      localX: 1,
      localY: 0,
      direction: 'EAST',
    };

    // 90 derece döndürünce makine 1x2 olur
    // Formül: (x, y) -> (H - 1 - y, x). W=2, H=1 -> newX = 1 - 1 - 0 = 0, newY = x.
    // Giriş: (0, 0, WEST) -> (0, 0, NORTH)
    assert.deepEqual(getRotatedPort(inputPort, 2, 1, 90), {
      localX: 0,
      localY: 0,
      direction: 'NORTH',
    });

    // Çıkış: (1, 0, EAST) -> newX = 1 - 1 - 0 = 0, newY = 1 -> (0, 1, SOUTH)
    assert.deepEqual(getRotatedPort(outputPort, 2, 1, 90), {
      localX: 0,
      localY: 1,
      direction: 'SOUTH',
    });
  });

  it('2x2 Assembler ports should rotate properly around 2x2 bounding box', () => {
    const port1: MachinePort = {
      id: 'in_1',
      type: 'INPUT',
      localX: 0,
      localY: 0,
      direction: 'NORTH',
    };
    const port2: MachinePort = {
      id: 'in_2',
      type: 'INPUT',
      localX: 1,
      localY: 0,
      direction: 'NORTH',
    };

    // 90 derece: (0, 0) -> (2 - 1 - 0, 0) = (1, 0, EAST)
    assert.deepEqual(getRotatedPort(port1, 2, 2, 90), {
      localX: 1,
      localY: 0,
      direction: 'EAST',
    });

    // 90 derece: (1, 0) -> (2 - 1 - 0, 1) = (1, 1, EAST)
    assert.deepEqual(getRotatedPort(port2, 2, 2, 90), {
      localX: 1,
      localY: 1,
      direction: 'EAST',
    });
  });
});
