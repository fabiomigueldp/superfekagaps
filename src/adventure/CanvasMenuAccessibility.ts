import { DisposalScope } from '../engine/DisposalScope';

const COMPACT_MENU_STYLE = `
.canvas-menu-accessibility[data-compact="true"] {
  box-sizing: border-box; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px; padding: 14px; border: 2px solid #98703b; background: #123547;
  overflow: auto; overscroll-behavior: contain; pointer-events: auto !important;
  max-height: calc(100dvh - 24px); scrollbar-color: #648591 #191f35;
}
.canvas-menu-accessibility[data-compact="true"]::before {
  content: attr(aria-label); grid-column: 1 / -1; color: #f5efd3;
  font: bold 15px/1.4 monospace; text-align: center; padding: 0 0 6px;
}
.canvas-menu-accessibility[data-compact="true"] button {
  position: relative !important; inset: auto !important; width: auto !important; height: auto !important;
  min-width: 0; min-height: 44px; padding: 10px 8px !important; border: 1px solid #648591 !important;
  background: #123547 !important; color: #f5efd3 !important; font: bold 13px/1.4 monospace !important;
}
.canvas-menu-accessibility[data-compact="true"] button:first-child,
.canvas-menu-accessibility[data-compact="true"] button:last-of-type,
.canvas-menu-accessibility[data-compact="true"][data-screen="paused"] button,
.canvas-menu-accessibility[data-compact="true"][data-screen="title"] button,
.canvas-menu-accessibility[data-compact="true"][data-screen="settings"] button:nth-child(-n+3) { grid-column: 1 / -1; }
.canvas-menu-accessibility[data-compact="true"] button:focus {
  outline: 2px solid #ffe29a !important; outline-offset: 2px !important; border-color: #e9ad4c !important;
}
.canvas-menu-accessibility[data-compact="true"] button:first-child { border-color: #98703b !important; background: #ffe29a !important; color: #101d29 !important; }
.canvas-menu-accessibility[data-compact="true"][data-screen="title"] button:last-of-type { width: 72% !important; justify-self: center; }
.canvas-menu-accessibility .canvas-menu-status {
  position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; border: 0;
  overflow: hidden; clip-path: inset(50%); white-space: nowrap;
}
.canvas-menu-accessibility[data-compact="true"] .canvas-menu-status:not(:empty) {
  position: static; width: auto; height: auto; overflow: visible; clip-path: none; white-space: normal;
  grid-column: 1 / -1; margin: 4px 0 0; padding: 10px; border: 1px solid #e9ad4c;
  color: #ffe29a; background: #101d29; font: 13px/1.5 monospace; overflow-wrap: anywhere;
}
.canvas-menu-accessibility[hidden] { display: none !important; }
`;


export interface CanvasMenuChoice {
    label: string;
    ariaLabel?: string;
    ariaDescribedBy?: string;
    x: number;
    y: number;
    width: number;
    height: number;
}
export interface CanvasMenuHost {
    select(index: number): void;
    activate(index: number): void;
    escape(): void;
    /** Input's window-capture listener runs before these native controls. */
    resetInput(): void;
}

/** Native controls mirror the painted menu, without replacing its pixel artwork. */
export class CanvasMenuAccessibility {
    private readonly lifetime = new DisposalScope();
    readonly root = document.createElement('nav');
    private controls: HTMLButtonElement[] = [];
    private controlLifetime = new DisposalScope();
    private screen = '';
    private pendingFocus = false;
    private visibilityFocusScreen = '';
    private controllerFocus = false;
    private bounds = '';
    private compactScreen = '';
    private statusText = '';
    private statusAttached = false;
    private readonly status = document.createElement('p');
    private readonly controlBounds = new WeakMap<HTMLButtonElement, {
        x: number; y: number; width: number; height: number;
        left: string; top: string; cssWidth: string; cssHeight: string;
    }>();

    constructor(private readonly canvas: HTMLCanvasElement, private readonly host: CanvasMenuHost) {
        this.status.className = 'canvas-menu-status';
        this.status.setAttribute('role', 'status');
        this.status.setAttribute('aria-live', 'polite');
        this.status.setAttribute('aria-atomic', 'true');
        this.root.className = 'canvas-menu-accessibility';
        this.root.hidden = true;
        Object.assign(this.root.style, { position: 'fixed', zIndex: '20', pointerEvents: 'none' });
        const style = document.createElement('style'); style.textContent = COMPACT_MENU_STYLE;
        document.body.append(style, this.root);
        this.lifetime.add(() => style.remove());
        this.lifetime.listen(this.root, 'keydown', event => this.key(event));
        this.lifetime.listen(this.root, 'keyup', event => {
            if (this.ownsKey(event)) { this.host.resetInput(); event.stopPropagation(); }
        });
        this.lifetime.listen(document, 'focusin', () => {
            // Even a brief visit to an external control relinquishes ownership.
            if (document.activeElement !== document.body && document.activeElement !== this.canvas && !this.ownsFocus())
                this.visibilityFocusScreen = '';
        });
        this.lifetime.listen(window, 'resize', () => this.fit());
        this.lifetime.listen(window, 'scroll', () => this.fit(), true);
        this.lifetime.listen(document, 'visibilitychange', () => {
            if (document.hidden) this.clear({ restoreFocus: false });
        });
        this.lifetime.add(() => this.root.remove());
    }

    /** Call after drawing; identities stay stable while labels/settings change. */
    sync(screen: string, label: string, choices: readonly CanvasMenuChoice[], selected: number, status = ''): void {
        if (this.lifetime.isDisposed) return;
        this.statusText = status;
        if (!choices.length || document.hidden || this.canvas.inert) { this.clear({ restoreFocus: false }); return; }
        const hadFocus = this.ownsFocus();
        const rebuild = this.screen !== screen || this.controls.length !== choices.length;
        if (rebuild) {
            for (const button of this.controls)
                if (button.getAttribute('aria-describedby') !== null) button.removeAttribute('aria-describedby');
            this.controlLifetime.dispose(); this.controlLifetime = new DisposalScope();
            this.screen = screen;
            this.compactScreen = screen.split(':')[0];
            this.root.setAttribute('data-screen', this.compactScreen);
            this.bounds = '';
            this.controls = choices.map((_, index) => this.makeButton(index));
            this.root.replaceChildren(...this.controls, this.status); this.statusAttached = true;
        }
        if (this.root.getAttribute('aria-label') !== label) this.root.setAttribute('aria-label', label);
        choices.forEach((choice, index) => {
            const button = this.controls[index];
            if (button.textContent !== choice.label) button.textContent = choice.label;
            const ariaLabel = choice.ariaLabel ?? choice.label;
            if (button.getAttribute('aria-label') !== ariaLabel) button.setAttribute('aria-label', ariaLabel);
            if (choice.ariaDescribedBy) {
                if (button.getAttribute('aria-describedby') !== choice.ariaDescribedBy)
                    button.setAttribute('aria-describedby', choice.ariaDescribedBy);
            } else if (button.getAttribute('aria-describedby') !== null) button.removeAttribute('aria-describedby');
            this.positionControl(button, choice);
        });
        if (this.root.hidden) this.root.hidden = false;
        this.fit();
        this.syncStatus();
        const active = this.controls[Math.max(0, Math.min(selected, this.controls.length - 1))];
        // Returning from a native menu action retains focus; opening a modal or
        // moving elsewhere must never have its focus taken by the next frame.
        const visibilityFocus = this.visibilityFocusScreen === screen
            && (!document.activeElement || document.activeElement === document.body || document.activeElement === this.canvas)
            && !document.querySelector?.('dialog[open]');
        this.visibilityFocusScreen = '';
        if ((hadFocus && rebuild || this.pendingFocus && document.activeElement === this.canvas || visibilityFocus) && !document.hidden)
            active?.focus({ preventScroll: true });
        this.pendingFocus = false;
    }

    /** Explicit native actions may hand the canvas to the next painted menu. */
    requestFocusFromCanvas(): void {
        if (!this.lifetime.isDisposed && !document.hidden && !this.canvas.inert && document.activeElement === this.canvas)
            this.pendingFocus = true;
    }

    /** Only this visible menu or its canvas can hand focus to a controller. */
    canControl(): boolean {
        return !this.lifetime.isDisposed && !this.root.hidden && !document.hidden && !this.canvas.inert
            && (document.activeElement === this.canvas || this.ownsFocus());
    }

    focusFromController(index: number): boolean {
        if (!this.canControl()) return false;
        const button = this.controls[index];
        if (!button || button.hidden || button.disabled) return false;
        // Native focus still synchronizes the painted selection. Its usual
        // Input reset would otherwise cancel the controller's own repeat.
        this.controllerFocus = true;
        try { button.focus({ preventScroll: true }); }
        finally { this.controllerFocus = false; }
        return document.activeElement === button;
    }

    /** Clear immediately on a state change, before the next animation frame. */
    clear({ restoreFocus = true }: { restoreFocus?: boolean } = {}): void {
        const focused = this.ownsFocus();
        // Hidden renders can clear repeatedly. Keep only the menu that owned
        // focus; ordinary transitions, inert surfaces and disposal revoke it.
        if (document.hidden && !restoreFocus && !this.canvas.inert) {
            if (focused) this.visibilityFocusScreen = this.screen;
        } else this.visibilityFocusScreen = '';
        this.pendingFocus = restoreFocus && focused;
        this.root.hidden = true;
        this.controlLifetime.dispose(); this.controlLifetime = new DisposalScope();
        for (const button of this.controls)
            if (button.getAttribute('aria-describedby') !== null) button.removeAttribute('aria-describedby');
        this.root.replaceChildren();
        this.controls = []; this.screen = ''; this.statusText = ''; this.status.textContent = ''; this.statusAttached = false;
        if (focused) {
            this.host.resetInput();
            if (restoreFocus && !document.hidden && !this.canvas.inert) this.canvas.focus({ preventScroll: true });
            else (document.activeElement as HTMLElement | null)?.blur?.();
        }
    }

    dispose(): void { this.clear({ restoreFocus: false }); this.visibilityFocusScreen = ''; this.lifetime.dispose(); }

    private positionControl(button: HTMLButtonElement, choice: CanvasMenuChoice): void {
        const style = button.style;
        const previous = this.controlBounds.get(button);
        if (previous && previous.x === choice.x && previous.y === choice.y
            && previous.width === choice.width && previous.height === choice.height
            && previous.left === style.left && previous.top === style.top
            && previous.cssWidth === style.width && previous.cssHeight === style.height) return;
        Object.assign(style, {
            left: `${choice.x / 320 * 100}%`, top: `${choice.y / 180 * 100}%`,
            width: `${choice.width / 320 * 100}%`, height: `${choice.height / 180 * 100}%`
        });
        // CSSOM can normalize fractional percentages. Remember its actual values,
        // while still repairing external inline edits and observing in-place choices.
        this.controlBounds.set(button, {
            x: choice.x, y: choice.y, width: choice.width, height: choice.height,
            left: style.left, top: style.top, cssWidth: style.width, cssHeight: style.height
        });
    }

    private ownsFocus(): boolean { return this.controls.some(button => button === document.activeElement); }
    private ownsKey(event: KeyboardEvent): boolean {
        return !event.altKey && !event.ctrlKey && !event.metaKey && ['Enter', ' ', 'Escape', 'ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight', 'w', 's'].includes(event.key);
    }
    private key(event: KeyboardEvent): void {
        if (!this.ownsKey(event)) return;
        this.host.resetInput(); event.stopPropagation();
        if (event.key === 'Enter' || event.key === ' ') {
            // Preserve native click synthesis, but never auto-repeat an action.
            if (event.repeat) event.preventDefault();
            return;
        }
        event.preventDefault();
        if (event.repeat) return;
        if (event.key === 'Escape') { this.host.escape(); return; }
        const current = this.controls.findIndex(button => button === document.activeElement);
        const backward = ['ArrowUp', 'ArrowLeft', 'w'].includes(event.key);
        const next = (Math.max(0, current) + (backward ? -1 : 1) + this.controls.length) % this.controls.length;
        this.controls[next]?.focus({ preventScroll: true });
    }
    private makeButton(index: number): HTMLButtonElement {
        const button = document.createElement('button'); button.type = 'button';
        Object.assign(button.style, {
            position: 'absolute', margin: '0', padding: '0', border: '0', borderRadius: '0',
            background: 'transparent', color: 'transparent', fontSize: '1px',
            pointerEvents: 'auto', cursor: 'pointer', touchAction: 'manipulation',
            minHeight: '44px', scrollMarginBlock: '6px'
        });
        this.controlLifetime.listen(button, 'focus', () => {
            if (!this.controllerFocus) this.host.resetInput();
            this.host.select(index);
            button.style.outline = '2px solid #fff3be'; button.style.outlineOffset = '2px';
            this.revealCompactControl(button);
        });
        this.controlLifetime.listen(button, 'blur', () => { button.style.outline = ''; button.style.outlineOffset = ''; });
        this.controlLifetime.listen(button, 'click', event => {
            event.stopPropagation();
            if (this.root.hidden || this.controls[index] !== button || this.lifetime.isDisposed || document.hidden || this.canvas.inert) return;
            this.host.resetInput(); this.host.select(index); this.host.activate(index);
        });
        return button;
    }
    private revealCompactControl(button: HTMLButtonElement): void {
        if (this.root.hidden || document.hidden || this.canvas.inert || document.activeElement !== button
            || this.root.getAttribute('data-compact') !== 'true') return;
        // Focus must not move the page, but a short reflowed menu still needs to
        // reveal its own focused row. Nearest + instant avoids animated travel.
        button.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
    }
    private syncStatus(): void {
        // Keep an empty live region mounted before feedback arrives. Desktop
        // uses a visually hidden equivalent of its canvas toast; compact menus
        // expose that same region visibly, without duplicating announcements.
        const text = this.statusText;
        if (!this.statusAttached) { this.root.append(this.status); this.statusAttached = true; }
        if (this.status.textContent !== text) {
            this.status.textContent = text;
            if (text && this.root.getAttribute('data-compact') === 'true')
                this.status.scrollIntoView?.({ block: 'nearest', inline: 'nearest', behavior: 'instant' });
        }
    }

    private fit(): void {
        if (this.root.hidden || this.lifetime.isDisposed) return;
        const box = this.canvas.getBoundingClientRect();
        // Gallery details are painted content with a single Back control. An
        // opaque reflow panel would cover the very content being inspected.
        const compact = box.width < 480 && (['title', 'paused', 'settings'].includes(this.compactScreen)
            || this.compactScreen === 'gallery' && this.controls.length > 1);
        const key = `${box.left},${box.top},${box.width},${box.height},${window.innerWidth},${window.innerHeight},${compact}`;
        if (key === this.bounds) return;
        this.bounds = key;
        this.root.setAttribute('data-compact', String(compact));
        this.syncStatus();
        if (compact) {
            // Reflow these same native controls, with scrolling when needed. No
            // second menu, duplicated actions, modal or clipped tiny hit areas.
            const width = Math.min(380, window.innerWidth - 24);
            const rows = this.compactScreen === 'settings' ? 6 : this.compactScreen === 'paused' ? 3 : this.compactScreen === 'title' ? 4 : Math.ceil((this.controls.length + 2) / 2);
            const height = Math.min(window.innerHeight - 24, (this.compactScreen === 'paused' ? 88 : 66) + rows * 52);
            const top = Math.max(12, Math.min(window.innerHeight - height - 12, this.compactScreen === 'title' ? box.top + box.height * .47 : (window.innerHeight - height) / 2));
            Object.assign(this.root.style, { left: `${Math.round((window.innerWidth - width) / 2)}px`, top: `${Math.round(top)}px`, width: `${width}px`, height: `${height}px` });
        } else Object.assign(this.root.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
        const focused = this.controls.find(button => button === document.activeElement);
        if (focused) this.revealCompactControl(focused);
    }
}
