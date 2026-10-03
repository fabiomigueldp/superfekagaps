import { guairaReturnHref } from './GuairaMapModel';
import { WorldGame } from '../../WorldGame';
import { STAGES } from '../../campaign';
import { TileType } from '../../../constants';
import type { AdventureStage } from '../../types';
import { panel, pixelText } from '../../../graphics/BitmapFont';
import { drawGuairaAscentBackground, drawGuairaAscentTerrain, drawGuairaAscentObjects } from './GuairaAscentArt';

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
            y === 21 && (x >= 15 && x < 18 || x >= 41 && x < 44)) return TileType.PLATFORM;
        // A dry inspection gallery catches missed transfers; its left stair returns
        // to the checkpoint without a death or a precision re-boarding requirement.
        if (y === 15 && x >= 55 && x < 68 || y === 12 && x >= 55 && x < 58) return TileType.PLATFORM;
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
    stage.route = [{ x: 48, y: 304 }, { x: 528, y: 304 }, { x: 712, y: 144 }, { x: 800, y: 144 }, { x: 1024, y: 144 }, { x: 1264, y: 144 }];
    return stage;
}

/** Native Player, carry, checkpoint and death flow; only scene presentation is local. */
export class GuairaAscent extends WorldGame {
    readonly reducedMotion: boolean;
    finished = false;
    constructor(canvas: HTMLCanvasElement, private readonly status: HTMLElement) {
        super(canvas, true);
        try {
            this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
            this.art.background = (c, _island, cx, cy, time) => drawGuairaAscentBackground(c, cx, cy, time, this.reducedMotion);
            this.art.terrain = (c, level, _island, cx, cy, time) => drawGuairaAscentTerrain(c, level, cx, cy, time, this.reducedMotion);
            this.art.objects = (c, objects, cx, cy, time) => drawGuairaAscentObjects(c, objects, cx, cy, time, this.reducedMotion);
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
        this.finished = false; this.time = 0;
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
            this.player.update(dt, { ...this.input.getState(), left: false, right: false, run: false,
                jump: false, jumpPressed: false, jumpReleased: false, down: false, downPressed: false }, this.level);
            return;
        }
        const previousObjects = this.objects, previousTime = this.objects.time;
        super.update(dt);
        const p = this.player.data;
        // This upper service route needs a little sky beyond the native world
        // clamp. Keep the helmet below the fixed HUD without changing physics.
        if (this.state === 'playing' && !p.isDead && this.objects === previousObjects &&
            this.objects.time > previousTime) {
            // At rest the dry optional gallery is visible before stepping off.
            if (p.isGrounded && p.position.x >= 768 && p.position.x < 1088 && p.position.y + p.height <= 144)
                this.camera.y += (86 - this.camera.y) * .35;
            this.camera.y = Math.min(this.camera.y, p.position.y - 36);
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
        if (paused) this.state = 'playing';
        try { super.render(); } finally { if (paused) this.state = 'paused'; }
        const c = this.renderer.getContext(), x = this.player.data.position.x;
        c.fillStyle = '#382b35'; c.fillRect(0, 0, 320, 23);
        c.fillStyle = '#d8ac7a'; c.fillRect(0, 22, 320, 1);
        pixelText(c, 'GUAIRA', 8, 8, '#f0ddae');
        pixelText(c, this.finished ? 'DESVIO A VISTA' : x < 496 ? 'PRANCHA DE INSPECAO' : x < 768 ? 'SUBIDA DA VAZAO' : 'TRAVESSIA DE SERVICO', 57, 8, '#f0ddae');
        if (this.player.data.hasHelmet) this.renderer.drawHelmet(279, 4, c);
        pixelText(c, 'II', 305, 8, '#f0ddae');
        if (paused) {
            c.fillStyle = '#211b2bbd'; c.fillRect(0, 23, 320, 157);
            panel(c, 62, 70, 196, 43, '#382b35', '#d8ac7a');
            pixelText(c, 'PAUSADO', 160, 79, '#f0ddae', 2, 'center');
            pixelText(c, 'ESC OU CONTINUAR', 160, 100, '#edcaf5', 1, 'center');
        } else if (this.finished) {
            // A single-line banner preserves both pipe labels and native touch controls.
            panel(c, 40, 28, 240, 19, '#382b35', '#d8ac7a');
            pixelText(c, 'RAMAL DO BAIRRO FECHADO', 160, 34, '#edcaf5', 1, 'center');
        }
        this.renderer.present();
        const message = paused ? 'Pausado · Esc ou Continuar para voltar'
            : this.finished ? 'O ramal do bairro segue fechado · CASA volta ao mapa · Prefeito: encontro opcional para reabrir a água'
            : this.player.data.isDead ? 'Retorno automático ao ponto seguro desta tentativa · Recomeçar reinicia a subida'
            : x >= 880 && x < 1088 && this.player.data.position.y + this.player.data.height > 180 ? 'Galeria de inspeção opcional · moedas nesta tentativa · degrau à esquerda retorna ao ponto seguro'
            : this.player.data.position.y + this.player.data.height > 328 ? 'Piso seco de recuperação · pule pelo degrau à esquerda e reembarque'
            : x < 160 ? 'Subida da Vazão · setas/A D: mover · Espaço: pular · Esc: pausa · M: som'
            : x < 496 ? 'Prancha de inspeção · ela vai e volta · pule para embarcar, solte a direção para viajar'
            : x < 768 ? 'Ponto seguro só nesta tentativa · sair e reentrar reinicia a subida · embarque no elevador e salte à direita perto do terraço'
            : x < 1088 ? 'Ponto seguro no patamar · embarque na prancha e salte à direita junto ao terraço · galeria abaixo é opcional'
            : 'Casa da Vazão · siga até o cano para observar o desvio';
        if (this.status.textContent !== message) this.status.textContent = message;
    }
}
