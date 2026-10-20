import {PLAYER_RUN_SPEED} from '../../constants';
import {PLAYER_HITBOX_W} from '../../assets/playerSpriteSpec';
import {CHASE_ATTACK_RESERVATIONS,CHASE_EXIT,type ChaseStrike,type ChaseVolley} from './HypotheticalLayout';

/** A readable forward lane, never homing toward a jump or changing pitch with
 * recoil. The low lane leaves room beneath it close to the pursuer. */
export const chaseRiflePitch=(kind:ChaseStrike)=>kind==='low'?.29:kind==='high'?-.018:0;
export const chaseShotSpeed=(volley:ChaseVolley)=>volley.speed??(volley.kind==='ram'?7:volley.kind==='low'?7.1:6.8);
export const chaseAttackReserved=(x:number)=>CHASE_ATTACK_RESERVATIONS.some(r=>x>=r.from&&x<r.to);

/** Conservative clearance at native running speed. Include Feka's whole width
 * and allow for recoil moving the muzzle back to roughly 30px ahead of the hip.
 * Floor/cover may stop a shot sooner; this estimate does not depend on that. */
function clearance(volley:ChaseVolley,gap:number){
    const closing=chaseShotSpeed(volley)*Math.cos(chaseRiflePitch(volley.kind))-PLAYER_RUN_SPEED;
    // A close approach can relax back toward the 110px pursuit spacing during
    // the tell. Include that recovery and a small structural-impact allowance.
    const spacing=Math.max(110,gap)+8;
    return Math.ceil((spacing+PLAYER_HITBOX_W-30)/Math.max(.5,closing))+4;
}

export function chaseVolleyTicks(volley:ChaseVolley,gap:number){
    const last=volley.shots[volley.shots.length-1]??0;
    return volley.tell+Math.max(volley.duration,last+clearance(volley,gap));
}

/** A sequence must fit as a whole, including the tell between its two lanes
 * and its last projectile. An expired opportunity never shortens its warning. */
export function chaseSequenceFits(volley:ChaseVolley&{followup?:ChaseVolley},x:number,gap:number){
    if(chaseAttackReserved(x))return false;
    const ticks=volley.followup
        ?Math.max(chaseVolleyTicks(volley,gap),volley.tell+volley.duration+chaseVolleyTicks(volley.followup,gap))
        :chaseVolleyTicks(volley,gap);
    const next=CHASE_ATTACK_RESERVATIONS.find(r=>r.from>x);
    const end=next?.from??CHASE_EXIT-32;
    return x+PLAYER_RUN_SPEED*ticks+8<=end;
}
