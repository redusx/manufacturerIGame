# MACHINE_SYSTEM.md — Manufacturer Makine Taksonomisi ve Port Mimarisi

> **Bu dosya, makinelerin fiziksel boyutlarını, port kurallarını ve rollerini tanımlar.**

---

## 1. Makine Kataloğu ve Boyutları

| Makine ID | Adı | Boyut (Tile) | Giriş Portu | Çıkış Portu | Görevi / Rolü |
|---|---|---|---|---|---|
| `crusher` | Kırıcı | $1 \times 1$ | 1 (Arka) | 1 (Ön) | Cevherleri toza kırar |
| `smelter` | Fırın | $2 \times 1$ | 1 (Sol) | 1 (Sağ) | Tozları külçeye eritir (Yavaş, yüksek ısı) |
| `press` | Pres Makinesi | $1 \times 2$ | 1 (Üst) | 1 (Alt) | Külçeleri levhaya/plakaya damgalar |
| `cutter` | Hassas Kesici | $1 \times 1$ | 1 (Arka) | 2 (Ön + Yan)| Plakaları dişli ve tele keser; talaş çıkarır |
| `assembler`| Montaj Tezgahı| $2 \times 2$ | 2 (Arka 1, Arka 2)| 1 (Ön) | İki farklı parçayı birleştirir (Motor vb.) |
| `refinery` | Kimyasal Rafineri| $2 \times 2$ | 2 (Yanlar)| 2 (Önler) | Polimer ve ileri kompozit işler |

---

## 2. Port ve Yönelim (Orientation & Rotation)

* Makineler $0^\circ, 90^\circ, 180^\circ, 270^\circ$ döndürülebilir.
* Yerel port koordinatları makinenin sol-üst $(0, 0)$ hücresine göredir:
  - Dönme matrisi portların dünya ızgara koordinatlarını ve dışa bakış vektörlerini dinamik olarak günceller.
* Bir makinenin giriş portunun önüne ters yönde bakan bir bant konulamaz (Bant makineye doğru akmalıdır).
* Bir makinenin çıkış portunun önündeki bant, makineden uzağa doğru akmalıdır.
