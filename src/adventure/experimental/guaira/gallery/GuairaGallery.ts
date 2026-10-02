import { WorldGame } from '../../../WorldGame';
import type { AdventureStage } from '../../../types';
import { panel, pixelText } from '../../../../graphics/BitmapFont';
import { GUAIRA_GALLERY as G, guairaGalleryStage } from './GuairaGalleryStage';
import { galleryArrival, galleryOpenings, galleryReceivingY } from './GuairaGalleryModel';
import { drawGalleryBackground, drawGalleryTerrain, drawGalleryObjects } from './GuairaGalleryArt';

export { GUAIRA_GALLERY, guairaGalleryStage } from './GuairaGalleryStage';
export { galleryArrival, galleryOpenings, galleryReceivingY } from './GuairaGalleryModel';

/** Ephemeral adapter: native input, collisions, real breaks, recovery and checkpoint. */
export class GuairaGallery extends WorldGame {
    readonly reducedMotion: boolean;
    finished = false;
    constructor(canvas: HTMLCanvasElement, private readonly status: HTMLElement) {
        super(canvas, true);
        try {
            this.addCleanup(() => { this.finished = false; this.store.save.checkpoint = null; this.input.reset(); });
            this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
            this.art.background = (c, _island, cx, cy, time) => drawGalleryBackground(c, cx, cy, time, this.reducedMotion);
            this.art.terrain = (c, level, _island, cx, cy) => drawGalleryTerrain(c, level, cx, cy);
            this.art.objects = (c, objects, cx, cy, time) => drawGalleryObjects(c, objects, cx, cy, time, this.reducedMotion);
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
            document.title = 'Super Feka Gaps · Galeria dos Remendos · protótipo';
        } catch (error) { this.dispose(); throw error; }
    }
    override load(_id: string, resume = false, _custom?: AdventureStage) {
        if (this.isDisposed) return;
        const checkpoint = resume && this.store.save.checkpoint?.stage === G.id && this.store.save.checkpoint.index === 0;
        super.load(G.id, resume, guairaGalleryStage(checkpoint));
        this.finished = false; this.time = 0;
        const p = this.player.data;
        p.isGrounded = true; p.facingRight = true; p.respawnRevealTimer = 0;
        if (!checkpoint) p.hasHelmet = true;
        this.frameGallery(true);
    }
    private frameGallery(snap = false, previousX = this.camera.x, previousY = this.camera.y) {
        const p = this.player.data, feet = p.position.y + p.height;
        const target = Math.max(0, Math.min(G.width * 16 - 320, p.position.x - 72));
        this.camera.x = snap ? target : previousX + (target - previousX) * .12;
        this.camera.x = Math.max(0, Math.min(this.camera.x, p.position.x - 24));
        const receiving = galleryReceivingY(p.position.x, feet);
        // Anticipate the receiving floor continuously. Never bounce upward while
        // falling across a shaft boundary; limit ordinary reframing to8px/step.
        // Actor safety overrides smoothing during native jumps and fast falls.
        let targetY = Math.max(0, Math.min(G.height * 16 - 180, receiving - 160, p.position.y - 28));
        if (p.velocity.y > 0) targetY = Math.max(previousY, targetY);
        const nextY = snap ? targetY : previousY + Math.max(-8, Math.min(8, targetY - previousY));
        this.camera.y = Math.max(0, feet - 168, Math.min(p.position.y - 28, G.height * 16 - 180, nextY));
    }
    get mapReturnHref() { return G.mapHref; }
    get openings() { return galleryOpenings(this.level); }
    toggleGalleryPause() {
        if (this.isDisposed) return;
        if (this.state === 'paused') this.resume();
        else if (this.state === 'playing') this.pause();
    }
    override update(dt: number) {
        if (this.isDisposed || !Number.isFinite(dt) || dt <= 0) return;
        if (['map', 'title', 'intro'].includes(this.state)) { this.load(G.id); return; }
        if (this.finished) {
            this.input.setMenuMode(this.state !== 'playing'); this.input.update();
            if (this.input.consumeMute()) this.audio.toggle();
            this.audio.tick(dt);
            if (this.state === 'playing' && this.input.consumePause()) this.toggleGalleryPause();
            // Only the native sprite's idle presentation advances after arrival.
            if (this.state === 'playing') this.player.data.animationTimer += dt;
            return;
        }
        const previousX = this.camera.x, previousY = this.camera.y, objects = this.objects, before = objects.time;
        super.update(dt);
        if (this.state === 'playing' && !this.player.data.isDead && this.objects === objects && objects.time > before)
            this.frameGallery(false, previousX, previousY);
        if (this.state === 'playing' && galleryArrival(this.level, this.player.data)) {
            this.finished = true; this.player.data.velocity.x = 0; this.player.data.isRunning = false;
            this.input.reset(); this.audio.sfx('victory');
        }
    }
    override render() {
        if (this.isDisposed) return;
        const paused = this.state === 'paused';
        const presentation = this as unknown as { toastTimer: number };
        const toast = presentation.toastTimer; presentation.toastTimer = 0;
        if (paused) this.state = 'playing';
        try { super.render(); } finally { presentation.toastTimer = toast; if (paused) this.state = 'paused'; }
        const c = this.renderer.getContext();
        c.fillStyle = '#283d40'; c.fillRect(0, 0, 320, 23);
        c.fillStyle = '#c2b78a'; c.fillRect(0, 22, 320, 1);
        pixelText(c, 'GALERIA', 8, 8, '#f3ddb1');
        pixelText(c, this.finished ? 'ACESSO ABERTO' : 'PULE. NO AR, BAIXO', 69, 8, '#b1e8db');
        if (this.player.data.hasHelmet) this.renderer.drawHelmet(279, 4, c);
        pixelText(c, 'II', 305, 8, '#f3ddb1');
        if (paused) {
            c.fillStyle = '#211b2bbd'; c.fillRect(0, 23, 320, 157);
            panel(c, 62, 70, 196, 43, '#283d40', '#c2b78a');
            pixelText(c, 'PAUSADO', 160, 79, '#f3ddb1', 2, 'center');
            pixelText(c, 'ESC OU CONTINUAR', 160, 100, '#b1e8db', 1, 'center');
        }
        this.renderer.present();
        const message = paused ? 'Pausado · Esc ou Continuar para voltar'
            : this.finished ? 'ACESSO DE INSPEÇÃO ABERTO · Mapa volta à Estrada do Vento · sem progresso salvo'
            : this.player.data.isDead ? 'Retorno automático ao ponto seguro desta tentativa · Tentar fecha as duas tampas'
            : 'Abra as tampas rachadas e alcance o patamar de inspeção · PULE. NO AR, APERTE BAIXO · setas/A D: mover · Espaço: pular · Esc: pausa · M: som';
        if (this.status.textContent !== message) this.status.textContent = message;
    }
}
