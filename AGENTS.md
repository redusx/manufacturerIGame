# AGENTS.md — Manufacturer (Fabrika İncremental Oyunu)

> **Her görev öncesinde bu dosyayı oku.** Buradaki kurallar tüm agentlar için bağlayıcıdır.

---

## Proje Özeti

Tarayıcıda çalışan, CrazyGames'e yayımlanacak 2D fabrika incremental ekonomisi ile sağa kaydırmalı, oyuncu kontrollü roket uçuşunu birleştiren hibrit oyun.
Oyuncu fabrikada tıklayarak ve makineler/üretim hatları kurarak kaynak kazanır; kazandığı kaynakla roketini geliştirir (görsel ve mekanik olarak değişir), fırlatma alanına geçerek sağa kaydırmalı yatay uçuşta roketini yönlendirir, boost ve engelden kaçınma mekanikleriyle uçuş mesafesi ve toplanan parçalardan skor elde eder. Uçuş sonunda skor kaynaklara dönüştürülerek fabrika ve roket döngüsü sürekli büyütülür.

---

## Teknoloji Kararları

| Karar | Değer |
|---|---|
| Motor | **Phaser 3** |
| Dil | **TypeScript** |
| Çıktı | HTML5 build (tarayıcı) |
| Boyut | 2D |
| UI Framework | Yok (açık ihtiyaç + kullanıcı onayı olmadan ekleme) |
| Sunucu | Yok (ilk prototip tamamen istemci taraflı) |

- Kullanıcı istemedikçe oyun motorunu veya temel teknoloji kararlarını değiştirme.
- CrazyGames SDK, bulut kayıt ve oyuncu hesabı sonraki aşamalara aittir; bu aşamada ekleme.

---

## Mimari İlkeler

1. **Ekonomi hesabı**, **kayıt (save) verisi** ve **Phaser görselleştirmesi** birbirinden ayrı modüllerde tutulmalı.
2. Küçük, tek amaçlı modüller ve açıklayıcı isimler kullan.
3. TypeScript türlerini koru; `any` kullanımını minimumda tut.
4. Başlangıç mimarisi küçük ve anlaşılır olsun; erken aşamada aşırı soyutlamadan kaçın.

---

## Oyun Tasarımı İlkeleri

- Oyuncu oyuna girince kısa sürede ne yapacağını anlayabilmeli; ilk üretim eylemi hemen gerçekleşebilmeli.
- Tıklama, kazanım ve yükseltme satın alma **açık görsel/işitsel geri bildirim** vermeli.
- Yükseltmeler mümkünse yalnızca sayıyı değil, üretimde veya görünüşte fark edilir bir değişiklik yaratmalı.
- Oyuncunun sıradaki hedefi her zaman anlaşılır olmalı; erken oyunda ilerleme hızlı ve görünür olmalı.
- Oyun varlıklarını veya tasarımları başka oyunlardan kopyalama. Türden ilham alınabilir; isim, logo, karakter, sanat ve ayırt edici tasarım kopyalanamaz.

---

## Sanat ve Görsel Standartlar

- Tüm UI, görsel, animasyon ve asset geliştirme görevlerinde **`docs/ART_DIRECTION.md`** dosyasını okumak ve buradaki piksel sanat, renk paleti ve grid standartlarına uymak **zorunludur**.
- Renkler `src/ui/theme.ts` merkezi paletinden kullanılmalı; rastgele hex renkleri tanımlanmamalıdır.
- Phaser doku ve kamera ayarlarında piksel sanat bütünlüğü (`pixelArt: true`, `roundPixels: true`) korunmalıdır.

---

## Netleştirilecek Kararlar

Aşağıdaki konular henüz karara bağlanmamıştır. Bunları kesin karar gibi kodlama; gerektiğinde kullanıcıya sor.

- Oyun adı ve marka kimliği
- Kaynak türleri ve ekonomi değerleri
- Kesin ilerleme eğrisi ve dengeleme
- Prestige / reset sistemi
- Offline gelir mekaniği
- Birden çok para birimi sistemi
- Monetizasyon ve reklam stratejisi (ilk prototipte reklam ekleme)

---

## Agent Çalışma Kuralları

### Kapsam ve Değişiklik

- Görev kapsamındaki **en az sayıda dosyayı** değiştir; ilgisiz düzenleme yapma.
- Önce mevcut kodu ve mimariyi incele; var olan yapıyı anlamadan büyük yeniden düzenleme yapma.
- Kullanıcı istemeden **bağımlılık ekleme, dosya silme, temel mimariyi değiştirme** veya dış servislere bağlanma.
- Kullanıcı açıkça istemedikçe **test ekleme** veya test/build komutları çalıştırma.

### Kararlar ve Varsayımlar

- Bir karar eksikse makul varsayımı **açıkça belirt**.
- Önemli ürün veya teknoloji kararlarında varsayımı gerçekmiş gibi sunma; kullanıcıya sor.

### Görev Sonu Raporu

Her görev sonunda kısa biçimde bildir:

1. Değiştirilen dosyalar
2. Yapılan iş
3. Kalan önemli belirsizlikler
