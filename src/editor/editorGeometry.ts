import { TILE_SIZE, TileType } from '../constants';
import type { LevelData, Vector2 } from '../types';

export function screenToWorld(point: Vector2, camera: Vector2, zoom: number): Vector2 {
    return { x: point.x / zoom + camera.x, y: point.y / zoom + camera.y };
}

/** Copy tiles by world coordinate; moving a boundary must not move the world. */
export function resizeLevel(level: LevelData, width: number, height: number,
    originX = level.originX ?? 0, originY = level.originY ?? 0, source = level): void {
    width = Math.max(10, Math.min(500, Math.round(width)));
    height = Math.max(5, Math.min(100, Math.round(height)));
    const oldX = source.originX ?? 0;
    const oldY = source.originY ?? 0;
    const tiles = Array.from({ length: height }, (_, row) =>
        Array.from({ length: width }, (_, col) =>
            source.tiles[row + originY - oldY]?.[col + originX - oldX] ?? TileType.EMPTY));
    Object.assign(level, { width, height, originX, originY, tiles });
}

/** Include spawn, goal, checkpoints and pixel-based zones when fitting bounds. */
export function fitLevelToContent(level: LevelData): void {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const include = (x: number, y: number) => {
        minX = Math.min(minX, Math.floor(x)); minY = Math.min(minY, Math.floor(y));
        maxX = Math.max(maxX, Math.floor(x)); maxY = Math.max(maxY, Math.floor(y));
    };
    level.tiles.forEach((row, y) => row.forEach((tile, x) => {
        if (tile !== TileType.EMPTY) include(x + (level.originX ?? 0), y + (level.originY ?? 0));
    }));
    [level.playerSpawn, level.goalPosition, ...level.checkpoints,
        ...level.enemies.map(e => e.position), ...level.collectibles.map(c => c.position)]
        .forEach(p => include(p.x, p.y));
    level.triggers.forEach(t => {
        include(t.x / TILE_SIZE, t.y / TILE_SIZE);
        include(Math.ceil((t.x + t.width) / TILE_SIZE) - 1, Math.ceil((t.y + t.height) / TILE_SIZE) - 1);
    });
    if (maxX - minX + 1 > 500 || maxY - minY + 1 > 100) {
        throw new Error('O conteúdo excede o limite de 500 × 100 blocos.');
    }
    resizeLevel(level, maxX - minX + 1, maxY - minY + 1, minX, minY);
}
