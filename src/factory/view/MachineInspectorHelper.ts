/* ======================================================================
 * src/factory/view/MachineInspectorHelper.ts — Makine İnceleme ve Geliştirme Mantığı
 *
 * Tıklanan makinenin durumunu, girdi/çıktı tamponlarını, aktif ve seçilebilir
 * reçetelerini, seviye yükseltme ($Base * 1.15^lvl) maliyetini, hız çarpanlarını
 * ve tam sermaye iadesi hesaplamalarını yöneten saf TypeScript yardımcı motoru.
 *
 * Node 24 uyumludur; Phaser bağımlılığı yoktur, headless test edilebilir.
 * ====================================================================== */

import type {
  MachineOperationalStatus,
  RecipeCategory,
  RecipeDefinition,
} from '../types.ts';
import { ItemRegistry, defaultItemRegistry } from '../simulation/ItemRegistry.ts';
import { RecipeRegistry, defaultRecipeRegistry } from '../simulation/RecipeRegistry.ts';
import { MachineEntity } from '../simulation/MachineEntity.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { PALETTE } from '../../ui/theme.ts';

export interface InspectorBufferItem {
  itemId: string;
  name: string;
  count: number;
  capacity: number;
  percentage: number; // 0.0 to 1.0
}

export interface InspectorRecipeInfo {
  recipeId: string;
  name: string;
  processingTimeSec: number;
  inputs: { itemId: string; name: string; count: number }[];
  outputs: { itemId: string; name: string; count: number }[];
  isActive: boolean;
}

export interface MachineInspectorData {
  instanceId: string;
  defId: string;
  name: string;
  category: RecipeCategory;
  level: number;
  status: MachineOperationalStatus;
  statusLabel: string;
  statusColorHex: string;
  statusColorInt: number;
  progressSec: number;
  processingTimeSec: number;
  progressRatio: number; // 0.0 to 1.0
  speedMultiplier: number;
  nextSpeedMultiplier: number;
  speedDiffText: string;
  upgradeCost: number;
  canAffordUpgrade: boolean;
  activeRecipeId: string | null;
  activeRecipeName: string;
  availableRecipes: InspectorRecipeInfo[];
  inputBuffers: InspectorBufferItem[];
  outputBuffers: InspectorBufferItem[];
  demolishRefund: number;
}

export interface UpgradeResult {
  success: boolean;
  newLevel: number;
  cost: number;
  newSpeedMultiplier: number;
  error?: string;
}

export class MachineInspectorHelper {
  /**
   * Durum koduna göre Türkçe etiket, hex rengi ve Phaser renk tamsayısını döner.
   */
  static getStatusMeta(status: MachineOperationalStatus): {
    label: string;
    colorHex: string;
    colorInt: number;
  } {
    switch (status) {
      case 'PROCESSING':
        return {
          label: 'Çalışıyor',
          colorHex: PALETTE.successGreenHex,
          colorInt: PALETTE.successGreen,
        };
      case 'WAITING_INPUT':
        return {
          label: 'Girdi Bekliyor',
          colorHex: PALETTE.warningOrangeHex,
          colorInt: PALETTE.warningOrange,
        };
      case 'BLOCKED_OUTPUT':
        return {
          label: 'Çıkış Tıkalı',
          colorHex: PALETTE.dangerRedHex,
          colorInt: PALETTE.dangerRed,
        };
      case 'IDLE':
      default:
        return {
          label: 'Boşta / Bekliyor',
          colorHex: PALETTE.textMuted,
          colorInt: 0x8c9bb3,
        };
    }
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
   * Hız çarpanını formatlar (örn: x1.20).
   */
  static formatSpeed(multiplier: number): string {
    return `x${multiplier.toFixed(2)}`;
  }

  /**
   * Tampon oran metnini biçimlendirir (örn: 4/10).
   */
  static formatBufferRatio(count: number, capacity: number): string {
    return `${count} / ${capacity}`;
  }

  /**
   * Bir makinenin tüm durum verilerini tek bir arayüz veri nesnesinde toplar.
   */
  static inspect(
    machine: MachineEntity,
    engine: ProductionEngine,
    economy: FactoryEconomy,
    recipeRegistry: RecipeRegistry = defaultRecipeRegistry,
    itemRegistry: ItemRegistry = defaultItemRegistry,
  ): MachineInspectorData {
    const level = engine.getMachineLevel(machine.instanceId);
    const speedMultiplier = engine.getSpeedMultiplier(machine.instanceId);
    const nextSpeedMultiplier = 1.0 + level * 0.2; // Seviye+1 çarpanı
    const upgradeCost = economy.getMachineUpgradeCost(machine.def.baseCost, level);
    const canAffordUpgrade = economy.canAfford(upgradeCost);

    // Durum bilgisi
    const statusMeta = this.getStatusMeta(machine.status);

    // Aktif Reçete bilgileri
    let activeRecipeName = 'Reçete Yok';
    let processingTimeSec = 1.0;
    if (machine.activeRecipeId) {
      const activeRecipe = recipeRegistry.get(machine.activeRecipeId);
      if (activeRecipe) {
        activeRecipeName = activeRecipe.name;
        processingTimeSec = activeRecipe.processingTimeSec;
      }
    }

    const progressRatio = processingTimeSec > 0
      ? Math.min(1.0, Math.max(0.0, machine.progressSec / processingTimeSec))
      : 0.0;

    // Desteklenen Reçeteler
    const availableRecipes: InspectorRecipeInfo[] = machine.def.supportedRecipeIds.map((rId) => {
      const rec = recipeRegistry.get(rId);
      if (!rec) {
        return {
          recipeId: rId,
          name: rId,
          processingTimeSec: 1,
          inputs: [],
          outputs: [],
          isActive: machine.activeRecipeId === rId,
        };
      }

      return {
        recipeId: rec.id,
        name: rec.name,
        processingTimeSec: rec.processingTimeSec,
        inputs: rec.inputs.map((inp) => ({
          itemId: inp.itemId,
          name: itemRegistry.get(inp.itemId)?.name || inp.itemId,
          count: inp.count,
        })),
        outputs: rec.outputs.map((out) => ({
          itemId: out.itemId,
          name: itemRegistry.get(out.itemId)?.name || out.itemId,
          count: out.count,
        })),
        isActive: machine.activeRecipeId === rec.id,
      };
    });

    // Girdi Tamponları
    const inputBuffers: InspectorBufferItem[] = [];
    const inCap = machine.def.inputBufferCapacity;
    const inputSnapshot = machine.getInputBufferSnapshot();

    // Aktif reçetenin beklediği girdileri ve tamponda halihazırda bulunanları topla
    const trackedInputItemIds = new Set<string>();
    if (machine.activeRecipeId) {
      const activeRec = recipeRegistry.get(machine.activeRecipeId);
      if (activeRec) {
        activeRec.inputs.forEach((i) => trackedInputItemIds.add(i.itemId));
      }
    }
    Object.keys(inputSnapshot).forEach((id) => trackedInputItemIds.add(id));

    trackedInputItemIds.forEach((itemId) => {
      const count = machine.getInputCount(itemId);
      const itemName = itemRegistry.get(itemId)?.name || itemId;
      inputBuffers.push({
        itemId,
        name: itemName,
        count,
        capacity: inCap,
        percentage: inCap > 0 ? Math.min(1.0, count / inCap) : 0,
      });
    });

    // Çıktı Tamponları
    const outputBuffers: InspectorBufferItem[] = [];
    const outCap = machine.def.outputBufferCapacity;
    const outputSnapshot = machine.getOutputBufferSnapshot();

    const trackedOutputItemIds = new Set<string>();
    if (machine.activeRecipeId) {
      const activeRec = recipeRegistry.get(machine.activeRecipeId);
      if (activeRec) {
        activeRec.outputs.forEach((o) => trackedOutputItemIds.add(o.itemId));
      }
    }
    Object.keys(outputSnapshot).forEach((id) => trackedOutputItemIds.add(id));

    trackedOutputItemIds.forEach((itemId) => {
      const count = machine.getOutputCount(itemId);
      const itemName = itemRegistry.get(itemId)?.name || itemId;
      outputBuffers.push({
        itemId,
        name: itemName,
        count,
        capacity: outCap,
        percentage: outCap > 0 ? Math.min(1.0, count / outCap) : 0,
      });
    });

    // İade: söküm yalnızca makineye yapılan yatırımı geri öder (tampondaki eşyalar ödenmez).
    // Burada gösterilen tutar DemolishMath'in gerçekten ödediği tutarla aynı olmalıdır.
    const demolishRefund = economy.getTotalMachineInvestment(machine.def.baseCost, level);

    return {
      instanceId: machine.instanceId,
      defId: machine.defId,
      name: machine.def.name,
      category: machine.def.category,
      level,
      status: machine.status,
      statusLabel: statusMeta.label,
      statusColorHex: statusMeta.colorHex,
      statusColorInt: statusMeta.colorInt,
      progressSec: machine.progressSec,
      processingTimeSec,
      progressRatio,
      speedMultiplier,
      nextSpeedMultiplier,
      speedDiffText: `${this.formatSpeed(speedMultiplier)} -> ${this.formatSpeed(nextSpeedMultiplier)} (+%20 Hız)`,
      upgradeCost,
      canAffordUpgrade,
      activeRecipeId: machine.activeRecipeId,
      activeRecipeName,
      availableRecipes,
      inputBuffers,
      outputBuffers,
      demolishRefund,
    };
  }

  /**
   * Makineyi 1 seviye yükseltir, parayı cüzdandan düşer.
   */
  static performUpgrade(
    machine: MachineEntity,
    engine: ProductionEngine,
    economy: FactoryEconomy,
  ): UpgradeResult {
    const currentLevel = engine.getMachineLevel(machine.instanceId);
    const cost = economy.getMachineUpgradeCost(machine.def.baseCost, currentLevel);

    if (!economy.canAfford(cost)) {
      return {
        success: false,
        newLevel: currentLevel,
        cost,
        newSpeedMultiplier: engine.getSpeedMultiplier(machine.instanceId),
        error: 'Yetersiz Bakiye',
      };
    }

    const spent = economy.spendMoney(cost);
    if (!spent) {
      return {
        success: false,
        newLevel: currentLevel,
        cost,
        newSpeedMultiplier: engine.getSpeedMultiplier(machine.instanceId),
        error: 'Ödeme Gerçekleştirilemedi',
      };
    }

    const newLevel = engine.upgradeMachine(machine.instanceId);
    const newSpeedMultiplier = engine.getSpeedMultiplier(machine.instanceId);

    return {
      success: true,
      newLevel,
      cost,
      newSpeedMultiplier,
    };
  }

  /**
   * Makinenin aktif reçetesini değiştirir.
   */
  static selectRecipe(
    machine: MachineEntity,
    recipeId: string,
  ): { success: boolean; error?: string } {
    if (!machine.def.supportedRecipeIds.includes(recipeId)) {
      return {
        success: false,
        error: `Bu makine '${recipeId}' reçetesini desteklemiyor.`,
      };
    }

    try {
      machine.setRecipe(recipeId);
      return { success: true };
    } catch (e: any) {
      return { success: false, error: e.message };
    }
  }
}
