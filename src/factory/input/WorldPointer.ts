/* ======================================================================
 * src/factory/input/WorldPointer.ts — Dünya araçları için işaretçi yardımcıları
 *
 * İnşa ve söküm araçları sahne düzeyinde `pointerdown` dinler; bu olay
 * UI düğmelerine yapılan tıklamalarda da tetiklenir. Buradaki yardımcılar
 * bir basışın UI'a mı yoksa fabrika zeminine mi ait olduğunu ayırır.
 * ====================================================================== */

import Phaser from 'phaser';
import type { GridCoord } from '../types.ts';
import { GridCoordinates } from '../view/GridCoordinates.ts';

/**
 * Basışın altındaki nesnelerden biri UI katmanına mı ait?
 * UI nesneleri (veya üst konteynerleri) dünya kamerası tarafından yoksayılır.
 */
export function isPointerOverUi(
  currentlyOver: Phaser.GameObjects.GameObject[] | undefined,
  worldCamera: Phaser.Cameras.Scene2D.Camera,
): boolean {
  if (!currentlyOver) return false;

  for (const hit of currentlyOver) {
    let node: Phaser.GameObjects.GameObject | null = hit;
    while (node) {
      if ((node.cameraFilter & worldCamera.id) !== 0) return true;
      node = node.parentContainer;
    }
  }
  return false;
}

/** İşaretçi dünya kamerasının ekran görüş alanı içinde mi? */
export function isPointerInsideViewport(
  pointer: Phaser.Input.Pointer,
  worldCamera: Phaser.Cameras.Scene2D.Camera,
): boolean {
  return (
    pointer.x >= worldCamera.x &&
    pointer.x <= worldCamera.x + worldCamera.width &&
    pointer.y >= worldCamera.y &&
    pointer.y <= worldCamera.y + worldCamera.height
  );
}

/** İşaretçinin o an üzerinde durduğu ızgara hücresi */
export function pointerToGrid(
  pointer: Phaser.Input.Pointer,
  worldCamera: Phaser.Cameras.Scene2D.Camera,
  tileSize: number,
  originX: number,
  originY: number,
): GridCoord {
  const worldPoint = pointer.positionToCamera(worldCamera) as Phaser.Math.Vector2;
  return GridCoordinates.worldToGrid(worldPoint.x, worldPoint.y, tileSize, originX, originY);
}

/** Basış ile bırakış arasında bu kadar CSS pikselinden az oynayan işaretçi "dokunuş" sayılır */
const TAP_SLOP_CSS_PX = 8;

/** Basış bir dokunuş mu (yerinde bırakıldı), yoksa sürükleme mi (kaydırma, çizim)? */
export function isTap(pointer: Phaser.Input.Pointer): boolean {
  // Tuval cihaz çözünürlüğünde çizilir; eşik CSS pikselinden tuval pikseline çevrilir
  const canvasPxPerCssPx = pointer.manager.scaleManager.displayScale.x || 1;
  const moved = Phaser.Math.Distance.Between(pointer.downX, pointer.downY, pointer.upX, pointer.upY);
  return moved <= TAP_SLOP_CSS_PX * canvasPxPerCssPx;
}

/**
 * Dünya nesnesine "dokun-bırak" dinleyicisi bağlar. Basışta değil bırakışta tetiklenir;
 * böylece nesnenin üzerinde başlayan kaydırma veya iki parmak hareketi tıklama sayılmaz.
 */
export function bindWorldTap(
  target: Phaser.GameObjects.GameObject,
  onTap: (pointer: Phaser.Input.Pointer) => void,
  canStart?: () => boolean,
): void {
  let armed = false;
  target.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
    // Yalnızca birincil tuş/dokunuş; basış anında bir araç etkinse (canStart) o basış araca aittir
    armed = pointer.button === 0 && (canStart ? canStart() : true);
  });
  target.on('pointerout', () => {
    armed = false;
  });
  target.on('pointerup', (pointer: Phaser.Input.Pointer) => {
    if (!armed) return;
    armed = false;
    if (isTap(pointer)) onTap(pointer);
  });
}
