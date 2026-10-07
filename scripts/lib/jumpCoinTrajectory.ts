import { Player } from '../../src/entities/Player';
import { WorldLevel, WorldObjects, BELT_CARRY_SPEED } from '../../src/adventure/WorldPhysics';
import { overlaps, type AdventureStage, type Pickup } from '../../src/adventure/types';
import { TileType } from '../../src/constants';
import { isSolidTile } from '../../src/world/tileRules';
import type { InputState, Rect } from '../../src/types';

export const JUMP_STEP_MS = 1000 / 60;
const idle: InputState = { left: false, right: false, run: false, jump: false, down: false, start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
export interface JumpWitness {
    /** World pixels: player left edge and supporting surface height. */
    x: number;
    feetY: number;
    run: boolean;
    /** Frames held before release; 60 holds through the entire ordinary jump. */
    hold: number;
    /** Approach uses actual movement on the launch surface. */
    approachFrames?: number;
}
export interface JumpTrace { frames: Rect[]; landed: boolean; dead: boolean; launchGrounded: boolean; landingFeet: number; rise: number; hazardContact: boolean; }

/** Real fixed-step Player/WorldLevel/WorldObjects, including belts and falling tiles.
 * This local traversal witness does not simulate combat or solve an entire stage. */
export function traceJump(stage: AdventureStage, witness: JumpWitness): JumpTrace {
    const level = new WorldLevel(stage.level), objects = new WorldObjects(stage.mechanisms);
    level.bodies = objects.bodies;
    const player = new Player(witness.x / 16, witness.feetY / 16);
    let hazardContact = false;
    const step = (input: InputState) => {
        const prev = player.getRect(), grounded = player.data.isGrounded;
        level.updateDynamicTiles(JUMP_STEP_MS);
        objects.update(JUMP_STEP_MS, level, prev.x);
        if (grounded) {
            player.data.position = level.transport(prev);
            const belt = level.beltAt(player.getRect());
            if (belt) player.data.position = level.resolveCollision(player.getRect(), { x: (belt.direction ?? 1) * (belt.active ? -1 : 1) * BELT_CARRY_SPEED, y: 0 }, player.getRect()).position;
        }
        player.update(JUMP_STEP_MS, input, level);
        const p = player.getRect();
        hazardContact ||= level.checkSpikeCollision(p) || level.checkLavaCollision(p);
        if (player.data.isGrounded) {
            const c = level.worldToCol(p.x + p.width / 2), r = level.worldToRow(p.y + p.height + 1);
            if (level.getTile(c, r) === TileType.PLATFORM_FALLING) level.markFallingPlatformContact(c, r);
        }
        level.updateFallingPlatforms(JUMP_STEP_MS);
    };
    step(idle);
    let approachSupported = player.data.isGrounded;
    for (let i = 0; i < (witness.approachFrames ?? 0); i++) {
        step({ ...idle, right: true, run: witness.run });
        approachSupported &&= player.data.isGrounded;
    }
    const launchRect = player.getRect();
    let embedded = false;
    for (let row = Math.floor(launchRect.y / 16); row <= Math.floor((launchRect.y + launchRect.height - .01) / 16); row++)
        for (let col = Math.floor(launchRect.x / 16); col <= Math.floor((launchRect.x + launchRect.width - .01) / 16); col++)
            if (isSolidTile(level.getTile(col, row))) embedded = true;
    const launchGrounded = approachSupported && player.data.isGrounded && !embedded && Math.abs(player.getFeetPosition().y - witness.feetY) < .01;
    const frames = [player.getRect()];
    const launchFeet = player.getFeetPosition().y;
    for (let i = 0; i < 120; i++) {
        step({ ...idle, right: true, run: witness.run,
            jump: i < witness.hold, jumpPressed: i === 0, jumpReleased: i === witness.hold });
        frames.push(player.getRect());
        if (player.data.isDead || i > 1 && player.data.isGrounded) break;
    }
    return { frames, landed: player.data.isGrounded, dead: player.data.isDead, launchGrounded,
        hazardContact, landingFeet: player.getFeetPosition().y, rise: launchFeet - Math.min(...frames.map(p => p.y + p.height)) };
}
export function sampleJumpCoins(trace: JumpTrace, count: number, endTrim = 0) {
    const frames = trace.frames.slice(0, trace.frames.length - endTrim);
    if (count < 2 || frames.length < 2) throw new Error('A coin trail needs a traversable path and at least two coins.');
    // Space by travelled distance, so shuttle dwell frames never stack rewards.
    const distance = [0];
    for (let i = 1; i < frames.length; i++)
        distance.push(distance[i - 1] + Math.hypot(frames[i].x - frames[i - 1].x, frames[i].y - frames[i - 1].y));
    return Array.from({ length: count }, (_, i) => {
        const target = i / (count - 1) * distance[distance.length - 1];
        let index = distance.findIndex(d => d >= target);
        if (index > 0 && target - distance[index - 1] < distance[index] - target) index--;
        const p = frames[index];
        return { x: Math.round((p.x + p.width / 2 - 8) * 10) / 10, y: Math.round((p.y + p.height / 2 - 9) * 10) / 10 };
    });
}
export function collectedOnTrace(trace: JumpTrace, pickups: readonly Pick<Pickup, 'x' | 'y'>[]) {
    return pickups.filter(p => trace.frames.some(f => overlaps(f, { ...p, width: 16, height: 18 }))).length;
}

export interface CarrierWitness { carrier: string; offsetX: number; }
/** Follow the real secret shuttle's home-to-arrival leg without jumping off it. */
export function traceCarrierRide(stage: AdventureStage, witness: CarrierWitness): JumpTrace {
    const level = new WorldLevel(stage.level), objects = new WorldObjects(stage.mechanisms);
    level.bodies = objects.bodies;
    const body = objects.get(witness.carrier);
    if (!body?.to || !body.period) throw new Error(`Missing carrier ${stage.id}:${witness.carrier}`);
    const player = new Player((body.x + witness.offsetX) / 16, body.y / 16);
    player.update(JUMP_STEP_MS, idle, level);
    const launchGrounded = player.data.isGrounded;
    let hazardContact = false;
    const frames = [player.getRect()], launchFeet = player.getFeetPosition().y;
    for (let i = 0; i < Math.ceil(body.period / 2 / JUMP_STEP_MS); i++) {
        const previous = player.getRect();
        objects.update(JUMP_STEP_MS, level, previous.x);
        if (player.data.isGrounded) player.data.position = level.transport(previous);
        player.update(JUMP_STEP_MS, idle, level);
        hazardContact ||= level.checkSpikeCollision(player.getRect()) || level.checkLavaCollision(player.getRect());
        frames.push(player.getRect());
    }
    return { frames, launchGrounded, landed: player.data.isGrounded, dead: player.data.isDead,
        hazardContact, landingFeet: player.getFeetPosition().y, rise: launchFeet - Math.min(...frames.map(p => p.y + p.height)) };
}
