// Sistema de Níveis - Super Feka Gaps

import {
  TILE_SIZE,
  TileType,
  FALLING_PLATFORM_MIN_CONTACT_MS,
  FALLING_PLATFORM_ARM_MS,
  FALLING_PLATFORM_FALL_MS,
  FALLING_PLATFORM_RESPAWN_MS
} from '../constants';
import { LevelData, Rect, Vector2, FallingPlatformPhase } from '../types';

interface FallingPlatformState {
  phase: FallingPlatformPhase;
  timer: number;
  contact: number;
}

export class Level {
  data: LevelData;
  private dynamicTiles: Map<string, { originalTile: number; timer: number }> = new Map();
  private fallingPlatforms: Map<string, FallingPlatformState> = new Map();
  private fallingPlatformTouches: Set<string> = new Set();

  constructor(data: LevelData) {
    this.data = data;
  }

  private hasLavaAbove(col: number, row: number): boolean {
    if (row <= 0 || col < 0 || col >= this.data.tiles[0].length) return false;
    const above = this.data.tiles[row - 1]?.[col];
    return above === TileType.LAVA_TOP || above === TileType.LAVA_FILL;
  }

  // Se houver AR em cima, a lava ocupa apenas 3/4 de baixo (topo fica offsetado)
  private getLavaTopOffset(col: number, row: number): number {
    if (row < 0 || row >= this.data.tiles.length || col < 0 || col >= this.data.tiles[0].length) {
      return 0;
    }
    const tile = this.data.tiles[row][col];
    if (tile !== TileType.LAVA_TOP && tile !== TileType.LAVA_FILL) return 0;

    // Se tem lava em cima, nao tem offset (eh um bloco cheio conectado)
    if (this.hasLavaAbove(col, row)) return 0;

    // Se tem AR em cima, aplica o "gap" de segurança
    const above = row > 0 ? this.data.tiles[row - 1][col] : null;
    if (above === TileType.EMPTY) {
      return Math.floor(TILE_SIZE / 4);
    }

    // Se tiver qualquer outra coisa solida em cima, consideramos lava cheia ou normal
    return 0;
  }

  // Verifica colisão com um retângulo
  checkCollision(rect: Rect): { left: boolean; right: boolean; top: boolean; bottom: boolean; grounded: boolean } {
    const result = { left: false, right: false, top: false, bottom: false, grounded: false };

    const startCol = Math.floor(rect.x / TILE_SIZE);
    const endCol = Math.floor((rect.x + rect.width - 1) / TILE_SIZE);
    const startRow = Math.floor(rect.y / TILE_SIZE);
    const endRow = Math.floor((rect.y + rect.height - 1) / TILE_SIZE);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (row < 0 || row >= this.data.tiles.length || col < 0 || col >= this.data.tiles[0].length) continue;

        const tile = this.getTile(col, row);
        // Decide solidez conservadora: plataformas contam como chão se o bottom atual está acima do topo+2
        const tileTop = row * TILE_SIZE;
        const entityBottom = rect.y + rect.height;
        let solid = false;
        if (
          tile === TileType.GROUND ||
          tile === TileType.BRICK ||
          tile === TileType.BRICK_BREAKABLE ||
          tile === TileType.BLOCK_USED ||
          tile === TileType.POWERUP_BLOCK_MINI_FANTA ||
          tile === TileType.POWERUP_BLOCK_HELMET ||
          tile === TileType.SPRING ||
          tile === TileType.ICE ||
          tile === TileType.LAVA_TOP ||
          tile === TileType.LAVA_FILL
        ) {
          solid = true;
        } else if (tile === TileType.PLATFORM || tile === TileType.PLATFORM_FALLING) {
          solid = entityBottom <= tileTop + 2;
        }

        if (solid) {
          // Determina qual lado esta colidindo
          let tileY = row * TILE_SIZE;
          let tileH = TILE_SIZE;
          if (tile === TileType.LAVA_TOP || tile === TileType.LAVA_FILL) {

            const offset = this.getLavaTopOffset(col, row);
            tileY += offset;
            tileH -= offset;
          }
          const tileRect = {
            x: col * TILE_SIZE,
            y: tileY,
            width: TILE_SIZE,
            height: tileH
          };

          // Calcula overlap
          const overlapX = Math.min(rect.x + rect.width, tileRect.x + tileRect.width) - Math.max(rect.x, tileRect.x);
          const overlapY = Math.min(rect.y + rect.height, tileRect.y + tileRect.height) - Math.max(rect.y, tileRect.y);

          if (overlapX > overlapY) {
            if (rect.y < tileRect.y) {
              result.bottom = true;
              result.grounded = true;
            } else {
              result.top = true;
            }
          } else {
            if (rect.x < tileRect.x) {
              result.right = true;
            } else {
              result.left = true;
            }
          }
        }
      }
    }

    return result;
  }

  // Resolve colisão e retorna nova posição e possível tileHit
  resolveCollision(rect: Rect, velocity: Vector2, prevRect?: Rect): { position: Vector2; velocity: Vector2; grounded: boolean; tileHit?: { type: number; col: number; row: number; side: 'top' | 'bottom' | 'left' | 'right' } | null } {
    let newX = rect.x + velocity.x;
    let newY = rect.y + velocity.y;
    let newVelX = velocity.x;
    let newVelY = velocity.y;
    let grounded = false;
    let tileHit: { type: number; col: number; row: number; side: 'top' | 'bottom' | 'left' | 'right' } | null = null;

    const minX = 0;
    const maxX = this.data.width * TILE_SIZE - rect.width;

    // Resolve horizontal primeiro (checa paredes sólidos, ignora PLATFORMS)
    const horizontalRect = { x: newX, y: rect.y, width: rect.width, height: rect.height };
    const hCollision = this.checkTileCollisionHorizontal(horizontalRect, velocity.x);

    if (hCollision.collides) {
      if (velocity.x > 0) {
        newX = hCollision.col * TILE_SIZE - rect.width;
        tileHit = { type: hCollision.tile, col: hCollision.col, row: hCollision.row, side: 'left' };
      } else if (velocity.x < 0) {
        newX = (hCollision.col + 1) * TILE_SIZE;
        tileHit = { type: hCollision.tile, col: hCollision.col, row: hCollision.row, side: 'right' };
      }
      newVelX = 0;
    }

    // Limite lateral do nivel (parede invisivel)
    if (newX < minX) {
      newX = minX;
      newVelX = 0;
    } else if (newX > maxX) {
      newX = maxX;
      newVelX = 0;
    }

    // Resolve vertical
    const verticalRect = { x: newX, y: newY, width: rect.width, height: rect.height };
    const vCollision = this.checkTileCollisionVertical(verticalRect, velocity.y, prevRect);

    if (vCollision.collides) {
      if (velocity.y > 0) {
        // Landing on tile
        if (vCollision.tile === TileType.LAVA_TOP || vCollision.tile === TileType.LAVA_FILL) {
          const offset = this.getLavaTopOffset(vCollision.col, vCollision.row);
          newY = vCollision.row * TILE_SIZE + offset - rect.height;
        } else {
          newY = vCollision.row * TILE_SIZE - rect.height;
        }
        grounded = true;
        tileHit = { type: vCollision.tile, col: vCollision.col, row: vCollision.row, side: 'bottom' };
      } else if (velocity.y < 0) {
        // Head hit
        newY = (vCollision.row + 1) * TILE_SIZE;
        tileHit = { type: vCollision.tile, col: vCollision.col, row: vCollision.row, side: 'top' };
      }
      newVelY = 0;
    }

    return {
      position: { x: newX, y: newY },
      velocity: { x: newVelX, y: newVelY },
      grounded,
      tileHit
    };
  }

  // Horizontal collision check: ignore platforms when checking walls
  private checkTileCollisionHorizontal(rect: Rect, _velX: number): { collides: boolean; col: number; row: number; tile: number } {
    const startCol = Math.floor(rect.x / TILE_SIZE);
    const endCol = Math.floor((rect.x + rect.width - 0.1) / TILE_SIZE);
    const startRow = Math.floor(rect.y / TILE_SIZE);
    const endRow = Math.floor((rect.y + rect.height - 0.1) / TILE_SIZE);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (row < 0 || row >= this.data.tiles.length) continue;
        if (col < 0 || col >= this.data.tiles[0].length) continue;

        const tile = this.getTile(col, row);
        // Ignora PLATFORMS para colisão lateral
        if (tile === TileType.PLATFORM || tile === TileType.PLATFORM_FALLING) continue;

        if (
          tile === TileType.GROUND ||
          tile === TileType.BRICK ||
          tile === TileType.BRICK_BREAKABLE ||
          tile === TileType.BLOCK_USED ||
          tile === TileType.POWERUP_BLOCK_MINI_FANTA ||
          tile === TileType.POWERUP_BLOCK_HELMET ||
          tile === TileType.SPRING ||
          tile === TileType.ICE ||
          tile === TileType.LAVA_TOP ||
          tile === TileType.LAVA_FILL
        ) {
          if (tile === TileType.LAVA_TOP || tile === TileType.LAVA_FILL) {
            const offset = this.getLavaTopOffset(col, row);
            if (offset > 0) {
              const tileTop = row * TILE_SIZE + offset;
              const tileBottom = (row + 1) * TILE_SIZE;
              if (rect.y + rect.height <= tileTop || rect.y >= tileBottom) {
                continue;
              }
            }
          }
          return { collides: true, col, row, tile };
        }
      }
    }

    return { collides: false, col: 0, row: 0, tile: TileType.EMPTY };
  }

  // Vertical collision check: consider platforms only when moving down and crossing from above
  private checkTileCollisionVertical(rect: Rect, velY: number, prevRect?: Rect): { collides: boolean; col: number; row: number; tile: number } {
    const startCol = Math.floor(rect.x / TILE_SIZE);
    const endCol = Math.floor((rect.x + rect.width - 0.1) / TILE_SIZE);

    // Quando caindo, olhe a linha do pé
    if (velY > 0) {
      const row = Math.floor((rect.y + rect.height - 0.1) / TILE_SIZE);
      for (let col = startCol; col <= endCol; col++) {
        if (row < 0 || row >= this.data.tiles.length || col < 0 || col >= this.data.tiles[0].length) continue;
        const tile = this.getTile(col, row);
        const tileTop = row * TILE_SIZE;
        // Plataformas: só colidem se o jogador vinha de cima e cruzou o topo nesse frame
        if (tile === TileType.PLATFORM || tile === TileType.PLATFORM_FALLING) {
          if (prevRect) {
            const prevBottom = prevRect.y + prevRect.height;
            const newBottom = rect.y + rect.height;
            if (prevBottom <= tileTop + 1 && newBottom >= tileTop - 0.1) {
              return { collides: true, col, row, tile };
            }
          } else {
            // sem prevRect, use simples checagem de bottom
            const newBottom = rect.y + rect.height;
            if (newBottom >= tileTop - 0.1) {
              return { collides: true, col, row, tile };
            }
          }
        }

        if (tile === TileType.LAVA_TOP || tile === TileType.LAVA_FILL) {
          const offset = this.getLavaTopOffset(col, row);
          const lavaTop = row * TILE_SIZE + offset;
          if (prevRect) {
            const prevBottom = prevRect.y + prevRect.height;
            const newBottom = rect.y + rect.height;
            if (prevBottom <= lavaTop + 1 && newBottom >= lavaTop - 0.1) {
              return { collides: true, col, row, tile };
            }
          } else {
            const newBottom = rect.y + rect.height;
            if (newBottom >= lavaTop - 0.1) {
              return { collides: true, col, row, tile };
            }
          }
          continue;
        }

        if (
          tile === TileType.GROUND ||
          tile === TileType.BRICK ||
          tile === TileType.BRICK_BREAKABLE ||
          tile === TileType.BLOCK_USED ||
          tile === TileType.POWERUP_BLOCK_MINI_FANTA ||
          tile === TileType.POWERUP_BLOCK_HELMET ||
          tile === TileType.SPRING ||
          tile === TileType.ICE
        ) {
          return { collides: true, col, row, tile };
        }
      }
    }

    // Quando subindo, olhe a linha da cabeça, ignore PLATFORMS
    if (velY < 0) {
      const row = Math.floor((rect.y + 0.1) / TILE_SIZE);
      for (let col = startCol; col <= endCol; col++) {
        if (row < 0 || row >= this.data.tiles.length || col < 0 || col >= this.data.tiles[0].length) continue;
        const tile = this.getTile(col, row);
        if (
          tile === TileType.GROUND ||
          tile === TileType.BRICK ||
          tile === TileType.BRICK_BREAKABLE ||
          tile === TileType.POWERUP_BLOCK_MINI_FANTA ||
          tile === TileType.POWERUP_BLOCK_HELMET ||
          tile === TileType.BLOCK_USED ||
          tile === TileType.SPRING ||
          tile === TileType.ICE ||
          tile === TileType.LAVA_TOP ||
          tile === TileType.LAVA_FILL ||
          tile === TileType.HIDDEN_BLOCK
        ) {
          return { collides: true, col, row, tile };
        }
      }
    }

    return { collides: false, col: 0, row: 0, tile: TileType.EMPTY };
  }

  // Verifica se está em um buraco (gap)
  isInGap(rect: Rect): boolean {
    // Verifica se caiu abaixo do mapa
    if (rect.y > this.data.height * TILE_SIZE) {
      return true;
    }
    return false;
  }

  // Verifica colisão com spikes
  checkSpikeCollision(rect: Rect): boolean {
    const startCol = Math.floor(rect.x / TILE_SIZE);
    const endCol = Math.floor((rect.x + rect.width - 1) / TILE_SIZE);
    const startRow = Math.floor(rect.y / TILE_SIZE);
    const endRow = Math.floor((rect.y + rect.height - 1) / TILE_SIZE);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (row < 0 || row >= this.data.tiles.length || col < 0 || col >= this.data.tiles[0].length) continue;

        if (this.getTile(col, row) === TileType.SPIKE) {
          return true;
        }
      }
    }

    return false;
  }



  // Verifica colisao com lava
  checkLavaCollision(rect: Rect): boolean {
    const startCol = Math.floor(rect.x / TILE_SIZE);
    const endCol = Math.floor((rect.x + rect.width - 1) / TILE_SIZE);
    const startRow = Math.floor(rect.y / TILE_SIZE);
    const endRow = Math.floor((rect.y + rect.height) / TILE_SIZE);

    for (let row = startRow; row <= endRow; row++) {
      for (let col = startCol; col <= endCol; col++) {
        if (row < 0 || row >= this.data.tiles.length || col < 0 || col >= this.data.tiles[0].length) continue;
        const tile = this.getTile(col, row);
        if (tile === TileType.LAVA_TOP || tile === TileType.LAVA_FILL) {
          const offset = this.getLavaTopOffset(col, row);
          const lavaY = row * TILE_SIZE + offset;
          const lavaH = TILE_SIZE - offset;
          const lavaX = col * TILE_SIZE;
          const hit = rect.x <= lavaX + TILE_SIZE &&
            rect.x + rect.width >= lavaX &&
            rect.y <= lavaY + lavaH &&
            rect.y + rect.height >= lavaY;
          if (hit) return true;
        }
      }
    }

    return false;
  }
  // Verifica se alcançou a bandeira/portal de fim
  checkGoalReached(rect: Rect): boolean {
    const goalX = this.data.goalPosition.x * TILE_SIZE;
    const goalY = this.data.goalPosition.y * TILE_SIZE;

    return rect.x + rect.width > goalX &&
      rect.x < goalX + TILE_SIZE &&
      rect.y + rect.height > goalY &&
      rect.y < goalY + TILE_SIZE;
  }

  // Obtém tile considerando tiles dinâmicos (para boss)
  getTile(col: number, row: number): number {
    const key = `${col},${row}`;
    const dynamic = this.dynamicTiles.get(key);

    if (dynamic && dynamic.timer > 0) {
      return TileType.EMPTY;
    }

    if (row < 0 || row >= this.data.tiles.length || col < 0 || col >= this.data.tiles[0].length) {
      return TileType.EMPTY;
    }

    const falling = this.fallingPlatforms.get(key);
    if (falling) {
      if (falling.phase === 'falling' || falling.phase === 'cooldown') {
        return TileType.EMPTY;
      }
      return TileType.PLATFORM_FALLING;
    }

    return this.data.tiles[row][col];
  }

  // Remove tile temporariamente (para boss criar gaps)
  removeTileTemporarily(col: number, row: number, duration: number): void {
    if (row < 0 || row >= this.data.tiles.length || col < 0 || col >= this.data.tiles[0].length) return;

    const key = `${col},${row}`;
    const originalTile = this.data.tiles[row][col];

    if (originalTile !== TileType.EMPTY) {
      this.dynamicTiles.set(key, { originalTile, timer: duration });
    }
  }



  // Marca contato com plataforma instavel neste frame
  markFallingPlatformContact(col: number, row: number): void {
    if (row < 0 || row >= this.data.tiles.length || col < 0 || col >= this.data.tiles[0].length) return;
    const key = `${col},${row}`;
    const tile = this.data.tiles[row][col];
    if (tile !== TileType.PLATFORM_FALLING) return;
    this.fallingPlatformTouches.add(key);
    if (!this.fallingPlatforms.has(key)) {
      this.fallingPlatforms.set(key, { phase: 'contact', timer: 0, contact: 0 });
    }
  }

  clearFallingPlatformTouches(): void {
    this.fallingPlatformTouches.clear();
  }
  // Atualiza tiles dinâmicos
  updateDynamicTiles(deltaTime: number): void {
    this.dynamicTiles.forEach((v, key) => {
      v.timer -= deltaTime;
      if (v.timer <= 0) {
        this.dynamicTiles.delete(key);
      }
    });
  }

  // Atualiza plataformas instaveis (contato, arm, queda e respawn)
  updateFallingPlatforms(deltaTime: number): void {
    this.fallingPlatforms.forEach((state, key) => {
      const touched = this.fallingPlatformTouches.has(key);

      if (state.phase === 'contact') {
        if (touched) {
          state.contact += deltaTime;
          if (state.contact >= FALLING_PLATFORM_MIN_CONTACT_MS) {
            state.phase = 'arming';
            state.timer = FALLING_PLATFORM_ARM_MS;
          }
        } else {
          this.fallingPlatforms.delete(key);
        }
        return;
      }

      if (state.phase === 'arming') {
        state.timer -= deltaTime;
        if (state.timer <= 0) {
          state.phase = 'falling';
          state.timer = FALLING_PLATFORM_FALL_MS;
        }
        return;
      }

      if (state.phase === 'falling') {
        state.timer -= deltaTime;
        if (state.timer <= 0) {
          state.phase = 'cooldown';
          state.timer = FALLING_PLATFORM_RESPAWN_MS;
        }
        return;
      }

      if (state.phase === 'cooldown') {
        state.timer -= deltaTime;
        if (state.timer <= 0) {
          this.fallingPlatforms.delete(key);
        }
      }
    });

    this.fallingPlatformTouches.clear();
  }

  // Obtém todos os tiles modificados para renderização
  getModifiedTiles(): number[][] {
    const tiles = this.data.tiles.map(row => [...row]);

    this.dynamicTiles.forEach((_, key) => {
      const [col, row] = key.split(',').map(Number);
      if (row >= 0 && row < tiles.length && col >= 0 && col < tiles[0].length) {
        tiles[row][col] = TileType.EMPTY;
      }
    });

    this.fallingPlatforms.forEach((_, key) => {
      const [col, row] = key.split(',').map(Number);
      if (row >= 0 && row < tiles.length && col >= 0 && col < tiles[0].length) {
        tiles[row][col] = TileType.EMPTY;
      }
    });

    return tiles;
  }

  // Lista plataformas instaveis para renderizacao especial
  getFallingPlatformRenderData(): { col: number; row: number; phase: FallingPlatformPhase; timer: number; contact: number }[] {
    const list: { col: number; row: number; phase: FallingPlatformPhase; timer: number; contact: number }[] = [];
    this.fallingPlatforms.forEach((state, key) => {
      if (state.phase === 'cooldown') return;
      const [col, row] = key.split(',').map(Number);
      list.push({ col, row, phase: state.phase, timer: state.timer, contact: state.contact });
    });
    return list;
  }

  // Obtém limites do nível para a câmera
  getBounds(): { minX: number; maxX: number; minY: number; maxY: number } {
    return {
      minX: 0,
      maxX: this.data.width * TILE_SIZE,
      minY: 0,
      maxY: this.data.height * TILE_SIZE
    };
  }

  // Encontra checkpoint mais próximo ativado
  findNearestCheckpoint(checkpoints: Vector2[], playerX: number): Vector2 {
    let nearest = this.data.playerSpawn;
    let nearestDist = Infinity;

    checkpoints.forEach(cp => {
      const dist = Math.abs(cp.x - playerX);
      if (dist < nearestDist && cp.x <= playerX) {
        nearest = cp;
        nearestDist = dist;
      }
    });

    return nearest;
  }

  // Muta um tile permanentemente
  setTile(col: number, row: number, tile: number): void {
    if (row < 0 || row >= this.data.tiles.length || col < 0 || col >= this.data.tiles[0].length) return;
    this.data.tiles[row][col] = tile;
  }

  // Quebra um tile se for quebrável
  breakTile(col: number, row: number, hasHelmet: boolean = false): { success: boolean, type: number } {
    if (row < 0 || row >= this.data.tiles.length || col < 0 || col >= this.data.tiles[0].length) {
      return { success: false, type: TileType.EMPTY };
    }

    const tile = this.getTile(col, row);
    let canBreak = false;

    if (tile === TileType.BRICK_BREAKABLE) {
      canBreak = true;
    } else if (tile === TileType.BRICK && hasHelmet) {
      canBreak = true;
    }

    if (canBreak) {
      this.setTile(col, row, TileType.EMPTY);
      return { success: true, type: tile };
    }

    return { success: false, type: tile };
  }

  // Reset do nível
  reset(): void {
    this.dynamicTiles.clear();
    this.fallingPlatforms.clear();
    this.fallingPlatformTouches.clear();
  }
}

// Cria um nível a partir de dados
export function createLevel(data: LevelData): Level {
  return new Level(data);
}
