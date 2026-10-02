import { Input, type InputAction, type InputActionSource } from '../../../engine/Input';
import { LabToolbarAction } from '../JuiceLabToolbar';

const ACTIONS: ReadonlyArray<readonly [InputAction, string, string]> = [
    ['left', '←', 'Andar para a esquerda'], ['right', '→', 'Andar para a direita'],
    ['down', '↓', 'Sentada: atacar para baixo no ar'], ['run', 'X', 'Correr'], ['jump', '↑', 'Pular']
];

export interface GuairaTouchControlsOptions {
    input: Input;
    /** Read live state on every activation, including before the next UI frame. */
    isPlaying: () => boolean;
    onInteract?: () => void;
    onVisibilityChange?: (visible: boolean) => void;
    parent?: HTMLElement;
}

type Gesture = { source: InputActionSource; button: HTMLButtonElement; pointerId?: number };

/** Optional native controls. Import guaira-touch-controls.css in the owning entry. */
export class GuairaTouchControls {
    readonly root = document.createElement('div');
    private readonly buttons = new Map<InputAction, HTMLButtonElement>();
    private readonly gestures = new Map<string, Gesture>();
    private readonly removers: Array<() => void> = [];
    private readonly coarse = typeof matchMedia === 'function' ? matchMedia('(any-pointer: coarse)') : null;
    private restoreCanvas?: () => void;
    private closed = false;

    constructor(private readonly options: GuairaTouchControlsOptions) {
        try {
            this.root.id = 'guaira-touch-controls';
            this.root.className = 'guaira-touch-controls';
            this.root.setAttribute('role', 'group');
            this.root.setAttribute('aria-label', 'Controles de toque de Guaíra');
            this.root.hidden = true;
            for (const [action, label, name] of ACTIONS) {
                const button = document.createElement('button');
                button.type = 'button'; button.className = 'guaira-touch-button';
                button.setAttribute('data-action', action);
                button.setAttribute('data-symbol', label);
                new LabToolbarAction(button).setLabel(label, name);
                this.buttons.set(action, button); this.root.append(button);
                this.listen(button, 'pointerdown', event => {
                    const pointer = event as PointerEvent;
                    if (pointer.button !== 0 || !this.available()) return;
                    pointer.preventDefault();
                    const key = `pointer:${pointer.pointerId}`;
                    if (this.gestures.has(key)) return;
                    this.begin(key, button, action, pointer.pointerId);
                });
                this.listen(button, 'lostpointercapture', event => this.end(`pointer:${(event as PointerEvent).pointerId}`, true));
                this.listen(button, 'keydown', event => {
                    const key = event as KeyboardEvent;
                    if (!['Enter', ' '].includes(key.key) || key.ctrlKey || key.altKey || key.metaKey) return;
                    key.preventDefault();
                    if (!key.repeat && this.available()) this.begin(`key:${action}:${key.key}`, button, action);
                });
                this.listen(button, 'keyup', event => {
                    const key = event as KeyboardEvent;
                    if (!['Enter', ' '].includes(key.key)) return;
                    key.preventDefault(); this.end(`key:${action}:${key.key}`, !this.available());
                });
                this.listen(button, 'blur', () => {
                    for (const [key, gesture] of this.gestures) if (gesture.button === button && gesture.pointerId === undefined) this.end(key, true);
                });
                // Pointer and keyboard handlers already own their gestures. A native
                // assistive click without those events gets one ordinary action tap.
                this.listen(button, 'click', event => {
                    event.preventDefault();
                    if ((event as MouseEvent).detail !== 0 || !this.available()) return;
                    const key = `click:${action}`;
                    if (this.gestures.has(key)) return;
                    this.begin(key, button, action); this.end(key, !this.available());
                });
                this.listen(button, 'contextmenu', event => event.preventDefault());
            }
            this.listen(window, 'pointerup', event => this.end(`pointer:${(event as PointerEvent).pointerId}`, !this.available()), true);
            this.listen(window, 'pointercancel', event => this.end(`pointer:${(event as PointerEvent).pointerId}`, true), true);
            this.listen(window, 'blur', () => this.cancelAll());
            this.listen(document, 'visibilitychange', () => { if (document.hidden) this.cancelAll(); });
            if (this.coarse) this.listen(this.coarse, 'change', () => this.sync());
            (options.parent ?? document.body).append(this.root);
            this.sync();
        } catch (error) {
            // Construction has not returned ownership to its host yet.
            try { this.dispose(); } catch { /* Preserve the setup failure after detaching resources. */ }
            throw error;
        }
    }

    get visible(): boolean { return !this.closed && !this.root.hidden; }

    /** Call from the entry's existing state reflection; this schedules no work. */
    sync(): void {
        if (this.closed) return;
        const visible = typeof PointerEvent !== 'undefined' &&
            ((typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0) || !!this.coarse?.matches);
        const changed = this.root.hidden === visible;
        if (!visible || !this.options.isPlaying()) this.cancelAll();
        if (visible && !this.restoreCanvas) this.restoreCanvas = this.options.input.suspendCanvasTouchControls();
        if (!visible && this.restoreCanvas) { this.restoreCanvas(); this.restoreCanvas = undefined; }
        this.root.hidden = !visible;
        for (const button of this.buttons.values()) button.disabled = !visible || !this.options.isPlaying();
        if (changed) this.options.onVisibilityChange?.(visible);
    }

    dispose(): void {
        if (this.closed) return;
        this.closed = true; this.cancelAll();
        for (const remove of this.removers.splice(0)) remove();
        this.restoreCanvas?.(); this.restoreCanvas = undefined;
        this.root.remove(); this.options.onVisibilityChange?.(false);
    }

    private available(): boolean { return this.visible && !document.hidden && this.options.isPlaying(); }

    private begin(key: string, button: HTMLButtonElement, action: InputAction, pointerId?: number): void {
        if (this.gestures.has(key)) return;
        const source = this.options.input.createActionSource(() => this.end(key, true));
        this.gestures.set(key, { source, button, pointerId });
        button.setAttribute('data-held', 'true'); source.press(action);
        if (pointerId !== undefined) {
            try { button.setPointerCapture(pointerId); } catch { /* Window release is the fallback. */ }
        }
        // Register ownership/capture before callbacks: a synchronous focus change
        // or game reset must be able to cancel this exact gesture immediately.
        this.options.onInteract?.();
        if (!this.available()) this.end(key, true);
    }

    private end(key: string, cancelled: boolean): void {
        const gesture = this.gestures.get(key);
        if (!gesture) return;
        // Remove first: releasePointerCapture may synchronously report lost capture.
        this.gestures.delete(key);
        if (cancelled) gesture.source.cancel(); else gesture.source.release();
        gesture.source.dispose();
        if (![...this.gestures.values()].some(value => value.button === gesture.button)) gesture.button.removeAttribute('data-held');
        if (gesture.pointerId !== undefined) {
            try { if (gesture.button.hasPointerCapture(gesture.pointerId)) gesture.button.releasePointerCapture(gesture.pointerId); } catch { /* The UA may already have cancelled it. */ }
        }
    }

    private cancelAll(): void { for (const key of [...this.gestures.keys()]) this.end(key, true); }

    private listen(target: EventTarget, type: string, handler: EventListener, capture = false): void {
        target.addEventListener(type, handler, { capture, passive: false });
        this.removers.push(() => target.removeEventListener(type, handler, capture));
    }
}
