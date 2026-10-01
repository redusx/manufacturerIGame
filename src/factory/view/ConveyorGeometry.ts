/* ======================================================================
 * src/factory/view/ConveyorGeometry.ts — Konveyör Geometrisi ve Dönemeç Matematiği
 *
 * Fabrika konveyör hatlarındaki düz döşemeler, 90 derecelik sağ/sol dönemeçler,
 * T-ayırıcılar (Splitter) ve T-birleştiriciler (Merger) için saf matematiksel
 * bağlantı tespiti, köşe sınıflaması ve Bézier eğrisi üzerinde eşya konum
 * enterpolasyonu sağlar.
 *
 * Saf TypeScript — Phaser bağımlılığı yoktur; Node 24 native testleriyle
 * %100 test edilebilir.
 * ====================================================================== */

import {
  DIRECTION_VECTORS,
  OPPOSITE_DIRECTIONS,
  type Direction,
  type GridCoord,
} from '../types.ts';

/** Konveyör hücre şekil sınıflaması */
export type ConveyorShape =
  | 'STRAIGHT'
  | 'CORNER_LEFT'
  | 'CORNER_RIGHT'
  | 'T_MERGE'
  | 'T_SPLIT';

/** Dönüş yönü türü */
export type TurnType = 'NONE' | 'LEFT' | 'RIGHT';

/** Bir konveyör hücresinin detaylı geometrik analiz sonucu */
export interface ConveyorTurnInfo {
  coord: GridCoord;
  shape: ConveyorShape;
  /** Giriş akış yönü (eşyanın geldiği kenar, örn. WEST'ten gelip Doğuya akar) */
  inDir: Direction;
  /** Çıkış akış yönü (eşyanın ilerlediği yön) */
  outDir: Direction;
  /** Radyan cinsinden taban rotasyon açısı */
  rotationRad: number;
  /** Derece cinsinden taban rotasyon açısı (0, 90, 180, 270) */
  rotationDeg: number;
  /** 90 derecelik bir viraj mı? */
  isTurn: boolean;
  /** Dönüş yönü */
  turnType: TurnType;
  /** Bu hücreye akan tüm komşu yönleri */
  inDirs: Direction[];
  /** Bu hücreden çıkan yönler */
  outDirs: Direction[];
}

/** 2D Nokta */
export interface Point2D {
  x: number;
  y: number;
}

/** Kuadratik Bézier kontrol noktaları */
export interface CurveControlPoints {
  p0: Point2D; // Giriş kenarı noktası
  p1: Point2D; // Hücre merkezi (kontrol pivotu)
  p2: Point2D; // Çıkış kenarı noktası
}

export class ConveyorGeometry {
  /**
   * 4 ana yönü radyan cinsinden açıya dönüştürür.
   * EAST=0, SOUTH=PI/2, WEST=PI, NORTH=1.5*PI
   */
  static directionToAngleRad(dir: Direction): number {
    switch (dir) {
      case 'EAST':
        return 0;
      case 'SOUTH':
        return Math.PI * 0.5;
      case 'WEST':
        return Math.PI;
      case 'NORTH':
        return Math.PI * 1.5;
    }
  }

  /**
   * 4 ana yönü derece cinsinden açıya dönüştürür (0, 90, 180, 270).
   */
  static directionToAngleDeg(dir: Direction): number {
    switch (dir) {
      case 'EAST':
        return 0;
      case 'SOUTH':
        return 90;
      case 'WEST':
        return 180;
      case 'NORTH':
        return 270;
    }
  }

  /**
   * Ters yönü döner (NORTH <-> SOUTH, EAST <-> WEST).
   */
  static getOppositeDirection(dir: Direction): Direction {
    return OPPOSITE_DIRECTIONS[dir];
  }

  /**
   * Girdi yönü (inDir) ile çıktı yönü (outDir) arasındaki dönüş türünü hesaplar.
   * Not: inDir eşyanın GELDİĞİ kenardır. Eşya inDir'den girip OPPOSITE_DIRECTIONS[inDir] yönüne akar.
   * Örnek: inDir='WEST' ise eşya Batıdan girip Doğuya doğru hareket eder.
   *   - outDir='SOUTH' ise: Doğuya giderken Güneye (aşağı) döner = SAĞ DÖNÜŞ (RIGHT)
   *   - outDir='NORTH' ise: Doğuya giderken Kuzeye (yukarı) döner = SOL DÖNÜŞ (LEFT)
   */
  static getTurnType(inDir: Direction, outDir: Direction): TurnType {
    if (inDir === OPPOSITE_DIRECTIONS[outDir]) {
      return 'NONE';
    }

    switch (inDir) {
      case 'WEST': // Akış Doğuya doğru
        if (outDir === 'SOUTH') return 'RIGHT';
        if (outDir === 'NORTH') return 'LEFT';
        break;
      case 'NORTH': // Akış Güneye doğru
        if (outDir === 'WEST') return 'RIGHT';
        if (outDir === 'EAST') return 'LEFT';
        break;
      case 'EAST': // Akış Batıya doğru
        if (outDir === 'NORTH') return 'RIGHT';
        if (outDir === 'SOUTH') return 'LEFT';
        break;
      case 'SOUTH': // Akış Kuzeye doğru
        if (outDir === 'EAST') return 'RIGHT';
        if (outDir === 'WEST') return 'LEFT';
        break;
    }

    return 'NONE';
  }

  /**
   * Verilen bir konveyör hücresine doğru bakan (eşya aktaran) komşu yönleri bulur.
   * Dönen yönler, eşyanın HANGİ YÖNDEN geldiğini (inDir) ifade eder.
   *
   * @param coord Hedef konveyör koordinatı
   * @param neighbors Komşu konveyör veya port listesi
   */
  static getIncomingDirections(
    coord: GridCoord,
    neighbors: { coord: GridCoord; direction: Direction }[],
  ): Direction[] {
    const incoming: Direction[] = [];

    for (const neighbor of neighbors) {
      const vec = DIRECTION_VECTORS[neighbor.direction];
      const targetX = neighbor.coord.x + vec.dx;
      const targetY = neighbor.coord.y + vec.dy;

      // Komşu tam olarak bu koordinatı hedefliyor mu?
      if (targetX === coord.x && targetY === coord.y) {
        // Komşunun koordinatından bu koordinata akış:
        // Eğer komşu solumuzdaysa (x - 1), akış Batıdan (WEST) gelmektedir.
        if (neighbor.coord.x < coord.x) {
          incoming.push('WEST');
        } else if (neighbor.coord.x > coord.x) {
          incoming.push('EAST');
        } else if (neighbor.coord.y < coord.y) {
          incoming.push('NORTH');
        } else if (neighbor.coord.y > coord.y) {
          incoming.push('SOUTH');
        }
      }
    }

    return incoming;
  }

  /**
   * Bir konveyör hücresinin tüm geometrik, dönüş ve şekil bilgilerini analiz eder.
   */
  static determineTileInfo(
    coord: GridCoord,
    outDir: Direction,
    inDirs: Direction[],
    isSplitter = false,
    isMerger = false,
    splitterOutputDirs?: [Direction, Direction],
  ): ConveyorTurnInfo {
    // Splitter ve Merger özel durumları
    if (isSplitter) {
      const primaryIn = inDirs[0] ?? OPPOSITE_DIRECTIONS[outDir];
      const outList = splitterOutputDirs ? [...splitterOutputDirs] : [outDir];
      return {
        coord,
        shape: 'T_SPLIT',
        inDir: primaryIn,
        outDir,
        rotationRad: this.directionToAngleRad(outDir),
        rotationDeg: this.directionToAngleDeg(outDir),
        isTurn: false,
        turnType: 'NONE',
        inDirs,
        outDirs: outList,
      };
    }

    if (isMerger || inDirs.length >= 2) {
      const primaryIn = inDirs[0] ?? OPPOSITE_DIRECTIONS[outDir];
      return {
        coord,
        shape: 'T_MERGE',
        inDir: primaryIn,
        outDir,
        rotationRad: this.directionToAngleRad(outDir),
        rotationDeg: this.directionToAngleDeg(outDir),
        isTurn: false,
        turnType: 'NONE',
        inDirs,
        outDirs: [outDir],
      };
    }

    // Tek girdili veya girdisiz (başlangıç) konveyör
    const primaryIn = inDirs[0] ?? OPPOSITE_DIRECTIONS[outDir];
    const turnType = this.getTurnType(primaryIn, outDir);

    let shape: ConveyorShape = 'STRAIGHT';
    if (turnType === 'LEFT') {
      shape = 'CORNER_LEFT';
    } else if (turnType === 'RIGHT') {
      shape = 'CORNER_RIGHT';
    }

    const isTurn = shape !== 'STRAIGHT';

    return {
      coord,
      shape,
      inDir: primaryIn,
      outDir,
      rotationRad: this.directionToAngleRad(outDir),
      rotationDeg: this.directionToAngleDeg(outDir),
      isTurn,
      turnType,
      inDirs: inDirs.length > 0 ? inDirs : [primaryIn],
      outDirs: [outDir],
    };
  }

  /**
   * Virajlı veya düz bir konveyör için Bézier eğrisi kontrol noktalarını hesaplar.
   * P0: Giriş kenarı ortası
   * P1: Hücre merkezi
   * P2: Çıkış kenarı ortası
   */
  static getCurveControlPoints(
    tileOriginX: number,
    tileOriginY: number,
    tileSize: number,
    inDir: Direction,
    outDir: Direction,
  ): CurveControlPoints {
    const halfTile = tileSize * 0.5;
    const centerX = tileOriginX + halfTile;
    const centerY = tileOriginY + halfTile;

    // P0: inDir kenarındaki giriş noktası (inDir yönünün dış kenarında)
    const inVec = DIRECTION_VECTORS[inDir];
    const p0: Point2D = {
      x: centerX + inVec.dx * halfTile,
      y: centerY + inVec.dy * halfTile,
    };

    // P1: Kontrol noktası (merkez)
    const p1: Point2D = {
      x: centerX,
      y: centerY,
    };

    // P2: outDir kenarındaki çıkış noktası
    const outVec = DIRECTION_VECTORS[outDir];
    const p2: Point2D = {
      x: centerX + outVec.dx * halfTile,
      y: centerY + outVec.dy * halfTile,
    };

    return { p0, p1, p2 };
  }

  /**
   * Verilen progress (0.0 .. 1.0) için dünya koordinatlarında eşyanın (x, y)
   * konumunu ve teğet hareket açısını (angleRad) hesaplar.
   *
   * Düz hatlarda: Doğrusal enterpolasyon (Lerp)
   * Virajlarda: Kuadratik Bézier eğrisi B(t) = (1-t)^2 P0 + 2(1-t)t P1 + t^2 P2
   * Teğet açı: B'(t) = 2(1-t)(P1 - P0) + 2t(P2 - P1)
   */
  static computeItemWorldPosition(
    tileOriginX: number,
    tileOriginY: number,
    tileSize: number,
    shape: ConveyorShape,
    inDir: Direction,
    outDir: Direction,
    progress: number,
  ): { x: number; y: number; angleRad: number } {
    const t = Math.max(0, Math.min(1, progress));
    const halfTile = tileSize * 0.5;
    const centerX = tileOriginX + halfTile;
    const centerY = tileOriginY + halfTile;

    // Düz Konveyör
    if (shape === 'STRAIGHT') {
      const outVec = DIRECTION_VECTORS[outDir];
      // Giriş kenarı = center - outVec * halfTile
      const startX = centerX - outVec.dx * halfTile;
      const startY = centerY - outVec.dy * halfTile;
      // Çıkış kenarı = center + outVec * halfTile
      const endX = centerX + outVec.dx * halfTile;
      const endY = centerY + outVec.dy * halfTile;

      const x = startX + (endX - startX) * t;
      const y = startY + (endY - startY) * t;
      const angleRad = this.directionToAngleRad(outDir);

      return {
        x: Math.round(x * 100) / 100,
        y: Math.round(y * 100) / 100,
        angleRad,
      };
    }

    // Virajlı Konveyör (Bézier enterpolasyonu)
    const { p0, p1, p2 } = this.getCurveControlPoints(
      tileOriginX,
      tileOriginY,
      tileSize,
      inDir,
      outDir,
    );

    const oneMinusT = 1.0 - t;
    const term0 = oneMinusT * oneMinusT;
    const term1 = 2.0 * oneMinusT * t;
    const term2 = t * t;

    const x = term0 * p0.x + term1 * p1.x + term2 * p2.x;
    const y = term0 * p0.y + term1 * p1.y + term2 * p2.y;

    // Türev vektörü B'(t)
    const d0x = p1.x - p0.x;
    const d0y = p1.y - p0.y;
    const d1x = p2.x - p1.x;
    const d1y = p2.y - p1.y;

    const vx = 2.0 * oneMinusT * d0x + 2.0 * t * d1x;
    const vy = 2.0 * oneMinusT * d0y + 2.0 * t * d1y;

    let angleRad = Math.atan2(vy, vx);
    if (angleRad < 0) {
      angleRad += Math.PI * 2;
    }

    return {
      x: Math.round(x * 100) / 100,
      y: Math.round(y * 100) / 100,
      angleRad,
    };
  }
}
