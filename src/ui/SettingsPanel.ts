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
import { createDivider } from './system/UiWidgets.ts';

const ROW_HEIGHT = 44;

/** Masaüstünde gösterilen klavye kısayolları */
const SHORTCUT_LINES = [
  'Boşluk / 1: Üret   ·   2: Bant   ·   3 / B: İnşa',
  '4 / X: Sök   ·   5 / H: Hangar   ·   R: Döndür',
  'Sağ tuş basılı: Kaydır   ·   Tekerlek: Yakınlaştır',
  'WASD / Oklar: Kamera   ·   Sağ tık: Aracı iptal et',
  'Esc: Kapat / İptal   ·   Tab, Enter: Düğmeler',
];

export class SettingsPanel extends UiModal {
  private readonly onReset: () => void;
  private readonly confirmDialog: UiConfirmDialog;

  constructor(layer: UiLayer, onReset: () => void) {
    super(layer, { title: 'Ayarlar', maxWidth: 400, depth: 300, accent: SEMANTIC.secondary });
    this.onReset = onReset;
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
      ? 'Bu ekran daha büyük ölçeğe sığmıyor; kapalı seçenekler bu yüzden kullanılamaz.'
      : 'Yazı, düğme ve pencerelerin büyüklüğünü değiştirir. Fabrika görünümü etkilenmez.';
    const note = layer.text(0, y, scaleNote, 'caption', { color: SEMANTIC.textMuted, wrapWidth: width });
    body.add(note);
    y += note.height + SPACE.md;

    // --- Ses -------------------------------------------------------------
    body.add(createDivider(scene, 0, y, width));
    y += SPACE.md;
    const muted = sound.isMuted();
    y = this.addToggleRow(body, width, y, {
      label: 'Ses efektleri',
      icon: uiIcon(muted ? 'sound_off' : 'sound_on'),
      on: !muted,
      onToggle: () => {
        const nowMuted = sound.toggleMute();
        if (!nowMuted) sound.playClick();
        this.rebuild();
      },
    });

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

    // --- Klavye kısayolları (yalnız geniş ekranda) -------------------------
    if (metrics.mode === 'landscape') {
      body.add(createDivider(scene, 0, y, width));
      y += SPACE.md;
      sectionTitle('KLAVYE KISAYOLLARI');
      for (const line of SHORTCUT_LINES) {
        const text = layer.text(0, y, line, 'caption', { wrapWidth: width });
        body.add(text);
        y += text.height + 4;
      }
      y += SPACE.sm;
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

  private selectScale(preset: UiScalePreset): void {
    if (UiHost.scalePreset === preset) return;
    // Ölçek değişince katman tüm arayüzü (bu pencere dahil) yeniden yerleştirir
    UiHost.setScalePreset(preset);
  }
}
