/* ======================================================================
 * src/factory/input/ClickCollectMath.test.ts — Tıkla & Topla Birim Testleri
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ClickCollectMath,
  ClickComboTracker,
} from './ClickCollectMath.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { defaultItemRegistry } from '../simulation/ItemRegistry.ts';

describe('ClickComboTracker Rate Limiting & Streak Bonuses', () => {
  it('Should register normal clicks and increment combo count', () => {
    const tracker = new ClickComboTracker(40, 900);
    assert.equal(tracker.comboCount, 0);

    const r1 = tracker.registerClick(100);
    assert.equal(r1.allowed, true);
    assert.equal(r1.comboCount, 1);
    assert.equal(r1.comboBonus, 1.0);

    const r2 = tracker.registerClick(200);
    assert.equal(r2.allowed, true);
    assert.equal(r2.comboCount, 2);
  });

  it('Should reject clicks that violate minIntervalMs (anti-spam)', () => {
    const tracker = new ClickComboTracker(50, 900);
    tracker.registerClick(100);

    // 20ms sonra gelen tık reddedilmeli
    const spam = tracker.registerClick(120);
    assert.equal(spam.allowed, false);
    assert.equal(spam.comboCount, 1);

    // 60ms sonra gelen tık kabul edilmeli
    const ok = tracker.registerClick(160);
    assert.equal(ok.allowed, true);
    assert.equal(ok.comboCount, 2);
  });

  it('Should reset combo streak after resetWindowMs inactivity', () => {
    const tracker = new ClickComboTracker(40, 500);
    tracker.registerClick(100);
    tracker.registerClick(200);
    assert.equal(tracker.comboCount, 2);

    // 1000ms sonra gelen tık seriyi 1'e sıfırlamalı
    const res = tracker.registerClick(1200);
    assert.equal(res.allowed, true);
    assert.equal(res.comboCount, 1);
  });

  it('Should scale combo bonus correctly at tiers (10, 20, 30...)', () => {
    const tracker = new ClickComboTracker(0, 5000);
    for (let i = 1; i <= 9; i++) {
      tracker.registerClick(i * 10);
    }
    assert.equal(tracker.computeBonus(tracker.comboCount), 1.0);

    // 10. tık
    const t10 = tracker.registerClick(100);
    assert.equal(t10.comboBonus, 1.1);

    // 20. tık
    for (let i = 11; i <= 20; i++) {
      tracker.registerClick(i * 100);
    }
    assert.equal(tracker.computeBonus(tracker.comboCount), 1.2);
  });
});

describe('ClickCollectMath Grid Interaction Logic', () => {
  it('Should reject out-of-bounds clicks with type NONE', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const economy = new FactoryEconomy(0);

    const result = ClickCollectMath.handleClick({
      worldX: -50,
      worldY: 100,
      grid,
      logistics,
      economy,
    });

    assert.equal(result.type, 'NONE');
    assert.equal(result.success, false);
    assert.equal(result.earnedMoney, 0);
  });

  it('Should award floor click income on EMPTY tiles', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const economy = new FactoryEconomy(10);

    const initialMoney = economy.money;
    const result = ClickCollectMath.handleClick({
      worldX: 32 * 2 + 16, // tile (2, 2)
      worldY: 32 * 2 + 16,
      grid,
      logistics,
      economy,
    });

    assert.equal(result.type, 'FLOOR_CLICK');
    assert.equal(result.success, true);
    assert.ok(result.earnedMoney >= 1);
    assert.equal(economy.money, initialMoney + result.earnedMoney);
    assert.ok(result.text.includes('$'));
  });

  it('Should handle INTAKE clicks: spawn item on connected belt and reward cash', () => {
    const grid = new GridMap(8, 8);
    grid.setIntake(1, 1, 'iron_ore');
    const logistics = new LogisticsNetwork(grid);
    // (2, 1)'e doğuya bakan bir konveyör koy
    const belt = logistics.addConveyor({ x: 2, y: 1 }, 'EAST');
    const economy = new FactoryEconomy(0);

    assert.equal(belt.itemCount, 0);

    const result = ClickCollectMath.handleClick({
      worldX: 1 * 32 + 16,
      worldY: 1 * 32 + 16,
      grid,
      logistics,
      economy,
    });

    assert.equal(result.type, 'INTAKE');
    assert.equal(result.success, true);
    assert.equal(result.spawnedOnBelt, true);
    assert.equal(belt.itemCount, 1);
    assert.equal(belt.getItems()[0].itemId, 'iron_ore');
    assert.ok(result.earnedMoney >= 1);
    assert.equal(economy.money, result.earnedMoney);
  });

  it('Should harvest item from CONVEYOR on click, rewarding market value', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const belt = logistics.addConveyor({ x: 3, y: 3 }, 'EAST');
    const economy = new FactoryEconomy(0);

    // Banda bir 'iron_plate' koy (baseValue = 5)
    belt.acceptItem('iron_plate', 0.2);
    assert.equal(belt.itemCount, 1);

    const result = ClickCollectMath.handleClick({
      worldX: 3 * 32 + 16,
      worldY: 3 * 32 + 16,
      grid,
      logistics,
      economy,
      itemRegistry: defaultItemRegistry,
    });

    assert.equal(result.type, 'CONVEYOR_ITEM');
    assert.equal(result.success, true);
    assert.equal(result.itemId, 'iron_plate');
    assert.equal(belt.itemCount, 0, 'Item should be removed from belt on harvest');

    const expectedPlateValue = defaultItemRegistry.get('iron_plate')!.baseValue; // 5
    assert.equal(result.earnedMoney, expectedPlateValue);
    assert.equal(economy.money, expectedPlateValue);
    assert.equal(result.text, `+$${expectedPlateValue} ⚙`);
  });

  it('Clicking a MACHINE cell should return MACHINE type with instanceId', () => {
    const grid = new GridMap(8, 8);
    grid.placeMachine('crusher_1', 2, 2, 1, 1);
    const logistics = new LogisticsNetwork(grid);
    const economy = new FactoryEconomy(0);

    const result = ClickCollectMath.handleClick({
      worldX: 2 * 32 + 16,
      worldY: 2 * 32 + 16,
      grid,
      logistics,
      economy,
    });

    assert.equal(result.type, 'MACHINE');
    assert.equal(result.success, true);
    assert.equal(result.machineInstanceId, 'crusher_1');
    assert.equal(result.earnedMoney, 0);
  });

  it('Should compute accurate floating text motion parameters', () => {
    const motion = ClickCollectMath.computeFloatingTextMotion(100, 30, 600);
    assert.equal(motion.targetY, 70);
    assert.equal(motion.durationMs, 600);
    assert.equal(motion.initialAlpha, 1.0);
    assert.equal(motion.finalAlpha, 0.0);
  });
});
