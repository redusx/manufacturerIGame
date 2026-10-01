# Manufacturer Oyun Stili Kılavuzu (STYLE_GUIDE.md)

Bu belge, oyunun görsel tutarlılığını sağlamak için uyulması zorunlu olan tasarım ve stil kurallarını içerir.

## 1. Genel Görsel Yön: 16-Bit Pixel Art
- Oyunun temel görsel tarzı **tutarlı, retro 16-bit pixel art**'tır.
- Anti-aliasing, gradient, blur (bulanıklık), yumuşak gölge ve yuvarlak (smooth) kenar kullanımı **KESİNLİKLE YASAKTIR**.
- Phaser ayarlarında `pixelArt: true` ve `roundPixels: true` yapılandırması her zaman aktif kalmalıdır.

## 2. Renk Paleti (16 Renk Sınırı)
Oyunda yalnızca aşağıdaki 16 renkli katı palet kullanılmalıdır. Palet dışı rastgele hex kodları (`#xxxxxx` veya `0xXXXXXX`) tanımlamak yasaktır. 

*Not: Tüm renkler katı (solid) olmalıdır. Şeffaflık (alpha) sadece siyah (#000000) veya beyaz (#ffffff) üzerine uygulanarak gölge/ışık efekti verilebilir.*

### Arka Plan ve Paneller (Koyu Tonlar)
- **#070913** (Derin Arka Plan)
- **#0e1220** (Ana Panel Arka Planı)
- **#141a2e** (Kart Arka Planı)

### Çerçeveler ve Kenarlıklar (Mavi/Gri Tonlar)
- **#242f4c** (Koyu Kenarlık / Dış Hat)
- **#3d4e7a** (İç Vurgu Kenarlığı)
- **#4f649c** (Açık Vurgu Kenarlığı)

### Metinler
- **#f5f6fa** (Ana Metin / Beyazımsı)
- **#8c9bb3** (Sönük Metin / Gri)
- **#0b0e17** (Koyu Metin / Ters Kontrast)

### Vurgular ve Anlamsal Renkler
- **#ffd166** (Para / Kaynak Sarısı - "Altın")
- **#f4a261** (Fabrika / Aksiyon Turuncusu - "Kehribar")
- **#00d2d3** (Roket / Uçuş Camgöbeği - "Cyan")
- **#2ecc71** (Başarı / Pozitif Yeşili)
- **#f39c12** (Uyarı / Kilittaşı Turuncusu)
- **#e74c3c** (Tehlike / Kırmızı)
- **#22293e** (Devre Dışı / Kapalı Buton Rengi)

## 3. Piksel Ölçeği (Pixel Scaling)
- **Temel Kural:** 1 sanal piksel = Tam sayı katı (2x, 3x, 4x) ekran pikseline eşit olmalıdır.
- Ara veya ondalıklı ölçekler (örneğin 1.5x, 2.3x) yasaktır. Varlıklar ekrana çizilirken Phaser kameraları veya objeleri bu kurala uymalıdır.

## 4. Sprite Boyut Standartları
Tüm görseller belirli grid ölçülerine göre tasarlanmalıdır:
- **İkonlar ve Küçük Parçalar:** 16x16 piksel
- **Orta Boy Nesneler (Fabrika Makineleri vb.):** 32x32 piksel
- **Büyük Nesneler (Roket, Büyük Makineler):** 64x64 veya 128x128 piksel

## 5. Tipografi (Pixel Font)
- **Yazı Tipi:** "Press Start 2P", "Silkscreen" veya benzeri net bir pixel-art font kullanılmalıdır. Eğer internet bağlantısı (webfont) sağlanamıyorsa yedek olarak tarayıcının standart `monospace` fontu, antialiasing kapatılarak kullanılacaktır.
- **Boyutlar:** Sadece 2-3 sabit boyut kullanılmalıdır (Örn: 8px (Mikro), 16px (Gövde/Buton), 24px (Başlık)).
- Metinlere okunabilirliği artırmak için koyu arka plan veya ince siyah kontur (stroke) eklenebilir.

## 6. UI Bileşen Kuralları
- **Kenarlıklar:** Paneller, butonlar ve kartlar 2-3 piksellik katmanlı (beveled) dış hatlara sahip olmalıdır (Üst-sol açık renk, alt-sağ koyu renk gölge).
- **Buton Durumları:**
  - *Normal:* Ana buton rengi (örn. `#27ae60`) + standart kenarlık.
  - *Hover/Basılı:* Daha açık bir renk (örn. `#2ecc71`) veya butonun 1-2 piksel aşağı kaydırılması (y offset).
  - *Devre Dışı:* Gri/Kapalı renk (`#22293e`) + soluk metin.
- Tamamen aynı tasarım dilinde `NineSlice` veya piksel tabanlı raster objeleri kullanılmalıdır.

## 7. Animasyon Kuralları
- Klasik tween, yumuşak geçiş (ease-in/out) ve kayma animasyonları kullanılmamalıdır.
- Animasyonlar **frame bazlı** olmalıdır (Örn: yürüme döngüsü 4 kare, sikke dönmesi 6 kare). 
- Eğer kodla animasyon yapılacaksa (örn. obje hareketi) sadece `steps()` tarzı kesintili, adım adım (örneğin saniyede 12 veya 15 kare hızıyla) hareket ettirilmelidir.

## 8. Dokunmatik ve Tıklama Kuralı
- Mobil uyumluluk ve erişilebilirlik gereği, tüm tıklanabilir alanların (buton, ikon) hitbox'ı **en az 44x44 CSS pikseli** büyüklüğünde olmalıdır.
- Sprite daha küçük olsa bile, etkileşim alanı (`Phaser.Zone` veya hit area) 44x44 standardını sağlamalıdır.

---

## 9. Yeni Görsel Eklerken Uyulacak Kontrol Listesi
- [ ] Görselin ölçüleri 16, 32 veya 64'ün katı mı?
- [ ] Sadece izin verilen 16 renkli palet mi kullanıldı?
- [ ] Renkler arasında yumuşak geçiş (gradient), anti-aliasing (kenar yumuşatma) var mı? (Cevap HAYIR olmalı)
- [ ] Oyuna eklenirken `pixelArt: true` kuralı bozmadan, tam sayı ölçeği (2x/3x) uygulandı mı?
- [ ] UI bileşeni ise (buton, panel vb.), tasarım sisteminin `NineSlice` (beveled) yapısına uygun çizildi mi?
- [ ] Dokunmatik (hitbox) alanı yeterince büyük mü (en az 44x44)?
