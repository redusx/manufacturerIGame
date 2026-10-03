/* ======================================================================
 * src/factory/view/MilestoneHUDHelper.test.ts
 *
 * MilestoneHUDHelper saf matematik ve ViewModel testleri.
 * Node 24 native test koşucusu ile çalışır; Phaser bağımlılığı yoktur.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MilestoneHUDHelper } from './MilestoneHUDHelper.ts';
import { MilestoneManager } from '../progression/MilestoneManager.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';

describe('MilestoneHUDHelper Headless Unit Tests', () => {
  it('getCategoryDisplayName should map all categories to Turkish names', () => {
    assert.strictEqual(MilestoneHUDHelper.getCategoryDisplayName('ATELIER'), 'ÇAĞ 1 (ATÖLYE)');
    assert.strictEqual(MilestoneHUDHelper.getCategoryDisplayName('FOUNDRY'), 'ÇAĞ 2 (DÖKÜMHANE)');
    assert.strictEqual(MilestoneHUDHelper.getCategoryDisplayName('WORKSHOP'), 'ÇAĞ 3 (İMALATHANE)');
    assert.strictEqual(MilestoneHUDHelper.getCategoryDisplayName('ASSEMBLY'), 'ÇAĞ 4 (MONTAJ)');
    assert.strictEqual(MilestoneHUDHelper.getCategoryDisplayName('AEROSPACE'), 'ÇAĞ 5 (HAVACILIK)');
  });

  it('formatStageBadge and formatMoney should produce pixel UI strings', () => {
    assert.strictEqual(
      MilestoneHUDHelper.formatStageBadge(0, 10, 'ATELIER'),
      'AŞAMA 1/10 • ÇAĞ 1 (ATÖLYE)',
    );
    assert.strictEqual(
      MilestoneHUDHelper.formatStageBadge(4, 10, 'WORKSHOP'),
      'AŞAMA 5/10 • ÇAĞ 3 (İMALATHANE)',
    );

    assert.strictEqual(MilestoneHUDHelper.formatMoney(50), '$50 ⚙');
    assert.strictEqual(MilestoneHUDHelper.formatMoney(25000), '$25.0k ⚙');
    assert.strictEqual(MilestoneHUDHelper.formatMoney(1500000), '$1.50M ⚙');
  });

  it('formatRewardSummary should combine cash, machines, and feature unlocks cleanly', () => {
    const r1 = MilestoneHUDHelper.formatRewardSummary({
      money: 150,
      unlockedMachines: ['crusher'],
      description: 'Default desc',
    });
    assert.strictEqual(r1, 'Ödül: +$150 ⚙, Kırıcı');

    const r2 = MilestoneHUDHelper.formatRewardSummary({
      money: 2000,
      unlockedFeatures: ['ROCKET_HANGAR'],
      description: 'Hangar',
    });
    assert.strictEqual(r2, 'Ödül: +$2000 ⚙, Roket Hangarı');

    const r3 = MilestoneHUDHelper.formatRewardSummary({
      money: 15000,
      revenueMultiplierBonus: 0.5,
      unlockedFeatures: ['ORBITAL_MASTERY'],
      description: 'Orbital mastery',
    });
    assert.strictEqual(r3, 'Ödül: +$15.0k ⚙, +50% Gelir, Yörünge Başarısı');
  });

  it('computePulseAlpha should oscillate within [minAlpha, maxAlpha]', () => {
    for (let t = 0; t <= 1.0; t += 0.1) {
      const alpha = MilestoneHUDHelper.computePulseAlpha(t, 0.55, 1.0, 2.0);
      assert.ok(alpha >= 0.549 && alpha <= 1.001, `Alpha out of bounds: ${alpha}`);
    }
  });

  it('getViewModel should return accurate view model across all milestone lifecycle states', () => {
    const manager = new MilestoneManager();
    const economy = new FactoryEconomy(0);

    // 1. Initial State (0% progress)
    const vm1 = MilestoneHUDHelper.getViewModel(manager, economy);
    assert.strictEqual(vm1.isActive, true);
    assert.strictEqual(vm1.isAllCompleted, false);
    assert.strictEqual(vm1.stageBadgeText, 'AŞAMA 1/10 • ÇAĞ 1 (ATÖLYE)');
    assert.strictEqual(vm1.titleText, 'İlk Hammadde');
    assert.strictEqual(vm1.progressRatio, 0.0);
    assert.strictEqual(vm1.progressPercentText, '%0');
    assert.strictEqual(vm1.canClaim, false);
    assert.strictEqual(vm1.claimButtonText, '%0');

    // 2. In-Progress State (50% progress)
    economy.addMoney(25, 'CLICK');
    const vm2 = MilestoneHUDHelper.getViewModel(manager, economy);
    assert.strictEqual(vm2.progressRatio, 0.5);
    assert.strictEqual(vm2.progressPercentText, '%50');
    assert.strictEqual(vm2.canClaim, false);

    // 3. Ready to Claim State (100% progress)
    economy.addMoney(25, 'CLICK');
    const vm3 = MilestoneHUDHelper.getViewModel(manager, economy);
    assert.strictEqual(vm3.progressRatio, 1.0);
    assert.strictEqual(vm3.canClaim, true);
    assert.strictEqual(vm3.claimButtonText, 'ÖDÜLÜ AL!');

    // 4. Claim and Advance to Milestone 2
    manager.claimCurrentMilestone(economy);
    const vm4 = MilestoneHUDHelper.getViewModel(manager, economy);
    assert.strictEqual(vm4.stageBadgeText, 'AŞAMA 2/10 • ÇAĞ 1 (ATÖLYE)');
    assert.strictEqual(vm4.titleText, 'Cevher Kırma');
    assert.strictEqual(vm4.canClaim, false);

    // 5. Fast-Forward All Milestones -> All Completed State
    for (let i = 0; i < 9; i++) {
      manager.recordExport('iron_powder', 100);
      manager.recordExport('iron_ingot', 100);
      manager.recordExport('iron_plate', 100);
      manager.recordExport('steel_gear', 100);
      manager.recordExport('copper_wire', 100);
      manager.recordExport('electric_motor', 100);
      manager.recordExport('reinforced_frame', 100);
      manager.recordExport('rocket_thruster_block', 100);
      economy.unlockPlot(1);
      economy.unlockPlot(2);
      economy.unlockPlot(3);
      economy.unlockPlot(4);
      economy.addMoney(50000, 'EXPORT');
      manager.claimCurrentMilestone(economy);
    }

    assert.strictEqual(manager.isAllCompleted, true);
    const vmFinal = MilestoneHUDHelper.getViewModel(manager, economy);
    assert.strictEqual(vmFinal.isAllCompleted, true);
    assert.strictEqual(vmFinal.progressRatio, 1.0);
    assert.strictEqual(vmFinal.canClaim, false);
    assert.strictEqual(vmFinal.claimButtonText, 'TAMAMLANDI');
  });
});
