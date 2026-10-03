/* ======================================================================
 * src/ui/BuildMenuModal.ts — İnşa ve Makine Kataloğu Modalı
 *
 * Oyuncunun fabrikaya yeni konveyör bantları, akış ayırıcı/birleştiricileri
 * ve imalat makinelerini (Kırıcı, Fırın, Pres, Kesici, Montajcı, Rafineri)
 * seçip yerleştirmesini sağlayan piksel sanat 9-slice pop-up kataloğu.
 *
 * Özellikler:
 * - Kayar pencere (Scrollable viewport, GeometryMask, MouseWheel & Drag desteği)
 * - Kartların üzerinde gerçek piksel sanat makine görselleri ve boyut rozetleri
 * - İki sütunlu düzen, şık piksel kaydırma çubuğu (scrollbar)
 * - Tıklama yalıtımı: Sadece dışarı veya [X] butonuna tıklandığında kapanır.
 *
 * docs/ART_DIRECTION.md ve src/ui/theme.ts standartlarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { MachineDefinition } from '../factory/types.ts';
import { defaultMachineRegistry } from '../factory/simulation/MachineRegistry.ts';
import {
  CONVEYOR_BUILD_COST,
  SPLITTER_BUILD_COST,
  MERGER_BUILD_COST,
} from '../factory/input/PlacementMath.ts';
import type { PlacementItem } from '../factory/input/PlacementController.ts';
import type { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';
import { PALETTE, FONT_FAMILY, PixelUIHelper } from './theme.ts';

export interface BuildMenuModalConfig {
  onSelectItem: (item: PlacementItem) => void;
  onDemolishRequested?: () => void;
  onRelocateRequested?: () => void;
}

interface BuildCardItem {
  id: string;
  name: string;
  desc: string;
  cost: number;
  sizeStr: string;
  iconKey: string;
  item: PlacementItem;
  isRelocate?: boolean;
}

export class BuildMenuModal {
  readonly scene: Phaser.Scene;
  readonly economy: FactoryEconomy;
  readonly onSelectItem: (item: PlacementItem) => void;
  readonly onDemolishRequested?: () => void;
  readonly onRelocateRequested?: () => void;

  public container: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private panelBlocker: Phaser.GameObjects.Rectangle;
  private modalBg: Phaser.GameObjects.NineSlice;
  private titleText: Phaser.GameObjects.Text;
  private relocateBtnBg: Phaser.GameObjects.NineSlice;
  private relocateBtnText: Phaser.GameObjects.Text;
  private relocateZone: Phaser.GameObjects.Zone;
  private demolishBtnBg: Phaser.GameObjects.NineSlice;
  private demolishBtnText: Phaser.GameObjects.Text;
  private demolishZone: Phaser.GameObjects.Zone;
  private closeBtnBg: Phaser.GameObjects.NineSlice;
  private closeBtnIcon: Phaser.GameObjects.Image;
  private closeZone: Phaser.GameObjects.Zone;

  /** Kayar Pencere (Scrollable Viewport) ve Maske */
  private cardsContainer: Phaser.GameObjects.Container;
  private maskShape: Phaser.GameObjects.Graphics;
  private cardsMask: Phaser.Display.Masks.GeometryMask;

  /** Kaydırma Çubuğu (Scrollbar) */
  private scrollTrack: Phaser.GameObjects.Graphics;
  private scrollThumb: Phaser.GameObjects.Graphics;
  private scrollTrackZone: Phaser.GameObjects.Zone;

  /** Kaydırma Durumu */
  private scrollY = 0;
  private maxScrollY = 0;
  private isDraggingCards = false;
  private isDraggingScrollbar = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  /** Kart Butonları */
  private cardButtons: Array<{
    item: BuildCardItem;
    btnBg: Phaser.GameObjects.NineSlice;
    btnText: Phaser.GameObjects.Text;
    costText: Phaser.GameObjects.Text;
    zone: Phaser.GameObjects.Zone;
    btnLocalY: number;
  }> = [];

  private _isOpen = false;
  private modalW = 540;
  private modalH = 460;
  private readonly viewportY = 56;
  private readonly viewportH = 384;

  constructor(
    scene: Phaser.Scene,
    economy: FactoryEconomy,
    config: BuildMenuModalConfig,
  ) {
    this.scene = scene;
    this.economy = economy;
    this.onSelectItem = config.onSelectItem;
    this.onDemolishRequested = config.onDemolishRequested;
    this.onRelocateRequested = config.onRelocateRequested;

    this.container = scene.add.container(0, 0).setDepth(200).setVisible(false);

    // 1. Ekran Karartma Katmanı (Yalnızca modal dışına tıklanınca kapatır)
    this.backdrop = scene.add.rectangle(0, 0, 100, 100, 0x05070e, 0.75)
      .setOrigin(0, 0)
      .setInteractive()
      .on('pointerdown', () => this.hide());
    this.container.add(this.backdrop);

    // 2. Modal Gövdesi Tıklama Engelleyici (Pencere içine tıklanınca kapanmasını önler)
    this.panelBlocker = scene.add.rectangle(0, 0, this.modalW, this.modalH, 0x000000, 0.001)
      .setOrigin(0, 0)
      .setInteractive()
      .on('pointerdown', (_pointer: any, _lx: number, _ly: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation();
      });
    this.container.add(this.panelBlocker);

    // 3. Modal Gövdesi (Piksel 9-Slice Çerçeve)
    this.modalBg = PixelUIHelper.createModal(scene, 0, 0, this.modalW, this.modalH).setOrigin(0, 0);
    this.container.add(this.modalBg);

    const font = { fontFamily: FONT_FAMILY };

    // 4. Başlık
    this.titleText = scene.add.text(24, 20, 'İNŞA VE MAKİNE KATALOĞU', {
      ...font,
      fontSize: '15px',
      color: PALETTE.textPrimary,
      fontStyle: 'bold',
      stroke: '#080c18',
      strokeThickness: 2,
    }).setOrigin(0, 0);
    this.container.add(this.titleText);

    // 4.5. Taşı Butonu (Hammadde Girişi & Sevkiyat Sandığı)
    const moveX = this.modalW - 164;
    this.relocateBtnBg = PixelUIHelper.createButton(scene, moveX, 26, 64, 26, 'launch');
    this.container.add(this.relocateBtnBg);

    this.relocateBtnText = scene.add.text(moveX, 25, 'TAŞI', {
      ...font,
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.relocateBtnText);

    this.relocateZone = scene.add.zone(moveX, 26, 64, 26)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.hide();
        if (this.onRelocateRequested) this.onRelocateRequested();
      })
      .on('pointerover', () => this.relocateBtnBg.setTexture('btn_launch_pressed'))
      .on('pointerout', () => this.relocateBtnBg.setTexture('btn_launch_normal'));
    this.container.add(this.relocateZone);

    // 5. Sök / Yıkım Butonu
    const demoX = this.modalW - 90;
    this.demolishBtnBg = PixelUIHelper.createButton(scene, demoX, 26, 76, 26, 'danger');
    this.container.add(this.demolishBtnBg);

    this.demolishBtnText = scene.add.text(demoX, 25, 'SÖK (X)', {
      ...font,
      fontSize: '10px',
      color: '#ffffff',
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.demolishBtnText);

    this.demolishZone = scene.add.zone(demoX, 26, 76, 26)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.hide();
        if (this.onDemolishRequested) this.onDemolishRequested();
      })
      .on('pointerover', () => this.demolishBtnBg.setTexture('btn_danger_pressed'))
      .on('pointerout', () => this.demolishBtnBg.setTexture('btn_danger_normal'));
    this.container.add(this.demolishZone);

    // 6. Kapatma Butonu [X]
    this.closeBtnBg = PixelUIHelper.createButton(scene, this.modalW - 28, 26, 26, 26, 'danger');
    this.container.add(this.closeBtnBg);

    this.closeBtnIcon = scene.add.image(this.modalW - 28, 26, 'icon_close').setOrigin(0.5).setScale(0.9);
    this.container.add(this.closeBtnIcon);

    this.closeZone = scene.add.zone(this.modalW - 28, 26, 30, 30)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hide())
      .on('pointerover', () => this.closeBtnBg.setTexture('btn_danger_pressed'))
      .on('pointerout', () => this.closeBtnBg.setTexture('btn_danger_normal'));
    this.container.add(this.closeZone);

    // 7. Kayar Kartlar Konteyneri ve Kırpma Maskesi
    this.cardsContainer = scene.add.container(0, 0);
    this.container.add(this.cardsContainer);

    this.maskShape = scene.make.graphics();
    this.cardsMask = this.maskShape.createGeometryMask();
    this.cardsContainer.setMask(this.cardsMask);

    // 8. Kaydırma Çubuğu (Scrollbar)
    this.scrollTrack = scene.add.graphics();
    this.scrollThumb = scene.add.graphics();
    this.container.add([this.scrollTrack, this.scrollThumb]);

    this.scrollTrackZone = scene.add.zone(0, 0, 16, this.viewportH)
      .setOrigin(0, 0)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        const modalY = Math.round((this.scene.scale.height - this.modalH) / 2);
        const clickRelY = pointer.y - (modalY + this.viewportY);
        const ratio = Phaser.Math.Clamp(clickRelY / this.viewportH, 0, 1);
        this.scrollTo(ratio * this.maxScrollY);
        this.isDraggingScrollbar = true;
        this.dragStartY = pointer.y;
        this.dragStartScrollY = this.scrollY;
      });
    this.container.add(this.scrollTrackZone);

    // 9. Giriş Dinleyicileri (Fare Tekerleği ve Sürükleme)
    this.bindScrollInputs();

    // 10. Kartları İnşa Et
    this.buildCards();
  }

  private bindScrollInputs(): void {
    // Fare Tekerleği (Mouse Wheel) ile kaydırma
    this.scene.input.on('wheel', (pointer: Phaser.Input.Pointer, _over: any, _dx: number, dy: number) => {
      if (!this._isOpen) return;
      const modalX = Math.round((this.scene.scale.width - this.modalW) / 2);
      const modalY = Math.round((this.scene.scale.height - this.modalH) / 2);
      if (
        pointer.x >= modalX &&
        pointer.x <= modalX + this.modalW &&
        pointer.y >= modalY &&
        pointer.y <= modalY + this.modalH
      ) {
        this.scrollBy(dy * 0.45);
      }
    });

    // Kartlar üzerinde basılı tutup yukarı/aşağı sürükleme (Drag to scroll)
    this.scene.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!this._isOpen) return;
      const modalX = Math.round((this.scene.scale.width - this.modalW) / 2);
      const modalY = Math.round((this.scene.scale.height - this.modalH) / 2);
      if (
        pointer.x >= modalX + 16 &&
        pointer.x <= modalX + this.modalW - 24 &&
        pointer.y >= modalY + this.viewportY &&
        pointer.y <= modalY + this.viewportY + this.viewportH
      ) {
        this.isDraggingCards = true;
        this.dragStartY = pointer.y;
        this.dragStartScrollY = this.scrollY;
      }
    });

    this.scene.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this._isOpen) return;
      if (this.isDraggingScrollbar) {
        const delta = pointer.y - this.dragStartY;
        const scrollDelta = (delta / this.viewportH) * this.maxScrollY;
        this.scrollTo(this.dragStartScrollY + scrollDelta);
      } else if (this.isDraggingCards) {
        const delta = pointer.y - this.dragStartY;
        this.scrollTo(this.dragStartScrollY - delta);
      }
    });

    this.scene.input.on('pointerup', () => {
      this.isDraggingCards = false;
      this.isDraggingScrollbar = false;
    });
  }

  public scrollTo(targetY: number): void {
    this.scrollY = Phaser.Math.Clamp(targetY, 0, this.maxScrollY);
    this.updateScrollPosition();
  }

  public scrollBy(deltaY: number): void {
    this.scrollTo(this.scrollY + deltaY);
  }

  private updateScrollPosition(): void {
    const modalX = Math.round((this.scene.scale.width - this.modalW) / 2);
    const modalY = Math.round((this.scene.scale.height - this.modalH) / 2);

    this.cardsContainer.setPosition(modalX, modalY + this.viewportY - this.scrollY);
    this.drawScrollbar();
  }

  private drawScrollbar(): void {
    if (!this.scrollTrack || !this.scrollThumb) return;
    this.scrollTrack.clear();
    this.scrollThumb.clear();

    if (this.maxScrollY <= 0) {
      this.scrollTrack.setVisible(false);
      this.scrollThumb.setVisible(false);
      this.scrollTrackZone.setActive(false);
      return;
    }

    this.scrollTrack.setVisible(true);
    this.scrollThumb.setVisible(true);
    this.scrollTrackZone.setActive(true);

    const modalX = Math.round((this.scene.scale.width - this.modalW) / 2);
    const modalY = Math.round((this.scene.scale.height - this.modalH) / 2);

    const trackX = modalX + this.modalW - 14;
    const trackY = modalY + this.viewportY;
    const trackW = 6;
    const trackH = this.viewportH;

    this.scrollTrackZone.setPosition(trackX - 5, trackY);
    this.scrollTrackZone.setSize(16, trackH);

    // Kaydırma Çubuğu Arka Plan Kanalı (Track)
    this.scrollTrack.fillStyle(0x080c18, 0.9);
    this.scrollTrack.fillRoundedRect(trackX, trackY, trackW, trackH, 3);
    this.scrollTrack.lineStyle(1, 0x151d30, 0.8);
    this.scrollTrack.strokeRoundedRect(trackX, trackY, trackW, trackH, 3);

    // Kaydırma Göstergesi / Tutamacı (Thumb)
    const totalH = this.viewportH + this.maxScrollY;
    const thumbH = Math.max(28, Math.round((this.viewportH / totalH) * trackH));
    const thumbProgress = this.maxScrollY > 0 ? this.scrollY / this.maxScrollY : 0;
    const thumbY = trackY + thumbProgress * (trackH - thumbH);

    this.scrollThumb.fillStyle(0xf39c12, 0.85); // Endüstriyel Altın
    this.scrollThumb.fillRoundedRect(trackX, thumbY, trackW, thumbH, 3);
    this.scrollThumb.lineStyle(1, 0xffffff, 0.4);
    this.scrollThumb.strokeRoundedRect(trackX, thumbY, trackW, thumbH, 3);
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  show(): void {
    this._isOpen = true;
    this.container.setVisible(true);
    this.scrollTo(0);
    this.refresh();
  }

  hide(): void {
    this._isOpen = false;
    this.container.setVisible(false);
    this.isDraggingCards = false;
    this.isDraggingScrollbar = false;
  }

  ignoreCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    camera.ignore([this.container]);
  }

  private getAllBuildItems(): BuildCardItem[] {
    const items: BuildCardItem[] = [];

    // Lojistik
    items.push({
      id: 'conveyor',
      name: 'Konveyör Bandı',
      desc: 'Hammadde ve ürünleri hatlar boyunca taşır.',
      cost: CONVEYOR_BUILD_COST,
      sizeStr: '1x1',
      iconKey: 'conveyor_belt',
      item: { type: 'CONVEYOR' },
    });

    items.push({
      id: 'splitter',
      name: 'Akış Ayırıcı (Splitter)',
      desc: 'Eşyaları iki hatta dengeli (50/50) paylaştırır.',
      cost: SPLITTER_BUILD_COST,
      sizeStr: '1x1',
      iconKey: 'conveyor_belt',
      item: { type: 'SPLITTER' },
    });

    items.push({
      id: 'merger',
      name: 'Akış Birleştirici (Merger)',
      desc: 'Gelen iki lojistik hattını tek hatta birleştirir.',
      cost: MERGER_BUILD_COST,
      sizeStr: '1x1',
      iconKey: 'conveyor_belt',
      item: { type: 'MERGER' },
    });

    // Makineler
    const machines = defaultMachineRegistry.getAll();
    for (const m of machines) {
      items.push({
        id: m.id,
        name: m.name,
        desc: m.description,
        cost: m.baseCost,
        sizeStr: `${m.width}x${m.height}`,
        iconKey: m.spriteBaseKey ?? 'machine_bench',
        item: { type: 'MACHINE', machineDef: m },
      });
    }

    // Terminaller (Taşıma Seçenekleri)
    items.push({
      id: 'intake_move',
      name: 'Hammadde Giriş Silosu',
      desc: 'Ham cevher tedarik noktası. Konumunu fabrikada taşı.',
      cost: 0,
      sizeStr: '1x1',
      iconKey: 'factory_intake',
      item: { type: 'INTAKE_MOVE' },
      isRelocate: true,
    });

    items.push({
      id: 'export_move',
      name: 'Sevkiyat Sandığı',
      desc: 'Mamul ihracat ve nakit satış terminali. Konumunu taşı.',
      cost: 0,
      sizeStr: '1x1',
      iconKey: 'shipping_crate',
      item: { type: 'EXPORT_MOVE' },
      isRelocate: true,
    });

    return items;
  }

  private buildCards(): void {
    this.cardsContainer.removeAll(true);
    this.cardButtons = [];

    const items = this.getAllBuildItems();
    const font = { fontFamily: FONT_FAMILY };

    const startX = 18;
    const cardW = 240;
    const cardH = 82;
    const gapX = 14;
    const gapY = 10;
    const cols = 2;

    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      const col = i % cols;
      const row = Math.floor(i / cols);

      const cx = startX + col * (cardW + gapX);
      const cy = row * (cardH + gapY);

      // 1. Kart Arka Planı
      const cardBg = PixelUIHelper.createCard(this.scene, cx, cy, cardW, cardH).setOrigin(0, 0);
      this.cardsContainer.add(cardBg);

      // 2. Makine Görsel Kutusu (Sol Önizleme Paneli)
      const iconBoxX = cx + 8;
      const iconBoxY = cy + 8;
      const iconBoxW = 50;
      const iconBoxH = 66;

      const iconBoxBg = PixelUIHelper.createPanel(this.scene, iconBoxX, iconBoxY, iconBoxW, iconBoxH);
      this.cardsContainer.add(iconBoxBg);

      // Makine veya Konveyör Resmi
      const iconCenterX = iconBoxX + iconBoxW / 2;
      const iconCenterY = iconBoxY + 24;

      if (it.iconKey === 'conveyor_belt') {
        const sprite = this.scene.add.image(iconCenterX, iconCenterY, 'conveyor_belt')
          .setDisplaySize(34, 22)
          .setOrigin(0.5);
        this.cardsContainer.add(sprite);

        // Splitter / Merger rozeti
        if (it.id === 'splitter') {
          const splitBadge = this.scene.add.text(iconCenterX, iconCenterY - 1, '⑂', {
            ...font, fontSize: '12px', color: PALETTE.rocketCyanHex, fontStyle: 'bold',
          }).setOrigin(0.5);
          this.cardsContainer.add(splitBadge);
        } else if (it.id === 'merger') {
          const mergeBadge = this.scene.add.text(iconCenterX, iconCenterY - 1, '⑃', {
            ...font, fontSize: '12px', color: PALETTE.successGreenHex, fontStyle: 'bold',
          }).setOrigin(0.5);
          this.cardsContainer.add(mergeBadge);
        }
      } else {
        const sprite = this.scene.add.image(iconCenterX, iconCenterY, it.iconKey)
          .setDisplaySize(38, 38)
          .setOrigin(0.5);
        this.cardsContainer.add(sprite);
      }

      // Boyut Rozeti (Görsel kutusunun altında, örn. 1x1, 2x1, 2x2)
      const badge = this.scene.add.text(iconCenterX, iconBoxY + 53, it.sizeStr, {
        ...font,
        fontSize: '9px',
        color: PALETTE.resourceGoldHex,
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.cardsContainer.add(badge);

      // 3. Sağ Taraf: İsim, Açıklama, Fiyat ve Buton
      const contentX = cx + 64;

      // Başlık
      const title = this.scene.add.text(contentX, cy + 8, it.name, {
        ...font,
        fontSize: '11px',
        color: PALETTE.textPrimary,
        fontStyle: 'bold',
      });
      this.cardsContainer.add(title);

      // Açıklama
      const desc = this.scene.add.text(contentX, cy + 24, it.desc, {
        ...font,
        fontSize: '8.5px',
        color: PALETTE.textMuted,
        wordWrap: { width: cardW - 72 },
        lineSpacing: 2,
      });
      this.cardsContainer.add(desc);

      // Fiyat Etiketi
      const costLabel = it.isRelocate ? 'ÜCRETSİZ' : `$${it.cost}`;
      const costColor = it.isRelocate ? PALETTE.successGreenHex : PALETTE.resourceGoldHex;
      const costText = this.scene.add.text(contentX, cy + cardH - 10, costLabel, {
        ...font,
        fontSize: '11px',
        color: costColor,
        fontStyle: 'bold',
      }).setOrigin(0, 1);
      this.cardsContainer.add(costText);

      // İnşa / Taşı Butonu
      const btnW = 72;
      const btnH = 22;
      const btnX = cx + cardW - btnW / 2 - 8;
      const btnY = cy + cardH - btnH / 2 - 8;

      const btnStyle = it.isRelocate ? 'launch' : 'green';
      const btnLabel = it.isRelocate ? 'TAŞI' : 'İNŞA ET';

      const btnBg = PixelUIHelper.createButton(this.scene, btnX, btnY, btnW, btnH, btnStyle);
      this.cardsContainer.add(btnBg);

      const btnText = this.scene.add.text(btnX, btnY - 1, btnLabel, {
        ...font,
        fontSize: '9.5px',
        color: '#ffffff',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      this.cardsContainer.add(btnText);

      const zone = this.scene.add.zone(btnX, btnY, btnW, btnH)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => {
          // Yalnızca görünür kayar pencere alanı içindeyse tıklamayı işle
          const modalY = Math.round((this.scene.scale.height - this.modalH) / 2);
          const btnScreenY = this.cardsContainer.y + btnY;
          if (
            btnScreenY < modalY + this.viewportY - 4 ||
            btnScreenY > modalY + this.viewportY + this.viewportH + 4
          ) {
            return;
          }

          if (it.isRelocate || this.economy.canAfford(it.cost)) {
            this.hide();
            this.onSelectItem(it.item);
          }
        });
      this.cardsContainer.add(zone);

      this.cardButtons.push({
        item: it,
        btnBg,
        btnText,
        costText,
        zone,
        btnLocalY: btnY,
      });
    }

    // Toplam içerik yüksekliği ve maksimum kaydırma mesafesi
    const totalRows = Math.ceil(items.length / cols);
    const totalContentHeight = totalRows * (cardH + gapY) + 12;
    this.maxScrollY = Math.max(0, totalContentHeight - this.viewportH);
  }

  refresh(): void {
    for (const b of this.cardButtons) {
      if (b.item.isRelocate) {
        b.btnBg.setTexture('btn_launch_normal');
        b.btnText.setColor('#ffffff');
        b.costText.setColor(PALETTE.successGreenHex);
        b.zone.input?.enabled && (b.zone.input.enabled = true);
        continue;
      }

      const affordable = this.economy.canAfford(b.item.cost);
      if (affordable) {
        b.btnBg.setTexture('btn_green_normal');
        b.btnText.setColor('#ffffff');
        b.costText.setColor(PALETTE.resourceGoldHex);
        b.zone.input?.enabled && (b.zone.input.enabled = true);
      } else {
        b.btnBg.setTexture('btn_disabled');
        b.btnText.setColor('#7f8c8d');
        b.costText.setColor(PALETTE.dangerRedHex);
      }
    }
  }

  layout(screenWidth: number, screenHeight: number): void {
    this.backdrop.setSize(screenWidth, screenHeight);

    const x = Math.round((screenWidth - this.modalW) / 2);
    const y = Math.round((screenHeight - this.modalH) / 2);

    this.panelBlocker.setPosition(x, y);
    this.panelBlocker.setSize(this.modalW, this.modalH);

    this.modalBg.setPosition(x, y);
    this.modalBg.setSize(this.modalW, this.modalH);
    this.titleText.setPosition(x + 24, y + 20);

    const moveX = x + this.modalW - 164;
    this.relocateBtnBg.setPosition(moveX, y + 26);
    this.relocateBtnText.setPosition(moveX, y + 25);
    this.relocateZone.setPosition(moveX, y + 26);

    const demoX = x + this.modalW - 90;
    this.demolishBtnBg.setPosition(demoX, y + 26);
    this.demolishBtnText.setPosition(demoX, y + 25);
    this.demolishZone.setPosition(demoX, y + 26);

    const closeX = x + this.modalW - 28;
    const closeY = y + 26;
    this.closeBtnBg.setPosition(closeX, closeY);
    this.closeBtnIcon.setPosition(closeX, closeY);
    this.closeZone.setPosition(closeX, closeY);

    // Kırpma maskesini pencere konumuna göre güncelle
    this.maskShape.clear();
    this.maskShape.fillStyle(0xffffff);
    this.maskShape.fillRect(x + 10, y + this.viewportY, this.modalW - 20, this.viewportH);

    this.updateScrollPosition();
  }
}
