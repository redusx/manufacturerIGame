/* ======================================================================
 * src/factory/progression/PlotExpansionManager.test.ts
 *
 * Fabrika Parsel Genişleme Yöneticisi birim testleri.
 * Node 24 native test koşucusu ile çalışır; Phaser bağımlılığı yoktur.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PlotExpansionManager } from './PlotExpansionManager.ts';
import { FactoryEconomy, FACTORY_PLOTS } from '../simulation/FactoryEconomy.ts';
import { GridMap } from '../simulation/GridMap.ts';

describe('PlotExpansionManager Progression & Bounds Tests', () => {
  it('Should initialize with Plot 0 unlocked and standard 8x8 factory bounds', () => {
    const economy = new FactoryEconomy(100);
    const grid = new GridMap(24, 24);
    const manager = new PlotExpansionManager(economy, grid);

    assert.strictEqual(manager.totalPlotCount, 5);
    assert.strictEqual(manager.unlockedPlotCount, 1);
    assert.strictEqual(manager.isAllPlotsUnlocked, false);

    assert.strictEqual(manager.isPlotUnlocked(0), true);
    assert.strictEqual(manager.isPlotUnlocked(1), false);
    assert.strictEqual(manager.isPlotUnlocked(2), false);

    const bounds = manager.getCurrentBounds();
    assert.deepStrictEqual(bounds, { width: 8, height: 8 });

    const nextPlot = manager.getNextAvailablePlot();
    assert.ok(nextPlot);
    assert.strictEqual(nextPlot.index, 1);
    assert.strictEqual(nextPlot.targetWidth, 12);
    assert.strictEqual(nextPlot.targetHeight, 8);
    assert.strictEqual(nextPlot.cost, 500);

    // Availability rules: Plot 0 already unlocked -> not available.
    // Plot 1 previous (0) is unlocked -> available.
    // Plot 2 previous (1) is locked -> not available.
    assert.strictEqual(manager.isPlotAvailable(0), false);
    assert.strictEqual(manager.isPlotAvailable(1), true);
    assert.strictEqual(manager.isPlotAvailable(2), false);
  });

  it('Should accurately compute delta region coordinates for all expansion tiers', () => {
    const economy = new FactoryEconomy();
    const grid = new GridMap(24, 24);
    const manager = new PlotExpansionManager(economy, grid);

    // Plot 0: 0x0 -> 8x8 = 64 cells
    const delta0 = manager.computeDeltaCoords(0);
    assert.strictEqual(delta0.length, 64);
    assert.ok(delta0.every((c) => c.x >= 0 && c.x < 8 && c.y >= 0 && c.y < 8));

    // Plot 1: 8x8 -> 12x8: width increases from 8 to 12 (+4), height stays 8.
    // Delta should be exactly 4 * 8 = 32 cells, all with x in [8..11] and y in [0..7].
    const delta1 = manager.computeDeltaCoords(1);
    assert.strictEqual(delta1.length, 32);
    assert.ok(delta1.every((c) => c.x >= 8 && c.x < 12 && c.y >= 0 && c.y < 8));

    // Plot 2: 12x8 -> 16x12: target 16*12 = 192 cells.
    // Previous had 12*8 = 96 cells.
    // Delta = 192 - 96 = 96 cells.
    const delta2 = manager.computeDeltaCoords(2);
    assert.strictEqual(delta2.length, 96);
    assert.ok(delta2.every((c) => c.x >= 0 && c.x < 16 && c.y >= 0 && c.y < 12));
    assert.ok(delta2.every((c) => !(c.x < 12 && c.y < 8)));

    // Plot 3: 16x12 -> 20x16: target 20*16 = 320 cells. Previous: 192 cells. Delta = 128 cells.
    const delta3 = manager.computeDeltaCoords(3);
    assert.strictEqual(delta3.length, 128);

    // Plot 4: 20x16 -> 24x24: target 24*24 = 576 cells. Previous: 320 cells. Delta = 256 cells.
    const delta4 = manager.computeDeltaCoords(4);
    assert.strictEqual(delta4.length, 256);

    // Invalid plot index returns empty array
    assert.deepStrictEqual(manager.computeDeltaCoords(99), []);
    assert.deepStrictEqual(manager.computeDeltaCoords(-1), []);
  });

  it('Should generate accurate status info and affordability states across all plots', () => {
    const economy = new FactoryEconomy(200); // Has $200
    const grid = new GridMap(24, 24);
    const manager = new PlotExpansionManager(economy, grid);

    assert.strictEqual(manager.canAffordPlot(1), false); // Plot 1 costs $500
    assert.strictEqual(manager.canAffordPlot(99), false);

    const statuses = manager.getAllPlotStatuses();
    assert.strictEqual(statuses.length, 5);

    // Plot 0: UNLOCKED
    assert.strictEqual(statuses[0].status, 'UNLOCKED');
    assert.strictEqual(statuses[0].isNext, false);

    // Plot 1: AVAILABLE (next in line, but unaffordable with $200)
    assert.strictEqual(statuses[1].status, 'AVAILABLE');
    assert.strictEqual(statuses[1].isNext, true);
    assert.strictEqual(statuses[1].cost, 500);
    assert.strictEqual(statuses[1].canAfford, false);
    assert.strictEqual(statuses[1].deltaCoordsCount, 32);

    // Plot 2: LOCKED
    assert.strictEqual(statuses[2].status, 'LOCKED');
    assert.strictEqual(statuses[2].isNext, false);
    assert.strictEqual(statuses[2].canAfford, false);

    // Add funds so Plot 1 becomes affordable
    economy.addMoney(400, 'EXPORT'); // Total $600
    assert.strictEqual(manager.canAffordPlot(1), true);

    const updatedStatuses = manager.getAllPlotStatuses();
    assert.strictEqual(updatedStatuses[1].canAfford, true);
  });

  it('Should enforce validation and reject invalid, locked or unaffordable unlock attempts', () => {
    const economy = new FactoryEconomy(100);
    const grid = new GridMap(24, 24);
    const manager = new PlotExpansionManager(economy, grid);

    // 1. Invalid plot
    const resInvalid = manager.unlockPlot(99);
    assert.strictEqual(resInvalid.success, false);
    assert.strictEqual(resInvalid.error, 'INVALID_PLOT');

    // 2. Already unlocked (Plot 0)
    const resAlready = manager.unlockPlot(0);
    assert.strictEqual(resAlready.success, false);
    assert.strictEqual(resAlready.error, 'ALREADY_UNLOCKED');

    // 3. Skipping plot (Plot 2 requires Plot 1 first)
    const resSkip = manager.unlockPlot(2);
    assert.strictEqual(resSkip.success, false);
    assert.strictEqual(resSkip.error, 'PREVIOUS_PLOT_REQUIRED');

    // 4. Insufficient funds (Plot 1 costs $500, balance is $100)
    const resBroke = manager.unlockPlot(1);
    assert.strictEqual(resBroke.success, false);
    assert.strictEqual(resBroke.error, 'INSUFFICIENT_FUNDS');
    assert.strictEqual(economy.money, 100); // Money must not change
    assert.strictEqual(manager.isPlotUnlocked(1), false);
  });

  it('Should successfully unlock plots sequentially and expand active factory bounds to 24x24', () => {
    const economy = new FactoryEconomy(100000);
    const grid = new GridMap(24, 24);
    const manager = new PlotExpansionManager(economy, grid);

    // Step 1: Unlock Plot 1 (Dökümhane Parseli, $500, 8x8 -> 12x8)
    const res1 = manager.unlockPlot(1);
    assert.strictEqual(res1.success, true);
    assert.strictEqual(res1.plotIndex, 1);
    assert.strictEqual(res1.cost, 500);
    assert.deepStrictEqual(res1.oldBounds, { width: 8, height: 8 });
    assert.deepStrictEqual(res1.newBounds, { width: 12, height: 8 });
    assert.strictEqual(res1.newlyUnlockedCoords.length, 32);
    assert.strictEqual(economy.money, 99500);
    assert.deepStrictEqual(manager.getCurrentBounds(), { width: 12, height: 8 });
    assert.strictEqual(manager.unlockedPlotCount, 2);

    // Step 2: Unlock Plot 2 (Mekanik İmalathane, $2500, 12x8 -> 16x12)
    const res2 = manager.unlockPlot(2);
    assert.strictEqual(res2.success, true);
    assert.deepStrictEqual(res2.newBounds, { width: 16, height: 12 });
    assert.strictEqual(res2.newlyUnlockedCoords.length, 96);
    assert.strictEqual(economy.money, 97000);

    // Step 3: Unlock Plot 3 (Montaj Tesisi, $10000, 16x12 -> 20x16)
    const res3 = manager.unlockPlot(3);
    assert.strictEqual(res3.success, true);
    assert.deepStrictEqual(res3.newBounds, { width: 20, height: 16 });
    assert.strictEqual(res3.newlyUnlockedCoords.length, 128);
    assert.strictEqual(economy.money, 87000);

    // Step 4: Unlock Plot 4 (Havacılık Mega Kompleksi, $30000, 20x16 -> 24x24)
    const res4 = manager.unlockPlot(4);
    assert.strictEqual(res4.success, true);
    assert.deepStrictEqual(res4.newBounds, { width: 24, height: 24 });
    assert.strictEqual(res4.newlyUnlockedCoords.length, 256);
    assert.strictEqual(economy.money, 57000);

    // Full expansion reached
    assert.strictEqual(manager.unlockedPlotCount, 5);
    assert.strictEqual(manager.isAllPlotsUnlocked, true);
    assert.strictEqual(manager.getNextAvailablePlot(), null);
    assert.deepStrictEqual(manager.getCurrentBounds(), { width: 24, height: 24 });

    // Trying to unlock plot 4 again now yields ALREADY_UNLOCKED
    const resRepeat = manager.unlockPlot(4);
    assert.strictEqual(resRepeat.success, false);
    assert.strictEqual(resRepeat.error, 'ALREADY_UNLOCKED');
  });
});
