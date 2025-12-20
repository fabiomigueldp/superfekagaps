// Boss Joãozão - Super Feka Gaps

import { EnemyData, EnemyType, Rect, Projectile } from '../../types';
import { TILE_SIZE, GRAVITY, MAX_FALL_SPEED } from '../../constants';
import { Level } from '../../world/Level';


export class Joaozao {
  data: EnemyData;
  private speed: number = 1.2;
  private phase: number = 1; // Fases do boss (fica mais difícil)
  private actionTimer: number = 0;
  private currentAction: 'idle' | 'walk' | 'jump' | 'attack' | 'create_gap' = 'idle';
  projectiles: Projectile[] = [];
  private targetX: number = 0;
  private isGrounded: boolean = false;
  private hurtTimer: number = 0;

  constructor(spawnX: number, spawnY: number) {
    this.data = {
      position: { x: spawnX * TILE_SIZE, y: spawnY * TILE_SIZE - 40 },
      velocity: { x: 0, y: 0 },
      width: 32,
      height: 40,
      active: true,
      type: EnemyType.JOAOZAO,
      facingRight: false,
      isDead: false,
      deathTimer: 0,
      animationFrame: 0,
      animationTimer: 0,
      health: 3,
      attackTimer: 0
    };
  }

  update(deltaTime: number, level: Level, playerX: number, _playerY: number): void {
    if (!this.data.active) return;

    this.data.animationTimer += deltaTime;

    if (this.data.isDead) {
      this.data.deathTimer -= deltaTime;
      if (this.data.deathTimer <= 0) {
        this.data.active = false;
      }
      return;
    }

    // Atualiza attack timer
    if (this.data.attackTimer !== undefined) {
      this.data.attackTimer -= deltaTime;
    }


    if (this.hurtTimer > 0) {
      this.hurtTimer = Math.max(0, this.hurtTimer - deltaTime);
    }

    // Atualiza ação
    this.actionTimer -= deltaTime;
    if (this.actionTimer <= 0) {
      this.chooseNextAction(playerX);
    }

    // Executa ação atual
    this.executeAction(deltaTime, level, playerX);

    // Aplica gravidade
    this.data.velocity.y += GRAVITY * 0.7;
    this.data.velocity.y = Math.min(this.data.velocity.y, MAX_FALL_SPEED);

    // Move
    this.data.position.x += this.data.velocity.x;
    this.data.position.y += this.data.velocity.y;

    // Colisão
    const rect = this.getRect();
    const collision = level.resolveCollision(rect, this.data.velocity);
    this.data.position = collision.position;
    this.data.velocity.y = collision.velocity.y;
    this.isGrounded = collision.grounded;

    // Se bateu a cabeça em um tile, tenta quebrar tijolos (verifica toda a largura do chefe)
    if (collision.tileHit && collision.tileHit.side === 'top') {
      const headRow = collision.tileHit.row;
      const leftCol = Math.floor(rect.x / TILE_SIZE);
      const rightCol = Math.floor((rect.x + rect.width - 1) / TILE_SIZE);
      for (let col = leftCol; col <= rightCol; col++) {
        const res = level.breakTile(col, headRow);
        if (res.success) {
          // Opcional: spawn partículas / tocar som aqui
        }
      }
    }

    // Limita aos bounds da arena
    if (this.data.position.x < TILE_SIZE * 2) {
      this.data.position.x = TILE_SIZE * 2;
      this.data.velocity.x = Math.abs(this.data.velocity.x);
    }
    if (this.data.position.x > TILE_SIZE * 35) {
      this.data.position.x = TILE_SIZE * 35;
      this.data.velocity.x = -Math.abs(this.data.velocity.x);
    }

    // Atualiza projéteis
    this.updateProjectiles(deltaTime, level);

    // Olha para o player
    this.data.facingRight = playerX > this.data.position.x + this.data.width / 2;
  }

  private chooseNextAction(playerX: number): void {
    const rand = Math.random();
    const distToPlayer = Math.abs(playerX - this.data.position.x);

    // Chance maior de atacar quando player está perto
    if (distToPlayer < 100 && rand < 0.4) {
      this.currentAction = 'attack';
      this.actionTimer = 1500;
    } else if (rand < 0.5) {
      this.currentAction = 'walk';
      this.actionTimer = 2000;
      this.targetX = playerX;
    } else if (rand < 0.7 && this.isGrounded) {
      this.currentAction = 'jump';
      this.actionTimer = 800;
    } else if (rand < 0.85 && this.phase >= 2) {
      this.currentAction = 'create_gap';
      this.actionTimer = 2000;
    } else {
      this.currentAction = 'idle';
      this.actionTimer = 500;
    }
  }

  private executeAction(_deltaTime: number, level: Level, playerX: number): void {
    switch (this.currentAction) {
      case 'idle':
        this.data.velocity.x *= 0.9;
        break;

      case 'walk':
        const dir = this.targetX > this.data.position.x ? 1 : -1;
        this.data.velocity.x = dir * this.speed * (1 + this.phase * 0.2);
        break;

      case 'jump':
        if (this.isGrounded) {
          this.data.velocity.y = -8;
        }
        break;

      case 'attack':
        this.data.velocity.x *= 0.5;
        // CORREÇÃO: Removida a verificação truthy do timer
        // Agora, se for 0, ele entra no bloco e atira.
        // O uso de '?? 0' garante que não quebre se for undefined (segurança extra)
        if ((this.data.attackTimer ?? 0) <= 0) {
          this.fireProjectile(playerX);
          this.data.attackTimer = 800 - this.phase * 100;
        }
        break;

      case 'create_gap':
        this.data.velocity.x = 0;
        // Cria gaps temporários
        if (this.actionTimer < 1800 && this.actionTimer > 1600) {
          const gapCol = Math.floor(playerX / TILE_SIZE);
          for (let i = -1; i <= 1; i++) {
            level.removeTileTemporarily(gapCol + i, 9, 3000);
          }
        }
        break;
    }
  }

  private fireProjectile(playerX: number): void {
    const dirX = playerX > this.data.position.x ? 1 : -1;
    const projectile: Projectile = {
      position: { 
        x: this.data.position.x + this.data.width / 2,
        y: this.data.position.y + this.data.height / 2
      },
      velocity: { x: dirX * 3, y: 0 },
      width: 8,
      height: 8,
      active: true,
      damage: 1,
      owner: 'enemy'
    };
    this.projectiles.push(projectile);
  }

  private updateProjectiles(_deltaTime: number, level: Level): void {
    this.projectiles = this.projectiles.filter(p => {
      if (!p.active) return false;

      p.position.x += p.velocity.x;
      p.position.y += p.velocity.y;

      // Remove se saiu da tela
      if (p.position.x < 0 || p.position.x > level.data.width * TILE_SIZE) {
        return false;
      }

      return true;
    });
  }

  getRect(): Rect {
    return {
      x: this.data.position.x,
      y: this.data.position.y,
      width: this.data.width,
      height: this.data.height
    };
  }
  // Chamado quando player pula na cabe?a
  takeDamage(): { defeated: boolean; damaged: boolean } {
    if (!this.data.health || this.data.isDead) {
      return { defeated: false, damaged: false };
    }
    if (this.hurtTimer > 0) {
      return { defeated: false, damaged: false };
    }

    this.hurtTimer = 400;
    this.data.health--;

    // Knockback
    this.data.velocity.y = -5;
    this.data.velocity.x = (Math.random() - 0.5) * 4;

    // Aumenta fase (fica mais agressivo)
    this.phase = Math.min(3, 4 - this.data.health);

    if (this.data.health <= 0) {
      this.die();
      return { defeated: true, damaged: true };
    }

    return { defeated: false, damaged: true };
  }

  die(): void {
    this.data.isDead = true;
    this.data.deathTimer = 2000;
    this.data.velocity = { x: 0, y: -8 };
    this.projectiles = [];
  }

  // Verifica colisão com player
  checkPlayerCollision(playerRect: Rect, prevPlayerRect?: Rect): { hit: boolean; fromAbove: boolean } {
    if (!this.data.active || this.data.isDead) {
      return { hit: false, fromAbove: false };
    }

    const myRect = this.getRect();
    
    const hit = myRect.x < playerRect.x + playerRect.width &&
                myRect.x + myRect.width > playerRect.x &&
                myRect.y < playerRect.y + playerRect.height &&
                myRect.y + myRect.height > playerRect.y;

    if (!hit) return { hit: false, fromAbove: false };

    const bossTop = myRect.y;
    const playerBottom = playerRect.y + playerRect.height;
    let fromAbove = playerBottom < bossTop + myRect.height * 0.3;

    if (prevPlayerRect) {
      const prevBottom = prevPlayerRect.y + prevPlayerRect.height;
      const crossedTop = prevBottom <= bossTop + 1 && playerBottom >= bossTop - 0.1;
      const descending = playerBottom >= prevBottom;
      fromAbove = crossedTop && descending;
    }

    return { hit: true, fromAbove };
  }

  // Verifica colisão de projéteis com player
  checkProjectileCollision(playerRect: Rect): boolean {
    for (let i = 0; i < this.projectiles.length; i++) {
      const p = this.projectiles[i];
      if (!p.active) continue;

      const hit = p.position.x < playerRect.x + playerRect.width &&
                  p.position.x + p.width > playerRect.x &&
                  p.position.y < playerRect.y + playerRect.height &&
                  p.position.y + p.height > playerRect.y;

      if (hit) {
        p.active = false;
        return true;
      }
    }
    return false;
  }

  isDefeated(): boolean {
    return this.data.isDead && this.data.deathTimer <= 0;
  }

  getHealth(): number {
    return this.data.health || 0;
  }
}
