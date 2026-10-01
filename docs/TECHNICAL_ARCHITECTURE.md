# TECHNICAL_ARCHITECTURE.md — Manufacturer Teknik Mimari Spesifikasyonu

> **Bu dosya, kodun katmanlarını, sorumluluk sınırlarını ve Phaser 3 entegrasyonunu tanımlar.**

---

## 1. Üç Katmanlı Mimari (3-Tier Decoupled Architecture)

```
+-----------------------------------------------------------------------------------+
| 1. PRESENTATION LAYER (Phaser 3)                                                  |
| - GameScene / FactoryScene                                                        |
| - GridView (TileSprite, zemin karoları, ızgara çizgileri)                          |
| - ConveyorRenderer (Bant animasyonu, yönlü sprite'lar)                             |
| - ItemSpritePool (Bant üzerindeki eşya sprite'ları - GC optimizasyonu)            |
| - PlacementController (Fare/dokunmatik girdi, hayalet önizleme, döndürme)         |
| - DiagnosticOverlay (Darboğaz ısı haritası, hata ikonları)                        |
+-----------------------------------------------------------------------------------+
                                         │
                        (Olaylar & Komutlar / Durum Okuma)
                                         ▼
+-----------------------------------------------------------------------------------+
| 2. SIMULATION ENGINE (Pure TypeScript - Headless, Zero Phaser Dependency)         |
| - FactorySimulation (Merkezi tick döngüsü, koordinasyon)                         |
| - GridMap (Mekânsal indeks, hücre sorguları, çakışma tespiti)                     |
| - LogisticsNetwork (Konveyör slotları, aktarımlar, backpressure)                  |
| - ProductionEngine (Reçetelerin işletilmesi, tamponlar, durum makinesi)           |
| - ItemRegistry & RecipeRegistry (Veri-güdümlü eşya/reçete tanımları)               |
+-----------------------------------------------------------------------------------+
                                         │
                                         ▼
+-----------------------------------------------------------------------------------+
| 3. PERSISTENCE & ECONOMY LAYER                                                    |
| - FactoryEconomy (Bakiye, sipariş tamamlama primleri, ihracat kazancı)            |
| - ContractManager (Aktif siparişler, geri sayım sayacı)                           |
| - SaveManager (JSON serileştirme, LocalStorage / Cloud Save)                      |
+-----------------------------------------------------------------------------------+
```

---

## 2. Tasarım Kuralları ve Performans Kısıtları
1. **Phaser Bağımsızlığı:** `src/factory/simulation/` altındaki hiçbir dosya `import Phaser from 'phaser'` içermez. Bu katman saf TypeScript ile Node.js altında doğrudan çalışır ve test edilir.
2. **Sprite Havuzlama (Object Pooling):** Bant üzerindeki eşyalar için her kare `new Sprite()` yapılmaz; `ItemSpritePool` üzerinden sabit bir havuz yönetilir.
3. **Determinizm:** Simülasyon kare kare (tick-based) sabit zaman aralığıyla ($dt = 0.05$ sn veya $0.1$ sn) çalıştırılabilir; bu sayede kayıttan yüklenen bir fabrika her seferinde birebir aynı davranışı sergiler.
