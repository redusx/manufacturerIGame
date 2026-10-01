/* ======================================================================
 * src/factory/simulation/ProductionEngine.test.ts — Üretim Motoru Birim Testi
 * ====================================================================== */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { GridMap } from './GridMap.ts';
import { LogisticsNetwork } from './LogisticsNetwork.ts';
import { MachineEntity } from './MachineEntity.ts';
import { ProductionEngine } from './ProductionEngine.ts';
import { defaultMachineRegistry } from './MachineRegistry.ts';
import { defaultRecipeRegistry } from './RecipeRegistry.ts';

describe('ProductionEngine Cycle & State Machine', () => {
  const crusherDef = defaultMachineRegistry.getOrThrow('crusher');
  const smelterDef = defaultMachineRegistry.getOrThrow('smelter');

  it('Should register machines and bind to spatial grid properly', () => {
    const grid = new GridMap(10, 10);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);

    const crusher = new MachineEntity('c1', crusherDef, { x: 3, y: 3 });
    engine.addMachine(crusher);

    assert.equal(engine.machineCount, 1);
    assert.equal(grid.getCell(3, 3)?.type, 'MACHINE');
    assert.equal(grid.getCell(3, 3)?.machineInstanceId, 'c1');

    // Aynı alana ikinci makine koyulamaz
    const crusher2 = new MachineEntity('c2', crusherDef, { x: 3, y: 3 });
    assert.throws(() => {
      engine.addMachine(crusher2);
    }, /yerleştirilemez/);

    // Kaldırma testi
    assert.equal(engine.removeMachine('c1'), true);
    assert.equal(engine.machineCount, 0);
    assert.equal(grid.getCell(3, 3)?.type, 'EMPTY');
  });

  it('State machine transitions: WAITING_INPUT -> PROCESSING -> WAITING_INPUT', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);

    const crusher = new MachineEntity('c1', crusherDef, { x: 2, y: 2 });
    crusher.setRecipe('recipe_crush_iron_ore'); // 1 iron_ore -> 1 iron_powder (2.0 sn)
    engine.addMachine(crusher);

    assert.equal(crusher.status, 'WAITING_INPUT');

    // Girdi yokken tick ilerlese de makine beklemede kalmalı
    engine.tick(1.0);
    assert.equal(crusher.status, 'WAITING_INPUT');
    assert.equal(crusher.progressSec, 0);

    // 1 adet demir cevheri ekle
    crusher.addInput('iron_ore', 1);

    // Motor tetiklendiğinde girdi tüketilmeli ve üretime geçilmeli
    engine.tick(0.5);
    assert.equal(crusher.status, 'PROCESSING');
    assert.equal(crusher.getInputCount('iron_ore'), 0); // Tüketildi
    assert.equal(crusher.progressSec, 0.5);

    // 1.0 sn daha ilerlet (toplam 1.5 sn / 2.0 sn)
    engine.tick(1.0);
    assert.equal(crusher.status, 'PROCESSING');
    assert.equal(crusher.progressSec, 1.5);

    // 0.6 sn daha ilerlet (toplam 2.1 sn >= 2.0 sn) -> Üretim biter
    engine.tick(0.6);
    assert.equal(crusher.getOutputCount('iron_powder'), 1);
    // Yeni girdi olmadığı için tekrar WAITING_INPUT durumuna döner
    assert.equal(crusher.status, 'WAITING_INPUT');
    assert.equal(crusher.progressSec, 0);
  });

  it('Machine upgrade level should increase production speed multiplier', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);

    const crusher = new MachineEntity('c_fast', crusherDef, { x: 1, y: 1 });
    crusher.setRecipe('recipe_crush_iron_ore'); // 2.0 sn
    engine.addMachine(crusher);

    assert.equal(engine.getMachineLevel('c_fast'), 1);
    assert.equal(engine.getSpeedMultiplier('c_fast'), 1.0);

    // Seviye 2'ye yükselt (+%20 hız -> 1.2x)
    const newLvl = engine.upgradeMachine('c_fast');
    assert.equal(newLvl, 2);
    assert.equal(engine.getSpeedMultiplier('c_fast'), 1.2);

    crusher.addInput('iron_ore', 1);
    // 1.0 saniye tick ver -> 1.0 * 1.2 = 1.2 saniyelik ilerleme olmalı
    engine.tick(1.0);
    assert.equal(crusher.status, 'PROCESSING');
    assert.ok(Math.abs(crusher.progressSec - 1.2) < 0.001);
  });

  it('Intake from conveyor: Belt facing input port should automatically feed machine', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);

    // Kırıcı (1x1) (3, 3) konumunda, girdi portu NORTH (kuzeye) bakıyor
    const crusher = new MachineEntity('c_intake', crusherDef, { x: 3, y: 3 });
    crusher.setRecipe('recipe_crush_iron_ore');
    engine.addMachine(crusher);

    // Konveyör (3, 2) konumunda, GÜNEYE (SOUTH) doğru akıyor (Kırıcıya giriyor)
    const belt = logistics.addConveyor({ x: 3, y: 2 }, 'SOUTH', 1.0);
    belt.acceptItem('iron_ore', 0.5);

    // Bant üzerindeki eşyayı ilerlet
    // logistics.machineProvider bağlı olduğu için ucuna ulaştığında otomatik Kırıcıya aktarılır
    logistics.tick(0.6);
    assert.equal(belt.itemCount, 0); // Banttan çekildi
    assert.equal(crusher.getInputCount('iron_ore'), 1); // Kırıcıya girdi

    // Üretim motoru tick'i kırıcının üretime başlamasını sağlamalı
    engine.tick(0.1);
    assert.equal(crusher.status, 'PROCESSING');
  });

  it('Ejection to conveyor: Machine output port should push finished item onto belt', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);

    // Kırıcı (3, 3) konumunda, çıkış portu SOUTH (güneye) bakıyor
    const crusher = new MachineEntity('c_out', crusherDef, { x: 3, y: 3 });
    engine.addMachine(crusher);

    // Çıkışın önünde (3, 4) güneye akan bir bant var
    const outBelt = logistics.addConveyor({ x: 3, y: 4 }, 'SOUTH', 1.0);

    // Kırıcının çıktı tamponuna manuel 1 ürün koy
    crusher.addOutput('iron_powder', 1);
    assert.equal(crusher.getOutputCount('iron_powder'), 1);

    // Tick çıktıyı banta aktarmalı
    engine.tick(0.1);
    assert.equal(crusher.getOutputCount('iron_powder'), 0); // Tampon boşaldı
    assert.equal(outBelt.itemCount, 1); // Banta bindi
    assert.equal(outBelt.getItems()[0].itemId, 'iron_powder');
  });

  it('Direct Machine-to-Machine coupling without a conveyor', () => {
    const grid = new GridMap(10, 10);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);

    // Kırıcı at (4, 4), çıkış portu SOUTH'a (4, 5)'e bakar
    const crusher = new MachineEntity('c_dock', crusherDef, { x: 4, y: 4 }, 0);
    crusher.setRecipe('recipe_crush_iron_ore');
    engine.addMachine(crusher);

    // Fırın 2x1 at (4, 5), rot 90: Giriş portu (WEST) saat yönünde 90 derece dönerek NORTH olur!
    // Kök koordinatı (4, 5). Port localX=0, localY=0 rot 90 sonrası da (4, 5) NORTH'a bakar.
    const smelter = new MachineEntity('s_dock', smelterDef, { x: 4, y: 5 }, 90);
    smelter.setRecipe('recipe_smelt_iron_ingot'); // iron_powder -> iron_ingot
    engine.addMachine(smelter);

    // Kırıcının çıktısına demir tozu koy
    crusher.addOutput('iron_powder', 1);

    // 1. Tick: Kırıcı çıktıyı doğrudan fırına aktarır
    engine.tick(0.1);
    assert.equal(crusher.getOutputCount('iron_powder'), 0);
    assert.equal(smelter.getInputCount('iron_powder'), 1);

    // 2. Tick: Fırın girdiyi tüketip üretime başlar!
    engine.tick(0.1);
    assert.equal(smelter.status, 'PROCESSING');
  });

  it('BLOCKED_OUTPUT: Machine should pause when output buffer is full', () => {
    const grid = new GridMap(8, 8);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);

    const crusher = new MachineEntity('c_block', crusherDef, { x: 1, y: 1 });
    crusher.setRecipe('recipe_crush_iron_ore'); // 2.0 sn
    engine.addMachine(crusher);

    // Çıktı tamponunu kapasiteye kadar doldur (crusher outputBufferCapacity = 5)
    for (let i = 0; i < 5; i++) {
      crusher.addOutput('iron_powder', 1);
    }
    assert.equal(crusher.canAcceptRecipeOutputs(), false);

    // Girdi ver ve üretime başla
    crusher.addInput('iron_ore', 1);
    engine.tick(0.5);
    assert.equal(crusher.status, 'PROCESSING');

    // Süreyi tamamla (1.6 sn daha -> 2.1 sn)
    engine.tick(1.6);
    // Çıktı tamponunda yer olmadığı için BLOCKED_OUTPUT olmalı
    assert.equal(crusher.status, 'BLOCKED_OUTPUT');
    assert.equal(crusher.getOutputCount('iron_powder'), 5);

    // 1 adet çıktıyı tahliye et
    crusher.popOutput('iron_powder');
    assert.equal(crusher.canAcceptRecipeOutputs(), true);

    // Bir sonraki tick makinenin tıkanıklığını açmalı
    engine.tick(0.1);
    assert.equal(crusher.getOutputCount('iron_powder'), 5); // 4 + 1 yeni üretilen = 5
    assert.equal(crusher.status, 'WAITING_INPUT');
  });

  it('Serialization and deserialization should preserve production engine state', () => {
    const grid = new GridMap(10, 10);
    const logistics = new LogisticsNetwork(grid);
    const engine = new ProductionEngine(grid, logistics);

    const crusher = new MachineEntity('c_save', crusherDef, { x: 2, y: 3 }, 0);
    crusher.setRecipe('recipe_crush_iron_ore');
    crusher.addInput('iron_ore', 2);
    engine.addMachine(crusher, 3); // Seviye 3

    const serialized = engine.serialize();
    assert.equal(serialized.length, 1);
    assert.equal(serialized[0].instanceId, 'c_save');

    // Yeni motora geri yükle
    const newGrid = new GridMap(10, 10);
    const newLogistics = new LogisticsNetwork(newGrid);
    const newEngine = new ProductionEngine(newGrid, newLogistics);

    newEngine.loadFromSerialized(serialized);
    assert.equal(newEngine.machineCount, 1);
    const restored = newEngine.getMachine('c_save')!;
    assert.ok(restored);
    assert.equal(restored.getInputCount('iron_ore'), 2);
    assert.equal(newGrid.getCell(2, 3)?.type, 'MACHINE');
  });
});
