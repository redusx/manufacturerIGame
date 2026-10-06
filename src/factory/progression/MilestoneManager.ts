/* ======================================================================
 * src/factory/progression/MilestoneManager.ts — Fabrika Kilometre Taşları
 *
 * 10 aşamalı kademeli fabrika ilerleme müfredatını, aktif hedef koşullarını,
 * eşya ihracat takiplerini, ödül dağıtımını ve teknoloji/makine kilit açılımlarını
 * yöneten saf TypeScript ilerleme motoru.
 *
 * docs/PROGRESSION.md, docs/GAME_DESIGN.md ve DEC-006 standartlarına uygundur.
 * Node 24 uyumludur; Phaser bağımlılığı yoktur, headless test edilebilir.
 * ====================================================================== */

import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';

export type MilestoneCategory =
  | 'ATELIER'   // Çağ 1: $8x8 Cevher Atölyesi
  | 'FOUNDRY'   // Çağ 2: $12x8 Dökümhane
  | 'WORKSHOP'  // Çağ 3: $16x12 Mekanik İmalathane
  | 'ASSEMBLY'  // Çağ 4: $20x16 Montaj Fabrikası
  | 'AEROSPACE'; // Çağ 5: $24x24 Havacılık ve Uzay Kompleksi

export type MilestoneConditionType =
  | 'EXPORT_SPECIFIC_ITEM'    // Belirli bir eşyadan X adet ihraç et
  | 'TOTAL_EARNED'            // Kümülatif toplam gelire ulaş ($)
  | 'CURRENT_BALANCE'         // Cüzdanda anlık X nakit bulundur ($)
  | 'UNLOCK_PLOT'             // Belirtilen indeksteki arsa parselini aç
  | 'MACHINE_COUNT'           // Fabrikada kurulu toplam X makineye ulaş
  | 'UPGRADE_MACHINE_LEVEL';  // Herhangi bir makineyi X seviyesine yükselt

export interface MilestoneCondition {
  type: MilestoneConditionType;
  targetValue: number;
  targetItemId?: string;
  targetPlotIndex?: number;
  description: string;
}

export interface MilestoneReward {
  money?: number;
  unlockedMachines?: string[];
  unlockedFeatures?: string[];
  revenueMultiplierBonus?: number;
  description: string;
}

export interface MilestoneDefinition {
  id: string;
  index: number; // 0..9
  name: string;
  category: MilestoneCategory;
  tagline: string;
  description?: string;
  conditions: MilestoneCondition[];
  reward: MilestoneReward;
}

export interface ConditionProgress {
  type: MilestoneConditionType;
  description: string;
  current: number;
  target: number;
  percentage: number; // 0.0 .. 1.0
  isMet: boolean;
}

export interface MilestoneProgress {
  milestone: MilestoneDefinition;
  isAllConditionsMet: boolean;
  overallPercentage: number; // 0.0 .. 1.0
  conditions: ConditionProgress[];
}

export interface MilestoneState {
  currentMilestoneIndex: number;
  completedMilestoneIds: string[];
  exportedItemCounts: Record<string, number>;
  unlockedMachineIds: string[];
  unlockedFeatureIds: string[];
}

/**
 * 10 Aşamalı Fabrika Müfredatı (Curriculum Definitions)
 */
export const DEFAULT_MILESTONES: readonly MilestoneDefinition[] = Object.freeze([
  // -------------------------------------------------------------
  // ÇAĞ 1: CEVHER ATÖLYESİ (ORE SHED) — 8x8
  // -------------------------------------------------------------
  {
    id: 'milestone_01_first_ore',
    index: 0,
    name: 'İlk Hammadde',
    category: 'ATELIER',
    tagline: 'Fabrika macerasına ilk adımı at.',
    description: 'Hazır hattın ürettiği demir tozunu satarak $50 toplam ciroya ulaş.',
    conditions: [
      {
        type: 'TOTAL_EARNED',
        targetValue: 50,
        description: '$50 toplam gelire ulaş',
      },
    ],
    reward: {
      money: 100,
      unlockedMachines: ['crusher'],
      unlockedFeatures: ['BASIC_AUTOMATION'],
      description: '$100 ⚙ başlangıç sermayesi',
    },
  },
  {
    id: 'milestone_02_crushed_powder',
    index: 1,
    name: 'Cevher Kırma',
    category: 'ATELIER',
    tagline: 'Cevherleri kırıcıda ince metal tozuna dönüştür.',
    conditions: [
      {
        type: 'EXPORT_SPECIFIC_ITEM',
        targetItemId: 'iron_powder',
        targetValue: 60,
        description: '60 adet Demir Tozu ihraç et',
      },
    ],
    reward: {
      money: 150,
      unlockedMachines: ['smelter'],
      description: '$150 ⚙ sermaye ve Yüksek Sıcaklık Fırını açıldı!',
    },
  },

  // -------------------------------------------------------------
  // ÇAĞ 2: DÖKÜMHANE (THE FOUNDRY) — 12x8
  // -------------------------------------------------------------
  {
    id: 'milestone_03_first_ingot',
    index: 2,
    name: 'İlk Döküm',
    category: 'FOUNDRY',
    tagline: 'Tozları fırında eritip dayanıklı metal külçelerine dönüştür.',
    conditions: [
      {
        type: 'EXPORT_SPECIFIC_ITEM',
        targetItemId: 'iron_ingot',
        targetValue: 30,
        description: '30 adet Demir Külçesi ihraç et',
      },
    ],
    reward: {
      money: 250,
      unlockedFeatures: ['PLOT_1_READY', 'INTAKE_IRON'],
      description: '$250 ⚙, 1. Parsel ($12x8) hazır ve ek Demir Girişi açıldı!',
    },
  },
  {
    id: 'milestone_04_foundry_expansion',
    index: 3,
    name: 'Dökümhane Genişlemesi',
    category: 'FOUNDRY',
    tagline: 'Fabrikanı $12x8 boyutuna büyüt ve yeni üretim hattı kur.',
    conditions: [
      {
        type: 'UNLOCK_PLOT',
        targetPlotIndex: 1,
        targetValue: 1,
        description: '1. Parseli ($12x8) satın al ve aç',
      },
      {
        type: 'TOTAL_EARNED',
        targetValue: 600,
        description: '$600 toplam ciroya ulaş',
      },
    ],
    reward: {
      money: 300,
      unlockedMachines: ['press'],
      description: '$300 ⚙ sermaye ve Hidrolik Pres Makinesi açıldı!',
    },
  },

  // -------------------------------------------------------------
  // ÇAĞ 3: MEKANİK İMALATHANE (THE WORKSHOP) — 16x12
  // -------------------------------------------------------------
  {
    id: 'milestone_05_heavy_plates',
    index: 4,
    name: 'Ağır Levhalar',
    category: 'WORKSHOP',
    tagline: 'Külçeleri presleyerek metal levhalar imal et.',
    conditions: [
      {
        type: 'EXPORT_SPECIFIC_ITEM',
        targetItemId: 'iron_plate',
        targetValue: 40,
        description: '40 adet Demir Levha ihraç et',
      },
    ],
    reward: {
      money: 400,
      unlockedMachines: ['cutter'],
      unlockedFeatures: ['SPLITTER_MERGER'],
      description: '$400 ⚙, Hassas Kesici ve Splitter/Merger lojistiği açıldı!',
    },
  },
  {
    id: 'milestone_06_gears_and_hangar',
    index: 5,
    name: 'Dişliler ve Roket Hangarı',
    category: 'WORKSHOP',
    tagline: 'Kesici ile çelik dişliler üret ve Roket Hangarını faaliyete geçir.',
    conditions: [
      {
        type: 'EXPORT_SPECIFIC_ITEM',
        targetItemId: 'steel_gear',
        targetValue: 40,
        description: '40 adet Çelik Dişli ihraç et',
      },
      {
        type: 'TOTAL_EARNED',
        targetValue: 2500,
        description: '$2,500 toplam ciroya ulaş',
      },
    ],
    reward: {
      money: 1000,
      unlockedFeatures: ['ROCKET_HANGAR', 'INTAKE_COPPER'],
      description: '$1,000 ⚙, ROKET HANGARI ve Bakır Cevheri Girişi açıldı!',
    },
  },

  // -------------------------------------------------------------
  // ÇAĞ 4: MONTAJ FABRİKASI (THE ASSEMBLY PLANT) — 20x16
  // -------------------------------------------------------------
  {
    id: 'milestone_07_assembly_line',
    index: 6,
    name: 'Montaj Hattı',
    category: 'ASSEMBLY',
    tagline: '2. Parseli ($16x12) aç ve çok girişli makinelerle karmaşık parçalar yap.',
    conditions: [
      {
        type: 'UNLOCK_PLOT',
        targetPlotIndex: 2,
        targetValue: 1,
        description: '2. Parseli ($16x12) aç',
      },
      {
        type: 'EXPORT_SPECIFIC_ITEM',
        targetItemId: 'copper_wire',
        targetValue: 40,
        description: '40 adet Bakır Tel ihraç et',
      },
    ],
    reward: {
      money: 1500,
      unlockedMachines: ['assembler'],
      description: '$1,500 ⚙ ve Montaj Tezgahı açıldı!',
    },
  },
  {
    id: 'milestone_08_electric_motor',
    index: 7,
    name: 'Elektrik Motoru',
    category: 'ASSEMBLY',
    tagline: 'Montaj tezgahında dişli ve telleri birleştirerek elektrik motoru üret.',
    conditions: [
      {
        type: 'EXPORT_SPECIFIC_ITEM',
        targetItemId: 'electric_motor',
        targetValue: 30,
        description: '30 adet Elektrik Motoru ihraç et',
      },
      {
        type: 'TOTAL_EARNED',
        targetValue: 8000,
        description: '$8,000 toplam ciroya ulaş',
      },
    ],
    reward: {
      money: 2500,
      unlockedFeatures: ['PLOT_3_READY'],
      description: '$2,500 ⚙ ve 3. Parsel ($20x16) açılışa hazır!',
    },
  },

  // -------------------------------------------------------------
  // ÇAĞ 5: HAVACILIK VE UZAY KOMPLEKSİ (AEROSPACE COMPLEX) — 24x24
  // -------------------------------------------------------------
  {
    id: 'milestone_09_chemical_refinery',
    index: 8,
    name: 'Kimyasal Rafineri',
    category: 'AEROSPACE',
    tagline: '3. Parseli aç ve kimyasal rafineriyle havacılık polimerleri üret.',
    conditions: [
      {
        type: 'UNLOCK_PLOT',
        targetPlotIndex: 3,
        targetValue: 1,
        description: '3. Parseli ($20x16) aç',
      },
      {
        type: 'EXPORT_SPECIFIC_ITEM',
        targetItemId: 'reinforced_frame',
        targetValue: 20,
        description: '20 adet Güçlendirilmiş Çerçeve ihraç et',
      },
    ],
    reward: {
      money: 4000,
      unlockedMachines: ['refinery'],
      unlockedFeatures: ['INTAKE_SILICA', 'INTAKE_POLYMER'],
      description: '$4,000 ⚙, Kimyasal Rafineri, Kum ve Polimer Girişleri açıldı!',
    },
  },
  {
    id: 'milestone_10_orbital_complex',
    index: 9,
    name: 'Yörünge Havacılık Kompleksi',
    category: 'AEROSPACE',
    tagline: 'Mega fabrikayı ($24x24) tamamla ve roket itici blokları ile yörüngeye ulaş!',
    conditions: [
      {
        type: 'UNLOCK_PLOT',
        targetPlotIndex: 4,
        targetValue: 1,
        description: '4. Mega Parseli ($24x24) aç',
      },
      {
        type: 'EXPORT_SPECIFIC_ITEM',
        targetItemId: 'rocket_thruster_block',
        targetValue: 10,
        description: '10 adet Roket İtici Bloğu ihraç et',
      },
      {
        type: 'TOTAL_EARNED',
        targetValue: 40000,
        description: '$40,000 toplam ciroya ulaş',
      },
    ],
    reward: {
      money: 10000,
      revenueMultiplierBonus: 0.5,
      unlockedFeatures: ['ORBITAL_MASTERY'],
      description: '$10,000 ⚙, Kalıcı +%50 Gelir Çarpanı ve Yörünge Şampiyonluğu!',
    },
  },
]);

export class MilestoneManager {
  private readonly milestones: readonly MilestoneDefinition[];
  private currentMilestoneIndex = 0;
  private completedMilestoneIds = new Set<string>();

  /** Kümülatif eşya ihracat sayaçları (itemId -> toplam ihraç adedi) */
  private exportedItemCounts = new Map<string, number>();

  /** Kilitli/açık makineler (başlangıçta crusher açık) */
  private unlockedMachineIds = new Set<string>(['crusher']);

  /** Kilitli/açık özel oyun özellikleri */
  private unlockedFeatureIds = new Set<string>();

  constructor(milestones: readonly MilestoneDefinition[] = DEFAULT_MILESTONES) {
    this.milestones = milestones;
  }

  // -------------------------------------------------------------
  // SORGULAR VE DURUM
  // -------------------------------------------------------------

  /** Mevcut aktif hedef kilometre taşını döner (hepsi bittiyse null) */
  getCurrentMilestone(): MilestoneDefinition | null {
    if (this.currentMilestoneIndex >= this.milestones.length) {
      return null;
    }
    return this.milestones[this.currentMilestoneIndex];
  }

  /** İndeks numarasıyla belirli bir kilometre taşını döner */
  getMilestone(index: number): MilestoneDefinition | undefined {
    return this.milestones[index];
  }

  /** Toplam kilometre taşı sayısı */
  get totalCount(): number {
    return this.milestones.length;
  }

  /** Tamamlanan kilometre taşı sayısı */
  get completedCount(): number {
    return this.completedMilestoneIds.size;
  }

  /** Tüm hedefler tamamlandı mı? */
  get isAllCompleted(): boolean {
    return this.currentMilestoneIndex >= this.milestones.length;
  }

  /** Belirtilen kilometre taşı daha önce tamamlanmış mı? */
  isMilestoneCompleted(milestoneId: string): boolean {
    return this.completedMilestoneIds.has(milestoneId);
  }

  /** Bir makine türü kilitli mi açık mı? */
  isMachineUnlocked(defId: string): boolean {
    return this.unlockedMachineIds.has(defId);
  }

  /** Bir oyun özelliği açık mı? (örn: 'ROCKET_HANGAR') */
  isFeatureUnlocked(featureId: string): boolean {
    return this.unlockedFeatureIds.has(featureId);
  }

  /** Makineyi açan aşamanın sıra numarası (1'den başlar); baştan açıksa veya hiç açılmıyorsa null */
  getMachineUnlockStage(defId: string): number | null {
    return this.findUnlockStage((reward) => reward.unlockedMachines?.includes(defId) ?? false);
  }

  /** Özelliği açan aşamanın sıra numarası (1'den başlar); hiçbir aşama açmıyorsa null */
  getFeatureUnlockStage(featureId: string): number | null {
    return this.findUnlockStage((reward) => reward.unlockedFeatures?.includes(featureId) ?? false);
  }

  private findUnlockStage(grants: (reward: MilestoneReward) => boolean): number | null {
    const milestone = this.milestones.find((m) => grants(m.reward));
    return milestone ? milestone.index + 1 : null;
  }

  /** Belirli bir eşyanın şu ana kadarki kümülatif ihracat sayısını döner */
  getExportedCount(itemId: string): number {
    return this.exportedItemCounts.get(itemId) || 0;
  }

  // -------------------------------------------------------------
  // İLERLEME VE TAMAMLANMA DENETİMİ
  // -------------------------------------------------------------

  /**
   * Tekil bir koşulun ilerleme durumunu ve karşılanıp karşılanmadığını hesaplar.
   */
  getConditionProgress(
    condition: MilestoneCondition,
    economy: FactoryEconomy,
    engine?: ProductionEngine,
  ): ConditionProgress {
    let current = 0;
    const target = condition.targetValue;

    switch (condition.type) {
      case 'EXPORT_SPECIFIC_ITEM':
        if (condition.targetItemId) {
          current = this.getExportedCount(condition.targetItemId);
        }
        break;

      case 'TOTAL_EARNED':
        current = economy.totalEarned;
        break;

      case 'CURRENT_BALANCE':
        current = economy.money;
        break;

      case 'UNLOCK_PLOT':
        if (condition.targetPlotIndex !== undefined) {
          current = economy.isPlotUnlocked(condition.targetPlotIndex) ? 1 : 0;
        }
        break;

      case 'MACHINE_COUNT':
        if (engine) {
          current = engine.machineCount;
        }
        break;

      case 'UPGRADE_MACHINE_LEVEL':
        if (engine) {
          let maxLvl = 1;
          for (const m of engine.getAllMachines()) {
            const lvl = engine.getMachineLevel(m.instanceId);
            if (lvl > maxLvl) maxLvl = lvl;
          }
          current = maxLvl;
        }
        break;
    }

    const percentage = target > 0 ? Math.min(1.0, Math.max(0.0, current / target)) : 1.0;
    const isMet = current >= target;

    return {
      type: condition.type,
      description: condition.description,
      current,
      target,
      percentage,
      isMet,
    };
  }

  /**
   * Aktif kilometre taşının genel ilerleme durumunu hesaplar.
   */
  getCurrentProgress(
    economy: FactoryEconomy,
    engine?: ProductionEngine,
  ): MilestoneProgress | null {
    const milestone = this.getCurrentMilestone();
    if (!milestone) return null;

    const conditionProgresses = milestone.conditions.map((cond) =>
      this.getConditionProgress(cond, economy, engine),
    );

    const isAllConditionsMet = conditionProgresses.every((c) => c.isMet);
    const overallPercentage =
      conditionProgresses.reduce((acc, c) => acc + c.percentage, 0) /
      Math.max(1, conditionProgresses.length);

    return {
      milestone,
      isAllConditionsMet,
      overallPercentage,
      conditions: conditionProgresses,
    };
  }

  /**
   * Aktif kilometre taşı tamamlanmaya hazır mı?
   */
  canClaimCurrentMilestone(
    economy: FactoryEconomy,
    engine?: ProductionEngine,
  ): boolean {
    const progress = this.getCurrentProgress(economy, engine);
    return progress !== null && progress.isAllConditionsMet;
  }

  // -------------------------------------------------------------
  // EYLEM VE ÖDÜL DAĞITIMI (RECORD & CLAIM)
  // -------------------------------------------------------------

  /**
   * İhracat sandığına veya manuel satışa giden bir eşyayı kaydeder.
   */
  recordExport(itemId: string, count = 1): void {
    if (count <= 0) return;
    const current = this.exportedItemCounts.get(itemId) || 0;
    this.exportedItemCounts.set(itemId, current + count);
  }

  /**
   * Aktif kilometre taşını onaylar, ödüllerini dağıtır ve bir sonraki aşamaya geçer.
   */
  claimCurrentMilestone(
    economy: FactoryEconomy,
    engine?: ProductionEngine,
  ): {
    success: boolean;
    claimedMilestone?: MilestoneDefinition;
    reward?: MilestoneReward;
    nextMilestone?: MilestoneDefinition | null;
    error?: string;
  } {
    const milestone = this.getCurrentMilestone();
    if (!milestone) {
      return { success: false, error: 'Tüm hedefler zaten tamamlandı.' };
    }

    if (!this.canClaimCurrentMilestone(economy, engine)) {
      return { success: false, error: 'Hedef koşulları henüz sağlanmadı.' };
    }

    // 1. Ödülleri Dağıt
    const reward = milestone.reward;
    if (reward.money && reward.money > 0) {
      economy.addMoney(reward.money, 'CONTRACT');
    }

    if (reward.revenueMultiplierBonus && reward.revenueMultiplierBonus > 0) {
      economy.revenueMultiplier += reward.revenueMultiplierBonus;
    }

    if (reward.unlockedMachines) {
      for (const mId of reward.unlockedMachines) {
        this.unlockedMachineIds.add(mId);
      }
    }

    if (reward.unlockedFeatures) {
      for (const fId of reward.unlockedFeatures) {
        this.unlockedFeatureIds.add(fId);
      }
    }

    // 2. Tamamlandı Olarak İşaretle
    this.completedMilestoneIds.add(milestone.id);
    this.currentMilestoneIndex++;

    const nextMilestone = this.getCurrentMilestone();

    return {
      success: true,
      claimedMilestone: milestone,
      reward,
      nextMilestone,
    };
  }

  // -------------------------------------------------------------
  // SERİLEŞTİRME (SAVE & LOAD)
  // -------------------------------------------------------------

  serialize(): MilestoneState {
    const counts: Record<string, number> = {};
    for (const [key, val] of this.exportedItemCounts.entries()) {
      counts[key] = val;
    }

    return {
      currentMilestoneIndex: this.currentMilestoneIndex,
      completedMilestoneIds: Array.from(this.completedMilestoneIds),
      exportedItemCounts: counts,
      unlockedMachineIds: Array.from(this.unlockedMachineIds),
      unlockedFeatureIds: Array.from(this.unlockedFeatureIds),
    };
  }

  deserialize(state: MilestoneState): void {
    if (!state) return;

    this.currentMilestoneIndex = state.currentMilestoneIndex ?? 0;
    this.completedMilestoneIds = new Set(state.completedMilestoneIds || []);

    this.exportedItemCounts.clear();
    if (state.exportedItemCounts) {
      for (const [key, val] of Object.entries(state.exportedItemCounts)) {
        this.exportedItemCounts.set(key, val);
      }
    }

    // Kırıcı her zaman açıktır (boş listeyle gelen yeni oyun kaydı onu kilitlemesin)
    this.unlockedMachineIds = new Set(['crusher', ...(state.unlockedMachineIds ?? [])]);
    this.unlockedFeatureIds = new Set(state.unlockedFeatureIds || []);
  }
}
