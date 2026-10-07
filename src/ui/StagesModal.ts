/* ======================================================================
 * StagesModal.ts — Aşamalar penceresi
 *
 * Hedef kartına dokununca açılır ve tüm ilerlemeyi tek listede gösterir:
 * tamamlanan aşamalar, sürmekte olan aşamanın koşulları (sayaçlarıyla) ve
 * sıradaki aşamaların ne isteyip ne kazandıracağı. Hepsi MilestoneManager'daki
 * gerçek durumdan okunur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { MilestoneManager, MilestoneProgress } from '../factory/progression/MilestoneManager.ts';
import { formatNumber } from '../utils/format.ts';
import { formatMilestoneReward } from './ObjectiveCard.ts';
import { SEMANTIC, SPACE, uiIcon } from './theme.ts';
import type { UiLayer } from './system/UiLayer.ts';
import { UiModal } from './system/UiModal.ts';
import { UiProgressBar, createCard, createFrame } from './system/UiWidgets.ts';

export class StagesModal extends UiModal {
  private readonly milestones: MilestoneManager;
  private readonly getProgress: () => MilestoneProgress | null;
  private signature = '';

  constructor(layer: UiLayer, milestones: MilestoneManager, getProgress: () => MilestoneProgress | null) {
    super(layer, { title: 'Aşamalar', maxWidth: 460, accent: SEMANTIC.money });
    this.milestones = milestones;
    this.getProgress = getProgress;
  }

  /** Açıkken çağrılır: sayaçlar değiştiyse listeyi yeniler */
  refresh(): void {
    if (!this.isOpen) return;
    if (this.computeSignature() !== this.signature) this.rebuild();
  }

  private computeSignature(): string {
    const progress = this.getProgress();
    const counters = progress ? progress.conditions.map((c) => Math.floor(c.current)).join(',') : 'done';
    return `${this.milestones.completedCount}|${counters}`;
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    this.signature = this.computeSignature();
    const scene = this.scene;
    const layer = this.layer;
    const progress = this.getProgress();
    const currentIndex = this.milestones.completedCount;
    const pad = SPACE.md;
    const inner = width - pad * 2;
    let y = 0;

    for (let index = 0; index < this.milestones.totalCount; index++) {
      const milestone = this.milestones.getMilestone(index);
      if (!milestone) continue;
      const isDone = index < currentIndex;
      const isCurrent = index === currentIndex;
      const card = scene.add.container(0, y);
      let cursor = pad - 2;

      // Durum: ikon + metin (yalnız renkle anlatılmaz)
      const statusIcon = isDone ? 'icon_check' : isCurrent ? 'icon_flag' : uiIcon('lock');
      const statusColor = isDone ? SEMANTIC.primaryHex : isCurrent ? SEMANTIC.moneyHex : SEMANTIC.textMuted;
      const statusLabel = isDone ? 'Tamamlandı' : isCurrent ? 'Sürüyor' : 'Kilitli';
      const icon = scene.add.image(pad + 8, cursor + 9, statusIcon).setOrigin(0.5);
      if (!isDone && !isCurrent) icon.setTint(0x8c9bb3);
      const stageLabel = layer.text(pad + 22, cursor + 9, `AŞAMA ${index + 1} · ${statusLabel}`, 'captionBold', {
        color: statusColor,
      }).setOrigin(0, 0.5);
      cursor += 22;

      const name = layer.text(pad, cursor, milestone.name, 'heading', {
        wrapWidth: inner,
        color: isDone || isCurrent ? SEMANTIC.textPrimary : SEMANTIC.textMuted,
      });
      cursor += name.height + 4;
      const rows: Phaser.GameObjects.GameObject[] = [icon, stageLabel, name];

      // Koşullar: süren aşamada sayaç ve çubukla, diğerlerinde yalnız metin
      if (!isDone) {
        milestone.conditions.forEach((condition, conditionIndex) => {
          const live = isCurrent ? progress?.conditions[conditionIndex] : undefined;
          const counter = live ? this.formatCounter(live.type, live.current, live.target) : '';
          const counterText = counter
            ? layer.text(width - pad, cursor, counter, 'captionBold', {
                color: live?.isMet ? SEMANTIC.primaryHex : SEMANTIC.moneyHex,
              }).setOrigin(1, 0)
            : null;
          const label = layer.text(pad, cursor, condition.description, 'body', {
            color: isCurrent ? SEMANTIC.textPrimary : SEMANTIC.textMuted,
            wrapWidth: inner - (counterText ? counterText.width + SPACE.sm : 0),
          });
          rows.push(label);
          if (counterText) rows.push(counterText);
          cursor += label.height + 4;

          if (live) {
            const bar = new UiProgressBar(scene, pad, cursor, inner, 8, live.isMet ? 'green' : 'gold');
            bar.setProgress(live.percentage);
            rows.push(bar);
            cursor += 14;
          }
        });
      }

      const reward = formatMilestoneReward(milestone.reward);
      if (reward) {
        const rewardText = layer.text(pad, cursor, `Ödül: ${reward}`, 'caption', {
          color: isDone ? SEMANTIC.textMuted : SEMANTIC.moneyHex,
          wrapWidth: inner,
        });
        rows.push(rewardText);
        cursor += rewardText.height;
      }

      const cardHeight = cursor + pad - 2;
      card.add(createCard(scene, 0, 0, width, cardHeight));
      if (isCurrent) card.add(createFrame(scene, 0, 0, width, cardHeight, SEMANTIC.money));
      card.add(rows);
      body.add(card);
      y += cardHeight + SPACE.sm;
    }

    return y - SPACE.sm;
  }

  private formatCounter(type: string, current: number, target: number): string {
    if (type === 'TOTAL_EARNED' || type === 'CURRENT_BALANCE') {
      return `$${formatNumber(Math.min(current, target))}/$${formatNumber(target)}`;
    }
    if (type === 'UNLOCK_PLOT') return current >= target ? 'Açıldı' : 'Kapalı';
    return `${Math.min(Math.floor(current), target)}/${target}`;
  }

  /** Açılınca süren aşamayı görünür alana kaydırır */
  protected onOpened(): void {
    const currentIndex = this.milestones.completedCount;
    // Tamamlanan kartlar kısadır; süren aşama yaklaşık bu kadar aşağıdadır
    this.scrollTo(Math.max(0, currentIndex * 84 - 40));
  }
}
