# PROGRESSION.md — Manufacturer Kademeli İlerleme Mimarisi

> **Tarihsel belge.** Bu dosya revival öncesi planı/denetimi anlatır ve oyunun güncel hâliyle birebir örtüşmeyebilir. Güncel durum: `PROJECT_STATUS.md`; bağlayıcı kararlar: `DECISIONS.md` (DEC-011 ve sonrası); güncel sayılar: `ECONOMY.md`.

> **Bu dosya, oyuncunun kalıcı fabrika genişlemesini, teknoloji açılımlarını ve roket evrimini tanımlar.**

---

## 1. İlerleme Felsefesi: "Persistent Factory + Progressive Expansion"

* Fabrika sıfırlanıp baştan başlatılan bir bulmaca değildir; oyuncunun kalıcı sanayi imparatorluğudur.
* Oyuncu oyuna **$8 \times 8$ küçük bir atölye** ile başlar.
* İlerledikçe yeni makineler, yeni hammadde kaynakları, daha geniş ızgara parselleri ve roket kademeleri açılır.

---

## 2. Beş Aşamalı Fabrika ve Roket Çağları (Progression Eras)

```text
┌─────────────────────────────────────────────────────────────────────────────┐
│ ÇAĞ 1: CEVHER ATÖLYESİ ($8x8) ──► Tıkla, Ez, Toz Sat, İlk Otomasyon         │
│                              │                                              │
│ ÇAĞ 2: DÖKÜMHANE ($12x8)     ──► Fırın, Külçeler, İlk Parsel Genişlemesi    │
│                              │                                              │
│ ÇAĞ 3: MEKANİK İMALAT ($16x12)──► Pres, Kesici, Dişli, Roket Hangarı Açılışı │
│                              │                                              │
│ ÇAĞ 4: MONTAJ FABRİKASI ($20x16)► Montajcı, Motor, İlk Stratosfer Fırlatması│
│                              │                                              │
│ ÇAĞ 5: UZAY KOMPLEKSİ ($24x24)──► Rafineri, Aviyonik, Yörünge Görevleri      │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

### Çağ 1: Cevher Atölyesi (Ore Shed)
* **Izgara Boyutu:** $8 \times 8$ (1 hammadde girişi: `iron_ore`, 1 `EXPORT` sandığı).
* **Mevcut Makineler:** Kırıcı (`crusher`), Düz Konveyör (`conveyor`).
* **Ana Ürünler:** Demir Tozu (`iron_powder`).
* **Öğretilen Prensip:** Tıklama, makine yerleşimi, bantla ihracata bağlama ve ilk pasif gelir.
* **Çağ Atlama Eşiği (Milestone 1):** 50 adet Demir Tozu sat $\rightarrow$ **Dökümhane Çağı Açılır!**

---

### Çağ 2: Dökümhane (The Foundry)
* **Izgara Boyutu:** $12 \times 8$ (1. Parsel açılır; yeni hammadde girişi: `copper_ore`).
* **Açılan Makineler:** Fırın (`smelter`).
* **Ana Ürünler:** Demir Külçesi (`iron_ingot`), Bakır Külçesi (`copper_ingot`).
* **Öğretilen Prensip:** Kırıcı (2 sn) ile Fırın (4 sn) arasındaki hız farkı (hız yükseltme veya paralel hat).
* **Çağ Atlama Eşiği (Milestone 2):** $\$1,000$ sermaye biriktir ve 25 Demir Külçesi sat $\rightarrow$ **Mekanik İmalat Çağı Açılır!**

---

### Çağ 3: Mekanik İmalathane (The Workshop)
* **Izgara Boyutu:** $16 \times 12$ (2. Parsel açılır).
* **Açılan Makineler:** Pres Makinesi (`press`), Hassas Kesici (`cutter`), Splitter & Merger.
* **Ana Ürünler:** Çelik Levha (`iron_plate`), Bakır Tel (`copper_wire`), Çelik Dişli (`steel_gear`).
* **BÜYÜK AÇILIM:** **ROKET HANGARI (Rocket Hangar)** faaliyete geçer!
* **İlk Roket (Tier 1 — Sounding Rocket):** 10 Çelik Levha ile roket gövdesi inşa edilir.
* **Çağ Atlama Eşiği (Milestone 3):** İlk test fırlatmasını yap ve 500m irtifaya ulaş!

---

### Çağ 4: Montaj Fabrikası (The Assembly Plant)
* **Izgara Boyutu:** $20 \times 16$ (3. Parsel açılır).
* **Açılan Makineler:** Montaj Tezgahı (`assembler` — 2 girişli makine).
* **Ana Ürünler:** Elektrik Motoru (`electric_motor`), Güçlendirilmiş Çerçeve (`reinforced_frame`).
* **Roket Gelişimi (Tier 2 — Stratospheric Rocket):**
  - Roket Motoru montajı yapılır (Dişli + Tel + Levha).
  - Yakıt deposu kapasitesi artırılır.
  - Uçuş menzili 2,500m'ye çıkar; uçuşta toplanan uzay hurdaları fabrikaya hammadde olarak geri akar.
* **Çağ Atlama Eşiği (Milestone 4):** 3,000m stratosfer sınırını aş!

---

### Çağ 5: Havacılık ve Uzay Kompleksi (Aerospace Complex)
* **Izgara Boyutu:** $24 \times 24$ (Mega Fabrika alanı; tüm hammadde girişleri açık).
* **Açılan Makineler:** Kimyasal Rafineri (`refinery`).
* **Ana Ürünler:** Devre Kartı (`circuit_substrate`), Titanyum Kompozit Panel (`aero_hull_plate`), Roket İtici Bloğu (`rocket_thruster_block`).
* **Roket Gelişimi (Tier 3 — Orbital Heavy Rocket):**
  - Aviyonik güdüm sistemi, çift itici kademesi, ısı kalkanı.
  - Yörüngeye ulaşma görevi.
* **Sonsuz İlerleme:** Yörüngeden getirilen uzay kristalleri ile kalıcı prestij çarpanları ve fabrikanın tam otomasyonu.

---

## 3. Kilometre Taşı (Milestone) Arayüzü

Oyuncu ekranda her an tepede yer alan **Milestone Bar** ile sıradaki hedefi takip eder:

```text
[Hedef: İlk Fırını Kur] ── [İlerleme: %75 ($750 / $1,000)] ── [Ödül: Dökümhane Parseli]
```

Her milestone tamamlandığında:
1. Ekranda zafer efekti ve ses efekti çalar,
2. İlgili yeni teknoloji, makine veya parsel yeşil kilit açılma animasyonuyla açılır,
3. Bir sonraki hedef otomatik olarak devreye girer.
