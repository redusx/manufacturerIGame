/* ======================================================================
 * src/config/platform.ts — Platform kuralları
 *
 * Yayın modundan (release.ts) bağımsızdır: Full derleme de CrazyGames'in
 * yasakladığı bir şeyi CrazyGames'te gösteremez. Platform, SDK'nın bildirdiği
 * ortamdan anlaşılır (`SDK.environment`); adres çubuğuna bakılmaz.
 *
 *   'crazygames' → oyun CrazyGames'te (site, uygulama, Preview) çalışıyor
 *   'local'      → localhost (SDK'nın deneme kipi)
 *   'disabled'   → başka bir alan adı; SDK yok → bağımsız çalıştırma
 * ====================================================================== */

import { crazyGames } from '../integration/CrazyGamesSDK.ts';
import { RELEASE } from './release.ts';

/** Yalnızca geliştirme sunucusunda: `?platform=crazygames` ile platform davranışı denenir */
function devPlatformOverride(): boolean {
  const env = (import.meta as unknown as { env?: { DEV?: boolean } }).env;
  if (env?.DEV !== true || typeof window === 'undefined') return false;
  try {
    return new URLSearchParams(window.location.search).get('platform') === 'crazygames';
  } catch {
    return false;
  }
}

/** Oyun CrazyGames'in içinde mi çalışıyor? */
export function isCrazyGamesPlatform(): boolean {
  return crazyGames.environment === 'crazygames' || devPlatformOverride();
}

/**
 * Oyun içi tam ekran düğmeleri gösterilsin mi? CrazyGames tam ekranı kendisi sunar ve
 * oyun içi tam ekran düğmesini yasaklar (docs.crazygames.com/requirements/gameplay).
 */
export function areFullscreenControlsAllowed(): boolean {
  return RELEASE.inGameFullscreenControlsEnabled && !isCrazyGamesPlatform();
}

/**
 * "Oyna"dan sonra kontrol şeması kendiliğinden açılsın mı? CrazyGames yeni oyuncunun en
 * fazla bir tıklamayla oynanışa inmesini ister; orada şema yalnız Ayarlar'dan açılır.
 */
export function shouldAutoOpenControls(): boolean {
  return !isCrazyGamesPlatform();
}
