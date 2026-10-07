import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { FlightScene } from './scenes/FlightScene';
import { crazyGames } from './integration/CrazyGamesSDK.ts';
import { UiHost } from './ui/system/UiHost.ts';

// CrazyGames SDK v3 Başlatma (Güvenli Fallback ile)
crazyGames.init().catch(() => {});

/** Tasarım taban çözünürlüğü; pencere boyutu henüz bilinmiyorken de bu boyutla açılır */
const BASE_WIDTH = 360;
const BASE_HEIGHT = 640;

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: BASE_WIDTH,
  height: BASE_HEIGHT,
  parent: 'game-container',
  backgroundColor: '#0f0e17',
  pixelArt: true,
  roundPixels: true,
  scale: {
    mode: Phaser.Scale.NONE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  physics: {
    default: 'arcade',
    arcade: { gravity: { x: 0, y: 0 }, debug: false },
  },
  scene: [GameScene, FlightScene],
};

const game = new Phaser.Game(config);
(window as unknown as { game: Phaser.Game }).game = game;

// Tuval boyutu, cihaz çözünürlüğü ve arayüz ölçeği tek yerden yönetilir
UiHost.init(game);

/**
 * Phaser klavye olaylarını bir sonraki oyun adımına kadar kuyrukta tutar ve her yeni
 * tuş olayında kuyruğun tamamını baştan işler. Aynı adım içinde birden çok tuş olayı
 * gelirse (hızlı basış, düşük kare hızı) önceki tuşlar ikinci kez tetiklenir; ör. ok
 * tuşu odağı iki kez kaydırır, Enter iki pencereyi birden onaylar. Kuyruk her tarayıcı
 * olayının hemen ardından boşaltılır; böylece her tuş tam bir kez işlenir.
 */
// `queue` Phaser'ın tür tanımlarında yer almaz
const keyboardManager = game.input.keyboard as unknown as { queue: KeyboardEvent[] } | null;
if (keyboardManager) {
  game.input.events.on(Phaser.Input.Events.MANAGER_PROCESS, () => {
    queueMicrotask(() => {
      keyboardManager.queue.length = 0;
    });
  });
}
