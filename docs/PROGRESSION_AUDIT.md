# PROGRESSION_AUDIT.md — Manufacturer İlerleme Denetimi

> **Tarihsel belge.** Bu dosya revival öncesi planı/denetimi anlatır ve oyunun güncel hâliyle birebir örtüşmeyebilir. Güncel durum: `PROJECT_STATUS.md`; bağlayıcı kararlar: `DECISIONS.md` (DEC-011 ve sonrası); güncel sayılar: `ECONOMY.md`.

> **Son güncelleme:** 30 Eylül 2026  
> **Kapsam:** Mevcut kodun sayısal simülasyon ve tasarım kurallarıyla karşılaştırmalı denetimi

---

## 1. Mevcut Mekanikler (✅ Uygulanmış)

### 1.1 Fabrika Ekonomisi
- **4 makine türü:** Montaj Tezgahı → Pres Makinesi → Kaynak Robotu → Otomasyon Hattı
- **Üretim formülü:** `baseProduction × level × milestoneMul × globalMul`
- **Maliyet formülü:** `floor(baseCost × costScale^level)`
- **Manuel tıklama:** `1 Parça/tık × globalMul`
- **Otomatik üretim:** Makine seviyeleri bazında sürekli kaynak üretimi

### 1.2 Makine Seviye Kilometre Taşları
| Seviye | Çarpan |
|--------|--------|
| 10     | 2×     |
| 25     | 3×     |
| 50     | 4×     |
| 100    | 5×     |

### 1.3 Fabrika Hedefleri (7 adet)
| Hedef              | Gerekli Toplam | Global Çarpan |
|--------------------|----------------|---------------|
| İlk Makine         | 10             | 1×            |
| Presleme Devrimi   | 50             | 1×            |
| Robotik Gelecek    | 300            | 1×            |
| Endüstri 4.0       | 1,500          | 1×            |
| Süper Fabrika      | 5,000          | 1.5×          |
| Endüstriyel Dev    | 25,000         | 2×            |
| Megafabrika        | 100,000        | 3×            |

### 1.4 Roket Sistemi (✅ Uygulanmış)
- **4 yükseltme bileşeni:** Gövde, Motor, Kanatlar, Nitro (her biri max Sv.3)
- **FlightScene:** Parabolik fırlatma, yer çekimi, itki, yakıt, boost, toplanabilir nesneler, engeller
- **Ekonomi bağlantısı:** Uçuş ödülleri → fabrika kaynağına eklenir

### 1.5 Kayıt ve Offline
- localStorage tabanlı kayıt/yükleme
- Offline üretim: max 4 saat, %50 verimlilik

### 1.6 Görsel Sistem
- Piksel sanat fabrika görünümü (hammadde → makineler → konveyör bant → sevkiyat)
- Makine animasyonları (pnömatik çekiç, hidrolik pres, robot kol, lazer tarayıcı)
- Ürün dönüşümü (gri dişli → altın dişli → kristal → altın sikke)
- HUD: kaynak, üretim/sn, uçuş rekoru
- Bildirim sistemi (toast)
- MachineModal: detaylı makine bilgisi ve geliştirme

---

## 2. Sayısal Simülasyon Bulguları

**Koşullar:** 3 tık/sn, otomatik optimum satın alma, roket uçuşu hariç

### 2.1 Kilit Açılma ve İlk Satın Alma Süreleri

| Makine         | Kilit Açılma | İlk Satın Alma |
|----------------|-------------|-----------------|
| Montaj Tezgahı | 0:03        | 0:03            |
| Pres Makinesi  | 0:11        | 0:32            |
| Kaynak Robotu  | 0:30        | 1:13            |
| Otomasyon Hattı| 0:53        | 1:56            |

### 2.2 Hedef Tamamlama Süreleri

| Hedef                 | Süre   | Notlar                    |
|-----------------------|--------|---------------------------|
| İlk Makine (10)       | 0:04   | ✅ Çok hızlı              |
| Presleme Devrimi (50) | 0:12   | ✅ İyi                    |
| Robotik Gelecek (300) | 0:30   | ✅ İyi                    |
| Endüstri 4.0 (1,500)  | 0:54   | ✅ İyi                    |
| Süper Fabrika (5,000)  | 1:19   | ✅ İyi                    |
| Endüstriyel Dev (25K)  | 1:55   | ✅ İyi                    |
| Megafabrika (100K)     | 2:20   | ⚠️ Yalnızca 2.5dk, hızlı |

### 2.3 Üretim Hızı Evrimi

| Zaman  | Üretim/sn | Toplam Kazanım | Çarpan |
|--------|-----------|-----------------|--------|
| 0:15   | 5         | 82              | 1×     |
| 0:45   | 56        | 998             | 1×     |
| 1:30   | 454       | 9,989           | 1.5×   |
| 2:00   | 2,529     | 38,276          | 3×     |
| 2:30   | 27,081    | 328,052         | 9×     |
| 5:00   | 74,520    | 8.9M            | 9×     |
| 10:00  | 92,574    | 34.4M           | 9×     |
| 30:00  | 131,310   | 186M            | 9×     |
| 60:00  | 150,957   | 431M            | 9×     |

---

## 3. Tespit Edilen Sorunlar

### 🔴 Kritik

#### S1. Tüm hedefler ~2:30'da tamamlanıyor, sonra 57+ dakika hedefsizlik
Toplam 7 fabrika hedefi var ve hepsi 2 dakika 20 saniye içinde bitiyor. Kalan ~57 dakikalık oyunda oyuncunun takip edeceği yeni bir fabrika hedefi yok. Bu, `INCREMENTAL_DESIGN_RULES.md §7 (Hedef Görünürlüğü)` ve `§8 (Uzun ödülsüz bekleme)` ihlalidir.

**Kök neden:** `FACTORY_GOALS` dizisindeki son hedef (Megafabrika) 100K'da set edili ama 9× global çarpanla üretim o kadar hızlı ki 2:20'de aşılıyor.

#### S2. Global çarpan birikimi çok agresif
Süper Fabrika (1.5×), Endüstriyel Dev (2×) ve Megafabrika (3×) çarpanları çarpımsal olarak uygulanıyor: `1 × 1.5 × 2 × 3 = 9×`. Bu 9 katlık üretim artışı 2. dakikada devreye giriyor ve tüm maliyet ölçeklemesini anlamsız kılıyor.

#### S3. İlk 4 hedefin ödülü yok (globalMultiplier: 1)
İlk 4 fabrika hedefi (İlk Makine → Endüstri 4.0) sadece makine kilidi açıyor; global çarpan veya başka anlamlı ödül vermiyor. Makine zaten `unlockAt` ile açılıyor — hedef tamamlama ayrı bir ödül sunmuyor.

#### S4. 2:30 sonrası üretim hızı neredeyse sabit
9× çarpan devreye girdikten sonra başka global çarpan kaynağı yok. Üretim artışı yalnızca makine seviye artışına bağlı ve costScale nedeniyle marjinal getiri gittikçe azalıyor. 5 dk'daki 74K/sn, 60 dk'da sadece 151K/sn'ye çıkıyor — 12 katlık süre artışına karşılık sadece 2× üretim artışı.

### 🟡 Önemli

#### S5. Hedefe kalan süre gösterilmiyor
MilestoneBar mevcut/hedef değerini gösteriyor ama "tahmini süre" bilgisi yok. Oyuncu "ne kadar beklemeliyim?" sorusuna cevap bulamıyor.

#### S6. İlk tıklama gücü çok düşük
`BASE_CLICK_POWER = 1` ve başta otomatik üretim yok. Oyuncu ilk 3 saniye boyunca yalnızca tıklıyor ve tık başı 1 Parça kazanıyor. İlk makine 10 Parça — bu 10 tıklama (çok hızlı ama geri bildirim zayıf olabilir).

#### S7. Roket yükseltmeleri çok ucuz
Tüm roket bileşenlerinin tüm seviyeleri 15–87 Parça arasında. Oyuncu 30 saniye içinde tüm roket yükseltmelerini tamamlayabilir. Bu, roket gelişiminin bir "yatırım tercihi" olmasını engelliyor (§3 ihlali).

#### S8. Makine seviye milestone'ları arası uzun boşluklar
Sv.10 → Sv.25 → Sv.50 → Sv.100: Bu aralıklar çok geniş. Özellikle Sv.10 sonrası Sv.25'e kadar 15 seviye boyunca hiçbir yeni ödül/mekanik yok.

### 🟢 İyi Çalışan Yönler

- **Erken oyun akışı hızlı:** İlk makine 3 saniyede, ikinci makine 32 saniyede — oyuncu hemen aksiyona geçiyor.
- **Kademeli açılım çalışıyor:** Makineler sıralı olarak makul aralıklarla açılıyor.
- **Fabrika görsel geri bildirimi zengin:** Ürün dönüşümü, kıvılcımlar, animasyonlar, coin akışı.
- **Maliyet ölçekleme başlangıçta makul:** costScale 1.12–1.15 aralığı erken oyunda iyi hissettiriyor.
- **Roket-fabrika döngüsü mimari olarak doğru:** Kaynaklar iki yönlü akıyor.

---

## 4. Mevcut Kodda Olmayan ama Tasarım Belgesinde (AGENTS.md) Bahsedilen Özellikler

| Özellik                     | Durum       |
|------------------------------|-------------|
| CrazyGames SDK entegrasyonu  | 🎯 Sonraki aşama |
| Bulut kayıt                  | 🎯 Sonraki aşama |
| Oyuncu hesabı                | 🎯 Sonraki aşama |
| Prestige / reset sistemi     | ❓ Belirsiz  |
| Offline gelir mekaniği       | ✅ Mevcut (basit) |
| Birden çok para birimi       | ❓ Belirsiz  |
| Monetizasyon / reklam        | ❓ Belirsiz  |

---

## 5. Özet: Öncelik Sırası

| # | Sorun | Öncelik | Kapsam |
|---|-------|---------|--------|
| S1 | Hedef eksikliği (2:30 sonrası) | 🔴 Kritik | Veri + UI |
| S2 | Çarpan birikimi çok agresif | 🔴 Kritik | Veri dengeleme |
| S3 | İlk hedeflerin ödülsüz olması | 🔴 Kritik | Veri |
| S4 | Geç oyun üretim platosuna vurma | 🟡 Önemli | Veri dengeleme |
| S5 | Hedefe kalan süre gösterilmiyor | 🟡 Önemli | UI |
| S7 | Roket yükseltmeleri çok ucuz | 🟡 Önemli | Veri dengeleme |
| S8 | Milestone aralıkları çok geniş | 🟡 Önemli | Veri |
| S6 | İlk tıklama gücü düşük (minör) | 🟢 Düşük | Veri |
