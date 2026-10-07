/* ======================================================================
 * src/integration/FullGameLoopIntegration.test.ts
 *
 * TASK-INT-07: Uçtan Uca Oynanış Doğrulaması (Full Loop Verification & Polish)
 * (docs/MASTER_PLAN.md FAZ 7 — Playable Game Integration Culmination)
 *
 * Doğrulanan Tam Oynanış Döngüsü:
 * 1. Sıfır Durum & 8x8 Başlangıç Fabrikası:
 *    - Sabit INTAKE (1, 0), Kırıcı (1, 3), Konveyörler ve Sabit EXPORT (6, 7).
 *    - Tek kaynaklı incremental bakiye ve başlangıç roket modülleri.
 * 2. Kısa Döngü Etkileşimi & İlk Otomatik Üretim:
 *    - Manuel tıklama ile anında bakiye kazanımı.
 *    - INTAKE -> Konveyör -> Kırıcı -> Viraj -> EXPORT tam ürün sevkiyatı ve gelir akışı.
 * 3. Makine İnceleme, Seviye Yükseltme (+%20 Hız), Reçete Değişimi ve Yıkım (%100 İade):
 *    - Kırıcı seviye yükseltme (maliyet düşümü, +%20 hız artışı).
 *    - Desteklenen reçeteler arası geçiş doğrulaması.
 *    - DemolishMath ile konveyör ve makine yıkımı (%100 sermaye ve yükseltme iadesi, DEC-007).
 *    - Sabit terminallerin (INTAKE / EXPORT) yıkıma karşı mutlak korunumu.
 * 4. Alt İnşa Kataloğu, Yerleşim Doğrulaması ve Parsel Genişletmesi:
 *    - Kilitli parsel ve çakışma engeli denetimi.
 *    - $R$ döndürmesi, transpoze ayak izi ve port hizalanması.
 *    - Plot 1 (Dökümhane, $500) sıralı kilit açılımı, 8x8 -> 12x8 sınır genişlemesi.
 *    - Yeni açılan karo üzerinde inşa izninin anında geçerli olması.
 * 5. Roket Hangarı Geliştirmeleri, İstatistik Güncellemeleri ve Tedarik:
 *    - Gövde ve motor seviye yükseltmeleri, tekil bakiye düşümü.
 *    - Hızlı inşa (quick build) piyasa parça maliyeti dönüşümü.
 *    - İtiş gücü (thrust) ve gövde dayanıklılığı (HP) hesaplama artışı.
 * 6. Fırlatma Rampası Uçuşu, Puanlama, Kilometre Taşları ve Fabrika Gelir Çarpanı:
 *    - Parabolik uçuş simülasyonu (1,250m, 650m irtifa, hurda ve kristal ganimeti).
 *    - 100m (+%5), 500m (+%10), 1000m (+%15) kalıcı fabrika ihracat çarpanı (+%30 toplam).
 *    - Uçuş ganimetinin tekil kasaya eklenmesi.
 *    - Fabrika zemininde ihracat gelirinin kalıcı +%30 çarpanla satılması.
 * 7. SaveManager v3 ve FactorySerializer Tam Kalıcılık (Round-Trip Persistence):
 *    - Tüm fabrikanın, seviyelerin, açılmış parsellerin ve çarpanların serileştirilmesi.
 *    - Tarayıcı yenilemesi simülasyonu: 0 kayıpla eksiksiz geri yükleme.
 * 8. Çevrimdışı İlerleme (Offline Earnings) & CrazyGames 2X Ödüllü Reklam:
 *    - 1 saatlik çevrimdışı kalma hesabı (4 saat tavanı, %50 baz verim).
 *    - 2X CrazyGames rewarded video ödülü ile iki kat bakiye kazanımı.
 *
 * Saf TypeScript — Node 24 native test: `node --experimental-strip-types --test`
 * ====================================================================== */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { EconomyManager } from '../economy/EconomyManager.ts';
import { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';
import { GridMap } from '../factory/simulation/GridMap.ts';
import { LogisticsNetwork, type DeliveredItemEvent } from '../factory/simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../factory/simulation/ProductionEngine.ts';
import { MachineEntity } from '../factory/simulation/MachineEntity.ts';
import { defaultMachineRegistry } from '../factory/simulation/MachineRegistry.ts';
import { defaultRecipeRegistry } from '../factory/simulation/RecipeRegistry.ts';
import { defaultItemRegistry } from '../factory/simulation/ItemRegistry.ts';
import { RocketHangarBridge } from '../factory/simulation/RocketHangarBridge.ts';
import { PlotExpansionManager } from '../factory/progression/PlotExpansionManager.ts';
import { PlacementMath, CONVEYOR_BUILD_COST } from '../factory/input/PlacementMath.ts';
import { DemolishMath } from '../factory/input/DemolishMath.ts';
import { MachineInspectorHelper } from '../factory/view/MachineInspectorHelper.ts';
import { FlightReturnHelper } from '../scenes/FlightReturnHelper.ts';
import { FactorySerializer } from '../factory/simulation/FactorySerializer.ts';
import { SaveManager, type StorageLike } from '../save/SaveManager.ts';
import { calculateOfflineReport } from '../ui/OfflineEarningsHelper.ts';
import { getMainThrust, getMaxHullHP } from '../data/RocketData.ts';

class MemoryStorage implements StorageLike {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
  clear(): void {
    this.store.clear();
  }
}

describe('TASK-INT-07: Master Full Game Loop End-to-End Verification Tests', () => {
  let memoryStorage: MemoryStorage;

  beforeEach(() => {
    memoryStorage = new MemoryStorage();
    SaveManager.setDefaultStorage(memoryStorage);
  });

  it('1. Starter Factory Layout & Manual Click Production Flow', () => {
    // 1. Yeni oyun kurulumu
    const economy = new EconomyManager();
    const factoryEconomy = new FactoryEconomy(0, defaultItemRegistry, economy);
    const grid = new GridMap(24, 24);
    const plotManager = new PlotExpansionManager(factoryEconomy, grid);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics, defaultRecipeRegistry, defaultMachineRegistry);
    const hangarBridge = new RocketHangarBridge(defaultItemRegistry);
    hangarBridge.syncModuleLevels(economy.getAllRocketUpgrades());

    // Başlangıç kontrolleri
    assert.strictEqual(economy.resources.toNumber(), 0);
    assert.strictEqual(factoryEconomy.money, 0);
    assert.strictEqual(plotManager.unlockedPlotCount, 1);
    assert.deepStrictEqual(plotManager.getCurrentBounds(), { width: 8, height: 8 });
    assert.strictEqual(hangarBridge.getModuleLevel('hull'), 1);
    assert.strictEqual(hangarBridge.getModuleLevel('engine'), 1);

    // 2. Starter Factory Düzeni (GameScene.setupStarterFactoryLayout eşleniği)
    grid.setIntake(1, 0, 'iron_ore', 1.0);
    grid.setExport(6, 7);

    const crusherDef = defaultMachineRegistry.getOrThrow('crusher');
    const crusher = new MachineEntity('starter_crusher', crusherDef, { x: 1, y: 3 }, 0);
    crusher.setRecipe('recipe_crush_iron_ore');
    engine.addMachine(crusher);

    // Konveyör hatları: (1, 1), (1, 2) SOUTH -> Kırıcı (1, 3)
    logistics.addConveyor({ x: 1, y: 1 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 2 }, 'SOUTH', 1.0);

    // Çıkış: (1, 4), (1, 5), (1, 6) SOUTH
    logistics.addConveyor({ x: 1, y: 4 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 5 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 6 }, 'SOUTH', 1.0);

    // Viraj: (1, 7) EAST
    logistics.addConveyor({ x: 1, y: 7 }, 'EAST', 1.0);

    // İhracata doğru ilerleme: (2, 7) -> (3, 7) -> (4, 7) -> (5, 7) -> EXPORT (6, 7)
    logistics.addConveyor({ x: 2, y: 7 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 3, y: 7 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 4, y: 7 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 5, y: 7 }, 'EAST', 1.0);

    // 3. Manuel Tıklama Üretimi: Oyuncu [MANUEL ÜRET] butonuna basar
    for (let i = 0; i < 25; i++) {
      economy.produceByClick();
    }
    assert.strictEqual(economy.resources.toNumber(), 25);
    assert.strictEqual(factoryEconomy.money, 25);

    // 4. Otomatik Üretim Simülasyonu (20 saniye @ dt = 0.5s)
    let exportedItemsCount = 0;
    let earnedCash = 0;
    logistics.onItemDelivered = (evt: DeliveredItemEvent) => {
      exportedItemsCount++;
      const revenue = factoryEconomy.exportItem(evt.itemId);
      earnedCash += revenue;
    };

    for (let step = 0; step < 40; step++) {
      logistics.tick(0.5);
      engine.tick(0.5);
      factoryEconomy.tick(0.5);
    }

    // Cevher konveyörle kırıcıya girdi, ezildi ve demir tozu EXPORT'a ulaştı
    assert.ok(exportedItemsCount >= 1, 'En az 1 adet demir tozu ihraç edilmelidir');
    assert.ok(earnedCash >= 2, 'İhraç edilen demir tozu nakit kazandırmalıdır');
    assert.strictEqual(economy.resources.toNumber(), 25 + earnedCash);
  });

  it('2. Machine Inspector, Upgrade (+20% Speed), Recipe Switch, and Demolish 100% Refund Loop', () => {
    const economy = new EconomyManager();
    economy.addResources(500); // Test sermayesi
    const factoryEconomy = new FactoryEconomy(0, defaultItemRegistry, economy);
    const grid = new GridMap(24, 24);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics, defaultRecipeRegistry, defaultMachineRegistry);

    grid.setIntake(1, 0, 'iron_ore', 1.0);
    grid.setExport(6, 7);

    // Kırıcı at (1, 3)
    const crusherDef = defaultMachineRegistry.getOrThrow('crusher');
    const crusher = new MachineEntity('test_crusher', crusherDef, { x: 1, y: 3 }, 0);
    crusher.setRecipe('recipe_crush_iron_ore');
    engine.addMachine(crusher);

    logistics.addConveyor({ x: 2, y: 7 }, 'EAST', 1.0);

    // A. Makine İnceleme ve Seviye Yükseltme
    assert.strictEqual(engine.getMachineLevel('test_crusher'), 1);
    assert.strictEqual(engine.getSpeedMultiplier('test_crusher'), 1.0);

    const inspectData = MachineInspectorHelper.inspect(crusher, engine, factoryEconomy);
    assert.strictEqual(inspectData.level, 1);
    assert.strictEqual(inspectData.upgradeCost, 115); // Base $100 * 1.15^1 = 115
    assert.strictEqual(inspectData.canAffordUpgrade, true);

    const upgradeRes = MachineInspectorHelper.performUpgrade(crusher, engine, factoryEconomy);
    assert.strictEqual(upgradeRes.success, true);
    assert.strictEqual(upgradeRes.newLevel, 2);

    assert.strictEqual(engine.getMachineLevel('test_crusher'), 2);
    assert.strictEqual(engine.getSpeedMultiplier('test_crusher'), 1.2); // +%20 hız
    assert.strictEqual(economy.resources.toNumber(), 500 - 115);

    // B. Reçete Değişimi
    assert.strictEqual(crusher.activeRecipeId, 'recipe_crush_iron_ore');
    crusher.setRecipe('recipe_crush_copper_ore');
    assert.strictEqual(crusher.activeRecipeId, 'recipe_crush_copper_ore');

    // C. Yıkım Aracı: Konveyör Yıkımı (%100 İade)
    const prevMoney = economy.resources.toNumber();
    const conveyorDemolish = DemolishMath.executeDemolish({
      grid,
      logistics,
      engine,
      economy: factoryEconomy,
      coord: { x: 2, y: 7 },
    });
    assert.strictEqual(conveyorDemolish.success, true);
    assert.strictEqual(conveyorDemolish.targetType, 'CONVEYOR');
    assert.strictEqual(conveyorDemolish.refundAmount, CONVEYOR_BUILD_COST);
    assert.strictEqual(economy.resources.toNumber(), prevMoney + CONVEYOR_BUILD_COST);
    assert.strictEqual(logistics.getConveyor(2, 7), undefined);

    // D. Yıkım Aracı: Geliştirilmiş Makine Yıkımı (%100 İade: Taban $100 + Seviye 2 Maliyeti $115 = $215)
    const moneyBeforeMachineDemolish = economy.resources.toNumber();
    const machineDemolish = DemolishMath.executeDemolish({
      grid,
      logistics,
      engine,
      economy: factoryEconomy,
      coord: { x: 1, y: 3 },
    });
    assert.strictEqual(machineDemolish.success, true);
    assert.strictEqual(machineDemolish.targetType, 'MACHINE');
    assert.strictEqual(machineDemolish.refundAmount, 100 + 115); // $215 tam iade
    assert.strictEqual(economy.resources.toNumber(), moneyBeforeMachineDemolish + 215);
    assert.strictEqual(engine.getMachine('test_crusher'), undefined);
    assert.strictEqual(grid.isCellEmpty(1, 3), true);

    // E. Korunan Terminaller Yıkılamaz
    const intakeInspect = DemolishMath.inspectTarget({
      grid,
      logistics,
      engine,
      economy: factoryEconomy,
      coord: { x: 1, y: 0 },
    });
    assert.strictEqual(intakeInspect.canDemolish, false);
    assert.strictEqual(intakeInspect.blockReason, 'PROTECTED_INTAKE');

    const exportInspect = DemolishMath.inspectTarget({
      grid,
      logistics,
      engine,
      economy: factoryEconomy,
      coord: { x: 6, y: 7 },
    });
    assert.strictEqual(exportInspect.canDemolish, false);
    assert.strictEqual(exportInspect.blockReason, 'PROTECTED_EXPORT');

    const intakeDemolish = DemolishMath.executeDemolish({
      grid,
      logistics,
      engine,
      economy: factoryEconomy,
      coord: { x: 1, y: 0 },
    });
    assert.strictEqual(intakeDemolish.success, false);

    const exportDemolish = DemolishMath.executeDemolish({
      grid,
      logistics,
      engine,
      economy: factoryEconomy,
      coord: { x: 6, y: 7 },
    });
    assert.strictEqual(exportDemolish.success, false);
  });

  it('3. Build Menu Placement, Spatial Verification, Rotation and Plot Expansion', () => {
    const economy = new EconomyManager();
    economy.addResources(2000);
    const factoryEconomy = new FactoryEconomy(0, defaultItemRegistry, economy);
    const grid = new GridMap(24, 24);
    const plotManager = new PlotExpansionManager(factoryEconomy, grid);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics, defaultRecipeRegistry, defaultMachineRegistry);

    // 1. Kilitli parsel hücresine (x: 10, y: 4) inşa etme teşebbüsü engellenir
    const lockedValidation = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 10, y: 4 },
      itemType: 'CONVEYOR',
      direction: 'NORTH',
      unlockedBounds: plotManager.getCurrentBounds(),
    });
    assert.strictEqual(lockedValidation.isValid, false);
    assert.strictEqual(lockedValidation.reason, 'LOCKED_PLOT');

    // 2. Açık parsel (8x8) içinde Fırın (Smelter 2x2, $250) yerleştirme
    const smelterDef = defaultMachineRegistry.getOrThrow('smelter');
    const validSmelter = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 3, y: 1 },
      itemType: 'MACHINE',
      direction: 'EAST', // 90° döndürülmüş
      machineDef: smelterDef,
      unlockedBounds: plotManager.getCurrentBounds(),
    });
    assert.strictEqual(validSmelter.isValid, true);
    assert.strictEqual(validSmelter.cost, 250);

    const placeResult = PlacementMath.executePlacement({
      grid,
      economy: factoryEconomy,
      engine,
      logistics,
      rootCoord: { x: 3, y: 1 },
      itemType: 'MACHINE',
      direction: 'EAST',
      machineDef: smelterDef,
      unlockedBounds: plotManager.getCurrentBounds(),
    });
    assert.strictEqual(placeResult.success, true);
    assert.ok(placeResult.instanceId);
    assert.strictEqual(economy.resources.toNumber(), 2000 - 250);

    // 3. Fırının üzerine tekrar bir şey kurulamaz (Çakışma denetimi)
    const overlapAttempt = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 3, y: 1 },
      itemType: 'CONVEYOR',
      direction: 'NORTH',
      unlockedBounds: plotManager.getCurrentBounds(),
    });
    assert.strictEqual(overlapAttempt.isValid, false);
    assert.strictEqual(overlapAttempt.reason, 'CELL_OCCUPIED');

    // 4. Parsel Genişletmesi: Plot 1 (Dökümhane, $500) kilit açılımı
    const unlockRes = plotManager.unlockPlot(1);
    assert.strictEqual(unlockRes.success, true);
    assert.strictEqual(unlockRes.cost, 500);
    assert.deepStrictEqual(unlockRes.newBounds, { width: 12, height: 8 });
    assert.strictEqual(economy.resources.toNumber(), 2000 - 250 - 500);

    // 5. Yeni açılan (10, 4) hücresi artık geçerli bir inşa alanıdır
    const newlyUnlockedValidation = PlacementMath.validatePlacement({
      grid,
      economy: factoryEconomy,
      rootCoord: { x: 10, y: 4 },
      itemType: 'CONVEYOR',
      direction: 'NORTH',
      unlockedBounds: plotManager.getCurrentBounds(),
    });
    assert.strictEqual(newlyUnlockedValidation.isValid, true);

    const convPlace = PlacementMath.executePlacement({
      grid,
      economy: factoryEconomy,
      engine,
      logistics,
      rootCoord: { x: 10, y: 4 },
      itemType: 'CONVEYOR',
      direction: 'EAST',
      unlockedBounds: plotManager.getCurrentBounds(),
    });
    assert.strictEqual(convPlace.success, true);
    assert.ok(logistics.getConveyor(10, 4) !== undefined);
  });

  it('4. Rocket Hangar Upgrades, Flight Scoring, Milestone Multipliers (+30%) and Factory Revenue Boost', () => {
    const economy = new EconomyManager();
    economy.addResources(5000);
    const factoryEconomy = new FactoryEconomy(0, defaultItemRegistry, economy);
    const bridge = new RocketHangarBridge(defaultItemRegistry);
    bridge.syncModuleLevels(economy.getAllRocketUpgrades());

    // A. Hangar Modül Geliştirmesi
    assert.strictEqual(bridge.getModuleLevel('hull'), 1);
    assert.strictEqual(bridge.getModuleLevel('engine'), 1);
    const baseThrust = getMainThrust(1);
    const baseHullHP = getMaxHullHP(1);

    // Motoru Seviye 2'ye geliştir: parçaların çoğu fabrikadan gelir, en fazla dörtte biri
    // (6 motorun 1'i) hızlı inşayla nakitle tamamlanır
    const initialCash = economy.resources.toNumber();
    assert.strictEqual(bridge.upgradeModule('engine', factoryEconomy, true), false, 'Parça üretmeden hızlı inşa yapılamaz');
    bridge.depositPart('electric_motor', 5);
    const engineUpgradeSuccess = bridge.upgradeModule('engine', factoryEconomy, true);
    assert.strictEqual(engineUpgradeSuccess, true);
    assert.strictEqual(bridge.getModuleLevel('engine'), 2);
    assert.ok(economy.resources.toNumber() < initialCash);
    assert.ok(getMainThrust(2) > baseThrust, 'Seviye 2 motor daha yüksek itiş gücü üretmelidir');

    // Gövdeyi Seviye 2'ye geliştir (5 çerçevenin 4'ü fabrikadan, 1'i nakitle)
    bridge.depositPart('reinforced_frame', 4);
    const hullUpgradeSuccess = bridge.upgradeModule('hull', factoryEconomy, true);
    assert.strictEqual(hullUpgradeSuccess, true);
    assert.strictEqual(bridge.getModuleLevel('hull'), 2);
    assert.ok(getMaxHullHP(2) > baseHullHP, 'Seviye 2 gövde daha yüksek HP sağlamalıdır');

    // B. Uçuş Sahnesi Simülasyonu ve Puanlama
    // Roket fırlatıldı: 1,250 metre mesafe, 650m maksimum irtifa, 5 dişli, 3 kristal, 4 engelden kaçış
    const flightParams = {
      distanceMeters: 1250,
      maxAltitudeMeters: 650,
      gearsCollected: 5,
      crystalsCollected: 3,
      dodgedObstacles: 4,
    };
    const rewardBreakdown = FlightReturnHelper.calculateRewardBreakdown(flightParams);
    // Ödül = gelir süresi × gelir (taban $1/sn)
    assert.strictEqual(rewardBreakdown.distanceCash, Math.floor(1250 / 40)); // 31
    assert.strictEqual(rewardBreakdown.altitudeCash, Math.floor(650 / 100)); // 6
    assert.strictEqual(rewardBreakdown.gearsCash, 5); // 5
    assert.strictEqual(rewardBreakdown.crystalsCash, 3 * 3); // 9
    assert.strictEqual(rewardBreakdown.dodgesCash, Math.floor(4 * 0.5)); // 2
    assert.strictEqual(rewardBreakdown.totalCash, 31 + 6 + 5 + 9 + 2); // 53

    // C. Mesafe Kilometre Taşları ve Global Gelir Çarpanı
    // 0 -> 1250m: 100m (+%5), 500m (+%10), 1000m (+%15) = Toplam +%30 (+0.30)
    const newlyUnlockedMilestones = FlightReturnHelper.getNewlyUnlockedMilestones(0, 1250);
    assert.strictEqual(newlyUnlockedMilestones.length, 3);
    assert.strictEqual(newlyUnlockedMilestones[0].id, 'flight_ms_100');
    assert.strictEqual(newlyUnlockedMilestones[1].id, 'flight_ms_500');
    assert.strictEqual(newlyUnlockedMilestones[2].id, 'flight_ms_1000');

    assert.strictEqual(factoryEconomy.revenueMultiplier, 1.0);
    const appliedMultiplierBonus = FlightReturnHelper.applyMilestonesToEconomy(
      newlyUnlockedMilestones,
      factoryEconomy,
    );
    assert.strictEqual(appliedMultiplierBonus, 0.30);
    assert.strictEqual(factoryEconomy.revenueMultiplier, 1.30);

    // Uçuş ödülü tekil kasaya eklenir
    const cashBeforeReward = economy.resources.toNumber();
    economy.addResources(rewardBreakdown.totalCash);
    assert.strictEqual(economy.resources.toNumber(), cashBeforeReward + rewardBreakdown.totalCash);

    // D. Fabrika İhracatında Çarpan Etkisi:
    // Demir tozunun baz bedeli $2.5'tir; x1.30 çarpanla $3.25 kazanır
    // (değer tam sayıya değil kuruşa yuvarlanır).
    assert.strictEqual(factoryEconomy.getExportMultiplier(), 1.30);
    const singleExportEarnings = factoryEconomy.exportItem('iron_powder');
    assert.strictEqual(singleExportEarnings, 3.25);
  });

  it('5. SaveManager v3 Full Round-Trip Persistence & Factory State Restoration', () => {
    // 1. Durum Oluşturma
    const economy = new EconomyManager();
    economy.addResources(1450);
    const factoryEconomy = new FactoryEconomy(0, defaultItemRegistry, economy);
    factoryEconomy.revenueMultiplier = 1.30;
    const grid = new GridMap(24, 24);
    const plotManager = new PlotExpansionManager(factoryEconomy, grid);
    plotManager.unlockPlot(1); // 12x8 boyutu ($500 harcanır -> 1450 - 500 = 950)

    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics, defaultRecipeRegistry, defaultMachineRegistry);
    const bridge = new RocketHangarBridge(defaultItemRegistry);
    bridge.syncModuleLevels({ hull: 2, engine: 3, wings: 1, boost: 1 });

    grid.setIntake(1, 0, 'iron_ore', 1.0);
    grid.setExport(6, 7);

    const crusherDef = defaultMachineRegistry.getOrThrow('crusher');
    const crusher = new MachineEntity('saved_crusher', crusherDef, { x: 1, y: 3 }, 0);
    crusher.setRecipe('recipe_crush_iron_ore');
    engine.addMachine(crusher);
    engine.setMachineLevel('saved_crusher', 2); // Lv. 2

    logistics.addConveyor({ x: 1, y: 1 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 2 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 10, y: 4 }, 'EAST', 1.0); // Plot 1 içindeki konveyör

    // 2. Tam Durum Kaydetme (GameScene.saveGame eşleniği)
    const factoryLayout = FactorySerializer.serialize(grid, logistics, engine, factoryEconomy);
    SaveManager.save(economy.serialize(), {
      factoryEconomy,
      hangar: bridge,
      factoryLayout,
    });

    // 3. Tarayıcı Yenilemesi Simülasyonu: Sıfır nesneler oluşturup yükleme
    const freshEconomy = new EconomyManager();
    const freshFactoryEconomy = new FactoryEconomy(0, defaultItemRegistry, freshEconomy);
    const freshGrid = new GridMap(24, 24);
    const freshPlotManager = new PlotExpansionManager(freshFactoryEconomy, freshGrid);
    const freshLogistics = new LogisticsNetwork(freshGrid);
    const freshEngine = new ProductionEngine(freshGrid, freshLogistics, defaultRecipeRegistry, defaultMachineRegistry);
    const freshBridge = new RocketHangarBridge(defaultItemRegistry);

    const { data, wasCorrupted } = SaveManager.loadUnified();
    assert.strictEqual(wasCorrupted, false);

    freshEconomy.deserialize(data.economy);
    freshBridge.deserialize(data.hangar);

    if (data.factoryEconomy) {
      freshFactoryEconomy.unlockedPlots = new Set(data.factoryEconomy.unlockedPlots);
      freshFactoryEconomy.revenueMultiplier = data.factoryEconomy.revenueMultiplier;
    }

    if (data.factoryLayout) {
      if (data.factoryLayout.intakes) {
        for (const intake of data.factoryLayout.intakes) {
          freshGrid.setIntake(intake.coord.x, intake.coord.y, intake.itemId, intake.intervalSec);
        }
      }
      if (data.factoryLayout.exports) {
        for (const exp of data.factoryLayout.exports) {
          freshGrid.setExport(exp.x, exp.y);
        }
      }
      freshLogistics.loadFromSerialized(data.factoryLayout.conveyors);
      freshEngine.loadFromSerialized(data.factoryLayout.machines);
    }

    // 4. Bütünlük Doğrulaması
    assert.strictEqual(freshEconomy.resources.toNumber(), 950);
    assert.strictEqual(freshFactoryEconomy.revenueMultiplier, 1.30);
    assert.strictEqual(freshPlotManager.unlockedPlotCount, 2);
    assert.deepStrictEqual(freshPlotManager.getCurrentBounds(), { width: 12, height: 8 });

    assert.strictEqual(freshBridge.getModuleLevel('hull'), 2);
    assert.strictEqual(freshBridge.getModuleLevel('engine'), 3);

    assert.strictEqual(freshGrid.getCell(1, 0)?.type, 'INTAKE');
    assert.strictEqual(freshGrid.getCell(6, 7)?.type, 'EXPORT');
    assert.ok(freshLogistics.getConveyor(1, 1) !== undefined);
    assert.ok(freshLogistics.getConveyor(10, 4) !== undefined);

    const restoredCrusher = freshEngine.getMachine('saved_crusher');
    assert.ok(restoredCrusher);
    assert.strictEqual(freshEngine.getMachineLevel('saved_crusher'), 2);
    assert.strictEqual(freshEngine.getSpeedMultiplier('saved_crusher'), 1.2);
    assert.strictEqual(restoredCrusher.activeRecipeId, 'recipe_crush_iron_ore');
  });

  it('6. Offline Absence Calculation and CrazyGames 2X Rewarded Ad Claim', () => {
    const economy = new EconomyManager();
    economy.addResources(100);

    const savedTimestamp = Date.now() - 3600 * 1000; // 1 saat önce
    const currentTimestamp = Date.now();
    const productionRate = 20; // Saniyede 20 kaynak

    const report = calculateOfflineReport(savedTimestamp, currentTimestamp, productionRate);

    assert.strictEqual(report.isEligible, true);
    assert.strictEqual(report.effectiveSeconds, 3600);
    assert.strictEqual(report.wasCapped, false);
    assert.strictEqual(report.efficiencyPercent, 50);

    // 3600s * 20 * 0.50 = 36,000 temel kazanç
    assert.strictEqual(report.baseEarnings.toNumber(), 36000);
    assert.strictEqual(report.doubledEarnings.toNumber(), 72000);

    // Oyuncu CrazyGames Rewarded Video izleyerek 2X butonuna basar:
    economy.addResources(report.doubledEarnings.toNumber());
    assert.strictEqual(economy.resources.toNumber(), 100 + 72000);
  });

  it('7. Master Continuous Gameplay Loop: Connecting All Subsystems End-to-End', () => {
    // 1. Yeni Oyuncu Başlatımı
    const economy = new EconomyManager();
    const factoryEconomy = new FactoryEconomy(0, defaultItemRegistry, economy);
    const grid = new GridMap(24, 24);
    const plotManager = new PlotExpansionManager(factoryEconomy, grid);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics, defaultRecipeRegistry, defaultMachineRegistry);
    const bridge = new RocketHangarBridge(defaultItemRegistry);
    bridge.syncModuleLevels(economy.getAllRocketUpgrades());

    // 2. Başlangıç Hat Kurulumu
    grid.setIntake(1, 0, 'iron_ore', 1.0);
    grid.setExport(6, 7);
    const crusher = new MachineEntity('main_crusher', defaultMachineRegistry.getOrThrow('crusher'), { x: 1, y: 3 }, 0);
    crusher.setRecipe('recipe_crush_iron_ore');
    engine.addMachine(crusher);

    logistics.addConveyor({ x: 1, y: 1 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 2 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 4 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 5 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 6 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 7 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 2, y: 7 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 3, y: 7 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 4, y: 7 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 5, y: 7 }, 'EAST', 1.0);

    logistics.onItemDelivered = (evt) => {
      factoryEconomy.exportItem(evt.itemId);
    };

    // 3. Tıklama ile Başlangıç Sermayesi (tıklama sabit $1'dir; hedef çarpanları tıklamayı büyütmez)
    for (let c = 0; c < 500; c++) economy.produceByClick();
    assert.strictEqual(economy.resources.toNumber(), 500);

    // 4. Simülasyon Çalışması (ilk demir tozunun sevkiyata ulaşması ~13 sn sürer)
    for (let t = 0; t < 60; t++) {
      logistics.tick(0.5);
      engine.tick(0.5);
    }
    assert.ok(economy.resources.toNumber() > 500);

    // 5. Parsel Genişletmesi: Plot 1 ($500)
    const unlock = plotManager.unlockPlot(1);
    assert.strictEqual(unlock.success, true);
    assert.deepStrictEqual(plotManager.getCurrentBounds(), { width: 12, height: 8 });

    // 6. Genişletilen Alana Yeni Bant Döşeme
    const placeConv = PlacementMath.executePlacement({
      grid,
      economy: factoryEconomy,
      engine,
      logistics,
      rootCoord: { x: 9, y: 3 },
      itemType: 'CONVEYOR',
      direction: 'EAST',
      unlockedBounds: plotManager.getCurrentBounds(),
    });
    assert.strictEqual(placeConv.success, true);

    // 7. Roket Geliştirmesi
    economy.addResources(3000);
    bridge.depositPart('electric_motor', 5);
    const upgraded = bridge.upgradeModule('engine', factoryEconomy, true);
    assert.strictEqual(upgraded, true);
    assert.strictEqual(bridge.getModuleLevel('engine'), 2);

    // 8. Fırlatma & Mesafe Rekoru & İhracat Çarpanı
    const flightReward = FlightReturnHelper.calculateRewardBreakdown({
      distanceMeters: 1500,
      maxAltitudeMeters: 700,
      gearsCollected: 6,
      crystalsCollected: 4,
      dodgedObstacles: 5,
    });
    economy.addResources(flightReward.totalCash);
    const flightMilestones = FlightReturnHelper.getNewlyUnlockedMilestones(0, 1500);
    FlightReturnHelper.applyMilestonesToEconomy(flightMilestones, factoryEconomy);
    assert.strictEqual(factoryEconomy.revenueMultiplier, 1.30);

    // 9. Kalıcı Kayıt ve Yükleme Testi
    const serialized = FactorySerializer.serialize(grid, logistics, engine, factoryEconomy);
    SaveManager.save(economy.serialize(), {
      factoryEconomy,
      hangar: bridge,
      factoryLayout: serialized,
    });

    const loaded = SaveManager.loadUnified();
    assert.strictEqual(loaded.wasCorrupted, false);
    assert.strictEqual(loaded.data.factoryEconomy?.revenueMultiplier, 1.30);
    assert.strictEqual(loaded.data.hangar.levels.engine, 2);
    assert.strictEqual(loaded.data.factoryLayout?.conveyors.some(c => c.coord.x === 9 && c.coord.y === 3), true);
  });
});
