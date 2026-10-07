#!/usr/bin/env python3
"""Roket modüllerinin Sv.4–10 görünümlerini üretir (public/assets/rocket_<parça>_<sv>.png).

Çalıştırma:  python3 tools/generate_rocket_tiers.py   (Pillow gerekir)

Sv.1–3 elle çizilmiş dokulardır. Üst seviyeler Sv.3 dokusunun biçimini korur ve her
seviyeye kendi renk şemasını verir; böylece her yükseltme rokette görünür (kademeler:
Mk II = Sv.4–6 çelik/altın, Mk III = Sv.7–9 mor/yeşil, Mk IV = Sv.10 beyaz/mor).
Renkler src/ui/theme.ts paletinin tonlarıdır.
"""

from pathlib import Path
from PIL import Image

ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets"
PARTS = ("hull", "engine", "wings", "tank")


def rgb(hex_value: int) -> tuple:
    return ((hex_value >> 16) & 255, (hex_value >> 8) & 255, hex_value & 255)


# Sv.3 dokusundaki renk rolleri
SOURCE = {
    "body": [rgb(0x1F1F2E), rgb(0x1E272E)],
    "body_dark": [rgb(0x12121C)],
    "glow": [rgb(0x00F0FF)],
    "glow_dark": [rgb(0x0099AA)],
    "stripe": [rgb(0xFF007F)],
}

# seviye: (gövde, gövde koyu, parıltı, parıltı koyu, şerit)
TIERS = {
    4: (0xDDE4F0, 0xA4B0C8, 0xFFD166, 0xC98F1A, 0xF4A261),
    5: (0xDDE4F0, 0xA4B0C8, 0x00D2D3, 0x01898A, 0xFFD166),
    6: (0xFFD166, 0xC98F1A, 0xF5F6FA, 0xA4B0C8, 0xE74C3C),
    7: (0x4A379C, 0x2F2466, 0x2ECC71, 0x1E8449, 0x00D2D3),
    8: (0x4A379C, 0x2F2466, 0xFFD166, 0xC98F1A, 0x2ECC71),
    9: (0x1E8449, 0x14592F, 0xFFF0C2, 0xFFD166, 0x7D5FE0),
    10: (0xF5F6FA, 0xA4B0C8, 0x7D5FE0, 0x4A379C, 0xFFD166),
}
ROLES = ("body", "body_dark", "glow", "glow_dark", "stripe")


def recolor(source: Image.Image, palette: tuple) -> Image.Image:
    mapping = {}
    for role, target in zip(ROLES, palette):
        for color in SOURCE[role]:
            mapping[color] = rgb(target)

    out = source.copy()
    px = out.load()
    for y in range(out.height):
        for x in range(out.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            target = mapping.get((r, g, b))
            if target:
                px[x, y] = (*target, a)
    return out


def main() -> None:
    count = 0
    for part in PARTS:
        source = Image.open(ASSETS / f"rocket_{part}_3.png").convert("RGBA")
        for level, palette in TIERS.items():
            recolor(source, palette).save(ASSETS / f"rocket_{part}_{level}.png")
            count += 1
    print(f"{count} dosya yazıldı: {ASSETS}")


if __name__ == "__main__":
    main()
