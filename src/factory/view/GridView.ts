/* ======================================================================
 * src/factory/view/GridView.ts — 2D Izgara ve Zemin Görselleştirme Katmanı
 *
 * Fabrika zemin karolarını (factory_floor), aktif parsel hücre sınırlarını (32x32),
 * sabit hammadde giriş silolarını (INTAKE), sevkiyat sandıklarını (EXPORT),
 * engelleri (OBSTACLE) ve henüz açılmamış kilitli genişleme parsellerini
 * (Plot 1..4) Phaser 3 sahnesinde piksel-sanat standartlarına uygun render eder.
 *
 * docs/ART_DIRECTION.md ve src/ui/theme.ts standartlarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { GridCoord } from '../types.ts';
import { GridMap } from '../simulation/GridMap.ts';
import {
  FactoryEconomy,
  FACTORY_PLOTS,
  type PlotDefinition,
} from '../simulation/FactoryEconomy.ts';
import { PALETTE, FONT_FAMILY } from '../../ui/theme.ts';
import { GridCoordinates } from './GridCoordinates.ts';
import { INTAKE_SHORT_NAMES } from '../input/PlacementMath.ts';
import { bindWorldTap, isTap } from '../input/WorldPointer.ts';
import { SCREEN_LABEL_NAME } from '../../ui/system/UiLayer.ts';
import { DIRECTION_VECTORS } from '../types.ts';
import { ConveyorGeometry } from './ConveyorGeometry.ts';
import { PORT_ARROW_OUT } from './MachineSprites.ts';

export { GridCoordinates };


export interface GridViewConfig {
  tileSize?: number;
  originX?: number;
  originY?: number;
}

/** Kilitli parsel rozetinin doğal genişliği (dünya pikseli) */
const LOCKED_BADGE_WIDTH = 132;

export class GridView {
  readonly scene: Phaser.Scene;
  readonly grid: GridMap;
  readonly economy: FactoryEconomy;
  readonly tileSize: number;

  private originX: number;
  private originY: number;

  /** Kök Phaser Konteyneri */
  readonly rootContainer: Phaser.GameObjects.Container;

  /** Alt Görsel Katmanlar */
  private floorContainer: Phaser.GameObjects.Container;
  private gridLinesGraphics: Phaser.GameObjects.Graphics;
  private fixedNodesContainer: Phaser.GameObjects.Container;
  private lockedPlotsContainer: Phaser.GameObjects.Container;

  /** Zemin TileSprite */
  private floorTileSprite: Phaser.GameObjects.TileSprite | null = null;

  /** Parsel açma talebi geri çağırma dinleyicisi */
  onPlotUnlockRequested?: (plotIndex: number) => void;

  /** Hücre tıklama dinleyicisi */
  onCellClicked?: (coord: GridCoord) => void;

  /** Basış anında sorulur: bu basış bir hücre tıklaması başlatabilir mi? (ör. inşa aracı açıkken hayır) */
  canStartCellClick?: () => boolean;

  /** Basış zeminde başladı mı? Başka yerde başlayıp zeminde biten bırakışlar tıklama sayılmaz. */
  private floorPressArmed = false;

  /**
   * Sıradaki parsel bir menzil izni bekliyorsa rozette gösterilecek metni döner
   * ("7.00 km menzil izni"); izin gerekmiyorsa veya alındıysa null. (M9-D)
   */
  getPlotPermitLabel?: (plotIndex: number) => string | null;

  /** Sıradaki parsel rozeti en son hangi durumla çizildi: "alınabilir|izin metni" (kilitli parsel yoksa null) */
  private lockedPlotState: string | null = null;

  /** Kilitli parsel rozeti; kamera uzaklaşınca okunaklı kalsın diye ölçeklenir */
  private lockedBadge: Phaser.GameObjects.Container | null = null;
  private labelScale = 1;
  /**
   * Rozetin durduğu şerit: parsel genişliyorsa fabrikanın sağında ('x'),
   * yalnız yükseliyorsa altında ('y'). Merkez ve çapa o eksendeki değerlerdir.
   */
  private lockedBadgeAxis: 'x' | 'y' = 'x';
  private lockedBadgeCenter = 0;
  private lockedBadgeAnchor = 0;
  /** Rozetin o eksendeki yarı boyu (ölçeksiz) */
  private lockedBadgeHalfExtent = LOCKED_BADGE_WIDTH / 2;

  constructor(
    scene: Phaser.Scene,
    grid: GridMap,
    economy: FactoryEconomy,
    config: GridViewConfig = {},
  ) {
    this.scene = scene;
    this.grid = grid;
    this.economy = economy;
    this.tileSize = config.tileSize ?? GridCoordinates.DEFAULT_TILE_SIZE;
    this.originX = config.originX ?? 0;
    this.originY = config.originY ?? 0;

    // Kök konteyneri oluştur
    this.rootContainer = scene.add.container(this.originX, this.originY);

    // Katman konteynerlerini oluştur
    this.floorContainer = scene.add.container(0, 0);
    this.gridLinesGraphics = scene.add.graphics();
    this.fixedNodesContainer = scene.add.container(0, 0);
    this.lockedPlotsContainer = scene.add.container(0, 0);

    this.rootContainer.add([
      this.floorContainer,
      this.gridLinesGraphics,
      this.fixedNodesContainer,
      this.lockedPlotsContainer,
    ]);

    // Zeminde başlayıp başka yerde biten basışlar da burada sıfırlanır
    this.scene.input.on('pointerup', this.disarmFloorPress, this);

    // İlk çizimi gerçekleştir
    this.refresh();
  }

  private disarmFloorPress(): void {
    this.floorPressArmed = false;
  }

  /**
   * Zemin üstü etiketlerin (kilitli parsel rozeti) ölçeği. Sahne, rozet kamera
   * zoom'undan bağımsız olarak ekranda aynı boyutta kalsın diye zoom'un tersini verir.
   */
  setLabelScale(scale: number): void {
    this.labelScale = scale;
    this.applyBadgeLayout();
  }

  /**
   * Rozet büyüdükçe etkin fabrikanın üstüne taşmasın: fabrikaya bakan kenarı her
   * zaman fabrikanın sağ (veya alt) kenarının dışında kalır, rozet dışarı doğru büyür.
   */
  private applyBadgeLayout(): void {
    const badge = this.lockedBadge;
    if (!badge) return;
    badge.setScale(this.labelScale);
    const halfExtent = this.lockedBadgeHalfExtent * this.labelScale;
    const gap = 6 * this.labelScale;
    const position = Math.round(Math.max(this.lockedBadgeCenter, this.lockedBadgeAnchor + gap + halfExtent));
    if (this.lockedBadgeAxis === 'x') {
      badge.setX(position);
    } else {
      badge.setY(position);
    }
  }

  // -------------------------------------------------------------
  // KOORDİNAT DÖNÜŞÜMLERİ
  // -------------------------------------------------------------

  gridToWorld(coord: GridCoord): { x: number; y: number } {
    return GridCoordinates.gridToWorld(
      coord,
      this.tileSize,
      this.originX,
      this.originY,
    );
  }

  gridToWorldCenter(coord: GridCoord): { x: number; y: number } {
    return GridCoordinates.gridToWorldCenter(
      coord,
      this.tileSize,
      this.originX,
      this.originY,
    );
  }

  worldToGrid(worldX: number, worldY: number): GridCoord {
    return GridCoordinates.worldToGrid(
      worldX,
      worldY,
      this.tileSize,
      this.originX,
      this.originY,
    );
  }

  setOrigin(x: number, y: number): void {
    this.originX = Math.round(x);
    this.originY = Math.round(y);
    this.rootContainer.setPosition(this.originX, this.originY);
  }

  // -------------------------------------------------------------
  // YENİLEME VE ÇİZİM (REFRESH & RENDER)
  // -------------------------------------------------------------

  /**
   * Aktif fabrika boyutlarını sorgular ve tüm ızgarayı, zemin karolarını,
   * sabit düğümleri ve kilitli parselleri yeniden çizer.
   */
  refresh(): void {
    const { width: currentW, height: currentH } =
      this.economy.getCurrentFactoryDimensions();

    this.renderFloor(currentW, currentH);
    this.renderGridLines(currentW, currentH);
    this.renderFixedNodes();
    this.renderLockedPlots(currentW, currentH);
  }

  /**
   * 1. Zemin Döşemesi (factory_floor TileSprite veya renkli piksel taban)
   */
  private renderFloor(activeW: number, activeH: number): void {
    this.floorContainer.removeAll(true);

    const pixelW = activeW * this.tileSize;
    const pixelH = activeH * this.tileSize;

    // Arka plan derin çelik gölgesi
    const bgShadow = this.scene.add.rectangle(
      -2,
      -2,
      pixelW + 4,
      pixelH + 4,
      PALETTE.borderDark,
    );
    bgShadow.setOrigin(0, 0);
    this.floorContainer.add(bgShadow);

    // factory_floor dokusu mevcutsa TileSprite kullan
    if (this.scene.textures.exists('factory_floor')) {
      this.floorTileSprite = this.scene.add.tileSprite(
        0,
        0,
        pixelW,
        pixelH,
        'factory_floor',
      );
      this.floorTileSprite.setOrigin(0, 0);
      this.floorContainer.add(this.floorTileSprite);
    } else {
      // Doku yüklenmemişse tema uyumlu koyu endüstriyel zemin çiz
      const fallbackFloor = this.scene.add.rectangle(
        0,
        0,
        pixelW,
        pixelH,
        PALETTE.cardBg,
      );
      fallbackFloor.setOrigin(0, 0);
      this.floorContainer.add(fallbackFloor);
    }

    // Aktif fabrikanın dış kenarlık vurgusu (1px açık piksel konturu)
    const borderGraphics = this.scene.add.graphics();
    borderGraphics.lineStyle(1, PALETTE.borderHighlight, 0.9);
    borderGraphics.strokeRect(0, 0, pixelW, pixelH);
    this.floorContainer.add(borderGraphics);

    // Zemin tıklama alanı (manuel üretim ve hücre etkileşimi için)
    const floorZone = this.scene.add.zone(0, 0, pixelW, pixelH)
      .setOrigin(0, 0)
      .setInteractive()
      .on('pointerdown', () => {
        this.floorPressArmed = this.canStartCellClick ? this.canStartCellClick() : true;
      })
      .on('pointerup', (pointer: Phaser.Input.Pointer) => {
        if (!this.floorPressArmed) return;
        this.floorPressArmed = false;

        if (isTap(pointer) && this.onCellClicked) {
          const localX = pointer.worldX - this.originX;
          const localY = pointer.worldY - this.originY;
          const coord = this.worldToGrid(localX, localY);
          if (this.grid.isInBounds(coord.x, coord.y)) {
            this.onCellClicked(coord);
          }
        }
      });
    this.floorContainer.add(floorZone);
  }

  /**
   * 2. Hücre Izgara Çizgileri (Hafif ve keskin 32x32 ızgara ağı)
   */
  private renderGridLines(activeW: number, activeH: number): void {
    this.gridLinesGraphics.clear();
    this.gridLinesGraphics.lineStyle(1, PALETTE.borderDark, 0.35);

    const pixelW = activeW * this.tileSize;
    const pixelH = activeH * this.tileSize;

    // Dikey çizgiler
    for (let x = 0; x <= activeW; x++) {
      const px = x * this.tileSize;
      this.gridLinesGraphics.lineBetween(px, 0, px, pixelH);
    }

    // Yatay çizgiler
    for (let y = 0; y <= activeH; y++) {
      const py = y * this.tileSize;
      this.gridLinesGraphics.lineBetween(0, py, pixelW, py);
    }
  }

  /**
   * 3. Sabit Düğümler (Hammadde Girişi, Sevkiyat Sandığı, Sabit Engeller)
   */
  private renderFixedNodes(): void {
    this.fixedNodesContainer.removeAll(true);

    // 3.1. Sabit Engeller (OBSTACLE)
    for (const cell of this.grid.getObstacleCells()) {
      const { x: px, y: py } = GridCoordinates.gridToWorld(
        cell.coord,
        this.tileSize,
      );
      const obsRect = this.scene.add.rectangle(
        px + 2,
        py + 2,
        this.tileSize - 4,
        this.tileSize - 4,
        PALETTE.borderDark,
      );
      obsRect.setOrigin(0, 0);

      const crossGraphics = this.scene.add.graphics();
      crossGraphics.lineStyle(1, PALETTE.borderHighlight, 0.7);
      crossGraphics.lineBetween(px + 4, py + 4, px + this.tileSize - 4, py + this.tileSize - 4);
      crossGraphics.lineBetween(px + this.tileSize - 4, py + 4, px + 4, py + this.tileSize - 4);

      this.fixedNodesContainer.add([obsRect, crossGraphics]);
    }

    // 3.2. Hammadde Giriş Siloları (INTAKE)
    for (const cell of this.grid.getIntakeCells()) {
      const { x: px, y: py } = GridCoordinates.gridToWorld(
        cell.coord,
        this.tileSize,
      );

      const intakeCont = this.scene.add.container(px, py);

      if (this.scene.textures.exists('factory_intake')) {
        const intakeSprite = this.scene.add.image(
          this.tileSize / 2,
          this.tileSize / 2,
          'factory_intake',
        );
        intakeSprite.setDisplaySize(this.tileSize, this.tileSize);
        intakeCont.add(intakeSprite);
      } else {
        const fallbackIntake = this.scene.add.rectangle(
          0,
          0,
          this.tileSize,
          this.tileSize,
          PALETTE.factoryAmber,
        );
        fallbackIntake.setOrigin(0, 0);
        intakeCont.add(fallbackIntake);
      }

      // Çıkış oku: hammadde yalnızca bu kenardan, bu yöndeki banda verilir (DEC-026)
      if (this.scene.textures.exists(PORT_ARROW_OUT)) {
        const direction = cell.intakeData?.direction ?? 'SOUTH';
        const vec = DIRECTION_VECTORS[direction];
        const half = this.tileSize / 2;
        const arrow = this.scene.add.image(
          Math.round(half + vec.dx * half),
          Math.round(half + vec.dy * half),
          PORT_ARROW_OUT,
        );
        arrow.setRotation(ConveyorGeometry.directionToAngleRad(direction));
        intakeCont.add(arrow);
      }

      // Giriş oku veya etiket
      const inText = this.scene.add.text(
        this.tileSize / 2,
        this.tileSize / 2,
        INTAKE_SHORT_NAMES[cell.intakeData?.itemId ?? ''] ?? 'IN',
        {
          fontFamily: FONT_FAMILY,
          fontSize: '9px',
          color: '#ffffff',
        },
      );
      inText.setOrigin(0.5, 0.5);
      intakeCont.add(inText);

      this.fixedNodesContainer.add(intakeCont);
    }

    // 3.3. Sevkiyat Sandıkları (EXPORT)
    for (const cell of this.grid.getExportCells()) {
      const { x: px, y: py } = GridCoordinates.gridToWorld(
        cell.coord,
        this.tileSize,
      );

      const exportCont = this.scene.add.container(px, py);

      if (this.scene.textures.exists('shipping_crate')) {
        const crateSprite = this.scene.add.image(
          this.tileSize / 2,
          this.tileSize / 2,
          'shipping_crate',
        );
        crateSprite.setDisplaySize(this.tileSize, this.tileSize);
        exportCont.add(crateSprite);
      } else {
        const fallbackCrate = this.scene.add.rectangle(
          0,
          0,
          this.tileSize,
          this.tileSize,
          PALETTE.resourceGold,
        );
        fallbackCrate.setOrigin(0, 0);
        exportCont.add(fallbackCrate);
      }

      const outText = this.scene.add.text(
        this.tileSize / 2,
        this.tileSize / 2,
        'OUT',
        {
          fontFamily: FONT_FAMILY,
          fontSize: '9px',
          color: '#0b0e17',
        },
      );
      outText.setOrigin(0.5, 0.5);
      exportCont.add(outText);

      this.fixedNodesContainer.add(exportCont);
    }
  }

  /**
   * 4. Kilitli Genişleme Parselleri (Plot Sınırları ve Satın Alma Rozetleri)
   */
  private renderLockedPlots(activeW: number, activeH: number): void {
    this.lockedPlotsContainer.removeAll(true);
    this.lockedPlotState = null;
    this.lockedBadge = null;

    for (const plot of FACTORY_PLOTS) {
      if (this.economy.isPlotUnlocked(plot.index)) continue;

      // Sadece bir sonraki açılabilir parseli vurgula veya tüm kilitli alanları göster
      const plotPixelW = plot.targetWidth * this.tileSize;
      const plotPixelH = plot.targetHeight * this.tileSize;

      // Kilitli alan konteyneri
      const plotContainer = this.scene.add.container(0, 0);

      // Kilitli alan gölgesi: yalnızca henüz açılmamış bölge (sağ şerit + alt şerit).
      // Tüm parsel dikdörtgeni boyanırsa aktif fabrika zemini de kararır.
      const activePixelW = activeW * this.tileSize;
      const activePixelH = activeH * this.tileSize;
      const overlayGraphics = this.scene.add.graphics();
      overlayGraphics.fillStyle(PALETTE.bgDeep, 0.65);
      overlayGraphics.fillRect(activePixelW, 0, plotPixelW - activePixelW, plotPixelH);
      overlayGraphics.fillRect(0, activePixelH, activePixelW, plotPixelH - activePixelH);

      // Uyarı / Genişleme kenarlığı (Kesikli endüstriyel çizgi hissi)
      overlayGraphics.lineStyle(1, PALETTE.warningOrange, 0.7);
      overlayGraphics.strokeRect(0, 0, plotPixelW, plotPixelH);

      plotContainer.add(overlayGraphics);

      // Kilit Rozeti (Genişleyen bölgenin merkezinde)
      // Parsel genişliyorsa rozet sağdaki yeni şeridin, yalnız yükseliyorsa alttaki şeridin ortasındadır
      const growsWide = plotPixelW > activePixelW;
      const centerX = growsWide ? Math.round((activePixelW + plotPixelW) / 2) : Math.round(plotPixelW / 2);
      const centerY = growsWide ? Math.round(plotPixelH / 2) : Math.round((activePixelH + plotPixelH) / 2);

      const badgeContainer = this.scene.add.container(centerX, centerY);
      this.lockedBadgeAxis = growsWide ? 'x' : 'y';
      this.lockedBadgeAnchor = growsWide ? activePixelW : activePixelH;

      // Rozet: uzun parsel adı kutudan taşmasın diye satıra bölünür, yükseklik metne göre ayarlanır
      const badgeW = LOCKED_BADGE_WIDTH;
      const permitLabel = this.getPlotPermitLabel?.(plot.index) ?? null;
      // Menzil izni bekleyen parsel, para yetse de satın alınamaz
      const canAfford = !permitLabel && this.economy.canAfford(plot.cost);
      this.lockedPlotState = this.computeLockedPlotState(plot);

      // Parsel Adı
      const titleText = this.scene.add.text(0, 0, plot.name, {
        fontFamily: FONT_FAMILY,
        fontSize: '11px',
        fontStyle: 'bold',
        color: PALETTE.textPrimary,
        align: 'center',
        wordWrap: { width: badgeW - 12 },
      });
      titleText.setOrigin(0.5, 0);

      // Boyut ve Maliyet
      const costStr = plot.cost > 0 ? `$${plot.cost.toLocaleString('en-US')}` : 'Ücretsiz';
      const costText = this.scene.add.text(
        0,
        0,
        `${plot.targetWidth}x${plot.targetHeight} · ${costStr}`,
        {
          fontFamily: FONT_FAMILY,
          fontSize: '11px',
          color: canAfford ? PALETTE.resourceGoldHex : PALETTE.textMuted,
        },
      );
      costText.setOrigin(0.5, 0);

      // Menzil izni satırı (yalnız izin bekleniyorsa)
      const permitText = permitLabel
        ? this.scene.add
            .text(0, 0, permitLabel, {
              fontFamily: FONT_FAMILY,
              fontSize: '11px',
              fontStyle: 'bold',
              color: PALETTE.warningOrangeHex,
              align: 'center',
              wordWrap: { width: badgeW - 12 },
            })
            .setOrigin(0.5, 0)
        : null;

      const badgeH = Math.round(titleText.height + costText.height + 20 + (permitText ? permitText.height + 4 : 0));
      titleText.setY(-badgeH / 2 + 8);
      costText.setY(titleText.y + titleText.height + 4);
      permitText?.setY(costText.y + costText.height + 4);

      const badgeBg = this.scene.add.rectangle(
        0,
        0,
        badgeW,
        badgeH,
        canAfford ? PALETTE.cardBg : PALETTE.btnDisabled,
      );
      badgeBg.setStrokeStyle(1, canAfford ? PALETTE.successGreen : PALETTE.borderDark);

      // İnteraktif tıklama alanı
      const hitZone = this.scene.add.zone(0, 0, badgeW, badgeH);
      hitZone.setInteractive({ useHandCursor: canAfford });
      bindWorldTap(
        hitZone,
        () => {
          if (this.onPlotUnlockRequested) {
            this.onPlotUnlockRequested(plot.index);
          }
        },
        () => (this.canStartCellClick ? this.canStartCellClick() : true),
      );

      badgeContainer.add([badgeBg, titleText, costText, hitZone]);
      if (permitText) badgeContainer.add(permitText);
      badgeContainer.setName(SCREEN_LABEL_NAME);
      this.lockedBadge = badgeContainer;
      this.lockedBadgeCenter = growsWide ? centerX : centerY;
      this.lockedBadgeHalfExtent = growsWide ? badgeW / 2 : badgeH / 2;
      this.applyBadgeLayout();
      plotContainer.add(badgeContainer);

      this.lockedPlotsContainer.add(plotContainer);

      // Oyuncuyu tek tek ilerletmek için sadece ilk kilitli parseli detaylı çiz
      break;
    }
  }

  /**
   * Para değiştikçe çağrılır: sıradaki parselin alınabilirliği değiştiyse rozeti
   * yeniden çizer (yeterli para birikince rozet yeşile dönsün).
   */
  syncLockedPlotAffordability(): void {
    if (this.lockedPlotState === null) return;

    const nextPlot = FACTORY_PLOTS.find((plot) => !this.economy.isPlotUnlocked(plot.index));
    if (!nextPlot) return;

    if (this.computeLockedPlotState(nextPlot) !== this.lockedPlotState) {
      const { width, height } = this.economy.getCurrentFactoryDimensions();
      this.renderLockedPlots(width, height);
    }
  }

  /** Rozetin görünümünü belirleyen durum: para yetiyor mu ve beklenen menzil izni */
  private computeLockedPlotState(plot: PlotDefinition): string {
    return `${this.economy.canAfford(plot.cost)}|${this.getPlotPermitLabel?.(plot.index) ?? ''}`;
  }

  // -------------------------------------------------------------
  // METRİKLER VE BOYUT SORGULARI
  // -------------------------------------------------------------

  getActivePixelWidth(): number {
    const { width } = this.economy.getCurrentFactoryDimensions();
    return width * this.tileSize;
  }

  getActivePixelHeight(): number {
    const { height } = this.economy.getCurrentFactoryDimensions();
    return height * this.tileSize;
  }

  /**
   * Kameranın gezebileceği içerik alanı: aktif fabrika ile sıradaki kilitli
   * parselin (satın alma rozeti dahil) kapladığı dikdörtgen.
   */
  getContentPixelSize(): { width: number; height: number } {
    let width = this.getActivePixelWidth();
    let height = this.getActivePixelHeight();

    const nextPlot = FACTORY_PLOTS.find((plot) => !this.economy.isPlotUnlocked(plot.index));
    if (nextPlot) {
      width = Math.max(width, nextPlot.targetWidth * this.tileSize);
      height = Math.max(height, nextPlot.targetHeight * this.tileSize);
    }
    return { width, height };
  }

  getBounds(): { x: number; y: number; width: number; height: number } {
    return {
      x: this.originX,
      y: this.originY,
      width: this.getActivePixelWidth(),
      height: this.getActivePixelHeight(),
    };
  }

  // -------------------------------------------------------------
  // TEMİZLİK VE İMHA (DISPOSAL)
  // -------------------------------------------------------------

  destroy(): void {
    this.scene.input.off('pointerup', this.disarmFloorPress, this);
    this.rootContainer.destroy(true);
  }
}
