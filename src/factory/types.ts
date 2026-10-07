/* ======================================================================
 * src/factory/types.ts — Fabrika Simülasyonu Temel Veri Tipleri
 *
 * Bu dosya, saf simülasyon katmanının (Phaser'dan bağımsız) temel
 * arayüzlerini ve tip tanımlarını içerir.
 * ====================================================================== */

/** 4 ana yön */
export type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

/** 2D Izgara Koordinatı */
export interface GridCoord {
  x: number; // Sütun (0 .. W-1)
  y: number; // Satır (0 .. H-1)
}

/** Yön yardımcıları */
export const DIRECTION_VECTORS: Record<Direction, { dx: number; dy: number }> = {
  NORTH: { dx: 0, dy: -1 },
  EAST:  { dx: 1, dy: 0 },
  SOUTH: { dx: 0, dy: 1 },
  WEST:  { dx: -1, dy: 0 },
};

export const OPPOSITE_DIRECTIONS: Record<Direction, Direction> = {
  NORTH: 'SOUTH',
  EAST:  'WEST',
  SOUTH: 'NORTH',
  WEST:  'EAST',
};

/** 1. EŞYA TANIMI */
export interface ItemDefinition {
  /** Benzersiz kimlik (örn. 'iron_ore', 'iron_ingot', 'simple_motor') */
  id: string;
  /** Görünen ad */
  name: string;
  /** Üretim kademesi: 0=Hammadde, 1=Temel İşlenmiş, 2=Bileşen, 3=İleri, 4=Nihai */
  tier: number;
  /** Temel ihracat / satış değeri ($) */
  baseValue: number;
  /** Piksel doku anahtarı */
  spriteKey: string;
  /** Vurgu veya filtreleme rengi (hex) */
  colorTint?: number;
}

/** 2. REÇETE TANIMI */
export interface RecipeInput {
  itemId: string;
  count: number;
}

export interface RecipeOutput {
  itemId: string;
  count: number;
  /** Yan ürünler için olasılık (0.0 .. 1.0), varsayılan 1.0 */
  probability?: number;
}

export type RecipeCategory =
  | 'crushing'
  | 'smelting'
  | 'pressing'
  | 'cutting'
  | 'assembling'
  | 'refining';

export interface RecipeDefinition {
  id: string;
  name: string;
  category: RecipeCategory;
  inputs: RecipeInput[];
  outputs: RecipeOutput[];
  /** İşlem süresi (saniye) */
  processingTimeSec: number;
  /** İşlem sırasında saniye başına enerji / işletme maliyeti */
  energyCostPerSec?: number;
}

/** 3. MAKİNE PORTLARI VE TANIMI */
export type PortType = 'INPUT' | 'OUTPUT';

export interface MachinePort {
  id: string;
  type: PortType;
  /** Makine sol-üst (0, 0) hücresine göre bağıl koordinat */
  localX: number;
  localY: number;
  /** Portun baktığı yön (0 derece rotasyondayken) */
  direction: Direction;
  /** Yalnızca belirli eşya kategorilerini kabul eden isteğe bağlı filtre */
  filterItemId?: string;
}

export interface MachineDefinition {
  id: string;
  name: string;
  description: string;
  /** Izgarada kapladığı hücre genişliği */
  width: number;
  /** Izgarada kapladığı hücre yüksekliği */
  height: number;
  category: RecipeCategory;
  /** İlk satın alma maliyeti ($) */
  baseCost: number;
  /** Bu makinenin çalıştırabildiği reçetelerin ID listesi */
  supportedRecipeIds: string[];
  /** Fiziksel giriş/çıkış portları */
  ports: MachinePort[];
  /** Görsel taban sprite dokusu */
  spriteBaseKey: string;
  /** Varsa çalışan hareketli parça dokusu */
  spriteActiveKey?: string;
  /** Her bir girdi eşyası türü için maksimum dahili tampon kapasitesi */
  inputBufferCapacity: number;
  /** Çıktı tamponu kapasitesi */
  outputBufferCapacity: number;
}

/** 4. ÇALIŞMA ZAMANI MAKİNE DURUMU */
export type MachineOperationalStatus =
  | 'IDLE'            // Reçete yok, devre dışı veya kapatılmış
  | 'WAITING_INPUT'   // Reçete girdileri eksik (girdi açlığı)
  | 'PROCESSING'      // Normal üretim devam ediyor
  | 'BLOCKED_OUTPUT'; // Çıkış portu tıkalı veya tampon dolu

export interface MachineEntityState {
  instanceId: string;
  defId: string;
  coord: GridCoord;
  rotation: 0 | 90 | 180 | 270;
  activeRecipeId: string | null;
  status: MachineOperationalStatus;
  progressSec: number;
  inputBuffer: Record<string, number>;
  outputBuffer: Record<string, number>;
  /** İncremental makine geliştirme seviyesi (varsayılan 1) */
  level?: number;
}

/** 5. ÇALIŞMA ZAMANI KONVEYÖR DURUMU */
export interface ConveyorSlot {
  itemId: string;
  /** 0.0 (giriş) .. 1.0 (çıkış ucu) */
  progress: number;
}

export interface ConveyorEntityState {
  coord: GridCoord;
  direction: Direction;
  speed?: number;
  isSplitter?: boolean;
  isMerger?: boolean;
  /** Bant üzerindeki eşyalar (en fazla 2 adet) */
  slots: ConveyorSlot[];
  /** Splitter iki çıkış yönü */
  splitterOutputDirs?: [Direction, Direction];
  /** Merger iki giriş yönü */
  mergerInputDirs?: [Direction, Direction];
}

/** 6. EKONOMİ VE KAYIT DURUMU */
export interface EconomyState {
  money: number;
  totalEarned: number;
  unlockedPlots: number[];
  revenueMultiplier: number;
  /** Kayıt anındaki ölçülmüş ihracat geliri ($/sn); çevrimdışı gelir bununla hesaplanır */
  revenuePerSec?: number;
}

export interface IntakeCellData {
  coord: GridCoord;
  itemId: string;
  intervalSec: number;
  timerSec?: number;
  /** Hammaddenin çıktığı kenar; eski kayıtlarda yoktur */
  direction?: Direction;
}

/** 7. FABRİKA SERİLEŞTİRME MODELİ */
export interface FactorySaveData {
  version: number;
  timestamp: number;
  levelId?: string;
  factoryWidth: number;
  factoryHeight: number;
  /** Sabit ızgara nesneleri */
  obstacles?: GridCoord[];
  intakes?: IntakeCellData[];
  exports?: GridCoord[];
  /** Çalışma zamanı varlıkları */
  machines: MachineEntityState[];
  conveyors: ConveyorEntityState[];
  /** İncremental ekonomi durumu */
  economy: EconomyState;
  /** Kolay erişim için cüzdan bakiyesi (economy.money ile aynı) */
  money: number;
  /** İlerleme kayıtları */
  completedMilestones?: string[];
  completedContractIds?: string[];
  unlockedTechIds?: string[];
}

