import { CONTROL_ACTIONS, CONTROL_LABELS, DEFAULT_KEYS, bindingLabel, connectedPads, controlCode,
    controlPreferences, defaultPad, editProfile, keyLabel, padKey, profileFor, saveControls,
    type ControlAction, type PadAction, type PadBinding } from './ControlPreferences';
import { selectGamepad, selectedGamepad } from './GamepadDevice';
import { DisposalScope } from './DisposalScope';
import './controls.css';

const option = (value: string, text: string) => { const node = document.createElement('option'); node.value = value; node.textContent = text; return node; };
const label = (text: string, node: HTMLElement) => { const row = document.createElement('label'); row.append(document.createTextNode(text), node); return row; };
const same = (a: PadBinding, b: PadBinding) => 'button' in a && 'button' in b ? a.button === b.button
    : 'axis' in a && 'axis' in b && a.axis === b.axis && Math.sign(a.target - a.rest) === Math.sign(b.target - b.rest);

/** Settings live inside the existing controls reference; no permanent gameplay UI. */
export class ControlSettings {
    readonly root = document.createElement('details');
    private readonly scope = new DisposalScope();
    private readonly device = document.createElement('select');
    private readonly action = document.createElement('select');
    private readonly binding = document.createElement('button');
    private readonly padSettings = document.createElement('div');
    private readonly deadzone = document.createElement('input');
    private readonly trigger = document.createElement('input');
    private readonly vibration = document.createElement('input');
    private readonly status = document.createElement('p');
    private capture = false;
    private captureFrame = 0;
    private captureDeadline = 0;
    private capturePad: { index: number; id: string; axes: number[]; buttons: boolean[] } | null = null;
    constructor(private readonly extraActions = false) {
        this.root.className = 'feka-control-settings';
        const summary = document.createElement('summary'); summary.textContent = 'Ajustar controles';
        const reset = document.createElement('button'); reset.type = this.binding.type = 'button'; reset.textContent = 'Restaurar padrão';
        this.status.setAttribute('role', 'status'); this.status.className = 'feka-control-message';
        this.root.append(summary, label('Dispositivo', this.device), label('Ação', this.action), this.binding, this.padSettings, reset, this.status);
        for (const input of [this.deadzone, this.trigger]) { input.type = 'range'; input.step = '.01'; }
        this.deadzone.min = '.08'; this.deadzone.max = '.45'; this.trigger.min = '.1'; this.trigger.max = '.9';
        this.vibration.type = 'checkbox';
        this.padSettings.append(label('Zona morta', this.deadzone), label('Limiar dos gatilhos', this.trigger), label('Vibração', this.vibration));
        this.scope.listen(this.root, 'toggle', () => { if (this.root.open) this.refreshDevices(); else this.cancelCapture(); });
        this.scope.listen(this.device, 'change', () => {
            this.cancelCapture(); const pad = this.pad();
            if (pad) selectGamepad(pad);
            this.refreshActions();
        });
        this.scope.listen(this.action, 'change', () => { this.cancelCapture(); this.refreshBinding(); });
        this.scope.listen(this.binding, 'click', () => this.capture ? this.cancelCapture() : this.startCapture());
        this.scope.listen(reset, 'click', () => {
            this.cancelCapture();
            const pad = this.pad();
            if (pad) controlPreferences.pads[padKey(pad)] = defaultPad(pad.mapping === 'standard');
            else controlPreferences.keys = structuredClone(DEFAULT_KEYS);
            this.save(); this.refreshBinding();
        });
        for (const event of ['gamepadconnected', 'gamepaddisconnected'] as const)
            this.scope.listen(window, event, () => { this.cancelCapture(); if (this.root.open) this.refreshDevices(); });
        this.scope.listen(window, 'blur', () => this.cancelCapture());
        this.scope.listen(document, 'visibilitychange', () => { if (document.hidden) this.cancelCapture(); });
        for (const input of [this.deadzone, this.trigger, this.vibration]) this.scope.listen(input, 'input', () => {
            const pad = this.pad(); if (!pad) return;
            const profile = editProfile(pad);
            profile.deadzone = Number(this.deadzone.value); profile.trigger = Number(this.trigger.value); profile.vibration = this.vibration.checked;
            this.deadzone.setAttribute('aria-valuetext', `${Math.round(profile.deadzone * 100)}%`);
            this.trigger.setAttribute('aria-valuetext', `${Math.round(profile.trigger * 100)}%`);
            this.save();
        });
        // Installed before the host help modal's capture boundary.
        this.scope.listen(window, 'keydown', event => {
            if (!this.capture) return;
            event.preventDefault(); event.stopImmediatePropagation();
            if (event.key === 'Escape') { this.cancelCapture(); return; }
            if (this.capturePad || event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
            const code = controlCode(event);
            if (!/^[A-Za-z][A-Za-z0-9]{0,30}$/.test(code) || ['Tab', 'Enter', 'MetaLeft', 'MetaRight', 'AltLeft', 'AltRight', 'ControlLeft', 'ControlRight'].includes(code)) return;
            const action = this.action.value as ControlAction, previous = controlPreferences.keys[action];
            const conflict = CONTROL_ACTIONS.find(a => a !== action && controlPreferences.keys[a].includes(code));
            if (conflict) controlPreferences.keys[conflict] = previous;
            controlPreferences.keys[action] = [code]; this.finishCapture();
        }, true);
        this.refreshDevices();
    }
    private pad(): Gamepad | undefined { return connectedPads().find(p => String(p.index) === this.device.value); }
    refreshDevices(): void {
        const old = this.device.value, pads = connectedPads(), active = selectedGamepad();
        this.device.replaceChildren(option('keyboard', 'Teclado'), ...pads.map(p => option(String(p.index), `${p.index + 1} · ${p.id}`)));
        this.device.value = old && (old === 'keyboard' || pads.some(p => String(p.index) === old)) ? old : active ? String(active.index) : 'keyboard';
        this.refreshActions();
    }
    private refreshActions(): void {
        const pad = this.pad(), old = this.action.value;
        const actions: (ControlAction | 'confirm' | 'back')[] = [...CONTROL_ACTIONS.filter(a =>
            (pad || a !== 'up') && (!pad || a !== 'mute') && (this.extraActions || !['seed', 'parry'].includes(a)))];
        if (pad) actions.push('confirm', 'back');
        this.action.replaceChildren(...actions.map(a => option(a, CONTROL_LABELS[a])));
        if (actions.includes(old as ControlAction)) this.action.value = old;
        this.padSettings.hidden = !pad;
        this.status.textContent = pad && pad.mapping !== 'standard' ? 'Configure os botões e eixos deste controle.' : '';
        this.refreshBinding();
    }
    private refreshBinding(): void {
        const pad = this.pad();
        this.binding.textContent = pad ? (profileFor(pad).bindings[this.action.value as PadAction] ?? []).map(b => bindingLabel(b, pad)).join(' / ') || 'Definir botão'
            : controlPreferences.keys[this.action.value as ControlAction]?.map(keyLabel).join(' / ') || 'Definir tecla';
        this.binding.setAttribute('aria-label', `Alterar ${CONTROL_LABELS[this.action.value as ControlAction]}: ${this.binding.textContent}`);
        if (pad) {
            const profile = profileFor(pad);
            this.deadzone.value = String(profile.deadzone); this.trigger.value = String(profile.trigger); this.vibration.checked = profile.vibration;
            this.deadzone.setAttribute('aria-valuetext', `${Math.round(profile.deadzone * 100)}%`);
            this.trigger.setAttribute('aria-valuetext', `${Math.round(profile.trigger * 100)}%`);
        }
    }
    private startCapture(): void {
        this.capture = true; this.root.dataset.controlCapture = 'true';
        this.captureDeadline = performance.now() + 15000;
        const pad = this.pad();
        this.capturePad = pad ? { index: pad.index, id: pad.id, axes: [...pad.axes], buttons: pad.buttons.map(b => b.pressed || b.value > .35) } : null;
        this.binding.textContent = 'Cancelar';
        this.status.textContent = pad ? 'Solte os controles; depois mova um eixo ou aperte um botão. Menu + View cancela.' : 'Aperte uma tecla. Esc cancela.';
        let released = !pad;
        const poll = () => {
            if (!this.capture) return;
            if (performance.now() > this.captureDeadline || !this.root.isConnected || !this.root.open) { this.cancelCapture(); return; }
            if (this.capturePad) {
                const baseline = this.capturePad, current = connectedPads().find(p => p.index === baseline.index && p.id === baseline.id);
                if (!current) { this.cancelCapture(); return; }
                if (current.mapping === 'standard' && current.buttons[8]?.pressed && current.buttons[9]?.pressed) { this.cancelCapture(); return; }
                if (!released) {
                    if (current.buttons.every(b => !b.pressed && b.value < .2)
                        && (current.mapping !== 'standard' || current.axes.slice(0, 4).every(v => Math.abs(v) < .25))) {
                        released = true; baseline.axes = [...current.axes];
                    }
                } else {
                    const button = current.buttons.findIndex(b => b.pressed || b.value > .65);
                    const axis = current.axes.findIndex((v, i) => Math.abs(v - (baseline.axes[i] ?? 0)) > .65);
                    const binding: PadBinding | null = button >= 0 ? { button }
                        : axis >= 0 ? { axis, rest: baseline.axes[axis] ?? 0, target: current.axes[axis] > (baseline.axes[axis] ?? 0) ? 1 : -1 } : null;
                    if (binding) {
                        const profile = editProfile(current), action = this.action.value as PadAction;
                        const menu = action === 'confirm' || action === 'back';
                        const conflict = (Object.keys(profile.bindings) as PadAction[]).find(a => a !== action
                            && (a === 'confirm' || a === 'back') === menu && profile.bindings[a].some(b => same(b, binding)));
                        if (conflict) profile.bindings[conflict] = profile.bindings[action];
                        profile.bindings[action] = [binding]; this.finishCapture(); return;
                    }
                }
            }
            this.captureFrame = requestAnimationFrame(poll);
        };
        this.captureFrame = requestAnimationFrame(poll);
    }
    private save(): void { this.status.textContent = saveControls() ? '' : 'Ajustes válidos nesta sessão; armazenamento indisponível.'; }
    private finishCapture(): void { this.cancelCapture(); this.save(); this.refreshBinding(); }
    cancelCapture(): void {
        this.capture = false; delete this.root.dataset.controlCapture; cancelAnimationFrame(this.captureFrame);
        this.capturePad = null; this.status.textContent = ''; this.refreshBinding();
    }
    dispose(): void { this.cancelCapture(); this.scope.dispose(); this.root.remove(); }
}
