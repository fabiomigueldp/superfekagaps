import { guairaReturnHref } from './GuairaMapModel';
import { WorldGame } from '../../WorldGame';
import { BossEncounter } from '../../BossEncounter';
import type { WorldLevel, WorldObjects } from '../../WorldPhysics';
import { STAGES } from '../../campaign';
import { TileType } from '../../../constants';
import type { AdventureStage } from '../../types';
import type { Rect } from '../../../types';
import { PLAYER_RENDER_OFFSET_X, PLAYER_RENDER_OFFSET_Y, PLAYER_FRAME_W, PLAYER_FRAME_H } from '../../../assets/playerSpriteSpec';
import { panel, pixelText } from '../../../graphics/BitmapFont';
import { GuairaMayorModel, MAYOR_ARENA, MAYOR_RULES } from './GuairaMayorModel';
import { drawGuairaMayor, drawGuairaMayorStampTarget } from './GuairaMayorArt';
import { drawGuairaMayorBackground, drawGuairaMayorTerrain, drawGuairaMayorObjects } from './GuairaMayorArenaArt';

export function guairaMayorStage(): AdventureStage {
    const stage = structuredClone(STAGES[0]);
    stage.id = MAYOR_ARENA.id; stage.name = 'GUAÍRA · ÁGUA DO BAIRRO';
    stage.subtitle = 'Prefeito da Vazão · personagem fictício e nome provisório';
    stage.encounter = 'J1'; // Only the native fixed-camera/boss-contact contract.
    stage.level.id = 'experimental-guaira-prefeito'; stage.level.width = 20; stage.level.height = 18;
    stage.level.originX = 0; stage.level.originY = 0;
    stage.level.tiles = Array.from({ length: 18 }, (_, y) => Array(20).fill(y >= 14 ? TileType.GROUND : TileType.EMPTY));
    stage.level.playerSpawn = { x: 3, y: 14 };
    stage.level.enemies = []; stage.level.collectibles = []; stage.level.triggers = []; stage.level.checkpoints = [];
    stage.level.goalPosition = { x: 19, y: 14 }; stage.level.isBossLevel = false;
    stage.mechanisms = [
        { id: MAYOR_ARENA.valveId, kind: 'switch', ...MAYOR_ARENA.valve, link: MAYOR_ARENA.liftId },
        { id: MAYOR_ARENA.liftId, kind: 'lift', ...MAYOR_ARENA.lift, to: { x: 112, y: MAYOR_ARENA.deckY }, gated: true },
        { id: MAYOR_ARENA.deckId, kind: 'support', ...MAYOR_ARENA.deck }
    ];
    stage.foes = []; stage.pickups = []; stage.exits = []; stage.dialogues = []; stage.landmarks = [];
    stage.checkpoints = [{ x: 3, y: 14 }];
    stage.route = [{ x: 48, y: 224 }, { x: 80, y: 224, switch: MAYOR_ARENA.valveId }, { x: 168, y: 160 }, { x: 278, y: 160 }];
    return stage;
}

export class GuairaMayorEncounter extends BossEncounter {
    readonly model = new GuairaMayorModel();
    constructor() { super('J1'); this.character = 'yasmin'; this.sync(); }
    private sync() {
        const b = this.model;
        this.x = b.x; this.y = b.y; this.width = b.width; this.height = b.height;
        this.health = b.sealsRemaining; this.maxHealth = MAYOR_RULES.seals;
        this.timer = b.stateTick * MAYOR_RULES.tickMs;
        // 'released' intentionally remains native 'rest': campaign completion is
        // impossible and the real Player may walk/jump back out after victory.
        this.phase = b.vulnerable ? 'open' : b.state === 'warning' ? 'warning'
            : b.state === 'stamp' ? 'attack' : b.state === 'hurt' ? 'hurt' : 'rest';
    }
    override update(dt: number, _player: Rect, objects: WorldObjects, _level: WorldLevel) {
        const valve = objects.get(MAYOR_ARENA.valveId)!, lift = objects.get(MAYOR_ARENA.liftId)!;
        this.model.update(dt, { valveActive: valve.active, liftReady: lift.active && lift.y === MAYOR_ARENA.deckY,
            registerOpened: objects.events.some(e => e.kind === 'switch' && e.x === valve.x && e.y === valve.y) });
        this.impact = this.model.events.some(e => e.kind === 'stamp'); this.released = false;
        if (this.impact) {
            // Keep the native toggle pair synchronized. The next sentada opens.
            for (const body of [valve, lift]) {
                body.active = body.observedActive = false; body.changedAt = objects.time;
            }
            valve.timer = 0;
        }
        if (this.model.publicWaterOpen) {
            valve.active = valve.observedActive = lift.active = lift.observedActive = true;
        }
        this.impactPoint = { x: 278, y: 160 };
        // Resolve exactly painted water inside contact, after top precedence.
        this.danger = null; this.sync();
    }
    override contact(p: Rect, previous: Rect, falling: boolean) {
        const result = this.model.contact(p, previous, falling); this.sync(); return result;
    }
    override get shockWarning() { return false; }
    override get name() { return 'AGUA PUBLICA'; }
    override get hint() {
        const b = this.model;
        if (b.publicWaterOpen) return 'AGUA DO BAIRRO LIBERADA';
        if (b.counterpressure?.phase === 'warning') return 'EMENDA: ESPERE OU PULE';
        if (b.counterpressure?.phase === 'active') return 'AGUA NA EMENDA! ESPERE OU PULE';
        if (b.vulnerable) return 'AGORA! GOLPE POR CIMA';
        if (b.state === 'warning') return 'CARIMBO ALTO: SAIA DA GRELHA';
        if (b.state === 'stamp') return 'AGUA NA GRELHA! REGISTRO A ESQUERDA';
        if (b.state === 'recover') return b.accessRequested ? 'ESPERE A PASSARELA SUBIR' : 'REGISTRO: PULE + BAIXO';
        if (b.state === 'hurt') return 'UM LACRE DA AGUA SOLTO';
        return 'REABRA A AGUA DO BAIRRO';
    }
}

/** Ephemeral scene adapter: no campaign entry, persistence or global Player edits. */
export class GuairaMayorLab extends WorldGame {
    readonly reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    private encounter!: GuairaMayorEncounter;
    constructor(canvas: HTMLCanvasElement, private readonly status: HTMLElement) {
        super(canvas, true);
        this.art.background = (c, _island, cx, cy, time) => drawGuairaMayorBackground(c, this.mayor, cx, cy, time, this.reducedMotion);
        this.art.terrain = (c, level, _island, cx, cy) => drawGuairaMayorTerrain(c, level, cx, cy);
        this.art.objects = (c, objects, cx, cy, time) => {
            drawGuairaMayorObjects(c, objects, this.mayor, cx, cy, time, this.reducedMotion);
            drawGuairaMayorStampTarget(c, this.mayor, cx, cy, this.reducedMotion);
            drawGuairaMayor(c, this.mayor, cx, cy, this.reducedMotion);
        };
        this.store.save.preferences.shake = !this.reducedMotion;
        if (this.reducedMotion) {
            (this as unknown as { particle: (...args: unknown[]) => void }).particle = () => {};
            this.renderer.addImpact = () => {};
        }
        this.tutorial.observe = () => {};
        this.load(MAYOR_ARENA.id);
        window.addEventListener('keydown', e => {
            if (['ArrowLeft', 'ArrowRight', 'ArrowDown', ' ', 'a', 'd', 'm', 'M'].includes(e.key)) this.audio.unlock();
        });
        document.title = 'Super Feka Gaps · Guaíra · Prefeito experimental';
    }
    get mayor() { return this.encounter.model; }
    override load(_id: string, resume = false, _custom?: AdventureStage) {
        super.load(MAYOR_ARENA.id, resume, guairaMayorStage());
        this.encounter = new GuairaMayorEncounter(); this.boss = this.encounter; this.time = 0;
        this.player.data.isGrounded = true; this.player.data.facingRight = true;
        if (!resume || !this.store.save.checkpoint) this.player.data.hasHelmet = true;
        this.player.data.respawnRevealTimer = 0;
        this.camera.x = 0; this.camera.y = 64;
    }
    get mapReturnHref() {
        return guairaReturnHref('vazao', this.mayor.publicWaterOpen ? 'mayor-clear' : null);
    }
    toggleLabPause() {
        if (this.state === 'paused') this.resume();
        else if (this.state === 'playing') this.pause();
    }
    override update(dt: number) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        if (this.state === 'map' || this.state === 'title' || this.state === 'intro') { this.load(MAYOR_ARENA.id); return; }
        super.update(dt);
        if (this.player.data.isDead) this.mayor.cancelCounterpressure();
        if (this.state === 'playing' && !this.player.data.isDead) {
            // Native renderer places the body at y-2 and the standing/jumping
            // helmet another 2px above it. Use that conservative visual top,
            // including headwear, rather than the smaller physics rectangle.
            const visualTop = this.player.data.position.y + PLAYER_RENDER_OFFSET_Y - (this.player.data.hasHelmet ? 2 : 0);
            const home = 64, minimum = this.camera.bounds.minY;
            const desired = Math.max(minimum, Math.min(home, visualTop - 39));
            const ceiling = Math.max(minimum, Math.min(home, visualTop - 27));
            const easing = 1 - Math.pow(.8, Math.min(dt, 100) / MAYOR_RULES.tickMs);
            this.camera.y = Math.max(minimum, Math.min(ceiling, this.camera.y + (desired - this.camera.y) * easing));
        }
    }
    override render() {
        const paused = this.state === 'paused';
        if (paused) this.state = 'playing';
        // The mayor is painted with the objects, before Feka. Omit the native
        // health panel only for rendering: its tall panel would hide the raised
        // stamp and a correctly timed top hit. Simulation always has this boss.
        this.boss = null;
        try { super.render(); } finally { this.boss = this.encounter; if (paused) this.state = 'paused'; }
        const c = this.renderer.getContext(), b = this.mayor;
        c.fillStyle = '#382b35'; c.fillRect(0, 0, 320, 23);
        c.fillStyle = '#d8ac7a'; c.fillRect(0, 22, 320, 1);
        pixelText(c, 'GUAIRA', 8, 8, '#f0ddae');
        pixelText(c, `AGUA DO BAIRRO ${MAYOR_RULES.seals - b.sealsRemaining}/3`, 60, 8, '#a6e0df');
        if (this.player.data.hasHelmet) this.renderer.drawHelmet(279, 4, c);
        pixelText(c, 'II', 305, 8, '#f0ddae');
        const p = this.player.data;
        const sx = Math.round(p.position.x) - Math.round(this.camera.x) + PLAYER_RENDER_OFFSET_X;
        const sy = Math.round(p.position.y) - Math.round(this.camera.y) + PLAYER_RENDER_OFFSET_Y - (p.hasHelmet ? 2 : 0);
        const touchesHint = sx < 232 && sx + PLAYER_FRAME_W > 4 && sy < 43 && sy + PLAYER_FRAME_H + 2 > 24;
        // The status beside Pause always retains the hint. Hide its duplicate
        // canvas strip when a legitimate jump crosses it, keeping Feka visible.
        if (!touchesHint) {
            panel(c, 6, 26, 224, 15, '#382b35', '#d8ac7a');
            pixelText(c, this.boss!.hint, 118, 31, '#f0ddae', 1, 'center');
        }
        if (paused) {
            c.fillStyle = '#211b2bbd'; c.fillRect(0, 23, 320, 157);
            panel(c, 62, 70, 196, 43, '#382b35', '#d8ac7a');
            pixelText(c, 'PAUSADO', 160, 79, '#f0ddae', 2, 'center');
            pixelText(c, 'ESC OU CONTINUAR', 160, 100, '#edcaf5', 1, 'center');
        }
        this.renderer.present();
        const message = paused ? 'Pausado · Esc ou Continuar para voltar'
            : this.player.data.isDead ? 'Feka caiu · retorno automático ao registro com a luta reiniciada · Tentar recomeça já'
            : b.publicWaterOpen ? 'Feka: “A água voltou. Os gaps continuam.” · CASA: voltar à Casa da Vazão · TENTAR: recomeçar o encontro'
            : `Prefeito da Vazão (nome provisório) · ${this.boss!.hint} · setas/A D: mover · Espaço: pular · baixo no ar: sentada · Esc: pausa`;
        if (this.status.textContent !== message) this.status.textContent = message;
    }
}
