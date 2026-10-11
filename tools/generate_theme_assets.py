#!/usr/bin/env python3
"""Arayüz ve fabrika zeminlerinin tema dokularını üretir.

Çalıştırma:  python3 tools/generate_theme_assets.py   (Pillow gerekir)

Tema "atölye mavisi + pirinç": koyu, donuk lacivert yerine daha canlı bir çelik mavisi;
panellerin kenarında açık mavi pah, köşelerinde pirinç perçin, çubukların kenarında
pirinç şerit ve her zeminde aynı ince "teknik çizim" ızgarası. Aynı motifler üst çubukta,
araç çubuğunda, pencerelerde ve fabrikanın çevresindeki boş alanda tekrar eder.

Üretilenler:
  public/assets/ui_panel_hud.png   iç bölme (karttan koyu, içe gömük)
  public/assets/ui_card_bg.png     kart
  public/assets/ui_modal_bg.png    pencere çerçevesi (pirinç perçinli)
  public/assets/ui_toast_bg.png    bildirim / öğretici kutusu (altın çerçeveli)
  public/assets/ui/bar_bg.png      üst çubuk (altında pirinç şerit)
  public/assets/ui/dock_bg.png     araç çubuğu tablası (üstünde pirinç şerit)
  public/assets/ui/pattern.png     panellerin üstüne serilen ince ızgara (yarı saydam)
  public/assets/factory_floor.png  fabrika zemin karosu
  public/assets/factory_backdrop.png  fabrikanın çevresi: teknik çizim ızgarası

Paneller 9 dilimlidir (kenar 6, pencerede 8 piksel); ortaları düz renktir, çünkü ortası
gerilerek çizilir. Renkler src/ui/theme.ts paletiyle aynıdır (docs/ART_DIRECTION.md §2).
"""

from pathlib import Path
from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets"
UI = ASSETS / "ui"


def rgb(hex_value: int, alpha: int = 255) -> tuple:
    return ((hex_value >> 16) & 255, (hex_value >> 8) & 255, hex_value & 255, alpha)


CLEAR = (0, 0, 0, 0)

# --- Tema paleti (src/ui/theme.ts PALETTE ile aynı değerler) -------------------
OUTLINE = rgb(0x081022)        # panellerin dış konturu
BG_DEEP = rgb(0x0A1330)        # sahne tabanı
INSET = rgb(0x0F1B3A)          # iç bölme dolgusu
PANEL = rgb(0x14244A)          # çubuk ve pencere dolgusu
CARD = rgb(0x1A2D58)           # kart dolgusu
BORDER_DARK = rgb(0x2B4380)    # çerçeve
BORDER_MID = rgb(0x3D60B8)
BORDER_LIGHT = rgb(0x4A6BBD)   # pah vurgusu
BORDER_GLOW = rgb(0x6D93F0)
SHADE = rgb(0x1B2C5A)          # alt/sağ gölge
BRASS_LIGHT = rgb(0xFFD166)
BRASS = rgb(0xC98F1A)
WHITE = rgb(0xFFFFFF)


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
    """2x2 pirinç perçin: sol üstü parlak, sağ altı koyu."""
    px = img.load()
    px[x, y] = BRASS_LIGHT
    px[x + 1, y] = BRASS_LIGHT
    px[x, y + 1] = BRASS_LIGHT
    px[x + 1, y + 1] = BRASS


def card() -> Image.Image:
    img = new(32, 32, CARD)
    ring(img, 0, OUTLINE)
    ring(img, 1, BORDER_LIGHT, BORDER_DARK)       # sol-üstten ışık
    ring(img, 2, rgb(0x223867), SHADE)
    return img


def inset() -> Image.Image:
    img = new(32, 32, INSET)
    ring(img, 0, OUTLINE)
    ring(img, 1, rgb(0x0B152E), BORDER_DARK)       # içe gömük: gölge üstte, ışık altta
    return img


def modal() -> Image.Image:
    img = new(32, 32, PANEL)
    ring(img, 0, rgb(0x050A18))
    ring(img, 1, BORDER_GLOW, BORDER_MID)
    ring(img, 2, BORDER_MID, BORDER_DARK)
    ring(img, 3, OUTLINE)
    for x, y in ((4, 4), (26, 4), (4, 26), (26, 26)):
        rivet(img, x, y)
    return img


def toast() -> Image.Image:
    img = new(32, 24, rgb(0x14244A, 240))
    ring(img, 0, rgb(0x070913))
    ring(img, 1, BRASS_LIGHT)
    px = img.load()
    px[2, 2] = WHITE
    px[29, 2] = WHITE
    return img


def bar(trim_on_top: bool) -> Image.Image:
    """Tam genişlikte çubuk: bir kenarında pirinç şerit, diğerinde ince vurgu."""
    img = new(32, 32, PANEL)
    px = img.load()
    for x in range(32):
        rows = (
            [OUTLINE, BRASS_LIGHT, BRASS, OUTLINE, rgb(0x1B3166)]
            if trim_on_top
            else [OUTLINE, rgb(0x1B3166)]
        )
        for index, color in enumerate(rows):
            px[x, index] = color
        tail = (
            [OUTLINE]
            if trim_on_top
            else [OUTLINE, BRASS, BRASS_LIGHT, OUTLINE]
        )
        for index, color in enumerate(tail):
            px[x, 31 - index] = color
    for y in range(32):
        px[0, y] = OUTLINE
        px[31, y] = OUTLINE
    return img


def pattern() -> Image.Image:
    """Panellerin üstüne serilen ince teknik çizim ızgarası (beyaz, çok düşük alfa)."""
    img = new(32, 32)
    px = img.load()
    for i in range(32):
        px[i, 0] = rgb(0xFFFFFF, 9)
        px[0, i] = rgb(0xFFFFFF, 9)
        if i % 4 == 0:
            px[i, 16] = rgb(0xFFFFFF, 7)
            px[16, i] = rgb(0xFFFFFF, 7)
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
        px[(16 + dx) % 32, (16 + dy) % 32] = rgb(0xFFFFFF, 20)
    return img


def floor() -> Image.Image:
    """Fabrika zemin karosu (64x32): üstte ray şeridi, altında iki sıra levha."""
    a, b, c, d, e = rgb(0x111E42), rgb(0x1F2F5C), rgb(0x1B2A54), rgb(0x273B72), rgb(0x33509A)
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


def backdrop() -> Image.Image:
    """Fabrikanın çevresi: 32 piksellik hücre ızgaralı teknik çizim zemini (64x64, döşenir)."""
    base, fine, bold, mark, dot = rgb(0x0B1634), rgb(0x0F1F48), rgb(0x142A5E), rgb(0x21428C), rgb(0x16306A)
    img = new(64, 64, base)
    px = img.load()
    for i in range(64):
        # İnce çizgiler her hücrede (kesikli), kalın çizgiler iki hücrede bir
        if i % 4 < 2:
            px[i, 32] = fine
            px[32, i] = fine
        px[i, 0] = bold
        px[0, i] = bold
    # Kalın çizgilerin kesişiminde artı işareti
    for step in range(-3, 4):
        px[step % 64, 0] = mark
        px[0, step % 64] = mark
    # Hücre ortalarında tek piksellik noktalar
    for cx, cy in ((16, 16), (48, 16), (16, 48), (48, 48)):
        px[cx, cy] = dot
    return img


def main() -> None:
    UI.mkdir(parents=True, exist_ok=True)
    card().save(ASSETS / "ui_card_bg.png")
    inset().save(ASSETS / "ui_panel_hud.png")
    modal().save(ASSETS / "ui_modal_bg.png")
    toast().save(ASSETS / "ui_toast_bg.png")
    bar(trim_on_top=False).save(UI / "bar_bg.png")
    bar(trim_on_top=True).save(UI / "dock_bg.png")
    pattern().save(UI / "pattern.png")
    floor().save(ASSETS / "factory_floor.png")
    backdrop().save(ASSETS / "factory_backdrop.png")
    print("Tema dokuları yazıldı ->", ASSETS)


if __name__ == "__main__":
    main()
