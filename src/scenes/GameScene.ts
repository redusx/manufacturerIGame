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
import { AUTO_SAVE_INTERVAL_MS, getClickPowerForStage } from '../data/MachineData';
import { formatDistance, formatFixed, formatInteger, formatNumber, formatMoney } from '../utils/format';

import { HUD } from '../ui/HUD';
import { ObjectiveCard, buildObjectiveView, formatMilestoneCompleted } from '../ui/ObjectiveCard.ts';
import { Toolbar } from '../ui/Toolbar.ts';
import { ToolContextBar, type ToolContextState } from '../ui/ToolContextBar.ts';
import { SettingsPanel } from '../ui/SettingsPanel';
import { StagesModal } from '../ui/StagesModal.ts';
import { RangeLadderModal } from '../ui/RangeLadderModal.ts';
import { BoostModal } from '../ui/BoostModal.ts';
import { ads, setAdProgressGate } from '../ads/ads.ts';
import { RELEASE } from '../config/release.ts';
import { shouldAutoOpenControls } from '../config/platform.ts';
import { formatAdCooldown, type AdPlacementId } from '../ads/AdService.ts';
import { BOOST_GRANT_SECONDS, BOOST_MULTIPLIER, IncomeBoost } from '../economy/IncomeBoost.ts';
import { RangeLadder } from '../flight/RangeLadder.ts';
import { GROUND_THEMES, groundTextureKey, groundTexturePath } from '../flight/GroundThemes.ts';
import { LAUNCH_PAD_AD_DISCOUNT, MAX_LAUNCH_PAD_LEVEL, launchPadTextureKey } from '../flight/LaunchPad.ts';
import { OfflineEarningsModal } from '../ui/OfflineEarningsModal';
import { calculateOfflineReport } from '../ui/OfflineEarningsHelper.ts';
import { UiLayer } from '../ui/system/UiLayer.ts';
import { UiToast, type UiToastKind } from '../ui/system/UiWidgets.ts';
import { UiConfirmDialog } from '../ui/system/UiConfirmDialog.ts';
import { RotationPreview, type RotationPreviewSubject } from '../ui/RotationPreview.ts';
import { BeltStepper } from '../ui/BeltStepper.ts';
import { ZoomControls } from '../ui/ZoomControls.ts';
import { ControlsModal } from '../ui/ControlsModal.ts';
import { LeaderboardModal } from '../ui/LeaderboardModal.ts';
import {
  currentPlayer,
  getCrazyGamesBoardState,
  isGlobalLeaderboardAvailable,
  leaderboard,
  submitFlightDistance,
} from '../leaderboard/leaderboard.ts';
import { StartScreenModal } from '../ui/StartScreenModal.ts';
import { TutorialCoach, type CoachRect } from '../ui/TutorialCoach.ts';
import { TutorialGuide, type TutorialContext, type TutorialTarget } from '../tutorial/TutorialGuide.ts';
import { DIRECTION_VECTORS, type Direction, type GridCoord } from '../factory/types.ts';
import { ItemPriceModal, MachineInfoModal } from '../ui/CatalogInfoModals.ts';
import { MACHINE_SPRITE_SHEETS, PORT_ARROW_IMAGES } from '../factory/view/MachineSprites.ts';
import { MAX_ROCKET_LEVEL, getRangeScale } from '../data/RocketData.ts';
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
import { RocketHangarBridge, type RocketModuleCategory } from '../factory/simulation/RocketHangarBridge';
import {
  FactoryEconomy,
  MACHINE_UPGRADE_AD_DISCOUNT,
  MAX_FACTORY_HEIGHT,
  MAX_FACTORY_WIDTH,
  PLOT_AD_DISCOUNT,
} from '../factory/simulation/FactoryEconomy';
import { PlotExpansionManager } from '../factory/progression/PlotExpansionManager.ts';
import { MilestoneManager } from '../factory/progression/MilestoneManager.ts';
import { PlacementController, type PlacementItem } from '../factory/input/PlacementController.ts';
import { BuildMenuModal, INTAKE_CARD_PREFIX } from '../ui/BuildMenuModal.ts';
import { DemolishTool } from '../factory/input/DemolishTool.ts';
import { DemolishMath, type DemolishExecuteResult } from '../factory/input/DemolishMath.ts';
import { MachineInspectorModal } from '../factory/view/MachineInspectorModal.ts';
import { MachineInspectorHelper } from '../factory/view/MachineInspectorHelper.ts';
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
import { crazyGames, type AdErrorCode } from '../integration/CrazyGamesSDK.ts';
import { getLocale, joinList, setLocale, t, type LocaleCode } from '../i18n/i18n.ts';
import { hideBootLoader, setBootProgress } from '../ui/BootLoader.ts';

/** Aşama ödülleriyle açılan özelliklerin kimlikleri (bkz. MilestoneManager.DEFAULT_MILESTONES) */
const HANGAR_FEATURE = 'ROCKET_HANGAR';
/** Uçuş dönüşünde fabrikanın en fazla ne kadar süre için ilerletileceği (saniye) */
const FLIGHT_CATCH_UP_MAX_SEC = 600;
/** Uçuş dönüşü telafi simülasyonunun adım süresi (saniye) */
const FLIGHT_CATCH_UP_STEP_SEC = 1 / 30;
const SPLITTER_MERGER_FEATURE = 'SPLITTER_MERGER';
/** Dünyadaki yazıların (etiketler) kamera zoom'una göre yeniden üretilme aralığı (ms) */
const WORLD_TEXT_SYNC_INTERVAL_MS = 200;
/** Şehir karosunun kenarı (dünya pikseli; tools/generate_city_backdrop.py ile aynı). Arsa da bu boydadır. */
const FACTORY_BACKDROP_TILE = 1024;
/** Arsanın köşesinin karodaki yeri: bulvarın dış şeridi (24) ve çevre duvarı (6) arsanın dışında kalır */
const FACTORY_BACKDROP_LOT_OFFSET = 30;
/** Arsanın her yanına döşenen karo sayısı (kamera en uzak görünümde de boşluk görmesin) */
const FACTORY_BACKDROP_RING = 4;
/** Dil değişince sahne yeniden kurulur; kurulum bitince Ayarlar penceresi yeniden açılır */
let reopenSettingsAfterRestart = false;

/** Ödül verilmeyen reklam isteğinde oyuncuya gösterilen açıklama (nedeni SDK bildirir) */
function adFailureMessage(code: AdErrorCode | null): string {
  switch (code) {
    case 'unfilled':
      return t('ad.unfilled');
    case 'adCooldown':
      return t('ad.cooldown');
    case 'adblock':
      return t('ad.adblock');
    case 'adsDisabledBasicLaunch':
      return t('ad.basicLaunch');
    default:
      return t('ad.failed');
  }
}

/** Arsanın çevre duvarının kalınlığı (dünya pikseli) */
const FACTORY_FENCE_THICKNESS = 6;
/** Öğretici kutusunun fabrikayı örtmemesi için sığdırmada altta bırakılan ek şerit (arayüz birimi) */
const TUTORIAL_FIT_INSET = 48;
/** HUD'a uçan sikke ve vardığında çıkan kıvılcımın katmanı: HUD'ın (100) üstü, pencerelerin (200+) altı */
const HUD_FX_DEPTH = 110;

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
  /** Son bilinen roket sınıfı; yükseltmede sınıf atlandıysa kutlanır */
  private lastRocketClass = 1;
  private beltStepper!: BeltStepper;
  private zoomControls!: ZoomControls;
  private controlsModal!: ControlsModal;
  private leaderboardModal!: LeaderboardModal;
  private startScreen!: StartScreenModal;
  /** Öğretici: oyunun başından ilk uçuşa kadar sıradaki adımı gösterir */
  private tutorial = new TutorialGuide();
  private tutorialCoach!: TutorialCoach;
  /** Bu oturumda "Üret"e basılma sayısı (öğreticinin ilk adımı) */
  private manualClicks = 0;
  /** Öğretici kutusunun son yerleşimi; değişmedikçe yeniden yerleştirilmez */
  private coachLayoutKey = '';
  /** Fabrika görüş alanının arayüzdeki yeri (öğretici kutusu buna göre konumlanır) */
  private factoryView = { left: 0, right: 0, bottom: 0 };
  /** Dokunmatikte son döşenen bant; adım adım döşeme düğmeleri buna göre konumlanır */
  private beltStep: { coord: GridCoord; direction: Direction } | null = null;
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
  private rangeLadderModal!: RangeLadderModal;
  private boostModal!: BoostModal;
  /** Süreli gelir takviyesi (×2); reklamla veya nakitle alınır */
  private readonly incomeBoost = new IncomeBoost();
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
    // Açılış çubuğu yükleyicinin gerçek ilerlemesini gösterir
    this.load.on(Phaser.Loader.Events.PROGRESS, setBootProgress);

    // Roket modülleri: her seviyenin kendi görünümü vardır (Sv.4+ tools/generate_rocket_tiers.py)
    for (const part of ['hull', 'engine', 'wings', 'tank']) {
      for (let level = 1; level <= MAX_ROCKET_LEVEL; level++) {
        this.load.image(`rocket_${part}_${level}`, `assets/rocket_${part}_${level}.png`);
      }
    }

    // Alev Sprite'ları
    this.load.image('flame_idle', 'assets/flame_idle.png');
    this.load.image('flame_boost', 'assets/flame_boost.png');

    // Uçuş Parçaları ve Nesneleri
    this.load.image('pickup_gear', 'assets/pickup_gear.png');
    this.load.image('pickup_crystal', 'assets/pickup_crystal.png');
    this.load.image('pickup_repair', 'assets/pickup_repair.png');

    // Eşyalar: her birinin biçimini anlatan kendi çizimi vardır (tools/generate_item_assets.py)
    for (const item of defaultItemRegistry.getAll()) {
      this.load.image(item.spriteKey, `assets/items/${item.id}.png`);
    }

    // Engeller
    this.load.image('obstacle_asteroid', 'assets/obstacle_asteroid.png');
    this.load.image('obstacle_drone', 'assets/obstacle_drone.png');
    this.load.image('obstacle_debris', 'assets/obstacle_debris.png');

    // Rampa: her seviyenin kendi görünümü vardır (tools/generate_launch_pad.py)
    for (let level = 1; level <= MAX_LAUNCH_PAD_LEVEL; level++) {
      this.load.image(launchPadTextureKey(level), `assets/launch_pads/launch_pad_${level}.png`);
    }
    this.load.image('cloud_pixel', 'assets/cloud_pixel.png');
    this.load.image('star_pixel', 'assets/star_pixel.png');

    // Fabrika Çevresi ve Zemin
    this.load.image('factory_floor', 'assets/factory_floor.png');
    this.load.image('factory_backdrop', 'assets/factory_backdrop.png');
    this.load.image('boss', 'assets/boss.png');
    this.load.image('factory_concrete', 'assets/factory_concrete.png');
    this.load.image('factory_fence_h', 'assets/factory_fence_h.png');
    this.load.image('factory_fence_v', 'assets/factory_fence_v.png');
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

    // Uçuş: her menzil bölgesinin kendi gezegen yüzeyi (tools/generate_flight_ground.py)
    for (const theme of GROUND_THEMES) {
      this.load.image(groundTextureKey(theme), groundTexturePath(theme));
    }
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
    this.tutorial = new TutorialGuide();
    this.manualClicks = 0;
    this.coachLayoutKey = '';
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

    /* Hangar Tedarik Köprüsü ve Fabrika Simülasyon Ekonomisi */
    this.factoryEconomy = new FactoryEconomy(0, undefined, this.economy);
    this.hangarBridge = new RocketHangarBridge();
    this.hangarBridge.syncModuleLevels(this.economy.getAllRocketUpgrades());

    /* 2D Fabrika Mekânsal Izgarası ve Simülasyon Motorları */
    // Izgara tanımlı en büyük parsel boyutunda kurulur; açık alan parsellerle büyür
    this.gridMap = new GridMap(MAX_FACTORY_WIDTH, MAX_FACTORY_HEIGHT);
    // 24x24'ten büyük parseller uçuş rekoruna bağlı menzil izni ister (M9-D)
    this.plotManager = new PlotExpansionManager(
      this.factoryEconomy,
      this.gridMap,
      undefined,
      () => this.hangarBridge.getFlightStats().bestDistance,
    );
    this.milestones = new MilestoneManager();
    // Reklam teklifleri oyuncu ilk aşamaları geçtikten sonra görünür (yeni oyuncuya reklam sunulmaz)
    setAdProgressGate(() => this.milestones.completedCount >= RELEASE.adsMinCompletedStages);
    this.logistics = new LogisticsNetwork(this.gridMap);
    this.productionEngine = new ProductionEngine(this.gridMap, this.logistics);

    /* Fabrikanın çevresi:
       - en dışta minyatür sanayi şehri (tools/generate_city_backdrop.py; kesintisiz döşenen karo).
         Karo, arsanın kenarları bulvarların orta refüjüne gelecek biçimde hizalanır: arsanın dört
         yanında yol kalır, hiçbir yapı duvarla kesilmez;
       - arsanın tamamında (fabrikanın genişleyebileceği 32x32 hücre) beton (generate_theme_assets.py),
       - arsanın kenarında çevre duvarı.
       Hiçbiri etkileşimli değildir; açık fabrika zemini bunların üstüne çizilir. */
    const lotWidth = MAX_FACTORY_WIDTH * 32;
    const lotHeight = MAX_FACTORY_HEIGHT * 32;
    const backdropStart = -FACTORY_BACKDROP_LOT_OFFSET - FACTORY_BACKDROP_RING * FACTORY_BACKDROP_TILE;
    const backdropSize = (FACTORY_BACKDROP_RING * 2 + 1) * FACTORY_BACKDROP_TILE;
    this.add
      .tileSprite(backdropStart, backdropStart, backdropSize, backdropSize, 'factory_backdrop')
      .setOrigin(0, 0)
      .setDepth(0);
    this.add.tileSprite(0, 0, lotWidth, lotHeight, 'factory_concrete').setOrigin(0, 0).setDepth(0.2);
    const fence = FACTORY_FENCE_THICKNESS;
    this.add.tileSprite(-fence, -fence, lotWidth + fence * 2, fence, 'factory_fence_h').setOrigin(0, 0).setDepth(0.3);
    this.add.tileSprite(-fence, lotHeight, lotWidth + fence * 2, fence, 'factory_fence_h').setOrigin(0, 0).setDepth(0.3);
    this.add.tileSprite(-fence, 0, fence, lotHeight, 'factory_fence_v').setOrigin(0, 0).setDepth(0.3);
    this.add.tileSprite(lotWidth, 0, fence, lotHeight, 'factory_fence_v').setOrigin(0, 0).setDepth(0.3);

    /* 2D Fabrika Zemin ve Render Katmanları */
    this.gridView = new GridView(this, this.gridMap, this.factoryEconomy);
    this.gridView.getPlotPermitLabel = (plotIndex) => {
      const rung = this.plotManager.getMissingPermit(plotIndex);
      return rung ? t('plot.permitNeeded', { distance: formatDistance(rung.targetMeters) }) : null;
    };
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
        fx.emitFloatingText(this, exportWorld.x, exportWorld.y - 12, t('hangar.toHangar'), PALETTE.rocketCyanHex);
        if (this.hangarBridge.getOutstandingNeed(event.itemId) === 0) {
          const ready = this.hangarBridge.getModulesCompletedBy(event.itemId);
          if (ready.length > 0) {
            sound.playMilestone();
            this.notify(t('hangar.partsReady'), 'reward');
          }
          this.saveGame();
        }
        return;
      }

      const earned = this.factoryEconomy.exportItem(event.itemId);
      if (this.isCatchingUp) return;
      fx.emitSparkles(this, exportWorld.x, exportWorld.y, 8, PALETTE.resourceGold);
      // Art arda satışlar tek, yumuşak bir gelir sesinde birleşir (SoundManager.playIncome)
      sound.playIncome();
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
            const item = defaultItemRegistry.get(itemId)?.name ?? t('common.rawMaterial');
            this.notify(t('notify.intakeBuilt', { item, cost: formatNumber(result.spentMoney) }), 'success');
          } else if (result.itemType === 'INTAKE_MOVE' || this.placementController.currentItem?.type === 'INTAKE_MOVE') {
            this.gridView.refresh();
            this.notify(t('notify.moved', { name: t('logistics.intake') }), 'success');
          } else if (result.itemType === 'EXPORT_MOVE' || this.placementController.currentItem?.type === 'EXPORT_MOVE') {
            this.gridView.refresh();
            this.notify(t('notify.moved', { name: t('logistics.crate') }), 'success');
          } else if (result.itemType === 'MACHINE_MOVE') {
            this.machineRenderer.rebuild();
            this.machineStatusIndicator.rebuild();
            const movedName = this.productionEngine.getMachine(result.instanceId ?? '')?.def.name ?? t('common.machine');
            this.notify(t('notify.moved', { name: movedName }), 'success');
          } else if (result.instanceId) {
            this.machineRenderer.rebuild();
            this.machineStatusIndicator.rebuild();
            const machineDef = this.productionEngine.getMachine(result.instanceId)?.def;
            const name = machineDef?.name ?? t('common.machine');
            this.notify(t('notify.built', { name, cost: formatNumber(result.spentMoney) }), 'success');
          } else {
            // Bant sürükleyerek döşenir; her bant için bildirim göstermek ekranı doldurur.
            // Yalnız döşenen hücre ve komşuları yeniden çizilir (büyük fabrikada takılmasın).
            this.conveyorRenderer.refreshAround([result.coord]);
            this.rememberBeltStep(result.coord);
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
          // Seviye rozeti kendini her karede eşitler; bütün makineleri yeniden kurmak
          // büyük fabrikada art arda yükseltmede takılmaya yol açıyordu.
          sound.playUpgrade();
          fx.emitSparkles(this, this.ui.width / 2, this.ui.height / 2, 16, PALETTE.resourceGold, 'ui');
          this.saveGame();
          this.notify(t('notify.machineLevel', { name: machine.def.name, n: level }), 'success');
        },
        onUpgradeDenied: () => this.notify(t('notify.noMoneyUpgrade'), 'warning'),
        onRecipeChanged: (_machine, _recipeId) => {
          this.saveGame();
          sound.playCoin();
        },
        adDiscount: {
          isOffered: () => ads.isOffered('machine_discount'),
          onRequest: (machine) => void this.requestMachineDiscount(machine),
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
            fx.emitSparkles(this, worldPos.x, worldPos.y, 16, PALETTE.removeRed);
            this.saveGame();
            this.notify(t('notify.removedRefund', { name: result.name, amount: formatNumber(result.refundAmount) }), 'info');
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
            this.notify(t('notify.removedRefund', { name: result.name, amount: formatNumber(result.refundAmount) }), 'info');
          } else if (result.targetType === 'INTAKE') {
            this.onIntakeDemolished(result);
          } else {
            this.conveyorRenderer.refreshAround(result.freedCoords);
          }
          sound.playDemolish();
          const firstCoord = result.freedCoords[0];
          if (firstCoord) {
            const worldPos = GridCoordinates.gridToWorldCenter(firstCoord, 32);
            fx.emitSparkles(this, worldPos.x, worldPos.y, 14, PALETTE.removeRed);
          }
          this.saveGame();
        },
        onProtectedClicked: (name) => {
          sound.playDemolish();
          this.notify(t('notify.protected', { name }), 'warning');
        },
      },
    );
    this.demolishTool.isInputBlocked = isToolInputBlocked;

    // Pencere açıkken (Ayarlar dahil: o sırada oyun döngüsü durur) dünya girdi almaz;
    // kaydırma, tekerlek ve iki parmak hareketi yalnızca açık pencereye aittir.
    this.cameraController.isInputBlocked = () => this.ui.isModalOpen;

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
      getIntakeRefund: (coord) =>
        PlacementMath.getIntakeRefund(this.gridMap.getCell(coord.x, coord.y)?.intakeData?.itemId ?? '', this.gridMap),
      onDemolishIntake: (coord) => {
        const result = DemolishMath.executeDemolish({
          grid: this.gridMap,
          logistics: this.logistics,
          engine: this.productionEngine,
          economy: this.factoryEconomy,
          coord,
        });
        if (!result.success) return;
        this.onIntakeDemolished(result);
        sound.playDemolish();
        const worldPos = GridCoordinates.gridToWorldCenter(coord, 32);
        fx.emitSparkles(this, worldPos.x, worldPos.y, 14, PALETTE.removeRed);
        this.saveGame();
      },
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
        if (!plot) return null;
        const permit = this.plotManager.getMissingPermit(plot.index);
        return {
          index: plot.index,
          name: plot.name,
          cost: this.plotManager.getPlotCost(plot.index),
          width: plot.targetWidth,
          height: plot.targetHeight,
          permitDistance: permit ? formatDistance(permit.targetMeters) : undefined,
          permitName: permit?.name,
        };
      },
      getIntakeCost: (itemId) => PlacementMath.getIntakeCost(itemId, this.gridMap),
      // Parsel pahalı bir alımdır: katalogdan da onay penceresiyle (ve varsa indirim seçeneğiyle) alınır
      onExpandPlot: (plotIndex) => {
        this.buildMenuModal.close();
        this.confirmPlotUnlock(plotIndex);
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
      () => this.saveGame(),
      () => this.rangeLadderModal.open(),
      {
        isOffered: () => ads.isOffered('parts_cargo'),
        cooldownRemaining: () => ads.cooldownRemaining('parts_cargo'),
        onRequest: (category) => void this.requestPartsCargo(category),
      },
      (level) => this.onLaunchPadUpgraded(level),
      {
        isOffered: () => ads.isOffered('pad_discount'),
        onRequest: () => void this.requestPadDiscount(),
      },
      // Sıralama düğmesi yalnız gerçekten bir sıralama sunulabiliyorsa çizilir
      isGlobalLeaderboardAvailable() ? () => this.openLeaderboard() : null,
    );

    /* Ana ekran */
    this.hud = new HUD(
      this.ui,
      () => this.settingsPanel.open(),
      () => {
        this.cancelActiveTool();
        this.boostModal.open();
      },
      () => this.openLeaderboard(),
    );
    /* Lider tablosu: rekor mesafeye göre sıralama (HUD'daki rekor bölümünden açılır) */
    this.leaderboardModal = new LeaderboardModal(this.ui, {
      getPlayer: () => currentPlayer(this.hangarBridge.getFlightStats().bestDistance),
      getBoardState: () => getCrazyGamesBoardState(),
      loadAccount: async () => ({
        available: crazyGames.isUserAccountAvailable,
        username: (await crazyGames.getUser())?.username ?? null,
      }),
      requestLogin: async () => {
        await crazyGames.showAuthPrompt();
      },
      loadSnapshot: () => leaderboard.snapshot(currentPlayer(this.hangarBridge.getFlightStats().bestDistance)),
      getOpenHangar: () => (this.milestones.isFeatureUnlocked(HANGAR_FEATURE) ? () => this.openHangar() : null),
    });
    this.boostModal = new BoostModal(this.ui, {
      getState: () => ({
        remainingSec: this.incomeBoost.remaining,
        canAdd: this.incomeBoost.canAdd(),
        cashPrice: this.getBoostCashPrice(),
        canAffordCash: this.factoryEconomy.canAfford(this.getBoostCashPrice()),
        adOffered: ads.isOffered('income_boost'),
        adCooldownSec: ads.cooldownRemaining('income_boost'),
      }),
      onWatchAd: () => void this.requestBoostWithAd(),
      onBuyWithCash: () => this.buyBoostWithCash(),
      onDenied: (message) => this.notify(message, 'warning'),
    });
    this.stagesModal = new StagesModal(this.ui, this.milestones, () =>
      this.milestones.getCurrentProgress(this.factoryEconomy, this.productionEngine),
    );
    this.rangeLadderModal = new RangeLadderModal(
      this.ui,
      () => ({
        bestDistance: this.hangarBridge.getFlightStats().bestDistance,
        rocketClass: this.hangarBridge.getRocketClass(),
        revenueMultiplier: this.factoryEconomy.revenueMultiplier,
        hangarUnlocked: this.milestones.isFeatureUnlocked(HANGAR_FEATURE),
      }),
      () => this.openHangar(),
    );
    // Aşamalar bitince hedef kartı menzil hedefini gösterir ve Seferler penceresini açar
    this.objective = new ObjectiveCard(this.ui, () => {
      this.cancelActiveTool();
      if (this.milestones.completedCount >= this.milestones.totalCount) {
        this.rangeLadderModal.open();
      } else {
        this.stagesModal.open();
      }
    });
    this.toolbar = new Toolbar(this.ui, {
      onProduce: () => this.onClickProduce(),
      onBelt: () => this.toggleBeltTool(),
      onBuild: () => this.openCatalog(),
      onDemolish: () => this.toggleDemolishTool(),
      onHangar: () => this.openHangar(),
      onHangarLocked: () => {
        const stage = this.milestones.getFeatureUnlockStage(HANGAR_FEATURE);
        this.notify(t('hangar.lockedUntilStage', { n: stage ?? '?' }), 'warning');
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
    this.beltStepper = new BeltStepper(this.ui, {
      onAdvance: (direction) => this.advanceBelt(direction),
      onTurnLast: (direction) => this.turnLastBelt(direction),
      cellToUi: (coord) => {
        const center = GridCoordinates.gridToWorldCenter(coord, 32);
        const point = this.worldToUi(center.x, center.y);
        return { ...point, size: (32 * this.factoryCamera.zoom) / this.ui.zoom };
      },
    });
    this.zoomControls = new ZoomControls(this.ui, {
      onZoomIn: () => this.zoomFactory(1),
      onZoomOut: () => this.zoomFactory(-1),
    });
    this.toast = new UiToast(this.ui);
    this.confirmDialog = new UiConfirmDialog(this.ui);

    /* Ayarlar */
    this.controlsModal = new ControlsModal(this.ui);
    // Giriş ekranı kapanınca masaüstünde (ilk açılışta) kontrol şeması gösterilir
    this.startScreen = new StartScreenModal(
      this.ui,
      () => {
        // CrazyGames'te "Oyna" doğrudan oynanışa iner; şema Ayarlar > Kontroller'dedir
        if (shouldAutoOpenControls()) this.controlsModal.openOnFirstVisit();
      },
      // Sıralama sunulamıyorken giriş cümlesi lider tablosu vaat etmez
      () => (isGlobalLeaderboardAvailable() ? t('start.message') : t('start.messageSolo')),
    );
    this.settingsPanel = new SettingsPanel(this.ui, () => this.resetGame(), {
      onShowControls: () => this.controlsModal.open(),
      isTutorialActive: () => !this.tutorial.isDone,
      onToggleTutorial: () => {
        if (this.tutorial.isDone) {
          this.tutorial.restart();
        } else {
          this.tutorial.skip();
        }
        this.saveGame();
        this.layoutAll();
      },
      onChangeLanguage: (code) => this.changeLanguage(code),
    });

    /* Öğretici kutusu */
    this.tutorialCoach = new TutorialCoach(this.ui, {
      onConfirm: (stepId) => {
        this.tutorial.confirm(stepId);
        this.saveGame();
      },
      onSkip: () =>
        this.confirmDialog.ask({
          title: t('tutorial.skipTitle'),
          message: t('tutorial.skipMessage'),
          confirmLabel: t('common.close'),
          onConfirm: () => {
            this.tutorial.skip();
            this.saveGame();
            this.layoutAll();
          },
        }),
    });

    /* Çevrimdışı İlerleme Penceresi */
    this.offlineEarningsModal = new OfflineEarningsModal(this.ui, {
      onClaim: (gained, doubled) => {
        this.economy.addResources(gained);
        this.saveGame();
        this.notify(
          doubled
            ? t('offline.collectedDouble', { amount: formatNumber(gained) })
            : t('offline.collected', { amount: formatNumber(gained) }),
          'reward',
        );
      },
      // Reklam sunulamıyorsa 2X düğmesi hiç çizilmez; izlenemezse normal kazanç toplanabilir
      canOfferDouble: () => ads.isOffered('offline_double'),
      requestDouble: () => this.watchAd('offline_double'),
    });

    // Reklam ekrandayken fabrika durur; kapanınca geçen süre telafi edilir (oyuncu gelir kaybetmez).
    // Uçuş sırasındaki reklamda sahne zaten duraklamıştır ve uçuş dönüşü telafisi o süreyi kapsar.
    const unsubscribeAds = ads.subscribe({
      onEnded: (elapsedSec) => {
        if (this.scene.isActive()) this.catchUpFactory(elapsedSec);
      },
    });
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribeAds);

    /* Klavye kısayolları */
    this.bindShortcuts();

    // Sağ tuş kamerayı kaydırır (CameraController); tarayıcı menüsü açılmasın.
    // Sürüklemeden bırakılan sağ tık ise etkin aracı iptal eder.
    this.input.mouse?.disableContextMenu();
    // Phaser basış konumunu yalnız sol tuş için tuttuğundan sağ tuşunki burada saklanır
    let rightDown: { x: number; y: number } | null = null;
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (!pointer.wasTouch && pointer.button === 2) rightDown = { x: pointer.x, y: pointer.y };
    });
    this.input.on('pointerup', (pointer: Phaser.Input.Pointer) => {
      if (pointer.wasTouch || !pointer.rightButtonReleased() || !rightDown) return;
      const moved = Phaser.Math.Distance.Between(rightDown.x, rightDown.y, pointer.x, pointer.y);
      rightDown = null;
      if (moved <= 8 * this.ui.metrics.renderScale && !this.ui.isModalOpen) {
        this.cancelActiveTool();
      }
    });

    /* İlk yerleşim; pencere boyutu veya arayüz ölçeği değişince yeniden */
    this.layoutAll();
    this.ui.onLayout(() => this.layoutAll());

    /* Ekonomi olayları */
    this.economy.on((evt) => {
      if (evt.type === 'rocket_upgrade') {
        sound.playUpgrade();
        fx.emitSparkles(this, this.ui.width / 2, this.ui.height / 2, 20, PALETTE.rocketCyan, 'ui');
        // Dört modül de bir üst seviyeye çıktıysa roket sınıf atlar: hız çarpanı büyür
        const rocketClass = this.hangarBridge.getRocketClass();
        if (rocketClass > this.lastRocketClass) {
          this.notify(t('hangar.classUp', { n: rocketClass, factor: getRangeScale(rocketClass) }), 'reward');
          fx.emitConfetti(this, this.ui.width / 2, this.hud.bottom + 30, 24, 'ui');
        }
        this.lastRocketClass = rocketClass;
        this.saveGame();
      }
    });

    /* Kayıt yükle */
    this.loadGame();
    // Öğreticinin durumu kayıttan geldi: kutusuna ayrılan şerit buna göre yeniden hesaplanır
    this.layoutAll();

    this.lastRocketClass = this.hangarBridge.getRocketClass();

    /* Giriş ekranı: sayfa her açıldığında bir kez. Ardından masaüstünde ilk açılışta
       kontrol şeması gösterilir (sonra Ayarlar > Kontroller). */
    if (reopenSettingsAfterRestart) {
      // Dil değişti: oyuncu seçimini yaptığı pencerede, yeni dille kalır
      reopenSettingsAfterRestart = false;
      this.settingsPanel.open();
    } else if (!this.startScreen.openOnce() && shouldAutoOpenControls()) {
      this.time.delayedCall(250, () => this.controlsModal.openOnFirstVisit());
    }

    /* İlk UI güncellemesi */
    this.refreshUI();

    // Fabrika teması: zaten çalıyorsa (sahne yeniden kurulduysa) baştan başlamaz; ses
    // bağlamı henüz açılmadıysa oyuncunun ilk dokunuşunda başlar
    sound.playMusic('factory');

    // Dosyalar indi ve sahne kuruldu: yükleme bitti (yalnızca ilk kurulumda etkilidir)
    hideBootLoader();
    crazyGames.loadingStop();
  }

  /* ================================================================
   * FIRLATMA VE UÇUŞ SAHNESİ GEÇİŞİ
   * ================================================================ */

  private startFlight(): void {
    this.cancelActiveTool();
    this.machineInspectorModal.close();
    this.terminalModal.close();
    // Fırlatma sesi roket rampadan kalkınca (FlightScene.blastOff) çalar; burada uçuş teması açılır
    sound.playMusic('flight');
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
    // Tamamlanan uçuşun mesafesi lider tablosuna bildirilir (uçuş başına bir kez, yalnızca burada).
    // Oyunun yeniden "oynanıyor" sayılması update içindeki eşitlemeyle olur.
    void submitFlightDistance(distance, this.hangarBridge.getFlightStats().bestDistance);
    sound.playCoin();
    sound.playMusic('factory');
    this.cameraController.setEnabled(true);
    const factoryEarned = this.catchUpFactory((Date.now() - this.flightStartedAtMs) / 1000);
    this.gridView.refresh();
    // Uçuş sırasında pencere boyutu değişmiş olabilir
    this.layoutAll();
    this.saveGame();
    this.refreshUI();

    const multiplier = this.factoryEconomy ? this.factoryEconomy.revenueMultiplier : 1.0;
    const bonusText = multiplier > 1.0 ? t('flight.returnedIncome', { factor: formatFixed(multiplier, 2) }) : '';
    const factoryText =
      factoryEarned > 0 ? `\n${t('flight.returnedFactory', { amount: formatNumber(factoryEarned) })}` : '';

    this.notify(
      t('flight.returned', { amount: formatNumber(totalResources), distance: formatDistance(distance) }) +
        bonusText +
        factoryText,
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
    // Süreli gelir takviyesi oyun süresiyle işler (uçuş sonrası telafide de)
    this.incomeBoost.update(dt);
    this.factoryEconomy.incomeBoostMultiplier = this.incomeBoost.multiplier;
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

  /**
   * CrazyGames'e oyunun oynanıp oynanmadığını bildirir. Giriş ekranı, ayarlar (oyun
   * duraklar) ve kontrol şeması menü sayılır; diğer pencereler açıkken fabrika çalışmaya
   * devam ettiği için oyun sürer. Sekme değişimini ve odağı platform kendisi izler.
   */
  private syncGameplayState(): void {
    const inMenu = this.startScreen.isOpen || this.settingsPanel.isOpen || this.controlsModal.isOpen;
    if (inMenu || ads.isPlaying) crazyGames.gameplayStop();
    else crazyGames.gameplayStart();
  }

  update(_time: number, delta: number): void {
    this.syncGameplayState();
    // Ayarlar açıkken ve reklam ekrandayken oyun duraklar. Kamera da kilitlenir: yoksa
    // Ayarlar'da tekerlekle kaydırmak arkadaki fabrikayı yakınlaştırıp kaydırır
    if (this.settingsPanel.isOpen || ads.isPlaying) {
      this.cameraController.setEnabled(false);
      return;
    }

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
    // Basış başına kazanç içinde bulunulan aşamaya göre belirlenir (DEC-050)
    this.economy.setClickPower(getClickPowerForStage(this.milestones.completedCount));
    const gained = this.economy.produceByClick();
    this.manualClicks += 1;

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
    const coin = this.ui.adopt(this.add.sprite(fromX, fromY, coinKey, 0).setDepth(HUD_FX_DEPTH).setScale(1.5));
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
        // HUD'ın kıvılcımı HUD katmanında kalır; açık pencerenin (katalog) üstüne çıkmaz
        fx.emitSparkles(this, target.x, target.y, 6, PALETTE.resourceGold, 'ui', HUD_FX_DEPTH);
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

      // Platform kutlaması yalnızca büyük başarıda: aşamaların tamamı bitince (ara aşamalar
      // "bölüm bitirme" sayılır; CrazyGames bunlar için istemiyor). Oyunun kendi kutlaması her aşamada.
      if (this.milestones.isAllCompleted) crazyGames.happytime();
      sound.playMilestone();
      fx.emitConfetti(this, this.ui.width / 2, this.hud.bottom + 30, 32, 'ui');
      this.objective.playGoalReachedEffect();
      this.notify(
        formatMilestoneCompleted(result.claimedMilestone, getClickPowerForStage(this.milestones.completedCount)),
        'reward',
      );
      this.saveGame();
    }
  }

  /**
   * Fabrika zeminindeki parsel rozetine dokunulduğunda satın almadan önce sorar;
   * rozet kaydırma sırasında parmağın altında kalabildiği için tek dokunuşla para harcanmaz.
   */
  private confirmPlotUnlock(plotIndex: number): void {
    const plot = this.plotManager.getPlot(plotIndex);
    if (
      !plot ||
      !this.plotManager.isPlotAvailable(plotIndex) ||
      this.plotManager.getMissingPermit(plotIndex) ||
      !this.plotManager.canAffordPlot(plotIndex)
    ) {
      // Açılamıyorsa nedeni requestPlotUnlock bildirir
      this.requestPlotUnlock(plotIndex);
      return;
    }

    this.askPlotPurchase(plotIndex);
  }

  /**
   * Parsel satın alma onayı. Pahalı parsellerde bir kereliğine reklamla indirim
   * ("müteahhit indirimi") seçeneği de sunulur; reklam sunulamıyorsa seçenek çizilmez.
   */
  private askPlotPurchase(plotIndex: number): void {
    const plot = this.plotManager.getPlot(plotIndex);
    if (!plot) return;
    const cost = this.plotManager.getPlotCost(plotIndex);
    const discounted = this.factoryEconomy.isPlotDiscounted(plotIndex);
    const discountPercent = Math.round(PLOT_AD_DISCOUNT * 100);
    const canOfferDiscount = this.factoryEconomy.canDiscountPlot(plotIndex) && ads.canShow('plot_discount');

    const size = `${plot.targetWidth}x${plot.targetHeight}`;
    this.confirmDialog.ask({
      title: plot.name,
      message: discounted
        ? t('plot.confirmDiscounted', { size, cost: formatInteger(cost), percent: discountPercent })
        : t('plot.confirmMessage', { size, cost: formatInteger(cost) }),
      confirmLabel: t('common.buy'),
      onConfirm: () => this.requestPlotUnlock(plotIndex),
      extraAction: canOfferDiscount
        ? {
            label: t('plot.watchAd', { percent: discountPercent }),
            sublabel: `$${formatInteger(Math.round(plot.cost * (1 - PLOT_AD_DISCOUNT)))}`,
            icon: uiIcon('video'),
            onClick: () => void this.requestPlotDiscount(plotIndex),
          }
        : undefined,
    });
  }

  /* ================================================================
   * ÖDÜLLÜ REKLAM YERLEŞİMLERİ (M9-E; şimdilik sahte sağlayıcı)
   * ================================================================ */

  /**
   * Ödüllü reklamı gösterir. Ödülü çağıran verir ve yalnızca true dönerse verir;
   * reklam gösterilemezse nedeni bildirilir ve ödül verilmez.
   */
  private async watchAd(placement: AdPlacementId): Promise<boolean> {
    const result = await ads.show(placement);
    if (result === 'rewarded') return true;

    if (result === 'failed') {
      this.notify(adFailureMessage(crazyGames.lastAdError), 'warning');
    } else if (result === 'cooldown') {
      this.notify(t('ad.waitPlacement', { time: formatAdCooldown(ads.cooldownRemaining(placement)) }), 'warning');
    } else if (result === 'unavailable') {
      this.notify(t('ad.unavailable'), 'warning');
    }
    return false;
  }

  /** R5: parselin bedelini bir kereliğine düşürür ve onayı yeni bedelle yeniden sorar */
  private async requestPlotDiscount(plotIndex: number): Promise<void> {
    if (!this.factoryEconomy.canDiscountPlot(plotIndex)) return;
    if (await this.watchAd('plot_discount')) {
      this.factoryEconomy.applyPlotDiscount(plotIndex);
      this.gridView.syncLockedPlotAffordability();
      this.saveGame();
      this.notify(t('plot.discounted', { percent: Math.round(PLOT_AD_DISCOUNT * 100) }), 'reward');
    }
    // İndirim alınsa da alınmasa da karar oyuncunundur: onay yeniden sorulur
    if (!this.plotManager.isPlotUnlocked(plotIndex)) this.askPlotPurchase(plotIndex);
  }

  /** R4: hedef modülün eksik parçalarının bir bölümünü hangara ekler */
  private async requestPartsCargo(category: RocketModuleCategory): Promise<void> {
    if (!this.hangarBridge.canGrantPartsCargo(category)) return;
    if (!(await this.watchAd('parts_cargo'))) return;
    const granted = this.hangarBridge.grantPartsCargo(category);
    this.saveGame();
    const list = joinList(granted.map((part) => t('hangar.cargoPart', { count: part.count, item: part.itemName })));
    this.notify(t('hangar.cargoArrived', { list }), 'reward');
  }

  private onLaunchPadUpgraded(level: number): void {
    sound.playUpgrade();
    fx.emitSparkles(this, this.ui.width / 2, this.ui.height / 2, 20, PALETTE.rocketCyan, 'ui');
    this.notify(t('hangar.padUpgraded', { n: level }), 'success');
    this.saveGame();
  }

  /** R6: reklam izlenirse rampanın sıradaki seviyesi indirimli bedelle alınır */
  private async requestPadDiscount(): Promise<void> {
    const cost = this.hangarBridge.getLaunchPadUpgradeCost(LAUNCH_PAD_AD_DISCOUNT);
    if (cost === null || !this.factoryEconomy.canAfford(cost)) return;
    if (!(await this.watchAd('pad_discount'))) return;
    if (this.hangarBridge.upgradeLaunchPad(this.factoryEconomy, LAUNCH_PAD_AD_DISCOUNT)) {
      this.onLaunchPadUpgraded(this.hangarBridge.getLaunchPadLevel());
    }
  }

  /** R7: reklam izlenirse makinenin sıradaki seviyesi indirimli bedelle alınır */
  private async requestMachineDiscount(machine: MachineEntity): Promise<void> {
    const engine = this.productionEngine;
    const level = engine.getMachineLevel(machine.instanceId);
    const cost = this.factoryEconomy.getMachineUpgradeCost(machine.def.baseCost, level, MACHINE_UPGRADE_AD_DISCOUNT);
    if (!this.factoryEconomy.canAfford(cost)) return;
    if (!(await this.watchAd('machine_discount'))) return;
    // Reklam sürerken makine sökülmüş olabilir
    if (!engine.getMachine(machine.instanceId)) return;

    const result = MachineInspectorHelper.performUpgrade(machine, engine, this.factoryEconomy, MACHINE_UPGRADE_AD_DISCOUNT);
    if (!result.success) {
      this.notify(t('notify.noMoneyUpgrade'), 'warning');
      return;
    }
    sound.playUpgrade();
    fx.emitSparkles(this, this.ui.width / 2, this.ui.height / 2, 16, PALETTE.resourceGold, 'ui');
    this.saveGame();
    const percent = Math.round(MACHINE_UPGRADE_AD_DISCOUNT * 100);
    this.notify(
      t('notify.machineLevelAd', { name: machine.def.name, n: result.newLevel, percent, cost: formatNumber(result.cost) }),
      'reward',
    );
  }

  /** Takviyenin nakit bedeli (takviyesiz gelirden hesaplanır) */
  private getBoostCashPrice(): number {
    return this.incomeBoost.cashPrice();
  }

  /** R3: reklam izleyerek gelir takviyesi süresi ekler */
  private async requestBoostWithAd(): Promise<void> {
    if (!this.incomeBoost.canAdd()) return;
    if (!(await this.watchAd('income_boost'))) return;
    this.grantBoost();
  }

  /** R3'ün reklamsız yolu: aynı süre nakitle alınır */
  private buyBoostWithCash(): void {
    if (!this.incomeBoost.canAdd()) return;
    if (!this.factoryEconomy.spendMoney(this.getBoostCashPrice())) {
      this.notify(t('boost.needCash', { amount: formatNumber(this.getBoostCashPrice()) }), 'warning');
      return;
    }
    this.grantBoost();
  }

  private grantBoost(): void {
    this.incomeBoost.add(BOOST_GRANT_SECONDS);
    this.factoryEconomy.incomeBoostMultiplier = this.incomeBoost.multiplier;
    sound.playUpgrade();
    this.saveGame();
    this.notify(
      t('boost.granted', { factor: BOOST_MULTIPLIER, time: formatAdCooldown(this.incomeBoost.remaining) }),
      'reward',
    );
  }

  /** Sökülen hammadde girişinin zemindeki izini siler ve iadeyi bildirir */
  private onIntakeDemolished(result: DemolishExecuteResult): void {
    this.gridView.refresh();
    // Girişe bağlı bantların uçları yeniden çizilsin
    this.conveyorRenderer.refreshAround(result.freedCoords);
    this.notify(
      result.refundAmount > 0
        ? t('notify.removedRefund', { name: result.name, amount: formatNumber(result.refundAmount) })
        : t('notify.removed', { name: result.name }),
      'info',
    );
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
      this.notify(t('plot.opened', { name: res.plotName, size: `${res.newBounds.width}x${res.newBounds.height}` }), 'reward');
      return true;
    }

    if (res.error === 'PREVIOUS_PLOT_REQUIRED') {
      this.notify(t('plot.previousFirst'), 'warning');
    } else if (res.error === 'RANGE_PERMIT_REQUIRED' && res.permitRung) {
      this.notify(
        t('plot.needRange', {
          name: res.plotName,
          distance: formatDistance(res.permitRung.targetMeters),
          range: res.permitRung.name,
        }),
        'warning',
      );
    } else if (res.error === 'INSUFFICIENT_FUNDS') {
      this.notify(t('plot.needMoney', { amount: formatNumber(res.cost) }), 'warning');
    } else if (res.error === 'ALREADY_UNLOCKED') {
      this.notify(t('plot.alreadyOpen'), 'info');
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
    this.incomeBoost.observeRevenue(revenuePerSec);
    this.hud.update(
      this.economy.resources,
      revenuePerSec,
      this.hangarBridge.getFlightStats().bestDistance,
      this.incomeBoost.isActive ? `×${BOOST_MULTIPLIER} ${formatAdCooldown(this.incomeBoost.remaining)}` : '',
      // Takviye reklamla artırılabiliyorsa gelir rozetinin yanında küçük bir düğme belirir
      this.tutorial.isDone &&
        revenuePerSec > 0 &&
        this.incomeBoost.canAdd() &&
        ads.isOffered('income_boost') &&
        ads.cooldownRemaining('income_boost') === 0,
    );

    /* Hedef kartı: tamamlanan aşamanın ödülünü ver, sonra sıradaki görevi göster */
    this.claimCompletedMilestones();
    this.objective.update(
      buildObjectiveView(
        this.milestones.getCurrentProgress(this.factoryEconomy, this.productionEngine),
        this.milestones.completedCount,
        this.milestones.totalCount,
        revenuePerSec,
        this.hangarBridge.getFlightStats().bestDistance,
      ),
    );
    this.syncObjectiveSlot();

    /* Araç çubuğu ve etkin araç çubuğu */
    this.toolbar.setHangarUnlocked(this.milestones.isFeatureUnlocked(HANGAR_FEATURE));
    this.syncToolUi();

    /* Yakınlaştırma düğmeleri: geçerli oran ve sınırlar */
    this.zoomControls.update(
      this.cameraController.zoomPercent,
      this.cameraController.canZoomIn,
      this.cameraController.canZoomOut,
    );

    /* Açık pencerelerin canlı değerleri */
    if (this.buildMenuModal.isOpen) this.buildMenuModal.refresh();
    if (this.machineInspectorModal.isOpen) this.machineInspectorModal.refresh();
    if (this.rocketHangar.isOpen) this.rocketHangar.refresh();
    if (this.stagesModal.isOpen) this.stagesModal.refresh();
    if (this.rangeLadderModal.isOpen) this.rangeLadderModal.refresh();
    if (this.boostModal.isOpen) this.boostModal.refresh();

    /* Sıradaki parsel rozeti: para yetince alınabilir görünüme geçsin */
    this.gridView.syncLockedPlotAffordability();

    this.syncTutorial();
  }

  /* ================================================================
   * ÖĞRETİCİ
   * ================================================================ */

  private buildTutorialContext(): TutorialContext {
    const machines = this.productionEngine.getAllMachines();
    const first = machines[0];
    return {
      completedStages: this.milestones.completedCount,
      manualClicks: this.manualClicks,
      money: this.factoryEconomy.money,
      firstUpgradeCost: first
        ? this.factoryEconomy.getMachineUpgradeCost(
            first.def.baseCost,
            this.productionEngine.getMachineLevel(first.instanceId),
          )
        : 0,
      hasUpgradedMachine: machines.some((machine) => this.productionEngine.getMachineLevel(machine.instanceId) > 1),
      hasMachine: (defId) => machines.some((machine) => machine.defId === defId),
      exported: (itemId) => this.milestones.getExportedCount(itemId),
      isPlotUnlocked: (plotIndex) => this.factoryEconomy.isPlotUnlocked(plotIndex),
      hangarUnlocked: this.milestones.isFeatureUnlocked(HANGAR_FEATURE),
      leaderboardOnline: isGlobalLeaderboardAvailable(),
      totalFlights: this.hangarBridge.getFlightStats().totalFlights,
    };
  }

  /** Öğreticinin geçerli adımını ve vurgusunu ekrana yansıtır; pencere açıkken gizler */
  private syncTutorial(): void {
    if (this.tutorial.isDone) {
      if (this.tutorialCoach.visible) this.tutorialCoach.show(null);
      return;
    }

    const step = this.tutorial.current(this.buildTutorialContext());
    // Pencere açıkken ve yön önizlemesinde kutu içeriği örtmesin
    const hidden = !step || this.ui.isModalOpen || this.rotationPreview.visible;
    if (hidden) {
      this.tutorialCoach.show(null);
      if (!step) {
        // Öğretici bitti: kayda geçir ve kutunun şeridini fabrikaya geri ver
        this.saveGame();
        this.layoutAll();
      }
      return;
    }

    // Kutu fabrikanın altında, araç çubuğunun (ve varsa etkin araç çubuğunun) üstünde durur
    const view = this.factoryView;
    const bottom = view.bottom - (this.contextBar.visible ? ToolContextBar.height + SPACE.sm : 0);
    const maxWidth = view.right - view.left - SPACE.md * 2;
    const layoutKey = `${Math.round(view.left)}|${Math.round(view.right)}|${Math.round(bottom)}`;
    if (layoutKey !== this.coachLayoutKey) {
      this.coachLayoutKey = layoutKey;
      this.tutorialCoach.layout((view.left + view.right) / 2, bottom, maxWidth);
    }
    this.tutorialCoach.show(step);
    this.tutorialCoach.setHighlight(this.tutorialTargetRect(step.highlight));
  }

  /** Öğreticinin işaret ettiği öğenin ekrandaki dikdörtgeni (arayüz birimi) */
  private tutorialTargetRect(target: TutorialTarget | null): CoachRect | null {
    const fromWorld = (x: number, y: number, width: number, height: number): CoachRect => {
      const topLeft = this.worldToUi(x, y);
      const bottomRight = this.worldToUi(x + width, y + height);
      return { x: topLeft.x, y: topLeft.y, width: bottomRight.x - topLeft.x, height: bottomRight.y - topLeft.y };
    };

    switch (target) {
      case 'produce':
      case 'belt':
      case 'build':
      case 'demolish':
      case 'hangar':
        return this.toolbar.getButtonBounds(target);
      case 'objective':
        return this.objective.bounds;
      case 'leaderboard':
        return this.hud.recordBounds;
      case 'firstMachine': {
        const machine = this.productionEngine.getAllMachines()[0];
        if (!machine) return null;
        return fromWorld(machine.coord.x * 32, machine.coord.y * 32, machine.effectiveWidth * 32, machine.effectiveHeight * 32);
      }
      case 'plotBadge': {
        const badge = this.gridView.getLockedBadgeBounds();
        return badge ? fromWorld(badge.x, badge.y, badge.width, badge.height) : null;
      }
      default:
        return null;
    }
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
      monetization: { ads: ads.serialize(), boost: this.incomeBoost.serialize() },
      tutorial: this.tutorial.serialize(),
    });
  }

  private loadGame(): void {
    const { data, wasCorrupted } = SaveManager.loadUnified();

    if (wasCorrupted) {
      this.time.delayedCall(500, () => {
        this.notify(t('notify.saveMigrated'), 'info');
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

    this.tutorial.deserialize(data.tutorial, this.hangarBridge.getFlightStats().totalFlights);

    // Gösterge sıfırdan başlamasın: kayıt anındaki ölçülmüş gelirle başlat
    this.factoryEconomy.setDiscountedPlots(data.factoryEconomy?.discountedPlots);
    ads.deserialize(data.monetization?.ads);
    this.incomeBoost.deserialize(data.monetization?.boost);
    this.factoryEconomy.incomeBoostMultiplier = this.incomeBoost.multiplier;

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
      // Çevrimdışı süre sınırı menzil basamaklarıyla uzar (4 → 8 → 12 saat)
      const offlineCapSeconds = RangeLadder.offlineCapHours(this.hangarBridge.getFlightStats().bestDistance) * 3600;
      const report = calculateOfflineReport(data.timestamp, Date.now(), savedRevenuePerSec, offlineCapSeconds);
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

  /**
   * Oyuncunun seçtiği dile geçer: seçim saklanır, ilerleme kaydedilir ve sahne yeniden
   * kurulur; böylece bütün arayüz sayfa yenilenmeden yeni dille çizilir.
   */
  private changeLanguage(code: LocaleCode): void {
    if (code === getLocale()) return;
    setLocale(code, true);
    this.saveGame();
    reopenSettingsAfterRestart = true;
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

  /* ---------------- Dokunmatikte adım adım bant döşeme ---------------- */

  private nextCellOf(step: { coord: GridCoord; direction: Direction }): GridCoord {
    const vec = DIRECTION_VECTORS[step.direction];
    return { x: step.coord.x + vec.dx, y: step.coord.y + vec.dy };
  }

  /** Bant döşendi: dokunmatikte hayaleti bandın aktığı sıradaki hücreye geçir */
  private rememberBeltStep(coord: GridCoord): void {
    const belt = this.logistics.getConveyor(coord.x, coord.y);
    if (!belt || !this.input.activePointer.wasTouch) {
      this.beltStep = null;
      return;
    }
    this.beltStep = { coord: { x: coord.x, y: coord.y }, direction: belt.direction };
    this.placementController.previewAt(this.nextCellOf(this.beltStep), belt.direction);
  }

  private syncBeltStepper(): void {
    const step = this.beltStep;
    const placement = this.placementController;
    const belt = step ? this.logistics.getConveyor(step.coord.x, step.coord.y) : undefined;
    if (!step || !belt || placement.currentItem?.type !== 'CONVEYOR' || this.rotationPreview.visible) {
      if (!belt) this.beltStep = null;
      if (this.beltStepper.visible) this.beltStepper.hide();
      return;
    }

    const next = this.nextCellOf(step);
    const bounds = this.factoryEconomy.getCurrentFactoryDimensions();
    const canAdvance =
      next.x >= 0 && next.y >= 0 && next.x < bounds.width && next.y < bounds.height &&
      this.gridMap.isCellEmpty(next.x, next.y);
    this.beltStepper.show({ last: step.coord, lastDirection: step.direction, canAdvance });
  }

  /** Yeşil ok: sıradaki hücreye o yöne bakan bant döşe ve bir adım ilerle */
  private advanceBelt(direction: Direction): void {
    if (!this.beltStep) return;
    if (!this.factoryEconomy.canAfford(CONVEYOR_BUILD_COST)) {
      this.notify(t('notify.beltCost', { amount: CONVEYOR_BUILD_COST }), 'warning');
      return;
    }
    this.placementController.placeBelt(this.nextCellOf(this.beltStep), direction);
  }

  /** Mavi ok: son döşenen bandı o yöne çevir */
  private turnLastBelt(direction: Direction): void {
    const step = this.beltStep;
    const belt = step ? this.logistics.getConveyor(step.coord.x, step.coord.y) : undefined;
    if (!step || !belt) return;
    belt.direction = direction;
    step.direction = direction;
    this.conveyorRenderer.refreshAround([step.coord]);
    this.placementController.previewAt(this.nextCellOf(step), direction);
    sound.playClick();
    this.saveGame();
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

  /** Yakınlaştırma düğmesi: bir ince adım; dünyadaki yazılar yeni oranda yeniden üretilir */
  private zoomFactory(direction: 1 | -1): void {
    this.cameraController.zoomFine(direction);
    this.syncWorldTextResolution();
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

  /**
   * Rekor bölümüne basılınca: sıralama sunulabiliyorsa lider tablosu, sunulamıyorsa
   * (davet yok, Basic derleme) kişisel rekoru ve hedefleri gösteren Seferler penceresi.
   */
  private openLeaderboard(): void {
    this.cancelActiveTool();
    if (isGlobalLeaderboardAvailable()) {
      this.leaderboardModal.open();
    } else {
      this.rangeLadderModal.open();
    }
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
      this.syncBeltStepper();
      if (this.rotationPreview.visible) {
        // R tuşuyla döndürme de önizlemeye yansır
        this.rotationPreview.sync(placement.rotation);
        this.contextBar.show({
          ...context,
          hint: t('toolbar.rotateHint'),
          showConfirm: false,
          rotating: true,
        });
      } else {
        this.contextBar.show(context);
      }
      return;
    }
    if (this.rotationPreview.visible) this.rotationPreview.hide();
    this.beltStep = null;
    if (this.beltStepper.visible) this.beltStepper.hide();

    if (demolish.isActive) {
      this.toolbar.setActiveTool('demolish');
      const target = demolish.targetName;
      this.contextBar.show({
        icon: uiIcon('trash'),
        iconTint: SEMANTIC.remove,
        title: target ? t('context.removeTitle', { name: target }) : t('context.removeMode'),
        hint: !isTouch
          ? t('context.removeHintMouse')
          : target
            ? t('context.removeHintConfirm')
            : t('context.removeHintTouch'),
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
      ? t('context.hint.click')
      : placement.canConfirm
        ? t('context.hint.confirm')
        : t('context.hint.touch');
    const arrowOutHint = isTouch ? t('context.hint.arrowOut', { hint: stepHint }) : t('context.hint.arrowOutMouse');

    const base = {
      tone: 'build' as const,
      showConfirm: needsConfirm,
      confirmEnabled: placement.canConfirm,
    };

    switch (item.type) {
      case 'INTAKE_MOVE':
        return { ...base, icon: uiIcon('intake'), title: t('context.movingIntake'), hint: arrowOutHint, canRotate: true };
      case 'EXPORT_MOVE':
        return { ...base, icon: uiIcon('crate'), title: t('context.movingCrate'), hint: stepHint, canRotate: false };
      case 'INTAKE_NEW': {
        const itemName = defaultItemRegistry.get(item.intakeItemId ?? '')?.name ?? t('common.rawMaterial');
        const cost = PlacementMath.getItemCost('INTAKE_NEW', undefined, item.intakeItemId, this.gridMap);
        return {
          ...base,
          icon: uiIcon('intake'),
          title: t('context.priced', { name: t('logistics.intakeOf', { item: itemName }), cost: formatNumber(cost) }),
          hint: arrowOutHint,
          canRotate: true,
        };
      }
      case 'MACHINE_MOVE':
        return {
          ...base,
          icon: item.machineDef?.spriteBaseKey ?? 'icon_factory',
          title: t('context.moving', { name: item.machineDef?.name ?? t('common.machine') }),
          hint: isTouch ? t('context.hint.free', { hint: stepHint }) : t('context.hint.freeMouse'),
          canRotate: true,
        };
      case 'MACHINE': {
        const def = item.machineDef;
        return {
          ...base,
          icon: def?.spriteBaseKey ?? 'icon_factory',
          title: t('context.priced', { name: def?.name ?? t('common.machine'), cost: formatNumber(def?.baseCost ?? 0) }),
          hint: isTouch ? t('context.hint.arrows', { hint: stepHint }) : t('context.hint.arrowsMouse'),
          canRotate: true,
        };
      }
      case 'SPLITTER':
        return {
          ...base,
          icon: uiIcon('splitter'),
          title: t('context.priced', { name: t('logistics.splitter'), cost: SPLITTER_BUILD_COST }),
          hint: isTouch ? stepHint : t('context.hint.rotateMouse'),
          canRotate: true,
        };
      case 'MERGER':
        return {
          ...base,
          icon: uiIcon('merger'),
          title: t('context.priced', { name: t('logistics.merger'), cost: MERGER_BUILD_COST }),
          hint: isTouch ? stepHint : t('context.hint.rotateMouse'),
          canRotate: true,
        };
      case 'CONVEYOR':
      default:
        return {
          ...base,
          icon: uiIcon('belt'),
          title: t('context.priced', { name: t('logistics.conveyor'), cost: CONVEYOR_BUILD_COST }),
          hint: isTouch ? t('context.hint.beltTouch') : t('context.hint.beltMouse'),
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

    // Sığmıyorsa HUD'ın altında şerit; sağ kenardaki dikey araç çubuğunun üstüne taşmaz
    const stripWidth = fullWidth - (this.toolbar.isVertical ? this.toolbar.occupied.width : 0);
    this.objective.layout(fullLeft, hudBottom + SPACE.xs, stripWidth, 'strip');
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
    // Geniş yatay ekranda araç çubuğu ortada duran dar bir tabladır; dünya onun arkasında
    // ekranın altına kadar uzanır (tablanın iki yanında boş şerit kalmasın).
    const dockFloats = !this.toolbar.isVertical && m.mode === 'landscape';
    const dockHeight = dockFloats ? m.height - dock.y : 0;
    const viewBottom = this.toolbar.isVertical || dockFloats ? m.height : dock.y;
    const viewWidth = viewRight - viewLeft;
    const viewHeight = viewBottom - contentTop;

    /* Etkin araç çubuğu fabrikanın alt kenarında, araç çubuğunun hemen üstünde yüzer */
    const barBottom = viewBottom - dockHeight - SPACE.sm - (this.toolbar.isVertical ? m.safe.bottom : 0);
    this.contextBar.layout(
      viewLeft + viewWidth / 2,
      barBottom,
      viewWidth - m.safe.left - SPACE.md * 2,
    );
    this.rotationPreview.layout(contentTop, barBottom - ToolContextBar.height - SPACE.sm);
    this.factoryView = { left: viewLeft + m.safe.left, right: viewRight, bottom: barBottom };
    // Yakınlaştırma düğmeleri fabrika görüş alanının sağ üst köşesinde durur
    this.zoomControls.layout(
      viewRight - ZoomControls.width - SPACE.sm - (this.toolbar.isVertical ? 0 : m.safe.right),
      contentTop + SPACE.sm,
    );

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
    // Öğretici sürerken kutusunun kaplayacağı şerit de sığdırmada boş bırakılır
    const tutorialInset = this.tutorial.isDone ? 0 : TUTORIAL_FIT_INSET;
    const viewportKey = `${m.renderScale}|${viewport.map((v) => Math.round(v)).join(',')}|${tutorialInset}`;
    if (viewportKey === this.lastViewportKey) return;
    this.lastViewportKey = viewportKey;

    this.cameraController.setPixelScale(m.renderScale);
    this.cameraController.setViewport(...viewport);
    // Etkin araç çubuğunun yüzdüğü şerit sığdırmada boş bırakılır: çubuk fabrikayı örtmez
    this.cameraController.setFitInsetBottom((ToolContextBar.height + SPACE.md + tutorialInset + dockHeight) * zoom);
    this.cameraController.fitToFactory();
    this.syncWorldTextResolution();
  }
}
