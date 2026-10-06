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
| `src/main.ts` | Phaser oyun başlatma, ekran boyutu |
| `src/scenes/GameScene.ts` | Fabrika sahnesi: simülasyon döngüsü, UI ve araçların bağlanması |
| `src/scenes/FlightScene.ts` | Roket uçuşu sahnesi |
| `src/factory/simulation/` | Saf simülasyon: ızgara, bantlar, makineler, reçeteler, eşyalar, fabrika ekonomisi, hangar köprüsü |
| `src/factory/progression/` | 10 aşamalı ilerleme, parsel genişletme (kontrat yöneticisi henüz oyuna bağlı değil) |
| `src/factory/input/` | Yerleştirme (sürükleyerek bant çizimi dahil) ve söküm araçları |
| `src/factory/view/` | Izgara, bant, makine çizimi; kamera; makine inceleme penceresi |
| `src/factory/persistence/`, `src/save/` | localStorage kayıt/yükleme, çevrimdışı gelir |
| `src/economy/EconomyManager.ts` | Oyunun tek kasası: para, toplam kazanç, roket seviyeleri |
| `src/ui/` | HUD, aşama çubuğu, katalog, hangar, ayarlar, tema |
| `docs/PROJECT_STATUS.md`, `docs/DECISIONS.md` | Güncel durum ve bağlayıcı tasarım kararları |

## Teknoloji

- **Phaser 3** — Oyun motoru
- **TypeScript** — Dil
- **Vite** — Bundler / dev server

## Test

```bash
npm test
```

## Oyun Mekaniği

- Hammadde girişinden çıkan cevheri bantlarla makinelere taşı, işle ve sevkiyat sandığında sat
- 6 makine türü, 17 reçete; makineler ve hammaddeler 10 aşamalı ilerlemeyle açılır
- Fabrika alanı parsel satın alarak 8x8'den 24x24'e büyür
- Roket hangarı: modüller fabrikada üretilen parçalar + nakit ile yükseltilir
- Roket uçuşu fabrika gelirine bağlı bir prim ve kalıcı gelir çarpanı kazandırır; uçarken fabrika çalışmaya devam eder
- İlerleme localStorage'a kaydedilir; oyundan ayrıyken çevrimdışı gelir (en fazla 4 saat, %50 verim)
