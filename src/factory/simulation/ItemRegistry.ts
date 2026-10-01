/* ======================================================================
 * src/factory/simulation/ItemRegistry.ts — Eşya Kataloğu ve Kayıt Defteri
 *
 * Tüm hammadde, ara ürün, bileşen ve nihai havacılık ürünlerinin
 * merkezi veri kataloğu ve sorgulama yardımcıları.
 * Saf TypeScript — Phaser bağımlılığı yoktur.
 * ====================================================================== */

import type { ItemDefinition } from '../types.ts';

export class ItemRegistry {
  private items = new Map<string, ItemDefinition>();

  constructor() {
    this.registerDefaults();
  }

  /** Yeni bir eşya kaydeder */
  register(item: ItemDefinition): void {
    if (this.items.has(item.id)) {
      throw new Error(`[ItemRegistry] Eşya zaten kayıtlı: ${item.id}`);
    }
    this.items.set(item.id, Object.freeze({ ...item }));
  }

  /** ID ile eşya tanımını döner; bulunamazsa undefined döner */
  get(id: string): ItemDefinition | undefined {
    return this.items.get(id);
  }

  /** ID ile eşya tanımını döner; bulunamazsa hata fırlatır */
  getOrThrow(id: string): ItemDefinition {
    const item = this.items.get(id);
    if (!item) {
      throw new Error(`[ItemRegistry] Tanımsız eşya ID: ${id}`);
    }
    return item;
  }

  /** Eşyanın kayıtlı olup olmadığını kontrol eder */
  has(id: string): boolean {
    return this.items.has(id);
  }

  /** Belirli bir kademedeki (tier: 0..4) tüm eşyaları döner */
  getByTier(tier: number): ItemDefinition[] {
    const result: ItemDefinition[] = [];
    for (const item of this.items.values()) {
      if (item.tier === tier) {
        result.push(item);
      }
    }
    return result;
  }

  /** Kayıtlı tüm eşyaları dizi olarak döner */
  getAll(): ItemDefinition[] {
    return Array.from(this.items.values());
  }

  /** Toplam kayıtlı eşya sayısı */
  get count(): number {
    return this.items.size;
  }

  /** Varsayılan oyun eşyalarını kaydeder */
  private registerDefaults(): void {
    // -------------------------------------------------------------
    // KADEME 0: HAMMADDELER (Doğal kaynaklar, madenler)
    // -------------------------------------------------------------
    this.register({
      id: 'iron_ore',
      name: 'Demir Cevheri',
      tier: 0,
      baseValue: 1,
      spriteKey: 'pickup_gear',
      colorTint: 0x7f8c8d,
    });

    this.register({
      id: 'copper_ore',
      name: 'Bakır Cevheri',
      tier: 0,
      baseValue: 1.2,
      spriteKey: 'pickup_gear',
      colorTint: 0xd35400,
    });

    this.register({
      id: 'silica_sand',
      name: 'Silikat Kumu',
      tier: 0,
      baseValue: 1.5,
      spriteKey: 'pickup_crystal',
      colorTint: 0xf1c40f,
    });

    this.register({
      id: 'crude_polymer',
      name: 'Ham Polimer',
      tier: 0,
      baseValue: 2,
      spriteKey: 'pickup_crystal',
      colorTint: 0x8e44ad,
    });

    // -------------------------------------------------------------
    // KADEME 1: BİRİNCİL İŞLENMİŞ ÜRÜNLER (Kırma, Eritme, Rafine)
    // -------------------------------------------------------------
    this.register({
      id: 'iron_powder',
      name: 'Demir Tozu',
      tier: 1,
      baseValue: 2.5,
      spriteKey: 'pickup_gear',
      colorTint: 0x95a5a6,
    });

    this.register({
      id: 'copper_powder',
      name: 'Bakır Tozu',
      tier: 1,
      baseValue: 3,
      spriteKey: 'pickup_gear',
      colorTint: 0xe67e22,
    });

    this.register({
      id: 'iron_ingot',
      name: 'Demir Külçe',
      tier: 1,
      baseValue: 6,
      spriteKey: 'pickup_gear',
      colorTint: 0xbdc3c7,
    });

    this.register({
      id: 'copper_ingot',
      name: 'Bakır Külçe',
      tier: 1,
      baseValue: 7,
      spriteKey: 'pickup_gear',
      colorTint: 0xf39c12,
    });

    this.register({
      id: 'optical_glass',
      name: 'Hassas Cam Blok',
      tier: 1,
      baseValue: 8,
      spriteKey: 'pickup_crystal',
      colorTint: 0x00d2d3,
    });

    this.register({
      id: 'plastic_pellet',
      name: 'Plastik Pelet',
      tier: 1,
      baseValue: 5,
      spriteKey: 'pickup_crystal',
      colorTint: 0x9b59b6,
    });

    this.register({
      id: 'metal_scrap',
      name: 'Hurda Talaş (Yan Ürün)',
      tier: 1,
      baseValue: 0.5,
      spriteKey: 'pickup_gear',
      colorTint: 0x34495e,
    });

    // -------------------------------------------------------------
    // KADEME 2: MEKANİK & ELEKTRONİK ARA BİLEŞENLER
    // -------------------------------------------------------------
    this.register({
      id: 'iron_plate',
      name: 'Çelik Levha',
      tier: 2,
      baseValue: 12,
      spriteKey: 'pickup_gear',
      colorTint: 0xecf0f1,
    });

    this.register({
      id: 'copper_wire',
      name: 'Bakır Tel Bobini',
      tier: 2,
      baseValue: 6,
      spriteKey: 'pickup_gear',
      colorTint: 0xe74c3c,
    });

    this.register({
      id: 'steel_gear',
      name: 'Hassas Dişli',
      tier: 2,
      baseValue: 18,
      spriteKey: 'pickup_gear',
      colorTint: 0xf1c40f,
    });

    this.register({
      id: 'circuit_substrate',
      name: 'Yalıtkan Kart Tabanı',
      tier: 2,
      baseValue: 20,
      spriteKey: 'pickup_crystal',
      colorTint: 0x27ae60,
    });

    // -------------------------------------------------------------
    // KADEME 3: İLERİ SİSTEMLER VE MODÜLLER
    // -------------------------------------------------------------
    this.register({
      id: 'electric_motor',
      name: 'Elektrik Motoru',
      tier: 3,
      baseValue: 45,
      spriteKey: 'pickup_gear',
      colorTint: 0x2980b9,
    });

    this.register({
      id: 'optical_sensor',
      name: 'Optik Tarayıcı Sensör',
      tier: 3,
      baseValue: 55,
      spriteKey: 'pickup_crystal',
      colorTint: 0x1abc9c,
    });

    this.register({
      id: 'microchip',
      name: 'Aviyonik Mikroçip',
      tier: 3,
      baseValue: 80,
      spriteKey: 'pickup_crystal',
      colorTint: 0x2ecc71,
    });

    this.register({
      id: 'reinforced_frame',
      name: 'Güçlendirilmiş Gövde Çerçevesi',
      tier: 3,
      baseValue: 90,
      spriteKey: 'pickup_gear',
      colorTint: 0xffffff,
    });

    // -------------------------------------------------------------
    // KADEME 4: NİHAİ HAVACILIK ÜRÜNLERİ (ROKET MONTAJI & BÜYÜK İHRACAT)
    // -------------------------------------------------------------
    this.register({
      id: 'guidance_computer',
      name: 'Güdüm & Navigasyon Bilgisayarı',
      tier: 4,
      baseValue: 350,
      spriteKey: 'coin_gold',
      colorTint: 0x00d2d3,
    });

    this.register({
      id: 'rocket_thruster_block',
      name: 'Güdümlü Roket İtici Blok',
      tier: 4,
      baseValue: 600,
      spriteKey: 'coin_gold',
      colorTint: 0xe74c3c,
    });

    this.register({
      id: 'aero_hull_plate',
      name: 'Aerodinamik Titanyum Kompozit Panel',
      tier: 4,
      baseValue: 450,
      spriteKey: 'coin_gold',
      colorTint: 0xf39c12,
    });
  }
}

/** Tekil global kayıt örneği (varsayılan) */
export const defaultItemRegistry = new ItemRegistry();
