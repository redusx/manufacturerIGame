#!/usr/bin/env python3
"""Arayüz panellerinin ve fabrika zeminlerinin tema dokularını üretir.

Çalıştırma:  python3 tools/generate_theme_assets.py   (Pillow gerekir)

Renklerin tamamı tools/palette.py içindeki 16 renkli ana paletten ve onun adlandırılmış
karışımlarından gelir. Tema "krem + açık kahve": pencereler krem, kartlar açık krem,
çubuklar açık kahve; kenarlarda kahve çerçeve ve açık kahve / bakır perçinler. Fabrikanın
çevresindeki şehir çizimi ayrı betiktedir (tools/generate_city_backdrop.py).

Üretilenler:
  public/assets/ui_panel_hud.png     iç bölme (karttan koyu, içe gömük)
  public/assets/ui_card_bg.png       kart
  public/assets/ui_modal_bg.png      pencere çerçevesi (perçinli)
  public/assets/ui_toast_bg.png      bildirim / öğretici kutusu
  public/assets/ui_bar_slot.png      ilerleme çubuğu yuvası
  public/assets/ui/bar_bg.png        üst çubuk (altında koyu şerit)
  public/assets/ui/dock_bg.png       araç çubuğu tablası (üstünde koyu şerit)
  public/assets/ui/pattern.png       panellerin üstüne serilen ince ızgara (yarı saydam)
  public/assets/factory_floor.png    fabrika zemin karosu
  public/assets/factory_concrete.png açılmamış alanın beton karosu (32x32)
  public/assets/factory_fence_h.png, factory_fence_v.png  arsanın çevre duvarı
  public/assets/boss.png             giriş ekranındaki patron portresi

Paneller 9 dilimlidir (kenar 6, pencerede 8 piksel); ortaları düz renktir, çünkü ortası
gerilerek çizilir. Kurallar docs/ART_DIRECTION.md ile aynıdır: 1px koyu kontur,
sol-üstten ışık, düz renkler.
"""

from pathlib import Path
from PIL import Image

from palette import BASE, TONE, mix, rgba

ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets"
UI = ASSETS / "ui"

CLEAR = (0, 0, 0, 0)

UMBER = rgba(BASE["umber"])
BROWN = rgba(BASE["brown"])
COPPER = rgba(BASE["copper"])
SAND = rgba(BASE["sand"])
WHITE = rgba(BASE["white"])
BLACK = rgba(BASE["black"])
CREAM = rgba(TONE["cream"])
CREAM_LIGHT = rgba(TONE["cream_light"])
CREAM_GLOW = rgba(TONE["cream_glow"])
TAN = rgba(TONE["tan"])
TAN_BAR = rgba(TONE["tan_bar"])
TAN_DARK = rgba(TONE["tan_dark"])
BAR_EDGE = rgba(TONE["bar_edge"])


class Rng:
    """Tohumlu, tekrarlanabilir rastgele sayı üreteci (dokular her çalıştırmada aynı çıkar)."""

    def __init__(self, seed: int):
        self.state = seed & 0xFFFFFFFF

    def next(self) -> float:
        self.state = (self.state * 1664525 + 1013904223) & 0xFFFFFFFF
        return self.state / 4294967296

    def between(self, low: int, high: int) -> int:
        return low + int(self.next() * (high - low + 1))


def new(width: int, height: int, fill: tuple = CLEAR) -> Image.Image:
    return Image.new("RGBA", (width, height), fill)


def ring(img: Image.Image, inset: int, top_left: tuple, bottom_right: tuple = None) -> None:
    """Kenardan `inset` piksel içeride 1 piksellik çerçeve; üst/sol ve alt/sağ ayrı renkte olabilir."""
    px = img.load()
    w, h = img.size
    bottom_right = bottom_right or top_left
    for x in range(inset, w - inset):
        px[x, inset] = top_left
        px[x, h - 1 - inset] = bottom_right
    for y in range(inset, h - inset):
        px[inset, y] = top_left
        px[w - 1 - inset, y] = bottom_right


def rivet(img: Image.Image, x: int, y: int) -> None:
    """2x2 perçin: sol üstü parlak, sağ altı koyu."""
    px = img.load()
    px[x, y] = WHITE
    px[x + 1, y] = SAND
    px[x, y + 1] = SAND
    px[x + 1, y + 1] = COPPER


# ---------------------------------------------------------------------------
# ARAYÜZ PANELLERİ
# ---------------------------------------------------------------------------


def card() -> Image.Image:
    img = new(32, 32, CREAM_LIGHT)
    ring(img, 0, BROWN)
    ring(img, 1, CREAM_GLOW, TAN_DARK)            # sol-üstten ışık
    return img


def inset() -> Image.Image:
    img = new(32, 32, TAN)
    ring(img, 0, BROWN)
    ring(img, 1, TAN_DARK, CREAM_GLOW)            # içe gömük: gölge üstte, ışık altta
    return img


def modal() -> Image.Image:
    img = new(32, 32, CREAM)
    ring(img, 0, UMBER)
    ring(img, 1, SAND, COPPER)                    # pirinç görünümlü dış şerit
    ring(img, 2, COPPER, BROWN)
    ring(img, 3, BROWN)
    ring(img, 4, CREAM_GLOW, TAN_DARK)
    for x, y in ((5, 5), (25, 5), (5, 25), (25, 25)):
        rivet(img, x, y)
    return img


def toast() -> Image.Image:
    img = new(32, 24, rgba(TONE["cream_light"], 250))
    ring(img, 0, UMBER)
    ring(img, 1, BROWN)
    return img


def bar_slot() -> Image.Image:
    """İlerleme çubuğunun yuvası: en koyu kahve oluk."""
    img = new(32, 12, UMBER)
    ring(img, 0, UMBER)
    ring(img, 1, BLACK, BROWN)
    return img


def bar(trim_on_top: bool) -> Image.Image:
    """Tam genişlikte çubuk: bir kenarında koyu şerit ve krem pah, diğerinde ince vurgu."""
    img = new(32, 32, TAN_BAR)
    px = img.load()
    trim = [UMBER, BROWN, COPPER, CREAM_GLOW, BAR_EDGE]
    plain = [UMBER, BAR_EDGE]
    for x in range(32):
        for index, color in enumerate(trim if trim_on_top else plain):
            px[x, index] = color
        for index, color in enumerate(plain if trim_on_top else trim):
            px[x, 31 - index] = color
    for y in range(32):
        px[0, y] = UMBER
        px[31, y] = UMBER
    return img


def pattern() -> Image.Image:
    """Panellerin üstüne serilen ince teknik çizim ızgarası (kahve, çok düşük alfa)."""
    img = new(32, 32)
    px = img.load()
    ink = BASE["brown"]
    for i in range(32):
        px[i, 0] = rgba(ink, 16)
        px[0, i] = rgba(ink, 16)
        if i % 4 == 0:
            px[i, 16] = rgba(ink, 12)
            px[16, i] = rgba(ink, 12)
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
        px[(16 + dx) % 32, (16 + dy) % 32] = rgba(ink, 30)
    return img


# ---------------------------------------------------------------------------
# FABRİKA ZEMİNLERİ
# ---------------------------------------------------------------------------


def floor() -> Image.Image:
    """Fabrika zemin karosu (64x32): üstte ray şeridi, altında iki sıra levha.
    Tonlar lacivert ile koyu mor arasındadır; üst ray açık eflatundur."""
    navy, plum, sky = BASE["navy"], BASE["plum"], BASE["sky"]
    a = rgba(mix(navy, plum, 0.12))
    b = rgba(mix(navy, plum, 0.5))
    c = rgba(mix(navy, plum, 0.35))
    d = rgba(mix(navy, plum, 0.72))
    e = rgba(mix(plum, sky, 0.3))
    img = new(64, 32, a)
    px = img.load()
    for x in range(64):
        px[x, 0] = e
        px[x, 1] = e
        for y in (2, 3, 4):
            px[x, y] = b
        for y in range(5, 32):
            row = (y - 5) % 14
            col = x % 32
            if row == 0:
                px[x, y] = d if col == 1 else c
            elif row == 1:
                px[x, y] = c if col == 0 else d
            elif col == 0:
                px[x, y] = c
            elif col == 1:
                px[x, y] = d
    return img


def concrete() -> Image.Image:
    """Açılmamış alanın beton karosu (32x32, hücreyle hizalı): derzli, benekli gri-eflatun beton."""
    rng = Rng(7)
    base, light = rgba(TONE["concrete"]), rgba(TONE["concrete_light"])
    dark, joint = rgba(TONE["concrete_dark"]), rgba(TONE["concrete_joint"])
    img = new(32, 32, base)
    px = img.load()
    for i in range(32):
        px[i, 0] = joint
        px[0, i] = joint
        px[i, 1] = light
        px[1, i] = light
    for _ in range(26):
        x, y = rng.between(3, 30), rng.between(3, 30)
        px[x, y] = dark if rng.next() < 0.6 else light
    # Tek bir ince çatlak
    for step in range(7):
        px[9 + step, 20 + step // 2] = dark
    return img


def fence(horizontal: bool) -> Image.Image:
    """Arsanın çevre duvarı (8 piksel uzunlukta döşenir, 6 piksel kalın): tuğla sıra ve derz."""
    rows = [UMBER, SAND, COPPER, COPPER, BROWN, UMBER]
    img = new(8, 6) if horizontal else new(6, 8)
    px = img.load()
    for along in range(8):
        for across, color in enumerate(rows):
            # Her 8 pikselde bir derz
            pixel = BROWN if along == 0 and across in (2, 3) else color
            if horizontal:
                px[along, across] = pixel
            else:
                px[across, along] = pixel
    return img


# ---------------------------------------------------------------------------
# PATRON PORTRESİ (giriş ekranı; 32x32)
# ---------------------------------------------------------------------------

BOSS_ROWS = [
    "................................",
    "...........oooooooooo...........",
    ".........ooYYYYYYYYYYoo.........",
    "........oYYHHHHHHHHHHHdo........",
    ".......oYHHHHHHHHHHHHHHdo.......",
    ".......oYHHHHHHHHHHHHHHdo.......",
    "......oYHHHHHHHHHHHHHHHHdo......",
    "....oooddddddddddddddddddooo....",
    "....oHHHHHHHHHHHHHHHHHHHHHHo....",
    ".....oooooooooooooooooooooo.....",
    "......ohsssssssssssssssSho......",
    "......ohssssssssssssssSSho......",
    "......osgggggggsgggggggSso......",
    "......osgGGggggsgGGggggSso......",
    "......osgggggggsgggggggSso......",
    "......ossssssssssssssssSSo......",
    "......osssssssSSsssssssSSo......",
    "......ossmmmmmmmmmmmmssSSo......",
    "......ossmmmmmmmmmmmmssSSo......",
    ".......osssssoooosssssSSo.......",
    ".......ossssssssssssssSSo.......",
    "........ossssssssssssSSo........",
    ".........oosssssssssSoo.........",
    ".....oooojjwwwsSwwwjjoooo.......",
    "...oojjjjjjwwwttwwwjjjjjjoo.....",
    "..ojJjjjjjjjjwwttwwjjjjjjjjo....",
    ".ojJjjjjjjjjjwTtTwjjjjjjjjjjo...",
    ".ojJjjjjjjjjjjttjjjjjjjjjjjjo...",
    ".ojJjjjjjjjjjjTtjjjjjjjjjjjjo...",
    ".ojJjjjjjjjjjjttjjjjjjjjjjjjo...",
    ".ojjjjjjjjjjjjTtjjjjjjjjjjjdo...",
    ".oooooooooooooooooooooooooooo...",
]

BOSS_COLORS = {
    ".": CLEAR,
    "o": UMBER,
    "Y": WHITE,                              # baret vurgusu
    "H": rgba(TONE["cream_light"]),          # beyaz baret
    "d": rgba(BASE["sky"]),                  # baret gölgesi
    "h": BROWN,                              # saç
    "s": SAND,                               # ten
    "S": COPPER,                             # ten gölgesi
    "g": UMBER,                              # güneş gözlüğü
    "G": rgba(BASE["sky"]),                  # cam parlaması
    "m": BROWN,                              # bıyık
    "j": rgba(BASE["plum"]),                 # ceket
    "J": rgba(TONE["lilac"]),                # ceket vurgusu
    "w": WHITE,                              # gömlek
    "t": rgba(BASE["purple"]),               # kravat
    "T": rgba(BASE["plum"]),                 # kravat gölgesi
}


def boss() -> Image.Image:
    """Baretli, güneş gözlüklü, takım elbiseli fabrika patronu."""
    assert len(BOSS_ROWS) == 32
    img = new(32, 32)
    px = img.load()
    for y, row in enumerate(BOSS_ROWS):
        assert len(row) == 32, f"patron satır {y}: {len(row)} sütun"
        for x, char in enumerate(row):
            px[x, y] = BOSS_COLORS[char]
    return img


def main() -> None:
    UI.mkdir(parents=True, exist_ok=True)
    card().save(ASSETS / "ui_card_bg.png")
    inset().save(ASSETS / "ui_panel_hud.png")
    modal().save(ASSETS / "ui_modal_bg.png")
    toast().save(ASSETS / "ui_toast_bg.png")
    bar_slot().save(ASSETS / "ui_bar_slot.png")
    bar(trim_on_top=False).save(UI / "bar_bg.png")
    bar(trim_on_top=True).save(UI / "dock_bg.png")
    pattern().save(UI / "pattern.png")
    floor().save(ASSETS / "factory_floor.png")
    concrete().save(ASSETS / "factory_concrete.png")
    fence(True).save(ASSETS / "factory_fence_h.png")
    fence(False).save(ASSETS / "factory_fence_v.png")
    boss().save(ASSETS / "boss.png")
    print("Tema dokuları yazıldı ->", ASSETS)


if __name__ == "__main__":
    main()
