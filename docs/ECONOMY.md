# ECONOMY.md — Manufacturer Ekonomi ve Değer Modeli

> Oyundaki güncel değerleri anlatır (son eşitleme: 2026-10-06, M10). Kaynak her zaman koddur:
> `ItemRegistry.ts`, `RecipeRegistry.ts`, `MachineRegistry.ts`, `MilestoneManager.ts`, `FactoryEconomy.ts`.
> Gerekçeler için `DECISIONS.md` DEC-011 … DEC-019.

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
| Uçuş primi | Fabrikanın o anki $/sn geliri × kazanılan süre (en fazla 180 sn, taban $1/sn). |
| Çevrimdışı gelir | Kayıt anındaki $/sn × geçen süre (en fazla 4 saat) × %50. |

Gelir çarpanı: uçuş mesafe kilometre taşları (100 m +%5, 500 m +%10, 1.000 m +%15, 2.500 m +%20, 5.000 m +%25) ve 10. aşama ödülü (+%50).

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
| Makine seviyesi | Taban × 1,15^seviye; her seviye +%20 hız |
| Hammadde girişi | Demir 500 · Bakır 1.000 · Kum 2.500 · Polimer 2.500 (her biri 1 hammadde/sn) |
| Parseller | 12x8: 500 · 16x12: 2.500 · 20x16: 10.000 · 24x24: 30.000 |
| Roket modülü | Nakit (400–3.500) + fabrikada üretilen parçalar |
| Hızlı inşa | Eksik parça başına satış değerinin 4 katı |

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

## 7. Dengeleme Prensipleri

1. Rokete giden yol fabrikadan geçer: uçuş ve hızlı inşa hiçbir zaman üretimin yerini almaz.
2. Her yeni makine adımı geliri belirgin artırır.
3. Çıkmaz yoktur: tıklama ve ücretsiz başlangıç girişi her zaman çalışır, söküm tam iade eder.
