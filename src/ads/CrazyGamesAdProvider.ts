/* ======================================================================
 * src/ads/CrazyGamesAdProvider.ts — Gerçek reklam sağlayıcısı (CrazyGames SDK v3)
 *
 * AdService ile CrazyGames SDK sarmalayıcısı arasındaki ince köprü. Reklam
 * gösterilebilirliğini (ortam, reklam engelleyici) SDK'ya sorar; gösterilemiyorsa
 * AdService yerleşimleri "sunulmuyor" sayar ve düğmeler çizilmez.
 * (docs/M9_PLAN.md §4.5, DEC-034)
 * ====================================================================== */

import type { CrazyGamesSDK } from '../integration/CrazyGamesSDK.ts';
import type { AdPlacementId, AdProvider, AdProviderHooks } from './AdService.ts';

export class CrazyGamesAdProvider implements AdProvider {
  private readonly sdk: CrazyGamesSDK;

  constructor(sdk: CrazyGamesSDK) {
    this.sdk = sdk;
  }

  isAvailable(): boolean {
    return this.sdk.canShowAds();
  }

  /** Ödüllü reklam: yalnızca sonuna kadar izlenirse (adFinished) true döner */
  showRewarded(_placement: AdPlacementId, hooks: AdProviderHooks): Promise<boolean> {
    return this.sdk.requestAd('rewarded', { onStarted: hooks.onStarted });
  }

  /** Geçiş reklamı: ödülü yoktur; sıklığını SDK sınırlar */
  showMidgame(hooks: AdProviderHooks): Promise<boolean> {
    return this.sdk.requestAd('midgame', { onStarted: hooks.onStarted });
  }
}
