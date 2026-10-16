import { WorldGame } from '../../../WorldGame';
import type { CameraData } from '../../../../types';
import { CompletedAvatarPresentation } from '../CompletedAvatarPresentation';
import type { AdventureStage } from '../../../types';
import { panel, pixelText } from '../../../../graphics/BitmapFont';
import { GUAIRA_RESPIROS as G, guairaRespirosStage } from './GuairaRespirosStage';
import { drawRespirosBackground, drawRespirosTerrain, drawRespirosObjects } from './GuairaRespirosArt';
import { drawGuairaCoinReadout } from '../GuairaCoinReadout';
import { jetCycle } from '../../../WorldMachineState';

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
    private frameGallery(snap = false, previousX = this.camera.x, previousY = this.camera.y) {
        const p = this.player.data, x = p.position.x, feet = p.position.y + p.height;
        const target = Math.max(0, Math.min(G.width * 16 - 320, x - 48));
        this.camera.x = snap ? target : previousX + (target - previousX) * .12;
        // Keep a reversing runner visible while the look-ahead eases back.
        this.camera.x = Math.max(0, Math.min(this.camera.x, x - 24));
        // Preview the overhead deck while climbing, then its dry receiving
        // platform. The floor route keeps the full jet and pressure gauge in
        // view. Blend between elevations; always reserve the complete helmet.
        const receiving = x >= 608 && x < G.inspectionEnd && feet < 260 ? 240 : G.floor;
        const targetY = Math.min(receiving - 160, p.position.y - 36);
        const next = snap ? targetY : previousY + Math.max(-6, Math.min(6, (targetY - previousY) * .18));
        this.camera.y = Math.max(feet - 172, Math.min(p.position.y - 36, next));
    }
    get mapReturnHref() { return this.finished ? `${G.mapHref}&visit=respiros-clear` : G.mapHref; }
    get canAdvanceToBoss() { return !this.isDisposed && this.state === 'playing' && !this.player.data.isDead && this.finished; }
    /** Describe the actual next outlet, including when retracing the route.
     * A dry reading is an observation, never a promise of time to cross. */
    get pressureReading() {
        const p = this.player.data;
        const outlets = [G.firstJetId, G.secondJetId, G.thirdJetId, G.fourthJetId]
            .map((id, i) => ({ body: this.objects.get(id)!, letter: 'ABCD'[i] }));
        const outlet = outlets.find(({ body: b }) => p.position.x < b.x + b.width && p.position.x + p.width > b.x)
            ?? (p.facingRight ? outlets.find(({ body: b }) => b.x >= p.position.x + p.width)
                : outlets.reverse().find(({ body: b }) => b.x + b.width <= p.position.x));
        if (!outlet) return null;
        const { body, letter } = outlet, cycle = jetCycle(body, this.objects.time);
        const [label, detail] = body.active ? ['ISOLADO', 'Registro fechado; este respiro está sem pressão.']
            : cycle.phase === 'charging' ? ['PRESSAO SUBINDO', 'A pressão está subindo; aguarde na margem seca.']
            : cycle.phase === 'falling' ? ['AGUA RECOLHENDO', 'A água ainda alcança a grelha; espere recolher completamente.']
            : cycle.phase === 'rising' || cycle.phase === 'flowing' ? ['AGUA NA GRELHA', 'Há água na grelha; aguarde na margem seca.']
            : cycle.phase === 'venting' ? ['PRESSAO ALIVIANDO', 'A água recolheu; a pressão está baixando.']
            : ['PISO SECO', 'Sem água na grelha; acompanhe o manômetro antes de entrar.'];
        return { id: body.id, letter, phase: cycle.phase, isolated: body.active, label: `${letter}: ${label}`, detail: `Respiro ${letter} · ${detail}` };
    }
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
        const previousX = this.camera.x, previousY = this.camera.y, objects = this.objects, before = objects.time;
        super.update(dt);
        if (this.state === 'playing' && !this.player.data.isDead && this.objects === objects && objects.time > before)
            this.frameGallery(false, previousX, previousY);
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
        const feet = p.position.y + p.height, x = p.position.x;
        const elevated = x >= 608 && x < G.fourthStart && feet < 260;
        const isolated = !!this.objects.get(G.serviceValveId)?.active, pressure = this.pressureReading;
        pixelText(c, this.finished ? 'PASSAGEM FEITA' : elevated
            ? x >= G.inspectionEnd ? pressure?.label ?? 'OBSERVE O RESPIRO D' : x >= G.inspectionStart ? 'MIRANTE A DIREITA' : isolated ? 'C FECHADO: VIA ALTA' : 'REGISTRO C: OPCIONAL'
            : pressure?.label ?? (x >= G.fourthEnd ? 'SIGA ATE O CURRAL' : 'GRELHAS A DIREITA'), 69, 8, '#b1e8db');
        drawGuairaCoinReadout(c, this.renderer, this.coins);
        if (p.hasHelmet) this.renderer.drawHelmet(279, 4, c);
        pixelText(c, 'II', 305, 8, '#f3ddb1');
        if (paused && !this.externalPauseMenu) {
            c.fillStyle = '#211b2bbd'; c.fillRect(0, 23, 320, 157);
            panel(c, 62, 70, 196, 43, '#283d40', '#c2b78a');
            pixelText(c, 'PAUSADO', 160, 79, '#f3ddb1', 2, 'center');
            pixelText(c, 'ESC OU CONTINUAR', 160, 100, '#b1e8db', 1, 'center');
        }
        this.renderer.present();
        const message = paused ? 'Pausado · Esc ou Continuar para voltar'
            : this.finished ? 'Passagem do arrozal inspecionada · Curral abre a arena de Ossabravo · Mapa volta ao arrozal · sem progresso salvo'
            : p.isDead ? 'Retorno automático ao ponto seguro desta tentativa · Tentar reinicia a passagem'
            : elevated && x >= G.inspectionEnd
                ? 'Mirante seco · observe o respiro D; desça na ilha antes da grelha e acompanhe o manômetro'
            : elevated && x >= G.inspectionStart
                ? 'Passarela de inspeção · salte à direita para o mirante seco; o respiro D continua funcionando'
            : elevated
                ? isolated
                    ? 'Respiro C isolado · siga pela passarela alta até o mirante ou desça ao piso; D mantém seu ritmo'
                    : 'Registro C · pule e aperte baixo sobre a placa para isolar só o próximo respiro'
            : p.position.x >= G.thirdEnd && p.position.x + p.width <= G.fourthStart
                ? 'Ilha seca · os dois respiros têm ritmos próprios · observe o próximo manômetro'
            : p.position.x >= G.secondEnd && p.position.x + p.width <= G.thirdStart
                ? 'Ponto seguro · siga pelo piso observando os jatos, ou suba à placa para isolar o respiro C'
            : p.position.x >= G.firstEnd && p.position.x + p.width <= G.secondStart
                ? 'Ponto seguro nesta tentativa · observe a próxima grelha · pode esperar aqui quanto precisar'
                : 'Grelhas do arrozal · setas/A D: mover · Espaço: pular · Shift: correr · Esc: pausa · M: som';
        const guidance = !paused && !this.finished && !p.isDead && pressure ? `${pressure.detail} · ${message}` : message;
        if (this.status.textContent !== guidance) this.status.textContent = guidance;
    }
}
