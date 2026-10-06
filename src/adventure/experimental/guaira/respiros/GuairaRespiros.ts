import { WorldGame } from '../../../WorldGame';
import type { CameraData } from '../../../../types';
import { CompletedAvatarPresentation } from '../CompletedAvatarPresentation';
import type { AdventureStage } from '../../../types';
import { panel, pixelText } from '../../../../graphics/BitmapFont';
import { GUAIRA_RESPIROS as G, guairaRespirosStage } from './GuairaRespirosStage';
import { drawRespirosBackground, drawRespirosTerrain, drawRespirosObjects } from './GuairaRespirosArt';
import { drawGuairaCoinReadout } from '../GuairaCoinReadout';

export { GUAIRA_RESPIROS, guairaRespirosStage } from './GuairaRespirosStage';

/** Native movement, jets, damage and checkpoint pipeline; completion is attempt-only. */
export class GuairaRespiros extends WorldGame {
    readonly reducedMotion: boolean;
    finished = false;
    private readonly completedAvatar = new CompletedAvatarPresentation();
    constructor(canvas: HTMLCanvasElement, private readonly status: HTMLElement) {
        super(canvas, true);
        try {
            this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
            // WorldGame's presentation clock can advance during hit stop/reveal. All
            // irrigation artwork follows the native hazard clock instead.
            this.art.background = (c, _island, cx, cy) => drawRespirosBackground(c, cx, cy, this.objects.time, this.reducedMotion);
            this.art.terrain = (c, level, _island, cx, cy) => drawRespirosTerrain(c, level, cx, cy);
            this.art.genericStructures = false;
            this.art.objects = (c, objects, cx, cy) => drawRespirosObjects(c, objects, cx, cy, objects.time, this.reducedMotion);
            this.store.save.preferences.shake = !this.reducedMotion;
            if (this.reducedMotion) {
                (this as unknown as { particle: (...args: unknown[]) => void }).particle = () => {};
                this.renderer.addImpact = () => {};
            }
            this.tutorial.observe = () => {};
            this.load(G.id);
            this.listen(window, 'keydown', e => {
                if (['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'a', 'd', 's', 'm', 'M'].includes(e.key)) this.audio.unlock();
            });
            document.title = 'Super Feka Gaps · Passagem dos Respiros · protótipo';
        } catch (error) { this.dispose(); throw error; }
    }
    override load(_id: string, resume = false, _custom?: AdventureStage) {
        if (this.isDisposed) return;
        super.load(G.id, resume, guairaRespirosStage());
        this.finished = false; this.time = 0; this.completedAvatar.reset();
        const p = this.player.data;
        p.isGrounded = true; p.facingRight = true; p.respawnRevealTimer = 0;
        if (!this.store.save.checkpoint) p.hasHelmet = true;
        this.frameGallery(true);
    }
    private frameGallery(snap = false, previousX = this.camera.x) {
        const x = this.player.data.position.x;
        const target = Math.max(0, Math.min(G.width * 16 - 320, x - 48));
        this.camera.x = snap ? target : previousX + (target - previousX) * .12;
        // Keep a reversing runner visible while the look-ahead eases back.
        this.camera.x = Math.max(0, Math.min(this.camera.x, x - 24));
        // Fixed gallery framing shows the full 128px column and native jump
        // apex below the 23px HUD. The maintenance bay gains 12px of
        // headroom for its raised takeoff; the dry path stays visible at y172.
        // Retaining headroom during an airborne retreat avoids clipping the
        // helmet when crossing back out of the maintenance bay.
        this.camera.y = Math.min(x >= G.secondEnd ? 132 : 144, Math.floor(this.player.data.position.y) - 27);
    }
    get mapReturnHref() { return this.finished ? `${G.mapHref}&visit=respiros-clear` : G.mapHref; }
    get canAdvanceToBoss() { return !this.isDisposed && this.state === 'playing' && !this.player.data.isDead && this.finished; }
    toggleRespirosPause() {
        if (this.isDisposed) return;
        if (this.state === 'paused') this.resume();
        else if (this.state === 'playing') this.pause();
    }
    override update(dt: number) {
        if (this.isDisposed) return;
        if (!Number.isFinite(dt) || dt <= 0) return;
        if (['map', 'title', 'intro'].includes(this.state)) { this.load(G.id); return; }
        if (this.finished) {
            this.input.setMenuMode(this.state !== 'playing'); this.input.update();
            if (this.input.consumeMute()) this.audio.toggle();
            this.audio.tick(dt);
            if (this.state === 'playing' && this.input.consumePause()) this.toggleRespirosPause();
            if (this.state === 'playing') this.completedAvatar.advance(dt);
            return;
        }
        const previousX = this.camera.x, objects = this.objects, before = objects.time;
        super.update(dt);
        if (this.state === 'playing' && !this.player.data.isDead && this.objects === objects && objects.time > before)
            this.frameGallery(false, previousX);
        const p = this.player.data;
        // Arrival on the exit bank is enough. The island flag is recovery only,
        // never a hidden prerequisite, and passing above the bank cannot clear.
        if (this.state === 'playing' && !p.isDead && p.isGrounded && p.position.x >= G.finishX &&
            Math.abs(p.position.y + p.height - G.floor) < .01) {
            this.finished = true; p.velocity.x = 0; p.isRunning = false; this.input.reset(); this.audio.sfx('victory');
        }
    }
    protected override renderPlayer(view: CameraData) {
        if (this.finished) this.completedAvatar.draw(this.renderer, this.player.data, view);
        else super.renderPlayer(view);
    }
    override render() {
        if (this.isDisposed) return;
        const paused = this.state === 'paused';
        // The native checkpoint flag and external status carry recovery feedback;
        // the generic toast would cover the visible height of the next discharge.
        const presentation = this as unknown as { toastTimer: number };
        const toastTimer = presentation.toastTimer; presentation.toastTimer = 0;
        if (paused) this.state = 'playing';
        try { super.render(); } finally { presentation.toastTimer = toastTimer; if (paused) this.state = 'paused'; }
        const c = this.renderer.getContext(), p = this.player.data;
        c.fillStyle = '#283d40'; c.fillRect(0, 0, 320, 23);
        c.fillStyle = '#c2b78a'; c.fillRect(0, 22, 320, 1);
        pixelText(c, 'RESPIROS', 8, 8, '#f3ddb1');
        pixelText(c, this.finished ? 'PASSAGEM FEITA' : 'ESPERE A AGUA BAIXAR', 69, 8, '#b1e8db');
        drawGuairaCoinReadout(c, this.renderer, this.coins);
        if (p.hasHelmet) this.renderer.drawHelmet(279, 4, c);
        pixelText(c, 'II', 305, 8, '#f3ddb1');
        if (paused) {
            c.fillStyle = '#211b2bbd'; c.fillRect(0, 23, 320, 157);
            panel(c, 62, 70, 196, 43, '#283d40', '#c2b78a');
            pixelText(c, 'PAUSADO', 160, 79, '#f3ddb1', 2, 'center');
            pixelText(c, 'ESC OU CONTINUAR', 160, 100, '#b1e8db', 1, 'center');
        }
        this.renderer.present();
        const message = paused ? 'Pausado · Esc ou Continuar para voltar'
            : this.finished ? 'Passagem do arrozal inspecionada · Curral abre a arena de Ossabravo · Mapa volta ao arrozal · sem progresso salvo'
            : p.isDead ? 'Retorno automático ao ponto seguro desta tentativa · Tentar reinicia a passagem'
            : p.position.x >= G.thirdEnd && p.position.x + p.width <= G.fourthStart
                ? 'Ilha seca · os dois respiros têm ritmos próprios · espere o próximo baixar'
            : p.position.x >= G.secondEnd && p.position.x + p.width <= G.thirdStart
                ? 'Último ponto seguro · moedas opcionais na prateleira · observe cada respiro separadamente'
            : p.position.x >= G.firstEnd && p.position.x + p.width <= G.secondStart
                ? 'Ponto seguro nesta tentativa · observe a próxima grelha · pode esperar aqui quanto precisar'
                : 'Espere a água baixar · setas/A D: mover · Espaço: pular · Shift: correr · Esc: pausa · M: som';
        if (this.status.textContent !== message) this.status.textContent = message;
    }
}
