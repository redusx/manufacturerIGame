# INCREMENTAL_DESIGN_RULES.md — Manufacturer Incremental Tasarım Kuralları

> **Bu dosya tüm agentlar için bağlayıcıdır.** Ekonomi, ilerleme, dengeleme veya oyuncu deneyimiyle ilgili her değişiklikte bu kurallar dikkate alınmalıdır.

---

## Temel Oyun Döngüsü

Manufacturer'ın çekirdek deneyimi **incremental fabrika ekonomisidir**:

```
Üretim → Gelir → Yatırım → Üretim Artışı → Yeni Hedef / İçerik Açılımı
```

Fabrikada üretilen kaynaklar (Parça) ile makineler geliştirilir; aynı kaynak havuzu roket yükseltmeleri için de kullanılır. Roket uçuş sahnesi (FlightScene) fabrika ekonomisiyle doğrudan bağlantılıdır: uçuş ödülleri fabrika kaynak havuzuna geri akar ve roket yükseltmeleri fabrika kaynağıyla satın alınır.

**Oyun sadece sayı ve menülerden oluşmamalıdır.** Üretim, satın almalar ve önemli ilerleme aşamaları oyun alanında (fabrika görselinde, roket hangarında, uçuş sahnesinde) ve/veya görsel geri bildirimlerde somut karşılık bulmalıdır.

---

## Bağlayıcı Tasarım Kuralları

### 1. Erken Anlaşılırlık ve Kademeli Açılım

- Oyuncu temel döngüyü (tıkla → kaynak kazan → makine kur/geliştir) **ilk 1–2 dakikada** anlamalıdır.
- Yeni sistemler (yeni makine türleri, roket hangarı, fabrika hedefleri) kademeli olarak açılmalı; tüm seçenekler aynı anda sunulmamalıdır.
- İlk satın alma eylemi mümkün olduğunca hızlı gerçekleşebilmelidir; oyuncu uzun süre pasif kalmamalıdır.

### 2. Satın Alma Öncesi Şeffaflık

- Her yatırımın (makine geliştirme, roket yükseltme) **maliyeti ve faydası** satın almadan önce oyuncuya açık biçimde gösterilmelidir.
- Fayda yalnızca sayısal değil mümkünse anlam olarak da aktarılmalıdır ("üretim hızı +4/sn" yanında "daha hızlı preslenmiş plaka üretimi" gibi bağlam bilgisi).

### 3. Anlamlı Tercihler

- Oyuncuya anlamlı yatırım tercihleri sunulmalıdır. Tek bir seçenek her zaman açık ara en iyi (dominant strateji) olmamalıdır.
- Farklı makine türlerinin, roket bileşenlerinin veya fabrika genişleme yollarının avantajları ve dezavantajları (veya farklı zamanlama maliyetleri) olmalıdır.

### 4. Maliyet Ölçeklemesi

- Maliyet artışları doğrusal olmayan biçimde artabilir.
- `maliyet = tabanMaliyet × katsayı^seviye` yalnızca başlangıç modeli olarak değerlendirilmelidir.
- Katsayılar (costScale) başka oyunlardan test edilmeden kopyalanmamalı; projenin kendi üretim hızı ve hedef aralıklarıyla tutarlı olmalıdır.
- Maliyet eğrisinin gerçek oyun deneyiminde nasıl hissettirdiği (bekletme süresi, engelleme noktaları) dengelemede birincil kriterdir.

### 5. Aktif Oynama ve Boşta Üretim Dengesi

- Aktif oynama (tıklama, roket uçuşu) ve boşta üretim (otomatik makine üretimi) birbirini desteklemelidir.
- Sürekli tıklama zorunlu hale gelmemeli; otomasyon zamanla manuel işi azaltabilmelidir.
- Offline üretim mevcut mekanizma (yarım verimle sınırlı süre) üzerinden çalışır; offline oyuncular geri döndüğünde anlamlı bir kazanım görmelidir.

### 6. Kilometre Taşları ve İçerik Açılımları

- Milestone'lar (fabrika hedefleri, makine seviye eşikleri) yalnızca sayısal bir artış sağlamamalıdır.
- Her önemli eşik şu türlerden en az birini sunmalıdır:
  - Yeni karar veya mekanik
  - Yeni yükseltme seçeneği
  - Görsel değişim (fabrikada, rokette veya HUD'da)
  - Yeni oyun hedefi
- Görsel karşılığı olmayan seviye artışlarından kaçınılmalıdır.

### 7. Hedef Görünürlüğü ve İlerleme Göstergesi

- Oyuncuya her zaman şunlar gösterilmelidir:
  - **Sıradaki anlamlı hedef** (ne yapılması gerektiği)
  - **Hedefin maliyeti** (neye mal olacağı)
  - **Mevcut üretim hızı** (ne kadar hızlı ilerlediği)
  - **Hedefe kalan yaklaşık süre** (mümkünse, tahminî)
- MilestoneBar ve HUD bu bilgileri sürekli güncel tutmalıdır.

### 8. Kaçınılacak Anti-Kalıplar

- **Uzun ödülsüz beklemeler:** Oyuncu 5+ dakika hiçbir yeni şey satın alamaz veya açamaz durumda kalmamalıdır (özellikle erken oyunda).
- **Etkisi belirsiz upgrade'ler:** "Seviye 47 → 48" gibi farkı hissedilmeyen artışlar tek başına yeterli değildir.
- **Aynı anda çok fazla kilitli özellik:** Oyuncuya ulaşamayacağı çok sayıda kilit göstermek motivasyonu düşürür.
- **Görsel karşılığı olmayan seviye artışları:** Sayı değişimi tek geri bildirim olmamalıdır.

### 9. Prestij / Reset Sistemi

- Prestij veya reset mekanizması yalnızca projeye gerçekten uyuyorsa önerilmelidir.
- Eklenirse:
  - Sıfırlanan ve kalıcı kalan ilerleme açıkça belirtilmelidir.
  - Yeni strateji veya hedef sağlamalıdır (aynı döngünün tekrarı yeterli değildir).
- **Bu görev kapsamında prestij sistemi eklenmez.**

### 10. Görsel Tutarlılık

- Görsel tema ve animasyonlar `docs/ART_DIRECTION.md` ile tutarlı olmalıdır.
- Renkler `src/ui/theme.ts` merkezi paletinden kullanılmalıdır.
- Yeni görsel öğeler piksel sanat stiline uygun olmalıdır.

### 11. Reklam ve Monetizasyon

- Reklam varsa isteğe bağlı ve açık değerli bir ödül sunmalıdır.
- Temel ilerleme asla reklam izlemeye bağlanmamalıdır.
- **Bu görev kapsamında reklam entegrasyonu eklenmez.**

### 12. Büyük Sayı Yönetimi

- Proje halihazırda `break_eternity.js` kullanmaktadır.
- Ek büyük sayı kütüphaneleri yalnızca mevcut sınırların aşılması bekleniyorsa düşünülmelidir.
- `formatNumber` yardımcısı standart kısaltma formatını sağlar.

---

## Kaynak Kullanım İlkeleri

Incremental oyun tasarım kaynaklarından (blog yazıları, GDC konuşmaları, oyun analizleri) fikir ve analiz aracı olarak yararlanılabilir. Ancak:

- Formüller veya oyun yapıları bağlamdan koparılıp birebir kopyalanmamalıdır.
- Üretim/maliyet dengesi, farklı yatırım yolları, keşif, aktif-idle dengesi ve reset döngüsü **mevcut projeye göre** değerlendirilmelidir.
- Doğrulanamayan kaynak içerikleri kaynağa atfedilmemelidir.

---

## Durum Ayrımları

Her tasarım belgesinde mevcut mekanikler, uygulanmamış hedefler ve bilinmeyen noktalar birbirinden açıkça ayrılmalıdır:

| Etiket | Anlamı |
|---|---|
| ✅ Mevcut | Kodda uygulanmış ve çalışan mekanik |
| 🎯 Planlanan | Tasarım aşamasında veya kısmen uygulanmış |
| ❓ Belirsiz | Henüz karara bağlanmamış; kullanıcı onayı gerektiren |
