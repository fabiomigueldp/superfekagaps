import { WorldGame } from '../WorldGame';
import { DisposalScope } from '../../engine/DisposalScope';
import { FactorySalonSession } from './FactorySalonSession';
import { atFactorySalon, FACTORY_SALON, hasSalonPassage, recordSalonPassage, recordSalonVictory, requiresSalonPassage } from './FactorySalon';
import { drawFactorySalon } from './FactorySalonArt';
import { FactorySalonPresentation } from './FactorySalonPresentation';
import './factory-salon.css';

/** Suspends the live campaign instead of copying or reloading its run/save. */
export class FactoryCampaign extends WorldGame {
    private salon?: FactorySalonSession;
    private salonEvents?: DisposalScope;
    private shell?: HTMLDialogElement;
    private reflect?: () => void;
    private readonly enterButton: HTMLButtonElement;
    constructor(private readonly campaignCanvas: HTMLCanvasElement) {
        super(campaignCanvas);
        const objects = this.art.objects.bind(this.art);
        this.art.objects = (...args) => {
            if (this.stage.id === FACTORY_SALON.stage)
                drawFactorySalon(args[0], args[2], args[3], this.store.save.seen.includes(FACTORY_SALON.victory));
            objects(...args);
        };
        this.enterButton = document.createElement('button');
        this.enterButton.className = 'factory-salon-enter';
        this.enterButton.textContent = 'Entrar no salão';
        this.enterButton.hidden = true;
        document.body.append(this.enterButton);
        this.listen(this.enterButton, 'click', () => this.enterSalon());
        this.listen(campaignCanvas, 'keydown', e => {
            if (e.key.toLowerCase() === 'e' && !e.repeat) this.enterSalon();
        });
        this.addCleanup(() => { this.recordSalonProgress(); this.salonEvents?.dispose(); this.salon?.dispose(); this.shell?.remove(); this.enterButton.remove(); });
        // A paused campaign may still own a live salon. Only its ordinary canvas is reusable.
        if (new.target === FactoryCampaign) this.enableFrozenMenuPaint(() => !this.salon);
    }
    protected override requiresCampaignPassage(): boolean {
        return requiresSalonPassage(this.stage.id, this.store.save);
    }
    private recordSalonProgress(): void {
        if (!this.salon) return;
        const passage = this.salon.presentedAtChampionship && recordSalonPassage(this.store.save);
        const victory = this.salon.victorious && recordSalonVictory(this.store.save);
        if (passage || victory) this.store.persist();
    }
    private get canEnter() {
        return !this.salon && this.state === 'playing' && !this.player.data.isDead &&
            atFactorySalon(this.stage.id, this.player.getRect(), this.player.data.isGrounded);
    }
    enterSalon(): void {
        if (!this.canEnter) return;
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
        if (!this.salon) return;
        this.recordSalonProgress();
        this.salonEvents?.dispose(); this.salonEvents = undefined;
        this.salon.dispose(); this.salon = undefined; this.reflect = undefined;
        this.shell?.close(); this.shell?.remove(); this.shell = undefined;
        this.campaignCanvas.id = 'game-canvas';
        this.input.reset(); this.resume();
        this.showCampaignNotice(!this.requiresCampaignPassage()
            ? 'PASSAGEM LIBERADA · SIGA À DIREITA' : 'APRESENTE-SE NO SALÃO PARA SEGUIR');
        document.title = 'Super Feka Gaps World';
        (window as unknown as { worldGame: WorldGame }).worldGame = this;
        this.campaignCanvas.focus({ preventScroll: true });
    }
    override update(dt: number): void {
        if (this.salon) {
            this.salon.update(dt);
            this.recordSalonProgress();
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
    override render(): void {
        if (this.salon) { this.salon.render(); this.reflect?.(); return; }
        super.render();

    }
}
