/* ======================================================================
 * format.ts — Sayı ve süre formatlama yardımcıları (Decimal destekli)
 * ====================================================================== */

import Decimal, { type DecimalSource } from 'break_eternity.js';

const SUFFIXES = [
  '', 'K', 'M', 'B', 'T', 'Qa', 'Qi', 'Sx', 'Sp', 'Oc', 'No', 'Dc',
];

/**
 * Büyük sayıları veya Decimal değerleri okunabilir kısa biçime çevirir.
 * Örnekler:
 *   999 → "999"
 *   1234 → "1.23K"
 *   1_500_000 → "1.50M"
 *   1e36 → "1.00e36"
 */
export function formatNumber(value: DecimalSource): string {
  const dec = value instanceof Decimal ? value : new Decimal(value);

  if (dec.isNan() || !dec.isFinite()) return '0';
  if (dec.lt(0)) return '-' + formatNumber(dec.neg());

  // 1000'den küçükse tam sayı
  if (dec.lt(1000)) {
    const num = dec.toNumber();
    // Tam sayı değilse ve küçükse 1 ondalık gösterebiliriz, tam ise düz tam sayı
    return Math.floor(num).toString();
  }

  // Standart büyük harf ekleri (K, M, B, ...)
  const maxSuffixExp = SUFFIXES.length * 3; // 36
  if (dec.layer === 0 && dec.mag < maxSuffixExp) {
    const exp = Math.floor(dec.mag);
    const tier = Math.floor(exp / 3);
    const remainderExp = exp % 3;
    const baseVal = dec.sign * Math.pow(10, dec.mag - tier * 3);

    const digits = baseVal >= 100 ? 0 : baseVal >= 10 ? 1 : 2;
    return baseVal.toFixed(digits) + SUFFIXES[tier];
  }

  // Bilimsel gösterim (e36 ve üzeri)
  return dec.toExponential(2).replace('+', '');
}

/**
 * Saniye cinsinden süreyi okunabilir metne çevirir.
 * Örnekler: 65 → "1dk 5sn", 3661 → "1sa 1dk"
 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  if (s < 60) return `${s}sn`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}dk ${s % 60}sn`;
  const h = Math.floor(m / 60);
  return `${h}sa ${m % 60}dk`;
}
