"""Oyunun 16 renkli ana paleti ve ondan türetilen yardımcı tonlar.

Bu dosya `src/ui/theme.ts` içindeki `BASE` ve `TONE` tablolarının Python karşılığıdır;
birinde yapılan değişiklik diğerine de işlenmelidir. Çizim betikleri (tools/generate_*.py)
renkleri buradan alır.

Kural: bir renk ya 16 ana renkten biridir ya da iki ana rengin adlandırılmış karışımıdır.
Şehir arka planı yalnızca 16 ana rengi kullanır; arayüz yüzeyleri (krem, açık kahve) ve
açık zemindeki yazı tonları karışımdır.
"""

BASE = {
    "sand": 0xE1B670,     # açık kahve
    "copper": 0xB96925,   # bakır / turuncu kahve
    "brown": 0x68392E,    # kahve
    "umber": 0x201300,    # en koyu kahve (kontur, yazı)
    "olive": 0x404E21,    # koyu yeşil
    "green": 0x45944F,    # yeşil
    "mint": 0x77D3B2,     # nane
    "sky": 0x96BFFF,      # açık mavi
    "blue": 0x038AC2,     # mavi
    "teal": 0x01515E,     # koyu camgöbeği
    "navy": 0x001437,     # lacivert
    "plum": 0x503E66,     # koyu mor
    "purple": 0xA762A9,   # mor
    "pink": 0xEFA3C8,     # pembe
    "white": 0xFFFFFF,
    "black": 0x000000,
}

# Paletin dışındaki tek renk (DEC-051): yalnızca "Sök" ve "Kapat" düğmeleri kırmızıdır
EXTRA = {
    "red": 0xE74C3C,
    "red_light": 0xF29488,
    "red_dark": 0xA5281B,
}

# Palet görselindeki sıra (soldan sağa); indeksli PNG'ler bu sırayı kullanır
ORDER = [
    "sand", "copper", "brown", "umber", "olive", "green", "mint", "sky",
    "blue", "teal", "navy", "plum", "purple", "pink", "white", "black",
]


def mix(a: int, b: int, t: float) -> int:
    """İki rengin doğrusal karışımı: t=0 -> a, t=1 -> b (theme.ts -> mixColor ile aynı yuvarlama)."""
    out = 0
    for shift in (16, 8, 0):
        ca, cb = (a >> shift) & 255, (b >> shift) & 255
        out |= int(ca + (cb - ca) * t + 0.5) << shift
    return out


B = BASE

# Türetilmiş tonlar. İlk iki öbek src/ui/theme.ts -> TONE ile aynıdır; son öbek yalnızca
# dokuların içinde (pah, beton, düğme durumu) geçer, kodda adı yoktur.
TONE = {
    # Açık yüzeyler
    "cream": mix(B["sand"], B["white"], 0.62),         # pencere dolgusu
    "cream_light": mix(B["sand"], B["white"], 0.8),    # kart dolgusu
    "tan": mix(B["sand"], B["white"], 0.38),           # iç bölme dolgusu
    "tan_bar": mix(B["sand"], B["white"], 0.14),       # üst çubuk ve araç çubuğu tablası
    "tan_dark": mix(B["sand"], B["copper"], 0.35),     # ayırıcı çizgi, çerçeve gölgesi
    # Dünya (koyu) yüzeyleri
    "night_deep": mix(B["navy"], B["plum"], 0.3),
    "night": mix(B["navy"], B["plum"], 0.55),
    "lilac": mix(B["plum"], B["sky"], 0.45),
    "mist": mix(B["plum"], B["white"], 0.62),
    "faded": mix(B["brown"], B["sand"], 0.25),
    "faded_light": mix(B["brown"], B["sand"], 0.55),
    # Yalnızca dokularda
    "cream_glow": mix(B["sand"], B["white"], 0.92),    # pah vurgusu
    "bar_edge": mix(B["sand"], B["white"], 0.3),       # çubuğun iç kenar vurgusu
    "concrete": mix(B["plum"], B["white"], 0.52),      # açılmamış arsa: gri-eflatun beton
    "concrete_light": mix(B["plum"], B["white"], 0.62),
    "concrete_dark": mix(B["plum"], B["white"], 0.42),
    "concrete_joint": mix(B["plum"], B["white"], 0.3),
    "steel_light": mix(B["plum"], B["white"], 0.8),    # ikonlardaki açık metal
    "steel": mix(B["plum"], B["white"], 0.45),         # ikonlardaki koyu metal
    "disabled": mix(B["sand"], B["white"], 0.3),       # devre dışı düğme gövdesi
    "disabled_light": mix(B["sand"], B["white"], 0.5),
    "disabled_lip": mix(B["sand"], B["brown"], 0.25),
}


def rgba(hex_value: int, alpha: int = 255) -> tuple:
    return ((hex_value >> 16) & 255, (hex_value >> 8) & 255, hex_value & 255, alpha)
