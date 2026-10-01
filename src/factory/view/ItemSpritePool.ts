/* ======================================================================
 * src/factory/view/ItemSpritePool.ts — Eşya Piksel Sprite Havuzu
 *
 * Fabrika konveyör hatlarında ve üretim makinelerinde hareket eden eşyaların
 * GC (Garbage Collection) duraksaması yaratmadan 60 FPS hızında çizilmesi
 * için yüksek performanslı nesne havuzu (Object Pool).
 *
 * docs/ART_DIRECTION.md ve src/ui/theme.ts standartlarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import { ItemRegistry, defaultItemRegistry } from '../simulation/ItemRegistry.ts';
import { SpritePoolCore, type PoolConfig } from './SpritePoolCore.ts';

export interface VisualItem {
  id: number;
  sprite: Phaser.GameObjects.Sprite;
  itemId: string | null;
  inUse: boolean;
}

export interface ItemSpritePoolConfig extends PoolConfig {
  /** Varsayılan doku anahtarı (doku bulunamazsa) */
  fallbackTextureKey?: string;
  /** Sabit eşya ölçeği (varsayılan: 1.0) */
  defaultScale?: number;
}

export class ItemSpritePool {
  readonly scene: Phaser.Scene;
  readonly registry: ItemRegistry;
  readonly parentContainer?: Phaser.GameObjects.Container;
  readonly fallbackTextureKey: string;
  readonly defaultScale: number;

  /** Saf nesne havuzu çekirdeği */
  private readonly pool: SpritePoolCore<VisualItem>;
  /** Havuzda oluşturulan tüm sprite nesneleri (destroy için saklanır) */
  private readonly allItems: VisualItem[] = [];

  constructor(
    scene: Phaser.Scene,
    registry: ItemRegistry = defaultItemRegistry,
    parentContainer?: Phaser.GameObjects.Container,
    config: ItemSpritePoolConfig = {},
  ) {
    this.scene = scene;
    this.registry = registry;
    this.parentContainer = parentContainer;
    this.fallbackTextureKey = config.fallbackTextureKey ?? 'pickup_gear';
    this.defaultScale = config.defaultScale ?? 1.0;

    // Saf havuz çekirdeğini başlat
    this.pool = new SpritePoolCore<VisualItem>(
      (index) => this.createSpriteItem(index),
      (item) => this.resetSpriteItem(item),
      config,
    );
  }

  /**
   * Havuz için yeni bir Phaser Sprite nesnesi üretir.
   */
  private createSpriteItem(index: number): VisualItem {
    // Başlangıç dokusu (varsa fallback, yoksa dokusuz sprite)
    const textureKey = this.scene.textures.exists(this.fallbackTextureKey)
      ? this.fallbackTextureKey
      : '__DEFAULT';

    const sprite = this.scene.add.sprite(0, 0, textureKey);
    sprite.setOrigin(0.5, 0.5);
    sprite.setVisible(false);
    sprite.setActive(false);
    sprite.setScale(this.defaultScale);

    if (this.parentContainer) {
      this.parentContainer.add(sprite);
    }

    const item: VisualItem = {
      id: index,
      sprite,
      itemId: null,
      inUse: false,
    };

    this.allItems.push(item);
    return item;
  }

  /**
   * Havuza iade edilen bir nesneyi sıfırlar.
   */
  private resetSpriteItem(item: VisualItem): void {
    item.inUse = false;
    item.itemId = null;
    item.sprite.setVisible(false);
    item.sprite.setActive(false);
    item.sprite.clearTint();
    item.sprite.setRotation(0);
  }

  // -------------------------------------------------------------
  // EŞYA OLUŞTURMA VE YÖNETİM
  // -------------------------------------------------------------

  /**
   * Havuzdan bir sprite alarak verilen itemId dokusu ve dünya koordinatlarında
   * sahneye yerleştirir.
   *
   * @param itemId Eşya ID'si (örn. 'iron_ore', 'simple_motor')
   * @param worldX Piksel dünya X koordinatı
   * @param worldY Piksel dünya Y koordinatı
   * @param angleRad Radyan cinsinden yön açısı (isteğe bağlı)
   * @param scale Ölçek (isteğe bağlı, varsayılan 1.0)
   * @returns Görsel eşya nesnesi veya havuz dolmuşsa null
   */
  spawn(
    itemId: string,
    worldX: number,
    worldY: number,
    angleRad = 0,
    scale = this.defaultScale,
  ): VisualItem | null {
    const pooled = this.pool.acquire();
    if (!pooled) {
      return null;
    }

    pooled.inUse = true;
    pooled.itemId = itemId;

    // Eşya tanımını sorgula
    const def = this.registry.get(itemId);

    // 1. Dokuyu belirle ve uygula
    if (def && this.scene.textures.exists(def.spriteKey)) {
      pooled.sprite.setTexture(def.spriteKey);
    } else if (this.scene.textures.exists(this.fallbackTextureKey)) {
      pooled.sprite.setTexture(this.fallbackTextureKey);
    }

    // 2. Piksel tonlamasını (tint) uygula
    if (def && def.colorTint !== undefined) {
      pooled.sprite.setTint(def.colorTint);
    } else {
      pooled.sprite.clearTint();
    }

    // 3. Tamsayı piksel koordinatları (roundPixels standartlarına tam uyum)
    pooled.sprite.setPosition(Math.round(worldX), Math.round(worldY));
    pooled.sprite.setRotation(angleRad);
    pooled.sprite.setScale(scale);

    // 4. Görünür ve aktif kıl
    pooled.sprite.setVisible(true);
    pooled.sprite.setActive(true);

    return pooled;
  }

  /**
   * Eşyanın dünya konumunu ve rotasyonunu günceller.
   */
  updatePosition(
    item: VisualItem,
    worldX: number,
    worldY: number,
    angleRad?: number,
  ): void {
    if (!item.inUse) return;

    item.sprite.setPosition(Math.round(worldX), Math.round(worldY));
    if (angleRad !== undefined) {
      item.sprite.setRotation(angleRad);
    }
  }

  /**
   * Eşyayı sahneden kaldırır ve havuza geri verir (Despawn).
   */
  despawn(item: VisualItem): boolean {
    return this.pool.release(item);
  }

  /**
   * Sahnedeki tüm aktif eşyaları topluca havuza geri toplar.
   */
  despawnAll(): void {
    this.pool.releaseAll();
  }

  /**
   * Şu an aktif olan tüm eşyaları gezer.
   */
  forEachActive(callback: (item: VisualItem, index: number) => void): void {
    this.pool.forEachActive(callback);
  }

  // -------------------------------------------------------------
  // METRİKLER
  // -------------------------------------------------------------

  get totalAllocated(): number {
    return this.pool.totalAllocated;
  }

  get activeCount(): number {
    return this.pool.activeCount;
  }

  get availableCount(): number {
    return this.pool.availableCount;
  }

  get peakActiveCount(): number {
    return this.pool.peakActiveCount;
  }

  get isExhausted(): boolean {
    return this.pool.isExhausted;
  }

  // -------------------------------------------------------------
  // TEMİZLİK (DESTROY)
  // -------------------------------------------------------------

  /**
   * Havuzdaki tüm Phaser sprite'larını ve kaynakları temizler.
   */
  destroy(): void {
    this.pool.clear();
    for (const item of this.allItems) {
      item.sprite.destroy();
    }
    this.allItems.length = 0;
  }
}
