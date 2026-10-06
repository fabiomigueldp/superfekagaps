import type { Vector2 } from '../types';
import { isSolidTile } from '../world/tileRules';
import type { MechanismMount } from './types';
import type { MovingBody, WorldLevel } from './WorldPhysics';
import { CARRIER_CLEARANCE, carrierRoute, carrierTrolley } from './WorldCarrierMotion';

/** Keep the entire usable deck under the rail, including a rider at either edge.
 * Both track and bogie consume this exact offset; the physical route is unchanged. */
export function carrierRailClearance(b: MovingBody): number {
    const route = carrierRoute(b);
    if (!route || Math.abs(route.to.x - route.home.x) < .001) return CARRIER_CLEARANCE;
    return CARRIER_CLEARANCE + Math.ceil(Math.abs((route.to.y - route.home.y) / (route.to.x - route.home.x)) * (b.width / 2 + 4));
}
export const carrierRenderRoute = (b: MovingBody) => carrierRoute(b, carrierRailClearance(b));
export const carrierRenderTrolley = (b: MovingBody) => carrierTrolley(b, carrierRailClearance(b));

/** Only the deck is a collision surface. These fixed, rear-plane mounts describe
 * where its equipment transfers its load into actual authored terrain. */
export type CarrierFamily = 'rail' | 'hoist' | 'lowering' | 'static';
export function carrierFamily(b: MovingBody): CarrierFamily {
    const route = carrierRoute(b);
    if (!route) return 'static';
    if (Math.abs(route.to.x - route.home.x) < .001) return b.kind === 'support' ? 'lowering' : 'hoist';
    // Legacy diagonal lifts/supports retain their route, using a compatible rail.
    return 'rail';
}
type TerrainView = readonly (readonly number[])[];
function solidAt(level: WorldLevel, tiles: TerrainView, x: number, y: number): boolean {
    return isSolidTile(tiles[level.worldToRow(y)]?.[level.worldToCol(x)]);
}
export function carrierMountIsAnchored(mount: MechanismMount, level: WorldLevel, tiles: TerrainView = level.getRenderTiles()): boolean {
    if (![mount.x, mount.y].every(Number.isFinite)) return false;
    if (mount.kind === 'wall') {
        return [-3, 2].every(dx => [-7, 6].every(dy => solidAt(level, tiles, mount.x + dx, mount.y + dy)));
    }
    return [-6, 0, 5].every(dx => solidAt(level, tiles, mount.x + dx, mount.y + 1) && !solidAt(level, tiles, mount.x + dx, mount.y - 1));
}
function groundMount(level: WorldLevel, tiles: TerrainView, target: Vector2): MechanismMount | null {
    const col = level.worldToCol(target.x), first = Math.max(0, level.worldToRow(target.y));
    // A bounded, real foundation search supports old editor maps. Missing ground
    // means no foundation, never an invented post ending at the map bottom.
    for (let distance = 0; distance <= 8; distance++) for (const direction of distance ? [-1, 1] : [0]) {
        const x = level.colToWorldX(col + distance * direction) + 8;
        for (let row = first; row < level.data.height; row++) {
            const mount: MechanismMount = { x, y: level.rowToWorldY(row), kind: 'ground' };
            if (mount.y >= target.y && carrierMountIsAnchored(mount, level, tiles)) return mount;
        }
    }
    return null;
}
export function carrierMounts(b: MovingBody, level?: WorldLevel): readonly (MechanismMount | null)[] {
    const family = carrierFamily(b), route = carrierRoute(b);
    if (!route) return [];
    const tiles = level?.getRenderTiles();
    if (b.mounts !== undefined) return Array.isArray(b.mounts) && b.mounts.length === 2 ? b.mounts.map(mount =>
        mount && typeof mount === 'object' && [mount.x, mount.y].every(Number.isFinite) &&
        (mount.kind === 'ground' || mount.kind === 'wall') && (!level || carrierMountIsAnchored(mount, level, tiles)) ? mount : null) : [null, null];
    if (!level) return [null, null];
    const bottom = Math.max(route.home.y, route.to.y) + b.height;
    const targets = family === 'rail'
        ? [route.home, route.to].map(p => ({ x: p.x + b.width / 2, y: p.y }))
        : [{ x: route.home.x - 8, y: bottom }, { x: route.home.x + b.width + 8, y: bottom }];
    return targets.map(target => groundMount(level, tiles!, target));
}
export function carrierWheelCenters(b: MovingBody): readonly Vector2[] {
    const route = carrierRenderRoute(b);
    if (!route) return [];
    const trolley = carrierRenderTrolley(b), sign = route.normal.y > 0 ? -1 : 1;
    return [-6, 6].map(offset => ({
        x: trolley.x + route.tangent.x * offset + route.normal.x * sign * 4,
        y: trolley.y + route.tangent.y * offset + route.normal.y * sign * 4,
    }));
}
/** Bounds include fixed equipment even when its moving deck is out of view. */
export function carrierStructureBounds(b: MovingBody, mounts: readonly (MechanismMount | null)[]) {
    const route = carrierRenderRoute(b);
    if (!route) return null;
    const points = [...Object.values(route.rail), route.home, route.to, ...mounts.filter((m): m is MechanismMount => !!m)];
    return { left: Math.min(...points.map(p => p.x)) - 16, right: Math.max(...points.map(p => p.x)) + b.width + 16,
        top: Math.min(...points.map(p => p.y)) - 16, bottom: Math.max(...points.map(p => p.y)) + b.height + 18 };
}

/** Hoist crossheads clear the immutable envelope of overlapping rail bogies.
 * In a shared station, a higher transfer carriage must not pass through a lower
 * lift's overhead beam. Current platform positions never change this geometry. */
export function carrierSceneHeadroom(bodies: readonly MovingBody[]): Map<string, number> {
    const rails: { left: number; right: number; top: number }[] = [], hoists: MovingBody[] = [];
    for (const b of bodies) {
        const family = carrierFamily(b), route = carrierRenderRoute(b);
        if (!route) continue;
        if (family === 'hoist') hoists.push(b);
        if (family === 'rail') rails.push({ left: Math.min(route.home.x, route.to.x) - 8,
            right: Math.max(route.home.x, route.to.x) + b.width + 8,
            top: Math.min(route.rail.from.y, route.rail.to.y) - 14 });
    }
    const result = new Map<string, number>();
    for (const b of hoists) {
        const route = carrierRenderRoute(b)!;
        let top = Math.min(route.home.y, route.to.y) - CARRIER_CLEARANCE;
        for (const rail of rails) if (rail.left <= route.home.x + b.width + 8 && rail.right >= route.home.x - 8) top = Math.min(top, rail.top);
        result.set(b.id, top);
    }
    return result;
}
