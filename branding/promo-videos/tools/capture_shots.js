/* ======================================================================
 * capture_shots.js — Tanıtım videosu çekim betiği (tarayıcıda çalışır)
 *
 * Geliştirme sunucusunda (`npm run dev`, adres `/?release=basic`) açık oyun
 * sayfasında içe aktarılır. Oyun kare kare ilerletilir (30 fps, her kare iki
 * 1/60 sn adım), her kare tuvalden PNG olarak `capture_server.py`'ye gönderilir.
 * Oyunun çaldığı sesler o an çalınmaz; zamanıyla birlikte `events.json`'a yazılır
 * ve `render_audio.js` aynı olayları çevrimdışı seslendirir.
 *
 * Görüntüler oyunun gerçek sahneleridir: fabrika, hatlar, parsel açma, makine ve
 * roket yükseltmesi, fırlatma ve nitro, oyunun kendi işlevleri çağrılarak oynanır.
 * Kullanım (sayfa konsolunda):
 *   const m = await import('/branding/promo-videos/tools/capture_shots.js');
 *   await m.capture({ name: 'landscape', layout: 'landscape' });
 * ====================================================================== */

const FPS = 30;
const SECONDS = 15;
const STEP_MS = 1000 / 60;
const CELL = 32;

/** Kayıttaki sesler (SoundManager yöntemleri) */
const SOUND_METHODS = [
  'playClick', 'playCoin', 'playIncome', 'playUpgrade', 'playMilestone', 'playLaunch', 'playNitro',
  'playHit', 'playCrash', 'playExplosion', 'playDemolish', 'playMusic', 'stopMusic', 'stopEngine',
];

const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
const lerp = (a, b, t) => a + (b - a) * t;

/** Kamera yolu: [başlangıç karesi, bitiş karesi, {zoom, x, y} başı, {zoom, x, y} sonu] (x, y hücre) */
function cameraAt(path, f) {
  for (const [f0, f1, a, b] of path) {
    if (f >= f0 && f < f1) {
      const t = f1 - f0 <= 1 ? 0 : ease((f - f0) / (f1 - f0 - 1));
      return { zoom: lerp(a.zoom, b.zoom, t), x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
    }
  }
  return null;
}

/* ----------------------------------------------------------------------
 * Çekim planları. Zamanlar kare (30 fps). Yatay ve dikey ayrı kurgulanır.
 * ---------------------------------------------------------------------- */

function landscapePlan(g) {
  return {
    camera: [
      // 0–3 sn: beş hattın makineleri ve ihracat kapıları: +$ ve uçan paralar; yavaş yaklaşma
      [0, 90, { zoom: 2.6, x: 10.0, y: 9.6 }, { zoom: 2.9, x: 10.0, y: 10.2 }],
      // 3–7 sn: cevher girişlerinden kırıcı ve fırınlara, hatlar boyunca yatay geçiş
      [90, 210, { zoom: 3.5, x: 3.0, y: 3.4 }, { zoom: 3.0, x: 15.0, y: 4.8 }],
      // 7–11 sn: bütün fabrika; yeni parsel açılır
      [210, 330, { zoom: 2.0, x: 12.0, y: 10.0 }, { zoom: 2.1, x: 12.0, y: 10.6 }],
    ],
    actions: {
      12: () => g.make(), 30: () => g.make(), 48: () => g.make(), 66: () => g.make(),
      222: () => g.unlockPlot(4),
      282: () => g.openHangar(),
      300: () => g.upgradeRocket('wings'),
      330: () => g.launchFromHangar(),
    },
  };
}

function portraitPlan(g) {
  return {
    camera: [
      // 0–3 sn: demir ve bakır hatları baştan sona dikey (cevher → toz → külçe → levha / tel)
      [0, 90, { zoom: 3, x: 4.0, y: 6.4 }, { zoom: 3.2, x: 4.2, y: 8.6 }],
      // 3–7 sn: cam ve bakır hatları, ihracattan girişe çapraz geçiş
      [90, 210, { zoom: 4, x: 13.6, y: 12.6 }, { zoom: 3.2, x: 17.0, y: 5.6 }],
      // 7–11 sn: dişli kesicisi yakından (makine penceresi açılır)
      [210, 330, { zoom: 3.5, x: 3.5, y: 10.4 }, { zoom: 3.5, x: 3.5, y: 10.4 }],
    ],
    actions: {
      15: () => g.make(), 38: () => g.make(), 61: () => g.make(),
      212: () => g.inspectMachine('cutter', 3, 10),
      236: () => g.upgradeInspectedMachine(),
      264: () => g.closeModals(),
      268: () => g.openHangar(),
      290: () => g.upgradeRocket('wings'),
      330: () => g.launchFromHangar(),
    },
  };
}

/**
 * Uçuşta kamera rokete yaklaşır ve onu izler (rampada x1.35, kalkıştan sonra x1.6);
 * görüntü sahnenin çizili alanının dışına taşmaz.
 */
function followRocket(fs, layout) {
  const cam = fs.cameras.main;
  if (fs.__promoBaseZoom === undefined) fs.__promoBaseZoom = cam.zoom;
  const base = fs.__promoBaseZoom;
  const target = base * (fs.flightState === 'countdown' ? 1.35 : 1.6);
  const zoom = cam.zoom + (target - cam.zoom) * 0.12;
  cam.setZoom(zoom);
  const viewW = cam.width / base;
  const viewH = cam.height / base;
  const visibleW = cam.width / zoom;
  const visibleH = cam.height / zoom;
  const anchorX = layout === 'landscape' ? 0.38 : 0.45;
  const anchorY = fs.flightState === 'countdown' ? 0.62 : 0.5;
  const sx = Math.min(Math.max(0, fs.rocketScreenX - visibleW * anchorX), viewW - visibleW);
  const sy = Math.min(Math.max(0, fs.rocketScreenY - visibleH * anchorY), viewH - visibleH);
  cam.setScroll(sx, sy);
}

/* ---------------------------------------------------------------------- */

function findModuleUrl(pattern) {
  return performance.getEntriesByType('resource').map((e) => e.name).find((n) => pattern.test(n));
}

async function waitForGame() {
  for (let k = 0; k < 100; k++) {
    const scene = window.game?.scene?.getScene('GameScene');
    if (scene?.sys?.settings?.status === 5) return scene;
    await new Promise((r) => setTimeout(r, 200));
    if (window.game) {
      let T = performance.now();
      for (let i = 0; i < 10; i++) window.game.loop.step((T += STEP_MS));
    }
  }
  throw new Error('GameScene açılmadı');
}

export async function capture({ name, layout, server = 'http://127.0.0.1:8765', warmupSeconds = 12, dry = false, sample = [] }) {
  const scene = await waitForGame();
  const game = window.game;
  let clock = performance.now();
  // Phaser'ın tween yöneticisi (ve oyunun bazı sayaçları) Date.now ile ilerler. Kareler
  // gerçek zamandan bağımsız üretildiği için çekim boyunca Date.now oyun saatine bağlanır;
  // böylece animasyonlar videoda oyundaki hızıyla oynar.
  const realDateNow = Date.now;
  let virtualNow = realDateNow();
  Date.now = () => Math.floor(virtualNow);
  const step = (n = 1) => {
    for (let i = 0; i < n; i++) {
      virtualNow += STEP_MS;
      game.loop.step((clock += STEP_MS));
    }
  };

  // Kayıt yazılmasın; açık pencereler (giriş, çevrimdışı rapor) kapansın
  scene.saveGame = () => {};
  step(30);
  for (const key of Object.keys(scene)) if (scene[key] && scene[key].isOpen === true) scene[key].close();

  // Sesleri kaydet, çalma
  const { sound } = await import(findModuleUrl(/\/src\/audio\/SoundManager\.ts/));
  const events = [];
  let frame = 0;
  const now = () => +(frame / FPS).toFixed(4);
  const originals = {};
  for (const method of SOUND_METHODS) {
    originals[method] = sound[method];
    sound[method] = (...args) => events.push({ t: now(), name: method, args });
  }
  let lastEngine = null;
  originals.updateEngine = sound.updateEngine;
  sound.updateEngine = (thrusting, boosting, speed) => {
    const s = Math.round(Math.min(1, Math.max(0, speed)) * 20) / 20;
    const key = `${thrusting}|${boosting}|${s}`;
    if (key !== lastEngine) events.push({ t: now(), name: 'updateEngine', args: [thrusting, boosting, s] });
    lastEngine = key;
  };

  // Fabrika dolsun (bantlarda eşya, makineler çalışıyor)
  step(Math.round(warmupSeconds * 60));
  events.length = 0;
  for (const key of Object.keys(scene)) if (scene[key] && scene[key].isOpen === true) scene[key].close();

  const flight = () => game.scene.getScene('FlightScene');
  const flightActive = () => game.scene.isActive('FlightScene');
  let launchState = { triggered: false, blastFrame: -1 };

  const g = {
    make: () => scene.onClickProduce(),
    unlockPlot: (index) => scene.requestPlotUnlock(index),
    openHangar: () => scene.openHangar(),
    upgradeRocket: (category) => scene.rocketHangar.upgrade(category, false),
    launchFromHangar: () => scene.rocketHangar.launch(),
    inspectMachine: (defId, x, y) => {
      const machine = scene.productionEngine.getAllMachines().find(
        (m) => m.defId === defId && m.coord.x === x && m.coord.y === y,
      );
      if (machine) scene.machineInspectorModal.openFor(machine);
    },
    upgradeInspectedMachine: () => scene.machineInspectorModal.upgrade(),
    closeModals: () => {
      for (const key of Object.keys(scene)) if (scene[key] && scene[key].isOpen === true) scene[key].close();
    },
  };
  const plan = layout === 'landscape' ? landscapePlan(g) : portraitPlan(g);
  const worldCamera = scene.cameraController.camera;

  const total = FPS * SECONDS;
  const log = [];
  try {
    for (frame = 0; frame < total; frame++) {
      plan.actions[frame]?.();

      // Fırlatma: işaretçi kusursuz bölgeye girince ateşle; ardından nitro
      if (flightActive()) {
        const fs = flight();
        if (!launchState.triggered && fs.flightState === 'countdown' && fs.currentLaunch?.quality === 'perfect') {
          fs.triggerLaunchFromMeter();
          launchState = { triggered: true, blastFrame: frame };
          log.push(['blast', frame]);
        }
        if (launchState.triggered && fs.flightState === 'flying') {
          const since = frame - launchState.blastFrame;
          fs.pointerHoldingBoost = (since >= 14 && since < 30) || since >= 40;
        }
        followRocket(fs, layout);
      }

      if (!flightActive()) {
        const cam = cameraAt(plan.camera, frame);
        if (cam) {
          worldCamera.setZoom(cam.zoom);
          worldCamera.centerOn(cam.x * CELL, cam.y * CELL);
        }
      }

      step(2);
      if (!dry || sample.includes(frame)) {
        const blob = await new Promise((resolve) => game.canvas.toBlob(resolve, 'image/png'));
        const path = `${name}/frames/${String(frame).padStart(4, '0')}.png`;
        await fetch(`${server}/put?path=${encodeURIComponent(path)}`, { method: 'POST', body: blob });
      }
    }

  } finally {
    for (const method of Object.keys(originals)) sound[method] = originals[method];
    Date.now = realDateNow;
  }
  const meta = {
    name,
    layout,
    fps: FPS,
    seconds: SECONDS,
    canvas: [game.canvas.width, game.canvas.height],
    log,
    flightState: flightActive() ? flight().flightState : null,
    events,
  };
  if (!dry) {
    await fetch(`${server}/put?path=${encodeURIComponent(`${name}/events.json`)}`, {
      method: 'POST',
      body: JSON.stringify(meta, null, 1),
    });
  }
  return { frames: total, events: events.length, log, flightState: meta.flightState };
}
