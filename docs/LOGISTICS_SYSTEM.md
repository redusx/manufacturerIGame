# LOGISTICS_SYSTEM.md — Manufacturer Lojistik ve Konveyör Sistemi

> **Bu dosya, bantların mekaniğini, eşya slotlarını, tıkanma fiziğini ve yönlendiricileri tanımlar.**

---

## 1. Konveyör Hücresi Mimarisi

* Her konveyör $1 \times 1$ tile ($32 \times 32$ px) alan kaplar ve 4 ana yönden birine bakar (`NORTH`, `EAST`, `SOUTH`, `WEST`).
* **Slot Mantığı:** Her konveyör tile'ı maksimum 2 eşya taşıyabilir:
  - Giriş Yuvası (Progress: $0.0 - 0.5$)
  - Çıkış Yuvası (Progress: $0.5 - 1.0$)
* **Hız:** Standart konveyör saniyede 1 tile (32 px/s) hızla eşyayı iter.

---

## 2. Bant Tıkanması (Backpressure) ve Akış Kuralları

1. Eşya `progress = 1.0` değerine ulaştığında, baktığı komşu tile'a bakar:
   - Eğer komşu tile bir **Konveyör** ise ve giriş yuvası boşsa: Eşya komşuya geçer, `progress = 0.0` olur.
   - Eğer komşu tile bir **Makine Giriş Portu** ise ve makinenin tamponu alabiliyorsa: Eşya makineye girer, banttan silinir.
   - Eğer komşu tile bir **Sevkiyat Portu** ise: Eşya satılır, para/skora yazılır.
   - Eğer komşu tile **Dolu / Tıkalı / Duvar** ise: Eşya bant ucunda durur (`progress = 1.0`).
2. Arkadan gelen eşyalar öndeki eşyaya çarpar ve durur. Böylece hat tıkanması fiziksel olarak arkaya doğru dalga halinde yayılır.

---

## 3. Lojistik Elemanları

### 3.1. Splitter (Akış Ayırıcı - 1 Girdi $\rightarrow$ 2 Çıktı)
* $1 \times 1$ tile. Gelen eşyaları dönüşümlü olarak sırayla 1. çıkışa ve 2. çıkışa aktarır (50% / 50% yük dengeleme).
* Çıkışlardan biri tıkalıysa diğer çıkıştan kesintisiz akıtmaya devam eder (Taşma önleme).

### 3.2. Merger (Akış Birleştirici - 2 Girdi $\rightarrow$ 1 Çıktı)
* İki farklı yönden gelen hatları tek bir hatta birleştirir. Girişlere adil öncelik (round-robin) tanır.

### 3.3. Depo / Tampon Silo (Storage Bin - $1 \times 1$)
* 20 adet eşya tutabilir. Hız dalgalanmalarını ve dur-kalkları sönümleyen tampon görevi görür.
