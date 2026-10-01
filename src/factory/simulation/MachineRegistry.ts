/* ======================================================================
 * src/factory/simulation/MachineRegistry.ts — Makine Kataloğu ve Port Geometrisi
 *
 * Fabrikadaki tüm makinelerin fiziksel boyutları, port koordinatları,
 * rotasyon dönüşümleri ve reçete yeteneklerinin merkezi kataloğu.
 * Saf TypeScript — Phaser bağımlılığı yoktur.
 * ====================================================================== */

import type { Direction, MachineDefinition, MachinePort } from '../types.ts';
import { RecipeRegistry, defaultRecipeRegistry } from './RecipeRegistry.ts';

/** Yönlerin saat yönünde 90 derece döndürülmesi tablosu */
export const ROTATE_DIRECTION_CW: Record<Direction, Direction> = {
  NORTH: 'EAST',
  EAST:  'SOUTH',
  SOUTH: 'WEST',
  WEST:  'NORTH',
};

/**
 * Makinenin yerel koordinatlarındaki bir portu verilen dönüş açısına göre
 * (0, 90, 180, 270 derece) döndürür ve yeni yerel koordinatı ile yönünü hesaplar.
 */
export function getRotatedPort(
  port: MachinePort,
  machineW: number,
  machineH: number,
  rotation: 0 | 90 | 180 | 270,
): { localX: number; localY: number; direction: Direction } {
  let x = port.localX;
  let y = port.localY;
  let dir = port.direction;

  const steps = (rotation / 90) % 4;

  let currentW = machineW;
  let currentH = machineH;

  for (let i = 0; i < steps; i++) {
    // 90 derece CW rotasyon dönüşümü: (x, y) -> (H - 1 - y, x)
    const newX = currentH - 1 - y;
    const newY = x;
    x = newX;
    y = newY;
    dir = ROTATE_DIRECTION_CW[dir];

    // Boyutlar 90 derecede yer değiştirir
    const temp = currentW;
    currentW = currentH;
    currentH = temp;
  }

  return { localX: x, localY: y, direction: dir };
}

export class MachineRegistry {
  private machines = new Map<string, MachineDefinition>();

  constructor() {
    this.registerDefaults();
  }

  /** Yeni bir makine kaydeder */
  register(machine: MachineDefinition): void {
    if (this.machines.has(machine.id)) {
      throw new Error(`[MachineRegistry] Makine zaten kayıtlı: ${machine.id}`);
    }
    this.machines.set(machine.id, Object.freeze({ ...machine }));
  }

  /** ID ile makine tanımını döner */
  get(id: string): MachineDefinition | undefined {
    return this.machines.get(id);
  }

  /** ID ile makine tanımını döner; bulunamazsa hata fırlatır */
  getOrThrow(id: string): MachineDefinition {
    const machine = this.machines.get(id);
    if (!machine) {
      throw new Error(`[MachineRegistry] Tanımsız makine ID: ${id}`);
    }
    return machine;
  }

  /** Makinenin kayıtlı olup olmadığını kontrol eder */
  has(id: string): boolean {
    return this.machines.has(id);
  }

  /** Kategoriye göre makineleri döner */
  getByCategory(category: MachineDefinition['category']): MachineDefinition[] {
    const result: MachineDefinition[] = [];
    for (const machine of this.machines.values()) {
      if (machine.category === category) {
        result.push(machine);
      }
    }
    return result;
  }

  /** Kayıtlı tüm makineleri dizi olarak döner */
  getAll(): MachineDefinition[] {
    return Array.from(this.machines.values());
  }

  /** Toplam kayıtlı makine sayısı */
  get count(): number {
    return this.machines.size;
  }

  /**
   * Makinelerin `supportedRecipeIds` listesindeki tüm reçetelerin verilen
   * `RecipeRegistry` içerisinde tanımlı olduğunu ve kategori uyuşmasını doğrular.
   */
  validateAgainst(recipeRegistry: RecipeRegistry): void {
    for (const machine of this.machines.values()) {
      for (const recipeId of machine.supportedRecipeIds) {
        const recipe = recipeRegistry.get(recipeId);
        if (!recipe) {
          throw new Error(
            `[MachineRegistry] Makine '${machine.id}' tanımsız reçeteye referans veriyor: '${recipeId}'`,
          );
        }
        if (recipe.category !== machine.category) {
          throw new Error(
            `[MachineRegistry] Makine '${machine.id}' (${machine.category}) kategorisi ile reçete '${recipeId}' (${recipe.category}) kategorisi uyuşmuyor!`,
          );
        }
      }
    }
  }

  /** Varsayılan oyun makinelerini kaydeder */
  private registerDefaults(): void {
    // -------------------------------------------------------------
    // 1. KIRICI (Crusher) — 1x1, 1 Girdi (Arka/Kuzey), 1 Çıktı (Ön/Güney)
    // -------------------------------------------------------------
    this.register({
      id: 'crusher',
      name: 'Endüstriyel Kırıcı',
      description: 'Hammadde cevherlerini ince toz haline getirir.',
      width: 1,
      height: 1,
      category: 'crushing',
      baseCost: 100,
      supportedRecipeIds: ['recipe_crush_iron_ore', 'recipe_crush_copper_ore'],
      ports: [
        { id: 'in_main', type: 'INPUT', localX: 0, localY: 0, direction: 'NORTH' },
        { id: 'out_main', type: 'OUTPUT', localX: 0, localY: 0, direction: 'SOUTH' },
      ],
      spriteBaseKey: 'machine_press',
      spriteActiveKey: 'machine_press_part',
      inputBufferCapacity: 5,
      outputBufferCapacity: 5,
    });

    // -------------------------------------------------------------
    // 2. FIRIN (Smelter) — 2x1, 1 Girdi (Sol/Batı), 1 Çıktı (Sağ/Doğu)
    // -------------------------------------------------------------
    this.register({
      id: 'smelter',
      name: 'Yüksek Sıcaklık Fırını',
      description: 'Metal tozlarını ve silikatı yüksek ısıyla eritip külçeye dönüştürür.',
      width: 2,
      height: 1,
      category: 'smelting',
      baseCost: 250,
      supportedRecipeIds: [
        'recipe_smelt_iron_ingot',
        'recipe_smelt_copper_ingot',
        'recipe_smelt_optical_glass',
      ],
      ports: [
        { id: 'in_main', type: 'INPUT', localX: 0, localY: 0, direction: 'WEST' },
        { id: 'out_main', type: 'OUTPUT', localX: 1, localY: 0, direction: 'EAST' },
      ],
      spriteBaseKey: 'machine_bench',
      spriteActiveKey: 'machine_bench_part',
      inputBufferCapacity: 6,
      outputBufferCapacity: 6,
    });

    // -------------------------------------------------------------
    // 3. PRES MAKİNESİ (Press) — 1x2, 1 Girdi (Üst/Kuzey), 1 Çıktı (Alt/Güney)
    // -------------------------------------------------------------
    this.register({
      id: 'press',
      name: 'Hidrolik Pres Makinesi',
      description: 'Külçeleri yüksek basınçla damgalayarak levha ve çerçeve üretir.',
      width: 1,
      height: 2,
      category: 'pressing',
      baseCost: 300,
      supportedRecipeIds: ['recipe_press_iron_plate', 'recipe_press_reinforced_frame'],
      ports: [
        { id: 'in_main', type: 'INPUT', localX: 0, localY: 0, direction: 'NORTH' },
        { id: 'out_main', type: 'OUTPUT', localX: 0, localY: 1, direction: 'SOUTH' },
      ],
      spriteBaseKey: 'machine_press',
      spriteActiveKey: 'machine_press_part',
      inputBufferCapacity: 6,
      outputBufferCapacity: 6,
    });

    // -------------------------------------------------------------
    // 4. HASSAS KESİCİ (Cutter) — 1x1, 1 Girdi (Kuzey), 2 Çıktı (Güney + Doğu)
    // -------------------------------------------------------------
    this.register({
      id: 'cutter',
      name: 'Hassas Lazer Kesici',
      description: 'Plakaları keserek tel veya dişli üretir; talaş atığı çıkarabilir.',
      width: 1,
      height: 1,
      category: 'cutting',
      baseCost: 200,
      supportedRecipeIds: ['recipe_cut_copper_wire', 'recipe_cut_steel_gear'],
      ports: [
        { id: 'in_main', type: 'INPUT', localX: 0, localY: 0, direction: 'NORTH' },
        { id: 'out_main', type: 'OUTPUT', localX: 0, localY: 0, direction: 'SOUTH' },
        { id: 'out_scrap', type: 'OUTPUT', localX: 0, localY: 0, direction: 'EAST' }, // Yan ürün portu
      ],
      spriteBaseKey: 'machine_welder',
      spriteActiveKey: 'machine_welder_part',
      inputBufferCapacity: 5,
      outputBufferCapacity: 5,
    });

    // -------------------------------------------------------------
    // 5. MONTAJ TEZGAHI (Assembler) — 2x2, 2 Girdi (Kuzey), 1 Çıktı (Güney)
    // -------------------------------------------------------------
    this.register({
      id: 'assembler',
      name: 'Otomatik Montaj İstasyonu',
      description: 'Çoklu bileşenleri birleştirerek motor, çip ve roket parçaları üretir.',
      width: 2,
      height: 2,
      category: 'assembling',
      baseCost: 500,
      supportedRecipeIds: [
        'recipe_assemble_electric_motor',
        'recipe_assemble_optical_sensor',
        'recipe_assemble_microchip',
        'recipe_assemble_guidance_computer',
        'recipe_assemble_thruster_block',
      ],
      ports: [
        { id: 'in_1', type: 'INPUT', localX: 0, localY: 0, direction: 'NORTH' },
        { id: 'in_2', type: 'INPUT', localX: 1, localY: 0, direction: 'NORTH' },
        { id: 'out_main', type: 'OUTPUT', localX: 0, localY: 1, direction: 'SOUTH' },
      ],
      spriteBaseKey: 'machine_automation',
      spriteActiveKey: 'machine_automation_part',
      inputBufferCapacity: 8,
      outputBufferCapacity: 6,
    });

    // -------------------------------------------------------------
    // 6. KİMYASAL RAFİNERİ (Refinery) — 2x2, 2 Girdi (Batı), 2 Çıktı (Doğu)
    // -------------------------------------------------------------
    this.register({
      id: 'refinery',
      name: 'Polimer & Kompozit Rafinerisi',
      description: 'Kimyasal polimer ve alaşımları işleyerek ileri havacılık materyalleri üretir.',
      width: 2,
      height: 2,
      category: 'refining',
      baseCost: 800,
      supportedRecipeIds: [
        'recipe_refine_plastic',
        'recipe_refine_circuit_substrate',
        'recipe_refine_aero_hull_plate',
      ],
      ports: [
        { id: 'in_1', type: 'INPUT', localX: 0, localY: 0, direction: 'WEST' },
        { id: 'in_2', type: 'INPUT', localX: 0, localY: 1, direction: 'WEST' },
        { id: 'out_1', type: 'OUTPUT', localX: 1, localY: 0, direction: 'EAST' },
        { id: 'out_2', type: 'OUTPUT', localX: 1, localY: 1, direction: 'EAST' },
      ],
      spriteBaseKey: 'machine_bench',
      spriteActiveKey: 'machine_bench_part',
      inputBufferCapacity: 8,
      outputBufferCapacity: 8,
    });
  }
}

/** Tekil global makine kayıt örneği (varsayılan) */
export const defaultMachineRegistry = new MachineRegistry();
