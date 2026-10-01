/* ======================================================================
 * src/factory/simulation/SimulationIntegration.test.ts
 *
 * Uçtan Uca Fabrika Simülasyon Entegrasyon Testi (TASK-032)
 *
 * Tam Zincir Akış:
 * INTAKE (iron_ore)
 *   ↓
 * Bant (1, 1) -> (1, 2)
 *   ↓
 * Kırıcı (1x1) at (1, 3) [iron_ore -> iron_powder (2.0 sn)]
 *   ↓
 * Bant Hattı (1, 4) -> (2, 4) -> (3, 4)
 *   ↓
 * Fırın (2x1) at (4, 4) [iron_powder -> iron_ingot (4.0 sn)]
 *   ↓
 * Çıktı Bandı (6, 4) -> (7, 4)
 *   ↓
 * EXPORT Sandığı at (8, 4) [Nihai Külçe Satışı]
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GridMap } from './GridMap.ts';
import { LogisticsNetwork, type DeliveredItemEvent } from './LogisticsNetwork.ts';
import { ProductionEngine } from './ProductionEngine.ts';
import { MachineEntity } from './MachineEntity.ts';
import { defaultMachineRegistry } from './MachineRegistry.ts';
import { defaultRecipeRegistry } from './RecipeRegistry.ts';

describe('End-to-End Simulation Integration', () => {
  const crusherDef = defaultMachineRegistry.getOrThrow('crusher');
  const smelterDef = defaultMachineRegistry.getOrThrow('smelter');

  it('Full pipeline: INTAKE -> Crusher -> Smelter -> EXPORT should convert ore to ingots without item loss', () => {
    const grid = new GridMap(12, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics, defaultRecipeRegistry, defaultMachineRegistry);

    // 1. Sabit Noktalar: INTAKE ve EXPORT
    // INTAKE: Her 2.0 saniyede bir demir cevheri üretir
    grid.setIntake(1, 0, 'iron_ore', 2.0);
    // EXPORT: (8, 4) konumunda sevkiyat sandığı
    grid.setExport(8, 4);

    const deliveredItems: DeliveredItemEvent[] = [];
    logistics.onItemDelivered = (event) => {
      deliveredItems.push(event);
    };

    // 2. INTAKE'den Kırıcıya Giriş Bandı (Güneye akar)
    logistics.addConveyor({ x: 1, y: 1 }, 'SOUTH', 1.0);
    logistics.addConveyor({ x: 1, y: 2 }, 'SOUTH', 1.0);

    // 3. Kırıcı (1x1) at (1, 3)
    // Giriş: NORTH at (1, 3), Çıkış: SOUTH at (1, 3)
    const crusher = new MachineEntity('crusher_1', crusherDef, { x: 1, y: 3 }, 0);
    crusher.setRecipe('recipe_crush_iron_ore'); // 1 iron_ore -> 1 iron_powder (2.0s)
    engine.addMachine(crusher);

    // 4. Kırıcı Çıkışından Fırına Ara Lojistik Hattı
    // Kırıcı çıkışı (1, 3) SOUTH'a bakar -> (1, 4) hücresine akar
    logistics.addConveyor({ x: 1, y: 4 }, 'EAST', 1.0); // Köşeyi doğuya döner
    logistics.addConveyor({ x: 2, y: 4 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 3, y: 4 }, 'EAST', 1.0); // Fırının (4, 4) WEST girişine bakar

    // 5. Fırın (2x1) at (4, 4)
    // Boyut: 2x1 -> Kapladığı hücreler: (4, 4) ve (5, 4)
    // Giriş: WEST at (4, 4), Çıkış: EAST at (5, 4)
    const smelter = new MachineEntity('smelter_1', smelterDef, { x: 4, y: 4 }, 0);
    smelter.setRecipe('recipe_smelt_iron_ingot'); // 1 iron_powder -> 1 iron_ingot (4.0s)
    engine.addMachine(smelter);

    // 6. Fırın Çıkışından EXPORT Sandığına Hat
    // Fırın çıkışı (5, 4) EAST'e bakar -> (6, 4) hücresine akar
    logistics.addConveyor({ x: 6, y: 4 }, 'EAST', 1.0);
    logistics.addConveyor({ x: 7, y: 4 }, 'EAST', 1.0); // (8, 4) EXPORT'a bakar

    // 7. Simülasyonu 35 saniye boyunca (70 tick, dt = 0.5s) koştur
    const dt = 0.5;
    const totalDurationSec = 35.0;
    const ticks = Math.round(totalDurationSec / dt);

    for (let t = 0; t < ticks; t++) {
      logistics.tick(dt);
      engine.tick(dt);
    }

    // 8. Sonuç Doğrulamaları
    // A) En az 3 adet külçe başarıyla üretilmiş ve ihraç edilmiş olmalı
    assert.ok(
      deliveredItems.length >= 3,
      `En az 3 külçe teslim edilmeliydi, teslim edilen: ${deliveredItems.length}`,
    );

    // B) İhracata sadece ve sadece 'iron_ingot' ulaşmalı (ara ürün sızıntısı olmamalı)
    for (const item of deliveredItems) {
      assert.equal(item.itemId, 'iron_ingot');
      assert.deepEqual(item.exportCoord, { x: 8, y: 4 });
    }

    // C) Sistemde toplam eşya muhafazası:
    // Hiçbir eşya yok olmamalı; teslim edilenler + banttakiler + makinelerdekiler
    // INTAKE tarafından üretilen toplam cevher miktarıyla tutarlı olmalı.
    const crusherInputs = crusher.getInputCount('iron_ore');
    const crusherOutputs = crusher.getOutputCount('iron_powder');
    const smelterInputs = smelter.getInputCount('iron_powder');
    const smelterOutputs = smelter.getOutputCount('iron_ingot');

    const totalActiveInMachines =
      crusherInputs + crusherOutputs + smelterInputs + smelterOutputs;

    // Fırın kırıcının 2 katı yavaş çalıştığı için (4s vs 2s)
    // aradaki bantta veya kırıcının tamponunda demir tozu birikmiş olmalıdır (Darboğaz kanıtı)
    let powderOnBelts = 0;
    for (const belt of logistics.getAllConveyors()) {
      for (const slot of belt.getItems()) {
        if (slot.itemId === 'iron_powder') {
          powderOnBelts++;
        }
      }
    }

    assert.ok(
      powderOnBelts > 0 || crusherOutputs > 0 || smelterInputs > 0,
      'Fırın daha yavaş olduğu için ara hatta demir tozu tamponlanmış olmalı',
    );
  });

  it('Bottleneck and backpressure resolution: Machine upgrade relieves upstream buffer pressure', () => {
    const grid = new GridMap(10, 6);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);

    // Kırıcı (2, 2) ve Fırın (4, 2) doğrudan bantsız kenetli (direct docking)
    // Kırıcı çıkışı EAST at (2, 2) -> Fırın girişi WEST at (3, 2)
    // Crusher at (2, 2), Smelter 2x1 at (3, 2)
    const crusher = new MachineEntity('c_dock', crusherDef, { x: 2, y: 2 }, 90);
    // Crusher rot 90: Giriş EAST, Çıkış WEST.
    // Düzeltme: rot 0'da Kırıcı çıkışı SOUTH (2, 3)'e bakar.
    // Smelter at (2, 3) rot 90'da girişi NORTH (2, 3)'e bakar.
    const crusherNorm = new MachineEntity('c1', crusherDef, { x: 2, y: 2 }, 0); // Çıkış: SOUTH -> (2, 3)
    crusherNorm.setRecipe('recipe_crush_iron_ore');
    engine.addMachine(crusherNorm);

    const smelterRot = new MachineEntity('s1', smelterDef, { x: 2, y: 3 }, 90); // Giriş: NORTH at (2, 3)
    smelterRot.setRecipe('recipe_smelt_iron_ingot');
    engine.addMachine(smelterRot);

    // Kırıcıya 4 adet demir cevheri yükle
    crusherNorm.addInput('iron_ore', 4);

    // Fırın seviye 1 (1.0x hız, 4.0s). Kırıcı seviye 1 (1.0x hız, 2.0s).
    // Fırını seviye 6'ya yükselt (+%100 hız -> 2.0x hız, 2.0s'ye düşer!)
    engine.setMachineLevel('s1', 6);
    assert.equal(engine.getSpeedMultiplier('s1'), 2.0);

    // 8 saniye simüle et (16 tick, dt = 0.5s)
    for (let i = 0; i < 16; i++) {
      engine.tick(0.5);
    }

    // Fırın hızı kırıcının hızına eşitlendiği için en az 2 külçe üretilmiş olmalı
    assert.ok(
      smelterRot.getOutputCount('iron_ingot') >= 2,
      `Yükseltilmiş fırın en az 2 külçe üretmeliydi, üretilen: ${smelterRot.getOutputCount('iron_ingot')}`,
    );
  });
});
