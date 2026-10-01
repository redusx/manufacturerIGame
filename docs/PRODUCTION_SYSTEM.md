# PRODUCTION_SYSTEM.md — Manufacturer Üretim ve Reçete Motoru

> **Bu dosya, eşyaların makinelerde nasıl işlendiğini, girdi/çıktı tamponlarını ve reçete motorunu tanımlar.**

---

## 1. Reçete Motoru İlkeleri

* Reçeteler kod sınıflarına gömülü değildir; veri-güdümlüdür (`RecipeDefinition`).
* Desteklenen Reçete Türleri:
  - $1 \text{ Girdi} \longrightarrow 1 \text{ Çıktı}$ (örn. Kırıcı: 1 Cevher $\rightarrow$ 1 Toz)
  - $1 \text{ Girdi} \longrightarrow 2 \text{ Çıktı}$ (örn. Kesici: 1 Plaka $\rightarrow$ 1 Dişli + 1 Hurda)
  - $2 \text{ Girdi} \longrightarrow 1 \text{ Çıktı}$ (örn. Montajcı: 1 Levha + 2 Tel $\rightarrow$ 1 Motor)
  - $2 \text{ Girdi} \longrightarrow 2 \text{ Çıktı}$ (örn. Rafineri: 1 Polimer + 1 Gaz $\rightarrow$ 1 Plastik + 1 Cüruf)

---

## 2. Makine Durum Makinesi (Operational State Machine)

Her makine her simülasyon karesinde (tick) şu 4 durumdan birindedir:

```
[IDLE] ─────────► (Reçete atandı & güç var)
                     │
                     ▼
             [WAITING_INPUT] ◄──────────────┐ (Girdiler eksik)
                     │                      │
                     ▼ (Girdiler tam)       │
               [PROCESSING]                 │
                     │ (Çevrim bitti)       │
                     ▼                      │
             [BLOCKED_OUTPUT] ──────────────┘ (Çıktı boşaltıldı)
```

1. **`WAITING_INPUT`:** Reçete için gerekli girdiler dahili tamponda eksiktir. Makine bekler.
2. **`PROCESSING`:** Girdiler dahili stoktan düşülmüş, işlem sayacı (`progressSec`) ilerlemektedir.
3. **`BLOCKED_OUTPUT`:** Ürün tamamlanmış ancak çıkış portundaki bant veya depo dolu olduğu için ürün dışarı atılamamaktadır.
4. **`IDLE`:** Reçete seçilmemiş veya makine devre dışı bırakılmıştır.

---

## 3. Dahili Tamponlar (Internal Buffers)
* Her makinenin her girdi türü için maksimum bir tampon kapasitesi vardır (Örn: En fazla 5 adet).
* Tampon dolduğunda makine giriş portundaki banttan daha fazla eşya çekmez; bant arkaya doğru tıkanır.
* Çıkış tamponu kapasitesi dolarsa (örn. 5 adet), makine yeni üretime başlamaz (`BLOCKED_OUTPUT`).
