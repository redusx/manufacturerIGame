# UI_UX_SYSTEM.md — Arayüz Sistemi (UI/UX 2.0)

> **Kapsam:** Oyundaki bütün arayüzün (HUD, araç çubuğu, pencereler, uçuş ekranı) nasıl kurulduğu,
> hangi kurallara uyduğu ve yeni bir ekran eklerken nelere dikkat edileceği.
> Piksel sanat, palet ve grid kuralları için `ART_DIRECTION.md` bağlayıcıdır; bu belge onun üstüne
> yerleşim, ölçek, girdi ve bileşen kurallarını ekler. `UI_STYLE_SPEC.md` ile çeliştiği yerde bu belge geçerlidir.
>
> **Durum:** 2026-10-06'da uygulandı ve tarayıcıda doğrulandı (bkz. §17). Oynanış, ekonomi ve ilerleme kuralları değişmedi.

---

## 1. Tasarım İlkeleri

1. **Tek sistem.** Her ekran aynı bileşenlerden (`UiButton`, `UiModal`, `UiWidgets`) ve aynı tema değerlerinden (`theme.ts`) kurulur. Ekrana özel düğme, panel ya da yazı boyutu tanımlanmaz.
2. **Önce okunabilirlik.** Yazılar cihazın gerçek çözünürlüğünde çizilir; en küçük arayüz yazısı 11 birimdir. Simge yerine emoji kullanılmaz; simgeler 16x16 piksel sanat dokularıdır.
3. **Her ekran boyutunda aynı oyun.** Düzen sabit koordinatlarla değil, `UiMetrics`'in verdiği genişlik/yükseklik/mod ile hesaplanır. Dar ekranda içerik küçülmez; pencere kaydırılır.
4. **Dokunma, fare ve klavye eşit.** Her eylem üçüyle de yapılabilir; dokunma hedefi en az 44 birimdir.
5. **Bir ekranda bir ana eylem.** Yeşil (primary) düğme pencere başına bir tanedir; tehlikeli eylem kırmızıdır ve onay ister.
6. **Sahte bilgi yok.** Hedef kartı, aşama listesi ve göstergeler gerçek ilerleme durumundan beslenir.

---

## 2. Mimari

```
UiMetrics (saf hesap)  →  UiHost (tuval, ölçek tercihi, güvenli alan)  →  UiLayer (sahne başına)
                                                                              ├─ UiButton
                                                                              ├─ UiModal  ← bütün pencereler
                                                                              ├─ UiWidgets (çubuk, rozet, kart, bildirim)
                                                                              └─ UiConfirmDialog
```

| Dosya | Sorumluluk |
|---|---|
| `src/ui/system/UiMetrics.ts` | Saf hesap: çizim çözünürlüğü, ölçek kademeleri, düzen modu, güvenli alan. Phaser'a bağlı değildir. |
| `src/ui/system/UiHost.ts` | Tekil yönetici: pencere boyutunu dinler, tuvali boyutlandırır, arayüz ölçeği tercihini `localStorage`'da tutar, değişimi dinleyenlere bildirir. |
| `src/ui/system/UiLayer.ts` | Sahne başına arayüz katmanı: arayüz kamerası, dünya/arayüz ayrımı, net yazı, pencere yığını, klavye odağı. |
| `src/ui/system/UiButton.ts` | Tek düğme bileşeni (türler, durumlar, simge, alt etiket, odak halkası). |
| `src/ui/system/UiModal.ts` | Bütün pencerelerin temel sınıfı (alt sayfa / ortalanmış panel, kaydırma, kapatma). |
| `src/ui/system/UiWidgets.ts` | İlerleme çubuğu, rozet (chip), kart, ayraç, bildirim (toast). |
| `src/ui/system/UiConfirmDialog.ts` | Onay penceresi. |
| `src/ui/theme.ts` | Palet, anlamsal renkler, yazı ölçeği, boşluklar, doku anahtarları. |
| `src/ui/HUD.ts`, `ObjectiveCard.ts`, `Toolbar.ts`, `ToolContextBar.ts` | Fabrika ekranının kalıcı arayüzü. |
| `src/ui/BuildMenuModal.ts`, `RocketHangarView.ts`, `StagesModal.ts`, `SettingsPanel.ts`, `TerminalInspectorModal.ts`, `OfflineEarningsModal.ts`, `src/factory/view/MachineInspectorModal.ts` | Pencereler. |
| `src/ui/FlightHud.ts`, `FlightReportModal.ts` | Uçuş ekranı arayüzü. |
| `tools/generate_ui_assets.py` | Arayüz dokularını üreten betik (§15). |

### Dünya / arayüz ayrımı

Her sahnede iki tür kamera vardır: **dünya kamerası** (fabrika ya da uçuş; kaydırılır, yakınlaşır) ve **arayüz kamerası** (sabit, arayüz ölçeğinde). Sahneye eklenen her nesne varsayılan olarak dünyaya aittir. Arayüz kökleri `UiLayer.container()` / `UiLayer.adopt()` ile katmana verilir; katman onları dünya kameralarından, dünya nesnelerini arayüz kamerasından gizler. Efektler `FxSpace = 'world' | 'ui'` ile hangi uzayda oynayacağını belirtir.

---

## 3. Çizim Çözünürlüğü ve Arayüz Birimi

- Tuvalin arka belleği = CSS boyutu × `renderScale`. `renderScale` cihaz piksel oranıdır; en fazla 3'tür ve tuval yaklaşık 4K (8,4 milyon piksel) bütçesini aşmayacak şekilde düşürülür.
- Arayüz **birim** cinsinden yerleştirilir (`ui.width`, `ui.height`). Arayüz kamerasının zoom'u bir birimin kaç cihaz pikseli olduğunu söyler ve her zaman 0,5'in katıdır (`ART_DIRECTION.md` §3).
- Yazılar kamera zoom'u kadar çözünürlükte üretilir (`UiLayer.text`); bu yüzden yüksek DPI ekranda bulanıklaşmaz. Dünya üzerindeki yazılar fabrika kamerasının zoom'una göre yeniden üretilir.
- Kural: arayüz kodunda `scene.scale.width/height` ya da tuval pikseli kullanılmaz; her zaman `UiLayer` ölçüleri kullanılır.

---

## 4. Arayüz Ölçeği

Ayarlar → **Arayüz Ölçeği**: Küçük / Normal / Büyük / Çok Büyük. Tercih `manufacturer_ui_prefs_v1` anahtarıyla kaydedilir ve anında uygulanır (yeniden yükleme gerekmez).

- **Normal**, ekranda en az 360x600 (dikey) ya da 800x450 (yatay) birimlik alan görünecek en büyük zoom'dur; bir birim hiçbir zaman bir CSS pikselinden küçük olmaz.
- Diğer kademeler Normal'in 0,8 / 1,2 / 1,4 katıdır ve 0,5 adımına yuvarlanır.
- Ölçek, arayüz ekranını 300x480 (dikey) / 480x300 (yatay) birimin altına düşürecek kadar büyüyemez. Bu yüzden küçük telefonlarda "Çok Büyük" bir önceki kademeyle aynı sonucu verir; Ayarlar bu kademeyi kapalı gösterir ve nedenini yazar.

Ölçülen sonuçlar (cihaz piksel oranı 2; zoom → arayüz ekranı):

| Ekran (CSS) | Küçük | Normal | Büyük | Çok Büyük |
|---|---|---|---|---|
| 375x812 | 1,5 → 500x1083 | 2 → 375x812 | 2,5 → 300x650 | kullanılamaz |
| 390x844 | 1,5 → 520x1125 | 2 → 390x844 | 2,5 → 312x675 | kullanılamaz |
| 812x375 | 1,5 → 1083x500 | 2 → 812x375 | 2,5 → 650x300 | kullanılamaz |
| 844x390 | 1,5 → 1125x520 | 2 → 844x390 | 2,5 → 675x312 | kullanılamaz |
| 768x1024 | 2,5 → 614x819 | 3 → 512x683 | 3,5 → 439x585 | 4 → 384x512 |
| 1024x768 | 2 → 1024x768 | 2,5 → 819x614 | 3 → 683x512 | 3,5 → 585x439 |
| 1280x720 | 2,5 → 1024x576 | 3 → 853x480 | 3,5 → 731x411 | 4 → 640x360 |
| 1366x768 | 2,5 → 1093x614 | 3 → 911x512 | 3,5 → 781x439 | 4 → 683x384 |
| 1920x1080 | 3,5 → 1097x617 | 4,5 → 853x480 | 5,5 → 698x393 | 6,5 → 591x332 |
| 2560x1080 | 3 → 1280x540 | 3,5 → 1097x463 | 4 → 960x405 | 5 → 768x324 |

(2560x1080'de piksel bütçesi nedeniyle `renderScale` 1,5'e iner.)

---

## 5. Düzen Modları

Mod, arayüz ekranının **birim** cinsinden boyutuna göre seçilir; bu yüzden ölçek büyütülünce düzen de kendiliğinden daha sıkı moda geçer.

| Mod | Koşul | HUD | Hedef | Araç çubuğu | Pencereler |
|---|---|---|---|---|---|
| `portrait` | yükseklik ≥ genişlik | üstte tek satır | HUD'un altında kart | altta, tam genişlik | alttan açılan sayfa (bottom sheet) |
| `landscape` | genişlik > yükseklik, yükseklik ≥ 430 | üstte tek satır | HUD'un içinde şerit | altta ortalanmış | ortalanmış panel |
| `landscapeCompact` | genişlik > yükseklik, yükseklik < 430 | üstte tek satır | HUD'un içinde şerit | sağda dikey | ortalanmış panel, gövdesi kaydırılır |

Ek kırılımlar bileşenlerin içindedir: katalog 1 / 2 / 3 sütun (560 ve 900 birim), hangar 600 birimden geniş pencerede iki sütun, rekor göstergesi 560 birimden dar HUD'da gizlenir.

---

## 6. Güvenli Alan

`index.html` `viewport-fit=cover` kullanır. `UiHost`, `env(safe-area-inset-*)` değerlerini okur ve birime çevirir (`metrics.safe`). HUD üstten, araç çubuğu alttan/sağdan, pencereler dört yandan bu boşlukları bırakır. Çentikli cihazda hiçbir düğme güvenli alanın dışına yerleşmez.

---

## 7. Renk Sistemi

Renkler `theme.ts` içindeki `PALETTE`'ten gelir; bileşenler doğrudan palet yerine **anlamsal** adları (`SEMANTIC`) kullanır.

| Anlam | Renk | Kullanım |
|---|---|---|
| `primary` | yeşil | Ekranın ana eylemi, satın alınabilir, olumlu sonuç |
| `secondary` | mavi-gri | Nötr eylem, vazgeçme, araç düğmeleri |
| `money` | altın | Para, fiyat, ödül, ilerleme dolgusu |
| `factory` | kehribar | Elle üretim, sevkiyat |
| `rocket` | camgöbeği | Hangar, uçuş, nitro |
| `warning` | turuncu | Uyarı, kilitli içerik |
| `danger` | kırmızı | Söküm, sıfırlama, hata, çakılma |
| `disabled` | koyu gri | Kullanılamayan düğme |

Renk tek başına bilgi taşımaz: her durumun yanında simge ya da metin vardır (kilit simgesi, "Çalışıyor" yazısı, onay işareti).

---

## 8. Tipografi

Yazı ailesi `Arial, Helvetica, sans-serif` (`ART_DIRECTION.md` §5). Boyutlar birim cinsindendir ve yalnızca `TYPE_SCALE` türleriyle kullanılır:

| Tür | Boyut | Kullanım |
|---|---|---|
| `display` | 22 kalın | Para, büyük sayılar |
| `title` | 18 kalın | Pencere başlığı |
| `heading` | 15 kalın | Kart başlığı |
| `button` / `buttonSmall` | 14 / 12 kalın | Düğme etiketi |
| `body` / `bodyBold` | 13 | Açıklama, değer |
| `caption` / `captionBold` | 11 | İkincil bilgi, bölüm başlığı |

Uzun metin sığmazsa önce yazı küçültülür (`UiLayer.fit`, en az 12; hangar parça adında 9), yetmezse "…" ile kısaltılır (`UiLayer.ellipsize`). Sabit genişlikli alana ham metin basılmaz.

---

## 9. Boşluk ve Dokunma Hedefi

- Boşluklar `SPACE`: 4 / 8 / 12 / 16 / 24.
- `TOUCH_MIN = 44`: her düğmenin dokunma alanı görünür boyutu daha küçük olsa da en az 44x44 birimdir.
- Yan yana düğmeler arasında en az 8 birim boşluk bırakılır.

---

## 10. Düğme Hiyerarşisi

Tek bileşen: `UiButton`. Türler: `primary`, `secondary`, `gold` (parayla kestirme), `rocket`, `factory`, `danger`. Kullanılamayan düğme `disabled` dokusuna geçer.

- **Durumlar:** normal, üzerinde (fare), basılı (2 piksel aşağı kayar), seçili (altın çerçeve), odakta (beyaz halka), devre dışı.
- Düğme **bırakışta** tetiklenir; basıştan sonra 10 birimden fazla sürüklenirse iptal olur (kaydırma sırasında yanlış basış olmaz).
- Devre dışı düğmeye basmak sessiz kalmaz: düğme sarsılır ve neden kullanılamadığı bildirimle söylenir.
- Fiyat ya da sonuç düğmenin alt etiketinde yazar ("KUR / $100", "SÖK / +$215 iade").

---

## 11. Pencere Politikası

Bütün pencereler `UiModal`'dan türer; kendi karartmasını, başlığını, kapatma düğmesini, kaydırmasını ve klavye davranışını oradan alır.

- **Dikey ekranda** alttan açılan tam genişlikte sayfa; **yatay ekranda** ortalanmış panel.
- Başlık ve alt düğme şeridi sabittir; yalnızca gövde kayar (sürükleme, tekerlek, PageUp/PageDown/Home/End). Kaydırma olduğunda sağda altın tutamaç görünür.
- Kapatma: X düğmesi, dışarıya (karartmaya) dokunma, Esc. Kapatılamayan tek pencere uçuş raporudur.
- Pencere açıkken dünya girdisi ve araç kısayolları kapalıdır. Pencereler yığın hâlinde açılabilir (ör. Ayarlar → silme onayı); girdiyi en üstteki alır.
- Pencere açılınca ekrandaki eski bildirim kaldırılır.
- Geri alınamayan ya da pahalı eylemler `UiConfirmDialog` ile sorulur: kaydı sıfırlama, fabrika zeminindeki rozetten parsel satın alma. Tehlikeli onayda Enter "Vazgeç"i seçer.

---

## 12. Girdi Politikası

**Öncelik:** en üstteki pencere → arayüz düğmeleri → etkin araç (yerleştirme/söküm) → dünya (makine, bant, zemin) → kamera.

### Dokunma
- Dokunuş = basıp yerinde bırakma (8 CSS pikselinden az hareket). Makine, bant, zemin ve parsel rozeti basışta değil **bırakışta** tepki verir; üzerlerinde başlayan kaydırma tıklama sayılmaz.
- Tek parmakla sürükleme fabrikayı kaydırır; iki parmak yakınlaştırır ve kaydırır (araç etkinken de). İki parmak hareketi sırasında ve bittiği anda tıklama üretilmez.
- Yerleştirme: hücreye dokun → hayalet görünür (yeşil uygun, kırmızı uygun değil) → **Onayla**. Bant, dokunup sürükleyerek çizilir.
- Söküm: nesneye dokun → kırmızı işaret ve iade tutarı → **Onayla**.

### Fare
- Üzerine gelince düğme ve el imleci tepki verir. Tekerlek fabrikayı imlecin altındaki noktaya doğru yakınlaştırır, pencerede gövdeyi kaydırır. Sağ tık etkin aracı iptal eder.
- Farede yerleştirme ve söküm tek tıkla yapılır (hayalet imleci izler).

### Klavye

| Tuş | Eylem |
|---|---|
| Boşluk / 1 | Elle üret |
| 2 | Bant aracı |
| 3 / B | İnşa kataloğu |
| 4 / X | Söküm aracı |
| 5 / H | Hangar (açıldıysa) |
| R | Yerleştirirken döndür |
| Esc | Pencereyi kapat / aracı iptal et |
| W A S D / ok tuşları | Fabrikayı kaydır (pencere kapalıyken) |
| Tab / Shift+Tab | Odağı sıradaki / önceki düğmeye taşı |
| Ok tuşları (pencere açıkken) | Odağı o yöndeki düğmeye taşı |
| Enter / Boşluk | Odaktaki düğme; odak yoksa pencerenin ana eylemi |
| PageUp / PageDown / Home / End | Pencere gövdesini kaydır |
| Boşluk (uçuşta) | Fırlat / nitro |

Fare ya da dokunma kullanılınca odak halkası gizlenir. Her tuş olayı tam bir kez işlenir (`main.ts`; Phaser aynı adımda gelen tuşları kuyruktan yeniden işlediği için eklenmiştir).

---

## 13. Ekranlar

- **HUD:** para (en büyük öğe), ölçülen gelir `/sn`, yatayda hedef şeridi ve rekor, ayarlar düğmesi.
- **Hedef kartı:** etkin aşama, sıradaki koşul, gerçek sayaç ve ilerleme çubuğu, ödül. Dokununca **Aşamalar** penceresi açılır (10 aşamanın tamamı: bitti / sürüyor / kilitli).
- **Araç çubuğu:** ÜRET, BANT, İNŞA, SÖK, HANGAR. Etkin araç altın çerçeveyle işaretlenir; hangar kilitliyken kilit simgesi gösterir.
- **Bağlam çubuğu:** araç etkinken araç çubuğunun üstünde ne yapılacağını söyler; döndür / onayla / iptal düğmeleri buradadır. Fabrika, çubuğun kapladığı alanın üstüne sığdırılır.
- **İnşa kataloğu:** Lojistik, Makineler, Hammadde Girişleri, Genişleme, Taşıma bölümleri; kilitli kartlar hangi aşamada açılacağını yazar.
- **Makine penceresi:** durum ve seviye → üretim hızı ve reçete akışı (gerçek eşya adları ve simgeleri) → reçete seçimi → depo → yükseltme; altta SÖK ve YÜKSELT.
- **Hangar:** roket önizlemesi, özellik rozetleri, rekor ve sıradaki mesafe hedefi, modül kartları (parça ilerlemesi, duruma göre YÜKSELT / HIZLI İNŞA / neden kapalı), altta UÇUŞU BAŞLAT.
- **Ayarlar:** arayüz ölçeği, ses, tam ekran (destekleniyorsa), klavye kısayolları (yatay ekranda), kaydı sıfırla.
- **Uçuş:** üstte mesafe / irtifa / hız / kazanç, altında gövde ve yakıt çubukları, kalkıştan önce fırlatma gücü göstergesi, kalkıştan sonra basılı tutulan nitro düğmesi; sonunda uçuş raporu.

---

## 14. Geri Bildirim, Erişilebilirlik ve Performans

**Geri bildirim.** Bildirim (toast) türleri: bilgi, başarı, uyarı, tehlike, ödül; her birinin rengi ve simgesi vardır. Para kazanımı HUD'a uçan sikkeyle, aşama tamamlanması konfeti ve kart parlamasıyla, reddedilen eylem sarsıntı ve açıklamayla gösterilir.

**Erişilebilirlik.**
- En küçük yazı 11 birim; ölçek dört kademede büyütülebilir.
- Açık zeminde koyu, koyu zeminde açık yazı (`textOnBright` / `textOnDark`); renk tek başına anlam taşımaz.
- Her eylem klavyeyle yapılabilir; odak halkası görünürdür.
- Dokunma hedefi en az 44 birim; yıkıcı eylemler onaylıdır.

**Performans.**
- Her karede nesne oluşturulmaz/yok edilmez. Göstergeler yalnızca değeri değişince yeniden yazılır; makine penceresi 100 ms'de bir, dünya yazılarının çözünürlüğü 200 ms'de bir güncellenir.
- Pencere içeriği açılışta, yeniden boyutlanmada ve içerik değişince kurulur.
- Tuval piksel bütçesi (§3) çok büyük ekranlarda dolgu yükünü sınırlar.

---

## 15. Arayüz Dokuları

`python3 tools/generate_ui_assets.py` komutu `public/assets/ui/` altına 48 PNG üretir (Pillow gerekir):

- Düğmeler: `btn_{primary,secondary,rocket,factory,gold,danger}_{normal,hover,pressed}.png`, `btn_disabled_normal.png` — 24x24, 9 dilim (4/4/4/6).
- 22 beyaz, renklendirilebilir 16x16 simge.
- Çerçeve, ince çerçeve, rozet, başlık şeridi, tek piksel dolgu, kaydırma tutamacı, seviye noktası.

Dokular `theme.ts` içindeki `UI_TEXTURES` listesinden yüklenir; yeni doku eklenirken betik ve liste birlikte güncellenir. Renkler betikte de `theme.ts` paletiyle aynıdır.

---

## 16. Yeni Ekran Eklerken

1. Pencere ise `UiModal`'dan türet; `buildBody` / `buildFooter` yaz, ana düğmeyi `primaryButton()` ile bildir.
2. Yazıları `layer.text(…, tür)` ile, düğmeleri `UiButton` ile oluştur; renkleri `SEMANTIC`'ten al.
3. Konumları `layer.metrics` üzerinden hesapla; `onLayout` içinde yeniden yerleştir.
4. Uzun metinleri `UiLayer.fit` / `ellipsize` ile sığdır.
5. 375x812, 812x375 ve masaüstünde; Normal ve en büyük kullanılabilir ölçekte aç; dokunma, fare ve klavyeyle dene.

---

## 17. Doğrulama (2026-10-06)

Gerçek tarayıcıda, cihaz piksel oranı 2 ile; dokunma akışları dokunmatik öykünmesinde sentetik dokunma olaylarıyla sınandı.

| Ekran | Elle oynanan akışlar | Otomatik taşma denetimi* |
|---|---|---|
| 375x812 | açılış, HUD, katalog (kaydırma), makine yerleştirme (Onayla), söküm (Onayla), iki parmakla zoom, makine penceresi, yükseltme, hangar, uçuş + rapor + dönüş, ayarlar, silme onayı, ölçek değişimi ve kalıcılığı, kayıt/yükleme | 3 ölçek temiz |
| 390x844 | açılış | 3 ölçek temiz |
| 812x375 | açılış, katalog (tekerlek), hangar, makine penceresi, uçuş + rapor, klavye kısayolları | 3 ölçek temiz |
| 844x390 | açılış | 3 ölçek temiz |
| 768x1024 | açılış, katalog, hangar | 4 ölçek temiz |
| 1024x768 | aşamalar, terminal, taşıma, söküm, parsel onayı ve satın alma, klavye odağı, fare üzerine gelme, tekerlek zoom | 4 ölçek temiz |
| 1280x720, 1366x768, 1920x1080, 2560x1080 | açılış | 4 ölçek temiz |

\* Ana ekran ve altı pencere (katalog, makine, terminal, hangar, ayarlar, aşamalar) açılıp ekran dışına taşan ya da "…" ile kısalan yazı arandı.

---

## 18. Bilinen Sınırlamalar

- Yerleştirme hayaleti ve söküm vurgusu hâlâ Phaser Graphics ile çizilir (piksel doku değil).
- Müzik olmadığı için müzik ayarı yoktur; yalnızca ses efektleri açılıp kapatılır.
- Telefonda 12x8 fabrika rahat dokunulabilir zoom'da yatayda bir hücreden az taşar; kaydırılarak görülür. Büyük parsellerde (20x16 ve üzeri) hücreler küçülür; iki parmakla yakınlaştırılır.
- Fabrika üzerindeki giriş adı ve seviye etiketleri uzak zoom'da küçük kalır (parsel rozeti zoom'dan bağımsızdır).
- Güvenli alan boşlukları kodda uygulanır ama çentikli gerçek cihazda sınanmadı.
- Ekran okuyucu desteği yoktur (arayüz tuval üzerinde çizilir).
- Arayüz metinleri yalnızca Türkçedir.
