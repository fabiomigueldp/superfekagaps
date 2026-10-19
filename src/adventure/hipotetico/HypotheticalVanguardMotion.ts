import type { FoePhase } from '../WorldEnemies';
import { smoothMotion } from './HypotheticalMotion';

export interface VanguardPose { crouch:number; lean:number; lift:number; spread:number; armX:number; armY:number; bladeX:number; bladeY:number }
interface PoseState {
    phase:FoePhase; move:'rush'|'cross'|'vault'|'sweep'; actionTicks:number;
    tellTicks:number; attackDuration:number; landed:boolean; landingAge:number; vy:number;
    landing:{steps?:number}|null;
}
const unit=(t:number)=>Math.max(0,Math.min(1,t));

/** Key poses follow the physical action; blending never delays a hit or a tell. */
export function vanguardTargetPose(e:PoseState):VanguardPose {
    const tell=e.phase==='warning'?unit(e.actionTicks/e.tellTicks):0;
    const attack=e.phase==='attack',rest=e.phase==='rest'||e.phase==='stunned';
    const progress=attack?unit(e.actionTicks/e.attackDuration):0;
    const release=smoothMotion(e.actionTicks/6);
    const thrust=smoothMotion(progress/.26)*(1-smoothMotion((progress-.65)/.35));
    const sweep=e.move==='sweep',cross=e.move==='cross',vault=e.move==='vault';
    const airborne=attack&&vault&&!e.landed;
    const settle=attack&&vault&&e.landed?1-smoothMotion(e.landingAge/12):0;
    const crouch=e.phase==='stunned'?4:sweep?(attack?6*thrust+4*(1-release):tell*5)
        :attack&&vault?(e.landed?5*settle:3*(1-release)):attack?3*(1-release):tell*3;
    const lean=e.phase==='stunned'?-3:attack&&!vault?-2*(1-release)+(sweep?6:4)*thrust
        :airborne?-2+4*release:settle?2*settle:tell*-2;
    const lift=airborne?(e.vy<0?6:2+4*(1-smoothMotion(e.vy/8)))*release:0;
    const spread=sweep&&attack?thrust:settle*.6;
    let armX=sweep?(attack?8+17*thrust:8-tell*5):attack?(cross?-1+9*release+10*Math.sin(progress*Math.PI):3+5*release+14*thrust):rest?8:7-tell*(cross?8:4);
    let armY=sweep?-17+11*(attack?thrust:tell):attack&&cross?-27+crouch+17*Math.sin(progress*Math.PI)+10*smoothMotion((progress-.65)/.35)
        :-17+crouch-(attack?5*(1-release):tell*(cross?10:5));
    let bladeX=armX+2+(sweep?12:7)*(attack?thrust:0);
    let bladeY=armY-12+(sweep?12:cross?17:10)*(attack?thrust:0);
    if(attack&&vault){
        const descent=e.landed?1:smoothMotion((e.actionTicks/(e.landing?.steps??40)-.5)/.45);
        armX=5+9*descent;armY=-23+10*descent+crouch*.4;
        bladeX=armX+5+5*descent;bladeY=armY-12+16*descent;
    }
    return {crouch,lean,lift,spread,armX,armY,bladeX,bladeY};
}

export function blendVanguardPose(a:VanguardPose,b:VanguardPose,t:number):VanguardPose {
    const u=smoothMotion(t),mix=(key:keyof VanguardPose)=>a[key]+(b[key]-a[key])*u;
    return {crouch:mix('crouch'),lean:mix('lean'),lift:mix('lift'),spread:mix('spread'),
        armX:mix('armX'),armY:mix('armY'),bladeX:mix('bladeX'),bladeY:mix('bladeY')};
}
