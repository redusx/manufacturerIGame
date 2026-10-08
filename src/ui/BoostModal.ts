/* ======================================================================
 * BoostModal.ts — Takviye penceresi (süreli gelir çarpanı)
 *
 * HUD'daki para/gelir bölümünden açılır. Takviye etkinken fabrikanın ihracat
 * geliri iki katına çıkar. Süre iki yolla alınır: reklam izleyerek veya
 * nakitle; ikisi de aynı süreyi ekler. Reklam düğmesi yalnızca bu pencerenin
 * içindedir ve reklam sunulamıyorsa hiç çizilmez. (docs/M9_PLAN.md §4.5 R3)
 * ====================================================================== */

import Phaser from 'phaser';
import { formatAdCooldown } from '../ads/AdService.ts';
import { BOOST_GRANT_SECONDS, BOOST_MAX_SECONDS, BOOST_MULTIPLIER } from '../economy/IncomeBoost.ts';
import { formatNumber } from '../utils/format.ts';
import { SEMANTIC, SPACE, uiIcon } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import type { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { UiProgressBar, createInset } from './system/UiWidgets.ts';

export interface BoostModalState {
  /** Takviyenin kalan süresi (saniye); etkin değilse 0 */
  remainingSec: number;
  /** Yeni bir süre alımı sığar mı? */
  canAdd: boolean;
  /** Nakit bedeli ($) */
  cashPrice: number;
  canAffordCash: boolean;
  /** Reklam düğmesi gösterilsin mi? */
  adOffered: boolean;
  /** Reklamın bekleme süresinden kalan (saniye) */
  adCooldownSec: number;
}

export interface BoostModalConfig {
  getState: () => BoostModalState;
  onWatchAd: () => void;
  onBuyWithCash: () => void;
  onDenied: (message: string) => void;
}

const GRANT_MINUTES = Math.round(BOOST_GRANT_SECONDS / 60);
const MAX_MINUTES = Math.round(BOOST_MAX_SECONDS / 60);

export class BoostModal extends UiModal {
  private readonly callbacks: BoostModalConfig;
  private statusText: Phaser.GameObjects.Text | null = null;
  private statusBar: UiProgressBar | null = null;
  private adButton: UiButton | null = null;
  private cashButton: UiButton | null = null;
  private structureSignature = '';

  constructor(layer: UiLayer, config: BoostModalConfig) {
    super(layer, { title: 'Takviye', maxWidth: 400, accent: SEMANTIC.money });
    this.callbacks = config;
  }

  /** Düğmelerin varlığını ve etkinliğini belirleyen durum; değişince pencere yeniden kurulur */
  private computeStructureSignature(state: BoostModalState): string {
    return [
      state.remainingSec > 0,
      state.canAdd,
      state.canAffordCash,
      state.cashPrice,
      state.adOffered,
      state.adCooldownSec > 0,
    ].join('|');
  }

  /** Açıkken her karede çağrılır: kalan süreyi ve bekleme sayacını günceller */
  refresh(): void {
    if (!this.isOpen) return;
    const state = this.callbacks.getState();
    if (this.computeStructureSignature(state) !== this.structureSignature) {
      this.rebuild();
      return;
    }
    this.applyLiveValues(state);
  }

  private applyLiveValues(state: BoostModalState): void {
    this.statusText?.setText(
      state.remainingSec > 0 ? `×${BOOST_MULTIPLIER} · ${formatAdCooldown(state.remainingSec)}` : 'Etkin değil',
    );
    this.statusBar?.setProgress(Phaser.Math.Clamp(state.remainingSec / BOOST_MAX_SECONDS, 0, 1));
    if (this.adButton && state.adCooldownSec > 0) {
      this.adButton.setSublabel(`${formatAdCooldown(state.adCooldownSec)} sonra`);
    }
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const layer = this.layer;
    const scene = this.scene;
    const state = this.callbacks.getState();
    this.structureSignature = this.computeStructureSignature(state);
    this.adButton = null;
    this.cashButton = null;
    let y = 0;

    const intro = layer.text(
      0,
      y,
      `Takviye etkinken fabrikanın ihracat geliri ×${BOOST_MULTIPLIER} olur. Süre yalnızca oyun açıkken işler; en fazla ${MAX_MINUTES} dakika biriktirilir.`,
      'body',
      { color: SEMANTIC.textMuted, wrapWidth: width },
    );
    body.add(intro);
    y += intro.height + SPACE.md;

    // Durum: pencerenin en büyük öğesi
    const statusHeight = 78;
    body.add(createInset(scene, 0, y, width, statusHeight));
    body.add(
      layer
        .text(width / 2, y + 16, 'GELİR TAKVİYESİ', 'captionBold', { color: SEMANTIC.textMuted })
        .setOrigin(0.5),
    );
    this.statusText = layer
      .text(width / 2, y + 40, '', 'display', {
        color: state.remainingSec > 0 ? SEMANTIC.moneyHex : SEMANTIC.textMuted,
        stroke: true,
      })
      .setOrigin(0.5);
    body.add(this.statusText);
    this.statusBar = new UiProgressBar(scene, SPACE.md, y + statusHeight - 16, width - SPACE.md * 2, 8, 'gold');
    body.add(this.statusBar);
    y += statusHeight + SPACE.md;

    if (!state.canAdd) {
      const full = layer.text(0, y, `Takviye dolu. Kalan süre ${MAX_MINUTES - GRANT_MINUTES} dakikanın altına inince yenisini alabilirsin.`, 'caption', {
        color: SEMANTIC.warningHex,
        wrapWidth: width,
      });
      body.add(full);
      y += full.height + SPACE.sm;
    }

    const buttonHeight = 52;

    // Reklamla al: reklam sunulamıyorsa düğme hiç çizilmez
    if (state.adOffered) {
      const coolingDown = state.adCooldownSec > 0;
      this.adButton = new UiButton(layer, width / 2, y + buttonHeight / 2, {
        width,
        height: buttonHeight,
        variant: 'gold',
        icon: uiIcon('video'),
        label: `REKLAM İZLE: +${GRANT_MINUTES} DK`,
        sublabel: coolingDown ? `${formatAdCooldown(state.adCooldownSec)} sonra` : 'Ücretsiz',
        textVariant: 'buttonSmall',
        onClick: () => this.callbacks.onWatchAd(),
        onDisabledClick: () =>
          this.callbacks.onDenied(
            state.canAdd ? 'Reklam takviyesi biraz sonra yeniden kullanılabilir.' : 'Takviye dolu.',
          ),
      });
      this.adButton.setEnabled(state.canAdd && !coolingDown);
      body.add(this.adButton);
      y += buttonHeight + SPACE.sm;
    }

    // Nakitle al: reklamsız yol
    this.cashButton = new UiButton(layer, width / 2, y + buttonHeight / 2, {
      width,
      height: buttonHeight,
      variant: 'primary',
      label: `NAKİTLE AL: +${GRANT_MINUTES} DK`,
      sublabel: `$${formatNumber(state.cashPrice)}`,
      textVariant: 'buttonSmall',
      onClick: () => this.callbacks.onBuyWithCash(),
      onDisabledClick: () =>
        this.callbacks.onDenied(state.canAdd ? `Takviye için $${formatNumber(state.cashPrice)} gerekiyor.` : 'Takviye dolu.'),
    });
    this.cashButton.setEnabled(state.canAdd && state.canAffordCash);
    body.add(this.cashButton);
    y += buttonHeight;

    this.applyLiveValues(state);
    return y;
  }

  protected primaryButton(): UiButton | null {
    return this.cashButton?.enabled ? this.cashButton : null;
  }
}
