/* ======================================================================
 * src/factory/view/GridCoordinates.ts — Izgara ve Ekran Koordinat Dönüşümleri
 *
 * 2D fabrika ızgarası ile ekran piksel koordinatları arasındaki dönüşümleri,
 * merkez hizalamalarını, parsel sınırlarını ve genişleme bölgelerini hesaplayan
 * saf TypeScript sınıfı. Phaser bağımlılığı yoktur; test edilebilir ve headless çalışabilir.
 * ====================================================================== */

import type { GridCoord } from '../types.ts';
import {
  FACTORY_PLOTS,
  type PlotDefinition,
} from '../simulation/FactoryEconomy.ts';

export class GridCoordinates {
  public static readonly DEFAULT_TILE_SIZE = 32;

  /**
   * Izgara koordinatını dünya piksel sol-üst koordinatına çevirir.
   */
  static gridToWorld(
    coord: GridCoord,
    tileSize = GridCoordinates.DEFAULT_TILE_SIZE,
    originX = 0,
    originY = 0,
  ): { x: number; y: number } {
    return {
      x: originX + coord.x * tileSize,
      y: originY + coord.y * tileSize,
    };
  }

  /**
   * Izgara koordinatını dünya piksel merkez koordinatına çevirir.
   */
  static gridToWorldCenter(
    coord: GridCoord,
    tileSize = GridCoordinates.DEFAULT_TILE_SIZE,
    originX = 0,
    originY = 0,
  ): { x: number; y: number } {
    return {
      x: originX + coord.x * tileSize + Math.floor(tileSize / 2),
      y: originY + coord.y * tileSize + Math.floor(tileSize / 2),
    };
  }

  /**
   * Dünya piksel koordinatını ızgara koordinatına çevirir.
   */
  static worldToGrid(
    worldX: number,
    worldY: number,
    tileSize = GridCoordinates.DEFAULT_TILE_SIZE,
    originX = 0,
    originY = 0,
  ): GridCoord {
    return {
      x: Math.floor((worldX - originX) / tileSize),
      y: Math.floor((worldY - originY) / tileSize),
    };
  }

  /**
   * Belirtilen parselin dünya piksel sınırlarını döner.
   */
  static getPlotWorldBounds(
    plot: PlotDefinition,
    tileSize = GridCoordinates.DEFAULT_TILE_SIZE,
    originX = 0,
    originY = 0,
  ): { x: number; y: number; width: number; height: number } {
    return {
      x: originX,
      y: originY,
      width: plot.targetWidth * tileSize,
      height: plot.targetHeight * tileSize,
    };
  }

  /**
   * Bir parselin bir önceki parsele göre açtığı ek genişleme bölgesini döner.
   */
  static getPlotDeltaRegion(
    plotIndex: number,
    plots: PlotDefinition[] = FACTORY_PLOTS,
  ): { startX: number; startY: number; width: number; height: number } {
    const plot = plots.find((p) => p.index === plotIndex) || plots[0];
    const prevPlot = plots.find((p) => p.index === plotIndex - 1);

    if (!prevPlot) {
      return {
        startX: 0,
        startY: 0,
        width: plot.targetWidth,
        height: plot.targetHeight,
      };
    }

    return {
      startX: prevPlot.targetWidth < plot.targetWidth ? prevPlot.targetWidth : 0,
      startY: prevPlot.targetHeight < plot.targetHeight ? prevPlot.targetHeight : 0,
      width: plot.targetWidth,
      height: plot.targetHeight,
    };
  }
}
