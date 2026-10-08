/* ======================================================================
 * src/ads/MockAdProvider.ts — Sahte reklam sağlayıcısı (yalnızca yerleşim)
 *
 * CrazyGames SDK bağlanana kadar reklamın yerini tutar: oyunun üstünde,
 * gerçek reklam gibi tuvalin dışında duran bir "REKLAM ALANI" katmanı gösterir,
 * birkaç saniye sayar ve ödülü verir. Katman kapatılırsa reklam yarıda kesilmiş
 * sayılır ve ödül verilmez; böylece iki sonuç da denenebilir.
 * (docs/M9_PLAN.md §4.5, DEC-032)
 * ====================================================================== */

import { FONT_FAMILY, PALETTE } from '../ui/theme.ts';
import type { AdPlacementId, AdProvider, AdProviderHooks } from './AdService.ts';

/** Sahte reklamın süresi (saniye) */
export const MOCK_AD_SECONDS = 3;

const OVERLAY_ID = 'mock-ad-overlay';

const PLACEMENT_LABELS: Readonly<Record<AdPlacementId, string>> = {
  offline_double: 'Çevrimdışı kazanç ×2',
  flight_bonus: 'Uçuş primi ×3',
  income_boost: 'Gelir takviyesi',
  parts_cargo: 'Parça kargosu',
  plot_discount: 'Parsel indirimi',
};

export interface MockAdOptions {
  /** true ise reklam hiç gösterilemez ("reklam yüklenemedi" senaryosu) */
  alwaysFail?: boolean;
}

export class MockAdProvider implements AdProvider {
  private readonly options: MockAdOptions;

  constructor(options: MockAdOptions = {}) {
    this.options = options;
  }

  isAvailable(): boolean {
    return typeof document !== 'undefined';
  }

  showRewarded(placement: AdPlacementId, hooks: AdProviderHooks): Promise<boolean> {
    if (typeof document === 'undefined' || this.options.alwaysFail) {
      return Promise.resolve(false);
    }

    return new Promise<boolean>((resolve) => {
      document.getElementById(OVERLAY_ID)?.remove();

      const overlay = document.createElement('div');
      overlay.id = OVERLAY_ID;
      overlay.setAttribute('role', 'dialog');
      overlay.setAttribute('aria-label', 'Reklam alanı');
      Object.assign(overlay.style, {
        position: 'fixed',
        inset: '0',
        zIndex: '10000',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        boxSizing: 'border-box',
        background: PALETTE.bgDeepHex,
        fontFamily: FONT_FAMILY,
        color: PALETTE.textPrimary,
        textAlign: 'center',
      });

      const card = document.createElement('div');
      Object.assign(card.style, {
        width: 'min(420px, 100%)',
        padding: '24px 20px',
        boxSizing: 'border-box',
        background: PALETTE.cardBgHex,
        border: `2px solid ${PALETTE.borderLightHex}`,
      });

      const title = document.createElement('div');
      title.textContent = 'REKLAM ALANI';
      Object.assign(title.style, { fontSize: '22px', fontWeight: 'bold', color: PALETTE.resourceGoldHex });

      const note = document.createElement('div');
      note.textContent = `Deneme yerleşimi: ${PLACEMENT_LABELS[placement]}. Gerçek reklam CrazyGames SDK bağlanınca burada gösterilir.`;
      Object.assign(note.style, { marginTop: '10px', fontSize: '14px', lineHeight: '1.4', color: PALETTE.textMuted });

      const countdown = document.createElement('div');
      Object.assign(countdown.style, { marginTop: '18px', fontSize: '16px', fontWeight: 'bold' });

      const skip = document.createElement('button');
      skip.type = 'button';
      skip.textContent = 'Reklamı kapat (ödül verilmez)';
      Object.assign(skip.style, {
        marginTop: '18px',
        minHeight: '44px',
        padding: '10px 16px',
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: PALETTE.textPrimary,
        background: PALETTE.panelBgHex,
        border: `1px solid ${PALETTE.borderDarkHex}`,
        cursor: 'pointer',
      });

      card.append(title, note, countdown, skip);
      overlay.append(card);
      document.body.append(overlay);

      let remaining = MOCK_AD_SECONDS;
      const render = (): void => {
        countdown.textContent = `Ödül ${remaining} sn sonra verilecek`;
      };
      render();

      let settled = false;
      const finish = (completed: boolean): void => {
        if (settled) return;
        settled = true;
        window.clearInterval(timer);
        overlay.remove();
        resolve(completed);
      };

      const timer = window.setInterval(() => {
        remaining -= 1;
        if (remaining <= 0) {
          finish(true);
        } else {
          render();
        }
      }, 1000);
      skip.addEventListener('click', () => finish(false));

      hooks.onStarted();
    });
  }
}
