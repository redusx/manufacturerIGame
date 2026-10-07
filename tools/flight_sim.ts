/* ======================================================================
 * tools/flight_sim.ts — Başsız uçuş simülasyonu
 *
 * Oyunun kendi fizik modülünü (src/flight/FlightPhysics.ts) kullanarak her
 * roket sınıfı için "seviye → menzil" tablosunu ölçer. Menzil merdiveni ve
 * sınıf çarpanları (RocketData.RANGE_SCALE_BY_CLASS) bu tabloyla ayarlanır.
 *
 * Çalıştırma:
 *   node --experimental-strip-types tools/flight_sim.ts            # tablo
 *   node --experimental-strip-types tools/flight_sim.ts --calibrate  # önerilen çarpanlar
 *
 * Engeller ve toplanabilirler oyundaki sıklıklarıyla, rastgele (tohumlu) modellenir:
 * engel her 0,8–2 sn'de bir doğar ve %27 olasılıkla çarpar; her 1,4 sn'de bir
 * toplanabilir doğar (%33 kristal, %12 tamir) ve verilen olasılıkla toplanır.
 * Gerçek oyunda ölçülen toplama oranı: nitro hep basılıyken ~%0, düşerken nitro
 * kullanan oyuncuda %20-30.
 * ====================================================================== */

import { computeFlightStats, createFlightBody, stepFlight, applyCrystal, obstacleDamage } from '../src/flight/FlightPhysics.ts';
import { RANGE_LADDER, RangeLadder } from '../src/flight/RangeLadder.ts';
import { MAX_ROCKET_LEVEL, getRangeScale } from '../src/data/RocketData.ts';

type Policy = 'none' | 'hold' | 'human';

interface FlightResult {
  distance: number;
  duration: number;
  diedByHull: boolean;
  timedOut: boolean;
  /** Uçuş sonunda kalan gövde oranı (0..1) */
  hullLeft: number;
}

const DT = 1 / 60;
const MAX_SECONDS = 600;
const OBSTACLE_HIT_CHANCE = 0.27;

let seed = 1;
const random = (): number => {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 4294967296;
};

function fly(level: number, policy: Policy, pickupChance: number, launchPower = 0.85): FlightResult {
  const stats = computeFlightStats({ hull: level, engine: level, wings: level, boost: level });
  const body = createFlightBody(stats, launchPower);
  let hp = stats.maxHp;
  let held = false;
  let nextDecision = 0;
  let pickupTimer = 0;
  let obstacleTimer = 0;
  let invulnerable = 0;

  while (body.duration < MAX_SECONDS) {
    // İnsan: 0,3 sn'de bir karar verir, düşerken nitroya basar
    if (policy === 'human' && body.duration >= nextDecision) {
      held = body.vy > 20;
      nextDecision = body.duration + 0.3;
    }
    const boostHeld = policy === 'hold' ? true : policy === 'human' ? held : false;
    stepFlight(body, stats, boostHeld, DT);
    if (body.altitude <= 0) break;

    pickupTimer += DT;
    if (pickupTimer >= 1.4) {
      pickupTimer = 0;
      const kind = random();
      if (random() < pickupChance) {
        if (kind >= 0.55 && kind < 0.88) applyCrystal(body, stats);
        else if (kind >= 0.88) hp = Math.min(stats.maxHp, hp + 35);
      }
    }

    invulnerable = Math.max(0, invulnerable - DT);
    if (body.altitude > 40) {
      obstacleTimer += DT;
      const interval = Math.max(0.8, Math.min(2.0, 2.0 - body.distance / 2500));
      if (obstacleTimer >= interval) {
        obstacleTimer = 0;
        if (invulnerable <= 0 && random() < OBSTACLE_HIT_CHANCE) {
          hp -= obstacleDamage(25, stats, RangeLadder.obstacleDamageMultiplier(body.distance));
          invulnerable = 0.8;
          if (hp <= 0) return { distance: body.distance, duration: body.duration, diedByHull: true, timedOut: false, hullLeft: 0 };
        }
      }
    }
  }
  return {
    distance: body.distance,
    duration: body.duration,
    diedByHull: false,
    timedOut: body.duration >= MAX_SECONDS,
    hullLeft: hp / stats.maxHp,
  };
}

interface Summary {
  mean: number;
  duration: number;
  maxDuration: number;
  hullDeaths: number;
  timeouts: number;
  /** Ortalama kalan gövde oranı */
  hullLeft: number;
}

function summarize(level: number, policy: Policy, pickupChance: number, runs = 40): Summary {
  let total = 0;
  let duration = 0;
  let maxDuration = 0;
  let hullDeaths = 0;
  let timeouts = 0;
  let hullLeft = 0;
  for (let i = 0; i < runs; i++) {
    seed = 1000 + i * 7919 + level * 31;
    const result = fly(level, policy, pickupChance);
    total += result.distance;
    duration += result.duration;
    maxDuration = Math.max(maxDuration, result.duration);
    if (result.diedByHull) hullDeaths++;
    if (result.timedOut) timeouts++;
    hullLeft += result.hullLeft;
  }
  return { mean: total / runs, duration: duration / runs, maxDuration, hullDeaths, timeouts, hullLeft: hullLeft / runs };
}

const km = (meters: number): string => (meters / 1000).toFixed(1).padStart(5);
const expectedRung = (level: number) =>
  [...RANGE_LADDER].reverse().find((rung) => rung.expectedClass === level && rung.index <= 12) ?? RANGE_LADDER[0];

if (process.argv.includes('--calibrate')) {
  // Hedef, en sade oynayışa göre konur: nitroyu hep basılı tutan oyuncu (gerçek oyunda
  // ölçüldü: bu oynayışta kristal toplanmıyor) sınıfının basamağına %3 payla ulaşır.
  // Böylece kimse bir basamakta takılı kalmaz; nitroyu düşerken kullanan oyuncu
  // (gerçek oyunda kristallerin %20-30'unu toplar) yaklaşık bir basamak ileridedir.
  console.log('Sınıf | hedef km | basılı km | iyi oyuncu km | önerilen çarpan');
  for (let level = 1; level <= MAX_ROCKET_LEVEL; level++) {
    const scale = getRangeScale(level);
    const hold = summarize(level, 'hold', 0).mean / scale;
    const human = summarize(level, 'human', 0.25).mean / scale;
    const target = expectedRung(level).targetMeters;
    console.log(
      `${String(level).padStart(5)} | ${km(target)} | ${km(hold)} | ${km(human)} | ${((target * 1.03) / hold).toFixed(2)}`,
    );
  }
} else if (process.argv.includes('--spread')) {
  // Kristal toplama oranının menzile etkisi (sınıf çarpanı hariç, km)
  console.log('Sınıf | %0 basılı | %25 basılı | %25 iyi | %60 iyi | en kötü/en iyi');
  for (const level of [1, 3, 5, 7, 10]) {
    const scale = getRangeScale(level);
    const values = [
      summarize(level, 'hold', 0).mean,
      summarize(level, 'hold', 0.25).mean,
      summarize(level, 'human', 0.25).mean,
      summarize(level, 'human', 0.6).mean,
    ].map((v) => v / scale);
    console.log(`${String(level).padStart(5)} | ${values.map(km).join(' | ')} | ${(Math.min(...values) / Math.max(...values)).toFixed(2)}`);
  }
} else {
  console.log('Sınıf | çarpan | hedef | nitro basılı (kristalsiz) | iyi oyuncu (%25 kristal) | iyi + %60 kristal | en uzun uçuş | gövdeden ölüm (basılı · iyi)');
  for (let level = 1; level <= MAX_ROCKET_LEVEL; level++) {
    const hold = summarize(level, 'hold', 0);
    const human = summarize(level, 'human', 0.25);
    const lucky = summarize(level, 'human', 0.6);
    const target = expectedRung(level).targetMeters;
    const longest = Math.max(hold.maxDuration, human.maxDuration, lucky.maxDuration);
    console.log(
      [
        String(level).padStart(5),
        getRangeScale(level).toFixed(2).padStart(6),
        `${km(target)} km`,
        `${km(hold.mean)} km (%${Math.round((hold.mean / target) * 100)}) ${Math.round(hold.duration)} sn`,
        `${km(human.mean)} km (%${Math.round((human.mean / target) * 100)}) ${Math.round(human.duration)} sn`,
        `${km(lucky.mean)} km (%${Math.round((lucky.mean / target) * 100)}) ${Math.round(lucky.duration)} sn`,
        `${Math.round(longest)} sn${lucky.timeouts ? ' (SINIR!)' : ''}`,
        `${hold.hullDeaths}/40 · ${human.hullDeaths}/40 (kalan gövde %${Math.round(hold.hullLeft * 100)} · %${Math.round(human.hullLeft * 100)})`,
      ].join(' | '),
    );
  }
}
