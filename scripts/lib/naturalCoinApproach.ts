import { WorldGame } from '../../src/adventure/WorldGame';
import { ProgressStore } from '../../src/adventure/progress';
import { WorldTutorial } from '../../src/adventure/WorldTutorial';
import type { AdventureStage, Pickup } from '../../src/adventure/types';
import type { InputState, Rect } from '../../src/types';

const idle: InputState = { left: false, right: false, run: false, jump: false, down: false,
    start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
export interface ApproachJump { x: number; hold: number; }
export interface CoinApproach {
    stage: string;
    name: string;
    firstCoin: number;
    count: number;
    /** Existing checkpoint index, stage spawn, or the preceding authored surface. */
    entry: 'spawn' | { checkpoint: number } | { x: number; feetY: number; source: string };
    prelude?: ApproachJump[];
    /** Missing means follow the actual descending surfaces without inventing a jump. */
    jump?: ApproachJump;
    followup?: ApproachJump[];
    endX: number;
    endFeetY: number;
}
export interface ApproachVariant { run: boolean; shift?: number; hold?: number; phaseFrames?: number; reactionFrames?: number; brakeFrames?: number; }
export interface ApproachFrame extends Rect { frame: number; vx: number; vy: number; grounded: boolean; cameraX: number; cameraY: number; }
export interface ApproachTrace {
    frames: ApproachFrame[];
    jumped: { frame: number; x: number; feetY: number; vx: number }[];
    landed: { frame: number; x: number; feetY: number; vx: number }[];
    collected: string[];
    reached: boolean;
    dead: boolean;
    damaged: boolean;
    stopped: string;
}
/** Uses WorldGame.load/update so hazards, barrels, foes, pickup rectangles and
 * camera are production behavior. Only input delivery/audio/drawing/storage are
 * detached. The surface entry is explicit; it is never presented as a full level. */
export function traceNaturalApproach(stage: AdventureStage, plan: CoinApproach, variant: ApproachVariant): ApproachTrace {
    // Same read-only boundary harness as world-campaign-camera.test.ts.
    const game = Object.create(WorldGame.prototype) as any;
    const store = new ProgressStore(null), noop = () => {};
    let controls = { ...idle };
    for (const d of stage.dialogues) store.save.seen.push(`dialogue:${d.id}`);
    store.save.seen.push('control:jump', 'control:run', 'control:pound');
    if (typeof plan.entry === 'object' && 'checkpoint' in plan.entry)
        store.save.checkpoint = { stage: stage.id, index: plan.entry.checkpoint, helmet: false };
    const data = structuredClone(stage);
    if (typeof plan.entry === 'object' && 'x' in plan.entry) data.level.playerSpawn = { x: plan.entry.x / 16, y: plan.entry.feetY / 16 };
    Object.assign(game, { store, tutorial: new WorldTutorial(store), time: 0, toastTimer: 0,
        state: 'title', camera: { x: 0, y: 0, shakeTimer: 0 }, buttons: [],
        input: { reset() { controls = { ...idle }; }, setMenuMode: noop, update: noop,
            consumeMute: () => false, consumePause: () => false, getState: () => controls },
        audio: new Proxy({}, { get: () => noop }), renderer: { advanceClock: noop, addImpact: noop } });
    game.load(stage.id, typeof plan.entry === 'object' && 'checkpoint' in plan.entry, data);
    const jumps = [...(plan.prelude ?? []), ...(plan.jump ? [{ x: plan.jump.x + (variant.shift ?? 0), hold: variant.hold ?? plan.jump.hold }] : []), ...(plan.followup ?? [])];
    const trace: ApproachTrace = { frames: [], jumped: [], landed: [], collected: [], reached: false, dead: false, damaged: false, stopped: '' };
    let next = 0, held = -1, jumpFrame = -1, wasGrounded = false;
    let targetLanding = -1;
    const targetIndex = (plan.prelude?.length ?? 0) + (plan.jump ? 1 : 0);
    for (let frame = 0; frame < 1000; frame++) {
        const p = game.player.data;
        const response = targetLanding < 0 ? -1 : frame - targetLanding;
        const reaction = variant.reactionFrames ?? 0, braking = variant.brakeFrames ?? 0;
        const waiting = response >= 0 && response <= reaction + braking;
        const brake = waiting && response > reaction;
        const launch = frame >= (variant.phaseFrames ?? 0) && !waiting && p.isGrounded && next < jumps.length && p.position.x >= jumps[next].x;
        if (launch) { held = jumps[next++].hold; jumpFrame = frame; }
        controls = { ...idle, right: frame >= (variant.phaseFrames ?? 0) && !brake, run: variant.run,
            jump: held >= 0 && frame - jumpFrame < held, jumpPressed: launch,
            jumpReleased: held >= 0 && frame - jumpFrame === held };
        const wasJumping = p.isJumping, hadHelmet = p.hasHelmet;
        game.update(1000 / 60);
        const rect = game.player.getRect(), now = game.player.data;
        trace.damaged ||= hadHelmet && !now.hasHelmet || now.isDead && now.deathKind === 'hit';
        if (launch && !wasJumping && !now.isGrounded)
            trace.jumped.push({ frame, x: rect.x, feetY: rect.y + rect.height, vx: now.velocity.x });
        if (!wasGrounded && now.isGrounded) {
            trace.landed.push({ frame, x: rect.x, feetY: rect.y + rect.height, vx: now.velocity.x });
            if (next === targetIndex && targetLanding < 0 && trace.jumped.length > 0) {
                targetLanding = frame;
                held = -1;
            }
        }
        wasGrounded = now.isGrounded;
        trace.frames.push({ ...rect, frame, vx: now.velocity.x, vy: now.velocity.y, grounded: now.isGrounded, cameraX: game.camera.x, cameraY: game.camera.y });
        if (now.isDead) { trace.dead = true; trace.stopped = now.deathKind ?? 'hurt'; break; }
        if (now.isGrounded && rect.x >= plan.endX && Math.abs(rect.y + rect.height - plan.endFeetY) < .01) { trace.reached = true; break; }
        if (game.state !== 'playing') { trace.stopped = game.state; break; }
    }
    trace.collected = [...game.collected] as string[];
    return trace;
}
export function approachCoins(stage: AdventureStage, plan: Pick<CoinApproach, 'stage' | 'firstCoin' | 'count'>): Pickup[] {
    const ids = new Set(Array.from({ length: plan.count }, (_, i) => `${plan.stage}:c${plan.firstCoin + i}`));
    return stage.pickups.filter(p => ids.has(p.id));
}
