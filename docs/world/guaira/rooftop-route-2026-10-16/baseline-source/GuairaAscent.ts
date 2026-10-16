import { guairaReturnHref } from './GuairaMapModel';
import { WorldGame } from '../../WorldGame';
import { STAGES } from '../../campaign';
import { TileType } from '../../../constants';
import type { AdventureStage } from '../../types';
import { panel, pixelText } from '../../../graphics/BitmapFont';
import { drawGuairaAscentBackground, drawGuairaAscentTerrain, drawGuairaAscentObjects } from './GuairaAscentArt';
import { drawGuairaCoinReadout } from './GuairaCoinReadout';

export const GUAIRA_ASCENT = Object.freeze({
    id: 'guaira-subida', width: 84, height: 25, floor: 304, recoveryFloor: 368,
    plankId: 'guaira-plank', liftId: 'guaira-service-lift', period: 10000,
    serviceId: 'guaira-inspection-carriage', checkpointX: 528, upperCheckpointX: 800,
    terraceY: 144, finishX: 1264, mapHref: './guaira.html'
});

/** Isolated data clone: no campaign registration, exits, combat or persistent unlock. */
export function guairaAscentStage(): AdventureStage {
    const stage = structuredClone(STAGES[0]);
    stage.id = GUAIRA_ASCENT.id; stage.name = 'GUAÍRA · SUBIDA DA VAZÃO';
    stage.subtitle = 'Do curral à Casa da Vazão · localidade fictícia';
    delete stage.encounter;
    stage.level.id = 'experimental-guaira-subida';
    stage.level.width = GUAIRA_ASCENT.width; stage.level.height = GUAIRA_ASCENT.height;
    stage.level.originX = 0; stage.level.originY = 0;
    stage.level.tiles = Array.from({ length: 25 }, (_, y) => Array.from({ length: GUAIRA_ASCENT.width }, (_, x) => {
        if ((x < 14 || x >= 31 && x < 41) && y >= 19 || (x >= 48 && x < 55 || x >= 68) && y >= 9) return TileType.GROUND;
        if (y === 23 && (x >= 14 && x < 31 || x >= 41 && x < 48) ||
            y === 21 && (x >= 15 && x < 18 || x >= 28 && x < 31 || x >= 41 && x < 44)) return TileType.PLATFORM;
        // The maintenance balcony offers an active way to meet the lift midway.
        // A separate high perch rewards a timed jump from the last carriage.
        // Its receiving balcony shares y96: a held jump can show both Feka
        // and the destination inside the native 320x180 view.
        if (y === 16 && x >= 37 && x < 41 || y === 6 && (x >= 60 && x < 63 || x >= 67 && x < 70)) return TileType.PLATFORM;
        // Both ends have an ordinary-jump exit: inspection is now a parallel
        // route with rewards, not a dead end that repeats the carriage wait.
        if (y === 15 && x >= 55 && x < 68 || y === 12 && (x >= 55 && x < 58 || x >= 65 && x < 68)) return TileType.PLATFORM;
        return TileType.EMPTY;
    }));
    stage.level.playerSpawn = { x: 3, y: 19 };
    stage.level.enemies = []; stage.level.collectibles = []; stage.level.triggers = [];
    stage.level.checkpoints = []; stage.level.goalPosition = { x: 79, y: 9 }; stage.level.isBossLevel = false;
    stage.mechanisms = [
        { id: GUAIRA_ASCENT.plankId, kind: 'platform', x: 240, y: 304, width: 80, height: 8, to: { x: 400, y: 304 }, period: GUAIRA_ASCENT.period },
        { id: GUAIRA_ASCENT.liftId, kind: 'lift', x: 672, y: 304, width: 80, height: 8, to: { x: 672, y: 144 }, period: GUAIRA_ASCENT.period },
        { id: GUAIRA_ASCENT.serviceId, kind: 'platform', x: 896, y: 144, width: 80, height: 8, to: { x: 992, y: 144 }, period: 8000 }
    ];
    stage.foes = []; stage.exits = []; stage.dialogues = []; stage.landmarks = [];
    stage.checkpoints = [{ x: 33, y: 19 }, { x: 50, y: 9 }];
    stage.pickups = [304, 352, 400].map((x, i) => ({ id: `guaira-subida:coin:${i}`, kind: 'coin', x, y: 346 }));
    stage.pickups.push(...[944, 992, 1040].map((x, i) => ({ id: `guaira-subida:inspection:${i}`, kind: 'coin' as const, x, y: 218 })));
    stage.pickups.push(...[[608,230],[640,230],[964,70],[984,70]].map(([x,y],i) =>
        ({ id: `guaira-subida:overlook:${i}`, kind: 'coin' as const, x, y })));
    stage.route = [{ x: 48, y: 304 }, { x: 528, y: 304 }, { x: 712, y: 144 }, { x: 800, y: 144 }, { x: 1024, y: 144 }, { x: 1264, y: 144 }];
    return stage;
}

/** Native Player, carry, checkpoint and death flow; only scene presentation is local. */
export class GuairaAscent extends WorldGame {
    readonly reducedMotion: boolean;
    finished = false;
    private renderingPaused = false;
    private completedArtTime = 0;
    private get hydraulicArtTime() { return this.objects.time + this.completedArtTime; }
    constructor(canvas: HTMLCanvasElement, private readonly status: HTMLElement) {
        super(canvas, true);
        try {
            this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
            this.art.background = (c, _island, cx, cy) => drawGuairaAscentBackground(c, cx, cy, this.hydraulicArtTime, this.reducedMotion);
            this.art.terrain = (c, level, _island, cx, cy, time) => drawGuairaAscentTerrain(c, level, cx, cy, time, this.reducedMotion);
            this.art.genericStructures = false;
            this.art.objects = (c, objects, cx, cy, time) => {
                const running = this.state === 'playing' && !this.renderingPaused && !this.finished &&
                    !this.player.data.isDead && !((this.player.data.respawnRevealTimer ?? 0) > 0);
                drawGuairaAscentObjects(c, objects, cx, cy, time, this.reducedMotion, running);
            };
            this.store.save.preferences.shake = !this.reducedMotion;
            if (this.reducedMotion) {
                // WorldGame currently has no particle preference. This instance-only
                // presentation adapter suppresses cosmetic dust; simulation is untouched.
                (this as unknown as { particle: (...args: unknown[]) => void }).particle = () => {};
                this.renderer.addImpact = () => {};
            }
            this.tutorial.observe = () => {};
            this.load(GUAIRA_ASCENT.id);
            this.listen(window, 'keydown', e => {
                if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd', 'm', 'M'].includes(e.key)) this.audio.unlock();
            });
            document.title = 'Super Feka Gaps · Guaíra · Subida da Vazão experimental';
        } catch (error) { this.dispose(); throw error; }
    }
    override load(_id: string, resume = false, _custom?: AdventureStage) {
        if (this.isDisposed) return;
        super.load(GUAIRA_ASCENT.id, resume, guairaAscentStage());
        this.finished = false; this.time = 0; this.completedArtTime = 0;
        this.player.data.isGrounded = true; this.player.data.facingRight = true;
        if (!resume || !this.store.save.checkpoint) this.player.data.hasHelmet = true;
        this.player.data.respawnRevealTimer = 0;
    }
    get mapReturnHref() {
        return guairaReturnHref(this.finished ? 'vazao' : 'corral', this.finished ? 'ascent-clear' : null);
    }
    toggleAscentPause() {
        if (this.isDisposed) return;
        if (this.state === 'paused') this.resume();
        else if (this.state === 'playing') this.pause();
    }
    override update(dt: number) {
        if (this.isDisposed) return;
        if (!Number.isFinite(dt) || dt <= 0) return;
        if (this.state === 'map' || this.state === 'title' || this.state === 'intro') { this.load(GUAIRA_ASCENT.id); return; }
        if (this.finished) {
            this.input.setMenuMode(this.state !== 'playing'); this.input.update();
            if (this.input.consumeMute()) this.audio.toggle();
            this.audio.tick(dt);
            if (this.state !== 'playing') return;
            if (this.input.consumePause()) { this.toggleAscentPause(); return; }
            this.time += dt; this.renderer.advanceClock(dt);
            this.completedArtTime += dt;
            this.player.update(dt, { ...this.input.getState(), left: false, right: false, run: false,
                jump: false, jumpPressed: false, jumpReleased: false, down: false, downPressed: false }, this.level);
            return;
        }
        const previousObjects = this.objects, previousTime = this.objects.time, previousY = this.camera.y;
        super.update(dt);
        const p = this.player.data;
        // This upper service route needs a little sky beyond the native world
        // clamp. Keep the helmet below the fixed HUD without changing physics.
        if (this.state === 'playing' && !p.isDead && this.objects === previousObjects &&
            this.objects.time > previousTime) {
            const feet = p.position.y + p.height;
            // Frame a receiving surface, not just the actor. Before the first
            // departure the dry inspection floor is already in the same view.
            let receiving = p.position.x < 496 ? 304 + 64 * Math.max(0, Math.min(1, (p.position.x - 112) / 80))
                : p.position.x < 656 ? feet <= 272 ? 272 : 368
                : p.position.x < 768 ? Math.max(240, feet + 24)
                : feet <= 160 ? 240 - 48 * Math.max(0, Math.min(1, (p.position.x - 824) / 64)) : 240;
            if (p.position.x >= 1088) receiving = 240;
            const targetY = Math.min(receiving - 168, p.position.y - 36);
            const nextY = previousY + Math.max(-6, Math.min(6, (targetY - previousY) * .18));
            this.camera.y = Math.max(feet - 168, Math.min(p.position.y - 36, nextY));
        }
        // Check the actual terrace, not just x: falling beneath the house cannot finish.
        if (this.state === 'playing' && !p.isDead && p.isGrounded &&
            p.position.x >= GUAIRA_ASCENT.finishX && Math.abs(p.position.y + p.height - GUAIRA_ASCENT.terraceY) < 1) {
            this.finished = true; p.velocity.x = 0; p.isRunning = false; this.input.reset(); this.audio.sfx('victory');
        }
    }
    override render() {
        if (this.isDisposed) return;
        const paused = this.state === 'paused';
        // The base renderer needs a playing scene behind our custom pause panel,
        // but mechanism indicators must still see the genuine paused state.
        this.renderingPaused = paused;
        // The live flag communicates arrival without covering the boarding
        // balcony, lift or receiving bank at the moment they need to be read.
        const presentation = this as unknown as { toastTimer: number };
        const toastTimer = presentation.toastTimer; presentation.toastTimer = 0;
        if (paused) this.state = 'playing';
        try { super.render(); } finally {
            presentation.toastTimer = toastTimer;
            this.renderingPaused = false;
            if (paused) this.state = 'paused';
        }
        const c = this.renderer.getContext(), x = this.player.data.position.x;
        c.fillStyle = '#382b35'; c.fillRect(0, 0, 320, 23);
        c.fillStyle = '#d8ac7a'; c.fillRect(0, 22, 320, 1);
        pixelText(c, 'GUAIRA', 8, this.finished ? 3 : 8, '#f0ddae');
        pixelText(c, this.finished ? 'CASA DA VAZAO' : x < 496 ? 'PRANCHA DE INSPECAO' : x < 768 ? 'SUBIDA DA VAZAO' : 'TRAVESSIA DE SERVICO', 57, this.finished ? 3 : 8, '#f0ddae');
        if (this.finished) pixelText(c, 'CONTINUAR PELO MAPA', 8, 13, '#edcaf5');
        drawGuairaCoinReadout(c, this.renderer, this.coins);
        if (this.player.data.hasHelmet) this.renderer.drawHelmet(279, 4, c);
        pixelText(c, 'II', 305, 8, '#f0ddae');
        if (paused && !this.externalPauseMenu) {
            c.fillStyle = '#211b2bbd'; c.fillRect(0, 23, 320, 157);
            panel(c, 62, 70, 196, 43, '#382b35', '#d8ac7a');
            pixelText(c, 'PAUSADO', 160, 79, '#f0ddae', 2, 'center');
            pixelText(c, 'ESC OU CONTINUAR', 160, 100, '#edcaf5', 1, 'center');
        }
        this.renderer.present();
        const message = paused ? 'Pausado · Esc ou Continuar para voltar'
            : this.finished ? 'O ramal do bairro segue fechado · CASA volta ao mapa · Prefeito: encontro opcional para reabrir a água'
            : this.player.data.isDead ? 'Retorno automático ao ponto seguro desta tentativa · Recomeçar reinicia a subida'
            : x >= 880 && x < 1088 && this.player.data.position.y + this.player.data.height > 180 ? 'Galeria de inspeção · moedas opcionais · degraus à direita levam à Casa; à esquerda, ao ponto seguro'
            : x >= 1072 && this.player.data.position.y + this.player.data.height <= 100 ? 'Sacada da Casa · desça à direita para o terraço; o acesso principal fica abaixo'
            : x >= 952 && x < 1012 && this.player.data.position.y + this.player.data.height <= 100 ? 'Mirante de manutenção · salte à direita para a sacada da Casa, na mesma altura; o degrau inferior permite recuperar um salto curto'
            : x >= 584 && x < 664 && this.player.data.position.y + this.player.data.height <= 272 ? 'Sacada de manutenção · espere o elevador se aproximar e salte para embarcar; o terraço fica à direita'
            : this.player.data.position.y + this.player.data.height > 328 ? x < 496
                ? 'Inspeção do canal seco · o degrau da direita leva ao próximo ponto seguro; à esquerda, à entrada'
                : 'Piso seco de recuperação · pule pelo degrau à esquerda e reembarque'
            : x < 160 ? 'Subida da Vazão · setas/A D: mover · Espaço: pular · Esc: pausa · M: som'
            : x < 496 ? 'Prancha de inspeção · ela vai e volta · pule para embarcar, solte a direção para viajar'
            : x < 768 ? 'Ponto seguro · embarque no elevador pela margem ou suba à sacada; salte à direita perto do terraço'
            : x < 1088 ? 'Ponto seguro no patamar · embarque na prancha e salte à direita junto ao terraço · galeria abaixo é opcional'
            : 'Casa da Vazão · siga até o cano para observar o desvio';
        if (this.status.textContent !== message) this.status.textContent = message;
    }
}
