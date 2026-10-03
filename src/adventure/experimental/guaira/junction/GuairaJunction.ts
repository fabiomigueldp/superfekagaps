import { WorldGame } from '../../../WorldGame';
import type { CameraData } from '../../../../types';
import { CompletedAvatarPresentation } from '../CompletedAvatarPresentation';
import type { AdventureStage } from '../../../types';
import { pixelText, panel } from '../../../../graphics/BitmapFont';
import { supportsStanding } from '../../../../world/tileRules';
import { guairaReturnHref } from '../GuairaMapModel';
import { GUAIRA_JUNCTION as G, JunctionRouting, guairaJunctionStage } from './GuairaJunctionModel';
import { drawJunctionBackground, drawJunctionTerrain, drawJunctionObjects } from './GuairaJunctionArt';

export { GUAIRA_JUNCTION, guairaJunctionStage } from './GuairaJunctionModel';

/** Native WorldGame/Player/Input slice. Routing only sets native gated-lift targets. */
export class GuairaJunction extends WorldGame {
    readonly reducedMotion: boolean;
    routing = new JunctionRouting();
    finished = false;
    private readonly completedAvatar = new CompletedAvatarPresentation();
    constructor(canvas: HTMLCanvasElement, private readonly status: HTMLElement) {
        super(canvas, true);
        try {
            this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
            this.art.background = (c, _island, cx, cy, time) => drawJunctionBackground(c, cx, cy, time, this.reducedMotion, this.routing);
            this.art.terrain = (c, level, _island, cx, cy) => drawJunctionTerrain(c, level, cx, cy);
            this.art.objects = (c, objects, cx, cy, time) => drawJunctionObjects(c, objects, cx, cy, time, this.reducedMotion, this.routing);
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
            document.title = 'Super Feka Gaps · Pátio das Comportas · protótipo';
        } catch (error) { this.dispose(); throw error; }
    }
    override load(_id: string, resume = false, _custom?: AdventureStage) {
        if (this.isDisposed) return;
        super.load(G.id, resume, guairaJunctionStage());
        const checkpoint = !!this.store.save.checkpoint;
        this.routing = new JunctionRouting(checkpoint ? 'a' : 'b');
        this.finished = false; this.time = 0; this.completedAvatar.reset();
        for (const id of [G.entryPlateId, G.middlePlateId]) {
            const plate = this.objects.get(id)!;
            plate.active = plate.observedActive = checkpoint;
        }
        this.applySupply();
        // A checkpoint rebuild is an authored safe configuration, not a new
        // midway motion: A supports the checkpoint approach; B waits at its dock.
        for (const id of [G.liftAId, G.liftBId]) {
            const deck = this.objects.get(id)!;
            if (deck.active) deck.y = deck.py = deck.to!.y;
            deck.observedActive = deck.active;
        }
        const p = this.player.data;
        p.isGrounded = true; p.facingRight = true; p.respawnRevealTimer = 0;
        if (!checkpoint) p.hasHelmet = true;
    }
    private applySupply() {
        this.objects.get(G.liftAId)!.active = this.routing.supplied === 'a';
        this.objects.get(G.liftBId)!.active = this.routing.supplied === 'b';
    }
    get moving() {
        return [G.liftAId, G.liftBId].some(id => {
            const deck = this.objects.get(id)!;
            return Math.abs(deck.y - (deck.active ? deck.to!.y : G.dockY)) > .01;
        });
    }
    get mapReturnHref() { return guairaReturnHref(this.finished ? 'rice' : 'town', this.finished ? 'junction-clear' : null); }
    toggleJunctionPause() {
        if (this.isDisposed) return;
        if (this.state === 'paused') this.resume();
        else if (this.state === 'playing') this.pause();
    }
    /** Safe recovery keeps this run's native coin ledger, like native death recovery. */
    returnToSafePoint() {
        if (this.isDisposed) return;
        const run = this as unknown as { collected: Set<string> };
        const coins = this.coins, elapsed = this.elapsed;
        const collectedCoins = new Set(this.stage.pickups.filter(item => item.kind === 'coin' && run.collected.has(item.id)).map(item => item.id));
        this.load(G.id, true);
        this.coins = coins; this.elapsed = elapsed; run.collected = collectedCoins;
    }
    override update(dt: number) {
        if (this.isDisposed) return;
        if (!Number.isFinite(dt) || dt <= 0) return;
        if (['map', 'title', 'intro'].includes(this.state)) { this.load(G.id); return; }
        if (this.finished) {
            this.input.setMenuMode(this.state !== 'playing'); this.input.update();
            if (this.input.consumeMute()) this.audio.toggle();
            this.audio.tick(dt);
            if (this.state !== 'playing') return;
            if (this.input.consumePause()) this.toggleJunctionPause();
            if (this.state === 'playing') this.completedAvatar.advance(dt);
            return;
        }
        const objects = this.objects, before = objects.time;
        super.update(dt);
        if (this.state !== 'playing' || this.player.data.isDead || this.objects !== objects) return;
        const simulated = objects.time - before;
        if (simulated > 0) {
            this.routing.step(objects.get(G.entryPlateId)!.active ? 'a' : 'b', simulated);
            this.applySupply();
        }
        const p = this.player.data;
        // The optional perch permits an immediate second jump before the native
        // camera lerp has settled. Keep Feka's helmet below the fixed HUD even
        // then; this only bounds the presentation, never the jump or its timing.
        this.camera.y = Math.max(0, Math.min(this.camera.y, p.position.y - 48));
        if (p.isGrounded && p.position.x >= G.finishX && Math.abs(p.position.y + p.height - G.terraceY) < .01 &&
            this.store.save.checkpoint?.stage === G.id && this.routing.supplied === 'b' && !this.routing.warning) {
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
        // This slice supplies its own status/banner below. The generic checkpoint
        // toast sits across the jump apex, so suppress its presentation only.
        const presentation = this as unknown as { toastTimer: number };
        const toastTimer = presentation.toastTimer; presentation.toastTimer = 0;
        if (paused) this.state = 'playing';
        try { super.render(); } finally { presentation.toastTimer = toastTimer; if (paused) this.state = 'paused'; }
        const c = this.renderer.getContext();
        c.fillStyle = '#382f36'; c.fillRect(0, 0, 320, 23);
        c.fillStyle = '#d8b485'; c.fillRect(0, 22, 320, 1);
        pixelText(c, 'PATIO DAS COMPORTAS', 8, 8, '#f3ddb1');
        pixelText(c, `AGUA ${this.routing.supplied.toUpperCase()}`, 224, 8, '#aad9d2');
        pixelText(c, 'II', 305, 8, '#f3ddb1');
        const p = this.player.data, feet = p.position.y + p.height;
        // Observe native support, including a partial overlap at a deck edge.
        // Height alone confuses the low part of a successful ride with a fall.
        const deck = p.isGrounded ? [G.liftAId, G.liftBId].map(id => this.objects.get(id)!).find(b =>
            Math.abs(feet - b.y) < .01 && p.position.x + p.width > b.x && p.position.x < b.x + b.width) : undefined;
        const supportRow = this.level.worldToRow(feet + .01);
        let onRecovery = false;
        if (p.isGrounded && !deck && feet > 336 && Math.abs(feet - this.level.rowToWorldY(supportRow)) < .01)
            for (let col = this.level.worldToCol(p.position.x); col <= this.level.worldToCol(p.position.x + p.width - .1); col++)
                if (supportsStanding(this.level.getTile(col, supportRow))) onRecovery = true;
        const nextOutlet = this.routing.selected === 'a' ? 'B' : 'A';
        const onMaintenance = p.isGrounded && Math.abs(feet - G.maintenanceY) < .01 && p.position.x + p.width > 176 && p.position.x < 224;
        const nearPlate = p.position.x < 216 && feet <= 320 || p.position.x >= 410 && p.position.x < 565 && feet <= 272;
        const playerTop = p.position.y - Math.round(this.camera.y) - 4;
        const bannerWouldCoverPlayer = playerTop < 47 && feet - Math.round(this.camera.y) > 28;
        if (paused) {
            c.fillStyle = '#211b2bbd'; c.fillRect(0, 23, 320, 157);
            panel(c, 62, 70, 196, 43, '#382f36', '#d8b485');
            pixelText(c, 'PAUSADO', 160, 79, '#f3ddb1', 2, 'center');
            pixelText(c, 'ESC OU CONTINUAR', 160, 100, '#aad9d2', 1, 'center');
        } else if (!bannerWouldCoverPlayer && (this.finished || this.routing.warning || this.moving || nearPlate || onMaintenance)) {
            panel(c, 19, 28, 282, 19, '#382f36', '#d8b485');
            const text = this.finished ? 'DO BAIRRO AO ARROZAL!' : onMaintenance ? `${this.coins}/3 MOEDAS. VOLTE PELA DIREITA` : this.routing.warning ? `DESVIO PARA ${this.routing.selected.toUpperCase()}...` :
                this.moving ? `${this.routing.supplied.toUpperCase()} SOBE / ${this.routing.supplied === 'a' ? 'B' : 'A'} DESCE` : `PULE. NO AR, BAIXO: AGUA PARA ${nextOutlet}`;
            pixelText(c, text, 160, 34, '#f3ddb1', 1, 'center');
        }
        this.renderer.present();
        const message = paused ? 'Pausado · Esc ou Continuar para voltar'
            : this.finished ? 'Pátio concluído · água limpa no ramal B · Mapa volta ao arrozal · protótipo sem progresso salvo'
            : p.isDead ? 'Retorno automático ao ponto seguro · Recomeçar limpa esta tentativa'
            : this.routing.warning ? `Desvio pedido para ${this.routing.selected.toUpperCase()} · os dois tabuleiros vão se mover · sem prazo para atravessar`
            : onMaintenance ? `Desvio de A · ${this.coins}/3 moedas · volte à direita pelo tabuleiro A até a placa do ponto seguro`
            : deck ? `No tabuleiro ${deck.id === G.liftAId ? 'A' : 'B'} · ${Math.abs(deck.y - (deck.active ? deck.to!.y : G.dockY)) > .01 ? deck.active ? 'subindo' : 'descendo' : deck.active ? 'no alto' : 'na doca'} · água no ramal ${this.routing.supplied.toUpperCase()} · pode esperar apoiado`
            : onRecovery ? 'Piso seco de recuperação · volte à esquerda e pule pelo degrau até a entrada'
            : this.moving ? `Água no ramal ${this.routing.supplied.toUpperCase()} · ${this.routing.supplied.toUpperCase()} sobe, ${this.routing.supplied === 'a' ? 'B' : 'A'} desce · espere ou embarque`
            : p.position.x < 384 ? `Pule primeiro. No ar, aperte baixo na placa: água para ${nextOutlet}; a outra plataforma desce`
            : p.position.x < 736 ? `Ponto seguro · A dá acesso às moedas no alto à esquerda; B leva ao arrozal · sentada troca A/B, sem prazo`
            : p.position.x < G.exitGapEndX ? 'Margem firme · observe o vão curto e pule até o arrozal · pode esperar antes do salto'
            : 'Siga à direita até o arrozal · sair e reentrar reinicia o protótipo';
        if (this.status.textContent !== message) this.status.textContent = message;
    }
}
