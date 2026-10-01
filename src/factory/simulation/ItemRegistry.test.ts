/* ======================================================================
 * src/factory/simulation/ItemRegistry.test.ts — Eşya Kataloğu Birim Testi
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ItemRegistry, defaultItemRegistry } from './ItemRegistry.ts';

describe('ItemRegistry', () => {
  it('defaultItemRegistry should have pre-registered multi-tier items', () => {
    assert.ok(defaultItemRegistry.count >= 15);
    assert.equal(defaultItemRegistry.has('iron_ore'), true);
    assert.equal(defaultItemRegistry.has('iron_ingot'), true);
    assert.equal(defaultItemRegistry.has('electric_motor'), true);
    assert.equal(defaultItemRegistry.has('guidance_computer'), true);
  });

  it('get() should return matching item definition', () => {
    const item = defaultItemRegistry.get('iron_ore');
    assert.ok(item !== undefined);
    assert.equal(item.name, 'Demir Cevheri');
    assert.equal(item.tier, 0);
    assert.equal(item.baseValue, 1);
  });

  it('getOrThrow() should throw on unknown item ID', () => {
    assert.throws(
      () => defaultItemRegistry.getOrThrow('non_existent_item_xyz'),
      /Tanımsız eşya ID: non_existent_item_xyz/,
    );
  });

  it('getByTier() should correctly categorize items across all tiers (0 to 4)', () => {
    const tier0 = defaultItemRegistry.getByTier(0);
    const tier1 = defaultItemRegistry.getByTier(1);
    const tier2 = defaultItemRegistry.getByTier(2);
    const tier3 = defaultItemRegistry.getByTier(3);
    const tier4 = defaultItemRegistry.getByTier(4);

    assert.ok(tier0.length >= 3, 'Tier 0 should have raw resources');
    assert.ok(tier1.length >= 4, 'Tier 1 should have processed ingots/powders');
    assert.ok(tier2.length >= 3, 'Tier 2 should have intermediate components');
    assert.ok(tier3.length >= 3, 'Tier 3 should have advanced modules');
    assert.ok(tier4.length >= 2, 'Tier 4 should have aerospace deliverables');

    // Her kategorinin tier alanı doğrulanmalı
    for (const item of tier0) assert.equal(item.tier, 0);
    for (const item of tier4) assert.equal(item.tier, 4);
  });

  it('Higher tier items should have strictly higher average values than tier 0', () => {
    const tier0 = defaultItemRegistry.getByTier(0);
    const tier4 = defaultItemRegistry.getByTier(4);

    const avgTier0 = tier0.reduce((acc, it) => acc + it.baseValue, 0) / tier0.length;
    const avgTier4 = tier4.reduce((acc, it) => acc + it.baseValue, 0) / tier4.length;

    assert.ok(avgTier4 > avgTier0 * 50, 'Aerospace tier 4 items must be worth 50x+ more than raw ore');
  });

  it('register() should reject duplicate IDs', () => {
    const customRegistry = new ItemRegistry();
    assert.throws(
      () =>
        customRegistry.register({
          id: 'iron_ore',
          name: 'Kopya',
          tier: 0,
          baseValue: 1,
          spriteKey: 'pickup_gear',
        }),
      /Eşya zaten kayıtlı: iron_ore/,
    );
  });

  it('Custom registry should allow registering new modded items', () => {
    const registry = new ItemRegistry();
    registry.register({
      id: 'alien_artifact',
      name: 'Uzaylı Yapıtı',
      tier: 4,
      baseValue: 9999,
      spriteKey: 'pickup_crystal',
    });

    assert.equal(registry.has('alien_artifact'), true);
    assert.equal(registry.getOrThrow('alien_artifact').baseValue, 9999);
  });
});
