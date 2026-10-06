/* ======================================================================
 * src/integration/FactoryGridIntegration.test.ts
 *
 * TASK-INT-02: 2D Fabrika Katı, Izgara ve Kamera Matematiği Entegrasyon Testi
 * - GridMap 24x24 mekânsal ızgara ve sabit giriş/çıkış portları
 * - FactoryEconomy parsel genişletme (Plot 0 -> Plot 1) ve boyut hesaplama
 * - CameraMath viewport, zoom clamping ve fabrika merkezleme matematiği
 * - Parsel genişleme verilerinin serileştirilmesi ve kalıcılığı
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GridMap } from '../factory/simulation/GridMap.ts';
import { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';
import { EconomyManager } from '../economy/EconomyManager.ts';
import { CameraMath } from '../factory/view/CameraMath.ts';
import { GridCoordinates } from '../factory/view/GridCoordinates.ts';
import { SaveManager, type StorageLike } from '../save/SaveManager.ts';

class MemoryStorage implements StorageLike {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
  removeItem(key: string): void {
    this.store.delete(key);
  }
}

describe('TASK-INT-02: 2D Factory Floor & Camera Math Integration Tests', () => {
  it('1. GridMap spatial indexing: initializes fixed intake and export nodes', () => {
    const grid = new GridMap(24, 24);
    grid.setIntake(1, 0, 'iron_ore', 1.0);
    grid.setExport(6, 7);

    assert.strictEqual(grid.getCellType(1, 0), 'INTAKE');
    assert.strictEqual(grid.getCellType(6, 7), 'EXPORT');
    assert.strictEqual(grid.getCellType(0, 0), 'EMPTY');

    const intakeCells = grid.getIntakeCells();
    assert.strictEqual(intakeCells.length, 1);
    assert.strictEqual(intakeCells[0].coord.x, 1);
    assert.strictEqual(intakeCells[0].coord.y, 0);

    const exportCells = grid.getExportCells();
    assert.strictEqual(exportCells.length, 1);
    assert.strictEqual(exportCells[0].coord.x, 6);
    assert.strictEqual(exportCells[0].coord.y, 7);
  });

  it('2. Factory Dimensions & Plot Expansion: 8x8 Starter to 12x8 Foundry Expansion', () => {
    const economy = new EconomyManager();
    const factoryEconomy = new FactoryEconomy(0, undefined, economy);

    // Initial Starter Workshop (8x8)
    const dimInitial = factoryEconomy.getCurrentFactoryDimensions();
    assert.strictEqual(dimInitial.width, 8);
    assert.strictEqual(dimInitial.height, 8);
    assert.strictEqual(factoryEconomy.isPlotUnlocked(0), true);
    assert.strictEqual(factoryEconomy.isPlotUnlocked(1), false);

    // Cannot unlock plot 1 without cash ($500)
    assert.strictEqual(factoryEconomy.unlockPlot(1), false);
    assert.strictEqual(factoryEconomy.isPlotUnlocked(1), false);

    // Add cash and unlock plot 1
    economy.addResources(600);
    const unlocked = factoryEconomy.unlockPlot(1);
    assert.strictEqual(unlocked, true);
    assert.strictEqual(factoryEconomy.isPlotUnlocked(1), true);

    // Verify expanded dimensions: 12x8
    const dimExpanded = factoryEconomy.getCurrentFactoryDimensions();
    assert.strictEqual(dimExpanded.width, 12);
    assert.strictEqual(dimExpanded.height, 8);
    assert.strictEqual(economy.resources.toNumber(), 100); // $600 - $500 = $100
  });

  it('3. CameraMath: Viewport bounds, center calculation and discrete zoom steps', () => {
    const viewport = { width: 800, height: 400 };

    // Factory at 8x8 (256x256 px at 32px per tile)
    const worldW = 8 * 32; // 256
    const worldH = 8 * 32; // 256

    // Phaser kamerası görüş alanının merkezine göre yakınlaştığı için ortalama scroll'u
    // zoom'dan bağımsızdır: (256 - 800) / 2 = -272, (256 - 400) / 2 = -72
    const center = CameraMath.computeCenterPosition(worldW, worldH, viewport);
    assert.strictEqual(center.x, -272);
    assert.strictEqual(center.y, -72);

    // Zooming in one step
    const zoomNext = CameraMath.getNextDiscreteZoom(1.0, 1, 0.25, 0.5, 2.5);
    assert.strictEqual(zoomNext, 1.25);

    // 1.25x'te görünen dünya 640x320'dir; sol-üst köşesi scroll + viewport * (1 - 1/zoom) / 2
    // olduğundan fabrika aynı scroll ile yine tam ortadadır.
    const effectiveW = 800 / zoomNext; // 640
    const effectiveH = 400 / zoomNext; // 320
    const viewLeft = center.x + (viewport.width - effectiveW) / 2;
    const viewTop = center.y + (viewport.height - effectiveH) / 2;
    assert.strictEqual(viewLeft, (256 - 640) / 2);
    assert.strictEqual(viewTop, (256 - 320) / 2);

    // Fabrika ekrandan küçükken sınırlar tek noktaya çökmez (çökerse fabrika köşeye
    // yapışır): min > max olur ve ortalanmış konum bu aralığın içinde kalır.
    const panBounds = CameraMath.computePanBounds(worldW, worldH, viewport, 1.0, 64);
    assert.ok(panBounds.minX > panBounds.maxX);
    const centered = CameraMath.clampPosition(center.x, center.y, panBounds);
    assert.strictEqual(centered.x, center.x);
    assert.strictEqual(centered.y, center.y);

    // Aralığın dışına taşan konum en yakın sınıra çekilir
    const clamped = CameraMath.clampPosition(-1000, 1000, panBounds);
    assert.strictEqual(clamped.x, Math.min(panBounds.minX, panBounds.maxX));
    assert.strictEqual(clamped.y, Math.max(panBounds.minY, panBounds.maxY));
  });

  it('4. GridCoordinates: Exact world pixel mapping at 32px tile size', () => {
    const originX = 0;
    const originY = 0;

    const wPos = GridCoordinates.gridToWorld({ x: 3, y: 4 }, 32, originX, originY);
    assert.strictEqual(wPos.x, 96);
    assert.strictEqual(wPos.y, 128);

    const cPos = GridCoordinates.gridToWorldCenter({ x: 3, y: 4 }, 32, originX, originY);
    assert.strictEqual(cPos.x, 112);
    assert.strictEqual(cPos.y, 144);

    const gPos = GridCoordinates.worldToGrid(112, 144, 32, originX, originY);
    assert.strictEqual(gPos.x, 3);
    assert.strictEqual(gPos.y, 4);
  });

  it('5. Save and Load: Unlocked plot expansion persistence across sessions', () => {
    const memoryStore = new MemoryStorage();
    SaveManager.setDefaultStorage(memoryStore);

    const economy1 = new EconomyManager();
    const factoryEconomy1 = new FactoryEconomy(0, undefined, economy1);

    economy1.addResources(5000);
    factoryEconomy1.unlockPlot(1); // 12x8
    factoryEconomy1.unlockPlot(2); // 16x12

    assert.strictEqual(factoryEconomy1.isPlotUnlocked(1), true);
    assert.strictEqual(factoryEconomy1.isPlotUnlocked(2), true);

    // Save with factoryEconomy
    SaveManager.save(economy1.serialize(), {
      factoryEconomy: factoryEconomy1,
    });

    // Load back
    const { data } = SaveManager.loadUnified();
    assert.ok(data.factoryEconomy);
    assert.ok(data.factoryEconomy.unlockedPlots.includes(1));
    assert.ok(data.factoryEconomy.unlockedPlots.includes(2));

    const factoryEconomy2 = new FactoryEconomy(0);
    factoryEconomy2.setUnlockedPlots(data.factoryEconomy.unlockedPlots);

    const dims = factoryEconomy2.getCurrentFactoryDimensions();
    assert.strictEqual(dims.width, 16);
    assert.strictEqual(dims.height, 12);

    SaveManager.setDefaultStorage(null);
  });
});
