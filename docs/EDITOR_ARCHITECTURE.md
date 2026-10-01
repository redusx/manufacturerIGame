# EDITOR_ARCHITECTURE.md — Manufacturer Harita & Fabrika Editörü Mimarisi

> **Bu dosya, gelecekteki seviye/fabrika editörünün veri yapısını ve araç setini tanımlar.**

---

## 1. Editörün Amacı ve Kapsamı
Geliştiricinin veya oyuncunun oyun içinde yeni fabrika bulmacaları tasarlayabilmesi, engeller koyabilmesi, hammadde giriş debilerini ve sipariş hedeflerini ayarlayabilmesi için hafif bir editör aracı.

---

## 2. Modüller ve Komut Deseni (Command Pattern)

```
[Editör Sahnesi: EditorScene]
       │
       ├──► [Fırça Seçici (Brush Tool)]
       │      ├── Tile Brush (Zemin, Duvar, Engel)
       │      ├── Port Brush (Girdi Kaynağı, İhracat Sandığı)
       │      ├── Machine Brush (Makine yerleştir, $R$ ile döndür)
       │      └── Belt Tool (Akıllı sürükle-bırak konveyör hattı)
       │
       ├──► [Geri Al / İleri Al Yığını (Undo/Redo Stack)]
       │      └── Her yerleşim `ICommand` nesnesidir (`execute()` / `undo()`)
       │
       └──► [JSON Serializer & Inspector]
              ├── Seviye Parametreleri (Ad, Bütçe, Süre, Hedef Siparişler)
              └── Panoya Kopyala / Dosyadan Yükle (Import / Export)
```

---

## 3. Seviye JSON Formatı
Editörün ürettiği saf JSON verisi doğrudan `LevelLoader.ts` tarafından okunur ve oynanabilir sahneye dönüştürülür.
