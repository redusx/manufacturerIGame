/* ======================================================================
 * render_audio.js — Tanıtım videosunun sesi (tarayıcıda çalışır)
 *
 * Oyunun kendi ses motoru (src/audio/SoundManager.ts) ve müzik besteleri
 * (src/audio/music.ts) çevrimdışı bir AudioContext'e çalınır. Efektler,
 * `capture_shots.js`'in kaydettiği olayların (events.json) zamanlarında çalar;
 * böylece fırlatma, nitro ve gelir sesleri görüntüyle aynı karede duyulur.
 * Müzik ve efektler iki ayrı kanal (stem) olarak WAV yazılır; karışım
 * `build_videos.py`'dedir.
 *
 * Kullanım (geliştirme sunucusundaki oyun sayfasında):
 *   const a = await import('/branding/promo-videos/tools/render_audio.js');
 *   await a.renderStems({ name: 'landscape' });
 * ====================================================================== */

const SAMPLE_RATE = 48000;
const INCOME_COOLDOWN_SEC = 1.4;

function findModuleUrl(pattern) {
  return performance.getEntriesByType('resource').map((e) => e.name).find((n) => pattern.test(n));
}

/** Float32 kanallarından 16 bit PCM WAV */
function encodeWav(channels, sampleRate) {
  const length = channels[0].length;
  const buffer = new ArrayBuffer(44 + length * channels.length * 2);
  const view = new DataView(buffer);
  const writeString = (offset, text) => {
    for (let i = 0; i < text.length; i++) view.setUint8(offset + i, text.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + length * channels.length * 2, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channels.length, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * channels.length * 2, true);
  view.setUint16(32, channels.length * 2, true);
  view.setUint16(34, 16, true);
  writeString(36, 'data');
  view.setUint32(40, length * channels.length * 2, true);
  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (const channel of channels) {
      const v = Math.max(-1, Math.min(1, channel[i]));
      view.setInt16(offset, v < 0 ? v * 0x8000 : v * 0x7fff, true);
      offset += 2;
    }
  }
  return new Blob([buffer], { type: 'audio/wav' });
}

/**
 * Çevrimdışı bağlamda zamanlı çağrılar: `at(t, fn)` fn'i t anında (128 örneklik
 * işleme dilimine yuvarlanarak) çalıştırır. SoundManager'ın setTimeout ile
 * ertelediği notalar da bu zamanlayıcıya yönlendirilir.
 */
function offlineScheduler(ctx) {
  const quantum = 128 / ctx.sampleRate;
  const pending = new Map();
  const at = (time, fn) => {
    const q = Math.ceil(time / quantum - 1e-9) * quantum;
    if (q <= ctx.currentTime + 1e-9) {
      fn();
      return;
    }
    const key = q.toFixed(6);
    if (!pending.has(key)) {
      pending.set(key, []);
      ctx.suspend(q).then(() => {
        const fns = pending.get(key) ?? [];
        pending.delete(key);
        for (const f of fns) f();
        ctx.resume();
      });
    }
    pending.get(key).push(fn);
  };
  return at;
}

export async function renderSfx(events, duration) {
  const { SoundManager } = await import(findModuleUrl(/\/src\/audio\/SoundManager\.ts/));
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const at = offlineScheduler(ctx);

  // Ayrı bir ses yöneticisi örneği; ses bağlamı olarak çevrimdışı bağlamı kurar
  const RealAudioContext = globalThis.AudioContext;
  globalThis.AudioContext = function OfflineProxy() {
    return ctx;
  };
  const sm = new SoundManager();
  sm.muted = false;
  sm.volume = 1;
  sm.musicMuted = true;
  sm.suspended = false;
  sm.platformMuted = false;
  sm.initContext();
  globalThis.AudioContext = RealAudioContext;
  // Her ses çalınırken çağrılan initContext askıdaki bağlamı hemen sürdürür; çevrimdışı
  // işlemede notalar kurulmadan zaman ilerler ve ses kaybolur. Sürdürmeyi zamanlayıcı yapar.
  sm.initContext = () => {};

  const realSetTimeout = window.setTimeout;
  window.setTimeout = (fn, ms = 0) => {
    at(ctx.currentTime + ms / 1000, fn);
    return 0;
  };

  // Gelir sesi oyundaki gibi seyreltilir (video saatine göre)
  let lastIncome = -Infinity;
  let incomePendingAt = null;
  const playIncomeAt = (t) => {
    if (t - lastIncome >= INCOME_COOLDOWN_SEC) {
      lastIncome = t;
      at(t, () => sm.playIncomeChime());
    } else if (incomePendingAt === null) {
      incomePendingAt = lastIncome + INCOME_COOLDOWN_SEC;
      const when = incomePendingAt;
      lastIncome = when;
      at(when, () => {
        incomePendingAt = null;
        sm.playIncomeChime();
      });
    }
  };

  for (const ev of events) {
    if (ev.name === 'playMusic' || ev.name === 'stopMusic') continue;
    if (ev.name === 'playIncome') {
      playIncomeAt(ev.t);
      continue;
    }
    at(ev.t, () => {
      sm.lastPlayedAt.clear();
      sm[ev.name](...(ev.args ?? []));
    });
  }
  // Videonun sonunda motor sesi açık kalırsa son 0.3 sn'de söner (stopEngine)
  at(Math.max(0, duration - 0.3), () => sm.stopEngine());

  try {
    const buffer = await ctx.startRendering();
    return [buffer.getChannelData(0), buffer.getChannelData(1)];
  } finally {
    window.setTimeout = realSetTimeout;
  }
}

/**
 * Müzik: fabrika teması, roket fırlatılınca (playMusic('flight') olayı) uçuş teması.
 * Oyundaki gibi eski parça söner, yenisi yavaşça açılır. Video ortasından başladığı
 * için fabrika teması baştan tam seviyede ve melodili bölümden (8. ölçü) çalar.
 */
async function renderMusic(events, duration) {
  const { MUSIC_TRACKS, stepDuration } = await import(findModuleUrl(/\/src\/audio\/music\.ts/));
  const ctx = new OfflineAudioContext(2, Math.ceil(duration * SAMPLE_RATE), SAMPLE_RATE);
  const noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
  const data = noise.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;

  const FADE_OUT = 0.6;
  const FADE_IN = 1.6;
  const switchEvent = events.find((ev) => ev.name === 'playMusic' && ev.args?.[0] === 'flight');
  const segments = [];
  const flightAt = switchEvent ? switchEvent.t : null;
  segments.push({ id: 'factory', start: 0, end: flightAt ?? duration, startStep: 8 * 16, fadeIn: 0 });
  if (flightAt !== null) {
    segments.push({ id: 'flight', start: flightAt + FADE_OUT, end: duration, startStep: 0, fadeIn: FADE_IN });
  }

  for (const seg of segments) {
    const track = MUSIC_TRACKS[seg.id];
    const gain = ctx.createGain();
    gain.connect(ctx.destination);
    gain.gain.setValueAtTime(seg.fadeIn > 0 ? 0 : 1, 0);
    if (seg.fadeIn > 0) {
      gain.gain.setValueAtTime(0, seg.start);
      gain.gain.linearRampToValueAtTime(1, seg.start + seg.fadeIn);
    }
    const fadeEnd = seg.end < duration ? seg.end + FADE_OUT : duration;
    if (seg.end < duration) {
      gain.gain.setValueAtTime(1, seg.end);
      gain.gain.linearRampToValueAtTime(0, fadeEnd);
    }
    const stepSec = stepDuration(track);
    const voice = { ctx, out: gain, noise };
    for (let k = 0; seg.start + k * stepSec < fadeEnd; k++) {
      track.schedule((seg.startStep + k) % track.lengthSteps, seg.start + k * stepSec, voice);
    }
  }
  const buffer = await ctx.startRendering();
  return [buffer.getChannelData(0), buffer.getChannelData(1)];
}

export async function renderStems({ name, server = 'http://127.0.0.1:8765' }) {
  const meta = await fetch(`${server}/get?path=${encodeURIComponent(`${name}/events.json`)}`).then((r) => r.json());
  const duration = meta.seconds;
  const sfx = await renderSfx(meta.events, duration);
  const music = await renderMusic(meta.events, duration);
  for (const [stem, channels] of [['sfx', sfx], ['music', music]]) {
    await fetch(`${server}/put?path=${encodeURIComponent(`${name}/${stem}.wav`)}`, {
      method: 'POST',
      body: encodeWav(channels, SAMPLE_RATE),
    });
  }
  const peak = (chs) => Math.max(...chs.map((c) => c.reduce((m, v) => Math.max(m, Math.abs(v)), 0)));
  return { duration, events: meta.events.length, sfxPeak: peak(sfx), musicPeak: peak(music) };
}
