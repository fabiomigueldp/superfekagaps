/** Device preferences are separate from campaign progress and never change physics. */
export const CONTROL_ACTIONS = ['left', 'right', 'up', 'down', 'jump', 'run', 'seed', 'parry', 'interact', 'pause', 'guide', 'mute'] as const;
export type ControlAction = typeof CONTROL_ACTIONS[number];
export type PadAction = Exclude<ControlAction, 'mute'> | 'confirm' | 'back';
export type PadBinding = { button: number } | { axis: number; rest: number; target: number };
export interface PadProfile {
    bindings: Record<PadAction, PadBinding[]>;
    deadzone: number;
    trigger: number;
    vibration: boolean;
}
export const CONTROL_LABELS: Record<ControlAction | 'confirm' | 'back', string> = {
    left: 'Esquerda', right: 'Direita', up: 'Cima nos menus', down: 'Sentada / baixo',
    jump: 'Pular', run: 'Correr', seed: 'Semente (Delícia)', parry: 'Rebater (Delícia)',
    interact: 'Interagir', pause: 'Pausar', guide: 'Controles', mute: 'Som',
    confirm: 'Confirmar nos menus', back: 'Voltar nos menus',
};
export const DEFAULT_KEYS: Record<ControlAction, string[]> = {
    left: ['ArrowLeft', 'KeyA'], right: ['ArrowRight', 'KeyD'], up: [],
    down: ['ArrowDown', 'KeyS'], jump: ['Space', 'KeyW', 'KeyZ', 'ArrowUp'],
    run: ['ShiftLeft', 'ShiftRight', 'KeyX'], seed: ['KeyJ'], parry: ['KeyQ'],
    interact: ['KeyE'], pause: ['Escape'], guide: ['F1'], mute: ['KeyM'],
};
const button = (value: number): PadBinding => ({ button: value });
const axis = (value: number, target: number): PadBinding => ({ axis: value, rest: 0, target });
export function defaultPad(standard = true): PadProfile {
    const bindings: PadProfile['bindings'] = {
        left: [axis(0, -1), button(14)], right: [axis(0, 1), button(15)],
        up: [axis(1, -1), button(12)], down: [axis(1, 1), button(13), button(4)],
        jump: [button(0)], run: [button(2), button(7)], seed: [button(1)],
        parry: [button(3), button(6)], interact: [button(5)], pause: [button(9)],
        guide: [button(8)], confirm: [button(0)], back: [button(1)],
    };
    if (!standard) for (const action of Object.keys(bindings) as PadAction[]) bindings[action] = [];
    return { bindings, deadzone: .2, trigger: .35, vibration: true };
}
export const padKey = (pad: Gamepad): string => `${pad.mapping}:${pad.id}`.slice(0, 240);
const STORAGE_KEY = 'super_feka_gaps_controls_v1';
interface Preferences { keys: Record<ControlAction, string[]>; pads: Record<string, PadProfile>; }
const finite = (value: unknown, fallback: number, min: number, max: number) =>
    typeof value === 'number' && Number.isFinite(value) ? Math.max(min, Math.min(max, value)) : fallback;
export function validBinding(value: unknown): value is PadBinding {
    if (!value || typeof value !== 'object') return false;
    const b = value as PadBinding;
    return 'button' in b ? Number.isInteger(b.button) && b.button >= 0 && b.button < 64
        : Number.isInteger(b.axis) && b.axis >= 0 && b.axis < 16
            && Number.isFinite(b.rest) && Math.abs(b.rest) <= 1
            && Number.isFinite(b.target) && Math.abs(b.target) <= 1 && Math.abs(b.target - b.rest) >= .4;
}
function load(): Preferences {
    const result: Preferences = { keys: structuredClone(DEFAULT_KEYS), pads: {} };
    try {
        const data = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}');
        for (const action of CONTROL_ACTIONS) {
            const values = data.keys?.[action];
            if (Array.isArray(values)) result.keys[action] = values.filter(v => typeof v === 'string' && /^[A-Za-z][A-Za-z0-9]{0,30}$/.test(v)).slice(0, 6);
        }
        if (data.pads && typeof data.pads === 'object') for (const [id, raw] of Object.entries(data.pads).slice(0, 24)) {
            if (!raw || typeof raw !== 'object' || ['__proto__', 'constructor', 'prototype'].includes(id)) continue;
            const saved = raw as PadProfile, profile = defaultPad(id.startsWith('standard:'));
            profile.deadzone = finite(saved.deadzone, .2, .08, .45);
            profile.trigger = finite(saved.trigger, .35, .1, .9);
            profile.vibration = saved.vibration !== false;
            for (const action of Object.keys(profile.bindings) as PadAction[]) {
                if (Array.isArray(saved.bindings?.[action])) profile.bindings[action] = saved.bindings[action].filter(validBinding).slice(0, 5);
            }
            result.pads[id] = profile;
        }
    } catch { /* Preferences remain usable without storage. */ }
    return result;
}
export const controlPreferences = load();
let revision = 0;
export const controlsRevision = () => revision;
export function saveControls(): boolean {
    revision++;
    window.dispatchEvent(new Event('feka-controls-change'));
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(controlPreferences)); return true; } catch { return false; }
}
export const profileFor = (pad: Gamepad): PadProfile => controlPreferences.pads[padKey(pad)] ?? defaultPad(pad.mapping === 'standard');
export function editProfile(pad: Gamepad): PadProfile {
    return controlPreferences.pads[padKey(pad)] ??= profileFor(pad);
}
export function controlCode(event: KeyboardEvent): string {
    // Physical keys keep press/release paired when Shift or the keyboard layout changes.
    if (event.code && event.code !== 'Unidentified') return event.code;
    if (event.key === ' ') return 'Space';
    if (event.key === 'Shift') return 'ShiftLeft';
    if (/^[a-z]$/i.test(event.key)) return `Key${event.key.toUpperCase()}`;
    return event.key;
}
export function keyAction(code: string): ControlAction | undefined {
    return CONTROL_ACTIONS.find(action => controlPreferences.keys[action].includes(code));
}
export function keyLabel(code: string): string {
    return ({ Space: 'Espaço', ArrowLeft: '←', ArrowRight: '→', ArrowUp: '↑', ArrowDown: '↓',
        Escape: 'Esc', ShiftLeft: 'Shift esq.', ShiftRight: 'Shift dir.' } as Record<string, string>)[code]
        ?? code.replace(/^Key/, '').replace(/^Digit/, '').replace(/^Numpad/, 'Num ');
}
export function bindingLabel(binding: PadBinding, pad?: Gamepad): string {
    if ('axis' in binding) return `Eixo ${binding.axis + 1} ${binding.target > binding.rest ? '+' : '−'}`;
    const ps = /playstation|dualshock|dualsense|054c/i.test(pad?.id ?? '');
    const nintendo = /nintendo|switch|057e/i.test(pad?.id ?? '');
    const names = ps ? ['×', '○', '□', '△', 'L1', 'R1', 'L2', 'R2', 'Share', 'Options', 'L3', 'R3', '↑', '↓', '←', '→']
        : nintendo ? ['B', 'A', 'Y', 'X', 'L', 'R', 'ZL', 'ZR', '−', '+', 'LS', 'RS', '↑', '↓', '←', '→']
            : ['A', 'B', 'X', 'Y', 'LB', 'RB', 'LT', 'RT', 'View', 'Menu', 'LS', 'RS', '↑', '↓', '←', '→'];
    return pad?.mapping === 'standard' ? names[binding.button] ?? `Botão ${binding.button + 1}` : `Botão ${binding.button + 1}`;
}
export function readBinding(pad: Gamepad, binding: PadBinding): number {
    if ('button' in binding) {
        const b = pad.buttons[binding.button];
        return finite(b?.value, b?.pressed ? 1 : 0, 0, 1);
    }
    const raw = finite(pad.axes[binding.axis], binding.rest, -1, 1);
    return Math.max(0, Math.min(1, (raw - binding.rest) / (binding.target - binding.rest)));
}
export function connectedPads(): Gamepad[] {
    try { return Array.from(navigator.getGamepads?.() ?? []).filter((p): p is Gamepad => !!p && p.connected !== false && p.mapping !== 'xr-standard'); }
    catch { return []; }
}
