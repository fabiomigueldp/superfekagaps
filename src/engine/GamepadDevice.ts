import { connectedPads, controlsRevision, profileFor, readBinding, type PadAction } from './ControlPreferences';
import { DisposalScope } from './DisposalScope';

export type GamepadMenuDirection = 'up' | 'down' | 'left' | 'right';
export type GamepadMenuCommand = GamepadMenuDirection | 'confirm' | 'back' | 'pause' | 'regions' | 'overview' | 'guide' | 'scroll-up' | 'scroll-down';
type Selection = { index: number; id: string };
let selection: Selection | null = null;
let selectionRevision = 0;
export function selectGamepad(pad: Gamepad | null): void {
    selection = pad ? { index: pad.index, id: pad.id } : null; selectionRevision++;
    window.dispatchEvent(new Event('feka-gamepad-select'));
}
export function selectedGamepad(pads = connectedPads()): Gamepad | undefined {
    return pads.find(p => p.index === selection?.index && p.id === selection.id)
        ?? (pads.filter(p => p.id === selection?.id).length === 1 ? pads.find(p => p.id === selection?.id) : undefined);
}
const engaged = (pad: Gamepad) => pad.buttons.some(b => b.pressed || b.value > .5)
    || pad.axes.slice(0, 2).some(v => Math.abs(v) > .65);

/** One reader per live host. Device ownership survives lazy chapters and reconnects. */
export class GamepadDevice {
    private readonly lifetime = new DisposalScope();
    private identity = '';
    private mode = '';
    private revision = -1;
    private selectionVersion = -1;
    private armed = false;
    private blurred = false;
    private hidden = false;
    private connected = false;
    private lost = false;
    private held = new Set<PadAction>();
    private edges = new Set<PadAction>();
    private direction: GamepadMenuCommand | null = null;
    private repeatAt = 0;
    private lastRumble = 0;
    pad: Gamepad | null = null;
    constructor(private readonly onReset: () => void = () => {}) {
        this.lifetime.listen(window, 'blur', () => { this.blurred = true; this.reset(); this.stopRumble(); });
        this.lifetime.listen(window, 'focus', () => { this.blurred = false; this.reset(); });
        this.lifetime.listen(window, 'pagehide', () => { this.hidden = true; this.reset(); this.stopRumble(); });
        this.lifetime.listen(window, 'pageshow', () => { this.hidden = false; this.reset(); });
        this.lifetime.listen(document, 'visibilitychange', () => { this.reset(); if (document.hidden) this.stopRumble(); });
        this.lifetime.listen(window, 'feka-controls-change', () => this.reset());
        this.lifetime.listen(window, 'feka-gamepad-select', () => this.reset());
        this.lifetime.listen(window, 'gamepaddisconnected', e => {
            if (this.pad?.index === e.gamepad.index && this.pad.id === e.gamepad.id) {
                this.lost = true; this.connected = false; this.reset(); this.pad = null;
            }
        });
    }
    reset(): void {
        this.armed = false; this.held.clear(); this.edges.clear(); this.direction = null; this.repeatAt = 0;
        this.onReset();
    }
    private sample(mode: string): boolean {
        if (mode !== this.mode || this.revision !== controlsRevision() || this.selectionVersion !== selectionRevision) {
            this.reset(); this.mode = mode; this.revision = controlsRevision(); this.selectionVersion = selectionRevision;
        }
        this.edges.clear();
        if (this.lifetime.isDisposed || mode === 'inactive' || document.hidden || this.blurred || this.hidden
            || (typeof document.hasFocus === 'function' && !document.hasFocus())
            || document.querySelector('[data-control-capture="true"]')) { this.reset(); return false; }
        const pads = connectedPads();
        if (!selection) {
            const active = pads.find(p => engaged(p));
            if (active) selection = { index: active.index, id: active.id };
        }
        const pad = selectedGamepad(pads);
        if (!pad) {
            if (this.connected) this.lost = true;
            this.connected = false; this.pad = null; this.reset(); return false;
        }
        const identity = `${pad.index}:${pad.id}`;
        if (identity !== this.identity) { this.reset(); this.identity = identity; }
        this.connected = true; this.pad = pad;
        const profile = profileFor(pad);
        const next = new Set<PadAction>();
        const horizontalButtons = (['left', 'right'] as const).some(action =>
            profile.bindings[action].some(b => 'button' in b && readBinding(pad, b) > .5));
        for (const [name, bindings] of Object.entries(profile.bindings)) {
            const action = name as PadAction;
            if (bindings.some(binding => {
                if (horizontalButtons && (action === 'left' || action === 'right') && 'axis' in binding) return false;
                // Horizontal travel is digital by design; vertical stick gestures
                // need more commitment, so a diagonal jump does not become a stomp.
                const directional = ['left', 'right', 'up', 'down'].includes(action);
                const threshold = 'axis' in binding ? directional ? (mode.startsWith('menu:') ? Math.max(.45, profile.deadzone) : action === 'up' || action === 'down' ? .62 : profile.deadzone) : profile.trigger
                    : binding.button === 6 || binding.button === 7 ? profile.trigger : .5;
                const release = Math.max(.06, threshold - .08);
                return readBinding(pad, binding) > (this.held.has(action) ? release : threshold);
            })) next.add(action);
        }
        if (!this.armed) { this.armed = next.size === 0; return false; }
        for (const action of next) if (!this.held.has(action)) this.edges.add(action);
        this.held = next;
        return true;
    }
    game(active = true): boolean { return this.sample(active ? 'playing' : 'inactive'); }
    down(action: PadAction): boolean { return this.held.has(action); }
    pressed(action: PadAction): boolean { return this.edges.has(action); }
    consumeDisconnect(): boolean { const lost = this.lost; this.lost = false; return lost; }
    menu(owner: string | null, now = performance.now()): GamepadMenuCommand | null {
        if (!this.sample(owner === null ? 'inactive' : `menu:${owner}`)) return null;
        const actions: [PadAction, GamepadMenuCommand][] = [
            ['pause', 'pause'], ['guide', 'guide'], ['confirm', 'confirm'], ['back', 'back'], ['run', 'regions'], ['parry', 'overview'],
        ];
        const action = actions.find(([key]) => this.pressed(key));
        if (action) { this.reset(); return action[1]; }
        // Resolve a diagonal to one axis. Opposed D-pad directions remain neutral.
        const x = Number(this.down('right')) - Number(this.down('left'));
        const y = Number(this.down('down')) - Number(this.down('up'));
        const ax = Math.abs(this.pad?.axes[0] ?? 0), ay = Math.abs(this.pad?.axes[1] ?? 0);
        const scroll = this.pad?.mapping === 'standard' ? this.pad.axes[3] ?? 0 : 0;
        const direction: GamepadMenuCommand | null = x && (!y || ax >= ay) ? x < 0 ? 'left' : 'right'
            : y ? y < 0 ? 'up' : 'down' : scroll < -.5 ? 'scroll-up' : scroll > .5 ? 'scroll-down' : null;
        if (!direction) { this.direction = null; this.repeatAt = 0; return null; }
        if (direction !== this.direction) { this.direction = direction; this.repeatAt = now + 350; return direction; }
        if (now >= this.repeatAt) { this.repeatAt = now + 120; return direction; }
        return null;
    }
    rumble(strength = .25, duration = 70): void {
        const pad = this.pad, now = performance.now();
        if (!pad || !profileFor(pad).vibration || document.hidden || this.blurred || now - this.lastRumble < 120) return;
        const actuator = (pad as Gamepad & { vibrationActuator?: { playEffect(type: string, options: object): Promise<unknown> } }).vibrationActuator;
        if (!actuator) return;
        this.lastRumble = now;
        try { void actuator.playEffect('dual-rumble', { duration, startDelay: 0, weakMagnitude: strength, strongMagnitude: strength * .6 }).catch(() => {}); } catch {}
    }
    private stopRumble(): void {
        const actuator = (this.pad as (Gamepad & { vibrationActuator?: { reset(): Promise<unknown> } }) | null)?.vibrationActuator;
        try { void actuator?.reset()?.catch(() => {}); } catch {}
    }
    dispose(): void { this.stopRumble(); this.reset(); this.lifetime.dispose(); this.pad = null; }
}
