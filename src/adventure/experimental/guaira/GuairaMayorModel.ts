import type { Rect } from '../../../types';

/** Provisional fictional encounter, measured in logical pixels and fixed 60 Hz ticks. */
export const MAYOR_ARENA = Object.freeze({
    id: 'guaira-prefeito', width: 320, height: 288, floor: 224, deckY: 160,
    valveId: 'guaira-mayor-register', liftId: 'guaira-mayor-lift', deckId: 'guaira-mayor-deck',
    valve: Object.freeze({ x: 64, y: 216, width: 32, height: 8 }),
    lift: Object.freeze({ x: 112, y: 224, width: 112, height: 8 }),
    deck: Object.freeze({ x: 224, y: 160, width: 92, height: 8 }),
    vent: Object.freeze({ x: 112, y: 204, width: 112, height: 20 })
});
export const MAYOR_RULES = Object.freeze({ tickMs: 1000 / 60, intro: 72, idle: 30, warning: 60,
    stamp: 24, recover: 270, hurt: 45, seals: 3 });
export type MayorState = 'intro' | 'idle' | 'warning' | 'stamp' | 'recover' | 'hurt' | 'released';
export interface MayorAccess { valveActive: boolean; liftReady: boolean; registerOpened: boolean }
export interface MayorEvent { kind: 'warning' | 'stamp' | 'hit' | 'released'; tick: number }
export const mayorOverlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;

/** Access comes from native WorldObjects; this model never moves or invents a Player. */
export class GuairaMayorModel implements Rect {
    readonly x = 264; readonly y = 120; readonly width = 28; readonly height = 40;
    /** The exposed upper back, not empty pixels beside the bent silhouette. */
    readonly opening = Object.freeze({ x: 274, y: 120, width: 14, height: 6 });
    state: MayorState = 'intro'; stateTick = 0; tick = 0; cycle = 0;
    sealsRemaining: number = MAYOR_RULES.seals;
    stampTarget: Readonly<Rect> = Object.freeze({ ...MAYOR_ARENA.vent });
    events: MayorEvent[] = [];
    private remainder = 0;
    private freshOpening = false;
    private accessReady = false;
    private valveActive = false;
    get publicWaterOpen() { return this.state === 'released'; }
    get registerOpenedThisCycle() { return this.freshOpening; }
    get accessRequested() { return this.freshOpening && this.valveActive; }
    get vulnerable() { return this.state === 'recover' && this.freshOpening && this.accessReady; }
    get warningProgress() { return Math.min(1, this.stateTick / MAYOR_RULES.warning); }
    get danger(): Readonly<Rect> | null { return this.state === 'stamp' ? this.stampTarget : null; }
    private enter(state: MayorState) { this.state = state; this.stateTick = 0; }
    private emit(kind: MayorEvent['kind']) { this.events.push({ kind, tick: this.tick }); }

    update(dt: number, access: MayorAccess) {
        this.events = [];
        if (!Number.isFinite(dt) || dt <= 0) return;
        if ((this.state === 'stamp' || this.state === 'recover') && access.registerOpened && access.valveActive)
            this.freshOpening = true;
        this.valveActive = access.valveActive;
        this.accessReady = access.valveActive && access.liftReady;
        // A resumed browser frame cannot consume an entire warning.
        this.remainder += Math.min(dt, 100);
        while (this.remainder + 1e-7 >= MAYOR_RULES.tickMs) {
            this.remainder -= MAYOR_RULES.tickMs;
            this.tick++; this.stateTick++;
            switch (this.state) {
                case 'intro': if (this.stateTick >= MAYOR_RULES.intro) this.enter('idle'); break;
                case 'idle': if (this.stateTick >= MAYOR_RULES.idle) {
                    this.cycle++;
                    // The warned vent is the exact future danger. No tracking.
                    this.stampTarget = Object.freeze({ ...MAYOR_ARENA.vent });
                    this.enter('warning'); this.emit('warning');
                } break;
                case 'warning': if (this.stateTick >= MAYOR_RULES.warning) {
                    this.freshOpening = this.accessReady = this.valveActive = false;
                    this.enter('stamp'); this.emit('stamp');
                } break;
                case 'stamp': if (this.stateTick >= MAYOR_RULES.stamp) this.enter('recover'); break;
                case 'recover': if (this.stateTick >= MAYOR_RULES.recover) this.enter('idle'); break;
                case 'hurt': if (this.stateTick >= MAYOR_RULES.hurt) this.enter('idle'); break;
            }
        }
    }

    /** A real falling top contact is the only way to release a public-water lock. */
    contact(player: Rect, previous: Rect, falling: boolean): 'none' | 'hurt' | 'bounce' | 'hit' | 'defeated' {
        if (this.state === 'intro' || this.state === 'hurt' || this.state === 'released') return 'none';
        if (mayorOverlaps(player, this)) {
            if (falling && previous.y + previous.height <= this.y + 1e-7) {
                if (!this.vulnerable || !mayorOverlaps(player, this.opening)) return 'bounce';
                this.sealsRemaining--;
                this.freshOpening = this.accessReady = false;
                const released = this.sealsRemaining === 0;
                this.enter(released ? 'released' : 'hurt'); this.emit(released ? 'released' : 'hit');
                return released ? 'defeated' : 'hit';
            }
            // The exact warned vent is the only damage source. A player beside
            // the mayor cannot be hurt merely because a recovery window ends.
        }
        return this.danger && mayorOverlaps(player, this.danger) ? 'hurt' : 'none';
    }
}
