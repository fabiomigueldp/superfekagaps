import { MAYOR_PALETTE as M, type GuairaMayorArtState, type MayorRect } from './GuairaMayorArt';

/** The isolated arena uses only GROUND tiles plus the three real WorldObjects below. */
export const MAYOR_ART_OBJECTS = Object.freeze({valve:'guaira-mayor-register',lift:'guaira-mayor-lift',deck:'guaira-mayor-deck'});
interface Body extends MayorRect { readonly kind:string; readonly active:boolean; readonly home?:{readonly x:number;readonly y:number};readonly to?:{readonly x:number;readonly y:number} }
interface Bodies { get(id:string):Body|undefined }
type MechanismCue='waiting'|'register'|'rising'|'ready'|'released';
/** A moving lift alone is not a fresh opening: the encounter owns that decision. */
function mechanismCue(m:GuairaMayorArtState):MechanismCue {
    if(m.publicWaterOpen)return 'released';
    if(m.state==='recover'&&m.vulnerable)return 'ready';
    if((m.state==='stamp'||m.state==='recover')&&m.accessRequested)return 'rising';
    return m.state==='recover'?'register':'waiting';
}
interface GroundLevel {readonly data:{readonly width:number;readonly height:number;readonly tiles:readonly (readonly number[])[]};colToWorldX(c:number):number;rowToWorldY(r:number):number;worldToCol(x:number):number;worldToRow(y:number):number}
const P={ink:'#493c43',wall:'#d4af87',wallLight:'#e0c299',wallShade:'#bc9276',earth:'#b87955',earthShade:'#925c49',dust:'#e8b17c',wood:'#997454',woodLight:'#d1ac77',woodShade:'#695449',iron:'#697a78',ironDark:'#4e5c5c',deck:'#f2d69b'};
function rect(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string){if(w<=0||h<=0)return;c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h));}
function line(c:CanvasRenderingContext2D,x0:number,y0:number,x1:number,y1:number,color:string,width=1){const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1);for(let i=0;i<=n;i++)rect(c,x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,width,width,color);}
function layer(c:CanvasRenderingContext2D,cx:number,cy:number,fn:(x:number,y:number)=>void){c.save();c.beginPath();c.rect(0,0,320,180);c.clip();fn(Number.isFinite(cx)?Math.round(cx):0,Number.isFinite(cy)?Math.round(cy):0);c.restore();}
function oval(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string){for(let yy=0;yy<h;yy++){const half=Math.sqrt(Math.max(0,1-((yy+.5-h/2)/(h/2))**2))*w/2;rect(c,x+Math.ceil(w/2-half),y+yy,Math.floor(2*half),1,color);}}
const FONT:Readonly<Record<string,string>>={A:'010101111101101',B:'110101110101110',C:'011100100100011',D:'110101101101110',E:'111100110100111',F:'111100110100100',I:'111010010010111',L:'100100100100111',O:'010101101101010',P:'110101110100100',R:'110101110101101',S:'011100010001110',T:'111010010010010',U:'101101101101111',V:'101101101101010',Z:'111001010100111'};
function word(c:CanvasRenderingContext2D,text:string,x:number,y:number,color:string){[...text].forEach((letter,i)=>{const bits=FONT[letter]??'000000000000000';for(let n=0;n<15;n++)if(bits[n]==='1')rect(c,x+i*4+n%3,y+Math.floor(n/3),1,1,color);});}
function pipe(c:CanvasRenderingContext2D,x:number,y:number,w:number){rect(c,x,y,w,7,M.bronzeShade);rect(c,x,y+1,w,4,M.bronze);rect(c,x+1,y+1,w-2,1,M.bronzeLight);for(let dx=10;dx<w-4;dx+=31){rect(c,x+dx,y-1,3,9,P.woodShade);rect(c,x+dx+1,y,1,6,M.bronzeLight);}}

/** Architecture sits behind the real running surfaces; bright tops are reserved for collision. */
export function drawGuairaMayorBackground(c:CanvasRenderingContext2D,m:GuairaMayorArtState,cx=0,cy=64,time=0,reducedMotion=false){
    layer(c,cx,cy,(cx,cy)=>{
        const r=(x:number,y:number,w:number,h:number,color:string)=>rect(c,x-cx,y-cy,w,h,color);
        const t=reducedMotion||!Number.isFinite(time)?0:Math.max(0,time);
        rect(c,0,0,320,180,'#e7bd91');rect(c,0,0,320,53,'#edcda4');
        oval(c,62-cx,80-cy,17,17,'#f4dcaf');
        // Distant township: deliberately soft roofs and no pale playable lips.
        for(const [x,y,w,h] of [[-12,138,63,66],[39,127,44,77],[85,144,61,61],[132,128,67,79]]){
            r(x+3,y+6,w-6,h-6,'#c8a586');r(x,y,w,5,'#bd9079');r(x+6,y-3,w-12,3,'#cb9b80');
            r(x+13,y+20,9,20,'#b29b87');r(x+15,y+22,5,16,'#8eaaa0');
            r(x+w-23,y+19,10,12,'#ad927c');r(x+w-21,y+21,6,8,'#9cb1a1');
        }
        // Quiet service wall, warm stone and sparse vines.
        r(0,195,320,29,'#c4936e');r(0,214,320,10,'#cc9c70');
        for(let x=7;x<320;x+=37){r(x,213,14,1,'#b78967');r(x+6,216,2,3,'#b98b64');}
        for(const [x,y] of [[7,183],[305,171]]){r(x,y,3,27,'#859467');r(x-4,y+7,5,3,'#839564');r(x+2,y+13,5,3,'#90a06c');}
        // Modest civic room above the actual upper deck.
        r(222,103,94,56,P.wallShade);r(224,105,90,52,P.wall);r(227,108,84,2,P.wallLight);
        r(219,99,99,5,'#ac725b');r(222,95,93,4,'#bd7b60');r(228,92,81,3,'#cd9170');
        for(let x=226;x<313;x+=12){r(x,99,1,4,'#905b51');r(x+2,96,7,1,'#d49e79');}
        r(244,106,50,10,'#b58d6b');word(c,'VAZAO',259-cx,108-cy,'#67594d');
        for(const x of [231,298]){r(x,119,11,25,'#a58269');r(x+2,121,7,21,'#718e89');r(x+3,122,2,18,'#9fb3a1');r(x+5,121,1,21,'#cdb88e');}
        r(254,120,35,39,'#ab8261');r(257,122,29,36,'#92745c');r(258,123,2,32,'#ba9470');
        r(279,123,2,32,'#795f50');
        // Intake and private reserve visibly contain clean cyan water in every cycle.
        r(302,162,9,44,M.bronzeShade);r(304,164,5,39,M.bronze);r(304,164,1,37,M.bronzeLight);
        r(276,175,25,31,'#947555');r(278,176,21,28,'#b6915f');r(281,178,3,25,'#d1b17a');
        r(276,177,25,2,'#806b51');r(276,199,25,3,'#806b51');oval(c,276-cx,171-cy,25,8,'#bda173');oval(c,279-cx,172-cy,19,5,M.waterShade);r(280,173,17,2,M.water);
        word(c,'RESERVA',273-cx,164-cy,'#76664f');
        pipe(c,35-cx,190-cy,270);
        r(284,191,12,5,M.waterShade);r(285,192,10,2,M.water);r(285+Math.floor(t/260)%6,192,3,1,M.waterLight);
        // The public branch is closed by three stamped seals until the final release.
        r(238,185,28,18,'#745f50');r(240,187,24,14,'#a77b53');
        const locks=Math.max(0,Math.min(3,Math.round(m.sealsRemaining)));
        for(let i=0;i<3;i++){
            const x=242+i*7;
            if(i<locks){r(x,188,5,11,M.sash);r(x+1,189,3,3,M.woodLight);r(x+1,196,3,2,M.wood);}
            else{r(x,189,5,1,'#d7b588');r(x,196,5,1,'#d7b588');}
        }
        if(m.publicWaterOpen){r(240,189,24,10,M.waterShade);r(242,192,20,5,M.water);r(242,192,18,1,M.waterLight);}
        word(c,'BAIRRO',26-cx,181-cy,'#6c5e4d');
        // A recessed public trough: dark rim, intentionally no walkable pale highlight.
        r(10,205,92,9,'#9e7859');r(12,206,88,6,'#785e50');r(15,207,82,4,'#b58b62');
        r(33,195,7,12,M.bronzeShade);r(34,196,4,10,M.bronze);r(34,196,1,8,M.bronzeLight);
        if(m.publicWaterOpen){
            r(35,203,3,5,M.waterLight);r(16,207,81,4,M.waterShade);r(18,207,77,2,M.water);
            for(let x=19;x<91;x+=18)r(x+Math.floor(t/300)%5,207,8,1,M.waterLight);
        }else{
            line(c,26-cx,207-cy,30-cx,210-cy,'#795e4e');line(c,57-cx,207-cy,62-cx,210-cy,'#795e4e');
            r(31,198,11,6,'#745a4b');r(33,199,7,3,M.sash);
        }
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
            if(top){rect(c,x,y,16,2,P.deck);rect(c,x,y+2,16,2,P.dust);}
            if((row+col)%3!==0)rect(c,x+2+(col*3)%7,y+9,5,1,'#cc9062');
            if(col%4===2){rect(c,x+1,y+13,7,1,'#9e664d');rect(c,x+7,y+14,1,2,'#9e664d');}
        }
    });
}
function deck(c:CanvasRenderingContext2D,b:Body,cx:number,cy:number,lift:boolean){
    const x=Math.round(b.x)-cx,y=Math.round(b.y)-cy,w=Math.round(b.width),h=Math.round(b.height);
    rect(c,x,y,w,h,P.woodShade);rect(c,x,y,w,Math.min(2,h),P.deck);rect(c,x,y+2,w,Math.max(0,h-4),P.wood);rect(c,x,y+h-2,w,2,P.ironDark);
    for(let xx=0;xx<w;xx+=14){rect(c,x+xx,y+2,1,Math.max(0,h-4),P.woodShade);rect(c,x+xx+2,y+3,Math.min(8,w-xx-2),1,P.woodLight);}
    for(const xx of [2,w-7]){rect(c,x+xx,y+2,5,Math.max(0,h-2),lift?M.bronze:P.iron);rect(c,x+xx+1,y+3,2,1,M.bronzeLight);}
}

/** Draw actual bodies, including fractional live lift coordinates rounded once. */
export function drawGuairaMayorObjects(c:CanvasRenderingContext2D,objects:Bodies,m:GuairaMayorArtState,cx=0,cy=64,_time=0,_reducedMotion=false){
    layer(c,cx,cy,(cx,cy)=>{
        const lift=objects.get(MAYOR_ART_OBJECTS.lift),upper=objects.get(MAYOR_ART_OBJECTS.deck),valve=objects.get(MAYOR_ART_OBJECTS.valve);
        const cue=mechanismCue(m),pressure=cue==='rising'||cue==='ready'||cue==='released';
        if(lift&&valve){
            // The hydraulic connection stays behind the real plate and lift.
            // Its light means a fresh request, never a stale pre-stamp toggle.
            const x=valve.x+valve.width-2,end=(lift.home??lift).x+5,y=valve.y+valve.height-5;
            rect(c,x-cx,y-cy,end-x,4,M.bronzeShade);rect(c,x-cx,y+1-cy,end-x,2,pressure?M.water:M.bronze);
        }
        if(lift){
            const a=lift.home??lift,b=lift.to??a,top=Math.min(a.y,b.y),bottom=Math.max(a.y,b.y);
            for(const wx of [a.x+4,a.x+lift.width-5]){
                rect(c,wx-cx,top-17-cy,2,bottom-top+16,'#a58b66');rect(c,wx-cx,top-16-cy,1,bottom-top+15,'#c5ab7c');
                rect(c,wx-cx,top-12-cy,1,Math.max(0,lift.y-top+12),'#706b5a');
                oval(c,wx-4-cx,top-22-cy,9,9,'#8e7456');oval(c,wx-2-cx,top-20-cy,5,5,'#c7a572');rect(c,wx-cx,top-19-cy,1,3,'#7e694f');
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
                // A right-pointing inlay on the board directs the now-open route.
                const x=lift.x+lift.width-20-cx,y=lift.y+3-cy;
                rect(c,x,y+1,8,1,M.waterLight);rect(c,x+5,y-1,1,5,M.waterLight);rect(c,x+6,y,1,3,M.waterLight);
            }
            for(const wx of [lift.x+4,lift.x+lift.width-8]){
                rect(c,wx-cx,lift.y+lift.height-cy,3,5,'#816d51');line(c,wx-cx,lift.y+lift.height+5-cy,wx+7-cx,lift.y+lift.height-cy,'#a38a5d');
            }
        }
        if(upper){
            // Thin one-way platform. Braces are visibly behind and below its physical top.
            for(const xx of [upper.x+6,upper.x+upper.width-10]){
                rect(c,xx-cx,upper.y+upper.height-cy,3,23,'#a68a64');line(c,xx-cx,upper.y+upper.height+14-cy,xx+10-cx,upper.y+upper.height-cy,'#967957',2);
            }
            deck(c,upper,cx,cy,false);
            // The stamp lands on a brass plate flush with the actual deck, no invented pedestal.
            rect(c,upper.x+23-cx,upper.y-cy,13,1,M.bronzeLight);rect(c,upper.x+24-cx,upper.y+1-cy,11,2,M.bronzeShade);
        }
        if(valve){
            const x=Math.round(valve.x)-cx,y=Math.round(valve.y)-cy,w=Math.round(valve.width),h=Math.round(valve.height);
            rect(c,x,y,w,h,P.woodShade);rect(c,x+1,y+1,w-2,h-2,M.bronzeShade);rect(c,x+2,y+1,w-4,2,M.bronzeLight);
            rect(c,x+5,y+3,w-10,Math.max(1,h-4),pressure?M.waterShade:M.sash);
            const mx=x+Math.floor(w/2),color=pressure?M.waterLight:M.creamLight;
            if(cue==='register'){
                // Down is the real ground-pound control, shown only when useful.
                rect(c,mx-1,y+2,2,3,color);rect(c,mx-3,y+4,6,1,color);rect(c,mx-2,y+5,4,1,color);rect(c,mx-1,y+6,2,1,color);
                rect(c,x+2,y+1,w-4,1,M.warning);
            }else if(cue==='rising'){
                rect(c,mx,y+2,1,5,color);rect(c,mx-1,y+3,3,1,color);rect(c,mx-2,y+4,5,1,color);
            }else if(cue==='ready'||cue==='released'){
                rect(c,mx-4,y+4,8,1,color);rect(c,mx+1,y+2,1,5,color);rect(c,mx+2,y+3,1,3,color);
            }else{
                // A quiet closed latch replaces the misleading permanent arrow.
                rect(c,mx-4,y+3,8,2,M.creamShade);rect(c,mx-4,y+2,2,4,M.creamShade);rect(c,mx+2,y+2,2,4,M.creamShade);
            }
            for(const dx of [2,w-4])rect(c,x+dx,y+h-3,2,2,P.ironDark);
        }
    });
}
