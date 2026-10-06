# UI Görsel Denetim Raporu (UI Visual Audit)

> **Tarihsel belge.** Bu dosya revival öncesi planı/denetimi anlatır ve oyunun güncel hâliyle birebir örtüşmeyebilir. Güncel durum: `PROJECT_STATUS.md`; bağlayıcı kararlar: `DECISIONS.md` (DEC-011 ve sonrası); güncel sayılar: `ECONOMY.md`.

**Tarih:** 30 Eylül 2026  
**İncelenen Ekran:** Ana Fabrika Ekranı (`GameScene` + `FactoryView` + `HUD` + `MilestoneBar`)  
**İncelenen Ekran Görüntüsü:** `factory_screen_initial_1790781912624.png` (Çözünürlük: 1920×960)  
**Referans Belgeler:** `AGENTS.md`, `docs/ART_DIRECTION.md`

---

## 1. Repodaki UI Görselleri ve Çizim Yöntemleri Envanteri

Repodaki tüm sahne, arayüz, bileşen ve betik dosyaları incelenmiş; kullanılan görsel varlıklar ve çizim teknikleri kategorilere ayrılarak listelenmiştir:

### A. Gerçek Raster PNG / Spritesheet Dokuları
Projede `public/assets/` dizininde 77 adet bağımsız PNG dosyası ve `public/assets/pixelart/` altında spritesheet koleksiyonları bulunmaktadır:

1. **9-Slice UI Çerçeveleri & Paneller:**
   - `ui_panel_hud.png` (32×32, 6px köşe payı): HUD üst bar çerçevesi.
   - `ui_card_bg.png` (32×32, 6px köşe payı): Makine ve yükseltme kartları zemin çerçevesi.
   - `ui_modal_bg.png` (32×32, 8px köşe payı): Ayarlar ve detay pencereleri çerçevesi.
   - `ui_toast_bg.png` (24×24, 6px köşe payı): Bildirim kutusu çerçevesi.
   - `ui_bar_slot.png` (32×12, 4px köşe payı): İlerleme ve durum çubukları yuva çerçevesi.
   - `ui_bar_fill_gold.png`, `ui_bar_fill_green.png`, `ui_bar_fill_cyan.png`, `ui_bar_fill_red.png` (16×8, 2px köşe): Bar dolguları.

2. **9-Slice Butonlar (Durum Bazlı):**
   - `btn_green_normal.png`, `btn_green_hover.png`, `btn_green_pressed.png` (32×24, 6px köşe): Satın alma ve onay butonları.
   - `btn_disabled.png` (32×24, 6px köşe): Satın alınamayan / devre dışı butonlar.
   - `btn_danger_normal.png`, `btn_danger_pressed.png` (32×24, 6px köşe): Sıfırlama butonları.
   - `btn_manual_normal.png`, `btn_manual_hover.png`, `btn_manual_pressed.png` (40×32, 8px köşe): Manuel üretim arcade konsol butonu.
   - `btn_launch_normal.png`, `btn_launch_hover.png`, `btn_launch_pressed.png` (40×32, 8px köşe): Fırlatma modu konsol butonu.
   - `btn_tab_active.png`, `btn_tab_inactive.png` (32×24, 4px köşe): Sekme butonları.

3. **16×16 Piksel UI İkon Seti (Gerçek Raster PNG):**
   - `icon_coin.png`, `icon_gear.png`, `icon_settings.png`, `icon_rocket.png`, `icon_factory.png`, `icon_heart.png`, `icon_lightning.png`, `icon_flag.png`, `icon_trophy.png`, `icon_close.png`, `icon_check.png`.

4. **Fabrika & Çevre Dokuları:**
   - `factory_bg.png` (128×128 tekrarlanan karo), `factory_floor.png` (64×32 emniyet şeritli karo), `conveyor_belt.png` (32×24 kayar bant), `factory_intake.png` (48×56 hammadde silosu), `shipping_crate.png` (44×44 çelik sandık).

5. **Makine Parçaları:**
   - `machine_bench.png` & `_part.png`, `machine_press.png` & `_part.png`, `machine_welder.png` & `_part.png`, `machine_automation.png` & `_part.png`, `machine_empty_slot.png`.

6. **Spritesheet Animasyonları:**
   - `spr_coin_ama.png` (`coin_gold`, 16×16, 4 kare altın dönme animasyonu).
   - `hit_spark_spritesheet.png` (`hit_spark`, 100×100, 36 kare darbe efekti).
   - `fire_explosion_spritesheet.png` (`fire_explosion`, 100×100, 64 kare patlama efekti).

---

### B. SVG / Inline SVG Kullanımı
- **Tespit:** Projede **hiçbir `.svg` dosyası bulunmamaktadır** ve HTML veya Phaser içinde inline SVG kullanılmamaktadır. Bu durum `ART_DIRECTION.md` kuralına uygundur.

---

### C. Phaser Graphics ile Çizilen Öğeler
- `src/ui/theme.ts`: `PixelUIHelper.drawPanel()`, `drawButton()`, `drawProgressBar()` adında Phaser Graphics yordamları yer almaktadır. Ancak aktif sahnede 9-slice PNG dokuları kullanıldığı için bu Graphics fonksiyonları çağrılmamaktadır.
- `src/ui/SettingsPanel.ts`, `MachineModal.ts`, `RocketHangarView.ts`: Modal pencerelerin arka planını karartmak için `add.rectangle(0, 0, w, h, 0x070913, 0.75)` kullanılmaktadır. Bu kullanım kılavuzdaki istisnaya uygundur (görünen oyun nesnesi değil, yarı-saydam karartma perdesi).

---

### D. CSS ile Çizilmiş Dekoratif Şekiller
- `index.html`: Yalnızca sıfırlama CSS'i (`* { margin: 0; padding: 0; }`), tam ekran kapsayıcı (`#game-container`) ve piksel keskinleştirici kural (`canvas { image-rendering: pixelated; image-rendering: crisp-edges; }`) mevcuttur. CSS ile çizilen hiçbir dekoratif şekil yoktur.

---

### E. Yalnızca Metinden Oluşan Öğeler (Raw / Bare Text)
Ekran görüntüsü incelendiğinde aşağıdaki öğelerin herhangi bir arka plan kartı, çerçeve veya plaka olmaksızın çıplak Phaser Text olarak çizildiği tespit edilmiştir:
1. **"HAMMADDE Girişi"**: Silo üzerinde mavi renkte çıplak metin.
2. **"SEVKİYAT"**: Sandık üzerinde sarı renkte çıplak metin.
3. **Makine İsimleri**: "Montaj Tezgahı", "Pres Makinesi", "Kaynak Robotu", "Otomasyon Hattı" başlıkları makinelerin üzerinde havada asılı durmaktadır.
4. **Makine Seviye Rozeti**: "Sv. 86", "Sv. 68" gibi metinler, hemen altındaki mini buton ile çakışmaktadır.
5. **Milestone Bar Metinleri**: `🏆 Efsanevi Üretici: 133M / 250M` ve `%53 — ~26dk 8sn` oluk üzerinde doğrudan yüzmektedir.
6. **Buton İçi Emojiler**: Manuel Üret butonunda `'⚙  MANUEL ÜRET'`, Fırlatma Modu butonunda `'🚀  FIRLATMA MODU'` şeklinde metin içine gömülmüş sistem emojileri kullanılmıştır. Bu durum işletim sisteminin vektörel emoji fontunu (Windows Segoe UI Emoji) çağırarak piksel sanat bütünlüğünü bozmaktadır.

---

## 2. Mevcut Ekran Görüntüsünün (`factory_screen_initial_1790781912624.png`) Somut Sorun Analizi

### 1. Görsel Hiyerarşi (Visual Hierarchy)
- **Boşluk Fazlalığı:** Ekranın yaklaşık %75'i tekdüze koyu mavi ızgaradan (`factory_bg.png`) ibarettir. Fabrika zemini, makineler ve konveyör bandı ekranın alt çeyreğinde minicik bir şerit halinde sıkışmıştır.
- **Odak Noktası Eksikliği:** Oyuncunun nereye bakması gerektiği belirsizdir. Cihazlar devasa boşlukta kaybolmuştur.
- **Üretim Verisi Görünürlüğü Sıfır:** Ana ekranda hiçbir makinenin üretim çıktısı (örn: `+12.4K/sn`) veya geliştirme maliyeti görünmemektedir. Oyuncu fabrikanın durumunu anlamak için her bir makineye tek tek tıklamak zorundadır.

### 2. Yazı Boyutu, Çakışma ve Okunabilirlik (Typography Collisions)
- **Kritik Çakışma Hatası (Collision Bug):** Her makinenin üzerinde yer alan seviye metni (`Sv. 86`) ile yeşil `▲ GELİŞTİR` butonu doğrudan üst üste binmiştir. Metinler birbirini ezdiği için seviye numarası ve buton etiketi okunamaz durumdadır.
- **Yazı Hiyerarşisi Zayıf:** Makine isimleri çok küçük (`10.5px`), alt butonlardaki alt metinler (`+5 Parça / tık`) okunaksız derecede basıktır.

### 3. Kontrast ve Renk Sorunları
- **Alt Buton Metin Kontrastı:** Manuel Üret butonundaki koyu kahverengi metin (`#1f1003`) turuncu zemin üzerinde kirli durmaktadır. Fırlatma Modu butonundaki `#041717` koyu yeşil metin cyan zemin üzerinde yeterince kontrast sunmamaktadır.
- **Milestone Bar Kontrastı:** İlerleme çubuğunun oluk çerçevesi (`ui_bar_slot`) zeminle neredeyse aynı koyuluktadır ve ekran boyunca uzandığı için altın dolgu zayıf bir çizgi gibi kalmaktadır.

### 4. Boşluklar ve Hizalama (Spacing & Layout)
- HUD ile Milestone barı arasında 4px, Milestone barı ile fabrika arasında 8px boşluk varken, fabrika ile alt butonlar arasında 350 pikselden fazla anlamsız bir boşluk vardır.
- Makineler konveyör üzerinde çok seyrek dağılmıştır (her makine arasında 350 piksel mesafe vardır).

### 5. Buton Boyutu ve Tıklanabilirlik (Ergonomics)
- Makine üstündeki `▲ GELİŞTİR` mini hap butonu yalnızca `56×17` piksel boyutundadır. Farenin veya dokunmatik ekranın bu butona isabet etmesi zordur.
- Alt konsol butonları ise `230×44` pikseldir; iki butonun arasındaki ölçek uçurumu arayüzü dengesiz kılmaktadır.

### 6. İkon Tutarlılığı
- Butonlarda gerçek PNG ikonlar (`icon_gear.png`, `icon_rocket.png`) yerine metin emojileri (`⚙`, `🚀`) kullanılmıştır. Emojiler tarayıcı fontuna göre render edildiği için piksel dokularla uyuşmamaktadır.

### 7. Piksel Ölçeği (Pixel Scaling)
- Yüksek çözünürlükte `sf = 1.3` çarpanı kullanılırken 48×48px makine sprite'ları orantısız biçimde ufak kalmakta ve 16-bit endüstriyel detaylar kaybolmaktadır.
- Makine tabanlarının altındaki zemin çizgileri ve konveyör bandı tam sayı piksel hizasına oturtulmalıdır.

### 8. Mobil Uyum
- Ekran daraltıldığında (mobil dikey görünüm) makineler yatay bantta sıkışmakta, alt butonlar ekrandan taşmaktadır.

---

## 3. Denetim Sonuç Özeti

| Kriter | Mevcut Durum | Hedef Standart |
|---|---|---|
| **Piksel Dokusu** | 9-Slice PNG kullanılıyor ancak düzenleme eksik | Ortak UI bileşenleri ve kart çerçeveleri ile tam piksel uyumu |
| **Metin Çakışması** | `Sv. X` ile `GELİŞTİR` butonu üst üste biniyor | Çakışma sıfırlanacak; seviye, isim ve buton ayrı dikey katmanlara alınacak |
| **İkonlar** | Metin emojileri (`⚙`, `🚀`) kullanılmış | Gerçek raster PNG ikonları (`icon_*.png`) entegre edilecek |
| **Makine Bilgisi** | Maliyet ve üretim gizli | Her makine bayinde seviye, çıktı ve maliyet görünür olacak |
| **Boşluk Dağılımı** | %75 boşluk, alt çeyrekte yığılma | Fabrika alanı ekranın merkezine dengeli yayılacak |
| **Buton Ergonomisi** | 17px tıklanamaz mini hap buton | Minimum 28px yükseklikte standart piksel 9-slice buton |
