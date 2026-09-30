/* ======================================================================
 * MachineModal.ts — Cihaz / Makine Seçildiğinde Açılan Piksel Detay & Geliştirme Penceresi
 *
 * Sağ paneldeki karmaşık listeyi ortadan kaldırır; fabrikada doğrudan
 * bir cihaza tıklandığında açılan şık ve sade 9-slice pop-up penceresidir.
 * ====================================================================== */

import Phaser from 'phaser';
import type { MachineDefinition, LevelMilestone } from '../data/MachineData';
import { MACHINES, RESOURCE_NAME } from '../data/MachineData';
import type { EconomyManager } from '../economy/EconomyManager';
import { formatNumber } from '../utils/format';
import { PALETTE, FONT_FAMILY, PixelUIHelper } from './theme';

export class MachineModal {
  private scene: Phaser.Scene;
  private economy: EconomyManager;
  private onUpgradeSuccess: (index: number) => void;

  private container: Phaser.GameObjects.Container;
  private backdrop: Phaser.GameObjects.Rectangle;
  private modalBg: Phaser.GameObjects.NineSlice;

  /* Başlık ve Kapat */
  private titleText: Phaser.GameObjects.Text;
  private closeBtnBg: Phaser.GameObjects.NineSlice;
  private closeBtnIcon: Phaser.GameObjects.Image;
  private closeZone: Phaser.GameObjects.Zone;

  /* Makine Görseli */
  private previewCardBg: Phaser.GameObjects.NineSlice;
  private previewBaseSprite: Phaser.GameObjects.Sprite;
  private previewPartSprite: Phaser.GameObjects.Sprite;
  private descText: Phaser.GameObjects.Text;

  /* İstatistikler */
  private levelText: Phaser.GameObjects.Text;
  private prodText: Phaser.GameObjects.Text;
  private milestoneTitleText: Phaser.GameObjects.Text;
  private milestoneBarBg: Phaser.GameObjects.NineSlice;
  private milestoneBarFill: Phaser.GameObjects.Image;

  /* Geliştirme / Satın Alma Butonu */
  private actionBtnBg: Phaser.GameObjects.NineSlice;
  private actionBtnText: Phaser.GameObjects.Text;
  private actionBtnSubtext: Phaser.GameObjects.Text;
  private actionZone: Phaser.GameObjects.Zone;

  private currentMachineIndex = -1;
  private _isOpen = false;
  private isAffordable = false;

  constructor(
    scene: Phaser.Scene,
    economy: EconomyManager,
    onUpgradeSuccess: (index: number) => void,
  ) {
    this.scene = scene;
    this.economy = economy;
    this.onUpgradeSuccess = onUpgradeSuccess;

    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    this.container = scene.add.container(0, 0).setDepth(200).setVisible(false);

    // 1. Ekran Karartma Katmanı
    this.backdrop = scene.add.rectangle(0, 0, 100, 100, 0x05070e, 0.72)
      .setOrigin(0, 0)
      .setInteractive()
      .on('pointerdown', () => this.hide());
    this.container.add(this.backdrop);

    // 2. Modal Çerçevesi (Raster 9-Slice)
    this.modalBg = PixelUIHelper.createModal(scene, 0, 0, 360, 380).setOrigin(0, 0);
    this.container.add(this.modalBg);

    // 3. Başlık
    this.titleText = scene.add.text(0, 0, '', {
      ...font,
      fontSize: '16px',
      color: PALETTE.textPrimary,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.container.add(this.titleText);

    // 4. Kapatma Butonu
    this.closeBtnBg = PixelUIHelper.createButton(scene, 0, 0, 28, 28, 'disabled');
    this.container.add(this.closeBtnBg);

    this.closeBtnIcon = scene.add.image(0, 0, 'icon_close').setOrigin(0.5).setScale(1.1);
    this.container.add(this.closeBtnIcon);

    this.closeZone = scene.add.zone(0, 0, 30, 30)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.hide())
      .on('pointerover', () => this.closeBtnBg.setTexture('btn_danger_normal'))
      .on('pointerout', () => this.closeBtnBg.setTexture('btn_disabled'));
    this.container.add(this.closeZone);

    // 5. Makine Önizleme Kartı
    this.previewCardBg = PixelUIHelper.createCard(scene, 0, 0, 90, 80);
    this.container.add(this.previewCardBg);

    this.previewBaseSprite = scene.add.sprite(0, 0, 'machine_bench').setOrigin(0.5, 0.5).setScale(1.4);
    this.container.add(this.previewBaseSprite);

    this.previewPartSprite = scene.add.sprite(0, 0, 'machine_bench_part').setOrigin(0.5, 0.5).setScale(1.4);
    this.container.add(this.previewPartSprite);

    // Açıklama
    this.descText = scene.add.text(0, 0, '', {
      ...font,
      fontSize: '11px',
      color: PALETTE.textMuted,
      lineSpacing: 3,
      wordWrap: { width: 220 },
    }).setOrigin(0, 0);
    this.container.add(this.descText);

    // 6. İstatistikler
    this.levelText = scene.add.text(0, 0, '', {
      ...font,
      fontSize: '13px',
      color: PALETTE.textPrimary,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.container.add(this.levelText);

    this.prodText = scene.add.text(0, 0, '', {
      ...font,
      fontSize: '13px',
      color: PALETTE.successGreenHex,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.container.add(this.prodText);

    // Kilometre Taşı Çubuğu
    this.milestoneTitleText = scene.add.text(0, 0, '', {
      ...font,
      fontSize: '10.5px',
      color: PALETTE.factoryAmberHex,
      fontStyle: 'bold',
    }).setOrigin(0, 0.5);
    this.container.add(this.milestoneTitleText);

    this.milestoneBarBg = scene.add.nineslice(0, 0, 'ui_bar_slot', 0, 310, 14, 4, 4, 4, 4).setOrigin(0, 0);
    this.container.add(this.milestoneBarBg);

    this.milestoneBarFill = scene.add.image(0, 0, 'ui_bar_fill_gold').setOrigin(0, 0.5);
    this.container.add(this.milestoneBarFill);

    // 7. Satın Alma / Geliştirme Butonu (Geniş 9-Slice Buton)
    this.actionBtnBg = PixelUIHelper.createButton(scene, 0, 0, 310, 44, 'green');
    this.container.add(this.actionBtnBg);

    this.actionBtnText = scene.add.text(0, 0, '', {
      ...font,
      fontSize: '14px',
      color: '#0f140e',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.actionBtnText);

    this.actionBtnSubtext = scene.add.text(0, 0, '', {
      ...font,
      fontSize: '10px',
      color: '#283820',
      fontStyle: 'bold',
    }).setOrigin(0.5, 0.5);
    this.container.add(this.actionBtnSubtext);

    this.actionZone = scene.add.zone(0, 0, 310, 44)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handleActionClick())
      .on('pointerover', () => {
        if (this.isAffordable) {
          this.actionBtnBg.setTexture('btn_green_hover');
        }
      })
      .on('pointerout', () => {
        if (this.isAffordable) {
          this.actionBtnBg.setTexture('btn_green_normal');
        } else {
          this.actionBtnBg.setTexture('btn_disabled');
        }
      });
    this.container.add(this.actionZone);
  }

  isOpen(): boolean {
    return this._isOpen;
  }

  show(machineIndex: number): void {
    this.currentMachineIndex = machineIndex;
    this._isOpen = true;
    this.container.setVisible(true);

    const w = this.scene.scale.width;
    const h = this.scene.scale.height;
    this.layout(w, h);
    this.refresh();

    // Açılış mikro animasyonu
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

  refresh(): void {
    if (!this._isOpen || this.currentMachineIndex < 0) return;

    const idx = this.currentMachineIndex;
    const def = MACHINES[idx];
    const state = this.economy.getMachineState(idx);
    const unlocked = this.economy.isUnlocked(idx);
    const cost = this.economy.getCost(idx);
    const canAfford = this.economy.canAfford(idx);
    const prod = this.economy.getProduction(idx);
    const nextMilestone = this.economy.getNextMachineMilestone(idx);
    const milestoneMul = this.economy.getMachineMilestoneMultiplier(idx);

    this.isAffordable = unlocked && canAfford;

    // Başlık
    this.titleText.setText(`${def.icon}  ${def.name}`);

    // Doku eşleştirmesi
    const machineKeys: Record<string, { base: string; part: string }> = {
      assembler: { base: 'machine_bench', part: 'machine_bench_part' },
      press: { base: 'machine_press', part: 'machine_press_part' },
      welder: { base: 'machine_welder', part: 'machine_welder_part' },
      automation: { base: 'machine_automation', part: 'machine_automation_part' },
    };
    const keys = machineKeys[def.id] || { base: 'machine_bench', part: 'machine_bench_part' };
    this.previewBaseSprite.setTexture(keys.base);
    this.previewPartSprite.setTexture(keys.part);

    // Açıklama
    this.descText.setText(def.description);

    // Seviye ve Üretim
    if (!unlocked) {
      this.levelText.setText('DURUM: KİLİTLİ');
      this.levelText.setColor(PALETTE.dangerRedHex);
      this.prodText.setText(`Gereken Toplam Kazanç: ${formatNumber(def.unlockAt)} ${RESOURCE_NAME}`);
      this.prodText.setColor(PALETTE.textMuted);
    } else if (state.level === 0) {
      this.levelText.setText('DURUM: KURULUM YAPILMADI');
      this.levelText.setColor(PALETTE.factoryAmberHex);
      this.prodText.setText(`Başlangıç Kapasitesi: +${formatNumber(def.baseProduction)} ${RESOURCE_NAME}/sn`);
      this.prodText.setColor(PALETTE.textMuted);
    } else {
      this.levelText.setText(`Mevcut Seviye: ${state.level}`);
      this.levelText.setColor(PALETTE.textPrimary);
      this.prodText.setText(`Mevcut Üretim: +${formatNumber(prod)} ${RESOURCE_NAME}/sn`);
      this.prodText.setColor(PALETTE.successGreenHex);
    }

    // Kilometre Taşı
    if (nextMilestone && unlocked) {
      const prevLevel = nextMilestone.level === 10 ? 0 : nextMilestone.level === 25 ? 10 : 25;
      const progress = Phaser.Math.Clamp(
        (state.level - prevLevel) / (nextMilestone.level - prevLevel),
        0,
        1,
      );
      this.milestoneTitleText.setText(
        `KİLOMETRE TAŞI: Sv. ${nextMilestone.level} (${nextMilestone.label}) [${state.level}/${nextMilestone.level}]`,
      );
      const totalBarW = 310;
      const fillW = Math.max(2, Math.round(totalBarW * progress));
      this.milestoneBarFill.setDisplaySize(fillW, 8);
      this.milestoneBarFill.setVisible(true);
      this.milestoneBarBg.setVisible(true);
      this.milestoneTitleText.setVisible(true);
    } else {
      this.milestoneTitleText.setText(milestoneMul > 1 ? `⭐ TÜM HEDEFLER TAMAMLANDI (${milestoneMul}x Verimlilik)` : '');
      this.milestoneBarFill.setVisible(false);
      this.milestoneBarBg.setVisible(false);
    }

    // Buton Durumu ve Etiketleri
    if (!unlocked) {
      this.actionBtnBg.setTexture('btn_disabled');
      this.actionBtnText.setText('KİLİTLİ');
      this.actionBtnText.setColor(PALETTE.textMuted);
      this.actionBtnSubtext.setText(`Gereken: ${formatNumber(def.unlockAt)} ${RESOURCE_NAME}`);
      this.actionBtnSubtext.setColor(PALETTE.textMuted);
      this.actionZone.input!.enabled = false;
    } else if (state.level === 0) {
      this.actionZone.input!.enabled = true;
      if (canAfford) {
        this.actionBtnBg.setTexture('btn_green_normal');
        this.actionBtnText.setText(`🔨 KURULUM YAP (${formatNumber(cost)} ${RESOURCE_NAME})`);
        this.actionBtnText.setColor('#0e180d');
        this.actionBtnSubtext.setText(`+${formatNumber(def.baseProduction)} ${RESOURCE_NAME}/sn kazandırır`);
        this.actionBtnSubtext.setColor('#253d20');
      } else {
        this.actionBtnBg.setTexture('btn_disabled');
        this.actionBtnText.setText(`KURULUM: ${formatNumber(cost)} ${RESOURCE_NAME}`);
        this.actionBtnText.setColor(PALETTE.textMuted);
        this.actionBtnSubtext.setText('Yetersiz Kaynak');
        this.actionBtnSubtext.setColor(PALETTE.dangerRedHex);
      }
    } else {
      this.actionZone.input!.enabled = true;
      if (canAfford) {
        this.actionBtnBg.setTexture('btn_green_normal');
        this.actionBtnText.setText(`▲ GELİŞTİR (Sv. ${state.level + 1}) — ${formatNumber(cost)} ${RESOURCE_NAME}`);
        this.actionBtnText.setColor('#0e180d');
        const nextProd = this.economy.getProduction(idx, state.level + 1);
        const gain = nextProd.sub(prod);
        this.actionBtnSubtext.setText(`+${formatNumber(gain)} ${RESOURCE_NAME}/sn artış sağlar`);
        this.actionBtnSubtext.setColor('#253d20');
      } else {
        this.actionBtnBg.setTexture('btn_disabled');
        this.actionBtnText.setText(`GELİŞTİR: ${formatNumber(cost)} ${RESOURCE_NAME}`);
        this.actionBtnText.setColor(PALETTE.textMuted);
        this.actionBtnSubtext.setText('Yetersiz Kaynak');
        this.actionBtnSubtext.setColor(PALETTE.dangerRedHex);
      }
    }
  }

  private handleActionClick(): void {
    if (this.currentMachineIndex < 0 || !this.isAffordable) return;

    this.actionBtnBg.setTexture('btn_green_pressed');
    if (this.economy.buyOrUpgrade(this.currentMachineIndex)) {
      this.onUpgradeSuccess(this.currentMachineIndex);
      this.refresh();

      // Mikro buton sekmesi
      this.scene.tweens.add({
        targets: this.actionBtnBg,
        scaleX: 1.03,
        scaleY: 1.03,
        duration: 60,
        yoyo: true,
        ease: 'Quad.easeOut',
      });
    }
  }

  layout(w: number, h: number): void {
    this.backdrop.setSize(w, h);

    const modalW = Math.min(380, w - 24);
    const modalH = Math.min(370, h - 40);
    const cx = w / 2;
    const cy = h / 2;

    this.modalBg.setPosition(cx - modalW / 2, cy - modalH / 2);
    this.modalBg.setSize(modalW, modalH);

    const pad = 16;
    const innerLeft = cx - modalW / 2 + pad;
    const innerTop = cy - modalH / 2 + pad;
    const innerRight = cx + modalW / 2 - pad;

    // Başlık ve Kapat Butonu
    this.titleText.setPosition(innerLeft, innerTop + 8);
    this.closeBtnBg.setPosition(innerRight - 14, innerTop + 8);
    this.closeBtnIcon.setPosition(innerRight - 14, innerTop + 8);
    this.closeZone.setPosition(innerRight - 14, innerTop + 8);

    // Makine Önizleme Kartı (Sol Üst)
    const previewW = 86;
    const previewH = 80;
    const previewX = innerLeft + previewW / 2;
    const previewY = innerTop + 36 + previewH / 2;

    this.previewCardBg.setPosition(innerLeft, innerTop + 36);
    this.previewCardBg.setSize(previewW, previewH);
    this.previewBaseSprite.setPosition(previewX, previewY);
    this.previewPartSprite.setPosition(previewX, previewY);

    // Açıklama (Sağ Üst)
    const descX = innerLeft + previewW + 12;
    this.descText.setPosition(descX, innerTop + 38);
    this.descText.setWordWrapWidth(modalW - previewW - pad * 2 - 16);

    // İstatistikler (Orta Bölüm)
    const statsTop = innerTop + 36 + previewH + 16;
    this.levelText.setPosition(innerLeft, statsTop);
    this.prodText.setPosition(innerLeft, statsTop + 22);

    // Kilometre Taşı Çubuğu
    const barTop = statsTop + 48;
    this.milestoneTitleText.setPosition(innerLeft, barTop);

    const barW = modalW - pad * 2;
    this.milestoneBarBg.setPosition(innerLeft, barTop + 14);
    this.milestoneBarBg.setSize(barW, 14);
    this.milestoneBarFill.setPosition(innerLeft + 3, barTop + 21);

    // Satın Alma Butonu (En Alt)
    const btnW = modalW - pad * 2;
    const btnH = 46;
    const btnY = cy + modalH / 2 - pad - btnH / 2;

    this.actionBtnBg.setPosition(cx, btnY);
    this.actionBtnBg.setSize(btnW, btnH);

    this.actionBtnText.setPosition(cx, btnY - 7);
    this.actionBtnSubtext.setPosition(cx, btnY + 10);

    this.actionZone.setPosition(cx, btnY);
    this.actionZone.setSize(btnW, btnH);
  }
}
