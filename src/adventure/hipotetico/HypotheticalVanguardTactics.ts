import type { Rect } from '../../types';
import type { WorldFoe } from '../WorldEnemies';
import type { WorldLevel } from '../WorldPhysics';
import { clamp } from '../types';

export const VANGUARD = { health:5, warning:32, secondWarning:26, rushTicks:22,
    rushDistance:106, recovery:40, stun:20, immunity:38, gravity:.42, jump:-8.3,
    chaseSpeed:2.05, retreatSpeed:2.6, maxVaultSpeed:4.4, shockReach:18 } as const;
export interface VanguardLanding {
    x:number; y:number; steps?:number; velocityX?:number; left?:number; right?:number;
}

/** Follow discrete gravity and the first real one-way landing. A mark must not
 * promise the floor beneath an intervening balcony. No simulation state is changed. */
export function planVanguardVault(e:Rect,player:Rect,level:WorldLevel,
    bounds:{left:number;right:number},allies:readonly WorldFoe[]):VanguardLanding|null {
    const center=player.x+player.width/2,foot=player.y+player.height;
    const perch=level.bodies.find(p=>p.kind==='support'&&Math.abs(p.y-foot)<3
        &&center>=p.x&&center<=p.x+p.width);
    const floor=perch?.y??224,velocity=VANGUARD.jump+VANGUARD.gravity/2;
    const discriminant=velocity*velocity+2*VANGUARD.gravity*(floor-e.y-e.height);
    if(discriminant<0)return null;
    const steps=Math.ceil((-velocity+Math.sqrt(discriminant))/VANGUARD.gravity);
    const left=Math.max(bounds.left+4,perch?perch.x+2:bounds.left+4);
    const right=Math.min(bounds.right-e.width-4,perch?perch.x+perch.width-e.width-2:bounds.right-e.width-4);
    if(left>right||steps<6||steps>64)return null;
    const desired=clamp(center-e.width/2,left,right);
    const candidates=perch?[desired,left,right]:[desired,clamp(desired-36,left,right),clamp(desired+36,left,right)];
    for(const target of candidates){
        const vx=(target-e.x)/steps;if(Math.abs(vx)>VANGUARD.maxVaultSpeed)continue;
        let body:Rect={x:e.x,y:e.y,width:e.width,height:e.height},vy:number=VANGUARD.jump;
        for(let tick=1;tick<=64;tick++){
            vy=Math.min(8,vy+VANGUARD.gravity);
            const next=level.resolveCollision(body,{x:vx,y:vy},body);
            body={...body,x:clamp(next.position.x,bounds.left,bounds.right-e.width),y:next.position.y};vy=next.velocity.y;
            if(!next.grounded)continue;
            if(perch&&(Math.abs(body.y+body.height-floor)>1||body.x<perch.x+1||body.x+e.width>perch.x+perch.width-1))break;
            if(Math.abs(body.x-desired)>64)break;
            if(allies.some(a=>a!==e&&!a.dead&&Math.abs(a.y+a.height-body.y-body.height)<4
                &&body.x<a.x+a.width+18&&body.x+e.width>a.x-18))break;
            const support=level.bodies.find(p=>p.kind==='support'&&Math.abs(p.y-body.y-body.height)<1
                &&body.x+body.width>p.x&&body.x<p.x+p.width);
            return {x:body.x,y:body.y+body.height,steps:tick,velocityX:vx,
                left:support?.x??bounds.left,right:support?support.x+support.width:bounds.right};
        }
    }
    return null;
}

/** The warning and landing hit share the same deck-clipped extents. */
export function vanguardLandingSpan(mark:VanguardLanding,width=20) {
    const left=Math.max(mark.left??-Infinity,mark.x-VANGUARD.shockReach);
    const right=Math.min(mark.right??Infinity,mark.x+width+VANGUARD.shockReach);
    return {left,right};
}
