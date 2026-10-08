/* ======================================================================
 * src/ui/system/UiConfirmDialog.ts — Onay penceresi
 *
 * Geri alınamayan eylemlerden önce sorulan kısa soru. Güvenli seçenek
 * ("Vazgeç") ikincil, tehlikeli seçenek kırmızı düğmedir; Enter hiçbir
 * zaman tehlikeli eylemi tetiklemez.
 * ====================================================================== */

import Phaser from 'phaser';
import { SEMANTIC, SPACE } from '../theme.ts';
import { UiButton } from './UiButton.ts';
import type { UiLayer } from './UiLayer.ts';
import { UiModal } from './UiModal.ts';

export interface UiConfirmRequest {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  /** Onay eylemi geri alınamaz/tehlikeli mi? */
  danger?: boolean;
  onConfirm: () => void;
  /** İki düğmenin üstünde, tam genişlikte isteğe bağlı üçüncü eylem (ör. reklamla indirim) */
  extraAction?: {
    label: string;
    sublabel?: string;
    icon?: string;
    /** Pencere kapandıktan sonra çağrılır */
    onClick: () => void;
  };
}

export class UiConfirmDialog extends UiModal {
  private request: UiConfirmRequest | null = null;
  private cancelButton: UiButton | null = null;
  private confirmButton: UiButton | null = null;

  constructor(layer: UiLayer) {
    super(layer, { title: '', maxWidth: 340, depth: 320, accent: SEMANTIC.danger });
  }

  ask(request: UiConfirmRequest): void {
    this.request = request;
    this.setTitle(request.title);
    this.setAccent(request.danger ? SEMANTIC.danger : SEMANTIC.secondary);
    this.open();
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const message = this.layer.text(0, SPACE.xs, this.request?.message ?? '', 'body', { wrapWidth: width });
    body.add(message);
    return message.height + SPACE.sm;
  }

  protected buildFooter(footer: Phaser.GameObjects.Container, width: number): number {
    const request = this.request;
    if (!request) return 0;

    const gap = SPACE.sm;
    const buttonWidth = (width - gap) / 2;
    const height = 44;
    let top = 0;

    const extra = request.extraAction;
    if (extra) {
      const extraHeight = extra.sublabel ? 48 : 44;
      footer.add(
        new UiButton(this.layer, width / 2, extraHeight / 2, {
          width,
          height: extraHeight,
          variant: 'gold',
          label: extra.label,
          sublabel: extra.sublabel,
          icon: extra.icon,
          textVariant: 'buttonSmall',
          onClick: () => {
            this.close();
            extra.onClick();
          },
        }),
      );
      top = extraHeight + gap;
    }

    this.cancelButton = new UiButton(this.layer, buttonWidth / 2, top + height / 2, {
      width: buttonWidth,
      height,
      variant: 'secondary',
      label: request.cancelLabel ?? 'VAZGEÇ',
      onClick: () => this.close(),
    });
    this.confirmButton = new UiButton(this.layer, buttonWidth + gap + buttonWidth / 2, top + height / 2, {
      width: buttonWidth,
      height,
      variant: request.danger ? 'danger' : 'primary',
      label: request.confirmLabel,
      onClick: () => {
        const action = request.onConfirm;
        this.close();
        action();
      },
    });
    footer.add([this.cancelButton, this.confirmButton]);
    return top + height;
  }

  /** Tehlikeli onayda Enter güvenli seçeneği (Vazgeç) tetikler */
  protected primaryButton(): UiButton | null {
    return this.request?.danger ? this.cancelButton : this.confirmButton;
  }
}
