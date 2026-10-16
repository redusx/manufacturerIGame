/* ======================================================================
 * src/config/release.ts — Yayın yapılandırması (Basic / Full)
 *
 * Tek kod tabanından iki yayın çıktısı üretilir; aralarındaki bütün fark
 * buradaki tablodadır. Bir özelliği kapatmak onu silmek değildir: kodu,
 * düğmeleri ve SDK bağlantısı yerinde durur, yalnızca sunulmaz.
 *
 *   npm run build:basic  → dist-basic/  (CrazyGames Basic Launch: reklam yok)
 *   npm run build:full   → dist-full/   (Full Launch: reklamlar ve lider tablosu açılabilir)
 *   npm run build        → dist/        (eski komut; Full ile aynı yapılandırma)
 *
 * Mod, Vite'ın `--mode` değerinden okunur (`import.meta.env.MODE`); kaynak dosya
 * düzenlemek gerekmez. Geliştirme sunucusunda `?release=basic` ile denenebilir.
 *
 * Bayrak "açık" olması özelliğin her yerde görüneceği anlamına gelmez: reklam için
 * SDK'nın reklam sunabilmesi, lider tablosu için davet + anahtar, tam ekran düğmesi
 * için platformun izin vermesi ayrıca gerekir (bkz. platform.ts, ads.ts, leaderboard.ts).
 *
 * Saf TypeScript — Phaser ve DOM bağımlılığı yoktur.
 * ====================================================================== */

import type { AdPlacementId } from '../ads/AdService.ts';

export type ReleaseMode = 'basic' | 'full';

export interface ReleaseConfig {
  mode: ReleaseMode;
  /** Ödüllü reklamların ana şalteri; kapalıyken hiçbir reklam teklifi çizilmez */
  rewardedAdsEnabled: boolean;
  /** Yerleşim başına şalter (ana şalter açıkken geçerlidir) */
  adPlacements: Readonly<Record<AdPlacementId, boolean>>;
  /** Uçuş dönüşünde geçiş (midgame) reklamı (G1); karar verilmedi, kapalı */
  midgameAdsEnabled: boolean;
  /**
   * Reklam teklifleri en erken kaç aşama tamamlandıktan sonra görünür?
   * (CrazyGames: oyuncu yeterince oynamadan reklam sunulmaz.)
   */
  adsMinCompletedStages: number;
  /**
   * Genel lider tablosu (CrazyGames tablosu ve varsa oyunun kendi skor sunucusu).
   * Açıkken bile davet ve anahtar yoksa sunulmaz.
   */
  globalLeaderboardEnabled: boolean;
  /** Oyun içi tam ekran düğmeleri; platform yasaklıyorsa (CrazyGames) yine gösterilmez */
  inGameFullscreenControlsEnabled: boolean;
}

const ALL_PLACEMENTS_OFF: Readonly<Record<AdPlacementId, boolean>> = {
  offline_double: false,
  flight_bonus: false,
  income_boost: false,
  parts_cargo: false,
  plot_discount: false,
  pad_discount: false,
  machine_discount: false,
};

export const RELEASE_CONFIGS: Readonly<Record<ReleaseMode, ReleaseConfig>> = {
  /* Basic Launch: CrazyGames reklamı kapalı tutar; reklam teklifi hiç gösterilmez */
  basic: {
    mode: 'basic',
    rewardedAdsEnabled: false,
    adPlacements: ALL_PLACEMENTS_OFF,
    midgameAdsEnabled: false,
    adsMinCompletedStages: 2,
    globalLeaderboardEnabled: false,
    // CrazyGames tam ekranı kendisi sunar; yerel denemede de düğme görünmesin
    inGameFullscreenControlsEnabled: false,
  },
  /* Full Launch: mevcut bütün reklam yerleşimleri kullanılabilir */
  full: {
    mode: 'full',
    rewardedAdsEnabled: true,
    adPlacements: {
      offline_double: true, // R1 çevrimdışı kazanç ×2
      flight_bonus: true, // R2 uçuş primi ×3
      income_boost: true, // R3 gelir takviyesi
      parts_cargo: true, // R4 hangar parça kargosu
      plot_discount: true, // R5 parsel indirimi
      pad_discount: true, // R6 fırlatma rampası indirimi
      machine_discount: true, // R7 makine yükseltme indirimi
    },
    midgameAdsEnabled: false,
    adsMinCompletedStages: 2,
    globalLeaderboardEnabled: true,
    // CrazyGames tam ekranı kendisi sunar; yerel denemede de düğme görünmesin
    inGameFullscreenControlsEnabled: false,
  },
};

/** Ham mod değerini yayın moduna çevirir; tanınmayan her değer (üretim, geliştirme) Full sayılır */
export function resolveReleaseMode(raw: string | null | undefined): ReleaseMode {
  return raw === 'basic' ? 'basic' : 'full';
}

function readMode(): ReleaseMode {
  const env = (import.meta as unknown as { env?: { MODE?: string; DEV?: boolean } }).env;
  // Yalnızca geliştirme sunucusunda: adres çubuğundan mod denemesi
  if (env?.DEV === true && typeof window !== 'undefined') {
    try {
      const override = new URLSearchParams(window.location.search).get('release');
      if (override === 'basic' || override === 'full') return override;
    } catch {
      // Adres okunamıyorsa derleme modu geçerlidir
    }
  }
  return resolveReleaseMode(env?.MODE);
}

/** Bu derlemenin yayın yapılandırması */
export const RELEASE: ReleaseConfig = RELEASE_CONFIGS[readMode()];

/** Bu yerleşimin reklamı bu derlemede sunulabilir mi? (SDK'nın durumu ayrıca denetlenir) */
export function isAdPlacementEnabled(placement: AdPlacementId): boolean {
  return RELEASE.rewardedAdsEnabled && RELEASE.adPlacements[placement];
}
