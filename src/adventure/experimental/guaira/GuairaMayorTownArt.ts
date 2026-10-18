import { drawGuairaAwning, drawGuairaPerchedBird, drawGuairaTree, guairaBreeze } from './GuairaScenery';
import { drawGuairaPlaster } from './GuairaMaterials';
import { drawGuairaFacadeFinish } from './GuairaBuildingFinish';
import { guairaFluidTime } from './GuairaFluidArt';

/** Town scenery stays softer than actors, amber tells and cream collision tops.
 * Every moving detail is rooted in architecture and reads the simulation clock. */
function paint(c:CanvasRenderingContext2D,cx:number,cy:number){
    return (x:number,y:number,w:number,h:number,color:string)=>{
        if(w<=0||h<=0)return;
        c.fillStyle=color;c.fillRect(Math.round(x-cx),Math.round(y-cy),Math.round(w),Math.round(h));
    };
}
function roof(c:CanvasRenderingContext2D,cx:number,cy:number,x:number,y:number,w:number,near=false){
    const r=paint(c,cx,cy),dark=near?'#895f54':'#ac8c76',base=near?'#b77960':'#bf9a7e',light=near?'#ce9371':'#cdaa88';
    r(x+10,y-8,w-20,2,light);
    for(let row=0;row<3;row++){
        const inset=7-row*3,yy=y-6+row*3;
        r(x+inset,yy,w-inset*2,3,base);r(x+inset,yy+2,w-inset*2,1,dark);
        for(let xx=x+inset+3+(row%2)*4;xx<x+w-inset-4;xx+=9){
            r(xx,yy,1,2,light);r(xx+6,yy+1,1,1,dark);
        }
    }
    r(x,y+3,w,2,dark);r(x+2,y+5,w-4,2,near?'#96735e':'#b39a7e');
}
function window(c:CanvasRenderingContext2D,cx:number,cy:number,x:number,y:number,w:number,h:number,near=false){
    const r=paint(c,cx,cy);
    r(x-1,y,w+2,h+2,near?'#aa9178':'#b3a18a');
    r(x,y,w,h,near?'#596f6c':'#92a392');r(x+1,y+1,w-2,Math.max(1,h-3),near?'#78958c':'#a5b1a0');
    r(x+1,y+1,2,h-4,near?'#b2c1a6':'#bdc5aa');
    r(x+Math.floor(w/2),y,1,h,near?'#bca880':'#c4b08e');r(x,y+Math.floor(h*.58),w,1,near?'#a58f73':'#bca789');
    r(x-2,y+h+2,w+4,2,near?'#a58a6c':'#bba184');
}

export function drawMayorTown(c:CanvasRenderingContext2D,cx:number,cy:number,time:number,reduced:boolean){
    const r=paint(c,cx,cy),t=reduced?0:time;
    // The canopy separates the civic house from the quieter residential street.
    drawGuairaTree(c,208-cx,199-cy,81,t,208,true);
    const houses=[[-13,145,51,58],[42,134,43,69],[91,150,49,53],[147,139,51,64]];
    for(const [i,[x,y,w,h]] of houses.entries()){
        r(x+2,y,w-4,h,'#cfb391');r(x+w-10,y+2,8,h-2,'#b8a287');
        r(x+5,y+8,w-17,h-11,i%2?'#d4ba96':'#ccb493');
        drawGuairaPlaster(c,x+8-cx,y+12-cy,w-24,h-15,i+17);
        drawGuairaFacadeFinish(c,x-cx,y+5-cy,w,y+h-cy);
        // Recessed doors and shutters, with warm bounce light at their bases.
        const dx=x+Math.floor(w*.47);
        r(dx,y+h-29,12,26,'#af9a80');r(dx+2,y+h-31,8,2,'#af9a80');
        r(dx+2,y+h-27,8,23,'#98a18a');r(dx+3,y+h-26,1,20,'#b1b89b');r(dx+8,y+h-16,1,1,'#cbb78e');
        window(c,cx,cy,x+9,y+15,9,i%2?15:11);
        if(w>45)window(c,cx,cy,x+w-21,y+15,8,11);
        r(x+3,y+h-3,w-6,3,'#b9a181');r(x+8,y+h-8,9,1,'#baa187');
        roof(c,cx,cy,x,y-2,w);
    }
    // An upstairs balcony belongs to the distant house, with no bright top.
    r(51,156,24,2,'#b79c7e');r(52,158,22,9,'#b9a589');
    for(let x=54;x<74;x+=5){r(x,158,1,8,'#9e9780');r(x+1,158,1,1,'#c3b392');}
    r(51,166,24,2,'#ab9277');
    drawGuairaAwning(c,96-cx,176-cy,24,t,96);
    drawGuairaAwning(c,153-cx,168-cy,29,t,153);
    // A grounded washing line uses the same breeze as the trees and awnings.
    r(12,158,1,39,'#a99a7c');r(40,160,1,37,'#a99a7c');
    for(const x of [11,39]){r(x,192,3,5,'#b19c7b');r(x+1,193,1,2,'#c5b08b');}
    for(let x=12;x<=40;x++)r(x,158+Math.floor((x-12)/14),1,1,'#a39b80');
    for(const [x,y,w,color] of [[17,160,6,'#c3bf9f'],[29,161,7,'#b3b89d']] as const){
        const sway=guairaBreeze(t,x,1);
        r(x,y,w,4,color);r(x+sway,y+4,w,3,color);r(x+1,y,1,2,'#999a7f');
    }
    // Quiet masonry behind the live pipes: large courses, no decorative dotted grid.
    r(0,195,320,29,'#bf9b79');r(0,195,320,2,'#cbaa83');r(0,218,320,6,'#b18b68');
    for(let row=0;row<2;row++)for(let x=-15+row*18;x<320;x+=45){
        const y=199+row*11;
        r(x,y,42,9,row?'#c09a74':'#c4a17c');r(x+1,y+8,40,1,'#af8d6e');
        r(x+42,y+2,1,7,'#ac8c6d');r(x+5,y+1,15,1,'#cbaa83');
    }
    // The potted vine is background planting, never an extra stepping stone.
    r(199,187,8,24,'#8e9973');r(201,179,2,28,'#7f8d69');
    for(const [x,y] of [[197,180],[204,184],[197,192],[204,198]]){
        const sway=guairaBreeze(t,x,1);r(x+sway,y,5,3,'#93a477');r(x+1+sway,y-1,3,1,'#a5b489');
    }
    r(196,209,13,2,'#a77d61');r(198,211,9,9,'#b18a67');r(199,212,2,6,'#c39d75');r(198,219,9,1,'#906e59');
    drawGuairaPerchedBird(c,68-cx,126-cy,t,68,-1);
}

/** A small water office with real depth: tiled hip, recessed arch and side piers. */
export function drawMayorCivicRoom(c:CanvasRenderingContext2D,cx:number,cy:number,time:number,reduced:boolean){
    const r=paint(c,cx,cy);
    r(222,103,94,56,'#9f8e77');r(225,104,87,55,'#cdb38e');r(227,109,82,48,'#d8bf98');
    r(225,104,87,4,'#a38e74');r(228,108,81,1,'#dfc7a0');
    drawGuairaPlaster(c,229-cx,114-cy,78,40,6);
    roof(c,cx,cy,219,97,99,true);
    for(const x of [224,242,290,308]){r(x,104,3,4,'#b49c7c');r(x+1,106,2,3,'#a28c72');}
    // Recessed blue-green arch leaves a calm dark field behind the cream coat.
    r(254,125,35,34,'#a48d72');r(257,120,29,5,'#a48d72');r(262,117,19,3,'#a48d72');
    r(258,126,27,33,'#687b75');r(261,123,21,3,'#687b75');r(265,121,13,2,'#687b75');
    r(260,128,23,29,'#819184');r(271,124,2,34,'#526b65');
    for(const x of [262,275]){
        r(x,129,6,12,'#748779');r(x,144,6,10,'#748779');r(x+1,130,1,9,'#96a28a');r(x+1,145,1,7,'#96a28a');
    }
    r(269,143,1,3,'#d0b37e');r(274,143,1,3,'#d0b37e');r(257,157,29,2,'#7f7966');
    for(const x of [225,309]){
        r(x,113,4,44,'#b8a183');r(x,113,1,42,'#ddc6a1');r(x+3,114,1,43,'#9f8a71');
        r(x-1,153,6,4,'#b49a7b');
    }
    window(c,cx,cy,232,121,10,22,true);window(c,cx,cy,297,121,9,22,true);
    // Sparse blue tile fragments at the foot of the office, not a noisy texture.
    r(229,151,22,6,'#b9b89b');r(292,151,16,6,'#b9b89b');
    for(const x of [231,238,245,294,301]){r(x,153,3,2,'#82978c');r(x+1,152,1,1,'#96aa9a');}
    r(245,107,49,9,'#a78f71');r(246,108,47,7,'#c8b08b');r(247,109,45,1,'#d9c29b');
    // The top hook meets the eave; overlapping links drain into a stone shoe.
    r(313,103,5,2,'#a38b6d');
    for(let y=105;y<155;y+=4){r(315,y,2,3,'#a38b6d');r(316,y+2,1,3,'#c1a780');}
    r(312,155,7,4,'#aa9476');r(314,155,3,2,'#8f8870');
    drawGuairaPerchedBird(c,236-cx,89-cy,reduced?0:time,236,1);
}

/** Riveted reservoir on a masonry cradle; its small sight glass shows stored water. */
export function drawMayorReserve(c:CanvasRenderingContext2D,cx:number,cy:number,time:number,reduced:boolean,released:boolean){
    const r=paint(c,cx,cy);
    r(276,203,27,7,'#9c886a');r(279,210,5,9,'#b69b72');r(296,210,5,9,'#a48a66');
    r(277,174,25,30,'#8c785b');r(279,172,21,32,'#ae986a');r(281,174,17,28,'#bba572');
    r(281,175,3,26,'#d3bd87');r(296,175,3,27,'#9e885d');
    r(278,171,23,2,'#a18d65');r(281,170,17,1,'#c3b183');r(278,174,23,1,'#d1bc88');
    for(const y of [178,198]){
        r(277,y,25,3,'#857961');r(279,y,21,1,'#c0b185');r(279,y+1,2,1,'#e0c998');r(297,y+1,2,1,'#d4bd89');
    }
    r(288,181,7,15,'#887c60');r(289,182,5,13,'#607e72');r(290,184,3,10,'#87b3a2');r(290,184,2,2,'#bcd3b4');
    for(const y of [185,189,193])r(294,y,2,1,'#c8b687');
    // A restrained travelling reflection; no loose cyan droplets resembling danger.
    const drift=Math.floor(guairaFluidTime(time,reduced)/100)%12;
    for(let offset=-12;offset<20;offset+=12){
        const top=Math.max(186,184+offset+drift),bottom=Math.min(194,187+offset+drift);
        if(bottom>top)r(290,top,1,bottom-top,'#b4cbb0');
    }
    r(282,205,15,3,'#87795d');r(284,205,11,1,released?'#8db49f':'#bb9d6a');
}
