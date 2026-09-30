import Phaser from 'phaser';
import { GameScene } from './scenes/GameScene';
import { FlightScene } from './scenes/FlightScene';

const config: Phaser.Types.Core.GameConfig = {
  type: Phaser.AUTO,
  parent: 'game-container',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.CENTER_BOTH,
  },
  render: {
    pixelArt: true,
    roundPixels: true,
    antialias: false,
  },
  backgroundColor: '#070913',
  scene: [GameScene, FlightScene],
};

new Phaser.Game(config);
