/* ======================================================================
 * src/factory/view/CameraMath.ts — Kamera Sınır ve Zoom Hesaplamaları
 *
 * Fabrika katı kamerasının yakınlaştırma (zoom) kademelerini, ekran
 * sınırlarını (clamping), fabrika ortalama koordinatlarını ve sürükleme
 * matematiğini hesaplayan saf TypeScript sınıfı.
 * Phaser bağımlılığı yoktur; headless ve birim testlerle %100 doğrulanabilir.
 *
 * Koordinat modeli: Phaser kamerası görüş alanının MERKEZİNE göre yakınlaşır.
 * Görünen dünya dikdörtgeni `viewport / zoom` boyutundadır ve sol-üst köşesi
 * `scroll + viewport * (1 - 1/zoom) / 2` noktasındadır. Buradaki tüm scroll
 * değerleri bu modele göredir.
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
   * Fabrikayı ekrana sığdırırken kullanılan kademeler. docs/ART_DIRECTION.md §3'teki
   * piksel ölçeklerine (1x, 1.5x, 2x, 2.5x) ek olarak 1.25x vardır: dar telefon
   * ekranında 8x8 fabrika 1.5x'e sığmaz, 1x'te ise hücreler dokunmak için küçük kalır.
   */
  public static readonly FIT_ZOOM_LEVELS: readonly number[] = [2.5, 2, 1.5, 1.25, 1, 0.75, 0.5];

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
   * İçerik (dünya) boyutuna ve viewport'a göre kameranın kayabileceği scroll sınırlarını hesaplar.
   * İçerik bir eksende görüş alanına sığıyorsa o eksende min > max döner; `clampPosition`
   * bu ters aralığı da geçerli sayar (içeriğin tamamı görünür kaldığı sürece serbest).
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
    const insetX = (viewport.width - effectiveW) / 2;
    const insetY = (viewport.height - effectiveH) / 2;

    return {
      minX: -padding - insetX,
      maxX: worldWidth + padding - effectiveW - insetX,
      minY: -padding - insetY,
      maxY: worldHeight + padding - effectiveH - insetY,
    };
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
   * (Merkezden yakınlaşma nedeniyle zoom'dan bağımsızdır.)
   */
  static computeCenterPosition(
    worldWidth: number,
    worldHeight: number,
    viewport: CameraViewport,
  ): { x: number; y: number } {
    return CameraMath.computeFocusPosition(worldWidth / 2, worldHeight / 2, viewport);
  }

  /**
   * Belirtilen dünya noktasını viewport'un ortasına getirecek kamera scroll pozisyonunu hesaplar.
   */
  static computeFocusPosition(
    targetWorldX: number,
    targetWorldY: number,
    viewport: CameraViewport,
  ): { x: number; y: number } {
    return {
      x: Math.round(targetWorldX - viewport.width / 2),
      y: Math.round(targetWorldY - viewport.height / 2),
    };
  }

  /**
   * Dünyanın (kenar boşluğuyla birlikte) görüş alanına tamamen sığdığı en büyük
   * yakınlaştırma kademesini seçer. Hiçbiri sığmıyorsa en küçük kademeyi döner.
   *
   * Tam sığan kademe 1x'in altındaysa hücreler dokunmak için fazla küçülür; bu durumda
   * her eksende toplam `cropTolerance` dünya pikseli (tipik: bir hücre) kırpılmasına
   * razı olunarak 1x'e kadar daha büyük bir kademe denenir.
   *
   * @param marginPx Fabrikanın çevresinde bırakılacak ekran pikseli boşluk
   * @param cropTolerance 1x altına düşmemek için kabul edilen toplam kırpma (dünya pikseli)
   */
  static computeFitZoom(
    worldWidth: number,
    worldHeight: number,
    viewport: CameraViewport,
    marginPx = 12,
    cropTolerance = 0,
    levels: readonly number[] = CameraMath.FIT_ZOOM_LEVELS,
  ): number {
    const sorted = [...levels].sort((a, b) => b - a);

    const fullFit =
      sorted.find(
        (zoom) =>
          worldWidth * zoom + marginPx * 2 <= viewport.width &&
          worldHeight * zoom + marginPx * 2 <= viewport.height,
      ) ?? sorted[sorted.length - 1];

    if (fullFit >= 1 || cropTolerance <= 0) return fullFit;

    const croppedFit = sorted.find(
      (zoom) =>
        zoom <= 1 &&
        (worldWidth - cropTolerance) * zoom <= viewport.width &&
        (worldHeight - cropTolerance) * zoom <= viewport.height,
    );
    return Math.max(fullFit, croppedFit ?? fullFit);
  }

  /**
   * Zoom değişirken imlecin altındaki dünya noktasını yerinde tutan yeni scroll değerini hesaplar.
   * @param pointerInViewport İmlecin viewport sol-üst köşesine göre ekran konumu
   */
  static computeAnchoredScroll(
    scrollX: number,
    scrollY: number,
    pointerInViewport: { x: number; y: number },
    viewport: CameraViewport,
    zoomFrom: number,
    zoomTo: number,
  ): { x: number; y: number } {
    const factor = 1 / zoomFrom - 1 / zoomTo;
    return {
      x: scrollX + (pointerInViewport.x - viewport.width / 2) * factor,
      y: scrollY + (pointerInViewport.y - viewport.height / 2) * factor,
    };
  }
}
