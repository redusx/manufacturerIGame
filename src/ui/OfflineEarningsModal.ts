/* ======================================================================
 * src/ui/OfflineEarningsModal.ts — Çevrimdışı İlerleme ve Hoş Geldin Modalı
 *
 * Oyuncu oyuna tekrar girdiğinde yokluğunda üretilen kaynakları,
 * geçen süreyi ve verimlilik oranını şık piksel-art arayüzle sunan modal.
 * (docs/MASTER_PLAN.md TASK-121)
 *
 * Sorumluluklar:
 * - Raster 9-Slice piksel çerçeveler ve butonlar
 * - Süre, verim ve kazanılan kaynak gösterimi
 * - Normal "Topla" ve 2X "İkiye Katla" (Rewarded video / boost) butonları
 * - Responsive ekran ortalaması ve pürüzsüz animasyonlar
 * ====================================================================== */

import Phaser from 'phaser';
import type Decimal from 'break_eternity.js';
import { PALETTE, FONT_FAMILY, FONT_SIZES, PixelUIHelper } from './theme.ts';
import type { OfflineEarningsReport } from './OfflineEarningsHelper.ts';

export interface OfflineEarningsModalConfig {
  onClaim: (gained: Decimal) => void;
  onDoubleClaim?: (gained: Decimal) => void;
}

export class OfflineEarningsModal {
  private scene: Phaser.Scene;
  private config: OfflineEarningsModalConfig;

  public rootContainer!: Phaser.GameObjects.Container;
  private overlay!: Phaser.GameObjects.Rectangle;
  private panelContainer!: Phaser.GameObjects.Container;

  private modalBg!: Phaser.GameObjects.NineSlice;
  private titleText!: Phaser.GameObjects.Text;
  private subtitleText!: Phaser.GameObjects.Text;
  private closeIcon!: Phaser.GameObjects.Image;
  private closeZone!: Phaser.GameObjects.Zone;

  // Bilgi Kartı
  private statsBoxBg!: Phaser.GameObjects.NineSlice;
  private durationLabel!: Phaser.GameObjects.Text;
  private durationValue!: Phaser.GameObjects.Text;
  private capWarningText!: Phaser.GameObjects.Text;
  private efficiencyLabel!: Phaser.GameObjects.Text;
  private efficiencyValue!: Phaser.GameObjects.Text;
  private earningsBoxBg!: Phaser.GameObjects.NineSlice;
  private earningsHeader!: Phaser.GameObjects.Text;
  private earningsValue!: Phaser.GameObjects.Text;

  // Butonlar
  private claimBtnBg!: Phaser.GameObjects.NineSlice;
  private claimBtnText!: Phaser.GameObjects.Text;
  private claimBtnZone!: Phaser.GameObjects.Zone;

  private doubleBtnBg!: Phaser.GameObjects.NineSlice;
  private doubleBtnText!: Phaser.GameObjects.Text;
  private doubleBtnZone!: Phaser.GameObjects.Zone;

  private currentReport: OfflineEarningsReport | null = null;
  private _isOpen = false;

  constructor(scene: Phaser.Scene, config: OfflineEarningsModalConfig) {
    this.scene = scene;
    this.config = config;
    this.create();
  }

  public isOpen(): boolean {
    return this._isOpen;
  }

  private create(): void {
    const s = this.scene;
    const font: Phaser.Types.GameObjects.Text.TextStyle = { fontFamily: FONT_FAMILY };

    this.rootContainer = s.add.container(0, 0).setDepth(260).setVisible(false);

    // 1. Ekranı Karartan Tıklama Engelleyici Arka Plan
    this.overlay = s.add.rectangle(0, 0, 4000, 4000, PALETTE.bgDeep, 0.75)
      .setOrigin(0.5, 0.5)
      .setInteractive();
    this.rootContainer.add(this.overlay);

    // 2. Hareketli/Ölçeklenen Panel Konteyneri
    this.panelContainer = s.add.container(0, 0);
    this.rootContainer.add(this.panelContainer);

    const panelW = 380;
    const panelH = 370;

    // 3. Modal 9-Slice Çerçevesi
    this.modalBg = PixelUIHelper.createModal(s, 0, 0, panelW, panelH);
    this.panelContainer.add(this.modalBg);

    // 4. Kapat Butonu (Sağ Üst X)
    this.closeIcon = s.add.image(panelW / 2 - 24, -panelH / 2 + 24, 'icon_close')
      .setOrigin(0.5)
      .setScale(1.1);
    this.closeZone = s.add.zone(panelW / 2 - 24, -panelH / 2 + 24, 28, 28)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.claimNormal())
      .on('pointerover', () => this.closeIcon.setScale(1.25))
      .on('pointerout', () => this.closeIcon.setScale(1.1));
    this.panelContainer.add([this.closeIcon, this.closeZone]);

    // 5. Başlık ve Alt Açıklama
    this.titleText = s.add.text(0, -panelH / 2 + 30, '⚡ FABRİKA RAPORU', {
      ...font,
      fontSize: FONT_SIZES.title,
      color: PALETTE.resourceGoldHex,
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);

    this.subtitleText = s.add.text(0, -panelH / 2 + 55, 'Makinelerin yokluğunda üretim yaptı.', {
      ...font,
      fontSize: FONT_SIZES.micro,
      color: PALETTE.textMuted,
      align: 'center',
      wordWrap: { width: 330 },
    }).setOrigin(0.5);
    this.panelContainer.add([this.titleText, this.subtitleText]);

    // 6. Bilgi Paneli (Stats Box)
    const statsBoxY = -35;
    this.statsBoxBg = PixelUIHelper.createPanel(s, -165, statsBoxY - 55, 330, 95);
    this.panelContainer.add(this.statsBoxBg);

    // Uzakta Kalınan Süre
    this.durationLabel = s.add.text(-150, statsBoxY - 40, '⏱️ Uzakta Kalınan Süre:', {
      ...font,
      fontSize: FONT_SIZES.micro,
      color: PALETTE.textMuted,
    }).setOrigin(0, 0.5);

    this.durationValue = s.add.text(150, statsBoxY - 40, '0 saniye', {
      ...font,
      fontSize: FONT_SIZES.micro,
      color: PALETTE.textPrimary,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    this.capWarningText = s.add.text(0, statsBoxY - 22, '⚠️ Maksimum 4 saatlik tavan uygulandı', {
      ...font,
      fontSize: '8px',
      color: PALETTE.warningOrangeHex,
    }).setOrigin(0.5).setVisible(false);

    // Çevrimdışı Verimlilik
    this.efficiencyLabel = s.add.text(-150, statsBoxY, '⚙️ Çevrimdışı Verimlilik:', {
      ...font,
      fontSize: FONT_SIZES.micro,
      color: PALETTE.textMuted,
    }).setOrigin(0, 0.5);

    this.efficiencyValue = s.add.text(150, statsBoxY, '%50', {
      ...font,
      fontSize: FONT_SIZES.micro,
      color: PALETTE.rocketCyanHex,
      fontStyle: 'bold',
    }).setOrigin(1, 0.5);

    this.panelContainer.add([
      this.durationLabel,
      this.durationValue,
      this.capWarningText,
      this.efficiencyLabel,
      this.efficiencyValue,
    ]);

    // 7. Biriken Kazanç Göstergesi (Altın Vurgu Kutusu)
    const earnBoxY = 45;
    this.earningsBoxBg = PixelUIHelper.createPanel(s, -165, earnBoxY - 25, 330, 56);
    this.panelContainer.add(this.earningsBoxBg);

    this.earningsHeader = s.add.text(0, earnBoxY - 12, 'BİRİKEN KAYNAK', {
      ...font,
      fontSize: '9px',
      color: PALETTE.textMuted,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.earningsValue = s.add.text(0, earnBoxY + 12, '+0', {
      ...font,
      fontSize: '18px',
      color: PALETTE.resourceGoldHex,
      fontStyle: 'bold',
    }).setOrigin(0.5);
    this.panelContainer.add([this.earningsHeader, this.earningsValue]);

    // 8. Buton 1: Normal Topla (Yeşil)
    const btn1Y = 108;
    this.claimBtnBg = PixelUIHelper.createButton(s, 0, btn1Y, 320, 36, 'green');
    this.claimBtnText = s.add.text(0, btn1Y, 'TOPLA', {
      ...font,
      fontSize: FONT_SIZES.stat,
      color: PALETTE.btnAffordableText,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.claimBtnZone = s.add.zone(0, btn1Y, 320, 36)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.claimNormal())
      .on('pointerover', () => this.claimBtnBg.setScale(1.02))
      .on('pointerout', () => this.claimBtnBg.setScale(1.0));

    this.panelContainer.add([this.claimBtnBg, this.claimBtnText, this.claimBtnZone]);

    // 9. Buton 2: 2X İkiye Katla (Cyan / Roket Lansman Stili)
    const btn2Y = 150;
    this.doubleBtnBg = PixelUIHelper.createButton(s, 0, btn2Y, 320, 36, 'launch');
    this.doubleBtnText = s.add.text(0, btn2Y, '🎁 2X İKİYE KATLA', {
      ...font,
      fontSize: FONT_SIZES.stat,
      color: PALETTE.textDark,
      fontStyle: 'bold',
    }).setOrigin(0.5);

    this.doubleBtnZone = s.add.zone(0, btn2Y, 320, 36)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.claimDouble())
      .on('pointerover', () => this.doubleBtnBg.setScale(1.02))
      .on('pointerout', () => this.doubleBtnBg.setScale(1.0));

    this.panelContainer.add([this.doubleBtnBg, this.doubleBtnText, this.doubleBtnZone]);
  }

  /**
   * Modalı verilen çevrimdışı raporuyla açar ve ekrana animasyonla getirir.
   */
  public show(report: OfflineEarningsReport): void {
    if (!report.isEligible) return;

    this.currentReport = report;
    this._isOpen = true;

    // Metinleri Güncelle
    this.titleText.setText(`⚡ ${report.welcomeTitle}`);
    this.subtitleText.setText(report.welcomeMessage);
    this.durationValue.setText(report.formattedDuration);
    this.efficiencyValue.setText(`%${report.efficiencyPercent}`);
    this.earningsValue.setText(`+${report.formattedBaseEarnings}`);
    this.claimBtnText.setText(`TOPLA (+${report.formattedBaseEarnings})`);
    this.doubleBtnText.setText(`🎁 2X İKİYE KATLA (+${report.formattedDoubledEarnings})`);

    // 4 Saatlik Tavan Uyarısı
    this.capWarningText.setVisible(report.wasCapped);

    // Konumlandır ve Göster
    const { width, height } = this.scene.scale;
    this.layout(width, height);

    this.rootContainer.setVisible(true);
    this.panelContainer.setScale(0.85);
    this.panelContainer.setAlpha(0);

    this.scene.tweens.add({
      targets: this.panelContainer,
      scale: 1,
      alpha: 1,
      duration: 200,
      ease: 'Back.easeOut',
    });
  }

  /**
   * Normal ödülü toplar ve modalı kapatır.
   */
  private claimNormal(): void {
    if (!this._isOpen || !this.currentReport) return;
    const gained = this.currentReport.baseEarnings;
    this.hide(() => {
      this.config.onClaim(gained);
    });
  }

  /**
   * 2X çift ödülü toplar (Rewarded ad / boost) ve modalı kapatır.
   */
  private claimDouble(): void {
    if (!this._isOpen || !this.currentReport) return;
    const gained = this.currentReport.doubledEarnings;
    this.hide(() => {
      if (this.config.onDoubleClaim) {
        this.config.onDoubleClaim(gained);
      } else {
        this.config.onClaim(gained);
      }
    });
  }

  /**
   * Modalı pürüzsüz animasyonla kapatır.
   */
  public hide(onComplete?: () => void): void {
    if (!this._isOpen) {
      if (onComplete) onComplete();
      return;
    }

    this._isOpen = false;
    this.scene.tweens.add({
      targets: this.panelContainer,
      scale: 0.85,
      alpha: 0,
      duration: 150,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        this.rootContainer.setVisible(false);
        this.currentReport = null;
        if (onComplete) onComplete();
      },
    });
  }

  /**
   * Pencere boyut değişiminde modalı ekranın tam merkezine hizalar.
   */
  public layout(width: number, height: number): void {
    const cx = Math.round(width / 2);
    const cy = Math.round(height / 2);

    this.overlay.setPosition(cx, cy);
    this.panelContainer.setPosition(cx, cy);
  }

  /**
   * Modalı ve tüm oyun nesnelerini temizler.
   */
  public destroy(): void {
    this.rootContainer.destroy();
  }
}
