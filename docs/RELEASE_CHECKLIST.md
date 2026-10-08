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

- [ ] `npm run build` çıktısını CrazyGames geliştirici paneline yükle ve QA aracında aç.
- [ ] QA aracında beş yerleşimi tek tek dene: ödül geliyor, bekleme süresi başlıyor, reklam kapatılınca ödül gelmiyor.
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
| Başka alan adı, geliştirme sürümü | `mock` | "REKLAM ALANI" katmanı; ödül bedava |
| Başka alan adı, yayın sürümü | `off` | Reklam düğmeleri çizilmez |

Geliştirme sürümünde `?ads=off`, `?ads=mock`, `?ads=fail` ile zorlanabilir; yayın sürümünde bu parametreler yok sayılır.
