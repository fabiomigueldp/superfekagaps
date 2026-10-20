import {box,oval,pixelLine,polygon} from '../WorldPainting';
import type {HypotheticalModel} from './HypotheticalModel';
import {CHASE_QUAYS,chaseQuayX,chaseQuaySection,chaseQuayReaction,chaseFrontageHeight} from './HypotheticalChaseLife';

const Q={street:'#9ba694',paving:'#a9ad96',joint:'#8a9c8e',shadow:'#7e9488',
    face:'#7c9289',light:'#a2ac95',seam:'#6f8c85',wet:'#638b83',water:'#537f80'};
const mod=(n:number,d:number)=>((n%d)+d)%d;

/** A continuous shore, not independent platforms under each repeating house.
 * All joints and foundations use the same projection as their buildings. */
export function drawChaseQuayGround(c:CanvasRenderingContext2D,cx:number,cy:number){
    const s=chaseQuaySection(cy),origin=chaseQuayX(0,cx);
    box(c,0,s.rear,320,s.edge-s.rear,Q.street);
    box(c,0,s.rear,320,2,'#94a391');
    box(c,0,s.ground,320,5,Q.paving);
    box(c,0,s.edge,320,s.water-s.edge,Q.face);
    box(c,0,s.edge,320,2,Q.light);
    box(c,0,s.edge+2,320,1,Q.seam);
    box(c,0,s.water-3,320,3,Q.wet);
    // Extend the bank past both ends of the authored street. Rounding the shared
    // endpoints avoids a one-pixel water seam on fractional camera positions.
    for(let i=Math.floor(-origin/144)-1;i<=Math.ceil((320-origin)/144);i++){
        const x=Math.round(origin+i*144),end=Math.round(origin+(i+1)*144),width=end-x;
        for(let row=0;row<2;row++){
            const y=s.edge+5+row*5;
            box(c,x,y,width,1,Q.seam);
            for(let j=0;j<5;j++)box(c,x+7+j*29+row*11,y-3,1,3,Q.seam);
        }
        for(const dx of [8,65]){
            box(c,x+dx,s.edge+2,7,s.water-s.edge-2,'#849a8c');
            box(c,x+dx,s.edge+2,2,s.water-s.edge-4,'#95a48f');
            box(c,x+dx-2,s.water-3,11,3,'#6e9184');
        }
        // Damp mortar gathers below real corners and mooring fixtures.
        for(const [dx,w,h]of [[10,6,4],[66,5,3],[127,7,5]]){
            box(c,x+dx,s.water-h,w,h,Q.wet);box(c,x+dx+2,s.water-h,2,2,'#76998a');
        }
        for(const [dx,y,w]of [[3,2,24],[55,3,21],[108,1,16]])box(c,x+dx,s.ground+y,w,1,Q.joint);
        // Small kerb joints belong to the bank; there is no bright playable edge.
        for(const dx of [24,60,96,132])box(c,x+dx,s.edge,1,2,'#8d9f8d');
        const district=CHASE_QUAYS[i]?.kind;
        if(district==='cargo'){
            // A recessed loading stair descends through the retaining wall.
            box(c,x+106,s.edge+1,23,13,'#68867e');
            for(let step=0;step<4;step++){
                const y=s.edge+2+step*3;
                box(c,x+108+step,y,19-step*2,2,'#98a48f');
                box(c,x+109+step,y+2,17-step*2,1,'#7b9586');
            }
            for(const dx of [103,129]){box(c,x+dx,s.ground-5,2,11,Q.seam);box(c,x+dx-1,s.ground-5,4,1,Q.light);}
        }else if(district==='water'){
            // The drain socket lies on the wet wall, below the operating valve.
            box(c,x+89,s.edge,13,9,'#66877f');box(c,x+87,s.edge,17,2,Q.light);
            box(c,x+90,s.edge+2,2,7,'#8ca38e');box(c,x+99,s.edge+2,2,7,'#8ca38e');
        }else if(district==='port'){
            for(const dx of [114,124])box(c,x+dx,s.edge+2,2,14,'#66877e');
            for(let j=0;j<4;j++)box(c,x+114,s.edge+3+j*3,12,1,'#9bad96');
        }else if(mod(i,2)===1){
            // A shallow outlet is built into the masonry, never floating above it.
            box(c,x+111,s.edge+6,11,7,'#5f817b');box(c,x+109,s.edge+4,15,2,'#95a791');
            for(const dx of [113,117,121])box(c,x+dx,s.edge+7,1,5,'#8fa48e');
        }
    }
}

/** Side walls, contact shadows and fixtures make a frontage rather than a sprite
 * pasted over water. Draw before the facade and its inhabitants. */
export function drawChaseFrontage(c:CanvasRenderingContext2D,index:number,x:number,base:number){
    const site=CHASE_QUAYS[index];
    const height=chaseFrontageHeight(index);
    const right=site.kind==='port'?68:site.kind==='quay'?69:72;
    polygon(c,[[x+right,base-height],[x+right+7,base-height+5],[x+right+7,base-2],[x+right,base]],'#7d9487');
    pixelLine(c,x+right+6,base-height+7,x+right+6,base-3,'#8d9f8d');
    polygon(c,[[x+3,base],[x+right+7,base-2],[x+right+14,base+3],[x+7,base+3]],Q.shadow);
    box(c,x+1,base,74,2,'#8c9e8b');box(c,x+25,base,29,2,'#b0b29a');
    // The walking lane remains clear between the service yard and the doorway.
    if(site.kind==='quay'){
        if(index!==1){
            box(c,x+103,base-3,28,5,'#859d87');box(c,x+102,base-4,30,2,'#a6ae91');
            box(c,x+108,base-6,19,2,'#708f7c');
        }
        if(index===1){
            for(const dx of [90,121])box(c,x+dx,base-8,2,8,'#758f7f');
            box(c,x+87,base-9,38,2,'#9a9f83');box(c,x+89,base-13,34,2,'#a0a68a');
            pixelLine(c,x+90,base-11,x+90,base-8,'#748d7b');pixelLine(c,x+121,base-11,x+121,base-8,'#748d7b');
        }
    }else if(site.kind==='cargo'){
        box(c,x+57,base,32,2,Q.shadow);box(c,x+71,base,3,2,'#8ca28b');box(c,x+118,base,4,2,'#8ca28b');
        // Rail sleepers and inset plates explain how cargo reaches the stairs.
        for(const dx of [92,98])pixelLine(c,x+dx,base-1,x+dx+9,base+4,'#7f9787');
    }else if(site.kind==='water'){
        box(c,x+73,base,31,3,'#8fa28f');
        for(const dx of [83,105,124]){box(c,x+dx,base-8,2,9,'#7b9787');box(c,x+dx,base-8,3,1,'#a4b19b');}
        pixelLine(c,x+84,base-6,x+125,base-6,'#8fa58e');
        if(index===8){box(c,x+109,base-3,22,5,'#859d87');box(c,x+107,base-4,26,2,'#a6ae91');}
    }else{
        box(c,x+82,base,10,2,'#879f8b');
        box(c,x+107,base-4,24,5,'#859c87');box(c,x+105,base-5,28,2,'#a2ab90');
        for(let j=0;j<3;j++)oval(c,x+109+j*6,base-10-j%2*3,9,7,'#7d9a83');
    }
}

/** Broken reflections stay below the wall; the near channel remains open behind
 * the playable gaps. Impulses widen the ripples once, then settle. */
export function drawChaseShoreWater(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    const s=chaseQuaySection(cy),time=reduced?0:b.tick;
    for(const [i,site]of CHASE_QUAYS.entries()){
        const x=chaseQuayX(site.x,cx);if(x<-150||x>340)continue;
        const age=b.chaseReactions[i]===-1?-1:b.tick-b.chaseReactions[i];
        const shock=Math.abs(chaseQuayReaction(age,reduced).gust)*.5;
        for(let row=0;row<3;row++){
            const drift=Math.round(Math.sin(time/(34+row*7)+i+row)*1.3);
            const start=x+9+row*8+drift,span=48-row*11;
            box(c,start,s.water+1+row*3,span,1,row===0?'#638f86':'#578782');
            box(c,start+span+7,s.water+2+row*3,8-row*2,1,'#5c8e86');
        }
        for(const dx of [12,69]){
            const spread=3+shock;
            pixelLine(c,x+dx-spread,s.water,x+dx+spread,s.water,'#8aab96');
            box(c,x+dx+1,s.water+2,5,1,'#6d9b8d');
        }
    }
}
