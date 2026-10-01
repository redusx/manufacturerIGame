/* ======================================================================
 * src/factory/view/GridView.test.ts — Izgara Koordinat ve Mekânsal Yerleşim Testleri
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GridCoordinates } from './GridCoordinates.ts';
import { FACTORY_PLOTS } from '../simulation/FactoryEconomy.ts';

describe('GridView Spatial Mathematics & Coordinate Transforms', () => {
  it('gridToWorld should convert tile grid coords to pixel coords accurately', () => {
    // 32px varsayılan tile boyutu ve (0, 0) orijin
    const originWorld = GridCoordinates.gridToWorld({ x: 0, y: 0 });
    assert.deepEqual(originWorld, { x: 0, y: 0 });

    const tileCoord = GridCoordinates.gridToWorld({ x: 3, y: 5 });
    assert.deepEqual(tileCoord, { x: 3 * 32, y: 5 * 32 }); // (96, 160)

    // Özel orijin (100, 200) ile
    const offsetCoord = GridCoordinates.gridToWorld({ x: 2, y: 2 }, 32, 100, 200);
    assert.deepEqual(offsetCoord, { x: 100 + 64, y: 200 + 64 });
  });

  it('gridToWorldCenter should align with center of 32x32 tiles', () => {
    const center = GridCoordinates.gridToWorldCenter({ x: 0, y: 0 });
    assert.deepEqual(center, { x: 16, y: 16 });

    const centerTile = GridCoordinates.gridToWorldCenter({ x: 4, y: 2 });
    assert.deepEqual(centerTile, { x: 4 * 32 + 16, y: 2 * 32 + 16 });
  });

  it('worldToGrid should map world pixel coordinates back to discrete grid cells', () => {
    // Hücre içi rastgele pikseller
    assert.deepEqual(GridCoordinates.worldToGrid(10, 20), { x: 0, y: 0 });
    assert.deepEqual(GridCoordinates.worldToGrid(31, 31), { x: 0, y: 0 });
    assert.deepEqual(GridCoordinates.worldToGrid(32, 32), { x: 1, y: 1 });
    assert.deepEqual(GridCoordinates.worldToGrid(95, 165), { x: 2, y: 5 }); // 95/32 = 2.96 -> 2, 165/32 = 5.15 -> 5

    // Özel orijin (50, 50) ile
    assert.deepEqual(GridCoordinates.worldToGrid(55, 55, 32, 50, 50), { x: 0, y: 0 });
    assert.deepEqual(GridCoordinates.worldToGrid(85, 55, 32, 50, 50), { x: 1, y: 0 });
  });

  it('getPlotWorldBounds should compute exact bounding boxes for all 5 factory expansion plots', () => {
    // Plot 0: 8x8 -> 256x256
    const b0 = GridCoordinates.getPlotWorldBounds(FACTORY_PLOTS[0]);
    assert.equal(b0.width, 256);
    assert.equal(b0.height, 256);

    // Plot 1: 12x8 -> 384x256
    const b1 = GridCoordinates.getPlotWorldBounds(FACTORY_PLOTS[1]);
    assert.equal(b1.width, 384);
    assert.equal(b1.height, 256);

    // Plot 2: 16x12 -> 512x384
    const b2 = GridCoordinates.getPlotWorldBounds(FACTORY_PLOTS[2]);
    assert.equal(b2.width, 512);
    assert.equal(b2.height, 384);

    // Plot 3: 20x16 -> 640x512
    const b3 = GridCoordinates.getPlotWorldBounds(FACTORY_PLOTS[3]);
    assert.equal(b3.width, 640);
    assert.equal(b3.height, 512);

    // Plot 4: 24x24 -> 768x768
    const b4 = GridCoordinates.getPlotWorldBounds(FACTORY_PLOTS[4]);
    assert.equal(b4.width, 768);
    assert.equal(b4.height, 768);
  });

  it('getPlotDeltaRegion should calculate exact incremental expansion area', () => {
    // Plot 0 başlangıç
    const d0 = GridCoordinates.getPlotDeltaRegion(0);
    assert.deepEqual(d0, { startX: 0, startY: 0, width: 8, height: 8 });

    // Plot 1: 8x8'den 12x8'e sağa doğru 4 sütun ekler (startX = 8)
    const d1 = GridCoordinates.getPlotDeltaRegion(1);
    assert.equal(d1.startX, 8);
    assert.equal(d1.startY, 0);
    assert.equal(d1.width, 12);
    assert.equal(d1.height, 8);

    // Plot 2: 12x8'den 16x12'ye sağa ve aşağıya ekler (startX = 12, startY = 8)
    const d2 = GridCoordinates.getPlotDeltaRegion(2);
    assert.equal(d2.startX, 12);
    assert.equal(d2.startY, 8);
    assert.equal(d2.width, 16);
    assert.equal(d2.height, 12);
  });
});
