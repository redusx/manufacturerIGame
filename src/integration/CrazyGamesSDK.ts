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
 * - Reklam yönetimi: Midgame ve Rewarded Video (Çift kazanç)
 * - Reklam sırasında sesin (SoundManager) otomatik kısılması ve geri açılması
 * - SDK'nın bulunmadığı ortamlarda (Localhost / Node.js testleri) sıfır çökme
 * ====================================================================== */

import { sound } from '../audio/SoundManager.ts';

export type AdType = 'midgame' | 'rewarded';

export interface AdCallbacks {
  adStarted?: () => void;
  adFinished?: () => void;
  adError?: (error: unknown) => void;
}

export interface CrazyGamesSDKRaw {
  init(): Promise<void>;
  game: {
    gameplayStart(): void;
    gameplayStop(): void;
    happytime(): void;
  };
  ad: {
    requestAd(type: AdType, callbacks?: AdCallbacks): Promise<void>;
  };
}

export class CrazyGamesSDK {
  private static instance: CrazyGamesSDK | null = null;
  private rawSdk: CrazyGamesSDKRaw | null = null;
  private initialized = false;
  private isGameplayRunning = false;
  private wasSoundMutedBeforeAd = false;

  private constructor(customSdk?: CrazyGamesSDKRaw) {
    if (customSdk) {
      this.rawSdk = customSdk;
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
  public async init(): Promise<boolean> {
    if (this.initialized) return true;

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
        return true;
      }
    } catch (err) {
      console.warn('[CrazyGamesSDK] Başlatılamadı (Mock moda geçiliyor):', err);
    }

    this.initialized = true;
    return false;
  }

  /**
   * Oyuncunun aktif oyuna başladığını bildirir.
   */
  public gameplayStart(): void {
    if (this.isGameplayRunning) return;
    this.isGameplayRunning = true;

    if (this.rawSdk?.game?.gameplayStart) {
      try {
        this.rawSdk.game.gameplayStart();
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

    if (this.rawSdk?.game?.gameplayStop) {
      try {
        this.rawSdk.game.gameplayStop();
      } catch (err) {
        console.warn('[CrazyGamesSDK] gameplayStop hatası:', err);
      }
    }
  }

  /**
   * Başarı anlarında (Kilometre taşı açılışı, rekor uçuş mesafesi) çağrılır.
   */
  public happytime(): void {
    if (this.rawSdk?.game?.happytime) {
      try {
        this.rawSdk.game.happytime();
      } catch (err) {
        console.warn('[CrazyGamesSDK] happytime hatası:', err);
      }
    }
  }

  /**
   * Reklam gösterimi talep eder (Midgame veya Rewarded).
   * Reklam boyunca oyun içi sesi kısar, bitince eski haline getirir.
   * @returns Reklam başarıyla izlendiyse true, hata/iptal durumunda false döner.
   */
  public async requestAd(type: AdType): Promise<boolean> {
    const sdk = this.rawSdk;
    if (!sdk?.ad?.requestAd) {
      // SDK yoksa (Yerel test / geliştirme ortamı): doğrudan başarılı say
      return true;
    }

    return new Promise<boolean>((resolve) => {
      this.gameplayStop();
      this.wasSoundMutedBeforeAd = sound.isMuted();
      sound.setMuted(true);

      const callbacks: AdCallbacks = {
        adStarted: () => {
          // Reklam başladı
        },
        adFinished: () => {
          sound.setMuted(this.wasSoundMutedBeforeAd);
          this.gameplayStart();
          resolve(true);
        },
        adError: (error) => {
          console.warn('[CrazyGamesSDK] Reklam hatası:', error);
          sound.setMuted(this.wasSoundMutedBeforeAd);
          this.gameplayStart();
          resolve(false);
        },
      };

      sdk.ad.requestAd(type, callbacks).catch((err) => {
        console.warn('[CrazyGamesSDK] requestAd istisnası:', err);
        sound.setMuted(this.wasSoundMutedBeforeAd);
        this.gameplayStart();
        resolve(false);
      });
    });
  }

  /** Testler için durumu sıfırlar */
  public resetForTest(): void {
    this.initialized = false;
    this.isGameplayRunning = false;
    this.rawSdk = null;
  }
}

export const crazyGames = CrazyGamesSDK.getInstance();
