/* ======================================================================
 * src/factory/simulation/RecipeRegistry.ts — Reçete Kataloğu ve Kayıt Defteri
 *
 * Fabrikadaki tüm dönüşüm ve montaj reçetelerinin veri-güdümlü tanımı,
 * kategori filtrelemesi ve eşya girdisi/çıktısı arama yardımcıları.
 * Saf TypeScript — Phaser bağımlılığı yoktur.
 * ====================================================================== */

import type { RecipeCategory, RecipeDefinition } from '../types.ts';
import { ItemRegistry, defaultItemRegistry } from './ItemRegistry.ts';

export class RecipeRegistry {
  private recipes = new Map<string, RecipeDefinition>();

  constructor() {
    this.registerDefaults();
  }

  /** Yeni bir reçete kaydeder */
  register(recipe: RecipeDefinition): void {
    if (this.recipes.has(recipe.id)) {
      throw new Error(`[RecipeRegistry] Reçete zaten kayıtlı: ${recipe.id}`);
    }
    this.recipes.set(recipe.id, Object.freeze({ ...recipe }));
  }

  /** ID ile reçete tanımını döner */
  get(id: string): RecipeDefinition | undefined {
    return this.recipes.get(id);
  }

  /** ID ile reçete tanımını döner; bulunamazsa hata fırlatır */
  getOrThrow(id: string): RecipeDefinition {
    const recipe = this.recipes.get(id);
    if (!recipe) {
      throw new Error(`[RecipeRegistry] Tanımsız reçete ID: ${id}`);
    }
    return recipe;
  }

  /** Reçetenin kayıtlı olup olmadığını kontrol eder */
  has(id: string): boolean {
    return this.recipes.has(id);
  }

  /** Belirli bir makine kategorisindeki ('crushing', 'smelting', vb.) tüm reçeteleri döner */
  getByCategory(category: RecipeCategory): RecipeDefinition[] {
    const result: RecipeDefinition[] = [];
    for (const recipe of this.recipes.values()) {
      if (recipe.category === category) {
        result.push(recipe);
      }
    }
    return result;
  }

  /** Belirli bir eşyayı ÇIKTI olarak üreten tüm reçeteleri döner */
  getRecipesProducing(itemId: string): RecipeDefinition[] {
    const result: RecipeDefinition[] = [];
    for (const recipe of this.recipes.values()) {
      if (recipe.outputs.some((out) => out.itemId === itemId)) {
        result.push(recipe);
      }
    }
    return result;
  }

  /** Belirli bir eşyayı GİRDİ olarak tüketen tüm reçeteleri döner */
  getRecipesConsuming(itemId: string): RecipeDefinition[] {
    const result: RecipeDefinition[] = [];
    for (const recipe of this.recipes.values()) {
      if (recipe.inputs.some((inp) => inp.itemId === itemId)) {
        result.push(recipe);
      }
    }
    return result;
  }

  /** Kayıtlı tüm reçeteleri dizi olarak döner */
  getAll(): RecipeDefinition[] {
    return Array.from(this.recipes.values());
  }

  /** Toplam kayıtlı reçete sayısı */
  get count(): number {
    return this.recipes.size;
  }

  /**
   * Reçetelerdeki tüm girdi ve çıktı eşyalarının verilen ItemRegistry
   * içerisinde tanımlı olduğunu doğrular. Eksik varsa hata fırlatır.
   */
  validateAgainst(itemRegistry: ItemRegistry): void {
    for (const recipe of this.recipes.values()) {
      for (const input of recipe.inputs) {
        if (!itemRegistry.has(input.itemId)) {
          throw new Error(
            `[RecipeRegistry] Reçete '${recipe.id}' tanımsız girdi eşyasına referans veriyor: '${input.itemId}'`,
          );
        }
      }
      for (const output of recipe.outputs) {
        if (!itemRegistry.has(output.itemId)) {
          throw new Error(
            `[RecipeRegistry] Reçete '${recipe.id}' tanımsız çıktı eşyasına referans veriyor: '${output.itemId}'`,
          );
        }
      }
    }
  }

  /** Varsayılan oyun reçetelerini kaydeder */
  private registerDefaults(): void {
    // -------------------------------------------------------------
    // 1. KIRICI REÇETELERİ (Crushing — 1 In -> 1 Out)
    // -------------------------------------------------------------
    this.register({
      id: 'recipe_crush_iron_ore',
      name: 'Demir Cevheri Kırma',
      category: 'crushing',
      inputs: [{ itemId: 'iron_ore', count: 1 }],
      outputs: [{ itemId: 'iron_powder', count: 1 }],
      processingTimeSec: 2.0,
    });

    this.register({
      id: 'recipe_crush_copper_ore',
      name: 'Bakır Cevheri Kırma',
      category: 'crushing',
      inputs: [{ itemId: 'copper_ore', count: 1 }],
      outputs: [{ itemId: 'copper_powder', count: 1 }],
      processingTimeSec: 2.0,
    });

    // -------------------------------------------------------------
    // 2. FIRIN REÇETELERİ (Smelting — Isıl İşlem, 1 In -> 1 Out)
    // -------------------------------------------------------------
    this.register({
      id: 'recipe_smelt_iron_ingot',
      name: 'Demir Külçe Dökümü',
      category: 'smelting',
      inputs: [{ itemId: 'iron_powder', count: 1 }],
      outputs: [{ itemId: 'iron_ingot', count: 1 }],
      processingTimeSec: 4.0, // Kırıcıdan 2 kat yavaş (darboğaz prensibi)
    });

    this.register({
      id: 'recipe_smelt_copper_ingot',
      name: 'Bakır Külçe Dökümü',
      category: 'smelting',
      inputs: [{ itemId: 'copper_powder', count: 1 }],
      outputs: [{ itemId: 'copper_ingot', count: 1 }],
      processingTimeSec: 4.0,
    });

    this.register({
      id: 'recipe_smelt_optical_glass',
      name: 'Hassas Cam Fırınlama',
      category: 'smelting',
      inputs: [{ itemId: 'silica_sand', count: 1 }],
      outputs: [{ itemId: 'optical_glass', count: 1 }],
      processingTimeSec: 3.0,
    });

    // -------------------------------------------------------------
    // 3. PRES REÇETELERİ (Pressing — Şekillendirme)
    // -------------------------------------------------------------
    this.register({
      id: 'recipe_press_iron_plate',
      name: 'Çelik Levha Presleme',
      category: 'pressing',
      inputs: [{ itemId: 'iron_ingot', count: 1 }],
      outputs: [{ itemId: 'iron_plate', count: 1 }],
      processingTimeSec: 3.0,
    });

    this.register({
      id: 'recipe_press_reinforced_frame',
      name: 'Ağır Gövde Çerçevesi Presleme',
      category: 'pressing',
      inputs: [{ itemId: 'iron_plate', count: 2 }],
      outputs: [{ itemId: 'reinforced_frame', count: 1 }],
      processingTimeSec: 5.0,
    });

    // -------------------------------------------------------------
    // 4. KESİCİ REÇETELERİ (Cutting — Yan Ürün / Talaş Çıkarma)
    // -------------------------------------------------------------
    this.register({
      id: 'recipe_cut_copper_wire',
      name: 'Bakır Tel Çekme',
      category: 'cutting',
      inputs: [{ itemId: 'copper_ingot', count: 1 }],
      outputs: [{ itemId: 'copper_wire', count: 2 }], // 1 Külçe -> 2 Tel
      processingTimeSec: 2.5,
    });

    this.register({
      id: 'recipe_cut_steel_gear',
      name: 'Hassas Dişli Kesimi (Hurda Çıkışlı)',
      category: 'cutting',
      inputs: [{ itemId: 'iron_plate', count: 1 }],
      outputs: [
        { itemId: 'steel_gear', count: 1 },
        { itemId: 'metal_scrap', count: 1, probability: 1.0 }, // Yan ürün talaş
      ],
      processingTimeSec: 3.5,
    });

    // -------------------------------------------------------------
    // 5. RAFİNERİ REÇETELERİ (Refining — Kimyasal & Polimer)
    // -------------------------------------------------------------
    this.register({
      id: 'recipe_refine_plastic',
      name: 'Polimer Peletleme',
      category: 'refining',
      inputs: [{ itemId: 'crude_polymer', count: 1 }],
      outputs: [{ itemId: 'plastic_pellet', count: 2 }],
      processingTimeSec: 3.0,
    });

    this.register({
      id: 'recipe_refine_circuit_substrate',
      name: 'Yalıtkan Kart Sentezi',
      category: 'refining',
      inputs: [
        { itemId: 'plastic_pellet', count: 1 },
        { itemId: 'copper_powder', count: 1 },
      ],
      outputs: [{ itemId: 'circuit_substrate', count: 1 }],
      processingTimeSec: 4.0,
    });

    this.register({
      id: 'recipe_refine_aero_hull_plate',
      name: 'Titanyum Kompozit Kaplama',
      category: 'refining',
      inputs: [
        { itemId: 'iron_plate', count: 1 },
        { itemId: 'plastic_pellet', count: 2 },
      ],
      outputs: [{ itemId: 'aero_hull_plate', count: 1 }],
      processingTimeSec: 6.0,
    });

    // -------------------------------------------------------------
    // 6. MONTAJ REÇETELERİ (Assembling — Çok Girdili İleri Sistemler)
    // -------------------------------------------------------------
    this.register({
      id: 'recipe_assemble_electric_motor',
      name: 'Elektrik Motoru Montajı',
      category: 'assembling',
      inputs: [
        { itemId: 'steel_gear', count: 1 },
        { itemId: 'copper_wire', count: 2 },
      ],
      outputs: [{ itemId: 'electric_motor', count: 1 }],
      processingTimeSec: 4.0,
    });

    this.register({
      id: 'recipe_assemble_optical_sensor',
      name: 'Optik Sensör Montajı',
      category: 'assembling',
      inputs: [
        { itemId: 'optical_glass', count: 1 },
        { itemId: 'circuit_substrate', count: 1 },
      ],
      outputs: [{ itemId: 'optical_sensor', count: 1 }],
      processingTimeSec: 5.0,
    });

    this.register({
      id: 'recipe_assemble_microchip',
      name: 'Aviyonik Mikroçip Montajı',
      category: 'assembling',
      inputs: [
        { itemId: 'circuit_substrate', count: 1 },
        { itemId: 'copper_wire', count: 2 },
      ],
      outputs: [{ itemId: 'microchip', count: 1 }],
      processingTimeSec: 6.0,
    });

    this.register({
      id: 'recipe_assemble_guidance_computer',
      name: 'Güdüm Bilgisayarı Sentezi',
      category: 'assembling',
      inputs: [
        { itemId: 'microchip', count: 1 },
        { itemId: 'optical_sensor', count: 1 },
        { itemId: 'electric_motor', count: 1 },
      ],
      outputs: [{ itemId: 'guidance_computer', count: 1 }],
      processingTimeSec: 8.0,
    });

    this.register({
      id: 'recipe_assemble_thruster_block',
      name: 'Güdümlü Roket İtici Blok Montajı',
      category: 'assembling',
      inputs: [
        { itemId: 'reinforced_frame', count: 1 },
        { itemId: 'electric_motor', count: 2 },
        { itemId: 'aero_hull_plate', count: 1 },
      ],
      outputs: [{ itemId: 'rocket_thruster_block', count: 1 }],
      processingTimeSec: 10.0,
    });
  }
}

/** Tekil global reçete kayıt örneği (varsayılan) */
export const defaultRecipeRegistry = new RecipeRegistry();
