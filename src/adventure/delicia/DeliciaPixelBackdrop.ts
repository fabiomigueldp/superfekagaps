import { ART, hashAt, mixColor } from '../../graphics/palette';
import type { Biome } from './DeliciaContent';
import type { DeliciaSimulation } from './DeliciaSimulation';
import { DELICIA_UNIT as U } from './DeliciaNative';
import { barrel, citrusTree, foliage, line, masonry, oval, polygon, px, smallWindow, stoneArch, tiledRoof, visible, type PixelContext as C } from './DeliciaSceneryPrimitives';
import { drawDeliciaLandmarks } from './DeliciaSceneryLandmarks';
import { chimneyVapor, cloth, drive, flame, royalGlass, swallow, wheel } from './DeliciaSceneDetails';

const SKIES:Record<Biome,readonly [string,string,string]>={
    harbor:['#79adb9','#b8d5cd','#e2dfb9'], orchard:['#85b9b2','#c4d8ad','#e1dfb0'],
    aqueduct:['#7fabbc','#b9d1cc','#e0d9b6'], reservoir:['#779fab','#b2cec1','#dcdfb9'],
    cellar:['#303247','#464253','#68606a'], refinery:['#626575','#a29591','#d0b59a'],
    citadel:['#68607d','#b394a4','#e7c1ad'],
};

/** Long, authored panoramas: motifs do not change seed when crossing a tile boundary. */
function layer(cx:number,cy:number,speed:number,width:number,paint:(x:number,y:number)=>void):void {
    const offset=Math.round(cx*speed),first=Math.floor(offset/width);
    for(let tile=first;tile*width-offset<320;tile++)paint(tile*width-offset,-Math.round(cy*speed));
}

function clouds(c:C,x:number,y:number,w:number,color:string,shadow:string):void {
    if(!visible(x,w))return;
    polygon(c,x,y,[[0,10],[5,7],[13,7],[17,2],[27,0],[34,2],[38,6],[w-12,6],[w-8,9],[w-2,9],[w,12],[w-8,14],[9,14],[7,12],[0,12]],color);
    px(c,x+9,y+13,w-18,1,shadow);px(c,x+20,y+3,12,1,mixColor(color,ART.paper,.35));
    px(c,x+w-3,y+16,11,1,color);px(c,x+7,y+17,19,1,shadow);
}

function sky(c:C,biome:Biome,cx:number,cy:number,time:number):void {
    const [top,mid,bottom]=SKIES[biome];
    for(let y=0;y<180;y+=6){const t=Math.min(1,(y+cy*.06)/136);px(c,0,y,320,6,t<.55?mixColor(top,mid,t/.55):mixColor(mid,bottom,(t-.55)/.45));}
    const sun=biome==='citadel'?'#f2d7b7':biome==='refinery'?'#e1c6a3':'#f4e8b9';
    oval(c,249-Math.round(cx*.025),24-Math.round(cy*.035),23,23,sun);
    px(c,244-Math.round(cx*.025),49-Math.round(cy*.035),33,1,mixColor(mid,sun,.55));
    layer(cx+Math.floor(time*.8),cy,.08,768,(x,y)=>{
        for(const [xx,yy,w] of [[16,22,64],[143,39,49],[355,17,71],[506,47,54],[641,28,65]])clouds(c,x+xx,y+yy,w,mixColor(mid,sun,.68),mixColor(mid,sun,.28));
    });
    if(biome!=='refinery')layer(cx,cy,.16,768,(x,y)=>{
        const travel=Math.floor(time*3)%768;
        for(const [offset,height] of [[123,42],[146,37],[167,45]]){
            const xx=x+(offset+travel)%768,yy=y+height+Math.round(Math.sin(time*.55+offset)*2);
            if(visible(xx-6,12))swallow(c,xx,yy,time+offset,'#8b9f9b');
        }
    });
}

function distantIsland(c:C,cx:number,cy:number,biome:Biome):void {
    const horizon=SKIES[biome][1],far=mixColor(horizon,'#4f7b86',.37),facet=mixColor(far,horizon,.27),near=mixColor(horizon,'#456f68',.47);
    layer(cx,cy,.13,768,(x,y)=>{
        polygon(c,x,y,[[0,106],[24,95],[49,94],[70,80],[79,66],[97,59],[104,62],[111,76],[132,82],[149,97],[173,94],[199,70],[217,65],[225,50],[239,44],[249,52],[256,67],[273,77],[282,76],[309,102],[350,108],[382,91],[411,87],[427,73],[446,68],[464,85],[477,88],[490,80],[507,85],[528,104],[578,104],[601,80],[615,77],[626,61],[645,61],[659,79],[682,89],[704,88],[737,108],[768,106],[768,180],[0,180]],far);
        for(const [xx,yy] of [[80,65],[225,51],[426,74],[629,63]])polygon(c,x+xx,y+yy,[[0,0],[9,-5],[5,10],[12,26],[3,21],[-4,35],[-12,34],[-2,13]],facet);
        // A distant settlement gives the mountains a believable human scale.
        for(const [xx,yy,w,h] of [[166,96,12,12],[181,91,15,17],[201,97,10,11],[348,103,16,9],[552,103,14,10],[570,100,10,13]]){
            px(c,x+xx,y+yy,w,h,facet);px(c,x+xx-1,y+yy-2,w+2,2,far);px(c,x+xx+4,y+yy+4,2,4,far);
        }
    });
    layer(cx,cy,.21,640,(x,y)=>{
        polygon(c,x,y,[[0,130],[28,126],[45,120],[70,119],[92,124],[112,128],[137,125],[154,115],[172,114],[186,118],[212,128],[247,132],[274,127],[297,116],[309,114],[329,120],[353,124],[378,128],[408,122],[439,125],[469,119],[489,111],[503,113],[529,124],[561,127],[584,121],[609,124],[640,130],[640,180],[0,180]],near);
        for(const [xx,yy] of [[46,118],[155,112],[299,112],[485,109],[582,118]]){
            px(c,x+xx+3,y+yy-9,1,12,near);polygon(c,x+xx,y+yy-14,[[0,5],[3,0],[6,1],[9,6],[6,10],[1,10]],near);
        }
    });
}

function villa(c:C,x:number,foot:number,w:number,h:number,variant:number,dim=false):void {
    if(!visible(x,w+10))return;
    const y=foot-h,wall=dim?'#b4bca6':variant%3===0?'#dbcfab':variant%3===1?'#c6cbb0':'#cad3bd',shade=dim?'#92a99e':'#98aba0',edge=dim?'#839b92':'#718e89';
    px(c,x+3,y+12,w-6,h-12,wall);px(c,x+w-11,y+12,8,h-12,shade);px(c,x+3,y+13,w-6,3,shade);
    tiledRoof(c,x,y,w,11,dim);px(c,x+3,foot-4,w-6,4,shade);px(c,x+4,foot-4,w-10,1,'#e0d8b9');
    // Chimneys, shutters, balconies and patched plaster break the repeated facade.
    if(variant%2===0){px(c,x+w-15,y-3,5,10,shade);px(c,x+w-16,y-4,7,2,wall);}
    smallWindow(c,x+9,y+21);if(w>40)smallWindow(c,x+w-19,y+21);
    for(const xx of [x+6,x+17,...(w>40?[x+w-22,x+w-11]:[])]){px(c,xx,y+23,2,8,variant%2?'#698b7d':'#8d7773');px(c,xx,y+24,1,6,shade);}
    if(h>57){
        smallWindow(c,x+10,y+40);if(w>40)smallWindow(c,x+w-18,y+40);
        px(c,x+7,y+50,w-18,2,edge);for(let i=8;i<w-9;i+=5)px(c,x+i,y+46,1,5,edge);px(c,x+7,y+45,w-18,1,shade);
    }
    const door=x+Math.round(w*.48)-4;
    px(c,door,foot-18,9,16,edge);px(c,door+1,foot-18,7,16,'#6a938e');px(c,door+2,foot-16,1,12,shade);px(c,door+6,foot-9,1,1,'#d4b57f');
    px(c,x+5,y+17,6,1,'#e3ddc0');px(c,x+5,foot-10,6,2,shade);px(c,x+7,foot-8,8,1,shade);
    if(variant%3===1){px(c,x+w-5,y+17,1,h-19,edge);px(c,x+w-8,foot-9,6,5,'#668b71');px(c,x+w-7,foot-11,3,3,'#91ad7c');}
    else{px(c,x+8,y+33,11,2,'#8d7770');px(c,x+9,y+31,8,2,'#7e996f');px(c,x+10,y+30,2,1,'#d9b275');}
}

function water(c:C,cx:number,cy:number,y:number,time:number,warm=false):void {
    y-=Math.round(cy*.25);
    const base=warm?'#659e95':'#548f9a',light=warm?'#a3c7ae':'#91bcb7',dark=warm?'#51847d':'#477985';
    px(c,0,y,320,180-y,base);px(c,0,y,320,2,light);
    for(let row=0;row<9;row++){
        const yy=y+5+row*6,shift=Math.round(cx*.25)+Math.floor(time*3)*(row%2?1:-1);
        for(let i=Math.floor(shift/43)-1;i*43-shift<320;i++){
            const n=hashAt(i,row,11),xx=i*43-shift+n%19;
            px(c,xx,yy,6+n%15,1,row%3===0?light:dark);
            if(row<3)px(c,xx+5,yy+2,3+n%9,1,light);
        }
    }
}

function sailboat(c:C,x:number,y:number,large=false,time=0):void {
    if(!visible(x,large?66:44))return;
    const w=large?62:41,mast=large?31:23,h=large?45:30;
    const bob=Math.round(Math.sin(Math.floor(time*5)*.16));y+=bob;
    polygon(c,x,y,[[0,0],[w,0],[w-7,7],[9,7],[4,4]],'#7c6662');px(c,x+3,y,w-6,1,'#c2b497');px(c,x+11,y+6,w-18,1,'#ac9a7e');
    px(c,x+mast,y-h,1,h,'#786e6a');
    polygon(c,x,y,[[mast-2,-h+3],[mast-2,-5],[5,-5],[11,-12],[18,-21]],'#e2d6b4');
    polygon(c,x,y,[[mast+2,-h+9],[w-6,-8],[mast+2,-8]],'#c2c6ab');
    line(c,x+mast-3,y-h+7,x+10,y-6,'#bcbd9f');line(c,x+mast+3,y-h+12,x+w-8,y-8,'#9fae9b');
    // Loose sail edge, reefing stitches and a small pennant share the mast's motion.
    const fold=Math.round(Math.sin(time*1.6)*2);
    line(c,x+mast-3,y-h+5,x+mast-6+fold,y-7,'#f0e3bf');
    for(let stitch=9;stitch<h-6;stitch+=7)px(c,x+mast-5,y-stitch,1,2,'#b6b89d');
    cloth(c,x+mast+1,y-h,10,4,time);
    px(c,x+10,y+10-bob,w-19,1,'#8eb8b0');px(c,x+17,y+13-bob,w-30,1,'#6fa4a4');
}

function harbor(c:C,cx:number,cy:number,time:number):void {
    layer(cx,cy,.29,768,(x,y)=>{
        for(const [xx,w,h,v] of [[12,36,40,0],[51,45,53,1],[101,34,38,2],[164,43,43,3],[209,36,55,4],[254,53,42,5],[426,46,57,0],[475,35,44,2],[514,40,48,1],[599,38,39,3],[642,50,54,4],[696,43,40,5]])villa(c,x+xx,119+y,w,h,v,true);
        for(let i=0;i<16;i++)stoneArch(c,x+i*48,121+y,48,38,'#87a9a0','#bdc9ac','#76998f');
        px(c,x,119+y,768,2,'#cccfb4');
    });
    water(c,cx,cy,137,time);
    layer(cx,cy,.4,768,(x,y)=>{
        sailboat(c,x+24,139+y,false,time);sailboat(c,x+326,143+y,true,time+2);sailboat(c,x+562,136+y,false,time+4);
        // A loading crane and its hanging cargo belong to the working waterfront.
        const xx=x+475;
        if(visible(xx,90)){
            px(c,xx,100+y,5,48,'#657d76');px(c,xx+2,101+y,1,46,'#acb4a0');px(c,xx-6,98+y,64,4,'#718b7e');
            line(c,xx+5,124+y,xx+35,102+y,'#718b7e');line(c,xx+5,123+y,xx+35,101+y,'#718b7e');
            const sway=Math.round(Math.sin(time*.7)*2);
            line(c,xx+50,103+y,xx+50+sway,127+y,'#8c9280');
            px(c,xx+44+sway,128+y,13,12,'#ab9170');line(c,xx+45+sway,129+y,xx+55+sway,138+y,'#d1b691');px(c,xx+43+sway,127+y,15,2,'#7e7e6a');
            wheel(c,xx+1,127+y,7,time*.35,true);
        }
    });
}

function orchard(c:C,cx:number,cy:number,garden:boolean,time:number):void {
    layer(cx,cy,.26,768,(x,y)=>{
        // Irrigated terraces curve with the land; small rows establish scale.
        polygon(c,x,y,[[0,124],[46,114],[98,117],[159,133],[214,133],[274,121],[329,120],[388,133],[449,127],[499,115],[551,117],[615,131],[675,123],[728,119],[768,124],[768,180],[0,180]],'#94b488');
        for(let row=0;row<3;row++){
            const yy=128+row*9;
            for(let xx=4;xx<768;xx+=11){const bend=Math.round(Math.sin(xx/65)*6);px(c,x+xx,y+yy+bend,7,1,'#c0c99a');px(c,x+xx+1,y+yy+bend+2,4,1,'#719776');}
        }
        for(const [xx,yy,v] of [[5,50,0],[69,59,1],[205,45,0],[269,56,1],[400,55,0],[475,40,1],[617,59,0],[687,48,1]])citrusTree(c,x+xx,y+yy,v,true,time*.6);
    });
    layer(cx,cy,.43,960,(x,y)=>{
        for(const [xx,yy,v] of [[-14,66,0],[131,61,1],[359,71,0],[509,60,1],[701,70,0],[856,64,1]])citrusTree(c,x+xx,y+yy,v,false,time);
        if(garden){
            // Copper ribs and pale glass distinguish the forbidden orchard's conservatory.
            const xx=x+249;
            if(visible(xx,100)){
                polygon(c,xx,81+y,[[0,25],[9,12],[27,2],[54,0],[76,10],[88,25],[88,65],[0,65]],'#8ba99a');
                polygon(c,xx+4,84+y,[[0,23],[8,11],[24,2],[48,0],[70,10],[80,23],[80,58],[0,58]],'#b4ccb4');
                for(let k=0;k<5;k++){const xxx=xx+7+k*18;px(c,xxx,102+y,2,43,'#8b9280');line(c,xxx,102+y,xx+42,84+y,'#8b9280');}
                px(c,xx,107+y,88,2,'#8b9280');px(c,xx,123+y,88,2,'#8b9280');
                for(let k=0;k<3;k++)foliage(c,xx+6+k*25,118+y,'#648b74','#87ac80','#b0c594');
                px(c,xx-4,145+y,96,4,'#879b83');
            }
        }
        for(const xx of [89,311,623,796]){
            px(c,x+xx,132+y,3,18,'#798e6e');px(c,x+xx+22,130+y,3,20,'#798e6e');
            px(c,x+xx-2,135+y,31,2,'#acb48b');px(c,x+xx-2,143+y,31,2,'#8e9f7c');
        }
    });
    layer(cx,cy,.34,640,(x,y)=>{
        for(const [xx,yy] of [[1,156],[64,164],[134,158],[220,161],[309,155],[380,162],[477,157],[563,162]])foliage(c,x+xx,y+yy,'#3e7160','#668f67','#96af79');
    });
}

function falls(c:C,x:number,y:number,w:number,h:number,time:number,warm=false):void {
    if(!visible(x,w+12))return;
    px(c,x,y,w,h,warm?'#91b59c':'#81b9b1');px(c,x+2,y,w-5,h,warm?'#c4d2a5':'#b1d6bf');px(c,x+3,y,2,h,warm?'#dfdeb1':'#d7e5c5');px(c,x+w-3,y,2,h,'#729f96');
    for(let i=0;i<7;i++){
        const yy=(i*19+Math.floor(time*14))%Math.max(1,h-8),xx=3+(i*7)%Math.max(1,w-6);
        px(c,x+xx,y+yy,1,5+(i%3),warm?'#e2dfb7':'#dbebcd');
    }
    for(let edge=4;edge<h-10;edge+=13){px(c,x-1,y+edge,1,4,'#91b6a5');px(c,x+w,y+edge+5,1,6,'#95baaa');}
    for(let strand=4;strand<w-3;strand+=4){px(c,x+strand,y+2,1,h-5,warm?'#d4d9af':'#c3dfc2');}
    const swell=Math.floor(time*4)%4;
    for(let foam=0;foam<4;foam++){
        const xx=x-5+foam*(w+8)/4,yy=y+h-2+[0,1,0,-1][(foam+swell)%4];
        oval(c,xx,yy,7,4,warm?'#d1d8aa':'#bddec0');px(c,xx+2,yy,3,1,'#dce6c4');
    }
    px(c,x-7,y+h+3,w+14,1,'#97beab');px(c,x-2,y+h+6,w+4,1,'#aecdb3');
}

function aqueduct(c:C,cx:number,cy:number,time:number):void {
    layer(cx,cy,.27,768,(x,y)=>{
        for(const [xx,w,h,v] of [[13,36,38,0],[56,46,51,1],[421,37,40,2],[462,50,52,0],[519,34,40,1]])villa(c,x+xx,126+y,w,h,v,true);
        px(c,x,127+y,768,53,'#93b09e');px(c,x,127+y,768,2,'#c7d0ad');
    });
    water(c,cx,cy,151,time,true);
    layer(cx,cy,.4,792,(x,y)=>{
        for(let i=0;i<9;i++){
            const xx=x+i*88;if(!visible(xx,88))continue;
            stoneArch(c,xx,82+y,88,79,'#8eaaa0','#c2cbb2','#77978f');
            stoneArch(c,xx,51+y,44,32,'#a6baaa','#d0d3b8','#8ca69b');stoneArch(c,xx+44,51+y,44,32,'#a6baaa','#d0d3b8','#8ca69b');
            px(c,xx-2,48+y,92,3,'#d4d7b8');px(c,xx-1,53+y,90,1,'#899f96');
            px(c,xx-2,80+y,92,3,'#b8c7ac');px(c,xx+2,97+y,4,58,'#a9bfa6');
            if(i%3===1){px(c,xx+1,65+y,9,3,'#799b81');px(c,xx+1,67+y,4,17,'#799b81');px(c,xx+4,78+y,2,13,'#789779');}
        }
        falls(c,x+341,53+y,12,101,time);falls(c,x+689,53+y,10,101,time);
        // Maintenance walk and copper return pipe below the upper arches.
        px(c,x,76+y,792,2,'#a3a98c');
        for(const xx of [168,522]){px(c,x+xx,56+y,4,101,'#9b9580');px(c,x+xx,56+y,1,101,'#c8bc92');for(let yy=64;yy<150;yy+=18)px(c,x+xx-2,yy+y,8,2,'#7c958c');}
    });
}

function cliff(c:C,x:number,y:number,w:number,h:number):void {
    if(!visible(x,w))return;
    polygon(c,x,y,[[0,14],[8,9],[15,9],[20,2],[w-18,0],[w-13,8],[w-5,11],[w,22],[w-3,h],[4,h]],'#72958d');
    polygon(c,x,y,[[17,10],[24,3],[w-20,2],[w-23,18],[w-29,30],[w-22,45],[w-26,h],[18,h],[20,51],[13,34]],'#96afa0');
    polygon(c,x,y,[[w-25,17],[w-18,6],[w-13,10],[w-7,33],[w-12,45],[w-9,h],[w-25,h],[w-23,46],[w-29,32]],'#60857e');
    for(const [yy,xx,span] of [[27,8,w-20],[51,14,w-28],[72,7,w-17]])if(yy<h){px(c,x+xx,y+yy,span,2,'#78968b');px(c,x+xx+3,y+yy-1,span-6,1,'#b2bfa4');}
    polygon(c,x+22,y+16,[[0,0],[13,-6],[7,14],[12,28],[6,34],[8,57],[0,66],[3,40],[-4,25]],'#829f93');
    polygon(c,x+w-44,y+36,[[0,0],[8,5],[2,20],[9,34],[3,47],[-4,40],[-2,22]],'#a3b7a1');
    for(const [xx,yy,len] of [[29,20,13],[48,38,17],[24,61,9],[43,82,18],[16,95,13]])if(xx+len<w-12&&yy<h-4){
        px(c,x+xx,y+yy,len,1,'#afbea5');px(c,x+xx+4,y+yy+2,len-7,1,'#809c8d');
    }
    for(let row=19;row<h-8;row+=19){
        const offset=hashAt(w,row,8)%Math.max(1,w-43);
        line(c,x+offset+13,y+row,x+offset+20,y+row+3,'#718f84');line(c,x+offset+20,y+row+3,x+offset+17,y+row+9,'#718f84');
        px(c,x+offset+11,y+row-1,10,1,'#a7b8a1');
        px(c,x+offset+8,y+row+6,5,2,'#7b9d7a');px(c,x+offset+9,y+row+8,2,3,'#7b9d7a');
    }
    foliage(c,x+10,y-7,'#6b9175','#8baa7e','#b3c094');
    if(w>80)foliage(c,x+w-38,y-4,'#5e876f','#83a078','#adbd8c');
    line(c,x+w-18,y+20,x+w-21,y+43,'#537e68');px(c,x+w-22,y+30,4,5,'#6e9872');
    for(const [xx,yy] of [[9,44],[w-13,62],[15,83]])if(yy<h-12){px(c,x+xx,y+yy,3,15,'#668c72');px(c,x+xx-3,y+yy+3,8,3,'#829e78');px(c,x+xx+2,y+yy+11,3,6,'#77966f');}
}

function reservoir(c:C,sim:DeliciaSimulation,cx:number,cy:number,time:number):void {
    const tide=sim.stage.number===7;
    layer(cx,cy,.3,768,(x,y)=>{
        for(const [xx,yy,w,h] of [[-14,76,92,91],[137,47,117,121],[314,68,82,99],[445,56,96,112],[610,42,128,124]]){
            cliff(c,x+xx,yy+y,w,h);
            if(!tide||xx===137)falls(c,x+xx+w-30,yy+12+y,13,145-yy,time,true);
        }
        if(!tide&&!sim.stage.boss){
            // A restrained spray bow is anchored to the ravine, never to the camera.
            const tones=['#c9b39e','#cdd0a5','#a4c7b1','#96b8b4'];
            for(let band=0;band<4;band++)for(let step=0;step<=60;step++){
                const a=Math.PI+step*Math.PI/60,r=45-band*2;
                px(c,x+265+Math.round(Math.cos(a)*r),y+129+Math.round(Math.sin(a)*r*.53),2,2,tones[band]);
            }
        }
    });
    water(c,cx,cy,tide?129:154,time,true);
    if(tide)layer(cx,cy,.4,768,(x,y)=>{sailboat(c,x+35,138+y,true,time);sailboat(c,x+409,135+y,false,time+2);});
    else layer(cx,cy,.42,768,(x,y)=>{
        for(const xx of [62,382,642]){
            stoneArch(c,x+xx,112+y,56,49,'#91aa97','#c1cbb1','#769787');
            px(c,x+xx-3,109+y,62,3,'#c8ceb1');
        }
    });
    if(sim.stage.boss==='jaja'){
        const x=Math.round((580/U-cx)*.32+72),y=143-Math.round(cy*.4);
        // The source is a quiet semicircular sanctuary behind the combat lane.
        stoneArch(c,x,y-91,106,92,'#93aca0','#cbd2b5','#76968d');
        stoneArch(c,x+11,y-79,84,80,'#a9bdae','#d0d7bb','#899f97');
        falls(c,x+43,y-68,21,64,time,true);
        for(const xx of [x-11,x+111]){px(c,xx,y-62,7,62,'#8aa296');px(c,xx-3,y-63,13,3,'#c4cfb4');foliage(c,xx-10,y-74,'#598a73','#83a580','#b0c496');}
        px(c,x+25,y-2,57,4,'#b7c7aa');px(c,x+34,y+3,38,1,'#ccdab7');
    }
}

function lamp(c:C,x:number,y:number,time:number):void {
    // Solid color steps give warm illumination without bloom or blur.
    oval(c,x-13,y-7,33,34,'#504753');oval(c,x-7,y-2,22,23,'#665356');
    px(c,x+3,y-21,1,22,'#7b6970');px(c,x,y,9,13,'#473d4e');px(c,x+1,y+2,7,8,'#aa855e');px(c,x+3,y+3,3,6,'#e2bc7d');
    px(c,x-1,y,11,2,'#9b7d63');px(c,x+1,y+12,7,2,'#876950');
    flame(c,x+2,y+2,time,true);px(c,x+1,y+10,7,1,'#7f655c');px(c,x+4,y+1,1,11,'#a48364');
}

function cellar(c:C,cx:number,cy:number,time:number):void {
    px(c,0,0,320,180,'#303247');
    layer(cx,cy,.2,768,(x,y)=>{
        masonry(c,x,y,768,180,'#3a394c','#4a4456','#343246',6);
        for(const xx of [37,277,548]){
            stoneArch(c,x+xx,23+y,65,139,'#504653','#6c5b65','#363546');
            px(c,x+xx+10,55+y,45,104,'#2e3043');
            smallWindow(c,x+xx+26,49+y,true,12,35);
            polygon(c,x+xx,88+y,[[28,0],[37,0],[60,63],[13,63]],'#41404d');
        }
    });
    layer(cx,cy,.42,768,(x,y)=>{
        const bays=[[9,0],[132,1],[273,2],[408,3],[538,1],[671,0]];
        for(const [xx,variant] of bays){
            const bx=x+xx;if(!visible(bx,93))continue;
            stoneArch(c,bx,15+y,93,158,'#65545e','#8b7074','#443b4c');
            px(c,bx-3,130+y,11,4,'#827071');px(c,bx+86,130+y,11,4,'#827071');
            // Each bay contains different stored histories: casks, ledgers, bottles.
            for(let shelf=0;shelf<3;shelf++){
                const yy=70+shelf*31+y;
                px(c,bx+10,yy,73,4,'#51424e');px(c,bx+10,yy,73,1,'#98756a');
                for(let slot=0;slot<4;slot++){
                    const sx=bx+14+slot*17;
                    if((slot+shelf+variant)%4===0){
                        for(let book=0;book<3;book++){const height=11+(book+slot)%3*3;px(c,sx+book*4,yy-height,3,height,book%2?'#788076':'#9f7967');px(c,sx+book*4,yy-height+3,3,1,'#b2a182');}
                    }else if((slot+variant)%4===2){
                        for(let b=0;b<2;b++){px(c,sx+b*7+2,yy-16,2,3,'#899181');px(c,sx+b*7,yy-13,6,12,'#56746e');px(c,sx+b*7+1,yy-12,1,8,'#95ac93');px(c,sx+b*7,yy-8,6,3,'#bab097');}
                    }else barrel(c,sx,yy-19,true);
                }
            }
            if(variant%2===0){line(c,bx+7,40+y,bx+29,54+y,'#73636d');line(c,bx+7,40+y,bx+10,60+y,'#73636d');line(c,bx+9,48+y,bx+21,48+y,'#73636d');}
        }
        for(const xx of [104,381,642])if(visible(x+xx-14,35))lamp(c,x+xx,75+y,time+xx);
    });
}

function tank(c:C,x:number,y:number,w:number,h:number,copper=false):void {
    if(!visible(x,w+18))return;
    const dark=copper?'#776969':'#647781',base=copper?'#9a7d71':'#879998',light=copper?'#c0a083':'#b3b7a6';
    oval(c,x,y,w,14,light);px(c,x,y+7,w,h-13,dark);px(c,x+3,y+7,w-9,h-13,base);px(c,x+6,y+8,4,h-15,light);px(c,x+w-10,y+8,3,h-15,dark);oval(c,x,y+h-13,w,13,dark);
    for(const yy of [y+15,y+h-18]){px(c,x-2,yy,w+4,3,dark);px(c,x,yy,w,1,light);for(let xx=5;xx<w-2;xx+=12)px(c,x+xx,yy+2,1,1,light);}
    px(c,x+4,y+h-3,5,10,dark);px(c,x+w-9,y+h-3,5,10,dark);
    px(c,x+w-3,y+28,14,6,dark);px(c,x+w+7,y+30,5,h-22,dark);px(c,x+w-1,y+29,12,1,light);px(c,x+w+8,y+30,1,h-23,base);
    px(c,x+w/2-5,y+30,11,12,dark);px(c,x+w/2-3,y+32,7,7,'#c3bea5');line(c,x+w/2,y+37,x+w/2+2,y+33,'#866969');
    px(c,x+15,y+18,1,h-40,dark);for(let yy=22;yy<h-24;yy+=7)px(c,x+17,y+yy,1,1,light);
    px(c,x+w-17,y+22,3,h-47,dark);px(c,x+w-16,y+23,1,h-49,'#b7baa3');
    if(h>70){px(c,x+w/2-8,y+h-32,19,9,dark);px(c,x+w/2-6,y+h-30,15,1,base);px(c,x+w/2-4,y+h-27,11,1,light);}
}

function refinery(c:C,cx:number,cy:number,time:number,boiler:boolean):void {
    layer(cx,cy,.22,768,(x,y)=>{
        for(const [xx,yy,w,h] of [[5,62,78,86],[107,79,61,69],[243,47,83,101],[385,65,69,83],[489,85,88,63],[635,54,86,94]]){
            if(!visible(x+xx,w))continue;
            px(c,x+xx,yy+y,w,h,'#738084');
            polygon(c,x+xx,yy-10+y,[[0,10],[15,0],[15,10],[33,0],[33,10],[51,0],[51,10],[w,10],[w,13],[0,13]],'#6c7780');
            px(c,x+xx+3,yy+3+y,w-6,1,'#a7a196');
            for(let k=0;k<5;k++){px(c,x+xx+8+k*12,yy+13+y,7,13,'#909b98');px(c,x+xx+10+k*12,yy+15+y,2,7,'#bdad8d');}
            const chimney=x+xx+w-22;px(c,chimney,yy-34+y,12,35,'#758086');px(c,chimney+2,yy-33+y,3,33,'#969c96');px(c,chimney-2,yy-35+y,16,3,'#9e9f95');
            chimneyVapor(c,chimney+5,yy-38+y,time+xx*.05);
        }
    });
    layer(cx,cy,.4,960,(x,y)=>{
        for(const [xx,yy,w,h,copper] of [[20,62,48,83,0],[117,82,62,65,1],[325,48,48,101,1],[504,72,69,74,0],[679,53,49,94,1],[824,81,65,67,0]])tank(c,x+xx,yy+y,w,h,!!copper);
        px(c,x,132+y,960,6,'#64777a');px(c,x,132+y,960,1,'#b4af97');
        for(let xx=6;xx<960;xx+=39){px(c,x+xx,130+y,3,10,'#89988f');px(c,x+xx,130+y,3,1,'#c4bba1');}
        // Trussed catwalks connect vessels, with open space between their silhouettes.
        for(const xx of [189,410,748])if(visible(x+xx,101)){
            px(c,x+xx,94+y,102,4,'#768785');px(c,x+xx,94+y,102,1,'#b8b79d');
            for(let i=0;i<5;i++){px(c,x+xx+i*25,84+y,1,10,'#89988f');line(c,x+xx+i*20,99+y,x+xx+i*20+14,109+y,'#6b807e');}
            px(c,x+xx,84+y,101,1,'#9aa794');
        }
        if(boiler){
            for(const xx of [203,589]){
                const bx=x+xx;if(!visible(bx,71))continue;
                masonry(c,bx,53+y,71,103,'#826f70','#a48b7b','#73646b',8);
                stoneArch(c,bx+9,92+y,52,63,'#a08275','#c1a38b','#73636a');
                px(c,bx+17,116+y,36,31,'#8e665a');px(c,bx+22,125+y,26,22,'#b98259');
                for(const dx of [22,35])flame(c,bx+dx,124+y,time+dx);
                for(let j=0;j<5;j++)px(c,bx+20+j*7,113+y,2,38,'#71666a');
            }
        }
        // Low, slow vapor stays separate from the bright active-press warning.
        for(const xx of [74,376,731]){
            px(c,x+xx,53+y,4,30,'#818c83');px(c,x+xx,53+y,1,29,'#b5b199');px(c,x+xx-2,52+y,8,2,'#a6a790');
            chimneyVapor(c,x+xx+2,50+y,time+xx*.03);
        }
        for(const xx of [220,586,783])if(visible(x+xx-25,77))drive(c,x+xx,139+y,time);
    });
}

function spire(c:C,x:number,foot:number,w:number,h:number):void {
    if(!visible(x,w+6))return;
    const y=foot-h;
    px(c,x+4,y+22,w-8,h-22,'#9991a0');px(c,x+w-10,y+23,6,h-23,'#7b7f94');px(c,x+6,y+24,2,h-25,'#c2b2ad');
    polygon(c,x,y,[[w/2-1,0],[w/2+2,0],[w/2+4,9],[w-1,23],[0,23],[w/2-3,9]],'#7f6786');
    line(c,x+w/2-2,y+3,x+3,y+21,'#b58e9e');px(c,x-1,y+22,w+2,3,'#c6b0a4');px(c,x+w/2,y-6,1,7,'#ccaf87');px(c,x+w/2-2,y-8,5,3,'#e0c499');
    for(let yy=12;yy<22;yy+=4){const inset=Math.round((23-yy)*.5);px(c,x+inset+2,y+yy,w-inset*2-5,1,'#927c94');}
    smallWindow(c,x+w/2-3,y+34,true,7,15);if(h>82)smallWindow(c,x+w/2-3,y+65,true,7,15);
    px(c,x+2,foot-7,w-4,3,'#b3a3a3');
    for(let yy=y+55;yy<foot-13;yy+=21){px(c,x+5,yy,5,1,'#b4a7a9');px(c,x+w-11,yy+5,6,1,'#838699');}
}

function citadel(c:C,sim:DeliciaSimulation,cx:number,cy:number,time:number):void {
    layer(cx,cy,.23,960,(x,y)=>{
        for(const [xx,w,h] of [[7,25,72],[61,34,102],[119,24,68],[324,29,80],[371,38,120],[426,25,78],[656,30,98],[714,23,67],[813,34,110],[874,27,77]])spire(c,x+xx,141+y,w,h);
        for(const xx of [32,94,348,405,682,739,846]){
            px(c,x+xx,112+y,32,42,'#a59aa4');px(c,x+xx,111+y,32,2,'#ceb6ac');for(let k=0;k<3;k++)px(c,x+xx+k*13,108+y,6,4,'#a59aa4');
            stoneArch(c,x+xx+3,124+y,26,30,'#93909f','#b3a4a7','#808297');
        }
    });
    layer(cx,cy,.4,768,(x,y)=>{
        for(const xx of [19,306,606]){
            const bx=x+xx;if(!visible(bx,94))continue;
            masonry(c,bx,95+y,94,80,'#858899','#a6a1a7','#787c91',5);
            stoneArch(c,bx+10,105+y,74,69,'#aaa0a7','#d4bdb0','#8e8e9d');
            px(c,bx-4,93+y,102,3,'#c7b5ad');
            for(let i=0;i<8;i++)px(c,bx+i*13,88+y,5,7,'#a39ba5');
            for(const dx of [3,81])cloth(c,bx+dx,101+y,10,36,time+dx,true);
        }
    });
    if(sim.stage.boss==='guina'){
        const xx=Math.round((560/U-cx)*.28+74),yy=146-Math.round(cy*.36);
        stoneArch(c,xx,yy-112,116,112,'#9d949f','#d1b4aa','#838398');
        stoneArch(c,xx+10,yy-99,96,99,'#b3a0a4','#dec1aa','#93909e');
        // Crown-shaped stained glass, below actor saturation and behind the arena.
        royalGlass(c,xx+25,yy-99);
        spire(c,xx-20,yy,29,125);spire(c,xx+107,yy,29,125);
    }
}

export function drawDeliciaBackdrop(c:C,sim:DeliciaSimulation,time:number):void {
    const cx=sim.cameraX/U,cy=sim.cameraY/U,biome=sim.stage.biome;
    if(biome==='cellar')cellar(c,cx,cy,time);
    else{
        sky(c,biome,cx,cy,time);distantIsland(c,cx,cy,biome);
        if(biome==='harbor')harbor(c,cx,cy,time);
        else if(biome==='orchard')orchard(c,cx,cy,sim.stage.number===9,time);
        else if(biome==='aqueduct')aqueduct(c,cx,cy,time);
        else if(biome==='reservoir')reservoir(c,sim,cx,cy,time);
        else if(biome==='refinery')refinery(c,cx,cy,time,sim.stage.number===10);
        else citadel(c,sim,cx,cy,time);
    }
    drawDeliciaLandmarks(c,sim,time);
}
