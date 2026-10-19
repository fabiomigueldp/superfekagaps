import {AFTERMATH_PROPS} from './HypotheticalAftermathScore';
import type {AftermathProp} from './HypotheticalAftermathHandling';

export type YardIncidentKind='creak'|'settle'|'rattle'|'draft'|'leak';
export interface YardIncident {
    kind:YardIncidentKind; prop:number; born:number; variant:number; strength:number; noticed:boolean;
}

/** Small events belong to surviving hardware, not to another demolition.
 * Off-screen yards cannot start events. Settling pieces keep their own physics. */
export class AftermathEnvironment {
    incidents:YardIncident[]=[];
    wet=0;windAt=-10000;lastAt=-1000;
    private nextAt=0;
    private previous:YardIncidentKind|null=null;
    private seed:number;
    private pending:{prop:number;due:number;strength:number}|null=null;
    constructor(readonly district:number){this.seed=(district+1)*0x1f123bb5;}
    private random(){let n=this.seed;n^=n<<13;n^=n>>>17;n^=n<<5;this.seed=n>>>0;return (this.seed+.5)/4294967296;}

    stir(prop:number,tick:number,strength:number){
        if(strength<.45||tick-this.lastAt<180||this.pending)return;
        this.pending={prop,due:tick+30+Math.floor(this.random()*40),strength};
    }
    update(tick:number,props:AftermathProp[],enabled:boolean,visible:(prop:number)=>boolean,occupied:number):YardIncident|undefined {
        this.incidents=this.incidents.filter(e=>tick-e.born<270);
        if(this.pending&&tick-this.pending.due>240)this.pending=null;
        if(!enabled)return;
        if(!this.nextAt)this.nextAt=tick+220+Math.floor(this.random()*240);
        if(this.pending&&tick<this.pending.due)return;
        const due=this.pending&&tick>=this.pending.due?this.pending:null;
        if((!due&&tick<this.nextAt)||tick-this.lastAt<170)return;
        const eligible=(i:number)=>i!==occupied&&visible(i)&&!props[i].piece?.held&&!props[i].piece?.moving&&!props[i].driven;
        const available=AFTERMATH_PROPS.map((_,i)=>i).filter(eligible);
        if(!available.length)return;
        const prop=due&&eligible(due.prop)?due.prop:due?null:available[Math.floor(this.random()*available.length)];
        if(prop===null)return;
        const material=AFTERMATH_PROPS[prop].material;
        let kind:YardIncidentKind=material==='timber'?'creak':material==='stone'?'settle':'rattle';
        if(!due){
            if(this.random()<.3||this.previous===kind)kind='draft';
            else if(prop===2&&(this.district===1||this.district===2)&&this.random()<.65)kind='leak';
        }else if(prop===2&&(this.district===1||this.district===2)&&this.random()<.5)kind='leak';
        const e:YardIncident={kind,prop,born:tick,variant:Math.floor(this.random()*8),strength:due?Math.min(1,due.strength):.45,noticed:false};
        this.incidents.push(e);this.incidents=this.incidents.slice(-4);
        this.lastAt=tick;this.previous=kind;this.pending=null;this.nextAt=tick+480+Math.floor(this.random()*420);
        const p=props[prop];
        if(kind==='draft')this.windAt=tick;
        else{
            p.cueAt=tick;p.struckAt=tick;p.force=.15;
            if(kind==='rattle'&&p.hinge<.03)p.hingeVelocity=.028;
            if(kind==='settle'&&p.piece){p.piece.vx=(e.variant%2?1:-1)*.12;p.piece.vy=-.35;p.piece.moving=true;p.piece.bounces=1;}
            if(kind==='leak')this.wet=Math.min(1,this.wet+.18);
        }
        return e;
    }
    invitationFor(visible:(prop:number)=>boolean){
        return [...this.incidents].reverse().find(e=>!e.noticed&&e.kind!=='draft'&&visible(e.prop));
    }
}
