import { WorldGame } from '../../../WorldGame';
import type { CameraData } from '../../../../types';
import { CompletedAvatarPresentation } from '../CompletedAvatarPresentation';
import { jetCycle } from '../../../WorldMachineState';
import type { AdventureStage } from '../../../types';
import { panel, pixelText } from '../../../../graphics/BitmapFont';
import { GUAIRA_RELIEF as G, guairaReliefStage, reliefOpen } from './GuairaReliefStage';
import { drawReliefBackground, drawReliefTerrain, drawReliefObjects } from './GuairaReliefArt';

export { GUAIRA_RELIEF, guairaReliefStage } from './GuairaReliefStage';

/** Isolated candidate. Native Player/Input/WorldLevel own every action and collision. */
export class GuairaRelief extends WorldGame {
    readonly reducedMotion: boolean;
    finished = false;
    private readonly completedAvatar = new CompletedAvatarPresentation();
    constructor(canvas: HTMLCanvasElement, private readonly status: HTMLElement) {
        super(canvas, true);
        try {
            this.addCleanup(() => { this.finished = false; this.store.save.checkpoint = null; this.input.reset(); });
            this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
            this.art.background = (c, _island, x, y) => drawReliefBackground(c, this.level, x, y);
            this.art.terrain = (c, level, _island, x, y) => drawReliefTerrain(c, level, x, y);
            this.art.objects = (c, objects, x, y) => drawReliefObjects(c, objects, x, y, this.reducedMotion);
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
        } catch (error) { this.dispose(); throw error; }
    }
    get reliefOpened() { return reliefOpen(this.level); }
    override load(_id: string, resume = false, _custom?: AdventureStage) {
        if (this.isDisposed) return;
        super.load(G.id, resume, guairaReliefStage());
        this.finished = false; this.time = 0; this.completedAvatar.reset();
        const p = this.player.data;
        p.isGrounded = true; p.facingRight = true; p.respawnRevealTimer = 0;
        if (!this.store.save.checkpoint) p.hasHelmet = true;
        this.frameRelief(true);
    }
    private frameRelief(snap = false, previousX = this.camera.x, previousY = this.camera.y) {
        const p = this.player.data, feet = p.position.y + p.height;
        const tx = Math.max(0, Math.min(G.width * 16 - 320, p.position.x - 64));
        this.camera.x = snap ? tx : previousX + (tx - previousX) * .12;
        this.camera.x = Math.max(0, Math.min(this.camera.x, p.position.x - 24));
        const ty = Math.max(0, Math.min(G.floor - 160, p.position.y - 32));
        const next = snap ? ty : previousY + Math.max(-8, Math.min(8, ty - previousY));
        this.camera.y = Math.max(0, feet - 168, Math.min(p.position.y - 28, next));
    }
    toggleReliefPause() {
        if (this.isDisposed) return;
        if (this.state === 'paused') this.resume(); else if (this.state === 'playing') this.pause();
    }
    override update(dt: number) {
        if (this.isDisposed || !Number.isFinite(dt) || dt <= 0) return;
        if (['map', 'title', 'intro'].includes(this.state)) { this.load(G.id); return; }
        if (this.finished) {
            this.input.setMenuMode(this.state !== 'playing'); this.input.update();
            if (this.input.consumeMute()) this.audio.toggle();
            this.audio.tick(dt);
            if (this.state === 'playing' && this.input.consumePause()) this.toggleReliefPause();
            if (this.state === 'playing') this.completedAvatar.advance(dt);
            return;
        }
        const objects = this.objects, previousX = this.camera.x, previousY = this.camera.y, before = objects.time;
        super.update(dt);
        if (this.objects !== objects || this.state !== 'playing' || this.player.data.isDead || objects.time <= before) return;
        const jet = objects.get(G.jetId)!;
        if (this.reliefOpened && !jet.active) {
            const height = jetCycle(jet, objects.time).height;
            jet.jetShutdown = height ? { at: objects.time, height } : undefined;
            jet.active = jet.observedActive = true;
            jet.changedAt = objects.time;
        }
        this.frameRelief(false, previousX, previousY);
        const p = this.player.data;
        if (p.isGrounded && p.position.x >= G.finishX && Math.abs(p.position.y + p.height - G.floor) < .01) {
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
        const presentation = this as unknown as { toastTimer: number }, toast = presentation.toastTimer;
        presentation.toastTimer = 0; if (paused) this.state = 'playing';
        try { super.render(); } finally { presentation.toastTimer = toast; if (paused) this.state = 'paused'; }
        const c = this.renderer.getContext();
        c.fillStyle = '#283d40'; c.fillRect(0, 0, 320, 23);
        pixelText(c, 'CAMARA DE ALIVIO', 8, 8, '#f3ddb1');
        pixelText(c, this.reliefOpened ? 'SEM PRESSAO' : 'DUAS ROTAS', 178, 8, '#b1e8db');
        pixelText(c, 'II', 305, 8, '#f3ddb1');
        if (paused) {
            c.fillStyle = '#211b2bbd'; c.fillRect(0, 23, 320, 157);
            panel(c, 62, 70, 196, 43, '#283d40', '#c2b78a');
            pixelText(c, 'PAUSADO', 160, 79, '#f3ddb1', 2, 'center');
        }
        this.renderer.present();
        const message = paused ? 'Pausado · Esc para continuar'
            : this.finished ? `PASSAGEM INSPECIONADA · ${this.reliefOpened ? 'alívio aberto, grelha sem pressão' : 'alívio intacto, grelha mantém o ciclo'} · sem progresso salvo`
            : this.player.data.isDead ? 'Retorno ao ponto seguro desta tentativa · tampa e jato serão reconstruídos'
            : this.reliefOpened ? 'Alívio aberto: a água volta pelo tubo lateral e a grelha ficou sem pressão · siga à direita'
            : 'Duas rotas: siga no intervalo seco da grelha ou suba e rompa a tampa de alívio · pule, depois baixo no ar · morrer ou Tentar restaura tampa e jato';
        if (this.status.textContent !== message) this.status.textContent = message;
    }
}
