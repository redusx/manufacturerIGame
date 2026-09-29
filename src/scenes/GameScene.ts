/* ======================================================================
 * GameScene.ts — Ana oyun sahnesi
 *
 * Sorumluluklar:
 * - Phaser sahne yaşam döngüsü (create, update)
 * - EconomyManager (Decimal) + SaveManager entegrasyonu
 * - Merkezde çalışan animasyonlu FactoryView (hammadde → makine → bant → sevkiyat)
 * - HUD (kaynak & hız), MilestoneBar (sıradaki hedef), MachineCard'lar
 * - Sevkiyattan HUD'a arklanan kazanç parçacıkları
 * - Masaüstü ve dar mobil ekranlar için dinamik duyarlı yerleşim
 * ====================================================================== */

import Phaser from 'phaser';
import { EconomyManager } from '../economy/EconomyManager';
import { SaveManager } from '../save/SaveManager';
import { MACHINES, AUTO_SAVE_INTERVAL_MS, RESOURCE_NAME } from '../data/MachineData';
import { formatNumber, formatDuration } from '../utils/format';

import { HUD } from '../ui/HUD';
import { MilestoneBar } from '../ui/MilestoneBar';
import { MachineCard } from '../ui/MachineCard';
import { SettingsPanel } from '../ui/SettingsPanel';
import { FactoryView } from '../factory/FactoryView';

export class GameScene extends Phaser.Scene {
  private economy!: EconomyManager;

  /* UI bileşenleri */
  private hud!: HUD;
  private milestoneBar!: MilestoneBar;
  private machineCards: MachineCard[] = [];
  private settingsPanel!: SettingsPanel;

  /* Fabrika Görsel Katmanı */
  private factoryView!: FactoryView;

  /* Arka plan & Paneller */
  private bgGraphics!: Phaser.GameObjects.Graphics;
  private panelBgGraphics!: Phaser.GameObjects.Graphics;

  /* Tıklama düğmesi */
  private clickBtnContainer!: Phaser.GameObjects.Container;
  private clickBtnGraphics!: Phaser.GameObjects.Graphics;
  private clickBtnText!: Phaser.GameObjects.Text;
  private clickInfoText!: Phaser.GameObjects.Text;
  private clickZone!: Phaser.GameObjects.Zone;

  /* Bildirim */
  private notificationText!: Phaser.GameObjects.Text;
  private notificationBg!: Phaser.GameObjects.Graphics;
  private notificationTween: Phaser.Tweens.Tween | null = null;

  /* Zamanlayıcılar */
  private autoSaveTimer = 0;
  private lastUnlockState: boolean[] = [];

  /* Scrollable machine panel */
  private machineContainer!: Phaser.GameObjects.Container;
  private maskGraphics: Phaser.GameObjects.Graphics | null = null;
  private scrollY = 0;
  private maxScrollY = 0;
  private isDragging = false;
  private dragStartY = 0;
  private dragStartScrollY = 0;

  /* Düğme boyutları */
  private clickBtnW = 180;
  private clickBtnH = 46;

  constructor() {
    super({ key: 'GameScene' });
  }

  /* ================================================================
   * CREATE
   * ================================================================ */

  create(): void {
    this.economy = new EconomyManager();

    /* Kayıt yükle */
    this.loadGame();

    /* Arka plan grafikleri */
    this.bgGraphics = this.add.graphics().setDepth(0);
    this.panelBgGraphics = this.add.graphics().setDepth(40);

    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: 'Arial, Helvetica, sans-serif',
    };

    /* Merkezde Fabrika Görünümü */
    this.factoryView = new FactoryView(
      this,
      this.economy,
      () => this.onClickProduce(),
      (amount, fromX, fromY) => this.onProductDeliveredToShipping(amount, fromX, fromY),
    );

    /* Tıklama / Üretim Düğmesi */
    this.clickBtnContainer = this.add.container(0, 0).setDepth(45);

    this.clickBtnGraphics = this.add.graphics();
    this.clickBtnContainer.add(this.clickBtnGraphics);

    this.clickBtnText = this.add.text(0, 0, '⚙  MANUEL ÜRET', {
      ...font, fontSize: '16px', color: '#0f0e17', fontStyle: 'bold',
    }).setOrigin(0.5);
    this.clickBtnContainer.add(this.clickBtnText);

    this.clickInfoText = this.add.text(0, 0, '', {
      ...font, fontSize: '11px', color: '#8888a0',
    }).setOrigin(0.5);
    this.clickBtnContainer.add(this.clickInfoText);

    this.clickZone = this.add.zone(0, 0, this.clickBtnW, this.clickBtnH)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.onClickProduce())
      .on('pointerover', () => this.drawClickButton(0xffd166))
      .on('pointerout', () => this.drawClickButton(0xf4a261));
    this.clickBtnContainer.add(this.clickZone);

    /* Bildirim alanı */
    this.notificationBg = this.add.graphics().setDepth(150).setAlpha(0);
    this.notificationText = this.add.text(0, 0, '', {
      ...font, fontSize: '14px', color: '#ffffff', fontStyle: 'bold',
      align: 'center', wordWrap: { width: 340 },
    }).setOrigin(0.5).setDepth(151).setAlpha(0);

    /* Makine kartları konteyneri */
    this.machineContainer = this.add.container(0, 0).setDepth(50);

    /* Makine kartlarını oluştur */
    for (let i = 0; i < MACHINES.length; i++) {
      const idx = i;
      const card = new MachineCard(this, () => this.onBuyOrUpgrade(idx));
      this.machineCards.push(card);
      this.machineContainer.add(card.getContainer());
    }

    /* HUD */
    this.hud = new HUD(this, () => this.settingsPanel.show());

    /* Kilometre Taşı / Hedef Çubuğu */
    this.milestoneBar = new MilestoneBar(this);

    /* Ayarlar paneli */
    this.settingsPanel = new SettingsPanel(this, () => this.resetGame());

    /* Kilit açılma durumları */
    this.lastUnlockState = MACHINES.map((_, i) => this.economy.isUnlocked(i));

    /* Scroll dinleyicileri */
    this.setupScroll();

    /* İlk yerleşim */
    this.layoutAll();
    this.scale.on('resize', () => this.layoutAll());

    /* Ekonomi olayları */
    this.economy.on((evt) => {
      if (evt.type === 'purchase') {
        const idx = MACHINES.findIndex(m => m.id === evt.machineId);
        if (idx >= 0) {
          this.machineCards[idx].playPurchaseEffect();
          this.factoryView.playMachineUpgradeEffect(idx);
          this.showNotification(`🏭 ${MACHINES[idx].name} kuruldu! Otomatik üretim başladı.`);
        }
      } else if (evt.type === 'upgrade') {
        const idx = MACHINES.findIndex(m => m.id === evt.machineId);
        if (idx >= 0) {
          this.machineCards[idx].playPurchaseEffect();
          this.factoryView.playMachineUpgradeEffect(idx);
        }
      } else if (evt.type === 'goal_reached') {
        this.milestoneBar.playGoalReachedEffect();
        this.showNotification(`⭐ HEDEF TAMAMLANDI! Fabrika gücü arttı.`);
      }
    });

    /* İlk UI güncellemesi */
    this.refreshUI();
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

    // Altın sarısı parlak dişli/jeton parçacığı
    const coin = this.add.circle(fromX, fromY, 5, 0xf4a261, 1).setDepth(110);
    coin.setStrokeStyle(1.5, 0xffd166, 1);

    // Kavisli yay ile yukarı HUD'a uçuş
    const midX = (fromX + target.x) / 2 + Phaser.Math.Between(-40, 20);
    const midY = Math.min(fromY, target.y) - Phaser.Math.Between(20, 60);

    let progress = 0;
    this.tweens.add({
      targets: { val: 0 },
      val: 1,
      duration: 400,
      ease: 'Quad.easeIn',
      onUpdate: (tween) => {
        progress = tween.getValue();
        // İkinci dereceden Bezier eğrisi
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
      // Fabrika yerleşimini güncelle (makine seviyesi değiştiğinde görsel bay yenilenir)
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
        this.machineCards[i].playUnlockEffect();
        this.showNotification(`🔓 YENİ MAKİNE: ${MACHINES[i].name} kilidi açıldı!`);
        this.layoutAll();
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
    );

    /* Kilometre Taşı Çubuğu */
    this.milestoneBar.updateGoal(this.economy.getNextGoal());

    /* Manuel üretim bilgisi */
    const globalMul = this.economy.getGlobalMultiplier();
    const effectiveClick = this.economy.clickPower.mul(globalMul);
    this.clickInfoText.setText(
      `+${formatNumber(effectiveClick)} ${RESOURCE_NAME} / tık`,
    );

    /* Makine kartları */
    const currentRes = this.economy.resources;
    for (let i = 0; i < MACHINES.length; i++) {
      const state = this.economy.getMachineState(i);
      this.machineCards[i].update({
        definition: MACHINES[i],
        level: state.level,
        cost: this.economy.getCost(i),
        productionPerSec: this.economy.getProduction(i),
        currentResources: currentRes,
        canAfford: this.economy.canAfford(i),
        unlocked: this.economy.isUnlocked(i),
        milestoneMul: this.economy.getMachineMilestoneMultiplier(i),
        nextMilestone: this.economy.getNextMachineMilestone(i),
      });
    }
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
        this.showNotification('⚠ Eski kayıt formatı yenilendi.');
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
              `⏱ ${formatDuration(elapsedSec)} uzaktaydın!\n+${formatNumber(gained)} ${RESOURCE_NAME} kazandın.`,
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

    this.notificationBg.clear();
    this.notificationBg.fillStyle(0x1a233a, 0.95);
    this.notificationBg.fillRoundedRect(w / 2 - textW / 2, notifY - textH / 2, textW, textH, 8);
    this.notificationBg.lineStyle(1.5, 0x2ecc71, 0.9);
    this.notificationBg.strokeRoundedRect(w / 2 - textW / 2, notifY - textH / 2, textW, textH, 8);

    this.notificationText.setPosition(w / 2, notifY);

    this.notificationBg.setAlpha(1);
    this.notificationText.setAlpha(1);

    this.notificationTween = this.tweens.add({
      targets: [this.notificationBg, this.notificationText],
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
    const sf = Phaser.Math.Clamp(Math.min(w, h) / 480, 0.55, 1.4);

    /* Ana Arka Plan */
    this.bgGraphics.clear();
    this.bgGraphics.fillStyle(0x0a0c16, 1);
    this.bgGraphics.fillRect(0, 0, w, h);

    /* HUD */
    this.hud.layout(w, h, sf);
    const hudH = Math.round(48 * sf);

    /* Masaüstü Geniş Ekran (w > h * 1.05) vs Mobil Dar Ekran */
    const isWide = w > h * 1.05;

    if (isWide) {
      this.layoutWide(w, h, sf, hudH);
    } else {
      this.layoutNarrow(w, h, sf, hudH);
    }

    /* Ayarlar paneli */
    this.settingsPanel.layout(w, h);
  }

  /** Masaüstü: Sol geniş fabrika alanı + Sağ makine paneli */
  private layoutWide(w: number, h: number, sf: number, hudH: number): void {
    const panelBg = this.panelBgGraphics;
    panelBg.clear();

    const leftW = Math.round(w * 0.60);
    const rightW = w - leftW;
    const contentTop = hudH + 4;
    const contentH = h - contentTop;

    // Hedef çubuğu (Fabrikanın hemen üstünde)
    const milestoneH = Math.round(22 * sf);
    this.milestoneBar.layout(12, contentTop + 4, leftW - 24, sf);

    // Fabrika Alanı
    const factoryTop = contentTop + milestoneH + 10;
    const clickBarH = Math.round(55 * sf);
    const factoryH = contentH - milestoneH - clickBarH - 24;

    this.factoryView.layout(12, factoryTop, leftW - 24, factoryH, sf);

    // Manuel Üretim Düğmesi (Fabrikanın altında, sol ortada)
    this.clickBtnW = Math.round(200 * sf);
    this.clickBtnH = Math.round(42 * sf);
    const btnCx = leftW / 2;
    const btnCy = factoryTop + factoryH + clickBarH / 2 + 2;

    this.clickBtnContainer.setPosition(btnCx, btnCy);
    this.drawClickButton(0xf4a261);
    this.clickBtnText.setFontSize(`${Math.round(15 * sf)}px`);
    this.clickZone.setSize(this.clickBtnW, this.clickBtnH);
    this.clickInfoText.setPosition(0, this.clickBtnH / 2 + 10 * sf);
    this.clickInfoText.setFontSize(`${Math.round(10 * sf)}px`);

    // Sağ Makine Paneli Arka Planı
    panelBg.fillStyle(0x0e111d, 0.95);
    panelBg.fillRect(leftW, hudH, rightW, h - hudH);
    panelBg.lineStyle(1, 0x2e3856, 0.8);
    panelBg.lineBetween(leftW, hudH, leftW, h);

    // Makine Kartları
    this.layoutMachineCards(leftW + 12, contentTop + 8, rightW - 24, contentH - 16, sf);
  }

  /** Mobil / Dar Ekran: Üstte Fabrika + Altta Makine Kartları */
  private layoutNarrow(w: number, h: number, sf: number, hudH: number): void {
    const panelBg = this.panelBgGraphics;
    panelBg.clear();

    const contentTop = hudH + 4;

    // Hedef çubuğu
    const milestoneH = Math.round(20 * sf);
    this.milestoneBar.layout(8, contentTop + 2, w - 16, sf);

    // Fabrika Alanı (Ekranın üst ~38%'si)
    const factoryTop = contentTop + milestoneH + 6;
    const factoryH = Math.round(h * 0.36);
    this.factoryView.layout(6, factoryTop, w - 12, factoryH, sf * 0.85);

    // Manuel Üretim Düğmesi (Fabrikanın hemen altında)
    this.clickBtnW = Math.round(170 * sf);
    this.clickBtnH = Math.round(36 * sf);
    const btnCy = factoryTop + factoryH + this.clickBtnH / 2 + 8 * sf;

    this.clickBtnContainer.setPosition(w / 2, btnCy);
    this.drawClickButton(0xf4a261);
    this.clickBtnText.setFontSize(`${Math.round(13 * sf)}px`);
    this.clickZone.setSize(this.clickBtnW, this.clickBtnH);
    this.clickInfoText.setPosition(0, this.clickBtnH / 2 + 8 * sf);
    this.clickInfoText.setFontSize(`${Math.round(9.5 * sf)}px`);

    // Alt Makine Listesi Rafı
    const machineTop = btnCy + this.clickBtnH / 2 + 20 * sf;
    const machineH = h - machineTop - 6;

    panelBg.fillStyle(0x0c0f1b, 0.95);
    panelBg.fillRect(0, machineTop - 8, w, h - machineTop + 8);
    panelBg.lineStyle(1, 0x2e3856, 0.8);
    panelBg.lineBetween(0, machineTop - 8, w, machineTop - 8);

    this.layoutMachineCards(8, machineTop, w - 16, machineH, sf);
  }

  private layoutMachineCards(
    panelX: number, panelY: number,
    panelW: number, panelH: number,
    sf: number,
  ): void {
    this.machineContainer.setPosition(panelX, panelY);

    const cardH = Math.round(74 * sf);
    const gap = Math.round(7 * sf);
    let yOffset = 0;

    for (let i = 0; i < this.machineCards.length; i++) {
      this.machineCards[i].layout(0, yOffset - this.scrollY, panelW, cardH, sf);
      yOffset += cardH + gap;
    }

    this.maxScrollY = Math.max(0, yOffset - panelH);
    this.scrollY = Phaser.Math.Clamp(this.scrollY, 0, this.maxScrollY);

    // Maske
    if (this.maskGraphics) {
      this.maskGraphics.destroy();
    }
    this.maskGraphics = this.make.graphics({ x: 0, y: 0 });
    this.maskGraphics.fillStyle(0xffffff);
    this.maskGraphics.fillRect(panelX, panelY, panelW, panelH);
    this.machineContainer.setMask(
      new Phaser.Display.Masks.GeometryMask(this, this.maskGraphics),
    );
  }

  /* ================================================================
   * SCROLL
   * ================================================================ */

  private setupScroll(): void {
    this.input.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.settingsPanel.visible) return;
      const bounds = this.getMachinePanelBounds();
      if (pointer.x >= bounds.x && pointer.x <= bounds.x + bounds.w &&
          pointer.y >= bounds.y && pointer.y <= bounds.y + bounds.h) {
        this.isDragging = true;
        this.dragStartY = pointer.y;
        this.dragStartScrollY = this.scrollY;
      }
    });

    this.input.on('pointermove', (pointer: Phaser.Input.Pointer) => {
      if (!this.isDragging) return;
      const dy = this.dragStartY - pointer.y;
      this.scrollY = Phaser.Math.Clamp(
        this.dragStartScrollY + dy, 0, this.maxScrollY,
      );
      this.layoutAll();
    });

    this.input.on('pointerup', () => {
      this.isDragging = false;
    });

    this.input.on('wheel', (
      _pointer: Phaser.Input.Pointer,
      _gameObjects: Phaser.GameObjects.GameObject[],
      _deltaX: number,
      deltaY: number,
    ) => {
      if (this.settingsPanel.visible) return;
      this.scrollY = Phaser.Math.Clamp(this.scrollY + deltaY * 0.5, 0, this.maxScrollY);
      this.layoutAll();
    });
  }

  private getMachinePanelBounds(): { x: number; y: number; w: number; h: number } {
    const w = this.scale.width;
    const h = this.scale.height;
    const sf = Phaser.Math.Clamp(Math.min(w, h) / 480, 0.55, 1.4);
    const hudH = Math.round(48 * sf);
    const isWide = w > h * 1.05;

    if (isWide) {
      const leftW = Math.round(w * 0.60);
      return { x: leftW, y: hudH, w: w - leftW, h: h - hudH };
    } else {
      const factoryH = Math.round(h * 0.36);
      const clickBtnH = Math.round(36 * sf);
      const milestoneH = Math.round(20 * sf);
      const machineTop = hudH + 4 + milestoneH + 6 + factoryH + clickBtnH + 20 * sf;
      return { x: 0, y: machineTop, w, h: h - machineTop };
    }
  }

  /* ================================================================
   * DÜĞME ÇİZİMİ
   * ================================================================ */

  private drawClickButton(color: number): void {
    const g = this.clickBtnGraphics;
    g.clear();

    // Düğme gölgesi
    g.fillStyle(0x000000, 0.35);
    g.fillRoundedRect(-this.clickBtnW / 2 + 2, -this.clickBtnH / 2 + 3, this.clickBtnW, this.clickBtnH, 8);

    // Gövde
    g.fillStyle(color, 1);
    g.fillRoundedRect(-this.clickBtnW / 2, -this.clickBtnH / 2, this.clickBtnW, this.clickBtnH, 8);

    // Üst vurgu çizgisi
    g.fillStyle(0xffffff, 0.3);
    g.fillRoundedRect(-this.clickBtnW / 2 + 3, -this.clickBtnH / 2 + 2, this.clickBtnW - 6, 4, 2);
  }
}
