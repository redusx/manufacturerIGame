# DECISIONS.md — Alınan Mimari ve Tasarım Kararları Kaydı

> **Bu dosya projede kesinleşen mimari ve tasarım kararlarını belgeler.**
> Her karar açık gerekçesiyle kaydedilir; gelecekteki görevlerde bu kararlardan sapılmaz.

---

### [DEC-001] Teknoloji ve Çalışma Zamanı Çerçevesi
* **Tarih:** 2026-10-02
* **Karar:** Oyun motoru olarak **Phaser 3**, programlama dili olarak **TypeScript**, derleme aracı olarak **Vite** korunacaktır. Dış UI framework'ü (React, Vue vb.) eklenmeyecektir.
* **Gerekçe:** Web/CrazyGames platformu için hafif, hızlı yüklenen ve sıfır ek yük getiren saf HTML5 Canvas/WebGL yapısı esastır.

---

### [DEC-002] İki Katmanlı Mimari (Decoupled Simulation & Presentation)
* **Tarih:** 2026-10-02
* **Karar:** Fabrika ızgarası, lojistik ağ, makineler, reçeteler ve eşyalar Phaser'dan bağımsız saf TypeScript sınıfları olarak `src/factory/simulation/` altında geliştirilecektir. Phaser nesneleri (`Sprite`, `Container`) yalnızca simülasyon durumunu yansıtan ve girdi toplayan bir **görsel kabuk (presentation layer)** olacaktır.
* **Gerekçe:** 
  1. Saf simülasyon headless olarak saniyede binlerce tick ile birim ve entegrasyon testlerine tabi tutulabilir.
  2. Kayıt/yükleme (save/load) doğrudan saf veri üzerinde çalışır; Phaser nesnelerinin serileştirilmesi gerekmez.
  3. İleride editör veya bot simülasyonları Phaser sahnelerine bağımlı olmadan çalışabilir.

---

### [DEC-003] Kesikli Izgara (Discrete 2D Tile Grid)
* **Tarih:** 2026-10-02
* **Karar:** Fabrika alanı $32 \times 32$ piksel boyutunda kesikli kare hücrelerden oluşan bir ızgara üzerinde simüle edilecektir.
* **Gerekçe:** Serbest koordinatlı (continuous) yerleşim yerine ızgara yerleşimi, oyuncuya net mekânsal bulmacalar (spatial puzzles), kesin port hizalamaları ve öngörülebilir lojistik hatlar sağlar.

---

### [DEC-004] Piksel Sanat ve Tema Bütünlüğü
* **Tarih:** 2026-10-02
* **Karar:** `docs/ART_DIRECTION.md` bağlayıcı kalacaktır. Tüm yeni varlıklar 16-bit endüstriyel bilimkurgu ve havacılık temasına uygun raster piksel çizimler olacak; renkler `src/ui/theme.ts` paletinden seçilecektir. `pixelArt: true` ve `roundPixels: true` korunacaktır.
* **Gerekçe:** Görsel kalite ve CrazyGames standartlarına uyum.

---

### [DEC-005] Kademeli ve Test Odaklı Geliştirme (Incremental Agent Workflow)
* **Tarih:** 2026-10-02
* **Karar:** Geliştirme süreci küçük, test edilebilir, dokümante edilen adımlarla yürütülecektir. Her görev sonrasında dokümantasyon güncellenecek, derleme ve test doğrulanacak ve durulacaktır.
* **Gerekçe:** Büyük kod sıçramalarının getirdiği regresyonları ve bağlam kayıplarını engellemek.

---

### [DEC-006] Makro Yapı: Kalıcı Fabrika ve Kademeli Genişleme (Persistent Factory + Progressive Expansion)
* **Tarih:** 2026-10-02
* **Karar:** Oyun bağımsız bulmaca bölümlerinden veya devasa boş bir sandbox'tan oluşmayacaktır. Oyuncunun tek bir **kalıcı ana fabrikası** olacaktır. Fabrika küçük bir atölye alanı ($8 \times 8$) ile başlar; oyuncu para kazandıkça ve roket fırlattıkça yeni ızgara alanları (genişleme parselleri), yeni makineler, yeni hammadde girişleri ve yeni teknolojiler kilit açılımlarıyla (unlocks/milestones) devreye girer.
* **Gerekçe:** Oyuncu inşa ettiği fabrikaya duygusal bağ kurmalı, yatırımlarının kalıcı olduğunu hissetmeli ve "bir parsel daha açma / bir makine daha ekleme" incremental arzusunu yaşamalıdır.

---

### [DEC-007] Sıfır Sürtünmeli Yerleşim ve %100 İade (Zero-Friction Building & Demolish)
* **Tarih:** 2026-10-02
* **Karar:** Makineleri ve bantları yıkmak, satmak veya yerini değiştirmek tamamen ücretsizdir (%100 sermaye iadesi).
* **Gerekçe:** Oyuncu yanlış koymaktan veya fabrikasını yeniden düzenlemekten korkmamalı; serbestçe denemeli, yeniden dizmeli (rearrange) ve optimize etmelidir.

---

### [DEC-008] Basit ve Akıllı Lojistik Kullanıcı Deneyimi (Point-to-Point Smart Logistics UX)
* **Tarih:** 2026-10-02
* **Karar:** Konveyör sistemi tile bazlı mikro-yönetim angaryasına dönüşmeyecektir. Oyuncu başlangıç ve bitiş noktalarını (Makine A $\rightarrow$ Makine B) seçtiğinde akıllı yol bulucu otomatik hat döşer. Karmaşık lojistik bulmacalar yerine anlaşılır, akıcı eşya transferi esastır.
* **Gerekçe:** Incremental oyun doğasına uygun, mobil ve web dostu, yormayan ve hızlı oynanış sağlamak.

---

### [DEC-009] Roket Sistemi: Uzun Vadeli İlerleme ve Kilometre Taşı Omurgası
* **Tarih:** 2026-10-02
* **Karar:** Roket uçuşu (FlightScene) oyundan bağımsız bir mini-oyun değildir. Fabrikanın nihai amacı ve uzun vadeli ekonomik hedefidir. Fabrika roket parçalarını (Gövde, Motor, Aviyonik, Yakıt) üretir $\rightarrow$ Roket geliştirilir $\rightarrow$ Fırlatılır $\rightarrow$ Uçuş başarısı yeni kalıcı teknolojileri, fabrikanın yeni genişleme alanlarını ve çarpan ödüllerini açar $\rightarrow$ Fabrikaya daha güçlü dönülür.
* **Gerekçe:** Fabrika üretimine somut bir amaç ve epik bir uzun vadeli döngü (long-term loop) kazandırmak.

---

### [DEC-010] Karmaşıklık Bütçesi ve İncremental Öncelik Kuralı (Complexity Budget & Anti-Simulation Rule)
* **Tarih:** 2026-10-02
* **Karar:** Oyuna hardcore simülasyon unsurları (elektrik şebekesi, makine arızaları/bakım, işçi yönetimi, karmaşık dinamik borsa fiyatları, gerçekçi fizik kısıtları) eklenmeyecektir. Her sistem *"Bu özellik oyuncunun ekonomik büyümesini veya roket ilerlemesini anlamlı şekilde güçlendiriyor mu?"* sorusundan geçmek zorundadır. Üretim zincirleri maksimum 3-4 adımla sınırlı tutulacaktır.
* **Gerekçe:** "Kolay öğren, sürekli geliştir, sürekli yeni bir şey aç" vizyonunu korumak ve aşırı tasarımdan (over-engineering) kaçınmak.

---

> **REVIVAL KARARLARI (2026-10-06):** Aşağıdaki kararlar, gerçek tarayıcı denetiminden sonra kullanıcı tarafından sabitlenmiştir. Önceki kararlarla çeliştiği yerde bunlar geçerlidir.

### [DEC-011] Uçuş Ödülü: Kabiliyet Açar, Para Basmaz
* **Tarih:** 2026-10-06
* **Karar:** Uçuş ana para kaynağı değildir. Büyük nakit ödülleri kaldırılır; uçuş esas olarak yeni kabiliyet / hammadde / tarif / parsel / ilerleme açar. Yanında mütevazı nakit verilebilir, ancak tek uçuş fabrikanın birkaç dakikada üreteceği parayı aşmamalıdır.
* **Gerekçe:** Denetimde Sv.1 roketle 20 saniyelik uçuş $1.750 verirken fabrika $1/sn kazanıyordu; fabrika anlamsızlaşıyordu.

### [DEC-012] Hızlı İnşa: Pahalı Kestirme
* **Tarih:** 2026-10-06
* **Karar:** Roket modüllerinde eksik parçayı parayla tamamlama (hızlı inşa) kalır, ama pahalıdır: başlangıç oranı parça satış değerinin yaklaşık 4 katı (sonradan dengelenebilir). Hiçbir zaman normal fabrika üretiminin yerini almaz.
* **Gerekçe:** Rokete giden yol fabrikadan geçmelidir.

### [DEC-013] Tıklama: Yalnızca Erken Oyun Yardımcısı
* **Tarih:** 2026-10-06
* **Karar:** Tıklama kalıcı ana gelir sistemi değildir. İlk dakikalarda yardımcı olur; fabrika üretimi ilerledikçe ekonomik önemi hızla azalır. Ana ilerleme otomatik fabrika ekonomisidir.

### [DEC-014] Kayıt Uyumluluğu: Temiz Başlangıç
* **Tarih:** 2026-10-06
* **Karar:** Oyun henüz yayında olmadığı için eski kayıtlar korunmaya çalışılmaz. Gerekirse göç yazmak yerine kayıt sürümü yükseltilip temiz başlangıç uygulanır.

### [DEC-015] Roket Sonrası: Prestij Yok, Yeni Kademeler
* **Tarih:** 2026-10-06
* **Karar:** Prestij / sıfırlama sistemi şimdilik yoktur; fırlatma fabrikayı sıfırlamaz. Uzun vadeli yapı: Fabrika → Roket → Yörünge → daha uzak görevler → yeni kabiliyetler → daha güçlü fabrika. Ay / Mars gibi kademeler sonradan eklenebilir; şu aşamada gereksiz içerik üretilmez.
* **Not:** DEC-006 ve `OPEN_QUESTIONS.md` MQ-1'deki prestij önerisinin yerine geçer.

### [DEC-016] Uçuş Sırasında Fabrika Durmaz
* **Tarih:** 2026-10-06
* **Karar:** Uçuş sırasında fabrika üretimi arka planda devam eder; oyuncu dönüşte geçen süre kadar fabrika ilerlemesini alır. Uçuş, fabrikanın yerine geçen bir mini oyun olmamalıdır.

### [DEC-017] Hammadde Artışı: Hız Yükseltmesi Yerine Ek Giriş
* **Tarih:** 2026-10-06
* **Karar:** Hammadde girişleri sabit hızdadır (1 hammadde/sn). Daha fazla hammadde isteyen oyuncu katalogdan yeni giriş satın alır (demir $500, bakır $1000, kum/polimer $2500 — M7'de dengelenecek başlangıç değerleri). Girişler aşamalarla açılır: ek demir 3., bakır 6., kum ve polimer 9. aşama ödülü. Girişler sökülemez, yalnızca taşınır.
* **Gerekçe:** Ek giriş, sayıyı büyütmek yerine fabrikada görünür bir değişiklik yaratır ve yeni hat kurmayı teşvik eder; ayrı bir yükseltme arayüzü gerektirmez.
* **Not:** Yol haritasındaki "giriş hızı yükseltilebilir" maddesinin yerine geçer; kullanıcı 2026-10-06 tarihinde onayladı.

### [DEC-018] Roket Bağlantısı: Parça Fabrikadan, Prim Gelire Bağlı
* **Tarih:** 2026-10-06
* **Karar:**
  1. Hangar açıkken, roketin sıradaki yükseltmelerinin beklediği parçalar ihracat sandığına ulaştığında satılmaz, hangar stoğuna gider; ihtiyaç dolunca aynı parça yeniden satılır. Ayrı bir teslimat terminali yoktur.
  2. Uçuşta toplananlar roket parçasına dönüşmez (eski "hurda → çerçeve/motor/çip" kaldırıldı).
  3. Uçuş primi sabit para değil, fabrikanın o anki gelirinin süresidir (en fazla 180 sn) ve fabrika hedeflerini ilerleten "toplam kazanç"a yazılmaz.
  4. Hızlı inşada eksik parçanın bedeli satış değerinin 4 katıdır (DEC-012'nin uygulaması).
  5. Uçuş dönüşünde fabrika, uçuşta geçen gerçek süre kadar (en fazla 10 dk) gerçekten simüle edilir (DEC-016'nın uygulaması).
* **Gerekçe:** DEC-011, DEC-012 ve DEC-016. Prim gelire bağlı olduğu için oyunun hiçbir aşamasında uçuş fabrikanın önüne geçemez.
* **Not:** Süre katsayıları ve 180 sn sınırı başlangıç değeridir; M7'de dengelenecek.

### [DEC-019] Denge Geçişi (M7)
* **Tarih:** 2026-10-06
* **Hedef (varsayım, kullanıcı onayı bekliyor):** İlk hedef 1 dakikadan kısa; her aşama 1–4 dakika; 10 aşamanın tamamı ilgili bir oyuncu için ~40–50 dakika. Her yeni makine adımı geliri belirgin artırmalı; aşama ödülü yalnızca yeni açılan şeyi satın almaya yetmeli.
* **Karar:**
  1. **Reçete süreleri:** Temel zincir kırıcının hızına (0,5/sn) eşitlendi: külçe 4→2 sn, levha 3→2, dişli 3,5→2, bakır tel 2,5→2, çerçeve 5→4, motor 4→2. Eskiden fırın hattı yarıya düşürüyor, fırın eklemek geliri $1,25'ten $1,5/sn'ye çıkarıyordu.
  2. **Eşya değerleri:** Değer = girdilerin toplamı × ~1,5–2. Çerçeve 90→40, motor 45→50, sensör 55→50, mikroçip 80→60, gövde paneli 450→45, yönlendirme bilgisayarı 350→320, itici blok 600→400 (eskiden itici blok girdilerinden ucuzdu, gövde paneli girdisinin 20 katıydı).
  3. **Aşamalar (eşik → ödül):** 1: $50 ciro → $100 · 2: 60 toz → $150 · 3: 30 külçe → $250 · 4: parsel 1 + $600 ciro → $300 · 5: 40 levha → $400 · 6: 40 dişli + $2.500 ciro → $1.000 · 7: parsel 2 + 40 tel → $1.500 · 8: 30 motor + $8.000 ciro → $2.500 · 9: parsel 3 + 20 çerçeve → $4.000 · 10: parsel 4 + 10 itici blok + $40.000 ciro → $10.000 ve +%50.
  4. **Parsel 4:** $50.000 → $30.000.
  5. **Toplam ciro:** yalnız ihracat ve tıklama; aşama ödülü artık sayılmaz (eskiden 2. ve 4. aşama ödüller yüzünden anında tamamlanıyordu).
* **Ölçüm:** Aynı bot ve aynı yerleşimle, gerçek simülasyon sınıfları üzerinde. Eski değerler: 9. aşama 10,8 dk, 2. ve 4. aşama 0,0 dk, ciro $25.138 (çoğu ödül). Yeni değerler: 9. aşama 15,6 dk, aşamalar 0,9 / 1,3 / 1,1 / 1,5 / 1,6 / 2,6 / 2,1 / 2,8 / 1,6 dk, gelir $0,9 → $35/sn.

### [DEC-020] Arayüz: Cihaz Çözünürlüğünde Çizim, Birim Tabanlı Düzen
* **Tarih:** 2026-10-06
* **Karar:**
  1. Tuval CSS boyutu × cihaz piksel oranında (en fazla 3, yaklaşık 4K piksel bütçesiyle) çizilir. Arayüz "birim" cinsinden yerleştirilir; arayüz kamerasının zoom'u 0,5'in katıdır.
  2. Dünya (fabrika, uçuş) ve arayüz ayrı kameralarla çizilir; sahneye eklenen nesne varsayılan olarak dünyaya aittir.
  3. Bütün pencereler tek temel sınıftan (`UiModal`), bütün düğmeler tek bileşenden (`UiButton`) türer. Dikey ekranda pencereler alttan açılan sayfadır; sığmayan içerik küçültülmez, kaydırılır.
  4. Görsel dil piksel sanat olarak kalır (kullanıcı kararı); `ART_DIRECTION.md` değişmedi. Yazı tipi oradaki §5 gereği `Arial, Helvetica, sans-serif`'tir; kodda adı geçen ama hiç yüklenmeyen piksel font kaldırıldı, yeni font eklenmedi.
* **Gerekçe:** Eski düzen tuvali düşük çözünürlükte çizip CSS ile büyütüyordu; yazılar yüksek DPI ekranda bulanık, küçük ekranda okunaksızdı ve her pencere kendi ölçülerini taşıyordu.
* **Ayrıntı:** `UI_UX_SYSTEM.md`.

### [DEC-021] Arayüz Ölçeği Ayarı
* **Tarih:** 2026-10-06
* **Karar:** Ayarlarda dört kademe vardır: Küçük, Normal, Büyük, Çok Büyük (Normal'in 0,8 / 1 / 1,2 / 1,4 katı, 0,5 zoom adımına yuvarlanır). Tercih oyun kaydından ayrı tutulur (`manufacturer_ui_prefs_v1`); kayıt sıfırlansa da korunur. Ölçek, arayüz ekranını 300x480 (dikey) / 480x300 (yatay) birimin altına düşüremez; bu yüzden küçük ekranlarda üst kademeler kullanılamaz ve ayarlarda kapalı görünür.
* **Gerekçe:** Düzenin her kademede kırılmadan çalışması, sınırsız büyütmeden daha önemlidir.

### [DEC-022] Girdi Kuralları
* **Tarih:** 2026-10-06
* **Karar:**
  1. Fabrikadaki makine, bant, zemin ve parsel rozeti basışta değil bırakışta tepki verir; üzerlerinde başlayan kaydırma ya da iki parmak hareketi tıklama sayılmaz.
  2. Dokunmatikte yerleştirme ve söküm iki adımlıdır (hedefi seç → Onayla); farede tek tıktır.
  3. Fabrika zeminindeki rozetten parsel satın alma onay ister; katalogdaki fiyatlı düğme doğrudan satın alır.
  4. Araç çubuğu sırası ve kısayolları: ÜRET (1/Boşluk), BANT (2), İNŞA (3/B), SÖK (4/X), HANGAR (5/H).
  5. Müzik olmadığı için müzik ayarı eklenmedi; yalnızca ses efektleri ayarı vardır.
* **Gerekçe:** Dokunmatikte kaydırma sırasında yanlışlıkla makine penceresi açılıyor ya da para harcanabiliyordu.

### [DEC-023] Makine Girdisi Her Kenardan Alınır
* **Tarih:** 2026-10-06
* **Karar:** Makineye doğru akan bant, makinenin hangi hücresine ve hangi kenarına dayanırsa dayansın girdiyi teslim eder. Giriş portu işareti yalnızca önerilen yönü gösterir. Çıkış portu bağlayıcı kalır: ürün yalnızca çıkış portunun önündeki banda verilir. Makine, etkin reçetesinin istemediği eşyayı almaz.
* **Gerekçe:** Oyuncu 5. aşamada presi (1x2, tek girişi üst hücrenin kuzeyinde) yandan besledi; doğru eşya geldiği hâlde bant sessizce tıkandı ve bu hata gibi göründü. Küçük port işaretiyle tek kenar kuralı öğretilemiyordu.
* **Not:** Aşama metinlerindeki eşya adları da eşya kayıtlarıyla eşitlendi ("Demir Levha" → "Çelik Levha", "Çelik Dişli" → "Hassas Dişli" vb.); oyunda "Demir Levha" adında bir eşya yoktu.

### [DEC-024] Makine Görünümü ve Port Okları
* **Tarih:** 2026-10-07
* **Karar:**
  1. Her makinenin kendine ait, ayak izi boyutunda çizilmiş bir dokusu vardır (`public/assets/machines/`, üretici: `tools/generate_machine_assets.py`). Katalog kartı, yerleştirme hayaleti, fabrika zemini ve makine penceresi aynı dokuyu kullanır (`src/factory/view/MachineSprites.ts`).
  2. Makine döndürülünce resim döndürülmez; kare olmayan makinelerin (fırın, pres) yatay ve dikey iki çizimi vardır. Yönü oklar gösterir: **yeşil ok** girdinin girdiği, **turuncu ok** ürünün çıktığı kenar ve yöndür. Oklar hayalette de görünür.
  3. Çıkışı tıkalı makinenin çıkış oku kırmızı yanıp söner; makine penceresi duruma göre ne yapılacağını yazar.
  4. Makine, kendisine doğru akan banda ürün vermez. (DEC-023 sonrası, çıkış okunun önünden beslenen makine ürününü besleme bandına geri basıp hattı kilitliyordu.) Bitişik makineler arası doğrudan aktarım da girdiyi her kenardan kabul eder.
  5. Seviye rozeti 1. seviyede gösterilmez; seviye ve durum rozetleri makine resmini örtmeyecek şekilde köşeye alındı.
* **Not:** Eski `machine_*.png` dokuları artık yüklenmiyor; dosyaları silinmedi.


### [DEC-025] Yan Ürün (Hurda) Asıl Hattı Tıkamaz
* **Tarih:** 2026-10-07
* **Karar:** Reçetenin yan ürünü (kesicide Hurda Talaş) yalnızca hurda portundan (`out_scrap`; kesicide doğuya bakan ikinci turuncu ok) çıkar, asıl ürün yalnızca ana çıkıştan. Hurda portunun önünde onu alabilecek bir bant/sandık yoksa hurda atılır; makineyi ve hattı tıkamaz. Hurdayı satmak isteyen oyuncu hurda portuna bant bağlar.
* **Gerekçe:** Oyuncu 8. aşamada dişliyi montaj istasyonuna bağladı; aynı banda karışan hurdayı istasyon almadığı için hat kilitlendi ve hurdayı ayıracak/atacak bir araç yoktu.

### [DEC-026] Hammadde Girişi Tek Yönlüdür
* **Tarih:** 2026-10-07
* **Karar:** Hammadde girişi yalnızca çıkış okunun (turuncu) gösterdiği kenardaki banda hammadde verir; yanından geçen başka hatlara ve girişe doğru akan banda vermez. Yeni giriş güneye bakar; yerleştirirken ve taşırken R / döndür düğmesiyle yön seçilir. Girişi kendi hücresine "taşımak" yalnızca yönünü değiştirir. Yönü olmayan eski kayıtlarda yön, girişten uzağa akan komşu banda göre (yoksa herhangi bir komşu banda, o da yoksa güneye) bir kez belirlenir.
* **Gerekçe:** Giriş, dört komşusundaki ilk boş banda hammadde bastığı için yanından geçen hatları ham cevherle doldurup tıkıyordu (PROJECT_STATUS'taki "giriş tuzağı").
* **Ek:** Kilitli parsel rozeti büyüse de etkin fabrikanın üstüne taşmaz; sol kenarı fabrikanın sağ kenarının dışına sabitlenir ve rozet dışarı doğru büyür.

### [DEC-027] Farede Kaydırma Sağ Tuşta; Dokunmatikte Adım Adım Bant
* **Tarih:** 2026-10-08
* **Karar:**
  1. Farede fabrika sağ (veya orta) tuş basılı tutularak kaydırılır; araç etkinken de çalışır. Sol tuş yalnızca seçim, yerleştirme ve çizim içindir, artık kaydırmaz. Sürüklemeden bırakılan sağ tık etkin aracı iptal eder. Dokunmatikte tek parmakla kaydırma değişmedi.
  2. Dokunmatikte bant döşendikten sonra hayalet, bandın aktığı sıradaki hücreye geçer. Çevresindeki üç yeşil ok o hücreye düz / sola / sağa bakan bant döşeyip bir adım ilerletir; son bandın iki yanındaki mavi oklar o bandı sola / sağa çevirir (`BeltStepper`). Düğmeler 44 birimdir ve arayüz katmanındadır. Sürükleyerek çizim aynen çalışır.

### [DEC-028] Uçuş Modeli: Roket Sınıfı, Menzil Çarpanı, Sabit Kristal (M9-A)
* **Tarih:** 2026-10-08
* **Karar:**
  1. **Roket sınıfı** = en düşük modül seviyesi. Dört modülün dördü de Sv.N olunca roket N. sınıftır. Sınıf, aynı sürede kat edilen mesafeyi büyüten **menzil (hız) çarpanını** belirler: 1 · 1,1 · 1,5 · 2 · 2,65 · 3,5 · 4,75 · 6,3 · 8,55 · 11,2 (Sv.1 … Sv.10).
  2. Sv.3'ten sonraki seviyeler fizik değerlerini (itiş, yakıt, nitro, kaldırma) Sv.1–3'teki bir seviyenin beşte biri kadar artırır. Üst seviyeler uçuşu uzatmaz, hızlandırır; hiçbir uçuş yaklaşık 75 saniyeyi geçmez.
  3. **Kristal sabit doldurur:** +0,5 sn yakıt, +0,35 sn nitro (eskiden kapasitenin %25'i ve %35'i). Eski kuralda Sv.4'ten itibaren kristal toplayan oyuncunun uçuşu bitmiyordu.
  4. **Bölgeler:** her menzil basamağı (`RangeLadder`) bir bölge sınırıdır; geçilince duyurulur ve gökyüzü tonu değişir. 5 km'den itibaren geçilen her basamak engel hasarını %30 artırır; gövde seviyesi hasarı böler.
  5. **Uçuş primi çarpansız mesafeden hesaplanır;** üst sınıflarda prim süresi kendiliğinden tavana vurmaz.
  6. Uçuş fiziği saf bir modüldedir (`src/flight/FlightPhysics.ts`); oyun ve `tools/flight_sim.ts` aynı kodu çalıştırır.
* **Kalibrasyon:** menzil çarpanları, nitroyu yalnızca basılı tutan oyuncu (gerçek oyunda ölçüldü: bu oynayışta kristal toplanmıyor) sınıfının basamağına %3 payla ulaşacak şekilde seçildi. Nitroyu düşerken kullanan oyuncu (kristallerin %20–30'unu toplar) hedefin %140–160'ına, yani yaklaşık bir basamak ileriye gider. 75 ve 100 km basamakları Sv.10'da yalnızca böyle oynayarak geçilir.
* **Gerekçe:** `M9_PLAN.md` §2.2 ve §4.2. Mesafeyi roket seviyesine bağlamadan "daha ileri" hedefi kurulamıyordu.

### [DEC-029] Roket Seviyeleri: Sv.10, Nakit + Parça, Menzil İzni, Sınırlı Hızlı İnşa (M9-B)
* **Tarih:** 2026-10-08
* **Karar:**
  1. Her modül **Sv.10**'a kadar yükselir (28 yeni yükseltme). Kademeler: Mk I (Sv.1–3), Mk II (4–6), Mk III (7–9), Mk IV (10). Her seviyenin kendi roket görünümü vardır (`tools/generate_rocket_tiers.py`).
  2. Sv.4–10 bedeli formülledir (`RocketHangarBridge.getModuleUpgradeDefinition`): nakit `taban × 2,4^(Sv−4)` (gövde 30.000 · motor 40.000 · kanat 35.000 · nitro 25.000), parça `taban × 1,8^(Sv−ilk seviye)` (5'in katına yuvarlanır). Karışım: gövde çerçeve + kompozit panel (+ Sv.7'den cam blok); motor elektrik motoru + itici blok (+ Sv.7'den dişli); kanat mikroçip + güdüm bilgisayarı (+ Sv.5'ten sensör); nitro plastik + kart tabanı (+ Sv.6'dan bakır tel). Sv.2–3 bedelleri değişmedi.
  3. **Menzil izni:** Mk II 5 km, Mk III 14 km, Mk IV 40 km basamağıyla açılır (`RangeLadder`). İzin bekleyen seviye için parça toplanmaz.
  4. **Hedef modül:** oyuncu bir modülü hedef seçerse ihracattan yalnızca onun parçaları hangara ayrılır; seçmezse (varsayılan) bütün modüllerinki ayrılır.
  5. **Hızlı inşa (DEC-012'yi günceller):** her parçanın en fazla %25'i nakitle tamamlanır; birim fiyat güncel satış değerinin (gelir çarpanı dahil) 10 katıdır. Bütün seviyelerde geçerlidir; roket artık üretmeden tamamlanamaz.
  6. **Rekor:** eski uçuş modeliyle yapılmış rekorlar 5 km'de kesilir (`recordVersion`); yeni basamaklar yeni modelle geçilir.
* **Gerekçe:** `M9_PLAN.md` §2.1 ve §4.3: roketin tamamı $35.210'a, hiç parça üretmeden alınabiliyordu.
* **Not:** Nakit ve parça değerleri başlangıç değeridir; M9-F'de ölçülerek ayarlanır.

### [DEC-030] Genel Hedef: Seferler (Menzil Merdiveni Ödülleri) (M9-C)
* **Tarih:** 2026-10-08
* **Karar:**
  1. 10 aşama bittikten sonra hedef kartı sıradaki menzil basamağını gösterir ("SEFER 6/14 · 7.00 km menziline ulaş"); karta dokununca **Seferler** penceresi açılır (bütün basamaklar, ödülleri, önerilen roket sınıfı). Pencere hangardan da açılır.
  2. Uçuş kilometre taşları artık `RangeLadder` basamaklarıdır (tek kaynak). İlk beş basamağın ödülü değişmedi (toplamalı +%5 … +%25). Yeni basamaklar gelir çarpanını **çarpar** (×1,25; son ikisi ×1,15): `yeni = (eski + toplamalı) × çarpanlar`.
  3. Çevrimdışı gelirin birikme süresi basamaklarla uzar: 4 saat → 10 km'de 8 saat → 40 km'de 12 saat.
  4. Uçuş raporu yeni ulaşılan basamakların ödüllerini ve sıradaki hedefe kalan mesafeyi gösterir.
* **Gerekçe:** `M9_PLAN.md` §4.1 ve §4.6: aşamalar oyunu öğretir; sonrası için "roketi geliştir, daha ileri git" tek ve sürdürülebilir hedeftir.
* **Not:** Parsel izinleri (7, 14, 28, 40 km) M9-D'de parsellere bağlanır.

### [DEC-031] Ekonomi Ölçeği: Artan Giriş Fiyatı, İzinli Parseller, 32x32 Izgara (M9-D)
* **Tarih:** 2026-10-08
* **Karar:**
  1. **Hammadde girişi:** aynı hammaddenin her yeni girişi öncekinden %50 pahalıdır (`PlacementMath.getIntakeCost`): demir 500 · 750 · 1.130 · 1.690 … (üç anlamlı basamağa yuvarlanır). Oyunun başında verilen bedelsiz demir girişi sayılmaz. Girişler sökülemediği için al-sat açığı yoktur.
  2. **Yeni parseller** (`FACTORY_PLOTS`): 28x24 $250.000 · 28x28 $1.500.000 · 32x28 $8.000.000 · 32x32 $40.000.000. Her biri ayrıca bir **menzil izni** ister (7 · 14 · 28 · 40 km; `RangeLadder.unlocksPlotIndex`). İzin yokken parsel para yetse de alınamaz; rozet ve katalog kartı gereken menzili gösterir.
  3. Izgara tanımlı en büyük parsel boyutunda (32x32) kurulur. Eski kayıtlar olduğu gibi yüklenir.
  4. **Bant çizimi artımlıdır:** bant döşenince/sökülünce/dönünce yalnız o hücre ve dört komşusu, kare başına bir kez yeniden çizilir (`ConveyorRenderer.refreshAround`).
* **Gerekçe:** `M9_PLAN.md` §4.4. Ölçüm: 759 bantlı 32x32 fabrikada bütün ağı yeniden kurmak döşenen her bant için 79 ms sürüyordu; artımlı çizimle 0,2 ms. Ayrıca aynı karede kurulup yıkılan tıklanabilir nesneler Phaser girdi listesinde kalıyordu (sürükleyerek döşemede birikir); kare başına tek çizim bunu önler.
* **Not:** Fiyatlar başlangıç değeridir; M9-F'de ölçülerek ayarlanır.

### [DEC-032] Ödüllü Reklam Yerleşimleri ve Gelir Takviyesi (M9-E; şimdilik sahte sağlayıcı)
* **Tarih:** 2026-10-08
* **Karar:**
  1. **`AdService`** (saf TypeScript, `src/ads/`) bütün ödüllü reklamların tek istek noktasıdır: yerleşim sunuluyor mu, bekleme süresi, sonuç. Ödülü çağıran verir ve yalnızca sonuç `rewarded` ise verir; bekleme süresi de o zaman başlar ve kayda yazılır.
  2. **Mod** tek yerden seçilir (`src/ads/ads.ts`): `mock` (varsayılan) · `crazygames` (M9-G) · `off`. Deneme için `?ads=off` (bütün reklam düğmeleri gizlenir) ve `?ads=fail` (reklam her seferinde gösterilemez).
  3. **Sahte sağlayıcı** tuvalin üstünde "REKLAM ALANI" katmanı gösterir, 3 sn sayar ve ödülü verir; kapatılırsa ödül verilmez. CrazyGames SDK bağlanana kadar reklamlar yalnızca yerleşimdir (ödüller bedavadır).
  4. **Yerleşimler:** R1 çevrimdışı kazanç ×2 · R2 uçuş primi ×3 (3 dk bekleme) · R3 gelir takviyesi +10 dk (5 dk bekleme) · R4 parça kargosu: hedef modülün eksik parçalarının %15'i (10 dk bekleme) · R5 parsel indirimi %15 (parsel başına bir kez; $30.000 ve üstü parseller).
  5. **Gelir takviyesi** (`IncomeBoost`): etkinken ihracat geliri ×2; alım başına 10 dk, en fazla 30 dk; süre yalnızca oyun açıkken işler ve çevrimdışı gelire yansımaz. Reklamsız yolu: fabrikanın 5 dakikalık (takviyesiz) geliri karşılığı nakitle aynı süre. HUD'daki para/gelir bölümünden açılır; etkinken rozet "×2 08:41" gösterir.
  6. **Kurallar (CrazyGames):** reklam düğmeleri yalnızca pencerelerin içindedir ve video simgesi taşır; reklam sunulamıyorsa düğme hiç çizilmez; bekleme süresi sayaçla gösterilir; reklam gösterilemezse ödül verilmez ve oyuncu reklamsız yola devam edebilir; reklam ekrandayken oyun durur (kapanınca geçen süre fabrikaya telafi edilir) ve ses, oyuncunun ses ayarına dokunmadan kesilir.
* **Gerekçe:** `M9_PLAN.md` §4.5; K8 (yerleşimler R1–R5, geçiş reklamı G1 ayrıca karar).
* **Düzeltilen açıklar:** çevrimdışı 2X düğmesi reklam gösterilemeyince normal kazancı da yok ediyordu (artık pencere açık kalır); reklam sesi kısarken ses ayarını kayda yazıyordu.

### [DEC-033] Denge Geçişi: Giriş Artışı, Makine Seviyesi Eğrisi, Parsel Fiyatları (M9-F)
* **Tarih:** 2026-10-08
* **Karar:**
  1. Hammadde girişi artışı **×1,5 → ×1,7** (DEC-031'i günceller): demir 500 · 850 · 1.440 · 2.460 … 13.'sü 291.000.
  2. Makine yükseltme bedeli Sv.10'a kadar ×1,15 (değişmedi), **Sv.10'dan sonra seviye başına ×1,35** (`machineUpgradeFactor`). Hız etkisi aynı (+%20/seviye).
  3. Son iki parsel ucuzladı: 32x28 **8 M → 6 M**, 32x32 **40 M → 25 M**.
  4. Roket nakdi (×2,4) ve parça artışı (×1,8) değişmedi.
* **Dayanak:** `tools/economy_model.ts` (oyunun kendi tablolarını okuyan kapasite/tempo modeli; `ECONOMY.md` §9 ve §11). Üst zincirler hammadde başına ≈ $48 getiriyor; ortalama oyuncunun geliri Sv.4'te ≈ $460/sn, Sv.10'da ≈ $13.000/sn. Bu ölçekte ×1,5'lik giriş artışı ve sınırsız ×1,15 makine seviyesi neredeyse bedavaydı ve parselleri gereksiz kılıyordu; emek sınırı olmayan senaryoda ortalama oyuncu Sv.10'a 1,8 saatte varıyordu (ayarla 3,1 saat). Son iki parselin geri ödeme süresi saatleri buluyordu.
* **Sınır:** Bu bir modeldir, oyuncu ölçümü değildir; mutlak süreler ±%50 oynayabilir. Emek sınırlı senaryoda ayarlar süreyi değiştirmedi (rahat 7,7 · ortalama 4,3 · optimizasyoncu 2,6 saat). Planın 8–10 saatlik hedefi modelde yalnızca "rahat" profilde tutuyor.
* **Açık karar:** ortalama oyuncu için parça artışını 1,8'den 2,0'a çıkarmak (toplam ≈ 6 saat). Elde oynayış ölçümüne bırakıldı.
* **Not:** Sv.10'un üstünde eski fiyattan yükseltilmiş makinesi olan kayıtlarda söküm iadesi ödenenden fazla olur (bir kerelik, küçük).

### [DEC-034] CrazyGames Reklam Sağlayıcısı ve Mod Seçimi (M9-G)
* **Tarih:** 2026-10-08
* **Karar:**
  1. **Gerçek sağlayıcı** (`CrazyGamesAdProvider`) `AdService`'e takılır; ödüllü ve geçiş reklamlarını SDK'dan ister.
  2. **Mod kendiliğinden seçilir** (DEC-032'nin mod maddesini günceller): SDK reklam gösterebiliyorsa `crazygames`; gösteremiyorsa geliştirme sürümünde `mock`, yayın sürümünde `off`. `?ads=` parametreleri yalnızca geliştirme sürümünde geçerlidir; yayında sahte reklamla bedava ödül alınamaz.
  3. **Gösterilebilirlik:** `CrazyGamesSDK.canShowAds()` SDK hazır, ortam `crazygames` veya `local` ve reklam engelleyici yoksa true döner; false iken reklam düğmeleri çizilmez.
  4. **SDK sarmalayıcısı:** SDK yokken `requestAd` artık `false` döner (önceden `true` dönüp bedava ödül veriyordu). Oyun `adStarted` anında durur; reklam gelmezse hiçbir şey durmaz. Sesle sarmalayıcı ilgilenmez (`AdService` dinleyicisi `setSuspended` kullanır). `init()` iki kez çağrılsa da SDK bir kez başlatılır.
  5. **Geçiş reklamı (G1)** `MIDGAME_AD_ENABLED` bayrağının arkasındadır ve **kapalıdır** (K8'de karar verilmedi). Açılırsa: uçuştan fabrikaya dönüşte, o uçuşta ödüllü reklam izlenmediyse ve son reklamın üstünden 180 sn geçtiyse.
* **Gerekçe:** `M9_PLAN.md` §4.5 ve faz G; CrazyGames reklam gereksinimleri.
* **Sınır:** Gerçek reklam ağı ve CrazyGames QA aracı bu ortamda denenemedi; `RELEASE_CHECKLIST.md` yayından önce yapılacakları listeler.
