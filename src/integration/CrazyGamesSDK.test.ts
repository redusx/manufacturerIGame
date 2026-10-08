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

    // SDK yokken reklam gösterilemez: ödül verilmesin diye false döner
    assert.strictEqual(sdk.canShowAds(), false);
    const adResult = await sdk.requestAd('rewarded');
    assert.strictEqual(adResult, false);
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

  it('Should report the ad start to the caller and wrap the ad in gameplay stop/start', async () => {
    let requestedType: string | null = null;
    const events: string[] = [];

    const mockRaw: CrazyGamesSDKRaw = {
      init: async () => {},
      game: {
        gameplayStart: () => events.push('gameplayStart'),
        gameplayStop: () => events.push('gameplayStop'),
        happytime: () => {},
      },
      ad: {
        requestAd: async (type: AdType, callbacks?: AdCallbacks) => {
          requestedType = type;
          // Reklam gelene kadar oyun durdurulmaz
          assert.deepStrictEqual(events, ['gameplayStart']);

          callbacks?.adStarted?.();
          setTimeout(() => {
            callbacks?.adFinished?.();
          }, 10);
        },
      },
    };

    const sdk = CrazyGamesSDK.getInstance(mockRaw);
    sdk.gameplayStart();
    assert.strictEqual(sdk.canShowAds(), true);
    const adWatched = await sdk.requestAd('rewarded', { onStarted: () => events.push('adStarted') });

    assert.strictEqual(adWatched, true);
    assert.strictEqual(requestedType, 'rewarded');
    // Oyun reklam başlayınca durur, bitince sürer
    assert.deepStrictEqual(events, ['gameplayStart', 'gameplayStop', 'adStarted', 'gameplayStart']);
  });

  it('Should return false without stopping the game when the ad fails to show', async () => {
    const events: string[] = [];

    const mockRaw: CrazyGamesSDKRaw = {
      init: async () => {},
      game: {
        gameplayStart: () => events.push('gameplayStart'),
        gameplayStop: () => events.push('gameplayStop'),
        happytime: () => {},
      },
      ad: {
        requestAd: async (_type: AdType, callbacks?: AdCallbacks) => {
          callbacks?.adError?.('Ad blocker detected or network error');
        },
      },
    };

    const sdk = CrazyGamesSDK.getInstance(mockRaw);
    sdk.gameplayStart();
    const result = await sdk.requestAd('midgame', { onStarted: () => events.push('adStarted') });

    assert.strictEqual(result, false);
    // Reklam hiç başlamadı: oyun durdurulmadı, başlangıç bildirilmedi
    assert.deepStrictEqual(events, ['gameplayStart']);
  });
});
