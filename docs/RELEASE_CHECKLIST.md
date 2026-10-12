# RELEASE_CHECKLIST.md — CrazyGames Yayın Kontrol Listesi

> M9-G'de hazırlandı (2026-10-08). Kutular yayından önce **CrazyGames QA aracında** işaretlenir.
> "Burada doğrulandı" sütunu yalnızca yerel ortamda (localhost: SDK `local` ortamı, deneme reklamı) görüleni söyler; gerçek reklam ağıyla hiçbir şey denenmedi.

## 1. Reklam

| Kural (CrazyGames reklam gereksinimleri) | Oyundaki karşılığı | Burada doğrulandı |
|---|---|---|
| Ödüllü reklam isteğe bağlıdır; ilerleme için zorunlu değildir | Her yerleşimin reklamsız yolu var (`ECONOMY.md` §10) | Evet |
| Reklam düğmesi etkin oyun ekranında durmaz | Beş yerleşim de pencerelerin içinde; HUD'daki rozet düğme değil, gösterge | Evet |
| Düğmede video simgesi bulunur | `icon_video` | Evet |
| Sık sunulmaz; bekleme süresi gösterilir | R2 3 dk · R3 5 dk · R4 10 dk; sayaç düğmenin altında | Sayaç görüldü; sürenin dolması beklenmedi |
| Ödül yalnızca `adFinished` ile verilir; `adError`'da verilmez | `AdService.show` → `rewarded` / `failed` | Sahte sağlayıcıda ve SDK deneme reklamında evet |
| Reklam sunulamıyorken etkisiz düğme kalmaz (Basic Launch, reklam engelleyici) | `CrazyGamesSDK.canShowAds()` false iken düğmeler çizilmez | SDK `disabled` ortamında evet; reklam engelleyici ve Basic Launch denenmedi |
| Reklam başlayınca ses kesilir ve oyun durur; bitince döner | `adStarted` anında `SoundManager.setSuspended` + sahne duraklar; bitişte telafi | Evet (SDK deneme reklamı) |
| `gameplayStop` / `gameplayStart` reklamın çevresinde çağrılır | `CrazyGamesSDK.requestAd` | Birim testinde evet |
| Geçiş reklamı en fazla 3 dakikada bir, doğal arada; aynı arada ödüllü reklamla birlikte değil | `MIDGAME_AD_ENABLED` (kapalı). Açılırsa: uçuş dönüşü, o uçuşta ödüllü izlenmediyse, son reklamdan 180 sn sonra | Kapalı; yalnızca servis mantığı denendi |

## 2. Yayından Önce Yapılacaklar

- [ ] `npm run build` çıktısını (`dist/`) CrazyGames geliştirici paneline yükle ve Preview / QA aracında aç.
- [ ] Gönderim formunda **Progress Save** için "Automatic Progress Save (APS)" seç: kayıt `localStorage`'dadır, APS onu hesaba yedekler; oyunda uygulama içi satın alma yok (DEC-054).
- [ ] Preview günlüğünde sırayı doğrula: SDK başlatıldı → loading start → loading stop → (Oyna) gameplay start; Ayarlar açılınca stop, kapanınca start; uçuşta start/stop.
- [ ] Lider tablosu: `docs/LEADERBOARD.md` §3 (davet, anahtar, ayarlar, Preview'da `submitScore`).
- [ ] QA aracında yedi yerleşimi (R1–R7) tek tek dene: ödül geliyor, bekleme süresi başlıyor, reklam kapatılınca ödül gelmiyor.
- [ ] "Basic Launch" (reklamsız) modunda hiçbir reklam düğmesinin görünmediğini doğrula.
- [ ] Reklam engelleyici açıkken düğmelerin görünmediğini doğrula.
- [ ] Reklam sırasında sesin kesildiğini ve reklamdan sonra geri geldiğini kulakla doğrula.
- [ ] Geçiş reklamı (G1) kararını ver; açılacaksa `src/ads/ads.ts` → `MIDGAME_AD_ENABLED`.
- [ ] Telefonda (dikey ve yatay) Takviye, uçuş raporu ve parsel onayı pencerelerini aç.
- [ ] Kayıt: reklam bekleme süresinin sayfa yenilenince korunduğunu doğrula.

## 3. Reklam Modu

`src/ads/ads.ts` modu kendisi seçer:

| Ortam | Mod | Sonuç |
|---|---|---|
| CrazyGames (SDK `crazygames`) | `crazygames` | Gerçek reklam |
| localhost (SDK `local`) | `crazygames` | SDK'nın deneme reklamı |
| Başka alan adı (SDK `disabled`) ya da SDK yok | `off` | Reklam düğmeleri çizilmez; SDK'ya hiç dokunulmaz |

Sahte reklam ("REKLAM ALANI" katmanı) kendiliğinden devreye girmez: yalnızca geliştirme sürümünde `?ads=mock` ya da `?ads=fail` ile açılır. `?ads=off` reklamı kapatır. Yayın sürümünde bu parametreler yok sayılır.

Reklam hatasında (`adError`) ödül verilmez ve neden oyuncuya yazılır. `adsDisabledBasicLaunch` ya da `adblock` gelirse reklam düğmeleri o oturumda kaldırılır (basılıp iş görmeyen düğme kalmaz).
