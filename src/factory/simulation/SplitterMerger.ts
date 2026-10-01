/* ======================================================================
 * src/factory/simulation/SplitterMerger.ts — Akış Bölücü ve Birleştirici
 *
 * Splitter: 1 Giriş -> 2 Çıkış (50/50 yük dengeleme + taşma koruması)
 * Merger: 2 Giriş -> 1 Çıkış (Adil sıralı öncelik / round-robin)
 * Saf TypeScript — Phaser bağımlılığı yoktur.
 * ====================================================================== */

import type {
  ConveyorEntityState,
  ConveyorSlot,
  Direction,
  GridCoord,
} from '../types.ts';

export class Splitter {
  readonly coord: GridCoord;
  readonly inputDirection: Direction;
  readonly outputDirections: [Direction, Direction];
  /** Sıradaki çıkış indeksi (0 veya 1) */
  private nextOutputIndex = 0;
  /** Dahili tampon (en fazla 2 eşya) */
  private items: ConveyorSlot[] = [];

  constructor(
    coord: GridCoord,
    inputDirection: Direction,
    outputDirections: [Direction, Direction],
  ) {
    this.coord = { x: coord.x, y: coord.y };
    this.inputDirection = inputDirection;
    this.outputDirections = [outputDirections[0], outputDirections[1]];
  }

  /** Yeni eşya kabul edebilir mi? */
  canAcceptItem(): boolean {
    return this.items.length < 2;
  }

  /** Eşyayı splittera kabul eder */
  acceptItem(itemId: string, progress = 0.0): boolean {
    if (!this.canAcceptItem()) return false;
    this.items.push({ itemId, progress });
    return true;
  }

  /**
   * Splitter zaman adımı.
   * Eşyaları ilerletir ve çıkış ucuna gelenleri dönüşümlü olarak iki çıkış yönüne aktarmaya çalışır.
   * @param dt Geçen süre
   * @param tryTransfer Hedef yöne eşya aktarma fonksiyonu: (dir, item) => boolean
   */
  tick(
    dt: number,
    tryTransfer: (dir: Direction, item: ConveyorSlot) => boolean,
  ): void {
    if (this.items.length === 0) return;

    // Eşyaları ilerlet
    for (const item of this.items) {
      item.progress = Math.min(1.0, item.progress + 2.0 * dt);
    }

    // Çıkışa ulaşmış en öndeki eşyayı yönlendir
    const front = this.items[0];
    if (front && front.progress >= 1.0) {
      const primaryDir = this.outputDirections[this.nextOutputIndex];
      const secondaryDir = this.outputDirections[1 - this.nextOutputIndex];

      // Önce birincil tercih edilen çıkışa aktarmayı dene
      if (tryTransfer(primaryDir, front)) {
        this.items.shift();
        this.nextOutputIndex = 1 - this.nextOutputIndex; // Sırayı değiştir (50/50)
      } else if (tryTransfer(secondaryDir, front)) {
        // Birincil tıkalıysa diğer çıkışa aktar (Taşma / Baypas koruması)
        this.items.shift();
      }
    }
  }

  get itemCount(): number {
    return this.items.length;
  }

  getItems(): ConveyorSlot[] {
    return [...this.items];
  }

  serialize(): ConveyorEntityState {
    return {
      coord: { x: this.coord.x, y: this.coord.y },
      direction: this.inputDirection,
      isSplitter: true,
      splitterOutputDirs: [this.outputDirections[0], this.outputDirections[1]],
      slots: this.items.map((s) => ({ itemId: s.itemId, progress: s.progress })),
    };
  }
}

export class Merger {
  readonly coord: GridCoord;
  readonly inputDirections: [Direction, Direction];
  readonly outputDirection: Direction;
  /** En son kabul edilen giriş portu indeksi (0 veya 1) */
  private lastAcceptedIndex = 0;
  /** Dahili tampon (en fazla 2 eşya) */
  private items: ConveyorSlot[] = [];

  constructor(
    coord: GridCoord,
    inputDirections: [Direction, Direction],
    outputDirection: Direction,
  ) {
    this.coord = { x: coord.x, y: coord.y };
    this.inputDirections = [inputDirections[0], inputDirections[1]];
    this.outputDirection = outputDirection;
  }

  /** Belirli bir giriş yönünden eşya kabul edebilir mi? */
  canAcceptFrom(dir: Direction): boolean {
    if (this.items.length >= 2) return false;
    return this.inputDirections.includes(dir);
  }

  /** Eşyayı merger'a kabul eder */
  acceptItemFrom(dir: Direction, itemId: string, progress = 0.0): boolean {
    if (!this.canAcceptFrom(dir)) return false;
    const index = this.inputDirections.indexOf(dir);
    this.lastAcceptedIndex = index;
    this.items.push({ itemId, progress });
    return true;
  }

  /**
   * Merger zaman adımı.
   * Eşyaları ilerletir ve çıkış ucundaki eşyayı tekil çıkış yönüne aktarmaya çalışır.
   */
  tick(dt: number, tryTransfer: (dir: Direction, item: ConveyorSlot) => boolean): void {
    if (this.items.length === 0) return;

    for (const item of this.items) {
      item.progress = Math.min(1.0, item.progress + 2.0 * dt);
    }

    const front = this.items[0];
    if (front && front.progress >= 1.0) {
      if (tryTransfer(this.outputDirection, front)) {
        this.items.shift();
      }
    }
  }

  get itemCount(): number {
    return this.items.length;
  }

  getItems(): ConveyorSlot[] {
    return [...this.items];
  }

  serialize(): ConveyorEntityState {
    return {
      coord: { x: this.coord.x, y: this.coord.y },
      direction: this.outputDirection,
      isMerger: true,
      mergerInputDirs: [this.inputDirections[0], this.inputDirections[1]],
      slots: this.items.map((s) => ({ itemId: s.itemId, progress: s.progress })),
    };
  }
}

