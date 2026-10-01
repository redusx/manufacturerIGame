# TESTING.md — Manufacturer Test Stratejisi ve Protokolü

> **Bu dosya, projede uygulanacak test metodolojisini ve test paketlerini tanımlar.**

---

## 1. Test Stratejisi: Saf Mantık $\leftrightarrow$ Görsel Ayrımı

* `src/factory/simulation/` altındaki tüm mantıksal sınıflar **Phaser'dan bağımsız saf TypeScript kodlarıdır**.
* Bu sayede tarayıcı açmaya veya karmaşık DOM mock'lamaya gerek kalmadan Node.js ortamında (örn. `node:test` veya `vitest`) saniyeler içinde yüzlerce test çalıştırılabilir.

---

## 2. Test Kategorileri ve Kapsam

### 2.1. Birim Testleri (Unit Tests)
* **Reçete Hesaplamaları:** Girdi eşyalarının eksiksiz tüketilmesi, çıktıların doğru oranda üretilmesi.
* **Makine Durum Makinesi:** Tampon dolunca `BLOCKED_OUTPUT`, girdi yetersizken `WAITING_INPUT` durumuna geçişin doğrulanması.
* **Konveyör Slot Hareketi:** Bir eşyanın slotlar arasında ilerlemesi, yön kontrolü ve bant sonunda durması.
* **Ekonomi:** Net kâr, sermaye harcamaları ve sipariş prim hesapları.

### 2.2. Entegrasyon Testleri (Integration Tests)
* **Tam Hat Akış Testi:**
  ```text
  [Hammadde Girişi] ──> [Bant] ──> [Kırıcı] ──> [Bant] ──> [Fırın] ──> [Bant] ──> [Sevkiyat]
  ```
  100 tick simülasyon çalıştırıldığında, ihracat portuna beklenen sayıda ürünün ulaştığının ve paranın cüzdana yansıdığının kanıtlanması.
* **Geri Tepme (Backpressure) Testi:** Sevkiyat portu kapatıldığında tüm hattın sırayla geriye doğru durduğunun doğrulanması.

### 2.3. Kayıt / Yükleme (Persistence) Testleri
* Karmaşık bir fabrika durumunun serileştirilip tekrar yüklendiğinde hiçbir eşya veya makine durumunun kaybolmadığının doğrulanması.

---

## 3. Komut Satırı Doğrulaması
Her görev tamamlandığında şu iki kontrol zorunludur:
1. `cmd /c npx tsc --noEmit` (0 hata olmalı)
2. `cmd /c npm run build` (Paketleme başarılı olmalı)
3. Otomatik test paketi koşulmalı.
