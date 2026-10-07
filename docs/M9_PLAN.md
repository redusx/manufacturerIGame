# M9_PLAN.md — "Daha İleri": 10. Aşama Sonrası Uzun Vadeli Döngü

> **Durum:** 🎯 Plan — henüz hiçbir şey uygulanmadı. ❓ işaretli maddeler kullanıcı onayı bekliyor (§9).
> **Hazırlanma:** 2026-10-08. **Dayanak:** kod, başsız simülasyon ve gerçek oyunda bot uçuşları (§2).
> **Bağlayıcı kurallar:** `INCREMENTAL_DESIGN_RULES.md`, `DECISIONS.md` (DEC-009, 011, 012, 015, 017, 018) ve CrazyGames reklam gereksinimleri (§4.5).
> Buradaki bütün sayılar **başlangıç değeridir**; M9-F'de ölçülerek ayarlanır (M7'de yapıldığı gibi).

---

## 1. Nihai Hedef

İlk 10 aşama oyunu öğretir. Sonrasında oyuncunun tek, kendini yenileyen bir genel hedefi olur: **roketi geliştir ve bir öncekinden daha ileri git.**

```
Fabrikayı büyüt ve optimize et ──► parça + nakit ──► roketi yükselt ──► daha ileri uç
        ▲                                                                    │
        └── kalıcı gelir çarpanı · yeni parsel izni · yeni roket kademesi ◄──┘
```

Her tur bir öncekinden pahalıdır (üstel maliyet), her yeni menzil fabrikayı kalıcı olarak güçlendirir (çarpansal büyüme). Ulaşması zor hedefler her zaman oynayarak ulaşılabilir kalır; reklam yalnızca yolu kısaltır ve geliştiriciye gelir sağlar.

**Başarı ölçütleri (M9 bittiğinde doğrulanacak):**

1. 10. aşamadan sonra ekranda her an bir sonraki menzil hedefi ve ona giden somut adım görünür.
2. Hiçbir roket yükseltmesi parça üretmeden tamamlanamaz (parçaların en az %60'ı fabrikadan gelir).
3. Bütün ara ve son ürün zincirlerinin roket için bir işi vardır (bugün birçoğu hiç üretilmeden oyun bitiyor).
4. Reklam izlemeyen oyuncu için içerik en az 8–10 saattir ve "5 dakikadan uzun süre alınacak hiçbir şey yok" boşluğu oluşmaz.
5. Hiçbir hedef reklama bağlı değildir; reklam izleyen oyuncu yaklaşık 1,5–2 kat hızlı ilerler.

---

## 2. Bugünkü Durum (✅ ölçüldü)

### 2.1 Roket

| | Değer |
|---|---|
| Modül / seviye | 4 modül × 3 seviye = toplam 8 yükseltme |
| Toplam nakit | $13.250 |
| Toplam parça | 5 çerçeve, 8 kompozit panel, 6 motor, 5 itici blok, 6 mikroçip, 6 güdüm bilgisayarı, 70 plastik |
| Hiç üretmeden bitirmek | Hızlı inşa ile parçalar $21.960 + nakit $13.250 = **$35.210** (4. parselin bedeli kadar) |

Sonuç: roketin tamamı tek bir parsel fiyatına, hiçbir parça üretmeden alınabiliyor. Mikroçip, sensör, cam blok, kart tabanı ve güdüm bilgisayarı zincirleri kurulmadan oyun bitiyor.

### 2.2 Uçuş mesafesi

| Roket seviyesi | Nitro kullanmadan | Nitro basılı | Düşerken nitro (iyi oyuncu) | Kaynak |
|---|---|---|---|---|
| 1 | 76 m / 2,4 sn | 1.525 m / 20 sn | 1.325 m / 12 sn | gerçek oyun (bot) |
| 3 (bugünkü son) | — | 3.435 m / 43 sn | 6.164 m / 39 sn (2 kristalle) | gerçek oyun (bot) |
| 5 | 2.066 m | 5.862 m / 75 sn | 9.203 m / 61 sn | simülasyon |
| 10 | 5.951 m | 13.975 m / 200 sn | 32.669 m / 207 sn | simülasyon |

Simülasyon oyunun kendi formüllerini kullanır ve gerçek oyunla aynı sonucu verdi (Sv.1: 1.525 m ↔ 1.525 m; Sv.3: 3.439 m ↔ 3.435 m). Engeller simülasyonda yok sayıldı.

**Kristal etkisi (simülasyon):** kristal, yakıtın %25'ini ve nitronun %35'ini *kapasiteye oranla* dolduruyor; seviye arttıkça her kristal daha çok saniye veriyor.

| Seviye | Kristal toplamadan | Kristallerin %30'u | Kristallerin %60'ı |
|---|---|---|---|
| 3 | 4,2 km / 31 sn | 9,8 km / 65 sn | 27 km / 174 sn |
| 4 | 6,3 km / 42 sn | 17 km / 102 sn | 165 km / 16 dk (40 uçuşun 6'sı 30 dk sınırına takıldı) |
| 5 | 9,2 km / 60 sn | 46 km / 4,5 dk | 40 uçuşun 38'i 30 dk sınırına takıldı |
| 6 | 12,8 km / 85 sn | 40 uçuşun 14'ü sınıra takıldı | hepsi sınıra takıldı |

Yani **Sv.4'ten itibaren kristal toplayan oyuncuda uçuş bitmemeye başlıyor.**

Sonuçlar:

1. Mevcut 5 menzil taşının (100 m … 5 km) hepsi iyi oynayan oyuncuda Sv.1–3'te düşüyor; "daha ileri" hedefi 5 km'de bitiyor.
2. **Yalnızca seviye eklemek hedefi bozar:** Sv.4'ten sonra kristal toplayan oyuncu için mesafe sınırsızlaşır. Önce uçuşun sınırlanması gerekir (§4.2).
3. Mesafe beceriye aşırı duyarlı: aynı roketle 76 m de 1.525 m de mümkün.
4. Gövde seviyesi mesafeyi etkilemiyor; uçuş can bitince değil, yere çakılınca bitiyor.

### 2.3 Fabrika ekonomisi

- Hammadde başına en yüksek değer: itici blok **$50**, güdüm bilgisayarı $45,7, motor $25, dişli $18 (8 hammadde → $400 vb.).
- Hammadde girişi sabit fiyatlı ($500–2.500) ve geç oyunda bedavaya yakın. Makine seviyesi sınırsız ve ucuz (taban × 1,15^seviye, +%20 hız). Bant en fazla 2 eşya/sn taşır.
- Alan 24x24 = 576 hücrede bitiyor; son parsel $30.000.
- Gelir çarpanı en fazla 2,25 (menzil taşları +%75, 10. aşama +%50).
- Geç oyunda paranın harcanacağı anlamlı bir yer kalmıyor.

### 2.4 Reklam ve hedef

- Tek reklam yeri: çevrimdışı kazancı ikiye katlama. SDK yokken ödül bedava veriliyor.
- 10. aşamadan sonra oyunda hedef yok. `ContractManager` depoda ama bağlı değil.

---

## 3. Tasarım İlkeleri

1. **Tek genel hedef, hep görünür:** "Sıradaki menzil" ve onu engelleyen şey (hangi modül, hangi parça, ne kadar para) her an okunur.
2. **Rokete giden yol fabrikadan geçer:** parça şartı gerçek olur; nakit üretimin yerini tutamaz (DEC-012 ve DEC-018 güçlendirilir).
3. **Üstel maliyet, çarpansal büyüme:** maliyetler seviye başına katlanır; karşılığında her menzil gelire çarpan ekler.
4. **Yayılmak pahalı, yerinde iyileştirmek akıllıca:** yeni alan çok pahalıdır; oyuncu önce elindeki alanı sıkıştırır ve hızlandırır.
5. **Her eşik görünür bir şey değiştirir:** yeni roket görünümü, yeni uçuş bölgesi, yeni parsel (kural 6).
6. **Reklam hızlandırır, kapı değildir:** her reklam ödülünün reklamsız bir yolu vardır.
7. **Önce ölç, sonra sayı yaz:** her tablo simülasyon ve gerçek oynayışla doğrulanır.

---

## 4. Sistemler (🎯 planlanan)

### 4.1 Genel hedef: Menzil merdiveni ("Seferler")

Mevcut 5 taş ve ödülleri aynen kalır. Üstüne yeni basamaklar eklenir. Her basamak bir menzil hedefidir; ulaşılınca kalıcı ödül verir ve bir sonraki kademenin kilidini açar.

| # | Menzil | Ad (öneri) | Beklenen donanım | Ödül |
|---|---|---|---|---|
| 1–5 | 0,1 · 0,5 · 1 · 2,5 · 5 km | mevcut adlar | Sv.1–3 | +%5 … +%25 (değişmez); 5 km ayrıca **Mk II iznini** (Sv.4–6) açar |
| 6 | 7 km | Ay Geçişi | tüm modüller Sv.4 | gelir ×1,25 · 28x24 parsel izni |
| 7 | 10 km | Ay Üssü | Sv.5 | gelir ×1,25 · çevrimdışı süre 4 → 8 saat |
| 8 | 14 km | Mars Transferi | Sv.6 | gelir ×1,25 · **Mk III izni** (Sv.7–9) · 28x28 parsel izni |
| 9 | 20 km | Mars Yörüngesi | Sv.7 | gelir ×1,25 |
| 10 | 28 km | Asteroit Kuşağı | Sv.8 | gelir ×1,25 · 32x28 parsel izni |
| 11 | 40 km | Jüpiter | Sv.9 | gelir ×1,25 · **Mk IV izni** (Sv.10) · 32x32 parsel izni · çevrimdışı 12 saat |
| 12 | 55 km | Satürn Halkaları | Sv.10 | gelir ×1,25 |
| 13–14 | 75 · 100 km | Dış Gezegenler | Sv.10 + ustalık | gelir ×1,15 (ustalık hedefi; ileride yeni kademelere bağlanır) |

- Çarpanlar bileşiktir: 2,25 × 1,25⁷ ≈ **10,7** (ustalık basamaklarıyla ≈ 14).
- Karşılıklı kilit: daha ileri gitmek için seviye, bir sonraki seviye kademesi için menzil gerekir. Böylece ne yalnız parayla ne yalnız beceriyle atlanır.
- Menzil sayıları uçuş yeniden ayarlandıktan sonra (§4.2) ölçülen "Sv → mesafe" tablosundan türetilir; yukarıdakiler hedef biçimidir.

### 4.2 Uçuşun yeniden ayarı (önkoşul)

**Hedef davranış:** ulaşılan mesafe esas olarak roket seviyesine bağlıdır; beceri bunu en fazla ±%25 oynatır. Bir uçuş 30–100 saniye sürer. Dört modülün dördü de sonucu etkiler.

| Sorun (§2.2) | Değişiklik |
|---|---|
| Kristal kapasiteye oranla dolduruyor → üst seviyede sonsuz uçuş | Kristal **sabit** miktar doldurur (ör. +0,8 sn yakıt, +0,6 sn nitro), seviyeden bağımsız |
| Mesafe beceriye aşırı duyarlı | Nitro verimi dengelenir; "hep basılı tut" ile "ustaca kullan" arası fark ±%25'e iner |
| Gövde etkisiz | Mesafe arttıkça engel yoğunluğu ve hasarı artar; ileri bölgelerde yetersiz gövde uçuşu bitirir |
| Üst seviyede uçuş 3+ dakika | Üst seviyeler süreyi değil **hızı** büyütür (itiş ve fırlatma hızı çok, yakıt süresi az artar) |
| "Daha ileri"nin görsel karşılığı yok | Menzil bölgeleri: her basamakta arka plan/renk değişir ve geçiş duyurulur |

Kabul ölçütü: her seviyede 20 bot uçuşunun ortalaması §4.1'deki "beklenen donanım" menziline ±%25 içinde düşer; hiçbir seviyede uçuş 2 dakikayı geçmez.

### 4.3 Roket seviyeleri

- Üst sınır **Sv.10** (❓ K1): 4 modül × 7 yeni seviye = 28 yeni yükseltme. Kademeler: Mk I (Sv.1–3), Mk II (4–6), Mk III (7–9), Mk IV (10). Her kademede modülün görünümü değişir (yeni sprite'lar üretilir).
- Her yükseltme **hem nakit hem parça** ister.

**Nakit:** `taban × 2,4^(Sv − 4)`; taban: gövde $30.000 · motor $40.000 · kanat $35.000 · nitro $25.000.

| Kademe | Dört modülün toplamı |
|---|---|
| Sv.4 | $130.000 |
| Sv.5 | $312.000 |
| Sv.6 | $749.000 |
| Sv.7 | $1,8 M |
| Sv.8 | $4,3 M |
| Sv.9 | $10,4 M |
| Sv.10 | $24,8 M |
| **Toplam** | **≈ $42,5 M** |

**Parça:** `adet = taban × 1,8^(Sv − 4)` (5'in katına yuvarlanır). Karışım bütün zincirleri kapsar:

| Modül | Sv.4 tabanı | Sonradan eklenen |
|---|---|---|
| Gövde | 40 Güçlendirilmiş Çerçeve · 30 Kompozit Panel | Sv.7'den itibaren Hassas Cam Blok (60'tan başlar) |
| Motor | 40 Elektrik Motoru · 12 İtici Blok | Sv.7'den itibaren Hassas Dişli (100) |
| Kanat | 30 Mikroçip · 10 Güdüm Bilgisayarı | Sv.5'ten itibaren Optik Sensör (30) |
| Nitro | 200 Plastik Pelet · 40 Yalıtkan Kart Tabanı | Sv.6'dan itibaren Bakır Tel Bobini (150) |

Sv.10'da örnek: 1.360 motor, 408 itici blok, 340 güdüm bilgisayarı. Tek montaj istasyonu saatte 360 itici blok üretir; dört yükseltilmiş istasyon aynı işi dakikalara indirir. Optimizasyonun ödülü budur.

**Kurallar:**

- **Hedef modül:** oyuncu bir modülü "hedef" seçer; ihracattan yalnızca onun parçaları hangara ayrılır, gerisi satılmaya devam eder. (Bugün dört modülün ihtiyacı birden ayrılıyor; büyük adetlerde geliri kilitler.)
- **Hızlı inşa sınırlanır** (❓ K4): her parçanın en fazla %25'i nakitle tamamlanabilir; birim fiyat güncel satış değerinin (çarpan dahil) 10 katıdır. Bugünkü kural (sınırsız, 4×) çarpan büyüdükçe üretmekten ucuza geliyor.
- Mk kademeleri menzille açılır (§4.1).

### 4.4 Fabrika ekonomisinin ölçeklenmesi

| Kalem | Bugün | Plan |
|---|---|---|
| Hammadde girişi | Sabit ($500–2.500) | Aynı hammaddenin n. girişi `taban × 1,5^(n−1)`: demir 500 · 750 · 1.125 … 10.'su 19.200 · 15.'si 146.000 (❓ K7) |
| Parseller | 24x24'te biter ($30.000) | 28x24 **$250.000** · 28x28 **$1,5 M** · 32x28 **$8 M** · 32x32 **$40 M**; her biri bir menzil izni ister (❓ K6) |
| Makine seviyesi | taban × 1,15^seviye, sınırsız | Sv.10'a kadar aynı; üstü için ölçüme göre daha dik eğri (M9-F'de karar) |
| Gelir çarpanı | en fazla 2,25 | menzil basamaklarıyla ≈ 10,7'ye kadar (§4.1) |
| Çevrimdışı gelir | 4 saat, %50 | menzil ödülüyle 8 ve 12 saat |

Yeni parsel bedeli o andaki gelirin kabaca 45–60 dakikasıdır: bir roket kademesinden pahalı. Oyuncu ya mevcut alanını sıkıştırıp makinelerini yükseltir ya da biriktirir; reklam indirimi üçüncü yoldur (§4.5).

Teknik not: ızgara 24x24 sabit kuruluyor; 32x32 için ızgara, kamera sığdırma ve performans (bant ve eşya çizimi) ele alınır ve ölçülür.

### 4.5 Reklam (şimdilik yalnızca yerleşim; SDK en son)

**Uyulacak kurallar** (CrazyGames reklam gereksinimleri ve `INCREMENTAL_DESIGN_RULES.md` kural 11):

- Ödüllü reklam isteğe bağlıdır; hiçbir hedef yalnızca reklamla ulaşılır olmaz.
- Reklam düğmesi etkin oyun ekranında durmaz; yalnızca pencerelerin içinde, hep aynı yerde ve video simgesiyle yer alır.
- Sık sunulmaz: bekleme süresi sayaçla gösterilir ya da düğme gizlenir. Tek ödül için birden fazla reklam istenmez.
- Reklam bittiğinde ödül açıkça gösterilir; reklam gösterilemezse ödül **verilmez**. Reklam yokken (ör. Basic Launch, reklam engelleyici) etkisiz düğme bırakılmaz.
- Reklam başladığında oyun durur ve ses kısılır; bitince döner.
- Her ödülün reklamsız bir alternatifi bulunur.

**Yerleşimler:**

| # | Yer | Ödül | Sıklık | Reklamsız yol |
|---|---|---|---|---|
| R1 | Çevrimdışı kazanç penceresi (mevcut) | Kazancı 2 katına çıkar | Her dönüşte 1 | Normal topla |
| R2 | Uçuş raporu | Uçuş primini 3 katına çıkar | Uçuş başına 1, 3 dk bekleme | Normal dön |
| R3 | "Takviye" penceresi (HUD'daki gelir rozetinden açılır) | 10 dk boyunca fabrika geliri ×2 (en fazla 30 dk biriktirilir) | 5 dk bekleme | Nakitle al: 5 dakikalık gelir |
| R4 | Hangar, hedef modül kartı | "Parça kargosu": eksik parçaların %15'i | 10 dk bekleme | Üret ya da hızlı inşa |
| R5 | Parsel satın alma onayı | "Müteahhit indirimi": o parselde %15 | Parsel başına 1 | Tam fiyat |
| G1 | Uçuştan fabrikaya dönüş (❓ K8) | Geçiş reklamı; ödül yok | SDK 3 dakikada 1 ile sınırlar; aynı arada R2 izlendiyse istenmez | — |

**Mimari:**

- `AdService` (saf TypeScript): yerleşim kayıtları, bekleme süreleri, "sunulabilir mi", sonucu döndüren tek istek noktası. Durumu kayda yazılır.
- Sağlayıcı arayüzü ve iki uygulama: şimdi **sahte sağlayıcı** ("REKLAM ALANI — deneme" yazan, birkaç saniyelik bir pencere gösterip ödülü veren), en son **CrazyGames sağlayıcısı**.
- Mod tek ayardan seçilir: `sahte` · `crazygames` · `kapalı`. `kapalı`da bütün reklam düğmeleri gizlenir.
- Mevcut çevrimdışı 2× düğmesi bu servise taşınır; SDK yokken bedava ödül verme açığı kapanır.

### 4.6 Arayüz

- **Hedef kartı:** 10. aşamadan sonra sıradaki menzili gösterir ("SEFER 7 · 10 km'ye ulaş · rekor 7,4 km"). Dokununca **Seferler** penceresi açılır: bütün basamaklar, ödülleri ve "önerilen donanım".
- **Hangar:** 10 seviye (kademe rozetiyle), çoklu parça satırları, hedef modül iğnesi, hızlı inşa sınırı, R4 düğmesi; başlıkta sıradaki menzil.
- **Uçuş:** bölge geçiş duyurusu; raporda sıradaki menzile kalan mesafe ve R2 düğmesi.
- **Katalog:** yeni parseller "izin gerekli" durumuyla; girişlerde artan fiyat.
- **HUD:** takviye etkinken "×2 · 08:41" göstergesi (gösterge reklam düğmesi değildir).

### 4.7 Kayıt

- Mevcut kayıtlar korunur (❓ K9): Sv.1–3 ve kazanılmış çarpanlar geçerli kalır; yeni alanlar varsayılanla eklenir.
- Yeni merdiven için rekor ayrı tutulur ve sıfırdan başlar (❓ K3); aksi hâlde eski fizikle yapılmış rekorlar yeni basamakları anında geçer.

---

## 5. Hedef Tempo ve Denge Yöntemi

Reklam izlemeyen oyuncu için başlangıç hedefi (gelir sütunu **varsayımdır**, ölçülecek):

| Kademe | Beklenen gelir | Kademe nakdi | Nakit süresi |
|---|---|---|---|
| Sv.4 | $150/sn | $130.000 | ≈ 14 dk |
| Sv.5 | $300/sn | $312.000 | ≈ 17 dk |
| Sv.6 | $600/sn | $749.000 | ≈ 21 dk |
| Sv.7 | $1.100/sn | $1,8 M | ≈ 27 dk |
| Sv.8 | $2.000/sn | $4,3 M | ≈ 36 dk |
| Sv.9 | $3.500/sn | $10,4 M | ≈ 50 dk |
| Sv.10 | $6.000/sn | $24,8 M | ≈ 69 dk |

Roket nakdi toplam ≈ 4 saat; parseller, girişler ve parça toplama ile hedef 8–10 saat ve üstü. Gelirin 150'den 6.000 $/sn'ye çıkması çarpanlardan (≈ ×4,8) ve fabrikanın büyümesinden (alan, seviye, optimizasyon: ≈ ×8) beklenir.

**Yöntem:**

1. Uçuş için başsız simülasyon aracı (oyunun formülleriyle) ve oyun içinde bot doğrulaması.
2. Fabrika için M7'deki tempo botunun 10. aşama sonrasına uzatılması: her kademede gelir, parça üretim hızı ve bekleme süresi ölçülür.
3. Bütün sayılar tek veri dosyasında tutulur; tablo değişince kod değişmez.
4. Kabul: her yükseltme 10–70 dk aralığında, parça bekleme süresi nakit süresini aşmıyor, 5 dakikadan uzun "alınacak hiçbir şey yok" boşluğu yok.

---

## 6. Uygulama Fazları

Her faz tek başına teslim edilir: uygulanır, tarayıcıda (telefon ve masaüstü) doğrulanır, belgeler güncellenir, commit ve push edilir.

| Faz | Kapsam | Doğrulama |
|---|---|---|
| **M9-A** Uçuşu ölç ve sınırla | §4.2: sabit kristal dolumu, mesafeyle artan zorluk, hız ölçeği, bölgeler; simülasyon aracı | Her seviyede 20 bot uçuşu; "Sv → mesafe" tablosu çıkar |
| **M9-B** Roket seviyeleri | §4.3: veriyle tanımlı Sv.10 tablosu, Mk izinleri, hedef modül, hızlı inşa sınırı, yeni roket görselleri, hangar arayüzü | Parça toplayarak Sv.3 → 4; kayıt/yükleme |
| **M9-C** Menzil merdiveni ve genel hedef | §4.1 ve §4.6: basamaklar, ödül türleri, hedef kartı, Seferler penceresi, uçuş raporu | 10 aşaması bitmiş kayıtla hedef kartı; bir basamak geçilince ödül |
| **M9-D** Ekonomi ölçeği | §4.4: giriş fiyatı, yeni parseller, 32x32 ızgara ve performans | 32x32'de kare hızı ölçümü; kayıt uyumu |
| **M9-E** Reklam altyapısı (görüntü amaçlı) | §4.5: `AdService`, sahte sağlayıcı, R1–R5, bekleme süreleri | Her yerleşim; "reklam gösterilemedi" senaryosu |
| **M9-F** Denge geçişi | §5: tempo botu, tabloların ayarı, `ECONOMY.md` | Ölçülen tempo tablosu |
| **M9-G** CrazyGames SDK (en son) | Gerçek sağlayıcı, G1, yayın kontrol listesi | CrazyGames QA aracıyla |

Sıra bağımlılığa göredir: merdiven uçuşun sınırlanmasına, seviyeler merdivene, denge hepsine dayanır. Reklam altyapısı D'den bağımsızdır; istenirse öne alınabilir.

---

## 7. Riskler

| Risk | Önlem |
|---|---|
| Uçuş hissi değişir | M9-A sonunda elde oynayarak onay; eski/yeni karşılaştırması |
| 32x32'de performans düşer | Önce ölçüm; gerekirse 28x28'de durulur |
| Denge tutmaz | Simülasyon + gerçek oynayış; sayılar tek veri dosyasında |
| Reklam kurallarına aykırılık | §4.5; SDK bağlanmadan önce güncel doküman yeniden okunur |
| Eski rekorlar yeni merdiveni anında geçer | Merdiven için ayrı rekor (§4.7) |
| Kapsam büyük | Yedi bağımsız faz; her biri oynanabilir durumda biter |

---

## 8. Kapsam Dışı

Prestij / sıfırlama (DEC-015), yeni makine, eşya ya da hammadde, ikinci para birimi, kontratlar (`ContractManager` bağlanmaz), bulut kayıt, oyun içi satın alma, yeni dil.

---

## 9. Onay Bekleyen Kararlar (❓)

| # | Karar | Öneri |
|---|---|---|
| K1 | Roket üst sınırı | Sv.10 (ileride uzatılabilir) |
| K2 | Uçuşun yeniden ayarlanması (§4.2) | Onay: bu olmadan "daha ileri" hedefi kurulamıyor; uçuş hissi değişir |
| K3 | Yeni merdivende rekor | Sıfırdan başlasın; kazanılmış çarpanlar kalsın |
| K4 | Hızlı inşa | En fazla %25, fiyat güncel satış değerinin 10 katı |
| K5 | Menzil ödülü | Bileşik ×1,25 (toplamalı değil) |
| K6 | Parseller | 32x32'ye kadar 4 yeni parsel, menzil izniyle, §4.4 fiyatlarıyla |
| K7 | Giriş fiyatı | n. giriş ×1,5 artan |
| K8 | Reklam yerleşimleri | R1–R5; geçiş reklamı (G1) kararı ayrıca |
| K9 | Mevcut kayıtlar | Korunsun |

---

## Kaynaklar

- CrazyGames reklam gereksinimleri: <https://docs.crazygames.com/requirements/ads/>
- CrazyGames SDK video reklamları: <https://docs.crazygames.com/sdk/video-ads/>
