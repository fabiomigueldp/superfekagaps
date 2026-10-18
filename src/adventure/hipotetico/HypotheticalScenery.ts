import { box, oval, pixelLine, polygon } from '../WorldPainting';
import type { WorldLevel, WorldObjects, MovingBody } from '../WorldPhysics';
import { HYPOTHETICAL, type HypotheticalModel } from './HypotheticalModel';
import { ARENA_BALCONIES, ARENA_COLUMNS, CHASE_GAPS } from './HypotheticalLayout';
import { SIEGE_SECTORS, SIEGE_GATE_TICKS } from './HypotheticalSiege';

const S = {
    ink: '#213545', joint: '#354956', stone: '#677b7c', stoneShade: '#516571',
    stoneLight: '#93a39b', cap: '#c6b68e', edge: '#f0d4a1', wood: '#856350',
    woodShade: '#594e4d', woodLight: '#b98b66', iron: '#3f606a', ironLight: '#7da09c',
    brick: '#aa7c68', pale: '#d2b990', sea: '#3c7380', seaLight: '#79aaa5',
};
const mod = (n: number, d: number) => ((n % d) + d) % d;

function arch(c: CanvasRenderingContext2D, x: number, top: number, w: number, h: number, color: string) {
    const r = Math.min(w / 2, h * .6);
    polygon(c, [[x,top+h],[x,top+r],[x+2,top+r*.55],[x+r*.38,top+2],[x+r,top],
        [x+w-r,top],[x+w-r*.38,top+2],[x+w-2,top+r*.55],[x+w,top+r],[x+w,top+h]], color);
}

function roof(c: CanvasRenderingContext2D, x: number, y: number, w: number, green = false) {
    const shade = green ? '#506d70' : '#816b6d', mid = green ? '#79928a' : '#b18778', light = green ? '#a1aea0' : '#d1a486';
    polygon(c, [[x+5,y-9],[x+w-9,y-9],[x+w+3,y+1],[x-4,y+1]], shade);
    polygon(c, [[x+6,y-8],[x+w-10,y-8],[x+w-2,y-1],[x,y-1]], mid);
    for(let yy=0;yy<2;yy++) for(let xx=x+6+yy*3;xx<x+w-7;xx+=9) {
        box(c,xx,y-7+yy*4,5,1,light);box(c,xx+5,y-6+yy*4,1,3,shade);
    }
    box(c,x-4,y+1,w+7,3,shade);box(c,x-3,y+1,w+5,1,light);
}

function shutter(c: CanvasRenderingContext2D, x: number, y: number, w = 12, h = 17, lit = false) {
    arch(c,x-2,y-3,w+4,h+5,'#b8ad94');arch(c,x,y-1,w,h+1,'#5d7173');
    box(c,x+2,y+3,w-4,h-5,lit?'#c4b491':'#7d9890');
    for(let j=5;j<h-3;j+=4)box(c,x+2,y+j,w-4,1,'#627d7b');
    box(c,x+w/2,y+1,1,h-2,'#a7b4a2');box(c,x-3,y+h,w+6,2,'#bbaf93');
    box(c,x-2,y+h+2,w+4,2,'#7a8278');
}

/** Every facade retains a roof, opening, base and readable load-bearing corners. */
function facade(c: CanvasRenderingContext2D, x: number, base: number, w: number, h: number, variant: number, broken = false) {
    const top=base-h, plaster=['#b39e87','#98a294','#b0a18f'][variant%3], shade=['#8b8980','#7d8e86','#939285'][variant%3];
    const crest=broken?base-h*.42:top;
    box(c,x,crest,w,base-crest,shade);box(c,x+4,crest,w-8,base-crest,plaster);
    if(broken){
        polygon(c,[[x,crest+2],[x+6,crest-6],[x+12,crest+1],[x+21,crest-10],[x+27,crest-4],[x+34,crest-5],[x+w,crest+2]],shade);
        for(let i=0;i<4;i++){
            const xx=x+6+i*(w-12)/4;
            pixelLine(c,xx,crest+3,xx+5,crest+9,'#756f6a');box(c,xx,crest+4,5,2,'#bd9c7d');
        }
        for(let i=0;i<5;i++)polygon(c,[[x+i*11-3,base],[x+i*11+3,base-5-i%2*3],[x+i*11+12,base]],i%2?'#a39880':'#8a8b7c');
    }else{
        roof(c,x,top,w,variant%3===1);
        box(c,x+8,top+8,w-16,2,'#bfb297');
        for(let xx=x+9;xx<x+w-14;xx+=22)shutter(c,xx,top+16,11,15,variant%3===2);
        if(h>64)for(let xx=x+9;xx<x+w-14;xx+=22)shutter(c,xx,top+40,11,14);
        for(const xx of [x+2,x+w-6]){
            box(c,xx,top+4,4,h-4,'#bdb39a');
            for(let yy=top+10;yy<base-6;yy+=11)box(c,xx,yy,3,1,'#8e9487');
        }
        const doorY=base-27,doorX=x+w/2-9;
        arch(c,doorX-3,doorY-3,24,30,'#bcb39a');arch(c,doorX,doorY,18,27,'#647873');
        for(let i=0;i<3;i++)box(c,doorX+3+i*5,doorY+8,1,17,'#8e9c89');
        box(c,doorX+8,base-12,2,2,'#baae8b');
        if(variant%3===0){
            polygon(c,[[x+4,base-27],[x+w-4,base-27],[x+w+1,base-20],[x-1,base-20]],'#658d86');
            for(let i=0;i<4;i++)polygon(c,[[x+6+i*12,base-26],[x+12+i*12,base-26],[x+14+i*12,base-20],[x+6+i*12,base-20]],'#a5b1a0');
            box(c,x,base-20,w,3,'#71958a');
        }
        if(variant%3===1){
            box(c,x+8,base-32,w-16,2,'#647b76');
            for(let xx=x+10;xx<x+w-9;xx+=6)box(c,xx,base-32,1,9,'#647b76');
            box(c,x+6,base-23,w-12,3,'#bdb199');
        }
        // Local wear clusters, not a screen-wide checker texture.
        for(const [dx,dy] of [[6,48],[w-15,34],[w-18,h-8]]){
            if(dy>h-5)continue;
            box(c,x+dx,top+dy,8,3,'#9d8c79');box(c,x+dx+1,top+dy,3,1,'#c2ad8e');
        }
    }
    box(c,x,base-3,w,3,'#7b8c82');
}

function foliage(c: CanvasRenderingContext2D, x: number, base: number, time: number) {
    const top=base-47, sway=Math.sin(time/57+x)*1.4;
    polygon(c,[[x-2,base],[x+3,base],[x,top],[x-3,top]],'#71847a');
    for(let i=0;i<4;i++)pixelLine(c,x-1,base-i*10,x+2,base-i*10-2,'#a1a68a');
    for(const d of [-1,1]){
        polygon(c,[[x-2,top+1],[x+d*9+sway,top-8],[x+d*18+sway,top-7],[x+d*26+sway,top+4],
            [x+d*15+sway,top-2],[x+d*8,top-1]],'#688b7f');
        polygon(c,[[x,top+1],[x+d*15,top+3],[x+d*24+sway,top+15],[x+d*18+sway,top+12],[x+d*8,top+5]],'#587e77');
        pixelLine(c,x+d*4,top,x+d*14+sway,top-5,'#90a68c');
    }
    oval(c,x-6,base-3,15,4,'#627f75');
}

function pennant(c: CanvasRenderingContext2D, x: number, y: number, time: number, height = 26) {
    const bend=Math.sin(time/38+x)*1.5;
    pixelLine(c,x-2,y-3,x+12,y-3,'#89958a',2);
    polygon(c,[[x,y],[x+10,y],[x+11+bend,y+height],[x+6+bend,y+height-4],[x+1+bend,y+height]],'#658682');
    pixelLine(c,x+2,y+2,x+3+bend,y+height-4,'#8da397');
    box(c,x+5,y+6,2,6,'#b1b599');
}

function finalGate(c: CanvasRenderingContext2D, base: number, time: number, phase: number) {
    const top=base-92;
    box(c,0,top+21,320,71,'#879388');
    for(let i=0;i<6;i++){
        const x=i*58-8;arch(c,x,top+31,35,61,'#a0a394');arch(c,x+4,top+36,27,56,'#768b85');
        box(c,x+16,top+44,2,42,'#889b8e');
    }
    arch(c,106,top+5,108,87,'#a6aa98');arch(c,113,top+11,94,81,'#6d8580');
    arch(c,121,top+18,78,74,'#57767a');
    for(let xx=127;xx<199;xx+=9){box(c,xx,top+37,2,55,'#74918b');box(c,xx+1,top+37,1,55,'#8c9d90');}
    box(c,126,base-30,68,2,'#87998c');box(c,126,base-9,68,2,'#87998c');
    for(const d of [-1,1]){
        const x=160+d*58-7;
        box(c,x,top+16,14,76,'#a8aa96');box(c,x+2,top+17,3,73,'#beb79c');
        for(let yy=top+22;yy<base;yy+=12)box(c,x+1,yy,12,1,'#87978a');
        box(c,x-4,top+11,22,6,'#bbb59c');box(c,x-3,top+11,20,1,'#d0c1a0');
        pennant(c,x-28*d,top+27,time,31);
    }
    polygon(c,[[101,top+12],[160,top-6],[219,top+12]],'#7a8e85');
    polygon(c,[[111,top+10],[160,top-2],[209,top+10]],'#b9b59c');
    oval(c,153,top+1,14,13,'#8c9a88');oval(c,157,top+4,6,7,'#c0bb9b');
    if(phase>=2){
        for(const [x,y] of [[109,top+37],[204,top+28],[56,base-17]]){
            pixelLine(c,x,y,x-4,y+7,'#6e817b');pixelLine(c,x-4,y+7,x+1,y+13,'#6e817b');
        }
    }
    if(phase>=3){
        polygon(c,[[186,base],[192,base-8],[200,base-4],[207,base]],'#879285');
        polygon(c,[[93,base],[99,base-6],[107,base]],'#a2a68f');
    }
}

/** Soft background edges; the ivory edge is reserved for actual walkable surfaces. */
export function drawHypotheticalScenery(c: CanvasRenderingContext2D, b: HypotheticalModel, cx: number, cy: number, reduced: boolean) {
    const time=reduced?0:b.tick, lift=(64-cy)*.2,base=HYPOTHETICAL.floor-cy-8;
    box(c,0,0,320,180,'#b4c0b0');box(c,0,0,320,57,'#6d939f');box(c,0,57,320,25,'#8faab0');box(c,0,82,320,23,'#c4c3ac');
    oval(c,242-Math.round(cx*.025),43+lift,25,25,'#f0d1a0');
    for(let i=0;i<4;i++){
        const x=mod(i*107-Math.round(cx*.05)+Math.floor(time/100),430)-45,y=44+i%2*24+lift;
        box(c,x,y,37,2,'#c3c7b5');box(c,x+8,y-2,21,2,'#c3c7b5');box(c,x+22,y+2,25,1,'#c3c7b5');
    }
    // Far skyline is indexed in world space: no facade swaps when the camera crosses a repeat.
    const far=cx*.11;
    for(let i=Math.floor(far/53)-1;i<Math.ceil((far+320)/53);i++){
        const x=i*53-Math.round(far),h=19+mod(i,3)*7,y=112+lift;
        box(c,x,y-h,39,h,'#91a7a2');box(c,x+4,y-h-3,31,3,'#a9b8ab');
        if(mod(i,4)===0){box(c,x+14,y-h-16,11,17,'#91a7a2');polygon(c,[[x+11,y-h-16],[x+20,y-h-23],[x+28,y-h-16]],'#9eafa7');}
        for(let xx=5;xx<34;xx+=10)box(c,x+xx,y-h+8,4,8,'#a9b7a9');
    }
    box(c,0,112+lift,320,68,S.sea);box(c,0,112+lift,320,7,'#6d9794');
    for(let row=0;row<10;row++)for(let i=0;i<7;i++){
        const xx=mod(i*53+row*19-Math.round(cx*.17)+Math.floor(time/(21+row)),365)-25,yy=121+lift+row*7;
        box(c,xx,yy,6+mod(i+row,4)*5,1,row%3===0?'#92b4a3':row%2?'#4d8390':'#63968f');
    }
    // The far quay has arches whose piers terminate in the canal.
    const quay=cx*.23;
    for(let i=Math.floor(quay/68)-1;i<Math.ceil((quay+320)/68);i++){
        const x=i*68-Math.round(quay),y=109+lift;
        box(c,x,y,68,27,'#8d9d91');arch(c,x+9,y+6,49,24,'#588782');
        box(c,x,y,68,3,'#afb49d');box(c,x+1,y+6,5,31,'#a0aa96');
        box(c,x+3,y+32,9,2,'#7da091');
    }
    if(b.act==='chase'){
        const middle=cx*.36;
        for(let i=Math.floor(middle/144)-1;i<Math.ceil((middle+320)/144);i++){
            const x=i*144-Math.round(middle);
            facade(c,x+6,base-15,63,51+mod(i,2)*14,mod(i,3));
            foliage(c,x+111,base-15,time);
            // Rope bollards belong to the distant quay, well above the bridge's voids.
            box(c,x+83,base-22,3,7,'#6e8e81');box(c,x+131,base-22,3,7,'#6e8e81');
            pixelLine(c,x+84,base-20,x+108,base-17,'#92a390');pixelLine(c,x+108,base-17,x+132,base-20,'#92a390');
        }
        // Nothing spans the foreground gaps: water remains visible through the missing deck.
        if(cx>1080){
            // This gateway is tied to the chase's destination, not the repeating parallax street.
            const x=HYPOTHETICAL.chaseEnd-cx-49,top=base-76;
            arch(c,x,top,98,76,'#b2ae95');arch(c,x+7,top+7,84,69,'#7f9588');
            arch(c,x+14,top+14,70,62,'#567980');
            for(const px of [x+2,x+83]){
                box(c,px,top+25,13,51,'#9ca58f');box(c,px+2,top+27,2,48,'#c2b99a');
                box(c,px-3,top+22,19,4,'#c2b99a');
            }
            box(c,x+21,base-7,56,7,'#81998b');
            polygon(c,[[x+43,top+21],[x+56,top+21],[x+56,top+35],[x+50,top+39],[x+43,top+35]],'#72998d');
            pixelLine(c,x+47,top+26,x+52,top+29,'#d4c49c');pixelLine(c,x+52,top+29,x+47,top+32,'#d4c49c');
        }
    }else if(b.act==='siege'){
        for(const [i,s] of SIEGE_SECTORS.entries()){
            const x=s.origin-cx;
            if(x>340||x+416<-20)continue;
            facade(c,x+24,base-5,57,56+i%2*15,i,b.destroyed>i);
            facade(c,x+184,base-5,76,66+i*6,(i+1)%3);
            box(c,x,base-4,416,9,'#788c82');box(c,x,base+5,416,3,'#a3ab90');
            for(let j=0;j<11;j++)box(c,x+j*36+mod(j,2)*9,base+1,19,1,'#91a18e');
            pennant(c,x+9,base-64,time);pennant(c,x+300,base-61,time,34);
            if(i===0){
                // Guardhouse clock and a hanging checkpoint lamp identify the first approach.
                box(c,x+104,base-74,36,74,'#8b9c8c');box(c,x+100,base-79,44,5,'#b2b69b');
                oval(c,x+113,base-67,18,18,'#667f78');oval(c,x+116,base-64,12,12,'#b8b99e');
                pixelLine(c,x+122,base-62,x+122,base-58,'#6a827b');pixelLine(c,x+122,base-58,x+126,base-56,'#6a827b');
                arch(c,x+112,base-41,20,37,'#5e7e77');box(c,x+120,base-34,3,29,'#93a18c');
            }else if(i===1){
                // Loading crane, rope, pulley and suspended pallet share one anchored structure.
                const sway=reduced?0:Math.sin(time/80)*2;
                box(c,x+141,base-95,7,91,'#6d847a');box(c,x+142,base-94,2,89,'#a1aa90');
                pixelLine(c,x+145,base-91,x+222,base-105,'#617e77',5);
                pixelLine(c,x+146,base-59,x+188,base-98,'#7f9281',3);
                pixelLine(c,x+146,base-91,x+222,base-105,'#b4b59a');
                oval(c,x+218,base-107,7,7,'#647c72');oval(c,x+220,base-105,3,3,'#c0b99a');
                pixelLine(c,x+222,base-100,x+222+sway,base-63,'#657f76');
                pixelLine(c,x+222+sway,base-63,x+207+sway,base-45,'#819886');
                pixelLine(c,x+222+sway,base-63,x+238+sway,base-45,'#819886');
                box(c,x+206+sway,base-45,34,4,'#718679');box(c,x+210+sway,base-59,26,14,'#9c9e7d');
                for(const dx of [214,229])box(c,x+dx+sway,base-59,2,14,'#6b8278');
            }else{
                // The arsenal has reinforced doors, vent stacks and pressure pipes.
                box(c,x+94,base-91,64,87,'#7c9186');box(c,x+89,base-94,74,5,'#adb29a');
                for(const xx of [104,136]){box(c,x+xx,base-110,8,20,'#6d8580');box(c,x+xx-2,base-112,12,3,'#abb299');}
                for(let j=0;j<5;j++){
                    box(c,x+101,base-82+j*7,50,3,'#607e77');box(c,x+102,base-82+j*7,48,1,'#9aa991');
                }
                pixelLine(c,x+96,base-30,x+157,base-30,'#5c7f7a',5);pixelLine(c,x+96,base-30,x+157,base-30,'#a0ad96');
                if(!reduced)for(let j=0;j<3;j++){
                    const t=(time+j*24)%90;box(c,x+109+t*.06,base-112-t*.22,5+t*.06,2,'#b5bfb0');
                }
            }
            // A rope fence sits behind the playable road, never impersonating a solid platform.
            for(let j=0;j<5;j++){
                const px=x+280+j*25;box(c,px,base-17,3,17,'#728c7e');
                if(j<4){pixelLine(c,px+1,base-12,px+13,base-8,'#9cab92');pixelLine(c,px+13,base-8,px+26,base-12,'#9cab92');}
            }
        }
    }else{
        finalGate(c,base+3,time,b.phaseNumber);
        box(c,0,base+2,320,9,'#526f70');box(c,0,base+11,320,2,'#8fa18c');
    }
}

export function drawHypotheticalDestruction(c: CanvasRenderingContext2D, b: HypotheticalModel, base: number, reduced: boolean) {
    if(b.backgroundStamp<=0)return;
    const age=32-b.backgroundStamp,x=24+(SIEGE_SECTORS[b.destroyed-1]?.origin??0),drop=age*age*.035;
    // Fragments retain the roof's tile material and converge on their own street.
    for(let i=0;i<5;i++){
        const xx=x+i*11+(i-2)*age*.12,yy=Math.min(base-6,base-60+drop+age*i*.22);
        polygon(c,[[xx,yy],[xx+10,yy+i%2*3],[xx+9,yy+4],[xx-1,yy+3]],'#8c716b');
        pixelLine(c,xx+1,yy+1,xx+7,yy+2,'#bd947b');
    }
    for(let i=0;i<(reduced?3:7);i++){
        const xx=x-2+i*8,yy=base-7-age*.18-i%3*3;
        oval(c,xx,yy,12+age*.12,7,'#b2ac95');box(c,xx+4,yy+2,6,1,'#c5b79c');
    }
}

function timberStep(c: CanvasRenderingContext2D, x: number, y: number, col: number) {
    box(c,x,y,16,16,S.ink);box(c,x+1,y+2,14,13,S.wood);
    for(let j=0;j<3;j++){box(c,x+2,y+3+j*4,12,1,S.woodLight);box(c,x+3,y+5+j*4,10,1,S.woodShade);}
    const band=col%2?12:1;box(c,x+band,y+1,3,14,S.iron);box(c,x+band,y+2,2,1,S.cap);box(c,x+band,y+12,2,1,S.cap);
    box(c,x,y,16,1,S.edge);box(c,x+1,y+1,14,1,S.cap);
}

/** Terrain paint samples the surviving tile mask, including the collapsing chase bridge. */
export function drawHypotheticalMasonry(c: CanvasRenderingContext2D, level: WorldLevel, b: HypotheticalModel, cx: number, cy: number) {
    const tiles=level.data.tiles,left=Math.max(0,Math.floor(cx/16)),right=Math.min(level.data.width,Math.ceil((cx+320)/16));
    const solid=(col:number,row:number)=>Boolean(tiles[row]?.[col]);
    for(let row=0;row<level.data.height;row++)for(let col=left;col<right;col++){
        if(!solid(col,row))continue;
        const x=col*16-cx,y=row*16-cy;
        if(b.act==='chase'&&row===13){timberStep(c,x,y,col);continue;}
        box(c,x,y,16,16,S.stoneShade);
        const seam=mod(col+Math.floor(row/2),2)===0;
        box(c,x+(seam?1:0),y+1,seam?15:16,13,mod(Math.floor(col/2)+row,3)===0?S.stoneLight:S.stone);
        box(c,x,y+14,16,2,S.joint);if(seam)box(c,x,y+1,1,13,S.joint);
        box(c,x+(seam?2:0),y+2,seam?14:16,1,'#a0ada0');
        if(!solid(col,row-1)){
            box(c,x,y,16,4,S.cap);box(c,x,y,16,1,S.edge);box(c,x,y+4,16,2,S.ink);
            if(col%2===0)box(c,x+2,y+1,1,2,'#9f987c');
        }
        if(!solid(col-1,row)){box(c,x,y+5,2,11,S.edge);box(c,x+2,y+7,2,7,S.stoneShade);}
        if(!solid(col+1,row)){box(c,x+14,y+4,2,12,S.ink);box(c,x+12,y+8,2,5,S.stoneLight);}
        if(mod(col*7+row*3,9)===0){pixelLine(c,x+7,y+6,x+10,y+10,S.stoneShade);box(c,x+4,y+10,3,1,S.stoneLight);}
    }
    if(b.act==='chase'){
        for(const [from,to] of CHASE_GAPS){
            for(const col of [from-1,to]){
                if(!solid(col,14))continue;
                const x=col*16-cx,y=224-cy;
                // Inlaid edge marks stay on the solid bank; they cannot bridge the hole.
                box(c,x+3,y+1,9,2,'#98734f');box(c,x+5,y+1,4,1,S.edge);
            }
        }
        for(const x of [490,910,1392]){
            if(!solid(Math.floor(x/16),14))continue;
            box(c,x-cx,201-cy,2,23,S.woodShade);box(c,x-5-cx,195-cy,17,10,S.ink);
            box(c,x-4-cx,196-cy,15,7,S.cap);
            pixelLine(c,x+1-cx,198-cy,x+5-cx,200-cy,S.ink);pixelLine(c,x+5-cx,200-cy,x+1-cx,202-cy,S.ink);
        }
    }else if(b.act==='duel'){
        // Small sockets explain the winch cable's attachment, without implying extra platforms.
        for(const x of [53,263]){box(c,x-cx,224-cy,5,3,S.ink);box(c,x+1-cx,224-cy,3,1,S.ironLight);}
    }
}

function terrace(c: CanvasRenderingContext2D, p: MovingBody, cx: number, cy: number) {
    const x=p.x-cx,y=p.y-cy,w=p.width;
    for(const px of [x+5,x+w-9]){
        box(c,px,y+7,4,224-p.y-7,S.woodShade);box(c,px+1,y+8,1,224-p.y-8,S.woodLight);
        pixelLine(c,px+2,y+20,px+(px===x+5?15:-11),y+8,S.woodShade,3);
        box(c,px+1,y+10,2,2,S.cap);
    }
    box(c,x,y,w,7,S.ink);box(c,x,y,w,2,S.edge);box(c,x+1,y+2,w-2,3,S.wood);
    for(let xx=5;xx<w-2;xx+=9){box(c,x+xx,y+2,1,3,S.woodShade);box(c,x+xx-2,y+3,1,1,S.cap);}
    box(c,x+2,y+5,w-4,1,S.woodLight);
}

function balcony(c: CanvasRenderingContext2D, p: MovingBody, cx: number, cy: number) {
    const x=p.x-cx,y=p.y-cy,w=p.width,index=ARENA_BALCONIES.findIndex(a=>a.id===p.id),column=ARENA_COLUMNS[index];
    if(!column)return;
    // This exact pillar rectangle is also the bullet blocker. No decorative extension poses as cover.
    const px=column.x-cx,py=column.y-cy;
    box(c,px,py,column.width,column.height,S.ink);box(c,px+2,py+6,column.width-4,column.height-6,S.stone);
    box(c,px+2,py+7,2,column.height-7,S.stoneLight);box(c,px+column.width-3,py+8,1,column.height-8,S.stoneShade);
    for(let yy=py+16;yy<py+column.height;yy+=11)box(c,px+2,yy,column.width-4,1,S.joint);
    // Dark corbels read as structure; only the top lip uses the walkable edge color.
    polygon(c,[[x+3,y+6],[px+2,y+17],[px+2,y+7]],S.iron);
    polygon(c,[[x+w-3,y+6],[px+column.width-2,y+17],[px+column.width-2,y+7]],S.iron);
    box(c,x,y,w,7,S.ink);box(c,x,y,w,1,S.edge);box(c,x+1,y+1,w-2,2,S.cap);
    box(c,x+2,y+4,w-4,2,S.ironLight);
    for(let xx=x+6;xx<x+w-4;xx+=8){box(c,xx,y+4,2,1,S.cap);box(c,xx,y+5,1,1,S.ink);}
    // An inset shield identifies the bullet cover; it is not another switch.
    polygon(c,[[px+3,py+22],[px+9,py+22],[px+8,py+27],[px+6,py+29],[px+4,py+27]],S.cap);
    box(c,px+5,py+23,2,3,S.stoneShade);
}

export function drawHypotheticalFittings(c: CanvasRenderingContext2D, o: WorldObjects, b: HypotheticalModel, cx: number, cy: number) {
    for(const p of o.bodies){
        if(p.x>cx+350||p.x+p.width<cx-30)continue;
        if(p.kind==='support'){if(p.id.startsWith('chase-')||p.id.startsWith('siege-'))terrace(c,p,cx,cy);else balcony(c,p,cx,cy);}
        else if(p.id.startsWith('siege-gate-')){
            const i=Number(p.id.slice(-1)),x=p.x-cx,floor=224-cy,bottom=p.height-cy,top=42-cy;
            const ticks=b.route.gateTicks[i],opening=ticks>0&&ticks<SIEGE_GATE_TICKS,open=p.active;
            // The grille's painted lower edge is exactly the collision body's lower edge.
            for(const px of [x-5,x+18]){
                box(c,px,top,3,floor-top,S.ink);box(c,px+1,top,1,floor-top,S.ironLight);
                for(let yy=top+8;yy<floor;yy+=21){box(c,px-1,yy,5,4,S.iron);box(c,px,yy,1,1,S.cap);}
            }
            if(!open){
                c.save();c.beginPath();c.rect(x,top,16,Math.max(0,bottom-top));c.clip();
                for(let xx=0;xx<16;xx+=5){box(c,x+xx,top,3,bottom-top,S.ink);box(c,x+xx+1,top,1,bottom-top,S.ironLight);}
                for(let yy=bottom-9;yy>top-20;yy-=24){box(c,x,yy,16,4,S.iron);box(c,x+1,yy,14,1,S.cap);}
                c.restore();box(c,x-1,bottom-4,18,4,S.ink);box(c,x,bottom-4,16,1,S.cap);
                if(bottom>top+14){box(c,x+5,bottom-13,6,8,S.ink);box(c,x+6,bottom-12,4,5,opening?'#99d6bd':'#ca9951');}
            }
            box(c,x-8,top-4,34,9,S.ink);box(c,x-7,top-3,32,6,S.iron);box(c,x-6,top-3,30,1,S.cap);
            for(const px of [x-2,x+14]){
                oval(c,px,top-2,5,5,S.cap);box(c,px+2,top,1,1,S.ink);
                const offset=opening?Math.floor(ticks/3)%5:0;
                for(let yy=top+7+offset;yy<floor-29;yy+=5){box(c,px+1,yy,1,3,S.woodLight);}
            }
            // Lock lamps and the route arrow use the same ivory/brass/mint vocabulary as combat.
            box(c,x-17,floor-35,12,18,S.ink);box(c,x-16,floor-34,10,16,S.iron);
            for(let j=0;j<3;j++)box(c,x-13,floor-31+j*4,4,2,i<b.route.cleared?'#99d6bd':'#ca9951');
            box(c,x+27,floor-27,2,27,S.woodShade);box(c,x+22,floor-29,17,11,S.ink);box(c,x+23,floor-28,15,9,S.cap);
            pixelLine(c,x+28,floor-26,x+33,floor-24,S.ink);pixelLine(c,x+33,floor-24,x+28,floor-21,S.ink);
            if(opening)for(let j=0;j<3;j++){
                const t=(ticks+j*13)%25;box(c,x-4+j*10+(j-1)*t*.12,floor-3-t*.3,2,1,S.cap);
            }
        }
        else if(p.kind==='switch'){
            const side=p.id.endsWith('right')?1:0,armed=b.armed[side]>0,x=p.x-cx,y=p.y-cy,press=armed?3:0;
            const cableX=(side?263:56)-cx,floor=HYPOTHETICAL.floor-cy;
            pixelLine(c,x+p.width/2,y+9,cableX,floor-2,S.ink,3);pixelLine(c,x+p.width/2,y+9,cableX,floor-2,S.cap);
            box(c,x-2,y+5,p.width+4,5,S.ink);box(c,x,y+6,p.width,3,S.iron);
            for(const xx of [x+1,x+p.width-4]){box(c,xx,y+6,3,2,S.cap);box(c,xx+1,y+6,1,1,S.edge);}
            box(c,x+6,y+1,8,7,S.ink);box(c,x+8,y+1,3,6,S.ironLight);
            box(c,x+3,y-2+press,p.width-6,5,S.ink);box(c,x+4,y-2+press,p.width-8,3,armed?'#99e0cf':'#ffb267');
            box(c,x+5,y-2+press,p.width-10,1,S.edge);
            for(let i=0;i<3;i++)box(c,x+6+i*3,y+press,1,1,S.woodShade);
            if(armed){
                pixelLine(c,(side?220:94)-cx,floor-1,cableX,floor-16,'#244d52',3);
                pixelLine(c,(side?220:94)-cx,floor-1,cableX,floor-16,'#99e0cf');
                // Timer lamps stay inside the floor instead of disappearing below the viewport.
                for(let i=0;i<4;i++)box(c,x+2+i*4,y+6,2,2,b.armed[side]>i*60?'#99e0cf':S.ink);
            }
        }
    }
}
