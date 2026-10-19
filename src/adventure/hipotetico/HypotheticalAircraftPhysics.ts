import type {Point} from '../WorldPainting';

export const HELICOPTER_GROUND=-6;
export type AircraftPart='hull'|'tail'|'rotor'|'door'|'panel'|'skid'|'rail';
export interface BladeProjection {phase:number;rate:number;tilt:number}
export interface AircraftBody {
    part:AircraftPart;x:number;y:number;angle:number;vx:number;vy:number;spin:number;
    sleeping:boolean;contacts:number;quiet:number;born:number;flatten:number;
    projection?:BladeProjection;accessory?:{phase:number;rate:number};dent?:number;
}
export type AircraftPose=Pick<AircraftBody,'x'|'y'|'angle'>&Partial<Pick<AircraftBody,'part'|'flatten'|'projection'|'dent'>>;
export interface AircraftContact {x:number;y:number;strength:number;slide:number;first:boolean}
export const AIRCRAFT_SHAPES:Record<AircraftPart,readonly Point[]>={
    hull:[[-26,1],[-24,-6],[-15,-14],[5,-14],[19,-8],[23,3],[14,11],[-14,10]],
    tail:[[-18,3],[8,-3],[12,-16],[18,-18],[17,3],[2,8]],
    rotor:[[-37,-1],[-3,-1],[-2,-2],[2,-2],[3,-1],[37,-1],[37,1],[3,1],[2,2],[-2,2],[-3,1],[-37,1]],
    door:[[-6,-8],[6,-8],[6,8],[-6,8]],
    panel:[[-6,-3],[5,-5],[7,2],[-4,5]],
    skid:[[-23,0],[-20,-2],[20,-2],[24,0],[22,2],[-22,2]],
    rail:[[-20,-1],[19,-1],[20,1],[-19,1]],
};
export function aircraftPoint(p:AircraftPose,x:number,y:number):Point {
    const co=Math.cos(p.angle),si=Math.sin(p.angle),blade=p.projection;
    const sheet=p.part==='door'||p.part==='panel',fold=1-(p.flatten??0);
    const dent=(p.dent??0)*Math.max(0,(-x-8)/18)*3;
    const across=(blade?x*Math.cos(blade.phase):x)+dent;
    const height=y*(sheet?1:fold)+(blade?x*Math.sin(blade.phase)*blade.tilt:0)+dent*.7;
    // Loose sheet metal tips toward the pavement in depth, regardless of its
    // screen rotation. It must not turn into a thin upright door on landing.
    return [p.x+across*co-height*si,p.y+(across*si+height*co)*(sheet?fold:1)];
}
export function aircraftOutline(p:AircraftBody,skids=false):Point[]{
    const shape=p.part==='hull'&&skids?[...AIRCRAFT_SHAPES.hull,[-20,17],[21,17]] as Point[]:AIRCRAFT_SHAPES[p.part];
    return shape.map(v=>aircraftPoint(p,...v));
}
const clamp=(n:number,min:number,max:number)=>Math.max(min,Math.min(max,n));

/** Two short steps resolve velocity at the actual support vertices. Contact
 * impulses rotate a body around its support; no prescribed resting angles. */
export function stepAircraftBody(p:AircraftBody,gravity:number,skids:boolean):AircraftContact|null {
    if(p.sleeping)return null;
    if(p.contacts>0&&(p.part==='door'||p.part==='panel'))p.flatten=Math.min(.72,p.flatten+.035);
    if(p.contacts>0&&p.part==='hull'){
        p.flatten=Math.min(.11,p.flatten+.012);p.dent=Math.min(1,(p.dent??0)+.065);
    }
    if(p.projection&&p.contacts===0){
        p.projection.phase+=p.projection.rate;p.projection.rate*=.962;
        p.projection.tilt=Math.min(.62,p.projection.tilt+.009);
    }
    if(p.accessory){p.accessory.phase+=p.accessory.rate;p.accessory.rate*=p.contacts?.62:.97;}
    const shape=AIRCRAFT_SHAPES[p.part],inertia=Math.max(12,shape.reduce((sum,v)=>sum+v[0]**2+v[1]**2,0)/shape.length*.55);
    const invI=1/inertia,first=p.contacts===0,fold=p.part==='door'||p.part==='panel'?1-p.flatten:1;
    let result:AircraftContact|null=null;
    p.vx*=p.part==='hull'?.999:.994;p.spin*=p.part==='hull'?.999:.994;
    for(let step=0;step<2;step++){
        p.vy+=gravity*.5;p.x+=p.vx*.5;p.y+=p.vy*.5;p.angle+=p.spin*.5;
        const points=aircraftOutline(p,skids),support=points.reduce((a,b)=>a[1]>b[1]?a:b);
        if(support[1]<HELICOPTER_GROUND)continue;
        const depth=support[1]-HELICOPTER_GROUND;
        p.y-=depth;
        const rx=support[0]-p.x,ry=HELICOPTER_GROUND-p.y;
        const strength=Math.max(0,p.vy+p.spin*rx*fold),slide=p.vx-p.spin*ry/fold;
        if(!result||strength>result.strength)result={x:support[0],y:HELICOPTER_GROUND,strength,slide,first};
        // Resolve both ends of a nearly flat edge, then let gravity finish the
        // rocking motion. Alternating the order avoids a preferred tipping side.
        const touching=points.filter(v=>v[1]-depth>=HELICOPTER_GROUND-.09);
        for(let pass=0;pass<3;pass++)for(const v of pass%2?[...touching].reverse():touching){
            const x=(v[0]-p.x)*fold,y=(v[1]-depth-p.y)/fold,speed=p.vy+p.spin*x;
            if(speed<=0)continue;
            const bounce=speed>.65?(p.part==='hull'?.06:p.part==='rail'?.12:.17):0;
            const impulse=(1+bounce)*speed/(1+x*x*invI);
            p.vy-=impulse;p.spin-=x*impulse*invI;
            const friction=p.part==='hull'?.62:.46,tangent=p.vx-p.spin*y;
            const drag=clamp(-tangent/(1+y*y*invI),-friction*impulse,friction*impulse);
            p.vx+=drag;p.spin-=y*drag*invI;
        }
        if(p.projection)p.projection.rate=0;
    }
    if(result){
        p.contacts++;
        const radius=Math.sqrt(inertia),motion=Math.abs(p.vx)+Math.abs(p.vy)+Math.abs(p.spin)*radius;
        const shapeSettled=p.part==='hull'?(p.dent??0)>=1:fold===1||p.flatten>=.72;
        if(motion<.1&&shapeSettled){
            if(++p.quiet>18){p.sleeping=true;p.vx=p.vy=p.spin=0;}
        }else p.quiet=0;
    }else p.quiet=0;
    return result;
}
