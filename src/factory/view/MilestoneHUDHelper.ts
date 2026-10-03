/* ======================================================================
 * src/factory/view/MilestoneHUDHelper.ts — Kilometre Taşı HUD Yardımcısı
 *
 * Ekranın üst kısmında yer alan Milestone HUD barının metin formatlamasını,
 * çağ rozetlerini, ilerleme yüzdesi hesaplamalarını ve ödül özetlerini
 * yöneten saf TypeScript yardımcı motoru.
 *
 * Node 24 uyumludur; Phaser bağımlılığı yoktur, headless test edilebilir.
 * ====================================================================== */

import {
  MilestoneManager,
  type MilestoneDefinition,
  type MilestoneReward,
  type MilestoneProgress,
  type ConditionProgress,
} from '../progression/MilestoneManager.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';

export interface MilestoneHUDViewModel {
  /** HUD gösterilmeli mi? */
  isActive: boolean;
  /** Tüm müfredat tamamlandı mı? */
  isAllCompleted: boolean;
  /** Çağ ve aşama etiketi (örn: "AŞAMA 1/10 • ÇAĞ 1 (ATÖLYE)") */
  stageBadgeText: string;
  /** Kilometre taşı adı (örn: "İlk Hammadde") */
  titleText: string;
  /** Aktif hedef ve ilerleme metni (örn: "Demir Tozu İhracatı: 14 / 20 (%70)") */
  conditionText: string;
  /** Ödül önizleme metni (örn: "Ödül: +$300 ⚙, Yüksek Sıcaklık Fırını") */
  rewardText: string;
  /** İlerleme çubuğu oranı (0.0 .. 1.0) */
  progressRatio: number;
  /** Yüzdelik metin (örn: "%70") */
  progressPercentText: string;
  /** Ödül talep edilebilir mi? */
  canClaim: boolean;
  /** Talep butonu metni (örn: "ÖDÜLÜ AL!" veya "DEVAM ET") */
  claimButtonText: string;
}

export class MilestoneHUDHelper {
  /**
   * Kategori kodunu Türkçe çağ adına dönüştürür.
   */
  static getCategoryDisplayName(category: string): string {
    switch (category) {
      case 'ATELIER':
        return 'ÇAĞ 1 (ATÖLYE)';
      case 'FOUNDRY':
        return 'ÇAĞ 2 (DÖKÜMHANE)';
      case 'WORKSHOP':
        return 'ÇAĞ 3 (İMALATHANE)';
      case 'ASSEMBLY':
        return 'ÇAĞ 4 (MONTAJ)';
      case 'AEROSPACE':
        return 'ÇAĞ 5 (HAVACILIK)';
      default:
        return category;
    }
  }

  /**
   * Aşama ve çağ rozet metnini oluşturur (örn: "AŞAMA 1/10 • ÇAĞ 1 (ATÖLYE)").
   */
  static formatStageBadge(index: number, total: number, category: string): string {
    const eraName = this.getCategoryDisplayName(category);
    return `AŞAMA ${index + 1}/${total} • ${eraName}`;
  }

  /**
   * Sayısal para tutarını görsel formata dönüştürür ($150 ⚙).
   */
  static formatMoney(amount: number): string {
    if (amount >= 1_000_000) {
      return `$${(amount / 1_000_000).toFixed(2)}M ⚙`;
    }
    if (amount >= 10_000) {
      return `$${(amount / 1_000).toFixed(1)}k ⚙`;
    }
    return `$${amount} ⚙`;
  }

  /**
   * Koşul ilerlemesini kullanıcı dostu tek satırlık özete dönüştürür.
   */
  static formatConditionSummary(progress: MilestoneProgress): string {
    const conditions = progress.conditions;
    if (conditions.length === 0) return 'Hedef belirlenmedi.';

    if (conditions.length === 1) {
      const c = conditions[0];
      const pct = Math.round(c.percentage * 100);
      if (c.type === 'TOTAL_EARNED' || c.type === 'CURRENT_BALANCE') {
        return `${c.description}: ${this.formatMoney(c.current)} / ${this.formatMoney(c.target)} (%${pct})`;
      }
      return `${c.description}: ${c.current} / ${c.target} (%${pct})`;
    }

    // Çoklu koşullar için kompakt gösterim
    return conditions
      .map((c) => {
        const pct = Math.round(c.percentage * 100);
        return `${c.description} (%${pct})`;
      })
      .join(' • ');
  }

  /**
   * Ödül içeriğini kısa özete dönüştürür.
   */
  static formatRewardSummary(reward: MilestoneReward): string {
    const parts: string[] = [];

    if (reward.money && reward.money > 0) {
      parts.push(`+${this.formatMoney(reward.money)}`);
    }

    if (reward.revenueMultiplierBonus && reward.revenueMultiplierBonus > 0) {
      parts.push(`+${Math.round(reward.revenueMultiplierBonus * 100)}% Gelir`);
    }

    if (reward.unlockedMachines && reward.unlockedMachines.length > 0) {
      const names = reward.unlockedMachines.map((m) => {
        switch (m) {
          case 'crusher': return 'Kırıcı';
          case 'smelter': return 'Fırın';
          case 'press': return 'Pres';
          case 'cutter': return 'Kesici';
          case 'assembler': return 'Montaj Tezgahı';
          case 'refinery': return 'Rafineri';
          default: return m;
        }
      });
      parts.push(...names);
    }

    if (reward.unlockedFeatures && reward.unlockedFeatures.length > 0) {
      const features = reward.unlockedFeatures.map((f) => {
        switch (f) {
          case 'ROCKET_HANGAR': return 'Roket Hangarı';
          case 'SPLITTER_MERGER': return 'Splitter/Merger';
          case 'ORBITAL_MASTERY': return 'Yörünge Başarısı';
          default: return f;
        }
      });
      parts.push(...features);
    }

    return parts.length > 0 ? `Ödül: ${parts.join(', ')}` : reward.description;
  }

  /**
   * Ödül hazır olduğunda butonun nabız (pulse) şeffaflık çarpanını hesaplar.
   */
  static computePulseAlpha(
    timeSec: number,
    minAlpha = 0.55,
    maxAlpha = 1.0,
    freqHz = 2.0,
  ): number {
    const sin = Math.sin(timeSec * Math.PI * 2 * freqHz);
    const norm = (sin + 1) / 2; // 0..1
    return minAlpha + norm * (maxAlpha - minAlpha);
  }

  /**
   * Milestone HUD'ın anlık çizim modeli (ViewModel) üretir.
   */
  static getViewModel(
    manager: MilestoneManager,
    economy: FactoryEconomy,
    engine?: ProductionEngine,
  ): MilestoneHUDViewModel {
    if (manager.isAllCompleted) {
      return {
        isActive: true,
        isAllCompleted: true,
        stageBadgeText: `AŞAMA ${manager.totalCount}/${manager.totalCount} • UZAY ÇAĞI`,
        titleText: 'Yörünge Havacılık Kompleksi',
        conditionText: 'Tüm fabrika ve uzay hedefleri tamamlandı!',
        rewardText: 'Ödül: Kalıcı +%50 Gelir & Yörünge Şampiyonluğu',
        progressRatio: 1.0,
        progressPercentText: '%100',
        canClaim: false,
        claimButtonText: 'TAMAMLANDI',
      };
    }

    const currentProgress = manager.getCurrentProgress(economy, engine);
    const milestone = manager.getCurrentMilestone();

    if (!milestone || !currentProgress) {
      return {
        isActive: false,
        isAllCompleted: false,
        stageBadgeText: '',
        titleText: '',
        conditionText: '',
        rewardText: '',
        progressRatio: 0,
        progressPercentText: '%0',
        canClaim: false,
        claimButtonText: '',
      };
    }

    const canClaim = currentProgress.isAllConditionsMet;
    const progressRatio = Math.min(1.0, Math.max(0.0, currentProgress.overallPercentage));
    const progressPercentText = `%${Math.round(progressRatio * 100)}`;

    return {
      isActive: true,
      isAllCompleted: false,
      stageBadgeText: this.formatStageBadge(
        milestone.index,
        manager.totalCount,
        milestone.category,
      ),
      titleText: milestone.name,
      conditionText: this.formatConditionSummary(currentProgress),
      rewardText: this.formatRewardSummary(milestone.reward),
      progressRatio,
      progressPercentText,
      canClaim,
      claimButtonText: canClaim ? 'ÖDÜLÜ AL!' : progressPercentText,
    };
  }
}
