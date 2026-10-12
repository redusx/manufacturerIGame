#!/usr/bin/env python3
"""Elle çizilmiş arayüz ikonlarını oyunun 16 renkli paletine çeker.

Çalıştırma:  python3 tools/recolor_ui_icons.py   (Pillow gerekir)

`public/assets/icon_*.png` ve HUD'daki sikke (pixelart/coins/spr_coin_ama.png) betikle
üretilmez; eski temanın renklerini taşırlar. Bu betik her pikseli renk ailesine (sıcak,
yeşil, mavi, mor, gri) ayırır ve o ailenin paletteki en yakın parlaklıktaki tonuna
çevirir. Kırmızılar mor ailesine gider (palette kırmızı yok; tehlike rengi mordur).

Zaten palet renginde olan pikseller olduğu gibi kalır; betik tekrar çalıştırılabilir.
"""

import colorsys
from pathlib import Path
from PIL import Image

from palette import BASE, TONE

ASSETS = Path(__file__).resolve().parent.parent / "public" / "assets"
TARGETS = sorted(ASSETS.glob("icon_*.png")) + [ASSETS / "pixelart" / "coins" / "spr_coin_ama.png"]


def channels(value: int) -> tuple:
    return ((value >> 16) & 255, (value >> 8) & 255, value & 255)


def luma(color: tuple) -> float:
    return (0.299 * color[0] + 0.587 * color[1] + 0.114 * color[2]) / 255


B, T = BASE, TONE
RAMPS = {
    "warm": [B["umber"], B["brown"], B["copper"], B["sand"], T["cream_light"], B["white"]],
    "green": [B["olive"], B["green"], B["mint"], B["white"]],
    "blue": [B["navy"], B["teal"], B["blue"], B["sky"], B["white"]],
    "purple": [B["plum"], B["purple"], B["pink"], B["white"]],
    "grey": [B["umber"], B["plum"], T["steel"], T["steel_light"], B["white"]],
}
KNOWN = {channels(v) for v in list(B.values()) + list(T.values())}
# Dosyaya özel aile tonları: kapatma çarpısı koyu mor düğmenin üstünde durur, açık olmalı
FILE_RAMPS = {"icon_close.png": {"purple": [B["pink"], B["white"]]}}


def family(r: int, g: int, b: int) -> str:
    h, s, _ = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if s < 0.16:
        return "grey"
    hue = h * 360
    if hue < 9 or hue >= 335:
        return "purple"          # kırmızı -> mor ailesi
    if hue < 75:
        return "warm"
    if hue < 165:
        return "green"
    if hue < 255:
        return "blue"
    return "purple"


def remap(r: int, g: int, b: int, overrides: dict) -> tuple:
    if (r, g, b) in KNOWN:
        return (r, g, b)
    _, s, v = colorsys.rgb_to_hsv(r / 255, g / 255, b / 255)
    if v < 0.17 or (s < 0.45 and luma((r, g, b)) < 0.13):
        return channels(B["umber"])      # kontur
    target = luma((r, g, b))
    name = family(r, g, b)
    ramp = overrides.get(name, RAMPS[name])
    if name != "grey" and s > 0.4 and name not in overrides:
        # Doygun renk ailesinin kendi tonunda kalır; beyaza ve kreme yalnızca soluk pikseller gider
        ramp = [value for value in ramp if value not in (B["white"], T["cream_light"])]
    return channels(min(ramp, key=lambda value: abs(luma(channels(value)) - target)))


def recolor(path: Path) -> int:
    img = Image.open(path).convert("RGBA")
    px = img.load()
    overrides = FILE_RAMPS.get(path.name, {})
    changed = 0
    for y in range(img.height):
        for x in range(img.width):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            nr, ng, nb = remap(r, g, b, overrides)
            if (nr, ng, nb) != (r, g, b):
                px[x, y] = (nr, ng, nb, a)
                changed += 1
    if changed:
        img.save(path)
    return changed


def main() -> None:
    for path in TARGETS:
        print(f"{path.name}: {recolor(path)} piksel")


if __name__ == "__main__":
    main()
