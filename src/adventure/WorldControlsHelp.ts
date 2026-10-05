import { DisposalScope } from '../engine/DisposalScope';

interface ControlsHelpHost {
    canOpen(): boolean;
    resetInput(): void;
    suspendTouch(): () => void;
    onOpenChange?(open: boolean): void;
}

export interface ControlsHelpContent {
    id?: string;
    regionLabel?: string;
    navigation?: readonly string[];
    touch?: string;
    closeLabel?: string;
}

/** Readable reference only; the host retains its settings/paused state and save. */
export class WorldControlsHelp {
    private readonly lifetime = new DisposalScope();
    readonly dialog = document.createElement('dialog');
    readonly closeButton = document.createElement('button');
    private readonly heading = document.createElement('h2');
    private opened = false;
    private restoreFocus: HTMLElement | null = null;
    private originalInert = false;
    private releaseTouch?: () => void;

    constructor(private readonly canvas: HTMLCanvasElement, private readonly host: ControlsHelpHost, contentOptions: ControlsHelpContent = {}) {
        try {
            this.dialog.id = contentOptions.id ?? 'world-controls-help'; this.dialog.className = 'world-controls-help';
            const titleId = contentOptions.id ? `${contentOptions.id}-title` : 'world-controls-title';
            this.dialog.setAttribute('aria-labelledby', titleId);
            this.heading.id = titleId; this.heading.textContent = 'CONTROLES'; this.heading.tabIndex = -1;
            const content = document.createElement('div'); content.className = 'world-controls-content'; content.tabIndex = 0;
            content.setAttribute('role', 'region'); content.setAttribute('aria-label', contentOptions.regionLabel ?? 'Controles da aventura World');
            const list = document.createElement('dl');
            for (const [action, keys] of [
                ['Mover', 'A / D ou ← / →'],
                ['Pular', 'Espaço, W, Z ou ↑'],
                ['Correr', 'Segure Shift ou X enquanto anda.'],
                ['Sentada', 'No ar, aperte S ou ↓.'],
                ['Pausar / continuar', 'Esc'],
                ['Ligar / desligar som', 'M'],
            ]) {
                const term = document.createElement('dt'), description = document.createElement('dd');
                term.textContent = action; description.textContent = keys; list.append(term, description);
            }
            const navigation = (contentOptions.navigation ?? ['Menus: Tab ou ↑/↓ para escolher; Enter ou Espaço para confirmar; Esc para voltar.'])
                .map(text => { const paragraph = document.createElement('p'); paragraph.textContent = text; return paragraph; });
            const touchTitle = document.createElement('h3'); touchTitle.textContent = 'NA TELA DE TOQUE';
            const touch = document.createElement('p');
            touch.textContent = contentOptions.touch ?? '← / → para andar; ↑ para pular; segure X + direção para correr; ↓ no ar para a sentada. Toque no topo da tela para pausar.';
            content.append(list, ...navigation, touchTitle, touch);
            const footer = document.createElement('footer');
            this.closeButton.type = 'button'; this.closeButton.textContent = contentOptions.closeLabel ?? 'VOLTAR ÀS OPÇÕES';
            if (contentOptions.id) this.closeButton.id = `${contentOptions.id}-close`;
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

    open(): void {
        if (this.opened || this.lifetime.isDisposed || !this.host.canOpen() || document.hidden) return;
        this.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        this.originalInert = this.canvas.inert;
        this.host.resetInput(); this.releaseTouch = this.host.suspendTouch();
        this.canvas.inert = true; this.opened = true;
        try { this.host.onOpenChange?.(true); this.dialog.showModal(); this.heading.focus({ preventScroll: true }); }
        catch (error) { this.close(); throw error; }
    }

    close(restore = true): void {
        if (!this.opened) return;
        this.opened = false; this.host.onOpenChange?.(false);
        if (this.dialog.open) this.dialog.close();
        this.canvas.inert = this.originalInert;
        this.releaseTouch?.(); this.releaseTouch = undefined; this.host.resetInput();
        const target = this.restoreFocus; this.restoreFocus = null;
        if (restore && !document.hidden && this.host.canOpen() && !this.lifetime.isDisposed)
            (target?.isConnected ? target : this.canvas).focus({ preventScroll: true });
    }

    dispose(): void { this.close(false); this.lifetime.dispose(); }
}
