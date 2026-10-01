# GAME_DESIGN.md — Manufacturer Temel Oyun Tasarımı ve Çekirdek Vizyon

> **Bu dosya, Manufacturer'ın nihai türünü, çekirdek döngülerini ve tasarım sınırlarını tanımlar.**
> Tüm mimari, ekonomi ve kodlama kararları buradaki vizyonu güçlendirmek zorundadır.

---

## 1. Temel Vizyon ve Oyun Türü

Manufacturer klasik bir hardcore fabrika simülatörü veya karmaşık bir bulmaca oyunu **değildir**.

Oyunun ana türü:

> **Incremental / Progression-Focused Factory Game**

Oyuncunun temel motivasyonu:
> **"Bir sonraki seviyeye geçmek, daha güçlü üretim yapmak, daha büyük ekonomi kurmak ve roketi daha ileri seviyeye taşımak."**

* **Fabrika tarafı:** Oyuncuya ekonomik büyüme, pasif gelir akışı ve parça tedariki sağlar.
* **Roket tarafı:** Oyuncuya uzun vadeli hedef duygusu, zafer anları ve yeni fabrika yetenekleri (teknoloji, alan, kaynak) kazandırır.

---

## 2. Üç Katmanlı Çekirdek Döngü (Core Gameplay Loops)

```text
┌────────────────────────────────────────────────────────────────────────┐
│                          KISA DÖNGÜ (Saniyeler)                        │
│   Click / Collect ──► Para / Kaynak Kazan ──► Makine / Hız Yükselt     │
│             ▲                                        │                 │
│             └────────────────────────────────────────┘                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                          ORTA DÖNGÜ (Dakikalar)                        │
│   Yeni Makine ──► Yeni Kaynak / Zincir ──► Değerli Ürün ──► Alan Aç    │
│             ▲                                        │                 │
│             └────────────────────────────────────────┘                 │
└───────────────────────────────────┬────────────────────────────────────┘
                                    │
┌───────────────────────────────────▼────────────────────────────────────┐
│                         UZUN DÖNGÜ (Oturumlar)                         │
│   Fabrika Büyümesi ──► Roket Parçaları ──► Roket Yükseltme & Fırlatma  │
│             ▲                                        │                 │
│             └────── Yeni Teknoloji, Alan, Kaynak ◄───┘                 │
└────────────────────────────────────────────────────────────────────────┘
```

### 2.1. Kısa Döngü (Short Loop — Click & Collect)
* Oyuncu başlangıçta hammaddeye tıklar veya banttaki eşyaları toplar.
* Anında nakit/kaynak kazanır.
* İlk makinelerin hızını ve kapasitesini yükseltir.
* Üretim hızlanır, anlık ödül hissi tatmin edilir.

### 2.2. Orta Döngü (Medium Loop — Factory Expansion & Automation)
* Yeni bir makine türü açılır (örn. Fırın veya Kesici).
* Yeni bir üretim zinciri kurulur (Cevher $\rightarrow$ Toz $\rightarrow$ Külçe $\rightarrow$ Dişli).
* Daha değerli ürünler ihracat sandığına ulaştıkça gelir katlanır.
* Kazanılan sermaye ile fabrikanın kilitli komşu parselleri satın alınır ($8 \times 8 \rightarrow 12 \times 8 \rightarrow 16 \times 16$).
* Manuel tıklama yerini tam otomatik konveyör akışına bırakır.

### 2.3. Uzun Döngü (Long Loop — Rocket Progression & Milestones)
* Fabrika üst kademe havacılık parçaları üretmeye başlar (Gövde Plakası, Roket Motoru, Aviyonik Çip, Katı Yakıt).
* Bu parçalar doğrudan Roket Hangarına aktarılır ve roket donatılır.
* Roket fırlatılır (`FlightScene`); oyuncu engellerden kaçarak irtifa ve uzay hurdası kazanır.
* Uçuş başarısı yeni çağları/kademeleri açar (Yeni nadir madenler, yeni teknoloji ağacı, devasa yeni fabrika binaları).
* Oyuncu daha gelişmiş, daha zengin bir fabrika kurmak üzere ana ekrana döner.

---

## 3. Bağlayıcı Tasarım İlkeleri ve Karmaşıklık Sınırı (Complexity Budget)

### 3.1. "Kolay Öğren, Sürekli Geliştir, Sürekli Yeni Bir Şey Aç"
* Oyuncu oyuna girdiğinde ilk 30 saniyede ne yapacağını anlar (Tıkla $\rightarrow$ Üret $\rightarrow$ Satın Al).
* Her 2-3 dakikada bir ya yeni bir yükseltme, ya yeni bir eşya, ya da yeni bir görsel değişim yaşanmalıdır.
* "Seviye 47 $\rightarrow$ 48" gibi fark edilmeyen çıplak stat artışları yerine, görünür ve fonksiyonel yenilikler esastır.

### 3.2. Düşük Sürtünme ve Cezalandırmayan Tasarım (Anti-Frustration)
* **Taşıma/Yıkım %100 Ücretsizdir:** Yanlış yerleştirme cezalandırılmaz; oyuncu serbestçe dener, bozar, baştan kurar ve optimize eder.
* **Akıllı Lojistik:** Konveyör hatları Makine A $\rightarrow$ Makine B şeklinde zahmetsizce bağlanır. Tile tile mikro tıklama angaryası yoktur.

### 3.3. Kısa ve Anlamlı Üretim Zincirleri
* Bir üretim zinciri maksimum **3 ila 4 adımdan** oluşur. 10 adımlı aşırı karmaşık ağaçlar oluşturulmaz.
* Basit yüzey, zengin ilerleme:
  - Ham Maden $\rightarrow$ Ezilmiş Toz $\rightarrow$ Eritilmiş Külçe $\rightarrow$ Levha / Dişli $\rightarrow$ Roket Bileşeni.

### 3.4. Kesinlikle Eklenmeyecek Hardcore Simülasyon Unsurları
Aşağıdaki sistemler oyunu "daha gerçekçi" yapmak adına **asla eklenmeyecektir**:
* ❌ Elektrik şebekesi ve enerji kesintileri
* ❌ Makine aşınması, bozulması ve tamir/bakım maliyeti
* ❌ İşçi yönetimi ve maaşlar
* ❌ Dinamik borsa/piyasa fiyat dalgalanmaları
* ❌ Karmaşık lojistik trafik sıkışıklığı cezaları

Her yeni mekanizma şu filtreyi geçmek zorundadır:
> *"Bu sistem oyuncunun ekonomik büyümesini, fabrika ilerlemesini veya roket hedefini anlamlı şekilde güçlendiriyor mu?"*

---

## 4. Oyuncunun Hedef Hissi: "Bir Sonraki Adım..."
Oyuncu ekrana baktığında her an şu sorunun cevabını görmelidir:
* *"Şu anda ne için para/kaynak biriktiriyorum?"*
* *"Bir sonraki yükseltmede fabrikam veya roketim nasıl değişecek?"*
* *"Roketi ne zaman fırlatabileceğim?"*

HUD ve Arayüz her zaman en yakın **Kilometre Taşını (Milestone Objective)** belirgin şekilde göstermelidir.
