import { box, oval, pixelLine, polygon } from '../WorldPainting';
import type { WorldLevel, WorldObjects, MovingBody } from '../WorldPhysics';
import { HYPOTHETICAL, type HypotheticalModel } from './HypotheticalModel';
import { ARENA_BALCONIES, ARENA_COLUMNS, CHASE_GAPS } from './HypotheticalLayout';
import { SIEGE_SECTORS, SIEGE_WIDTH, SIEGE_UNLOCK_TICKS, SIEGE_LOCK_TICKS } from './HypotheticalSiege';
import { DESTRUCTION_SITES, ruinAge, rubbleApproach } from './HypotheticalDevastation';
import { backdropBaseline } from './HypotheticalBackdrop';
import {drawChaseLandmarks,drawChaseTerrace} from './HypotheticalChaseArt';
import {chaseCollapsedEdge} from './HypotheticalChaseDetails';
import {CHASE_QUAYS,chaseQuayX,chaseQuayBase,chaseWindAt} from './HypotheticalChaseLife';
import {drawChaseIndustry,drawChaseQuayLife,drawChaseSkiffs} from './HypotheticalChaseLifeArt';
import {drawChaseQuayGround,drawChaseFrontage,drawChaseShoreWater} from './HypotheticalChaseQuayArt';
import {drawChaseDressing,drawChaseHarbor} from './HypotheticalChaseDressing';
import {drawArrivalCourtyard,drawArrivalPlaza,drawArrivalFittings} from './HypotheticalArrivalArt';
import {drawForecourt} from './HypotheticalForecourt';
import {masonryFall,SCENIC_FRACTURE,scenicRecoil,craneLoad,bastionCloth,arsenalPressure,scenicChip} from './HypotheticalScenicMotion';
import {drawSiegeDistricts,drawSiegeRouteBody} from './HypotheticalDistrictArt';
import {drawBastionTower} from './HypotheticalTowerArt';
import {arrivalStoryTime} from './HypotheticalHelicopterTiming';

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

function foliage(c: CanvasRenderingContext2D, x: number, base: number, time: number, phase=x,wind?:number) {
    const top=base-47, sway=wind??Math.sin(time/57+phase)*1.4;
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

function siegeFacade(c:CanvasRenderingContext2D,x:number,base:number,index:number,age:number,reduced:boolean){
    const site=DESTRUCTION_SITES[index],w=site.width,h=site.height,top=base-h;
    const intact=()=>{
        facade(c,x,base,w,h,site.variant);
        // Recessed lintels, a stone doorstep and contact shadows ground the elevation.
        box(c,x+5,top+5,w-10,1,'#827b70');box(c,x+4,base-4,w-8,1,'#596f6c');
        box(c,x+w/2-14,base-2,28,2,'#a9ab91');
        for(const xx of [x+2,x+w-7])for(let yy=base-16;yy<base-4;yy+=6){
            box(c,xx,yy,5,4,'#879486');box(c,xx,yy,4,1,'#b7b396');
        }
        if(site.kind==='ram'){
            pixelLine(c,x+12,base-33,x+12,base-43,'#718477');box(c,x+9,base-44,11,7,'#879c8a');
            box(c,x+11,base-42,7,1,'#c4b99b');box(c,x+14,base-40,2,2,'#c4b99b');
        }else if(site.kind==='bite'){
            box(c,x+7,base-24,w-14,4,'#798c7d');
            for(let j=0;j<4;j++){box(c,x+10+j*14,base-27,2,9,'#889783');pixelLine(c,x+10+j*14,base-18,x+16+j*14,base-24,'#8a927c');}
        }else{
            for(const xx of [x+7,x+w-11]){box(c,xx,top+8,4,h-11,'#7b8c80');for(let y=top+12;y<base-4;y+=9)box(c,xx+1,y,1,1,'#bec0a3');}
            pixelLine(c,x+9,base-12,x+w-15,base-12,'#6a857d',4);pixelLine(c,x+9,base-13,x+w-15,base-13,'#a8b39b');
            oval(c,x+w-22,base-19,12,12,'#627f78');oval(c,x+w-20,base-17,8,8,'#a2ac90');
            pixelLine(c,x+w-16,base-16,x+w-16,base-10,'#6a857d');pixelLine(c,x+w-19,base-13,x+w-13,base-13,'#6a857d');
        }
    };
    if(age<0){intact();return;}
    if(age<SCENIC_FRACTURE){
        // All five contacts read before collapse. Only the struck building shudders.
        const shake=reduced?0:Math.round(masonryFall(index,0,age).shake);
        c.save();c.translate(shake,0);intact();const spread=(age+1)/SCENIC_FRACTURE;
        pixelLine(c,x+38,base-27,x+38-18*spread,base-27-23*spread,'#586b65',2);
        pixelLine(c,x+38,base-27,x+38+21*spread,base-27-31*spread,'#586b65');
        pixelLine(c,x+38,base-27,x+48*spread,base-8,'#697268');
        if(age<3)box(c,x+34,base-30,5-age,2,'#dbc7a2');
        c.restore();
        return;
    }
    // The surviving rear wall and rafters are visible through the new silhouette.
    polygon(c,[[x+12,base-6],[x+12,top+24],[x+19,top+29],[x+29,top+24],
        [x+43,top+39],[x+w-14,top+32],[x+w-12,base-6]],'#536d68');
    pixelLine(c,x+17,base-7,x+17,top+29,'#7f7a64',3);
    pixelLine(c,x+w-19,base-9,x+w-24,top+36,'#8c8068',3);
    pixelLine(c,x+17,top+30,x+42,top+40,'#b1a184',2);
    box(c,x+24,base-31,18,23,'#435e5d');
    facade(c,x,base,w,h,site.variant,true);
    // The exposed core keeps its beams, brick courses and broken services after the dust clears.
    box(c,x+18,base-19,25,16,'#748276');box(c,x+21,base-17,18,13,'#62776f');
    for(let row=0;row<3;row++)for(let j=0;j<3;j++){
        const xx=x+3+j*8+row%2*4;box(c,xx,base-9-row*5,6,3,'#ac9176');box(c,xx,base-9-row*5,5,1,'#c2a689');
    }
    pixelLine(c,x+44,base-4,x+52,base-27,site.kind==='stamp'?'#6b827c':'#827765',3);
    pixelLine(c,x+51,base-27,x+57,base-30,'#b3a58a');
    if(site.kind==='bite')pixelLine(c,x+30,base-7,x+64,base-17,'#b09c7d',3);
    if(site.kind==='stamp'){pixelLine(c,x+10,base-11,x+30,base-11,'#91a38f',3);pixelLine(c,x+30,base-11,x+33,base-16,'#6c857e',3);}
    // Irregular wall panels and two roof halves keep their actual texture. Their
    // different delays and weights replace the previous simultaneous vertical strips.
    const seam=h*.58,panels=[
        [[-4,-12],[w*.5,-12],[w*.45,3],[-4,3]],
        [[w*.5,-12],[w+3,-12],[w+3,3],[w*.45,3]],
        [[0,3],[w*.36,3],[w*.34,seam*.62],[w*.27,seam],[0,seam]],
        [[w*.36,3],[w*.45,3],[w*.72,3],[w*.68,seam],[w*.27,seam],[w*.34,seam*.62]],
        [[w*.72,3],[w,3],[w,seam],[w*.68,seam]],
    ];
    for(let i=0;i<panels.length;i++){
        const fall=masonryFall(index,i,age);
        if(!fall.landed){
            c.save();c.beginPath();c.rect(x-30,top-16,w+60,h+16);c.clip();
            c.translate(Math.round(fall.dx),Math.round(fall.dy));c.beginPath();
            for(const [j,p] of panels[i].entries()){
                if(j===0)c.moveTo(Math.round(x+p[0]),Math.round(top+p[1]));
                else c.lineTo(Math.round(x+p[0]),Math.round(top+p[1]));
            }
            c.closePath();c.clip();intact();c.restore();
        }else{
            const xx=x+7+i*(w-14)/5+fall.dx*.45,roofPiece=i<2;
            polygon(c,[[xx-5,base-1],[xx-2,base-5-i%2*3],[xx+5,base-8-i%3],
                [xx+12,base-4],[xx+16,base-1]],roofPiece?'#827568':'#8d8a75');
            pixelLine(c,xx-2,base-5-i%2*3,xx+5,base-8-i%3,roofPiece?'#c59b7c':'#c1ac88');
            for(let j=0;j<3;j++)box(c,xx+j*4,base-4-j%2*2,3,2,roofPiece?'#a0806c':'#b09b7c');
        }
    }
    if(age<15){
        const spread=Math.min(1,age/8);
        pixelLine(c,x+38,base-27,x+38-18*spread,base-27-23*spread,'#6c756c');
        pixelLine(c,x+38,base-27,x+38+21*spread,base-27-31*spread,'#6c756c');
    }
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
    const time=reduced?0:b.tick, lift=(64-cy)*.2,base=b.act==='siege'?backdropBaseline(cy):HYPOTHETICAL.floor-cy-8;
    box(c,0,0,320,180,'#b4c0b0');box(c,0,0,320,57,'#6d939f');box(c,0,57,320,25,'#8faab0');box(c,0,82,320,23,'#c4c3ac');
    // Leave clear sky between the arriving aircraft and the rider's muzzle.
    const sunX=b.act==='siege'?282:242;
    oval(c,sunX-Math.round(cx*.025),43+lift,25,25,'#f0d1a0');
    for(let i=0;i<4;i++){
        const x=mod(i*107-Math.round(cx*.05)+Math.floor(time/100),430)-45,y=44+i%2*24+lift;
        box(c,x,y,37,2,'#c3c7b5');box(c,x+8,y-2,21,2,'#c3c7b5');box(c,x+22,y+2,25,1,'#c3c7b5');
    }
    // Far skyline is indexed in world space: no facade swaps when the camera crosses a repeat.
    const far=cx*.11;
    for(let i=Math.floor(far/53)-1;i<Math.ceil((far+320)/53);i++){
        const x=i*53-Math.round(far),h=19+mod(i,3)*7,y=112+lift;
        box(c,x,y-h,39,h,'#91a7a2');box(c,x+4,y-h-3,31,3,'#a9b8ab');
        if(mod(i,3)===1){box(c,x+27,y-h-8,4,6,'#91a7a2');box(c,x+26,y-h-9,6,2,'#a9b8ab');}
        if(mod(i,4)===0){box(c,x+14,y-h-16,11,17,'#91a7a2');polygon(c,[[x+11,y-h-16],[x+20,y-h-23],[x+28,y-h-16]],'#9eafa7');}
        for(let xx=5;xx<34;xx+=10)box(c,x+xx,y-h+8,4,8,'#a9b7a9');
    }
    box(c,0,112+lift,320,68,S.sea);box(c,0,112+lift,320,7,'#6d9794');
    for(let row=0;row<10;row++)for(let i=0;i<7;i++){
        const xx=mod(i*53+row*19-Math.round(cx*.17)+Math.floor(time/(21+row)),365)-25,yy=121+lift+row*7;
        box(c,xx,yy,6+mod(i+row,4)*5,1,row%3===0?'#92b4a3':row%2?'#4d8390':'#63968f');
    }
    // A broken, quiet reflection gives the canal depth without resembling a walkable edge.
    for(let row=0;row<6;row++){
        const pulse=reduced?0:Math.sin(time/48+row)*2,x=sunX+6-cx*.025-row*3+pulse,y=122+lift+row*5;
        box(c,x,y,8+row*3,1,'#9aaf98');box(c,x+5+row*2,y+2,5+row,1,'#84a69b');
    }
    // The skyline has its own bank. It cannot support the nearer houses because
    // the two planes move at different speeds.
    const quay=cx*(b.act==='chase'?.11:.23);
    for(let i=Math.floor(quay/68)-1;i<Math.ceil((quay+320)/68);i++){
        const x=i*68-Math.round(quay),y=109+lift;
        if(b.act==='chase'){
            box(c,x,y+1,68,12,'#8d9f92');box(c,x,y+1,68,2,'#a8b29d');
            for(const dx of [11,42]){arch(c,x+dx,y+5,17,8,'#75998e');box(c,x+dx-2,y+6,2,7,'#9cad98');}
            continue;
        }
        box(c,x,y,68,27,'#8d9d91');arch(c,x+9,y+6,49,24,'#588782');
        box(c,x,y,68,3,'#afb49d');box(c,x+1,y+6,5,31,'#a0aa96');
        box(c,x+3,y+32,9,2,'#7da091');
        for(let j=0;j<3;j++)box(c,x+1+j%2,y+24+j*4,3,2,'#758f82');
    }
    if(b.act==='chase'){
        // Architecture, street, foundations and occupants share one projection.
        const quayBase=chaseQuayBase(cy);
        drawChaseHarbor(c,cx,cy,b.tick,reduced);
        drawChaseQuayGround(c,cx,cy);
        for(const [i,site]of CHASE_QUAYS.entries()){
            const x=chaseQuayX(site.x,cx);if(x<-155||x>340)continue;
            drawChaseFrontage(c,i,x,quayBase);
            if(site.kind==='quay')facade(c,x+6,quayBase,63,51+mod(i,2)*14,mod(i,3));
            else drawChaseIndustry(c,b,i,x,quayBase,reduced);
            drawChaseDressing(c,b,i,x,quayBase,reduced);
            if([0,2,8].includes(i))foliage(c,x+119,quayBase-2,time,site.x*.03,chaseWindAt(b.tick,site.x,reduced)*1.4);
            if(site.kind==='quay'){
                box(c,x+83,quayBase-7,3,7,'#6e8e81');box(c,x+131,quayBase-7,3,7,'#6e8e81');
                pixelLine(c,x+84,quayBase-5,x+108,quayBase-2,'#92a390');pixelLine(c,x+108,quayBase-2,x+132,quayBase-5,'#92a390');
            }
            drawChaseQuayLife(c,b,i,x,quayBase,reduced);
        }
        drawChaseShoreWater(c,b,cx,cy,reduced);
        drawChaseSkiffs(c,b,cx,cy,reduced);
        // Nothing spans the foreground gaps: water remains visible through the missing deck.
        drawChaseLandmarks(c,b,cx,cy,reduced);
        if(cx>HYPOTHETICAL.chaseEnd-420){
            // This gateway is tied to the chase's destination, not the repeating parallax street.
            const x=HYPOTHETICAL.chaseEnd-cx-49,gateBase=HYPOTHETICAL.floor-cy,top=gateBase-84;
            arch(c,x,top,98,84,'#b2ae95');arch(c,x+7,top+7,84,77,'#7f9588');
            arch(c,x+14,top+14,70,70,'#567980');
            for(const px of [x+2,x+83]){
                box(c,px,top+25,13,59,'#9ca58f');box(c,px+2,top+27,2,56,'#c2b99a');
                box(c,px-3,top+22,19,4,'#c2b99a');
                box(c,px-2,gateBase-5,17,5,'#839b88');box(c,px-2,gateBase-5,17,1,'#a9ae91');
            }
            box(c,x+21,gateBase-7,56,7,'#81998b');
            polygon(c,[[x+43,top+21],[x+56,top+21],[x+56,top+35],[x+50,top+39],[x+43,top+35]],'#72998d');
            pixelLine(c,x+47,top+26,x+52,top+29,'#d4c49c');pixelLine(c,x+52,top+29,x+47,top+32,'#d4c49c');
        }
    }else if(b.act==='siege'){
        for(const [i,s] of SIEGE_SECTORS.entries()){
            const x=s.origin-cx,width=(SIEGE_SECTORS[i+1]?.origin??SIEGE_WIDTH)-s.origin,siteIndex=i===0?0:i+1;
            if(x>340||x+width<-20)continue;
            const damageAge=ruinAge(b.backdrop.breaches,siteIndex,b.backdrop.tick);
            facade(c,x+24,base-5,57,56+i%2*15,i);
            siegeFacade(c,x+184,base-5,siteIndex,damageAge,reduced);
            if(i===0)siegeFacade(c,x+440,base-5,1,ruinAge(b.backdrop.breaches,1,b.backdrop.tick),reduced);
            // The raised rear street is supported all the way to the canal, behind Feka's road.
            box(c,x,base+7,width,43,'#607d7b');box(c,x,base+8,width,2,'#526f72');
            for(let row=0;row<4;row++)for(let j=0;j<Math.ceil(width/34);j++){
                const sx=x+j*34+(row%2?17:0),yy=base+12+row*9;
                box(c,sx,yy,30,1,'#80958a');box(c,sx,yy+1,1,6,'#526f72');
            }
            for(const dx of (i===0?[42,174,338,506,630]:[42,174,338])){
                arch(c,x+dx,base+14,14,32,'#476970');arch(c,x+dx+3,base+17,8,29,'#3e626c');
                box(c,x+dx-2,base+44,18,2,'#82968a');
            }
            box(c,x,base-4,width,9,'#788c82');box(c,x,base+5,width,3,'#a3ab90');
            for(let j=0;j<Math.floor(width/36);j++)box(c,x+j*36+mod(j,2)*9,base+1,19,1,'#91a18e');
            pennant(c,x+9,base-64,time);pennant(c,x+300,base-61,time,34);
            if(i===0){
                // Guardhouse clock and a hanging checkpoint lamp identify the first approach.
                box(c,x+104,base-74,36,74,'#8b9c8c');box(c,x+100,base-79,44,5,'#b2b69b');
                oval(c,x+113,base-67,18,18,'#667f78');oval(c,x+116,base-64,12,12,'#b8b99e');
                pixelLine(c,x+122,base-62,x+122,base-58,'#6a827b');pixelLine(c,x+122,base-58,x+126,base-56,'#6a827b');
                arch(c,x+112,base-41,20,37,'#5e7e77');
                drawArrivalCourtyard(c,x,base,b.backdrop.tick,damageAge);
                drawArrivalPlaza(c,x,base,arrivalStoryTime(b.backdrop.tick),ruinAge(b.backdrop.breaches,1,b.backdrop.tick),reduced);
            }else if(i===1){
                // Loading crane, rope, pulley and suspended pallet share one anchored structure.
                const load=craneLoad(damageAge),drop=load.drop;
                const sway=reduced?0:(!load.broken?Math.sin(time/80)*2:0)+load.sway;
                box(c,x+141,base-95,7,91,'#6d847a');box(c,x+142,base-94,2,89,'#a1aa90');
                pixelLine(c,x+145,base-91,x+222,base-105,'#617e77',5);
                pixelLine(c,x+146,base-59,x+188,base-98,'#7f9281',3);
                pixelLine(c,x+146,base-91,x+222,base-105,'#b4b59a');
                oval(c,x+218,base-107,7,7,'#647c72');oval(c,x+220,base-105,3,3,'#c0b99a');
                const whip=reduced?0:scenicRecoil(damageAge,load.release,8,4,24);
                const ropeY=base-63-load.ropeLift;
                pixelLine(c,x+222,base-100,x+222+(load.broken?whip:sway),ropeY,'#657f76');
                if(!load.broken){
                    pixelLine(c,x+222+sway,base-63,x+207+sway,base-45,'#819886');
                    pixelLine(c,x+222+sway,base-63,x+238+sway,base-45,'#819886');
                }else{
                    pixelLine(c,x+222+whip,ropeY,x+220+whip*.6,ropeY+7,'#a4af95');
                    // The sling stays with the cargo while the severed upper rope recoils.
                    pixelLine(c,x+222+sway,base-63+drop,x+207+sway,base-45+drop,'#81907b');
                    pixelLine(c,x+222+sway,base-63+drop,x+238+sway,base-45+drop,'#81907b');
                }
                const loadX=x+sway,split=load.split;
                box(c,loadX+206,base-45+drop,34,4,'#657d73');
                for(let j=0;j<3;j++){
                    const px=loadX+209+j*10+(j-1)*split*7,py=base-58+drop+j%2*split*3;
                    box(c,px,py,10,13,'#a39e7d');box(c,px,py,9,1,'#c0b392');
                    box(c,px+2,py+3,6,1,'#85896e');box(c,px+2,py+8,6,1,'#85896e');
                    pixelLine(c,px+1,py+1,px+8,py+11,'#7a826d');
                }
                if(split>0){
                    pixelLine(c,x+210,base-6,x+201-split*10,base-4,'#ac9d7c',2);
                    pixelLine(c,x+232,base-9,x+241+split*10,base-4,'#859079',2);
                }
            }else if(i===3){
                // The last post is a fortified customs yard, with buttresses and
                // a bell tower grounded on the same rear street as its facade.
                drawBastionTower(c,b.backdrop.aftermath.tower,base,cx,reduced,time);
                for(const dx of [278,318,358,398,438]){
                    box(c,x+dx,base-39,8,35,'#7a9185');box(c,x+dx-2,base-42,12,4,'#b1b49a');
                    if(dx<438){arch(c,x+dx+8,base-32,32,28,'#536f70');pixelLine(c,x+dx+8,base-32,x+dx+39,base-32,'#94a78e',2);}
                }
                const cloth=bastionCloth(damageAge),flutter=reduced?0:cloth.swing;
                pixelLine(c,x+268,base-44,x+278,base-46,'#a3ab91');
                pixelLine(c,x+278,base-46,x+302+flutter,base-49+cloth.drop,'#a3ab91');
                pixelLine(c,x+302+flutter,base-49+cloth.drop,x+320-10*cloth.loose+flutter,
                    base-50+cloth.drop+cloth.loose*4,'#a3ab91');
                if(cloth.loose>0)pixelLine(c,x+320,base-50,x+317,base-47,'#a3ab91');
                polygon(c,[[x+278,base-46],[x+302+flutter,base-49+cloth.drop],
                    [x+300+flutter,base-32+cloth.drop],[x+281,base-30]],'#8f6961');
                pixelLine(c,x+280,base-43,x+299+flutter,base-46+cloth.drop,'#b58b77');
                if(!reduced&&damageAge>36&&damageAge<210)for(let j=0;j<4;j++){
                    const t=damageAge-36-j*22;if(t<0||t>90)continue;
                    const fade=1-t/90;
                    box(c,x+219+t*.24,base-29-t*.3,(9+t*.05)*fade,3*fade,'#a9aea0');
                }
            }else{
                // The arsenal has reinforced doors, vent stacks and pressure pipes.
                box(c,x+94,base-91,64,87,'#7c9186');box(c,x+89,base-94,74,5,'#adb29a');
                for(const xx of [104,136]){box(c,x+xx,base-110,8,20,'#6d8580');box(c,x+xx-2,base-112,12,3,'#abb299');}
                for(let j=0;j<5;j++){
                    box(c,x+101,base-82+j*7,50,3,'#607e77');box(c,x+102,base-82+j*7,48,1,'#9aa991');
                }
                const pressure=arsenalPressure(damageAge);
                for(const [from,to] of (pressure>0?[[96,124],[136,157]]:[[96,157]])){
                    pixelLine(c,x+from,base-30,x+to,base-30,'#5c7f7a',5);pixelLine(c,x+from,base-30,x+to,base-30,'#a0ad96');
                }
                if(!reduced)for(let j=0;j<3;j++){
                    const t=(time+j*24)%90;box(c,x+109+t*.06,base-112-t*.22,5+t*.06,2,'#b5bfb0');
                }
                if(pressure>0){
                    pixelLine(c,x+124,base-30,x+130,base-26,'#617c73',3);
                    box(c,x+127,base-27,3,2,'#3c6266');box(c,x+135,base-31,2,6,'#afaf95');
                    for(let j=0;j<(reduced?2:5);j++){
                        const t=reduced?j*6:(damageAge+j*9)%45;
                        const length=pressure*1.4+.2;
                        box(c,x+130+t*length,base-27-t*.23,4+t*.1,2,'#bac0a9');
                        if(t<16)pixelLine(c,x+130,base-26,x+130+t*length,base-26-t*.23,'#c5c6af');
                    }
                }
            }
            // A rope fence sits behind the playable road, never impersonating a solid platform.
            for(let j=0;j<5;j++){
                if(i===0&&(j===1||j===2))continue;
                const px=x+280+j*25;box(c,px,base-17,3,17,'#728c7e');
                if(j<4&&!(i===0&&j===0)){pixelLine(c,px+1,base-12,px+13,base-8,'#9cab92');pixelLine(c,px+13,base-8,px+26,base-12,'#9cab92');}
            }
        }
    }else{
        finalGate(c,base+3,time,b.phaseNumber);
        box(c,0,base+2,320,9,'#526f70');box(c,0,base+11,320,2,'#8fa18c');
    }
}

/** Scenic fragments belong to their source street even after landing. */
export function drawHypotheticalRubble(c:CanvasRenderingContext2D,b:HypotheticalModel,base:number){
    for(const [index,site] of DESTRUCTION_SITES.entries()){
        const age=ruinAge(b.backdrop.breaches,index,b.backdrop.tick);if(age<0)continue;
        const floor=base-4;
        for(let i=0;i<15;i++){
            const chip=scenicChip(index,i,age);if(!chip.visible)continue;
            const xx=site.x+chip.x,yy=floor+chip.y;
            if(chip.material===3){
                pixelLine(c,xx-2,yy,xx+5,yy+(chip.landed?1:-3),'#887d69',2);
                pixelLine(c,xx-1,yy,xx+4,yy+(chip.landed?1:-3),'#baa487');
            }else{
                const palette=['#a5826d','#a3977c','#748c80'];
                polygon(c,[[xx-1,yy],[xx+2,yy-2],[xx+5,yy],[xx+4,yy+2],[xx,yy+2]],palette[chip.material]);
                box(c,xx+1,yy-1,3,1,'#c4b18e');
            }
        }
    }
}

export function drawHypotheticalDestruction(c: CanvasRenderingContext2D, b: HypotheticalModel, base: number, cy:number, reduced: boolean) {
    for(const [index,site] of DESTRUCTION_SITES.entries()){
        const age=ruinAge(b.backdrop.breaches,index,b.backdrop.tick);if(age<0)continue;
        const x=site.x+site.width/2,floor=base-4;
        if(age<7){
            const hitY=site.kind==='stamp'?floor-7:floor-27;
            for(let i=0;i<(reduced?3:5);i++){
                const angle=-Math.PI*.7+i*Math.PI*.35,r=3+age*1.6;
                pixelLine(c,x+Math.cos(angle)*r,hitY+Math.sin(angle)*r*.5,
                    x+Math.cos(angle)*(r+4),hitY+Math.sin(angle)*(r+4)*.5,'#d5c39d');
            }
        }
        // Contact, wall landing, then roof landing: the dust is caused by weight.
        // It stays low and thins into separate wisps instead of masking the combat.
        const pulses=[0,masonryFall(index,3,0).landAt,masonryFall(index,1,0).landAt];
        for(const [beat,born] of pulses.entries()){
            const ageOfDust=age-born,duration=beat===0?40:64;
            if(ageOfDust<0||ageOfDust>=duration)continue;
            const grow=Math.min(1,(ageOfDust+1)/7),fade=1-ageOfDust/duration;
            for(let i=0;i<(reduced?3:5);i++){
                const side=i-2,xx=x+side*(11+ageOfDust*.25)+beat*3;
                const yy=floor-3-Math.min(ageOfDust,28)*.15-i%2*2;
                const w=(beat===0?10:16)*grow*fade+2;
                box(c,xx+3,yy-3,w-5,3,'#b9b39b');box(c,xx,yy,w,3,'#aba992');
                box(c,xx+2,yy+3,w-3,2,'#939f8a');
                if(ageOfDust<24)box(c,xx+4,yy-2,Math.max(1,w-9),1,'#c6bca0');
            }
        }
        if(index===2){
            const t=age-craneLoad(0).land;
            if(t>=0&&t<28)for(const side of [-1,1]){
                const xx=site.x+38+side*(18+t*.6),w=10*(1-t/28);
                box(c,xx,floor-4-t*.1,w,2,'#b7af90');
            }
        }
        if(!reduced&&age>12&&age<80)for(let i=0;i<3;i++){
            const t=age-12-i*4;if(t<0)continue;
            const xx=x+(i-1.5)*t*.8,yy=base-site.height-8-t*.4-i*3,flap=Math.sin(t/3+i)>0?2:-1;
            pixelLine(c,xx-2,yy+flap,xx,yy,'#6d8a82');pixelLine(c,xx,yy,xx+2,yy+flap,'#6d8a82');
        }
    }
    // A fragment leaves a ruined structure while its existing one-second floor warning runs.
    // At t=1 it meets the native rubble projectile's actual spawn position (world y=90).
    for(const mark of b.marks){
        const age=b.tick-mark.born;if(age<0||age>=60)continue;
        const sites=DESTRUCTION_SITES.filter((_,i)=>b.backdrop.breaches[i]>=0);if(!sites.length)continue;
        const site=sites.reduce((a,z)=>Math.abs(a.x-mark.x)<Math.abs(z.x-mark.x)?a:z);
        const point=rubbleApproach(site.x+site.width/2,mark.x,age,base+cy),x=point.x,y=point.y-cy;
        polygon(c,[[x-3,y-1],[x+1,y-3],[x+3,y],[x+1,y+3],[x-2,y+2]],'#91a08a');box(c,x-1,y-1,2,1,'#bdbea0');
    }
}

function timberStep(c: CanvasRenderingContext2D, x: number, y: number, col: number) {
    box(c,x,y,16,16,S.ink);box(c,x+1,y+2,14,13,S.wood);
    for(let j=0;j<3;j++){box(c,x+2,y+3+j*4,12,1,S.woodLight);box(c,x+3,y+5+j*4,10,1,S.woodShade);}
    const band=col%2?12:1;box(c,x+band,y+1,3,14,S.iron);box(c,x+band,y+2,2,1,S.cap);box(c,x+band,y+12,2,1,S.cap);
    box(c,x,y,16,1,S.edge);box(c,x+1,y+1,14,1,S.cap);
}

/** Long deck planks and steel plates stay distinct from the raised cargo crates. */
function chaseDeckTile(c:CanvasRenderingContext2D,x:number,y:number,col:number,iron:boolean){
    box(c,x,y,16,16,S.ink);box(c,x+1,y+2,15,7,iron?S.iron:S.wood);
    box(c,x,y,16,1,S.edge);box(c,x,y+1,16,1,S.cap);
    if(iron){
        box(c,x+2,y+3,12,4,'#5e7e83');pixelLine(c,x+4,y+5,x+9,y+5,S.ironLight);
        box(c,x+2,y+3,1,1,S.cap);box(c,x+12,y+6,1,1,S.cap);
        box(c,x+4,y+10,8,2,S.iron);box(c,x+5,y+10,7,1,S.ironLight);
        if(col%3===1){box(c,x+10,y+5,3,1,'#8a8b76');box(c,x+12,y+7,1,2,'#617576');}
        pixelLine(c,x+15,y+3,x+15,y+7,'#304e5c');
    }else{
        const seam=col%2===0;
        if(seam)box(c,x,y+2,1,7,S.woodShade);
        pixelLine(c,x+2,y+3,x+12,y+3,S.woodLight);
        pixelLine(c,x+4+col%3,y+6,x+11,y+6,S.woodShade);
        if(col%4===1){box(c,x+8,y+4,3,2,S.woodShade);box(c,x+9,y+4,1,1,S.woodLight);}
        box(c,x,y+10,16,4,S.woodShade);box(c,x,y+10,16,1,S.wood);
        if(col%3===0){pixelLine(c,x+5,y+12,x+11,y+12,'#79604f');box(c,x+7,y+13,2,1,'#a17a59');}
    }
    if(col%2===0){box(c,x+1,y+7,4,8,S.iron);box(c,x+2,y+8,1,1,S.cap);box(c,x+2,y+13,1,1,S.ironLight);}
    box(c,x,y+15,16,1,S.stoneShade);
}

/** Terrain paint samples the surviving tile mask, including the collapsing chase bridge. */
export function drawHypotheticalMasonry(c: CanvasRenderingContext2D, level: WorldLevel, b: HypotheticalModel, cx: number, cy: number) {
    const tiles=level.data.tiles,left=Math.max(0,Math.floor(cx/16)),right=Math.min(level.data.width,Math.ceil((cx+320)/16));
    const solid=(col:number,row:number)=>Boolean(tiles[row]?.[col]);
    for(let row=0;row<level.data.height;row++)for(let col=left;col<right;col++){
        if(!solid(col,row))continue;
        const x=col*16-cx,y=row*16-cy;
        if(b.act==='chase'&&row===13){timberStep(c,x,y,col);continue;}
        if(b.act==='chase'&&row===14&&col>=70&&col<140){chaseDeckTile(c,x,y,col,false);continue;}
        if(b.act==='chase'&&row===14&&col>=210){
            chaseDeckTile(c,x,y,col,true);continue;
        }
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
        // The remaining bank cracks before it detaches; only surviving native tiles are painted.
        const edge=chaseCollapsedEdge(b.x);
        for(let k=0;k<3;k++){
            const col=edge/16+k;if(!solid(col,14))continue;
            const x=col*16-cx,y=224-cy;
            pixelLine(c,x+4,y+2,x+8,y+4,S.joint);pixelLine(c,x+8,y+4,x+6,y+7-k,S.joint);
        }
        for(const [from,to] of CHASE_GAPS){
            for(const col of [from-1,to]){
                if(!solid(col,14))continue;
                const x=col*16-cx,y=224-cy;
                // Inlaid edge marks stay on the solid bank; they cannot bridge the hole.
                box(c,x+3,y+1,9,2,'#98734f');box(c,x+5,y+1,4,1,S.edge);
            }
        }
        for(const x of CHASE_GAPS.map(([a])=>a*16-80)){
            if(!solid(Math.floor(x/16),14))continue;
            box(c,x-cx,201-cy,2,23,S.woodShade);box(c,x-5-cx,195-cy,17,10,S.ink);
            box(c,x-4-cx,196-cy,15,7,S.cap);
            pixelLine(c,x+1-cx,198-cy,x+5-cx,200-cy,S.ink);pixelLine(c,x+5-cx,200-cy,x+1-cx,202-cy,S.ink);
        }
    }else if(b.act==='duel'){
        // Small sockets explain the winch cable's attachment, without implying extra platforms.
        for(const x of [53,263]){box(c,x-cx,224-cy,5,3,S.ink);box(c,x+1-cx,224-cy,3,1,S.ironLight);}
    }else if(b.act==='siege'){
        // Inlaid drains and worn loading strips remain inside the solid road.
        // Their dark recesses never masquerade as holes in the collision mask.
        for(const [i,s] of SIEGE_SECTORS.entries()){
            const y=224-cy,from=s.origin+26-cx,to=s.gate-cx;
            for(let x=from;x<to-24;x+=i===1?56:80){
                box(c,x,y+8,20,6,S.ink);box(c,x+1,y+9,18,4,S.iron);
                for(let j=0;j<5;j++)box(c,x+3+j*3,y+9,1,4,S.ironLight);
                box(c,x+1,y+8,18,1,S.stoneLight);
            }
            box(c,to-12,y+1,42,3,S.iron);box(c,to-11,y+1,40,1,S.ironLight);
            for(const dx of [-8,24]){box(c,to+dx,y+2,2,1,S.cap);}
            // A low approach marker previews the real number of locks ahead.
            const x=s.trigger-32-cx,cleared=i<b.route.cleared;
            box(c,x,194-cy,3,30,S.woodShade);box(c,x-5,183-cy,29,13,S.ink);
            box(c,x-4,184-cy,27,10,S.iron);box(c,x-3,184-cy,25,1,S.cap);
            for(let j=0;j<s.guards.length;j++){
                const released=j<s.guards.length-b.route.remaining[i];
                box(c,x-1+j*5,187-cy,3,released?2:5,released?'#99d6bd':'#ca9951');
            }
            if(cleared){pixelLine(c,x+16,188-cy,x+19,190-cy,'#99d6bd');pixelLine(c,x+19,190-cy,x+16,192-cy,'#99d6bd');}
        }
    }
}

function terrace(c: CanvasRenderingContext2D, p: MovingBody, cx: number, cy: number) {
    const x=p.x-cx,y=p.y-cy,w=p.width,chase=p.id.startsWith('chase-');
    if(!chase){
        for(const px of [x+5,x+w-9]){
            box(c,px,y+7,4,224-p.y-7,S.woodShade);box(c,px+1,y+8,1,224-p.y-8,S.woodLight);
            pixelLine(c,px+2,y+20,px+(px===x+5?15:-11),y+8,S.woodShade,3);box(c,px+1,y+10,2,2,S.cap);
        }
        box(c,x,y,w,7,S.ink);box(c,x,y,w,2,S.edge);box(c,x+1,y+2,w-2,3,S.wood);
        for(let xx=5;xx<w-2;xx+=9){box(c,x+xx,y+2,1,3,S.woodShade);box(c,x+xx-2,y+3,1,1,S.cap);}
        box(c,x+2,y+5,w-4,1,S.woodLight);return;
    }
    drawChaseTerrace(c,p,cx,cy);
}

/** The same walkable lip, with district-specific joinery below it. Posts are
 * background structure: only the seven-pixel deck is a native one-way body. */
function siegeDeck(c: CanvasRenderingContext2D, p: MovingBody, cx: number, cy: number) {
    const index=p.id.startsWith('siege-link-')?Number(p.id.slice(-1))+1:Number(p.id.split('-')[2]);
    const x=p.x-cx,y=p.y-cy,w=p.width,floor=224-cy;
    if(index===0){
        terrace(c,p,cx,cy);
        for(const px of [x+5,x+w-9]){
            box(c,px-2,floor-7,8,7,S.iron);box(c,px-1,floor-6,6,1,S.ironLight);
            box(c,px+1,floor-3,2,1,S.cap);
            pixelLine(c,px+1,y+24,px+2,floor-11,S.wood);
        }
        return;
    }
    const iron=index>=2;
    for(const px of [x+5,x+w-10]){
        box(c,px,y+7,5,floor-y-7,iron?S.iron:S.woodShade);
        box(c,px+1,y+9,1,floor-y-12,iron?S.ironLight:S.woodLight);
        box(c,px-3,floor-6,11,6,S.stoneShade);box(c,px-2,floor-6,9,1,S.stoneLight);
        for(const yy of [y+12,floor-10]){box(c,px-1,yy,7,3,S.iron);box(c,px+1,yy,2,1,S.cap);}
    }
    const braceY=Math.min(floor-12,y+32);
    pixelLine(c,x+9,braceY,x+w/2,y+8,iron?S.iron:S.woodShade,3);
    pixelLine(c,x+w-7,braceY,x+w/2,y+8,iron?S.iron:S.woodShade,3);
    box(c,x,y,w,7,S.ink);box(c,x,y,w,1,S.edge);box(c,x+1,y+1,w-2,1,S.cap);
    box(c,x+1,y+2,w-2,3,iron?S.iron:S.wood);
    for(let xx=5;xx<w-2;xx+=iron?8:11){
        box(c,x+xx,y+2,1,3,S.ink);box(c,x+xx-2,y+3,1,1,iron?S.ironLight:S.woodLight);
    }
    box(c,x+2,y+5,w-4,1,iron?S.ironLight:S.woodLight);
    for(const px of [x+3,x+w-6]){box(c,px,y+3,3,4,S.iron);box(c,px+1,y+3,1,1,S.cap);}
    if(index===3){
        // Heavy customs-yard steel, with a recessed brace badge. The only bright
        // horizontal edge remains the real walkable surface.
        box(c,x+w/2-5,y+8,10,10,S.ink);box(c,x+w/2-4,y+9,8,8,S.iron);
        pixelLine(c,x+w/2-2,y+11,x+w/2,y+14,'#a5b49f');
        pixelLine(c,x+w/2,y+14,x+w/2+2,y+11,'#a5b49f');
        for(const dx of [12,w-18]){box(c,x+dx,y+4,4,1,'#9c9f86');box(c,x+dx+1,y+4,1,1,S.woodShade);}
    }
    if(!iron&&w>=64){
        // A dark sling under the loading bay explains how it was assembled.
        pixelLine(c,x+8,y+9,x+w-9,y+20,S.woodShade);
        pixelLine(c,x+8,y+10,x+w-9,y+21,S.woodLight);
    }
}

function siegeGate(c: CanvasRenderingContext2D, p: MovingBody, b: HypotheticalModel, cx: number, cy: number) {
    const i=Number(p.id.slice(-1)),sector=SIEGE_SECTORS[i],x=p.x-cx,floor=224-cy,top=42-cy;
    const ticks=b.route.gateTicks[i],phase=b.route.gatePhase(i),height=p.height,bottom=height-cy;
    const travel=224-height,released=sector.guards.length-b.route.remaining[i];
    // The mounting pads, paired rails and exposed counterweight reach the road.
    for(const px of [x-5,x+18]){
        box(c,px-3,floor-6,9,6,S.stoneShade);box(c,px-2,floor-6,7,1,S.stoneLight);
        box(c,px,top,3,floor-top-6,S.ink);box(c,px+1,top,1,floor-top-6,S.ironLight);
        for(let yy=top+8;yy<floor-7;yy+=21){box(c,px-1,yy,5,4,S.iron);box(c,px,yy,1,1,S.cap);}
    }
    box(c,x+25,floor-87,7,71,S.woodShade);box(c,x+27,floor-85,3,67,S.ink);
    const weightY=floor-83+travel*.22;
    pixelLine(c,x+28,top+4,x+28,weightY,S.woodLight);
    box(c,x+24,weightY,9,15,S.ink);box(c,x+25,weightY+1,7,13,S.iron);
    box(c,x+26,weightY+2,2,10,S.ironLight);box(c,x+25,weightY+7,7,2,S.woodShade);
    if(!p.active){
        // All grille pixels agree with the collider, including jumps above the headstock.
        c.save();c.beginPath();c.rect(x,-cy,16,height);c.clip();
        for(let xx=0;xx<16;xx+=5){box(c,x+xx,-cy,3,height,S.ink);box(c,x+xx+1,-cy,1,height,S.ironLight);}
        for(let yy=bottom-9;yy>-cy-20;yy-=24){box(c,x,yy,16,4,S.iron);box(c,x+1,yy,14,1,S.cap);}
        c.restore();box(c,x,bottom-4,16,4,S.ink);box(c,x+1,bottom-4,14,1,S.cap);
    }
    box(c,x-8,top-4,42,9,S.ink);box(c,x-7,top-3,40,6,S.iron);box(c,x-6,top-3,38,1,S.cap);
    for(const px of [x-2,x+24]){oval(c,px,top-2,5,5,S.cap);box(c,px+2,top,1,1,S.ink);}
    // The waist-high drive stays in view. Rotation and chain travel derive
    // from the actual gate displacement, so they stop with the grille.
    const drumX=x-20,drumY=floor-56,settle=phase==='settle'?Math.sin((ticks-64)*2)*(72-ticks)*.02:0;
    box(c,x-29,drumY-6,23,17,S.ink);box(c,x-28,drumY-5,21,14,S.iron);
    box(c,x-27,drumY-5,19,1,S.ironLight);
    pixelLine(c,x-1,top+6,x-8,drumY,S.woodShade,2);
    const chainLength=drumY-top-6,offset=Math.floor(travel)%5;
    for(let yy=offset;yy<chainLength;yy+=5){const xx=x-1-7*yy/chainLength;box(c,xx,top+6+yy,1,3,S.woodLight);}
    oval(c,drumX-6,drumY-6,13,13,S.ink);oval(c,drumX-5,drumY-5,11,11,S.cap);
    oval(c,drumX-3,drumY-3,7,7,S.iron);
    for(let j=0;j<4;j++){
        const angle=travel/8+j*Math.PI/2+settle;
        pixelLine(c,drumX,drumY,drumX+Math.cos(angle)*5,drumY+Math.sin(angle)*5,S.woodLight);
    }
    box(c,drumX,drumY,1,1,S.edge);
    // One captive pin per guard; the sockets remain visible when released.
    const panelY=floor-37;
    box(c,x-32,panelY,25,31,S.ink);box(c,x-31,panelY+1,23,29,S.iron);
    box(c,x-30,panelY+2,21,1,S.ironLight);
    for(let j=0;j<sector.guards.length;j++){
        const py=panelY+5+j*6,u=b.route.lockTicks[i][j]/SIEGE_LOCK_TICKS,shift=Math.round(6*u);
        box(c,x-28,py,16,4,S.ink);
        box(c,x-27-shift,py+1,11,2,j<released?'#99d6bd':'#ca9951');
        box(c,x-15,py+1,2,2,j<released?'#99d6bd':S.woodShade);
    }
    const latchShift=Math.round(7*Math.min(1,ticks/SIEGE_UNLOCK_TICKS));
    box(c,x-8,floor-19,9,5,S.ink);box(c,x-6-latchShift,floor-18,9,3,S.woodLight);
    box(c,x-6-latchShift,floor-18,8,1,S.cap);
    // A settled exit reads differently from the still-locked next post.
    const exitColor=phase==='open'?'#99d6bd':S.cap;
    box(c,x+43,floor-27,2,27,S.woodShade);box(c,x+37,floor-30,18,12,S.ink);box(c,x+38,floor-29,16,10,exitColor);
    pixelLine(c,x+43,floor-27,x+48,floor-24,S.ink);pixelLine(c,x+48,floor-24,x+43,floor-21,S.ink);
    if(phase==='unlock'){
        // A small release puff belongs to the latch, never the entire screen.
        const t=ticks/SIEGE_UNLOCK_TICKS;
        for(let j=0;j<3;j++)box(c,x-6-j*3-t*5,floor-22-j*3-t*5,2,1,S.stoneLight);
    }
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

export function drawHypotheticalFittings(c: CanvasRenderingContext2D, o: WorldObjects, b: HypotheticalModel, cx: number, cy: number, reduced = false) {
    if(b.act==='siege'){
        drawForecourt(c,b,cx,cy);drawArrivalFittings(c,b,cx,cy);
        drawSiegeDistricts(c,b,cx,cy,reduced);
        const yard=SIEGE_SECTORS[3].origin-cx,floor=224-cy;
        // An inset road panel, not an extra platform: it frames the space between
        // the two duelling perches without adding obstruction or a false hazard.
        box(c,yard+132,floor+3,204,7,'#3d5c65');box(c,yard+134,floor+4,200,1,'#7f938b');
        for(const dx of [144,184,224,264,304]){
            box(c,yard+dx,floor+4,1,5,'#253e4d');box(c,yard+dx+1,floor+7,15,1,'#58777a');
        }
        polygon(c,[[yard+231,floor+4],[yard+237,floor+4],[yard+240,floor+7],[yard+235,floor+9],[yard+229,floor+7]],'#9da78e');
    }
    for(const p of o.bodies){
        if(p.x>cx+350||p.x+p.width<cx-30)continue;
        if(b.act==='siege'&&drawSiegeRouteBody(c,p,cx,cy))continue;
        if(p.kind==='support'){
            if(p.id.startsWith('siege-'))siegeDeck(c,p,cx,cy);
            else if(p.id.startsWith('chase-'))terrace(c,p,cx,cy);else balcony(c,p,cx,cy);
        }
        else if(p.id.startsWith('siege-gate-'))siegeGate(c,p,b,cx,cy);
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
