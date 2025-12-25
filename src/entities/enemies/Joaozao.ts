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

  // Adicione uma flag para controlar a rotação da morte visualmente
  public deadRotation: number = 0;

  // Flag para garantir que o smash ocorra apenas uma vez por execução de ação
  private hasSmashed: boolean = false;
  // Impacto pendente para o jogo processar (câmera/partículas/som)
  private pendingImpact: { x: number; y: number } | null = null

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
      attackTimer: 0,
      deadRotation: 0,
      pendingDeath: false
    };
  }

  update(deltaTime: number, level: Level, playerX: number, _playerY: number): void {
    if (!this.data.active) return;

    this.data.animationTimer += deltaTime;

    // --- MELHORIA NA MORTE ---
    if (this.data.isDead) {
      this.data.deathTimer -= deltaTime;

      // Gira o corpo enquanto morre (efeito dramático)
      // Vai de 0 a 90 graus (PI/2) rapidamente
      if (this.deadRotation < Math.PI / 2) {
        this.deadRotation += deltaTime * 0.005;
      }

      // Espelha a rotação no objeto de dados para o renderer ler
      this.data.deadRotation = this.deadRotation;

      // Aplica gravidade na morte para ele cair do cenário se estiver no ar
      this.data.velocity.y += GRAVITY;
      this.data.position.y += this.data.velocity.y;
      this.data.position.x += this.data.velocity.x; // Mantém inércia horizontal

      if (this.data.deathTimer <= 0) {
        this.data.active = false;
      }
      return;
    }
    // -------------------------

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

    // --- MELHORIA NO DANO (Override visual) ---
    // Se estiver machucado recentemente, sobrepõe a animação atual com a de dor
    // Isso sincroniza visualmente com as falas "Hit React" (ex: "Porra nenhuma")
    if (this.hurtTimer > 200) { // Mostra dor nos primeiros 200ms do hit
      this.data.animationFrame = 3; // Frame 3 = DANO
    }
    // ------------------------------------------

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
      const leftCol = level.worldToCol(rect.x);
      const rightCol = level.worldToCol(rect.x + rect.width - 1);
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
    // Reset visual default
    this.data.animationFrame = 0;

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

        // FASE 1: PREPARAÇÃO (windup)
        if (this.actionTimer > 1500) {
          this.data.animationFrame = 1; // Braços pra cima
          this.hasSmashed = false;
        }
        // FASE 2: IMPACTO
        else if (this.actionTimer > 1200) {
          this.data.animationFrame = 2; // Smash!

          // Executa o smash apenas uma vez
          if (!this.hasSmashed) {
            const gapCol = level.worldToCol(playerX);
            for (let i = -1; i <= 1; i++) {
              // level.removeTileTemporarily espera indices de array, então gapCol + i deve ser indice de array
              // O removeTileTemporarily provavelmente espera indices de array, vamos confirmar.
              // Se gapCol vem de worldToCol, ele já é array index.
              level.removeTileTemporarily(gapCol + i, 9, 3000);
            }

            // Marca impacto para o jogo processar partículas/som/câmera
            this.hasSmashed = true;
            this.pendingImpact = { x: gapCol * TILE_SIZE + TILE_SIZE / 2, y: 9 * TILE_SIZE };
          }
        }
        // FASE 3: RECUPERAÇÃO
        else {
          this.data.animationFrame = 0;
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

  // Consumir impacto (retorna coordenadas do impacto e limpa o evento)
  consumeImpact(): { x: number; y: number } | null {
    const p = this.pendingImpact;
    this.pendingImpact = null;
    return p;
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

    this.hurtTimer = 800; // Aumentei um pouco para dar tempo da animação tocar
    this.data.health--;

    // Knockback mais forte para sentir o impacto
    this.data.velocity.y = -6;
    // Empurra para longe de onde o dano veio (simplificado aleatório ou baseado no player se tivesse ref)
    this.data.velocity.x = (Math.random() > 0.5 ? 1 : -1) * 3;

    this.phase = Math.min(3, 4 - this.data.health);

    if (this.data.health <= 0) {
      // Marca morte pendente e aguarda ação externa (ex: tocar fala) antes de executar a animação final
      this.data.pendingDeath = true;
      // Garante que a animação de dano esteja visível durante a fala
      this.hurtTimer = 800;
      // Bloqueia novas ações enquanto aguardamos a fala
      this.actionTimer = Number.MAX_SAFE_INTEGER;
      this.currentAction = 'idle';
      return { defeated: true, damaged: true };
    }

    return { defeated: false, damaged: true };
  }

  die(): void {
    this.data.isDead = true;
    this.data.pendingDeath = false;
    this.data.deathTimer = 3000; // Mais tempo para curtir a animação de morte
    this.data.velocity = { x: 0, y: -6 }; // Pulo da morte (clássico Mario boss)
    this.projectiles = [];

    // Reinicia rotação visual
    this.deadRotation = 0;
    this.data.deadRotation = 0;
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
