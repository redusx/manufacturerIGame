import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { FlightScene } from './scenes/FlightScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  width: 100,
  height: 100,
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
  
  // Masaüstünde çok küçük kalmaması için float scale kullan
  const scale = Math.max(1, Math.min(w / 360, h / 640));
  
  const gameW = Math.floor(w / scale);
  const gameH = Math.floor(h / scale);
  
  // Phaser zoom yerine CSS ile ölçeklendirerek bulanıklaşmayı engelle
  game.scale.setZoom(1);
  game.scale.resize(gameW, gameH);
  
  game.canvas.style.width = `${w}px`;
  game.canvas.style.height = `${h}px`;
}

window.addEventListener('resize', handleResize);
window.addEventListener('orientationchange', handleResize);

handleResize();