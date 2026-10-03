/* ======================================================================
 * src/factory/simulation/TerminalRelocateIntegration.test.ts
 *
 * Hammadde Girişi (INTAKE) ve Sevkiyat Sandığı (EXPORT) terminallerinin
 * taşınabilirliği, ızgara validasyonu, lojistik akışı entegrasyonu ve
 * serileştirme/kayıt sürekliliğini test eden entegrasyon test paketi.
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GridMap } from './GridMap.ts';
import { LogisticsNetwork, type DeliveredItemEvent } from './LogisticsNetwork.ts';
import { ProductionEngine } from './ProductionEngine.ts';
import { FactoryEconomy } from './FactoryEconomy.ts';
import { PlacementMath } from '../input/PlacementMath.ts';
import { FactorySerializer } from './FactorySerializer.ts';

describe('Terminal Relocation (Taşıma Seçeneği) Entegrasyon Testleri', () => {
  it('1. GridMap.moveIntake hammadde giriş silosu yerini taşımalı ve verilerini korumalı', () => {
    const grid = new GridMap(8, 8);
    grid.setIntake(1, 0, 'iron_ore', 1.5);

    assert.equal(grid.getCell(1, 0)?.type, 'INTAKE');
    assert.equal(grid.getCell(1, 0)?.intakeData?.itemId, 'iron_ore');
    assert.equal(grid.getCell(1, 0)?.intakeData?.intervalSec, 1.5);

    // Boş hücreye taşı (3, 2)
    const success = grid.moveIntake(1, 0, 3, 2);
    assert.equal(success, true);
    assert.equal(grid.getCell(1, 0)?.type, 'EMPTY');
    assert.equal(grid.getCell(1, 0)?.intakeData, undefined);

    assert.equal(grid.getCell(3, 2)?.type, 'INTAKE');
    assert.equal(grid.getCell(3, 2)?.intakeData?.itemId, 'iron_ore');
    assert.equal(grid.getCell(3, 2)?.intakeData?.intervalSec, 1.5);
  });

  it('2. GridMap.moveIntake dolu veya sınır dışı hücreye taşımayı reddetmeli', () => {
    const grid = new GridMap(8, 8);
    grid.setIntake(1, 0, 'iron_ore', 1.0);
    grid.setObstacle(2, 0);

    // Dolu hücreye taşınamaz
    const failObstacle = grid.moveIntake(1, 0, 2, 0);
    assert.equal(failObstacle, false);
    assert.equal(grid.getCell(1, 0)?.type, 'INTAKE');

    // Sınır dışına taşınamaz
    const failBounds = grid.moveIntake(1, 0, 10, 10);
    assert.equal(failBounds, false);
    assert.equal(grid.getCell(1, 0)?.type, 'INTAKE');
  });

  it('3. GridMap.moveExport sevkiyat sandığı yerini taşımalı', () => {
    const grid = new GridMap(8, 8);
    grid.setExport(6, 7);

    assert.equal(grid.getCell(6, 7)?.type, 'EXPORT');

    // (4, 4) konumuna taşı
    const success = grid.moveExport(6, 7, 4, 4);
    assert.equal(success, true);
    assert.equal(grid.getCell(6, 7)?.type, 'EMPTY');
    assert.equal(grid.getCell(4, 4)?.type, 'EXPORT');

    // Dolu hücreye taşınamaz
    grid.setConveyor(4, 5);
    const failOccupied = grid.moveExport(4, 4, 4, 5);
    assert.equal(failOccupied, false);
    assert.equal(grid.getCell(4, 4)?.type, 'EXPORT');
  });

  it('4. PlacementMath INTAKE_MOVE ve EXPORT_MOVE validasyonu ve icrası', () => {
    const grid = new GridMap(8, 8);
    const economy = new FactoryEconomy(0);
    const logistics = new LogisticsNetwork(grid);

    grid.setIntake(1, 0, 'iron_ore', 1.0);
    grid.setExport(6, 7);

    // Kilitli parsel sınır kontrolü
    const bounds = { width: 8, height: 8 };

    // 1. Giriş taşıma validasyonu (Ücretsiz, 1x1)
    const valIntake = PlacementMath.validatePlacement({
      grid,
      economy,
      rootCoord: { x: 2, y: 1 },
      itemType: 'INTAKE_MOVE',
      direction: 'NORTH',
      unlockedBounds: bounds,
      sourceCoord: { x: 1, y: 0 },
    });
    assert.equal(valIntake.isValid, true);
    assert.equal(valIntake.cost, 0);

    // İcra et
    const execIntake = PlacementMath.executePlacement({
      grid,
      economy,
      logistics,
      rootCoord: { x: 2, y: 1 },
      itemType: 'INTAKE_MOVE',
      direction: 'NORTH',
      unlockedBounds: bounds,
      sourceCoord: { x: 1, y: 0 },
    });
    assert.equal(execIntake.success, true);
    assert.equal(grid.getCell(1, 0)?.type, 'EMPTY');
    assert.equal(grid.getCell(2, 1)?.type, 'INTAKE');

    // 2. Çıkış taşıma validasyonu ve icrası
    const execExport = PlacementMath.executePlacement({
      grid,
      economy,
      logistics,
      rootCoord: { x: 5, y: 5 },
      itemType: 'EXPORT_MOVE',
      direction: 'NORTH',
      unlockedBounds: bounds,
      sourceCoord: { x: 6, y: 7 },
    });
    assert.equal(execExport.success, true);
    assert.equal(grid.getCell(6, 7)?.type, 'EMPTY');
    assert.equal(grid.getCell(5, 5)?.type, 'EXPORT');
  });

  it('5. Taşınan terminaller lojistik simülasyonu ile kusursuz çalışmalı', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);

    // Başlangıç: INTAKE (1, 0), EXPORT (6, 7)
    grid.setIntake(1, 0, 'iron_ore', 0.5);
    grid.setExport(6, 7);

    // Terminalleri yeni konumlara taşı: INTAKE -> (2, 2), EXPORT -> (2, 5)
    grid.moveIntake(1, 0, 2, 2);
    grid.moveExport(6, 7, 2, 5);

    // Konveyör hattı döşe: (2, 3) SOUTH -> (2, 4) SOUTH -> Hedef (2, 5) EXPORT
    logistics.addConveyor({ x: 2, y: 3 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 2, y: 4 }, 'SOUTH', 1.0);

    const delivered: DeliveredItemEvent[] = [];
    logistics.onItemDelivered = (evt) => delivered.push(evt);

    // 1 saniye simülasyon işlet:
    // (2, 2) INTAKE zamanlayıcısı 0.5s'de eşya üretir ve komşu (2, 3) bandına bırakır
    for (let i = 0; i < 60; i++) {
      logistics.tick(0.05);
      engine.tick(0.05);
    }

    // Eşyalar (2, 5) yeni EXPORT sandığına ulaşıp teslim edilmeli
    assert.ok(delivered.length >= 1, 'Taşınan ihracat terminaline en az 1 ürün teslim edilmelidir');
    assert.equal(delivered[0].exportCoord.x, 2);
    assert.equal(delivered[0].exportCoord.y, 5);
  });

  it('6. Taşınan terminal koordinatları serileştirilip kayıt formatında korunmalı', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);
    const economy = new FactoryEconomy(0);

    grid.setIntake(1, 0, 'iron_ore', 1.0);
    grid.setExport(6, 7);

    // Taşı
    grid.moveIntake(1, 0, 3, 1);
    grid.moveExport(6, 7, 5, 2);

    // Serileştir
    const serialized = FactorySerializer.serialize(grid, logistics, engine, economy);
    assert.equal(serialized.intakes.length, 1);
    assert.equal(serialized.intakes[0].coord.x, 3);
    assert.equal(serialized.intakes[0].coord.y, 1);

    assert.equal(serialized.exports.length, 1);
    assert.equal(serialized.exports[0].x, 5);
    assert.equal(serialized.exports[0].y, 2);

    // Yeni ızgaraya geri yükle
    const freshGrid = new GridMap(8, 8);
    for (const inData of serialized.intakes) {
      freshGrid.setIntake(inData.coord.x, inData.coord.y, inData.itemId, inData.intervalSec);
    }
    for (const expData of serialized.exports) {
      freshGrid.setExport(expData.x, expData.y);
    }

    assert.equal(freshGrid.getCell(3, 1)?.type, 'INTAKE');
    assert.equal(freshGrid.getCell(5, 2)?.type, 'EXPORT');
    assert.equal(freshGrid.getCell(1, 0)?.type, 'EMPTY');
    assert.equal(freshGrid.getCell(6, 7)?.type, 'EMPTY');
  });
});
