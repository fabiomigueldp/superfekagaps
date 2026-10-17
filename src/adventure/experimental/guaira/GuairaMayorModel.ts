import type { Rect } from '../../../types';
import { mayorStampWater, mayorWaveWater, mayorJetWater, mayorRushWater } from './GuairaMayorWater';

/** Local arena, using the game's ordinary Player, supports and switches. */
export const MAYOR_ARENA = Object.freeze({
    id: 'guaira-prefeito', width: 320, height: 288, floor: 224, deckY: 160,
    valveId: 'guaira-mayor-register', liftId: 'guaira-mayor-lift', deckId: 'guaira-mayor-deck',
    upperValveId: 'guaira-mayor-upper-register', refugeId: 'guaira-mayor-refuge',
    valve: Object.freeze({ x: 64, y: 216, width: 32, height: 8 }),
    upperValve: Object.freeze({ x: 232, y: 152, width: 28, height: 8 }),
    refuge: Object.freeze({ x: 16, y: 176, width: 32, height: 8 }),
    lift: Object.freeze({ x: 112, y: 224, width: 112, height: 8 }),
    deck: Object.freeze({ x: 224, y: 160, width: 92, height: 8 }),
    vent: Object.freeze({ x: 112, y: 204, width: 112, height: 20 }),
    seam: Object.freeze({ x: 208, y: 140, width: 32, height: 20 })
});
export const MAYOR_RULES = Object.freeze({ tickMs: 1000 / 60, intro: 72, idle: 30, warning: 60,
    leap: 32, secondWarning: 42, secondLeap: 28, stamp: 24, returning: 42,
    recover: 210, hurt: 54, seals: 3, counterpressureWarning: 60, counterpressureActive: 24,
    jetWarning: 46, jetBeat: 38, finalJetWarning: 42, finalJetBeat: 34,
    liftArrivalBudget: 84, minimumOpening: 144,
    vault: 32, rushWarning: 42, finalRushWarning: 36, brake: 20, rushSpeed: 5, finalRushSpeed: 5.8,
    rushAcceleration: .8, rushDeceleration: .45 });
export type MayorState = 'intro' | 'idle' | 'jetWarning' | 'jetBurst' | 'vault' | 'rushWarning' | 'rush' | 'brake' | 'warning' | 'leap' | 'stamp' | 'returning' | 'recover' | 'hurt' | 'released';
export interface MayorRush {
    readonly phase: 'approach' | 'warning' | 'active' | 'brake';
    readonly direction: -1 | 1; readonly rect: Readonly<Rect>; readonly lane: Readonly<Rect>;
    readonly progress: number; readonly pass: number; readonly total: number;
    readonly distance: number; readonly speed: number; readonly stopping: boolean;
}
export interface MayorCounterpressure {
    readonly phase: 'warning' | 'active'; readonly rect: Readonly<Rect>;
    readonly ticksRemaining: number; readonly progress: number;
}
export interface MayorWave extends Rect { readonly direction: -1 | 1; readonly age: number }
export interface MayorShot { readonly lane:'high'|'low'; readonly direction:-1|1 }
const high=Object.freeze({lane:'high',direction:-1} as const);
const left=Object.freeze({lane:'low',direction:1} as const);
const right=Object.freeze({lane:'low',direction:-1} as const);
// Failed openings rotate a readable phrase; no random reaction-time lottery.
// All phrases use the three outlets that actually exist in the arena.
const JET_PHRASES=Object.freeze([
    Object.freeze([Object.freeze([high,left]),Object.freeze([right,high]),Object.freeze([left,right])]),
    Object.freeze([Object.freeze([left,high,right]),Object.freeze([high,right,left]),Object.freeze([right,left,high])]),
]);
export interface MayorSalvo {
    readonly phase: 'warning' | 'active'; readonly lane: 'high' | 'low'; readonly direction: -1 | 1;
    readonly rect: Readonly<Rect>; readonly shot: number; readonly total: number; readonly progress: number;
    readonly sequence:readonly Readonly<MayorShot>[];
}
export interface MayorAccess { valveActive: boolean; liftReady: boolean; registerOpened: boolean; register?:'lower'|'upper'; player?: Readonly<Rect> }
export interface MayorFeedback {
    readonly kind:'interrupt'|'seal'|'release'|'drain'|'landing'|'rush'|'brake'|'stamp'|'footstep'; readonly x:number; readonly y:number;
    readonly age:number; readonly duration:number; readonly seal?:number; readonly direction?:-1|1;
}
type FeedbackRecord=Omit<MayorFeedback,'age'>&{readonly started:number};
export interface MayorEvent { kind: 'warning' | 'jetWarning' | 'jet' | 'interrupt' | 'vault' | 'rushWarning' | 'rush' | 'brake' | 'stamp' | 'waves' | 'drain' | 'hit' | 'released'; tick: number }
export const mayorOverlaps = (a: Rect, b: Rect) => a.x < b.x + b.width && a.x + a.width > b.x &&
    a.y < b.y + b.height && a.y + a.height > b.y;

/** One fixed clock drives the tells, physical travel, collision and painted effects. */
export class GuairaMayorModel implements Rect {
    x = 264; y = 120; readonly width = 28; readonly height = 40;
    facing: -1 | 1 = -1;
    state: MayorState = 'intro'; stateTick = 0; tick = 0; cycle = 0; strike = 1;
    sealsRemaining: number = MAYOR_RULES.seals;
    stampTarget: Readonly<Rect> = Object.freeze({ ...MAYOR_ARENA.vent });
    events: MayorEvent[] = [];
    private liveWaves: MayorWave[] = [];
    private liveJets: MayorWave[] = [];
    private jetIndex = 0;
    private rushStart = 224;
    private rushEnd = 24;
    private rushPass = 1;
    private rushVelocity = 0;
    private balconyPressure = false;
    private cancelled = false;
    private interrupted = false;
    private from = { x: 264, y: 120 };
    private remainder = 0;
    private freshOpening = false;
    private accessReady = false;
    private valveActive = false;
    private pressurePhase: MayorCounterpressure['phase'] | null = null;
    private pressureTick = 0;
    private pressureSpent = false;
    private phaseAttempts = 0;
    private recoveryEnd: number = MAYOR_RULES.recover;
    private arrivalDeadline: number | null = null;
    private openingAt: number | null = null;
    private responses:FeedbackRecord[]=[];
    get opening(): Readonly<Rect> { return Object.freeze({ x: this.x + 10, y: this.y, width: 14, height: 6 }); }
    get phaseNumber() { return MAYOR_RULES.seals + 1 - this.sealsRemaining; }
    get finalStrike() { return this.phaseNumber < 3 || this.strike === 2; }
    get canInterrupt() { return this.state === 'jetBurst' || this.state === 'jetWarning' && this.jetIndex > 0; }
    get canOpenRegister() { return this.canInterrupt || this.finalStrike && ['stamp', 'returning', 'recover'].includes(this.state); }
    get pressureInterrupted() { return this.interrupted; }
    get publicWaterOpen() { return this.state === 'released'; }
    get attacksCancelled() { return this.cancelled; }
    get registerOpenedThisCycle() { return this.freshOpening; }
    get accessRequested() { return this.freshOpening && this.valveActive; }
    get vulnerable() { return this.state === 'recover' && this.freshOpening && this.accessReady; }
    private get recoveryDeadline() {
        return this.openingAt!==null?this.recoveryEnd:this.accessRequested&&this.arrivalDeadline!==null
            ?Math.max(MAYOR_RULES.recover,this.arrivalDeadline):MAYOR_RULES.recover;
    }
    get recoveryTicksRemaining() { return this.state==='recover'?Math.max(0,this.recoveryDeadline-this.stateTick):0; }
    get recoveryProgress() {
        if(this.state!=='recover')return 0;
        const start=this.openingAt??0;
        return Math.max(0,Math.min(1,(this.stateTick-start)/(this.recoveryDeadline-start)));
    }
    get feedback():readonly Readonly<MayorFeedback>[] {
        return this.responses.map(({started,...effect})=>Object.freeze({...effect,age:this.tick-started}));
    }
    get warningDuration() { return this.strike === 2 ? MAYOR_RULES.secondWarning : MAYOR_RULES.warning; }
    get leapDuration() { return this.strike === 2 ? MAYOR_RULES.secondLeap : MAYOR_RULES.leap; }
    get warningProgress() { return Math.min(1, this.stateTick / this.warningDuration); }
    get motionProgress() { return Math.min(1, this.stateTick / (this.state === 'returning' ? MAYOR_RULES.returning : this.leapDuration)); }
    get rushWarningDuration() { return this.phaseNumber >= 3 ? MAYOR_RULES.finalRushWarning : MAYOR_RULES.rushWarning; }
    get rush(): Readonly<MayorRush> | null {
        if (this.cancelled || !['vault', 'rushWarning', 'rush', 'brake'].includes(this.state)) return null;
        const direction = this.rushEnd > this.rushStart ? 1 : -1;
        return Object.freeze({ phase: this.state === 'vault' ? 'approach' : this.state === 'rushWarning' ? 'warning' : this.state === 'rush' ? 'active' : 'brake',
            direction, pass: this.rushPass, total: this.phaseNumber >= 3 ? 2 : 1,
            distance: this.state === 'vault' ? 0 : Math.abs(this.x - this.rushStart), speed: this.rushVelocity,
            stopping: this.state === 'rush' && Math.abs(this.rushEnd - this.x) <= this.rushVelocity ** 2 / (2 * MAYOR_RULES.rushDeceleration) + this.rushVelocity,
            rect: Object.freeze({ x: this.x - 8, y: MAYOR_ARENA.floor - 24, width: 44, height: 24 }),
            lane: Object.freeze({ x: Math.min(this.rushStart, this.rushEnd) - 8, y: MAYOR_ARENA.floor - 24,
                width: Math.abs(this.rushEnd - this.rushStart) + 44, height: 24 }),
            progress: Math.min(1, this.state === 'vault' ? this.stateTick / MAYOR_RULES.vault
                : this.state === 'rushWarning' ? this.stateTick / this.rushWarningDuration
                : this.state === 'brake' ? this.stateTick / MAYOR_RULES.brake
                : Math.abs(this.x - this.rushStart) / Math.abs(this.rushEnd - this.rushStart)) });
    }
    /** A balcony camper gets one fully advertised high shot with each rush.
     * This decision is locked before the approach, never during a dodge. */
    get crossfire(): Readonly<MayorSalvo> | null {
        if (this.cancelled || !this.balconyPressure || this.state !== 'rushWarning') return null;
        return Object.freeze({ phase: 'warning', lane: 'high', direction: -1,
            rect: Object.freeze({ x: 8, y: 144, width: 304, height: 16 }),
            shot: this.rushPass, total: this.phaseNumber >= 3 ? 2 : 1,
            sequence: Object.freeze(this.phaseNumber >= 3 ? [high,high] : [high]), progress: this.stateTick / this.rushWarningDuration });
    }
    get waveWarning() { return !this.cancelled && !this.interrupted && !this.accessRequested && this.phaseNumber >= 2 && this.finalStrike && ['warning', 'leap', 'stamp'].includes(this.state); }
    get waves(): readonly Readonly<MayorWave>[] { return this.liveWaves.map(w => Object.freeze({ ...w })); }
    get jets(): readonly Readonly<MayorWave>[] { return this.liveJets.map(j => Object.freeze({ ...j })); }
    get jetWarningDuration() { return this.phaseNumber >= 3 ? MAYOR_RULES.finalJetWarning : MAYOR_RULES.jetWarning; }
    get jetBeatDuration() { return this.phaseNumber >= 3 ? MAYOR_RULES.finalJetBeat : MAYOR_RULES.jetBeat; }
    get salvo(): Readonly<MayorSalvo> | null {
        if (this.state !== 'jetWarning' && this.state !== 'jetBurst') return null;
        const phrases=JET_PHRASES[this.phaseNumber>=3?1:0];
        const sequence=phrases[Math.max(0,this.phaseAttempts-1)%phrases.length];
        const {lane,direction}=sequence[this.jetIndex];
        return Object.freeze({ phase: this.state === 'jetWarning' ? 'warning' : 'active',
            lane, direction, shot: this.jetIndex + 1, total: sequence.length, sequence,
            rect: Object.freeze({ x: 8, y: lane==='high' ? 144 : 208, width: 304, height: 16 }),
            progress: Math.min(1, this.stateTick / (this.state === 'jetWarning' ? this.jetWarningDuration : this.jetBeatDuration)) });
    }
    get counterpressure(): Readonly<MayorCounterpressure> | null {
        if (!this.pressurePhase) return null;
        const duration = this.pressurePhase === 'warning' ? MAYOR_RULES.counterpressureWarning : MAYOR_RULES.counterpressureActive;
        return Object.freeze({ phase: this.pressurePhase, rect: MAYOR_ARENA.seam,
            ticksRemaining: duration - this.pressureTick, progress: this.pressureTick / duration });
    }
    /** Bounding footprint for the tell; actual contact uses the water contours below. */
    get danger(): Readonly<Rect> | null {
        if (this.cancelled) return null;
        return this.state === 'stamp' ? this.stampTarget : this.pressurePhase === 'active' ? MAYOR_ARENA.seam : null;
    }
    get dangers(): readonly Readonly<Rect>[] {
        if (this.cancelled) return [];
        return [...(this.state === 'stamp' ? mayorStampWater(this.stampTarget) : this.danger ? [this.danger] : []),
            ...this.waves.flatMap(mayorWaveWater), ...this.jets.flatMap(mayorJetWater),
            ...(this.rush?.phase === 'active' ? mayorRushWater(this.rush.rect, this.rush.direction) : [])];
    }
    cancelCounterpressure() { this.pressurePhase = null; this.pressureTick = 0; this.pressureSpent = true; }
    cancelAttacks() { this.cancelled = true; this.cancelCounterpressure(); this.liveWaves = []; this.liveJets = []; this.responses=[]; }
    private enter(state: MayorState) {
        this.state = state; this.stateTick = 0;
        if (state !== 'recover') this.cancelCounterpressure();
        if (state === 'recover') {
            this.pressureSpent = this.interrupted; this.recoveryEnd=MAYOR_RULES.recover;
            this.arrivalDeadline=this.openingAt=null;
        }
    }
    private emit(kind: MayorEvent['kind']) { this.events.push({ kind, tick: this.tick }); }
    private respond(kind:MayorFeedback['kind'],x:number,y:number,seal?:number,direction?:-1|1) {
        this.responses.push(Object.freeze({kind,x,y,seal,direction,started:this.tick,duration:kind==='release'?84:kind==='seal'?54:kind==='footstep'?18:42}));
        this.responses=this.responses.slice(-8);
    }
    private warnJet() { this.facing = -1; this.enter('jetWarning'); this.emit('jetWarning'); }
    private startPursuit(player?: Readonly<Rect>) {
        this.cancelled = false;
        // Change sides before committing. Both direction and destination are
        // fixed before the approach; moving after the tell never bends a rush.
        const playerOnRight = (player ? player.x + player.width / 2 : 80) >= 160;
        this.rushStart = playerOnRight ? 68 : 224;
        this.rushEnd = playerOnRight ? 264 : 24;
        this.rushPass = 1;
        this.rushVelocity = 0;
        this.balconyPressure = !this.interrupted && !!player && player.x + player.width >= MAYOR_ARENA.deck.x && player.y + player.height <= MAYOR_ARENA.deckY + 4;
        this.from = { x: this.x, y: this.y };
        this.facing = this.rushEnd > this.rushStart ? 1 : -1;
        this.freshOpening = this.accessReady = this.valveActive = false;
        this.enter('vault'); this.emit('vault');
    }
    private aim(player?: Readonly<Rect>) {
        this.cancelled = false;
        const center = player ? player.x + player.width / 2 : 144;
        // Every strike locks once. A dodge during anticipation never moves its target.
        const x = Math.round(Math.max(8, Math.min(248, center - 32))), landingX = x + 32;
        const feet = player ? player.y + player.height : MAYOR_ARENA.floor;
        const floor = landingX >= MAYOR_ARENA.deck.x && feet <= MAYOR_ARENA.deckY + 4 ? MAYOR_ARENA.deckY
            : landingX <= MAYOR_ARENA.refuge.x + MAYOR_ARENA.refuge.width && feet <= MAYOR_ARENA.refuge.y + 4 ? MAYOR_ARENA.refuge.y : MAYOR_ARENA.floor;
        this.stampTarget = Object.freeze({ x, y: floor - 24, width: 64, height: 24 });
        this.freshOpening = this.accessReady = this.valveActive = false;
        this.facing = center < this.x + this.width / 2 ? -1 : 1;
        this.enter('warning'); this.emit('warning');
    }
    private travel(toX: number, toY: number) {
        const p = this.motionProgress;
        this.x = this.from.x + (toX - this.from.x) * p;
        this.y = this.from.y + (toY - this.from.y) * p - Math.sin(p * Math.PI) * 36;
    }
    private advanceCounterpressure() {
        if (!this.vulnerable || this.sealsRemaining === MAYOR_RULES.seals) return;
        if (!this.pressureSpent) {
            this.pressureSpent = true; this.pressurePhase = 'warning'; this.pressureTick = 0;
        } else if (this.pressurePhase) {
            this.pressureTick++;
            if (this.pressurePhase === 'warning' && this.pressureTick >= MAYOR_RULES.counterpressureWarning) {
                this.pressurePhase = 'active'; this.pressureTick = 0;
            } else if (this.pressurePhase === 'active' && this.pressureTick >= MAYOR_RULES.counterpressureActive) this.cancelCounterpressure();
        }
    }
    update(dt: number, access: MayorAccess) {
        if (!Number.isFinite(dt) || dt <= 0) return;
        this.events = [];
        if (this.canOpenRegister && access.registerOpened && access.valveActive) {
            this.freshOpening = true;
            if (this.canInterrupt) {
                // A fresh sentada vents water, not the opponent. He leaves the
                // balcony and pursues. The reward is no remaining salvo, waves
                // or seam pulse this cycle; his committed physical combo remains.
                this.cancelAttacks(); this.interrupted = true;
                this.startPursuit(access.player); this.emit('interrupt');
                const plate=access.register==='upper'?MAYOR_ARENA.upperValve:MAYOR_ARENA.valve;
                this.respond('interrupt',plate.x+plate.width/2,plate.y+4);
            }
            if (this.liveWaves.length) {
                this.liveWaves = []; this.emit('drain');
                const plate=access.register==='upper'?MAYOR_ARENA.upperValve:MAYOR_ARENA.valve;
                this.respond('drain',plate.x+plate.width/2,plate.y+4);
            }
        }
        this.valveActive = access.valveActive;
        this.accessReady = access.valveActive && access.liftReady;
        if (this.freshOpening && !this.valveActive) this.cancelCounterpressure();
        this.remainder += Math.min(dt, 100);
        while (this.remainder + 1e-7 >= MAYOR_RULES.tickMs) {
            this.remainder -= MAYOR_RULES.tickMs;
            this.tick++; this.stateTick++;
            this.responses=this.responses.filter(e=>this.tick-e.started<e.duration);
            const speed = this.phaseNumber >= 3 ? 2.6 : 2.2;
            this.liveWaves = this.liveWaves.map(w => ({ ...w, x: w.x + w.direction * speed, age: w.age + 1 }))
                .filter(w => w.x + w.width > 0 && w.x < MAYOR_ARENA.width);
            const jetSpeed = this.phaseNumber >= 3 ? 4 : 3.4;
            this.liveJets = this.liveJets.map(j => ({ ...j, x: j.x + j.direction * jetSpeed, age: j.age + 1 }))
                .filter(j => j.x + j.width > 0 && j.x < MAYOR_ARENA.width);
            switch (this.state) {
                case 'intro': if (this.stateTick >= MAYOR_RULES.intro) this.enter('idle'); break;
                case 'idle':
                    this.x = 264 + Math.sin(this.stateTick / MAYOR_RULES.idle * Math.PI * 2) * 7;
                    if (this.stateTick >= MAYOR_RULES.idle) {
                        this.cycle++; this.phaseAttempts++; this.strike = 1; this.interrupted = false; this.cancelled = false;
                        if (this.phaseNumber >= 2) {
                            this.jetIndex = 0; this.freshOpening = this.accessReady = this.valveActive = false;
                            this.warnJet();
                        } else this.aim(access.player);
                    }
                    break;
                case 'jetWarning': if (this.stateTick >= this.jetWarningDuration) {
                    const shot = this.salvo!;
                    this.liveJets.push({ x: shot.direction === 1 ? 8 : 282, y: shot.rect.y,
                        width: 30, height: 16, direction: shot.direction, age: 0 });
                    this.enter('jetBurst'); this.emit('jet');
                } break;
                case 'jetBurst': if (this.stateTick >= this.jetBeatDuration) {
                    if (this.jetIndex + 1 < this.salvo!.total) { this.jetIndex++; this.warnJet(); }
                    else this.startPursuit(access.player);
                } break;
                case 'vault': {
                    const p = this.stateTick / MAYOR_RULES.vault;
                    this.x = this.from.x + (this.rushStart - this.from.x) * p;
                    this.y = this.from.y + (MAYOR_ARENA.floor - this.height - this.from.y) * p - Math.sin(p * Math.PI) * 28;
                    if (this.stateTick >= MAYOR_RULES.vault) {
                        this.x = this.rushStart; this.y = MAYOR_ARENA.floor - this.height;
                        this.respond('landing', this.x + this.width / 2, MAYOR_ARENA.floor);
                        this.enter('rushWarning'); this.emit('rushWarning');
                    }
                } break;
                case 'rushWarning':
                    if (this.stateTick >= this.rushWarningDuration) {
                        this.enter('rush'); this.emit('rush');
                        this.rushVelocity = 0;
                        this.respond('rush', this.x + this.width / 2, MAYOR_ARENA.floor, undefined, this.facing);
                        if (this.balconyPressure) {
                            this.liveJets.push({ x: 282, y: 144, width: 30, height: 16, direction: -1, age: 0 });
                            this.emit('jet');
                        }
                    } break;
                case 'rush': {
                    const direction = this.rushEnd > this.rushStart ? 1 : -1;
                    const speed = this.phaseNumber >= 3 ? MAYOR_RULES.finalRushSpeed : MAYOR_RULES.rushSpeed;
                    const distance = Math.abs(this.rushEnd - this.x), stride = Math.floor(Math.abs(this.x - this.rushStart) / 24);
                    // Brake within the advertised lane. Solving v²/(2a)+v=d
                    // leaves room for this fixed step as well as the stopping
                    // distance; the last step is sub-pixel, never a hard snap.
                    const a = MAYOR_RULES.rushDeceleration;
                    const safeSpeed = Math.sqrt(a * a + 2 * a * distance) - a;
                    this.rushVelocity = Math.min(speed, (this.stateTick + 1) * MAYOR_RULES.rushAcceleration, Math.max(.25, safeSpeed), distance);
                    this.x += direction * this.rushVelocity;
                    if (this.rushVelocity > 1.5 && Math.floor(Math.abs(this.x - this.rushStart) / 24) > stride)
                        this.respond('footstep', this.x + this.width / 2, MAYOR_ARENA.floor, undefined, direction);
                    if (Math.abs(this.rushEnd - this.x) < .001) {
                        this.x = this.rushEnd; this.rushVelocity = 0; this.enter('brake'); this.emit('brake');
                        this.respond('brake', this.x + this.width / 2, MAYOR_ARENA.floor, undefined, direction);
                    }
                } break;
                case 'brake':
                    if (this.stateTick >= MAYOR_RULES.brake) {
                        if (this.phaseNumber >= 3 && this.rushPass === 1) {
                            this.rushPass = 2; this.rushEnd = this.rushStart; this.rushStart = this.x;
                            this.facing = this.rushEnd > this.rushStart ? 1 : -1;
                            this.enter('rushWarning'); this.emit('rushWarning');
                        } else this.aim(access.player);
                    } break;
                case 'warning': if (this.stateTick >= this.warningDuration) {
                    this.from = { x: this.x, y: this.y }; this.enter('leap');
                } break;
                case 'leap':
                    this.travel(this.stampTarget.x + this.stampTarget.width / 2 - this.width / 2, this.stampTarget.y + this.stampTarget.height - this.height);
                    if (this.stateTick >= this.leapDuration) {
                        this.freshOpening = this.accessReady = this.valveActive = false;
                        this.enter('stamp'); this.emit('stamp');
                        this.respond('stamp', this.x + this.width / 2, this.y + this.height);
                    } break;
                case 'stamp': if (this.stateTick >= MAYOR_RULES.stamp) {
                    if (!this.finalStrike) { this.strike++; this.aim(access.player); }
                    else {
                        if (this.phaseNumber >= 2 && !this.accessRequested && !this.interrupted) {
                            this.liveWaves = ([-1, 1] as const).map(direction => ({
                                x: direction === -1 ? this.stampTarget.x - 20 : this.stampTarget.x + this.stampTarget.width,
                                y: 206, width: 20, height: 18, direction, age: 0
                            })); this.emit('waves');
                        }
                        this.from = { x: this.x, y: this.y }; this.facing = this.x < 264 ? 1 : -1; this.enter('returning');
                    }
                } break;
                case 'returning':
                    this.travel(264, 120);
                    if (this.stateTick >= MAYOR_RULES.returning) { this.x = 264; this.y = 120; this.facing = -1; this.enter('recover'); }
                    break;
                case 'recover':
                    // Accept one late approach, including the real lift trip.
                    // Closing/reopening cannot renew either clock indefinitely.
                    if(this.accessRequested&&this.arrivalDeadline===null)
                        this.arrivalDeadline=this.stateTick+MAYOR_RULES.liftArrivalBudget;
                    if(this.vulnerable&&this.openingAt===null&&this.stateTick<=this.recoveryDeadline){
                        this.openingAt=this.stateTick;
                        this.recoveryEnd=Math.max(MAYOR_RULES.recover,this.stateTick+MAYOR_RULES.minimumOpening);
                    }
                    if (this.stateTick >= this.recoveryDeadline) this.enter('idle');
                    break;
                case 'hurt': if (this.stateTick >= MAYOR_RULES.hurt) this.enter('idle'); break;
            }
            this.advanceCounterpressure();
        }
    }
    /** Armor bounces; only the exposed back takes a real native falling contact. */
    contact(player: Rect, previous: Rect, falling: boolean): 'none' | 'hurt' | 'bounce' | 'hit' | 'defeated' {
        if (this.state === 'intro' || this.state === 'hurt' || this.state === 'released') return 'none';
        if (mayorOverlaps(player, this) && falling && previous.y + previous.height <= this.y + 1e-7) {
            if (!this.vulnerable || !mayorOverlaps(player, this.opening)) return 'bounce';
            this.sealsRemaining--; this.freshOpening = this.accessReady = false; this.cancelAttacks();
            const released = this.sealsRemaining === 0;
            this.phaseAttempts=0;
            this.respond(released?'release':'seal',244+this.sealsRemaining*7,193,this.sealsRemaining);
            this.enter(released ? 'released' : 'hurt'); this.emit(released ? 'released' : 'hit');
            return released ? 'defeated' : 'hit';
        }
        // Travelling bodies have no surprise side damage. Water is always painted.
        return this.dangers.some(q => mayorOverlaps(player, q)) ? 'hurt' : 'none';
    }
}
