# Manufacturer — Fabrika İncremental Oyunu

Tarayıcıda çalışan, CrazyGames'e yayımlanmaya uygun 2D fabrika incremental/clicker oyunu.

## Çalıştırma

```bash
npm install
npm run dev
```

Terminalde görünen URL'yi (genelde `http://localhost:5173`) tarayıcıda aç.

## Üretim Build

```bash
npm run build
```

Çıktı `dist/` klasörüne yazılır. CrazyGames'e ZIP olarak yüklenebilir.

## Dosya Haritası

| Dosya / Klasör | Sorumluluk |
|---|---|
| `src/main.ts` | Phaser oyun başlatma |
| `src/scenes/GameScene.ts` | Ana sahne: fabrika görseli, oyun döngüsü, UI entegrasyonu |
| `src/economy/EconomyManager.ts` | Ekonomi motoru: kaynak, makine, maliyet, üretim hesapları |
| `src/data/MachineData.ts` | Merkezi makine tanımları ve ekonomi sabitleri |
| `src/save/SaveManager.ts` | localStorage kayıt/yükleme, offline ilerleme |
| `src/ui/HUD.ts` | Üst bilgi çubuğu (kaynak, üretim hızı, ayarlar) |
| `src/ui/MachineCard.ts` | Makine kartı bileşeni |
| `src/ui/SettingsPanel.ts` | Ayarlar paneli (kayıt sıfırlama) |
| `src/utils/format.ts` | Sayı ve süre formatlama |

## Teknoloji

- **Phaser 3** — Oyun motoru
- **TypeScript** — Dil
- **Vite** — Bundler / dev server

## Oyun Mekaniği

- Tıklayarak temel kaynak ("Parça") kazan
- 4 farklı makine türü satın al (otomatik üretim)
- Makineleri yükselterek üretimi artır
- Yeni makineler toplam kazanıma göre açılır
- İlerleme localStorage'a kaydedilir
- Oyundan ayrıyken offline üretim (maks 4 saat, %50 verimlilik)
