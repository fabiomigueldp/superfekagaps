import { DisposalScope } from '../engine/DisposalScope';

/** Readable 1× status in the letterbox; native pause stays at least 44 CSS px. */
export class WorldHudAccessibility {
    private readonly lifetime = new DisposalScope();
    readonly root = document.createElement('div');
    readonly pause = document.createElement('button');
    private readonly status = document.createElement('span');
    private geometry = '';
    private readableStrip = false;
    get showsReadableStrip(): boolean { return !this.root.hidden && this.readableStrip; }

    constructor(private readonly canvas: HTMLCanvasElement, onPause: () => void, mount: HTMLElement = document.body) {
        this.root.className = 'world-hud-accessibility'; this.root.hidden = true;
        this.root.setAttribute('role', 'group'); this.status.setAttribute('aria-hidden', 'true');
        this.pause.type = 'button'; this.pause.textContent = 'Ⅱ'; this.pause.setAttribute('aria-label', 'Pausar');
        Object.assign(this.root.style, { position: 'fixed', zIndex: '10', pointerEvents: 'none', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '8px' });
        Object.assign(this.status.style, { color: '#f5efd3', background: '#123547', border: '1px solid #98703b', font: 'bold 12px/1.3 monospace', padding: '7px 9px', marginRight: 'auto' });
        Object.assign(this.pause.style, { width: '44px', height: '44px', flex: '0 0 44px', border: '1px solid #98703b', borderRadius: '0', background: '#123547', color: '#f5efd3', font: 'bold 18px monospace', pointerEvents: 'auto', touchAction: 'manipulation', cursor: 'pointer' });
        this.root.append(this.status, this.pause); mount.append(this.root);
        this.lifetime.listen(this.pause, 'click', event => {
            event.stopPropagation();
            if (this.root.hidden || document.hidden || this.canvas.inert || this.lifetime.isDisposed) return;
            this.canvas.focus({ preventScroll: true }); onPause();
        });
        this.lifetime.listen(this.pause, 'focus', () => { this.pause.style.outline = '2px solid #ffe29a'; this.pause.style.outlineOffset = '2px'; });
        this.lifetime.listen(this.pause, 'blur', () => { this.pause.style.outline = ''; this.pause.style.outlineOffset = ''; });
        this.lifetime.listen(window, 'resize', () => this.fit());
        this.lifetime.listen(window, 'scroll', () => this.fit(), true);
        this.lifetime.add(() => this.root.remove());
    }

    sync(visible: boolean, stage: string, coins: number, seals: number, helmet: boolean, chapterStatus?: string): void {
        const hidden = !visible || document.hidden || this.canvas.inert;
        if (this.root.hidden !== hidden) this.root.hidden = hidden;
        // Inline flex must never overrule hidden in a host stylesheet.
        const display = hidden ? 'none' : 'flex';
        if (this.root.style.display !== display) this.root.style.display = display;
        if (hidden) return;
        const text = chapterStatus ?? `${stage} · ${coins} moedas · ${seals}/3 selos${helmet ? ' · Capacete' : ''}`;
        if (this.status.textContent !== text) { this.status.textContent = text; this.root.setAttribute('aria-label', text); }
        this.fit();
    }

    dispose(): void { this.lifetime.dispose(); }

    private fit(): void {
        if (this.root.hidden || this.lifetime.isDisposed) return;
        const box = this.canvas.getBoundingClientRect(), small = box.width < 480;
        const key = `${box.left},${box.top},${box.width},${box.height},${small}`;
        if (key === this.geometry) return;
        this.geometry = key;
        this.status.hidden = !small;
        // Portrait has letterbox space. At 1× landscape, keep a readable row
        // above the game when possible; otherwise the pause occupies one corner.
        const above = small && box.top >= 48;
        this.readableStrip = above;
        Object.assign(this.root.style, { left: `${box.left}px`, top: `${above ? box.top - 48 : box.top}px`, width: `${box.width}px`, height: '44px' });
        this.status.style.visibility = small && above ? 'visible' : 'hidden';
        Object.assign(this.pause.style, { background: small && above ? '#123547' : 'transparent', color: small && above ? '#f5efd3' : 'transparent', borderColor: small && above ? '#98703b' : 'transparent' });
    }
}
