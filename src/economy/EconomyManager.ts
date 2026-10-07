/* ======================================================================
 * EconomyManager.ts — Oyunun tek kasası: para, toplam kazanç, roket seviyeleri (Decimal tabanlı)
 *
 * Phaser'dan bağımsızdır; saf veri + break_eternity.js hesaplama katmanı.
 * Sahne bu sınıfın durumunu okuyarak UI ve fabrikayı günceller.
 * ====================================================================== */

import Decimal, { type DecimalSource } from 'break_eternity.js';
import { D, D_ZERO } from '../utils/decimal.ts';
import { BASE_CLICK_POWER } from '../data/MachineData.ts';
import { MAX_ROCKET_LEVEL, ROCKET_UPGRADES, type RocketUpgradeDef } from '../data/RocketData.ts';

/* ---- Dışarıya açılan olay tipleri ---- */

export type EconomyEventType =
  | 'click'
  | 'rocket_upgrade'
  | 'flight_complete';

export interface EconomyEvent {
  type: EconomyEventType;
  upgradeId?: string;
  amount?: Decimal;
  newLevel?: number;
}

export type EconomyListener = (evt: EconomyEvent) => void;

/* ---- Ana sınıf ---- */

export class EconomyManager {
  private _resources: Decimal = D_ZERO;
  private _totalEarned: Decimal = D_ZERO;   // Açılma koşulları ve hedefler için toplam kazanım
  private _clickPower: Decimal = D(BASE_CLICK_POWER);

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

  /** Olay dinleyicileri */
  private listeners: EconomyListener[] = [];

  /* ============================================================
   * Getter'lar
   * ============================================================ */

  get resources(): Decimal { return this._resources; }
  get totalEarned(): Decimal { return this._totalEarned; }
  get clickPower(): Decimal { return this._clickPower; }

  /* ============================================================
   * Eylemler
   * ============================================================ */

  /**
   * Tıklama ile üretim. Sabit değerlidir; hedef çarpanları tıklamayı büyütmez
   * (DEC-013: tıklama yalnız erken oyunda yardımcıdır, fabrika büyüdükçe önemi azalır).
   */
  produceByClick(): Decimal {
    const gained = this._clickPower;
    this._resources = this._resources.add(gained);
    this._totalEarned = this._totalEarned.add(gained);

    this.emit({ type: 'click', amount: gained });
    return gained;
  }

  /** Kaynak doğrudan ekle (offline kazanım vb.) */
  addResources(amount: DecimalSource): void {
    const dec = D(amount);
    if (dec.lte(0)) return;
    this._resources = this._resources.add(dec);
    this._totalEarned = this._totalEarned.add(dec);
  }

  /**
   * İade: parayı kasaya geri koyar ama "toplam kazanç" saymaz. Söküm iadesi kazanç
   * sayılırsa kur-sök döngüsü hiç üretmeden hedefleri tamamlatır.
   */
  refundResources(amount: DecimalSource): void {
    const dec = D(amount);
    if (dec.lte(0)) return;
    this._resources = this._resources.add(dec);
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
    this.rocketUpgrades[id] = Math.min(MAX_ROCKET_LEVEL, Math.max(1, level));
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
      rocketUpgrades: { ...this.rocketUpgrades },
      flightStats: { ...this.flightStats },
      timestamp: Date.now(),
    };
  }

  /** Kayıtlı durumu yükler (eski sayı formatlarını da destekler) */
  deserialize(data: EconomySaveData): void {
    this._resources = data.resources !== undefined ? D(data.resources) : D_ZERO;
    this._totalEarned = data.totalEarned !== undefined ? D(data.totalEarned) : D_ZERO;

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

export interface EconomySaveData {
  resources: string | number;
  totalEarned: string | number;
  rocketUpgrades?: Record<string, number>;
  flightStats?: {
    totalFlights: number;
    bestDistance: number;
    bestScore: number;
  };
  timestamp: number;
}
