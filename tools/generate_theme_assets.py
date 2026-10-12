#!/usr/bin/env python3
"""Arayüz ve fabrika çevresinin tema dokularını üretir.

Çalıştırma:  python3 tools/generate_theme_assets.py   (Pillow gerekir)

Tema "krem + açık kahve": pencereler krem, kartlar açık krem, çubuklar açık kahve
(ten rengi); kenarlarda koyu kahve çerçeve ve pirinç perçinler. Fabrikanın çevresi
düz renk değildir: genişleyebileceği ama henüz açılmamış alan gri beton, onun dışı
kuşbakışı minyatür bir sanayi ve şehir çizimidir (yollar, fabrikalar, depolar, tanklar,
evler, park ve otopark).

Üretilenler:
  public/assets/ui_panel_hud.png     iç bölme (karttan koyu, içe gömük)
  public/assets/ui_card_bg.png       kart
  public/assets/ui_modal_bg.png      pencere çerçevesi (pirinç perçinli)
  public/assets/ui_toast_bg.png      bildirim / öğretici kutusu
  public/assets/ui_bar_slot.png      ilerleme çubuğu yuvası
  public/assets/ui/bar_bg.png        üst çubuk (altında koyu şerit)
  public/assets/ui/dock_bg.png       araç çubuğu tablası (üstünde koyu şerit)
  public/assets/ui/pattern.png       panellerin üstüne serilen ince ızgara (yarı saydam)
  public/assets/factory_floor.png    fabrika zemin karosu
  public/assets/factory_concrete.png açılmamış alanın beton karosu (32x32)
  public/assets/factory_backdrop.png sanayi ve şehir çizimi (512x512, döşenir)
  public/assets/factory_fence_h.png, factory_fence_v.png  arsanın çevre duvarı

Paneller 9 dilimlidir (kenar 6, pencerede 8 piksel); ortaları düz renktir, çünkü ortası
gerilerek çizilir. Kurallar docs/ART_DIRECTION.md ile aynıdır: 1px koyu kontur,
sol-üstten ışık, düz renkler.
"""

import math
from pathlib import Path
from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets"
UI = ASSETS / "ui"


def rgb(hex_value: int, alpha: int = 255) -> tuple:
    return ((hex_value >> 16) & 255, (hex_value >> 8) & 255, hex_value & 255, alpha)


CLEAR = (0, 0, 0, 0)

# --- Arayüz paleti (src/ui/theme.ts ile aynı aile) -----------------------------
INK = rgb(0x33241A)            # koyu kahve: kontur ve yazı
CREAM = rgb(0xF1E2C4)          # pencere dolgusu
CREAM_LIGHT = rgb(0xFAF0DA)    # kart dolgusu
CREAM_GLOW = rgb(0xFFF8E6)     # pah vurgusu
TAN = rgb(0xE7D4AD)            # iç bölme dolgusu
TAN_BAR = rgb(0xD9BD8F)        # çubuk dolgusu (açık kahve)
TAN_DARK = rgb(0xC9A877)       # çerçeve
BROWN = rgb(0xA8855A)          # gölge
BROWN_DARK = rgb(0x7A5C3E)
BRASS_LIGHT = rgb(0xFFD166)
BRASS = rgb(0xC98F1A)
WHITE = rgb(0xFFFFFF)
OUT = rgb(0x0C1020)            # dünya çizimlerinin konturu


class Rng:
    """Tohumlu, tekrarlanabilir rastgele sayı üreteci (dokular her çalıştırmada aynı çıkar)."""

    def __init__(self, seed: int):
        self.state = seed & 0xFFFFFFFF

    def next(self) -> float:
        self.state = (self.state * 1664525 + 1013904223) & 0xFFFFFFFF
        return self.state / 4294967296

    def between(self, low: int, high: int) -> int:
        return low + int(self.next() * (high - low + 1))

    def pick(self, items: list):
        return items[int(self.next() * len(items)) % len(items)]


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


# ---------------------------------------------------------------------------
# ARAYÜZ PANELLERİ
# ---------------------------------------------------------------------------


def card() -> Image.Image:
    img = new(32, 32, CREAM_LIGHT)
    ring(img, 0, BROWN_DARK)
    ring(img, 1, CREAM_GLOW, TAN_DARK)            # sol-üstten ışık
    return img


def inset() -> Image.Image:
    img = new(32, 32, TAN)
    ring(img, 0, BROWN_DARK)
    ring(img, 1, TAN_DARK, CREAM_GLOW)            # içe gömük: gölge üstte, ışık altta
    return img


def modal() -> Image.Image:
    img = new(32, 32, CREAM)
    ring(img, 0, INK)
    ring(img, 1, TAN_DARK, BROWN)
    ring(img, 2, CREAM_GLOW, TAN_DARK)
    ring(img, 3, BROWN_DARK)
    for x, y in ((4, 4), (26, 4), (4, 26), (26, 26)):
        rivet(img, x, y)
    return img


def toast() -> Image.Image:
    img = new(32, 24, rgb(0xFBF1DC, 248))
    ring(img, 0, INK)
    ring(img, 1, BROWN_DARK)
    return img


def bar_slot() -> Image.Image:
    """İlerleme çubuğunun yuvası: koyu kahve oluk."""
    img = new(32, 12, rgb(0x2E2118))
    ring(img, 0, INK)
    ring(img, 1, rgb(0x1E150E), BROWN_DARK)
    return img


def bar(trim_on_top: bool) -> Image.Image:
    """Tam genişlikte çubuk: bir kenarında koyu şerit ve krem pah, diğerinde ince vurgu."""
    img = new(32, 32, TAN_BAR)
    px = img.load()
    trim = [INK, BROWN_DARK, CREAM_GLOW, rgb(0xE6CDA2)]
    plain = [INK, rgb(0xE6CDA2)]
    for x in range(32):
        for index, color in enumerate(trim if trim_on_top else plain):
            px[x, index] = color
        for index, color in enumerate(plain if trim_on_top else trim):
            px[x, 31 - index] = color
    for y in range(32):
        px[0, y] = INK
        px[31, y] = INK
    return img


def pattern() -> Image.Image:
    """Panellerin üstüne serilen ince teknik çizim ızgarası (koyu kahve, çok düşük alfa)."""
    img = new(32, 32)
    px = img.load()
    ink = 0x5A4130
    for i in range(32):
        px[i, 0] = rgb(ink, 16)
        px[0, i] = rgb(ink, 16)
        if i % 4 == 0:
            px[i, 16] = rgb(ink, 12)
            px[16, i] = rgb(ink, 12)
    for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
        px[(16 + dx) % 32, (16 + dy) % 32] = rgb(ink, 30)
    return img


# ---------------------------------------------------------------------------
# FABRİKA ZEMİNLERİ
# ---------------------------------------------------------------------------


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


def concrete() -> Image.Image:
    """Açılmamış alanın beton karosu (32x32, hücreyle hizalı): derzli, benekli gri beton."""
    rng = Rng(7)
    base, light, dark, joint = rgb(0x9A9DA3), rgb(0xAEB1B6), rgb(0x8B8E94), rgb(0x7C7F86)
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
    """Arsanın çevre duvarı (8 piksel uzunlukta döşenir, 6 piksel kalın): tuğla sıra ve direk."""
    rows = [OUT, rgb(0xB98D5E), rgb(0x8A5A3C), rgb(0x8A5A3C), rgb(0x5A3A2A), OUT]
    img = new(8, 6) if horizontal else new(6, 8)
    px = img.load()
    for along in range(8):
        for across, color in enumerate(rows):
            # Her 8 pikselde bir derz
            pixel = rgb(0x5A3A2A) if along == 0 and across in (2, 3) else color
            if horizontal:
                px[along, across] = pixel
            else:
                px[across, along] = pixel
    return img


# ---------------------------------------------------------------------------
# SANAYİ VE ŞEHİR ÇİZİMİ (kuşbakışı, 512x512, döşenir)
# ---------------------------------------------------------------------------

CITY = 512
BLOCK = 128          # yol + ada
ROAD = 32
LOT = BLOCK - ROAD   # adanın kenarı (96)

ASPHALT, ASPHALT_DARK = rgb(0x50545C), rgb(0x44484F)
CURB, LANE = rgb(0xCFC7B4), rgb(0xEADFB0)
GRAVEL, GRAVEL_DARK = rgb(0xC3AE86), rgb(0xA8946E)
GRASS, GRASS_DARK, TREE, TREE_LIGHT = rgb(0x7DBB63), rgb(0x66A552), rgb(0x2F7D3B), rgb(0x57A85A)
WATER, WATER_LIGHT = rgb(0x4FA3D8), rgb(0x8FCBEB)
STEEL, STEEL_LIGHT, STEEL_DARK = rgb(0x8E97A8), rgb(0xC3CAD6), rgb(0x66708A)
BRICK, BRICK_LIGHT, BRICK_DARK = rgb(0xB0683F), rgb(0xD08A5C), rgb(0x834A2B)
ROOFS = [
    (rgb(0xC0621A), rgb(0xE08A46), rgb(0x8F4611)),   # kiremit
    (rgb(0x3F8F8C), rgb(0x66B8B4), rgb(0x2B6765)),   # camgöbeği
    (rgb(0xE6D3A3), rgb(0xFFF0C2), rgb(0xB9A572)),   # krem
    (rgb(0x6C7A99), rgb(0x94A2C0), rgb(0x4C5873)),   # arduvaz
    (rgb(0xB5524A), rgb(0xD97F76), rgb(0x833830)),   # kırmızı
]
CARS = [rgb(0xE74C3C), rgb(0x3B7DDD), rgb(0xFFD166), rgb(0xF5F6FA), rgb(0x2ECC71), rgb(0x34495E)]


class City:
    def __init__(self):
        self.img = new(CITY, CITY, GRAVEL)
        self.px = self.img.load()

    def dot(self, x: int, y: int, color: tuple) -> None:
        self.px[x % CITY, y % CITY] = color

    def rect(self, x: int, y: int, w: int, h: int, color: tuple) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.dot(xx, yy, color)

    def box(self, x: int, y: int, w: int, h: int, fill: tuple, light: tuple, dark: tuple, shadow: tuple = None) -> None:
        """Konturlu çatı: sol/üst kenarı açık, sağ/alt kenarı koyu; sağ altında zemin gölgesi."""
        if shadow:
            self.rect(x + 3, y + 3, w, h, shadow)
        self.rect(x, y, w, h, OUT)
        self.rect(x + 1, y + 1, w - 2, h - 2, fill)
        self.rect(x + 1, y + 1, w - 2, 1, light)
        self.rect(x + 1, y + 1, 1, h - 2, light)
        self.rect(x + 1, y + h - 2, w - 2, 1, dark)
        self.rect(x + w - 2, y + 1, 1, h - 2, dark)

    def disc(self, cx: int, cy: int, r: int, fill: tuple, light: tuple = None, outline: bool = True) -> None:
        for dy in range(-r - 1, r + 2):
            for dx in range(-r - 1, r + 2):
                d = math.hypot(dx, dy)
                if d <= r - 0.3:
                    lit = light and dx + dy < -r * 0.5
                    self.dot(cx + dx, cy + dy, light if lit else fill)
                elif outline and d <= r + 0.7:
                    self.dot(cx + dx, cy + dy, OUT)

    # -- Yollar ---------------------------------------------------------------

    def roads(self) -> None:
        for k in range(CITY // BLOCK):
            o = k * BLOCK
            self.rect(o, 0, ROAD, CITY, ASPHALT)
            self.rect(0, o, CITY, ROAD, ASPHALT)
        for k in range(CITY // BLOCK):
            o = k * BLOCK
            # Kaldırım taşları (yolun iki kenarı) ve orta şerit; kavşaklarda kesilir
            for j in range(CITY // BLOCK):
                start = j * BLOCK + ROAD
                self.rect(o, start, 2, LOT, CURB)
                self.rect(o + ROAD - 2, start, 2, LOT, CURB)
                self.rect(start, o, LOT, 2, CURB)
                self.rect(start, o + ROAD - 2, LOT, 2, CURB)
                for step in range(4, LOT - 4, 12):
                    self.rect(o + 15, start + step, 2, 6, LANE)
                    self.rect(start + step, o + 15, 6, 2, LANE)
                # Yaya geçitleri
                for stripe in range(4, ROAD - 4, 4):
                    self.rect(o + stripe, start, 2, 5, CURB)
                    self.rect(o + stripe, start + LOT - 5, 2, 5, CURB)
                    self.rect(start, o + stripe, 5, 2, CURB)
                    self.rect(start + LOT - 5, o + stripe, 5, 2, CURB)

    # -- Adalar ---------------------------------------------------------------

    def tree(self, cx: int, cy: int, r: int) -> None:
        self.disc(cx + 1, cy + 1, r, GRASS_DARK, outline=False)
        self.disc(cx, cy, r, TREE, TREE_LIGHT)

    def car(self, x: int, y: int, color: tuple, vertical: bool) -> None:
        w, h = (5, 8) if vertical else (8, 5)
        self.rect(x, y, w, h, OUT)
        self.rect(x + 1, y + 1, w - 2, h - 2, color)
        if vertical:
            self.rect(x + 1, y + 2, w - 2, 1, rgb(0x9FD8F0))
        else:
            self.rect(x + 2, y + 1, 1, h - 2, rgb(0x9FD8F0))

    def chimney(self, cx: int, cy: int, rng: Rng) -> None:
        self.disc(cx, cy, 4, rgb(0x3A3F4A), STEEL_LIGHT)
        self.disc(cx, cy, 2, rgb(0x1A1D24), outline=False)
        # Duman: sol üste doğru küçülen açık gri kümeler
        for index, radius in enumerate((3, 4, 3)):
            self.disc(cx - 5 - index * 5 + rng.between(-1, 1), cy - 6 - index * 5, radius, rgb(0xE4E1D8), WHITE, outline=False)

    def factory(self, x: int, y: int, rng: Rng) -> None:
        self.rect(x, y, LOT, LOT, GRAVEL)
        roof = rng.pick([(BRICK, BRICK_LIGHT, BRICK_DARK), (STEEL, STEEL_LIGHT, STEEL_DARK)])
        self.box(x + 8, y + 10, 66, 44, roof[0], roof[1], roof[2], GRAVEL_DARK)
        # Testere dişi çatı: eşit aralıklı ışıklıklar
        for stripe in range(x + 16, x + 70, 10):
            self.rect(stripe, y + 13, 2, 38, roof[2])
            self.rect(stripe + 2, y + 13, 3, 38, rgb(0x9FD8F0))
        self.box(x + 60, y + 60, 28, 26, STEEL, STEEL_LIGHT, STEEL_DARK, GRAVEL_DARK)
        self.chimney(x + 20, y + 68, rng)
        self.chimney(x + 38, y + 72, rng)
        # Hammadde yığınları
        self.disc(x + 14, y + 86, 5, rgb(0x7F8C8D), rgb(0xA4B0B5))
        self.disc(x + 30, y + 88, 4, rgb(0xC0621A), rgb(0xE08A46))
        self.rect(x + 74, y + 30, 14, 2, STEEL_DARK)

    def warehouse(self, x: int, y: int, rng: Rng) -> None:
        self.rect(x, y, LOT, LOT, rgb(0x8E9198))
        for index in range(2):
            color = rng.pick([(rgb(0x5E86B8), rgb(0x8FB0DA), rgb(0x3F6491)), (rgb(0xD9BD8F), rgb(0xF1DDB5), rgb(0xA8855A))])
            top = y + 6 + index * 46
            self.box(x + 6, top, 62, 34, color[0], color[1], color[2], rgb(0x6F7279))
            for stripe in range(x + 12, x + 64, 6):
                self.rect(stripe, top + 3, 1, 28, color[2])
        for index in range(3):
            self.car(x + 74, y + 8 + index * 28, rng.pick(CARS), True)
            self.rect(x + 73, y + 17 + index * 28, 7, 12, OUT)
            self.rect(x + 74, y + 18 + index * 28, 5, 10, rgb(0xE9E4D6))

    def tanks(self, x: int, y: int, rng: Rng) -> None:
        self.rect(x, y, LOT, LOT, GRAVEL)
        for row in range(2):
            for col in range(2):
                cx, cy = x + 26 + col * 44, y + 26 + row * 44
                self.disc(cx + 3, cy + 3, 15, GRAVEL_DARK, outline=False)
                body = rng.pick([(rgb(0xE9E4D6), WHITE), (rgb(0x8E97A8), STEEL_LIGHT), (rgb(0xE6D3A3), rgb(0xFFF0C2))])
                self.disc(cx, cy, 15, body[0], body[1])
                self.disc(cx, cy, 3, STEEL_DARK, outline=False)
        # Boru hatları
        self.rect(x + 26, y + 46, 44, 2, STEEL_DARK)
        self.rect(x + 47, y + 26, 2, 44, STEEL_DARK)
        self.disc(x + 48, y + 47, 3, rgb(0xE74C3C), rgb(0xF29488))

    def houses(self, x: int, y: int, rng: Rng) -> None:
        self.rect(x, y, LOT, LOT, GRASS)
        for row in range(2):
            for col in range(3):
                roof = rng.pick(ROOFS)
                bx, by = x + 5 + col * 31, y + 6 + row * 46
                w, h = rng.between(22, 25), rng.between(26, 32)
                self.box(bx, by, w, h, roof[0], roof[1], roof[2], GRASS_DARK)
                self.rect(bx + 2, by + h // 2, w - 4, 1, roof[2])      # çatı sırtı
                self.rect(bx + w - 8, by + 4, 4, 4, rgb(0x5A4130))       # baca
        for _ in range(5):
            self.tree(x + rng.between(8, LOT - 8), y + rng.pick([40, 42, 88, 90]), 3)

    def park(self, x: int, y: int, rng: Rng) -> None:
        self.rect(x, y, LOT, LOT, GRASS)
        self.rect(x + 45, y, 6, LOT, rgb(0xE6D3A3))
        self.rect(x, y + 45, LOT, 6, rgb(0xE6D3A3))
        # Gölet
        for dy in range(-9, 10):
            for dx in range(-13, 14):
                d = (dx / 13) ** 2 + (dy / 9) ** 2
                if d <= 0.82:
                    self.dot(x + 24 + dx, y + 24 + dy, WATER_LIGHT if dx + dy < -8 else WATER)
                elif d <= 1.05:
                    self.dot(x + 24 + dx, y + 24 + dy, rgb(0x2F6E9E))
        for _ in range(12):
            tx, ty = rng.between(6, LOT - 6), rng.between(6, LOT - 6)
            in_pond = tx < 44 and ty < 40
            on_path = 40 < tx < 56 or 40 < ty < 56
            if not in_pond and not on_path:
                self.tree(x + tx, y + ty, rng.between(4, 6))
        self.disc(x + 48, y + 48, 5, rgb(0xCFC7B4), WHITE)

    def parking(self, x: int, y: int, rng: Rng) -> None:
        self.rect(x, y, LOT, LOT, rgb(0x5E626A))
        for row in range(3):
            top = y + 8 + row * 30
            self.rect(x + 6, top + 10, LOT - 12, 1, CURB)
            for bay in range(9):
                bx = x + 8 + bay * 9
                self.rect(bx, top, 1, 21, CURB)
                if rng.next() < 0.62:
                    self.car(bx + 2, top + (1 if rng.next() < 0.5 else 12), rng.pick(CARS), True)
        self.tree(x + 6, y + 92, 3)
        self.tree(x + 90, y + 92, 3)

    def build(self) -> Image.Image:
        rng = Rng(2026)
        kinds = [self.factory] * 4 + [self.warehouse] * 3 + [self.tanks] * 2 + [self.houses] * 4 + [self.park] * 1 + [self.parking] * 2
        # Tohumlu karıştırma: aynı türler yan yana yığılmasın
        for index in range(len(kinds) - 1, 0, -1):
            swap = rng.between(0, index)
            kinds[index], kinds[swap] = kinds[swap], kinds[index]
        for row in range(CITY // BLOCK):
            for col in range(CITY // BLOCK):
                kinds[row * 4 + col](col * BLOCK + ROAD, row * BLOCK + ROAD, rng)
        self.roads()
        return self.img


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
    "o": OUT,
    "Y": rgb(0xFFF0C2),   # baret vurgusu
    "H": rgb(0xFFD166),   # baret
    "d": rgb(0xC98F1A),   # baret gölgesi
    "h": rgb(0x4A2F1C),   # saç
    "s": rgb(0xF0C8A0),   # ten
    "S": rgb(0xD9A57C),   # ten gölgesi
    "g": rgb(0x1A1D24),   # güneş gözlüğü
    "G": rgb(0x9FD8F0),   # cam parlaması
    "m": rgb(0x33241A),   # bıyık
    "j": rgb(0x2F3D66),   # ceket
    "J": rgb(0x4F649C),   # ceket vurgusu
    "w": rgb(0xF5F6FA),   # gömlek
    "t": rgb(0xE74C3C),   # kravat
    "T": rgb(0xA5281B),   # kravat gölgesi
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
    City().build().save(ASSETS / "factory_backdrop.png")
    boss().save(ASSETS / "boss.png")
    print("Tema dokuları yazıldı ->", ASSETS)


if __name__ == "__main__":
    main()
