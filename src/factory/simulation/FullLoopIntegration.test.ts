/* ======================================================================
 * src/factory/simulation/FullLoopIntegration.test.ts
 *
 * Tam Döngü Entegrasyon Testi (TASK-113, docs/MASTER_PLAN.md FAZ 5 Sistem 5.2)
 *
 * Bütünleşik Oyun Döngüsü:
 * Fabrikada Üretim (Cevher -> Makineler -> Bantlar -> Havacılık Parçası)
 *   ↓
 * Hangar Parça Aktarımı & Montajı (Fiziksel Parça + Nakit ile Modül Yükseltme)
 *   ↓
 * Fırlatma Sahnesi Uçuşu & Mesafe Kilometre Taşları (+%30 Kalıcı Global Çarpan)
 *   ↓
 * Nakit Ödülü Geri Akışı (FactoryEconomy'ye Büyük Sermaye Enjeksiyonu)
 *   ↓
 * Yeni Parsel Genişletmesi (8x8 -> 12x8 Dökümhane Parseli Satın Alımı & Genişleme)
 *   ↓
 * Çarpanlı Yüksek Değerli İhracat Üretimi (Genişletilmiş Fabrika Büyümesi)
 *
 * Saf TypeScript — Node 24 native test koşucusu: `node --experimental-strip-types --test`
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import { GridMap } from './GridMap.ts';
import { LogisticsNetwork, type DeliveredItemEvent } from './LogisticsNetwork.ts';
import { ProductionEngine } from './ProductionEngine.ts';
import { MachineEntity } from './MachineEntity.ts';
import { FactoryEconomy } from './FactoryEconomy.ts';
import { RocketHangarBridge } from './RocketHangarBridge.ts';
import { PlotExpansionManager } from '../progression/PlotExpansionManager.ts';
import { defaultMachineRegistry } from './MachineRegistry.ts';
import { defaultRecipeRegistry } from './RecipeRegistry.ts';
import { defaultItemRegistry } from './ItemRegistry.ts';
import { FlightReturnHelper } from '../../scenes/FlightReturnHelper.ts';

describe('Full-Loop Integration: Factory -> Hangar -> Flight -> Expansion', () => {
  const crusherDef = defaultMachineRegistry.getOrThrow('crusher');
  const smelterDef = defaultMachineRegistry.getOrThrow('smelter');

  it('Complete Core Progression Cycle: Ore Extraction -> Processing -> Rocket Upgrade -> Flight Rewards -> Plot Expansion -> Multiplied Production', () => {
    // -----------------------------------------------------------------
    // 1. ADIM: BAŞLANGIÇ FABRİKASI VE SİMÜLASYON KURULUMU (8x8)
    // -----------------------------------------------------------------
    const grid = new GridMap(24, 24);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(
      grid,
      logistics,
      defaultRecipeRegistry,
      defaultMachineRegistry,
    );
    const economy = new FactoryEconomy(0, defaultItemRegistry);
    const bridge = new RocketHangarBridge(defaultItemRegistry);
    const plotManager = new PlotExpansionManager(economy, grid);

    const initialBounds = plotManager.getCurrentBounds();
    assert.strictEqual(initialBounds.width, 8);
    assert.strictEqual(initialBounds.height, 8);
    assert.strictEqual(economy.money, 0);
    assert.strictEqual(economy.revenueMultiplier, 1.0);
    assert.strictEqual(bridge.getModuleLevel('hull'), 1);
    assert.strictEqual(bridge.getModuleLevel('engine'), 1);

    // -----------------------------------------------------------------
    // 2. ADIM: İMALAT VE İHRACAT HATTI (İlk Sermaye Üretimi)
    // -----------------------------------------------------------------
    // INTAKE: Demir cevheri besler (1, 0)
    grid.setIntake(1, 0, 'iron_ore', 1.0);
    logistics.addConveyor({ x: 1, y: 1 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 2 }, 'SOUTH', 1.0);

    // Kırıcı at (1, 3): iron_ore -> iron_powder
    const crusher = new MachineEntity('crusher_1', crusherDef, { x: 1, y: 3 }, 0);
    crusher.setRecipe('recipe_crush_iron_ore');
    engine.addMachine(crusher);

    // Kırıcı çıkışı -> Fırın ara bandı
    logistics.addConveyor({ x: 1, y: 4 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 2, y: 4 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 3, y: 4 }, 'EAST', 1.0);

    // Fırın at (4, 4): iron_powder -> iron_ingot
    const smelter = new MachineEntity('smelter_1', smelterDef, { x: 4, y: 4 }, 0);
    smelter.setRecipe('recipe_smelt_iron_ingot');
    engine.addMachine(smelter);

    // Fırın çıkışı -> EXPORT sandığı at (7, 4)
    logistics.addConveyor({ x: 6, y: 4 }, 'EAST', 1.0);
    grid.setExport(7, 4);

    const deliveredItems: DeliveredItemEvent[] = [];
    logistics.onItemDelivered = (event) => {
      deliveredItems.push(event);
      // İhraç edilen eşya fabrika ekonomisinde satılır
      economy.exportItem(event.itemId);
    };

    // 20 saniyelik üretim simülasyonu
    const dt = 0.5;
    for (let t = 0; t < 40; t++) {
      logistics.tick(dt);
      engine.tick(dt);
      economy.tick(dt);
    }

    assert.ok(deliveredItems.length >= 2, 'En az 2 külçe ihraç edilmiş olmalı');
    assert.ok(economy.money > 0, 'İhracattan ilk sermaye kazanılmış olmalı');

    // -----------------------------------------------------------------
    // 3. ADIM: HANGARA HAVACILIK PARÇALARI YATIRMA VE MODÜL YÜKSELTME
    // -----------------------------------------------------------------
    // Roket Gövde Seviye 2 Maliyeti: $500 + 5x reinforced_frame
    // Roket Motor Seviye 2 Maliyeti: $750 + 6x electric_motor
    // Oyuncuya gereken parçaları ve başlangıç sermayesini tamamlayalım
    economy.addMoney(2000, 'EXPORT');

    assert.strictEqual(bridge.depositPart('reinforced_frame', 5), true);
    assert.strictEqual(bridge.depositPart('electric_motor', 6), true);
    assert.strictEqual(bridge.getPartCount('reinforced_frame'), 5);
    assert.strictEqual(bridge.getPartCount('electric_motor'), 6);

    // Yükseltme öncesi kontrol
    assert.strictEqual(bridge.canAffordUpgrade('hull', economy), true);
    assert.strictEqual(bridge.canAffordUpgrade('engine', economy), true);

    // Gövdeyi Seviye 2'ye yükselt ($500 ve 5 parça harcar)
    const hullUpgraded = bridge.upgradeModule('hull', economy);
    assert.strictEqual(hullUpgraded, true);
    assert.strictEqual(bridge.getModuleLevel('hull'), 2);
    assert.strictEqual(bridge.getPartCount('reinforced_frame'), 0);

    // Motoru Seviye 2'ye yükselt ($750 ve 6 parça harcar)
    const engineUpgraded = bridge.upgradeModule('engine', economy);
    assert.strictEqual(engineUpgraded, true);
    assert.strictEqual(bridge.getModuleLevel('engine'), 2);
    assert.strictEqual(bridge.getPartCount('electric_motor'), 0);

    // Cüzdandan $1250 düşülmüş olmalı ($2000 + külçe gelirleri - $1250)
    assert.ok(economy.money < 1000);

    // -----------------------------------------------------------------
    // 4. ADIM: YÜKSELTİLMİŞ ROKETLE FIRLATMA VE UÇUŞ ÖDÜLLERİ
    // -----------------------------------------------------------------
    // Geliştirilmiş roketle uçuş simülasyonu: 1,200m mesafe, 120m irtifa,
    // 15 hurda dişli, 4 enerji kristali, 6 kaçınılan engel
    const flightInput = {
      distanceMeters: 1200,
      altitudeMeters: 120,
      partsCollected: 15,
      crystalsCollected: 4,
      dodgedObstacles: 6,
    };

    const previousMoney = economy.money;
    const flightSummary = bridge.processFlightResult(flightInput, economy);

    // Beklenen Uçuş Ödülü:
    // Mesafe: floor(1200 * 0.35) = 420
    // İrtifa: floor(120 * 0.40) = 48
    // Dişliler: 15 * 5 = 75
    // Kristaller: 4 * 15 = 60
    // Kaçışlar: 6 * 4 = 24
    // Toplam = 420 + 48 + 75 + 60 + 24 = 627
    assert.strictEqual(flightSummary.distanceMeters, 1200);
    assert.strictEqual(flightSummary.cashGained, 627);
    assert.strictEqual(flightSummary.isNewBestDistance, true);
    assert.strictEqual(economy.money, previousMoney + 627);

    // Kalıcı Kilometre Taşları Doğrulaması:
    // 1200m ile 100m (+%5), 500m (+%10) ve 1000m (+%15) açıldı -> Toplam +%30 bonus
    assert.strictEqual(flightSummary.milestoneBonusMultiplier, 0.30);
    assert.strictEqual(economy.revenueMultiplier, 1.30);

    // -----------------------------------------------------------------
    // 5. ADIM: KAZANILAN UÇUŞ SERMAYESİ İLE PARSEL GENİŞLETMESİ (12x8)
    // -----------------------------------------------------------------
    // 1. Parsel (Dökümhane Parseli): Maliyeti $500, Hedef Boyut: 12x8
    const nextPlot = plotManager.getNextAvailablePlot();
    assert.ok(nextPlot !== null);
    assert.strictEqual(nextPlot.index, 1);
    assert.strictEqual(nextPlot.cost, 500);
    assert.strictEqual(plotManager.canAffordPlot(1), true);

    const unlockResult = plotManager.unlockPlot(1);
    assert.strictEqual(unlockResult.success, true);
    assert.strictEqual(unlockResult.plotIndex, 1);
    assert.strictEqual(unlockResult.newBounds.width, 12);
    assert.strictEqual(unlockResult.newBounds.height, 8);

    // Yeni açılan delta hücre sayısı: (12*8) - (8*8) = 96 - 64 = 32 hücre
    assert.strictEqual(unlockResult.newlyUnlockedCoords.length, 32);

    // Fabrika aktif sınırlarını yeni parsele göre doğrula
    const expandedBounds = plotManager.getCurrentBounds();
    assert.strictEqual(expandedBounds.width, 12);
    assert.strictEqual(expandedBounds.height, 8);

    // -----------------------------------------------------------------
    // 6. ADIM: GENİŞLETİLMİŞ PARSELDE ÇARPANLI ÜRETİM VE İHRACAT
    // -----------------------------------------------------------------
    // Açılan yeni alana (x=9..11) yeni bir ihracat sandığı koyalım
    grid.setExport(11, 4);

    // Kalıcı çarpanın eşya değerine etkisini test edelim:
    // Örneğin demir külçenin baz değeri $12 ise: Math.floor(12 * 1.30) = $15
    const baseItem = defaultItemRegistry.getOrThrow('iron_ingot');
    const expectedExportValue = Math.floor(baseItem.baseValue * 1.30);

    const initialMoneyBeforeExport = economy.money;
    const gainedCash = economy.exportItem('iron_ingot');

    assert.strictEqual(gainedCash, expectedExportValue);
    assert.strictEqual(economy.money, initialMoneyBeforeExport + expectedExportValue);

    // Kariyer istatistikleri doğrulaması
    const careerStats = bridge.getFlightStats();
    assert.strictEqual(careerStats.totalFlights, 1);
    assert.strictEqual(careerStats.bestDistance, 1200);
    assert.strictEqual(careerStats.totalCashEarned, 627);
  });

  it('Multi-Flight Progression and Cumulative Milestone Scaling across career', () => {
    const economy = new FactoryEconomy(0);
    const bridge = new RocketHangarBridge();

    // 1. Uçuş: 250m -> 100m kilometre taşı açılır (+%5)
    const f1 = bridge.processFlightResult(
      { distanceMeters: 250, partsCollected: 2, crystalsCollected: 1 },
      economy,
    );
    assert.strictEqual(f1.milestoneBonusMultiplier, 0.05);
    assert.strictEqual(economy.revenueMultiplier, 1.05);

    // 2. Uçuş: 750m -> 500m kilometre taşı açılır (+%10)
    const f2 = bridge.processFlightResult(
      { distanceMeters: 750, partsCollected: 5, crystalsCollected: 2 },
      economy,
    );
    assert.strictEqual(f2.milestoneBonusMultiplier, 0.10);
    assert.strictEqual(economy.revenueMultiplier, 1.15);

    // 3. Uçuş: 3200m -> 1000m (+%15) ve 2500m (+%20) açılır -> +%35
    const f3 = bridge.processFlightResult(
      { distanceMeters: 3200, partsCollected: 10, crystalsCollected: 5 },
      economy,
    );
    assert.strictEqual(f3.milestoneBonusMultiplier, 0.35);
    assert.strictEqual(economy.revenueMultiplier, 1.50);

    // 4. Uçuş: 6000m -> 5000m Derin Uzay taşı açılır (+%25) -> Toplam +%75 bonus
    const f4 = bridge.processFlightResult(
      { distanceMeters: 6000, partsCollected: 20, crystalsCollected: 8 },
      economy,
    );
    assert.strictEqual(f4.milestoneBonusMultiplier, 0.25);
    assert.strictEqual(economy.revenueMultiplier, 1.75);

    // 5. Uçuş: 4000m (rekor değil) -> Yeni kilometre taşı açılmaz, çarpan 1.75 kalır
    const f5 = bridge.processFlightResult(
      { distanceMeters: 4000, partsCollected: 10, crystalsCollected: 2 },
      economy,
    );
    assert.strictEqual(f5.milestoneBonusMultiplier, undefined);
    assert.strictEqual(economy.revenueMultiplier, 1.75);

    const stats = bridge.getFlightStats();
    assert.strictEqual(stats.totalFlights, 5);
    assert.strictEqual(stats.bestDistance, 6000);
  });

  it('End-to-End Serialization Round-Trip: Saves and restores full loop state flawlessly', () => {
    const economy = new FactoryEconomy(2500);
    const bridge = new RocketHangarBridge();

    // Modülleri seviye 2'ye çıkar
    bridge.depositPart('reinforced_frame', 5);
    bridge.upgradeModule('hull', economy);
    bridge.depositPart('plastic_pellet', 20);
    bridge.upgradeModule('boost', economy);

    // Uçuş yap ve rekor kaydet
    bridge.processFlightResult(
      { distanceMeters: 1500, partsCollected: 8, crystalsCollected: 3 },
      economy,
    );
    assert.strictEqual(economy.revenueMultiplier, 1.30); // 100m, 500m, 1000m

    // Parsel 1'i aç
    economy.unlockPlot(1);

    // Durumu JSON'a serileştir
    const savedEconomy = economy.serialize();
    const savedHangar = bridge.serialize();

    // Yepyeni sınıflar oluştur ve geri yükle
    const restoredEconomy = new FactoryEconomy(0);
    restoredEconomy.loadFromSerialized(savedEconomy);

    const restoredBridge = new RocketHangarBridge();
    restoredBridge.deserialize(savedHangar);

    // Doğrulamalar
    assert.strictEqual(restoredEconomy.money, economy.money);
    assert.strictEqual(restoredEconomy.revenueMultiplier, 1.30);
    assert.strictEqual(restoredEconomy.isPlotUnlocked(1), true);

    assert.strictEqual(restoredBridge.getModuleLevel('hull'), 2);
    assert.strictEqual(restoredBridge.getModuleLevel('boost'), 2);
    assert.strictEqual(restoredBridge.getModuleLevel('engine'), 1);
    assert.strictEqual(restoredBridge.getFlightStats().bestDistance, 1500);
    assert.strictEqual(restoredBridge.getFlightStats().totalFlights, 1);
  });
});
