import { guairaReturnHref } from './GuairaMapModel';
import { WorldGame } from '../../WorldGame';
import { STAGES } from '../../campaign';
import { TileType } from '../../../constants';
import type { AdventureStage } from '../../types';
import { panel, pixelText } from '../../../graphics/BitmapFont';
import { drawGuairaTraversalBackground, drawGuairaTraversalTerrain, drawGuairaTraversalObjects } from './GuairaTraversalArt';
import { drawGuairaCoinReadout } from './GuairaCoinReadout';
import { developGuairaCourse, GUAIRA_COURSES, restoreGuairaCoursePassages } from './GuairaCourseDesign';
import { installGuairaCourseArt, frameGuairaCourse, drawGuairaCourseHUD, guairaCourseStatus } from './GuairaCoursePresentation';

export const GUAIRA_TRAVERSAL = Object.freeze({
    id: 'guaira-travessia', width: GUAIRA_COURSES.travessia.end / 16, height: 18, floor: 224,
    pitStart: 416, pitEnd: 624, valveId: 'guaira-valve', bridgeId: 'guaira-bridge',
    checkpointX: 656, finishX: GUAIRA_COURSES.travessia.finish, finalValveId: 'guaira-rice-valve', finalBridgeId: 'guaira-rice-bridge', bossHref: './guaira-lab.html', mapHref: './guaira.html'
});

/** Local authored data only: never registered as a seventh campaign world. */
export function guairaTraversalStage(): AdventureStage {
    const stage = structuredClone(STAGES[0]);
    stage.id = GUAIRA_TRAVERSAL.id; stage.name = 'GUAÍRA · TRAVESSIA';
    stage.subtitle = 'Comporta, taipas e canal do arroz · localidade fictícia';
    delete stage.encounter;
    stage.level.id = 'experimental-guaira-travessia';
    stage.level.width = GUAIRA_TRAVERSAL.width; stage.level.height = GUAIRA_TRAVERSAL.height;
    stage.level.originX = 0; stage.level.originY = 0;
    stage.level.tiles = Array.from({ length: 18 }, (_, y) => Array.from({ length: GUAIRA_TRAVERSAL.width }, (_, x) => {
        // Dry street, sluice lesson, rice-bank variations, then a combined crossing.
        // Optional workshop steps teach two jump heights over the safe street.
        if (y === 11 && x >= 9 && x < 12 || y === 9 && x >= 14 && x < 17) return TileType.PLATFORM;
        if (x < 26 || (x >= 39 && x < 44) || (x >= 61 && x < 70)) return y >= 14 ? TileType.GROUND : TileType.EMPTY;
        if (x >= 44 && x < 61) {
            const bankTop = x < 48 ? 13 : x >= 50 && x < 53 ? 12 : x >= 55 && x < 58 ? 13 : 16;
            // The entry is an earth bank; the two inner spans are inspection
            // decks with a continuous, passable channel beneath them.
            if (y >= 16 || x < 48 && y >= bankTop || x >= 59 && y >= 15) return TileType.GROUND;
            if (y === bankTop) return TileType.PLATFORM;
            return TileType.EMPTY;
        }
        if (x >= 85) return y >= 12 ? TileType.GROUND : TileType.EMPTY;
        return TileType.EMPTY;
    }));
    stage.level.playerSpawn = { x: 3, y: 14 };
    stage.level.enemies = []; stage.level.collectibles = []; stage.level.triggers = [];
    stage.level.checkpoints = []; stage.level.goalPosition = { x: 93, y: 12 }; stage.level.isBossLevel = false;
    stage.mechanisms = [
        { id: GUAIRA_TRAVERSAL.valveId, kind: 'switch', x: 352, y: 216, width: 32, height: 8, link: GUAIRA_TRAVERSAL.bridgeId },
        { id: GUAIRA_TRAVERSAL.bridgeId, kind: 'lift', x: 416, y: 336, width: 208, height: 16, to: { x: 416, y: 224 }, gated: true },
        { id: GUAIRA_TRAVERSAL.finalValveId, kind: 'switch', x: 1072, y: 216, width: 32, height: 8, link: GUAIRA_TRAVERSAL.finalBridgeId },
        { id: GUAIRA_TRAVERSAL.finalBridgeId, kind: 'lift', x: 1120, y: 336, width: 240, height: 16, to: { x: 1120, y: 224 }, gated: true }
    ];
    stage.foes = []; stage.exits = []; stage.dialogues = []; stage.landmarks = [];
    stage.checkpoints = [{ x: 41, y: 14 }, { x: 64, y: 14 }, { x: 88, y: 12 }];
    const coins = [[112,202], [224,202], [360,164], [456,202], [520,202], [584,202],
        [728,186], [824,170], [904,186], [780,238], [860,238], [948,218],
        [1088,164], [1184,202], [1280,202], [1400,170], [1456,170]];
    stage.pickups = coins.map(([x, y], i) => ({ id: `guaira-travessia:coin:${i}`, kind: 'coin', x, y }));
    stage.pickups.push(...[[152,154],[176,154],[232,122],[256,122]].map(([x,y],i) =>
        ({ id: `guaira-travessia:workshop:${i}`, kind: 'coin' as const, x, y })));
    stage.route = [{ x: 48, y: 224 }, { x: 368, y: 224, switch: GUAIRA_TRAVERSAL.valveId },
        { x: 656, y: 224 }, { x: 736, y: 208 }, { x: 824, y: 192 }, { x: 904, y: 208 },
        { x: 1024, y: 224 }, { x: 1088, y: 224, switch: GUAIRA_TRAVERSAL.finalValveId },
        { x: 1312, y: 224 }, { x: 1408, y: 192 }, { x: 1472, y: 192 }];
    return developGuairaCourse(stage, 'travessia');
}

/** Real movement and checkpoint/death pipeline, with ephemeral completion. */
export class GuairaTraversal extends WorldGame {
    readonly reducedMotion: boolean;
    finished = false;
    private completedArtTime = 0;
    /** Simulation time while playing; quiet water may continue after the result is settled. */
    private get hydraulicArtTime() { return this.objects.time + this.completedArtTime; }
    constructor(canvas: HTMLCanvasElement, private readonly status: HTMLElement,
        private readonly continuationHint = 'CURRAL: ENFRENTE OSSABRAVO') {
        super(canvas, true);
        try {
            this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
            this.art.background = (c, _island, cx, cy) => drawGuairaTraversalBackground(c, cx, cy, this.hydraulicArtTime, this.reducedMotion,
                !!this.objects.get(GUAIRA_TRAVERSAL.bridgeId)?.active, !!this.objects.get(GUAIRA_TRAVERSAL.finalBridgeId)?.active);
            this.art.terrain = (c, level, _island, cx, cy, time) => drawGuairaTraversalTerrain(c, level, cx, cy, time, this.reducedMotion);
            this.art.genericStructures = false;
            this.art.objects = (c, objects, cx, cy) => drawGuairaTraversalObjects(c, objects, cx, cy, this.hydraulicArtTime, this.reducedMotion);
            installGuairaCourseArt(this, 'travessia');
            this.store.save.preferences.shake = !this.reducedMotion;
            this.tutorial.observe = () => {};
            this.load(GUAIRA_TRAVERSAL.id);
            this.listen(window, 'keydown', e => {
                if (['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'a', 'd', 'm', 'M'].includes(e.key)) this.audio.unlock();
            });
            document.title = 'Super Feka Gaps · Guaíra · Travessia experimental';
        } catch (error) { this.dispose(); throw error; }
    }
    override load(_id: string, resume = false, _custom?: AdventureStage) {
        if (this.isDisposed) return;
        super.load(GUAIRA_TRAVERSAL.id, resume, guairaTraversalStage());
        if (resume && this.store.save.checkpoint) restoreGuairaCoursePassages(this.objects, this.player.data.position.x);
        this.finished = false; this.time = 0; this.completedArtTime = 0;
        this.player.data.isGrounded = true; this.player.data.facingRight = true;
        if (!resume || !this.store.save.checkpoint) this.player.data.hasHelmet = true;
        // The checkpoint is beyond the sluice; restore its solved approach too.
        if (resume && this.store.save.checkpoint?.stage === GUAIRA_TRAVERSAL.id) {
            const valve = this.objects.get(GUAIRA_TRAVERSAL.valveId)!;
            const bridge = this.objects.get(GUAIRA_TRAVERSAL.bridgeId)!;
            valve.active = valve.observedActive = true;
            bridge.active = bridge.observedActive = true; bridge.y = bridge.py = 224;
            if (this.store.save.checkpoint.index >= 2) {
                const finalValve = this.objects.get(GUAIRA_TRAVERSAL.finalValveId)!;
                const finalBridge = this.objects.get(GUAIRA_TRAVERSAL.finalBridgeId)!;
                finalValve.active = finalValve.observedActive = true;
                finalBridge.active = finalBridge.observedActive = true; finalBridge.y = finalBridge.py = 224;
            }
        }
        this.player.data.respawnRevealTimer = 0;
        this.frameRoute(true);
    }
    private frameRoute(snap = false, previousX = this.camera.x, previousY = this.camera.y) {
        if (frameGuairaCourse(this, 'travessia', snap, previousX, previousY)) return;
        const p = this.player.data, x = p.position.x, feet = p.position.y + p.height;
        // Preview the receiving bank from each pressure plate. In the rice
        // section both the stepping route and the channel floor fit at rest.
        const blend = (from: number, to: number, start: number, end: number) =>
            from + (to - from) * Math.max(0, Math.min(1, (x - start) / (end - start)));
        const lead = x < 576 ? blend(125,36,208,336) : x < 960 ? blend(36,80,576,672) : blend(80,24,960,1072);
        const targetX = Math.max(0, Math.min(GUAIRA_TRAVERSAL.width * 16 - 320, x - lead + p.velocity.x * 4));
        this.camera.x = Math.max(0, Math.min(x - 24, snap ? targetX : previousX + (targetX - previousX) * .12));
        const receiving = x >= 672 && x < 976 ? 256 : x >= 1360 ? 192 : 224;
        const targetY = Math.min(receiving - 164, p.position.y - 36);
        const next = snap ? targetY : previousY + Math.max(-6, Math.min(6, (targetY - previousY) * .18));
        this.camera.y = Math.max(feet - 172, Math.min(p.position.y - 36, next));
    }
    get bridgeReady() {
        const bridge = this.objects.get(GUAIRA_TRAVERSAL.bridgeId)!;
        return bridge.active && bridge.y === GUAIRA_TRAVERSAL.floor;
    }
    get finalBridgeReady() {
        const bridge = this.objects.get(GUAIRA_TRAVERSAL.finalBridgeId)!;
        return bridge.active && bridge.y === GUAIRA_TRAVERSAL.floor;
    }
    get mapReturnHref() {
        return guairaReturnHref(this.finished || this.store.save.checkpoint ? 'rice' : 'town', this.finished ? 'traversal-clear' : null);
    }
    get canAdvanceToBoss() {
        return !this.isDisposed && this.state === 'playing' && !this.player.data.isDead && this.finished;
    }
    toggleTraversalPause() {
        if (this.isDisposed) return;
        if (this.state === 'paused') this.resume();
        else if (this.state === 'playing') this.pause();
    }
    override update(dt: number) {
        if (this.isDisposed) return;
        if (!Number.isFinite(dt) || dt <= 0) return;
        if (this.state === 'map' || this.state === 'title' || this.state === 'intro') { this.load(GUAIRA_TRAVERSAL.id); return; }
        if (this.finished) {
            if (this.updateController()) return;
            this.input.setMenuMode(this.state !== 'playing'); this.input.update();
            if (this.input.consumeMute()) this.audio.toggle();
            this.audio.tick(dt);
            if (this.state !== 'playing') return;
            if (this.input.consumePause()) { this.toggleTraversalPause(); return; }
            // Keep the water and the native idle animation alive; the result and
            // elapsed run time stay fixed while horizontal friction settles Feka.
            this.time += dt; this.renderer.advanceClock(dt);
            this.completedArtTime += dt;
            this.player.update(dt, { ...this.input.getState(), left: false, right: false, run: false,
                jump: false, jumpPressed: false, jumpReleased: false, down: false, downPressed: false }, this.level);
            return;
        }
        const previousX = this.camera.x, previousY = this.camera.y, objects = this.objects, before = objects.time;
        super.update(dt);
        if (this.state === 'playing' && !this.player.data.isDead && this.objects === objects && objects.time > before)
            this.frameRoute(false, previousX, previousY);
        // There are no campaign exits or boss here: finishStage is unreachable.
        if (this.state === 'playing' && !this.player.data.isDead && this.player.data.isGrounded &&
            this.player.data.position.x >= GUAIRA_TRAVERSAL.finishX && this.bridgeReady && this.finalBridgeReady) {
            this.finished = true; this.player.data.velocity.x = 0; this.player.data.isRunning = false;
            this.input.reset(); this.audio.sfx('victory');
            // The completion card replaces the last checkpoint notice. The
            // completed update path no longer advances that notice's timer.
            this.showCampaignNotice('', 0);
        }
    }
    override render() {
        if (this.isDisposed) return;
        const paused = this.state === 'paused';
        // Render the real world without creating campaign pause-menu callbacks.
        const presentation = this as unknown as { toastTimer: number };
        const toastTimer = presentation.toastTimer; presentation.toastTimer = 0;
        if (paused) this.state = 'playing';
        try { super.render(); } finally { presentation.toastTimer = toastTimer; if (paused) this.state = 'paused'; }
        const c = this.renderer.getContext();
        c.fillStyle = '#382b35'; c.fillRect(0, 0, 320, 23);
        c.fillStyle = '#d8ac7a'; c.fillRect(0, 22, 320, 1);
        pixelText(c, 'GUAIRA', 8, 8, '#f0ddae');
        drawGuairaCoinReadout(c, this.renderer, this.coins);
        if (this.player.data.hasHelmet) this.renderer.drawHelmet(279, 4, c);
        pixelText(c, 'II', 305, 8, '#f0ddae');
        const finalSection = this.player.data.position.x >= 1024;
        const valve = this.objects.get(finalSection ? GUAIRA_TRAVERSAL.finalValveId : GUAIRA_TRAVERSAL.valveId)!;
        const ready = finalSection ? this.finalBridgeReady : this.bridgeReady;
        const nearValve = (this.player.data.position.x > 275 && this.player.data.position.x < 416) || (this.player.data.position.x > 1024 && this.player.data.position.x < 1120);
        const lowerRoute = this.player.data.position.x >= 768 && this.player.data.position.x < 976 && this.player.data.position.y + this.player.data.height > 224;
        const guidance = this.finished ? 'TRAVESSIA FEITA' : nearValve ? !valve.active ? 'PULE + BAIXO NA PLACA' : ready ? 'PASSAGEM ABERTA' : 'PONTE SUBINDO'
            : lowerRoute ? 'CANAL DE INSPECAO' : this.player.data.position.x < 624 ? 'RUA DA VALA SECA' : this.player.data.position.x < 1024 ? 'TAIPAS DO ARROZ' : 'CANAL DO CURRAL';
        pixelText(c, guidance, 57, 8, '#f0ddae');
        if (paused && !this.externalPauseMenu) {
            c.fillStyle = '#211b2bbd'; c.fillRect(0, 23, 320, 157);
            panel(c, 62, 70, 196, 43, '#382b35', '#d8ac7a');
            pixelText(c, 'PAUSADO', 160, 79, '#f0ddae', 2, 'center');
            pixelText(c, 'ESC OU CONTINUAR', 160, 100, '#edcaf5', 1, 'center');
        } else if (this.finished) {
            panel(c, 27, 40, 266, 43, '#382b35', '#d8ac7a');
            pixelText(c, 'A AGUA CHEGOU AO ARROZAL!', 160, 50, '#f0ddae', 1, 'center');
            pixelText(c, this.continuationHint, 160, 65, '#edcaf5', 1, 'center');
        }
        drawGuairaCourseHUD(this, 'travessia');
        this.renderer.present();
        const message = paused ? 'Pausado · Esc ou Continuar para voltar'
            : this.finished ? 'Travessia concluída · a água chegou ao arrozal · Curral abre a arena de Ossabravo · Mapa volta ao arrozal na maquete'
            : this.player.data.isDead ? 'Feka caiu · retorno automático ao ponto seguro desta tentativa · Recomeçar reinicia a travessia'
            : nearValve ? (!valve.active ? 'Pule primeiro. No ar, aperte baixo sobre a placa; espere a ponte subir' : ready ? 'Ponte pronta · atravesse até a bandeira do checkpoint' : 'Água liberada · a ponte está subindo')
            : this.player.data.position.x >= 1120 ? 'Atravesse e pule para a margem alta · bandeira depois do canal'
            : lowerRoute ? 'Canal de inspeção · siga por baixo das passarelas; o degrau à direita volta à margem e ao ponto seguro'
            : this.player.data.position.x >= 624 ? 'Dois percursos · pule pelas passarelas ou desça ao canal de inspeção; os dois chegam à próxima comporta'
            : 'Guaíra fictícia · setas/A D: mover · Espaço: pular · baixo no ar: sentada · Shift: correr · Esc: pausa · M: som';
        const courseStatus = guairaCourseStatus(this, 'travessia', message);
        if (this.status.textContent !== courseStatus) this.status.textContent = courseStatus;
    }
}
