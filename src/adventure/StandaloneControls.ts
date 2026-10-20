import type { WorldGame } from './WorldGame';
import { WorldControlsHelp } from './WorldControlsHelp';
import { DomGamepadMenu } from '../engine/DomGamepadMenu';

/** Legacy standalone routes keep their existing toolbar and native pause action. */
export function installStandaloneControls(game: WorldGame, canvas: HTMLCanvasElement, complete: () => boolean): () => void {
    const menu = new DomGamepadMenu();
    const pause = () => document.getElementById('lab-pause')?.click();
    const help = new WorldControlsHelp(canvas, {
        canOpen: () => !game.isDisposed && (game.state === 'paused' || complete()),
        resetInput: () => game.input.reset(), suspendTouch: () => game.input.suspendCanvasTouchControls(),
    }, { id: 'standalone-controls', closeLabel: 'VOLTAR', navigation: [
        'A confirma; B volta; Menu pausa. View abre os controles.',
        'Na conclusão, escolha a próxima etapa nos botões existentes.',
    ] });
    game.enableGamepadControls({
        owner: () => {
            if (game.isDisposed || document.hidden) return null;
            if (help.isOpen) return help.canControl() ? 'help' : null;
            return game.state === 'playing' && !complete() ? 'playing' : `standalone:${game.state}:${complete()}`;
        },
        control: command => {
            if (help.isOpen) { help.control(command); return; }
            if (command === 'guide') {
                if (game.state === 'playing' && !complete()) pause();
                help.open(); return;
            }
            if (command === 'pause' || command === 'back') {
                if (!complete()) pause();
                else document.getElementById('lab-exit')?.focus();
                return;
            }
            const root = document.getElementById('lab-pause')?.closest('nav') ?? document.querySelector('nav');
            if (root) menu.control(root, command, pause);
        },
    });
    return () => { help.dispose(); menu.dispose(); };
}
