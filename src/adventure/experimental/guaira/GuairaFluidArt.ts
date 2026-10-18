import { box as r } from '../../WorldPainting';
import type { JetCycle } from '../../WorldMachineState';
import type { MovingBody } from '../../WorldPhysics';

/** Milliseconds per native pixel. Pressure, gravity and surface drift have
 * different speeds, but every piece of a connected circuit shares its clock. */
export const GUAIRA_FLOW_STEP = Object.freeze({ pipe:32, pressure:24, falling:28, surface:100, channel:80, rice:160 });
export const guairaFluidTime = (time:number,reduced:boolean) => reduced || !Number.isFinite(time) ? 0 : Math.max(0,time);
type WaterPalette = Readonly<{body:string;shade:string;foam:string;edge?:string;light?:string}>;
const STREAM_PHASES=[0,17,7,29,11,37,23,43] as const;

/** Coherent, tapered ribbons travel from the fixed nozzle through the live
 * pressure envelope. The opaque silhouette always covers the exact danger;
 * texture is clipped numerically, including the first and last fractional pixel. */
export function drawGuairaRisingWater(c:CanvasRenderingContext2D,d:NonNullable<JetCycle['danger']>,
    time:number,cx:number,cy:number,reduced:boolean,p:WaterPalette) {
    cx=Number.isFinite(cx)?cx:0;cy=Number.isFinite(cy)?cy:0;
    const left=Math.floor(d.x-cx),right=Math.ceil(d.x+d.width-cx);
    const top=Math.floor(d.y-cy),bottom=Math.ceil(d.y+d.height-cy),width=right-left,height=bottom-top;
    if(width<=0||height<=0)return;
    c.save();c.globalAlpha=1;c.globalCompositeOperation='source-over';
    r(c,left,top,width,height,p.body);
    if(p.edge){r(c,left,top,1,height,p.edge);if(width>1)r(c,right-1,top,1,height,p.edge);}
    const travel=Math.floor(guairaFluidTime(time,reduced)/GUAIRA_FLOW_STEP.pressure);
    const ink=(x:number,y:number,w:number,h:number,color:string)=>{
        const x0=Math.max(left+1,x),x1=Math.min(right-1,x+w),y0=Math.max(top+1,y),y1=Math.min(bottom,y+h);
        if(x1>x0&&y1>y0)r(c,x0,y0,x1-x0,y1-y0,color);
    };
    for(let lane=0,dx=5;dx<width-3;lane++,dx+=16){
        const stagger=STREAM_PHASES[lane%STREAM_PHASES.length];
        const first=Math.floor((top-bottom+travel+stagger)/48);
        const last=Math.ceil((travel+stagger)/48);
        for(let band=first;band<=last;band++){
            const y=bottom+band*48-travel-stagger,x=left+dx;
            // A narrow leading end opens into a curved ribbon and tapers away.
            // Neighbouring ribbons are staggered instead of forming horizontal bars.
            ink(x,y,2,6,p.shade);ink(x+1,y+6,3,10,p.shade);
            ink(x+2,y+16,3,10,p.shade);ink(x+1,y+26,2,8,p.shade);
            if(p.light){ink(x+5,y+9,1,11,p.light);ink(x+4,y+20,1,5,p.light);}
        }
    }
    r(c,left,top,width,1,p.foam);
    c.restore();
}

/** Harmless pale residue accelerates toward the grate after a real shutoff.
 * It expires with the native 300ms shutdown snapshot; it cannot leave a cyan
 * remnant or cover the walking surface after pressure has been isolated. */
export function drawGuairaDrainDrops(c:CanvasRenderingContext2D,left:number,mouth:number,width:number,
    height:number,age:number,color:string,reduced:boolean,count=4) {
    if(reduced||!Number.isFinite(age)||age<0||age>=300||height<=0)return;
    const fall=(age/300)**2;
    c.save();
    for(let i=0;i<count;i++){
        const fraction=(i+1)/(count+1),x=Math.round(left+width*fraction);
        const y=Math.min(Math.round(mouth)-2,Math.round(mouth-height*fraction*(1-fall)));
        r(c,x,y,age<160?2:1,age<160?1:2,color);
    }
    c.restore();
}

/** A vent releases a few small arcs back into its own grate. Staggered lifetimes
 * let the droplets settle individually, instead of rising like four smoke bars
 * and vanishing together. They never leave the outlet or borrow danger colours. */
export function drawGuairaVentDrops(c:CanvasRenderingContext2D,left:number,mouth:number,width:number,
    vent:number,reduced:boolean) {
    if(reduced||!Number.isFinite(vent)||vent<=0||vent>1||width<4)return;
    const age=1-vent,lo=Math.ceil(left)+1,hi=Math.floor(left+width)-2,floor=Math.floor(mouth);
    c.save();
    for(let i=0;i<4;i++){
        const delay=i*.035,life=.68+i*.065,u=(age-delay)/life;
        if(u<0||u>=1)continue;
        const x=Math.max(lo,Math.min(hi,Math.round(left+width*(i+1)/5+(i%2?1:-1)*u*2)));
        const lift=Math.round(4*(4+i%3)*u*(1-u));
        const y=floor-2-lift;
        r(c,x,y,1,u>.55&&lift>0?2:1,u<.68?'#cad6c4':'#a4b6a7');
    }
    c.restore();
}

/** The original vents, relief room and expanded routes share the same native
 * cycle and shutdown snapshot. A dry valve cannot leave a cyan afterimage. */
export function drawGuairaPressureResidue(c:CanvasRenderingContext2D,
    body:Pick<MovingBody,'x'|'y'|'width'|'height'|'active'|'jetShutdown'>,
    cycle:JetCycle,cx:number,cy:number,time:number,reduced:boolean,count=4) {
    if(reduced||cycle.danger)return;
    const left=body.x-cx,mouth=body.y+body.height-4-cy;
    if(body.active&&body.jetShutdown) {
        drawGuairaDrainDrops(c,left,mouth,body.width,body.jetShutdown.height,
            time-body.jetShutdown.at,'#cad6c4',false,count);
    }else if(!body.active)drawGuairaVentDrops(c,left,mouth,body.width,cycle.vent,false);
}
