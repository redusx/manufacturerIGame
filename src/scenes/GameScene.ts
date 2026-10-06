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
import { AUTO_SAVE_INTERVAL_MS } from '../data/MachineData';
import { formatNumber, formatMoney } from '../utils/format';

import { HUD } from '../ui/HUD';
import { MilestoneBar } from '../ui/MilestoneBar';
import { SettingsPanel } from '../ui/SettingsPanel';
import { OfflineEarningsModal } from '../ui/OfflineEarningsModal';
import { calculateOfflineReport } from '../ui/OfflineEarningsHelper.ts';
import { GridView } from '../factory/view/GridView.ts';
import { CameraController } from '../factory/view/CameraController.ts';
import { GridMap } from '../factory/simulation/GridMap.ts';
import { LogisticsNetwork, type DeliveredItemEvent } from '../factory/simulation/LogisticsNetwork.ts';
import { ProductionEngine } from '../factory/simulation/ProductionEngine.ts';
import { ConveyorRenderer } from '../factory/view/ConveyorRenderer.ts';
import { MachineRenderer } from '../factory/view/MachineRenderer.ts';
import { ItemSpritePool } from '../factory/view/ItemSpritePool.ts';
import { ItemFlowAnimator } from '../factory/view/ItemFlowAnimator.ts';
import { MachineStatusIndicator } from '../factory/view/MachineStatusIndicator.ts';
import { MachineEntity } from '../factory/simulation/MachineEntity.ts';
import { defaultMachineRegistry } from '../factory/simulation/MachineRegistry.ts';
import { defaultItemRegistry } from '../factory/simulation/ItemRegistry.ts';
import { FactorySerializer } from '../factory/simulation/FactorySerializer.ts';
import { GridCoordinates } from '../factory/view/GridCoordinates.ts';
import { RocketHangarView } from '../ui/RocketHangarView';
import { RocketHangarBridge } from '../factory/simulation/RocketHangarBridge';
import { FactoryEconomy } from '../factory/simulation/FactoryEconomy';
import { PlotExpansionManager } from '../factory/progression/PlotExpansionManager.ts';
import { MilestoneManager } from '../factory/progression/MilestoneManager.ts';
import { PlacementController, type PlacementItem } from '../factory/input/PlacementController.ts';
import { BuildMenuModal, INTAKE_CARD_PREFIX } from '../ui/BuildMenuModal.ts';
import { DemolishTool } from '../factory/input/DemolishTool.ts';
import { DemolishMath } from '../factory/input/DemolishMath.ts';
import { MachineInspectorModal } from '../factory/view/MachineInspectorModal.ts';
import { TerminalInspectorModal } from '../ui/TerminalInspectorModal.ts';
import {
  CONVEYOR_BUILD_COST,
  INTAKE_SHORT_NAMES,
  INTAKE_UNLOCK_FEATURES,
  PlacementMath,
} from '../factory/input/PlacementMath.ts';
import { PALETTE, FONT_FAMILY, PixelUIHelper } from '../ui/theme';
import { sound } from '../audio/SoundManager.ts';
import { fx } from '../effects/PixelParticleManager.ts';
import { crazyGames } from '../integration/CrazyGamesSDK.ts';

/** Aşama ödülleriyle açılan özelliklerin kimlikleri (bkz. MilestoneManager.DEFAULT_MILESTONES) */
const HANGAR_FEATURE = 'ROCKET_HANGAR';
/** Uçuş dönüşünde fabrikanın en fazla ne kadar süre için ilerletileceği (saniye) */
const FLIGHT_CATCH_UP_MAX_SEC = 600;
/** Uçuş dönüşü telafi simülasyonunun adım süresi (saniye) */
const FLIGHT_CATCH_UP_STEP_SEC = 1 / 30;
const SPLITTER_MERGER_FEATURE = 'SPLITTER_MERGER';

export class GameScene extends Phaser.Scene {
  private economy!: EconomyManager;
  private hangarBridge!: RocketHangarBridge;
  private flightStartedAtMs = 0;
  /** Uçuş dönüşü telafi simülasyonu sürerken ihracat geri bildirimi bastırılır */
  private isCatchingUp = false;
  private factoryEconomy!: FactoryEconomy;
  private plotManager!: PlotExpansionManager;
  private milestones!: MilestoneManager;

  /* UI bileşenleri */
  private hud!: HUD;
  private milestoneBar!: MilestoneBar;
  private settingsPanel!: SettingsPanel;
  private offlineEarningsModal!: OfflineEarningsModal;

  /* 2D Fabrika Zemin Izgarası ve Kamerası */
  private gridMap!: GridMap;
  private gridView!: GridView;
  private cameraController!: CameraController;
  private factoryCamera!: Phaser.Cameras.Scene2D.Camera;

  /* 2D Simülasyon Motorları */
  private logistics!: LogisticsNetwork;
  private productionEngine!: ProductionEngine;

  /* 2D Lojistik ve Makine Görselleştirme Katmanları */
  private conveyorRenderer!: ConveyorRenderer;
  private machineRenderer!: MachineRenderer;
  private itemContainer!: Phaser.GameObjects.Container;
  private itemPool!: ItemSpritePool;
  private itemFlowAnimator!: ItemFlowAnimator;
  private machineStatusIndicator!: MachineStatusIndicator;

  /* İnşa ve Yerleşim Kontrolleri */
  private placementController!: PlacementController;
  private buildMenuModal!: BuildMenuModal;

  /* Yıkım, Makine ve Terminal İnceleme Araçları */
  private demolishTool!: DemolishTool;
  private machineInspectorModal!: MachineInspectorModal;
  private terminalModal!: TerminalInspectorModal;

  /* Roket Hangarı & Fırlatma Rampası (Modal Penceresi) */
  private rocketHangar!: RocketHangarView;

  /* Arka plan */
  private bgTile!: Phaser.GameObjects.TileSprite;

  /* Alt Konsol Tablası (Arcade Control Deck Grounding) */
  private consoleDeckBg!: Phaser.GameObjects.NineSlice;

  /* Alt Kontrol Butonları: 4 Butonlu İnşa & Hangar Araç Çubuğu */
  private manualBtnContainer!: Phaser.GameObjects.Container;
  private manualBtnBg!: Phaser.GameObjects.NineSlice;
  private manualBtnIcon!: Phaser.GameObjects.Image;
  private manualBtnText!: Phaser.GameObjects.Text;
  private manualBtnSubText!: Phaser.GameObjects.Text;
  private manualZone!: Phaser.GameObjects.Zone;

  private conveyorBtnContainer!: Phaser.GameObjects.Container;
  private conveyorBtnBg!: Phaser.GameObjects.NineSlice;
  private conveyorBtnIcon!: Phaser.GameObjects.Image;
  private conveyorBtnText!: Phaser.GameObjects.Text;
  private conveyorBtnSubText!: Phaser.GameObjects.Text;
  private conveyorZone!: Phaser.GameObjects.Zone;

  private buildBtnContainer!: Phaser.GameObjects.Container;
  private buildBtnBg!: Phaser.GameObjects.NineSlice;
  private buildBtnIcon!: Phaser.GameObjects.Image;
  private buildBtnText!: Phaser.GameObjects.Text;
  private buildBtnSubText!: Phaser.GameObjects.Text;
  private buildZone!: Phaser.GameObjects.Zone;

  private hangarBtnContainer!: Phaser.GameObjects.Container;
  private hangarBtnBg!: Phaser.GameObjects.NineSlice;
  private hangarBtnIcon!: Phaser.GameObjects.Image;
  private hangarBtnText!: Phaser.GameObjects.Text;
  private hangarBtnSubText!: Phaser.GameObjects.Text;
  private hangarZone!: Phaser.GameObjects.Zone;

  /* Aktif Yerleşim Çubuğu (Active Placement Action Bar) */
  private placementBarContainer!: Phaser.GameObjects.Container;
  private placementBarBg!: Phaser.GameObjects.NineSlice;
  private placementBarText!: Phaser.GameObjects.Text;
  private placementRotateBg!: Phaser.GameObjects.NineSlice;
  private placementRotateText!: Phaser.GameObjects.Text;
  private placementRotateZone!: Phaser.GameObjects.Zone;
  private placementCancelBg!: Phaser.GameObjects.NineSlice;
  private placementCancelIcon!: Phaser.GameObjects.Image;
  private placementCancelZone!: Phaser.GameObjects.Zone;

  /* Aktif Yıkım Çubuğu (Active Demolish Action Bar) */
  private demolishBarContainer!: Phaser.GameObjects.Container;
  private demolishBarBg!: Phaser.GameObjects.NineSlice;
  private demolishBarText!: Phaser.GameObjects.Text;
  private demolishCancelBg!: Phaser.GameObjects.NineSlice;
  private demolishCancelIcon!: Phaser.GameObjects.Image;
  private demolishCancelZone!: Phaser.GameObjects.Zone;

  /* Bildirim */
  private notificationText!: Phaser.GameObjects.Text;
  private notificationBgSlice!: Phaser.GameObjects.NineSlice;
  private notificationTween: Phaser.Tweens.Tween | null = null;

  /* Zamanlayıcılar */
  private autoSaveTimer = 0;

  /* Düğme boyutları */
  private dockBtnW = 120;
  private dockBtnH = 44;

  /** Araç çubuğu dar mı? (mobil; metin iki satıra bölünür) */
  private barIsNarrow = false;

  constructor() {
    super({ key: 'GameScene' });
  }

  /* ================================================================
   * PRELOAD (PİKSEL SANAT RASTER PNG DOKULARI)
   * ================================================================ */

  preload(): void {
    // Roket Gövdeleri
    this.load.image('rocket_hull_1', 'assets/rocket_hull_1.png');
    this.load.image('rocket_hull_2', 'assets/rocket_hull_2.png');
    this.load.image('rocket_hull_3', 'assets/rocket_hull_3.png');

    // Roket Motorları
    this.load.image('rocket_engine_1', 'assets/rocket_engine_1.png');
    this.load.image('rocket_engine_2', 'assets/rocket_engine_2.png');
    this.load.image('rocket_engine_3', 'assets/rocket_engine_3.png');

    // Roket Kanatları
    this.load.image('rocket_wings_1', 'assets/rocket_wings_1.png');
    this.load.image('rocket_wings_2', 'assets/rocket_wings_2.png');
    this.load.image('rocket_wings_3', 'assets/rocket_wings_3.png');

    // Roket Boost Tankları
    this.load.image('rocket_tank_1', 'assets/rocket_tank_1.png');
    this.load.image('rocket_tank_2', 'assets/rocket_tank_2.png');
    this.load.image('rocket_tank_3', 'assets/rocket_tank_3.png');

    // Alev Sprite'ları
    this.load.image('flame_idle', 'assets/flame_idle.png');
    this.load.image('flame_boost', 'assets/flame_boost.png');

    // Uçuş Parçaları ve Nesneleri
    this.load.image('pickup_gear', 'assets/pickup_gear.png');
    this.load.image('pickup_crystal', 'assets/pickup_crystal.png');
    this.load.image('pickup_repair', 'assets/pickup_repair.png');

    // Engeller
    this.load.image('obstacle_asteroid', 'assets/obstacle_asteroid.png');
    this.load.image('obstacle_drone', 'assets/obstacle_drone.png');
    this.load.image('obstacle_debris', 'assets/obstacle_debris.png');

    // Rampa ve Çevre
    this.load.image('launch_pad', 'assets/launch_pad.png');
    this.load.image('cloud_pixel', 'assets/cloud_pixel.png');
    this.load.image('mountain_pixel', 'assets/mountain_pixel.png');
    this.load.image('star_pixel', 'assets/star_pixel.png');

    // Fabrika Çevresi ve Zemin
    this.load.image('factory_bg', 'assets/factory_bg.png');
    this.load.image('factory_floor', 'assets/factory_floor.png');
    this.load.image('conveyor_belt', 'assets/conveyor_belt.png');
    this.load.image('factory_intake', 'assets/factory_intake.png');
    this.load.image('shipping_crate', 'assets/shipping_crate.png');

    // 4 Makine ve Parçaları
    this.load.image('machine_bench', 'assets/machine_bench.png');
    this.load.image('machine_bench_part', 'assets/machine_bench_part.png');
    this.load.image('machine_press', 'assets/machine_press.png');
    this.load.image('machine_press_part', 'assets/machine_press_part.png');
    this.load.image('machine_welder', 'assets/machine_welder.png');
    this.load.image('machine_welder_part', 'assets/machine_welder_part.png');
    this.load.image('machine_automation', 'assets/machine_automation.png');
    this.load.image('machine_automation_part', 'assets/machine_automation_part.png');
    this.load.image('machine_empty_slot', 'assets/machine_empty_slot.png');

    // Uçuş & Pist & Uzay Dokuları
    this.load.image('flight_ground', 'assets/flight_ground.png');
    this.load.image('launch_platform', 'assets/launch_platform.png');
    this.load.image('sky_band_day', 'assets/sky_band_day.png');
    this.load.image('sky_band_sunset', 'assets/sky_band_sunset.png');
    this.load.image('sky_band_space', 'assets/sky_band_space.png');

    // UI Panelleri & Kartlar (Raster 9-Slice)
    this.load.image('ui_panel_hud', 'assets/ui_panel_hud.png');
    this.load.image('ui_card_bg', 'assets/ui_card_bg.png');
    this.load.image('ui_modal_bg', 'assets/ui_modal_bg.png');
    this.load.image('ui_toast_bg', 'assets/ui_toast_bg.png');

    // Butonlar
    this.load.image('btn_green_normal', 'assets/btn_green_normal.png');
    this.load.image('btn_green_hover', 'assets/btn_green_hover.png');
    this.load.image('btn_green_pressed', 'assets/btn_green_pressed.png');
    this.load.image('btn_disabled', 'assets/btn_disabled.png');
    this.load.image('btn_danger_normal', 'assets/btn_danger_normal.png');
    this.load.image('btn_danger_pressed', 'assets/btn_danger_pressed.png');
    this.load.image('btn_manual_normal', 'assets/btn_manual_normal.png');
    this.load.image('btn_manual_hover', 'assets/btn_manual_hover.png');
    this.load.image('btn_manual_pressed', 'assets/btn_manual_pressed.png');
    this.load.image('btn_launch_normal', 'assets/btn_launch_normal.png');
    this.load.image('btn_launch_hover', 'assets/btn_launch_hover.png');
    this.load.image('btn_launch_pressed', 'assets/btn_launch_pressed.png');
    this.load.image('btn_tab_active', 'assets/btn_tab_active.png');
    this.load.image('btn_tab_inactive', 'assets/btn_tab_inactive.png');

    // Göstergeler & Barlar
    this.load.image('ui_bar_slot', 'assets/ui_bar_slot.png');
    this.load.image('ui_bar_fill_green', 'assets/ui_bar_fill_green.png');
    this.load.image('ui_bar_fill_red', 'assets/ui_bar_fill_red.png');
    this.load.image('ui_bar_fill_cyan', 'assets/ui_bar_fill_cyan.png');
    this.load.image('ui_bar_fill_gold', 'assets/ui_bar_fill_gold.png');

    // İkonlar
    this.load.image('icon_coin', 'assets/icon_coin.png');
    this.load.image('icon_gear', 'assets/icon_gear.png');
    this.load.image('icon_settings', 'assets/icon_settings.png');
    this.load.image('icon_rocket', 'assets/icon_rocket.png');
    this.load.image('icon_factory', 'assets/icon_factory.png');
    this.load.image('icon_heart', 'assets/icon_heart.png');
    this.load.image('icon_lightning', 'assets/icon_lightning.png');
    this.load.image('icon_flag', 'assets/icon_flag.png');
    this.load.image('icon_trophy', 'assets/icon_trophy.png');
    this.load.image('icon_close', 'assets/icon_close.png');
    this.load.image('icon_check', 'assets/icon_check.png');

    // Piksel Sanat Varlıkları (Pixelart Koleksiyonu)
    this.load.spritesheet('coin_gold', 'assets/pixelart/coins/spr_coin_ama.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('coin_blue', 'assets/pixelart/coins/spr_coin_azu.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('coin_red', 'assets/pixelart/coins/spr_coin_roj.png', {
      frameWidth: 16,
      frameHeight: 16,
    });
    this.load.spritesheet('coin_gray', 'assets/pixelart/coins/spr_coin_gri.png', {
      frameWidth: 16,
      frameHeight: 16,
    });

    this.load.image('ui_buttons', 'assets/pixelart/ui/ui_buttons_elements.png');
    this.load.image('ui_banners', 'assets/pixelart/ui/ui_banners_badges.png');
    this.load.image('ui_cards', 'assets/pixelart/ui/ui_card_frames.png');
    this.load.image('ui_bars_gauges', 'assets/pixelart/ui/ui_bars_gauges.png');

    // FX Spritesheets
    this.load.spritesheet('hit_spark', 'assets/pixelart/fx/hit_spark_spritesheet.png', {
      frameWidth: 100,
      frameHeight: 100,
    });
    this.load.spritesheet('fire_explosion', 'assets/pixelart/fx/fire_explosion_spritesheet.png', {
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

    /* CrazyGames oyun döngüsü başlangıcı */
    crazyGames.gameplayStart();

    /* Arka plan dokusu */
    this.bgTile = this.add.tileSprite(0, 0, 100, 100, 'factory_bg').setOrigin(0, 0).setDepth(0);

    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    /* Hangar Tedarik Köprüsü ve Fabrika Simülasyon Ekonomisi */
    this.factoryEconomy = new FactoryEconomy(0, undefined, this.economy);
    this.hangarBridge = new RocketHangarBridge();
    this.hangarBridge.syncModuleLevels(this.economy.getAllRocketUpgrades());

    /* 2D Fabrika Mekânsal Izgarası ve Simülasyon Motorları */
    this.gridMap = new GridMap(24, 24);
    this.plotManager = new PlotExpansionManager(this.factoryEconomy, this.gridMap);
    this.milestones = new MilestoneManager();
    this.logistics = new LogisticsNetwork(this.gridMap);
    this.productionEngine = new ProductionEngine(this.gridMap, this.logistics);

    /* 2D Fabrika Zemin ve Render Katmanları */
    this.gridView = new GridView(this, this.gridMap, this.factoryEconomy);
    this.conveyorRenderer = new ConveyorRenderer(this, this.logistics, this.gridMap);
    this.machineRenderer = new MachineRenderer(this, this.productionEngine);

    this.itemContainer = this.add.container(0, 0);
    this.itemPool = new ItemSpritePool(this, defaultItemRegistry, this.itemContainer, {
      fallbackTextureKey: 'pickup_gear',
      defaultScale: 1.0,
    });
    this.itemFlowAnimator = new ItemFlowAnimator(
      this,
      this.logistics,
      this.itemPool,
      this.conveyorRenderer,
    );

    this.machineStatusIndicator = new MachineStatusIndicator(
      this,
      this.productionEngine,
      this.machineRenderer,
    );

    // Derinlik katmanları
    this.gridView.rootContainer.setDepth(1);
    this.conveyorRenderer.rootContainer.setDepth(5);
    this.machineRenderer.rootContainer.setDepth(10);
    this.itemContainer.setDepth(15);
    this.machineStatusIndicator.rootContainer.setDepth(20);

    // Tıklama ve Etkileşim Dinleyicileri (Yerleşim ve Yıkım modları aktifken engellenir)
    // Araç basışı tüketip aynı basışta kapansa bile bırakış hücre tıklaması sayılmasın
    this.gridView.canStartCellClick = () =>
      !this.placementController?.isActive && !this.demolishTool?.isActive;
    this.gridView.onCellClicked = (coord) => {
      if (this.placementController?.isActive || this.demolishTool?.isActive) return;

      const cell = this.gridMap.getCell(coord.x, coord.y);
      if (cell?.type === 'INTAKE') {
        this.terminalModal.open('INTAKE', coord);
        return;
      }
      if (cell?.type === 'EXPORT') {
        this.terminalModal.open('EXPORT', coord);
        return;
      }

      this.onClickProduce();
    };
    this.conveyorRenderer.onConveyorClicked = (_coord) => {
      if (this.placementController?.isActive || this.demolishTool?.isActive) return;
      this.onClickProduce();
    };
    this.machineRenderer.onMachineClicked = (machine) => {
      if (this.placementController?.isActive || this.demolishTool?.isActive) return;
      this.machineInspectorModal.open(machine);
    };

    this.gridView.onPlotUnlockRequested = (plotIndex) => {
      const res = this.plotManager.unlockPlot(plotIndex);
      if (res.success) {
        sound.playMilestone();
        PlotExpansionManager.playUnlockCelebration(this, res, 32);
        this.gridView.refresh();
        // Yeni açılan alan görünsün diye kamerayı büyüyen fabrikaya yeniden sığdır
        this.cameraController.fitToFactory();
        this.saveGame();
        this.refreshUI();
        this.showNotification(`PARSEL AÇILDI! ${res.plotName} (${res.newBounds.width}x${res.newBounds.height})`);
      } else {
        if (res.error === 'PREVIOUS_PLOT_REQUIRED') {
          this.showNotification('Önce önceki parseli açmalısın!');
        } else if (res.error === 'INSUFFICIENT_FUNDS') {
          this.showNotification(`Yetersiz bakiye! Parsel bedeli: $${res.cost}`);
        } else if (res.error === 'ALREADY_UNLOCKED') {
          this.showNotification('Bu parsel zaten açık!');
        }
      }
    };

    // İhracat Teslimatı (EXPORT Delivery Event)
    this.logistics.onItemDelivered = (event: DeliveredItemEvent) => {
      this.milestones.recordExport(event.itemId);
      const exportWorld = GridCoordinates.gridToWorldCenter(event.exportCoord, 32);

      // Roketin sıradaki yükseltmesinin beklediği parça satılmaz, hangara gider
      if (
        this.milestones.isFeatureUnlocked(HANGAR_FEATURE) &&
        this.hangarBridge.getOutstandingNeed(event.itemId) > 0
      ) {
        this.hangarBridge.depositPart(event.itemId);
        if (this.isCatchingUp) return;
        fx.emitFloatingText(this, exportWorld.x, exportWorld.y - 12, '→ HANGAR', PALETTE.rocketCyanHex);
        if (this.hangarBridge.getOutstandingNeed(event.itemId) === 0) {
          const ready = this.hangarBridge.getModulesCompletedBy(event.itemId);
          if (ready.length > 0) {
            sound.playMilestone();
            this.showNotification('Roket parçaları hazır! Hangarı aç ve yükselt.');
          }
          this.rocketHangar.refresh();
          this.saveGame();
        }
        return;
      }

      const earned = this.factoryEconomy.exportItem(event.itemId);
      if (this.isCatchingUp) return;
      fx.emitSparkles(this, exportWorld.x, exportWorld.y, 8, PALETTE.resourceGold);
      sound.playCoin();
      fx.emitFloatingText(
        this,
        exportWorld.x,
        exportWorld.y - 12,
        `+$${formatMoney(earned)}`,
        PALETTE.resourceGoldHex,
      );
      this.onProductDeliveredToShipping(earned, exportWorld.x, exportWorld.y);
      this.refreshUI();
    };

    /* Bağımsız Fabrika Katı Viewport Kamerası */
    this.factoryCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.factoryCamera.setBackgroundColor(PALETTE.bgDeepHex);
    this.cameraController = new CameraController(
      this,
      {
        enableKeyboard: true,
        enableWheelZoom: true,
        enableDragPan: true,
      },
      this.factoryCamera,
    );
    this.cameraController.attachGridView(this.gridView);
    this.cameraController.fitToFactory();

    // Kamera Katmanlama Sırası:
    // factoryCamera (dünya) önce çizilir (index 0).
    // cameras.main (UI, HUD ve Modallar) onun ÜSTÜNE çizilir (index 1).
    const mainIdx = this.cameras.cameras.indexOf(this.cameras.main);
    const factoryIdx = this.cameras.cameras.indexOf(this.factoryCamera);
    if (mainIdx !== -1 && factoryIdx !== -1 && mainIdx < factoryIdx) {
      this.cameras.cameras[mainIdx] = this.factoryCamera;
      this.cameras.cameras[factoryIdx] = this.cameras.main;
    }

    /* İnşa ve Yerleşim Kontrolcüsü */
    this.placementController = new PlacementController(
      this,
      this.gridMap,
      this.logistics,
      this.productionEngine,
      this.factoryEconomy,
      {
        camera: this.factoryCamera,
        autoCloseMachines: true,
        onPlaced: (result) => {
          if (result.itemType === 'INTAKE_NEW') {
            this.gridView.refresh();
            const itemId = this.gridMap.getCell(result.coord.x, result.coord.y)?.intakeData?.itemId ?? '';
            const name = defaultItemRegistry.get(itemId)?.name ?? 'Hammadde';
            this.showNotification(`${name} Girişi kuruldu! (-$${result.spentMoney})`);
          } else if (result.itemType === 'INTAKE_MOVE' || this.placementController.currentItem?.type === 'INTAKE_MOVE') {
            this.gridView.refresh();
            this.showNotification(`Hammadde Girişi (${result.coord.x}, ${result.coord.y}) konumuna taşındı!`);
          } else if (result.itemType === 'EXPORT_MOVE' || this.placementController.currentItem?.type === 'EXPORT_MOVE') {
            this.gridView.refresh();
            this.showNotification(`Sevkiyat Sandığı (${result.coord.x}, ${result.coord.y}) konumuna taşındı!`);
          } else if (result.instanceId) {
            this.machineRenderer.rebuild();
            this.machineStatusIndicator.rebuild();
            const machineDef = this.productionEngine.getMachine(result.instanceId)?.def;
            const name = machineDef?.name ?? 'Makine';
            this.showNotification(`${name} kuruldu! (-$${result.spentMoney})`);
          } else {
            this.conveyorRenderer.rebuild();
            this.showNotification(`Bant döşendi! (-$${result.spentMoney})`);
          }
          sound.playUpgrade();
          const worldPos = GridCoordinates.gridToWorldCenter(result.coord, 32);
          fx.emitSparkles(this, worldPos.x, worldPos.y, 14, PALETTE.resourceGold);
          this.saveGame();
          this.refreshUI();
          if (!this.placementController.isActive) {
            this.placementBarContainer.setVisible(false);
          } else {
            this.updatePlacementBarVisuals();
          }
        },
        onCancel: () => {
          this.placementBarContainer.setVisible(false);
        },
      },
    );

    /* Makine İnceleme ve Yükseltme Modalı */
    this.machineInspectorModal = new MachineInspectorModal(
      this,
      this.productionEngine,
      this.factoryEconomy,
      {
        onUpgrade: (machine, level) => {
          this.machineRenderer.rebuild();
          this.machineStatusIndicator.rebuild();
          sound.playUpgrade();
          fx.emitSparkles(this, this.scale.width / 2, this.scale.height / 2, 16, PALETTE.resourceGold);
          this.saveGame();
          this.refreshUI();
          this.showNotification(`${machine.def.name} Seviye ${level}'e yükseltildi!`);
        },
        onRecipeChanged: (machine, _recipeId) => {
          this.saveGame();
          sound.playCoin();
          this.showNotification(`${machine.def.name}: Tarif güncellendi!`);
        },
        onDemolishRequested: (machine) => {
          const result = DemolishMath.executeDemolish({
            grid: this.gridMap,
            logistics: this.logistics,
            engine: this.productionEngine,
            economy: this.factoryEconomy,
            coord: machine.coord,
          });
          if (result.success) {
            this.machineRenderer.rebuild();
            this.machineStatusIndicator.rebuild();
            sound.playDemolish();
            const worldPos = GridCoordinates.gridToWorldCenter(machine.coord, 32);
            fx.emitSparkles(this, worldPos.x, worldPos.y, 16, PALETTE.dangerRed);
            this.saveGame();
            this.refreshUI();
            this.showNotification(`${result.name} söküldü! (+$${result.refundAmount} İade)`);
          }
        },
      },
    );

    /* Yıkım ve Taşıma Aracı */
    this.demolishTool = new DemolishTool(
      this,
      this.gridMap,
      this.logistics,
      this.productionEngine,
      this.factoryEconomy,
      {
        camera: this.factoryCamera,
        onDemolished: (result) => {
          if (result.targetType === 'MACHINE') {
            this.machineRenderer.rebuild();
            this.machineStatusIndicator.rebuild();
            this.showNotification(`${result.name} söküldü! (+$${result.refundAmount} İade)`);
          } else {
            this.conveyorRenderer.rebuild();
            this.showNotification(`${result.name} söküldü! (+$${result.refundAmount} İade)`);
          }
          sound.playDemolish();
          const firstCoord = result.freedCoords[0];
          if (firstCoord) {
            const worldPos = GridCoordinates.gridToWorldCenter(firstCoord, 32);
            fx.emitSparkles(this, worldPos.x, worldPos.y, 14, PALETTE.dangerRed);
          }
          this.saveGame();
          this.refreshUI();
        },
        onCancel: () => {
          this.demolishBarContainer.setVisible(false);
        },
        onProtectedClicked: (name) => {
          sound.playDemolish();
          this.showNotification(`⚠️ ${name} silinemez! Taşımak için TAŞI seçeneğini kullanın.`);
        },
      },
    );

    // Yerleşim veya Yıkım modunda sol tık ile sürükleme yerine ilgili araç işlemi yapılır
    this.cameraController.canPan = () => !this.placementController.isActive && !this.demolishTool.isActive;

    /* Terminal İnceleme ve Taşıma Modalı */
    this.terminalModal = new TerminalInspectorModal(this, {
      onRelocate: (type, sourceCoord) => {
        const placementType = type === 'INTAKE' ? 'INTAKE_MOVE' : 'EXPORT_MOVE';
        const src =
          sourceCoord ??
          (type === 'INTAKE'
            ? this.gridMap.getIntakeCells()[0]?.coord
            : this.gridMap.getExportCells()[0]?.coord);
        this.startPlacement({
          type: placementType,
          sourceCoord: src,
        });
      },
      getIntakeItemName: (coord) => {
        const cell = coord
          ? this.gridMap.getCell(coord.x, coord.y)
          : this.gridMap.getIntakeCells()[0];
        return defaultItemRegistry.get(cell?.intakeData?.itemId ?? '')?.name;
      },
    });

    /* İnşa ve Makine Kataloğu Modalı */
    this.buildMenuModal = new BuildMenuModal(this, this.factoryEconomy, {
      onSelectItem: (item) => {
        this.buildMenuModal.hide();
        this.startPlacement(item);
      },
      onDemolishRequested: () => {
        this.buildMenuModal.hide();
        this.startDemolishMode();
      },
      onRelocateRequested: () => {
        this.buildMenuModal.hide();
        this.terminalModal.open('CHOICE');
      },
      getLockStage: (cardId) => this.getCatalogLockStage(cardId),
    });

    // Ana kamera (HUD & UI) fabrikayı, zemin arka planını, yerleşim hayaletini ve yıkım katmanını çizmez
    this.cameras.main.ignore([
      this.bgTile,
      this.gridView.rootContainer,
      this.conveyorRenderer.rootContainer,
      this.machineRenderer.rootContainer,
      this.itemContainer,
      this.machineStatusIndicator.rootContainer,
      this.placementController.ghostContainer,
      this.demolishTool.overlayContainer,
    ]);

    /* Alt Konsol Gövdesi (Arcade Control Deck Grounding) */
    this.consoleDeckBg = PixelUIHelper.createPanel(this, 0, 0, 100, 60).setDepth(40);

    /* 1. Manuel Üretim Düğmesi */
    this.manualBtnContainer = this.add.container(0, 0).setDepth(45);
    this.manualBtnBg = PixelUIHelper.createButton(this, 0, 0, this.dockBtnW, this.dockBtnH, 'manual');
    this.manualBtnContainer.add(this.manualBtnBg);

    this.manualBtnIcon = this.add.image(-34, -4, 'icon_gear').setOrigin(0.5);
    this.manualBtnContainer.add(this.manualBtnIcon);

    this.manualBtnText = this.add.text(10, -5, 'MANUEL ÜRET', {
      ...font, fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#381600', strokeThickness: 2,
    }).setOrigin(0.5);
    this.manualBtnContainer.add(this.manualBtnText);

    this.manualBtnSubText = this.add.text(0, 9, '+1 / tık', {
      ...font, fontSize: '8.5px', color: '#ffedd5', fontStyle: 'bold',
      stroke: '#281000', strokeThickness: 1.5,
    }).setOrigin(0.5);
    this.manualBtnContainer.add(this.manualBtnSubText);

    this.manualZone = this.add.zone(0, 0, this.dockBtnW, this.dockBtnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.manualBtnBg.setTexture('btn_manual_pressed');
        this.onClickProduce();
      })
      .on('pointerup', () => this.manualBtnBg.setTexture('btn_manual_hover'))
      .on('pointerover', () => this.manualBtnBg.setTexture('btn_manual_hover'))
      .on('pointerout', () => this.manualBtnBg.setTexture('btn_manual_normal'));
    this.manualBtnContainer.add(this.manualZone);

    /* 2. Bant Döşe Butonu ($5) */
    this.conveyorBtnContainer = this.add.container(0, 0).setDepth(45);
    this.conveyorBtnBg = PixelUIHelper.createButton(this, 0, 0, this.dockBtnW, this.dockBtnH, 'green');
    this.conveyorBtnContainer.add(this.conveyorBtnBg);

    this.conveyorBtnIcon = this.add.image(-34, -4, 'icon_lightning').setOrigin(0.5);
    this.conveyorBtnContainer.add(this.conveyorBtnIcon);

    this.conveyorBtnText = this.add.text(10, -5, 'BANT DÖŞE', {
      ...font, fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#082810', strokeThickness: 2,
    }).setOrigin(0.5);
    this.conveyorBtnContainer.add(this.conveyorBtnText);

    this.conveyorBtnSubText = this.add.text(0, 9, `$${CONVEYOR_BUILD_COST}`, {
      ...font, fontSize: '8.5px', color: '#dcfce7', fontStyle: 'bold',
      stroke: '#082810', strokeThickness: 1.5,
    }).setOrigin(0.5);
    this.conveyorBtnContainer.add(this.conveyorBtnSubText);

    this.conveyorZone = this.add.zone(0, 0, this.dockBtnW, this.dockBtnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.conveyorBtnBg.setTexture('btn_green_pressed');
        if (this.demolishTool?.isActive) this.cancelDemolishMode();
        this.startPlacement({ type: 'CONVEYOR' });
      })
      .on('pointerup', () => this.conveyorBtnBg.setTexture('btn_green_hover'))
      .on('pointerover', () => this.conveyorBtnBg.setTexture('btn_green_hover'))
      .on('pointerout', () => this.conveyorBtnBg.setTexture('btn_green_normal'));
    this.conveyorBtnContainer.add(this.conveyorZone);

    /* 3. Makine Kur Butonu (Katalog) */
    this.buildBtnContainer = this.add.container(0, 0).setDepth(45);
    this.buildBtnBg = PixelUIHelper.createButton(this, 0, 0, this.dockBtnW, this.dockBtnH, 'green');
    this.buildBtnContainer.add(this.buildBtnBg);

    this.buildBtnIcon = this.add.image(-34, -4, 'icon_factory').setOrigin(0.5);
    this.buildBtnContainer.add(this.buildBtnIcon);

    this.buildBtnText = this.add.text(10, -5, 'MAKİNE KUR', {
      ...font, fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#082810', strokeThickness: 2,
    }).setOrigin(0.5);
    this.buildBtnContainer.add(this.buildBtnText);

    this.buildBtnSubText = this.add.text(0, 9, 'Katalog', {
      ...font, fontSize: '8.5px', color: '#dcfce7', fontStyle: 'bold',
      stroke: '#082810', strokeThickness: 1.5,
    }).setOrigin(0.5);
    this.buildBtnContainer.add(this.buildBtnSubText);

    this.buildZone = this.add.zone(0, 0, this.dockBtnW, this.dockBtnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.buildBtnBg.setTexture('btn_green_pressed');
        if (this.placementController.isActive) this.placementController.cancelPlacement();
        if (this.demolishTool?.isActive) this.cancelDemolishMode();
        this.buildMenuModal.show();
      })
      .on('pointerup', () => this.buildBtnBg.setTexture('btn_green_hover'))
      .on('pointerover', () => this.buildBtnBg.setTexture('btn_green_hover'))
      .on('pointerout', () => this.buildBtnBg.setTexture('btn_green_normal'));
    this.buildBtnContainer.add(this.buildZone);

    /* 4. Roket Hangarı Butonu */
    this.hangarBtnContainer = this.add.container(0, 0).setDepth(45);
    this.hangarBtnBg = PixelUIHelper.createButton(this, 0, 0, this.dockBtnW, this.dockBtnH, 'launch');
    this.hangarBtnContainer.add(this.hangarBtnBg);

    this.hangarBtnIcon = this.add.image(-34, -5, 'icon_rocket').setOrigin(0.5);
    this.hangarBtnContainer.add(this.hangarBtnIcon);

    this.hangarBtnText = this.add.text(10, -5, 'HANGAR', {
      ...font, fontSize: '11px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#042323', strokeThickness: 2,
    }).setOrigin(0.5);
    this.hangarBtnContainer.add(this.hangarBtnText);

    this.hangarBtnSubText = this.add.text(0, 9, 'Geliştir & Uç', {
      ...font, fontSize: '8.5px', color: '#cbf8f2', fontStyle: 'bold',
      stroke: '#042323', strokeThickness: 1.5,
    }).setOrigin(0.5);
    this.hangarBtnContainer.add(this.hangarBtnSubText);

    this.hangarZone = this.add.zone(0, 0, this.dockBtnW, this.dockBtnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.hangarBtnBg.setTexture('btn_launch_pressed');
        if (this.placementController.isActive) this.placementController.cancelPlacement();
        if (this.demolishTool?.isActive) this.cancelDemolishMode();
        if (!this.milestones.isFeatureUnlocked(HANGAR_FEATURE)) {
          const stage = this.milestones.getFeatureUnlockStage(HANGAR_FEATURE);
          this.showNotification(`Roket Hangarı ${stage}. aşamada açılır.`);
          return;
        }
        this.rocketHangar.show();
      })
      .on('pointerup', () => this.hangarBtnBg.setTexture('btn_launch_hover'))
      .on('pointerover', () => this.hangarBtnBg.setTexture('btn_launch_hover'))
      .on('pointerout', () => this.hangarBtnBg.setTexture('btn_launch_normal'));
    this.hangarBtnContainer.add(this.hangarZone);

    /* Aktif Yerleşim Çubuğu (Active Placement Floating Action Bar) */
    this.placementBarContainer = this.add.container(0, 0).setDepth(55).setVisible(false);
    this.placementBarBg = PixelUIHelper.createToast(this, 0, 0, 460, 36);
    this.placementBarContainer.add(this.placementBarBg);

    this.placementBarText = this.add.text(-60, 0, 'YERLEŞTİRİLİYOR...', {
      ...font, fontSize: '11.5px', color: '#ffffff', fontStyle: 'bold',
      stroke: '#080c18', strokeThickness: 2,
    }).setOrigin(0.5);
    this.placementBarContainer.add(this.placementBarText);

    // Döndür Butonu
    this.placementRotateBg = PixelUIHelper.createButton(this, 134, 0, 92, 26, 'green');
    this.placementBarContainer.add(this.placementRotateBg);
    this.placementRotateText = this.add.text(134, 0, 'DÖNDÜR (R)', {
      ...font, fontSize: '9.5px', color: '#ffffff', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.placementBarContainer.add(this.placementRotateText);
    this.placementRotateZone = this.add.zone(134, 0, 92, 26)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.placementRotateBg.setTexture('btn_green_pressed');
        this.placementController.rotate(true);
      })
      .on('pointerup', () => this.placementRotateBg.setTexture('btn_green_hover'))
      .on('pointerover', () => this.placementRotateBg.setTexture('btn_green_hover'))
      .on('pointerout', () => this.placementRotateBg.setTexture('btn_green_normal'));
    this.placementBarContainer.add(this.placementRotateZone);

    // İptal Butonu
    this.placementCancelBg = PixelUIHelper.createButton(this, 196, 0, 26, 26, 'danger');
    this.placementBarContainer.add(this.placementCancelBg);
    this.placementCancelIcon = this.add.image(196, 0, 'icon_close').setOrigin(0.5).setScale(0.8);
    this.placementBarContainer.add(this.placementCancelIcon);
    this.placementCancelZone = this.add.zone(196, 0, 26, 26)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.placementCancelBg.setTexture('btn_danger_pressed');
        this.placementController.cancelPlacement();
      })
      .on('pointerup', () => this.placementCancelBg.setTexture('btn_danger_normal'))
      .on('pointerover', () => this.placementCancelBg.setTexture('btn_danger_pressed'))
      .on('pointerout', () => this.placementCancelBg.setTexture('btn_danger_normal'));
    this.placementBarContainer.add(this.placementCancelZone);

    /* Aktif Yıkım Çubuğu (Active Demolish Floating Action Bar) */
    this.demolishBarContainer = this.add.container(0, 0).setDepth(55).setVisible(false);
    this.demolishBarBg = PixelUIHelper.createToast(this, 0, 0, 460, 36);
    this.demolishBarContainer.add(this.demolishBarBg);

    this.demolishBarText = this.add.text(-40, 0, '⚠️ SÖKÜM MODU (X) | Sökmek istediğin nesneye tıkla (%100 İade)', {
      ...font, fontSize: '11px', color: '#ffb4b4', fontStyle: 'bold',
      stroke: '#280c0c', strokeThickness: 2,
    }).setOrigin(0.5);
    this.demolishBarContainer.add(this.demolishBarText);

    // Yıkım İptal Butonu
    this.demolishCancelBg = PixelUIHelper.createButton(this, 196, 0, 26, 26, 'danger');
    this.demolishBarContainer.add(this.demolishCancelBg);
    this.demolishCancelIcon = this.add.image(196, 0, 'icon_close').setOrigin(0.5).setScale(0.8);
    this.demolishBarContainer.add(this.demolishCancelIcon);
    this.demolishCancelZone = this.add.zone(196, 0, 26, 26)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => {
        this.demolishCancelBg.setTexture('btn_danger_pressed');
        this.cancelDemolishMode();
      })
      .on('pointerup', () => this.demolishCancelBg.setTexture('btn_danger_normal'))
      .on('pointerover', () => this.demolishCancelBg.setTexture('btn_danger_pressed'))
      .on('pointerout', () => this.demolishCancelBg.setTexture('btn_danger_normal'));
    this.demolishBarContainer.add(this.demolishCancelZone);

    /* Bildirim alanı (Raster 9-Slice Toast) */
    this.notificationBgSlice = PixelUIHelper.createToast(this, 0, 0, 100, 32).setDepth(150).setAlpha(0);
    this.notificationText = this.add.text(0, 0, '', {
      ...font, fontSize: '13px', color: '#ffffff', fontStyle: 'bold',
      align: 'center', wordWrap: { width: 340 },
    }).setOrigin(0.5).setDepth(151).setAlpha(0);

    /* Roket Hangarı & Fırlatma Rampası (Pop-up Modal Penceresi) */
    this.rocketHangar = new RocketHangarView(
      this,
      this.economy,
      () => this.startFlight(),
      this.hangarBridge,
      this.factoryEconomy,
    );

    /* HUD */
    this.hud = new HUD(this, () => this.settingsPanel.show());

    /* Kilometre Taşı / Hedef Çubuğu */
    this.milestoneBar = new MilestoneBar(this);

    /* Ayarlar paneli */
    this.settingsPanel = new SettingsPanel(this, () => this.resetGame());

    /* Çevrimdışı İlerleme / Hoş Geldin Modalı */
    this.offlineEarningsModal = new OfflineEarningsModal(this, {
      onClaim: (gained) => {
        this.economy.addResources(gained);
        this.saveGame();
        this.refreshUI();
        this.showNotification(`+$${formatNumber(gained)} kasana eklendi!`);
      },
      onDoubleClaim: async (gained) => {
        // CrazyGames Rewarded Video Reklamı
        const watched = await crazyGames.requestAd('rewarded');
        if (!watched) {
          this.showNotification('Reklam tamamlanamadı, ödül verilemedi.');
          return;
        }
        this.economy.addResources(gained);
        this.saveGame();
        this.refreshUI();
        this.showNotification(`🎉 2X ÖDÜL! +$${formatNumber(gained)} kasana eklendi!`);
      },
    });

    /* Fabrika kamerası UI bileşenlerini çizmez */
    this.hud.ignoreCamera(this.factoryCamera);
    this.milestoneBar.ignoreCamera(this.factoryCamera);
    this.buildMenuModal.ignoreCamera(this.factoryCamera);
    this.machineInspectorModal.ignoreCamera(this.factoryCamera);
    this.terminalModal.ignoreCamera(this.factoryCamera);
    this.factoryCamera.ignore([
      this.bgTile,
      this.consoleDeckBg,
      this.manualBtnContainer,
      this.conveyorBtnContainer,
      this.buildBtnContainer,
      this.hangarBtnContainer,
      this.placementBarContainer,
      this.demolishBarContainer,
      this.notificationBgSlice,
      this.notificationText,
      this.rocketHangar.container,
      this.machineInspectorModal.container,
      this.terminalModal.container,
      this.settingsPanel.container,
      this.offlineEarningsModal.rootContainer,
    ]);

    /* İlk yerleşim */
    this.layoutAll();
    // ScaleManager oyun geneline aittir: sahne yeniden başlatılınca (kayıt sıfırlama)
    // eski dinleyici birikmesin diye kapanışta kaldırılır.
    this.scale.on('resize', this.layoutAll, this);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', this.layoutAll, this);
    });

    /* Ekonomi olayları */
    this.economy.on((evt) => {
      if (evt.type === 'rocket_upgrade') {
        sound.playUpgrade();
        fx.emitSparkles(this, this.scale.width / 2, this.scale.height / 2, 20, PALETTE.rocketCyan);
        this.saveGame();
        this.rocketHangar.refresh();
        this.showNotification(`Roket geliştirildi! Seviye ${evt.newLevel}`);
      }
    });

    /* Kayıt yükle */
    this.loadGame();

    /* İlk UI güncellemesi */
    this.refreshUI();
  }

  /* ================================================================
   * FIRLATMA VE UÇUŞ SAHNESİ GEÇİŞİ
   * ================================================================ */

  private startFlight(): void {
    if (this.placementController?.isActive) {
      this.placementController.cancelPlacement();
    }
    if (this.demolishTool?.isActive) {
      this.cancelDemolishMode();
    }
    if (this.machineInspectorModal?.isOpen) {
      this.machineInspectorModal.close();
    }
    if (this.terminalModal?.isOpen) {
      this.terminalModal.close();
    }
    sound.playLaunch();
    this.cameraController.setEnabled(false);
    this.flightStartedAtMs = Date.now();
    this.saveGame();
    crazyGames.gameplayStop();
    this.scene.pause('GameScene');
    this.scene.launch('FlightScene', {
      economy: this.economy,
      bridge: this.hangarBridge,
      factoryEconomy: this.factoryEconomy,
    });
  }

  /** Uçuş tamamlandığında FlightScene'den çağrılır */
  onReturnFromFlight(totalResources: number, distance: number): void {
    crazyGames.gameplayStart();
    sound.playCoin();
    fx.emitSparkles(this, this.scale.width / 2, 120, 20, PALETTE.successGreen);
    this.cameraController.setEnabled(true);
    const factoryEarned = this.catchUpFactory((Date.now() - this.flightStartedAtMs) / 1000);
    this.gridView.refresh();
    this.saveGame();
    this.refreshUI();
    this.rocketHangar.refresh();

    const multiplier = this.factoryEconomy ? this.factoryEconomy.revenueMultiplier : 1.0;
    const bonusText = multiplier > 1.0 ? ` (x${multiplier.toFixed(2)} Fabrika Çarpanı)` : '';
    const factoryText = factoryEarned > 0 ? `\nSen uçarken fabrika +$${formatNumber(factoryEarned)} kazandı` : '';

    this.showNotification(
      `Uçuş primi +$${formatNumber(totalResources)} (${distance}m)${bonusText}${factoryText}`,
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

  /** Fabrika simülasyonunu bir adım ilerletir (gelir ölçümü, bantlar, makineler) */
  private stepSimulation(dt: number): void {
    this.factoryEconomy.tick(dt);
    this.logistics.tick(dt);
    this.productionEngine.tick(dt);
  }

  /**
   * Uçuş boyunca duraklatılan fabrikayı geçen süre kadar ilerletir (DEC-016).
   * Simülasyon gerçekten çalıştırılır; görsel/işitsel geri bildirim bastırılır.
   * Fabrikanın bu sürede kazandığı parayı döner.
   */
  private catchUpFactory(elapsedSec: number): number {
    const seconds = Phaser.Math.Clamp(elapsedSec, 0, FLIGHT_CATCH_UP_MAX_SEC);
    const moneyBefore = this.factoryEconomy.money;

    this.isCatchingUp = true;
    for (let remaining = seconds; remaining > 0; remaining -= FLIGHT_CATCH_UP_STEP_SEC) {
      this.stepSimulation(Math.min(FLIGHT_CATCH_UP_STEP_SEC, remaining));
    }
    this.isCatchingUp = false;

    return Math.max(0, this.factoryEconomy.money - moneyBefore);
  }

  update(_time: number, delta: number): void {
    if (this.settingsPanel.visible) return;

    const dt = delta / 1000;

    /* 2D Simülasyon adımları */
    this.stepSimulation(dt);

    /* 2D Görsel akış ve animasyonlar (60 FPS) */
    this.conveyorRenderer.update(dt);
    this.itemFlowAnimator.update(dt);
    this.machineRenderer.update(dt);
    this.machineStatusIndicator.update(dt);

    /* Makine İnceleme Modalı Canlı Yenileme */
    if (this.machineInspectorModal?.isOpen) {
      this.machineInspectorModal.update(_time, delta);
    }

    /* Yıkım çubuğu görünürlük senkronizasyonu (Klavye X veya ESC ile açılıp kapandığında) */
    if (this.demolishTool?.isActive !== this.demolishBarContainer.visible) {
      this.demolishBarContainer.setVisible(this.demolishTool.isActive);
    }

    /* Kamera kontrolleri (Herhangi bir modal açık değilse) */
    const isAnyModalOpen =
      this.settingsPanel.visible ||
      this.buildMenuModal.isOpen() ||
      this.machineInspectorModal?.isOpen ||
      this.terminalModal?.isOpen ||
      this.rocketHangar.isOpen() ||
      this.offlineEarningsModal.isOpen();

    if (isAnyModalOpen && this.placementController?.isActive) {
      this.placementController.cancelPlacement();
    }
    if (isAnyModalOpen && this.demolishTool?.isActive) {
      this.cancelDemolishMode();
    }

    this.cameraController.setEnabled(!isAnyModalOpen);
    if (!isAnyModalOpen) {
      this.cameraController.update(dt);
    }

    /* Kamera hareketinden sonra araç önizlemelerini imleçle yeniden eşle */
    this.placementController.update();
    this.demolishTool.update();

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
    sound.initContext();
    sound.playCoin();
    const gained = this.economy.produceByClick();

    /* Düğme esneme animasyonu */
    this.tweens.add({
      targets: this.manualBtnContainer,
      scaleX: 0.94, scaleY: 0.94,
      duration: 60, yoyo: true,
      ease: 'Quad.easeOut',
    });

    /* HUD titreşimi */
    this.hud.pulse();

    /* Yüzen +N metni ve kıvılcım */
    const cx = this.manualBtnContainer.x + Phaser.Math.Between(-10, 10);
    const cy = this.manualBtnContainer.y - this.dockBtnH / 2;
    fx.emitFloatingText(this, cx, cy, `+${formatNumber(gained)}`, PALETTE.resourceGoldHex);
    fx.emitSparkles(this, cx, cy, 6, PALETTE.resourceGold);
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
        sound.playCoin();
        fx.emitSparkles(this, target.x, target.y, 6, PALETTE.resourceGold);
      },
    });
  }

  /* ================================================================
   * AŞAMALAR (İLERLEME MÜFREDATI)
   * ================================================================ */

  /** Aktif aşamanın koşulları sağlandıysa ödülünü verir ve sıradakine geçer */
  private claimCompletedMilestones(): void {
    while (this.milestones.canClaimCurrentMilestone(this.factoryEconomy, this.productionEngine)) {
      const result = this.milestones.claimCurrentMilestone(this.factoryEconomy, this.productionEngine);
      if (!result.success || !result.claimedMilestone || !result.reward) return;

      crazyGames.happytime();
      sound.playMilestone();
      fx.emitConfetti(this, this.scale.width / 2, 80, 32);
      this.milestoneBar.playGoalReachedEffect();
      this.showNotification(
        `AŞAMA TAMAMLANDI: ${result.claimedMilestone.name}\n${result.reward.description}`,
      );
      this.saveGame();
    }
  }

  /** Katalog kartı kilitliyse onu açacak aşamanın numarası; açıksa null */
  private getCatalogLockStage(cardId: string): number | null {
    if (cardId === 'splitter' || cardId === 'merger') {
      return this.milestones.isFeatureUnlocked(SPLITTER_MERGER_FEATURE)
        ? null
        : this.milestones.getFeatureUnlockStage(SPLITTER_MERGER_FEATURE);
    }
    if (defaultMachineRegistry.has(cardId) && !this.milestones.isMachineUnlocked(cardId)) {
      return this.milestones.getMachineUnlockStage(cardId);
    }
    if (cardId.startsWith(INTAKE_CARD_PREFIX)) {
      const feature = INTAKE_UNLOCK_FEATURES[cardId.slice(INTAKE_CARD_PREFIX.length)];
      if (feature && !this.milestones.isFeatureUnlocked(feature)) {
        return this.milestones.getFeatureUnlockStage(feature);
      }
    }
    return null;
  }

  /* ================================================================
   * UI GÜNCELLEME
   * ================================================================ */

  private refreshUI(): void {
    /* HUD: saniyelik gelir, fabrikanın son bir dakikada ölçülen ihracat geliridir */
    const revenuePerSec = this.factoryEconomy.getRevenuePerSec();
    this.hud.update(
      this.economy.resources,
      revenuePerSec,
      this.economy.stats.bestDistance,
    );

    /* Aşama Çubuğu: tamamlanan aşamanın ödülünü ver, sonra sıradaki görevi göster */
    this.claimCompletedMilestones();
    this.milestoneBar.updateMilestone(
      this.milestones.getCurrentProgress(this.factoryEconomy, this.productionEngine),
      this.milestones.completedCount,
      this.milestones.totalCount,
      revenuePerSec,
    );

    /* Hangar düğmesi: açılana kadar hangi aşamada açılacağını söyler */
    const hangarUnlocked = this.milestones.isFeatureUnlocked(HANGAR_FEATURE);
    this.hangarBtnSubText.setText(
      hangarUnlocked
        ? 'Geliştir & Uç'
        : `${this.milestones.getFeatureUnlockStage(HANGAR_FEATURE)}. aşamada`,
    );
    this.hangarBtnContainer.setAlpha(hangarUnlocked ? 1 : 0.55);

    /* Manuel üretim bilgisi */
    this.manualBtnSubText.setText(`+${formatNumber(this.economy.clickPower)} / tık`);

    /* Açık ise makine ve inşa modallarını yenile */
    if (this.buildMenuModal && this.buildMenuModal.isOpen()) {
      this.buildMenuModal.refresh();
    }
    if (this.machineInspectorModal && this.machineInspectorModal.isOpen) {
      this.machineInspectorModal.refresh();
    }

    /* Roket Hangarı Kartları ve Verileri */
    this.rocketHangar.refresh();

    /* Sıradaki parsel rozeti: para yetince alınabilir görünüme geçsin */
    this.gridView.syncLockedPlotAffordability();
  }

  /* ================================================================
   * KAYIT / YÜKLEME
   * ================================================================ */

  /**
   * Yeni oyunda 8x8 başlangıç parselinde çalışan starter konveyör ve kırıcı hattını kurar.
   */
  private setupStarterFactoryLayout(): void {
    // 1. Sabit Giriş ve Çıkış
    this.gridMap.setIntake(1, 0, 'iron_ore', 1.0);
    this.gridMap.setExport(6, 7);

    // 2. Kırıcı Makine at (1, 3) (1x1 makine)
    const crusherDef = defaultMachineRegistry.getOrThrow('crusher');
    const crusher = new MachineEntity('starter_crusher', crusherDef, { x: 1, y: 3 }, 0);
    crusher.setRecipe('recipe_crush_iron_ore');
    this.productionEngine.addMachine(crusher);

    // 3. Konveyör hatları:
    // Giriş: (1, 0) -> (1, 1) -> (1, 2) -> Kırıcı (1, 3)
    this.logistics.addConveyor({ x: 1, y: 1 }, 'SOUTH', 1.0);
    this.logistics.addConveyor({ x: 1, y: 2 }, 'SOUTH', 1.0);

    // Çıkış: Kırıcı (1, 3) -> (1, 4) -> (1, 5) -> (1, 6) -> (1, 7)
    this.logistics.addConveyor({ x: 1, y: 4 }, 'SOUTH', 1.0);
    this.logistics.addConveyor({ x: 1, y: 5 }, 'SOUTH', 1.0);
    this.logistics.addConveyor({ x: 1, y: 6 }, 'SOUTH', 1.0);

    // Viraj: (1, 7) EAST
    this.logistics.addConveyor({ x: 1, y: 7 }, 'EAST', 1.0);

    // İhracata doğru ilerleme: (2, 7), (3, 7), (4, 7), (5, 7) -> EXPORT (6, 7)
    this.logistics.addConveyor({ x: 2, y: 7 }, 'EAST', 1.0);
    this.logistics.addConveyor({ x: 3, y: 7 }, 'EAST', 1.0);
    this.logistics.addConveyor({ x: 4, y: 7 }, 'EAST', 1.0);
    this.logistics.addConveyor({ x: 5, y: 7 }, 'EAST', 1.0);
  }

  private saveGame(): void {
    const factoryLayout = FactorySerializer.serialize(
      this.gridMap,
      this.logistics,
      this.productionEngine,
      this.factoryEconomy,
    );
    SaveManager.save(this.economy.serialize(), {
      factoryEconomy: this.factoryEconomy.serialize(),
      hangar: this.hangarBridge,
      factoryLayout,
      milestones: this.milestones.serialize(),
    });
  }

  private loadGame(): void {
    const { data, wasCorrupted } = SaveManager.loadUnified();

    if (wasCorrupted) {
      this.time.delayedCall(500, () => {
        this.showNotification('Eski kayıt formatı yenilendi.');
      });
    }

    this.economy.deserialize(data.economy);

    if (data.milestones) {
      this.milestones.deserialize(data.milestones);
    }

    if (this.hangarBridge && data.hangar) {
      this.hangarBridge.deserialize(data.hangar);
    } else if (this.hangarBridge) {
      this.hangarBridge.syncModuleLevels(this.economy.getAllRocketUpgrades());
    }

    if (this.factoryEconomy && data.factoryEconomy?.unlockedPlots) {
      this.factoryEconomy.unlockedPlots = new Set(data.factoryEconomy.unlockedPlots);
      if (data.factoryEconomy.revenueMultiplier) {
        this.factoryEconomy.revenueMultiplier = data.factoryEconomy.revenueMultiplier;
      }
    }

    // Gösterge sıfırdan başlamasın: kayıt anındaki ölçülmüş gelirle başlat
    const savedRevenuePerSec = data.factoryEconomy?.revenuePerSec ?? 0;
    this.factoryEconomy.seedRevenueRate(savedRevenuePerSec);

    // 2D Fabrika yerleşimi (Conveyors, Machines, Intakes, Exports)
    if (data.factoryLayout) {
      if (data.factoryLayout.intakes) {
        for (const intake of data.factoryLayout.intakes) {
          if (this.gridMap.isInBounds(intake.coord.x, intake.coord.y)) {
            this.gridMap.setIntake(intake.coord.x, intake.coord.y, intake.itemId, intake.intervalSec);
          }
        }
      }
      if (data.factoryLayout.exports) {
        for (const exp of data.factoryLayout.exports) {
          if (this.gridMap.isInBounds(exp.x, exp.y)) {
            this.gridMap.setExport(exp.x, exp.y);
          }
        }
      }
      this.logistics.loadFromSerialized(data.factoryLayout.conveyors);
      this.productionEngine.loadFromSerialized(data.factoryLayout.machines);
    } else {
      this.setupStarterFactoryLayout();
    }

    if (this.gridView) {
      this.gridView.refresh();
      if (this.cameraController) {
        this.cameraController.fitToFactory();
      }
    }
    if (this.conveyorRenderer) {
      this.conveyorRenderer.rebuild();
    }
    if (this.machineRenderer) {
      this.machineRenderer.rebuild();
    }
    if (this.machineStatusIndicator) {
      this.machineStatusIndicator.rebuild();
    }

    /* Çevrimdışı ilerleme: fabrika, kayıt anında ölçülen hızla çalışmaya devam etmiş sayılır */
    if (data.timestamp > 0 && savedRevenuePerSec > 0) {
      const report = calculateOfflineReport(data.timestamp, Date.now(), savedRevenuePerSec);
      if (report.isEligible) {
        this.time.delayedCall(400, () => {
          this.offlineEarningsModal.show(report);
        });
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
   * YERLEŞİM VE İNŞA YÖNETİMİ
   * ================================================================ */

  private startPlacement(item: PlacementItem): void {
    if (this.buildMenuModal.isOpen()) {
      this.buildMenuModal.hide();
    }
    if (this.demolishTool?.isActive) {
      this.cancelDemolishMode();
    }
    this.placementController.startPlacement(item);
    this.updatePlacementBarVisuals();
    this.placementBarContainer.setVisible(true);
  }

  private startDemolishMode(): void {
    if (this.buildMenuModal.isOpen()) {
      this.buildMenuModal.hide();
    }
    if (this.placementController?.isActive) {
      this.placementController.cancelPlacement();
      this.placementBarContainer.setVisible(false);
    }
    if (this.machineInspectorModal?.isOpen) {
      this.machineInspectorModal.close();
    }
    this.demolishTool.activate();
    // Dokunmatikte söküm iki adımlıdır (bkz. DemolishTool)
    this.demolishBarText.setText(
      this.input.activePointer.wasTouch
        ? '⚠️ SÖKÜM MODU\nDokun: işaretle, tekrar dokun: sök'
        : '⚠️ SÖKÜM MODU (X) | Sökmek istediğin nesneye tıkla (%100 İade)',
    );
    this.demolishBarContainer.setVisible(true);
  }

  private cancelDemolishMode(): void {
    if (this.demolishTool?.isActive) {
      this.demolishTool.cancelTool();
    }
    this.demolishBarContainer.setVisible(false);
  }

  private updatePlacementBarVisuals(): void {
    const item = this.placementController.currentItem;
    if (!item) return;

    // Dokunmatikte hover olmadığı için yerleşim iki adımlıdır (bkz. PlacementController)
    const isTouch = this.input.activePointer.wasTouch;
    const moveHint = isTouch ? 'Dokun: önizle, tekrar dokun: taşı' : 'Boş bir hücreye tıkla';
    const sep = this.barIsNarrow ? '\n' : ' | ';

    if (item.type === 'INTAKE_MOVE') {
      this.placementBarText.setText(`📦 HAMMADDE GİRİŞİ TAŞINIYOR${sep}${moveHint}`);
      this.placementRotateBg.setVisible(false);
      this.placementRotateText.setVisible(false);
      this.placementRotateZone.disableInteractive();
    } else if (item.type === 'EXPORT_MOVE') {
      this.placementBarText.setText(`🚚 SEVKİYAT SANDIĞI TAŞINIYOR${sep}${moveHint}`);
      this.placementRotateBg.setVisible(false);
      this.placementRotateText.setVisible(false);
      this.placementRotateZone.disableInteractive();
    } else {
      this.placementRotateBg.setVisible(true);
      this.placementRotateText.setVisible(true);
      this.placementRotateZone.setInteractive({ useHandCursor: true });

      let itemName = 'Konveyör Bandı';
      let cost = 5;
      if (item.type === 'INTAKE_NEW') {
        itemName = `${INTAKE_SHORT_NAMES[item.intakeItemId ?? ''] ?? 'HAMMADDE'} GİRİŞİ`;
        cost = PlacementMath.getItemCost('INTAKE_NEW', undefined, item.intakeItemId);
        this.placementRotateBg.setVisible(false);
        this.placementRotateText.setVisible(false);
        this.placementRotateZone.disableInteractive();
      } else if (item.type === 'MACHINE' && item.machineDef) {
        itemName = item.machineDef.name;
        cost = item.machineDef.baseCost;
      } else if (item.type === 'SPLITTER') {
        itemName = 'Ayırıcı (Splitter)';
        cost = 25;
      } else if (item.type === 'MERGER') {
        itemName = 'Birleştirici (Merger)';
        cost = 25;
      }

      const hint = !isTouch
        ? item.type === 'CONVEYOR' ? 'Tıkla veya sürükle' : 'Izgaraya tıkla'
        : this.placementController.needsTouchConfirm
          ? 'Dokun: önizle, tekrar dokun: kur'
          : 'Dokun veya sürükle';
      this.placementBarText.setText(`🏗️ ${itemName.toUpperCase()} ($${cost})${sep}${hint}`);
    }
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

    /* Alt Butonlar: 4 Butonlu Arcade Dock ([MANUEL], [BANT], [MAKİNE], [HANGAR]) */
    // Dokunma hedefi çok küçülmesin diye yükseklik 40px'in altına inmez
    const btnH = Math.max(40, Math.round(44 * sf));
    const gap = Math.round(8 * sf);
    const bottomPad = Math.round(10 * sf);
    const btnCy = h - bottomPad - btnH / 2;

    const totalAvailableW = w - 24;
    const btnW = Math.min(136 * sf, (totalAvailableW - 3 * gap) / 4);
    this.dockBtnW = btnW;
    this.dockBtnH = btnH;

    const totalDockW = 4 * btnW + 3 * gap;
    const dockStartX = (w - totalDockW) / 2 + btnW / 2;

    // Deck arka plan paneli
    this.consoleDeckBg.setPosition((w - totalDockW) / 2 - 8, btnCy - btnH / 2 - 6);
    this.consoleDeckBg.setSize(totalDockW + 16, btnH + 12);

    // Dar (mobil) düğmede ikon ile etiket üst üste biner; ikon gizlenip etiket ortalanır
    const compactDock = btnW < 104;
    const dockLabelSize = `${Math.max(9, Math.round(10.5 * sf))}px`;
    const dockSubSize = `${Math.max(9, Math.round(8.5 * sf))}px`;

    const dockButtons = [
      { container: this.manualBtnContainer, bg: this.manualBtnBg, icon: this.manualBtnIcon, label: this.manualBtnText, sub: this.manualBtnSubText, zone: this.manualZone },
      { container: this.conveyorBtnContainer, bg: this.conveyorBtnBg, icon: this.conveyorBtnIcon, label: this.conveyorBtnText, sub: this.conveyorBtnSubText, zone: this.conveyorZone },
      { container: this.buildBtnContainer, bg: this.buildBtnBg, icon: this.buildBtnIcon, label: this.buildBtnText, sub: this.buildBtnSubText, zone: this.buildZone },
      { container: this.hangarBtnContainer, bg: this.hangarBtnBg, icon: this.hangarBtnIcon, label: this.hangarBtnText, sub: this.hangarBtnSubText, zone: this.hangarZone },
    ];

    dockButtons.forEach((btn, i) => {
      btn.container.setPosition(dockStartX + i * (btnW + gap), btnCy);
      btn.bg.setSize(btnW, btnH);
      btn.icon
        .setVisible(!compactDock)
        .setPosition(-btnW * 0.32, -4)
        .setScale(0.85 * sf);
      btn.label.setPosition(compactDock ? 0 : 10, -5).setFontSize(dockLabelSize);
      btn.sub.setPosition(0, 9).setFontSize(dockSubSize);
      btn.zone.setSize(btnW, btnH);
    });

    // Aktif Yerleşim Çubuğu (Active Placement Floating Action Bar)
    const barW = Math.min(480, w - 24);
    const barH = 34;
    const barY = btnCy - btnH / 2 - barH / 2 - 8;
    this.placementBarContainer.setPosition(w / 2, barY);
    this.placementBarBg.setSize(barW, barH);

    // Düğmeler çubuğun sağ kenarına sabitlenir (dar ekranda dışarı taşmasın), metin kalan alana sığar
    this.barIsNarrow = barW < 420;
    const barFontSize = this.barIsNarrow ? '9px' : '11.5px';
    const barTextLeft = -barW / 2 + 10;
    const cancelX = barW / 2 - 20;
    const rotateX = cancelX - 13 - 8 - 46;
    this.placementCancelBg.setPosition(cancelX, 0);
    this.placementCancelIcon.setPosition(cancelX, 0);
    this.placementCancelZone.setPosition(cancelX, 0);
    this.placementRotateBg.setPosition(rotateX, 0);
    this.placementRotateText.setPosition(rotateX, 0);
    this.placementRotateZone.setPosition(rotateX, 0);

    const placementTextRight = rotateX - 46 - 8;
    this.placementBarText
      .setPosition((barTextLeft + placementTextRight) / 2, 0)
      .setFontSize(barFontSize)
      .setAlign('center')
      .setWordWrapWidth(placementTextRight - barTextLeft);
    if (this.placementController?.isActive) {
      this.updatePlacementBarVisuals();
    }

    // Aktif Yıkım Çubuğu (Active Demolish Floating Action Bar)
    this.demolishBarContainer.setPosition(w / 2, barY);
    this.demolishBarBg.setSize(barW, barH);
    this.demolishCancelBg.setPosition(cancelX, 0);
    this.demolishCancelIcon.setPosition(cancelX, 0);
    this.demolishCancelZone.setPosition(cancelX, 0);

    const demolishTextRight = cancelX - 13 - 8;
    this.demolishBarText
      .setPosition((barTextLeft + demolishTextRight) / 2, 0)
      .setFontSize(this.barIsNarrow ? '9px' : '11px')
      .setAlign('center')
      .setWordWrapWidth(demolishTextRight - barTextLeft);

    /* 2D Fabrika Katı Viewport & Kamera Hizalama */
    const factoryTop = contentTop + milestoneH + 8;
    const factoryH = barY - barH / 2 - factoryTop - 6;

    if (this.factoryCamera && this.cameraController) {
      this.factoryCamera.setViewport(0, factoryTop, w, factoryH);
      this.cameraController.setViewport(0, factoryTop, w, factoryH);
      this.cameraController.fitToFactory();
    }

    /* Modallar (Ekran boyutuna göre kendini ortalar) */
    this.buildMenuModal.layout(w, h);
    this.machineInspectorModal.layout(w, h);
    this.terminalModal.layout(w, h);
    this.rocketHangar.layout(w, h);
    this.settingsPanel.layout(w, h);
    this.offlineEarningsModal.layout(w, h);
  }
}
