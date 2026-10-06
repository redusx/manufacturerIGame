/* ======================================================================
 * src/factory/progression/MilestoneManager.test.ts
 *
 * 10 aşamalı fabrika kilometre taşları birim testleri.
 * Node 24 native test koşucusu ile çalışır; Phaser bağımlılığı yoktur.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MilestoneManager, DEFAULT_MILESTONES } from './MilestoneManager.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';
import { MachineEntity } from '../simulation/MachineEntity.ts';
import { defaultMachineRegistry } from '../simulation/MachineRegistry.ts';

describe('MilestoneManager Headless Progression Tests', () => {
  it('Should initialize with 10 milestones and first active milestone', () => {
    const manager = new MilestoneManager();
    assert.strictEqual(manager.totalCount, 10);
    assert.strictEqual(manager.completedCount, 0);
    assert.strictEqual(manager.isAllCompleted, false);

    const first = manager.getCurrentMilestone();
    assert.ok(first);
    assert.strictEqual(first.id, 'milestone_01_first_ore');
    assert.strictEqual(first.category, 'ATELIER');

    // Default unlocks
    assert.strictEqual(manager.isMachineUnlocked('crusher'), true);
    assert.strictEqual(manager.isMachineUnlocked('smelter'), false);
    assert.strictEqual(manager.isFeatureUnlocked('ROCKET_HANGAR'), false);
  });

  it('Should accurately evaluate condition progress for cash earnings and exports', () => {
    const manager = new MilestoneManager();
    const economy = new FactoryEconomy(0);

    // Initial milestone requires $50 total earned
    const initialProgress = manager.getCurrentProgress(economy);
    assert.ok(initialProgress);
    assert.strictEqual(initialProgress.isAllConditionsMet, false);
    assert.strictEqual(initialProgress.overallPercentage, 0);
    assert.strictEqual(manager.canClaimCurrentMilestone(economy), false);

    // Earn $25 (50% progress)
    economy.addMoney(25, 'CLICK');
    const midProgress = manager.getCurrentProgress(economy);
    assert.ok(midProgress);
    assert.strictEqual(midProgress.isAllConditionsMet, false);
    assert.strictEqual(midProgress.overallPercentage, 0.5);

    // Earn $25 more (100% progress)
    economy.addMoney(25, 'CLICK');
    const readyProgress = manager.getCurrentProgress(economy);
    assert.ok(readyProgress);
    assert.strictEqual(readyProgress.isAllConditionsMet, true);
    assert.strictEqual(readyProgress.overallPercentage, 1.0);
    assert.strictEqual(manager.canClaimCurrentMilestone(economy), true);
  });

  it('Should claim milestone, award money, unlock machines and advance to next milestone', () => {
    const manager = new MilestoneManager();
    const economy = new FactoryEconomy(0);

    // 1. Complete Milestone 1 ($50 earned)
    economy.addMoney(50, 'CLICK');
    const claim1 = manager.claimCurrentMilestone(economy);
    assert.strictEqual(claim1.success, true);
    assert.strictEqual(claim1.claimedMilestone?.id, 'milestone_01_first_ore');
    assert.strictEqual(economy.money, 50 + 100); // $50 + $100 reward
    assert.strictEqual(manager.completedCount, 1);
    assert.strictEqual(manager.isMilestoneCompleted('milestone_01_first_ore'), true);

    // 2. Active milestone should now be Milestone 2 (60 iron_powder)
    const m2 = manager.getCurrentMilestone();
    assert.ok(m2);
    assert.strictEqual(m2.id, 'milestone_02_crushed_powder');
    assert.strictEqual(manager.isMachineUnlocked('smelter'), false);

    // Record export of 30 iron_powder (50%)
    manager.recordExport('iron_powder', 30);
    assert.strictEqual(manager.canClaimCurrentMilestone(economy), false);

    // Record export of 30 more (100%)
    manager.recordExport('iron_powder', 30);
    assert.strictEqual(manager.canClaimCurrentMilestone(economy), true);

    // Claim Milestone 2 -> Should unlock smelter!
    const claim2 = manager.claimCurrentMilestone(economy);
    assert.strictEqual(claim2.success, true);
    assert.strictEqual(manager.isMachineUnlocked('smelter'), true);
    assert.strictEqual(economy.money, 50 + 100 + 150); // $50 + $100 (m1) + $150 (m2)
  });

  it('Should enforce plot unlock condition for Milestone 4', () => {
    const manager = new MilestoneManager();
    const economy = new FactoryEconomy(5000);

    // Fast-forward to Milestone 4 (index 3)
    // m1: $50
    manager.claimCurrentMilestone(economy);
    // m2: 60 iron_powder
    manager.recordExport('iron_powder', 60);
    manager.claimCurrentMilestone(economy);
    // m3: 30 iron_ingot
    manager.recordExport('iron_ingot', 30);
    manager.claimCurrentMilestone(economy);

    // Now at Milestone 4: 'milestone_04_foundry_expansion'
    const m4 = manager.getCurrentMilestone();
    assert.ok(m4);
    assert.strictEqual(m4.id, 'milestone_04_foundry_expansion');

    // Total earned > 600 is met (economy has 5000), but Plot 1 is not unlocked yet
    assert.strictEqual(manager.canClaimCurrentMilestone(economy), false);

    // Unlock Plot 1 ($500)
    economy.unlockPlot(1);
    assert.strictEqual(economy.isPlotUnlocked(1), true);

    // Now conditions are satisfied!
    assert.strictEqual(manager.canClaimCurrentMilestone(economy), true);
    const claim4 = manager.claimCurrentMilestone(economy);
    assert.strictEqual(claim4.success, true);
    assert.strictEqual(manager.isMachineUnlocked('press'), true);
  });

  it('Milestone 6 should unlock ROCKET_HANGAR feature', () => {
    const manager = new MilestoneManager();
    const economy = new FactoryEconomy(20000);

    // Fast-forward to Milestone 6 (index 5)
    for (let i = 0; i < 5; i++) {
      manager.recordExport('iron_powder', 100);
      manager.recordExport('iron_ingot', 100);
      manager.recordExport('iron_plate', 100);
      economy.unlockPlot(1);
      manager.claimCurrentMilestone(economy);
    }

    const m6 = manager.getCurrentMilestone();
    assert.ok(m6);
    assert.strictEqual(m6.id, 'milestone_06_gears_and_hangar');
    assert.strictEqual(manager.isFeatureUnlocked('ROCKET_HANGAR'), false);

    // Meet conditions: 40 steel_gear + $2500 earned
    manager.recordExport('steel_gear', 40);
    assert.strictEqual(manager.canClaimCurrentMilestone(economy), true);

    manager.claimCurrentMilestone(economy);
    assert.strictEqual(manager.isFeatureUnlocked('ROCKET_HANGAR'), true);
  });

  it('Milestone 10 should award final rewards, multiplier bonus and mark all completed', () => {
    const manager = new MilestoneManager();
    const economy = new FactoryEconomy(100000);

    // Advance through all 9 previous milestones
    for (let i = 0; i < 9; i++) {
      manager.recordExport('iron_powder', 100);
      manager.recordExport('iron_ingot', 100);
      manager.recordExport('iron_plate', 100);
      manager.recordExport('steel_gear', 100);
      manager.recordExport('copper_wire', 100);
      manager.recordExport('electric_motor', 100);
      manager.recordExport('reinforced_frame', 100);
      economy.unlockPlot(1);
      economy.unlockPlot(2);
      economy.unlockPlot(3);
      manager.claimCurrentMilestone(economy);
    }

    const m10 = manager.getCurrentMilestone();
    assert.ok(m10);
    assert.strictEqual(m10.id, 'milestone_10_orbital_complex');

    // Unlock Mega Plot 4 + export 10 thruster blocks
    economy.unlockPlot(4);
    manager.recordExport('rocket_thruster_block', 10);
    assert.strictEqual(manager.canClaimCurrentMilestone(economy), true);

    const multBefore = economy.revenueMultiplier;
    const claim10 = manager.claimCurrentMilestone(economy);
    assert.strictEqual(claim10.success, true);
    assert.strictEqual(manager.isFeatureUnlocked('ORBITAL_MASTERY'), true);
    assert.strictEqual(economy.revenueMultiplier, multBefore + 0.5);

    // Now all 10 are completed
    assert.strictEqual(manager.completedCount, 10);
    assert.strictEqual(manager.isAllCompleted, true);
    assert.strictEqual(manager.getCurrentMilestone(), null);

    // Attempting to claim again should safely fail
    const overClaim = manager.claimCurrentMilestone(economy);
    assert.strictEqual(overClaim.success, false);
  });

  it('Serialization and deserialization should preserve exact milestone state', () => {
    const manager1 = new MilestoneManager();
    const economy = new FactoryEconomy(1000);

    economy.addMoney(50, 'CLICK');
    manager1.claimCurrentMilestone(economy);
    manager1.recordExport('iron_powder', 14);

    const serialized = manager1.serialize();

    const manager2 = new MilestoneManager();
    manager2.deserialize(serialized);

    assert.strictEqual(manager2.completedCount, 1);
    assert.strictEqual(manager2.isMilestoneCompleted('milestone_01_first_ore'), true);
    assert.strictEqual(manager2.getCurrentMilestone()?.id, 'milestone_02_crushed_powder');
    assert.strictEqual(manager2.getExportedCount('iron_powder'), 14);
    assert.strictEqual(manager2.isMachineUnlocked('crusher'), true);
  });
});
