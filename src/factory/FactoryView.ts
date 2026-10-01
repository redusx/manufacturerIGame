/* ======================================================================
 * FactoryView.ts — Fabrika görselleştirme ve üretim akış sistemi
 *
 * Tamamen gerçek piksel-art raster dokuları ile yeniden oluşturuldu.
 * Akış:
 * HAMMADDE GİRİŞİ (factory_intake) → MAKİNELER (machine_bench/press/welder/automation)
 * → BANTTA İLERLEYEN PİKSEL ÜRÜNLER (pickup_gear/crystal/coin_gold) → SEVKİYAT (shipping_crate)
 * ====================================================================== */

import Phaser from 'phaser';
import { MACHINES, type MachineDefinition } from '../data/MachineData';
import type { EconomyManager } from '../economy/EconomyManager';
import { FONT_FAMILY, PALETTE, PixelUIHelper } from '../ui/theme';
import { formatNumber } from '../utils/format';

interface VisualProduct {
  container: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Sprite;
  progress: number;      // 0 to 1 along conveyor belt
  speed: number;         // progress units per second
  value: number;         // batch value
  stage: number;         // which machine stage it has passed
}

interface MachineVisualBay {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
  container: Phaser.GameObjects.Container;
  baseSprite: Phaser.GameObjects.Sprite;
  movingPartSprite: Phaser.GameObjects.Sprite;
  infoBg: Phaser.GameObjects.NineSlice;
  nameLabel: Phaser.GameObjects.Text;
  levelBadge: Phaser.GameObjects.Text;
  prodLabel: Phaser.GameObjects.Text;
  costLabel: Phaser.GameObjects.Text;
  upgradePillBg: Phaser.GameObjects.NineSlice;
  upgradePillText: Phaser.GameObjects.Text;
  zone: Phaser.GameObjects.Zone;
  isOperating: boolean;
  animTimer: number;
}

export class FactoryView {
  private scene: Phaser.Scene;
  private economy: EconomyManager;

  /* Ana Konteyner */
  private container: Phaser.GameObjects.Container;

  /* Raster Dokular */
  private bgTileSprite: Phaser.GameObjects.TileSprite;
  private floorTileSprite: Phaser.GameObjects.TileSprite;
  private beltTileSprite: Phaser.GameObjects.TileSprite;
  private bayContainers: Phaser.GameObjects.Container[] = [];
  private productContainer: Phaser.GameObjects.Container;

  /* Sevkiyat Bölümü */
  private shippingContainer: Phaser.GameObjects.Container;
  private shippingSprite: Phaser.GameObjects.Image;
  private shippingText: Phaser.GameObjects.Text;

  /* Hammadde Girişi Bölümü */
  private intakeContainer: Phaser.GameObjects.Container;
  private intakeSprite: Phaser.GameObjects.Image;
  private intakeLabel: Phaser.GameObjects.Text;

  /* Tıklama Alanı (Fabrika İçi) */
  private clickZone: Phaser.GameObjects.Zone;

  /* Makine Görsel Bay'leri */
  private machineBays: MachineVisualBay[] = [];

  /* Taşıma Bandı Ürünleri */
  private products: VisualProduct[] = [];
  private beltScrollOffset = 0;

  /* Boyutlar ve Koordinatlar */
  private viewX = 0;
  private viewY = 0;
  private viewW = 600;
  private viewH = 340;
  private beltY = 0;
  private beltStartX = 0;
  private beltEndX = 0;

  /* Otomatik görsel üretim tetikleyici */
  private autoVisualTimer = 0;

  /* Geri çağırma (HUD'a parçacık hedefi ve bildirim için) */
  private onProductDelivered: (amount: number, fromX: number, fromY: number) => void;
  private onManualClick: () => void;
  private onMachineSelect: (index: number) => void;

  constructor(
    scene: Phaser.Scene,
    economy: EconomyManager,
    onManualClick: () => void,
    onProductDelivered: (amount: number, fromX: number, fromY: number) => void,
    onMachineSelect: (index: number) => void,
  ) {
    this.scene = scene;
    this.economy = economy;
    this.onManualClick = onManualClick;
    this.onProductDelivered = onProductDelivered;
    this.onMachineSelect = onMachineSelect;

    this.container = scene.add.container(0, 0).setDepth(20);

    // 1. Fabrika Arka Plan Dokusu (Seamless Tile)
    this.bgTileSprite = scene.add.tileSprite(0, 0, 100, 100, 'factory_bg')
      .setOrigin(0, 0);
    this.container.add(this.bgTileSprite);

    // 2. Fabrika Zemin Şeridi Dokusu (Sarı-siyah emniyet şeritli karo zemin)
    this.floorTileSprite = scene.add.tileSprite(0, 0, 100, 32, 'factory_floor')
      .setOrigin(0, 0);
    this.container.add(this.floorTileSprite);

    // 3. Konveyör Bandı Dokusu (Seamless kayar merdaneli kauçuk bant)
    this.beltTileSprite = scene.add.tileSprite(0, 0, 100, 24, 'conveyor_belt')
      .setOrigin(0, 0);
    this.container.add(this.beltTileSprite);

    // Ürün katmanı
    this.productContainer = scene.add.container(0, 0);
    this.container.add(this.productContainer);

    // Hammadde girişi silosu
    this.intakeContainer = scene.add.container(0, 0);
    this.intakeSprite = scene.add.image(0, 0, 'factory_intake').setOrigin(0.5, 0.5);
    this.intakeContainer.add(this.intakeSprite);

    this.intakeLabel = scene.add.text(0, 0, 'HAMMADDE\nGİRİŞİ', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: '#00d2d3',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.intakeContainer.add(this.intakeLabel);
    this.container.add(this.intakeContainer);

    // Sevkiyat bölümü sandığı
    this.shippingContainer = scene.add.container(0, 0);
    this.shippingSprite = scene.add.image(0, 0, 'shipping_crate').setOrigin(0.5, 0.5);
    this.shippingContainer.add(this.shippingSprite);

    this.shippingText = scene.add.text(0, 0, 'SEVKİYAT', {
      fontFamily: FONT_FAMILY,
      fontSize: '10px',
      color: '#ffd166',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.shippingContainer.add(this.shippingText);
    this.container.add(this.shippingContainer);

    // Dokunma/tıklama alanı
    this.clickZone = scene.add.zone(0, 0, 100, 100)
      .setOrigin(0.5)
      .setInteractive({ useHandCursor: true })
      .on('pointerdown', () => this.handlePointerClick());
    this.container.add(this.clickZone);

    // 4 Makine Bay'i oluştur
    this.createMachineBays();
  }

  private createMachineBays(): void {
    const s = this.scene;
    const font: Phaser.Types.GameObjects.Text.TextStyle = {
      fontFamily: FONT_FAMILY,
    };

    const machineKeys = [
      { base: 'machine_bench', part: 'machine_bench_part' },
      { base: 'machine_press', part: 'machine_press_part' },
      { base: 'machine_welder', part: 'machine_welder_part' },
      { base: 'machine_automation', part: 'machine_automation_part' },
    ];

    for (let i = 0; i < MACHINES.length; i++) {
      const def = MACHINES[i];
      const bayCont = s.add.container(0, 0);
      this.container.add(bayCont);
      this.bayContainers.push(bayCont);

      const keys = machineKeys[i];
      const baseSprite = s.add.sprite(0, 0, keys.base).setOrigin(0.5, 0.5);
      bayCont.add(baseSprite);

      const movingPartSprite = s.add.sprite(0, 0, keys.part).setOrigin(0.5, 0.5);
      bayCont.add(movingPartSprite);

      // Bilgi kartı arkaplanı (9-slice)
      const infoBg = PixelUIHelper.createCard(s, 0, 0, 80, 50);
      bayCont.add(infoBg);

      const nameLabel = s.add.text(0, 0, def.name, {
        ...font,
        fontSize: '11px',
        color: '#f5f6fa',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5);
      bayCont.add(nameLabel);

      const levelBadge = s.add.text(0, 0, '', {
        ...font,
        fontSize: '10px',
        color: '#ffd166',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5);
      bayCont.add(levelBadge);

      const prodLabel = s.add.text(0, 0, '', {
        ...font,
        fontSize: '9px',
        color: '#2ecc71',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5);
      bayCont.add(prodLabel);

      const costLabel = s.add.text(0, 0, '', {
        ...font,
        fontSize: '9px',
        color: '#ffedd5',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5);
      bayCont.add(costLabel);

      // Geliştirme / Satın alma rozeti (Piksel 9-slice buton - boyut büyütüldü)
      const upgradePillBg = PixelUIHelper.createButton(s, 0, 0, 80, 28, 'green');
      bayCont.add(upgradePillBg);

      const upgradePillText = s.add.text(0, 0, '▲ GELİŞTİR', {
        ...font,
        fontSize: '10px',
        color: '#0e180d',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5);
      bayCont.add(upgradePillText);

      // Cihaz interaktif tıklama alanı (Doğrudan makineye tıklanınca açılır)
      const zone = s.add.zone(0, 0, 100, 160)
        .setOrigin(0.5, 0.5)
        .setInteractive({ useHandCursor: true })
        .on('pointerdown', (ptr: Phaser.Input.Pointer) => {
          ptr.event.stopPropagation();
          this.onMachineSelect(i);
        })
        .on('pointerover', () => {
          bayCont.setScale(1.04);
          if (this.economy.canAfford(i)) {
            upgradePillBg.setTexture('btn_green_hover');
          }
        })
        .on('pointerout', () => {
          bayCont.setScale(1.0);
          if (this.economy.canAfford(i)) {
            upgradePillBg.setTexture('btn_green_normal');
          }
        });
      bayCont.add(zone);

      this.machineBays.push({
        index: i,
        x: 0,
        y: 0,
        width: 100,
        height: 180,
        container: bayCont,
        baseSprite,
        movingPartSprite,
        infoBg,
        nameLabel,
        levelBadge,
        prodLabel,
        costLabel,
        upgradePillBg,
        upgradePillText,
        zone,
        isOperating: false,
        animTimer: 0,
      });
    }
  }

  /* ================================================================
   * TIKLAMA / ETKİLEŞİM
   * ================================================================ */

  private handlePointerClick(): void {
    this.onManualClick();
    this.triggerBayAction(0, 1.2);
    this.spawnProduct(1);

    this.scene.tweens.add({
      targets: this.intakeContainer,
      scaleX: 1.1, scaleY: 0.9,
      duration: 60, yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /** Sahneden çağrılan manuel üretim görsel tetikleyicisi */
  triggerManualProduction(amount: number): void {
    this.triggerBayAction(0, 1.3);
    this.spawnProduct(amount);

    this.scene.tweens.add({
      targets: this.intakeContainer,
      scaleX: 1.1, scaleY: 0.9,
      duration: 70, yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /** Makine satın alma/yükseltme anında görsel patlama */
  playMachineUpgradeEffect(index: number): void {
    const bay = this.machineBays[index];
    if (!bay) return;

    this.scene.tweens.add({
      targets: bay.container,
      scaleX: 1.2, scaleY: 1.2,
      duration: 120, yoyo: true,
      ease: 'Back.easeOut',
    });

    // Parlak piksel kıvılcımları
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const dist = Phaser.Math.Between(25, 45);
      const p = this.scene.add.image(
        this.viewX + bay.x,
        this.viewY + bay.y - 15,
        'icon_coin',
      ).setScale(0.8).setDepth(80);

      this.scene.tweens.add({
        targets: p,
        x: this.viewX + bay.x + Math.cos(angle) * dist,
        y: this.viewY + bay.y - 15 + Math.sin(angle) * dist,
        alpha: 0, scale: 0.2,
        duration: 450, ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }

    const upText = this.scene.add.text(
      this.viewX + bay.x,
      this.viewY + bay.y - 55,
      'GÜÇLENDİRİLDİ!',
      {
        fontFamily: FONT_FAMILY,
        fontSize: '12px',
        color: '#2ecc71',
        fontStyle: 'bold',
      },
    ).setOrigin(0.5).setDepth(85);

    this.scene.tweens.add({
      targets: upText,
      y: this.viewY + bay.y - 80,
      alpha: 0,
      duration: 750,
      ease: 'Quad.easeOut',
      onComplete: () => upText.destroy(),
    });
  }

  /* ================================================================
   * GÜNCELLEME (HER KARE)
   * ================================================================ */

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    // 1. Konveyör bandı dokusunu kesintisiz kaydır
    this.beltScrollOffset += dt * 60;
    this.beltTileSprite.tilePositionX = this.beltScrollOffset;

    // 2. Otomatik üretim görsel akışı
    this.handleAutoProductionVisuals(dt);

    // 3. Ürünleri bant üzerinde ilerlet
    this.updateProducts(dt);

    // 4. Makine animasyonlarını güncelle
    this.updateMachineAnimations(dt);
  }

  private handleAutoProductionVisuals(dt: number): void {
    const pps = this.economy.getTotalProductionPerSecond();
    if (pps.lte(0)) return;

    const ppsNum = Math.min(pps.toNumber(), 100);
    const interval = Phaser.Math.Clamp(1.2 / Math.max(1, Math.log10(ppsNum + 1) * 2), 0.25, 1.2);

    this.autoVisualTimer += dt;
    if (this.autoVisualTimer >= interval) {
      this.autoVisualTimer = 0;

      // En yüksek seviyeli aktif makineyi tetikle
      for (let i = MACHINES.length - 1; i >= 0; i--) {
        if (this.economy.getMachineState(i).level > 0) {
          this.triggerBayAction(i, 0.85);
          break;
        }
      }
      this.spawnProduct(pps.toNumber() * interval);
    }
  }

  private triggerBayAction(index: number, intensity = 1): void {
    const bay = this.machineBays[index];
    if (!bay) return;

    bay.isOperating = true;
    bay.animTimer = 0;

    this.scene.tweens.add({
      targets: bay.container,
      y: bay.y + 3 * intensity,
      duration: 50,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        bay.isOperating = false;
      },
    });

    this.spawnSparks(bay.x, bay.y + 10, MACHINES[index].accentColor);
  }

  private spawnSparks(localX: number, localY: number, _color: number): void {
    const count = 3;
    for (let i = 0; i < count; i++) {
      const angle = Phaser.Math.FloatBetween(-Math.PI * 0.8, -Math.PI * 0.2);
      const dist = Phaser.Math.Between(12, 24);
      const spark = this.scene.add.image(
        this.viewX + localX,
        this.viewY + localY,
        'star_pixel',
      ).setScale(0.8).setDepth(60);

      this.scene.tweens.add({
        targets: spark,
        x: this.viewX + localX + Math.cos(angle) * dist,
        y: this.viewY + localY + Math.sin(angle) * dist,
        alpha: 0,
        scale: 0.1,
        duration: 250,
        ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }
  }

  /* ================================================================
   * ÜRÜN ÜRETİMİ VE BANT İLERLEMESİ (RASTER PİKSEL SPRITE'LARI)
   * ================================================================ */

  private spawnProduct(value = 1): void {
    const pContainer = this.scene.add.container(this.beltStartX, this.beltY);

    // Aşama 0 başlangıç sprite'ı: gri metal sikke / parça
    const sprite = this.scene.add.sprite(0, 0, 'pickup_gear').setOrigin(0.5, 0.5);
    sprite.setScale(1.1);
    sprite.setTint(0x7f8c8d); // Ham gri döküm
    pContainer.add(sprite);

    this.productContainer.add(pContainer);

    const prod: VisualProduct = {
      container: pContainer,
      sprite,
      progress: 0,
      speed: 0.35,
      value,
      stage: 0,
    };

    this.products.push(prod);
  }

  private updateProducts(dt: number): void {
    const totalBeltDist = this.beltEndX - this.beltStartX;

    for (let i = this.products.length - 1; i >= 0; i--) {
      const p = this.products[i];
      p.progress += p.speed * dt;

      const currentX = this.beltStartX + p.progress * totalBeltDist;
      const bounceY = Math.sin(p.progress * 30) * 1.5;
      p.container.setPosition(currentX, this.beltY - 4 + bounceY);

      // Ürün makinelerin önünden geçerken piksel varlığı dönüşsün
      const currentStage = Math.floor(p.progress * MACHINES.length);
      if (currentStage !== p.stage && currentStage < MACHINES.length) {
        p.stage = currentStage;
        this.updateProductVisual(p);

        if (this.economy.getMachineState(currentStage).level > 0) {
          this.triggerBayAction(currentStage, 0.7);
        }
      }

      // Sevkiyat sandığına ulaştı mı?
      if (p.progress >= 1) {
        this.deliverProduct(p);
        p.container.destroy();
        this.products.splice(i, 1);
      }
    }
  }

  private updateProductVisual(p: VisualProduct): void {
    const stage = p.stage;
    const s = p.sprite;

    if (stage === 0) {
      s.setTexture('pickup_gear');
      s.setTint(0x7f8c8d);
      s.setScale(1.0);
    } else if (stage === 1) {
      // Preslenmiş altın dişli
      s.setTexture('pickup_gear');
      s.clearTint();
      s.setScale(1.2);
    } else if (stage === 2) {
      // Kaynaklanmış plazma enerji kristali
      s.setTexture('pickup_crystal');
      s.clearTint();
      s.setScale(1.2);
    } else {
      // Tamamlanmış parlayan sikke
      s.setTexture('coin_gold');
      s.clearTint();
      s.setScale(1.4);
      if (this.scene.anims.exists('coin_gold_spin')) {
        s.play('coin_gold_spin');
      }
    }
  }

  private deliverProduct(p: VisualProduct): void {
    this.scene.tweens.add({
      targets: this.shippingContainer,
      scaleX: 1.15, scaleY: 0.85,
      duration: 70, yoyo: true,
      ease: 'Back.easeOut',
    });

    const sx = this.viewX + this.shippingContainer.x;
    const sy = this.viewY + this.shippingContainer.y;
    this.onProductDelivered(p.value, sx, sy);
  }

  /* ================================================================
   * MAKİNE ANİMASYONLARI
   * ================================================================ */

  private updateMachineAnimations(dt: number): void {
    for (const bay of this.machineBays) {
      const state = this.economy.getMachineState(bay.index);
      if (state.level === 0) continue;

      if (bay.isOperating) {
        bay.animTimer += dt * 8;
      } else {
        // Rölanti mikro salınımı
        bay.animTimer += dt * 2;
      }

      const phase = Math.sin(bay.animTimer);

      if (bay.index === 0) {
        // Montaj Tezgahı: Pnömatik montaj çekici inip kalkar
        const drop = Math.max(0, phase) * 8;
        bay.movingPartSprite.setPosition(0, -6 + drop);
      } else if (bay.index === 1) {
        // Pres Makinesi: Hidrolik baskı bloğu aşağı iner
        const pressDrop = Math.max(0, phase) * 10;
        bay.movingPartSprite.setPosition(0, -4 + pressDrop);
      } else if (bay.index === 2) {
        // Kaynak Robotu: Robot kol açısı döner
        bay.movingPartSprite.setRotation(phase * 0.3);
      } else {
        // Otomasyon Hattı: Lazer tarayıcı sağa sola kayar
        bay.movingPartSprite.setPosition(phase * 12, 0);
      }
    }
  }

  /* ================================================================
   * YERLEŞİM (LAYOUT)
   * ================================================================ */

  layout(x: number, y: number, w: number, h: number, sf: number): void {
    this.viewX = x;
    this.viewY = y;
    this.viewW = w;
    this.viewH = h;
    this.container.setPosition(x, y);

    // 1. Fabrika Arka Planı (factory_bg)
    this.bgTileSprite.setPosition(0, 0);
    this.bgTileSprite.setSize(w, h);

    // 2. Fabrika Zemin Şeridi (factory_floor)
    const floorH = Math.round(36 * sf);
    const floorY = h - floorH;
    this.floorTileSprite.setPosition(0, floorY);
    this.floorTileSprite.setSize(w, floorH);

    // 3. Konveyör Bandı (conveyor_belt)
    const intakeW = Math.round(52 * sf);
    const shippingW = Math.round(56 * sf);

    this.beltY = Math.round(h * 0.72);
    this.beltStartX = intakeW + 8;
    this.beltEndX = w - shippingW - 8;

    this.beltTileSprite.setPosition(this.beltStartX, this.beltY);
    this.beltTileSprite.setSize(this.beltEndX - this.beltStartX, Math.round(20 * sf));

    // 4. Hammadde Giriş Silosu
    this.intakeContainer.setPosition(intakeW / 2 + 4, this.beltY - 14 * sf);
    this.intakeSprite.setScale(Math.max(1, sf * 1.1));
    this.intakeLabel.setPosition(0, -32 * sf);
    this.intakeLabel.setFontSize(`${Math.max(9, Math.round(9 * sf))}px`);

    // 5. Sevkiyat Sandığı
    this.shippingContainer.setPosition(w - shippingW / 2 - 4, this.beltY - 12 * sf);
    this.shippingSprite.setScale(Math.max(1, sf * 1.1));
    this.shippingText.setPosition(0, -28 * sf);
    this.shippingText.setFontSize(`${Math.max(9, Math.round(9 * sf))}px`);

    // 6. Tıklama / Dokunma Alanı (Tüm fabrika içi)
    this.clickZone.setPosition(w / 2, h / 2);
    this.clickZone.setSize(w, h);

    // 7. 4 Makine Bay'ini Yerleştir
    const bayCount = MACHINES.length;
    const availableW = this.beltEndX - this.beltStartX;
    const baySpacing = availableW / bayCount;
    const bayH = Math.round(80 * sf);

    for (let i = 0; i < bayCount; i++) {
      const bay = this.machineBays[i];
      const bayX = this.beltStartX + baySpacing * (i + 0.5);
      const bayY = this.beltY - 66 * sf;

      this.layoutMachineBay(bay, bayX, bayY, baySpacing, sf);
    }
  }

  private layoutMachineBay(
    bay: MachineVisualBay,
    x: number,
    y: number,
    w: number,
    sf: number,
  ): void {
    bay.x = x;
    bay.y = y;
    bay.width = w;
    bay.container.setPosition(x, y);

    const def = MACHINES[bay.index];
    const state = this.economy.getMachineState(bay.index);
    const isUnlocked = this.economy.isUnlocked(bay.index);
    const isOwned = state.level > 0;

    // Layout adjustments
    const infoBgY = -105 * sf;
    const maxInfoWidth = 180 * sf;
    bay.infoBg.setPosition(0, infoBgY);
    bay.infoBg.setSize(maxInfoWidth, 68 * sf);

    // İsim etiketi
    bay.nameLabel.setText(def.name);
    bay.nameLabel.setPosition(0, infoBgY - 22 * sf);
    bay.nameLabel.setFontSize(`${Math.max(9, Math.round(10 * sf))}px`);
    bay.nameLabel.setColor(isOwned ? '#f5f6fa' : '#8c9bb3');

    // Seviye rozeti
    if (isOwned) {
      bay.levelBadge.setText(`Sv. ${state.level}`);
      bay.levelBadge.setPosition(0, infoBgY - 10 * sf);
      bay.levelBadge.setFontSize(`${Math.max(8, Math.round(9 * sf))}px`);
      bay.levelBadge.setVisible(true);
    } else {
      bay.levelBadge.setVisible(false);
    }

    // Üretim ve Maliyet (layout for both states)
    bay.prodLabel.setPosition(0, infoBgY + 5 * sf);
    bay.prodLabel.setFontSize(`${Math.max(8, Math.round(9 * sf))}px`);
    
    bay.costLabel.setPosition(0, infoBgY + 18 * sf);
    bay.costLabel.setFontSize(`${Math.max(8, Math.round(9 * sf))}px`);

    // Makine Dokuları ve Görsel Durumu
    const scale = Math.max(1, sf * 1.15);
    bay.baseSprite.setScale(scale);
    bay.movingPartSprite.setScale(scale);

    const machineKeys = [
      { base: 'machine_bench', part: 'machine_bench_part' },
      { base: 'machine_press', part: 'machine_press_part' },
      { base: 'machine_welder', part: 'machine_welder_part' },
      { base: 'machine_automation', part: 'machine_automation_part' },
    ];

    if (!isUnlocked) {
      // Henüz açılmamış: silüet
      bay.baseSprite.setTexture('machine_empty_slot');
      bay.baseSprite.setTint(0x22293e);
      bay.movingPartSprite.setVisible(false);
      bay.levelBadge.setText('🔒 KİLİTLİ');
      bay.levelBadge.setColor(PALETTE.textMuted);
      bay.levelBadge.setPosition(0, infoBgY - 8 * sf);
      bay.levelBadge.setFontSize(`${Math.max(8, Math.round(9 * sf))}px`);
      bay.levelBadge.setVisible(true);
      bay.prodLabel.setVisible(false);
      bay.costLabel.setVisible(false);
      bay.upgradePillBg.setVisible(false);
      bay.upgradePillText.setVisible(false);
    } else if (!isOwned) {
      // Açılmış ama satın alınmamış: boş kurulum alanı
      bay.baseSprite.setTexture('machine_empty_slot');
      bay.baseSprite.clearTint();
      bay.movingPartSprite.setVisible(false);
      bay.levelBadge.setText('KURULABİLİR');
      bay.levelBadge.setColor(PALETTE.factoryAmberHex);
      bay.levelBadge.setPosition(0, infoBgY - 8 * sf);
      bay.levelBadge.setFontSize(`${Math.max(8, Math.round(9 * sf))}px`);
      bay.levelBadge.setVisible(true);
      
      bay.prodLabel.setText(`+${formatNumber(def.baseProduction)}/sn`);
      bay.prodLabel.setVisible(true);
      
      const cost = this.economy.getCost(bay.index);
      bay.costLabel.setText(`Maliyet: ${formatNumber(cost)}`);
      bay.costLabel.setVisible(true);

      const canAfford = this.economy.canAfford(bay.index);
      bay.upgradePillBg.setVisible(true);
      bay.upgradePillText.setVisible(true);
      bay.upgradePillText.setText('+ KUR');
      bay.upgradePillBg.setPosition(0, -50 * sf);
      bay.upgradePillText.setPosition(0, -50 * sf);
      bay.upgradePillBg.setSize(120 * sf, 28 * sf);
      if (canAfford) {
        bay.upgradePillBg.setTexture('btn_green_normal');
      } else {
        bay.upgradePillBg.setTexture('btn_disabled');
      }
    } else {
      // Satın alınmış aktif makine
      const k = machineKeys[bay.index];
      bay.baseSprite.setTexture(k.base);
      bay.baseSprite.clearTint();
      bay.movingPartSprite.setTexture(k.part);
      bay.movingPartSprite.clearTint();
      bay.movingPartSprite.setVisible(true);

      bay.levelBadge.setText(`Sv. ${state.level}`);
      bay.levelBadge.setColor(PALETTE.textPrimary);
      bay.levelBadge.setPosition(0, infoBgY - 10 * sf);
      bay.levelBadge.setFontSize(`${Math.max(8, Math.round(9 * sf))}px`);
      bay.levelBadge.setVisible(true);

      const prod = this.economy.getProduction(bay.index);
      bay.prodLabel.setText(`Üretim: ${formatNumber(prod)}/sn`);
      bay.prodLabel.setVisible(true);

      const cost = this.economy.getCost(bay.index);
      bay.costLabel.setText(`Maliyet: ${formatNumber(cost)}`);
      bay.costLabel.setVisible(true);

      const canAfford = this.economy.canAfford(bay.index);
      bay.upgradePillBg.setVisible(true);
      bay.upgradePillText.setVisible(true);
      bay.upgradePillText.setText('GELİŞTİR');
      bay.upgradePillBg.setPosition(0, -50 * sf);
      bay.upgradePillText.setPosition(0, -50 * sf);
      bay.upgradePillBg.setSize(120 * sf, 28 * sf);
      if (canAfford) {
        bay.upgradePillBg.setTexture('btn_green_normal');
      } else {
        bay.upgradePillBg.setTexture('btn_disabled');
      }
    }

    bay.zone.setSize(maxInfoWidth + 20, 160 * sf);
  }

  refreshBays(): void {
    const machineKeys = [
      { base: 'machine_bench', part: 'machine_bench_part' },
      { base: 'machine_press', part: 'machine_press_part' },
      { base: 'machine_welder', part: 'machine_welder_part' },
      { base: 'machine_automation', part: 'machine_automation_part' },
    ];

    const bayCount = this.machineBays.length;
    for (let i = 0; i < bayCount; i++) {
      const bay = this.machineBays[i];
      const isUnlocked = this.economy.isUnlocked(i);
      const state = this.economy.getMachineState(i);
      const isOwned = state.level > 0;
      const canAfford = this.economy.canAfford(i);

      if (!isUnlocked) {
        bay.baseSprite.setTexture('machine_empty_slot');
        bay.baseSprite.setTint(0x22293e);
        bay.movingPartSprite.setVisible(false);
        bay.nameLabel.setColor('#8c9bb3');
        bay.levelBadge.setText('🔒 KİLİTLİ');
        bay.levelBadge.setColor(PALETTE.textMuted);
        bay.levelBadge.setVisible(true);
        bay.upgradePillBg.setVisible(false);
        bay.upgradePillText.setVisible(false);
      } else if (!isOwned) {
        // Açılmış ama henüz kurulmamış (boş slot)
        bay.baseSprite.setTexture('machine_empty_slot');
        bay.baseSprite.clearTint();
        bay.movingPartSprite.setVisible(false);
        bay.nameLabel.setColor('#f5f6fa');
        bay.levelBadge.setText('KURULABİLİR');
        bay.levelBadge.setColor(PALETTE.factoryAmberHex);
        bay.levelBadge.setVisible(true);

        bay.upgradePillBg.setVisible(true);
        bay.upgradePillText.setVisible(true);
        bay.upgradePillText.setText('+ KUR');
        if (canAfford) {
          bay.upgradePillBg.setTexture('btn_green_normal');
        } else {
          bay.upgradePillBg.setTexture('btn_disabled');
        }
        
        bay.prodLabel.setText(`+${formatNumber(this.economy.getMachineDefinition(i).baseProduction)}/sn`);
        const cost = this.economy.getCost(i);
        bay.costLabel.setText(`Maliyet: ${formatNumber(cost)}`);
      } else {
        // Kurulmuş ve çalışan aktif makine görseli
        const k = machineKeys[bay.index];
        bay.baseSprite.setTexture(k.base);
        bay.baseSprite.clearTint();
        bay.movingPartSprite.setTexture(k.part);
        bay.movingPartSprite.clearTint();
        bay.movingPartSprite.setVisible(true);

        bay.nameLabel.setColor('#f5f6fa');
        bay.levelBadge.setText(`Sv. ${state.level}`);
        bay.levelBadge.setColor(PALETTE.textPrimary);
        bay.levelBadge.setVisible(true);
        
        const prod = this.economy.getProduction(i);
        bay.prodLabel.setText(`Üretim: ${formatNumber(prod)}/sn`);
        
        const cost = this.economy.getCost(i);
        bay.costLabel.setText(`Maliyet: ${formatNumber(cost)}`);
        
        bay.upgradePillBg.setVisible(true);
        bay.upgradePillText.setVisible(true);
        bay.upgradePillText.setText('GELİŞTİR');
        if (canAfford) {
          bay.upgradePillBg.setTexture('btn_green_normal');
        } else {
          bay.upgradePillBg.setTexture('btn_disabled');
        }
      }
    }
  }

  setVisible(visible: boolean): void {
    this.container.setVisible(visible);
  }
}
