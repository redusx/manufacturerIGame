# PROGRESSION_PLAN.md — Manufacturer İlk 30–60 Dakika İlerleme Planı

> **Tarihsel belge.** Bu dosya revival öncesi planı/denetimi anlatır ve oyunun güncel hâliyle birebir örtüşmeyebilir. Güncel durum: `PROJECT_STATUS.md`; bağlayıcı kararlar: `DECISIONS.md` (DEC-011 ve sonrası); güncel sayılar: `ECONOMY.md`.

> **Son güncelleme:** 30 Eylül 2026  
> **Referans:** `docs/PROGRESSION_AUDIT.md` bulgularına dayalı düzeltme planı  
> **Kapsam:** Yalnızca mevcut mekaniklerin dengelemesi ve UI iyileştirmeleri; yeni mekanik eklenmez.

---

## Plan Özeti

Denetim raporundaki kritik sorunları (S1–S4) çözmek ve önemli sorunları (S5, S7, S8) iyileştirmek için aşağıdaki değişiklikleri uyguluyoruz.

**Temel strateji:** Hedef zincirini 30–60 dakikalık oyun alanına yaymak, çarpan birikimini yavaşlatmak, ara kilometre taşları eklemek ve hedefe kalan süre göstergesini MilestoneBar'a eklemek.

---

## 1. Fabrika Hedefleri Yeniden Dengeleme (S1 + S2 + S3)

### Sorun
- 7 hedefin tamamı 2:20'de bitiyor
- İlk 4 hedefin ödülü yok
- 9× çarpan 2. dakikada devreye giriyor

### Çözüm

**Hedef sayısını 12'ye çıkar**, ödülleri dağıt ve eşikleri 30–60 dakikalık banda yay:

| # | ID | Ad | Hedef | Global Çarpan | Neden |
|---|----|----|-------|---------------|-------|
| 1 | goal_first_machine | İlk Makine | 10 | 1× | Öğretici — ilk tıklama + satın alma |
| 2 | goal_expand_floor | Fabrika Genişlemesi | 75 | 1.15× | İlk anlamlı ödül, küçük hız artışı |
| 3 | goal_press_unlock | Presleme Devrimi | 200 | 1× | Pres açılımı (unlockAt=200 ile eşleşir) |
| 4 | goal_speed_boost | Hızlı Üretim | 600 | 1.20× | Orta erken oyun ödülü |
| 5 | goal_welder_unlock | Robotik Gelecek | 1,500 | 1× | Kaynak Robotu açılımı |
| 6 | goal_efficiency | Verimlilik Artışı | 4,000 | 1.25× | Orta oyun çarpanı |
| 7 | goal_automation_unlock | Endüstri 4.0 | 10,000 | 1× | Otomasyon Hattı açılımı |
| 8 | goal_super_factory | Süper Fabrika | 30,000 | 1.30× | İlk büyük çarpan |
| 9 | goal_industrial_giant | Endüstriyel Dev | 100,000 | 1.35× | Orta-geç oyun |
| 10 | goal_mega_factory | Megafabrika | 500,000 | 1.40× | Geç oyun hedefi |
| 11 | goal_titan | Fabrika Titanı | 2,500,000 | 1.50× | Çok geç oyun |
| 12 | goal_legend | Efsanevi Üretici | 15,000,000 | 1.60× | 60dk+ oyuncular için |

**Bileşik çarpan:** 1.15 × 1.20 × 1.25 × 1.30 × 1.35 × 1.40 × 1.50 × 1.60 ≈ **8.86×** (eski 9× ile benzer ama çok daha geç ulaşılır)

### Makine Kilidi Eşiklerini Güncelle

| Makine | Eski unlockAt | Yeni unlockAt |
|--------|---------------|---------------|
| Montaj Tezgahı | 0 | 0 (değişmez) |
| Pres Makinesi | 50 | 200 |
| Kaynak Robotu | 300 | 1,500 |
| Otomasyon Hattı | 1,500 | 10,000 |

Böylece her makine kilidi bir fabrika hedefiyle eşleşir ve hedef tamamlama o makineyi açar.

---

## 2. Makine Seviye Kilometre Taşları Ara Ödüller (S8)

### Sorun
Sv.10 → Sv.25 arası 15 seviye boyunca ödülsüz alan var.

### Çözüm
Mevcut dizi korunur, ek ara eşikler eklenir:

| Seviye | Çarpan | Etiket |
|--------|--------|--------|
| 10     | 2×     | 2× Verimlilik |
| 25     | 3×     | 3× Hızlı Üretim |
| 50     | 4×     | 4× Endüstriyel Hız |
| 75     | 5×     | 5× Mega Verimlilik |
| 100    | 6×     | 6× Aşırı Güç |

**Değişiklik:** Sv.100 çarpanı 5→6 oldu ve Sv.75 yeni eklendi. Bu, geç oyunda seviye kasma motivasyonunu artırır.

---

## 3. Roket Yükseltme Maliyetlerini Artır (S7)

### Sorun
Tüm roket bileşenleri 15–87 Parça aralığında — 30 saniyede tamamlanıyor.

### Çözüm
Roket yükseltmeleri fabrika-roket tercihi oluşturmalı. Maliyetler arttırılır:

| Bileşen | Eski baseCost / costScale | Yeni baseCost / costScale |
|---------|--------------------------|--------------------------|
| Gövde   | 15 / 2.2                 | 150 / 3.0                |
| Motor   | 25 / 2.4                 | 250 / 3.2                |
| Kanatlar| 20 / 2.3                 | 200 / 3.0                |
| Nitro   | 35 / 2.5                 | 350 / 3.5                |

**Yeni maliyet tablosu:**
| Bileşen | Sv.1→2 | Sv.2→3 |
|---------|--------|--------|
| Gövde   | 150    | 450    |
| Motor   | 250    | 800    |
| Kanatlar| 200    | 600    |
| Nitro   | 350    | 1,225  |

Bu şekilde ilk roket yükseltmesi ~3–5. dakikada (Pres Makinesi açıldıktan sonra), tamamı ~15–20. dakikada gerçekleşir. Oyuncu "fabrikaya mı yoksa rokete mi yatırım yapayım?" tercihiyle karşılaşır.

---

## 4. MilestoneBar'a Tahmini Süre Ekle (S5)

### Sorun
Oyuncu sıradaki hedefe ne kadar sürede ulaşacağını bilmiyor.

### Çözüm
MilestoneBar'ın `updateGoal` metodunda kalan kaynak miktarını mevcut üretim/sn'ye bölerek "~Xdk Ys" tahmini süre göster.

**Gösterim formatı:** `Süper Fabrika: 12.4K / 30K (%41) — ~2dk 15sn`

**Hesaplama:** `(target - current) / productionPerSecond`

Bu hesap için MilestoneBar'a `pps` (production per second) değerinin geçirilmesi gerekiyor.

---

## 5. Uygulama Planı — Dosya Değişiklikleri

| # | Dosya | Değişiklik |
|---|-------|-----------|
| 1 | `src/data/MachineData.ts` | `FACTORY_GOALS` dizisini 12 hedefli yeni versiyonla değiştir |
| 2 | `src/data/MachineData.ts` | `MACHINES` unlockAt değerlerini güncelle |
| 3 | `src/data/MachineData.ts` | `MACHINE_LEVEL_MILESTONES` dizisine Sv.75 ekle, Sv.100'ü 6× yap |
| 4 | `src/data/RocketData.ts` | `ROCKET_UPGRADES` baseCost ve costScale değerlerini güncelle |
| 5 | `src/ui/MilestoneBar.ts` | `updateGoal` metoduna `pps` parametresi ekle, tahmini süre göster |
| 6 | `src/scenes/GameScene.ts` | `refreshUI` içinde `milestoneBar.updateGoal`'a `pps` geçir |

> **Kapsam sınırı:** Bu plan mevcut mekaniklerin dengelemesi ve bir UI iyileştirmesinden ibarettir. Yeni makine, yeni kaynak türü, prestij sistemi veya yeni sahne eklenmez.
