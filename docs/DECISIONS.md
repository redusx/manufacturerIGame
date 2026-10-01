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

