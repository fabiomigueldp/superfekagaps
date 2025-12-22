// Sistema de Renderização - Super Feka Gaps

import {
  GAME_WIDTH,
  GAME_HEIGHT,
  TILE_SIZE,
  COLORS,
  TileType,
  FALLING_PLATFORM_FALL_MS,
  FALLING_PLATFORM_FALL_DISTANCE
} from '../constants';
import { CameraData, PlayerData, EnemyData, CollectibleData, FlagData, Particle, Firework, EnemyType, CollectibleType, GroundPoundState, SpeechBubbleRenderState, FallingPlatformPhase } from '../types';
import { PLAYER_PALETTE, PLAYER_SPRITES, PLAYER_PIXEL_SIZE, PLAYER_RENDER_OFFSET_X, PLAYER_RENDER_OFFSET_Y } from '../assets/playerSpriteSpec';


export class Renderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private offscreenCanvas: HTMLCanvasElement;
  private offscreenCtx: CanvasRenderingContext2D;
  private scale: number = 1;
  private dpr: number = 1;
  private debug: boolean = false;
  private lastUIType: 'HUD' | 'TITLE' | null = null;
  private lastUIParams: any = null;
  private yasminImg: HTMLImageElement | null = null;

  // Partículas para "chuva" do modo Delícia
  private rainDrops: { x: number; y: number; speed: number; len: number }[] = [];
  private rainActive: boolean = false;

  // Fireworks shown specially on the high-res UI layer (ENDING)
  private lastEndingFireworks: Firework[] = [];

  constructor() {
    this.canvas = document.getElementById('game-canvas') as HTMLCanvasElement;
    this.ctx = this.canvas.getContext('2d')!;

    // Canvas offscreen para renderização em resolução lógica
    this.offscreenCanvas = document.createElement('canvas');
    this.offscreenCanvas.width = GAME_WIDTH;
    this.offscreenCanvas.height = GAME_HEIGHT;
    this.offscreenCtx = this.offscreenCanvas.getContext('2d')!;

    // Desabilita anti-aliasing para pixel-art
    this.offscreenCtx.imageSmoothingEnabled = false;
    this.ctx.imageSmoothingEnabled = false;

    // Carrega imagem da Yasmin para a tela final
    const img = new Image();
    img.onload = () => { this.yasminImg = img; };
    const base = (import.meta as any).env?.BASE_URL ?? '/';
    img.src = `${base}assets/sprites/yasmin.png`;

    // Debug: habilita overlay via hash #debug ou variavel global __DEBUG_RENDERER
    try {
      this.debug = location.hash.includes('debug') || (window as any).__DEBUG_RENDERER === true;
    } catch (e) {
      this.debug = false;
    }

    // Expõe o renderer para inspeção no console: (window as any).renderer
    (window as any).renderer = this;

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  // Helper: retorna camera arredondada para evitar sub-pixel blur na renderização
  private snapCamera(camera: CameraData): { x: number; y: number } {
    return { x: Math.round(camera.x), y: Math.round(camera.y) };
  }

  private resize(): void {
    const windowWidth = window.innerWidth;
    const windowHeight = window.innerHeight;

    // Calcula escala mantendo aspect ratio
    const scaleX = Math.floor(windowWidth / GAME_WIDTH);
    const scaleY = Math.floor(windowHeight / GAME_HEIGHT);
    let chosenScale = Math.max(1, Math.min(scaleX, scaleY));

    const dpr = window.devicePixelRatio || 1;
    let chosenDpr = dpr;
    let foundIntegerScale = false;

    for (let s = chosenScale; s >= 1; s--) {
      const scaled = s * dpr;
      if (Math.abs(scaled - Math.round(scaled)) < 0.01) {
        chosenScale = s;
        foundIntegerScale = true;
        break;
      }
    }

    if (!foundIntegerScale) {
      chosenDpr = Math.max(1, Math.round(dpr));
    }

    this.scale = chosenScale;
    this.dpr = chosenDpr;

    // CSS size (mantem dimensao inteira para pixel-perfect)
    this.canvas.style.width = `${GAME_WIDTH * this.scale}px`;
    this.canvas.style.height = `${GAME_HEIGHT * this.scale}px`;

    // Buffer real para suportar HiDPI
    this.canvas.width = Math.round(GAME_WIDTH * this.scale * chosenDpr);
    this.canvas.height = Math.round(GAME_HEIGHT * this.scale * chosenDpr);

    // Mantém imageSmoothing desabilitado
    this.ctx.imageSmoothingEnabled = false;

    if (this.debug) {
      console.log(`[Renderer] win:${windowWidth}x${windowHeight} dpr:${dpr} chosenScale:${chosenScale} chosenDpr:${chosenDpr} css:${this.canvas.style.width}x${this.canvas.style.height} canvas:${this.canvas.width}x${this.canvas.height}`);
    }
  }

  clear(): void {
    this.lastUIType = null;
    this.lastUIParams = null;
    this.lastEndingFireworks = [];
    this.offscreenCtx.fillStyle = COLORS.SKY_LIGHT;
    this.offscreenCtx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
  }

  // Aplica a renderização offscreen ao canvas principal
  present(): void {
    // Desenha o offscreen (resolução lógica) para o buffer real (considerando DPR)
    this.ctx.imageSmoothingEnabled = false;
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Overlay de debug (desenhado no offscreen antes de escalar)
    if (this.debug) this.drawDebugInfo();

    this.ctx.drawImage(
      this.offscreenCanvas,
      0, 0, GAME_WIDTH, GAME_HEIGHT,
      0, 0, this.canvas.width, this.canvas.height
    );

    // Desenha UI em alta resolução diretamente no canvas principal para evitar blur
    if (this.lastUIType) {
      this.drawUIOnScreen();
    }

    if (this.rainActive) {
      this.drawOrangeFilter();
    }

    if (this.rainActive && this.rainDrops.length > 0) {
      this.drawOrangeRainOnScreen(this.scale * this.dpr);
    }
  }

  // Desenha chuva de "suco de laranja" sobre o jogo (quando ativo)
  drawOrangeRain(active: boolean): void {
    this.rainActive = active;
    if (!active) {
      // limpa gotas para evitar persistencia quando desativado
      this.rainDrops = [];
      return;
    }

    const maxDrops = 80;
    const spawnCount = Math.min(maxDrops - this.rainDrops.length, 2);
    for (let i = 0; i < spawnCount; i++) {
      this.rainDrops.push({
        x: Math.random() * GAME_WIDTH,
        y: -Math.random() * GAME_HEIGHT,
        speed: 3 + Math.random() * 3.5,
        len: 3 + Math.random() * 4
      });
    }

    for (let i = 0; i < this.rainDrops.length; i++) {
      const drop = this.rainDrops[i];
      drop.y += drop.speed;

      // recicla quando sai da tela (evita alocacao)
      if (drop.y > GAME_HEIGHT + 10) {
        drop.y = -10 - Math.random() * 30;
        drop.x = Math.random() * GAME_WIDTH;
        drop.speed = 3 + Math.random() * 3.5;
        drop.len = 3 + Math.random() * 4;
      }
    }
  }

  private drawOrangeRainOnScreen(pixelScale: number): void {
    if (this.rainDrops.length === 0) return;
    const ctx = this.ctx;
    const thickness = Math.max(1, Math.round(pixelScale));

    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#FFA500';
    ctx.globalAlpha = 0.6;

    for (let i = 0; i < this.rainDrops.length; i++) {
      const drop = this.rainDrops[i];
      const x = Math.round(drop.x * pixelScale);
      const y = Math.round(drop.y * pixelScale);
      const len = Math.max(1, Math.round(drop.len * pixelScale));
      ctx.fillRect(x, y - len, thickness, len);
    }

    ctx.restore();
  }

  private drawOrangeFilter(): void {
    const ctx = this.ctx;
    ctx.save();
    ctx.globalAlpha = 0.12;
    ctx.fillStyle = '#FFA500';
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.restore();
  }

  private drawDebugInfo(): void {
    const ctx = this.offscreenCtx;
    const info = [
      `DPR:${window.devicePixelRatio}`,
      `scale:${this.scale}`,
      `css:${this.canvas.style.width}x${this.canvas.style.height}`,
      `canvas(px):${this.canvas.width}x${this.canvas.height}`,
      `offscreen:${this.offscreenCanvas.width}x${this.offscreenCanvas.height}`
    ];

    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(4, 4, 140, info.length * 9 + 6);
    ctx.fillStyle = '#FFFFFF';
    ctx.font = '7px monospace';
    ctx.textAlign = 'left';
    for (let i = 0; i < info.length; i++) {
      ctx.fillText(info[i], 8, 12 + i * 9);
    }
    ctx.restore();
  }

  private drawUIOnScreen(): void {
    const ctx = this.ctx;
    const pixelScale = this.scale * this.dpr;
    const w = Math.round(GAME_WIDTH * pixelScale);
    const h = Math.round(GAME_HEIGHT * pixelScale);

    ctx.save();
    ctx.imageSmoothingEnabled = false;

    if (this.lastUIType === 'HUD' && this.lastUIParams) {
      const p = this.lastUIParams;
      // Background bar
      const hudH = Math.max(1, Math.round(16 * pixelScale));
      ctx.fillStyle = 'rgba(0,0,0,0.7)';
      ctx.fillRect(0, 0, w, hudH);

      // Text
      const fontSize = Math.max(6, Math.round(8 * pixelScale));
      ctx.font = `${fontSize}px monospace`;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'alphabetic';

      // Score
      ctx.fillStyle = COLORS.HUD_TEXT;
      ctx.fillText(`SCORE:${p.score.toString().padStart(6, '0')}`, Math.round(4 * pixelScale), Math.round(11 * pixelScale));

      // Lives
      ctx.fillStyle = COLORS.FEKA_SHIRT;
      for (let i = 0; i < p.lives; i++) {
        ctx.fillRect(Math.round((100 + i * 10) * pixelScale), Math.round(4 * pixelScale), Math.max(1, Math.round(6 * pixelScale)), Math.max(1, Math.round(8 * pixelScale)));
      }

      // Helmet icon
      if (p.hasHelmet) {
        const x = Math.round(118 * pixelScale);
        const y = Math.round(4 * pixelScale);
        ctx.fillStyle = '#FFD700';
        ctx.fillRect(x + Math.round(1 * pixelScale), y + Math.round(2 * pixelScale), Math.max(1, Math.round(10 * pixelScale)), Math.max(1, Math.round(2 * pixelScale)));
        ctx.fillRect(x + Math.round(2 * pixelScale), y + Math.round(4 * pixelScale), Math.max(1, Math.round(8 * pixelScale)), Math.max(1, Math.round(3 * pixelScale)));
        ctx.fillStyle = '#FFF8DC';
        ctx.fillRect(x + Math.round(4 * pixelScale), y + Math.round(4 * pixelScale), Math.max(1, Math.round(2 * pixelScale)), Math.max(1, Math.round(1 * pixelScale)));
      }

      // Fanta icon (High Res)
      if (p.coffeeTimer > 0) {
        const x = Math.round(132 * pixelScale);
        const y = Math.round(4 * pixelScale);
        const w = Math.max(1, Math.round(6 * pixelScale));
        const h = Math.max(1, Math.round(8 * pixelScale));

        // Lata
        ctx.fillStyle = '#FF8C00';
        ctx.fillRect(x, y, w, h);

        // Detalhe
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(x, y + Math.round(3 * pixelScale), w, Math.max(1, Math.round(2 * pixelScale)));

        // Bar
        const maxTime = 10000;
        const pct = Math.max(0, Math.min(1, p.coffeeTimer / maxTime));
        const barW = Math.round(10 * pixelScale * pct);
        ctx.fillStyle = '#FFA500';
        ctx.fillRect(x, y + h + Math.round(1 * pixelScale), barW, Math.max(1, Math.round(2 * pixelScale)));
      }

      // Time
      ctx.fillStyle = p.time < 30 ? '#FF0000' : COLORS.HUD_TEXT;
      ctx.fillText(`TIME:${Math.ceil(p.time).toString().padStart(3, '0')}`, Math.round(145 * pixelScale), Math.round(11 * pixelScale));

      // Level
      ctx.fillStyle = COLORS.HUD_ACCENT;
      ctx.fillText(p.level, Math.round(210 * pixelScale), Math.round(11 * pixelScale));

      // Sound icon (simplified)
      const sx = Math.round((GAME_WIDTH - 14) * pixelScale);
      const sy = Math.round(4 * pixelScale);
      ctx.fillStyle = p.soundEnabled ? '#00FF00' : '#FF0000';
      ctx.fillRect(sx, sy + Math.round(3 * pixelScale), Math.max(1, Math.round(3 * pixelScale)), Math.max(1, Math.round(6 * pixelScale)));
      ctx.fillRect(sx + Math.round(3 * pixelScale), sy + Math.round(2 * pixelScale), Math.max(1, Math.round(2 * pixelScale)), Math.max(1, Math.round(8 * pixelScale)));
      ctx.fillRect(sx + Math.round(5 * pixelScale), sy + Math.round(3 * pixelScale), Math.max(1, Math.round(2 * pixelScale)), Math.max(1, Math.round(6 * pixelScale)));

    } else if (this.lastUIType === 'TITLE') {
      // Full screen title / overlay drawn on main canvas for crisp text
      ctx.save();
      ctx.imageSmoothingEnabled = false;

      // LEVEL CLEAR (high-res)
      if (this.lastUIParams && this.lastUIParams.variant === 'LEVEL_CLEAR') {
        const params = this.lastUIParams as any;
        ctx.fillStyle = 'rgba(0, 50, 0, 0.9)';
        ctx.fillRect(0, 0, w, h);

        ctx.textAlign = 'center';
        ctx.font = `bold ${Math.max(12, Math.round(16 * pixelScale))}px monospace`;
        ctx.fillStyle = '#00FF00';
        ctx.fillText('FASE COMPLETA!', Math.round(w / 2), Math.round((GAME_HEIGHT / 2 - 30) * pixelScale));

        ctx.font = `${Math.max(8, Math.round(10 * pixelScale))}px monospace`;
        ctx.fillStyle = COLORS.MENU_TEXT;
        ctx.fillText(params.level, Math.round(w / 2), Math.round((GAME_HEIGHT / 2 - 10) * pixelScale));
        ctx.fillText(`Score: ${params.score}`, Math.round(w / 2), Math.round((GAME_HEIGHT / 2 + 10) * pixelScale));
        ctx.fillText(`Bônus de tempo: +${params.timeBonus}`, Math.round(w / 2), Math.round((GAME_HEIGHT / 2 + 25) * pixelScale));

        ctx.restore();
        return;
      }

      // BOSS INTRO (high-res)
      if (this.lastUIParams && this.lastUIParams.variant === 'BOSS_INTRO') {
        const params = this.lastUIParams as any;
        ctx.fillStyle = 'rgba(50, 0, 50, 0.9)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = `${Math.max(6, Math.round(8 * pixelScale))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF0000';
        ctx.fillText('!! ALERTA DE BOSS !!', Math.round(w / 2), Math.round((GAME_HEIGHT / 2 - 30) * pixelScale));

        ctx.font = `bold ${Math.max(12, Math.round(16 * pixelScale))}px monospace`;
        ctx.fillStyle = COLORS.JOAOZAO_SKIN;
        ctx.fillText(params.bossName, Math.round(w / 2), Math.round((GAME_HEIGHT / 2) * pixelScale));

        ctx.font = `${Math.max(6, Math.round(8 * pixelScale))}px monospace`;
        ctx.fillStyle = '#AAAAAA';
        ctx.fillText('\"Você vai cair nos meus gaps!\"', Math.round(w / 2), Math.round((GAME_HEIGHT / 2 + 20) * pixelScale));

        ctx.restore();
        return;
      }

      // GAME OVER (high-res)
      if (this.lastUIParams && this.lastUIParams.variant === 'GAME_OVER') {
        const params = this.lastUIParams as any;
        ctx.fillStyle = 'rgba(50, 0, 0, 0.9)';
        ctx.fillRect(0, 0, w, h);

        ctx.font = `bold ${Math.max(20, Math.round(24 * pixelScale))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#FF0000';
        ctx.fillText('GAME OVER', Math.round(w / 2), Math.round((GAME_HEIGHT / 2 - 20) * pixelScale));

        ctx.font = `${Math.max(8, Math.round(10 * pixelScale))}px monospace`;
        ctx.fillStyle = COLORS.MENU_TEXT;
        ctx.fillText(`Score Final: ${params.score}`, Math.round(w / 2), Math.round((GAME_HEIGHT / 2 + 10) * pixelScale));

        ctx.font = `${Math.max(6, Math.round(8 * pixelScale))}px monospace`;
        ctx.fillStyle = '#AAAAAA';
        ctx.fillText('Pressione ENTER para reiniciar', Math.round(w / 2), Math.round((GAME_HEIGHT / 2 + 35) * pixelScale));

        ctx.restore();
        return;
      }

      // ENDING (high-res)
      if (this.lastUIParams && this.lastUIParams.variant === 'ENDING') {
        ctx.fillStyle = '#FFB6C1';
        const g = ctx.createLinearGradient(0, 0, 0, h);
        g.addColorStop(0, '#FF69B4');
        g.addColorStop(1, '#FFB6C1');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, w, h);

        // Draw fireworks on the main canvas (high-res, above background)
        if (this.lastEndingFireworks && this.lastEndingFireworks.length > 0) {
          this.drawFireworksOnScreen(this.lastEndingFireworks, pixelScale);
        }

        // Corações flutuantes (high-res)
        ctx.save();
        ctx.fillStyle = '#FF0000';
        ctx.font = `${Math.max(10, Math.round(10 * pixelScale))}px monospace`;
        ctx.textAlign = 'left';
        for (let i = 0; i < 10; i++) {
          const x = Math.round(((Date.now() / 50 + i * 40) % GAME_WIDTH) * pixelScale);
          const y = Math.round((30 + Math.sin(Date.now() / 500 + i) * 10) * pixelScale);
          ctx.fillText('♥', x, y);
        }
        ctx.restore();

        // Texto principal (high-res)
        ctx.font = `bold ${Math.max(12, Math.round(14 * pixelScale))}px monospace`;
        ctx.textAlign = 'center';
        ctx.fillStyle = '#8B0000';
        ctx.fillText('Feka salvou Yasmin?', Math.round(w / 2), Math.round(40 * pixelScale));

        ctx.font = `${Math.max(8, Math.round(10 * pixelScale))}px monospace`;
        ctx.fillStyle = '#4A0000';
        ctx.fillText('Joãozão foi derrotado!', Math.round(w / 2), Math.round(60 * pixelScale));

        // Desenha o Feka (pixel art) em alta-res no canvas principal para que apareça acima do overlay
        ((): void => {
          const art = PLAYER_SPRITES.idle;
          const px = Math.round((GAME_WIDTH / 2 - 40) * pixelScale);
          const py = Math.round((GAME_HEIGHT / 2 + 10) * pixelScale);
          const ps = Math.max(1, Math.round(2 * pixelScale));

          ctx.save();
          ctx.imageSmoothingEnabled = false;
          // desenhar pixel por pixel escalado
          for (let row = 0; row < art.length; row++) {
            for (let col = 0; col < art[row].length; col++) {
              const ch = art[row][col];
              const color = PLAYER_PALETTE[ch];
              if (color) {
                ctx.fillStyle = color;
                ctx.fillRect(px + col * ps, py + row * ps, ps, ps);
              }
            }
          }
          ctx.restore();
        })();

        // Desenha a imagem da Yasmin diretamente no canvas principal (alta-res, sem blur)
        if (this.yasminImg) {
          const img = this.yasminImg;
          const targetH = Math.round(60 * pixelScale);
          const ratio = img.width / img.height;
          const targetW = Math.round(targetH * ratio);
          const imgX = Math.round(w / 2 + 10 * pixelScale);
          const imgY = Math.round((GAME_HEIGHT / 2 - 20) * pixelScale);
          ctx.drawImage(img, imgX, imgY, targetW, targetH);
        }

        ctx.fillStyle = '#FFD700';
        ctx.fillText('FIM', Math.round(w / 2), Math.round((GAME_HEIGHT - 40) * pixelScale));

        ctx.font = `${Math.max(6, Math.round(8 * pixelScale))}px monospace`;
        ctx.fillStyle = '#8B0000';
        ctx.fillText('Pressione ENTER para jogar novamente', Math.round(w / 2), Math.round((GAME_HEIGHT - 20) * pixelScale));

        ctx.restore();
        return;
      }

      // Fallback: original title screen
      const gradient = ctx.createLinearGradient(0, 0, 0, h);
      gradient.addColorStop(0, '#1a1a3e');
      gradient.addColorStop(1, '#0a0a1e');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, w, h);

      // Stars
      ctx.fillStyle = '#FFFFFF';
      const starSize = Math.max(1, Math.round(1 * pixelScale));
      for (let i = 0; i < 30; i++) {
        const x = Math.round(((i * 37) % GAME_WIDTH) * pixelScale);
        const y = Math.round(((i * 23) % (GAME_HEIGHT - 50)) * pixelScale);
        ctx.fillRect(x, y, starSize, starSize);
      }

      // Title
      ctx.textAlign = 'center';
      const titleFont = Math.max(12, Math.round(20 * pixelScale));
      ctx.font = `bold ${titleFont}px monospace`;
      ctx.fillStyle = COLORS.MENU_HIGHLIGHT;
      ctx.fillText('SUPER FEKA GAPS', Math.round(w / 2), Math.round(50 * pixelScale));

      // Subtitle / instructions
      ctx.font = `${Math.max(6, Math.round(8 * pixelScale))}px monospace`;
      ctx.fillStyle = COLORS.MENU_TEXT;
      ctx.fillText('A aventura para "salvar" a Yasmin!', Math.round(w / 2), Math.round(70 * pixelScale));

      ctx.font = `${Math.max(8, Math.round(10 * pixelScale))}px monospace`;
      ctx.fillStyle = '#AAAAAA';
      ctx.fillText('Pressione ENTER para começar', Math.round(w / 2), Math.round(120 * pixelScale));

      ctx.font = `${Math.max(6, Math.round(8 * pixelScale))}px monospace`;
      ctx.fillStyle = '#888888';
      ctx.fillText('← → : Mover   ESPAÇO : Pular   SHIFT : Correr', Math.round(w / 2), Math.round(145 * pixelScale));
      ctx.fillText('ESC : Pause   M : Som', Math.round(w / 2), Math.round(157 * pixelScale));

      // Ground pound instruction (moved up to avoid overlapping credits)
      ctx.fillText('↓ : Sentada Violenta (no ar)', Math.round(w / 2), Math.round(132 * pixelScale));
      this.drawGroundPoundIconAt(ctx, Math.round(w / 2 - 120 * pixelScale), Math.round(122 * pixelScale), pixelScale);

      ctx.fillStyle = '#666666';
      ctx.fillText('© 2025 Torbware v0.0.1', Math.round(w / 2), Math.round((GAME_HEIGHT - 10) * pixelScale));
    }

    ctx.restore();
  }

  getContext(): CanvasRenderingContext2D {
    return this.offscreenCtx;
  }

  // === RENDERIZAÇÃO DO BACKGROUND ===

  drawBackground(camera: CameraData): void {
    const ctx = this.offscreenCtx;
    const cam = this.snapCamera(camera);

    // Gradiente de céu
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, COLORS.SKY_LIGHT);
    gradient.addColorStop(1, COLORS.SKY_DARK);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Nuvens simples (paralaxe)
    ctx.fillStyle = '#FFFFFF';
    const cloudOffset = cam.x * 0.3;
    for (let i = 0; i < 5; i++) {
      const x = ((i * 80 - cloudOffset) % (GAME_WIDTH + 60)) - 30;
      const y = 20 + (i % 3) * 15;
      this.drawCloud(x, y);
    }
  }

  private drawCloud(x: number, y: number): void {
    const ctx = this.offscreenCtx;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.arc(x + 10, y - 3, 10, 0, Math.PI * 2);
    ctx.arc(x + 22, y, 8, 0, Math.PI * 2);
    ctx.fill();
  }

  // === RENDERIZAÇÃO DE TILES ===

  drawTiles(tiles: number[][], camera: CameraData): void {
    const cam = this.snapCamera(camera);

    const startCol = Math.floor(cam.x / TILE_SIZE);
    const endCol = Math.ceil((cam.x + GAME_WIDTH) / TILE_SIZE);
    const startRow = Math.floor(cam.y / TILE_SIZE);
    const endRow = Math.ceil((cam.y + GAME_HEIGHT) / TILE_SIZE);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (row < 0 || row >= tiles.length || col < 0 || col >= tiles[0].length) continue;

        const tile = tiles[row][col];
        if (tile === TileType.EMPTY) continue;

        const x = col * TILE_SIZE - cam.x;
        const y = row * TILE_SIZE - cam.y;

        this.drawTile(tile, x, y, tiles, row, col);
      }
    }
  }

  drawFallingPlatforms(
    platforms: { col: number; row: number; phase: FallingPlatformPhase; timer: number; contact: number }[],
    camera: CameraData
  ): void {
    if (!platforms.length) return;
    const cam = this.snapCamera(camera);
    const ctx = this.offscreenCtx;

    for (let i = 0; i < platforms.length; i++) {
      const p = platforms[i];
      const x = p.col * TILE_SIZE - cam.x;
      const y = p.row * TILE_SIZE - cam.y;
      let offsetX = 0;
      let offsetY = 0;
      let alpha = 1;

      if (p.phase === 'arming') {
        const seed = (p.col * 17 + p.row * 31) % 10;
        offsetX = Math.round(Math.sin((p.timer / 40) + seed) * 1);
        offsetY = Math.round(Math.cos((p.timer / 55) + seed) * 1);
      } else if (p.phase === 'falling') {
        const progress = Math.max(0, Math.min(1, 1 - p.timer / FALLING_PLATFORM_FALL_MS));
        offsetY = Math.round(progress * FALLING_PLATFORM_FALL_DISTANCE);
        alpha = 1 - progress * 0.4;
      }

      ctx.save();
      ctx.globalAlpha = alpha;
      this.drawFallingPlatformTile(x + offsetX, y + offsetY);
      ctx.restore();
    }
  }

  private drawTile(type: number, x: number, y: number, tiles: number[][], row: number, col: number): void {

    switch (type) {
      case TileType.GROUND:
        this.drawGroundTile(x, y, tiles, row, col);
        break;
      case TileType.BRICK:
        this.drawBrickTile(x, y);
        break;
      case TileType.BRICK_BREAKABLE:
        this.drawBreakableBrick(x, y);
        break;
      case TileType.PLATFORM:
        this.drawPlatformTile(x, y);
        break;
      case TileType.SPIKE:
        this.drawSpikeTile(x, y);
        break;
      case TileType.SPRING:
        this.drawSpringTile(x, y);
        break;
      case TileType.ICE:
        this.drawIceTile(x, y);
        break;
      case TileType.PLATFORM_FALLING:
        this.drawFallingPlatformTile(x, y);
        break;
      case TileType.LAVA_TOP:
        this.drawLavaTopTile(x, y, tiles, row, col);
        break;
      case TileType.LAVA_FILL:
        // Se estiver exposto ao ar, renderiza como Top para ter o visual 3/4 e animacao
        if (row > 0 && tiles[row - 1][col] === TileType.EMPTY) {
          this.drawLavaTopTile(x, y, tiles, row, col);
        } else {
          this.drawLavaFillTile(x, y, row, col);
        }
        break;
      case TileType.HIDDEN_BLOCK:
        // Hidden block: no render until revealed
        break;
      case TileType.POWERUP_BLOCK_COFFEE:
      case TileType.POWERUP_BLOCK_HELMET:
        this.drawPowerupBlock(x, y, type);
        break;
      case TileType.BLOCK_USED:
        this.drawUsedBlock(x, y);
        break;
      case TileType.CHECKPOINT:
        // Checkpoint renderizado separadamente
        break;
      case TileType.FLAG:
        this.drawFlagTile(x, y);
        break;
    }
  }

  private drawGroundTile(x: number, y: number, tiles: number[][], row: number, col: number): void {
    const ctx = this.offscreenCtx;
    const hasGroundAbove = row > 0 && tiles[row - 1][col] === TileType.GROUND;
    const hasLavaAbove = row > 0 && (tiles[row - 1][col] === TileType.LAVA_TOP || tiles[row - 1][col] === TileType.LAVA_FILL);
    const hasCoverAbove = hasGroundAbove || hasLavaAbove;

    // Grass only when there is no ground above
    if (!hasCoverAbove) {
      ctx.fillStyle = COLORS.GROUND_TOP;
      ctx.fillRect(x, y, TILE_SIZE, 4);
      ctx.fillStyle = COLORS.GROUND_DARK;
      for (let i = 0; i < TILE_SIZE; i += 3) {
        ctx.fillRect(x + i, y + 3, 1, 1);
      }
    }

    // Dirt base
    ctx.fillStyle = COLORS.GROUND_FILL;
    const dirtTop = hasCoverAbove ? y : y + 4;
    ctx.fillRect(x, dirtTop, TILE_SIZE, TILE_SIZE - (dirtTop - y));

    // Dirt speckles
    ctx.fillStyle = COLORS.GROUND_DARK;
    const baseY = hasCoverAbove ? y + 2 : y + 6;
    ctx.fillRect(x + 2, baseY, 2, 2);
    ctx.fillRect(x + 10, baseY + 4, 2, 2);
    ctx.fillRect(x + 6, baseY + 8, 2, 2);
    ctx.fillRect(x + 12, baseY + 10, 1, 1);

    // Soil layers for texture
    ctx.fillStyle = '#6a4b2a';
    ctx.fillRect(x + 1, baseY + 2, TILE_SIZE - 2, 1);
    ctx.fillRect(x + 2, baseY + 7, TILE_SIZE - 4, 1);
  }

  private drawBrickTile(x: number, y: number): void {
    const ctx = this.offscreenCtx;

    // Fundo do tijolo
    ctx.fillStyle = COLORS.BRICK_MAIN;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Linhas de cimento (horizontais)
    ctx.fillStyle = COLORS.BRICK_DARK;
    ctx.fillRect(x, y + 7, TILE_SIZE, 2);

    // Linhas verticais alternadas
    ctx.fillRect(x + 7, y, 2, 7);
    ctx.fillRect(x + 3, y + 9, 2, 7);
    ctx.fillRect(x + 11, y + 9, 2, 7);

    // Brilho
    ctx.fillStyle = COLORS.BRICK_LIGHT;
    ctx.fillRect(x + 1, y + 1, 5, 2);
    ctx.fillRect(x + 9, y + 1, 5, 2);
    ctx.fillRect(x + 1, y + 10, 3, 1);
    ctx.fillRect(x + 6, y + 10, 3, 1);
    ctx.fillRect(x + 11, y + 10, 3, 1);
  }

  private drawBreakableBrick(x: number, y: number): void {
    // Visual similar ao tijolo, com racha
    const ctx = this.offscreenCtx;
    this.drawBrickTile(x, y);

    ctx.strokeStyle = COLORS.BRICK_DARK;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x + 4, y + 4);
    ctx.lineTo(x + 8, y + 8);
    ctx.lineTo(x + 12, y + 5);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x + 6, y + 10);
    ctx.lineTo(x + 10, y + 6);
    ctx.stroke();
  }

  private drawPowerupBlock(x: number, y: number, type: number): void {
    const ctx = this.offscreenCtx;
    ctx.fillStyle = COLORS.BRICK_MAIN;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Desenha ponto de interrogação / ícone
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x + 4, y + 4, 8, 8);

    ctx.fillStyle = '#000000';
    ctx.font = '10px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(type === TileType.POWERUP_BLOCK_COFFEE ? 'F' : 'H', x + TILE_SIZE / 2, y + TILE_SIZE / 2 + 3);
  }

  private drawUsedBlock(x: number, y: number): void {
    const ctx = this.offscreenCtx;
    ctx.fillStyle = COLORS.BRICK_DARK;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);
    ctx.fillStyle = '#555555';
    ctx.fillRect(x + 4, y + 4, TILE_SIZE - 8, TILE_SIZE - 8);
  }

  private drawPlatformTile(x: number, y: number): void {
    const ctx = this.offscreenCtx;

    // Plataforma fina no topo
    ctx.fillStyle = COLORS.BRICK_MAIN;
    ctx.fillRect(x, y, TILE_SIZE, 6);

    ctx.fillStyle = COLORS.BRICK_LIGHT;
    ctx.fillRect(x, y, TILE_SIZE, 2);

    ctx.fillStyle = COLORS.BRICK_DARK;
    ctx.fillRect(x, y + 5, TILE_SIZE, 1);
  }

  private drawSpikeTile(x: number, y: number): void {
    const ctx = this.offscreenCtx;

    const spikeDark = '#595959';
    const spikeLight = '#c6c6c6';
    const spikeMid = COLORS.SPIKE;

    // Base metalica baixa
    const baseH = 3;
    const baseY = y + TILE_SIZE - baseH;
    ctx.fillStyle = spikeDark;
    ctx.fillRect(x, baseY, TILE_SIZE, baseH);
    ctx.fillStyle = spikeLight;
    ctx.fillRect(x, baseY, TILE_SIZE, 1);

    // Espinhos pixelados (mais textura e contraste)
    const spikeWidth = 5;
    const spikeCount = 3;
    const spikeHeight = 7;
    const tipY = baseY - spikeHeight;
    for (let i = 0; i < spikeCount; i++) {
      const sx = x + i * spikeWidth;
      const center = sx + 2;

      // Contorno em degraus
      ctx.fillStyle = spikeDark;
      ctx.fillRect(center - 2, baseY - 1, 5, 1);
      ctx.fillRect(center - 1, baseY - 2, 3, 1);
      ctx.fillRect(center - 1, baseY - 3, 3, 1);
      ctx.fillRect(center, baseY - 4, 1, 1);
      ctx.fillRect(center, baseY - 5, 1, 1);
      ctx.fillRect(center, tipY, 1, 1);

      // Corpo
      ctx.fillStyle = spikeMid;
      ctx.fillRect(center - 1, baseY - 1, 3, 1);
      ctx.fillRect(center, baseY - 2, 1, 3);

      // Brilho principal
      ctx.fillStyle = spikeLight;
      ctx.fillRect(center - 1, baseY - 1, 1, 1);
      ctx.fillRect(center, baseY - 3, 1, 1);

      // Micro-riscos para textura
      ctx.fillStyle = '#9a9a9a';
      ctx.fillRect(center + 1, baseY - 2, 1, 1);
      ctx.fillRect(center - 1, baseY - 4, 1, 1);
    }

    // Rebites na base para dar textura metalica
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(x + 2, baseY + 1, 1, 1);
    ctx.fillRect(x + 7, baseY + 1, 1, 1);
    ctx.fillRect(x + 12, baseY + 1, 1, 1);
  }

  private drawSpringTile(x: number, y: number): void {
    const ctx = this.offscreenCtx;

    const t = Date.now() / 260;
    const pulse = 0.5 + 0.5 * Math.sin(t);

    // Base plate (anchored to ground)
    const baseY = y + 12;
    ctx.fillStyle = '#666666';
    ctx.fillRect(x + 2, baseY, TILE_SIZE - 4, 3);
    ctx.fillStyle = '#8e8e8e';
    ctx.fillRect(x + 3, baseY, TILE_SIZE - 6, 1);
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x + 2, baseY + 2, TILE_SIZE - 4, 1);
    ctx.fillStyle = '#3b3b3b';
    ctx.fillRect(x + 4, baseY + 1, 1, 1);
    ctx.fillRect(x + 11, baseY + 1, 1, 1);

    // Top plate
    const plateY = y + 4;
    ctx.fillStyle = '#8c8c8c';
    ctx.fillRect(x + 3, plateY, TILE_SIZE - 6, 3);
    ctx.fillStyle = '#bdbdbd';
    ctx.fillRect(x + 4, plateY, TILE_SIZE - 8, 1);
    ctx.fillStyle = '#6a6a6a';
    ctx.fillRect(x + 3, plateY + 2, TILE_SIZE - 6, 1);
    ctx.fillStyle = '#5c5c5c';
    ctx.fillRect(x + 3, plateY + 1, 1, 1);
    ctx.fillRect(x + 12, plateY + 1, 1, 1);

    // Energy strip + LED
    ctx.fillStyle = '#c98a2e';
    ctx.fillRect(x + 5, plateY + 1, TILE_SIZE - 10, 1);
    ctx.save();
    ctx.globalAlpha = 0.2 + 0.6 * pulse;
    ctx.fillStyle = '#ffd9a0';
    ctx.fillRect(x + 5, plateY + 1, TILE_SIZE - 10, 1);
    ctx.fillRect(x + 11, plateY + 1, 1, 1);
    ctx.restore();

    // X mechanism (scissor), centered
    const mechTop = y + 6;
    const mechLeft = x + 4;
    const mechRight = x + 11;
    ctx.fillStyle = '#2f2f2f';
    for (let i = 0; i < 6; i++) {
      const py = mechTop + i;
      ctx.fillRect(mechLeft + i, py, 1, 1);
      ctx.fillRect(mechRight - i, py, 1, 1);
    }
    ctx.fillStyle = '#4a4a4a';
    ctx.fillRect(x + 5, y + 7, 1, 1);
    ctx.fillRect(x + 10, y + 7, 1, 1);

    // Center hinge
    ctx.fillStyle = '#1c1c1c';
    ctx.fillRect(x + 7, y + 9, 2, 2);
  }

  private drawIceTile(x: number, y: number): void {
    const ctx = this.offscreenCtx;

    ctx.fillStyle = COLORS.ICE_LIGHT;
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Highlights
    ctx.fillStyle = '#e6f7ff';
    ctx.fillRect(x + 1, y + 1, TILE_SIZE - 2, 2);
    ctx.fillRect(x + 2, y + 4, 3, 1);
    ctx.fillRect(x + 10, y + 6, 3, 1);

    // Cracks
    ctx.fillStyle = COLORS.ICE_DARK;
    ctx.fillRect(x + 3, y + 8, 4, 1);
    ctx.fillRect(x + 7, y + 9, 2, 1);
    ctx.fillRect(x + 9, y + 11, 3, 1);
  }

  private drawFallingPlatformTile(x: number, y: number): void {
    const ctx = this.offscreenCtx;

    // Base plank
    ctx.fillStyle = COLORS.BRICK_MAIN;
    ctx.fillRect(x, y, TILE_SIZE, 6);
    ctx.fillStyle = COLORS.BRICK_LIGHT;
    ctx.fillRect(x, y, TILE_SIZE, 2);
    ctx.fillStyle = COLORS.BRICK_DARK;
    ctx.fillRect(x, y + 5, TILE_SIZE, 1);

    // Cracks
    ctx.fillStyle = COLORS.BRICK_DARK;
    ctx.fillRect(x + 3, y + 2, 2, 1);
    ctx.fillRect(x + 7, y + 3, 3, 1);
    ctx.fillRect(x + 12, y + 1, 2, 1);
  }

  private drawLavaTopTile(x: number, y: number, tiles: number[][], row: number, col: number): void {
    const ctx = this.offscreenCtx;

    // Lógica visual deve bater com a física: Offset apenas se houver AR em cima
    const hasLavaAbove = row > 0 && (tiles[row - 1][col] === TileType.LAVA_TOP || tiles[row - 1][col] === TileType.LAVA_FILL);
    const hasAirAbove = row > 0 && tiles[row - 1][col] === TileType.EMPTY;

    // Se tem lava em cima, conecta (offset 0). Se tem AR, faz o "gap" (offset 4). Caso contrario (chao em cima), enche tudo (offset 0).
    const offset = (!hasLavaAbove && hasAirAbove) ? Math.floor(TILE_SIZE / 4) : 0;

    const lavaY = y + offset;
    const lavaH = TILE_SIZE - offset;
    const time = Date.now();

    // Even slower animation (Ultra viscous)
    const slowTime = time * 0.0005;

    // Use WORLD X for texture generation to prevent "swimming" when camera moves
    const worldX = col * TILE_SIZE;

    // Base fill - Darker richer orange/red base
    ctx.fillStyle = '#cf2f0f';
    ctx.fillRect(x, lavaY, TILE_SIZE, lavaH);

    // Surface Wave - Slower, smoother, more amplitude
    const surfaceY = lavaY;
    ctx.beginPath();
    ctx.moveTo(x, surfaceY + 2);

    // Wave parameters
    const waveFreq = 0.2;
    const waveAmp = 1.8;
    const waveSpeed = 1.5; // Reduced speed

    for (let i = 0; i <= TILE_SIZE; i += 2) {
      // Use (worldX + i) to anchor wave to world position
      const wave = Math.sin((worldX + i) * waveFreq + slowTime * waveSpeed) * waveAmp;
      ctx.lineTo(x + i, surfaceY + 2 + wave);
    }

    ctx.lineTo(x + TILE_SIZE, surfaceY + 5);
    ctx.lineTo(x + TILE_SIZE, surfaceY);
    ctx.lineTo(x, surfaceY);
    ctx.fill();

    // Surface Glow / Crust (Top Layer)
    // Brighter orange "foam" on top
    ctx.fillStyle = '#ff9020';
    ctx.beginPath();
    ctx.moveTo(x, surfaceY + 2);
    for (let i = 0; i <= TILE_SIZE; i += 2) {
      // Slightly different phase for top color
      const wave = Math.sin((worldX + i) * waveFreq + slowTime * waveSpeed) * waveAmp;
      ctx.lineTo(x + i, surfaceY + 2 + wave);
    }
    ctx.lineTo(x + TILE_SIZE, surfaceY + 5);
    ctx.lineTo(x + TILE_SIZE, surfaceY + 2); // Thin strip
    ctx.lineTo(x, surfaceY + 2);
    ctx.fill();

    // Heat currents (Slow flowing veins)
    // Anchored to row/worldX
    const bandY = Math.sin(slowTime * 0.5 + row * 1.5) * 1.5;
    ctx.fillStyle = '#a01000'; // Darker vein
    ctx.fillRect(x, lavaY + 7 + bandY, TILE_SIZE, 3);

    // Occasional bright magma pocket (very slow pulse)
    const pulse = (Math.sin(slowTime * 1.5 + worldX) + 1) / 2; // 0..1
    if (pulse > 0.8) {
      ctx.fillStyle = `rgba(255, 200, 50, ${(pulse - 0.8) * 5})`; // Sharp peak
      // Visual position fixed relative to tile
      ctx.fillRect(x + 5, lavaY + 8 + bandY, 6, 2);
    }

    // Bubbles (Viscous, slow rising)
    // Seed uses world position (row/col)
    const bubbleSeed = col * 13 + row * 7;
    const bubbleCount = 2; // Fewer bubbles for viscous look

    for (let i = 0; i < bubbleCount; i++) {
      // Very slow speed
      const speed = 0.1 + ((bubbleSeed + i) % 3) * 0.05;
      // Y position derived from time but anchored to height
      const bY = (slowTime * speed * 20 + i * 40) % (lavaH + 5);

      // Bubbles wobble slightly
      const wobble = Math.sin(slowTime * 3 + i) * 1.5;
      // X position anchored to tile
      const bX = (bubbleSeed + i * 5 + wobble) % (TILE_SIZE - 2);
      const validBx = Math.abs(bX);

      const drawY = lavaY + lavaH - bY;

      if (drawY > lavaY && drawY < lavaY + lavaH) {
        // Main bubble
        ctx.fillStyle = '#ffba50';
        ctx.fillRect(x + validBx, drawY, 2, 2);

        // Highlight
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + validBx, drawY, 1, 1);
      }
    }
  }

  private drawLavaFillTile(x: number, y: number, row: number, col: number): void {
    const ctx = this.offscreenCtx;
    const time = Date.now();
    const slowTime = time * 0.0005;

    // Use WORLD coordinates
    const worldX = col * TILE_SIZE;
    const worldY = row * TILE_SIZE;

    ctx.fillStyle = '#cf2f0f';
    ctx.fillRect(x, y, TILE_SIZE, TILE_SIZE);

    // Slow moving crust/currents - Anchored to worldY
    // Current 1
    const offset1 = Math.sin(slowTime * 0.7 + worldY * 0.1) * 2;
    ctx.fillStyle = '#a01000';
    ctx.fillRect(x, y + 4 + offset1, TILE_SIZE, 3);

    // Current 2 (Counter movement)
    const offset2 = Math.cos(slowTime * 0.5 + worldY * 0.15) * 2;
    ctx.fillRect(x, y + 10 + offset2, TILE_SIZE, 2);

    // Glowing magma blobs (Lava lamp style)
    // Anchored to worldX/worldY
    const blobPulse = (Math.sin(slowTime * 3 + worldX) + 1) / 2;

    ctx.fillStyle = `rgba(255, 100, 0, ${0.3 + blobPulse * 0.2})`;
    ctx.beginPath();
    // Center blob relative to tile center
    ctx.arc(x + 8, y + 8, 4 + blobPulse, 0, Math.PI * 2);
    ctx.fill();

    // Hot specs - Rare sparkle based on world pos
    ctx.fillStyle = '#ffcf6b';
    if (((time + worldX + worldY) % 2000) < 50) {
      ctx.fillRect(x + 3 + offset1, y + 5 + offset1, 1, 1);
    }
  }

  private drawFlagTile(x: number, y: number): void {
    const ctx = this.offscreenCtx;

    // Ancorar o mastro na base do tile e usar altura fixa para evitar mastros desproporcionais
    const mastBottom = y + TILE_SIZE - 2; // base ligeiramente acima da base do tile
    const mastHeight = TILE_SIZE - 4; // altura do mastro (ex.: 12 px)
    const mastTop = mastBottom - mastHeight;

    // Mastro
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(x + 7, mastTop, 2, mastHeight);

    // Bandeira (posicionada perto do topo do mastro)
    ctx.fillStyle = COLORS.CHECKPOINT_FLAG;
    ctx.beginPath();
    ctx.moveTo(x + 9, mastTop + 1);
    ctx.lineTo(x + 16, mastTop + 4);
    ctx.lineTo(x + 9, mastTop + 7);
    ctx.fill();
  }

  // === RENDERIZAÇÃO DO PLAYER (FEKA) ===

  drawPlayer(player: PlayerData, camera: CameraData): void {
    const ctx = this.offscreenCtx;
    const cam = this.snapCamera(camera);
    let x = Math.round(player.position.x - cam.x);
    let y = Math.round(player.position.y - cam.y);
    const isDead = player.isDead;

    if (isDead) {
      const max = player.deathTimerMax || 1;
      const t = Math.max(0, Math.min(1, player.deathTimer / max));
      const rise = Math.round((1 - t) * 8);
      ctx.save();
      ctx.globalAlpha = Math.max(0, t);
      // Use jump sprite for death (falling/fly up) - white silhouette
      ctx.save();
      // Spirit fading effect using composition or simplified
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
      this.drawPixelArt(ctx, PLAYER_SPRITES.jump, x, y - rise, PLAYER_PIXEL_SIZE, player.facingRight);
      ctx.restore();
      ctx.restore();
      return;
    }

    // Efeito de invencibilidade (pisca)
    const isInvincibleVisible = player.invincibleTimer > 0 && Math.floor(player.invincibleTimer / 50) % 2 === 0;
    if (isInvincibleVisible) {
      ctx.save();
      ctx.globalAlpha = 0.5;
    }

    // Efeito de Mini Fanta (Fizz & Trail)
    if (player.coffeeTimer > 0) {
      ctx.save();
      const now = Date.now();

      // Partículas rising (fizz) com rastro
      // Mais partículas (8), ciclo mais longo para não acabar rápido
      const particleCount = 8;

      for (let i = 0; i < particleCount; i++) {
        const offset = i * 987; // Random seed
        const cycle = 1200 + (i * 300); // 1.2s a 2.5s (mais lentas/duradouras)
        const t = (now + offset) % cycle / cycle; // 0.0 -> 1.0

        // Fade in/out: entra rápido, sai suave
        const alpha = t < 0.1 ? t * 10 : (t > 0.6 ? (1 - t) * 2.5 : 1);

        // Simulação de rastro: desloca partículas "velhas" na direção oposta ao movimento
        // Se t=1 (velha), desloca mais.
        const trailX = (player.velocity.x || 0) * (t * 30); // ~30px de lag máximo

        // Posição:
        // X: Spread na largura do player - trail
        const xSpread = ((offset % 100) / 100) * player.width;
        const xPos = (x + xSpread) - trailX;

        // Y: Sobe acima da cabeça (mais alto agora)
        const yPos = (y + player.height) - (t * (player.height * 2.0));

        // Cores vibrantes mas translúcidas
        ctx.fillStyle = i % 2 === 0
          ? `rgba(255, 180, 50, ${alpha * 0.7})`  // Laranja claro
          : `rgba(255, 140, 0, ${alpha * 0.7})`;  // Laranja Fanta

        // Pixel particles (variando levemente tamanho)
        const size = (i % 3 === 0) ? 3 : 2;
        ctx.fillRect(Math.round(xPos), Math.round(yPos), size, size);
      }
      ctx.restore();
    }

    // Determine Sprite State
    let currentSprite = PLAYER_SPRITES.idle;

    // Check states in order of priority
    if (player.groundPoundState !== GroundPoundState.NONE) {
      // During ground pound (any phase), use sit sprite
      currentSprite = PLAYER_SPRITES.sit;
    } else if (!player.isGrounded) {
      currentSprite = PLAYER_SPRITES.jump;
    } else if (Math.abs(player.velocity.x) > 0.1) {
      // Walking/Running
      // Speed multiplier for animation
      const animSpeed = Math.abs(player.velocity.x) > 3 ? 50 : 100;
      const frame = Math.floor(player.animationTimer / animSpeed) % 2;
      currentSprite = frame === 0 ? PLAYER_SPRITES.walk1 : PLAYER_SPRITES.walk2;
    } else {
      currentSprite = PLAYER_SPRITES.idle;
    }

    // Draw the selected sprite
    // Center logic: Sprite is roughly 8*2=16 wide. Player width=14.
    // Center X: x + (player.width - spriteWidth)/2 = x - 1
    // Align Bottom: Sprite height ~13*2 = 26. Player height=24.
    // y + (player.height - spriteHeight) = y - 2

    let yOffset = PLAYER_RENDER_OFFSET_Y;
    let xOffset = PLAYER_RENDER_OFFSET_X;
    const pixelSize = PLAYER_PIXEL_SIZE; // Each char is 2x2 logical pixels (matches TILE_SIZE=16 for 8-char width)

    if (currentSprite === PLAYER_SPRITES.sit) {
      yOffset += 2; // Sit sprite looks better slightly lower or adjusted
    }

    this.drawPixelArt(
      ctx,
      currentSprite,
      Math.round(x + xOffset),
      Math.round(y + yOffset),
      pixelSize,
      player.facingRight
    );

    if (player.hasHelmet && !player.isDead) {
      // Draw pixel art helmet on top
      // Shift up by 3 "pixels" (1 row extra for 4-row height) to sit nicely on head
      this.drawPixelArt(
        ctx,
        PLAYER_SPRITES.helmet,
        Math.round(x + xOffset),
        Math.round(y + yOffset - 3),
        pixelSize,
        player.facingRight
      );
    }

    if (isInvincibleVisible) {
      ctx.restore();
    }
  }

  private drawPixelArt(ctx: CanvasRenderingContext2D, artMatrix: string[], x: number, y: number, size: number, facingRight: boolean) {
    ctx.save();

    // Inverte o canvas horizontalmente se olhar para a esquerda
    if (!facingRight) {
      const width = 8 * size;
      ctx.translate(x + width, y);
      ctx.scale(-1, 1);
      ctx.translate(-x, -y);
    }

    for (let row = 0; row < artMatrix.length; row++) {
      for (let col = 0; col < artMatrix[row].length; col++) {
        const char = artMatrix[row][col];
        const color = PLAYER_PALETTE[char];
        if (color) {
          ctx.fillStyle = color;
          ctx.fillRect(x + col * size, y + row * size, size, size);
        }
      }
    }
    ctx.restore();
  }

  // === RENDERIZAÇÃO DE INIMIGOS ===

  drawEnemy(enemy: EnemyData, camera: CameraData): void {
    if (!enemy.active) return;
    const cam = this.snapCamera(camera);
    const x = Math.round(enemy.position.x - cam.x);
    const y = Math.round(enemy.position.y - cam.y);

    if (enemy.type === EnemyType.MINION) {
      this.drawMinion(enemy, x, y);
    } else if (enemy.type === EnemyType.JOAOZAO) {
      this.drawJoaozao(enemy, x, y);
    }
  }

  private drawMinion(enemy: EnemyData, x: number, y: number): void {
    const ctx = this.offscreenCtx;

    // Se está morrendo, fica achatado
    if (enemy.isDead) {
      ctx.fillStyle = COLORS.ENEMY_BODY;
      ctx.fillRect(x, y + enemy.height - 4, enemy.width, 4);
      return;
    }

    ctx.save();

    if (!enemy.facingRight) {
      ctx.translate(x + enemy.width, y);
      ctx.scale(-1, 1);
      ctx.translate(-x, -y);
    }

    // Corpo redondo (vermelho escuro)
    ctx.fillStyle = COLORS.ENEMY_BODY;
    ctx.beginPath();
    ctx.arc(x + 8, y + 10, 8, 0, Math.PI * 2);
    ctx.fill();

    // Face
    ctx.fillStyle = COLORS.ENEMY_FACE;
    ctx.beginPath();
    ctx.arc(x + 8, y + 8, 5, 0, Math.PI * 2);
    ctx.fill();

    // Olhos bravos
    ctx.fillStyle = '#000000';
    ctx.fillRect(x + 5, y + 6, 2, 3);
    ctx.fillRect(x + 9, y + 6, 2, 3);

    // Sobrancelhas (bravos)
    ctx.fillRect(x + 4, y + 5, 3, 1);
    ctx.fillRect(x + 9, y + 5, 3, 1);

    // Pés
    ctx.fillStyle = '#333333';
    const footOffset = Math.sin(enemy.animationTimer * 0.2) * 2;
    ctx.fillRect(x + 2 - footOffset, y + 16, 4, 3);
    ctx.fillRect(x + 10 + footOffset, y + 16, 4, 3);

    ctx.restore();
  }

  private drawJoaozao(enemy: EnemyData, x: number, y: number): void {
    const ctx = this.offscreenCtx;

    // Rotação da morte (se presente) ou 0
    const rotation = enemy.deadRotation || 0;

    ctx.save();

    // --- ANIMAÇÃO DE MORTE (Rotação e Fade) ---
    if (enemy.isDead) {
      // Fade out só no finalzinho
      const fadeStart = 1000;
      if (enemy.deathTimer < fadeStart) {
        ctx.globalAlpha = Math.max(0, enemy.deathTimer / fadeStart);
      }

      // Centraliza o pivot para rotacionar
      const centerX = x + enemy.width / 2;
      const centerY = y + enemy.height / 2;
      ctx.translate(centerX, centerY);
      ctx.rotate(rotation); // Gira o boneco (cai para trás)
      ctx.translate(-centerX, -centerY);
    }

    // Inverte o canvas horizontalmente se olhar para a esquerda
    // (Aplica depois da rotação de morte para não bugar o eixo)
    if (!enemy.facingRight) {
      ctx.translate(x + enemy.width, y);
      ctx.scale(-1, 1);
      ctx.translate(-x, -y);
    }

    // --- LÓGICA DE FRAMES ---
    let bodyY = y;
    let armY = y + 14;
    let armHeight = 12;
    let isHurt = false;

    if (enemy.animationFrame === 1) { // Preparação
      bodyY = y - 2;
      armY = y - 6;
      armHeight = 18;
    } else if (enemy.animationFrame === 2) { // Smash
      bodyY = y + 2;
      armY = y + 20;
      armHeight = 8;
    } else if (enemy.animationFrame === 3) { // ** NOVO FRAME: DANO **
      isHurt = true;
      bodyY = y + 1; // Corpo levemente recuado
      // Braços flailing (um pra cima, um pra baixo)
      armY = y + 10;
    }

    // Efeito de piscar branco quando toma dano (flash damage)
    const flashWhite = isHurt && Math.floor(Date.now() / 50) % 2 === 0;
    const skinColor = flashWhite ? '#FFFFFF' : COLORS.JOAOZAO_SKIN;
    const shirtColor = flashWhite ? '#FFFFFF' : COLORS.JOAOZAO_SHIRT;
    const pantsColor = flashWhite ? '#FFFFFF' : COLORS.JOAOZAO_PANTS;

    // --- CORPO ---
    ctx.fillStyle = skinColor;
    ctx.fillRect(x + 4, bodyY + 12, 24, 20);

    ctx.fillStyle = shirtColor;
    ctx.fillRect(x + 6, bodyY + 14, 20, 14);

    ctx.fillStyle = pantsColor;
    ctx.fillRect(x + 6, bodyY + 28, 8, 10);
    ctx.fillRect(x + 18, bodyY + 28, 8, 10);

    // Sapatos
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(x + 4, y + 36, 10, 4);
    ctx.fillRect(x + 18, y + 36, 10, 4);

    // --- CABEÇA ---
    ctx.fillStyle = skinColor;
    ctx.fillRect(x + 4, bodyY, 24, 14);

    // Cabelo
    ctx.fillStyle = COLORS.JOAOZAO_HAIR;
    ctx.fillRect(x + 4, bodyY, 24, 4);
    ctx.fillRect(x + 4, bodyY + 4, 4, 3);
    ctx.fillRect(x + 24, bodyY + 4, 4, 3);

    // --- ROSTO (Expressões) ---
    if (isHurt) {
      // ** Expressão de Dor **

      // Olhos fechados com força (> <) ou linhas
      ctx.fillStyle = '#000000';
      // Olho esquerdo (fechado >)
      ctx.beginPath();
      ctx.moveTo(x + 8, bodyY + 5);
      ctx.lineTo(x + 12, bodyY + 7);
      ctx.lineTo(x + 8, bodyY + 9);
      ctx.stroke();

      // Olho direito (fechado <)
      ctx.beginPath();
      ctx.moveTo(x + 22, bodyY + 5);
      ctx.lineTo(x + 18, bodyY + 7);
      ctx.lineTo(x + 22, bodyY + 9);
      ctx.stroke();

      // Boca aberta gritando ('O' comprido)
      // Combina com as falas de hit_react ("Porra nenhuma", "Para de encher...")
      ctx.fillStyle = '#000000';
      ctx.fillRect(x + 10, bodyY + 10, 10, 6);
      ctx.fillStyle = '#FF0000'; // Língua/garganta
      ctx.fillRect(x + 12, bodyY + 13, 6, 3);

    } else {
      // ** Expressão Normal/Ataque **
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x + 8, bodyY + 5, 6, 5);
      ctx.fillRect(x + 18, bodyY + 5, 6, 5);

      ctx.fillStyle = '#FF0000'; // Pupilas
      ctx.fillRect(x + 10, bodyY + 6, 3, 3);
      ctx.fillRect(x + 20, bodyY + 6, 3, 3);

      ctx.fillStyle = '#000000'; // Boca
      if (enemy.animationFrame === 1) {
        ctx.fillRect(x + 10, bodyY + 11, 12, 4); // Gritando/Esforço
      } else {
        ctx.fillRect(x + 10, bodyY + 11, 12, 2); // Sorriso
        ctx.fillRect(x + 8, bodyY + 10, 2, 2);
        ctx.fillRect(x + 22, bodyY + 10, 2, 2);
      }
    }

    // --- BRAÇOS ---
    ctx.fillStyle = skinColor;
    if (isHurt) {
      // Braços jogados para o lado/cima em dor
      ctx.fillRect(x - 2, bodyY + 10, 6, 10); // Esq levantado/aberto
      ctx.fillRect(x + 28, bodyY + 14, 6, 10); // Dir caído
    } else {
      ctx.fillRect(x, armY, 6, armHeight);
      ctx.fillRect(x + 26, armY, 6, armHeight);
    }

    ctx.restore();
    ctx.globalAlpha = 1;
  }


  drawSpeechBubble(bubble: SpeechBubbleRenderState, camera: CameraData): void {
    const cam = this.snapCamera(camera);
    const x = Math.round(bubble.position.x - cam.x);
    const y = Math.round(bubble.position.y - cam.y);
    this.drawSpeechBubbleAt(bubble.text, x, y, bubble.alpha);
  }

  private drawSpeechBubbleAt(text: string, x: number, y: number, alpha: number): void {
    const ctx = this.offscreenCtx;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
    ctx.font = '8px monospace';
    const metrics = ctx.measureText(text);
    const padding = 4;
    const width = metrics.width + padding * 2;
    const height = 12;

    // Bal?o
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x - width / 2, y - height, width, height);

    // Borda
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x - width / 2, y - height, width, height);

    // Pontinha do bal?o
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.moveTo(x - 3, y);
    ctx.lineTo(x, y + 4);
    ctx.lineTo(x + 3, y);
    ctx.fill();

    // Texto
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.fillText(text, x, y - 4);
    ctx.restore();
  }

  // === RENDERIZAÇÃO DE COLETÁVEIS ===

  drawCollectible(collectible: CollectibleData, camera: CameraData): void {
    if (!collectible.active || collectible.collected) return;
    const cam = this.snapCamera(camera);
    const x = Math.round(collectible.position.x - cam.x);
    const y = Math.round(collectible.position.y - cam.y);

    switch (collectible.type) {
      case CollectibleType.COIN:
        this.drawCoin(x, y, collectible.animationTimer);
        break;
      case CollectibleType.COFFEE:
        this.drawFanta(x, y, collectible.animationTimer);
        break;
      case CollectibleType.HELMET:
        this.drawHelmet(x, y);
        break;
    }
  }

  private drawCoin(x: number, y: number, animTimer: number): void {
    const ctx = this.offscreenCtx;

    // Animação de rotação (estilo Mario)
    const rotationSpeed = 0.15;
    const widthFactor = Math.abs(Math.cos(animTimer * rotationSpeed));

    // Centro e dimensões
    const centerX = x + 8;
    const centerY = y + 8;
    const maxRadiusX = 6;
    const radiusY = 7;

    const currentRadiusX = Math.max(0.5, maxRadiusX * widthFactor);

    // Sombra simples no chão (opcional, mas dá profundidade)
    // ctx.fillStyle = 'rgba(0,0,0,0.2)';
    // ctx.beginPath();
    // ctx.ellipse(centerX, centerY + 8, currentRadiusX, 2, 0, 0, Math.PI * 2);
    // ctx.fill();

    // 1. Corpo da moeda
    ctx.fillStyle = COLORS.COIN_GOLD;
    ctx.beginPath();
    ctx.ellipse(centerX, centerY, currentRadiusX, radiusY, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Borda dourada escura
    ctx.strokeStyle = '#B8860B'; // Dark Goldenrod
    ctx.lineWidth = 1;
    ctx.stroke();

    // 3. Detalhes internos (só visíveis quando a moeda está de frente)
    if (currentRadiusX > 3) {
      // Brilho/Relevo interno
      ctx.fillStyle = COLORS.COIN_SHINE; // Cor clara
      ctx.beginPath();
      ctx.ellipse(centerX, centerY, currentRadiusX * 0.65, radiusY * 0.75, 0, 0, Math.PI * 2);
      ctx.fill();

      // Slot vertical central (característico)
      ctx.fillStyle = '#B8860B';
      const slotWidth = Math.max(1, 2 * widthFactor);
      ctx.fillRect(centerX - slotWidth / 2, centerY - 4, slotWidth, 8);
    }

    // 4. Brilho especular (reflexo de luz)
    if (widthFactor > 0.8) {
      ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
      ctx.beginPath();
      ctx.ellipse(centerX - 2, centerY - 3, 1.5, 2.5, Math.PI / 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  private drawFanta(x: number, y: number, animTimer: number = 0): void {
    const ctx = this.offscreenCtx;

    // Lata de Fanta (cilindro laranja)
    // Corpo
    ctx.fillStyle = '#FF8C00'; // Dark Orange
    ctx.fillRect(x + 4, y + 4, 8, 10);

    // Topo e Fundo (perspectiva)
    ctx.fillStyle = '#FFA500'; // Orange
    ctx.fillRect(x + 4, y + 4, 8, 2); // Topo
    ctx.fillRect(x + 4, y + 12, 8, 2); // Fundo

    // Rótulo / Detalhe
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x + 4, y + 7, 8, 3);

    // Logo "F" (simplificado, pontos azuis)
    ctx.fillStyle = '#0000FF';
    ctx.fillRect(x + 6, y + 8, 1, 1);
    ctx.fillRect(x + 8, y + 8, 1, 1);
    ctx.fillRect(x + 7, y + 9, 2, 1); // Sorriso/Curva do logo

    // Lacre/Anel lata
    ctx.fillStyle = '#C0C0C0';
    ctx.fillRect(x + 6, y + 3, 4, 1);

    // Efeito de bolhas subindo (Fanta)
    const time = animTimer / 12;
    const bubbleY = y + 2 - (Math.floor(time) % 4);
    if (bubbleY < y + 2) {
      ctx.fillStyle = 'rgba(255, 165, 0, 0.8)';
      ctx.fillRect(x + 6 + (Math.floor(time) % 2) * 4, bubbleY, 1, 1);
    }
  }

  private drawHelmet(x: number, y: number): void {
    const ctx = this.offscreenCtx;

    // Capacete dourado
    ctx.fillStyle = '#FFD700';
    ctx.beginPath();
    ctx.arc(x + 8, y + 10, 7, Math.PI, 0);
    ctx.fill();

    // Aba
    ctx.fillRect(x + 1, y + 10, 14, 3);

    // Brilho
    ctx.fillStyle = '#FFF8DC';
    ctx.beginPath();
    ctx.arc(x + 5, y + 7, 2, 0, Math.PI * 2);
    ctx.fill();

    // Estrela no centro
    ctx.fillStyle = '#FF0000';
    ctx.beginPath();
    ctx.arc(x + 8, y + 8, 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // === FOGOS DE ARTIFÍCIO ===
  public drawFireworks(fireworks: Firework[], cameraX: number = 0, cameraY: number = 0): void {
    if (fireworks.length === 0) return; // Early exit for performance

    const ctx = this.offscreenCtx;

    fireworks.forEach((fw) => {
      // Ajusta posição pela câmera
      const drawX = Math.round(fw.x - cameraX);
      const drawY = Math.round(fw.y - cameraY);

      if (fw.phase === 'ROCKET') {
        // Desenha o foguete subindo (ponto brilhante + rastro)
        ctx.fillStyle = fw.color;
        ctx.fillRect(drawX, drawY, 2, 2);

        // Rastro simples
        ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.fillRect(drawX, drawY + 2, 2, 4);
      }
      else if (fw.phase === 'EXPLODED') {
        // Desenha as partículas da explosão
        fw.particles.forEach(p => {
          const px = Math.round(p.position.x - cameraX);
          const py = Math.round(p.position.y - cameraY);

          // Alpha baseado na vida restante
          const alpha = p.life / p.maxLife;

          ctx.save();
          ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
          ctx.fillStyle = p.color;
          // Partículas piscam no final
          if (p.life < 100 && Math.floor(p.life / 10) % 2 === 0) {
            ctx.fillStyle = '#FFFFFF';
          }
          ctx.fillRect(px, py, p.size, p.size);
          ctx.restore();
        });
      }
    });
  }

  // Draw fireworks on the main (high-res) canvas scaled by pixelScale
  private drawFireworksOnScreen(fireworks: Firework[], pixelScale: number): void {
    if (!fireworks || fireworks.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.imageSmoothingEnabled = false;

    for (const fw of fireworks) {
      if (fw.phase === 'ROCKET') {
        const dx = Math.round(fw.x * pixelScale);
        const dy = Math.round(fw.y * pixelScale);
        ctx.fillStyle = fw.color;
        ctx.fillRect(dx, dy, Math.max(1, Math.round(2 * pixelScale)), Math.max(1, Math.round(2 * pixelScale)));
        // trail
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.fillRect(dx, dy + Math.max(1, Math.round(2 * pixelScale)), Math.max(1, Math.round(2 * pixelScale)), Math.max(2, Math.round(4 * pixelScale)));
      } else if (fw.phase === 'EXPLODED') {
        for (const p of fw.particles) {
          if (p.life <= 0) continue;
          const px = Math.round(p.position.x * pixelScale);
          const py = Math.round(p.position.y * pixelScale);
          const alpha = Math.max(0, Math.min(1, p.life / p.maxLife));
          ctx.globalAlpha = alpha;
          ctx.fillStyle = p.color;
          if (p.life < 100 && Math.floor(p.life / 10) % 2 === 0) ctx.fillStyle = '#FFFFFF';
          const size = Math.max(1, Math.round(p.size * pixelScale));
          ctx.fillRect(px, py, size, size);
        }
      }
    }

    ctx.globalAlpha = 1;
    ctx.restore();
  }

  // === RENDERIZACAO DE BANDEIRAS (CHECKPOINT / FINAL) ===

  drawFlag(flag: FlagData, camera: CameraData): void {
    const ctx = this.offscreenCtx;
    const cam = this.snapCamera(camera);
    if (!flag.enabled) return;

    const baseX = Math.round(flag.anchor.x - cam.x);
    const baseY = Math.round(flag.anchor.y - cam.y);

    const mastHeight = Math.round(TILE_SIZE * (flag.kind === 'goal' ? 2.0 : 1.6));
    const mastWidth = 3;
    const mastBottom = baseY - 1;
    const mastTop = mastBottom - mastHeight;

    const popDuration = 450;
    let scale = 1;
    if (flag.state === 'activating') {
      const t = Math.min(1, flag.stateTimer / popDuration);
      scale = 1 + 0.25 * Math.sin(t * Math.PI);
    } else if (flag.state === 'clear') {
      scale = 1 + 0.1 * Math.sin(flag.stateTimer * 0.02);
    }

    const waveSpeed = flag.state === 'clear' ? 0.03 : 0.02;
    const waveAmp = flag.state === 'clear' ? 3 : 2;
    const wave = Math.round(Math.sin(flag.stateTimer * waveSpeed) * waveAmp);

    const flagWidth = Math.round(TILE_SIZE * (flag.kind === 'goal' ? 1.2 : 0.9));
    const flagHeight = Math.round(TILE_SIZE * 0.6);
    const flagY = mastTop + Math.round(TILE_SIZE * 0.4);

    ctx.save();
    if (scale !== 1) {
      ctx.translate(baseX, mastBottom);
      ctx.scale(scale, scale);
      ctx.translate(-baseX, -mastBottom);
    }

    // Mastro
    ctx.fillStyle = '#8B4513';
    ctx.fillRect(baseX - Math.floor(mastWidth / 2), mastTop, mastWidth, mastHeight);

    // Bandeira principal
    const color = flag.kind === 'goal'
      ? '#FFD700'
      : (flag.state === 'active' || flag.state === 'activating' ? '#00FF00' : COLORS.CHECKPOINT_FLAG);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(baseX + Math.ceil(mastWidth / 2), flagY);
    ctx.lineTo(baseX + Math.ceil(mastWidth / 2) + flagWidth, flagY + wave);
    ctx.lineTo(baseX + Math.ceil(mastWidth / 2) + flagWidth, flagY + flagHeight + wave);
    ctx.lineTo(baseX + Math.ceil(mastWidth / 2), flagY + flagHeight);
    ctx.closePath();
    ctx.fill();

    // Detalhe de brilho quando ativada
    if (flag.state === 'activating' || flag.state === 'clear') {
      ctx.fillStyle = 'rgba(255,255,255,0.7)';
      ctx.fillRect(baseX + Math.ceil(mastWidth / 2) + 2, flagY + 2, 2, 2);
    }

    // Texto "C" em checkpoint ativo
    if (flag.kind === 'checkpoint' && flag.state === 'active') {
      ctx.fillStyle = '#FFFFFF';
      ctx.font = '6px monospace';
      ctx.fillText('C', baseX + Math.ceil(mastWidth / 2) + 2, flagY + 7);
    }

    ctx.restore();
  }


  // === RENDERIZAÇÃO DE YASMIN ===

  drawYasmin(x: number, y: number): void {
    const ctx = this.offscreenCtx;

    // Cabelo dourado
    ctx.fillStyle = COLORS.YASMIN_HAIR;
    ctx.fillRect(x + 2, y, 12, 10);
    ctx.fillRect(x, y + 3, 4, 12);
    ctx.fillRect(x + 12, y + 3, 4, 12);

    // Rosto
    ctx.fillStyle = COLORS.YASMIN_SKIN;
    ctx.fillRect(x + 4, y + 3, 8, 7);

    // Olhos
    ctx.fillStyle = '#0066CC';
    ctx.fillRect(x + 5, y + 5, 2, 2);
    ctx.fillRect(x + 9, y + 5, 2, 2);

    // Sorriso
    ctx.fillStyle = '#FF6B6B';
    ctx.fillRect(x + 6, y + 8, 4, 1);

    // Vestido rosa
    ctx.fillStyle = COLORS.YASMIN_DRESS;
    ctx.fillRect(x + 2, y + 10, 12, 12);

    // Saia expandida
    ctx.beginPath();
    ctx.moveTo(x, y + 22);
    ctx.lineTo(x + 8, y + 14);
    ctx.lineTo(x + 16, y + 22);
    ctx.fill();

    // Coroa
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x + 4, y - 3, 8, 3);
    ctx.fillRect(x + 5, y - 5, 2, 2);
    ctx.fillRect(x + 9, y - 5, 2, 2);
    ctx.fillRect(x + 7, y - 6, 2, 3);

    // Gema na coroa
    ctx.fillStyle = '#FF69B4';
    ctx.fillRect(x + 7, y - 4, 2, 2);
  }

  // === RENDERIZAÇÃO DE PARTÍCULAS ===

  drawParticles(particles: Particle[]): void {
    const ctx = this.offscreenCtx;

    particles.forEach(p => {
      const alpha = p.life / p.maxLife;
      ctx.fillStyle = p.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(Math.round(p.position.x), Math.round(p.position.y), p.size, p.size);
    });

    ctx.globalAlpha = 1;
  }

  // === RENDERIZAÇÃO DE PROJÉTEIS ===

  drawProjectile(x: number, y: number, radius: number = 4): void {
    const ctx = this.offscreenCtx;

    // Bola de energia roxa
    ctx.fillStyle = '#800080';
    ctx.beginPath();
    ctx.arc(Math.round(x), Math.round(y), radius, 0, Math.PI * 2);
    ctx.fill();

    // Brilho
    ctx.fillStyle = '#DDA0DD';
    ctx.beginPath();
    ctx.arc(Math.round(x) - 1, Math.round(y) - 1, radius / 2, 0, Math.PI * 2);
    ctx.fill();
  }

  // === HUD ===

  drawHUD(score: number, lives: number, time: number, level: string, soundEnabled: boolean, hasHelmet: boolean, coffeeTimer: number): void {
    // Cache HUD for on-screen high-res rendering
    this.lastUIType = 'HUD';
    this.lastUIParams = { score, lives, time, level, soundEnabled, hasHelmet, coffeeTimer };
    const ctx = this.offscreenCtx;

    // Fundo do HUD
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fillRect(0, 0, GAME_WIDTH, 16);

    ctx.font = '8px monospace';
    ctx.textAlign = 'left';

    // Score
    ctx.fillStyle = COLORS.HUD_TEXT;
    ctx.fillText(`SCORE:${score.toString().padStart(6, '0')}`, 4, 11);

    // Vidas
    ctx.fillStyle = COLORS.FEKA_SHIRT;
    for (let i = 0; i < lives; i++) {
      ctx.fillRect(100 + i * 10, 4, 6, 8);
    }

    if (hasHelmet) {
      this.drawHelmetIcon(118, 4);
    }

    if (coffeeTimer > 0) {
      this.drawFantaIcon(132, 4, coffeeTimer);
    }


    // Tempo
    ctx.fillStyle = time < 30 ? '#FF0000' : COLORS.HUD_TEXT;
    ctx.fillText(`TIME:${Math.ceil(time).toString().padStart(3, '0')}`, 145, 11);

    // Level
    ctx.fillStyle = COLORS.HUD_ACCENT;
    ctx.fillText(level, 210, 11);

    // Sound icon
    this.drawSoundIcon(GAME_WIDTH - 14, 4, soundEnabled);


  }

  private drawSoundIcon(x: number, y: number, enabled: boolean): void {
    const ctx = this.offscreenCtx;
    ctx.fillStyle = enabled ? '#00FF00' : '#FF0000';
    ctx.fillRect(x, y + 3, 3, 6);
    ctx.fillRect(x + 3, y + 2, 2, 8);
    ctx.fillRect(x + 5, y + 3, 2, 6);

    if (enabled) {
      ctx.fillRect(x + 8, y + 2, 1, 8);
      ctx.fillRect(x + 10, y + 3, 1, 6);
    } else {
      for (let i = 0; i < 6; i++) {
        ctx.fillRect(x + 8 + i, y + 2 + i, 1, 1);
        ctx.fillRect(x + 8 + i, y + 7 - i, 1, 1);
      }
    }
  }

  private drawHelmetIcon(x: number, y: number): void {
    const ctx = this.offscreenCtx;
    ctx.fillStyle = '#FFD700';
    ctx.fillRect(x + 1, y + 2, 10, 2);
    ctx.fillRect(x + 2, y + 4, 8, 3);
    ctx.fillStyle = '#FFF8DC';
    ctx.fillRect(x + 4, y + 4, 2, 1);
  }

  private drawFantaIcon(x: number, y: number, timer: number): void {
    const ctx = this.offscreenCtx;
    // Lata icon
    ctx.fillStyle = '#FF8C00';
    ctx.fillRect(x, y + 1, 6, 8);
    // Label
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(x, y + 4, 6, 2);
    // Bar
    const pct = Math.max(0, Math.min(1, timer / 10000));
    ctx.fillStyle = '#FFA500';
    ctx.fillRect(x, y + 10, Math.round(10 * pct), 2);
  }

  private drawArrowIcon(x: number, y: number, dir: 'left' | 'right'): void {
    const ctx = this.offscreenCtx;
    if (dir === 'left') {
      ctx.fillRect(x + 6, y + 2, 2, 12);
      ctx.fillRect(x + 2, y + 6, 4, 4);
      ctx.fillRect(x, y + 7, 2, 2);
    } else {
      ctx.fillRect(x + 4, y + 2, 2, 12);
      ctx.fillRect(x + 6, y + 6, 4, 4);
      ctx.fillRect(x + 10, y + 7, 2, 2);
    }
  }

  private drawJumpIcon(x: number, y: number): void {
    const ctx = this.offscreenCtx;
    ctx.fillRect(x + 5, y + 2, 2, 10);
    ctx.fillRect(x + 2, y + 4, 8, 2);
    ctx.fillRect(x + 3, y + 2, 6, 2);
  }

  private drawRunIcon(x: number, y: number): void {
    const ctx = this.offscreenCtx;
    ctx.fillRect(x + 2, y + 4, 2, 2);
    ctx.fillRect(x + 4, y + 5, 2, 2);
    ctx.fillRect(x + 6, y + 6, 2, 2);
    ctx.fillRect(x + 4, y + 7, 2, 2);
    ctx.fillRect(x + 2, y + 8, 2, 2);
    ctx.fillRect(x + 7, y + 4, 2, 2);
    ctx.fillRect(x + 9, y + 5, 2, 2);
    ctx.fillRect(x + 11, y + 6, 2, 2);
    ctx.fillRect(x + 9, y + 7, 2, 2);
    ctx.fillRect(x + 7, y + 8, 2, 2);
  }

  private drawGroundPoundIconAt(ctx: CanvasRenderingContext2D, x: number, y: number, s: number = 1): void {
    const size = Math.max(1, Math.round(4 * s));
    const bodyH = Math.max(1, Math.round(6 * s));
    ctx.save();
    ctx.fillStyle = COLORS.MENU_HIGHLIGHT;

    // Corpo vertical (retângulo)
    ctx.fillRect(x, y, size, bodyH);

    // Ponta (triângulo apontando para baixo)
    ctx.beginPath();
    ctx.moveTo(x - Math.round(4 * s), y + bodyH);
    ctx.lineTo(x + size + Math.round(4 * s), y + bodyH);
    ctx.lineTo(x + Math.round(size / 2), y + bodyH + Math.max(1, Math.round(6 * s)));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  // === MENUS E OVERLAYS ===

  drawMenu(title: string, options: string[], selectedIndex: number): void {
    const ctx = this.offscreenCtx;

    // Fundo
    ctx.fillStyle = COLORS.MENU_BG;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Título
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.MENU_HIGHLIGHT;
    ctx.fillText(title, GAME_WIDTH / 2, 50);

    // Opções
    ctx.font = '10px monospace';
    options.forEach((option, i) => {
      const y = 90 + i * 20;
      ctx.fillStyle = i === selectedIndex ? COLORS.MENU_HIGHLIGHT : COLORS.MENU_TEXT;
      ctx.fillText(i === selectedIndex ? `> ${option} <` : option, GAME_WIDTH / 2, y);
    });
  }

  drawTitleScreen(): void {
    // Cache title screen to draw at higher resolution on the main canvas
    this.lastUIType = 'TITLE';
    this.lastUIParams = null;
    const ctx = this.offscreenCtx;

    // Fundo gradiente
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, '#1a1a3e');
    gradient.addColorStop(1, '#0a0a1e');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Estrelas no fundo
    ctx.fillStyle = '#FFFFFF';
    for (let i = 0; i < 30; i++) {
      const x = (i * 37) % GAME_WIDTH;
      const y = (i * 23) % (GAME_HEIGHT - 50);
      ctx.fillRect(x, y, 1, 1);
    }

    // Título "SUPER FEKA GAPS"
    ctx.font = 'bold 20px monospace';
    ctx.textAlign = 'center';


    // Título principal
    ctx.fillStyle = COLORS.MENU_HIGHLIGHT;
    ctx.fillText('SUPER FEKA GAPS', GAME_WIDTH / 2, 50);

    // Subtítulo
    ctx.font = '8px monospace';
    ctx.fillStyle = COLORS.MENU_TEXT;
    ctx.fillText('A aventura para salvar Yasmin!', GAME_WIDTH / 2, 70);

    // Instruções
    ctx.font = '10px monospace';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText('Pressione ENTER para começar', GAME_WIDTH / 2, 120);

    // Controles
    ctx.font = '8px monospace';
    ctx.fillStyle = '#888888';
    ctx.fillText('← → / A/D / WASD : Mover   ESPAÇO : Pular   SHIFT : Correr', GAME_WIDTH / 2, 145);
    ctx.fillText('ESC : Pause   M : Som', GAME_WIDTH / 2, 157);

    // Instrução da sentada violenta (posicionada acima dos créditos)
    ctx.fillText('↓ / S : Sentada Violenta (no ar)', GAME_WIDTH / 2, 132);
    this.drawGroundPoundIconAt(this.offscreenCtx, Math.round(GAME_WIDTH / 2 - 120), 122, 1);

    // Créditos
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'center';
    ctx.fillText('© 2025 Torbware', GAME_WIDTH / 2, GAME_HEIGHT - 10);

    // Versão (canto inferior direito)
    ctx.font = '8px monospace';
    ctx.fillStyle = '#666666';
    ctx.textAlign = 'right';
    ctx.fillText('v0.1', GAME_WIDTH - 4, GAME_HEIGHT - 4);

    // Restaura alinhamento central para outros textos
    ctx.textAlign = 'center';
  }

  drawPauseOverlay(): void {
    const ctx = this.offscreenCtx;

    // Overlay escuro
    ctx.fillStyle = COLORS.OVERLAY;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Caixa central
    ctx.fillStyle = '#222222';
    ctx.fillRect(GAME_WIDTH / 2 - 60, GAME_HEIGHT / 2 - 30, 120, 60);
    ctx.strokeStyle = COLORS.MENU_HIGHLIGHT;
    ctx.lineWidth = 2;
    ctx.strokeRect(GAME_WIDTH / 2 - 60, GAME_HEIGHT / 2 - 30, 120, 60);

    // Texto
    ctx.font = '12px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = COLORS.MENU_HIGHLIGHT;
    ctx.fillText('PAUSADO', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);

    ctx.font = '8px monospace';
    ctx.fillStyle = COLORS.MENU_TEXT;
    ctx.fillText('Pressione ESC para continuar', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 15);
  }

  drawGameOver(score: number): void {
    // Cache params so we can draw this overlay crisply on the main canvas
    this.lastUIType = 'TITLE';
    this.lastUIParams = { variant: 'GAME_OVER', score };

    const ctx = this.offscreenCtx;

    // Fundo vermelho escuro (backup low-res)
    ctx.fillStyle = 'rgba(50, 0, 0, 0.9)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Texto GAME OVER (backup)
    ctx.font = 'bold 24px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF0000';
    ctx.fillText('GAME OVER', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 20);

    // Score final
    ctx.font = '10px monospace';
    ctx.fillStyle = COLORS.MENU_TEXT;
    ctx.fillText(`Score Final: ${score}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10);

    // Instrução
    ctx.font = '8px monospace';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText('Pressione ENTER para reiniciar', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 35);
  }

  drawLevelClear(level: string, score: number, timeBonus: number): void {
    // Cache params so we can draw this overlay crisply on the main canvas
    this.lastUIType = 'TITLE';
    this.lastUIParams = { variant: 'LEVEL_CLEAR', level, score, timeBonus };

    const ctx = this.offscreenCtx;

    // Fundo (backup low-res version in offscreen)
    ctx.fillStyle = 'rgba(0, 50, 0, 0.9)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Texto (backup low-res)
    ctx.font = 'bold 16px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#00FF00';
    ctx.fillText('FASE COMPLETA!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30);

    ctx.font = '10px monospace';
    ctx.fillStyle = COLORS.MENU_TEXT;
    ctx.fillText(`${level}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 - 10);
    ctx.fillText(`Score: ${score}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 10);
    ctx.fillText(`Bônus de tempo: +${timeBonus}`, GAME_WIDTH / 2, GAME_HEIGHT / 2 + 25);
  }

  drawBossIntro(bossName: string): void {
    // Cache params so we can draw this overlay crisply on the main canvas
    this.lastUIType = 'TITLE';
    this.lastUIParams = { variant: 'BOSS_INTRO', bossName };

    const ctx = this.offscreenCtx;

    // Fundo dramático (backup low-res)
    ctx.fillStyle = 'rgba(50, 0, 50, 0.9)';
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // Aviso (backup low-res)
    ctx.font = '8px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#FF0000';
    ctx.fillText('!! ALERTA DE BOSS !!', GAME_WIDTH / 2, GAME_HEIGHT / 2 - 30);

    // Nome do boss
    ctx.font = 'bold 16px monospace';
    ctx.fillStyle = COLORS.JOAOZAO_SKIN;
    ctx.fillText(bossName, GAME_WIDTH / 2, GAME_HEIGHT / 2);

    // Subtítulo
    ctx.font = '8px monospace';
    ctx.fillStyle = '#AAAAAA';
    ctx.fillText('\"Você vai cair nos meus gaps!\"', GAME_WIDTH / 2, GAME_HEIGHT / 2 + 20);
  }

  drawEnding(fireworks: Firework[] = []): void {
    // Use TITLE high-res overlay for ending so we can draw Yasmin crisp
    this.lastUIType = 'TITLE';
    this.lastUIParams = { variant: 'ENDING' };

    const ctx = this.offscreenCtx;

    // Fundo romântico (backup)
    const gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    gradient.addColorStop(0, '#FF69B4');
    gradient.addColorStop(1, '#FFB6C1');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // --- CAMADA DOS FOGOS (offscreen) ---
    this.drawFireworks(fireworks, 0, 0);

    // --- CAMADA DOS FOGOS (main canvas, high-res) ---
    // Copy fireworks to a transient property so drawUIOnScreen can draw them on the main canvas
    this.lastEndingFireworks = fireworks ? fireworks : [];

    // Corações flutuantes (backup)
    ctx.fillStyle = '#FF0000';
    for (let i = 0; i < 10; i++) {
      const x = (Date.now() / 50 + i * 40) % GAME_WIDTH;
      const y = 30 + Math.sin(Date.now() / 500 + i) * 10;
      ctx.font = '10px monospace';
      ctx.fillText('♥', x, y);
    }

    // Feka (backup pixel-art)
    const fekaX = GAME_WIDTH / 2 - 40;
    const fekaY = GAME_HEIGHT / 2 + 10;
    this.drawPixelArt(ctx, PLAYER_SPRITES.idle, fekaX, fekaY, PLAYER_PIXEL_SIZE, true);

    // Yasmin (Imagem Real - desenhada no offscreen como fallback)
    if (this.yasminImg) {
      const targetH = 60; // Altura desejada na tela final (logical px)
      const ratio = this.yasminImg.width / this.yasminImg.height;
      const targetW = targetH * ratio;

      ctx.save();
      // Desenha Yasmin ao lado do Feka (fallback low-res)
      ctx.drawImage(
        this.yasminImg,
        GAME_WIDTH / 2 + 10,
        GAME_HEIGHT / 2 - 20,
        targetW,
        targetH
      );
      ctx.restore();
    } else {
      // Fallback para pixel art se a imagem não carregar
      this.drawYasmin(GAME_WIDTH / 2 + 20, GAME_HEIGHT / 2);
    }

    // Texto (backup low-res)
    ctx.font = 'bold 14px monospace';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#8B0000';
    ctx.fillText('Feka salvou Yasmin!', GAME_WIDTH / 2, 40);

    ctx.font = '10px monospace';
    ctx.fillStyle = '#4A0000';
    ctx.fillText('Joãozão foi derrotado!', GAME_WIDTH / 2, 60);

    ctx.fillStyle = '#FFD700';
    ctx.fillText('FIM', GAME_WIDTH / 2, GAME_HEIGHT - 40);

    ctx.font = '8px monospace';
    ctx.fillStyle = '#8B0000';
    ctx.fillText('Pressione ENTER para jogar novamente', GAME_WIDTH / 2, GAME_HEIGHT - 20);
  }

  // === TOUCH CONTROLS ===

  drawTouchControls(): void {
    // Verifica se e dispositivo touch
    if (!('ontouchstart' in window)) return;

    const ctx = this.offscreenCtx;
    ctx.globalAlpha = 0.5;

    // D-pad esquerdo
    ctx.fillStyle = '#333333';
    ctx.fillRect(10, GAME_HEIGHT - 40, 30, 30);
    ctx.fillRect(50, GAME_HEIGHT - 40, 30, 30);

    ctx.fillStyle = '#FFFFFF';
    this.drawArrowIcon(18, GAME_HEIGHT - 34, 'left');
    this.drawArrowIcon(58, GAME_HEIGHT - 34, 'right');

    // Botoes direita
    ctx.fillStyle = '#333333';
    ctx.fillRect(GAME_WIDTH - 80, GAME_HEIGHT - 40, 30, 30);
    ctx.fillRect(GAME_WIDTH - 40, GAME_HEIGHT - 40, 30, 30);

    ctx.fillStyle = '#FFFFFF';
    this.drawRunIcon(GAME_WIDTH - 72, GAME_HEIGHT - 34);
    this.drawJumpIcon(GAME_WIDTH - 32, GAME_HEIGHT - 34);

    ctx.globalAlpha = 1;
  }

  // Utilitário para obter dimensões
  getDimensions(): { width: number; height: number } {
    return { width: GAME_WIDTH, height: GAME_HEIGHT };
  }
}
