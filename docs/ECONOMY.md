# ECONOMY.md — Manufacturer İncremental Ekonomi ve Değer Modeli

> **Bu dosya, nakit akışını, eşya satış değerlerini, makine geliştirme maliyetlerini ve roket fırlatma ödüllerini tanımlar.**

---

## 1. Temel Ekonomik Yapı: Çift Yönlü Kaynak Akışı

Oyunda iki temel değer akışı vardır:

1. **Nakit Sermaye ($):**
   - Fabrikadaki makinelerin satın alınması ve yükseltilmesi,
   - Fabrika ızgarasının yeni parsellerle genişletilmesi (Plot Expansion),
   - Temel lojistik hatların döşenmesi için kullanılır.
2. **Fiziksel Ürünler ve Havacılık Parçaları:**
   - Sevkiyat sandığına (Export) yönlendirilirse $\rightarrow$ Anında yüksek nakit getirisi sağlar.
   - Roket Hangarına (Hangar Port) yönlendirilirse $\rightarrow$ Roket bileşenlerinin montajını ve yeni roket seviyelerini sağlar.

---

## 2. Katma Değer Zinciri ve Satış Skalası

Her işleme aşaması ürünün satış değerini çarparak artırır:

| Kademe | Örnek Eşyalar | Taban Satış Değeri ($) | İşleme Süresi | Rolü |
|---|---|---|---|---|
| **Tier 0 (Hammadde)** | Demir Cevheri, Bakır Cevheri, Kum | $1 - $2 | Doğal Giriş | Başlangıç sermayesi |
| **Tier 1 (İşlenmiş Toz & Külçe)** | Demir Tozu, Bakır Külçesi, Cam | $4 - $10 | 2.0 - 4.0 sn | İlk otomasyon geliri |
| **Tier 2 (Mekanik & Tel Parçalar)** | Çelik Levha, Bakır Tel, Dişli | $20 - $50 | 2.5 - 3.5 sn | Fabrikayı büyütme sermayesi |
| **Tier 3 (İleri Kompozit & Motor)** | Elektrik Motoru, Devre Kartı | $120 - $350 | 4.0 - 6.0 sn | Roket parça temeli |
| **Tier 4 (Havacılık Modülleri)** | Roket İtici Bloğu, Aviyonik, Panel | $1,000 - $5,000 | 8.0 - 10.0 sn | Roket fırlatma yakıtı/parçası |

---

## 3. Gelir Kaynakları (Income Faucets)

### 3.1. Manuel Tıklama ve Toplama (Click / Collect)
* Erken oyunda hammadde girişine veya bantlara tıklamak anlık kaynak ve para kazandırır.
* Tıklama değeri fabrikanın gelişimine paralel ölçeklenir:
  $$\text{Tıklama Değeri} = 1 + (\text{Saniyelik Fabrika İhracat Geliri} \times 0.05)$$
* Bu formül sayesinde tıklama başlangıçta oyunu hızlandırır, ileri aşamalarda ise tatmin edici bir aktif bonus olmaya devam eder.

### 3.2. Otomatik İhracat (Conveyor Export)
* Konveyör bandı ile `EXPORT` hücresine ulaştırılan her eşya anında satılır ve cüzdana eklenir.
* Sürekli, pasif ve kesintisiz ekonomik büyümenin temel motorudur.

### 3.3. Roket Fırlatma Ödülleri (Flight Payouts)
* Roket uçuşunda (`FlightScene`) kat edilen mesafe ve toplanan uzay parçaları fırlatma sonunda büyük bir nakit ödülüne dönüşür:
  $$\text{Fırlatma Ödülü} = (\text{Uçuş Mesafesi} \times 2) + (\text{Toplanan Hurda} \times 25) \times \text{Roket Çarpanı}$$
* Ayrıca başarılı her fırlatma kalıcı **Teknoloji Puanı** kazandırır.

---

## 4. Harcama Kalemleri (Income Sinks)

### 4.1. Makine Satın Alma ve Seviye Yükseltme
* Her makine seviye atlatılabilir (Seviye 1, 2, ... N).
* Her seviye makinenin işlem süresini kısaltır veya çıktı verimini artırır.
* Maliyet formülü (Klasik İncremental Eğrisi):
  $$\text{Yükseltme Maliyeti} = \text{Taban Maliyet} \times (1.15)^{\text{Mevcut Seviye}}$$

### 4.2. Fabrika Parseli Genişletme (Plot Unlocks)
* Fabrika küçük bir çekirdek alanla başlar ($8 \times 8$).
* Komşu kilitli ızgara parselleri tek seferlik nakit ödemelerle açılır:
  - Parsel 1 (Doğu Kanadı $8 \times 8$): $\$500$
  - Parsel 2 (Güney Kanadı $16 \times 8$): $\$2,500$
  - Parsel 3 (Batı İleri İmalat $8 \times 16$): $\$10,000$
  - Parsel 4 (Mega Kompleks $24 \times 24$): $\$50,000$

### 4.3. Roket Modül Montajı
* Roketin seviyesini yükseltmek için hem nakit sermaye hem de fabrikada üretilen fiziksel parçalar (örn: 10 Levha + 5 Motor) harcanır.

---

## 5. Dengeleme Prensipleri

1. **Hiçbir Zaman Çıkmaza Girmeme (No Softlock):**
   - Oyuncunun tüm parası bitse bile tıklama geliri ve ücretsiz sabit hammadde girişi her zaman aktiftir.
   - Makineler %100 fiyattan yıkılabildiği için harcanan sermaye her an geri kurtarılabilir.
2. **Hızlı Erken Oyun, Derin İleri Oyun:**
   - İlk 10 dakikada yükseltmeler her 10-30 saniyede bir satın alınabilir.
   - İleri oyunda oyuncu roket parçalarını biriktirmek için optimize fabrika hatları kurmaya odaklanır.
