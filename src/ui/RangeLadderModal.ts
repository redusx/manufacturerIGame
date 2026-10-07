/* ======================================================================
 * RangeLadderModal.ts — Seferler penceresi
 *
 * 10 aşamadan sonraki genel hedefi gösterir: menzil merdiveninin bütün
 * basamakları, her birinin ödülü ve o menzil için önerilen roket sınıfı.
 * Sıradaki basamakta rekorun hedefe ne kadar yaklaştığı da görünür.
 * Hepsi RangeLadder ve hangardaki gerçek rekordan okunur.
 * ====================================================================== */

import Phaser from 'phaser';
import { RANGE_LADDER, RangeLadder, type RangeRung } from '../flight/RangeLadder.ts';
import { formatDistance } from '../utils/format.ts';
import { SEMANTIC, SPACE } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import type { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { UiChip, UiProgressBar, createCard, createFrame } from './system/UiWidgets.ts';

export interface RangeLadderState {
  /** Uçuş rekoru (metre) */
  bestDistance: number;
  /** Roket sınıfı: en düşük modül seviyesi */
  rocketClass: number;
  /** Fabrikanın kalıcı gelir çarpanı */
  revenueMultiplier: number;
  /** Hangar açılmış mı (alttaki düğme için) */
  hangarUnlocked: boolean;
}

export class RangeLadderModal extends UiModal {
  private readonly getState: () => RangeLadderState;
  private readonly onOpenHangar: () => void;
  private hangarButton: UiButton | null = null;
  private signature = '';
  /** Sıradaki basamağın kartının gövde içindeki konumu; açılınca oraya kaydırılır */
  private currentCardY = 0;

  constructor(layer: UiLayer, getState: () => RangeLadderState, onOpenHangar: () => void) {
    super(layer, { title: 'Seferler', maxWidth: 460, accent: SEMANTIC.rocket });
    this.getState = getState;
    this.onOpenHangar = onOpenHangar;
  }

  /** Açıkken çağrılır: rekor veya roket sınıfı değiştiyse listeyi yeniler */
  refresh(): void {
    if (!this.isOpen) return;
    if (this.computeSignature() !== this.signature) this.rebuild();
  }

  private computeSignature(): string {
    const state = this.getState();
    return `${Math.floor(state.bestDistance)}|${state.rocketClass}|${state.revenueMultiplier}|${state.hangarUnlocked}`;
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    this.signature = this.computeSignature();
    const scene = this.scene;
    const layer = this.layer;
    const state = this.getState();
    const next = RangeLadder.next(state.bestDistance);
    const pad = SPACE.md;
    const inner = width - pad * 2;
    let y = 0;

    // Özet: genel hedefin ne olduğu ve şu anki durum
    const intro = layer.text(
      0,
      y,
      'Roketini geliştir, bir öncekinden daha ileri git. Ulaştığın her menzil fabrikana kalıcı ödül verir.',
      'body',
      { color: SEMANTIC.textMuted, wrapWidth: width },
    );
    body.add(intro);
    y += intro.height + SPACE.sm;

    const chips: Array<[string, string, number]> = [
      ['icon_trophy', `Rekor ${formatDistance(state.bestDistance)}`, SEMANTIC.rocket],
      ['icon_rocket', `Roket sınıfı ${state.rocketClass}`, SEMANTIC.rocket],
      ['icon_coin', `Gelir ×${formatMultiplier(state.revenueMultiplier)}`, SEMANTIC.money],
    ];
    let chipX = 0;
    for (const [icon, label, color] of chips) {
      const chip = new UiChip(layer, 0, 0, label, color, { icon });
      if (chipX > 0 && chipX + chip.chipWidth > width) {
        chipX = 0;
        y += 26;
      }
      chip.setPosition(chipX, y);
      body.add(chip);
      chipX += chip.chipWidth + SPACE.xs + 2;
    }
    y += 22 + SPACE.md;

    this.currentCardY = y;
    for (const rung of RANGE_LADDER) {
      const isDone = state.bestDistance >= rung.targetMeters;
      const isCurrent = next?.id === rung.id;
      if (isCurrent) this.currentCardY = y;
      const cardHeight = this.buildRungCard(body, y, width, inner, rung, state, isDone, isCurrent);
      y += cardHeight + SPACE.sm;
    }

    return y - SPACE.sm;
  }

  private buildRungCard(
    body: Phaser.GameObjects.Container,
    y: number,
    width: number,
    inner: number,
    rung: RangeRung,
    state: RangeLadderState,
    isDone: boolean,
    isCurrent: boolean,
  ): number {
    const scene = this.scene;
    const layer = this.layer;
    const pad = SPACE.md;
    const card = scene.add.container(0, y);
    const rows: Phaser.GameObjects.GameObject[] = [];
    let cursor = pad - 2;

    // Durum: ikon + metin (yalnız renkle anlatılmaz)
    const statusIcon = isDone ? 'icon_check' : isCurrent ? 'icon_rocket' : 'icon_flag';
    const statusColor = isDone ? SEMANTIC.primaryHex : isCurrent ? SEMANTIC.rocketHex : SEMANTIC.textMuted;
    const statusLabel = isDone ? 'Tamamlandı' : isCurrent ? 'Sıradaki hedef' : 'İleride';
    const icon = scene.add.image(pad + 8, cursor + 9, statusIcon).setOrigin(0.5);
    if (!isDone && !isCurrent) icon.setTint(0x8c9bb3);
    rows.push(icon);
    rows.push(
      layer
        .text(pad + 22, cursor + 9, `SEFER ${rung.index} · ${statusLabel}`, 'captionBold', { color: statusColor })
        .setOrigin(0, 0.5),
    );
    rows.push(
      layer
        .text(width - pad, cursor + 9, formatDistance(rung.targetMeters), 'bodyBold', {
          color: isDone ? SEMANTIC.textMuted : SEMANTIC.rocketHex,
        })
        .setOrigin(1, 0.5),
    );
    cursor += 22;

    const name = layer.text(pad, cursor, rung.name, 'heading', {
      wrapWidth: inner,
      color: isDone || isCurrent ? SEMANTIC.textPrimary : SEMANTIC.textMuted,
    });
    rows.push(name);
    cursor += name.height + 4;

    if (isCurrent) {
      const remaining = Math.max(0, rung.targetMeters - Math.floor(state.bestDistance));
      const progressLabel = layer.text(
        pad,
        cursor,
        `Rekor ${formatDistance(state.bestDistance)} · kalan ${formatDistance(remaining)}`,
        'body',
        { wrapWidth: inner },
      );
      rows.push(progressLabel);
      cursor += progressLabel.height + 4;
      const bar = new UiProgressBar(scene, pad, cursor, inner, 8, 'gold');
      bar.setProgress(Phaser.Math.Clamp(state.bestDistance / rung.targetMeters, 0, 1));
      rows.push(bar);
      cursor += 14;
    }

    // Önerilen donanım: bu menzil hangi roket sınıfıyla ulaşılır
    if (!isDone) {
      const ready = state.rocketClass >= rung.expectedClass;
      const needed = `Önerilen roket: Sınıf ${rung.expectedClass} (bütün modüller Sv.${rung.expectedClass})`;
      const advice = ready
        ? `Önerilen roket: Sınıf ${rung.expectedClass} (hazır)`
        : isCurrent
          ? `${needed} · şu an Sınıf ${state.rocketClass}`
          : needed;
      const adviceText = layer.text(pad, cursor, advice, 'caption', {
        color: isCurrent && !ready ? SEMANTIC.warningHex : SEMANTIC.textMuted,
        wrapWidth: inner,
      });
      rows.push(adviceText);
      cursor += adviceText.height + 2;
    }

    const rewards = RangeLadder.describeRewards(rung);
    if (rewards.length > 0) {
      const rewardText = layer.text(pad, cursor, `Ödül: ${rewards.join(' · ')}`, 'caption', {
        color: isDone ? SEMANTIC.textMuted : SEMANTIC.moneyHex,
        wrapWidth: inner,
      });
      rows.push(rewardText);
      cursor += rewardText.height;
    }

    const cardHeight = cursor + pad - 2;
    card.add(createCard(scene, 0, 0, width, cardHeight));
    if (isCurrent) card.add(createFrame(scene, 0, 0, width, cardHeight, SEMANTIC.rocket));
    card.add(rows);
    body.add(card);
    return cardHeight;
  }

  protected buildFooter(footer: Phaser.GameObjects.Container, width: number): number {
    this.hangarButton = null;
    if (!this.getState().hangarUnlocked) return 0;
    const height = 48;
    this.hangarButton = new UiButton(this.layer, width / 2, height / 2, {
      width,
      height,
      variant: 'primary',
      label: 'HANGARA GİT',
      icon: 'icon_rocket',
      iconScale: 1.5,
      onClick: () => {
        this.close();
        this.onOpenHangar();
      },
    });
    footer.add(this.hangarButton);
    return height;
  }

  protected primaryButton(): UiButton | null {
    return this.hangarButton;
  }

  /** Açılınca sıradaki basamağı görünür alana kaydırır */
  protected onOpened(): void {
    this.scrollTo(Math.max(0, this.currentCardY - SPACE.sm));
  }
}

/** Gelir çarpanını kısa yazar: 2.25, 10.7 */
function formatMultiplier(value: number): string {
  return value >= 10 ? value.toFixed(1) : Number(value.toFixed(2)).toString();
}
