/* ======================================================================
 * src/factory/input/ClickCollectMath.ts — Tıkla & Topla Matematik Çekirdeği
 *
 * Fabrika zeminine, hammadde giriş silolarına (INTAKE) ve konveyör bantlarındaki
 * eşyalara yapılan tıklamaların sonuçlarını, nakit/kaynak kazanımlarını,
 * combo serilerini, anti-spam hız limitini ve yüzen metin (floating text)
 * hareket parametrelerini hesaplayan saf TypeScript modülü.
 * Node 24 uyumludur; Phaser bağımlılığı yoktur, headless test edilebilir.
 * ====================================================================== */

import type { GridCoord } from '../types.ts';
import { GridMap } from '../simulation/GridMap.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { ItemRegistry, defaultItemRegistry } from '../simulation/ItemRegistry.ts';
import { GridCoordinates } from '../view/GridCoordinates.ts';
import { PALETTE } from '../../ui/theme.ts';

export type ClickType =
  | 'INTAKE'
  | 'CONVEYOR_ITEM'
  | 'FLOOR_CLICK'
  | 'MACHINE'
  | 'NONE';

export interface ClickCollectResult {
  type: ClickType;
  success: boolean;
  earnedMoney: number;
  itemId?: string;
  machineInstanceId?: string;
  spawnedOnBelt?: boolean;
  text: string;
  textColor: string;
  worldX: number;
  worldY: number;
  gridCoord: GridCoord;
  comboCount: number;
  comboBonus: number;
}

export interface ClickInputOptions {
  worldX: number;
  worldY: number;
  grid: GridMap;
  logistics: LogisticsNetwork;
  economy: FactoryEconomy;
  itemRegistry?: ItemRegistry;
  tileSize?: number;
  originX?: number;
  originY?: number;
  allowFloorClick?: boolean;
  currentTimeMs?: number;
}

export interface FloatingTextMotion {
  targetY: number;
  durationMs: number;
  initialAlpha: number;
  finalAlpha: number;
  initialScale: number;
  peakScale: number;
}

/**
 * Hızlı tıklama serilerini (combo) ve tıklama hızı sınırını (anti-spam) takip eden sınıf.
 */
export class ClickComboTracker {
  private _comboCount = 0;
  private lastClickTimeMs = 0;

  /** İki tıklama arası minimum bekleme süresi (ms) — 40ms = azami 25 tık/sn */
  readonly minIntervalMs: number;
  /** Serinin sıfırlanması için gereken hareketsizlik süresi (ms) */
  readonly resetWindowMs: number;

  constructor(minIntervalMs = 40, resetWindowMs = 900) {
    this.minIntervalMs = minIntervalMs;
    this.resetWindowMs = resetWindowMs;
  }

  get comboCount(): number {
    return this._comboCount;
  }

  /**
   * Yeni tıklamayı kaydeder; hız limitini denetler ve seri çarpanını hesaplar.
   */
  registerClick(nowMs: number): { allowed: boolean; comboCount: number; comboBonus: number } {
    if (this.lastClickTimeMs > 0 && nowMs - this.lastClickTimeMs < this.minIntervalMs) {
      return {
        allowed: false,
        comboCount: this._comboCount,
        comboBonus: this.computeBonus(this._comboCount),
      };
    }

    if (this.lastClickTimeMs > 0 && nowMs - this.lastClickTimeMs > this.resetWindowMs) {
      this._comboCount = 1;
    } else {
      this._comboCount += 1;
    }

    this.lastClickTimeMs = nowMs;

    return {
      allowed: true,
      comboCount: this._comboCount,
      comboBonus: this.computeBonus(this._comboCount),
    };
  }

  /**
   * Seri seviyesine göre bonus çarpanı hesaplar:
   * 1-9: 1.0x, 10-19: 1.1x, 20-29: 1.2x, 30+: 1.3x (tavan 1.5x)
   */
  computeBonus(combo: number): number {
    if (combo < 10) return 1.0;
    const tiers = Math.floor(combo / 10);
    return Math.min(1.5, Number((1.0 + tiers * 0.1).toFixed(1)));
  }

  reset(): void {
    this._comboCount = 0;
    this.lastClickTimeMs = 0;
  }
}

/**
 * Tıklama ve toplama eylemlerinin matematiksel mantığı.
 */
export class ClickCollectMath {
  /**
   * Tıklama konumundaki hücreyi inceler ve uygun toplama / üretim sonucunu üretir.
   */
  static handleClick(
    options: ClickInputOptions,
    comboTracker?: ClickComboTracker,
  ): ClickCollectResult {
    const {
      worldX,
      worldY,
      grid,
      logistics,
      economy,
      itemRegistry = defaultItemRegistry,
      tileSize = GridCoordinates.DEFAULT_TILE_SIZE,
      originX = 0,
      originY = 0,
      allowFloorClick = true,
      currentTimeMs = Date.now(),
    } = options;

    let comboCount = 1;
    let comboBonus = 1.0;

    if (comboTracker) {
      const trackerResult = comboTracker.registerClick(currentTimeMs);
      if (!trackerResult.allowed) {
        const gridCoord = GridCoordinates.worldToGrid(worldX, worldY, tileSize, originX, originY);
        return {
          type: 'NONE',
          success: false,
          earnedMoney: 0,
          text: '',
          textColor: PALETTE.textMuted,
          worldX,
          worldY,
          gridCoord,
          comboCount: trackerResult.comboCount,
          comboBonus: trackerResult.comboBonus,
        };
      }
      comboCount = trackerResult.comboCount;
      comboBonus = trackerResult.comboBonus;
    }

    const gridCoord = GridCoordinates.worldToGrid(worldX, worldY, tileSize, originX, originY);

    // Izgara sınırları dışı
    if (!grid.isInBounds(gridCoord.x, gridCoord.y)) {
      return {
        type: 'NONE',
        success: false,
        earnedMoney: 0,
        text: '',
        textColor: PALETTE.textMuted,
        worldX,
        worldY,
        gridCoord,
        comboCount,
        comboBonus,
      };
    }

    const cell = grid.getCell(gridCoord.x, gridCoord.y);
    const tileCenter = GridCoordinates.gridToWorldCenter(gridCoord, tileSize, originX, originY);

    // 1. HAMMADDE GİRİŞ SİLOSUNA TIKLAMA (INTAKE)
    if (cell && cell.type === 'INTAKE') {
      const itemId = cell.intakeData?.itemId ?? 'raw_ore';
      const spawnedOnBelt = logistics.forceIntakeSpawn(gridCoord.x, gridCoord.y);

      const baseCash = economy.performClick();
      const earnedMoney = Math.floor(baseCash * comboBonus);
      if (earnedMoney > baseCash) {
        economy.addMoney(earnedMoney - baseCash, 'CLICK');
      }

      const comboText = comboCount >= 10 ? ` x${comboCount}` : '';
      const text = spawnedOnBelt
        ? `+1 ⛏ (+$${earnedMoney}${comboText})`
        : `+$${earnedMoney} ⚙${comboText}`;

      return {
        type: 'INTAKE',
        success: true,
        earnedMoney,
        itemId,
        spawnedOnBelt,
        text,
        textColor: PALETTE.resourceGoldHex,
        worldX: tileCenter.x,
        worldY: tileCenter.y,
        gridCoord,
        comboCount,
        comboBonus,
      };
    }

    // 2. KONVEYÖR ÜZERİNDEKİ EŞYAYA TIKLAMA (CONVEYOR_ITEM)
    if (cell && cell.type === 'CONVEYOR') {
      const belt = logistics.getConveyor(gridCoord.x, gridCoord.y);
      if (belt && belt.itemCount > 0) {
        const itemSlot = belt.takeItem();
        if (itemSlot) {
          const itemDef = itemRegistry.get(itemSlot.itemId);
          const baseVal = itemDef?.baseValue ?? 1;
          const itemEarned = Math.max(1, Math.floor(baseVal * economy.revenueMultiplier * comboBonus));
          economy.addMoney(itemEarned, 'CLICK');

          const comboText = comboCount >= 10 ? ` x${comboCount}` : '';
          return {
            type: 'CONVEYOR_ITEM',
            success: true,
            earnedMoney: itemEarned,
            itemId: itemSlot.itemId,
            text: `+$${itemEarned} ⚙${comboText}`,
            textColor: PALETTE.successGreenHex,
            worldX: tileCenter.x,
            worldY: tileCenter.y,
            gridCoord,
            comboCount,
            comboBonus,
          };
        }
      }

      // Boş konveyöre tıklandıysa zemin tıkı gibi davranabilir
      if (allowFloorClick) {
        const baseCash = economy.performClick();
        const earnedMoney = Math.floor(baseCash * comboBonus);
        if (earnedMoney > baseCash) {
          economy.addMoney(earnedMoney - baseCash, 'CLICK');
        }
        const comboText = comboCount >= 10 ? ` x${comboCount}` : '';
        return {
          type: 'FLOOR_CLICK',
          success: true,
          earnedMoney,
          text: `+$${earnedMoney} ⚙${comboText}`,
          textColor: PALETTE.resourceGoldHex,
          worldX: tileCenter.x,
          worldY: tileCenter.y,
          gridCoord,
          comboCount,
          comboBonus,
        };
      }
    }

    // 3. MAKİNE TIKLAMASI (İnceleme / Seçim)
    if (cell && cell.type === 'MACHINE') {
      return {
        type: 'MACHINE',
        success: true,
        earnedMoney: 0,
        machineInstanceId: cell.machineInstanceId,
        text: '',
        textColor: PALETTE.textPrimary,
        worldX: tileCenter.x,
        worldY: tileCenter.y,
        gridCoord,
        comboCount,
        comboBonus,
      };
    }

    // 4. ZEMİN VEYA DİĞER HÜCRE TIKLAMASI (FLOOR_CLICK)
    if (allowFloorClick) {
      const baseCash = economy.performClick();
      const earnedMoney = Math.floor(baseCash * comboBonus);
      if (earnedMoney > baseCash) {
        economy.addMoney(earnedMoney - baseCash, 'CLICK');
      }

      const comboText = comboCount >= 10 ? ` x${comboCount}` : '';
      return {
        type: 'FLOOR_CLICK',
        success: true,
        earnedMoney,
        text: `+$${earnedMoney} ⚙${comboText}`,
        textColor: PALETTE.resourceGoldHex,
        worldX: tileCenter.x,
        worldY: tileCenter.y,
        gridCoord,
        comboCount,
        comboBonus,
      };
    }

    return {
      type: 'NONE',
      success: false,
      earnedMoney: 0,
      text: '',
      textColor: PALETTE.textMuted,
      worldX: tileCenter.x,
      worldY: tileCenter.y,
      gridCoord,
      comboCount,
      comboBonus,
    };
  }

  /**
   * Yüzen metin için yukarı süzülme ve şeffaflaşma animasyon parametrelerini döner.
   */
  static computeFloatingTextMotion(startY: number, distance = 28, durationMs = 550): FloatingTextMotion {
    return {
      targetY: startY - distance,
      durationMs,
      initialAlpha: 1.0,
      finalAlpha: 0.0,
      initialScale: 0.8,
      peakScale: 1.15,
    };
  }
}
