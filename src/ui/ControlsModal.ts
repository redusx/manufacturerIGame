/* ======================================================================
 * ControlsModal.ts — Kontrol şeması penceresi
 *
 * Oyunun nasıl oynandığını tek ekranda gösterir: masaüstünde fare ve klavye,
 * dokunmatik cihazda dokunma hareketleri. Masaüstünde ilk açılışta kendiliğinden
 * görünür; sonradan Ayarlar > Kontroller ile yeniden açılır.
 * ====================================================================== */

import Phaser from 'phaser';
import { SEMANTIC, SPACE, uiIcon } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import type { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { createDivider } from './system/UiWidgets.ts';
import { t } from '../i18n/i18n.ts';

/** Kontrol şemasının bir kez gösterildiğini saklayan anahtar */
export const CONTROLS_SEEN_STORAGE_KEY = 'manufacturer_controls_seen_v1';

interface ControlRow {
  /** Tuş kapakları; her biri ayrı kutuda çizilir */
  keys: string[];
  text: string;
}

interface ControlSection {
  title: string;
  icon: string;
  rows: ControlRow[];
}

/* Bölümler işlev olarak tanımlıdır: metinler pencere kurulurken etkin dilden okunur */

const mouseSection = (): ControlSection => ({
  title: t('controls.section.mouse'),
  icon: uiIcon('mouse'),
  rows: [
    { keys: [t('controls.key.leftClick')], text: t('controls.mouse.select') },
    { keys: [t('controls.key.leftClick'), t('controls.key.drag')], text: t('controls.mouse.belt') },
    { keys: [t('controls.key.rightButton'), t('controls.key.drag')], text: t('controls.mouse.pan') },
    { keys: [t('controls.key.wheel')], text: t('controls.mouse.zoom') },
    { keys: [t('controls.key.rightClick')], text: t('controls.mouse.cancel') },
  ],
});

const keyboardSection = (): ControlSection => ({
  title: t('controls.section.keyboard'),
  icon: uiIcon('textsize'),
  rows: [
    { keys: [t('controls.key.space'), '1'], text: t('controls.kb.produce') },
    { keys: ['2'], text: t('controls.kb.belt') },
    { keys: ['3', 'B'], text: t('controls.kb.build') },
    { keys: ['4', 'X'], text: t('controls.kb.remove') },
    { keys: ['5', 'H'], text: t('controls.kb.hangar') },
    { keys: ['R'], text: t('controls.kb.rotate') },
    { keys: ['W', 'A', 'S', 'D'], text: t('controls.kb.pan') },
    { keys: ['Esc'], text: t('controls.kb.escape') },
    { keys: ['Tab', 'Enter'], text: t('controls.kb.focus') },
  ],
});

const touchSection = (): ControlSection => ({
  title: t('controls.section.touch'),
  icon: uiIcon('touch'),
  rows: [
    { keys: [t('controls.key.tap')], text: t('controls.touch.select') },
    { keys: [t('controls.key.dragTouch')], text: t('controls.touch.pan') },
    { keys: [t('controls.key.twoFingers')], text: t('controls.touch.zoom') },
    { keys: [t('controls.key.confirm')], text: t('controls.touch.confirm') },
  ],
});

const flightSectionDesktop = (): ControlSection => ({
  title: t('controls.section.flight'),
  icon: 'icon_rocket',
  rows: [
    { keys: [t('controls.key.space'), t('controls.key.click')], text: t('controls.flight.fire') },
    { keys: [t('controls.key.hold')], text: t('controls.flight.nitro') },
  ],
});

const flightSectionTouch = (): ControlSection => ({
  title: t('controls.section.flight'),
  icon: 'icon_rocket',
  rows: [
    { keys: [t('controls.key.tap')], text: t('controls.flight.fire') },
    { keys: [t('controls.key.hold')], text: t('controls.flight.nitro') },
  ],
});

/** Birincil girdi fare mi? (Masaüstü: kontrol şeması ilk açılışta gösterilir) */
export function isDesktopInput(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

const KEY_HEIGHT = 22;
const ROW_GAP = 6;

export class ControlsModal extends UiModal {
  private okButton: UiButton | null = null;

  constructor(layer: UiLayer) {
    super(layer, { title: t('controls.title'), maxWidth: 460, depth: 310, accent: SEMANTIC.secondary });
  }

  /** Masaüstünde ve daha önce gösterilmediyse pencereyi açar; açtıysa true döner */
  openOnFirstVisit(): boolean {
    if (!isDesktopInput()) return false;
    try {
      if (localStorage.getItem(CONTROLS_SEEN_STORAGE_KEY) !== null) return false;
      localStorage.setItem(CONTROLS_SEEN_STORAGE_KEY, '1');
    } catch {
      // Depolama kapalıysa her açılışta göstermek yerine hiç gösterme
      return false;
    }
    this.open();
    return true;
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const desktop = isDesktopInput();
    const sections = desktop
      ? [mouseSection(), keyboardSection(), flightSectionDesktop()]
      : [touchSection(), flightSectionTouch()];

    let y = 0;
    for (const section of sections) {
      y = this.addSection(body, width, y, section);
    }
    return y - SPACE.sm;
  }

  private addSection(body: Phaser.GameObjects.Container, width: number, startY: number, section: ControlSection): number {
    const scene = this.scene;
    const layer = this.layer;
    let y = startY;

    body.add(scene.add.image(8, y + 8, section.icon).setOrigin(0.5));
    const title = layer.text(22, y + 8, section.title, 'captionBold', { color: SEMANTIC.moneyHex }).setOrigin(0, 0.5);
    body.add(title);
    body.add(createDivider(scene, title.x + title.width + SPACE.sm, y + 8, width - title.x - title.width - SPACE.sm));
    y += 22;

    // Tuş sütunu en geniş tuş grubuna göre hizalanır; dar ekranda açıklama alta iner
    const keyColumn = Math.min(Math.round(width * 0.46), 170);
    const stacked = width < 340;

    for (const row of section.rows) {
      let x = 0;
      let rowHeight = KEY_HEIGHT;
      for (const key of row.keys) {
        const cap = this.createKeyCap(key);
        if (x > 0 && x + cap.width > (stacked ? width : keyColumn)) {
          x = 0;
          y += KEY_HEIGHT + 3;
        }
        cap.container.setPosition(x, y);
        body.add(cap.container);
        x += cap.width + 4;
      }

      const textX = stacked ? 0 : keyColumn + SPACE.sm;
      const textY = stacked ? y + KEY_HEIGHT + 3 : y + 3;
      const text = layer.text(textX, textY, row.text, 'body', {
        color: SEMANTIC.textPrimary,
        wrapWidth: width - textX,
      });
      body.add(text);
      rowHeight = stacked ? KEY_HEIGHT + 3 + text.height : Math.max(KEY_HEIGHT, text.height + 3);
      y += rowHeight + ROW_GAP;
    }
    return y + SPACE.sm;
  }

  /** Klavye tuşu görünümünde küçük kutu */
  private createKeyCap(label: string): { container: Phaser.GameObjects.Container; width: number } {
    const text = this.layer.text(0, 0, label, 'captionBold', { color: SEMANTIC.textOnDark }).setOrigin(0.5);
    const width = Math.max(KEY_HEIGHT, Math.ceil(text.width) + 12);
    const container = this.scene.add.container(0, 0);
    container.add(
      this.scene.add
        .nineslice(0, 0, 'ui2_btn_secondary_normal', 0, width, KEY_HEIGHT, 4, 4, 4, 6)
        .setOrigin(0, 0),
    );
    text.setPosition(width / 2, KEY_HEIGHT / 2 - 1);
    container.add(text);
    return { container, width };
  }

  protected buildFooter(footer: Phaser.GameObjects.Container, width: number): number {
    const height = 44;
    this.okButton = new UiButton(this.layer, width / 2, height / 2, {
      width: Math.min(width, 240),
      height,
      variant: 'primary',
      label: t('controls.gotIt'),
      onClick: () => this.close(),
    });
    footer.add(this.okButton);
    return height;
  }

  protected primaryButton(): UiButton | null {
    return this.okButton;
  }
}
