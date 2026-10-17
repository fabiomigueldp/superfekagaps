/** Isolated Guaíra prototype. Values are logical pixels / fixed 60 Hz ticks. */
export interface Box { x: number; y: number; width: number; height: number }
export interface BullArena { left: number; right: number; floor: number }
export type BullState = 'intro' | 'idle' | 'tell' | 'turn' | 'charge' | 'brake' | 'recover' | 'rattle' | 'bones' | 'hurt' | 'defeated';
export interface Bone extends Box { vx: number; life: number; age: number; hopTicks: number; hopHeight: number; shot: number }
export interface BullBoneShot extends Box { readonly vx: number; readonly delay: number; readonly hopTicks: number; readonly hopHeight: number; readonly flightTicks: number }
export interface BullFootfall { readonly x: number; readonly y: number; readonly facing: -1 | 1; readonly born: number; readonly skid: boolean }
export interface BullEvent { kind: 'tell' | 'charge' | 'brake' | 'bones' | 'hit' | 'defeated'; tick: number }
export const BULL_RULES = Object.freeze({ tickMs: 1000 / 60, rest: 24, tell: 42, turn: 42, rattle: 48, brake: 20, recover: 52, hurt: 30, maxBones: 2, speed: 5, health: 6,
    boneHop:44, boneHopHeight:64, collapse:48 });
export const intersects = (a: Box, b: Box) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const swept = (a: Box, previousX: number): Box => ({ ...a, x: Math.min(a.x, previousX), width: a.width + Math.abs(a.x - previousX) });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
const BONE = Object.freeze({ speed: 3, width: 10, spacing: 22 });
export function bullBoneY(floor:number,age:number,bouncing:boolean,hopHeight:number=BULL_RULES.boneHopHeight,hopTicks:number=BULL_RULES.boneHop){
    const p=(age%hopTicks)/hopTicks;
    return floor-9-(bouncing?Math.round(4*hopHeight*p*(1-p)):0);
}
export class SkeletonBullModel implements Box {
    readonly width = 48; readonly height = 34;
    x: number; y: number; state: BullState = 'intro'; stateTick = 0; tick = 0;
    health: number = BULL_RULES.health; facing: -1 | 1 = -1; cycle = 0;
    bones: Bone[] = []; events: BullEvent[] = []; private frameHazards: Box[] = [];
    private departedBonePoses: Bone[] = [];
    private chargeSweeps: Box[] = [];
    private remainder = 0; private hitThisOpening = false;
    private boneFlightTicks = 0;
    private plannedBones: readonly Readonly<BullBoneShot>[] = [];
    private bouncingVolley = false;
    private chargeTotal = 1;
    private chargeIndex = 1;
    private chargeOrigin = 0;
    private chargeTarget = 0;
    private chargeTicks = 0;
    private chargeTravel = 0;
    private chargeSpeed = 0;
    private footContacts: BullFootfall[] = [];
    private closingAfterMiss = false;
    readonly arena: Readonly<BullArena>;
    constructor(arena: BullArena = { left: 4, right: 316, floor: 224 }) {
        if (![arena.left, arena.right, arena.floor].every(Number.isFinite) || arena.right - arena.left < 280) throw new Error('Bull arena requires finite bounds and at least 280px of clear floor');
        this.arena = Object.freeze({ ...arena }); this.x = arena.right - this.width - 20; this.y = arena.floor - this.height;
    }
    get vulnerable() { return (this.state === 'brake' || this.state === 'recover') && !this.hitThisOpening; }
    get phaseNumber() { return this.health > 4 ? 1 : this.health > 2 ? 2 : 3; }
    get bouncingBones() { return this.bouncingVolley && (this.state === 'rattle' || this.state === 'bones'); }
    get chargeCount() { return this.chargeTotal; }
    get chargeLeg() { return this.chargeIndex; }
    get chargeDistance() { return this.chargeTravel; }
    get chargeVelocity() { return this.chargeSpeed; }
    get slowingCharge() { return this.state === 'charge' && this.chargeTicks > 0 && this.stateTick > this.chargeTicks - this.chargeRamp; }
    get footfalls(): readonly BullFootfall[] { return this.footContacts; }
    private get chargeRamp() { return Math.min(6, Math.floor(this.chargeTicks / 6)); }
    get boneFlightDuration(){return this.boneFlightTicks;}
    /** Locked at the tell: preview, launch, collision and effects share this score. */
    get boneShots() { return this.plannedBones; }
    get boneReleaseAge() {
        if (this.state !== 'bones') return 0;
        const released = this.plannedBones.filter(shot => shot.delay <= this.stateTick);
        return this.stateTick - (released[released.length - 1]?.delay ?? 0);
    }
    /** A missed opening closes during the existing rest, giving an overlapping
     * player time to walk out. It awards no hit and adds no time to the cycle. */
    get rearming() { return this.state === 'idle' && this.closingAfterMiss; }
    /** Both loose ribs start exactly where their live projectiles will spawn. */
    get boneLaunchPoses(): readonly Box[] {
        if (this.plannedBones.length) return this.plannedBones.map(({ x, y, width, height }) => ({ x, y, width, height }));
        const origin = this.x + this.width / 2;
        return [0, BONE.spacing].map(offset => ({ x: origin - this.facing * offset,
            y: this.arena.floor - 9, width: BONE.width, height: 7 }));
    }
    /** Read-only feedback clock: braking and recovery form one uninterrupted opening. */
    get openingTicksRemaining() {
        if (!this.vulnerable) return 0;
        return Math.max(0, this.state === 'brake'
            ? BULL_RULES.brake - this.stateTick + BULL_RULES.recover
            : BULL_RULES.recover - this.stateTick);
    }
    get warningTicks() { return this.state === 'rattle' ? BULL_RULES.rattle : this.state==='turn'?BULL_RULES.turn:BULL_RULES.tell; }
    get warningProgress() { return Math.min(1, this.stateTick / this.warningTicks); }
    get hazards(): readonly Box[] { return this.frameHazards; }
    /** Render-only endpoints of departed bones live as long as this update's sweeps. */
    get visibleBones(): readonly Bone[] { return [...this.bones, ...this.departedBonePoses]; }
    get chargeLane(): Box { return { x: this.arena.left + 12, y: this.arena.floor - 28, width: this.arena.right - this.arena.left - 24, height: 28 }; }
    private enter(state: BullState) { this.state = state; this.stateTick = 0; }
    private emit(kind: BullEvent['kind']) { this.events.push({ kind, tick: this.tick }); }
    /** A trapezoidal speed profile keeps the announced endpoint and duration.
     * Position is integrated analytically, so neither catch-up nor rounding can
     * skip the stop. Feet and dust use the distance actually travelled. */
    private beginCharge() {
        this.chargeOrigin = this.x;
        this.chargeTarget = this.facing < 0 ? this.arena.left + 12 : this.arena.right - this.width - 12;
        this.chargeTicks = Math.max(1, Math.ceil(Math.abs(this.chargeTarget - this.x) / BULL_RULES.speed));
        this.chargeTravel = 0; this.chargeSpeed = 0;
        this.enter('charge'); this.emit('charge');
    }
    private chargePosition(age: number) {
        const duration = this.chargeTicks, ramp = this.chargeRamp, t = clamp(age, 0, duration);
        const distance = Math.abs(this.chargeTarget - this.chargeOrigin);
        if (!ramp) return distance * t / duration;
        const cruise = distance / (duration - ramp);
        return t <= ramp ? cruise * t * t / (2 * ramp)
            : t >= duration - ramp ? distance - cruise * (duration - t) ** 2 / (2 * ramp)
            : cruise * (t - ramp / 2);
    }
    private plantFoot(skid = false) {
        const front = Math.floor(this.chargeTravel / 45) % 2 === 0;
        // Near hoof centres at the two planted gait beats, including their reach.
        this.footContacts.push(Object.freeze({ x: clamp(this.x + 24 + this.facing * (skid ? 19 : front ? 13 : -20), this.arena.left, this.arena.right),
            y: this.arena.floor, facing: this.facing, born: this.tick, skid }));
        if (this.footContacts.length > 6) this.footContacts.shift();
    }
    /** Direction locks when the warning starts. No tracking or attacks without warning. */
    private warn(player: Box) {
        this.closingAfterMiss = false;
        this.facing = player.x + player.width / 2 < this.x + this.width / 2 ? -1 : 1;
        this.hitThisOpening = false;
        const bones = this.cycle++ % 3 === 2;
        this.bouncingVolley = bones && this.phaseNumber >= 2;
        this.chargeIndex = 1; this.chargeTotal = !bones && this.phaseNumber === 3 ? 2 : 1;
        if (!bones) {
            const stop = this.facing < 0 ? this.arena.left + 12 : this.arena.right - this.width - 12;
            // A cornered bull needs one body length of runway. Choose the
            // inward route before its full tell, never turn during a charge.
            if (Math.abs(stop - this.x) < this.width) this.facing = this.facing === -1 ? 1 : -1;
        } else {
            // Teach the low pair, then separate height and timing. A full held
            // jump rises ~100px; the 64/44 and 80/56px arcs also permit a ground
            // crossing under an apex. No tracking after this complete tell.
            const phase = this.phaseNumber;
            const heights = phase === 1 ? [0, 0] : phase === 2 ? [64, 44] : [80, 56];
            const periods = phase === 3 ? [48, 40] : [BULL_RULES.boneHop, 36];
            const speed = phase === 1 ? BONE.speed : phase === 2 ? 3.2 : 3.4;
            const delay = phase === 1 ? 0 : phase === 2 ? 16 : 18;
            this.plannedBones = Object.freeze(heights.map((hopHeight, shot) => {
                const x = this.x + this.width / 2 - this.facing * shot * (phase === 1 ? BONE.spacing : 10);
                const distance = this.facing < 0 ? x - this.arena.left : this.arena.right - x - BONE.width;
                return Object.freeze({ x, y: this.arena.floor - 9, width: BONE.width, height: 7,
                    vx: this.facing * speed, delay: shot * delay, hopHeight, hopTicks: periods[shot],
                    flightTicks: Math.max(1, Math.ceil(distance / speed)) });
            }));
            this.boneFlightTicks = Math.max(...this.plannedBones.map(shot => shot.delay + shot.flightTicks));
        }
        this.enter(bones ? 'rattle' : 'tell'); this.emit('tell');
    }
    /** Maximum 100ms catch-up: tab resumption cannot silently consume an entire tell. */
    update(dtMs: number, player: Box) {
        this.events = []; this.frameHazards = []; this.chargeSweeps = []; this.departedBonePoses = [];
        if (!Number.isFinite(dtMs) || dtMs <= 0) return;
        this.remainder += Math.min(dtMs, 100);
        while (this.remainder + 1e-7 >= BULL_RULES.tickMs) {
            this.remainder -= BULL_RULES.tickMs; this.step(player);
        }
        // A repeated render with no simulation step must still see active collision.
        if (this.state === 'charge') this.frameHazards.push({ x: this.x + 3, y: this.y + 6, width: 42, height: 28 });
        this.frameHazards.push(...this.bones.map(b => ({ x: b.x, y: b.y, width: b.width, height: b.height })));
    }
    private step(player: Box) {
        this.tick++; this.stateTick++;
        this.footContacts = this.footContacts.filter(contact => this.tick - contact.born < 16);
        if (this.state === 'defeated') return;
        for (const bone of this.bones) {
            const oldX=bone.x,oldY=bone.y;bone.x+=bone.vx;bone.life--;bone.age++;
            bone.y=bullBoneY(this.arena.floor,bone.age,bone.hopHeight>0,bone.hopHeight,bone.hopTicks);
            const passage=swept(bone,oldX);
            passage.y=Math.min(oldY,bone.y);passage.height=bone.height+Math.abs(oldY-bone.y);
            this.frameHazards.push(passage);
        }
        this.bones = this.bones.filter(b => {
            const active = b.life > 0 && b.x > this.arena.left && b.x + b.width < this.arena.right;
            // Keep each last pose across all fixed steps in this update, just like its sweep.
            if (!active) this.departedBonePoses.push({ ...b });
            return active;
        });
        switch (this.state) {
            case 'intro': if (this.stateTick >= 60) this.enter('idle'); break;
            case 'idle': if (this.stateTick >= BULL_RULES.rest) this.warn(player); break;
            case 'tell': if (this.stateTick >= BULL_RULES.tell) this.beginCharge(); break;
            case 'turn': if(this.stateTick>=BULL_RULES.turn) this.beginCharge(); break;
            case 'charge': {
                const oldX = this.x, oldTravel = this.chargeTravel;
                this.chargeTravel = this.chargePosition(this.stateTick);
                this.x = this.stateTick >= this.chargeTicks ? this.chargeTarget : this.chargeOrigin + this.facing * this.chargeTravel;
                this.chargeSpeed = this.x - oldX;
                if (this.stateTick === 1 || Math.floor(oldTravel / 45) !== Math.floor(this.chargeTravel / 45)) this.plantFoot();
                if (this.stateTick === this.chargeTicks - this.chargeRamp + 1) this.plantFoot(true);
                const passage = swept({ x: this.x + 3, y: this.y + 6, width: 42, height: 28 }, oldX + 3);
                this.frameHazards.push(passage); this.chargeSweeps.push(passage);
                if (this.stateTick >= this.chargeTicks) {
                    this.chargeSpeed = 0;
                    if(this.chargeIndex<this.chargeTotal){
                        // The return is promised by the first tell, then receives
                        // another complete stationary tell. Ribs remain closed.
                        this.chargeIndex++;this.facing=this.facing===-1?1:-1;
                        this.enter('turn');this.emit('tell');
                    }else{this.enter('brake');this.emit('brake');}
                }
                break;
            }
            case 'brake': if (this.stateTick >= BULL_RULES.brake) this.enter('recover'); break;
            case 'recover': if (this.stateTick >= BULL_RULES.recover) {
                this.bones = []; this.departedBonePoses = []; this.frameHazards = [];
                this.closingAfterMiss = true; this.enter('idle');
            } break;
            case 'rattle': if (this.stateTick >= BULL_RULES.rattle) {
                this.enter('bones'); this.releaseBones();
            } break;
            case 'bones':
                this.releaseBones();
                if (this.stateTick >= this.boneFlightTicks) { this.bones = []; this.frameHazards = []; this.departedBonePoses = []; this.enter('recover'); }
                break;
            case 'hurt': if (this.stateTick >= BULL_RULES.hurt) this.enter('idle'); break;
        }
    }
    private releaseBones() {
        let released = false;
        this.plannedBones.forEach((shot, index) => {
            if (shot.delay !== this.stateTick) return;
            const { x, y, width, height, vx, hopTicks, hopHeight, flightTicks } = shot;
            this.bones.push({ x, y, width, height, vx, hopTicks, hopHeight, age: 0, life: flightTicks, shot: index });
            released = true;
        });
        if (released) this.emit('bones');
    }
    /** Only a falling top contact from the real Player can punish an opening. */
    private tryHit(attack: Box): boolean {
        if (!this.vulnerable || !intersects(this, attack)) return false;
        this.hitThisOpening = true; this.closingAfterMiss = false; this.health--; this.bones = []; this.frameHazards = []; this.departedBonePoses = []; this.footContacts = [];
        this.emit(this.health <= 0 ? 'defeated' : 'hit'); this.enter(this.health <= 0 ? 'defeated' : 'hurt'); return true;
    }
    contact(player: Box, previous: Box, falling: boolean): 'none' | 'hurt' | 'bounce' | 'hit' | 'defeated' {
        if (['intro', 'hurt', 'defeated'].includes(this.state)) return 'none';
        const bodyContact = intersects(player, this);
        // WorldGame resolves danger before contact. Keep the charge sweep here,
        // so a valid stomp on the first braking frame wins over that frame's
        // residual sweep. A side crossing is still dangerous on the same frame.
        if (bodyContact && falling && previous.y + previous.height <= this.y + 10) {
            if (!this.vulnerable) return 'bounce';
            this.tryHit(player);
            return this.health === 0 ? 'defeated' : 'hit';
        }
        // A downward landing on the trailing swept edge is a safe bounce,
        // even when the bull has moved out from under the player this tick.
        // Only the present body can take damage; bone sweeps are not stompable.
        if (falling && previous.y + previous.height <= this.y + 10 && this.chargeSweeps.some(h => intersects(h, player))) return 'bounce';
        if (this.touches(player)) return 'hurt';
        return bodyContact && !this.vulnerable && !this.rearming ? 'hurt' : 'none';
    }
    touches(player: Box) { return this.frameHazards.some(h => intersects(h, player)); }
}
