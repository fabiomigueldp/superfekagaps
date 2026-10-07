import { DisposalScope } from './DisposalScope';
import { Input, type InputActionSource } from './Input';

export type GamepadMode = 'playing' | 'paused' | 'inactive';
export type GamepadMenuDirection = 'up' | 'down' | 'left' | 'right';
export type GamepadMenuCommand = GamepadMenuDirection | 'confirm' | 'back' | 'pause' | 'regions' | 'overview';
const DEADZONE = .25;
const MENU_ENGAGE = .45, MENU_RELEASE = .25;
const MENU_REPEAT_DELAY = 350, MENU_REPEAT_INTERVAL = 120;

/** Opt-in standard controller, sampled by its host. Never synthesizes DOM keys/clicks. */
export class StandardGamepad {
    private readonly lifetime = new DisposalScope();
    private readonly sources: InputActionSource[] = [];
    private selected: { index: number; id: string } | null = null;
    private mode = 'inactive';
    private menuDirection: GamepadMenuDirection | null = null;
    private repeatAt = 0;
    private stickX = 0;
    private stickY = 0;
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
        this.menuDirection = null; this.repeatAt = 0; this.stickX = this.stickY = 0;
        for (const source of this.sources) source.cancel();
    }

    private forgetDevice(): void { this.reset(); this.selected = null; }

    /** Exactly one host-selected owner samples the same device; there is no extra frame loop. */
    private sample(mode: string): Gamepad | null {
        if (this.lifetime.isDisposed || this.input.isDisposed) return null;
        if (mode !== this.mode) { this.reset(); this.mode = mode; }
        if (mode === 'inactive' || document.hidden || this.blurred || this.pageHidden ||
            (typeof document.hasFocus === 'function' && !document.hasFocus())) {
            this.reset(); return null;
        }
        let pads: (Gamepad | null)[];
        try { pads = Array.from(navigator.getGamepads?.() ?? []); }
        catch { this.forgetDevice(); return null; }
        const supported = pads.filter((pad): pad is Gamepad => !!pad?.connected && pad.mapping === 'standard');
        const pad = supported.find(p => p.index === this.selected?.index && p.id === this.selected.id) ?? supported[0];
        if (!pad) { this.forgetDevice(); return null; }
        if (pad.index !== this.selected?.index || pad.id !== this.selected.id) {
            this.reset(); this.selected = { index: pad.index, id: pad.id };
        }
        return pad;
    }

    /** Returns one Start/Options edge. The host owns the actual pause transition. */
    update(mode: GamepadMode): boolean {
        const pad = this.sample(mode);
        if (!pad) return false;
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

    /** Menu commands never touch gameplay actions or synthesize DOM events.
     * The caller supplies a page/layer identity and a monotonic clock. */
    updateMenu(owner: string | null, now = performance.now()): GamepadMenuCommand | null {
        const pad = this.sample(owner === null ? 'inactive' : `menu:${owner}`);
        if (!pad) return null;
        const down = (index: number) => !!pad.buttons[index]?.pressed;
        const x = Number.isFinite(pad.axes[0]) ? pad.axes[0] : 0;
        const y = Number.isFinite(pad.axes[1]) ? pad.axes[1] : 0;
        const directions = ([['up', 12], ['down', 13], ['left', 14], ['right', 15]] as const)
            .filter(([, index]) => down(index));
        const actions = ([['confirm', 0], ['back', 1], ['regions', 2], ['overview', 3], ['pause', 9]] as const)
            .filter(([, index]) => down(index));
        if (!this.armed) {
            // Raw opposed controls and a stick inside hysteresis are not neutral.
            this.armed = !directions.length && !actions.length && Math.abs(x) <= MENU_RELEASE && Math.abs(y) <= MENU_RELEASE;
            return null;
        }
        if (actions.length) {
            // Every discrete action consumes the whole gesture. A held A cannot
            // skip a journey then enter, or cross successive story/menu pages.
            this.reset();
            return actions.length === 1 ? actions[0][0] : null;
        }
        const axis = (value: number, previous: number) => value > MENU_ENGAGE ? 1 : value < -MENU_ENGAGE ? -1
            : Math.abs(value) <= MENU_RELEASE || value * previous <= 0 ? 0 : previous;
        this.stickX = axis(x, this.stickX); this.stickY = axis(y, this.stickY);
        const stick = this.stickX && (!this.stickY || Math.abs(x) >= Math.abs(y)) ? this.stickX < 0 ? 'left' : 'right'
            : this.stickY ? this.stickY < 0 ? 'up' : 'down' : null;
        const direction: GamepadMenuDirection | null = directions.length ? directions.length === 1 ? directions[0][0] : null : stick;
        if (!direction) { this.menuDirection = null; this.repeatAt = 0; return null; }
        if (direction !== this.menuDirection) {
            this.menuDirection = direction; this.repeatAt = now + MENU_REPEAT_DELAY; return direction;
        }
        if (Number.isFinite(now) && now >= this.repeatAt) {
            this.repeatAt = now + MENU_REPEAT_INTERVAL; return direction;
        }
        return null;
    }

    dispose(): void {
        if (this.lifetime.isDisposed) return;
        this.reset(); this.selected = null; this.lifetime.dispose();
    }
}
