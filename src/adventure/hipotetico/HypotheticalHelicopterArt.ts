import {box,oval,pixelLine,polygon,type Point} from '../WorldPainting';
import {aircraftPoint,AIRCRAFT_SHAPES,HELICOPTER_GROUND,HELICOPTER_BREAKUP,HELICOPTER_RAIL,type AircraftBody,type AircraftPuff,type HypotheticalHelicopter} from './HypotheticalHelicopter';
import {aircraftOutline} from './HypotheticalAircraftPhysics';
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
    if(damaged){
        s.poly([[-18,2],[-14,1],[-16,4],[-12,4],[-16,6]],'#485f5a');
        s.line(-17,2,-14,1,'#c5ac82');s.line(-16,4,-13,4,'#bdad8a');
        s.line(-12,2,-9,3,'#435d58');
    }
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
    const engine=h.impactAge>=HELICOPTER_BREAKUP.engine,crushed=h.crashAt>=0;
    const rim=damaged&&h.impactAge<7&&!reduced?'#e0c79b':P.light;
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
    s.line(-11,7,9,8,'#63796c');s.line(10,8,16,5,'#3e5956');
    s.line(-13,-12,3,-12,rim);s.line(4,-11,16,-7,rim);
    s.line(-21,2,16,2,damaged?'#b6a483':P.stripe,2);
    s.line(13,-5,13,0,'#526b61');s.line(15,-5,15,-2,'#9da88a');
    s.line(-18,4,-15,4,'#8c9c80');s.line(12,4,15,4,'#8c9c80');
    // Two window panes, a sloping windshield and a recessed sliding cargo door.
    s.poly([[-23,-3],[-14,-11],[-8,-11],[-9,-3]],P.ink);
    s.poly([[-20,-4],[-14,-9],[-10,-9],[-11,-4]],damaged?'#4e6568':P.glass);
    const reflection=Math.sin(h.hull.angle)*4;
    s.line(-17+reflection,-7,-14+reflection,-9,damaged?P.metal:P.glint);
    s.line(-18,-4,-13,-4,'#678a88');
    s.line(-11,-11,-12,-3,P.light);
    s.poly([[-6,-11],[5,-10],[7,-3],[-7,-3]],P.ink);
    s.poly([[-4,-9],[4,-8],[5,-4],[-5,-4]],P.glass);s.line(-3+reflection,-8,1+reflection,-7,P.glint);
    s.line(1,-8,1,-4,'#688981');
    if(h.crashAt<0){
        s.line(-6,-1,-6,6,P.ink);s.line(-6,6,9,6,P.ink);s.line(9,6,9,-8,P.ink);
        s.line(-5,-1,7,-1,P.light);s.line(5,1,7,1,P.ink,2);
    }else{
        s.poly([[-5,-1],[8,-1],[9,6],[-6,7]],'#3d5558');s.line(-5,6,8,6,'#a9a58a');
        s.line(-3,1,4,1,'#2f494f');s.line(6,0,7,4,'#788579');
    }
    // Cowling, intake grille, rivets, antenna and a separate mast have useful silhouettes.
    s.poly([[-7,-13],[-4,-18],[10,-17],[15,-11]],P.ink);
    s.poly([[-4,-14],[-2,-17],[9,-16],[11,-12]],P.shade);s.line(-2,-17,8,-16,P.metal);
    for(let x=2;x<10;x+=3)s.line(x,-14,x+1,-12,P.ink);
    s.line(-5,-14,-1,-14,'#b1b399');s.line(12,-11,15,-7,P.ink);
    if(h.rotorAttached){
        s.line(1,-17,1,-23,P.ink,3);s.line(1,-21,1,-23,P.light);
        const p=aircraftPoint(h.hull,1,-23);rotor(c,{x:p[0],y:p[1],angle:h.hull.angle},base,h.rotor,false,reduced);
    }else{s.line(1,-17,-1,-20,P.metal,2);s.line(0,-17,4,-18,'#b3a186');}
    s.line(-13,8,-16,12,P.shade);s.line(16,-8,20,-12,P.shade);
    for(const [x,y] of [[-17,5],[-9,5],[12,-5],[14,5]])s.line(x,y,x,y,P.metal);
    if(!damaged){
        const lamp=reduced||h.age%66<8?'#d8be91':'#82978b';s.line(18,-6,19,-6,lamp);
        s.line(-21,5,-19,5,'#d2d3ae',2);
    }
    if(h.impact){
        // The breach stays on the struck panel as the aircraft rolls and falls.
        const {localX:x,localY:y}=h.impact;
        s.poly([[x-2,y-1],[x+3,y-5],[x+7,y-3],[x+8,y+1],[x+3,y+4],[x,y+2]],P.char);
        s.poly([[x,y],[x+3,y-3],[x+5,y-1],[x+4,y+2]],'#314b51');
        s.line(x+1,y-2,x+4,y-4,h.impactAge<10&&!reduced?'#e4bd83':'#b5a284');
        s.line(x+5,y+1,x+8,y+3,'#93a18e');
        s.line(x+7,y-3,x+11,y-5,'#486361');s.line(x+11,y-5,x+13,y-4,'#486361');
    }
    if(engine){
        s.poly([[7,-17],[11,-14],[14,-9],[8,-10],[5,-13]],P.char);
        s.poly([[6,-15],[9,-17],[12,-13],[10,-11]],'#324d52');s.line(6,-15,9,-17,'#b2a585');
        if(h.impactAge<HELICOPTER_BREAKUP.engine+10&&!reduced){
            s.line(2,-17,5,-16,'#d3b185');s.line(13,-12,15,-9,'#d3b185');s.line(4,-8,5,-5,'#d2bd94');
        }
    }
    if(crushed){
        s.line(-21,4,-14,6,'#344f50');s.line(-14,6,-8,4,'#344f50');
        s.line(-19,5,-14,7,'#a5a78a');s.line(9,7,12,5,'#a5a78a');
        s.line(-17,-8,-14,-6,'#a3b8a6');s.line(-14,-6,-12,-8,'#789488');
        s.line(-14,-6,-16,-4,'#334f55');s.line(-11,3,-8,5,'#b0aa8b');
        s.line(12,4,15,3,'#b0aa8b');
    }
}
function part(c:CanvasRenderingContext2D,p:AircraftBody,base:number,reduced:boolean){
    if(p.part==='tail'){tail(c,p,base,p.accessory?.phase??0,true,reduced);return;}
    if(p.part==='rotor'){rotor(c,p,base,0,true,reduced);return;}
    const s=painter(c,p,base);s.poly(AIRCRAFT_SHAPES[p.part],P.ink);
    if(p.part==='door'){
        s.poly([[-5,-7],[5,-7],[5,7],[-5,7]],'#6f877c');s.poly([[-3,-5],[3,-5],[3,0],[-3,0]],P.glass);
        s.line(-4,3,4,3,P.stripe,2);s.line(2,4,4,4,P.ink);s.line(-4,-7,4,-7,P.light);
        if(p.contacts){s.line(-2,-4,1,-1,P.metal);s.line(1,-1,2,-4,P.shade);s.line(-4,6,1,5,P.metal);}
    }else if(p.part==='skid'){s.line(-20,0,22,0,P.metal);s.line(-14,0,-14,-3,P.ink);}
    else if(p.part==='rail'){
        s.line(-18,0,18,0,'#9fa98e');
        for(const x of [-16,-6,4,14])s.line(x,-1,x+3,1,'#c1b387');
        s.line(-19,-1,-16,-1,'#d0c29c');s.line(17,0,20,1,'#4d685f');
    }
    else{s.poly([[-4,-2],[4,-4],[5,1],[-3,3]],'#8c9b88');s.line(-3,-2,3,-3,P.light);}
}

function landingStage(c:CanvasRenderingContext2D,h:HypotheticalHelicopter,base:number){
    const floor=base+HELICOPTER_GROUND,rail=HELICOPTER_RAIL;
    polygon(c,[[242,floor],[326,floor],[333,floor+6],[237,floor+6]],'#889a89');
    pixelLine(c,243,floor,325,floor,'#b0b199');pixelLine(c,237,floor+6,333,floor+6,'#6c847a');
    for(const x of [263,286,310])pixelLine(c,x,floor+1,x-1,floor+5,'#7b9181');
    // A recessed drain, repaired paving and bolted rail give the contact plane
    // recognizable scale before the aircraft reaches it.
    box(c,246,floor,12,3,'#5b7970');pixelLine(c,246,floor,257,floor,'#b5b69a');
    for(let x=248;x<257;x+=3)pixelLine(c,x,floor+1,x-1,floor+2,'#354f53');
    pixelLine(c,264,floor+3,276,floor+3,'#9ba58c');
    const bend=h.railBrokenAt<0?0:smoothMotion((h.tick-h.railBrokenAt)/12);
    for(const [x,d] of [[rail.left+2,-1],[rail.right-2,1]]){
        box(c,x-2,floor,5,2,'#5f786a');box(c,x-1,floor,1,1,'#bbb396');
        pixelLine(c,x,floor,x+d*bend*4,base+rail.y+bend*5,'#455f59',2);
        pixelLine(c,x+1,floor-1,x+1+d*bend*4,base+rail.y+1+bend*5,'#a2ab8b');
    }
    if(h.railBrokenAt<0){
        box(c,rail.left,base+rail.y-1,rail.right-rail.left+1,3,'#4d685f');
        pixelLine(c,rail.left,base+rail.y-1,rail.right,base+rail.y-1,'#adb394');
        for(let x=rail.left+3;x<rail.right;x+=10)pixelLine(c,x,base+rail.y,x+3,base+rail.y+1,'#c1b387');
    }
}

function surfaceScars(c:CanvasRenderingContext2D,h:HypotheticalHelicopter,base:number){
    const floor=base+HELICOPTER_GROUND;
    for(const mark of h.scars){
        pixelLine(c,mark.x,base+mark.y,mark.end,base+mark.y+1,'#526c62');
        if(mark.strength>1.2){
            pixelLine(c,mark.x-3,floor+1,mark.x+1,floor+2,'#5a7266');
            pixelLine(c,mark.x+1,floor+2,mark.x+4,floor+4,'#5a7266');
            box(c,mark.x+2,floor+1,2,1,'#b3af93');
        }
    }
}

function pieceShadow(c:CanvasRenderingContext2D,p:AircraftBody,base:number){
    const points=aircraftOutline(p),low=Math.max(...points.map(v=>v[1]));
    const left=Math.min(...points.map(v=>v[0])),right=Math.max(...points.map(v=>v[0]));
    const height=Math.max(0,HELICOPTER_GROUND-low),width=Math.max(3,(right-left)*.75);
    c.save();c.globalAlpha=Math.max(.025,.27*(1-height/85));
    oval(c,(left+right-width)/2,base+HELICOPTER_GROUND,width,2,'#48655b');c.restore();
}

function plume(c:CanvasRenderingContext2D,h:HypotheticalHelicopter,p:AircraftPuff,base:number,reduced:boolean){
    if(reduced&&p.seed%3)return;
    const a=h.tick-p.born,fade=smoothMotion((a+2)/8)*(1-smoothMotion((a-42)/90)),dust=p.kind==='dust';
    const x=p.x+p.vx*a+Math.sin(p.seed+a*.035)*Math.min(2,a*.04),y=base+p.y+p.vy*a-a*a*.00035;
    const r=p.radius+Math.sqrt(a)*(dust?.62:.58);
    c.save();c.globalAlpha=fade*(dust?.55:.8);
    smoke(c,x,y,r,p.seed,dust?'#a5a78f':a<20?'#5d706a':'#74867b',dust?'#c5b99c':a<20?'#8d927d':'#a0aa90');
    if(!dust&&a<23&&!reduced){
        c.globalAlpha=fade*(1-a/23)*.38;
        smoke(c,x-1,y+1,r*.6,p.seed+1,'#a18668','#b9a27a');
    }
    c.restore();
}

/** A rear service apron separates the wreck from Feka's walkable foreground. */
export function drawHelicopterRear(c:CanvasRenderingContext2D,h:HypotheticalHelicopter,base:number,reduced:boolean){
    const floor=base+HELICOPTER_GROUND;
    landingStage(c,h,base);
    if(h.age<0)return;
    if(h.groundContact){
        const spread=smoothMotion((h.crashAge+3)/35),contact=h.groundContact.x;
        oval(c,contact-5-spread*15,floor-1,10+spread*37,3,'#687d70');
        pixelLine(c,contact,floor,h.hull.x+12,floor,'#4e6560',2);
        for(let j=0;j<5;j++)box(c,contact-8+j*7*spread,floor+j%2,2+spread*2,1,'#889583');
    }else{
        c.save();c.globalAlpha=.3;oval(c,h.hull.x-20,floor,45,3,'#627970');c.restore();
    }
    surfaceScars(c,h,base);
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
    for(const p of h.plumes)if(p.kind==='smoke')plume(c,h,p,base,reduced);
    for(const p of h.pieces)pieceShadow(c,p,base);
    for(const p of h.pieces)if(p.part==='tail'||p.part==='rotor')part(c,p,base,reduced);
    fuselage(c,h,base,reduced);
    for(const p of h.pieces)if(p.part!=='tail'&&p.part!=='rotor')part(c,p,base,reduced);
    for(const p of h.plumes)if(p.kind==='dust')plume(c,h,p,base,reduced);
    for(const [i,p] of h.chips.entries()){
        if(reduced&&i%2)continue;
        const co=Math.cos(p.angle),si=Math.sin(p.angle),hot=!reduced&&h.tick-p.born<p.hot;
        const color=hot?'#e2bd84':p.glass?'#a2b6a7':'#97a18c';
        pixelLine(c,p.x-co*p.size,base+p.y-si*p.size,p.x+co*p.size,base+p.y+si*p.size,color);
        if(hot)pixelLine(c,p.x-p.vx*2,base+p.y-p.vy*2,p.x,base+p.y,'#bb9267');
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
    if(!reduced)for(const p of h.sparks){
        const a=h.tick-p.born,fade=1-smoothMotion(a/p.life);
        c.save();c.globalAlpha=fade;
        pixelLine(c,p.x-p.vx*2,base+p.y-p.vy*2,p.x,base+p.y,a<5?'#dfc395':'#b49b78');
        if(a<4)box(c,p.x,base+p.y,1,1,'#f0d9a7');c.restore();
    }
    if(h.impactAge>=HELICOPTER_BREAKUP.engine){
        const a=h.impactAge-HELICOPTER_BREAKUP.engine,fade=smoothMotion((a+2)/10)*(1-smoothMotion((a-132)/152));
        if(fade>0){
            const p=aircraftPoint(h.hull,9,-12);
            for(let j=0;j<(reduced?2:4);j++){
                const phase=reduced?.55:.5+Math.sin(a*.23+j*2.1)*.32+Math.sin(a*.11+j)*.16,
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
    const at=(normal:number,tangent:number):Point=>[x+impact.nx*normal-impact.ny*tangent,y+impact.ny*normal+impact.nx*tangent];
    if(age<5){
        const spread=1+age*.65;
        polygon(c,[at(-4,0),at(2,-3),at(8*spread,-4),at(5,0),at(10*spread,3),at(2,3)],reduced?'#b8aa8c':'#ead4a0');
    }
    // Expanding overlapping lobes cool and drift; they never shrink back into
    // the impact point. The dark breach remains attached to the fuselage.
    for(let j=0;j<(reduced?3:5);j++){
        const a=age-j*2;if(a<0||a>42)continue;
        const p=at(2+Math.sqrt(a)*1.1+(j%2)*2,(j-2)*(2+a*.12));
        const r=3+Math.sqrt(a)*1.65,fade=(1-smoothMotion((a-8)/34))*(j===0?1:.82);
        c.save();c.globalAlpha=fade;
        smoke(c,p[0]+a*.06,p[1]-a*.13,r,j,
            reduced?'#a99b82':a<5?'#d4a16c':a<13?'#ad8865':'#7e8272',a<8?'#e2bf87':'#a79f83');
        if(!reduced&&a<9){c.globalAlpha=fade*(1-a/9);smoke(c,p[0],p[1],r*.55,j,'#f0d6a0','#f3dfae');}
        c.restore();
    }
    if(age>=3&&age<21&&!reduced){
        const r=7+age*1.4;
        c.save();c.globalAlpha=(1-age/21)*.62;
        for(let i=0;i<7;i++){
            const a=i*.85+.35;pixelLine(c,x+Math.cos(a)*r,y+Math.sin(a)*r*.7,x+Math.cos(a+.25)*r,y+Math.sin(a+.25)*r*.7,'#d1ba94');
        }
        c.restore();
    }
    const rupture=age-HELICOPTER_BREAKUP.engine;
    if(rupture>=0&&rupture<22){
        const p=aircraftPoint(h.hull,9,-14),rise=smoothMotion((rupture+1)/4),fade=1-smoothMotion((rupture-5)/17);
        c.save();c.globalAlpha=fade*(reduced?.45:.85);
        for(let j=0;j<3;j++){
            const r=(2.5+Math.sqrt(rupture)*1.2)*rise;
            smoke(c,p[0]+(j-1)*(2+rupture*.14),base+p[1]-rupture*.22-j%2*2,r,j+3,
                rupture<7?'#ca986b':'#898474',rupture<5?'#eed19c':'#b8a685');
        }
        c.restore();
    }
    const crash=h.crashAge;
    if(crash>=0&&crash<18&&h.groundContact&&!reduced){
        const r=8+crash*1.8,fade=1-smoothMotion(crash/18);
        c.save();c.globalAlpha=fade*.6;
        for(const d of [-1,1])pixelLine(c,h.groundContact.x+d*3,base+HELICOPTER_GROUND,h.groundContact.x+d*r,base+HELICOPTER_GROUND,'#d4b994',2);
        c.restore();
    }
}
