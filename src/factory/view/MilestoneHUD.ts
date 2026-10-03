/* ======================================================================
 * src/factory/view/MilestoneHUD.ts — Fabrika Kilometre Taşları HUD Barı
 *
 * Ekranın üst kısmında aktif hedefi, anlık ilerleme çubuğunu, çağ rozetini
 * ve kazanılacak ödülü gösteren, hedef tamamlandığında nabız animasyonuyla
 * 'ÖDÜLÜ AL!' butonu sunan Phaser 3 2D kullanıcı arayüzü bileşeni.
 *
 * docs/PROGRESSION.md, docs/ART_DIRECTION.md ve src/ui/theme.ts standartlarına uygundur.
 * ====================================================================== */

import Phaser from 'phaser';
import {
  MilestoneManager,
  type MilestoneDefinition,
  type MilestoneReward,
} from '../progression/MilestoneManager.ts';
import { FactoryEconomy } from '../simulation/FactoryEconomy.ts';
import { ProductionEngine } from '../simulation/ProductionEngine.ts';
import {
  MilestoneHUDHelper,
  type MilestoneHUDViewModel,
} from './MilestoneHUDHelper.ts';
import { PALETTE, FONT_FAMILY, PixelUIHelper } from '../../ui/theme.ts';

export interface MilestoneHUDConfig {
  width?: number;
  height?: number;
  topOffset?: number;
  onClaimed?: (milestone: MilestoneDefinition, reward: MilestoneReward) => void;
}

export class MilestoneHUD {
  readonly scene: Phaser.Scene;
  readonly manager: MilestoneManager;
  readonly economy: FactoryEconomy;
  readonly engine?: ProductionEngine;

  /** Olay dinleyicisi */
  onClaimed?: (milestone: MilestoneDefinition, reward: MilestoneReward) => void;

  /** Boyutlar */
  private hudWidth: number;
  private hudHeight: number;
  private topOffset: number;

  /** Görsel Bileşenler */
  private container: Phaser.GameObjects.Container;
  private bgGraphics: Phaser.GameObjects.Graphics;
  private barGraphics: Phaser.GameObjects.Graphics;
  private btnGraphics: Phaser.GameObjects.Graphics;

  private badgeText: Phaser.GameObjects.Text;
  private titleText: Phaser.GameObjects.Text;
  private conditionText: Phaser.GameObjects.Text;
  private rewardText: Phaser.GameObjects.Text;

  private claimButtonText: Phaser.GameObjects.Text;
  private claimButtonHitArea: Phaser.GameObjects.Rectangle;

  /** Dahili Durum */
  private currentViewModel: MilestoneHUDViewModel | null = null;
  private elapsedTimeSec = 0;
  private timeSinceLastRefresh = 0;
  private readonly REFRESH_INTERVAL_SEC = 0.1; // 100ms periyodik yenileme

  constructor(
    scene: Phaser.Scene,
    manager: MilestoneManager,
    economy: FactoryEconomy,
    engine?: ProductionEngine,
    config: MilestoneHUDConfig = {},
  ) {
    this.scene = scene;
    this.manager = manager;
    this.economy = economy;
    this.engine = engine;

    this.hudWidth = config.width ?? 620;
    this.hudHeight = config.height ?? 54;
    this.topOffset = config.topOffset ?? 8;
    this.onClaimed = config.onClaimed;

    // Ana konteyner (ScrollFactor 0 = ekrana sabit, Depth 150 = dünyanın üstü, modalın altı)
    this.container = this.scene.add
      .container(0, 0)
      .setDepth(150)
      .setScrollFactor(0);

    // Çizim nesneleri
    this.bgGraphics = this.scene.add.graphics();
    this.barGraphics = this.scene.add.graphics();
    this.btnGraphics = this.scene.add.graphics();

    // Metinler
    this.badgeText = this.scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '9px',
      color: PALETTE.factoryAmberHex,
    });

    this.titleText = this.scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '11px',
      color: PALETTE.textPrimary,
    });

    this.conditionText = this.scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '9px',
      color: PALETTE.textMuted,
    });

    this.rewardText = this.scene.add.text(0, 0, '', {
      fontFamily: FONT_FAMILY,
      fontSize: '9px',
      color: PALETTE.resourceGoldHex,
    });

    // Ödülü Al / Durum Butonu
    this.claimButtonText = this.scene.add
      .text(0, 0, '', {
        fontFamily: FONT_FAMILY,
        fontSize: '9px',
        color: PALETTE.textDark,
        align: 'center',
      })
      .setOrigin(0.5);

    this.claimButtonHitArea = this.scene.add
      .rectangle(0, 0, 96, 36, 0x000000, 0)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleClaimClick());

    // Konteynere ekle
    this.container.add([
      this.bgGraphics,
      this.barGraphics,
      this.btnGraphics,
      this.badgeText,
      this.titleText,
      this.conditionText,
      this.rewardText,
      this.claimButtonText,
      this.claimButtonHitArea,
    ]);

    // Ekran yeniden boyutlandığında HUD'ı ortala
    this.scene.scale.on('resize', this.handleResize, this);

    this.refresh();
  }

  // -------------------------------------------------------------
  // DÜZEN VE ÇİZİM
  // -------------------------------------------------------------

  /**
   * HUD'ı ekranın üst ortasına yerleştirir ve anlık verilere göre yeniden çizer.
   */
  refresh(): void {
    const vm = MilestoneHUDHelper.getViewModel(
      this.manager,
      this.economy,
      this.engine,
    );
    this.currentViewModel = vm;

    if (!vm.isActive) {
      this.container.setVisible(false);
      return;
    }

    this.container.setVisible(true);

    const screenW = this.scene.scale.width;
    const clampedW = Math.min(this.hudWidth, screenW - 24);
    const startX = Math.round((screenW - clampedW) / 2);
    const startY = this.topOffset;

    // 1. Ana Panel Zemin Çizimi
    this.bgGraphics.clear();
    PixelUIHelper.drawPanel(
      this.bgGraphics,
      startX,
      startY,
      clampedW,
      this.hudHeight,
      PALETTE.panelBg,
      0.95,
    );

    const contentPadX = 12;
    const buttonW = 96;
    const buttonH = 34;
    const buttonX = startX + clampedW - contentPadX - buttonW / 2;
    const buttonY = startY + this.hudHeight / 2;

    const textW = clampedW - contentPadX * 2 - buttonW - 12;

    // 2. Üst Satır: Aşama Rozeti + Başlık (Sol) ve Ödül (Sağ)
    this.badgeText
      .setPosition(startX + contentPadX, startY + 8)
      .setText(vm.stageBadgeText);

    this.titleText
      .setPosition(startX + contentPadX + this.badgeText.width + 8, startY + 7)
      .setText(`- ${vm.titleText}`);

    // Ödül metnini butonun hemen soluna hizala
    this.rewardText
      .setPosition(startX + contentPadX + textW - this.rewardText.width, startY + 8)
      .setText(vm.rewardText);

    // 3. Alt Satır: Hedef Açıklaması ve İlerleme Çubuğu
    this.conditionText
      .setPosition(startX + contentPadX, startY + 23)
      .setText(vm.conditionText);

    const barY = startY + 37;
    const barW = textW;
    const barH = 8;

    this.barGraphics.clear();
    const barColor = vm.isAllCompleted
      ? PALETTE.resourceGold
      : vm.canClaim
        ? PALETTE.successGreen
        : PALETTE.resourceGold;

    PixelUIHelper.drawProgressBar(
      this.barGraphics,
      startX + contentPadX,
      barY,
      barW,
      barH,
      vm.progressRatio,
      barColor,
      0x070913,
      true,
    );

    // 4. Ödülü Al Butonu
    this.claimButtonHitArea.setPosition(buttonX, buttonY).setSize(buttonW, buttonH);
    this.claimButtonText.setPosition(buttonX, buttonY);

    this.renderClaimButton(buttonX, buttonY, buttonW, buttonH, vm);
  }

  /**
   * Ödülü al butonunun görsel durumunu çizer (aktif / pasif / nabız).
   */
  private renderClaimButton(
    btnCenterX: number,
    btnCenterY: number,
    btnW: number,
    btnH: number,
    vm: MilestoneHUDViewModel,
  ): void {
    this.btnGraphics.clear();
    const btnLeft = btnCenterX - btnW / 2;
    const btnTop = btnCenterY - btnH / 2;

    if (vm.isAllCompleted) {
      // Oyun sonu tamamlama durumu
      PixelUIHelper.drawButton(
        this.btnGraphics,
        btnLeft,
        btnTop,
        btnW,
        btnH,
        PALETTE.panelBg,
        PALETTE.resourceGold,
        0xffffff,
        0.1,
      );
      this.claimButtonText.setText('TAMAM').setColor(PALETTE.resourceGoldHex);
      this.claimButtonHitArea.disableInteractive();
      return;
    }

    if (vm.canClaim) {
      // Ödül alınmaya hazır -> Canlı nabız atan yeşil/altın buton
      const pulseAlpha = MilestoneHUDHelper.computePulseAlpha(this.elapsedTimeSec);
      PixelUIHelper.drawButton(
        this.btnGraphics,
        btnLeft,
        btnTop,
        btnW,
        btnH,
        PALETTE.btnAffordable,
        PALETTE.resourceGold,
        0xffffff,
        0.4,
      );
      this.btnGraphics.alpha = pulseAlpha;

      this.claimButtonText
        .setText('ÖDÜLÜ AL!')
        .setColor(PALETTE.btnAffordableText);
      this.claimButtonHitArea.setInteractive({ useHandCursor: true });
    } else {
      // Henüz tamamlanmadı -> Yüzdeyi gösteren nötr buton
      this.btnGraphics.alpha = 1.0;
      PixelUIHelper.drawButton(
        this.btnGraphics,
        btnLeft,
        btnTop,
        btnW,
        btnH,
        PALETTE.btnDisabled,
        PALETTE.btnDisabledBorder,
        0xffffff,
        0.05,
      );

      this.claimButtonText
        .setText(vm.progressPercentText)
        .setColor(PALETTE.btnDisabledText);
      this.claimButtonHitArea.disableInteractive();
    }
  }

  // -------------------------------------------------------------
  // EYLEMLER VE ETKİLEŞİM
  // -------------------------------------------------------------

  private handleClaimClick(): void {
    if (!this.currentViewModel || !this.currentViewModel.canClaim) return;

    const res = this.manager.claimCurrentMilestone(this.economy, this.engine);
    if (res.success && res.claimedMilestone && res.reward) {
      this.playClaimCelebration(res.claimedMilestone, res.reward);
      this.refresh();

      if (this.onClaimed) {
        this.onClaimed(res.claimedMilestone, res.reward);
      }
    }
  }

  private handleResize(): void {
    this.refresh();
  }

  /**
   * Ödül alındığında altın kutlama metni ve havai fişek parçacıkları oynatır.
   */
  private playClaimCelebration(
    milestone: MilestoneDefinition,
    reward: MilestoneReward,
  ): void {
    const screenW = this.scene.scale.width;
    const centerX = screenW / 2;
    const centerY = this.topOffset + this.hudHeight + 30;

    // Zafer yüzen metni
    const banner = this.scene.add
      .text(
        centerX,
        centerY,
        `★ KİLOMETRE TAŞI TAMAMLANDI! ★\n${reward.description}`,
        {
          fontFamily: FONT_FAMILY,
          fontSize: '11px',
          color: PALETTE.resourceGoldHex,
          stroke: '#000000',
          strokeThickness: 4,
          align: 'center',
          lineSpacing: 4,
        },
      )
      .setOrigin(0.5)
      .setDepth(160)
      .setScrollFactor(0);

    this.scene.tweens.add({
      targets: banner,
      y: centerY - 25,
      alpha: 0,
      duration: 1800,
      ease: 'Quad.easeOut',
      onComplete: () => banner.destroy(),
    });
  }

  // -------------------------------------------------------------
  // ZAMAN ADIMI (UPDATE)
  // -------------------------------------------------------------

  /**
   * Sahne döngüsünde (Scene.update) çağrılır; ilerlemeyi ve nabız animasyonunu yürütür.
   */
  update(time: number, delta: number): void {
    const dt = delta / 1000;
    this.elapsedTimeSec += dt;
    this.timeSinceLastRefresh += dt;

    if (this.timeSinceLastRefresh >= this.REFRESH_INTERVAL_SEC) {
      this.timeSinceLastRefresh = 0;
      this.refresh();
    } else if (this.currentViewModel?.canClaim) {
      // Nabız animasyonunu her karede pürüzsüz güncelle
      const pulseAlpha = MilestoneHUDHelper.computePulseAlpha(this.elapsedTimeSec);
      this.btnGraphics.alpha = pulseAlpha;
    }
  }

  /**
   * HUD'ı ve tüm görsel kaynaklarını temizler.
   */
  destroy(): void {
    this.scene.scale.off('resize', this.handleResize, this);
    this.container.destroy(true);
  }
}
