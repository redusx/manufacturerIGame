/* ======================================================================
 * MachineData.ts — Merkezi makine tanımları ve ekonomi sabitleri
 *
 * Tüm ekonomi değerleri bu dosyada tutulur; UI veya sahne koduna
 * dağınık biçimde gömülmez. Dengeleme ayarları buradan yapılır.
 * ====================================================================== */

import { D, type DecimalSource } from '../utils/decimal.ts';

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
    unlockAt: 200,
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
    unlockAt: 1500,
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
    unlockAt: 10000,
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
  { level: 75, multiplier: 5, label: '5x Mega Verimlilik' },
  { level: 100, multiplier: 6, label: '6x Aşırı Güç' },
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
    id: 'goal_first_machine',
    name: 'İlk Makine',
    targetEarned: 10,
    description: 'İlk Montaj Tezgahını kur ve otomatik üretime başla.',
    rewardText: 'Otomasyon Başlangıcı',
    globalMultiplier: 1,
  },
  {
    id: 'goal_expand_floor',
    name: 'Fabrika Genişlemesi',
    targetEarned: 75,
    description: 'Fabrika zemini genişledi — tüm hatlar biraz daha hızlı.',
    rewardText: '+%15 Genel Üretim',
    globalMultiplier: 1.15,
  },
  {
    id: 'goal_press_unlock',
    name: 'Presleme Devrimi',
    targetEarned: 200,
    description: 'Pres Makinesinin kilidini aç.',
    rewardText: 'Pres Makinesi Aktif',
    globalMultiplier: 1,
  },
  {
    id: 'goal_speed_boost',
    name: 'Hızlı Üretim',
    targetEarned: 600,
    description: 'Konveyör bant hızlandı — üretim hattı optimize edildi.',
    rewardText: '+%20 Genel Üretim',
    globalMultiplier: 1.20,
  },
  {
    id: 'goal_welder_unlock',
    name: 'Robotik Gelecek',
    targetEarned: 1500,
    description: 'Kaynak Robotunun kilidini aç.',
    rewardText: 'Kaynak Robotu Aktif',
    globalMultiplier: 1,
  },
  {
    id: 'goal_efficiency',
    name: 'Verimlilik Artışı',
    targetEarned: 4000,
    description: 'Enerji tasarruflu motorlar devreye girdi.',
    rewardText: '+%25 Genel Üretim',
    globalMultiplier: 1.25,
  },
  {
    id: 'goal_automation_unlock',
    name: 'Endüstri 4.0',
    targetEarned: 10000,
    description: 'Otomasyon Hattının kilidini aç.',
    rewardText: 'Otomasyon Hattı Aktif',
    globalMultiplier: 1,
  },
  {
    id: 'goal_super_factory',
    name: 'Süper Fabrika',
    targetEarned: 30000,
    description: 'Fabrikayı genişleterek verimi önemli ölçüde artır.',
    rewardText: '+%30 Genel Üretim',
    globalMultiplier: 1.30,
  },
  {
    id: 'goal_industrial_giant',
    name: 'Endüstriyel Dev',
    targetEarned: 100000,
    description: 'Tüm üretim hatlarında çift vardiyaya geç.',
    rewardText: '+%35 Genel Üretim',
    globalMultiplier: 1.35,
  },
  {
    id: 'goal_mega_factory',
    name: 'Megafabrika',
    targetEarned: 2000000,
    description: 'Kusursuz lojistik ve üretim optimizasyonu.',
    rewardText: '+%35 Genel Üretim',
    globalMultiplier: 1.35,
  },
  {
    id: 'goal_titan',
    name: 'Fabrika Titanı',
    targetEarned: 25000000,
    description: 'Devasa endüstriyel kompleks tam kapasite çalışıyor.',
    rewardText: '+%40 Genel Üretim',
    globalMultiplier: 1.40,
  },
  {
    id: 'goal_legend',
    name: 'Efsanevi Üretici',
    targetEarned: 250000000,
    description: 'Üretim imparatorluğu efsanevi seviyeye ulaştı.',
    rewardText: '+%50 Genel Üretim',
    globalMultiplier: 1.50,
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
