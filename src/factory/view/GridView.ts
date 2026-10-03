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

export { GridCoordinates };


export interface GridViewConfig {
  tileSize?: number;
  originX?: number;
  originY?: number;
}

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

    // İlk çizimi gerçekleştir
    this.refresh();
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
      .on('pointerup', (pointer: Phaser.Input.Pointer) => {
        const dragDist = Phaser.Math.Distance.Between(
          pointer.downX, pointer.downY,
          pointer.upX, pointer.upY,
        );
        if (dragDist < 6 && this.onCellClicked) {
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

      // Giriş oku veya etiket
      const inText = this.scene.add.text(
        this.tileSize / 2,
        this.tileSize / 2,
        'IN',
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

    for (const plot of FACTORY_PLOTS) {
      if (this.economy.isPlotUnlocked(plot.index)) continue;

      // Sadece bir sonraki açılabilir parseli vurgula veya tüm kilitli alanları göster
      const plotPixelW = plot.targetWidth * this.tileSize;
      const plotPixelH = plot.targetHeight * this.tileSize;

      // Kilitli alan konteyneri
      const plotContainer = this.scene.add.container(0, 0);

      // Kilitli alan gölgesi (Yarı saydam karanlık tabaka)
      const overlayGraphics = this.scene.add.graphics();
      overlayGraphics.fillStyle(PALETTE.bgDeep, 0.65);
      overlayGraphics.fillRect(0, 0, plotPixelW, plotPixelH);

      // Uyarı / Genişleme kenarlığı (Kesikli endüstriyel çizgi hissi)
      overlayGraphics.lineStyle(1, PALETTE.warningOrange, 0.7);
      overlayGraphics.strokeRect(0, 0, plotPixelW, plotPixelH);

      plotContainer.add(overlayGraphics);

      // Kilit Rozeti (Genişleyen bölgenin merkezinde)
      // Merkez koordinatı: aktif alanın dışındaki yeni bölgenin ortası
      const centerX = Math.round((activeW * this.tileSize + plotPixelW) / 2);
      const centerY = Math.round(plotPixelH / 2);

      const badgeContainer = this.scene.add.container(centerX, centerY);

      // Rozet zemin dolgusu
      const badgeW = 120;
      const badgeH = 46;
      const canAfford = this.economy.canAfford(plot.cost);
      const badgeBg = this.scene.add.rectangle(
        0,
        0,
        badgeW,
        badgeH,
        canAfford ? PALETTE.cardBg : PALETTE.btnDisabled,
      );
      badgeBg.setStrokeStyle(1, canAfford ? PALETTE.successGreen : PALETTE.borderDark);

      // Parsel Adı
      const titleText = this.scene.add.text(
        0,
        -12,
        plot.name,
        {
          fontFamily: FONT_FAMILY,
          fontSize: '9px',
          color: PALETTE.textPrimary,
        },
      );
      titleText.setOrigin(0.5, 0.5);

      // Boyut ve Maliyet
      const costStr = plot.cost > 0 ? `$${plot.cost}` : 'Ücretsiz';
      const costText = this.scene.add.text(
        0,
        4,
        `[${plot.targetWidth}x${plot.targetHeight}]  ${costStr}`,
        {
          fontFamily: FONT_FAMILY,
          fontSize: '8px',
          color: canAfford ? PALETTE.resourceGoldHex : PALETTE.textMuted,
        },
      );
      costText.setOrigin(0.5, 0.5);

      // İnteraktif tıklama alanı
      const hitZone = this.scene.add.zone(0, 0, badgeW, badgeH);
      hitZone.setInteractive({ useHandCursor: canAfford });
      hitZone.on('pointerdown', () => {
        if (this.onPlotUnlockRequested) {
          this.onPlotUnlockRequested(plot.index);
        }
      });

      badgeContainer.add([badgeBg, titleText, costText, hitZone]);
      plotContainer.add(badgeContainer);

      this.lockedPlotsContainer.add(plotContainer);

      // Oyuncuyu tek tek ilerletmek için sadece ilk kilitli parseli detaylı çiz
      break;
    }
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
    this.rootContainer.destroy(true);
  }
}
