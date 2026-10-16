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

**Hangi derleme?** (DEC-056; özellik tablosu `src/config/release.ts`)

| Aşama | Komut | Yüklenecek klasör | Reklam | Lider tablosu |
|---|---|---|---|---|
| Basic Launch (ilk gönderim) | `npm run build:basic` | `dist-basic/` | Kapalı, hiçbir teklif çizilmez | Kapalı |
| Full Launch | `npm run build:full` | `dist-full/` | SDK sunabiliyorsa açık | Davet + `VITE_CRAZYGAMES_LEADERBOARD_KEY` varsa açık |

Klasördeki `build-info.json` hangi modla derlendiğini söyler. Yerelde bakmak için `npm run preview:basic` (4181) ve `npm run preview:full` (4182).

- [ ] `npm run build:basic` çıktısını (`dist-basic/`) CrazyGames geliştirici paneline yükle ve Preview / QA aracında aç.
- [ ] Preview'da: "Oyna"dan sonra başka pencere açılmıyor; Ayarlar'da ve üst çubukta tam ekran düğmesi yok; hiçbir reklam düğmesi yok.
- [ ] Panelde oyun adı **Ore to Orbit**; kapaklar `branding/`: `banner_1920x1080.png` (yatay), `cover_portrait_800x1200.png` (dikey), `cover_square_800x800.png` (kare). Önizleme videoları ayrıca kaydedilmeli (15–20 sn, sessiz, 1080p yatay ve 2:3 dikey).
- [ ] Full Launch'a geçerken `npm run build:full` çıktısını yükle; aşağıdaki reklam maddelerini o derlemeyle dene.
- [ ] Gönderim formunda **Progress Save** için "Automatic Progress Save (APS)" seç: kayıt `localStorage`'dadır, APS onu hesaba yedekler; oyunda uygulama içi satın alma yok (DEC-054). Form "iframe oyunlarında APS çalışmaz" uyarısı gösterir; oyun dosya olarak yüklendiği için iframe (dış adresten gömülü) oyun değildir. Bulut kaydı kesinleştirmek için SDK Data modülü Full Launch'ta ayrı iş olarak açık.
- [ ] Formda "The game supports CrazyGames muting audio through SDK" işaretli. Preview'da platformun ses düğmesiyle sesi kapat/aç: müzik ve efektler susmalı, Ayarlar'daki değerler değişmemeli. Yerelde `?muteAudio=true` ile denenebilir.
- [ ] Preview günlüğünde sırayı doğrula: SDK başlatıldı → loading start → loading stop → (Oyna) gameplay start; Ayarlar açılınca stop, kapanınca start; uçuşta start/stop.
- [ ] Lider tablosu: `docs/LEADERBOARD.md` §3 (davet, anahtar, ayarlar, Preview'da `submitScore`).
- [ ] QA aracında yedi yerleşimi (R1–R7) tek tek dene: ödül geliyor, bekleme süresi başlıyor, reklam kapatılınca ödül gelmiyor.
- [ ] "Basic Launch" (reklamsız) modunda hiçbir reklam düğmesinin görünmediğini doğrula.
- [ ] Reklam engelleyici açıkken düğmelerin görünmediğini doğrula.
- [ ] Reklam sırasında sesin kesildiğini ve reklamdan sonra geri geldiğini kulakla doğrula.
- [ ] Geçiş reklamı (G1) kararını ver; açılacaksa `src/ads/ads.ts` → `MIDGAME_AD_ENABLED`.
- [ ] Telefonda (dikey ve yatay) Takviye, uçuş raporu ve parsel onayı pencerelerini aç.
- [ ] Kayıt: reklam bekleme süresinin sayfa yenilenince korunduğunu doğrula.
- [ ] Dil (DEC-055): Preview'da oyunun CrazyGames'in bildirdiği dille açıldığını doğrula (`user.systemInfo.locale`; yerel kipte SDK örnek veri verdiği için denenemedi). Ayarlar > Dil ile değiştirip sayfayı yenileyince seçimin kaldığını gör.
- [ ] Dil: Arapça, Urduca, Hintçe, Bengalce, Japonca, Korece ve Çince'yi bir Android ve bir Windows cihazda aç; harfler kutu (□) olarak çıkıyorsa o cihazda sistem yazı tipi yoktur (oyuna yazı tipi eklenmedi).
- [ ] Dil: gönderim formunda desteklenen dilleri işaretle (en, tr, es, pt-BR, fr, de, ru, ja, ko, zh-CN, hi, ar, id, bn, ur).

## 3. Reklam Modu

`src/ads/ads.ts` modu kendisi seçer:

| Ortam | Mod | Sonuç |
|---|---|---|
| CrazyGames (SDK `crazygames`) | `crazygames` | Gerçek reklam |
| localhost (SDK `local`) | `crazygames` | SDK'nın deneme reklamı |
| Başka alan adı (SDK `disabled`) ya da SDK yok | `off` | Reklam düğmeleri çizilmez; SDK'ya hiç dokunulmaz |

Sahte reklam ("REKLAM ALANI" katmanı) kendiliğinden devreye girmez: yalnızca geliştirme sürümünde `?ads=mock` ya da `?ads=fail` ile açılır. `?ads=off` reklamı kapatır. Yayın sürümünde bu parametreler yok sayılır.

Reklam hatasında (`adError`) ödül verilmez ve neden oyuncuya yazılır. `adsDisabledBasicLaunch` ya da `adblock` gelirse reklam düğmeleri o oturumda kaldırılır (basılıp iş görmeyen düğme kalmaz).
