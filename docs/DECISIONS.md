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
