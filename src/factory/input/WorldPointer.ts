/* ======================================================================
 * src/factory/input/WorldPointer.ts — Dünya araçları için işaretçi yardımcıları
 *
 * İnşa ve söküm araçları sahne düzeyinde `pointerdown` dinler; bu olay
 * UI düğmelerine yapılan tıklamalarda da tetiklenir. Buradaki yardımcılar
 * bir basışın UI'a mı yoksa fabrika zeminine mi ait olduğunu ayırır.
 * ====================================================================== */

import type Phaser from 'phaser';
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
