// Game Principal - Super Feka Gaps

import {
  GameState, GAME_WIDTH, GAME_HEIGHT, TILE_SIZE,
  INITIAL_LIVES, COIN_SCORE, ENEMY_SCORE, TIME_BONUS_MULTIPLIER, TileType,
  GP_IMPACT_RADIUS_PX, GP_SHAKE_MS, GP_SHAKE_MAG,
  BLOCK_BREAK_SCORE, BOSS_DEFEAT_SCORE, COINS_PER_LIFE, LIVES_BONUS_SCORE,
  CULLING_MARGIN
} from '../constants';
import {
  CameraData, Vector2, FlagData, CollectibleData,
  CollectibleType, Particle, Firework, EnemyType, GroundPoundState, LevelData, CameraTrigger
} from '../types';
import { Input } from '../engine/Input';
import { Audio } from '../engine/Audio';
import { Renderer } from '../engine/Renderer';
import { ART } from '../graphics/palette';
import { sceneZoom } from '../graphics/pixels';
import { DEATH_HIT_STOP_MS } from '../graphics/playerDeathMotion';
import { AudioVoicePlayer } from '../voice/AudioVoicePlayer';
import { SpeechBubbleController } from '../voice/SpeechBubbleController';
import { VoiceDirector } from '../voice/VoiceDirector';
import { JOAOZAO_VOICE_MANIFEST } from '../voice/joaozaoVoiceManifest';
import { Level, createLevel } from '../world/Level';
import { supportsStanding } from '../world/tileRules';
import { normalizeLevelData } from '../world/levelValidation';
import { Player } from '../entities/Player';
import { Minion } from '../entities/enemies/Minion';
import { Joaozao } from '../entities/enemies/Joaozao';
import { getLevelByIndex, TOTAL_LEVELS } from '../data/levels/index';
import { ScoreManager } from './ScoreManager';
import { GlobalScoreboard } from './GlobalScoreboard';
import { TriggerController } from './TriggerController';
import { EditorController } from '../editor/EditorController';

export class Game {
  // Engine
  private input: Input;
  private audio: Audio;
  private renderer: Renderer;

  // Estado do jogo
  private state: GameState = GameState.BOOT;
  // Easter egg: modo Delícia
  private deliciaMode: boolean = false;

  // Gameplay
  private player: Player | null = null;
  private level: Level | null = null;
  private camera: CameraData;
  private minions: Minion[] = [];
  private boss: Joaozao | null = null;
  private bossVoice: VoiceDirector | null = null;
  private collectibles: CollectibleData[] = [];
  private flags: FlagData[] = [];
  private particles: Particle[] = [];

  // Fireworks
  private fireworks: Firework[] = [];
  private fireworkSpawnTimer: number = 0;

  // Progresso
  private currentLevelIndex: number = 0;
  private score: number = 0;
  private lives: number = INITIAL_LIVES;
  private levelTime: number = 0;
  private coins: number = 0;
  private highScore: number = 0;
  private newRecord: boolean = false;

  // Timers
  private bootTimer: number = 1500;
  private levelClearTimer: number = 3000;
  private gameOverTimer: number = 3000;
  private bossIntroTimer: number = 2000;
  private endingTimer: number = 0;
  private deathTimer: number = 0;
  private bossDeathPending: boolean = false;
  private bossDeathTimer: number = 0;
  private bossDeathToken: number = 0;
  private readonly bossDeathTimeoutMs: number = 2500;

  // Checkpoint ativo
  private activeCheckpoint: Vector2 | null = null;

  // Loop
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedDeltaTime: number = 1000 / 60; // 60 FPS

  // Run Stats
  private totalRunTime: number = 0;
  private bestTime: number = Infinity;
  private newTimeRecord: boolean = false;

  // Editor
  private editorController: EditorController | null = null;
  private triggerController = new TriggerController();
  private globalScoreboard = new GlobalScoreboard();

  constructor(canvas: HTMLCanvasElement) {
    this.input = new Input();
    this.audio = new Audio();
    this.renderer = new Renderer(); // Pass canvas to renderer

    this.camera = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      shakeTimer: 0,
      shakeMagnitude: 0,
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    };

    // Check Editor Mode
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('editor') === 'true') {
      this.state = GameState.EDITOR;
      this.editorController = new EditorController(canvas, this.renderer);
      this.editorController.init();
    } else {
      this.state = GameState.BOOT;
    }
  }

  start(): void {
    this.lastTime = performance.now();
    this.gameLoop();
  }

  private gameLoop = (): void => {
    const currentTime = performance.now();
    // Descarte tempo de abas ocultas e limite a recuperação após travamentos.
    const deltaTime = document.hidden ? 0 : Math.min(250, Math.max(0, currentTime - this.lastTime));
    this.lastTime = currentTime;

    // Fixed timestep para física
    this.accumulator += deltaTime;

    while (this.accumulator >= this.fixedDeltaTime) {
      this.update(this.fixedDeltaTime);
      this.accumulator -= this.fixedDeltaTime;
    }

    this.renderer.setFrameInterpolation(this.state === GameState.PLAYING ? this.accumulator : 0);
    this.render();

    requestAnimationFrame(this.gameLoop);
  };

  private update(deltaTime: number): void {
    this.input.setMenuMode([GameState.MENU, GameState.PAUSED, GameState.GAME_OVER, GameState.ENDING].includes(this.state));
    this.input.update();
    if (this.state !== GameState.PAUSED) this.renderer.advanceClock(deltaTime);

    // Toggle som
    if (this.input.consumeMute()) {
      this.audio.toggle();
    }

    // Konami: alterna Modo Delícia
    if (this.input.consumeKonami()) {
      this.toggleDeliciaMode();
    }

    switch (this.state) {
      case GameState.BOOT:
        this.updateBoot(deltaTime);
        break;
      case GameState.MENU:
        this.updateMenu();
        break;
      case GameState.PLAYING:
        this.updatePlaying(deltaTime);
        break;
      case GameState.PAUSED:
        this.updatePaused();
        break;
      case GameState.GAME_OVER:
        this.updateGameOver(deltaTime);
        break;
      case GameState.LEVEL_CLEAR:
        this.updateLevelClear(deltaTime);
        break;
      case GameState.BOSS_INTRO:
        this.updateBossIntro(deltaTime);
        break;
      case GameState.ENDING:
        this.updateEnding(deltaTime);
        break;
    }

    this.audio.updateMusic(deltaTime, {
      gameState: this.state,
      isBossLevel: this.level?.data.isBossLevel ?? false,
      isDead: this.player?.data.isDead ?? false,
      powerupActive: this.player ? this.player.data.miniFantaTimer > 0 : false,
      deliciaMode: this.deliciaMode
    });

    const bossAlive = this.boss ? !this.boss.data.isDead : false;
    this.bossVoice?.update(deltaTime, {
      allowAmbient: this.state === GameState.PLAYING && bossAlive
    });

    if (this.boss && this.boss.data.pendingDeath && !this.boss.data.isDead && !this.bossDeathPending) {
      this.queueBossDeath();
    }

    if (this.bossDeathPending) {
      this.bossDeathTimer -= deltaTime;
      if (this.bossDeathTimer <= 0) {
        this.finalizeBossDeath();
      }
    }

    const bossDying = this.boss ? this.boss.data.isDead : false;
    if (this.state === GameState.ENDING || (this.state === GameState.PLAYING && bossDying)) {
      this.updateFireworks(deltaTime);
    }
  }

  private updateBoot(deltaTime: number): void {
    this.bootTimer -= deltaTime;
    if (this.bootTimer <= 0) {
      this.changeState(GameState.MENU);
    }
  }

  private updateMenu(): void {
    if (this.input.consumeStart()) {
      this.audio.playMenuConfirm();
      this.startNewGame();
    }
  }

  private updatePlaying(deltaTime: number): void {
    if (!this.player || !this.level) return;

    // Pause
    if (this.input.consumePause()) {
      this.audio.playPause();
      this.changeState(GameState.PAUSED);
      return;
    }

    // Atualiza tiles dinâmicos (gaps temporários do boss)
    const dtSeconds = deltaTime / 1000;
    this.totalRunTime += dtSeconds;

    // Verifica se player está morto
    if (this.player.data.isDead) {
      this.player.advanceDeath(deltaTime);
      this.deathTimer = this.player.data.deathTimer;
      if (this.player.data.deathTimerMax - this.deathTimer >= DEATH_HIT_STOP_MS) {
        this.updateParticles(deltaTime);
        this.level.blockImpacts.update(deltaTime);
      }
      if (this.deathTimer <= 0) {
        this.handlePlayerDeath();
      }
      return;
    }
    if ((this.player.data.respawnRevealTimer ?? 0) > 0) {
      this.player.update(deltaTime, this.input.getState(), this.level);
      return;
    }
    this.level.updateDynamicTiles(deltaTime);
    this.level.clearFallingPlatformTouches();

    // A morte precisa terminar mesmo quando o cronômetro já chegou a zero.
    this.levelTime = Math.max(0, this.levelTime - dtSeconds);
    if (this.levelTime === 0) {
      this.playerDie();
      return;
    }

    // Atualiza player
    const playerResult = this.player.update(deltaTime, this.input.getState(), this.level);

    // Quedas detectadas pela física também passam pelo áudio e timer de morte do jogo.
    if (this.player.data.isDead) {
      this.playerDie();
      return;
    }

    // Processa início de Ground Pound
    if (playerResult && playerResult.groundPoundStarted) {
      this.audio.playGroundPoundStart();
    }

    // Processa impacto de Ground Pound
    if (playerResult && playerResult.groundPoundImpact) {
      this.handleGroundPoundImpact(playerResult.groundPoundImpact);
    }

    if (playerResult.landedTile && !playerResult.groundPoundImpact) {
      const feet = this.player.data.position;
      this.renderer.addImpact(feet.x + this.player.data.width / 2, feet.y + this.player.data.height,
        playerResult.landedTile.type === TileType.SPRING ? 'spring' : 'land');
    }

    // Processa tile hits resultantes de colisão com tiles (ex.: cabeçada)
    if (playerResult && playerResult.tileHit) {
      const th = playerResult.tileHit;
      if (th && th.side === 'top' && this.level) {
        // Cabeçada em tile (por baixo do bloco)
        // CONVERTER PARA ÍNDICES DE ARRAY (GRID LOCAL)
        const gridCol = th.col - this.level.originX;
        const gridRow = th.row - this.level.originY;

        const tileType = this.level.getTile(gridCol, gridRow);

        if (tileType === TileType.BRICK_BREAKABLE) {
          // Quebra o bloco
          this.level.breakTile(gridCol, gridRow);
          this.audio.playBlockBreak();
          this.score += BLOCK_BREAK_SCORE;
        } else if (tileType === TileType.BRICK) {
          if (this.player.data.hasHelmet) {
            this.level.breakTile(gridCol, gridRow, true);
            this.audio.playBlockBreak();
            this.score += BLOCK_BREAK_SCORE;
          } else {
            this.level.bumpTile(gridCol, gridRow);
            this.audio.playBlockBump();
          }
        } else if (tileType === TileType.HIDDEN_BLOCK) {
          this.level.setTile(gridCol, gridRow, TileType.BRICK);
          this.audio.playBlockBump();
        } else if (tileType === TileType.POWERUP_BLOCK_MINI_FANTA || tileType === TileType.POWERUP_BLOCK_HELMET) {
          // Troca por usado e spawna power-up
          const newTile = TileType.BLOCK_USED;
          this.level.setTile(gridCol, gridRow, newTile);
          const collectType = tileType === TileType.POWERUP_BLOCK_MINI_FANTA ? CollectibleType.MINI_FANTA : CollectibleType.HELMET;
          const spawnX = th.col * TILE_SIZE;
          const spawnY = th.row * TILE_SIZE - 16;
          this.collectibles.push({
            position: { x: spawnX, y: spawnY },
            velocity: { x: 0, y: -1 },
            width: 16,
            height: 16,
            active: true,
            type: collectType,
            collected: false,
            animationFrame: 0,
            animationTimer: 0
          });
          this.audio.playPowerup();
        }
      }
    }

    if (this.player.data.isGrounded) {
      const footX = this.player.data.position.x + this.player.data.width / 2;
      const footY = this.player.data.position.y + this.player.data.height + 1;
      const col = this.level.worldToCol(footX);
      const row = this.level.worldToRow(footY);
      if (this.level.getTile(col, row) === TileType.PLATFORM_FALLING) {
        this.level.markFallingPlatformContact(col, row);
      }
    }

    this.level.updateFallingPlatforms(deltaTime);

    // Spike damage uses the same pipeline as enemies/projectiles
    if (!this.player.data.isDead && this.level.checkSpikeCollision(this.player.getRect())) {
      this.playerHit();
    }

    if (!this.player.data.isDead && this.level.checkLavaCollision(this.player.getRect())) {
      this.playerDie();
      return;
    }

    // Aplica zonas antes da câmera para evitar um frame de atraso ao entrar e sair.
    this.updateTriggers(deltaTime);
    if (this.player.data.isDead) return;

    // Atualiza câmera
    this.updateCamera(deltaTime);

    // Atualiza inimigos minion
    for (const minion of this.minions) {
      minion.update(deltaTime, this.level!);
      this.checkMinionCollision(minion);
      if (this.player.data.isDead) return;
    }

    // Atualiza boss
    if (this.boss) {
      this.boss.update(
        deltaTime,
        this.level,
        this.player.data.position.x,
        this.player.data.position.y
      );
      this.checkBossCollision();

      // Processa smash do boss (se houver impacto pendente)
      const impact = this.boss ? this.boss.consumeImpact() : null;
      if (impact) {
        this.renderer.addImpact(impact.x, impact.y, 'boss');
        this.camera.shakeTimer = GP_SHAKE_MS;
        this.camera.shakeMagnitude = GP_SHAKE_MAG;
        this.spawnParticles(impact.x, impact.y, ART.paper, 15);
        this.audio.playGroundPoundImpact();
      }

      if (this.bossVoice && !this.boss.data.isDead && this.isBossVisible()) {
        this.bossVoice.onFirstSeen();
      }

      // Verifica se boss foi derrotado
      if (this.boss.isDefeated()) {
        this.onBossDefeated();
      }

      // Se o boss entrou no estado isDead (morreu agora), inicia fogos imediatamente
      if (this.boss.data.isDead && !this.fireworks.length) {
        // Spawn inicial mais intenso perto do boss
        const bx = this.boss.data.position.x + this.boss.data.width / 2;
        const by = this.boss.data.position.y;
        for (let i = 0; i < 8; i++) {
          const sx = bx + (Math.random() - 0.5) * 60;
          const ty = by - 40 - Math.random() * 40;
          this.spawnFirework(sx, ty);
        }
        // Garante spawn rápido em seguida
        this.fireworkSpawnTimer = 100;
      }
    }

    if (this.player.data.isDead) return;

    // Verifica coletáveis
    this.checkCollectibles(deltaTime);

    // Verifica bandeiras (checkpoint/final)
    this.checkFlags();

    // Atualiza animacao das bandeiras
    this.updateFlags(deltaTime);

    // Atualiza partículas
    this.updateParticles(deltaTime);

  }

  private updateTriggers(deltaTime: number): void {
    if (!this.level || !this.player) return;
    this.activeCameraOverride = this.triggerController.update(deltaTime, this.level.data, this.player.getRect(), {
      audio: (trigger) => this.audio.applyLevelTrigger(trigger.trackId, trigger.action),
      damage: (trigger) => {
        if (!this.player || this.player.data.isDead) return false;
        if (trigger.instantKill) {
          this.playerDie();
          return true;
        }
        if (trigger.damagePerTick <= 0 || this.player.data.invincibleTimer > 0) return false;
        this.playerHit();
        return true;
      }
    });
  }

  private activeCameraOverride: CameraTrigger | null = null;


  private updatePaused(): void {
    if (this.input.consumePause() || this.input.consumeStart()) {
      this.audio.playPause();
      this.changeState(GameState.PLAYING);
    }
  }

  private updateGameOver(deltaTime: number): void {
    this.gameOverTimer -= deltaTime;
    if (this.gameOverTimer <= 0 && this.input.consumeStart()) {
      this.changeState(GameState.MENU);
    }
  }

  private updateLevelClear(deltaTime: number): void {
    this.updateFlags(deltaTime);
    this.levelClearTimer -= deltaTime;
    if (this.levelClearTimer <= 0) {
      this.goToNextLevel();
    }
  }

  private updateBossIntro(deltaTime: number): void {
    this.bossIntroTimer -= deltaTime;
    if (this.bossIntroTimer <= 0) {
      this.changeState(GameState.PLAYING);
    }
  }

  private updateEnding(deltaTime: number): void {
    this.endingTimer += deltaTime;
    if (this.endingTimer > 5000 && !this.globalScoreboard.isOpen && this.input.consumeStart()) {
      this.changeState(GameState.MENU);
    }
  }

  private render(): void {
    if (this.state === GameState.EDITOR && this.editorController) {
      this.renderer.clear();
      this.editorController.render(this.renderer);
    } else {
      // Start scene with zoom applied
      this.renderer.startScene(this.camera.zoom || 1);

      switch (this.state) {
        case GameState.MENU:
          this.renderer.drawTitleScreen();
          break;

        case GameState.PLAYING:
        case GameState.GAME_OVER:
        case GameState.LEVEL_CLEAR:
        case GameState.PAUSED:
        case GameState.TRANSITION:
        case GameState.BOSS_INTRO:
        case GameState.ENDING:
          // Render World
          this.renderGame();

          // ... overlays ...
          if (this.state === GameState.PAUSED) {
            this.renderer.drawPauseOverlay();
          }
          else if (this.state === GameState.GAME_OVER) {
            // drawGameOver signature might vary, using what seemed to be there
            this.renderer.drawGameOver(
              this.score,
              this.highScore,
              false, // newRecord
              0, // totalRunTime (not tracked in this scope easily?)
              this.bestTime,
              this.newTimeRecord
            );
          }
          else if (this.state === GameState.LEVEL_CLEAR) {
            const timeBonus = Math.floor(this.levelTime) * 2; // Fixed multiplier
            this.renderer.drawLevelClear(
              this.level?.data.name || '',
              this.score,
              timeBonus
            );
          }
          else if (this.state === GameState.BOSS_INTRO) {
            this.renderer.drawBossIntro('JOÃOZÃO');
          }
          else if (this.state === GameState.ENDING) {
            this.renderEnding();
          }
          break;

        case GameState.BOOT:
          // Loading...
          this.renderBoot();
          break;
      }
    }
    if (this.state !== GameState.EDITOR) {
      this.renderer.present();
    }
  }


  private renderEnding(): void {
    this.renderer.drawEnding(
      this.fireworks,
      this.score,
      this.highScore,
      this.newRecord,
      this.totalRunTime,
      this.bestTime,
      this.newTimeRecord,
      this.endingTimer
    );
  }

  private renderBoot(): void {
    this.renderer.drawBoot(1500 - this.bootTimer);
  }

  private renderGame(): void {
    if (!this.level || !this.player) return;

    // Background (Fill the logical viewport which might be smaller/larger due to zoom)
    const zoom = sceneZoom(this.camera.zoom || 1);
    this.renderer.drawBackground(this.camera, undefined, GAME_WIDTH / zoom, GAME_HEIGHT / zoom);

    // Tiles (pass origin offset for proper world coordinate rendering)
    this.renderer.drawTiles(this.level.getModifiedTiles(), this.camera, this.level.originX, this.level.originY, this.level.blockImpacts);
    this.renderer.drawBlockImpacts(this.level, this.camera);
    this.renderer.drawFallingPlatforms(this.level.getFallingPlatformRenderData(), this.camera, this.level.originX, this.level.originY);

    // Fogos (se o boss está morto/morrendo)
    const bossDying = this.boss && this.boss.data.isDead;
    if (bossDying) {
      this.renderer.drawFireworks(this.fireworks, this.camera.x, this.camera.y);
    }

    // Flags (checkpoint / final)
    this.flags.forEach(flag => {
      this.renderer.drawFlag(flag, this.camera);
    });

    // Coletáveis (com Culling)
    this.collectibles.forEach(c => {
      // Simple culling
      if (c.position.x < this.camera.x - CULLING_MARGIN ||
        c.position.x > this.camera.x + GAME_WIDTH + CULLING_MARGIN) {
        return;
      }
      this.renderer.drawCollectible(c, this.camera);
    });

    // Inimigos
    this.minions.forEach(minion => {
      this.renderer.drawEnemy(minion.data, this.camera);
    });

    // Boss
    if (this.boss) {
      this.renderer.drawEnemy(this.boss.data, this.camera);

      // Projéteis do boss
      this.boss.projectiles.forEach(p => {
        if (p.active) {
          this.renderer.drawProjectile(
            p.position.x - this.camera.x,
            p.position.y - this.camera.y
          );
        }
      });
    }


    const bubbleState = this.bossVoice?.getBubbleRenderState();
    if (bubbleState) {
      this.renderer.drawSpeechBubble(bubbleState, this.camera);
    }
    const dialogState = this.triggerController.getDialogRenderState();
    if (dialogState && this.state === GameState.PLAYING) {
      this.renderer.drawSpeechBubble(dialogState, this.camera);
    }

    // Player
    this.renderer.drawPlayer(this.player.data, this.camera);

    // Partículas
    const particlesToDraw = this.particles.map(p => ({
      ...p,
      position: {
        x: p.position.x - this.camera.x,
        y: p.position.y - this.camera.y
      }
    }));
    this.renderer.drawParticles(particlesToDraw);
    this.renderer.drawWorldEffects(this.camera);
    this.renderer.drawOrangeRain(this.deliciaMode);

    // HUD
    this.renderer.drawHUD(
      this.score,
      this.lives,
      this.levelTime,
      this.level.data.name,
      this.audio.isEnabled(),
      this.player.data.hasHelmet,
      this.player.data.miniFantaTimer,
      this.coins,
      this.boss && !this.boss.data.isDead ? this.boss.getHealth() : undefined
    );

    // Touch controls
    this.renderer.drawTouchControls();
    this.renderer.drawPlayerTransition(this.player.data, this.camera);
  }

  private changeState(newState: GameState): void {
    const prevState = this.state;
    if (prevState === GameState.ENDING && newState !== GameState.ENDING) this.globalScoreboard.hide();
    this.state = newState;
    this.audio.onStateChange(prevState, newState, {
      levelId: this.level?.data.id ?? null,
      isBossLevel: this.level?.data.isBossLevel ?? false,
      playerAlive: this.player ? !this.player.data.isDead : true,
      powerupActive: this.player ? this.player.data.miniFantaTimer > 0 : false,
      gameState: newState,
      deliciaMode: this.deliciaMode
    });
  }

  private startNewGame(): void {
    this.globalScoreboard.hide();
    this.currentLevelIndex = 0;
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.coins = 0;
    this.totalRunTime = 0;
    this.loadLevel(0);
    this.highScore = ScoreManager.getHighScore();
    this.bestTime = ScoreManager.getBestTime();
    this.newRecord = false;
    this.newTimeRecord = false;
  }

  private loadLevel(index: number): void {
    const rawLevelDataOriginal = getLevelByIndex(index);
    if (!rawLevelDataOriginal) {
      // Fim do jogo!
      this.onGameComplete();
      return;
    }

    const levelData = normalizeLevelData(rawLevelDataOriginal);


    this.level = createLevel(levelData);
    this.player = new Player(levelData.playerSpawn.x, levelData.playerSpawn.y);
    this.levelTime = levelData.timeLimit;
    this.activeCheckpoint = null;

    // Configura câmera
    const bounds = this.level.getBounds();
    this.camera.bounds = bounds;
    this.camera.x = 0;
    this.camera.y = 0;
    this.camera.zoom = 1;
    this.camera.targetX = 0;
    this.camera.targetY = 0;
    this.activeCameraOverride = null;

    // Snap camera to start position immediately to avoid weird initial pan
    // Center on player spawn
    // We can't use detailed centering logic easily here without duplicating code, 
    // but setting it roughly near player is better than 0,0.
    // Let's just trust updateCamera will fix it quickly, but x=0 is definitely bad if not at 0.
    // Better to let updateCamera handle it, but definitely reset ZOOM.

    // Configura Background Procedural
    this.renderer.prepareLevelBackground(levelData.theme);

    // Carrega inimigos
    this.minions = [];
    this.boss = null;
    this.bossVoice?.stop();
    this.bossVoice = null;

    this.bossDeathPending = false;
    this.bossDeathTimer = 0;

    levelData.enemies.forEach(enemy => {
      if (enemy.type === EnemyType.MINION) {
        this.minions.push(new Minion(enemy.position.x, enemy.position.y));
      } else if (enemy.type === EnemyType.JOAOZAO) {
        this.boss = new Joaozao(enemy.position.x, enemy.position.y);
      }
    });

    if (this.boss) {
      const voicePlayer = new AudioVoicePlayer(this.audio.getAudioEngine(), {}, {
        durationWarningThresholdSec: JOAOZAO_VOICE_MANIFEST.config.durationWarningThresholdSec
      });
      const bubble = new SpeechBubbleController({
        fadeOutMs: 120,
        offset: { x: 0, y: -15 }
      });
      this.bossVoice = new VoiceDirector(
        JOAOZAO_VOICE_MANIFEST,
        voicePlayer,
        bubble,
        () => this.getBossBubbleAnchor()
      );
    }

    // Carrega coletáveis
    this.collectibles = levelData.collectibles.map(c => ({
      position: { x: c.position.x * TILE_SIZE, y: c.position.y * TILE_SIZE },
      velocity: { x: 0, y: 0 },
      width: 16,
      height: 16,
      active: true,
      type: c.type,
      collected: false,
      animationFrame: 0,
      animationTimer: Math.random() * 660
    }));

    // Carrega bandeiras (checkpoint e final)
    this.flags = this.buildFlags(levelData);

    // Partículas
    this.particles = [];

    // Intro do boss se for fase de boss
    if (levelData.isBossLevel && this.boss) {
      this.bossIntroTimer = 2000;
      this.changeState(GameState.BOSS_INTRO);
    } else {
      this.changeState(GameState.PLAYING);
    }
  }

  private toggleDeliciaMode(): void {
    this.deliciaMode = !this.deliciaMode;
    console.log(`Modo Delicia: ${this.deliciaMode}`);
    this.audio.playDeliciaSfx();
    this.input.reset();

    this.bootTimer = 1500;
    this.levelClearTimer = 3000;
    this.gameOverTimer = 3000;
    this.bossIntroTimer = 2000;
    this.endingTimer = 0;
    this.deathTimer = 0;
    this.fireworkSpawnTimer = 0;

    this.currentLevelIndex = 0;
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.coins = 0;
    this.levelTime = 0;
    this.activeCheckpoint = null;

    this.player = null;
    this.level = null;
    this.minions = [];
    this.bossVoice?.stop();
    this.bossVoice = null;
    this.boss = null;
    this.collectibles = [];
    this.flags = [];
    this.particles = [];
    this.fireworks = [];

    this.camera.x = 0;
    this.camera.y = 0;
    this.camera.targetX = 0;
    this.camera.targetY = 0;
    this.camera.shakeTimer = 0;
    this.camera.shakeMagnitude = 0;

    this.bossDeathPending = false;
    this.bossDeathTimer = 0;

    // Reinicia para tela de abertura/menu
    this.changeState(GameState.BOOT);
  }

  private queueBossDeath(): void {
    if (!this.boss || this.boss.data.isDead) return;
    if (this.bossDeathPending) return;
    this.bossDeathPending = true;
    this.bossDeathTimer = this.bossDeathTimeoutMs;
    const token = ++this.bossDeathToken;
    this.boss.projectiles = [];

    if (this.bossVoice) {
      this.bossVoice.playLineAndWait('para_de_encher_o_saco').then(() => {
        if (token !== this.bossDeathToken || !this.bossDeathPending) return;
        this.finalizeBossDeath();
      });
      return;
    }

    this.finalizeBossDeath();
  }

  private finalizeBossDeath(): void {
    this.bossDeathPending = false;
    this.bossDeathTimer = 0;
    if (!this.boss || this.boss.data.isDead) return;
    this.boss.projectiles = [];
    this.boss.die();
  }

  private buildFlags(levelData: LevelData): FlagData[] {
    const flags: FlagData[] = [];
    let nextId = 0;

    levelData.checkpoints.forEach(cp => {
      const worldCol = Math.floor(cp.x);
      const worldRow = Math.floor(cp.y);

      // Converte Mundo -> Grid para acessar tiles
      const originX = levelData.originX ?? 0;
      const originY = levelData.originY ?? 0;
      const gridCol = worldCol - originX;
      const gridRow = worldRow - originY;

      // Busca colisão no grid
      const surfaceGridRow = this.findSurfaceRow(levelData.tiles, gridCol, gridRow) ?? gridRow;
      const resolvedGridRow = this.clampRow(surfaceGridRow, levelData.tiles.length);

      // Converte Grid -> Mundo para posicionar a entidade
      const resolvedWorldRow = resolvedGridRow + originY;
      const resolvedWorldCol = gridCol + originX; // = worldCol

      const anchor = {
        x: resolvedWorldCol * TILE_SIZE + Math.floor(TILE_SIZE / 2),
        y: resolvedWorldRow * TILE_SIZE
      };

      const triggerTop = Math.max(0, (resolvedWorldRow - 1) * TILE_SIZE);
      flags.push({
        id: nextId++,
        kind: 'checkpoint',
        anchor,
        trigger: {
          x: resolvedWorldCol * TILE_SIZE + 2,
          y: triggerTop,
          width: TILE_SIZE - 4,
          height: TILE_SIZE
        },
        state: 'inactive',
        stateTimer: 0,
        enabled: true
      });
    });

    if (levelData.goalPosition) {
      const worldCol = Math.floor(levelData.goalPosition.x);
      const worldRow = Math.floor(levelData.goalPosition.y);

      // Converte Mundo -> Grid
      const originX = levelData.originX ?? 0;
      const originY = levelData.originY ?? 0;
      const gridCol = worldCol - originX;
      const gridRow = worldRow - originY;

      const surfaceGridRow = this.findSurfaceRow(levelData.tiles, gridCol, gridRow) ?? gridRow;
      const resolvedGridRow = this.clampRow(surfaceGridRow, levelData.tiles.length);

      // Converte Grid -> Mundo
      const resolvedWorldRow = resolvedGridRow + originY;
      const resolvedWorldCol = gridCol + originX;

      const anchor = {
        x: resolvedWorldCol * TILE_SIZE + Math.floor(TILE_SIZE / 2),
        y: resolvedWorldRow * TILE_SIZE
      };
      const triggerTop = Math.max(0, (resolvedWorldRow - 2) * TILE_SIZE);
      flags.push({
        id: nextId++,
        kind: 'goal',
        anchor,
        trigger: {
          x: resolvedWorldCol * TILE_SIZE,
          y: triggerTop,
          width: TILE_SIZE,
          height: TILE_SIZE * 2
        },
        state: 'inactive',
        stateTimer: 0,
        enabled: !levelData.isBossLevel
      });
    }

    return flags;
  }

  private findSurfaceRow(tiles: number[][], col: number, startRow: number): number | null {
    const maxRow = tiles.length - 1;
    const start = Math.max(0, Math.min(startRow, maxRow));
    for (let row = start; row <= maxRow; row++) {
      const tile = tiles[row]?.[col];
      if (tile === undefined) continue;
      if (this.isSurfaceTile(tile)) return row;
    }
    return null;
  }

  private clampRow(row: number, rowCount: number): number {
    if (rowCount <= 0) return 0;
    return Math.max(0, Math.min(row, rowCount - 1));
  }

  private updateCamera(deltaTime: number): void {
    if (!this.player) return;

    const zoom = this.camera.zoom || 1;
    const viewWidth = GAME_WIDTH / zoom;
    const viewHeight = GAME_HEIGHT / zoom;

    const playerCenter = this.player.getCenter();

    // 1. Target da câmera é o player (default)
    let targetX = playerCenter.x - viewWidth / 2;
    let targetY = playerCenter.y - viewHeight / 2;
    let targetZoom = 1;

    // 2. Aplica Overrides (Triggers)
    if (this.activeCameraOverride) {
      if (this.activeCameraOverride.lockX) {
        // Lock X: Centraliza no trigger
        const triggerCenter = this.activeCameraOverride.x + this.activeCameraOverride.width / 2;
        targetX = triggerCenter - viewWidth / 2;
      }
      if (this.activeCameraOverride.lockY) {
        // Lock Y: Centraliza no trigger
        const triggerCenter = this.activeCameraOverride.y + this.activeCameraOverride.height / 2;
        targetY = triggerCenter - viewHeight / 2;
      }
      if (this.activeCameraOverride.zoom) {
        targetZoom = sceneZoom(this.activeCameraOverride.zoom);
      }
    }

    // 3. Suavização (lerp)
    this.camera.targetX = targetX;
    this.camera.targetY = targetY;

    this.camera.x += (this.camera.targetX - this.camera.x) * 0.1;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.1;

    // Zoom Lerp
    if (this.camera.zoom === undefined) this.camera.zoom = 1;
    this.camera.zoom += (targetZoom - this.camera.zoom) * 0.05;

    // Recalculate view size with new smoothed zoom for clamping
    const finalZoom = this.camera.zoom;
    const finalViewW = GAME_WIDTH / finalZoom;
    const finalViewH = GAME_HEIGHT / finalZoom;

    // 4. Limita aos bounds do nível
    this.camera.x = Math.max(this.camera.bounds.minX,
      Math.min(this.camera.x, this.camera.bounds.maxX - finalViewW));
    this.camera.y = Math.max(this.camera.bounds.minY,
      Math.min(this.camera.y, this.camera.bounds.maxY - finalViewH));

    // 5. Aplica shake
    if (this.camera.shakeTimer > 0) {
      this.camera.shakeTimer -= deltaTime;
      this.camera.x += (Math.random() - 0.5) * this.camera.shakeMagnitude;
      this.camera.y += (Math.random() - 0.5) * this.camera.shakeMagnitude;
    }
  }

  private getBossBubbleAnchor(): Vector2 {
    if (!this.boss) {
      return { x: 0, y: 0 };
    }
    return {
      x: this.boss.data.position.x + this.boss.data.width / 2,
      y: this.boss.data.position.y - 15
    };
  }

  private isBossVisible(): boolean {
    if (!this.boss) return false;
    const left = this.boss.data.position.x;
    const right = left + this.boss.data.width;
    const top = this.boss.data.position.y;
    const bottom = top + this.boss.data.height;
    return right >= this.camera.x &&
      left <= this.camera.x + GAME_WIDTH &&
      bottom >= this.camera.y &&
      top <= this.camera.y + GAME_HEIGHT;
  }

  private checkMinionCollision(minion: Minion): void {
    if (!this.player || this.player.data.isDead) return;

    const playerRect = this.player.getRect();
    const prevRect = this.player.getPrevRectForContacts();
    const prevVelocity = this.player.getPrevVelocityForContacts();
    const prevGp = this.player.getPrevGroundPoundStateForContacts();
    const collision = minion.checkPlayerCollision(playerRect, prevRect);

    if (collision.hit) {
      if (collision.fromAbove) {
        if (prevGp === GroundPoundState.NONE && prevVelocity.y > 0) {
          // Stomp normal
          minion.stomp();
          this.player.bounce();
          this.audio.playStomp();
          this.score += ENEMY_SCORE;
          this.spawnParticles(
            minion.data.position.x + minion.data.width / 2,
            minion.data.position.y,
            ART.redLight,
            5
          );
        } else if (this.player.isGroundPoundFalling() || prevGp === GroundPoundState.FALL) {
          // Include the first WINDUP -> FALL step and the landing FALL -> RECOVERY step.
          // Ground pound em cima do minion: mata sem bounce
          minion.stomp();
          this.audio.playStomp();
          this.score += ENEMY_SCORE;
          // Evita isJumping preso
          this.player.data.isJumping = false;
          this.spawnParticles(
            minion.data.position.x + minion.data.width / 2,
            minion.data.position.y,
            ART.redLight,
            8
          );
        } else {
          this.playerHit('other', minion.data.position.x + minion.data.width / 2);
        }
      } else {
        this.playerHit('other', minion.data.position.x + minion.data.width / 2);
      }
    }
  }

  private checkBossCollision(): void {
    if (!this.player || !this.boss || this.player.data.isDead) return;
    if (this.boss.data.pendingDeath || this.bossDeathPending || this.boss.data.isDead) return;

    // Boss collision
    const playerRect = this.player.getRect();
    const prevRect = this.player.getPrevRectForContacts();
    const prevVelocity = this.player.getPrevVelocityForContacts();
    const prevGp = this.player.getPrevGroundPoundStateForContacts();
    const collision = this.boss.checkPlayerCollision(playerRect, prevRect);

    if (!collision.hit) {
      // Projectile collision
      if (this.boss.checkProjectileCollision(this.player.getRect())) {
        this.playerHit('boss');
      }
      return;
    }

    const gpFalling = this.player.isGroundPoundFalling() || prevGp === GroundPoundState.FALL;
    const stompNormal = prevGp === GroundPoundState.NONE && prevVelocity.y > 0;
    const canDamageBoss = collision.fromAbove && (stompNormal || gpFalling);

    if (canDamageBoss) {
      const damageResult = this.boss.takeDamage();
      if (damageResult.damaged) {
        this.audio.playBossHit();
        this.score += ENEMY_SCORE;
        // If not the killing blow, play normal hit react; otherwise play the death line explicitly
        if (!damageResult.defeated) {
          this.bossVoice?.onDamaged();
        }
      }

      if (damageResult.defeated) {
        this.score += BOSS_DEFEAT_SCORE;
        this.queueBossDeath();
      }

      const bossRect = this.boss.getRect();
      this.player.data.position.y = bossRect.y - this.player.data.height - 1;

      if (gpFalling) {
        this.player.data.velocity.y = -4;
        this.player.data.groundPoundState = GroundPoundState.RECOVERY;
        this.player.data.groundPoundTimer = 150;
        this.player.data.isJumping = false;
      } else {
        this.player.bounce();
      }

      this.player.data.invincibleTimer = Math.max(this.player.data.invincibleTimer, 300);
      return;
    }

    if (this.player.data.invincibleTimer <= 0) {
      this.playerHit('boss', this.boss.getRect().x + this.boss.data.width / 2);
    }
  }

  private checkCollectibles(deltaTime: number): void {
    if (!this.player) return;

    const playerRect = this.player.getRect();

    this.collectibles.forEach(c => {
      if (c.collected || !c.active) return;

      // Atualiza animação
      c.animationTimer += deltaTime;

      // Culling de lógica
      if (c.position.x < this.camera.x - CULLING_MARGIN ||
        c.position.x > this.camera.x + GAME_WIDTH + CULLING_MARGIN) {
        return;
      }

      // AABB collision
      const hit = c.position.x < playerRect.x + playerRect.width &&
        c.position.x + c.width > playerRect.x &&
        c.position.y < playerRect.y + playerRect.height &&
        c.position.y + c.height > playerRect.y;

      if (hit) {
        c.collected = true;

        switch (c.type) {
          case CollectibleType.COIN:
            this.score += COIN_SCORE;
            this.coins++;
            if (this.coins >= COINS_PER_LIFE) {
              this.coins -= COINS_PER_LIFE;
              this.lives++;
              this.audio.playOneUp();
            }
            this.audio.playCoin();
            this.spawnCoinEffect(
              c.position.x + c.width / 2,
              c.position.y + c.height / 2
            );
            break;

          case CollectibleType.MINI_FANTA:
            if (this.player) {
              this.player.collectMiniFanta();
            }
            this.audio.playPowerup();
            break;

          case CollectibleType.HELMET:
            if (this.player) {
              this.player.collectHelmet();
            }
            this.audio.playPowerup();
            break;
        }
      }
    });
  }

  private checkFlags(): void {
    if (!this.player) return;

    const playerRect = this.player.getRect();

    this.flags.forEach(flag => {
      if (!flag.enabled) return;

      const hit = flag.trigger.x < playerRect.x + playerRect.width &&
        flag.trigger.x + flag.trigger.width > playerRect.x &&
        flag.trigger.y < playerRect.y + playerRect.height &&
        flag.trigger.y + flag.trigger.height > playerRect.y;

      if (!hit) return;

      if (flag.kind === 'checkpoint') {
        if (flag.state !== 'inactive') return;
        flag.state = 'activating';
        flag.stateTimer = 0;
        this.activeCheckpoint = {
          x: Math.floor(flag.anchor.x / TILE_SIZE),
          y: Math.floor(flag.anchor.y / TILE_SIZE)
        };
        this.camera.shakeTimer = 80;
        this.camera.shakeMagnitude = 1;
        this.spawnParticles(flag.anchor.x, flag.anchor.y - 6, ART.tealLight, 8);
        this.audio.playCheckpoint();
        return;
      }

      if (flag.kind === 'goal' && flag.state !== 'clear') {
        this.onLevelComplete(flag);
      }
    });
  }

  private updateFlags(deltaTime: number): void {
    this.flags.forEach(flag => {
      if (!flag.enabled) return;
      flag.stateTimer += deltaTime;

      if (flag.state === 'activating' && flag.stateTimer >= 450) {
        flag.state = 'active';
        flag.stateTimer = 0;
      }
    });
  }

  private handleGroundPoundImpact(impact: { x: number, y: number, col: number, row: number }): void {
    this.renderer.addImpact(impact.x, impact.y, 'pound');
    if (!this.level || !this.player) return;

    // 1. Efeitos de câmera e som
    this.camera.shakeTimer = GP_SHAKE_MS;
    this.camera.shakeMagnitude = GP_SHAKE_MAG;
    this.audio.playGroundPoundImpact();

    // 2. Quebra de tiles (abaixo e pros lados)
    const hasHelmet = this.player.data.hasHelmet;
    for (let dc = -1; dc <= 1; dc++) {
      const targetCol = impact.col + dc;
      const targetRow = impact.row;
      // Convert to grid coordinates
      const gridCol = targetCol - this.level.originX;
      const gridRow = targetRow - this.level.originY;

      const tileBelow = this.level.getTile(gridCol, gridRow);

      if (tileBelow === TileType.POWERUP_BLOCK_HELMET || tileBelow === TileType.POWERUP_BLOCK_MINI_FANTA) {
        // Ativa bloco de powerup com a sentada
        this.level.setTile(gridCol, gridRow, TileType.BLOCK_USED);
        const collectType = tileBelow === TileType.POWERUP_BLOCK_MINI_FANTA ? CollectibleType.MINI_FANTA : CollectibleType.HELMET;

        // Spawn do item (pop up)
        const spawnX = targetCol * TILE_SIZE;
        const spawnY = targetRow * TILE_SIZE - 16;
        this.collectibles.push({
          position: { x: spawnX, y: spawnY },
          velocity: { x: 0, y: -2 },
          width: 16,
          height: 16,
          active: true,
          type: collectType,
          collected: false,
          animationFrame: 0,
          animationTimer: 0
        });

        this.audio.playPowerup();
        this.spawnParticles(
          targetCol * TILE_SIZE + TILE_SIZE / 2,
          targetRow * TILE_SIZE + TILE_SIZE / 2,
          ART.goldLight,
          8
        );
      } else {
        const res = this.level.breakTile(gridCol, gridRow, hasHelmet, 'down');
        if (res.success) {
          this.score += BLOCK_BREAK_SCORE;
        }
      }
    }

    // 3. Dano em inimigos (minions)
    this.minions.forEach(minion => {
      if (minion.data.isDead) return;

      const dx = minion.data.position.x + minion.data.width / 2 - impact.x;
      const dy = minion.data.position.y + minion.data.height / 2 - impact.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < GP_IMPACT_RADIUS_PX && Math.abs(dy) < TILE_SIZE * 2) {
        minion.stomp(); // Ground pound mata minion
        this.score += ENEMY_SCORE;
        this.spawnParticles(
          minion.data.position.x + minion.data.width / 2,
          minion.data.position.y + minion.data.height / 2,
          ART.redLight,
          10
        );
      }
    });

    // 4. Dano no boss
    if (this.boss && !this.boss.isDefeated()) {
      const dx = this.boss.data.position.x + this.boss.data.width / 2 - impact.x;
      const dy = this.boss.data.position.y + this.boss.data.height / 2 - impact.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < GP_IMPACT_RADIUS_PX * 1.5 && Math.abs(dy) < TILE_SIZE * 3) {
        // Ground pound no boss dá dano se ele estiver vulnerável ou se player tiver capacete
        // Para simplificar, vamos dar dano normal mas com feedback visual
        const damageResult = this.boss.takeDamage();
        if (damageResult.damaged) {
          this.audio.playBossHit();
          this.score += ENEMY_SCORE;
          this.bossVoice?.onDamaged();
        }
        if (damageResult.defeated) {
          this.score += BOSS_DEFEAT_SCORE;
          this.queueBossDeath();
        }

        this.spawnParticles(impact.x, impact.y, ART.paper, 15);
      }
    }

    // 5. Partículas de poeira laterais
    for (let i = 0; i < 10; i++) {
      this.particles.push({
        position: { x: impact.x, y: impact.y },
        velocity: {
          x: (Math.random() - 0.5) * 10,
          y: (Math.random() - 1) * 2
        },
        life: 400,
        maxLife: 400,
        color: ART.paper,
        size: 1 + Math.random() * 2
      });
    }
  }

  private playerHit(source: 'boss' | 'other' = 'other', sourceX?: number): void {
    if (!this.player || this.player.data.invincibleTimer > 0) return;

    const damageResult = this.player.takeDamage();

    if (damageResult.helmetUsed) {
      const center = this.player.getCenter();
      this.spawnParticles(center.x, center.y - 6, ART.goldLight, 8);
      this.audio.playHelmetBreak();
    }

    if (damageResult.damaged) {
      this.audio.playDamage();
      this.playerDie(source, sourceX);
    }
  }

  private playerDie(cause: 'boss' | 'other' = 'other', sourceX?: number): void {
    if (!this.player || (this.player.data.isDead && this.deathTimer > 0)) return;

    if (!this.player.data.isDead) this.player.die('hit', sourceX);
    if (this.player.data.deathKind === 'fall') this.audio.playFall();
    else this.audio.playDeath();
    this.audio.onPlayerDeathStart();
    this.deathTimer = this.player.data.deathTimer;

    if (cause === 'boss') {
      this.triggerBossKillTaunt();
    }
  }

  private triggerBossKillTaunt(): void {
    if (!this.boss || !this.bossVoice) return;
    if (this.boss.data.isDead || this.boss.data.pendingDeath || this.bossDeathPending) return;
    void this.bossVoice.playLineSequenceAndWait(['sei_que_voce_quer', 'voce_nao_vai_ter']);
  }

  private handlePlayerDeath(): void {
    this.lives--;

    if (this.lives <= 0) {
      this.audio.playGameOver();
      this.gameOverTimer = 3000;
      this.newRecord = ScoreManager.saveHighScore(this.score);
      this.highScore = ScoreManager.getHighScore();
      this.changeState(GameState.GAME_OVER);
    } else {
      // Respawn no checkpoint ou início
      if (!this.player || !this.level) return;

      const spawnPos = this.activeCheckpoint || this.level.data.playerSpawn;
      this.player.respawn(spawnPos);
      this.level.blockImpacts.clear();
      this.activeCameraOverride = null;
      // The opening iris must reveal the checkpoint, even when it is far from the death camera.
      if (this.camera) {
        const zoom = sceneZoom(this.camera.zoom || 1);
        const center = this.player.getCenter();
        this.camera.x = Math.max(this.camera.bounds.minX,
          Math.min(center.x - GAME_WIDTH / zoom / 2, this.camera.bounds.maxX - GAME_WIDTH / zoom));
        this.camera.y = Math.max(this.camera.bounds.minY,
          Math.min(center.y - GAME_HEIGHT / zoom / 2, this.camera.bounds.maxY - GAME_HEIGHT / zoom));
        this.camera.targetX = this.camera.x;
        this.camera.targetY = this.camera.y;
        this.camera.shakeTimer = 0;
      }
      // Preserve o tempo restante; após timeout, uma nova vida precisa de tempo para jogar.
      if (this.levelTime <= 0) this.levelTime = this.level.data.timeLimit;
      this.deathTimer = 0;
      this.audio.onRespawn();
    }
  }

  private onLevelComplete(flag?: FlagData): void {
    // Calcula bonus de tempo
    const timeBonus = Math.floor(this.levelTime) * TIME_BONUS_MULTIPLIER;
    this.score += timeBonus;

    if (flag) {
      flag.enabled = true;
      flag.state = 'clear';
      flag.stateTimer = 0;
    }

    this.audio.playLevelClear();
    this.levelClearTimer = 3000;
    this.changeState(GameState.LEVEL_CLEAR);
  }

  private goToNextLevel(): void {
    this.currentLevelIndex++;

    if (this.currentLevelIndex >= TOTAL_LEVELS) {
      this.onGameComplete();
    } else {
      this.loadLevel(this.currentLevelIndex);
    }
  }

  private onBossDefeated(): void {
    this.bossVoice?.stop();
    // Boss derrotado, pode ir para o final
    const goalFlag = this.flags.find(flag => flag.kind === 'goal') || undefined;
    this.onLevelComplete(goalFlag);
  }

  private onGameComplete(): void {
    this.audio.playVictory();

    // Bonus por vidas restantes
    const livesBonus = this.lives * LIVES_BONUS_SCORE;
    if (livesBonus > 0) {
      console.log(`Bonus de vidas: ${this.lives} x ${LIVES_BONUS_SCORE} = ${livesBonus}`);
      this.score += livesBonus;
    }

    this.endingTimer = 0;
    this.newRecord = ScoreManager.saveHighScore(this.score);
    this.highScore = ScoreManager.getHighScore();

    this.newTimeRecord = ScoreManager.saveBestTime(this.totalRunTime);
    this.bestTime = ScoreManager.getBestTime();

    this.changeState(GameState.ENDING);
    this.globalScoreboard.showEnding(this.score, Math.round(this.totalRunTime * 1000), this.newRecord);

    // Spawn initial burst of fireworks for ending screen
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.spawnFirework(), i * 150);
    }
    this.fireworkSpawnTimer = 300; // Quick respawn
  }

  private isSurfaceTile(tile: number): boolean {
    return supportsStanding(tile);
  }

  private spawnParticles(x: number, y: number, color: string, count: number): void {
    for (let i = 0; i < count; i++) {
      this.particles.push({
        position: { x, y },
        velocity: {
          x: (Math.random() - 0.5) * 4,
          y: (Math.random() - 1) * 3
        },
        life: 500,
        maxLife: 500,
        color,
        size: 2 + Math.random() * 2
      });
    }
  }

  private spawnCoinEffect(x: number, y: number): void {
    // 8 partículas em explosão radial
    for (let i = 0; i < 8; i++) {
      const angle = (Math.PI * 2 * i) / 8;
      const speed = 1.5 + Math.random() * 1.5;
      this.particles.push({
        position: { x, y },
        velocity: {
          x: Math.cos(angle) * speed,
          y: Math.sin(angle) * speed
        },
        life: 300 + Math.random() * 200,
        maxLife: 500,
        color: i % 2 === 0 ? ART.goldLight : ART.paper, // Intercala Ouro e Branco
        size: i % 2 === 0 ? 3 : 2, // Tamanhos variados
        gravity: 0, // Flutua!
        friction: 0.92 // Desacelera "mágicamente"
      });
    }
  }

  private updateParticles(deltaTime: number): void {
    this.particles = this.particles.filter(p => {
      p.position.x += p.velocity.x;
      p.position.y += p.velocity.y;

      // Física customizável
      const gravity = p.gravity !== undefined ? p.gravity : 0.1;
      p.velocity.y += gravity;

      const friction = p.friction !== undefined ? p.friction : 1.0;
      p.velocity.x *= friction;
      p.velocity.y *= friction;

      p.life -= deltaTime;
      return p.life > 0;
    });
  }

  // === FOGOS ===
  private updateFireworks(deltaTime: number): void {
    // 1. Spawn aleatório (mais intenso após a morte do boss)
    this.fireworkSpawnTimer -= deltaTime;
    if (this.fireworkSpawnTimer <= 0) {
      this.spawnFirework();
      // Se estamos na tela de final, spawn um pouco mais rápido
      const base = this.state === GameState.ENDING ? 350 : 600;
      this.fireworkSpawnTimer = base + Math.random() * (this.state === GameState.ENDING ? 800 : 600); // ms
    }

    // 2. Atualizar física
    this.fireworks.forEach(fw => {
      if (fw.phase === 'ROCKET') {
        fw.y += fw.velocity.y;
        // Gravidade leve
        fw.velocity.y += 0.05;

        // Explode se atingir target ou começar a cair
        if (fw.y <= fw.targetY || fw.velocity.y >= 0) {
          this.explodeFirework(fw);
        }
      } else if (fw.phase === 'EXPLODED') {
        // Optimize: only update living particles
        fw.particles.forEach(p => {
          if (p.life <= 0) return; // Skip dead particles
          p.position.x += p.velocity.x;
          p.position.y += p.velocity.y;
          p.velocity.y += 0.05; // gravidade
          p.velocity.x *= 0.96; // resistência do ar
          p.life -= deltaTime;
        });
      }
    });

    // 3. Limpeza
    this.fireworks = this.fireworks.filter(fw => {
      if (fw.phase === 'ROCKET') return true;
      return fw.particles.some(p => p.life > 0);
    });
  }

  private spawnFirework(spawnX?: number, targetY?: number): void {
    let sx: number;
    let ty: number;

    if (typeof spawnX === 'number') {
      sx = spawnX;
    } else if (this.state === GameState.ENDING) {
      sx = Math.random() * GAME_WIDTH;
    } else {
      sx = this.camera.x + Math.random() * GAME_WIDTH;
    }

    if (typeof targetY === 'number') {
      ty = targetY;
    } else if (this.state === GameState.ENDING) {
      ty = 20 + Math.random() * (GAME_HEIGHT / 2);
    } else {
      ty = this.camera.y + 20 + Math.random() * 60;
    }

    const colors = [ART.goldLight, ART.tealLight, ART.redLight, ART.purpleLight];
    const color = colors[Math.floor(Math.random() * colors.length)];

    // Durante PLAYING, spawn do chão visível (bottom of screen)
    const startY = this.state === GameState.ENDING
      ? GAME_HEIGHT
      : this.camera.y + GAME_HEIGHT - 10; // Spawn na borda inferior da tela

    const fw: Firework = {
      id: Math.random(),
      phase: 'ROCKET',
      x: sx,
      y: startY,
      targetY: ty,
      velocity: { x: (Math.random() - 0.5) * 0.4, y: -4 - Math.random() * 2 },
      color: color,
      particles: [],
      trailTimer: 0
    };

    this.fireworks.push(fw);
    this.audio.playFireworkLaunch();
  }

  private explodeFirework(fw: Firework): void {
    // se já explodiu, ignora
    if (fw.phase === 'EXPLODED') return;

    fw.phase = 'EXPLODED';
    this.audio.playFireworkBang();

    const particleCount = 20 + Math.floor(Math.random() * 15);
    for (let i = 0; i < particleCount; i++) {
      const angle = (Math.PI * 2 * i) / particleCount + (Math.random() - 0.5) * 0.4;
      const speed = 1 + Math.random() * 2;

      fw.particles.push({
        position: { x: fw.x, y: fw.y },
        velocity: { x: Math.cos(angle) * speed, y: Math.sin(angle) * speed },
        life: 500 + Math.random() * 500,
        maxLife: 1000,
        color: fw.color,
        size: Math.random() > 0.5 ? 2 : 1
      });
    }
  }
}
