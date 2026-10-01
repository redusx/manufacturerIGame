/* ======================================================================
 * src/factory/simulation/MachineEntity.ts — Makine Çalışma Zamanı Varlığı
 *
 * Fabrika ızgarasındaki tekil bir makine örneğini (instance),
 * yönelimini (rotasyon), dinamik port konumlarını, iç girdi/çıktı
 * tamponlarını ve anlık durumunu yöneten saf TypeScript sınıfı.
 * Phaser bağımlılığı yoktur.
 * ====================================================================== */

import type {
  Direction,
  GridCoord,
  MachineDefinition,
  MachineEntityState,
  MachineOperationalStatus,
  MachinePort,
} from '../types.ts';
import { getRotatedPort } from './MachineRegistry.ts';
import { RecipeRegistry, defaultRecipeRegistry } from './RecipeRegistry.ts';

/**
 * Makinenin rotasyon sonrası dünya ızgarasındaki port bilgisi
 */
export interface MachineWorldPort {
  /** Port kimliği (örn: 'in_main', 'out_main', 'out_scrap') */
  id: string;
  /** Giriş mi çıkış mı */
  type: 'INPUT' | 'OUTPUT';
  /** Makine içi yerel karo koordinatı (rotasyon sonrası) */
  localCoord: GridCoord;
  /** Fabrika ızgarasındaki mutlak karo koordinatı */
  worldCoord: GridCoord;
  /** Portun dışa açılan yönü (Bant bu yöne doğru akmalı veya bu yönden gelmeli) */
  direction: Direction;
}

export class MachineEntity {
  readonly instanceId: string;
  readonly defId: string;
  readonly def: MachineDefinition;
  readonly coord: GridCoord;
  rotation: 0 | 90 | 180 | 270;
  activeRecipeId: string | null = null;
  status: MachineOperationalStatus = 'IDLE';
  progressSec = 0;

  /** Girdi tamponu: itemId -> mevcut adet */
  private inputBuffer = new Map<string, number>();
  /** Çıktı tamponu: itemId -> mevcut adet */
  private outputBuffer = new Map<string, number>();

  private recipeRegistry: RecipeRegistry;

  constructor(
    instanceId: string,
    def: MachineDefinition,
    coord: GridCoord,
    rotation: 0 | 90 | 180 | 270 = 0,
    initialRecipeId: string | null = null,
    recipeRegistry: RecipeRegistry = defaultRecipeRegistry,
  ) {
    this.instanceId = instanceId;
    this.defId = def.id;
    this.def = def;
    this.coord = { x: coord.x, y: coord.y };
    this.rotation = rotation;
    this.recipeRegistry = recipeRegistry;

    if (initialRecipeId !== null && initialRecipeId !== undefined) {
      this.setRecipe(initialRecipeId);
    } else if (def.supportedRecipeIds.length > 0) {
      // Varsayılan olarak ilk desteklenen reçeteyi seç
      this.setRecipe(def.supportedRecipeIds[0]);
    }
  }

  // -------------------------------------------------------------
  // BOYUT VE ALAN KAPLAMA (FOOTPRINT)
  // -------------------------------------------------------------

  /** Rotasyona göre makinenin ızgaradaki genişliği */
  get effectiveWidth(): number {
    return this.rotation === 90 || this.rotation === 270
      ? this.def.height
      : this.def.width;
  }

  /** Rotasyona göre makinenin ızgaradaki yüksekliği */
  get effectiveHeight(): number {
    return this.rotation === 90 || this.rotation === 270
      ? this.def.width
      : this.def.height;
  }

  /**
   * Makinenin ızgarada kapladığı tüm dünya karo koordinatlarını döner.
   */
  getOccupiedCoords(): GridCoord[] {
    const coords: GridCoord[] = [];
    const w = this.effectiveWidth;
    const h = this.effectiveHeight;

    for (let dy = 0; dy < h; dy++) {
      for (let dx = 0; dx < w; dx++) {
        coords.push({
          x: this.coord.x + dx,
          y: this.coord.y + dy,
        });
      }
    }

    return coords;
  }

  /**
   * Verilen dünya koordinatı bu makinenin gövdesi içinde mi?
   */
  containsCoord(x: number, y: number): boolean {
    const minX = this.coord.x;
    const maxX = this.coord.x + this.effectiveWidth - 1;
    const minY = this.coord.y;
    const maxY = this.coord.y + this.effectiveHeight - 1;

    return x >= minX && x <= maxX && y >= minY && y <= maxY;
  }

  // -------------------------------------------------------------
  // DİNAMİK PORT GEOMETRİSİ
  // -------------------------------------------------------------

  /**
   * Makinenin rotasyonuna göre hesaplanmış dünya portlarını döner.
   */
  getWorldPorts(): MachineWorldPort[] {
    return this.def.ports.map((port) => {
      const rotated = getRotatedPort(
        port,
        this.def.width,
        this.def.height,
        this.rotation,
      );

      return {
        id: port.id,
        type: port.type,
        localCoord: { x: rotated.localX, y: rotated.localY },
        worldCoord: {
          x: this.coord.x + rotated.localX,
          y: this.coord.y + rotated.localY,
        },
        direction: rotated.direction,
      };
    });
  }

  /** Sadece giriş portlarını döner */
  getInputPorts(): MachineWorldPort[] {
    return this.getWorldPorts().filter((p) => p.type === 'INPUT');
  }

  /** Sadece çıkış portlarını döner */
  getOutputPorts(): MachineWorldPort[] {
    return this.getWorldPorts().filter((p) => p.type === 'OUTPUT');
  }

  /**
   * Belirtilen dünya koordinatında bulunan portu arar.
   */
  getPortAt(worldX: number, worldY: number): MachineWorldPort | undefined {
    return this.getWorldPorts().find(
      (p) => p.worldCoord.x === worldX && p.worldCoord.y === worldY,
    );
  }

  /**
   * Makineyi saat yönünde 90 derece döndürür.
   */
  rotateCW(): void {
    this.rotation = ((this.rotation + 90) % 360) as 0 | 90 | 180 | 270;
  }

  // -------------------------------------------------------------
  // REÇETE YÖNETİMİ
  // -------------------------------------------------------------

  /**
   * Makinenin aktif reçetesini ayarlar.
   * Reçete makine tarafından desteklenmiyorsa hata fırlatır.
   */
  setRecipe(recipeId: string | null): void {
    if (recipeId === null) {
      this.activeRecipeId = null;
      this.progressSec = 0;
      this.status = 'IDLE';
      return;
    }

    if (!this.def.supportedRecipeIds.includes(recipeId)) {
      throw new Error(
        `[MachineEntity] Makine '${this.defId}' bu reçeteyi desteklemiyor: '${recipeId}'`,
      );
    }

    if (this.activeRecipeId !== recipeId) {
      this.activeRecipeId = recipeId;
      this.progressSec = 0;
      this.status = 'WAITING_INPUT';
    }
  }

  // -------------------------------------------------------------
  // GİRDİ TAMPONU (INPUT BUFFER)
  // -------------------------------------------------------------

  /**
   * Makine belirtilen girdiyi kabul edebilir mi?
   * - Aktif bir reçete olmalı ve eşya bu reçetenin girdileri arasında bulunmalı.
   * - Eşyanın mevcut adedi + count <= inputBufferCapacity olmalı.
   */
  canAcceptInput(itemId: string, count = 1): boolean {
    if (!this.activeRecipeId) return false;

    const recipe = this.recipeRegistry.get(this.activeRecipeId);
    if (!recipe) return false;

    const isRequired = recipe.inputs.some((input) => input.itemId === itemId);
    if (!isRequired) return false;

    const currentCount = this.inputBuffer.get(itemId) || 0;
    return currentCount + count <= this.def.inputBufferCapacity;
  }

  /**
   * Girdi tamponuna eşya ekler.
   */
  addInput(itemId: string, count = 1): boolean {
    if (!this.canAcceptInput(itemId, count)) return false;

    const current = this.inputBuffer.get(itemId) || 0;
    this.inputBuffer.set(itemId, current + count);
    return true;
  }

  /**
   * Belirtilen girdi eşyasının mevcut adedini döner.
   */
  getInputCount(itemId: string): number {
    return this.inputBuffer.get(itemId) || 0;
  }

  /**
   * Aktif reçetenin gerektirdiği TÜM girdiler yeterli miktarda mevcut mu?
   */
  hasRecipeInputs(): boolean {
    if (!this.activeRecipeId) return false;

    const recipe = this.recipeRegistry.get(this.activeRecipeId);
    if (!recipe) return false;

    for (const input of recipe.inputs) {
      const current = this.inputBuffer.get(input.itemId) || 0;
      if (current < input.count) {
        return false;
      }
    }

    return true;
  }

  /**
   * Aktif reçetenin gerektirdiği girdileri tampondan düşer.
   */
  consumeRecipeInputs(): boolean {
    if (!this.hasRecipeInputs()) return false;

    const recipe = this.recipeRegistry.get(this.activeRecipeId!)!;
    for (const input of recipe.inputs) {
      const current = this.inputBuffer.get(input.itemId) || 0;
      const remainder = current - input.count;
      if (remainder <= 0) {
        this.inputBuffer.delete(input.itemId);
      } else {
        this.inputBuffer.set(input.itemId, remainder);
      }
    }

    return true;
  }

  // -------------------------------------------------------------
  // ÇIKTI TAMPONU (OUTPUT BUFFER)
  // -------------------------------------------------------------

  /**
   * Çıktı tamponundaki toplam eşya sayısı.
   */
  getOutputTotalCount(): number {
    let total = 0;
    for (const count of this.outputBuffer.values()) {
      total += count;
    }
    return total;
  }

  /**
   * Belirli bir çıktının adedini döner.
   */
  getOutputCount(itemId: string): number {
    return this.outputBuffer.get(itemId) || 0;
  }

  /**
   * Çıktı tamponu belirtilen miktarda eşyayı alabilir mi?
   */
  canAcceptOutput(itemId: string, count = 1): boolean {
    return this.getOutputTotalCount() + count <= this.def.outputBufferCapacity;
  }

  /**
   * Çıktı tamponuna eşya ekler.
   */
  addOutput(itemId: string, count = 1): boolean {
    if (!this.canAcceptOutput(itemId, count)) return false;

    const current = this.outputBuffer.get(itemId) || 0;
    this.outputBuffer.set(itemId, current + count);
    return true;
  }

  /**
   * Aktif reçetenin TÜM çıktılarını tampona sığdırabilir mi?
   */
  canAcceptRecipeOutputs(): boolean {
    if (!this.activeRecipeId) return false;

    const recipe = this.recipeRegistry.get(this.activeRecipeId);
    if (!recipe) return false;

    const totalToAdd = recipe.outputs.reduce((sum, out) => sum + out.count, 0);
    return this.getOutputTotalCount() + totalToAdd <= this.def.outputBufferCapacity;
  }

  /**
   * Aktif reçetenin çıktılarını çıktı tamponuna aktarır.
   */
  produceRecipeOutputs(): boolean {
    if (!this.canAcceptRecipeOutputs()) return false;

    const recipe = this.recipeRegistry.get(this.activeRecipeId!)!;
    for (const out of recipe.outputs) {
      const current = this.outputBuffer.get(out.itemId) || 0;
      this.outputBuffer.set(out.itemId, current + out.count);
    }

    return true;
  }

  /**
   * Belirtilen çıktı eşyasından 1 birim çıkarır (örn. bant üzerine fırlatıldığında).
   */
  popOutput(itemId: string): boolean {
    const current = this.outputBuffer.get(itemId) || 0;
    if (current <= 0) return false;

    if (current === 1) {
      this.outputBuffer.delete(itemId);
    } else {
      this.outputBuffer.set(itemId, current - 1);
    }
    return true;
  }

  /**
   * Çıktı tamponundaki ilk hazır eşyayı döner ve tampondan siler.
   */
  popAnyOutput(): { itemId: string } | null {
    for (const [itemId, count] of this.outputBuffer.entries()) {
      if (count > 0) {
        this.popOutput(itemId);
        return { itemId };
      }
    }
    return null;
  }

  /**
   * Çıktı tamponunda bulunan ilk eşyaya göz atar (silmez).
   */
  peekAnyOutput(): { itemId: string; count: number } | null {
    for (const [itemId, count] of this.outputBuffer.entries()) {
      if (count > 0) {
        return { itemId, count };
      }
    }
    return null;
  }

  // -------------------------------------------------------------
  // TAMPON SNAPSHOT VE SIFIRLAMA
  // -------------------------------------------------------------

  getInputBufferSnapshot(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, val] of this.inputBuffer.entries()) {
      if (val > 0) result[key] = val;
    }
    return result;
  }

  getOutputBufferSnapshot(): Record<string, number> {
    const result: Record<string, number> = {};
    for (const [key, val] of this.outputBuffer.entries()) {
      if (val > 0) result[key] = val;
    }
    return result;
  }

  clearBuffers(): void {
    this.inputBuffer.clear;
    this.inputBuffer = new Map();
    this.outputBuffer = new Map();
  }

  // -------------------------------------------------------------
  // SERİLEŞTİRME (SAVE & LOAD)
  // -------------------------------------------------------------

  serialize(): MachineEntityState {
    return {
      instanceId: this.instanceId,
      defId: this.defId,
      coord: { x: this.coord.x, y: this.coord.y },
      rotation: this.rotation,
      activeRecipeId: this.activeRecipeId,
      status: this.status,
      progressSec: this.progressSec,
      inputBuffer: this.getInputBufferSnapshot(),
      outputBuffer: this.getOutputBufferSnapshot(),
    };
  }

  static deserialize(
    state: MachineEntityState,
    def: MachineDefinition,
    recipeRegistry: RecipeRegistry = defaultRecipeRegistry,
  ): MachineEntity {
    const entity = new MachineEntity(
      state.instanceId,
      def,
      state.coord,
      state.rotation,
      state.activeRecipeId,
      recipeRegistry,
    );

    entity.status = state.status;
    entity.progressSec = state.progressSec;

    // Tamponları geri yükle
    for (const [itemId, count] of Object.entries(state.inputBuffer)) {
      if (count > 0) entity.inputBuffer.set(itemId, count);
    }
    for (const [itemId, count] of Object.entries(state.outputBuffer)) {
      if (count > 0) entity.outputBuffer.set(itemId, count);
    }

    return entity;
  }
}
