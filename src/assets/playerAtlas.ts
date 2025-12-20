// Especificação mínima do sprite do jogador (atlas)

export const playerSpriteSpec = {
  url: '/assets/sprites/feka.png',
  animations: {
    idle: { frames: [0], frameDuration: 250 },
    walk: { frames: [1, 2, 3, 2], frameDuration: 100 },
    run: { frames: [4, 5, 6, 5], frameDuration: 80 },
    jump: { frames: [7], frameDuration: 200 }
  }
};

export default playerSpriteSpec;