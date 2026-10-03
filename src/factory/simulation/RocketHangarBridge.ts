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
]);

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

export class RocketHangarBridge {
  private itemRegistry: ItemRegistry;

  /** Roket modül seviyeleri (1..3) */
  private moduleLevels: Record<RocketModuleCategory, number> = {
    hull: 1,
    engine: 1,
    wings: 1,
    boost: 1,
  };

  /** Hangarda stoklanan fiziksel havacılık parçaları (itemId -> count) */
  private inventory = new Map<string, number>();

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

  /** Belirtilen modülün mevcut seviyesini döner (1..3) */
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
        this.moduleLevels[cat] = Math.min(3, Math.max(1, Math.floor(levels[cat])));
      }
    }
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
  getMissingParts(category: RocketModuleCategory): {
    itemId: string;
    itemName: string;
    missingCount: number;
    unitCost: number;
    missingTotalCost: number;
  }[] {
    const cost = this.getUpgradeCost(category);
    if (!cost) return [];

    const result: {
      itemId: string;
      itemName: string;
      missingCount: number;
      unitCost: number;
      missingTotalCost: number;
    }[] = [];

    for (const req of cost.requiredParts) {
      const stock = this.getPartCount(req.itemId);
      if (stock < req.count) {
        const missingCount = req.count - stock;
        const item = this.itemRegistry.get(req.itemId);
        const unitCost = item ? item.baseValue : 50;
        result.push({
          itemId: req.itemId,
          itemName: req.itemName,
          missingCount,
          unitCost,
          missingTotalCost: missingCount * unitCost,
        });
      }
    }
    return result;
  }

  /** Eksik parçaların toplam piyasa tedarik maliyeti */
  getMissingPartsTotalCost(category: RocketModuleCategory): number {
    const missing = this.getMissingParts(category);
    return missing.reduce((sum, p) => sum + p.missingTotalCost, 0);
  }

  /** Eksik parçaların nakit karşılığı dahil toplam yükseltme maliyeti */
  getTotalUpgradeCostWithMissingParts(category: RocketModuleCategory): number {
    const cost = this.getUpgradeCost(category);
    if (!cost) return 0;
    return cost.cashCost + this.getMissingPartsTotalCost(category);
  }

  /** Oyuncu eksik parçaları nakitle tedarik ederek hızlı inşa yapabilir mi? */
  canAffordQuickBuild(category: RocketModuleCategory, economy: FactoryEconomy): boolean {
    const totalCost = this.getTotalUpgradeCostWithMissingParts(category);
    return totalCost > 0 && economy.canAfford(totalCost);
  }

  /**
   * Belirtilen modülün sıradaki yükseltme gereksinimlerini döner.
   * Zaten maksimum seviyede ise (Seviye 3) null döner.
   */
  getUpgradeCost(category: RocketModuleCategory): RocketModuleUpgradeCost | null {
    const currentLevel = this.getModuleLevel(category);
    if (currentLevel >= 3) return null;

    const nextLevel = currentLevel + 1;
    const upgradeData = ROCKET_MODULE_UPGRADES[category]?.[nextLevel];
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
    if (!cost) return false;

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
    if (!cost) return false;

    const hasAllParts = this.hasRequiredParts(category);

    if (!hasAllParts && !allowProcureMissing) {
      return false;
    }

    const totalCashNeeded = allowProcureMissing
      ? this.getTotalUpgradeCostWithMissingParts(category)
      : cost.cashCost;

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

  /** Uçuşta toplanan uzay hurdaları ve kristalleri havacılık parçası olarak stoğa ekler */
  depositFlightSalvage(gearsCollected: number, crystalsCollected: number): void {
    if (gearsCollected > 0) {
      const frameCount = Math.floor(gearsCollected / 2);
      const motorCount = Math.ceil(gearsCollected / 2);
      if (frameCount > 0) this.depositPart('reinforced_frame', frameCount);
      if (motorCount > 0) this.depositPart('electric_motor', motorCount);
      this.depositPart('steel_gear', gearsCollected);
    }
    if (crystalsCollected > 0) {
      this.depositPart('plastic_pellet', crystalsCollected * 5);
      if (crystalsCollected >= 2) {
        this.depositPart('microchip', Math.floor(crystalsCollected / 2));
      }
    }
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
    const breakdown = FlightReturnHelper.calculateRewardBreakdown({
      distanceMeters: distance,
      maxAltitudeMeters: result.altitudeMeters ?? 0,
      gearsCollected: result.partsCollected,
      crystalsCollected: result.crystalsCollected,
      dodgedObstacles: result.dodgedObstacles ?? 0,
    });
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
    };
  }

  /** Serileştirilmiş durumdan hangar verilerini geri yükler */
  deserialize(data: Partial<RocketHangarSaveData>): void {
    if (data.levels && typeof data.levels === 'object') {
      for (const cat of ['hull', 'engine', 'wings', 'boost'] as RocketModuleCategory[]) {
        if (typeof data.levels[cat] === 'number') {
          this.moduleLevels[cat] = Math.min(3, Math.max(1, Math.floor(data.levels[cat])));
        }
      }
    }

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
    }
  }
}
