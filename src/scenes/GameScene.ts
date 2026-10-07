/* ======================================================================
 * GameScene.ts — Ana fabrika sahnesi
 *
 * Sorumluluklar:
 * - Phaser sahne yaşam döngüsü (preload, create, update)
 * - Fabrika simülasyonu ile görselleştirmesinin bağlanması
 * - Arayüz katmanının (UiLayer) kurulması: HUD, hedef kartı, araç çubuğu,
 *   araç bağlam çubuğu, bildirimler ve pencereler
 * - Kayıt/yükleme ve FlightScene geçişi
 *
 * İki kamera vardır: `factoryCamera` dünyayı (fabrika), `cameras.main` arayüzü
 * çizer. Hangi nesnenin hangi kamerada çizileceğini UiLayer yönetir.
 * ====================================================================== */

import Phaser from 'phaser';
import { EconomyManager } from '../economy/EconomyManager';
import { SaveManager } from '../save/SaveManager';
import { AUTO_SAVE_INTERVAL_MS } from '../data/MachineData';
import { formatNumber, formatMoney } from '../utils/format';

import { HUD } from '../ui/HUD';
import { ObjectiveCard, buildObjectiveView, formatMilestoneCompleted } from '../ui/ObjectiveCard.ts';
import { Toolbar } from '../ui/Toolbar.ts';
import { ToolContextBar, type ToolContextState } from '../ui/ToolContextBar.ts';
import { SettingsPanel } from '../ui/SettingsPanel';
import { StagesModal } from '../ui/StagesModal.ts';
import { OfflineEarningsModal } from '../ui/OfflineEarningsModal';
import { calculateOfflineReport } from '../ui/OfflineEarningsHelper.ts';
import { UiLayer } from '../ui/system/UiLayer.ts';
import { UiToast, type UiToastKind } from '../ui/system/UiWidgets.ts';
import { UiConfirmDialog } from '../ui/system/UiConfirmDialog.ts';
import { RotationPreview, type RotationPreviewSubject } from '../ui/RotationPreview.ts';
import { ItemPriceModal, MachineInfoModal } from '../ui/CatalogInfoModals.ts';
import { MACHINE_SPRITE_SHEETS, PORT_ARROW_IMAGES } from '../factory/view/MachineSprites.ts';
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
  INTAKE_UNLOCK_FEATURES,
  MERGER_BUILD_COST,
  PlacementMath,
  SPLITTER_BUILD_COST,
} from '../factory/input/PlacementMath.ts';
import { PALETTE, SEMANTIC, SPACE, UI_TEXTURES, uiIcon } from '../ui/theme';
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
/** Dünyadaki yazıların (etiketler) kamera zoom'una göre yeniden üretilme aralığı (ms) */
const WORLD_TEXT_SYNC_INTERVAL_MS = 200;

export class GameScene extends Phaser.Scene {
  private economy!: EconomyManager;
  private hangarBridge!: RocketHangarBridge;
  private flightStartedAtMs = 0;
  /** Uçuş dönüşü telafi simülasyonu sürerken ihracat geri bildirimi bastırılır */
  private isCatchingUp = false;
  private factoryEconomy!: FactoryEconomy;
  private plotManager!: PlotExpansionManager;
  private milestones!: MilestoneManager;

  /* Arayüz katmanı ve ana ekran bileşenleri */
  private ui!: UiLayer;
  private hud!: HUD;
  private objective!: ObjectiveCard;
  private toolbar!: Toolbar;
  private contextBar!: ToolContextBar;
  private toast!: UiToast;
  private confirmDialog!: UiConfirmDialog;
  private rotationPreview!: RotationPreview;
  /** Son uygulanan kamera görüş alanı; değişmedikçe kamera yeniden sığdırılmaz */
  private lastViewportKey = '';
  private machineInfoModal!: MachineInfoModal;
  private itemPriceModal!: ItemPriceModal;

  /* Pencereler */
  private buildMenuModal!: BuildMenuModal;
  private machineInspectorModal!: MachineInspectorModal;
  private terminalModal!: TerminalInspectorModal;
  private rocketHangar!: RocketHangarView;
  private settingsPanel!: SettingsPanel;
  private stagesModal!: StagesModal;
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

  /* İnşa ve söküm araçları */
  private placementController!: PlacementController;
  private demolishTool!: DemolishTool;

  /* Zamanlayıcılar */
  private autoSaveTimer = 0;
  private worldTextTimer = 0;

  /** Hedef kartının yatay düzende oturduğu aralık (HUD metinleri değişince yeniden yerleşir) */
  private objectiveSlot = { left: 0, right: 0 };

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
    this.load.image('star_pixel', 'assets/star_pixel.png');

    // Fabrika Çevresi ve Zemin
    this.load.image('factory_floor', 'assets/factory_floor.png');
    this.load.image('conveyor_belt', 'assets/conveyor_belt.png');
    this.load.image('factory_intake', 'assets/factory_intake.png');
    this.load.image('shipping_crate', 'assets/shipping_crate.png');

    // 4 Makine ve Parçaları
    for (const sheet of MACHINE_SPRITE_SHEETS) {
      this.load.spritesheet(sheet.key, sheet.path, {
        frameWidth: sheet.frameWidth,
        frameHeight: sheet.frameHeight,
      });
    }
    for (const arrow of PORT_ARROW_IMAGES) {
      this.load.image(arrow.key, arrow.path);
    }

    // Uçuş & Pist & Uzay Dokuları
    this.load.image('flight_ground', 'assets/flight_ground.png');
    this.load.image('launch_platform', 'assets/launch_platform.png');

    // UI Panelleri & Kartlar (Raster 9-Slice)
    this.load.image('ui_panel_hud', 'assets/ui_panel_hud.png');
    this.load.image('ui_card_bg', 'assets/ui_card_bg.png');
    this.load.image('ui_modal_bg', 'assets/ui_modal_bg.png');
    this.load.image('ui_toast_bg', 'assets/ui_toast_bg.png');

    // Göstergeler & Barlar
    this.load.image('ui_bar_slot', 'assets/ui_bar_slot.png');

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


    // UI 2.0 dokuları (düğmeler, ikonlar, çerçeveler)
    for (const texture of UI_TEXTURES) {
      this.load.image(texture.key, texture.path);
    }

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
    // Sahne yeniden başlarken (uçuş dönüşü, kayıt sıfırlama) kamera yeniden kurulur
    this.lastViewportKey = '';
    this.economy = new EconomyManager();

    /* Arayüz katmanı: bundan sonra sahneye eklenen her nesne varsayılan olarak
       dünyaya aittir; arayüz kökleri katman tarafından ayrılır. */
    this.ui = new UiLayer(this, this.cameras.main);

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
    const canStartWorldClick = (): boolean =>
      !this.placementController?.isActive && !this.demolishTool?.isActive && !this.ui.isModalOpen;
    this.gridView.canStartCellClick = canStartWorldClick;
    this.conveyorRenderer.canStartClick = canStartWorldClick;
    this.machineRenderer.canStartClick = canStartWorldClick;
    this.gridView.onCellClicked = (coord) => {
      if (this.isWorldClickSuppressed()) return;

      const cell = this.gridMap.getCell(coord.x, coord.y);
      if (cell?.type === 'INTAKE') {
        this.terminalModal.openFor('INTAKE', coord);
        return;
      }
      if (cell?.type === 'EXPORT') {
        this.terminalModal.openFor('EXPORT', coord);
        return;
      }

      this.onClickProduce();
    };
    this.conveyorRenderer.onConveyorClicked = (_coord) => {
      if (this.isWorldClickSuppressed()) return;
      this.onClickProduce();
    };
    this.machineRenderer.onMachineClicked = (machine) => {
      if (this.isWorldClickSuppressed()) return;
      this.machineInspectorModal.openFor(machine);
    };

    this.gridView.onPlotUnlockRequested = (plotIndex) => {
      if (this.isWorldClickSuppressed()) return;
      this.confirmPlotUnlock(plotIndex);
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
            this.notify('Roket parçaları hazır! Hangarı aç ve yükselt.', 'reward');
          }
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
      const from = this.worldToUi(exportWorld.x, exportWorld.y);
      this.flyCoinToHud(from.x, from.y);
    };

    /* Bağımsız Fabrika Katı Viewport Kamerası */
    this.factoryCamera = this.cameras.add(0, 0, this.scale.width, this.scale.height);
    this.factoryCamera.setBackgroundColor(PALETTE.bgDeepHex);
    this.ui.addWorldCamera(this.factoryCamera);
    this.cameraController = new CameraController(
      this,
      {
        enableKeyboard: true,
        enableWheelZoom: true,
        enableDragPan: true,
      },
      this.factoryCamera,
    );
    this.cameraController.setPixelScale(this.ui.metrics.renderScale);
    this.cameraController.attachGridView(this.gridView);

    // Kamera Katmanlama Sırası:
    // factoryCamera (dünya) önce çizilir (index 0).
    // cameras.main (arayüz ve pencereler) onun ÜSTÜNE çizilir (index 1).
    const mainIdx = this.cameras.cameras.indexOf(this.cameras.main);
    const factoryIdx = this.cameras.cameras.indexOf(this.factoryCamera);
    if (mainIdx !== -1 && factoryIdx !== -1 && mainIdx < factoryIdx) {
      this.cameras.cameras[mainIdx] = this.factoryCamera;
      this.cameras.cameras[factoryIdx] = this.cameras.main;
    }

    /* Pencere açıkken veya iki parmak hareketi sürerken araçlar tek parmak girdisini yoksayar */
    const isToolInputBlocked = (): boolean =>
      this.ui.isModalOpen || this.cameraController.isMultiTouch || Boolean(this.rotationPreview?.visible);

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
            this.notify(`${name} Girişi kuruldu (-$${result.spentMoney})`, 'success');
          } else if (result.itemType === 'INTAKE_MOVE' || this.placementController.currentItem?.type === 'INTAKE_MOVE') {
            this.gridView.refresh();
            this.notify('Hammadde Girişi taşındı', 'success');
          } else if (result.itemType === 'EXPORT_MOVE' || this.placementController.currentItem?.type === 'EXPORT_MOVE') {
            this.gridView.refresh();
            this.notify('Sevkiyat Sandığı taşındı', 'success');
          } else if (result.itemType === 'MACHINE_MOVE') {
            this.machineRenderer.rebuild();
            this.machineStatusIndicator.rebuild();
            const movedName = this.productionEngine.getMachine(result.instanceId ?? '')?.def.name ?? 'Makine';
            this.notify(`${movedName} taşındı`, 'success');
          } else if (result.instanceId) {
            this.machineRenderer.rebuild();
            this.machineStatusIndicator.rebuild();
            const machineDef = this.productionEngine.getMachine(result.instanceId)?.def;
            const name = machineDef?.name ?? 'Makine';
            this.notify(`${name} kuruldu (-$${result.spentMoney})`, 'success');
          } else {
            // Bant sürükleyerek döşenir; her bant için bildirim göstermek ekranı doldurur
            this.conveyorRenderer.rebuild();
          }
          sound.playUpgrade();
          const worldPos = GridCoordinates.gridToWorldCenter(result.coord, 32);
          fx.emitSparkles(this, worldPos.x, worldPos.y, 14, PALETTE.resourceGold);
          this.syncWorldTextResolution();
          this.saveGame();
        },
      },
    );
    this.placementController.isInputBlocked = isToolInputBlocked;

    /* Makine İnceleme ve Yükseltme Penceresi */
    this.machineInspectorModal = new MachineInspectorModal(
      this.ui,
      this.productionEngine,
      this.factoryEconomy,
      {
        onUpgrade: (machine, level) => {
          this.machineRenderer.rebuild();
          this.machineStatusIndicator.rebuild();
          this.syncWorldTextResolution();
          sound.playUpgrade();
          fx.emitSparkles(this, this.ui.width / 2, this.ui.height / 2, 16, PALETTE.resourceGold, 'ui');
          this.saveGame();
          this.notify(`${machine.def.name} Seviye ${level} oldu`, 'success');
        },
        onUpgradeDenied: () => this.notify('Yükseltme için yeterli para yok', 'warning'),
        onRecipeChanged: (_machine, _recipeId) => {
          this.saveGame();
          sound.playCoin();
        },
        onMoveRequested: (machine) => {
          this.startPlacement({
            type: 'MACHINE_MOVE',
            machineDef: machine.def,
            sourceInstanceId: machine.instanceId,
          });
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
            this.notify(`${result.name} söküldü (+$${result.refundAmount} iade)`, 'info');
          }
        },
      },
    );

    /* Yıkım Aracı */
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
            this.notify(`${result.name} söküldü (+$${result.refundAmount} iade)`, 'info');
          } else {
            this.conveyorRenderer.rebuild();
          }
          sound.playDemolish();
          const firstCoord = result.freedCoords[0];
          if (firstCoord) {
            const worldPos = GridCoordinates.gridToWorldCenter(firstCoord, 32);
            fx.emitSparkles(this, worldPos.x, worldPos.y, 14, PALETTE.dangerRed);
          }
          this.saveGame();
        },
        onProtectedClicked: (name) => {
          sound.playDemolish();
          this.notify(`${name} sökülemez; taşımak için üstüne dokun.`, 'warning');
        },
      },
    );
    this.demolishTool.isInputBlocked = isToolInputBlocked;

    // Yerleşim veya Yıkım modunda tek parmak/sol tık kamera değil araç içindir
    this.cameraController.canPan = () => !this.placementController.isActive && !this.demolishTool.isActive;

    /* Giriş / Sevkiyat Penceresi */
    this.terminalModal = new TerminalInspectorModal(this.ui, {
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
      onOpenCatalog: () => this.openCatalog(),
      getIntakeItemName: (coord) => {
        const cell = coord
          ? this.gridMap.getCell(coord.x, coord.y)
          : this.gridMap.getIntakeCells()[0];
        return defaultItemRegistry.get(cell?.intakeData?.itemId ?? '')?.name;
      },
      getRevenuePerSec: () => this.factoryEconomy.getRevenuePerSec(),
    });

    /* İnşa Kataloğu */
    this.buildMenuModal = new BuildMenuModal(this.ui, this.factoryEconomy, {
      onSelectItem: (item) => {
        this.buildMenuModal.close();
        this.startPlacement(item);
      },
      getLockStage: (cardId) => this.getCatalogLockStage(cardId),
      getNextPlot: () => {
        const plot = this.plotManager.getNextAvailablePlot();
        return plot
          ? { index: plot.index, name: plot.name, cost: plot.cost, width: plot.targetWidth, height: plot.targetHeight }
          : null;
      },
      onExpandPlot: (plotIndex) => {
        if (this.requestPlotUnlock(plotIndex)) {
          this.buildMenuModal.close();
        }
      },
      onDenied: (message) => this.notify(message, 'warning'),
      onMachineInfo: (def) => this.machineInfoModal.showFor(def),
      onPriceList: () => this.itemPriceModal.open(),
    });
    this.machineInfoModal = new MachineInfoModal(this.ui);
    this.itemPriceModal = new ItemPriceModal(this.ui);

    /* Roket Hangarı */
    this.rocketHangar = new RocketHangarView(
      this.ui,
      this.economy,
      () => this.startFlight(),
      this.hangarBridge,
      this.factoryEconomy,
      (message) => this.notify(message, 'warning'),
    );

    /* Ana ekran */
    this.hud = new HUD(this.ui, () => this.settingsPanel.open());
    this.stagesModal = new StagesModal(this.ui, this.milestones, () =>
      this.milestones.getCurrentProgress(this.factoryEconomy, this.productionEngine),
    );
    this.objective = new ObjectiveCard(this.ui, () => {
      this.cancelActiveTool();
      this.stagesModal.open();
    });
    this.toolbar = new Toolbar(this.ui, {
      onProduce: () => this.onClickProduce(),
      onBelt: () => this.toggleBeltTool(),
      onBuild: () => this.openCatalog(),
      onDemolish: () => this.toggleDemolishTool(),
      onHangar: () => this.openHangar(),
      onHangarLocked: () => {
        const stage = this.milestones.getFeatureUnlockStage(HANGAR_FEATURE);
        this.notify(`Roket Hangarı ${stage}. aşamada açılır.`, 'warning');
      },
    });
    this.contextBar = new ToolContextBar(this.ui, {
      onRotate: () => this.rotateWithPreview(),
      onConfirm: () => {
        if (this.placementController.isActive) {
          this.placementController.confirmPlacement();
        } else if (this.demolishTool.isActive) {
          this.demolishTool.confirmDemolish();
        }
      },
      // Yön önizlemesi açıkken bu düğme yeşil "tamam"dır: önizlemeyi kapatır, yerleştirmeye döner
      onCancel: () => {
        if (this.rotationPreview.visible) {
          this.rotationPreview.hide();
        } else {
          this.cancelActiveTool();
        }
      },
    });
    this.rotationPreview = new RotationPreview(this.ui);
    this.toast = new UiToast(this.ui);
    this.confirmDialog = new UiConfirmDialog(this.ui);

    /* Ayarlar */
    this.settingsPanel = new SettingsPanel(this.ui, () => this.resetGame());

    /* Çevrimdışı İlerleme Penceresi */
    this.offlineEarningsModal = new OfflineEarningsModal(this.ui, {
      onClaim: (gained) => {
        this.economy.addResources(gained);
        this.saveGame();
        this.notify(`+$${formatNumber(gained)} kasana eklendi`, 'reward');
      },
      onDoubleClaim: async (gained) => {
        // CrazyGames Rewarded Video Reklamı
        const watched = await crazyGames.requestAd('rewarded');
        if (!watched) {
          this.notify('Reklam tamamlanamadı, ödül verilemedi.', 'warning');
          return;
        }
        this.economy.addResources(gained);
        this.saveGame();
        this.notify(`2X ödül: +$${formatNumber(gained)} kasana eklendi`, 'reward');
      },
    });

    /* Klavye kısayolları */
    this.bindShortcuts();

    /* İlk yerleşim; pencere boyutu veya arayüz ölçeği değişince yeniden */
    this.layoutAll();
    this.ui.onLayout(() => this.layoutAll());

    /* Ekonomi olayları */
    this.economy.on((evt) => {
      if (evt.type === 'rocket_upgrade') {
        sound.playUpgrade();
        fx.emitSparkles(this, this.ui.width / 2, this.ui.height / 2, 20, PALETTE.rocketCyan, 'ui');
        this.saveGame();
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
    this.cancelActiveTool();
    this.machineInspectorModal.close();
    this.terminalModal.close();
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
    this.cameraController.setEnabled(true);
    const factoryEarned = this.catchUpFactory((Date.now() - this.flightStartedAtMs) / 1000);
    this.gridView.refresh();
    // Uçuş sırasında pencere boyutu değişmiş olabilir
    this.layoutAll();
    this.saveGame();
    this.refreshUI();

    const multiplier = this.factoryEconomy ? this.factoryEconomy.revenueMultiplier : 1.0;
    const bonusText = multiplier > 1.0 ? ` · gelir x${multiplier.toFixed(2)}` : '';
    const factoryText = factoryEarned > 0 ? `\nSen uçarken fabrika +$${formatNumber(factoryEarned)} kazandı` : '';

    this.notify(
      `Uçuş primi +$${formatNumber(totalResources)} (${distance} m)${bonusText}${factoryText}`,
      'reward',
    );

    // Ekranın ortasından kasaya uçan sikkeler
    const cx = this.ui.width / 2;
    const cy = this.ui.height * 0.45;
    fx.emitSparkles(this, cx, cy, 20, PALETTE.successGreen, 'ui');
    for (let i = 0; i < 7; i++) {
      const fromX = cx + Phaser.Math.Between(-60, 60);
      const fromY = cy + Phaser.Math.Between(-30, 30);
      this.time.delayedCall(i * 60, () => this.flyCoinToHud(fromX, fromY));
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
    // Ayarlar açıkken oyun duraklar
    if (this.settingsPanel.isOpen) return;

    const dt = delta / 1000;

    /* 2D Simülasyon adımları */
    this.stepSimulation(dt);

    /* 2D Görsel akış ve animasyonlar (60 FPS) */
    this.conveyorRenderer.update(dt);
    this.itemFlowAnimator.update(dt);
    this.machineRenderer.update(dt);
    this.machineStatusIndicator.update(dt);

    /* Pencere açıkken araçlar kapanır, kamera durur */
    const isAnyModalOpen = this.ui.isModalOpen;
    if (isAnyModalOpen) {
      this.cancelActiveTool();
    }
    this.cameraController.setEnabled(!isAnyModalOpen);
    this.cameraController.update(dt);

    /* Kamera hareketinden sonra araç önizlemelerini imleçle yeniden eşle */
    this.placementController.update();
    this.demolishTool.update();

    /* Dünyadaki etiketler kamera zoom'unun çözünürlüğünde kalsın */
    this.worldTextTimer += delta;
    if (this.worldTextTimer >= WORLD_TEXT_SYNC_INTERVAL_MS) {
      this.worldTextTimer = 0;
      this.syncWorldTextResolution();
    }

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

    this.toolbar.pulseProduce();
    this.hud.pulse();

    /* Yüzen +N metni ve kıvılcım (arayüz uzayında, düğmenin üstünde) */
    const anchor = this.toolbar.getProduceAnchor();
    const cx = anchor.x + Phaser.Math.Between(-10, 10);
    fx.emitFloatingText(this, cx, anchor.y - 6, `+$${formatNumber(gained)}`, PALETTE.resourceGoldHex, 'ui');
    fx.emitSparkles(this, cx, anchor.y, 6, PALETTE.resourceGold, 'ui');
  }

  /* ================================================================
   * KOORDİNAT VE EFEKT YARDIMCILARI
   * ================================================================ */

  /** Fabrika dünyasındaki bir noktanın arayüz birimi cinsinden ekran konumu */
  private worldToUi(worldX: number, worldY: number): { x: number; y: number } {
    const cam = this.factoryCamera;
    const screenX = (worldX - cam.worldView.x) * cam.zoom + cam.x;
    const screenY = (worldY - cam.worldView.y) * cam.zoom + cam.y;
    return { x: screenX / this.ui.zoom, y: screenY / this.ui.zoom };
  }

  /** Verilen arayüz noktasından HUD'daki kasaya bir sikke uçurur */
  private flyCoinToHud(fromX: number, fromY: number): void {
    const target = this.hud.getResourceTargetPos();

    const coinKey = this.textures.exists('coin_gold') ? 'coin_gold' : 'icon_coin';
    const coin = this.ui.adopt(this.add.sprite(fromX, fromY, coinKey, 0).setDepth(110).setScale(1.5));
    if (this.anims.exists('coin_gold_spin')) {
      coin.play('coin_gold_spin');
    }

    const midX = (fromX + target.x) / 2 + Phaser.Math.Between(-40, 20);
    const midY = Math.min(fromY, target.y) - Phaser.Math.Between(20, 60);

    this.tweens.add({
      targets: { val: 0 },
      val: 1,
      duration: 400,
      ease: 'Quad.easeIn',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        const x = (1 - t) * (1 - t) * fromX + 2 * (1 - t) * t * midX + t * t * target.x;
        const y = (1 - t) * (1 - t) * fromY + 2 * (1 - t) * t * midY + t * t * target.y;
        coin.setPosition(x, y);
      },
      onComplete: () => {
        coin.destroy();
        this.hud.pulse();
        fx.emitSparkles(this, target.x, target.y, 6, PALETTE.resourceGold, 'ui');
      },
    });
  }

  /** Dünyadaki yazıları (giriş etiketleri, makine seviyeleri) kameranın zoom'unda yeniden üretir */
  private syncWorldTextResolution(): void {
    const resolution = this.factoryCamera.zoom;
    this.ui.worldTextResolution = resolution;

    // Parsel rozeti kamera zoom'undan bağımsız, arayüz yazılarıyla aynı boyutta görünsün
    this.gridView.setLabelScale(Phaser.Math.Clamp(this.ui.zoom / resolution, 0.6, 2));
    const roots: Phaser.GameObjects.GameObject[] = [
      this.gridView.rootContainer,
      this.machineRenderer.rootContainer,
      this.machineStatusIndicator.rootContainer,
      this.placementController.ghostContainer,
      this.demolishTool.overlayContainer,
    ];
    for (const root of roots) {
      UiLayer.applyTextResolution(root, resolution);
    }
  }

  private notify(message: string, kind: UiToastKind = 'info'): void {
    this.toast.show(message, kind);
  }

  /* ================================================================
   * AŞAMALAR VE PARSELLER
   * ================================================================ */

  /** Aktif aşamanın koşulları sağlandıysa ödülünü verir ve sıradakine geçer */
  private claimCompletedMilestones(): void {
    while (this.milestones.canClaimCurrentMilestone(this.factoryEconomy, this.productionEngine)) {
      const result = this.milestones.claimCurrentMilestone(this.factoryEconomy, this.productionEngine);
      if (!result.success || !result.claimedMilestone || !result.reward) return;

      crazyGames.happytime();
      sound.playMilestone();
      fx.emitConfetti(this, this.ui.width / 2, this.hud.bottom + 30, 32, 'ui');
      this.objective.playGoalReachedEffect();
      this.notify(formatMilestoneCompleted(result.claimedMilestone), 'reward');
      this.saveGame();
    }
  }

  /**
   * Fabrika zeminindeki parsel rozetine dokunulduğunda satın almadan önce sorar;
   * rozet kaydırma sırasında parmağın altında kalabildiği için tek dokunuşla para harcanmaz.
   */
  private confirmPlotUnlock(plotIndex: number): void {
    const plot = this.plotManager.getPlot(plotIndex);
    if (!plot || !this.plotManager.isPlotAvailable(plotIndex) || !this.plotManager.canAffordPlot(plotIndex)) {
      // Açılamıyorsa nedeni requestPlotUnlock bildirir
      this.requestPlotUnlock(plotIndex);
      return;
    }

    this.confirmDialog.ask({
      title: plot.name,
      message: `Fabrika alanı ${plot.targetWidth}x${plot.targetHeight} hücreye genişler. Bedeli $${plot.cost.toLocaleString('en-US')}.`,
      confirmLabel: 'SATIN AL',
      onConfirm: () => this.requestPlotUnlock(plotIndex),
    });
  }

  /** Sıradaki parseli satın almayı dener; başarılıysa true döner */
  private requestPlotUnlock(plotIndex: number): boolean {
    const res = this.plotManager.unlockPlot(plotIndex);
    if (res.success) {
      sound.playMilestone();
      PlotExpansionManager.playUnlockCelebration(this, res, 32);
      this.gridView.refresh();
      // Yeni açılan alan görünsün diye kamerayı büyüyen fabrikaya yeniden sığdır
      this.cameraController.fitToFactory();
      this.syncWorldTextResolution();
      this.saveGame();
      this.notify(`${res.plotName} açıldı (${res.newBounds.width}x${res.newBounds.height})`, 'reward');
      return true;
    }

    if (res.error === 'PREVIOUS_PLOT_REQUIRED') {
      this.notify('Önce önceki parseli açmalısın.', 'warning');
    } else if (res.error === 'INSUFFICIENT_FUNDS') {
      this.notify(`Parsel için $${formatNumber(res.cost)} gerekiyor.`, 'warning');
    } else if (res.error === 'ALREADY_UNLOCKED') {
      this.notify('Bu parsel zaten açık.', 'info');
    }
    return false;
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

    /* Hedef kartı: tamamlanan aşamanın ödülünü ver, sonra sıradaki görevi göster */
    this.claimCompletedMilestones();
    this.objective.update(
      buildObjectiveView(
        this.milestones.getCurrentProgress(this.factoryEconomy, this.productionEngine),
        this.milestones.completedCount,
        this.milestones.totalCount,
        revenuePerSec,
      ),
    );
    this.syncObjectiveSlot();

    /* Araç çubuğu ve etkin araç çubuğu */
    this.toolbar.setHangarUnlocked(this.milestones.isFeatureUnlocked(HANGAR_FEATURE));
    this.syncToolUi();

    /* Açık pencerelerin canlı değerleri */
    if (this.buildMenuModal.isOpen) this.buildMenuModal.refresh();
    if (this.machineInspectorModal.isOpen) this.machineInspectorModal.refresh();
    if (this.rocketHangar.isOpen) this.rocketHangar.refresh();
    if (this.stagesModal.isOpen) this.stagesModal.refresh();

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
    this.gridMap.setIntake(1, 0, 'iron_ore', 1.0, 'SOUTH');
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
        this.notify('Eski kayıt biçimi yenilendi.', 'info');
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
            this.gridMap.setIntake(intake.coord.x, intake.coord.y, intake.itemId, intake.intervalSec, intake.direction);
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
      // Yön bilgisi olmayan eski girişler, bağlı oldukları banda göre yön alır
      this.logistics.resolveIntakeDirections();
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
          this.offlineEarningsModal.showReport(report);
        });
      }
    }
  }

  private resetGame(): void {
    SaveManager.clear();
    this.scene.restart();
  }

  /* ================================================================
   * ARAÇLAR (YERLEŞTİRME / SÖKÜM)
   * ================================================================ */

  /** İki parmak hareketinin bırakışı veya açık pencere dünyaya tıklama sayılmaz */
  private isWorldClickSuppressed(): boolean {
    return (
      this.placementController?.isActive ||
      this.demolishTool?.isActive ||
      this.ui.isModalOpen ||
      this.cameraController.wasGesture
    );
  }

  private startPlacement(item: PlacementItem): void {
    this.buildMenuModal.close();
    if (this.demolishTool.isActive) {
      this.demolishTool.cancelTool();
    }
    this.placementController.startPlacement(item);
    this.syncWorldTextResolution();
  }

  private toggleBeltTool(): void {
    if (this.placementController.isActive && this.placementController.currentItem?.type === 'CONVEYOR') {
      this.placementController.cancelPlacement();
      return;
    }
    this.startPlacement({ type: 'CONVEYOR' });
  }

  private toggleDemolishTool(): void {
    if (this.demolishTool.isActive) {
      this.demolishTool.cancelTool();
      return;
    }
    if (this.placementController.isActive) {
      this.placementController.cancelPlacement();
    }
    this.demolishTool.activate();
  }

  /** Yön önizlemesi olan öğeler: makineler, hammadde girişleri, bant ve akış birimleri */
  private rotationSubjectOf(item: PlacementItem): RotationPreviewSubject | null {
    if ((item.type === 'MACHINE' || item.type === 'MACHINE_MOVE') && item.machineDef) {
      return { kind: 'machine', def: item.machineDef };
    }
    if (item.type === 'INTAKE_NEW' || item.type === 'INTAKE_MOVE') {
      return { kind: 'intake' };
    }
    if (item.type === 'CONVEYOR') return { kind: 'belt' };
    if (item.type === 'SPLITTER') return { kind: 'splitter' };
    if (item.type === 'MERGER') return { kind: 'merger' };
    return null;
  }

  /**
   * Döndür düğmesi: makine/giriş için fabrikayı karartıp öğeyi ortada büyük gösterir;
   * her basış bir çeyrek tur döndürür. Bant gibi öğeler doğrudan döner.
   */
  private rotateWithPreview(): void {
    const placement = this.placementController;
    if (!placement.isActive || !placement.currentItem) return;

    placement.rotate(true);
    const subject = this.rotationSubjectOf(placement.currentItem);
    if (subject && !this.rotationPreview.visible) {
      this.rotationPreview.show(subject, placement.rotation);
    } else {
      this.rotationPreview.sync(placement.rotation);
    }
  }

  private cancelActiveTool(): void {
    this.rotationPreview?.hide();
    if (this.placementController?.isActive) {
      this.placementController.cancelPlacement();
    }
    if (this.demolishTool?.isActive) {
      this.demolishTool.cancelTool();
    }
  }

  private openCatalog(): void {
    this.cancelActiveTool();
    this.buildMenuModal.open();
  }

  private openHangar(): void {
    this.cancelActiveTool();
    this.rocketHangar.open();
  }

  /** Etkin aracı araç çubuğunda vurgular ve bağlam çubuğunu araç durumuna göre günceller */
  private syncToolUi(): void {
    const placement = this.placementController;
    const demolish = this.demolishTool;
    const isTouch = this.input.activePointer.wasTouch;

    if (placement.isActive && placement.currentItem) {
      this.toolbar.setActiveTool(placement.currentItem.type === 'CONVEYOR' ? 'belt' : null);
      const context = this.buildPlacementContext(placement.currentItem, isTouch);
      // Önizleme açıkken küçük hayalet gizlenir; kapanınca geri gelir
      placement.ghostContainer.setVisible(!this.rotationPreview.visible);
      if (this.rotationPreview.visible) {
        // R tuşuyla döndürme de önizlemeye yansır
        this.rotationPreview.sync(placement.rotation);
        this.contextBar.show({
          ...context,
          hint: 'Döndür ile yönü seç, tik ile onayla',
          showConfirm: false,
          rotating: true,
        });
      } else {
        this.contextBar.show(context);
      }
      return;
    }
    if (this.rotationPreview.visible) this.rotationPreview.hide();

    if (demolish.isActive) {
      this.toolbar.setActiveTool('demolish');
      const target = demolish.targetName;
      this.contextBar.show({
        icon: uiIcon('trash'),
        iconTint: SEMANTIC.danger,
        title: target ? `Sök: ${target}` : 'Söküm modu',
        hint: !isTouch
          ? 'Sökmek için tıkla · %100 iade · X: çık'
          : target
            ? 'Onayla ile sök · %100 iade'
            : 'Sökülecek nesneye dokun',
        tone: 'demolish',
        canRotate: false,
        showConfirm: isTouch,
        confirmEnabled: demolish.hasDemolishTarget,
      });
      return;
    }

    this.toolbar.setActiveTool(null);
    if (this.contextBar.visible) this.contextBar.hide();
  }

  private buildPlacementContext(item: PlacementItem, isTouch: boolean): ToolContextState {
    const placement = this.placementController;
    const needsConfirm = isTouch && placement.needsTouchConfirm;
    const stepHint = !needsConfirm
      ? 'Bir hücreye tıkla'
      : placement.canConfirm
        ? 'Onayla ile yerleştir'
        : 'Uygun bir hücreye dokun';

    const base = {
      tone: 'build' as const,
      showConfirm: needsConfirm,
      confirmEnabled: placement.canConfirm,
    };

    switch (item.type) {
      case 'INTAKE_MOVE':
        return { ...base, icon: uiIcon('intake'), title: 'Hammadde Girişi taşınıyor', hint: isTouch ? `${stepHint} · ok çıkış yönü` : 'Bir hücreye tıkla · ok çıkış yönü · R: döndür', canRotate: true };
      case 'EXPORT_MOVE':
        return { ...base, icon: uiIcon('crate'), title: 'Sevkiyat Sandığı taşınıyor', hint: stepHint, canRotate: false };
      case 'INTAKE_NEW': {
        const name = defaultItemRegistry.get(item.intakeItemId ?? '')?.name ?? 'Hammadde';
        const cost = PlacementMath.getItemCost('INTAKE_NEW', undefined, item.intakeItemId);
        return { ...base, icon: uiIcon('intake'), title: `${name} Girişi · $${formatNumber(cost)}`, hint: isTouch ? `${stepHint} · ok çıkış yönü` : 'Bir hücreye tıkla · ok çıkış yönü · R: döndür', canRotate: true };
      }
      case 'MACHINE_MOVE':
        return {
          ...base,
          icon: item.machineDef?.spriteBaseKey ?? 'icon_factory',
          title: `${item.machineDef?.name ?? 'Makine'} taşınıyor`,
          hint: isTouch ? `${stepHint} · ücretsiz` : 'Bir hücreye tıkla · ücretsiz · R: döndür',
          canRotate: true,
        };
      case 'MACHINE': {
        const def = item.machineDef;
        return {
          ...base,
          icon: def?.spriteBaseKey ?? 'icon_factory',
          title: `${def?.name ?? 'Makine'} · $${formatNumber(def?.baseCost ?? 0)}`,
          hint: isTouch ? `${stepHint} · yeşil ok giriş, turuncu çıkış` : 'Yeşil ok giriş, turuncu ok çıkış · R: döndür',
          canRotate: true,
        };
      }
      case 'SPLITTER':
        return { ...base, icon: uiIcon('belt'), title: `Akış Ayırıcı · $${SPLITTER_BUILD_COST}`, hint: isTouch ? stepHint : 'Bir hücreye tıkla · R: döndür', canRotate: true };
      case 'MERGER':
        return { ...base, icon: uiIcon('belt'), title: `Akış Birleştirici · $${MERGER_BUILD_COST}`, hint: isTouch ? stepHint : 'Bir hücreye tıkla · R: döndür', canRotate: true };
      case 'CONVEYOR':
      default:
        return {
          ...base,
          icon: uiIcon('belt'),
          title: `Konveyör Bandı · $${CONVEYOR_BUILD_COST}`,
          hint: isTouch ? 'Dokun veya sürükleyerek çiz' : 'Tıkla veya sürükleyerek çiz · R: döndür',
          canRotate: true,
        };
    }
  }

  /* ================================================================
   * KLAVYE KISAYOLLARI
   * ================================================================ */

  private bindShortcuts(): void {
    const keyboard = this.input.keyboard;
    if (!keyboard) return;

    const onKeyDown = (event: KeyboardEvent): void => {
      // Pencere açıkken tuşlar pencereye aittir (UiLayer yönetir)
      if (this.ui.isModalOpen || event.repeat) return;

      switch (event.key) {
        case ' ':
          // Odakta bir düğme varsa Boşluk onu tetikler; yoksa elle üretim
          if (!this.ui.hasKeyboardFocus) {
            event.preventDefault();
            this.onClickProduce();
          }
          break;
        case '1':
          this.onClickProduce();
          break;
        case '2':
          this.toggleBeltTool();
          break;
        case '3':
        case 'b':
        case 'B':
          this.openCatalog();
          break;
        case '4':
          this.toggleDemolishTool();
          break;
        case '5':
        case 'h':
        case 'H':
          if (this.milestones.isFeatureUnlocked(HANGAR_FEATURE)) {
            this.openHangar();
          }
          break;
        default:
          break;
      }
    };

    keyboard.on('keydown', onKeyDown);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => keyboard.off('keydown', onKeyDown));
  }

  /* ================================================================
   * YERLEŞİM (RESPONSIVE LAYOUT)
   * ================================================================ */

  /** Hedef kartını ekran düzenine göre yerleştirir ve içeriğin başladığı Y'yi döner */
  private layoutObjective(): number {
    const m = this.ui.metrics;
    const hudBottom = this.hud.bottom;
    const fullLeft = m.safe.left + SPACE.sm;
    const fullWidth = m.width - m.safe.left - m.safe.right - SPACE.sm * 2;

    if (m.mode === 'portrait') {
      this.objective.layout(fullLeft, hudBottom + SPACE.xs + 2, fullWidth, 'card');
      return this.objective.bottom + SPACE.xs;
    }

    // Yatayda hedef, HUD çubuğundaki boşluğa tek satır olarak sığar
    const slot = this.hud.freeSlot;
    this.objectiveSlot = { left: slot.left, right: slot.right };
    const slotWidth = slot.right - slot.left - SPACE.md * 2;
    if (slotWidth >= 240) {
      const width = Math.min(slotWidth, 520);
      const x = slot.left + SPACE.md + (slotWidth - width) / 2;
      this.objective.layout(x, slot.centerY - ObjectiveCard.heightFor('strip') / 2, width, 'strip');
      return hudBottom + SPACE.xs;
    }

    // Sığmıyorsa HUD'ın altında tam genişlikte şerit
    this.objective.layout(fullLeft, hudBottom + SPACE.xs, fullWidth, 'strip');
    return this.objective.bottom + SPACE.xs;
  }

  /** Para/gelir metni genişleyip daralınca HUD'daki hedef şeridi yerini korusun */
  private syncObjectiveSlot(): void {
    if (this.ui.metrics.mode === 'portrait') return;
    const slot = this.hud.freeSlot;
    if (
      Math.abs(slot.left - this.objectiveSlot.left) > 6 ||
      Math.abs(slot.right - this.objectiveSlot.right) > 6
    ) {
      this.layoutAll();
    }
  }

  private layoutAll(): void {
    const m = this.ui.metrics;

    this.hud.layout();
    this.toolbar.layout();
    const contentTop = this.layoutObjective();

    /* Fabrika görüş alanı: HUD/hedefin altı, araç çubuğunun dışında kalan her yer */
    const dock = this.toolbar.occupied;
    const viewLeft = 0;
    const viewRight = this.toolbar.isVertical ? dock.x : m.width;
    const viewBottom = this.toolbar.isVertical ? m.height : dock.y;
    const viewWidth = viewRight - viewLeft;
    const viewHeight = viewBottom - contentTop;

    /* Etkin araç çubuğu fabrikanın alt kenarında, araç çubuğunun hemen üstünde yüzer */
    const barBottom = viewBottom - SPACE.sm - (this.toolbar.isVertical ? m.safe.bottom : 0);
    this.contextBar.layout(
      viewLeft + viewWidth / 2,
      barBottom,
      viewWidth - m.safe.left - SPACE.md * 2,
    );
    this.rotationPreview.layout(contentTop, barBottom - ToolContextBar.height - SPACE.sm);

    this.toast.setAnchor(contentTop + SPACE.sm);

    /* Kamera görüş alanı tuval pikseli cinsindendir */
    const zoom = m.zoom;
    const viewport = [
      viewLeft * zoom,
      contentTop * zoom,
      viewWidth * zoom,
      Math.max(32, viewHeight * zoom),
    ] as const;
    // Kamera yalnızca görüş alanı gerçekten değiştiğinde (pencere boyutu, ekran yönü,
    // arayüz ölçeği) yeniden sığdırılır. Bu yerleşim HUD'daki para yazısı genişleyince de
    // çalışır; her seferinde sığdırmak oyuncunun yaptığı yakınlaştırmayı geri alıyordu.
    const viewportKey = `${m.renderScale}|${viewport.map((v) => Math.round(v)).join(',')}`;
    if (viewportKey === this.lastViewportKey) return;
    this.lastViewportKey = viewportKey;

    this.cameraController.setPixelScale(m.renderScale);
    this.cameraController.setViewport(...viewport);
    // Etkin araç çubuğunun yüzdüğü şerit sığdırmada boş bırakılır: çubuk fabrikayı örtmez
    this.cameraController.setFitInsetBottom((ToolContextBar.height + SPACE.md) * zoom);
    this.cameraController.fitToFactory();
    this.syncWorldTextResolution();
  }
}
