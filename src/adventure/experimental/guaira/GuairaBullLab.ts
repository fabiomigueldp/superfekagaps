import { guairaReturnHref } from './GuairaMapModel';
import { WorldGame } from '../../WorldGame';
import { BossEncounter } from '../../BossEncounter';
import type { WorldLevel, WorldObjects } from '../../WorldPhysics';
import { STAGES } from '../../campaign';
import { TileType } from '../../../constants';
import type { AdventureStage } from '../../types';
import type { Rect } from '../../../types';
import { panel, pixelText } from '../../../graphics/BitmapFont';
import { SkeletonBullModel, BULL_RULES } from './SkeletonBullModel';
import { drawGuairaBackground, drawGuairaBoss, drawGuairaFloor } from './GuairaLabArt';

export function guairaLabStage(): AdventureStage {
    const stage = structuredClone(STAGES.find(s => s.id === '3-5')!);
    stage.id = 'guaira-lab'; stage.name = 'GUAÍRA · PROTÓTIPO'; stage.subtitle = 'Ossabravo · nome provisório';
    stage.encounter = 'J1'; // Existing fixed-camera contract; replaced by the lab encounter.
    stage.level.id = 'experimental-guaira-lab'; stage.level.width = 20; stage.level.height = 18;
    stage.level.tiles = Array.from({ length: 18 }, (_, y) => Array(20).fill(y >= 14 ? TileType.GROUND : TileType.EMPTY));
    stage.level.playerSpawn = { x: 4, y: 12 };
    stage.mechanisms = []; stage.foes = []; stage.pickups = []; stage.exits = [];
    stage.dialogues = []; stage.checkpoints = []; stage.landmarks = [];
    return stage;
}

export class GuairaBullEncounter extends BossEncounter {
    readonly model = new SkeletonBullModel();
    constructor() { super('J1'); this.character = 'yasmin'; this.sync(); }
    private sync() {
        const b = this.model;
        this.x = b.x; this.y = b.y; this.width = b.width; this.height = b.height;
        this.health = b.health; this.maxHealth = BULL_RULES.health; this.timer = b.stateTick * BULL_RULES.tickMs;
        this.phase = b.vulnerable ? 'open' : b.state === 'tell' || b.state === 'rattle' ? 'warning'
            : b.state === 'charge' || b.state === 'bones' ? 'attack'
            : b.state === 'hurt' || b.state === 'defeated' ? b.state : 'rest';
    }
    override update(dt: number, player: Rect, _objects: WorldObjects, _level: WorldLevel) {
        this.model.update(dt, player); this.sync();
        // Resolve sweeps together with top contact so the first recovery stomp
        // has priority over the last charge step's swept body.
        this.danger = null;
        this.impact = this.model.events.some(e => e.kind === 'brake');
        this.released = this.model.events.some(e => e.kind === 'bones');
        this.impactPoint = { x: this.x + this.width / 2, y: this.model.arena.floor };
    }
    override contact(p: Rect, previous: Rect, falling: boolean) {
        const result = this.model.contact(p, previous, falling); this.sync(); return result;
    }
    override get shockWarning() { return false; }
    override get name() { return 'OSSABRAVO'; }
    override get hint() {
        const b = this.model;
        if (b.state === 'defeated') return 'A OSSADA DESCANSOU';
        if (b.vulnerable) return 'AGORA! PULE NAS COSTELAS';
        if (b.state === 'rattle' || b.state === 'bones') return 'OSSOS BAIXOS! PULE';
        if (b.state === 'tell' || b.state === 'charge') return 'INVESTIDA! PULE POR CIMA';
        return 'ESPERE A ABERTURA';
    }
}

/** Ephemeral adapter: real Feka movement, helmet, death, touch and renderer. */
export class GuairaBullLab extends WorldGame {
    reducedMotion: boolean;
    constructor(canvas: HTMLCanvasElement, private readonly status: HTMLElement,
        private readonly continuationHint = 'SUBIR: CASA DA VAZAO') {
        super(canvas, true);
        try {
            this.reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
            this.art.boss = (c, boss, cx, cy) => {
                if (boss instanceof GuairaBullEncounter) drawGuairaBoss(c, boss.model, cx, cy, this.reducedMotion);
            };
            this.art.arena = () => {};
            this.art.background = c => drawGuairaBackground(c);
            this.art.terrain = (c, _level, _island, _cx, cy) => drawGuairaFloor(c, cy);
            this.store.save.preferences.shake = !this.reducedMotion;
            // Basic controls are documented on the page; campaign tutorials would
            // cover the arena and have no place in this isolated prototype.
            this.tutorial.observe = () => {};
            this.load('guaira-lab');
            this.listen(window, 'keydown', e => {
                if (['ArrowLeft', 'ArrowRight', ' ', 'a', 'd', 'm', 'M'].includes(e.key)) this.audio.unlock();
            });
            document.title = 'Super Feka Gaps · Guaíra · Ossabravo experimental';
        } catch (error) { this.dispose(); throw error; }
    }
    override load(_id: string, _resume = false, _custom?: AdventureStage) {
        if (this.isDisposed) return;
        super.load('guaira-lab', false, guairaLabStage());
        this.boss = new GuairaBullEncounter();
        this.player.data.position = { x: 68, y: 224 - this.player.data.height };
        this.player.data.isGrounded = true; this.player.data.facingRight = true;
        this.player.data.hasHelmet = true; this.player.data.respawnRevealTimer = 0;
        this.camera.x = 0; this.camera.y = 64;
        if (this.status) this.status.textContent = 'Protótipo experimental · Guaíra · Ossabravo (nome provisório)';
    }
    toggleLabPause() {
        if (this.isDisposed) return;
        if (this.state !== 'playing' && this.state !== 'paused') return;
        if (this.state === 'paused') this.resume(); else this.pause();
    }
    get mapReturnHref() {
        return guairaReturnHref('corral', this.boss?.phase === 'defeated' ? 'bull-clear' : null);
    }
    get canAdvanceToAscent() {
        return !this.isDisposed && this.state === 'playing' && !this.player.data.isDead && this.boss?.phase === 'defeated';
    }
    override update(dt: number) {
        if (this.isDisposed) return;
        if (!Number.isFinite(dt) || dt <= 0) return;
        if (this.state === 'map' || this.state === 'title' || this.state === 'intro') { this.load('guaira-lab'); return; }
        if (this.boss?.phase === 'defeated') {
            // Never hand the experimental identifier to campaign completion.
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
        if (this.isDisposed) return;
        const paused = this.state === 'paused';
        // Do not install the campaign pause-menu navigation callbacks.
        if (paused) this.state = 'playing';
        try { super.render(); } finally { if (paused) this.state = 'paused'; }
        const c = this.renderer.getContext();
        c.fillStyle = '#382b35'; c.fillRect(0, 0, 320, 23);
        c.fillStyle = '#d8ac7a'; c.fillRect(0, 22, 320, 1);
        pixelText(c, 'GUAIRA', 8, 8, '#f0ddae');
        pixelText(c, 'LAB EXPERIMENTAL', 60, 8, '#dcbceb');
        if (this.player.data.hasHelmet) this.renderer.drawHelmet(279, 4, c);
        pixelText(c, 'II', 305, 8, '#f0ddae');
        if (paused) {
            c.fillStyle = '#211b2bbd'; c.fillRect(0, 23, 320, 157);
            panel(c, 62, 70, 196, 43, '#382b35', '#d8ac7a');
            pixelText(c, 'PAUSADO', 160, 79, '#f0ddae', 2, 'center');
            pixelText(c, 'ESC OU CONTINUAR', 160, 100, '#edcaf5', 1, 'center');
        } else if (this.boss?.phase === 'defeated') {
            panel(c, 62, 64, 196, 34, '#382b35', '#d8ac7a');
            pixelText(c, 'A OSSADA DESCANSOU!', 160, 72, '#f0ddae', 1, 'center');
            pixelText(c, this.continuationHint, 160, 85, '#edcaf5', 1, 'center');
        }
        this.renderer.present();
        const message = paused ? 'Pausado · Esc ou Continuar para voltar'
            : this.player.data.isDead ? 'Feka caiu · reinício automático · Tentar para recomeçar já'
            : this.boss?.phase === 'defeated' ? 'Vitória! Ossabravo descansou · Subir leva à Casa da Vazão para observar o desvio da água · Tentar repete a luta'
            : 'Ossabravo · setas/A D: mover · Espaço: pular · baixo no ar: sentada · Shift: correr · Esc: pausa · M: som';
        if (this.status.textContent !== message) this.status.textContent = message;
    }
}
