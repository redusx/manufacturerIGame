/* ======================================================================
 * src/factory/progression/ContractManager.test.ts
 *
 * Hızlı Yan Siparişler Yöneticisi (ContractManager) birim testleri.
 * Node 24 native test koşucusu ile çalışır; Phaser bağımlılığı yoktur.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  ContractManager,
  CONTRACT_TEMPLATES,
  type QuickContract,
} from './ContractManager.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { defaultItemRegistry } from '../simulation/ItemRegistry.ts';

describe('ContractManager Progression & Delivery Tests', () => {
  it('Should initialize with empty contracts and respect capacity limits', () => {
    const manager = new ContractManager(defaultItemRegistry, CONTRACT_TEMPLATES, 3, 2);

    assert.strictEqual(manager.maxAvailableContracts, 3);
    assert.strictEqual(manager.maxActiveContracts, 2);
    assert.strictEqual(manager.getAvailableContracts().length, 0);
    assert.strictEqual(manager.getActiveContracts().length, 0);
    assert.strictEqual(manager.completedCount, 0);
    assert.strictEqual(manager.cumulativeRewards, 0);
    assert.strictEqual(manager.canAcceptMore, true);

    // Refresh fills available offers up to 3 for Tier 1
    manager.refreshAvailableContracts(1);
    const available = manager.getAvailableContracts();
    assert.strictEqual(available.length, 3);
    assert.ok(available.every((c) => c.tier <= 1));
    assert.ok(available.every((c) => c.status === 'AVAILABLE'));
    assert.ok(available.every((c) => c.currentCount === 0));
    assert.ok(available.every((c) => c.remainingSec === c.timeLimitSec));
  });

  it('Should accept available contracts and enforce maximum active capacity', () => {
    const manager = new ContractManager(defaultItemRegistry, CONTRACT_TEMPLATES, 3, 2);
    manager.refreshAvailableContracts(1);

    const available = manager.getAvailableContracts();
    const firstId = available[0].id;
    const secondId = available[1].id;
    const thirdId = available[2].id;

    let acceptedEvents: string[] = [];
    manager.onContractAccepted = (c) => acceptedEvents.push(c.id);

    // Accept first contract
    const ok1 = manager.acceptContract(firstId);
    assert.strictEqual(ok1, true);
    assert.strictEqual(manager.getActiveContracts().length, 1);
    assert.strictEqual(manager.getAvailableContracts().length, 2);
    assert.strictEqual(manager.getActiveContracts()[0].id, firstId);
    assert.strictEqual(manager.getActiveContracts()[0].status, 'ACTIVE');
    assert.strictEqual(manager.canAcceptMore, true);

    // Accept second contract
    const ok2 = manager.acceptContract(secondId);
    assert.strictEqual(ok2, true);
    assert.strictEqual(manager.getActiveContracts().length, 2);
    assert.strictEqual(manager.getAvailableContracts().length, 1);
    assert.strictEqual(manager.canAcceptMore, false); // Capacity reached!

    // Attempting to accept a 3rd contract must be rejected
    const ok3 = manager.acceptContract(thirdId);
    assert.strictEqual(ok3, false);
    assert.strictEqual(manager.getActiveContracts().length, 2);

    // Attempting to accept a non-existent contract must return false
    assert.strictEqual(manager.acceptContract('invalid_id'), false);

    assert.deepStrictEqual(acceptedEvents, [firstId, secondId]);
  });

  it('Should decline available contracts and abandon active contracts cleanly', () => {
    const manager = new ContractManager();
    manager.refreshAvailableContracts(1);

    const available = manager.getAvailableContracts();
    const declineId = available[0].id;
    const acceptId = available[1].id;

    // Decline first offer
    assert.strictEqual(manager.declineContract(declineId), true);
    assert.strictEqual(manager.getAvailableContracts().length, 2);
    assert.strictEqual(manager.findContract(declineId), undefined);

    // Decline invalid returns false
    assert.strictEqual(manager.declineContract('unknown'), false);

    // Accept second offer then abandon it
    manager.acceptContract(acceptId);
    assert.strictEqual(manager.getActiveContracts().length, 1);

    let failedEvent: string | null = null;
    manager.onContractFailed = (c) => (failedEvent = c.id);

    assert.strictEqual(manager.abandonContract(acceptId), true);
    assert.strictEqual(manager.getActiveContracts().length, 0);
    assert.strictEqual(manager.canAcceptMore, true);
    assert.strictEqual(failedEvent, acceptId);

    // Abandon invalid returns false
    assert.strictEqual(manager.abandonContract('unknown'), false);
  });

  it('Should track item deliveries, fulfill quotas and disburse rewards to economy', () => {
    const manager = new ContractManager();
    const economy = new FactoryEconomy(100);

    // Force create a contract for copper_ingot (count: 10, reward: 140)
    const customContract = manager.generateContract(1, false, 'tmpl_copper_ingot');
    assert.ok(customContract);

    // Inject into available and accept
    (manager as any).availableContracts.push(customContract);
    manager.acceptContract(customContract.id);

    let completedContract: QuickContract | null = null;
    manager.onContractCompleted = (c) => (completedContract = c);

    // Export unrelated item (iron_powder): contract should ignore it
    const resUnrelated = manager.recordExport('iron_powder', 5, economy);
    assert.strictEqual(resUnrelated.length, 0);
    assert.strictEqual(economy.money, 100);

    // Deliver 4 copper_ingot (partial delivery)
    const resPartial = manager.recordExport('copper_ingot', 4, economy);
    assert.strictEqual(resPartial.length, 1);
    assert.strictEqual(resPartial[0].delivered, 4);
    assert.strictEqual(resPartial[0].currentCount, 4);
    assert.strictEqual(resPartial[0].completed, false);
    assert.strictEqual(resPartial[0].rewardEarned, 0);
    assert.strictEqual(economy.money, 100);
    assert.strictEqual(manager.getActiveContracts().length, 1);

    // Deliver 8 copper_ingot (needed is 6, excess 2 remains unused)
    const resComplete = manager.recordExport('copper_ingot', 8, economy);
    assert.strictEqual(resComplete.length, 1);
    assert.strictEqual(resComplete[0].delivered, 6);
    assert.strictEqual(resComplete[0].currentCount, 10);
    assert.strictEqual(resComplete[0].completed, true);
    assert.strictEqual(resComplete[0].rewardEarned, 140);

    // Economy received contract reward
    assert.strictEqual(economy.money, 240); // 100 + 140
    assert.strictEqual(manager.completedCount, 1);
    assert.strictEqual(manager.cumulativeRewards, 140);
    assert.strictEqual(manager.getActiveContracts().length, 0);
    assert.strictEqual(manager.getCompletedContractIds().includes(customContract.id), true);
    assert.strictEqual(completedContract?.id, customContract.id);
  });

  it('Should handle contract countdown timer and expire overdue contracts', () => {
    const manager = new ContractManager();
    const contract = manager.generateContract(1, false, 'tmpl_iron_powder');
    assert.ok(contract);
    contract.timeLimitSec = 60;
    contract.remainingSec = 60;

    (manager as any).availableContracts.push(contract);
    manager.acceptContract(contract.id);

    let failedId: string | null = null;
    manager.onContractFailed = (c) => (failedId = c.id);

    // Step 20 seconds forward
    const step1 = manager.update(20);
    assert.strictEqual(step1.failedActive.length, 0);
    assert.strictEqual(manager.getActiveContracts()[0].remainingSec, 40);

    // Step 39 seconds forward (1 second remaining)
    const step2 = manager.update(39);
    assert.strictEqual(step2.failedActive.length, 0);
    assert.strictEqual(manager.getActiveContracts()[0].remainingSec, 1);

    // Step 2 seconds forward -> contract expires
    const step3 = manager.update(2);
    assert.strictEqual(step3.failedActive.length, 1);
    assert.strictEqual(step3.failedActive[0], contract.id);
    assert.strictEqual(failedId, contract.id);
    assert.strictEqual(manager.getActiveContracts().length, 0);
  });

  it('Should generate urgent contracts with multiplied rewards and shorter duration', () => {
    const manager = new ContractManager();

    const normal = manager.generateContract(4, false, 'tmpl_rocket_thruster');
    const urgent = manager.generateContract(4, true, 'tmpl_rocket_thruster');

    assert.ok(normal);
    assert.ok(urgent);

    assert.strictEqual(normal.isUrgent, false);
    assert.strictEqual(urgent.isUrgent, true);
    assert.ok(urgent.title.startsWith('[ACİL]'));

    // Urgent reward is 1.5x base reward
    assert.strictEqual(urgent.rewardCash, Math.round(normal.rewardCash * 1.5));
    // Urgent duration is shorter
    assert.ok(urgent.timeLimitSec < normal.timeLimitSec);
  });

  it('Should accurately format time and progress metrics in static helpers', () => {
    assert.strictEqual(ContractManager.formatRemainingTime(125), '02:05');
    assert.strictEqual(ContractManager.formatRemainingTime(9), '00:09');
    assert.strictEqual(ContractManager.formatRemainingTime(0), '00:00');
    assert.strictEqual(ContractManager.formatRemainingTime(-5), '00:00');

    // Time colors
    assert.strictEqual(ContractManager.getTimeColor(15), '#e74c3c'); // Critical red
    assert.strictEqual(ContractManager.getTimeColor(45), '#f39c12'); // Warning orange
    assert.strictEqual(ContractManager.getTimeColor(90), '#ecf0f1'); // Normal white

    // Progress ratio
    const dummyContract: any = { currentCount: 5, requiredCount: 20 };
    assert.strictEqual(ContractManager.getProgressRatio(dummyContract), 0.25);
    dummyContract.currentCount = 20;
    assert.strictEqual(ContractManager.getProgressRatio(dummyContract), 1.0);
  });

  it('Should serialize and deserialize contract state without data loss', () => {
    const manager1 = new ContractManager();
    manager1.refreshAvailableContracts(2);

    const first = manager1.getAvailableContracts()[0];
    manager1.acceptContract(first.id);

    // Partially deliver items
    manager1.recordExport(first.requiredItemId, 2);

    const savedState = manager1.serialize();
    assert.ok(savedState.active.length === 1);
    assert.ok(savedState.available.length === 2);

    // Create fresh manager and restore
    const manager2 = new ContractManager();
    manager2.deserialize(savedState);

    assert.strictEqual(manager2.getActiveContracts().length, 1);
    assert.strictEqual(manager2.getAvailableContracts().length, 2);
    assert.strictEqual(manager2.getActiveContracts()[0].id, first.id);
    assert.strictEqual(manager2.getActiveContracts()[0].currentCount, 2);
  });
});
