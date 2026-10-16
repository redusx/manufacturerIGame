/* ======================================================================
 * src/audio/SoundManager.ts — Prosedürel Piksel-Art Ses Efektleri Motoru
 *
 * Web Audio API ile sıfır harici dosya indirme gecikmesi ve %100 güvenilirlikle
 * 8-bit / 16-bit retro chiptune ses efektleri üreten merkezi ses yöneticisi.
 * (docs/MASTER_PLAN.md TASK-122)
 *
 * Sorumluluklar:
 * - Buton tıklamaları, eşya/para toplama, yükseltme arpejleri, roket fırlatma,
 *   nitro, çarpma ve patlama seslerinin frekans sentezlemesi
 * - Prosedürel arka plan müziği (src/audio/music.ts): tek parça, yumuşak geçişler
 * - Efekt ve müzik için ayrı kanal: ayrı seviye ve ayrı sessize alma
 * - LocalStorage kalıcı ses tercihi saklama
 * - Node.js headless test ortamında hatasız çalışma (Safe AudioContext Fallback)
 * ====================================================================== */

import { MUSIC_TRACKS, stepDuration, type MusicId, type MusicTrack } from './music.ts';

export type { MusicId } from './music.ts';

/** Efekt kanalı ayarları (eski anahtarlar korunur: önceki kayıtlardaki ses ayarı efektlere geçer) */
export const AUDIO_STORAGE_KEY = 'manufacturer_audio_muted';
export const AUDIO_VOLUME_STORAGE_KEY = 'manufacturer_audio_volume';
/** Müzik kanalı ayarları */
export const MUSIC_MUTED_STORAGE_KEY = 'manufacturer_music_muted';
export const MUSIC_VOLUME_STORAGE_KEY = 'manufacturer_music_volume';

/** Efekt seviyesi tam açıkken kanal kazancı (efektler birbirinin üstüne binince kırpılmasın) */
const SFX_GAIN = 0.3;
/** Müzik seviyesi tam açıkken kanal kazancı: müzik efektlerin altında kalır */
const MUSIC_GAIN = 0.2;
/** Müziğin ilk açılıştaki seviyesi (0..1) */
const DEFAULT_MUSIC_VOLUME = 0.6;

/** Müzik geçişleri (sn): eski parça söner, ardından yenisi yavaşça açılır */
const MUSIC_FADE_OUT_SEC = 0.6;
const MUSIC_FADE_IN_SEC = 1.6;
/** Zamanlayıcı her turda bu kadar ilerisini notalarla doldurur (sn) */
const MUSIC_LOOKAHEAD_SEC = 0.3;
const MUSIC_TICK_MS = 60;

/**
 * Sevkiyat geliri sesi: art arda gelen gelirler tek bir yumuşak çınlamada birleşir.
 * İki çınlama arasında en az bu kadar süre olur; arada gelen gelirler süre dolunca
 * tek bir sesle duyurulur (ekonomiye dokunulmaz, yalnızca ses seyrelir).
 */
export const INCOME_SOUND_COOLDOWN_MS = 1400;
/** Gelir çınlamasının seviyesi: eski para sesinin (0.25) ~%18'i */
const INCOME_LEVEL = 0.045;

export interface SoundOptions {
  volume?: number;
  pitch?: number;
}

/** Roket motoru ana itiş katmanının seviyesi (efekt kanalında) */
const ENGINE_LEVEL = 0.24;
/** Nitro itiş katmanının seviyesi; nitro açıkken ana motor bu orana iner */
const NITRO_LEVEL = 0.34;
const ENGINE_DUCK_DURING_NITRO = 0.7;

/**
 * Uçuş boyunca açık kalan motor sesi: ana itiş (alçak gürleme) ve nitro (tıslayan,
 * vızıldayan yüksek katman) iki ayrı kazançtır. Düğümler bir kez kurulur ve döngüde
 * çalar; her karede yalnızca hedef seviyeler değişir.
 */
interface EngineVoice {
  output: GainNode;
  rumble: GainNode;
  rumbleFilter: BiquadFilterNode;
  rumbleOsc: OscillatorNode;
  nitro: GainNode;
  nitroFilter: BiquadFilterNode;
  sources: AudioScheduledSourceNode[];
  thrusting: boolean;
  boosting: boolean;
  speed: number;
}

/** Çalmakta olan bir müzik parçası */
interface MusicPlayback {
  id: MusicId;
  track: MusicTrack;
  /** Parçanın kendi kazancı: geçişlerde açılıp söner */
  gain: GainNode;
  step: number;
  nextTime: number;
}

function nowMs(): number {
  return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

function readNumber(key: string): number | null {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  const value = Number(raw);
  return Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : null;
}

export class SoundManager {
  private static instance: SoundManager | null = null;
  private ctx: AudioContext | null = null;
  /** Efekt kanalı: sessiz mi, seviyesi (0..1) */
  private muted = false;
  private volume = 1;
  /** Müzik kanalı: sessiz mi, seviyesi (0..1) */
  private musicMuted = false;
  private musicVolume = DEFAULT_MUSIC_VOLUME;
  /** Reklam ekrandayken geçici sessizlik; ayara ve kayda yansımaz */
  private suspended = false;
  /** Tüm sesin çıkışı (reklam sessizliği burada uygulanır) */
  private outputGain: GainNode | null = null;
  /** Efekt kanalı (eski adıyla ana kazanç) */
  private masterGain: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;

  /** Sahnelerin istediği müzik; ses bağlamı açılınca bu çalar */
  private desiredMusic: MusicId | null = null;
  private music: MusicPlayback | null = null;
  private musicTimer: ReturnType<typeof setInterval> | null = null;

  private incomeLastAt = -Infinity;
  private incomePending = false;
  /** Aynı efektin çok kısa aralıkla çoğalmasını önlemek için son çalınma anları */
  private readonly lastPlayedAt = new Map<string, number>();
  private engine: EngineVoice | null = null;

  private constructor() {
    this.loadSettings();
    this.installBrowserHooks();
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
        this.volume = readNumber(AUDIO_VOLUME_STORAGE_KEY) ?? this.volume;
        this.musicMuted = localStorage.getItem(MUSIC_MUTED_STORAGE_KEY) === 'true';
        this.musicVolume = readNumber(MUSIC_VOLUME_STORAGE_KEY) ?? this.musicVolume;
      }
    } catch {
      // Depolama erişilemezse varsayılanlar
    }
  }

  /**
   * Ayarları depolar.
   */
  private saveSettings(): void {
    try {
      if (typeof localStorage !== 'undefined') {
        localStorage.setItem(AUDIO_STORAGE_KEY, String(this.muted));
        localStorage.setItem(AUDIO_VOLUME_STORAGE_KEY, String(this.volume));
        localStorage.setItem(MUSIC_MUTED_STORAGE_KEY, String(this.musicMuted));
        localStorage.setItem(MUSIC_VOLUME_STORAGE_KEY, String(this.musicVolume));
      }
    } catch {
      // Depolama erişilemezse yoksay
    }
  }

  /**
   * Tarayıcı kuralları: ses bağlamı ancak bir kullanıcı hareketiyle açılabilir. İlk
   * dokunuş/tuşta bağlam kurulur (müzik o an başlar). Sekme gizlenince ses durur,
   * dönünce kaldığı yerden sürer.
   */
  private installBrowserHooks(): void {
    if (typeof document === 'undefined' || typeof window === 'undefined') return;
    const unlock = (): void => this.initContext();
    for (const type of ['pointerdown', 'touchend', 'keydown']) {
      window.addEventListener(type, unlock, { capture: true, passive: true });
    }
    document.addEventListener('visibilitychange', () => {
      if (!this.ctx) return;
      if (document.hidden) {
        this.ctx.suspend().catch(() => {});
      } else {
        this.ctx.resume().catch(() => {});
      }
    });
  }

  /**
   * AudioContext'i ilk kullanıcı etkileşiminde başlatır (Tarayıcı Autoplay kuralı).
   */
  public initContext(): void {
    if (this.ctx) {
      if (this.ctx.state === 'suspended' && !(typeof document !== 'undefined' && document.hidden)) {
        this.ctx.resume().catch(() => {});
      }
      return;
    }

    try {
      const AudioCtx =
        (globalThis as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ||
        (globalThis as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;

      if (AudioCtx) {
        const ctx = new AudioCtx();
        this.outputGain = ctx.createGain();
        this.outputGain.connect(ctx.destination);
        this.masterGain = ctx.createGain();
        this.masterGain.connect(this.outputGain);
        this.musicGain = ctx.createGain();
        this.musicGain.connect(this.outputGain);
        this.noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
        const data = this.noiseBuffer.getChannelData(0);
        for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
        this.ctx = ctx;
        this.applyGain();
        if (ctx.state === 'suspended') ctx.resume().catch(() => {});
        this.startDesiredMusic();
      }
    } catch {
      // Ses desteği olmayan ortamlarda sessiz kal (oyun sessiz sürer)
      this.ctx = null;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  /**
   * Sesi geçici olarak keser (reklam ekrandayken). Oyuncunun ses ayarını
   * değiştirmez ve kayda yazmaz; kapatılınca ayar neyse ona dönülür.
   */
  public setSuspended(suspended: boolean): void {
    this.suspended = suspended;
    this.applyGain();
  }

  /** Efektler duyulmuyor mu? */
  private get isSilent(): boolean {
    return this.muted || this.suspended;
  }

  /** Müzik duyulmuyor mu? (sessizken nota üretilmez, zaman yine ilerler) */
  private get isMusicSilent(): boolean {
    return this.musicMuted || this.suspended || this.musicVolume <= 0;
  }

  private get currentGain(): number {
    return this.muted ? 0 : SFX_GAIN * this.volume;
  }

  private get currentMusicGain(): number {
    return this.musicMuted ? 0 : MUSIC_GAIN * this.musicVolume;
  }

  private applyGain(): void {
    if (!this.ctx) return;
    const now = this.ctx.currentTime;
    // Kısa yumuşatma: seviye çubuğu sürüklenirken çıtırtı olmasın
    this.outputGain?.gain.setTargetAtTime(this.suspended ? 0 : 1, now, 0.02);
    this.masterGain?.gain.setTargetAtTime(this.currentGain, now, 0.02);
    this.musicGain?.gain.setTargetAtTime(this.currentMusicGain, now, 0.02);
  }

  /** Efekt seviyesi (0..1) */
  public getVolume(): number {
    return this.volume;
  }

  /** Efekt seviyesini ayarlar (0..1) ve saklar; sessize alma ayarına dokunmaz */
  public setVolume(volume: number): void {
    this.volume = Math.round(Math.min(1, Math.max(0, volume)) * 100) / 100;
    this.saveSettings();
    this.applyGain();
  }

  /** Efektleri sessize alır / açar */
  public setMuted(muted: boolean): void {
    this.muted = muted;
    this.saveSettings();
    this.applyGain();
  }

  public toggleMute(): boolean {
    this.setMuted(!this.muted);
    return this.muted;
  }

  /* ======================================================================
   * MÜZİK
   * ====================================================================== */

  public isMusicMuted(): boolean {
    return this.musicMuted;
  }

  public setMusicMuted(muted: boolean): void {
    this.musicMuted = muted;
    this.saveSettings();
    this.applyGain();
  }

  public toggleMusicMute(): boolean {
    this.setMusicMuted(!this.musicMuted);
    return this.musicMuted;
  }

  /** Müzik seviyesi (0..1) */
  public getMusicVolume(): number {
    return this.musicVolume;
  }

  /** Müzik seviyesini ayarlar (0..1) ve saklar; sessize alma ayarına dokunmaz */
  public setMusicVolume(volume: number): void {
    this.musicVolume = Math.round(Math.min(1, Math.max(0, volume)) * 100) / 100;
    this.saveSettings();
    this.applyGain();
  }

  /** Şu an çalan (ya da ses açılınca çalacak) parça */
  public getCurrentMusic(): MusicId | null {
    return this.desiredMusic;
  }

  /**
   * Arka plan müziğini seçer. Aynı parça zaten çalıyorsa hiçbir şey olmaz (sahne
   * yeniden kurulsa da müzik baştan başlamaz, üst üste binmez). Başka bir parça
   * çalıyorsa önce o söner, sonra yenisi yavaşça açılır; aynı anda tek ana müzik çalar.
   * Ses bağlamı henüz açılmadıysa seçim saklanır ve ilk dokunuşta başlar.
   */
  public playMusic(id: MusicId): void {
    if (this.desiredMusic === id && this.music?.id === id) return;
    this.desiredMusic = id;
    this.startDesiredMusic();
  }

  /** Müziği yavaşça susturur */
  public stopMusic(): void {
    this.desiredMusic = null;
    this.fadeOutMusic();
  }

  private startDesiredMusic(): void {
    const ctx = this.ctx;
    if (!ctx || !this.musicGain || !this.desiredMusic) return;
    if (this.music?.id === this.desiredMusic) return;

    try {
      const hadMusic = this.fadeOutMusic();
      const start = ctx.currentTime + (hadMusic ? MUSIC_FADE_OUT_SEC : 0.05);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0, ctx.currentTime);
      gain.gain.setValueAtTime(0, start);
      gain.gain.linearRampToValueAtTime(1, start + MUSIC_FADE_IN_SEC);
      gain.connect(this.musicGain);
      this.music = { id: this.desiredMusic, track: MUSIC_TRACKS[this.desiredMusic], gain, step: 0, nextTime: start };
      if (!this.musicTimer) {
        this.musicTimer = setInterval(() => this.scheduleMusic(), MUSIC_TICK_MS);
      }
      this.scheduleMusic();
    } catch {
      this.music = null;
    }
  }

  /** Çalan parçayı söndürüp bırakır; söndürülecek parça varsa true */
  private fadeOutMusic(): boolean {
    const playback = this.music;
    const ctx = this.ctx;
    this.music = null;
    if (!playback || !ctx) return false;
    try {
      const now = ctx.currentTime;
      playback.gain.gain.cancelScheduledValues(now);
      playback.gain.gain.setValueAtTime(playback.gain.gain.value, now);
      playback.gain.gain.linearRampToValueAtTime(0, now + MUSIC_FADE_OUT_SEC);
      setTimeout(() => playback.gain.disconnect(), (MUSIC_FADE_OUT_SEC + MUSIC_LOOKAHEAD_SEC + 0.5) * 1000);
    } catch {
      // Düğüm zaten kopmuşsa yoksay
    }
    return true;
  }

  /** Önümüzdeki kısa süreyi notalarla doldurur (zamanlayıcı her turda çağırır) */
  private scheduleMusic(): void {
    const ctx = this.ctx;
    const playback = this.music;
    if (!ctx || !playback || !this.noiseBuffer) return;
    if (ctx.state !== 'running') return;

    const stepSec = stepDuration(playback.track);
    // Zamanlayıcı geciktiyse (sekme arka plandaydı) kaçan notalar çalınmaz, ritim yeniden yakalanır
    if (playback.nextTime < ctx.currentTime - 0.1) {
      const skipped = Math.ceil((ctx.currentTime - playback.nextTime) / stepSec);
      playback.step += skipped;
      playback.nextTime += skipped * stepSec;
    }
    const horizon = ctx.currentTime + MUSIC_LOOKAHEAD_SEC;
    const voice = { ctx, out: playback.gain, noise: this.noiseBuffer };
    while (playback.nextTime < horizon) {
      if (!this.isMusicSilent) {
        try {
          playback.track.schedule(playback.step % playback.track.lengthSteps, playback.nextTime, voice);
        } catch {
          // Bir notanın kurulamaması müziği durdurmaz
        }
      }
      playback.step += 1;
      playback.nextTime += stepSec;
    }
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
    if (this.isSilent) return;
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
   * Basit gürültü sentezleyici (Patlama, iniş, roket gürültüsü). `sweepTo` verilirse
   * süzgeç frekansı o değere kayar (gürleyen motor, sönen patlama); `delayMs` kadar
   * sonra başlar.
   */
  private playNoise(
    durationMs: number,
    volume = 0.3,
    lowPassFreq = 800,
    options: { sweepTo?: number; delayMs?: number; attackMs?: number } = {},
  ): void {
    if (this.isSilent) return;
    this.initContext();
    if (!this.ctx || !this.masterGain || !this.noiseBuffer) return;

    try {
      const duration = durationMs / 1000;
      const start = this.ctx.currentTime + (options.delayMs ?? 0) / 1000;
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.noiseBuffer;
      noise.loop = true;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(lowPassFreq, start);
      if (options.sweepTo) {
        filter.frequency.exponentialRampToValueAtTime(Math.max(20, options.sweepTo), start + duration);
      }

      const gain = this.ctx.createGain();
      const attack = (options.attackMs ?? 0) / 1000;
      gain.gain.setValueAtTime(attack > 0 ? 0.001 : volume, start);
      if (attack > 0) gain.gain.linearRampToValueAtTime(volume, start + attack);
      gain.gain.linearRampToValueAtTime(0.001, start + duration);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(this.masterGain);

      noise.start(start, Math.random() * 0.5);
      noise.stop(start + duration + 0.05);
    } catch {
      // Hata durumunda yoksay
    }
  }

  /** Aynı efekt `minGapMs` içinde ikinci kez istenirse false (çoğalmayı önler) */
  private claim(key: string, minGapMs: number): boolean {
    const now = nowMs();
    const last = this.lastPlayedAt.get(key) ?? -Infinity;
    if (now - last < minGapMs) return false;
    this.lastPlayedAt.set(key, now);
    return true;
  }

  /* ======================================================================
   * OYUN İÇİ SES EFEKTLERİ (Chiptune SFX)
   * ====================================================================== */

  /** UI Buton Tıklaması (Gevrek plastik klik) */
  public playClick(): void {
    this.playTone(1200, 400, 35, 'square', 0.15);
  }

  /** Para / Kaynak Toplama (İki tonlu retro coin sesi): elle üretim ve uçuşta toplanan parçalar */
  public playCoin(): void {
    if (!this.claim('coin', 40)) return;
    this.playTone(987, 987, 50, 'sine', 0.2); // B5
    setTimeout(() => {
      this.playTone(1318, 1318, 80, 'sine', 0.25); // E6
    }, 45);
  }

  /**
   * Sevkiyat geliri: her satışta değil, art arda gelen satışları tek bir yumuşak
   * çınlamayla duyurur (en az INCOME_SOUND_COOLDOWN_MS arayla). Bekleme sırasında gelen
   * gelirler kaybolmaz; süre dolunca tek çınlama onları temsil eder.
   */
  public playIncome(): void {
    if (this.isSilent) return;
    const wait = this.incomeLastAt + INCOME_SOUND_COOLDOWN_MS - nowMs();
    if (wait <= 0) {
      this.incomeLastAt = nowMs();
      this.playIncomeChime();
      return;
    }
    if (this.incomePending) return;
    this.incomePending = true;
    setTimeout(() => {
      this.incomePending = false;
      this.incomeLastAt = nowMs();
      this.playIncomeChime();
    }, wait);
  }

  /** Kısa, yumuşak iki notalı çınlama; hafif perde değişimi tekrarı yorucu kılmaz */
  private playIncomeChime(): void {
    const pitch = 1 + (Math.random() - 0.5) * 0.04;
    this.playTone(1046.5 * pitch, 1046.5 * pitch, 70, 'sine', INCOME_LEVEL); // C6
    setTimeout(() => {
      this.playTone(1568 * pitch, 1568 * pitch, 120, 'sine', INCOME_LEVEL); // G6
    }, 55);
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

  /**
   * Roket fırlatma, üç kademe: ateşleme çatırtısı, açılan motor gürlemesi ve
   * yükselirken incelen itki tonu (~1.8 sn).
   */
  public playLaunch(): void {
    if (!this.claim('launch', 500)) return;
    // 1) Ateşleme: kısa, parlak çatırtı
    this.playNoise(90, 0.3, 4000);
    this.playTone(90, 60, 120, 'square', 0.2);
    // 2) Motor gürlemesi: süzgeç açılırken güçlenir, sonra söner
    this.playNoise(1800, 0.42, 300, { sweepTo: 1600, attackMs: 250, delayMs: 60 });
    // 3) İtki tonu: alçaktan yükselir
    this.playTone(55, 140, 1500, 'sawtooth', 0.16);
  }

  /** Nitro: kısa, enerjik yükselen süpürme ve teknolojik "şarj" tıkırtısı */
  public playNitro(): void {
    if (!this.claim('nitro', 180)) return;
    this.playTone(320, 1100, 200, 'sawtooth', 0.18);
    this.playNoise(260, 0.18, 1500, { sweepTo: 6000 });
    setTimeout(() => this.playTone(1760, 1760, 45, 'square', 0.08), 140);
  }

  /** Engel teması (roket hasar alır ama uçuş sürer): metalik retro darbe */
  public playHit(): void {
    if (!this.claim('hit', 120)) return;
    this.playTone(250, 60, 120, 'square', 0.3);
    this.playNoise(150, 0.4, 400);
  }

  /** Yere çakılma: tok, alçak darbe */
  public playCrash(): void {
    if (!this.claim('crash', 300)) return;
    this.playTone(130, 38, 260, 'sine', 0.5);
    this.playTone(80, 40, 160, 'square', 0.12);
    this.playNoise(180, 0.35, 350);
  }

  /** Patlama: güçlü ama dengeli; süzgeci kapanarak sönen gürleme ve alçak gümbürtü */
  public playExplosion(): void {
    if (!this.claim('explosion', 300)) return;
    this.playNoise(1100, 0.45, 2400, { sweepTo: 140 });
    this.playTone(90, 30, 700, 'sine', 0.35);
    // Ardından gelen küçük çatırtılar
    this.playNoise(80, 0.15, 3000, { delayMs: 180 });
    this.playNoise(70, 0.12, 2600, { delayMs: 330 });
  }

  /* ======================================================================
   * SÜREKLİ ROKET MOTORU VE NİTRO İTİŞİ
   * ====================================================================== */

  /**
   * Uçuşta her kare çağrılır: motor yakıt oldukça (`thrusting`), nitro basılı ve doluyken
   * (`boosting`) duyulur. Durum değişmedikçe yalnızca hıza göre ton hafifçe kayar; ses
   * yeniden başlatılmaz. Motor susunca düğümler sessizde bekler (kristal yakıtı
   * doldurursa yeniden duyulur); `stopEngine` uçuş bitince her şeyi kapatır.
   * @param speed01 Roketin hızı 0..1 aralığında (ton ve parlaklık için)
   */
  public updateEngine(thrusting: boolean, boosting: boolean, speed01: number): void {
    if (!this.engine) {
      if (!thrusting && !boosting) return;
      this.engine = this.createEngine();
      if (!this.engine) return;
    }
    const engine = this.engine;
    const ctx = this.ctx;
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      if (engine.thrusting !== thrusting || engine.boosting !== boosting) {
        const rumbleTarget = (thrusting ? 1 : boosting ? 0.5 : 0) * (boosting ? ENGINE_DUCK_DURING_NITRO : 1) * ENGINE_LEVEL;
        // Motor yakıt bitince yavaşça söner; nitro gecikmeden ama tıkırtısız kapanır
        engine.rumble.gain.setTargetAtTime(rumbleTarget, now, rumbleTarget > 0 ? 0.12 : 0.3);
        engine.nitro.gain.setTargetAtTime(boosting ? NITRO_LEVEL : 0, now, boosting ? 0.04 : 0.07);
        if (boosting && !engine.boosting) {
          // Nitro açılışında süzgeç yukarı süpürülür: itiş hissi
          engine.nitroFilter.frequency.cancelScheduledValues(now);
          engine.nitroFilter.frequency.setValueAtTime(1100, now);
          engine.nitroFilter.frequency.exponentialRampToValueAtTime(2600, now + 0.25);
        }
        engine.thrusting = thrusting;
        engine.boosting = boosting;
      }
      const speed = Math.min(1, Math.max(0, speed01));
      if (Math.abs(speed - engine.speed) > 0.03) {
        engine.speed = speed;
        engine.rumbleFilter.frequency.setTargetAtTime(380 + speed * 520, now, 0.15);
        engine.rumbleOsc.frequency.setTargetAtTime(46 + speed * 26, now, 0.15);
      }
    } catch {
      // Ses düğümü kurulamazsa oyun sessiz sürer
    }
  }

  /** Motor ve nitro seslerini kısa bir sönmeyle kapatır (uçuş sonu, sahne kapanışı) */
  public stopEngine(): void {
    const engine = this.engine;
    const ctx = this.ctx;
    this.engine = null;
    if (!engine || !ctx) return;
    try {
      const now = ctx.currentTime;
      engine.output.gain.cancelScheduledValues(now);
      engine.output.gain.setValueAtTime(engine.output.gain.value, now);
      engine.output.gain.linearRampToValueAtTime(0, now + 0.25);
      for (const src of engine.sources) src.stop(now + 0.3);
      setTimeout(() => engine.output.disconnect(), 500);
    } catch {
      // Düğüm zaten durmuşsa yoksay
    }
  }

  private createEngine(): EngineVoice | null {
    this.initContext();
    const ctx = this.ctx;
    if (!ctx || !this.masterGain || !this.noiseBuffer) return null;
    try {
      const now = ctx.currentTime;
      const output = ctx.createGain();
      output.connect(this.masterGain);
      const sources: AudioScheduledSourceNode[] = [];
      const loopNoise = (): AudioBufferSourceNode => {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        src.loop = true;
        sources.push(src);
        return src;
      };
      const osc = (type: OscillatorType, freq: number): OscillatorNode => {
        const node = ctx.createOscillator();
        node.type = type;
        node.frequency.setValueAtTime(freq, now);
        sources.push(node);
        return node;
      };

      // Ana itiş: alçak geçiren gürültü + alçak testere dişi; süzgeç yavaşça dalgalanır (alev titremesi)
      const rumble = ctx.createGain();
      rumble.gain.setValueAtTime(0, now);
      rumble.connect(output);
      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.setValueAtTime(420, now);
      rumbleFilter.Q.setValueAtTime(0.8, now);
      rumbleFilter.connect(rumble);
      loopNoise().connect(rumbleFilter);
      const flutter = osc('sine', 6.5);
      const flutterDepth = ctx.createGain();
      flutterDepth.gain.setValueAtTime(70, now);
      flutter.connect(flutterDepth);
      flutterDepth.connect(rumbleFilter.frequency);
      const rumbleOsc = osc('sawtooth', 50);
      const subFilter = ctx.createBiquadFilter();
      subFilter.type = 'lowpass';
      subFilter.frequency.setValueAtTime(200, now);
      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.45, now);
      rumbleOsc.connect(subFilter);
      subFilter.connect(subGain);
      subGain.connect(rumble);

      // Nitro: bant geçiren tıslama + titreşimli vızıltı; ana motordan daha yüksek ve parlak
      const nitro = ctx.createGain();
      nitro.gain.setValueAtTime(0, now);
      nitro.connect(output);
      const nitroFilter = ctx.createBiquadFilter();
      nitroFilter.type = 'bandpass';
      nitroFilter.frequency.setValueAtTime(2600, now);
      nitroFilter.Q.setValueAtTime(1.1, now);
      nitroFilter.connect(nitro);
      loopNoise().connect(nitroFilter);
      const whine = osc('sawtooth', 190);
      const vibrato = osc('sine', 11);
      const vibratoDepth = ctx.createGain();
      vibratoDepth.gain.setValueAtTime(9, now);
      vibrato.connect(vibratoDepth);
      vibratoDepth.connect(whine.frequency);
      const whineFilter = ctx.createBiquadFilter();
      whineFilter.type = 'lowpass';
      whineFilter.frequency.setValueAtTime(1500, now);
      const whineGain = ctx.createGain();
      whineGain.gain.setValueAtTime(0.3, now);
      whine.connect(whineFilter);
      whineFilter.connect(whineGain);
      whineGain.connect(nitro);

      for (const src of sources) {
        if (src instanceof AudioBufferSourceNode) src.start(now, Math.random() * 0.5);
        else src.start(now);
      }
      return { output, rumble, rumbleFilter, rumbleOsc, nitro, nitroFilter, sources, thrusting: false, boosting: false, speed: -1 };
    } catch {
      return null;
    }
  }

  /** Yıkım / Taşıma İadesi (Metalik dekonstrüksiyon sesi) */
  public playDemolish(): void {
    this.playTone(600, 180, 90, 'square', 0.2);
  }
}

export const sound = SoundManager.getInstance();
