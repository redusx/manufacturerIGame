/* ======================================================================
 * FactoryView.ts — Fabrika görselleştirme ve üretim akış sistemi
 *
 * Akış:
 * HAMMADDE GİRİŞİ → MAKİNE İŞLEMİ → BANTTA İLERLEYEN ÜRÜN → SEVKİYAT → KAYNAK ARTIŞI
 *
 * Özellikler:
 * - Canlı animasyonlu konveyör bant (dönen merdaneler ve hareket eden paletler)
 * - 4 fiziksel makine alanı (Montaj Tezgahı, Pres, Kaynak, Otomasyon)
 * - Tıklamada ve otomatik üretimde çalışan mekanik kollar, presler, kaynak kıvılcımları
 * - Bant üzerinde fiziksel olarak ilerleyen ve şekil değiştiren ürünler
 * - Sevkiyat sandığına ulaşınca HUD'a fırlayan kazanç parçacığı
 * - Seviyeye göre görsel olarak büyüyen/değişen makineler
 * ====================================================================== */

import Phaser from 'phaser';
import { MACHINES, type MachineDefinition } from '../data/MachineData';
import type { EconomyManager } from '../economy/EconomyManager';
import { formatNumber } from '../utils/format';

interface VisualProduct {
  container: Phaser.GameObjects.Container;
  gfx: Phaser.GameObjects.Graphics;
  progress: number;      // 0 to 1 along the conveyor belt
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
  baseGfx: Phaser.GameObjects.Graphics;
  movingPartGfx: Phaser.GameObjects.Graphics;
  statusGfx: Phaser.GameObjects.Graphics;
  nameLabel: Phaser.GameObjects.Text;
  levelBadge: Phaser.GameObjects.Text;
  isOperating: boolean;
  animTimer: number;
}

export class FactoryView {
  private scene: Phaser.Scene;
  private economy: EconomyManager;

  /* Ana Konteyner */
  private container: Phaser.GameObjects.Container;

  /* Katmanlar */
  private bgGfx: Phaser.GameObjects.Graphics;
  private factoryStructureGfx: Phaser.GameObjects.Graphics;
  private beltGfx: Phaser.GameObjects.Graphics;
  private bayContainers: Phaser.GameObjects.Container[] = [];
  private productContainer: Phaser.GameObjects.Container;
  private foregroundGfx: Phaser.GameObjects.Graphics;

  /* Sevkiyat Bölümü */
  private shippingContainer: Phaser.GameObjects.Container;
  private shippingCrateGfx: Phaser.GameObjects.Graphics;
  private shippingText: Phaser.GameObjects.Text;

  /* Hammadde Girişi Bölümü */
  private intakeContainer: Phaser.GameObjects.Container;
  private intakeGfx: Phaser.GameObjects.Graphics;
  private intakeLabel: Phaser.GameObjects.Text;

  /* Tıklama Alanı (Fabrika İçi) */
  private clickZone: Phaser.GameObjects.Zone;

  /* Makine Görsel Bay'leri */
  private machineBays: MachineVisualBay[] = [];

  /* Taşıma Bandı Ürünleri */
  private products: VisualProduct[] = [];
  private maxActiveProducts = 12;
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

  constructor(
    scene: Phaser.Scene,
    economy: EconomyManager,
    onManualClick: () => void,
    onProductDelivered: (amount: number, fromX: number, fromY: number) => void,
  ) {
    this.scene = scene;
    this.economy = economy;
    this.onManualClick = onManualClick;
    this.onProductDelivered = onProductDelivered;

    this.container = scene.add.container(0, 0).setDepth(20);

    this.bgGfx = scene.add.graphics();
    this.container.add(this.bgGfx);

    this.factoryStructureGfx = scene.add.graphics();
    this.container.add(this.factoryStructureGfx);

    this.beltGfx = scene.add.graphics();
    this.container.add(this.beltGfx);

    // Ürün katmanı
    this.productContainer = scene.add.container(0, 0);
    this.container.add(this.productContainer);

    // Hammadde girişi
    this.intakeContainer = scene.add.container(0, 0);
    this.intakeGfx = scene.add.graphics();
    this.intakeContainer.add(this.intakeGfx);
    this.intakeLabel = scene.add.text(0, 0, 'HAMMADDE\nGİRİŞİ', {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '10px',
      color: '#4ecdc4',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.intakeContainer.add(this.intakeLabel);
    this.container.add(this.intakeContainer);

    // Sevkiyat bölümü
    this.shippingContainer = scene.add.container(0, 0);
    this.shippingCrateGfx = scene.add.graphics();
    this.shippingContainer.add(this.shippingCrateGfx);
    this.shippingText = scene.add.text(0, 0, 'SEVKİYAT', {
      fontFamily: 'Arial, Helvetica, sans-serif',
      fontSize: '10px',
      color: '#f4a261',
      fontStyle: 'bold',
      align: 'center',
    }).setOrigin(0.5);
    this.shippingContainer.add(this.shippingText);
    this.container.add(this.shippingContainer);

    this.foregroundGfx = scene.add.graphics();
    this.container.add(this.foregroundGfx);

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
      fontFamily: 'Arial, Helvetica, sans-serif',
    };

    for (let i = 0; i < MACHINES.length; i++) {
      const def = MACHINES[i];
      const bayCont = s.add.container(0, 0);
      this.container.add(bayCont);
      this.bayContainers.push(bayCont);

      const baseGfx = s.add.graphics();
      bayCont.add(baseGfx);

      const movingPartGfx = s.add.graphics();
      bayCont.add(movingPartGfx);

      const statusGfx = s.add.graphics();
      bayCont.add(statusGfx);

      const nameLabel = s.add.text(0, 0, def.name, {
        ...font,
        fontSize: '11px',
        color: '#d4d4e0',
        fontStyle: 'bold',
        align: 'center',
      }).setOrigin(0.5);
      bayCont.add(nameLabel);

      const levelBadge = s.add.text(0, 0, '', {
        ...font,
        fontSize: '10px',
        color: '#f4a261',
        fontStyle: 'bold',
      }).setOrigin(0.5);
      bayCont.add(levelBadge);

      this.machineBays.push({
        index: i,
        x: 0,
        y: 0,
        width: 100,
        height: 120,
        container: bayCont,
        baseGfx,
        movingPartGfx,
        statusGfx,
        nameLabel,
        levelBadge,
        isOperating: false,
        animTimer: 0,
      });
    }
  }

  /* ================================================================
   * TIKLAMA / ETKİLEŞİM
   * ================================================================ */

  private handlePointerClick(): void {
    // Manuel üretim tetikle
    this.onManualClick();

    // Başlangıç makinesini (Montaj Tezgahı) anında hareketlendir
    this.triggerBayAction(0, 1.2);

    // Hammadde girişinden ürün çıkar
    this.spawnProduct(1);

    // Giriş hunisini titret
    this.scene.tweens.add({
      targets: this.intakeContainer,
      scaleX: 1.08, scaleY: 0.92,
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
      scaleX: 1.08, scaleY: 0.92,
      duration: 70, yoyo: true,
      ease: 'Quad.easeOut',
    });
  }

  /** Makine satın alma/yükseltme anında görsel patlama */
  playMachineUpgradeEffect(index: number): void {
    const bay = this.machineBays[index];
    if (!bay) return;

    // Makineyi büyüt-küçült
    this.scene.tweens.add({
      targets: bay.container,
      scaleX: 1.15, scaleY: 1.15,
      duration: 120, yoyo: true,
      ease: 'Back.easeOut',
    });

    // Parlak parçacıklar
    const count = 10;
    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count;
      const dist = Phaser.Math.Between(30, 50);
      const color = MACHINES[index].color;
      const p = this.scene.add.circle(
        this.viewX + bay.x,
        this.viewY + bay.y - 20,
        3.5,
        color,
        1,
      ).setDepth(80);

      this.scene.tweens.add({
        targets: p,
        x: this.viewX + bay.x + Math.cos(angle) * dist,
        y: this.viewY + bay.y - 20 + Math.sin(angle) * dist,
        alpha: 0, scale: 0.2,
        duration: 450, ease: 'Quad.easeOut',
        onComplete: () => p.destroy(),
      });
    }

    // Yükseltildi metni
    const upText = this.scene.add.text(
      this.viewX + bay.x,
      this.viewY + bay.y - 65,
      'GÜÇLENDİRİLDİ!',
      {
        fontFamily: 'Arial, Helvetica, sans-serif',
        fontSize: '12px',
        color: '#2ecc71',
        fontStyle: 'bold',
      },
    ).setOrigin(0.5).setDepth(85);

    this.scene.tweens.add({
      targets: upText,
      y: this.viewY + bay.y - 90,
      alpha: 0,
      duration: 800,
      ease: 'Quad.easeOut',
      onComplete: () => upText.destroy(),
    });
  }

  /* ================================================================
   * GÜNCELLEME (HER KARE)
   * ================================================================ */

  update(_time: number, delta: number): void {
    const dt = delta / 1000;

    // 1. Konveyör bandı çizgilerini kaydır
    this.beltScrollOffset = (this.beltScrollOffset + dt * 60) % 20;
    this.drawConveyorBelt();

    // 2. Otomatik üretim varsa makineleri ritmik çalıştır ve ürün üret
    this.handleAutoProductionVisuals(dt);

    // 3. Ürünleri bant üzerinde ilerlet
    this.updateProducts(dt);

    // 4. Makine animasyonlarını güncelle
    this.updateMachineAnimations(dt);
  }

  private handleAutoProductionVisuals(dt: number): void {
    const pps = this.economy.getTotalProductionPerSecond();
    if (pps.lte(0)) return;

    // Üretim hızına göre periyodik ürün bırakma
    const ppsNum = Math.min(pps.toNumber(), 100);
    // En fazla saniyede 4 görsel ürün, en az 1.2 saniyede bir
    const interval = Phaser.Math.Clamp(1.2 / Math.max(1, Math.log10(ppsNum + 1) * 2), 0.25, 1.2);

    this.autoVisualTimer += dt;
    if (this.autoVisualTimer >= interval) {
      this.autoVisualTimer = 0;
      if (this.products.length < this.maxActiveProducts) {
        this.spawnProduct(1);
      }
    }

    // Aktif makineleri ritmik çalıştır
    for (let i = 0; i < MACHINES.length; i++) {
      const state = this.economy.getMachineState(i);
      if (state.level > 0) {
        const bay = this.machineBays[i];
        bay.animTimer += dt * (1 + Math.min(state.level * 0.1, 2));
        this.drawBayMovingParts(bay, Math.sin(bay.animTimer * 6));
      }
    }
  }

  private triggerBayAction(index: number, intensity = 1.0): void {
    const bay = this.machineBays[index];
    if (!bay) return;

    bay.isOperating = true;
    bay.animTimer = 0;

    // Hızlı pres veya hareket tween'i
    this.scene.tweens.add({
      targets: bay.container,
      y: bay.y + 4 * intensity,
      duration: 50,
      yoyo: true,
      ease: 'Quad.easeOut',
      onComplete: () => {
        bay.isOperating = false;
      },
    });

    // Kıvılcım veya buhar efekti
    this.spawnSparks(bay.x, bay.y + 15, MACHINES[index].accentColor);
  }

  private spawnSparks(localX: number, localY: number, color: number): void {
    const count = 4;
    for (let i = 0; i < count; i++) {
      const angle = Phaser.Math.FloatBetween(-Math.PI * 0.8, -Math.PI * 0.2);
      const dist = Phaser.Math.Between(15, 30);
      const spark = this.scene.add.circle(
        this.viewX + localX,
        this.viewY + localY,
        2,
        color,
        1,
      ).setDepth(60);

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
   * ÜRÜN ÜRETİMİ VE BANT İLERLEMESİ
   * ================================================================ */

  private spawnProduct(value = 1): void {
    const pContainer = this.scene.add.container(this.beltStartX, this.beltY);
    const gfx = this.scene.add.graphics();
    pContainer.add(gfx);

    this.productContainer.add(pContainer);

    const prod: VisualProduct = {
      container: pContainer,
      gfx,
      progress: 0,
      speed: 0.35, // ~2.8 saniyede tüm bandı geçer
      value,
      stage: 0,
    };

    this.drawProductItem(prod);
    this.products.push(prod);
  }

  private updateProducts(dt: number): void {
    const totalBeltDist = this.beltEndX - this.beltStartX;

    for (let i = this.products.length - 1; i >= 0; i--) {
      const p = this.products[i];
      p.progress += p.speed * dt;

      // X konumu bandın üzerinde
      const currentX = this.beltStartX + p.progress * totalBeltDist;
      // Hafif konveyör titreşimi
      const bounceY = Math.sin(p.progress * 30) * 1.5;
      p.container.setPosition(currentX, this.beltY - 8 + bounceY);

      // Ürün makinelerin önünden geçerken dönüşsün
      const currentStage = Math.floor(p.progress * MACHINES.length);
      if (currentStage !== p.stage && currentStage < MACHINES.length) {
        p.stage = currentStage;
        this.drawProductItem(p);

        // İlgili makine aktifse işlem efekti ver
        if (this.economy.getMachineState(currentStage).level > 0) {
          this.triggerBayAction(currentStage, 0.8);
        }
      }

      // Sevkiyata ulaştı mı?
      if (p.progress >= 1.0) {
        this.deliverProduct(p);
        p.container.destroy();
        this.products.splice(i, 1);
      }
    }
  }

  private drawProductItem(p: VisualProduct): void {
    const g = p.gfx;
    g.clear();

    const stage = p.stage;
    if (stage === 0) {
      // Aşama 0: Ham metal külçe (gri çelik)
      g.fillStyle(0x7f8c8d, 1);
      g.fillRoundedRect(-9, -7, 18, 14, 3);
      g.fillStyle(0xbdc3c7, 0.8);
      g.fillRect(-7, -5, 14, 3);
    } else if (stage === 1) {
      // Aşama 1: Preslenmiş plaka (turuncu/bronz)
      g.fillStyle(0xe67e22, 1);
      g.fillRoundedRect(-11, -5, 22, 10, 2);
      g.fillStyle(0xf39c12, 0.9);
      g.fillRect(-9, -3, 18, 2);
      g.fillStyle(0x2c3e50, 0.8);
      g.fillCircle(-4, 0, 1.5);
      g.fillCircle(4, 0, 1.5);
    } else if (stage === 2) {
      // Aşama 2: Kaynaklı motor/robot şasisi (parlak mavi detaylar)
      g.fillStyle(0x34495e, 1);
      g.fillRoundedRect(-12, -8, 24, 16, 4);
      g.fillStyle(0x48cae4, 0.9);
      g.fillRect(-8, -4, 16, 8);
      g.fillStyle(0x0077b6, 1);
      g.fillCircle(0, 0, 2.5);
    } else {
      // Aşama 3: Yüksek teknoloji paketlenmiş ürün (mor / altın koli)
      g.fillStyle(0x9b5de5, 1);
      g.fillRoundedRect(-13, -11, 26, 22, 5);
      g.fillStyle(0xf15bb5, 0.8);
      g.fillRect(-10, -8, 20, 4);
      // Altın mühür
      g.fillStyle(0xffd166, 1);
      g.fillCircle(0, 2, 3);
    }
  }

  private deliverProduct(p: VisualProduct): void {
    // Sevkiyat sandığını sars
    this.scene.tweens.add({
      targets: this.shippingContainer,
      scaleX: 1.15, scaleY: 0.85,
      duration: 70, yoyo: true,
      ease: 'Back.easeOut',
    });

    const crateX = this.viewX + this.beltEndX + 20;
    const crateY = this.viewY + this.beltY;

    // Sevkiyat kıvılcımları/konfetisi
    for (let i = 0; i < 5; i++) {
      const angle = Phaser.Math.FloatBetween(-Math.PI * 0.9, -Math.PI * 0.1);
      const dist = Phaser.Math.Between(20, 35);
      const spark = this.scene.add.circle(crateX, crateY, 2.5, 0xf4a261, 1).setDepth(70);
      this.scene.tweens.add({
        targets: spark,
        x: crateX + Math.cos(angle) * dist,
        y: crateY + Math.sin(angle) * dist,
        alpha: 0, scale: 0.2,
        duration: 350, ease: 'Quad.easeOut',
        onComplete: () => spark.destroy(),
      });
    }

    // Callback ile HUD'a doğru parçacık ve ses/sayım sinyali yolla
    this.onProductDelivered(p.value, crateX, crateY);
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

    // Tıklama alanını tüm fabrika tabanına yay
    this.clickZone.setPosition(w / 2, h / 2);
    this.clickZone.setSize(w, h);

    // Çevre & Zemin
    this.drawFactoryBackground(w, h, sf);

    // Bant Koordinatları (Fabrika dikey ekseninin alt 1/3'ünde)
    this.beltY = Math.round(h * 0.68);
    const intakeW = Math.round(58 * sf);
    const shippingW = Math.round(65 * sf);

    this.beltStartX = intakeW + 5;
    this.beltEndX = w - shippingW - 5;

    // Hammadde Girişi (Sol)
    this.layoutIntake(intakeW, sf);

    // Sevkiyat İstasyonu (Sağ)
    this.layoutShipping(w - shippingW / 2 - 5, sf);

    // 4 Makine Bay'i (Bant boyunca eşit aralıklı)
    const availableW = this.beltEndX - this.beltStartX;
    const bayW = Math.round(availableW / MACHINES.length);

    for (let i = 0; i < MACHINES.length; i++) {
      const bayX = this.beltStartX + bayW * (i + 0.5);
      const bayY = this.beltY - Math.round(45 * sf);
      this.layoutMachineBay(this.machineBays[i], bayX, bayY, bayW, sf);
    }

    // Konveyör bandı
    this.drawConveyorBelt();
  }

  private drawFactoryBackground(w: number, h: number, sf: number): void {
    const bg = this.bgGfx;
    bg.clear();

    // Fabrika içi koyu metalik zemin gradyanı
    bg.fillStyle(0x101322, 1);
    bg.fillRect(0, 0, w, h);

    // Çatı makasları ve arka plan pencereleri
    bg.fillStyle(0x191e36, 0.6);
    const winCount = 4;
    const winW = (w - 40 * sf) / winCount;
    for (let i = 0; i < winCount; i++) {
      bg.fillRect(20 * sf + i * winW + 8 * sf, 15 * sf, winW - 16 * sf, 50 * sf);
    }

    // Çelik kirişler (tavan konstrüksiyonu)
    bg.lineStyle(2, 0x273152, 0.7);
    bg.lineBetween(0, 15 * sf, w, 15 * sf);
    bg.lineBetween(0, 65 * sf, w, 65 * sf);
    for (let x = 0; x < w; x += 60 * sf) {
      bg.lineBetween(x, 15 * sf, x + 30 * sf, 65 * sf);
      bg.lineBetween(x + 30 * sf, 65 * sf, x + 60 * sf, 15 * sf);
    }

    // Fabrika zemini (tartan/beton karo)
    const floorY = Math.round(h * 0.76);
    bg.fillStyle(0x0e111d, 1);
    bg.fillRect(0, floorY, w, h - floorY);
    bg.lineStyle(2, 0x2e3856, 0.8);
    bg.lineBetween(0, floorY, w, floorY);

    // Sarı-siyah uyarı çizgileri (güvenlik şeridi)
    const stripeH = 5 * sf;
    bg.fillStyle(0x222233, 1);
    bg.fillRect(0, floorY, w, stripeH);
    bg.fillStyle(0xf1c40f, 0.7);
    for (let x = -20; x < w; x += 16 * sf) {
      bg.beginPath();
      bg.moveTo(x, floorY + stripeH);
      bg.lineTo(x + 8 * sf, floorY);
      bg.lineTo(x + 14 * sf, floorY);
      bg.lineTo(x + 6 * sf, floorY + stripeH);
      bg.closePath();
      bg.fillPath();
    }

    // Fabrika yapısı (ön katman gölgeleri)
    const st = this.factoryStructureGfx;
    st.clear();
    st.lineStyle(1, 0x2e3856, 0.4);
    st.strokeRect(1, 1, w - 2, h - 2);
  }

  private layoutIntake(intakeW: number, sf: number): void {
    this.intakeContainer.setPosition(intakeW / 2 + 2, this.beltY - 15 * sf);
    const g = this.intakeGfx;
    g.clear();

    const w = 46 * sf;
    const h = 75 * sf;

    // Silo gövdesi (bunker)
    g.fillStyle(0x2c3e50, 1);
    g.beginPath();
    g.moveTo(-w / 2, -h / 2);
    g.lineTo(w / 2, -h / 2);
    g.lineTo(w / 4, h / 2 - 10 * sf);
    g.lineTo(w / 4, h / 2);
    g.lineTo(-w / 4, h / 2);
    g.lineTo(-w / 4, h / 2 - 10 * sf);
    g.closePath();
    g.fillPath();

    g.lineStyle(1.5, 0x4ecdc4, 0.8);
    g.strokePath();

    // Bunker ağzı ızgara
    g.fillStyle(0x1a252f, 1);
    g.fillRect(-w / 2 + 4, -h / 2 + 3, w - 8, 8 * sf);

    // Yeşil durum LED'i
    g.fillStyle(0x2ecc71, 1);
    g.fillCircle(0, -h / 2 + 16 * sf, 3.5 * sf);

    this.intakeLabel.setPosition(0, -h / 2 - 12 * sf);
    this.intakeLabel.setFontSize(`${Math.max(9, Math.round(9 * sf))}px`);
  }

  private layoutShipping(shippingX: number, sf: number): void {
    this.shippingContainer.setPosition(shippingX, this.beltY - 10 * sf);
    const g = this.shippingCrateGfx;
    g.clear();

    const w = 52 * sf;
    const h = 60 * sf;

    // Palet
    g.fillStyle(0x785338, 1);
    g.fillRect(-w / 2, h / 2 - 8 * sf, w, 8 * sf);
    g.fillStyle(0x4a3222, 1);
    g.fillRect(-w / 2 + 6 * sf, h / 2 - 8 * sf, 8 * sf, 8 * sf);
    g.fillRect(w / 2 - 14 * sf, h / 2 - 8 * sf, 8 * sf, 8 * sf);

    // Ahşap / metal sevkiyat sandığı
    g.fillStyle(0xd35400, 1);
    g.fillRect(-w / 2 + 3, -h / 2 + 4, w - 6, h - 12 * sf);
    g.lineStyle(1.5, 0xf39c12, 0.9);
    g.strokeRect(-w / 2 + 3, -h / 2 + 4, w - 6, h - 12 * sf);

    // Sandık takviye şeritleri (X çizgisi)
    g.lineStyle(1, 0x963c00, 0.8);
    g.lineBetween(-w / 2 + 3, -h / 2 + 4, w / 2 - 3, h / 2 - 8 * sf);
    g.lineBetween(w / 2 - 3, -h / 2 + 4, -w / 2 + 3, h / 2 - 8 * sf);

    // Kırmızı koli bandı / sevkiyat etiketi
    g.fillStyle(0xffffff, 0.9);
    g.fillRect(-w / 4, -h / 4, w / 2, 10 * sf);

    this.shippingText.setPosition(0, -h / 2 - 10 * sf);
    this.shippingText.setFontSize(`${Math.max(9, Math.round(9 * sf))}px`);
  }

  private drawConveyorBelt(): void {
    const g = this.beltGfx;
    g.clear();

    const startX = this.beltStartX;
    const endX = this.beltEndX;
    const y = this.beltY;
    const beltH = 14;

    // Taşıma bandı destek ayakları
    g.fillStyle(0x1e272e, 1);
    const legGap = 70;
    for (let lx = startX + 25; lx < endX; lx += legGap) {
      g.fillRect(lx - 3, y + beltH, 6, 25);
      g.fillRect(lx - 8, y + beltH + 22, 16, 4);
    }

    // Bant ana gövdesi (koyu kauçuk)
    g.fillStyle(0x1e272e, 1);
    g.fillRect(startX, y, endX - startX, beltH);
    g.lineStyle(1.5, 0x485460, 0.9);
    g.strokeRect(startX, y, endX - startX, beltH);

    // Kayar dişler / merdaneler (hareket efekti)
    g.fillStyle(0x485460, 0.7);
    const spacing = 16;
    for (let x = startX + (this.beltScrollOffset % spacing); x < endX; x += spacing) {
      g.fillRect(x, y + 2, 4, beltH - 4);
    }

    // Bant yan tekerlekleri
    g.fillStyle(0x808e9b, 1);
    g.fillCircle(startX + 4, y + beltH / 2, 5);
    g.fillCircle(endX - 4, y + beltH / 2, 5);
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
    bay.height = Math.round(90 * sf);
    bay.container.setPosition(x, y);

    const def = MACHINES[bay.index];
    const state = this.economy.getMachineState(bay.index);
    const isUnlocked = this.economy.isUnlocked(bay.index);
    const isOwned = state.level > 0;

    // İsim etiketi
    bay.nameLabel.setText(def.name);
    bay.nameLabel.setPosition(0, -bay.height / 2 - 8 * sf);
    bay.nameLabel.setFontSize(`${Math.max(9, Math.round(10.5 * sf))}px`);
    bay.nameLabel.setColor(isOwned ? '#ffffff' : '#7f8c8d');

    // Seviye rozeti
    if (isOwned) {
      bay.levelBadge.setText(`Sv. ${state.level}`);
      bay.levelBadge.setPosition(0, -bay.height / 2 + 8 * sf);
      bay.levelBadge.setFontSize(`${Math.max(8, Math.round(9.5 * sf))}px`);
      bay.levelBadge.setVisible(true);
    } else {
      bay.levelBadge.setVisible(false);
    }

    // Sabit makine gövdesi çizimi
    this.drawBayBase(bay, def, state.level, isUnlocked, sf);

    // Hareketli parçalar ilk kare çizimi
    this.drawBayMovingParts(bay, 0);
  }

  private drawBayBase(
    bay: MachineVisualBay,
    def: MachineDefinition,
    level: number,
    unlocked: boolean,
    sf: number,
  ): void {
    const g = bay.baseGfx;
    g.clear();

    const bw = Math.min(bay.width - 12 * sf, 75 * sf);
    const bh = bay.height;
    const isOwned = level > 0;

    if (!unlocked) {
      // Kilitli alan silueti
      g.lineStyle(1, 0x2e3856, 0.4);
      g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
      g.fillStyle(0x131322, 0.5);
      g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
      return;
    }

    if (!isOwned) {
      // Açılmış ama satın alınmamış boş kurulum platformu
      g.lineStyle(1.5, def.color, 0.6);
      g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
      g.fillStyle(0x181c2e, 0.7);
      g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 6);
      // Hazır platform şeridi
      g.fillStyle(def.color, 0.2);
      g.fillRect(-bw / 2 + 4, bh / 2 - 12 * sf, bw - 8, 8 * sf);
      return;
    }

    // --- Satın Alınmış Aktif Makine Gövdesi ---
    // 1. Ağır Çelik Kaide / Şasi
    g.fillStyle(0x1e272e, 1);
    g.fillRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);
    g.lineStyle(2, def.color, 0.85);
    g.strokeRoundedRect(-bw / 2, -bh / 2, bw, bh, 8);

    // 2. Makine Rengi Panel Vurgusu
    g.fillStyle(def.color, 0.25);
    g.fillRoundedRect(-bw / 2 + 4, -bh / 2 + 18 * sf, bw - 8, bh - 32 * sf, 4);

    // 3. Makineye Özel Gövde Detayları
    if (bay.index === 0) {
      // Montaj Tezgahı: Yan mengene ve tezgâh tablası
      g.fillStyle(0x485460, 1);
      g.fillRect(-bw / 2 + 6, bh / 2 - 16 * sf, bw - 12, 12 * sf);
      g.fillStyle(0x00d2d3, 0.8);
      g.fillRect(-bw / 4, -bh / 4, bw / 2, 8 * sf);
    } else if (bay.index === 1) {
      // Pres Makinesi: Hidrolik çift kolon
      g.fillStyle(0x718093, 1);
      g.fillRect(-bw / 2 + 6, -bh / 2 + 10, 8 * sf, bh - 24);
      g.fillRect(bw / 2 - 6 - 8 * sf, -bh / 2 + 10, 8 * sf, bh - 24);
      // Basınç göstergesi
      g.fillStyle(0xffffff, 0.9);
      g.fillCircle(0, -bh / 2 + 25 * sf, 7 * sf);
      g.fillStyle(0xe84118, 1);
      g.fillCircle(0, -bh / 2 + 25 * sf, 2.5 * sf);
    } else if (bay.index === 2) {
      // Kaynak Robotu: Taban döner mafsalı ve kablo kanalı
      g.fillStyle(0x2f3640, 1);
      g.fillCircle(0, bh / 2 - 14 * sf, 14 * sf);
      g.lineStyle(2, 0x00a8ff, 0.7);
      g.strokeCircle(0, bh / 2 - 14 * sf, 14 * sf);
    } else {
      // Otomasyon Hattı: Yüksek teknoloji lazer kulesi ve koruma camı
      g.fillStyle(0x8c7ae6, 0.3);
      g.fillRect(-bw / 2 + 8, -bh / 4, bw - 16, bh / 2 - 8);
      g.lineStyle(1, 0x9c88ff, 0.9);
      g.strokeRect(-bw / 2 + 8, -bh / 4, bw - 16, bh / 2 - 8);
    }

    // Seviye Gösterge Işıkları (Level 5, 10, 25 için ek neon lambalar)
    if (level >= 10) {
      g.fillStyle(0xffd32a, 1);
      g.fillCircle(bw / 2 - 8 * sf, -bh / 2 + 8 * sf, 3 * sf);
    }
  }

  private drawBayMovingParts(bay: MachineVisualBay, phase: number): void {
    const g = bay.movingPartGfx;
    g.clear();

    const state = this.economy.getMachineState(bay.index);
    if (state.level === 0) return;

    const bh = bay.height;
    const def = MACHINES[bay.index];

    if (bay.index === 0) {
      // Montaj Tezgahı: Dikey inip kalkan montaj çekici / robotik kıskaç
      const drop = Math.max(0, phase) * 12;
      g.fillStyle(0x718093, 1);
      g.fillRect(-4, -bh / 4 + drop, 8, 20);
      g.fillStyle(def.color, 1);
      g.fillRect(-8, -bh / 4 + 18 + drop, 16, 6);
    } else if (bay.index === 1) {
      // Pres Makinesi: Ağır hidrolik baskı bloğu
      const pressDrop = Math.max(0, phase) * 16;
      g.fillStyle(0xdcdde1, 1);
      g.fillRect(-16, -bh / 4 + pressDrop, 32, 14);
      g.fillStyle(0xe84118, 0.8);
      g.fillRect(-12, -bh / 4 + 12 + pressDrop, 24, 3);
    } else if (bay.index === 2) {
      // Kaynak Robotu: Açı değiştiren robotik kol ve kaynak ucu
      const angle = phase * 0.35;
      const armLen = 22;
      const x1 = Math.sin(angle) * armLen;
      const y1 = bh / 2 - 14 - Math.cos(angle) * armLen;

      g.lineStyle(4, 0x718093, 1);
      g.lineBetween(0, bh / 2 - 14, x1, y1);
      g.fillStyle(def.accentColor, 1);
      g.fillCircle(x1, y1, 4);

      // Kaynak başlığı
      const x2 = x1 + Math.sin(angle * 1.5) * 14;
      const y2 = y1 + Math.cos(angle * 1.5) * 14;
      g.lineStyle(3, 0x00a8ff, 1);
      g.lineBetween(x1, y1, x2, y2);
      g.fillStyle(0x00d2d3, 1);
      g.fillCircle(x2, y2, 2.5);
    } else {
      // Otomasyon Hattı: Sağa-sola taranan yeşil/mor lazer çizgisi
      const scanX = phase * 18;
      g.lineStyle(2, 0x00d2d3, 0.9);
      g.lineBetween(scanX, -bh / 4 + 4, scanX, bh / 4 - 8);
      g.fillStyle(0x00d2d3, 0.4);
      g.fillCircle(scanX, 0, 5);
    }
  }

  private updateMachineAnimations(dt: number): void {
    for (const bay of this.machineBays) {
      if (bay.isOperating) {
        bay.animTimer += dt * 15;
        this.drawBayMovingParts(bay, Math.sin(bay.animTimer));
      }
    }
  }
}
