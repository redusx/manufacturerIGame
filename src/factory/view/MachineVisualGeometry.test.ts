/* ======================================================================
 * src/factory/view/MachineVisualGeometry.test.ts — Makine Görsel Geometri Testleri
 *
 * Ayak izi boyutları, merkez koordinatları, giriş/çıkış oklarının kenar
 * konumları ve aktif parça salınım ofsetlerini test eder.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { MachineVisualGeometry } from './MachineVisualGeometry.ts';
import { MachineEntity } from '../simulation/MachineEntity.ts';
import { defaultMachineRegistry } from '../simulation/MachineRegistry.ts';

describe('MachineVisualGeometry Footprint & Bounds', () => {
  const TILE_SIZE = 32;

  it('1x1 machine at (2, 3) should compute exact pixel bounds and center', () => {
    const bounds = MachineVisualGeometry.computeBounds(
      { x: 2, y: 3 },
      1,
      1,
      0,
      TILE_SIZE,
      0,
      0,
    );

    assert.strictEqual(bounds.originX, 64);
    assert.strictEqual(bounds.originY, 96);
    assert.strictEqual(bounds.pixelW, 32);
    assert.strictEqual(bounds.pixelH, 32);
    assert.strictEqual(bounds.centerX, 80);
    assert.strictEqual(bounds.centerY, 112);
    assert.strictEqual(bounds.rotationRad, 0);
  });

  it('2x2 Assembler at (1, 1) should compute 64x64 footprint and center', () => {
    const bounds = MachineVisualGeometry.computeBounds(
      { x: 1, y: 1 },
      2,
      2,
      90,
      TILE_SIZE,
      100,
      200,
    );

    // factoryOrigin: (100, 200), coord: (1, 1) -> (132, 232)
    assert.strictEqual(bounds.originX, 132);
    assert.strictEqual(bounds.originY, 232);
    assert.strictEqual(bounds.pixelW, 64);
    assert.strictEqual(bounds.pixelH, 64);
    assert.strictEqual(bounds.centerX, 164);
    assert.strictEqual(bounds.centerY, 264);
    assert.strictEqual(bounds.rotationRad, Math.PI * 0.5);
  });
});

describe('MachineVisualGeometry Port Arrow Indicators', () => {
  const TILE_SIZE = 32;

  it('1x1 Crusher: Input on North should point inward (South), Output on South should point outward (South)', () => {
    const crusherDef = defaultMachineRegistry.getOrThrow('crusher');
    const machine = new MachineEntity('c1', crusherDef, { x: 3, y: 3 }, 0);

    const worldPorts = machine.getWorldPorts();
    const portVisuals = MachineVisualGeometry.computePortVisuals(
      worldPorts,
      TILE_SIZE,
      0,
      0,
    );

    assert.strictEqual(portVisuals.length, 2);

    // 1. INPUT port: Kuzey kenarında (direction: NORTH)
    const inPort = portVisuals.find((p) => p.type === 'INPUT')!;
    assert.strictEqual(inPort.direction, 'NORTH');
    // Kuzey kenarı: Y koordinatı üst kenara (3 * 32 = 96) yakın olmalı
    assert.strictEqual(inPort.arrowWorldX, 3 * 32 + 16); // 112
    assert.strictEqual(inPort.arrowWorldY, 3 * 32 + 4); // 100
    // Ok içeriye (Güneye / aşağı) bakmalı (PI/2 rad)
    assert.strictEqual(inPort.arrowAngleRad, Math.PI * 0.5);

    // 2. OUTPUT port: Güney kenarında (direction: SOUTH)
    const outPort = portVisuals.find((p) => p.type === 'OUTPUT')!;
    assert.strictEqual(outPort.direction, 'SOUTH');
    // Güney kenarı: Y koordinatı alt kenara (3 * 32 + 32 = 128) yakın olmalı
    assert.strictEqual(outPort.arrowWorldX, 3 * 32 + 16); // 112
    assert.strictEqual(outPort.arrowWorldY, 3 * 32 + 28); // 124
    // Ok dışarıya (Güneye / aşağı) bakmalı (PI/2 rad)
    assert.strictEqual(outPort.arrowAngleRad, Math.PI * 0.5);
  });
});

describe('MachineVisualGeometry Active Part Motion', () => {
  it('Should return zero offset when machine is IDLE or WAITING_INPUT', () => {
    const idleOffset = MachineVisualGeometry.computeActivePartOffset('IDLE', 1.5);
    assert.strictEqual(idleOffset.offsetX, 0);
    assert.strictEqual(idleOffset.offsetY, 0);

    const waitOffset = MachineVisualGeometry.computeActivePartOffset(
      'WAITING_INPUT',
      2.5,
    );
    assert.strictEqual(waitOffset.offsetX, 0);
    assert.strictEqual(waitOffset.offsetY, 0);
  });

  it('Should oscillate within amplitude when PROCESSING', () => {
    const amplitude = 4.0;
    // Farklı zamanlarda salınım değerleri
    const o1 = MachineVisualGeometry.computeActivePartOffset(
      'PROCESSING',
      0.0,
      amplitude,
    );
    assert.strictEqual(o1.offsetY, 0); // sin(0) = 0

    const o2 = MachineVisualGeometry.computeActivePartOffset(
      'PROCESSING',
      Math.PI / 16,
      amplitude,
    );
    // sin(8 * PI / 16) = sin(PI / 2) = 1.0 => offsetY = 4
    assert.strictEqual(o2.offsetY, 4);

    const o3 = MachineVisualGeometry.computeActivePartOffset(
      'PROCESSING',
      (3 * Math.PI) / 16,
      amplitude,
    );
    // sin(8 * 3PI / 16) = sin(1.5PI) = -1.0 => offsetY = -4
    assert.strictEqual(o3.offsetY, -4);
  });
});
