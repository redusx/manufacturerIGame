/* ======================================================================
 * MachineData.ts — Merkezi makine tanımları ve ekonomi sabitleri
 *
 * Tüm ekonomi değerleri bu dosyada tutulur; UI veya sahne koduna
 * dağınık biçimde gömülmez. Dengeleme ayarları buradan yapılır.
 * ====================================================================== */

import { D, type DecimalSource } from '../utils/decimal';

/** Tek bir makine türünün sabit (seviyeden bağımsız) verileri */
export interface MachineDefinition {
  /** Benzersiz tanımlayıcı */
  id: string;
  /** Görünen ad */
  name: string;
  /** Kısa açıklama */
  description: string;
  /** İlk satın alma maliyeti */
  baseCost: number;
  /** Her seviyede maliyetin çarpılacağı katsayı: cost = baseCost × scale^level */
  costScale: number;
  /** Seviye 1'deki saniye başına üretim */
  baseProduction: number;
  /** Açılma koşulu: oyuncunun toplam kazanmış olması gereken kaynak */
  unlockAt: number;
  /** Renk (hex, 0x ile başlar) — makine görseli ve ışığı için */
  color: number;
  /** İkincil vurgu rengi */
  accentColor: number;
  /** İkon karakter */
  icon: string;
  /** Fabrikada üretilen/işlenen ürün adı */
  productName: string;
}

/** Oyundaki tüm makineler — sıra önemlidir (arayüzde ve fabrikada bu sırada gösterilir) */
export const MACHINES: readonly MachineDefinition[] = [
  {
    id: 'assembler',
    name: 'Montaj Tezgahı',
    description: 'Hammadde bloklarını işleyip temel parçalara dönüştürür.',
    baseCost: 10,
    costScale: 1.12,
    baseProduction: 1,
    unlockAt: 0,        // Baştan açık
    color: 0x4ecdc4,
    accentColor: 0x22a699,
    icon: '🔧',
    productName: 'Temel Parça',
  },
  {
    id: 'press',
    name: 'Pres Makinesi',
    description: 'Metal levhaları yüksek basınçla damgalayarak hızlı üretim sağlar.',
    baseCost: 60,
    costScale: 1.13,
    baseProduction: 4,
    unlockAt: 50,
    color: 0xf4a261,
    accentColor: 0xe76f51,
    icon: '⚙',
    productName: 'Preslenmiş Plaka',
  },
  {
    id: 'welder',
    name: 'Kaynak Robotu',
    description: 'Otomatik lazer kaynak ile dayanıklı gövde parçaları birleştirir.',
    baseCost: 350,
    costScale: 1.14,
    baseProduction: 12,
    unlockAt: 300,
    color: 0x48cae4,
    accentColor: 0x0077b6,
    icon: '🤖',
    productName: 'Kaynaklı Gövde',
  },
  {
    id: 'automation',
    name: 'Otomasyon Hattı',
    description: 'Entegre robotik konveyör ve paketleme ile endüstriyel üretim.',
    baseCost: 2000,
    costScale: 1.15,
    baseProduction: 40,
    unlockAt: 1500,
    color: 0x9b5de5,
    accentColor: 0x7209b7,
    icon: '🏭',
    productName: 'Tam Mamul Koli',
  },
] as const;

/** Makine seviye eşikleri (kilometre taşları) ve çarpanları */
export interface LevelMilestone {
  level: number;
  multiplier: number;
  label: string;
}

export const MACHINE_LEVEL_MILESTONES: readonly LevelMilestone[] = [
  { level: 10, multiplier: 2, label: '2x Verimlilik' },
  { level: 25, multiplier: 3, label: '3x Hızlı Üretim' },
  { level: 50, multiplier: 4, label: '4x Endüstriyel Hız' },
  { level: 100, multiplier: 5, label: '5x Aşırı Güç' },
];

/** Toplam kazanıma bağlı genel fabrika hedefleri */
export interface FactoryGoal {
  id: string;
  name: string;
  targetEarned: number;
  description: string;
  rewardText: string;
  globalMultiplier: number;
}

export const FACTORY_GOALS: readonly FactoryGoal[] = [
  {
    id: 'goal_first_buy',
    name: 'İlk Makine',
    targetEarned: 10,
    description: 'İlk Montaj Tezgahını kur ve otomatik üretime başla.',
    rewardText: 'Otomasyon Başlangıcı',
    globalMultiplier: 1,
  },
  {
    id: 'goal_press',
    name: 'Presleme Devrimi',
    targetEarned: 50,
    description: 'Pres Makinesinin kilidini aç.',
    rewardText: 'Pres Makinesi Aktif',
    globalMultiplier: 1,
  },
  {
    id: 'goal_welder',
    name: 'Robotik Gelecek',
    targetEarned: 300,
    description: 'Kaynak Robotunun kilidini aç.',
    rewardText: 'Kaynak Robotu Aktif',
    globalMultiplier: 1,
  },
  {
    id: 'goal_automation',
    name: 'Endüstri 4.0',
    targetEarned: 1500,
    description: 'Otomasyon Hattının kilidini aç.',
    rewardText: 'Otomasyon Hattı Aktif',
    globalMultiplier: 1,
  },
  {
    id: 'goal_boost_1',
    name: 'Süper Fabrika',
    targetEarned: 5000,
    description: 'Fabrikayı genişleterek verimi artır.',
    rewardText: '+%50 Genel Üretim',
    globalMultiplier: 1.5,
  },
  {
    id: 'goal_boost_2',
    name: 'Endüstriyel Dev',
    targetEarned: 25000,
    description: 'Tüm üretim hatlarında çift vardiyaya geç.',
    rewardText: '2x Genel Üretim',
    globalMultiplier: 2.0,
  },
  {
    id: 'goal_boost_3',
    name: 'Megafabrika',
    targetEarned: 100000,
    description: 'Kusursuz lojistik ve üretim optimizasyonu.',
    rewardText: '3x Genel Üretim',
    globalMultiplier: 3.0,
  },
];

/* ---- Genel ekonomi sabitleri ---- */

/** Tıklama başına temel üretim */
export const BASE_CLICK_POWER = 1;

/** Offline üretim üst sınırı (saniye) — 4 saat */
export const MAX_OFFLINE_SECONDS = 4 * 60 * 60;

/** Offline üretim verimlilik çarpanı (0–1) */
export const OFFLINE_EFFICIENCY = 0.5;

/** Otomatik kayıt aralığı (ms) */
export const AUTO_SAVE_INTERVAL_MS = 30_000;

/** Kaynak adı */
export const RESOURCE_NAME = 'Parça';
