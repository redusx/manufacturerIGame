/* ======================================================================
 * src/factory/view/ItemFlowAnimator.ts — Eşya Akışı Görselleştirici & Canlandırıcı
 *
 * Fabrika lojistik ağındaki (LogisticsNetwork) konveyör bantları, virajlar,
 * Splitter ve Merger üniteleri üzerinde hareket eden tüm eşyaları her karede
 * (60 FPS) sıfır bellek tahsisiyle (0 GC alloc) ItemSpritePool üzerinden
 * enterpolasyonlu dünya konumlarına ve teğet yönelimlerine senkronize eder.
 *
 * docs/ART_DIRECTION.md ve src/ui/theme.ts standartlarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import type { ConveyorRenderer } from './ConveyorRenderer.ts';
import { ItemSpritePool, type VisualItem } from './ItemSpritePool.ts';
import { ItemFlowTracker, type RenderableItem } from './ItemFlowTracker.ts';
import { GridCoordinates } from './GridCoordinates.ts';

export interface ItemFlowAnimatorConfig {
  tileSize?: number;
  originX?: number;
  originY?: number;
}

export class ItemFlowAnimator {
  readonly scene: Phaser.Scene;
  readonly network: LogisticsNetwork;
  readonly itemPool: ItemSpritePool;
  readonly conveyorRenderer?: ConveyorRenderer;

  readonly tileSize: number;
  private originX: number;
  private originY: number;

  /** Şu an aktif karede ekranda çizilen sprite referansları */
  private activeSprites: VisualItem[] = [];

  constructor(
    scene: Phaser.Scene,
    network: LogisticsNetwork,
    itemPool: ItemSpritePool,
    conveyorRenderer?: ConveyorRenderer,
    config: ItemFlowAnimatorConfig = {},
  ) {
    this.scene = scene;
    this.network = network;
    this.itemPool = itemPool;
    this.conveyorRenderer = conveyorRenderer;

    this.tileSize = config.tileSize ?? GridCoordinates.DEFAULT_TILE_SIZE;
    this.originX = config.originX ?? 0;
    this.originY = config.originY ?? 0;
  }

  // -------------------------------------------------------------
  // KONUM VE DÖNÜŞÜMLER
  // -------------------------------------------------------------

  setOrigin(x: number, y: number): void {
    this.originX = Math.round(x);
    this.originY = Math.round(y);
  }

  // -------------------------------------------------------------
  // KARE GÜNCELLEMESİ (FRAME UPDATE & SYNC)
  // -------------------------------------------------------------

  /**
   * Her render karesinde çağrılır.
   * Lojistik ağındaki tüm eşyaların konumlarını hesaplar ve sprite havuzundaki
   * görsel nesneleri bu konumlara sıfır-tahsisli (zero-allocation) olarak eşitler.
   *
   * @param dt Geçen kare süresi (saniye)
   */
  update(_dt?: number): void {
    // 1. Ağdaki tüm render edilebilir eşyaların dünya koordinatlarını topla
    const renderableItems: RenderableItem[] = ItemFlowTracker.collectRenderableItems(
      this.network,
      this.tileSize,
      this.originX,
      this.originY,
      this.conveyorRenderer
        ? (x, y) => this.conveyorRenderer!.getTurnInfo(x, y)
        : undefined,
    );

    const neededCount = renderableItems.length;

    // 2. Mevcut ve gereken sprite'ları eşle
    for (let i = 0; i < neededCount; i++) {
      const target = renderableItems[i];

      if (i < this.activeSprites.length) {
        // Var olan sprite'ı yeniden kullan
        const visual = this.activeSprites[i];

        // Eşya türü değişmişse doku ve tonlamayı güncelle
        if (visual.itemId !== target.itemId) {
          visual.itemId = target.itemId;
          const def = this.itemPool.registry.get(target.itemId);
          if (def && this.scene.textures.exists(def.spriteKey)) {
            visual.sprite.setTexture(def.spriteKey);
          } else if (this.scene.textures.exists(this.itemPool.fallbackTextureKey)) {
            visual.sprite.setTexture(this.itemPool.fallbackTextureKey);
          }

          if (def && def.colorTint !== undefined) {
            visual.sprite.setTint(def.colorTint);
          } else {
            visual.sprite.clearTint();
          }
        }

        // Konum ve rotasyon güncelle
        this.itemPool.updatePosition(
          visual,
          target.worldX,
          target.worldY,
          target.angleRad,
        );
      } else {
        // Yeni bir görsel eşya edin
        const visual = this.itemPool.spawn(
          target.itemId,
          target.worldX,
          target.worldY,
          target.angleRad,
        );
        if (visual) {
          this.activeSprites.push(visual);
        }
      }
    }

    // 3. İhtiyaç fazlası sprite'ları havuza geri iade et
    while (this.activeSprites.length > neededCount) {
      const excess = this.activeSprites.pop()!;
      this.itemPool.despawn(excess);
    }
  }

  // -------------------------------------------------------------
  // METRİKLER VE TEMİZLİK
  // -------------------------------------------------------------

  /** Ekranda şu an aktif çizilen eşya sayısı */
  get renderedItemCount(): number {
    return this.activeSprites.length;
  }

  /**
   * Ekrandaki tüm aktif eşya sprite'larını havuza geri toplar.
   */
  clear(): void {
    for (const visual of this.activeSprites) {
      this.itemPool.despawn(visual);
    }
    this.activeSprites.length = 0;
  }

  /**
   * Animatörü tamamen sonlandırır ve kaynakları temizler.
   */
  destroy(): void {
    this.clear();
  }
}
