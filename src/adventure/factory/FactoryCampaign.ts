import type { CameraData } from '../../types';
import { SalonEntryTransition, canApproachSalon, salonEntryPlayer, drawSalonEntryCue, drawSalonEntryDoor, drawSalonEntryShade, salonEntryButtonPosition, type SalonEntryStep } from './SalonEntryTransition';
import { WorldGame } from '../WorldGame';
import { DisposalScope } from '../../engine/DisposalScope';
import { FactorySalonSession } from './FactorySalonSession';
import { FACTORY_SALON, hasSalonPassage, recordSalonPassage, recordSalonVictory, requiresSalonPassage } from './FactorySalon';
import { drawFactorySalon } from './FactorySalonArt';
import { FactorySalonPresentation } from './FactorySalonPresentation';
import './factory-salon.css';

/** Suspends the live campaign instead of copying or reloading its run/save. */
export class FactoryCampaign extends WorldGame {
    private salon?: FactorySalonSession;
    private entry?: SalonEntryTransition;
    private salonEvents?: DisposalScope;
    private shell?: HTMLDialogElement;
    private reflect?: () => void;
    private readonly enterButton: HTMLButtonElement;
    constructor(private readonly campaignCanvas: HTMLCanvasElement) {
        super(campaignCanvas);
        const objects = this.art.objects.bind(this.art);
        this.art.objects = (...args) => {
            if (this.stage.id === FACTORY_SALON.stage) {
                drawFactorySalon(args[0], args[2], args[3], this.store.save.seen.includes(FACTORY_SALON.victory));
                if (this.entry?.frame.phase === 'outgoing') drawSalonEntryDoor(args[0], args[2], args[3], this.entry.frame);
                else if (this.canEnter) drawSalonEntryCue(args[0], args[2], args[3], navigator.maxTouchPoints > 0);
            }
            objects(...args);
        };
        this.enterButton = document.createElement('button');
        this.enterButton.className = 'factory-salon-enter world-entrance';
        this.enterButton.textContent = 'Entrar no salão';
        this.enterButton.hidden = true;
        document.body.append(this.enterButton);
        this.listen(this.enterButton, 'click', () => this.beginSalonEntry());
        this.listen(campaignCanvas, 'keydown', e => {
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (e.key.toLowerCase() === 'e' && !e.repeat) this.beginSalonEntry();
        });
        this.listen(window, 'keydown', e => {
            if (!this.entry?.active || e.ctrlKey || e.metaKey || e.altKey) return;
            e.preventDefault(); e.stopImmediatePropagation();
            this.input.reset(); this.salon?.input.reset();
            if (e.repeat) return;
            if (e.key === 'Escape') {
                this.cancelEntry();
                if (this.salon && this.salon.state === 'playing') this.salon.toggleLabPause();
                else this.campaignCanvas.focus({ preventScroll: true });
            } else if (e.key.toLowerCase() === 'e' || e.key === 'Enter' || e.key === ' ') this.stepEntry(this.entry.skip());
        }, true);
        this.listen(window, 'keyup', e => {
            if (!this.entry?.active || e.ctrlKey || e.metaKey || e.altKey) return;
            e.preventDefault(); e.stopImmediatePropagation(); this.input.reset(); this.salon?.input.reset();
        }, true);
        this.listen(window, 'pointerdown', e => {
            if (!this.entry?.active) return;
            e.preventDefault(); e.stopImmediatePropagation(); this.stepEntry(this.entry.skip());
        }, true);
        this.listen(window, 'blur', () => this.cancelEntry());
        this.listen(document, 'visibilitychange', () => { if (document.hidden) this.cancelEntry(); });
        this.addCleanup(() => { this.cancelEntry(); this.recordSalonProgress(); this.salonEvents?.dispose(); this.salon?.dispose(); this.shell?.remove(); this.enterButton.remove(); });
        // A paused campaign may still own a live salon. Only its ordinary canvas is reusable.
        if (new.target === FactoryCampaign) this.enableFrozenMenuPaint(() => !this.salon);
    }
    protected override requiresCampaignPassage(): boolean {
        return requiresSalonPassage(this.stage.id, this.store.save);
    }
    private recordSalonProgress(): void {
        if (!this.salon) return;
        const passage = this.salon.presentedAtChampionship && recordSalonPassage(this.store.save);
        const victory = this.salon.earnedVictory && recordSalonVictory(this.store.save);
        if (passage || victory) this.store.persist();
    }
    private get canEnter() {
        return !this.isDisposed && !this.salon && !this.entry?.active && this.state === 'playing' && !this.player.data.isDead &&
            canApproachSalon(this.stage.id, this.player.getRect(), this.player.data.isGrounded);
    }
    /** Immediate programmatic handoff; actual door controls play the entry below. */
    enterSalon(): void {
        if (!this.canEnter) return;
        this.openSalon();
    }
    private beginSalonEntry(): void {
        if (!this.canEnter) return;
        this.entry = new SalonEntryTransition(this.renderer.reducedMotion);
        this.input.reset(); this.enterButton.hidden = true;
        this.campaignCanvas.focus({ preventScroll: true });
    }
    private cancelEntry(): void {
        if (!this.entry) return;
        this.entry.cancel(); this.entry = undefined;
        this.input.reset(); this.salon?.input.reset();
    }
    private stepEntry(step: SalonEntryStep): void {
        if (step === 'handoff') {
            try { this.openSalon(); }
            catch (error) { this.cancelEntry(); throw error; }
            if (!this.salon) this.cancelEntry();
        } else if (step === 'finished') this.cancelEntry();
    }
    private openSalon(): void {
        if (this.salon || this.isDisposed) return;
        this.pause(); this.input.reset(); this.enterButton.hidden = true;
        const shell = document.createElement('dialog'); shell.className = 'factory-salon';
        shell.setAttribute('aria-label', 'Salão da Fábrica de Suco');
        const status = document.createElement('p'); status.className = 'lab-sr'; status.setAttribute('aria-live', 'polite');
        const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
        canvas.id = 'game-canvas'; this.campaignCanvas.id = 'factory-campaign-canvas';
        canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Competição e combate contra Turbosuco');
        canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
        shell.append(canvas, status); document.body.append(shell); shell.showModal();
        this.shell = shell;
        // Keep native lab presentation separate from the campaign's live region.
        const nativeStatus = document.createElement('span');
        const lab = new FactorySalonSession(canvas, nativeStatus); this.salon = lab;
        lab.inheritCampaignAudio(this.audio);
        lab.inheritCampaignPassage(hasSalonPassage(this.store.save), this.requiresCampaignPassage());
        document.title = 'Super Feka Gaps · Salão da Fábrica';
        // Detached controls and queued dispatches belong only to this visit.
        const events = this.salonEvents = new DisposalScope();
        const presentation = new FactorySalonPresentation(shell, canvas, lab, events,
            () => this.leaveSalon(), () => this.recordSalonProgress());
        this.reflect = () => {
            presentation.sync();
            lab.reflectCampaignStatus(status, nativeStatus.textContent ?? '');
        };
        this.reflect(); canvas.focus();
    }
    leaveSalon(): void {
        this.cancelEntry();
        if (this.isDisposed || !this.salon) return;
        const won = this.salon.earnedVictory;
        this.recordSalonProgress();
        this.salonEvents?.dispose(); this.salonEvents = undefined;
        this.salon.dispose(); this.salon = undefined; this.reflect = undefined;
        this.shell?.close(); this.shell?.remove(); this.shell = undefined;
        this.campaignCanvas.id = 'game-canvas';
        // Resume the very same campaign run at its doorway with neutral motion.
        // Salon keys, the final stomp and a held return button cannot leak out.
        this.player.data.velocity.x = 0; this.player.data.velocity.y = 0;
        this.camera.shakeTimer = 0;
        this.input.reset(); this.resume();
        this.showCampaignNotice(won ? 'TURBOSUCO DERROTADO · SIGA À DIREITA' : !this.requiresCampaignPassage()
            ? 'PASSAGEM LIBERADA · SIGA À DIREITA' : 'APRESENTE-SE NO SALÃO PARA SEGUIR');
        document.title = 'Super Feka Gaps World';
        (window as unknown as { worldGame: WorldGame }).worldGame = this;
        this.campaignCanvas.focus({ preventScroll: true });
    }
    override update(dt: number): void {
        if (this.isDisposed) return;
        if (this.entry?.active) {
            if (this.isDisposed || (!this.salon && (this.stage.id !== FACTORY_SALON.stage || this.state !== 'playing'))) {
                this.cancelEntry();
            } else {
                this.input.reset(); this.salon?.input.reset();
                this.stepEntry(this.entry.advance(dt, document.hidden || (!!this.salon && this.salon.state !== 'playing')));
                return;
            }
        }
        if (this.salon) {
            this.salon.update(dt);
            this.recordSalonProgress();
            if (this.salon.readyToReturn) { this.leaveSalon(); return; }
            this.reflect?.(); return;
        }
        super.update(dt);
        // Keep the 112px annex below the HUD on this landing. Preserve upward
        // tracking for the secret route; ordinary tracking resumes off the support.
        const p = this.player.data.position, support = FACTORY_SALON.support;
        if (this.stage.id === FACTORY_SALON.stage && p.x >= support.x && p.x < support.x + support.width)
            this.camera.y = Math.min(this.camera.y, FACTORY_SALON.arrivalCameraMaxY);
        this.enterButton.hidden = !this.canEnter;
        this.enterButton.textContent = this.store.save.seen.includes(FACTORY_SALON.victory)
            ? 'E · Turbosuco derrotado · Revisitar salão' : this.requiresCampaignPassage()
                ? 'E · Apresentar-se para seguir' : 'E · Revisitar salão';
    }
    protected override renderPlayer(view: CameraData): void {
        if (this.entry?.frame.phase !== 'outgoing') { super.renderPlayer(view); return; }
        const frame = this.entry.frame, c = this.renderer.getContext();
        c.save(); c.globalAlpha *= frame.playerAlpha;
        this.renderer.drawPlayer(salonEntryPlayer(this.player.data, frame), view);
        c.restore();
    }
    override render(): void {
        if (this.isDisposed) return;
        if (this.salon) {
            this.salon.render();
            if (this.entry?.active) { drawSalonEntryShade(this.salon.renderer.getContext(), this.entry.frame); this.salon.renderer.present(); }
            this.reflect?.(); return;
        }
        super.render();
        if (this.entry?.active) { drawSalonEntryShade(this.renderer.getContext(), this.entry.frame); this.renderer.present(); }
        if (!this.enterButton.hidden) {
            const p = salonEntryButtonPosition(this.campaignCanvas.getBoundingClientRect(), this.camera);
            Object.assign(this.enterButton.style, { left: `${p.left}px`, top: `${p.top}px`, width: `${p.width}px`, height: `${p.height}px` });
            this.enterButton.setAttribute('aria-label', `Entrar no salão. ${this.enterButton.textContent ?? ''}`);
        }
    }
}
