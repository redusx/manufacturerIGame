/* ======================================================================
 * src/effects/PixelParticleManager.ts — Phaser 3 Piksel Parçacık Yöneticisi
 *
 * Yükseltme kıvılcımları, konfetiler, patlamalar ve yüzen kazanç yazılarını
 * donanım hızlandırmalı tween'lerle çizen ve otomatik temizleyen efekt yöneticisi.
 * (docs/MASTER_PLAN.md TASK-122)
 * ====================================================================== */

import Phaser from 'phaser';
import { PALETTE, FONT_FAMILY } from '../ui/theme.ts';
import { PixelParticleHelper } from './PixelParticleHelper.ts';

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
  ): void {
    const particles = PixelParticleHelper.computeSparkleBurst(x, y, count, color);

    for (const p of particles) {
      const size = Math.max(2, Math.round(3 * p.scale));
      const rect = scene.add.rectangle(p.x, p.y, size, size, p.color).setDepth(300);

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
  ): void {
    const particles = PixelParticleHelper.computeConfettiBurst(x, y, count);

    for (const p of particles) {
      const size = Math.max(3, Math.round(4 * p.scale));
      const rect = scene.add.rectangle(p.x, p.y, size, size, p.color).setDepth(300);

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
  ): void {
    const particles = PixelParticleHelper.computeExplosionBurst(x, y, count);

    for (const p of particles) {
      const rect = scene.add.rectangle(p.x, p.y, 4, 4, p.color).setDepth(300);

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
  ): void {
    const txt = scene.add.text(x, y, text, {
      fontFamily: FONT_FAMILY,
      fontSize: '11px',
      color,
      fontStyle: 'bold',
      stroke: '#000000',
      strokeThickness: 2,
    }).setOrigin(0.5).setDepth(310);

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
