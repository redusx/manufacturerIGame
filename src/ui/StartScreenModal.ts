/* ======================================================================
 * StartScreenModal.ts — Giriş ekranı
 *
 * Oyun açıldığında oyuncuyu karşılar: sanayi şehri manzarasının önünde patron,
 * oyunun ne olduğunu söyleyen tek cümle ve "Oyna" düğmesi. Sayfa her açıldığında
 * bir kez gösterilir; yalnızca düğmeyle kapanır.
 *
 * Kısa yatay ekranda (yatay tutulan telefon, tarayıcı çubukları açıkken) pencere
 * genişler: manzara solda, yazı sağda durur. Diğer düzenlerde manzara üstte, yazı
 * altındadır; yer daralırsa manzara kısalır, yazı her zaman görünür kalır.
 * ====================================================================== */

import Phaser from 'phaser';
import { SEMANTIC, SPACE } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import type { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { createInset } from './system/UiWidgets.ts';
import { t } from '../i18n/i18n.ts';

const MAX_WIDTH = 400;
/** Yan yana düzende pencerenin en fazla genişliği */
const WIDE_MAX_WIDTH = 560;
const BANNER_HEIGHT = 132;
const MIN_BANNER_HEIGHT = 72;
/** Yan yana düzende manzaranın pencere genişliğindeki payı */
const WIDE_BANNER_SHARE = 0.44;
const FOOTER_HEIGHT = 52;
const BOSS_SIZE = 32;

/* Manzara, şehir karosunun çelik fabrikasını gösterir (tools/generate_city_backdrop.py):
   bacalar patronun başının hemen sağında, holün tabanı manzaranın altında kalır. */
const CHIMNEY_TILE_X = 835;
const CHIMNEY_OFFSET_FROM_BOSS = 38;
const HALL_BASE_TILE_Y = 208;

/** Giriş ekranı bu sayfa açılışında gösterildi mi? (Kayıt sıfırlanınca yeniden gösterilmez) */
let shownThisSession = false;

export class StartScreenModal extends UiModal {
  private playButton: UiButton | null = null;
  private readonly onPlay: () => void;

  constructor(layer: UiLayer, onPlay: () => void) {
    super(layer, { title: 'Manufacturer', maxWidth: MAX_WIDTH, depth: 350, dismissible: false, accent: SEMANTIC.factory });
    this.onPlay = onPlay;
  }

  /** Bu oturumda henüz gösterilmediyse açar; açtıysa true döner */
  openOnce(): boolean {
    if (shownThisSession) return false;
    shownThisSession = true;
    this.open();
    return true;
  }

  /** Kısa yatay ekranda manzara ile yazı yan yana durur */
  private get isSideBySide(): boolean {
    return this.layer.metrics.mode === 'landscapeCompact';
  }

  protected maxContentWidth(): number {
    return this.isSideBySide ? WIDE_MAX_WIDTH : MAX_WIDTH;
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const layer = this.layer;
    const limit = this.bodyHeightLimit(FOOTER_HEIGHT);

    if (this.isSideBySide) {
      const bannerWidth = Math.round(width * WIDE_BANNER_SHARE);
      const bannerHeight = Phaser.Math.Clamp(limit, MIN_BANNER_HEIGHT, BANNER_HEIGHT);
      this.buildBanner(body, bannerWidth, bannerHeight);

      const textX = bannerWidth + SPACE.md;
      const message = layer.text(textX, 0, t('start.message'), 'bodyBold', {
        wrapWidth: width - textX,
        lineSpacing: 3,
      });
      // Yazı manzaranın yüksekliğinde dikeyde ortalanır
      message.setY(Math.max(0, Math.round((bannerHeight - message.height) / 2)));
      body.add(message);
      return Math.max(bannerHeight, message.height);
    }

    // Üstte manzara, altında yazı. Önce yazı ölçülür; manzara kalan yere sığacak kadar kısalır
    const message = layer
      .text(Math.round(width / 2), 0, t('start.message'), 'bodyBold', {
        align: 'center',
        wrapWidth: width - SPACE.sm * 2,
        lineSpacing: 3,
      })
      .setOrigin(0.5, 0);
    const bannerHeight = Phaser.Math.Clamp(
      limit - SPACE.md - message.height - SPACE.xs,
      MIN_BANNER_HEIGHT,
      BANNER_HEIGHT,
    );
    this.buildBanner(body, width, bannerHeight);
    message.setY(bannerHeight + SPACE.md);
    body.add(message);
    return bannerHeight + SPACE.md + message.height + SPACE.xs;
  }

  /** Manzara: fabrikanın çevresindeki sanayi şehri; önünde patron (sol üst köşesi 0,0) */
  private buildBanner(body: Phaser.GameObjects.Container, width: number, height: number): void {
    const scene = this.scene;
    body.add(createInset(scene, 0, 0, width, height));

    const centerX = Math.round(width / 2);
    if (scene.textures.exists('factory_backdrop')) {
      body.add(
        scene.add
          .tileSprite(2, 2, width - 4, height - 4, 'factory_backdrop')
          .setOrigin(0, 0)
          .setTilePosition(
            CHIMNEY_TILE_X - (centerX + CHIMNEY_OFFSET_FROM_BOSS),
            Math.max(0, HALL_BASE_TILE_Y - height),
          ),
      );
    }
    if (scene.textures.exists('boss')) {
      // Patron manzaraya sığacak en büyük tam katta çizilir
      const scale = Math.max(1, Math.min(3, Math.floor((height - 8) / BOSS_SIZE)));
      body.add(
        scene.add
          .image(centerX, height - 2, 'boss')
          .setOrigin(0.5, 1)
          .setScale(scale),
      );
    }
  }

  protected buildFooter(footer: Phaser.GameObjects.Container, width: number): number {
    this.playButton = new UiButton(this.layer, width / 2, FOOTER_HEIGHT / 2, {
      width: Math.min(width, 260),
      height: FOOTER_HEIGHT,
      variant: 'primary',
      label: t('start.play'),
      icon: 'icon_factory',
      iconScale: 1.5,
      onClick: () => {
        this.close();
        this.onPlay();
      },
    });
    footer.add(this.playButton);
    return FOOTER_HEIGHT;
  }

  protected primaryButton(): UiButton | null {
    return this.playButton;
  }
}
