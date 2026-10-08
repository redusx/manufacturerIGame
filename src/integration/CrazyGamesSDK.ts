/* ======================================================================
 * src/integration/CrazyGamesSDK.ts — CrazyGames SDK v3 Entegrasyon Adaptörü
 *
 * CrazyGames HTML5 platformu için resmi SDK v3 çağrılarını saran,
 * yerel geliştirme ve test ortamlarında hatasız sahte (mock) çalışan
 * güvenli adaptör katmanı. (docs/MASTER_PLAN.md TASK-123)
 *
 * Sorumluluklar:
 * - SDK v3 başlatma (init)
 * - Oyun döngüsü takibi: gameplayStart(), gameplayStop(), happytime()
 * - Reklam yönetimi: Midgame ve Rewarded Video; reklam başladığında/bitince oyun
 *   döngüsü bildirimi (ses ve duraklatma AdService dinleyicilerindedir)
 * - Reklam gösterilebilirlik denetimi (ortam, reklam engelleyici)
 * - SDK'nın bulunmadığı ortamlarda (Localhost / Node.js testleri) sıfır çökme
 * ====================================================================== */

export type AdType = 'midgame' | 'rewarded';

export interface AdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown) => void;
}

export interface CrazyGamesSDKRaw {
  init(): Promise<void>;
  /** 'crazygames' (sitede) · 'local' (localhost; deneme reklamı) · 'disabled' (başka alan adı) */
  environment?: string;
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
  };
  ad: {
    requestAd(type: AdType, callbacks?: AdCallbacks): Promise<void>;
    hasAdblock?(): Promise<boolean>;
  };
}

/** Reklam isteği sırasında çağıranın dinlediği olaylar */
export interface AdRequestHooks {
  /** Reklam gerçekten ekrana geldi (ses ve oyun bu anda durdurulur) */
  onStarted?: () => void;
}

/** SDK'nın reklam gösterebildiği ortamlar */
const AD_ENVIRONMENTS: readonly string[] = ['crazygames', 'local'];

export class CrazyGamesSDK {
  private static instance: CrazyGamesSDK | null = null;
  private rawSdk: CrazyGamesSDKRaw | null = null;
  private initialized = false;
  /** Gerçek SDK'nın init()'i tamamlandı mı? Öncesinde SDK'ya dokunmak hata fırlatır. */
  private sdkReady = false;
  private isGameplayRunning = false;
  /** Sürmekte olan veya tamamlanmış başlatma; init() iki kez çağrılırsa SDK bir kez başlatılır */
  private initPromise: Promise<boolean> | null = null;
  /** Reklam engelleyici algılandı mı? (Başlatmadan sonra bir kez sorulur) */
  private adblockDetected = false;

  private constructor(customSdk?: CrazyGamesSDKRaw) {
    if (customSdk) {
      // Dışarıdan verilen SDK (testler) başlatma beklemeden kullanılabilir
      this.rawSdk = customSdk;
      this.sdkReady = true;
    }
  }

  public static getInstance(customSdk?: CrazyGamesSDKRaw): CrazyGamesSDK {
    if (!CrazyGamesSDK.instance || customSdk) {
      CrazyGamesSDK.instance = new CrazyGamesSDK(customSdk);
    }
    return CrazyGamesSDK.instance;
  }

  /**
   * SDK'nın tarayıcıda yüklü olup olmadığını denetler.
   */
  public isAvailable(): boolean {
    if (this.rawSdk) return true;
    if (typeof window !== 'undefined') {
      const win = window as unknown as { CrazyGames?: { SDK?: CrazyGamesSDKRaw } };
      return !!win.CrazyGames?.SDK;
    }
    return false;
  }

  /**
   * CrazyGames SDK v3'ü başlatır.
   */
  public init(): Promise<boolean> {
    if (!this.initPromise) this.initPromise = this.runInit();
    return this.initPromise;
  }

  private async runInit(): Promise<boolean> {
    try {
      if (!this.rawSdk && typeof window !== 'undefined') {
        const win = window as unknown as { CrazyGames?: { SDK?: CrazyGamesSDKRaw } };
        if (win.CrazyGames?.SDK) {
          this.rawSdk = win.CrazyGames.SDK;
        }
      }

      if (this.rawSdk) {
        await this.rawSdk.init();
        this.initialized = true;
        this.sdkReady = true;
        // Başlatma bitmeden istenen oyun başlangıcı şimdi bildirilir
        if (this.isGameplayRunning) {
          this.isGameplayRunning = false;
          this.gameplayStart();
        }
        // Reklam engelleyici varsa ödüllü reklam düğmeleri hiç gösterilmez
        try {
          this.adblockDetected = (await this.rawSdk.ad?.hasAdblock?.()) === true;
        } catch {
          this.adblockDetected = false;
        }
        return true;
      }
    } catch (err) {
      console.warn('[CrazyGamesSDK] Başlatılamadı (Mock moda geçiliyor):', err);
    }

    this.initialized = true;
    return false;
  }

  /**
   * Kullanıma hazır SDK. CrazyGames dışındaki alan adlarında (ör. yerel ağ IP'si)
   * SDK, init() bitmeden `game` / `ad` alanlarına erişilince hata fırlatır; sahne
   * kurulumu bu yüzden yarıda kalmasın diye hazır olana dek null döner.
   */
  private get readySdk(): CrazyGamesSDKRaw | null {
    return this.sdkReady ? this.rawSdk : null;
  }

  /**
   * Oyuncunun aktif oyuna başladığını bildirir.
   */
  public gameplayStart(): void {
    if (this.isGameplayRunning) return;
    this.isGameplayRunning = true;

    const sdk = this.readySdk;
    if (sdk) {
      try {
        sdk.game?.gameplayStart?.();
      } catch (err) {
        console.warn('[CrazyGamesSDK] gameplayStart hatası:', err);
      }
    }
  }

  /**
   * Oyun duraklatıldığında veya menüye dönüldüğünde bildirir.
   */
  public gameplayStop(): void {
    if (!this.isGameplayRunning) return;
    this.isGameplayRunning = false;

    const sdk = this.readySdk;
    if (sdk) {
      try {
        sdk.game?.gameplayStop?.();
      } catch (err) {
        console.warn('[CrazyGamesSDK] gameplayStop hatası:', err);
      }
    }
  }

  /**
   * Başarı anlarında (Kilometre taşı açılışı, rekor uçuş mesafesi) çağrılır.
   */
  public happytime(): void {
    const sdk = this.readySdk;
    if (sdk) {
      try {
        sdk.game?.happytime?.();
      } catch (err) {
        console.warn('[CrazyGamesSDK] happytime hatası:', err);
      }
    }
  }

  /** SDK'nın çalıştığı ortam; SDK hazır değilse 'unavailable' */
  public get environment(): string {
    const sdk = this.readySdk;
    if (!sdk) return 'unavailable';
    try {
      // Ortam bildirmeyen SDK (testler) reklam gösterebilir sayılır
      return sdk.environment ?? 'crazygames';
    } catch {
      return 'unavailable';
    }
  }

  /**
   * Şu an reklam gösterilebilir mi? SDK hazır, ortam reklam destekliyor ve reklam
   * engelleyici yoksa true. False iken arayüz reklam düğmelerini hiç çizmez.
   */
  public canShowAds(): boolean {
    const sdk = this.readySdk;
    if (!sdk || this.adblockDetected) return false;
    if (!AD_ENVIRONMENTS.includes(this.environment)) return false;
    try {
      return typeof sdk.ad?.requestAd === 'function';
    } catch {
      return false;
    }
  }

  /**
   * Reklam gösterimi talep eder (Midgame veya Rewarded).
   * Oyun ve ses yalnızca reklam gerçekten başladığında durur (`hooks.onStarted`);
   * reklam gelmezse hiçbir şey durmaz. SDK yoksa veya reklam gösterilemezse false
   * döner: çağıran ödül vermez.
   * @returns Reklam sonuna kadar izlendiyse true, hata/iptal durumunda false döner.
   */
  public async requestAd(type: AdType, hooks: AdRequestHooks = {}): Promise<boolean> {
    const sdk = this.readySdk;
    if (!sdk || !this.canShowAds()) return false;

    return new Promise<boolean>((resolve) => {
      let started = false;
      let settled = false;
      const finish = (completed: boolean): void => {
        if (settled) return;
        settled = true;
        if (started) this.gameplayStart();
        resolve(completed);
      };

      const callbacks: AdCallbacks = {
        adStarted: () => {
          if (started) return;
          started = true;
          this.gameplayStop();
          hooks.onStarted?.();
        },
        adFinished: () => finish(true),
        adError: (error) => {
          console.warn('[CrazyGamesSDK] Reklam hatası:', error);
          finish(false);
        },
      };

      try {
        sdk.ad.requestAd(type, callbacks).catch((err) => {
          console.warn('[CrazyGamesSDK] requestAd istisnası:', err);
          finish(false);
        });
      } catch (err) {
        console.warn('[CrazyGamesSDK] requestAd çağrılamadı:', err);
        finish(false);
      }
    });
  }

  /** Testler için durumu sıfırlar */
  public resetForTest(): void {
    this.initialized = false;
    this.sdkReady = false;
    this.isGameplayRunning = false;
    this.rawSdk = null;
    this.initPromise = null;
    this.adblockDetected = false;
  }
}

export const crazyGames = CrazyGamesSDK.getInstance();
