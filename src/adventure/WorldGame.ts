import { importProgressFile, progressImportMessage } from './ProgressImport';
import { JournalAccessibility } from './JournalAccessibility';
import { campaignJournal } from './CampaignJournal';
import { CanvasMenuAccessibility } from './CanvasMenuAccessibility';
import { WorldControlsHelp } from './WorldControlsHelp';
import { advanceCampaignCamera } from './WorldCampaignCamera';
import { runGuairaFlight } from './WorldGuairaFlight';
import { ExperimentalHub } from './experimental/hub/ExperimentalHub';
import { Input } from '../engine/Input';
import { StandardGamepad, type GamepadMenuCommand } from '../engine/StandardGamepad';
import { DisposalScope } from '../engine/DisposalScope';
import { Renderer } from '../engine/Renderer';
import { Player } from '../entities/Player';
import { GroundPoundState, type CameraData, type InputState, type Rect } from '../types';
import { TileType as T, PLAYER_RESPAWN_REVEAL_MS } from '../constants';
import { DEATH_HIT_STOP_MS } from '../graphics/playerDeathMotion';
import { pixelText, panel, fitText, wrapText } from '../graphics/BitmapFont';
import { ART } from '../graphics/palette';
import { PLAYER_SPRITES, PLAYER_PALETTE } from '../assets/playerSpriteSpec';
import { YASMIN_FRAMES, SPRITE_PALETTE } from '../graphics/sprites';
import { ISLANDS, STAGES, stageById } from './campaign';
import { ProgressStore, isUnlocked, finishStage, isGuairaUnlocked, canContinueFromGuaira } from './progress';
import { WorldArt, rect } from './WorldArt';
import { drawWorldCheckpoint, drawWorldGoal } from './WorldCheckpointArt';
import { drawLandmarks } from './WorldScenery';
import { WorldAudio } from './WorldAudio';
import { combatSparks, type CombatCue, type WorldSpark } from './WorldCombatFeedback';
import { WorldLevel, WorldObjects, BELT_CARRY_SPEED } from './WorldPhysics';
import { WorldFoe } from './WorldEnemies';
import { BossEncounter } from './BossEncounter';
import { WorldTutorial } from './WorldTutorial';
import { bossFrame, WORLD_PALETTE } from './WorldAssets';
import { clamp, overlaps, type AdventureStage, type Dialogue } from './types';
import { WorldMapView, moveJourneySelection } from './WorldMapView';
import { clampMapSelection } from './WorldMapModel';
type Screen = 'title' | 'intro' | 'map' | 'playing' | 'paused' | 'dialogue' | 'clear' | 'ending' | 'gallery' | 'settings';
interface Button extends Rect {
    label: string;
    run: () => void;
    nativeActivation?: boolean;
}
interface FrozenMenuPaint {
    screen: Screen;
    selection: number;
    toast: string | null;
    music: number;
    effects: number;
    voice: number;
    shake: boolean;
    reducedMotion: boolean;
    cameraX: number;
    cameraY: number;
    cameraShake: boolean;
    time: number;
}
export class WorldGame {
    private readonly lifetime = new DisposalScope();
    private frame: number | null = null;
    private running = false;
    readonly renderer: Renderer;
    readonly input: Input;
    private gamepad?: StandardGamepad;
    readonly art = new WorldArt();
    readonly store: ProgressStore;
    readonly audio: WorldAudio;
    readonly tutorial: WorldTutorial;
    state: Screen = 'title';
    stage: AdventureStage = STAGES[0];
    level = new WorldLevel(STAGES[0].level);
    objects = new WorldObjects([]);
    player = new Player(3, 14);
    foes: WorldFoe[] = [];
    boss: BossEncounter | null = null;
    camera: CameraData = { x: 0, y: 0, targetX: 0, targetY: 0, shakeTimer: 0, shakeMagnitude: 0, bounds: { minX: 0, minY: 0, maxX: 2560, maxY: 368 } };
    time = 0;
    elapsed = 0;
    coins = 0;
    private recordEligible = true;
    private accumulator = 0;
    private last: number | null = null;
    private buttons: Button[] = [];
    private buttonsOwner = '';
    private menuAccessibility?: CanvasMenuAccessibility;
    private controlsHelp?: WorldControlsHelp;
    private journalAccessibility?: JournalAccessibility;
    private selection = 0;
    private menuSelection = 0;
    private checkpoint = -1;
    private checkpointHelmet = false;
    private checkpointActivatedAt: number | null = null;
    private collected = new Set<string>();
    private spoken = new Set<string>();
    private sparks: WorldSpark[] = [];
    private dialog: Dialogue | null = null;
    private dialogueTime = 0;
    private comment: Dialogue | null = null;
    private commentTimer = 0;
    private touch = typeof navigator !== 'undefined' && navigator.maxTouchPoints > 0;
    private clearTimer = 0;
    private hitStop = 0;
    private hitStopInput: Pick<InputState, 'jumpPressed' | 'jumpReleased' | 'downPressed'> | null = null;
    private clearSecret = false;
    private toast = '';
    private toastTimer = 0;
    private settingReturn: Screen = 'title';
    private pausedAudio = false;
    private introPage = 0;
    private galleryWorld = 0;
    private mapView?: WorldMapView;
    private flightCleanup?: () => void;
    private guairaArrivalPrompt = false;
    private mapReturn?: { playedStage: string; nextSelected: string };
    private nextMapSelection?: string;
    private mapCanvas: HTMLCanvasElement;
    private saveImportCleanup?: () => void;
    private deathFeedbackStarted = false;
    private experimentalHub?: ExperimentalHub;
    private frozenMenuOwner?: () => boolean;
    private frozenMenuMotion: MediaQueryList | null = null;
    private frozenMenuPaint: FrozenMenuPaint | null = null;
    private frozenMenuSave: ProgressStore['save'] | null = null;
    private frozenMenuPreferences: ProgressStore['save']['preferences'] | null = null;
    constructor(canvas: HTMLCanvasElement, private readonly ephemeral = false) {
        this.mapCanvas = canvas;
        try {
            this.renderer = new Renderer(canvas);
            this.addCleanup(() => this.renderer.dispose());
            // Mount the modal's capture boundary before gameplay Input.
            if (!ephemeral && typeof document.body?.append === 'function') {
                this.controlsHelp = new WorldControlsHelp(canvas, {
                    canOpen: () => !this.isDisposed && this.state === 'settings',
                    resetInput: () => this.input?.reset(),
                    suspendTouch: () => this.input.suspendCanvasTouchControls(),
                    onOpenChange: () => this.invalidateFrozenMenuPaint(),
                });
                this.addCleanup(() => this.controlsHelp?.dispose());
            }
            this.input = new Input(canvas);
            this.addCleanup(() => this.input.dispose());
            document.title = ephemeral ? 'Super Feka Gaps World · Estúdio' : 'Super Feka Gaps World';
            let storage: Storage | null = null;
            try {
                storage = ephemeral ? null : localStorage;
            }
            catch { }
            this.store = new ProgressStore(storage, ephemeral ? false : undefined);
            this.tutorial = new WorldTutorial(this.store);
            this.audio = new WorldAudio(this.store.save.preferences);
            if (!ephemeral && typeof document.body?.append === 'function') {
                this.journalAccessibility = new JournalAccessibility(canvas);
                this.addCleanup(() => this.journalAccessibility?.dispose());
                this.menuAccessibility = new CanvasMenuAccessibility(canvas, {
                    select: index => { this.menuSelection = index; },
                    activate: index => { this.audio.unlock(); this.buttons[index]?.run(); },
                    escape: () => { this.audio.unlock(); this.backMenu(); },
                    resetInput: () => this.input.reset(),
                });
                this.addCleanup(() => this.menuAccessibility?.dispose());
            }
            this.addCleanup(() => this.audio.dispose());
            this.addCleanup(() => this.saveImportCleanup?.());
            this.addCleanup(() => { this.mapView?.dispose(); this.mapView = undefined; });
            this.selection = Math.max(0, STAGES.findIndex(s => s.id === this.store.save.selected));
            this.listen(window, 'keydown', e => this.menuKey(e));
            this.listen(canvas, 'pointerdown', e => {
                if (this.experimentalHub?.isOpen || this.controlsHelp?.isOpen) return;
                this.audio.unlock();
                const r = canvas.getBoundingClientRect();
                if (this.state === 'playing') {
                    if ((e.clientY - r.top) * 180 / r.height < 23)
                        this.pause();
                    return;
                }
                const x = (e.clientX - r.left) * 320 / r.width, y = (e.clientY - r.top) * 180 / r.height;
                const hit = this.buttons.find(b => x >= b.x && x <= b.x + b.width && y >= b.y && y <= b.y + b.height);
                hit?.run();
            });
            this.listen(window, 'blur', () => {
                if (this.state === 'playing') this.pause();
            });
            this.listen(document, 'visibilitychange', () => {
                this.invalidateFrozenMenuPaint();
                if (document.hidden) {
                    if (this.state === 'playing') this.pause();
                    this.cancelFrame();
                } else this.requestFrame();
            });
            (window as unknown as {
                worldGame: WorldGame;
            }).worldGame = this;
        } catch (error) { this.dispose(); throw error; }
    }
    /** Main entry only: optional scenes retain their existing input owners. */
    enableGamepadControls(): void {
        if (this.isDisposed || this.gamepad) return;
        const gamepad = this.gamepad = new StandardGamepad(this.input);
        this.addCleanup(() => { gamepad.dispose(); this.gamepad = undefined; });
    }
    /** Opt-in only from the main entry. Labs/editor never mount title navigation. */
    enableExperimentalHub(search = ''): void {
        if (this.ephemeral || this.isDisposed) return;
        if (!this.experimentalHub) {
            this.experimentalHub = new ExperimentalHub(this.mapCanvas, { input: this.input, isTitle: () => this.state === 'title' });
            this.addCleanup(() => { this.experimentalHub?.dispose(); this.experimentalHub = undefined; });
        }
        this.experimentalHub.openFromSearch(search);
        if (new URLSearchParams(search).get('guairaReturn') === '1') {
            this.audio.enabled = this.store.save.guaira.audioEnabled; this.audio.volume(); this.toMap();
        }
    }
    get isDisposed(): boolean { return this.lifetime?.isDisposed ?? false; }
    /** Own subclass/host resources without overriding terminal disposal. */
    addCleanup(cleanup: () => void): () => void { return this.lifetime.add(cleanup); }
    protected readonly listen = this.lifetime.listen.bind(this.lifetime);
    /** Explicitly opt in only an owner of the complete ordinary campaign canvas.
     * Labs/editor and hosts that compose their own overlays retain full rendering.
     * WorldArt is synchronous; asynchronous map/salon artwork never uses this cache.
     */
    protected enableFrozenMenuPaint(ownsCanvas: () => boolean): void {
        if (this.isDisposed || this.frozenMenuOwner) return;
        this.frozenMenuOwner = ownsCanvas;
        this.frozenMenuMotion = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : null;
        // Renderer resets the backing canvas even when its dimensions are unchanged.
        this.listen(window, 'resize', () => this.invalidateFrozenMenuPaint());
        this.listen(this.mapCanvas, 'contextrestored', () => this.invalidateFrozenMenuPaint());
        this.addCleanup(() => {
            this.frozenMenuOwner = undefined; this.frozenMenuMotion = null;
            this.invalidateFrozenMenuPaint();
        });
    }
    protected invalidateFrozenMenuPaint(): void {
        this.frozenMenuPaint = null; this.frozenMenuSave = null; this.frozenMenuPreferences = null;
    }
    dispose(): void {
        if (this.isDisposed) return;
        this.running = false;
        this.cancelFrame();
        this.accumulator = 0; this.buttons = []; this.hitStopInput = null;
        this.level.blockImpacts.clear();
        this.flightCleanup?.();
        this.lifetime.dispose();
        const globals = window as unknown as { worldGame?: WorldGame };
        if (globals.worldGame === this) delete globals.worldGame;
    }
    start(): void {
        if (this.isDisposed || this.running) return;
        if (document.hidden && this.state === 'playing') this.pause();
        this.running = true; this.last = document.hidden ? null : performance.now();
        this.requestFrame();
    }
    private cancelFrame(): void {
        if (this.frame !== null) cancelAnimationFrame(this.frame);
        this.frame = null; this.last = null;
    }
    private requestFrame(): void {
        if (this.isDisposed || !this.running || document.hidden || this.frame !== null) return;
        const frame = requestAnimationFrame(now => {
            // A canceled callback must not consume or fork a newer visible chain.
            if (this.frame !== frame) return;
            this.frame = null;
            this.loop(now);
        });
        this.frame = frame;
    }
    private loop = (now: number) => {
        if (this.isDisposed || !this.running) return;
        if (document.hidden) { this.cancelFrame(); return; }
        // Retain the fixed-step remainder, but never add time spent hidden.
        const dt = this.last === null ? 0 : Math.min(100, now - this.last);
        this.last = now;
        this.accumulator += dt;
        while (!this.isDisposed && !document.hidden && this.accumulator >= 1000 / 60) {
            this.update(1000 / 60);
            this.accumulator -= 1000 / 60;
        }
        if (this.isDisposed || document.hidden) return;
        this.renderer.setFrameInterpolation(this.state === 'playing' ? this.accumulator : 0);
        this.render();
        this.requestFrame();
    };
    private change(screen: Screen) { if (this.isDisposed) return; this.invalidateFrozenMenuPaint(); this.controlsHelp?.close(false); this.menuAccessibility?.clear(); this.journalAccessibility?.clear(); if (screen !== 'map') this.mapView?.hide(); this.state = screen; this.hitStopInput = null; this.input.reset(); this.input.setMenuMode(screen !== 'playing'); this.menuSelection = 0; this.buttons = []; this.experimentalHub?.sync(); }
    private menuKey(e: KeyboardEvent) {
        if (e.ctrlKey || e.metaKey || e.altKey) return;
        if (this.experimentalHub?.isOpen || this.controlsHelp?.isOpen || this.flightCleanup) return;
        const target = e.target;
        if (target instanceof HTMLElement && target.closest('button, a[href]') && (e.key === 'Enter' || e.key === ' ')) return;
        if (target instanceof HTMLElement && target.closest('.world-map, .canvas-menu-accessibility')) return;
        if (target instanceof HTMLElement && target.id !== 'game-canvas' && (target.matches('input,textarea,select') || target.isContentEditable))
            return;
        if (this.state === 'playing')
            return;
        if (!['Enter', ' ', 'Escape', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', 'a', 'd', 'w', 's'].includes(e.key) || e.repeat)
            return;
        e.preventDefault();
        this.audio.unlock();
        if (this.state === 'map') {
            const next = moveJourneySelection(this.selection, e.key);
            if (next !== this.selection) this.selectMap(next);
            if (e.key === 'Enter' || e.key === ' ')
                this.enterSelected();
            if (e.key === 'Escape')
                this.change('title');
            return;
        }
        if (e.key === 'Escape') { this.backMenu(); return; }
        if (e.key === 'ArrowDown' || e.key === 's')
            this.menuSelection = (this.menuSelection + 1) % Math.max(1, this.buttons.length);
        else if (e.key === 'ArrowUp' || e.key === 'w')
            this.menuSelection = (this.menuSelection + this.buttons.length - 1) % Math.max(1, this.buttons.length);
        else if (e.key === 'Enter' || e.key === ' ')
            this.buttons[this.menuSelection]?.run();
    }
    private backMenu(): void {
        if (this.state === 'paused') this.resume();
        else if (this.state === 'settings') this.closeSettings();
        else if (this.state === 'dialogue') this.closeDialogue();
        else if (this.state === 'gallery') this.backGallery();
        else this.toMap();
    }
    private menuIdentity(): string {
        return `${this.state}:${this.state === 'intro' ? this.introPage : this.state === 'gallery' ? this.galleryWorld : 0}`;
    }
    private controllerMenuOwner(): string | null {
        if (this.state === 'playing' || this.state === 'dialogue' || this.mapCanvas.inert) return null;
        if (this.state === 'map') {
            const owner = this.mapView?.controllerOwner();
            return owner ? `map:${owner}` : null;
        }
        return document.activeElement === this.mapCanvas || this.menuAccessibility?.canControl() ? this.menuIdentity() : null;
    }
    private controllerMenu(command: GamepadMenuCommand, owner: string): void {
        // Re-check the live owner, never dispatch to an earlier rendered page.
        if (owner !== this.controllerMenuOwner()) return;
        if (this.state === 'map') { this.mapView?.control(command); return; }
        if (command === 'pause') { if (this.state === 'paused') this.resume(); return; }
        if (command === 'back') { if (this.state !== 'title') this.backMenu(); return; }
        if (this.buttonsOwner !== this.menuIdentity() || !this.menuAccessibility?.canControl()) return;
        if (command === 'confirm') {
            const button = this.buttons[this.menuSelection];
            if (!button || !this.menuAccessibility.focusFromController(this.menuSelection)) return;
            if (button.nativeActivation) {
                this.toast = 'Use Enter ou toque neste botão.'; this.toastTimer = 3500;
                return;
            }
            this.audio.unlock(); button.run();
        } else if (['up', 'down', 'left', 'right'].includes(command) && this.buttons.length) {
            const direction = command === 'up' || command === 'left' ? -1 : 1;
            const next = (this.menuSelection + direction + this.buttons.length) % this.buttons.length;
            this.menuAccessibility.focusFromController(next);
        }
    }
    private updateController(): boolean {
        const gamepad = this.gamepad;
        if (!gamepad) return false;
        if (this.experimentalHub?.isOpen || this.controlsHelp?.isOpen || this.flightCleanup || this.saveImportCleanup
            || document.querySelector?.('dialog[open]')) {
            gamepad.update('inactive'); return false;
        }
        if (this.state === 'playing') {
            if (gamepad.update('playing')) { this.pause(); return true; }
            return false;
        }
        const owner = this.controllerMenuOwner(), command = gamepad.updateMenu(owner);
        if (command && owner) {
            this.controllerMenu(command, owner);
            // Focus/repeat and ignored buttons must not steal simulation/audio time.
            // Only an actual owner handoff ends this fixed step early.
            return owner !== this.controllerMenuOwner();
        }
        return false;
    }
    private begin() {
        this.audio.unlock();
        if (!this.store.save.seen.includes('opening')) {
            this.introPage = 0;
            this.change('intro');
            this.audio.select(1);
            this.audio.say('feka', 'Yasmin precisa de mim. É hora de uma grande aventura!');
        }
        else
            this.toMap();
    }
    private nextIntro() {
        if (++this.introPage >= 2) {
            this.store.save.seen.push('opening');
            this.store.persist();
            this.toMap();
        }
        else
            this.audio.say('joao', 'Aqui é o João, namorado da Yasmin.', 'aqui_e_o_joao_namorado_da_yasmin');
    }
    private selectMap(index: number) {
        this.selection = clampMapSelection(index);
        this.mapView?.selectDestination(this.selection);
        this.audio.sfx('coin');
    }
    private enterSelected() {
        const s = STAGES[this.selection];
        if (!isUnlocked(s.id, this.store.save)) {
            this.toast = 'Conclua o caminho anterior.';
            this.toastTimer = 2000;
            return;
        }
        // The old canvas/global shortcut must obey the same arrival gate as the HUD.
        this.mapView?.enterSelected(this.selection);
    }
    /** Loads authored campaign data. Public for the in-repo editor and deterministic browser QA. */
    load(id: string, resume = false, custom?: AdventureStage) {
        if (this.isDisposed) return;
        const stage = custom ?? stageById(id);
        if (!stage)
            throw Error('Fase não encontrada');
        this.stage = stage;
        this.nextMapSelection = undefined;
        this.level = new WorldLevel(stage.level);
        this.objects = new WorldObjects(stage.mechanisms);
        this.level.bodies = this.objects.bodies;
        this.toastTimer = 0;
        this.foes = stage.foes.map(f => new WorldFoe(f));
        this.boss = stage.encounter ? new BossEncounter(stage.encounter) : null;
        this.sparks = [];
        this.hitStop = 0;
        this.collected = new Set();
        this.spoken = new Set();
        this.dialog = null;
        this.comment = null;
        this.commentTimer = 0;
        this.tutorial.resetAttempt();
        this.checkpoint = -1;
        this.checkpointHelmet = false;
        this.checkpointActivatedAt = null;
        this.elapsed = 0;
        this.coins = 0;
        this.recordEligible = true;
        this.store.save.selected = stage.id;
        const saved = resume && this.store.save.checkpoint?.stage === stage.id ? this.store.save.checkpoint : null;
        if (!saved)
            this.store.save.checkpoint = null;
        if (saved && stage.checkpoints[saved.index]) {
            // Version-1 checkpoints contain no complete run clock. A resumed segment
            // may unlock the route, but must never replace a full-stage record.
            this.recordEligible = false;
            this.checkpoint = saved.index;
            this.checkpointHelmet = saved.helmet;
        }
        const spawn = this.checkpoint >= 0 ? stage.checkpoints[this.checkpoint] : stage.level.playerSpawn;
        this.player = new Player(spawn.x, spawn.y);
        this.deathFeedbackStarted = false;
        this.audio.setDying(false);
        this.player.data.hasHelmet = this.checkpointHelmet;
        this.camera.bounds = this.level.getBounds();
        this.camera.x = clamp(this.player.data.position.x - 100, 0, Math.max(0, this.level.data.width * 16 - 320));
        this.camera.y = clamp(this.player.data.position.y - 112, 0, this.level.data.height * 16 - 180);
        if (this.boss) {
            this.camera.x = 0;
            this.camera.y = 64;
        }
        this.change('playing');
        this.audio.pause(false);
        this.audio.select(stage.world, !!this.boss, stage.id);
        if (this.requiresCampaignPassage())
            this.showCampaignNotice('SALÃO: APRESENTE-SE PARA SEGUIR', 4500);
        if (stage.encounter)
            for (const d of stage.dialogues)
                this.spoken.add(d.id);
        if (stage.encounter && !this.store.save.seen.includes(`intro:${stage.id}`) && stage.dialogues[0] && !this.store.save.seen.includes(`dialogue:${stage.dialogues[0].id}`)) {
            this.showDialogue(stage.dialogues[0]);
        }
    }
    private toMap() {
        const fromGameplay = ['playing', 'paused', 'dialogue', 'clear'].includes(this.state);
        if (fromGameplay) {
            const playedStage = this.stage.id;
            this.store.save.selected = playedStage;
            this.mapReturn = { playedStage, nextSelected: this.state === 'clear' ? this.nextMapSelection ?? playedStage : playedStage };
        }
        this.audio.cancelSpeech(); this.audio.setDying(false); this.audio.pause(false); this.change('map');
        this.selection = Math.max(0, STAGES.findIndex(s => s.id === (this.mapReturn?.nextSelected ?? this.store.save.selected)));
        this.nextMapSelection = undefined;
        this.audio.select(0); this.store.persist();
    }
    /** Only a host with the real salon can require its story action. Editor previews stay playable. */
    protected requiresCampaignPassage(): boolean { return false; }
    protected showCampaignNotice(text: string, duration = 3500): void {
        this.toast = text; this.toastTimer = duration;
    }
    protected pause() { if (this.isDisposed) return; this.change('paused'); this.audio.pause(true); }
    protected resume() { if (this.isDisposed) return; this.change('playing'); this.audio.pause(false); }
    private showDialogue(d: Dialogue) { this.dialog = d; this.dialogueTime = 0; this.spoken.add(d.id); this.change('dialogue'); this.audio.say(d.speaker, d.text, d.clip); }
    private closeDialogue() {
        if (this.dialog && this.dialogueTime < this.dialog.text.length * 34) {
            this.dialogueTime = 10000;
            this.audio.cancelSpeech();
            return;
        }
        if (this.dialog) {
            this.store.markSeen(`dialogue:${this.dialog.id}`);
            if (this.stage.encounter)
                this.store.markSeen(`intro:${this.stage.id}`);
        }
        this.dialog = null;
        this.audio.cancelSpeech();
        this.change('playing');
    }
    private queueComment(d: Dialogue) {
        this.spoken.add(d.id);
        this.comment = d;
        this.commentTimer = 0;
    }
    private updateComment(dt: number) {
        if (!this.comment || this.toastTimer > 0 || this.tutorial.cue(this.stage, this.player.data, this.touch))
            return;
        if (this.commentTimer === 0) {
            this.store.markSeen(`dialogue:${this.comment.id}`);
            this.audio.say(this.comment.speaker, this.comment.text, this.comment.clip);
        }
        this.commentTimer += dt;
        if (this.commentTimer >= Math.max(2600, this.comment.text.length * 65))
            this.comment = null;
    }
    private particle(x: number, y: number, color: string, count = 9) {
        for (let i = 0; i < count; i++) {
            const angle = i / count * Math.PI * 2;
            this.sparks.push({ x, y, vx: Math.cos(angle) * 1.6, vy: Math.sin(angle) * 1.6 - 1.5, life: 450 + i % 3 * 70, color });
        }
    }
    private combatFeedback(kind: CombatCue, x: number, y: number) {
        this.audio.sfx(kind);
        this.sparks.push(...combatSparks(kind, x, y));
    }
    private hurt(sourceX?: number) {
        if (this.player.data.invincibleTimer > 0 || this.player.data.miniFantaTimer > 0 || this.player.data.isDead)
            return;
        const result = this.player.takeDamage();
        if (result.damaged) {
            this.audio.sfx('hit');
            this.player.die('hit', sourceX);
            this.beginDeathFeedback();
        }
        else if (result.helmetUsed)
            this.combatFeedback('helmetLoss', this.player.getCenter().x, this.player.data.position.y + 3);
    }
    private beginDeathFeedback() {
        this.hitStopInput = null;
        if (this.deathFeedbackStarted)
            return;
        this.deathFeedbackStarted = true;
        this.audio.cancelSpeech();
        this.audio.setDying(true);
        this.audio.sfx(this.player.data.deathKind === 'fall' ? 'fall' : 'death');
    }
    private restart() {
        const index = this.checkpoint, helmet = this.checkpointHelmet, elapsed = this.elapsed, coins = this.coins;
        const recordEligible = this.recordEligible;
        // Coins belong to this run; equipment can respawn so retries remain playable.
        const collectedCoins = new Set(this.stage.pickups
            .filter(item => item.kind === 'coin' && this.collected.has(item.id)).map(item => item.id));
        if (index >= 0)
            this.store.save.checkpoint = { stage: this.stage.id, index, helmet };
        else
            this.store.save.checkpoint = null;
        this.load(this.stage.id, true, this.stage);
        this.elapsed = elapsed;
        this.coins = coins;
        this.collected = collectedCoins;
        this.recordEligible = recordEligible;
        this.player.data.invincibleTimer = 1500;
        this.player.data.respawnRevealTimer = PLAYER_RESPAWN_REVEAL_MS;
    }
    update(dt: number) {
        if (this.isDisposed) return;
        if (this.experimentalHub?.isOpen || this.controlsHelp?.isOpen) {
            this.gamepad?.update('inactive'); this.input.reset(); return;
        }
        if (this.updateController()) return;
        this.input.setMenuMode(this.state !== 'playing');
        this.input.update();
        if (this.input.consumeMute())
            this.audio.toggle();
        const frozen = this.state === 'paused' || this.state === 'settings';
        if (!frozen) {
            this.time += dt;
            this.renderer.advanceClock(dt);
        }
        this.audio.tick(dt);
        this.toastTimer = Math.max(0, this.toastTimer - dt);
        if (this.state === 'dialogue') {
            this.dialogueTime += dt;
            return;
        }
        if (this.state === 'clear') {
            this.clearTimer += dt;
            return;
        }
        if (this.state !== 'playing')
            return;
        if (this.input.consumePause()) {
            this.pause();
            return;
        }
        if (this.hitStop > 0) {
            // Input still advances so pause/mute remain immediate. Keep gameplay
            // edges until simulation resumes, but sample held controls fresh.
            if (!this.player.data.isDead && this.boss?.phase !== 'defeated' && !((this.player.data.respawnRevealTimer ?? 0) > 0)) {
                const input = this.input.getState();
                this.hitStopInput = {
                    jumpPressed: input.jumpPressed || !!this.hitStopInput?.jumpPressed,
                    jumpReleased: input.jumpReleased || !!this.hitStopInput?.jumpReleased,
                    downPressed: input.downPressed || !!this.hitStopInput?.downPressed
                };
            } else this.hitStopInput = null;
            this.hitStop = Math.max(0, this.hitStop - dt);
            return;
        }
        if(this.boss?.phase==='defeated') {
            this.hitStopInput = null;
            this.level.updateDynamicTiles(dt);
            this.player.update(dt,{...this.input.getState(),left:false,right:false,run:false,jump:false,jumpPressed:false,jumpReleased:false,down:false,downPressed:false},this.level);
            this.boss.update(dt,this.player.getRect(),this.objects,this.level);
            this.updateSparks(dt);
            if(this.boss.timer>1150)this.complete(false);
            return;
        }
        this.elapsed += dt / 1000;
        this.camera.shakeTimer = Math.max(0, this.camera.shakeTimer - dt);
        if (this.player.data.isDead) {
            this.beginDeathFeedback();
            this.player.advanceDeath(dt);
            if (this.player.data.deathTimerMax - this.player.data.deathTimer >= DEATH_HIT_STOP_MS) {
                this.updateSparks(dt);
                this.level.blockImpacts.update(dt);
            }
            if (this.player.data.deathTimer <= 0)
                this.restart();
            return;
        }
        if ((this.player.data.respawnRevealTimer ?? 0) > 0) {
            this.hitStopInput = null;
            this.player.update(dt, this.input.getState(), this.level);
            return;
        }
        const previous = this.player.getRect(), beforeV = this.player.data.velocity.y, wasGrounded = this.player.data.isGrounded;
        this.level.clearFallingPlatformTouches();
        this.level.updateDynamicTiles(dt);
        this.objects.update(dt, this.level, previous.x);
        if (this.player.data.isGrounded) {
            this.player.data.position = this.level.transport(previous);
            const belt = this.level.beltAt(this.player.getRect());
            if (belt) {
                const dx = (belt.direction ?? 1) * (belt.active ? -1 : 1) * BELT_CARRY_SPEED;
                this.player.data.position = this.level.resolveCollision(this.player.getRect(), { x: dx, y: 0 }, this.player.getRect()).position;
            }
        }
        const input = this.input.getState();
        if (this.hitStopInput) {
            input.jumpPressed ||= this.hitStopInput.jumpPressed;
            input.jumpReleased ||= this.hitStopInput.jumpReleased;
            input.downPressed ||= this.hitStopInput.downPressed;
            this.hitStopInput = null;
        }
        const result = this.player.update(dt, input, this.level);
        let switchActivated = false;
        if (!wasGrounded && this.player.data.isGrounded && beforeV > 4) {
            this.particle(this.player.data.position.x + 7, this.player.data.position.y + this.player.data.height, '#d6ccb0', 5);
            this.audio.sfx('land');
        }
        if (this.player.data.isDead) {
            this.beginDeathFeedback();
            return;
        }
        if (beforeV >= 0 && this.player.data.velocity.y < 0 && input.jumpPressed)
            this.audio.sfx('jump');
        if (result.groundPoundImpact) {
            const p = result.groundPoundImpact;
            switchActivated = this.objects.pound(p.x, p.y);
            this.renderer.addImpact(p.x, p.y, 'pound');
            this.camera.shakeTimer = 130;
            this.audio.sfx('pound');
            this.particle(p.x, p.y, '#ecc78e');
            for (let col = p.col - 1; col <= p.col + 1; col++)
                if (this.level.getTile(col - this.level.originX, p.row - this.level.originY) === T.BRICK_BREAKABLE)
                    this.level.breakTile(col - this.level.originX, p.row - this.level.originY, false, 'down');
        }
        if (result.tileHit?.side === 'top') {
            const h = result.tileHit;
            if (h.type === T.BRICK_BREAKABLE) {
                this.level.breakTile(h.col - this.level.originX, h.row - this.level.originY);
                this.audio.sfx('break');
            } else if (h.type === T.BRICK) {
                this.level.bumpTile(h.col - this.level.originX, h.row - this.level.originY);
            }
        }
        const p = this.player.getRect();
        if (this.player.data.isGrounded) {
            const c = this.level.worldToCol(p.x + p.width / 2), r = this.level.worldToRow(p.y + p.height + 1);
            if (this.level.getTile(c, r) === T.PLATFORM_FALLING)
                this.level.markFallingPlatformContact(c, r);
        }
        this.level.updateFallingPlatforms(dt);
        const bossPhase = this.boss?.phase;
        const shockWarning = this.boss?.shockWarning;
        this.boss?.update(dt, p, this.objects, this.level);
        if (this.boss?.phase === 'warning' && bossPhase !== 'warning' || this.boss?.shockWarning && !shockWarning)
            this.audio.sfx('warning');
        if (this.boss?.released) this.audio.sfx('throw');
        if (this.level.checkSpikeCollision(p) || this.level.checkLavaCollision(p))
            this.hurt();
        for (const b of this.objects.bodies) {
            if (b.kind !== 'jet') continue;
            const danger = this.objects.jetDanger(b);
            if (danger && overlaps(p, danger)) this.hurt(b.x + b.width / 2);
        }
        for (const b of this.objects.barrels)
            if (b.life > 0 && overlaps(p, b))
                this.hurt(b.x + b.width / 2);
        if (this.player.data.isDead)
            return;
        for (const event of this.objects.events) {
            this.audio.sfx(event.kind);
            // Machine mist and flashes are drawn on the simulation clock.
            if (['warning', 'pressure', 'jet', 'cannon'].includes(event.kind)) continue;
            this.particle(event.x, event.y, event.kind === 'barrelLand' ? '#b9b9b4' : event.kind === 'switch' ? '#d8df98' : '#d8b4ed', event.kind === 'barrelLand' ? 3 : 9);
        }
        const falling = this.player.data.velocity.y > 0 || beforeV > 0, pound = this.player.data.groundPoundState === GroundPoundState.FALL;
        for (const enemy of this.foes) {
            if (Math.abs(enemy.x - p.x) > 500)
                continue;
            const phase = enemy.phase;
            enemy.update(dt, this.level, this.objects, p);
            if (enemy.phase === 'warning' && phase !== 'warning' && Math.abs(enemy.x - p.x) < 200)
                this.audio.sfx('warning');
            if (enemy.phase === 'recoil' && phase !== 'recoil') this.audio.sfx('throw');
            const contact = enemy.contact(p, previous, falling, pound);
            if (contact === 'hurt')
                this.hurt(enemy.x + enemy.width / 2);
            else if (contact === 'bounce' || contact === 'kill') {
                this.bounce(enemy.y);
                if (contact === 'bounce' && enemy.phase === 'stunned') {
                    this.audio.sfx('break');
                    this.particle(enemy.x, enemy.y, '#eec478', 7);
                }
                else if (contact === 'bounce')
                    this.combatFeedback('blockedStomp', this.player.getCenter().x, enemy.y);
                if (contact === 'kill') {
                    this.particle(enemy.x, enemy.y, '#ee9c83');
                    this.audio.sfx('hit');
                }
            }
            if (this.player.data.isDead)
                return;
        }
        if (this.boss) {
            if (this.boss.impact) {
                this.camera.shakeTimer = 200;
                this.audio.sfx('pound');
                this.renderer.addImpact(this.boss.impactPoint.x, this.boss.impactPoint.y, 'boss');
            }
            if (this.boss.danger && overlaps(p, this.boss.danger))
                this.hurt(this.boss.danger.x + this.boss.danger.width / 2);
            if (this.player.data.isDead)
                return;
            const contact = this.boss.contact(p, previous, falling);
            if (contact === 'hurt')
                this.hurt(this.boss.x + this.boss.width / 2);
            else if (contact !== 'none') {
                this.bounce(this.boss.y);
                if (contact === 'hit' || contact === 'defeated') {
                    this.particle(this.boss.x, this.boss.y, '#f6d893', 16);
                    this.audio.sfx('hit');
                    this.hitStop = 70;
                    this.camera.shakeTimer = 180;
                    if (this.boss.character === 'joao')
                        this.audio.say('joao', 'Porra nenhuma.', 'porra_nenhuma');
                }
                if (contact === 'defeated') {
                    this.objects.barrels = [];
                    this.particle(this.boss.x + 15, this.boss.y + 12, '#eecb8e', 24);
                }
            }
        }
        if (this.player.data.isDead)
            return;
        this.tutorial.observe(this.player.data, previous, input, result.jumpStarted === true, switchActivated);
        for (const item of this.stage.pickups) {
            if (this.collected.has(item.id) || item.kind === 'seal' && this.store.save.seals.includes(item.id))
                continue;
            if (overlaps(p, { x: item.x, y: item.y, width: 16, height: 18 })) {
                this.collected.add(item.id);
                if (item.kind === 'seal') {
                    this.store.collect(item.id);
                    this.audio.sfx('seal');
                    this.particle(item.x, item.y, '#ffe1a1', 14);
                }
                else if (item.kind === 'helmet') {
                    this.player.collectHelmet();
                    this.audio.sfx('checkpoint');
                }
                else if (item.kind === 'fanta') {
                    this.player.collectMiniFanta();
                    this.audio.sfx('seal');
                }
                else {
                    this.coins++;
                    this.audio.sfx('coin');
                    this.particle(item.x, item.y, '#f5cf82', 4);
                }
            }
        }
        this.stage.checkpoints.forEach((cp, i) => {
            if (i > this.checkpoint && Math.abs(p.x - cp.x * 16) < 20 && Math.abs(p.y + p.height - cp.y * 16) < 24) {
                this.checkpoint = i;
                this.checkpointActivatedAt = this.time;
                this.checkpointHelmet = this.player.data.hasHelmet;
                this.store.save.checkpoint = { stage: this.stage.id, index: i, helmet: this.checkpointHelmet };
                const saved = this.store.persist();
                this.audio.sfx('checkpoint');
                if (!this.boss) {
                    this.toast = this.ephemeral ? 'PONTO SEGURO NESTA TENTATIVA'
                        : saved ? 'CAMINHO GUARDADO' : 'PONTO SEGURO SÓ NESTA SESSÃO';
                    this.toastTimer = !this.ephemeral && !saved ? 4000 : 1500;
                }
            }
        });
        for (const exit of this.stage.exits)
            if (overlaps(p, exit) && (!exit.requires || this.objects.get(exit.requires)?.active)) {
                if (this.requiresCampaignPassage()) {
                    this.showCampaignNotice('APRESENTE-SE NO SALÃO ←');
                    continue;
                }
                this.complete(exit.id === 'secret');
                return;
            }
        for (const d of this.stage.dialogues)
            if (!this.spoken.has(d.id) && !this.store.save.seen.includes(`dialogue:${d.id}`) && Math.abs(p.x - d.x) < 22 && this.player.data.isGrounded) {
                if (d.presentation === 'comment')
                    this.queueComment(d);
                else
                    this.showDialogue(d);
                break;
            }
        if (this.state === 'playing')
            this.updateComment(dt);
        if (!this.boss)
            advanceCampaignCamera(this.camera, { position: p, velocity: this.player.data.velocity, isGrounded: this.player.data.isGrounded }, this.level.data);
        this.updateSparks(dt);
    }
    protected updateSparks(dt: number) {
        for (const s of this.sparks) {
            s.life -= dt;
            s.x += s.vx;
            s.y += s.vy;
            s.vy += .055;
        }
        this.sparks = this.sparks.filter(s => s.life > 0);
    }
    private bounce(y: number) { if (this.player.data.isDead)
        return; this.player.data.position.y = y - this.player.data.height; this.player.data.velocity.y = -7; this.player.data.isGrounded = false; this.player.data.groundPoundState = GroundPoundState.NONE; this.player.data.invincibleTimer = Math.max(150, this.player.data.invincibleTimer); }
    private complete(secret: boolean) {
        finishStage(this.store.save, this.stage.id, secret ? 'secret' : 'normal', this.recordEligible ? this.elapsed : null);
        this.nextMapSelection = this.store.save.selected;
        // Unlock the next stage now, but save only the place Feka has reached.
        this.store.save.selected = this.stage.id;
        this.store.persist(); this.clearSecret = secret; this.clearTimer = 0; this.change('clear'); this.audio.sfx('victory');
    }
    private afterClear() {
        if (this.stage.id === '3-5' && !canContinueFromGuaira(this.store.save)) {
            this.nextMapSelection = '3-5'; this.toMap(); this.guairaArrivalPrompt = true; return;
        }
        if (this.stage.id === '6-5') {
            this.change('ending');
            this.audio.select(6);
            this.audio.say('feka', 'Uma vitória e tanto!');
        }
        else
            this.toMap();
    }
    private button(c: CanvasRenderingContext2D, label: string, x: number, y: number, w: number, run: () => void, accent = ART.goldLight, nativeActivation = false) { const selected = this.buttons.length === this.menuSelection; panel(c, x, y, w, 17, selected ? '#334b62' : '#202d43', selected ? accent : '#637888'); pixelText(c, fitText(label, w - 10), x + w / 2, y + 5, selected ? accent : ART.paper, 1, 'center'); this.buttons.push({ label, x, y, width: w, height: 17, run, nativeActivation }); }
    private heading(c: CanvasRenderingContext2D, small: string, big: string) { pixelText(c, small, 160, 12, '#c4d7d8', 1, 'center'); pixelText(c, big, 161, 29, '#343651', 2, 'center'); pixelText(c, big, 160, 27, '#ffdf94', 2, 'center'); }
    private text(c: CanvasRenderingContext2D, text: string, x: number, y: number, width: number, color: string = ART.paper) { wrapText(text, width).forEach((line, i) => pixelText(c, line, x, y + i * 10, color)); }
    render() {
        if (this.isDisposed || this.controlsHelp?.isOpen) return;
        this.experimentalHub?.sync();
        this.journalAccessibility?.sync(this.state === 'gallery' && !this.experimentalHub?.isOpen && !this.flightCleanup ? this.galleryWorld : null, this.store.save);
        if (this.state === 'map') {
            this.menuAccessibility?.clear({ restoreFocus: false });
            if (typeof document !== 'undefined' && document.hidden) return;
            this.buttons = [];
            this.mapView ??= new WorldMapView(this.mapCanvas, {
                guaira: from => {
                    if (this.isDisposed || this.state !== 'map' || this.flightCleanup || !isGuairaUnlocked(this.store.save)) return;
                    this.audio.pause(true);
                    this.flightCleanup = runGuairaFlight({ from, to: 'guaira', preferences: this.store.save.preferences, soundEnabled: this.audio.enabled,
                        onCancel: () => { this.flightCleanup = undefined; this.audio.pause(false); },
                        onArrive: () => {
                            this.store.save.guaira.audioEnabled = this.audio.enabled;
                            if (!this.store.persist()) return false;
                            this.flightCleanup = undefined; location.assign('./guaira-capitulo.html?campaign=1'); return true;
                        },
                    });
                },
                select: index => { if (!this.isDisposed && this.state === 'map') this.selectMap(index); },
                enter: () => { if (!this.isDisposed && this.state === 'map') this.load(STAGES[this.selection].id, true); },
                arrive: index => {
                    const id = STAGES[index].id;
                    if (!this.isDisposed && this.state === 'map' && this.store.save.selected !== id) { this.store.save.selected = id; this.store.persist(); }
                },
                exit: () => { if (!this.isDisposed && this.state === 'map') this.change('title'); },
                unlockAudio: () => this.audio.unlock()
            });
            this.mapView.render(this.selection, this.store.save, this.time, this.ephemeral ? '' : this.store.warning, this.toastTimer > 0 ? this.toast : '', this.mapReturn);
            this.mapReturn = undefined;
            if (this.guairaArrivalPrompt) { this.guairaArrivalPrompt = false; this.mapView.openGuairaRegion(); }
            return;
        }
        this.mapView?.hide();
        this.paintCanvasIfNeeded();
        if (this.experimentalHub?.isOpen || this.flightCleanup || (typeof document !== 'undefined' && document.hidden) || this.state === 'playing')
            this.menuAccessibility?.clear({ restoreFocus: false });
        else this.menuAccessibility?.sync(this.menuIdentity(), this.state === 'title' ? 'Menu principal' : this.state === 'settings' ? 'Opções' : this.state === 'paused' ? 'Pausa' : 'Aventura', this.buttons, this.menuSelection);
    }
    private paintCanvasIfNeeded(): void {
        if (!this.frozenMenuOwner?.() || (this.state !== 'paused' && this.state !== 'settings')) {
            this.invalidateFrozenMenuPaint(); this.paintCanvas(); return;
        }
        const previous = this.frozenMenuPaint, save = this.store.save, preferences = save.preferences;
        // Only the toast's presence/text is painted. Its timer still expires in update().
        const toast = this.toastTimer > 0 ? this.toast : null;
        const reducedMotion = this.frozenMenuMotion?.matches ?? false, cameraShake = this.camera.shakeTimer > 0;
        if (previous && this.frozenMenuSave === save && this.frozenMenuPreferences === preferences
            && previous.screen === this.state && previous.selection === this.menuSelection && previous.toast === toast
            && previous.music === preferences.music && previous.effects === preferences.effects && previous.voice === preferences.voice
            && previous.shake === preferences.shake && previous.reducedMotion === reducedMotion
            && previous.cameraX === this.camera.x && previous.cameraY === this.camera.y && previous.cameraShake === cameraShake
            && previous.time === this.time) return;
        this.paintCanvas();
        // One bounded scalar snapshot, allocated only after a paint. Keep identities separately:
        // an imported save/replaced preferences object must also replace captured button actions.
        this.frozenMenuPaint = { screen: this.state, selection: this.menuSelection, toast,
            music: preferences.music, effects: preferences.effects, voice: preferences.voice,
            shake: preferences.shake, reducedMotion, cameraX: this.camera.x, cameraY: this.camera.y, cameraShake, time: this.time };
        this.frozenMenuSave = save; this.frozenMenuPreferences = preferences;
    }
    private paintCanvas(): void {
        this.renderer.startScene();
        this.buttons = []; this.buttonsOwner = this.menuIdentity();
        const c = this.renderer.getContext();
        if (['playing', 'paused', 'dialogue', 'clear'].includes(this.state))
            this.renderLevel(c);
        else if (this.state === 'title')
            this.renderTitle(c);
        else if (this.state === 'intro' || this.state === 'ending')
            this.renderStory(c);
        else if (this.state === 'gallery')
            this.renderGallery(c);
        else
            this.renderSettings(c);
        if (this.state === 'paused') {
            rect(c, 0, 0, 320, 180, '#172338cc');
            panel(c, 63, 29, 194, 128);
            pixelText(c, 'UM RESPIRO', 160, 42, ART.goldLight, 2, 'center');
            this.button(c, 'CONTINUAR', 84, 68, 152, () => this.resume());
            this.button(c, 'VOLTAR AO MAPA', 84, 90, 152, () => this.toMap());
            this.button(c, 'OPÇÕES', 84, 112, 152, () => this.settings('paused'));
            this.button(c, 'EXPORTAR PROGRESSO', 84, 134, 152, () => this.exportSave(), ART.goldLight, true);
        }
        if (this.state === 'dialogue' && this.dialog) {
            panel(c, 12, 104, 296, 69, '#202d43', '#aac1cd');
            pixelText(c, this.dialog.speaker.toUpperCase(), 24, 113, ISLANDS[this.stage.world - 1].accent);
            this.text(c, this.dialog.text.slice(0, Math.floor(this.dialogueTime / 34)), 24, 127, 270);
            this.button(c, 'CONTINUAR', 215, 150, 80, () => this.closeDialogue());
        }
        if (this.state === 'clear') {
            panel(c, 32, 38, 256, 109);
            pixelText(c, this.clearSecret ? 'CAMINHO SECRETO!' : 'FASE CONCLUÍDA!', 160, 51, ART.goldLight, 2, 'center');
            pixelText(c, fitText(this.stage.name, 230), 160, 75, ART.paper, 1, 'center');
            pixelText(c, `${Math.round(this.elapsed)} S  ·  ${this.coins} MOEDAS`, 160, 94, '#a7c9d0', 1, 'center');
            if (!this.recordEligible)
                pixelText(c, 'TEMPO PARCIAL · SEM RECORDE', 160, 106, '#a7c9d0', 1, 'center');
            // The immediate result panel covers the world flag; keep its earned
            // celebration visible here without delaying completion or rewards.
            drawWorldGoal(c, 237, 101, this.clearSecret, false, true, {
                time: this.time, reducedMotion: this.renderer.reducedMotion, activationAge: this.clearTimer,
            });
            this.button(c, this.stage.id === '6-5' ? 'O GRANDE FINAL' : 'SEGUIR VIAGEM', 86, 120, 148, () => this.afterClear());
        }
        const cue = this.state === 'playing' && this.toastTimer <= 0 ? this.tutorial.cue(this.stage, this.player.data, this.touch) : null;
        const comment = this.state === 'playing' && this.toastTimer <= 0 && !this.player.data.isDead && this.comment && this.commentTimer > 0 ? this.comment : null;
        if (cue || comment) {
            const lines = cue?.lines ?? wrapText(comment!.text, 272);
            panel(c, 12, 29, 296, 12 + lines.length * 10, '#202d43', '#aac1cd');
            lines.forEach((line, i) => pixelText(c, line, 24, 36 + i * 10, i === 0 && cue ? ART.goldLight : ART.paper));
        }
        else if (this.toastTimer > 0 && this.state !== 'dialogue') {
            panel(c, 35, 29, 250, 19);
            pixelText(c, fitText(this.toast, 238), 160, 35, ART.goldLight, 1, 'center');
        }
        if (this.state === 'playing') {
            this.renderer.drawTouchControls();
            this.renderer.drawPlayerTransition(this.player.data, this.camera);
        }
        this.renderer.present();
    }
    private renderLevel(c: CanvasRenderingContext2D) {
        const shake = this.store.save.preferences.shake && this.camera.shakeTimer > 0 ? (Math.floor(this.time / 40) % 2 ? 1 : -1) : 0;
        const view = { ...this.camera, x: this.camera.x + shake, y: this.camera.y };
        const cx = Math.round(view.x), cy = Math.round(view.y), island = ISLANDS[this.stage.world - 1];
        this.art.background(c, island, cx, cy, this.time, this.stage.number);
        if (!this.boss)
            drawLandmarks(c, this.stage, cx, cy, this.time);
        else
            this.art.arena(c, this.boss, cx, cy, this.time);
        this.art.structures(c, this.objects, cx, cy, this.level);
        this.art.terrain(c, this.level, island, cx, cy, this.time, this.renderer.reducedMotion);
        drawLandmarks(c, this.stage, cx, cy, this.time, true);
        this.art.objects(c, this.objects, cx, cy, this.time, this.stage.world, this.level, false);
        this.stage.checkpoints.forEach((cp, i) => {
            const x = cp.x * 16 - cx, y = cp.y * 16 - cy;
            if (x < -40 || x > 335 || y < -16 || y > 224) return;
            drawWorldCheckpoint(c, x, y, this.checkpoint >= i, {
                time: this.time, reducedMotion: this.renderer.reducedMotion,
                activationAge: i === this.checkpoint && this.checkpointActivatedAt != null ? this.time - this.checkpointActivatedAt : null,
            });
        });
        for (const exit of this.stage.exits) {
            const x = exit.x - cx, y = exit.y - cy;
            if (x < -48 || x > 335 || y < -48 || y > 184) continue;
            const complete = this.state === 'clear' && (exit.id === 'secret') === this.clearSecret;
            drawWorldGoal(c, x, y, exit.id === 'secret', this.requiresCampaignPassage()
                || !!exit.requires && !this.objects.get(exit.requires)?.active, complete, {
                time: this.time, reducedMotion: this.renderer.reducedMotion, activationAge: complete ? this.clearTimer : null,
            });
        }
        for (const item of this.stage.pickups) {
            if (this.collected.has(item.id))
                continue;
            const x = item.x - cx, y = item.y - cy;
            if (x < -20 || x > 340)
                continue;
            if (item.kind === 'seal')
                this.art.seal(c, x, y, this.time, this.store.save.seals.includes(item.id));
            else if (item.kind === 'coin')
                this.renderer.drawCoin(x, y, this.time, c);
            else if (item.kind === 'helmet')
                this.renderer.drawHelmet(x, y, c);
            else
                this.renderer.drawFanta(x, y, this.time, c);
        }
        for (const e of this.foes)
            this.art.foe(c, e, cx, cy, this.time);
        if (this.boss)
            this.art.boss(c, this.boss, cx, cy, this.time);
        this.renderPlayer(view);
        this.renderer.drawFallingPlatforms(this.level.getFallingPlatformRenderData(), view);
        this.renderer.drawWorldEffects(view);
        for (const s of this.sparks) {
            c.globalAlpha = Math.min(1, s.life / 180);
            rect(c, s.x - cx, s.y - cy, 2, 2, s.color);
        }
        c.globalAlpha = 1;
        rect(c, 0, 0, 320, 23, '#1b2940');
        rect(c, 0, 22, 320, 1, island.accent);
        pixelText(c, this.stage.id, 8, 8, island.accent);
        pixelText(c, fitText(this.stage.name, this.boss ? 150 : 170), 40, 8, ART.paper);
        const count = this.store.save.seals.filter(id => id.startsWith(this.stage.id + ':')).length;
        pixelText(c, this.boss ? fitText(this.boss.name, 70) : `${count}/3`, 246, 8, ART.goldLight, 1, 'center');
        pixelText(c, 'II', 305, 8, ART.paper);
        if (this.boss) this.renderEncounterHud(c);
        else if (this.player.data.hasHelmet)
            this.renderer.drawHelmet(283, 4, c);
        if (this.state === 'paused')
            this.renderer.drawPlayerTransition(this.player.data, view, c);
    }
    protected renderPlayer(view: CameraData) {
        this.renderer.drawPlayer(this.player.data, view);
    }
    protected renderEncounterHud(c: CanvasRenderingContext2D) {
        if (!this.boss) return;
        if (this.player.data.hasHelmet) this.renderer.drawHelmet(283, 4, c);
        panel(c, 64, 26, 192, 24);
        const boss = this.boss;
        for (let i = 0; i < boss.maxHealth; i++)
            rect(c, 123 + i * 16, 30, 12, 4, i < boss.health ? '#f1a479' : '#4c5264');
        pixelText(c, fitText(boss.hint, 184), 160, 40, '#e5d6c3', 1, 'center');
    }
    private renderTitle(c: CanvasRenderingContext2D) {
        this.art.background(c, ISLANDS[0], this.time * .008, 0, this.time);
        rect(c, 0, 157, 320, 23, '#364d57');
        rect(c, 0, 155, 320, 3, '#a7c784');
        this.heading(c, 'TORBWARE APRESENTA', 'SUPER FEKA GAPS');
        pixelText(c, 'WORLD', 161, 55, '#395472', 3, 'center');
        pixelText(c, 'WORLD', 160, 53, '#faf0b8', 3, 'center');
        pixelText(c, 'SETE REGIÕES. UMA GRANDE MISSÃO?', 160, 86, '#30475b', 1, 'center');
        this.art.atlas.draw(c, PLAYER_SPRITES.idle, PLAYER_PALETTE, 32, 130);
        this.art.atlas.draw(c, bossFrame('joao', 'idle'), WORLD_PALETTE, 252, 99);
        this.button(c, this.store.save.completed.length ? 'CONTINUAR AVENTURA' : 'COMEÇAR AVENTURA', 80, 103, 160, () => this.begin());
        this.button(c, 'GALERIA', 80, 124, 76, () => this.change('gallery'));
        this.button(c, 'OPÇÕES', 164, 124, 76, () => this.settings('title'));
        this.button(c, 'JOGAR O ORIGINAL', 99, 149, 122, () => { location.href = '?classic=true'; });
        pixelText(c, this.experimentalHub ? 'SETAS/TAB: MENU · ENTER: CONFIRMAR' : 'ENTER PARA CONFIRMAR · SETAS PARA ESCOLHER', 160, 172, '#d1d6c2', 1, 'center');
    }
    private renderStory(c: CanvasRenderingContext2D) {
        const ending = this.state === 'ending';
        // Keep the earned receipts above the cast: João's recovery must remain visible.
        const groundY = ending ? 141 : 134;
        this.art.background(c, ISLANDS[ending ? 5 : 0], 0, 0, this.time);
        rect(c, 0, groundY + 1, 320, 180 - groundY - 1, '#556d66');
        rect(c, 0, groundY, 320, 2, '#bfd0a0');
        this.art.atlas.draw(c, ending ? PLAYER_SPRITES.celebrate : PLAYER_SPRITES.idle, PLAYER_PALETTE, ending ? 125 : 54, groundY - 26);
        this.art.atlas.draw(c, YASMIN_FRAMES[Math.floor(this.time / 600) % 2], SPRITE_PALETTE, ending ? 169 : 225, groundY - 30);
        this.art.atlas.draw(c, bossFrame('joao', ending ? 'hurt' : 'idle'), WORLD_PALETTE, ending ? 262 : 252, groundY - 55);
        panel(c, 18, 12, 284, ending ? 72 : 68, '#25344c', '#d2bb8e');
        pixelText(c, ending ? 'UMA VITÓRIA E TANTO!' : 'UMA GRANDE AVENTURA', 160, ending ? 21 : 23, ART.goldLight, 1, 'center');
        const text = ending ? 'FEKA SALVOU YASMIN?' : this.introPage === 0 ? 'João e Yasmin partiram para o arquipélago. Feka sabe o que precisa fazer.' : 'Feka ajeita os óculos e parte. Nenhum gap vai impedir essa grande missão!';
        this.text(c, text, 31, ending ? 35 : 44, 258);
        if (ending) {
            const journal = campaignJournal(this.store.save);
            pixelText(c, `${journal.completed}/${journal.total} TRECHOS · ${this.store.save.seals.length}/72 SELOS`, 160, 50, '#b2d4d4', 1, 'center');
            pixelText(c, journal.waterReleased ? 'GUAÍRA: ÁGUA LIBERADA' : 'GUAÍRA: A ÁGUA AINDA ESPERA', 160, 61, ART.paper, 1, 'center');
            pixelText(c, `${journal.optionalCompleted}/3 DESVIOS OPCIONAIS CONCLUÍDOS`, 160, 73, ART.goldLight, 1, 'center');
        }
        this.button(c, ending ? 'CONTINUAR EXPLORANDO' : 'SEGUIR VIAGEM', 72, 151, 176, () => ending ? this.toMap() : this.nextIntro());
    }
    private backGallery() {
        if (this.galleryWorld) {
            const selection = this.galleryWorld - 1;
            this.galleryWorld = 0;
            this.change('gallery');
            this.menuSelection = selection;
        }
        else
            this.change('title');
    }
    private renderGallery(c: CanvasRenderingContext2D) {
        if (this.galleryWorld === 7) {
            const journal = campaignJournal(this.store.save);
            rect(c, 0, 0, 320, 180, '#1e2f45');
            panel(c, 10, 10, 300, 135);
            pixelText(c, 'GUAÍRA · CADERNO DOS CAMINHOS', 160, 19, ART.goldLight, 1, 'center');
            journal.entries.forEach((entry, i) => pixelText(c,
                fitText(`${entry.complete ? 'OK' : '--'}  ${entry.title}`, 280), 20, 36 + i * 12,
                entry.complete ? '#b2d4d4' : ART.paper));
            pixelText(c, journal.waterReleased ? 'ÁGUA LIBERADA · SERRA ABERTA' : 'ÁGUA: CONCLUA O PREFEITO DA VAZÃO', 20, 101, ART.goldLight);
            journal.optional.forEach((entry, i) => pixelText(c,
                fitText(`${entry.complete ? 'OK' : '--'} ${entry.title} (opcional)`, 280), 20, 114 + i * 9, ART.paper));
            this.button(c, 'VOLTAR AO CADERNO', 80, 153, 160, () => this.backGallery());
            return;
        }
        if (this.galleryWorld) {
            const w = ISLANDS[this.galleryWorld - 1];
            this.art.background(c, w, 0, 0, this.time);
            panel(c, 12, 12, 296, 50);
            pixelText(c, w.name, 160, 22, w.accent, 1, 'center');
            this.text(c, w.description, 24, 38, 270);
            this.art.atlas.draw(c, bossFrame(w.boss, 'idle'), WORLD_PALETTE, 137, 90);
            this.button(c, 'OUTRAS ILHAS', 100, 153, 120, () => this.backGallery());
            return;
        }
        rect(c, 0, 0, 320, 180, '#1e2f45');
        this.heading(c, 'CADERNO DA AVENTURA', 'SETE REGIÕES');
        for (let i = 0; i < 6; i++) {
            const w = ISLANDS[i], x = 10 + (i % 3) * 104, y = 54 + Math.floor(i / 3) * 36, count = this.store.save.seals.filter(id => id.startsWith(`${i + 1}-`)).length;
            panel(c, x, y, 96, 32, this.menuSelection === i ? '#435f72' : '#2c4156', w.accent);
            pixelText(c, fitText(w.name, 86), x + 48, y + 6, w.accent, 1, 'center');
            pixelText(c, `${count}/12 SELOS`, x + 48, y + 20, ART.paper, 1, 'center');
            this.buttons.push({ label: `${w.name}, ${count}/12 selos`, x, y, width: 96, height: 32, run: () => {
                    if (count === 12) {
                        this.galleryWorld = i + 1;
                        this.menuSelection = 0;
                    }
                    else {
                        this.toast = 'Encontre os 12 selos desta ilha.';
                        this.toastTimer = 1800;
                    }
                } });
        }
        this.button(c, `GUAÍRA · ${this.store.save.guaira.completed.length}/5 · EXTRAS`, 50, 129, 220, () => {
            this.galleryWorld = 7; this.menuSelection = 0;
        });
        this.button(c, 'VOLTAR', 114, 153, 92, () => this.backGallery());
    }
    private settings(from: Screen) { this.settingReturn = from; this.pausedAudio = from === 'paused'; this.audio.pause(false); this.change('settings'); }
    private closeSettings() {
        this.store.persist();
        this.change(this.settingReturn);
        if (this.pausedAudio)
            this.audio.pause(true);
    }
    private renderSettings(c: CanvasRenderingContext2D) {
        rect(c, 0, 0, 320, 180, '#1e2e44');
        this.heading(c, 'DO SEU JEITO', 'OPÇÕES');
        const prefs = this.store.save.preferences;
        (['music', 'effects', 'voice'] as const).forEach((key, i) => { const label = ['MÚSICA', 'EFEITOS', 'VOZES'][i]; this.button(c, `${label}: ${Math.round(prefs[key] * 100)}%`, 62, 55 + i * 23, 196, () => { prefs[key] = prefs[key] >= .99 ? 0 : Math.min(1, Math.round((prefs[key] + .25) * 100) / 100); this.audio.volume(); this.store.persist(); }); });
        this.button(c, 'EXPORTAR SAVE', 10, 127, 98, () => this.exportSave(), ART.goldLight, true);
        this.button(c, 'IMPORTAR SAVE', 112, 127, 98, () => this.importSave(), ART.goldLight, true);
        this.button(c, prefs.shake ? 'TREMOR: SIM' : 'TREMOR: NÃO', 214, 127, 96, () => { prefs.shake = !prefs.shake; this.store.persist(); });
        if (this.controlsHelp) this.button(c, 'CONTROLES', 10, 153, 98, () => this.controlsHelp?.open());
        this.button(c, 'VOLTAR', 114, 153, 92, () => this.closeSettings());
    }
    private exportSave() { const url = URL.createObjectURL(new Blob([JSON.stringify(this.store.save, null, 2)], { type: 'application/json' })); const a = document.createElement('a'); a.href = url; a.download = 'super-feka-gaps-world-save.json'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); }
    private importSave() {
        this.saveImportCleanup?.();
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.id = 'world-save-import';
        input.hidden = true;
        let active = true;
        const cleanup = () => {
            active = false;
            input.onchange = null; input.oncancel = null;
            input.remove();
            if (this.saveImportCleanup === cleanup) this.saveImportCleanup = undefined;
        };
        this.saveImportCleanup = cleanup;
        input.oncancel = cleanup;
        input.onchange = async () => {
            const file = input.files?.[0];
            if (!file) { cleanup(); return; }
            input.onchange = null;
            try {
                const result = await importProgressFile(file, this.store, () => active);
                if (!active || result === 'cancelled') return;
                this.toast = progressImportMessage(result);
                this.toastTimer = result === 'imported' ? 2500 : 5000;
                if (result === 'imported') {
                    this.audio.preferences = this.store.save.preferences;
                    // Audio failure must not mislabel an already saved import as a bad file.
                    try { this.audio.volume(); } catch { }
                }
            }
            finally { cleanup(); }
        };
        // Keep a live DOM node throughout the chooser and asynchronous read;
        // detached inputs can lose their browser node ID after a long delay.
        document.body.append(input);
        try { input.click(); }
        catch {
            cleanup(); this.toast = 'Não foi possível abrir o arquivo de progresso.'; this.toastTimer = 3000;
        }
    }
}
