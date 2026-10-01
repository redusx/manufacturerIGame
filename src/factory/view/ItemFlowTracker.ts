/* ======================================================================
 * src/factory/view/ItemFlowTracker.ts — Lojistik Akış ve Eşya Konum Takipçisi
 *
 * Fabrika lojistik ağındaki (LogisticsNetwork) tüm konveyörler, 90° virajlar,
 * Splitter ve Merger üniteleri üzerindeki eşyaları tarayarak, her birinin
 * dünya koordinatlarını (x, y) ve rotasyon açılarını (angleRad) pürüzsüz
 * kuadratik Bézier ve doğrusal enterpolasyonla hesaplayan saf matematik motoru.
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur; Node 24 native testleriyle
 * %100 test edilebilir.
 * ====================================================================== */

import type { Direction, GridCoord } from '../types.ts';
import { ConveyorGeometry, type ConveyorTurnInfo } from './ConveyorGeometry.ts';
import { GridCoordinates } from './GridCoordinates.ts';
import type { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';

/** Render edilebilir tekil eşya görsel verisi */
export interface RenderableItem {
  /** Eşya ID'si (örn. 'iron_ore', 'iron_ingot') */
  itemId: string;
  /** Piksel cinsinden dünya X koordinatı */
  worldX: number;
  /** Piksel cinsinden dünya Y koordinatı */
  worldY: number;
  /** Radyan cinsinden hareket / yön teğet açısı */
  angleRad: number;
  /** Yuva içi ilerleme (0.0 .. 1.0) */
  progress: number;
  /** Bulunduğu ızgara hücresi */
  coord: GridCoord;
  /** Bant içindeki slot indeksi */
  slotIndex: number;
}

export class ItemFlowTracker {
  /**
   * Lojistik ağındaki tüm konveyör, Splitter ve Merger ünitelerindeki eşyaları
   * tarayarak ekran üzerinde çizilmesi gereken tam dünya koordinatlarını üretir.
   *
   * @param network Lojistik ağı (LogisticsNetwork)
   * @param tileSize Izgara hücre boyutu (varsayılan: 32px)
   * @param originX Izgara sol-üst dünya X koordinatı (varsayılan: 0)
   * @param originY Izgara sol-üst dünya Y koordinatı (varsayılan: 0)
   * @param turnInfoCache Varsa önceden hesaplanmış hücre viraj bilgileri sağlayıcısı
   */
  static collectRenderableItems(
    network: LogisticsNetwork,
    tileSize = GridCoordinates.DEFAULT_TILE_SIZE,
    originX = 0,
    originY = 0,
    turnInfoCache?: (x: number, y: number) => ConveyorTurnInfo | undefined,
  ): RenderableItem[] {
    const results: RenderableItem[] = [];

    const allBelts = network.getAllConveyors();
    const allSplitters = network.getAllSplitters();
    const allMergers = network.getAllMergers();

    // Hızlı komşu sorgusu için tüm bant yön listesi (eğer cache yoksa)
    let neighborBelts: { coord: GridCoord; direction: Direction }[] | null = null;
    const getNeighbors = () => {
      if (!neighborBelts) {
        neighborBelts = allBelts.map((b) => ({
          coord: b.coord,
          direction: b.direction,
        }));
      }
      return neighborBelts;
    };

    // 1. Standart Konveyörler
    for (const belt of allBelts) {
      const items = belt.getItems();
      if (items.length === 0) continue;

      const tileX = originX + belt.coord.x * tileSize;
      const tileY = originY + belt.coord.y * tileSize;

      let turnInfo = turnInfoCache?.(belt.coord.x, belt.coord.y);
      if (!turnInfo) {
        const inDirs = ConveyorGeometry.getIncomingDirections(
          belt.coord,
          getNeighbors(),
        );
        turnInfo = ConveyorGeometry.determineTileInfo(
          belt.coord,
          belt.direction,
          inDirs,
        );
      }

      for (let i = 0; i < items.length; i++) {
        const slot = items[i];
        const pos = ConveyorGeometry.computeItemWorldPosition(
          tileX,
          tileY,
          tileSize,
          turnInfo.shape,
          turnInfo.inDir,
          turnInfo.outDir,
          slot.progress,
        );

        results.push({
          itemId: slot.itemId,
          worldX: pos.x,
          worldY: pos.y,
          angleRad: pos.angleRad,
          progress: slot.progress,
          coord: belt.coord,
          slotIndex: i,
        });
      }
    }

    // 2. Splitter Üniteleri
    for (const splitter of allSplitters) {
      const items = splitter.getItems();
      if (items.length === 0) continue;

      const tileX = originX + splitter.coord.x * tileSize;
      const tileY = originY + splitter.coord.y * tileSize;

      const turnInfo = ConveyorGeometry.determineTileInfo(
        splitter.coord,
        splitter.outputDirections[0],
        [splitter.inputDirection],
        true,
        false,
        splitter.outputDirections,
      );

      for (let i = 0; i < items.length; i++) {
        const slot = items[i];
        const pos = ConveyorGeometry.computeItemWorldPosition(
          tileX,
          tileY,
          tileSize,
          'STRAIGHT',
          turnInfo.inDir,
          turnInfo.outDir,
          slot.progress,
        );

        results.push({
          itemId: slot.itemId,
          worldX: pos.x,
          worldY: pos.y,
          angleRad: pos.angleRad,
          progress: slot.progress,
          coord: splitter.coord,
          slotIndex: i,
        });
      }
    }

    // 3. Merger Üniteleri
    for (const merger of allMergers) {
      const items = merger.getItems();
      if (items.length === 0) continue;

      const tileX = originX + merger.coord.x * tileSize;
      const tileY = originY + merger.coord.y * tileSize;

      const turnInfo = ConveyorGeometry.determineTileInfo(
        merger.coord,
        merger.outputDirection,
        [merger.inputDirections[0], merger.inputDirections[1]],
        false,
        true,
      );

      for (let i = 0; i < items.length; i++) {
        const slot = items[i];
        const pos = ConveyorGeometry.computeItemWorldPosition(
          tileX,
          tileY,
          tileSize,
          'STRAIGHT',
          turnInfo.inDir,
          turnInfo.outDir,
          slot.progress,
        );

        results.push({
          itemId: slot.itemId,
          worldX: pos.x,
          worldY: pos.y,
          angleRad: pos.angleRad,
          progress: slot.progress,
          coord: merger.coord,
          slotIndex: i,
        });
      }
    }

    return results;
  }
}
