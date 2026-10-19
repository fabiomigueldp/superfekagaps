import {handlingTiming,isHandling,AFTERMATH_SCALE,DEBRIS_GRIP_X} from './HypotheticalAftermathHandling';
import {smoothMotion} from './HypotheticalMotion';

/** Repeatable background performances use surviving wreckage, never reset a
 * demolished building or recreate an escaped person. Times are fixed steps. */
export const AFTERMATH_ACTIONS = ['ram','stomp','rake','tail','fire','bellow','haul','sift','wrench','shake','breach'] as const;
export type AftermathAction = typeof AFTERMATH_ACTIONS[number];
export const AFTERMATH_SCORES: readonly (readonly AftermathAction[])[] = [
    ['shake','ram','haul','fire','wrench','rake','sift','bellow','tail','stomp','breach'],
    ['tail','sift','stomp','haul','fire','ram','bellow','wrench','rake','shake','breach'],
    ['breach','fire','wrench','rake','haul','bellow','stomp','sift','ram','tail','shake'],
    ['stomp','sift','ram','tail','wrench','breach','fire','haul','rake','bellow','shake'],
];
export const AFTERMATH_PROPS = [
    {offset:118,top:-18,material:'timber' as const},
    {offset:202,top:-12,material:'stone' as const},
    {offset:310,top:-34,material:'iron' as const},
];
export function aftermathActionTiming(action:AftermathAction,variant:number){
    if(isHandling(action))return {beats:[],shots:[],duration:handlingTiming(action).duration};
    const beats=action==='ram'?[48]:action==='breach'?[52]:action==='stomp'?[[50],[42,80],[42,76,112]][variant%3]
        :action==='rake'?[[42,68,91],[40,62,92,118],[48,82]][variant%3]
        :action==='tail'?[52]:action==='bellow'?(variant%2?[40,82]:[44]):[];
    const shots=action==='breach'?[88,93,98,103,118,123]:action==='fire'?
        [[36,41,46,78,83,88],[40,45,50,55,60,90,95],[32,37,42,64,69,74,96,101,106],[50,55,60,88,93,98,103,108]][variant%4]:[];
    const duration=action==='breach'?166:action==='rake'?beats[beats.length-1]+36:action==='stomp'?beats[beats.length-1]+40
        :action==='fire'?shots[shots.length-1]+38:action==='bellow'?(variant%2?140:112):104;
    return {beats,shots,duration};
}
export function aftermathReach(action:AftermathAction){
    return action==='tail'?-54:action==='stomp'?12:action==='bellow'?0:action==='fire'?92
        :DEBRIS_GRIP_X*AFTERMATH_SCALE+(action==='ram'||action==='breach'?8:action==='rake'?3:0);
}

export const aftermathFamily=(action:AftermathAction)=>isHandling(action)?'search'
    :action==='fire'||action==='breach'?'gun':action==='bellow'?'voice':'body';

/** A seeded weighted score, not a looping playlist. The seed changes at street
 * entry; drawing never consumes randomness. Neglected actions get a turn and
 * two loud passages encourage an investigation before another crescendo. */
export class AftermathRepertoire {
    private state=1;
    reset(seed:number){this.state=seed>>>0||1;}
    random(){let n=this.state;n^=n<<13;n^=n>>>17;n^=n<<5;this.state=n>>>0;return (this.state+.5)/4294967296;}
    order(district:number,recent:AftermathAction[],performed:number,last:Partial<Record<AftermathAction,number>>,prompt?:AftermathAction){
        const flavor=AFTERMATH_SCORES[district],previous=recent[recent.length-1];
        const loud=recent.slice(-2).length===2&&recent.slice(-2).every(a=>aftermathFamily(a)!=='search');
        return AFTERMATH_ACTIONS.map(action=>{
            const absence=performed-(last[action]??-3),family=aftermathFamily(action);
            let weight=1+Math.min(3,absence/4)+(flavor.indexOf(action)<3?1.3:0);
            if(previous&&family===aftermathFamily(previous))weight*=.42;
            if(loud)weight*=family==='search'?2.6:.4;
            if(action===prompt)weight*=2.8;
            const key=-Math.log(this.random())/weight-(absence>=10?20+absence:0);
            return {action,key};
        }).filter(p=>!recent.slice(-2).includes(p.action)).sort((a,b)=>a.key-b.key).map(p=>p.action);
    }
}

/** Aim traverses the surface between authored shots. Every projectile keeps
 * the sampled point, so recoil cannot pull a bullet away from its own impact. */
export function aftermathShotPoint(action:AftermathAction,variant:number,age:number,prop:number){
    const shots=aftermathActionTiming(action,variant).shots;
    if(!shots.length||prop<0)return {x:0,y:AFTERMATH_PROPS[prop]?.top??0};
    const index=Math.max(0,shots.findIndex(t=>t>=age)),i=age>shots[shots.length-1]?shots.length-1:index;
    const bounds=prop===2?[-32,-10]:prop===1?[-11,-5]:[-18,-6];
    const point=(j:number)=>{
        const sweep=j/Math.max(1,shots.length-1),direction=variant%2?-1:1;
        return {x:(sweep-.5)*14*direction,y:bounds[0]+(bounds[1]-bounds[0])*(.2+.6*((j+variant)%3)/2)};
    };
    const previous=point(Math.max(0,i-1)),next=point(i);
    const t=smoothMotion((age-(shots[i-1]??0))/Math.max(1,shots[i]-(shots[i-1]??0)));
    return {x:previous.x+(next.x-previous.x)*t,y:previous.y+(next.y-previous.y)*t};
}
