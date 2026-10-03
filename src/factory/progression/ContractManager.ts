/* ======================================================================
 * src/factory/progression/ContractManager.ts — Hızlı Yan Siparişler Yöneticisi
 *
 * Fabrika oyuncusuna süre baskısıyla belirli eşya kotalarını teslim etme
 * karşılığında nakit ödüller sunan dinamik yan kontrat sistemi.
 * (docs/LEVEL_DESIGN.md Bölüm 3, docs/TECHNICAL_ARCHITECTURE.md)
 *
 * Saf TypeScript — Node 24 native test koşucusu ile %100 uyumludur.
 * ====================================================================== */

import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { ItemRegistry, defaultItemRegistry } from '../simulation/ItemRegistry.ts';

export type ContractStatus = 'AVAILABLE' | 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'EXPIRED';

export interface QuickContract {
  id: string;
  title: string;
  description: string;
  requiredItemId: string;
  itemName: string;
  requiredCount: number;
  currentCount: number;
  rewardCash: number;
  timeLimitSec: number;
  remainingSec: number;
  tier: number;
  status: ContractStatus;
  isUrgent: boolean;
}

export interface ContractTemplate {
  id: string;
  title: string;
  descriptionTemplate: string;
  requiredItemId: string;
  baseCount: number;
  baseReward: number;
  timeLimitSec: number;
  tier: number;
}

export interface ContractDeliveryResult {
  contractId: string;
  itemId: string;
  delivered: number;
  requiredCount: number;
  currentCount: number;
  completed: boolean;
  rewardEarned: number;
}

export interface ContractSaveData {
  available: QuickContract[];
  active: QuickContract[];
  completedContractIds: string[];
  totalCompletedCount: number;
  totalRewardsEarned: number;
}

/** Standart yan sipariş şablonları (Tier 0..4) */
export const CONTRACT_TEMPLATES: readonly ContractTemplate[] = [
  // --- KADEME 0-1 (ATÖLYE & DÖKÜMHANE) ---
  {
    id: 'tmpl_iron_powder',
    title: 'Acil Demir Tozu Talebi',
    descriptionTemplate: 'Yakındaki dökümhane için acil {count} adet Demir Tozu gerekiyor.',
    requiredItemId: 'iron_powder',
    baseCount: 15,
    baseReward: 80,
    timeLimitSec: 90,
    tier: 1,
  },
  {
    id: 'tmpl_copper_ingot',
    title: 'Bakır Külçe Sevkiyatı',
    descriptionTemplate: 'Enerji şebekesi inşası için {count} adet Bakır Külçe bekleniyor.',
    requiredItemId: 'copper_ingot',
    baseCount: 10,
    baseReward: 140,
    timeLimitSec: 120,
    tier: 1,
  },
  {
    id: 'tmpl_optical_glass',
    title: 'Hassas Optik Cam İhtiyacı',
    descriptionTemplate: 'Laboratuvar optikleri için {count} adet Hassas Cam Blok teslim edin.',
    requiredItemId: 'optical_glass',
    baseCount: 8,
    baseReward: 150,
    timeLimitSec: 120,
    tier: 1,
  },
  {
    id: 'tmpl_plastic_pellet',
    title: 'Polimer Pelet İkmal',
    descriptionTemplate: 'Enjeksiyon kalıpları için acilen {count} adet Plastik Pelet gerekiyor.',
    requiredItemId: 'plastic_pellet',
    baseCount: 12,
    baseReward: 130,
    timeLimitSec: 100,
    tier: 1,
  },

  // --- KADEME 2 (MEKANİK İMALATHANE) ---
  {
    id: 'tmpl_iron_plate',
    title: 'Ağır Çelik Levha Siparişi',
    descriptionTemplate: 'Şasi güçlendirmesi için {count} adet Çelik Levha teslim edilmelidir.',
    requiredItemId: 'iron_plate',
    baseCount: 15,
    baseReward: 360,
    timeLimitSec: 140,
    tier: 2,
  },
  {
    id: 'tmpl_copper_wire',
    title: 'Acil Bakır Tel Koşusu',
    descriptionTemplate: 'Bobinaj atölyesi için {count} adet Bakır Tel Bobini gereklidir.',
    requiredItemId: 'copper_wire',
    baseCount: 20,
    baseReward: 300,
    timeLimitSec: 120,
    tier: 2,
  },
  {
    id: 'tmpl_steel_gear',
    title: 'Hassas Dişli Takımı',
    descriptionTemplate: 'Motor aktarma organları için {count} adet Hassas Dişli bekleniyor.',
    requiredItemId: 'steel_gear',
    baseCount: 10,
    baseReward: 420,
    timeLimitSec: 150,
    tier: 2,
  },
  {
    id: 'tmpl_circuit_substrate',
    title: 'Devre Kartı Altlığı',
    descriptionTemplate: 'Elektronik montaj hattı için {count} adet Yalıtkan Kart Tabanı teslim edin.',
    requiredItemId: 'circuit_substrate',
    baseCount: 8,
    baseReward: 400,
    timeLimitSec: 150,
    tier: 2,
  },

  // --- KADEME 3 (MONTAJ TESİSİ) ---
  {
    id: 'tmpl_electric_motor',
    title: 'Yüksek Torklu Motor Partisi',
    descriptionTemplate: 'Konveyör tahrikleri için {count} adet Elektrik Motoru bekleniyor.',
    requiredItemId: 'electric_motor',
    baseCount: 8,
    baseReward: 850,
    timeLimitSec: 180,
    tier: 3,
  },
  {
    id: 'tmpl_optical_sensor',
    title: 'Telemetri Sensör Partisi',
    descriptionTemplate: 'Uçuş kontrol sistemleri için {count} adet Optik Sensör teslim edin.',
    requiredItemId: 'optical_sensor',
    baseCount: 6,
    baseReward: 900,
    timeLimitSec: 180,
    tier: 3,
  },
  {
    id: 'tmpl_microchip',
    title: 'Aviyonik Mikroçip Siparişi',
    descriptionTemplate: 'Uçuş bilgisayarı için {count} adet Aviyonik Mikroçip gereklidir.',
    requiredItemId: 'microchip',
    baseCount: 5,
    baseReward: 1100,
    timeLimitSec: 200,
    tier: 3,
  },
  {
    id: 'tmpl_reinforced_frame',
    title: 'Gövde Çerçeve Sevkiyatı',
    descriptionTemplate: 'Hangar montaj iskelesi için {count} adet Güçlendirilmiş Gövde Çerçevesi gerekiyor.',
    requiredItemId: 'reinforced_frame',
    baseCount: 4,
    baseReward: 1000,
    timeLimitSec: 200,
    tier: 3,
  },

  // --- KADEME 4 (HAVACILIK KOMPLEKSİ) ---
  {
    id: 'tmpl_guidance_computer',
    title: 'Yörünge Güdüm Bilgisayarları',
    descriptionTemplate: 'Fırlatma hazırlığı için {count} adet Güdüm & Navigasyon Bilgisayarı teslim edin.',
    requiredItemId: 'guidance_computer',
    baseCount: 4,
    baseReward: 3200,
    timeLimitSec: 240,
    tier: 4,
  },
  {
    id: 'tmpl_rocket_thruster',
    title: 'Güdümlü İtici Blokları',
    descriptionTemplate: 'Ana fırlatma kademesi için {count} adet Güdümlü Roket İtici Blok gerekiyor.',
    requiredItemId: 'rocket_thruster_block',
    baseCount: 3,
    baseReward: 4200,
    timeLimitSec: 240,
    tier: 4,
  },
  {
    id: 'tmpl_aero_hull',
    title: 'Titanyum Isı Kalkan Panelleri',
    descriptionTemplate: 'Atmosfer dönüş zırhı için {count} adet Aerodinamik Panel bekleniyor.',
    requiredItemId: 'aero_hull_plate',
    baseCount: 4,
    baseReward: 3800,
    timeLimitSec: 240,
    tier: 4,
  },
];

export class ContractManager {
  private itemRegistry: ItemRegistry;
  private templates: readonly ContractTemplate[];

  /** Kabul edilmeye hazır kontrat teklifleri */
  private availableContracts: QuickContract[] = [];

  /** Oyuncunun şu anda yürüttüğü aktif kontratlar */
  private activeContracts: QuickContract[] = [];

  /** Tamamlanan tüm kontrat ID geçmişi */
  private completedContractIds: string[] = [];

  /** Tamamlanan toplam kontrat sayısı */
  private totalCompletedCount = 0;

  /** Kontratlardan kazanılan kümülatif nakit ($) */
  private totalRewardsEarned = 0;

  /** Maksimum teklif havuzu boyutu */
  readonly maxAvailableContracts: number;

  /** Maksimum eşzamanlı aktif kontrat sayısı */
  readonly maxActiveContracts: number;

  /** Sayaç ve benzersiz ID üreteci için sıra numarası */
  private idSequence = 1;

  // Geri bildirim dinleyicileri (Phaser ses veya banner entegrasyonu için)
  onContractCompleted?: (contract: QuickContract) => void;
  onContractFailed?: (contract: QuickContract) => void;
  onContractAccepted?: (contract: QuickContract) => void;

  constructor(
    itemRegistry: ItemRegistry = defaultItemRegistry,
    templates: readonly ContractTemplate[] = CONTRACT_TEMPLATES,
    maxAvailable = 3,
    maxActive = 2,
  ) {
    this.itemRegistry = itemRegistry;
    this.templates = templates;
    this.maxAvailableContracts = maxAvailable;
    this.maxActiveContracts = maxActive;
  }

  // -------------------------------------------------------------
  // ERİŞİM VE DURUM SORGULARI
  // -------------------------------------------------------------

  /** Kabul edilmeye hazır teklifleri döner (salt-okunur kopya) */
  getAvailableContracts(): readonly QuickContract[] {
    return this.availableContracts;
  }

  /** Oyuncunun yürüttüğü aktif kontratları döner (salt-okunur kopya) */
  getActiveContracts(): readonly QuickContract[] {
    return this.activeContracts;
  }

  /** Tamamlanan kontrat ID listesini döner */
  getCompletedContractIds(): readonly string[] {
    return this.completedContractIds;
  }

  /** Tamamlanan toplam kontrat sayısı */
  get completedCount(): number {
    return this.totalCompletedCount;
  }

  /** Kontratlardan kazanılan toplam nakit */
  get cumulativeRewards(): number {
    return this.totalRewardsEarned;
  }

  /** Yeni kontrat kabul edilebilir mi? */
  get canAcceptMore(): boolean {
    return this.activeContracts.length < this.maxActiveContracts;
  }

  /** Belirtilen ID'ye sahip kontratı (aktif veya teklif) döner */
  findContract(contractId: string): QuickContract | undefined {
    return (
      this.activeContracts.find((c) => c.id === contractId) ??
      this.availableContracts.find((c) => c.id === contractId)
    );
  }

  // -------------------------------------------------------------
  // KONTRAT ÜRETİMİ VE TEKLİF YENİLEME
  // -------------------------------------------------------------

  /**
   * Bir şablondan veya parametrelerden yeni bir dinamik kontrat nesnesi üretir.
   */
  generateContract(
    tier: number,
    isUrgent = false,
    forcedTemplateId?: string,
  ): QuickContract | null {
    // Uygun kademedeki şablonları filtrele (tier <= maxTier)
    const eligible = this.templates.filter((t) =>
      forcedTemplateId ? t.id === forcedTemplateId : t.tier <= tier,
    );

    if (eligible.length === 0) return null;

    // Şablon seç
    const tmpl = forcedTemplateId
      ? eligible[0]
      : eligible[Math.floor(Math.random() * eligible.length)];

    const item = this.itemRegistry.get(tmpl.requiredItemId);
    const itemName = item ? item.name : tmpl.requiredItemId;

    // Acil durum çarpanları (Daha kısa süre, daha yüksek ödül)
    const urgentMult = isUrgent ? 1.5 : 1.0;
    const timeMult = isUrgent ? 0.65 : 1.0;

    const count = tmpl.baseCount;
    const rewardCash = Math.round(tmpl.baseReward * urgentMult);
    const timeLimitSec = Math.max(30, Math.round(tmpl.timeLimitSec * timeMult));

    const id = `contract_${tmpl.requiredItemId}_${this.idSequence++}_${Date.now().toString(36)}`;
    const title = isUrgent ? `[ACİL] ${tmpl.title}` : tmpl.title;
    const description = tmpl.descriptionTemplate.replace('{count}', count.toString());

    return {
      id,
      title,
      description,
      requiredItemId: tmpl.requiredItemId,
      itemName,
      requiredCount: count,
      currentCount: 0,
      rewardCash,
      timeLimitSec,
      remainingSec: timeLimitSec,
      tier: tmpl.tier,
      status: 'AVAILABLE',
      isUrgent,
    };
  }

  /**
   * Boşalan teklif yuvalarını oyuncunun açık olan en yüksek kademesine göre yeni kontratlarla doldurur.
   */
  refreshAvailableContracts(playerMaxTier = 1): void {
    while (this.availableContracts.length < this.maxAvailableContracts) {
      // %25 olasılıkla acil kontrat üret
      const isUrgent = Math.random() < 0.25;
      const contract = this.generateContract(playerMaxTier, isUrgent);
      if (!contract) break;

      this.availableContracts.push(contract);
    }
  }

  // -------------------------------------------------------------
  // KONTRAT KABUL, İPTAL VE ZAMAN SAYACI
  // -------------------------------------------------------------

  /**
   * Teklif listesindeki bir kontratı kabul eder ve aktif listeye alır.
   */
  acceptContract(contractId: string): boolean {
    if (!this.canAcceptMore) return false;

    const index = this.availableContracts.findIndex((c) => c.id === contractId);
    if (index === -1) return false;

    const [contract] = this.availableContracts.splice(index, 1);
    contract.status = 'ACTIVE';
    contract.remainingSec = contract.timeLimitSec;
    this.activeContracts.push(contract);

    if (this.onContractAccepted) {
      this.onContractAccepted(contract);
    }

    return true;
  }

  /**
   * Teklif listesindeki bir kontratı reddeder/listeden kaldırır.
   */
  declineContract(contractId: string): boolean {
    const index = this.availableContracts.findIndex((c) => c.id === contractId);
    if (index === -1) return false;

    this.availableContracts.splice(index, 1);
    return true;
  }

  /**
   * Aktif yürütülen bir kontrattan vazgeçer (başarısız sayılır).
   */
  abandonContract(contractId: string): boolean {
    const index = this.activeContracts.findIndex((c) => c.id === contractId);
    if (index === -1) return false;

    const [contract] = this.activeContracts.splice(index, 1);
    contract.status = 'FAILED';

    if (this.onContractFailed) {
      this.onContractFailed(contract);
    }

    return true;
  }

  /**
   * Zaman ilerlemesi (dt saniye): Aktif kontratların kalan sürelerini azaltır.
   * Süresi dolan kontratları FAILED olarak işaretler ve aktif listeden çıkarır.
   */
  update(deltaSec: number): { expiredAvailable: string[]; failedActive: string[] } {
    const failedActive: string[] = [];

    if (deltaSec <= 0) return { expiredAvailable: [], failedActive };

    // Aktif kontratların süresini düşür
    for (let i = this.activeContracts.length - 1; i >= 0; i--) {
      const contract = this.activeContracts[i];
      contract.remainingSec = Math.max(0, contract.remainingSec - deltaSec);

      if (contract.remainingSec <= 0) {
        contract.status = 'FAILED';
        this.activeContracts.splice(i, 1);
        failedActive.push(contract.id);

        if (this.onContractFailed) {
          this.onContractFailed(contract);
        }
      }
    }

    return { expiredAvailable: [], failedActive };
  }

  // -------------------------------------------------------------
  // EŞYA TESLİMATI VE ÖDÜL DAĞITIMI
  // -------------------------------------------------------------

  /**
   * Bir eşya ihraç edildiğinde veya teslim edildiğinde çağrılır.
   * Bu eşyayı bekleyen aktif kontratlara sırayla paylaştırır ve tamamlarsa ödülü cüzdana aktarır.
   */
  recordExport(
    itemId: string,
    count = 1,
    economy?: FactoryEconomy,
  ): ContractDeliveryResult[] {
    if (count <= 0) return [];

    const results: ContractDeliveryResult[] = [];
    let remainingToDeliver = count;

    for (let i = this.activeContracts.length - 1; i >= 0; i--) {
      const contract = this.activeContracts[i];
      if (contract.requiredItemId !== itemId) continue;

      const needed = contract.requiredCount - contract.currentCount;
      if (needed <= 0) continue;

      const deliver = Math.min(needed, remainingToDeliver);
      contract.currentCount += deliver;
      remainingToDeliver -= deliver;

      const completed = contract.currentCount >= contract.requiredCount;
      let rewardEarned = 0;

      if (completed) {
        contract.status = 'COMPLETED';
        rewardEarned = contract.rewardCash;
        this.totalCompletedCount++;
        this.totalRewardsEarned += rewardEarned;
        this.completedContractIds.push(contract.id);

        // Ödülü cüzdana ekle
        if (economy) {
          economy.addMoney(rewardEarned, 'CONTRACT');
        }

        // Aktif listeden çıkar
        this.activeContracts.splice(i, 1);

        if (this.onContractCompleted) {
          this.onContractCompleted(contract);
        }
      }

      results.push({
        contractId: contract.id,
        itemId,
        delivered: deliver,
        requiredCount: contract.requiredCount,
        currentCount: contract.currentCount,
        completed,
        rewardEarned,
      });

      if (remainingToDeliver <= 0) break;
    }

    return results;
  }

  // -------------------------------------------------------------
  // SERİLEŞTİRME VE KAYIT YÖNETİMİ
  // -------------------------------------------------------------

  /** Kontrat yöneticisi durumunu saf JSON'a serileştirir */
  serialize(): ContractSaveData {
    return {
      available: JSON.parse(JSON.stringify(this.availableContracts)),
      active: JSON.parse(JSON.stringify(this.activeContracts)),
      completedContractIds: [...this.completedContractIds],
      totalCompletedCount: this.totalCompletedCount,
      totalRewardsEarned: this.totalRewardsEarned,
    };
  }

  /** Serileştirilmiş durumdan yöneticinin verilerini geri yükler */
  deserialize(data: Partial<ContractSaveData>): void {
    if (data.available && Array.isArray(data.available)) {
      this.availableContracts = JSON.parse(JSON.stringify(data.available));
    }
    if (data.active && Array.isArray(data.active)) {
      this.activeContracts = JSON.parse(JSON.stringify(data.active));
    }
    if (data.completedContractIds && Array.isArray(data.completedContractIds)) {
      this.completedContractIds = [...data.completedContractIds];
    }
    if (typeof data.totalCompletedCount === 'number') {
      this.totalCompletedCount = data.totalCompletedCount;
    }
    if (typeof data.totalRewardsEarned === 'number') {
      this.totalRewardsEarned = data.totalRewardsEarned;
    }
  }

  // -------------------------------------------------------------
  // STATİK UI & FORMAT YARDIMCILARI
  // -------------------------------------------------------------

  /**
   * Kalan süreyi "MM:SS" biçiminde formatlar.
   */
  static formatRemainingTime(seconds: number): string {
    const s = Math.max(0, Math.ceil(seconds));
    const mins = Math.floor(s / 60);
    const secs = s % 60;
    const pad = (n: number) => (n < 10 ? `0${n}` : `${n}`);
    return `${pad(mins)}:${pad(secs)}`;
  }

  /**
   * Kalan süreye göre UI metin rengi döner (Kritik acil: kırmızı, Uyarı: turuncu, Normal: beyaz/yeşil).
   */
  static getTimeColor(remainingSec: number): string {
    if (remainingSec <= 20) return '#e74c3c'; // Danger red
    if (remainingSec <= 60) return '#f39c12'; // Warning orange
    return '#ecf0f1'; // Normal white
  }

  /**
   * İlerleme oranını [0.0 .. 1.0] aralığında döner.
   */
  static getProgressRatio(contract: QuickContract): number {
    if (contract.requiredCount <= 0) return 1.0;
    return Math.min(1.0, Math.max(0, contract.currentCount / contract.requiredCount));
  }
}
