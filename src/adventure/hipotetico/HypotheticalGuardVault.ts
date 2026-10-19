import type { Rect } from '../../types';
import type { WorldFoe } from '../WorldEnemies';
import type { WorldLevel } from '../WorldPhysics';

export const GUARD_VAULT = { acquire:260, warning:700, recovery:1050, cooldown:2500,
    velocityY:-8, gravity:.4, maxSpeed:4.4, range:112, maxRise:72 } as const;
export interface GuardVaultTarget { x:number; y:number; floor:number; supportId:string; steps:number; fromX:number; fromFloor:number }

/** Lock an actual one-way landing, with enough space for the whole defender.
 * A jump is a response to an occupied perch, never to Feka's passing jump arc. */
export function planGuardVault(e:WorldFoe,player:Rect,level:WorldLevel,allies:readonly WorldFoe[]):GuardVaultTarget|null {
    const feet=player.y+player.height,center=player.x+player.width/2;
    if(Math.abs(center-e.x-e.width/2)>GUARD_VAULT.range)return null;
    const support=level.bodies.find(b=>b.kind==='support'&&Math.abs(feet-b.y)<1&&center>=b.x&&center<=b.x+b.width);
    if(!support)return null;
    const rise=e.y+e.height-support.y;
    if(rise<24||rise>GUARD_VAULT.maxRise||support.width<e.width+4)return null;
    // Native discrete integration: dy = -7.8t + .2t², taking the descending root.
    const steps=(7.8+Math.sqrt(7.8**2-.8*rise))/.4;
    const left=support.x+2,right=support.x+support.width-e.width-2;
    const desired=Math.max(left,Math.min(right,center-e.width/2));
    const positions=[desired,left,right].sort((a,b)=>Math.abs(a-desired)-Math.abs(b-desired));
    for(const x of positions){
        if(Math.abs(x-e.x)/steps>GUARD_VAULT.maxSpeed)continue;
        const clear=allies.every(a=>a===e||a.dead||Math.abs(a.y+a.height-support.y)>4
            ||x+e.width+24<=a.x||x>=a.x+a.width+24);
        if(clear)return {x,y:support.y-e.height,floor:support.y,supportId:support.id,steps,fromX:e.x,fromFloor:e.y+e.height};
    }
    return null;
}
