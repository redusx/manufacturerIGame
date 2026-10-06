/* ======================================================================
 * src/factory/input/PlacementMath.ts — İnşa ve Yerleşim Matematik Çekirdeği
 *
 * Fabrikaya yerleştirilecek makineler ve konveyör hatları için
 * ızgara kenetlenmesi (snapping), rotasyon ($R$ tuşu), yönelimle
 * transpoze olan ayak izi ($W \times H$), port yön dönüşümleri,
 * parsel ve bakiye geçerlilik denetimlerini (validasyon) gerçekleştiren
 * saf TypeScript modülü.
 *
 * Node 24 uyumludur; Phaser bağımlılığı yoktur, headless test edilebilir.
 * ====================================================================== */

import {
  DIRECTION_VECTORS,
  type Direction,
  type GridCoord,
  type MachineDefinition,
} from '../types.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';
import { MachineEntity, type MachineWorldPort } from '../simulation/MachineEntity.ts';
import { getRotatedPort, ROTATE_DIRECTION_CW } from '../simulation/MachineRegistry.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { GridCoordinates } from '../view/GridCoordinates.ts';

export type PlacementItemType =
  | 'MACHINE'
  | 'CONVEYOR'
  | 'SPLITTER'
  | 'MERGER'
  | 'INTAKE_MOVE'
  | 'EXPORT_MOVE'
  | 'INTAKE_NEW';

/**
 * Yeni hammadde girişi kurma bedelleri (hammadde kimliği -> $).
 * Her giriş saniyede 1 hammadde verir; üretimi büyütmenin yolu yeni giriş kurmaktır.
 */
export const INTAKE_BUILD_COSTS: Readonly<Record<string, number>> = {
  iron_ore: 500,
  copper_ore: 1000,
  silica_sand: 2500,
  crude_polymer: 2500,
};

/** Girişlerin ızgara üstünde ve katalogda görünen kısa hammadde adları */
export const INTAKE_SHORT_NAMES: Readonly<Record<string, string>> = {
  iron_ore: 'DEMİR',
  copper_ore: 'BAKIR',
  silica_sand: 'KUM',
  crude_polymer: 'POLİ',
};

/** Hammadde girişini açan aşama özelliği (bkz. MilestoneManager ödülleri) */
export const INTAKE_UNLOCK_FEATURES: Readonly<Record<string, string>> = {
  iron_ore: 'INTAKE_IRON',
  copper_ore: 'INTAKE_COPPER',
  silica_sand: 'INTAKE_SILICA',
  crude_polymer: 'INTAKE_POLYMER',
};

/** Yeni kurulan girişin hammadde verme aralığı (saniye) */
export const INTAKE_INTERVAL_SEC = 1.0;

export const CONVEYOR_BUILD_COST = 5;
export const SPLITTER_BUILD_COST = 25;
export const MERGER_BUILD_COST = 25;

export type PlacementInvalidReason =
  | 'OUT_OF_BOUNDS'
  | 'LOCKED_PLOT'
  | 'CELL_OCCUPIED'
  | 'NOT_ENOUGH_MONEY';

export interface PlacementValidationParams {
  grid: GridMap;
  economy: FactoryEconomy;
  rootCoord: GridCoord;
  itemType: PlacementItemType;
  direction: Direction;
  machineDef?: MachineDefinition;
  unlockedBounds?: { width: number; height: number };
  sourceCoord?: GridCoord;
  /** INTAKE_NEW için: kurulacak girişin vereceği hammadde */
  intakeItemId?: string;
}

export interface PlacementValidationResult {
  isValid: boolean;
  reason?: PlacementInvalidReason;
  cost: number;
  canAfford: boolean;
  effectiveFootprint: { width: number; height: number };
  occupiedCoords: GridCoord[];
  previewPorts: MachineWorldPort[];
}

export interface PlacementExecuteParams extends PlacementValidationParams {
  engine?: ProductionEngine;
  logistics: LogisticsNetwork;
}

export interface PlacementExecuteResult {
  success: boolean;
  reason?: PlacementInvalidReason;
  instanceId?: string;
  spentMoney: number;
  coord: GridCoord;
  itemType?: PlacementItemType;
}

export class PlacementMath {
  /**
   * Yönü saat yönünde (CW) veya saat yönünün tersine (CCW) 90 derece döndürür.
   */
  static rotateDirection(direction: Direction, clockwise = true): Direction {
    if (clockwise) {
      return ROTATE_DIRECTION_CW[direction];
    }
    const ccw: Record<Direction, Direction> = {
      NORTH: 'WEST',
      WEST: 'SOUTH',
      SOUTH: 'EAST',
      EAST: 'NORTH',
    };
    return ccw[direction];
  }

  /**
   * Yönü rotasyon açısına (0, 90, 180, 270 derece) dönüştürür.
   */
  static directionToRotationDeg(direction: Direction): 0 | 90 | 180 | 270 {
    switch (direction) {
      case 'NORTH':
        return 0;
      case 'EAST':
        return 90;
      case 'SOUTH':
        return 180;
      case 'WEST':
        return 270;
    }
  }

  /**
   * Rotasyon açısını Direction enum değerine dönüştürür.
   */
  static rotationDegToDirection(deg: number): Direction {
    const normalized = ((Math.round(deg) % 360) + 360) % 360;
    if (normalized === 90) return 'EAST';
    if (normalized === 180) return 'SOUTH';
    if (normalized === 270) return 'WEST';
    return 'NORTH';
  }

  /**
   * Verilen rotasyon yönüne göre makinenin ızgarada kapladığı efektif boyutları hesaplar.
   * EAST veya WEST yönlerinde genişlik ve yükseklik yer değiştirir.
   */
  static getEffectiveFootprint(
    footprint: { width: number; height: number },
    direction: Direction,
  ): { width: number; height: number } {
    if (direction === 'EAST' || direction === 'WEST') {
      return { width: footprint.height, height: footprint.width };
    }
    return { width: footprint.width, height: footprint.height };
  }

  /**
   * Kök koordinat ve efektif boyutlara göre işgal edilecek tüm hücrelerin koordinat listesini döner.
   */
  static computeOccupiedCoords(
    rootCoord: GridCoord,
    effectiveFootprint: { width: number; height: number },
  ): GridCoord[] {
    const coords: GridCoord[] = [];
    for (let dy = 0; dy < effectiveFootprint.height; dy++) {
      for (let dx = 0; dx < effectiveFootprint.width; dx++) {
        coords.push({
          x: rootCoord.x + dx,
          y: rootCoord.y + dy,
        });
      }
    }
    return coords;
  }

  /**
   * Makinenin rotasyonuna göre önizleme dünya portlarını hesaplar.
   */
  static computePreviewWorldPorts(
    def: MachineDefinition,
    rootCoord: GridCoord,
    direction: Direction,
  ): MachineWorldPort[] {
    const rotationDeg = this.directionToRotationDeg(direction);
    const ports: MachineWorldPort[] = [];

    for (const p of def.ports) {
      const rot = getRotatedPort(
        p,
        def.width,
        def.height,
        rotationDeg,
      );

      ports.push({
        id: p.id,
        type: p.type,
        localCoord: { x: rot.localX, y: rot.localY },
        worldCoord: { x: rootCoord.x + rot.localX, y: rootCoord.y + rot.localY },
        direction: rot.direction,
      });
    }

    return ports;
  }

  /**
   * Öğe türüne göre inşaat maliyetini hesaplar.
   */
  static getItemCost(
    itemType: PlacementItemType,
    machineDef?: MachineDefinition,
    intakeItemId?: string,
  ): number {
    if (itemType === 'MACHINE' && machineDef) {
      return machineDef.baseCost;
    }
    if (itemType === 'INTAKE_NEW') {
      return INTAKE_BUILD_COSTS[intakeItemId ?? ''] ?? Infinity;
    }
    if (itemType === 'CONVEYOR') {
      return CONVEYOR_BUILD_COST;
    }
    if (itemType === 'SPLITTER') {
      return SPLITTER_BUILD_COST;
    }
    if (itemType === 'MERGER') {
      return MERGER_BUILD_COST;
    }
    return 0;
  }

  /**
   * Belirtilen konum ve rotasyondaki yerleşimin geçerliliğini denetler.
   */
  static validatePlacement(params: PlacementValidationParams): PlacementValidationResult {
    const {
      grid,
      economy,
      rootCoord,
      itemType,
      direction,
      machineDef,
      unlockedBounds,
    } = params;

    // 1. Ayak izi hesabı
    const baseFootprint =
      itemType === 'MACHINE' && machineDef
        ? { width: machineDef.width, height: machineDef.height }
        : { width: 1, height: 1 };

    const effectiveFootprint = this.getEffectiveFootprint(baseFootprint, direction);
    const occupiedCoords = this.computeOccupiedCoords(rootCoord, effectiveFootprint);

    // 2. Port önizlemesi
    const previewPorts =
      itemType === 'MACHINE' && machineDef
        ? this.computePreviewWorldPorts(machineDef, rootCoord, direction)
        : [];

    // 3. Maliyet ve bakiye denetimi
    const cost = this.getItemCost(itemType, machineDef, params.intakeItemId);
    const canAfford = economy.canAfford(cost);

    // 4. Izgara sınırları denetimi
    for (const c of occupiedCoords) {
      if (!grid.isInBounds(c.x, c.y)) {
        return {
          isValid: false,
          reason: 'OUT_OF_BOUNDS',
          cost,
          canAfford,
          effectiveFootprint,
          occupiedCoords,
          previewPorts,
        };
      }
    }

    // 5. Kilitli parsel sınırları denetimi (Fabrika genişlemesi)
    if (unlockedBounds) {
      for (const c of occupiedCoords) {
        if (c.x >= unlockedBounds.width || c.y >= unlockedBounds.height) {
          return {
            isValid: false,
            reason: 'LOCKED_PLOT',
            cost,
            canAfford,
            effectiveFootprint,
            occupiedCoords,
            previewPorts,
          };
        }
      }
    }

    // 6. Hücre boşluk denetimi
    for (const c of occupiedCoords) {
      const isSelfSource =
        (itemType === 'INTAKE_MOVE' || itemType === 'EXPORT_MOVE') &&
        params.sourceCoord &&
        c.x === params.sourceCoord.x &&
        c.y === params.sourceCoord.y;

      if (!isSelfSource && !grid.isCellEmpty(c.x, c.y)) {
        return {
          isValid: false,
          reason: 'CELL_OCCUPIED',
          cost,
          canAfford,
          effectiveFootprint,
          occupiedCoords,
          previewPorts,
        };
      }
    }

    // 7. Bakiye yetersizliği denetimi
    if (!canAfford) {
      return {
        isValid: false,
        reason: 'NOT_ENOUGH_MONEY',
        cost,
        canAfford,
        effectiveFootprint,
        occupiedCoords,
        previewPorts,
      };
    }

    return {
      isValid: true,
      cost,
      canAfford: true,
      effectiveFootprint,
      occupiedCoords,
      previewPorts,
    };
  }

  /**
   * Doğrulanmış bir inşa eylemini yürütür, parayı harcar ve simülasyona varlığı ekler.
   */
  static executePlacement(params: PlacementExecuteParams): PlacementExecuteResult {
    const validation = this.validatePlacement(params);

    if (!validation.isValid) {
      return {
        success: false,
        reason: validation.reason,
        spentMoney: 0,
        coord: params.rootCoord,
      };
    }

    const {
      grid,
      economy,
      rootCoord,
      itemType,
      direction,
      machineDef,
      engine,
      logistics,
    } = params;

    // Hammadde Giriş Silosu Taşıma
    if (itemType === 'INTAKE_MOVE') {
      const source = params.sourceCoord ?? grid.getIntakeCells()[0]?.coord;
      if (!source) {
        return {
          success: false,
          reason: 'CELL_OCCUPIED',
          spentMoney: 0,
          coord: rootCoord,
        };
      }
      const moved = grid.moveIntake(source.x, source.y, rootCoord.x, rootCoord.y);
      return {
        success: moved,
        reason: moved ? undefined : 'CELL_OCCUPIED',
        spentMoney: 0,
        coord: rootCoord,
        itemType: 'INTAKE_MOVE',
      };
    }

    // Sevkiyat Sandığı Taşıma
    if (itemType === 'EXPORT_MOVE') {
      const source = params.sourceCoord ?? grid.getExportCells()[0]?.coord;
      if (!source) {
        return {
          success: false,
          reason: 'CELL_OCCUPIED',
          spentMoney: 0,
          coord: rootCoord,
          itemType: 'EXPORT_MOVE',
        };
      }
      const moved = grid.moveExport(source.x, source.y, rootCoord.x, rootCoord.y);
      return {
        success: moved,
        reason: moved ? undefined : 'CELL_OCCUPIED',
        spentMoney: 0,
        coord: rootCoord,
        itemType: 'EXPORT_MOVE',
      };
    }

    // Parayı harca
    const spent = economy.spendMoney(validation.cost);
    if (!spent) {
      return {
        success: false,
        reason: 'NOT_ENOUGH_MONEY',
        spentMoney: 0,
        coord: rootCoord,
      };
    }

    // Yeni hammadde girişi
    if (itemType === 'INTAKE_NEW' && params.intakeItemId) {
      grid.setIntake(rootCoord.x, rootCoord.y, params.intakeItemId, INTAKE_INTERVAL_SEC);
      return {
        success: true,
        spentMoney: validation.cost,
        coord: rootCoord,
        itemType: 'INTAKE_NEW',
      };
    }

    // Makine yerleşimi
    if (itemType === 'MACHINE' && machineDef) {
      if (!engine) {
        throw new Error('[PlacementMath] Makine inşa etmek için ProductionEngine gereklidir.');
      }

      const instanceId = `${machineDef.id}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
      const rotationDeg = this.directionToRotationDeg(direction);

      const entity = new MachineEntity(
        instanceId,
        machineDef,
        rootCoord,
        rotationDeg,
        machineDef.supportedRecipeIds[0] ?? null,
      );

      engine.addMachine(entity, 1);

      return {
        success: true,
        instanceId,
        spentMoney: validation.cost,
        coord: rootCoord,
      };
    }

    // Konveyör yerleşimi
    if (itemType === 'CONVEYOR') {
      logistics.addConveyor(rootCoord, direction);
      return {
        success: true,
        spentMoney: validation.cost,
        coord: rootCoord,
      };
    }

    // Splitter yerleşimi
    if (itemType === 'SPLITTER') {
      const cw = ROTATE_DIRECTION_CW[direction];
      logistics.addSplitter(rootCoord, direction, [direction, cw]);
      return {
        success: true,
        spentMoney: validation.cost,
        coord: rootCoord,
      };
    }

    // Merger yerleşimi
    if (itemType === 'MERGER') {
      const cw = ROTATE_DIRECTION_CW[direction];
      logistics.addMerger(rootCoord, [direction, cw], direction);
      return {
        success: true,
        spentMoney: validation.cost,
        coord: rootCoord,
      };
    }

    return {
      success: false,
      spentMoney: 0,
      coord: rootCoord,
    };
  }
}
