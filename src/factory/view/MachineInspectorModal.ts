/* ======================================================================
 * src/factory/view/MachineInspectorModal.ts — Makine İnceleme ve Geliştirme Modalı
 *
 * Tıklanan makinenin durumunu, girdi ve çıktı tampon stoğunu, aktif reçetesini
 * ve seviye yükseltme ($Base * 1.15^lvl) butonunu gösteren Phaser 3 modalı.
 *
 * docs/ART_DIRECTION.md, DEC-007 ve src/ui/theme.ts standartlarına tam uyumludur.
 * ====================================================================== */

import Phaser from 'phaser';
import type { MachineEntity } from '../simulation/MachineEntity.ts';
import type { ProductionEngine } from '../simulation/ProductionEngine.ts';
import type { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { RecipeRegistry, defaultRecipeRegistry } from '../simulation/RecipeRegistry.ts';
import { ItemRegistry, defaultItemRegistry } from '../simulation/ItemRegistry.ts';
import {
  MachineInspectorHelper,
  type MachineInspectorData,
} from './MachineInspectorHelper.ts';
import { PALETTE, FONT_FAMILY, PixelUIHelper } from '../../ui/theme.ts';

export interface MachineInspectorModalConfig {
  onUpgrade?: (machine: MachineEntity, newLevel: number) => void;
  onRecipeChanged?: (machine: MachineEntity, recipeId: string) => void;
  onDemolishRequested?: (machine: MachineEntity) => void;
  onClose?: () => void;
}

export class MachineInspectorModal {
  readonly scene: Phaser.Scene;
  readonly engine: ProductionEngine;
  readonly economy: FactoryEconomy;
  readonly recipeRegistry: RecipeRegistry;
  readonly itemRegistry: ItemRegistry;

  /** Olay dinleyicileri */
  onUpgrade?: (machine: MachineEntity, newLevel: number) => void;
  onRecipeChanged?: (machine: MachineEntity, recipeId: string) => void;
  onDemolishRequested?: (machine: MachineEntity) => void;
  onClose?: () => void;

  /** İncelenen makine */
  private targetMachine: MachineEntity | null = null;
  private _isOpen = false;

  /** Boyutlar */
  private readonly MODAL_WIDTH = 380;
  private readonly MODAL_HEIGHT = 460;

  /** Görsel Bileşenler */
  readonly container: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private panelBlocker: Phaser.GameObjects.Rectangle;
  private panelGraphics: Phaser.GameObjects.Graphics;
  private bufferGraphics: Phaser.GameObjects.Graphics;

  // Başlık öğeleri
  private titleText: Phaser.GameObjects.Text;
  private levelBadgeText: Phaser.GameObjects.Text;
  private closeButtonText: Phaser.GameObjects.Text;

  // Durum ve ikon
  private machineIcon: Phaser.GameObjects.Image;
  private statusBadgeText: Phaser.GameObjects.Text;
  private speedText: Phaser.GameObjects.Text;

  // Reçete alanı
  private recipeSectionTitle: Phaser.GameObjects.Text;
  private recipeDetailsText: Phaser.GameObjects.Text;
  private recipeChipsContainer: Phaser.GameObjects.Container;

  // Tampon metinleri
  private bufferSectionTitle: Phaser.GameObjects.Text;
  private inputBufferText: Phaser.GameObjects.Text;
  private outputBufferText: Phaser.GameObjects.Text;

  // Butonlar
  private upgradeButtonBg: Phaser.GameObjects.Graphics;
  private upgradeButtonText: Phaser.GameObjects.Text;
  private upgradeButtonHitArea: Phaser.GameObjects.Rectangle;

  private demolishButtonBg: Phaser.GameObjects.Graphics;
  private demolishButtonText: Phaser.GameObjects.Text;
  private demolishButtonHitArea: Phaser.GameObjects.Rectangle;

  /** Yenileme zamanlayıcısı */
  private timeSinceLastRefresh = 0;
  private readonly REFRESH_INTERVAL_SEC = 0.1; // 100ms

  constructor(
    scene: Phaser.Scene,
    engine: ProductionEngine,
    economy: FactoryEconomy,
    config: MachineInspectorModalConfig = {},
    recipeRegistry: RecipeRegistry = defaultRecipeRegistry,
    itemRegistry: ItemRegistry = defaultItemRegistry,
  ) {
    this.scene = scene;
    this.engine = engine;
    this.economy = economy;
    this.recipeRegistry = recipeRegistry;
    this.itemRegistry = itemRegistry;

    this.onUpgrade = config.onUpgrade;
    this.onRecipeChanged = config.onRecipeChanged;
    this.onDemolishRequested = config.onDemolishRequested;
    this.onClose = config.onClose;

    // Ana konteyner (ScrollFactor 0 = ekrana sabit, Depth 200 = en üst katman)
    this.container = this.scene.add.container(0, 0).setDepth(200).setScrollFactor(0).setVisible(false);

    // 1. Karartma Perdesi (Backdrop) - Sadece dışına tıklanınca kapatır
    const { width, height } = this.scene.scale;
    this.backdrop = this.scene.add
      .rectangle(0, 0, width, height, PALETTE.modalOverlay, 0.7)
      .setOrigin(0, 0)
      .setInteractive()
      .on('pointerdown', () => this.close());

    // 2. Modal Gövdesi Tıklama Engelleyici (Pencere içine tıklanınca kapanmasını önler)
    this.panelBlocker = this.scene.add
      .rectangle(0, 0, this.MODAL_WIDTH, this.MODAL_HEIGHT, 0x000000, 0.001)
      .setOrigin(0, 0)
      .setInteractive()
      .on('pointerdown', (_pointer: any, _lx: number, _ly: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation();
      });

    // 3. Çizim Grafikleri
    this.panelGraphics = this.scene.add.graphics();
    this.bufferGraphics = this.scene.add.graphics();

    // 3. Başlık ve Kapatma Butonu
    this.titleText = this.scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '12px',
      color: PALETTE.textPrimary,
    });

    this.levelBadgeText = this.scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: PALETTE.resourceGoldHex,
    });

    this.closeButtonText = this.scene.add
      .text(0, 0, '[X]', {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: PALETTE.textMuted,
      })
      .setInteractive({ useHandCursor: true })
      .on('pointerover', () => this.closeButtonText.setColor(PALETTE.dangerRedHex))
      .on('pointerout', () => this.closeButtonText.setColor(PALETTE.textMuted))
      .on('pointerdown', () => this.close());

    // 4. Makine İkonu ve Durum Bilgileri
    this.machineIcon = this.scene.add.image(0, 0, 'machine_press').setDisplaySize(40, 40);

    this.statusBadgeText = this.scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: PALETTE.successGreenHex,
    });

    this.speedText = this.scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: PALETTE.textMuted,
    });

    // 5. Reçete Alanı
    this.recipeSectionTitle = this.scene.add.text(0, 0, 'AKTİF REÇETE', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: PALETTE.factoryAmberHex,
    });

    this.recipeDetailsText = this.scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '9px',
      color: PALETTE.textPrimary,
      lineSpacing: 4,
    });

    this.recipeChipsContainer = this.scene.add.container(0, 0);

    // 6. Tampon Alanı
    this.bufferSectionTitle = this.scene.add.text(0, 0, 'DAHİLİ TAMPONLAR', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: PALETTE.factoryAmberHex,
    });

    this.inputBufferText = this.scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '9px',
      color: PALETTE.rocketCyanHex,
    });

    this.outputBufferText = this.scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '9px',
      color: PALETTE.successGreenHex,
    });

    // 7. Yükseltme Butonu
    this.upgradeButtonBg = this.scene.add.graphics();
    this.upgradeButtonText = this.scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: '#0b0e17',
      align: 'center',
    }).setOrigin(0.5);

    this.upgradeButtonHitArea = this.scene.add
      .rectangle(0, 0, 348, 38, 0x000000, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleUpgradeClick());

    // 8. Yıkım / İade Butonu
    this.demolishButtonBg = this.scene.add.graphics();
    this.demolishButtonText = this.scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '9px',
      color: PALETTE.dangerRedHex,
      align: 'center',
    }).setOrigin(0.5);

    this.demolishButtonHitArea = this.scene.add
      .rectangle(0, 0, 348, 28, 0x000000, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleDemolishClick());

    // Tüm öğeleri konteynere ekle
    this.container.add([
      this.backdrop,
      this.panelBlocker,
      this.panelGraphics,
      this.bufferGraphics,
      this.titleText,
      this.levelBadgeText,
      this.closeButtonText,
      this.machineIcon,
      this.statusBadgeText,
      this.speedText,
      this.recipeSectionTitle,
      this.recipeDetailsText,
      this.recipeChipsContainer,
      this.bufferSectionTitle,
      this.inputBufferText,
      this.outputBufferText,
      this.upgradeButtonBg,
      this.upgradeButtonText,
      this.upgradeButtonHitArea,
      this.demolishButtonBg,
      this.demolishButtonText,
      this.demolishButtonHitArea,
    ]);

    this.bindKeyboard();
  }

  get isOpen(): boolean {
    return this._isOpen;
  }

  // -------------------------------------------------------------
  // KLAVYE KISAYOLLARI
  // -------------------------------------------------------------

  private bindKeyboard(): void {
    if (this.scene.input.keyboard) {
      const escKey = this.scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.ESC);
      escKey.on('down', () => {
        if (this._isOpen) {
          this.close();
        }
      });
    }
  }

  // -------------------------------------------------------------
  // MODAL YAŞAM DÖNGÜSÜ (OPEN / CLOSE / REFRESH)
  // -------------------------------------------------------------

  /**
   * Belirtilen makineyi incelemek üzere modalı açar.
   */
  open(machine: MachineEntity): void {
    this.targetMachine = machine;
    this._isOpen = true;
    this.container.setVisible(true);
    this.refresh();
  }

  /**
   * Modalı kapatır.
   */
  close(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.targetMachine = null;
    this.container.setVisible(false);
    this.recipeChipsContainer.removeAll(true);

    if (this.onClose) {
      this.onClose();
    }
  }

  ignoreCamera(camera: Phaser.Cameras.Scene2D.Camera): void {
    camera.ignore([this.container]);
  }

  layout(_width?: number, _height?: number): void {
    if (this._isOpen) {
      this.refresh();
    }
  }

  /**
   * Modal içeriğini anlık simülasyon ve ekonomi verilerine göre yeniden çizer.
   */
  refresh(): void {
    if (!this._isOpen || !this.targetMachine) return;

    const data = MachineInspectorHelper.inspect(
      this.targetMachine,
      this.engine,
      this.economy,
      this.recipeRegistry,
      this.itemRegistry,
    );

    const { width, height } = this.scene.scale;
    this.backdrop.setSize(width, height);

    const panelX = Math.round((width - this.MODAL_WIDTH) / 2);
    const panelY = Math.round((height - this.MODAL_HEIGHT) / 2);

    this.panelBlocker.setPosition(panelX, panelY);
    this.panelBlocker.setSize(this.MODAL_WIDTH, this.MODAL_HEIGHT);

    // 1. Ana Panel Arka Planı
    this.panelGraphics.clear();
    PixelUIHelper.drawPanel(
      this.panelGraphics,
      panelX,
      panelY,
      this.MODAL_WIDTH,
      this.MODAL_HEIGHT,
      PALETTE.panelBg,
      0.98,
    );

    // Üst Başlık Şeridi
    this.titleText.setPosition(panelX + 16, panelY + 14).setText(data.name);
    this.levelBadgeText
      .setPosition(panelX + 16 + this.titleText.width + 8, panelY + 16)
      .setText(`Lv.${data.level}`);
    this.closeButtonText.setPosition(panelX + this.MODAL_WIDTH - 36, panelY + 14);

    // 2. Makine Durum Kartı (Panel)
    const cardY = panelY + 38;
    PixelUIHelper.drawPanel(
      this.panelGraphics,
      panelX + 16,
      cardY,
      this.MODAL_WIDTH - 32,
      56,
      PALETTE.cardBg,
      1,
    );

    // İkon
    this.machineIcon.setTexture(this.targetMachine.def.spriteBaseKey);
    this.machineIcon.setPosition(panelX + 44, cardY + 28);

    // Durum Rozeti ve Hız Metni
    this.statusBadgeText
      .setPosition(panelX + 74, cardY + 12)
      .setText(`[${data.statusLabel}]`)
      .setColor(data.statusColorHex);

    this.speedText
      .setPosition(panelX + 74, cardY + 32)
      .setText(`Üretim Hızı: ${MachineInspectorHelper.formatSpeed(data.speedMultiplier)} (+%20/Lv)`);

    // 3. Reçete Alanı
    const recipeY = panelY + 104;
    this.recipeSectionTitle.setPosition(panelX + 16, recipeY);

    this.renderRecipeSelector(panelX + 16, recipeY + 18, data);

    // 4. Dahili Tamponlar Alanı
    const bufferY = panelY + 230;
    this.bufferSectionTitle.setPosition(panelX + 16, bufferY);

    this.bufferGraphics.clear();

    // Girdi Tamponu
    const inBuffer = data.inputBuffers[0];
    const inCount = inBuffer ? inBuffer.count : 0;
    const inCap = inBuffer ? inBuffer.capacity : this.targetMachine.def.inputBufferCapacity;
    const inName = inBuffer ? inBuffer.name : 'Girdi Beklenmiyor';
    const inRatio = inCap > 0 ? inCount / inCap : 0;

    this.inputBufferText
      .setPosition(panelX + 16, bufferY + 18)
      .setText(`Girdi: ${inName} (${inCount}/${inCap})`);

    PixelUIHelper.drawProgressBar(
      this.bufferGraphics,
      panelX + 16,
      bufferY + 34,
      this.MODAL_WIDTH - 32,
      14,
      inRatio,
      PALETTE.rocketCyan,
    );

    // Çıktı Tamponu
    const outBuffer = data.outputBuffers[0];
    const outCount = outBuffer ? outBuffer.count : 0;
    const outCap = outBuffer ? outBuffer.capacity : this.targetMachine.def.outputBufferCapacity;
    const outName = outBuffer ? outBuffer.name : 'Çıktı';
    const outRatio = outCap > 0 ? outCount / outCap : 0;

    this.outputBufferText
      .setPosition(panelX + 16, bufferY + 56)
      .setText(`Çıktı: ${outName} (${outCount}/${outCap})`);

    PixelUIHelper.drawProgressBar(
      this.bufferGraphics,
      panelX + 16,
      bufferY + 72,
      this.MODAL_WIDTH - 32,
      14,
      outRatio,
      PALETTE.successGreen,
    );

    // 5. Yükseltme Butonu
    const upgradeY = panelY + 368;
    this.upgradeButtonBg.clear();
    const upgradeBtnW = this.MODAL_WIDTH - 32;
    const upgradeBtnH = 38;

    if (data.canAffordUpgrade) {
      PixelUIHelper.drawButton(
        this.upgradeButtonBg,
        panelX + 16,
        upgradeY,
        upgradeBtnW,
        upgradeBtnH,
        PALETTE.btnAffordable,
        PALETTE.borderDark,
        0xffffff,
        0.3,
      );
      this.upgradeButtonText
        .setPosition(panelX + 16 + upgradeBtnW / 2, upgradeY + upgradeBtnH / 2)
        .setText(`SEVİYE YÜKSELT: ${MachineInspectorHelper.formatMoney(data.upgradeCost)}\n(${MachineInspectorHelper.formatSpeed(data.speedMultiplier)} -> ${MachineInspectorHelper.formatSpeed(data.nextSpeedMultiplier)})`)
        .setColor(PALETTE.btnAffordableText);
      this.upgradeButtonHitArea
        .setPosition(panelX + 16 + upgradeBtnW / 2, upgradeY + upgradeBtnH / 2)
        .setSize(upgradeBtnW, upgradeBtnH);
    } else {
      PixelUIHelper.drawButton(
        this.upgradeButtonBg,
        panelX + 16,
        upgradeY,
        upgradeBtnW,
        upgradeBtnH,
        PALETTE.btnDisabled,
        PALETTE.btnDisabledBorder,
        0xffffff,
        0.1,
      );
      this.upgradeButtonText
        .setPosition(panelX + 16 + upgradeBtnW / 2, upgradeY + upgradeBtnH / 2)
        .setText(`SEVİYE YÜKSELT: ${MachineInspectorHelper.formatMoney(data.upgradeCost)}\n(Yetersiz Bakiye)`)
        .setColor(PALETTE.btnDisabledText);
      this.upgradeButtonHitArea
        .setPosition(panelX + 16 + upgradeBtnW / 2, upgradeY + upgradeBtnH / 2)
        .setSize(upgradeBtnW, upgradeBtnH);
    }

    // 6. Yıkım / İade Butonu (DEC-007: %100 Sermaye İadesi)
    const demolishY = panelY + 416;
    this.demolishButtonBg.clear();
    const demolishBtnW = this.MODAL_WIDTH - 32;
    const demolishBtnH = 28;

    PixelUIHelper.drawButton(
      this.demolishButtonBg,
      panelX + 16,
      demolishY,
      demolishBtnW,
      demolishBtnH,
      PALETTE.cardBg,
      PALETTE.dangerRed,
      0xffffff,
      0.15,
    );

    this.demolishButtonText
      .setPosition(panelX + 16 + demolishBtnW / 2, demolishY + demolishBtnH / 2)
      .setText(`MAKİNEYİ SÖK: +${MachineInspectorHelper.formatMoney(data.demolishRefund)} (%100 İade)`)
      .setColor(PALETTE.dangerRedHex);

    this.demolishButtonHitArea
      .setPosition(panelX + 16 + demolishBtnW / 2, demolishY + demolishBtnH / 2)
      .setSize(demolishBtnW, demolishBtnH);
  }

  /**
   * Reçete seçim düğmelerini ve detaylarını çizer.
   */
  private renderRecipeSelector(
    startX: number,
    startY: number,
    data: MachineInspectorData,
  ): void {
    this.recipeChipsContainer.removeAll(true);

    const availableRecipes = data.availableRecipes;
    const chipWidth = Math.floor((this.MODAL_WIDTH - 32 - (availableRecipes.length - 1) * 6) / Math.max(1, availableRecipes.length));
    const chipHeight = 22;

    availableRecipes.forEach((recipe, idx) => {
      const chipX = startX + idx * (chipWidth + 6);
      const isSelected = recipe.isActive;

      const g = this.scene.add.graphics();
      PixelUIHelper.drawButton(
        g,
        chipX,
        startY,
        chipWidth,
        chipHeight,
        isSelected ? PALETTE.factoryAmber : PALETTE.cardBg,
        isSelected ? PALETTE.resourceGold : PALETTE.borderDark,
        0xffffff,
        isSelected ? 0.3 : 0.1,
      );

      const label = this.scene.add
        .text(chipX + chipWidth / 2, startY + chipHeight / 2, `Reçete ${idx + 1}`, {
          fontFamily: FONT_FAMILY,
          fontSize: '9px',
          color: isSelected ? '#0b0e17' : PALETTE.textPrimary,
        })
        .setOrigin(0.5);

      const hit = this.scene.add
        .rectangle(chipX + chipWidth / 2, startY + chipHeight / 2, chipWidth, chipHeight, 0, 0)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.handleRecipeSelect(recipe.recipeId));

      this.recipeChipsContainer.add([g, label, hit]);
    });

    // Aktif reçete detayları (Girdiler -> Çıktı (Süre))
    const activeRec = availableRecipes.find((r) => r.isActive);
    if (activeRec) {
      const inputsStr = activeRec.inputs
        .map((i) => `${i.count}x ${i.name}`)
        .join(', ');
      const outputsStr = activeRec.outputs
        .map((o) => `${o.count}x ${o.name}`)
        .join(', ');

      this.recipeDetailsText
        .setPosition(startX, startY + chipHeight + 8)
        .setText(
          `${activeRec.name}\n` +
          `• Girdi: ${inputsStr || 'Yok'}\n` +
          `• Çıktı: ${outputsStr}\n` +
          `• Çevrim Süresi: ${activeRec.processingTimeSec.toFixed(1)} sn`,
        );
    } else {
      this.recipeDetailsText
        .setPosition(startX, startY + chipHeight + 8)
        .setText('Aktif reçete seçilmedi.');
    }
  }

  // -------------------------------------------------------------
  // EYLEM İŞLEYİCİLERİ (UPGRADE / RECIPE / DEMOLISH)
  // -------------------------------------------------------------

  private handleUpgradeClick(): void {
    if (!this.targetMachine) return;

    const res = MachineInspectorHelper.performUpgrade(
      this.targetMachine,
      this.engine,
      this.economy,
    );

    if (res.success) {
      this.playUpgradeEffect();
      this.refresh();
      if (this.onUpgrade) {
        this.onUpgrade(this.targetMachine, res.newLevel);
      }
    } else {
      this.playErrorShake();
    }
  }

  private handleRecipeSelect(recipeId: string): void {
    if (!this.targetMachine) return;

    const res = MachineInspectorHelper.selectRecipe(this.targetMachine, recipeId);
    if (res.success) {
      this.refresh();
      if (this.onRecipeChanged) {
        this.onRecipeChanged(this.targetMachine, recipeId);
      }
    }
  }

  private handleDemolishClick(): void {
    if (!this.targetMachine) return;

    const machineToDemolish = this.targetMachine;
    this.close();

    if (this.onDemolishRequested) {
      this.onDemolishRequested(machineToDemolish);
    }
  }

  // -------------------------------------------------------------
  // GÖRSEL EFEKTLER (DOKUNSAL GERİ BİLDİRİM)
  // -------------------------------------------------------------

  private playUpgradeEffect(): void {
    const { width, height } = this.scene.scale;
    const centerX = width / 2;
    const centerY = height / 2;

    // Yükseltme yüzen metni
    const floating = this.scene.add
      .text(centerX, centerY - 80, `+SEVİYE YÜKSELTİLDİ!`, {
        fontFamily: FONT_FAMILY,
        fontSize: '14px',
        color: PALETTE.resourceGoldHex,
        stroke: '#000000',
        strokeThickness: 4,
      })
      .setOrigin(0.5)
      .setDepth(210)
      .setScrollFactor(0);

    this.scene.tweens.add({
      targets: floating,
      y: centerY - 130,
      alpha: 0,
      duration: 750,
      ease: 'Quad.easeOut',
      onComplete: () => floating.destroy(),
    });
  }

  private playErrorShake(): void {
    this.scene.tweens.add({
      targets: this.upgradeButtonText,
      x: this.upgradeButtonText.x - 4,
      duration: 40,
      yoyo: true,
      repeat: 3,
    });
  }

  // -------------------------------------------------------------
  // CANLI SİMÜLASYON ADIMI (UPDATE)
  // -------------------------------------------------------------

  /**
   * Sahne döngüsünde çağrılır; modal açıkken tampon çubuklarını canlı günceller.
   */
  update(time: number, delta: number): void {
    if (!this._isOpen || !this.targetMachine) return;

    this.timeSinceLastRefresh += delta / 1000;
    if (this.timeSinceLastRefresh >= this.REFRESH_INTERVAL_SEC) {
      this.timeSinceLastRefresh = 0;
      this.refresh();
    }
  }

  /**
   * Modalı ve tüm kaynaklarını yok eder.
   */
  destroy(): void {
    this.close();
    this.container.destroy(true);
  }
}
