/* ======================================================================
 * src/factory/simulation/ProductionEngine.ts — Makine Üretim Motoru
 *
 * Fabrika ızgarasındaki tüm makinelerin çalışma zamanı üretim döngüsünü,
 * girdi tüketimini, süre sayacını, çıktı üretimini, bantlardan girdi
 * çekmeyi (intake) ve bitmiş ürünleri bantlara fırlatmayı (ejection)
 * yöneten saf TypeScript üretim motoru.
 * Phaser bağımlılığı yoktur.
 * ====================================================================== */

import {
  DIRECTION_VECTORS,
  OPPOSITE_DIRECTIONS,
  type GridCoord,
  type MachineEntityState,
} from '../types.ts';
import { GridMap } from './GridMap.ts';
import { LogisticsNetwork } from './LogisticsNetwork.ts';
import { MachineEntity } from './MachineEntity.ts';
import { MachineRegistry, defaultMachineRegistry } from './MachineRegistry.ts';
import { RecipeRegistry, defaultRecipeRegistry } from './RecipeRegistry.ts';

/** Yan ürünün (hurda) çıktığı portun kimliği */
const SCRAP_PORT_ID = 'out_scrap';

export class ProductionEngine {
  readonly grid: GridMap;
  readonly logistics: LogisticsNetwork;
  readonly recipeRegistry: RecipeRegistry;
  readonly machineRegistry: MachineRegistry;

  /** Çalışma zamanındaki tüm makine örnekleri (instanceId -> MachineEntity) */
  private machines = new Map<string, MachineEntity>();

  /** Makine yükseltme seviyeleri (instanceId -> level) (1 = taban seviye) */
  private machineLevels = new Map<string, number>();

  constructor(
    grid: GridMap,
    logistics: LogisticsNetwork,
    recipeRegistry: RecipeRegistry = defaultRecipeRegistry,
    machineRegistry: MachineRegistry = defaultMachineRegistry,
  ) {
    this.grid = grid;
    this.logistics = logistics;
    this.recipeRegistry = recipeRegistry;
    this.machineRegistry = machineRegistry;

    // Lojistik ağına makine sorgu sağlayıcısını bağla
    this.logistics.machineProvider = (instanceId: string) =>
      this.getMachine(instanceId);
  }

  // -------------------------------------------------------------
  // MAKİNE YÖNETİMİ (ADD / REMOVE / QUERY)
  // -------------------------------------------------------------

  /**
   * Izgaraya ve motora yeni bir makine örneği ekler.
   * Izgaradaki kapladığı tüm hücreleri 'MACHINE' olarak işaretler.
   */
  addMachine(machine: MachineEntity, initialLevel = 1): void {
    if (this.machines.has(machine.instanceId)) {
      throw new Error(
        `[ProductionEngine] Makine zaten mevcut: ${machine.instanceId}`,
      );
    }

    if (
      !this.grid.canPlaceMachine(
        machine.coord.x,
        machine.coord.y,
        machine.effectiveWidth,
        machine.effectiveHeight,
      )
    ) {
      throw new Error(
        `[ProductionEngine] Makine ızgaraya yerleştirilemez: (${machine.coord.x}, ${machine.coord.y}) [${machine.effectiveWidth}x${machine.effectiveHeight}]`,
      );
    }

    this.grid.placeMachine(
      machine.instanceId,
      machine.coord.x,
      machine.coord.y,
      machine.effectiveWidth,
      machine.effectiveHeight,
    );

    this.machines.set(machine.instanceId, machine);
    this.machineLevels.set(machine.instanceId, Math.max(1, initialLevel));
  }

  /**
   * Makineyi yeni konuma ve yöne taşır; seviyesi, reçetesi ve deposu korunur.
   * Yeni yer uygun değilse makine eski yerinde kalır ve false döner.
   */
  moveMachine(instanceId: string, coord: GridCoord, rotation: 0 | 90 | 180 | 270): boolean {
    const machine = this.machines.get(instanceId);
    if (!machine) return false;

    const previous = { x: machine.coord.x, y: machine.coord.y, rotation: machine.rotation };
    this.grid.removeMachine(instanceId);

    machine.coord.x = coord.x;
    machine.coord.y = coord.y;
    machine.rotation = rotation;
    const ok = this.grid.canPlaceMachine(coord.x, coord.y, machine.effectiveWidth, machine.effectiveHeight);
    if (!ok) {
      machine.coord.x = previous.x;
      machine.coord.y = previous.y;
      machine.rotation = previous.rotation;
    }
    this.grid.placeMachine(
      instanceId,
      machine.coord.x,
      machine.coord.y,
      machine.effectiveWidth,
      machine.effectiveHeight,
    );
    return ok;
  }

  /**
   * Makineyi motordan ve ızgaradan kaldırır.
   */
  removeMachine(instanceId: string): boolean {
    if (!this.machines.has(instanceId)) return false;

    this.grid.removeMachine(instanceId);
    this.machines.delete(instanceId);
    this.machineLevels.delete(instanceId);
    return true;
  }

  /** ID ile makine örneğini döner */
  getMachine(instanceId: string): MachineEntity | undefined {
    return this.machines.get(instanceId);
  }

  /** Tüm kayıtlı makineleri döner */
  getAllMachines(): MachineEntity[] {
    return Array.from(this.machines.values());
  }

  /** Toplam makine sayısı */
  get machineCount(): number {
    return this.machines.size;
  }

  // -------------------------------------------------------------
  // İNCREMENTAL MAKİNE SEVİYESİ VE HIZ ÇARPANI
  // -------------------------------------------------------------

  /** Makinenin yükseltme seviyesini döner (varsayılan 1) */
  getMachineLevel(instanceId: string): number {
    return this.machineLevels.get(instanceId) || 1;
  }

  /** Makine seviyesini ayarlar */
  setMachineLevel(instanceId: string, level: number): void {
    if (!this.machines.has(instanceId)) return;
    this.machineLevels.set(instanceId, Math.max(1, level));
  }

  /**
   * Makineyi 1 seviye yükseltir ve yeni seviyeyi döner.
   */
  upgradeMachine(instanceId: string): number {
    const current = this.getMachineLevel(instanceId);
    const next = current + 1;
    this.setMachineLevel(instanceId, next);
    return next;
  }

  /**
   * Makinenin anlık üretim hız çarpanı:
   * Her seviye %20 daha hızlı üretim sağlar (Seviye 1 = 1.0x, Seviye 2 = 1.2x, vb.)
   */
  getSpeedMultiplier(instanceId: string): number {
    const level = this.getMachineLevel(instanceId);
    return 1.0 + (level - 1) * 0.2;
  }

  // -------------------------------------------------------------
  // SİMÜLASYON ADIMI (TICK)
  // -------------------------------------------------------------

  /**
   * Üretim motoru zaman adımı (dt saniye).
   * 1. Komşu bantlardan girdi portlarına eşya çeker (intake).
   * 2. Makinelerin üretim çevrimini ilerletir (consume -> process -> produce).
   * 3. Çıktı portlarından bitmiş ürünleri komşu bantlara veya ihracata fırlatır (eject).
   */
  tick(dt: number): void {
    // Adım 1: Bantlardan makine giriş portlarına besleme
    this.pullInputsFromBelts();

    // Adım 2: Makine üretim durum makinesi ve süre ilerlemesi
    this.updateMachines(dt);

    // Adım 3: Çıktı tamponundaki hazır ürünleri tahliye etme
    this.ejectOutputs();
  }

  /**
   * Giriş portunun baktığı komşu banttan uygun girdileri makineye aktarır.
   */
  private pullInputsFromBelts(): void {
    for (const machine of this.machines.values()) {
      for (const port of machine.getInputPorts()) {
        const inVec = DIRECTION_VECTORS[port.direction];
        const sourceX = port.worldCoord.x + inVec.dx;
        const sourceY = port.worldCoord.y + inVec.dy;

        const belt = this.logistics.getConveyor(sourceX, sourceY);
        if (!belt) continue;

        // Bant makine giriş portuna doğru akıyor olmalıdır
        if (belt.direction !== OPPOSITE_DIRECTIONS[port.direction]) continue;

        const frontItem = belt.peekFrontItem();
        if (!frontItem || frontItem.progress < 1.0) continue;

        if (machine.canAcceptInput(frontItem.itemId)) {
          const popped = belt.popFrontItem();
          if (popped) {
            machine.addInput(popped.itemId);
          }
        }
      }
    }
  }

  /**
   * Tüm makinelerin durum makinesini ve üretim çevrimini günceller.
   */
  private updateMachines(dt: number): void {
    for (const machine of this.machines.values()) {
      // 1. Reçete yoksa IDLE
      if (!machine.activeRecipeId) {
        machine.status = 'IDLE';
        machine.progressSec = 0;
        continue;
      }

      const recipe = this.recipeRegistry.get(machine.activeRecipeId);
      if (!recipe) {
        machine.status = 'IDLE';
        continue;
      }

      // 2. Girdi bekleyen veya boşta duran makine
      if (machine.status === 'IDLE' || machine.status === 'WAITING_INPUT') {
        if (machine.hasRecipeInputs()) {
          // Girdileri tüket ve üretime başla
          machine.consumeRecipeInputs();
          machine.status = 'PROCESSING';
          machine.progressSec = 0;
        } else {
          machine.status = 'WAITING_INPUT';
        }
      }

      // 3. Üretim sürecindeki makine
      if (machine.status === 'PROCESSING') {
        const speed = this.getSpeedMultiplier(machine.instanceId);
        machine.progressSec += dt * speed;

        if (machine.progressSec >= recipe.processingTimeSec) {
          // Ürünleri çıktı tamponuna koymayı dene
          if (machine.canAcceptRecipeOutputs()) {
            machine.produceRecipeOutputs();
            machine.progressSec = 0;

            // Sıradaki parti için hemen girdi var mı?
            if (machine.hasRecipeInputs()) {
              machine.consumeRecipeInputs();
              machine.status = 'PROCESSING';
            } else {
              machine.status = 'WAITING_INPUT';
            }
          } else {
            // Çıktı tamponu dolu -> Tıkandı
            machine.status = 'BLOCKED_OUTPUT';
            machine.progressSec = recipe.processingTimeSec;
          }
        }
      } else if (machine.status === 'BLOCKED_OUTPUT') {
        // Çıktı tamponunda yer açıldı mı kontrol et
        if (machine.canAcceptRecipeOutputs()) {
          machine.produceRecipeOutputs();
          machine.progressSec = 0;

          if (machine.hasRecipeInputs()) {
            machine.consumeRecipeInputs();
            machine.status = 'PROCESSING';
          } else {
            machine.status = 'WAITING_INPUT';
          }
        }
      }
    }
  }

  /**
   * Çıktı tamponunda ürün bulunan makinelerden komşu bantlara veya ihracata tahliye.
   */
  private ejectOutputs(): void {
    for (const machine of this.machines.values()) {
      if (machine.getOutputTotalCount() === 0) continue;

      for (const port of machine.getOutputPorts()) {
        const outVec = DIRECTION_VECTORS[port.direction];
        const targetX = port.worldCoord.x + outVec.dx;
        const targetY = port.worldCoord.y + outVec.dy;

        if (!this.grid.isInBounds(targetX, targetY)) continue;

        const targetCell = this.grid.getCell(targetX, targetY);
        if (!targetCell) continue;

        // Hedef 1: İhracat Sandığı (EXPORT)
        if (targetCell.type === 'EXPORT') {
          const popped = this.popOutputFor(machine, port);
          if (popped && this.logistics.onItemDelivered) {
            this.logistics.onItemDelivered({
              itemId: popped.itemId,
              exportCoord: { x: targetX, y: targetY },
            });
          }
          continue;
        }

        // Hedef 2: Konveyör Bandı veya Splitter/Merger
        if (targetCell.type === 'CONVEYOR') {
          // Düz Bant
          const belt = this.logistics.getConveyor(targetX, targetY);
          // Makineye geri akan banda ürün verilmez: ürün aynı makineye döner, makine
          // onu girdi olarak almaz ve bandın ucunda kalıp besleme hattını kilitler.
          const flowsBackIn = belt?.direction === OPPOSITE_DIRECTIONS[port.direction];
          if (belt && !flowsBackIn && belt.canAcceptItem()) {
            const popped = this.popOutputFor(machine, port);
            if (popped) {
              belt.acceptItem(popped.itemId, 0.0);
            }
            continue;
          }

          // Splitter
          const splitter = this.logistics.getSplitter(targetX, targetY);
          if (
            splitter &&
            splitter.inputDirection === port.direction &&
            splitter.canAcceptItem()
          ) {
            const popped = this.popOutputFor(machine, port);
            if (popped) {
              splitter.acceptItem(popped.itemId);
            }
            continue;
          }

          // Merger
          const merger = this.logistics.getMerger(targetX, targetY);
          if (merger && merger.canAcceptFrom(port.direction)) {
            const popped = this.popOutputFor(machine, port);
            if (popped) {
              merger.acceptItemFrom(port.direction, popped.itemId);
            }
            continue;
          }
        }

        // Hedef 3: Doğrudan başka bir makinenin giriş portu (Bantsız doğrudan bağlantı)
        if (targetCell.type === 'MACHINE' && targetCell.machineInstanceId) {
          const nextMachine = this.machines.get(targetCell.machineInstanceId);
          if (nextMachine) {
            // Bant gibi, bitişik makine de girdiyi her kenarından alır (DEC-023)
            const peek = this.peekOutputFor(machine, port);
            if (nextMachine !== machine && peek && nextMachine.canAcceptInput(peek.itemId)) {
              const popped = this.popOutputFor(machine, port);
              if (popped) {
                nextMachine.addInput(popped.itemId);
              }
              continue;
            }
          }
        }
      }

      // Yan ürün (hurda) hattı tıkamasın: hurda portundan o an çıkamayan hurda atılır.
      for (const itemId of this.byproductIdsOf(machine)) {
        while (machine.popOutput(itemId)) {
          /* atıldı */
        }
      }
    }
  }

  /** Makinenin etkin reçetesindeki yan ürünler (reçetede `probability` taşıyan çıktılar) */
  private byproductIdsOf(machine: MachineEntity): string[] {
    const recipe = machine.activeRecipeId ? this.recipeRegistry.get(machine.activeRecipeId) : undefined;
    if (!recipe) return [];
    return recipe.outputs.filter((out) => out.probability !== undefined).map((out) => out.itemId);
  }

  /**
   * Bu porttan çıkabilecek sıradaki ürün. Yan ürün yalnızca hurda portundan
   * (`out_scrap`), asıl ürün yalnızca diğer portlardan çıkar; böylece hurda
   * asıl ürünün bandına karışıp sonraki makineyi tıkamaz (DEC-025).
   */
  private peekOutputFor(machine: MachineEntity, port: { id: string }): { itemId: string } | null {
    const byproducts = this.byproductIdsOf(machine);
    const wantsByproduct = port.id === SCRAP_PORT_ID;
    for (const [itemId, count] of Object.entries(machine.getOutputBufferSnapshot())) {
      if (count > 0 && byproducts.includes(itemId) === wantsByproduct) {
        return { itemId };
      }
    }
    return null;
  }

  private popOutputFor(machine: MachineEntity, port: { id: string }): { itemId: string } | null {
    const next = this.peekOutputFor(machine, port);
    return next && machine.popOutput(next.itemId) ? next : null;
  }

  // -------------------------------------------------------------
  // SERİLEŞTİRME (SAVE / LOAD)
  // -------------------------------------------------------------

  serialize(): MachineEntityState[] {
    const list: MachineEntityState[] = [];
    for (const machine of this.machines.values()) {
      const state = machine.serialize();
      state.level = this.getMachineLevel(machine.instanceId);
      list.push(state);
    }
    return list;
  }

  loadFromSerialized(states: MachineEntityState[]): void {
    // Mevcut makineleri temizle
    for (const machine of this.machines.values()) {
      this.grid.removeMachine(machine.instanceId);
    }
    this.machines.clear();
    this.machineLevels.clear();

    for (const state of states) {
      const def = this.machineRegistry.getOrThrow(state.defId);
      const entity = MachineEntity.deserialize(
        state,
        def,
        this.recipeRegistry,
      );
      this.addMachine(entity, state.level || 1);
    }
  }
}
