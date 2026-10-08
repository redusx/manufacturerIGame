# ECONOMY.md — Manufacturer Ekonomi ve Değer Modeli

> Oyundaki güncel değerleri anlatır (son eşitleme: 2026-10-08, M9-F). Kaynak her zaman koddur:
> `ItemRegistry.ts`, `RecipeRegistry.ts`, `MachineRegistry.ts`, `MilestoneManager.ts`, `FactoryEconomy.ts`,
> `RocketHangarBridge.ts`, `RangeLadder.ts`, `PlacementMath.ts`, `IncomeBoost.ts`, `AdService.ts`.
> Gerekçeler için `DECISIONS.md` DEC-011 … DEC-019 ve DEC-028 … DEC-033. Tabloları yeniden üretmek için:
> `node --experimental-strip-types tools/economy_model.ts`.

---

## 1. Tek Kasa

* Tek para birimi vardır: nakit ($). Kasa `EconomyManager`'dadır; `FactoryEconomy` ona yazar.
* **Toplam ciro** yalnız ihracat ve tıklamadan oluşur. Aşama ödülü, uçuş primi ve söküm iadesi kasaya girer ama ciroya yazılmaz; aşama hedeflerini yalnız üretim ilerletir.

## 2. Gelir Kaynakları

| Kaynak | Kural |
|---|---|
| İhracat | Sandığa ulaşan eşyanın baz değeri × gelir çarpanı, kuruşa yuvarlanır. Ana gelir budur. |
| Tıklama | Sabit $1; hiçbir çarpan büyütmez (DEC-013). |
| Aşama ödülü | Aşama tamamlanınca bir kez; yeni açılan şeyi almaya yetecek kadar. |
| Uçuş primi | Fabrikanın o anki $/sn geliri × kazanılan süre (en fazla 180 sn, taban $1/sn). Süre, roket sınıfının hız çarpanına bölünmüş mesafeden hesaplanır. |
| Çevrimdışı gelir | Kayıt anındaki (takviyesiz) $/sn × geçen süre × %50. Süre sınırı 4 saat; 10 km basamağıyla 8, 40 km basamağıyla 12 saat. |
| Gelir takviyesi | Etkinken ihracat geliri ×2. Alım başına 10 dk, en fazla 30 dk; yalnızca oyun açıkken işler. |

Gelir çarpanı: 10. aşama ödülü (+%50) ve menzil basamakları (§7). En fazla ≈ 14,2.

## 3. Eşya Değerleri ($)

Kural: değer ≈ girdilerin toplamı × 1,5–2.

| Kademe | Eşyalar |
|---|---|
| Hammadde | Demir cevheri 1 · Bakır cevheri 1,2 · Silikat kumu 1,5 · Ham polimer 2 |
| 1 | Demir Tozu 2,5 · Bakır Tozu 3 · Demir Külçe 6 · Bakır Külçe 7 · Hassas Cam Blok 8 · Plastik Pelet 5 · Hurda Talaş 0,5 |
| 2 | Çelik Levha 12 · Bakır Tel Bobini 6 · Hassas Dişli 18 · Yalıtkan Kart Tabanı 20 |
| 3 | Elektrik Motoru 50 · Optik Tarayıcı Sensör 50 · Aviyonik Mikroçip 60 · Güçlendirilmiş Gövde Çerçevesi 40 |
| 4 | Aerodinamik Kompozit Panel 45 · Güdüm & Navigasyon Bilgisayarı 320 · Güdümlü Roket İtici Blok 400 |

## 4. Reçete Süreleri (sn, 1. seviye makine)

Temel zincir kırıcının hızına (0,5/sn) eşittir: kırma 2 · külçe 2 · levha 2 · dişli 2 · bakır tel 2 (2 tel) · motor 2.
Diğerleri: cam blok 3 · çerçeve 4 · plastik 3 (2 pelet) · kart tabanı 4 · kompozit panel 6 · sensör 5 · mikroçip 6 · güdüm bilgisayarı 8 · itici blok 10.

## 5. Harcama Kalemleri

| Kalem | Bedel |
|---|---|
| Bant / ayırıcı / birleştirici | $5 / $25 / $25 |
| Makineler | Kırıcı 100 · Kesici 200 · Fırın 250 · Pres 300 · Montaj 500 · Rafineri 800 |
| Makine seviyesi | Taban × 1,15^seviye (Sv.10'dan sonra seviye başına ×1,35); her seviye +%20 hız. Montaj: 1→2 $575 · 10→11 $2.023 · 15→16 $9.070 · 20→21 $40.671 |
| Hammadde girişi | Taban: Demir 500 · Bakır 1.000 · Kum 2.500 · Polimer 2.500 (her biri 1 hammadde/sn). Aynı hammaddenin her yeni girişi ×1,7: demir 500 · 850 · 1.440 · 2.460 … 9.'su 34.900 · 13.'sü 291.000 · 17.'si 2,43 M |
| Parseller | 12x8: 500 · 16x12: 2.500 · 20x16: 10.000 · 24x24: 30.000 · 28x24: 250.000 (7 km izni) · 28x28: 1,5 M (14 km) · 32x28: 6 M (28 km) · 32x32: 25 M (40 km) |
| Roket modülü | Sv.2–3: nakit (400–3.500) + parça. Sv.4–10: §8 |
| Hızlı inşa | Her parçanın en fazla %25'i; birim fiyat güncel satış değerinin 10 katı |
| Gelir takviyesi (nakit) | Fabrikanın 5 dakikalık takviyesiz geliri (en az $100) → +10 dk |

Söküm iadesi %100'dür.

## 6. Aşamalar

| # | Koşul | Ödül |
|---|---|---|
| 1 | $50 ciro | $100 |
| 2 | 60 demir tozu | $150, Fırın |
| 3 | 30 demir külçe | $250, ek demir girişi |
| 4 | Parsel 1 + $600 ciro | $300, Pres |
| 5 | 40 demir levha | $400, Kesici, ayırıcı/birleştirici |
| 6 | 40 çelik dişli + $2.500 ciro | $1.000, Hangar, bakır girişi |
| 7 | Parsel 2 + 40 bakır tel | $1.500, Montaj |
| 8 | 30 elektrik motoru + $8.000 ciro | $2.500 |
| 9 | Parsel 3 + 20 çerçeve | $4.000, Rafineri, kum ve polimer girişi |
| 10 | Parsel 4 + 10 itici blok + $40.000 ciro | $10.000, +%50 gelir |

Ölçülen tempo (hiç beklemeden kuran bot): 9. aşama 15,6 dk. 10. aşama ölçülmedi.

## 7. Menzil Merdiveni ("Seferler")

10 aşamadan sonraki genel hedef. Her basamak kalıcı ödül verir; ilk beşi gelir çarpanına toplanır, sonrakiler çarpar.

| # | Menzil | Beklenen sınıf | Ödül |
|---|---|---|---|
| 1–5 | 100 m · 500 m · 1 km · 2,5 km · 5 km | 1–3 | +%5 · +%10 · +%15 · +%20 · +%25; 5 km ayrıca Mk II (Sv.4–6) |
| 6 | 7 km | 4 | ×1,25 · 28x24 parsel izni |
| 7 | 10 km | 5 | ×1,25 · çevrimdışı 8 saat |
| 8 | 14 km | 6 | ×1,25 · Mk III (Sv.7–9) · 28x28 izni |
| 9 | 20 km | 7 | ×1,25 |
| 10 | 28 km | 8 | ×1,25 · 32x28 izni |
| 11 | 40 km | 9 | ×1,25 · Mk IV (Sv.10) · 32x32 izni · çevrimdışı 12 saat |
| 12 | 55 km | 10 | ×1,25 |
| 13–14 | 75 km · 100 km | 10 + ustalık | ×1,15 · ×1,15 |

Roket sınıfı = en düşük modül seviyesi. Sınıfın hız çarpanı: 1 · 1,1 · 1,5 · 2 · 2,65 · 3,5 · 4,75 · 6,3 · 8,55 · 11,2 (Sv.1–10).

## 8. Roket Sv.4–10

Nakit `taban × 2,4^(Sv−4)` (gövde 30.000 · motor 40.000 · kanat 35.000 · nitro 25.000); parça `taban × 1,8^(Sv−ilk seviye)`.

| Sınıf | Dört modülün nakdi | Parçaların hammadde karşılığı | Parçaların satış değeri |
|---|---|---|---|
| Sv.4 | $130.000 | 645 | $17.800 |
| Sv.5 | $312.000 | 1.255 | $33.700 |
| Sv.6 | $749.000 | 2.268 | $58.900 |
| Sv.7 | $1,80 M | 4.190 | $106.200 |
| Sv.8 | $4,31 M | 7.525 | $191.200 |
| Sv.9 | $10,36 M | 13.550 | $343.600 |
| Sv.10 | $24,84 M | 24.365 | $617.500 |

Toplam nakit $42,5 M. "Hammadde karşılığı", parçaları üretmek için girişlerden çekilmesi gereken hammadde adedidir.

## 9. Üretim Zincirlerinin Verimi

Bir birim için gereken hammadde ve 1. seviye makine-saniyesi (kaynak: `tools/economy_model.ts`):

| Eşya | Değer | Hammadde | $/hammadde | Makine-sn |
|---|---|---|---|---|
| Hassas Dişli | 18 | 1 | 18 | 8 |
| Elektrik Motoru | 50 | 2 | 25 | 16 |
| Gövde Çerçevesi | 40 | 2 | 20 | 16 |
| Kompozit Panel | 45 | 2 | 22,5 | 15 |
| Mikroçip | 60 | 2,5 | 24 | 19,5 |
| Optik Sensör | 50 | 2,5 | 20 | 15,5 |
| Güdüm Bilgisayarı | 320 | 7 | 45,7 | 59 |
| İtici Blok | 400 | 8 | 50 | 73 |

En değerli iki ürün hammadde başına ≈ $48 getirir; 1 hammadde/sn'lik hat ≈ $3.300'lük makine ve ≈ 22 hücre ister.

## 10. Ödüllü Reklam Yerleşimleri (şimdilik sahte sağlayıcı)

| # | Yer | Ödül | Bekleme | Reklamsız yol |
|---|---|---|---|---|
| R1 | Çevrimdışı kazanç penceresi | Kazanç ×2 | — | Normal topla |
| R2 | Uçuş raporu | Prim ×3 | 3 dk | Normal dön |
| R3 | Takviye penceresi | +10 dk gelir ×2 | 5 dk | Nakitle al |
| R4 | Hangar | Hedef modülün eksik parçalarının %15'i | 10 dk | Üret veya hızlı inşa |
| R5 | Parsel satın alma onayı | O parselde %15 indirim ($30.000 ve üstü) | Parsel başına 1 | Tam fiyat |

## 11. Tempo Tahmini (model; ölçüm değildir)

`tools/economy_model.ts` 10. aşamayı yeni bitirmiş bir fabrikadan (≈ 2,5 hammadde/sn) Sv.10'a kadar olan yolu taklit eder. Fabrika tek tek kurulmaz; "saniyede işlenen hammadde" olarak soyutlanır. Oyuncu üç parametreyle temsil edilir: kurulu kapasitenin çalışan oranı, bir hattı kurmanın aldığı süre ve uçuş sıklığı. Reklam izlenmediği varsayılır. Mutlak süreler ±%50 oynayabilir.

| Sınıf | Rahat (verim 0,45) | Ortalama (0,65) | Optimizasyoncu (0,9) |
|---|---|---|---|
| Sv.4 | 23 dk | 13 dk | 9 dk |
| Sv.5 | 30 dk | 18 dk | 11 dk |
| Sv.6 | 39 dk | 22 dk | 14 dk |
| Sv.7 | 52 dk | 30 dk | 18 dk |
| Sv.8 | 70 dk | 40 dk | 25 dk |
| Sv.9 | 94 dk | 52 dk | 33 dk |
| Sv.10 | 154 dk | 83 dk | 47 dk |
| **Toplam** | **7,7 saat** | **4,3 saat** | **2,6 saat** |

Modelin söyledikleri:

* Kademe süresini nakit değil **parça üretimi** belirler; nakit, parça toplanırken birikir (nakit bekleme kademe süresinin %5–25'i).
* Ortalama oyuncunun geliri Sv.4'te ≈ $460/sn, Sv.10'da ≈ $13.000/sn; bu ölçekte %50'lik giriş artışı ve sınırsız ×1,15 makine seviyesi neredeyse bedavaydı. Bu yüzden giriş artışı ×1,7'ye, Sv.10 üstü makine seviyesi ×1,35'e çekildi; 32x28 ve 32x32 parseller getirilerine göre pahalı kaldığı için ucuzlatıldı (8 M → 6 M, 40 M → 25 M).
* Emek sınırı kaldırılırsa (`--no-effort`: para yettiği an fabrika büyür) ortalama oyuncu Sv.10'a 3,1 saatte varır; bu ayarlardan önce 1,8 saatti. Gerçek süre, oyuncunun fabrikayı ne hızla kurduğuna bağlıdır.

Gerçek oyuncu verisi yoktur. Planın hedefi (reklamsız 8–10 saat) modelde yalnızca "rahat" profilde tutuyor; ortalama için parça artışını 1,8'den 2,0'a çıkarmak toplamı ≈ 6 saate taşır. Bu karar elde oynayış ölçümüne bırakıldı.

## 12. Dengeleme Prensipleri

1. Rokete giden yol fabrikadan geçer: uçuş ve hızlı inşa hiçbir zaman üretimin yerini almaz.
2. Her yeni makine adımı geliri belirgin artırır.
3. Çıkmaz yoktur: tıklama ve ücretsiz başlangıç girişi her zaman çalışır, söküm tam iade eder.
