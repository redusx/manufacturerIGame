/* ======================================================================
 * src/factory/simulation/ConveyorBelt.test.ts — Konveyör Hücresi Birim Testi
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConveyorBelt, MIN_ITEM_SPACING } from './ConveyorBelt.ts';

describe('ConveyorBelt Slot Mechanics & Flow', () => {
  it('Empty belt should accept first item and report state correctly', () => {
    const belt = new ConveyorBelt({ x: 2, y: 3 }, 'EAST', 1.0);
    assert.equal(belt.isEmpty, true);
    assert.equal(belt.itemCount, 0);

    const accepted = belt.acceptItem('iron_ore', 0.0);
    assert.equal(accepted, true);
    assert.equal(belt.isEmpty, false);
    assert.equal(belt.itemCount, 1);
  });

  it('tick() should advance item smoothly according to speed', () => {
    const belt = new ConveyorBelt({ x: 0, y: 0 }, 'EAST', 1.0);
    belt.acceptItem('iron_ore', 0.0);

    // 0.3 saniye sonra progress 0.3 olmalı
    belt.tick(0.3);
    const items = belt.getItems();
    assert.ok(Math.abs(items[0].progress - 0.3) < 0.001);

    // 0.4 saniye daha -> 0.7 olmalı
    belt.tick(0.4);
    assert.ok(Math.abs(items[0].progress - 0.7) < 0.001);
  });

  it('Head item should stop at 1.0 when not popped (backpressure)', () => {
    const belt = new ConveyorBelt({ x: 0, y: 0 }, 'EAST', 1.0);
    belt.acceptItem('iron_ingot', 0.0);

    // 2 saniye ilerlet (hız 1.0, 1.0'ı aşmamalı)
    belt.tick(2.0);
    assert.equal(belt.getItems()[0].progress, 1.0);
    assert.ok(belt.peekFrontItem() !== null);
  });

  it('Should reject second item until first item advances past MIN_ITEM_SPACING', () => {
    const belt = new ConveyorBelt({ x: 0, y: 0 }, 'EAST', 1.0);
    belt.acceptItem('item_1', 0.0);

    // İlk eşya henüz 0.2'de iken ikinci eşya giremez
    belt.tick(0.2);
    assert.equal(belt.canAcceptItem(), false);
    assert.equal(belt.acceptItem('item_2', 0.0), false);

    // İlk eşya 0.5'e ulaştığında ikinci eşya girebilmeli
    belt.tick(0.35); // toplam 0.55
    assert.equal(belt.canAcceptItem(), true);
    assert.equal(belt.acceptItem('item_2', 0.0), true);
    assert.equal(belt.itemCount, 2);

    // İki eşya varken üçüncü eşya kesinlikle reddedilmeli
    assert.equal(belt.canAcceptItem(), false);
  });

  it('Tail item should never clip into head item when head item is blocked', () => {
    const belt = new ConveyorBelt({ x: 0, y: 0 }, 'EAST', 1.0);
    belt.acceptItem('head_item', 0.0);

    // İlk eşyayı 0.6'ya taşı
    belt.tick(0.6);
    belt.acceptItem('tail_item', 0.0);

    // Şimdi 3 saniye boyunca hiçbir eşyayı dışarı almadan tick işlet
    belt.tick(3.0);

    const items = belt.getItems();
    const tail = items[0];
    const head = items[1];

    assert.equal(head.progress, 1.0, 'Head item should be at exit (1.0)');
    assert.ok(
      Math.abs(tail.progress - (1.0 - MIN_ITEM_SPACING)) < 0.001,
      `Tail item must stop at ${1.0 - MIN_ITEM_SPACING}, got ${tail.progress}`,
    );
  });

  it('Popping front item should allow tail item to advance to 1.0', () => {
    const belt = new ConveyorBelt({ x: 0, y: 0 }, 'EAST', 1.0);
    belt.acceptItem('first', 0.0);
    belt.tick(0.6);
    belt.acceptItem('second', 0.0);
    belt.tick(1.0);

    // 'first' 1.0'da, 'second' 0.5'te olmalı
    const popped = belt.popFrontItem();
    assert.ok(popped !== null);
    assert.equal(popped.itemId, 'first');
    assert.equal(belt.itemCount, 1);

    // Sıradaki tick ile 'second' 1.0'a ilerlemeli
    belt.tick(0.6);
    assert.equal(belt.peekFrontItem()?.itemId, 'second');
    assert.equal(belt.peekFrontItem()?.progress, 1.0);
  });

  it('Serialization and deserialization should preserve belt state perfectly', () => {
    const belt = new ConveyorBelt({ x: 5, y: 7 }, 'SOUTH', 1.5);
    belt.acceptItem('gear', 0.0);
    belt.tick(0.4);

    const serialized = belt.serialize();
    assert.deepEqual(serialized.coord, { x: 5, y: 7 });
    assert.equal(serialized.direction, 'SOUTH');
    assert.equal(serialized.slots.length, 1);
    assert.equal(serialized.slots[0].itemId, 'gear');

    const restored = ConveyorBelt.deserialize(serialized, 1.5);
    assert.deepEqual(restored.coord, { x: 5, y: 7 });
    assert.equal(restored.direction, 'SOUTH');
    assert.equal(restored.speed, 1.5);
    assert.equal(restored.itemCount, 1);
    assert.equal(restored.getItems()[0].itemId, 'gear');
  });
});
