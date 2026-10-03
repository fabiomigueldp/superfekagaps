import { WorldGame } from '../WorldGame';
import { FactorySalonSession } from './FactorySalonSession';
import { atFactorySalon, FACTORY_SALON, recordSalonVictory } from './FactorySalon';
import { drawFactorySalon } from './FactorySalonArt';
import './factory-salon.css';

/** Suspends the live campaign instead of copying or reloading its run/save. */
export class FactoryCampaign extends WorldGame {
    private salon?: FactorySalonSession;
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
        this.addCleanup(() => { this.salon?.dispose(); this.shell?.remove(); this.enterButton.remove(); });
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
        const nav = document.createElement('nav'); nav.setAttribute('aria-label', 'Controles do salão');
        const status = document.createElement('p'); status.setAttribute('aria-live', 'polite');
        const canvas = document.createElement('canvas'); canvas.width = 320; canvas.height = 180;
        canvas.id = 'game-canvas'; this.campaignCanvas.id = 'factory-campaign-canvas';
        canvas.tabIndex = 0; canvas.setAttribute('aria-label', 'Competição e combate contra Turbosuco');
        canvas.contentEditable = 'true'; canvas.spellcheck = false; canvas.setAttribute('inputmode', 'none');
        shell.append(nav, canvas, status); document.body.append(shell); shell.showModal();
        this.shell = shell;
        // Keep native lab presentation separate from the campaign's live region.
        const nativeStatus = document.createElement('span');
        const lab = new FactorySalonSession(canvas, nativeStatus); this.salon = lab;
        lab.inheritCampaignAudio(this.audio);
        document.title = 'Super Feka Gaps · Salão da Fábrica';
        const button = (label: string, run: () => void) => {
            const b = document.createElement('button'); b.textContent = label;
            b.addEventListener('click', () => { run(); if (this.salon) canvas.focus(); }); nav.append(b); return b;
        };
        const pose = button('Apresentar pose', () => lab.presentIntro());
        const skip = button('Pular cena', () => { if (lab.labMode === 'intro') lab.skipIntro(); else lab.epilogue.skip(); });
        const retry = button('Tentar novamente', () => lab.load('juice-lab'));
        const pause = button('Pausar', () => lab.toggleLabPause());
        button('Voltar à fase', () => this.leaveSalon());
        shell.addEventListener('keydown', e => {
            // Input captures keys first. Keep the two WorldGame menu listeners from
            // handling one Escape twice or resuming the suspended campaign.
            e.stopPropagation();
            if (e.key === 'Escape') {
                e.preventDefault(); lab.input.consumePause();
                if (!e.repeat) lab.toggleLabPause();
            }
        });
        shell.addEventListener('cancel', e => { e.preventDefault(); lab.toggleLabPause(); });
        canvas.addEventListener('pointerdown', () => canvas.focus({ preventScroll: true }));
        this.reflect = () => {
            pose.hidden = lab.intro?.beat !== 'prepare';
            skip.hidden = lab.labMode !== 'intro' && (!lab.epilogue.frame || lab.victorious);
            retry.hidden = lab.labMode === 'intro' || !!lab.epilogue.frame;
            pause.textContent = lab.state === 'paused' ? 'Continuar' : 'Pausar';
            lab.reflectCampaignStatus(status, nativeStatus.textContent ?? '');
        };
        this.reflect(); canvas.focus();
    }
    leaveSalon(): void {
        if (!this.salon) return;
        if (this.salon.victorious && recordSalonVictory(this.store.save)) this.store.persist();
        this.salon.dispose(); this.salon = undefined; this.reflect = undefined;
        this.shell?.close(); this.shell?.remove(); this.shell = undefined;
        this.campaignCanvas.id = 'game-canvas';
        this.input.reset(); this.resume();
        document.title = 'Super Feka Gaps World';
        (window as unknown as { worldGame: WorldGame }).worldGame = this;
        this.campaignCanvas.focus({ preventScroll: true });
    }
    override update(dt: number): void {
        if (this.salon) {
            this.salon.update(dt);
            if (this.salon.victorious && recordSalonVictory(this.store.save)) this.store.persist();
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
            ? 'E · Turbosuco derrotado · Revisitar salão' : 'E · Entrar no salão';
    }
    override render(): void {
        if (this.salon) { this.salon.render(); this.reflect?.(); return; }
        super.render();

    }
}
