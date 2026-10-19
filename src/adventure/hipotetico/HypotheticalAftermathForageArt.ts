import {box,oval,pixelLine,polygon} from '../WorldPainting';
import type {AftermathForage} from './HypotheticalAftermathForage';

const P={shade:'#73887d',dust:'#a8ae96',light:'#bab99e',stone:'#8f9f8b',ink:'#607b73'};

/** Low, opaque dust is a staging mask, including with reduced motion. Loose
 * grit alone is optional; a settings change never reveals the obscured action. */
export function drawForageCover(c:CanvasRenderingContext2D,s:AftermathForage,base:number,reduced:boolean){
    const cover=s.cover;if(cover<.025)return;
    const x=s.targetX,a=s.age-s.contactAt;
    const top=base-3-cover*14,w=26*Math.sqrt(cover);
    const eddy=reduced?0:Math.sin(a/17)*cover*.8;
    polygon(c,[[x-w,base-2],[x-w,top+8*cover],[x-20*cover,top+4*cover],[x-13*cover,top+4*cover],
        [x-10*cover,top+eddy],[x,top-cover],[x+7*cover,top+2*cover],[x+16*cover,top+2*cover-eddy],[x+w-3,top+6*cover],[x+w,base-2]],P.shade);
    polygon(c,[[x-w+2,base-3],[x-w+3,top+9*cover],[x-17*cover,top+5*cover],[x-10*cover,top+6*cover],
        [x-8*cover,top+2*cover+eddy],[x+1,top+cover],[x+7*cover,top+5*cover],[x+16*cover,top+4*cover-eddy],[x+w-3,top+9*cover],[x+w-2,base-3]],P.dust);
    for(let j=0;j<5;j++){
        const drift=reduced?0:Math.sin((a-j*3)/19)*(1+j%2)*cover;
        pixelLine(c,x+(-18+j*8)*cover+drift,top+(8+j%2*4)*cover,x+(-12+j*8)*cover+drift,top+(8+j%2*4)*cover,P.light);
    }
    // Ground contact and a diffuse shadow keep the cloud on the same pavement.
    oval(c,x-w,base-3,w*2,2,P.shade);
    if(reduced)return;
    // Thin detached wisps drift along the pavement after the dense central
    // cloud has formed. Its opaque core keeps the action implied.
    for(let j=0;j<3;j++){
        const drift=Math.max(0,a-j*8),life=Math.max(0,1-drift/105)*cover;
        if(life<=.1)continue;
        const px=x+w-2+drift*.13,py=base-4-j*3-drift*.025;
        box(c,px,py,Math.max(1,(7-j)*life),1,j%2?P.light:P.dust);
    }
    for(let j=0;j<7;j++){
        const t=a-j*2;if(t<0||t>74)continue;
        const gravity=.1,vx=(j-3)*.14,vy=-.7-j%3*.15;
        const landing=-2*vy/gravity;
        const flight=Math.min(t,landing),after=Math.max(0,t-landing),bounce=-vy*.22;
        const hop=Math.min(after,2*bounce/gravity),roll=Math.max(0,after-hop);
        const px=x+(j-3)*3+vx*flight+vx*.4*hop+vx*5*(1-Math.exp(-roll/9));
        const py=base-3+(t<landing?vy*flight+gravity*flight*flight/2:-bounce*hop+gravity*hop*hop/2);
        box(c,px,py,2,1,j%2?P.stone:P.ink);
    }
}
