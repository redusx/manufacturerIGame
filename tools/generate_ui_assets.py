#!/usr/bin/env python3
"""UI 2.0 piksel-sanat dokularını üretir (public/assets/ui/).

Çalıştırma:  python3 tools/generate_ui_assets.py   (Pillow gerekir)

Tüm dokular raster PNG'dir ve docs/ART_DIRECTION.md kurallarına uyar: 1px koyu kontur,
üstte açık vurgu, altta koyu gölge, palet renkleri (src/ui/theme.ts ile aynı).
Düğmeler renkli basılır; ikonlar ve çerçeveler beyazdır ve kodda `setTint` ile boyanır.
"""

from pathlib import Path
from PIL import Image

OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "ui"

OUTLINE = (7, 9, 19, 255)
CLEAR = (0, 0, 0, 0)


def rgb(hex_value: int) -> tuple:
    return ((hex_value >> 16) & 255, (hex_value >> 8) & 255, hex_value & 255, 255)


def mix(a: tuple, b: tuple, t: float) -> tuple:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


WHITE = rgb(0xFFFFFF)
BLACK = rgb(0x000000)

# ---------------------------------------------------------------------------
# Düğmeler: 24x24, 9-slice kenarları sol/sağ 4, üst 4, alt 6 (alttaki "dudak" dahil)
# ---------------------------------------------------------------------------

BUTTON_SIZE = 24

# varyant: (gövde, üst vurgu, alt dudak)
BUTTON_VARIANTS = {
    "primary": (0x2ECC71, 0x82E0AA, 0x1E8449),
    "secondary": (0x4F649C, 0x8194C8, 0x2F3D66),
    "rocket": (0x00D2D3, 0xA6F4F4, 0x01898A),
    "factory": (0xF4A261, 0xFFD9B0, 0xC0621A),
    "gold": (0xFFD166, 0xFFF0C2, 0xC98F1A),
    "danger": (0xE74C3C, 0xF29488, 0xA5281B),
    "disabled": (0x22293E, 0x3D4E7A, 0x141A2E),
}


def button(body: tuple, highlight: tuple, lip: tuple, pressed: bool) -> Image.Image:
    size = BUTTON_SIZE
    img = Image.new("RGBA", (size, size), CLEAR)
    px = img.load()

    top = 2 if pressed else 0            # basılıyken gövde 2px aşağı iner
    lip_rows = 1 if pressed else 3       # ve alttaki dudak incelir
    bottom = size - 1

    for y in range(top, size):
        ry = y - top                      # üst kenara göre satır
        rb = bottom - y                   # alt kenara göre satır
        # 2px basamaklı piksel köşe
        inset = 0
        if ry == 0 or rb == 0:
            inset = 2
        elif ry == 1 or rb == 1:
            inset = 1
        for x in range(inset, size - inset):
            edge = x == inset or x == size - 1 - inset or ry == 0 or rb == 0
            if edge:
                px[x, y] = OUTLINE
            elif rb <= lip_rows:
                px[x, y] = lip
            elif ry <= 2:
                px[x, y] = highlight if ry == 1 else mix(highlight, body, 0.5)
            else:
                px[x, y] = body
    return img


def make_buttons() -> None:
    for name, (body_hex, hi_hex, lip_hex) in BUTTON_VARIANTS.items():
        body, hi, lip = rgb(body_hex), rgb(hi_hex), rgb(lip_hex)
        button(body, hi, lip, False).save(OUT / f"btn_{name}_normal.png")
        if name == "disabled":
            continue
        button(mix(body, WHITE, 0.22), mix(hi, WHITE, 0.4), lip, False).save(OUT / f"btn_{name}_hover.png")
        button(mix(body, BLACK, 0.12), mix(body, BLACK, 0.05), lip, True).save(OUT / f"btn_{name}_pressed.png")


# ---------------------------------------------------------------------------
# Çerçeveler, şeritler, küçük parçalar
# ---------------------------------------------------------------------------

def frame(size: int, thickness: int) -> Image.Image:
    """Ortası boş beyaz çerçeve (odak halkası / seçili durum); tint ile boyanır."""
    img = Image.new("RGBA", (size, size), CLEAR)
    px = img.load()
    for y in range(size):
        for x in range(size):
            d = min(x, y, size - 1 - x, size - 1 - y)
            corner = (x in (0, size - 1)) and (y in (0, size - 1))
            if d < thickness and not corner:
                px[x, y] = WHITE
    return img


def chip() -> Image.Image:
    """Koyu dolgulu, beyaz konturlu rozet; tint konturu boyar, dolgu koyu kalır."""
    size = 16
    img = Image.new("RGBA", (size, size), CLEAR)
    px = img.load()
    fill = (40, 48, 72, 255)
    for y in range(size):
        for x in range(size):
            d = min(x, y, size - 1 - x, size - 1 - y)
            corner = (x in (0, size - 1)) and (y in (0, size - 1))
            if corner:
                continue
            px[x, y] = WHITE if d == 0 else fill
    return img


def header() -> Image.Image:
    """Pencere başlık şeridi (beyaz şablon, tint ile ekran rengine boyanır)."""
    w, h = 16, 16
    img = Image.new("RGBA", (w, h), CLEAR)
    px = img.load()
    for y in range(h):
        for x in range(w):
            corner = y in (0,) and x in (0, w - 1)
            if corner:
                continue
            if y == 0 or x == 0 or x == w - 1:
                px[x, y] = (255, 255, 255, 255)
            elif y == h - 1:
                px[x, y] = (120, 120, 120, 255)
            elif y == h - 2:
                px[x, y] = (170, 170, 170, 255)
            elif y == 1:
                px[x, y] = (255, 255, 255, 255)
            else:
                px[x, y] = (222, 222, 222, 255)
    return img


def solid(w: int, h: int, color: tuple) -> Image.Image:
    return Image.new("RGBA", (w, h), color)


def scroll_thumb() -> Image.Image:
    w, h = 6, 12
    img = Image.new("RGBA", (w, h), WHITE)
    px = img.load()
    for x, y in ((0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1)):
        px[x, y] = CLEAR
    return img


def pip() -> Image.Image:
    size = 8
    img = Image.new("RGBA", (size, size), CLEAR)
    px = img.load()
    for y in range(size):
        for x in range(size):
            d = min(x, y, size - 1 - x, size - 1 - y)
            corner = (x in (0, size - 1)) and (y in (0, size - 1))
            if corner:
                continue
            if d == 0:
                px[x, y] = OUTLINE
            elif y == 1:
                px[x, y] = WHITE
            else:
                px[x, y] = (214, 214, 214, 255)
    return img


# ---------------------------------------------------------------------------
# İkonlar: 16x16 ASCII ızgara. '.' saydam, 'o' kontur, diğerleri palet rengi.
# Tek renkli ikonlar beyaz ('w') çizilir ve kodda tint ile boyanır.
# ---------------------------------------------------------------------------

ICON_COLORS = {
    ".": CLEAR,
    "o": OUTLINE,
    "w": rgb(0xFFFFFF),
    "g": rgb(0xC8D0E0),
    "d": rgb(0x7F8BA6),
    "a": rgb(0xF4A261),
    "A": rgb(0xC0621A),
    "y": rgb(0xFFD166),
    "c": rgb(0x00D2D3),
    "r": rgb(0xE74C3C),
}

BLANK = "................"

ICONS = {
    "lock": [
        BLANK,
        ".....oooooo.....",
        "....owwwwwwo....",
        "...owwoooowwo...",
        "...owo....owo...",
        "...owo....owo...",
        "..oooooooooooo..",
        "..owwwwwwwwwwo..",
        "..owwwwoowwwwo..",
        "..owwwwoowwwwo..",
        "..owwwwoowwwwo..",
        "..owwwwwwwwwwo..",
        "..oggggggggggo..",
        "..oooooooooooo..",
        BLANK,
        BLANK,
    ],
    "trash": [
        BLANK,
        "......oooo......",
        "...oooowwoooo...",
        "..owwwwwwwwwwo..",
        "..oooooooooooo..",
        "...owwwwwwwwo...",
        "...owdwwdwwdo...",
        "...owdwwdwwdo...",
        "...owdwwdwwdo...",
        "...owdwwdwwdo...",
        "...owdwwdwwdo...",
        "...owdwwdwwdo...",
        "...owwwwwwwwo...",
        "....oooooooo....",
        BLANK,
        BLANK,
    ],
    "belt": [
        BLANK,
        BLANK,
        "...oooo..oooo...",
        "...oaao..occo...",
        "...oaao..occo...",
        "...oooo..oooo...",
        ".oooooooooooooo.",
        "oggggggggggggggo",
        "ogdogdogdogdogdo",
        "oggggggggggggggo",
        ".oooooooooooooo.",
        "..od........do..",
        "..od........do..",
        "..oo........oo..",
        BLANK,
        BLANK,
    ],
    "rotate": [
        BLANK,
        ".....ooooo......",
        "...oowwwwwoo....",
        "..owwooooowwo.o.",
        ".owwo.....owwowo",
        ".owo.......owwwo",
        "owwo......owwwwo",
        "owo.......oooooo",
        "owo.............",
        "owwo.......ooo..",
        ".owo......owwo..",
        ".owwo....owwo...",
        "..owwooooowwo...",
        "...oowwwwwoo....",
        ".....ooooo......",
        BLANK,
    ],
    "sound_on": [
        BLANK,
        BLANK,
        ".......oo.......",
        "......owo...w...",
        ".....owwo....w..",
        ".oooowwwo.w..w..",
        ".owwwwwwo..w.w..",
        ".owwwwwwo..w.w..",
        ".owwwwwwo..w.w..",
        ".oooowwwo.w..w..",
        ".....owwo....w..",
        "......owo...w...",
        ".......oo.......",
        BLANK,
        BLANK,
        BLANK,
    ],
    "sound_off": [
        BLANK,
        BLANK,
        ".......oo.......",
        "......owo.......",
        ".....owwo.......",
        ".oooowwwo.r...r.",
        ".owwwwwwo..r.r..",
        ".owwwwwwo...r...",
        ".owwwwwwo..r.r..",
        ".oooowwwo.r...r.",
        ".....owwo.......",
        "......owo.......",
        ".......oo.......",
        BLANK,
        BLANK,
        BLANK,
    ],
    "fullscreen": [
        BLANK,
        ".oooooo..oooooo.",
        ".owwwwo..owwwwo.",
        ".owoooo..oooowo.",
        ".owo........owo.",
        ".owo........owo.",
        ".ooo........ooo.",
        BLANK,
        BLANK,
        ".ooo........ooo.",
        ".owo........owo.",
        ".owo........owo.",
        ".owoooo..oooowo.",
        ".owwwwo..owwwwo.",
        ".oooooo..oooooo.",
        BLANK,
    ],
    "textsize": [
        BLANK,
        BLANK,
        "....oooo........",
        "...owwwwo.......",
        "...owoowo.......",
        "..owwoowwo......",
        "..owo..owo......",
        "..owoooowo.oooo.",
        ".owwwwwwwwoowwo.",
        ".owwoooowwowoowo",
        ".owo....owowwwwo",
        ".owo....owowoowo",
        ".ooo....ooooooo.",
        BLANK,
        BLANK,
        BLANK,
    ],
    "info": [
        BLANK,
        ".....oooooo.....",
        "...oowwwwwwoo...",
        "..owwwwwwwwwwo..",
        ".owwwwwoowwwwwo.",
        ".owwwwwwwwwwwwo.",
        "owwwwwwoowwwwwwo",
        "owwwwwwoowwwwwwo",
        "owwwwwwoowwwwwwo",
        "owwwwwwoowwwwwwo",
        ".owwwwwoowwwwwo.",
        ".owwwwwwwwwwwwo.",
        "..owwwwwwwwwwo..",
        "...oowwwwwwoo...",
        ".....oooooo.....",
        BLANK,
    ],
    "clock": [
        BLANK,
        ".....oooooo.....",
        "...oowwwwwwoo...",
        "..owwwwoowwwwo..",
        ".owwwwwoowwwwwo.",
        ".owwwwwoowwwwwo.",
        "owwwwwwoowwwwwwo",
        "owwwwwwooooowwwo",
        "owwwwwwwwwwwwwwo",
        "owwwwwwwwwwwwwwo",
        ".owwwwwwwwwwwwo.",
        ".owwwwwwwwwwwwo.",
        "..owwwwwwwwwwo..",
        "...oowwwwwwoo...",
        ".....oooooo.....",
        BLANK,
    ],
    "arrow_right": [
        BLANK,
        BLANK,
        BLANK,
        BLANK,
        "........oo......",
        "........owo.....",
        ".oooooooowwo....",
        ".owwwwwwwwwwo...",
        ".owwwwwwwwwwo...",
        ".oooooooowwo....",
        "........owo.....",
        "........oo......",
        BLANK,
        BLANK,
        BLANK,
        BLANK,
    ],
    "warning": [
        BLANK,
        ".......oo.......",
        "......owwo......",
        "......owwo......",
        ".....owwwwo.....",
        ".....owoowo.....",
        "....owwoowwo....",
        "....owwoowwo....",
        "...owwwoowwwo...",
        "...owwwoowwwo...",
        "..owwwwwwwwwwo..",
        "..owwwwoowwwwo..",
        ".owwwwwoowwwwwo.",
        ".owwwwwwwwwwwwo.",
        ".oooooooooooooo.",
        BLANK,
    ],
    "plus": [
        BLANK,
        BLANK,
        BLANK,
        "......oooo......",
        "......owwo......",
        "......owwo......",
        "...oooowwoooo...",
        "...owwwwwwwwo...",
        "...owwwwwwwwo...",
        "...oooowwoooo...",
        "......owwo......",
        "......owwo......",
        "......oooo......",
        BLANK,
        BLANK,
        BLANK,
    ],
    "up": [
        BLANK,
        ".......oo.......",
        "......owwo......",
        ".....owwwwo.....",
        "....owwwwwwo....",
        "...owwwwwwwwo...",
        "..owwwwwwwwwwo..",
        "..oooowwwwoooo..",
        ".....owwwwo.....",
        ".....owwwwo.....",
        ".....owwwwo.....",
        ".....owwwwo.....",
        ".....owwwwo.....",
        ".....oooooo.....",
        BLANK,
        BLANK,
    ],
    "chevron_down": [
        BLANK,
        BLANK,
        BLANK,
        BLANK,
        "..oo........oo..",
        ".owwo......owwo.",
        "..owwo....owwo..",
        "...owwo..owwo...",
        "....owwoowwo....",
        ".....owwwwo.....",
        "......owwo......",
        ".......oo.......",
        BLANK,
        BLANK,
        BLANK,
        BLANK,
    ],
    "star": [
        BLANK,
        ".......oo.......",
        "......owwo......",
        "......owwo......",
        ".....owwwwo.....",
        "oooooowwwwoooooo",
        "owwwwwwwwwwwwwwo",
        ".owwwwwwwwwwwwo.",
        "..owwwwwwwwwwo..",
        "...owwwwwwwwo...",
        "...owwwwwwwwo...",
        "..owwwwoowwwwo..",
        "..owwwo..owwwo..",
        ".owwoo....oowwo.",
        ".ooo........ooo.",
        BLANK,
    ],
    "crate": [
        BLANK,
        BLANK,
        ".oooooooooooooo.",
        ".oaaaaaaaaaaaao.",
        ".oaAAAAAAAAAAao.",
        ".oaAooAAAAooAao.",
        ".oaAAooAAooAAao.",
        ".oaAAAooooAAAao.",
        ".oaAAAooooAAAao.",
        ".oaAAooAAooAAao.",
        ".oaAooAAAAooAao.",
        ".oaAAAAAAAAAAao.",
        ".oaaaaaaaaaaaao.",
        ".oooooooooooooo.",
        BLANK,
        BLANK,
    ],
    "intake": [
        BLANK,
        "oooooooooooooooo",
        "oggggggggggggggo",
        "oddddddddddddddo",
        ".oggggggggggggo.",
        "..oggggggggggo..",
        "...oggggggggo...",
        "....oggggggo....",
        ".....oggggo.....",
        ".....oddddo.....",
        ".....oooooo.....",
        ".....oyyyyo.....",
        "......oyyo......",
        ".......oo.......",
        BLANK,
        BLANK,
    ],
    "drop": [
        BLANK,
        ".......oo.......",
        "......owwo......",
        "......owwo......",
        ".....owwwwo.....",
        ".....owwwwo.....",
        "....owwwwwwo....",
        "...owwwwwwwwo...",
        "...owgwwwwwwo...",
        "..owgwwwwwwwwo..",
        "..owgwwwwwwwwo..",
        "..owwwwwwwwwwo..",
        "...owwwwwwwwo...",
        "....owwwwwwo....",
        ".....oooooo.....",
        BLANK,
    ],
    "hand": [
        BLANK,
        "......oo........",
        ".....owwo.......",
        ".....owwo.......",
        ".....owwo.......",
        ".....owwooo.....",
        ".....owwowwooo..",
        ".oo..owwowwowwo.",
        "owwo.owwwwwwwwwo",
        "owwwoowwwwwwwwwo",
        ".owwwwwwwwwwwwwo",
        "..owwwwwwwwwwwwo",
        "..owwwwwwwwwwwo.",
        "...owwwwwwwwwo..",
        "....ooooooooo...",
        BLANK,
    ],
    "expand": [
        BLANK,
        ".oooooo.........",
        ".owwwwo.........",
        ".owwoo..........",
        ".owowo..........",
        ".owo.owo........",
        ".ooo..owo.......",
        ".......owo......",
        "........owo.....",
        ".........owo.ooo",
        "..........owowo.",
        "...........oowwo",
        "..........owwwwo",
        "..........oooooo",
        BLANK,
        BLANK,
    ],
    "wrench": [
        BLANK,
        "..........oooo..",
        ".........owwo...",
        "........owwo..o.",
        "........owwo.owo",
        "........owwwowwo",
        ".......owwwwwwo.",
        "......owwwwwwo..",
        ".....owwwooo....",
        "....owwwo.......",
        "...owwwo........",
        "..owwwo.........",
        ".owwwo..........",
        ".owwo...........",
        "..oo............",
        BLANK,
    ],
}


def make_icons() -> None:
    for name, rows in ICONS.items():
        assert len(rows) == 16, f"{name}: {len(rows)} satır"
        img = Image.new("RGBA", (16, 16), CLEAR)
        px = img.load()
        for y, row in enumerate(rows):
            assert len(row) == 16, f"{name} satır {y}: {len(row)} sütun"
            for x, ch in enumerate(row):
                px[x, y] = ICON_COLORS[ch]
        img.save(OUT / f"icon_{name}.png")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    make_buttons()
    make_icons()
    frame(16, 2).save(OUT / "frame.png")
    frame(16, 1).save(OUT / "frame_thin.png")
    chip().save(OUT / "chip.png")
    header().save(OUT / "header.png")
    solid(4, 4, WHITE).save(OUT / "px.png")
    scroll_thumb().save(OUT / "scroll_thumb.png")
    pip().save(OUT / "pip.png")
    print(f"{len(list(OUT.glob('*.png')))} doku yazıldı -> {OUT}")


if __name__ == "__main__":
    main()
