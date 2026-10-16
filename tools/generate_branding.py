"""Yayın görselleri: 512x512 kare ikon ve 1920x1080 yatay banner (branding/).

Görseller oyunun kendi sprite'larından (public/assets) ve 16 renkli paletten
(tools/palette.py) çizilir; düşük çözünürlükte üretilip tam sayı katla büyütülür:
  ikon   64x64   x8 -> 512x512
  banner 320x180 x6 -> 1920x1080
Böylece her "piksel" kare ve aynı boyutta kalır, oyun içi çizimle tutarlıdır.
Oyun kodunu ve oyun içi varlıkları değiştirmez.

Çalıştırma: python3 tools/generate_branding.py
"""

from pathlib import Path
from PIL import Image

from palette import BASE, TONE, mix

ROOT = Path(__file__).resolve().parent.parent
ASSETS = ROOT / "public" / "assets"
OUT = ROOT / "branding"

TITLE = "ORE TO ORBIT"
# Başlangıç roketi (Sv.1): kırmızı-beyaz, küçük boyutta en kolay tanınan biçim
ROCKET_TIER = 1


def rgba(c: int, a: int = 255) -> tuple:
    return ((c >> 16) & 255, (c >> 8) & 255, c & 255, a)


B = {k: rgba(v) for k, v in BASE.items()}
NIGHT_DEEP = rgba(TONE["night_deep"])
NIGHT = rgba(TONE["night"])
LILAC = rgba(TONE["lilac"])
MIST = rgba(TONE["mist"])
CREAM = rgba(TONE["cream"])
TAN_DARK = rgba(TONE["tan_dark"])


class Rng:
    """Tekrarlanabilir küçük rastgele üreteç (her çalıştırmada aynı görsel)."""

    def __init__(self, seed: int):
        self.s = seed

    def next(self) -> float:
        self.s = (self.s * 1103515245 + 12345) & 0x7FFFFFFF
        return self.s / 0x7FFFFFFF

    def between(self, lo: int, hi: int) -> int:
        return lo + int(self.next() * (hi - lo + 1))


def sprite(name: str, frame_w: int | None = None) -> Image.Image:
    im = Image.open(ASSETS / name).convert("RGBA")
    if frame_w is not None:
        im = im.crop((0, 0, frame_w, im.height))
    return im


def put(img: Image.Image, im: Image.Image, x: int, y: int) -> None:
    img.alpha_composite(im, (int(x), int(y)))


def rect(img, x, y, w, h, c):
    for yy in range(max(0, y), min(img.height, y + h)):
        for xx in range(max(0, x), min(img.width, x + w)):
            img.putpixel((xx, yy), c)


def disc(img, cx, cy, r, c):
    for yy in range(int(cy - r) - 1, int(cy + r) + 2):
        for xx in range(int(cx - r) - 1, int(cx + r) + 2):
            if 0 <= xx < img.width and 0 <= yy < img.height and (xx - cx + 0.5) ** 2 + (yy - cy + 0.5) ** 2 <= r * r:
                img.putpixel((xx, yy), c)


def outline(im: Image.Image, c: tuple) -> Image.Image:
    """Saydam olmayan piksellerin çevresine 1 piksellik kontur ekler (oyundaki sprite'lar gibi)."""
    w, h = im.size
    out = Image.new("RGBA", (w + 2, h + 2), (0, 0, 0, 0))
    src = im.load()
    o = out.load()
    for y in range(h):
        for x in range(w):
            if src[x, y][3] > 0:
                for dx in (-1, 0, 1):
                    for dy in (-1, 0, 1):
                        o[x + 1 + dx, y + 1 + dy] = c
    out.alpha_composite(im, (1, 1))
    return out


def sky(img: Image.Image, bands: list, top: int, bottom: int) -> None:
    """Gökyüzü: renk bantları arasında satranç taşı geçişi (paletten çıkmadan degrade)."""
    n = len(bands) - 1
    span = (bottom - top) / n
    for y in range(top, bottom):
        t = (y - top) / span
        i = min(int(t), n - 1)
        f = t - i
        for x in range(img.width):
            # Geçiş bölgesinde iki renk dama deseniyle karışır
            use_next = f > 0.66 or (f > 0.33 and (x + y) % 2 == 0)
            img.putpixel((x, y), bands[i + 1] if use_next else bands[i])


def stars(img, rng: Rng, count: int, top: int, bottom: int, avoid=None):
    for _ in range(count):
        x, y = rng.between(1, img.width - 2), rng.between(top, bottom)
        if avoid and avoid(x, y):
            continue
        if rng.next() < 0.18:
            for dx, dy in ((0, 0), (1, 0), (-1, 0), (0, 1), (0, -1)):
                img.putpixel((x + dx, y + dy), B["sky"] if (dx or dy) else B["white"])
        else:
            img.putpixel((x, y), B["white"] if rng.next() < 0.5 else B["sky"])


def rocket_vertical() -> Image.Image:
    """Oyundaki roketle aynı parçalar (RocketIcon.ts yerleşimi), burnu yukarı çevrilmiş."""
    canvas = Image.new("RGBA", (34, 20), (0, 0, 0, 0))

    def part(prefix: str, offset_x: int) -> None:
        im = sprite(f"{prefix}{ROCKET_TIER}.png")
        canvas.alpha_composite(im, (16 + offset_x - im.width // 2, 10 - im.height // 2))

    part("rocket_engine_", -7)
    part("rocket_tank_", -2)
    part("rocket_wings_", -3)
    part("rocket_hull_", 1)
    return canvas.transpose(Image.Transpose.ROTATE_90)


# Nitro alevinin (mavi) ateş tonlarına çevrilmiş hali: fırlatma alevi sıcak renktedir
FLAME_WARM = {
    (0, 240, 255, 255): B["sand"],
    (0, 168, 255, 255): B["copper"],
    (9, 132, 227, 255): B["brown"],
}


def flame_down() -> Image.Image:
    im = sprite("flame_boost.png")
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            if px[x, y] in FLAME_WARM:
                px[x, y] = FLAME_WARM[px[x, y]]
    return im.transpose(Image.Transpose.ROTATE_90)


def launch(img: Image.Image, cx: int, nose_y: int, outlined: bool = False) -> int:
    """Roket ve alevi: alevin üst ucu motorun hemen altına oturur. Alevin alt ucunu döner."""
    rocket = rocket_vertical()
    if outlined:
        rocket = outline(rocket, B["umber"])
    box = rocket.getbbox()
    flame = flame_down()
    fbox = flame.getbbox()
    rx = cx - rocket.width // 2
    ry = nose_y - box[1]
    flame_y = ry + box[3] - 2 - fbox[1]
    put(img, flame, cx - flame.width // 2, flame_y)
    put(img, rocket, rx, ry)
    return flame_y + fbox[3]


def smoke(img, rng: Rng, cx: int, top: int, bottom: int, spread: float):
    """Fırlatma dumanı: aşağı indikçe genişleyen beyaz-gri bulut öbekleri."""
    y = bottom
    while y > top:
        k = (y - top) / max(1, bottom - top)
        r = 2 + k * spread
        for _ in range(2):
            ox = rng.between(-int(r), int(r))
            disc(img, cx + ox, y, r, MIST)
            disc(img, cx + ox - 1, y - 1, max(1, r - 1.5), B["white"])
        y -= max(2, int(r * 0.9))


def hall(w: int, h: int, teeth: int) -> Image.Image:
    """Yandan fabrika holü: testere dişi çatı, mavi camlı üst cephe, bakır-kahve taban."""
    roof_h = 7
    im = Image.new("RGBA", (w, h + roof_h), (0, 0, 0, 0))
    tw = w // teeth
    for i in range(teeth):
        x0 = i * tw
        for yy in range(roof_h):
            run = int((roof_h - yy) / roof_h * tw)
            for xx in range(x0 + tw - run, x0 + tw):
                im.putpixel((xx, yy), B["sky"] if xx == x0 + tw - run else B["blue"])
            im.putpixel((x0 + tw - 1, yy), B["teal"])
    body_top = roof_h
    rect(im, 0, body_top, w, h, B["copper"])
    # mavi cam şeritleri
    for row in range(3):
        y = body_top + 2 + row * 4
        rect(im, 1, y, w - 2, 3, B["blue"])
        for x in range(2, w - 2, 4):
            im.putpixel((x, y), B["sky"])
        rect(im, 1, y + 3, w - 2, 1, B["teal"])
    base_y = body_top + 14
    rect(im, 0, base_y, w, h - 14, B["copper"])
    rect(im, 0, base_y, w, 1, B["sand"])
    for x in range(3, w - 3, 6):
        rect(im, x, base_y + 3, 2, 2, B["sky"])
    # kepenkli kapılar
    for x in (w // 4 - 6, (3 * w) // 4 - 6):
        rect(im, x, h + roof_h - 10, 12, 10, B["umber"])
        for yy in range(h + roof_h - 9, h + roof_h, 2):
            rect(im, x + 1, yy, 10, 1, B["plum"])
    rect(im, 0, h + roof_h - 1, w, 1, B["brown"])
    return outline(im, B["umber"])


def mini_hall(w: int, teeth: int) -> Image.Image:
    """İkon için sade hol: 4 piksellik testere dişi çatı, tek cam şerit, iki kapı."""
    roof_h, body_h = 4, 9
    im = Image.new("RGBA", (w, roof_h + body_h), (0, 0, 0, 0))
    tw = w // teeth
    for i in range(teeth):
        x0 = i * tw
        for yy in range(roof_h):
            run = max(1, int((roof_h - yy) / roof_h * tw))
            rect(im, x0 + tw - run, yy, run, 1, B["blue"])
            im.putpixel((x0 + tw - run, yy), B["sky"])
    rect(im, 0, roof_h, w, body_h, B["copper"])
    rect(im, 0, roof_h, w, 3, B["blue"])
    for x in range(1, w - 1, 3):
        im.putpixel((x, roof_h + 1), B["sky"])
    rect(im, 0, roof_h + 3, w, 1, B["sand"])
    for x in (w // 4 - 3, (3 * w) // 4 - 3):
        rect(im, x, roof_h + body_h - 4, 6, 4, B["umber"])
        rect(im, x + 1, roof_h + body_h - 3, 4, 1, B["plum"])
    return outline(im, B["umber"])


def chimney(h: int) -> Image.Image:
    im = Image.new("RGBA", (5, h), (0, 0, 0, 0))
    rect(im, 0, 0, 5, h, B["brown"])
    rect(im, 1, 0, 1, h, B["copper"])
    for y in (2, 6):
        rect(im, 0, y, 5, 2, B["white"])
    return outline(im, B["umber"])


def tank_side(w: int, h: int) -> Image.Image:
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rect(im, 0, 2, w, h - 2, B["brown"])
    rect(im, 1, 0, w - 2, 2, B["copper"])
    rect(im, 2, 2, 2, h - 2, B["copper"])
    rect(im, 0, h // 2, w, 1, B["umber"])
    return outline(im, B["umber"])


def silo(w: int, h: int) -> Image.Image:
    im = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    rect(im, 0, 3, w, h - 3, B["white"])
    for y in range(3):
        rect(im, y, y, w - 2 * y, 1, B["white"])
    rect(im, w - 2, 3, 2, h - 3, MIST)
    return outline(im, B["umber"])


# ---- Pikselli yazı (5x7 harf ızgarası) -------------------------------------------
GLYPHS = {
    "O": ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    "R": ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    "E": ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    "T": ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    "B": ["11110", "10001", "10001", "11110", "10001", "10001", "11110"],
    "I": ["11111", "00100", "00100", "00100", "00100", "00100", "11111"],
    " ": ["000", "000", "000", "000", "000", "000", "000"],
}


def title(text: str, cell: int) -> Image.Image:
    """Oyun adı: kum dolgu, alt satırları bakır (ışık üstten), koyu kontur ve gölge."""
    widths = [len(GLYPHS[ch][0]) for ch in text]
    w = (sum(widths) + len(text) - 1) * cell
    h = 7 * cell
    fill = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    x = 0
    for ch in text:
        rows = GLYPHS[ch]
        for gy, row in enumerate(rows):
            for gx, bit in enumerate(row):
                if bit == "1":
                    c = B["sand"] if gy < 4 else (B["copper"] if gy < 6 else B["brown"])
                    if gy == 0:
                        c = CREAM
                    rect(fill, x + gx * cell, gy * cell, cell, cell, c)
        x += (len(rows[0]) + 1) * cell
    thick = outline(outline(fill, B["umber"]), B["umber"])
    out = Image.new("RGBA", (thick.width + 2, thick.height + 3), (0, 0, 0, 0))
    shadow = Image.new("RGBA", thick.size, (0, 0, 0, 0))
    shadow.paste(Image.new("RGBA", thick.size, B["black"]), (0, 0), thick)
    out.alpha_composite(shadow, (2, 3))
    out.alpha_composite(thick, (0, 0))
    return out


def ring_planet(img, cx: int, cy: int) -> None:
    """Halkalı gezegen: halkanın arka yarısı gezegenin arkasında, ön yarısı önünde kalır."""
    r = 12

    def ring(front: bool) -> None:
        for x in range(cx - 22, cx + 23):
            t = (x - cx) / 22
            if abs(t) > 1:
                continue
            dy = (1 - t * t) ** 0.5 * 4
            y = cy + round(t * 3)
            for yy, c in ((y + round(dy), B["sand"]), (y + round(dy) + 1, B["copper"])) if front else ((y - round(dy), B["copper"]),):
                img.putpixel((x, yy), c)

    ring(False)
    disc(img, cx, cy, r, B["purple"])
    disc(img, cx - 2, cy - 2, r - 3, B["pink"])
    disc(img, cx + 3, cy + 3, r - 7, B["purple"])
    ring(True)


def title_lines(lines: list, cell: int, gap: int = 3) -> Image.Image:
    """Birden çok satırlı oyun adı: satırlar ortalanır (dar kapaklar için)."""
    parts = [title(line, cell) for line in lines]
    w = max(p.width for p in parts)
    h = sum(p.height for p in parts) + gap * (len(parts) - 1)
    out = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    y = 0
    for part in parts:
        out.alpha_composite(part, ((w - part.width) // 2, y))
        y += part.height + gap
    return out


def gear(r_out: int, r_in: int, teeth: int, c: tuple, hole: tuple) -> Image.Image:
    import math

    size = 2 * r_out + 4
    im = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cx = cy = size / 2
    for y in range(size):
        for x in range(size):
            dx, dy = x + 0.5 - cx, y + 0.5 - cy
            d = math.hypot(dx, dy)
            a = (math.atan2(dy, dx) / (2 * math.pi)) * teeth
            tooth = (a - math.floor(a)) < 0.5
            if d <= r_in or (d <= r_out and tooth):
                im.putpixel((x, y), c)
            if d <= r_in * 0.42:
                im.putpixel((x, y), hole)
    return im


# ---- Banner ------------------------------------------------------------------------------
def banner() -> Image.Image:
    W, H = 320, 180
    img = Image.new("RGBA", (W, H), B["navy"])
    rng = Rng(7)
    horizon = 132
    sky(img, [B["navy"], NIGHT_DEEP, NIGHT, B["plum"], LILAC], 0, horizon)
    stars(img, rng, 140, 2, 100)

    # Hedef: halkalı gezegen (seferlerin sonu); adın altında, roketin solunda
    ring_planet(img, 200, 90)
    # Uzak şehir silueti
    x = 0
    while x < W:
        bw, bh = rng.between(8, 22), rng.between(6, 22)
        rect(img, x, horizon - bh, bw, bh, NIGHT_DEEP)
        for wy in range(horizon - bh + 2, horizon - 1, 3):
            for wx in range(x + 2, x + bw - 2, 3):
                if rng.next() < 0.25:
                    img.putpixel((wx, wy), B["sand"])
        x += bw
    rect(img, 0, horizon - 1, W, 2, NIGHT_DEEP)

    # Zemin: uçuş sahnesindeki çayır ve cevherli toprak ("ore")
    ground = sprite("flight/ground_field.png")
    ground_top = 146
    for gx in range(0, W, ground.width):
        put(img, ground.crop((0, 0, ground.width, H - ground_top + 4)), gx, ground_top - 4)
    rect(img, 0, horizon + 1, W, ground_top - horizon - 3, B["olive"])
    rect(img, 0, horizon + 1, W, 1, B["green"])

    # Fabrika: baca dumanı, bacalar, hol, tank ve silolar
    smoke_rng = Rng(3)
    for cx in (40, 58):
        # Duman ortadaki adın altında kalır
        for i in range(3):
            disc(img, cx + i * 3 + smoke_rng.between(-1, 1), 70 - i * 6, 2.2 + i * 0.6, MIST)
            disc(img, cx + i * 3 - 1, 69 - i * 6, 1.4 + i * 0.5, B["white"])
    put(img, chimney(26), 37, 72)
    put(img, chimney(22), 55, 76)
    put(img, hall(118, 40, 6), 8, 98)
    put(img, tank_side(16, 26), 128, 118)
    put(img, silo(9, 30), 146, 114)
    put(img, silo(9, 30), 156, 114)

    # Üretim hattı: kırıcı -> bant (cevherden motora eşyalar) -> rampa
    belt = sprite("conveyor_belt.png")
    belt_y = ground_top - belt.height + 3
    for bx in range(196, 256, belt.width - 2):
        put(img, belt.crop((0, 0, min(belt.width, 256 - bx), belt.height)), bx, belt_y)
    for i, name in enumerate(["iron_ore", "iron_ingot", "steel_gear", "electric_motor"]):
        put(img, sprite(f"items/{name}.png"), 200 + i * 13, belt_y - 9)
    crusher = sprite("machines/crusher.png", 32)
    put(img, crusher, 168, ground_top - crusher.height + 3)

    # Fırlatma: rampa, kalkış dumanı, roket ve alevi
    pad = sprite("launch_pads/launch_pad_8.png")
    pad_x, pad_y = 256, ground_top - pad.height + 4
    put(img, pad, pad_x, pad_y)
    flame_end = launch(img, 279, 40)
    # İnce egzoz izi: alevin ucundan rampaya doğru genişleyen duman
    y, i = flame_end + 2, 0
    while y < ground_top - 8:
        r = 1.2 + (y - flame_end) / 18
        disc(img, 279 + (1 if i % 2 else -1), y, r, MIST)
        disc(img, 278 + (1 if i % 2 else -1), y - 1, max(0.8, r - 1.2), B["white"])
        y += max(3, int(r * 1.6))
        i += 1
    for sx, r in ((258, 7), (300, 7), (268, 6), (290, 6), (279, 5)):
        disc(img, sx, ground_top - 4, r, MIST)
        disc(img, sx - 1, ground_top - 5, r - 2, B["white"])

    # Oyun adı burada çizilmez: büyütülmüş görüntünün üstüne `banner_title` koyar
    return img


# Banner adının piksel ölçüsü (son görüntüde px). Sahne 6 px ızgarada; ad ayrı katmandır ve
# 18 px'ten (3 hücre x 6) 15 px'e (3 hücre x 5) küçültüldü.
BANNER_TITLE_SCALE = 5


def banner_title(big: Image.Image) -> None:
    """Oyun adı ortada ve kenardan aşağıda. CrazyGames kapağın sol üst köşesine etiket
    ("New", "Hot") koyar; ad ve önemli öğeler oraya yerleşmez."""
    logo = title(TITLE, 3)
    logo = logo.resize((logo.width * BANNER_TITLE_SCALE, logo.height * BANNER_TITLE_SCALE), Image.NEAREST)
    big.alpha_composite(logo, ((big.width - logo.width) // 2, 225))


# ---- İkon -------------------------------------------------------------------------------
def icon() -> Image.Image:
    S = 64
    img = Image.new("RGBA", (S, S), B["navy"])
    sky(img, [B["navy"], NIGHT_DEEP, NIGHT, B["plum"]], 0, 52)
    stars(img, Rng(5), 26, 2, 44, avoid=lambda x, y: 10 <= x <= 54 and y <= 50)
    # Dişli: üretimin simgesi, roketin arkasında hale
    g = gear(26, 20, 10, LILAC, NIGHT)
    put(img, g, 32 - g.width // 2, 26 - g.height // 2)
    # Fabrika: tek bacalı testere dişi çatılı hol ve zemin
    smoke_rng = Rng(9)
    for i in range(4):
        disc(img, 52 + i + smoke_rng.between(0, 1), 41 - i * 4, 1.4 + i * 0.45, MIST)
    put(img, chimney(10), 48, 42)
    put(img, mini_hall(66, 6), -1, 47)
    rect(img, 0, 61, S, 3, B["olive"])
    rect(img, 0, 61, S, 1, B["green"])
    # Roket: fabrikanın üstünden fırlıyor
    flame_end = launch(img, 30, 7, outlined=True)
    smoke(img, Rng(4), 30, flame_end - 2, 56, 4)
    return img


# ---- Dikey (2:3) ve kare (1:1) kapaklar ------------------------------------------------------
def cover(W: int, H: int, title_x: int | None, title_y: int, rocket_nose: int, planet: tuple, seed: int,
          title_cell: int = 4) -> Image.Image:
    """Banner'ın daralmış hali: üstte ad, ortada kalkan roket, altta üretim hattı ve rampa.
    title_x None ise ad ortalanır."""
    img = Image.new("RGBA", (W, H), B["navy"])
    rng = Rng(seed)
    ground_top = H - 32
    horizon = ground_top - 14
    sky(img, [B["navy"], NIGHT_DEEP, NIGHT, B["plum"], LILAC], 0, horizon)
    logo = title_lines(["ORE TO", "ORBIT"], title_cell)
    lx = (W - logo.width) // 2 if title_x is None else title_x
    stars(img, rng, W * H // 260, 2, horizon - 30,
          avoid=lambda x, y: lx - 3 <= x <= lx + logo.width + 3 and title_y - 3 <= y <= title_y + logo.height + 3)
    ring_planet(img, *planet)

    # Uzak şehir silueti
    x = 0
    while x < W:
        bw, bh = rng.between(8, 20), rng.between(6, 20)
        rect(img, x, horizon - bh, bw, bh, NIGHT_DEEP)
        for wy in range(horizon - bh + 2, horizon - 1, 3):
            for wx in range(x + 2, min(W, x + bw - 2), 3):
                if rng.next() < 0.25:
                    img.putpixel((wx, wy), B["sand"])
        x += bw
    rect(img, 0, horizon - 1, W, 2, NIGHT_DEEP)

    ground = sprite("flight/ground_field.png")
    for gx in range(0, W, ground.width):
        put(img, ground.crop((0, 0, min(ground.width, W - gx), H - ground_top + 4)), gx, ground_top - 4)
    rect(img, 0, horizon + 1, W, ground_top - horizon - 3, B["olive"])
    rect(img, 0, horizon + 1, W, 1, B["green"])

    # Fabrika: tek baca, hol
    hall_w = 76
    hall_img = hall(hall_w, 34, 4)
    hall_y = ground_top + 4 - hall_img.height
    smoke_rng = Rng(seed + 1)
    cx = 28
    # Duman ortadaki adın altında kalır
    for i in range(4):
        disc(img, cx + i * 3 + smoke_rng.between(-1, 1), hall_y - 13 - i * 6, 2.0 + i * 0.6, MIST)
        disc(img, cx + i * 3 - 1, hall_y - 14 - i * 6, 1.3 + i * 0.5, B["white"])
    put(img, chimney(22), cx - 3, hall_y - 16)
    put(img, hall_img, 2, hall_y)

    # Kırıcı, kısa bant ve eşyalar, rampa
    crusher = sprite("machines/crusher.png", 32)
    put(img, crusher, hall_w + 4, ground_top - crusher.height + 3)
    pad = sprite("launch_pads/launch_pad_8.png")
    pad_x = W - pad.width - 2
    belt = sprite("conveyor_belt.png")
    belt_x0, belt_x1 = hall_w + 36, pad_x + 4
    belt_y = ground_top - belt.height + 3
    put(img, belt.crop((0, 0, belt_x1 - belt_x0, belt.height)), belt_x0, belt_y)
    for i, name in enumerate(["iron_ore", "steel_gear"]):
        if belt_x0 + 2 + i * 14 + 16 <= belt_x1:
            put(img, sprite(f"items/{name}.png"), belt_x0 + 2 + i * 14, belt_y - 9)
    put(img, pad, pad_x, ground_top - pad.height + 4)

    rocket_x = pad_x + 25
    flame_end = launch(img, rocket_x, rocket_nose)
    y, i = flame_end + 2, 0
    while y < ground_top - 8:
        r = 1.2 + (y - flame_end) / 18
        disc(img, rocket_x + (1 if i % 2 else -1), y, r, MIST)
        disc(img, rocket_x - 1 + (1 if i % 2 else -1), y - 1, max(0.8, r - 1.2), B["white"])
        y += max(3, int(r * 1.6))
        i += 1
    for sx, r in ((pad_x + 4, 7), (W - 2, 7), (pad_x + 12, 6), (W - 10, 6), (rocket_x, 5)):
        disc(img, sx, ground_top - 4, r, MIST)
        disc(img, sx - 1, ground_top - 5, r - 2, B["white"])

    put(img, logo, lx, title_y)
    return img


def save(img: Image.Image, base: str, scale: int, overlay=None) -> None:
    """`overlay` büyütülmüş görüntüye sonradan çizilen katmandır (banner adı)."""
    OUT.mkdir(exist_ok=True)
    img.save(OUT / f"{base}_base.png")
    big = img.resize((img.width * scale, img.height * scale), Image.NEAREST)
    if overlay:
        overlay(big)
    big.convert("RGB").save(OUT / f"{base}.png")
    print(f"{base}: {img.size} x{scale} -> {big.size}")


if __name__ == "__main__":
    save(icon(), "icon_512x512", 8)
    save(banner(), "banner_1920x1080", 6, banner_title)
    # Adlar ortada ve köşeden aşağıda: sol üst köşe platform etiketlerinin yeridir
    save(cover(200, 300, None, 56, 150, (52, 178), 21), "cover_portrait_800x1200", 4)
    save(cover(200, 200, None, 34, 84, (116, 124), 31, title_cell=3), "cover_square_800x800", 4)
