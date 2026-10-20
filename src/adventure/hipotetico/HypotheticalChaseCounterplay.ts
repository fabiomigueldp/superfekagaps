import type {Rect} from '../../types';
import {overlaps} from '../types';
import {CHASE_COUNTERS} from './HypotheticalLayout';
import {smoothMotion} from './HypotheticalMotion';

export interface ChaseLoadState {released:number;struck:number;hitX:number;hitY:number;spent:boolean;supported:boolean;washed:number;washedY:number;washedVelocity:number}
/** One-use physical counterplay. Rendering only samples this clock; it cannot
 * press a treadle, hit the pursuer or interrupt a volley. */
export class HypotheticalChaseCounterplay {
    readonly loads:ChaseLoadState[];
    releasedThisTick=-1;struckThisTick=-1;waterThisTick=-1;
    private previousBottom:number|null=null;
    constructor(start=0){
        this.loads=CHASE_COUNTERS.map(s=>({released:-1,struck:-1,hitX:0,hitY:0,spent:s.pad.x<start,supported:true,washed:-1,washedY:0,washedVelocity:0}));
    }
    update(tick:number,player:Rect,pursuer:Rect,decks:readonly Rect[]){
        this.releasedThisTick=this.struckThisTick=this.waterThisTick=-1;
        const bottom=player.y+player.height,descending=this.previousBottom===null||bottom>=this.previousBottom-.1;
        for(const [i,s]of CHASE_COUNTERS.entries()){
            const state=this.loads[i];if(state.spent)continue;
            state.supported=decks.some(d=>d.y===s.pad.y&&d.x<=s.pad.x&&d.x+d.width>=s.pad.x+s.pad.width);
            if(state.supported&&state.released<0&&descending&&Math.abs(bottom-s.pad.y)<1.5&&player.x+player.width>s.pad.x&&player.x<s.pad.x+s.pad.width){
                state.released=tick;this.releasedThisTick=i;
            }
            if(state.released<0||state.struck>=0)continue;
            const pose=this.poseAt(i,tick);
            if(state.washed>=0){
                if(pose.splashAge>=0&&this.poseAt(i,tick-1).splashAge<0)this.waterThisTick=i;
                continue;
            }
            if(pose.age>=4&&overlaps(pose.bounds,pursuer)){
                state.struck=tick;state.hitX=pose.x+s.load.width/2;state.hitY=pose.bounds.y+pose.bounds.height;
                this.struckThisTick=i;
            }else if(pose.bounds.x+pose.bounds.width<pursuer.x-4){
                // A missed load cannot float over the road erased behind the
                // pursuer. Preserve its falling velocity when the support goes.
                state.washed=tick;state.washedY=pose.y;
                state.washedVelocity=pose.bounds.y+pose.bounds.height>=223.9?0:.7*Math.max(0,pose.age-4);
            }
        }
        this.previousBottom=bottom;
    }
    poseAt(index:number,tick:number){
        const s=CHASE_COUNTERS[index],state=this.loads[index],age=state.released<0?-1:tick-state.released;
        const t=Math.max(0,age-4),turn=age<0?0:Math.min(.12,t*.007),co=Math.cos(turn),si=Math.sin(turn);
        const width=s.load.width*co+s.load.height*si,height=s.load.height*co+s.load.width*si;
        const waterAge=state.washed<0?-1:tick-state.washed;
        const y=waterAge<0?Math.min(s.load.y+.35*t*t,224-(height+s.load.height)/2)
            :state.washedY+state.washedVelocity*waterAge+.35*waterAge*waterAge;
        const distance=Math.max(0,240-state.washedY-(height+s.load.height)/2),v=state.washedVelocity;
        const waterContact=(-v+Math.sqrt(v*v+1.4*distance))/.7;
        return {...s.load,y,age,turn,splashAge:waterAge<0?-1:waterAge-waterContact,
            bounds:{x:s.load.x+(s.load.width-width)/2,y:y+(s.load.height-height)/2,width,height}};
    }
    reaction(tick:number){
        let age=Infinity;for(const s of this.loads)if(s.struck>=0)age=Math.min(age,tick-s.struck);
        return age>=0&&age<42?{age,weight:1-smoothMotion(age/42)}:{age:Infinity,weight:0};
    }
    speedScale(tick:number){return 1-this.reaction(tick).weight*.68;}
    hint(tick:number){
        if(this.reaction(tick).weight>0)return 'CARGA ACERTOU! APROVEITE A FREADA';
        for(const state of this.loads){
            if(state.spent)continue;
            if(state.released>=0&&tick-state.released<36)return 'CARGA SOLTA! CONTINUE CORRENDO';
        }
        return null;
    }
}
