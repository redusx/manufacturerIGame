/* ======================================================================
 * src/flight/RangeLadder.ts — Menzil merdiveni ("Seferler")
 *
 * 10 aşamalık öğreticiden sonra oyunun genel hedefi: bir öncekinden daha
 * ileri gitmek. Her basamak bir menzil hedefidir; ulaşılınca kalıcı bir ödül
 * verir (gelir çarpanı) ve bir sonraki kademenin kilidini açar (roket seviye
 * sınırı, parsel izni, çevrimdışı süre). Uçuş bölgeleri de bu basamaklardan
 * türetilir. (docs/M9_PLAN.md §4.1, DEC-028)
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur.
 * ====================================================================== */

export interface RangeRung {
  id: string;
  /** 1'den başlayan sıra */
  index: number;
  name: string;
  targetMeters: number;
  /** Bu basamağa ulaşması beklenen roket sınıfı (en düşük modül seviyesi) */
  expectedClass: number;
  /** Toplamalı gelir bonusu: 0.05 = +%5 (ilk beş basamak) */
  multiplierBonus?: number;
  /** Bileşik gelir çarpanı: 1.25 = ×1,25 */
  multiplierFactor?: number;
  /** Açtığı roket modülü seviye üst sınırı */
  unlocksRocketLevelCap?: number;
  /** Satın alma izni verdiği parselin indeksi */
  unlocksPlotIndex?: number;
  /** Çevrimdışı gelirin birikebildiği en uzun süre (saat) */
  offlineCapHours?: number;
}

/** Hiçbir basamağa ulaşılmamışken roket modüllerinin seviye üst sınırı (Mk I) */
export const BASE_ROCKET_LEVEL_CAP = 3;
/** Hiçbir basamağa ulaşılmamışken çevrimdışı gelir süresi (saat) */
export const BASE_OFFLINE_CAP_HOURS = 4;

export const RANGE_LADDER: readonly RangeRung[] = Object.freeze([
  { id: 'flight_ms_100', index: 1, name: 'İlk Tırmanış', targetMeters: 100, expectedClass: 1, multiplierBonus: 0.05 },
  { id: 'flight_ms_500', index: 2, name: 'Stratosfer', targetMeters: 500, expectedClass: 1, multiplierBonus: 0.1 },
  { id: 'flight_ms_1000', index: 3, name: 'Alçak Yörünge', targetMeters: 1000, expectedClass: 1, multiplierBonus: 0.15 },
  { id: 'flight_ms_2500', index: 4, name: 'Yörünge İstasyonu', targetMeters: 2500, expectedClass: 2, multiplierBonus: 0.2 },
  {
    id: 'flight_ms_5000',
    index: 5,
    name: 'Derin Uzay',
    targetMeters: 5000,
    expectedClass: 3,
    multiplierBonus: 0.25,
    unlocksRocketLevelCap: 6,
  },
  {
    id: 'range_7k',
    index: 6,
    name: 'Ay Geçişi',
    targetMeters: 7000,
    expectedClass: 4,
    multiplierFactor: 1.25,
    unlocksPlotIndex: 5,
  },
  {
    id: 'range_10k',
    index: 7,
    name: 'Ay Üssü',
    targetMeters: 10000,
    expectedClass: 5,
    multiplierFactor: 1.25,
    offlineCapHours: 8,
  },
  {
    id: 'range_14k',
    index: 8,
    name: 'Mars Transferi',
    targetMeters: 14000,
    expectedClass: 6,
    multiplierFactor: 1.25,
    unlocksRocketLevelCap: 9,
    unlocksPlotIndex: 6,
  },
  { id: 'range_20k', index: 9, name: 'Mars Yörüngesi', targetMeters: 20000, expectedClass: 7, multiplierFactor: 1.25 },
  {
    id: 'range_28k',
    index: 10,
    name: 'Asteroit Kuşağı',
    targetMeters: 28000,
    expectedClass: 8,
    multiplierFactor: 1.25,
    unlocksPlotIndex: 7,
  },
  {
    id: 'range_40k',
    index: 11,
    name: 'Jüpiter',
    targetMeters: 40000,
    expectedClass: 9,
    multiplierFactor: 1.25,
    unlocksRocketLevelCap: 10,
    unlocksPlotIndex: 8,
    offlineCapHours: 12,
  },
  { id: 'range_55k', index: 12, name: 'Satürn Halkaları', targetMeters: 55000, expectedClass: 10, multiplierFactor: 1.25 },
  { id: 'range_75k', index: 13, name: 'Uranüs', targetMeters: 75000, expectedClass: 10, multiplierFactor: 1.15 },
  { id: 'range_100k', index: 14, name: 'Neptün', targetMeters: 100000, expectedClass: 10, multiplierFactor: 1.15 },
]);

/** Bütün basamaklar geçildiğinde çevrimdışı gelirin birikebildiği süre (saat) */
export const MAX_OFFLINE_CAP_HOURS = Math.max(
  BASE_OFFLINE_CAP_HOURS,
  ...RANGE_LADDER.map((rung) => rung.offlineCapHours ?? 0),
);

/** Tehlike kademesinin (engel hasarı) artmaya başladığı menzil */
const HAZARD_START_METERS = 5000;

export class RangeLadder {
  /** Verilen mesafeyle ulaşılmış basamaklar */
  static achieved(distanceMeters: number): RangeRung[] {
    const dist = Math.max(0, distanceMeters);
    return RANGE_LADDER.filter((rung) => dist >= rung.targetMeters);
  }

  /** Önceki rekor ile yeni mesafe arasında yeni geçilen basamaklar */
  static newlyReached(previousBest: number, newDistance: number): RangeRung[] {
    const prev = Math.max(0, previousBest);
    const curr = Math.max(0, newDistance);
    if (curr <= prev) return [];
    return RANGE_LADDER.filter((rung) => prev < rung.targetMeters && curr >= rung.targetMeters);
  }

  /** Sıradaki hedef; hepsi geçildiyse null */
  static next(bestDistance: number): RangeRung | null {
    const best = Math.max(0, bestDistance);
    return RANGE_LADDER.find((rung) => best < rung.targetMeters) ?? null;
  }

  /** Bu rekorla roket modüllerinin yükseltilebileceği en yüksek seviye */
  static rocketLevelCap(bestDistance: number): number {
    let cap = BASE_ROCKET_LEVEL_CAP;
    for (const rung of RangeLadder.achieved(bestDistance)) {
      if (rung.unlocksRocketLevelCap) cap = Math.max(cap, rung.unlocksRocketLevelCap);
    }
    return cap;
  }

  /** Verilen seviye sınırını açan basamak (hiçbiri açmıyorsa null) */
  static rungForRocketLevel(level: number): RangeRung | null {
    if (level <= BASE_ROCKET_LEVEL_CAP) return null;
    return RANGE_LADDER.find((rung) => (rung.unlocksRocketLevelCap ?? 0) >= level) ?? null;
  }

  /** Parselin satın alma iznini veren basamak; izin gerektirmiyorsa null */
  static rungForPlot(plotIndex: number): RangeRung | null {
    return RANGE_LADDER.find((rung) => rung.unlocksPlotIndex === plotIndex) ?? null;
  }

  static isPlotPermitted(plotIndex: number, bestDistance: number): boolean {
    const rung = RangeLadder.rungForPlot(plotIndex);
    return !rung || bestDistance >= rung.targetMeters;
  }

  /** Çevrimdışı gelirin birikebildiği süre (saat) */
  static offlineCapHours(bestDistance: number): number {
    let hours = BASE_OFFLINE_CAP_HOURS;
    for (const rung of RangeLadder.achieved(bestDistance)) {
      if (rung.offlineCapHours) hours = Math.max(hours, rung.offlineCapHours);
    }
    return hours;
  }

  /**
   * Basamağın ödüllerini kısa parçalar hâlinde yazar:
   * ["gelir ×1.25", "Mk III modüller (Sv.7–9)", "yeni parsel izni", "çevrimdışı 8 saat"].
   */
  static describeRewards(rung: RangeRung): string[] {
    const parts: string[] = [];
    if (rung.multiplierBonus) parts.push(`gelir +%${Math.round(rung.multiplierBonus * 100)}`);
    if (rung.multiplierFactor) parts.push(`gelir ×${rung.multiplierFactor}`);
    if (rung.unlocksRocketLevelCap) {
      const cap = rung.unlocksRocketLevelCap;
      const range = cap >= 10 ? 'Sv.10' : `Sv.${cap - 2}–${cap}`;
      parts.push(`${RangeLadder.tierName(cap)} modüller (${range})`);
    }
    if (rung.unlocksPlotIndex !== undefined) parts.push('yeni parsel izni');
    if (rung.offlineCapHours) parts.push(`çevrimdışı ${rung.offlineCapHours} saat`);
    return parts;
  }

  /** Seviyenin ait olduğu kademe: Mk I (Sv.1-3), Mk II (4-6), Mk III (7-9), Mk IV (10) */
  static tierName(level: number): string {
    if (level >= 10) return 'Mk IV';
    if (level >= 7) return 'Mk III';
    if (level >= 4) return 'Mk II';
    return 'Mk I';
  }

  /** Uçuş sırasında içinde bulunulan bölge: geçilen basamak sayısı (0 = kalkış bölgesi) */
  static zoneIndex(distanceMeters: number): number {
    return RangeLadder.achieved(distanceMeters).length;
  }

  /** Bölgenin adı: en son geçilen basamağın adı */
  static zoneName(distanceMeters: number): string {
    const passed = RangeLadder.achieved(distanceMeters);
    return passed.length > 0 ? passed[passed.length - 1].name : 'Kalkış';
  }

  /**
   * Tehlike kademesi: 5 km'den itibaren geçilen her basamak engellerin hasarını
   * artırır. Gövde seviyesi düşük kalan roket ileri bölgelerde dayanamaz.
   */
  static hazardTier(distanceMeters: number): number {
    return RangeLadder.achieved(distanceMeters).filter((rung) => rung.targetMeters >= HAZARD_START_METERS).length;
  }

  /** Engel hasarının bölgeye göre çarpanı */
  static obstacleDamageMultiplier(distanceMeters: number): number {
    return 1 + 0.3 * RangeLadder.hazardTier(distanceMeters);
  }
}
