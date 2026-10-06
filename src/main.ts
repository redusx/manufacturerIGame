import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { FlightScene } from './scenes/FlightScene';
import { crazyGames } from './integration/CrazyGamesSDK.ts';

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

function handleResize() {
  const w = window.innerWidth;
  const h = window.innerHeight;

  // Gizli veya henüz yerleşmemiş çerçevede pencere 0x0 olur; 0 boyutlu WebGL
  // framebuffer açılışı çökertir. Gerçek boyut 'resize' ile gelene kadar bekle.
  if (w < 1 || h < 1) return;

  // Masaüstünde çok küçük kalmaması için float scale kullan
  const scale = Math.max(1, Math.min(w / BASE_WIDTH, h / BASE_HEIGHT));
  
  const gameW = Math.floor(w / scale);
  const gameH = Math.floor(h / scale);
  
  // Phaser zoom yerine CSS ile ölçeklendirerek bulanıklaşmayı engelle
  game.scale.setZoom(1);

  // CSS boyutu resize()'dan ÖNCE verilmeli: Phaser kanvası o anki CSS boyutuna göre
  // ortalar; sonra verilirse ortalama bir önceki pencere boyutuna göre kayık kalır.
  game.canvas.style.width = `${w}px`;
  game.canvas.style.height = `${h}px`;
  game.scale.resize(gameW, gameH);
}

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

handleResize();