/* ======================================================================
 * RocketIcon.ts — Oyuncunun roketinin küçük resmi
 *
 * Dört modülün o anki seviyelerindeki çizimlerini tek bir dokuda birleştirir.
 * "Uçuşu başlat" düğmesi gibi yerlerde genel bir roket simgesi yerine oyuncunun
 * kendi roketi görünür; modül yükseltildikçe doku yerinde yeniden çizilir.
 * ====================================================================== */

import Phaser from 'phaser';
import { MAX_ROCKET_LEVEL } from '../data/RocketData.ts';

export const ROCKET_ICON_KEY = 'rocket_icon_current';

const WIDTH = 34;
const HEIGHT = 20;
const CENTER_X = 16;
const CENTER_Y = 10;

export interface RocketIconLevels {
  hull: number;
  engine: number;
  wings: number;
  boost: number;
}

/**
 * Roket küçük resmini verilen seviyelerle (yeniden) çizer ve doku anahtarını döner.
 * Parçalar hangar önizlemesindeki sırayla üst üste gelir: motor, tank, kanat, gövde.
 */
export function refreshRocketIcon(scene: Phaser.Scene, levels: RocketIconLevels): string {
  const existing = scene.textures.exists(ROCKET_ICON_KEY) ? scene.textures.get(ROCKET_ICON_KEY) : null;
  const texture =
    existing instanceof Phaser.Textures.DynamicTexture
      ? existing
      : scene.textures.addDynamicTexture(ROCKET_ICON_KEY, WIDTH, HEIGHT);
  if (!texture) return 'icon_rocket';

  texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
  texture.clear();
  const part = (prefix: string, level: number, offsetX: number): void => {
    const key = `${prefix}${Math.min(MAX_ROCKET_LEVEL, Math.max(1, Math.floor(level)))}`;
    if (scene.textures.exists(key)) texture.stamp(key, undefined, CENTER_X + offsetX, CENTER_Y);
  };
  part('rocket_engine_', levels.engine, -7);
  part('rocket_tank_', levels.boost, -2);
  part('rocket_wings_', levels.wings, -3);
  part('rocket_hull_', levels.hull, 1);
  return ROCKET_ICON_KEY;
}
