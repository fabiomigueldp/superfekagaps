import type { JuiceMinibossLab } from './JuiceMinibossLab';

export type JuiceEpilogueBeat = 'return' | 'boast' | 'judges' | 'insist' | 'complete';
export const JUICE_EPILOGUE_DURATION_MS = 6400;
const BEATS = [
    ['return', 800], ['boast', 1800], ['judges', 2000], ['insist', 1800],
] as const;

export interface JuiceEpilogueFrame {
    readonly beat: JuiceEpilogueBeat;
    readonly timeMs: number;
    readonly elapsedMs: number;
    readonly hasHelmet: boolean;
}

/** Presentation only. Bind one controller to one real lab; call update AFTER
 * lab.update. No Input, audio, Player, boss, save or DOM writes. The host owns
 * controls, drawing and disposal. This is deliberately not installed by default. */
export class JuiceEpilogue {
    private attempt: JuiceMinibossLab['boss'] = null;
    private started = false;
    private elapsed = 0;
    private helmet = false;
    private disposed = false;

    constructor(private readonly lab: JuiceMinibossLab) {}

    private get resultValid(): boolean {
        return !this.disposed && !this.lab.isDisposed && this.lab.labMode === 'result'
            && (this.lab.state === 'playing' || this.lab.state === 'paused')
            && this.lab.boss !== null && this.lab.boss.phase === 'defeated'
            && this.lab.boss.health === 0 && !this.lab.player.data.isDead;
    }

    /** Also clears a stale completed result on same-turn Retry/Replay. */
    private syncAttempt(): void {
        if (this.attempt !== this.lab.boss || !this.resultValid) {
            this.attempt = this.lab.boss;
            this.started = false;
            this.elapsed = 0;
        }
    }

    update(dtMs: number): void {
        if (this.disposed) return;
        this.syncAttempt();
        if (!Number.isFinite(dtMs) || dtMs <= 0 || !this.resultValid || this.lab.state !== 'playing') return;
        if (!this.started) {
            // The real final stomp bounces Feka. Let the existing result pipeline
            // finish that landing before cutting to a scenic, clothed actor.
            if (!this.lab.player.data.isGrounded) return;
            this.started = true;
            this.helmet = this.lab.player.data.hasHelmet;
            return;
        }
        // A suspended tab cannot consume the story in one oversized update.
        this.elapsed = Math.min(JUICE_EPILOGUE_DURATION_MS, this.elapsed + Math.min(dtMs, 100));
    }

    /** Only an active, unpaused epilogue can be skipped. No synthetic victory. */
    skip(): boolean {
        if (this.disposed) return false;
        this.syncAttempt();
        if (!this.frame || this.lab.state !== 'playing' || this.elapsed === JUICE_EPILOGUE_DURATION_MS) return false;
        this.elapsed = JUICE_EPILOGUE_DURATION_MS;
        return true;
    }

    /** A retained UI callback cannot resurrect a prior attempt. Reading/rendering
     * never advances time, including the indefinitely held final tableau. */
    get frame(): Readonly<JuiceEpilogueFrame> | null {
        if (!this.started || this.attempt !== this.lab.boss || !this.resultValid) return null;
        let remaining = this.elapsed;
        for (const [beat, duration] of BEATS) {
            if (remaining < duration) return Object.freeze({ beat, timeMs: this.elapsed, elapsedMs: remaining, hasHelmet: this.helmet });
            remaining -= duration;
        }
        return Object.freeze({ beat: 'complete', timeMs: JUICE_EPILOGUE_DURATION_MS, elapsedMs: 0, hasHelmet: this.helmet });
    }

    dispose(): void {
        this.disposed = true;
        this.started = false;
        this.attempt = null;
    }
}
