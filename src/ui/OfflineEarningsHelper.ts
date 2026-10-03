/* ======================================================================
 * src/ui/OfflineEarningsHelper.ts — Çevrimdışı İlerleme Hesaplayıcı ve Veri Modeli
 *
 * Oyuncu oyundan uzaktayken üretilen kaynakları, zaman limitlerini (maks 4 saat),
 * %50 baz verimliliği ve 2x reklam çarpanını hesaplayan saf matematik/mantık motoru.
 *
 * Sorumluluklar:
 * - Süre farkı ve tavan (cap) hesaplaması (docs/MASTER_PLAN.md TASK-121)
 * - Minimum eşik denetimi (<10 saniye için popup açılmaz)
 * - Break_eternity Decimal tabanlı kusursuz kazanç çarpımı
 * - 2X Çift Kazanç ödülü desteği
 * - UI sunumu için formatlı metinler ve dinamik karşılama mesajları
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur, %100 headless test edilebilir.
 * ====================================================================== */

import Decimal, { type DecimalSource } from 'break_eternity.js';
import { D, D_ZERO } from '../utils/decimal.ts';
import { formatNumber } from '../utils/format.ts';
import {
  MAX_OFFLINE_SECONDS,
  OFFLINE_EFFICIENCY,
} from '../data/MachineData.ts';

export const MIN_OFFLINE_SECONDS = 10;

export interface OfflineEarningsReport {
  /** Gerçek geçen süre (saniye) */
  elapsedSeconds: number;
  /** Hesaba dahil edilen sınırlandırılmış süre (saniye) */
  effectiveSeconds: number;
  /** 4 saatlik tavan sınırına takıldı mı? */
  wasCapped: boolean;
  /** Uygulanan verimlilik yüzdesi (örn: 50) */
  efficiencyPercent: number;
  /** Temel kazanılan kaynak miktarı (Decimal) */
  baseEarnings: Decimal;
  /** 2X İkiye katlanmış kaynak miktarı (Decimal) */
  doubledEarnings: Decimal;
  /** Okunabilir süre metni (örn: "2 saat 15 dakika") */
  formattedDuration: string;
  /** Formatlı temel kazanç metni (örn: "+14.5K") */
  formattedBaseEarnings: string;
  /** Formatlı 2X kazanç metni (örn: "+29.0K") */
  formattedDoubledEarnings: string;
  /** Karşılama başlığı (örn: "FABRİKA RAPORU") */
  welcomeTitle: string;
  /** Karşılama alt mesajı */
  welcomeMessage: string;
  /** Modal gösterilmeli mi? (Minimum süre ve kazanç kontrolü) */
  isEligible: boolean;
}

/**
 * Süreyi Türkçe ve kullanıcı dostu bir biçimde formatlar.
 */
export function formatOfflineDuration(seconds: number): string {
  const total = Math.max(0, Math.floor(seconds));
  if (total < 60) {
    return `${total} saniye`;
  }
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const remainingSec = total % 60;

  if (hours > 0) {
    if (minutes > 0) {
      return `${hours} saat ${minutes} dakika`;
    }
    return `${hours} saat`;
  }

  if (remainingSec > 0) {
    return `${minutes} dakika ${remainingSec} saniye`;
  }
  return `${minutes} dakika`;
}

/**
 * Uzakta kalınan süreye göre karşılama mesajı üretir.
 */
export function getWelcomeMessage(elapsedSeconds: number, wasCapped: boolean): { title: string; message: string } {
  if (wasCapped) {
    return {
      title: 'UZUN BİR MOLA!',
      message: 'Makinelerin maksimum 4 saatlik çevrimdışı kapasitesini doldurdu.',
    };
  }

  if (elapsedSeconds >= 7200) {
    return {
      title: 'TEKRAR HOŞ GELDİN!',
      message: 'Sen yokken montaj hatları tam gaz çalışmaya devam etti.',
    };
  }

  if (elapsedSeconds >= 600) {
    return {
      title: 'FABRİKA RAPORU',
      message: 'Mola verdiğin sırada makinelerin yeni kaynaklar üretti.',
    };
  }

  return {
    title: 'KISA BİR MOLA',
    message: 'Konveyör hatları senin yokluğunda durmaksızın çalıştı.',
  };
}

/**
 * Çevrimdışı geçen süre ve üretim hızına göre detaylı rapor oluşturur.
 */
export function calculateOfflineReport(
  savedTimestamp: number,
  currentTimestamp: number,
  productionPerSecond: DecimalSource,
  maxCapSeconds: number = MAX_OFFLINE_SECONDS,
  efficiency: number = OFFLINE_EFFICIENCY,
): OfflineEarningsReport {
  const pps = D(productionPerSecond);
  const elapsedSeconds = Math.max(0, (currentTimestamp - savedTimestamp) / 1000);

  // Minimum süre veya üretim hızı kontrolü
  if (elapsedSeconds < MIN_OFFLINE_SECONDS || pps.lte(0)) {
    return {
      elapsedSeconds,
      effectiveSeconds: 0,
      wasCapped: false,
      efficiencyPercent: Math.round(efficiency * 100),
      baseEarnings: D_ZERO,
      doubledEarnings: D_ZERO,
      formattedDuration: formatOfflineDuration(elapsedSeconds),
      formattedBaseEarnings: '0',
      formattedDoubledEarnings: '0',
      welcomeTitle: 'HOŞ GELDİN',
      welcomeMessage: 'Yeni bir çevrimdışı gelir bulunmuyor.',
      isEligible: false,
    };
  }

  const wasCapped = elapsedSeconds > maxCapSeconds;
  const effectiveSeconds = Math.min(elapsedSeconds, maxCapSeconds);

  // Gelir hesabı: pps × effectiveSeconds × efficiency
  const baseEarnings = pps.mul(effectiveSeconds).mul(efficiency).floor();
  const doubledEarnings = baseEarnings.mul(2);

  const { title, message } = getWelcomeMessage(elapsedSeconds, wasCapped);

  return {
    elapsedSeconds,
    effectiveSeconds,
    wasCapped,
    efficiencyPercent: Math.round(efficiency * 100),
    baseEarnings,
    doubledEarnings,
    formattedDuration: formatOfflineDuration(elapsedSeconds),
    formattedBaseEarnings: formatNumber(baseEarnings),
    formattedDoubledEarnings: formatNumber(doubledEarnings),
    welcomeTitle: title,
    welcomeMessage: message,
    isEligible: baseEarnings.gt(0),
  };
}
