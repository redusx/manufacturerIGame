#!/usr/bin/env python3
"""Uçuş sahnesinin gezegen yüzeylerini üretir (public/assets/flight/ground_*.png).

Çalıştırma:  python3 tools/generate_flight_ground.py   (Pillow gerekir)

Roketin kalktığı ve düştüğü zemin, içinde bulunulan menzil bölgesinin yüzeyidir:
Dünya'da çayır, çöl ve buzul; sonra Ay, Mars, asteroit kuşağı ve dış gezegenler.
Her doku yatayda kusursuz döşenen 256x64 piksellik bir şerittir. Zemin çizgisi
(roketin çarptığı seviye) üstten 16. satırdadır; tümsekler, kayalar ve kristaller bu
çizginin üstüne en çok 14 piksel taşar, yüzey hiçbir yerde çizginin altına inmez.

Kurallar docs/ART_DIRECTION.md ile aynıdır: 1px koyu kontur, sol-üstten ışık, düz
renkler ve katmanlar arasında piksel taraması (dither); bulanık geçiş yoktur.
"""

import math
from pathlib import Path
from PIL import Image

OUT_DIR = Path(__file__).resolve().parent.parent / "public" / "assets" / "flight"
W, H = 256, 64
BASE = 16          # zemin çizgisinin satırı
MAX_RISE = 14      # yüzeyin çizginin üstüne en fazla taşması


def rgb(hex_value: int) -> tuple:
    return ((hex_value >> 16) & 255, (hex_value >> 8) & 255, hex_value & 255, 255)


def mix(a: tuple, b: tuple, t: float) -> tuple:
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3)) + (255,)


CLEAR = (0, 0, 0, 0)
OUT = rgb(0x0C1020)


class Rng:
    """Tohumlu, tekrarlanabilir rastgele sayı üreteci (dokular her çalıştırmada aynı çıkar)."""

    def __init__(self, seed: int):
        self.state = seed & 0xFFFFFFFF

    def next(self) -> float:
        self.state = (self.state * 1664525 + 1013904223) & 0xFFFFFFFF
        return self.state / 4294967296

    def between(self, low: int, high: int) -> int:
        return low + int(self.next() * (high - low + 1))


def waves(parts: list, amplitude: float, base: float = 0.0) -> list:
    """Tam sayıda dalga içeren (yatayda döşenebilir) yükseklik eğrisi; 0..amplitude."""
    raw = []
    for x in range(W):
        value = 0.0
        for cycles, weight, phase in parts:
            value += weight * math.sin(2 * math.pi * cycles * x / W + phase)
        raw.append(value)
    low, high = min(raw), max(raw)
    span = (high - low) or 1.0
    return [base + (value - low) / span * amplitude for value in raw]


def stepped(heights: list, step: int) -> list:
    """Eğriyi `step` piksellik basamaklara böler: piksel sanatına uygun köşeli siluet."""
    result = []
    for x in range(W):
        anchor = (x // step) * step
        result.append(heights[anchor])
    return result


class Tile:
    def __init__(self, name: str, heights: list):
        self.name = name
        self.top = [BASE - max(0, min(MAX_RISE, round(h))) for h in heights]
        self.img = Image.new("RGBA", (W, H), CLEAR)
        self.px = self.img.load()
        # Yüzeyin üstüne oturan süslerin (kaya, kristal) pikselleri; kontur hesabına girer
        self.extra: dict = {}

    def surface(self, x: int) -> int:
        return self.top[x % W]

    def solid(self, x: int, y: int) -> bool:
        x %= W
        return y >= self.top[x] or (x, y) in self.extra

    # -- Zemin gövdesi ------------------------------------------------------

    def fill(self, bands: list, cliff_light: tuple, cliff_dark: tuple) -> None:
        """`bands`: (kalınlık, renk) listesi, yüzeyden aşağı doğru. Son bant dibe kadar sürer."""
        for x in range(W):
            top = self.top[x]
            for y in range(top, H):
                depth = y - top
                self.px[x, y] = self.band_color(bands, x, y, depth)
            # Sola bakan yamaç ışık alır, sağa bakan gölgede kalır
            left, right = self.surface(x - 1), self.surface(x + 1)
            if left > top + 1:
                for y in range(top + 1, min(left, H)):
                    self.px[x, y] = cliff_light
            if right > top + 1:
                for y in range(top + 1, min(right, H)):
                    self.px[x, y] = cliff_dark

    @staticmethod
    def band_color(bands: list, x: int, y: int, depth: int) -> tuple:
        start = 0
        for index, (thickness, color) in enumerate(bands):
            end = start + thickness
            last = index == len(bands) - 1
            if depth < end or last:
                # Bandın son iki satırı bir sonraki renkle taranır (dither)
                if not last and depth >= end - 2 and (x + y) % 2 == 0:
                    return bands[index + 1][1]
                return color
            start = end
        return bands[-1][1]

    # -- Süsler -------------------------------------------------------------

    def put(self, x: int, y: int, color: tuple) -> None:
        if 0 <= y < H:
            self.px[x % W, y] = color

    def stamp(self, x: int, y: int, color: tuple) -> None:
        """Yüzeyin üstünde duran bir süs pikseli (konturu sonradan çizilir)."""
        if 0 <= y < H:
            self.extra[(x % W, y)] = color

    def blob(self, cx: int, cy: int, rx: int, ry: int, light: tuple, mid: tuple, dark: tuple) -> None:
        """Zeminin içine gömülü çakıl/kaya: konturlu, sol üstü açık, sağ altı koyu."""
        for dy in range(-ry - 1, ry + 2):
            for dx in range(-rx - 1, rx + 2):
                inside = (dx / (rx + 0.3)) ** 2 + (dy / (ry + 0.3)) ** 2 <= 1
                ring = (dx / (rx + 1.3)) ** 2 + (dy / (ry + 1.3)) ** 2 <= 1
                y = cy + dy
                if y <= self.surface(cx + dx) + 1:
                    continue
                if inside:
                    color = light if dx + dy < -1 else dark if dx + dy > 1 else mid
                    self.put(cx + dx, y, color)
                elif ring:
                    self.put(cx + dx, y, OUT)

    def boulder(self, cx: int, width: int, height: int, light: tuple, mid: tuple, dark: tuple) -> None:
        """Yüzeyin üstünde duran yuvarlak kaya."""
        base = max(self.surface(cx + dx) for dx in range(-width // 2, width // 2 + 1))
        for dx in range(-width // 2, width // 2 + 1):
            edge = abs(dx) / (width / 2 + 0.01)
            column = max(1, round(height * math.sqrt(max(0.0, 1 - edge * edge))))
            for step in range(column):
                y = base - 1 - step
                shade = light if dx < 0 and step >= column - 2 else dark if dx > width // 4 else mid
                self.stamp(cx + dx, y, shade)
            for y in range(base, self.surface(cx + dx)):
                self.stamp(cx + dx, y, dark)

    def spike(self, cx: int, width: int, height: int, light: tuple, dark: tuple, lean: int = 0) -> None:
        """Kristal / buz sivrisi: sol yüzü açık, sağ yüzü koyu üçgen."""
        base = max(self.surface(cx + dx) for dx in range(-width // 2, width // 2 + 1))
        for step in range(height):
            y = base - 1 - step
            half = (width / 2) * (1 - step / height)
            center = cx + round(lean * step / height)
            for dx in range(-math.ceil(half), math.ceil(half) + 1):
                if abs(dx) <= half:
                    self.stamp(center + dx, y, light if dx <= 0 else dark)
        for dx in range(-width // 2, width // 2 + 1):
            for y in range(base, self.surface(cx + dx)):
                self.stamp(cx + dx, y, dark)

    def block(self, x0: int, width: int, height: int, light: tuple, mid: tuple, dark: tuple) -> None:
        """Köşeli buz/kaya bloğu."""
        base = max(self.surface(x0 + dx) for dx in range(width))
        for dx in range(width):
            for step in range(height):
                y = base - 1 - step
                shade = light if step == height - 1 or dx == 0 else dark if dx == width - 1 else mid
                self.stamp(x0 + dx, y, shade)
            for y in range(base, self.surface(x0 + dx)):
                self.stamp(x0 + dx, y, dark)

    def tuft(self, x: int, light: tuple, dark: tuple, tall: bool) -> None:
        """Ot öbeği: yüzeyin üstünde bir-iki piksellik yapraklar (konturlanmaz)."""
        top = self.surface(x)
        self.put(x, top - 1, light)
        if tall:
            self.put(x, top - 2, light)
            self.put(x + 1, top - 1, dark)

    def finish(self, highlight: tuple) -> Image.Image:
        """Süsleri basar, havaya değen her pikseli kontura, hemen altını vurguya çevirir."""
        for (x, y), color in self.extra.items():
            self.px[x, y] = color
        edges = []
        for x in range(W):
            for y in range(H):
                if not self.solid(x, y):
                    continue
                air = (
                    not self.solid(x, y - 1)
                    or not self.solid(x - 1, y)
                    or not self.solid(x + 1, y)
                )
                if air:
                    edges.append((x, y))
        for x, y in edges:
            self.px[x, y] = OUT
        # Üstten ışık: konturun hemen altındaki zemin pikseli açık renk
        edge_set = set(edges)
        for x, y in edges:
            below = (x, y + 1)
            if y + 1 < H and below not in edge_set and (x, y + 1) not in self.extra and not self.solid(x, y - 1):
                self.px[x, y + 1] = highlight
        return self.img


# ---------------------------------------------------------------------------
# YÜZEYLER
# ---------------------------------------------------------------------------


def earth_field() -> Image.Image:
    """Çayır: yumuşak tepeler, çimen, toprağın içinde çakıllar."""
    rng = Rng(11)
    heights = stepped(waves([(2, 1.0, 0.4), (5, 0.5, 1.9), (9, 0.2, 0.2)], 6, 1), 2)
    tile = Tile("field", heights)
    g_hi, g_mid, g_dark = rgb(0x82E0AA), rgb(0x2ECC71), rgb(0x1E8449)
    s_hi, s_mid, s_dark, s_deep = rgb(0x8A5A3C), rgb(0x6B452F), rgb(0x5A3A2A), rgb(0x3A2519)
    tile.fill([(4, g_mid), (3, g_dark), (10, s_hi), (12, s_mid), (12, s_dark), (99, s_deep)], g_hi, g_dark)
    for _ in range(14):
        tile.blob(rng.between(0, W - 1), rng.between(BASE + 14, H - 6), rng.between(1, 3), rng.between(1, 2),
                  rgb(0xA4B0C8), rgb(0x66779B), rgb(0x3D4E7A))
    for x in range(0, W, 5):
        if rng.next() < 0.7:
            tile.tuft(x + rng.between(0, 3), g_hi, g_mid, rng.next() < 0.4)
    return tile.finish(g_hi)


def earth_desert() -> Image.Image:
    """Çöl: rüzgârın yığdığı kumullar ve tek tük kayalar."""
    rng = Rng(23)
    dunes = [abs(math.sin(math.pi * 3 * x / W + 0.3)) ** 0.7 for x in range(W)]
    ripple = waves([(11, 1.0, 0.0)], 1.5)
    heights = [1 + dunes[x] * 9 + ripple[x] for x in range(W)]
    tile = Tile("desert", heights)
    hi, mid, dark, deep = rgb(0xFFF0C2), rgb(0xFFD166), rgb(0xD9A441), rgb(0xA8782A)
    rock_hi, rock_mid, rock_dark = rgb(0xC98F1A), rgb(0x8A5A3C), rgb(0x5A3A2A)
    tile.fill([(6, mid), (10, dark), (14, deep), (99, rgb(0x7A5320))], hi, dark)
    # Rüzgâr izleri: yüzeye paralel kesik çizgiler
    for x in range(W):
        top = tile.surface(x)
        if (x // 6) % 2 == 0:
            tile.put(x, top + 8, deep)
        if (x // 9) % 2 == 1:
            tile.put(x, top + 19, rgb(0x7A5320))
    for cx in (38, 121, 203):
        tile.boulder(cx + rng.between(-6, 6), rng.between(7, 11), rng.between(4, 6), rock_hi, rock_mid, rock_dark)
    return tile.finish(hi)


def earth_ice() -> Image.Image:
    """Buzul: basamaklı buz tabakaları, çatlaklar ve kar."""
    rng = Rng(37)
    heights = []
    x = 0
    while x < W:
        width = rng.between(10, 22)
        level = rng.between(1, 4) * 2
        heights.extend([level] * width)
        x += width
    heights = heights[:W]
    # Döşenebilirlik: son blok ilk blokla aynı seviyede biter
    for index in range(W - 8, W):
        heights[index] = heights[0]
    tile = Tile("ice", heights)
    snow, ice_hi, ice_mid, ice_dark, deep = rgb(0xFFFFFF), rgb(0xDDE4F0), rgb(0xA6D8F4), rgb(0x5FA8D8), rgb(0x2F6E9E)
    tile.fill([(3, snow), (6, ice_hi), (12, ice_mid), (12, ice_dark), (99, deep)], snow, ice_dark)
    for _ in range(9):
        cx = rng.between(4, W - 5)
        top = tile.surface(cx)
        length = rng.between(8, 18)
        for step in range(length):
            tile.put(cx + (step // 4) * (1 if step % 8 < 4 else -1), top + 3 + step, deep)
    for cx in (60, 150, 226):
        tile.block(cx, rng.between(6, 9), rng.between(3, 5), snow, ice_hi, ice_dark)
    return tile.finish(snow)


def moon() -> Image.Image:
    """Ay: gri toz, kenarı kabarık kraterler ve kaya parçaları."""
    rng = Rng(53)
    base = waves([(3, 1.0, 1.1), (7, 0.4, 0.5)], 3, 4)
    craters = [(34, 15), (112, 22), (171, 11), (222, 17)]
    heights = list(base)
    floor = set()
    for center, radius in craters:
        for dx in range(-radius - 3, radius + 4):
            x = (center + dx) % W
            distance = abs(dx)
            if distance <= radius - 2:
                heights[x] = 1 + (distance / radius) ** 2 * 2     # çukur
                floor.add(x)
            elif distance <= radius + 2:
                heights[x] = base[x] + 3 - abs(distance - radius)   # kabarık kenar
    tile = Tile("moon", stepped(heights, 2))
    hi, mid, dark, deep, pit = rgb(0xDDE4F0), rgb(0xA4B0C8), rgb(0x7C879E), rgb(0x4F5A72), rgb(0x3D4660)
    tile.fill([(5, mid), (9, dark), (14, deep), (99, pit)], hi, dark)
    # Krater tabanı gölgede kalır
    for x in sorted(floor):
        top = tile.surface(x)
        for depth in range(1, 4):
            tile.put(x, top + depth, dark if depth < 3 else deep)
    for _ in range(16):
        tile.blob(rng.between(0, W - 1), rng.between(BASE + 12, H - 5), rng.between(2, 4), rng.between(1, 2),
                  mid, dark, pit)
    for cx in (78, 198):
        tile.boulder(cx, rng.between(6, 9), rng.between(3, 5), hi, mid, deep)
    return tile.finish(hi)


def mars() -> Image.Image:
    """Mars: pas rengi kumullar, sivri kayalar ve koyu katmanlar."""
    rng = Rng(71)
    heights = stepped(waves([(2, 1.0, 2.0), (6, 0.6, 0.7), (13, 0.25, 1.3)], 8, 1), 3)
    tile = Tile("mars", heights)
    hi, mid, dark, deep, core = rgb(0xF29488), rgb(0xD9603F), rgb(0xA5281B), rgb(0x7A2318), rgb(0x4E1A14)
    rock_hi, rock_mid, rock_dark = rgb(0xC0621A), rgb(0x8A3A22), rgb(0x4E1A14)
    tile.fill([(5, mid), (8, dark), (10, deep), (6, dark), (99, core)], hi, deep)
    for _ in range(12):
        tile.blob(rng.between(0, W - 1), rng.between(BASE + 12, H - 5), rng.between(2, 4), rng.between(1, 3),
                  rock_hi, rock_mid, rock_dark)
    for cx in (24, 96, 141, 215):
        tile.spike(cx + rng.between(-5, 5), rng.between(7, 10), rng.between(5, 9), rock_hi, rock_dark, rng.between(-2, 2))
    return tile.finish(hi)


def asteroid() -> Image.Image:
    """Asteroit: keskin, kırık kaya ve parlayan cevher damarları."""
    rng = Rng(97)
    heights = []
    x = 0
    while x < W:
        width = rng.between(4, 9)
        heights.extend([rng.between(1, 11)] * width)
        x += width
    heights = heights[:W]
    for index in range(W - 6, W):
        heights[index] = heights[0]
    tile = Tile("asteroid", heights)
    hi, top, mid, dark, deep = rgb(0xA4B0C8), rgb(0x66779B), rgb(0x3D4E7A), rgb(0x242F4C), rgb(0x1A2238)
    ore_hi, ore = rgb(0xFFD166), rgb(0xF39C12)
    tile.fill([(5, top), (9, mid), (12, dark), (99, deep)], hi, dark)
    for _ in range(10):
        cx = rng.between(0, W - 1)
        cy = rng.between(BASE + 6, H - 6)
        for step in range(rng.between(3, 7)):
            tile.put(cx + step, cy + step // 2, ore_hi if step % 3 == 0 else ore)
    for _ in range(10):
        tile.blob(rng.between(0, W - 1), rng.between(BASE + 14, H - 5), rng.between(2, 5), rng.between(1, 3),
                  top, mid, deep)
    return tile.finish(hi)


def jupiter() -> Image.Image:
    """Jüpiter: kabarık bulut tepeleri ve yatay gaz kuşakları."""
    rng = Rng(113)
    heights = [1.0] * W
    x = 0
    while x < W:
        radius = rng.between(7, 14)
        center = x + radius
        for dx in range(-radius, radius + 1):
            column = (center + dx) % W
            rise = math.sqrt(max(0, radius * radius - dx * dx)) * 0.75
            heights[column] = max(heights[column], 1 + rise)
        x += radius * 2 - rng.between(2, 5)
    tile = Tile("jupiter", heights)
    cream, sand, orange, rust, brown = rgb(0xFFF0C2), rgb(0xF4C98A), rgb(0xF4A261), rgb(0xC0621A), rgb(0x8A5A3C)
    tile.fill([(5, cream), (6, sand), (5, orange), (6, sand), (7, rust), (6, orange), (99, brown)], cream, sand)
    # Kuşakların içinde girdap çizgileri
    for row, color in ((BASE + 10, cream), (BASE + 22, brown), (BASE + 34, cream)):
        for x in range(W):
            if (x // 7 + row) % 3 == 0:
                tile.put(x, row + round(math.sin(2 * math.pi * 4 * x / W) * 1.5), color)
    return tile.finish(rgb(0xFFFFFF))


def saturn() -> Image.Image:
    """Satürn halkaları: açık altın buz tozu ve köşeli buz blokları."""
    rng = Rng(131)
    heights = stepped(waves([(4, 1.0, 0.9), (9, 0.4, 2.2)], 4, 1), 4)
    tile = Tile("saturn", heights)
    hi, mid, dark, deep, core = rgb(0xFFF0C2), rgb(0xE8D29A), rgb(0xC9A86A), rgb(0x9A7A48), rgb(0x6E5532)
    ice_hi, ice_mid, ice_dark = rgb(0xFFFFFF), rgb(0xDDE4F0), rgb(0xA4B0C8)
    tile.fill([(4, mid), (4, dark), (3, mid), (8, dark), (4, deep), (4, dark), (99, core)], hi, dark)
    x = 8
    rounded = True
    while x < W - 14:
        width = rng.between(7, 12)
        if rounded:
            tile.boulder(x + width // 2, width, rng.between(4, 7), ice_hi, ice_mid, ice_dark)
        else:
            tile.block(x, width, rng.between(4, 8), ice_hi, ice_mid, ice_dark)
        rounded = not rounded
        x += width + rng.between(10, 24)
    for _ in range(12):
        tile.blob(rng.between(0, W - 1), rng.between(BASE + 12, H - 5), rng.between(1, 3), rng.between(1, 2),
                  ice_mid, ice_dark, deep)
    return tile.finish(hi)


def uranus() -> Image.Image:
    """Uranüs: camgöbeği buz sırtları ve kristal sivrileri."""
    rng = Rng(151)
    heights = stepped(waves([(3, 1.0, 0.2), (8, 0.35, 1.4)], 5, 1), 2)
    tile = Tile("uranus", heights)
    hi, mid, dark, deep, core = rgb(0xE3FBFB), rgb(0xA6F4F4), rgb(0x4FD1D1), rgb(0x01898A), rgb(0x035F66)
    tile.fill([(4, mid), (8, dark), (12, deep), (99, core)], hi, deep)
    for x in range(W):
        top = tile.surface(x)
        if (x // 5) % 3 == 0:
            tile.put(x, top + 6, mid)
    x = 10
    while x < W - 8:
        tile.spike(x, rng.between(7, 10), rng.between(7, 13), hi, dark, rng.between(-2, 2))
        x += rng.between(18, 36)
    return tile.finish(hi)


def neptune() -> Image.Image:
    """Neptün: koyu mavi buz dalgaları, kırağı ve uzun buz iğneleri."""
    rng = Rng(173)
    heights = stepped(waves([(4, 1.0, 1.7), (10, 0.5, 0.3)], 6, 1), 2)
    tile = Tile("neptune", heights)
    frost, hi, mid, dark, deep = rgb(0xDDE4F0), rgb(0x8FB8F5), rgb(0x3B7DDD), rgb(0x234E96), rgb(0x152C5E)
    tile.fill([(3, hi), (7, mid), (12, dark), (99, deep)], frost, dark)
    for _ in range(40):
        tile.put(rng.between(0, W - 1), rng.between(BASE + 8, H - 4), hi)
    x = 14
    while x < W - 6:
        tile.spike(x, rng.between(6, 8), rng.between(9, 13), frost, mid, rng.between(-1, 1))
        x += rng.between(16, 32)
    return tile.finish(frost)


SURFACES = {
    "field": earth_field,
    "desert": earth_desert,
    "ice": earth_ice,
    "moon": moon,
    "mars": mars,
    "asteroid": asteroid,
    "jupiter": jupiter,
    "saturn": saturn,
    "uranus": uranus,
    "neptune": neptune,
}


def main() -> None:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    for name, build in SURFACES.items():
        build().save(OUT_DIR / f"ground_{name}.png")
    print(f"{len(SURFACES)} yüzey dokusu yazıldı -> {OUT_DIR}")


if __name__ == "__main__":
    main()
