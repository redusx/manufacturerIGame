# LEADERBOARD.md — Lider Tablosu: CrazyGames Entegrasyonu

> 2026-10-12. Karar: DEC-054. Kaynak: docs.crazygames.com/sdk/leaderboards, /sdk/leaderboards-client,
> /sdk/leaderboards-mvp, /sdk/user (aynı gün okundu).

## 1. Nasıl çalışıyor

- Sıralamayı **CrazyGames tutar ve kendi arayüzünde gösterir** (oyun sayfasındaki panel, kenar çubuğu, profil ödülleri; genel / ülke / arkadaşlar).
- Oyun yalnızca **skor gönderir**: `CrazyGames.SDK.user.submitScore({ encryptedScore, score })`. Skor, geliştirici panelindeki istemci anahtarıyla AES-GCM ile şifrelenir (dokümandaki işlevin aynısı: 12 bayt IV + şifreli veri, base64).
- **SDK'da sıralamayı okuyan ya da lider tablosunu açan bir çağrı yoktur.** Bu yüzden oyun içi pencere başka oyuncu göstermez, satır uydurmaz; rekoru, haftanın en iyi uçuşunu, son gönderimin durumunu, hesabı ve gerçek tablonun nerede görüleceğini yazar.
- Sunucu kiralanmaz, arka uç yazılmaz.

## 2. Skor

| | |
|---|---|
| Ölçü | Tamamlanan roket uçuşunun mesafesi, **tam metre** (`Math.floor`); biçimli yazı değil sayı |
| Ne zaman | Uçuştan fabrikaya dönülürken, **uçuş başına bir kez** (`GameScene.onReturnFromFlight`). Kayıt yüklenirken, oyun açılırken, sahne değişirken gönderilmez |
| Hangi uçuş | Yalnızca **o haftanın en iyisi** olan uçuş (`src/leaderboard/SeasonScore.ts`) |
| Geçerlilik | 1 … 2.000.000 m; sayı olmayan, sıfır ya da sınırın üstündeki değer gönderilmez |
| Durum | Haftanın en iyisi tarayıcıda `manufacturer_cg_leaderboard_v1` anahtarında tutulur |

**Neden haftanın en iyisi?** CrazyGames tablosu haftalık sezonla çalışır ve her pazartesi sıfırlanır. Yalnızca tüm zamanların rekoru gönderilseydi, oyuncu rekorunu kıramadığı hafta sıralamaya hiç giremezdi.

**Varsayım:** Doküman, artımlı olmayan tabloda bir oyuncunun en iyi skorunun mu son skorunun mu saklandığını yazmıyor. Oyun yalnızca haftanın en iyisini geçen uçuşu gönderdiği için iki durumda da tabloda aynı değer görünür. Sezonun döndüğü saat bir sayfada 07:00, diğerinde 09:00 UTC; erken olan alındı.

## 3. Senin yapman gerekenler (geliştirici paneli)

1. Oyunu gönder; CrazyGames'teki iletişim kişisinden **lider tablosu özelliğinin açılmasını iste** (özellik yalnızca davetli oyunlara açık; MVP döneminde ayarları CrazyGames yöneticisi elle giriyor).
2. Panelde **Encryption Key** üret (istemci anahtarı). `API Key` üretme ya da oyuna koyma: o sunucu tarafı içindir.
3. İletişim kişisine şu ayarları ilet:

| Ayar | Değer |
|---|---|
| Leaderboard Guide (en çok 50 karakter) | `Longest rocket flight distance (meters)` |
| Metric Type | `POINTS` |
| Incremental Scoring | `false` |
| Score Sorting | `DESC` |
| Min Allowed Score | `1` |
| Max Allowed Score | `2000000` (koddaki `LEADERBOARD_MAX_SCORE` ile aynı olmalı) |
| Cooldown interval | `5` saniye (oyun uçuş başına bir kez gönderir) |

4. Anahtarı derlemeye ver: proje kökünde `.env.local` → `VITE_CRAZYGAMES_LEADERBOARD_KEY=<anahtar>` (örnek: `.env.example`), sonra `npm run build`.
5. Paneldeki **Preview** aracında oyunu aç, bir uçuş yap, **Logs** sekmesinde `submitScore` satırını gör. Preview'dan gönderilen skorlar veritabanına yazılmaz; tabloda görünmez. Gerçek kaydı CrazyGames sunucu günlüğünden doğrulayabilir.

Anahtar tanımlı değilse oyun aynen çalışır; skor gönderilmez ve konsola bir kez uyarı yazılır.

## 4. Bilinen sınırlar

- Misafir (giriş yapmamış) oyuncunun skorunun sayılıp sayılmadığı dokümanda yazmıyor. Pencere, misafire CrazyGames'in giriş penceresini açan küçük bir "Giriş yap" düğmesi gösterir (kendiliğinden açılmaz).
- Skor istemciden geldiği için değiştirilebilir; doğrulamayı CrazyGames kendi tarafında yapar ve yanıtı her zaman "başarılı" döner. Oyun "gönderildi" der, "kabul edildi" diyemez.
- Sunucu tarafı gönderim (Leaderboard API) kullanılmadı: oyunun arka ucu yok.

## 5. İsteğe bağlı: kendi skor sunucusu

`VITE_LEADERBOARD_URL` tanımlanırsa oyun ayrıca o sunucuya yazar ve pencerede listesini gösterir. Sözleşme:

```
GET  {url}/top?limit=50  ->  [{ "id": "...", "name": "...", "distance": 12345 }]
POST {url}/score         <-  { "id": "...", "name": "...", "distance": 12345 }
```

Şu an kullanılmıyor; CrazyGames'in dış isteklere izin verip vermediği ayrıca doğrulanmalı.
