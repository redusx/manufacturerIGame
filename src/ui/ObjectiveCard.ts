/* ======================================================================
 * ObjectiveCard.ts — Sıradaki hedef kartı
 *
 * Oyuncuya şu an ne yapması gerektiğini ve karşılığında ne kazanacağını
 * söyler: aşama numarası, tamamlanmamış ilk koşul, sayaç, ilerleme çubuğu ve
 * ödül. Gösterilen her şey MilestoneManager'daki gerçek ilerlemeden gelir.
 *
 * İki görünümü vardır: dikey ekranda HUD'ın altında tam genişlikte kart,
 * yatay ekranda HUD çubuğunun içindeki boşluğa sığan tek satırlık şerit.
 * ====================================================================== */

import Phaser from 'phaser';
import type {
  MilestoneDefinition,
  MilestoneProgress,
  MilestoneReward,
} from '../factory/progression/MilestoneManager.ts';
import { defaultMachineRegistry } from '../factory/simulation/MachineRegistry.ts';
import { RANGE_LADDER, RangeLadder } from '../flight/RangeLadder.ts';
import { formatDistance, formatDuration, formatNumber } from '../utils/format';
import { SEMANTIC, SPACE } from './theme';
import type { UiLayer } from './system/UiLayer.ts';
import { UiProgressBar } from './system/UiWidgets.ts';

export interface ObjectiveView {
  /** "AŞAMA 3/10" */
  stageLabel: string;
  /** Yapılacak iş: "30 adet Demir Külçe ihraç et" */
  title: string;
  /** "12/30" veya "$120/$600"; sayılamayan koşulda boş */
  counter: string;
  /** 0..1 */
  progress: number;
  /** "Ödül: $250 · Hidrolik Pres" */
  reward: string;
  /** Para koşullarında tahmini kalan süre: "~2dk 10sn" */
  eta: string;
  allDone: boolean;
  /** Kartın ikonu; verilmezse aşama bayrağı (hepsi bittiyse kupa) */
  icon?: string;
}

/** Aşama ödülüyle açılan özelliklerin oyuncuya gösterilen adları */
const FEATURE_LABELS: Readonly<Record<string, string>> = {
  SPLITTER_MERGER: 'Ayırıcı ve Birleştirici',
  ROCKET_HANGAR: 'Roket Hangarı',
  INTAKE_IRON: 'Ek Demir Girişi',
  INTAKE_COPPER: 'Bakır Girişi',
  INTAKE_SILICA: 'Kum Girişi',
  INTAKE_POLYMER: 'Polimer Girişi',
};

/** Bir aşama ödülünü kısa, okunur bir listeye çevirir: "$250 · Hidrolik Pres Makinesi" */
export function formatMilestoneReward(reward: MilestoneReward): string {
  const parts: string[] = [];
  if (reward.money && reward.money > 0) {
    parts.push(`$${formatNumber(reward.money)}`);
  }
  for (const machineId of reward.unlockedMachines ?? []) {
    // Kırıcı oyunun başından beri açıktır; ödül olarak gösterilmez
    if (machineId === 'crusher') continue;
    parts.push(defaultMachineRegistry.get(machineId)?.name ?? machineId);
  }
  for (const featureId of reward.unlockedFeatures ?? []) {
    const label = FEATURE_LABELS[featureId];
    if (label) parts.push(label);
  }
  if (reward.revenueMultiplierBonus && reward.revenueMultiplierBonus > 0) {
    parts.push(`+%${Math.round(reward.revenueMultiplierBonus * 100)} gelir`);
  }
  return parts.join(' · ');
}

/**
 * Aşamalar bittikten sonraki genel hedef: menzil merdiveninin sıradaki basamağı
 * ("SEFER 6/14 · 7.00 km menziline ulaş").
 */
export function buildRangeObjectiveView(bestDistance: number): ObjectiveView {
  const total = RANGE_LADDER.length;
  const next = RangeLadder.next(bestDistance);
  if (!next) {
    return {
      stageLabel: `SEFER ${total}/${total}`,
      title: 'Bütün seferler tamamlandı!',
      counter: formatDistance(bestDistance),
      progress: 1,
      reward: '',
      eta: '',
      allDone: true,
    };
  }

  return {
    stageLabel: `SEFER ${next.index}/${total}`,
    title: `${formatDistance(next.targetMeters)} menziline ulaş: ${next.name}`,
    counter: `${formatDistance(bestDistance)}/${formatDistance(next.targetMeters)}`,
    progress: Phaser.Math.Clamp(bestDistance / next.targetMeters, 0, 1),
    reward: `Ödül: ${RangeLadder.describeRewards(next).join(' · ')}`,
    eta: '',
    allDone: false,
    icon: 'icon_rocket',
  };
}

/**
 * İlerleme durumundan kartın göstereceği metinleri üretir. Bütün aşamalar
 * tamamlandıysa (progress null) kart menzil hedefine geçer.
 */
export function buildObjectiveView(
  progress: MilestoneProgress | null,
  completedCount: number,
  totalCount: number,
  revenuePerSec: number,
  bestDistance = 0,
): ObjectiveView {
  if (!progress) {
    return buildRangeObjectiveView(bestDistance);
  }

  const pending = progress.conditions.find((c) => !c.isMet) ?? progress.conditions[0];
  const isMoney = pending.type === 'TOTAL_EARNED' || pending.type === 'CURRENT_BALANCE';

  let counter = '';
  if (isMoney) {
    counter = `$${formatNumber(pending.current)}/$${formatNumber(pending.target)}`;
  } else if (pending.type !== 'UNLOCK_PLOT') {
    counter = `${Math.floor(pending.current)}/${pending.target}`;
  }

  let eta = '';
  if (isMoney && revenuePerSec > 0 && pending.target > pending.current) {
    const etaSec = (pending.target - pending.current) / revenuePerSec;
    if (etaSec < 86400) eta = `~${formatDuration(etaSec)}`;
  }

  const reward = formatMilestoneReward(progress.milestone.reward);
  return {
    stageLabel: `AŞAMA ${completedCount + 1}/${totalCount}`,
    title: pending.description,
    counter,
    progress: Phaser.Math.Clamp(progress.overallPercentage, 0, 1),
    reward: reward ? `Ödül: ${reward}` : '',
    eta,
    allDone: false,
  };
}

/** Tamamlanan aşama için bildirim metni */
export function formatMilestoneCompleted(milestone: MilestoneDefinition): string {
  const reward = formatMilestoneReward(milestone.reward);
  return reward
    ? `Aşama tamamlandı: ${milestone.name}\nÖdül: ${reward}`
    : `Aşama tamamlandı: ${milestone.name}`;
}

export type ObjectiveCardVariant = 'card' | 'strip';

const CARD_HEIGHT = 74;
const STRIP_HEIGHT = 40;

export class ObjectiveCard {
  private readonly layer: UiLayer;
  private readonly root: Phaser.GameObjects.Container;

  private readonly bg: Phaser.GameObjects.NineSlice;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly stageText: Phaser.GameObjects.Text;
  private readonly titleText: Phaser.GameObjects.Text;
  private readonly counterText: Phaser.GameObjects.Text;
  private readonly rewardText: Phaser.GameObjects.Text;
  private readonly bar: UiProgressBar;

  private variant: ObjectiveCardVariant = 'card';
  private cardWidth = 300;
  private view: ObjectiveView | null = null;
  private shownProgress = 0;
  private lastSignature = '';
  private readonly zone: Phaser.GameObjects.Zone;

  /** @param onClick Karta dokununca (tüm aşamaların listesini açmak için) */
  constructor(layer: UiLayer, onClick?: () => void) {
    this.layer = layer;
    const scene = layer.scene;
    // Yatay düzende HUD çubuğunun içine oturduğu için onun üstünde çizilir
    this.root = layer.container(105);

    this.bg = scene.add.nineslice(0, 0, 'ui_card_bg', 0, 100, CARD_HEIGHT, 6, 6, 6, 6).setOrigin(0, 0);
    this.icon = scene.add.image(0, 0, 'icon_flag').setOrigin(0.5);
    this.stageText = layer.text(0, 0, '', 'captionBold', { color: SEMANTIC.moneyHex }).setOrigin(0, 0.5);
    this.titleText = layer.text(0, 0, '', 'bodyBold').setOrigin(0, 0.5);
    this.counterText = layer.text(0, 0, '', 'bodyBold', { color: SEMANTIC.moneyHex }).setOrigin(1, 0.5);
    this.rewardText = layer.text(0, 0, '', 'caption', { color: SEMANTIC.textMuted }).setOrigin(0, 0.5);
    this.bar = new UiProgressBar(scene, 0, 0, 100, 8, 'gold');

    this.root.add([this.bg, this.icon, this.stageText, this.titleText, this.counterText, this.rewardText, this.bar]);

    // Kartın tamamı basılabilir alandır; sürükleyip bırakmak tıklama sayılmaz
    this.zone = scene.add.zone(0, 0, 100, CARD_HEIGHT).setOrigin(0, 0);
    this.root.add(this.zone);
    if (onClick) {
      this.zone.setInteractive({ useHandCursor: true });
      this.zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_UP, (pointer: Phaser.Input.Pointer) => {
        if (layer.pointerDragDistance(pointer) <= 10) onClick();
      });
    }
  }

  /** Kartın yerleşimde kapladığı yükseklik */
  static heightFor(variant: ObjectiveCardVariant): number {
    return variant === 'card' ? CARD_HEIGHT : STRIP_HEIGHT;
  }

  /** Kartı verilen sol üst köşeye ve genişliğe yerleştirir */
  layout(x: number, y: number, width: number, variant: ObjectiveCardVariant): void {
    this.variant = variant;
    this.cardWidth = Math.max(120, width);
    this.root.setPosition(Math.round(x), Math.round(y));
    this.lastSignature = '';
    this.render();
  }

  setVisible(visible: boolean): void {
    this.root.setVisible(visible);
  }

  /** Kartın alt kenarı (arayüz birimi) */
  get bottom(): number {
    return this.root.y + ObjectiveCard.heightFor(this.variant);
  }

  update(view: ObjectiveView): void {
    this.view = view;
    // Çubuk hedefe doğru yumuşakça dolar
    this.shownProgress = Phaser.Math.Linear(this.shownProgress, view.progress, 0.2);
    if (Math.abs(this.shownProgress - view.progress) < 0.002) this.shownProgress = view.progress;
    this.bar.setProgress(this.shownProgress);

    const signature = `${view.stageLabel}|${view.title}|${view.counter}|${view.reward}|${view.eta}`;
    if (signature !== this.lastSignature) {
      this.render();
    }
  }

  /** Metinleri ve çubuğu kartın içine dizer; yalnız içerik veya boyut değişince çalışır */
  private render(): void {
    const view = this.view;
    if (!view) return;
    this.lastSignature = `${view.stageLabel}|${view.title}|${view.counter}|${view.reward}|${view.eta}`;

    const w = this.cardWidth;
    const pad = SPACE.sm + 2;
    const inner = w - pad * 2;
    const height = ObjectiveCard.heightFor(this.variant);
    this.bg.setSize(w, height);
    this.zone.setSize(w, Math.max(height, 44));
    this.icon.setTexture(view.icon ?? (view.allDone ? 'icon_trophy' : 'icon_flag'));

    if (this.variant === 'strip') {
      // Tek satır: [ikon] AŞAMA 3/10 · görev ............ sayaç, altında ince çubuk
      const rowY = 15;
      this.icon.setPosition(pad + 8, rowY);
      this.stageText.setPosition(pad + 20, rowY).setText(view.stageLabel.replace('AŞAMA ', ''));
      this.counterText.setPosition(w - pad, rowY).setText(view.counter);

      const titleX = this.stageText.x + this.stageText.width + SPACE.sm;
      const titleMax = w - pad - this.counterText.width - SPACE.sm - titleX;
      this.titleText.setPosition(titleX, rowY);
      this.fitTitle(view.title, Math.max(40, titleMax));

      this.rewardText.setVisible(false);
      this.bar.setPosition(pad, height - 13).setBarWidth(inner);
      return;
    }

    // Kart: aşama etiketi + sayaç / görev / çubuk / ödül
    const row1 = 14;
    this.icon.setPosition(pad + 8, row1);
    this.stageText.setPosition(pad + 20, row1).setText(view.stageLabel);
    const counterLabel = view.eta && view.counter ? `${view.counter}  ${view.eta}` : view.counter;
    this.counterText.setPosition(w - pad, row1).setText(counterLabel);

    this.titleText.setPosition(pad, 33);
    this.fitTitle(view.title, inner);

    this.bar.setPosition(pad, 45).setBarWidth(inner);

    this.rewardText.setVisible(view.reward.length > 0).setPosition(pad, 63);
    this.ellipsize(this.rewardText, view.reward, inner);
  }

  private fitTitle(title: string, maxWidth: number): void {
    this.ellipsize(this.titleText, title, maxWidth);
  }

  private ellipsize(text: Phaser.GameObjects.Text, content: string, maxWidth: number): void {
    text.setText(content);
    if (text.width <= maxWidth) return;
    let end = content.length;
    while (end > 1 && text.width > maxWidth) {
      end -= 1;
      text.setText(`${content.slice(0, end).trimEnd()}…`);
    }
  }

  /** Aşama tamamlanınca kısa bir vurgu */
  playGoalReachedEffect(): void {
    const tweens = this.layer.scene.tweens;
    tweens.killTweensOf(this.bg);
    this.bg.setTint(SEMANTIC.money);
    tweens.addCounter({
      from: 0,
      to: 1,
      duration: 500,
      onComplete: () => this.bg.clearTint(),
    });
  }
}
