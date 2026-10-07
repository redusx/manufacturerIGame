/* ======================================================================
 * src/factory/progression/PlotExpansionManager.ts — Fabrika Parsel Genişleme Yöneticisi
 *
 * Kalıcı fabrika ızgarasının kademeli olarak yeni parsellerle
 * ($8x8 -> 12x8 -> 16x12 -> 20x16 -> 24x24) genişletilmesini, maliyet
 * denetimlerini, ardışık kilit açılımlarını, yeni açılan alan koordinatlarının
 * (delta region) hesaplanmasını ve kilit açılma görsel geri bildirimlerini yönetir.
 *
 * docs/PROGRESSION.md, DEC-006 ve docs/ART_DIRECTION.md standartlarına uygundur.
 * Node 24 uyumludur; Phaser bağımlılığı isteğe bağlı görsel metodlarla sınırlandırılmıştır.
 * ====================================================================== */

import type { GridCoord } from '../types.ts';
import {
  FactoryEconomy,
  FACTORY_PLOTS,
  type PlotDefinition,
} from '../simulation/FactoryEconomy.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { GridCoordinates } from '../view/GridCoordinates.ts';
import { PALETTE } from '../../ui/theme.ts';

export type PlotState = 'UNLOCKED' | 'AVAILABLE' | 'LOCKED';

export interface PlotStatusInfo {
  plot: PlotDefinition;
  status: PlotState;
  cost: number;
  canAfford: boolean;
  isNext: boolean;
  deltaCoordsCount: number;
}

export interface PlotUnlockResult {
  success: boolean;
  plotIndex: number;
  plotName: string;
  cost: number;
  oldBounds: { width: number; height: number };
  newBounds: { width: number; height: number };
  newlyUnlockedCoords: GridCoord[];
  error?: 'ALREADY_UNLOCKED' | 'PREVIOUS_PLOT_REQUIRED' | 'INSUFFICIENT_FUNDS' | 'INVALID_PLOT';
}

export class PlotExpansionManager {
  readonly economy: FactoryEconomy;
  readonly grid: GridMap;
  readonly plots: readonly PlotDefinition[];

  constructor(
    economy: FactoryEconomy,
    grid: GridMap,
    plots: readonly PlotDefinition[] = FACTORY_PLOTS,
  ) {
    this.economy = economy;
    this.grid = grid;
    this.plots = plots;
  }

  // -------------------------------------------------------------
  // DURUM VE PARSEL SORGULARI
  // -------------------------------------------------------------

  /** Toplam tanımlı parsel sayısı */
  get totalPlotCount(): number {
    return this.plots.length;
  }

  /** Açılmış parsel sayısı */
  get unlockedPlotCount(): number {
    let count = 0;
    for (const plot of this.plots) {
      if (this.economy.isPlotUnlocked(plot.index)) {
        count++;
      }
    }
    return count;
  }

  /** Tüm parseller açıldı mı? */
  get isAllPlotsUnlocked(): boolean {
    return this.unlockedPlotCount >= this.plots.length;
  }

  /** İndeks numarasıyla parsel tanımını döner */
  getPlot(plotIndex: number): PlotDefinition | undefined {
    return this.plots.find((p) => p.index === plotIndex);
  }

  /** Parsel açılmış mı? */
  isPlotUnlocked(plotIndex: number): boolean {
    return this.economy.isPlotUnlocked(plotIndex);
  }

  /**
   * Parsel satın alınmaya hazır mı?
   * (Kendisinden önceki tüm parseller açılmış ve kendisi henüz açılmamış olmalıdır).
   */
  isPlotAvailable(plotIndex: number): boolean {
    if (this.isPlotUnlocked(plotIndex)) return false;
    if (plotIndex === 0) return true;
    return this.isPlotUnlocked(plotIndex - 1);
  }

  /**
   * Sıradaki ilk açılabilir parseli döner (hepsi açıksa null).
   */
  getNextAvailablePlot(): PlotDefinition | null {
    for (const plot of this.plots) {
      if (!this.economy.isPlotUnlocked(plot.index)) {
        return plot;
      }
    }
    return null;
  }

  /** Belirtilen parsel için oyuncunun parası yetiyor mu? */
  canAffordPlot(plotIndex: number): boolean {
    const plot = this.getPlot(plotIndex);
    if (!plot) return false;
    return this.economy.canAfford(plot.cost);
  }

  /** Mevcut aktif fabrika sınırlarını döner ({ width, height }) */
  getCurrentBounds(): { width: number; height: number } {
    return this.economy.getCurrentFactoryDimensions();
  }

  // -------------------------------------------------------------
  // DELTA ALAN HESAPLAMA (YENİ AÇILAN HÜCRELER)
  // -------------------------------------------------------------

  /**
   * Bir parsel açıldığında eklenen yeni hücrelerin koordinat listesini hesaplar.
   */
  computeDeltaCoords(plotIndex: number): GridCoord[] {
    const targetPlot = this.getPlot(plotIndex);
    if (!targetPlot) return [];

    // Önceki parsel boyutları
    const prevPlot = this.getPlot(plotIndex - 1);
    const prevW = prevPlot ? prevPlot.targetWidth : 0;
    const prevH = prevPlot ? prevPlot.targetHeight : 0;

    const newW = targetPlot.targetWidth;
    const newH = targetPlot.targetHeight;

    const coords: GridCoord[] = [];

    for (let y = 0; y < newH; y++) {
      for (let x = 0; x < newW; x++) {
        // Eğer hücre önceki parsel sınırları dışındaysa, bu parsele aittir
        const wasInPrev = x < prevW && y < prevH;
        if (!wasInPrev) {
          coords.push({ x, y });
        }
      }
    }

    return coords;
  }

  /**
   * Tüm parsellerin durum özet listesini döner.
   */
  getAllPlotStatuses(): PlotStatusInfo[] {
    const nextPlot = this.getNextAvailablePlot();

    return this.plots.map((plot) => {
      const isUnlocked = this.isPlotUnlocked(plot.index);
      const isAvailable = this.isPlotAvailable(plot.index);
      const status: PlotState = isUnlocked
        ? 'UNLOCKED'
        : isAvailable
          ? 'AVAILABLE'
          : 'LOCKED';

      const canAfford = this.economy.canAfford(plot.cost);
      const isNext = nextPlot !== null && nextPlot.index === plot.index;
      const deltaCoords = this.computeDeltaCoords(plot.index);

      return {
        plot,
        status,
        cost: plot.cost,
        canAfford,
        isNext,
        deltaCoordsCount: deltaCoords.length,
      };
    });
  }

  // -------------------------------------------------------------
  // PARSEL SATIN ALMA VE AÇMA (UNLOCK)
  // -------------------------------------------------------------

  /**
   * Belirtilen parseli satın alır, cüzdandan düşer ve fabrikayı genişletir.
   */
  unlockPlot(plotIndex: number): PlotUnlockResult {
    const plot = this.getPlot(plotIndex);
    if (!plot) {
      return {
        success: false,
        plotIndex,
        plotName: '',
        cost: 0,
        oldBounds: this.getCurrentBounds(),
        newBounds: this.getCurrentBounds(),
        newlyUnlockedCoords: [],
        error: 'INVALID_PLOT',
      };
    }

    if (this.isPlotUnlocked(plotIndex)) {
      return {
        success: false,
        plotIndex,
        plotName: plot.name,
        cost: plot.cost,
        oldBounds: this.getCurrentBounds(),
        newBounds: this.getCurrentBounds(),
        newlyUnlockedCoords: [],
        error: 'ALREADY_UNLOCKED',
      };
    }

    if (!this.isPlotAvailable(plotIndex)) {
      return {
        success: false,
        plotIndex,
        plotName: plot.name,
        cost: plot.cost,
        oldBounds: this.getCurrentBounds(),
        newBounds: this.getCurrentBounds(),
        newlyUnlockedCoords: [],
        error: 'PREVIOUS_PLOT_REQUIRED',
      };
    }

    if (!this.canAffordPlot(plotIndex)) {
      return {
        success: false,
        plotIndex,
        plotName: plot.name,
        cost: plot.cost,
        oldBounds: this.getCurrentBounds(),
        newBounds: this.getCurrentBounds(),
        newlyUnlockedCoords: [],
        error: 'INSUFFICIENT_FUNDS',
      };
    }

    const oldBounds = this.getCurrentBounds();
    const newlyUnlockedCoords = this.computeDeltaCoords(plotIndex);

    // Satın al ve aç
    const success = this.economy.unlockPlot(plotIndex);
    if (!success) {
      return {
        success: false,
        plotIndex,
        plotName: plot.name,
        cost: plot.cost,
        oldBounds,
        newBounds: oldBounds,
        newlyUnlockedCoords: [],
        error: 'INSUFFICIENT_FUNDS',
      };
    }

    const newBounds = this.getCurrentBounds();

    return {
      success: true,
      plotIndex,
      plotName: plot.name,
      cost: plot.cost,
      oldBounds,
      newBounds,
      newlyUnlockedCoords,
    };
  }

  // -------------------------------------------------------------
  // PHASER 3 GÖRSEL KUTLAMA VE ANİMASYON DESTEĞİ
  // -------------------------------------------------------------

  /**
   * Parsel açıldığında yeni karolar üzerinde altın dalga ışıltısı oynatır.
   */
  static playUnlockCelebration(
    scene: Phaser.Scene,
    result: PlotUnlockResult,
    tileSize = GridCoordinates.DEFAULT_TILE_SIZE,
    originX = 0,
    originY = 0,
  ): void {
    if (!result.success) return;

    // 1. Yeni karolar üzerinde altın dalga ışıltısı
    const coords = result.newlyUnlockedCoords;
    for (let i = 0; i < coords.length; i++) {
      const c = coords[i];
      const worldPos = GridCoordinates.gridToWorldCenter(c, tileSize, originX, originY);

      if (scene.textures.exists('star_pixel')) {
        const spark = scene.add
          .image(worldPos.x, worldPos.y, 'star_pixel')
          .setDepth(130)
          .setScale(0)
          .setAlpha(0.9)
          .setTint(PALETTE.resourceGold);

        scene.tweens.add({
          targets: spark,
          scale: 1.5,
          alpha: 0,
          y: worldPos.y - 16,
          duration: 450 + (i % 8) * 40,
          delay: (i % 12) * 20,
          ease: 'Cubic.easeOut',
          onComplete: () => spark.destroy(),
        });
      }
    }

    // Kutlama metni sahnenin bildirim (toast) katmanından gösterilir; burada yalnızca
    // dünya üzerindeki ışıltı oynatılır.
  }
}
