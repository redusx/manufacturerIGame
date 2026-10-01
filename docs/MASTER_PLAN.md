# MASTER_PLAN.md — Manufacturer İncremental Geliştirme Planı

> **Bu dosya, Manufacturer projesinin ana uygulama yol haritasıdır.**
> Oyun vizyonu: "İncremental / Progression-Focused Factory Game" (Kalıcı Fabrika + Kademeli Genişleme + Roket Döngüsü).
> Her görev küçük, bağımsız, test edilebilir ve dokümante edilen bir adımdır.

---

## FAZ 1: SAF SİMÜLASYON MOTORU (CORE DATA & SIMULATION)
*Amaç: Phaser'dan tamamen bağımsız, saniyede binlerce tick koşabilen, %100 test edilebilir saf TypeScript fabrika çekirdeği.*

### Sistem 1.1: Veri Modeli ve Kayıt Defterleri (Data Models & Registries)
* [x] **TASK-000:** Proje mimari analizi, dokümantasyon ağacının kurulması, açık tasarım sorularının belirlenmesi.
* [x] **TASK-001:** Test altyapısının kurulması (Node 24 native `--experimental-strip-types --test`, 0 dış bağımlılık).
* [x] **TASK-010:** `src/factory/types.ts` — Temel arayüzlerin (Item, Recipe, MachineDef, GridCoord, Direction, Port) tanımlanması ve testi.
* [x] **TASK-011:** `src/factory/simulation/ItemRegistry.ts` — 5 kademeli 21 adet eşya kataloğu ve birim testi.
* [x] **TASK-012:** `src/factory/simulation/RecipeRegistry.ts` — 6 makine kategorisinde 17 adet reçete tanımı ve birim testi.
* [x] **TASK-013:** `src/factory/simulation/MachineRegistry.ts` — 6 makine tanımı, port geometrisi, CW rotasyon matematiği ve birim testi.

### Sistem 1.2: Mekânsal Izgara ve Lojistik Motoru (Spatial Grid & Logistics Network)
* [x] **TASK-020:** `src/factory/simulation/GridMap.ts` — $N \times M$ ızgara yapısı, engel/giriş/çıkış hücreleri, makine yerleşim denetimleri ve testi.
* [x] **TASK-021:** `src/factory/simulation/ConveyorBelt.ts` — 2 slotlu kesikli eşya ilerlemesi, mesafe koruması, backpressure duruşu ve testi.
* [x] **TASK-022:** `src/factory/simulation/LogisticsNetwork.ts` — Banttan banta eşya aktarımı, INTAKE beslemesi, EXPORT teslimatları ve testi.
* [x] **TASK-023:** `src/factory/simulation/SplitterMerger.ts` — 50/50 dönüşümlü Splitter ve adil Merger lojistik entegrasyonu ve testi.

### Sistem 1.3: Makine Üretim Motoru (Machine Production Engine)
* [x] **TASK-030:** `src/factory/simulation/MachineEntity.ts` — Makine çalışma zamanı nesnesi, yönelimle transpoze olan ızgara ayak izi, dinamik portlar, kapasite kısıtlı girdi/çıktı tamponları ve testi.
* [x] **TASK-031:** `src/factory/simulation/ProductionEngine.ts` — Tick tabanlı üretim çevrimi: girdi tüketimi, süre sayacı, çıktı üretimi, durum makinesi (`WAITING_INPUT`, `PROCESSING`, `BLOCKED_OUTPUT`, `IDLE`).
* [x] **TASK-032:** Entegrasyon Testi: Girdi Portu $\rightarrow$ Bant $\rightarrow$ Kırıcı $\rightarrow$ Bant $\rightarrow$ Fırın $\rightarrow$ Bant $\rightarrow$ Çıkış Portu tam zincir akış testi.

### Sistem 1.4: İncremental Ekonomi ve Kayıt Serileştirme (Economy & Serialization)
* [x] **TASK-040:** `src/factory/simulation/FactoryEconomy.ts` — İncremental ekonomi motoru: eşya ihracat değeri hesaplama, tıklama geliri formülü, makine seviye yükseltme maliyeti ($Base \times 1.15^{lvl}$), parsel açma maliyetleri ve bakiye takibi.
* [x] **TASK-041:** `src/factory/simulation/FactorySerializer.ts` — Fabrika durumunun saf JSON'a serileştirilmesi ve sıfır kayıpla geri yüklenmesi testi (Faz 1 Tamamlandı).

---

## FAZ 2: PHASER 3 2D IZGARA VE GÖRSELLEŞTİRME (PRESENTATION LAYER)
*Amaç: Saf simülasyonu Phaser ekranında 60 FPS akıcı piksel grafiklerle görselleştirmek.*

### Sistem 2.1: Zemin, Izgara ve Genişleme Parselleri
* [x] **TASK-050:** `src/factory/view/GridView.ts` — $32 \times 32$ piksel karo zemin dokusu, aktif parsel sınırları ve kilitli genişleme parsellerinin render edilmesi.
* [x] **TASK-051:** Kamera kontrolleri: Fabrika katında yumuşak kaydırma (pan) ve yakınlaştırma (zoom) desteği.

### Sistem 2.2: Lojistik ve Eşya Akışı Görselleştirmesi (Sprite Pooling)
* [x] **TASK-060:** `src/factory/view/ConveyorGeometry.ts` & `ConveyorRenderer.ts` — Yönlü konveyör döşemeleri, 90° virajlar/dönemeçler, Splitter/Merger görselleştirmesi, Bézier eğri kontrol noktaları ve `conveyor_belt.png` ile animasyonlu kesintisiz kayan doku.
* [x] **TASK-061:** `src/factory/view/SpritePoolCore.ts` & `ItemSpritePool.ts` — Bant üzerindeki eşyaları çizen yüksek performanslı sprite havuzu (GC optimizasyonu, doku/tint eşlemesi, tamsayı piksel hizalaması).
* [x] **TASK-062:** `src/factory/view/ItemFlowTracker.ts` & `ItemFlowAnimator.ts` — Bant üzerindeki eşyaların simülasyon koordinatlarına göre 60 FPS sıfır bellek tahsisli pürüzsüz enterpolasyonla kaydırılması (Sistem 2.2 %100 Tamamlandı).

### Sistem 2.3: Makine Görselleri ve Durum İkonları
* [x] **TASK-070:** `src/factory/view/MachineVisualGeometry.ts` & `MachineRenderer.ts` — Makine gövde sprite'ları, çalışan hareketli parça animasyonları, giriş/çıkış port okları ve seviye rozetleri.
* [x] **TASK-071:** `src/factory/view/MachineStatusHelper.ts` & `MachineStatusIndicator.ts` — Makine durum göstergeleri: Girdi bekliyor ikazı (sarı), Çıkış tıkalı ikazı (kırmızı), Normal çalışma kıvılcım partikülleri (FAZ 2 %100 TAMAMLANDI).

---

## FAZ 3: İNCREMENTAL ETKİLEŞİM VE İNŞA UX (INTERACTION & TOOLS)
*Amaç: Oyuncunun fabrikayı zahmetsizce yönetmesi, tıklaması ve akıllı araçlarla inşa etmesi.*

### Sistem 3.1: Kısa Döngü Etkileşimi (Click & Collect)
* [x] **TASK-080:** `src/factory/input/ClickCollectController.ts` & `ClickCollectMath.ts` — Giriş silolarına ve bantlardaki eşyalara tıklayarak anında kaynak/para toplama (Short loop tatmini, combo serileri, yüzen kazanç metinleri ve anti-spam; Sistem 3.1 Tamamlandı).

### Sistem 3.2: Akıllı İnşa ve Düzenleme Araçları
* [x] **TASK-081:** `src/factory/input/PlacementController.ts` & `PlacementMath.ts` — Makine seçimi, yeşil/kırmızı hayalet önizleme (ghost preview), ızgara kenetlenmesi, $R$ ile 90° döndürme, port okları ve inşa validasyonu.
* [x] **TASK-082:** `src/factory/input/SmartBeltTool.ts` & `SmartBeltPathfinder.ts` — Makine A $\rightarrow$ Makine B akıllı sürükle-bırak konveyör bağlantı aracı (A* yol bulucu, viraj cezalı L-dönüşleri, engel etrafından dolaşma ve canlı önizleme).
* [x] **TASK-090:** `src/factory/input/DemolishTool.ts` & `DemolishMath.ts` — Yıkım ve Taşıma Aracı: Tıklanan makine veya bandı silme, tüm yatırımı cüzdana %100 iade etme (DEC-007).
* [x] **TASK-091:** `src/factory/view/MachineInspectorModal.ts` & `MachineInspectorHelper.ts` — Makine İnceleme ve Yükseltme Modalı (Inspector Modal): Makinenin girdi/çıktı stoğunu, aktif reçetesini ve seviye yükseltme butonunu gösterme (FAZ 3 %100 TAMAMLANDI).

---

## FAZ 4: FABRİKA GENİŞLEME MOTORU VE KİLOMETRE TAŞLARI (PROGRESSION)
*Amaç: Oyuncunun tek fabrikasını adım adım büyüterek 10 aşamalı müfredatı tamamlaması.*

### Sistem 4.1: Kilometre Taşları ve Hedef Motoru
* [x] **TASK-100:** `src/factory/progression/MilestoneManager.ts` — 10 aşamalı fabrika kilometre taşlarının takibi, aktif hedefin kontrolü ve ödül dağıtımı (`MilestoneManager.test.ts` ile test edildi).
* [ ] **TASK-101:** `src/factory/view/MilestoneHUD.ts` — Ekranın üst kısmında aktif hedefi, ilerleme yüzdesini ve ödülünü gösteren animasyonlu HUD barı.

### Sistem 4.2: Kademeli Parsel Genişletmesi
* [ ] **TASK-102:** `src/factory/progression/PlotExpansionManager.ts` — Kalıcı fabrika ızgarasının yeni parsellerle ($8 \times 8 \rightarrow 12 \times 8 \rightarrow 16 \times 12 \rightarrow 24 \times 24$) genişletilmesi ve kilit açılma animasyonu.
* [ ] **TASK-103:** Hızlı Yan Siparişler (Quick Contracts): Oyuncuya süre baskısıyla ekstra nakit kazandıran dinamik mini sipariş sistemi.

---

## FAZ 5: ROKET HANGARI, FIRLATMA VE UZUN VADELİ İLERLEME DÖNGÜSÜ (ROCKET LOOP)
*Amaç: Fabrikayı roket fırlatma döngüsüyle kenetleyerek nihai ilerleme amacını tamamlamak.*

### Sistem 5.1: Hangar Tedarik Köprüsü ve Montaj
* [ ] **TASK-110:** `src/factory/simulation/RocketHangarBridge.ts` — Fabrika konveyöründen çıkan havacılık parçalarının (Gövde Paneli, Roket Motoru, Aviyonik, Yakıt) doğrudan Roket Hangarına aktarılması.
* [ ] **TASK-111:** `src/ui/RocketHangarView.ts` modülünün üretilen fiziksel parçalarla roket modüllerini inşa edecek şekilde güncellenmesi.

### Sistem 5.2: Fırlatma Sahnesi ve İlerleme Entegrasyonu
* [ ] **TASK-112:** `FlightScene.ts` uçuş sahnesi entegrasyonu: Uçuş mesafesi ve toplanan uzay hurdalarının nakde dönüştürülmesi ve yeni fabrika yetenekleri/alanlarını açması.
* [ ] **TASK-113:** Tam Döngü Entegrasyon Testi: Fabrika Üretimi $\rightarrow$ Roket Montajı $\rightarrow$ Fırlatma $\rightarrow$ Yeni Parsel Açılışı.

---

## FAZ 6: CİLA, KALICI KAYIT VE CRAZYGAMES LANSMANI (POLISH & LAUNCH)
*Amaç: Oyunu pürüzsüz, kaydedilebilir ve yayınlanabilir hale getirmek.*

* [ ] **TASK-120:** `src/factory/persistence/SaveManager.ts` — LocalStorage tabanlı otomatik kayıt ve sıfır kayıpla yükleme.
* [ ] **TASK-121:** Çevrimdışı Gelir (Offline Earnings): Oyuncu oyunda yokken 4 saate kadar %50 verimle temel gelir birikimi.
* [ ] **TASK-122:** Piksel parçacık animasyonları ve ses efektleri entegrasyonu.
* [ ] **TASK-123:** CrazyGames SDK hazırlığı ve nihai üretim build doğrulaması.
