/* ======================================================================
 * src/factory/simulation/SplitterMerger.test.ts — Splitter ve Merger Birim Testi
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GridMap } from './GridMap.ts';
import { LogisticsNetwork } from './LogisticsNetwork.ts';

describe('Splitter & Merger Routing Mechanics', () => {
  it('Splitter should evenly distribute 4 items (50/50 round-robin) across 2 branches', () => {
    const grid = new GridMap(5, 5);
    const network = new LogisticsNetwork(grid);

    // Girdi bandı: (0, 1, EAST)
    const inBelt = network.addConveyor({ x: 0, y: 1 }, 'EAST', 2.0);

    // Splitter: (1, 1), Giriş EAST, Çıkışlar [EAST, SOUTH]
    network.addSplitter({ x: 1, y: 1 }, 'EAST', ['EAST', 'SOUTH']);

    // Çıkış hatları:
    // Kol A (Doğu): (2, 1, EAST) -> (3, 1, EAST)
    const outEast0 = network.addConveyor({ x: 2, y: 1 }, 'EAST', 2.0);
    const outEast1 = network.addConveyor({ x: 3, y: 1 }, 'EAST', 2.0);

    // Kol B (Güney): (1, 2, SOUTH) -> (1, 3, SOUTH)
    const outSouth0 = network.addConveyor({ x: 1, y: 2 }, 'SOUTH', 2.0);
    const outSouth1 = network.addConveyor({ x: 1, y: 3 }, 'SOUTH', 2.0);

    // 4 eşyayı sırayla hatta gönderelim
    for (let i = 0; i < 4; i++) {
      inBelt.acceptItem(`item_${i}`, 0.0);
      network.tick(0.6);
      network.tick(0.6);
    }

    // Biraz daha ilerletelim ki eşyalar kollara aksın
    for (let t = 0; t < 10; t++) {
      network.tick(0.5);
    }

    const totalEast = outEast0.itemCount + outEast1.itemCount;
    const totalSouth = outSouth0.itemCount + outSouth1.itemCount;

    assert.equal(totalEast, 2, 'East branch must receive exactly 2 items');
    assert.equal(totalSouth, 2, 'South branch must receive exactly 2 items');
  });

  it('Splitter overflow bypass: When one branch is blocked, all items route to the open branch', () => {
    const grid = new GridMap(5, 5);
    const network = new LogisticsNetwork(grid);

    // Girdi: (0, 1, EAST)
    const inBelt = network.addConveyor({ x: 0, y: 1 }, 'EAST', 2.0);

    // Splitter: (1, 1), Çıkışlar [EAST, SOUTH]
    network.addSplitter({ x: 1, y: 1 }, 'EAST', ['EAST', 'SOUTH']);

    // Kol A (Doğu) tıkalı: (2, 1) çıkışı kapalı ve 2 eşya ile tamamen dolu
    const outEast = network.addConveyor({ x: 2, y: 1 }, 'EAST', 2.0);
    outEast.acceptItem('blocking_1', 0.0);
    outEast.tick(0.6); // blocking_1 çıkışa (1.0) ulaştı
    outEast.acceptItem('blocking_2', 0.0); // blocking_2 arkaya girdi, Kol A tamamen dolu!

    // Kol B (Güney) açık: (1, 2)
    const outSouth0 = network.addConveyor({ x: 1, y: 2 }, 'SOUTH', 2.0);
    const outSouth1 = network.addConveyor({ x: 1, y: 3 }, 'SOUTH', 2.0);

    // Girdiye 2 yeni eşya verelim
    inBelt.acceptItem('item_A', 0.0);
    network.tick(0.6);
    inBelt.acceptItem('item_B', 0.0);

    for (let t = 0; t < 10; t++) {
      network.tick(0.5);
    }

    // Doğu kolu tıkalı olduğu için item_A ve item_B Güney kolundan akmış olmalı!
    const southItems = [...outSouth0.getItems(), ...outSouth1.getItems()].map(
      (it) => it.itemId,
    );

    assert.ok(southItems.includes('item_A'), 'item_A should bypass to South branch');
    assert.ok(southItems.includes('item_B'), 'item_B should bypass to South branch');
  });

  it('Merger should merge two incoming conveyor lines into one output line', () => {
    const grid = new GridMap(5, 5);
    const network = new LogisticsNetwork(grid);

    // Hat 1 (Batı'dan gelen): (0, 1, EAST)
    const inWest = network.addConveyor({ x: 0, y: 1 }, 'EAST', 2.0);

    // Hat 2 (Kuzey'den gelen): (1, 0, SOUTH)
    const inNorth = network.addConveyor({ x: 1, y: 0 }, 'SOUTH', 2.0);

    // Merger: (1, 1), Girişler [EAST, SOUTH], Çıkış EAST
    network.addMerger({ x: 1, y: 1 }, ['EAST', 'SOUTH'], 'EAST');

    // Çıkış Hattı: (2, 1, EAST)
    const outBelt = network.addConveyor({ x: 2, y: 1 }, 'EAST', 2.0);

    inWest.acceptItem('item_from_west', 0.0);
    inNorth.acceptItem('item_from_north', 0.0);

    for (let t = 0; t < 10; t++) {
      network.tick(0.5);
    }

    // İki eşya da çıkış bandına aktarılmış olmalı
    assert.equal(outBelt.itemCount, 2);
  });
});
