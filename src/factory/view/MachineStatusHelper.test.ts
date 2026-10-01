/* ======================================================================
 * src/factory/view/MachineStatusHelper.test.ts — Makine Durum İkaz Testleri
 *
 * Durum rozet yapılandırmaları, köşe konumları, nabız (pulse) alfası ve
 * çalışma kıvılcımı yayılım sınırlarını test eder.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MachineStatusHelper } from './MachineStatusHelper.ts';
import type { MachineVisualBounds } from './MachineVisualGeometry.ts';
import { PALETTE } from '../../ui/theme.ts';

describe('MachineStatusHelper Badge Configurations', () => {
  it('WAITING_INPUT should configure warning badge with warningOrange color', () => {
    const config = MachineStatusHelper.getBadgeConfig('WAITING_INPUT');
    assert.strictEqual(config.badgeType, 'WARNING_INPUT');
    assert.strictEqual(config.isWarning, true);
    assert.strictEqual(config.colorNum, PALETTE.warningOrange);
    assert.strictEqual(config.iconKey, 'icon_lightning');
  });

  it('BLOCKED_OUTPUT should configure danger badge with dangerRed color', () => {
    const config = MachineStatusHelper.getBadgeConfig('BLOCKED_OUTPUT');
    assert.strictEqual(config.badgeType, 'BLOCKED_OUTPUT');
    assert.strictEqual(config.isWarning, true);
    assert.strictEqual(config.colorNum, PALETTE.dangerRed);
    assert.strictEqual(config.iconKey, 'icon_close');
  });

  it('PROCESSING should configure green working badge without warning', () => {
    const config = MachineStatusHelper.getBadgeConfig('PROCESSING');
    assert.strictEqual(config.badgeType, 'PROCESSING');
    assert.strictEqual(config.isWarning, false);
    assert.strictEqual(config.colorNum, PALETTE.successGreen);
    assert.strictEqual(config.iconKey, 'icon_check');
  });

  it('IDLE should configure neutral badge without warning', () => {
    const config = MachineStatusHelper.getBadgeConfig('IDLE');
    assert.strictEqual(config.badgeType, 'NONE');
    assert.strictEqual(config.isWarning, false);
  });
});

describe('MachineStatusHelper Positioning & Pulse Alpha', () => {
  it('Should compute top-right corner coordinates relative to footprint center', () => {
    // 32x32 makine: Yarım genişlik = 16, yarım yükseklik = 16
    // badgeRadius = 7 => x = 16 - 7 - 2 = 7, y = -16 + 7 + 2 = -7
    const pos32 = MachineStatusHelper.computeBadgeRelativePosition(32, 32, 7);
    assert.strictEqual(pos32.x, 7);
    assert.strictEqual(pos32.y, -7);

    // 64x64 makine: Yarım genişlik = 32, yarım yükseklik = 32
    // x = 32 - 7 - 2 = 23, y = -32 + 7 + 2 = -23
    const pos64 = MachineStatusHelper.computeBadgeRelativePosition(64, 64, 7);
    assert.strictEqual(pos64.x, 23);
    assert.strictEqual(pos64.y, -23);
  });

  it('Pulse alpha should stay 1.0 for IDLE and PROCESSING', () => {
    assert.strictEqual(MachineStatusHelper.computePulseAlpha('IDLE', 0.5), 1.0);
    assert.strictEqual(MachineStatusHelper.computePulseAlpha('PROCESSING', 1.2), 1.0);
  });

  it('Pulse alpha should oscillate between 0.55 and 1.0 for warnings', () => {
    const a1 = MachineStatusHelper.computePulseAlpha('WAITING_INPUT', 0.0);
    const a2 = MachineStatusHelper.computePulseAlpha('WAITING_INPUT', Math.PI / 12);
    const a3 = MachineStatusHelper.computePulseAlpha('BLOCKED_OUTPUT', 1.5);

    assert.ok(a1 >= 0.54 && a1 <= 1.01);
    assert.ok(a2 >= 0.54 && a2 <= 1.01);
    assert.ok(a3 >= 0.54 && a3 <= 1.01);
  });
});

describe('MachineStatusHelper Spark Particle Spawn', () => {
  it('Should generate upward floating spark near machine center', () => {
    const bounds: MachineVisualBounds = {
      originX: 100,
      originY: 200,
      pixelW: 64,
      pixelH: 64,
      centerX: 132,
      centerY: 232,
      rotationRad: 0,
    };

    const spark = MachineStatusHelper.computeSparkSpawn(bounds, 0.42);

    // X ve Y merkez yakınında olmalı
    assert.ok(Math.abs(spark.x - bounds.centerX) <= 12);
    assert.ok(Math.abs(spark.y - bounds.centerY) <= 12);

    // Dikey hız negatif (yukarı doğru) olmalı
    assert.ok(spark.vy < 0);
    assert.ok(spark.lifespanMs >= 400 && spark.lifespanMs <= 600);
    assert.ok(spark.scale > 0);
  });
});
