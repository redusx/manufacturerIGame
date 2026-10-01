/* ======================================================================
 * src/factory/input/SmartBeltPathfinder.ts — Akıllı Konveyör Yol Bulucu
 *
 * Başlangıç ve bitiş koordinatları (veya Makine A -> Makine B portları)
 * arasında engelleri ve kilitli parselleri gözeterek en kısa, en az virajlı
 * (L-şekilli temiz hatlar) ve en ekonomik konveyör güzergahını hesaplayan
 * A* yol bulma motoru.
 *
 * Saf TypeScript — Node 24 uyumludur; Phaser bağımlılığı yoktur,
 * headless test edilebilir.
 * ====================================================================== */

import {
  DIRECTION_VECTORS,
  OPPOSITE_DIRECTIONS,
  type Direction,
  type GridCoord,
} from '../types.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';
import { CONVEYOR_BUILD_COST } from './PlacementMath.ts';

export interface BeltPathStep {
  coord: GridCoord;
  direction: Direction;
  /** Bu hücreye yeni bir konveyör inşa edilecek mi? */
  isNew: boolean;
  cost: number;
}

export type BeltPathFailureReason =
  | 'UNREACHABLE'
  | 'OUT_OF_BOUNDS'
  | 'LOCKED_PLOT'
  | 'START_BLOCKED'
  | 'END_BLOCKED'
  | 'SAME_START_END';

export interface BeltPathResult {
  success: boolean;
  steps: BeltPathStep[];
  totalCost: number;
  canAfford: boolean;
  failureReason?: BeltPathFailureReason;
}

export interface BeltPathParams {
  grid: GridMap;
  logistics: LogisticsNetwork;
  economy: FactoryEconomy;
  startCoord: GridCoord;
  endCoord: GridCoord;
  /** Başlangıç portunun zorunlu çıkış yönü (varsa) */
  initialDirection?: Direction;
  /** Bitiş portuna giriş için zorunlu hedef yön (varsa) */
  targetDirection?: Direction;
  /** Açılmış fabrika parsel sınırları (varsa) */
  unlockedBounds?: { width: number; height: number };
  /** Karo başına inşaat maliyeti ($) */
  costPerTile?: number;
}

interface PathNode {
  x: number;
  y: number;
  dir: Direction | null;
  g: number;
  h: number;
  f: number;
  parent: PathNode | null;
}

export class SmartBeltPathfinder {
  private static readonly CARDINALS: Direction[] = ['NORTH', 'EAST', 'SOUTH', 'WEST'];
  /** Viraj cezası (Gereksiz zikzakları önler, L şeklinde düz hatları tercih eder) */
  private static readonly TURN_PENALTY = 0.65;

  /**
   * İki ızgara noktası arasındaki Manhattan mesafesini hesaplar.
   */
  static manhattan(a: GridCoord, b: GridCoord): number {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  /**
   * Başlangıç ve bitiş koordinatları arasında akıllı A* konveyör yolu bulur.
   */
  static findPath(params: BeltPathParams): BeltPathResult {
    const {
      grid,
      logistics,
      economy,
      startCoord,
      endCoord,
      initialDirection,
      targetDirection,
      unlockedBounds,
      costPerTile = CONVEYOR_BUILD_COST,
    } = params;

    // 1. Temel Kontroller
    if (startCoord.x === endCoord.x && startCoord.y === endCoord.y) {
      return {
        success: false,
        steps: [],
        totalCost: 0,
        canAfford: true,
        failureReason: 'SAME_START_END',
      };
    }

    if (!grid.isInBounds(startCoord.x, startCoord.y) || !grid.isInBounds(endCoord.x, endCoord.y)) {
      return {
        success: false,
        steps: [],
        totalCost: 0,
        canAfford: false,
        failureReason: 'OUT_OF_BOUNDS',
      };
    }

    if (unlockedBounds) {
      if (
        startCoord.x >= unlockedBounds.width ||
        startCoord.y >= unlockedBounds.height ||
        endCoord.x >= unlockedBounds.width ||
        endCoord.y >= unlockedBounds.height
      ) {
        return {
          success: false,
          steps: [],
          totalCost: 0,
          canAfford: false,
          failureReason: 'LOCKED_PLOT',
        };
      }
    }

    // Başlangıç ve bitiş hücrelerinin geçirgenliği
    if (!this.isTilePassable(grid, logistics, startCoord.x, startCoord.y, unlockedBounds, true)) {
      return {
        success: false,
        steps: [],
        totalCost: 0,
        canAfford: false,
        failureReason: 'START_BLOCKED',
      };
    }

    if (!this.isTilePassable(grid, logistics, endCoord.x, endCoord.y, unlockedBounds, false, true)) {
      return {
        success: false,
        steps: [],
        totalCost: 0,
        canAfford: false,
        failureReason: 'END_BLOCKED',
      };
    }

    // 2. A* Arama Başlatımı
    const openSet: PathNode[] = [];
    const closedSet = new Map<string, number>();

    const startNode: PathNode = {
      x: startCoord.x,
      y: startCoord.y,
      dir: initialDirection ?? null,
      g: 0,
      h: this.manhattan(startCoord, endCoord),
      f: this.manhattan(startCoord, endCoord),
      parent: null,
    };

    openSet.push(startNode);

    let endNode: PathNode | null = null;

    while (openSet.length > 0) {
      // En düşük f değerine sahip düğümü seç
      let lowestIndex = 0;
      for (let i = 1; i < openSet.length; i++) {
        if (openSet[i].f < openSet[lowestIndex].f) {
          lowestIndex = i;
        }
      }

      const current = openSet.splice(lowestIndex, 1)[0];

      // Hedefe ulaşıldı mı?
      if (current.x === endCoord.x && current.y === endCoord.y) {
        // Eğer hedef yön zorunluluğu varsa kontrol et
        if (targetDirection && current.dir && current.dir !== targetDirection) {
          // Bu yönden giriş hedef yönle uyuşmuyor, aramaya devam et
        } else {
          endNode = current;
          break;
        }
      }

      const nodeKey = `${current.x},${current.y},${current.dir ?? 'NONE'}`;
      const bestG = closedSet.get(nodeKey);
      if (bestG !== undefined && bestG <= current.g) {
        continue;
      }
      closedSet.set(nodeKey, current.g);

      // Komşuları incele
      for (const nextDir of this.CARDINALS) {
        // Geriye dönmeyi engelle
        if (current.dir && nextDir === OPPOSITE_DIRECTIONS[current.dir]) {
          continue;
        }

        const vec = DIRECTION_VECTORS[nextDir];
        const nx = current.x + vec.dx;
        const ny = current.y + vec.dy;

        const isDest = nx === endCoord.x && ny === endCoord.y;

        if (!this.isTilePassable(grid, logistics, nx, ny, unlockedBounds, false, isDest)) {
          continue;
        }

        // Adım maliyeti: Temel 1.0 + Viraj cezası
        let stepCost = 1.0;
        if (current.dir && current.dir !== nextDir) {
          stepCost += this.TURN_PENALTY;
        }

        // Mevcut bant varsa ve yönü uyuyorsa inşaatsız geçiş avantajı
        const existingBelt = logistics.getConveyor(nx, ny);
        if (existingBelt && existingBelt.direction === nextDir) {
          stepCost = 0.2;
        }

        const g = current.g + stepCost;
        const h = this.manhattan({ x: nx, y: ny }, endCoord);
        const f = g + h;

        openSet.push({
          x: nx,
          y: ny,
          dir: nextDir,
          g,
          h,
          f,
          parent: current,
        });
      }
    }

    if (!endNode) {
      return {
        success: false,
        steps: [],
        totalCost: 0,
        canAfford: false,
        failureReason: 'UNREACHABLE',
      };
    }

    // 3. Yolu Geriye Doğru Yeniden Oluştur (Reconstruction)
    const rawNodes: PathNode[] = [];
    let curr: PathNode | null = endNode;
    while (curr) {
      rawNodes.unshift(curr);
      curr = curr.parent;
    }

    // 4. Konveyör Adımlarını ve Yönlerini Hesapla
    const steps: BeltPathStep[] = [];
    let totalCost = 0;

    for (let i = 0; i < rawNodes.length; i++) {
      const node = rawNodes[i];
      let dir: Direction;

      if (i < rawNodes.length - 1) {
        // Bir sonraki adıma bakan yön
        const next = rawNodes[i + 1];
        dir = this.getDirectionBetween({ x: node.x, y: node.y }, { x: next.x, y: next.y });
      } else {
        // Son hücre: Hedef yön veya önceki düğümün yönü
        dir = targetDirection ?? rawNodes[i - 1]?.dir ?? initialDirection ?? 'EAST';
      }

      // Var olan bir bant var mı?
      const existing = logistics.getConveyor(node.x, node.y);
      const isNew = !existing || existing.direction !== dir;
      const cost = isNew ? costPerTile : 0;

      totalCost += cost;
      steps.push({
        coord: { x: node.x, y: node.y },
        direction: dir,
        isNew,
        cost,
      });
    }

    return {
      success: true,
      steps,
      totalCost,
      canAfford: economy.canAfford(totalCost),
    };
  }

  /**
   * İki makine örneği arasındaki en uygun giriş ve çıkış portlarını bularak doğrudan hat çizer.
   */
  static findPathBetweenMachines(
    params: {
      fromMachineId: string;
      toMachineId: string;
      engine: ProductionEngine;
      grid: GridMap;
      logistics: LogisticsNetwork;
      economy: FactoryEconomy;
      unlockedBounds?: { width: number; height: number };
      costPerTile?: number;
    },
  ): BeltPathResult {
    const { fromMachineId, toMachineId, engine, grid, logistics, economy, unlockedBounds, costPerTile } = params;

    const fromMachine = engine.getMachine(fromMachineId);
    const toMachine = engine.getMachine(toMachineId);

    if (!fromMachine || !toMachine) {
      return {
        success: false,
        steps: [],
        totalCost: 0,
        canAfford: false,
        failureReason: 'UNREACHABLE',
      };
    }

    // Makine A'nın çıkış portlarını al
    const outPorts = fromMachine.getWorldPorts().filter((p) => p.type === 'OUTPUT');
    // Makine B'nin giriş portlarını al
    const inPorts = toMachine.getWorldPorts().filter((p) => p.type === 'INPUT');

    if (outPorts.length === 0 || inPorts.length === 0) {
      return {
        success: false,
        steps: [],
        totalCost: 0,
        canAfford: false,
        failureReason: 'UNREACHABLE',
      };
    }

    let bestResult: BeltPathResult | null = null;

    // Tüm port çiftleri arasında en düşük maliyetli yolu ara
    for (const outP of outPorts) {
      const outVec = DIRECTION_VECTORS[outP.direction];
      const startCoord = { x: outP.worldCoord.x + outVec.dx, y: outP.worldCoord.y + outVec.dy };

      for (const inP of inPorts) {
        // Bitiş noktası: Giriş portunun hemen önündeki hücre
        const inVec = DIRECTION_VECTORS[inP.direction];
        const endCoord = { x: inP.worldCoord.x + inVec.dx, y: inP.worldCoord.y + inVec.dy };
        // Giriş portuna doğru bakmalı (ters yön)
        const targetDirection = OPPOSITE_DIRECTIONS[inP.direction];

        const path = this.findPath({
          grid,
          logistics,
          economy,
          startCoord,
          endCoord,
          initialDirection: outP.direction,
          targetDirection,
          unlockedBounds,
          costPerTile,
        });

        if (path.success) {
          if (!bestResult || path.totalCost < bestResult.totalCost) {
            bestResult = path;
          }
        }
      }
    }

    if (bestResult) {
      return bestResult;
    }

    return {
      success: false,
      steps: [],
      totalCost: 0,
      canAfford: false,
      failureReason: 'UNREACHABLE',
    };
  }

  /**
   * Hesaplanan konveyör güzergahını inşa eder, harcamayı yapar ve bantları ağa bağlar.
   */
  static executePath(
    logistics: LogisticsNetwork,
    economy: FactoryEconomy,
    pathResult: BeltPathResult,
  ): boolean {
    if (!pathResult.success || !pathResult.canAfford) {
      return false;
    }

    if (pathResult.totalCost > 0) {
      const spent = economy.spendMoney(pathResult.totalCost);
      if (!spent) return false;
    }

    for (const step of pathResult.steps) {
      if (step.isNew) {
        // Eğer hücrede eski bir bant varsa önce kaldır
        const existing = logistics.getConveyor(step.coord.x, step.coord.y);
        if (existing) {
          logistics.removeConveyor(step.coord.x, step.coord.y);
        }
        logistics.addConveyor(step.coord, step.direction);
      }
    }

    return true;
  }

  // -------------------------------------------------------------
  // YARDIMCI METOTLAR
  // -------------------------------------------------------------

  private static isTilePassable(
    grid: GridMap,
    logistics: LogisticsNetwork,
    x: number,
    y: number,
    unlockedBounds?: { width: number; height: number },
    _isStart = false,
    _isDest = false,
  ): boolean {
    if (!grid.isInBounds(x, y)) return false;

    if (unlockedBounds && (x >= unlockedBounds.width || y >= unlockedBounds.height)) {
      return false;
    }

    const cell = grid.getCell(x, y);
    if (!cell) return false;

    // Boş hücre her zaman inşa edilebilir
    if (cell.type === 'EMPTY') return true;

    // Mevcut konveyör olan hücreler üzerine yazılabilir veya bağlanabilir
    if (cell.type === 'CONVEYOR') return true;

    // Engel veya makine olan hücreler geçilemez
    return false;
  }

  private static getDirectionBetween(from: GridCoord, to: GridCoord): Direction {
    const dx = to.x - from.x;
    const dy = to.y - from.y;

    if (dx > 0) return 'EAST';
    if (dx < 0) return 'WEST';
    if (dy > 0) return 'SOUTH';
    if (dy < 0) return 'NORTH';

    return 'EAST';
  }
}
