/* ======================================================================
 * src/integration/CrazyGamesSDK.test.ts
 *
 * CrazyGamesSDK adaptörü birim testleri.
 * ====================================================================== */

import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert';
import {
  CrazyGamesSDK,
  crazyGames,
  type CrazyGamesSDKRaw,
  type AdType,
  type AdCallbacks,
} from './CrazyGamesSDK.ts';
import { sound } from '../audio/SoundManager.ts';

describe('CrazyGamesSDK Headless Unit Tests', () => {
  beforeEach(() => {
    crazyGames.resetForTest();
  });

  it('Should run gracefully in fallback/mock mode without window.CrazyGames', async () => {
    const sdk = CrazyGamesSDK.getInstance();
    assert.strictEqual(sdk.isAvailable(), false);

    const initResult = await sdk.init();
    assert.strictEqual(initResult, false);

    // Çağrılar çökmeden çalışmalı
    assert.doesNotThrow(() => sdk.gameplayStart());
    assert.doesNotThrow(() => sdk.happytime());
    assert.doesNotThrow(() => sdk.gameplayStop());

    // Reklam mock modda doğrudan true dönmeli
    const adResult = await sdk.requestAd('rewarded');
    assert.strictEqual(adResult, true);
  });

  it('Should coordinate lifecycle events with underlying raw SDK', async () => {
    let rawInitCalled = false;
    let rawStartCalled = false;
    let rawStopCalled = false;
    let rawHappyCalled = false;

    const mockRaw: CrazyGamesSDKRaw = {
      init: async () => {
        rawInitCalled = true;
      },
      game: {
        gameplayStart: () => {
          rawStartCalled = true;
        },
        gameplayStop: () => {
          rawStopCalled = true;
        },
        happytime: () => {
          rawHappyCalled = true;
        },
      },
      ad: {
        requestAd: async (_type: AdType, callbacks?: AdCallbacks) => {
          callbacks?.adStarted?.();
          callbacks?.adFinished?.();
        },
      },
    };

    const sdk = CrazyGamesSDK.getInstance(mockRaw);
    assert.strictEqual(sdk.isAvailable(), true);

    const success = await sdk.init();
    assert.strictEqual(success, true);
    assert.strictEqual(rawInitCalled, true);

    sdk.gameplayStart();
    assert.strictEqual(rawStartCalled, true);

    sdk.happytime();
    assert.strictEqual(rawHappyCalled, true);

    sdk.gameplayStop();
    assert.strictEqual(rawStopCalled, true);
  });

  it('Should manage audio muting and unmuting during rewarded ads', async () => {
    let requestedType: string | null = null;
    sound.setMuted(false);

    const mockRaw: CrazyGamesSDKRaw = {
      init: async () => {},
      game: {
        gameplayStart: () => {},
        gameplayStop: () => {},
        happytime: () => {},
      },
      ad: {
        requestAd: async (type: AdType, callbacks?: AdCallbacks) => {
          requestedType = type;
          // Reklam süresince ses kısılmış olmalı
          assert.strictEqual(sound.isMuted(), true);

          callbacks?.adStarted?.();
          setTimeout(() => {
            callbacks?.adFinished?.();
          }, 10);
        },
      },
    };

    const sdk = CrazyGamesSDK.getInstance(mockRaw);
    const adWatched = await sdk.requestAd('rewarded');

    assert.strictEqual(adWatched, true);
    assert.strictEqual(requestedType, 'rewarded');
    // Reklam bitince ses önceki durumuna (unmuted) dönmeli
    assert.strictEqual(sound.isMuted(), false);
  });

  it('Should handle ad failure gracefully and restore audio', async () => {
    sound.setMuted(false);

    const mockRaw: CrazyGamesSDKRaw = {
      init: async () => {},
      game: {
        gameplayStart: () => {},
        gameplayStop: () => {},
        happytime: () => {},
      },
      ad: {
        requestAd: async (_type: AdType, callbacks?: AdCallbacks) => {
          callbacks?.adError?.('Ad blocker detected or network error');
        },
      },
    };

    const sdk = CrazyGamesSDK.getInstance(mockRaw);
    const result = await sdk.requestAd('midgame');

    assert.strictEqual(result, false);
    assert.strictEqual(sound.isMuted(), false);
  });
});
