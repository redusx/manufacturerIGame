/* ======================================================================
 * src/audio/SoundManager.ts — Prosedürel Piksel-Art Ses Efektleri Motoru
 *
 * Web Audio API ile sıfır harici dosya indirme gecikmesi ve %100 güvenilirlikle
 * 8-bit / 16-bit retro chiptune ses efektleri üreten merkezi ses yöneticisi.
 * (docs/MASTER_PLAN.md TASK-122)
 *
 * Sorumluluklar:
 * - Buton tıklamaları, eşya/para toplama, yükseltme arpejleri, roket fırlatma,
 *   boost ve çarpışma seslerinin frekans sentezlemesi
 * - Sessize alma (Mute) ve ses seviyesi kontrolü
 * - LocalStorage kalıcı ses tercihi saklama
 * - Node.js headless test ortamında hatasız çalışma (Safe AudioContext Fallback)
 * ====================================================================== */

export const AUDIO_STORAGE_KEY = 'manufacturer_audio_muted';

export interface SoundOptions {
  volume?: number;
  pitch?: number;
}

export class SoundManager {
  private static instance: SoundManager | null = null;
  private ctx: AudioContext | null = null;
  private muted = false;
  private masterGain: GainNode | null = null;

  private constructor() {
    this.loadSettings();
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  /**
   * Kullanıcı ayarlarını depolamadan yükler.
   */
  private loadSettings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        const saved = localStorage.getItem(AUDIO_STORAGE_KEY);
        if (saved !== null) {
          this.muted = saved === 'true';
        }
      }
    } catch {
      // Depolama erişilemezse varsayılan açık (false)
    }
  }

  /**
   * Ayarları depolar.
   */
  private saveSettings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUDIO_STORAGE_KEY, String(this.muted));
      }
    } catch {
      // Depolama erişilemezse yoksay
    }
  }

  /**
   * AudioContext'i ilk kullanıcı etkileşiminde başlatır (Tarayıcı Autoplay kuralı).
   */
  public initContext(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx =
        (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.3, this.ctx.currentTime);
        this.masterGain.connect(this.ctx.destination);
      }
    } catch {
      // Ses desteği olmayan ortamlarda sessiz kal
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.saveSettings();

    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(this.muted ? 0 : 0.3, this.ctx.currentTime);
    }
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /**
   * Temel ton sentezleyici (Square / Sine / Triangle dalgası)
   */
  private playTone(
    freqStart: number,
    freqEnd: number,
    durationMs: number,
    type: OscillatorType = 'square',
    volume = 0.25,
  ): void {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const now = this.ctx.currentTime;
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = type;
      osc.frequency.setValueAtTime(freqStart, now);
      osc.frequency.exponentialRampToValueAtTime(Math.max(10, freqEnd), now + durationMs / 1000);

      gain.gain.setValueAtTime(volume, now);
      gain.gain.linearRampToValueAtTime(0.001, now + durationMs / 1000);

      osc.connect(gain);
      gain.connect(this.masterGain);

      osc.start(now);
      osc.stop(now + durationMs / 1000 + 0.05);
    } catch {
      // Hata durumunda yoksay
    }
  }

  /**
   * Basit gürültü sentezleyici (Patlama, iniş, roket gürültüsü)
   */
  private playNoise(durationMs: number, volume = 0.3, lowPassFreq = 800): void {
    if (this.muted) return;
    this.initContext();
    if (!this.ctx || !this.masterGain) return;

    try {
      const bufferSize = Math.floor(this.ctx.sampleRate * (durationMs / 1000));
      if (bufferSize <= 0) return;

      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowPassFreq, this.ctx.currentTime);

      const gain = this.ctx.createGain();
      const now = this.ctx.currentTime;
      gain.gain.setValueAtTime(volume, now);
      gain.gain.linearRampToValueAtTime(0.001, now + durationMs / 1000);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(now);
    } catch {
      // Hata durumunda yoksay
    }
  }

  /* ======================================================================
   * OYUN İÇİ SES EFEKTLERİ (Chiptune SFX)
   * ====================================================================== */

  /** UI Buton Tıklaması (Gevrek plastik klik) */
  public playClick(): void {
    this.playTone(1200, 400, 35, 'square', 0.15);
  }

  /** Para / Kaynak Toplama (İki tonlu retro coin sesi) */
  public playCoin(): void {
    this.playTone(987, 987, 50, 'sine', 0.2); // B5
    setTimeout(() => {
      this.playTone(1318, 1318, 80, 'sine', 0.25); // E6
    }, 45);
  }

  /** Makine / Hangar Geliştirme (4 notalı muzaffer arpej: C5 -> E5 -> G5 -> C6) */
  public playUpgrade(): void {
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, freq * 1.05, 70, 'triangle', 0.3);
      }, idx * 55);
    });
  }

  /** Kilometre Taşı Tamamlama (Parlak Şampiyonluk Fanfarı) */
  public playMilestone(): void {
    const fanfare = [440, 554.37, 659.25, 880, 1108.73];
    fanfare.forEach((freq, idx) => {
      setTimeout(() => {
        this.playTone(freq, freq, 90, 'triangle', 0.35);
      }, idx * 60);
    });
  }

  /** Roket Fırlatma (Gürleyen roket itki sesi) */
  public playLaunch(): void {
    this.playTone(150, 400, 400, 'sawtooth', 0.3);
    this.playNoise(600, 0.35, 600);
  }

  /** Roket Boost / Hızlanma (Yükselen pitch sweep) */
  public playBoost(): void {
    this.playTone(300, 950, 220, 'sawtooth', 0.25);
  }

  /** Çarpışma / Engel Teması (Metalik retro darbe) */
  public playHit(): void {
    this.playTone(250, 60, 120, 'square', 0.3);
    this.playNoise(150, 0.4, 400);
  }

  /** Yıkım / Taşıma İadesi (Metalik dekonstrüksiyon sesi) */
  public playDemolish(): void {
    this.playTone(600, 180, 90, 'square', 0.2);
  }
}

export const sound = SoundManager.getInstance();
