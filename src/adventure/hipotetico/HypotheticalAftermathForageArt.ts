import {box,oval,pixelLine,polygon} from '../WorldPainting';
import {smoothMotion} from './HypotheticalMotion';
import {forageGrain,type AftermathForage} from './HypotheticalAftermathForage';

const P={shade:'#73887d',dust:'#a8ae96',light:'#bab99e',stone:'#8f9f8b',ink:'#607b73'};

/** Ground effects keep their own elapsed time after a street transition. The
 * dense core conceals the action; it disperses through loss of density while
 * free wisps and grit finish their drift and settling independently. */
export function drawForageCover(c:CanvasRenderingContext2D,s:AftermathForage,base:number,reduced:boolean,tick:number){
    for(const mark of s.marks){
        pixelLine(c,mark.x-11,base-2,mark.x+10,base-2,'#7b8e7e');
        pixelLine(c,mark.x-7,base-3,mark.x+5,base-3,'#909e87');
        for(let j=0;j<3;j++)box(c,mark.x-8+j*7,base-2-j%2,2,1,j%2?P.stone:P.shade);
    }
    if(s.contactTick<0)return;
    const a=tick-s.contactTick;if(a<0)return;
    const cover=s.coverAt(tick),build=smoothMotion(a/20);
    const clearing=smoothMotion((a-64)/60),wind=s.district%2?-.022:.034;
    const x=s.targetX+(reduced?0:Math.max(0,a-20)*wind);
    const density=build>0?Math.min(1,cover/build):0;
    if(density>.01&&build>.025){
        const top=base-3-build*(14-clearing*2),w=26*Math.sqrt(build)*(1+clearing*.22);
        const eddy=reduced?0:Math.sin(a/17)*build*.8;
        c.save();c.globalAlpha*=density;
        polygon(c,[[x-w,base-2],[x-w,top+8*build],[x-20*build,top+4*build],[x-13*build,top+4*build],
            [x-10*build,top+eddy],[x,top-build],[x+7*build,top+2*build],[x+16*build,top+2*build-eddy],[x+w-3,top+6*build],[x+w,base-2]],P.shade);
        polygon(c,[[x-w+2,base-3],[x-w+3,top+9*build],[x-17*build,top+5*build],[x-10*build,top+6*build],
            [x-8*build,top+2*build+eddy],[x+1,top+build],[x+7*build,top+5*build],[x+16*build,top+4*build-eddy],[x+w-3,top+9*build],[x+w-2,base-3]],P.dust);
        for(let j=0;j<5;j++){
            const drift=reduced?0:Math.sin((a-j*3)/19)*(1+j%2)*build;
            pixelLine(c,x+(-18+j*8)*build+drift,top+(8+j%2*4)*build,
                x+(-12+j*8)*build+drift,top+(8+j%2*4)*build,P.light);
        }
        oval(c,x-w,base-3,w*2,2,P.shade);c.restore();
    }
    if(reduced)return;
    // Separate births prevent the outskirts from all breathing in unison.
    // A cancelled action releases only puffs already born before the cut.
    for(let j=0;j<5;j++){
        const born=s.contactTick+j*11;if(s.cancelledAt>=0&&born>s.cancelledAt)continue;
        const t=tick-born;if(t<0||t>126)continue;
        const life=smoothMotion(t/12)*(1-smoothMotion((t-50)/76));
        const side=j%2?1:-1,vx=side*(.12+j*.012),drag=1-Math.exp(-t/35);
        const px=s.contactX+side*(12+j%3*3)+vx*35*drag+t*wind;
        const py=base-5-j%3*3-1.8*(1-Math.exp(-t/28));
        c.save();c.globalAlpha*=life*.65;
        box(c,px,py,4+j%3+t*.025,1,P.dust);
        if(j%2===0)box(c,px+2,py-1,3+t*.015,1,P.light);
        c.restore();
    }
    for(let j=0;j<9;j++){
        if(s.cancelledAt>=0&&s.contactTick+j>s.cancelledAt)continue;
        const t=a-j;if(t<0||t>112)continue;
        const g=forageGrain(j,t,s.district),px=s.contactX+g.x,py=base+g.y;
        c.save();c.globalAlpha*=1-smoothMotion((t-68)/44);
        if(t<g.landing+g.rebound)box(c,px,base-2,2,1,P.shade);
        box(c,px,py,2,1,j%2?P.stone:P.ink);
        if(t>g.landing&&t<g.landing+8)box(c,px+1,base-3,2,1,P.dust);
        c.restore();
    }
}
