/* ======================================================================
 * src/factory/view/ConveyorRenderer.ts — 2D Konveyör Görselleştirme Katmanı
 *
 * Fabrika lojistik ağındaki (LogisticsNetwork) tüm konveyör hatlarını,
 * 90 derecelik virajları/dönemeçleri, Splitter ve Merger ünitelerini
 * Phaser 3 sahnesinde animasyonlu, kesintisiz kayan piksel-art dokularla
 * (`conveyor_belt.png`) görselleştirir.
 *
 * docs/ART_DIRECTION.md ve src/ui/theme.ts standartlarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { Direction, GridCoord } from '../types.ts';
import { ConveyorBelt } from '../simulation/ConveyorBelt.ts';
import { LogisticsNetwork } from '../simulation/LogisticsNetwork.ts';
import { GridMap } from '../simulation/GridMap.ts';
import {
  ConveyorGeometry,
  type ConveyorShape,
  type ConveyorTurnInfo,
} from './ConveyorGeometry.ts';
import { GridCoordinates } from './GridCoordinates.ts';
import { PALETTE } from '../../ui/theme.ts';
import { bindWorldTap } from '../input/WorldPointer.ts';

export interface ConveyorRendererConfig {
  tileSize?: number;
  originX?: number;
  originY?: number;
}

interface ConveyorVisualItem {
  coord: GridCoord;
  turnInfo: ConveyorTurnInfo;
  container: Phaser.GameObjects.Container;
  tileSprites: Phaser.GameObjects.TileSprite[];
  speed: number;
}

/** Bir bant hücresinin çizimi için gereken bilgi (bant, ayırıcı veya birleştirici) */
interface BeltCellEntry {
  coord: GridCoord;
  direction: Direction;
  speed: number;
  isSplitter?: boolean;
  isMerger?: boolean;
  splitterOutputDirs?: [Direction, Direction];
}

/** Bir hücre değişince yeniden çizilenler: kendisi ve dört komşusu */
const REFRESH_OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [1, 0],
  [-1, 0],
  [0, 1],
  [0, -1],
];

export class ConveyorRenderer {
  readonly scene: Phaser.Scene;
  readonly network: LogisticsNetwork;
  readonly grid: GridMap;
  readonly tileSize: number;

  private originX: number;
  private originY: number;

  /** Kök Phaser Konteyneri */
  readonly rootContainer: Phaser.GameObjects.Container;

  /** Hücre anahtarına (x,y) göre aktif görsel öğeler */
  private visualItems = new Map<string, ConveyorVisualItem>();

  /** Yeniden çizilmeyi bekleyen hücreler; `update` içinde kare başına bir kez işlenir */
  private dirtyCells = new Map<string, GridCoord>();

  /** Konveyör hücresine tıklandığında tetiklenen callback */
  onConveyorClicked?: (coord: GridCoord) => void;

  /** Basış bir tıklamayı başlatabilir mi? (Araç etkinken basış araca aittir) */
  canStartClick?: () => boolean;

  constructor(
    scene: Phaser.Scene,
    network: LogisticsNetwork,
    grid: GridMap,
    config: ConveyorRendererConfig = {},
  ) {
    this.scene = scene;
    this.network = network;
    this.grid = grid;
    this.tileSize = config.tileSize ?? GridCoordinates.DEFAULT_TILE_SIZE;
    this.originX = config.originX ?? 0;
    this.originY = config.originY ?? 0;

    // Kök konteyneri oluştur
    this.rootContainer = scene.add.container(this.originX, this.originY);

    // İlk çizimi inşa et
    this.rebuild();
  }

  /** Koordinat anahtarı (x,y) */
  private coordKey(x: number, y: number): string {
    return `${x},${y}`;
  }

  // -------------------------------------------------------------
  // KONUM VE DÖNÜŞÜMLER
  // -------------------------------------------------------------

  setOrigin(x: number, y: number): void {
    this.originX = Math.round(x);
    this.originY = Math.round(y);
    this.rootContainer.setPosition(this.originX, this.originY);
  }

  // -------------------------------------------------------------
  // YENİDEN İNŞA VE GÜNCELLEME (REBUILD & UPDATE)
  // -------------------------------------------------------------

  /**
   * Tüm konveyör ağını sıfırdan analiz eder ve görsel nesneleri oluşturur.
   */
  rebuild(): void {
    // Mevcut görselleri temizle
    this.clear();

    const allBelts = this.network.getAllConveyors();
    const allSplitters = this.network.getAllSplitters();
    const allMergers = this.network.getAllMergers();

    // Tüm konveyör hücrelerini topla
    const beltList: BeltCellEntry[] = [];

    for (const b of allBelts) {
      beltList.push({
        coord: b.coord,
        direction: b.direction,
        speed: b.speed,
      });
    }

    for (const s of allSplitters) {
      beltList.push({
        coord: s.coord,
        direction: s.outputDirections[0],
        speed: 1.0,
        isSplitter: true,
        splitterOutputDirs: s.outputDirections,
      });
    }

    for (const m of allMergers) {
      beltList.push({
        coord: m.coord,
        direction: m.outputDirection,
        speed: 1.0,
        isMerger: true,
      });
    }

    // Her bant için komşu akışını hesapla ve görselini üret
    for (const item of beltList) {
      this.createBeltVisual(item, beltList);
    }
  }

  /**
   * Bir bant döşenince, sökülünce veya dönünce çağrılır: yalnızca o hücreyi ve
   * dört komşusunu (şekli değişebilecek hücreler) yeniden çizilmek üzere işaretler.
   * Büyük fabrikada her döşemede bütün ağı yeniden kurmak takılmaya yol açar.
   *
   * Çizim bir sonraki `update` çağrısına ertelenir: aynı karede kurulup yıkılan
   * tıklanabilir nesneler Phaser'ın girdi listesinde kalır (sürükleyerek döşemede
   * bir karede birkaç bant döşenir), kare başına tek çizim bunu önler.
   */
  refreshAround(coords: readonly GridCoord[]): void {
    for (const coord of coords) {
      for (const [dx, dy] of REFRESH_OFFSETS) {
        const x = coord.x + dx;
        const y = coord.y + dy;
        this.dirtyCells.set(this.coordKey(x, y), { x, y });
      }
    }
  }

  /** İşaretlenen hücrelerin görsellerini ağın güncel durumuna göre yeniden kurar */
  private flushDirtyCells(): void {
    if (this.dirtyCells.size === 0) return;
    const cells = Array.from(this.dirtyCells.values());
    this.dirtyCells.clear();

    for (const cell of cells) {
      const key = this.coordKey(cell.x, cell.y);
      const existing = this.visualItems.get(key);
      if (existing) {
        existing.container.destroy();
        this.visualItems.delete(key);
      }

      const entry = this.describeCell(cell.x, cell.y);
      if (!entry) continue;
      // Şekli belirleyen yalnız dört komşudan gelen akıştır
      const neighbors: BeltCellEntry[] = [];
      for (const [dx, dy] of REFRESH_OFFSETS) {
        if (dx === 0 && dy === 0) continue;
        const neighbor = this.describeCell(cell.x + dx, cell.y + dy);
        if (neighbor) neighbors.push(neighbor);
      }
      this.createBeltVisual(entry, neighbors);
    }
  }

  /** Hücredeki bant, ayırıcı veya birleştiricinin çizim bilgisi; boşsa null */
  private describeCell(x: number, y: number): BeltCellEntry | null {
    const belt = this.network.getConveyor(x, y);
    if (belt) return { coord: belt.coord, direction: belt.direction, speed: belt.speed };

    const splitter = this.network.getSplitter(x, y);
    if (splitter) {
      return {
        coord: splitter.coord,
        direction: splitter.outputDirections[0],
        speed: 1.0,
        isSplitter: true,
        splitterOutputDirs: splitter.outputDirections,
      };
    }

    const merger = this.network.getMerger(x, y);
    if (merger) return { coord: merger.coord, direction: merger.outputDirection, speed: 1.0, isMerger: true };

    return null;
  }

  /**
   * Tekil bir konveyör hücresinin görselini inşa eder.
   */
  private createBeltVisual(
    item: BeltCellEntry,
    allBelts: { coord: GridCoord; direction: Direction }[],
  ): void {
    const { x, y } = item.coord;
    const key = this.coordKey(x, y);

    // Komşulardan gelen akış yönlerini belirle
    const incomingDirs = ConveyorGeometry.getIncomingDirections(item.coord, allBelts);

    // Geometrik analiz ve şekil tespiti
    const turnInfo = ConveyorGeometry.determineTileInfo(
      item.coord,
      item.direction,
      incomingDirs,
      item.isSplitter,
      item.isMerger,
      item.splitterOutputDirs,
    );

    const world = GridCoordinates.gridToWorldCenter(
      item.coord,
      this.tileSize,
      0,
      0,
    );

    const cellContainer = this.scene.add.container(world.x, world.y);
    const tileSprites: Phaser.GameObjects.TileSprite[] = [];

    // 1. Zemin Yatak Plakası (Çelik taban şasisi)
    const baseBed = this.scene.add.rectangle(
      0,
      0,
      this.tileSize - 2,
      this.tileSize - 2,
      PALETTE.borderDark,
    );
    cellContainer.add(baseBed);

    const hasTexture = this.scene.textures.exists('conveyor_belt');

    // 2. Şekle göre bant render et
    if (turnInfo.shape === 'STRAIGHT') {
      // Düz Hat
      if (hasTexture) {
        // conveyor_belt 32x24 karo dokusu
        const sprite = this.scene.add.tileSprite(
          0,
          0,
          this.tileSize,
          24,
          'conveyor_belt',
        );
        sprite.setOrigin(0.5, 0.5);
        sprite.setRotation(turnInfo.rotationRad);
        cellContainer.add(sprite);
        tileSprites.push(sprite);
      } else {
        // Fallback dokusuz görünüm
        const fallback = this.scene.add.rectangle(0, 0, this.tileSize, 20, PALETTE.panelBg);
        fallback.setRotation(turnInfo.rotationRad);
        cellContainer.add(fallback);
      }
    } else if (turnInfo.shape === 'CORNER_LEFT' || turnInfo.shape === 'CORNER_RIGHT') {
      // 90 Derecelik Viraj (Köşe)
      // Giriş yarım-bandı: Girdiği kenardan merkeze kadar (16x24)
      const inAngle = ConveyorGeometry.directionToAngleRad(
        ConveyorGeometry.getOppositeDirection(turnInfo.inDir),
      );
      // Çıkış yarım-bandı: Merkezden çıktığı kenara kadar (16x24)
      const outAngle = turnInfo.rotationRad;

      if (hasTexture) {
        // 1. Giriş yarım-şeridi (merkezden geriye doğru)
        const inVec = ConveyorGeometry.getOppositeDirection(turnInfo.inDir);
        const inDelta = ConveyorGeometry.directionToAngleDeg(inVec);
        const inSprite = this.scene.add.tileSprite(0, 0, this.tileSize * 0.5, 24, 'conveyor_belt');
        inSprite.setOrigin(1.0, 0.5); // Ucu merkezde
        inSprite.setRotation(inAngle);
        cellContainer.add(inSprite);
        tileSprites.push(inSprite);

        // 2. Çıkış yarım-şeridi (merkezden ileriye doğru)
        const outSprite = this.scene.add.tileSprite(0, 0, this.tileSize * 0.5, 24, 'conveyor_belt');
        outSprite.setOrigin(0.0, 0.5); // Başı merkezde
        outSprite.setRotation(outAngle);
        cellContainer.add(outSprite);
        tileSprites.push(outSprite);
      } else {
        const cornerPlate = this.scene.add.rectangle(0, 0, 20, 20, PALETTE.panelBg);
        cellContainer.add(cornerPlate);
      }

      // Viraj dış kenar koruma kıvrımı (Industrial guide bevel)
      const guideMarker = this.scene.add.rectangle(
        0,
        0,
        6,
        6,
        turnInfo.turnType === 'RIGHT' ? PALETTE.warningOrange : PALETTE.rocketCyan,
      );
      guideMarker.setOrigin(0.5, 0.5);
      cellContainer.add(guideMarker);
    } else if (turnInfo.shape === 'T_SPLIT') {
      // Splitter (Ayırıcı)
      if (hasTexture) {
        const sprite = this.scene.add.tileSprite(0, 0, this.tileSize, 24, 'conveyor_belt');
        sprite.setOrigin(0.5, 0.5);
        sprite.setRotation(turnInfo.rotationRad);
        cellContainer.add(sprite);
        tileSprites.push(sprite);
      }
      // Ayrım çatallanma ikaz göstergesi
      const splitBadge = this.scene.add.rectangle(0, 0, 8, 8, PALETTE.resourceGold);
      cellContainer.add(splitBadge);
    } else if (turnInfo.shape === 'T_MERGE') {
      // Merger (Birleştirici)
      if (hasTexture) {
        const sprite = this.scene.add.tileSprite(0, 0, this.tileSize, 24, 'conveyor_belt');
        sprite.setOrigin(0.5, 0.5);
        sprite.setRotation(turnInfo.rotationRad);
        cellContainer.add(sprite);
        tileSprites.push(sprite);
      }
      // Birleşme huni ikaz göstergesi
      const mergeBadge = this.scene.add.rectangle(0, 0, 8, 8, PALETTE.rocketCyan);
      cellContainer.add(mergeBadge);
    }

    // 3. Etkileşim Bölgesi (Tıklama desteği)
    const hitZone = this.scene.add.zone(0, 0, this.tileSize, this.tileSize);
    hitZone.setInteractive({ useHandCursor: true });
    bindWorldTap(
      hitZone,
      () => {
        if (this.onConveyorClicked) {
          this.onConveyorClicked({ x, y });
        }
      },
      () => (this.canStartClick ? this.canStartClick() : true),
    );
    cellContainer.add(hitZone);

    this.rootContainer.add(cellContainer);

    this.visualItems.set(key, {
      coord: { x, y },
      turnInfo,
      container: cellContainer,
      tileSprites,
      speed: item.speed,
    });
  }

  /**
   * Her karede (frame) çağrılır.
   * Aktif konveyörlerin üzerindeki dokuları (tilePositionX) hızlarına
   * göre ileri doğru kaydırarak kesintisiz akış animasyonu üretir.
   *
   * @param dt Geçen süre (saniye cinsinden, örn. 0.016s)
   */
  update(dt: number): void {
    this.flushDirtyCells();
    if (dt <= 0) return;

    for (const item of this.visualItems.values()) {
      // Hız: 1.0 tile/sec => saniyede tileSize (32px) kayma
      const scrollStep = item.speed * dt * this.tileSize;

      for (const sprite of item.tileSprites) {
        // İleriye doğru kayma: tilePositionX azalır
        sprite.tilePositionX -= scrollStep;
      }
    }
  }

  /**
   * Belirli bir hücredeki konveyörün geometrisini ve yönelimini sorgular.
   */
  getTurnInfo(x: number, y: number): ConveyorTurnInfo | undefined {
    return this.visualItems.get(this.coordKey(x, y))?.turnInfo;
  }

  /**
   * Tüm görsel öğeleri temizler.
   */
  clear(): void {
    this.dirtyCells.clear();
    for (const item of this.visualItems.values()) {
      item.container.destroy();
    }
    this.visualItems.clear();
    this.rootContainer.removeAll(true);
  }

  /**
   * Render sistemini tamamen imha eder.
   */
  destroy(): void {
    this.clear();
    this.rootContainer.destroy();
  }
}
