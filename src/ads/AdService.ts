/* ======================================================================
 * src/ads/AdService.ts — Ödüllü reklam servisi
 *
 * Oyundaki bütün ödüllü reklam yerleşimlerinin tek istek noktası: yerleşim
 * sunulabilir mi, bekleme süresi doldu mu, reklam gösterildi mi. Ödülü çağıran
 * taraf verir ve yalnızca sonuç 'rewarded' ise verir.
 *
 * Reklamı gösteren sağlayıcı dışarıdan takılır (şimdilik sahte sağlayıcı, en son
 * CrazyGames). Sağlayıcı yoksa veya reklam sunamıyorsa yerleşimler "sunulmuyor"
 * sayılır ve arayüz düğmelerini gizler; etkisiz düğme bırakılmaz.
 * (docs/M9_PLAN.md §4.5, DEC-032)
 *
 * Saf TypeScript — Phaser ve DOM bağımlılığı yoktur.
 * ====================================================================== */

export type AdPlacementId =
  /** R1: çevrimdışı kazancı ikiye katla */
  | 'offline_double'
  /** R2: uçuş primini üçe katla */
  | 'flight_bonus'
  /** R3: gelir takviyesi (10 dk ×2) */
  | 'income_boost'
  /** R4: hangar parça kargosu */
  | 'parts_cargo'
  /** R5: parsel müteahhit indirimi */
  | 'plot_discount';

export type AdMode = 'mock' | 'crazygames' | 'off';

export type AdResult =
  /** Reklam sonuna kadar izlendi; ödül verilir */
  | 'rewarded'
  /** Reklam gösterilemedi veya yarıda kesildi; ödül verilmez */
  | 'failed'
  /** Reklam sunulamıyor (sağlayıcı yok, reklam engelleyici, kapalı mod) */
  | 'unavailable'
  /** Yerleşimin bekleme süresi dolmadı */
  | 'cooldown'
  /** Başka bir reklam gösteriliyor */
  | 'busy';

export interface AdProviderHooks {
  /** Reklam gerçekten ekrana geldiğinde çağrılır (oyun durur, ses kısılır) */
  onStarted: () => void;
}

export interface AdProvider {
  /** Şu an ödüllü reklam gösterilebilir mi? */
  isAvailable(): boolean;
  /** Ödüllü reklamı gösterir; sonuna kadar izlenirse true döner */
  showRewarded(placement: AdPlacementId, hooks: AdProviderHooks): Promise<boolean>;
  /** Geçiş (midgame) reklamı; ödülü yoktur. Sağlayıcı desteklemiyorsa tanımlanmaz */
  showMidgame?(hooks: AdProviderHooks): Promise<boolean>;
}

/** İki geçiş reklamı arasında (ve bir ödüllü reklamdan sonra) geçmesi gereken en az süre (saniye) */
export const MIDGAME_MIN_INTERVAL_SEC = 180;

/** Bir yerleşimin ödülünden sonra yeniden sunulana dek geçmesi gereken süre (saniye) */
export const AD_COOLDOWN_SEC: Readonly<Record<AdPlacementId, number>> = {
  offline_double: 0,
  flight_bonus: 180,
  income_boost: 300,
  parts_cargo: 600,
  plot_discount: 0,
};

export interface AdServiceState {
  /** Yerleşim -> son ödülün verildiği an (epoch ms) */
  lastRewardAt: Partial<Record<AdPlacementId, number>>;
}

/** Reklamın ekrana gelişini ve kapanışını dinleyenler (ses, oyunun duraklaması) */
export interface AdLifecycleListener {
  /** Reklam ekrana geldi: oyun durur, ses kısılır */
  onStarted?: () => void;
  /** Reklam kapandı (ödüllü veya ödülsüz): oyun kaldığı yerden sürer */
  onEnded?: (elapsedSec: number) => void;
}

export class AdService {
  private provider: AdProvider | null;
  private readonly now: () => number;
  private readonly lastRewardAt = new Map<AdPlacementId, number>();
  private readonly listeners = new Set<AdLifecycleListener>();
  private showing = false;
  private playing = false;
  /** Son reklamın (ödüllü veya geçiş) ekrana geldiği an; geçiş reklamı aralığı buna göre tutulur */
  private lastAdStartedAt: number | null = null;

  constructor(provider: AdProvider | null = null, now: () => number = Date.now) {
    this.provider = provider;
    this.now = now;
  }

  setProvider(provider: AdProvider | null): void {
    this.provider = provider;
  }

  /** Dinleyici ekler; dönen işlev dinleyiciyi kaldırır */
  subscribe(listener: AdLifecycleListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Bir reklam istendi ve henüz sonuçlanmadı mı? */
  get isShowing(): boolean {
    return this.showing;
  }

  /** Reklam şu an ekranda mı? (Oyun bu sırada duraklar) */
  get isPlaying(): boolean {
    return this.playing;
  }

  /**
   * Yerleşimin düğmesi gösterilsin mi? Reklam sunulamıyorsa false döner ve
   * arayüz düğmeyi hiç çizmez.
   */
  isOffered(_placement: AdPlacementId): boolean {
    return this.provider?.isAvailable() ?? false;
  }

  /** Yerleşimin yeniden sunulmasına kalan süre (saniye); hazırsa 0 */
  cooldownRemaining(placement: AdPlacementId): number {
    const last = this.lastRewardAt.get(placement);
    if (last === undefined) return 0;
    const elapsedSec = (this.now() - last) / 1000;
    return Math.max(0, Math.ceil(AD_COOLDOWN_SEC[placement] - elapsedSec));
  }

  /** Düğmeye basılırsa reklam hemen gösterilebilir mi? */
  canShow(placement: AdPlacementId): boolean {
    return this.isOffered(placement) && !this.showing && this.cooldownRemaining(placement) === 0;
  }

  /**
   * Reklamı gösterir. Ödül yalnızca 'rewarded' sonucunda verilir; bekleme süresi
   * de yalnızca o zaman başlar.
   */
  async show(placement: AdPlacementId): Promise<AdResult> {
    const provider = this.provider;
    if (!provider || !provider.isAvailable()) return 'unavailable';
    if (this.showing) return 'busy';
    if (this.cooldownRemaining(placement) > 0) return 'cooldown';

    const completed = await this.run((hooks) => provider.showRewarded(placement, hooks));
    if (!completed) return 'failed';
    this.lastRewardAt.set(placement, this.now());
    return 'rewarded';
  }

  /**
   * Geçiş (midgame) reklamı gösterir; ödülü yoktur. Yalnızca doğal bir arada
   * (ör. uçuştan fabrikaya dönüş) çağrılır. Son reklamın üstünden
   * `MIDGAME_MIN_INTERVAL_SEC` geçmediyse veya sağlayıcı desteklemiyorsa hiçbir şey yapmaz.
   * Reklam gösterildiyse true döner.
   */
  async showMidgame(): Promise<boolean> {
    const provider = this.provider;
    if (!provider?.showMidgame || !provider.isAvailable() || this.showing) return false;
    if (this.lastAdStartedAt !== null && (this.now() - this.lastAdStartedAt) / 1000 < MIDGAME_MIN_INTERVAL_SEC) {
      return false;
    }
    return this.run((hooks) => provider.showMidgame!(hooks));
  }

  /** Reklamı çalıştırır; başlangıç ve bitişi dinleyicilere bildirir */
  private async run(showAd: (hooks: AdProviderHooks) => Promise<boolean>): Promise<boolean> {
    this.showing = true;
    let startedAt: number | null = null;
    let completed = false;
    try {
      completed = await showAd({
        onStarted: () => {
          if (startedAt !== null) return;
          startedAt = this.now();
          this.lastAdStartedAt = startedAt;
          this.playing = true;
          for (const listener of this.listeners) listener.onStarted?.();
        },
      });
    } catch {
      completed = false;
    } finally {
      this.showing = false;
      if (startedAt !== null) {
        this.playing = false;
        const elapsedSec = Math.max(0, (this.now() - startedAt) / 1000);
        for (const listener of this.listeners) listener.onEnded?.(elapsedSec);
      }
    }
    return completed;
  }

  serialize(): AdServiceState {
    const lastRewardAt: AdServiceState['lastRewardAt'] = {};
    for (const [placement, at] of this.lastRewardAt) {
      lastRewardAt[placement] = at;
    }
    return { lastRewardAt };
  }

  deserialize(state: Partial<AdServiceState> | undefined): void {
    this.lastRewardAt.clear();
    const saved = state?.lastRewardAt;
    if (!saved || typeof saved !== 'object') return;
    const now = this.now();
    for (const placement of Object.keys(AD_COOLDOWN_SEC) as AdPlacementId[]) {
      const at = saved[placement];
      // Saat geri alınmışsa bekleme süresi sonsuza uzamasın
      if (typeof at === 'number' && Number.isFinite(at)) {
        this.lastRewardAt.set(placement, Math.min(at, now));
      }
    }
  }
}

/** Bekleme süresini düğme üstünde gösterilecek biçimde yazar: "4:05" */
export function formatAdCooldown(seconds: number): string {
  const total = Math.max(0, Math.ceil(seconds));
  const minutes = Math.floor(total / 60);
  const secs = total % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}
