import { DisposalScope } from '../../engine/DisposalScope';
import { LabToolbarAction } from '../experimental/JuiceLabToolbar';
import { WorldControlsHelp } from '../WorldControlsHelp';
import type { FactorySalonSession } from './FactorySalonSession';
import { pixelText, textWidth } from '../../graphics/BitmapFont';

/** One visit's native controls. Nothing reserves space above the live canvas. */
export class FactorySalonPresentation {
    private readonly menu = document.createElement('nav');
    private readonly pause: HTMLButtonElement;
    private readonly resume: HTMLButtonElement;
    private readonly pose: HTMLButtonElement;
    private readonly skip: HTMLButtonElement;
    private readonly retry: HTMLButtonElement;
    private readonly finish: HTMLButtonElement;
    private readonly help: WorldControlsHelp;
    private readonly controls: HTMLButtonElement[] = [];
    private readonly objective = document.createElement('p');
    private readonly objectiveArt = document.createElement('canvas');
    private readonly objectiveText = document.createElement('span');
    private objectiveLabel = '';
    private wasPaused = false;

    constructor(shell: HTMLDialogElement, private readonly canvas: HTMLCanvasElement,
        private readonly lab: FactorySalonSession, private readonly events: DisposalScope, leave: () => void,
        private readonly onAction: () => void = () => {}) {
        this.menu.className = 'factory-salon-menu';
        this.menu.setAttribute('aria-label', 'Pausa do salão');
        this.menu.hidden = true;
        this.objective.className = 'factory-salon-objective';
        this.objectiveArt.className = 'lab-action-art'; this.objectiveArt.setAttribute('aria-hidden', 'true');
        this.objectiveText.className = 'lab-sr';
        this.objective.append(this.objectiveArt, this.objectiveText); this.menu.append(this.objective);
        const button = (label: string, name: string, run: () => void, parent: HTMLElement = this.menu) => {
            const control = document.createElement('button'); control.type = 'button';
            new LabToolbarAction(control).setLabel(label, name);
            events.listen(control, 'click', () => {
                if (control.hidden || parent === this.menu && (this.menu.hidden || lab.state !== 'paused')) return;
                run();
                if (events.isDisposed) return;
                this.onAction();
                this.sync();
                if (lab.state === 'playing') canvas.focus({ preventScroll: true });
            });
            parent.append(control); if (parent === this.menu) this.controls.push(control);
            return control;
        };
        // Escape and the canvas's existing top-touch zone are the ordinary pause
        // entry. A focus-only native control keeps it reachable by Tab/assistive UI.
        this.pause = button('PAUSA', 'Pausar', () => lab.toggleLabPause(), shell);
        this.pause.className = 'factory-salon-pause';
        this.resume = button('CONTINUAR', 'Continuar', () => lab.toggleLabPause());
        this.pose = button('POSE', 'Apresentar pose', () => { lab.toggleLabPause(); lab.presentIntro(); });
        this.skip = button('PULAR CENA', 'Pular cena', () => {
            // The epilogue accepts only active-play skips. Resume first, as
            // the native pause-menu action otherwise silently does nothing.
            lab.toggleLabPause();
            if (lab.labMode === 'intro') lab.skipIntro(); else lab.epilogue.skip();
        });
        this.retry = button('REINICIAR', 'Reiniciar tentativa', () => lab.load('juice-lab'));
        button('CONTROLES', 'Controles', () => this.help.open());
        button('VOLTAR', 'Voltar à fase', leave);
        this.finish = button('SEGUIR VIAGEM', 'Seguir viagem e voltar à fase', leave, shell);
        this.finish.className = 'factory-salon-result';
        this.finish.hidden = true;
        shell.append(this.menu);
        this.help = new WorldControlsHelp(canvas, {
            canOpen: () => !events.isDisposed && lab.state === 'paused',
            resetInput: () => lab.input.reset(),
            suspendTouch: () => lab.input.suspendCanvasTouchControls(),
        }, {
            id: 'factory-salon-controls', regionLabel: 'Controles do salão da fábrica', closeLabel: 'VOLTAR À PAUSA',
            navigation: [
                'Apresentação: ande até a marca e aperte pular para posar.',
                'Pausa: Tab ou ↑/↓ escolhe; Enter ou Espaço confirma; Esc continua.',
                'O salão usa teclado ou toque. Voltar à fase mantém seu progresso na fábrica.',
            ],
        });
        events.add(() => this.help.dispose());
        events.listen(shell, 'keydown', e => {
            // Input captures first. Never let either WorldGame menu consume the
            // same Escape or act on the suspended campaign underneath this visit.
            e.stopPropagation();
            if (e.ctrlKey || e.metaKey || e.altKey) return;
            if (lab.state === 'playing' && lab.victorious && e.key === 'Enter' && e.target === canvas) {
                e.preventDefault(); if (!e.repeat) leave(); return;
            }
            if (e.key === 'Escape') {
                e.preventDefault(); lab.input.consumePause();
                if (!e.repeat) { lab.toggleLabPause(); this.sync(); }
                return;
            }
            if (lab.state !== 'paused') return;
            if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
                e.preventDefault(); if (e.repeat) return;
                const visible = this.controls.filter(control => !control.hidden);
                const index = visible.indexOf(document.activeElement as HTMLButtonElement);
                const step = e.key === 'ArrowUp' || e.key === 'ArrowLeft' ? -1 : 1;
                visible[(Math.max(0, index) + step + visible.length) % visible.length]?.focus({ preventScroll: true });
            } else if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
        });
        events.listen(shell, 'cancel', e => { e.preventDefault(); lab.toggleLabPause(); this.sync(); });
        events.listen(canvas, 'pointerdown', event => {
            // WorldGame's earlier handler pauses on a top-zone press. Cancel
            // the browser's later canvas focus so it cannot undo menu focus.
            if (lab.state === 'paused') event.preventDefault();
            this.sync(); if (lab.state === 'playing') canvas.focus({ preventScroll: true });
        });
    }

    sync(): void {
        if (this.events.isDisposed) return;
        const paused = this.lab.state === 'paused';
        this.menu.hidden = !paused;
        this.pause.hidden = paused;
        this.finish.hidden = paused || !this.lab.epilogue.frame;
        this.pose.hidden = this.lab.intro?.beat !== 'prepare';
        this.skip.hidden = this.lab.labMode !== 'intro' && (!this.lab.epilogue.frame || this.lab.victorious);
        this.retry.hidden = this.lab.labMode === 'intro' || !!this.lab.epilogue.frame;
        const label = this.lab.needsCampaignPresentation ? 'FAÇA SUA APRESENTAÇÃO' : 'PASSAGEM LIBERADA';
        if (this.objectiveLabel !== label) {
            this.objectiveLabel = label;
            this.objectiveText.textContent = this.lab.needsCampaignPresentation
                ? 'Apresente-se para liberar a passagem.' : 'Passagem liberada. Volte à fase para seguir viagem.';
            this.objectiveArt.width = textWidth(label) * 2; this.objectiveArt.height = 14;
            const context = this.objectiveArt.getContext('2d');
            if (context) { context.setTransform(2, 0, 0, 2, 0, 0); pixelText(context, label, 0, 0, '#ffe29a'); }
            else { this.objectiveArt.hidden = true; this.objectiveText.className = ''; }
        }
        if (paused !== this.wasPaused) {
            this.wasPaused = paused;
            this.lab.input.reset();
            if (!document.hidden && !this.help.isOpen)
                (paused ? this.resume : this.canvas).focus({ preventScroll: true });
        }
    }
}
