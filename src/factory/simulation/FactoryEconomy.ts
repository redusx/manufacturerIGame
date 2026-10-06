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
  { index: 4, name: 'Havacılık Mega Kompleksi', cost: 30000, targetWidth: 24, targetHeight: 24 },
];

export interface BackingEconomyProvider {
  canAffordAmount(amount: number): boolean;
  spendResources(amount: number): boolean;
  /** Kazanç: kasaya ve "toplam kazanç"a eklenir */
  addResources(amount: number): void;
  /** İade: yalnız kasaya eklenir, kazanç sayılmaz */
  refundResources(amount: number): void;
  readonly resources: { toNumber(): number; gte(val: any): boolean };
  readonly totalEarned: { toNumber(): number };
}

export class FactoryEconomy {
  private itemRegistry: ItemRegistry;
  private backingEconomy?: BackingEconomyProvider;

  /** Dahili nakit sermaye ($) — backingEconomy yokken kullanılır */
  private _money: number;

  /** Dahili toplam brüt gelir ($) — backingEconomy yokken kullanılır */
  private _totalEarned: number;

  /** Açılmış fabrika genişleme parsel indeksleri */
  public unlockedPlots = new Set<number>([0]);

  getUnlockedPlots(): number[] {
    return Array.from(this.unlockedPlots);
  }

  setUnlockedPlots(plots: number[]): void {
    this.unlockedPlots = new Set(plots);
  }

  /** Global gelir çarpanı (roket ve prestij ödülleriyle artar) */
  revenueMultiplier = 1.0;

  /** Temel tıklama taban değeri ($) */
  baseClickValue = 1;

  /**
   * Saniyelik gelir ölçümü: son 60 saniyenin tamamlanmış birer saniyelik ihracat
   * toplamları. Pencere uzun tutulur çünkü ihracat seyrek ve partiler hâlindedir
   * (ör. 2 sn'de bir $2.5); kısa pencere göstergeyi sürekli zıplatır.
   */
  private static readonly RATE_WINDOW_SEC = 60;
  /** Pencere dolana kadar ortalamanın bölüneceği en kısa süre (açılışta ani sıçrama olmasın) */
  private static readonly RATE_MIN_SAMPLE_SEC = 10;
  private rateBuckets: number[] = [];
  private rateBucketSum = 0;
  private currentBucketRevenue = 0;
  private currentBucketElapsed = 0;

  constructor(
    initialMoney = 0,
    itemRegistry: ItemRegistry = defaultItemRegistry,
    backingEconomy?: BackingEconomyProvider,
  ) {
    this._money = initialMoney;
    this._totalEarned = initialMoney;
    this.itemRegistry = itemRegistry;
    this.backingEconomy = backingEconomy;
  }

  /** Tekil kaynak sağlayıcısını bağlar */
  setBackingEconomy(backing?: BackingEconomyProvider): void {
    this.backingEconomy = backing;
  }

  get money(): number {
    return this.backingEconomy ? this.backingEconomy.resources.toNumber() : this._money;
  }

  set money(val: number) {
    if (!this.backingEconomy) {
      this._money = val;
    }
  }

  get totalEarned(): number {
    return this.backingEconomy ? this.backingEconomy.totalEarned.toNumber() : this._totalEarned;
  }

  set totalEarned(val: number) {
    if (!this.backingEconomy) {
      this._totalEarned = val;
    }
  }

  // -------------------------------------------------------------
  // BAKİYE VE NAKİT YÖNETİMİ
  // -------------------------------------------------------------

  /**
   * Nakit ekler. "Toplam kazanç"a yalnız üretim (ihracat ve tıklama) yazılır; söküm
   * iadesi, uçuş primi ve aşama ödülü kasaya girer ama fabrika hedeflerini ilerletmez.
   */
  addMoney(amount: number, source: 'EXPORT' | 'CLICK' | 'ROCKET' | 'CONTRACT' | 'REFUND' = 'EXPORT'): void {
    if (amount <= 0) return;

    const countsAsEarned = source === 'EXPORT' || source === 'CLICK';
    if (this.backingEconomy) {
      if (!countsAsEarned) {
        this.backingEconomy.refundResources(amount);
      } else {
        this.backingEconomy.addResources(amount);
      }
    } else {
      this._money += amount;
      if (countsAsEarned) {
        this._totalEarned += amount;
      }
    }

    if (source === 'EXPORT') {
      this.currentBucketRevenue += amount;
    }
  }

  /** Belirtilen tutar için yeterli bakiye var mı? */
  canAfford(cost: number): boolean {
    if (this.backingEconomy) {
      return this.backingEconomy.canAffordAmount(cost);
    }
    return this._money >= cost;
  }

  /** Belirtilen tutarı harcar; yetersizse false döner */
  spendMoney(amount: number): boolean {
    if (amount <= 0) return true;
    if (this.backingEconomy) {
      return this.backingEconomy.spendResources(amount);
    }
    if (!this.canAfford(amount)) return false;

    this._money -= amount;
    return true;
  }

  // -------------------------------------------------------------
  // İHRACAT VE EŞYA DEĞERLEMESİ
  // -------------------------------------------------------------

  /** İhracat gelirine uygulanan çarpan (uçuş kilometre taşları ve aşama ödülleriyle artar) */
  getExportMultiplier(): number {
    return this.revenueMultiplier;
  }

  /**
   * Sevkiyat sandığına ulaşan bir eşyayı satar ve parayı cüzdana ekler.
   * Değer kuruşa yuvarlanır; tam sayıya yuvarlanırsa ucuz eşyalarda küçük çarpanlar
   * (ör. +%15) hiçbir etki yapmaz ve $2.5'lik demir tozu $2'ye düşer.
   * @param itemId Satılan eşya ID'si
   * @returns Kazanılan net nakit ($)
   */
  exportItem(itemId: string): number {
    const item = this.itemRegistry.get(itemId);
    if (!item) return 0;

    const netValue = Math.max(
      0.01,
      Math.round(item.baseValue * this.getExportMultiplier() * 100) / 100,
    );
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
    if (dt <= 0) return;

    this.currentBucketElapsed += dt;
    while (this.currentBucketElapsed >= 1) {
      this.currentBucketElapsed -= 1;
      this.pushRateBucket(this.currentBucketRevenue);
      this.currentBucketRevenue = 0;
    }
  }

  private pushRateBucket(revenue: number): void {
    this.rateBuckets.push(revenue);
    this.rateBucketSum += revenue;
    if (this.rateBuckets.length > FactoryEconomy.RATE_WINDOW_SEC) {
      this.rateBucketSum -= this.rateBuckets.shift() ?? 0;
    }
  }

  /**
   * Son bir dakikadaki ortalama saniyelik ihracat gelirini ($/sn) döner.
   * Yalnız tamamlanmış saniyeler sayılır; içinde bulunulan saniye dahil edilmez.
   */
  getRevenuePerSec(): number {
    if (this.rateBuckets.length === 0) return 0;

    const sampleSec = Math.max(this.rateBuckets.length, FactoryEconomy.RATE_MIN_SAMPLE_SEC);
    return Math.max(0, this.rateBucketSum) / sampleSec;
  }

  /**
   * Ölçümü bilinen bir hızla başlatır (kayıt yüklenince gösterge sıfırdan başlamasın);
   * yeni ölçümler geldikçe bir dakika içinde gerçek değere yaklaşır.
   */
  seedRevenueRate(ratePerSec: number): void {
    const rate = Number.isFinite(ratePerSec) && ratePerSec > 0 ? ratePerSec : 0;
    this.rateBuckets = rate > 0 ? new Array(FactoryEconomy.RATE_WINDOW_SEC).fill(rate) : [];
    this.rateBucketSum = rate * this.rateBuckets.length;
    this.currentBucketRevenue = 0;
    this.currentBucketElapsed = 0;
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
      revenuePerSec: this.getRevenuePerSec(),
    };
  }

  loadFromSerialized(state: EconomyState): void {
    this.money = state.money;
    this.totalEarned = state.totalEarned;
    this.revenueMultiplier = state.revenueMultiplier || 1.0;
    this.unlockedPlots = new Set(state.unlockedPlots || [0]);
    this.seedRevenueRate(state.revenuePerSec ?? 0);
  }
}
