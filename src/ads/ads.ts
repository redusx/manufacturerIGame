/* ======================================================================
 * src/ads/ads.ts — Reklam servisinin oyundaki tek örneği ve mod seçimi
 *
 * Mod kendiliğinden seçilir (DEC-034):
 *   - CrazyGames SDK reklam gösterebiliyorsa (sitede veya localhost'ta) → 'crazygames'
 *   - Gösteremiyorsa ve geliştirme sürümüyse → 'mock' (sahte "REKLAM ALANI" katmanı)
 *   - Gösteremiyorsa ve yayın sürümüyse → 'off' (reklam düğmeleri hiç çizilmez;
 *     sahte reklamla bedava ödül verilmez)
 *
 * Deneme için adres çubuğundan zorlanabilir (yalnız geliştirme sürümünde):
 *   ?ads=off · ?ads=mock · ?ads=fail (sahte reklam her seferinde gösterilemez)
 * ====================================================================== */

import { sound } from '../audio/SoundManager.ts';
import { crazyGames } from '../integration/CrazyGamesSDK.ts';
import { AdService, type AdMode } from './AdService.ts';
import { CrazyGamesAdProvider } from './CrazyGamesAdProvider.ts';
import { MockAdProvider } from './MockAdProvider.ts';

/**
 * Uçuştan fabrikaya dönüşte geçiş (midgame) reklamı gösterilsin mi? (G1)
 * Karar verilmedi (M9_PLAN K8); kapalıdır. Açılırsa yalnızca o uçuşta ödüllü reklam
 * izlenmediyse ve son reklamın üstünden 3 dakika geçtiyse gösterilir.
 */
export const MIDGAME_AD_ENABLED = false;

const IS_DEV = import.meta.env?.DEV === true;

function readAdOverride(): string | null {
  if (!IS_DEV || typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get('ads');
  } catch {
    return null;
  }
}

const override = readAdOverride();

let currentMode: AdMode = 'off';

/** Şu an geçerli reklam modu */
export function getAdMode(): AdMode {
  return currentMode;
}

export const ads = new AdService(null);

function useMock(): void {
  currentMode = 'mock';
  ads.setProvider(new MockAdProvider({ alwaysFail: override === 'fail' }));
}

function useOff(): void {
  currentMode = 'off';
  ads.setProvider(null);
}

if (override === 'off') {
  useOff();
} else if (override === 'mock' || override === 'fail') {
  useMock();
} else {
  // SDK başlatılana kadar geliştirme sürümünde sahte sağlayıcı, yayında kapalı
  if (IS_DEV) useMock();
  else useOff();

  void crazyGames.init().then(() => {
    if (crazyGames.canShowAds()) {
      currentMode = 'crazygames';
      ads.setProvider(new CrazyGamesAdProvider(crazyGames));
    }
  });
}

// Reklam ekrandayken oyunun sesi kesilir; kapanınca oyuncunun ayarına dönülür
ads.subscribe({
  onStarted: () => sound.setSuspended(true),
  onEnded: () => sound.setSuspended(false),
});
