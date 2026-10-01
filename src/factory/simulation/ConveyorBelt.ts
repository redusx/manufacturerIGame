/* ======================================================================
 * src/factory/simulation/ConveyorBelt.ts — Tekil Konveyör Hücresi
 *
 * $1 \times 1$ tile boyutundaki yönlü taşıma bandı.
 * 2 yuvalı (slot) kesikli eşya ilerlemesi, bant içi mesafe koruması,
 * geri tepme (backpressure) duruşu ve serileştirme desteği.
 * Saf TypeScript — Phaser bağımlılığı yoktur.
 * ====================================================================== */

import type {
  ConveyorEntityState,
  ConveyorSlot,
  Direction,
  GridCoord,
} from '../types.ts';

/** İki eşya arasındaki minimum mesafe (slot genişliği = 0.5 tile) */
export const MIN_ITEM_SPACING = 0.5;

export class ConveyorBelt {
  readonly coord: GridCoord;
  direction: Direction;
  /** Taşıma hızı (tile / saniye) */
  speed: number;
  /** Bant üzerindeki eşyalar (küçük progress'ten büyük progress'e sıralı) */
  private items: ConveyorSlot[] = [];

  constructor(coord: GridCoord, direction: Direction, speed = 1.0) {
    this.coord = { x: coord.x, y: coord.y };
    this.direction = direction;
    this.speed = speed;
  }

  /** Bant üzerinde yeni bir eşyayı kabul edebilir mi? */
  canAcceptItem(): boolean {
    if (this.items.length >= 2) return false;
    if (this.items.length === 0) return true;
    // En arkadaki eşyanın progress'i en az MIN_ITEM_SPACING kadar ilerlemiş olmalı
    const rearItem = this.items[0];
    return rearItem.progress >= MIN_ITEM_SPACING;
  }

  /**
   * Yeni bir eşyayı banda alır.
   * @param itemId Eşya ID'si
   * @param initialProgress Giriş ilerlemesi (varsayılan 0.0)
   */
  acceptItem(itemId: string, initialProgress = 0.0): boolean {
    if (!this.canAcceptItem()) return false;

    // Yeni giren eşya arkaya eklenir
    this.items.unshift({
      itemId,
      progress: Math.max(0.0, Math.min(initialProgress, MIN_ITEM_SPACING - 0.01)),
    });
    return true;
  }

  /**
   * Zaman adımı (dt saniye).
   * Eşyaları ileri taşır; öndeki eşyaya çarpma veya bant sonunda durma kurallarını işletir.
   */
  tick(dt: number): void {
    if (dt <= 0 || this.items.length === 0) return;

    const delta = this.speed * dt;

    // Önden arkaya doğru ilerlet (items[length - 1] en öndeki eşyadır)
    for (let i = this.items.length - 1; i >= 0; i--) {
      const item = this.items[i];

      // Önündeki sınır: Eğer en öndeyse bant sonu (1.0), arkasındaysa öndeki eşya - MIN_ITEM_SPACING
      let maxAllowedProgress = 1.0;
      if (i < this.items.length - 1) {
        const itemAhead = this.items[i + 1];
        maxAllowedProgress = Math.max(0.0, itemAhead.progress - MIN_ITEM_SPACING);
      }

      item.progress = Math.min(maxAllowedProgress, item.progress + delta);
    }
  }

  /**
   * Bant çıkış ucuna (progress >= 1.0) ulaşmış en öndeki eşyaya bakar (silmez).
   */
  peekFrontItem(): ConveyorSlot | null {
    if (this.items.length === 0) return null;
    const frontItem = this.items[this.items.length - 1];
    return frontItem.progress >= 1.0 ? frontItem : null;
  }

  /**
   * Bant çıkış ucundaki en öndeki eşyayı alır ve banttan çıkarır.
   */
  popFrontItem(): ConveyorSlot | null {
    const front = this.peekFrontItem();
    if (!front) return null;
    return this.items.pop() ?? null;
  }

  /**
   * Bant üzerindeki bir eşyayı (varsayılan: en öndeki) progress şartı aramaksızın alır ve çıkarır.
   * Oyuncunun tıklayarak eşya toplaması (Click & Collect) ve acil tahliye için kullanılır.
   */
  takeItem(index?: number): ConveyorSlot | null {
    if (this.items.length === 0) return null;
    if (index === undefined || index >= this.items.length) {
      return this.items.pop() ?? null;
    }
    const removed = this.items.splice(index, 1);
    return removed.length > 0 ? removed[0] : null;
  }

  /** Bant üzerindeki tüm eşyaların kopyasını döner */
  getItems(): readonly ConveyorSlot[] {
    return this.items;
  }

  /** Bant boş mu? */
  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  /** Bant tamamen dolu mu? */
  get isFull(): boolean {
    return !this.canAcceptItem();
  }

  /** Bant üstündeki eşya sayısı */
  get itemCount(): number {
    return this.items.length;
  }

  /** Durumu JSON olarak serileştirir */
  serialize(): ConveyorEntityState {
    return {
      coord: { x: this.coord.x, y: this.coord.y },
      direction: this.direction,
      slots: this.items.map((it) => ({
        itemId: it.itemId,
        progress: Number(it.progress.toFixed(4)),
      })),
    };
  }

  /** Kayıttan yeni ConveyorBelt örneği oluşturur */
  static deserialize(state: ConveyorEntityState, speed = 1.0): ConveyorBelt {
    const belt = new ConveyorBelt(state.coord, state.direction, speed);
    // Sıralamayı koruyarak slots aktar
    belt.items = state.slots.map((s) => ({
      itemId: s.itemId,
      progress: s.progress,
    }));
    return belt;
  }
}
