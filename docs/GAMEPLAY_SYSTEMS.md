# GAMEPLAY_SYSTEMS.md — Manufacturer Sistemler Arası Etkileşim Mimarisi

> **Bu dosya, oyundaki ana alt sistemleri ve birbirleriyle olan veri/durum akışlarını tanımlar.**

---

## 1. Alt Sistemler Taksonomisi

1. **Izgara ve Yerleşim Sistemi (Spatial Grid):** $32 \times 32$ piksel boyutunda kesikli ızgara. Makinelerin, konveyörlerin, hammadde girişlerinin ve ihracat sandıklarının koordinatlarını ve çakışmalarını denetler.
2. **Lojistik Ağı (Logistics Network):** Yönlü taşıma bantları, slot tabanlı eşya takibi, hız denetimi, bant tıkanması (backpressure), yönlendiriciler (splitters/mergers).
3. **Üretim Motoru (Production Engine):** Veri-güdümlü reçeteler, makinelerin girdi/çıktı tamponları, çevrim süresi sayacı, 4 durumlu makine mantığı (`IDLE`, `WAITING_INPUT`, `PROCESSING`, `BLOCKED_OUTPUT`).
4. **Ekonomi ve Değer Motoru (Economy Engine):** Eşya değerleri, işletme giderleri, serbest ihracat satışı, dinamik sipariş/sözleşme takibi, bakiye yönetimi.
5. **İlerleme ve Teknoloji (Progression & Tech Tree):** Oyuncu deneyimi, bölüm tamamlama kilitleri, makine/reçete açılımları.
6. **Havacılık & Roket Entegrasyonu (Aerospace & Flight):** Fabrikanın nihai ürünleriyle roket parçalarının üretilmesi, sağa kaydırmalı uçuş sahnesi (`FlightScene`) ve uzay madenciliği geri besleme döngüsü.

---

## 2. Sistem Etkileşim ve Veri Akışı

```text
[Hammadde Girişi (Intake)]
          │ (Eşya İtme)
          ▼
[Lojistik Ağı (Bantlar)] ◄─── (Tıkanma / İlerleme Durumu)
          │
          │ (Girdi Çekme)
          ▼
[Makine Girdi Tamponu]
          │
          ▼
[Üretim Motoru] ─── (İşlem Süresi Tamamlandı) ───► [Makine Çıktı Tamponu]
                                                           │
                                                           │ (Çıktı İtme)
                                                           ▼
                                                [Lojistik Ağı (Bantlar)]
                                                           │
                                                           ▼
                                                [İhracat / Sevkiyat Portu]
                                                           │
                        ┌──────────────────────────────────┴──────────────────────────────────┐
                        ▼                                                                     ▼
               [Ekonomi Sistemi]                                                     [Sipariş Sistemi]
           (Para Artışı / Giderler)                                                (Sözleşme İlerlemesi)
                        │                                                                     │
                        └──────────────────────────────────┬──────────────────────────────────┘
                                                           ▼
                                                [İlerleme & Kilit Açılımı]
                                                           │
                                                           ▼
                                                [Roket Hangarı & Uçuş]
```

---

## 3. Durum Paylaşımı İlkeleri
* Simülasyon çekirdeği Phaser'dan habersizdir. Olaylar (event emitter) veya saf durum sorgulama (polling) yoluyla UI ve görsel katmana aktarılır.
* Hiçbir görsel Phaser nesnesi doğrudan simülasyon durumunu değiştiremez; değişiklikler `PlacementController` üzerinden komut (Command) olarak simülasyona iletilir.
