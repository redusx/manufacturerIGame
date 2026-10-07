/* ======================================================================
 * src/ui/system/UiHost.ts — Oyun geneli ekran ve arayüz ölçeği yöneticisi
 *
 * Pencere boyutunu, cihaz piksel oranını, güvenli alanı ve oyuncunun arayüz
 * ölçeği tercihini izler; tuvali cihaz çözünürlüğünde boyutlandırır ve geçerli
 * `UiMetrics` değerini sahnelere duyurur. Tercih tarayıcıda saklanır.
 * ====================================================================== */

import type Phaser from 'phaser';
import {
  computeUiMetrics,
  UI_SCALE_PRESETS,
  ZERO_INSETS,
  type Insets,
  type UiMetrics,
  type UiScalePreset,
} from './UiMetrics.ts';

export const UI_PREFS_STORAGE_KEY = 'manufacturer_ui_prefs_v1';

type MetricsListener = (metrics: UiMetrics) => void;

function loadPreset(): UiScalePreset {
  try {
    const raw = localStorage.getItem(UI_PREFS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as { uiScale?: string };
      const found = UI_SCALE_PRESETS.find((p) => p === parsed.uiScale);
      if (found) return found;
    }
  } catch {
    // Depolama kapalıysa veya kayıt bozuksa varsayılan kullanılır
  }
  return 'normal';
}

function savePreset(preset: UiScalePreset): void {
  try {
    localStorage.setItem(UI_PREFS_STORAGE_KEY, JSON.stringify({ uiScale: preset }));
  } catch {
    // Depolama kapalıysa tercih yalnız bu oturumda geçerli olur
  }
}

class UiHostImpl {
  private game: Phaser.Game | null = null;
  private preset: UiScalePreset = 'normal';
  private current: UiMetrics = computeUiMetrics({ cssWidth: 360, cssHeight: 640, devicePixelRatio: 1 });
  private listeners = new Set<MetricsListener>();
  private safeAreaProbe: HTMLElement | null = null;

  /** Geçerli ekran ölçüleri */
  get metrics(): UiMetrics {
    return this.current;
  }

  get scalePreset(): UiScalePreset {
    return this.preset;
  }

  /** Oyun oluşturulduktan sonra bir kez çağrılır */
  init(game: Phaser.Game): void {
    this.game = game;
    this.preset = loadPreset();
    this.safeAreaProbe = this.createSafeAreaProbe();

    const refresh = (): void => this.refresh();
    window.addEventListener('resize', refresh);
    window.addEventListener('orientationchange', refresh);
    window.visualViewport?.addEventListener('resize', refresh);

    this.refresh();
  }

  /** Ölçüler değiştiğinde (pencere boyutu veya ölçek tercihi) çağrılacak dinleyici ekler */
  onChange(listener: MetricsListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Oyuncunun arayüz ölçeği tercihini değiştirir, saklar ve hemen uygular */
  setScalePreset(preset: UiScalePreset): void {
    if (preset === this.preset) return;
    this.preset = preset;
    savePreset(preset);
    this.refresh();
  }

  /** Pencereyi yeniden ölçer; değişiklik varsa tuvali boyutlandırıp sahnelere duyurur */
  refresh(): void {
    const game = this.game;
    if (!game) return;

    const cssWidth = window.innerWidth;
    const cssHeight = window.innerHeight;

    // Gizli veya henüz yerleşmemiş çerçevede pencere 0x0 olur; 0 boyutlu WebGL
    // framebuffer açılışı çökertir. Gerçek boyut 'resize' ile gelene kadar bekle.
    if (cssWidth < 1 || cssHeight < 1) return;

    const next = computeUiMetrics({
      cssWidth,
      cssHeight,
      devicePixelRatio: window.devicePixelRatio || 1,
      safeArea: this.readSafeArea(),
      preset: this.preset,
    });
    const previous = this.current;
    this.current = next;

    const canvasChanged =
      game.scale.width !== next.canvasWidth ||
      game.scale.height !== next.canvasHeight ||
      previous.cssWidth !== next.cssWidth ||
      previous.cssHeight !== next.cssHeight;

    if (canvasChanged) {
      // CSS boyutu resize()'dan ÖNCE verilmeli: Phaser kanvası o anki CSS boyutuna göre
      // ortalar; sonra verilirse ortalama bir önceki pencere boyutuna göre kayık kalır.
      game.scale.setZoom(1);
      game.canvas.style.width = `${cssWidth}px`;
      game.canvas.style.height = `${cssHeight}px`;
      game.scale.resize(next.canvasWidth, next.canvasHeight);
    }

    for (const listener of this.listeners) {
      listener(next);
    }
  }

  /** env(safe-area-inset-*) değerlerini okumak için görünmez bir ölçüm öğesi */
  private createSafeAreaProbe(): HTMLElement | null {
    if (typeof document === 'undefined') return null;
    const probe = document.createElement('div');
    probe.style.cssText =
      'position:fixed;left:0;top:0;width:0;height:0;visibility:hidden;pointer-events:none;' +
      'padding-top:env(safe-area-inset-top);padding-right:env(safe-area-inset-right);' +
      'padding-bottom:env(safe-area-inset-bottom);padding-left:env(safe-area-inset-left);';
    document.body.appendChild(probe);
    return probe;
  }

  private readSafeArea(): Insets {
    if (!this.safeAreaProbe) return ZERO_INSETS;
    const style = getComputedStyle(this.safeAreaProbe);
    const read = (value: string): number => {
      const parsed = parseFloat(value);
      return Number.isFinite(parsed) ? parsed : 0;
    };
    return {
      top: read(style.paddingTop),
      right: read(style.paddingRight),
      bottom: read(style.paddingBottom),
      left: read(style.paddingLeft),
    };
  }
}

export const UiHost = new UiHostImpl();
