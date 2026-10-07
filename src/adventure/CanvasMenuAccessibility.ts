import { DisposalScope } from '../engine/DisposalScope';

export interface CanvasMenuChoice {
    label: string;
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
    private controllerFocus = false;
    private bounds = '';
    private readonly controlBounds = new WeakMap<HTMLButtonElement, {
        x: number; y: number; width: number; height: number;
        left: string; top: string; cssWidth: string; cssHeight: string;
    }>();

    constructor(private readonly canvas: HTMLCanvasElement, private readonly host: CanvasMenuHost) {
        this.root.className = 'canvas-menu-accessibility';
        this.root.hidden = true;
        Object.assign(this.root.style, { position: 'fixed', zIndex: '20', pointerEvents: 'none' });
        document.body.append(this.root);
        this.lifetime.listen(this.root, 'keydown', event => this.key(event));
        this.lifetime.listen(this.root, 'keyup', event => {
            if (this.ownsKey(event)) { this.host.resetInput(); event.stopPropagation(); }
        });
        this.lifetime.listen(window, 'resize', () => this.fit());
        this.lifetime.listen(window, 'scroll', () => this.fit(), true);
        this.lifetime.listen(document, 'visibilitychange', () => {
            if (document.hidden) this.clear({ restoreFocus: false });
        });
        this.lifetime.add(() => this.root.remove());
    }

    /** Call after drawing; identities stay stable while labels/settings change. */
    sync(screen: string, label: string, choices: readonly CanvasMenuChoice[], selected: number): void {
        if (this.lifetime.isDisposed) return;
        if (!choices.length || document.hidden || this.canvas.inert) { this.clear({ restoreFocus: false }); return; }
        const hadFocus = this.ownsFocus();
        const rebuild = this.screen !== screen || this.controls.length !== choices.length;
        if (rebuild) {
            this.controlLifetime.dispose(); this.controlLifetime = new DisposalScope();
            this.screen = screen;
            this.controls = choices.map((_, index) => this.makeButton(index));
            this.root.replaceChildren(...this.controls);
        }
        if (this.root.getAttribute('aria-label') !== label) this.root.setAttribute('aria-label', label);
        choices.forEach((choice, index) => {
            const button = this.controls[index];
            if (button.textContent !== choice.label) button.textContent = choice.label;
            this.positionControl(button, choice);
        });
        if (this.root.hidden) this.root.hidden = false;
        this.fit();
        const active = this.controls[Math.max(0, Math.min(selected, this.controls.length - 1))];
        // Returning from a native menu action retains focus; opening a modal or
        // moving elsewhere must never have its focus taken by the next frame.
        if ((hadFocus && rebuild || this.pendingFocus && document.activeElement === this.canvas) && !document.hidden)
            active?.focus({ preventScroll: true });
        this.pendingFocus = false;
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
        this.pendingFocus = restoreFocus && focused;
        this.root.hidden = true;
        this.controlLifetime.dispose(); this.controlLifetime = new DisposalScope();
        this.root.replaceChildren();
        this.controls = []; this.screen = '';
        if (focused) {
            this.host.resetInput();
            if (restoreFocus && !document.hidden && !this.canvas.inert) this.canvas.focus({ preventScroll: true });
            else (document.activeElement as HTMLElement | null)?.blur?.();
        }
    }

    dispose(): void { this.clear({ restoreFocus: false }); this.lifetime.dispose(); }

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
            pointerEvents: 'auto', cursor: 'pointer', touchAction: 'manipulation'
        });
        this.controlLifetime.listen(button, 'focus', () => {
            if (!this.controllerFocus) this.host.resetInput();
            this.host.select(index);
            button.style.outline = '2px solid #fff3be'; button.style.outlineOffset = '2px';
        });
        this.controlLifetime.listen(button, 'blur', () => { button.style.outline = ''; button.style.outlineOffset = ''; });
        this.controlLifetime.listen(button, 'click', event => {
            event.stopPropagation();
            if (this.root.hidden || this.controls[index] !== button || this.lifetime.isDisposed || document.hidden || this.canvas.inert) return;
            this.host.resetInput(); this.host.select(index); this.host.activate(index);
        });
        return button;
    }
    private fit(): void {
        if (this.root.hidden || this.lifetime.isDisposed) return;
        const box = this.canvas.getBoundingClientRect();
        const key = `${box.left},${box.top},${box.width},${box.height}`;
        if (key === this.bounds) return;
        this.bounds = key;
        Object.assign(this.root.style, { left: `${box.left}px`, top: `${box.top}px`, width: `${box.width}px`, height: `${box.height}px` });
    }
}
