/* ======================================================================
 * src/effects/PixelParticleHelper.test.ts
 *
 * PixelParticleHelper birim testleri.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { PixelParticleHelper } from './PixelParticleHelper.ts';

describe('PixelParticleHelper Headless Unit Tests', () => {
  it('Should generate correct count and radial dispersion for sparkle burst', () => {
    const burst = PixelParticleHelper.computeSparkleBurst(100, 200, 16, 0xffd166);
    assert.strictEqual(burst.length, 16);

    for (const p of burst) {
      assert.strictEqual(p.x, 100);
      assert.strictEqual(p.y, 200);
      assert.strictEqual(p.color, 0xffd166);
      assert.strictEqual(p.alpha, 1.0);
      assert.ok(p.life > 0);
    }
  });

  it('Should generate upward dispersion for confetti burst', () => {
    const confetti = PixelParticleHelper.computeConfettiBurst(50, 50, 20);
    assert.strictEqual(confetti.length, 20);

    for (const p of confetti) {
      assert.strictEqual(p.x, 50);
      assert.strictEqual(p.y, 50);
      // vy negatif olmalı (yukarı doğru fışkırma)
      assert.ok(p.vy < 0);
      assert.ok(p.gravity > 0);
    }
  });

  it('Should step particle physics accurately with gravity and decay', () => {
    const p = {
      x: 0,
      y: 0,
      vx: 100,
      vy: -50,
      gravity: 200,
      life: 500,
      maxLife: 500,
      color: 0xffffff,
      scale: 1,
      alpha: 1,
    };

    // 0.1 saniye ilerle
    const alive = PixelParticleHelper.stepParticle(p, 0.1);
    assert.strictEqual(alive, true);
    assert.strictEqual(p.x, 10); // 0 + 100 * 0.1
    // vy: -50 + 200 * 0.1 = -30
    // y: 0 + (-30)*0.1 = -3 (ya da ortalama)
    assert.ok(p.alpha < 1.0 && p.alpha > 0);

    // 1 saniye daha ilerlet (ömrü biter)
    const dead = PixelParticleHelper.stepParticle(p, 1.0);
    assert.strictEqual(dead, false);
    assert.strictEqual(p.alpha, 0);
  });

  it('Should step floating text vertically with smooth fade', () => {
    const t = {
      x: 100,
      y: 100,
      text: '+500',
      color: '#ffd166',
      vy: -40,
      life: 600,
      maxLife: 600,
    };

    const step1 = PixelParticleHelper.stepFloatingText(t, 0.2);
    assert.strictEqual(step1.alive, true);
    assert.strictEqual(step1.y, 92); // 100 + (-40)*0.2
    assert.strictEqual(step1.alpha, 1.0);

    const step2 = PixelParticleHelper.stepFloatingText(t, 0.5);
    assert.strictEqual(step2.alive, false);
    assert.strictEqual(step2.alpha, 0);
  });
});
