/* ======================================================================
 * src/factory/simulation/RocketHangarBridge.ts — Hangar Tedarik Köprüsü
 *
 * Fabrika konveyör hatlarından çıkan havacılık parçalarını (Gövde Paneli,
 * Roket Motoru, Aviyonik, Yakıt vb.) depolayan, roket modüllerinin
 * fiziksel parçalar + sermaye ile yükseltilmesini sağlayan ve uçuş
 * dönüş ödüllerini fabrika ekonomisine bağlayan saf TypeScript köprü.
 * (docs/DECISIONS.md DEC-009, docs/MASTER_PLAN.md FAZ 5)
 *
 * Saf TypeScript — Node 24 native test koşucusu ile %100 uyumludur.
 * ====================================================================== */

import { FactoryEconomy } from './FactoryEconomy.ts';
import { ItemRegistry, defaultItemRegistry } from './ItemRegistry.ts';
import { FlightReturnHelper } from '../../scenes/FlightReturnHelper.ts';
import { MAX_ROCKET_LEVEL, getRocketClass } from '../../data/RocketData.ts';
import { RangeLadder, type RangeRung } from '../../flight/RangeLadder.ts';

export type RocketModuleCategory = 'hull' | 'engine' | 'wings' | 'boost';

export interface RocketPartRequirement {
  itemId: string;
  itemName: string;
  count: number;
}

export interface RocketModuleUpgradeCost {
  targetLevel: number;
  cashCost: number;
  requiredParts: RocketPartRequirement[];
}

export interface FlightResultInput {
  distanceMeters: number;
  partsCollected: number;
  crystalsCollected: number;
  dodgedObstacles?: number;
  altitudeMeters?: number;
  /** Uçuşu yapan roket sınıfının menzil çarpanı (prim çarpansız mesafeden hesaplanır) */
  rangeScale?: number;
}

export interface FlightReturnSummary {
  distanceMeters: number;
  cashGained: number;
  isNewBestDistance: boolean;
  totalFlights: number;
  bestDistance: number;
  milestoneBonusMultiplier?: number;
}

export interface RocketHangarSaveData {
  levels: Record<RocketModuleCategory, number>;
  inventory: Record<string, number>;
  flightStats: {
    totalFlights: number;
    totalDistance: number;
    bestDistance: number;
    totalCashEarned: number;
  };
  /** Parçaları toplanan hedef modül; null ise bütün modüller için toplanır */
  targetModule?: RocketModuleCategory | null;
  /** Rekorun hangi uçuş modeliyle tutulduğu (yoksa eski model) */
  recordVersion?: number;
}

/** Hızlı inşa teklifi: nakitle tamamlanabilir mi, ne kadar tutar */
export interface QuickBuildQuote {
  /** Her parçanın eksiği nakitle tamamlanabilecek sınırın içinde mi? */
  allowed: boolean;
  /** Eksik parçaların nakit bedeli */
  partsCost: number;
  /** Yükseltme nakdi + eksik parçaların bedeli */
  totalCost: number;
}

/** Hangar tarafından kabul edilen özel havacılık ve roket bileşenleri */
export const ACCEPTED_AEROSPACE_ITEMS = new Set<string>([
  'reinforced_frame',
  'aero_hull_plate',
  'electric_motor',
  'rocket_thruster_block',
  'microchip',
  'guidance_computer',
  'plastic_pellet',
  'optical_sensor',
  'steel_gear',
  'optical_glass',
  'circuit_substrate',
  'copper_wire',
]);

/** Bir modülün ulaşabileceği en yüksek seviye */
export const MAX_MODULE_LEVEL = MAX_ROCKET_LEVEL;

/**
 * Hızlı inşada eksik parçanın birim bedeli = güncel satış değeri (gelir çarpanı dahil)
 * × bu çarpan. Pahalı bir kestirmedir; fabrikada üretmenin yerini alamaz (DEC-012, DEC-029).
 */
export const QUICK_BUILD_PRICE_MULTIPLIER = 10;

/** Her parçanın en fazla bu kadarı nakitle tamamlanabilir; gerisi fabrikadan gelmelidir */
export const QUICK_BUILD_MAX_SHARE = 0.25;

/**
 * Rekorun tutulduğu uçuş modelinin sürümü. Sürüm 2 (DEC-028) öncesindeki rekorlar eski
 * fizikle yapıldığı için merdivenin 5 km basamağında kesilir; yeni basamaklar yeni
 * modelle uçularak geçilir.
 */
export const FLIGHT_RECORD_VERSION = 2;
const LEGACY_RECORD_CAP_METERS = 5000;

/**
 * 4 roket modülünün Seviye 1 -> 2 ve Seviye 2 -> 3 yükseltme maliyetleri.
 * Erken aşamada Tier 2-3 parçalar, son aşamada Tier 4 havacılık parçaları gerektirir.
 */
export const ROCKET_MODULE_UPGRADES: Record<
  RocketModuleCategory,
  Record<number, { cashCost: number; parts: { itemId: string; count: number }[] }>
> = {
  hull: {
    2: {
      cashCost: 500,
      parts: [{ itemId: 'reinforced_frame', count: 5 }],
    },
    3: {
      cashCost: 2500,
      parts: [{ itemId: 'aero_hull_plate', count: 8 }],
    },
  },
  engine: {
    2: {
      cashCost: 750,
      parts: [{ itemId: 'electric_motor', count: 6 }],
    },
    3: {
      cashCost: 3500,
      parts: [{ itemId: 'rocket_thruster_block', count: 5 }],
    },
  },
  wings: {
    2: {
      cashCost: 600,
      parts: [{ itemId: 'microchip', count: 6 }],
    },
    3: {
      cashCost: 3000,
      parts: [{ itemId: 'guidance_computer', count: 6 }],
    },
  },
  boost: {
    2: {
      cashCost: 400,
      parts: [{ itemId: 'plastic_pellet', count: 20 }],
    },
    3: {
      cashCost: 2000,
      parts: [{ itemId: 'plastic_pellet', count: 50 }],
    },
  },
};

/* ---- Sv.4–10 (Mk II–IV): formülle üretilen yükseltme tablosu (DEC-029) ---- */

const UPPER_TIER_FIRST_LEVEL = 4;
/** Nakit her seviyede bu oranda büyür */
const UPPER_TIER_CASH_GROWTH = 2.4;
/** Parça adedi her seviyede bu oranda büyür */
const UPPER_TIER_PART_GROWTH = 1.8;

const UPPER_TIER_CASH_BASE: Readonly<Record<RocketModuleCategory, number>> = {
  hull: 30000,
  engine: 40000,
  wings: 35000,
  boost: 25000,
};

/**
 * Üst seviyelerin parça karışımı: `base`, parçanın ilk istendiği seviyedeki (`fromLevel`)
 * adedidir. Karışım bütün üretim zincirlerini kapsar; her zincirin roket için bir işi olur.
 */
const UPPER_TIER_PARTS: Readonly<
  Record<RocketModuleCategory, ReadonlyArray<{ itemId: string; base: number; fromLevel: number }>>
> = {
  hull: [
    { itemId: 'reinforced_frame', base: 40, fromLevel: 4 },
    { itemId: 'aero_hull_plate', base: 30, fromLevel: 4 },
    { itemId: 'optical_glass', base: 60, fromLevel: 7 },
  ],
  engine: [
    { itemId: 'electric_motor', base: 40, fromLevel: 4 },
    { itemId: 'rocket_thruster_block', base: 12, fromLevel: 4 },
    { itemId: 'steel_gear', base: 100, fromLevel: 7 },
  ],
  wings: [
    { itemId: 'microchip', base: 30, fromLevel: 4 },
    { itemId: 'guidance_computer', base: 10, fromLevel: 4 },
    { itemId: 'optical_sensor', base: 30, fromLevel: 5 },
  ],
  boost: [
    { itemId: 'plastic_pellet', base: 200, fromLevel: 4 },
    { itemId: 'circuit_substrate', base: 40, fromLevel: 4 },
    { itemId: 'copper_wire', base: 150, fromLevel: 6 },
  ],
};

/** Nakdi üç anlamlı basamağa yuvarlar (172.800 -> 173.000) */
function roundCash(value: number): number {
  const magnitude = Math.pow(10, Math.max(0, Math.floor(Math.log10(value)) - 2));
  return Math.round(value / magnitude) * magnitude;
}

/**
 * Bir modülü `targetLevel` seviyesine çıkarmanın bedeli. Sv.2–3 sabit tablodan,
 * Sv.4–10 formülden gelir. Geçersiz seviye için null döner.
 */
export function getModuleUpgradeDefinition(
  category: RocketModuleCategory,
  targetLevel: number,
): { cashCost: number; parts: { itemId: string; count: number }[] } | null {
  if (targetLevel < 2 || targetLevel > MAX_MODULE_LEVEL) return null;

  if (targetLevel < UPPER_TIER_FIRST_LEVEL) {
    const fixed = ROCKET_MODULE_UPGRADES[category]?.[targetLevel];
    return fixed ? { cashCost: fixed.cashCost, parts: fixed.parts.map((p) => ({ ...p })) } : null;
  }

  const step = targetLevel - UPPER_TIER_FIRST_LEVEL;
  return {
    cashCost: roundCash(UPPER_TIER_CASH_BASE[category] * Math.pow(UPPER_TIER_CASH_GROWTH, step)),
    parts: UPPER_TIER_PARTS[category]
      .filter((part) => targetLevel >= part.fromLevel)
      .map((part) => ({
        itemId: part.itemId,
        count: Math.ceil((part.base * Math.pow(UPPER_TIER_PART_GROWTH, targetLevel - part.fromLevel)) / 5) * 5,
      })),
  };
}

const MODULE_CATEGORIES: readonly RocketModuleCategory[] = ['hull', 'engine', 'wings', 'boost'];

export class RocketHangarBridge {
  private itemRegistry: ItemRegistry;

  /** Roket modül seviyeleri (1..MAX_MODULE_LEVEL) */
  private moduleLevels: Record<RocketModuleCategory, number> = {
    hull: 1,
    engine: 1,
    wings: 1,
    boost: 1,
  };

  /** Hangarda stoklanan fiziksel havacılık parçaları (itemId -> count) */
  private inventory = new Map<string, number>();

  /** Parçaları toplanan hedef modül; null ise bütün modüllerin ihtiyacı toplanır */
  private targetModule: RocketModuleCategory | null = null;

  /** Kariyer uçuş istatistikleri */
  private flightStats = {
    totalFlights: 0,
    totalDistance: 0,
    bestDistance: 0,
    totalCashEarned: 0,
  };

  // Dinleyici kancaları (UI güncellemeleri veya kutlama sesleri için)
  onModuleUpgraded?: (category: RocketModuleCategory, newLevel: number) => void;
  onPartDeposited?: (itemId: string, newTotal: number) => void;
  onFlightReturned?: (summary: FlightReturnSummary) => void;

  constructor(itemRegistry: ItemRegistry = defaultItemRegistry) {
    this.itemRegistry = itemRegistry;
  }

  // -------------------------------------------------------------
  // PARÇA KABUL VE ENVANTER YÖNETİMİ
  // -------------------------------------------------------------

  /** Belirtilen eşya hangar için geçerli bir havacılık parçası mı? */
  isAerospacePart(itemId: string): boolean {
    return ACCEPTED_AEROSPACE_ITEMS.has(itemId);
  }

  /**
   * Fabrika konveyöründen veya teslimat silosundan hangara parça aktarır.
   * Yalnızca havacılık parçalarını kabul eder; hammadde veya ilgisiz eşyaları reddeder.
   */
  depositPart(itemId: string, count = 1): boolean {
    if (count <= 0) return false;
    if (!this.isAerospacePart(itemId)) return false;

    const current = this.inventory.get(itemId) ?? 0;
    const next = current + count;
    this.inventory.set(itemId, next);

    if (this.onPartDeposited) {
      this.onPartDeposited(itemId, next);
    }
    return true;
  }

  /** Hangardaki belirli bir parçanın mevcut stok adedini döner */
  getPartCount(itemId: string): number {
    return this.inventory.get(itemId) ?? 0;
  }

  /** Tüm hangar envanterini obje olarak döner */
  getInventory(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, value] of this.inventory.entries()) {
      result[key] = value;
    }
    return result;
  }

  // -------------------------------------------------------------
  // ROKET MODÜLLERİ VE YÜKSELTME SİSTEMİ
  // -------------------------------------------------------------

  /** Belirtilen modülün mevcut seviyesini döner (1..MAX_MODULE_LEVEL) */
  getModuleLevel(category: RocketModuleCategory): number {
    return this.moduleLevels[category] ?? 1;
  }

  /** 4 modülün tüm seviyelerini kopya olarak döner */
  getAllModuleLevels(): Record<RocketModuleCategory, number> {
    return { ...this.moduleLevels };
  }

  /** Modül seviyelerini harici kayıt/ekonomi verisiyle senkronize eder */
  syncModuleLevels(levels: Record<string, number>): void {
    for (const cat of ['hull', 'engine', 'wings', 'boost'] as RocketModuleCategory[]) {
      if (typeof levels[cat] === 'number') {
        this.moduleLevels[cat] = Math.min(MAX_MODULE_LEVEL, Math.max(1, Math.floor(levels[cat])));
      }
    }
  }

  /** Roket sınıfı: en düşük modül seviyesi (uçuşta menzil çarpanını belirler) */
  getRocketClass(): number {
    return getRocketClass(this.moduleLevels);
  }

  /** Menzil rekoruyla açılmış en yüksek modül seviyesi (Mk kademesi) */
  getLevelCap(): number {
    return RangeLadder.rocketLevelCap(this.flightStats.bestDistance);
  }

  /**
   * Sıradaki yükseltme bir menzil izni bekliyorsa o basamağı döner; beklemiyorsa
   * (ya da modül son seviyedeyse) null.
   */
  getUpgradeLock(category: RocketModuleCategory): RangeRung | null {
    const nextLevel = this.getModuleLevel(category) + 1;
    if (nextLevel > MAX_MODULE_LEVEL || nextLevel <= this.getLevelCap()) return null;
    return RangeLadder.rungForRocketLevel(nextLevel);
  }

  /** Parçaları toplanan hedef modül (null: hepsi) */
  getTargetModule(): RocketModuleCategory | null {
    return this.targetModule;
  }

  /** Hedef modülü seçer; null verilirse bütün modüllerin parçaları toplanır */
  setTargetModule(category: RocketModuleCategory | null): void {
    this.targetModule = category;
  }

  /** Bu modülün parçaları şu an ihracattan ayrılıyor mu? */
  isCollectingFor(category: RocketModuleCategory): boolean {
    return this.targetModule === null || this.targetModule === category;
  }

  /** Modül için gerekli tüm parçalar hangarda mevcut mu? */
  hasRequiredParts(category: RocketModuleCategory): boolean {
    const cost = this.getUpgradeCost(category);
    if (!cost) return false;
    for (const req of cost.requiredParts) {
      if (this.getPartCount(req.itemId) < req.count) {
        return false;
      }
    }
    return true;
  }

  /** Modül yükseltmesi için eksik olan parçaları ve bunların birim/toplam maliyetlerini listeler */
  getMissingParts(
    category: RocketModuleCategory,
    revenueMultiplier = 1,
  ): {
    itemId: string;
    itemName: string;
    missingCount: number;
    /** Nakitle tamamlanabilecek en fazla adet (toplam ihtiyacın QUICK_BUILD_MAX_SHARE'i) */
    purchasableCount: number;
    unitCost: number;
    missingTotalCost: number;
  }[] {
    const cost = this.getUpgradeCost(category);
    if (!cost) return [];

    const result: {
      itemId: string;
      itemName: string;
      missingCount: number;
      purchasableCount: number;
      unitCost: number;
      missingTotalCost: number;
    }[] = [];

    for (const req of cost.requiredParts) {
      const stock = this.getPartCount(req.itemId);
      if (stock < req.count) {
        const missingCount = req.count - stock;
        const item = this.itemRegistry.get(req.itemId);
        const unitCost = Math.ceil(
          (item ? item.baseValue : 50) * Math.max(1, revenueMultiplier) * QUICK_BUILD_PRICE_MULTIPLIER,
        );
        result.push({
          itemId: req.itemId,
          itemName: req.itemName,
          missingCount,
          purchasableCount: Math.floor(req.count * QUICK_BUILD_MAX_SHARE),
          unitCost,
          missingTotalCost: missingCount * unitCost,
        });
      }
    }
    return result;
  }

  /** Eksik parçaların toplam piyasa tedarik maliyeti */
  getMissingPartsTotalCost(category: RocketModuleCategory, revenueMultiplier = 1): number {
    const missing = this.getMissingParts(category, revenueMultiplier);
    return missing.reduce((sum, p) => sum + p.missingTotalCost, 0);
  }

  /** Eksik parçaların nakit karşılığı dahil toplam yükseltme maliyeti */
  getTotalUpgradeCostWithMissingParts(category: RocketModuleCategory, revenueMultiplier = 1): number {
    const cost = this.getUpgradeCost(category);
    if (!cost) return 0;
    return cost.cashCost + this.getMissingPartsTotalCost(category, revenueMultiplier);
  }

  /**
   * Hızlı inşa teklifi. Her parçanın eksiği, toplam ihtiyacın QUICK_BUILD_MAX_SHARE'ini
   * aşmıyorsa nakitle tamamlanabilir; aşıyorsa önce fabrikada üretilmelidir.
   */
  getQuickBuildQuote(category: RocketModuleCategory, revenueMultiplier = 1): QuickBuildQuote {
    const cost = this.getUpgradeCost(category);
    if (!cost) return { allowed: false, partsCost: 0, totalCost: 0 };

    const missing = this.getMissingParts(category, revenueMultiplier);
    const partsCost = missing.reduce((sum, p) => sum + p.missingTotalCost, 0);
    return {
      allowed: missing.length > 0 && missing.every((p) => p.missingCount <= p.purchasableCount),
      partsCost,
      totalCost: cost.cashCost + partsCost,
    };
  }

  /** Oyuncu eksik parçaları nakitle tedarik ederek hızlı inşa yapabilir mi? */
  canAffordQuickBuild(category: RocketModuleCategory, economy: FactoryEconomy): boolean {
    if (this.getUpgradeLock(category)) return false;
    const quote = this.getQuickBuildQuote(category, economy.revenueMultiplier);
    return quote.allowed && economy.canAfford(quote.totalCost);
  }

  /**
   * Belirtilen modülün sıradaki yükseltme gereksinimlerini döner.
   * Zaten en yüksek seviyede ise null döner. Menzil izni bekleyen seviye için de bedel
   * döner (oyuncu ne isteneceğini görsün); izin durumu `getUpgradeLock` ile sorulur.
   */
  getUpgradeCost(category: RocketModuleCategory): RocketModuleUpgradeCost | null {
    const currentLevel = this.getModuleLevel(category);
    if (currentLevel >= MAX_MODULE_LEVEL) return null;

    const nextLevel = currentLevel + 1;
    const upgradeData = getModuleUpgradeDefinition(category, nextLevel);
    if (!upgradeData) return null;

    const requiredParts: RocketPartRequirement[] = upgradeData.parts.map((p) => {
      const item = this.itemRegistry.get(p.itemId);
      return {
        itemId: p.itemId,
        itemName: item ? item.name : p.itemId,
        count: p.count,
      };
    });

    return {
      targetLevel: nextLevel,
      cashCost: upgradeData.cashCost,
      requiredParts,
    };
  }

  /**
   * Oyuncunun cüzdanı ve hangar parça stoku bu yükseltmeyi karşılayabiliyor mu?
   */
  canAffordUpgrade(category: RocketModuleCategory, economy: FactoryEconomy): boolean {
    const cost = this.getUpgradeCost(category);
    if (!cost || this.getUpgradeLock(category)) return false;

    // 1. Nakit bakiye kontrolü
    if (!economy.canAfford(cost.cashCost)) {
      return false;
    }

    // 2. Parça stoku kontrolü
    for (const req of cost.requiredParts) {
      const currentStock = this.getPartCount(req.itemId);
      if (currentStock < req.count) {
        return false;
      }
    }

    return true;
  }

  /**
   * Roket modülünü yükseltir: Gerekli parçaları stoktan siler, parayı cüzdandan düşer.
   * allowProcureMissing = true ise eksik parçaları nakit bedeliyle satın alarak tamamlar.
   */
  upgradeModule(
    category: RocketModuleCategory,
    economy: FactoryEconomy,
    allowProcureMissing = false,
  ): boolean {
    const cost = this.getUpgradeCost(category);
    if (!cost || this.getUpgradeLock(category)) return false;

    const hasAllParts = this.hasRequiredParts(category);

    if (!hasAllParts && !allowProcureMissing) {
      return false;
    }

    // Eksik parça nakitle ancak sınırın içindeyse tamamlanır
    const quote = this.getQuickBuildQuote(category, economy.revenueMultiplier);
    if (!hasAllParts && !quote.allowed) {
      return false;
    }

    const totalCashNeeded = hasAllParts ? cost.cashCost : quote.totalCost;

    if (!economy.canAfford(totalCashNeeded)) {
      return false;
    }

    // 1. Parayı cüzdandan harca
    const spent = economy.spendMoney(totalCashNeeded);
    if (!spent) return false;

    // 2. Mevcut parçaları stoktan düş (en fazla eldeki kadar)
    for (const req of cost.requiredParts) {
      const current = this.getPartCount(req.itemId);
      this.inventory.set(req.itemId, Math.max(0, current - req.count));
    }

    // 3. Seviyeyi artır
    this.moduleLevels[category] = cost.targetLevel;

    if (this.onModuleUpgraded) {
      this.onModuleUpgraded(category, cost.targetLevel);
    }

    return true;
  }

  /**
   * Sıradaki yükseltmeler için bu parçadan hangarın hâlâ beklediği adet.
   * Fabrika ihracatı, bu sayı sıfırlanana kadar parçayı satmak yerine hangara yollar.
   */
  getOutstandingNeed(itemId: string): number {
    let required = 0;
    for (const cat of MODULE_CATEGORIES) {
      // Hedef modül seçiliyse yalnız onun parçaları ayrılır; izin bekleyen seviye için toplanmaz
      if (!this.isCollectingFor(cat) || this.getUpgradeLock(cat)) continue;
      const cost = this.getUpgradeCost(cat);
      if (!cost) continue;
      for (const req of cost.requiredParts) {
        if (req.itemId === itemId) required += req.count;
      }
    }
    return Math.max(0, required - this.getPartCount(itemId));
  }

  /** Bu parçayı sıradaki yükseltmesinde isteyen ve artık tüm parçaları tamam olan modüller */
  getModulesCompletedBy(itemId: string): RocketModuleCategory[] {
    const result: RocketModuleCategory[] = [];
    for (const cat of ['hull', 'engine', 'wings', 'boost'] as RocketModuleCategory[]) {
      const cost = this.getUpgradeCost(cat);
      if (cost?.requiredParts.some((req) => req.itemId === itemId) && this.hasRequiredParts(cat)) {
        result.push(cat);
      }
    }
    return result;
  }

  /**
   * Roket fırlatmaya hazır mı? (En azından temel gövde ve motor Seviye 1 olmalıdır)
   */
  isReadyForLaunch(): boolean {
    return this.moduleLevels.hull >= 1 && this.moduleLevels.engine >= 1;
  }

  // -------------------------------------------------------------
  // UÇUŞ DÖNÜŞÜ VE FABRİKA EKONOMİSİNE GERİ AKIŞ (FLIGHT LOOP)
  // -------------------------------------------------------------

  /**
   * Uçuş sahnesi bittiğinde çağrılır: Kat edilen mesafeyi ve toplanan hurdaları
   * nakit ödüllere dönüştürür ve doğrudan fabrika ekonomisine aktarır.
   */
  processFlightResult(result: FlightResultInput, economy: FactoryEconomy): FlightReturnSummary {
    const distance = Math.max(0, Math.floor(result.distanceMeters));
    const previousBestDistance = this.flightStats.bestDistance;
    const isNewBestDistance = distance > previousBestDistance;

    // Yeni açılan kilometre taşlarını kontrol et ve fabrika gelir çarpanını kalıcı olarak yükselt
    const newlyUnlocked = FlightReturnHelper.getNewlyUnlockedMilestones(previousBestDistance, distance);
    const milestoneBonus = FlightReturnHelper.applyMilestonesToEconomy(newlyUnlocked, economy);

    // Uçuş ekonomisi formülü ve ödül dökümü
    const breakdown = FlightReturnHelper.calculateRewardBreakdown(
      {
        distanceMeters: distance,
        maxAltitudeMeters: result.altitudeMeters ?? 0,
        gearsCollected: result.partsCollected,
        crystalsCollected: result.crystalsCollected,
        dodgedObstacles: result.dodgedObstacles ?? 0,
        rangeScale: result.rangeScale,
      },
      economy.getRevenuePerSec(),
    );
    const totalCashGained = breakdown.totalCash;

    // Fabrika cüzdanına ekle
    if (totalCashGained > 0) {
      economy.addMoney(totalCashGained, 'ROCKET');
    }

    // İstatistikleri güncelle
    this.flightStats.totalFlights++;
    this.flightStats.totalDistance += distance;
    this.flightStats.totalCashEarned += totalCashGained;

    if (isNewBestDistance) {
      this.flightStats.bestDistance = distance;
    }

    const summary: FlightReturnSummary = {
      distanceMeters: distance,
      cashGained: totalCashGained,
      isNewBestDistance,
      totalFlights: this.flightStats.totalFlights,
      bestDistance: this.flightStats.bestDistance,
      milestoneBonusMultiplier: milestoneBonus > 0 ? milestoneBonus : undefined,
    };

    if (this.onFlightReturned) {
      this.onFlightReturned(summary);
    }

    return summary;
  }

  /** Kariyer uçuş istatistiklerini döner */
  getFlightStats() {
    return { ...this.flightStats };
  }

  // -------------------------------------------------------------
  // SERİLEŞTİRME VE KAYIT YÖNETİMİ
  // -------------------------------------------------------------

  /** Hangar köprüsü durumunu saf JSON'a serileştirir */
  serialize(): RocketHangarSaveData {
    return {
      levels: { ...this.moduleLevels },
      inventory: this.getInventory(),
      flightStats: { ...this.flightStats },
      targetModule: this.targetModule,
      recordVersion: FLIGHT_RECORD_VERSION,
    };
  }

  /** Serileştirilmiş durumdan hangar verilerini geri yükler */
  deserialize(data: Partial<RocketHangarSaveData>): void {
    if (data.levels && typeof data.levels === 'object') {
      for (const cat of ['hull', 'engine', 'wings', 'boost'] as RocketModuleCategory[]) {
        if (typeof data.levels[cat] === 'number') {
          this.moduleLevels[cat] = Math.min(MAX_MODULE_LEVEL, Math.max(1, Math.floor(data.levels[cat])));
        }
      }
    }

    this.targetModule = MODULE_CATEGORIES.includes(data.targetModule as RocketModuleCategory)
      ? (data.targetModule as RocketModuleCategory)
      : null;

    if (data.inventory && typeof data.inventory === 'object') {
      this.inventory.clear();
      for (const [key, val] of Object.entries(data.inventory)) {
        if (typeof val === 'number' && val > 0) {
          this.inventory.set(key, Math.floor(val));
        }
      }
    }

    if (data.flightStats && typeof data.flightStats === 'object') {
      this.flightStats = {
        totalFlights: Number(data.flightStats.totalFlights) || 0,
        totalDistance: Number(data.flightStats.totalDistance) || 0,
        bestDistance: Number(data.flightStats.bestDistance) || 0,
        totalCashEarned: Number(data.flightStats.totalCashEarned) || 0,
      };
      // Eski uçuş modeliyle yapılmış rekor merdivenin 5 km basamağında kesilir
      if ((data.recordVersion ?? 1) < FLIGHT_RECORD_VERSION) {
        this.flightStats.bestDistance = Math.min(this.flightStats.bestDistance, LEGACY_RECORD_CAP_METERS);
      }
    }
  }
}
