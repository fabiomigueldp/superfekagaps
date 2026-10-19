import { box, pixelLine, polygon, type Point } from '../WorldPainting';

/** Short, concentrated bursts. Their end times preserve the authored combo/recovery windows. */
export const RIFLE_BURSTS: readonly (readonly number[])[] = [
    [1, 7, 13, 37, 43, 49], [1, 6, 11, 33, 38, 43], [1, 5, 9, 27, 31, 35, 53, 57, 61],
];
export const RIFLE_SPEED = [5.2, 5.8, 6.4] as const;
export function gunRecoil(muzzle: number) {
    const t = Math.max(0, Math.min(1, muzzle / 5));
    return 4.8 * t * t * (3 - 2 * t);
}

const close = { edge: '#b65f40', fire: '#f7a454', core: '#fff1c5', smoke: '#98a198', chip: '#a5a28b', scar: '#263f3d' };
const far = { edge: '#ab8964', fire: '#d9b77d', core: '#ead7ae', smoke: '#9da99b', chip: '#b3ae95', scar: '#637c74' };

/** A two-frame ignition, a short flame and cooling gases; no full-screen flash. */
export function drawGunMuzzle(c: CanvasRenderingContext2D, x: number, y: number, dx: number, dy: number,
    muzzle: number, reduced: boolean, distant = false) {
    if (muzzle <= 0) return;
    const p = distant ? far : close, scale = distant ? .6875 : 1;
    const at = (u: number, v: number): Point => [x + (dx * u - dy * v) * scale, y + (dy * u + dx * v) * scale];
    if (reduced) { pixelLine(c, ...at(0, 0), ...at(5, 0), p.fire); return; }
    const age = 5 - muzzle, length = [19, 13, 7, 0, 0][age] ?? 0;
    if (length) {
        polygon(c, [at(0,-2), at(length*.38,-5+age), at(length*.5,-2), at(length,0), at(length*.6,2), at(length*.3,5-age), at(0,2)], p.edge);
        polygon(c, [at(0,-1), at(length*.45,-2), at(length*.87,0), at(length*.4,2), at(0,1)], p.fire);
        pixelLine(c, ...at(0,0), ...at(length*.55,0), p.core, age ? 1 : 2);
        // Reflected light follows the barrel, rather than washing out the rider's face.
        if (age < 2) pixelLine(c, ...at(-6,-2), ...at(-1,-2), p.fire);
    }
    if (age < 2) for (const side of [-1,1]) pixelLine(c, ...at(5+age*4,side*(5+age)), ...at(8+age*4,side*(6+age)), p.fire);
    if (age >= 2) for (let i=0;i<2;i++) {
        const a=at(5+age*2+i*3, -age-i*2);box(c,a[0],a[1],2,1,p.smoke);
    }
}

export interface GunTrace { x: number; y: number; vx: number; vy: number; age: number }
/** Never extrapolate a tracer behind its actual spawn point. */
export function gunTracerStart(s: GunTrace, reduced = false) {
    const length = Math.min(s.age, reduced ? 1 : 2.25);
    return { x: s.x-s.vx*length, y: s.y-s.vy*length };
}
export function drawGunTracer(c: CanvasRenderingContext2D, s: GunTrace, ox: number, oy: number, reduced: boolean, distant = false) {
    const p=distant?far:close,start=gunTracerStart(s,reduced),r=distant?0:2;
    const x=s.x+ox+r,y=s.y+oy+r;
    pixelLine(c,start.x+ox+r,start.y+oy+r,x,y,p.edge,distant||reduced?1:3);
    pixelLine(c,(start.x+s.x)*.5+ox+r,(start.y+s.y)*.5+oy+r,x,y,p.fire);
    box(c,x-1,y-1,distant?2:3,distant?1:3,p.core);
}

export interface GunImpact {
    x:number; y:number; nx:number; ny:number; born:number;
    fromX?:number; fromY?:number; material?:'stone'|'cloth'|'timber'|'iron'|'water';
}
export function drawGunImpact(c:CanvasRenderingContext2D,p:GunImpact,tick:number,ox:number,oy:number,reduced:boolean,distant=false) {
    const base=distant?far:close,color=p.material==='timber'?{...base,chip:'#c8a47b',smoke:'#a9a490'}:p.material==='iron'?{...base,chip:'#92aba7'}:base,age=tick-p.born,x=p.x+ox,y=p.y+oy,soft=p.material==='cloth';
    if(age<0)return;
    if(p.material==='water'){
        if(age>27)return;
        const spread=2+age*.42;
        pixelLine(c,x-spread,y,x+spread,y,'#79aaa5');
        if(age<16)pixelLine(c,x-spread*.65,y-1,x+spread*.65,y-1,'#b0d1ba');
        if(!reduced&&age<18)for(const d of [-1,1]){
            const lift=Math.max(0,age*1.1-age*age*.06);
            box(c,x+d*age*.4,y-lift,1,2,'#d3e2c2');
        }
        return;
    }
    const wood=p.material==='timber',metal=p.material==='iron';
    if(!soft) {
        box(c,x-(p.nx?0:1),y-(p.ny?0:1),p.nx?1:3,p.ny?1:3,color.scar);
        if(age<2&&p.fromX!==undefined&&p.fromY!==undefined)pixelLine(c,p.fromX+ox,p.fromY+oy,x,y,color.fire);
        if(age<2&&!reduced){pixelLine(c,x-p.ny*3,y+p.nx*3,x+p.ny*3,y-p.nx*3,color.core,2);}
    }
    if(age>28)return;
    const count=reduced?2:soft?3:6;
    for(let i=0;i<count;i++){
        const fan=(i-(count-1)/2)*.4,travel=Math.min(age,reduced?4:20)*(.55+(i%3)*.22)*(distant?.65:1);
        const nx=p.nx*Math.cos(fan)-p.ny*Math.sin(fan),ny=p.ny*Math.cos(fan)+p.nx*Math.sin(fan);
        const px=x+nx*travel,py=y+ny*travel+age*age*.015;
        if(wood&&age<18)pixelLine(c,px,py,px+nx*3,py+ny*3,color.chip);
        else if(!soft&&age<(metal?12:9)&&!reduced)pixelLine(c,px,py,px+nx*(metal?5:3),py+ny*(metal?5:3),i%2?color.fire:color.core);
        else if(age<20)box(c,px,py,i%2?1:2,1,color.chip);
    }
    if(!reduced&&age>3&&age<25)for(let i=0;i<2;i++){
        box(c,x+p.nx*(age*.18+2)+i*3,y+p.ny*3-age*.22-i*2,age<15?3:2,1,color.smoke);
    }
}

/** One ballistic arc and a small ground bounce, shared by both depth layers. */
export function gunCasingPosition(x:number,y:number,direction:number,age:number,floor:number,scale=1) {
    const v=-1.6*scale,g=.07*scale,land=(-v+Math.sqrt(v*v+4*g*Math.max(0,floor-1-y)))/(2*g);
    const t=Math.min(age,land),after=Math.max(0,age-land),bounce=after<12?Math.sin(after/12*Math.PI)*2*scale:0;
    return {x:x-direction*(t*.65+Math.min(after,12)*.22)*scale,y:(age>=land?floor-1:Math.min(floor-1,y+v*t+g*t*t))-bounce};
}
export function drawGunCasing(c:CanvasRenderingContext2D,x:number,y:number,direction:number,age:number,floor:number,reduced:boolean,scale=1) {
    if(reduced)return;
    const p=gunCasingPosition(x,y,direction,age,floor,scale),turn=Math.floor(age/3)%4;
    pixelLine(c,p.x,p.y,p.x+(turn%2?0:2),p.y+(turn%2?-2:0),'#d3a75c');box(c,p.x,p.y,1,1,'#fff0ce');
}
