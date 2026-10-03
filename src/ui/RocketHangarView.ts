/* ======================================================================
 * RocketHangarView.ts — Canlı Roket Montaj Hangarı ve Fırlatma Kontrolleri
 * Tamamen gerçek piksel-art raster dokuları ile oluşturuldu (docs/ART_DIRECTION.md)
 * ====================================================================== */

import Phaser from 'phaser';
import {
  ROCKET_UPGRADES,
  type RocketUpgradeDef,
  getMaxHullHP,
  getFlightSpeed,
  getSteeringSpeed,
  getMaxBoostDuration,
  getFuelCapacity,
} from '../data/RocketData';
import type { EconomyManager } from '../economy/EconomyManager';
import { formatNumber } from '../utils/format';
import { RESOURCE_NAME } from '../data/MachineData';
import { PALETTE, FONT_FAMILY, PixelUIHelper } from './theme';
import {
  RocketHangarBridge,
  type RocketModuleCategory,
} from '../factory/simulation/RocketHangarBridge.ts';
import type { FactoryEconomy } from '../factory/simulation/FactoryEconomy.ts';
import { RocketHangarHelper } from './RocketHangarHelper.ts';

interface UpgradeCardElement {
  def: RocketUpgradeDef;
  container: Phaser.GameObjects.Container;
  bgSlice: Phaser.GameObjects.NineSlice;
  iconSprite: Phaser.GameObjects.Image;
  nameText: Phaser.GameObjects.Text;
  levelText: Phaser.GameObjects.Text;
  statText: Phaser.GameObjects.Text;
  btnBg: Phaser.GameObjects.NineSlice;
  btnText: Phaser.GameObjects.Text;
  costText: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  btnX: number;
  btnW: number;
  btnH: number;
}

export class RocketHangarView {
  private scene: Phaser.Scene;
  private economy: EconomyManager;
  private onLaunch: () => void;
  private hangarBridge?: RocketHangarBridge;
  private factoryEconomy?: FactoryEconomy;

  public container: Phaser.GameObjects.Container;
  private backdrop!: Phaser.GameObjects.Rectangle;
  private panelBlocker!: Phaser.GameObjects.Rectangle;
  private modalBg!: Phaser.GameObjects.NineSlice;
  private closeBtnBg!: Phaser.GameObjects.NineSlice;
  private closeBtnIcon!: Phaser.GameObjects.Image;
  private closeZone!: Phaser.GameObjects.Zone;
  private _isOpen = false;

  /* Rampa Alanı */
  private padContainer: Phaser.GameObjects.Container;
  private launchPlatformSprite!: Phaser.GameObjects.Image;
  private padGantrySprite!: Phaser.GameObjects.Image;

  /* Roket Katmanları */
  private rocketContainer: Phaser.GameObjects.Container;
  private hullSprite!: Phaser.GameObjects.Image;
  private engineSprite!: Phaser.GameObjects.Image;
  private wingsSprite!: Phaser.GameObjects.Image;
  private tankSprite!: Phaser.GameObjects.Image;
  private flameSprite!: Phaser.GameObjects.Image;

  /* Fırlatma Butonu */
  private launchBtnContainer: Phaser.GameObjects.Container;
  private launchBtnBg!: Phaser.GameObjects.NineSlice;
  private launchBtnText!: Phaser.GameObjects.Text;
  private launchSubText!: Phaser.GameObjects.Text;
  private launchZone!: Phaser.GameObjects.Zone;

  /* Geliştirme Kartları */
  private cardsContainer: Phaser.GameObjects.Container;
  private cardElements: UpgradeCardElement[] = [];

  /* Üst Bilgi */
  private headerText!: Phaser.GameObjects.Text;
  private statsText!: Phaser.GameObjects.Text;

  private viewX = 0;
  private viewY = 0;
  private viewW = 0;
  private viewH = 0;

  constructor(
    scene: Phaser.Scene,
    economy: EconomyManager,
    onLaunch: () => void,
    hangarBridge?: RocketHangarBridge,
    factoryEconomy?: FactoryEconomy,
  ) {
    this.scene = scene;
    this.economy = economy;
    this.onLaunch = onLaunch;
    this.hangarBridge = hangarBridge;
    this.factoryEconomy = factoryEconomy;

    this.container = scene.add.container(0, 0).setDepth(205).setVisible(false);
    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    // 1. Ekran Karartma Katmanı (Yalnızca dışarı tıklanınca kapatır)
    this.backdrop = scene.add.rectangle(0, 0, 100, 100, 0x05070e, 0.75)
      .setOrigin(0, 0)
      .setInteractive()
      .on('pointerdown', () => this.hide());
    this.container.add(this.backdrop);

    // 2. Modal Gövdesi Tıklama Engelleyici (Pencere içine tıklanınca kapanmasını önler)
    this.panelBlocker = scene.add.rectangle(0, 0, 440, 520, 0x000000, 0.001)
      .setOrigin(0, 0)
      .setInteractive()
      .on('pointerdown', (_pointer: any, _lx: number, _ly: number, event?: Phaser.Types.Input.EventData) => {
        event?.stopPropagation();
      });
    this.container.add(this.panelBlocker);

    // 3. Modal Çerçevesi (9-Slice)
    this.modalBg = PixelUIHelper.createModal(scene, 0, 0, 440, 520).setOrigin(0, 0);
    this.container.add(this.modalBg);

    // 3. Kapatma Butonu
    this.closeBtnBg = PixelUIHelper.createButton(scene, 0, 0, 28, 28, 'disabled');
    this.container.add(this.closeBtnBg);

    this.closeBtnIcon = scene.add.image(0, 0, 'icon_close').setOrigin(0.5).setScale(1.1);
    this.container.add(this.closeBtnIcon);

    this.closeZone = scene.add.zone(0, 0, 32, 32)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hide())
      .on('pointerover', () => this.closeBtnBg.setTexture('btn_danger_normal'))
      .on('pointerout', () => this.closeBtnBg.setTexture('btn_disabled'));
    this.container.add(this.closeZone);

    /* Başlık */
    this.headerText = scene.add.text(0, 0, '🚀 FIRLATMA VE MONTAJ HANGARI', {
      ...font, fontSize: '15px', color: PALETTE.resourceGoldHex, fontStyle: 'bold',
    }).setOrigin(0.5);
    this.container.add(this.headerText);

    this.statsText = scene.add.text(0, 0, '', {
      ...font, fontSize: '11px', color: PALETTE.textMuted,
    }).setOrigin(0.5);
    this.container.add(this.statsText);

    /* Rampa & Roket Alanı (Gerçek Piksel Raster Dokular) */
    this.padContainer = scene.add.container(0, 0);

    // Çelik rampa kaidesi (launch_platform)
    this.launchPlatformSprite = scene.add.image(0, 25, 'launch_platform').setOrigin(0.5, 0.5);
    this.launchPlatformSprite.setScale(2.0);
    this.padContainer.add(this.launchPlatformSprite);

    // Gantry kulesi (launch_pad)
    if (scene.textures.exists('launch_pad')) {
      this.padGantrySprite = scene.add.image(-48, -5, 'launch_pad').setOrigin(0.5, 0.7);
      this.padGantrySprite.setScale(1.8);
      this.padContainer.add(this.padGantrySprite);
    }

    /* Roket Montaj Parçaları */
    this.rocketContainer = scene.add.container(0, 0);

    // Motor alevi (arka)
    this.flameSprite = scene.add.image(-28, 0, 'flame_idle').setOrigin(1, 0.5);
    this.flameSprite.setScale(2.2);
    this.rocketContainer.add(this.flameSprite);

    // Motor
    this.engineSprite = scene.add.image(-16, 0, 'rocket_engine_1').setOrigin(0.5);
    this.engineSprite.setScale(2.5);
    this.rocketContainer.add(this.engineSprite);

    // Yakıt tankları
    this.tankSprite = scene.add.image(-4, 0, 'rocket_tank_1').setOrigin(0.5);
    this.tankSprite.setScale(2.5);
    this.rocketContainer.add(this.tankSprite);

    // Kanatlar
    this.wingsSprite = scene.add.image(-8, 0, 'rocket_wings_1').setOrigin(0.5);
    this.wingsSprite.setScale(2.5);
    this.rocketContainer.add(this.wingsSprite);

    // Ana gövde (en üst)
    this.hullSprite = scene.add.image(4, 0, 'rocket_hull_1').setOrigin(0.5);
    this.hullSprite.setScale(2.5);
    this.rocketContainer.add(this.hullSprite);

    // Roketi 45 derece açıyla rampada göster
    this.rocketContainer.setRotation(-Math.PI / 4);

    this.padContainer.add(this.rocketContainer);
    this.container.add(this.padContainer);

    /* Fırlatma Düğmesi (Büyük Arcade Siyanür Konsol Butonu) */
    this.launchBtnContainer = scene.add.container(0, 0);
    this.launchBtnBg = PixelUIHelper.createButton(scene, 0, 0, 180, 44, 'launch');
    this.launchBtnContainer.add(this.launchBtnBg);

    this.launchBtnText = scene.add.text(0, -6, '🚀 UÇUŞU BAŞLAT', {
      ...font, fontSize: '15px', color: '#041717', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.launchBtnContainer.add(this.launchBtnText);

    this.launchSubText = scene.add.text(0, 10, 'YATAY SAĞA KAYDIRMALI UÇUŞ', {
      ...font, fontSize: '9px', color: '#041717', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.launchBtnContainer.add(this.launchSubText);

    this.launchZone = scene.add.zone(0, 0, 180, 44)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.launchBtnBg.setTexture('btn_launch_pressed');
        this.handleLaunchClick();
      })
      .on('pointerover', () => {
        this.launchBtnBg.setTexture('btn_launch_hover');
        this.launchBtnContainer.setScale(1.03);
      })
      .on('pointerout', () => {
        this.launchBtnBg.setTexture('btn_launch_normal');
        this.launchBtnContainer.setScale(1.0);
      });
    this.launchBtnContainer.add(this.launchZone);
    this.container.add(this.launchBtnContainer);

    /* Geliştirme Kartları */
    this.cardsContainer = scene.add.container(0, 0);
    this.container.add(this.cardsContainer);

    this.createUpgradeCards();
    this.updateRocketVisuals();

    // Ritmik alev titreşimi
    scene.tweens.add({
      targets: this.flameSprite,
      scaleX: 1.9, scaleY: 1.4,
      alpha: 0.85,
      duration: 120,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }

  private createUpgradeCards(): void {
    const s = this.scene;
    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    const iconKeys: Record<string, string> = {
      hull: 'icon_heart',
      engine: 'icon_lightning',
      wings: 'icon_rocket',
      boost: 'pickup_crystal',
    };

    for (let i = 0; i < ROCKET_UPGRADES.length; i++) {
      const def = ROCKET_UPGRADES[i];
      const cardCont = s.add.container(0, 0);

      // Kart Arka Planı (9-Slice Raster)
      const bgSlice = PixelUIHelper.createCard(s, 0, 0, 100, 40).setOrigin(0.5, 0.5);
      cardCont.add(bgSlice);

      // Parça İkonu (Gerçek Piksel Raster Sprite'ı)
      const iconKey = iconKeys[def.id] || 'icon_gear';
      const iconSprite = s.add.image(-80, 0, iconKey).setOrigin(0.5).setScale(1.2);
      cardCont.add(iconSprite);

      const nameText = s.add.text(-60, -10, def.name, {
        ...font, fontSize: '11.5px', color: PALETTE.textPrimary, fontStyle: 'bold',
      }).setOrigin(0, 0.5);
      cardCont.add(nameText);

      const levelText = s.add.text(35, -10, '', {
        ...font, fontSize: '10px', color: PALETTE.resourceGoldHex, fontStyle: 'bold',
      }).setOrigin(1, 0.5);
      cardCont.add(levelText);

      const statText = s.add.text(-60, 8, '', {
        ...font, fontSize: '9.5px', color: PALETTE.textMuted,
      }).setOrigin(0, 0.5);
      cardCont.add(statText);

      // 9-Slice Buton
      const btnBg = PixelUIHelper.createButton(s, 80, 0, 74, 28, 'green');
      cardCont.add(btnBg);

      const btnText = s.add.text(80, -5, 'GELİŞTİR', {
        ...font, fontSize: '10px', color: PALETTE.btnAffordableText, fontStyle: 'bold',
      }).setOrigin(0.5);
      cardCont.add(btnText);

      const costText = s.add.text(80, 7, '', {
        ...font, fontSize: '9px', color: PALETTE.btnAffordableText, fontStyle: 'bold',
      }).setOrigin(0.5);
      cardCont.add(costText);

      const zone = s.add.zone(80, 0, 74, 28)
        .setOrigin(0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', () => this.handleUpgradeClick(def.id));
      cardCont.add(zone);

      this.cardsContainer.add(cardCont);

      this.cardElements.push({
        def,
        container: cardCont,
        bgSlice,
        iconSprite,
        nameText,
        levelText,
        statText,
        btnBg,
        btnText,
        costText,
        zone,
        btnX: 80,
        btnW: 74,
        btnH: 28,
      });
    }
  }

  /** Hangar köprüsünü ve fabrika ekonomisini canlı olarak bağlar veya günceller */
  setHangarBridge(bridge: RocketHangarBridge, factoryEconomy?: FactoryEconomy): void {
    this.hangarBridge = bridge;
    if (factoryEconomy) {
      this.factoryEconomy = factoryEconomy;
    }
    this.updateRocketVisuals();
    this.refresh();
  }

  getHangarBridge(): RocketHangarBridge | undefined {
    return this.hangarBridge;
  }

  getFactoryEconomy(): FactoryEconomy | undefined {
    return this.factoryEconomy;
  }

  private handleUpgradeClick(id: string): void {
    const category = id as RocketModuleCategory;

    if (this.hangarBridge && this.factoryEconomy) {
      let upgraded = this.hangarBridge.upgradeModule(category, this.factoryEconomy, false);
      if (!upgraded && this.hangarBridge.canAffordQuickBuild(category, this.factoryEconomy)) {
        upgraded = this.hangarBridge.upgradeModule(category, this.factoryEconomy, true);
      }
      if (upgraded) {
        const newLvl = this.hangarBridge.getModuleLevel(category);
        this.economy.setRocketUpgradeLevel(id, newLvl);
        this.playUpgradeEffect(id);
        this.updateRocketVisuals();
        this.refresh();
      }
    } else {
      if (this.economy.buyRocketUpgrade(id)) {
        this.playUpgradeEffect(id);
        this.updateRocketVisuals();
        this.refresh();
      }
    }
  }

  private handleLaunchClick(): void {
    this.scene.tweens.add({
      targets: this.rocketContainer,
      x: 80,
      y: -120,
      scaleX: 1.1, scaleY: 1.1,
      duration: 350,
      ease: 'Back.easeIn',
      onComplete: () => {
        this.hide();
        this.onLaunch();
      },
    });

    this.scene.cameras.main.shake(300, 0.005);
  }

  private playUpgradeEffect(id: string): void {
    const card = this.cardElements.find(c => c.def.id === id);
    if (card) {
      this.scene.tweens.add({
        targets: card.container,
        scaleX: 1.05, scaleY: 1.05,
        duration: 90, yoyo: true,
        ease: 'Quad.easeOut',
      });
    }

    this.scene.tweens.add({
      targets: this.rocketContainer,
      scaleX: 1.25, scaleY: 1.25,
      duration: 120, yoyo: true,
      ease: 'Back.easeOut',
    });

    // Değişen parçaya özel anlık vurgu/parıldama mikro-animasyonu
    const targetSprite =
      id === 'hull' ? this.hullSprite :
      id === 'engine' ? this.engineSprite :
      id === 'wings' ? this.wingsSprite :
      id === 'boost' ? this.tankSprite : null;

    if (targetSprite) {
      this.scene.tweens.add({
        targets: targetSprite,
        scaleX: 3.2, scaleY: 3.2,
        duration: 140,
        yoyo: true,
        ease: 'Sine.easeOut',
        onComplete: () => {
          targetSprite.setScale(2.5);
        },
      });
    }
  }

  updateRocketVisuals(): void {
    const hullLevel = this.hangarBridge
      ? this.hangarBridge.getModuleLevel('hull')
      : this.economy.getRocketUpgradeLevel('hull');
    const engineLevel = this.hangarBridge
      ? this.hangarBridge.getModuleLevel('engine')
      : this.economy.getRocketUpgradeLevel('engine');
    const wingsLevel = this.hangarBridge
      ? this.hangarBridge.getModuleLevel('wings')
      : this.economy.getRocketUpgradeLevel('wings');
    const boostLevel = this.hangarBridge
      ? this.hangarBridge.getModuleLevel('boost')
      : this.economy.getRocketUpgradeLevel('boost');

    // Seviye 1, 2, 3 doğrudan ilgili görsel doku kademesine (rocket_*_1, 2, 3) eşlenir
    const hullTier = Math.min(3, Math.max(1, hullLevel));
    const engineTier = Math.min(3, Math.max(1, engineLevel));
    const wingsTier = Math.min(3, Math.max(1, wingsLevel));
    const boostTier = Math.min(3, Math.max(1, boostLevel));

    if (this.scene.textures.exists(`rocket_hull_${hullTier}`)) {
      this.hullSprite.setTexture(`rocket_hull_${hullTier}`);
    }
    if (this.scene.textures.exists(`rocket_engine_${engineTier}`)) {
      this.engineSprite.setTexture(`rocket_engine_${engineTier}`);
    }
    if (this.scene.textures.exists(`rocket_wings_${wingsTier}`)) {
      this.wingsSprite.setTexture(`rocket_wings_${wingsTier}`);
    }
    if (this.scene.textures.exists(`rocket_tank_${boostTier}`)) {
      this.tankSprite.setTexture(`rocket_tank_${boostTier}`);
    }
  }

  refresh(): void {
    this.updateRocketVisuals();

    const hullLevel = this.hangarBridge
      ? this.hangarBridge.getModuleLevel('hull')
      : this.economy.getRocketUpgradeLevel('hull');
    const engineLevel = this.hangarBridge
      ? this.hangarBridge.getModuleLevel('engine')
      : this.economy.getRocketUpgradeLevel('engine');
    const wingsLevel = this.hangarBridge
      ? this.hangarBridge.getModuleLevel('wings')
      : this.economy.getRocketUpgradeLevel('wings');
    const boostLevel = this.hangarBridge
      ? this.hangarBridge.getModuleLevel('boost')
      : this.economy.getRocketUpgradeLevel('boost');

    const hp = getMaxHullHP(hullLevel);
    const speed = getFlightSpeed(engineLevel);
    const steer = getSteeringSpeed(wingsLevel);
    const boostSec = getMaxBoostDuration(boostLevel);
    const fuelSec = getFuelCapacity(engineLevel);

    const statsLine = `Zırh: ${hp} HP | Hız: ${speed} | Yakıt: ${fuelSec.toFixed(1)}s | Nitro: ${boostSec.toFixed(1)}s`;
    const stockHeader = this.hangarBridge
      ? `\n${RocketHangarHelper.formatHangarStockHeader(this.hangarBridge)}`
      : '';
    this.statsText.setText(statsLine + stockHeader);

    const economyRef = this.factoryEconomy ?? {
      canAfford: (cost: number) => this.economy.resources.gte(cost),
      money: Number(this.economy.resources),
    };

    for (const card of this.cardElements) {
      const def = card.def;
      const category = def.id as RocketModuleCategory;

      if (this.hangarBridge) {
        const vm = RocketHangarHelper.getCardViewModel(
          category,
          def.name,
          this.hangarBridge,
          economyRef,
          def.getStatText(this.hangarBridge.getModuleLevel(category)),
          def.maxLevel,
          true,
        );

        card.levelText.setText(vm.levelText);
        if (vm.isMax) {
          card.statText.setText(def.getStatText(vm.level));
          card.btnBg.setTexture('btn_disabled');
          card.btnText.setText('MAKSİMUM');
          card.btnText.setColor(PALETTE.textMuted);
          card.costText.setText('');
          card.zone.input!.enabled = false;
        } else {
          card.statText.setText(`${def.getStatText(vm.level)} | ${vm.partsDetailText}`);
          card.btnText.setText(vm.btnText);
          card.costText.setText(vm.costText);

          if (vm.canAfford) {
            card.btnBg.setTexture('btn_green_normal');
            card.btnText.setColor(PALETTE.btnAffordableText);
            card.costText.setColor(PALETTE.btnAffordableText);
            card.zone.input!.enabled = true;
          } else {
            card.btnBg.setTexture('btn_disabled');
            card.btnText.setColor(PALETTE.btnDisabledText);
            card.costText.setColor(PALETTE.btnDisabledText);
            card.zone.input!.enabled = false;
          }
        }
      } else {
        const level = this.economy.getRocketUpgradeLevel(def.id);
        const isMax = level >= def.maxLevel;
        const cost = this.economy.getRocketUpgradeCost(def.id);
        const canAfford = !isMax && this.economy.resources.gte(cost);

        card.levelText.setText(isMax ? 'MAKS' : `Sv. ${level}/${def.maxLevel}`);
        card.statText.setText(def.getStatText(level));

        if (isMax) {
          card.btnBg.setTexture('btn_disabled');
          card.btnText.setText('MAKSİMUM');
          card.btnText.setColor(PALETTE.textMuted);
          card.costText.setText('');
          card.zone.input!.enabled = false;
        } else {
          card.btnText.setText('GELİŞTİR');
          card.costText.setText(`⚙ ${formatNumber(cost)}`);

          if (canAfford) {
            card.btnBg.setTexture('btn_green_normal');
            card.btnText.setColor(PALETTE.btnAffordableText);
            card.costText.setColor(PALETTE.btnAffordableText);
            card.zone.input!.enabled = true;
          } else {
            card.btnBg.setTexture('btn_disabled');
            card.btnText.setColor(PALETTE.btnDisabledText);
            card.costText.setColor(PALETTE.btnDisabledText);
            card.zone.input!.enabled = false;
          }
        }
      }
    }
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  show(): void {
    this._isOpen = true;
    this.container.setVisible(true);
    this.rocketContainer.setPosition(0, 0);
    this.rocketContainer.setScale(1.0);
    this.updateRocketVisuals();
    this.refresh();

    this.container.setAlpha(0);
    this.scene.tweens.add({
      targets: this.container,
      alpha: 1,
      duration: 140,
      ease: 'Quad.easeOut',
    });
  }

  hide(): void {
    if (!this._isOpen) return;
    this._isOpen = false;
    this.scene.tweens.add({
      targets: this.container,
      alpha: 0,
      duration: 120,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.container.setVisible(false);
      },
    });
  }

  layout(w: number, h: number): void {
    this.backdrop.setSize(w, h);

    const sf = Phaser.Math.Clamp(Math.min(w, h) / 480, 0.65, 1.2);
    const modalW = Math.min(480, w - 20);
    const modalH = Math.min(540, h - 30);
    const cx = w / 2;
    const cy = h / 2;
    const modalX = cx - modalW / 2;
    const modalY = cy - modalH / 2;

    this.panelBlocker.setPosition(modalX, modalY);
    this.panelBlocker.setSize(modalW, modalH);

    this.modalBg.setPosition(modalX, modalY);
    this.modalBg.setSize(modalW, modalH);

    // Kapat butonu (Sağ Üst)
    this.closeBtnBg.setPosition(modalX + modalW - 22, modalY + 22);
    this.closeBtnIcon.setPosition(modalX + modalW - 22, modalY + 22);
    this.closeZone.setPosition(modalX + modalW - 22, modalY + 22);

    // Başlık ve İstatistikler
    this.headerText.setPosition(cx, modalY + 22);
    this.headerText.setFontSize(`${Math.max(12, Math.round(14 * sf))}px`);

    this.statsText.setPosition(cx, modalY + 42);
    this.statsText.setFontSize(`${Math.max(9.5, Math.round(10.5 * sf))}px`);

    // Rampa Alanı (Gantry + Roket)
    const padCy = modalY + Math.round(112 * sf);
    this.padContainer.setPosition(cx, padCy);

    // Geliştirme Kartları (4 kart alt alta düzenli liste)
    const cardW = modalW - 32;
    const cardH = Math.max(34, Math.round(38 * sf));
    const cardGap = Math.max(4, Math.round(6 * sf));
    const cardsTop = padCy + Math.round(52 * sf);

    this.cardsContainer.setPosition(cx, cardsTop + cardH / 2);

    for (let i = 0; i < this.cardElements.length; i++) {
      const card = this.cardElements[i];
      const cy = i * (cardH + cardGap);
      card.container.setPosition(0, cy);

      card.bgSlice.setSize(cardW, cardH);

      const bW = Math.max(76, Math.round(84 * sf));
      const bH = Math.max(26, Math.round(28 * sf));
      const btnX = cardW / 2 - bW / 2 - 8;

      card.btnX = btnX;
      card.btnW = bW;
      card.btnH = bH;

      card.btnBg.setPosition(btnX, 0);
      card.btnBg.setSize(bW, bH);

      card.zone.setPosition(btnX, 0);
      card.zone.setSize(bW, bH);
      card.btnText.setPosition(btnX, -4);
      card.btnText.setFontSize(`${Math.max(8.5, Math.round(9.5 * sf))}px`);

      card.costText.setPosition(btnX, 6);
      card.costText.setFontSize(`${Math.max(7.5, Math.round(8.5 * sf))}px`);

      const leftX = -cardW / 2 + 16;
      card.iconSprite.setPosition(leftX, 0);
      card.iconSprite.setScale(Math.max(0.8, sf * 1.0));

      card.nameText.setPosition(leftX + 22, -6);
      card.nameText.setFontSize(`${Math.max(9.5, Math.round(11 * sf))}px`);

      card.levelText.setPosition(btnX - bW / 2 - 8, -6);
      card.levelText.setFontSize(`${Math.max(8.5, Math.round(9.5 * sf))}px`);

      card.statText.setPosition(leftX + 22, 7);
      card.statText.setFontSize(`${Math.max(8.5, Math.round(9.5 * sf))}px`);
    }

    // Fırlatma Düğmesi (En Alt)
    const btnW = Math.min(cardW, Math.round(320 * sf));
    const btnH = Math.round(44 * sf);
    const btnY = modalY + modalH - Math.round(28 * sf);

    this.launchBtnContainer.setPosition(cx, btnY);
    this.launchBtnBg.setSize(btnW, btnH);
    this.launchZone.setSize(btnW, btnH);
    this.launchBtnText.setFontSize(`${Math.max(12, Math.round(14 * sf))}px`);
    this.launchSubText.setFontSize(`${Math.max(8, Math.round(9 * sf))}px`);

    this.refresh();
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }
}
