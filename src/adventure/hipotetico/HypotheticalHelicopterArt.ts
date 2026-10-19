import {box,oval,pixelLine,polygon,type Point} from '../WorldPainting';
import {aircraftPoint,AIRCRAFT_SHAPES,HELICOPTER_GROUND,type AircraftBody,type HypotheticalHelicopter} from './HypotheticalHelicopter';
import {drawScenicRocket} from './HypotheticalTowerEffects';
import {smoothMotion} from './HypotheticalMotion';

const P={ink:'#3b5356',shade:'#52665d',paint:'#7b8e74',light:'#b5b896',metal:'#9faea1',glass:'#466976',glint:'#a0c4b4',stripe:'#d0bd8e',char:'#495953'};
function painter(c:CanvasRenderingContext2D,p:Pick<AircraftBody,'x'|'y'|'angle'>,base:number){
    const at=(x:number,y:number):Point=>{const q=aircraftPoint(p,x,y);return [q[0],base+q[1]];};
    return {at,poly:(points:readonly Point[],color:string)=>polygon(c,points.map(v=>at(...v)),color),
        line:(x:number,y:number,xx:number,yy:number,color:string,size=1)=>pixelLine(c,...at(x,y),...at(xx,yy),color,size)};
}
function smoke(c:CanvasRenderingContext2D,x:number,y:number,r:number,seed:number,color:string,light:string){
    const lean=(seed%3-1)*r*.16;
    polygon(c,[[x-r,y],[x-r,y-r*.24],[x-r*.68,y-r*.24],[x-r*.68,y-r*.6],
        [x-r*.19+lean,y-r*.6],[x-r*.19+lean,y-r*.86],[x+r*.35,y-r*.86],[x+r*.35,y-r*.5],
        [x+r*.75,y-r*.5],[x+r*.75,y-r*.16],[x+r,y-r*.16],[x+r,y+r*.22],[x-r*.55,y+r*.22],[x-r*.55,y]],color);
    box(c,x-r*.44,y-r*.56,r*.35,Math.max(1,r*.14),light);
    box(c,x+r*.18,y-r*.46,r*.3,Math.max(1,r*.12),light);
}
function tail(c:CanvasRenderingContext2D,p:Pick<AircraftBody,'x'|'y'|'angle'>,base:number,rotor:number,damaged:boolean,reduced:boolean){
    const s=painter(c,p,base);
    s.poly(AIRCRAFT_SHAPES.tail,P.ink);
    s.poly([[-17,3],[9,-2],[13,-15],[16,-16],[15,2],[1,6]],damaged?'#65776e':P.paint);
    s.line(-13,2,9,-2,P.light);s.line(10,-4,14,-14,P.light);
    s.line(10,-11,16,-12,P.stripe,2);s.line(-4,1,-2,5,P.shade);
    s.poly([[0,2],[6,1],[7,6],[2,7]],P.light);s.line(2,2,4,4,P.shade);
    const turn=reduced?.7:rotor*1.8,co=Math.cos(turn),si=Math.sin(turn);
    s.line(14-co*5,-7-si*5,14+co*5,-7+si*5,P.ink);
    s.line(14+si*5,-7-co*5,14-si*5,-7+co*5,P.metal);
    s.line(13,-7,15,-7,P.light,2);
    if(damaged)s.line(-17,3,-12,0,'#c5ac82',2);
}
function rotor(c:CanvasRenderingContext2D,p:Pick<AircraftBody,'x'|'y'|'angle'>,base:number,phase:number,broken:boolean,reduced:boolean){
    const s=painter(c,p,base);
    if(broken){
        s.poly(AIRCRAFT_SHAPES.rotor,P.ink);s.line(-33,0,30,0,P.metal);
        s.line(-31,0,-25,0,P.stripe,2);s.line(25,0,31,0,P.stripe,2);
        s.line(-2,-2,2,2,P.shade,3);return;
    }
    // Blades are rigid projected spans. Faint previous positions describe speed
    // without a solid spinning disc or a strobing white cross.
    for(let i=reduced?0:2;i>=0;i--){
        const angle=reduced?.38:phase-i*.56,co=Math.cos(angle),si=Math.sin(angle);
        c.save();c.globalAlpha=i?.13:.92;
        for(const d of [1,-1]){
            s.poly([[d*2*co,d*2*si*.085],[d*35*co,d*35*si*.085-1],
                [d*37*co,d*37*si*.085+1],[d*3*co,d*3*si*.085+1]],i?P.metal:P.ink);
            s.line(d*26*co,d*26*si*.085,d*34*co,d*34*si*.085,P.light);
        }
        c.restore();
    }
    s.line(-3,0,3,0,P.metal,2);s.line(0,-1,0,2,P.ink,2);
}
function fuselage(c:CanvasRenderingContext2D,h:HypotheticalHelicopter,base:number,reduced:boolean){
    const s=painter(c,h.hull,base),damaged=h.impactAt>=0;
    const rim=damaged&&h.impactAge<9&&!reduced?'#dfc69c':P.light;
    if(h.tailAttached){const p=aircraftPoint(h.hull,36,-9);tail(c,{x:p[0],y:p[1],angle:h.hull.angle},base,h.rotor,false,reduced);}
    if(h.skidsAttached){
        for(const d of [-1,1]){
            s.line(-14,7,-16,15+d,P.ink,2);s.line(13,8,16,15+d,P.ink,2);
            s.line(-22,16+d,22,16+d,d>0?P.metal:P.shade,2);s.line(-23,14+d,-22,16+d,P.light);
        }
    }
    s.poly(AIRCRAFT_SHAPES.hull,P.ink);
    s.poly([[-24,0],[-22,-5],[-14,-12],[4,-12],[18,-7],[21,2],[13,9],[-13,8]],damaged?'#6f8179':P.paint);
    s.poly([[-23,3],[-7,4],[9,3],[20,1],[13,9],[-13,8]],P.shade);
    s.line(-13,-12,3,-12,rim);s.line(4,-11,16,-7,rim);
    s.line(-21,2,16,2,damaged?'#b6a483':P.stripe,2);
    // Two window panes, a sloping windshield and a recessed sliding cargo door.
    s.poly([[-23,-3],[-14,-11],[-8,-11],[-9,-3]],P.ink);
    s.poly([[-20,-4],[-14,-9],[-10,-9],[-11,-4]],damaged?'#4e6568':P.glass);
    s.line(-16,-8,-12,-8,damaged?P.metal:P.glint);
    s.line(-11,-11,-12,-3,P.light);
    s.poly([[-6,-11],[5,-10],[7,-3],[-7,-3]],P.ink);
    s.poly([[-4,-9],[4,-8],[5,-4],[-5,-4]],P.glass);s.line(-3,-9,2,-8,P.glint);
    if(h.crashAt<0){
        s.line(-6,-1,-6,6,P.ink);s.line(-6,6,9,6,P.ink);s.line(9,6,9,-8,P.ink);
        s.line(-5,-1,7,-1,P.light);s.line(5,1,7,1,P.ink,2);
    }else{
        s.poly([[-5,-1],[8,-1],[9,6],[-6,7]],'#3d5558');s.line(-5,6,8,6,'#a9a58a');
    }
    // Cowling, intake grille, rivets, antenna and a separate mast have useful silhouettes.
    s.poly([[-7,-13],[-4,-18],[10,-17],[15,-11]],P.ink);
    s.poly([[-4,-14],[-2,-17],[9,-16],[11,-12]],P.shade);s.line(-2,-17,8,-16,P.metal);
    for(let x=2;x<10;x+=3)s.line(x,-14,x+1,-12,P.ink);
    if(h.rotorAttached){
        s.line(1,-17,1,-23,P.ink,3);s.line(1,-21,1,-23,P.light);
        const p=aircraftPoint(h.hull,1,-23);rotor(c,{x:p[0],y:p[1],angle:h.hull.angle},base,h.rotor,false,reduced);
    }else{s.line(1,-17,-1,-20,P.metal,2);s.line(0,-17,4,-18,'#b3a186');}
    s.line(-13,8,-16,12,P.shade);s.line(16,-8,20,-12,P.shade);
    for(const [x,y] of [[-17,5],[-9,5],[12,-5],[14,5]])s.line(x,y,x,y,P.metal);
    if(!damaged){
        const lamp=reduced||h.age%66<8?'#d8be91':'#82978b';s.line(18,-6,19,-6,lamp);
        s.line(-21,5,-19,5,'#d2d3ae',2);
    }else{
        s.poly([[-24,1],[-19,-5],[-16,-3],[-13,3],[-18,6]],P.char);
        s.line(-23,-1,-19,-3,'#b6a386');s.line(-18,-1,-14,3,'#384f53');
        s.line(-19,-5,-14,-8,'#486361');s.line(-14,-8,-9,-7,'#486361');
        s.poly([[7,-17],[11,-14],[14,-9],[8,-10],[5,-13]],P.char);
    }
}
function part(c:CanvasRenderingContext2D,p:AircraftBody,base:number,reduced:boolean){
    if(p.part==='tail'){tail(c,p,base,0,true,reduced);return;}
    if(p.part==='rotor'){rotor(c,p,base,0,true,reduced);return;}
    const s=painter(c,p,base);s.poly(AIRCRAFT_SHAPES[p.part],P.ink);
    if(p.part==='door'){
        s.poly([[-5,-7],[5,-7],[5,7],[-5,7]],'#6f877c');s.poly([[-3,-5],[3,-5],[3,0],[-3,0]],P.glass);
        s.line(-4,3,4,3,P.stripe,2);s.line(2,4,4,4,P.ink);s.line(-4,-7,4,-7,P.light);
    }else if(p.part==='skid'){s.line(-20,0,22,0,P.metal);s.line(-14,0,-14,-3,P.ink);}
    else{s.poly([[-4,-2],[4,-4],[5,1],[-3,3]],'#8c9b88');s.line(-3,-2,3,-3,P.light);}
}

/** A rear service apron separates the wreck from Feka's walkable foreground. */
export function drawHelicopterRear(c:CanvasRenderingContext2D,h:HypotheticalHelicopter,base:number,reduced:boolean){
    const floor=base+HELICOPTER_GROUND;
    polygon(c,[[242,floor],[326,floor],[333,floor+6],[237,floor+6]],'#889a89');
    pixelLine(c,243,floor,325,floor,'#b0b199');pixelLine(c,237,floor+6,333,floor+6,'#6c847a');
    for(const x of [263,286,310])pixelLine(c,x,floor+1,x-1,floor+5,'#7b9181');
    if(h.age<0)return;
    if(h.crashAt>=0){
        oval(c,h.hull.x-29,floor-2,62,5,'#5f746c');oval(c,h.hull.x-20,floor-2,43,3,'#4e6560');
        for(let j=0;j<6;j++)box(c,h.hull.x-27+j*10,floor+j%2,5,1,'#687d70');
    }else{
        c.save();c.globalAlpha=.3;oval(c,h.hull.x-20,floor,45,3,'#627970');c.restore();
    }
    if(h.impactAt<0){
        if(h.age>40&&h.age<160&&!reduced){
            const lamp=aircraftPoint(h.hull,-20,6);
            c.save();c.globalAlpha=.11;
            polygon(c,[[lamp[0],base+lamp[1]],[h.hull.x-46,floor],[h.hull.x-6,floor]],'#e1d3ad');c.restore();
            for(let j=0;j<6;j++){
                const a=(h.age+j*11)%52,fade=Math.sin(Math.PI*a/52),direction=j%2?1:-1;
                c.save();c.globalAlpha=fade*.42;
                smoke(c,h.hull.x+direction*(12+a*.32),floor-1-a*.035,2+a*.035,j,'#b3b49a','#c5bea0');c.restore();
            }
        }
        // The rotor arrives in sound first, then startles three tiny roof birds.
        for(let j=0;j<3;j++){
            const a=h.age-38-j*9;if(a<0||a>86)continue;
            const x=292-a*(.7+j*.12),y=base-49-Math.sin(Math.min(1,a/90)*Math.PI/2)*25-j*3;
            const wing=reduced?2:Math.sin(a*.38+j)*3;
            pixelLine(c,x-3,y-wing,x,y,'#6d8a81');pixelLine(c,x,y,x+3,y-wing,'#6d8a81');
        }
    }
    for(const p of h.plumes){
        if(reduced&&p.seed%3)continue;
        const a=h.tick-p.born,fade=smoothMotion((a+2)/8)*(1-smoothMotion((a-42)/90));
        const x=p.x+p.vx*a+Math.sin(p.seed+a*.035)*Math.min(2,a*.04),y=base+p.y+p.vy*a-a*a*.00035;
        c.save();c.globalAlpha=fade*(p.kind==='dust'?.6:.77);
        smoke(c,x,y,p.radius+Math.sqrt(a)*.6,p.seed,p.kind==='dust'?'#a4a58d':'#697e76',p.kind==='dust'?'#c1b699':'#95a18b');c.restore();
    }
    for(const p of h.pieces)if(p.part==='tail'||p.part==='rotor')part(c,p,base,reduced);
    fuselage(c,h,base,reduced);
    for(const p of h.pieces)if(p.part!=='tail'&&p.part!=='rotor')part(c,p,base,reduced);
    for(const [i,p] of h.chips.entries()){
        if(reduced&&i%2)continue;
        const co=Math.cos(p.angle),si=Math.sin(p.angle),color=p.glass?'#a2b6a7':'#97a18c';
        pixelLine(c,p.x-co*p.size,base+p.y-si*p.size,p.x+co*p.size,base+p.y+si*p.size,color);
        if(!p.rest&&p.vy>1.2&&!reduced)box(c,p.x-p.vx,base+p.y-p.vy,1,1,'#b3b498');
    }
    for(const hit of h.contacts){
        const a=h.tick-hit.born,fade=1-smoothMotion((a-8)/58);
        if(hit.strength<.4)continue;
        for(const d of [-1,1]){
            c.save();c.globalAlpha=fade*.55;
            smoke(c,hit.x+d*(4+a*.2),base+hit.y-1,2+a*.07,0,'#a6a98f','#c1b69a');c.restore();
        }
    }
    if(h.impactAt>=0){
        const a=h.impactAge,fade=1-smoothMotion((a-132)/152);
        if(fade>0){
            const p=aircraftPoint(h.hull,9,-12);
            for(let j=0;j<(reduced?2:4);j++){
                const phase=reduced?1:((Math.floor(a/4)+j*3)%7)/7,
                    x=p[0]+(j-1.5)*3,y=base+p[1],height=(5+phase*7)*fade;
                polygon(c,[[x-3,y],[x-1,y-height*.6],[x+phase*3,y-height],[x+2,y-height*.5],[x+4,y]],'#b98c64');
                if(!reduced)polygon(c,[[x-1,y],[x+1,y-height*.65],[x+3,y]],'#e3b67e');
            }
        }
    }
}

/** Muzzle, missile, shock and falling metal stay beneath the combat/HUD layers. */
export function drawHelicopterEffects(c:CanvasRenderingContext2D,h:HypotheticalHelicopter,base:number,reduced:boolean){
    drawScenicRocket(c,h,base,reduced);
    const impact=h.impact;if(!impact)return;
    const age=h.impactAge,x=impact.x,y=base+impact.y;
    if(age<34){
        const fade=1-smoothMotion((age-10)/24),r=(4+17*smoothMotion(age/9))*fade;
        const points:Point[]=Array.from({length:16},(_,i)=>{
            const a=i*Math.PI/8,length=r*(i%2?.7:1);return [x+Math.cos(a)*length,y+Math.sin(a)*length*.8];
        });
        polygon(c,points,reduced?'#b6a58b':age<7?'#dfb684':age<16?'#ba936e':'#9f9982');
        if(!reduced&&age<15)smoke(c,x+3,y,r*.6,0,age<5?'#f0dbab':'#e5be86','#f4dfae');
    }
    if(age>=3&&age<21&&!reduced){
        const r=7+age*1.4;
        c.save();c.globalAlpha=(1-age/21)*.62;
        for(let i=0;i<7;i++){
            const a=i*.85+.35;pixelLine(c,x+Math.cos(a)*r,y+Math.sin(a)*r*.7,x+Math.cos(a+.25)*r,y+Math.sin(a+.25)*r*.7,'#d1ba94');
        }
        c.restore();
    }
    const crash=h.crashAge;
    if(crash>=0&&crash<18&&!reduced){
        const r=8+crash*1.8,fade=1-smoothMotion(crash/18);
        c.save();c.globalAlpha=fade*.6;
        for(const d of [-1,1])pixelLine(c,h.hull.x+d*12,base+HELICOPTER_GROUND,h.hull.x+d*r,base+HELICOPTER_GROUND,'#d4b994',2);
        c.restore();
    }
}
