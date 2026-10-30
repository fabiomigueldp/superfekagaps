import { DisposalScope } from '../engine/DisposalScope';
import type { GamepadMenuCommand } from '../engine/StandardGamepad';
import { ControlSettings } from '../engine/ControlSettings';
import { CONTROL_LABELS, bindingLabel, controlPreferences, keyLabel, profileFor, type ControlAction, type PadAction } from '../engine/ControlPreferences';
import { selectedGamepad } from '../engine/GamepadDevice';
import { DomGamepadMenu } from '../engine/DomGamepadMenu';
import './world-controls-help.css';

function defaultNavigation(pad?: Gamepad): string[] {
    const buttons = (action: PadAction, fallback: string) => pad
        ? profileFor(pad).bindings[action].map(binding => bindingLabel(binding, pad)).join(' / ') || 'Sem botão'
        : fallback;
    return [
        'Menus: Tab ou ↑/↓ para escolher; Enter ou Espaço para confirmar; Esc para voltar.',
        `Controle: use as direções para escolher. Confirmar: ${buttons('confirm', 'A/×')}; voltar: ${buttons('back', 'B/○')}; pausar/continuar: ${buttons('pause', 'Menu')}.`,
        `Mapa: ←/→ fases; ↑/↓ regiões. Ilhas: ${buttons('run', 'X/□')}; mundo: ${buttons('parry', 'Y/△')}; usar a ação selecionada ou pular a viagem: ${buttons('confirm', 'A/×')}.`,
        'A sentada é usada no ar. Direção e corrida continuam enquanto estiverem pressionadas.',
    ];
}

interface ControlsHelpHost {
    canOpen(): boolean;
    resetInput(): void;
    suspendTouch(): () => void;
    onOpenChange?(open: boolean): void;
}

export interface ControlsHelpContent {
    id?: string;
    regionLabel?: string;
    /** Dynamic copy keeps the same paragraph count across binding/device changes. */
    navigation?: readonly string[] | ((pad?: Gamepad) => readonly string[]);
    touch?: string;
    closeLabel?: string;
    footerHint?: string | ((pad?: Gamepad) => string);
    extraActions?: boolean;
    extraContent?: HTMLElement;
}

/** Readable reference only; the host retains its settings/paused state and save. */
export class WorldControlsHelp {
    private readonly lifetime = new DisposalScope();
    readonly dialog = document.createElement('dialog');
    readonly closeButton = document.createElement('button');
    private readonly heading = document.createElement('h2');
    private readonly content = document.createElement('div');
    private opened = false;
    private restoreFocus: HTMLElement | null = null;
    private originalInert = false;
    private releaseTouch?: () => void;
    private readonly navigation = new DomGamepadMenu();
    private readonly settings: ControlSettings;
    private readonly bindings = new Map<ControlAction, HTMLElement>();
    private readonly refreshText: ((pad?: Gamepad) => void)[] = [];

    constructor(private readonly canvas: HTMLCanvasElement, private readonly host: ControlsHelpHost, contentOptions: ControlsHelpContent = {}) {
        this.settings = new ControlSettings(contentOptions.extraActions);
        try {
            this.lifetime.add(() => { this.settings.dispose(); this.navigation.dispose(); });
            this.dialog.id = contentOptions.id ?? 'world-controls-help'; this.dialog.className = 'world-controls-help';
            const titleId = contentOptions.id ? `${contentOptions.id}-title` : 'world-controls-title';
            this.dialog.setAttribute('aria-labelledby', titleId);
            this.heading.id = titleId; this.heading.textContent = 'CONTROLES'; this.heading.tabIndex = -1;
            const content = this.content; content.className = 'world-controls-content'; content.tabIndex = 0;
            content.setAttribute('role', 'region'); content.setAttribute('aria-label', contentOptions.regionLabel ?? 'Controles da aventura World');
            const list = document.createElement('dl');
            const actions: ControlAction[] = ['left', 'right', 'jump', 'run', 'down', 'interact', 'pause', 'guide', 'mute'];
            if (contentOptions.extraActions) actions.splice(5, 0, 'seed', 'parry');
            for (const action of actions) {
                const term = document.createElement('dt'), description = document.createElement('dd');
                term.textContent = CONTROL_LABELS[action]; this.bindings.set(action, description); list.append(term, description);
            }
            const navigationText = contentOptions.navigation ?? defaultNavigation;
            const navigation = (typeof navigationText === 'function' ? navigationText(selectedGamepad()) : navigationText)
                .map(text => { const paragraph = document.createElement('p'); paragraph.textContent = text; return paragraph; });
            if (typeof navigationText === 'function') this.refreshText.push(pad => {
                const text = navigationText(pad);
                navigation.forEach((paragraph, index) => { paragraph.textContent = text[index]; });
            });
            const touchTitle = document.createElement('h3'); touchTitle.textContent = 'NA TELA DE TOQUE';
            const touch = document.createElement('p');
            touch.textContent = contentOptions.touch ?? '← / → para andar; ↑ para pular; segure X + direção para correr; ↓ no ar para a sentada. Toque no topo da tela para pausar.';
            content.append(list, ...navigation, touchTitle, touch, this.settings.root);
            if (contentOptions.extraContent) content.append(contentOptions.extraContent);
            this.lifetime.listen(window, 'feka-controls-change', () => this.refreshBindings());
            this.lifetime.listen(window, 'feka-gamepad-select', () => this.refreshBindings());
            const footer = document.createElement('footer');
            this.closeButton.type = 'button'; this.closeButton.textContent = contentOptions.closeLabel ?? 'VOLTAR ÀS OPÇÕES';
            if (contentOptions.id) this.closeButton.id = `${contentOptions.id}-close`;
            if (contentOptions.footerHint) {
                const hint = document.createElement('p'); hint.className = 'world-controls-footer-hint';
                const footerText = contentOptions.footerHint;
                if (typeof footerText === 'function') this.refreshText.push(pad => { hint.textContent = footerText(pad); });
                else hint.textContent = footerText;
                footer.append(hint);
            }
            this.refreshBindings();
            footer.append(this.closeButton); this.dialog.append(this.heading, content, footer); document.body.append(this.dialog);
            this.lifetime.listen(this.closeButton, 'click', () => this.close());
            this.lifetime.listen(this.dialog, 'cancel', event => { event.preventDefault(); this.close(); });
            this.lifetime.listen(this.dialog, 'close', () => { if (!this.dialog.open) this.close(); });
            // Mount before Input: native scrolling/activation must keep their defaults,
            // while game capture listeners must never receive keys from this modal.
            this.lifetime.listen(window, 'keydown', event => {
                if (!this.opened) return;
                this.host.resetInput(); event.stopImmediatePropagation();
                if (event.key === 'Escape') { event.preventDefault(); if (!event.repeat) this.close(); }
                else if (event.repeat && event.key === 'Enter') event.preventDefault();
                else if (event.repeat && event.key === ' ' && event.target === this.closeButton) event.preventDefault();
            }, true);
            this.lifetime.listen(window, 'keyup', event => {
                if (this.opened) { this.host.resetInput(); event.stopImmediatePropagation(); }
            }, true);
            this.lifetime.listen(window, 'pagehide', () => this.close(false));
            this.lifetime.add(() => this.dialog.remove());
        } catch (error) { this.dispose(); throw error; }
    }

    get isOpen(): boolean { return this.opened; }

    /** An opt-in host can route its controller to this modal, never behind it. */
    canControl(): boolean {
        return this.opened && !this.lifetime.isDisposed && !document.hidden && this.host.canOpen()
            && (typeof document.hasFocus !== 'function' || document.hasFocus())
            && this.dialog.contains(document.activeElement);
    }
    control(command: GamepadMenuCommand): void {
        if (!this.canControl()) return;
        this.navigation.control(this.dialog, command, () => this.close());
    }
    private refreshBindings(): void {
        const pad = selectedGamepad();
        for (const [action, node] of this.bindings) {
            const keys = controlPreferences.keys[action].map(keyLabel).join(' / ') || 'Sem tecla';
            const buttons = action === 'mute' ? '' : (pad ? profileFor(pad).bindings[action] : []).map(b => bindingLabel(b, pad)).join(' / ');
            node.textContent = buttons ? `${keys} · ${buttons}` : keys;
        }
        for (const refresh of this.refreshText) refresh(pad);
    }

    open(): void {
        if (this.opened || this.lifetime.isDisposed || !this.host.canOpen() || document.hidden) return;
        this.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.settings.refreshDevices(); this.refreshBindings();
        this.originalInert = this.canvas.inert;
        this.host.resetInput(); this.releaseTouch = this.host.suspendTouch();
        this.canvas.inert = true; this.opened = true;
        try { this.host.onOpenChange?.(true); this.dialog.showModal(); this.heading.focus({ preventScroll: true }); }
        catch (error) { this.close(); throw error; }
    }

    close(restore = true): void {
        if (!this.opened) return;
        this.settings.cancelCapture(); this.navigation.closeKeyboard();
        this.opened = false; this.host.onOpenChange?.(false);
        if (this.dialog.open) this.dialog.close();
        this.canvas.inert = this.originalInert;
        this.releaseTouch?.(); this.releaseTouch = undefined; this.host.resetInput();
        const target = this.restoreFocus; this.restoreFocus = null;
        if (restore && !document.hidden && this.host.canOpen() && !this.lifetime.isDisposed) {
            const destination = target?.isConnected && target !== document.body ? target : this.canvas;
            destination.focus({ preventScroll: true });
            // A connected opener may now be hidden, disabled or inside an inert
            // region. Restore keyboard control even when its focus is refused.
            if (destination !== this.canvas && document.activeElement !== destination)
                this.canvas.focus({ preventScroll: true });
        }
    }

    dispose(): void { this.close(false); this.lifetime.dispose(); }
}
