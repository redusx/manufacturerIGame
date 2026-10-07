/* ======================================================================
 * src/effects/PixelParticleManager.ts — Phaser 3 Piksel Parçacık Yöneticisi
 *
 * Yükseltme kıvılcımları, konfetiler, patlamalar ve yüzen kazanç yazılarını
 * donanım hızlandırmalı tween'lerle çizen ve otomatik temizleyen efekt yöneticisi.
 * (docs/MASTER_PLAN.md TASK-122)
 * ====================================================================== */

import Phaser from 'phaser';
import { PALETTE, FONT_FAMILY } from '../ui/theme.ts';
import { UiLayer } from '../ui/system/UiLayer.ts';
import { PixelParticleHelper } from './PixelParticleHelper.ts';

/**
 * Efektin çizileceği uzay. 'world': fabrika/uçuş dünyası (dünya kamerası, dünya
 * koordinatı) · 'ui': arayüz (arayüz kamerası, arayüz birimi). Yanlış uzayda
 * çizilen efekt ekranın başka bir yerinde ikinci kez görünür.
 */
export type FxSpace = 'world' | 'ui';

function placeInSpace<T extends Phaser.GameObjects.GameObject>(scene: Phaser.Scene, object: T, space: FxSpace): T {
  if (space === 'ui') {
    UiLayer.get(scene)?.adopt(object);
  }
  return object;
}

export class PixelParticleManager {
  private static instance: PixelParticleManager | null = null;

  public static getInstance(): PixelParticleManager {
    if (!PixelParticleManager.instance) {
      PixelParticleManager.instance = new PixelParticleManager();
    }
    return PixelParticleManager.instance;
  }

  /**
   * Altın veya özel renkli kıvılcım patlaması saçar (Makine yükseltme, eşya satışı).
   */
  public emitSparkles(
    scene: Phaser.Scene,
    x: number,
    y: number,
    count = 14,
    color: number = PALETTE.resourceGold,
    space: FxSpace = 'world',
  ): void {
    const particles = PixelParticleHelper.computeSparkleBurst(x, y, count, color);

    for (const p of particles) {
      const size = Math.max(2, Math.round(3 * p.scale));
      const rect = placeInSpace(scene, scene.add.rectangle(p.x, p.y, size, size, p.color).setDepth(500), space);

      scene.tweens.add({
        targets: rect,
        x: p.x + p.vx * 0.45,
        y: p.y + p.vy * 0.45 + p.gravity * 0.2,
        alpha: 0,
        scale: 0.2,
        duration: p.life,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          rect.destroy();
        },
      });
    }
  }

  /**
   * Çok renkli konfeti fışkırması saçar (Kilometre taşı açılışı, yeni parsel alımı, rekor uçuş).
   */
  public emitConfetti(
    scene: Phaser.Scene,
    x: number,
    y: number,
    count = 28,
    space: FxSpace = 'world',
  ): void {
    const particles = PixelParticleHelper.computeConfettiBurst(x, y, count);

    for (const p of particles) {
      const size = Math.max(3, Math.round(4 * p.scale));
      const rect = placeInSpace(scene, scene.add.rectangle(p.x, p.y, size, size, p.color).setDepth(500), space);

      scene.tweens.add({
        targets: rect,
        x: p.x + p.vx * 0.8,
        y: p.y + p.vy * 0.8 + p.gravity * 0.4,
        angle: Math.random() * 360,
        alpha: 0,
        duration: p.life,
        ease: 'Sine.easeOut',
        onComplete: () => {
          rect.destroy();
        },
      });
    }
  }

  /**
   * Patlama kıvılcımları saçar (Engel çarpışması, uçuş sonu darbesi).
   */
  public emitExplosion(
    scene: Phaser.Scene,
    x: number,
    y: number,
    count = 16,
    space: FxSpace = 'world',
  ): void {
    const particles = PixelParticleHelper.computeExplosionBurst(x, y, count);

    for (const p of particles) {
      const rect = placeInSpace(scene, scene.add.rectangle(p.x, p.y, 4, 4, p.color).setDepth(500), space);

      scene.tweens.add({
        targets: rect,
        x: p.x + p.vx * 0.35,
        y: p.y + p.vy * 0.35,
        scale: 0.1,
        alpha: 0,
        duration: p.life,
        ease: 'Quad.easeOut',
        onComplete: () => {
          rect.destroy();
        },
      });
    }
  }

  /**
   * Tıklanan noktadan yukarı doğru süzülerek kaybolan piksel kazanç yazısı (+10, +$500 vb.)
   */
  public emitFloatingText(
    scene: Phaser.Scene,
    x: number,
    y: number,
    text: string,
    color = PALETTE.resourceGoldHex,
    space: FxSpace = 'world',
  ): void {
    const layer = UiLayer.get(scene);
    const txt = scene.add.text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontSize: space === 'ui' ? '14px' : '11px',
      color,
      fontStyle: 'bold',
      stroke: '#070913',
      strokeThickness: 3,
      // Dünyadaki yazı dünya kamerasının zoom'unda, arayüzdeki arayüz zoom'unda keskin çizilir
      resolution: space === 'ui' ? layer?.zoom : layer?.worldTextResolution,
    }).setOrigin(0.5).setDepth(510);
    placeInSpace(scene, txt, space);

    scene.tweens.add({
      targets: txt,
      y: y - 32,
      alpha: { from: 1, to: 0 },
      duration: 600,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        txt.destroy();
      },
    });
  }
}

export const fx = PixelParticleManager.getInstance();
