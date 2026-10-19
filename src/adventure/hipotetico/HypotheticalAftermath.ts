import { smoothMotion } from './HypotheticalMotion';
import { scenicDistrict, SCENIC_STARTS } from './HypotheticalDevastation';
import { SIEGE_SECTORS } from './HypotheticalSiege';
import type { Bystander } from './HypotheticalBackdrop';

/** These small service yards belong to the rear street, never to Feka's collision layer. */
export const AFTERMATH_YARDS = SIEGE_SECTORS.map((s, district) => ({
    origin: s.origin + (district === 0 ? 256 : 0),
    kind: (['timber', 'cargo', 'vent', 'masonry'] as const)[district],
    start: district === 0 ? 634 : 278,
}));
type Activity = 'approach' | 'search' | 'rummage' | 'listen' | 'flush' | 'turn-out' | 'patrol' | 'survey' | 'turn-back' | 'return' | 'watch';
type Sound = 'distant-debris' | 'distant-thud';
export interface AftermathContact { x:number; born:number; strength:number; kind:'scrape'|'break'|'step' }
export interface AftermathYard {
    damage: number; shiftedAt:number; brokenAt:number; birdsAt:number; runnerAt:number;
    people:Bystander[];
}
const pulse = (age:number, rise:number, hold:number, end:number) =>
    smoothMotion(age/rise) * (1-smoothMotion((age-hold)/(end-hold)));

/** A second clock keeps the current street alive without unlocking or consuming the next one.
 * Contacts wait BEFORE anticipation if their actual prop is outside Feka's viewport.
 * Damage and escaped actors persist, so an extended fight never repeats the same demolition. */
export class HypotheticalAftermath {
    district = -1; active = false; tick = 0; age = 0; cycle = 0;
    phase:Activity = 'approach'; x = 0; velocity = 0; travel = 0; facing = 1;
    events:Sound[] = []; contacts:AftermathContact[] = [];
    readonly yards:AftermathYard[] = AFTERMATH_YARDS.map((yard, district) => ({
        damage:0, shiftedAt:-1, brokenAt:-1, birdsAt:-1, runnerAt:-1,
        people:[0,1].map(i => ({
            x:yard.origin+290-i*6, originX:yard.origin+290-i*6, shelter:yard.origin+(district===3?342:354),
            escaped:false, fleeing:true, hitAt:null, color:(district+i)%4,
            distance:0, velocity:0, alertAt:Number.MAX_SAFE_INTEGER, speed:1, district,
            clothes:i===0?'satchel':'workcoat', stoppedAt:null, threatenedAt:null, startledAt:null,
            reactionTimes:[], appearance:11+district+i, depth:-3-i*2, exitAtShelter:true, runTicks:60+i*8,
        })),
    }));
    private fromX = 0;
    private fromFacing = 1;
    private lastStep = 0;

    get yard(){ return this.yards[this.district]; }
    get origin(){ return AFTERMATH_YARDS[this.district]?.origin ?? 0; }
    get stride(){ return Math.min(1, Math.abs(this.velocity)/1.05); }
    get duration(){
        switch(this.phase){
            case 'approach': return 82;
            case 'search': return 126 + (this.district%2)*18;
            case 'rummage': return 108;
            case 'listen': return 84;
            case 'flush': return 126;
            case 'turn-out': case 'turn-back': return 44;
            case 'patrol': case 'return': return 124;
            case 'survey': return 104 + (this.cycle%3)*19;
            case 'watch': return 74;
        }
    }
    private enter(phase:Activity){
        this.phase=phase; this.age=0; this.fromX=this.x; this.fromFacing=this.facing;
    }
    private contact(kind:AftermathContact['kind'],x:number,strength:number){
        this.contacts.push({kind,x,strength,born:this.tick});
        if(kind!=='step')this.events.push(kind==='break'?'distant-thud':'distant-debris');
    }

    update(storyTick:number, storyX:number, playerX:number){
        this.events=[];
        this.tick++;
        this.contacts=this.contacts.filter(p=>this.tick-p.born<88);
        // Already-started escapes and settling finish even after the camera leaves a street.
        for(const yard of this.yards)for(const p of yard.people){
            p.velocity=0;
            if(p.escaped||this.tick<=p.alertAt+8)continue;
            const old=p.x;
            p.x=p.originX+(p.shelter-p.originX)*smoothMotion((this.tick-p.alertAt-8)/p.runTicks!);
            p.velocity=p.x-old;p.distance+=Math.abs(p.velocity);
            if(p.x===p.shelter)p.escaped=true;
        }
        const district=scenicDistrict(storyTick), yard=AFTERMATH_YARDS[district];
        // A new authored street has priority. No hidden activity continues in a later district.
        if(district!==this.district){
            this.active=false; this.district=district; this.cycle=0; this.contacts=[];
        }
        const center=yard.origin+272;
        const visible=(x:number,margin=28)=>x>=playerX-132+margin && x<=playerX+188-margin;
        if(!this.active){
            if(storyTick-SCENIC_STARTS[district]<yard.start || !visible(storyX,12))return;
            this.active=true; this.x=storyX; this.velocity=0; this.facing=1; this.travel=0; this.lastStep=0;
            this.enter('approach');
        }
        const areaVisible=playerX>yard.origin+62 && playerX<yard.origin+440;
        const needsContact=(this.phase==='search'&&this.yard.damage===0)
            || (this.phase==='listen'&&this.yard.damage===1);
        // Continue breathing and looking around while waiting, not a frozen attack silhouette.
        const staging=(this.phase==='rummage'||this.phase==='flush')&&this.age<58;
        const waiting=!areaVisible || needsContact&&this.age>=this.duration-1&&!visible(center,48)
            || staging&&!visible(center,20);
        if(!waiting)this.age++;
        const oldX=this.x, t=smoothMotion(this.age/this.duration);
        const home=yard.origin+222;
        if(this.phase==='approach'||this.phase==='return')this.x=this.fromX+(home-this.fromX)*t;
        else if(this.phase==='patrol'){
            const stop=yard.origin+[152,180,136][this.cycle%3];
            this.x=this.fromX+(stop-this.fromX)*t;
        }
        else if(this.phase==='rummage')this.x=this.fromX+11*pulse(this.age,43,65,108);
        else if(this.phase==='flush')this.x=this.fromX-7*pulse(this.age,25,30,43)
            +(this.district===3?40:19)*pulse(this.age-32,26,37,94);
        this.velocity=this.x-oldX;
        this.travel+=Math.abs(this.velocity);
        const step=Math.floor(this.travel/(Math.PI*11*.6875));
        if(step>this.lastStep&&this.stride>.15){
            this.contact('step',this.x+this.facing*(step%2?9:-7),.4); this.lastStep=step;
        }
        if(!waiting){
            if(this.phase==='rummage'&&this.age===58){
                this.yard.damage=1;this.yard.shiftedAt=this.tick;this.contact('scrape',center,.65);
            }
            if(this.phase==='flush'&&this.age===18){
                this.yard.birdsAt=this.tick; this.yard.runnerAt=this.tick;
                for(const [i,p] of this.yard.people.entries()){p.alertAt=this.tick+i*13;p.startledAt=this.tick+i*13;}
            }
            if(this.phase==='flush'&&this.age===58){
                this.yard.damage=2;this.yard.brokenAt=this.tick;this.contact('break',center,1);
            }
            if((this.phase==='turn-out'||this.phase==='turn-back')&&this.age===22)this.facing=-this.fromFacing;
            if(this.age>=this.duration){
                switch(this.phase){
                    case 'approach': case 'return': this.enter('search');break;
                    case 'search': this.enter(this.yard.damage===0?'rummage':'listen');break;
                    case 'rummage': this.enter('listen');break;
                    case 'listen': this.enter(this.yard.damage===1?'flush':this.cycle%2?'watch':'turn-out');break;
                    case 'flush': this.enter('watch');break;
                    case 'watch': this.enter('turn-out');break;
                    case 'turn-out': this.enter('patrol');break;
                    case 'patrol': this.enter('survey');break;
                    case 'survey': this.enter('turn-back');break;
                    case 'turn-back': this.cycle++;this.enter('return');break;
                }
            }
        }
    }

    /** Anticipation, contact and follow-through use the same articulated rig as the boss. */
    pose(reduced:boolean){
        const a=this.age, phase=this.phase, searching=phase==='search', rummaging=phase==='rummage';
        const search=searching?smoothMotion(a/32)*(1-smoothMotion((a-this.duration+28)/28)):0;
        const probe=rummaging?pulse(a,30,70,108):0;
        const flush=phase==='flush'?pulse(a,32,66,126):0;
        const strike=phase==='flush'?pulse(a-32,26,30,62):0;
        const turn=phase==='turn-out'||phase==='turn-back';
        const survey=phase==='survey'||phase==='listen'||phase==='watch';
        const look=survey?pulse(a,24,this.duration-30,this.duration):0;
        const breath=reduced?0:Math.sin(this.tick/19)*.5;
        const cargo=this.district===1&&rummaging?pulse(a-56,12,26,52):0;
        const steam=this.district===2&&phase==='flush'?pulse(a-60,8,25,54):0;
        const stamp=this.district===3&&phase==='flush';
        const lift=stamp&&a>=38&&a<58?Math.sin(Math.PI*(a-38)/20):0;
        const landing=stamp?pulse(a-58,3,8,30):0;
        const sniff=phase==='listen'&&this.cycle>0?pulse(a-10,16,32,60):0;
        const tailCheck=phase==='survey'?pulse(a-34,20,32,62):0;
        return {
            facing:this.facing, gait:this.travel/(.6875*11), stride:this.stride,
            pivot:turn?Math.sin(Math.PI*a/44)*.98:0,
            bow:search*.52+probe*.48-cargo*.22+(stamp?0:strike*.34)-steam*.1+sniff*.2,
            lift:-lift*7, breath, compression:probe*2+(stamp?landing*7:strike*5)+(turn?Math.sin(Math.PI*a/44)*2:0),
            neckDrop:search*(14+(reduced?0:Math.sin(a/9)*2))+probe*10-cargo*10+(stamp?landing*5:strike*10)-steam*8+sniff*5,
            jaw:.12+probe*.24+flush*.62*(1-smoothMotion((a-54)/8)),
            tail:search*-.09+strike*.12+(reduced?0:Math.sin(this.tick/29)*.025+tailCheck*.12),
            tuck:lift*.55, brace:probe*.35+(stamp?landing*.6:strike*.6)+(turn?.42:0),
            riderDrop:probe*3+strike*5+lift*5, riderLean:probe*3-strike*4-steam*5,
            rein:Math.max(probe,flush,this.stride*.6), lookBack:look*(this.cycle%2?.8:.55),
            aim:look*.3-.12, reload:phase==='watch'?Math.sin(Math.PI*a/this.duration)*.65:0,
            focus:Math.max(search,probe,flush), eyeClose:Math.max(search*.35,steam*.8),
            blink:this.tick%197<5, voice:phase==='flush'?pulse(a-60,4,12,30)*.28:0,
            cloth:reduced?0:this.stride*2+strike*2,
        };
    }
}
