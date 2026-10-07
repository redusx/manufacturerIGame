/* ======================================================================
 * RotationPreview.ts — Yön seçme önizlemesi
 *
 * Yerleştirme sırasında "döndür" düğmesine basılınca fabrika alanını
 * karartır ve seçili makineyi (ya da hammadde girişini) ortada büyük
 * gösterir. Her döndürmede giriş (yeşil) ve çıkış (turuncu) okları yeni
 * yöne geçer; oyuncu yönü küçük hayalete bakmadan seçer, onaylayınca
 * önizleme kapanır ve yerleştirmeye dönülür.
 * ====================================================================== */

import Phaser from 'phaser';
import {
  DIRECTION_VECTORS,
  OPPOSITE_DIRECTIONS,
  type Direction,
  type MachineDefinition,
} from '../factory/types.ts';
import { PlacementMath } from '../factory/input/PlacementMath.ts';
import { ConveyorGeometry } from '../factory/view/ConveyorGeometry.ts';
import {
  MACHINE_SPRITE_TILE,
  PORT_ARROW_IN,
  PORT_ARROW_OUT,
  machineTextureKey,
} from '../factory/view/MachineSprites.ts';
import { SEMANTIC, SPACE } from './theme.ts';
import type { UiLayer } from './system/UiLayer.ts';

const DIRECTION_NAMES: Readonly<Record<Direction, string>> = {
  NORTH: 'kuzey (yukarı)',
  EAST: 'doğu (sağ)',
  SOUTH: 'güney (aşağı)',
  WEST: 'batı (sol)',
};

/** Önizlenen şey: makine tanımı veya hammadde girişi */
export type RotationPreviewSubject =
  | { kind: 'machine'; def: MachineDefinition }
  | { kind: 'intake' };

export class RotationPreview {
  private readonly layer: UiLayer;
  private readonly root: Phaser.GameObjects.Container;
  private readonly backdrop: Phaser.GameObjects.Rectangle;
  private readonly stage: Phaser.GameObjects.Container;
  private readonly sprite: Phaser.GameObjects.Image;
  private readonly arrows: Phaser.GameObjects.Image[] = [];
  private readonly title: Phaser.GameObjects.Text;
  private readonly caption: Phaser.GameObjects.Text;

  private subject: RotationPreviewSubject | null = null;
  private signature = '';
  private top = 0;
  private bottom = 100;

  constructor(layer: UiLayer, depth = 96) {
    this.layer = layer;
    const scene = layer.scene;
    this.root = layer.container(depth).setVisible(false);

    // Opak karartma; fabrikaya giden dokunuşları da keser
    this.backdrop = scene.add.rectangle(0, 0, 10, 10, 0x05070e, 0.9).setOrigin(0, 0).setInteractive();
    this.stage = scene.add.container(0, 0);
    this.sprite = scene.add.image(0, 0, PORT_ARROW_OUT).setOrigin(0.5);
    this.stage.add(this.sprite);
    this.title = layer.text(0, 0, 'YÖN SEÇ', 'heading', { color: SEMANTIC.moneyHex }).setOrigin(0.5);
    this.caption = layer
      .text(0, 0, '', 'body', { color: SEMANTIC.textPrimary, align: 'center' })
      .setOrigin(0.5, 0);
    this.root.add([this.backdrop, this.stage, this.title, this.caption]);
  }

  get visible(): boolean {
    return this.root.visible;
  }

  /** Önizlemenin kaplayacağı dikey aralık (HUD'un altı ile araç çubuğunun üstü) */
  layout(top: number, bottom: number): void {
    this.top = top;
    this.bottom = bottom;
    this.signature = '';
    if (this.visible && this.subject) this.render(this.lastDirection);
  }

  private lastDirection: Direction = 'NORTH';

  show(subject: RotationPreviewSubject, direction: Direction): void {
    this.subject = subject;
    this.signature = '';
    this.root.setVisible(true);
    this.render(direction);
  }

  /** Yön değiştiyse görseli günceller (her karede çağrılabilir) */
  sync(direction: Direction): void {
    if (this.visible) this.render(direction);
  }

  hide(): void {
    this.subject = null;
    this.root.setVisible(false);
  }

  private render(direction: Direction): void {
    const subject = this.subject;
    if (!subject) return;
    this.lastDirection = direction;

    const m = this.layer.metrics;
    const signature = `${direction}|${m.width}|${this.top}|${this.bottom}`;
    if (signature === this.signature) return;
    this.signature = signature;

    const height = Math.max(1, this.bottom - this.top);
    this.root.setPosition(0, this.top);
    this.backdrop.setSize(m.width, height);
    const hit = this.backdrop.input?.hitArea as Phaser.Geom.Rectangle | undefined;
    hit?.setSize(m.width, height);

    // Gövde ve portlar (dünya pikseli cinsinden, sonra tamsayı ölçekle büyütülür)
    let pixelW = MACHINE_SPRITE_TILE;
    let pixelH = MACHINE_SPRITE_TILE;
    let ports: Array<{ type: 'INPUT' | 'OUTPUT'; direction: Direction; x: number; y: number }>;

    if (subject.kind === 'machine') {
      const rotationDeg = PlacementMath.directionToRotationDeg(direction);
      const footprint = PlacementMath.getEffectiveFootprint(
        { width: subject.def.width, height: subject.def.height },
        direction,
      );
      pixelW = footprint.width * MACHINE_SPRITE_TILE;
      pixelH = footprint.height * MACHINE_SPRITE_TILE;
      this.sprite.setTexture(machineTextureKey(subject.def, rotationDeg), 0);
      ports = PlacementMath.computePreviewWorldPorts(subject.def, { x: 0, y: 0 }, direction).map((port) => ({
        type: port.type,
        direction: port.direction,
        x: port.localCoord.x,
        y: port.localCoord.y,
      }));
    } else {
      this.sprite.setTexture('factory_intake');
      ports = [{ type: 'OUTPUT', direction, x: 0, y: 0 }];
    }
    this.sprite.setDisplaySize(pixelW, pixelH);

    while (this.arrows.length < ports.length) {
      const arrow = this.layer.scene.add.image(0, 0, PORT_ARROW_IN).setOrigin(0.5);
      this.stage.add(arrow);
      this.arrows.push(arrow);
    }
    const half = MACHINE_SPRITE_TILE / 2;
    this.arrows.forEach((arrow, index) => {
      const port = ports[index];
      if (!port) {
        arrow.setVisible(false);
        return;
      }
      const vec = DIRECTION_VECTORS[port.direction];
      const isInput = port.type === 'INPUT';
      const flow = isInput ? OPPOSITE_DIRECTIONS[port.direction] : port.direction;
      arrow
        .setTexture(isInput ? PORT_ARROW_IN : PORT_ARROW_OUT)
        .setPosition(
          port.x * MACHINE_SPRITE_TILE + half + vec.dx * half - pixelW / 2,
          port.y * MACHINE_SPRITE_TILE + half + vec.dy * half - pixelH / 2,
        )
        .setRotation(ConveyorGeometry.directionToAngleRad(flow))
        .setVisible(true);
    });

    // Alana sığan en büyük tamsayı ölçek (oklar gövdenin dışına 7 piksel taşar)
    const textSpace = 76;
    const availW = m.width - SPACE.lg * 2;
    const availH = height - textSpace - SPACE.lg;
    const scale = Phaser.Math.Clamp(
      Math.floor(Math.min(availW / (pixelW + 16), availH / (pixelH + 16))),
      1,
      4,
    );
    const centerX = Math.round(m.width / 2);
    const centerY = Math.round((height - textSpace) / 2 + 26);
    this.stage.setScale(scale).setPosition(centerX, centerY);

    const stageHalfH = ((pixelH + 16) * scale) / 2;
    this.title.setPosition(centerX, Math.max(14, centerY - stageHalfH - 14));

    const outputs = ports.filter((port) => port.type === 'OUTPUT').map((port) => DIRECTION_NAMES[port.direction]);
    const text =
      subject.kind === 'machine'
        ? `Turuncu ok: ürün ${outputs.join(' ve ')} yönünde çıkar\nYeşil ok: önerilen giriş`
        : `Hammadde ${outputs[0]} yönündeki banda verilir`;
    this.caption
      .setWordWrapWidth(m.width - SPACE.lg * 2, true)
      .setText(text)
      .setPosition(centerX, centerY + stageHalfH + 4);
  }
}
