#!/usr/bin/env python3
"""Fırlatma rampasının seviye çizimlerini üretir (public/assets/launch_pads/).

Çalıştırma:  python3 tools/generate_launch_pad.py   (Pillow gerekir)

Rampanın 10 seviyesi vardır ve her seviye görünüşe yansır: önce sarı şantiye kulesi,
sonra yakıt tankı ve projektör, çelik gövde, ikinci destek kulesi, anten, enerji
rayları, plazma bobinleri ve en sonda altın kaplamalı kule. Her çizim 48x48 pikseldir;
kule solda, kol üstte, ikaz şeritli taban alttadır (roket kolun altında durur).

Kurallar docs/ART_DIRECTION.md ile aynıdır: 1px koyu kontur, sol-üstten ışık, düz renkler.
"""

from pathlib import Path
from PIL import Image

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "launch_pads"
SIZE = 48
LEVELS = 10


def rgb(hex_value: int) -> tuple:
    return ((hex_value >> 16) & 255, (hex_value >> 8) & 255, hex_value & 255, 255)


CLEAR = (0, 0, 0, 0)
OUT = rgb(0x0C1020)
WHITE = rgb(0xFFFFFF)

ST0, ST1, ST2 = rgb(0x121829), rgb(0x242F4C), rgb(0x3D4E7A)
ST3, ST4, ST5 = rgb(0x66779B), rgb(0xA4B0C8), rgb(0xDDE4F0)
GD1, GD2, GD3 = rgb(0xC98F1A), rgb(0xFFD166), rgb(0xFFF0C2)
AM1, AM2 = rgb(0xC0621A), rgb(0xF4A261)
RD2 = rgb(0xE74C3C)
CY1, CY2, CY3 = rgb(0x01898A), rgb(0x00D2D3), rgb(0xA6F4F4)
PU1, PU2, PU3 = rgb(0x4A379C), rgb(0x7D5FE0), rgb(0xB7A4F5)
GR2 = rgb(0x2ECC71)

# Kule gövdesinin renk şeması: (koyu, orta, açık)
SCHEMES = {
    "yellow": (GD1, GD2, GD3),
    "steel": (ST2, ST4, ST5),
    "cyan": (CY1, CY2, CY3),
    "purple": (PU1, PU2, PU3),
    "gold": (GD2, GD3, WHITE),
}


class Canvas:
    def __init__(self):
        self.img = Image.new("RGBA", (SIZE, SIZE), CLEAR)
        self.px = self.img.load()

    def dot(self, x: int, y: int, color: tuple) -> None:
        if 0 <= x < SIZE and 0 <= y < SIZE:
            self.px[x, y] = color

    def rect(self, x0: int, y0: int, x1: int, y1: int, color: tuple) -> None:
        for y in range(y0, y1 + 1):
            for x in range(x0, x1 + 1):
                self.dot(x, y, color)

    def box(self, x0: int, y0: int, x1: int, y1: int, fill: tuple, light: tuple = None, dark: tuple = None) -> None:
        """Konturlu kutu: üst/sol kenarı açık, alt/sağ kenarı koyu."""
        self.rect(x0, y0, x1, y1, OUT)
        self.rect(x0 + 1, y0 + 1, x1 - 1, y1 - 1, fill)
        if light:
            self.rect(x0 + 1, y0 + 1, x1 - 1, y0 + 1, light)
        if dark and y1 - y0 > 3:
            self.rect(x0 + 1, y1 - 1, x1 - 1, y1 - 1, dark)

    def outline(self) -> None:
        """Dolu piksellerin çevresine 1px koyu kontur ekler."""
        solid = [[self.px[x, y][3] > 0 for x in range(SIZE)] for y in range(SIZE)]
        for y in range(SIZE):
            for x in range(SIZE):
                if solid[y][x]:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < SIZE and 0 <= ny < SIZE and solid[ny][nx]:
                        self.px[x, y] = OUT
                        break


def lattice(c: Canvas, x0: int, y_top: int, y_bottom: int, scheme: str, plated: bool) -> None:
    """Kafes kule: iki dikme ve aralarında çapraz bağlar (10 piksel genişlik)."""
    dark, mid, light = SCHEMES[scheme]
    x1 = x0 + 9
    for y in range(y_top, y_bottom + 1):
        c.dot(x0, y, light)
        c.dot(x0 + 1, y, mid)
        c.dot(x1 - 1, y, mid)
        c.dot(x1, y, dark)
    # Çapraz bağlar: her 8 pikselde bir X
    y = y_top
    while y + 7 <= y_bottom:
        for step in range(6):
            c.dot(x0 + 2 + step, y + 1 + step, mid)
            c.dot(x1 - 2 - step, y + 1 + step, dark)
        c.rect(x0, y, x1, y, mid)
        y += 8
    c.rect(x0, y_bottom, x1, y_bottom, mid)
    if plated:
        # Güçlendirilmiş kule: bağların arası sac levhayla kapanır
        for y in range(y_top + 2, y_bottom - 1):
            if (y - y_top) % 8 in (3, 4, 5):
                c.rect(x0 + 2, y, x1 - 2, y, dark)


def base(c: Canvas, level: int) -> None:
    """Taban: çelik kaide ve ikaz şeridi; üst seviyelerde kaide kalınlaşır."""
    top = 38 if level < 5 else 36
    c.rect(0, top, SIZE - 1, SIZE - 1, ST1)
    c.rect(0, top, SIZE - 1, top, ST3)
    c.rect(0, top + 1, SIZE - 1, top + 1, ST2)
    stripe = GD2 if level < 10 else GD3
    for x in range(SIZE):
        for row in range(4):
            y = SIZE - 6 + row
            c.dot(x, y, stripe if (x + row) // 3 % 2 == 0 else ST0)
    if level >= 2:
        # Kaide lambaları
        lamp = AM2 if level < 7 else CY2
        for x in (16, 26, 36):
            c.rect(x, top + 2, x + 1, top + 3, lamp)


def tank(c: Canvas, level: int) -> None:
    """Yakıt tankı ve kuleye giden hortum."""
    big = level >= 8
    x0, x1 = (30, 41) if big else (32, 40)
    y0 = 26 if big else 29
    y1 = (38 if level < 5 else 36) - 1
    body, light, dark = (CY2, CY3, CY1) if level < 9 else (PU2, PU3, PU1)
    c.rect(x0, y0, x1, y1, body)
    c.rect(x0, y0, x0 + 1, y1, light)
    c.rect(x1 - 1, y0, x1, y1, dark)
    c.rect(x0 + 1, y0 - 1, x1 - 1, y0 - 1, light)
    c.rect(x0, y0 + 3, x1, y0 + 3, dark)
    # Hortum
    for x in range(12, x0):
        c.dot(x, y1 - 1, ST4 if x % 2 == 0 else ST3)


def draw(level: int) -> Image.Image:
    c = Canvas()
    scheme = "yellow" if level <= 3 else "steel" if level <= 6 else "cyan" if level <= 8 else "purple" if level == 9 else "gold"
    dark, mid, light = SCHEMES[scheme]
    base_top = 38 if level < 5 else 36
    tower_top = 8 if level < 4 else 5 if level < 8 else 3

    # Ana kule (solda)
    lattice(c, 1, tower_top, base_top - 1, scheme, plated=level >= 4)

    # İkinci destek kulesi (sağda, kısa) ve aradaki köprü
    if level >= 6:
        second_top = 20 if level < 9 else 14
        lattice(c, 37, second_top, base_top - 1, scheme, plated=True)

    # Kol: kuleden sağa uzanır; seviye arttıkça uzar ve kalınlaşır
    arm_y = tower_top + 2
    arm_end = 30 if level < 4 else 36 if level < 6 else 46
    thick = 3 if level < 4 else 4
    c.rect(10, arm_y, arm_end, arm_y + thick - 1, mid)
    c.rect(10, arm_y, arm_end, arm_y, light)
    c.rect(10, arm_y + thick - 1, arm_end, arm_y + thick - 1, dark)
    if level >= 4:
        for x in range(13, arm_end, 5):
            c.dot(x, arm_y + 1, dark)

    # Askı halatı ve kıskaç
    hook_x = 28 if level < 4 else 30
    hook_end = arm_y + (14 if level < 4 else 12)
    for y in range(arm_y + thick, hook_end):
        c.dot(hook_x, y, ST4)
    if level >= 2:
        c.rect(hook_x - 2, hook_end, hook_x + 2, hook_end + 1, ST4)
        c.dot(hook_x - 2, hook_end + 2, ST4)
        c.dot(hook_x + 2, hook_end + 2, ST4)

    base(c, level)
    if level >= 3:
        tank(c, level)

    # Egzoz saptırıcı (kaidenin önünde eğik plaka)
    if level >= 5:
        for step in range(5):
            c.rect(14 + step, base_top - 1 - step, 18 + step, base_top - 1 - step, ST3 if step else ST4)

    # Kule tepesi: ikaz lambası, projektör, anten, işaret
    c.rect(4, tower_top - 2, 6, tower_top - 1, RD2)
    if level >= 5:
        c.rect(9, tower_top - 2, 12, tower_top - 1, WHITE)
        c.dot(13, tower_top - 1, GD3)
    if level >= 7:
        # Anten direği ve çanak
        for y in range(1, tower_top):
            c.dot(2, y, ST4)
        c.rect(0, 1, 4, 1, ST5)
        c.dot(2, 0, RD2)
    if level >= 8:
        # Enerji rayları: kulenin içinde parlayan hat
        glow = CY3 if level < 9 else PU3
        for y in range(tower_top + 1, base_top - 1):
            if y % 3 != 0:
                c.dot(5, y, glow)
    if level >= 9:
        # Plazma bobinleri: kulenin çevresinde halkalar
        ring = PU3 if level == 9 else CY3
        for y in range(tower_top + 6, base_top - 4, 8):
            c.rect(0, y, 11, y, ring)
            c.rect(0, y + 1, 11, y + 1, PU2 if level == 9 else CY2)
    if level >= 10:
        # İki kule arasında plazma yayı ve tepede yıldız işareti
        for x in range(12, 37):
            wave = 16 + (1 if x % 4 < 2 else 0)
            c.dot(x, wave, CY3)
            if x % 3 == 0:
                c.dot(x, wave + 1, CY2)
        c.dot(5, tower_top - 4, GD3)
        c.rect(4, tower_top - 3, 6, tower_top - 3, GD3)
        c.rect(40, 12, 44, 13, GD2)

    c.outline()
    return c.img


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for level in range(1, LEVELS + 1):
        draw(level).save(OUT_DIR / f"launch_pad_{level}.png")
    print(f"{LEVELS} rampa dokusu yazıldı -> {OUT_DIR}")


if __name__ == "__main__":
    main()
