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

export interface FlightRewardParams {
  distanceMeters: number;
  maxAltitudeMeters: number;
  gearsCollected: number;
  crystalsCollected: number;
  dodgedObstacles: number;
}

export interface FlightRewardBreakdown {
  distanceCash: number;
  altitudeCash: number;
  gearsCash: number;
  crystalsCash: number;
  dodgesCash: number;
  totalCash: number;
}

export interface FlightDistanceMilestone {
  id: string;
  name: string;
  targetMeters: number;
  multiplierBonus: number; // örn: 0.05 (+%5)
  description: string;
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
}

/**
 * Kalıcı Mesafe Kilometre Taşları:
 * Roket uçuşunda belirli mesafe eşikleri aşıldığında tüm fabrika ihracat gelirine
 * kalıcı global çarpan (+%5 .. +%25) kazandırır.
 */
export const FLIGHT_DISTANCE_MILESTONES: readonly FlightDistanceMilestone[] = [
  {
    id: 'flight_ms_100',
    name: 'İlk Tırmanış',
    targetMeters: 100,
    multiplierBonus: 0.05,
    description: '100m Uçuş Mesafesi — Fabrikaya Kalıcı +%5 Gelir Çarpanı!',
  },
  {
    id: 'flight_ms_500',
    name: 'Stratosfer',
    targetMeters: 500,
    multiplierBonus: 0.10,
    description: '500m Uçuş Mesafesi — Fabrikaya Kalıcı +%10 Gelir Çarpanı!',
  },
  {
    id: 'flight_ms_1000',
    name: 'Alçak Yörünge',
    targetMeters: 1000,
    multiplierBonus: 0.15,
    description: '1,000m Uçuş Mesafesi — Fabrikaya Kalıcı +%15 Gelir Çarpanı!',
  },
  {
    id: 'flight_ms_2500',
    name: 'Yörünge İstasyonu',
    targetMeters: 2500,
    multiplierBonus: 0.20,
    description: '2,500m Uçuş Mesafesi — Fabrikaya Kalıcı +%20 Gelir Çarpanı!',
  },
  {
    id: 'flight_ms_5000',
    name: 'Derin Uzay',
    targetMeters: 5000,
    multiplierBonus: 0.25,
    description: '5,000m Uçuş Mesafesi — Fabrikaya Kalıcı +%25 Gelir Çarpanı!',
  },
];

export class FlightReturnHelper {
  /**
   * Uçuşta kazanılan nakit ve kaynak dökümünü hesaplar:
   * - Mesafe: Her 10 metre $3.5 (metre başına $0.35, Math.floor(distance * 0.35))
   * - İrtifa Bonusu: Math.floor(maxAltitude * 0.40)
   * - Hurda Dişliler: adet * 5
   * - Enerji Kristalleri: adet * 15
   * - Kaçınılan Engeller: adet * 4
   */
  static calculateRewardBreakdown(params: FlightRewardParams): FlightRewardBreakdown {
    const dist = Math.max(0, Math.floor(params.distanceMeters));
    const alt = Math.max(0, Math.floor(params.maxAltitudeMeters));
    const gears = Math.max(0, Math.floor(params.gearsCollected));
    const crystals = Math.max(0, Math.floor(params.crystalsCollected));
    const dodges = Math.max(0, Math.floor(params.dodgedObstacles));

    const distanceCash = Math.floor(dist * 0.35);
    const altitudeCash = Math.floor(alt * 0.40);
    const gearsCash = gears * 5;
    const crystalsCash = crystals * 15;
    const dodgesCash = dodges * 4;

    const totalCash = distanceCash + altitudeCash + gearsCash + crystalsCash + dodgesCash;

    return {
      distanceCash,
      altitudeCash,
      gearsCash,
      crystalsCash,
      dodgesCash,
      totalCash,
    };
  }

  /**
   * Belirtilen mesafeye göre hak kazanılmış tüm kilometre taşlarını döner.
   */
  static getAchievedMilestones(distanceMeters: number): FlightDistanceMilestone[] {
    const dist = Math.max(0, distanceMeters);
    return FLIGHT_DISTANCE_MILESTONES.filter((m) => dist >= m.targetMeters);
  }

  /**
   * Önceki en iyi mesafe ile yeni mesafe arasında YENİ açılan kilometre taşlarını tespit eder.
   */
  static getNewlyUnlockedMilestones(
    previousBestDistance: number,
    newDistance: number,
  ): FlightDistanceMilestone[] {
    const prev = Math.max(0, previousBestDistance);
    const curr = Math.max(0, newDistance);
    if (curr <= prev) return [];

    return FLIGHT_DISTANCE_MILESTONES.filter(
      (m) => prev < m.targetMeters && curr >= m.targetMeters,
    );
  }

  /**
   * Yeni kazanılan kilometre taşı çarpanlarını fabrika ekonomisine kalıcı olarak uygular.
   * Eklenen toplam çarpan bonusunu döner.
   */
  static applyMilestonesToEconomy(
    newlyUnlocked: FlightDistanceMilestone[],
    factoryEconomy?: FactoryEconomy,
  ): number {
    if (!newlyUnlocked || newlyUnlocked.length === 0) return 0;

    let bonus = 0;
    for (const m of newlyUnlocked) {
      bonus += m.multiplierBonus;
    }
    bonus = Number(bonus.toFixed(2));

    if (factoryEconomy && bonus > 0) {
      factoryEconomy.revenueMultiplier = Number(
        (factoryEconomy.revenueMultiplier + bonus).toFixed(2),
      );
    }

    return bonus;
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
  }): FlightReportViewModel {
    const breakdown = this.calculateRewardBreakdown({
      distanceMeters: data.distance,
      maxAltitudeMeters: data.maxAltitude,
      gearsCollected: data.gears,
      crystalsCollected: data.crystals,
      dodgedObstacles: data.dodgedObstacles,
    });

    const isNewBestDistance = data.distance > data.previousBestDistance && data.distance > 0;
    const unlockedMilestones = this.getNewlyUnlockedMilestones(
      data.previousBestDistance,
      data.distance,
    );

    let milestoneBannerText: string | null = null;
    if (unlockedMilestones.length > 0) {
      const names = unlockedMilestones
        .map((m) => `${m.name} (+%${Math.round(m.multiplierBonus * 100)})`)
        .join(', ');
      milestoneBannerText = `🎉 YENİ KİLOMETRE TAŞI: ${names}`;
    }

    const currentMultiplier = data.currentRevenueMultiplier ?? 1.0;
    const multiplierPercent = Math.round((currentMultiplier - 1.0) * 100);
    const cumulativeMultiplierText =
      multiplierPercent > 0
        ? `+%${multiplierPercent} Kalıcı İhracat Bonusu`
        : 'Standart Çarpan (1.0x)';

    return {
      distanceText: `${Math.floor(data.distance)} m`,
      durationText: `${data.durationSec.toFixed(1)} sn`,
      maxAltitudeText: `${Math.round(data.maxAltitude)} m`,
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
    };
  }
}
