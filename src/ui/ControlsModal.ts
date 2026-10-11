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

const MOUSE_SECTION: ControlSection = {
  title: 'FARE',
  icon: uiIcon('mouse'),
  rows: [
    { keys: ['Sol tık'], text: 'Seç, yerleştir, makine penceresini aç' },
    { keys: ['Sol tık', 'sürükle'], text: 'Bant modunda hat çiz' },
    { keys: ['Sağ tuş', 'sürükle'], text: 'Haritayı kaydır' },
    { keys: ['Tekerlek'], text: 'Yakınlaştır / uzaklaştır (ince ayar: + ve − düğmeleri)' },
    { keys: ['Sağ tık'], text: 'Etkin aracı bırak' },
  ],
};

const KEYBOARD_SECTION: ControlSection = {
  title: 'KLAVYE',
  icon: uiIcon('textsize'),
  rows: [
    { keys: ['Boşluk', '1'], text: 'Elle üret' },
    { keys: ['2'], text: 'Bant' },
    { keys: ['3', 'B'], text: 'İnşa kataloğu' },
    { keys: ['4', 'X'], text: 'Sök' },
    { keys: ['5', 'H'], text: 'Hangar' },
    { keys: ['R'], text: 'Seçili öğeyi döndür' },
    { keys: ['W', 'A', 'S', 'D'], text: 'Haritayı kaydır (ok tuşları da olur)' },
    { keys: ['Esc'], text: 'Pencereyi kapat / aracı bırak' },
    { keys: ['Tab', 'Enter'], text: 'Düğmeler arasında gez ve seç' },
  ],
};

const TOUCH_SECTION: ControlSection = {
  title: 'DOKUNMATİK',
  icon: uiIcon('touch'),
  rows: [
    { keys: ['Dokun'], text: 'Seç, makine penceresini aç' },
    { keys: ['Sürükle'], text: 'Haritayı kaydır; bant modunda hat çiz' },
    { keys: ['İki parmak'], text: 'Yakınlaştır ve kaydır (araç açıkken de)' },
    { keys: ['Onayla'], text: 'Yerleştirme ve sökümde seçimi uygula' },
  ],
};

const FLIGHT_SECTION_DESKTOP: ControlSection = {
  title: 'UÇUŞ',
  icon: 'icon_rocket',
  rows: [
    { keys: ['Boşluk', 'Tık'], text: 'İmleç yeşil bölgedeyken ateşle' },
    { keys: ['Basılı tut'], text: 'Havada nitro: hızlan ve tırman' },
  ],
};

const FLIGHT_SECTION_TOUCH: ControlSection = {
  title: 'UÇUŞ',
  icon: 'icon_rocket',
  rows: [
    { keys: ['Dokun'], text: 'İmleç yeşil bölgedeyken ateşle' },
    { keys: ['Basılı tut'], text: 'Havada nitro: hızlan ve tırman' },
  ],
};

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
    super(layer, { title: 'Kontroller', maxWidth: 460, depth: 310, accent: SEMANTIC.secondary });
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
      ? [MOUSE_SECTION, KEYBOARD_SECTION, FLIGHT_SECTION_DESKTOP]
      : [TOUCH_SECTION, FLIGHT_SECTION_TOUCH];

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
    const text = this.layer.text(0, 0, label, 'captionBold').setOrigin(0.5);
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
      label: 'ANLADIM',
      onClick: () => this.close(),
    });
    footer.add(this.okButton);
    return height;
  }

  protected primaryButton(): UiButton | null {
    return this.okButton;
  }
}
