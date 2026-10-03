/* ======================================================================
 * src/audio/SoundManager.test.ts
 *
 * SoundManager ses yöneticisi birim testleri.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert';
import { SoundManager, sound } from './SoundManager.ts';

describe('SoundManager Headless Unit Tests', () => {
  it('Should provide singleton instance', () => {
    const s1 = SoundManager.getInstance();
    const s2 = SoundManager.getInstance();
    assert.strictEqual(s1, s2);
    assert.strictEqual(s1, sound);
  });

  it('Should toggle mute state correctly', () => {
    const initial = sound.isMuted();
    sound.setMuted(true);
    assert.strictEqual(sound.isMuted(), true);

    const toggled = sound.toggleMute();
    assert.strictEqual(toggled, false);
    assert.strictEqual(sound.isMuted(), false);

    // Eski duruma geri al
    sound.setMuted(initial);
  });

  it('Should execute all audio playback triggers without errors in headless environment', () => {
    // Node.js ortamında AudioContext olmadan dahi hata fırlatmamalı (Graceful degradation)
    assert.doesNotThrow(() => sound.playClick());
    assert.doesNotThrow(() => sound.playCoin());
    assert.doesNotThrow(() => sound.playUpgrade());
    assert.doesNotThrow(() => sound.playMilestone());
    assert.doesNotThrow(() => sound.playLaunch());
    assert.doesNotThrow(() => sound.playBoost());
    assert.doesNotThrow(() => sound.playHit());
    assert.doesNotThrow(() => sound.playDemolish());
  });

  it('Should respect muted state when sounds are triggered', () => {
    sound.setMuted(true);
    assert.strictEqual(sound.isMuted(), true);
    assert.doesNotThrow(() => sound.playClick());
    assert.doesNotThrow(() => sound.playCoin());
    sound.setMuted(false);
  });
});
