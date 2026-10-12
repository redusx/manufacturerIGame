/* ======================================================================
 * LanguageModal.ts — Dil seçme penceresi
 *
 * Desteklenen her dili kendi adıyla listeler ("Türkçe", "日本語", "العربية"):
 * oyuncu etkin dili okuyamasa da kendi dilini bulur. Seçim sahneye bildirilir;
 * sahne seçimi saklar ve arayüzü yeni dille baştan kurar.
 * ====================================================================== */

import Phaser from 'phaser';
import { LOCALES, getLocale, t, type LocaleCode } from '../i18n/i18n.ts';
import { SEMANTIC, SPACE } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import type { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';

const ROW_HEIGHT = 44;
/** Bu genişliğin altında diller tek sütuna dizilir */
const TWO_COLUMN_MIN_WIDTH = 280;

export class LanguageModal extends UiModal {
  private readonly onSelect: (code: LocaleCode) => void;

  constructor(layer: UiLayer, onSelect: (code: LocaleCode) => void) {
    super(layer, { title: t('settings.languageTitle'), maxWidth: 400, depth: 310, accent: SEMANTIC.secondary });
    this.onSelect = onSelect;
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const columns = width >= TWO_COLUMN_MIN_WIDTH ? 2 : 1;
    const gap = SPACE.sm;
    const buttonWidth = (width - gap * (columns - 1)) / columns;
    const current = getLocale();

    LOCALES.forEach((locale, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const selected = locale.code === current;
      const button = new UiButton(
        this.layer,
        column * (buttonWidth + gap) + buttonWidth / 2,
        row * (ROW_HEIGHT + gap) + ROW_HEIGHT / 2,
        {
          width: buttonWidth,
          height: ROW_HEIGHT,
          variant: selected ? 'primary' : 'secondary',
          label: locale.nativeName,
          textVariant: 'buttonSmall',
          onClick: () => {
            this.close();
            if (!selected) this.onSelect(locale.code);
          },
        },
      );
      button.setSelected(selected);
      body.add(button);
    });
    return Math.ceil(LOCALES.length / columns) * (ROW_HEIGHT + gap) - gap;
  }
}
