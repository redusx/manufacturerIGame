/* ======================================================================
 * src/integration/RocketHangarIntegration.test.ts
 *
 * TASK-INT-01: Roket Hangarı ve Ekonomi Senkronizasyonu Entegrasyon Testi
 * - Tek gerçek para/kaynak kaynağı (EconomyManager <-> FactoryEconomy)
 * - Havacılık parçaları & hızlı inşa (quick build) mekanizması
 * - Uçuş ganimeti (salvage) ve çift para eklenmesinin önlenmesi
 * - Kayıt / yükleme (save / load) roket seviyesi tutarlılığı
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { EconomyManager } from '../economy/EconomyManager.ts';
import { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';
import { RocketHangarBridge } from '../factory/simulation/RocketHangarBridge.ts';
import { RocketHangarHelper } from '../ui/RocketHangarHelper.ts';
import { getMaxHullHP, getFlightSpeed } from '../data/RocketData.ts';

describe('TASK-INT-01: Rocket Hangar & Economy Integration Tests', () => {
  it('1. Unified Economy: FactoryEconomy delegates to EconomyManager without double count or desync', () => {
    const economy = new EconomyManager();
    const factoryEconomy = new FactoryEconomy(0, undefined, economy);

    assert.strictEqual(factoryEconomy.money, 0);
    assert.strictEqual(economy.resources.toNumber(), 0);

    // Player earns cash via click production
    economy.produceByClick();
    assert.ok(factoryEconomy.money > 0);
    assert.strictEqual(factoryEconomy.money, economy.resources.toNumber());

    // Add explicit resources
    economy.addResources(1500);
    const totalCash = economy.resources.toNumber();
    assert.strictEqual(factoryEconomy.money, totalCash);
    assert.ok(factoryEconomy.canAfford(1000));
    assert.ok(!factoryEconomy.canAfford(totalCash + 500));

    // Spending via factoryEconomy directly deducts from EconomyManager
    const spent = factoryEconomy.spendMoney(500);
    assert.strictEqual(spent, true);
    assert.strictEqual(economy.resources.toNumber(), totalCash - 500);
    assert.strictEqual(factoryEconomy.money, totalCash - 500);

    // Söküm iadesi parayı geri verir ama "toplam kazanç" sayılmaz; sayılırsa
    // kur-sök döngüsü hiç üretmeden fabrika hedeflerini tamamlatır.
    const earnedBeforeRefund = economy.totalEarned.toNumber();
    const goalMultiplierBeforeRefund = economy.getGlobalMultiplier();
    factoryEconomy.addMoney(1_000_000, 'REFUND');
    assert.strictEqual(economy.resources.toNumber(), totalCash - 500 + 1_000_000);
    assert.strictEqual(economy.totalEarned.toNumber(), earnedBeforeRefund);
    assert.strictEqual(economy.getGlobalMultiplier(), goalMultiplierBeforeRefund);
  });

  it('2. Rocket Module Upgrade: End-to-end purchasing, level advancement, and stat calculation', () => {
    const economy = new EconomyManager();
    const factoryEconomy = new FactoryEconomy(0, undefined, economy);
    const bridge = new RocketHangarBridge();
    bridge.syncModuleLevels(economy.getAllRocketUpgrades());

    assert.strictEqual(bridge.getModuleLevel('hull'), 1);
    assert.strictEqual(bridge.getModuleLevel('engine'), 1);

    // Initial base stat check
    assert.strictEqual(getMaxHullHP(bridge.getModuleLevel('hull')), 160);
    assert.strictEqual(getFlightSpeed(bridge.getModuleLevel('engine')), 290);

    // Player cannot afford without cash
    assert.strictEqual(bridge.canAffordUpgrade('hull', factoryEconomy), false);
    assert.strictEqual(bridge.canAffordQuickBuild('hull', factoryEconomy), false);

    // Give player enough cash for quick build ($500 base + 5 frames * $90 = $950)
    economy.addResources(2000);

    // Standard upgrade requires physical parts
    assert.strictEqual(bridge.hasRequiredParts('hull'), false);
    assert.strictEqual(bridge.canAffordUpgrade('hull', factoryEconomy), false);

    // Quick build is affordable because player has $2,000 >= $950
    assert.strictEqual(bridge.canAffordQuickBuild('hull', factoryEconomy), true);
    assert.strictEqual(bridge.getMissingPartsTotalCost('hull'), 450);
    assert.strictEqual(bridge.getTotalUpgradeCostWithMissingParts('hull'), 950);

    // Upgrade hull with quick build (allowProcureMissing = true)
    const upgraded = bridge.upgradeModule('hull', factoryEconomy, true);
    assert.strictEqual(upgraded, true);
    assert.strictEqual(bridge.getModuleLevel('hull'), 2);

    // Check money deduction: $2,000 - $950 = $1,050 remaining
    assert.strictEqual(economy.resources.toNumber(), 1050);
    assert.strictEqual(factoryEconomy.money, 1050);

    // Sync to EconomyManager (matching RocketHangarView behavior)
    economy.setRocketUpgradeLevel('hull', bridge.getModuleLevel('hull'));
    assert.strictEqual(economy.getRocketUpgradeLevel('hull'), 2);

    // Verify upgraded stat
    assert.strictEqual(getMaxHullHP(bridge.getModuleLevel('hull')), 220);
  });

  it('3. Card ViewModel: Correctly switches between INSA ET, HIZLI INSA and EKSIK MALZEME', () => {
    const economy = new EconomyManager();
    const factoryEconomy = new FactoryEconomy(0, undefined, economy);
    const bridge = new RocketHangarBridge();
    bridge.syncModuleLevels(economy.getAllRocketUpgrades());

    // Without quick build (legacy test compatibility)
    const vmNoQuick = RocketHangarHelper.getCardViewModel(
      'hull',
      'Gövde Zırhı',
      bridge,
      factoryEconomy,
      'Zırh: 100 HP',
      3,
      false,
    );
    assert.strictEqual(vmNoQuick.btnText, 'EKSİK MALZEME');
    assert.strictEqual(vmNoQuick.canAfford, false);

    // With quick build allowed, but no money
    const vmNoMoney = RocketHangarHelper.getCardViewModel(
      'hull',
      'Gövde Zırhı',
      bridge,
      factoryEconomy,
      'Zırh: 100 HP',
      3,
      true,
    );
    assert.strictEqual(vmNoMoney.btnText, 'EKSİK MALZEME');
    assert.strictEqual(vmNoMoney.canAfford, false);

    // Give cash: becomes HIZLI İNŞA
    economy.addResources(1500);
    const vmQuickBuild = RocketHangarHelper.getCardViewModel(
      'hull',
      'Gövde Zırhı',
      bridge,
      factoryEconomy,
      'Zırh: 100 HP',
      3,
      true,
    );
    assert.strictEqual(vmQuickBuild.btnText, 'HIZLI İNŞA');
    assert.strictEqual(vmQuickBuild.canAfford, true);
    assert.strictEqual(vmQuickBuild.costText, '$950');

    // Deposit parts: becomes standard İNŞA ET at base price
    bridge.depositPart('reinforced_frame', 5);
    const vmStandard = RocketHangarHelper.getCardViewModel(
      'hull',
      'Gövde Zırhı',
      bridge,
      factoryEconomy,
      'Zırh: 100 HP',
      3,
      true,
    );
    assert.strictEqual(vmStandard.btnText, 'İNŞA ET');
    assert.strictEqual(vmStandard.canAfford, true);
    assert.strictEqual(vmStandard.costText, '$500');
  });

  it('4. Flight Salvage & No Double Resource Addition', () => {
    const economy = new EconomyManager();
    const factoryEconomy = new FactoryEconomy(0, undefined, economy);
    const bridge = new RocketHangarBridge();
    bridge.syncModuleLevels(economy.getAllRocketUpgrades());

    // Simulate flight returning with 6 gears and 2 crystals
    const collectedGears = 6;
    const collectedCrystals = 2;

    bridge.depositFlightSalvage(collectedGears, collectedCrystals);

    // Verify salvage was converted to physical parts in bridge inventory
    assert.strictEqual(bridge.getPartCount('reinforced_frame'), 3);
    assert.strictEqual(bridge.getPartCount('electric_motor'), 3);
    assert.strictEqual(bridge.getPartCount('steel_gear'), 6);
    assert.strictEqual(bridge.getPartCount('plastic_pellet'), 10);
    assert.strictEqual(bridge.getPartCount('microchip'), 1);

    // Process flight return via bridge
    const initialCash = economy.resources.toNumber();
    const summary = bridge.processFlightResult(
      {
        distanceMeters: 500,
        partsCollected: collectedGears,
        crystalsCollected: collectedCrystals,
        dodgedObstacles: 3,
        altitudeMeters: 120,
      },
      factoryEconomy,
    );

    assert.ok(summary.cashGained > 0);
    // Money in economy increased by exactly summary.cashGained
    assert.strictEqual(economy.resources.toNumber(), initialCash + summary.cashGained);

    // Simulate FlightScene's updated returnToFactory logic:
    // Calling economy.recordFlightResult with 0 ensures no money duplication!
    const recordedCashBefore = economy.resources.toNumber();
    economy.recordFlightResult(500, 100, 0);
    assert.strictEqual(economy.resources.toNumber(), recordedCashBefore);
    assert.strictEqual(economy.flightStats.bestDistance, 500);
  });

  it('5. Save and Load preserves rocket module upgrades across reloads', () => {
    const economy1 = new EconomyManager();
    const factoryEconomy1 = new FactoryEconomy(0, undefined, economy1);
    const bridge1 = new RocketHangarBridge();

    // Give cash and upgrade engine to level 2
    economy1.addResources(5000);
    bridge1.upgradeModule('engine', factoryEconomy1, true);
    economy1.setRocketUpgradeLevel('engine', bridge1.getModuleLevel('engine'));

    assert.strictEqual(economy1.getRocketUpgradeLevel('engine'), 2);

    // Serialize
    const saved = economy1.serialize();

    // Create fresh instance and deserialize
    const economy2 = new EconomyManager();
    economy2.deserialize(saved);

    assert.strictEqual(economy2.getRocketUpgradeLevel('engine'), 2);

    // Attach to fresh bridge
    const bridge2 = new RocketHangarBridge();
    bridge2.syncModuleLevels(economy2.getAllRocketUpgrades());

    assert.strictEqual(bridge2.getModuleLevel('engine'), 2);
    assert.strictEqual(bridge2.getModuleLevel('hull'), 1);
  });
});
