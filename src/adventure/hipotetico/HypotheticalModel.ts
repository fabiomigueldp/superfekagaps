import type { Rect } from '../../types';
import { clamp, overlaps } from '../types';
import { dinosaurFootAnchor, dinosaurTail, hypotheticalMotion, riderBend, smoothMotion, type DinosaurMotion } from './HypotheticalMotion';
import { HypotheticalBackdrop } from './HypotheticalBackdrop';
import { ARENA_COLUMNS, CHASE_ATTACKS, CHASE_EXIT, CHASE_WIDTH, CHASE_GAPS, CHASE_BREAKS } from './HypotheticalLayout';
import { HypotheticalSiege, SIEGE_WIDTH } from './HypotheticalSiege';
import {chaseDeckSpans,chaseMaterialAt,chaseTerraceFall,chaseRuinAt,CHASE_WATER_Y} from './HypotheticalChaseDetails';
import { RIFLE_BURSTS, RIFLE_SPEED, type GunImpact } from './HypotheticalGunfire';
import {chaseReactionStarts,updateChaseReactions} from './HypotheticalChaseLife';
import {ARRIVAL,arrivalGate} from './HypotheticalArrival';
import {SCENIC_STARTS} from './HypotheticalDevastation';

export type HypotheticalAct = 'chase' | 'siege' | 'duel';
export type HypotheticalState = 'arrival' | 'rest' | 'tell' | 'reload' | 'attack' | 'turn' | 'recover' | 'hurt' | 'roar' | 'won';
export type HypotheticalAttack = 'rifle' | 'charge' | 'bite' | 'leap' | 'tail';
export interface Shot extends Rect { vx: number; vy: number; age: number; life: number; kind: 'bullet' | 'wave' | 'rubble'; px: number; py: number }
export interface Dust { x: number; y: number; born: number; kind: 'step' | 'stone' | 'hit' | 'shell' | 'clasp' | 'skid'; direction?: number }
export interface FallingMark { x: number; born: number }
export interface BulletImpact extends GunImpact {}
export type FightEvent = 'warning' | 'shot' | 'impact' | 'splash' | 'collapse-water' | 'debris-land' | 'reload' | 'distant-shot' | 'distant-hit' | 'distant-debris' | 'step' | 'slam' | 'hit' | 'break' | 'snare' | 'won';
export const HYPOTHETICAL = Object.freeze({ floor: 224, chaseEnd: CHASE_EXIT, health: 9, step: 1000 / 60, warning: 54, recovery: 156 });
const rifleBursts = RIFLE_BURSTS;
const patterns: readonly (readonly HypotheticalAttack[])[] = [
    ['rifle', 'charge', 'bite', 'leap'],
    ['leap', 'bite', 'rifle', 'tail', 'charge'],
    ['charge', 'rifle', 'tail', 'leap', 'bite'],
];
/** Columns beneath the walkable balconies stop bullets, but never trap Feka. */
export const ARENA_COVER: readonly Rect[] = ARENA_COLUMNS;
const sweep = (a: Rect, b: Rect): Rect => ({ x: Math.min(a.x, b.x), y: Math.min(a.y, b.y),
    width: Math.max(a.x + a.width, b.x + b.width) - Math.min(a.x, b.x),
    height: Math.max(a.y + a.height, b.y + b.height) - Math.min(a.y, b.y) });

/** First contact of the moving projectile rectangle, including its painted width. */
function surfaceHit(s: Shot, wall: Rect) {
    let enter = 0, leave = 1, nx = 0, ny = 0;
    for (const [position, speed, low, high, axis] of [
        [s.px, s.vx, wall.x - s.width, wall.x + wall.width, 0],
        [s.py, s.vy, wall.y - s.height, wall.y + wall.height, 1],
    ]) {
        if (Math.abs(speed) < 1e-8) { if (position < low || position > high) return null; continue; }
        const a = (low - position) / speed, b = (high - position) / speed;
        const near = Math.min(a, b), far = Math.max(a, b);
        if (near > enter) { enter = near; nx = axis === 0 ? -Math.sign(speed) : 0; ny = axis === 1 ? -Math.sign(speed) : 0; }
        leave = Math.min(leave, far);
        if (enter > leave) return null;
    }
    if (leave < 0 || enter > 1) return null;
    if (!nx && !ny) { if (Math.abs(s.vx) > Math.abs(s.vy)) nx = -Math.sign(s.vx); else ny = -Math.sign(s.vy); }
    return { t: enter, nx, ny };
}

/** Combat owns time and geometry. Drawing never advances an attack or creates a particle. */
export class HypotheticalModel {
    state: HypotheticalState = 'arrival'; attack: HypotheticalAttack = 'rifle';
    tick = 0; age = 0; health: number; x = 244; y: number = HYPOTHETICAL.floor; facing: -1 | 1 = -1;
    targetX = 80; targetY = 211; originX = 244; travel = 0; velocity = 0; cycle = 0; leg = 0;
    shots: Shot[] = []; dust: Dust[] = []; marks: FallingMark[] = []; events: FightEvent[] = [];
    impacts: BulletImpact[] = []; readonly backdrop: HypotheticalBackdrop;
    readonly route: HypotheticalSiege;
    private readonly backdropOffset: number;
    private arrivalWait=0;
    armed = [0, 0]; snared = false; muzzle = 0; destroyed = 0; backgroundX = -70; backgroundStamp = 0;
    get wave() { return Math.min(3, this.route.cleared + 1); }
    nextAct = false; volley = 0; heat = 0; reloadX = 0;
    chainStep = 0; followup: HypotheticalAttack | null = null;
    chainTotal=1; private adaptiveFinisher=false;
    motionFrom?:DinosaurMotion; motionSpeed=0; riderSway=0; private previousVelocity=0;
    pivotAge=12; pivotFrom:-1|1=-1; turnFacing:-1|1=1;
    private remainder = 0; private frameHazards: Rect[] = []; private sequence = 0;
    private bowFrom = 0;
    private weaponFrom=-.15;
    pursuitIndex=0; pursuitKind:'high'|'low'|'ram'='high'; pursuitTell=52;
    terraceDebris:Array<{x:number;y:number;width:number;born:number}>=[];
    bridgeDebris:Array<{x:number;born:number;material:number}>=[];
    chaseBreaks:number[]=CHASE_BREAKS.map(()=>-1);
    chaseReactions:number[]=chaseReactionStarts(0);
    constructor(readonly act: HypotheticalAct = 'chase', health: number = HYPOTHETICAL.health, cleared = 0, readonly chaseStart=0, readonly arrivalSeen=false) {
        this.route = new HypotheticalSiege(cleared);
        this.backdrop = new HypotheticalBackdrop(act === 'siege');
        this.backdropOffset = act === 'siege' ? (this.route.cleared?SCENIC_STARTS[Math.min(2,this.route.cleared)]:arrivalSeen?ARRIVAL.release:0) : 0;
        // A checkpoint preserves the ruined districts and advances the distant rider
        // to the same street. Replaying only this deterministic scenery never creates
        // foreground damage, emits old audio, or advances Feka's encounter clock.
        for(let tick=1;tick<=this.backdropOffset;tick++)this.backdrop.update(tick);
        this.destroyed = this.backdrop.breaches.filter(t=>t>=0).length;
        this.backgroundX = this.backdrop.x;
        this.health = health;
        if (act === 'chase') { this.x = chaseStart?chaseStart-114:-18; this.facing = 1;this.pursuitIndex=CHASE_ATTACKS.findIndex(a=>a.x>=chaseStart);this.chaseBreaks=CHASE_BREAKS.map(s=>s.x<this.x?-1000:-1);if(chaseStart)this.state='rest'; }
        if (act === 'chase') this.chaseReactions=chaseReactionStarts(chaseStart);
        if (act === 'siege') this.state = 'rest';
    }
    get arrivalSkipped(){return this.arrivalSeen||this.route.cleared>0&&this.backdropOffset>0;}
    get arrivalTime(){return this.tick-this.arrivalWait;}
    get arrival(){return arrivalGate(this.arrivalTime,this.arrivalSkipped);}
    get forecourt(){return arrivalGate(this.arrivalTime,this.arrivalSkipped,ARRIVAL.firstRelease);}
    get phaseNumber() { return this.health > 6 ? 1 : this.health > 3 ? 2 : 3; }
    get vulnerable() { return this.act === 'duel' && this.state === 'recover' && this.age >= 14; }
    get weakpoint(): Rect { return { x: this.x - 12, y: this.y - 65, width: 24, height: 15 }; }
    get body(): Rect { return { x: this.x - 28, y: this.y - (this.attack === 'charge' ? 46 : 64), width: 58, height: this.attack === 'charge' ? 46 : 64 }; }
    get bow() { const to = ['recover','hurt','won'].includes(this.state) ? 1 : 0; return this.bowFrom + (to - this.bowFrom) * smoothMotion(this.age / 14); }
    get tailSegments(): Rect[] {
        const m = hypotheticalMotion(this), path = dinosaurTail(-43 + this.bow * 13 + m.compression, m.tail);
        const a = path[1], z = path[2];
        return Array.from({length: 9}, (_, i) => { const t=i/8; return {x:this.x+this.facing*(a[0]+(z[0]-a[0])*t)-3,y:this.y+a[1]+(z[1]-a[1])*t-4,width:6,height:8}; });
    }
    get tailBox(): Rect { return this.tailSegments.reduce(sweep); }
    get biteBox(): Rect {
        const m=hypotheticalMotion(this),neck=this.y-59+this.bow*25+m.neckDrop+m.compression;
        return {x:this.x+(this.facing<0?-68:26),y:neck+4,width:42,height:13+m.jaw*13};
    }
    get biteEndX(){return clamp(this.targetX-this.facing*37,52,268);}
    get warningTicks() { return this.act==='chase'?this.pursuitTell:HYPOTHETICAL.warning - (this.phaseNumber - 1) * 5; }
    get reloadTicks() { return 48; }
    get rifleSchedule() { return rifleBursts[this.phaseNumber - 1]; }
    get rifleLastShot() { return this.rifleSchedule[this.rifleSchedule.length - 1]; }
    get casualties() { return this.backdrop.casualties; }
    get openingTicks() { return HYPOTHETICAL.recovery + (this.snared ? 54 : 0); }
    get chainLength() { return this.chainTotal; }
    get chaining() { return this.chainLength > 1 && ['tell','attack','reload','turn'].includes(this.state); }
    get visualFacing(){return this.pivotAge<6?this.pivotFrom:this.facing;}
    get pivot(){return this.pivotAge>=12?0:Math.sin(Math.PI*this.pivotAge/12);}
    get won() { return this.state === 'won'; }
    get rifleShoulder() { const m=hypotheticalMotion(this);return {x:this.x+this.facing*(7-m.recoil+m.tuck*10+riderBend(14,m.riderLean)),y:this.y+m.saddle+m.riderDrop-14}; }
    get rifleAngle() { const s=this.rifleShoulder;return Math.atan2(this.targetY-s.y,Math.max(1,(this.targetX-s.x)*this.facing)); }
    get aim() { const a=this.rifleAngle,s=this.rifleShoulder;return {x:s.x+this.facing*31*Math.cos(a),y:s.y+31*Math.sin(a)}; }
    get weaponAngle(){
        const m=hypotheticalMotion(this),target=this.won?-.15+smoothMotion(this.age/35)*1.05
            :['tell','attack','reload'].includes(this.state)&&this.attack==='rifle'?this.rifleAngle-m.reload*.65:-.15;
        const t=this.state==='attack'&&this.attack==='rifle'?1:smoothMotion(this.age/12);
        return this.weaponFrom+(target-this.weaponFrom)*t;
    }
    get hint(): string { return `${this.chaining?`${this.chainStep+1}/${this.chainLength}: `:''}${this.actionHint}`; }
    private get actionHint(): string {
        if (this.won) return 'HIPOTESE DERRUBADA! ENTER: REJOGAR';
        if (this.act === 'chase') return this.tick < 110 ? 'CORRA: SHIFT + DIREITA. PULE OS VAOS'
            :['tell','attack'].includes(this.state)?this.pursuitKind==='high'?'TIRO ALTO! FIQUE BAIXO OU SALTE POR CIMA'
            :this.pursuitKind==='low'?'RAJADA BAIXA! SALTE QUANDO ELA CHEGAR':'INVESTIDA! SALTE A ONDA DE DESTROCOS'
            :'A PONTE CEDE! SIGA AS BORDAS CLARAS';
        if (this.act === 'siege') return this.marks.length ? 'PEDRAS! SAIA DAS MARCAS NO CHAO' : !this.route.active
            ? this.route.cleared ? this.route.passageOpen ? 'PASSAGEM LIVRE! SIGA PARA A DIREITA' : 'PORTAO ABRINDO. TRECHO SALVO' : 'PORTARIA ADIANTE. PREPARE O SALTO'
            : 'DERROTE A PATRULHA PARA ABRIR O PORTAO';
        if (this.vulnerable) return this.snared ? 'PRESO NO CABO! PULE NO CAVALEIRO' : 'AGORA! PULE NO CAVALEIRO';
        if (this.state === 'recover') return 'ELE SE ABAIXA. APROXIME-SE';
        if (this.state === 'hurt') return 'UM LACRE DA SELA QUEBROU';
        if (this.state === 'rest') return 'CABOS: PULE + BAIXO NAS ALAVANCAS';
        if (this.state === 'roar' || this.state === 'arrival') return this.phaseNumber === 1 ? 'LEIA A MIRA. ACERTE QUANDO ABAIXAR' : 'NOVA FASE! MAIS ATAQUES COMBINADOS';
        if (this.state === 'turn') return 'VAI VOLTAR! PREPARE OUTRO SALTO';
        if (this.state === 'reload') return 'RECARREGANDO! ELE VAI MIRAR DE NOVO';
        if (this.attack === 'rifle') return 'RAJADA MIRADA! COBERTURA OU SALTO';
        if (this.attack === 'charge') return 'INVESTIDA! PULE OU ARME O CABO';
        if (this.attack === 'leap') return 'SAIA DA MARCA. DEPOIS PULE A ONDA';
        if (this.attack === 'tail') return 'CAUDA BAIXA! PULE OU USE A SACADA';
        return 'MORDIDA! SALTE OU SAIA DOS DENTES';
    }
    private enter(state: HypotheticalState,from=hypotheticalMotion(this),weapon=this.weaponAngle) {
        this.motionFrom=from;this.weaponFrom=weapon;this.bowFrom=this.bow;this.state=state;this.age=0;
    }
    private face(direction:-1|1){
        if(direction===this.facing)return;
        this.pivotFrom=this.visualFacing;this.facing=direction;this.pivotAge=this.pivotFrom===direction?12:0;
    }
    private emit(event: FightEvent) { this.events.push(event); }
    private particle(kind: Dust['kind'], x: number = this.x, y: number = this.y) {
        this.dust.push({ kind, x, y, born: this.tick, ...(kind==='shell'?{direction:this.facing}:{}) });
        if (this.dust.length > 48) this.dust.shift();
    }
    private footstep(oldTravel:number) {
        if(Math.floor(this.travel/(Math.PI*11))>Math.floor(oldTravel/(Math.PI*11))){
            const m=hypotheticalMotion(this),rear=Math.floor(this.travel/(Math.PI*11))%2===1;
            const foot=dinosaurFootAnchor(this.travel/11,rear,(1-this.bow)*m.stride,m.tuck,m.brace);
            this.particle('step',this.x+this.facing*(foot[0]+3),this.y+foot[1]);this.emit('step');
        }
    }
    cancelAttacks() { this.shots = []; this.marks = []; this.frameHazards = []; this.events = [];this.muzzle=0;this.followup=null;this.adaptiveFinisher=false; this.backdrop.cancel(); }
    arm(index: number) {
        if (this.act !== 'duel' || this.won || index < 0 || index > 1 || this.armed[index] > 0) return;
        this.armed[index] = 240; this.particle('shell', index ? 278 : 38, HYPOTHETICAL.floor - 8);
    }
    private shoot(x: number, y: number, tx: number, ty: number, speed: number, kind: Shot['kind'] = 'bullet') {
        const d = Math.max(1, Math.hypot(tx - x, ty - y));
        this.shots.push({ x, y, px: x, py: y, width: kind === 'wave' ? 15 : 5, height: kind === 'wave' ? 12 : 5,
            vx: (tx - x) / d * speed, vy: (ty - y) / d * speed, age: 0, life: 190, kind });
        if (this.shots.length > 24) this.shots.shift();
        if (kind === 'bullet') {
            this.muzzle = 5;this.heat=Math.min(1,this.heat+.24); this.emit('shot');
            const s=this.rifleShoulder,a=this.rifleAngle;
            this.particle('shell',s.x+this.facing*(Math.cos(a)*9+Math.sin(a)*2),s.y+Math.sin(a)*9-Math.cos(a)*2);
        }
    }
    private open() {
        this.shots = []; this.frameHazards = []; this.y = HYPOTHETICAL.floor;this.followup=null;this.adaptiveFinisher=false;
        this.enter('recover');
    }
    private warn(player: Rect) {
        const attack = patterns[this.phaseNumber - 1][this.cycle++ % patterns[this.phaseNumber - 1].length];
        this.chainStep=0;
        // Short authored combinations teach distinct answers: retreat then jump,
        // leave rifle cover for a landing, or move out of a tail sweep into a bite.
        this.followup=this.phaseNumber===2&&attack==='leap'?'rifle'
            :this.phaseNumber===2&&attack==='bite'?'tail'
            :this.phaseNumber===3&&attack==='rifle'?'leap'
            :this.phaseNumber===3&&attack==='tail'?'bite':null;
        this.adaptiveFinisher=this.phaseNumber===3&&attack==='rifle';
        this.chainTotal=1+(this.followup?1:0)+(this.adaptiveFinisher?1:0);
        this.prepare(attack,player);
    }
    private prepare(attack:HypotheticalAttack,player:Rect) {
        const pose=hypotheticalMotion(this),weapon=this.weaponAngle;
        this.attack=attack;
        this.snared = false; this.leg = 0; this.volley = 0;
        let facing:-1|1=player.x+player.width/2<this.x?-1:1;
        if(this.attack==='tail')facing=facing===-1?1:-1;
        if(this.attack==='charge')facing=this.x>160?-1:1;
        this.face(facing);
        this.targetX = clamp(player.x + player.width / 2, 36, 284);
        this.targetY = clamp(player.y + player.height / 2, 135, 211);
        this.originX = this.x; this.enter('tell',pose,weapon); this.emit('warning');
    }
    private finishAttack(player:Rect) {
        if(this.followup&&!this.snared){
            // Retreating far from a bite changes its follow-up into a leap. Both
            // responses still announce a fresh, fully committed landing/strike.
            const distance=Math.abs(player.x+player.width/2-this.x);
            const next=this.adaptiveFinisher&&this.chainStep===1?(distance<=100?'bite':'charge')
                :this.followup==='tail'&&distance>120?'leap':this.followup;
            this.chainStep++;
            this.followup=this.adaptiveFinisher&&this.chainStep===1?'bite':null;
            if(this.chainStep===2)this.adaptiveFinisher=false;
            // A new tell never inherits old bullets, contact damage or a false opening.
            this.shots=[];this.frameHazards=[];this.muzzle=0;this.y=HYPOTHETICAL.floor;
            this.prepare(next,player);
        }else this.open();
    }
    private skid(){this.dust.push({kind:'skid',x:this.x-this.facing*12,y:this.y,born:this.tick,direction:this.facing});if(this.dust.length>48)this.dust.shift();}
    private trackRifle(player: Rect) {
        this.targetX = clamp(player.x + player.width / 2, 36, 284);
        this.targetY = clamp(player.y + player.height / 2, 135, 211);
        if(Math.abs(this.targetX-this.x)>18)this.face(this.targetX<this.x?-1:1);
    }
    update(dt: number, player: Rect, livingGuards = 0) {
        this.events = []; this.frameHazards = [];
        if (!Number.isFinite(dt) || dt <= 0) return;
        // The host already uses 60 Hz. Bound exceptional catch-up to avoid an invisible salvo.
        this.remainder += Math.min(dt, 100);
        while (this.remainder + 1e-8 >= HYPOTHETICAL.step) {
            this.remainder -= HYPOTHETICAL.step; this.step(player, livingGuards);
        }
    }
    private step(player: Rect, livingGuards: number) {
        const acceleration=(this.velocity-this.previousVelocity)*this.facing;
        this.previousVelocity=this.velocity;
        this.riderSway+=(Math.max(-5,Math.min(5,-acceleration*3))-this.riderSway)*.3;
        this.motionSpeed+=(this.velocity*this.facing-this.motionSpeed)*.25;
        this.pivotAge=Math.min(12,this.pivotAge+1);
        this.tick++; this.age++; this.muzzle = Math.max(0, this.muzzle - 1);this.velocity=0;this.heat=Math.max(0,this.heat-.004);
        this.dust = this.dust.filter(p => this.tick - p.born < (p.kind==='shell'?64:40));
        this.impacts = this.impacts.filter(p => this.tick - p.born < 180);
        this.terraceDebris=this.terraceDebris.filter(p=>this.tick-p.born<80);
        this.bridgeDebris=this.bridgeDebris.filter(p=>this.tick-p.born<48);
        if (this.won || this.nextAct) return;
        this.armed = this.armed.map(n => Math.max(0, n - 1));
        this.backgroundStamp = Math.max(0, this.backgroundStamp - 1);
        this.advanceShots();
        if (this.act === 'chase') { this.chase(player); return; }
        if (this.act === 'siege') { this.siege(player, livingGuards); return; }
        if (this.state === 'arrival' || this.state === 'roar') {
            if (this.age >= 105) { this.enter('rest'); }
        } else if (this.state === 'rest') {
            if (this.age >= 32) this.warn(player);
        } else if (this.state === 'tell') {
            // First half tracks; the last 24 ticks always show the committed target.
            if (this.age < this.warningTicks - 24 && this.attack !== 'charge') {
                this.targetX = clamp(player.x + player.width / 2, 36, 284);
                this.targetY = clamp(player.y + player.height / 2, 135, 211);
                if (this.attack === 'rifle') this.trackRifle(player);
                else {
                    if(Math.abs(this.targetX-this.x)>18){
                        let facing:-1|1=this.targetX<this.x?-1:1;
                        if(this.attack==='tail')facing=facing===-1?1:-1;
                        this.face(facing);
                    }
                }
            }
            if (this.age >= this.warningTicks) { this.enter('attack'); this.originX = this.x; }
        } else if (this.state === 'reload') {
            const oldX = this.x, oldTravel = this.travel;
            this.x = this.originX + (this.reloadX - this.originX) * smoothMotion(this.age / 20);
            this.velocity = this.x - oldX; this.travel += Math.abs(this.velocity); this.footstep(oldTravel);
            if (this.age < this.reloadTicks - 24) this.trackRifle(player);
            if (this.age === 12) { this.particle('shell', this.x, this.y - 58); this.emit('reload'); }
            if (this.age === 30) this.emit('reload');
            if (this.age >= this.reloadTicks) this.enter('attack');
        } else if (this.state === 'turn') {
            if(this.age===8||this.age===16)this.skid();
            if(this.age===12)this.face(this.turnFacing);
            if (this.age >= 38) { this.originX = this.x; this.leg++; this.enter('attack'); }
        } else if (this.state === 'attack') this.perform(player);
        else if (this.state === 'recover' && this.age >= this.openingTicks) { this.enter('rest'); }
        else if (this.state === 'hurt' && this.age >= 50) this.enter(this.health === 6 || this.health === 3 ? 'roar' : 'rest');
    }
    private perform(player:Rect) {
        const oldBody = this.body, oldX = this.x;
        const floor = HYPOTHETICAL.floor;
        if (this.attack === 'rifle') {
            if (this.rifleSchedule.includes(this.age)) {
                // Recoil is set before taking the anchor; the visible muzzle and shot share a point.
                this.muzzle = 5;
                const muzzle = this.aim;
                const a=this.rifleAngle;
                this.shoot(muzzle.x,muzzle.y,muzzle.x+this.facing*Math.cos(a)*200,muzzle.y+Math.sin(a)*200,RIFLE_SPEED[this.phaseNumber-1]);
            }
            if (this.phaseNumber > 1 && this.volley === 0 && this.age >= this.rifleLastShot + 24) {
                this.originX = this.x;
                this.reloadX = clamp(this.x + this.facing * (this.phaseNumber === 3 ? 44 : 28), 54, 266);
                this.volley = 1; this.enter('reload'); this.emit('warning');
            } else if (this.age >= this.rifleLastShot + 70) this.finishAttack(player);
        } else if (this.attack === 'charge') {
            const end = this.facing < 0 ? 54 : 266;
            const t = clamp(this.age / 50, 0, 1), eased = t * t * (3 - 2 * t);
            this.x = this.originX + (end - this.originX) * eased;
            if(this.age===42)this.skid();
            if (this.age > 6) this.frameHazards.push(sweep(oldBody, this.body));
            const snare = this.x < 94 ? 0 : this.x > 226 ? 1 : -1;
            if (snare >= 0 && this.armed[snare] > 0 && this.age > 12) {
                this.armed[snare] = 0; this.snared = true; this.emit('snare'); this.particle('hit'); this.open();
            } else if (this.age >= 50) {
                this.emit('slam'); this.particle('stone');
                if (this.phaseNumber === 3 && this.leg === 0) { this.turnFacing=this.facing===-1?1:-1;this.enter('turn'); this.emit('warning'); }
                else this.finishAttack(player);
            }
        } else if (this.attack === 'leap') {
            if (this.age <= 58) {
                const t = this.age / 58;
                this.x = this.originX + (clamp(this.targetX, 58, 262) - this.originX) * smoothMotion(t);
                // The tucked silhouette, floor mark and Feka all fit below the native HUD.
                this.y = floor - Math.sin(Math.PI * t) * 48;
                // The takeoff passes upward out of the player's space. Damage
                // begins on descent; the announced landing remains the threat.
                if (this.age > 29) this.frameHazards.push(sweep(oldBody, this.body));
            }
            if (this.age === 58) {
                this.y = floor; this.emit('slam'); this.particle('stone');
                for (const d of [-1, 1]) this.shoot(this.x + d * 29, floor - 12, this.x + d * 130, floor - 12, 2.5 + this.phaseNumber * .35, 'wave');
            }
            if (this.age >= 114) this.finishAttack(player);
        } else if (this.attack === 'bite') {
            const end = this.biteEndX;
            const t = clamp(this.age / 24, 0, 1);
            this.x = this.originX + (end - this.originX) * smoothMotion(t);
            if (this.age >= 12 && this.age <= 38) this.frameHazards.push(this.biteBox);
            if (this.age === 24) { this.emit('slam'); this.particle('step', this.x + this.facing * 58); }
            if (this.age >= 51) this.finishAttack(player);
        } else {
            if (this.age >= 12 && this.age <= 32) this.frameHazards.push(...this.tailSegments);
            if (this.age === 20) { this.emit('slam'); this.particle('stone', this.x - this.facing * 70); }
            if (this.phaseNumber === 3 && this.age === 38) this.shoot(this.x - this.facing * 75, floor - 12, this.x - this.facing * 250, floor - 12, 3, 'wave');
            if (this.age >= 87) this.finishAttack(player);
        }
        this.velocity=this.x-oldX;
        if(this.attack!=='leap'){const oldTravel=this.travel;this.travel+=Math.abs(this.velocity);this.footstep(oldTravel);}
    }
    private chase(player: Rect) {
        if (this.tick < (this.chaseStart?18:60)) return;
        for(const piece of this.terraceDebris){
            const age=this.tick-piece.born,contact=chaseTerraceFall(piece,age).contact;
            if(age>=contact&&age-1<contact)this.emit('collapse-water');
        }
        for(const [i,site]of CHASE_BREAKS.entries()){
            const at=this.chaseBreaks[i];if(at<0)continue;
            const age=this.tick-at,contact=chaseRuinAt(age,site.kind==='crane'?78:site.kind==='sluice'?58:69).beamContact;
            if(age>=contact&&age-1<contact)this.emit('debris-land');
        }
        // Converge smoothly on a visible pursuit distance, without teleporting.
        // At Feka's 3.5px run speed the gap settles at 110px, inside the camera.
        const surge=this.pursuitKind==='ram'&&this.state==='attack'?(this.age<20?.8:this.age<52?-.45:0):0;
        const speed = clamp(3.5 + (player.x - this.x - 110) * .025+surge, 2.25, 6);
        // Catch up and keep pressure after the helmet absorbs the first hit.
        // The pursuer must never run harmlessly through a stationary Feka.
        const movement = Math.min(speed, Math.max(0, player.x + 8 - this.x));
        const oldTravel=this.travel;this.x += movement; this.travel += movement;this.velocity=movement;
        // A moving pursuer commits to a forward angle, not a world point it can
        // overtake halfway through the burst. The whole tell remains on screen.
        this.targetX=this.x+240;this.targetY=this.pursuitKind==='high'?this.rifleShoulder.y-4:HYPOTHETICAL.floor-12;
        this.footstep(oldTravel);
        this.frameHazards.push(this.body);
        for(const [i,site] of CHASE_BREAKS.entries())if(this.chaseBreaks[i]===-1&&this.x+56>=site.x){this.chaseBreaks[i]=this.tick;this.emit('break');}
        updateChaseReactions(this.chaseReactions,this.tick,this.x);
        this.destroyed = Math.min(16, Math.floor(Math.max(0, this.x - 120) / 260));
        if (this.state === 'arrival') this.enter('rest');
        const cue=CHASE_ATTACKS[this.pursuitIndex];
        if (this.state === 'rest' && this.age >= 24 && cue&&player.x>=cue.x) {
            this.pursuitKind=cue.kind;this.pursuitTell=cue.tell;this.pursuitIndex++;
            this.attack=cue.kind==='ram'?'charge':'rifle';this.enter('tell'); this.emit('warning');
        } else if (this.state === 'tell' && this.age >= this.warningTicks) this.enter('attack');
        else if (this.state === 'attack') {
            if(this.pursuitKind==='ram'){
                if(this.age===12){this.shoot(this.x+40,HYPOTHETICAL.floor-12,this.x+240,HYPOTHETICAL.floor-12,7,'wave');this.emit('slam');this.particle('stone',this.x+40);}
            }else if((this.pursuitKind==='high'?[1,7,13]:this.pursuitIndex>=5?[1,6,11,41,46,51]:[1,7,13]).includes(this.age)){
                this.muzzle=5;const m=this.aim,a=this.rifleAngle;
                this.shoot(m.x,m.y,m.x+Math.cos(a)*200,m.y+Math.sin(a)*200,this.pursuitKind==='high'?6.6:6.8);
            }
            if (this.age >= 78) {this.enter('rest');this.attack='rifle';}
        }
        if (player.x >= HYPOTHETICAL.chaseEnd) { this.nextAct = true; this.cancelAttacks(); }
    }
    private siege(player: Rect, livingGuards: number) {
        if(!this.arrivalSkipped&&this.arrivalTime>ARRIVAL.hold&&this.backdrop.tick<=ARRIVAL.hold&&player.x<ARRIVAL.watchX)this.arrivalWait++;
        if(this.arrival.ready)this.route.update(player.x, livingGuards);
        if (this.route.openedThisTick) {
            this.shots = []; this.marks = []; this.frameHazards = []; this.emit('snare');
        }
        const backdropTick=this.arrivalTime+this.backdropOffset;
        const advanced=backdropTick>this.backdrop.tick;
        if(advanced)this.backdrop.update(backdropTick);
        this.backgroundX = this.backdrop.x;
        if(advanced)this.events.push(...this.backdrop.events);
        this.destroyed=this.backdrop.breaches.filter(t=>t>=0).length;
        if(advanced&&this.backdrop.events.includes('break'))this.backgroundStamp=120;
        const combatTick=this.arrivalTime-(this.arrivalSkipped?0:ARRIVAL.release);
        if (combatTick > 160 && combatTick % 210 === 0 && livingGuards > 0 && this.route.active) {
            this.marks.push({ x: clamp(player.x + player.width / 2, 22, SIEGE_WIDTH - 22), born: this.tick }); this.emit('warning');
        }
        for (const mark of this.marks) if (this.tick - mark.born === 60) {
            this.shoot(mark.x - 4, 90, mark.x - 4, 220, 3.2, 'rubble');
        }
        this.marks = this.marks.filter(mark => this.tick - mark.born < 104);
        if (this.route.canExit(player.x)) { this.nextAct = true; this.cancelAttacks(); }
    }
    private advanceShots() {
        for (const s of this.shots) {
            s.px = s.x; s.py = s.y; s.x += s.vx; s.y += s.vy; s.age++; s.life--;
            if(s.kind==='wave'&&this.act==='chase'&&CHASE_GAPS.some(([a,z])=>s.x+7>=a*16&&s.x+7<z*16)){s.life=0;continue;}
            const swept = sweep(s, { ...s, x: s.px, y: s.py });
            if (s.kind === 'bullet') {
                const walls = this.act==='chase' ? [...chaseDeckSpans(this.x),{x:-200,y:CHASE_WATER_Y,width:CHASE_WIDTH+400,height:64}]
                    : [...(this.act === 'duel' ? ARENA_COVER : []), { x: -200, y: HYPOTHETICAL.floor, width: CHASE_WIDTH+400, height: 64 }];
                const hits = walls.map(w => {const h=surfaceHit(s,w);return h?{...h,water:this.act==='chase'&&w.y===CHASE_WATER_Y}:null;}).filter((h): h is NonNullable<typeof h> => !!h).sort((a, b) => a.t - b.t);
                const hit = hits[0];
                if (hit) {
                    const x = s.px + s.vx * hit.t, y = s.py + s.vy * hit.t;
                    this.impacts.push({ x: x + s.width / 2 - hit.nx * s.width / 2, y: y + s.height / 2 - hit.ny * s.height / 2,
                        nx: hit.nx, ny: hit.ny, born: this.tick, fromX:s.px+s.width/2,fromY:s.py+s.height/2,material:hit.water?'water':this.act==='chase'?chaseMaterialAt(x):'stone' });
                    if (this.impacts.length > 24) this.impacts.shift();
                    this.emit(hit.water?'splash':'impact');
                    // Preserve danger in front of the cover, never beyond its surface.
                    this.frameHazards.push(sweep({ ...s, x: s.px, y: s.py }, { ...s, x, y }));
                    s.life = 0; continue;
                }
            }
            if (s.y + s.height >= HYPOTHETICAL.floor && s.kind !== 'wave' && !(s.kind==='bullet'&&this.act==='chase')) {
                s.life = 0; this.particle('stone', s.x, HYPOTHETICAL.floor); continue;
            }
            this.frameHazards.push(swept);
        }
        this.shots = this.shots.filter(s => s.life > 0 && s.x > -150 && s.x < (this.act === 'chase' ? CHASE_WIDTH+120 : this.act === 'siege' ? SIEGE_WIDTH + 120 : 440));
    }
    contact(player: Rect, previous: Rect, falling: boolean): 'none' | 'hurt' | 'bounce' | 'hit' {
        if (this.won || this.nextAct) return 'none';
        const weak = this.weakpoint;
        if (this.vulnerable && falling && player.x + player.width > weak.x && player.x < weak.x + weak.width
            && previous.y + previous.height <= weak.y + 6 && player.y + player.height >= weak.y) {
            this.health--; this.sequence++; this.cancelAttacks(); this.particle('hit', this.x, weak.y);
            const m=hypotheticalMotion(this),stud=-15+Math.floor(this.health/3)*9+(this.health%3)*2;
            this.particle('clasp',this.x+this.facing*stud,this.y+m.saddle+6);this.emit('hit');
            // Every new phase starts with its own introductory pattern, including after retry.
            if(this.health===6||this.health===3)this.cycle=0;
            if (this.health <= 0) { this.enter('won'); this.emit('won'); }
            else this.enter('hurt');
            return 'hit';
        }
        if (this.state === 'hurt' || this.state === 'roar' || this.state === 'recover' || this.state === 'arrival') return 'none';
        if (this.frameHazards.some(r => overlaps(player, r))) return 'hurt';
        // Attack-specific swept boxes above are the whole contact contract.
        // An animation changing state cannot invent an extra body hit on tick zero.
        return 'none';
    }
    get hits() { return this.sequence; }
}
