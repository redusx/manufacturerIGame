#!/usr/bin/env python3
"""Fabrikanın çevresindeki minyatür sanayi şehrini çizer.

Çalıştırma:  python3 tools/generate_city_backdrop.py   (Pillow gerekir)

Çıktı: public/assets/factory_backdrop.png (1024x1024, indeksli PNG, kenarları birbirine
oturur; oyunda döşenerek kullanılır).

Çizim dili:
  - Yalnızca 16 ana palet rengi (tools/palette.py); ara ton, karışım, gradyan yok.
  - 3/4 kuşbakışı: yapının çatısı üstte, ön cephesi altta görünür.
  - Her yapının çevresinde 1 piksel koyu kontur, ışık sol üstten; sağ alta 2 piksel
    zemin gölgesi düşer (gölge de palet rengidir: zeminin bir koyusu).
  - Çimde düzenli nokta dokusu, kaldırımda noktalı kenar, yolda kesik orta çizgi.

Yerleşim: karonun sol ve üst kenarında ortası ağaçlı birer bulvar, içeride 4x4 ada
(223 piksel) ve aralarında 24 piksellik yollar. Fabrika arsası tam bir karo boyundadır;
oyun karoyu, arsanın kenarları bulvarların orta refüjüne denk gelecek biçimde hizalar,
böylece arsanın dört yanında da yol kalır ve hiçbir yapı duvarla kesilmez.
"""

import math
from pathlib import Path
from PIL import Image

from palette import BASE, ORDER

OUT = Path(__file__).resolve().parent.parent / "public" / "assets" / "factory_backdrop.png"

SIZE = 1024
BOULEVARD = 60       # 24 şerit + 12 refüj + 24 şerit
LANE = 24
ROAD = 24
BLOCK = 223
SIDEWALK = 4
INNER = BLOCK - SIDEWALK * 2     # adanın kaldırım içindeki kenarı (215)
STARTS = [BOULEVARD + i * (BLOCK + ROAD) for i in range(4)]   # 60, 307, 554, 801

T = -1   # saydam
SA, CO, BR, UM, OL, GR, MI, SK, BL, TE, NV, PL, PU, PI, WH, BK = range(16)
CODE = dict(zip("scbuogmkBtnpPiwx", range(16)))

# Bir rengin "bir koyusu" (gölge ve doku için); hepsi yine palet rengidir
SHADE = {SA: CO, CO: BR, BR: UM, UM: BK, OL: UM, GR: OL, MI: GR, SK: BL, BL: TE, TE: NV,
         NV: BK, PL: NV, PU: PL, PI: PU, WH: SK, BK: BK}


def mat(dk: int, md: int, lt: int, out: int = UM) -> dict:
    """Malzeme: koyu, orta, açık ton ve kontur rengi."""
    return {"dk": dk, "md": md, "lt": lt, "out": out}


BRICK = mat(BR, CO, SA)
SAND = mat(CO, SA, WH)
BROWN = mat(UM, BR, CO)
BLUE = mat(TE, BL, SK, NV)
TEAL = mat(NV, TE, BL, NV)
SKY = mat(BL, SK, WH, NV)
GREEN = mat(OL, GR, MI, NV)
MINT = mat(GR, MI, WH, TE)
PURPLE = mat(PL, PU, PI, NV)
PINK = mat(PU, PI, WH, PL)
SLATE = mat(NV, PL, PU, NV)
WHITE = mat(SK, WH, WH, PL)


class Rng:
    """Tohumlu, tekrarlanabilir rastgele sayı üreteci."""

    def __init__(self, seed: int):
        self.state = seed & 0xFFFFFFFF

    def next(self) -> float:
        self.state = (self.state * 1664525 + 1013904223) & 0xFFFFFFFF
        return self.state / 4294967296

    def between(self, low: int, high: int) -> int:
        return low + int(self.next() * (high - low + 1))

    def pick(self, items):
        return items[int(self.next() * len(items)) % len(items)]


class Layer:
    """Palet indeksli piksel katmanı. Parçalar saydam bir katmana çizilir, konturlanır
    ve tuvale basılır; tuval kenarlarda sarar (karo kesintisiz döşensin diye)."""

    def __init__(self, w: int, h: int, pad: int = 1, fill: int = T, wrap: bool = False):
        self.w, self.h, self.pad, self.wrap = w, h, pad, wrap
        self.W, self.H = w + pad * 2, h + pad * 2
        self.d = [[fill] * self.W for _ in range(self.H)]

    def set(self, x: int, y: int, c: int) -> None:
        x += self.pad
        y += self.pad
        if self.wrap:
            x %= self.W
            y %= self.H
        elif x < 0 or y < 0 or x >= self.W or y >= self.H:
            return
        self.d[y][x] = c

    def get(self, x: int, y: int) -> int:
        x += self.pad
        y += self.pad
        if self.wrap:
            return self.d[y % self.H][x % self.W]
        if x < 0 or y < 0 or x >= self.W or y >= self.H:
            return T
        return self.d[y][x]

    def rect(self, x: int, y: int, w: int, h: int, c: int) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                self.set(xx, yy, c)

    def hline(self, x: int, y: int, w: int, c: int) -> None:
        self.rect(x, y, w, 1, c)

    def vline(self, x: int, y: int, h: int, c: int) -> None:
        self.rect(x, y, 1, h, c)

    def disc(self, cx: float, cy: float, rx: float, ry: float, c: int) -> None:
        for yy in range(int(math.floor(cy - ry)), int(math.ceil(cy + ry)) + 1):
            for xx in range(int(math.floor(cx - rx)), int(math.ceil(cx + rx)) + 1):
                if ((xx - cx) / rx) ** 2 + ((yy - cy) / ry) ** 2 <= 1.0:
                    self.set(xx, yy, c)

    def stamp(self, x: int, y: int, rows: list, colors: dict = None) -> None:
        for j, row in enumerate(rows):
            for i, ch in enumerate(row):
                if ch == ".":
                    continue
                self.set(x + i, y + j, colors[ch] if colors and ch in colors else CODE[ch])

    def shade(self, x: int, y: int) -> None:
        c = self.get(x, y)
        if c != T:
            self.set(x, y, SHADE[c])

    def outline(self, c: int) -> "Layer":
        edge = []
        for y in range(self.H):
            for x in range(self.W):
                if self.d[y][x] != T:
                    continue
                for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                    nx, ny = x + dx, y + dy
                    if 0 <= nx < self.W and 0 <= ny < self.H and self.d[ny][nx] != T:
                        edge.append((x, y))
                        break
        for x, y in edge:
            self.d[y][x] = c
        return self

    def blit(self, src: "Layer", x: int, y: int, shadow: int = 2) -> None:
        ox, oy = x - src.pad, y - src.pad
        if shadow:
            for j in range(src.H + shadow):
                for i in range(src.W + shadow):
                    inside = 0 <= i < src.W and 0 <= j < src.H and src.d[j][i] != T
                    if inside:
                        continue
                    for k in range(1, shadow + 1):
                        si, sj = i - k, j - k
                        if 0 <= si < src.W and 0 <= sj < src.H and src.d[sj][si] != T:
                            self.shade(ox + i, oy + j)
                            break
        for j in range(src.H):
            row = src.d[j]
            for i in range(src.W):
                if row[i] != T:
                    self.set(ox + i, oy + j, row[i])


def sprite(rows: list, colors: dict = None, out: int = None) -> Layer:
    layer = Layer(len(rows[0]), len(rows))
    layer.stamp(0, 0, rows, colors)
    return layer.outline(out) if out is not None else layer


# ---------------------------------------------------------------------------
# KÜÇÜK PARÇALAR (ağaç, araç, direk)
# ---------------------------------------------------------------------------

TREE_SMALL = [
    "...ggg...",
    ".ggmmggg.",
    ".gmmmggg.",
    "gmmgggggo",
    "gmgggggoo",
    "ggggggooo",
    ".ggggooo.",
    ".ggoooo..",
    "...ooo...",
]
TREE_BIG = [
    "....ggg....",
    "..ggmmggg..",
    ".ggmmmgggg.",
    ".gmmmggggg.",
    "gmmmgggggoo",
    "gmmggggggoo",
    "ggggggggooo",
    "gggggggoooo",
    ".gggggoooo.",
    ".ggggoooo..",
    "..gooooo...",
    "....ooo....",
]
BUSH = [
    ".gmgg.",
    "gmgggo",
    "ggggoo",
    "gggooo",
    ".ooo..",
]
PINE = [
    "...g...",
    "..gmo..",
    "..ggo..",
    ".gmggo.",
    ".ggggo.",
    "gmggggo",
    "ggggooo",
    ".ooooo.",
    "...b...",
]
CAR_SIDE = [
    "...BBBBBB.....",
    "..BkkBkkkB....",
    ".BBkkBkkkBBBB.",
    "BBBBBBBBBBBBBw",
    "DDDDDDDDDDDDDD",
    ".uu......uu...",
]
CAR_TOP = [
    ".BBBBB.",
    "BwBBBwB",
    "BBBBBBB",
    "BkkkkkB",
    "BkkkkkB",
    "BBBBBBB",
    "BBBBBBB",
    "BkkkkkB",
    "BBBBBBB",
    "BDDDDDB",
    ".DDDDD.",
]
TRUCK = [
    "........LLLLLLLLLLLLLLLLLL",
    "..wwww..MMMMMMMMMMMMMMMMMM",
    ".wkkww..MMMMMMMMMMMMMMMMMM",
    "wwkkwww.MMMMMMMMMMMMMMMMMM",
    "wwwwwww.MMMMMMMMMMMMMMMMMM",
    "wwwwwwwuDDDDDDDDDDDDDDDDDD",
    "kkkkkkkuuuuuuuuuuuuuuuuuuu",
    ".uu...........uu..uu......",
]
BUS = [
    ".BBBBBBBBBBBBBBBBBBBB.",
    "BBkkBkkBkkBkkBkkBkkBB.",
    "BBkkBkkBkkBkkBkkBkkBB.",
    "BBBBBBBBBBBBBBBBBBBBBw",
    "LLLLLLLLLLLLLLLLLLLLLL",
    "DDDDDDDDDDDDDDDDDDDDDD",
    "..uu............uu....",
]
PYLON = [
    "....p....",
    ".ppppppp.",
    "....p....",
    "...ppp...",
    "ppppppppp",
    "...p.p...",
    "...ppp...",
    "..p.p.p..",
    "..pp.pp..",
    "..p.p.p..",
    ".pp...pp.",
    ".p.....p.",
]
TRANSFORMER = [
    ".w..w..w.",
    ".p..p..p.",
    "kkkkkkkkk",
    "kkkkkkBBB",
    "BkBkBkBBB",
    "kkkkkkBBB",
    "BBBBBBBBt",
]
CRATE = [
    "sssss",
    "scscs",
    "sssss",
    "ccccc",
]
WAGON = [
    "LLLLLLLLLLLLLLLLLL",
    "MMDMMDMMDMMDMMDMMD",
    "MMDMMDMMDMMDMMDMMD",
    "MMDMMDMMDMMDMMDMMD",
    "MMDMMDMMDMMDMMDMMD",
    "DDDDDDDDDDDDDDDDDD",
    ".uu...........uu..",
]
HOPPER = [
    "...pppppppppppp...",
    "..pppnppppnppppp..",
    "LLLLLLLLLLLLLLLLLL",
    "MMMMMMMMMMMMMMMMMM",
    "DMMMMMMMMMMMMMMMMD",
    ".DDDDDDDDDDDDDDDD.",
    ".uu...........uu..",
]
LOCO = [
    "....uu................",
    "....uu......BBBBBBBB..",
    ".LLLLLLLLLL.BkkkBkkB..",
    "BBBBBBBBBBBBBkkkBkkBB.",
    "wwwwwwwwwwwwwwwwwwwwww",
    "BBBBBBBBBBBBBBBBBBBBBB",
    "DDDDDDDDDDDDDDDDDDDDDD",
    ".uu..uu.......uu..uu..",
]
BENCH = [
    "bbbbbbb",
    "ccccccc",
    "b.....b",
]


def tree(kind: str = "small") -> Layer:
    rows = {"small": TREE_SMALL, "big": TREE_BIG, "bush": BUSH, "pine": PINE}[kind]
    return sprite(rows, out=OL)


def colored(rows: list, m: dict, out: int = None) -> Layer:
    """B/D/L/M harflerini malzemenin tonlarıyla boyar."""
    colors = {"B": m["md"], "D": m["dk"], "L": m["lt"], "M": m["md"]}
    return sprite(rows, colors, out if out is not None else UM)


# ---------------------------------------------------------------------------
# YAPI PARÇALARI
# ---------------------------------------------------------------------------


def win(layer: Layer, x: int, y: int, w: int = 3, h: int = 4) -> None:
    layer.rect(x, y, w, h, SK)
    layer.set(x, y, WH)
    layer.hline(x, y + h - 1, w, BL)


def door(layer: Layer, x: int, y: int, w: int = 4, h: int = 6, c: int = BR) -> None:
    layer.rect(x, y, w, h, c)
    layer.hline(x, y, w, UM)
    layer.set(x + w - 1, y + h // 2, SA)


def shutter(layer: Layer, x: int, y: int, w: int, h: int, c: int = PL) -> None:
    """Kepenk: yatay çizgili büyük kapı."""
    layer.rect(x, y, w, h, c)
    for j in range(y, y + h, 2):
        layer.hline(x, j, w, SHADE[c])
    layer.vline(x - 1, y - 1, h + 1, WH)
    layer.vline(x + w, y - 1, h + 1, WH)
    layer.hline(x - 1, y - 1, w + 2, WH)


def wall(layer: Layer, x: int, y: int, w: int, h: int, m: dict) -> None:
    layer.rect(x, y, w, h, m["md"])
    layer.hline(x, y, w, m["dk"])            # saçak gölgesi


def roof_flat(layer: Layer, x: int, y: int, w: int, d: int, m: dict) -> None:
    layer.rect(x, y, w, d, m["md"])
    layer.hline(x, y, w, m["lt"])
    layer.vline(x, y, d, m["lt"])
    layer.hline(x, y + d - 1, w, m["dk"])
    layer.vline(x + w - 1, y, d, m["dk"])


def roof_gable(layer: Layer, x: int, y: int, w: int, d: int, m: dict, seams: int = 12) -> None:
    """Sırtı yatay beşik çatı: arka yüz açık, ön yüz orta ton, saçak koyu."""
    far = max(2, d * 2 // 5)
    layer.rect(x, y, w, far, m["lt"])
    layer.rect(x, y + far, w, d - far, m["md"])
    layer.hline(x, y + d - 1, w, m["dk"])
    if seams:
        for i in range(seams // 2, w, seams):
            layer.vline(x + i, y + far + 1, d - far - 2, m["dk"])


def roof_hip(layer: Layer, x: int, y: int, w: int, d: int, m: dict) -> None:
    """Kırma çatı: arka ve sol yüz ışıkta, ön yüz orta tonda ve kiremit sıralı, sağ yüz gölgede."""
    far, side = max(3, d // 3), max(4, d * 2 // 5)
    near = d - far
    for j in range(d):
        for i in range(w):
            dl, dr = i / side, (w - 1 - i) / side
            dt, db = j / far, (d - 1 - j) / near
            k = min(dl, dr, dt, db)
            if k == db:
                c = m["dk"] if (d - 1 - j) % 4 == 3 and (i + j) % 2 == 0 else m["md"]
            elif k == dr:
                c = m["dk"]
            else:
                c = m["lt"]
            layer.set(x + i, y + j, c)
    layer.hline(x, y + d - 1, w, m["dk"])


def roof_saw(layer: Layer, x: int, y: int, w: int, bands: int, m: dict) -> None:
    """Testere dişi çatı: her dişte eğimli sac ve öne bakan cam şerit."""
    rows = [m["lt"], m["md"], m["md"], SK, SK, BL, m["dk"]]
    for b in range(bands):
        for r, c in enumerate(rows):
            layer.hline(x, y + b * 7 + r, w, c)
        for i in range(4, w, 6):
            layer.vline(x + i, y + b * 7 + 3, 2, WH if i % 12 == 4 else BL)


def hall(w: int, d: int, wh: int, roof: dict, face: dict, kind: str = "gable", bands: int = 0,
         doors: tuple = (), wins: bool = True, out: int = None) -> Layer:
    """Dikdörtgen hol: üstte çatı, altta ön cephe. doors: (x, genişlik, yükseklik)."""
    if kind == "saw":
        d = bands * 7
    layer = Layer(w, d + wh)
    if kind == "saw":
        roof_saw(layer, 0, 0, w, bands, roof)
    elif kind == "flat":
        roof_flat(layer, 0, 0, w, d, roof)
    elif kind == "hip":
        roof_hip(layer, 0, 0, w, d, roof)
    else:
        roof_gable(layer, 0, 0, w, d, roof)
    wall(layer, 0, d, w, wh, face)
    if wins:
        for i in range(4, w - 6, 8):
            if all(i + 4 < dx - 2 or i > dx + dw + 2 for dx, dw, _ in doors):
                win(layer, i, d + 3)
    for dx, dw, dh in doors:
        shutter(layer, dx, d + wh - dh, dw, dh)
    return layer.outline(out if out is not None else roof["out"])


def barrel(w: int, d: int, wh: int, roof: dict, face: dict, doors: tuple = ()) -> Layer:
    """Tonoz çatılı depo: çatı ekseni derinlik yönünde, ön cephenin üstü kavisli."""
    arch = max(4, w // 6)
    layer = Layer(w, d + arch + wh)

    def lift(i: int) -> int:
        return arch - int(round(arch * math.sqrt(max(0.0, 1 - ((i + 0.5 - w / 2) / (w / 2)) ** 2))))

    for i in range(w):
        t = (i + 0.5) / w
        tone = roof["dk"] if t < 0.06 else roof["md"] if t < 0.2 else roof["lt"] if t < 0.42 else roof["md"] if t < 0.8 else roof["dk"]
        a = lift(i)
        for j in range(a, d + a):
            rib = (j - a) % 8 == 7
            layer.set(i, j, SHADE[tone] if rib and tone != roof["dk"] else tone)
        layer.set(i, d + a - 1, roof["dk"])
        for j in range(d + a, d + arch + wh):
            layer.set(i, j, face["md"])
        layer.set(i, d + a, face["dk"])
    # Alınlıkta yuvarlak havalandırma
    layer.rect(w // 2 - 2, d + arch // 2 + 1, 4, 3, SK)
    layer.set(w // 2 - 2, d + arch // 2 + 1, WH)
    base = d + arch + wh
    for dx, dw, dh in doors:
        shutter(layer, dx, base - dh, dw, dh)
    return layer.outline(roof["out"])


def house(roof: dict, face: dict, w: int = 26, gable: bool = False) -> Layer:
    """Küçük ev. gable=True ise alınlığı öne bakan beşik çatı, değilse kırma çatı."""
    d, wh = 16, 11
    layer = Layer(w, d + wh)
    if gable:
        half = w // 2
        for j in range(d):
            for i in range(w):
                layer.set(i, j, roof["lt"] if i < half - 1 else roof["md"] if i > half else WH)
        wall(layer, 1, d, w - 2, wh, face)
        # Öne bakan üçgen alınlık çatıya doğru yükselir; kenarı çatının saçağıdır
        rise = half - 3
        for j in range(rise):
            span = (w - 2) - j * 2
            layer.hline(1 + j, d - j, span, face["md"])
            layer.set(1 + j, d - j, roof["dk"])
            layer.set(w - 2 - j, d - j, roof["dk"])
            layer.set(2 + j, d - j, roof["dk"])
            layer.set(w - 3 - j, d - j, roof["dk"])
        layer.set(0, d, roof["dk"])
        layer.set(w - 1, d, roof["dk"])
        win(layer, half - 1, d - rise + 4, 3, 3)
    else:
        roof_hip(layer, 0, 0, w, d, roof)
        wall(layer, 1, d, w - 2, wh, face)
        # Baca
        layer.rect(w - 10, 2, 3, 5, WH)
        layer.hline(w - 10, 2, 3, UM)
        layer.vline(w - 8, 3, 4, SK)
    door(layer, w // 2 - 2, d + wh - 6)
    win(layer, 4, d + 3)
    win(layer, w - 7, d + 3)
    return layer.outline(UM)


def office(w: int, d: int, floors: int, face: dict, roof: dict = SLATE) -> Layer:
    """Düz çatılı idari bina: çatıda klima kutuları, cephede pencere sıraları."""
    wh = floors * 7 + 3
    layer = Layer(w, d + wh)
    roof_flat(layer, 0, 0, w, d, roof)
    for ux in range(6, w - 12, 22):
        layer.rect(ux, 3, 7, 4, WH)
        layer.hline(ux, 6, 7, SK)
        layer.vline(ux + 6, 3, 4, SK)
    wall(layer, 0, d, w, wh, face)
    for f in range(floors):
        for i in range(3, w - 6, 6):
            win(layer, i, d + 2 + f * 7, 4, 4)
    mid = w // 2
    layer.rect(mid - 4, d + wh - 7, 8, 7, SK)
    layer.vline(mid, d + wh - 7, 7, BL)
    layer.hline(mid - 6, d + wh - 8, 12, CO)
    return layer.outline(roof["out"])


def tank(r: int, h: int, m: dict, band: int = None) -> Layer:
    """Dik silindir tank: üstte elips kapak, gövdede ışık şeridi."""
    w, ry = r * 2 + 1, max(2, round(r * 0.45))
    layer = Layer(w, h + ry * 2 + 1)

    def curve(i: int) -> float:
        return ry * math.sqrt(max(0.0, 1 - ((i - r) / (r + 0.5)) ** 2))

    for i in range(w):
        t = i / (w - 1)
        tone = m["md"] if t < 0.14 else m["lt"] if t < 0.3 else m["md"] if t < 0.68 else m["dk"]
        bottom = int(round(ry + h + curve(i)))
        for j in range(ry, bottom + 1):
            layer.set(i, j, tone)
        if band is not None:
            by = int(round(ry + h * 0.5 + curve(i)))
            layer.set(i, by, band if t < 0.68 else SHADE[band])
            layer.set(i, by + 1, band if t < 0.68 else SHADE[band])
    for j in range(ry * 2 + 1):
        for i in range(w):
            ex, ey = (i - r) / (r + 0.5), (j - ry) / (ry + 0.5)
            if ex * ex + ey * ey <= 1.0:
                layer.set(i, j, m["lt"] if (i - r) + 2 * (j - ry) < -r * 0.5 else m["md"])
    for i in range(w):
        layer.set(i, int(round(ry + curve(i))), m["dk"])
    layer.rect(r - 1, ry - 1, 3, 2, m["dk"])
    return layer.outline(m["out"])


def silo(r: int, h: int, m: dict) -> Layer:
    """Konik başlıklı uzun silo."""
    w, cone = r * 2 + 1, r
    layer = Layer(w, cone + h + 3)
    for j in range(cone):
        half = int(round((j + 1) / cone * r))
        for i in range(r - half, r + half + 1):
            layer.set(i, j, m["lt"] if i < r else m["md"] if i < r + half * 0.5 else m["dk"])
    for i in range(w):
        t = i / (w - 1)
        tone = m["md"] if t < 0.14 else m["lt"] if t < 0.34 else m["md"] if t < 0.68 else m["dk"]
        bottom = cone + h + int(round(2 * math.sqrt(max(0.0, 1 - ((i - r) / (r + 0.5)) ** 2))))
        for j in range(cone, bottom + 1):
            layer.set(i, j, tone)
    layer.hline(0, cone, w, m["dk"])
    return layer.outline(m["out"])


def sphere(r: int, m: dict, legs: int = 5) -> Layer:
    """Ayaklı küre tank."""
    w = r * 2 + 1
    layer = Layer(w, w + legs)
    for lx in (r - round(r * 0.62), r, r + round(r * 0.62)):
        layer.vline(lx, r, r + legs + 1, PL)
    for j in range(w):
        for i in range(w):
            dx, dy = i - r, j - r
            if dx * dx + dy * dy > (r + 0.3) ** 2:
                continue
            c = m["md"]
            if (dx + r * 0.35) ** 2 + (dy + r * 0.4) ** 2 <= (r * 0.42) ** 2:
                c = m["lt"]
            elif dx + dy > r * 0.7:
                c = m["dk"]
            layer.set(i, j, c)
    for i in range(1, w - 1):
        e = 2 * math.sqrt(max(0.0, 1 - ((i - r) / r) ** 2))
        layer.set(i, r + int(round(e)), m["dk"])
    return layer.outline(m["out"])


def cooling_tower(w: int = 40, h: int = 50) -> Layer:
    """Soğutma kulesi: beli dar, tabanı geniş; ağzı koyu, üstünde bakır kuşak."""
    layer = Layer(w, h + 4)
    cx = (w - 1) / 2
    top, waist, bottom = w * 0.36, w * 0.3, w * 0.5
    for j in range(h):
        t = j / (h - 1)
        hw = waist + (top - waist) * ((0.35 - t) / 0.35) ** 2 if t < 0.35 else waist + (bottom - waist) * ((t - 0.35) / 0.65) ** 1.6
        for i in range(w):
            if abs(i - cx) > hw:
                continue
            u = (i - cx) / hw
            tone = WH if u < 0.25 else SK if u < 0.72 else BL
            if 6 <= j <= 8:
                tone = CO if u < 0.25 else BR
            layer.set(i, j + 4, tone)
    layer.disc(cx, 4, top, 3.4, PL)
    layer.disc(cx, 3.2, top - 2, 2.0, NV)
    return layer.outline(NV)


def chimney(h: int, m: dict = BRICK, w: int = 7) -> Layer:
    """Fabrika bacası: üstte iki beyaz kuşak, koyu ağız."""
    layer = Layer(w, h)
    for i in range(w):
        t = i / (w - 1)
        tone = m["lt"] if t < 0.2 else m["md"] if t < 0.7 else m["dk"]
        layer.vline(i, 1, h - 1, tone)
    for by in (5, 11):
        for i in range(w):
            layer.vline(i, by, 3, WH if i < w * 0.7 else SK)
    layer.hline(0, 0, w, m["lt"])
    layer.hline(1, 1, w - 2, UM)
    return layer.outline(m["out"])


def container(m: dict, w: int = 18) -> Layer:
    layer = Layer(w, 11)
    layer.rect(0, 0, w, 4, m["lt"])
    layer.rect(0, 4, w, 7, m["md"])
    layer.hline(0, 4, w, m["dk"])
    for i in range(2, w, 3):
        layer.vline(i, 5, 6, m["dk"])
    return layer.outline(m["out"])


def mound(w: int, h: int, m: dict) -> Layer:
    """Hammadde yığını."""
    layer = Layer(w, h)
    cx = (w - 1) / 2
    for j in range(h):
        hw = (w / 2) * math.sqrt(max(0.0, 1 - ((h - 1 - j) / h) ** 2))
        for i in range(w):
            if abs(i - cx) <= hw:
                u = (i - cx) / max(1.0, hw)
                layer.set(i, j, m["lt"] if u < -0.35 and j < h - 2 else m["dk"] if u > 0.45 else m["md"])
    return layer.outline(m["out"])


def solar_panel() -> Layer:
    layer = Layer(15, 8)
    layer.rect(0, 0, 15, 8, BL)
    for i in range(0, 15, 5):
        layer.vline(i + 4, 0, 8, NV)
    layer.hline(0, 4, 15, NV)
    for k in range(3):
        layer.set(1 + k, 2 - k, SK)
        layer.set(6 + k, 2 - k, SK)
    layer.hline(0, 7, 15, TE)
    return layer.outline(NV)


def crane(span: int = 76, height: int = 30) -> Layer:
    """Konteyner sahasının köprü vinci."""
    layer = Layer(span, height)
    for lx in (2, span - 6):
        layer.rect(lx, 5, 4, height - 5, CO)
        layer.vline(lx + 3, 5, height - 5, BR)
        layer.vline(lx, 5, height - 5, SA)
    layer.rect(0, 0, span, 5, CO)
    layer.hline(0, 0, span, SA)
    layer.hline(0, 4, span, BR)
    for i in range(6, span - 6, 8):
        layer.set(i, 2, BR)
    layer.rect(span // 2 - 4, 5, 9, 4, PL)
    layer.vline(span // 2, 9, 6, UM)
    return layer.outline(UM)


def water_tower() -> Layer:
    layer = Layer(17, 26)
    for lx in (3, 8, 13):
        layer.vline(lx, 12, 14, PL)
    layer.hline(3, 19, 11, PL)
    body = tank(8, 6, WHITE, band=BL)
    for j in range(body.H):
        for i in range(body.W):
            if body.d[j][i] != T:
                layer.set(i - 1, j - 1, body.d[j][i])
    return layer.outline(NV)


def pipe_h(canvas: Layer, x: int, y: int, w: int) -> None:
    """Yatay boru hattı: iki boru ve aralıklı ayaklar."""
    for i in range(w):
        canvas.set(x + i, y, WH)
        canvas.set(x + i, y + 1, SK)
        canvas.set(x + i, y + 2, BL)
        canvas.set(x + i, y + 3, NV)
        if i % 14 == 6:
            canvas.set(x + i, y + 4, NV)
            canvas.set(x + i, y + 5, NV)
            canvas.set(x + i, y - 1, NV)


def pipe_v(canvas: Layer, x: int, y: int, h: int) -> None:
    for j in range(h):
        canvas.set(x, y + j, SK)
        canvas.set(x + 1, y + j, BL)
        canvas.set(x + 2, y + j, NV)
        if j % 14 == 6:
            canvas.set(x - 1, y + j, NV)


# ---------------------------------------------------------------------------
# ŞEHİR
# ---------------------------------------------------------------------------


class City:
    def __init__(self):
        self.c = Layer(SIZE, SIZE, pad=0, fill=GR, wrap=True)
        self.queue = []
        self.smokes = []
        self.rng = Rng(2026)

    # -- Zeminler --------------------------------------------------------------

    def lawn(self, x: int, y: int, w: int, h: int) -> None:
        for yy in range(y, y + h):
            for xx in range(x, x + w):
                ax, ay = xx % 8, yy % 8
                dot = (ax == 2 and ay == 2) or (ax == 6 and ay == 6)
                tuft = xx % 32 == 13 and yy % 32 == 19
                self.c.set(xx, yy, MI if tuft else OL if dot else GR)

    def ground(self, x: int, y: int, w: int, h: int, base: int, speck: int = None, density: int = 70) -> None:
        self.c.rect(x, y, w, h, base)
        if speck is None:
            return
        for _ in range(w * h // density):
            sx, sy = x + self.rng.between(1, w - 3), y + self.rng.between(1, h - 2)
            self.c.set(sx, sy, speck)
            if self.rng.next() < 0.3:
                self.c.set(sx + 1, sy, speck)

    def path_h(self, x: int, y: int, w: int, thick: int = 5) -> None:
        self.c.rect(x, y, w, thick, SA)
        for i in range(x, x + w, 4):
            self.c.set(i, y + thick - 1, CO)

    def path_v(self, x: int, y: int, h: int, thick: int = 5) -> None:
        self.c.rect(x, y, thick, h, SA)
        for j in range(y, y + h, 4):
            self.c.set(x + thick - 1, j, CO)

    def fence(self, x: int, y: int, w: int, h: int, c: int = BR) -> None:
        for i in range(w):
            if i % 3 != 2:
                self.c.set(x + i, y, c)
                self.c.set(x + i, y + h - 1, c)
        for j in range(h):
            if j % 3 != 2:
                self.c.set(x, y + j, c)
                self.c.set(x + w - 1, y + j, c)

    def pond(self, cx: int, cy: int, rx: int, ry: int) -> None:
        self.c.disc(cx, cy, rx + 2, ry + 2, SA)
        self.c.disc(cx, cy, rx, ry, TE)
        self.c.disc(cx - 1, cy - 1, rx - 1, ry - 1, BL)
        for k in range(4):
            wx = cx - rx // 2 + k * (rx // 3) + (k % 2) * 2
            wy = cy - ry // 3 + (k * 5) % (ry or 1)
            self.c.hline(wx, wy, 4, SK)
            self.c.set(wx + 1, wy - 1, WH)

    def flowers(self, x: int, y: int, w: int, h: int, count: int) -> None:
        for _ in range(count):
            fx, fy = x + self.rng.between(0, w - 1), y + self.rng.between(0, h - 1)
            self.c.set(fx, fy, self.rng.pick([PI, WH, PU, SA]))

    def parking(self, x: int, y: int, bays: int, rows: int = 1) -> None:
        """Asfalt otopark: beyaz çizgili cepler, bir kısmı dolu."""
        w = bays * 10 + 1
        for r in range(rows):
            top = y + r * 30
            self.c.rect(x, top, w, 26, PL)
            for b in range(bays + 1):
                self.c.vline(x + b * 10, top, 13, SA)
            for b in range(bays):
                if self.rng.next() < 0.6:
                    m = self.rng.pick([BLUE, PINK, MINT, WHITE, BRICK, PURPLE, SAND])
                    self.put(colored(CAR_TOP, m), x + b * 10 + 2, top + 1, shadow=1)

    # -- Yerleştirme -----------------------------------------------------------

    def put(self, layer: Layer, x: int, y: int, shadow: int = 2) -> None:
        self.queue.append((y + layer.h, len(self.queue), layer, x, y, shadow))

    def put_base(self, layer: Layer, cx: int, base: int, shadow: int = 2) -> None:
        self.put(layer, cx - layer.w // 2, base - layer.h, shadow)

    def flush(self) -> None:
        for _, _, layer, x, y, shadow in sorted(self.queue, key=lambda item: (item[0], item[1])):
            self.c.blit(layer, x, y, shadow)
        self.queue = []

    def smoke(self, x: int, y: int, puffs: int = 4, dx: int = 5, dy: int = -6, r0: int = 3) -> None:
        self.smokes.append((x, y, puffs, dx, dy, r0))

    def draw_smokes(self) -> None:
        for x, y, puffs, dx, dy, r0 in self.smokes:
            for k in range(puffs):
                r = r0 + k
                cx, cy = x + k * dx + (k * k) // 2, y + k * dy
                self.c.disc(cx + 1, cy + 1, r, r, SK)
                self.c.disc(cx, cy, r, r, WH)

    def trees(self, spots: list, ox: int, oy: int) -> None:
        for x, y, kind in spots:
            self.put_base(tree(kind), ox + x, oy + y, shadow=1)

    # -- Yollar ----------------------------------------------------------------

    def roads(self) -> None:
        c = self.c
        spans = [(0, BOULEVARD)] + [(s - ROAD, ROAD) for s in STARTS[1:]]
        for start, width in spans:
            c.rect(start, 0, width, SIZE, PL)
            c.rect(0, start, SIZE, width, PL)
        # Kaldırımlar: adanın çevresinde 4 piksel, dışa bakan ikinci sırası noktalı
        for by in STARTS:
            for bx in STARTS:
                for k in range(SIDEWALK):
                    for i in range(k, BLOCK - k):
                        dotted = k == 1 and i % 2 == 0
                        tone = CO if dotted else SA
                        c.set(bx + i, by + k, tone)
                        c.set(bx + i, by + BLOCK - 1 - k, tone)
                        c.set(bx + k, by + i, tone)
                        c.set(bx + BLOCK - 1 - k, by + i, tone)
        # Kesik orta çizgiler (kavşaklarda kesilir) ve yaya geçitleri
        centers = [LANE // 2, BOULEVARD - LANE // 2] + [s - ROAD // 2 for s in STARTS[1:]]
        for center in centers:
            for b in STARTS:
                for step in range(8, BLOCK - 10, 12):
                    c.vline(center, b + step, 6, CO)
                    c.hline(b + step, center, 6, CO)
        for start, width in spans:
            for b in STARTS:
                for stripe in range(3, width - 3, 4):
                    if BOULEVARD // 2 - 7 < stripe < BOULEVARD // 2 + 5 and width == BOULEVARD:
                        continue
                    for edge in (b + 1, b + BLOCK - 6):
                        c.rect(start + stripe, edge, 2, 5, SA)
                        c.rect(edge, start + stripe, 5, 2, SA)
        # Bulvarın orta refüjü: çim, kaldırım taşı ve aralıklı çalılar
        for b in STARTS:
            for vertical in (True, False):
                for k in range(LANE, BOULEVARD - LANE):
                    edge = k in (LANE, BOULEVARD - LANE - 1)
                    for i in range(8, BLOCK - 8):
                        tone = SA if edge or i in (8, BLOCK - 9) else GR
                        if vertical:
                            c.set(k, b + i, tone)
                        else:
                            c.set(b + i, k, tone)
                for i in range(22, BLOCK - 16, 26):
                    bush = tree("bush")
                    if vertical:
                        self.put(bush, LANE + 3, b + i, shadow=0)
                    else:
                        self.put(bush, b + i, LANE + 3, shadow=0)
        self.flush()

    def traffic(self) -> None:
        """Yollarda birkaç araç."""
        lanes = [s - ROAD for s in STARTS[1:]]
        self.put(colored(BUS, PINK), STARTS[1] + 40, lanes[0] + 2, shadow=1)
        self.put(colored(CAR_SIDE, BLUE), STARTS[2] + 120, lanes[1] + 14, shadow=1)
        self.put(colored(CAR_SIDE, MINT), STARTS[0] + 150, lanes[2] + 3, shadow=1)
        self.put(colored(TRUCK, BRICK), STARTS[3] + 60, lanes[1] + 3, shadow=1)
        self.put(colored(CAR_SIDE, WHITE), STARTS[3] + 30, 40, shadow=1)
        self.put(colored(TRUCK, MINT), STARTS[1] + 110, 3, shadow=1)
        self.put(colored(CAR_SIDE, PURPLE), STARTS[2] + 30, lanes[2] + 14, shadow=1)
        self.put(colored(CAR_TOP, SAND), lanes[0] + 3, STARTS[2] + 70, shadow=1)
        self.put(colored(CAR_TOP, PINK), lanes[1] + 14, STARTS[0] + 120, shadow=1)
        self.put(colored(CAR_TOP, BLUE), lanes[2] + 3, STARTS[3] + 150, shadow=1)
        self.put(colored(CAR_TOP, WHITE), 4, STARTS[1] + 90, shadow=1)
        self.put(colored(CAR_TOP, MINT), 46, STARTS[2] + 160, shadow=1)
        self.flush()

    # -- Adalar ----------------------------------------------------------------

    def steelworks(self, ox: int, oy: int, brick: bool = False) -> None:
        """Çelik fabrikası: testere dişi çatılı hol, iki baca, yüksek fırın, cevher yığınları."""
        self.ground(ox, oy, INNER, INNER, SA, CO)
        self.lawn(ox + 146, oy + 150, 69, 65)
        self.fence(ox + 2, oy + 2, INNER - 4, INNER - 4)
        self.ground(ox + 10, oy + 142, 126, 12, PL)
        self.ground(ox + 122, oy + 154, 14, 59, PL)
        for k in range(4):
            self.c.vline(ox + 129, oy + 160 + k * 13, 6, SA)
        roof, face = (BRICK, SAND) if brick else (TEAL, BRICK)
        self.put_base(chimney(54), ox + 34, oy + 82)
        self.put_base(chimney(46), ox + 54, oy + 84)
        self.smoke(ox + 36, oy + 24)
        self.smoke(ox + 56, oy + 34, puffs=3)
        self.put(hall(124, 0, 19, roof, face, kind="saw", bands=7, doors=((14, 18, 12), (86, 16, 12))), ox + 10, oy + 74)
        self.put_base(tank(13, 34, BROWN, band=CO), ox + 172, oy + 100)
        self.put_base(silo(6, 30, WHITE), ox + 194, oy + 96)
        self.put_base(silo(6, 26, WHITE), ox + 207, oy + 98)
        self.put(hall(58, 22, 14, BLUE if brick else SKY, SAND if not brick else BRICK, doors=((6, 12, 9),)), ox + 144, oy + 100)
        pipe_h(self.c, ox + 134, oy + 90, 26)
        self.put(mound(30, 14, BRICK), ox + 14, oy + 156, shadow=1)
        self.put(mound(24, 11, SLATE), ox + 46, oy + 162, shadow=1)
        self.put(mound(22, 10, WHITE), ox + 74, oy + 160, shadow=1)
        self.put(colored(TRUCK, SLATE), ox + 22, oy + 186, shadow=1)
        self.put(colored(TRUCK, BRICK), ox + 92, oy + 144, shadow=1)
        for k in range(4):
            self.put(sprite(CRATE, out=BR), ox + 92 + k * 7, oy + 176 + (k % 2) * 5, shadow=1)
        self.put(office(52, 9, 2, SAND), ox + 154, oy + 162)
        self.trees([(152, 160, "small"), (210, 158, "pine"), (158, 208, "bush"), (182, 211, "small"), (206, 206, "big")], ox, oy)
        self.flush()

    def tank_farm(self, ox: int, oy: int) -> None:
        """Tank sahası: iki sıra silindir tank, küre tanklar, boru hatları, dolum yeri."""
        self.lawn(ox, oy, INNER, INNER)
        self.ground(ox + 6, oy + 8, 150, 132, SA, CO)
        self.fence(ox + 6, oy + 8, 150, 132)
        mats = [MINT, WHITE, MINT, WHITE, MINT, SKY]
        for row in range(2):
            for col in range(3):
                self.put_base(tank(18, 14, mats[row * 3 + col], band=BL if (row + col) % 2 else CO), ox + 32 + col * 48, oy + 66 + row * 62)
        pipe_h(self.c, ox + 12, oy + 72, 138)
        pipe_v(self.c, ox + 80, oy + 78, 60)
        self.put_base(sphere(15, WHITE), ox + 184, oy + 52)
        self.put_base(sphere(15, PINK), ox + 184, oy + 96)
        self.put_base(sphere(11, MINT), ox + 190, oy + 130)
        self.ground(ox + 6, oy + 150, 150, 58, PL)
        for k in range(5):
            self.c.hline(ox + 12 + k * 30, oy + 178, 16, SA)
        self.put(hall(44, 16, 12, TEAL, SAND, doors=((28, 10, 8),)), ox + 12, oy + 150)
        self.put(colored(TRUCK, MINT), ox + 66, oy + 162, shadow=1)
        self.put(colored(TRUCK, WHITE), ox + 104, oy + 186, shadow=1)
        self.put_base(chimney(34, SLATE, 5), ox + 164, oy + 200)
        self.c.stamp(ox + 162, oy + 158, [".s.", "sws", "scs", ".c."])
        self.trees([(170, 150, "small"), (204, 160, "big"), (184, 190, "pine"), (206, 204, "small"), (176, 212, "bush")], ox, oy)
        self.flush()

    def warehouses(self, ox: int, oy: int) -> None:
        """Depolar: üç tonoz çatılı depo, yükleme rampası, konteynerler, otopark."""
        self.ground(ox, oy, INNER, INNER, SA, CO, density=110)
        roofs = [BLUE, TEAL, PURPLE]
        faces = [SAND, BRICK, SAND]
        for k in range(3):
            self.put(barrel(60, 62, 16, roofs[k], faces[k], doors=((8, 16, 11), (36, 16, 11))), ox + 8 + k * 68, oy + 10)
        self.ground(ox, oy + 112, INNER, 44, PL)
        for k in range(7):
            self.c.hline(ox + 6 + k * 30, oy + 134, 16, SA)
        self.put(colored(TRUCK, BLUE), ox + 14, oy + 114, shadow=1)
        self.put(colored(TRUCK, PINK), ox + 84, oy + 138, shadow=1)
        self.put(colored(TRUCK, SAND), ox + 150, oy + 115, shadow=1)
        stack = [BLUE, PINK, MINT, BRICK, PURPLE, WHITE, TEAL]
        for k in range(5):
            self.put(container(stack[k % 7]), ox + 8 + k * 20, oy + 170, shadow=1)
        for k in range(3):
            self.put(container(stack[(k + 4) % 7]), ox + 18 + k * 20, oy + 162, shadow=1)
        for k in range(4):
            self.put(sprite(CRATE, out=BR), ox + 112 + (k % 2) * 7, oy + 166 + (k // 2) * 6, shadow=1)
        self.lawn(ox + 130, oy + 160, 85, 55)
        self.parking(ox + 134, oy + 186, 7)
        self.trees([(138, 176, "small"), (160, 174, "bush"), (182, 177, "small"), (206, 175, "pine"), (8, 208, "bush"), (60, 210, "small"), (100, 208, "bush")], ox, oy)
        self.flush()

    def power_plant(self, ox: int, oy: int) -> None:
        """Santral: iki soğutma kulesi, türbin holü, baca, trafo sahası ve direkler."""
        self.lawn(ox, oy, INNER, INNER)
        self.ground(ox + 4, oy + 96, 207, 60, SA, CO)
        self.put_base(cooling_tower(46, 60), ox + 34, oy + 86)
        self.put_base(cooling_tower(46, 60), ox + 88, oy + 98)
        self.smoke(ox + 36, oy + 16, puffs=3, dx=6, dy=-5, r0=5)
        self.smoke(ox + 90, oy + 28, puffs=3, dx=6, dy=-5, r0=5)
        self.put_base(chimney(66, WHITE, 7), ox + 200, oy + 108)
        self.smoke(ox + 203, oy + 36, puffs=3)
        self.put(hall(92, 26, 18, BLUE, WHITE, doors=((70, 14, 11),)), ox + 112, oy + 70)
        self.put(mound(34, 13, SLATE), ox + 10, oy + 132, shadow=1)
        self.put(mound(22, 9, SLATE), ox + 40, oy + 140, shadow=1)
        pipe_h(self.c, ox + 62, oy + 122, 52)
        self.ground(ox + 112, oy + 166, 99, 44, SA, CO)
        self.fence(ox + 112, oy + 166, 99, 44, PL)
        for k in range(4):
            self.put(sprite(TRANSFORMER, out=NV), ox + 120 + k * 22, oy + 174, shadow=1)
            self.put(sprite(TRANSFORMER, out=NV), ox + 120 + k * 22, oy + 194, shadow=1)
        for k in range(3):
            self.put(sprite(PYLON), ox + 10 + k * 34, oy + 172, shadow=1)
        for i in range(6, 110, 2):
            self.c.set(ox + i, oy + 176 + (1 if (i // 17) % 2 else 0), PL)
        self.trees([(14, 208, "small"), (40, 210, "bush"), (66, 208, "big"), (96, 211, "small"), (150, 62, "pine"), (176, 64, "small")], ox, oy)
        self.flush()

    def container_yard(self, ox: int, oy: int) -> None:
        """Konteyner sahası: renkli konteyner sıraları, köprü vinci, tırlar, kapı kulübesi."""
        self.ground(ox, oy, INNER, INNER, PL)
        for lane in (56, 116, 176):
            for i in range(6, INNER - 6, 10):
                self.c.hline(ox + i, oy + lane, 5, SA)
        stack = [BLUE, PINK, MINT, BRICK, PURPLE, WHITE, TEAL, SAND]
        for row in range(3):
            for col in range(9):
                if (row * 9 + col) % 7 == 5:
                    continue
                base = oy + 22 + row * 60
                self.put(container(stack[(row * 3 + col * 5) % 8]), ox + 8 + col * 20, base + 8, shadow=1)
                if (row + col) % 3 != 1:
                    self.put(container(stack[(row * 5 + col * 3 + 2) % 8]), ox + 8 + col * 20, base, shadow=0)
                if (row * 2 + col) % 5 == 0:
                    self.put(container(stack[(row + col) % 8]), ox + 8 + col * 20, base - 8, shadow=0)
        self.put(crane(), ox + 96, oy + 72)
        self.put(colored(TRUCK, BLUE), ox + 30, oy + 62, shadow=1)
        self.put(colored(TRUCK, PINK), ox + 140, oy + 122, shadow=1)
        self.put(colored(TRUCK, SAND), ox + 60, oy + 182, shadow=1)
        self.put(hall(30, 12, 11, BRICK, SAND, kind="hip"), ox + 178, oy + 186)
        self.flush()

    def housing(self, ox: int, oy: int, variant: int = 0) -> None:
        """İşçi evleri: renkli çatılı küçük evler, bahçe yolları, ağaçlar, çiçekler."""
        self.lawn(ox, oy, INNER, INNER)
        roofs = [BRICK, BLUE, PURPLE, TEAL, BROWN, GREEN, BLUE, BRICK, PURPLE]
        faces = [SAND, WHITE, SAND, SAND, WHITE, SAND, SAND, WHITE, SAND]
        self.path_h(ox, oy + 66, INNER)
        self.path_h(ox, oy + 138, INNER)
        for row in range(3):
            for col in range(3):
                k = (row * 3 + col + variant * 4) % 9
                x, y = ox + 12 + col * 72, oy + 6 + row * 72
                if variant and row == 1 and col == 1:
                    self.pond(x + 16, y + 22, 20, 11)
                    continue
                self.put(house(roofs[k], faces[k], gable=(k + variant) % 3 == 1), x, y + 28 - 27)
                self.c.rect(x + 11, y + 29, 4, 72 - 35, SA)
                self.flowers(x + 30, y + 22, 26, 10, 9)
        spots = []
        for row in range(3):
            for col in range(3):
                spots.append((48 + col * 72, 24 + row * 72, "small" if (row + col) % 2 else "big"))
                spots.append((62 + col * 72, 58 + row * 72, "bush" if (row + col) % 3 else "pine"))
        self.trees(spots, ox, oy)
        self.flush()

    def park(self, ox: int, oy: int) -> None:
        """Park: gölet, çapraz yürüyüş yolları, çeşme, çiçek tarhları ve ağaçlar."""
        self.lawn(ox, oy, INNER, INNER)
        self.path_h(ox, oy + 104, INNER, 6)
        self.path_v(ox + 104, oy, INNER, 6)
        self.pond(ox + 52, oy + 50, 34, 20)
        self.c.disc(ox + 107, oy + 107, 13, 9, SA)
        self.c.disc(ox + 107, oy + 107, 9, 6, BL)
        self.c.disc(ox + 106, oy + 106, 4, 3, SK)
        self.c.rect(ox + 106, oy + 103, 2, 4, WH)
        for bx, by in ((126, 16), (126, 60), (16, 126), (60, 126), (126, 126), (160, 160)):
            self.c.rect(ox + bx, oy + by, 28, 18, OL)
            self.c.rect(ox + bx + 1, oy + by + 1, 26, 16, GR)
            self.flowers(ox + bx + 2, oy + by + 2, 24, 14, 26)
        for bx, by in ((92, 94), (114, 94), (92, 116), (114, 116)):
            self.put(sprite(BENCH), ox + bx - 3, oy + by, shadow=0)
        spots = [(14, 20, "big"), (96, 18, "small"), (20, 92, "small"), (88, 86, "pine"), (170, 16, "big"), (200, 30, "small"),
                 (176, 70, "pine"), (204, 92, "big"), (18, 170, "big"), (46, 200, "small"), (80, 176, "pine"), (92, 208, "bush"),
                 (130, 180, "small"), (204, 150, "small"), (200, 204, "big"), (150, 208, "bush"), (8, 122, "bush"), (160, 122, "bush")]
        self.trees(spots, ox, oy)
        self.flush()

    def office_park(self, ox: int, oy: int) -> None:
        """İdari bina, önünde çeşmeli meydan ve otopark."""
        self.lawn(ox, oy, INNER, INNER)
        self.put(office(116, 20, 4, SAND), ox + 14, oy + 10)
        self.put(office(52, 16, 3, WHITE, BLUE), ox + 148, oy + 28)
        self.ground(ox + 14, oy + 66, 186, 30, SA, CO, density=120)
        self.c.disc(ox + 72, oy + 81, 12, 8, CO)
        self.c.disc(ox + 72, oy + 81, 10, 6, BL)
        self.c.disc(ox + 71, oy + 80, 4, 3, SK)
        self.flowers(ox + 100, oy + 72, 40, 18, 40)
        self.parking(ox + 10, oy + 124, 19, 2)
        self.c.rect(ox + 10, oy + 150, 191, 4, PL)
        self.trees([(8, 62, "small"), (206, 60, "big"), (150, 92, "bush"), (176, 92, "bush"), (8, 116, "bush"), (60, 118, "small"),
                    (120, 117, "small"), (180, 118, "small"), (208, 150, "pine"), (8, 204, "big"), (70, 210, "small"),
                    (134, 208, "bush"), (190, 208, "small")], ox, oy)
        self.flush()

    def silo_works(self, ox: int, oy: int) -> None:
        """Çimento / tahıl tesisi: silo dizisi, yüksek karıştırma kulesi, yığınlar, tırlar."""
        self.ground(ox, oy, INNER, INNER, SA, CO)
        self.fence(ox + 2, oy + 2, INNER - 4, INNER - 4)
        for k in range(5):
            self.put_base(silo(10, 46, WHITE if k % 2 == 0 else SKY), ox + 26 + k * 24, oy + 86)
        self.c.rect(ox + 14, oy + 22, 122, 3, PL)
        self.c.hline(ox + 14, oy + 22, 122, PU)
        self.put(hall(40, 14, 44, BRICK, SAND, doors=((12, 16, 12),)), ox + 152, oy + 32)
        pipe_h(self.c, ox + 130, oy + 56, 24)
        self.put(hall(88, 20, 14, TEAL, BRICK, doors=((8, 14, 10), (60, 14, 10))), ox + 14, oy + 100)
        self.put(mound(36, 15, SAND), ox + 120, oy + 112, shadow=1)
        self.put(mound(28, 12, SLATE), ox + 160, oy + 118, shadow=1)
        self.put(mound(24, 10, WHITE), ox + 186, oy + 112, shadow=1)
        self.ground(ox + 6, oy + 146, 203, 40, PL)
        for k in range(6):
            self.c.hline(ox + 14 + k * 34, oy + 166, 18, SA)
        self.put(colored(TRUCK, WHITE), ox + 20, oy + 149, shadow=1)
        self.put(colored(TRUCK, BRICK), ox + 96, oy + 170, shadow=1)
        self.put(colored(TRUCK, MINT), ox + 160, oy + 150, shadow=1)
        self.put_base(water_tower(), ox + 198, oy + 86)
        self.trees([(12, 208, "small"), (40, 210, "bush"), (100, 209, "small"), (150, 210, "pine"), (200, 208, "big")], ox, oy)
        self.flush()

    def workshops(self, ox: int, oy: int) -> None:
        """Atölyeler sokağı: garaj, torna atölyesi, tenteli dükkân, su kulesi, arka avlu."""
        self.lawn(ox, oy, INNER, INNER)
        self.ground(ox, oy + 84, INNER, 34, PL)
        for k in range(7):
            self.c.hline(ox + 8 + k * 30, oy + 100, 16, SA)
        self.put(hall(86, 26, 20, GREEN, BRICK, kind="hip", doors=((8, 18, 13), (32, 18, 13), (58, 18, 13)), wins=False), ox + 6, oy + 38)
        self.put(hall(58, 0, 16, SKY, SAND, kind="saw", bands=4, doors=((8, 14, 10),)), ox + 98, oy + 40)
        shop = hall(50, 22, 18, PURPLE, WHITE, wins=False)
        for i in range(2, 48, 4):
            shop.rect(i, 31, 2, 4, PI)
        shop.rect(4, 36, 14, 4, SK)
        shop.rect(22, 34, 7, 6, BR)
        shop.rect(33, 36, 13, 4, SK)
        self.put(shop, ox + 161, oy + 44)
        self.put_base(water_tower(), ox + 150, oy + 36)
        self.put(colored(TRUCK, SAND), ox + 20, oy + 88, shadow=1)
        self.put(colored(CAR_SIDE, PINK), ox + 120, oy + 104, shadow=1)
        self.put(colored(CAR_SIDE, BLUE), ox + 176, oy + 90, shadow=1)
        self.ground(ox + 8, oy + 128, 120, 80, SA, CO)
        self.fence(ox + 8, oy + 128, 120, 80)
        self.put(hall(64, 20, 14, BRICK, SAND, doors=((40, 16, 10),)), ox + 16, oy + 136)
        self.put(barrel(40, 30, 10, TEAL, BRICK, doors=((12, 16, 8),)), ox + 84, oy + 150)
        for k in range(6):
            self.put(sprite(CRATE, out=BR), ox + 18 + (k % 3) * 7, oy + 182 + (k // 3) * 6, shadow=1)
        self.put(mound(20, 9, BRICK), ox + 48, oy + 186, shadow=1)
        self.put(house(BLUE, SAND, gable=True), ox + 140, oy + 136)
        self.put(house(BRICK, WHITE), ox + 176, oy + 150)
        self.flowers(ox + 140, oy + 186, 60, 16, 30)
        self.trees([(8, 30, "big"), (60, 28, "small"), (110, 30, "pine"), (200, 34, "small"), (136, 206, "small"),
                    (168, 210, "bush"), (206, 204, "big"), (134, 132, "bush")], ox, oy)
        self.flush()

    def solar_field(self, ox: int, oy: int) -> None:
        """Güneş tarlası ve trafo merkezi."""
        self.lawn(ox, oy, INNER, INNER)
        for row in range(9):
            for col in range(7):
                self.put(solar_panel(), ox + 8 + col * 20, oy + 10 + row * 16, shadow=1)
        self.path_v(ox + 148, oy, INNER, 4)
        self.ground(ox + 158, oy + 10, 50, 86, SA, CO)
        self.fence(ox + 158, oy + 10, 50, 86, PL)
        for k in range(4):
            self.put(sprite(TRANSFORMER, out=NV), ox + 164 + (k % 2) * 22, oy + 20 + (k // 2) * 22, shadow=1)
        self.put(sprite(PYLON), ox + 166, oy + 70, shadow=1)
        self.put(sprite(PYLON), ox + 190, oy + 70, shadow=1)
        self.put(hall(44, 16, 12, TEAL, SAND, doors=((28, 10, 8),)), ox + 162, oy + 108)
        self.put(house(PURPLE, WHITE), ox + 172, oy + 168)
        self.trees([(164, 160, "small"), (206, 154, "pine"), (160, 206, "bush"), (208, 204, "big"), (6, 164, "bush"), (70, 166, "bush"), (130, 166, "bush")], ox, oy)
        self.flowers(ox + 158, oy + 198, 50, 12, 20)
        self.flush()

    def gas_works(self, ox: int, oy: int) -> None:
        """Gaz tesisi: büyük gazometre, küre tanklar, boru hatları, pompa binası."""
        self.lawn(ox, oy, INNER, INNER)
        self.ground(ox + 4, oy + 6, 207, 150, SA, CO)
        self.fence(ox + 4, oy + 6, 207, 150)
        self.put_base(tank(34, 26, TEAL, band=SK), ox + 48, oy + 98)
        for k in range(3):
            self.put_base(sphere(17, [WHITE, PINK, MINT][k]), ox + 112 + k * 40, oy + 62)
        pipe_h(self.c, ox + 86, oy + 70, 120)
        pipe_v(self.c, ox + 150, oy + 76, 34)
        self.put(hall(70, 20, 14, BLUE, BRICK, doors=((48, 14, 10),)), ox + 108, oy + 112)
        self.put_base(chimney(40, SLATE, 5), ox + 196, oy + 148)
        self.c.stamp(ox + 194, oy + 100, [".s.", "sws", "scs", ".c."])
        self.put(mound(24, 10, SLATE), ox + 14, oy + 136, shadow=1)
        self.put(colored(TRUCK, WHITE), ox + 48, oy + 138, shadow=1)
        self.put(office(64, 10, 2, SAND), ox + 10, oy + 172)
        self.parking(ox + 96, oy + 178, 10)
        self.trees([(88, 172, "small"), (206, 170, "big"), (86, 208, "bush"), (208, 210, "small")], ox, oy)
        self.flush()

    def depot(self, ox: int, oy: int) -> None:
        """Araç deposu: kepenkli uzun hangar, sıra sıra tırlar ve otobüsler, yakıt istasyonu."""
        self.ground(ox, oy, INNER, INNER, PL)
        self.put(hall(190, 30, 20, SLATE, SAND, kind="flat", doors=tuple((10 + k * 30, 20, 14) for k in range(6)), wins=False), ox + 12, oy + 8)
        for row in range(3):
            for i in range(6, INNER - 6, 10):
                self.c.hline(ox + i, oy + 84 + row * 40, 5, SA)
        mats = [BLUE, PINK, MINT, BRICK, WHITE, SAND, PURPLE]
        for k in range(6):
            self.put(colored(TRUCK, mats[k % 7]), ox + 8 + (k % 3) * 34, oy + 66 + (k // 3) * 40 + (k % 3) * 2, shadow=1)
        for k in range(4):
            self.put(colored(BUS, mats[(k + 2) % 7]), ox + 120 + (k % 2) * 46, oy + 68 + (k // 2) * 40, shadow=1)
        self.lawn(ox, oy + 150, INNER, 65)
        self.ground(ox + 8, oy + 158, 96, 50, SA, CO)
        canopy = Layer(60, 16)
        canopy.rect(0, 0, 60, 8, WH)
        canopy.hline(0, 7, 60, SK)
        canopy.hline(0, 0, 60, PI)
        canopy.hline(0, 1, 60, PI)
        for px in (6, 28, 50):
            canopy.rect(px, 8, 3, 8, PL)
        canopy.outline(NV)
        self.put(canopy, ox + 24, oy + 166)
        self.put(colored(CAR_SIDE, MINT), ox + 40, oy + 194, shadow=1)
        self.put(office(72, 10, 2, WHITE, BLUE), ox + 126, oy + 162)
        self.trees([(112, 170, "small"), (112, 206, "bush"), (206, 204, "big"), (134, 210, "small"), (170, 208, "pine")], ox, oy)
        self.flush()

    def track(self, x: int, y: int, w: int) -> None:
        """Yan hat: traversler, iki ray ve uçlarda tampon."""
        for i in range(0, w, 3):
            self.c.vline(x + i, y, 7, BR)
        self.c.hline(x, y + 1, w, WH)
        self.c.hline(x, y + 5, w, WH)
        self.c.hline(x, y + 2, w, SK)
        self.c.hline(x, y + 6, w, SK)
        for end in (x - 3, x + w):
            self.c.rect(end, y - 1, 3, 9, CO)
            self.c.vline(end + 2, y - 1, 9, BR)

    def rail_yard(self, ox: int, oy: int) -> None:
        """Yük garı: istasyon binası ve peronu, dört yan hat, vagon dizileri, lokomotifler."""
        self.ground(ox, oy, INNER, INNER, SA, CO, density=110)
        self.put(hall(104, 24, 17, PURPLE, SAND, kind="hip", doors=((44, 14, 10),)), ox + 12, oy + 8)
        self.c.rect(ox + 6, oy + 54, 150, 6, WH)
        self.c.hline(ox + 6, oy + 59, 150, SK)
        for i in range(10, 150, 6):
            self.c.set(ox + 6 + i, oy + 56, SK)
        self.put_base(water_tower(), ox + 140, oy + 46)
        self.put(mound(30, 13, SLATE), ox + 166, oy + 34, shadow=1)
        self.put(mound(20, 9, SLATE), ox + 190, oy + 42, shadow=1)
        rows = [66, 96, 126, 156]
        for ty in rows:
            self.track(ox + 10, oy + ty + 9, 196)
        mats = [BLUE, PINK, MINT, BRICK, PURPLE, WHITE, TEAL, SAND]
        trains = [
            (rows[0], 12, [("loco", TEAL), ("wagon", BLUE), ("wagon", PINK), ("hopper", SLATE), ("hopper", SLATE)]),
            (rows[1], 44, [("wagon", MINT), ("wagon", BRICK), ("wagon", WHITE), ("wagon", PURPLE), ("wagon", BLUE)]),
            (rows[2], 14, [("hopper", SLATE), ("hopper", SLATE), ("hopper", SLATE)]),
            (rows[3], 70, [("loco", BRICK), ("wagon", SAND), ("wagon", TEAL), ("wagon", PINK)]),
        ]
        for ty, start, cars in trains:
            cx = ox + start
            for kind, m in cars:
                rows_ = {"loco": LOCO, "wagon": WAGON, "hopper": HOPPER}[kind]
                layer = colored(rows_, m)
                self.put(layer, cx, oy + ty + 15 - layer.h, shadow=1)
                cx += layer.w + 2
        self.put(crane(60, 26), ox + 132, oy + 118)
        self.lawn(ox, oy + 186, INNER, 29)
        self.put(house(BRICK, SAND, gable=True), ox + 150, oy + 184)
        for k in range(5):
            self.put(sprite(CRATE, out=BR), ox + 104 + (k % 3) * 7, oy + 192 + (k // 3) * 6, shadow=1)
        self.trees([(12, 204, "small"), (36, 208, "bush"), (62, 204, "big"), (90, 210, "bush"), (190, 206, "small"), (208, 210, "pine")], ox, oy)
        self.flush()

    # -- Bütün şehir -----------------------------------------------------------

    def build(self) -> Layer:
        self.lawn(0, 0, SIZE, SIZE)
        self.roads()
        plan = [
            # satır 0 (arsanın altında görünür)
            [lambda x, y: self.housing(x, y, 1), self.park, self.office_park, self.steelworks],
            # satır 1
            [self.workshops, self.silo_works, self.solar_field, self.tank_farm],
            # satır 2
            [self.depot, lambda x, y: self.steelworks(x, y, True), self.rail_yard, self.warehouses],
            # satır 3 (arsanın üstünde görünür)
            [self.container_yard, self.housing, self.gas_works, self.power_plant],
        ]
        for row, by in enumerate(STARTS):
            for col, bx in enumerate(STARTS):
                plan[row][col](bx + SIDEWALK, by + SIDEWALK)
        self.traffic()
        self.draw_smokes()
        return self.c


def to_image(layer: Layer) -> Image.Image:
    img = Image.new("P", (layer.W, layer.H))
    flat = []
    for name in ORDER:
        value = BASE[name]
        flat += [(value >> 16) & 255, (value >> 8) & 255, value & 255]
    img.putpalette(flat + [0] * (768 - len(flat)))
    img.putdata([c for row in layer.d for c in row])
    return img


def main() -> None:
    city = City().build()
    assert all(0 <= c < 16 for row in city.d for c in row), "palet dışı piksel"
    to_image(city).save(OUT, optimize=True)
    print("Şehir arka planı yazıldı ->", OUT)


if __name__ == "__main__":
    main()
