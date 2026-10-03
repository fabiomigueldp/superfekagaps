import { WorldGame } from '../WorldGame';
import { BossEncounter } from '../BossEncounter';
import { WorldLevel, WorldObjects } from '../WorldPhysics';
import { STAGES } from '../campaign';
import { TileType } from '../../constants';
import type { Rect } from '../../types';
import type { AdventureStage } from '../types';
import { overlaps } from '../types';
import { JuiceMinibossModel } from './JuiceMinibossModel';
import { drawJuiceMiniboss, drawJuiceLabBackground, drawJuiceLabFloor, drawJuiceGeysers } from './JuiceMinibossArt';
import { JuiceIntroDirector, type IntroCue } from './JuiceIntroDirector';
import { drawJuiceIntro } from './JuiceIntroArt';
import { JuiceIntroAudio } from './JuiceIntroAudio';
import { JuiceCombatEffects } from './JuiceCombatEffects';
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
    readonly effects = new JuiceCombatEffects();
    constructor() { super('J1'); this.character = 'yasmin'; this.sync(); }
    private sync() {
        const b = this.model;
        this.x = b.x; this.y = b.y; this.width = b.width; this.height = b.height;
        this.health = b.health; this.maxHealth = b.maxHealth; this.timer = b.phaseTime;
        this.phase = b.phase === 'recover' ? 'open' : b.phase === 'intro' || b.phase === 'enrage' ? 'rest' : b.phase;
    }
    override update(dt: number, player: Rect, _objects: WorldObjects, _level: WorldLevel) {
        const previousDrops = this.model.drops.slice();
        this.model.update(dt, player); this.sync();
        this.effects.advance(this.model.time);
        for (const d of previousDrops) if (!this.model.drops.includes(d) && d.y + d.height >= this.model.arena.floor)
            this.effects.add('drip', d.x + d.width / 2, this.model.arena.floor, this.model.time);
        for (const e of this.model.events) {
            if (e.kind === 'spit') this.effects.add('spit', e.x, e.y, this.model.time, this.model.facing);
            if (e.kind === 'splash' && this.model.attack !== 'fan') this.effects.add('landing', e.x, e.y, this.model.time);
        }
        this.danger = this.model.hazards.find(r => overlaps(r, player)) ?? null;
        this.impact = this.model.attack === 'pounce' && this.model.events.some(e => e.kind === 'splash');
        this.released = this.model.events.some(e => e.kind === (this.model.attack === 'fan' ? 'spit' : 'launch'));
        this.impactPoint = { x: this.x + this.width / 2, y: this.model.arena.floor };
    }
    override contact(p: Rect, previous: Rect, falling: boolean) {
        const retiringGeysers = this.model.geysers;
        const result = this.model.contact(p, previous, falling); this.sync();
        if (result === 'hit' || result === 'defeated') {
            this.effects.releaseGeysers(retiringGeysers, this.model.time);
            this.effects.add('hit', this.x + this.width / 2, this.y, this.model.time);
            if (result === 'defeated') this.effects.add('defeat', this.x + this.width / 2, this.model.arena.floor, this.model.time);
        }
        return result;
    }
    override get shockWarning() { return false; }
    override get name() { return 'TURBOSUCO'; }
    override get hint() {
        const b = this.model;
        if (b.phase === 'defeated') return 'EXPERIMENTO CONCLUÍDO!';
        if (b.phase === 'enrage') return 'FASE 2! PRESSÃO MÁXIMA';
        if (b.vulnerable) return 'AGORA! PULE EM CIMA';
        if (b.phase === 'hurt') return 'ACERTOU!';
        if (b.phase === 'intro' || b.phase === 'rest') return 'DESVIE E ESPERE A ABERTURA';
        return b.attack === 'dash' ? 'ARRANCADA! PULE SOBRE ELE' : b.attack === 'pounce' ? 'SALTO! SAIA DA MARCA' : 'LEQUE! LEIA AS GOTAS';
    }
}

/** Dedicated ephemeral laboratory; normal campaign files and storage are untouched. */
export class JuiceMinibossLab extends WorldGame {
    labMode: 'intro' | 'combat' | 'result' = 'combat';
    intro: JuiceIntroDirector | null = null;
    reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
    /** Optional audio/telemetry adapter. Receives one-shot semantic cues, including cancellation. */
    onIntroCue?: (cue: IntroCue) => void;
    private pendingPresentation = false;
    private introStatus = '';
    private introAudio = new JuiceIntroAudio(() => this.audio.getEffectsRoute());
    presentIntro() { if (this.state === 'playing' && this.intro?.beat === 'prepare') this.pendingPresentation = true; }
    replayIntro() {
        this.load('juice-lab');
        this.labMode = 'intro'; this.intro = new JuiceIntroDirector(); this.introStatus = '';
        this.audio.cancelSpeech(); this.input.reset();
    }
    skipIntro() { if (this.labMode !== 'intro') return; this.intro?.skip(); this.startCombat(); }
    private startCombat() {
        const paused = this.state === 'paused';
        this.onIntroCue?.('cancel'); this.introAudio?.cancel(); this.audio.cancelSpeech();
        this.labMode = 'combat'; this.intro = null; this.pendingPresentation = false;
        this.boss = new LabEncounter();
        this.player.data.position.x = 68;
        this.player.data.position.y = 224 - this.player.data.height;
        this.player.data.velocity.x = 0; this.player.data.velocity.y = 0;
        this.player.data.facingRight = true; this.player.data.isGrounded = true;
        this.player.data.respawnRevealTimer = 0;
        this.camera.x = 0; this.camera.y = 64;
        this.input.reset(); this.input.setMenuMode(paused);
        this.audio.select(3, true, 'juice-lab'); this.audio.pause(paused);
        this.introAudio?.setPaused(paused); this.introAudio?.play('combat'); this.onIntroCue?.('combat');
    }
    private emitIntroCues() {
        for (const cue of this.intro?.drainCues() ?? []) {
            this.onIntroCue?.(cue);
            this.introAudio?.play(cue);
        }
    }
    constructor(canvas: HTMLCanvasElement, private readonly status: HTMLElement) {
        super(canvas, true);
        if (this.reducedMotion) this.store.save.preferences.shake = false;
        this.art.boss = (c, boss, cx, cy) => {
            if (boss instanceof LabEncounter) {
                drawJuiceGeysers(c, boss.model, cx, cy, this.reducedMotion);
                drawJuiceMiniboss(c, boss.model, cx, cy, this.reducedMotion);
                boss.effects.draw(c, boss.model, cx, cy, this.reducedMotion);
            }
        };
        this.art.arena = () => {};
        this.art.background = (c, _island, _cx, _cy, time) => drawJuiceLabBackground(c, this.reducedMotion ? 0 : time, this.boss instanceof LabEncounter ? this.boss.model : undefined);
        this.art.terrain = (c, _level, _island, cx, cy) => drawJuiceLabFloor(c, cy, this.boss instanceof LabEncounter ? this.boss.model : undefined, cx);
        this.replayIntro();
        this.addCleanup(() => this.introAudio.dispose());
        this.listen(window, 'blur', () => {
            this.pendingPresentation = false; this.introAudio.cancel();
            if (this.state === 'playing') this.toggleLabPause();
            this.introAudio.setPaused(this.state === 'paused');
        });
        this.listen(window, 'pagehide', () => this.introAudio.cancel());
        this.listen(window, 'keydown', e => { if (['ArrowLeft','ArrowRight',' ','a','d','m','M'].includes(e.key)) this.audio.unlock(); });
        this.listen(document, 'visibilitychange', () => { if (document.hidden) this.introAudio.cancel(); });
        document.title = 'Super Feka Gaps · Laboratório do Turbosuco';
    }
    override load(_id: string, _resume = false, _custom?: AdventureStage) {
        this.onIntroCue?.('cancel'); this.introAudio?.cancel(); this.intro = null; this.labMode = 'combat'; this.pendingPresentation = false;
        super.load('juice-lab', false, juiceLabStage());
        this.boss = new LabEncounter(); this.introAudio?.setPaused(false);
        this.player.data.position.x = 68; this.player.data.position.y = 224 - this.player.data.height;
        this.player.data.isGrounded = true; this.player.data.respawnRevealTimer = 0;
        if (this.status) this.status.textContent = 'Experimento · setas para mover, Espaço para pular, Esc para pausar';
    }
    /** Used by the accessible page control; keyboard/touch keep the base controls. */
    toggleLabPause() {
        if (this.state !== 'playing' && this.state !== 'paused') return;
        if (this.state === 'paused') this.resume(); else this.pause();
        this.introAudio?.setPaused(this.state === 'paused'); this.pendingPresentation = false;
    }
    override update(dt: number) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        this.introAudio?.setPaused(this.state === 'paused'); this.introAudio?.sync();
        if (this.labMode === 'intro' && this.intro) {
            this.input.setMenuMode(this.state !== 'playing'); this.input.update();
            if (this.input.consumeMute()) { this.audio.toggle(); this.introAudio?.sync(); }
            if (this.state !== 'playing') return;
            if (this.input.consumePause()) { this.toggleLabPause(); return; }
            const input = this.input.getState();
            this.intro.advance(dt, { left: input.left, right: input.right,
                presentPressed: input.jumpPressed || this.pendingPresentation });
            this.pendingPresentation = false;
            this.time += Math.min(dt, 100); this.renderer.advanceClock(Math.min(dt, 100));
            this.emitIntroCues();
            if (this.intro.complete) this.startCombat();
            return;
        }
        if (this.state === 'map' || this.state === 'title' || this.state === 'intro') { this.load('juice-lab'); return; }
        if (this.boss instanceof LabEncounter && this.boss.phase === 'defeated') {
            this.audio.ambience();
            this.labMode = 'result';
            // Never call campaign completion with an experimental identifier.
            // Keep pause/mute alive, including after the final stomp.
            this.input.setMenuMode(this.state !== 'playing'); this.input.update();
            if (this.input.consumeMute()) this.audio.toggle();
            this.audio.tick(dt);
            if (this.state !== 'playing') return;
            if (this.input.consumePause()) { this.toggleLabPause(); return; }
            this.time += dt; this.renderer.advanceClock(dt);
            this.camera.shakeTimer = Math.max(0, this.camera.shakeTimer - dt);
            this.updateSparks(dt);
            this.player.update(dt, { ...this.input.getState(), left: false, right: false, run: false,
                jump: false, jumpPressed: false, jumpReleased: false, down: false, downPressed: false }, this.level);
            this.boss.update(dt, this.player.getRect(), this.objects, this.level);
            return;
        }
        const model = this.boss instanceof LabEncounter ? this.boss.model : null;
        this.audio.ambience(model && model.phase !== 'defeated' && !this.player.data.isDead
            ? model.enraged ? 'juice-enraged' : 'juice' : undefined,
            model ? Math.max(0, 1 - Math.abs(this.player.data.position.x - model.x) / 320) : 0);
        const before = model?.time;
        super.update(dt);
        // Sound follows simulation events, so pause or hit-stop cannot repeat a cue.
        if (model && model.time !== before && this.state === 'playing') {
            if (model.events.some(e => e.kind === 'enrage')) this.audio.sfx('pressure');
            if (model.events.some(e => e.kind === 'geyser-warning')) this.audio.sfx('pressure');
            if (model.events.some(e => e.kind === 'geyser')) this.audio.sfx('jet');
        }
    }
    protected override renderEncounterHud(_c: CanvasRenderingContext2D) {
        // The lab draws a compact integrated HUD after the world render.
    }
    override render() {
        if (this.labMode === 'intro' && this.intro) {
            this.renderer.startScene();
            const c = this.renderer.getContext();
            drawJuiceIntro(c, this.intro.frame, this.reducedMotion);
            if (this.state === 'playing' && (this.intro.beat === 'walk' || this.intro.beat === 'prepare'))
                this.renderer.drawIntroTouchControls(this.intro.beat);
            if (this.state === 'paused') {
                c.fillStyle = '#171324bb'; c.fillRect(0, 0, 320, 180);
                panel(c, 62, 70, 196, 43, '#292033', '#bfce64');
                pixelText(c, 'PAUSADO', 160, 79, '#edf292', 2, 'center');
                pixelText(c, 'ESC OU CONTINUAR', 160, 100, '#fff0cc', 1, 'center');
            }
            this.renderer.present();
            const f = this.intro.frame;
            const message = this.state === 'paused' ? 'Pausado · Esc ou Continuar para voltar'
                : f.subtitle ? `${f.subtitle.speaker}: ${f.subtitle.text}` : f.prompt || 'Apresentação Calabrezzo · Esc pausa · M som';
            if (this.introStatus !== message) { this.status.textContent = message; this.introStatus = message; }
            return;
        }
        const paused = this.state === 'paused';
        // Do not create base pause buttons, which could route into campaign UI.
        if (paused) this.state = 'playing';
        try { super.render(); } finally { if (paused) this.state = 'paused'; }
        const c = this.renderer.getContext();
        const b = this.boss instanceof LabEncounter ? this.boss.model : null;
        const accent = b?.enraged ? '#eaa17f' : '#bc8ee1';
        c.fillStyle = '#161c2a'; c.fillRect(0, 0, 320, 34);
        c.fillStyle = '#4e425d'; c.fillRect(0, 33, 320, 1);
        pixelText(c, 'TURBOSUCO', 8, 7, '#efdcfa');
        pixelText(c, b?.enraged ? 'FASE 02' : 'FASE 01', 256, 7, accent);
        if (b) {
            for (let i = 0; i < b.maxHealth; i++) {
                const x = 112 + i * 19;
                c.fillStyle = '#414452'; c.fillRect(x, 6, 15, 7);
                c.fillStyle = i < b.health ? accent : '#252937'; c.fillRect(x + 1, 7, 13, 5);
                if (i < b.health) { c.fillStyle = '#f5dfe7'; c.fillRect(x + 1, 7, 13, 1); }
                if (i === b.health && (b.phase === 'hurt' || b.phase === 'defeated')) {
                    const chip = Math.max(0, 1 - Math.max(0, b.phaseTime - 80) / 270);
                    c.fillStyle = b.phaseTime < 80 ? '#fff1c9' : '#e6a383'; c.fillRect(x + 1, 7, 13 * chip, 5);
                }
            }
            if (b.phase === 'enrage') {
                const alpha = Math.min(1, b.phaseTime / 140, (b.enrageMs - b.phaseTime) / 160);
                c.save(); c.globalAlpha = Math.max(0, alpha);
                // Keep the moving player visible while the phase changes.
                pixelText(c, 'PRESSAO MAXIMA', 160, 16, '#ffcfb0', 1, 'center');
                pixelText(c, 'SAIA DAS MARCAS NO CHAO', 160, 25, '#e9d4ec', 1, 'center');
                c.restore();
            } else pixelText(c, this.boss!.hint, 160, 23, b.vulnerable ? '#ddef96' : '#d8cbd7', 1, 'center');
        }
        if (paused) {
            c.fillStyle = '#171324bb'; c.fillRect(0, 23, 320, 157);
            panel(c, 62, 70, 196, 43, '#292033', '#bfce64');
            pixelText(c, 'PAUSADO', 160, 79, '#edf292', 2, 'center');
            pixelText(c, 'ESC OU CONTINUAR', 160, 100, '#fff0cc', 1, 'center');
        } else if (b?.phase === 'defeated' && b.phaseTime >= 650) {
            c.save(); c.globalAlpha = Math.min(1, (b.phaseTime - 650) / 200);
            panel(c, 66, 62, 188, 34, '#292033', '#bfce64');
            pixelText(c, 'TURBOSUCO DERROTADO!', 160, 70, '#edf292', 1, 'center');
            pixelText(c, 'TENTE UMA NOVA LUTA', 160, 83, '#fff0cc', 1, 'center');
            c.restore();
        }
        this.renderer.present();
        const message = paused ? 'Pausado · Esc ou Continuar para voltar'
            : this.boss?.phase === 'defeated' ? 'Vitória! Use Tentar novamente para uma nova luta'
            : b?.phase === 'enrage' ? 'Fase 2 · Pressão máxima! Os gêiseres mostram um aviso dourado antes de subir.'
            : b?.vulnerable ? 'Abertura! Pule sobre o Turbosuco para atacar.'
            : b?.geysers.some(g => g.phase === 'warning') ? 'Saídas pressurizando! Saia das marcas douradas no chão.'
            : 'Setas / A D: mover · Espaço: pular · Shift: correr · Esc: pausa · M: som';
        if (this.status.textContent !== message) this.status.textContent = message;
    }
}
