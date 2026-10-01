# OPEN_QUESTIONS.md — Açık Tasarım Kararları ve Makro Sorular

> **Bu dosya, projenin yönünü doğrudan değiştiren stratejik makro kararları listeler.**
> Kullanıcı yönlendirmesiyle kesinleşen kararlar `docs/DECISIONS.md` dosyasına aktarılmıştır.
> Küçük UI detayları, değişken isimleri veya teknik implementasyon ayrıntıları için soru sorulmaz; oyun hedeflerine göre belirlenir.

---

## 1. ÇÖZÜLEN TEMEL KARARLAR (RESOLVED)

* **[Q1] Oyunun Makro Yapısı: Kalıcı Fabrika + Kademeli Genişleme (DEC-006)**
  - *Karar:* Bağımsız puzzle bölümleri kaldırıldı. Oyuncunun tek bir kalıcı fabrikası vardır ($8 \times 8$ ile başlar), para ve roket ilerlemesiyle yeni parseller/alanlar açılarak fabrika fiziksel olarak büyütülür. Bölümler "Progression Milestones" olarak kurgulanır.
* **[Q2] Makine Taşıma / Yıkma Maliyeti: %100 Ücretsiz & Sıfır Sürtünme (DEC-007)**
  - *Karar:* Yıkım ve taşıma %100 iade sağlar, ceza yoktur. Oyuncu serbestçe denemeli, düzenlemeli ve optimize etmelidir.
* **[Q3] Konveyör Bant Çizim Kontrolü: Akıllı ve Zahmetsiz Bağlantı (DEC-008)**
  - *Karar:* Tile tile angarya tıklama yerine Makine A $\rightarrow$ Makine B otomatik akıllı bağlantı (point-to-point) esastır.
* **[Q4] Roket Uçuş Sahnesi: Uzun Vadeli İlerleme Omurgası (DEC-009)**
  - *Karar:* Ayrık minigame değildir; fabrikanın ürettiği havacılık parçalarıyla (Gövde, Motor, Aviyonik, Yakıt) donatılır. Fırlatma ile ulaşılan irtifa/menzil yeni teknolojileri, fabrika genişleme parsellerini ve çarpan ödüllerini açar.

---

## 2. AÇIK MAKRO KARARLAR (İlerleyen Fazlarda Değerlendirilecek)

### [MQ-1] Prestij (Prestige / Soft Reset) Mekaniği
* **Soru:** Roket uzay görevini (örneğin Ay/Yörünge kolonizasyonu) tamamladığında klasik incremental prestij (kalıcı kozmik çarpanlar ve meta-puan karşılığı fabrikayı sıfırlayıp 10x hızla baştan başlama) olmalı mı?
* **Öneri:** İlk MVP'de prestij sıfırlaması olmadan lineer fabrika genişlemesi tamamlanmalı; 1.0 sürümüne doğru sonsuz döngü (infinite loop) için meta-prestij eklenmelidir.

### [MQ-2] Çevrimdışı Gelir (Offline Earnings) Derinliği
* **Soru:** Oyuncu oyunda yokken fabrikanın üretim yapması hangi oranda sınırlanmalı?
* **Öneri:** Maksimum 4 saat boyunca %50 verimle temel gelir birikimi (klasik incremental standardı), roket yükseltmeleri ile bu sürenin 8-12 saate çıkarılabilmesi.
