import type { HypotheticalModel } from './HypotheticalModel';
import type { Point } from '../WorldPainting';
import { gunRecoil } from './HypotheticalGunfire';
import {chasePerformance} from './HypotheticalChasePerformance';

const unit = (n: number) => Math.max(0, Math.min(1, n));
export const smoothMotion = (n: number) => { const t = unit(n); return t * t * (3 - 2 * t); };
export interface DinosaurMotion {
    compression:number; tuck:number; stride:number; jaw:number; tail:number; recoil:number;
    reload:number; brace:number; neckDrop:number; saddle:number; riderDrop:number; riderLean:number; rein:number;
}

/** Shared skeletal timing: the renderer and combat read the same moving anchors. */
export function hypotheticalMotion(b: HypotheticalModel): DinosaurMotion {
    const motion=hypotheticalStateMotion(b);
    if(b.act==='chase'){
        const performance=chasePerformance(b);
        motion.compression+=performance.compression;
        motion.neckDrop+=performance.neckDrop;
        motion.riderDrop+=performance.riderDrop;
        motion.riderLean+=performance.riderLean;
        motion.tail+=performance.tail;
        motion.saddle+=performance.compression;
        const event=b.course.bodyMotion;
        motion.compression+=event.compression;motion.saddle+=event.compression;
        motion.neckDrop+=event.neckDrop;motion.riderDrop+=event.riderDrop;
        motion.riderLean+=event.riderLean;motion.tail+=event.tail;
        motion.tuck=Math.max(motion.tuck,event.tuck);
        motion.stride*=event.strideScale;motion.rein*=event.rein;
    }
    return motion;
}

/** State transitions capture only their own layer; a structural impulse must
 * not be captured and then applied a second time after an attack changes. */
export function hypotheticalStateMotion(b: HypotheticalModel): DinosaurMotion {
    const attacking = b.state === 'attack', telling = b.state === 'tell';
    const wind = telling ? smoothMotion(b.age / b.warningTicks) : 0;
    const leap = attacking && b.attack === 'leap';
    const tuck = leap && b.age < 58 ? Math.sin(Math.PI * b.age / 58) : 0;
    const landing = leap && b.age >= 58 ? 1 - smoothMotion((b.age - 58) / 20) : 0;
    const chaseRam=b.act==='chase'&&b.attack==='charge';
    const drive=chaseRam?(telling?wind:attacking?1-smoothMotion((b.age-14)/34):0):0;
    const contact=chaseRam&&attacking&&b.age>4&&b.age<26?Math.sin(Math.PI*unit((b.age-4)/22)):0;
    const compression = chaseRam?drive*4+contact*2: b.attack === 'leap' ? wind * 6 + landing * 7 + tuck * 10
        : b.attack === 'charge' ? wind * 4 + (b.state === 'turn' ? (1 - smoothMotion(b.age / 26)) * 5 : 0) : 0;
    const walking = b.act === 'chase' && b.velocity>0 || b.state === 'reload' || attacking && (b.attack === 'charge' || b.attack === 'bite' && b.age < 24);
    const stride = walking ? Math.min(1,Math.abs(b.velocity)/2.8) : 0;
    const bite = b.attack === 'bite' && attacking;
    const jaw = b.act==='chase'&&b.attack==='charge'?(telling?.18+wind*.45:attacking?.18+(1-smoothMotion((b.age-12)/12))*.6:.18)
        :bite ? 1 - smoothMotion((b.age - 20) / 9)
        : b.attack === 'bite' && telling ? .2 + wind * .7 : b.state === 'roar' ? .35 + Math.sin(b.age / 105 * Math.PI) * .6 : .12;
    const tail = chaseRam?-drive*.045: b.attack !== 'tail' ? 0 : telling ? -wind * .45
        : attacking ? b.age < 12 ? -.45 + smoothMotion(b.age / 12) * 1.45
            : b.age <= 32 ? 1 : 1 - smoothMotion((b.age - 32) / 20) : 0;
    const recoil = gunRecoil(b.muzzle);
    const reload = b.state === 'reload' ? Math.sin(Math.PI * unit(b.age / 24)) : 0;
    // Running and bracing the rifle are separate actions: shortening the leg
    // stance during a burst made the planted feet slide across the chase deck.
    const brace=b.act==='chase'?0:b.state==='turn'?Math.sin(Math.PI*unit(b.age/38))*.85
        :attacking&&b.attack==='charge'&&b.age>=34?Math.sin(Math.PI*unit((b.age-34)/16))*.7
        :b.attack==='rifle'&&(attacking||telling)?(attacking?.35:wind*.35):0;
    const riding = b.act==='chase'||['charge','leap','bite'].includes(b.attack);
    const rein = riding ? attacking || b.act==='chase' ? 1 : wind : 0;
    const riderLean = (1-b.bow)*Math.max(-5,Math.min(6,b.motionSpeed*.7+b.riderSway));
    const riderDrop = chaseRam?drive*7+contact*2:tuck*18 + (b.attack==='charge'?(attacking?7:wind*7):0) + landing*3;
    const target = {compression,tuck,stride,jaw,tail,recoil,reload,brace,
        neckDrop:chaseRam?drive*8+contact*4:bite?22*Math.sin(unit(b.age/45)*Math.PI):b.attack==='charge'?(attacking?8:wind*8):0,
        riderDrop,riderLean,rein,saddle:0};
    // Capture the previous posture at a state boundary. Anticipation becomes
    // takeoff, bracing or recovery without resetting the body to its idle pose.
    const from=b.motionFrom,t=smoothMotion(b.age/8);
    if(from&&t<1)for(const key of ['compression','jaw','tail','brace','neckDrop','riderDrop','rein'] as const)
        target[key]=from[key]+(target[key]-from[key])*t;
    target.saddle=-64+b.bow*39+target.compression;
    return target;
}

/** Upper-body bend around the seated hips; the rifle stays rigid at its shoulder anchor. */
export const riderBend = (height:number,lean:number) => lean*Math.max(0,Math.min(1.4,height/28));

/** Bend above the seated hips. Crouching and recoil cannot slide the waist through the saddle. */
export function riderTorsoPoint(point: Point, rider: number, drop: number, shift: number, lean: number): Point {
    const height = rider - point[1], upper = unit(height / 20);
    return [point[0] + riderBend(height, lean) + shift * (1 - upper), point[1] - drop * (1 - upper)];
}

/** Rigid skull rotation at the upper neck. The renderer, bridle and mouth
 * effects share this pivot so texture and contact cannot slide apart. */
export function dinosaurHeadPoint(point:Point,neck:number,pitch=0):Point {
    if(pitch===0)return point;
    const dx=point[0]-29,dy=point[1]-neck-6,c=Math.cos(pitch),s=Math.sin(pitch);
    return [29+dx*c-dy*s,neck+6+dx*s+dy*c];
}

/** Optional rigid mandible: rotate the lower lip about the jaw joint instead
 * of stretching its texture vertically. Existing poses keep their old rig. */
export function dinosaurJawPoint(point:Point,neck:number,angle=0):Point {
    if(angle===0)return point;
    const dx=point[0]-29,dy=point[1]-neck-7,c=Math.cos(angle),s=Math.sin(angle);
    return [29+dx*c-dy*s,neck+7+dx*s+dy*c];
}
export function dinosaurMouthPoint(neck:number,jaw:number,pitch=0,hinge?:number):Point {
    if(hinge===undefined)return dinosaurHeadPoint([56,neck+10+jaw*6],neck,pitch);
    const lower=dinosaurJawPoint([56,neck+14],neck,hinge);
    return dinosaurHeadPoint([(56+lower[0])/2,(neck+6+lower[1])/2],neck,pitch);
}

/** A long planted stance followed by a shorter airborne return; feet do not slide sinusoidally. */
export function dinosaurFoot(gait: number, offset: number, stride: number, tuck: number): Point {
    const t = ((gait / (Math.PI * 2) + offset) % 1 + 1) % 1;
    const stance = .62, swing = unit((t - stance) / (1 - stance));
    // Gait advances one radian per eleven travelled pixels. The stance travels
    // back by precisely the ground distance, so a planted foot stays planted.
    const reach = Math.PI * 2 * 11 * stance / 2;
    const x = t < stance ? reach - 2 * reach * t / stance : -reach + 2 * reach * smoothMotion(swing);
    return [x * stride + tuck * 8, -Math.sin(swing * Math.PI) * 12 * stride - tuck * 18];
}

/** Sole center shared by the articulated leg and the actual footfall particles. */
export function dinosaurFootAnchor(gait: number, rear: boolean, stride: number, tuck: number, brace: number): Point {
    const foot = dinosaurFoot(gait, rear ? .5 : 0, stride, tuck);
    const step = foot[0] * (1 - brace) + (rear ? -6 : 12) * brace;
    const lift = -foot[1] * (1 - brace);
    return [step, -lift];
}

/** Fixed thigh/shin lengths around the same planted or tucked foot anchor. */
export function dinosaurLeg(body: number, gait: number, rear: boolean, stride: number, tuck: number, brace: number, plantedFoot?:Point) {
    const foot = plantedFoot??dinosaurFootAnchor(gait, rear, stride, tuck, brace);
    const hip: Point = [rear ? -5 : -12, body + 6];
    const hock: Point = [foot[0] - 5, foot[1] - 9];
    const dx = hock[0] - hip[0], dy = hock[1] - hip[1];
    const distance = Math.max(.001, Math.hypot(dx, dy)), thigh = 20, shin = 22;
    const along = Math.max(-thigh, Math.min(thigh, (thigh * thigh - shin * shin + distance * distance) / (2 * distance)));
    const bend = Math.sqrt(Math.max(0, thigh * thigh - along * along));
    const knee: Point = [hip[0] + (dx * along + dy * bend) / distance, hip[1] + (dy * along - dx * bend) / distance];
    return { hip, knee, hock, foot };
}

/** The distal tail is both painted and sampled for collision; no invisible floor-wide rectangle. */
export function dinosaurTail(body: number, stroke: number): readonly Point[] {
    return [[-22, body + 11], [-44, body + 11 + stroke * 18], [-82, body + 1 + stroke * 32]];
}
