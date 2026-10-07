/* ======================================================================
 * RocketData.ts — Roket yükseltme tanımları ve uçuş ekonomisi sabitleri
 *
 * Fabrika kaynakları (Parça) ile roket parçaları yükseltilir.
 * Uçuş performansı bu yükseltmelere bağlıdır; uçuş ödülleri doğrudan
 * fabrika ekonomisine geri akar.
 * ====================================================================== */

/** Bir roket modülünün ulaşabileceği en yüksek seviye */
export const MAX_ROCKET_LEVEL = 10;

export interface RocketUpgradeDef {
  id: string;
  name: string;
  category: 'hull' | 'engine' | 'wings' | 'boost';
  description: string;
  baseCost: number;
  costScale: number;
  maxLevel: number;
  /** Seviyeye göre sprite anahtarı öneki (örn. 'rocket_hull_') */
  spritePrefix: string;
  /** Seviyeye göre stat açıklaması */
  getStatText: (level: number) => string;
}

export const ROCKET_UPGRADES: readonly RocketUpgradeDef[] = [
  {
    id: 'hull',
    name: 'Gövde Zırhı',
    category: 'hull',
    description: 'Roketin engellere karşı dayanıklılığını artırır; ileri bölgelerde engeller daha sert vurur.',
    baseCost: 150,
    costScale: 3.0,
    maxLevel: MAX_ROCKET_LEVEL,
    spritePrefix: 'rocket_hull_',
    getStatText: (level) => {
      const hp = getMaxHullHP(level);
      return `Zırh: ${hp} HP | Engel hasarı ÷${getHullDamageDivisor(level).toFixed(1)}`;
    },
  },
  {
    id: 'engine',
    name: 'İtici Motor',
    category: 'engine',
    description: 'Fırlatma rampası hızını, ana motor itiş gücünü ve yakıt süresini artırır.',
    baseCost: 250,
    costScale: 3.2,
    maxLevel: MAX_ROCKET_LEVEL,
    spritePrefix: 'rocket_engine_',
    getStatText: (level) => {
      const thrust = getMainThrust(level);
      const fuel = getFuelCapacity(level);
      return `İtiş: ${Math.round(thrust)} N | Yakıt: ${fuel.toFixed(1)}s`;
    },
  },
  {
    id: 'wings',
    name: 'Manevra Kanatları',
    category: 'wings',
    description: 'Havadaki süzülme kaldırma kuvvetini (lift), eğim çevikliğini ve aerodinamik kaymayı artırır.',
    baseCost: 200,
    costScale: 3.0,
    maxLevel: MAX_ROCKET_LEVEL,
    spritePrefix: 'rocket_wings_',
    getStatText: (level) => {
      const effective = physicsLevel(level);
      return `Süzülme: +%${Math.round(effective * 25)} | Çeviklik: +%${Math.round(effective * 20)}`;
    },
  },
  {
    id: 'boost',
    name: 'Nitro Yakıt Tankı',
    category: 'boost',
    description: 'Süpersonik nitro boost süresini ve anlık hızlanma patlamasını yükseltir.',
    baseCost: 350,
    costScale: 3.5,
    maxLevel: MAX_ROCKET_LEVEL,
    spritePrefix: 'rocket_tank_',
    getStatText: (level) => {
      const cap = getMaxBoostDuration(level).toFixed(1);
      return `Nitro Kapasitesi: ${cap}s`;
    },
  },
] as const;

/* ---- Uçuş Dengeleme ve Ödül Sabitleri ---- */

/** Her 10 metre uçuş mesafesi başına kazanılan temel fabrika parçası */
export const DISTANCE_RESOURCE_RATE = 0.35;

/** Toplanan dişli/parça başına anında kazanılan kaynak */
export const PART_PICKUP_VALUE = 5;

/** Toplanan enerji kristali başına anında kazanılan kaynak (ayrıca yakıt ve nitro doldurur) */
export const CRYSTAL_PICKUP_VALUE = 15;

/** Kaçınılan her engel başına bonus kaynak */
export const DODGE_BONUS_VALUE = 4;

/* ---- Seviye Ölçeği (Sv.1–10) ---- */

/**
 * Sv.3'ten sonraki her seviyenin fizik değerlerine katkısı (Sv.1–3'teki bir seviyeye oranla).
 * Üst seviyeler uçuşu uzatmak yerine hızlandırır: fizik az, menzil çarpanı çok büyür.
 */
const PHYSICS_LEVEL_SLOPE = 0.2;

/** Fizik formüllerinde kullanılan etkin seviye: Sv.3'e kadar kendisi, sonrası sıkıştırılmış */
export function physicsLevel(level: number): number {
  return level <= 3 ? level : 3 + (level - 3) * PHYSICS_LEVEL_SLOPE;
}

/** Roket sınıfı: en düşük modül seviyesi. Bütün modüller Sv.N olunca roket N. sınıftır. */
export function getRocketClass(levels: { hull: number; engine: number; wings: number; boost: number }): number {
  return Math.max(1, Math.min(levels.hull, levels.engine, levels.wings, levels.boost));
}

/**
 * Sınıfa göre menzil (hız) çarpanı: aynı sürede kat edilen mesafeyi büyütür.
 * `tools/flight_sim.ts --calibrate` ile ölçülmüştür: nitroyu yalnızca basılı tutan
 * oyuncu, sınıfının menzil basamağına (RangeLadder) %3 payla ulaşır; nitroyu düşerken
 * kullanan oyuncu yaklaşık bir basamak ileridedir (docs/M9_PLAN.md §4.2).
 */
const RANGE_SCALE_BY_CLASS: readonly number[] = [1, 1, 1.1, 1.5, 2.0, 2.65, 3.5, 4.75, 6.3, 8.55, 11.2];

export function getRangeScale(rocketClass: number): number {
  const index = Math.max(1, Math.min(MAX_ROCKET_LEVEL, Math.floor(rocketClass)));
  return RANGE_SCALE_BY_CLASS[index];
}

/** Geriye dönük uyumluluk taban hızı (piksel/saniye) */
export function getFlightSpeed(engineLevel: number): number {
  return 220 + physicsLevel(engineLevel) * 70;
}

/** Maksimum gövde canı (çarpışma ve zemin darbeleri) */
export function getMaxHullHP(hullLevel: number): number {
  return 100 + hullLevel * 60;
}

/** Gövdenin engel hasarını bölme katsayısı */
export function getHullDamageDivisor(hullLevel: number): number {
  return 1 + hullLevel * 0.3;
}

/** Gövde zemin sekme katsayısı */
export function getGroundBounce(hullLevel: number): number {
  return Math.min(0.70, 0.35 + hullLevel * 0.09);
}

/** Fırlatma rampasından çıkış başlangıç mancınık hızı (px/s) */
export function getLaunchVelocity(engineLevel: number): number {
  return 340 + physicsLevel(engineLevel) * 65;
}

/** Ana itici motor ivmesi (px/s²) */
export function getMainThrust(engineLevel: number): number {
  return 370 + physicsLevel(engineLevel) * 85;
}

/** Ana motor yakıt süresi (saniye) */
export function getFuelCapacity(engineLevel: number): number {
  return 3.5 + physicsLevel(engineLevel) * 1.5;
}

/** Kanat yönlendirme hızı (klavye/dokunmatik piksel/sn) */
export function getSteeringSpeed(wingsLevel: number): number {
  return 160 + physicsLevel(wingsLevel) * 50;
}

/** Kanat açısal çevikliği (rad/sn) */
export function getSteeringAgility(wingsLevel: number): number {
  return 2.2 + physicsLevel(wingsLevel) * 0.5;
}

/** Kanat aerodinamik süzülme / kaldırma (lift) çarpanı */
export function getLiftEfficiency(wingsLevel: number): number {
  return 0.38 + physicsLevel(wingsLevel) * 0.16;
}

/** Kanadın hava direnci katsayısı (düşük = daha az hız kaybı) */
export function getDragCoefficient(wingsLevel: number): number {
  return 0.00018 / (1 + physicsLevel(wingsLevel) * 0.18);
}

/** Nitro basılıyken burnun yukarı dönme hızı (rad/sn) */
export function getBoostPitchRate(wingsLevel: number): number {
  return 2.2 + physicsLevel(wingsLevel) * 0.4;
}

/** Maksimum boost / nitro süresi (saniye) */
export function getMaxBoostDuration(boostLevel: number): number {
  return 2.5 + physicsLevel(boostLevel) * 1.5;
}

/** Boost hızı ve ivme çarpanı */
export const BOOST_SPEED_MULTIPLIER = 1.85;

/** Bir kristalin doldurduğu yakıt ve nitro (saniye). Seviyeden bağımsızdır (DEC-028). */
export const CRYSTAL_FUEL_SECONDS = 0.5;
export const CRYSTAL_BOOST_SECONDS = 0.35;
