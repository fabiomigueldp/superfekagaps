import { GameState } from '../constants';
import { Input } from '../engine/Input';
import { StandardGamepad } from '../engine/StandardGamepad';
import { DomGamepadMenu, menuId } from '../engine/DomGamepadMenu';
import { touchControlsEnabled } from '../engine/TouchMode';
import { WorldControlsHelp } from './WorldControlsHelp';
import { exitGame } from '../engine/ExitGame';
import './legacy-controls.css';

interface Host {
    state(): GameState;
    ready(): boolean;
    pause(): void;
}

/** Input adapter only: the edition keeps its original simulation, art and saves. */
export class LegacyControls {
    private readonly pad: StandardGamepad;
    private readonly navigation = new DomGamepadMenu();
    private readonly help: WorldControlsHelp;
    private readonly primary = document.createElement('button');
    private readonly guide = document.createElement('button');
    private readonly pause = document.createElement('button');
    private readonly exit = document.createElement('button');
    private readonly menu = document.createElement('nav');
    private owner = '';

    constructor(private readonly canvas: HTMLCanvasElement, private readonly input: Input,
        private readonly host: Host, private readonly remastered: boolean) {
        this.pad = new StandardGamepad(input);
        this.help = new WorldControlsHelp(canvas, {
            canOpen: () => host.state() !== GameState.PLAYING && host.state() !== GameState.EDITOR,
            resetInput: () => input.reset(), suspendTouch: () => input.suspendCanvasTouchControls(),
        }, { closeLabel: 'VOLTAR', regionLabel: 'Controles do jogo', navigation: [
            'A confirma; B volta; Menu pausa ou continua; View abre os controles.',
            'Direção e corrida continuam enquanto estiverem pressionadas.',
        ], touch: 'Use as setas para andar, pular e dar a sentada. Segure X para correr. Ⅱ pausa.' });
        this.primary.className = 'legacy-menu-action';
        this.guide.className = 'legacy-guide'; this.guide.textContent = '?';
        this.guide.title = 'Controles'; this.guide.setAttribute('aria-label', 'Controles');
        this.pause.className = 'legacy-touch-pause'; this.pause.textContent = 'Ⅱ';
        this.pause.setAttribute('aria-label', 'Pausar');
        this.exit.className = 'legacy-exit'; this.exit.textContent = 'SAIR';
        this.menu.className = 'legacy-menu'; this.menu.setAttribute('aria-label', 'Menu do jogo');
        document.body.append(this.menu);
        for (const button of [this.primary, this.guide, this.exit, this.pause]) {
            button.type = 'button'; button.hidden = true; this.menu.append(button);
        }
        this.primary.addEventListener('click', () => {
            if (!this.primary.hidden && host.ready()) input.queueCommand('start');
            canvas.focus({preventScroll:true});
        });
        this.guide.addEventListener('click', () => this.help.open());
        this.pause.addEventListener('click', () => { host.pause(); input.reset(); });
        this.exit.addEventListener('click', () => {
            input.reset(); void exitGame(remastered ? 'remastered' : 'classic');
        });
        window.addEventListener('keydown', event => {
            if (!host.ready() || this.help.isOpen || this.modal()) return;
            if (event.target !== canvas && !this.menu.contains(event.target as Node)) return;
            const command = ({ArrowUp:'up',ArrowDown:'down',ArrowLeft:'left',ArrowRight:'right'} as const)[event.key as 'ArrowUp'];
            if (command) { event.preventDefault(); this.navigation.control(this.menu, command, () => {}); }
        });
        window.addEventListener('resize', () => this.reflect());
    }

    private modal(): HTMLElement | undefined {
        return [...document.querySelectorAll<HTMLElement>('[role="dialog"][aria-modal="true"], dialog[open]')]
            .find(node => !node.closest('[hidden]') && node.getClientRects().length > 0);
    }

    /** Called before each simulation step. True suspends only the game's update. */
    update(): boolean {
        this.reflect();
        const modal = this.modal();
        const state = this.host.state(), owner = `${state}:${this.host.ready()}:${modal ? menuId(modal) : 'game'}`;
        if (owner !== this.owner) { this.owner = owner; this.input.reset(); }
        if (this.help.isOpen) {
            const command = this.pad.updateMenu(this.help.canControl() ? 'legacy:controls' : null);
            if (command) this.help.control(command);
            return true;
        }
        if (modal) {
            const command = this.pad.updateMenu(menuId(modal));
            if (command) this.navigation.control(modal, command, () =>
                modal.querySelector<HTMLButtonElement>('.scoreboard-close')?.click());
            return true;
        }
        if (state === GameState.PLAYING) {
            if (this.pad.update('playing')) { this.host.pause(); return true; }
        } else {
            const command = this.pad.updateMenu(`legacy:${owner}`);
            if ((command === 'back' || command === 'pause') && state === GameState.PAUSED) this.input.queueCommand('pause');
            else if (command === 'guide') this.input.queueCommand('guide');
            else if (command && this.host.ready()) this.navigation.control(this.menu, command, () => {});
        }
        this.input.setMenuMode(state !== GameState.PLAYING);
        this.input.update();
        if (this.input.consumeCommand('guide')) {
            if (state === GameState.PLAYING) this.host.pause();
            this.help.open();
            return true;
        }
        return false;
    }

    private reflect(): void {
        const state = this.host.state();
        const menu = [GameState.MENU, GameState.PAUSED, GameState.GAME_OVER, GameState.ENDING].includes(state);
        const blocked = this.help.isOpen || !!this.modal();
        this.guide.hidden = !menu || blocked;
        this.exit.hidden = state !== GameState.MENU || blocked;
        this.pause.hidden = state !== GameState.PLAYING || !touchControlsEnabled() || blocked;
        this.primary.hidden = !menu || !this.host.ready() || blocked;
        this.primary.setAttribute('aria-label', state === GameState.MENU ? 'Jogar'
            : state === GameState.PAUSED ? 'Continuar' : state === GameState.GAME_OVER ? 'Recomeçar' : 'Voltar');
        const rect = this.canvas.getBoundingClientRect();
        const y = state === GameState.MENU ? this.remastered ? 90 : 120
            : state === GameState.PAUSED ? this.remastered ? 95 : 103
            : state === GameState.GAME_OVER ? 138 : 169;
        Object.assign(this.primary.style, {
            left: `${rect.left + rect.width * .2}px`, top: `${rect.top + rect.height * (y - 10) / 180}px`,
            width: `${rect.width * .6}px`, height: `${Math.max(32, rect.height * 20 / 180)}px`,
        });
    }
}
