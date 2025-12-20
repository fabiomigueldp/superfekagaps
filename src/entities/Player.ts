// Entidade Player (Feka) - Super Feka Gaps

import { 
  GRAVITY, MAX_FALL_SPEED, PLAYER_SPEED, PLAYER_RUN_SPEED, 
  PLAYER_JUMP_FORCE, PLAYER_ACCELERATION, PLAYER_FRICTION,
  COYOTE_TIME, JUMP_BUFFER_TIME, TILE_SIZE,
  GP_WINDUP_MS, GP_RECOVERY_MS, GP_FALL_SPEED, GP_HORIZONTAL_MULT
} from '../constants';
import { PlayerData, InputState, Vector2, Rect, GroundPoundState } from '../types';
import { Level } from '../world/Level';
import { PLAYER_HITBOX_W, PLAYER_HITBOX_H } from '../assets/playerSpriteSpec';

export class Player {
  data: PlayerData;
  private jumpHoldTime: number = 0;
  private maxJumpHoldTime: number = 150; // ms para pulo máximo
  private prevRectForContacts: Rect | null = null;
  private prevVelocityForContacts: Vector2 = { x: 0, y: 0 };
  private prevGroundPoundStateForContacts: GroundPoundState = GroundPoundState.NONE;

  constructor(spawnX: number, spawnY: number) {
    this.data = {
      position: { x: spawnX * TILE_SIZE, y: spawnY * TILE_SIZE - PLAYER_HITBOX_H },
      velocity: { x: 0, y: 0 },
      width: PLAYER_HITBOX_W,
      height: PLAYER_HITBOX_H,
      active: true,
      isGrounded: false,
      isRunning: false,
      facingRight: true,
      coyoteTimer: 0,
      jumpBufferTimer: 0,
      isJumping: false,
      isDead: false,
      deathTimer: 0,
      deathTimerMax: 0,
      invincibleTimer: 0,
      hasHelmet: false,
      coffeeTimer: 0,
      animationFrame: 0,
      animationTimer: 0,
      groundPoundState: GroundPoundState.NONE,
      groundPoundTimer: 0
    };
  }

  update(deltaTime: number, input: InputState, level: Level): { 
    tileHit?: { type: number; col: number; row: number; side: 'top'|'bottom'|'left'|'right' } | null,
    groundPoundImpact?: { x: number, y: number, col: number, row: number } | null,
    groundPoundStarted?: boolean
  } {
    if (this.data.isDead) return {};

    // Salva estado anterior para sweep tests de contato
    const prevRect = this.getRect();
    this.prevRectForContacts = { ...prevRect };
    this.prevVelocityForContacts = { ...this.data.velocity };
    this.prevGroundPoundStateForContacts = this.data.groundPoundState;
    const prevGrounded = this.data.isGrounded;

    // Atualiza timers
    this.updateTimers(deltaTime);
    this.data.animationTimer += deltaTime;

    // Processa Ground Pound
    const gpResult = this.handleGroundPound(input, deltaTime, level);
    const gpImpact = gpResult.impact;
    const gpStarted = gpResult.started;

    // Processa input horizontal (se não estiver em windup/recovery)
    if (this.data.groundPoundState === GroundPoundState.NONE || this.data.groundPoundState === GroundPoundState.FALL) {
      this.handleHorizontalMovement(input);
    } else {
      // Em windup ou recovery, velocidade horizontal cai drasticamente
      this.data.velocity.x *= 0.8;
    }

    // Processa pulo (bloqueado durante ground pound)
    if (this.data.groundPoundState === GroundPoundState.NONE) {
      this.handleJump(input, deltaTime);
    }

    // Aplica gravidade (se não estiver em windup ou recovery)
    if (this.data.groundPoundState === GroundPoundState.NONE || this.data.groundPoundState === GroundPoundState.FALL) {
      this.applyGravity();
    } else if (this.data.groundPoundState === GroundPoundState.WINDUP) {
      // Pausa no ar durante windup
      this.data.velocity.y = 0;
    } else if (this.data.groundPoundState === GroundPoundState.RECOVERY) {
      this.data.velocity.y = 0;
      this.data.velocity.x = 0;
    }

    // Resolve colisões (passando prevRect para plataformas one-way corretas)
    const collisionResult = this.resolveCollisions(level, prevRect);

    // Aplica resultado
    this.data.position = collisionResult.position;
    this.data.velocity = collisionResult.velocity;
    this.data.isGrounded = collisionResult.grounded;

    // Guard rail: se estamos no chão, garante que isJumping seja resetado
    if (this.data.isGrounded) {
      this.data.isJumping = false;
    }

    // Se aterrissou durante FALL, muda para RECOVERY
    if (this.data.isGrounded && this.data.groundPoundState === GroundPoundState.FALL) {
      this.data.groundPoundState = GroundPoundState.RECOVERY;
      this.data.groundPoundTimer = GP_RECOVERY_MS;
      
      // Calcula tile abaixo para o evento
      const centerX = this.data.position.x + this.data.width / 2;
      const bottomY = this.data.position.y + this.data.height + 2;
      const col = Math.floor(centerX / TILE_SIZE);
      const row = Math.floor(bottomY / TILE_SIZE);

      return { 
        tileHit: collisionResult.tileHit || null,
        groundPoundImpact: { x: centerX, y: this.data.position.y + this.data.height, col, row },
        groundPoundStarted: gpStarted
      };
    }

    // Ground snap: se estava grounded e agora não, testa 1px abaixo para estabilidade
    if (!this.data.isGrounded && prevGrounded && this.data.groundPoundState === GroundPoundState.NONE) {
      const snapTest = level.resolveCollision({ x: this.data.position.x, y: this.data.position.y, width: this.data.width, height: this.data.height }, { x: 0, y: 1 }, prevRect);
      if (snapTest.grounded && Math.abs(snapTest.position.y - this.data.position.y) <= 2) {
        this.data.position.y = snapTest.position.y;
        this.data.isGrounded = true;
      }
    }

    // Verifica queda no gap
    if (level.isInGap(this.getRect())) {
      this.die();
    }

    // Verifica colisão com spikes
    return { 
      tileHit: collisionResult.tileHit || null,
      groundPoundImpact: gpImpact || null,
      groundPoundStarted: gpStarted
    };
  }

  private updateTimers(deltaTime: number): void {
    // Coyote time
    if (this.data.isGrounded) {
      this.data.coyoteTimer = COYOTE_TIME;
    } else {
      this.data.coyoteTimer = Math.max(0, this.data.coyoteTimer - deltaTime);
    }

    // Jump buffer
    this.data.jumpBufferTimer = Math.max(0, this.data.jumpBufferTimer - deltaTime);

    // Invencibilidade
    if (this.data.invincibleTimer > 0) {
      this.data.invincibleTimer = Math.max(0, this.data.invincibleTimer - deltaTime);
    }

    // Café (velocidade extra)
    if (this.data.coffeeTimer > 0) {
      this.data.coffeeTimer = Math.max(0, this.data.coffeeTimer - deltaTime);
    }
  }

  private handleHorizontalMovement(input: InputState): void {
    this.data.isRunning = input.run;
    
    // Velocidade máxima baseada em correr e café
    let maxSpeed = input.run ? PLAYER_RUN_SPEED : PLAYER_SPEED;
    if (this.data.coffeeTimer > 0) {
      maxSpeed *= 1.5;
    }

    // Direção
    let targetVelX = 0;
    if (input.left) {
      targetVelX = -maxSpeed;
      this.data.facingRight = false;
    }
    if (input.right) {
      targetVelX = maxSpeed;
      this.data.facingRight = true;
    }

    // Aceleração/desaceleração suave
    if (targetVelX !== 0) {
      // Acelerando
      let accel = PLAYER_ACCELERATION;
      if (this.data.groundPoundState === GroundPoundState.FALL) {
        accel *= GP_HORIZONTAL_MULT;
      }

      if (Math.abs(this.data.velocity.x) < Math.abs(targetVelX)) {
        this.data.velocity.x += Math.sign(targetVelX) * accel;
      }
      // Limita velocidade
      if (Math.abs(this.data.velocity.x) > maxSpeed) {
        this.data.velocity.x = Math.sign(this.data.velocity.x) * maxSpeed;
      }
    } else {
      // Desacelerando (fricção)
      this.data.velocity.x *= PLAYER_FRICTION;
      if (Math.abs(this.data.velocity.x) < 0.1) {
        this.data.velocity.x = 0;
      }
    }
  }

  private handleJump(input: InputState, deltaTime: number): void {
    // Buffer de pulo
    if (input.jumpPressed) {
      this.data.jumpBufferTimer = JUMP_BUFFER_TIME;
    }

    // Pode pular? (coyote time + jump buffer)
    const canJump = (this.data.isGrounded || this.data.coyoteTimer > 0) && 
                    !this.data.isJumping;

    if (this.data.jumpBufferTimer > 0 && canJump) {
      // Inicia pulo
      this.data.velocity.y = PLAYER_JUMP_FORCE;
      this.data.isJumping = true;
      this.data.isGrounded = false;
      this.data.coyoteTimer = 0;
      this.data.jumpBufferTimer = 0;
      this.jumpHoldTime = 0;
    }

    // Pulo variável (segurar aumenta altura)
    if (this.data.isJumping && input.jump && this.jumpHoldTime < this.maxJumpHoldTime) {
      this.jumpHoldTime += deltaTime;
      // Reduz gravidade enquanto segura
      this.data.velocity.y = Math.min(this.data.velocity.y, PLAYER_JUMP_FORCE * 0.9);
    }

    // Soltou o pulo - corta a altura
    if (input.jumpReleased && this.data.velocity.y < 0) {
      this.data.velocity.y *= 0.5;
      this.data.isJumping = false;
    }

    // Resetar isJumping quando começa a cair
    if (this.data.velocity.y > 0) {
      this.data.isJumping = false;
    }
  }

  private handleGroundPound(input: InputState, deltaTime: number, _level: Level): { impact: { x: number, y: number, col: number, row: number } | null, started: boolean } {
    let started = false;

    // Gatilho: no ar, apertou baixo, não está em ground pound
    if (this.data.groundPoundState === GroundPoundState.NONE && !this.data.isGrounded && input.downPressed) {
      this.data.groundPoundState = GroundPoundState.WINDUP;
      this.data.groundPoundTimer = GP_WINDUP_MS;
      this.data.velocity.y = 0; // Pausa vertical
      this.data.isJumping = false; // Reset isJumping para permitir pular após a sentada
      started = true;
    }

    // Máquina de estados (aplica timer somente em WINDUP e RECOVERY)
    if (this.data.groundPoundState === GroundPoundState.WINDUP || this.data.groundPoundState === GroundPoundState.RECOVERY) {
      this.data.groundPoundTimer -= deltaTime;

      if (this.data.groundPoundTimer <= 0) {
        if (this.data.groundPoundState === GroundPoundState.WINDUP) {
          // Transição WINDUP -> FALL
          this.data.groundPoundState = GroundPoundState.FALL;
          this.data.velocity.y = GP_FALL_SPEED;
        } else if (this.data.groundPoundState === GroundPoundState.RECOVERY) {
          // Transição RECOVERY -> NONE
          this.data.groundPoundState = GroundPoundState.NONE;
        }
      }
    }

    return { impact: null, started };
  }

  private applyGravity(): void {
    this.data.velocity.y += GRAVITY;
    const cap = (this.data.groundPoundState === GroundPoundState.FALL) ? Math.max(MAX_FALL_SPEED, GP_FALL_SPEED) : MAX_FALL_SPEED;
    this.data.velocity.y = Math.min(this.data.velocity.y, cap);
  }

  private resolveCollisions(level: Level, prevRect: { x: number; y: number; width: number; height: number }): { position: { x: number; y: number }, velocity: { x: number; y: number }, grounded: boolean, tileHit?: { type: number; col: number; row: number; side: 'top'|'bottom'|'left'|'right' } | null } {
    const rect = this.getRect();
    const result = level.resolveCollision(rect, this.data.velocity, prevRect);

    return {
      position: result.position,
      velocity: result.velocity,
      grounded: result.grounded,
      tileHit: result.tileHit || null
    };
  }

  getRect(): Rect {
    return {
      x: this.data.position.x,
      y: this.data.position.y,
      width: this.data.width,
      height: this.data.height
    };
  }

  getCenter(): Vector2 {
    return {
      x: this.data.position.x + this.data.width / 2,
      y: this.data.position.y + this.data.height / 2
    };
  }

  getFeetPosition(): Vector2 {
    return {
      x: this.data.position.x + this.data.width / 2,
      y: this.data.position.y + this.data.height
    };
  }

  takeDamage(): { damaged: boolean; helmetUsed: boolean } {
    if (this.data.invincibleTimer > 0 || this.data.isDead) {
      return { damaged: false, helmetUsed: false };
    }

    if (this.data.hasHelmet) {
      // Capacete absorve o dano
      this.data.hasHelmet = false;
      this.data.invincibleTimer = 1000;
      return { damaged: false, helmetUsed: true };
    }

    // Toma dano real
    return { damaged: true, helmetUsed: false };
  }

  die(): void {
    this.data.isDead = true;
    this.data.deathTimerMax = 600;
    this.data.deathTimer = 600;
    this.data.velocity = { x: 0, y: PLAYER_JUMP_FORCE };
  }

  respawn(position: Vector2): void {
    this.data.position = { 
      x: position.x * TILE_SIZE, 
      y: position.y * TILE_SIZE - this.data.height 
    };
    this.data.velocity = { x: 0, y: 0 };
    this.data.isDead = false;
    this.data.deathTimer = 0;
    this.data.deathTimerMax = 0;
    this.data.isGrounded = false;
    this.data.isJumping = false;
    this.data.invincibleTimer = 2000; // 2 segundos de invencibilidade
  }

  collectCoffee(): void {
    this.data.coffeeTimer = 10000; // 10 segundos
  }

  collectHelmet(): void {
    this.data.hasHelmet = true;
  }

  // Verifica se pode dar stomp em inimigo (caindo de cima)
  canStomp(): boolean {
    return this.data.velocity.y > 0 && this.data.groundPoundState === GroundPoundState.NONE;
  }

  isGroundPoundFalling(): boolean {
    return this.data.groundPoundState === GroundPoundState.FALL;
  }

  isGroundPoundActive(): boolean {
    return this.data.groundPoundState !== GroundPoundState.NONE;
  }

  getPrevRectForContacts(): Rect {
    return this.prevRectForContacts || this.getRect();
  }

  getPrevVelocityForContacts(): Vector2 {
    return this.prevVelocityForContacts;
  }

  getPrevGroundPoundStateForContacts(): GroundPoundState {
    return this.prevGroundPoundStateForContacts;
  }

  // Bounce após stomp
  bounce(): void {
    this.data.velocity.y = PLAYER_JUMP_FORCE * 0.6;
    this.data.isJumping = true;
  }

  reset(spawnX: number, spawnY: number): void {
    this.data.position = { x: spawnX * TILE_SIZE, y: spawnY * TILE_SIZE - this.data.height };
    this.data.velocity = { x: 0, y: 0 };
    this.data.isDead = false;
    this.data.deathTimer = 0;
    this.data.deathTimerMax = 0;
    this.data.isGrounded = false;
    this.data.isJumping = false;
    this.data.invincibleTimer = 0;
    this.data.hasHelmet = false;
    this.data.coffeeTimer = 0;
    this.data.coyoteTimer = 0;
    this.data.jumpBufferTimer = 0;
    this.data.facingRight = true;
  }
}
