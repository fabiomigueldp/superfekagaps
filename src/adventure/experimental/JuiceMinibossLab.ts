import { WorldGame } from '../WorldGame';
import { BossEncounter } from '../BossEncounter';
import { WorldLevel, WorldObjects } from '../WorldPhysics';
import { STAGES } from '../campaign';
import { TileType } from '../../constants';
import type { Rect } from '../../types';
import type { AdventureStage } from '../types';
import { overlaps } from '../types';
import { JuiceMinibossModel } from './JuiceMinibossModel';
import { drawJuiceMiniboss, drawJuiceLabBackground, drawJuiceLabFloor } from './JuiceMinibossArt';
import { pixelText, panel } from '../../graphics/BitmapFont';

export function juiceLabStage(): AdventureStage {
    const stage = structuredClone(STAGES.find(s => s.id === '3-5')!);
    stage.id = 'juice-lab'; stage.name = 'LABORATÓRIO EXPERIMENTAL'; stage.subtitle = 'Turbosuco · protótipo';
    stage.encounter = 'J1'; // Existing camera arena contract only; the lab installs its own encounter.
    stage.level.id = 'experimental-juice-lab'; stage.level.width = 20; stage.level.height = 18;
    stage.level.tiles = Array.from({ length: 18 }, (_, y) => Array(20).fill(y >= 14 ? TileType.GROUND : TileType.EMPTY));
    stage.level.playerSpawn = { x: 3, y: 12 };
    stage.mechanisms = []; stage.foes = []; stage.pickups = []; stage.exits = []; stage.dialogues = []; stage.checkpoints = [];
    stage.landmarks = [];
    return stage;
}

class LabEncounter extends BossEncounter {
    readonly model = new JuiceMinibossModel();
    constructor() { super('J1'); this.character = 'yasmin'; this.sync(); }
    private sync() {
        const b = this.model;
        this.x = b.x; this.y = b.y; this.width = b.width; this.height = b.height;
        this.health = b.health; this.maxHealth = b.maxHealth; this.timer = b.phaseTime;
        this.phase = b.phase === 'recover' ? 'open' : b.phase === 'intro' ? 'rest' : b.phase;
    }
    override update(dt: number, player: Rect, _objects: WorldObjects, _level: WorldLevel) {
        this.model.update(dt, player); this.sync();
        this.danger = this.model.hazards.find(r => overlaps(r, player)) ?? null;
        this.impact = this.model.events.some(e => e.kind === 'splash');
        this.released = this.model.events.some(e => e.kind === 'launch');
        this.impactPoint = { x: this.x + this.width / 2, y: this.model.arena.floor };
    }
    override contact(p: Rect, previous: Rect, falling: boolean) { const result = this.model.contact(p, previous, falling); this.sync(); return result; }
    override get shockWarning() { return false; }
    override get name() { return 'TURBOSUCO'; }
    override get hint() {
        const b = this.model;
        if (b.phase === 'defeated') return 'EXPERIMENTO CONCLUÍDO!';
        if (b.vulnerable) return 'AGORA! PULE NA COROA';
        return b.attack === 'dash' ? 'ARRANCADA! PULE SOBRE ELE' : b.attack === 'pounce' ? 'SALTO! SAIA DA MARCA' : 'LEQUE! LEIA AS GOTAS';
    }
}

/** Dedicated ephemeral laboratory; normal campaign files and storage are untouched. */
export class JuiceMinibossLab extends WorldGame {
    constructor(canvas: HTMLCanvasElement, private readonly status: HTMLElement) {
        super(canvas, true);
        this.art.boss = (c, boss, cx, cy) => { if (boss instanceof LabEncounter) drawJuiceMiniboss(c, boss.model, cx, cy); };
        this.art.arena = () => {};
        this.art.background = (c, _island, _cx, _cy, time) => drawJuiceLabBackground(c, time);
        this.art.terrain = (c, _level, _island, _cx, cy) => drawJuiceLabFloor(c, cy);
        this.load('juice-lab');
        document.title = 'Super Feka Gaps · Laboratório do Turbosuco';
    }
    override load(_id: string, _resume = false, _custom?: AdventureStage) {
        super.load('juice-lab', false, juiceLabStage());
        this.boss = new LabEncounter();
        if (this.status) this.status.textContent = 'Experimento · setas para mover, Espaço para pular, Esc para pausar';
    }
    /** Used by the accessible page control; keyboard/touch keep the base controls. */
    toggleLabPause() {
        if (this.state !== 'playing' && this.state !== 'paused') return;
        this.state = this.state === 'paused' ? 'playing' : 'paused';
        this.input.reset(); this.input.setMenuMode(this.state === 'paused');
        this.audio.pause(this.state === 'paused');
    }
    override update(dt: number) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        if (this.state === 'map' || this.state === 'title' || this.state === 'intro') { this.load('juice-lab'); return; }
        if (this.boss instanceof LabEncounter && this.boss.phase === 'defeated') {
            // Never call campaign completion with an experimental identifier.
            // Keep pause/mute alive, including after the final stomp.
            this.input.setMenuMode(this.state !== 'playing'); this.input.update();
            if (this.input.consumeMute()) this.audio.toggle();
            this.audio.tick(dt);
            if (this.state !== 'playing') return;
            if (this.input.consumePause()) { this.toggleLabPause(); return; }
            this.time += dt; this.renderer.advanceClock(dt);
            this.player.update(dt, { ...this.input.getState(), left: false, right: false, run: false,
                jump: false, jumpPressed: false, jumpReleased: false, down: false, downPressed: false }, this.level);
            this.boss.update(dt, this.player.getRect(), this.objects, this.level);
            return;
        }
        super.update(dt);
    }
    override render() {
        const paused = this.state === 'paused';
        // Do not create base pause buttons, which could route into campaign UI.
        if (paused) this.state = 'playing';
        try { super.render(); } finally { if (paused) this.state = 'paused'; }
        const c = this.renderer.getContext();
        c.fillStyle = '#251932'; c.fillRect(0, 0, 320, 23);
        c.fillStyle = '#bfce64'; c.fillRect(0, 22, 320, 1);
        pixelText(c, 'TURBOSUCO', 8, 8, '#edf292');
        pixelText(c, 'LAB EXPERIMENTAL', 170, 8, '#dbc6e4');
        pixelText(c, 'II', 305, 8, '#fff0cc');
        if (paused) {
            c.fillStyle = '#171324bb'; c.fillRect(0, 23, 320, 157);
            panel(c, 62, 70, 196, 43, '#292033', '#bfce64');
            pixelText(c, 'PAUSADO', 160, 79, '#edf292', 2, 'center');
            pixelText(c, 'ESC OU CONTINUAR', 160, 100, '#fff0cc', 1, 'center');
        } else if (this.boss?.phase === 'defeated') {
            panel(c, 66, 62, 188, 34, '#292033', '#bfce64');
            pixelText(c, 'EXPERIMENTO CONCLUIDO!', 160, 70, '#edf292', 1, 'center');
            pixelText(c, 'TENTE UMA NOVA LUTA', 160, 83, '#fff0cc', 1, 'center');
        }
        this.renderer.present();
        const message = paused ? 'Pausado · Esc ou Continuar para voltar'
            : this.boss?.phase === 'defeated' ? 'Vitória! Use Tentar novamente para uma nova luta'
            : 'Setas / A D: mover · Espaço: pular · Shift: correr · Esc: pausa · M: som';
        if (this.status.textContent !== message) this.status.textContent = message;
    }
}
