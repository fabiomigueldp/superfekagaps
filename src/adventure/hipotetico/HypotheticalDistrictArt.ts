import {box,oval,pixelLine,polygon} from '../WorldPainting';
import {pixelText} from '../../graphics/BitmapFont';
import type {MovingBody} from '../WorldPhysics';
import type {HypotheticalModel} from './HypotheticalModel';
import {SIEGE_SECTORS} from './HypotheticalSiege';

const P={ink:'#263e4b',shade:'#43616a',metal:'#658188',rim:'#9dab99',cream:'#e5cca0',
    wood:'#816655',grain:'#a48968',darkWood:'#5d5550',brick:'#8e7770',brickLight:'#ad9580',
    recess:'#4b6b70',brass:'#bc955f',mint:'#a4d3b4',dull:'#738c83'};
const clamp=(n:number)=>Math.max(0,Math.min(1,n));

function bolt(c:CanvasRenderingContext2D,x:number,y:number){box(c,x,y,2,2,P.ink);box(c,x,y,1,1,P.rim);}
function plinth(c:CanvasRenderingContext2D,x:number,y:number,w:number){
    box(c,x,y,w,5,P.shade);box(c,x+1,y+1,w-2,1,P.rim);box(c,x+3,y+3,w-6,1,P.metal);
}
function crate(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number){
    // Recessed stores stay behind the walkable plane: no cream platform lip.
    box(c,x,y,w,h,P.darkWood);box(c,x+2,y+2,w-4,h-4,P.wood);
    for(let yy=y+4;yy<y+h-2;yy+=5)box(c,x+3,yy,w-6,1,P.grain);
    pixelLine(c,x+2,y+2,x+w-4,y+h-4,P.darkWood,2);
    for(const xx of [x+2,x+w-5]){box(c,xx,y+1,3,h-2,P.shade);bolt(c,xx,y+3);bolt(c,xx,y+h-5);}
}
function lamp(c:CanvasRenderingContext2D,x:number,y:number,active:boolean,cleared:boolean,time:number){
    box(c,x-4,y-2,11,3,P.shade);box(c,x,y,3,7,P.metal);
    box(c,x-2,y+6,7,7,P.ink);box(c,x-1,y+7,5,4,cleared?P.mint:active?P.brass:P.dull);
    if(active)box(c,x-1+Math.floor(time/12)%4,y+7,1,4,P.cream);
    box(c,x-2,y+12,7,1,P.metal);
}

/** Low-frequency detail occupies recesses and plinths, leaving the road and
 * enemy silhouettes clear. Power states follow actual sector progress. */
export function drawSiegeDistricts(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    c.save();c.translate(-Math.round(cx),-Math.round(cy));
    for(const [i,s] of SIEGE_SECTORS.entries()){
        if(s.trigger>cx+350||s.gate<cx-80)continue;
        const active=b.route.active&&b.route.entered===i,cleared=b.route.cleared>i;
        const time=reduced?0:b.tick,settle=cleared?clamp(b.route.clearTicks[i]/180):0;
        const x=s.trigger+4;
        // Each threshold has a numbered ceramic district plaque, mounted on
        // the wall. It never resembles a collectible or an interactive switch.
        box(c,x-5,197,20,18,P.shade);box(c,x-4,198,18,16,P.rim);box(c,x-3,199,16,14,P.recess);
        pixelText(c,String(i+1).padStart(2,'0'),x-1,202,cleared?P.mint:'#b2b49a');
        box(c,x-7,216,24,3,P.shade);
        lamp(c,s.gate-49,174,active,cleared,time);
        // The cable is anchored to the panel and bends along the foundation;
        // its insulators and joints explain the gate motor's installation.
        pixelLine(c,s.gate-47,187,s.gate-47,215,P.shade,2);
        pixelLine(c,s.gate-47,215,s.gate-20,215,P.shade,2);
        for(const yy of [191,209])box(c,s.gate-49,yy,6,2,P.metal);
        if(i===0){
            // Guardroom lockers, attendance window and coiled inspection rope.
            box(c,374,194,36,29,P.recess);box(c,375,195,34,2,P.metal);
            for(let j=0;j<3;j++){
                const xx=377+j*10;box(c,xx,198,8,23,P.shade);box(c,xx+1,199,6,1,P.metal);
                box(c,xx+5,209,1,3,P.brass);for(let n=0;n<3;n++)box(c,xx+2,201+n*2,4,1,P.recess);
            }
            plinth(c,372,220,40);
            oval(c,510,210,17,10,P.darkWood);oval(c,513,212,11,6,P.grain);oval(c,516,213,5,4,P.shade);
            pixelLine(c,518,218,535,222,P.grain);box(c,532,219,4,3,P.metal);
            const paper=cleared?Math.min(18,b.route.clearTicks[i]/9):0;
            // The receipt drops once after the mechanism releases, then stays.
            box(c,587,202+paper,5,3,'#a3aa94');box(c,588,203+paper,3,1,P.recess);
        }else if(i===1){
            crate(c,742,203,24,20);crate(c,766,211,18,12);
            // Canal access and mooring fixtures are recessed below the route.
            box(c,860,228,112,11,P.ink);box(c,861,229,110,9,'#476e78');
            for(let j=0;j<5;j++){
                const xx=864+j*20+(reduced?0:Math.floor(time/12+j)%6);
                box(c,xx,231+j%2*3,10,1,'#6e9598');
            }
            for(const xx of [865,966]){box(c,xx,211,6,13,P.shade);box(c,xx-3,210,12,3,P.metal);bolt(c,xx+2,211);}
            pixelLine(c,869,216,883,220,P.grain);pixelLine(c,883,220,900,217,P.grain);
            box(c,903,205,28,18,P.recess);for(let yy=207;yy<222;yy+=4)box(c,905,yy,24,1,P.metal);
        }else if(i===2){
            // A cooling plant behind the landing. Its gauge falls and the fan
            // coasts to rest after clearance; neither vent is a damage source.
            const px=1268,py=192,spin=cleared?b.route.clearedAt[i]+180*(settle-settle*settle/2):active?b.route.ticks:0;
            box(c,px-2,py-3,38,34,P.recess);box(c,px,py,34,30,P.shade);
            box(c,px+1,py+1,32,1,P.metal);oval(c,px+4,py+4,22,22,P.ink);oval(c,px+6,py+6,18,18,P.recess);
            for(let j=0;j<4;j++){
                const a=(reduced?0:spin/17)+j*Math.PI/2;
                pixelLine(c,px+15,py+15,px+15+Math.cos(a)*7,py+15+Math.sin(a)*7,P.metal,2);
            }
            oval(c,px+13,py+13,5,5,P.brass);plinth(c,px-4,221,42);
            pixelLine(c,px-8,217,px-8,185,P.shade,4);pixelLine(c,px-8,185,px+1,185,P.shade,4);
            box(c,px-10,193,8,3,P.metal);box(c,px-10,213,8,3,P.metal);
            oval(c,px+24,py-13,12,12,P.shade);oval(c,px+26,py-11,8,8,'#b0af94');
            const a=-2.5+(active?1:cleared?1-settle:.25)*2;
            pixelLine(c,px+30,py-7,px+30+Math.cos(a)*3,py-7+Math.sin(a)*3,P.ink);
            if(!reduced&&(active||cleared&&settle<1))for(let j=0;j<3;j++){
                const age=(time+j*23)%72;if(age>36*(1-settle))continue;
                box(c,px-9+Math.sin(age/9+j)*2,183-age*.24,3+Math.floor(age/14),2,'#91a49b');
            }
        }else{
            // Buttresses frame the final duelling floor; no prop crosses its
            // central lane or adds a concealed collision wall.
            for(const px of [1573,1837]){
                box(c,px,193,13,30,P.shade);box(c,px+2,194,9,28,P.brick);
                for(let yy=197;yy<219;yy+=7){box(c,px+2,yy,9,1,P.shade);box(c,px+3,yy+1,3,1,P.brickLight);}
                plinth(c,px-3,220,19);
            }
            for(const px of [1728,1810]){
                box(c,px,228,29,9,P.shade);box(c,px+1,229,27,1,P.rim);
                pixelLine(c,px+4,230,px+11,234,P.metal);pixelLine(c,px+11,234,px+24,230,P.metal);
            }
        }
        // A restrained pressure-release trace settles into the floor grating,
        // instead of looping a smoke burst forever after each cleared fight.
        const age=b.route.clearTicks[i];
        if(!reduced&&cleared&&age>20&&age<76)for(let j=0;j<4;j++){
            const t=age-20-j*5;if(t<0||t>35)continue;
            box(c,s.gate-35-j*3-t*.17,218-t*.3,4+t*.06,1,'#9ea996');
        }
    }
    c.restore();
}

function deckLip(c:CanvasRenderingContext2D,x:number,y:number,w:number){
    box(c,x,y,w,7,P.ink);box(c,x,y,w,1,P.cream);box(c,x+1,y+1,w-2,1,P.rim);
    box(c,x+1,y+2,w-2,3,P.metal);box(c,x+2,y+5,w-4,1,P.shade);
    for(let xx=x+4;xx<x+w-3;xx+=8)bolt(c,xx,y+3);
}

/** Special bodies are painted from their actual native collision coordinates. */
export function drawSiegeRouteBody(c:CanvasRenderingContext2D,p:MovingBody,cx:number,cy:number):boolean{
    const x=p.x-cx,y=p.y-cy,floor=224-cy,w=p.width;
    if(p.id==='siege-inspection-roof'){
        // Open arcade: only the top is solid. Dark openings preserve visibility
        // of the patrol underneath; the corners explain the canopy's support.
        for(const xx of [x+3,x+w-7]){
            box(c,xx,y+7,4,floor-y-7,P.shade);box(c,xx+1,y+9,1,floor-y-12,P.metal);
            plinth(c,xx-3,floor-5,10);
        }
        polygon(c,[[x+5,y+18],[x+12,y+7],[x+5,y+7]],P.shade);
        polygon(c,[[x+w-5,y+18],[x+w-12,y+7],[x+w-5,y+7]],P.shade);
        box(c,x+4,y+10,w-8,11,P.recess);box(c,x+5,y+11,w-10,1,P.metal);
        pixelText(c,'POSTO',x+6,y+13,'#aab29b');
        deckLip(c,x,y,w);return true;
    }
    if(p.id==='siege-arsenal-gallery'){
        for(const xx of [x+3,x+w-6]){
            pixelLine(c,xx,y+6,xx,floor-5,P.shade,3);
            pixelLine(c,xx,y+21,xx+(xx===x+3?10:-10),y+7,P.metal,2);
            plinth(c,xx-3,floor-5,9);
        }
        // Stowed hose and hangers belong below the deck, never above its lip.
        for(let j=0;j<3;j++){
            const xx=x+10+j*8;pixelLine(c,xx,y+8,xx+2,y+18,P.darkWood);
            pixelLine(c,xx+2,y+18,xx+7,y+10,P.grain);
        }
        deckLip(c,x,y,w);return true;
    }
    if(p.id!=='siege-cargo-lift')return false;
    const top=122-cy,travel=(p.home?.y??196)-p.y;
    // Twin guide rails and a counterweight follow the same displacement as
    // the carriage. This is a one-way lift, not an opaque box or overhead trap.
    for(const xx of [x-4,x+w+1]){
        box(c,xx,top,3,floor-top-5,P.shade);box(c,xx+1,top+2,1,floor-top-10,P.metal);
        for(const yy of [top+8,floor-18]){box(c,xx-2,yy,7,3,P.shade);bolt(c,xx,yy);}
        plinth(c,xx-4,floor-5,11);
        box(c,xx-2,y-2,7,12,P.ink);box(c,xx-1,y,5,7,P.metal);
    }
    box(c,x+w+9,top+7,5,floor-top-13,P.shade);box(c,x+w+10,top+8,2,floor-top-16,P.ink);
    box(c,x-8,top-4,w+23,6,P.shade);box(c,x-7,top-4,w+21,1,P.rim);
    const wheelX=x+w+3,wheelY=top-1,a=travel/5;
    oval(c,wheelX-5,wheelY-5,10,10,P.ink);oval(c,wheelX-3,wheelY-3,6,6,P.brass);
    pixelLine(c,wheelX-Math.cos(a)*3,wheelY-Math.sin(a)*3,wheelX+Math.cos(a)*3,wheelY+Math.sin(a)*3,P.ink);
    for(const xx of [x-2,x+w+2])for(let yy=top+5+(Math.round(travel)%5);yy<y-2;yy+=5)box(c,xx,yy,1,3,P.grain);
    const wy=top+12+travel;
    pixelLine(c,x+w+11,top+1,x+w+11,wy,P.shade);
    box(c,x+w+7,wy,9,14,P.ink);box(c,x+w+8,wy+1,7,12,P.metal);box(c,x+w+8,wy+6,7,2,P.shade);
    for(const dockY of [148,196]){box(c,x-7,dockY-cy,5,2,P.brass);box(c,x+w+5,dockY-cy,4,2,P.brass);}
    // The loading bay remains usable even if Feka approaches between stops.
    box(c,x+3,floor-8,w-6,3,P.shade);box(c,x+4,floor-8,w-8,1,P.metal);
    deckLip(c,x,y,w);box(c,x+9,y+7,w-18,3,P.shade);
    for(const xx of [x+3,x+w-8]){box(c,xx,y+2,5,3,P.brass);box(c,xx+2,y+2,2,1,P.cream);}
    return true;
}
