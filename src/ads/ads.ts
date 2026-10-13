/* ======================================================================
 * src/ads/ads.ts — Reklam servisinin oyundaki tek örneği ve mod seçimi
 *
 * Mod kendiliğinden seçilir (DEC-034, DEC-054):
 *   - CrazyGames SDK reklam gösterebiliyorsa (sitede; localhost'ta SDK'nın kendi deneme
 *     kipiyle) → 'crazygames'
 *   - Gösteremiyorsa → 'off': reklam düğmeleri hiç çizilmez; sahte reklamla bedava ödül
 *     verilmez (geliştirme sürümünde de varsayılan budur)
 *
 * Sahte reklam yalnızca açıkça istenirse ve yalnızca geliştirme sürümünde çalışır:
 *   ?ads=mock · ?ads=fail (sahte reklam her seferinde gösterilemez) · ?ads=off
 *
 * Yayın yapılandırması (src/config/release.ts) reklamı kapattıysa (Basic derleme) mod her
 * zaman 'off'tur. Yerleşimler ayrıca tek tek kapatılabilir.
 * ====================================================================== */

import { sound } from '../audio/SoundManager.ts';
import { crazyGames } from '../integration/CrazyGamesSDK.ts';
import { AdService, type AdMode } from './AdService.ts';
import { CrazyGamesAdProvider } from './CrazyGamesAdProvider.ts';
import { MockAdProvider } from './MockAdProvider.ts';
import { RELEASE, isAdPlacementEnabled } from '../config/release.ts';

/**
 * Uçuştan fabrikaya dönüşte geçiş (midgame) reklamı gösterilsin mi? (G1)
 * Karar verilmedi (M9_PLAN K8); yayın yapılandırmasında kapalıdır. Açılırsa yalnızca o
 * uçuşta ödüllü reklam izlenmediyse ve son reklamın üstünden 3 dakika geçtiyse gösterilir.
 */
export const MIDGAME_AD_ENABLED = RELEASE.rewardedAdsEnabled && RELEASE.midgameAdsEnabled;

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

/** Oyuncunun ilerlemesine bağlı kapı (sahne takar): yeterince oynamadan reklam sunulmaz */
let progressGate: (() => boolean) | null = null;

/** Reklam tekliflerinin görünmesi için oyuncunun ilerleme koşulunu takar */
export function setAdProgressGate(gate: (() => boolean) | null): void {
  progressGate = gate;
}

// Yayın yapılandırması yerleşimi kapattıysa ya da oyuncu henüz yeni başladıysa teklif yoktur
ads.setPlacementGate((placement) => isAdPlacementEnabled(placement) && (progressGate?.() ?? true));

function useMock(): void {
  currentMode = 'mock';
  ads.setProvider(new MockAdProvider({ alwaysFail: override === 'fail' }));
}

function useOff(): void {
  currentMode = 'off';
  ads.setProvider(null);
}

if (!RELEASE.rewardedAdsEnabled || override === 'off') {
  // Basic derleme: reklam sağlayıcısı hiç takılmaz, SDK'dan reklam istenmez
  useOff();
} else if (override === 'mock' || override === 'fail') {
  useMock();
} else {
  // SDK başlatılana kadar reklam yoktur; sahte sağlayıcı kendiliğinden devreye girmez
  useOff();

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
