/* ======================================================================
 * BeltStepper.ts — Dokunmatikte adım adım bant döşeme düğmeleri
 *
 * Bir bant döşendikten sonra hayalet, bandın aktığı sıradaki hücreye geçer
 * ve çevresinde ok düğmeleri belirir:
 *  - Sıradaki hücrenin çevresindeki yeşil oklar: o hücreye, okun yönüne
 *    bakan bir bant döşer ve hayaleti bir adım daha ilerletir (düz ya da viraj).
 *  - Son döşenen bandın iki yanındaki mavi oklar: o bandı sola/sağa çevirir.
 * Düğmeler arayüz katmanındadır; kamera kaysa da yakınlaşsa da en az 44
 * birimlik dokunma alanıyla hücrelerin çevresinde kalır.
 * ====================================================================== */

import Phaser from 'phaser';
import { DIRECTION_VECTORS, type Direction, type GridCoord } from '../factory/types.ts';
import { ConveyorGeometry } from '../factory/view/ConveyorGeometry.ts';
import { uiIcon } from './theme.ts';
import { UiButton } from './system/UiButton.ts';
import type { UiLayer } from './system/UiLayer.ts';

const BUTTON_SIZE = 44;
/** Düğme merkezinin hücre kenarından uzaklığı (arayüz birimi) */
const EDGE_GAP = 28;

export interface BeltStepperState {
  /** Son döşenen bant */
  last: GridCoord;
  lastDirection: Direction;
  /** Sıradaki hücreye bant döşenebiliyor mu? (boş ve açık alanın içinde) */
  canAdvance: boolean;
}

export interface BeltStepperCallbacks {
  /** Sıradaki hücreye `direction` yönünde bant döşe */
  onAdvance: (direction: Direction) => void;
  /** Son bandı `direction` yönüne çevir */
  onTurnLast: (direction: Direction) => void;
  /** Hücre merkezinin arayüzdeki konumu ve bir hücrenin arayüzdeki kenar uzunluğu */
  cellToUi: (coord: GridCoord) => { x: number; y: number; size: number };
}

const CW: Readonly<Record<Direction, Direction>> = { NORTH: 'EAST', EAST: 'SOUTH', SOUTH: 'WEST', WEST: 'NORTH' };
const CCW: Readonly<Record<Direction, Direction>> = { NORTH: 'WEST', WEST: 'SOUTH', SOUTH: 'EAST', EAST: 'NORTH' };

export class BeltStepper {
  private readonly callbacks: BeltStepperCallbacks;
  private readonly root: Phaser.GameObjects.Container;
  /** İlerleme düğmeleri: düz, sol, sağ */
  private readonly advance: UiButton[] = [];
  /** Son bandı çevirme düğmeleri: sol, sağ */
  private readonly turn: UiButton[] = [];
  private advanceDirections: Direction[] = [];
  private turnDirections: Direction[] = [];
  private state: BeltStepperState | null = null;

  constructor(layer: UiLayer, callbacks: BeltStepperCallbacks, depth = 94) {
    this.callbacks = callbacks;
    this.root = layer.container(depth).setVisible(false);

    const make = (variant: 'primary' | 'secondary', onClick: () => void): UiButton => {
      const button = new UiButton(layer, 0, 0, {
        width: BUTTON_SIZE,
        height: BUTTON_SIZE,
        variant,
        icon: uiIcon('arrow_right'),
        iconScale: 1.5,
        onClick,
      });
      this.root.add(button);
      return button;
    };

    for (let i = 0; i < 3; i++) {
      this.advance.push(make('primary', () => this.callbacks.onAdvance(this.advanceDirections[i])));
    }
    for (let i = 0; i < 2; i++) {
      this.turn.push(make('secondary', () => this.callbacks.onTurnLast(this.turnDirections[i])));
    }
  }

  get visible(): boolean {
    return this.root.visible;
  }

  show(state: BeltStepperState): void {
    this.state = state;
    this.root.setVisible(true);
    this.reposition();
  }

  hide(): void {
    this.state = null;
    this.root.setVisible(false);
  }

  /** Kamera hareket edebildiği için her karede çağrılır */
  reposition(): void {
    const state = this.state;
    if (!state) return;

    const forward = state.lastDirection;
    const left = CCW[forward];
    const right = CW[forward];
    const forwardVec = DIRECTION_VECTORS[forward];
    const next = { x: state.last.x + forwardVec.dx, y: state.last.y + forwardVec.dy };

    // Sıradaki hücrenin çevresi: düz, sola viraj, sağa viraj
    this.advanceDirections = [forward, left, right];
    const nextUi = this.callbacks.cellToUi(next);
    this.advance.forEach((button, index) => {
      const direction = this.advanceDirections[index];
      const vec = DIRECTION_VECTORS[direction];
      const reach = nextUi.size / 2 + EDGE_GAP;
      button
        .setVisible(state.canAdvance)
        .setPosition(Math.round(nextUi.x + vec.dx * reach), Math.round(nextUi.y + vec.dy * reach));
      this.pointIcon(button, direction);
    });

    // Son bandın iki yanı (ilerleme düğmeleriyle çakışmasın diye bir düğme boyu daha dışarıda)
    this.turnDirections = [left, right];
    const lastUi = this.callbacks.cellToUi(state.last);
    this.turn.forEach((button, index) => {
      const direction = this.turnDirections[index];
      const vec = DIRECTION_VECTORS[direction];
      const reach = lastUi.size / 2 + EDGE_GAP + BUTTON_SIZE + 4;
      button.setPosition(Math.round(lastUi.x + vec.dx * reach), Math.round(lastUi.y + vec.dy * reach));
      this.pointIcon(button, direction);
    });
  }

  private pointIcon(button: UiButton, direction: Direction): void {
    button.setIconRotation(ConveyorGeometry.directionToAngleRad(direction));
  }
}
