/* ======================================================================
 * src/effects/PixelParticleHelper.ts — Piksel Parçacık Fiziği ve Veri Modeli
 *
 * Yükseltme kıvılcımları, para toplama ışıltıları, kutlama konfetileri ve
 * yüzen metin animasyonlarının hareket ve sönümlenme matematiğini yönetir.
 * (docs/MASTER_PLAN.md TASK-122)
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur, %100 headless test edilebilir.
 * ====================================================================== */

import { PALETTE } from '../ui/theme.ts';

export interface ParticleParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  gravity: number;
  life: number;
  maxLife: number;
  color: number;
  scale: number;
  alpha: number;
}

export interface FloatingTextParticle {
  x: number;
  y: number;
  text: string;
  color: string;
  vy: number;
  life: number;
  maxLife: number;
}

export const CONFETTI_COLORS = [
  PALETTE.resourceGold,
  PALETTE.rocketCyan,
  PALETTE.successGreen,
  PALETTE.factoryAmber,
  PALETTE.warningOrange,
  0xffffff,
];

export class PixelParticleHelper {
  /**
   * Radyal parıltı/kıvılcım patlaması hesaplar (Makine yükseltme, eşya satışı).
   */
  static computeSparkleBurst(
    cx: number,
    cy: number,
    count = 12,
    color: number = PALETTE.resourceGold,
    minSpeed = 40,
    maxSpeed = 140,
    lifespanMs = 450,
  ): ParticleParticle[] {
    const particles: ParticleParticle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const speed = minSpeed + Math.random() * (maxSpeed - minSpeed);
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed - 20; // Hafif yukarı yönlü itme

      particles.push({
        x: cx,
        y: cy,
        vx,
        vy,
        gravity: 120, // Hafif yerçekimi
        life: lifespanMs,
        maxLife: lifespanMs,
        color,
        scale: 1.0 + Math.random() * 0.5,
        alpha: 1.0,
      });
    }

    return particles;
  }

  /**
   * Muzaffer konfeti yağmuru hesaplar (Kilometre taşı açılışı, rekor mesafeler).
   */
  static computeConfettiBurst(
    cx: number,
    cy: number,
    count = 24,
    colors = CONFETTI_COLORS,
    lifespanMs = 800,
  ): ParticleParticle[] {
    const particles: ParticleParticle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * Math.PI * 0.8; // Yukarı doğru fışkırma
      const speed = 100 + Math.random() * 180;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const color = colors[Math.floor(Math.random() * colors.length)];

      particles.push({
        x: cx,
        y: cy,
        vx,
        vy,
        gravity: 240, // Aşağı doğru süzülme
        life: lifespanMs + Math.random() * 200,
        maxLife: lifespanMs + 200,
        color,
        scale: 1.2 + Math.random() * 0.6,
        alpha: 1.0,
      });
    }

    return particles;
  }

  /**
   * Çarpışma / Engel patlaması hesaplar (Uçuş sahnesi darbesi).
   */
  static computeExplosionBurst(
    cx: number,
    cy: number,
    count = 16,
    lifespanMs = 350,
  ): ParticleParticle[] {
    const colors = [PALETTE.dangerRed, PALETTE.warningOrange, PALETTE.resourceGold, 0xffffff];
    const particles: ParticleParticle[] = [];

    for (let i = 0; i < count; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 60 + Math.random() * 160;
      const vx = Math.cos(angle) * speed;
      const vy = Math.sin(angle) * speed;
      const color = colors[Math.floor(Math.random() * colors.length)];

      particles.push({
        x: cx,
        y: cy,
        vx,
        vy,
        gravity: 60,
        life: lifespanMs,
        maxLife: lifespanMs,
        color,
        scale: 1.5,
        alpha: 1.0,
      });
    }

    return particles;
  }

  /**
   * Tek bir parçacığı geçen süreye göre adım adım günceller.
   * @returns Parçacık hâlâ canlıysa true, ömrü bittiyse false
   */
  static stepParticle(p: ParticleParticle, dtSec: number): boolean {
    p.life -= dtSec * 1000;
    if (p.life <= 0) {
      p.alpha = 0;
      return false;
    }

    p.x += p.vx * dtSec;
    p.y += p.vy * dtSec;
    p.vy += p.gravity * dtSec;

    // Lineer sönümlenme
    p.alpha = Math.max(0, p.life / p.maxLife);
    return true;
  }

  /**
   * Yüzen metin pozisyon ve opaklığını günceller.
   */
  static stepFloatingText(t: FloatingTextParticle, dtSec: number): { x: number; y: number; alpha: number; alive: boolean } {
    t.life -= dtSec * 1000;
    if (t.life <= 0) {
      return { x: t.x, y: t.y, alpha: 0, alive: false };
    }

    t.y += t.vy * dtSec;
    const progress = t.life / t.maxLife;
    const alpha = Math.min(1.0, progress * 1.5); // Son %30'luk sürede kaybolur

    return {
      x: t.x,
      y: t.y,
      alpha: Math.max(0, alpha),
      alive: true,
    };
  }
}
