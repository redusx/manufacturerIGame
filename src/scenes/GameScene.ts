/* ======================================================================
 * GameScene.ts — Ana fabrika ve roket hangarı sahnesi
 *
 * Sorumluluklar:
 * - Phaser sahne yaşam döngüsü (preload, create, update)
 * - EconomyManager (Decimal tabanlı) + SaveManager entegrasyonu
 * - Merkezde çalışan animasyonlu FactoryView (hammadde → makine → bant → sevkiyat)
 * - Canlı Roket Montaj Hangarı & Fırlatma Rampası (RocketHangarView)
 * - HUD (kaynak, üretim hızı, uçuş rekoru ve ayarlar)
 * - Sağa kaydırmalı FlightScene geçişi ve dönüş döngüsü
 * ====================================================================== */

import Phaser from 'phaser';
import { EconomyManager } from '../economy/EconomyManager';
import { SaveManager } from '../save/SaveManager';
import { MACHINES, AUTO_SAVE_INTERVAL_MS, RESOURCE_NAME } from '../data/MachineData';
import { formatNumber, formatDuration } from '../utils/format';

import { HUD } from '../ui/HUD';
import { MilestoneBar } from '../ui/MilestoneBar';
import { MachineModal } from '../ui/MachineModal';
import { SettingsPanel } from '../ui/SettingsPanel';
import { FactoryView } from '../factory/FactoryView';
import { RocketHangarView } from '../ui/RocketHangarView';
import { PALETTE, FONT_FAMILY, PixelUIHelper } from '../ui/theme';

export class GameScene extends Phaser.Scene {
  private economy!: EconomyManager;

  /* UI bileşenleri */
  private hud!: HUD;
  private milestoneBar!: MilestoneBar;
  private machineModal!: MachineModal;
  private settingsPanel!: SettingsPanel;

  /* Fabrika Görsel Katmanı */
  private factoryView!: FactoryView;

  /* Roket Hangarı & Fırlatma Rampası (Modal Penceresi) */
  private rocketHangar!: RocketHangarView;

  /* Arka plan */
  private bgTile!: Phaser.GameObjects.TileSprite;

  /* Alt Konsol Tablası (Arcade Control Deck) */
  private consoleDeckBg!: Phaser.GameObjects.NineSlice;

  /* Alt Kontrol Butonları: Manuel Üret ve Fırlatma Modu */
  private clickBtnContainer!: Phaser.GameObjects.Container;
  private clickBtnBg!: Phaser.GameObjects.NineSlice;
  private clickBtnIcon!: Phaser.GameObjects.Image;
  private clickBtnText!: Phaser.GameObjects.Text;
  private clickInfoText!: Phaser.GameObjects.Text;
  private clickZone!: Phaser.GameObjects.Zone;

  private launchModeBtnContainer!: Phaser.GameObjects.Container;
  private launchModeBtnBg!: Phaser.GameObjects.NineSlice;
  private launchModeBtnIcon!: Phaser.GameObjects.Image;
  private launchModeBtnText!: Phaser.GameObjects.Text;
  private launchModeSubText!: Phaser.GameObjects.Text;
  private launchModeZone!: Phaser.GameObjects.Zone;

  /* Bildirim */
  private notificationText!: Phaser.GameObjects.Text;
  private notificationBgSlice!: Phaser.GameObjects.NineSlice;
  private notificationTween: Phaser.Tweens.Tween | null = null;

  /* Zamanlayıcılar */
  private autoSaveTimer = 0;
  private lastUnlockState: boolean[] = [];

  /* Düğme boyutları */
  private clickBtnW = 180;
  private clickBtnH = 46;

  constructor() {
    super({ key: 'GameScene' });
  }

  /* ================================================================
   * PRELOAD (PİKSEL SANAT RASTER PNG DOKULARI)
   * ================================================================ */

  preload(): void {
    // Roket Gövdeleri
    this.load.image('rocket_hull_1', '/assets/rocket_hull_1.png');
    this.load.image('rocket_hull_2', '/assets/rocket_hull_2.png');
    this.load.image('rocket_hull_3', '/assets/rocket_hull_3.png');

    // Roket Motorları
    this.load.image('rocket_engine_1', '/assets/rocket_engine_1.png');
    this.load.image('rocket_engine_2', '/assets/rocket_engine_2.png');
    this.load.image('rocket_engine_3', '/assets/rocket_engine_3.png');

    // Roket Kanatları
    this.load.image('rocket_wings_1', '/assets/rocket_wings_1.png');
    this.load.image('rocket_wings_2', '/assets/rocket_wings_2.png');
    this.load.image('rocket_wings_3', '/assets/rocket_wings_3.png');

    // Roket Boost Tankları
    this.load.image('rocket_tank_1', '/assets/rocket_tank_1.png');
    this.load.image('rocket_tank_2', '/assets/rocket_tank_2.png');
    this.load.image('rocket_tank_3', '/assets/rocket_tank_3.png');

    // Alev Sprite'ları
    this.load.image('flame_idle', '/assets/flame_idle.png');
    this.load.image('flame_boost', '/assets/flame_boost.png');

    // Uçuş Parçaları ve Nesneleri
    this.load.image('pickup_gear', '/assets/pickup_gear.png');
    this.load.image('pickup_crystal', '/assets/pickup_crystal.png');
    this.load.image('pickup_repair', '/assets/pickup_repair.png');

    // Engeller
    this.load.image('obstacle_asteroid', '/assets/obstacle_asteroid.png');
    this.load.image('obstacle_drone', '/assets/obstacle_drone.png');
    this.load.image('obstacle_debris', '/assets/obstacle_debris.png');

    // Rampa ve Çevre
    this.load.image('launch_pad', '/assets/launch_pad.png');
    this.load.image('cloud_pixel', '/assets/cloud_pixel.png');
    this.load.image('mountain_pixel', '/assets/mountain_pixel.png');
    this.load.image('star_pixel', '/assets/star_pixel.png');

    // Fabrika Çevresi ve Zemin
    this.load.image('factory_bg', '/assets/factory_bg.png');
    this.load.image('factory_floor', '/assets/factory_floor.png');
    this.load.image('conveyor_belt', '/assets/conveyor_belt.png');
    this.load.image('factory_intake', '/assets/factory_intake.png');
    this.load.image('shipping_crate', '/assets/shipping_crate.png');

    // 4 Makine ve Parçaları
    this.load.image('machine_bench', '/assets/machine_bench.png');
    this.load.image('machine_bench_part', '/assets/machine_bench_part.png');
    this.load.image('machine_press', '/assets/machine_press.png');
    this.load.image('machine_press_part', '/assets/machine_press_part.png');
    this.load.image('machine_welder', '/assets/machine_welder.png');
    this.load.image('machine_welder_part', '/assets/machine_welder_part.png');
    this.load.image('machine_automation', '/assets/machine_automation.png');
    this.load.image('machine_automation_part', '/assets/machine_automation_part.png');
    this.load.image('machine_empty_slot', '/assets/machine_empty_slot.png');

    // Uçuş & Pist & Uzay Dokuları
    this.load.image('flight_ground', '/assets/flight_ground.png');
    this.load.image('launch_platform', '/assets/launch_platform.png');
    this.load.image('sky_band_day', '/assets/sky_band_day.png');
    this.load.image('sky_band_sunset', '/assets/sky_band_sunset.png');
    this.load.image('sky_band_space', '/assets/sky_band_space.png');

    // UI Panelleri & Kartlar (Raster 9-Slice)
    this.load.image('ui_panel_hud', '/assets/ui_panel_hud.png');
    this.load.image('ui_card_bg', '/assets/ui_card_bg.png');
    this.load.image('ui_modal_bg', '/assets/ui_modal_bg.png');
    this.load.image('ui_toast_bg', '/assets/ui_toast_bg.png');

    // Butonlar
    this.load.image('btn_green_normal', '/assets/btn_green_normal.png');
    this.load.image('btn_green_hover', '/assets/btn_green_hover.png');
    this.load.image('btn_green_pressed', '/assets/btn_green_pressed.png');
    this.load.image('btn_disabled', '/assets/btn_disabled.png');
    this.load.image('btn_danger_normal', '/assets/btn_danger_normal.png');
    this.load.image('btn_danger_pressed', '/assets/btn_danger_pressed.png');
    this.load.image('btn_manual_normal', '/assets/btn_manual_normal.png');
    this.load.image('btn_manual_hover', '/assets/btn_manual_hover.png');
    this.load.image('btn_manual_pressed', '/assets/btn_manual_pressed.png');
    this.load.image('btn_launch_normal', '/assets/btn_launch_normal.png');
    this.load.image('btn_launch_hover', '/assets/btn_launch_hover.png');
    this.load.image('btn_launch_pressed', '/assets/btn_launch_pressed.png');
    this.load.image('btn_tab_active', '/assets/btn_tab_active.png');
    this.load.image('btn_tab_inactive', '/assets/btn_tab_inactive.png');

    // Göstergeler & Barlar
    this.load.image('ui_bar_slot', '/assets/ui_bar_slot.png');
    this.load.image('ui_bar_fill_green', '/assets/ui_bar_fill_green.png');
    this.load.image('ui_bar_fill_red', '/assets/ui_bar_fill_red.png');
    this.load.image('ui_bar_fill_cyan', '/assets/ui_bar_fill_cyan.png');
    this.load.image('ui_bar_fill_gold', '/assets/ui_bar_fill_gold.png');

    // İkonlar
    this.load.image('icon_coin', '/assets/icon_coin.png');
    this.load.image('icon_gear', '/assets/icon_gear.png');
    this.load.image('icon_settings', '/assets/icon_settings.png');
    this.load.image('icon_rocket', '/assets/icon_rocket.png');
    this.load.image('icon_factory', '/assets/icon_factory.png');
    this.load.image('icon_heart', '/assets/icon_heart.png');
    this.load.image('icon_lightning', '/assets/icon_lightning.png');
    this.load.image('icon_flag', '/assets/icon_flag.png');
    this.load.image('icon_trophy', '/assets/icon_trophy.png');
    this.load.image('icon_close', '/assets/icon_close.png');
    this.load.image('icon_check', '/assets/icon_check.png');

    // Piksel Sanat Varlıkları (Pixelart Koleksiyonu)
    this.load.spritesheet('coin_gold', '/assets/pixelart/coins/spr_coin_ama.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('coin_blue', '/assets/pixelart/coins/spr_coin_azu.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('coin_red', '/assets/pixelart/coins/spr_coin_roj.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('coin_gray', '/assets/pixelart/coins/spr_coin_gri.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    this.load.image('ui_buttons', '/assets/pixelart/ui/ui_buttons_elements.png');
    this.load.image('ui_banners', '/assets/pixelart/ui/ui_banners_badges.png');
    this.load.image('ui_cards', '/assets/pixelart/ui/ui_card_frames.png');
    this.load.image('ui_bars_gauges', '/assets/pixelart/ui/ui_bars_gauges.png');

    // FX Spritesheets
    this.load.spritesheet('hit_spark', '/assets/pixelart/fx/hit_spark_spritesheet.png', {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet('fire_explosion', '/assets/pixelart/fx/fire_explosion_spritesheet.png', {
      frameWidth: 100,
      frameHeight: 100,
    });
  }

  /* ================================================================
   * CREATE
   * ================================================================ */

  create(): void {
    this.economy = new EconomyManager();

    /* Animasyonları tanımla */
    if (!this.anims.exists('coin_gold_spin')) {
      this.anims.create({
        key: 'coin_gold_spin',
        frames: this.anims.generateFrameNumbers('coin_gold', { start: 0, end: 3 }),
        frameRate: 8,
        repeat: -1,
      });
    }

    if (!this.anims.exists('hit_spark_anim')) {
      this.anims.create({
        key: 'hit_spark_anim',
        frames: this.anims.generateFrameNumbers('hit_spark', { start: 0, end: 35 }),
        frameRate: 30,
        repeat: 0,
      });
    }

    if (!this.anims.exists('fire_explosion_anim')) {
      this.anims.create({
        key: 'fire_explosion_anim',
        frames: this.anims.generateFrameNumbers('fire_explosion', { start: 0, end: 63 }),
        frameRate: 30,
        repeat: 0,
      });
    }

    /* Kayıt yükle */
    this.loadGame();

    /* Arka plan dokusu */
    this.bgTile = this.add.tileSprite(0, 0, 100, 100, 'factory_bg').setOrigin(0, 0).setDepth(0);

    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    /* Merkezde Fabrika Görünümü (Doğrudan cihazlara tıklanabilir) */
    this.factoryView = new FactoryView(
      this,
      this.economy,
      () => this.onClickProduce(),
      (amount, fromX, fromY) => this.onProductDeliveredToShipping(amount, fromX, fromY),
      (machineIdx) => this.machineModal.show(machineIdx),
    );

    /* Alt Konsol Gövdesi (Arcade Control Deck Grounding) */
    this.consoleDeckBg = PixelUIHelper.createPanel(this, 0, 0, 100, 60).setDepth(40);

    /* Tıklama / Manuel Üretim Düğmesi (Büyük Arcade Konsol Butonu) */
    this.clickBtnContainer = this.add.container(0, 0).setDepth(45);

    this.clickBtnBg = PixelUIHelper.createButton(this, 0, 0, this.clickBtnW, this.clickBtnH, 'manual');
    this.clickBtnContainer.add(this.clickBtnBg);

    this.clickBtnIcon = this.add.image(-50, -4, 'icon_gear').setOrigin(0.5);
    this.clickBtnContainer.add(this.clickBtnIcon);

    this.clickBtnText = this.add.text(12, -4, 'MANUEL ÜRET', {
      ...font, fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#381600', strokeThickness: 2,
    }).setOrigin(0.5);
    this.clickBtnContainer.add(this.clickBtnText);

    this.clickInfoText = this.add.text(0, 10, '', {
      ...font, fontSize: '10px', color: '#ffedd5', fontStyle: 'bold',
      stroke: '#281000', strokeThickness: 1.5,
    }).setOrigin(0.5);
    this.clickBtnContainer.add(this.clickInfoText);

    this.clickZone = this.add.zone(0, 0, this.clickBtnW, this.clickBtnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.clickBtnBg.setTexture('btn_manual_pressed');
        this.onClickProduce();
      })
      .on('pointerup', () => {
        this.clickBtnBg.setTexture('btn_manual_hover');
      })
      .on('pointerover', () => {
        this.clickBtnBg.setTexture('btn_manual_hover');
      })
      .on('pointerout', () => {
        this.clickBtnBg.setTexture('btn_manual_normal');
      });
    this.clickBtnContainer.add(this.clickZone);

    /* 2. Fırlatma Modu Düğmesi (Manuel Üret'in yanında, fırlatma özellik sayfasını açar) */
    this.launchModeBtnContainer = this.add.container(0, 0).setDepth(45);
    this.launchModeBtnBg = PixelUIHelper.createButton(this, 0, 0, this.clickBtnW, this.clickBtnH, 'launch');
    this.launchModeBtnContainer.add(this.launchModeBtnBg);

    this.launchModeBtnIcon = this.add.image(-56, -5, 'icon_rocket').setOrigin(0.5);
    this.launchModeBtnContainer.add(this.launchModeBtnIcon);

    this.launchModeBtnText = this.add.text(12, -5, 'FIRLATMA MODU', {
      ...font, fontSize: '13.5px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#042323', strokeThickness: 2,
    }).setOrigin(0.5);
    this.launchModeBtnContainer.add(this.launchModeBtnText);

    this.launchModeSubText = this.add.text(0, 10, 'Geliştir & Uçuşa Geç', {
      ...font, fontSize: '9.5px', color: '#cbf8f2', fontStyle: 'bold',
      stroke: '#042323', strokeThickness: 1.5,
    }).setOrigin(0.5);
    this.launchModeBtnContainer.add(this.launchModeSubText);

    this.launchModeZone = this.add.zone(0, 0, this.clickBtnW, this.clickBtnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.launchModeBtnBg.setTexture('btn_launch_pressed');
        this.rocketHangar.show();
      })
      .on('pointerup', () => {
        this.launchModeBtnBg.setTexture('btn_launch_hover');
      })
      .on('pointerover', () => {
        this.launchModeBtnBg.setTexture('btn_launch_hover');
      })
      .on('pointerout', () => {
        this.launchModeBtnBg.setTexture('btn_launch_normal');
      });
    this.launchModeBtnContainer.add(this.launchModeZone);

    /* Bildirim alanı (Raster 9-Slice Toast) */
    this.notificationBgSlice = PixelUIHelper.createToast(this, 0, 0, 100, 32).setDepth(150).setAlpha(0);
    this.notificationText = this.add.text(0, 0, '', {
      ...font, fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
      align: 'center', wordWrap: { width: 340 },
    }).setOrigin(0.5).setDepth(151).setAlpha(0);

    /* Roket Hangarı & Fırlatma Rampası (Pop-up Modal Penceresi) */
    this.rocketHangar = new RocketHangarView(this, this.economy, () => this.startFlight());

    /* HUD */
    this.hud = new HUD(this, () => this.settingsPanel.show());

    /* Kilometre Taşı / Hedef Çubuğu */
    this.milestoneBar = new MilestoneBar(this);

    /* Cihaz / Makine Pop-up Detay ve Geliştirme Penceresi */
    this.machineModal = new MachineModal(this, this.economy, (idx) => {
      this.saveGame();
      this.refreshUI();
      this.factoryView.playMachineUpgradeEffect(idx);
      this.showNotification(`${MACHINES[idx].name} başarıyla geliştirildi!`);
    });

    /* Ayarlar paneli */
    this.settingsPanel = new SettingsPanel(this, () => this.resetGame());

    /* Kilit açılma durumları */
    this.lastUnlockState = MACHINES.map((_, i) => this.economy.isUnlocked(i));

    /* İlk yerleşim */
    this.layoutAll();
    this.scale.on('resize', () => this.layoutAll());

    /* Ekonomi olayları */
    this.economy.on((evt) => {
      if (evt.type === 'purchase' || evt.type === 'upgrade') {
        const idx = MACHINES.findIndex(m => m.id === evt.machineId);
        if (idx >= 0) {
          this.factoryView.playMachineUpgradeEffect(idx);
          // Layout'u yeniden çalıştır: satın alım sonrası makine sprite'ları doğru texture/scale alır
          this.layoutAll();
          if (this.machineModal.isOpen()) {
            this.machineModal.refresh();
          }
        }
      } else if (evt.type === 'goal_reached') {
        this.milestoneBar.playGoalReachedEffect();
        this.showNotification(`HEDEF TAMAMLANDI! Fabrika gücü arttı.`);
      } else if (evt.type === 'rocket_upgrade') {
        this.rocketHangar.refresh();
        this.showNotification(`Roket geliştirildi! Seviye ${evt.newLevel}`);
      }
    });

    /* İlk UI güncellemesi */
    this.refreshUI();
  }

  /* ================================================================
   * FIRLATMA VE UÇUŞ SAHNESİ GEÇİŞİ
   * ================================================================ */

  private startFlight(): void {
    this.saveGame();
    this.scene.pause('GameScene');
    this.scene.launch('FlightScene', { economy: this.economy });
  }

  /** Uçuş tamamlandığında FlightScene'den çağrılır */
  onReturnFromFlight(totalResources: number, distance: number): void {
    this.saveGame();
    this.refreshUI();
    this.rocketHangar.refresh();

    this.showNotification(
      `Uçuş tamamlandı! +${formatNumber(totalResources)} ${RESOURCE_NAME} (${distance}m)`,
    );

    // HUD'a doğru kutlama parçacıkları
    const w = this.scale.width;
    const h = this.scale.height;
    for (let i = 0; i < 7; i++) {
      const fx = w * 0.6 + Phaser.Math.Between(-60, 60);
      const fy = h * 0.4 + Phaser.Math.Between(-30, 30);
      this.time.delayedCall(i * 60, () => {
        this.onProductDeliveredToShipping(totalResources / 7, fx, fy);
      });
    }
  }

  /* ================================================================
   * UPDATE (HER KARE)
   * ================================================================ */

  update(_time: number, delta: number): void {
    if (this.settingsPanel.visible) return;

    const dt = delta / 1000;

    /* Otomatik üretim (zaman temelli ekonomi hesabı) */
    this.economy.tick(dt);

    /* Fabrika animasyonlarını güncelle */
    this.factoryView.update(_time, delta);

    /* Kilit açılma kontrolü */
    this.checkUnlocks();

    /* UI güncelle */
    this.refreshUI();

    /* Otomatik kayıt */
    this.autoSaveTimer += delta;
    if (this.autoSaveTimer >= AUTO_SAVE_INTERVAL_MS) {
      this.autoSaveTimer = 0;
      this.saveGame();
    }
  }

  /* ================================================================
   * TIKLAMA İLE MANUEL ÜRETİM
   * ================================================================ */

  private onClickProduce(): void {
    const gained = this.economy.produceByClick();

    /* Düğme esneme animasyonu */
    this.tweens.add({
      targets: this.clickBtnContainer,
      scaleX: 0.94, scaleY: 0.94,
      duration: 60, yoyo: true,
      ease: 'Quad.easeOut',
    });

    /* Fabrikada görsel ürün akışını tetikle */
    this.factoryView.triggerManualProduction(gained.toNumber());

    /* HUD titreşimi */
    this.hud.pulse();

    /* Yüzen +N metni */
    const cx = this.clickBtnContainer.x + Phaser.Math.Between(-10, 10);
    const cy = this.clickBtnContainer.y - this.clickBtnH / 2;
    const floatText = this.add.text(cx, cy, `+${formatNumber(gained)}`, {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '18px', color: '#2ecc71', fontStyle: 'bold',
    }).setOrigin(0.5).setDepth(100);

    this.tweens.add({
      targets: floatText,
      y: cy - 40, alpha: 0,
      duration: 550, ease: 'Quad.easeOut',
      onComplete: () => floatText.destroy(),
    });
  }

  /* ================================================================
   * SEVKİYATTAN HUD'A PARÇACIK AKIŞI
   * ================================================================ */

  private onProductDeliveredToShipping(_amount: number, fromX: number, fromY: number): void {
    const target = this.hud.getResourceTargetPos();

    // Gerçek piksel art coin sprite (altın sarısı jeton - vektör çizim değil)
    const coinKey = this.textures.exists('coin_gold') ? 'coin_gold' : 'icon_coin';
    const coin = this.add.sprite(fromX, fromY, coinKey, 0).setDepth(110).setScale(1.3);
    if (this.anims.exists('coin_gold_spin')) {
      coin.play('coin_gold_spin');
    }

    const midX = (fromX + target.x) / 2 + Phaser.Math.Between(-40, 20);
    const midY = Math.min(fromY, target.y) - Phaser.Math.Between(20, 60);

    let progress = 0;
    this.tweens.add({
      targets: { val: 0 },
      val: 1,
      duration: 400,
      ease: 'Quad.easeIn',
      onUpdate: (tween) => {
        progress = tween.getValue() ?? 0;
        const x = (1 - progress) * (1 - progress) * fromX + 2 * (1 - progress) * progress * midX + progress * progress * target.x;
        const y = (1 - progress) * (1 - progress) * fromY + 2 * (1 - progress) * progress * midY + progress * progress * target.y;
        coin.setPosition(x, y);
      },
      onComplete: () => {
        coin.destroy();
        this.hud.pulse();
      },
    });
  }

  /* ================================================================
   * MAKİNE SATIN ALMA / YÜKSELTME
   * ================================================================ */

  private onBuyOrUpgrade(index: number): void {
    if (this.economy.buyOrUpgrade(index)) {
      this.saveGame();
      this.refreshUI();
      this.layoutAll();
    }
  }

  /* ================================================================
   * AÇILMA KONTROLÜ
   * ================================================================ */

  private checkUnlocks(): void {
    for (let i = 0; i < MACHINES.length; i++) {
      const nowUnlocked = this.economy.isUnlocked(i);
      if (nowUnlocked && !this.lastUnlockState[i]) {
        this.lastUnlockState[i] = true;
        this.showNotification(`YENİ CİHAZ: ${MACHINES[i].name} kuruluma hazır!`);
        this.factoryView.refreshBays();
        if (this.machineModal && this.machineModal.isOpen()) {
          this.machineModal.refresh();
        }
      }
    }
  }

  /* ================================================================
   * UI GÜNCELLEME
   * ================================================================ */

  private refreshUI(): void {
    /* HUD */
    this.hud.update(
      this.economy.resources,
      this.economy.getTotalProductionPerSecond(),
      this.economy.stats.bestDistance,
    );

    /* Kilometre Taşı Çubuğu */
    const pps = this.economy.getTotalProductionPerSecond();
    this.milestoneBar.updateGoal(this.economy.getNextGoal(), pps);

    /* Manuel üretim bilgisi */
    const globalMul = this.economy.getGlobalMultiplier();
    const effectiveClick = this.economy.clickPower.mul(globalMul);
    this.clickInfoText.setText(
      `+${formatNumber(effectiveClick)} ${RESOURCE_NAME} / tık`,
    );

    /* Fabrika cihazlarının durumunu ve rozetlerini yenile */
    this.factoryView.refreshBays();

    /* Açık ise makine modalını yenile */
    if (this.machineModal && this.machineModal.isOpen()) {
      this.machineModal.refresh();
    }

    /* Roket Hangarı Kartları ve Verileri */
    this.rocketHangar.refresh();
  }

  /* ================================================================
   * KAYIT / YÜKLEME
   * ================================================================ */

  private saveGame(): void {
    SaveManager.save(this.economy.serialize());
  }

  private loadGame(): void {
    const { data, wasCorrupted } = SaveManager.load();

    if (wasCorrupted) {
      this.time.delayedCall(500, () => {
        this.showNotification('Eski kayıt formatı yenilendi.');
      });
    }

    this.economy.deserialize(data);

    /* Offline ilerleme */
    if (data.timestamp > 0) {
      const pps = this.economy.getTotalProductionPerSecond();
      if (pps.gt(0)) {
        const { gained, elapsedSec } = SaveManager.calculateOfflineGains(
          data.timestamp,
          pps,
        );
        if (gained.gt(0)) {
          this.economy.addResources(gained);

          this.time.delayedCall(800, () => {
            this.showNotification(
              `${formatDuration(elapsedSec)} uzaktaydın!\n+${formatNumber(gained)} ${RESOURCE_NAME} kazandın.`,
            );
          });
        }
      }
    }
  }

  private resetGame(): void {
    SaveManager.clear();
    this.scene.restart();
  }

  /* ================================================================
   * BİLDİRİM
   * ================================================================ */

  private showNotification(msg: string): void {
    if (this.notificationTween) this.notificationTween.destroy();

    const w = this.scale.width;
    const h = this.scale.height;

    this.notificationText.setText(msg);
    const textW = Math.min(340, this.notificationText.width + 30);
    const textH = this.notificationText.height + 16;

    const notifY = h * 0.18;

    this.notificationBgSlice.setSize(textW, textH);
    this.notificationBgSlice.setPosition(w / 2, notifY);

    this.notificationText.setPosition(w / 2, notifY);

    this.notificationBgSlice.setAlpha(1);
    this.notificationText.setAlpha(1);

    this.notificationTween = this.tweens.add({
      targets: [this.notificationBgSlice, this.notificationText],
      alpha: 0,
      duration: 800,
      delay: 2400,
      ease: 'Quad.easeIn',
      onComplete: () => {
        this.notificationTween = null;
      },
    });
  }

  /* ================================================================
   * YERLEŞİM (RESPONSIVE LAYOUT)
   * ================================================================ */

  private layoutAll(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const sf = Phaser.Math.Clamp(Math.min(w, h) / 480, 0.65, 1.3);

    /* Ana Arka Plan Dokusu */
    this.bgTile.setPosition(0, 0);
    this.bgTile.setSize(w, h);

    /* HUD */
    this.hud.layout(w, h, sf);
    const hudH = Math.round(48 * sf);

    /* Hedef / Kilometre Taşı Çubuğu (Tüm genişlik boyunca) */
    const contentTop = hudH + 4;
    const milestoneH = Math.round(22 * sf);
    this.milestoneBar.layout(14, contentTop + 2, w - 28, sf);
    this.milestoneBar.setVisible(true);

    /* Alt Butonlar: Manuel Üret ve Fırlatma Modu yan yana */
    const btnH = Math.round(44 * sf);
    const maxBtnW = Math.min(230 * sf, (w - 36) / 2);
    this.clickBtnW = maxBtnW;
    this.clickBtnH = btnH;

    const bottomPad = Math.round(14 * sf);
    const btnCy = h - bottomPad - btnH / 2;
    const gap = Math.round(14 * sf);
    const cx = w / 2;

    const leftBtnX = cx - maxBtnW / 2 - gap / 2;
    const rightBtnX = cx + maxBtnW / 2 + gap / 2;

    // 1. Manuel Üret
    this.clickBtnContainer.setPosition(leftBtnX, btnCy);
    this.clickBtnBg.setSize(maxBtnW, btnH);
    this.clickBtnIcon.setPosition(-maxBtnW * 0.28, -4);
    this.clickBtnText.setPosition(12, -4);
    this.clickBtnText.setFontSize(`${Math.max(11, Math.round(12.5 * sf))}px`);
    this.clickZone.setSize(maxBtnW, btnH);
    this.clickInfoText.setPosition(0, 9);
    this.clickInfoText.setFontSize(`${Math.max(8.5, Math.round(9.5 * sf))}px`);

    // 2. Fırlatma Modu
    this.launchModeBtnContainer.setPosition(rightBtnX, btnCy);
    this.launchModeBtnBg.setSize(maxBtnW, btnH);
    this.launchModeBtnIcon.setPosition(-maxBtnW * 0.30, -5);
    this.launchModeBtnText.setPosition(12, -5);
    this.launchModeBtnText.setFontSize(`${Math.max(11, Math.round(12.5 * sf))}px`);
    this.launchModeZone.setSize(maxBtnW, btnH);
    this.launchModeSubText.setPosition(0, 9);
    this.launchModeSubText.setFontSize(`${Math.max(8.5, Math.round(9.5 * sf))}px`);

    /* Fabrika Alanı (Ekranın tüm orta kısmını ferahça kaplar) */
    const factoryTop = contentTop + milestoneH + 8;
    const factoryH = btnCy - btnH / 2 - factoryTop - 10;

    this.factoryView.setVisible(true);
    this.factoryView.layout(8, factoryTop, w - 16, factoryH, sf);

    /* Modallar (Ekran boyutuna göre kendini ortalar) */
    this.machineModal.layout(w, h);
    this.rocketHangar.layout(w, h);
    this.settingsPanel.layout(w, h);
  }
}
