/* ======================================================================
 * src/factory/view/CameraMath.test.ts — Kamera Matematik ve Sınır Testleri
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CameraMath } from './CameraMath.ts';

describe('CameraMath Clamping, Zoom & Viewport Mathematics', () => {
  it('clampZoom should enforce boundaries', () => {
    assert.equal(CameraMath.clampZoom(0.2, 0.5, 2.5), 0.5);
    assert.equal(CameraMath.clampZoom(3.5, 0.5, 2.5), 2.5);
    assert.equal(CameraMath.clampZoom(1.25, 0.5, 2.5), 1.25);
  });

  it('getNextDiscreteZoom should step cleanly without floating point precision drift', () => {
    let zoom = 1.0;

    // Zoom in steps (+0.25)
    zoom = CameraMath.getNextDiscreteZoom(zoom, 1);
    assert.equal(zoom, 1.25);

    zoom = CameraMath.getNextDiscreteZoom(zoom, 1);
    assert.equal(zoom, 1.5);

    zoom = CameraMath.getNextDiscreteZoom(zoom, 1);
    assert.equal(zoom, 1.75);

    zoom = CameraMath.getNextDiscreteZoom(zoom, 1);
    assert.equal(zoom, 2.0);

    // Zoom out steps (-0.25)
    zoom = CameraMath.getNextDiscreteZoom(zoom, -1);
    assert.equal(zoom, 1.75);

    zoom = CameraMath.getNextDiscreteZoom(zoom, -1);
    assert.equal(zoom, 1.5);

    zoom = CameraMath.getNextDiscreteZoom(zoom, -1);
    assert.equal(zoom, 1.25);

    zoom = CameraMath.getNextDiscreteZoom(zoom, -1);
    assert.equal(zoom, 1.0);
  });

  it('computePanBounds should compute bounds for small and large factory layouts', () => {
    const viewport = { width: 800, height: 600 };

    // Küçük Başlangıç Fabrikası (8x8 = 256x256 px)
    const smallBounds = CameraMath.computePanBounds(256, 256, viewport, 1.0, 64);
    assert.equal(smallBounds.minX, -64);
    assert.equal(smallBounds.minY, -64);

    // Büyük Mega Fabrika (24x24 = 768x768 px)
    const largeBounds = CameraMath.computePanBounds(768, 768, viewport, 1.0, 64);
    assert.equal(largeBounds.minX, -64);
    assert.equal(largeBounds.minY, -64);
    assert.equal(largeBounds.maxX, 768 + 64 - 800); // 32
    assert.equal(largeBounds.maxY, 768 + 64 - 600); // 232
  });

  it('clampPosition should constrain coordinates and round to integers', () => {
    const bounds = { minX: -64, maxX: 200, minY: -64, maxY: 300 };

    const pos1 = CameraMath.clampPosition(-100.4, 450.6, bounds);
    assert.equal(pos1.x, -64);
    assert.equal(pos1.y, 300);

    const pos2 = CameraMath.clampPosition(55.3, 120.7, bounds);
    assert.equal(pos2.x, 55);
    assert.equal(pos2.y, 121);
  });

  it('computeCenterPosition should center factory accurately within viewport', () => {
    const viewport = { width: 800, height: 600 };

    // 8x8 (256x256) fabrika 800x600 viewport ortasında:
    // scrollX = (256 - 800) / 2 = -272
    // scrollY = (256 - 600) / 2 = -172
    const center = CameraMath.computeCenterPosition(256, 256, viewport);
    assert.equal(center.x, -272);
    assert.equal(center.y, -172);

    // Phaser kamerası görüş alanının merkezine göre yakınlaştığı için ortalama
    // scroll değeri zoom'dan bağımsızdır. 2x zoom'da görünen dünya 400x300'dür ve
    // sol-üst köşesi scroll + viewport * (1 - 1/zoom) / 2 = (-72, -22) olur;
    // yani 256'lık fabrika yine tam ortadadır.
    const zoom = 2.0;
    const viewLeft = center.x + (viewport.width * (1 - 1 / zoom)) / 2;
    const viewTop = center.y + (viewport.height * (1 - 1 / zoom)) / 2;
    assert.equal(viewLeft, -72);
    assert.equal(viewTop, -22);
  });

  it('computeFocusPosition should center on target world coordinates', () => {
    const viewport = { width: 800, height: 600 };

    // Hedef nokta: (100, 150)
    // scrollX = 100 - 800/2 = -300
    // scrollY = 150 - 600/2 = -150
    const focus = CameraMath.computeFocusPosition(100, 150, viewport);
    assert.equal(focus.x, -300);
    assert.equal(focus.y, -150);
  });
});
