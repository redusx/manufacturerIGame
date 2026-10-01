/* ======================================================================
 * src/factory/view/ConveyorGeometry.test.ts — Konveyör Geometrisi Testleri
 *
 * Yön açıları, 90 derecelik köşe/dönemeç tespiti, komşu akış analizi,
 * Splitter/Merger şekil tespiti ve Bézier yol enterpolasyonunu test eder.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { ConveyorGeometry } from './ConveyorGeometry.ts';
import type { Direction, GridCoord } from '../types.ts';

describe('ConveyorGeometry Direction & Angle Mathematics', () => {
  it('directionToAngleRad should map directions to standard Cartesian radians', () => {
    assert.strictEqual(ConveyorGeometry.directionToAngleRad('EAST'), 0);
    assert.strictEqual(ConveyorGeometry.directionToAngleRad('SOUTH'), Math.PI * 0.5);
    assert.strictEqual(ConveyorGeometry.directionToAngleRad('WEST'), Math.PI);
    assert.strictEqual(ConveyorGeometry.directionToAngleRad('NORTH'), Math.PI * 1.5);
  });

  it('directionToAngleDeg should map directions to degrees accurately', () => {
    assert.strictEqual(ConveyorGeometry.directionToAngleDeg('EAST'), 0);
    assert.strictEqual(ConveyorGeometry.directionToAngleDeg('SOUTH'), 90);
    assert.strictEqual(ConveyorGeometry.directionToAngleDeg('WEST'), 180);
    assert.strictEqual(ConveyorGeometry.directionToAngleDeg('NORTH'), 270);
  });

  it('getOppositeDirection should return symmetric inverses', () => {
    assert.strictEqual(ConveyorGeometry.getOppositeDirection('EAST'), 'WEST');
    assert.strictEqual(ConveyorGeometry.getOppositeDirection('WEST'), 'EAST');
    assert.strictEqual(ConveyorGeometry.getOppositeDirection('NORTH'), 'SOUTH');
    assert.strictEqual(ConveyorGeometry.getOppositeDirection('SOUTH'), 'NORTH');
  });
});

describe('ConveyorGeometry Corner Turn & Shape Classification', () => {
  it('Straight conveyor should detect NONE turn', () => {
    assert.strictEqual(ConveyorGeometry.getTurnType('WEST', 'EAST'), 'NONE');
    assert.strictEqual(ConveyorGeometry.getTurnType('EAST', 'WEST'), 'NONE');
    assert.strictEqual(ConveyorGeometry.getTurnType('NORTH', 'SOUTH'), 'NONE');
    assert.strictEqual(ConveyorGeometry.getTurnType('SOUTH', 'NORTH'), 'NONE');
  });

  it('Should accurately detect all 4 RIGHT (Clockwise) turns', () => {
    // Batıdan gelip Doğuya akarken Güneye (aşağı) dönme
    assert.strictEqual(ConveyorGeometry.getTurnType('WEST', 'SOUTH'), 'RIGHT');
    // Güneyden gelip Kuzeye akarken Doğuya (sağa) dönme
    assert.strictEqual(ConveyorGeometry.getTurnType('SOUTH', 'EAST'), 'RIGHT');
    // Doğudan gelip Batıya akarken Kuzeye (yukarı) dönme
    assert.strictEqual(ConveyorGeometry.getTurnType('EAST', 'NORTH'), 'RIGHT');
    // Kuzeyden gelip Güneye akarken Batıya (sola) dönme
    assert.strictEqual(ConveyorGeometry.getTurnType('NORTH', 'WEST'), 'RIGHT');
  });

  it('Should accurately detect all 4 LEFT (Counter-Clockwise) turns', () => {
    // Batıdan gelip Doğuya akarken Kuzeye (yukarı) dönme
    assert.strictEqual(ConveyorGeometry.getTurnType('WEST', 'NORTH'), 'LEFT');
    // Kuzeyden gelip Güneye akarken Doğuya (sağa) dönme
    assert.strictEqual(ConveyorGeometry.getTurnType('NORTH', 'EAST'), 'LEFT');
    // Doğudan gelip Batıya akarken Güneye (aşağı) dönme
    assert.strictEqual(ConveyorGeometry.getTurnType('EAST', 'SOUTH'), 'LEFT');
    // Güneyden gelip Kuzeye akarken Batıya (sola) dönme
    assert.strictEqual(ConveyorGeometry.getTurnType('SOUTH', 'WEST'), 'LEFT');
  });

  it('determineTileInfo should classify STRAIGHT, CORNERS, SPLITTERS, and MERGERS', () => {
    const origin: GridCoord = { x: 3, y: 5 };

    // 1. Düz hat
    const straight = ConveyorGeometry.determineTileInfo(origin, 'EAST', ['WEST']);
    assert.strictEqual(straight.shape, 'STRAIGHT');
    assert.strictEqual(straight.isTurn, false);
    assert.strictEqual(straight.rotationDeg, 0);

    // 2. Sağ Viraj (WEST -> SOUTH)
    const rightTurn = ConveyorGeometry.determineTileInfo(origin, 'SOUTH', ['WEST']);
    assert.strictEqual(rightTurn.shape, 'CORNER_RIGHT');
    assert.strictEqual(rightTurn.isTurn, true);
    assert.strictEqual(rightTurn.turnType, 'RIGHT');

    // 3. Sol Viraj (WEST -> NORTH)
    const leftTurn = ConveyorGeometry.determineTileInfo(origin, 'NORTH', ['WEST']);
    assert.strictEqual(leftTurn.shape, 'CORNER_LEFT');
    assert.strictEqual(leftTurn.isTurn, true);
    assert.strictEqual(leftTurn.turnType, 'LEFT');

    // 4. Splitter (1 In -> 2 Out)
    const splitter = ConveyorGeometry.determineTileInfo(
      origin,
      'EAST',
      ['WEST'],
      true,
      false,
      ['EAST', 'SOUTH'],
    );
    assert.strictEqual(splitter.shape, 'T_SPLIT');
    assert.strictEqual(splitter.outDirs.length, 2);

    // 5. Merger (2 In -> 1 Out)
    const merger = ConveyorGeometry.determineTileInfo(
      origin,
      'EAST',
      ['WEST', 'NORTH'],
      false,
      true,
    );
    assert.strictEqual(merger.shape, 'T_MERGE');
  });
});

describe('ConveyorGeometry Neighbor Flow Detection', () => {
  it('Should locate incoming flow from adjacent feeding belts in all 4 cardinal directions', () => {
    const target: GridCoord = { x: 5, y: 5 };

    // 1. Soldaki komşu (x:4, y:5) Doğuya (EAST) bakıyor -> Target'a Batıdan (WEST) girer
    const westIn = ConveyorGeometry.getIncomingDirections(target, [
      { coord: { x: 4, y: 5 }, direction: 'EAST' },
    ]);
    assert.deepStrictEqual(westIn, ['WEST']);

    // 2. Üstteki komşu (x:5, y:4) Güneye (SOUTH) bakıyor -> Target'a Kuzeyden (NORTH) girer
    const northIn = ConveyorGeometry.getIncomingDirections(target, [
      { coord: { x: 5, y: 4 }, direction: 'SOUTH' },
    ]);
    assert.deepStrictEqual(northIn, ['NORTH']);

    // 3. Sağdaki komşu (x:6, y:5) Batıya (WEST) bakıyor -> Target'a Doğudan (EAST) girer
    const eastIn = ConveyorGeometry.getIncomingDirections(target, [
      { coord: { x: 6, y: 5 }, direction: 'WEST' },
    ]);
    assert.deepStrictEqual(eastIn, ['EAST']);

    // 4. Alttaki komşu (x:5, y:6) Kuzeye (NORTH) bakıyor -> Target'a Güneyden (SOUTH) girer
    const southIn = ConveyorGeometry.getIncomingDirections(target, [
      { coord: { x: 5, y: 6 }, direction: 'NORTH' },
    ]);
    assert.deepStrictEqual(southIn, ['SOUTH']);

    // 5. Komşu hedefe bakmıyorsa (örn. x:4, y:5 Kuzeye bakıyor) tespit edilmemeli
    const ignored = ConveyorGeometry.getIncomingDirections(target, [
      { coord: { x: 4, y: 5 }, direction: 'NORTH' },
    ]);
    assert.deepStrictEqual(ignored, []);
  });
});

describe('ConveyorGeometry Item Path & Bezier Interpolation', () => {
  const TILE_SIZE = 32;
  const TILE_X = 100;
  const TILE_Y = 200;

  it('Straight conveyor should interpolate along linear axis from entry edge to exit edge', () => {
    // EAST yönünde düz hat: Giriş sol kenar (x:100, y:216), Merkez (x:116, y:216), Çıkış (x:132, y:216)
    const at0 = ConveyorGeometry.computeItemWorldPosition(
      TILE_X,
      TILE_Y,
      TILE_SIZE,
      'STRAIGHT',
      'WEST',
      'EAST',
      0.0,
    );
    assert.strictEqual(at0.x, 100);
    assert.strictEqual(at0.y, 216);
    assert.strictEqual(at0.angleRad, 0);

    const atHalf = ConveyorGeometry.computeItemWorldPosition(
      TILE_X,
      TILE_Y,
      TILE_SIZE,
      'STRAIGHT',
      'WEST',
      'EAST',
      0.5,
    );
    assert.strictEqual(atHalf.x, 116);
    assert.strictEqual(atHalf.y, 216);

    const at1 = ConveyorGeometry.computeItemWorldPosition(
      TILE_X,
      TILE_Y,
      TILE_SIZE,
      'STRAIGHT',
      'WEST',
      'EAST',
      1.0,
    );
    assert.strictEqual(at1.x, 132);
    assert.strictEqual(at1.y, 216);
  });

  it('Corner curve (WEST -> SOUTH) should follow smooth quadratic Bezier arc', () => {
    // Giriş: Batı kenarı ortası (x:100, y:216)
    const start = ConveyorGeometry.computeItemWorldPosition(
      TILE_X,
      TILE_Y,
      TILE_SIZE,
      'CORNER_RIGHT',
      'WEST',
      'SOUTH',
      0.0,
    );
    assert.strictEqual(start.x, 100);
    assert.strictEqual(start.y, 216);

    // Çıkış: Güney kenarı ortası (x:116, y:232)
    const end = ConveyorGeometry.computeItemWorldPosition(
      TILE_X,
      TILE_Y,
      TILE_SIZE,
      'CORNER_RIGHT',
      'WEST',
      'SOUTH',
      1.0,
    );
    assert.strictEqual(end.x, 116);
    assert.strictEqual(end.y, 232);

    // Dönemeç ortası (t = 0.5): Merkez civarında yumuşak yay
    const mid = ConveyorGeometry.computeItemWorldPosition(
      TILE_X,
      TILE_Y,
      TILE_SIZE,
      'CORNER_RIGHT',
      'WEST',
      'SOUTH',
      0.5,
    );
    // x ve y başlangıç ve bitiş sınırları arasında olmalı
    assert.ok(mid.x >= 100 && mid.x <= 116);
    assert.ok(mid.y >= 216 && mid.y <= 232);

    // Başlangıç açısı Doğuya (0 rad), bitiş açısı Güneye (PI/2 rad) bakmalı
    assert.ok(Math.abs(start.angleRad - 0) < 0.05);
    assert.ok(Math.abs(end.angleRad - Math.PI * 0.5) < 0.05);
  });
});
