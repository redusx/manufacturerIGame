# ART_DIRECTION.md — Manufacturer Görsel ve Piksel Sanat Kılavuzu

> **ÖNEMLİ KURAL (Tüm Agentlar İçin):**
> Bu dosya projenin görsel, sanatsal ve arayüz (UI) standartlarının tek ve bağlayıcı kaynağıdır. Arayüz, sahne, grafik, animasyon veya görsel varlıklar üzerinde çalışacak her agent göreve başlamadan önce bu kılavuzu okumalı ve buradaki standartlara eksiksiz uymalıdır.

---

## 1. Sanat Yönü ve Dünya Bütünlüğü

* **Tür & Atmosfer:** 16-bit retro-fütüristik, endüstriyel bilimkurgu (Industrial Sci-Fi & Aerospace).
* **Birlik:** Fabrika katı, roket montaj rampası ve sağa kaydırmalı uzay uçuş alanı **aynı dünyaya** aittir:
  - **Fabrika:** Ağır çelik kaideler, presler, konveyör hatları, emniyet şeritleri ve hidrolik aksam.
  - **Rampa & Hangar:** Sarı gantry kuleleri, metal servis halkaları, yakıt ikmal hatları.
  - **Roket:** Titanyum ve aero-dinamik kompozit kaplama, modüler iticiler, neon plazma hatları.
  - **Uçuş & Uzay:** Koyu lacivert/siyanur uzay boşluğu, piksel asteroitler, başıboş siber uydular, uzay hurdaları.
* **Görsel Temel:** Tüm çizimler ve arayüzler keskin raster piksel sanatı (pixel art) ızgarasına dayanır. Vektör/SVG maket, bulanık gradyanlar veya sahte piksel filtreleri kullanılmaz.

---

## 2. Renk Paleti (16 Renkli Ana Palet)

Oyunun bütün arayüzü ve fabrikanın çevresi tek bir 16 renkli paletten doğar (DEC-048). Palet `src/ui/theme.ts` içinde `BASE`, çizim betikleri için `tools/palette.py` içinde tanımlıdır; ikisi birlikte güncellenir.

| Ad | HEX | Aile | Başlıca kullanım |
|---|---|---|---|
| `sand` | `#e1b670` | sıcak | Açık kahve: para/ödül vurgusu, "gold" düğme, krem tonlarının kaynağı, şehirde kum avlu ve kaldırım |
| `copper` | `#b96925` | sıcak | Bakır: fabrika/elle üretim, uyarı, tuğla duvar, yol çizgisi |
| `brown` | `#68392e` | sıcak | Kahve: kart ve pencere çerçevesi, soluk yazı |
| `umber` | `#201300` | sıcak | En koyu kahve: kontur, ana yazı, rozet ve çubuk yuvası dolgusu |
| `olive` | `#404e21` | yeşil | Yeşilin koyusu: düğme dudağı, ağaç gölgesi |
| `green` | `#45944f` | yeşil | Ana eylem / satın alınabilir / olumlu; şehirde çim |
| `mint` | `#77d3b2` | yeşil | Yeşilin açığı: düğme vurgusu, koyu rozette yeşil yazı, tanklar |
| `sky` | `#96bfff` | mavi | Mavinin açığı: cam, koyu rozette mavi yazı, etkin fabrika kenarı |
| `blue` | `#038ac2` | mavi | Roket / hangar / uçuş; şehirde çatı ve su |
| `teal` | `#01515e` | mavi | Mavinin koyusu: düğme dudağı, koyu çatılar |
| `navy` | `#001437` | mavi | Sahne tabanı, fabrika zemininin ve uçuş göğünün kaynağı |
| `plum` | `#503e66` | mor | Nötr (ikincil) düğme, ızgara çizgisi, şehirde asfalt |
| `purple` | `#a762a9` | mor | Tehlike / söküm / hasar (palette kırmızı yoktur) |
| `pink` | `#efa3c8` | mor | Morun açığı: düğme vurgusu, koyu rozette tehlike yazısı |
| `white` | `#ffffff` | — | Renkli düğme etiketi, koyu zeminde ana yazı, parlama |
| `black` | `#000000` | — | Yalnızca gölge ve uzay tonlarının karışımında |

**Kural:** bir renk ya bu 16 renkten biridir ya da ikisinin **adlandırılmış karışımıdır** (`TONE`). Kodda ve betiklerde serbest hex yazılmaz.

**Tek istisna (DEC-051):** söküm ve kapatma **kırmızıdır** (`EXTRA.red` `#e74c3c`, açığı `#f29488`, koyusu `#a5281b`). Yalnızca "Sök" ve "Kapat" düğmelerinde (`remove` türü) ve söküm aracının kendi göstergelerinde kullanılır; diğer tehlikeli eylemler (kaydı sıfırlama, onay pencereleri, hasar) paletin moruyla kalır.

### Türetilmiş tonlar (`TONE`)

| Ton | Karışım | Kullanım |
|---|---|---|
| `cream` `#f4e3c9` | sand → white %62 | Pencere dolgusu |
| `creamLight` `#f9f0e2` | sand → white %80 | Kart dolgusu |
| `tan` `#ecd2a6` | sand → white %38 | İç bölme (içe gömük yüzey) |
| `tanBar` `#e5c084` | sand → white %14 | Üst çubuk ve araç çubuğu tablası |
| `tanDark` `#d39b56` | sand → copper %35 | Ayırıcı çizgi, çerçeve gölgesi |
| `night`, `nightDeep` | navy → plum | Dünyadaki koyu rozet ve yedek dolgular |
| `lilac`, `mist` | plum → sky / white | Koyu zeminde çizgi ve soluk yazı |
| `faded`, `fadedLight` | brown → sand | Devre dışı düğme etiketi, soluk ikon |
| beton tonları (yalnız dokuda) | plum → white %30–62 | Açılmamış arsanın gri-eflatun betonu |

### Roller

* **Yüzeyler açıktır:** pencere krem, kart açık krem, çubuklar açık kahve; çerçeve `brown`, dış kontur `umber`, pencere kenarında `sand`/`copper` şerit ve perçinler.
* **Açık zemindeki yazı ("mürekkep") koyudur:** ana yazı `umber`, ikincil `brown`; vurgulu yazılar vurgu renginin bir koyusudur (yeşil → green+olive, mavi → blue+teal, para → copper+brown, tehlike → purple+plum). `SEMANTIC.*Hex` bunlardır.
* **Vurgular** (`SEMANTIC` sayısal değerleri) ana paletin orta tonlarıdır: `green`, `plum`, `sand`, `copper`, `blue`, `purple`. İkon, çubuk dolgusu, başlık şeridi ve düğme gövdesi aynı rengi kullanır.
* **Koyu zeminde** (rozet içi, dünya, uçuş) vurgunun açığı okunur: green → `mint`, blue → `sky`, purple → `pink` (`onDark`, `brightOf`).
* **Düğme gövdesi** orta ton, üst vurgusu ailenin açığı, alt dudağı koyusudur; etiket beyazdır (yalnız `sand` gövdede `umber`). Başlık şeridinde yazı rengi şeride göre seçilir (`inkOn`).
* **Dünya:** fabrika zemini `navy`–`plum` arası koyu tonlardır, açılmamış arsa gri-eflatun beton, çevre duvarı `sand`/`copper`/`brown` tuğla.

**Şehir arka planı** (`factory_backdrop.png`) yalnızca 16 ana rengi kullanır; ara ton, karışım ve gradyan içermez (betik bunu doğrular).

**Kapsam dışı:** makine, bant, eşya, roket ve uçuş sprite'ları kendi renklerini korur; bu palet arayüz ve fabrikanın çevresi içindir.

**Yakınlaştırma istisnası (DEC-043):** fabrika haritasının + / − düğmeleri %6,25'lik adımlarla çalışır; ara kademelerde pikseller tam katlara oturmaz. Hassas ayar için bilerek kabul edilmiştir; tekerlek, iki parmak ve otomatik sığdırma tam kademelerde kalır.

---

## 3. Piksel Ölçüsü, Grid ve Ölçekleme

1. **Temel Grid Birimi:**
   - İkonlar, toplanabilir nesneler, kurşunlar ve mermiler: **16×16 piksel**
   - Engeller ve ara boy parçalar: **24×24 piksel**
   - Roket gövdeleri: **32×20 piksel**
   - Fırlatma rampası: **48×48 piksel**
   - FX patlama/darbe kareleri: **100×100 piksel**
2. **Ölçekleme (Integer Pixel Scaling):**
   - Piksel dokuları oyun içinde **tamsayı katlarıyla** (`1x`, `1.5x`, `2x`, `2.5x`) ölçeklenir. Asla kesirli doku bozulması (pixel swimming) yaratılmamalıdır.
3. **Phaser Ayarları:**
   - `render.pixelArt = true`
   - `render.roundPixels = true`
   - `render.antialias = false`
   - Kamera hareketlerinde sub-pixel kayma önlenir; piksel ızgarası her zaman tam sayı koordinatlara oturtulur.

---

## 4. Kontur ve Gölgelendirme Kuralları

* **Dış Kontur (Outline):** Arayüz öğeleri ve şehir çizimi `1px` kalınlığında en koyu kahve (`umber`, `#201300`) kontura sahiptir; şehirde soğuk renkli yapılar `navy` kontur alabilir. Oyun sprite'ları kendi koyu konturlarını korur. Asla yumuşak blur gölge verilmez.
* **Işık Açısı:** Sol-üstten sağ-alta 45° yönlü ışık kabul edilir.
  - Üst ve sol kenarlar: `1px` açık renk vurgu (`#ffffff` %20-40 alfa veya açık palet tonu).
  - Alt ve sağ kenarlar: `1px` koyu gölge şeridi (`#000000` %30 alfa).
* **Piksel Bevel (Eğimli Kenar):** UI panelleri, düğmeler ve kartlar bu 3 katmanlı piksel kenarlık kuralıyla oluşturulur (gölge taban + gövde + üst highlight).

---

## 5. Tipografi ve Okunabilirlik Standartları

* **Yazı Tipi Ailesi:** Temiz, yüksek okunabilirlikli Sans-Serif (`Arial, Helvetica, sans-serif` veya gelecekte pixel font `Press Start 2P / Silkscreen`).
* **Hiyerarşi & Minimum Boyutlar:**
  - Ana Başlıklar & HUD Sayıları: `18px – 24px`, Kalın (Bold); açık zeminde `umber`, konturlu sayılarda `white` / `sand`.
  - Kart Başlıkları & Buton Etiketleri: `12px – 15px`, Kalın (Bold).
  - Stat Metinleri & İkincil Bilgiler: `10px – 11.5px`, açık zeminde `brown`.
  - Minimum Mobil Metin Sınırı: **Hiçbir metin `9px` altına inemez.**
* **Sayı Formatı:**
  - `formatNumber` yardımcısı kullanılır (`1.20e3`, `4.50M` gibi standart kısaltmalar).
  - Para/kaynak değerlerinin yanında daima altın sarısı `⚙` veya sikke ikonu yer alır.

---

## 6. UI Bileşen Kütüphanesi Standartları

### A. Düğmeler (Buttons)
* **Gövdeler (ana paletin orta tonları):** ana eylem `green`, ikincil `plum`, roket `blue`, fabrika `copper`, ödül/reklam `sand`, tehlike `purple`. Sök ve Kapat: palet dışı kırmızı, beyaz simge. Üstte ailenin açık tonuyla 1px parlama, altta koyusuyla dudak, çevrede `umber` kontur.
* **Etiket:** beyaz; yalnızca `sand` gövdede `umber`.
* **Devre Dışı / Yetersiz Kaynak:** soluk açık kahve, düz gövde; etiket `faded` (okunur kalacak kadar koyu). Fiyat her zaman görünür.
* **Hover:** gövde vurgu tonuna doğru açılır. **Basılı:** gövde 2px aşağı iner, dudak incelir.
* **Seçili:** `umber` çerçeve. **Odak (klavye):** `plum` çerçeve.

### B. Paneller & Kartlar (Cards & Panels)
* Pencere: krem dolgu, `umber` kontur, `sand`/`copper` şerit, `brown` iç çizgi, köşelerde perçin. Kart: açık krem dolgu, `brown` çerçeve, sol-üstte ışık. İç bölme: bir ton koyu (`tan`), içe gömük.
* Başlık şeridi ekranın vurgu rengini taşır (hangar mavi, makine bakır, katalog yeşil, onay mor); başlık yazısı şeride göre beyaz ya da `umber`.

### C. İlerleme & Durum Çubukları (Progress Bars)
* `umber` oluk, içi düz renk dolgu:
  - Can (HP): `green`; hasar ve tehlike `purple`.
  - Nitro / Boost: `blue`.
  - Hedef / ilerleme: `sand`.

### D. Bildirimler, Rozetler
* Bildirim ve öğretici kutusu: açık krem dolgu, `umber` kontur, `brown` iç çizgi.
* Rozet (chip): `umber` dolgu, vurgunun açık tonunda kontur ve yazı (`mint`, `sky`, `sand`, `pink`).

---

## 7. Proje İçi Asset Kataloğu

| Dosya Yolu (public/assets/...) | Boyut / Frame | Mevcut Görev | İleride Kullanım Alanı |
|---|---|---|---|
| `factory_bg.png` | 32×32 karo | Fabrika arka plan endüstriyel çelik duvar kaplaması | Duvar eklentileri |
| `factory_floor.png` | 64×32 karo | Fabrika tabanı: lacivert–koyu mor levhalar, üstte açık eflatun ray (`tools/generate_theme_assets.py`) | Zemin boyama/kaplama |
| `conveyor_belt.png` | 32×24 karo | Canlı animasyonlu endüstriyel taşıma bandı | Hızlı bant yükseltmesi |
| `factory_intake.png` | 48×56 piksel | Çelik hammadde giriş bunker hunisi ve hidrolik piston | Maden deposu |
| `shipping_crate.png` | 44×44 piksel | Sarı/siyah ikaz şeritli çelik sevkiyat sandığı | Otomatik paketleme kasası |
| `machine_bench.png` & `_part` | 48×48 / 20×14 | Montaj Tezgahı kaidesi ve hareketli mengene | Robotik kol |
| `machine_press.png` & `_part` | 48×48 / 28×18 | Pres Makinesi gövdesi ve dikey hidrolik piston | Ağır döküm presi |
| `machine_welder.png` & `_part` | 48×48 / 24×16 | Kaynak Robotu gövdesi ve döner lazer kafası | Çoklu kaynak ünitesi |
| `machine_automation.png` & `_part` | 48×48 / 32×16 | Otomasyon Hattı gantrisi ve hareketli taşıyıcı | Siber konveyör köprüsü |
| `machine_empty_slot.png` | 48×48 piksel | Kilitli veya boş makine montaj yuvası | Boş slot göstergesi |
| `flight_ground.png` | 64×32 karo | Eski yol zemini; artık yüklenmiyor (yerini `flight/ground_*.png` aldı) | — |
| `flight/ground_*.png` (10 yüzey) | 256×64 şerit | Menzil bölgesinin gezegen yüzeyi: çayır, çöl, buzul, Ay, Mars, asteroit, Jüpiter, Satürn, Uranüs, Neptün. Zemin çizgisi 16. satırda; `tools/generate_flight_ground.py` | Yeni bölgeler |
| `items/<eşya>.png` (22 eşya) | 16×16 piksel | Eşyanın biçimini anlatan çizimi (cevher, toz, külçe, levha, bobin, dişli…); bantta, pencerelerde ve fiyat listesinde. `tools/generate_item_assets.py` | Yeni eşyalar |
| `launch_platform.png` | 72×40 piksel | Ağır çelik roket fırlatma tablası ve gantry iskelesi | Orbital fırlatma kulesi |
| `sky_band_space.png` | 64×64 karo | Uzay boşluğu yıldızlı gökyüzü bandı | Nebula ve derin uzay |
| `ui_panel_hud.png` | 32×32 (9-slice) | Ana kaynak HUD'ı piksel çerçevesi | Üst durum barları |
| `ui_card_bg.png` | 32×32 (9-slice) | Makine ve roket yükseltme kartları zemin/çerçevesi | Görev kartları |
| `ui_modal_bg.png` | 32×32 (9-slice) | Ayarlar, pause, kaza ve uçuş raporu dialog çerçevesi | Tam ekran pencereler |
| `ui_toast_bg.png` | 24×24 (9-slice) | Milestone ve ödül bildirim popupları kutusu | Uyarı diyalogları |
| `btn_green_normal/hover/pressed.png` | 32×24 (9-slice) | Satın alma ve geliştirme butonları | Onay butonları |
| `btn_disabled.png` | 32×24 (9-slice) | Yetersiz bakiye / devre dışı buton durumu | Kilitli butonlar |
| `btn_danger_normal/pressed.png` | 32×24 (9-slice) | Sıfırlama ve acil durum butonları | İptal butonları |
| `btn_manual_normal/hover/pressed.png` | 40×32 (9-slice) | Fabrika içi arcade manuel üretim butonu | Çekiç/el aleti butonu |
| `btn_launch_normal/hover/pressed.png` | 40×32 (9-slice) | Hangar içi dev fırlatma konsolu butonu | Acil kalkış butonu |
| `btn_tab_active/inactive.png` | 32×24 (9-slice) | Fabrika ve Roket sekmeleri butonları | Ek menü sekmeleri |
| `ui_bar_slot.png` & `ui_bar_fill_*.png` | 32×12 / 16×8 | HP, Boost ve Milestone ilerleme çubuğu çerçeve ve dolguları | Isı, kalkan göstergeleri |
| `icon_*.png` (coin, gear, trophy...) | 16×16 piksel | Merkezi UI ikon seti (sikke, dişli, roket, kupa, ayarlar); elle çizilmiştir, renkleri `tools/recolor_ui_icons.py` ile palete çekilir | Mini HUD ikonları |
| `pixelart/coins/spr_coin_ama.png` | 64×16 (4f: 16×16) | Altın dönen sikke: HUD, sevkiyat jetonu, uçuş parçası | Görev ödülleri, mağaza |
| `pixelart/coins/spr_coin_azu.png` | 64×16 (4f: 16×16) | Mavi sikke/kristal: Nitro enerji orbu | Özel araştırma para birimi |
| `pixelart/coins/spr_coin_roj.png` | 64×16 (4f: 16×16) | Kırmızı sikke/cevher | Yüksek riskli asteroit madeni |
| `pixelart/coins/spr_coin_gri.png` | 64×16 (4f: 16×16) | Ham demir parça | Temel hammadde simgesi |
| `pixelart/ui/ui_buttons_elements.png` | 320×160 | Buton çerçeveleri, yıldızlar, oklar, segmentler | Mobil D-pad, rozetler |
| `pixelart/ui/ui_banners_badges.png` | 272×144 | Kanatlı kalkanlar, teknolojik başlık şeritleri | Milestone zafer banner'ı |
| `pixelart/ui/ui_card_frames.png` | 256×160 | 4 renkli piksel kart yuvaları | Makine yuvaları, envanter |
| `pixelart/ui/ui_bars_gauges.png` | 336×240 | Bevel gösterge çubukları (yeşil, sarı, kırmızı, mavi) | HP ve Boost barları |
| `pixelart/ui/ui_meters_beveled.png` | 256×240 | Segmentli pil/yakıt göstergeleri | Aşırı ısınma göstergesi |
| `pixelart/fx/bullets_fire_16x16.png` | 640×400 | Ateş kıvılcımları, egzoz partikülleri | Makine pres kıvılcımı |
| `pixelart/fx/bullets_plasma_16x16.png`| 640×400 | Plazma mermileri, lazer ışını | Otomasyon lazeri, boost akışı |
| `pixelart/fx/hit_spark_spritesheet.png`| 600×600 (6×6 100px)| Çarpışma darbe kıvılcımı | Asteroit darbe efekti |
| `pixelart/fx/fire_explosion_spritesheet.png`| 800×800 (8×8 100px)| Patlama animasyonu | Roket kaza patlaması |
| `pixelart/fx/bluefire_spritesheet.png`| 800×800 (8×8 100px)| İyon itici dalgalanması | Boost süpersonik ateşleme |
| `rocket_hull_*.png` (1-3) | 32×20 | Seviyeye göre roket gövdesi | Yeni gövde kademeleri |
| `rocket_engine_*.png` (1-3) | 16×16 | Seviyeye göre roket motoru | Yeni motor tipleri |
| `rocket_wings_*.png` (1-3) | 16×20 | Seviyeye göre yön kanatları | Özel aerodinamik parçalar |
| `rocket_tank_*.png` (1-3) | 16×16 | Harici nitro yakıt tankı | Kimyasal yakıt tankları |
| `launch_pad.png` | 48×48 | Eski tek rampa çizimi; artık yüklenmiyor | — |
| `launch_pads/launch_pad_1..10.png` | 48×48 | Rampanın her seviyesinin görünümü (sarı kule → tank → çelik → ikinci kule → anten → enerji rayı → plazma → altın); `tools/generate_launch_pad.py` | — |
| `ui/bar_bg.png`, `ui/dock_bg.png`, `ui/pattern.png` | 32×32 | Tema dokuları: kenarı şeritli açık kahve çubuklar, panellerin ince ızgarası; `tools/generate_theme_assets.py` (kart, iç bölme, pencere, bildirim, zemin, beton, duvar ve patron portresini de üretir) | — |
| `factory_backdrop.png` | 1024×1024 karo (indeksli, 16 renk) | Fabrikanın çevresindeki minyatür sanayi şehri: 3/4 bakış, bulvarlar, 16 ada (çelik fabrikası, tank sahası, depolar, santral, konteyner sahası, yük garı, silolar, atölyeler, güneş tarlası, gaz tesisi, araç deposu, idari bina, park, işçi evleri). Kesintisiz döşenir; `tools/generate_city_backdrop.py` | Yeni ada türleri |
| `factory_concrete.png`, `factory_fence_h/v.png` | 32×32 / 8×6 | Açılmamış arsanın gri-eflatun betonu ve tuğla çevre duvarı | — |
| `boss.png` | 32×32 | Giriş ekranındaki patron portresi (beyaz baret, koyu mor ceket) | — |
| `obstacle_asteroid.png` | 24×24 | Kırık kraterli uzay asteroiti | Parçalanabilir asteroitler |
| `obstacle_drone.png` | 24×24 | Kırmızı gözlü devriye dronu | Ateş eden düşman dronları |
| `obstacle_debris.png` | 24×24 | Uydu hurda enkazı | Manyetik hurda madenciliği |

---

## 8. Animasyon Standartları

* **Konveyör & Üretim:**
  - Bant kayma hızı: Sabit adımda kayan dişler (60 px/sn).
  - Ürün teslimi: Sandıktan HUD'a 400ms İkinci Dereceden Bezier yay uçuşu.
* **Roket Uçuşu:**
  - Yatay eğim (Pitch): Yön tuşlarına göre ±10° yay yumuşatması (`Linear 0.15`).
  - Titreşim / Rölanti: ±1.5px periyodik dikey mikro süzülme (`Sine`).
  - Boost Ateşlemesi: Alev sprite'ı süpersonik mavi alev ile değişir, ekran 50ms hafif sarsılır.
* **Kazanım & Ödül:**
  - HUD darbesi (Pulse): `1.15x` scale, 70ms yoyo `Quad.easeOut`.
  - Sayı artışında yukarı uçan yeşil/altın metin (`+N Parça`, 550ms, fade-out).

---

## 9. Uygulanmayacaklar (Strict Anti-Patterns)

1. **SVG veya Vektör Çizimler:** SVG formatında görsel öğe veya canvas vektör maketleri kesinlikle eklenemez.
2. **Phaser Graphics ile Şekil Çizimi:** `add.graphics()`, `add.circle()`, `add.ellipse()`, `fillStyle`, `lineStyle`, `strokeRect`, `fillRect`, `lineBetween` gibi çağrılar görünen oyun içeriği (makine, roket, ikon, parçacık, kıvılcım) üretmek için kullanılamaz. Bunlar gerçek raster PNG sprite'larla yapılır.
   - **İstisna:** Modal/overlay arka planları için `add.rectangle()` kullanılabilir — görünen UI öğesi değil, yarı-saydam maske rolündedir.
3. **Bulanık Doğrusal Ölçekleme (Linear Filter):** Doku filtrelerinde `LINEAR` kesinlikle yasaktır; daima `NEAREST` kullanılır.
4. **Uyuşmayan Temalar:** Ortaçağ fantezi büyü efektleri (felspell, buz büyüleri) veya RPG Maker kanlı oda karoları (`Inside_C.png`) oyuna dahil edilemez.
5. **Sub-pixel Bulanıklığı:** Sprite pozisyonlarında ondalıklı koordinatlar `Math.round()` ile tam sayıya yuvarlanmalıdır (`roundPixels`).
6. **Görsel Yığılması:** HUD ve butonlar, oyun alanını (fabrikayı ve roketi) kapatacak devasa opak menülere dönüşemez.

---

## 10. Agent Kontrol Listesi (Checklist)

Herhangi bir UI veya görsel görev tamamlandığında şunları doğrula:
- [ ] Yeni görsel `public/assets/pixelart/` veya standart dizinde raster PNG olarak mı yer alıyor?
- [ ] Renkler `src/ui/theme.ts` (`BASE`, `TONE`, `SEMANTIC`) ya da `tools/palette.py` içinden mi alındı? (Serbest hex yazılmadı mı?)
- [ ] Phaser doku ayarlarında `pixelArt: true` ve `roundPixels: true` korundu mu?
- [ ] Masaüstü (1920×1080) ve Mobil (dar dikey) ekranlarda metinler ve butonlar kesintisiz okunabiliyor mu?
- [ ] Butonların satın alınabilir (yeşil) ve satın alınamaz (soluk açık kahve) durumları açıkça ayırt ediliyor mu?
- [ ] Dokular bulanıklaşmadan keskin piksel görünümünü koruyor mu?
