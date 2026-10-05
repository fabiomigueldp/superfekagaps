import { DisposalScope } from '../../../engine/DisposalScope';
import type { Input } from '../../../engine/Input';
import { pixelText, textWidth } from '../../../graphics/BitmapFont';
import { ART } from '../../../graphics/palette';
import { LabToolbarAction } from '../JuiceLabToolbar';
import { EXPERIMENTAL_ROUTES, experimentalTitleSize, requestsExperimentalHub } from './ExperimentalRoutes';

export const EXTRAS_LABEL = 'EXTRAS';

export interface ExperimentalHubHost {
    readonly input: Input;
    isTitle(): boolean;
}

/** Main-title DOM only. One native modal, no scene, save, media request or animation loop. */
export class ExperimentalHub {
    private readonly lifetime = new DisposalScope();
    readonly entry = document.createElement('button');
    readonly rail = document.createElement('nav');
    readonly dialog = document.createElement('dialog');
    readonly closeButton = document.createElement('button');
    private readonly links: HTMLAnchorElement[] = [];
    private restoreFocus: HTMLElement | null = null;
    private releaseTouch?: () => void;
    private titleVisible = false;
    private opened = false;
    private reopenOnReturn = false;
    private readonly originalInert: boolean;

    constructor(private readonly canvas: HTMLCanvasElement, private readonly host: ExperimentalHubHost) {
        this.originalInert = canvas.inert;
        try {
            this.rail.className = 'experimental-entry'; this.rail.hidden = true;
            this.rail.setAttribute('aria-label', 'Extras');
            this.entry.id = 'open-experiments'; this.entry.type = 'button';
            this.entry.setAttribute('aria-haspopup', 'dialog');
            this.entry.setAttribute('aria-controls', 'experimental-hub');
            this.entry.setAttribute('aria-expanded', 'false');
            new LabToolbarAction(this.entry, true).setLabel(EXTRAS_LABEL, EXTRAS_LABEL);
            this.rail.append(this.entry);
            this.dialog.id = 'experimental-hub'; this.dialog.className = 'experimental-hub';
            this.dialog.setAttribute('aria-labelledby', 'experimental-hub-title');
            this.dialog.setAttribute('aria-describedby', 'experimental-hub-note');
            const heading = document.createElement('h1'); heading.id = 'experimental-hub-title';
            const headingArt = document.createElement('canvas'), headingText = document.createElement('span');
            headingArt.className = 'experimental-heading-art'; headingArt.setAttribute('aria-hidden', 'true');
            headingArt.width = textWidth(EXTRAS_LABEL, 2); headingArt.height = 14;
            headingText.className = 'lab-sr'; headingText.textContent = EXTRAS_LABEL;
            const headingContext = headingArt.getContext('2d');
            if (headingContext) pixelText(headingContext, EXTRAS_LABEL, 0, 0, ART.goldLight, 2);
            else { headingArt.hidden = true; headingText.className = ''; }
            heading.append(headingArt, headingText);
            const routes = document.createElement('nav'); routes.setAttribute('aria-label', 'Escolher extra');
            for (const [index, route] of EXPERIMENTAL_ROUTES.entries()) {
                const link = document.createElement('a'), plate = document.createElement('span'), detail = document.createElement('span');
                link.href = route.href; link.className = 'experimental-route';
                link.setAttribute('aria-label', `${route.label}. ${route.description}`);
                plate.className = 'experimental-route-plate'; plate.setAttribute('aria-hidden', 'true');
                new LabToolbarAction(plate, index === 0).setLabel(route.label, route.label);
                detail.className = 'experimental-route-detail'; detail.textContent = route.description;
                link.append(plate, detail); routes.append(link); this.links.push(link);
            }
            const note = document.createElement('p'); note.id = 'experimental-hub-note';
            note.textContent = 'Para seguir a campanha, volte ao título.';
            this.closeButton.type = 'button'; this.closeButton.id = 'close-experiments';
            new LabToolbarAction(this.closeButton).setLabel('VOLTAR AO TÍTULO', 'VOLTAR AO TÍTULO');
            this.dialog.append(heading, routes, note, this.closeButton);
            document.body.append(this.rail, this.dialog);
            this.lifetime.listen(this.entry, 'click', () => this.open());
            this.lifetime.listen(this.closeButton, 'click', () => this.close());
            this.lifetime.listen(this.dialog, 'cancel', event => { event.preventDefault(); this.close(); });
            this.lifetime.listen(this.dialog, 'close', () => { if (!this.dialog.open) this.close(); });
            this.lifetime.listen(window, 'resize', () => this.fitTitle());
            // Input was mounted earlier. Reset after its capture listener, before any
            // game/menu bubbling. Keep native Enter, Space and modified-link clicks.
            this.lifetime.listen(window, 'keydown', event => this.key(event), true);
            this.lifetime.listen(window, 'keyup', event => {
                if (!this.opened) return;
                this.host.input.reset(); event.stopImmediatePropagation();
            }, true);
            this.lifetime.listen(window, 'pagehide', () => { this.reopenOnReturn = this.opened; this.close(false); });
            this.lifetime.listen(window, 'pageshow', event => {
                if (event.persisted && this.reopenOnReturn) { this.reopenOnReturn = false; this.open(); }
            });
            this.sync();
        } catch (error) { this.dispose(); throw error; }
    }
    get isOpen() { return this.opened; }
    get isDisposed() { return this.lifetime.isDisposed; }
    openFromSearch(search: string) { if (requestsExperimentalHub(search)) this.open(); }

    sync() {
        if (this.isDisposed) return;
        const visible = this.host.isTitle();
        if (visible === this.titleVisible) return;
        this.titleVisible = visible; this.rail.hidden = !visible;
        document.body.classList.toggle('experimental-title', visible);
        this.canvas.classList.toggle('experimental-title-canvas', visible);
        if (!visible) this.close(false);
        this.fitTitle();
    }
    private fitTitle() {
        if (!this.titleVisible || this.isDisposed) return;
        const size = experimentalTitleSize(window.innerWidth, window.innerHeight);
        this.canvas.style.setProperty('--experimental-title-width', `${size.width}px`);
        this.canvas.style.setProperty('--experimental-title-height', `${size.height}px`);
    }
    open() {
        if (this.isDisposed || this.opened || !this.host.isTitle()) return;
        this.restoreFocus = document.activeElement instanceof HTMLElement ? document.activeElement : this.entry;
        this.host.input.reset(); this.releaseTouch = this.host.input.suspendCanvasTouchControls();
        this.canvas.inert = true; this.opened = true;
        this.entry.setAttribute('aria-expanded', 'true');
        try { this.dialog.showModal(); this.links[0].focus({ preventScroll: true }); }
        catch (error) { this.close(); throw error; }
    }
    close(restore = true) {
        if (!this.opened) return;
        this.opened = false;
        if (this.dialog.open) this.dialog.close();
        this.canvas.inert = this.originalInert;
        this.releaseTouch?.(); this.releaseTouch = undefined; this.host.input.reset();
        this.entry.setAttribute('aria-expanded', 'false');
        const target = this.restoreFocus; this.restoreFocus = null;
        if (restore && this.titleVisible && !this.isDisposed) {
            (target?.isConnected && target !== document.body ? target : this.entry).focus({ preventScroll: true });
        }
    }
    private key(event: KeyboardEvent) {
        if (this.isDisposed) return;
        const onEntry = event.target instanceof HTMLElement && this.rail.contains(event.target);
        if (!this.opened && !onEntry) return;
        this.host.input.reset(); event.stopImmediatePropagation();
        if (event.key === 'Escape' && this.opened) { event.preventDefault(); this.close(); return; }
        if (event.repeat && ['Enter', ' ', 'Spacebar'].includes(event.key)) { event.preventDefault(); return; }
        if (!this.opened || event.key !== 'Tab') return;
        const first = this.links[0], last = this.closeButton;
        if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
        else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    }
    dispose() {
        if (this.isDisposed) return;
        this.close(false); this.lifetime.dispose();
        this.rail.remove(); this.dialog.remove();
        document.body.classList.toggle('experimental-title', false);
        this.canvas.classList.toggle('experimental-title-canvas', false);
        this.canvas.style.removeProperty('--experimental-title-width');
        this.canvas.style.removeProperty('--experimental-title-height');
    }
}
