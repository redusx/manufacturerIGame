/* ======================================================================
 * RocketData.ts — Roket yükseltme tanımları ve uçuş ekonomisi sabitleri
 *
 * Fabrika kaynakları (Parça) ile roket parçaları yükseltilir.
 * Uçuş performansı bu yükseltmelere bağlıdır; uçuş ödülleri doğrudan
 * fabrika ekonomisine geri akar.
 * ====================================================================== */

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
    description: 'Roketin zemin çarpmalarına ve engellere karşı dayanıklılığını ve sekme gücünü artırır.',
    baseCost: 150,
    costScale: 3.0,
    maxLevel: 3,
    spritePrefix: 'rocket_hull_',
    getStatText: (level) => {
      const hp = getMaxHullHP(level);
      const bounce = Math.round(getGroundBounce(level) * 100);
      return `Zırh: ${hp} HP | Sekme: %${bounce}`;
    },
  },
  {
    id: 'engine',
    name: 'İtici Motor',
    category: 'engine',
    description: 'Fırlatma rampası hızını, ana motor itiş gücünü ve yakıt süresini artırır.',
    baseCost: 250,
    costScale: 3.2,
    maxLevel: 3,
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
    maxLevel: 3,
    spritePrefix: 'rocket_wings_',
    getStatText: (level) => {
      return `Süzülme: +%${level * 25} | Çeviklik: +%${level * 20}`;
    },
  },
  {
    id: 'boost',
    name: 'Nitro Yakıt Tankı',
    category: 'boost',
    description: 'Süpersonik nitro boost süresini ve anlık hızlanma patlamasını yükseltir.',
    baseCost: 350,
    costScale: 3.5,
    maxLevel: 3,
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

/** Geriye dönük uyumluluk taban hızı (piksel/saniye) */
export function getFlightSpeed(engineLevel: number): number {
  return 220 + engineLevel * 70;
}

/** Maksimum gövde canı (çarpışma ve zemin darbeleri) */
export function getMaxHullHP(hullLevel: number): number {
  return 100 + hullLevel * 60;
}

/** Gövde zemin sekme katsayısı */
export function getGroundBounce(hullLevel: number): number {
  return Math.min(0.70, 0.35 + hullLevel * 0.09);
}

/** Fırlatma rampasından çıkış başlangıç mancınık hızı (px/s) */
export function getLaunchVelocity(engineLevel: number): number {
  return 340 + engineLevel * 65;
}

/** Ana itici motor ivmesi (px/s²) */
export function getMainThrust(engineLevel: number): number {
  return 370 + engineLevel * 85;
}

/** Ana motor yakıt süresi (saniye) */
export function getFuelCapacity(engineLevel: number): number {
  return 3.5 + engineLevel * 1.5;
}

/** Kanat yönlendirme hızı (klavye/dokunmatik piksel/sn) */
export function getSteeringSpeed(wingsLevel: number): number {
  return 160 + wingsLevel * 50;
}

/** Kanat açısal çevikliği (rad/sn) */
export function getSteeringAgility(wingsLevel: number): number {
  return 2.2 + wingsLevel * 0.5;
}

/** Kanat aerodinamik süzülme / kaldırma (lift) çarpanı */
export function getLiftEfficiency(wingsLevel: number): number {
  return 0.38 + wingsLevel * 0.16;
}

/** Maksimum boost / nitro süresi (saniye) */
export function getMaxBoostDuration(boostLevel: number): number {
  return 2.5 + boostLevel * 1.5;
}

/** Boost hızı ve ivme çarpanı */
export const BOOST_SPEED_MULTIPLIER = 1.85;
