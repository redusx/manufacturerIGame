#!/usr/bin/env python3
"""Eşya sprite'larını üretir (public/assets/items/).

Çalıştırma:  python3 tools/generate_item_assets.py   (Pillow gerekir)

Her eşyanın bantta, makine penceresinde, hangarda ve fiyat listesinde görünen 16x16
piksellik kendi çizimi vardır. Çizimler malzemenin biçimini anlatır: cevher kaya
parçasıdır, toz alçak bir yığın, külçe yamuk bir kalıp, levha perçinli düz bir sac.
Aynı biçimdeki eşyalar (demir/bakır) renkle ayrılır. Dokular kendi renkleriyle basılır;
kodda `setTint` ile boyanmaz.

Kurallar docs/ART_DIRECTION.md ile aynıdır: 1px koyu kontur, sol-üstten ışık (üst/sol
açık, alt/sağ koyu), düz renkler, src/ui/theme.ts paletiyle uyumlu tonlar.
"""

from pathlib import Path
from PIL import Image

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "items"
SIZE = 16


def rgb(hex_value: int) -> tuple:
    return ((hex_value >> 16) & 255, (hex_value >> 8) & 255, hex_value & 255, 255)


def mix(a: tuple, b: tuple, t: float) -> tuple:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


CLEAR = (0, 0, 0, 0)
OUT = rgb(0x0C1020)
WHITE = rgb(0xFFFFFF)

# Çelik tonları (koyudan açığa) — tools/generate_machine_assets.py ile aynı
ST0, ST1, ST2 = rgb(0x121829), rgb(0x242F4C), rgb(0x3D4E7A)
ST3, ST4, ST5 = rgb(0x66779B), rgb(0xA4B0C8), rgb(0xDDE4F0)

AM1, AM2, AM3 = rgb(0xC0621A), rgb(0xF4A261), rgb(0xFFD9B0)      # bakır / kehribar
GD1, GD2, GD3 = rgb(0xC98F1A), rgb(0xFFD166), rgb(0xFFF0C2)      # altın / kum
OR2 = rgb(0xF39C12)
RD1, RD2, RD3 = rgb(0xA5281B), rgb(0xE74C3C), rgb(0xF29488)
CY1, CY2, CY3 = rgb(0x01898A), rgb(0x00D2D3), rgb(0xA6F4F4)
GR1, GR2, GR3 = rgb(0x1E8449), rgb(0x2ECC71), rgb(0x82E0AA)
BL1, BL2, BL3 = rgb(0x234E96), rgb(0x3B7DDD), rgb(0x8FB8F5)
PU1, PU2, PU3 = rgb(0x4A379C), rgb(0x7D5FE0), rgb(0xB7A4F5)
BR1, BR2 = rgb(0x5A3A2A), rgb(0x8A5A3C)                           # toprak / pas

# Her eşya: (16 satırlık çizim, harf -> renk). '.' saydam, 'o' kontur.
ITEMS: dict = {}


def item(item_id: str, rows: list, colors: dict) -> None:
    assert len(rows) == SIZE, f"{item_id}: {len(rows)} satır"
    for index, row in enumerate(rows):
        assert len(row) == SIZE, f"{item_id} satır {index}: {len(row)} sütun"
    ITEMS[item_id] = (rows, {".": CLEAR, "o": OUT, **colors})


# ---------------------------------------------------------------------------
# KADEME 0 — hammaddeler
# ---------------------------------------------------------------------------

ORE_A = [
    "................",
    "................",
    ".....oooo.......",
    "....ohhhmoo.....",
    "...ohhmmmmmo....",
    "..ohhmmrmmmdo...",
    "..ohmmmmmmrdo...",
    ".ohmmrmmmmmddo..",
    ".ohmmmmmmdmddo..",
    ".ommmmrmmmdddo..",
    ".ommmdmmmrdddo..",
    "..oddmmdddddo...",
    "...odddddddo....",
    "....ooooooo.....",
    "................",
    "................",
]
# Demir cevheri: gri-mavi kaya, pas lekeli
item("iron_ore", ORE_A, {"h": ST4, "m": ST3, "d": ST2, "r": BR2})

ORE_B = [
    "................",
    "................",
    ".......oooo.....",
    ".....oomhhho....",
    "....ohmmmmhho...",
    "...ohmmmrmmhdo..",
    "...ohrmmmmmmdo..",
    "..ohhmmmmmrmmdo.",
    "..ohmmdmmmmmddo.",
    "..ommmmmrmmdddo.",
    "..omdmmmmmdddo..",
    "...odddmmdddo...",
    "....odddddoo....",
    ".....ooooo......",
    "................",
    "................",
]
# Bakır cevheri: kızıl-kahve kaya, yeşil-mavi bakır damarlı
item("copper_ore", ORE_B, {"h": AM2, "m": AM1, "d": BR1, "r": CY2})

# Silikat kumu: sivri, açık sarı kum konisi
item(
    "silica_sand",
    [
        "................",
        "................",
        "................",
        "................",
        ".......oo.......",
        "......ohho......",
        ".....ohhmmo.....",
        "....ohhmmmmo....",
        "....ohmmwmmo....",
        "...ohhmmmmmdo...",
        "..ohhmwmmmmddo..",
        "..ohmmmmmwmddo..",
        ".ohmmmmmmmmdddo.",
        ".oddddddddddddo.",
        "..oooooooooooo..",
        "................",
    ],
    {"h": GD3, "m": GD2, "d": GD1, "w": WHITE},
)

# Ham polimer: koyu mor, yoğun damla
item(
    "crude_polymer",
    [
        "................",
        ".......oo.......",
        "......ohho......",
        "......ohmo......",
        ".....ohmmo......",
        ".....ohmmmo.....",
        "....ohhmmmo.....",
        "....ohmmmmdo....",
        "...ohwmmmmmdo...",
        "...ohwmmmmmdo...",
        "...ohmmmmmmdo...",
        "...ommmmmmddo...",
        "....ommmmddo....",
        ".....oddddo.....",
        "......oooo......",
        "................",
    ],
    {"h": PU3, "m": PU2, "d": PU1, "w": WHITE},
)

# ---------------------------------------------------------------------------
# KADEME 1 — toz, külçe, cam, pelet, hurda
# ---------------------------------------------------------------------------

POWDER = [
    "................",
    "................",
    "................",
    "................",
    "................",
    "................",
    "......oooo......",
    "....oohhhmoo....",
    "...ohhmhmmmdo...",
    "..ohmhmmdmmmdo..",
    ".ohhmmmhmmdmddo.",
    ".ohmdmmmmdmmddo.",
    "ohmmmmdmmmmdmddo",
    "oddddddddddddddo",
    ".oooooooooooooo.",
    "................",
]
# Toz: alçak, geniş, benekli yığın
item("iron_powder", POWDER, {"h": ST5, "m": ST4, "d": ST3})
item("copper_powder", POWDER, {"h": AM3, "m": AM2, "d": AM1})

INGOT = [
    "................",
    "................",
    "................",
    "................",
    "....oooooooo....",
    "...ohhhhhhhho...",
    "...ohwwhhhhho...",
    "..ommmmmmmmmmo..",
    "..ommmmmmmmmdo..",
    ".ommmmmmmmmmddo.",
    ".ommmmmmmmmdddo.",
    ".oddddddddddddo.",
    ".oooooooooooooo.",
    "................",
    "................",
    "................",
]
# Külçe: üstü dar, altı geniş kalıp
item("iron_ingot", INGOT, {"h": ST5, "w": WHITE, "m": ST4, "d": ST3})
item("copper_ingot", INGOT, {"h": AM3, "w": GD3, "m": AM2, "d": AM1})

# Hassas cam blok: ışığı çapraz yansıtan camgöbeği küp
item(
    "optical_glass",
    [
        "................",
        "................",
        "..oooooooooooo..",
        "..ohhhhhhhhhho..",
        "..ohwwhhhhhhmo..",
        "..ohwhhhhhhmmo..",
        "..ohhhhhhhmmmo..",
        "..ohhhhhhmmmmo..",
        "..ohhhhhmmmwmo..",
        "..ohhhhmmmwwmo..",
        "..ohhhmmmmmmdo..",
        "..ohmmmmmmdddo..",
        "..oddddddddddo..",
        "..oooooooooooo..",
        "................",
        "................",
    ],
    {"h": CY3, "w": WHITE, "m": CY2, "d": CY1},
)

# Plastik pelet: dört küçük yuvarlak tane
item(
    "plastic_pellet",
    [
        "................",
        "................",
        "................",
        "......ooo.......",
        ".....ohhmo......",
        ".....ohmmo.ooo..",
        ".....ommdoohhmo.",
        "..ooo.ooo.ohmmo.",
        ".ohhmo....ommdo.",
        ".ohmmo.ooo.ooo..",
        ".ommdoohhmo.....",
        "..ooo.ohmmo.....",
        "......ommdo.....",
        ".......ooo......",
        "................",
        "................",
    ],
    {"h": PU3, "m": PU2, "d": PU1},
)

# Hurda talaş: sivri uçlu, paslı kırık parça yığını
item(
    "metal_scrap",
    [
        "................",
        "................",
        "................",
        ".......oo.......",
        "..oo..ohho......",
        ".ohho.ohmo..oo..",
        ".ohmoooomo.ohho.",
        "..omhhmodoohmdo.",
        "..ohmmrmmohmdo..",
        ".ohhmdmmmmmmdo..",
        ".ohmmmmrmdmmddo.",
        ".omdmmmmmmrmddo.",
        "..odddddddddddo.",
        "...ooooooooooo..",
        "................",
        "................",
    ],
    {"h": ST4, "m": ST3, "d": ST2, "r": BR2},
)

# ---------------------------------------------------------------------------
# KADEME 2 — levha, bobin, dişli, kart
# ---------------------------------------------------------------------------

# Çelik levha: perçinli düz sac
item(
    "iron_plate",
    [
        "................",
        "................",
        "................",
        ".oooooooooooooo.",
        ".ohhhhhhhhhhhmo.",
        ".ohrhhhhhhhhrmo.",
        ".ohhhwwhhhhhmmo.",
        ".ohhwwhhhhhmmmo.",
        ".ohhhhhhhhmmmmo.",
        ".ohrhhhhmmmmrmo.",
        ".ohmmmmmmmmmmmo.",
        ".oddddddddddddo.",
        ".oddddddddddddo.",
        ".oooooooooooooo.",
        "................",
        "................",
    ],
    {"h": ST5, "w": WHITE, "m": ST4, "d": ST3, "r": ST2},
)

# Bakır tel bobini: iki flanş arasında sarılı tel
item(
    "copper_wire",
    [
        "................",
        "................",
        "..ooo......ooo..",
        "..oso......oso..",
        "..osooooooooso..",
        "..oshchchchcso..",
        "..osdhchchchso..",
        "..oshchchchcso..",
        "..osdhchchchso..",
        "..oshchchchcso..",
        "..osdhchchchso..",
        "..osooooooooso..",
        "..oso......oso..",
        "..ooo......ooo..",
        "................",
        "................",
    ],
    {"s": ST4, "h": AM3, "c": AM2, "d": AM1},
)

# Hassas dişli: sekiz dişli, göbeği dolu çark
item(
    "steel_gear",
    [
        "................",
        "......oooo......",
        "...oo.ommo.oo...",
        "..ommoommoommo..",
        "..ommmmmmmmmmo..",
        "...ommhhhhmmo...",
        ".ooomhhoohhmooo.",
        ".ommmhoddohmmmo.",
        ".ommmhoddohmmmo.",
        ".ooomhhoohhmooo.",
        "...ommhhhhmmo...",
        "..ommmmmmmmmmo..",
        "..ommoommoommo..",
        "...oo.ommo.oo...",
        "......oooo......",
        "................",
    ],
    {"h": GD3, "m": GD2, "d": GD1},
)

# Yalıtkan kart tabanı: bakır yollu yeşil kart
item(
    "circuit_substrate",
    [
        "................",
        "................",
        ".oooooooooooooo.",
        ".ogggggggggggdo.",
        ".oglggggggggldo.",
        ".oggtttttggggdo.",
        ".oggtgggtggggdo.",
        ".oggtgggtttggdo.",
        ".oggggggggtggdo.",
        ".oggtttgggtggdo.",
        ".oggggtgggggldo.",
        ".oglggtgggggldo.",
        ".oddddddddddddo.",
        ".oooooooooooooo.",
        "................",
        "................",
    ],
    {"g": GR1, "t": GR3, "l": GD2, "d": mix(GR1, OUT, 0.45)},
)

# ---------------------------------------------------------------------------
# KADEME 3 — motor, sensör, çip, çerçeve
# ---------------------------------------------------------------------------

# Elektrik motoru: soğutma kanatlı mavi gövde, sağda mil
item(
    "electric_motor",
    [
        "................",
        "................",
        "................",
        "..oooooooooo....",
        ".obbbbbbbbbbo...",
        ".obhbhbhbhbbo...",
        ".obhbhbhbhbbooo.",
        ".obhbhbhbhbbsso.",
        ".obhbhbhbhbbsso.",
        ".obdbdbdbdbbooo.",
        ".obdbdbdbdbbo...",
        ".obbbbbbbbbbo...",
        "..oooooooooo....",
        "..oko....oko....",
        "..ooo....ooo....",
        "................",
    ],
    {"b": BL2, "h": BL3, "d": BL1, "s": ST4, "k": ST3},
)

# Optik tarayıcı sensör: koyu kasa, büyük mercek
item(
    "optical_sensor",
    [
        "................",
        "................",
        "..oooooooooooo..",
        "..oKKKKKKKKKKo..",
        "..oKKooooooKko..",
        "..oKoccccccoko..",
        "..oKocwwcccoko..",
        "..oKocwccttoko..",
        "..oKoccccttoko..",
        "..oKocccttcoko..",
        "..oKoccccccoko..",
        "..oKkooooookko..",
        "..okkkkkkkkkko..",
        "..oooooooooooo..",
        "................",
        "................",
    ],
    {"K": ST3, "k": ST2, "c": CY1, "t": CY2, "w": WHITE},
)

# Aviyonik mikroçip: iki yanında bacakları olan siyah entegre
item(
    "microchip",
    [
        "................",
        "................",
        "................",
        "...oooooooooo...",
        ".ooohhhhhhhhooo.",
        "ossokgkkkkkkosso",
        ".oookkkkkkkkooo.",
        "ossokkllllkkosso",
        ".oookkkkkkkkooo.",
        "ossokkllllkkosso",
        ".oookkkkkkkkooo.",
        "ossokkkkkkkkosso",
        ".oookdddddddooo.",
        "...oooooooooo...",
        "................",
        "................",
    ],
    {"h": ST2, "k": ST1, "d": ST0, "g": GR2, "l": ST3, "s": ST5},
)

# Güçlendirilmiş gövde çerçevesi: çapraz destekli kare kafes
item(
    "reinforced_frame",
    [
        "................",
        ".oooooooooooooo.",
        ".ohhhhhhhhhhhmo.",
        ".ohmmmmmmmmmmdo.",
        ".ohmxkkkkkkxmdo.",
        ".ohmkxkkkkxkmdo.",
        ".ohmkkxkkxkkmdo.",
        ".ohmkkkxxkkkmdo.",
        ".ohmkkkxxkkkmdo.",
        ".ohmkkxkkxkkmdo.",
        ".ohmkxkkkkxkmdo.",
        ".ohmxkkkkkkxmdo.",
        ".ohmmmmmmmmmmdo.",
        ".omdddddddddddo.",
        ".oooooooooooooo.",
        "................",
    ],
    {"h": ST5, "m": ST4, "d": ST3, "x": ST4, "k": ST1},
)

# ---------------------------------------------------------------------------
# KADEME 4 — roket parçaları
# ---------------------------------------------------------------------------

SCREEN = mix(CY1, OUT, 0.55)

# Güdüm bilgisayarı: ekranlı, düğmeli, antenli kutu
item(
    "guidance_computer",
    [
        "................",
        "..........oo....",
        ".........oro....",
        "..oooooooooooo..",
        "..ohhhhhhhhhmo..",
        "..ohoooooooomo..",
        "..ohoccccccomo..",
        "..ohocwcccwomo..",
        "..ohoccwcwcomo..",
        "..ohocccwccomo..",
        "..ohoooooooomo..",
        "..ohmgmymrmmmo..",
        "..ommmmmmmmmdo..",
        "..oooooooooooo..",
        "................",
        "................",
    ],
    {"h": ST4, "m": ST3, "d": ST2, "c": SCREEN, "w": CY2, "g": GR2, "y": GD2, "r": RD2},
)

# Roket itici blok: kırmızı bağlantı bloğu, çelik çan, altında alev
item(
    "rocket_thruster_block",
    [
        "................",
        ".....oooooo.....",
        "....oRrrrrro....",
        "....orrrrrDo....",
        ".....oooooo.....",
        ".....ohmmdo.....",
        "....ohhmmmdo....",
        "....ohmmmmdo....",
        "...ohhmmmmddo...",
        "...ohmmmmmddo...",
        "..ohhmmmmmmddo..",
        "..ohmmmmmmmddo..",
        "..oooooooooooo..",
        "...offyyyyffo...",
        "....oooooooo....",
        "................",
    ],
    {"R": RD3, "r": RD2, "D": RD1, "h": ST4, "m": ST3, "d": ST2, "f": OR2, "y": GD3},
)

# Aerodinamik titanyum panel: kavisli, kehribar şeritli gövde kaplaması
item(
    "aero_hull_plate",
    [
        "................",
        "................",
        "......oooooooo..",
        "....oohhhhhhhmo.",
        "...ohhhhahhhmmo.",
        "..ohhhhahhhmmdo.",
        "..ohhhahhhmmddo.",
        ".ohhhahhhmmmdo..",
        ".ohhahhmmmmddo..",
        ".ohahhmmmmddo...",
        ".oahmmmmdddo....",
        ".ommmmdddoo.....",
        ".oddddooo.......",
        ".ooooo..........",
        "................",
        "................",
    ],
    {"h": ST5, "m": ST4, "d": ST3, "a": AM2},
)


def render(rows: list, colors: dict) -> Image.Image:
    img = Image.new("RGBA", (SIZE, SIZE), CLEAR)
    px = img.load()
    for y, row in enumerate(rows):
        for x, char in enumerate(row):
            px[x, y] = colors[char]
    return img


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for item_id, (rows, colors) in ITEMS.items():
        render(rows, colors).save(OUT_DIR / f"{item_id}.png")
    print(f"{len(ITEMS)} eşya dokusu yazıldı -> {OUT_DIR}")


if __name__ == "__main__":
    main()
