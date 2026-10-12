/* ======================================================================
 * src/integration/CrazyGamesSDK.ts — CrazyGames SDK v3 Entegrasyon Adaptörü
 *
 * CrazyGames HTML5 platformu için resmi SDK v3 çağrılarını saran,
 * yerel geliştirme ve test ortamlarında hatasız sahte (mock) çalışan
 * güvenli adaptör katmanı. (docs/MASTER_PLAN.md TASK-123)
 *
 * Sorumluluklar:
 * - SDK v3 başlatma (init): bir kez, zaman aşımı korumalı; başka alan adında ('disabled') SDK'ya hiç dokunulmaz
 * - Yükleme ve oyun döngüsü: loadingStart/Stop, gameplayStart/Stop, happytime()
 * - Kullanıcı: hesap bilgisi, giriş penceresi, lider tablosuna skor gönderme
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

/** SDK'nın `adError` ile bildirdiği nedenler (docs.crazygames.com/sdk/video-ads) */
export type AdErrorCode = 'adsDisabledBasicLaunch' | 'unfilled' | 'adblock' | 'adCooldown' | 'other';

const AD_ERROR_CODES: readonly AdErrorCode[] = ['adsDisabledBasicLaunch', 'unfilled', 'adblock', 'adCooldown', 'other'];

/** CrazyGames hesabı; giriş yapılmamışsa SDK null döndürür */
export interface CrazyGamesUser {
  username: string;
  profilePictureUrl?: string;
}

export interface CrazyGamesSDKRaw {
  init(): Promise<void>;
  /** 'crazygames' (sitede) · 'local' (localhost; deneme reklamı) · 'disabled' (başka alan adı) */
  environment?: string;
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
    loadingStart?(): void;
    loadingStop?(): void;
  };
  ad: {
    requestAd(type: AdType, callbacks?: AdCallbacks): Promise<void>;
    hasAdblock?(): Promise<boolean>;
  };
  /** Kullanıcı modülü: lider tablosuna skor gönderme (davetli oyunlarda etkindir) */
  user?: {
    submitScore?(payload: { encryptedScore: string; score: number }): Promise<void> | void;
    /** Hesap sistemi bu ortamda kullanılabilir mi? (Oyunu gömen başka sitelerde false) */
    isUserAccountAvailable?: boolean;
    getUser?(): Promise<CrazyGamesUser | null>;
    /** CrazyGames'in giriş / kayıt penceresini açar; yalnızca oyuncunun isteğiyle çağrılır */
    showAuthPrompt?(): Promise<CrazyGamesUser | null>;
  };
}

/** Reklam isteği sırasında çağıranın dinlediği olaylar */
export interface AdRequestHooks {
  /** Reklam gerçekten ekrana geldi (ses ve oyun bu anda durdurulur) */
  onStarted?: () => void;
}

/** SDK'nın çalıştığı ortamlar; 'disabled' ortamda (başka alan adı) her SDK çağrısı hata fırlatır */
const ACTIVE_ENVIRONMENTS: readonly string[] = ['crazygames', 'local'];
/** Başlatma bu sürede bitmezse oyun SDK'sız açılır (ms) */
const INIT_TIMEOUT_MS = 5000;

export class CrazyGamesSDK {
  private static instance: CrazyGamesSDK | null = null;
  private rawSdk: CrazyGamesSDKRaw | null = null;
  private initialized = false;
  /** Gerçek SDK'nın init()'i tamamlandı mı? Öncesinde SDK'ya dokunmak hata fırlatır. */
  private sdkReady = false;
  private isGameplayRunning = false;
  /** Sürmekte olan veya tamamlanmış başlatma; init() iki kez çağrılırsa SDK bir kez başlatılır */
  private initPromise: Promise<boolean> | null = null;
  /** Reklam engelleyici algılandı mı? (Başlatmadan sonra sorulur; reklam hatası da bildirebilir) */
  private adblockDetected = false;
  /** Platform reklamları kapattı mı? (Basic Launch); o zaman düğmeler hiç çizilmez */
  private adsDisabledByPlatform = false;
  /** Son reklam isteğinin neden başarısız olduğu; başarılıysa null */
  private adErrorCode: AdErrorCode | null = null;
  private isLoading = false;

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
        // Takılan bir başlatma oyunu açılmaz hâle getirmesin
        const timedOut = await Promise.race([
          this.rawSdk.init().then(() => false),
          new Promise<boolean>((resolve) => setTimeout(() => resolve(true), INIT_TIMEOUT_MS)),
        ]);
        if (timedOut) throw new Error(`init ${INIT_TIMEOUT_MS} ms içinde bitmedi`);
        this.initialized = true;
        // CrazyGames dışındaki alan adlarında SDK kapalıdır: her çağrısı hata fırlatır
        let environment = 'crazygames';
        try {
          environment = this.rawSdk.environment ?? 'crazygames';
        } catch {
          environment = 'disabled';
        }
        if (!ACTIVE_ENVIRONMENTS.includes(environment)) {
          console.info(`[CrazyGamesSDK] Ortam "${environment}": platform özellikleri kapalı, oyun onlarsız çalışır.`);
          return false;
        }
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

  /** SDK kullanılabilir mi? (Başlatıldı ve ortam CrazyGames ya da yerel deneme) */
  public get isReady(): boolean {
    return this.sdkReady;
  }

  /** Yükleme başladı (oyunun dosyaları inmeye başlarken bir kez) */
  public loadingStart(): void {
    if (this.isLoading) return;
    this.isLoading = true;
    try {
      this.readySdk?.game?.loadingStart?.();
    } catch (err) {
      console.warn('[CrazyGamesSDK] loadingStart hatası:', err);
    }
  }

  /** Yükleme bitti, oyun oynanmaya hazır */
  public loadingStop(): void {
    if (!this.isLoading) return;
    this.isLoading = false;
    try {
      this.readySdk?.game?.loadingStop?.();
    } catch (err) {
      console.warn('[CrazyGamesSDK] loadingStop hatası:', err);
    }
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
    if (!sdk || this.adblockDetected || this.adsDisabledByPlatform) return false;
    if (!ACTIVE_ENVIRONMENTS.includes(this.environment)) return false;
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
    this.adErrorCode = null;
    if (!sdk || !this.canShowAds()) return false;

    return new Promise<boolean>((resolve) => {
      let started = false;
      let settled = false;
      let wasPlaying = false;
      // Sonuç yalnızca bir kez işlenir: adError'dan sonra gelen adFinished ödül verdirmez
      const finish = (completed: boolean): void => {
        if (settled) return;
        settled = true;
        // Oyun reklamdan önce oynanıyorsa (ör. fabrika) kaldığı yerden sürer;
        // zaten duruyorsa (ör. uçuş raporu) başlatılmaz
        if (started && wasPlaying) this.gameplayStart();
        resolve(completed);
      };

      const callbacks: AdCallbacks = {
        adStarted: () => {
          if (started) return;
          started = true;
          wasPlaying = this.isGameplayRunning;
          this.gameplayStop();
          hooks.onStarted?.();
        },
        adFinished: () => finish(true),
        adError: (error) => {
          if (settled) return;
          this.adErrorCode = CrazyGamesSDK.readAdErrorCode(error);
          // Bu iki durumda reklam bu oturumda hiç gelmez: düğmeler basılıp iş görmez
          // hâlde kalmasın diye reklam "sunulmuyor" sayılır ve arayüz onları kaldırır
          if (this.adErrorCode === 'adblock') this.adblockDetected = true;
          if (this.adErrorCode === 'adsDisabledBasicLaunch') this.adsDisabledByPlatform = true;
          console.warn('[CrazyGamesSDK] Reklam gösterilemedi:', error);
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

  /** `adError`'ın verdiği nesneden nedeni okur; tanınmıyorsa 'other' */
  private static readAdErrorCode(error: unknown): AdErrorCode {
    const code = (error as { code?: unknown } | null)?.code;
    return AD_ERROR_CODES.find((known) => known === code) ?? 'other';
  }

  /** Son reklam isteği neden başarısız oldu? Başarılıysa ya da hiç istenmediyse null */
  public get lastAdError(): AdErrorCode | null {
    return this.adErrorCode;
  }

  /** Hesap sistemi bu ortamda var mı? (Oyunu gömen başka sitelerde yoktur) */
  public get isUserAccountAvailable(): boolean {
    try {
      return this.readySdk?.user?.isUserAccountAvailable === true;
    } catch {
      return false;
    }
  }

  /** Giriş yapmış CrazyGames kullanıcısı; misafirse ya da SDK yoksa null */
  public async getUser(): Promise<CrazyGamesUser | null> {
    try {
      return (await this.readySdk?.user?.getUser?.()) ?? null;
    } catch (err) {
      console.warn('[CrazyGamesSDK] getUser hatası:', err);
      return null;
    }
  }

  /**
   * CrazyGames'in giriş penceresini açar. Yalnızca oyuncu bir düğmeye bastığında çağrılır
   * (kendiliğinden açmak kurallara aykırıdır). Oyuncu vazgeçerse null döner.
   */
  public async showAuthPrompt(): Promise<CrazyGamesUser | null> {
    try {
      return (await this.readySdk?.user?.showAuthPrompt?.()) ?? null;
    } catch {
      // userCancelled, userAlreadySignedIn, showAuthPromptInProgress: hepsi "değişiklik yok"
      return null;
    }
  }

  /** Lider tablosuna skor gönderilebilir mi? (SDK hazır ve skor gönderme işlevi var) */
  public get canSubmitScore(): boolean {
    try {
      return typeof this.readySdk?.user?.submitScore === 'function' && !!globalThis.crypto?.subtle;
    } catch {
      return false;
    }
  }

  /**
   * CrazyGames lider tablosuna skor gönderir (istemci tarafı yol). Skor, geliştirici
   * panelinde üretilen 32 baytlık anahtarla AES-GCM ile şifrelenir; şifreli ve açık skor
   * birlikte gönderilir (docs.crazygames.com/sdk/leaderboards-client). Sıralamayı CrazyGames
   * kendi panelinde gösterir; oyun listeyi okuyamaz. SDK veya anahtar yoksa false döner.
   */
  public async submitLeaderboardScore(score: number, encryptionKeyBase64: string): Promise<boolean> {
    const subtle = globalThis.crypto?.subtle;
    if (!this.canSubmitScore || !subtle || !encryptionKeyBase64) return false;
    if (!Number.isFinite(score) || score < 0) return false;

    try {
      const keyBytes = Uint8Array.from(atob(encryptionKeyBase64), (char) => char.charCodeAt(0));
      const key = await subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt']);
      const iv = globalThis.crypto.getRandomValues(new Uint8Array(12));
      const cipher = new Uint8Array(
        await subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(score.toString())),
      );
      const combined = new Uint8Array(iv.length + cipher.length);
      combined.set(iv, 0);
      combined.set(cipher, iv.length);
      const encryptedScore = btoa(String.fromCharCode(...combined));
      await this.readySdk?.user?.submitScore?.({ encryptedScore, score });
      return true;
    } catch (err) {
      console.warn('[CrazyGamesSDK] submitScore başarısız:', err);
      return false;
    }
  }

  /** Testler için durumu sıfırlar */
  public resetForTest(): void {
    this.initialized = false;
    this.sdkReady = false;
    this.isGameplayRunning = false;
    this.rawSdk = null;
    this.initPromise = null;
    this.adblockDetected = false;
    this.adsDisabledByPlatform = false;
    this.adErrorCode = null;
    this.isLoading = false;
  }
}

export const crazyGames = CrazyGamesSDK.getInstance();
