# DATA_MODEL.md — Manufacturer Veri Modeli ve Tipler

> **Bu dosya, fabrikadaki tüm veri yapılarını, JSON kayıt şemasını ve TypeScript arayüzlerini tanımlar.**

---

## 1. Temel Tipler ve Arayüzler (`src/factory/types.ts`)

```typescript
export type Direction = 'NORTH' | 'EAST' | 'SOUTH' | 'WEST';

export interface GridCoord {
  x: number; // 0 .. W-1
  y: number; // 0 .. H-1
}

export interface ItemDefinition {
  id: string;
  name: string;
  tier: number;
  baseValue: number;
  spriteKey: string;
  colorTint?: number;
}

export interface RecipeInput {
  itemId: string;
  count: number;
}

export interface RecipeOutput {
  itemId: string;
  count: number;
  probability?: number;
}

export interface RecipeDefinition {
  id: string;
  name: string;
  category: 'crushing' | 'smelting' | 'pressing' | 'cutting' | 'assembling' | 'refining';
  inputs: RecipeInput[];
  outputs: RecipeOutput[];
  processingTimeSec: number;
  energyCostPerSec?: number;
}

export interface MachinePort {
  id: string;
  type: 'INPUT' | 'OUTPUT';
  localX: number;
  localY: number;
  direction: Direction;
}

export interface MachineDefinition {
  id: string;
  name: string;
  description: string;
  width: number;
  height: number;
  category: RecipeDefinition['category'];
  baseCost: number;
  supportedRecipeIds: string[];
  ports: MachinePort[];
  spriteBaseKey: string;
  spriteActiveKey?: string;
  inputBufferCapacity: number;
  outputBufferCapacity: number;
}

export type MachineOperationalStatus = 
  | 'IDLE' 
  | 'WAITING_INPUT' 
  | 'PROCESSING' 
  | 'BLOCKED_OUTPUT';

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
}

export interface ConveyorEntityState {
  coord: GridCoord;
  direction: Direction;
  isSplitter?: boolean;
  isMerger?: boolean;
  slots: Array<{
    itemId: string;
    progress: number;
  }>;
}

export interface FactorySaveData {
  version: number;
  timestamp: number;
  levelId: string;
  money: number;
  factoryWidth: number;
  factoryHeight: number;
  machines: MachineEntityState[];
  conveyors: ConveyorEntityState[];
  completedContractIds: string[];
  unlockedTechIds: string[];
}
```
