// Game Principal - Super Feka Gaps

import {
  GameState, GAME_WIDTH, GAME_HEIGHT, TILE_SIZE, COLORS,
  INITIAL_LIVES, COIN_SCORE, ENEMY_SCORE, TIME_BONUS_MULTIPLIER, TileType,
  GP_IMPACT_RADIUS_PX, GP_SHAKE_MS, GP_SHAKE_MAG
} from '../constants';
import {
  CameraData, Vector2, FlagData, CollectibleData, CollectibleSpawnData,
  CollectibleType, Particle, Firework, EnemyType, GroundPoundState, LevelData
} from '../types';
import { Input } from '../engine/Input';
import { Audio } from '../engine/Audio';
import { Renderer } from '../engine/Renderer';
import { AudioVoicePlayer } from '../voice/AudioVoicePlayer';
import { SpeechBubbleController } from '../voice/SpeechBubbleController';
import { VoiceDirector } from '../voice/VoiceDirector';
import { JOAOZAO_VOICE_MANIFEST } from '../voice/joaozaoVoiceManifest';
import { Level, createLevel } from '../world/Level';
import { Player } from '../entities/Player';
import { Minion } from '../entities/enemies/Minion';
import { Joaozao } from '../entities/enemies/Joaozao';
import { getLevelByIndex, TOTAL_LEVELS, ALL_LEVELS } from '../data/levels';

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

  // Timers
  private bootTimer: number = 1500;
  private levelClearTimer: number = 3000;
  private gameOverTimer: number = 3000;
  private bossIntroTimer: number = 2000;
  private endingTimer: number = 0;
  private deathTimer: number = 0;

  // Checkpoint ativo
  private activeCheckpoint: Vector2 | null = null;

  // Loop
  private lastTime: number = 0;
  private accumulator: number = 0;
  private readonly fixedDeltaTime: number = 1000 / 60; // 60 FPS

  constructor() {
    this.input = new Input();
    this.audio = new Audio();
    this.renderer = new Renderer();

    this.camera = {
      x: 0,
      y: 0,
      targetX: 0,
      targetY: 0,
      shakeTimer: 0,
      shakeMagnitude: 0,
      bounds: { minX: 0, maxX: 0, minY: 0, maxY: 0 }
    };

    this.validateLevelsOnStartup();
  }

  private validateLevelsOnStartup(): void {
    console.log('🔍 Validando níveis...');
    const levels = ALL_LEVELS;
    let hasErrors = false;

    levels.forEach((level, index) => {
      // Validar ID contíguo
      if (level.id !== index.toString()) {
        console.error(`❌ Erro no Nível ${index}: ID esperado '${index}', encontrado '${level.id}'`);
        hasErrors = true;
      }

      // Validar tiles
      level.tiles.forEach((row, rIdx) => {
        row.forEach((tile, cIdx) => {
          // Tiles válidos: 0-7, 10-13
          const isValid = (tile >= 0 && tile <= 7) || (tile >= 10 && tile <= 13);
          if (!isValid) {
            console.error(`❌ Erro no Nível ${level.id}: Tile inválido '${tile}' em [${rIdx}, ${cIdx}]`);
            hasErrors = true;
          }
        });
      });
    });

    if (!hasErrors) {
      console.log('✅ Todos os níveis validados com sucesso!');
    } else {
      console.warn('⚠️ Foram encontrados problemas na validação dos níveis. Verifique o console.');
    }
  }

  start(): void {
    this.lastTime = performance.now();
    this.gameLoop();
  }

  private gameLoop = (): void => {
    const currentTime = performance.now();
    const deltaTime = currentTime - this.lastTime;
    this.lastTime = currentTime;

    // Fixed timestep para física
    this.accumulator += deltaTime;

    while (this.accumulator >= this.fixedDeltaTime) {
      this.update(this.fixedDeltaTime);
      this.accumulator -= this.fixedDeltaTime;
    }

    this.render();

    requestAnimationFrame(this.gameLoop);
  };

  private update(deltaTime: number): void {
    this.input.update();

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
      powerupActive: this.player ? this.player.data.coffeeTimer > 0 : false,
      deliciaMode: this.deliciaMode
    });

    const bossAlive = this.boss ? !this.boss.data.isDead : false;
    this.bossVoice?.update(deltaTime, {
      allowAmbient: this.state === GameState.PLAYING && bossAlive
    });

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

    // Timer do nível
    this.levelTime -= deltaTime / 1000;
    if (this.levelTime <= 0) {
      this.playerDie();
      return;
    }

    // Atualiza tiles dinâmicos (gaps temporários do boss)
    this.level.updateDynamicTiles(deltaTime);

    // Verifica se player está morto
    if (this.player.data.isDead) {
      this.deathTimer -= deltaTime;
      if (this.player.data.deathTimer > 0) {
        this.player.data.deathTimer = Math.max(0, this.player.data.deathTimer - deltaTime);
      }
      if (this.deathTimer <= 0) {
        this.handlePlayerDeath();
      }
      return;
    }

    // Atualiza player
    const playerResult = this.player.update(deltaTime, this.input.getState(), this.level);

    // Processa início de Ground Pound
    if (playerResult && playerResult.groundPoundStarted) {
      this.audio.playGroundPoundStart();
    }

    // Processa impacto de Ground Pound
    if (playerResult && playerResult.groundPoundImpact) {
      this.handleGroundPoundImpact(playerResult.groundPoundImpact);
    }

    // Processa tile hits resultantes de colisão com tiles (ex.: cabeçada)
    if (playerResult && playerResult.tileHit) {
      const th = playerResult.tileHit;
      if (th && th.side === 'top' && this.level) {
        // Cabeçada em tile (por baixo do bloco)
        const tileType = this.level.getTile(th.col, th.row);
        if (tileType === TileType.BRICK_BREAKABLE) {
          // Quebra o bloco
          this.level.setTile(th.col, th.row, TileType.EMPTY);
          this.spawnParticles(th.col * TILE_SIZE + TILE_SIZE / 2, th.row * TILE_SIZE + TILE_SIZE / 2, '#DEB887', 10);
          this.audio.playBlockBreak();
          this.score += 50;
        } else if (tileType === TileType.BRICK) {
          if (this.player.data.hasHelmet) {
            this.level.setTile(th.col, th.row, TileType.EMPTY);
            this.spawnParticles(th.col * TILE_SIZE + TILE_SIZE / 2, th.row * TILE_SIZE + TILE_SIZE / 2, '#DEB887', 10);
            this.audio.playBlockBreak();
            this.score += 50;
          } else {
            this.audio.playBlockBump();
          }
        } else if (tileType === TileType.POWERUP_BLOCK_COFFEE || tileType === TileType.POWERUP_BLOCK_HELMET) {
          // Troca por usado e spawna power-up
          const newTile = TileType.BLOCK_USED;
          this.level.setTile(th.col, th.row, newTile);
          const collectType = tileType === TileType.POWERUP_BLOCK_COFFEE ? CollectibleType.COFFEE : CollectibleType.HELMET;
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

    // Spike damage uses the same pipeline as enemies/projectiles
    if (!this.player.data.isDead && this.level.checkSpikeCollision(this.player.getRect())) {
      this.playerHit();
    }

    // Atualiza câmera
    this.updateCamera(deltaTime);

    // Atualiza inimigos minion
    this.minions.forEach(minion => {
      minion.update(deltaTime, this.level!);
      this.checkMinionCollision(minion);
    });

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
        this.camera.shakeTimer = GP_SHAKE_MS;
        this.camera.shakeMagnitude = GP_SHAKE_MAG;
        this.spawnParticles(impact.x, impact.y, '#FFFFFF', 15);
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

    // Verifica coletáveis
    this.checkCollectibles();

    // Verifica bandeiras (checkpoint/final)
    this.checkFlags();

    // Atualiza animacao das bandeiras
    this.updateFlags(deltaTime);

    // Atualiza partículas
    this.updateParticles(deltaTime);
  }

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
    if (this.endingTimer > 5000 && this.input.consumeStart()) {
      this.changeState(GameState.MENU);
    }
  }

  private render(): void {
    this.renderer.clear();

    switch (this.state) {
      case GameState.BOOT:
        this.renderBoot();
        break;
      case GameState.MENU:
        this.renderer.drawTitleScreen();
        break;
      case GameState.PLAYING:
      case GameState.PAUSED:
        this.renderGame();
        if (this.state === GameState.PAUSED) {
          this.renderer.drawPauseOverlay();
        }
        break;
      case GameState.GAME_OVER:
        this.renderGame();
        this.renderer.drawGameOver(this.score);
        break;
      case GameState.LEVEL_CLEAR:
        this.renderGame();
        const timeBonus = Math.floor(this.levelTime) * TIME_BONUS_MULTIPLIER;
        this.renderer.drawLevelClear(
          this.level?.data.name || '',
          this.score,
          timeBonus
        );
        break;
      case GameState.BOSS_INTRO:
        this.renderGame();
        this.renderer.drawBossIntro('JOÃOZÃO');
        break;
      case GameState.ENDING:
        this.renderer.drawEnding(this.fireworks);
        break;
    }

    this.renderer.drawOrangeRain(this.deliciaMode);
    this.renderer.present();
  }

  private renderBoot(): void {
    const ctx = this.renderer.getContext();
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FFFFFF';
    ctx.fillText('Torbware', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);
    ctx.font = '8px monospace';
    ctx.fillStyle = '#888888';
    ctx.fillText('presents', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10);
  }

  private renderGame(): void {
    if (!this.level || !this.player) return;

    // Background
    this.renderer.drawBackground(this.camera);

    // Tiles
    this.renderer.drawTiles(this.level.getModifiedTiles(), this.camera);

    // Fogos (se o boss está morto/morrendo)
    const bossDying = this.boss && this.boss.data.isDead;
    if (bossDying) {
      this.renderer.drawFireworks(this.fireworks, this.camera.x, this.camera.y);
    }

    // Flags (checkpoint / final)
    this.flags.forEach(flag => {
      this.renderer.drawFlag(flag, this.camera);
    });

    // Coletáveis
    this.collectibles.forEach(c => {
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

    // HUD
    this.renderer.drawHUD(
      this.score,
      this.lives,
      this.levelTime,
      this.level.data.name,
      this.audio.isEnabled(),
      this.player.data.hasHelmet,
      this.player.data.coffeeTimer
    );

    // Touch controls
    this.renderer.drawTouchControls();
  }

  private changeState(newState: GameState): void {
    const prevState = this.state;
    this.state = newState;
    this.audio.onStateChange(prevState, newState, {
      levelId: this.level?.data.id ?? null,
      isBossLevel: this.level?.data.isBossLevel ?? false,
      playerAlive: this.player ? !this.player.data.isDead : true,
      powerupActive: this.player ? this.player.data.coffeeTimer > 0 : false,
      gameState: newState,
      deliciaMode: this.deliciaMode
    });
  }

  private startNewGame(): void {
    this.currentLevelIndex = 0;
    this.score = 0;
    this.lives = INITIAL_LIVES;
    this.coins = 0;
    this.loadLevel(0);
  }

  private loadLevel(index: number): void {
    const rawLevelData = getLevelByIndex(index);
    if (!rawLevelData) {
      // Fim do jogo!
      this.onGameComplete();
      return;
    }

    const levelData = this.normalizeLevelData(rawLevelData);
    this.level = createLevel(levelData);
    this.player = new Player(levelData.playerSpawn.x, levelData.playerSpawn.y);
    this.levelTime = levelData.timeLimit;
    this.activeCheckpoint = null;

    // Configura câmera
    const bounds = this.level.getBounds();
    this.camera.bounds = bounds;
    this.camera.x = 0;
    this.camera.y = 0;

    // Carrega inimigos
    this.minions = [];
    this.boss = null;
    this.bossVoice?.stop();
    this.bossVoice = null;

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
    const validatedCollectibles = this.validateCollectibles(levelData.collectibles, levelData.tiles, levelData.id);
    this.collectibles = validatedCollectibles.map(c => ({
      position: { x: c.position.x * TILE_SIZE, y: c.position.y * TILE_SIZE },
      velocity: { x: 0, y: 0 },
      width: 16,
      height: 16,
      active: true,
      type: c.type,
      collected: false,
      animationFrame: 0,
      animationTimer: Math.random() * 100
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

  private normalizeLevelData(levelData: LevelData): LevelData {
    const tiles: number[][] = [];
    const checkpointMarkers: Vector2[] = [];
    const goalMarkers: Vector2[] = [];

    for (let row = 0; row < levelData.tiles.length; row++) {
      const sourceRow = levelData.tiles[row];
      const newRow: number[] = [];
      for (let col = 0; col < sourceRow.length; col++) {
        const tile = sourceRow[col];
        if (tile === TileType.CHECKPOINT) {
          checkpointMarkers.push({ x: col, y: row });
          newRow.push(TileType.EMPTY);
          continue;
        }
        if (tile === TileType.FLAG) {
          goalMarkers.push({ x: col, y: row });
          newRow.push(TileType.EMPTY);
          continue;
        }
        newRow.push(tile);
      }
      tiles.push(newRow);
    }

    const checkpoints = checkpointMarkers.length > 0
      ? checkpointMarkers
      : levelData.checkpoints;

    const goalPosition = goalMarkers.length > 0
      ? goalMarkers[0]
      : levelData.goalPosition;

    return {
      ...levelData,
      tiles,
      checkpoints,
      goalPosition
    };
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

    // Reinicia para tela de abertura/menu
    this.changeState(GameState.BOOT);
  }

  private buildFlags(levelData: LevelData): FlagData[] {
    const flags: FlagData[] = [];
    let nextId = 0;

    levelData.checkpoints.forEach(cp => {
      const col = Math.floor(cp.x);
      const row = Math.floor(cp.y);
      const surfaceRow = this.findSurfaceRow(levelData.tiles, col, row) ?? row;
      const resolvedRow = this.clampRow(surfaceRow, levelData.tiles.length);
      const anchor = {
        x: col * TILE_SIZE + Math.floor(TILE_SIZE / 2),
        y: resolvedRow * TILE_SIZE
      };
      const triggerTop = Math.max(0, (resolvedRow - 1) * TILE_SIZE);
      flags.push({
        id: nextId++,
        kind: 'checkpoint',
        anchor,
        trigger: {
          x: col * TILE_SIZE + 2,
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
      const col = Math.floor(levelData.goalPosition.x);
      const row = Math.floor(levelData.goalPosition.y);
      const surfaceRow = this.findSurfaceRow(levelData.tiles, col, row) ?? row;
      const resolvedRow = this.clampRow(surfaceRow, levelData.tiles.length);
      const anchor = {
        x: col * TILE_SIZE + Math.floor(TILE_SIZE / 2),
        y: resolvedRow * TILE_SIZE
      };
      const triggerTop = Math.max(0, (resolvedRow - 2) * TILE_SIZE);
      flags.push({
        id: nextId++,
        kind: 'goal',
        anchor,
        trigger: {
          x: col * TILE_SIZE,
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

    const playerCenter = this.player.getCenter();

    // Target da câmera é o player
    this.camera.targetX = playerCenter.x - GAME_WIDTH / 2;
    this.camera.targetY = playerCenter.y - GAME_HEIGHT / 2;

    // Suavização (lerp)
    this.camera.x += (this.camera.targetX - this.camera.x) * 0.1;
    this.camera.y += (this.camera.targetY - this.camera.y) * 0.1;

    // Limita aos bounds
    this.camera.x = Math.max(this.camera.bounds.minX,
      Math.min(this.camera.x, this.camera.bounds.maxX - GAME_WIDTH));
    this.camera.y = Math.max(this.camera.bounds.minY,
      Math.min(this.camera.y, this.camera.bounds.maxY - GAME_HEIGHT));

    // Aplica shake
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
            '#FF6347',
            5
          );
        } else if (prevGp === GroundPoundState.FALL) {
          // Ground pound em cima do minion: mata sem bounce
          minion.stomp();
          this.audio.playStomp();
          this.score += ENEMY_SCORE;
          // Evita isJumping preso
          this.player.data.isJumping = false;
          this.spawnParticles(
            minion.data.position.x + minion.data.width / 2,
            minion.data.position.y,
            '#FF6347',
            8
          );
        } else {
          this.playerHit();
        }
      } else {
        this.playerHit();
      }
    }
  }

  private checkBossCollision(): void {
    if (!this.player || !this.boss || this.player.data.isDead) return;

    // Boss collision
    const playerRect = this.player.getRect();
    const prevRect = this.player.getPrevRectForContacts();
    const prevVelocity = this.player.getPrevVelocityForContacts();
    const prevGp = this.player.getPrevGroundPoundStateForContacts();
    const collision = this.boss.checkPlayerCollision(playerRect, prevRect);

    if (!collision.hit) {
      // Projectile collision
      if (this.boss.checkProjectileCollision(this.player.getRect())) {
        this.playerHit();
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
        this.score += 1000;
        // Play the specific death line before executing the final die animation
        if (this.bossVoice) {
          this.bossVoice.playLineAndWait('para_de_encher_o_saco').then(started => {
            if (!started) {
              // Couldn't play; fall back to instant death
              this.boss?.die();
            } else {
              // After the line completes, execute death
              this.boss?.die();
            }
          });
        } else {
          this.boss?.die();
        }
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
      this.playerHit();
    }
  }

  private checkCollectibles(): void {
    if (!this.player) return;

    const playerRect = this.player.getRect();

    this.collectibles.forEach(c => {
      if (c.collected || !c.active) return;

      // Atualiza animação
      c.animationTimer++;

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
            this.audio.playCoin();
            this.spawnParticles(
              c.position.x + c.width / 2,
              c.position.y + c.height / 2,
              '#FFD700',
              3
            );
            break;

          case CollectibleType.COFFEE:
            if (this.player) {
              this.player.collectCoffee();
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
        this.spawnParticles(flag.anchor.x, flag.anchor.y - 6, '#00FF00', 8);
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
    if (!this.level || !this.player) return;

    // 1. Efeitos de câmera e som
    this.camera.shakeTimer = GP_SHAKE_MS;
    this.camera.shakeMagnitude = GP_SHAKE_MAG;
    this.audio.playGroundPoundImpact();

    // 2. Quebra de tiles (abaixo e pros lados)
    const hasHelmet = this.player.data.hasHelmet;
    for (let dc = -1; dc <= 1; dc++) {
      const res = this.level.breakTile(impact.col + dc, impact.row, hasHelmet);
      if (res.success) {
        this.spawnParticles(
          (impact.col + dc) * TILE_SIZE + TILE_SIZE / 2,
          impact.row * TILE_SIZE + TILE_SIZE / 2,
          '#DEB887',
          8
        );
        this.score += 50;
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
          '#FF6347',
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
          this.score += 1000;
          if (this.bossVoice) {
            this.bossVoice.playLineAndWait('para_de_encher_o_saco').then(started => {
              if (!started) {
                this.boss?.die();
              } else {
                this.boss?.die();
              }
            });
          } else {
            this.boss?.die();
          }
        }

        this.spawnParticles(impact.x, impact.y, '#FFFFFF', 15);
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
        color: '#FFFFFF',
        size: 1 + Math.random() * 2
      });
    }
  }

  private playerHit(): void {
    if (!this.player || this.player.data.invincibleTimer > 0) return;

    const damageResult = this.player.takeDamage();

    if (damageResult.helmetUsed) {
      const center = this.player.getCenter();
      this.spawnParticles(center.x, center.y - 6, '#FFD700', 8);
      this.audio.playHelmetBreak();
    }

    if (damageResult.damaged) {
      this.audio.playDamage();
      this.playerDie();
    }
  }

  private playerDie(): void {
    if (!this.player) return;

    this.player.die();
    this.audio.playFall();
    this.audio.onPlayerDeathStart();
    this.deathTimer = 1500;
    const center = this.player.getCenter();
    this.spawnParticles(center.x, center.y, '#FFFFFF', 12);
  }

  private handlePlayerDeath(): void {
    this.lives--;

    if (this.lives <= 0) {
      this.audio.playGameOver();
      this.gameOverTimer = 3000;
      this.changeState(GameState.GAME_OVER);
    } else {
      // Respawn no checkpoint ou início
      if (!this.player || !this.level) return;

      const spawnPos = this.activeCheckpoint || this.level.data.playerSpawn;
      this.player.respawn(spawnPos);
      this.levelTime = this.level.data.timeLimit;
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
    this.endingTimer = 0;
    this.changeState(GameState.ENDING);
    
    // Spawn initial burst of fireworks for ending screen
    for (let i = 0; i < 5; i++) {
      setTimeout(() => this.spawnFirework(), i * 150);
    }
    this.fireworkSpawnTimer = 300; // Quick respawn
  }

  private isSurfaceTile(tile: number): boolean {
    return tile === TileType.GROUND ||
      tile === TileType.BRICK ||
      tile === TileType.BRICK_BREAKABLE ||
      tile === TileType.POWERUP_BLOCK_COFFEE ||
      tile === TileType.POWERUP_BLOCK_HELMET ||
      tile === TileType.BLOCK_USED ||
      tile === TileType.PLATFORM;
  }

  private isSolidTile(tile: number): boolean {
    return tile === TileType.GROUND ||
      tile === TileType.BRICK ||
      tile === TileType.BRICK_BREAKABLE ||
      tile === TileType.POWERUP_BLOCK_COFFEE ||
      tile === TileType.POWERUP_BLOCK_HELMET ||
      tile === TileType.BLOCK_USED ||
      tile === TileType.PLATFORM ||
      tile === TileType.SPIKE;
  }

  private validateCollectibles(
    collectibles: CollectibleSpawnData[],
    tiles: number[][],
    levelId: string
  ): CollectibleSpawnData[] {
    return collectibles.map(c => {
      const copy = { type: c.type, position: { x: c.position.x, y: c.position.y } };
      const col = Math.floor(copy.position.x);
      const row = Math.floor(copy.position.y);

      if (row < 0 || row >= tiles.length || col < 0 || col >= tiles[0].length) {
        console.warn(`Level ${levelId} collectible out of bounds at col=${col} row=${row} type=${copy.type}`);
        return copy;
      }

      const tile = tiles[row][col];
      if (this.isSolidTile(tile)) {
        console.warn(`Level ${levelId} collectible inside solid tile at col=${col} row=${row} tile=${tile} type=${copy.type}`);
        const aboveRow = row - 1;
        if (aboveRow >= 0 && !this.isSolidTile(tiles[aboveRow][col])) {
          copy.position.y = aboveRow;
          console.warn(`Level ${levelId} collectible moved to col=${col} row=${aboveRow} type=${copy.type}`);
        }
      }

      return copy;
    });
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

  private updateParticles(deltaTime: number): void {
    this.particles = this.particles.filter(p => {
      p.position.x += p.velocity.x;
      p.position.y += p.velocity.y;
      p.velocity.y += 0.1; // Gravidade nas partículas
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

    const color = COLORS.FIREWORK_COLORS[Math.floor(Math.random() * COLORS.FIREWORK_COLORS.length)];

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
