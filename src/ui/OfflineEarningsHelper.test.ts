/* ======================================================================
 * src/ui/OfflineEarningsHelper.test.ts
 *
 * Çevrimdışı İlerleme Hesaplayıcı (OfflineEarningsHelper) birim testleri.
 * Node 24 native test koşucusu (--experimental-strip-types) ile çalışır.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { D } from '../utils/decimal.ts';
import {
  calculateOfflineReport,
  formatOfflineDuration,
  getWelcomeMessage,
  MIN_OFFLINE_SECONDS,
} from './OfflineEarningsHelper.ts';

describe('OfflineEarningsHelper Headless Unit Tests', () => {
  it('Should reject durations below minimum threshold (<10s)', () => {
    const now = 1000000;
    const report = calculateOfflineReport(now - 5000, now, 100);

    assert.strictEqual(report.isEligible, false);
    assert.strictEqual(report.effectiveSeconds, 0);
    assert.strictEqual(report.baseEarnings.toNumber(), 0);
    assert.strictEqual(report.doubledEarnings.toNumber(), 0);
  });

  it('Should reject zero or negative production rates', () => {
    const now = 1000000;
    const zeroReport = calculateOfflineReport(now - 3600000, now, 0);
    assert.strictEqual(zeroReport.isEligible, false);
    assert.strictEqual(zeroReport.baseEarnings.toNumber(), 0);

    const negReport = calculateOfflineReport(now - 3600000, now, -5);
    assert.strictEqual(negReport.isEligible, false);
  });

  it('Should calculate standard offline earnings with 50% efficiency', () => {
    const now = 2000000;
    const elapsedMs = 1800 * 1000; // 30 dakika = 1800 saniye
    const pps = 20; // 20 kaynak/sn

    // 1800s × 20/sn × 0.5 = 18,000
    const report = calculateOfflineReport(now - elapsedMs, now, pps);

    assert.strictEqual(report.isEligible, true);
    assert.strictEqual(report.wasCapped, false);
    assert.strictEqual(report.elapsedSeconds, 1800);
    assert.strictEqual(report.effectiveSeconds, 1800);
    assert.strictEqual(report.efficiencyPercent, 50);
    assert.strictEqual(report.baseEarnings.toNumber(), 18000);
    assert.strictEqual(report.doubledEarnings.toNumber(), 36000);
    assert.strictEqual(report.formattedDuration, '30 dakika');
  });

  it('Should enforce 4 hours (14,400s) maximum cap on long absences', () => {
    const now = 50000000;
    const tenHoursMs = 10 * 3600 * 1000; // 10 saat
    const pps = 5;

    // Tavan: 14400s × 5/sn × 0.5 = 36,000
    const report = calculateOfflineReport(now - tenHoursMs, now, pps);

    assert.strictEqual(report.isEligible, true);
    assert.strictEqual(report.wasCapped, true);
    assert.strictEqual(report.elapsedSeconds, 36000);
    assert.strictEqual(report.effectiveSeconds, 14400);
    assert.strictEqual(report.baseEarnings.toNumber(), 36000);
    assert.strictEqual(report.doubledEarnings.toNumber(), 72000);
    assert.strictEqual(report.welcomeTitle, 'UZUN BİR MOLA!');
  });

  it('Should support custom cap and efficiency overrides', () => {
    const now = 1000000;
    const elapsedMs = 600 * 1000; // 10 dakika = 600s
    const pps = 10;
    const customCap = 300; // 5 dakika tavan
    const customEff = 0.8; // %80 verim

    // 300s × 10/sn × 0.8 = 2,400
    const report = calculateOfflineReport(now - elapsedMs, now, pps, customCap, customEff);

    assert.strictEqual(report.wasCapped, true);
    assert.strictEqual(report.effectiveSeconds, 300);
    assert.strictEqual(report.efficiencyPercent, 80);
    assert.strictEqual(report.baseEarnings.toNumber(), 2400);
    assert.strictEqual(report.doubledEarnings.toNumber(), 4800);
  });

  it('Should handle astronomical break_eternity decimal rates accurately', () => {
    const now = 1000000;
    const elapsedMs = 3600 * 1000; // 1 saat = 3600s
    const pps = D('1e15'); // 1 katrilyon/sn

    // 3600s × 1e15 × 0.5 = 1.8e18
    const report = calculateOfflineReport(now - elapsedMs, now, pps);

    assert.strictEqual(report.isEligible, true);
    assert.strictEqual(report.baseEarnings.eq(D('1.8e18')), true);
    assert.strictEqual(report.doubledEarnings.eq(D('3.6e18')), true);
  });

  it('Should format offline duration cleanly across seconds, minutes, and hours', () => {
    assert.strictEqual(formatOfflineDuration(45), '45 saniye');
    assert.strictEqual(formatOfflineDuration(120), '2 dakika');
    assert.strictEqual(formatOfflineDuration(125), '2 dakika 5 saniye');
    assert.strictEqual(formatOfflineDuration(3600), '1 saat');
    assert.strictEqual(formatOfflineDuration(7320), '2 saat 2 dakika');
    assert.strictEqual(formatOfflineDuration(0), '0 saniye');
    assert.strictEqual(formatOfflineDuration(-10), '0 saniye');
  });

  it('Should produce contextual welcome messages for different absence durations', () => {
    const shortMola = getWelcomeMessage(300, false);
    assert.strictEqual(shortMola.title, 'KISA BİR MOLA');

    const medMola = getWelcomeMessage(1800, false);
    assert.strictEqual(medMola.title, 'FABRİKA RAPORU');

    const longMola = getWelcomeMessage(8000, false);
    assert.strictEqual(longMola.title, 'TEKRAR HOŞ GELDİN!');

    const cappedMola = getWelcomeMessage(20000, true);
    assert.strictEqual(cappedMola.title, 'UZUN BİR MOLA!');
  });
});
