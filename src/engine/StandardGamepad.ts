import { DisposalScope } from './DisposalScope';
import { Input, type InputActionSource } from './Input';

export type GamepadMode = 'playing' | 'paused' | 'inactive';
const DEADZONE = .25;

/** Opt-in standard controller, sampled by its host. Never synthesizes DOM keys/clicks. */
export class StandardGamepad {
    private readonly lifetime = new DisposalScope();
    private readonly sources: InputActionSource[] = [];
    private selected: { index: number; id: string } | null = null;
    private mode: GamepadMode = 'inactive';
    private armed = false;
    private pauseHeld = false;
    private blurred = false;
    private pageHidden = false;

    constructor(private readonly input: Input) {
        try {
            // One reset notification invalidates all four owners, even when the
            // host pauses and resumes between two samples of the same mode.
            for (let i = 0; i < 4; i++) {
                const source = input.createActionSource(i === 0 ? () => this.reset() : undefined);
                this.sources.push(source);
                this.lifetime.add(() => source.dispose());
            }
            this.lifetime.listen(window, 'blur', () => { this.blurred = true; this.reset(); });
            this.lifetime.listen(window, 'focus', () => { this.blurred = false; this.reset(); });
            this.lifetime.listen(window, 'pagehide', () => { this.pageHidden = true; this.reset(); });
            this.lifetime.listen(window, 'pageshow', () => { this.pageHidden = false; this.reset(); });
            this.lifetime.listen(document, 'visibilitychange', () => this.reset());
            for (const event of ['gamepadconnected', 'gamepaddisconnected'] as const) {
                this.lifetime.listen(window, event, e => {
                    if (e.gamepad.index === this.selected?.index) this.forgetDevice();
                });
            }
        } catch (error) { this.dispose(); throw error; }
    }

    /** Cancels only this device's unsampled gestures; other Input owners survive. */
    private reset(): void {
        this.armed = false; this.pauseHeld = false;
        for (const source of this.sources) source.cancel();
    }

    private forgetDevice(): void { this.reset(); this.selected = null; }

    /** Returns one Start/Options edge. The host owns the actual pause transition. */
    update(mode: GamepadMode): boolean {
        if (this.lifetime.isDisposed || this.input.isDisposed) return false;
        if (mode !== this.mode) { this.reset(); this.mode = mode; }
        if (mode === 'inactive' || document.hidden || this.blurred || this.pageHidden ||
            (typeof document.hasFocus === 'function' && !document.hasFocus())) {
            this.reset(); return false;
        }
        let pads: (Gamepad | null)[];
        try { pads = Array.from(navigator.getGamepads?.() ?? []); }
        catch { this.forgetDevice(); return false; }
        const supported = pads.filter((pad): pad is Gamepad => !!pad?.connected && pad.mapping === 'standard');
        const pad = supported.find(p => p.index === this.selected?.index && p.id === this.selected.id) ?? supported[0];
        if (!pad) { this.forgetDevice(); return false; }
        if (pad.index !== this.selected?.index || pad.id !== this.selected.id) {
            this.reset(); this.selected = { index: pad.index, id: pad.id };
        }
        const down = (index: number) => !!pad.buttons[index]?.pressed;
        const axis = Number.isFinite(pad.axes[0]) ? pad.axes[0] : 0;
        const stickLeft = axis < -DEADZONE, stickRight = axis > DEADZONE;
        const left = down(14), right = down(15), jump = down(0), run = down(2), pound = down(13), pause = down(9);
        // Test raw controls, not resolved direction: opposed inputs are not neutral.
        if (!this.armed) {
            this.armed = !(stickLeft || stickRight || left || right || jump || run || pound || pause);
            return false;
        }
        const pausePressed = pause && !this.pauseHeld;
        this.pauseHeld = pause;
        if (pausePressed) { this.reset(); return true; }
        if (mode === 'paused') return false;

        // D-pad has priority over the stick. Opposite D-pad holds stay neutral;
        // keyboard priority and simultaneous touch ownership remain Input's policy.
        const direction = left || right ? left === right ? null : left ? 'left' : 'right'
            : stickLeft ? 'left' : stickRight ? 'right' : null;
        if (direction) this.sources[0].press(direction); else this.sources[0].release();
        for (const [index, active, action] of [[1, jump, 'jump'], [2, run, 'run'], [3, pound, 'down']] as const) {
            if (active) this.sources[index].press(action); else this.sources[index].release();
        }
        return false;
    }

    dispose(): void {
        if (this.lifetime.isDisposed) return;
        this.reset(); this.selected = null; this.lifetime.dispose();
    }
}
