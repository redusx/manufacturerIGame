# branding/ — Yayın görselleri

Oyun içi varlık değildir (oyun bu klasörü yüklemez). Hepsi `tools/generate_branding.py`
ile üretilir: `python3 tools/generate_branding.py`.

| Dosya | Boyut | Kullanım |
|---|---|---|
| `icon_512x512.png` | 512×512 (1:1) | Kare oyun ikonu |
| `banner_1920x1080.png` | 1920×1080 (16:9) | Yatay banner / CrazyGames yatay kapağı; yalnız oyun adı yazılı |
| `cover_portrait_800x1200.png` | 800×1200 (2:3) | CrazyGames dikey kapağı |
| `cover_square_800x800.png` | 800×800 (1:1) | CrazyGames kare kapağı |
| `*_base.png` | 64×64, 320×180, 200×300, 200×200 | Asıl piksel çizim (çıktılar bunun ×8, ×6, ×4 büyütmesidir) |

Görseller oyunun kendi sprite'larıyla (roket Sv.1, kırıcı, bant, eşyalar, fırlatma rampası,
uçuş zemini) ve 16 renkli paletle (`tools/palette.py`) çizilir. Adı değiştirmek için betikteki
`TITLE` değiştirilir (yazı yalnız betikteki harflerle çizilir; yeni harf gerekirse `GLYPHS`'e eklenir).

Yerleşim kuralı (CrazyGames): kapağın sol üst köşesine platform etiketleri ("New", "Hot")
konur; oyun adı ve önemli öğeler oraya konmaz. Adlar yatayda ortalı ve kenardan aşağıdadır.

Oyunun adı: **Ore to Orbit** (DEC-057; sayfa başlığı ve giriş ekranında da bu ad yazar).
