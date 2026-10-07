/* ======================================================================
 * src/scenes/FlightReturnHelper.ts — Uçuş Sonu Hesaplama ve Rapor Yardımcısı
 *
 * Uçuş sahnesinden (FlightScene) fabrika ekonomisine (FactoryEconomy /
 * RocketHangarBridge) geri besleme hesaplamalarını, mesafe kilometre taşlarını
 * ve uçuş sonu özet raporu ViewModel formatlamasını yöneten saf TypeScript yardımcı.
 * (docs/DECISIONS.md DEC-009, docs/MASTER_PLAN.md TASK-112)
 *
 * Saf TypeScript — Node 24 native testleri ile %100 uyumludur (Phaser bağımlılığı YOKTUR).
 * ====================================================================== */

import type { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';
import { RANGE_LADDER, RangeLadder, type RangeRung } from '../flight/RangeLadder.ts';
import { formatDistance } from '../utils/format.ts';

export interface FlightRewardParams {
  distanceMeters: number;
  maxAltitudeMeters: number;
  gearsCollected: number;
  crystalsCollected: number;
  dodgedObstacles: number;
  /**
   * Roket sınıfının menzil çarpanı (varsayılan 1). Prim, çarpansız mesafeden hesaplanır:
   * üst sınıflar aynı sürede daha uzağa gider ama prim süresi bununla şişmez.
   */
  rangeScale?: number;
}

export interface FlightRewardBreakdown {
  distanceCash: number;
  altitudeCash: number;
  gearsCash: number;
  crystalsCash: number;
  dodgesCash: number;
  totalCash: number;
  /** Ödülün karşılık geldiği fabrika geliri süresi (saniye) */
  incomeSeconds: number;
}

/** Tek uçuşun kazandırabileceği en fazla fabrika geliri süresi (saniye) — DEC-011 */
export const FLIGHT_REWARD_MAX_SECONDS = 180;
/** Fabrika henüz gelir üretmiyorken uçuş ödülünün dayandığı taban gelir ($/sn) */
export const FLIGHT_REWARD_MIN_INCOME_PER_SEC = 1;

/** Mesafe kilometre taşı = menzil merdiveninin bir basamağı (src/flight/RangeLadder.ts) */
export type FlightDistanceMilestone = RangeRung;

/** Uçuş raporunda gösterilen sıradaki menzil hedefi */
export interface NextRangeTarget {
  name: string;
  targetMeters: number;
  /** Hedefe kalan mesafe (metre) */
  remainingMeters: number;
  rewards: string[];
}

export interface FlightReportViewModel {
  distanceText: string;
  durationText: string;
  maxAltitudeText: string;
  maxSpeedText: string;
  gearsText: string;
  crystalsText: string;
  dodgesText: string;
  scoreText: string;
  breakdown: FlightRewardBreakdown;
  totalCashText: string;
  isNewBestDistance: boolean;
  unlockedMilestones: FlightDistanceMilestone[];
  milestoneBannerText: string | null;
  cumulativeMultiplierText: string;
  /** Bu uçuştan sonraki rekora göre sıradaki basamak; hepsi geçildiyse null */
  nextTarget: NextRangeTarget | null;
}

/**
 * Kalıcı mesafe kilometre taşları: menzil merdiveninin basamakları. İlk beşi
 * gelir çarpanına toplanarak (+%5 .. +%25), sonrakiler çarpılarak (×1,25) eklenir.
 */
export const FLIGHT_DISTANCE_MILESTONES: readonly FlightDistanceMilestone[] = RANGE_LADDER;

export class FlightReturnHelper {
  /**
   * Uçuş primini hesaplar. Ödül sabit para değil, fabrikanın o anki gelirinin
   * belirli bir süresidir; böylece uçuş hiçbir aşamada fabrikanın önüne geçmez (DEC-011):
   * - Mesafe: her 40 metre 1 sn
   * - İrtifa: her 100 metre 1 sn
   * - Hurda dişli: adet başına 1 sn
   * - Enerji kristali: adet başına 3 sn
   * - Kaçınılan engel: adet başına 0.5 sn
   * Toplam süre `FLIGHT_REWARD_MAX_SECONDS` ile sınırlıdır.
   */
  static calculateRewardBreakdown(
    params: FlightRewardParams,
    incomePerSec = FLIGHT_REWARD_MIN_INCOME_PER_SEC,
  ): FlightRewardBreakdown {
    const dist = Math.max(0, Math.floor(params.distanceMeters / Math.max(1, params.rangeScale ?? 1)));
    const alt = Math.max(0, Math.floor(params.maxAltitudeMeters));
    const gears = Math.max(0, Math.floor(params.gearsCollected));
    const crystals = Math.max(0, Math.floor(params.crystalsCollected));
    const dodges = Math.max(0, Math.floor(params.dodgedObstacles));

    const seconds = [dist / 40, alt / 100, gears, crystals * 3, dodges * 0.5];
    const rawSeconds = seconds.reduce((sum, s) => sum + s, 0);
    const incomeSeconds = Math.min(FLIGHT_REWARD_MAX_SECONDS, rawSeconds);
    // Sınır aşılırsa kalemler aynı oranda küçülür; döküm toplamla tutarlı kalır
    const capScale = rawSeconds > 0 ? incomeSeconds / rawSeconds : 0;
    const rate = Math.max(FLIGHT_REWARD_MIN_INCOME_PER_SEC, incomePerSec) * capScale;

    // Kayan nokta hatası tam sayı sınırındaki tutarı bir aşağı düşürmesin
    const toCash = (sec: number): number => Math.floor(sec * rate + 1e-6);
    const distanceCash = toCash(seconds[0]);
    const altitudeCash = toCash(seconds[1]);
    const gearsCash = toCash(seconds[2]);
    const crystalsCash = toCash(seconds[3]);
    const dodgesCash = toCash(seconds[4]);

    const totalCash = distanceCash + altitudeCash + gearsCash + crystalsCash + dodgesCash;

    return {
      distanceCash,
      altitudeCash,
      gearsCash,
      crystalsCash,
      dodgesCash,
      totalCash,
      incomeSeconds: Math.round(incomeSeconds),
    };
  }

  /**
   * Belirtilen mesafeye göre hak kazanılmış tüm kilometre taşlarını döner.
   */
  static getAchievedMilestones(distanceMeters: number): FlightDistanceMilestone[] {
    return RangeLadder.achieved(distanceMeters);
  }

  /**
   * Önceki en iyi mesafe ile yeni mesafe arasında YENİ açılan kilometre taşlarını tespit eder.
   */
  static getNewlyUnlockedMilestones(
    previousBestDistance: number,
    newDistance: number,
  ): FlightDistanceMilestone[] {
    return RangeLadder.newlyReached(previousBestDistance, newDistance);
  }

  /**
   * Yeni kazanılan kilometre taşı çarpanlarını fabrika ekonomisine kalıcı olarak uygular:
   * önce toplamalı bonuslar eklenir, sonra bileşik çarpanlar uygulanır.
   * Gelir çarpanındaki artışı döner.
   */
  static applyMilestonesToEconomy(
    newlyUnlocked: FlightDistanceMilestone[],
    factoryEconomy?: FactoryEconomy,
  ): number {
    if (!newlyUnlocked || newlyUnlocked.length === 0) return 0;

    let bonus = 0;
    let factor = 1;
    for (const m of newlyUnlocked) {
      bonus += m.multiplierBonus ?? 0;
      factor *= m.multiplierFactor ?? 1;
    }

    const before = factoryEconomy ? factoryEconomy.revenueMultiplier : 1;
    const after = Number(((before + bonus) * factor).toFixed(4));
    if (factoryEconomy && after > before) {
      factoryEconomy.revenueMultiplier = after;
    }

    return Number((after - before).toFixed(4));
  }

  /**
   * Uçuş raporu ekranı için UI metin ve veri modelini hazırlar.
   */
  static buildReportViewModel(data: {
    distance: number;
    durationSec: number;
    maxAltitude: number;
    maxSpeedKmH: number;
    gears: number;
    crystals: number;
    dodgedObstacles: number;
    flightScore: number;
    isCrash: boolean;
    previousBestDistance: number;
    currentRevenueMultiplier?: number;
    incomePerSec?: number;
    rangeScale?: number;
  }): FlightReportViewModel {
    const breakdown = this.calculateRewardBreakdown(
      {
        distanceMeters: data.distance,
        maxAltitudeMeters: data.maxAltitude,
        gearsCollected: data.gears,
        crystalsCollected: data.crystals,
        dodgedObstacles: data.dodgedObstacles,
        rangeScale: data.rangeScale,
      },
      data.incomePerSec,
    );

    const isNewBestDistance = data.distance > data.previousBestDistance && data.distance > 0;
    const unlockedMilestones = this.getNewlyUnlockedMilestones(
      data.previousBestDistance,
      data.distance,
    );

    let milestoneBannerText: string | null = null;
    if (unlockedMilestones.length > 0) {
      const names = unlockedMilestones
        .map((m) => `${m.name} (${RangeLadder.describeRewards(m).join(', ')})`)
        .join(' · ');
      milestoneBannerText = `Yeni menzil: ${names}`;
    }

    const bestAfterFlight = Math.max(data.previousBestDistance, data.distance);
    const nextRung = RangeLadder.next(bestAfterFlight);
    const nextTarget: NextRangeTarget | null = nextRung
      ? {
          name: nextRung.name,
          targetMeters: nextRung.targetMeters,
          remainingMeters: Math.max(0, nextRung.targetMeters - Math.floor(bestAfterFlight)),
          rewards: RangeLadder.describeRewards(nextRung),
        }
      : null;

    const currentMultiplier = data.currentRevenueMultiplier ?? 1.0;
    const multiplierPercent = Math.round((currentMultiplier - 1.0) * 100);
    const cumulativeMultiplierText =
      multiplierPercent > 0
        ? `+%${multiplierPercent} Kalıcı İhracat Bonusu`
        : 'Standart Çarpan (1.0x)';

    return {
      distanceText: formatDistance(data.distance),
      durationText: `${data.durationSec.toFixed(1)} sn`,
      maxAltitudeText: formatDistance(data.maxAltitude),
      maxSpeedText: `${Math.round(data.maxSpeedKmH)} km/s`,
      gearsText: `${data.gears} adet (+$${breakdown.gearsCash})`,
      crystalsText: `${data.crystals} adet (+$${breakdown.crystalsCash})`,
      dodgesText: `${data.dodgedObstacles} adet (+$${breakdown.dodgesCash})`,
      scoreText: `${data.flightScore} puan`,
      breakdown,
      totalCashText: `+$${breakdown.totalCash.toLocaleString()}`,
      isNewBestDistance,
      unlockedMilestones,
      milestoneBannerText,
      cumulativeMultiplierText,
      nextTarget,
    };
  }
}
