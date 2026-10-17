# promo-videos/ — 15 saniyelik tanıtım videoları

| Dosya | Boyut | Ses | Kullanım |
|---|---|---|---|
| `manufacturer-promo-landscape.mp4` | 1920×1080 (16:9), 15,0 sn, 30 fps | AAC 48 kHz stereo | Yatay tanıtım (istenen sürüm) |
| `manufacturer-promo-portrait.mp4` | 1080×1920 (9:16), 15,0 sn, 30 fps | AAC 48 kHz stereo | Dikey / mobil tanıtım (istenen sürüm) |
| `manufacturer-promo-landscape-crazygames.mp4` | 1920×1080 (16:9), 15,0 sn | yok | CrazyGames yatay önizleme videosu |
| `manufacturer-promo-portrait-crazygames.mp4` | 1080×1620 (2:3), 15,0 sn | yok | CrazyGames dikey önizleme videosu |

Video kodlaması H.264 (macOS VideoToolbox). CrazyGames sürümleri platformun kurallarına göre
hazırlandı (docs.crazygames.com/requirements/game-covers): ses yok, dikey 2:3, açılış karesi statik
kapak (`../banner_1920x1080.png`, `../cover_portrait_800x1200_base.png`) ve yarım saniyede oynanışa
geçer; yazı, logo geçişi, siyah kare ve hızlandırma yok. Dosyalar 50 MB sınırının altında.

## Kurgu

| Süre | Yatay | Dikey |
|---|---|---|
| 0–3 sn | Beş üretim hattı ve ihracat kapıları; elle üretim (MAKE), +$ ve uçan paralar | Demir ve bakır hatları baştan sona dikey; elle üretim |
| 3–7 sn | Cevher girişlerinden kırıcı ve fırınlara yatay geçiş | Cam ve bakır hatlarında ihracattan girişe çapraz geçiş |
| 7–11 sn | Bütün fabrika; 4. parsel (24×24) açılır; hangarda kanat yükseltmesi | Dişli kesicisinin penceresi, makine Sv.9'a yükselir; hangarda kanat yükseltmesi |
| 11–15 sn | Hangardan fırlatma, kusursuz atış, kalkış ve nitroyla tırmanış | Aynı final, dikey kadraj, roket ortada |

Her sahne oyunun gerçek görüntüsüdür: oyun tarayıcıda Basic yapılandırmasıyla (`?release=basic`,
reklam düğmesi yok) çalıştırılır, fabrika, parsel, yükseltme ve fırlatma oyunun kendi işlevleriyle
oynanır. Kayıt, 9 aşaması tamamlanmış bir oyuncunun durumudur (yalnız o aşamada açık olan
makineler ve girişler). Kamera hareketleri oyunun kendi dünya kamerasıyla yapılır; uçuşta kamera
rokete yaklaşır. Ekrana ek yazı eklenmedi; görünen yazılar oyunun kendi arayüzüdür.

## Ses (yalnız ilk iki dosya)

Oyunun kendi sesleri: fabrika teması, roket fırlatılınca uçuş temasına geçiş, elle üretim, gelir
çınlaması (oyundaki gibi 1,4 sn'de en fazla bir kez), parsel fanfarı, yükseltme, fırlatma, sürekli
motor ve nitro itişi. Hepsi `src/audio/` içindeki prosedürel sentezdir (dosya yok, lisans yükü yok;
bkz. `docs/AUDIO.md`). Efektler çekim sırasında kaydedilen olay zamanlarında çalar (kare
hassasiyetinde eşzamanlı). Karışım tepe -1 dBFS, ortalama yaklaşık -19 dBFS; son 0,5 sn söner.

## Yeniden üretmek

Araçlar `tools/` içinde. Ara kareler (yaklaşık 1,5 GB PNG) depoya konmaz; betikler yeniden üretir.

1. `npm run dev` ve tarayıcıda `http://localhost:5173/?release=basic` (görüntü alanı: yatay 960×540,
   dikey 540×960, CrazyGames dikey 540×810; cihaz ölçeği 2 → tuval 1920×1080 / 1080×1920 / 1080×1620).
2. Kare alma sunucusu: `python3 tools/capture_server.py <çekim_klasörü>` (yalnız 127.0.0.1:8765).
3. Sayfa konsolunda: `(await import('/branding/promo-videos/tools/capture_shots.js')).capture({ name: 'landscape', layout: 'landscape' })`
   (dikey için `name: 'portrait'` / `'portrait23'`, `layout: 'portrait'`). Çekim, kayıtlı oyun durumundan
   başlar. Kullanılan kayıt `tools/promo_save.json`'dur (5 hat, 14 makine, 4 parsel açık, $34.6K);
   önce konsolda `localStorage.setItem('manufacturer_unified_save_v4', JSON.stringify(<dosya içeriği>))`
   ve `localStorage.setItem('manufacturer_locale_v1', 'en')`, sonra sayfa yenilenir.
4. Ses: `(await import('/branding/promo-videos/tools/render_audio.js')).renderStems({ name: 'landscape' })`
   (ve `portrait`).
5. `python3 tools/build_videos.py <çekim_klasörü> branding/promo-videos` — videoyu kodlar, sesi karıştırır
   (`afconvert` ile AAC), MP4'te birleştirir ve süre / çözünürlük / iz listesini yazdırır.

Gerekenler: macOS (`afconvert`, AVFoundation), Python 3 ile numpy, Pillow, opencv-python. ffmpeg gerekmez.
