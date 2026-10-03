/* ======================================================================
 * EconomyManager.ts — Oyun ekonomisi ve makine yönetimi (Decimal tabanlı)
 *
 * Phaser'dan bağımsızdır; saf veri + break_eternity.js hesaplama katmanı.
 * Sahne bu sınıfın durumunu okuyarak UI ve fabrikayı günceller.
 * ====================================================================== */

import Decimal, { type DecimalSource } from 'break_eternity.js';
import { D, D_ZERO, D_ONE } from '../utils/decimal.ts';
import {
  MACHINES,
  MACHINE_LEVEL_MILESTONES,
  FACTORY_GOALS,
  BASE_CLICK_POWER,
  type MachineDefinition,
  type FactoryGoal,
  type LevelMilestone,
} from '../data/MachineData.ts';
import { ROCKET_UPGRADES, type RocketUpgradeDef } from '../data/RocketData.ts';

/* ---- Çalışma zamanı makine durumu ---- */

export interface MachineState {
  /** Makine tanım indeksi (MACHINES dizisindeki sıra) */
  definitionIndex: number;
  /** Mevcut seviye (0 = satın alınmamış) */
  level: number;
}

/* ---- Dışarıya açılan olay tipleri ---- */

export type EconomyEventType =
  | 'purchase'
  | 'upgrade'
  | 'click'
  | 'unlock'
  | 'goal_reached'
  | 'offline'
  | 'rocket_upgrade'
  | 'flight_complete';

export interface EconomyEvent {
  type: EconomyEventType;
  machineId?: string;
  upgradeId?: string;
  amount?: Decimal;
  goalId?: string;
  /** Offline ilerleme süresi (saniye) */
  offlineSeconds?: number;
  newLevel?: number;
}

export type EconomyListener = (evt: EconomyEvent) => void;

/* ---- Ana sınıf ---- */

export class EconomyManager {
  private _resources: Decimal = D_ZERO;
  private _totalEarned: Decimal = D_ZERO;   // Açılma koşulları ve hedefler için toplam kazanım
  private _clickPower: Decimal = D(BASE_CLICK_POWER);

  /** Her makine türü için çalışma zamanı durumu */
  private machines: MachineState[] = [];

  /** Roket bileşenleri seviyeleri */
  private rocketUpgrades: Record<string, number> = {
    hull: 1,
    engine: 1,
    wings: 1,
    boost: 1,
  };

  /** Uçuş istatistikleri */
  public flightStats = {
    totalFlights: 0,
    bestDistance: 0,
    bestScore: 0,
  };

  /** Tamamlanan hedefler */
  private completedGoalIds: Set<string> = new Set();

  /** Olay dinleyicileri */
  private listeners: EconomyListener[] = [];

  constructor() {
    // Her makine tanımı için başlangıç durumu oluştur
    this.machines = MACHINES.map((_, i) => ({
      definitionIndex: i,
      level: 0,
    }));
  }

  /* ============================================================
   * Getter'lar
   * ============================================================ */

  get resources(): Decimal { return this._resources; }
  get totalEarned(): Decimal { return this._totalEarned; }
  get clickPower(): Decimal { return this._clickPower; }

  getMachineState(index: number): MachineState {
    return this.machines[index];
  }

  getMachineDefinition(index: number): MachineDefinition {
    return MACHINES[index];
  }

  get machineCount(): number {
    return this.machines.length;
  }

  /* ============================================================
   * Kilometre taşları ve Çarpanlar
   * ============================================================ */

  /** Makinenin seviyesine göre kazandığı çarpan */
  getMachineMilestoneMultiplier(index: number): number {
    const level = this.machines[index].level;
    let mul = 1;
    for (const ms of MACHINE_LEVEL_MILESTONES) {
      if (level >= ms.level) {
        mul = Math.max(mul, ms.multiplier);
      }
    }
    return mul;
  }

  /** Bir makinenin sıradaki seviye kilometre taşı (varsa) */
  getNextMachineMilestone(index: number): LevelMilestone | null {
    const level = this.machines[index].level;
    for (const ms of MACHINE_LEVEL_MILESTONES) {
      if (level < ms.level) {
        return ms;
      }
    }
    return null;
  }

  /** Tamamlanan genel hedeflerden gelen global üretim çarpanı */
  getGlobalMultiplier(): number {
    let mul = 1;
    for (const goal of FACTORY_GOALS) {
      if (this.completedGoalIds.has(goal.id)) {
        mul *= goal.globalMultiplier;
      }
    }
    return mul;
  }

  /** Sıradaki fabrika hedefi */
  getNextGoal(): {
    goal: FactoryGoal;
    progress: number;
    current: Decimal;
    target: Decimal;
    isCompleted: boolean;
  } | null {
    for (const goal of FACTORY_GOALS) {
      const target = D(goal.targetEarned);
      if (!this.completedGoalIds.has(goal.id)) {
        const current = this._totalEarned;
        let progress = 0;
        if (target.gt(0)) {
          progress = Math.min(1, current.div(target).toNumber());
        }
        return {
          goal,
          progress,
          current,
          target,
          isCompleted: current.gte(target),
        };
      }
    }
    return null;
  }

  /* ============================================================
   * Maliyet / üretim hesapları (Decimal)
   * ============================================================ */

  /** Bir makinenin mevcut seviyesindeki bir sonraki seviye maliyeti */
  getCost(index: number): Decimal {
    const def = MACHINES[index];
    const state = this.machines[index];
    const level = state.level;
    // cost = floor(baseCost * costScale^level)
    return D(def.baseCost).mul(D(def.costScale).pow(level)).floor();
  }

  /** Bir makinenin saniye başına üretimi */
  getProduction(index: number, atLevel?: number): Decimal {
    const def = MACHINES[index];
    const level = atLevel !== undefined ? atLevel : this.machines[index].level;
    if (level === 0) return D_ZERO;

    const base = D(def.baseProduction).mul(level);
    const msMul = this.getMachineMilestoneMultiplier(index);
    const globalMul = this.getGlobalMultiplier();

    return base.mul(msMul).mul(globalMul);
  }

  /** Toplam saniye başına otomatik üretim */
  getTotalProductionPerSecond(): Decimal {
    let total = D_ZERO;
    for (let i = 0; i < this.machines.length; i++) {
      total = total.add(this.getProduction(i));
    }
    return total;
  }

  /** Makine açılmış mı? (toplam kazanım eşiği) */
  isUnlocked(index: number): boolean {
    return this._totalEarned.gte(MACHINES[index].unlockAt);
  }

  /** Satın alma/yükseltme yapılabilir mi? */
  canAfford(index: number): boolean {
    return this._resources.gte(this.getCost(index));
  }

  /* ============================================================
   * Eylemler
   * ============================================================ */

  /** Tıklama ile üretim */
  produceByClick(): Decimal {
    const globalMul = this.getGlobalMultiplier();
    const gained = this._clickPower.mul(globalMul);
    this._resources = this._resources.add(gained);
    this._totalEarned = this._totalEarned.add(gained);

    this.checkGoals();
    this.emit({ type: 'click', amount: gained });
    return gained;
  }

  /** Makine satın al veya yükselt */
  buyOrUpgrade(index: number): boolean {
    if (!this.isUnlocked(index)) return false;
    const cost = this.getCost(index);
    if (this._resources.lt(cost)) return false;

    this._resources = this._resources.sub(cost);
    const state = this.machines[index];
    const wasPurchase = state.level === 0;
    state.level++;

    this.emit({
      type: wasPurchase ? 'purchase' : 'upgrade',
      machineId: MACHINES[index].id,
    });
    return true;
  }

  /** Zaman ilerlemesi — delta saniye kadar otomatik üretim uygula */
  tick(deltaSec: number): Decimal {
    if (deltaSec <= 0) return D_ZERO;
    // Maksimum delta 1 saniye (aşırı delta sıçramalarını önlemek için)
    const safeDelta = Math.min(deltaSec, 1.0);
    const pps = this.getTotalProductionPerSecond();
    if (pps.lte(0)) return D_ZERO;

    const production = pps.mul(safeDelta);
    this._resources = this._resources.add(production);
    this._totalEarned = this._totalEarned.add(production);

    this.checkGoals();
    return production;
  }

  /** Kaynak doğrudan ekle (offline kazanım vb.) */
  addResources(amount: DecimalSource): void {
    const dec = D(amount);
    if (dec.lte(0)) return;
    this._resources = this._resources.add(dec);
    this._totalEarned = this._totalEarned.add(dec);
    this.checkGoals();
  }

  /** Belirtilen miktarda kaynak harcanabilir mi? */
  canAffordAmount(cost: DecimalSource): boolean {
    return this._resources.gte(D(cost));
  }

  /** Kaynak harca; yetersizse false döner */
  spendResources(amount: DecimalSource): boolean {
    const dec = D(amount);
    if (dec.lte(0)) return true;
    if (this._resources.lt(dec)) return false;
    this._resources = this._resources.sub(dec);
    return true;
  }

  /** Hedef tamamlama kontrolü */
  private checkGoals(): void {
    for (const goal of FACTORY_GOALS) {
      if (!this.completedGoalIds.has(goal.id) && this._totalEarned.gte(goal.targetEarned)) {
        this.completedGoalIds.add(goal.id);
        this.emit({ type: 'goal_reached', goalId: goal.id });
      }
    }
  }

  /* ============================================================
   * Roket Yükseltmeleri ve Uçuş
   * ============================================================ */

  getRocketUpgradeLevel(id: string): number {
    return this.rocketUpgrades[id] ?? 1;
  }

  getRocketUpgradeCost(id: string): Decimal {
    const def = ROCKET_UPGRADES.find(u => u.id === id);
    if (!def) return D_ZERO;
    const currentLvl = this.getRocketUpgradeLevel(id);
    if (currentLvl >= def.maxLevel) return D(Infinity);
    return D(def.baseCost).mul(D(def.costScale).pow(currentLvl - 1)).floor();
  }

  canAffordRocketUpgrade(id: string): boolean {
    const def = ROCKET_UPGRADES.find(u => u.id === id);
    if (!def) return false;
    const lvl = this.getRocketUpgradeLevel(id);
    if (lvl >= def.maxLevel) return false;
    return this._resources.gte(this.getRocketUpgradeCost(id));
  }

  buyRocketUpgrade(id: string): boolean {
    const def = ROCKET_UPGRADES.find(u => u.id === id);
    if (!def) return false;
    const lvl = this.getRocketUpgradeLevel(id);
    if (lvl >= def.maxLevel) return false;

    const cost = this.getRocketUpgradeCost(id);
    if (this._resources.lt(cost)) return false;

    this._resources = this._resources.sub(cost);
    const newLvl = lvl + 1;
    this.rocketUpgrades[id] = newLvl;

    this.emit({
      type: 'rocket_upgrade',
      upgradeId: id,
      newLevel: newLvl,
    });
    return true;
  }

  /**
   * Roket modül seviyesini doğrudan belirler ve senkronizasyon olayını tetikler
   * (RocketHangarBridge entegrasyonu için)
   */
  setRocketUpgradeLevel(id: string, level: number): void {
    this.rocketUpgrades[id] = Math.min(3, Math.max(1, level));
    this.emit({
      type: 'rocket_upgrade',
      upgradeId: id,
      newLevel: this.rocketUpgrades[id],
    });
  }

  recordFlightResult(distance: number, score: number, resourcesGained: number): void {
    this.flightStats.totalFlights++;
    this.flightStats.bestDistance = Math.max(this.flightStats.bestDistance, distance);
    this.flightStats.bestScore = Math.max(this.flightStats.bestScore, score);

    if (resourcesGained > 0) {
      this.addResources(resourcesGained);
    }

    this.emit({
      type: 'flight_complete',
      amount: D(resourcesGained),
    });
  }

  get stats() {
    return { ...this.flightStats };
  }

  getAllRocketUpgrades(): Record<string, number> {
    return { ...this.rocketUpgrades };
  }

  /* ============================================================
   * Kayıt / Yükleme (serileştirme)
   * ============================================================ */

  /** Mevcut durumu serileştirilebilir nesne olarak döndürür */
  serialize(): EconomySaveData {
    return {
      resources: this._resources.toString(),
      totalEarned: this._totalEarned.toString(),
      machines: this.machines.map(m => ({ level: m.level })),
      completedGoals: Array.from(this.completedGoalIds),
      rocketUpgrades: { ...this.rocketUpgrades },
      flightStats: { ...this.flightStats },
      timestamp: Date.now(),
    };
  }

  /** Kayıtlı durumu yükler (eski sayı formatlarını da destekler) */
  deserialize(data: EconomySaveData): void {
    this._resources = data.resources !== undefined ? D(data.resources) : D_ZERO;
    this._totalEarned = data.totalEarned !== undefined ? D(data.totalEarned) : D_ZERO;

    if (Array.isArray(data.machines)) {
      for (let i = 0; i < this.machines.length; i++) {
        if (data.machines[i]) {
          this.machines[i].level = data.machines[i].level ?? 0;
        }
      }
    }

    if (Array.isArray(data.completedGoals)) {
      this.completedGoalIds = new Set(data.completedGoals);
    } else {
      this.completedGoalIds.clear();
      // Hedefleri mevcut kazanımla geri hesapla
      this.checkGoals();
    }

    if (data.rocketUpgrades && typeof data.rocketUpgrades === 'object') {
      for (const def of ROCKET_UPGRADES) {
        if (typeof data.rocketUpgrades[def.id] === 'number') {
          this.rocketUpgrades[def.id] = Math.min(
            def.maxLevel,
            Math.max(1, Math.floor(data.rocketUpgrades[def.id])),
          );
        }
      }
    }

    if (data.flightStats && typeof data.flightStats === 'object') {
      this.flightStats = {
        totalFlights: Number(data.flightStats.totalFlights) || 0,
        bestDistance: Number(data.flightStats.bestDistance) || 0,
        bestScore: Number(data.flightStats.bestScore) || 0,
      };
    }
  }

  /* ============================================================
   * Olay sistemi
   * ============================================================ */

  on(listener: EconomyListener): void {
    this.listeners.push(listener);
  }

  private emit(evt: EconomyEvent): void {
    for (const fn of this.listeners) {
      fn(evt);
    }
  }
}

/* ---- Kayıt veri yapısı ---- */

export interface MachineSaveEntry {
  level: number;
}

export interface EconomySaveData {
  resources: string | number;
  totalEarned: string | number;
  machines: MachineSaveEntry[];
  completedGoals?: string[];
  rocketUpgrades?: Record<string, number>;
  flightStats?: {
    totalFlights: number;
    bestDistance: number;
    bestScore: number;
  };
  timestamp: number;
}
