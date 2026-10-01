/* ======================================================================
 * src/factory/simulation/FactoryEconomy.ts — İncremental Ekonomi Motoru
 *
 * Nakit sermaye ($), saniyelik ihracat geliri (revenue/sec), tıklama geliri
 * (clickValue), makine seviye yükseltme maliyetleri ($Base * 1.15^lvl),
 * fabrika parseli genişletme maliyetleri ve roket fırlatma ödüllerini
 * yöneten saf TypeScript ekonomi sınıfı.
 * Phaser bağımlılığı yoktur.
 * ====================================================================== */
import type { EconomyState } from '../types.ts';
import { ItemRegistry, defaultItemRegistry } from './ItemRegistry.ts';

export type { EconomyState };

export interface PlotDefinition {
  index: number;
  name: string;
  cost: number;
  targetWidth: number;
  targetHeight: number;
}

/** Fabrika parsel açılım standartları */
export const FACTORY_PLOTS: PlotDefinition[] = [
  { index: 0, name: 'Başlangıç Atölyesi', cost: 0, targetWidth: 8, targetHeight: 8 },
  { index: 1, name: 'Dökümhane Parseli', cost: 500, targetWidth: 12, targetHeight: 8 },
  { index: 2, name: 'Mekanik İmalathane Parseli', cost: 2500, targetWidth: 16, targetHeight: 12 },
  { index: 3, name: 'Montaj Tesisi Parseli', cost: 10000, targetWidth: 20, targetHeight: 16 },
  { index: 4, name: 'Havacılık Mega Kompleksi', cost: 50000, targetWidth: 24, targetHeight: 24 },
];

export class FactoryEconomy {
  private itemRegistry: ItemRegistry;

  /** Mevcut nakit sermaye ($) */
  money: number;

  /** Oyuncunun kariyeri boyunca kazandığı toplam brüt gelir ($) */
  totalEarned: number;

  /** Açılmış fabrika genişleme parsel indeksleri */
  private unlockedPlots = new Set<number>([0]);

  /** Global gelir çarpanı (roket ve prestij ödülleriyle artar) */
  revenueMultiplier = 1.0;

  /** Temel tıklama taban değeri ($) */
  baseClickValue = 1;

  /** Saniyelik gelir hesabı için son zaman dilimindeki kazanç kayıtları */
  private recentEarnings: Array<{ ageSec: number; amount: number }> = [];
  private readonly REVENUE_WINDOW_SEC = 5.0;

  constructor(initialMoney = 0, itemRegistry: ItemRegistry = defaultItemRegistry) {
    this.money = initialMoney;
    this.totalEarned = initialMoney;
    this.itemRegistry = itemRegistry;
  }

  // -------------------------------------------------------------
  // BAKİYE VE NAKİT YÖNETİMİ
  // -------------------------------------------------------------

  /** Nakit ekler ve toplam kazanılan tutarı günceller */
  addMoney(amount: number, source: 'EXPORT' | 'CLICK' | 'ROCKET' | 'CONTRACT' | 'REFUND' = 'EXPORT'): void {
    if (amount <= 0) return;

    this.money += amount;
    if (source !== 'REFUND') {
      this.totalEarned += amount;
    }

    if (source === 'EXPORT') {
      this.recentEarnings.push({ ageSec: 0, amount });
    }
  }

  /** Belirtilen tutar için yeterli bakiye var mı? */
  canAfford(cost: number): boolean {
    return this.money >= cost;
  }

  /** Belirtilen tutarı harcar; yetersizse false döner */
  spendMoney(amount: number): boolean {
    if (amount <= 0) return true;
    if (!this.canAfford(amount)) return false;

    this.money -= amount;
    return true;
  }

  // -------------------------------------------------------------
  // İHRACAT VE EŞYA DEĞERLEMESİ
  // -------------------------------------------------------------

  /**
   * Sevkiyat sandığına ulaşan bir eşyayı satar ve parayı cüzdana ekler.
   * @param itemId Satılan eşya ID'si
   * @returns Kazanılan net nakit ($)
   */
  exportItem(itemId: string): number {
    const item = this.itemRegistry.get(itemId);
    if (!item) return 0;

    const netValue = Math.max(1, Math.floor(item.baseValue * this.revenueMultiplier));
    this.addMoney(netValue, 'EXPORT');
    return netValue;
  }

  // -------------------------------------------------------------
  // SANİYELİK GELİR VE TIKLAMA HESABI (CLICK / COLLECT)
  // -------------------------------------------------------------

  /**
   * Zaman adımı (dt saniye): Saniyelik gelir penceresini kaydırır.
   */
  tick(dt: number): void {
    for (const record of this.recentEarnings) {
      record.ageSec += dt;
    }
    // Pencere süresini aşan eski kayıtları temizle
    this.recentEarnings = this.recentEarnings.filter(
      (r) => r.ageSec <= this.REVENUE_WINDOW_SEC,
    );
  }

  /**
   * Son 5 saniyedeki ortalama saniyelik ihracat gelirini ($/sn) döner.
   */
  getRevenuePerSec(): number {
    if (this.recentEarnings.length === 0) return 0;

    let windowSum = 0;
    for (const r of this.recentEarnings) {
      windowSum += r.amount;
    }
    return windowSum / this.REVENUE_WINDOW_SEC;
  }

  /**
   * Anlık tıklama geliri değeri ($/tık):
   * clickValue = baseClickValue + floor(currentRevenuePerSec * 0.05)
   */
  getClickValue(): number {
    const revPerSec = this.getRevenuePerSec();
    return Math.max(1, Math.floor(this.baseClickValue + revPerSec * 0.05));
  }

  /**
   * Tıklama eylemini gerçekleştirir, parayı ekler ve kazanılan tutarı döner.
   */
  performClick(): number {
    const value = this.getClickValue();
    this.addMoney(value, 'CLICK');
    return value;
  }

  // -------------------------------------------------------------
  // MAKİNE GELİŞTİRME MALİYETİ ($Base * 1.15^lvl) VE İADE
  // -------------------------------------------------------------

  /**
   * Bir makineyi mevcut seviyesinden bir sonraki seviyeye yükseltme maliyeti:
   * Maliyet = round(baseCost * (1.15)^currentLevel)
   */
  getMachineUpgradeCost(baseCost: number, currentLevel: number): number {
    return Math.max(1, Math.round(baseCost * Math.pow(1.15, currentLevel)));
  }

  /**
   * Belirtilen seviyedeki bir makineye şu ana kadar yapılmış toplam yatırım tutarı
   * (Alım maliyeti + tüm ara seviye yükseltmeleri toplamı).
   */
  getTotalMachineInvestment(baseCost: number, level: number): number {
    let total = baseCost; // Seviye 1 taban satın alma
    for (let lvl = 1; lvl < level; lvl++) {
      total += this.getMachineUpgradeCost(baseCost, lvl);
    }
    return total;
  }

  /**
   * Makine yıkıldığında %100 tam sermaye iadesi yapar.
   * @returns İade edilen toplam sermaye ($)
   */
  refundMachine(baseCost: number, level: number): number {
    const refund = this.getTotalMachineInvestment(baseCost, level);
    this.addMoney(refund, 'REFUND');
    return refund;
  }

  // -------------------------------------------------------------
  // FABRİKA PARSELİ GENİŞLETME (PLOT EXPANSION)
  // -------------------------------------------------------------

  /** Parsel açılmış mı? */
  isPlotUnlocked(plotIndex: number): boolean {
    return this.unlockedPlots.has(plotIndex);
  }

  /** Belirtilen parselin satın alma bedeli */
  getPlotCost(plotIndex: number): number {
    const plot = FACTORY_PLOTS.find((p) => p.index === plotIndex);
    return plot ? plot.cost : Infinity;
  }

  /**
   * Yeni bir fabrika genişleme parselini satın alır ve açar.
   */
  unlockPlot(plotIndex: number): boolean {
    if (this.isPlotUnlocked(plotIndex)) return true;

    const cost = this.getPlotCost(plotIndex);
    if (!this.spendMoney(cost)) return false;

    this.unlockedPlots.add(plotIndex);
    return true;
  }

  /** Açılmış en yüksek parselin hedef fabrika boyutlarını döner */
  getCurrentFactoryDimensions(): { width: number; height: number } {
    let maxWidth = 8;
    let maxHeight = 8;

    for (const plot of FACTORY_PLOTS) {
      if (this.unlockedPlots.has(plot.index)) {
        maxWidth = Math.max(maxWidth, plot.targetWidth);
        maxHeight = Math.max(maxHeight, plot.targetHeight);
      }
    }

    return { width: maxWidth, height: maxHeight };
  }

  // -------------------------------------------------------------
  // ROKET FIRLATMA ÖDÜLÜ HESAPLAYICISI
  // -------------------------------------------------------------

  /**
   * Roket uçuşu sonunda kazanılan nakit ödülünü hesaplar:
   * Ödül = ((İrtifa * 2) + (Hurda * 25)) * roketÇarpanı
   */
  calculateFlightReward(
    distanceMeters: number,
    scrapCollected: number,
    rocketMultiplier = 1.0,
  ): number {
    const rawReward = (distanceMeters * 2) + (scrapCollected * 25);
    return Math.max(0, Math.floor(rawReward * rocketMultiplier));
  }

  /**
   * Roket uçuş ödülünü cüzdana ekler ve tutarı döner.
   */
  claimFlightReward(
    distanceMeters: number,
    scrapCollected: number,
    rocketMultiplier = 1.0,
  ): number {
    const reward = this.calculateFlightReward(
      distanceMeters,
      scrapCollected,
      rocketMultiplier,
    );
    this.addMoney(reward, 'ROCKET');
    return reward;
  }

  // -------------------------------------------------------------
  // SERİLEŞTİRME (SAVE / LOAD)
  // -------------------------------------------------------------

  serialize(): EconomyState {
    return {
      money: this.money,
      totalEarned: this.totalEarned,
      unlockedPlots: Array.from(this.unlockedPlots),
      revenueMultiplier: this.revenueMultiplier,
    };
  }

  loadFromSerialized(state: EconomyState): void {
    this.money = state.money;
    this.totalEarned = state.totalEarned;
    this.revenueMultiplier = state.revenueMultiplier || 1.0;
    this.unlockedPlots = new Set(state.unlockedPlots || [0]);
    this.recentEarnings = [];
  }
}
