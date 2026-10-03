/* ======================================================================
 * src/scenes/FlightReturnHelper.test.ts
 *
 * Uçuş Dönüş Yardımcısı (FlightReturnHelper) headless birim testleri.
 * Node 24 native test koşucusu: `node --experimental-strip-types --test`
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  FlightReturnHelper,
  FLIGHT_DISTANCE_MILESTONES,
} from './FlightReturnHelper.ts';
import { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';

describe('FlightReturnHelper Headless Unit Tests', () => {
  it('Should calculate reward breakdown correctly and clamp negative values to zero', () => {
    // Sıfır veya negatif durumlar
    const zeroBreakdown = FlightReturnHelper.calculateRewardBreakdown({
      distanceMeters: -50,
      maxAltitudeMeters: -10,
      gearsCollected: -5,
      crystalsCollected: -2,
      dodgedObstacles: -1,
    });
    assert.strictEqual(zeroBreakdown.distanceCash, 0);
    assert.strictEqual(zeroBreakdown.altitudeCash, 0);
    assert.strictEqual(zeroBreakdown.gearsCash, 0);
    assert.strictEqual(zeroBreakdown.crystalsCash, 0);
    assert.strictEqual(zeroBreakdown.dodgesCash, 0);
    assert.strictEqual(zeroBreakdown.totalCash, 0);

    // Tipik bir uçuş senaryosu:
    // Mesafe: 450m -> Math.floor(450 * 0.35) = 157
    // İrtifa: 80m -> Math.floor(80 * 0.40) = 32
    // Dişliler: 12 adet -> 12 * 5 = 60
    // Kristaller: 3 adet -> 3 * 15 = 45
    // Engeller: 6 adet -> 6 * 4 = 24
    // Toplam: 157 + 32 + 60 + 45 + 24 = 318
    const normalBreakdown = FlightReturnHelper.calculateRewardBreakdown({
      distanceMeters: 450,
      maxAltitudeMeters: 80,
      gearsCollected: 12,
      crystalsCollected: 3,
      dodgedObstacles: 6,
    });

    assert.strictEqual(normalBreakdown.distanceCash, 157);
    assert.strictEqual(normalBreakdown.altitudeCash, 32);
    assert.strictEqual(normalBreakdown.gearsCash, 60);
    assert.strictEqual(normalBreakdown.crystalsCash, 45);
    assert.strictEqual(normalBreakdown.dodgesCash, 24);
    assert.strictEqual(normalBreakdown.totalCash, 318);
  });

  it('Should identify achieved milestones based on absolute flight distance', () => {
    assert.strictEqual(FlightReturnHelper.getAchievedMilestones(50).length, 0);

    const at100 = FlightReturnHelper.getAchievedMilestones(100);
    assert.strictEqual(at100.length, 1);
    assert.strictEqual(at100[0].id, 'flight_ms_100');

    const at1200 = FlightReturnHelper.getAchievedMilestones(1200);
    assert.strictEqual(at1200.length, 3);
    assert.deepStrictEqual(
      at1200.map((m) => m.id),
      ['flight_ms_100', 'flight_ms_500', 'flight_ms_1000'],
    );

    const at5500 = FlightReturnHelper.getAchievedMilestones(5500);
    assert.strictEqual(at5500.length, FLIGHT_DISTANCE_MILESTONES.length);
  });

  it('Should accurately detect newly unlocked milestones between flights', () => {
    // Önceki en iyi 50m, yeni mesafe 80m -> Yeni kilometre taşı yok
    const none = FlightReturnHelper.getNewlyUnlockedMilestones(50, 80);
    assert.strictEqual(none.length, 0);

    // Önceki 50m, yeni mesafe 150m -> İlk Tırmanış (100m) açılır
    const one = FlightReturnHelper.getNewlyUnlockedMilestones(50, 150);
    assert.strictEqual(one.length, 1);
    assert.strictEqual(one[0].id, 'flight_ms_100');

    // Önceki 80m, yeni mesafe 1200m -> 100m, 500m ve 1000m aynı anda açılır
    const three = FlightReturnHelper.getNewlyUnlockedMilestones(80, 1200);
    assert.strictEqual(three.length, 3);
    assert.deepStrictEqual(
      three.map((m) => m.id),
      ['flight_ms_100', 'flight_ms_500', 'flight_ms_1000'],
    );

    // Yeni mesafe öncekinden düşükse (başarısız uçuş) boş dönmeli
    const lower = FlightReturnHelper.getNewlyUnlockedMilestones(1500, 400);
    assert.strictEqual(lower.length, 0);
  });

  it('Should apply milestone multipliers to factory economy revenueMultiplier', () => {
    const economy = new FactoryEconomy(1000);
    assert.strictEqual(economy.revenueMultiplier, 1.0);

    // 100m ve 500m kilometre taşları: +0.05 ve +0.10
    const milestones = FlightReturnHelper.getNewlyUnlockedMilestones(0, 600);
    const bonus = FlightReturnHelper.applyMilestonesToEconomy(milestones, economy);

    assert.strictEqual(bonus, 0.15);
    assert.strictEqual(economy.revenueMultiplier, 1.15);

    // Boş liste ekonomiyi etkilememeli
    const zeroBonus = FlightReturnHelper.applyMilestonesToEconomy([], economy);
    assert.strictEqual(zeroBonus, 0);
    assert.strictEqual(economy.revenueMultiplier, 1.15);
  });

  it('Should construct a comprehensive ViewModel for flight report presentation', () => {
    const vm = FlightReturnHelper.buildReportViewModel({
      distance: 550,
      durationSec: 14.2,
      maxAltitude: 120,
      maxSpeedKmH: 210,
      gears: 8,
      crystals: 2,
      dodgedObstacles: 4,
      flightScore: 1250,
      isCrash: false,
      previousBestDistance: 80,
      currentRevenueMultiplier: 1.15,
    });

    assert.strictEqual(vm.distanceText, '550 m');
    assert.strictEqual(vm.durationText, '14.2 sn');
    assert.strictEqual(vm.maxAltitudeText, '120 m');
    assert.strictEqual(vm.maxSpeedText, '210 km/s');
    assert.strictEqual(vm.isNewBestDistance, true);
    assert.strictEqual(vm.scoreText, '1250 puan');
    assert.ok(vm.totalCashText.startsWith('+$'));

    // 80m'den 550m'ye çıkıldığında 100m ve 500m açılmış olmalı
    assert.strictEqual(vm.unlockedMilestones.length, 2);
    assert.ok(vm.milestoneBannerText !== null);
    assert.ok(vm.milestoneBannerText.includes('İlk Tırmanış'));
    assert.ok(vm.milestoneBannerText.includes('Stratosfer'));
    assert.ok(vm.cumulativeMultiplierText.includes('+%15'));
  });
});
