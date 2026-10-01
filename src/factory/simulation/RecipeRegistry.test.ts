/* ======================================================================
 * src/factory/simulation/RecipeRegistry.test.ts — Reçete Kataloğu Birim Testi
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RecipeRegistry, defaultRecipeRegistry } from './RecipeRegistry.ts';
import { ItemRegistry, defaultItemRegistry } from './ItemRegistry.ts';

describe('RecipeRegistry', () => {
  it('defaultRecipeRegistry should validate successfully against defaultItemRegistry', () => {
    // Tüm varsayılan reçetelerin girdileri ve çıktıları gerçek eşyalara işaret etmelidir
    assert.doesNotThrow(() => {
      defaultRecipeRegistry.validateAgainst(defaultItemRegistry);
    });
    assert.ok(defaultRecipeRegistry.count >= 15);
  });

  it('getByCategory() should return recipes for all 6 core categories', () => {
    const crushing = defaultRecipeRegistry.getByCategory('crushing');
    const smelting = defaultRecipeRegistry.getByCategory('smelting');
    const pressing = defaultRecipeRegistry.getByCategory('pressing');
    const cutting = defaultRecipeRegistry.getByCategory('cutting');
    const refining = defaultRecipeRegistry.getByCategory('refining');
    const assembling = defaultRecipeRegistry.getByCategory('assembling');

    assert.ok(crushing.length >= 2, 'Should have crushing recipes');
    assert.ok(smelting.length >= 2, 'Should have smelting recipes');
    assert.ok(pressing.length >= 2, 'Should have pressing recipes');
    assert.ok(cutting.length >= 2, 'Should have cutting recipes');
    assert.ok(refining.length >= 2, 'Should have refining recipes');
    assert.ok(assembling.length >= 4, 'Should have multi-input assembling recipes');
  });

  it('Smelting must take longer than crushing (inherent rate mismatch / bottleneck design)', () => {
    const crush = defaultRecipeRegistry.getOrThrow('recipe_crush_iron_ore');
    const smelt = defaultRecipeRegistry.getOrThrow('recipe_smelt_iron_ingot');

    assert.ok(
      smelt.processingTimeSec > crush.processingTimeSec,
      'Smelting must take longer than crushing to create production bottlenecks',
    );
    assert.equal(smelt.processingTimeSec, 4.0);
    assert.equal(crush.processingTimeSec, 2.0);
  });

  it('Cutter recipe should produce primary gear and secondary metal_scrap byproduct', () => {
    const gearRecipe = defaultRecipeRegistry.getOrThrow('recipe_cut_steel_gear');
    assert.equal(gearRecipe.outputs.length, 2);
    assert.equal(gearRecipe.outputs[0].itemId, 'steel_gear');
    assert.equal(gearRecipe.outputs[1].itemId, 'metal_scrap');
  });

  it('getRecipesProducing() should locate all recipes that output a given item', () => {
    const recipes = defaultRecipeRegistry.getRecipesProducing('iron_plate');
    assert.equal(recipes.length, 1);
    assert.equal(recipes[0].id, 'recipe_press_iron_plate');
  });

  it('getRecipesConsuming() should locate all recipes that consume a given component', () => {
    const consumers = defaultRecipeRegistry.getRecipesConsuming('copper_wire');
    // Bakır tel: elektrik motoru ve mikroçipte kullanılır
    assert.ok(consumers.length >= 2);
    const ids = consumers.map((r) => r.id);
    assert.ok(ids.includes('recipe_assemble_electric_motor'));
    assert.ok(ids.includes('recipe_assemble_microchip'));
  });

  it('validateAgainst() should catch invalid item references in modded recipes', () => {
    const customRegistry = new RecipeRegistry();
    customRegistry.register({
      id: 'broken_recipe',
      name: 'Bozuk Reçete',
      category: 'crushing',
      inputs: [{ itemId: 'unobtainium_raw', count: 1 }],
      outputs: [{ itemId: 'iron_powder', count: 1 }],
      processingTimeSec: 1.0,
    });

    assert.throws(
      () => customRegistry.validateAgainst(defaultItemRegistry),
      /tanımsız girdi eşyasına referans veriyor: 'unobtainium_raw'/,
    );
  });
});
