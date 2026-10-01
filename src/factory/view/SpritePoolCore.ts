/* ======================================================================
 * src/factory/view/SpritePoolCore.ts — Saf Nesne Havuzu (Object Pool Core)
 *
 * Yüksek debili fabrika bantlarında binlerce eşyanın GC (Garbage Collection)
 * baskısı ve bellek dalgalanması olmadan 60 FPS akıcı render edilmesi için
 * önceden ayrılmış (pre-allocated) ve geri dönüştürülebilir saf bellek havuzu.
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur; Node 24 native testleriyle
 * %100 test edilebilir.
 * ====================================================================== */

export interface PoolConfig {
  /** Başlangıçta önceden ayrılacak nesne adedi (varsayılan: 64) */
  initialCapacity?: number;
  /** Havuzun ulaşabileceği maksimum nesne adedi (varsayılan: 1024) */
  maxCapacity?: number;
  /** Kapasite dolduğunda tek seferde yapılacak büyüme adımı (varsayılan: 32) */
  growthStep?: number;
}

export class SpritePoolCore<T> {
  private readonly factory: (index: number) => T;
  private readonly resetFn?: (item: T) => void;

  readonly maxCapacity: number;
  readonly growthStep: number;

  /** Boşta bekleyen nesneler (LIFO yığını) */
  private freeStack: T[] = [];
  /** Şu an aktif kullanımda olan nesneler kümesi */
  private activeSet: Set<T> = new Set<T>();

  /** Havuz ömrü boyunca oluşturulmuş toplam nesne sayısı */
  private totalCreated = 0;
  /** Şimdiye kadar aynı anda aktif olan en yüksek nesne sayısı */
  private peakActive = 0;

  constructor(
    factory: (index: number) => T,
    resetFn?: (item: T) => void,
    config: PoolConfig = {},
  ) {
    this.factory = factory;
    this.resetFn = resetFn;
    this.maxCapacity = Math.max(1, config.maxCapacity ?? 1024);
    this.growthStep = Math.max(1, config.growthStep ?? 32);

    const initial = Math.min(
      this.maxCapacity,
      Math.max(0, config.initialCapacity ?? 64),
    );

    this.grow(initial);
  }

  /**
   * Havuzu belirtilen miktarda yeni nesne üreterek büyütür.
   * @param count Üretilecek nesne adedi
   * @returns Gerçekte üretilen nesne sayısı
   */
  grow(count: number): number {
    const toCreate = Math.min(count, this.maxCapacity - this.totalCreated);
    if (toCreate <= 0) return 0;

    for (let i = 0; i < toCreate; i++) {
      const item = this.factory(this.totalCreated++);
      if (this.resetFn) {
        this.resetFn(item);
      }
      this.freeStack.push(item);
    }

    return toCreate;
  }

  /**
   * Havuzdan kullanılabilir bir nesne edinir (Acquire).
   * Boşta nesne yoksa ve maxCapacity aşılmadıysa havuzu otomatik büyütür.
   * @returns Boştaki nesne veya havuz tamamen doymuşsa null
   */
  acquire(): T | null {
    if (this.freeStack.length === 0) {
      // Havuz boş; büyütmeyi dene
      const grew = this.grow(this.growthStep);
      if (grew === 0 || this.freeStack.length === 0) {
        return null; // Maksimum kapasite doldu
      }
    }

    const item = this.freeStack.pop()!;
    this.activeSet.add(item);

    if (this.activeSet.size > this.peakActive) {
      this.peakActive = this.activeSet.size;
    }

    return item;
  }

  /**
   * Kullanımı biten nesneyi havuza geri verir (Release).
   * @param item İade edilecek nesne
   * @returns İade başarılı ise true; nesne bu havuza ait değilse veya zaten boştaysa false
   */
  release(item: T): boolean {
    if (!this.activeSet.has(item)) {
      return false;
    }

    this.activeSet.delete(item);
    if (this.resetFn) {
      this.resetFn(item);
    }
    this.freeStack.push(item);
    return true;
  }

  /**
   * Aktif olan tüm nesneleri havuza topluca geri iade eder.
   */
  releaseAll(): void {
    for (const item of this.activeSet) {
      if (this.resetFn) {
        this.resetFn(item);
      }
      this.freeStack.push(item);
    }
    this.activeSet.clear();
  }

  /**
   * Şu an kullanımda olan tüm nesneleri gezer.
   */
  forEachActive(callback: (item: T, index: number) => void): void {
    let idx = 0;
    for (const item of this.activeSet) {
      callback(item, idx++);
    }
  }

  /**
   * Havuzdaki tüm nesneleri temizler ve sıfırlar.
   */
  clear(): void {
    this.releaseAll();
    this.freeStack = [];
    this.totalCreated = 0;
    this.peakActive = 0;
  }

  // -------------------------------------------------------------
  // METRİKLER VE DURUM SORGULARI
  // -------------------------------------------------------------

  /** Havuzda toplam var olan nesne sayısı */
  get totalAllocated(): number {
    return this.totalCreated;
  }

  /** Şu an aktif kullanımda olan nesne sayısı */
  get activeCount(): number {
    return this.activeSet.size;
  }

  /** Boşta anında alınabilir nesne sayısı */
  get availableCount(): number {
    return this.freeStack.length;
  }

  /** Şimdiye kadar ulaşılan eşzamanlı aktif nesne rekoru */
  get peakActiveCount(): number {
    return this.peakActive;
  }

  /** Havuz maksimum kapasiteye ulaştı mı ve boşta nesne kalmadı mı? */
  get isExhausted(): boolean {
    return this.freeStack.length === 0 && this.totalCreated >= this.maxCapacity;
  }
}
