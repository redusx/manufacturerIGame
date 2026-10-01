/* ======================================================================
 * src/factory/view/MachineStatusHelper.ts — Makine Durum İkaz ve Gösterge Matematiği
 *
 * Fabrikadaki makinelerin anlık çalışma durumlarına (WAITING_INPUT, BLOCKED_OUTPUT,
 * PROCESSING, IDLE) göre uyarı rozetlerinin renklerini, simgelerini,
 * köşe konumlarını, yanıp sönme (pulse) alfa değerlerini ve çalışma kıvılcımı
 * yayılım sınırlarını hesaplayan saf matematik motoru.
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur; Node 24 native testleriyle
 * %100 test edilebilir.
 * ====================================================================== */

import type { MachineOperationalStatus } from '../types.ts';
import type { MachineVisualBounds } from './MachineVisualGeometry.ts';
import { PALETTE } from '../../ui/theme.ts';

export type BadgeType = 'NONE' | 'WARNING_INPUT' | 'BLOCKED_OUTPUT' | 'PROCESSING';

export interface StatusBadgeConfig {
  badgeType: BadgeType;
  colorHex: string;
  colorNum: number;
  iconKey: string;
  label: string;
  isWarning: boolean;
}

export interface ParticleSpawnPoint {
  x: number;
  y: number;
  vx: number;
  vy: number;
  lifespanMs: number;
  scale: number;
}

export class MachineStatusHelper {
  /**
   * Makine durumuna göre gösterilecek rozetin yapılandırmasını döner.
   */
  static getBadgeConfig(status: MachineOperationalStatus): StatusBadgeConfig {
    switch (status) {
      case 'WAITING_INPUT':
        return {
          badgeType: 'WARNING_INPUT',
          colorHex: PALETTE.warningOrangeHex,
          colorNum: PALETTE.warningOrange,
          iconKey: 'icon_lightning',
          label: 'GİRDİ YOK',
          isWarning: true,
        };

      case 'BLOCKED_OUTPUT':
        return {
          badgeType: 'BLOCKED_OUTPUT',
          colorHex: PALETTE.dangerRedHex,
          colorNum: PALETTE.dangerRed,
          iconKey: 'icon_close',
          label: 'TIKALI',
          isWarning: true,
        };

      case 'PROCESSING':
        return {
          badgeType: 'PROCESSING',
          colorHex: PALETTE.successGreenHex,
          colorNum: PALETTE.successGreen,
          iconKey: 'icon_check',
          label: 'ÜRETİYOR',
          isWarning: false,
        };

      case 'IDLE':
      default:
        return {
          badgeType: 'NONE',
          colorHex: '#8c9bb3',
          colorNum: 0x8c9bb3,
          iconKey: '',
          label: 'BEKLEMEDE',
          isWarning: false,
        };
    }
  }

  /**
   * Durum rozetinin makine merkezine göre sağ-üst köşedeki bağıl konumunu hesaplar.
   */
  static computeBadgeRelativePosition(
    pixelW: number,
    pixelH: number,
    badgeRadius = 7,
  ): { x: number; y: number } {
    return {
      x: Math.round(pixelW * 0.5 - badgeRadius - 2),
      y: Math.round(-pixelH * 0.5 + badgeRadius + 2),
    };
  }

  /**
   * İkaz rozetleri için yumuşak sinüs dalgalı yanıp-sönme (pulse) alfa değerini hesaplar.
   * Uyarı durumunda (WAITING_INPUT, BLOCKED_OUTPUT) 0.6 .. 1.0 arasında nabız gibi atar.
   */
  static computePulseAlpha(
    status: MachineOperationalStatus,
    timerSec: number,
  ): number {
    if (status !== 'WAITING_INPUT' && status !== 'BLOCKED_OUTPUT') {
      return 1.0;
    }

    // 6 rad/sn frekansında nabız
    const wave = Math.sin(timerSec * 6.0); // -1.0 .. 1.0
    const normalized = (wave + 1.0) * 0.5; // 0.0 .. 1.0
    return Math.round((0.55 + normalized * 0.45) * 100) / 100;
  }

  /**
   * Çalışan makineden saçılan mikro kıvılcım / partikül için rastgele
   * güvenli bir fırlama noktası ve hızı üretir.
   */
  static computeSparkSpawn(
    bounds: MachineVisualBounds,
    seed = Math.random(),
  ): ParticleSpawnPoint {
    // Makine çalışma alanının merkezinde hafif saçılma (-8px .. +8px)
    const angle = seed * Math.PI * 2;
    const spread = (seed * 17) % 8;

    const x = Math.round(bounds.centerX + Math.cos(angle) * spread);
    const y = Math.round(bounds.centerY + Math.sin(angle) * spread);

    // Yukarıya doğru hafifçe süzülen hız vektörü
    const vx = Math.round((Math.cos(angle) * 12) * 10) / 10;
    const vy = Math.round((-18 - (seed * 10)) * 10) / 10; // Daima yukarı

    return {
      x,
      y,
      vx,
      vy,
      lifespanMs: 400 + Math.round(seed * 200),
      scale: 0.8 + ((seed * 5) % 0.4),
    };
  }
}
