import { DisposalScope } from '../../../../engine/DisposalScope';
import { WorldControlsHelp } from '../../../WorldControlsHelp';
import type { WorldGame } from '../../../WorldGame';
import { LabToolbarAction } from '../../JuiceLabToolbar';

interface SceneControlsRuntime {
    readonly game: WorldGame;
    togglePause(): void;
}

/** Mount before the scene's Input. Reading help never consumes or restarts an attempt. */
export class GuairaChapterControlsHelp {
    private readonly lifetime = new DisposalScope();
    readonly button = document.createElement('button');
    private readonly help: WorldControlsHelp;
    private actionRevision = 0;
    private readonly interruptionListeners = new Set<() => void>();
    private readonly presses = new Map<HTMLElement, { pointer: number | null; key: number | null }>();

    constructor(canvas: HTMLCanvasElement, private readonly runtime: () => SceneControlsRuntime | null, optional: boolean) {
        this.button.id = 'chapter-controls'; this.button.type = 'button';
        this.button.setAttribute('aria-haspopup', 'dialog');
        this.button.setAttribute('aria-controls', 'chapter-controls-help');
        this.button.setAttribute('aria-expanded', 'false');
        new LabToolbarAction(this.button).setLabel('CONTROLES', 'Abrir controles e ajuda da tentativa');
        this.help = new WorldControlsHelp(canvas, {
            canOpen: () => this.available()?.game.state === 'paused',
            resetInput: () => this.runtime()?.game.input.reset(),
            suspendTouch: () => this.runtime()!.game.input.suspendCanvasTouchControls(),
            onOpenChange: open => {
                this.actionRevision++;
                for (const interrupt of this.interruptionListeners) interrupt();
                this.button.setAttribute('aria-expanded', String(open));
            },
        }, {
            id: 'chapter-controls-help', regionLabel: 'Controles e ajuda do capítulo de Guaíra',
            closeLabel: 'FECHAR AJUDA · MANTER PAUSA',
            navigation: [
                'A tentativa continua pausada ao fechar esta ajuda. Continuar ou Esc retoma do mesmo ponto.',
                'Tentar recomeça este trecho e perde os avanços desta tentativa. As conclusões anteriores do capítulo são mantidas.',
                optional ? 'Bairro volta ao mapa de Guaíra. Ao entrar novamente, o percurso opcional começa do início.'
                    : 'Mapa volta ao mapa de Guaíra. Ao entrar novamente, o trecho começa do início. Após concluir, Continuar segue a jornada pelo mapa.',
                'Nos botões: Tab ou Shift + Tab para escolher; Enter ou Espaço para ativar. Esc fecha esta ajuda sem retomar o jogo.',
            ],
            touch: '← / → para andar; Pular (↑) para pular; segure Correr (X) + direção para correr; Golpe (↓) no ar faz a sentada. Use Pausa no topo para parar e Continuar para retomar.',
        });
        this.lifetime.add(() => this.help.dispose());
        this.lifetime.listen(window, 'keydown', event => {
            const press = this.presses.get(event.target as HTMLElement);
            if (press && !event.repeat && ['Enter', ' ', 'Spacebar'].includes(event.key)) press.key = this.actionRevision;
        }, true);
        this.lifetime.listen(this.button, 'click', () => {
            if (this.help.isOpen) return;
            const runtime = this.available();
            if (!runtime) return;
            if (runtime.game.state === 'playing') runtime.togglePause();
            this.help.open();
        });
        this.sync();
    }

    /** Retire the host's own gesture metadata at the same modal boundary. */
    onInterrupt(listener: () => void): void {
        this.interruptionListeners.add(listener);
        this.lifetime.add(() => { this.interruptionListeners.delete(listener); });
    }

    /** A press begun behind help cannot activate the toolbar on dismissal. */
    guardAction(button: HTMLElement): (event: MouseEvent) => boolean {
        const press = { pointer: null as number | null, key: null as number | null };
        this.presses.set(button, press);
        this.lifetime.add(() => { this.presses.delete(button); });
        this.lifetime.listen(button, 'pointerdown', () => { press.pointer = this.actionRevision; });
        this.lifetime.listen(button, 'pointercancel', () => { press.pointer = -1; });
        return event => {
            const pressed = event.detail === 0 ? press.key : press.pointer;
            if (event.detail === 0) press.key = null; else press.pointer = null;
            const allowed = !this.lifetime.isDisposed && !this.help.isOpen
                && (pressed === null || pressed === this.actionRevision);
            if (!allowed) { event.preventDefault(); event.stopImmediatePropagation(); }
            return allowed;
        };
    }

    get isOpen() { return this.help.isOpen; }
    private available() {
        const runtime = this.lifetime.isDisposed || document.hidden ? null : this.runtime();
        return runtime && !runtime.game.isDisposed && ['playing', 'paused'].includes(runtime.game.state) ? runtime : null;
    }
    sync() { this.button.disabled = !this.available(); }
    dispose() { this.lifetime.dispose(); }
}
