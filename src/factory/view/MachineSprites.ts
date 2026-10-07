/* ======================================================================
 * src/factory/view/MachineSprites.ts — Makine görselleri (tek kaynak)
 *
 * Katalog kartı, yerleştirme hayaleti, fabrika zemini ve makine penceresi
 * aynı dokuyu buradan alır; böylece makine her yerde aynı görünür.
 *
 * Dokular `tools/generate_machine_assets.py` ile üretilir: hücre başına 32
 * piksel, 4 karelik şerit (kare 0 bekleme, 1-3 çalışma). Makine döndürülünce
 * resim döndürülmez; kare olmayan makinelerin yatay ve dikey iki çizimi
 * vardır (`<anahtar>_rot`). Yönü giriş/çıkış okları gösterir.
 * ====================================================================== */

import type { MachineDefinition } from '../types.ts';

/** Dokuların çizildiği hücre boyutu (piksel) */
export const MACHINE_SPRITE_TILE = 32;

/** Çalışma animasyonunun kare sayısı (kare 0 hariç) ve hızı */
export const MACHINE_WORK_FRAMES = 3;
export const MACHINE_WORK_FPS = 6;

/** Giriş (yeşil) ve çıkış (turuncu) port okları; doku doğuya bakar */
export const PORT_ARROW_IN = 'port_arrow_in';
export const PORT_ARROW_OUT = 'port_arrow_out';

export interface MachineSpriteSheet {
  key: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
}

const sheetOf = (key: string, file: string, tilesW: number, tilesH: number): MachineSpriteSheet => ({
  key,
  path: `assets/machines/${file}.png`,
  frameWidth: tilesW * MACHINE_SPRITE_TILE,
  frameHeight: tilesH * MACHINE_SPRITE_TILE,
});

/** Ön yüklemede `load.spritesheet` ile yüklenecek makine dokuları */
export const MACHINE_SPRITE_SHEETS: readonly MachineSpriteSheet[] = [
  sheetOf('mach_crusher', 'crusher', 1, 1),
  sheetOf('mach_cutter', 'cutter', 1, 1),
  sheetOf('mach_press', 'press', 1, 2),
  sheetOf('mach_press_rot', 'press_rot', 2, 1),
  sheetOf('mach_smelter', 'smelter', 2, 1),
  sheetOf('mach_smelter_rot', 'smelter_rot', 1, 2),
  sheetOf('mach_assembler', 'assembler', 2, 2),
  sheetOf('mach_refinery', 'refinery', 2, 2),
];

/** Ön yüklemede `load.image` ile yüklenecek port okları */
export const PORT_ARROW_IMAGES: ReadonlyArray<{ key: string; path: string }> = [
  { key: PORT_ARROW_IN, path: 'assets/machines/port_in.png' },
  { key: PORT_ARROW_OUT, path: 'assets/machines/port_out.png' },
];

/**
 * Makinenin o yöndeki dokusu. 90°/270° dönmüş, kare olmayan makine
 * (ayak izi yer değiştirir) `_rot` çizimini kullanır.
 */
export function machineTextureKey(def: MachineDefinition, rotationDeg = 0): string {
  const swapped = rotationDeg === 90 || rotationDeg === 270;
  return swapped && def.width !== def.height ? `${def.spriteBaseKey}_rot` : def.spriteBaseKey;
}

/** Küçük resmin `box` kenarlı kareye sığdığı en büyük tamsayı ölçek (en az 1) */
export function machineThumbScale(frameWidth: number, frameHeight: number, box: number): number {
  return Math.max(1, Math.floor(box / Math.max(frameWidth, frameHeight)));
}
