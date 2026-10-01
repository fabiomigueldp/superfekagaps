/** Isolated Guaíra prototype. Values are logical pixels / fixed 60 Hz ticks. */
export interface Box { x: number; y: number; width: number; height: number }
export interface BullArena { left: number; right: number; floor: number }
export type BullState = 'intro' | 'idle' | 'tell' | 'charge' | 'brake' | 'recover' | 'rattle' | 'bones' | 'hurt' | 'defeated';
export interface Bone extends Box { vx: number; life: number }
export interface BullEvent { kind: 'tell' | 'charge' | 'brake' | 'bones' | 'hit' | 'defeated'; tick: number }
export const BULL_RULES = Object.freeze({ tickMs: 1000 / 60, tell: 42, rattle: 48, brake: 20, recover: 52, hurt: 30, maxBones: 2, boneLife: 72, speed: 5, health: 6 });
export const intersects = (a: Box, b: Box) => a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
const swept = (a: Box, previousX: number): Box => ({ ...a, x: Math.min(a.x, previousX), width: a.width + Math.abs(a.x - previousX) });
const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
export class SkeletonBullModel implements Box {
    readonly width = 48; readonly height = 34;
    x: number; y: number; state: BullState = 'intro'; stateTick = 0; tick = 0;
    health: number = BULL_RULES.health; facing: -1 | 1 = -1; cycle = 0;
    bones: Bone[] = []; events: BullEvent[] = []; private frameHazards: Box[] = [];
    private chargeSweeps: Box[] = [];
    private remainder = 0; private hitThisOpening = false;
    readonly arena: Readonly<BullArena>;
    constructor(arena: BullArena = { left: 4, right: 316, floor: 224 }) {
        if (![arena.left, arena.right, arena.floor].every(Number.isFinite) || arena.right - arena.left < 280) throw new Error('Bull arena requires finite bounds and at least 280px of clear floor');
        this.arena = Object.freeze({ ...arena }); this.x = arena.right - this.width - 20; this.y = arena.floor - this.height;
    }
    get vulnerable() { return (this.state === 'brake' || this.state === 'recover') && !this.hitThisOpening; }
    get warningTicks() { return this.state === 'rattle' ? BULL_RULES.rattle : BULL_RULES.tell; }
    get warningProgress() { return Math.min(1, this.stateTick / this.warningTicks); }
    get hazards(): readonly Box[] { return this.frameHazards; }
    get chargeLane(): Box { return { x: this.arena.left + 12, y: this.arena.floor - 28, width: this.arena.right - this.arena.left - 24, height: 28 }; }
    private enter(state: BullState) { this.state = state; this.stateTick = 0; }
    private emit(kind: BullEvent['kind']) { this.events.push({ kind, tick: this.tick }); }
    /** Direction locks when the warning starts. No tracking or attacks without warning. */
    private warn(player: Box) {
        this.facing = player.x + player.width / 2 < this.x + this.width / 2 ? -1 : 1;
        this.hitThisOpening = false;
        this.enter(this.cycle++ % 3 === 2 ? 'rattle' : 'tell'); this.emit('tell');
    }
    /** Maximum 100ms catch-up: tab resumption cannot silently consume an entire tell. */
    update(dtMs: number, player: Box) {
        this.events = []; this.frameHazards = []; this.chargeSweeps = [];
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
        if (this.state === 'defeated') return;
        for (const bone of this.bones) { const oldX = bone.x; bone.x += bone.vx; bone.life--; this.frameHazards.push(swept(bone, oldX)); }
        this.bones = this.bones.filter(b => b.life > 0 && b.x > this.arena.left && b.x + b.width < this.arena.right);
        switch (this.state) {
            case 'intro': if (this.stateTick >= 60) this.enter('idle'); break;
            case 'idle': if (this.stateTick >= 24) this.warn(player); break;
            case 'tell': if (this.stateTick >= BULL_RULES.tell) { this.enter('charge'); this.emit('charge'); } break;
            case 'charge': {
                const oldX = this.x;
                this.x = clamp(this.x + this.facing * BULL_RULES.speed, this.arena.left + 12, this.arena.right - this.width - 12);
                const passage = swept({ x: this.x + 3, y: this.y + 6, width: 42, height: 28 }, oldX + 3);
                this.frameHazards.push(passage); this.chargeSweeps.push(passage);
                if (this.x === this.arena.left + 12 || this.x === this.arena.right - this.width - 12 || this.stateTick >= 66) {
                    this.enter('brake'); this.emit('brake');
                }
                break;
            }
            case 'brake': if (this.stateTick >= BULL_RULES.brake) this.enter('recover'); break;
            case 'recover': if (this.stateTick >= BULL_RULES.recover) { this.bones = []; this.enter('idle'); } break;
            case 'rattle': if (this.stateTick >= BULL_RULES.rattle) {
                const origin = this.x + this.width / 2;
                this.bones = [0, 22].map(offset => ({ x: origin - this.facing * offset, y: this.arena.floor - 9, width: 10, height: 7, vx: this.facing * 3, life: BULL_RULES.boneLife }));
                this.enter('bones'); this.emit('bones');
            } break;
            case 'bones': if (this.stateTick >= BULL_RULES.boneLife) { this.bones = []; this.frameHazards = []; this.enter('recover'); } break;
            case 'hurt': if (this.stateTick >= BULL_RULES.hurt) this.enter('idle'); break;
        }
    }
    /** Only a falling top contact from the real Player can punish an opening. */
    private tryHit(attack: Box): boolean {
        if (!this.vulnerable || !intersects(this, attack)) return false;
        this.hitThisOpening = true; this.health--; this.bones = []; this.frameHazards = [];
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
        return bodyContact && !this.vulnerable ? 'hurt' : 'none';
    }
    touches(player: Box) { return this.frameHazards.some(h => intersects(h, player)); }
}
