/* ======================================================================
 * src/factory/view/CameraMath.ts — Kamera Sınır ve Zoom Hesaplamaları
 *
 * Fabrika katı kamerasının yakınlaştırma (zoom) kademelerini, ekran
 * sınırlarını (clamping), fabrika ortalama koordinatlarını ve sürükleme
 * matematiğini hesaplayan saf TypeScript sınıfı.
 * Phaser bağımlılığı yoktur; headless ve birim testlerle %100 doğrulanabilir.
 * ====================================================================== */

export interface CameraBounds {
  minX: number;
  maxX: number;
  minY: number;
  maxY: number;
}

export interface CameraViewport {
  width: number;
  height: number;
}

export class CameraMath {
  public static readonly DEFAULT_MIN_ZOOM = 0.5;
  public static readonly DEFAULT_MAX_ZOOM = 2.5;
  public static readonly DEFAULT_ZOOM_STEP = 0.25;

  /**
   * Zoom seviyesini min ve max sınırları arasında kısıtlar.
   */
  static clampZoom(
    zoom: number,
    minZoom = CameraMath.DEFAULT_MIN_ZOOM,
    maxZoom = CameraMath.DEFAULT_MAX_ZOOM,
  ): number {
    return Math.max(minZoom, Math.min(maxZoom, zoom));
  }

  /**
   * Bir sonraki / önceki kesikli zoom seviyesini hesaplar.
   * Floating-point kaymalarını engellemek için step katlarına yuvarlar.
   */
  static getNextDiscreteZoom(
    currentZoom: number,
    direction: 1 | -1,
    step = CameraMath.DEFAULT_ZOOM_STEP,
    minZoom = CameraMath.DEFAULT_MIN_ZOOM,
    maxZoom = CameraMath.DEFAULT_MAX_ZOOM,
  ): number {
    const rawTarget = currentZoom + direction * step;
    const rounded = Math.round(rawTarget / step) * step;
    // Ondalık hassasiyetini temizle (örn. 1.2500000000000002 -> 1.25)
    const cleanNumber = Number(rounded.toFixed(4));
    return this.clampZoom(cleanNumber, minZoom, maxZoom);
  }

  /**
   * Fabrika dünya boyutuna ve viewport'a göre kameranın kayabileceği güvenli sınırları hesaplar.
   */
  static computePanBounds(
    worldWidth: number,
    worldHeight: number,
    viewport: CameraViewport,
    zoom = 1.0,
    padding = 64,
  ): CameraBounds {
    const effectiveW = viewport.width / zoom;
    const effectiveH = viewport.height / zoom;

    // Eğer fabrika viewport'tan küçükse, fabrikayı kapsayan esnek alan bırak
    const minX = -padding;
    const maxX = Math.max(minX, worldWidth + padding - effectiveW);

    const minY = -padding;
    const maxY = Math.max(minY, worldHeight + padding - effectiveH);

    return { minX, maxX, minY, maxY };
  }

  /**
   * Kamera scroll pozisyonunu hesaplanan sınırlar içinde tutar ve tamsayıya yuvarlar.
   * docs/ART_DIRECTION.md sub-pixel rounding kuralına uygundur.
   */
  static clampPosition(
    scrollX: number,
    scrollY: number,
    bounds: CameraBounds,
  ): { x: number; y: number } {
    // Sınırlar ters ise (fabrika ekrandan küçükse) aralığın ortasını veya min'i seç
    const effectiveMinX = Math.min(bounds.minX, bounds.maxX);
    const effectiveMaxX = Math.max(bounds.minX, bounds.maxX);
    const effectiveMinY = Math.min(bounds.minY, bounds.maxY);
    const effectiveMaxY = Math.max(bounds.minY, bounds.maxY);

    const x = Math.max(effectiveMinX, Math.min(effectiveMaxX, scrollX));
    const y = Math.max(effectiveMinY, Math.min(effectiveMaxY, scrollY));

    return { x: Math.round(x), y: Math.round(y) };
  }

  /**
   * Fabrikayı viewport içinde tam ortalayacak kamera scroll pozisyonunu hesaplar.
   */
  static computeCenterPosition(
    worldWidth: number,
    worldHeight: number,
    viewport: CameraViewport,
    zoom = 1.0,
  ): { x: number; y: number } {
    const effectiveW = viewport.width / zoom;
    const effectiveH = viewport.height / zoom;

    const scrollX = Math.round((worldWidth - effectiveW) / 2);
    const scrollY = Math.round((worldHeight - effectiveH) / 2);

    return { x: scrollX, y: scrollY };
  }

  /**
   * Belirtilen dünya noktasına odaklanacak kamera scroll pozisyonunu hesaplar.
   */
  static computeFocusPosition(
    targetWorldX: number,
    targetWorldY: number,
    viewport: CameraViewport,
    zoom = 1.0,
  ): { x: number; y: number } {
    const effectiveW = viewport.width / zoom;
    const effectiveH = viewport.height / zoom;

    const scrollX = Math.round(targetWorldX - effectiveW / 2);
    const scrollY = Math.round(targetWorldY - effectiveH / 2);

    return { x: scrollX, y: scrollY };
  }
}
