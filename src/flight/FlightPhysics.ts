/* ======================================================================
 * src/flight/FlightPhysics.ts — Uçuş fiziği (saf)
 *
 * Roketin fırlatılışını, itişini, nitrosunu, süzülmesini ve mesafe
 * hesabını yürütür. FlightScene her karede `stepFlight` çağırır;
 * `tools/flight_sim.ts` aynı işlevle binlerce uçuşu başsız çalıştırarak
 * "seviye → menzil" tablosunu ölçer. Böylece simülasyon oyunun kendisidir.
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur.
 * ====================================================================== */

import {
  BOOST_SPEED_MULTIPLIER,
  CRYSTAL_BOOST_SECONDS,
  CRYSTAL_FUEL_SECONDS,
  getBoostPitchRate,
  getDragCoefficient,
  getFuelCapacity,
  getHullDamageDivisor,
  getLaunchVelocity,
  getLiftEfficiency,
  getMainThrust,
  getMaxBoostDuration,
  getMaxHullHP,
  getRangeScale,
  getRocketClass,
} from '../data/RocketData.ts';

export interface RocketLevels {
  hull: number;
  engine: number;
  wings: number;
  boost: number;
}

/** Modül seviyelerinden türeyen uçuş değerleri */
export interface FlightStats {
  rocketClass: number;
  /** Aynı sürede kat edilen mesafeyi büyüten sınıf çarpanı */
  rangeScale: number;
  maxHp: number;
  damageDivisor: number;
  launchVelocity: number;
  mainThrust: number;
  fuelCapacity: number;
  boostCapacity: number;
  liftCoeff: number;
  dragCoeff: number;
  boostPitchRate: number;
}

/** Roketin anlık durumu. Hızlar piksel/sn, açı radyan (negatif = burun yukarı). */
export interface FlightBody {
  vx: number;
  vy: number;
  /** İrtifa (piksel) */
  altitude: number;
  angle: number;
  fuel: number;
  boost: number;
  /** Kat edilen mesafe (metre) */
  distance: number;
  /** Havada geçen süre (sn) */
  duration: number;
  /** En yüksek irtifa (metre) */
  maxAltitude: number;
  /** En yüksek hız (km/sa) */
  maxSpeed: number;
  isThrusting: boolean;
  isBoosting: boolean;
}

const DEG = Math.PI / 180;
export const GRAVITY = 380;
export const LAUNCH_ANGLE = -60 * DEG;
/** Bir pikselin metre karşılığı (sınıf çarpanı öncesi) */
const METERS_PER_PIXEL = 0.1;
/** Ana motorun sürekli itişi, tam itişin bu kadarıdır */
const CRUISE_THRUST_RATIO = 0.35;
const MAX_CLIMB_ANGLE_BOOST = -55 * DEG;
const MAX_CLIMB_ANGLE = -60 * DEG;
const MAX_DIVE_ANGLE = 52 * DEG;

export function computeFlightStats(levels: RocketLevels): FlightStats {
  const rocketClass = getRocketClass(levels);
  return {
    rocketClass,
    rangeScale: getRangeScale(rocketClass),
    maxHp: getMaxHullHP(levels.hull),
    damageDivisor: getHullDamageDivisor(levels.hull),
    launchVelocity: getLaunchVelocity(levels.engine),
    mainThrust: getMainThrust(levels.engine),
    fuelCapacity: getFuelCapacity(levels.engine),
    boostCapacity: getMaxBoostDuration(levels.boost),
    liftCoeff: getLiftEfficiency(levels.wings),
    dragCoeff: getDragCoefficient(levels.wings),
    boostPitchRate: getBoostPitchRate(levels.wings),
  };
}

/** Fırlatma gücünü (0..1) rampadan çıkış hızına çevirir; en az %25 güç sayılır */
export function launchSpeed(stats: FlightStats, launchPower: number): number {
  const power = Math.max(0.25, Math.min(1, launchPower));
  return stats.launchVelocity * (0.45 + 0.55 * power);
}

/** Rampadan yeni çıkmış roket */
export function createFlightBody(stats: FlightStats, launchPower: number): FlightBody {
  const speed = launchSpeed(stats, launchPower);
  return {
    vx: Math.cos(LAUNCH_ANGLE) * speed,
    vy: Math.sin(LAUNCH_ANGLE) * speed,
    altitude: 5,
    angle: LAUNCH_ANGLE,
    fuel: stats.fuelCapacity,
    boost: stats.boostCapacity,
    distance: 0,
    duration: 0,
    maxAltitude: 0,
    maxSpeed: 0,
    isThrusting: false,
    isBoosting: false,
  };
}

function rotateTowards(current: number, target: number, step: number): number {
  if (Math.abs(target - current) <= step) return target;
  return current + Math.sign(target - current) * step;
}

/**
 * Uçuşu bir adım ilerletir. Roket yere değdiğinde `body.altitude` 0 olur;
 * çakılmayı çağıran taraf ele alır.
 * @returns Bu adımda kat edilen mesafe (metre)
 */
export function stepFlight(body: FlightBody, stats: FlightStats, boostHeld: boolean, dt: number): number {
  // 1. Ana motor: yakıt oldukça sürekli iter
  if (body.fuel > 0) {
    body.isThrusting = true;
    body.fuel = Math.max(0, body.fuel - dt);
    const cruise = stats.mainThrust * CRUISE_THRUST_RATIO;
    body.vx += Math.cos(body.angle) * cruise * dt;
    body.vy += Math.sin(body.angle) * cruise * dt;
  } else {
    body.isThrusting = false;
  }

  // 2. Nitro: güçlü itiş ve burnu yukarı kaldırma
  if (boostHeld && body.boost > 0) {
    body.isBoosting = true;
    body.boost = Math.max(0, body.boost - dt);
    const thrust = stats.mainThrust * BOOST_SPEED_MULTIPLIER;
    body.vx += Math.cos(body.angle) * thrust * dt;
    body.vy += Math.sin(body.angle) * thrust * dt;
    body.angle = Math.max(MAX_CLIMB_ANGLE_BOOST, body.angle - stats.boostPitchRate * dt);
  } else {
    body.isBoosting = false;
  }

  // 3. Yer çekimi
  body.vy += GRAVITY * dt;

  // 4. Kanat kaldırma kuvveti (süzülme)
  const angleOfAttack = -body.angle;
  if (body.vx > 40 && angleOfAttack > -0.2 && angleOfAttack < 40 * DEG) {
    const glideLift = body.vx * (0.32 + Math.cos(angleOfAttack) * 0.38) * stats.liftCoeff * 0.8;
    body.vy -= Math.min(GRAVITY * 0.7, glideLift) * dt;
  }

  // 5. Hava direnci
  body.vx -= body.vx * Math.abs(body.vx) * stats.dragCoeff * dt;
  body.vx = Math.max(0, body.vx);

  // 6. İrtifa, mesafe ve kayıtlar
  body.altitude = Math.max(0, body.altitude - body.vy * dt);
  const distanceDelta = body.vx * dt * METERS_PER_PIXEL * stats.rangeScale;
  body.distance += distanceDelta;
  body.duration += dt;
  body.maxAltitude = Math.max(body.maxAltitude, Math.round(body.altitude * 0.25));
  body.maxSpeed = Math.max(body.maxSpeed, Math.round(currentSpeedKmH(body, stats)));

  // 7. Yer çekimi dönüşü: nitro yokken burun uçuş yoluna yatar
  if (!body.isBoosting) {
    const flightPathAngle = Math.atan2(body.vy, Math.max(50, body.vx));
    const target = body.vy < 0 ? Math.min(0, flightPathAngle) : Math.min(MAX_DIVE_ANGLE, flightPathAngle);
    const rate = (body.fuel > 0 ? 0.95 : 1.5) * dt;
    body.angle = Math.max(MAX_CLIMB_ANGLE, rotateTowards(body.angle, target, rate));
  }

  return distanceDelta;
}

/** Göstergedeki hız (km/sa): sınıf çarpanı dahil */
export function currentSpeedKmH(body: FlightBody, stats: FlightStats): number {
  return Math.sqrt(body.vx * body.vx + body.vy * body.vy) * 0.7 * stats.rangeScale;
}

/** Kristal: sabit miktarda yakıt ve nitro doldurur (kapasiteyi aşmaz) */
export function applyCrystal(body: FlightBody, stats: FlightStats): void {
  body.fuel = Math.min(stats.fuelCapacity, body.fuel + CRYSTAL_FUEL_SECONDS);
  body.boost = Math.min(stats.boostCapacity, body.boost + CRYSTAL_BOOST_SECONDS);
}

/** Engel çarpmasının gövdeye verdiği hasar (en az 10) */
export function obstacleDamage(baseAmount: number, stats: FlightStats, zoneMultiplier: number): number {
  return Math.max(10, Math.round((baseAmount * zoneMultiplier) / stats.damageDivisor));
}
