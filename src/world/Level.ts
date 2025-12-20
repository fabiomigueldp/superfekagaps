// Sistema de Níveis - Super Feka Gaps

import { TILE_SIZE, TileType } from '../constants';
import { LevelData, Rect, Vector2 } from '../types';

export class Level {
  data: LevelData;
  private dynamicTiles: Map<string, { originalTile: number; timer: number }> = new Map();

  constructor(data: LevelData) {
    this.data = data;
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
        if (tile === TileType.GROUND || tile === TileType.BRICK || tile === TileType.BRICK_BREAKABLE || tile === TileType.BLOCK_USED || tile === TileType.POWERUP_BLOCK_COFFEE || tile === TileType.POWERUP_BLOCK_HELMET) {
          solid = true;
        } else if (tile === TileType.PLATFORM) {
          solid = entityBottom <= tileTop + 2;
        }

        if (solid) {
          // Determina qual lado está colidindo
          const tileRect = {
            x: col * TILE_SIZE,
            y: row * TILE_SIZE,
            width: TILE_SIZE,
            height: TILE_SIZE
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
  resolveCollision(rect: Rect, velocity: Vector2, prevRect?: Rect): { position: Vector2; velocity: Vector2; grounded: boolean; tileHit?: { type: number; col: number; row: number; side: 'top'|'bottom'|'left'|'right' } | null } {
    let newX = rect.x + velocity.x;
    let newY = rect.y + velocity.y;
    let newVelX = velocity.x;
    let newVelY = velocity.y;
    let grounded = false;
    let tileHit: { type: number; col: number; row: number; side: 'top'|'bottom'|'left'|'right' } | null = null;

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

    // Resolve vertical
    const verticalRect = { x: newX, y: newY, width: rect.width, height: rect.height };
    const vCollision = this.checkTileCollisionVertical(verticalRect, velocity.y, prevRect);

    if (vCollision.collides) {
      if (velocity.y > 0) {
        // Landing on tile
        newY = vCollision.row * TILE_SIZE - rect.height;
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
        if (tile === TileType.PLATFORM) continue;

        if (tile === TileType.GROUND || tile === TileType.BRICK || tile === TileType.BRICK_BREAKABLE || tile === TileType.BLOCK_USED || tile === TileType.POWERUP_BLOCK_COFFEE || tile === TileType.POWERUP_BLOCK_HELMET) {
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
        if (tile === TileType.PLATFORM) {
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

        if (tile === TileType.GROUND || tile === TileType.BRICK || tile === TileType.BRICK_BREAKABLE || tile === TileType.BLOCK_USED || tile === TileType.POWERUP_BLOCK_COFFEE || tile === TileType.POWERUP_BLOCK_HELMET) {
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
        if (tile === TileType.GROUND || tile === TileType.BRICK || tile === TileType.BRICK_BREAKABLE || tile === TileType.POWERUP_BLOCK_COFFEE || tile === TileType.POWERUP_BLOCK_HELMET || tile === TileType.BLOCK_USED) {
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

  // Atualiza tiles dinâmicos
  updateDynamicTiles(deltaTime: number): void {
    this.dynamicTiles.forEach((v, key) => {
      v.timer -= deltaTime;
      if (v.timer <= 0) {
        this.dynamicTiles.delete(key);
      }
    });
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
    
    return tiles;
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
  }
}

// Cria um nível a partir de dados
export function createLevel(data: LevelData): Level {
  return new Level(data);
}
