/* ======================================================================
 * src/factory/view/SpritePoolCore.test.ts — Nesne Havuzu Temel Testleri
 *
 * Önceden ayırma (pre-allocation), edinme (acquire), iade (release),
 * LIFO geri dönüşümü, otomatik genişleme, maxCapacity sınırı ve
 * GC önleme metriklerini test eder.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { SpritePoolCore } from './SpritePoolCore.ts';

interface DummySprite {
  id: number;
  inUse: boolean;
  value: number;
}

describe('SpritePoolCore Object Recycling & Allocation', () => {
  it('Should pre-allocate initialCapacity items on creation', () => {
    let createdCount = 0;
    const pool = new SpritePoolCore<DummySprite>(
      (idx) => {
        createdCount++;
        return { id: idx, inUse: false, value: 0 };
      },
      (item) => {
        item.inUse = false;
        item.value = 0;
      },
      { initialCapacity: 30, maxCapacity: 100 },
    );

    assert.strictEqual(createdCount, 30);
    assert.strictEqual(pool.totalAllocated, 30);
    assert.strictEqual(pool.availableCount, 30);
    assert.strictEqual(pool.activeCount, 0);
    assert.strictEqual(pool.peakActiveCount, 0);
  });

  it('Acquire and release cycle should reuse existing objects without re-allocation', () => {
    let creations = 0;
    const pool = new SpritePoolCore<DummySprite>(
      (idx) => {
        creations++;
        return { id: idx, inUse: false, value: 0 };
      },
      (item) => {
        item.inUse = false;
        item.value = 0;
      },
      { initialCapacity: 5, maxCapacity: 20 },
    );

    // 1. Nesne edin
    const item1 = pool.acquire();
    assert.ok(item1);
    item1.inUse = true;
    item1.value = 42;

    assert.strictEqual(creations, 5); // Yeni nesne üretilmedi, havuzdan alındı
    assert.strictEqual(pool.activeCount, 1);
    assert.strictEqual(pool.availableCount, 4);
    assert.strictEqual(pool.peakActiveCount, 1);

    // 2. Nesneyi iade et
    const released = pool.release(item1);
    assert.strictEqual(released, true);
    assert.strictEqual(pool.activeCount, 0);
    assert.strictEqual(pool.availableCount, 5);
    // Reset fonksiyonu çalışmış olmalı
    assert.strictEqual(item1.inUse, false);
    assert.strictEqual(item1.value, 0);

    // 3. Tekrar nesne edin -> LIFO gereği aynı nesne geri gelmeli
    const item2 = pool.acquire();
    assert.strictEqual(item2, item1);
    assert.strictEqual(creations, 5); // Hala 5 nesne var, 0 GC
  });

  it('Should auto-grow in steps when capacity is exceeded up to maxCapacity', () => {
    const pool = new SpritePoolCore<DummySprite>(
      (idx) => ({ id: idx, inUse: false, value: 0 }),
      undefined,
      { initialCapacity: 2, maxCapacity: 6, growthStep: 2 },
    );

    assert.strictEqual(pool.totalAllocated, 2);

    // 2 nesne edin
    const a = pool.acquire();
    const b = pool.acquire();
    assert.strictEqual(pool.availableCount, 0);

    // 3. nesne istendiğinde büyüme adımı (2 adet) tetiklenmeli
    const c = pool.acquire();
    assert.ok(c);
    assert.strictEqual(pool.totalAllocated, 4);
    assert.strictEqual(pool.activeCount, 3);
    assert.strictEqual(pool.availableCount, 1);

    // Doyuma kadar edin
    const d = pool.acquire();
    const e = pool.acquire(); // Toplam 6'ya büyür
    const f = pool.acquire();
    assert.strictEqual(pool.activeCount, 6);
    assert.strictEqual(pool.totalAllocated, 6);
    assert.strictEqual(pool.isExhausted, true);

    // 7. nesne maxCapacity (6) aşılamayacağı için null dönmeli
    const g = pool.acquire();
    assert.strictEqual(g, null);

    // Biri bırakılınca tekrar alınabilmeli
    pool.release(a!);
    assert.strictEqual(pool.isExhausted, false);
    const h = pool.acquire();
    assert.strictEqual(h, a);
  });

  it('releaseAll should return all active objects to the free list', () => {
    const pool = new SpritePoolCore<DummySprite>(
      (idx) => ({ id: idx, inUse: false, value: 0 }),
      (it) => {
        it.inUse = false;
      },
      { initialCapacity: 10 },
    );

    const items = [pool.acquire(), pool.acquire(), pool.acquire()];
    assert.strictEqual(pool.activeCount, 3);
    assert.strictEqual(pool.availableCount, 7);

    pool.releaseAll();
    assert.strictEqual(pool.activeCount, 0);
    assert.strictEqual(pool.availableCount, 10);
    for (const it of items) {
      assert.strictEqual(it!.inUse, false);
    }
  });

  it('forEachActive should iterate over exactly the currently acquired items', () => {
    const pool = new SpritePoolCore<DummySprite>(
      (idx) => ({ id: idx, inUse: false, value: 0 }),
      undefined,
      { initialCapacity: 5 },
    );

    const a = pool.acquire()!;
    const b = pool.acquire()!;
    a.value = 100;
    b.value = 200;

    const seenValues: number[] = [];
    pool.forEachActive((item) => {
      seenValues.push(item.value);
    });

    assert.strictEqual(seenValues.length, 2);
    assert.ok(seenValues.includes(100));
    assert.ok(seenValues.includes(200));
  });

  it('Release of an unacquired or foreign item should return false', () => {
    const pool = new SpritePoolCore<DummySprite>(
      (idx) => ({ id: idx, inUse: false, value: 0 }),
      undefined,
      { initialCapacity: 2 },
    );

    const foreignItem: DummySprite = { id: 999, inUse: false, value: 0 };
    assert.strictEqual(pool.release(foreignItem), false);

    const acquired = pool.acquire()!;
    assert.strictEqual(pool.release(acquired), true);
    // İkinci kez iade etmeyi denemek (double free) false dönmeli
    assert.strictEqual(pool.release(acquired), false);
  });
});
