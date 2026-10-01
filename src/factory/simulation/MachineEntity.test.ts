/* ======================================================================
 * src/factory/simulation/MachineEntity.test.ts — Makine Varlığı Birim Testi
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MachineEntity } from './MachineEntity.ts';
import { defaultMachineRegistry } from './MachineRegistry.ts';
import { defaultRecipeRegistry } from './RecipeRegistry.ts';
import type { MachineDefinition } from '../types.ts';

describe('MachineEntity Runtime Mechanics', () => {
  const crusherDef = defaultMachineRegistry.getOrThrow('crusher');
  const smelterDef = defaultMachineRegistry.getOrThrow('smelter');
  const cutterDef = defaultMachineRegistry.getOrThrow('cutter');
  const assemblerDef = defaultMachineRegistry.getOrThrow('assembler');

  it('Crusher should initialize with defaults, auto-selected recipe and correct state', () => {
    const machine = new MachineEntity('m_crush_1', crusherDef, { x: 4, y: 8 });

    assert.equal(machine.instanceId, 'm_crush_1');
    assert.equal(machine.defId, 'crusher');
    assert.deepEqual(machine.coord, { x: 4, y: 8 });
    assert.equal(machine.rotation, 0);
    assert.equal(machine.status, 'WAITING_INPUT');
    assert.equal(machine.activeRecipeId, 'recipe_crush_iron_ore');
    assert.equal(machine.effectiveWidth, 1);
    assert.equal(machine.effectiveHeight, 1);
    assert.deepEqual(machine.getOccupiedCoords(), [{ x: 4, y: 8 }]);
  });

  it('Footprint dimensions and occupied coords should transpose on 90 and 270 deg rotation', () => {
    const smelter = new MachineEntity('m_smelt_1', smelterDef, { x: 10, y: 20 }, 0);

    // Rotasyon 0 (2x1)
    assert.equal(smelter.effectiveWidth, 2);
    assert.equal(smelter.effectiveHeight, 1);
    assert.deepEqual(smelter.getOccupiedCoords(), [
      { x: 10, y: 20 },
      { x: 11, y: 20 },
    ]);
    assert.equal(smelter.containsCoord(10, 20), true);
    assert.equal(smelter.containsCoord(11, 20), true);
    assert.equal(smelter.containsCoord(10, 21), false);

    // Rotasyon 90 (1x2)
    smelter.rotateCW();
    assert.equal(smelter.rotation, 90);
    assert.equal(smelter.effectiveWidth, 1);
    assert.equal(smelter.effectiveHeight, 2);
    assert.deepEqual(smelter.getOccupiedCoords(), [
      { x: 10, y: 20 },
      { x: 10, y: 21 },
    ]);
    assert.equal(smelter.containsCoord(10, 21), true);
    assert.equal(smelter.containsCoord(11, 20), false);

    // Rotasyon 180 (2x1)
    smelter.rotateCW();
    assert.equal(smelter.rotation, 180);
    assert.equal(smelter.effectiveWidth, 2);
    assert.equal(smelter.effectiveHeight, 1);

    // Rotasyon 270 (1x2)
    smelter.rotateCW();
    assert.equal(smelter.rotation, 270);
    assert.equal(smelter.effectiveWidth, 1);
    assert.equal(smelter.effectiveHeight, 2);
  });

  it('World ports should compute correct world coords and outward directions', () => {
    // Kırıcı (1x1): Girdi Arka (NORTH), Çıktı Ön (SOUTH)
    const crusher = new MachineEntity('m_crush_2', crusherDef, { x: 5, y: 5 }, 0);
    const ports0 = crusher.getWorldPorts();

    const in0 = ports0.find((p) => p.type === 'INPUT')!;
    const out0 = ports0.find((p) => p.type === 'OUTPUT')!;

    assert.deepEqual(in0.worldCoord, { x: 5, y: 5 });
    assert.equal(in0.direction, 'NORTH');
    assert.deepEqual(out0.worldCoord, { x: 5, y: 5 });
    assert.equal(out0.direction, 'SOUTH');

    // 90 derece döndür
    crusher.rotateCW();
    const ports90 = crusher.getWorldPorts();
    const in90 = ports90.find((p) => p.type === 'INPUT')!;
    const out90 = ports90.find((p) => p.type === 'OUTPUT')!;

    assert.deepEqual(in90.worldCoord, { x: 5, y: 5 });
    assert.equal(in90.direction, 'EAST');
    assert.deepEqual(out90.worldCoord, { x: 5, y: 5 });
    assert.equal(out90.direction, 'WEST');
  });

  it('Assembler (2x2) should compute 2 input ports and 1 output port in world space', () => {
    const assembler = new MachineEntity('m_asm_1', assemblerDef, { x: 2, y: 4 }, 0);
    const inputs = assembler.getInputPorts();
    const outputs = assembler.getOutputPorts();

    assert.equal(inputs.length, 2);
    assert.equal(outputs.length, 1);

    // Assembler default: in_1 at (0,0) NORTH, in_2 at (1,0) NORTH, out_main at (0,1) SOUTH
    assert.deepEqual(inputs[0].worldCoord, { x: 2, y: 4 });
    assert.equal(inputs[0].direction, 'NORTH');
    assert.deepEqual(inputs[1].worldCoord, { x: 3, y: 4 });
    assert.equal(inputs[1].direction, 'NORTH');
    assert.deepEqual(outputs[0].worldCoord, { x: 2, y: 5 });
    assert.equal(outputs[0].direction, 'SOUTH');
  });

  it('canAcceptInput should strictly validate against active recipe and buffer capacity', () => {
    const crusher = new MachineEntity('m_crush_3', crusherDef, { x: 0, y: 0 });
    crusher.setRecipe('recipe_crush_iron_ore');

    // Doğru girdi
    assert.equal(crusher.canAcceptInput('iron_ore', 1), true);

    // Yanlış girdi (farklı maden)
    assert.equal(crusher.canAcceptInput('copper_ore', 1), false);
    // Tamamen alakasız eşya
    assert.equal(crusher.canAcceptInput('metal_gear', 1), false);

    // Kapasite sınırını test et (Crusher inputBufferCapacity = 5)
    for (let i = 0; i < 5; i++) {
      assert.equal(crusher.addInput('iron_ore', 1), true);
    }
    assert.equal(crusher.getInputCount('iron_ore'), 5);

    // 6. eşya kapasite aşımı nedeniyle reddedilmeli
    assert.equal(crusher.canAcceptInput('iron_ore', 1), false);
    assert.equal(crusher.addInput('iron_ore', 1), false);

    // Reçete değiştirilince eski girdi reddedilmeli, yenisi kabul edilmeli
    crusher.setRecipe('recipe_crush_copper_ore');
    assert.equal(crusher.canAcceptInput('copper_ore', 1), true);
    assert.equal(crusher.canAcceptInput('iron_ore', 1), false);
  });

  it('Unsupported recipe should throw error on setRecipe', () => {
    const crusher = new MachineEntity('m_crush_4', crusherDef, { x: 0, y: 0 });
    assert.throws(() => {
      crusher.setRecipe('recipe_assemble_small_engine');
    }, /desteklemiyor/);
  });

  it('Input consumption and output production cycle should work correctly', () => {
    const cutter = new MachineEntity('m_cut_1', cutterDef, { x: 1, y: 1 });
    cutter.setRecipe('recipe_cut_steel_gear');
    // Reçete: 1 iron_plate -> 1 steel_gear + 1 metal_scrap

    assert.equal(cutter.hasRecipeInputs(), false);

    cutter.addInput('iron_plate', 1);
    assert.equal(cutter.hasRecipeInputs(), true);
    assert.equal(cutter.canAcceptRecipeOutputs(), true);

    // Girdiyi tüket
    const consumed = cutter.consumeRecipeInputs();
    assert.equal(consumed, true);
    assert.equal(cutter.getInputCount('iron_plate'), 0);
    assert.equal(cutter.hasRecipeInputs(), false);

    // Çıktıları üret
    const produced = cutter.produceRecipeOutputs();
    assert.equal(produced, true);
    assert.equal(cutter.getOutputCount('steel_gear'), 1);
    assert.equal(cutter.getOutputCount('metal_scrap'), 1);
    assert.equal(cutter.getOutputTotalCount(), 2);

    // Çıktıları çek (pop)
    assert.equal(cutter.popOutput('steel_gear'), true);
    assert.equal(cutter.getOutputCount('steel_gear'), 0);

    const anyItem = cutter.popAnyOutput();
    assert.ok(anyItem);
    assert.equal(anyItem?.itemId, 'metal_scrap');
    assert.equal(cutter.getOutputTotalCount(), 0);
  });

  it('Serialization and deserialization should preserve machine state 100%', () => {
    const crusher = new MachineEntity('m_crush_save', crusherDef, { x: 7, y: 9 }, 90);
    crusher.setRecipe('recipe_crush_iron_ore');
    assert.equal(crusher.addInput('iron_ore', 3), true);
    assert.equal(crusher.addOutput('iron_powder', 2), true);
    crusher.status = 'PROCESSING';
    crusher.progressSec = 1.25;

    const state = crusher.serialize();
    assert.equal(state.instanceId, 'm_crush_save');
    assert.equal(state.defId, 'crusher');
    assert.deepEqual(state.coord, { x: 7, y: 9 });
    assert.equal(state.rotation, 90);
    assert.equal(state.status, 'PROCESSING');
    assert.equal(state.progressSec, 1.25);
    assert.equal(state.inputBuffer['iron_ore'], 3);
    assert.equal(state.outputBuffer['iron_powder'], 2);

    // Geri yükle
    const restored = MachineEntity.deserialize(state, crusherDef);
    assert.equal(restored.instanceId, 'm_crush_save');
    assert.equal(restored.rotation, 90);
    assert.equal(restored.status, 'PROCESSING');
    assert.equal(restored.progressSec, 1.25);
    assert.equal(restored.getInputCount('iron_ore'), 3);
    assert.equal(restored.getOutputCount('iron_powder'), 2);
  });
});
