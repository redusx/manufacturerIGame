/* ======================================================================
 * src/ui/RocketHangarHelper.ts — Roket Hangarı Görsel & ViewModel Yardımcısı
 *
 * Roket hangarı modalının fiziksel fabrika parçaları gereksinimlerini,
 * cüzdan sermayesini ve hangar stok durumunu formatlayan saf TypeScript yardımcı modülü.
 * (docs/DECISIONS.md DEC-009, TASK-111)
 *
 * Saf TypeScript — Node 24 native test koşucusu ile %100 uyumludur; Phaser bağımlılığı yoktur.
 * ====================================================================== */

import type {
  RocketModuleCategory,
  RocketPartRequirement,
  RocketModuleUpgradeCost,
  RocketHangarBridge,
} from '../factory/simulation/RocketHangarBridge.ts';
import type { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';
import { PALETTE } from './theme.ts';

export interface RocketUpgradeCardViewModel {
  category: RocketModuleCategory;
  name: string;
  level: number;
  maxLevel: number;
  isMax: boolean;
  levelText: string;
  statText: string;
  btnText: string;
  costText: string;
  partsDetailText: string;
  canAfford: boolean;
  hasEnoughParts: boolean;
  hasEnoughCash: boolean;
  btnTexture: 'btn_green_normal' | 'btn_disabled';
  textColor: string;
  isQuickBuild?: boolean;
}

export class RocketHangarHelper {
  /**
   * Bir parçanın gereksinim ve mevcut stok durumunu metne dönüştürür.
   * Örnek: "Gövde Çerçevesi: 3/5 (Eksik: 2)" veya "Gövde Çerçevesi: 5/5 ✓"
   */
  static formatPartRequirement(req: RocketPartRequirement, currentStock: number): string {
    const isMet = currentStock >= req.count;
    if (isMet) {
      return `${req.itemName}: ${currentStock}/${req.count} ✓`;
    }
    const missing = req.count - currentStock;
    return `${req.itemName}: ${currentStock}/${req.count} (Eksik: ${missing})`;
  }

  /**
   * Modül yükseltmesinin nakit ve parça gereksinimlerini kompakt şekilde formatlar.
   * Örnek: "$500 + 5x Çerçeve [3/5]"
   */
  static formatCostAndPartsSummary(
    cost: RocketModuleUpgradeCost,
    bridge: RocketHangarBridge,
  ): { cashText: string; partsSummary: string; canAffordParts: boolean } {
    const cashText = `$${cost.cashCost.toLocaleString()}`;

    let canAffordParts = true;
    const partsTokens: string[] = [];

    for (const req of cost.requiredParts) {
      const stock = bridge.getPartCount(req.itemId);
      if (stock < req.count) {
        canAffordParts = false;
      }
      partsTokens.push(`${req.count}x ${req.itemName} [${stock}/${req.count}]`);
    }

    const partsSummary = partsTokens.join(' + ');

    return {
      cashText,
      partsSummary,
      canAffordParts,
    };
  }

  /**
   * Hangarda depolanan kritik havacılık parçalarının özetini üst bilgi için formatlar.
   */
  static formatHangarStockHeader(bridge: RocketHangarBridge): string {
    const inv = bridge.getInventory();
    const keys = Object.keys(inv);
    if (keys.length === 0) {
      return 'Hangar Stoğu: Henüz havacılık parçası teslim edilmedi';
    }

    const nameMap: Record<string, string> = {
      reinforced_frame: 'Çerçeve',
      aero_hull_plate: 'Titanyum Panel',
      electric_motor: 'Motor',
      rocket_thruster_block: 'İtici Blok',
      microchip: 'Mikroçip',
      guidance_computer: 'Güdüm Bilgisayarı',
      plastic_pellet: 'Nitro Pelet',
      optical_sensor: 'Sensör',
      steel_gear: 'Dişli',
    };

    const parts: string[] = [];
    for (const [itemId, count] of Object.entries(inv)) {
      if (count > 0) {
        const shortName = nameMap[itemId] || itemId;
        parts.push(`${shortName}: ${count}`);
      }
    }

    return parts.length > 0
      ? `Hangar Stoğu: ${parts.join(' | ')}`
      : 'Hangar Stoğu: Boş';
  }

  /**
   * Belirtilen kategori için kartın tam durum ViewModel'ini üretir.
   */
  static getCardViewModel(
    category: RocketModuleCategory,
    name: string,
    bridge: RocketHangarBridge,
    economy: FactoryEconomy | { canAfford(cost: number): boolean; money: number },
    statText: string,
    maxLevel = 3,
    allowQuickBuild = false,
  ): RocketUpgradeCardViewModel {
    const level = bridge.getModuleLevel(category);
    const isMax = level >= maxLevel;

    if (isMax) {
      return {
        category,
        name,
        level,
        maxLevel,
        isMax: true,
        levelText: 'MAKSİMUM',
        statText,
        btnText: 'TAMAMLANDI',
        costText: '',
        partsDetailText: 'Tüm kademeler monte edildi',
        canAfford: false,
        hasEnoughParts: true,
        hasEnoughCash: true,
        btnTexture: 'btn_disabled',
        textColor: PALETTE.textMuted,
      };
    }

    const cost = bridge.getUpgradeCost(category);
    if (!cost) {
      return {
        category,
        name,
        level,
        maxLevel,
        isMax: true,
        levelText: 'MAKS',
        statText,
        btnText: 'MAKS',
        costText: '',
        partsDetailText: '',
        canAfford: false,
        hasEnoughParts: true,
        hasEnoughCash: true,
        btnTexture: 'btn_disabled',
        textColor: PALETTE.textMuted,
      };
    }

    const { cashText, partsSummary, canAffordParts } = this.formatCostAndPartsSummary(cost, bridge);
    const hasEnoughCash = economy.canAfford(cost.cashCost);
    const totalQuickBuildCost = bridge.getTotalUpgradeCostWithMissingParts(category);
    const canQuickBuild = allowQuickBuild && !canAffordParts && economy.canAfford(totalQuickBuildCost);

    const canAfford = (hasEnoughCash && canAffordParts) || canQuickBuild;

    const levelText = `Sv. ${level}/${maxLevel}`;
    let btnText: string;
    let costText: string;

    if (canAffordParts && hasEnoughCash) {
      btnText = 'İNŞA ET';
      costText = cashText;
    } else if (canQuickBuild) {
      btnText = 'HIZLI İNŞA';
      costText = `$${totalQuickBuildCost.toLocaleString()}`;
    } else if (!hasEnoughCash) {
      btnText = 'EKSİK MALZEME';
      costText = allowQuickBuild ? `$${totalQuickBuildCost.toLocaleString()}` : cashText;
    } else {
      btnText = 'EKSİK MALZEME';
      costText = cashText;
    }

    const partsDetailText = partsSummary;

    return {
      category,
      name,
      level,
      maxLevel,
      isMax: false,
      levelText,
      statText,
      btnText,
      costText,
      partsDetailText,
      canAfford,
      hasEnoughParts: canAffordParts,
      hasEnoughCash,
      btnTexture: canAfford ? 'btn_green_normal' : 'btn_disabled',
      textColor: canAfford ? PALETTE.btnAffordableText : PALETTE.btnDisabledText,
      isQuickBuild: canQuickBuild,
    };
  }
}
