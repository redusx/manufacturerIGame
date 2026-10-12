/* ======================================================================
 * StartScreenModal.ts — Giriş ekranı
 *
 * Oyun açıldığında oyuncuyu karşılar: sanayi şehri manzarasının önünde patron,
 * oyunun ne olduğunu söyleyen tek cümle ve "Oyna" düğmesi. Sayfa her açıldığında
 * bir kez gösterilir; yalnızca düğmeyle kapanır.
 * ====================================================================== */

import Phaser from 'phaser';
import { SEMANTIC, SPACE } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import type { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { createInset } from './system/UiWidgets.ts';

export const START_MESSAGE =
  'Sen bir patronsun; fabrikanı geliştir, ekonomini büyüt, roketi derin uzaya fırlat ve lider tablosunda yerini al.';

const BANNER_HEIGHT = 132;
const BOSS_SCALE = 3;

/** Giriş ekranı bu sayfa açılışında gösterildi mi? (Kayıt sıfırlanınca yeniden gösterilmez) */
let shownThisSession = false;

export class StartScreenModal extends UiModal {
  private playButton: UiButton | null = null;
  private readonly onPlay: () => void;

  constructor(layer: UiLayer, onPlay: () => void) {
    super(layer, { title: 'Manufacturer', maxWidth: 400, depth: 350, dismissible: false, accent: SEMANTIC.factory });
    this.onPlay = onPlay;
  }

  /** Bu oturumda henüz gösterilmediyse açar; açtıysa true döner */
  openOnce(): boolean {
    if (shownThisSession) return false;
    shownThisSession = true;
    this.open();
    return true;
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const scene = this.scene;
    const layer = this.layer;

    // Manzara: fabrikanın çevresindeki sanayi şehri; önünde patron
    body.add(createInset(scene, 0, 0, width, BANNER_HEIGHT));
    if (scene.textures.exists('factory_backdrop')) {
      body.add(
        scene.add
          .tileSprite(2, 2, width - 4, BANNER_HEIGHT - 4, 'factory_backdrop')
          .setOrigin(0, 0)
          // Karonun sağ üstü: solda idari bina ve yol, sağda bacalı çelik fabrikası
          .setTilePosition(640, 74),
      );
    }
    if (scene.textures.exists('boss')) {
      body.add(
        scene.add
          .image(Math.round(width / 2), BANNER_HEIGHT - 2, 'boss')
          .setOrigin(0.5, 1)
          .setScale(BOSS_SCALE),
      );
    }

    const message = layer
      .text(Math.round(width / 2), BANNER_HEIGHT + SPACE.md, START_MESSAGE, 'bodyBold', {
        align: 'center',
        wrapWidth: width - SPACE.sm * 2,
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0);
    body.add(message);
    return BANNER_HEIGHT + SPACE.md + message.height + SPACE.xs;
  }

  protected buildFooter(footer: Phaser.GameObjects.Container, width: number): number {
    const height = 52;
    this.playButton = new UiButton(this.layer, width / 2, height / 2, {
      width: Math.min(width, 260),
      height,
      variant: 'primary',
      label: 'OYNA',
      icon: 'icon_factory',
      iconScale: 1.5,
      onClick: () => {
        this.close();
        this.onPlay();
      },
    });
    footer.add(this.playButton);
    return height;
  }

  protected primaryButton(): UiButton | null {
    return this.playButton;
  }
}
