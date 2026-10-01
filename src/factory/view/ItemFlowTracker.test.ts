/* ======================================================================
 * src/factory/view/ItemFlowTracker.test.ts — Eşya Akış Takipçisi Testleri
 *
 * Konveyörler, virajlar, Splitter ve Merger üzerindeki eşyaların dünya
 * koordinatlarını, bantlar arası sıfır-boşluklu kesintisiz geçişlerini ve
 * Bézier dönemeç enterpolasyonunu test eder.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ItemFlowTracker } from './ItemFlowTracker.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { GridMap } from '../simulation/GridMap.ts';

describe('ItemFlowTracker World Position & Interpolation Mechanics', () => {
  const TILE_SIZE = 32;

  it('Empty network should return 0 renderable items', () => {
    const grid = new GridMap(8, 8);
    const network = new LogisticsNetwork(grid);

    const items = ItemFlowTracker.collectRenderableItems(network, TILE_SIZE);
    assert.strictEqual(items.length, 0);
  });

  it('Single linear belt should compute exact positions at progress 0.0, 0.5, and 1.0', () => {
    const grid = new GridMap(8, 8);
    const network = new LogisticsNetwork(grid);

    // (0, 0) hücresinde Doğuya bakan konveyör
    const belt = network.addConveyor({ x: 0, y: 0 }, 'EAST');
    belt.acceptItem('iron_ore', 0.0);

    // 1. Progress = 0.0 (Giriş sol kenarı: x:0, y:16)
    let rendered = ItemFlowTracker.collectRenderableItems(network, TILE_SIZE, 0, 0);
    assert.strictEqual(rendered.length, 1);
    assert.strictEqual(rendered[0].itemId, 'iron_ore');
    assert.strictEqual(rendered[0].worldX, 0);
    assert.strictEqual(rendered[0].worldY, 16);
    assert.strictEqual(rendered[0].angleRad, 0);

    // 2. İlerlet: progress = 0.5 (Hücre merkezi: x:16, y:16)
    belt.tick(0.5); // speed 1.0 * 0.5 = 0.5
    rendered = ItemFlowTracker.collectRenderableItems(network, TILE_SIZE, 0, 0);
    assert.strictEqual(rendered[0].worldX, 16);
    assert.strictEqual(rendered[0].worldY, 16);

    // 3. İlerlet: progress = 1.0 (Çıkış sağ kenarı: x:32, y:16)
    belt.tick(0.5);
    rendered = ItemFlowTracker.collectRenderableItems(network, TILE_SIZE, 0, 0);
    assert.strictEqual(rendered[0].worldX, 32);
    assert.strictEqual(rendered[0].worldY, 16);
  });

  it('Linear hand-off: Exit of Belt 1 at 1.0 must mathematically equal entry of Belt 2 at 0.0', () => {
    const grid = new GridMap(8, 8);
    const network = new LogisticsNetwork(grid);

    // İki ardışık Doğu bandı: (0, 0) ve (1, 0)
    const belt1 = network.addConveyor({ x: 0, y: 0 }, 'EAST');
    const belt2 = network.addConveyor({ x: 1, y: 0 }, 'EAST');

    belt1.acceptItem('iron_ingot', 0.0);
    belt1.tick(1.0); // belt1 ucuna ulaştı (progress = 1.0)

    belt2.acceptItem('copper_ingot', 0.0); // belt2 girişinde (progress = 0.0)

    const rendered = ItemFlowTracker.collectRenderableItems(network, TILE_SIZE, 0, 0);
    assert.strictEqual(rendered.length, 2);

    const item1 = rendered.find((r) => r.itemId === 'iron_ingot')!;
    const item2 = rendered.find((r) => r.itemId === 'copper_ingot')!;

    // Belt 1 çıkışı (x: 32, y: 16) ile Belt 2 girişi (x: 32, y: 16) tam olarak aynı pikseldedir
    assert.strictEqual(item1.worldX, 32);
    assert.strictEqual(item1.worldY, 16);
    assert.strictEqual(item2.worldX, 32);
    assert.strictEqual(item2.worldY, 16);
    assert.strictEqual(item1.worldX, item2.worldX);
    assert.strictEqual(item1.worldY, item2.worldY);
  });

  it('Corner curve hand-off: Linear Belt -> 90° Turn (EAST to SOUTH) -> Linear South Belt', () => {
    const grid = new GridMap(8, 8);
    const network = new LogisticsNetwork(grid);

    // Zincir: (0, 0) EAST -> (1, 0) SOUTH (Viraj) -> (1, 1) SOUTH
    const b1 = network.addConveyor({ x: 0, y: 0 }, 'EAST');
    const b2 = network.addConveyor({ x: 1, y: 0 }, 'SOUTH'); // Viraj: Batıdan girer, Güneye çıkar
    const b3 = network.addConveyor({ x: 1, y: 1 }, 'SOUTH');

    // 1. b1 çıkışı ile b2 girişi kesişimi:
    // b1: x:0..32, y:0..32 -> çıkış sağ kenar ortası = (32, 16)
    // b2: x:32..64, y:0..32 -> giriş sol kenar ortası = (32, 16)
    b1.acceptItem('item_A', 0.0);
    b1.tick(1.0);
    b2.acceptItem('item_B', 0.0);

    let rendered = ItemFlowTracker.collectRenderableItems(network, TILE_SIZE, 0, 0);
    let rA = rendered.find((r) => r.itemId === 'item_A')!;
    let rB = rendered.find((r) => r.itemId === 'item_B')!;
    assert.strictEqual(rA.worldX, 32);
    assert.strictEqual(rA.worldY, 16);
    assert.strictEqual(rB.worldX, 32);
    assert.strictEqual(rB.worldY, 16);

    // 2. b2 çıkışı ile b3 girişi kesişimi:
    // b2 çıkışı: alt kenar ortası = x: 32 + 16 = 48, y: 32
    // b3 girişi: üst kenar ortası = x: 32 + 16 = 48, y: 32
    b2.tick(1.0); // item_B viraj sonuna (progress = 1.0) geldi
    b3.acceptItem('item_C', 0.0); // item_C b3 girişinde

    rendered = ItemFlowTracker.collectRenderableItems(network, TILE_SIZE, 0, 0);
    rB = rendered.find((r) => r.itemId === 'item_B')!;
    const rC = rendered.find((r) => r.itemId === 'item_C')!;

    assert.strictEqual(rB.worldX, 48);
    assert.strictEqual(rB.worldY, 32);
    assert.strictEqual(rC.worldX, 48);
    assert.strictEqual(rC.worldY, 32);
    assert.strictEqual(rB.worldX, rC.worldX);
    assert.strictEqual(rB.worldY, rC.worldY);
  });

  it('Backpressure spacing: 2 items on the same belt maintain 0.5 tile spacing', () => {
    const grid = new GridMap(8, 8);
    const network = new LogisticsNetwork(grid);

    const belt = network.addConveyor({ x: 2, y: 3 }, 'EAST');
    belt.acceptItem('first', 0.0);
    belt.tick(0.6); // first progress = 0.6
    belt.acceptItem('second', 0.0); // second girer

    const rendered = ItemFlowTracker.collectRenderableItems(network, TILE_SIZE, 0, 0);
    assert.strictEqual(rendered.length, 2);

    const first = rendered.find((r) => r.itemId === 'first')!;
    const second = rendered.find((r) => r.itemId === 'second')!;

    assert.strictEqual(first.progress, 0.6);
    assert.strictEqual(second.progress, 0.0);

    // first ile second arasındaki mesafe: 0.6 * 32 = 19.2 px
    const dx = first.worldX - second.worldX;
    assert.ok(Math.abs(dx - 19.2) < 0.1);
  });

  it('Should support custom world origin offsets', () => {
    const grid = new GridMap(8, 8);
    const network = new LogisticsNetwork(grid);

    const belt = network.addConveyor({ x: 1, y: 1 }, 'EAST');
    belt.acceptItem('ore', 0.0);
    belt.tick(0.5); // Merkez (progress = 0.5)

    // originX = 100, originY = 200, tile: (1, 1) -> sol-üst: (132, 232), merkez: (148, 248)
    const rendered = ItemFlowTracker.collectRenderableItems(network, TILE_SIZE, 100, 200);
    assert.strictEqual(rendered.length, 1);
    assert.strictEqual(rendered[0].worldX, 148);
    assert.strictEqual(rendered[0].worldY, 248);
  });
});
