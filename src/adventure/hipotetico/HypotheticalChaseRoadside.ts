import {box,oval,pixelLine,polygon,type Point} from '../WorldPainting';
import type {HypotheticalModel} from './HypotheticalModel';
import {chaseCollapsedEdge,CHASE_WATER_Y} from './HypotheticalChaseDetails';
import {chaseWindAt} from './HypotheticalChaseLife';

/** Service objects are on the rear shoulder of actual banks. Their low-contrast
 * silhouettes never receive the ivory edge used by playable platforms. */
export const CHASE_ROADSIDE=[
    {x:232,kind:'mooring',width:29}, {x:456,kind:'net',width:36},
    {x:1320,kind:'reel',width:34}, {x:1944,kind:'tools',width:32},
    {x:2392,kind:'cabinet',width:27}, {x:3144,kind:'reel',width:34},
    {x:3704,kind:'pipe',width:37}, {x:4672,kind:'pipe',width:37},
    {x:5232,kind:'reel',width:34}, {x:6112,kind:'net',width:36},
    {x:7432,kind:'cabinet',width:27}, {x:7632,kind:'tools',width:32},
] as const;
type Site=typeof CHASE_ROADSIDE[number];
const P={ink:'#3d6267',shade:'#69887a',metal:'#879b87',light:'#a6ad8f',
    rope:'#a99d7b',grain:'#857e65',wood:'#9a8e70',cloth:'#7b9b8a',water:'#79aaa5'};
const unit=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>{const t=unit(n);return t*t*(3-2*t);};
const nativeBox=box,nativeLine=pixelLine,nativePolygon=polygon;
const contacts=new Map<number,{age:number;x:number}>();
function waterContact(width:number){
    let p=contacts.get(width);if(p)return p;
    const half=width/2+2,depth=3;
    let lo=0,hi=24;
    for(let i=0;i<16;i++){
        const t=(lo+hi)/2,angle=Math.min(.7,t*.028),drop=t*t*.075+half*Math.sin(angle)+depth*Math.cos(angle);
        if(drop<CHASE_WATER_Y-221)lo=t;else hi=t;
    }
    const t=(lo+hi)/2;
    const angle=Math.min(.7,t*.028);
    p={age:t+2,x:width/2+t*.2+half*Math.cos(angle)-depth*Math.sin(angle)};
    contacts.set(width,p);return p;
}

/** A fallen fixture uses the timestamp of its real supporting tile. Its
 * position never resets when the camera returns, and checkpoints omit it. */
export function chaseRoadsidePose(b:HypotheticalModel,site:Site){
    const anchor=Math.floor((site.x+site.width/2)/16)*16;
    const debris=b.bridgeDebris.find(d=>d.x===anchor);
    if(!debris)return {visible:anchor>=chaseCollapsedEdge(b.x),age:-1,drop:0,slide:0,turn:0,contact:-1,contactX:0};
    const age=b.tick-debris.born,t=Math.max(0,age-2),contact=waterContact(site.width);
    return {visible:age<44,age,drop:t*t*.075,slide:t*.2,
        turn:Math.min(.7,t*.028),contact:contact.age,contactX:contact.x};
}

/** Only real footfalls/landings send a brief impulse through the fittings.
 * Airborne travel cannot keep rattling the ground with a free-running sine. */
function groundImpulse(b:HypotheticalModel,site:Site){
    let force=0;
    for(const p of b.dust){
        if(p.kind!=='step'&&p.kind!=='stone'||Math.abs(p.y-224)>16)continue;
        const age=b.tick-p.born,distance=Math.abs(p.x-(site.x+site.width/2));
        if(age<0||age>24||distance>128)continue;
        force+=Math.sin(age*.72)*Math.exp(-age/8)*(1-distance/128)*(p.kind==='stone'?1.6:1);
    }
    return Math.max(-1.4,Math.min(1.4,force));
}

function fixture(c:CanvasRenderingContext2D,site:Site,tick:number,wind:number,rattle:number,ox:number,oy:number,turn:number){
    const w=site.width;
    const co=Math.cos(turn),si=Math.sin(turn);
    const at=(x:number,y:number):Point=>[ox+w/2+(x-w/2)*co-y*si,oy+(x-w/2)*si+y*co];
    // Rotate the geometry before scan conversion. Canvas transforms would
    // anti-alias the tiny sprite during its fall and break the native grid.
    const polygon=(ctx:CanvasRenderingContext2D,points:readonly Point[],color:string)=>nativePolygon(ctx,points.map(p=>at(...p)),color);
    const box=(ctx:CanvasRenderingContext2D,x:number,y:number,ww:number,hh:number,color:string)=>{
        if(ww<=0||hh<=0)return;
        if(turn===0)nativeBox(ctx,ox+x,oy+y,ww,hh,color);
        else polygon(ctx,[[x,y],[x+ww,y],[x+ww,y+hh],[x,y+hh]],color);
    };
    const pixelLine=(ctx:CanvasRenderingContext2D,x:number,y:number,xx:number,yy:number,color:string,size=1)=>
        nativeLine(ctx,...at(x,y),...at(xx,yy),color,size);
    const oval=(ctx:CanvasRenderingContext2D,x:number,y:number,ww:number,hh:number,color:string)=>{
        for(let j=0;j<hh;j++){
            const half=Math.sqrt(Math.max(0,1-((j+.5-hh/2)/(hh/2))**2))*ww/2;
            box(ctx,Math.ceil(x+ww/2-half),y+j,Math.floor(half*2),1,color);
        }
    };
    const coil=(ctx:CanvasRenderingContext2D,x:number,y:number,width=14)=>{
        oval(ctx,x,y-3,width,5,P.grain);oval(ctx,x+1,y-4,width-2,4,P.rope);
        oval(ctx,x+3,y-3,width-6,2,P.grain);pixelLine(ctx,x+2,y-4,x+width-4,y-4,P.light);
        pixelLine(ctx,x+width-3,y-1,x+width+3,y,P.rope);
    };
    // The origin is the fixed base of this complete sprite, also during a fall.
    // Three pixels of plinth reach the actual road surface at world y=224.
    box(c,-2,0,w+4,3,'#617c75');pixelLine(c,-1,0,w,0,'#859781');
    box(c,1,-2,w-2,2,P.ink);pixelLine(c,2,-2,w-4,-2,P.shade);
    if(site.kind==='mooring'){
        for(const x of [5,18]){
            box(c,x,-12,5,10,P.ink);box(c,x+1,-11,2,8,P.metal);
            box(c,x-2,-13,9,3,P.shade);pixelLine(c,x-1,-13,x+5,-13,P.metal);
        }
        pixelLine(c,6,-7,20,-7,P.grain,3);pixelLine(c,5,-8,21,-8,P.rope);
        coil(c,13,-3,12);
        pixelLine(c,7,-6,3,0,P.rope);box(c,3,-1,2,1,P.light);
    }else if(site.kind==='net'){
        for(const x of [3,29]){
            box(c,x,-21,3,20,P.ink);pixelLine(c,x,-20,x,-4,P.wood);
        }
        pixelLine(c,4,-20,30,-20,P.ink,2);
        const a=(u:number,v:number):Point=>[u+wind*.8*v/17,v-19+rattle*.3*v/17];
        polygon(c,[a(5,0),a(29,0),a(28,15),a(17,18),a(6,13)],P.cloth);
        for(let j=0;j<5;j++){
            pixelLine(c,...a(6+j*5,1),...a(7+j*4,14+j%2*2),P.shade);
            pixelLine(c,...a(6,3+j*3),...a(28,4+j*3),j%2?P.shade:'#91a790');
        }
        for(const u of [6,14,22,28]){
            const p=a(u,1);box(c,p[0],p[1],2,2,P.rope);
        }
        coil(c,11,-1,12);
        box(c,30,-6,5,4,P.wood);box(c,31,-6,3,1,P.light);
    }else if(site.kind==='reel'){
        box(c,8,-8,18,6,P.grain);
        oval(c,4,-25,23,23,P.ink);oval(c,6,-24,19,20,P.wood);
        oval(c,8,-22,15,16,P.grain);oval(c,9,-21,13,14,P.rope);
        for(let i=0;i<5;i++)pixelLine(c,10,-19+i*2,20,-19+i*2,P.grain);
        const angle=rattle*.07+site.x*.01;
        for(let i=0;i<4;i++){
            const a=angle+i*Math.PI/2;
            pixelLine(c,16+Math.cos(a)*3,-14+Math.sin(a)*3,16+Math.cos(a)*9,-14+Math.sin(a)*9,P.wood,2);
        }
        oval(c,13,-17,6,6,P.ink);box(c,15,-15,2,2,P.metal);
        pixelLine(c,7,-20,10,-23,P.light);pixelLine(c,10,-23,19,-23,P.light);
        pixelLine(c,24,-8,30,-4,P.grain,2);pixelLine(c,25,-8,30,-5,P.rope);
        box(c,27,-3,5,2,P.shade);
    }else if(site.kind==='cabinet'){
        // Chamfered cover, ventilation, hinge and grounded cable conduit.
        polygon(c,[[2,-3],[2,-26],[5,-29],[22,-29],[25,-26],[25,-3]],P.ink);
        polygon(c,[[4,-4],[4,-25],[7,-27],[22,-26],[23,-4]],P.shade);
        pixelLine(c,6,-27,20,-27,P.metal);pixelLine(c,22,-24,22,-6,P.metal);
        box(c,6,-24,13,7,P.ink);box(c,7,-23,11,5,'#819b88');
        box(c,8,-22,3,1,P.light);box(c,16,-22,1,3,P.shade);
        for(let j=0;j<3;j++)pixelLine(c,7,-13+j*3,17,-13+j*3,P.ink);
        for(const y of [-23,-8]){box(c,3,y,2,4,P.metal);box(c,4,y+1,1,1,P.light);}
        box(c,19,-15,2,3,P.metal);pixelLine(c,24,-8,26,-8,P.ink,2);
        pixelLine(c,26,-8,26,0,P.ink,2);
    }else if(site.kind==='pipe'){
        box(c,4,-15,27,8,P.ink);box(c,5,-14,25,5,P.shade);pixelLine(c,6,-14,29,-14,P.metal);
        for(const u of [7,26]){
            box(c,u,-17,3,12,P.ink);box(c,u,-16,2,10,P.metal);
            box(c,u-2,-5,7,4,P.shade);box(c,u-1,-5,5,1,P.metal);
        }
        pixelLine(c,31,-12,34,-9,P.ink,5);box(c,32,-8,5,7,P.ink);box(c,33,-8,2,7,P.shade);
        box(c,14,-24,10,8,P.ink);box(c,15,-23,8,6,P.metal);
        const angle=-.8+Math.sin(tick/87+site.x)*.12+rattle*.035;
        pixelLine(c,19,-19,19+Math.sin(angle)*3,-19-Math.cos(angle)*3,P.ink);
        pixelLine(c,18,-16,18,-13,P.ink,2);
        for(const u of [0,32]){
            box(c,u,-22,2,21,P.ink);pixelLine(c,u,-22,u,-4,P.shade);
        }
        pixelLine(c,0,-22,33,-22,P.shade);
        pixelLine(c,0,-5,33,-5,P.shade);
    }else{
        for(const u of [3,26]){box(c,u,-19,3,18,P.ink);pixelLine(c,u,-18,u,-4,P.wood);}
        pixelLine(c,4,-19,28,-19,P.shade,2);pixelLine(c,4,-7,28,-7,P.shade);
        for(const [i,u]of [8,16,23].entries()){
            const swing=rattle*(i%2?.6:.3);
            pixelLine(c,u,-17,u+swing,-5,P.wood);
            if(i===0){box(c,u-3,-18,7,3,P.ink);pixelLine(c,u-2,-18,u+2,-18,P.metal);}
            else if(i===1){
                polygon(c,[[u-2+swing,-8],[u+3+swing,-8],[u+3+swing,-3],[u+swing,-2],[u-2+swing,-3]],P.metal);
                pixelLine(c,u+swing,-7,u+swing,-4,P.shade);
            }else{
                pixelLine(c,u-2,-17,u+2,-17,P.metal);box(c,u-2,-19,1,2,P.metal);box(c,u+2,-19,1,2,P.metal);
            }
        }
    }
}

export function drawChaseRoadside(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    for(const site of CHASE_ROADSIDE){
        const x=site.x-cx;if(x+site.width<-38||x>350)continue;
        const pose=chaseRoadsidePose(b,site);if(!pose.visible)continue;
        const rattle=reduced||pose.age>=0?0:groundImpulse(b,site);
        const wind=chaseWindAt(b.tick,site.x,reduced);
        const base=221-cy,water=CHASE_WATER_Y-cy;
        c.save();c.beginPath();c.rect(x-20,base-40,site.width+60,water-base+40);c.clip();
        if(pose.age<0){
            // Shadow stays on the rear shoulder, beneath the player and effects.
            c.save();c.globalAlpha*=.16;oval(c,x-2,base-1,site.width+5,3,'#264f54');c.restore();
        }
        fixture(c,site,reduced?0:b.tick,wind,rattle,x+pose.slide,base+pose.drop,pose.turn);c.restore();
        if(pose.age>=pose.contact&&pose.contact>=0){
            const t=pose.age-pose.contact;
            if(t<24){
                const center=x+pose.contactX,r=3+t*.6;
                c.save();c.globalAlpha*=1-ease(t/24);
                pixelLine(c,center-r,water,center+r*.4,water,'#80b0a2');
                pixelLine(c,center+r*.6,water+1,center+r,water+1,P.water);
                if(!reduced&&t<16)for(const d of [-1,1]){
                    const h=Math.max(0,t*1.1-t*t*.07);
                    box(c,center+d*t*.5,water-h,1,2,'#aec5ad');
                }
                c.restore();
            }
        }
    }
}
