/* ======================================================================
 * src/ads/ads.ts — Reklam servisinin oyundaki tek örneği ve mod seçimi
 *
 * Mod tek yerden seçilir: 'mock' (sahte sağlayıcı), 'crazygames' (gerçek SDK;
 * M9-G'de bağlanacak) veya 'off' (bütün reklam düğmeleri gizlenir).
 * Deneme için adres çubuğundan değiştirilebilir: `?ads=off` veya `?ads=fail`
 * (reklam her seferinde gösterilemez).
 * ====================================================================== */

import { sound } from '../audio/SoundManager.ts';
import { AdService, type AdMode, type AdProvider } from './AdService.ts';
import { MockAdProvider } from './MockAdProvider.ts';

/** CrazyGames SDK bağlanana kadar reklamlar yalnızca yerleşim olarak gösterilir */
export const DEFAULT_AD_MODE: AdMode = 'mock';

function readAdOverride(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return new URLSearchParams(window.location.search).get('ads');
  } catch {
    return null;
  }
}

function createProvider(mode: AdMode, override: string | null): AdProvider | null {
  if (mode === 'mock') return new MockAdProvider({ alwaysFail: override === 'fail' });
  // 'crazygames' sağlayıcısı M9-G'de eklenir; o zamana dek reklam sunulmaz
  return null;
}

const override = readAdOverride();

export const adMode: AdMode = override === 'off' ? 'off' : DEFAULT_AD_MODE;

export const ads = new AdService(createProvider(adMode, override));

// Reklam ekrandayken oyunun sesi kesilir; kapanınca oyuncunun ayarına dönülür
ads.subscribe({
  onStarted: () => sound.setSuspended(true),
  onEnded: () => sound.setSuspended(false),
});
