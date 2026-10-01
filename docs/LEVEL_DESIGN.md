# LEVEL_DESIGN.md — Fabrika Bölüm ve Kilometre Taşı Tasarımı (Factory Milestones)

> **Bu dosya, kalıcı fabrikanın 10 aşamalı rehberli ilerleme müfredatını (Milestone Chapters) tanımlar.**
> Oyun bağımsız puzzle bölümlerine bölünmez; oyuncunun tek fabrikası bu aşamalarla adım adım devleşir.

---

## 1. Tasarım İlkesi: "Persistent Progression Milestones"

* Oyuncunun fabrikası asla sıfırlanmaz.
* Her bölüm (Milestone Chapter), oyuncuya tek bir açık hedef ve ödül sunar.
* Hedefe ulaşıldığında yeni bir makine, genişleme parseli veya roket parçası kilidi açılır.

---

## 2. On Aşamalı İlerleme Müfredatı

| Bölüm # | Bölüm Adı | Başlangıç Durumu | Hedef (Objective) | Kilit Açılımı / Ödül (Reward) |
|---|---|---|---|---|
| **Bölüm 1** | **İlk Kıvılcım** | $8 \times 8$ Atölye, 1 Kırıcı, 1 Giriş, 1 Çıkış | Kırıcıyı banda bağla ve 25 Demir Tozu sat | Fırın (`smelter`) kilidi açılır + $\$250$ |
| **Bölüm 2** | **Isının Gücü** | Fırın açıldı | Fırını kur ve 15 Demir Külçesi üret | Parsel 1 ($12 \times 8$) ve Bakır Girişi açılır |
| **Bölüm 3** | **İlk Genişleme** | Yeni parsel açıldı | $\$1,500$ ciroya ulaş ve 20 Bakır Külçesi sat | Pres Makinesi (`press`) kilidi açılır |
| **Bölüm 4** | **Yüksek Basınç** | Pres açıldı | 10 Çelik Levha üret ve ihraç et | **ROKET HANGARI** ve Tier 1 Roket açılır! |
| **Bölüm 5** | **Göğe Doğru (Test-1)**| Roket Hangarı hazır | Roketi inşa et ve test fırlatması yap (500m) | Kesici (`cutter`) + Splitter/Merger kilidi |
| **Bölüm 6** | **Hassas Kesim** | Kesici açıldı | 20 Çelik Dişli ve 30 Bakır Tel üret | Parsel 2 ($16 \times 12$) açılır + $\$5,000$ |
| **Bölüm 7** | **İki Nehir (Montaj)** | Montajcı açıldı | Montaj Tezgahında 10 Elektrik Motoru üret | Tier 2 Roket Motoru kilidi açılır |
| **Bölüm 8** | **Stratosfer Avcısı**| Tier 2 Roket hazır | Roketi fırlat ve 3,000m irtifayı aş! | Rafineri (`refinery`) kilidi açılır |
| **Bölüm 9** | **İleri Kompozit**| Rafineri açıldı | 15 Titanyum Panel ve 10 Devre Kartı üret | Parsel 3 ($24 \times 24$ Mega Alan) açılır |
| **Bölüm 10**| **Yörünge Zaferi** | Ağır Roket hazır | Yörüngeye (10,000m+) başarılı fırlatma yap | **Zafer Ekranı + Sonsuz Prestij Çarpanı!** |

---

## 3. Dinamik Yan Siparişler (Quick Contracts)

Ana müfredat bölümlerinin yanında, oyuncuya anlık nakit sağlayan küçük kontratlar sunulur:
* *"Acil Talep: 15 adet Bakır Tel $\rightarrow$ Ödül: $\$300$ (3 dakika içinde teslim)"*
* Bu siparişler oyuncuya ana hatlarını geçici olarak yeniden düzenleme veya hızlı üretim yapma motivasyonu verir.
