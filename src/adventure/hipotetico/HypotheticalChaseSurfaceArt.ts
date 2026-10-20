import {box,pixelLine,polygon} from '../WorldPainting';
import {CHASE_GAPS,CHASE_STEPS,chaseDistrictAt} from './HypotheticalLayout';
import {chaseMaterialAt,CHASE_DECK_Y} from './HypotheticalChaseDetails';

const P={ink:'#243d49',joint:'#465e64',stone:'#758982',stoneDark:'#607975',
    stoneLight:'#a1ac95',cap:'#c6b68e',edge:'#f0d4a1',wet:'#527e7a',
    wood:'#947654',grain:'#6b6252',woodLight:'#b3956d',iron:'#54777d',steel:'#78958e'};
type Solid=(col:number,row:number)=>boolean;
const mod=(n:number,d:number)=>((n%d)+d)%d;

/** Raised cargo is one strapped assembly, not a stack of identical 16px icons.
 * Clip each slice to its native solid tile, including the collapsing edge. */
export function drawChaseStep(c:CanvasRenderingContext2D,col:number,cx:number,cy:number){
    const start=CHASE_STEPS.some(step=>step===col-1)?col-1:col;
    const world=start*16,x=world-cx,y=208-cy;
    c.save();c.beginPath();c.rect(Math.round(col*16-cx),Math.round(y),16,16);c.clip();
    box(c,x,y,32,16,P.ink);box(c,x+1,y+2,30,12,P.wood);
    for(const [yy,from,to]of [[4,3,14],[8,16,28],[12,8,24]]){
        pixelLine(c,x+from,y+yy,x+to,y+yy,P.grain);
        pixelLine(c,x+from+1,y+yy-1,x+to-3,y+yy-1,P.woodLight);
    }
    for(const u of [3,25]){
        box(c,x+u,y+1,4,14,P.joint);box(c,x+u,y+2,1,12,P.steel);
        box(c,x+u+1,y+3,1,1,P.cap);box(c,x+u+1,y+12,1,1,P.steel);
    }
    // A recessed handhold belongs to the crate face, below its walkable edge.
    box(c,x+12,y+6,8,4,P.grain);box(c,x+13,y+6,6,1,P.woodLight);
    box(c,x,y,32,1,P.edge);box(c,x+1,y+1,30,1,P.cap);
    c.restore();
}

/** World-aligned courses extend across tile boundaries, but never across a
 * missing tile. Only the actual collision top receives the bright coping. */
export function drawChaseSurfaceTile(c:CanvasRenderingContext2D,col:number,row:number,cx:number,cy:number,solid:Solid){
    const wx=col*16,wy=row*16,x=wx-cx,y=wy-cy,material=chaseMaterialAt(wx),district=chaseDistrictAt(wx);
    c.save();c.beginPath();c.rect(Math.round(x),Math.round(y),16,16);c.clip();
    box(c,x,y,16,16,P.ink);
    if(row===14&&material==='timber'){
        const from=Math.floor(wx/48)*48,local=wx-from,xx=from-cx;
        box(c,x,y+2,16,8,P.wood);box(c,x,y+11,16,4,P.grain);
        // Long plank grain, staggered butt joints and knots occupy separate bays.
        for(const [u,v,w]of [[5,4,19],[29,7,13],[14,8,9]]){
            pixelLine(c,xx+u,y+v,xx+u+w,y+v,P.grain);
            if(v===4)pixelLine(c,xx+u+2,y+v-1,xx+u+w-4,y+v-1,P.woodLight);
        }
        box(c,xx,y+2,1,8,P.joint);
        if(Math.floor(from/48)%3===1){
            box(c,xx+29,y+4,5,2,P.grain);box(c,xx+30,y+4,2,1,P.woodLight);
        }
        if(local===16){
            box(c,x+8,y+7,5,8,P.joint);box(c,x+9,y+7,1,7,P.steel);
            for(const yy of [8,13])box(c,x+10,y+yy,1,1,P.cap);
        }
        pixelLine(c,x,y+11,x+15,y+11,'#8a795e');
    }else if(row===14&&material==='iron'){
        const from=Math.floor(wx/48)*48,xx=from-cx;
        box(c,x,y+2,16,12,P.iron);
        box(c,xx+2,y+4,43,6,'#41636e');box(c,xx+3,y+5,41,1,'#65878a');
        pixelLine(c,xx+5,y+8,xx+17,y+8,'#52757c');
        box(c,xx,y+2,2,13,P.joint);box(c,xx+2,y+2,1,12,P.steel);
        for(const yy of [3,12])box(c,xx+3,y+yy,1,1,P.cap);
        box(c,x,y+13,16,1,P.steel);
        if(Math.floor(from/48)%3===1){
            pixelLine(c,xx+31,y+9,xx+37,y+9,'#888773');
            box(c,xx+34,y+10,2,2,'#6c796d');
        }
        if(district===5){
            // Customs plates have a recessed rib, rather than extra bright dots.
            pixelLine(c,xx+25,y+5,xx+29,y+9,P.steel);
            pixelLine(c,xx+29,y+9,xx+33,y+5,P.steel);
        }
    }else{
        // Broad masonry courses also support timber and steel decks below.
        const course=row*2,span=32,shade=district===3?P.stoneDark:P.stone;
        box(c,x,y,16,16,shade);
        for(let r=0;r<2;r++){
            const yy=y+r*8,offset=mod(course+r,2)*16;
            const first=Math.floor((wx-offset)/span)*span+offset;
            box(c,x,yy+7,16,1,P.joint);
            for(let world=first;world<wx+16;world+=span){
                const xx=world-cx;
                box(c,xx,yy,1,7,P.joint);pixelLine(c,xx+2,yy+1,xx+27,yy+1,'#8fa18e');
                if(mod(world/16+r+row,5)===1){
                    pixelLine(c,xx+17,yy+4,xx+23,yy+4,'#6b8176');
                    box(c,xx+21,yy+3,4,1,'#9ca88f');
                }
            }
        }
        if(row>=15){
            box(c,x,y+9,16,7,P.wet);
            const band=Math.floor(wx/64)*64-cx;
            box(c,band+6,y+3,5,7,'#5c8078');box(c,band+8,y+1,2,5,'#668b7c');
            pixelLine(c,band+1,y+10,band+12,y+10,'#6b9585');
        }
        if(row===14&&district===3){
            const from=Math.floor(wx/80)*80,xx=from-cx;
            // Drain grate is inset in the face, not a false hole in the floor.
            box(c,xx+20,y+7,19,6,'#3d656b');box(c,xx+19,y+6,21,1,P.stoneLight);
            for(let u=22;u<38;u+=4)pixelLine(c,xx+u,y+8,xx+u,y+11,'#80988a');
            box(c,xx+25,y+13,6,3,P.wet);
        }
    }
    if(!solid(col,row-1)){
        box(c,x,y,16,1,P.edge);box(c,x,y+1,16,2,P.cap);
        box(c,x,y+3,16,1,P.ink);
        const joint=mod(col,3)===0;
        if(joint)box(c,x+1,y+1,1,2,'#968e72');
        if(mod(col,7)===2){box(c,x+8,y+2,4,1,'#aaa17e');box(c,x+9,y+1,2,1,'#d8c49b');}
    }
    if(!solid(col-1,row)){
        box(c,x,y+4,2,12,material==='timber'?P.woodLight:P.steel);
        pixelLine(c,x+2,y+6,x+2,y+13,P.ink);
    }
    if(!solid(col+1,row)){
        box(c,x+14,y+4,2,12,P.ink);box(c,x+12,y+7,2,7,P.joint);
    }
    c.restore();
}

/** Physical end-caps, exposed end-grain and water stains replace freestanding
 * arrows. Nothing extends beyond the surviving solid bank into a jump. */
export function drawChaseBankEnds(c:CanvasRenderingContext2D,cx:number,cy:number,solid:Solid){
    const y=CHASE_DECK_Y-cy;
    for(const [from,to]of CHASE_GAPS)for(const [col,right]of [[from-1,true],[to,false]] as const){
        if(!solid(col,14)||col*16<cx-16||col*16>cx+320)continue;
        const x=col*16-cx,material=chaseMaterialAt(col*16),u=right?11:1;
        box(c,x+u,y+1,4,2,P.cap);box(c,x+u,y+4,4,10,P.joint);
        pixelLine(c,x+u,y+4,x+u+3,y+4,P.steel);
        for(const yy of [5,11])box(c,x+u+1,y+yy,1,1,P.cap);
        if(material==='timber'){
            for(const yy of [6,9])pixelLine(c,x+(right?2:7),y+yy,x+(right?8:13),y+yy,P.grain);
        }else if(material==='stone'){
            polygon(c,[[x+u,y+6],[x+u+4,y+7],[x+u+3,y+14],[x+u,y+15]],'#627e77');
            pixelLine(c,x+u,y+6,x+u+2,y+7,P.stoneLight);
        }
    }
}
