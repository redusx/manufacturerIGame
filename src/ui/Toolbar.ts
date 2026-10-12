/* ======================================================================
 * Toolbar.ts — Ana araç çubuğu
 *
 * Oyuncunun fabrikada yapabildiği her şey aynı kalıpta, tek çubukta durur:
 * Üret (elle kazanç), Bant, İnşa (katalog), Sök ve Hangar. Etkin araç altın
 * çerçeveyle gösterilir; aynı düğmeye tekrar basmak aracı bırakır.
 *
 * Yerleşim ekrana göre değişir: dikeyde ve geniş yatayda altta, kısa yatay
 * ekranda (yatay telefon) sağ kenarda dikey; böylece fabrika alanı korunur.
 * ====================================================================== */

import Phaser from 'phaser';
import { SEMANTIC, SPACE, uiIcon } from './theme';
import { UiButton } from './system/UiButton.ts';
import type { UiLayer } from './system/UiLayer.ts';

export type ToolbarTool = 'belt' | 'demolish';

export interface ToolbarCallbacks {
  onProduce: () => void;
  onBelt: () => void;
  onBuild: () => void;
  onDemolish: () => void;
  onHangar: () => void;
  /** Kilitli hangar düğmesine basılınca */
  onHangarLocked: () => void;
}

export interface ToolbarRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const BUTTON_HEIGHT = 52;
const BUTTON_GAP = 6;
/** Dikey çubukta düğme bundan kısaysa sıkışık düzene geçilir (küçük ikon, dar aralık) */
const COMPACT_BELOW = 44;
/** Küçük ikon + etiketin sığdığı en kısa düğme; bunun altında yalnız ikon kalır */
const LABEL_MIN_HEIGHT = 32;

export class Toolbar {
  private readonly layer: UiLayer;
  private readonly root: Phaser.GameObjects.Container;
  private readonly bg: Phaser.GameObjects.NineSlice;
  private readonly pattern: Phaser.GameObjects.TileSprite;

  private readonly produceButton: UiButton;
  private readonly beltButton: UiButton;
  private readonly buildButton: UiButton;
  private readonly demolishButton: UiButton;
  private readonly hangarButton: UiButton;
  private readonly buttons: UiButton[];

  private rect: ToolbarRect = { x: 0, y: 0, width: 0, height: 0 };
  private vertical = false;
  private hangarUnlocked = true;

  constructor(layer: UiLayer, callbacks: ToolbarCallbacks) {
    this.layer = layer;
    const scene = layer.scene;
    this.root = layer.container(60);

    // Araç çubuğu tablası: üst kenarında pirinç şerit, üstünde ince ızgara dokusu
    this.bg = scene.add.nineslice(0, 0, 'ui2_dock_bg', 0, 100, 64, 6, 6, 6, 6).setOrigin(0, 0);
    this.pattern = scene.add.tileSprite(0, 0, 100, 64, 'ui2_pattern').setOrigin(0, 0);
    this.root.add([this.bg, this.pattern]);

    const make = (
      label: string,
      icon: string,
      variant: 'primary' | 'secondary' | 'rocket' | 'factory' | 'remove',
      onClick: () => void,
      extra: { iconTint?: number; silent?: boolean; onDisabledClick?: () => void } = {},
    ): UiButton => {
      const button = new UiButton(layer, 0, 0, {
        width: 60,
        height: BUTTON_HEIGHT,
        variant,
        label,
        icon,
        iconScale: 1.5,
        layout: 'column',
        textVariant: 'buttonSmall',
        onClick,
        ...extra,
      });
      this.root.add(button);
      layer.registerFocusable(button);
      return button;
    };

    // Üret'in kendi sesi ve efekti var; düğme tıklama sesi üstüne binmesin
    this.produceButton = make('ÜRET', uiIcon('hand'), 'factory', callbacks.onProduce, {
      silent: true,
    });
    this.beltButton = make('BANT', uiIcon('belt'), 'secondary', callbacks.onBelt);
    this.buildButton = make('İNŞA', 'icon_factory', 'primary', callbacks.onBuild);
    // Sök düğmesi kırmızıdır (DEC-051); simgesi beyaz kalır
    this.demolishButton = make('SÖK', uiIcon('trash'), 'remove', callbacks.onDemolish);
    this.hangarButton = make('HANGAR', uiIcon('hangar'), 'rocket', callbacks.onHangar, {
      onDisabledClick: callbacks.onHangarLocked,
    });

    this.buttons = [
      this.produceButton,
      this.beltButton,
      this.buildButton,
      this.demolishButton,
      this.hangarButton,
    ];
  }

  /** Çubuğun ekranda kapladığı alan (güvenli alan dahil); fabrika görüş alanı bunun dışında kalır */
  get occupied(): ToolbarRect {
    return this.rect;
  }

  /** Çubuk sağ kenarda dikey mi duruyor? */
  get isVertical(): boolean {
    return this.vertical;
  }

  layout(): void {
    const m = this.layer.metrics;
    const count = this.buttons.length;
    this.vertical = m.mode === 'landscapeCompact';

    if (this.vertical) {
      // Sağ kenarda dikey: yatay telefonda başparmağın altında, fabrikanın üstünü kapatmaz
      const top = m.safe.top + 48 + SPACE.xs;
      const available = m.height - top - m.safe.bottom - SPACE.xs;
      // Kısa ekranda (yatay telefon, tarayıcı çubukları açık) düğmeler sıkışır: aralık daralır
      // ve ikon bir kademe küçülür; etiketler her zaman okunur kalır.
      const roomy = Math.floor((available - (count - 1) * BUTTON_GAP - SPACE.sm) / count) >= COMPACT_BELOW;
      const gap = roomy ? BUTTON_GAP : 3;
      const buttonH = Math.min(BUTTON_HEIGHT, Math.floor((available - (count - 1) * gap - (roomy ? SPACE.sm : 0)) / count));
      const buttonW = 64;
      const width = buttonW + SPACE.sm * 2 + m.safe.right;
      const x = m.width - width;
      this.rect = { x, y: top, width, height: m.height - top };
      this.bg.setPosition(x, top).setSize(width + 6, m.height - top + 6);
      this.syncPattern();

      const totalH = count * buttonH + (count - 1) * gap;
      const startY = top + (available - totalH) / 2 + buttonH / 2;
      this.buttons.forEach((button, i) => {
        button.setIconScale(roomy ? 1.5 : 1);
        button.setLabelVisible(buttonH >= LABEL_MIN_HEIGHT);
        button.resize(buttonW, buttonH);
        button.setPosition(x + SPACE.sm + buttonW / 2, Math.round(startY + i * (buttonH + gap)));
      });
      return;
    }

    // Dar ekranda beş düğme de etiketiyle sığsın diye kenar boşluğu ve aralık küçülür
    const narrow = m.width < 340;
    const sidePad = narrow ? SPACE.xs : SPACE.sm;
    const gap = narrow ? SPACE.xs : BUTTON_GAP;
    const usable = m.width - m.safe.left - m.safe.right - sidePad * 2;
    const buttonW = Math.min(96, Math.floor((usable - (count - 1) * gap) / count));
    const totalW = count * buttonW + (count - 1) * gap;
    const height = BUTTON_HEIGHT + SPACE.sm * 2 + m.safe.bottom;
    const y = m.height - height;
    const portrait = m.mode === 'portrait';

    this.rect = { x: 0, y, width: m.width, height };
    if (portrait) {
      // Dikeyde çubuk tüm genişliği kaplar ve alt güvenli alanın altına uzanır
      this.bg.setPosition(-6, y).setSize(m.width + 12, height + 6);
    } else {
      // Geniş ekranda yalnız düğmelerin arkasında, ortalanmış bir tabla
      const dockW = totalW + SPACE.md * 2;
      this.bg.setPosition(Math.round((m.width - dockW) / 2), y).setSize(dockW, height + 6);
    }

    this.syncPattern();

    const startX = m.safe.left + sidePad + (usable - totalW) / 2 + buttonW / 2;
    const centerY = y + SPACE.sm + BUTTON_HEIGHT / 2;
    this.buttons.forEach((button, i) => {
      button.setIconScale(1.5);
      button.setLabelVisible(true);
      button.resize(buttonW, BUTTON_HEIGHT);
      button.setPosition(Math.round(startX + i * (buttonW + gap)), centerY);
    });
  }

  /** Izgara dokusunu tablanın içine (pirinç şeridin altına) oturtur */
  private syncPattern(): void {
    this.pattern.setPosition(this.bg.x + 1, this.bg.y + 4).setSize(this.bg.width - 2, this.bg.height - 5);
  }

  /** Bir düğmenin ekranda kapladığı dikdörtgen (arayüz birimi); öğretici vurgusu için */
  getButtonBounds(name: 'produce' | 'belt' | 'build' | 'demolish' | 'hangar'): Phaser.Geom.Rectangle {
    const buttons = {
      produce: this.produceButton,
      belt: this.beltButton,
      build: this.buildButton,
      demolish: this.demolishButton,
      hangar: this.hangarButton,
    };
    return buttons[name].getFocusBounds();
  }

  /** Etkin aracı vurgular (null: hiçbiri) */
  setActiveTool(tool: ToolbarTool | null): void {
    this.beltButton.setSelected(tool === 'belt');
    this.demolishButton.setSelected(tool === 'demolish');
  }

  /** Hangar açılana kadar düğme kilitli görünür */
  setHangarUnlocked(unlocked: boolean): void {
    if (unlocked === this.hangarUnlocked) return;
    this.hangarUnlocked = unlocked;
    this.hangarButton.setEnabled(unlocked);
    if (unlocked) {
      this.hangarButton.setIcon(uiIcon('hangar'));
    } else {
      this.hangarButton.setIcon(uiIcon('lock'), SEMANTIC.warning);
    }
  }

  /** Üret düğmesinin üst orta noktası (yüzen "+$1" yazısı buradan çıkar) */
  getProduceAnchor(): { x: number; y: number } {
    return { x: this.produceButton.x, y: this.produceButton.y - this.produceButton.buttonSize.height / 2 };
  }

  /** Elle üretimde düğmenin kısa esnemesi */
  pulseProduce(): void {
    const tweens = this.layer.scene.tweens;
    tweens.killTweensOf(this.produceButton);
    this.produceButton.setScale(1);
    tweens.add({
      targets: this.produceButton,
      scale: 0.94,
      duration: 60,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => this.produceButton.setScale(1),
    });
  }
}
