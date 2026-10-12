/* ======================================================================
 * SettingsPanel.ts — Ayarlar penceresi
 *
 * Arayüz ölçeği (anında uygulanır ve saklanır), ses, tam ekran ve kayıt
 * sıfırlama. Bir tercihin bu ekranda etkisi yoksa (ekrana sığmadığı için)
 * düğmesi kapalıdır ve nedeni yazılır.
 * ====================================================================== */

import Phaser from 'phaser';
import { sound } from '../audio/SoundManager.ts';
import { SEMANTIC, SPACE, uiIcon } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import { UiConfirmDialog } from './system/UiConfirmDialog.ts';
import { UiHost } from './system/UiHost.ts';
import type { UiLayer } from './system/UiLayer.ts';
import {
  isPresetEffective,
  UI_SCALE_LABELS,
  UI_SCALE_PRESETS,
  type UiScalePreset,
} from './system/UiMetrics.ts';
import { UiModal } from './system/UiModal.ts';
import { UiProgressBar, createDivider } from './system/UiWidgets.ts';

const ROW_HEIGHT = 44;
/** Ses seviyesinin bir adımı */
const VOLUME_STEP = 0.05;

/** Ayarlar penceresinin sahneden beklediği ek eylemler */
export interface SettingsPanelOptions {
  /** Kontrol şeması penceresini açar */
  onShowControls?: () => void;
  /** Öğretici şu an etkin mi (bitmemiş ve kapatılmamış)? */
  isTutorialActive?: () => boolean;
  /** Öğreticiyi kapatır veya baştan başlatır */
  onToggleTutorial?: () => void;
}

export class SettingsPanel extends UiModal {
  private readonly onReset: () => void;
  private readonly options: SettingsPanelOptions;
  private readonly confirmDialog: UiConfirmDialog;

  constructor(layer: UiLayer, onReset: () => void, options: SettingsPanelOptions = {}) {
    super(layer, { title: 'Ayarlar', maxWidth: 400, depth: 300, accent: SEMANTIC.secondary });
    this.onReset = onReset;
    this.options = options;
    this.confirmDialog = new UiConfirmDialog(layer);
  }

  protected buildBody(body: Phaser.GameObjects.Container, width: number): number {
    const scene = this.scene;
    const layer = this.layer;
    let y = 0;

    const sectionTitle = (title: string): void => {
      body.add(layer.text(0, y, title, 'captionBold', { color: SEMANTIC.textMuted }));
      y += 20;
    };

    // --- Arayüz ölçeği -------------------------------------------------
    sectionTitle('ARAYÜZ ÖLÇEĞİ');
    const metrics = layer.metrics;
    const columns = width >= 360 ? 4 : 2;
    const gap = SPACE.sm;
    const buttonWidth = (width - gap * (columns - 1)) / columns;
    let anyClamped = false;

    UI_SCALE_PRESETS.forEach((preset, index) => {
      const column = index % columns;
      const row = Math.floor(index / columns);
      const effective = isPresetEffective(metrics, preset);
      const selected = UiHost.scalePreset === preset;
      if (!effective) anyClamped = true;

      const button = new UiButton(layer, column * (buttonWidth + gap) + buttonWidth / 2, y + row * (ROW_HEIGHT + gap) + ROW_HEIGHT / 2, {
        width: buttonWidth,
        height: ROW_HEIGHT,
        variant: selected ? 'primary' : 'secondary',
        label: UI_SCALE_LABELS[preset],
        textVariant: 'buttonSmall',
        onClick: () => this.selectScale(preset),
      });
      button.setSelected(selected);
      // Bu ekrana sığmayan ölçek seçilemez; seçili olan ise her zaman görünür kalır
      button.setEnabled(effective || selected);
      body.add(button);
    });
    y += Math.ceil(UI_SCALE_PRESETS.length / columns) * (ROW_HEIGHT + gap);

    const scaleNote = anyClamped
      ? 'Kapalı seçenekler bu ekrana sığmıyor. Seçimin saklanır: ekranı döndürünce veya tam ekrana geçince sığan en büyük ölçek kendiliğinden uygulanır.'
      : 'Yazı, düğme ve pencerelerin büyüklüğünü değiştirir. Fabrika görünümü etkilenmez.';
    const note = layer.text(0, y, scaleNote, 'caption', { color: SEMANTIC.textMuted, wrapWidth: width });
    body.add(note);
    y += note.height + SPACE.md;

    // --- Ses -------------------------------------------------------------
    body.add(createDivider(scene, 0, y, width));
    y += SPACE.md;
    y = this.addVolumeRow(body, width, y);

    // --- Tam ekran (tarayıcı destekliyorsa) -------------------------------
    if (typeof document !== 'undefined' && document.fullscreenEnabled) {
      const isFullscreen = document.fullscreenElement !== null;
      y = this.addToggleRow(body, width, y, {
        label: 'Tam ekran',
        icon: uiIcon('fullscreen'),
        on: isFullscreen,
        onToggle: () => {
          const done = (): void => this.rebuild();
          if (document.fullscreenElement) {
            void document.exitFullscreen().then(done, done);
          } else {
            void document.documentElement.requestFullscreen().then(done, done);
          }
        },
      });
    }

    // --- Öğretici ve kontrol şeması ---------------------------------------
    const { isTutorialActive, onToggleTutorial, onShowControls } = this.options;
    if (isTutorialActive && onToggleTutorial) {
      const active = isTutorialActive();
      y = this.addToggleRow(body, width, y, {
        label: 'Öğretici',
        icon: uiIcon('info'),
        on: active,
        onToggle: () => {
          onToggleTutorial();
          this.rebuild();
        },
      });
    }
    if (onShowControls) {
      const controlsButton = new UiButton(layer, width / 2, y + ROW_HEIGHT / 2, {
        width,
        height: ROW_HEIGHT,
        variant: 'secondary',
        label: 'KONTROLLER',
        icon: uiIcon(metrics.mode === 'landscape' ? 'mouse' : 'touch'),
        onClick: onShowControls,
      });
      body.add(controlsButton);
      y += ROW_HEIGHT + SPACE.md;
    }

    // --- Kayıt -------------------------------------------------------------
    body.add(createDivider(scene, 0, y, width));
    y += SPACE.md;
    const resetButton = new UiButton(layer, width / 2, y + ROW_HEIGHT / 2, {
      width,
      height: ROW_HEIGHT,
      variant: 'danger',
      label: 'KAYDI SIFIRLA',
      icon: uiIcon('trash'),
      iconTint: 0xffffff,
      onClick: () =>
        this.confirmDialog.ask({
          title: 'Kayıt silinsin mi?',
          message: 'Tüm fabrika, para ve roket ilerlemesi silinir. Bu işlem geri alınamaz.',
          confirmLabel: 'SİL',
          danger: true,
          onConfirm: () => {
            sound.playDemolish();
            this.close();
            this.onReset();
          },
        }),
    });
    body.add(resetButton);
    y += ROW_HEIGHT;

    return y;
  }

  /** Solda etiket, sağda AÇIK/KAPALI düğmesi olan bir ayar satırı ekler; yeni Y'yi döner */
  private addToggleRow(
    body: Phaser.GameObjects.Container,
    width: number,
    y: number,
    row: { label: string; icon: string; on: boolean; onToggle: () => void },
  ): number {
    const centerY = y + ROW_HEIGHT / 2;
    const icon = this.scene.add.image(8, centerY, row.icon).setOrigin(0.5);
    const label = this.layer.text(24, centerY, row.label, 'bodyBold').setOrigin(0, 0.5);
    const buttonWidth = 96;
    const button = new UiButton(this.layer, width - buttonWidth / 2, centerY, {
      width: buttonWidth,
      height: 40,
      variant: row.on ? 'primary' : 'secondary',
      label: row.on ? 'AÇIK' : 'KAPALI',
      textVariant: 'buttonSmall',
      silent: true,
      onClick: row.onToggle,
    });
    body.add([icon, label, button]);
    return y + ROW_HEIGHT + SPACE.sm;
  }

  /**
   * Ses: sessize alma düğmesi ile seviye denetimi tek satırdadır. Soldaki hoparlör
   * düğmesi sesi açıp kapatır; eksi/artı %5'lik adımlarla, çubuğa dokunmak veya çubukta
   * sürüklemek doğrudan ayarlar. Değer anında uygulanır ve saklanır.
   */
  private addVolumeRow(body: Phaser.GameObjects.Container, width: number, y: number): number {
    const scene = this.scene;
    const layer = this.layer;
    const labelY = y + 10;
    body.add(layer.text(0, labelY, 'Ses', 'bodyBold').setOrigin(0, 0.5));
    const percentText = layer
      .text(width, labelY, '', 'bodyBold', { color: SEMANTIC.moneyHex })
      .setOrigin(1, 0.5);
    body.add(percentText);

    const rowY = y + 20 + SPACE.xs;
    const buttonSize = 40;
    const gap = SPACE.xs + 2;
    // Sıra: [hoparlör] [−] [çubuk] [+]
    const minusX = buttonSize + gap;
    const barX = minusX + buttonSize + gap;
    const barWidth = width - barX - buttonSize - gap;
    const barHeight = 14;
    const bar = new UiProgressBar(scene, barX, rowY + (buttonSize - barHeight) / 2, barWidth, barHeight, 'green');
    body.add(bar);

    const muteButton = new UiButton(layer, buttonSize / 2, rowY + buttonSize / 2, {
      width: buttonSize,
      height: buttonSize,
      variant: sound.isMuted() ? 'secondary' : 'primary',
      icon: uiIcon(sound.isMuted() ? 'sound_off' : 'sound_on'),
      silent: true,
      onClick: () => {
        const nowMuted = sound.toggleMute();
        if (!nowMuted) sound.playClick();
        show();
      },
    });
    body.add(muteButton);

    const show = (): void => {
      const muted = sound.isMuted();
      const volume = sound.getVolume();
      bar.setProgress(muted ? 0 : volume);
      percentText.setText(muted ? 'Kapalı' : `%${Math.round(volume * 100)}`);
      muteButton.setVariant(muted ? 'secondary' : 'primary').setIcon(uiIcon(muted ? 'sound_off' : 'sound_on'));
    };
    const apply = (volume: number): void => {
      const snapped = Math.round(Phaser.Math.Clamp(volume, 0, 1) / VOLUME_STEP) * VOLUME_STEP;
      // Seviyeyi değiştirmek sessizi de kaldırır: oyuncu sesi duymak için ayarlıyordur
      if (Math.abs(snapped - sound.getVolume()) < 1e-6 && !sound.isMuted()) return;
      sound.setVolume(snapped);
      if (sound.isMuted()) sound.setMuted(false);
      sound.playClick();
      show();
    };

    body.add(
      new UiButton(layer, minusX + buttonSize / 2, rowY + buttonSize / 2, {
        width: buttonSize,
        height: buttonSize,
        variant: 'secondary',
        icon: uiIcon('minus'),
        silent: true,
        onClick: () => apply(sound.getVolume() - VOLUME_STEP),
      }),
    );
    body.add(
      new UiButton(layer, width - buttonSize / 2, rowY + buttonSize / 2, {
        width: buttonSize,
        height: buttonSize,
        variant: 'secondary',
        icon: uiIcon('plus'),
        silent: true,
        onClick: () => apply(sound.getVolume() + VOLUME_STEP),
      }),
    );

    // Çubuğa dokunma / sürükleme: dokunma hedefi çubuktan yüksektir
    const zone = scene.add.zone(barX, rowY, barWidth, buttonSize).setOrigin(0, 0).setInteractive({ useHandCursor: true });
    const setFromPointer = (pointer: Phaser.Input.Pointer): void => {
      const point = layer.pointerPosition(pointer);
      // Kaydırılıp görünen alanın dışına çıkmış çubuk dokunuş almaz
      if (!this.isInsideViewport(point.y)) return;
      apply((point.x - zone.getWorldTransformMatrix().tx) / barWidth);
    };
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_DOWN, setFromPointer);
    zone.on(Phaser.Input.Events.GAMEOBJECT_POINTER_MOVE, (pointer: Phaser.Input.Pointer) => {
      if (pointer.isDown) setFromPointer(pointer);
    });
    body.add(zone);

    show();
    return rowY + buttonSize + SPACE.sm;
  }

  private selectScale(preset: UiScalePreset): void {
    if (UiHost.scalePreset === preset) return;
    // Ölçek değişince katman tüm arayüzü (bu pencere dahil) yeniden yerleştirir
    UiHost.setScalePreset(preset);
  }
}
