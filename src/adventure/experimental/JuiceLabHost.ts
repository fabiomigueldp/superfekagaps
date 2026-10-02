import { JuiceMinibossLab } from './JuiceMinibossLab';
import { JuiceEpilogue } from './JuiceEpilogue';
import { drawJuiceEpilogue } from './JuiceEpilogueArt';
import { panel, pixelText } from '../../graphics/BitmapFont';

/** Page presentation layered over the unchanged native lab simulation and loop. */
export class JuiceLabHost extends JuiceMinibossLab {
    readonly epilogue = new JuiceEpilogue(this);

    constructor(canvas: HTMLCanvasElement, private readonly hostStatus: HTMLElement) {
        super(canvas, hostStatus);
        this.addCleanup(() => this.epilogue.dispose());
    }

    override update(dt: number): void {
        if (this.isDisposed) return;
        super.update(dt);
        this.epilogue.update(dt);
    }

    override render(): void {
        if (this.isDisposed) return;
        const frame = this.epilogue.frame;
        if (!frame) { super.render(); return; }
        this.renderer.startScene(1);
        const c = this.renderer.getContext();
        drawJuiceEpilogue(c, frame, this.reducedMotion);
        if (this.state === 'paused') {
            c.fillStyle = '#171324bb'; c.fillRect(0, 0, 320, 180);
            panel(c, 62, 70, 196, 43, '#292033', '#bfce64');
            pixelText(c, 'PAUSADO', 160, 79, '#edf292', 2, 'center');
            pixelText(c, 'ESC OU CONTINUAR', 160, 100, '#fff0cc', 1, 'center');
        }
        this.renderer.present();
        const message = this.state === 'paused' ? 'Pausado — Esc ou Continuar para voltar'
            : frame.beat === 'complete' ? 'Turbosuco derrotado! Tentar novamente inicia uma nova luta; Rever volta à introdução.'
            : 'Turbosuco derrotado! Feka retorna ao palco. Pular epílogo avança para o quadro final.';
        if (this.hostStatus.textContent !== message) this.hostStatus.textContent = message;
    }
}
