/* ======================================================================
 * src/factory/simulation/GridMap.ts — Mekânsal Izgara ve Hücre İndeksi
 *
 * Fabrika zeminindeki N x M hücreleri, sınır kontrollerini, engelleri,
 * sabit giriş/çıkış kapılarını ve çok hücreli makine yerleşimlerini
 * yöneten saf TypeScript mekânsal indeks sınıfı.
 * Phaser bağımlılığı yoktur.
 * ====================================================================== */

import type { GridCoord } from '../types.ts';

export type CellType =
  | 'EMPTY'
  | 'OBSTACLE'
  | 'CONVEYOR'
  | 'MACHINE'
  | 'INTAKE'
  | 'EXPORT';

export interface GridCell {
  coord: GridCoord;
  type: CellType;
  /** Eğer hücre bir makine tarafından işgal edilmişse makine ID'si */
  machineInstanceId?: string;
  /** Makinenin sol-üst referans (kök) koordinatı */
  machineRootCoord?: GridCoord;
  /** Eğer hücre sabit hammadde girişiyse eşya ve debi bilgisi */
  intakeData?: {
    itemId: string;
    intervalSec: number;
    timerSec: number;
  };
}

export class GridMap {
  readonly width: number;
  readonly height: number;
  private cells: GridCell[];

  constructor(width: number, height: number) {
    if (width <= 0 || height <= 0) {
      throw new Error(`[GridMap] Geçersiz ızgara boyutları: ${width}x${height}`);
    }
    this.width = width;
    this.height = height;
    this.cells = new Array(width * height);

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const index = this.toIndex(x, y);
        this.cells[index] = {
          coord: { x, y },
          type: 'EMPTY',
        };
      }
    }
  }

  /** (x, y) ızgara sınırları içinde mi? */
  isInBounds(x: number, y: number): boolean {
    return x >= 0 && x < this.width && y >= 0 && y < this.height;
  }

  /** Düz 1D dizi indeksi */
  private toIndex(x: number, y: number): number {
    return y * this.width + x;
  }

  /** Hücreyi döner; sınırlar dışındaysa undefined döner */
  getCell(x: number, y: number): GridCell | undefined {
    if (!this.isInBounds(x, y)) return undefined;
    return this.cells[this.toIndex(x, y)];
  }

  /** Hücre tipini sorgular */
  getCellType(x: number, y: number): CellType | undefined {
    return this.getCell(x, y)?.type;
  }

  /** Hücre boş ve inşa edilebilir mi? */
  isCellEmpty(x: number, y: number): boolean {
    const cell = this.getCell(x, y);
    return cell !== undefined && cell.type === 'EMPTY';
  }

  // -------------------------------------------------------------
  // SABİT ALANLAR: ENGEL, GİRİŞ & ÇIKIŞ PORTLARI
  // -------------------------------------------------------------

  /** Sabit engel yerleştirir (kolon, duvar vb.) */
  setObstacle(x: number, y: number): void {
    if (!this.isInBounds(x, y)) {
      throw new Error(`[GridMap] Sınır dışı engel koordinatı: (${x}, ${y})`);
    }
    const cell = this.cells[this.toIndex(x, y)];
    cell.type = 'OBSTACLE';
  }

  /** Sabit hammadde giriş silosu yerleştirir */
  setIntake(x: number, y: number, itemId: string, intervalSec = 1.0): void {
    if (!this.isInBounds(x, y)) {
      throw new Error(`[GridMap] Sınır dışı hammadde girişi: (${x}, ${y})`);
    }
    const cell = this.cells[this.toIndex(x, y)];
    cell.type = 'INTAKE';
    cell.intakeData = {
      itemId,
      intervalSec,
      timerSec: 0,
    };
  }

  /** Sabit ihracat/sevkiyat sandığı yerleştirir */
  setExport(x: number, y: number): void {
    if (!this.isInBounds(x, y)) {
      throw new Error(`[GridMap] Sınır dışı sevkiyat sandığı: (${x}, ${y})`);
    }
    const cell = this.cells[this.toIndex(x, y)];
    cell.type = 'EXPORT';
  }

  // -------------------------------------------------------------
  // KONVEYÖR YERLEŞİMİ
  // -------------------------------------------------------------

  /** Konveyör yerleştirilebilir mi? */
  canPlaceConveyor(x: number, y: number): boolean {
    return this.isCellEmpty(x, y);
  }

  /** Konveyör hücresini işaretler */
  setConveyor(x: number, y: number): void {
    if (!this.canPlaceConveyor(x, y)) {
      throw new Error(`[GridMap] Konveyör yerleştirilemez: (${x}, ${y})`);
    }
    this.cells[this.toIndex(x, y)].type = 'CONVEYOR';
  }

  /** Konveyörü kaldırır */
  removeConveyor(x: number, y: number): void {
    const cell = this.getCell(x, y);
    if (cell && cell.type === 'CONVEYOR') {
      cell.type = 'EMPTY';
    }
  }

  // -------------------------------------------------------------
  // MAKİNE YERLEŞİMİ (ÇOK HÜCRELİ FOOTPRINT DESTEĞİ)
  // -------------------------------------------------------------

  /**
   * Belirtilen sol-üst koordinat ve boyutlarda bir makine yerleştirilebilir mi?
   * Makinenin kapladığı TÜM hücrelerin sınırlar içinde ve EMPTY olması şarttır.
   */
  canPlaceMachine(x: number, y: number, width: number, height: number): boolean {
    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const curX = x + dx;
        const curY = y + dy;
        if (!this.isCellEmpty(curX, curY)) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Makineyi ızgaraya yerleştirir ve kapladığı tüm hücreleri 'MACHINE'
   * olarak işaretleyip instanceId ve kök koordinatını bağlar.
   */
  placeMachine(
    instanceId: string,
    rootX: number,
    rootY: number,
    width: number,
    height: number,
  ): void {
    if (!this.canPlaceMachine(rootX, rootY, width, height)) {
      throw new Error(
        `[GridMap] Makine yerleştirilemez: (${rootX}, ${rootY}) [${width}x${height}]`,
      );
    }

    const rootCoord: GridCoord = { x: rootX, y: rootY };

    for (let dy = 0; dy < height; dy++) {
      for (let dx = 0; dx < width; dx++) {
        const curX = rootX + dx;
        const curY = rootY + dy;
        const cell = this.cells[this.toIndex(curX, curY)];
        cell.type = 'MACHINE';
        cell.machineInstanceId = instanceId;
        cell.machineRootCoord = rootCoord;
      }
    }
  }

  /**
   * Belirtilen makine ID'sine ait tüm hücreleri temizleyerek tekrar EMPTY yapar.
   */
  removeMachine(instanceId: string): void {
    for (const cell of this.cells) {
      if (cell.type === 'MACHINE' && cell.machineInstanceId === instanceId) {
        cell.type = 'EMPTY';
        cell.machineInstanceId = undefined;
        cell.machineRootCoord = undefined;
      }
    }
  }

  /**
   * (x, y) hücresindeki makine bilgilerini döner.
   */
  getMachineAt(
    x: number,
    y: number,
  ): { instanceId: string; rootCoord: GridCoord } | null {
    const cell = this.getCell(x, y);
    if (cell && cell.type === 'MACHINE' && cell.machineInstanceId && cell.machineRootCoord) {
      return {
        instanceId: cell.machineInstanceId,
        rootCoord: cell.machineRootCoord,
      };
    }
    return null;
  }

  // -------------------------------------------------------------
  // SERİLEŞTİRME VE HUCRE SORGULARI
  // -------------------------------------------------------------

  /** Tüm hammadde giriş silolarını döner */
  getIntakeCells(): GridCell[] {
    return this.cells.filter((c) => c.type === 'INTAKE');
  }

  /** Tüm ihracat sandığı hücrelerini döner */
  getExportCells(): GridCell[] {
    return this.cells.filter((c) => c.type === 'EXPORT');
  }

  /** Tüm sabit engel hücrelerini döner */
  getObstacleCells(): GridCell[] {
    return this.cells.filter((c) => c.type === 'OBSTACLE');
  }

  /** Tüm konveyör hücrelerini döner */
  getConveyorCells(): GridCell[] {
    return this.cells.filter((c) => c.type === 'CONVEYOR');
  }

  /** Tüm makine hücrelerini döner */
  getMachineCells(): GridCell[] {
    return this.cells.filter((c) => c.type === 'MACHINE');
  }
}
