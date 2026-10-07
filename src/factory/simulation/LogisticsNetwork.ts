/* ======================================================================
 * src/factory/simulation/LogisticsNetwork.ts — Lojistik Ağı ve Bantlar Arası Akış
 *
 * Fabrika ızgarasındaki tüm konveyörleri, akış ayırıcıları (Splitter)
 * ve birleştiricileri (Merger) koordine eden, komşu hücrelere
 * eşya aktarımını (hand-off), hammadde giriş silolarından beslemeyi,
 * ihracat teslimatlarını ve ağ düzeyinde geri tepmeyi (backpressure)
 * simüle eden saf TypeScript lojistik motoru.
 * Phaser bağımlılığı yoktur.
 * ====================================================================== */

import {
  DIRECTION_VECTORS,
  OPPOSITE_DIRECTIONS,
  type Direction,
  type GridCoord,
  type ConveyorEntityState,
} from '../types.ts';
import { GridMap } from './GridMap.ts';
import { ConveyorBelt } from './ConveyorBelt.ts';
import { Splitter, Merger } from './SplitterMerger.ts';
import type { MachineEntity } from './MachineEntity.ts';

export interface DeliveredItemEvent {
  itemId: string;
  exportCoord: GridCoord;
}

export class LogisticsNetwork {
  readonly grid: GridMap;
  private belts = new Map<string, ConveyorBelt>();
  private splitters = new Map<string, Splitter>();
  private mergers = new Map<string, Merger>();

  /** İhracat sandığına ulaşan eşyalar için geri çağırma (callback) */
  onItemDelivered?: (event: DeliveredItemEvent) => void;

  /** Makine sorgu sağlayıcısı (ProductionEngine tarafından bağlanır) */
  machineProvider?: (instanceId: string) => MachineEntity | undefined;

  constructor(grid: GridMap) {
    this.grid = grid;
  }

  /** Koordinatı benzersiz anahtara dönüştürür */
  private coordKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  // -------------------------------------------------------------
  // KONVEYÖR YÖNETİMİ
  // -------------------------------------------------------------

  /**
   * Izgarada yeni bir konveyör bandı oluşturur ve ağa ekler.
   */
  addConveyor(coord: GridCoord, direction: Direction, speed = 1.0): ConveyorBelt {
    if (!this.grid.canPlaceConveyor(coord.x, coord.y)) {
      throw new Error(
        `[LogisticsNetwork] Konveyör yerleştirilemez: (${coord.x}, ${coord.y})`,
      );
    }

    this.grid.setConveyor(coord.x, coord.y);
    const belt = new ConveyorBelt(coord, direction, speed);
    this.belts.set(this.coordKey(coord.x, coord.y), belt);
    return belt;
  }

  /**
   * Konveyör bandını ağdan ve ızgaradan kaldırır.
   */
  removeConveyor(x: number, y: number): boolean {
    const key = this.coordKey(x, y);
    if (!this.belts.has(key)) return false;

    this.belts.delete(key);
    this.grid.removeConveyor(x, y);
    return true;
  }

  /** (x, y) koordinatındaki konveyörü döner */
  getConveyor(x: number, y: number): ConveyorBelt | undefined {
    return this.belts.get(this.coordKey(x, y));
  }

  /** Kayıtlı tüm konveyörleri döner */
  getAllConveyors(): ConveyorBelt[] {
    return Array.from(this.belts.values());
  }

  get conveyorCount(): number {
    return this.belts.size;
  }

  /**
   * (x, y) koordinatındaki konveyörden bir eşyayı anında alır ve çıkarır (Click & Collect).
   */
  takeItemFromConveyor(x: number, y: number, slotIndex?: number): import('../types.ts').ConveyorSlot | null {
    const belt = this.getConveyor(x, y);
    if (!belt) return null;
    return belt.takeItem(slotIndex);
  }

  /**
   * (x, y) koordinatındaki hammadde silosundan bağlı olan ilk banda anında eşya basmayı dener.
   */
  forceIntakeSpawn(x: number, y: number): boolean {
    const cell = this.grid.getCell(x, y);
    if (!cell || cell.type !== 'INTAKE' || !cell.intakeData) return false;
    const targetBelt = this.findIntakeTargetBelt(x, y);
    if (targetBelt && targetBelt.canAcceptItem()) {
      targetBelt.acceptItem(cell.intakeData.itemId, 0.0);
      return true;
    }
    return false;
  }

  // -------------------------------------------------------------
  // SPLITTER & MERGER YÖNETİMİ
  // -------------------------------------------------------------

  /** Yeni bir Splitter (1 In -> 2 Out) ekler */
  addSplitter(
    coord: GridCoord,
    inputDir: Direction,
    outputDirs: [Direction, Direction],
  ): Splitter {
    if (!this.grid.canPlaceConveyor(coord.x, coord.y)) {
      throw new Error(
        `[LogisticsNetwork] Splitter yerleştirilemez: (${coord.x}, ${coord.y})`,
      );
    }

    this.grid.setConveyor(coord.x, coord.y);
    const splitter = new Splitter(coord, inputDir, outputDirs);
    this.splitters.set(this.coordKey(coord.x, coord.y), splitter);
    return splitter;
  }

  removeSplitter(x: number, y: number): boolean {
    const key = this.coordKey(x, y);
    if (!this.splitters.has(key)) return false;

    this.splitters.delete(key);
    this.grid.removeConveyor(x, y);
    return true;
  }

  getSplitter(x: number, y: number): Splitter | undefined {
    return this.splitters.get(this.coordKey(x, y));
  }

  /** Kayıtlı tüm Splitter ünitelerini döner */
  getAllSplitters(): Splitter[] {
    return Array.from(this.splitters.values());
  }

  /** Yeni bir Merger (2 In -> 1 Out) ekler */
  addMerger(
    coord: GridCoord,
    inputDirs: [Direction, Direction],
    outputDir: Direction,
  ): Merger {
    if (!this.grid.canPlaceConveyor(coord.x, coord.y)) {
      throw new Error(
        `[LogisticsNetwork] Merger yerleştirilemez: (${coord.x}, ${coord.y})`,
      );
    }

    this.grid.setConveyor(coord.x, coord.y);
    const merger = new Merger(coord, inputDirs, outputDir);
    this.mergers.set(this.coordKey(coord.x, coord.y), merger);
    return merger;
  }

  removeMerger(x: number, y: number): boolean {
    const key = this.coordKey(x, y);
    if (!this.mergers.has(key)) return false;

    this.mergers.delete(key);
    this.grid.removeConveyor(x, y);
    return true;
  }

  getMerger(x: number, y: number): Merger | undefined {
    return this.mergers.get(this.coordKey(x, y));
  }

  /** Kayıtlı tüm Merger ünitelerini döner */
  getAllMergers(): Merger[] {
    return Array.from(this.mergers.values());
  }

  // -------------------------------------------------------------
  // SİMÜLASYON DÖNGÜSÜ
  // -------------------------------------------------------------

  /**
   * Simülasyon zaman adımı (dt saniye).
   */
  tick(dt: number): void {
    if (dt <= 0) return;

    // 1. Hammadde giriş silolarını işlet
    this.tickIntakeNodes(dt);

    // 2. Tüm konveyörlerdeki eşyaları yerel olarak ilerlet
    for (const belt of this.belts.values()) {
      belt.tick(dt);
    }

    // 3. Splitter ve Merger ünitelerini ilerlet ve aktarımlarını yap
    for (const splitter of this.splitters.values()) {
      splitter.tick(dt, (dir, item) =>
        this.tryTransferFromNode(splitter.coord, dir, item.itemId),
      );
    }

    for (const merger of this.mergers.values()) {
      merger.tick(dt, (dir, item) =>
        this.tryTransferFromNode(merger.coord, dir, item.itemId),
      );
    }

    // 4. Bantlar arası aktarımları (hand-off) gerçekleştir
    this.resolveTransfers();
  }

  /**
   * Bir düğümden (Splitter / Merger) belirli bir yöndeki komşuya eşya aktarmayı dener.
   */
  private tryTransferFromNode(
    fromCoord: GridCoord,
    outDir: Direction,
    itemId: string,
  ): boolean {
    const vec = DIRECTION_VECTORS[outDir];
    const targetX = fromCoord.x + vec.dx;
    const targetY = fromCoord.y + vec.dy;

    if (!this.grid.isInBounds(targetX, targetY)) return false;

    const targetCell = this.grid.getCell(targetX, targetY);
    if (!targetCell) return false;

    // İhracat portu
    if (targetCell.type === 'EXPORT') {
      if (this.onItemDelivered) {
        this.onItemDelivered({
          itemId,
          exportCoord: { x: targetX, y: targetY },
        });
      }
      return true;
    }

    // Konveyör
    if (targetCell.type === 'CONVEYOR') {
      const belt = this.getConveyor(targetX, targetY);
      if (belt && belt.canAcceptItem()) {
        belt.acceptItem(itemId, 0.0);
        return true;
      }

      // Veya hedef bir Merger olabilir
      const merger = this.getMerger(targetX, targetY);
      if (merger && merger.canAcceptFrom(outDir)) {
        return merger.acceptItemFrom(outDir, itemId);
      }
    }

    return false;
  }

  /**
   * INTAKE silolarının zamanlayıcılarını işletir ve bağlı olan ilk hatta eşya bırakır.
   */
  private tickIntakeNodes(dt: number): void {
    for (let y = 0; y < this.grid.height; y++) {
      for (let x = 0; x < this.grid.width; x++) {
        const cell = this.grid.getCell(x, y);
        if (cell && cell.type === 'INTAKE' && cell.intakeData) {
          const data = cell.intakeData;
          data.timerSec += dt;

          if (data.timerSec >= data.intervalSec) {
            const targetBelt = this.findIntakeTargetBelt(x, y);
            if (targetBelt && targetBelt.canAcceptItem()) {
              targetBelt.acceptItem(data.itemId, 0.0);
              data.timerSec -= data.intervalSec;
            }
          }
        }
      }
    }
  }

  /**
   * Girişin hammadde verdiği bant: yalnızca çıkış yönündeki komşu hücre (DEC-026).
   * Yanından geçen başka hatlara ve girişe doğru akan banda hammadde basılmaz.
   */
  private findIntakeTargetBelt(intakeX: number, intakeY: number): ConveyorBelt | null {
    const data = this.grid.getCell(intakeX, intakeY)?.intakeData;
    if (!data) return null;
    if (!data.direction) {
      data.direction = this.inferIntakeDirection(intakeX, intakeY);
    }

    const vec = DIRECTION_VECTORS[data.direction];
    const belt = this.getConveyor(intakeX + vec.dx, intakeY + vec.dy);
    if (!belt || belt.direction === OPPOSITE_DIRECTIONS[data.direction]) return null;
    return belt.canAcceptItem() ? belt : null;
  }

  /**
   * Yönü kayıtlı olmayan (eski kayıt) girişlere yön verir: önce girişten uzağa akan
   * komşu bant, yoksa herhangi bir komşu bant, o da yoksa güney.
   */
  resolveIntakeDirections(): void {
    for (const cell of this.grid.getIntakeCells()) {
      if (cell.intakeData && !cell.intakeData.direction) {
        cell.intakeData.direction = this.inferIntakeDirection(cell.coord.x, cell.coord.y);
      }
    }
  }

  private inferIntakeDirection(intakeX: number, intakeY: number): Direction {
    const dirs: Direction[] = ['SOUTH', 'EAST', 'WEST', 'NORTH'];
    let fallback: Direction | null = null;
    for (const dir of dirs) {
      const vec = DIRECTION_VECTORS[dir];
      const belt = this.getConveyor(intakeX + vec.dx, intakeY + vec.dy);
      if (!belt) continue;
      if (belt.direction === dir) return dir;
      if (!fallback && belt.direction !== OPPOSITE_DIRECTIONS[dir]) fallback = dir;
    }
    return fallback ?? 'SOUTH';
  }

  /**
   * Bant çıkış uçlarındaki (progress >= 1.0) eşyaları hedef komşu hücreye aktarır.
   */
  private resolveTransfers(): void {
    for (const belt of this.belts.values()) {
      const frontItem = belt.peekFrontItem();
      if (!frontItem) continue;

      const vec = DIRECTION_VECTORS[belt.direction];
      const targetX = belt.coord.x + vec.dx;
      const targetY = belt.coord.y + vec.dy;

      if (!this.grid.isInBounds(targetX, targetY)) {
        continue;
      }

      const targetCell = this.grid.getCell(targetX, targetY);
      if (!targetCell) continue;

      // Durum A: İhracat sandığı
      if (targetCell.type === 'EXPORT') {
        const popped = belt.popFrontItem();
        if (popped && this.onItemDelivered) {
          this.onItemDelivered({
            itemId: popped.itemId,
            exportCoord: { x: targetX, y: targetY },
          });
        }
        continue;
      }

      // Durum B: Hedef hücre bir KONVEYÖR veya SPLITTER veya MERGER
      if (targetCell.type === 'CONVEYOR') {
        // B1: Düz Konveyör
        const targetBelt = this.getConveyor(targetX, targetY);
        if (targetBelt && targetBelt.canAcceptItem()) {
          const popped = belt.popFrontItem();
          if (popped) {
            targetBelt.acceptItem(popped.itemId, 0.0);
          }
          continue;
        }

        // B2: Splitter
        const splitter = this.getSplitter(targetX, targetY);
        if (splitter && splitter.inputDirection === belt.direction && splitter.canAcceptItem()) {
          const popped = belt.popFrontItem();
          if (popped) {
            splitter.acceptItem(popped.itemId);
          }
          continue;
        }

        // B3: Merger
        const merger = this.getMerger(targetX, targetY);
        if (merger && merger.canAcceptFrom(belt.direction)) {
          const popped = belt.popFrontItem();
          if (popped) {
            merger.acceptItemFrom(belt.direction, popped.itemId);
          }
          continue;
        }
      }

      // Durum C: Hedef hücre bir MAKİNE GİRİŞ PORTU
      if (
        targetCell.type === 'MACHINE' &&
        targetCell.machineInstanceId &&
        this.machineProvider
      ) {
        const machine = this.machineProvider(targetCell.machineInstanceId);
        if (machine) {
          // Makineye doğru akan bant, makinenin hangi kenarına dayanırsa dayansın girdiyi
          // teslim eder (DEC-023). Giriş portu yalnızca önerilen yönü gösterir; çıkış
          // portu ise bağlayıcıdır. Makine reçetesinin istemediği eşyayı zaten almaz.
          if (machine.canAcceptInput(frontItem.itemId)) {
            const popped = belt.popFrontItem();
            if (popped) {
              machine.addInput(popped.itemId);
            }
            continue;
          }
        }
      }
    }
  }

  // -------------------------------------------------------------
  // SERİLEŞTİRME (SAVE / LOAD)
  // -------------------------------------------------------------

  serialize(): ConveyorEntityState[] {
    const list: ConveyorEntityState[] = [];
    for (const belt of this.belts.values()) {
      list.push(belt.serialize());
    }
    for (const splitter of this.splitters.values()) {
      list.push(splitter.serialize());
    }
    for (const merger of this.mergers.values()) {
      list.push(merger.serialize());
    }
    return list;
  }

  loadFromSerialized(states: ConveyorEntityState[], defaultSpeed = 1.0): void {
    // Tüm mevcut bantları, splitter ve mergerları temizle
    for (const belt of this.belts.values()) {
      this.grid.removeConveyor(belt.coord.x, belt.coord.y);
    }
    for (const splitter of this.splitters.values()) {
      this.grid.removeConveyor(splitter.coord.x, splitter.coord.y);
    }
    for (const merger of this.mergers.values()) {
      this.grid.removeConveyor(merger.coord.x, merger.coord.y);
    }
    this.belts.clear();
    this.splitters.clear();
    this.mergers.clear();

    for (const state of states) {
      if (!this.grid.canPlaceConveyor(state.coord.x, state.coord.y)) continue;

      if (state.isSplitter && state.splitterOutputDirs) {
        const splitter = this.addSplitter(state.coord, state.direction, state.splitterOutputDirs);
        for (const slot of state.slots) {
          splitter.acceptItem(slot.itemId, slot.progress);
        }
      } else if (state.isMerger && state.mergerInputDirs) {
        const merger = this.addMerger(state.coord, state.mergerInputDirs, state.direction);
        for (const slot of state.slots) {
          merger.acceptItemFrom(state.mergerInputDirs[0], slot.itemId, slot.progress);
        }
      } else {
        this.grid.setConveyor(state.coord.x, state.coord.y);
        const belt = ConveyorBelt.deserialize(state, state.speed || defaultSpeed);
        this.belts.set(this.coordKey(state.coord.x, state.coord.y), belt);
      }
    }
  }
}
