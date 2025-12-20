// Inimigo Minion - Super Feka Gaps

import { EnemyData, EnemyType, Rect } from '../../types';
import { TILE_SIZE, GRAVITY, MAX_FALL_SPEED } from '../../constants';
import { Level } from '../../world/Level';

export class Minion {
  data: EnemyData;
  private speed: number = 0.8;

  constructor(spawnX: number, spawnY: number) {
    this.data = {
      position: { x: spawnX * TILE_SIZE, y: spawnY * TILE_SIZE - 19 },
      velocity: { x: -this.speed, y: 0 },
      width: 16,
      height: 19,
      active: true,
      type: EnemyType.MINION,
      facingRight: false,
      isDead: false,
      deathTimer: 0,
      animationFrame: 0,
      animationTimer: 0
    };
  }

  update(deltaTime: number, level: Level): void {
    if (!this.data.active) return;

    this.data.animationTimer += deltaTime;

    if (this.data.isDead) {
      // Animação de morte (fica achatado e desaparece)
      this.data.deathTimer -= deltaTime;
      if (this.data.deathTimer <= 0) {
        this.data.active = false;
      }
      return;
    }

    // Aplica gravidade
    this.data.velocity.y += GRAVITY * 0.5;
    this.data.velocity.y = Math.min(this.data.velocity.y, MAX_FALL_SPEED);

    // Move horizontalmente
    this.data.position.x += this.data.velocity.x;
    this.data.position.y += this.data.velocity.y;

    // Colisão com tiles
    const rect = this.getRect();
    const collision = level.resolveCollision(rect, { x: 0, y: this.data.velocity.y });
    this.data.position.y = collision.position.y;
    this.data.velocity.y = collision.velocity.y;

    // Verifica colisão horizontal com paredes
    this.checkWallCollision(level);

    // Verifica se caiu no gap
    if (level.isInGap(this.getRect())) {
      this.data.active = false;
    }
  }

  private checkWallCollision(level: Level): void {
    // Verifica tile à frente
    const checkX = this.data.facingRight 
      ? this.data.position.x + this.data.width + 2
      : this.data.position.x - 2;
    const checkY = this.data.position.y + this.data.height / 2;
    
    const tileCol = Math.floor(checkX / TILE_SIZE);
    const tileRow = Math.floor(checkY / TILE_SIZE);
    const tile = level.getTile(tileCol, tileRow);
    
    // Se há parede, inverte direção
    if (tile === 1 || tile === 2) {
      this.reverseDirection();
    }

    // Também verifica se há chão à frente (para não cair)
    const groundCheckX = this.data.facingRight
      ? this.data.position.x + this.data.width + 2
      : this.data.position.x - 2;
    const groundCheckY = this.data.position.y + this.data.height + 4;
    
    const groundCol = Math.floor(groundCheckX / TILE_SIZE);
    const groundRow = Math.floor(groundCheckY / TILE_SIZE);
    const groundTile = level.getTile(groundCol, groundRow);
    
    // Se não há chão à frente, inverte direção
    if (groundTile === 0 && this.data.velocity.y === 0) {
      this.reverseDirection();
    }
  }

  private reverseDirection(): void {
    this.data.facingRight = !this.data.facingRight;
    this.data.velocity.x = this.data.facingRight ? this.speed : -this.speed;
  }

  getRect(): Rect {
    return {
      x: this.data.position.x,
      y: this.data.position.y,
      width: this.data.width,
      height: this.data.height
    };
  }

  // Chamado quando player pula na cabeça
  stomp(): void {
    this.data.isDead = true;
    this.data.deathTimer = 300; // 300ms de animação
    this.data.velocity = { x: 0, y: 0 };
  }

  // Verifica colisão com player
  checkPlayerCollision(playerRect: Rect, prevPlayerRect?: Rect): { hit: boolean; fromAbove: boolean } {
    if (!this.data.active || this.data.isDead) {
      return { hit: false, fromAbove: false };
    }

    const myRect = this.getRect();
    
    // AABB collision
    const hit = myRect.x < playerRect.x + playerRect.width &&
                myRect.x + myRect.width > playerRect.x &&
                myRect.y < playerRect.y + playerRect.height &&
                myRect.y + myRect.height > playerRect.y;

    if (!hit) return { hit: false, fromAbove: false };

    // Verifica se player está vindo de cima (stomp)
    const minionTop = myRect.y;
    const playerBottom = playerRect.y + playerRect.height;
    let fromAbove = playerBottom < minionTop + myRect.height * 0.4;

    if (prevPlayerRect) {
      const prevBottom = prevPlayerRect.y + prevPlayerRect.height;
      const crossedTop = prevBottom <= minionTop + 1 && playerBottom >= minionTop - 0.1;
      const descending = playerBottom >= prevBottom;
      fromAbove = crossedTop && descending;
    }

    return { hit: true, fromAbove };
  }
}
