# ROADMAP.md — Manufacturer Kilometre Taşları ve Yol Haritası

> **Tarihsel belge.** Bu dosya revival öncesi planı/denetimi anlatır ve oyunun güncel hâliyle birebir örtüşmeyebilir. Güncel durum: `PROJECT_STATUS.md`; bağlayıcı kararlar: `DECISIONS.md` (DEC-011 ve sonrası); güncel sayılar: `ECONOMY.md`.

> **Bu dosya, projenin yüksek seviyeli teslimat hedeflerini ve sürümlerini tanımlar.**
> Oyun vizyonu: "İncremental / Progression-Focused Factory Game" (Kalıcı Fabrika + Kademeli Genişleme + Roket Döngüsü).

---

## Sürüm Aşamaları

### Sürüm 0.1 — Faz 0: Keşif, Dokümantasyon & Planlama (TAMAMLANDI)
* Proje denetimi, kalıcı hafıza (`docs/`) ağacının kurulması, açık soruların çözülmesi ve mimari hizalama.

### Sürüm 0.2 — Faz 1: Saf Simülasyon Çekirdeği (TAMAMLANMAK ÜZERE)
* 2D Izgara, Eşya/Reçete/Makine kayıt defterleri, Konveyör slot akışı, Makine tamponları, Üretim motoru (`ProductionEngine`), Uçtan uca test, İncremental Ekonomi ve Serileştirme.

### Sürüm 0.3 — Faz 2: Phaser 3 2D Izgara ve Görselleştirme
* $32 \times 32$ piksel karo zemin, kilitli genişleme parsellerinin görsel sınırları, akıcı 60 FPS eşya sprite havuzu (object pooling), yönlü animasyonlu bantlar ve çalışan makine görselleri.

### Sürüm 0.4 — Faz 3: İncremental Etkileşim ve İnşa UX
* Tıkla-topla (Click / Collect) hammadde ve ürün etkileşimi, Makine A $\rightarrow$ Makine B akıllı sürükle-bağla konveyör aracı, %100 ücretsiz taşıma/yıkım, hızlı makine inceleme ve seviye yükseltme modalı.

### Sürüm 0.5 — Faz 4: Fabrika Genişleme Motoru ve Kilometre Taşları
* Kalıcı fabrikayı genişletme parselleri ($8 \times 8 \rightarrow 12 \times 8 \rightarrow 16 \times 12 \rightarrow 24 \times 24$), dinamik Milestone Objective Bar, çağ atlama eşikleri, hızlı yan kontratlar.

### Sürüm 0.6 — Faz 5: Roket Hangarı, Fırlatma ve Uzun Vadeli İlerleme Döngüsü
* Fabrikada üretilen havacılık parçalarıyla (Gövde, Motor, Aviyonik, Yakıt) roket modül montajı, `FlightScene` uçuş sahnesi entegrasyonu, uçuş ödülleriyle yeni fabrika yetenekleri ve alan kilitlerinin açılması (Factory $\rightarrow$ Rocket $\rightarrow$ Launch $\rightarrow$ Factory).

### Sürüm 1.0 — Faz 6: Cila, Kalıcı Kayıt ve CrazyGames Lansmanı
* Piksel parçacık animasyonları, ses efektleri, kesintisiz LocalStorage JSON kayıt/yükleme, çevrimdışı gelir hesaplaması ve CrazyGames SDK hazırlığı.
