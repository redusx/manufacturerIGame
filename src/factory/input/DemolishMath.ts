/* ======================================================================
 * src/factory/input/DemolishMath.ts — Yıkım ve Taşıma Matematik Çekirdeği
 *
 * Fabrika zeminindeki makineleri, konveyör bantlarını, Splitter ve Merger
 * ünitelerini %100 tam sermaye iadesiyle (DEC-007) yıkma, hedef denetimi,
 * çok hücreli ayak izi vurgulama ve toplu alan yıkım hesaplarını yürüten
 * saf TypeScript modülü.
 *
 * Node 24 uyumludur; Phaser bağımlılığı yoktur, headless test edilebilir.
 * ====================================================================== */

import type { GridCoord } from '../types.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import {
  CONVEYOR_BUILD_COST,
  SPLITTER_BUILD_COST,
  MERGER_BUILD_COST,
  PlacementMath,
} from './PlacementMath.ts';

export type DemolishTargetType =
  | 'MACHINE'
  | 'CONVEYOR'
  | 'SPLITTER'
  | 'MERGER'
  | 'NONE';

export type DemolishBlockReason =
  | 'EMPTY'
  | 'PROTECTED_OBSTACLE'
  | 'PROTECTED_INTAKE'
  | 'PROTECTED_EXPORT'
  | 'OUT_OF_BOUNDS';

export interface DemolishTargetInfo {
  canDemolish: boolean;
  targetType: DemolishTargetType;
  name: string;
  refundAmount: number;
  occupiedCoords: GridCoord[];
  instanceId?: string;
  level?: number;
  blockReason?: DemolishBlockReason;
}

export interface DemolishInspectParams {
  grid: GridMap;
  logistics: LogisticsNetwork;
  engine: ProductionEngine;
  economy: FactoryEconomy;
  coord: GridCoord;
}

export interface DemolishExecuteResult {
  success: boolean;
  targetType: DemolishTargetType;
  name: string;
  refundAmount: number;
  freedCoords: GridCoord[];
  instanceId?: string;
}

export interface DemolishAreaResult {
  targets: DemolishTargetInfo[];
  totalRefund: number;
  affectedCoords: GridCoord[];
}

export class DemolishMath {
  /**
   * Hedef hücredeki varlığı inceler; yıkılabilirlik durumunu, kapladığı tüm
   * koordinatları ve %100 iade edilecek sermaye tutarını hesaplar.
   */
  static inspectTarget(params: DemolishInspectParams): DemolishTargetInfo {
    const { grid, logistics, engine, economy, coord } = params;

    // 1. Sınır Denetimi
    if (!grid.isInBounds(coord.x, coord.y)) {
      return {
        canDemolish: false,
        targetType: 'NONE',
        name: '',
        refundAmount: 0,
        occupiedCoords: [],
        blockReason: 'OUT_OF_BOUNDS',
      };
    }

    const cell = grid.getCell(coord.x, coord.y);
    if (!cell) {
      return {
        canDemolish: false,
        targetType: 'NONE',
        name: '',
        refundAmount: 0,
        occupiedCoords: [],
        blockReason: 'EMPTY',
      };
    }

    // 2. Korumalı Hücreler
    if (cell.type === 'OBSTACLE') {
      return {
        canDemolish: false,
        targetType: 'NONE',
        name: 'Kalıcı Engel',
        refundAmount: 0,
        occupiedCoords: [coord],
        blockReason: 'PROTECTED_OBSTACLE',
      };
    }

    if (cell.type === 'INTAKE') {
      return {
        canDemolish: false,
        targetType: 'NONE',
        name: 'Hammadde Giriş Silosu',
        refundAmount: 0,
        occupiedCoords: [coord],
        blockReason: 'PROTECTED_INTAKE',
      };
    }

    if (cell.type === 'EXPORT') {
      return {
        canDemolish: false,
        targetType: 'NONE',
        name: 'Sevkiyat Sandığı',
        refundAmount: 0,
        occupiedCoords: [coord],
        blockReason: 'PROTECTED_EXPORT',
      };
    }

    if (cell.type === 'EMPTY') {
      return {
        canDemolish: false,
        targetType: 'NONE',
        name: '',
        refundAmount: 0,
        occupiedCoords: [],
        blockReason: 'EMPTY',
      };
    }

    // 3. MAKİNE YIKIMI (1x1, 2x1, 2x2 vb. tüm ayak iziyle birlikte)
    if (cell.type === 'MACHINE' && cell.machineInstanceId) {
      const machine = engine.getMachine(cell.machineInstanceId);
      if (machine) {
        const level = engine.getMachineLevel(machine.instanceId);
        const refundAmount = economy.getTotalMachineInvestment(machine.def.baseCost, level);

        const rotDir = PlacementMath.rotationDegToDirection(machine.rotation);
        const effFootprint = PlacementMath.getEffectiveFootprint(
          { width: machine.def.width, height: machine.def.height },
          rotDir,
        );
        const occupiedCoords = PlacementMath.computeOccupiedCoords(machine.coord, effFootprint);

        return {
          canDemolish: true,
          targetType: 'MACHINE',
          name: `${machine.def.name} (Lv.${level})`,
          refundAmount,
          occupiedCoords,
          instanceId: machine.instanceId,
          level,
        };
      }
    }

    // 4. LOJİSTİK YIKIMI (Splitter, Merger veya Konveyör)
    if (cell.type === 'CONVEYOR') {
      // Splitter mı?
      const splitter = logistics.getSplitter(coord.x, coord.y);
      if (splitter) {
        return {
          canDemolish: true,
          targetType: 'SPLITTER',
          name: 'Akış Ayırıcı (Splitter)',
          refundAmount: SPLITTER_BUILD_COST,
          occupiedCoords: [coord],
        };
      }

      // Merger mı?
      const merger = logistics.getMerger(coord.x, coord.y);
      if (merger) {
        return {
          canDemolish: true,
          targetType: 'MERGER',
          name: 'Akış Birleştirici (Merger)',
          refundAmount: MERGER_BUILD_COST,
          occupiedCoords: [coord],
        };
      }

      // Standart Konveyör
      const belt = logistics.getConveyor(coord.x, coord.y);
      if (belt) {
        return {
          canDemolish: true,
          targetType: 'CONVEYOR',
          name: 'Konveyör Bandı',
          refundAmount: CONVEYOR_BUILD_COST,
          occupiedCoords: [coord],
        };
      }
    }

    return {
      canDemolish: false,
      targetType: 'NONE',
      name: '',
      refundAmount: 0,
      occupiedCoords: [],
      blockReason: 'EMPTY',
    };
  }

  /**
   * Hedefteki varlığı yıkar, simülasyondan ve ızgaradan kaldırır ve cüzdana
   * %100 sermaye iadesi yapar.
   */
  static executeDemolish(params: DemolishInspectParams): DemolishExecuteResult {
    const info = this.inspectTarget(params);

    if (!info.canDemolish) {
      return {
        success: false,
        targetType: 'NONE',
        name: info.name,
        refundAmount: 0,
        freedCoords: [],
      };
    }

    const { logistics, engine, economy, coord } = params;

    // 1. Makine Yıkımı
    if (info.targetType === 'MACHINE' && info.instanceId && info.level !== undefined) {
      const machine = engine.getMachine(info.instanceId);
      if (machine) {
        // Sermaye iadesi yap
        const refund = economy.refundMachine(machine.def.baseCost, info.level);
        // Motordan ve ızgaradan kaldır
        engine.removeMachine(info.instanceId);

        return {
          success: true,
          targetType: 'MACHINE',
          name: info.name,
          refundAmount: refund,
          freedCoords: info.occupiedCoords,
          instanceId: info.instanceId,
        };
      }
    }

    // 2. Splitter Yıkımı
    if (info.targetType === 'SPLITTER') {
      logistics.removeSplitter(coord.x, coord.y);
      economy.addMoney(SPLITTER_BUILD_COST, 'REFUND');
      return {
        success: true,
        targetType: 'SPLITTER',
        name: info.name,
        refundAmount: SPLITTER_BUILD_COST,
        freedCoords: [coord],
      };
    }

    // 3. Merger Yıkımı
    if (info.targetType === 'MERGER') {
      logistics.removeMerger(coord.x, coord.y);
      economy.addMoney(MERGER_BUILD_COST, 'REFUND');
      return {
        success: true,
        targetType: 'MERGER',
        name: info.name,
        refundAmount: MERGER_BUILD_COST,
        freedCoords: [coord],
      };
    }

    // 4. Konveyör Yıkımı
    if (info.targetType === 'CONVEYOR') {
      logistics.removeConveyor(coord.x, coord.y);
      economy.addMoney(CONVEYOR_BUILD_COST, 'REFUND');
      return {
        success: true,
        targetType: 'CONVEYOR',
        name: info.name,
        refundAmount: CONVEYOR_BUILD_COST,
        freedCoords: [coord],
      };
    }

    return {
      success: false,
      targetType: 'NONE',
      name: '',
      refundAmount: 0,
      freedCoords: [],
    };
  }

  /**
   * Belirtilen dikdörtgen alan içindeki tüm yıkılabilir varlıkları tarar.
   * Aynı makinenin birden fazla hücresi tarandığında makineyi tekil olarak listeler.
   */
  static inspectArea(
    grid: GridMap,
    logistics: LogisticsNetwork,
    engine: ProductionEngine,
    economy: FactoryEconomy,
    cornerA: GridCoord,
    cornerB: GridCoord,
  ): DemolishAreaResult {
    const minX = Math.max(0, Math.min(cornerA.x, cornerB.x));
    const maxX = Math.min(grid.width - 1, Math.max(cornerA.x, cornerB.x));
    const minY = Math.max(0, Math.min(cornerA.y, cornerB.y));
    const maxY = Math.min(grid.height - 1, Math.max(cornerA.y, cornerB.y));

    const processedMachineIds = new Set<string>();
    const targets: DemolishTargetInfo[] = [];
    const affectedCoordsSet = new Set<string>();
    let totalRefund = 0;

    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const info = this.inspectTarget({
          grid,
          logistics,
          engine,
          economy,
          coord: { x, y },
        });

        if (info.canDemolish) {
          if (info.targetType === 'MACHINE' && info.instanceId) {
            if (processedMachineIds.has(info.instanceId)) {
              continue;
            }
            processedMachineIds.add(info.instanceId);
          }

          targets.push(info);
          totalRefund += info.refundAmount;

          for (const c of info.occupiedCoords) {
            affectedCoordsSet.add(`${c.x},${c.y}`);
          }
        }
      }
    }

    const affectedCoords: GridCoord[] = Array.from(affectedCoordsSet).map((k) => {
      const [x, y] = k.split(',').map(Number);
      return { x, y };
    });

    return {
      targets,
      totalRefund,
      affectedCoords,
    };
  }
}
