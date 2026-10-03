/* ======================================================================
 * src/ui/RocketHangarHelper.test.ts
 *
 * RocketHangarHelper için headless birim testleri.
 * Node 24 native test koşucusu ile çalışır; Phaser bağımlılığı yoktur.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { RocketHangarHelper } from './RocketHangarHelper.ts';
import { RocketHangarBridge } from '../factory/simulation/RocketHangarBridge.ts';
import { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';

describe('RocketHangarHelper Headless Unit Tests', () => {
  it('Should accurately format individual part requirements with fulfilled and missing states', () => {
    const req = {
      itemId: 'reinforced_frame',
      itemName: 'Gövde Çerçevesi',
      count: 5,
    };

    // Partially fulfilled
    const textPartial = RocketHangarHelper.formatPartRequirement(req, 2);
    assert.strictEqual(textPartial, 'Gövde Çerçevesi: 2/5 (Eksik: 3)');

    // Exactly fulfilled
    const textExact = RocketHangarHelper.formatPartRequirement(req, 5);
    assert.strictEqual(textExact, 'Gövde Çerçevesi: 5/5 ✓');

    // Over-fulfilled
    const textOver = RocketHangarHelper.formatPartRequirement(req, 8);
    assert.strictEqual(textOver, 'Gövde Çerçevesi: 8/5 ✓');
  });

  it('Should format cost and parts summary with accurate affordability flags', () => {
    const bridge = new RocketHangarBridge();
    const cost = bridge.getUpgradeCost('hull');
    assert.ok(cost);

    // Initial stock is 0
    const summary1 = RocketHangarHelper.formatCostAndPartsSummary(cost, bridge);
    assert.strictEqual(summary1.cashText, '$500');
    assert.strictEqual(summary1.canAffordParts, false);
    assert.ok(summary1.partsSummary.includes('5x Güçlendirilmiş Gövde Çerçevesi [0/5]'));

    // Deposit parts
    bridge.depositPart('reinforced_frame', 5);
    const summary2 = RocketHangarHelper.formatCostAndPartsSummary(cost, bridge);
    assert.strictEqual(summary2.canAffordParts, true);
    assert.ok(summary2.partsSummary.includes('5x Güçlendirilmiş Gövde Çerçevesi [5/5]'));
  });

  it('Should format hangar stock header with empty and populated inventory', () => {
    const bridge = new RocketHangarBridge();

    // Empty
    assert.strictEqual(
      RocketHangarHelper.formatHangarStockHeader(bridge),
      'Hangar Stoğu: Henüz havacılık parçası teslim edilmedi',
    );

    // Deposit multiple parts
    bridge.depositPart('reinforced_frame', 3);
    bridge.depositPart('electric_motor', 2);
    bridge.depositPart('microchip', 1);

    const header = RocketHangarHelper.formatHangarStockHeader(bridge);
    assert.ok(header.startsWith('Hangar Stoğu:'));
    assert.ok(header.includes('Çerçeve: 3'));
    assert.ok(header.includes('Motor: 2'));
    assert.ok(header.includes('Mikroçip: 1'));
  });

  it('Should generate correct card view models for all upgrade states (missing cash, missing parts, ready, max)', () => {
    const bridge = new RocketHangarBridge();
    const economy = new FactoryEconomy(100); // Has $100

    // State 1: Level 1 -> 2 (missing cash and parts)
    const vm1 = RocketHangarHelper.getCardViewModel(
      'hull',
      'Gövde Zırhı',
      bridge,
      economy,
      'Zırh: 100 HP',
    );

    assert.strictEqual(vm1.level, 1);
    assert.strictEqual(vm1.isMax, false);
    assert.strictEqual(vm1.canAfford, false);
    assert.strictEqual(vm1.hasEnoughCash, false);
    assert.strictEqual(vm1.hasEnoughParts, false);
    assert.strictEqual(vm1.btnTexture, 'btn_disabled');
    assert.strictEqual(vm1.btnText, 'EKSİK MALZEME');

    // Add cash, still missing parts
    economy.addMoney(1000, 'EXPORT'); // Total $1100
    const vm2 = RocketHangarHelper.getCardViewModel(
      'hull',
      'Gövde Zırhı',
      bridge,
      economy,
      'Zırh: 100 HP',
    );
    assert.strictEqual(vm2.hasEnoughCash, true);
    assert.strictEqual(vm2.hasEnoughParts, false);
    assert.strictEqual(vm2.canAfford, false);

    // Deposit parts: now fully affordable!
    bridge.depositPart('reinforced_frame', 5);
    const vm3 = RocketHangarHelper.getCardViewModel(
      'hull',
      'Gövde Zırhı',
      bridge,
      economy,
      'Zırh: 100 HP',
    );
    assert.strictEqual(vm3.canAfford, true);
    assert.strictEqual(vm3.hasEnoughCash, true);
    assert.strictEqual(vm3.hasEnoughParts, true);
    assert.strictEqual(vm3.btnTexture, 'btn_green_normal');
    assert.strictEqual(vm3.btnText, 'İNŞA ET');

    // Upgrade to Level 2
    bridge.upgradeModule('hull', economy);

    // Deposit Level 3 requirements and upgrade to Level 3 (Max)
    economy.addMoney(5000, 'EXPORT');
    bridge.depositPart('aero_hull_plate', 8);
    bridge.upgradeModule('hull', economy);

    // State: Maximum Level
    const vmMax = RocketHangarHelper.getCardViewModel(
      'hull',
      'Gövde Zırhı',
      bridge,
      economy,
      'Zırh: 300 HP',
    );
    assert.strictEqual(vmMax.level, 3);
    assert.strictEqual(vmMax.isMax, true);
    assert.strictEqual(vmMax.levelText, 'MAKSİMUM');
    assert.strictEqual(vmMax.btnText, 'TAMAMLANDI');
    assert.strictEqual(vmMax.canAfford, false);
    assert.strictEqual(vmMax.btnTexture, 'btn_disabled');
  });
});
