/* ======================================================================
 * src/audio/music.ts — Prosedürel arka plan müzikleri
 *
 * Müzikler dosya değil, bu modülde yazılı notalardır: SoundManager her parçayı
 * adım adım (on altılık nota) Web Audio ile sentezler. Harici kaynak, indirme ve
 * lisans yükü yoktur; besteler bu projeye özgündür (docs/AUDIO.md).
 *
 * Her parça kendi uzunluğunda kesintisiz döner: son adımdan sonra ilk adım aynı
 * ritimle gelir, dosya döngüsündeki gibi boşluk veya tıkırtı oluşmaz.
 * ====================================================================== */

export type MusicId = 'factory' | 'flight';

/** Bir adımı çalmak için gereken ses düğümleri */
export interface MusicVoice {
  ctx: BaseAudioContext;
  /** Parçanın kendi kazanç düğümü (geçişlerde sönümlenir) */
  out: AudioNode;
  /** Davul ve tıslama için paylaşılan beyaz gürültü (1 sn) */
  noise: AudioBuffer;
}

export interface MusicTrack {
  bpm: number;
  /** Döngünün adım (on altılık) sayısı */
  lengthSteps: number;
  /** `step` adımının notalarını `time` anına yerleştirir (0 <= step < lengthSteps) */
  schedule(step: number, time: number, voice: MusicVoice): void;
}

const STEPS_PER_BAR = 16;

/** Bir adımın saniye cinsinden süresi */
export function stepDuration(track: MusicTrack): number {
  return 60 / track.bpm / 4;
}

function midi(note: number): number {
  return 440 * Math.pow(2, (note - 69) / 12);
}

/* ----------------------------------------------------------------------
 * Çalgılar
 * ---------------------------------------------------------------------- */

function tone(
  v: MusicVoice,
  time: number,
  note: number,
  duration: number,
  type: OscillatorType,
  level: number,
  cutoff = 0,
  attack = 0.006,
): void {
  const osc = v.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(midi(note), time);
  const gain = v.ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(level, time + attack);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  if (cutoff > 0) {
    const filter = v.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(cutoff, time);
    osc.connect(filter);
    filter.connect(gain);
  } else {
    osc.connect(gain);
  }
  gain.connect(v.out);
  osc.start(time);
  osc.stop(time + duration + 0.02);
}

/** Yumuşak tok vuruş: hızla düşen sinüs */
function kick(v: MusicVoice, time: number, level: number): void {
  const osc = v.ctx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(115, time);
  osc.frequency.exponentialRampToValueAtTime(42, time + 0.12);
  const gain = v.ctx.createGain();
  gain.gain.setValueAtTime(level, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + 0.18);
  osc.connect(gain);
  gain.connect(v.out);
  osc.start(time);
  osc.stop(time + 0.2);
}

/** Kısa makine tıslaması (yüksek geçiren gürültü) */
function hiss(v: MusicVoice, time: number, level: number, duration = 0.03, highPass = 7000): void {
  const src = v.ctx.createBufferSource();
  src.buffer = v.noise;
  const filter = v.ctx.createBiquadFilter();
  filter.type = 'highpass';
  filter.frequency.setValueAtTime(highPass, time);
  const gain = v.ctx.createGain();
  gain.gain.setValueAtTime(level, time);
  gain.gain.exponentialRampToValueAtTime(0.0001, time + duration);
  src.connect(filter);
  filter.connect(gain);
  gain.connect(v.out);
  // Tamponun rastgele bir yerinden başlamak her vuruşu biraz farklı kılar
  src.start(time, Math.random() * 0.8, duration + 0.01);
}

/** Yavaş açılıp kapanan akor dolgusu (hafif akortsuz iki testere dişi) */
function pad(v: MusicVoice, time: number, notes: readonly number[], duration: number, level: number, cutoff: number): void {
  const filter = v.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(cutoff, time);
  const gain = v.ctx.createGain();
  gain.gain.setValueAtTime(0, time);
  gain.gain.linearRampToValueAtTime(level, time + Math.min(0.5, duration * 0.3));
  gain.gain.setValueAtTime(level, time + duration * 0.7);
  gain.gain.linearRampToValueAtTime(0, time + duration);
  filter.connect(gain);
  gain.connect(v.out);
  for (const note of notes) {
    for (const detune of [-7, 7]) {
      const osc = v.ctx.createOscillator();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(midi(note), time);
      osc.detune.setValueAtTime(detune, time);
      osc.connect(filter);
      osc.start(time);
      osc.stop(time + duration + 0.02);
    }
  }
}

/* ----------------------------------------------------------------------
 * Fabrika teması — D dorian, 108 BPM, 32 ölçü (~71 sn)
 * Ritmik bas ve makine tıslamaları üretim bandını, arpej ve melodi teknolojik
 * ama yumuşak bir havayı taşır. Üçüncü bölüm davulsuz bir nefes alanıdır.
 * ---------------------------------------------------------------------- */

interface Chord {
  /** Bas kökü (MIDI) */
  root: number;
  /** Arpej / dolgu notaları (MIDI) */
  tones: readonly number[];
}

/** Her akor iki ölçü sürer: Dm7 – B♭maj7 – Fmaj7 – Cadd9 */
const FACTORY_CHORDS: readonly Chord[] = [
  { root: 38, tones: [62, 65, 69, 72] },
  { root: 34, tones: [58, 62, 65, 69] },
  { root: 41, tones: [65, 69, 72, 76] },
  { root: 36, tones: [64, 67, 72, 74] },
];

/** Bas deseni: ölçüdeki adım → kökten uzaklık (yarım ton) */
const FACTORY_BASS: ReadonlyMap<number, number> = new Map([
  [0, 0], [3, 0], [6, 12], [8, 0], [10, 7], [14, 12],
]);

/** Arpej sırası: her sekizlikte akordun bir notası */
const FACTORY_ARP = [0, 1, 2, 3, 2, 1, 2, 1];

/** Sekiz ölçülük melodi: [başlangıç adımı, MIDI notası, uzunluk (adım)] */
const FACTORY_MELODY: ReadonlyArray<readonly [number, number, number]> = [
  [0, 69, 4], [4, 72, 2], [6, 74, 6], [12, 72, 2], [14, 69, 2], [16, 67, 4], [20, 69, 8],
  [32, 74, 4], [36, 77, 2], [38, 74, 2], [40, 72, 4], [44, 70, 4], [48, 69, 8], [56, 65, 4], [60, 67, 4],
  [64, 69, 4], [68, 72, 4], [72, 77, 4], [76, 76, 4], [80, 72, 8], [88, 69, 4], [92, 72, 4],
  [96, 74, 6], [102, 76, 2], [104, 79, 4], [108, 76, 4], [112, 74, 8], [120, 72, 4],
];
const FACTORY_MELODY_BY_STEP = new Map(FACTORY_MELODY.map(([step, note, length]) => [step, { note, length }]));

const FACTORY_BPM = 108;
const FACTORY_STEP = 60 / FACTORY_BPM / 4;

const factoryTrack: MusicTrack = {
  bpm: FACTORY_BPM,
  lengthSteps: 32 * STEPS_PER_BAR,
  schedule(step, time, v) {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const inBar = step % STEPS_PER_BAR;
    const section = Math.floor(bar / 8); // 0: giriş, 1: melodi, 2: nefes, 3: melodi
    const chord = FACTORY_CHORDS[Math.floor((bar % 8) / 2)];
    const breather = section === 2;

    // Bas: nefes bölümünde yalnızca ölçü başları
    const bassOffset = FACTORY_BASS.get(inBar);
    if (bassOffset !== undefined && (!breather || inBar % 8 === 0)) {
      tone(v, time, chord.root + bassOffset, breather ? 0.5 : 0.2, 'triangle', 0.32, 900);
    }

    if (!breather) {
      if (inBar === 0 || inBar === 8) kick(v, time, 0.26);
      if (inBar % 4 === 2) hiss(v, time, 0.045);
      // Ölçünün sonunda "pres" tıslaması: endüstriyel doku
      if (inBar === 12 && bar % 2 === 1) hiss(v, time, 0.05, 0.09, 2500);
    } else if (inBar === 0 && bar % 2 === 0) {
      pad(v, time, chord.tones.slice(0, 3), FACTORY_STEP * STEPS_PER_BAR * 2, 0.035, 1200);
    }

    // Arpej: sekizlikler, akorun notaları üzerinde gidip gelir
    if (inBar % 2 === 0) {
      const idx = FACTORY_ARP[inBar / 2];
      tone(v, time, chord.tones[idx], 0.22, 'square', breather ? 0.035 : 0.05, 1400);
    }

    // Melodi: ikinci ve dördüncü bölümler
    if (section === 1 || section === 3) {
      const melody = FACTORY_MELODY_BY_STEP.get(step % (8 * STEPS_PER_BAR));
      if (melody) {
        const octave = section === 3 && bar % 8 >= 4 ? 12 : 0;
        tone(v, time, melody.note + octave, melody.length * FACTORY_STEP * 0.9, 'triangle', 0.1, 0, 0.012);
      }
    }
  },
};

/* ----------------------------------------------------------------------
 * Fırlatma / uçuş teması — E minör, 132 BPM, 16 ölçü (~29 sn)
 * Rampada hazırlanırken dolgu ve nabız gibi bas gerilim kurar; ikinci bölümde
 * davul ve arpej girer ve uçuşun hızını taşır.
 * ---------------------------------------------------------------------- */

/** Her akor bir ölçü: Em – C – D – Bm */
const FLIGHT_CHORDS: readonly Chord[] = [
  { root: 40, tones: [64, 67, 71] },
  { root: 36, tones: [64, 67, 72] },
  { root: 38, tones: [62, 66, 69] },
  { root: 35, tones: [62, 66, 71] },
];

/** İkinci bölüm arpejinin vurduğu adımlar */
const FLIGHT_LEAD_STEPS = [0, 3, 6, 8, 11, 14];

const FLIGHT_BPM = 132;
const FLIGHT_STEP = 60 / FLIGHT_BPM / 4;

const flightTrack: MusicTrack = {
  bpm: FLIGHT_BPM,
  lengthSteps: 16 * STEPS_PER_BAR,
  schedule(step, time, v) {
    const bar = Math.floor(step / STEPS_PER_BAR);
    const inBar = step % STEPS_PER_BAR;
    const driving = bar >= 8;
    const chord = FLIGHT_CHORDS[bar % 4];

    if (inBar === 0) {
      pad(v, time, chord.tones.map((n) => n - 12), FLIGHT_STEP * STEPS_PER_BAR + 0.08, 0.028, 1100);
    }
    // Nabız gibi bas: sekizlikler, kök ve oktav
    if (inBar % 2 === 0) {
      tone(v, time, chord.root + (inBar % 4 === 2 ? 12 : 0), 0.11, 'sawtooth', 0.17, 520);
    }
    if (inBar % 4 === 2) hiss(v, time, 0.04);

    if (driving) {
      if (inBar % 4 === 0) kick(v, time, 0.25);
      if (inBar % 2 === 1) hiss(v, time, 0.014, 0.02, 9000);
      const leadIdx = FLIGHT_LEAD_STEPS.indexOf(inBar);
      if (leadIdx >= 0) {
        tone(v, time, chord.tones[leadIdx % chord.tones.length] + 12, 0.1, 'square', 0.035, 2200);
      }
    } else if (inBar === 0) {
      kick(v, time, 0.2);
    }
  },
};

export const MUSIC_TRACKS: Readonly<Record<MusicId, MusicTrack>> = {
  factory: factoryTrack,
  flight: flightTrack,
};
