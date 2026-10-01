/* ======================================================================
 * src/factory/view/MachineVisualGeometry.ts — Makine Görsel Geometrisi ve Port Matematiği
 *
 * Fabrikadaki makinelerin ızgara ayak izi, merkez piksel koordinatları,
 * rotasyon açıları, giriş/çıkış port oklarının kenar konumları ve çalışan
 * hareketli parça salınım ofsetlerini hesaplayan saf matematik motoru.
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur; Node 24 native testleriyle
 * %100 test edilebilir.
 * ====================================================================== */

import {
  DIRECTION_VECTORS,
  OPPOSITE_DIRECTIONS,
  type Direction,
  type GridCoord,
  type MachineOperationalStatus,
} from '../types.ts';
import type { MachineWorldPort } from '../simulation/MachineEntity.ts';
import { ConveyorGeometry } from './ConveyorGeometry.ts';
import { GridCoordinates } from './GridCoordinates.ts';

export interface MachineVisualBounds {
  /** Sol-üst dünya X koordinatı */
  originX: number;
  /** Sol-üst dünya Y koordinatı */
  originY: number;
  /** Piksel genişliği */
  pixelW: number;
  /** Piksel yüksekliği */
  pixelH: number;
  /** Makine merkez X koordinatı */
  centerX: number;
  /** Makine merkez Y koordinatı */
  centerY: number;
  /** Radyan cinsinden rotasyon açısı */
  rotationRad: number;
}

export interface PortVisualData {
  portId: string;
  type: 'INPUT' | 'OUTPUT';
  /** Port işaretçi okunun piksel dünya X konumu */
  arrowWorldX: number;
  /** Port işaretçi okunun piksel dünya Y konumu */
  arrowWorldY: number;
  /** Ok işaretçisinin yöneldiği açı (Radyan) */
  arrowAngleRad: number;
  /** Portun baktığı ızgara yönü */
  direction: Direction;
}

export class MachineVisualGeometry {
  /**
   * Makinenin dünya piksel sınırlarını ve merkezini hesaplar.
   */
  static computeBounds(
    coord: GridCoord,
    effWidth: number,
    effHeight: number,
    rotationDeg: number,
    tileSize = GridCoordinates.DEFAULT_TILE_SIZE,
    factoryOriginX = 0,
    factoryOriginY = 0,
  ): MachineVisualBounds {
    const originX = Math.round(factoryOriginX + coord.x * tileSize);
    const originY = Math.round(factoryOriginY + coord.y * tileSize);
    const pixelW = effWidth * tileSize;
    const pixelH = effHeight * tileSize;
    const centerX = Math.round(originX + pixelW * 0.5);
    const centerY = Math.round(originY + pixelH * 0.5);
    const rotationRad = (rotationDeg * Math.PI) / 180;

    return {
      originX,
      originY,
      pixelW,
      pixelH,
      centerX,
      centerY,
      rotationRad,
    };
  }

  /**
   * Makinenin dünya portları için kenar ok koordinatlarını ve bakış açılarını hesaplar.
   * - INPUT portları: Dışarıdan makine içine doğru bakar (OPPOSITE_DIRECTIONS[dir]).
   * - OUTPUT portları: Makineden dışarıya doğru bakar (dir).
   */
  static computePortVisuals(
    ports: MachineWorldPort[],
    tileSize = GridCoordinates.DEFAULT_TILE_SIZE,
    factoryOriginX = 0,
    factoryOriginY = 0,
  ): PortVisualData[] {
    const visuals: PortVisualData[] = [];
    const halfTile = tileSize * 0.5;

    for (const port of ports) {
      // Portun bulunduğu hücrenin merkezi
      const cellCenterX = factoryOriginX + port.worldCoord.x * tileSize + halfTile;
      const cellCenterY = factoryOriginY + port.worldCoord.y * tileSize + halfTile;

      const vec = DIRECTION_VECTORS[port.direction];

      // Hücre kenarına yakın konumlandırma (kenardan 4px içeride)
      const edgeOffset = halfTile - 4;
      const arrowWorldX = Math.round(cellCenterX + vec.dx * edgeOffset);
      const arrowWorldY = Math.round(cellCenterY + vec.dy * edgeOffset);

      // Ok açısı:
      // OUTPUT: Dışarı doğru (direction)
      // INPUT: İçeri doğru (ters yön)
      const arrowDir =
        port.type === 'OUTPUT'
          ? port.direction
          : OPPOSITE_DIRECTIONS[port.direction];
      const arrowAngleRad = ConveyorGeometry.directionToAngleRad(arrowDir);

      visuals.push({
        portId: port.id,
        type: port.type,
        arrowWorldX,
        arrowWorldY,
        arrowAngleRad,
        direction: port.direction,
      });
    }

    return visuals;
  }

  /**
   * Makinenin çalışan hareketli parçası için zaman bazlı salınım ofsetini hesaplar.
   * Yalnızca 'PROCESSING' durumunda dikey/yatay piston hareketi üretir.
   */
  static computeActivePartOffset(
    status: MachineOperationalStatus,
    animTimer: number,
    amplitude = 3.0,
  ): { offsetX: number; offsetY: number } {
    if (status !== 'PROCESSING') {
      return { offsetX: 0, offsetY: 0 };
    }

    // Piston periyodu: 8 rad/sn
    const wave = Math.sin(animTimer * 8.0);
    const offsetY = Math.round(wave * amplitude);

    return {
      offsetX: 0,
      offsetY,
    };
  }
}
