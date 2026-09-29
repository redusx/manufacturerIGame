/* ======================================================================
 * decimal.ts — break_eternity.js Decimal yardımcıları ve sarmalayıcıları
 * ====================================================================== */

import Decimal, { type DecimalSource } from 'break_eternity.js';

export { Decimal };
export type { DecimalSource };

/** Güvenli Decimal oluşturucu */
export function D(value: DecimalSource = 0): Decimal {
  if (value instanceof Decimal) return value;
  return new Decimal(value);
}

/** Sayı veya Decimal'ı Decimal'a çevirir */
export function toDecimal(value: DecimalSource): Decimal {
  return D(value);
}

/** Sıfır sabiti */
export const D_ZERO = D(0);
/** Bir sabiti */
export const D_ONE = D(1);
