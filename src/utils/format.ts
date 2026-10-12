/* ======================================================================
 * format.ts — Sayı ve süre formatlama yardımcıları (Decimal destekli)
 * ====================================================================== */

import Decimal, { type DecimalSource } from 'break_eternity.js';
import { formatDecimal, t } from '../i18n/i18n.ts';

const SUFFIXES = [
  '',
  'K',   // Bin (Thousand)
  'M',   // Milyon (Million)
  'B',   // Milyar (Billion)
  'T',   // Trilyon (Trillion)
  'Qa',  // Katrilyon (Quadrillion)
  'Qi',  // Kentilyon (Quintillion)
  'Sx',  // Sekstilyon (Sextillion)
  'Sp',  // Septilyon (Septillion)
  'Oc',  // Oktilyon (Octillion)
  'No',  // Nonilyon (Nonillion)
  'Dc',  // Desilyon (Decillion)
  'Ud',  // Undesilyon (Undecillion)
  'Dd',  // Duodesilyon (Duodecillion)
  'Td',  // Tredesilyon (Tredecillion)
  'Qad', // Kattuordesilyon (Quattuordecillion)
  'Qid', // Kuindesilyon (Quindecillion)
  'Sxd', // Seksdesilyon (Sexdecillion)
  'Spd', // Septendesilyon (Septendecillion)
  'Ocd', // Oktodesilyon (Octodecillion)
  'Nod', // Novemdesilyon (Novemdecillion)
  'Vg',  // Vigintilyon (Vigintillion)
  'Uvg', // Unvigintilyon
  'Dvg', // Duovigintilyon
  'Tvg', // Tresvigintilyon
  'Qavg',// Kattuorvigintilyon
  'Qivg',// Kuinvigintilyon
  'Sxvg',// Seksvigintilyon
  'Spvg',// Septenvigintilyon
  'Ocvg',// Oktovigintilyon
  'Novg',// Novemvigintilyon
  'Tg',  // Trigintilyon (10^93)
];

/**
 * Büyük sayıları veya Decimal değerleri okunabilir kısa biçime çevirir.
 * Standart artımlı oyun kısaltmalarını (K, M, B, T, Qa, Qi, ...) kullanır.
 *
 * Örnekler:
 *   999 → "999"
 *   1000 → "1.00K"
 *   1234 → "1.23K"
 *   15_600 → "15.6K"
 *   123_456 → "123K"
 *   1_500_000 → "1.50M"
 *   1e9 → "1.00B"
 */
export function formatNumber(value: DecimalSource): string {
  const dec = value instanceof Decimal ? value : new Decimal(value);

  if (dec.isNan() || !dec.isFinite()) return '0';
  if (dec.lt(0)) return '-' + formatNumber(dec.neg());

  // 1000'den küçükse tam sayı
  if (dec.lt(1000)) {
    return Math.floor(dec.toNumber()).toString();
  }
  // Kısaltma ekleri (K, M, B…) her dilde aynıdır; ondalık ayraç dile göre yazılır

  const exp = dec.e;
  let tier = Math.floor(exp / 3);

  // Standart kısaltma ekleri (K, M, B, ...)
  if (tier < SUFFIXES.length) {
    let base = dec.m * Math.pow(10, exp % 3);

    // Yuvarlama taşması kontrolü (ör. 999.95+ -> 1000 -> bir üst basamak kademesine geçiş)
    if (base >= 999.5) {
      base /= 1000;
      tier += 1;
    }

    const digits = base >= 99.95 ? 0 : base >= 9.995 ? 1 : 2;
    if (tier < SUFFIXES.length) {
      return formatDecimal(base, digits) + SUFFIXES[tier];
    }
  }

  // Tanımlı son ek sınırının (10^93+) üzerindeki aşırı büyük sayılar için bilimsel gösterim
  return dec.toExponential(2).replace('+', '');
}

/**
 * Tek bir kazancı (ör. ihraç edilen eşyanın bedeli) kuruşuyla gösterir; sondaki
 * sıfırlar atılır. 1000 ve üzeri `formatNumber` ile kısaltılır.
 *
 * Örnekler: 2.5 → "2.5", 3.25 → "3.25", 18 → "18", 1234 → "1.23K"
 */
export function formatMoney(value: DecimalSource): string {
  const dec = value instanceof Decimal ? value : new Decimal(value);
  if (dec.isNan() || !dec.isFinite() || dec.gte(1000) || dec.lt(0)) return formatNumber(dec);

  return formatDecimal(Math.round(dec.toNumber() * 100) / 100, 0, 2);
}

/**
 * Saniyelik hızı gösterir: 10'un altında tek ondalık basamak (1.25 → "1.3"),
 * üstünde `formatNumber` kuralları geçerlidir.
 */
export function formatRate(value: DecimalSource): string {
  const dec = value instanceof Decimal ? value : new Decimal(value);
  if (dec.isNan() || !dec.isFinite() || dec.gte(10) || dec.lt(0)) return formatNumber(dec);

  return formatDecimal(dec.toNumber(), 1);
}

/**
 * Saniye cinsinden süreyi okunabilir metne çevirir.
 * Örnekler: 65 → "1dk 5sn", 3661 → "1sa 1dk"
 */
export function formatDuration(totalSeconds: number): string {
  const s = Math.floor(totalSeconds);
  if (s < 60) return t('unit.durationS', { s });
  const m = Math.floor(s / 60);
  if (m < 60) return t('unit.durationMS', { m, s: s % 60 });
  const h = Math.floor(m / 60);
  return t('unit.durationHM', { h, m: m % 60 });
}

/**
 * Uçuş mesafesini okunur biçimde yazar: 1 km'nin altı metre ("532 m"),
 * üstü kilometre ("5.23 km", 10 km'den sonra "12.4 km").
 */
export function formatDistance(meters: number): string {
  const value = Math.max(0, meters);
  if (value < 1000) return t('unit.meters', { n: Math.floor(value) });
  const km = value / 1000;
  return t('unit.kilometers', { n: formatDecimal(km, km < 10 ? 2 : 1) });
}

/** Tam sayıyı etkin dilin binlik ayracıyla yazar (ör. 30000 → "30,000" / "30.000") */
export function formatInteger(value: number): string {
  return formatDecimal(Math.round(value));
}

/** Ondalıklı bir değeri sabit basamakla, etkin dilin ondalık ayracıyla yazar */
export function formatFixed(value: number, digits: number): string {
  return formatDecimal(value, digits);
}
