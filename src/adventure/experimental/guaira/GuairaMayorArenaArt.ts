import { MAYOR_PALETTE as M, type GuairaMayorArtState, type MayorRect } from './GuairaMayorArt';
import { drawGuairaLandscape } from './GuairaScenery';
import { drawGuairaClayGrain, drawGuairaTimber } from './GuairaMaterials';
import { drawMayorTown, drawMayorCivicRoom, drawMayorReserve } from './GuairaMayorTownArt';
import { drawGuairaPipe, drawGuairaPipeElbow, drawGuairaPipeFlow, drawGuairaPipeSaddle, guairaPipeRoute } from './GuairaPipeArt';
import { drawGuairaDrainSurface, drawGuairaSpoutFlow } from './GuairaWaterworksArt';
import { drawGuairaControlBase } from './GuairaControlArt';

/** Architecture surrounds the five actual native mechanisms. */
export const MAYOR_ART_OBJECTS = Object.freeze({valve:'guaira-mayor-register',lift:'guaira-mayor-lift',deck:'guaira-mayor-deck',upperValve:'guaira-mayor-upper-register',refuge:'guaira-mayor-refuge'});
interface Body extends MayorRect { readonly kind:string; readonly active:boolean; readonly changedAt?:number; readonly home?:{readonly x:number;readonly y:number};readonly to?:{readonly x:number;readonly y:number} }
interface Bodies { readonly time?:number; get(id:string):Body|undefined }
type MechanismCue='waiting'|'register'|'rising'|'ready'|'released';
/** A moving lift alone is not a fresh opening: the encounter owns that decision. */
function mechanismCue(m:GuairaMayorArtState):MechanismCue {
    if(m.publicWaterOpen)return 'released';
    if(m.state==='recover'&&m.vulnerable)return 'ready';
    if((m.state==='stamp'||m.state==='returning'||m.state==='recover')&&m.accessRequested)return 'rising';
    return m.canOpenRegister||m.state==='recover'?'register':'waiting';
}
interface GroundLevel {readonly data:{readonly width:number;readonly height:number;readonly tiles:readonly (readonly number[])[]};colToWorldX(c:number):number;rowToWorldY(r:number):number;worldToCol(x:number):number;worldToRow(y:number):number}
const P={ink:'#493c43',earth:'#b87955',earthShade:'#925c49',dust:'#e8b17c',wood:'#997454',woodLight:'#d1ac77',woodShade:'#695449',iron:'#697a78',ironDark:'#4e5c5c',deck:'#f2d69b'};
function rect(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string){if(w<=0||h<=0)return;c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function line(c:CanvasRenderingContext2D,x0:number,y0:number,x1:number,y1:number,color:string,width=1){const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1);for(let i=0;i<=n;i++)rect(c,x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,width,width,color);}
function layer(c:CanvasRenderingContext2D,cx:number,cy:number,fn:(x:number,y:number)=>void){c.save();c.beginPath();c.rect(0,0,320,180);c.clip();fn(Number.isFinite(cx)?Math.round(cx):0,Number.isFinite(cy)?Math.round(cy):0);c.restore();}
function oval(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string){for(let yy=0;yy<h;yy++){const half=Math.sqrt(Math.max(0,1-((yy+.5-h/2)/(h/2))**2))*w/2;rect(c,x+Math.ceil(w/2-half),y+yy,Math.floor(2*half),1,color);}}
const FONT:Readonly<Record<string,string>>={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',I:'111010010010111',L:'100100100100111',O:'010101101101010',P:'110101110100100',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',Z:'111001010100111'};
function word(c:CanvasRenderingContext2D,text:string,x:number,y:number,color:string){[...text].forEach((letter,i)=>{const bits=FONT[letter]??'000000000000000';for(let n=0;n<15;n++)if(bits[n]==='1')rect(c,x+i*4+n%3,y+Math.floor(n/3),1,1,color);});}
const PIPE=Object.freeze({edge:'#735b4b',brass:'#b99465',light:'#d4b680',shade:'#997650',
    water:'#80afa7',glint:'#bad0b5',dry:'#b18b62'});
const RESERVE_FEED=guairaPipeRoute([[306,166],[306,194],[267,194]]);
const PUBLIC_FEED=guairaPipeRoute([[306,166],[306,194],[36,194],[36,208]]);
function waitInlay(c:CanvasRenderingContext2D,x:number,y:number){
    // An amber hourglass replaces the forward arrow while the seam is unsafe.
    rect(c,x,y,7,1,M.warning);rect(c,x,y+4,7,1,M.warning);
    rect(c,x+1,y+1,2,1,M.warning);rect(c,x+4,y+1,2,1,M.warning);
    rect(c,x+3,y+2,1,1,M.warning);rect(c,x+2,y+3,3,1,M.warning);
}
function supports(c:CanvasRenderingContext2D,objects:Bodies,cx:number,cy:number){
    const refuge=objects.get(MAYOR_ART_OBJECTS.refuge),upper=objects.get(MAYOR_ART_OBJECTS.deck);
    for(const [body,inset] of [[refuge,3],[upper,6]] as const)if(body){
        for(const xx of [body.x+inset,body.x+body.width-inset-4]){
            const y=body.y+body.height;
            rect(c,xx-cx,y-cy,4,224-y,'#8a785c');rect(c,xx+1-cx,y+1-cy,2,222-y,'#b7a077');
            line(c,xx-cx,y+17-cy,xx+10-cx,y-cy,'#967957',2);
            rect(c,xx-1-cx,y+1-cy,6,3,P.ironDark);rect(c,xx+1-cx,y+2-cy,2,1,M.bronzeLight);
            rect(c,xx-2-cx,221-cy,8,3,'#80735b');rect(c,xx-1-cx,221-cy,6,1,'#b5a07b');
        }
    }
}

/** Architecture sits behind the real running surfaces; bright tops are reserved for collision. */
export function drawGuairaMayorBackground(c:CanvasRenderingContext2D,m:GuairaMayorArtState,cx=0,cy=64,time=0,reducedMotion=false,objects?:Bodies){
    layer(c,cx,cy,(cx,cy)=>{
        const r=(x:number,y:number,w:number,h:number,color:string)=>rect(c,x-cx,y-cy,w,h,color);
        const t=reducedMotion||!Number.isFinite(time)?0:Math.max(0,time);
        drawGuairaLandscape(c,cx,cy,t,reducedMotion,'town');
        drawMayorTown(c,cx,cy,t,reducedMotion);
        drawMayorCivicRoom(c,cx,cy,t,reducedMotion);
        word(c,'VAZAO',259-cx,110-cy,'#67594d');
        // The real deck's supports stand behind the reservoir and continuous
        // feed. Drawing them later would cut holes through those connections.
        if(objects)supports(c,objects,cx,cy);
        drawMayorReserve(c,cx,cy,t,reducedMotion,m.publicWaterOpen);
        r(273,211,31,8,'#aa9272');word(c,'RESERVA',275-cx,212-cy,'#6b6250');
        // The private feed stays pressurised. Only the encounter's final release
        // wets the public pipe, through one continuous turn into the trough.
        drawGuairaPipe(c,302-cx,162-cy,28,true,t,reducedMotion,true,1,false,PIPE);
        drawGuairaPipeElbow(c,302-cx,190-cy,true,true,true,PIPE);
        drawGuairaPipe(c,267-cx,190-cy,35,true,t,reducedMotion,false,-1,false,PIPE);
        drawGuairaPipe(c,41-cx,190-cy,226,m.publicWaterOpen,t,reducedMotion,false,-1,false,PIPE);
        drawGuairaPipeElbow(c,32-cx,190-cy,m.publicWaterOpen,false,false,PIPE);
        drawGuairaPipe(c,32-cx,199-cy,10,m.publicWaterOpen,t,reducedMotion,true,1,false,PIPE);
        drawGuairaPipeFlow(c,m.publicWaterOpen?PUBLIC_FEED:RESERVE_FEED,cx,cy,t,reducedMotion,PIPE.glint);
        for(const xx of [87,189])drawGuairaPipeSaddle(c,xx-cx,194-cy,false,PIPE);
        drawGuairaPipeSaddle(c,306-cx,178-cy,true,PIPE);
        // Three real-looking outlets belong to the same reserve line. Their
        // mouths match the high/right and low/left+right packet spawn points.
        // No bright platform tops: these are scenery behind the playable floor.
        for(const [mx,my,dir] of [[312,152,-1],[8,216,1],[312,216,-1]] as const){
            const px=dir===1?0:312;
            drawGuairaPipe(c,px-cx,Math.min(my,194)-cy,Math.abs(my-194),false,t,reducedMotion,true,1,false,PIPE);
            r(px,my-7,8,14,M.bronzeShade);r(px+1,my-6,6,12,M.bronze);
            r(px+2,my-5,2,10,M.bronzeLight);
            const salvo=m.attacksCancelled?null:m.salvo??m.crossfire;
            const preparing=salvo?.phase==='warning'&&salvo.direction===dir&&salvo.rect.y+8===my;
            const emitted=m.attacksCancelled?undefined:m.jets?.find(j=>j.direction===dir&&j.y+8===my&&j.age<12);
            const lip=mx+(dir===1?-2:-1),active=preparing||!!emitted;
            r(lip-1,my-9,3,18,P.ironDark);r(lip,my-8,1,16,preparing?M.warning:emitted?M.waterLight:M.bronzeLight);
            r(mx+(dir===1?-2:0),my-5,2,10,emitted?M.waterShade:P.woodShade);
            for(const yy of [-7,6])r(px+5,my+yy,2,1,P.ironDark);
            if(active){
                // A crossfire keeps the shutter open while its real packet
                // leaves the mouth, then closes over eight simulation ticks.
                const opening=emitted?Math.ceil(4*Math.min(1,(12-emitted.age)/8)):Math.floor(salvo!.progress*4);
                r(px+2,my-4,3,8,M.ink);r(px+2,my-4,3,opening*2,emitted?M.waterLight:M.warning);
            }
        }
        // Short rear connections meet the existing feed; neither adds a false
        // walkable ledge or lights the public trough before the third seal.
        drawGuairaPipe(c,4-cx,190-cy,32,false,t,reducedMotion,false,-1,false,PIPE);
        drawGuairaPipe(c,305-cx,210-cy,10,false,t,reducedMotion,false,1,false,PIPE);
        // The public branch is closed by three stamped seals until the final release.
        r(238,185,28,18,'#745f50');r(240,187,24,14,'#a77b53');
        for(const xx of [238,264]) {r(xx,184,2,20,'#897456');r(xx,185,1,2,'#c6aa7d');r(xx,200,1,2,'#c6aa7d');}
        const locks=Math.max(0,Math.min(3,Math.round(m.sealsRemaining)));
        for(let i=0;i<3;i++){
            const x=242+i*7;
            if(i<locks){r(x,188,5,11,M.sash);r(x+1,189,3,3,M.woodLight);r(x+1,196,3,2,M.wood);}
            else{r(x,189,5,1,'#d7b588');r(x,196,5,1,'#d7b588');}
        }
        if(m.publicWaterOpen){r(240,189,24,10,'#497f7d');r(242,192,20,5,PIPE.water);r(242,192,18,1,PIPE.glint);}
        word(c,'BAIRRO',46-cx,199-cy,'#6c5e4d');
        // The basin sits on two short stone feet on the actual plaza floor.
        // A dark lip and recessed water keep it distinct from a platform cap.
        for(const xx of [19,86]){
            r(xx,219,8,5,'#89745b');r(xx+1,219,5,4,'#b49b75');r(xx-1,223,10,1,'#8f775a');
        }
        r(10,211,92,9,'#9e7859');r(12,212,88,6,'#785e50');r(15,213,82,4,'#b58b62');
        r(12,218,88,2,'#947051');r(16,219,80,1,'#b18a64');
        if(m.publicWaterOpen){
            r(16,213,81,4,'#497f7d');r(18,213,77,2,PIPE.water);
            drawGuairaSpoutFlow(c,35-cx,204-cy,214-cy,t,reducedMotion);
            drawGuairaDrainSurface(c,18-cx,95-cx,213-cy,36-cx,t,reducedMotion);
        }else{
            line(c,26-cx,213-cy,30-cx,216-cy,'#795e4e');line(c,57-cx,213-cy,62-cx,216-cy,'#795e4e');
        }
        // A permanent cast lip receives the pipe. The seal covers its opening
        // until the real final release, while the stream starts inside the mouth.
        for(const xx of [30,38]){
            r(xx,199,5,3,PIPE.edge);r(xx+1,199,4,1,PIPE.light);r(xx+1,200,4,1,PIPE.brass);
        }
        r(32,202,3,3,PIPE.shade);r(38,202,3,3,PIPE.shade);r(33,202,1,2,PIPE.light);
        if(!m.publicWaterOpen){r(35,202,3,3,M.sash);r(34,202,5,1,M.woodLight);}
    });
}

/** Ground only where the isolated level actually contains TileType.GROUND (1). */
export function drawGuairaMayorTerrain(c:CanvasRenderingContext2D,level:GroundLevel,cx=0,cy=64){
    layer(c,cx,cy,(cx,cy)=>{
        const sc=Math.max(0,level.worldToCol(cx)),ec=Math.min(level.data.width-1,level.worldToCol(cx+319));
        const sr=Math.max(0,level.worldToRow(cy)),er=Math.min(level.data.height-1,level.worldToRow(cy+179));
        for(let row=sr;row<=er;row++)for(let col=sc;col<=ec;col++){
            if(level.data.tiles[row]?.[col]!==1)continue;
            const x=level.colToWorldX(col)-cx,y=level.rowToWorldY(row)-cy,top=level.data.tiles[row-1]?.[col]!==1;
            rect(c,x,y,16,16,P.earthShade);rect(c,x,y+3,16,13,P.earth);
            if(top){
                rect(c,x,y,16,2,P.deck);rect(c,x,y+2,16,2,P.dust);
                // Paving is flush with collision; dressed edges ground the plaza.
                rect(c,x,y+4,16,3,'#ad805d');rect(c,x+2,y+4,12,1,'#cf9d6e');
                if(col%2===0)rect(c,x+14,y+2,1,5,'#a87957');
            }
            drawGuairaClayGrain(c,x,y,col,row,'#cb9167','#aa7051');
        }
    });
}
function deck(c:CanvasRenderingContext2D,b:Body,cx:number,cy:number,lift:boolean){
    const x=Math.round(b.x)-cx,y=Math.round(b.y)-cy,w=Math.round(b.width),h=Math.round(b.height);
    rect(c,x,y,w,h,P.woodShade);rect(c,x,y,w,Math.min(2,h),P.deck);rect(c,x,y+2,w,Math.max(0,h-4),P.wood);rect(c,x,y+h-2,w,2,P.ironDark);
    drawGuairaTimber(c,x,y+2,w,h-4,lift?5:6);
    for(let xx=17;xx<w-10;xx+=19){rect(c,x+xx,y+2,1,Math.max(1,h-4),'#735c49');rect(c,x+xx+1,y+3,1,1,'#c0a176');}
    for(const xx of [2,w-7]){rect(c,x+xx,y+2,5,Math.max(0,h-2),lift?M.bronze:P.iron);rect(c,x+xx+1,y+3,2,1,M.bronzeLight);}
}

/** Draw actual bodies, including fractional live lift coordinates rounded once. */
export function drawGuairaMayorObjects(c:CanvasRenderingContext2D,objects:Bodies,m:GuairaMayorArtState,cx=0,cy=64,_time=0,_reducedMotion=false){
    layer(c,cx,cy,(cx,cy)=>{
        const lift=objects.get(MAYOR_ART_OBJECTS.lift),upper=objects.get(MAYOR_ART_OBJECTS.deck),valve=objects.get(MAYOR_ART_OBJECTS.valve);
        const upperValve=objects.get(MAYOR_ART_OBJECTS.upperValve),refuge=objects.get(MAYOR_ART_OBJECTS.refuge);
        const cue=mechanismCue(m),pressure=cue==='rising'||cue==='ready'||cue==='released';
        const seamBusy=m.state==='recover'&&!!m.counterpressure;
        if(refuge){
            deck(c,refuge,cx,cy,false);
            drawGuairaPipe(c,refuge.x+12-cx,refuge.y+8-cy,22,pressure,_time,_reducedMotion,true,1,false,PIPE);
        }
        if(upperValve&&upper){
            // A second real pedal is plumbed into the same lift, on the upper route.
            const x=upperValve.x+upperValve.width/2;
            drawGuairaPipe(c,x-4-cx,upper.y+8-cy,21,pressure,_time,_reducedMotion,true,1,false);
            drawGuairaPipeElbow(c,x-4-cx,upper.y+29-cy,pressure,false,false);
            drawGuairaPipe(c,218-cx,upper.y+29-cy,x-222,pressure,_time,_reducedMotion,false,-1,false);
        }
        if(lift&&valve){
            // The hydraulic connection stays behind the real plate and lift.
            // Its light means a fresh request, never a stale pre-stamp toggle.
            const x=valve.x+valve.width-2,end=(lift.home??lift).x+5,y=valve.y+valve.height-5;
            rect(c,x-cx,y-cy,end-x,4,M.bronzeShade);rect(c,x-cx,y+1-cy,end-x,2,pressure?M.water:M.bronze);
        }
        if(lift){
            const a=lift.home??lift,b=lift.to??a,top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);
            for(const wx of [a.x+4,a.x+lift.width-5]){
                // Cylinder shoes terminate at the real floor, with the moving
                // carriage and pulley angle derived from actual lift travel.
                rect(c,wx-3-cx,bottom-15-cy,7,15,'#8c7d60');rect(c,wx-2-cx,bottom-14-cy,2,13,'#b9a176');
                rect(c,wx-4-cx,bottom-3-cy,9,3,P.ironDark);rect(c,wx-3-cx,bottom-3-cy,7,1,P.iron);
                rect(c,wx-cx,top-17-cy,2,bottom-top+16,'#a58b66');rect(c,wx-cx,top-16-cy,1,bottom-top+15,'#c5ab7c');
                rect(c,wx-cx,top-12-cy,1,Math.max(0,lift.y-top+12),'#706b5a');
                oval(c,wx-4-cx,top-22-cy,9,9,'#786a53');oval(c,wx-3-cx,top-21-cy,7,7,'#c7a572');oval(c,wx-2-cx,top-20-cy,5,5,'#947d58');
                const spoke=Math.floor((bottom-lift.y)/3)%4;
                for(const d of [-1,1]){
                    const offsets=[[3,0],[2,2],[0,3],[-2,2]][spoke];
                    line(c,wx-cx,top-18-cy,wx+offsets[0]*d-cx,top-18+offsets[1]*d-cy,'#d0b481');
                }
                rect(c,wx-cx,top-18-cy,1,1,'#75664e');
            }
            if(pressure){
                // Pressure climbs the existing guide only as far as the real
                // platform has travelled. No independent timer or moving prop.
                const reached=Math.max(top,Math.min(bottom,lift.y));
                rect(c,a.x+4-cx,reached-cy,2,bottom-reached,M.waterShade);
                rect(c,a.x+4-cx,reached-cy,1,bottom-reached,M.waterLight);
                if(cue==='ready'||cue==='released'){
                    rect(c,a.x+2-cx,top-19-cy,5,3,M.waterShade);
                    rect(c,a.x+3-cx,top-19-cy,3,2,M.waterLight);
                }
            }
            deck(c,lift,cx,cy,true);
            if(cue==='ready'){
                const x=lift.x+lift.width-20-cx,y=lift.y+3-cy;
                if(seamBusy)waitInlay(c,x,y-1);
                else{
                    // A forward inlay is safe only once the announced pulse ends.
                    rect(c,x,y+1,8,1,M.waterLight);rect(c,x+5,y-1,1,5,M.waterLight);rect(c,x+6,y,1,3,M.waterLight);
                }
            }
            for(const wx of [lift.x+4,lift.x+lift.width-8]){
                rect(c,wx-cx,lift.y+lift.height-cy,3,5,'#816d51');line(c,wx-cx,lift.y+lift.height+5-cy,wx+7-cx,lift.y+lift.height-cy,'#a38a5d');
            }
        }
        if(upper){
            // Thin one-way platform. Braces are visibly behind and below its physical top.
            deck(c,upper,cx,cy,false);
            // The stamp lands on a brass plate flush with the actual deck, no invented pedestal.
            rect(c,upper.x+23-cx,upper.y-cy,13,1,M.bronzeLight);rect(c,upper.x+24-cx,upper.y+1-cy,11,2,M.bronzeShade);
            if(seamBusy){
                // Flush bronze outlets sit below the hazard, never above its top.
                const q=m.counterpressure!.rect;
                for(const x of [q.x+4,q.x+q.width-9]){
                    rect(c,x-cx,q.y+q.height-cy,5,3,M.bronzeShade);
                    rect(c,x+1-cx,q.y+q.height-cy,3,1,M.bronzeLight);
                    rect(c,x+2-cx,q.y+q.height+1-cy,1,2,M.waterShade);
                }
            }
        }
        for(const control of [valve,upperValve])if(control){
            const x=Math.round(control.x)-cx,y=Math.round(control.y)-cy,w=Math.round(control.width),h=Math.round(control.height);
            // Same cast treadles as the chapter. Their low inlays remain owned
            // by the encounter, with no plaque in the dangerous upper seam.
            const progress=lift?Math.max(0,Math.min(1,(224-lift.y)/64)):0;
            drawGuairaControlBase(c,control,cx,cy,objects.time??m.tick*1000/60,_reducedMotion,
                seamBusy?'warning':cue==='waiting'?'locked':cue==='register'?'available':cue==='rising'?'moving':'settled',progress);
            rect(c,x+5,y+3,w-10,Math.max(1,h-4),pressure?M.waterShade:M.sash);
            const mx=x+Math.floor(w/2),color=pressure?M.waterLight:M.creamLight;
            if(cue==='register'){
                // Down is the real ground-pound control, shown only when useful.
                rect(c,mx-1,y+2,2,3,color);rect(c,mx-3,y+4,6,1,color);rect(c,mx-2,y+5,4,1,color);rect(c,mx-1,y+6,2,1,color);
                rect(c,x+2,y+1,w-4,1,M.warning);
            }else if(cue==='rising'){
                rect(c,mx,y+2,1,5,color);rect(c,mx-1,y+3,3,1,color);rect(c,mx-2,y+4,5,1,color);
            }else if(cue==='ready'||cue==='released'){
                if(seamBusy)waitInlay(c,mx-3,y+2);
                else{rect(c,mx-4,y+4,8,1,color);rect(c,mx+1,y+2,1,5,color);rect(c,mx+2,y+3,1,3,color);}
            }else{
                // A quiet closed latch replaces the misleading permanent arrow.
                rect(c,mx-4,y+3,8,2,M.creamShade);rect(c,mx-4,y+2,2,4,M.creamShade);rect(c,mx+2,y+2,2,4,M.creamShade);
            }
            for(const dx of [2,w-4])rect(c,x+dx,y+h-3,2,2,P.ironDark);
        }
    });
}
