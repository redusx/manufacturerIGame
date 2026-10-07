#!/usr/bin/env python3
"""Makine sprite'larını ve port oklarını üretir (public/assets/machines/).

Çalıştırma:  python3 tools/generate_machine_assets.py   (Pillow gerekir)

Her makine kendi ayak izinde, hücre başına 32 piksel çizilir (1 doku pikseli = 1 dünya
pikseli) ve 4 karelik yatay bir şerittir: kare 0 bekleme, kare 1-3 çalışma animasyonu.
Makineler döndürülünce resim döndürülmez; kare olmayan makinelerin (fırın, pres) yatay ve
dikey iki ayrı çizimi vardır (`*_rot.png`). Yönü giriş/çıkış okları gösterir.

Kurallar docs/ART_DIRECTION.md ile aynıdır: 1px koyu kontur, sol-üstten ışık (üst/sol
açık, alt/sağ koyu), düz renkler, src/ui/theme.ts paletiyle uyumlu tonlar.
"""

from pathlib import Path
from PIL import Image

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "machines"
TILE = 32
FRAMES = 4


def rgb(hex_value: int) -> tuple:
    return ((hex_value >> 16) & 255, (hex_value >> 8) & 255, hex_value & 255, 255)


CLEAR = (0, 0, 0, 0)
OUT = rgb(0x0C1020)

# Çelik tonları (koyudan açığa)
ST0 = rgb(0x121829)
ST1 = rgb(0x242F4C)
ST2 = rgb(0x3D4E7A)
ST3 = rgb(0x66779B)
ST4 = rgb(0xA4B0C8)
ST5 = rgb(0xDDE4F0)

AM1, AM2, AM3 = rgb(0xC0621A), rgb(0xF4A261), rgb(0xFFD9B0)      # fabrika kehribarı
GD1, GD2, GD3 = rgb(0xC98F1A), rgb(0xFFD166), rgb(0xFFF0C2)      # altın / erimiş metal
OR2 = rgb(0xF39C12)
RD1, RD2 = rgb(0xA5281B), rgb(0xE74C3C)
CY1, CY2, CY3 = rgb(0x01898A), rgb(0x00D2D3), rgb(0xA6F4F4)
GR1, GR2, GR3 = rgb(0x1E8449), rgb(0x2ECC71), rgb(0x82E0AA)
BL1, BL2, BL3 = rgb(0x234E96), rgb(0x3B7DDD), rgb(0x8FB8F5)
PU1, PU2, PU3 = rgb(0x4A379C), rgb(0x7D5FE0), rgb(0xB7A4F5)
BR1, BR2 = rgb(0x5A3A2A), rgb(0x8A5A3C)                           # tuğla / cevher


class Canvas:
    """Kapsayan (inclusive) koordinatlarla çalışan küçük piksel tuvali."""

    def __init__(self, width: int, height: int):
        self.w = width
        self.h = height
        self.img = Image.new("RGBA", (width, height), CLEAR)
        self.px = self.img.load()

    def dot(self, x: int, y: int, color: tuple) -> None:
        if 0 <= x < self.w and 0 <= y < self.h:
            self.px[x, y] = color

    def rect(self, x0: int, y0: int, x1: int, y1: int, color: tuple) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.dot(x, y, color)

    def frame(self, x0: int, y0: int, x1: int, y1: int, color: tuple = OUT) -> None:
        for x in range(x0, x1 + 1):
            self.dot(x, y0, color)
            self.dot(x, y1, color)
        for y in range(y0, y1 + 1):
            self.dot(x0, y, color)
            self.dot(x1, y, color)

    def box(self, x0, y0, x1, y1, body, light=None, dark=None) -> None:
        """Konturlu kutu: üst/sol kenarda açık, alt/sağ kenarda koyu şerit."""
        self.rect(x0, y0, x1, y1, body)
        if light:
            self.rect(x0 + 1, y0 + 1, x1 - 1, y0 + 1, light)
            self.rect(x0 + 1, y0 + 1, x0 + 1, y1 - 1, light)
        if dark:
            self.rect(x0 + 1, y1 - 1, x1 - 1, y1 - 1, dark)
            self.rect(x1 - 1, y0 + 1, x1 - 1, y1 - 1, dark)
        self.frame(x0, y0, x1, y1)

    def hazard(self, x0: int, y0: int, x1: int, y1: int, phase: int = 0) -> None:
        """Sarı-siyah çapraz ikaz şeridi."""
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.dot(x, y, GD2 if ((x + y + phase) // 2) % 2 == 0 else ST0)

    def disc(self, cx: float, cy: float, radius: float, color: tuple) -> None:
        for y in range(int(cy - radius) - 1, int(cy + radius) + 2):
            for x in range(int(cx - radius) - 1, int(cx + radius) + 2):
                if (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius:
                    self.dot(x, y, color)

    def ring(self, cx: float, cy: float, radius: float, color: tuple = OUT) -> None:
        """Diskin dışına 1 piksellik kontur."""
        inside = set()
        for y in range(int(cy - radius) - 2, int(cy + radius) + 3):
            for x in range(int(cx - radius) - 2, int(cx + radius) + 3):
                if (x - cx) ** 2 + (y - cy) ** 2 <= radius * radius:
                    inside.add((x, y))
        for (x, y) in inside:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                if (x + dx, y + dy) not in inside:
                    self.dot(x + dx, y + dy, color)


def sheet(width: int, height: int, draw) -> Image.Image:
    """`draw(canvas, frame)` ile 4 karelik yatay şerit üretir."""
    strip = Image.new("RGBA", (width * FRAMES, height), CLEAR)
    for frame in range(FRAMES):
        canvas = Canvas(width, height)
        draw(canvas, frame)
        strip.paste(canvas.img, (frame * width, 0))
    return strip


# ---------------------------------------------------------------------------
# 1. KIRICI (1x1): huni + kehribar gövde + dönen dişli merdaneler
# ---------------------------------------------------------------------------

def draw_crusher(c: Canvas, f: int) -> None:
    # Taban
    c.box(2, 24, 29, 30, ST1, ST2, ST0)
    c.rect(12, 27, 19, 29, ST0)                       # çıkış ağzı
    c.hazard(4, 27, 9, 28)
    c.hazard(22, 27, 27, 28)

    # Kehribar kırma haznesi
    c.box(4, 11, 27, 24, AM2, AM3, AM1)
    c.rect(7, 13, 24, 22, ST0)                        # pencere
    c.frame(6, 12, 25, 23)

    # İki dişli merdane; çalışırken dişler döner
    for cx in (11.5, 19.5):
        c.disc(cx, 17.5, 3.6, ST3)
        c.disc(cx, 17.5, 1.2, ST1)
    teeth = [(-3, 0), (0, -3), (3, 0), (0, 3)] if f % 2 == 0 else [(-2, -2), (2, -2), (2, 2), (-2, 2)]
    for cx in (11, 19):
        for (dx, dy) in teeth:
            c.dot(cx + dx + (1 if dx > 0 else 0), 17 + dy + (1 if dy > 0 else 0), ST5)
    if f > 0:                                          # kırılan cevher parçaları
        for (x, y) in ((15 + (f % 2), 14 + f), (16 - (f % 2), 19 + (f % 3)), (14 + f, 21)):
            c.dot(x, y, BR2)

    # Huni (yukarı doğru genişler)
    for row, y in enumerate(range(10, 1, -1)):
        inset = max(0, 6 - row)
        x0, x1 = 3 + inset, 28 - inset
        c.rect(x0, y, x1, y, ST3)
        c.dot(x0 + 1, y, ST4)
        c.dot(x1 - 1, y, ST2)
        c.dot(x0, y, OUT)
        c.dot(x1, y, OUT)
    c.rect(3, 1, 28, 1, OUT)
    c.rect(4, 2, 27, 2, ST5)                          # ağız kenarı
    c.rect(6, 3, 25, 4, ST0)                          # huninin içi
    for i, x in enumerate((8, 12, 17, 21)):           # içindeki cevher
        shift = (f + i) % 2 if f > 0 else 0
        c.rect(x + shift, 3, x + 1 + shift, 4, BR2 if i % 2 == 0 else ST3)
    c.rect(9, 10, 22, 10, OUT)


# ---------------------------------------------------------------------------
# 2. KESİCİ (1x1): mavi köprü + lazer kafası + camgöbeği ışın
# ---------------------------------------------------------------------------

def draw_cutter(c: Canvas, f: int) -> None:
    # Tabla
    c.box(2, 23, 29, 30, ST1, ST2, ST0)
    for x in range(5, 27, 3):
        c.rect(x, 26, x, 28, ST0)

    # İş parçası (levha)
    c.rect(7, 20, 24, 22, ST4)
    c.rect(7, 20, 24, 20, ST5)
    c.frame(6, 19, 25, 23)
    c.rect(7, 23, 24, 23, ST1)
    if f > 0:
        c.rect(16, 20, 16, 22, ST0)                    # kesim izi

    # Sol kolon ve üst köprü
    c.box(3, 4, 8, 22, BL2, BL3, BL1)
    c.box(3, 3, 27, 9, BL2, BL3, BL1)
    c.dot(5, 6, GR2 if f > 0 else ST0)                 # durum ışığı
    c.rect(25, 10, 26, 18, ST2)                        # sağ destek
    c.frame(24, 9, 27, 19)

    # Lazer kafası
    c.box(12, 9, 20, 15, ST3, ST4, ST2)
    c.rect(15, 14, 17, 16, CY2)
    c.frame(14, 13, 18, 17)
    c.dot(16, 15, CY3)

    # Işın ve kıvılcım
    if f > 0:
        c.rect(16, 18, 16, 19, CY3 if f % 2 else CY2)
        sparks = {1: ((14, 19), (18, 18)), 2: ((13, 18), (19, 19), (15, 17)), 3: ((14, 18), (18, 19))}[f]
        for (x, y) in sparks:
            c.dot(x, y, GD2)


# ---------------------------------------------------------------------------
# 3. PRES (1x2 dikey / 2x1 yatay): kehribar kiriş + inen çelik piston
# ---------------------------------------------------------------------------

def draw_press(c: Canvas, f: int) -> None:
    ram_top = (20, 28, 37, 28)[f]

    # Taban ve örs
    c.box(2, 51, 29, 62, ST1, ST2, ST0)
    c.hazard(4, 57, 27, 59)
    c.frame(3, 56, 28, 60)
    c.box(6, 46, 25, 51, ST2, ST3, ST1)

    # Kolonlar
    for x0 in (3, 24):
        c.box(x0, 13, x0 + 4, 46, ST4, ST5, ST3)

    # İş parçası
    c.rect(10, 44, 21, 45, GD2 if f == 2 else ST5)
    c.frame(9, 43, 22, 46)
    if f == 2:
        for (x, y) in ((8, 42), (23, 42), (7, 40), (24, 41)):
            c.dot(x, y, GD2)

    # Piston mili ve baskı kafası
    c.rect(14, 14, 17, ram_top, ST3)
    c.rect(14, 14, 14, ram_top, ST5)
    c.rect(13, 14, 13, ram_top, OUT)
    c.rect(18, 14, 18, ram_top, OUT)
    c.box(9, ram_top, 22, ram_top + 6, ST2, ST3, ST1)
    c.rect(10, ram_top + 5, 21, ram_top + 5, ST4)

    # Üst kiriş
    c.box(2, 1, 29, 13, AM2, AM3, AM1)
    c.hazard(4, 9, 27, 11)
    c.frame(3, 8, 28, 12)
    c.box(11, 3, 20, 7, ST5, None, None)
    c.rect(14, 4, 17, 6, RD2 if f in (1, 2, 3) else RD1)


def draw_press_rot(c: Canvas, f: int) -> None:
    ram_top = (11, 14, 17, 14)[f]

    # Taban
    c.box(2, 24, 61, 30, ST1, ST2, ST0)
    c.hazard(5, 27, 58, 28)

    # Kolonlar
    for x0 in (3, 56):
        c.box(x0, 8, x0 + 4, 24, ST4, ST5, ST3)

    # İş parçası
    c.rect(14, 22, 49, 23, GD2 if f == 2 else ST5)
    c.frame(13, 21, 50, 24)
    if f == 2:
        for (x, y) in ((11, 20), (52, 20), (10, 18), (53, 19)):
            c.dot(x, y, GD2)

    # İki piston mili ve geniş baskı kafası
    for x0 in (20, 41):
        c.rect(x0, 9, x0 + 2, ram_top, ST3)
        c.rect(x0, 9, x0, ram_top, ST5)
        c.rect(x0 - 1, 9, x0 - 1, ram_top, OUT)
        c.rect(x0 + 3, 9, x0 + 3, ram_top, OUT)
    c.box(11, ram_top, 52, ram_top + 4, ST2, ST3, ST1)
    c.rect(12, ram_top + 3, 51, ram_top + 3, ST4)

    # Üst kiriş
    c.box(2, 1, 61, 9, AM2, AM3, AM1)
    c.hazard(5, 6, 24, 7)
    c.hazard(39, 6, 58, 7)
    c.box(27, 3, 36, 7, ST5, None, None)
    c.rect(30, 4, 33, 6, RD2 if f in (1, 2, 3) else RD1)


# ---------------------------------------------------------------------------
# 4. FIRIN (2x1 yatay / 1x2 dikey): kızıl ağızlı ocak + baca + külçe kalıbı
# ---------------------------------------------------------------------------

def glow_arch(c: Canvas, x0: int, y0: int, x1: int, y1: int, f: int) -> None:
    """Kemerli ocak ağzı. Çalışırken içi parlar, beklerken sönük kor kalır."""
    lit = f > 0
    layers = [RD1, RD2, OR2, GD2, GD3] if lit else [ST0, BR1, RD1, RD1, RD1]
    flicker = (0, 0, 1, 0)[f]
    for depth, color in enumerate(layers):
        ax0, ay0, ax1 = x0 + depth, y0 + depth, x1 - depth
        if depth == len(layers) - 1:
            ay0 += 1 - flicker
        if ax0 > ax1 or ay0 > y1:
            break
        c.rect(ax0, ay0, ax1, y1, color)
        if depth == 0:                                 # kemerin üst köşelerini yuvarla
            for (cx, cy) in ((ax0, ay0), (ax1, ay0), (ax0, ay0 + 1), (ax1, ay0 + 1), (ax0 + 1, ay0), (ax1 - 1, ay0)):
                c.dot(cx, cy, ST1)
    # Kontur (yuvarlatılmış köşelerle)
    c.rect(x0 + 2, y0 - 1, x1 - 2, y0 - 1, OUT)
    c.dot(x0 + 1, y0, OUT)
    c.dot(x1 - 1, y0, OUT)
    c.dot(x0, y0 + 1, OUT)
    c.dot(x1, y0 + 1, OUT)
    c.rect(x0 - 1, y0 + 2, x0 - 1, y1, OUT)
    c.rect(x1 + 1, y0 + 2, x1 + 1, y1, OUT)
    c.rect(x0 - 1, y1 + 1, x1 + 1, y1 + 1, OUT)


def draw_smelter(c: Canvas, f: int) -> None:
    # Taban
    c.box(1, 26, 62, 30, ST1, ST2, ST0)

    # Baca
    c.box(31, 1, 38, 8, ST2, ST3, ST1)
    c.rect(32, 2, 37, 2, ST4)

    # Ocak gövdesi (tuğla sıralı)
    c.box(2, 5, 42, 27, BR1, BR2, ST0)
    for y in (10, 15, 20):
        c.rect(4, y, 40, y, ST0)
    for row, y in enumerate((7, 12, 17, 22)):
        for x in range(6 + (row % 2) * 4, 40, 8):
            c.rect(x, y, x, y + 2, ST0)
    c.rect(3, 6, 41, 6, BR2)

    glow_arch(c, 8, 11, 27, 24, f)

    # Sıcaklık göstergesi
    c.disc(35.5, 14.5, 2.6, ST5)
    c.ring(35.5, 14.5, 2.6)
    c.dot(35, 14, RD2)
    c.dot(36 if f in (2, 3) else 34, 13, RD2)

    # Döküm istasyonu: pota + akan metal + külçe kalıbı
    c.rect(43, 9, 47, 10, AM1)                         # besleme borusu
    c.frame(42, 8, 48, 11)
    c.box(47, 6, 58, 15, ST3, ST4, ST2)
    c.rect(49, 8, 56, 9, GD2 if f > 0 else GD1)
    if f > 0:
        c.rect(52, 16, 53, 19 + (f % 2), OR2 if f % 2 else GD2)
    c.box(45, 21, 61, 26, ST2, ST3, ST1)
    for x0 in (47, 54):
        c.rect(x0, 19, x0 + 4, 21, GD2)
        c.rect(x0, 19, x0 + 4, 19, GD3)
        c.frame(x0 - 1, 18, x0 + 5, 22)


def draw_smelter_rot(c: Canvas, f: int) -> None:
    # Taban ve külçe kalıbı
    c.box(1, 54, 30, 62, ST1, ST2, ST0)
    c.box(4, 46, 27, 54, ST2, ST3, ST1)
    for x0 in (7, 17):
        c.rect(x0, 44, x0 + 6, 46, GD2)
        c.rect(x0, 44, x0 + 6, 44, GD3)
        c.frame(x0 - 1, 43, x0 + 7, 47)

    # Baca ve davlumbaz
    c.box(11, 1, 20, 9, ST2, ST3, ST1)
    c.rect(12, 2, 19, 2, ST4)
    for row, y in enumerate(range(9, 14)):
        x0, x1 = 8 - row, 23 + row
        c.rect(x0, y, x1, y, ST3)
        c.dot(x0 + 1, y, ST4)
        c.dot(x0, y, OUT)
        c.dot(x1, y, OUT)
    c.rect(8, 8, 23, 8, OUT)

    # Ocak gövdesi (tuğla sıralı)
    c.box(2, 13, 29, 43, BR1, BR2, ST0)
    for y in (18, 23, 28, 33, 38):
        c.rect(4, y, 27, y, ST0)
    for row, y in enumerate((15, 20, 25, 30, 35, 40)):
        for x in range(6 + (row % 2) * 4, 27, 8):
            c.rect(x, y, x, y + 2, ST0)
    c.rect(3, 14, 28, 14, BR2)

    glow_arch(c, 7, 21, 24, 38, f)
    if f > 0:                                          # ocaktan kalıba akan metal
        c.rect(15, 40, 16, 42, OR2 if f % 2 else GD2)


# ---------------------------------------------------------------------------
# 5. MONTAJ İSTASYONU (2x2): mor kabin + ekran + robot kol
# ---------------------------------------------------------------------------

def draw_assembler(c: Canvas, f: int) -> None:
    # Alt konsol
    c.box(1, 47, 62, 62, ST1, ST2, ST0)
    c.rect(2, 48, 61, 48, PU3)
    for i, color in enumerate((GD2, GR2, RD2)):
        c.box(6 + i * 7, 53, 10 + i * 7, 57, color, None, None)
    c.rect(34, 54, 46, 55, CY2)                        # "T" işareti
    c.rect(45, 52, 46, 57, CY2)
    c.rect(50, 54, 58, 55, RD2)                        # "+" işareti
    c.rect(53, 51, 54, 58, RD2)

    # Çalışma bölmesi
    c.box(8, 32, 55, 47, ST0, None, None)
    c.rect(9, 45, 54, 46, ST1)

    # Çip (çalışırken pimleri sırayla yanar)
    c.box(36, 37, 45, 44, GR2, GR3, GR1)
    for i, x in enumerate((38, 40, 42)):
        c.dot(x, 36, GD2 if (f > 0 and (f + i) % 3 == 0) else GD1)
        c.dot(x, 45, GD2 if (f > 0 and (f + i) % 3 == 1) else GD1)
    c.dot(40, 40, GD3 if f == 2 else GR1)

    # Robot kol: gövde + omuz + uç (çalışırken çipe uzanır)
    reach = (0, 4, 8, 4)[f]
    c.box(11, 40, 17, 46, ST3, ST4, ST2)
    c.rect(14, 35, 15, 40, ST4)
    c.frame(13, 34, 16, 41)
    c.rect(15, 35, 22 + reach, 36, CY2)
    c.frame(14, 34, 23 + reach, 37)
    c.rect(22 + reach, 37, 23 + reach, 39, CY3)
    c.frame(21 + reach, 37, 24 + reach, 40)
    if f == 2:
        c.dot(34, 39, GD3)
        c.dot(33, 41, GD2)

    # Mor yan kolonlar ve üst başlık
    for x0 in (1, 55):
        c.box(x0, 1, x0 + 7, 47, PU2, PU3, PU1)
        c.box(x0 + 2, 4, x0 + 5, 9, CY3 if f % 2 == 0 else CY2, None, None)
    c.box(8, 1, 55, 7, PU1, PU2, ST0)

    # Ekran
    c.box(13, 10, 50, 30, ST1, ST2, ST0)
    c.rect(15, 12, 48, 28, CY1)
    c.frame(14, 11, 49, 29)
    bars = ((20, 12), (26, 18), (14, 24), (22, 10))[f]
    c.rect(18, 16, 18 + bars[0], 18, CY2)
    c.rect(18, 16, 18 + bars[0], 16, CY3)
    c.rect(18, 22, 18 + bars[1], 24, RD2)
    c.dot(45, 14, GR2 if f > 0 else ST1)


# ---------------------------------------------------------------------------
# 6. RAFİNERİ (2x2): iki tank + kehribar boru hattı + kabarcıklı seviye camları
# ---------------------------------------------------------------------------

def tank(c: Canvas, x0: int, y0: int, x1: int, y1: int) -> None:
    """Dikey silindir tank: sol açık, sağ koyu; üstü kubbeli."""
    c.rect(x0, y0 + 2, x1, y1, ST4)
    c.rect(x0 + 1, y0 + 2, x0 + 2, y1, ST5)
    c.rect(x1 - 3, y0 + 2, x1 - 1, y1, ST3)
    c.rect(x0 + 2, y0, x1 - 2, y0 + 1, ST4)
    c.rect(x0 + 2, y0, x1 - 2, y0, ST5)
    # Kontur
    c.rect(x0 + 2, y0 - 1, x1 - 2, y0 - 1, OUT)
    c.dot(x0 + 1, y0, OUT)
    c.dot(x1 - 1, y0, OUT)
    c.dot(x0, y0 + 1, OUT)
    c.dot(x1, y0 + 1, OUT)
    c.rect(x0 - 1, y0 + 2, x0 - 1, y1, OUT)
    c.rect(x1 + 1, y0 + 2, x1 + 1, y1, OUT)
    c.rect(x0 - 1, y1 + 1, x1 + 1, y1 + 1, OUT)


def level_glass(c: Canvas, x0: int, y0: int, x1: int, y1: int, liquid, light, f: int, seed: int) -> None:
    c.rect(x0, y0, x1, y1, ST0)
    surface = y0 + 4 + (f % 2 if f > 0 else 0)
    c.rect(x0, surface, x1, y1, liquid)
    c.rect(x0, surface, x1, surface, light)
    if f > 0:                                          # yükselen kabarcıklar
        span = y1 - surface - 2
        for i in range(2):
            bx = x0 + 1 + ((seed + i * 3) % max(1, x1 - x0 - 1))
            by = y1 - 1 - ((f * 4 + i * 5 + seed) % max(1, span))
            c.dot(bx, by, light)
    c.frame(x0 - 1, y0 - 1, x1 + 1, y1 + 1)


def draw_refinery(c: Canvas, f: int) -> None:
    # Kızak taban
    c.box(1, 54, 62, 62, ST1, ST2, ST0)
    c.hazard(4, 57, 59, 59)
    c.frame(3, 56, 60, 60)

    # Damıtma kolonu (ortada, ince)
    c.box(28, 14, 33, 54, ST3, ST4, ST2)
    for y in range(18, 52, 5):
        c.rect(29, y, 32, y, ST1)

    # Tanklar
    tank(c, 5, 6, 23, 53)
    for y in (15, 45):
        c.rect(5, y, 23, y, ST2)
    level_glass(c, 11, 20, 17, 40, GR2, GR3, f, 1)

    tank(c, 38, 22, 58, 53)
    c.rect(38, 28, 58, 28, ST2)
    level_glass(c, 45, 32, 51, 48, CY2, CY3, f, 2)

    # Kehribar boru hattı: sol tank -> kolon -> sağ tank
    c.rect(24, 9, 48, 11, AM2)
    c.rect(24, 9, 48, 9, AM3)
    c.rect(24, 11, 48, 11, AM1)
    c.frame(23, 8, 49, 12)
    c.rect(45, 12, 47, 21, AM2)
    c.rect(45, 12, 45, 21, AM3)
    c.rect(44, 12, 44, 21, OUT)
    c.rect(48, 12, 48, 21, OUT)
    c.rect(45, 12, 47, 12, AM2)

    # Vana çarkı (çalışırken döner)
    c.disc(35.5, 10, 3.2, RD2)
    c.ring(35.5, 10, 3.2)
    if f % 2 == 0:
        c.rect(35, 8, 36, 12, RD1)
        c.rect(33, 10, 38, 10, RD1)
    else:
        for d in range(-2, 3):
            c.dot(35 + d, 10 + d, RD1)
            c.dot(36 - d, 10 + d, RD1)
    c.dot(35, 10, ST5)

    # Sağ tankta basınç göstergesi
    c.disc(41.5, 37.5, 2.4, ST5)
    c.ring(41.5, 37.5, 2.4)
    c.dot(41, 37, RD2)
    c.dot(42 if f in (1, 2) else 40, 36, RD2)


# ---------------------------------------------------------------------------
# Port okları (14x14, doğuya bakar; kodda döndürülür)
# ---------------------------------------------------------------------------

def port_arrow(body: tuple, light: tuple, dark: tuple) -> Image.Image:
    size = 14
    inside = set()
    for y in range(size):
        for x in range(size):
            shaft = 2 <= x <= 6 and 5 <= y <= 8
            head = 6 <= x <= 11 and abs(y - 6.5) <= (11.5 - x)
            if shaft or head:
                inside.add((x, y))

    img = Image.new("RGBA", (size, size), CLEAR)
    px = img.load()
    for (x, y) in inside:
        px[x, y] = body
        if (x, y - 1) not in inside:
            px[x, y] = light
        elif (x, y + 1) not in inside:
            px[x, y] = dark
    for (x, y) in inside:                              # 1px dış kontur
        for dx in (-1, 0, 1):
            for dy in (-1, 0, 1):
                nx, ny = x + dx, y + dy
                if (nx, ny) not in inside and 0 <= nx < size and 0 <= ny < size:
                    px[nx, ny] = OUT
    return img


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    outputs = {
        "crusher.png": sheet(TILE, TILE, draw_crusher),
        "cutter.png": sheet(TILE, TILE, draw_cutter),
        "press.png": sheet(TILE, TILE * 2, draw_press),
        "press_rot.png": sheet(TILE * 2, TILE, draw_press_rot),
        "smelter.png": sheet(TILE * 2, TILE, draw_smelter),
        "smelter_rot.png": sheet(TILE, TILE * 2, draw_smelter_rot),
        "assembler.png": sheet(TILE * 2, TILE * 2, draw_assembler),
        "refinery.png": sheet(TILE * 2, TILE * 2, draw_refinery),
        "port_in.png": port_arrow(GR2, GR3, GR1),
        "port_out.png": port_arrow(AM2, AM3, AM1),
    }
    for name, image in outputs.items():
        image.save(OUT_DIR / name)
    print(f"{len(outputs)} dosya yazıldı: {OUT_DIR}")


if __name__ == "__main__":
    main()
