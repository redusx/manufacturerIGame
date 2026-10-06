# PROJECT_STATUS.md — Manufacturer Proje Durumu

> **ÖNEMLİ KURAL:** Her yeni oturum/context açılışında İLK okunacak dosyadır.
> Her tamamlanan görevden sonra bu dosya güncellenmelidir.

---

## GÜNCEL DURUM — REVIVAL (2026-10-06)

2026-10-06'da kod ve gerçek tarayıcı oynanışı üzerinden denetim yapıldı. Aşağıdaki "TARİHSEL DURUM" bölümündeki "%100 tamamlandı / yayına hazır" iddiaları **doğrulanamadı**: teknik iskelet sağlam, ama oyun döngüsü kırık (fabrika $1/sn, 20 sn'lik uçuş $1.750; 21 eşyanın 6'sı üretilebiliyor; fabrika rokete parça göndermiyor; ~5.500 satır sahneye bağlı olmayan kod).

**Çalışma kuralı:** Dokümana değil koda ve tarayıcıdaki oynanışa güven. Birim testinin geçmesi oynanışın çalıştığı anlamına gelmez. Her milestone tarayıcıda sıfır kayıtla doğrulanır, sonra durulur.

**Sabit tasarım kararları:** `DECISIONS.md` DEC-011 … DEC-016.

| # | Milestone | Durum |
|---|---|---|
| M1 | Girdi ve açılış hataları | **TAMAMLANDI** (2026-10-06, tarayıcıda doğrulandı, commit `4da3de2`) |
| M2 | Kamera ve okunabilirlik (sığdırma/ortalama, imleç merkezli zoom, mobil pencereler, tarif adları ve seçimi, hangar metni) | **TAMAMLANDI** (2026-10-06, tarayıcıda doğrulandı, commit `56b9d04`) |
| M3 | Tek ekonomi (iade istismarı, gerçek $/sn, eski idle ekonominin akıştan çıkarılması, çevrimdışı gelir) | **TAMAMLANDI** (2026-10-06, commit `257591f`) |
| M4 | İlerleme omurgası (10 aşamalı müfredat sahnede, somut görevler, makine/hangar kilitleri) | **TAMAMLANDI** (2026-10-06, tarayıcıda doğrulandı) |
| M5 | Hammaddeler (bakır, kum, polimer girişleri aşamayla açılır; ek giriş satın alınarak hammadde artırılır) | **TAMAMLANDI** (2026-10-06, tarayıcıda doğrulandı, commit `704e118`) |
| M6 | Roket bağlantısı (fabrika → hangar parça akışı, uçuş ödülü, uçuşta fabrika çalışır) | **TAMAMLANDI** (2026-10-06, tarayıcıda doğrulandı, commit `0a151f8`) |
| M7 | Denge geçişi (eşya değerleri, reçete süreleri, aşama eşik ve ödülleri) | **TAMAMLANDI** (2026-10-06; 1–3. aşamalar tarayıcıda, 1–9. aşamalar başsız simülasyonla ölçüldü, commit `7cc8aec`) |
| M8 | Sürükleyerek bant çizimi | **TAMAMLANDI** (2026-10-06, tarayıcıda fare ve dokunmatikle doğrulandı, commit `c58ef62`) |
| M9 | Uzun vade (kontratlar, roket sonrası kademeler) | **ERTELENDİ** (kullanıcı kararı, 2026-10-06). 10. aşamadan sonra oyunda yeni hedef yok; `ContractManager` depoda ama oyuna bağlı değil. |
| M10 | Temizlik ve yayın (ölü kod, doküman eşitleme, mobil düzen) | **TAMAMLANDI** (2026-10-06, tarayıcıda doğrulandı) |

* **Son doğrulama:** 2026-10-06 (M10) — `npm test` 262/262, `npx tsc --noEmit` 0 hata, `npm run build` başarılı; ayrıntı `IMPLEMENTATION_LOG.md` son girdi. (Test sayısı 285'ten 262'ye düştü: silinen ölü kodun 23 testi de silindi.)
* **Ekonominin şu anki kuralları** (sayılar: `ECONOMY.md`):
  - Tek kasa: `EconomyManager` (para + toplam kazanç). `FactoryEconomy` ona yazar.
  - Gelir = ihraç edilen eşyanın baz değeri × gelir çarpanı (uçuş kilometre taşları ve son aşama ödülü); kuruşa yuvarlanır.
  - İlerleme: `MilestoneManager`'daki 10 aşama. Koşullar sağlanınca aşama kendiliğinden tamamlanır, para ödülü verir ve makine/özellik açar.
  - Tıklama sabit $1'dir; hiçbir çarpan tıklamayı büyütmez (DEC-013).
  - Söküm iadesi %100'dür ama "toplam kazanç" sayılmaz; hedefleri ilerletmez.
  - Üstteki `/sn`, son 60 saniyenin ölçülmüş ihracat ortalamasıdır; çevrimdışı gelir kayıt anındaki bu hızla hesaplanır (en fazla 4 saat, %50 verim).
  - Kayıt sürümü 4; eski sürüm kayıtları taşınmaz, silinir (DEC-014).
* **Bant çizimi (M8):** Bant modunda basılı tutup sürüklemek hat çizer; her bant imlecin hücreden çıktığı yöne bakar, köşeler kendiliğinden döner. Tek tık/dokunuş tek bant döşer (R ile yön). Bant artık basınca değil bırakınca döşenir. Dolu hücreler atlanır; mevcut bandın yönü sürükleyerek değiştirilemez.
* **Bilinen açık sorunlar:**
  - **M6 sonrası roket kuralları (DEC-018):** Hangar açıkken, roketin sıradaki yükseltmesinin beklediği parça ihraç edilince satılmaz, hangara gider (ihtiyaç dolunca satış sürer). Uçuş roket parçası vermez. Uçuş primi = fabrikanın o anki $/sn geliri × kazanılan süre (40 m = 1 sn, 100 m irtifa = 1 sn, dişli 1 sn, kristal 3 sn, kaçınma 0,5 sn; en fazla 180 sn; taban $1/sn) ve "toplam kazanç" sayılmaz. Hızlı inşada eksik parça satış değerinin 4 katıdır. Uçuş dönüşünde fabrika geçen gerçek süre kadar (en fazla 10 dk) simüle edilir.
  - Uçuş mesafe kilometre taşları hâlâ kalıcı gelir çarpanı veriyor (toplam +%75); dengesi M7'de.
  - M6'da yalnız kısa bir uçuş (62 m, çakılma) oynandı; uzun uçuşta 180 sn sınırı ve kilometre taşı çarpanı ekranda doğrulanmadı. Dönüş telafisi 44 sn için ölçüldü, 10 dakikalık üst sınırda süre ölçülmedi.
  - **M5 sonrası hammadde kuralları:** Katalogdan yeni giriş kurulur (demir $500 / 3. aşama, bakır $1000 / 6. aşama, kum ve polimer $2500 / 9. aşama); her giriş 1 hammadde/sn verir, girişler sökülemez (yalnız taşınır). Giriş hızı yükseltmesi yoktur; hammadde artışı ek giriş kurarak sağlanır (DEC-017). Montaj tezgahının 3. giriş portu (batı) vardır.
  - **Reçete tuzağı:** Yeni kurulan makine ilk reçetesiyle başlar (kırıcı=demir, fırın=demir, kesici=bakır tel); yanlış reçetede hat sessizce tıkanır, oyuncu reçeteyi inceleme penceresinden seçmelidir.
  - **3 girdili reçeteler (yönlendirme bilgisayarı, itici blok) ekranda oynanmadı;** 2 girdili motor hattı, plastik ve optik cam ihracı doğrulandı.
  - **Uzak yakınlaştırmada (0.75x ve altı) giriş/makine etiketleri okunmuyor.**
  - **M7 sonrası denge (DEC-019):** Hedef, ilgili bir oyuncunun 10 aşamayı ~40–50 dakikada bitirmesidir (varsayım; kullanıcı onayı bekliyor). Hiç beklemeden kuran bot 9. aşamayı 15,6 dakikada bitiriyor (aşama başına 0,9–2,8 dk). "Toplam ciro" yalnız ihracat ve tıklamadan oluşur; aşama ödülü, uçuş primi ve iade sayılmaz.
  - 10. aşama (itici blok hattı, $30.000 parsel, $40.000 ciro) simüle edilmedi ve oynanmadı; süresi yalnız tahmindir (~10–15 dk ek).
  - Makine seviye yükseltmesi (maliyet ×1,15, hız +%20/seviye), uçuş mesafe çarpanları (+%75) ve roket yükseltme bedelleri M7'de değiştirilmedi.
  - **Giriş tuzağı:** Giriş, yanındaki her banda hammadde basar; girişin yanından geçen başka bir hattın bandı ham cevherle dolup tıkanır.
  - Sekme arka plandayken fabrika durur ve geri dönünce telafi edilmez; çevrimdışı gelir yalnız sayfa yeniden açılınca hesaplanır.
  - Dokunmatik: iki parmakla yakınlaştırma (pinch) yok; yerleştirme/söküm modunda kamera kaydırılamıyor. Büyük fabrikalarda (20x16 ve üzeri) telefonda hücreler çok küçülüyor.
  - Yatay telefon ekranı (812x375): pencereler sığıyor. Hangar iki sütuna geçer ve roket görselini gizler; makine inceleme penceresi küçültülerek sığdırılır (en fazla %70'e), bu ekranda yazıları 9px'in altına iner.
  - `factory_bg` arka plan dokusu iki kamera tarafından da yoksayıldığı için hiç çizilmiyor.

---

## TARİHSEL DURUM (2026-10-02, doğrulanmamış — yalnızca arşiv)

* **Current Phase:** MASTER PLAN VE OYNANABİLİR OYUN ENTEGRASYONU TAMAMLANDI (%100 Complete)
* **Current Task:** TASK-INT-07: Uçtan Uca Oynanış Doğrulaması (Full Loop Verification & Polish)
* **Task Status:** TAMAMLANDI VE %100 DOĞRULANDI (274/274 TEST GEÇTİ, 60 SUITE, 0 TS HATASI, VITE PRODUCTION BUILD BAŞARILI)
* **Gerçek Oynanabilirlik Durumu (System Verification Status):**
  - **Oynanabilir ve Uçtan Uca Doğrulanmış Sistemler (Integrated & Playable):**
    - [x] Retro Chiptune SFX (`SoundManager.ts`) — Web Audio API ses sentezleyici, tıklama, coin, yükseltme arpeji, fırlatma, iniş, darbe, fanfar; ayarlar menüsünden sessize alma desteği.
    - [x] Piksel FX Parçacıkları (`PixelParticleManager.ts`) — Tıklama floating text, konfeti, duman, patlama, altın ışıltılar.
    - [x] Çevrimdışı Gelir Modalı (`OfflineEarningsModal.ts`, `OfflineEarningsHelper.ts`) — 4h tavan, %50 baz verim, 2X CrazyGames ödüllü video butonu.
    - [x] CrazyGames SDK v3 (`CrazyGamesSDK.ts`) — Yaşam döngüsü (`gameplayStart`, `gameplayStop`, `happytime`), ses kısma/açma koordinasyonu, rewarded video reklamları.
    - [x] Parabolik Roket Uçuş Sahnesi (`FlightScene.ts`, `FlightReturnHelper.ts`) — İrtifa, mesafe, rampa mini-oyunu, toplanabilir yakıt kristalleri, tamir kitleri ve dişliler, engeller ve kaçınma, iniş/kaza, hurda/kristal ganimet aktarımı, mesafe kilometre taşları (+%30 fabrika gelir çarpanı) ve skor raporu.
    - [x] Temel Arcade Manuel Tıklama ve Hedef Çubuğu (`EconomyManager.ts`, `HUD.ts`, `MilestoneBar.ts`).
    - [x] Roket Hangarı & Tekil Ekonomi Senkronizasyonu (`EconomyManager.ts`, `FactoryEconomy.ts`, `RocketHangarBridge.ts`, `RocketHangarView.ts`) — Tek kaynak (single source of truth), eksik parçalar için hızlı inşa (quick build), uçuş ganimeti havacılık parçası teslimatı, anında görsel ve istatistik güncellemesi, `SaveManager` ile kalıcı roket seviyeleri.
    - [x] 2D Izgara ve Zemin Render'ı (`GridView.ts`, `GridCoordinates.ts`, `GridMap.ts`) — 24x24 fabrika ızgarası, 8x8 başlangıç parseli, zemin karoları, ızgara çizgileri, sabit hammadde INTAKE ve roket yakıt EXPORT terminalleri `GameScene` üzerinde aktif olarak render ediliyor.
    - [x] Fabrika Katı Kamera Kontrolleri (`CameraController.ts`, `CameraMath.ts`) — Mouse drag, WASD, tekerlek zoom kontrolleri `GameScene` içine entegre edildi. UI sabit tutulurken (`cameras.main`), fabrika katı bağımsız `factoryCamera` ve dinamik viewport/clamped bounds ile çalışıyor. Parsel genişletme (`unlockPlot`) canlı olarak fabrika zeminini genişletip kaydediyor.
    - [x] 2D Konveyör Render ve Parçacık Akışı (`ConveyorRenderer.ts`, `ItemFlowAnimator.ts`, `ItemSpritePool.ts`) — `GameScene` render döngüsüne bağlandı; bant döşemeleri, 90° virajlar ve üzerindeki cevher/toz eşyaları 60 FPS hızında pürüzsüz kayıyor.
    - [x] Tick Tabanlı Üretim ve Lojistik Motoru (`ProductionEngine.ts`, `LogisticsNetwork.ts`, `MachineRenderer.ts`, `MachineStatusIndicator.ts`) — `GameScene.update` içinde tick ediliyor. INTAKE'ten çıkan demir cevheri konveyörle Kırıcı'ya (Crusher) taşınıyor, makine üretime geçip kıvılcım saçıyor, demir tozu çıkış bandıyla EXPORT terminaline ulaşıp otomatik satılıyor ve HUD'a altın jeton uçuyor.
    - [x] Fabrika Izgara Kayıt/Yükleme Serileştiricisi (`FactorySerializer.ts` & `SaveManager.ts` v3 `factoryLayout` alanı) — Konveyörler, makineler, slotlar ve tamponlar oturumlar arası %100 kaydedilip geri yükleniyor.
    - [x] Alt İnşa Araç Çubuğu ve Canlı Yerleşim Kontrolcüsü (`PlacementController.ts`, `PlacementMath.ts`, `BuildMenuModal.ts`, `GameScene.ts`) — Alt konsolda 4 butonlu modern arcade dock: `[MANUEL ÜRET]`, `[BANT DÖŞE ($5)]`, `[MAKİNE KUR]`, `[HANGAR]`. `BuildMenuModal` ile 6 makine (Kırıcı, Fırın, Pres, Kesici, Montajcı, Rafineri) ve 3 lojistik birimi seçilip canlı hayalet önizleme (ghost preview), port yön okları, yeşil/kırmızı geçerlilik renklendirmesi, $R$ döndürme ve ESC/sağ tık iptal desteği ile ızgaraya inşa ediliyor; bakiye düşülüyor, konveyör/makine render katmanları anında güncelleniyor ve oyuna kaydediliyor.
    - [x] Yıkım ve %100 Sermaye İade Aracı (`DemolishTool.ts`, `DemolishMath.ts`, `GameScene.ts`) — Klavyeden `X` tuşu veya `BuildMenuModal` içindeki `[SÖK (X)]` butonuyla açılan söküm modu; tehlike desenli (hazard X) kırmızı hayalet vurgusu, fare altındaki makine/bant/lojistik öğesini algılama, korumalı INTAKE/EXPORT terminallerini koruma, DEC-007 uyarınca %100 sermaye ve yükseltme iadesi ile ızgara/simülasyondan kaldırma, söküm ses efekti (`sound.playDemolish`) ve kırmızı kıvılcım geri bildirimi ile kaydedilerek tam entegre edildi.
    - [x] Makine İnceleme ve Yükseltme Modalı (`MachineInspectorModal.ts`, `MachineInspectorHelper.ts`, `GameScene.ts`) — Fabrika zeminindeki herhangi bir makineye tıklandığında açılan detay penceresi; anlık durum (ÇALIŞIYOR, GİRDİ BEKLİYOR vb.), hız çarpanı, canlı girdi/çıktı tampon doluluk çubukları, desteklenen reçeteler arası tek tıkla geçiş yapabilen reçete çipleri, seviye yükseltme ($Base \times 1.15^{lvl}$, +%20 hız artışı) ve doğrudan makineyi %100 iadeyle söken yıkım butonu ile `GameScene` render döngüsüne entegre edildi.
    - [x] Parsel Genişletme ve Fabrika Kayıt/Yükleme Entegrasyonu (`PlotExpansionManager.ts`, `SaveManager.ts` v3, `GameScene.ts`, `GridView.ts`) — Fabrikanın kademeli $8\times 8 \rightarrow 12\times 8 \rightarrow 16\times 12 \rightarrow 20\times 16 \rightarrow 24\times 24$ genişlemesi, kural denetimli sıralı kilit açılımı, yeni açılan karolarda altın dalga parçacık efekti ve tebrik sancağı (`playUnlockCelebration`), `PlacementMath` ile dinamik inşa sınır genişlemesi, `loadGame` sırasında kamera sınırlarının senkronizasyonu ve bozuk kayıt kurtarma altyapısı tam doğrulandı.
    - [x] Uçtan Uca Oynanış Doğrulaması (`FullGameLoopIntegration.test.ts`) — Sıfır durum -> Başlangıç 8x8 fabrikası -> Manuel tıkla-kazan -> Otomatik konveyör ve kırıcı üretimi -> İhracat geliri -> Makine seviye geliştirme (+%20 hız) & %100 iade yıkım -> Alt katalogdan yeni makine/bant inşası -> Plot 1 ($500) açılımı ile inşa alanının 12x8'e büyümesi -> Hangar modül geliştirmeleri -> Roket fırlatma ve mesafe rekoru -> Kalıcı fabrika ihracat çarpanı (+%30) -> SaveManager v3 tam round-trip oturum kalıcılığı -> Çevrimdışı ilerleme ve CrazyGames 2X rewarded ad döngüsü 7/7 test ile %100 başarıyla doğrulandı.
  - **Uygulanmış ve Birim Testleri Geçmiş Ama Sahneye Bağlanmamış (Gelecek Genişletmeler):**
    - [ ] Akıllı Noktadan-Noktaya Bant Çizim Aracı (`SmartBeltTool.ts`, `SmartBeltPathfinder.ts`).
    - [ ] Kontrat ve Sipariş Sistemi (`ContractManager.ts`).
* **Kritik Oynanış Sorunları (Critical Bugs Identified & Status):**
  - **[BUG-001] Roket Hangar Modül Yükseltme Kilitlenmesi:** ÇÖZÜLDÜ (Fixed). `FactoryEconomy` `EconomyManager`'a bağlandı. Eksik parçalar için adil hızlı inşa piyasa tedarik bedeli hesaplandı.
  - **[BUG-002] İki Ayrık Ekonomi Motoru:** ÇÖZÜLDÜ (Fixed). `BackingEconomyProvider` deseniyle tek kaynak belirlendi. Uçuş ödüllerinde çift para sayımı engellendi.
  - **[BUG-003] Eski 1D Konveyör Görünümü ve Eksik Kamera:** ÇÖZÜLDÜ (Fixed). `FactoryView.ts` devreden çıkarıldı; 2D `GridView`, `GridMap`, `CameraController` ve çift kamera mimarisi kuruldu.
  - **[BUG-004] Hareketsiz ve Kopuk Fabrika Simülasyonu:** ÇÖZÜLDÜ (Fixed). `LogisticsNetwork` ve `ProductionEngine` `update()` döngüsüne bağlandı. INTAKE -> Bant -> Kırıcı -> Viraj -> EXPORT starter hattı canlı olarak çalışıyor.
* **Next Task:** TÜM MASTER PLAN GÖREVLERİ (FAZ 1 - FAZ 7) TAMAMLANDI. Oyun yayınlanmaya ve son kullanıcı oynanışına hazır.
* **Last Verification:** 2026-10-02 22:28 — 274/274 birim ve entegrasyon testi geçti (60 test suit), npx tsc --noEmit 0 hata, npm run build başarılı (dist/ üretildi, 4.16s).
