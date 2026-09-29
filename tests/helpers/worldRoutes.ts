import { Player } from '../../src/entities/Player';
import { WorldLevel } from '../../src/adventure/WorldPhysics';
import type { AdventureStage } from '../../src/adventure/types';
import { isSolidTile, isOneWayTile } from '../../src/world/tileRules';
import type { InputState } from '../../src/types';
interface Surface {
    x: number;
    y: number;
    width: number;
    mechanism?: string;
    end?: boolean;
}
const idle: InputState = { left: false, right: false, run: true, jump: false, down: false, start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
/** Local jumps use the real Player and collision code. Mechanism edges separately model riding.
 * This is a geometry audit, not a full playthrough with enemies, timing and collectibles. */
export function auditRoute(stage: AdventureStage) {
    const surfaces: Surface[] = [], tiles = stage.level.tiles;
    for (let row = 1; row < tiles.length; row++) {
        let start = -1;
        for (let col = 0; col <= stage.level.width; col++) {
            const t = tiles[row][col], clear = col < stage.level.width && (isSolidTile(t) || isOneWayTile(t)) && !isSolidTile(tiles[row - 1][col]) && (row < 2 || !isSolidTile(tiles[row - 2][col]));
            if (clear && start < 0)
                start = col;
            if (!clear && start >= 0) {
                surfaces.push({ x: start * 16, y: row * 16, width: (col - start) * 16 });
                start = -1;
            }
        }
    }
    for (const m of stage.mechanisms.filter(m => ['platform', 'lift', 'support', 'swing'].includes(m.kind))) {
        surfaces.push({ x: m.x, y: m.y, width: m.width, mechanism: m.id });
        if (m.to)
            surfaces.push({ x: m.to.x, y: m.to.y, width: m.width, mechanism: m.id, end: true });
    }
    const at = (x: number, y: number) => surfaces.findIndex(s => x >= s.x - 2 && x <= s.x + s.width + 2 && Math.abs(s.y - y) < 9);
    const start = at(stage.level.playerSpawn.x * 16, stage.level.playerSpawn.y * 16);
    const reached = new Set<number>(start < 0 ? [] : [start]), edges: Record<string, number> = {};
    const level = new WorldLevel(stage.level);
    // Endpoint fixtures are only used to probe each local landing. The runtime still moves one real body.
    level.bodies = surfaces.filter(s => s.mechanism).map((s, i) => ({ id: `probe${i}`, kind: 'platform', x: s.x, y: s.y, width: s.width, height: 8, px: s.x, py: s.y, active: false, timer: 0 }));
    function canJump(a: Surface, b: Surface): boolean {
        if (b.y < a.y - 116)
            return false;
        const gap = Math.max(0, b.x - (a.x + a.width), a.x - (b.x + b.width));
        if (gap > 205)
            return false;
        const dir = b.x + b.width / 2 >= a.x + a.width / 2 ? 1 : -1;
        const landing = Math.max(b.x + 5, Math.min(b.x + b.width - 13, dir > 0 ? b.x + 15 : b.x + b.width - 23));
        const starts = [dir > 0 ? a.x + a.width - 20 : a.x + 4, a.x + a.width / 2 - 7, dir > 0 ? a.x + a.width - 52 : a.x + 36, b.x - 58, b.x + b.width + 42].map(x => Math.max(a.x + 1, Math.min(a.x + a.width - 15, x)));
        for (const sx of starts)
            for (const hold of [9, 4, 0]) {
                const p = new Player(sx / 16, a.y / 16);
                p.data.isGrounded = true;
                p.data.velocity.x = dir * 3.5;
                for (let i = 0; i < 100; i++) {
                    const x = p.data.position.x, dx = landing - x, feet = p.data.position.y + p.data.height;
                    const brake = Math.abs(dx) < 10 || dx * p.data.velocity.x < 0;
                    const input = { ...idle, left: brake ? p.data.velocity.x > 1 : dx < -2, right: brake ? p.data.velocity.x < -1 : dx > 2, jump: i < hold, jumpPressed: i === 0 && hold > 0, jumpReleased: i === hold && hold > 0 };
                    p.update(1000 / 60, input, level);
                    if (i > 2 && p.data.isGrounded && Math.abs(p.data.position.y + p.data.height - b.y) < 2 && p.data.position.x + p.data.width > b.x + 1 && p.data.position.x < b.x + b.width - 1)
                        return true;
                    if (p.data.isDead || feet > 360 || i > 6 && p.data.isGrounded && Math.abs(p.data.position.x - sx) < 3)
                        break;
                }
            }
        return false;
    }
    const attempted = new Set<string>();
    let changed = true;
    while (changed) {
        changed = false;
        for (const a of [...reached])
            for (let b = 0; b < surfaces.length; b++) {
                if (reached.has(b))
                    continue;
                const from = surfaces[a], to = surfaces[b];
                if (from.mechanism && from.mechanism === to.mechanism) {
                    const button = stage.mechanisms.find(m => m.link === from.mechanism);
                    if (button) {
                        const floor = at(button.x + button.width / 2, button.y + button.height);
                        if (floor < 0 || !reached.has(floor))
                            continue;
                    }
                    reached.add(b);
                    edges[b] = a;
                    changed = true;
                    continue;
                }
                const key = `${a}:${b}`;
                if (attempted.has(key))
                    continue;
                attempted.add(key);
                if (canJump(from, to)) {
                    reached.add(b);
                    edges[b] = a;
                    changed = true;
                }
            }
    }
    const exit = stage.exits.find(e => e.id === 'normal')!, finish = at(exit.x, exit.y + exit.height);
    return { ok: finish >= 0 && reached.has(finish), surfaces, reached: [...reached], unreachable: surfaces.filter((_, i) => !reached.has(i)), edges };
}
