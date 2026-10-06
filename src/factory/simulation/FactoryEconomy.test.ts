/* ======================================================================
 * src/factory/simulation/FactoryEconomy.test.ts — İncremental Ekonomi Birim Testi
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { FactoryEconomy, FACTORY_PLOTS } from './FactoryEconomy.ts';

describe('FactoryEconomy Incremental Mechanics', () => {
  it('Should initialize wallet with zero or provided starting balance', () => {
    const economy = new FactoryEconomy(100);
    assert.equal(economy.money, 100);
    assert.equal(economy.totalEarned, 100);

    assert.equal(economy.canAfford(50), true);
    assert.equal(economy.canAfford(150), false);

    assert.equal(economy.spendMoney(40), true);
    assert.equal(economy.money, 60);

    assert.equal(economy.spendMoney(100), false);
    assert.equal(economy.money, 60); // Değişmedi
  });

  it('exportItem() should calculate net value based on ItemRegistry and revenueMultiplier', () => {
    const economy = new FactoryEconomy(0);

    // iron_ore baseValue = 1.0 -> $1
    const v1 = economy.exportItem('iron_ore');
    assert.equal(v1, 1);
    assert.equal(economy.money, 1);

    // steel_gear baseValue = 18.0 -> $18
    const v2 = economy.exportItem('steel_gear');
    assert.equal(v2, 18);
    assert.equal(economy.money, 19);

    // Çarpan 2.0x yapıldığında
    economy.revenueMultiplier = 2.0;
    const v3 = economy.exportItem('steel_gear');
    assert.equal(v3, 36);
    assert.equal(economy.money, 55);

    // Değer tam sayıya değil kuruşa yuvarlanır: demir tozu $2.5 kalır ve
    // küçük çarpanlar ucuz eşyada da etkisini gösterir (2.5 * 1.15 = 2.875 -> 2.88)
    economy.revenueMultiplier = 1.0;
    assert.equal(economy.exportItem('iron_powder'), 2.5);
    economy.revenueMultiplier = 1.15;
    assert.equal(economy.exportItem('iron_powder'), 2.88);
  });

  it('Revenue tracking and dynamic click value formula', () => {
    const economy = new FactoryEconomy(0);

    // Başlangıçta pasif gelir 0, tıklama 1$
    assert.equal(economy.getRevenuePerSec(), 0);
    assert.equal(economy.getClickValue(), 1);

    // İçinde bulunulan (tamamlanmamış) saniyenin ihracatı henüz sayılmaz
    economy.addMoney(10, 'EXPORT');
    assert.equal(economy.getRevenuePerSec(), 0);

    // 10 saniye boyunca saniyede 10$ ihracat: 100 / 10 = 10$/sn
    economy.tick(1);
    for (let i = 0; i < 9; i++) {
      economy.addMoney(10, 'EXPORT');
      economy.tick(1);
    }
    assert.equal(economy.getRevenuePerSec(), 10);
    // clickValue = 1 + floor(10 * 0.05) = 1$
    assert.equal(economy.getClickValue(), 1);

    // Sonraki 50 saniye saniyede 40$: 60 sn'lik pencere = (100 + 2000) / 60 = 35$/sn
    for (let i = 0; i < 50; i++) {
      economy.addMoney(40, 'EXPORT');
      economy.tick(1);
    }
    assert.equal(economy.getRevenuePerSec(), 35);
    // clickValue = 1 + floor(35 * 0.05) = 2$/tık
    assert.equal(economy.getClickValue(), 2);
    assert.equal(economy.performClick(), 2);

    // Tıklama ve iade geliri saniyelik ihracat hızına karışmaz
    economy.addMoney(500, 'CLICK');
    economy.addMoney(500, 'REFUND');
    economy.tick(1);
    assert.ok(economy.getRevenuePerSec() < 35);

    // 60 saniye ihracatsız geçince kayıtlar pencereden düşer
    economy.tick(60);
    assert.equal(economy.getRevenuePerSec(), 0);
    assert.equal(economy.getClickValue(), 1);

    // Kayıttan gelen hızla başlatma: gösterge sıfırdan başlamaz
    economy.seedRevenueRate(12.5);
    assert.equal(economy.getRevenuePerSec(), 12.5);
  });

  it('Machine upgrade scaling ($1.15^lvl) and 100% full refund', () => {
    const economy = new FactoryEconomy(1000);
    const crusherBaseCost = 100;

    // Seviye 1 -> 2 yükseltme: floor(100 * 1.15^1) = 115$
    const costLvl1 = economy.getMachineUpgradeCost(crusherBaseCost, 1);
    assert.equal(costLvl1, 115);

    // Seviye 2 -> 3 yükseltme: floor(100 * 1.15^2) = 132$
    const costLvl2 = economy.getMachineUpgradeCost(crusherBaseCost, 2);
    assert.equal(costLvl2, 132);

    // Seviye 3 bir kırıcının toplam maliyeti: 100 (taban) + 115 + 132 = 347$
    const totalInvested = economy.getTotalMachineInvestment(crusherBaseCost, 3);
    assert.equal(totalInvested, 347);

    // Yıkım ve %100 iade
    const initialMoney = economy.money;
    const refunded = economy.refundMachine(crusherBaseCost, 3);
    assert.equal(refunded, 347);
    assert.equal(economy.money, initialMoney + 347);
  });

  it('Plot expansion unlocking should scale factory dimensions progressively', () => {
    const economy = new FactoryEconomy(100);

    // Başlangıç: Parsel 0 açık (8x8)
    assert.equal(economy.isPlotUnlocked(0), true);
    assert.deepEqual(economy.getCurrentFactoryDimensions(), { width: 8, height: 8 });

    // Parsel 1 maliyeti 500$, 100$ ile açılamaz
    assert.equal(economy.getPlotCost(1), 500);
    assert.equal(economy.unlockPlot(1), false);
    assert.equal(economy.isPlotUnlocked(1), false);

    // 500$ ekle ve Parsel 1'i aç (12x8)
    economy.addMoney(500);
    assert.equal(economy.unlockPlot(1), true);
    assert.equal(economy.isPlotUnlocked(1), true);
    assert.deepEqual(economy.getCurrentFactoryDimensions(), { width: 12, height: 8 });

    // Parsel 2'yi aç (2500$ -> 16x12)
    economy.addMoney(2500);
    assert.equal(economy.unlockPlot(2), true);
    assert.deepEqual(economy.getCurrentFactoryDimensions(), { width: 16, height: 12 });
  });

  it('Flight reward calculation should reward altitude and collected scrap', () => {
    const economy = new FactoryEconomy(0);

    // 500m mesafe, 4 hurda: (500 * 2) + (4 * 25) = 1000 + 100 = 1100$
    const reward = economy.calculateFlightReward(500, 4, 1.0);
    assert.equal(reward, 1100);

    // 1.5x roket çarpanı ile: floor(1100 * 1.5) = 1650$
    const bonusReward = economy.calculateFlightReward(500, 4, 1.5);
    assert.equal(bonusReward, 1650);

    // Ödülü talep et
    const claimed = economy.claimFlightReward(500, 4, 1.5);
    assert.equal(claimed, 1650);
    assert.equal(economy.money, 1650);
    // Uçuş parası kasaya girer ama fabrika hedeflerini ilerleten "toplam kazanç" sayılmaz
    assert.equal(economy.totalEarned, 0);
  });

  it('Serialization and deserialization should preserve full economy state', () => {
    const economy = new FactoryEconomy(500);
    economy.addMoney(300, 'EXPORT');
    economy.revenueMultiplier = 1.25;
    economy.unlockPlot(1);

    const serialized = economy.serialize();
    assert.equal(serialized.money, 300); // 500 + 300 - 500 (parsel 1) = 300
    assert.equal(serialized.totalEarned, 800);
    assert.equal(serialized.revenueMultiplier, 1.25);
    assert.deepEqual(serialized.unlockedPlots.sort(), [0, 1]);

    // Geri yükle
    const restored = new FactoryEconomy(0);
    restored.loadFromSerialized(serialized);

    assert.equal(restored.money, 300);
    assert.equal(restored.totalEarned, 800);
    assert.equal(restored.revenueMultiplier, 1.25);
    assert.equal(restored.isPlotUnlocked(1), true);
    assert.deepEqual(restored.getCurrentFactoryDimensions(), { width: 12, height: 8 });
  });
});
