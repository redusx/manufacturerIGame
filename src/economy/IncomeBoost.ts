/* ======================================================================
 * src/economy/IncomeBoost.ts — Gelir takviyesi
 *
 * Süreli gelir çarpanı: etkinken fabrikanın ihracat geliri ×2 olur. Reklam
 * izleyerek veya nakitle alınır; süre üst üste eklenir ama bir sınırı vardır.
 * Süre yalnızca oyun çalışırken işler (oyun kapalıyken harcanmaz; çevrimdışı
 * gelir takviyeden etkilenmez). (docs/M9_PLAN.md §4.5 R3, DEC-032)
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur.
 * ====================================================================== */

/** Takviye etkinken ihracat gelirinin çarpanı */
export const BOOST_MULTIPLIER = 2;
/** Bir alımın eklediği süre (saniye) */
export const BOOST_GRANT_SECONDS = 600;
/** Biriktirilebilecek en uzun süre (saniye) */
export const BOOST_MAX_SECONDS = 1800;
/** Nakit bedeli: fabrikanın bu kadar saniyelik (takviyesiz) geliri */
export const BOOST_CASH_PRICE_INCOME_SECONDS = 300;
/** Fabrika henüz gelir üretmiyorken nakit bedelinin tabanı ($) */
export const BOOST_CASH_MIN_PRICE = 100;

export interface IncomeBoostState {
  remainingSec: number;
}

export class IncomeBoost {
  private remainingSec = 0;
  /** Fabrikanın takviyesiz geliri ($/sn); nakit bedeli bundan hesaplanır */
  private baseRevenuePerSec = 0;

  get isActive(): boolean {
    return this.remainingSec > 0;
  }

  /** Kalan süre (saniye) */
  get remaining(): number {
    return this.remainingSec;
  }

  /** İhracat gelirine uygulanacak çarpan */
  get multiplier(): number {
    return this.isActive ? BOOST_MULTIPLIER : 1;
  }

  /** Yeni bir alım sığar mı? (Sığmayan süre boşa gitmesin diye tam sığmalıdır) */
  canAdd(): boolean {
    return this.remainingSec + BOOST_GRANT_SECONDS <= BOOST_MAX_SECONDS;
  }

  /** Süre ekler; eklenebilen süreyi döner */
  add(seconds: number = BOOST_GRANT_SECONDS): number {
    const before = this.remainingSec;
    this.remainingSec = Math.min(BOOST_MAX_SECONDS, this.remainingSec + Math.max(0, seconds));
    return this.remainingSec - before;
  }

  /** Oyun süresi ilerledikçe çağrılır */
  update(dtSec: number): void {
    if (this.remainingSec <= 0 || dtSec <= 0) return;
    this.remainingSec = Math.max(0, this.remainingSec - dtSec);
  }

  /**
   * Ölçülen geliri bildirir. Takviye etkinken ölçüm katlanmış geliri içerir ve
   * ölçüm penceresi takviyenin başlangıcını gecikmeyle izler; bu yüzden takviyesiz
   * gelir, etkin değilken doğrudan, etkinken yalnızca yukarı doğru güncellenir.
   */
  observeRevenue(measuredRevenuePerSec: number): void {
    const measured = Math.max(0, measuredRevenuePerSec);
    this.baseRevenuePerSec = this.isActive
      ? Math.max(this.baseRevenuePerSec, measured / BOOST_MULTIPLIER)
      : measured;
  }

  /** Takviyenin nakit bedeli: takviyesiz gelirin belirli bir süresi */
  cashPrice(): number {
    return Math.max(BOOST_CASH_MIN_PRICE, Math.ceil(this.baseRevenuePerSec * BOOST_CASH_PRICE_INCOME_SECONDS));
  }

  serialize(): IncomeBoostState {
    return { remainingSec: Math.round(this.remainingSec) };
  }

  deserialize(state: Partial<IncomeBoostState> | undefined): void {
    const saved = Number(state?.remainingSec);
    this.remainingSec = Number.isFinite(saved) ? Math.min(BOOST_MAX_SECONDS, Math.max(0, saved)) : 0;
  }
}
