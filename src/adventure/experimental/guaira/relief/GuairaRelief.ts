import { WorldGame } from '../../../WorldGame';
import type { CameraData } from '../../../../types';
import { CompletedAvatarPresentation } from '../CompletedAvatarPresentation';
import { jetCycle } from '../../../WorldMachineState';
import type { AdventureStage } from '../../../types';
import { panel, pixelText } from '../../../../graphics/BitmapFont';
import { drawGuairaCoinReadout } from '../GuairaCoinReadout';
import { GUAIRA_RELIEF as G, guairaReliefStage, reliefOpen } from './GuairaReliefStage';
import { drawReliefBackground, drawReliefTerrain, drawReliefObjects } from './GuairaReliefArt';
import { GuairaReliefChallenge, RELIEF_ROUTE_OBJECTIVES, reliefChallengeMessage,
    type GuairaReliefOptions, type GuairaReliefReplayKind, type GuairaReliefReplayAction,
    type GuairaReliefRouteAPI } from './GuairaReliefChallenge';

export { GUAIRA_RELIEF, guairaReliefStage } from './GuairaReliefStage';

/** Isolated candidate. Native Player/Input/WorldLevel own every action and collision. */
export class GuairaRelief extends WorldGame {
    readonly reducedMotion: boolean;
    finished = false;
    private readonly completedAvatar = new CompletedAvatarPresentation();
    private readonly challenge: GuairaReliefChallenge;
    readonly routes: GuairaReliefRouteAPI;
    private replayRevision = 0;
    private replayPending = false;
    private routeFocused = true;
    constructor(canvas: HTMLCanvasElement, private readonly status: HTMLElement, options: GuairaReliefOptions = {}) {
        super(canvas, true);
        try {
            this.challenge = new GuairaReliefChallenge(options.routeGoal ?? null);
            const game = this;
            this.routes = Object.freeze({ get revision() { return game.replayRevision; },
                get snapshot() { return game.challenge.snapshot(); },
                capture: (kind: GuairaReliefReplayKind) => game.captureReplay(kind) });
            this.listen(window, 'blur', () => { this.routeFocused = false; this.replayRevision++; });
            this.listen(window, 'focus', () => { this.routeFocused = true; this.replayRevision++; });
            this.listen(document, 'visibilitychange', () => { this.replayRevision++; });
            this.addCleanup(() => {
                this.replayRevision++; this.challenge.reset();
                this.finished = false; this.store.save.checkpoint = null; this.input.reset();
            });
            this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
            this.art.background = (c, _island, x, y) => drawReliefBackground(c, this.level, x, y, this.objects.time, this.reducedMotion);
            this.art.terrain = (c, level, _island, x, y, _time, reducedMotion) => drawReliefTerrain(c, level, x, y, reducedMotion);
            this.art.genericStructures = false;
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
        this.replayRevision++; this.replayPending = false;
        if (resume) this.challenge.reconstruct(); else this.challenge.reset();
        super.load(G.id, resume, guairaReliefStage());
        this.finished = false; this.time = 0; this.completedAvatar.reset();
        const p = this.player.data;
        p.isGrounded = true; p.facingRight = true; p.respawnRevealTimer = 0;
        if (!this.store.save.checkpoint) p.hasHelmet = true;
        this.frameRelief(true);
    }
    /** A host remounts only after consuming a captured action. The closure owns
     * this scene/revision, so an old click can never authorize a newer visit. */
    private captureReplay(kind: GuairaReliefReplayKind): GuairaReliefReplayAction | null {
        const ready = () => !this.isDisposed && !this.replayPending && this.routeFocused && !document.hidden
            && (kind === 'other-route' ? this.state === 'playing' && this.finished && !this.player.data.isDead
                : kind === 'retry' && (this.state === 'playing' || this.state === 'paused'));
        if (!ready()) return null;
        const revision = this.replayRevision;
        const goal = kind === 'retry' ? this.challenge.goal : this.reliefOpened ? 'keep-lid-and-helmet' : 'open-relief';
        const options = Object.freeze({ routeGoal: goal });
        return Object.freeze({ kind, options, objective: goal === null ? null : RELIEF_ROUTE_OBJECTIVES[goal],
            consume: () => {
                if (revision !== this.replayRevision || !ready()) return null;
                this.replayRevision++; this.replayPending = true;
                return options;
            } });
    }
    protected override pause() { this.replayRevision++; super.pause(); }
    protected override resume() { this.replayRevision++; super.resume(); }
    private observeRoute() {
        const p = this.player.data;
        this.challenge.observe({ alive: !p.isDead, hasHelmet: p.hasHelmet,
            reliefOpened: this.reliefOpened, finished: this.finished });
    }
    private frameRelief(snap = false, previousX = this.camera.x, previousY = this.camera.y) {
        const p = this.player.data, feet = p.position.y + p.height;
        const tx = Math.max(0, Math.min(G.width * 16 - 320, p.position.x - 64));
        this.camera.x = snap ? tx : previousX + (tx - previousX) * .12;
        this.camera.x = Math.max(0, Math.min(this.camera.x, p.position.x - 24));
        // Show the next support before asking for a jump. The lid and the floor
        // cannot both fit in this viewport: the open collector changes the
        // middle shelf's destination from the lid above to the safe floor below.
        let target = G.floor - 160;
        if (feet < 280 && p.position.x < G.gantryStart) {
            target = this.reliefOpened ? G.floor - 164 : feet <= 176 ? 60 : p.position.x < G.lidEnd ? 108 : G.floor - 164;
        } else if (feet < 312 && p.position.x < 192) target = 152;
        if (p.position.x >= G.gantryStart && p.position.x < G.landingStart && feet <= G.gantryY + 16)
            target = Math.max(G.landingY, G.floor - 128) - 152;
        if (p.position.x >= G.landingStart && p.position.x < G.returnStart && feet <= G.landingY + 24)
            target = G.returnY - 152;
        // The highest native jump needs three pixels above the stage origin;
        // the workshop wall continues there, so keep the entire helmet visible.
        const ty = Math.min(target, p.position.y - 36);
        const next = snap ? ty : previousY + Math.max(-6, Math.min(6, (ty - previousY) * .18));
        this.camera.y = Math.max(feet - 168, Math.min(p.position.y - 36, next));
    }
    private routeHint() {
        const p = this.player.data, feet = p.position.y + p.height;
        if (p.position.x >= G.returnStart && feet <= G.returnY + 8)
            return ['SAIDA A DIREITA', 'Patamar de saída: siga à direita para voltar ao piso da oficina.'] as const;
        if (p.position.x >= G.landingStart && feet <= G.landingY + 24)
            return ['DESCA A DIREITA', 'Sacada de inspeção: siga até o patamar abaixo à direita, depois desça ao piso de saída.'] as const;
        if (p.position.x >= G.gantryStart - 8 && feet <= G.gantryY + 8)
            return ['CORRA E SALTE', 'Passarela opcional: corra até a borda e mantenha o salto até a sacada do outro lado. Abrir o alívio antes torna a queda segura.'] as const;
        if (!this.reliefOpened && feet <= 176 && p.position.x < G.gantryStart)
            return ['PULE + BAIXO', 'Tampa de alívio: pule e use baixo no ar para retirar a pressão. A passarela à direita oferece um salto opcional.'] as const;
        if (!this.reliefOpened && feet <= 256 && p.position.x < G.lidEnd)
            return ['TAMPA ACIMA', 'A tampa está acima da plataforma de manutenção. Suba para aliviar a pressão ou volte ao piso e observe o intervalo seco.'] as const;
        return this.reliefOpened
            ? ['SEM PRESSAO', 'Alívio aberto: a água volta pelo tubo lateral. Desça ao piso seguro ou salte da oficina à passarela acima à direita.'] as const
            : ['PISO OU OFICINA', 'Atravesse no intervalo seco ou suba pela oficina para abrir o alívio. A manutenção também leva à passarela sobre a grelha.'] as const;
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
        const wasDead = this.player.data.isDead;
        super.update(dt);
        if (!wasDead && this.player.data.isDead) this.replayRevision++;
        // Observe before early returns: native hurt/death and checkpoint rebuild
        // must remain visible even when this frame cannot produce an arrival.
        this.observeRoute();
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
            this.replayRevision++; this.observeRoute();
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
        pixelText(c, this.finished ? 'INSPECIONADO' : this.routeHint()[0], 125, 8, '#b1e8db');
        drawGuairaCoinReadout(c, this.renderer, this.coins);
        if (this.player.data.hasHelmet) this.renderer.drawHelmet(279, 4, c);
        pixelText(c, 'II', 305, 8, '#f3ddb1');
        if (paused && !this.externalPauseMenu) {
            c.fillStyle = '#211b2bbd'; c.fillRect(0, 23, 320, 157);
            panel(c, 62, 70, 196, 43, '#283d40', '#c2b78a');
            pixelText(c, 'PAUSADO', 160, 79, '#f3ddb1', 2, 'center');
        }
        this.renderer.present();
        const message = paused ? 'Pausado · Esc para continuar'
            : this.finished ? `PASSAGEM INSPECIONADA · ${this.reliefOpened ? 'alívio aberto, grelha sem pressão' : 'alívio intacto, grelha mantém o ciclo'} · sem progresso salvo`
            : this.player.data.isDead ? 'Retorno ao ponto seguro desta tentativa · tampa e jato serão reconstruídos'
            : this.routeHint()[1];
        const optional = !paused && !this.player.data.isDead ? reliefChallengeMessage(this.routes.snapshot) : null;
        const text = optional ? `${message} · ${optional}` : message;
        if (this.status.textContent !== text) this.status.textContent = text;
    }
}
