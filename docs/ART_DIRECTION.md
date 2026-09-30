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

## 2. Renk Paleti (Harmonious Industrial Pixel Palette)

Tüm arayüz ve oyun nesneleri bu merkezi renk ailesini kullanır (`src/ui/theme.ts` içerisinde tanımlıdır):

| Rol / Görev | HEX Kodu | Sayısal (0x) | Kullanım Alanı |
|---|---|---|---|
| **Derin Arka Plan** | `#070913` | `0x070913` | Oyun zemini, sahne tabanı, uzay derinliği |
| **Panel Zemin Koyu** | `#0e1220` | `0x0e1220` | HUD paneli, makine listesi zemin dolgusu |
| **Kart & Modal Zemin** | `#141a2e` | `0x141a2e` | Kart dolgusu, dialog arka planı, taban |
| **Panel Çerçevesi (Koyu)** | `#242f4c` | `0x242f4c` | Kart ve panel dış hatları, ayırıcı çizgiler |
| **Panel Çerçevesi (Açık)** | `#3d4e7a` | `0x3d4e7a` | 1px piksel iç kenar vurgusu (bevel highlight) |
| **Ana Metin (Primary)** | `#f5f6fa` | `0xf5f6fa` | Başlıklar, sayılar, kart isimleri (yüksek kontrast) |
| **İkincil Metin (Muted)** | `#8c9bb3` | `0x8c9bb3` | Açıklamalar, birimler, stat etiketleri |
| **Kaynak / Para Vurgusu** | `#ffd166` | `0xffd166` | Parça miktarı, altın paralar, fiyatlar |
| **Fabrika Rengi (Amber)** | `#f4a261` | `0xf4a261` | Sevkiyat sandığı, manuel üretim butonu |
| **Roket / Boost (Cyan)** | `#00d2d3` | `0x00d2d3` | Nitro barı, fırlatma butonu, jet alevi |
| **Başarı / Satın Alınabilir** | `#2ecc71` | `0x2ecc71` | Satın alınabilir 'GELİŞTİR' butonu, +Kazanç metni |
| **Uyarı / Kilitli** | `#f39c12` | `0xf39c12` | Hedef eşiği, kilitli makine uyarısı |
| **Tehlike / Hasar / Kaza** | `#e74c3c` | `0xe74c3c` | Darbe flaşı, düşük HP, kayıt sıfırlama butonu |
| **Devre Dışı / Yetersiz** | `#22293e` | `0x22293e` | Satın alınamayan buton zemini, sönük sınır |

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

* **Dış Kontur (Outline):** Tüm sprite ve interaktif butonlar `1px` kalınlığında koyu lacivert/siyah (`#0c1020` veya `#181926`) piksel kontura sahiptir. Asla yumuşak blur gölge verilmez.
* **Işık Açısı:** Sol-üstten sağ-alta 45° yönlü ışık kabul edilir.
  - Üst ve sol kenarlar: `1px` açık renk vurgu (`#ffffff` %20-40 alfa veya açık palet tonu).
  - Alt ve sağ kenarlar: `1px` koyu gölge şeridi (`#000000` %30 alfa).
* **Piksel Bevel (Eğimli Kenar):** UI panelleri, düğmeler ve kartlar bu 3 katmanlı piksel kenarlık kuralıyla oluşturulur (gölge taban + gövde + üst highlight).

---

## 5. Tipografi ve Okunabilirlik Standartları

* **Yazı Tipi Ailesi:** Temiz, yüksek okunabilirlikli Sans-Serif (`Arial, Helvetica, sans-serif` veya gelecekte pixel font `Press Start 2P / Silkscreen`).
* **Hiyerarşi & Minimum Boyutlar:**
  - Ana Başlıklar & HUD Sayıları: `18px – 24px`, Kalın (Bold), `#f5f6fa` / `#ffd166`.
  - Kart Başlıkları & Buton Etiketleri: `12px – 15px`, Kalın (Bold).
  - Stat Metinleri & İkincil Bilgiler: `10px – 11.5px`, `#8c9bb3`.
  - Minimum Mobil Metin Sınırı: **Hiçbir metin `9px` altına inemez.**
* **Sayı Formatı:**
  - `formatNumber` yardımcısı kullanılır (`1.20e3`, `4.50M` gibi standart kısaltmalar).
  - Para/kaynak değerlerinin yanında daima altın sarısı `⚙` veya sikke ikonu yer alır.

---

## 6. UI Bileşen Kütüphanesi Standartları

### A. Düğmeler (Buttons)
* **Normal / Satın Alınabilir:** Yeşil (`#2ecc71`) gövde, koyu yazı (`#0f0e17`), üstte 1px parlama.
* **Devre Dışı / Yetersiz Kaynak:** Koyu çelik zemin (`#22293e`), sınır `#3d4e7a`, metin `#a4b0be`, fiyat sarı `#ffd166`.
* **Hover:** 1.04x ölçekleme veya ton açılması (`#34d178`).
* **Basılı (Active/Down):** 0.96x ölçekleme, 1px aşağı kayma.
* **Maksimum Seviye (Maxed):** Nötr grafit (`#34495e`), gri metin (`#95a5a6`), 'TAMAM' / 'MAKSİMUM'.

### B. Paneller & Kartlar (Cards & Panels)
* Çok katmanlı piksel çerçeve: Dış koyu çerçeve (`#242f4c`), gövde dolgusu (`#141a2e`), sol tarafta durum/seviye rozeti, sağ tarafta işlem butonu.

### C. İlerleme & Durum Çubukları (Progress Bars)
* Beveled (eğimli) piksel çerçeve (`#222233`), içi renkli dolgu:
  - Can (HP): Yeşil (`#2ecc71`) -> Düşükte Kırmızı (`#e74c3c`).
  - Nitro / Boost: Canlı Siyanür (`#00d2d3`).
  - Hedef / Milestone: Endüstriyel Altın (`#ffd166`) / Turuncu (`#f4a261`).

### D. Bildirimler ve Toast'lar
* Ekranın üst-orta çeyreğinde, koyu lacivert gövde (`#0e1220`, %95 alfa), `2px` yeşil veya altın piksel konturlu kutu, 800ms fade-out.

---

## 7. Proje İçi Asset Kataloğu

| Dosya Yolu (public/assets/...) | Boyut / Frame | Mevcut Görev | İleride Kullanım Alanı |
|---|---|---|---|
| `factory_bg.png` | 32×32 karo | Fabrika arka plan endüstriyel çelik duvar kaplaması | Duvar eklentileri |
| `factory_floor.png` | 32×32 karo | Fabrika tabanı zemin ızgara levhaları | Zemin boyama/kaplama |
| `conveyor_belt.png` | 32×24 karo | Canlı animasyonlu endüstriyel taşıma bandı | Hızlı bant yükseltmesi |
| `factory_intake.png` | 48×56 piksel | Çelik hammadde giriş bunker hunisi ve hidrolik piston | Maden deposu |
| `shipping_crate.png` | 44×44 piksel | Sarı/siyah ikaz şeritli çelik sevkiyat sandığı | Otomatik paketleme kasası |
| `machine_bench.png` & `_part` | 48×48 / 20×14 | Montaj Tezgahı kaidesi ve hareketli mengene | Robotik kol |
| `machine_press.png` & `_part` | 48×48 / 28×18 | Pres Makinesi gövdesi ve dikey hidrolik piston | Ağır döküm presi |
| `machine_welder.png` & `_part` | 48×48 / 24×16 | Kaynak Robotu gövdesi ve döner lazer kafası | Çoklu kaynak ünitesi |
| `machine_automation.png` & `_part` | 48×48 / 32×16 | Otomasyon Hattı gantrisi ve hareketli taşıyıcı | Siber konveyör köprüsü |
| `machine_empty_slot.png` | 48×48 piksel | Kilitli veya boş makine montaj yuvası | Boş slot göstergesi |
| `flight_ground.png` | 64×32 karo | Fırlatma pisti ve zemin asfalt/toprak karosu | Farklı gezegen zeminleri |
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
| `icon_*.png` (coin, gear, trophy...) | 16×16 piksel | Merkezi UI ikon seti (sikke, dişli, roket, kupa, ayarlar) | Mini HUD ikonları |
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
| `launch_pad.png` | 48×48 | Gantry fırlatma kulesi ve rampası | Rampa yükseltmeleri |
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
- [ ] Renkler `src/ui/theme.ts` palet sabitlerinden mi alındı? (Rastgele hex kodu yazılmadı mı?)
- [ ] Phaser doku ayarlarında `pixelArt: true` ve `roundPixels: true` korundu mu?
- [ ] Masaüstü (1920×1080) ve Mobil (dar dikey) ekranlarda metinler ve butonlar kesintisiz okunabiliyor mu?
- [ ] Butonların satın alınabilir (yeşil) ve satın alınamaz (koyu çelik) durumları açıkça ayırt ediliyor mu?
- [ ] Dokular bulanıklaşmadan keskin piksel görünümünü koruyor mu?
