/* ======================================================================
 * TutorialCoach.ts — Öğretici baloncuğu ve vurgu çerçevesi
 *
 * Öğreticinin geçerli adımını küçük bir bilgi kutusunda gösterir ve oyuncunun
 * basması gereken öğeyi nabız gibi atan altın bir çerçeveyle işaret eder.
 * Kutu fabrikanın altında, araç çubuğunun hemen üstünde durur; pencere açıkken
 * gizlenir (pencerenin içeriğini örtmesin). Hangi adımın gösterileceğine
 * `TutorialGuide` karar verir.
 * ====================================================================== */

import Phaser from 'phaser';
import type { TutorialStepView } from '../tutorial/TutorialGuide.ts';
import { SEMANTIC, SPACE, uiIcon } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import type { UiLayer } from './system/UiLayer.ts';

export interface TutorialCoachCallbacks {
  /** Bilgi adımı "Tamam" ile kapatıldı */
  onConfirm: (stepId: string) => void;
  /** Oyuncu öğreticiyi kapatmak istiyor */
  onSkip: () => void;
}

export interface CoachRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const PADDING = SPACE.sm;
const MAX_WIDTH = 360;
/** Başlık satırındaki düğmelerin (Tamam, Atla) yüksekliği */
const BUTTON_HEIGHT = 22;
const HIGHLIGHT_MARGIN = 4;

export class TutorialCoach {
  private readonly layer: UiLayer;
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.NineSlice;
  private readonly frame: Phaser.GameObjects.NineSlice;
  private readonly blocker: Phaser.GameObjects.Zone;
  private readonly icon: Phaser.GameObjects.Image;
  private readonly stepText: Phaser.GameObjects.Text;
  private readonly bodyText: Phaser.GameObjects.Text;
  private readonly confirmButton: UiButton;
  private readonly skipButton: UiButton;
  private readonly highlight: Phaser.GameObjects.NineSlice;
  private readonly highlightTween: Phaser.Tweens.Tween;

  private step: TutorialStepView | null = null;
  private shownSignature = '';
  private panelWidth = 300;
  private panelHeight = 80;
  private anchorX = 0;
  private anchorBottom = 0;
  private maxWidth = MAX_WIDTH;

  constructor(layer: UiLayer, callbacks: TutorialCoachCallbacks) {
    this.layer = layer;
    const scene = layer.scene;

    // Vurgu çerçevesi HUD ve araç çubuğunun üstünde, pencerelerin altındadır
    this.highlight = layer.adopt(
      scene.add
        .nineslice(0, 0, 'ui2_frame', 0, 40, 40, 4, 4, 4, 4)
        .setOrigin(0, 0)
        .setTint(SEMANTIC.money)
        .setDepth(150)
        .setVisible(false),
    );
    this.highlightTween = scene.tweens.add({
      targets: this.highlight,
      alpha: 0.35,
      duration: 520,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    this.root = layer.container(152).setVisible(false);
    this.bg = scene.add.nineslice(0, 0, 'ui_toast_bg', 0, 100, 80, 6, 6, 6, 6).setOrigin(0, 0);
    this.frame = scene.add
      .nineslice(0, 0, 'ui2_frame_thin', 0, 100, 80, 4, 4, 4, 4)
      .setOrigin(0, 0)
      .setTint(SEMANTIC.money);
    // Kutuya yapılan basış fabrikaya geçmesin
    this.blocker = scene.add.zone(0, 0, 100, 80).setOrigin(0, 0).setInteractive();
    this.icon = scene.add.image(PADDING + 8, PADDING + 7, uiIcon('info')).setOrigin(0.5).setTint(SEMANTIC.money);
    this.stepText = layer.text(PADDING + 20, PADDING, '', 'captionBold', { color: SEMANTIC.moneyHex });
    this.bodyText = layer.text(PADDING, PADDING + 22, '', 'body', { lineSpacing: 2 });

    this.confirmButton = new UiButton(layer, 0, 0, {
      width: 72,
      height: BUTTON_HEIGHT,
      variant: 'primary',
      label: 'TAMAM',
      textVariant: 'buttonSmall',
      onClick: () => {
        if (this.step) callbacks.onConfirm(this.step.id);
      },
    });
    this.skipButton = new UiButton(layer, 0, 0, {
      width: 56,
      height: BUTTON_HEIGHT,
      variant: 'secondary',
      label: 'ATLA',
      textVariant: 'buttonSmall',
      onClick: callbacks.onSkip,
    });

    this.root.add([
      this.bg,
      this.frame,
      this.blocker,
      this.icon,
      this.stepText,
      this.bodyText,
      this.confirmButton,
      this.skipButton,
    ]);

    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.highlightTween.stop());
  }

  get visible(): boolean {
    return this.root.visible;
  }

  /** Kutunun yüksekliği (arayüz birimi); görünmüyorsa 0 */
  get height(): number {
    return this.root.visible ? this.panelHeight : 0;
  }

  /**
   * Kutunun yerini belirler: yatayda `centerX` çevresinde ortalanır, alt kenarı
   * `bottom` satırına oturur ve `maxWidth`'ten geniş olmaz.
   */
  layout(centerX: number, bottom: number, maxWidth: number): void {
    this.anchorX = centerX;
    this.anchorBottom = bottom;
    this.maxWidth = Math.max(200, Math.min(MAX_WIDTH, maxWidth));
    this.shownSignature = '';
    this.render();
  }

  /** Geçerli adımı gösterir; null verilirse kutu ve vurgu gizlenir */
  show(step: TutorialStepView | null): void {
    this.step = step;
    this.render();
  }

  /** Vurgulanacak öğenin ekran dikdörtgeni (arayüz birimi); yoksa null */
  setHighlight(rect: CoachRect | null): void {
    if (!rect || !this.root.visible) {
      this.highlight.setVisible(false);
      return;
    }
    this.highlight
      .setVisible(true)
      .setPosition(Math.round(rect.x - HIGHLIGHT_MARGIN), Math.round(rect.y - HIGHLIGHT_MARGIN))
      .setSize(Math.round(rect.width + HIGHLIGHT_MARGIN * 2), Math.round(rect.height + HIGHLIGHT_MARGIN * 2));
  }

  private render(): void {
    const step = this.step;
    if (!step) {
      this.root.setVisible(false);
      this.highlight.setVisible(false);
      this.shownSignature = '';
      return;
    }
    this.root.setVisible(true);

    // Metin her karede yeniden üretilmesin: yalnız içerik veya genişlik değişince
    const signature = `${step.id}|${step.text}|${step.needsConfirm}|${this.maxWidth}`;
    if (signature !== this.shownSignature) {
      this.shownSignature = signature;
      const width = this.maxWidth;
      this.stepText.setText(`ÖĞRETİCİ ${step.index}/${step.total}`);
      this.bodyText.setWordWrapWidth(width - PADDING * 2, true).setText(step.text);

      this.panelWidth = width;
      this.panelHeight = Math.ceil(this.bodyText.y + this.bodyText.height + PADDING);

      this.bg.setSize(width, this.panelHeight);
      this.frame.setSize(width, this.panelHeight);
      this.blocker.setSize(width, this.panelHeight);
      // Düğmeler başlık satırında, sağda: kutu yalnız metin kadar yer kaplar
      const buttonY = PADDING + 7;
      this.skipButton.setPosition(width - PADDING - 28, buttonY);
      this.confirmButton.setVisible(step.needsConfirm).setPosition(width - PADDING - 56 - SPACE.xs - 36, buttonY);
    }

    this.root.setPosition(
      Math.round(this.anchorX - this.panelWidth / 2),
      Math.round(this.anchorBottom - this.panelHeight),
    );
  }
}
