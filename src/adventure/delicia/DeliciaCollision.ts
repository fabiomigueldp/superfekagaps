import { TILE_SIZE, TileType } from '../../constants';
import type { PlayerCollisionWorld } from '../../entities/Player';
import type { Rect, Vector2 } from '../../types';

export interface DeliciaSurface extends Rect { index: number; previousY: number; solid: boolean; spring: boolean }

/** The native Player owns movement; this adapter only supplies chapter geometry. */
export class DeliciaCollision implements PlayerCollisionWorld {
    support = -1;
    constructor(readonly width: number, readonly surfaces: readonly DeliciaSurface[]) {}
    worldToCol(x: number): number { return Math.floor(x / TILE_SIZE); }
    worldToRow(y: number): number { return Math.floor(y / TILE_SIZE); }
    getTile(): number { return TileType.EMPTY; }
    isInGap(): boolean { return false; } // Chapter health/checkpoint policy owns falls.
    resolveCollision(rect: Rect, velocity: Vector2, previous: Rect = rect) {
        const position = { x: Math.max(0, Math.min(this.width - rect.width, rect.x + velocity.x)), y: rect.y + velocity.y };
        const resolved = { ...velocity };
        let grounded = false;
        let tileHit: { type: number; col: number; row: number; side: 'bottom' | 'top' | 'left' | 'right' } | null = null;
        this.support = -1;
        // Horizontal sweep is independent of vertical landing, as in Level.
        for (const f of this.surfaces) {
            if (!f.solid || rect.y + rect.height <= f.y || rect.y >= f.y + f.height) continue;
            if (velocity.x > 0 && previous.x + rect.width <= f.x + .01 && position.x + rect.width > f.x) {
                position.x = Math.min(position.x, f.x - rect.width); resolved.x = 0;
            } else if (velocity.x < 0 && previous.x >= f.x + f.width - .01 && position.x < f.x + f.width) {
                position.x = Math.max(position.x, f.x + f.width); resolved.x = 0;
            }
        }
        let landing = Infinity;
        for (const f of this.surfaces) {
            if (position.x + rect.width <= f.x || position.x >= f.x + f.width) continue;
            if (velocity.y >= 0 && previous.y + rect.height <= Math.max(f.y, f.previousY) + 2
                && position.y + rect.height >= f.y + (f.solid ? .1 : 0) && f.y < landing) {
                landing = f.y; position.y = f.y - rect.height; resolved.y = 0; grounded = true; this.support = f.index;
                tileHit = { type: f.spring ? TileType.SPRING : f.solid ? TileType.GROUND : TileType.PLATFORM,
                    col: this.worldToCol(position.x + rect.width / 2), row: this.worldToRow(f.y), side: 'bottom' };
            } else if (f.solid && velocity.y < 0 && previous.y >= f.y + f.height - .01 && position.y < f.y + f.height) {
                position.y = Math.max(position.y, f.y + f.height); resolved.y = 0;
                tileHit = { type: TileType.GROUND, col: this.worldToCol(position.x), row: this.worldToRow(f.y), side: 'top' };
            }
        }
        return { position, velocity: resolved, grounded, tileHit };
    }
}
