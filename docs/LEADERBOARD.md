# LEADERBOARD.md — Lider Tablosu: Altyapı Araştırması ve Kurulum

> 2026-10-12. Oyundaki lider tablosunun nasıl çalıştığı, gerçek oyuncu sıralaması için
> neyin gerektiği ve hangi kararların kullanıcıya ait olduğu.

## 1. Bugünkü durum

Pencere ve altyapı hazır, **gerçek oyuncu sıralaması henüz bağlı değil.** Oyunun
sunucusu yoktur (AGENTS.md); başka oyuncuların rekorunu saklayacak bir yer olmadan
gerçek sıralama gösterilemez. Pencere hangi kipte olduğunu her zaman yazar:

| Kip | Ne zaman | Ne gösterir |
|---|---|---|
| `online` | `VITE_LEADERBOARD_URL` tanımlı | Skor sunucusundaki gerçek oyuncular |
| `sample` | Geliştirme sürümü, sunucu yok | "ÖRNEK VERİ" uyarısıyla 12 örnek pilot (arayüzü denemek için) |
| `local` | Yayın sürümü, sunucu yok | Başka oyuncu yok; oyuncunun rekoru menzil hedefleriyle sıralanır |

Uydurma oyuncular hiçbir kipte gerçekmiş gibi gösterilmez.

## 2. Araştırma: CrazyGames ne sunuyor?

Kaynak: docs.crazygames.com/sdk/leaderboards (2026-10-12'te okundu).

- CrazyGames'in **kendi lider tablosu** vardır: haftalık sezonlar (pazartesi 09:00 UTC'de
  sıfırlanır), ülke/arkadaş/genel sıralama, ödüller.
- **Yalnızca davet edilen oyunlara açıktır** ve oyun başına tek tablo vardır.
- Sıralamayı **CrazyGames kendi arayüzünde** gösterir (oyun sayfasındaki panel). Belgelerde
  oyunun sıralama listesini okuyabileceği bir çağrı yoktur; yani oyun içi penceremiz bu
  tabloyla doldurulamaz.
- Skor iki yoldan gönderilir: istemciden (`CrazyGames.SDK.user.submitScore`, skor
  geliştirici panelindeki anahtarla AES-GCM şifrelenir) veya sunucudan (API anahtarıyla).

**Sonuç:** CrazyGames tablosu oyun içi pencerenin yerini tutmaz ama ek görünürlük sağlar.
Skor gönderimi kodda hazırdır (`CrazyGamesSDK.submitLeaderboardScore`); davet alınıp
anahtar üretilince `VITE_CRAZYGAMES_LEADERBOARD_KEY` ile açılır. **Denenmedi** (davet ve
anahtar olmadan denenemez). Haftalık sıfırlama, "tüm zamanların rekoru" fikrimizle
birebir örtüşmez: CrazyGames tablosunda haftanın en iyi uçuşu sıralanır.

## 3. Oyun içi gerçek sıralama için gereken: küçük bir skor sunucusu

Oyun şu iki çağrıyı yapar (`src/leaderboard/providers.ts`):

```
GET  {URL}/top?limit=50
     -> 200  [ { "id": "p-abc", "name": "Pilot 4821", "distance": 12345 }, ... ]   (mesafeye göre azalan)

POST {URL}/score        Content-Type: application/json
     <- { "id": "p-abc", "name": "Pilot 4821", "distance": 12345 }
     -> 200  (sunucu, aynı id için yalnızca daha büyük mesafeyi saklar)
```

Sunucunun yapması gerekenler:

1. `id` başına tek satır tutmak; yeni mesafe daha büyükse güncellemek.
2. `distance` için alt/üst sınır (0 – 200.000 m) ve `name` için uzunluk sınırı (20) uygulamak.
3. CORS: oyunun yayımlandığı alan adlarına (`*.crazygames.com`, kendi alan adın) izin vermek.
4. Hız sınırı (ör. id ve IP başına dakikada birkaç istek).

Bunu karşılayan hazır seçenekler (hepsinin ücretsiz katmanı vardır; hesap senin olmalı):

| Seçenek | Artısı | Eksisi |
|---|---|---|
| Cloudflare Workers + D1/KV | Tek dosyalık sunucu, hızlı, bedava katman geniş | Küçük bir betik yazmak gerekir |
| Supabase (Postgres + REST) | Tablo + satır kuralları, panelden yönetim | Sözleşmeye uydurmak için bir "edge function" ya da istemcide küçük uyarlama |
| Firebase (Firestore) | Kolay kurulum | SDK bağımlılığı ekler (AGENTS.md: bağımlılık eklemek onay ister) |

Sunucu kurulunca yapılacak tek şey: derlemede `VITE_LEADERBOARD_URL=https://...` vermek.

## 4. Bilinen sınırlar ve açık kararlar

- **Hile:** skor istemciden gelir; kararlı bir oyuncu sahte mesafe gönderebilir. Sunucudaki
  üst sınır ve hız sınırı kabasını keser; kesin çözüm uçuşu sunucuda doğrulamaktır (kapsam dışı).
- **Oyuncu adı:** şimdilik tarayıcıda saklanan "Pilot 1234". Ad girme ekranı yok. CrazyGames
  kullanıcı adını kullanmak ya da ad sormak ayrı bir karardır (uygunsuz ad denetimi gerekir).
- **Kimlik:** tarayıcıya bağlıdır; oyuncu tarayıcı verisini silerse yeni kimlikle başlar.
- **Kişisel veri:** yalnızca rastgele kimlik, takma ad ve mesafe gönderilir.
- **Kullanıcıya ait kararlar:** hangi sunucu seçeneği; CrazyGames tablosu için davet başvurusu;
  oyuncu adının nasıl belirleneceği.
