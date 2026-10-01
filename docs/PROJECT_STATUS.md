# PROJECT_STATUS.md — Manufacturer Proje Durumu

> **ÖNEMLİ KURAL:** Her yeni oturum/context açılışında İLK okunacak dosyadır.
> Her tamamlanan görevden sonra bu dosya güncellenmelidir.

---

* **Current Phase:** Phase 4: Fabrika Genişleme Motoru ve Kilometre Taşları (Progression)
* **Current Task:** TASK-100 Tamamlandı (`MilestoneManager.ts` 10 aşamalı fabrika müfredatı, hedef takibi ve ödül dağıtımı)
* **Task Status:** COMPLETED
* **Completed Tasks:**
  - [x] TASK-000: Proje mimari analizi, dokümantasyon ağacının kurulması, açık tasarım sorularının belirlenmesi.
  - [x] TASK-001: Test altyapısının kurulması (Node 24 native `--experimental-strip-types --test` koşucusu, `npm test` scripti, 0 dış bağımlılık).
  - [x] TASK-010: `src/factory/types.ts` — Temel arayüzlerin (Item, Recipe, MachineDef, GridCoord, Direction, Port) tanımlanması ve `types.test.ts` ile doğrulanması.
  - [x] TASK-011: `src/factory/simulation/ItemRegistry.ts` — 5 kademeli (Tier 0..4) hammadde, ara ürün, bileşen ve havacılık ürünleri kataloğunun oluşturulması ve `ItemRegistry.test.ts` ile doğrulanması.
  - [x] TASK-012: `src/factory/simulation/RecipeRegistry.ts` — 6 makine kategorisinde 17 adet reçetenin tanımlanması, eşya referans doğrulaması ve `RecipeRegistry.test.ts` ile test edilmesi.
  - [x] TASK-013: `src/factory/simulation/MachineRegistry.ts` — 6 makinenin boyutları, fiziksel portları, rotasyon matematiği (`getRotatedPort`) ve `MachineRegistry.test.ts` ile doğrulanması.
  - [x] TASK-020: `src/factory/simulation/GridMap.ts` — $N \times M$ hücresel ızgara yapısı, engel/giriş/çıkış hücreleri, tek hücreli konveyör ve çok hücreli makine yerleşim denetimleri ve `GridMap.test.ts` ile doğrulanması.
  - [x] TASK-021: `src/factory/simulation/ConveyorBelt.ts` — 2 slotlu kesikli eşya ilerlemesi, bant içi mesafe koruması, geri tepme (backpressure) duruşu ve `ConveyorBelt.test.ts` ile doğrulanması.
  - [x] TASK-022: `src/factory/simulation/LogisticsNetwork.ts` — Banttan banta eşya aktarımı, 90 derece köşe dönüşleri, INTAKE beslemesi, EXPORT teslimatları ve `LogisticsNetwork.test.ts` ile doğrulanması.
  - [x] TASK-023: `src/factory/simulation/SplitterMerger.ts` — Splitter (50/50 dönüşümlü yük dengeleme + taşma baypası) ve Merger (2 girişten 1 çıkışa adil öncelikli birleştirme), `LogisticsNetwork` tam entegrasyonu ve `SplitterMerger.test.ts` ile doğrulanması.
  - [x] TASK-030: `src/factory/simulation/MachineEntity.ts` — Makine çalışma zamanı nesnesi, yönelimle transpoze olan ızgara ayak izi, dinamik dünya portları, kapasite denetimli girdi/çıktı tamponları, serileştirme ve `MachineEntity.test.ts` ile doğrulanması.
  - [x] TASK-031: `src/factory/simulation/ProductionEngine.ts` — Tick tabanlı üretim çevrimi: girdi tüketimi, süre sayacı, çıktı üretimi, durum makinesi (`WAITING_INPUT`, `PROCESSING`, `BLOCKED_OUTPUT`, `IDLE`), komşu banttan çekme/tahliye, yükseltme hız çarpanı ve `ProductionEngine.test.ts` ile doğrulanması.
  - [x] TASK-032: `src/factory/simulation/SimulationIntegration.test.ts` — Tam hat uçtan uca akış: INTAKE $\rightarrow$ Bant $\rightarrow$ Kırıcı $\rightarrow$ Bant $\rightarrow$ Fırın $\rightarrow$ Bant $\rightarrow$ EXPORT teslimatı ve darboğaz çözümü testi.
  - [x] TASK-040: `src/factory/simulation/FactoryEconomy.ts` — İncremental ekonomi motoru: eşya ihracat değeri hesaplama, tıklama geliri formülü, makine seviye yükseltme maliyeti ($Base \times 1.15^{lvl}$), parsel açma maliyetleri, bakiye takibi ve `FactoryEconomy.test.ts` ile doğrulanması.
  - [x] TASK-041: `src/factory/simulation/FactorySerializer.ts` — Fabrika durumunun saf JSON'a serileştirilmesi ve sıfır kayıpla geri yüklenmesi testi ve `FactorySerializer.test.ts` ile doğrulanması (FAZ 1 %100 TAMAMLANDI).
  - [x] TASK-050: `src/factory/view/GridView.ts` — Kalıcı 8x8 başlangıç ızgarası zemin karoları, 32x32 hücre çizgileri ve kilitli genişleme parsellerinin Phaser 3 render'ı (`GridView.test.ts` ile test edildi).
  - [x] TASK-051: `src/factory/view/CameraController.ts` — Fabrika katı kamera kontrolleri: pan/sürükleme, odaklı tekerlek zoom'u, WASD/yön tuşları ve sınır clamping (`CameraMath.test.ts` ile test edildi).
  - [x] TASK-060: `src/factory/view/ConveyorGeometry.ts` & `ConveyorRenderer.ts` — Yönlü konveyör döşemeleri, 90° virajlar/dönemeçler, Splitter/Merger görselleştirmesi, Bézier eğri kontrol noktaları ve `conveyor_belt.png` ile animasyonlu kesintisiz kayan doku (`ConveyorGeometry.test.ts` ile test edildi).
  - [x] TASK-061: `src/factory/view/SpritePoolCore.ts` & `ItemSpritePool.ts` — Bant üzerindeki eşyaları çizen yüksek performanslı sprite havuzu (GC optimizasyonu, doku/tint eşlemesi, tamsayı piksel hizalaması, `SpritePoolCore.test.ts` ile test edildi).
  - [x] TASK-062: `src/factory/view/ItemFlowTracker.ts` & `ItemFlowAnimator.ts` — Bant üzerindeki eşyaların simülasyon koordinatlarına göre 60 FPS sıfır bellek tahsisli pürüzsüz enterpolasyonla kaydırılması (`ItemFlowTracker.test.ts` ile test edildi).
  - [x] TASK-070: `src/factory/view/MachineVisualGeometry.ts` & `MachineRenderer.ts` — Makine gövde sprite'ları, hareketli parça animasyonu, port okları ve seviye rozetleri (`MachineVisualGeometry.test.ts` ile test edildi).
  - [x] TASK-071: `src/factory/view/MachineStatusHelper.ts` & `MachineStatusIndicator.ts` — Makine durum göstergeleri: Girdi bekliyor ikazı (sarı), Çıkış tıkalı ikazı (kırmızı), Normal çalışma partikülleri (`MachineStatusHelper.test.ts` ile test edildi, FAZ 2 %100 TAMAMLANDI).
  - [x] TASK-080: `src/factory/input/ClickCollectController.ts` & `ClickCollectMath.ts` — Giriş silolarına ve bantlardaki eşyalara tıklayarak anında kaynak/para toplama (Short loop tatmini, combo serileri, yüzen kazanç metinleri ve anti-spam; `ClickCollectMath.test.ts` ile test edildi).
  - [x] TASK-081: `src/factory/input/PlacementController.ts` & `PlacementMath.ts` — Makine seçimi, yeşil/kırmızı hayalet önizleme (ghost preview), ızgara kenetlenmesi, $R$ ile 90° döndürme, port okları ve inşa validasyonu (`PlacementMath.test.ts` ile test edildi).
  - [x] TASK-082: `src/factory/input/SmartBeltTool.ts` & `SmartBeltPathfinder.ts` — Makine A $\rightarrow$ Makine B akıllı sürükle-bırak konveyör bağlantı aracı (A* yol bulucu, viraj cezalı L-dönüşleri, engel etrafından dolaşma, canlı önizleme ve Makine A -> Makine B otomatik bağlantısı; `SmartBeltPathfinder.test.ts` ile test edildi).
  - [x] TASK-090: `src/factory/input/DemolishTool.ts` & `DemolishMath.ts` — Yıkım ve Taşıma Aracı: Tıklanan makine veya bandı silme, tüm yatırımı cüzdana %100 iade etme (`DemolishMath.test.ts` ile test edildi).
  - [x] TASK-091: `src/factory/view/MachineInspectorModal.ts` & `MachineInspectorHelper.ts` — Makine İnceleme ve Yükseltme Modalı: Girdi/çıktı tampon stoğu, aktif reçete seçimi, seviye yükseltme ($Base \times 1.15^{lvl}$) ve stat diff görünümü (`MachineInspectorHelper.test.ts` ile test edildi, FAZ 3 %100 TAMAMLANDI).
  - [x] TASK-100: `src/factory/progression/MilestoneManager.ts` — 10 aşamalı fabrika kilometre taşlarının takibi, aktif hedefin kontrolü ve ödül dağıtımı (`MilestoneManager.test.ts` ile test edildi).
* **Next Task:** FAZ 4 — Sistem 4.1: TASK-101: `src/factory/view/MilestoneHUD.ts` — Ekranın üst kısmında aktif hedefi, ilerleme yüzdesini ve ödülünü gösteren animasyonlu HUD barı.
* **Blocked Tasks:** Yok
* **Known Bugs:**
  - Mevcut oyunda `FactoryView.ts` henüz eski 1D doğrusal bant modelindedir (Simülasyon, Görsel ve İnşa katmanları Faz 4 kilometre taşları sonrası ana sahneye bağlanacaktır).
* **Known Technical Debt:**
  - Eski `MachineData.ts` ile yeni `types.ts` henüz paralel çalışmaktadır; geriye dönük uyumluluk korunmaktadır.
* **Pending Decisions:**
  - [x] [Q1] Oyun Yapısı: Kalıcı Fabrika + Kademeli Genişleme (DEC-006 Çözüldü)
  - [x] [Q2] Makine Taşıma/Yıkım: %100 Ücretsiz & Sıfır Sürtünme (DEC-007 Çözüldü)
  - [x] [Q3] Konveyör Çizimi: Akıllı Noktadan-Noktaya Bağlantı (DEC-008 Çözüldü)
  - [x] [Q4] Roket Uçuşu: Fabrikanın Nihai İlerleme Omurgası (DEC-009 Çözüldü)
  - Açık Makro Sorular: [MQ-1] İleri Safha Prestij Sıfırlaması, [MQ-2] Çevrimdışı Gelir Limiti
* **Last Verification:** 2026-10-02 02:24 — `cmd /c npm test` (177/177 test geçti, 515ms), `cmd /c npx tsc --noEmit` (0 hata), `cmd /c npm run build` (Başarılı, 3.74s).







