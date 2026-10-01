# UI Stil Spesifikasyonu (UI Style Specification)

**Belge Amacı:** Bu spesifikasyon, *Manufacturer* oyununun 16-bit retro-fütüristik endüstriyel piksel sanat stilini tüm ekranlarda tutarlı kılmak, okunabilirlik ve ergonomi standartlarını bağlayıcı kurallarla belirlemek için hazırlanmıştır.  
**İlgili Belgeler:** `AGENTS.md`, `docs/ART_DIRECTION.md`, `docs/UI_VISUAL_AUDIT.md`

---

## 1. Renk Paleti ve Anlamsal Roller (Color Palette)

Tüm renkler `src/ui/theme.ts` içerisindeki `PALETTE` sabitlerine dayalıdır. Rastgele veya ad-hoc hex kodları kullanılamaz.

| Rol / Tanım | HEX | 0x Sayısal | Anlamsal Kullanım |
|---|---|---|---|
| **Derin Arka Plan (`bgDeep`)** | `#070913` | `0x070913` | Ekran tabanı, modal karartma perdesi |
| **Panel Zemin (`panelBg`)** | `#0e1220` | `0x0e1220` | HUD paneli, makine kart zemin dolgusu |
| **Kart Zemin (`cardBg`)** | `#141a2e` | `0x141a2e` | Bağımsız kartlar, diyalog panelleri |
| **Dış Çerçeve (`borderDark`)** | `#242f4c` | `0x242f4c` | Kartların ve 9-slice panellerin dış koyu konturu |
| **İç Vurgu (`borderHighlight`)** | `#3d4e7a` | `0x3d4e7a` | 1px piksel üst/sol kenar ışığı (bevel highlight) |
| **Birincil Metin (`textPrimary`)**| `#f5f6fa` | `0xf5f6fa` | Başlıklar, aktif kart adları, sayılar |
| **İkincil Metin (`textMuted`)** | `#8c9bb3` | `0x8c9bb3` | Statlar, birimler, pasif açıklamalar |
| **Koyu Kontrast Metin (`textDark`)**| `#08170e` | `0x08170e` | Açık yeşil butonların üzerindeki okunaklı metin |
| **Kaynak / Para (`resourceGold`)**| `#ffd166` | `0xffd166` | Parça miktarları, fiyatlar, ödül göstergeleri |
| **Fabrika / Manuel (`factoryAmber`)**| `#f4a261` | `0xf4a261` | Manuel üretim butonu, sevkiyat sandığı |
| **Roket / İtiş (`rocketCyan`)** | `#00d2d3` | `0x00d2d3` | Fırlatma butonu, uçuş rekoru, nitro barı |
| **Satın Alınabilir (`successGreen`)**| `#2ecc71` | `0x2ecc71` | Alınabilir geliştirme butonu, +Kazanım metni |
| **Kilitli / Uyarı (`warningOrange`)**| `#f39c12` | `0xf39c12` | Hedefler, kilitli makine etiketleri |
| **Tehlike / Hata (`dangerRed`)** | `#e74c3c` | `0xe74c3c` | Hasar, çarpışma, sıfırlama butonları |
| **Devre Dışı (`btnDisabled`)** | `#22293e` | `0x22293e` | Yetersiz bakiye buton zemini |

---

## 2. Piksel Ölçeği, Izgara ve Çözünürlük (Pixel Scale)

1. **Temel Ölçü Birimleri (Base Grid):**
   - İkonlar: **16×16 piksel** raster PNG (`icon_*.png`).
   - Butonlar: Minimum **32×24 piksel** (9-slice ile ölçeklenir).
   - Kartlar: Minimum **32×32 piksel** (9-slice ile ölçeklenir).
   - Makineler: **48×48 piksel** taban sprite'ı + hareketli parçalar.
   - Konveyör Bandı: **32×24 piksel** periyodik karo.

2. **Dinamik Ölçekleme Faktörü (`sf`):**
   - Masaüstü HD (1920×1080 / 1280×720): `sf = 1.0 – 1.25`
   - Tablet / Standart (800×600): `sf = 0.9 – 1.0`
   - Mobil (w < 480): `sf = 0.75 – 0.85`
   - *Kural:* Tüm nesne koordinatları ve boyutları `Math.round()` ile tam sayıya yuvarlanmalıdır. Sub-pixel bulanıklığı yasaktır.

---

## 3. Tipografi Rolleri ve Minimum Okunabilirlik Sınırları

Tüm metinler temiz, yüksek kontrastlı ve keskin render edilmelidir (`Arial, Helvetica, sans-serif`).

| Rol | Boyut Aralığı | Renk | Ağırlık | Kullanım Alanı |
|---|---|---|---|---|
| **Ekran Başlığı / HUD Kaynak** | `18px – 22px` | `#ffd166` | Kalın (Bold) | Ana parça miktarı, ana başlıklar |
| **Kart Başlığı / Makine Adı** | `12px – 14px` | `#f5f6fa` | Kalın (Bold) | Makine adı, panel başlıkları |
| **Aksiyon Buton Etiketi** | `12px – 14px` | `#08170e` / `#ffffff` | Kalın (Bold) | Buton ana yazısı |
| **Stat / Üretim Hızı** | `10px – 11.5px` | `#8c9bb3` / `#2ecc71` | Normal / Kalın | `+12.4K/sn`, `Rekor: 120m` |
| **Rozet / Seviye Etiketi** | `9.5px – 10.5px` | `#ffd166` / `#f5f6fa` | Kalın (Bold) | `Sv. 86`, `HEDEF %50` |
| **Açıklama / Buton Alt Metni** | `9.5px – 10px` | `#8c9bb3` / `#08170e` | Normal | `+5 Parça / tık`, `Hangara Geç` |

> **ZORUNLU OKUNABİLİRLİK KURALI:**  
> Hiçbir metin **`9.5px` altına inemez**.  
> Buton veya arayüz etiketlerinde metin emojileri (`⚙`, `🚀`, `🏆`) **KESİNLİKLE KULLANILAMAZ**. Bunun yerine metnin yanına gerçek 16×16 raster PNG ikonu yerleştirilir.

---

## 4. Buton Standartları ve Durumları (Button States)

Tüm butonlar `PixelUIHelper.createButton()` 9-slice nesneleriyle oluşturulur.

### A. Satın Alma / Geliştirme Butonu (Upgrade Button)
- **Satın Alınabilir (Affordable):**
  - Doku: `btn_green_normal.png` (Hover: `btn_green_hover.png`, Tıklama: `btn_green_pressed.png`).
  - Metin: Koyu yeşil-siyah `#08170e`, Kalın `11px`.
  - Format: `[icon_coin / ⚙] + [Maliyet]` (Örn: `14.5M` veya `▲ GELİŞTİR`).
- **Satın Alınamaz (Disabled / Cant Afford):**
  - Doku: `btn_disabled.png`.
  - Metin: Soluk gri `#6f7e9a`, Fiyat sarı `#ffd166`.
  - Tıklanamaz ve imleç değişmez (`useHandCursor: false`).
- **Minimum Boyut:** Genişlik `76px`, Yükseklik `26px`. (Eski 17px'lik tıklanamayan mini hap butonlar yasaktır).

### B. Ana Konsol Butonları (Manuel Üret & Fırlatma Modu)
- **Manuel Üret:** `btn_manual_normal.png` (Turuncu fabrika rengi). Solunda `icon_gear.png` sprite'ı, üstte "MANUEL ÜRET", altta `+N Parça/tık`.
- **Fırlatma Modu:** `btn_launch_normal.png` (Canlı cyan aero rengi). Solunda `icon_rocket.png` sprite'ı, üstte "ROKET & FIRLATMA", altta "Hangara Geç".
- **Ölçüler:** Yükseklik `44px – 50px`, Genişlik `180px – 220px`.

---

## 5. Panel ve Kart Çerçeveleri (9-Slice Frames)

| Çerçeve Tipi | Varlık Dosyası | Dilim Köşe Payı | Kullanım |
|---|---|---|---|
| **HUD / Üst Çubuk** | `ui_panel_hud.png` | `6, 6, 6, 6` | Ekranın üst kenarı boyunca kaynak göstergesi |
| **Kart Zemin** | `ui_card_bg.png` | `6, 6, 6, 6` | Makine istasyonu çerçevesi, hedef kartı |
| **Modal Pencere** | `ui_modal_bg.png` | `8, 8, 8, 8` | Detay ve ayarlar pencereleri |
| **Bildirim Toast** | `ui_toast_bg.png` | `6, 6, 6, 6` | Başarı / milestone bildirim kutuları |

---

## 6. Spacing, Hizalama ve Çakışma Önleme Kuralları

### A. Sıfır Çakışma Kuralı (Zero-Collision Hierarchy)
Her makine istasyonu (Machine Bay) dikeyde katı bir hiyerarşik ızgaraya oturmalıdır:

```
[ -62px ]  -->  Makine Adı (Montaj Tezgahı, beyaz kalın + 2px piksel kontur)
[ -48px ]  -->  Seviye Rozeti (Sv. 86, altın sarısı rozet plakası)
[ -35px ]  -->  Üretim Hızı (+14.2K/sn, yeşil, makine üstünde net boş alanda)
[   0px ]  -->  Makine Kaidesi & Hareketli Parçalar (machine_*.png, 48x48)
[ +14px ]  -->  KONVEYÖR BANDI (conveyor_belt.png) + İLERLEYEN PİKSEL ÜRÜNLER
[ +44px ]  -->  9-Slice Geliştirme Butonu (btn_green / btn_disabled: 86x24px)
```
- Bu dikey düzende hiçbir metin sprite'ın veya butonun üstüne binmez.
- Buton konveyörün hemen altında ergonomik bir mesafede bağımsız bir tıklama alanına sahiptir.

### B. Dikey Boşluk Dağılımı (Vertical Rhythm)
- **HUD Üst Bar:** `y: 0`, Yükseklik `48px – 54px`. İçinde gömme telemetri modülleri yer alır.
- **Milestone / Hedef Kartı:** `y: HUD + 6px`, Yükseklik `30px – 34px`. Hedefler tamamlandığında bile kaybolmaz; kalıcı efsanevi unvan/verim rozetini sergiler.
- **Fabrika Çalışma Alanı:** Kalan dikey alanın tam ortasına dengeli yerleşir; makineler zemin kaideleriyle fiziksel olarak zemine oturur.
- **Alt Eylem Konsolu (Control Deck):** Ekranın alt tabanına yaslanmış 9-slice endüstriyel konsol paneli (`ui_panel_hud`), butonları havada uçmaktan kurtarır ve oyun alanını dengeler.

---

## 7. İlerleme ve Kaynak Barları

- **Yuva:** `ui_bar_slot.png` (9-slice, 4px köşe).
- **Dolgu:** `ui_bar_fill_gold.png` (Hedef için altın sarısı), `ui_bar_fill_cyan.png` (Nitro için cyan).
- **İç Kenar Boşluğu (Inset):** Dolgu, yuvanın içinden her yönden `2px` içeride yer alır.
- **Minimum Dolgu:** `%0` durumunda dolgu sprite'ı gizlenir (`visible: false`), taşma önlenir.
- **Tamamlanma Durumu:** Tüm hedefler tamamlandığında çubuk dolu altın (%100) kalır ve "Efsanevi Fabrika: Maksimum Üretim Çarpanı (x3.0)" rozetini gösterir. Boş siyah alan bırakacak şekilde gizlenemez.

---

## 8. Piksel Tipografi ve Kontur Kuralı (Pixel Stroke)

Piksel dokulu zeminlerde metinlerin yıkanmasını veya okunaksızlaşmasını önlemek için:
- Tüm başlık, sayı ve buton etiketleri **`stroke: '#070913', strokeThickness: 2`** veya **`shadow: { offsetX: 1, offsetY: 1, color: '#000000', blur: 0, fill: true }`** kuralına tabiidir.
- Kesinlikle yumuşak gaussian blur gölge kullanılmaz; piksel sanatına uygun 1px sert kontur/gölge kullanılır.

---

## 9. Responsive Davranış (Ekran Boyutu Uyumu)

1. **Geniş Ekran (w >= 1000px):**
   - 4 makine istasyonu konveyör boyunca eşit aralıklarla yan yana dizilir.
   - Alt konsol butonları `210px` genişliğinde merkezde yerleşir.
2. **Orta Ekran (650px <= w < 1000px):**
   - Makine istasyonları arasındaki yatay boşluk dinamik olarak daralır; butonlar `170px` olur.
3. **Dar / Mobil Ekran (w < 650px):**
   - Yazı boyutları minimum sınırı (`9.5px`) korur.
   - Butonlar ekran genişliğini iki eşit parçaya bölecek şekilde esner (`(w - 28) / 2`).

---

## 10. Mevcut Kurallarla Çelişki Açıklaması

Bu spesifikasyon `AGENTS.md` ve `docs/ART_DIRECTION.md` belgeleriyle **%100 uyumludur**:
- Vektör ve SVG kullanımını kesin olarak yasaklar.
- Yalnızca `public/assets/` dizininde gerçekten var olan PNG dokularını ve `theme.ts` paletini zorunlu kılar.
- Claude Code Game Development referans dokümanlarının (`07-ui-ux`, `03-graphics-rendering`, `08-game-engines`) arcade HUD, dokunmatik hedef, görsel geri bildirim ve z-ordering ilkelerini doğrudan mevcut Phaser yığınına uygular.