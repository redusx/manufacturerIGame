/* ======================================================================
 * src/factory/simulation/LogisticsNetwork.test.ts — Lojistik Ağı Birim Testi
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GridMap } from './GridMap.ts';
import { LogisticsNetwork, type DeliveredItemEvent } from './LogisticsNetwork.ts';

describe('LogisticsNetwork Multi-Belt Flow', () => {
  it('Should transfer an item through a linear 3-belt chain', () => {
    const grid = new GridMap(5, 5);
    const network = new LogisticsNetwork(grid);

    const b0 = network.addConveyor({ x: 0, y: 0 }, 'EAST', 1.0);
    const b1 = network.addConveyor({ x: 1, y: 0 }, 'EAST', 1.0);
    const b2 = network.addConveyor({ x: 2, y: 0 }, 'EAST', 1.0);

    b0.acceptItem('iron_ore', 0.0);
    assert.equal(b0.itemCount, 1);
    assert.equal(b1.itemCount, 0);

    // 1 saniye sonra eşya b0'dan b1'e aktarılmış olmalı
    network.tick(1.05);
    assert.equal(b0.itemCount, 0);
    assert.equal(b1.itemCount, 1);

    // 1 saniye daha sonra b1'den b2'ye aktarılmış olmalı
    network.tick(1.05);
    assert.equal(b1.itemCount, 0);
    assert.equal(b2.itemCount, 1);
  });

  it('Should transfer an item around a 90-degree corner (EAST to SOUTH)', () => {
    const grid = new GridMap(5, 5);
    const network = new LogisticsNetwork(grid);

    const bEast = network.addConveyor({ x: 1, y: 1 }, 'EAST', 1.0);
    const bSouth = network.addConveyor({ x: 2, y: 1 }, 'SOUTH', 1.0);
    const bEnd = network.addConveyor({ x: 2, y: 2 }, 'SOUTH', 1.0);

    bEast.acceptItem('copper_wire', 0.0);

    // bEast -> bSouth aktarımı
    network.tick(1.1);
    assert.equal(bEast.itemCount, 0);
    assert.equal(bSouth.itemCount, 1);

    // bSouth -> bEnd aktarımı
    network.tick(1.1);
    assert.equal(bSouth.itemCount, 0);
    assert.equal(bEnd.itemCount, 1);
    assert.equal(bEnd.getItems()[0].itemId, 'copper_wire');
  });

  it('Should deliver items into an EXPORT node and trigger onItemDelivered callback', () => {
    const grid = new GridMap(5, 5);
    grid.setExport(2, 0);

    const network = new LogisticsNetwork(grid);
    const b0 = network.addConveyor({ x: 0, y: 0 }, 'EAST', 1.0);
    const b1 = network.addConveyor({ x: 1, y: 0 }, 'EAST', 1.0); // EXPORT'a (2, 0) bakar

    const delivered: DeliveredItemEvent[] = [];
    network.onItemDelivered = (evt) => delivered.push(evt);

    b0.acceptItem('gold_coin', 0.0);

    // b0 -> b1 -> EXPORT akışı (toplam ~2.2 saniye)
    network.tick(1.1);
    network.tick(1.1);

    assert.equal(delivered.length, 1);
    assert.equal(delivered[0].itemId, 'gold_coin');
    assert.deepEqual(delivered[0].exportCoord, { x: 2, y: 0 });
    assert.equal(b1.itemCount, 0); // Eşya ihraç edildiği için bant temizlenmeli
  });

  it('Network-wide backpressure: Dead end should fill up the entire chain cleanly without item loss', () => {
    const grid = new GridMap(5, 5);
    const network = new LogisticsNetwork(grid);

    // 3 bantlık hat; son bant (2, 0) duvara/sınır dışına bakar (tıkalı uç)
    const b0 = network.addConveyor({ x: 0, y: 0 }, 'EAST', 1.0);
    const b1 = network.addConveyor({ x: 1, y: 0 }, 'EAST', 1.0);
    const b2 = network.addConveyor({ x: 2, y: 0 }, 'EAST', 1.0);

    // Eşyaları sırayla hatta verelim (her bant 2 eşya, toplam kapasite 6)
    let injected = 0;
    for (let t = 0; t < 20; t++) {
      if (b0.canAcceptItem()) {
        b0.acceptItem(`item_${injected++}`, 0.0);
      }
      network.tick(0.6);
    }

    // Hat tıkandığında toplam 6 eşya hatta olmalı
    const totalItems = b0.itemCount + b1.itemCount + b2.itemCount;
    assert.equal(totalItems, 6, 'A 3-belt chain must hold exactly 6 items under full backpressure');
    assert.equal(b0.isFull, true);
    assert.equal(b1.isFull, true);
    assert.equal(b2.isFull, true);
  });

  it('INTAKE node should automatically spawn items onto an adjacent conveyor', () => {
    const grid = new GridMap(5, 5);
    grid.setIntake(0, 0, 'iron_ore', 1.0); // 1 saniyede 1 cevher

    const network = new LogisticsNetwork(grid);
    const b1 = network.addConveyor({ x: 1, y: 0 }, 'EAST', 1.0);

    assert.equal(b1.itemCount, 0);

    // 1.2 saniye sonra 1 eşya beslenmiş olmalı
    network.tick(1.2);
    assert.equal(b1.itemCount, 1);
    assert.equal(b1.getItems()[0].itemId, 'iron_ore');
  });

  it('Serialization and deserialization should restore entire conveyor network', () => {
    const grid1 = new GridMap(6, 6);
    const net1 = new LogisticsNetwork(grid1);

    const bA = net1.addConveyor({ x: 1, y: 1 }, 'EAST', 1.0);
    const bB = net1.addConveyor({ x: 2, y: 1 }, 'SOUTH', 1.0);
    bA.acceptItem('gear_1', 0.2);

    const savedState = net1.serialize();
    assert.equal(savedState.length, 2);

    // Yeni temiz ızgaraya geri yükle
    const grid2 = new GridMap(6, 6);
    const net2 = new LogisticsNetwork(grid2);
    net2.loadFromSerialized(savedState, 1.0);

    assert.equal(net2.conveyorCount, 2);
    const restoredA = net2.getConveyor(1, 1);
    assert.ok(restoredA !== undefined);
    assert.equal(restoredA.direction, 'EAST');
    assert.equal(restoredA.itemCount, 1);
    assert.equal(restoredA.getItems()[0].itemId, 'gear_1');
  });
});
