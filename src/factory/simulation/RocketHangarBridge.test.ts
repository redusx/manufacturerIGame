/* ======================================================================
 * src/factory/simulation/RocketHangarBridge.test.ts
 *
 * Hangar Tedarik Köprüsü (RocketHangarBridge) birim testleri.
 * Node 24 native test koşucusu ile çalışır; Phaser bağımlılığı yoktur.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RocketHangarBridge } from './RocketHangarBridge.ts';
import { FactoryEconomy } from './FactoryEconomy.ts';
import { defaultItemRegistry } from './ItemRegistry.ts';

describe('RocketHangarBridge Headless Unit Tests', () => {
  it('Should initialize with Level 1 modules and empty inventory', () => {
    const bridge = new RocketHangarBridge(defaultItemRegistry);

    const levels = bridge.getAllModuleLevels();
    assert.deepStrictEqual(levels, {
      hull: 1,
      engine: 1,
      wings: 1,
      boost: 1,
    });

    assert.strictEqual(bridge.isReadyForLaunch(), true);
    assert.strictEqual(bridge.getPartCount('aero_hull_plate'), 0);
    assert.deepStrictEqual(bridge.getInventory(), {});

    const stats = bridge.getFlightStats();
    assert.strictEqual(stats.totalFlights, 0);
    assert.strictEqual(stats.bestDistance, 0);
    assert.strictEqual(stats.totalCashEarned, 0);
  });

  it('Should only accept designated aerospace parts and reject raw/unrelated materials', () => {
    const bridge = new RocketHangarBridge();

    // Verify valid aerospace parts
    assert.strictEqual(bridge.isAerospacePart('aero_hull_plate'), true);
    assert.strictEqual(bridge.isAerospacePart('rocket_thruster_block'), true);
    assert.strictEqual(bridge.isAerospacePart('guidance_computer'), true);
    assert.strictEqual(bridge.isAerospacePart('reinforced_frame'), true);
    assert.strictEqual(bridge.isAerospacePart('plastic_pellet'), true);

    // Verify non-aerospace raw materials
    assert.strictEqual(bridge.isAerospacePart('iron_ore'), false);
    assert.strictEqual(bridge.isAerospacePart('copper_ore'), false);
    assert.strictEqual(bridge.isAerospacePart('silica_sand'), false);

    let depositedItem: string | null = null;
    let depositedCount: number | null = null;
    bridge.onPartDeposited = (item, total) => {
      depositedItem = item;
      depositedCount = total;
    };

    // Attempt depositing raw ore -> must be rejected
    const resOre = bridge.depositPart('iron_ore', 10);
    assert.strictEqual(resOre, false);
    assert.strictEqual(bridge.getPartCount('iron_ore'), 0);
    assert.strictEqual(depositedItem, null);

    // Attempt depositing zero or negative -> must be rejected
    assert.strictEqual(bridge.depositPart('reinforced_frame', 0), false);
    assert.strictEqual(bridge.depositPart('reinforced_frame', -2), false);

    // Deposit valid aerospace parts
    const resHull1 = bridge.depositPart('reinforced_frame', 5);
    assert.strictEqual(resHull1, true);
    assert.strictEqual(bridge.getPartCount('reinforced_frame'), 5);
    assert.strictEqual(depositedItem, 'reinforced_frame');
    assert.strictEqual(depositedCount, 5);

    const resHull2 = bridge.depositPart('reinforced_frame', 3);
    assert.strictEqual(resHull2, true);
    assert.strictEqual(bridge.getPartCount('reinforced_frame'), 8);
    assert.strictEqual(depositedCount, 8);
  });

  it('Should accurately evaluate upgrade costs, affordabilities and module progressions', () => {
    const bridge = new RocketHangarBridge();
    const economy = new FactoryEconomy(200); // Has $200

    // Level 1 -> 2 Hull upgrade requires $500 + 5x reinforced_frame
    const cost1 = bridge.getUpgradeCost('hull');
    assert.ok(cost1);
    assert.strictEqual(cost1.targetLevel, 2);
    assert.strictEqual(cost1.cashCost, 500);
    assert.strictEqual(cost1.requiredParts.length, 1);
    assert.strictEqual(cost1.requiredParts[0].itemId, 'reinforced_frame');
    assert.strictEqual(cost1.requiredParts[0].count, 5);

    // Missing parts and missing cash -> unaffordable
    assert.strictEqual(bridge.canAffordUpgrade('hull', economy), false);
    assert.strictEqual(bridge.upgradeModule('hull', economy), false);

    // Add cash, still missing parts -> unaffordable
    economy.addMoney(1000, 'EXPORT'); // Total $1200
    assert.strictEqual(bridge.canAffordUpgrade('hull', economy), false);

    // Deposit parts: now affordable!
    bridge.depositPart('reinforced_frame', 5);
    assert.strictEqual(bridge.canAffordUpgrade('hull', economy), true);

    let upgradedCategory: string | null = null;
    let upgradedLevel: number | null = null;
    bridge.onModuleUpgraded = (cat, lvl) => {
      upgradedCategory = cat;
      upgradedLevel = lvl;
    };

    // Perform upgrade
    const success = bridge.upgradeModule('hull', economy);
    assert.strictEqual(success, true);
    assert.strictEqual(bridge.getModuleLevel('hull'), 2);
    assert.strictEqual(economy.money, 700); // 1200 - 500
    assert.strictEqual(bridge.getPartCount('reinforced_frame'), 0); // 5 consumed
    assert.strictEqual(upgradedCategory, 'hull');
    assert.strictEqual(upgradedLevel, 2);

    // Next upgrade is Level 2 -> 3 Hull ($2500 + 8x aero_hull_plate)
    const cost2 = bridge.getUpgradeCost('hull');
    assert.ok(cost2);
    assert.strictEqual(cost2.targetLevel, 3);
    assert.strictEqual(cost2.cashCost, 2500);
    assert.strictEqual(cost2.requiredParts[0].itemId, 'aero_hull_plate');
    assert.strictEqual(cost2.requiredParts[0].count, 8);

    // Upgrade to Level 3
    economy.addMoney(3000, 'EXPORT');
    bridge.depositPart('aero_hull_plate', 10);
    assert.strictEqual(bridge.canAffordUpgrade('hull', economy), true);
    assert.strictEqual(bridge.upgradeModule('hull', economy), true);
    assert.strictEqual(bridge.getModuleLevel('hull'), 3);
    assert.strictEqual(bridge.getPartCount('aero_hull_plate'), 2); // 10 - 8 = 2 left

    // Maximum level reached: no more upgrades
    assert.strictEqual(bridge.getUpgradeCost('hull'), null);
    assert.strictEqual(bridge.canAffordUpgrade('hull', economy), false);
    assert.strictEqual(bridge.upgradeModule('hull', economy), false);
  });

  it('Should support upgrading Engine, Wings and Boost modules', () => {
    const bridge = new RocketHangarBridge();
    const economy = new FactoryEconomy(50000);

    // Engine: 6 electric_motor + $750
    bridge.depositPart('electric_motor', 6);
    assert.strictEqual(bridge.upgradeModule('engine', economy), true);
    assert.strictEqual(bridge.getModuleLevel('engine'), 2);

    // Wings: 6 microchip + $600
    bridge.depositPart('microchip', 6);
    assert.strictEqual(bridge.upgradeModule('wings', economy), true);
    assert.strictEqual(bridge.getModuleLevel('wings'), 2);

    // Boost: 20 plastic_pellet + $400
    bridge.depositPart('plastic_pellet', 20);
    assert.strictEqual(bridge.upgradeModule('boost', economy), true);
    assert.strictEqual(bridge.getModuleLevel('boost'), 2);
  });

  it('Should process flight results, reward factory economy and update career stats', () => {
    const bridge = new RocketHangarBridge();
    const economy = new FactoryEconomy(0);

    let returnedSummary: any = null;
    bridge.onFlightReturned = (s) => (returnedSummary = s);

    // Flight 1: 1000m, 10 parts, 4 crystals, 5 dodges
    // distance: floor(1000 * 0.35) = 350
    // parts: 10 * 5 = 50
    // crystals: 4 * 15 = 60
    // dodges: 5 * 4 = 20
    // Total = 480
    const summary1 = bridge.processFlightResult(
      {
        distanceMeters: 1000,
        partsCollected: 10,
        crystalsCollected: 4,
        dodgedObstacles: 5,
      },
      economy,
    );

    assert.strictEqual(summary1.distanceMeters, 1000);
    assert.strictEqual(summary1.cashGained, 480);
    assert.strictEqual(summary1.isNewBestDistance, true);
    assert.strictEqual(summary1.totalFlights, 1);
    assert.strictEqual(summary1.bestDistance, 1000);
    assert.strictEqual(summary1.milestoneBonusMultiplier, 0.30); // 100m, 500m ve 1000m bonusu: 0.05 + 0.10 + 0.15
    assert.strictEqual(economy.revenueMultiplier, 1.30);
    assert.strictEqual(economy.money, 480);
    assert.strictEqual(returnedSummary?.cashGained, 480);

    // Flight 2: 600m (less than best)
    const summary2 = bridge.processFlightResult(
      {
        distanceMeters: 600,
        partsCollected: 2,
        crystalsCollected: 0,
      },
      economy,
    );

    assert.strictEqual(summary2.isNewBestDistance, false);
    assert.strictEqual(summary2.bestDistance, 1000);
    assert.strictEqual(summary2.totalFlights, 2);
    assert.strictEqual(summary2.milestoneBonusMultiplier, undefined);
    assert.strictEqual(economy.revenueMultiplier, 1.30); // çarpan korunur

    const stats = bridge.getFlightStats();
    assert.strictEqual(stats.totalFlights, 2);
    assert.strictEqual(stats.totalDistance, 1600);
    assert.strictEqual(stats.bestDistance, 1000);
  });

  it('Should cleanly serialize and deserialize hangar bridge state', () => {
    const bridge1 = new RocketHangarBridge();
    const economy = new FactoryEconomy(10000);

    bridge1.depositPart('reinforced_frame', 10);
    bridge1.depositPart('plastic_pellet', 30);
    bridge1.upgradeModule('hull', economy); // Level 2 hull

    bridge1.processFlightResult(
      { distanceMeters: 750, partsCollected: 5, crystalsCollected: 2 },
      economy,
    );

    const saved = bridge1.serialize();
    assert.strictEqual(saved.levels.hull, 2);
    assert.strictEqual(saved.inventory.reinforced_frame, 5); // 10 - 5 = 5
    assert.strictEqual(saved.inventory.plastic_pellet, 30);
    assert.strictEqual(saved.flightStats.totalFlights, 1);

    // Restore in fresh bridge
    const bridge2 = new RocketHangarBridge();
    bridge2.deserialize(saved);

    assert.strictEqual(bridge2.getModuleLevel('hull'), 2);
    assert.strictEqual(bridge2.getPartCount('reinforced_frame'), 5);
    assert.strictEqual(bridge2.getPartCount('plastic_pellet'), 30);
    assert.strictEqual(bridge2.getFlightStats().bestDistance, 750);
  });
});
