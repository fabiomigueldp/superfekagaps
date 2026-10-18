import type { WorldFoe } from '../WorldEnemies';

export const GUARD_LUNGE = { warning:560, attack:340, recovery:1100, distance:28, reach:12, activeFrom:75, activeUntil:265 } as const;
export interface GuardActionPose { brace:number; thrust:number; lean:number; hatch:number; carry:number; crouch:number; turn:number; supply:number; cut:number }
const unit=(x:number)=>Math.max(0,Math.min(1,x));
const smooth=(x:number)=>{const t=unit(x);return t*t*(3-2*t);};
export function blendGuardAction(from:GuardActionPose,to:GuardActionPose,progress:number):GuardActionPose {
    const t=smooth(progress);
    return {brace:from.brace+(to.brace-from.brace)*t,thrust:from.thrust+(to.thrust-from.thrust)*t,
        lean:from.lean+(to.lean-from.lean)*t,hatch:from.hatch+(to.hatch-from.hatch)*t,
        carry:from.carry+(to.carry-from.carry)*t,crouch:from.crouch+(to.crouch-from.crouch)*t,
        turn:from.turn+(to.turn-from.turn)*t,supply:from.supply+(to.supply-from.supply)*t,cut:from.cut+(to.cut-from.cut)*t};
}
/** Small continuous key poses. Animation never delays the committed collision window. */
export function guardActionPose(e:Pick<WorldFoe,'spec'|'phase'|'timer'|'warningDuration'> & {comboStep?:number}):GuardActionPose {
    const followup=e.spec.kind==='minion'&&e.comboStep===1;
    const brace=e.phase==='warning'?smooth(e.timer/e.warningDuration):0;
    const duration=e.spec.kind==='helmet'?300:followup?GUARD_LUNGE.attack:240;
    const thrust=e.phase!=='attack'?0:e.spec.kind==='charger'?smooth(e.timer/120)*(1-smooth((e.timer-560)/160)):Math.sin(Math.PI*unit(e.timer/duration));
    const recovery=e.phase==='rest'||e.phase==='recoil';
    const carry=e.phase==='warning'?smooth(e.timer/e.warningDuration):e.phase==='recoil'?1-smooth(e.timer/380):0;
    const cut=followup?(e.phase==='warning'?-brace:e.phase==='attack'?-1+2*smooth(e.timer/150):0):0;
    return {brace,thrust,lean:e.phase==='stunned'?-2:-brace*(followup?3:2)+thrust*(followup?4:3),
        hatch:recovery||e.phase==='stunned'?1:0,carry,
        crouch:brace*(followup?2.2:1.2)+thrust*(followup?1:0)+(e.phase==='recoil'?(1-smooth(e.timer/200))*1.5:0),turn:0,supply:0,cut};
}
