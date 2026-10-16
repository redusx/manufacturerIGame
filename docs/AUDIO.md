# AUDIO.md — Müzik ve Ses Efektleri

## Kaynak ve lisans

Oyunda **hiç ses dosyası yoktur**. Müzik ve efektlerin tamamı tarayıcıda Web Audio API ile
anlık sentezlenir:

| Ne | Nerede |
|---|---|
| Ses yöneticisi, efektler, kanallar, müzik zamanlayıcısı | `src/audio/SoundManager.ts` |
| Müzik besteleri (notalar, çalgılar) | `src/audio/music.ts` |

Besteler ve efektler bu proje için yazılmıştır; harici örnek, kayıt, ses kütüphanesi veya
üçüncü taraf parça kullanılmamıştır. Lisans durumu oyunun kendi kaynak koduyla aynıdır;
ayrıca atıf veya lisans yükü yoktur. İndirilecek dosya olmadığı için yükleme süresine ve
derleme boyutuna etkisi birkaç KB koddur; ses kurulamazsa (eski tarayıcı, ses kapalı cihaz)
oyun sessiz devam eder.

Harici bir ses dosyası eklenirse kaynağı ve lisansı bu tabloya yazılmalıdır.

## Müzik

| Parça | Ne zaman | Karakter |
|---|---|---|
| `factory` — fabrika teması | Fabrika ekranı (oyun açılışı, uçuştan dönüş) | D dorian, 108 BPM, 32 ölçü (~71 sn): ritmik bas, makine tıslamaları, yumuşak arpej; 2. ve 4. bölümde melodi, 3. bölüm davulsuz "nefes" |
| `flight` — fırlatma / uçuş teması | Hangarda "Fırlat"a basılınca: rampa (güç çubuğu) ve uçuş | E minör, 132 BPM, 16 ölçü (~29 sn): dolgu ve nabız gibi bas gerilim kurar, ikinci yarıda davul ve arpej |

- Döngü nota düzeyindedir: son adımdan sonra ilk adım aynı ritimle gelir, boşluk yoktur.
- Aynı anda tek ana müzik çalar: eski parça 0.6 sn'de söner, ardından yenisi 1.6 sn'de açılır.
- Uçuş bitince (çakılma, patlama, yakıt sonu) uçuş müziği söner; fabrika teması dönüşte açılır.
- Sahne yeniden kurulduğunda (dil değişimi, kayıt sıfırlama) çalan parça baştan başlamaz.
- Tarayıcı kuralı: ses ilk tıklama/dokunuş/tuşla açılır; müzik o an başlar. Sekme gizlenince
  ses durur, dönünce sürer. Reklam sırasında her şey susar.

## Efektler

| Olay | Yöntem | Not |
|---|---|---|
| Sevkiyat geliri | `playIncome` | Yumuşak iki notalı çınlama, eski para sesinin ~%20'si; en az 1.4 sn arayla (aşağıda) |
| Elle üretim, uçuşta parça toplama | `playCoin` | Eski para sesi |
| Roket fırlatma (rampadan kalkış) | `playLaunch` | Ateşleme çatırtısı → açılan motor gürlemesi → yükselen itki tonu (~1.8 sn) |
| Nitro | `playNitro` | Yalnız basıldığı anda; 180 ms içinde tekrar çalmaz |
| Engel teması (uçuş sürer) | `playHit` | Metalik darbe |
| Yere çakılma | `playCrash` | Tok, alçak darbe; ardından patlama |
| Patlama (çakılma veya ölümcül engel) | `playExplosion` | Kapanan süzgeçli gürleme + alçak gümbürtü + küçük çatırtılar |
| Düğme, yükseltme, kilometre taşı, söküm | `playClick`, `playUpgrade`, `playMilestone`, `playDemolish` | Değişmedi |

### Sevkiyat geliri sesi

Ekonomi ve sevkiyat değişmedi; yalnız ses seyreltildi. İlk satışta çınlama hemen çalar.
Sonraki 1.4 sn içinde gelen satışlar ses çıkarmaz ama kaybolmaz: süre dolunca hepsini tek bir
çınlama temsil eder. Yoğun üretimde (ör. saniyede 8 satış) duyulan, 1.4 saniyede bir yumuşak
çınlamadır. Sabitler: `INCOME_SOUND_COOLDOWN_MS`, `INCOME_LEVEL` (`SoundManager.ts`).

## Ayarlar ve seviyeler

Ayarlar penceresinde iki satır: **Müzik** ve **Ses efektleri**. Her birinde sessize alma
düğmesi, −/+ (%5 adım) ve sürüklenebilir çubuk vardır. Tercihler tarayıcıda saklanır (kayıt
dosyasına girmez):

| Anahtar | Varsayılan |
|---|---|
| `manufacturer_music_volume` / `manufacturer_music_muted` | %60 / açık |
| `manufacturer_audio_volume` / `manufacturer_audio_muted` (efektler; eski ses ayarı buraya devam eder) | %100 / açık |

Kanal kazançları: efektler 0.3 × seviye, müzik 0.2 × seviye. Varsayılanda müziğin en yüksek
anı (davul + bas) bir yükseltme sesi kadardır; ortalama seviyesi efektlerin belirgin altındadır.
Gelir çınlaması bilerek en sessiz efekttir.
