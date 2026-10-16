# branding/ — Yayın görselleri

Oyun içi varlık değildir (oyun bu klasörü yüklemez). Hepsi `tools/generate_branding.py`
ile üretilir: `python3 tools/generate_branding.py`.

| Dosya | Boyut | Kullanım |
|---|---|---|
| `icon_512x512.png` | 512×512 (1:1) | Kare oyun ikonu |
| `banner_1920x1080.png` | 1920×1080 (16:9) | Yatay banner / kapak; yalnız oyun adı yazılı |
| `*_base.png` | 64×64, 320×180 | Asıl piksel çizim (çıktılar bunun ×8 ve ×6 büyütmesidir) |

Görseller oyunun kendi sprite'larıyla (roket Sv.1, kırıcı, bant, eşyalar, fırlatma rampası,
uçuş zemini) ve 16 renkli paletle (`tools/palette.py`) çizilir. Adı değiştirmek için betikteki
`TITLE` değiştirilir (yazı yalnız betikteki harflerle çizilir; yeni harf gerekirse `GLYPHS`'e eklenir).

Önerilen ad: **Ore to Orbit** (henüz oyun içine işlenmedi; oyundaki başlık `Manufacturer: Rocket Factory`).
