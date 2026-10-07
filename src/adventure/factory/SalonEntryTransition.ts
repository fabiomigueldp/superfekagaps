import { pixelText } from '../../graphics/BitmapFont';
import type { PlayerData, Rect } from '../../types';
import { FACTORY_SALON } from './FactorySalon';

/** Presentation only. The host retains its one fixed-step loop and all gameplay.
 * No clocks, listeners, callbacks, physics, save writes or input ownership live here. */
export const SALON_ENTRY_TIMING = Object.freeze({
    walk: 240, outgoing: 420, incoming: 160,
    reducedOutgoing: 80, reducedIncoming: 100,
});
export type SalonEntryStep = 'handoff' | 'finished' | null;
export interface SalonEntryFrame {
    phase: 'outgoing' | 'incoming' | 'done';
    age: number;
    walk: number;
    doorOpen: number;
    playerAlpha: number;
    shade: number;
}
const unit = (n: number) => Math.max(0, Math.min(1, n));
const smooth = (n: number) => { const p = unit(n); return p * p * (3 - 2 * p); };

/** Interaction reach only; the authored door collision/portal is unchanged.
 * A grounded approach gets the cue early enough to use while running. */
export function canApproachSalon(stage: string, player: Rect, grounded: boolean): boolean {
    const { door, support } = FACTORY_SALON;
    return stage === FACTORY_SALON.stage && grounded
        && [player.x, player.y, player.width, player.height].every(Number.isFinite)
        && player.width > 0 && player.height > 0
        && Math.abs(player.y + player.height - support.y) <= 2
        && player.x + player.width > door.x - 24 && player.x < door.x + door.width + 24
        && player.x >= support.x && player.x + player.width <= support.x + support.width;
}

export class SalonEntryTransition {
    private phase: SalonEntryFrame['phase'] = 'outgoing';
    private age = 0;
    constructor(readonly reducedMotion = false) {}
    get active(): boolean { return this.phase !== 'done'; }
    get frame(): SalonEntryFrame {
        const outgoing = this.phase === 'outgoing';
        const duration = outgoing
            ? this.reducedMotion ? SALON_ENTRY_TIMING.reducedOutgoing : SALON_ENTRY_TIMING.outgoing
            : this.reducedMotion ? SALON_ENTRY_TIMING.reducedIncoming : SALON_ENTRY_TIMING.incoming;
        return { phase: this.phase, age: this.age,
            walk: outgoing && !this.reducedMotion ? smooth(this.age / SALON_ENTRY_TIMING.walk) : 0,
            doorOpen: outgoing && !this.reducedMotion ? smooth(this.age / 180) : 0,
            playerAlpha: outgoing && !this.reducedMotion ? 1 - smooth((this.age - 250) / 120) : 1,
            shade: !this.active ? 0 : outgoing
                ? this.reducedMotion ? unit(this.age / duration) : unit((this.age - 280) / 140)
                : 1 - unit(this.age / duration),
        };
    }
    /** At most one boundary per fixed step, even after a long frame. The arrival
     * starts fully covered; it cannot accidentally advance the salon intro. */
    advance(dt: number, suspended = false): SalonEntryStep {
        if (!this.active || suspended || !Number.isFinite(dt) || dt <= 0) return null;
        const duration = this.phase === 'outgoing'
            ? this.reducedMotion ? SALON_ENTRY_TIMING.reducedOutgoing : SALON_ENTRY_TIMING.outgoing
            : this.reducedMotion ? SALON_ENTRY_TIMING.reducedIncoming : SALON_ENTRY_TIMING.incoming;
        this.age = Math.min(duration, this.age + dt);
        return this.age >= duration ? this.skip() : null;
    }
    /** E/Enter/Space can shorten presentation; never skips the salon's own pose. */
    skip(): SalonEntryStep {
        if (!this.active) return null;
        const handoff = this.phase === 'outgoing';
        this.phase = handoff ? 'incoming' : 'done'; this.age = 0;
        return handoff ? 'handoff' : 'finished';
    }
    /** Exit, retry, blur or disposal may abandon presentation without a handoff. */
    cancel(): void { this.phase = 'done'; this.age = 0; }
}

/** Draw a copy walking the last few pixels into the real doorway. The exact
 * campaign position, momentum, protection and checkpoint remain untouched. */
export function salonEntryPlayer(player: PlayerData, frame: SalonEntryFrame): PlayerData {
    const targetX = FACTORY_SALON.door.x + (FACTORY_SALON.door.width - player.width) / 2;
    const distance = targetX - player.position.x;
    const walking = frame.walk > 0 && frame.walk < 1 && Math.abs(distance) > .5;
    return { ...player,
        position: { ...player.position, x: player.position.x + distance * frame.walk },
        velocity: { ...player.velocity, x: walking ? Math.sign(distance) : 0 },
        facingRight: walking ? distance > 0 : player.facingRight,
        isRunning: false, landingTimer: 0, animationTimer: frame.age,
    };
}

/** Replaces the existing small SALÃO plate only while the real trigger is in
 * reach. The hit target remains a native accessible button over this plaque. */
export function drawSalonEntryCue(c: CanvasRenderingContext2D, cx: number, cy: number, touch = false): void {
    const x = Math.round(FACTORY_SALON.door.x + FACTORY_SALON.door.width / 2 - cx);
    const y = Math.round(FACTORY_SALON.support.y - cy - 65);
    c.save();
    c.fillStyle = '#131724'; c.fillRect(x - 29, y, 58, 12);
    c.fillStyle = '#d7ac60'; c.fillRect(x - 28, y, 56, 1); c.fillRect(x - 28, y + 11, 56, 1);
    if (touch) pixelText(c, 'ENTRAR', x, y + 3, '#f6d896', 1, 'center');
    else {
        c.fillStyle = '#d7ac60'; c.fillRect(x - 25, y + 2, 9, 8);
        pixelText(c, 'E', x - 23, y + 2, '#131724');
        pixelText(c, 'ENTRAR', x - 10, y + 3, '#f6d896');
    }
    c.restore();
}

/** Native pixels, above the existing floor and behind the actor. Match the
 * warm stage/curtains already visible in this annex rather than adding a portal. */
export function drawSalonEntryDoor(c: CanvasRenderingContext2D, cx: number, cy: number, frame: SalonEntryFrame): void {
    if (frame.phase !== 'outgoing' || frame.doorOpen <= 0) return;
    const x = Math.round(FACTORY_SALON.door.x + FACTORY_SALON.door.width / 2 - cx);
    const y = Math.round(FACTORY_SALON.support.y - cy);
    const curtain = 6 - Math.round(frame.doorOpen * 4);
    c.save(); c.translate(x, y);
    c.fillStyle = '#39313c'; c.fillRect(-15, -44, 30, 42);
    c.fillStyle = '#49343d'; c.fillRect(-11, -39, 22, 37);
    c.fillStyle = '#6b4943'; c.fillRect(-10, -8, 20, 6);
    c.fillStyle = '#d7ac60'; c.fillRect(-10, -4, 20, 1);
    for (const left of [-15, 15 - curtain]) {
        c.fillStyle = '#583341'; c.fillRect(left, -44, curtain, 39);
        c.fillStyle = '#402a37'; c.fillRect(left + 1, -43, 1, 37);
        c.fillStyle = '#d7ac60'; c.fillRect(left, -22, curtain, 2);
    }
    c.fillStyle = '#f6d896'; c.fillRect(-4, -53, 8, 1);
    c.restore();
}

/** Paint after the native scene and before its existing present() call. */
export function drawSalonEntryShade(c: CanvasRenderingContext2D, frame: SalonEntryFrame): void {
    if (frame.shade <= 0) return;
    c.save(); c.globalAlpha = frame.shade;
    c.fillStyle = '#191f35'; c.fillRect(0, 0, 320, 180); c.restore();
}

/** Same world anchor as the painted plaque; no viewport-bottom popup. */
export function salonEntryButtonPosition(rect: Pick<DOMRect, 'left' | 'top' | 'width' | 'height'>,
    camera: { x: number; y: number }): { left: number; top: number; width: number; height: number } {
    const sx = rect.width / 320, sy = rect.height / 180;
    return {
        left: rect.left + (FACTORY_SALON.door.x + FACTORY_SALON.door.width / 2 - camera.x) * sx,
        top: rect.top + (FACTORY_SALON.support.y - 59 - camera.y) * sy,
        width: Math.max(44, 58 * sx), height: Math.max(44, 12 * sy),
    };
}
