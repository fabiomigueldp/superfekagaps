import type { DeliciaSimulation } from './DeliciaSimulation';
import { DELICIA_UNIT as U } from './DeliciaNative';
import { barrel, citrusTree, foliage, line, masonry, oval, polygon, px, smallWindow, stoneArch, tiledRoof, visible, type PixelContext as C } from './DeliciaSceneryPrimitives';
import { chimneyVapor, cloth, drive, flame, waterRibbons, wheel } from './DeliciaSceneDetails';

function crate(c:C,x:number,y:number):void {
    px(c,x,y,18,14,'#8b7261');px(c,x+1,y+1,16,11,'#b69572');
    for(let yy=2;yy<13;yy+=4)px(c,x+1,y+yy,16,1,'#91765f');
    line(c,x+2,y+2,x+15,y+11,'#d1af83');line(c,x+3,y+2,x+16,y+11,'#d1af83');
    px(c,x+1,y+1,2,12,'#d1af83');px(c,x+15,y+1,2,12,'#d1af83');
}

function market(c:C,x:number,y:number,variant:number,time:number):void {
    px(c,x+3,y-61,54,61,'#c6c6a6');px(c,x+48,y-61,9,61,'#a6af97');
    tiledRoof(c,x-3,y-76,66,13,true);smallWindow(c,x+13,y-48);smallWindow(c,x+35,y-48);
    px(c,x+10,y-35,37,2,'#8d9380');for(let k=0;k<7;k++)px(c,x+11+k*5,y-39,1,4,'#939480');
    px(c,x+5,y-60,43,1,'#e0d7b8');px(c,x+6,y-9,10,1,'#adb397');px(c,x+8,y-7,13,1,'#adb397');
    // A sagging canvas canopy with a striped valance, separate from the roof.
    polygon(c,x,y,[[0,-31],[59,-31],[66,-21],[-7,-21]],'#c49473');
    for(let k=0;k<7;k++){
        const xx=x-6+k*10;
        polygon(c,xx,y,[[5,-30],[11,-30],[10,-21],[0,-21]],k%2?'#e1d7b5':'#bb8868');
        const flutter=Math.round(Math.sin(Math.floor(time*5)*.35+k*.7));
        px(c,xx,y-21,9,4+flutter,k%2?'#d4caa8':'#b98767');px(c,xx+2,y-17+flutter,5,1,k%2?'#d4caa8':'#b98767');
    }
    px(c,x-6,y-17,2,17,'#8a7e67');px(c,x+62,y-17,2,17,'#8a7e67');
    px(c,x-4,y-7,40,7,'#8e7865');px(c,x-4,y-8,41,2,'#c3a17a');
    for(let k=0;k<7;k++){px(c,x-2+k*5,y-11-(k%2)*2,3,3,'#cb985b');px(c,x-2+k*5,y-11-(k%2)*2,2,1,'#dfb977');}
    crate(c,x+36,y-14);if(variant%2)crate(c,x+46,y-27);else barrel(c,x+55,y-18,true);
    px(c,x+56,y-56,17,2,'#8e806c');px(c,x+68,y-54,1,5,'#8e806c');
    px(c,x+62,y-49,15,15,'#98876a');px(c,x+63,y-48,13,13,'#c4b28b');
    oval(c,x+66,y-45,7,7,'#c49158');px(c,x+68,y-46,4,2,'#77936d');px(c,x+67,y-44,2,1,'#e4c084');
    // Wicker trays, jars and a rolled mooring line belong to the stall, not the pickup path.
    oval(c,x+3,y-13,15,6,'#a28d6c');px(c,x+4,y-12,13,1,'#d2b68b');
    for(let i=0;i<4;i++){px(c,x+6+i*3,y-17,2,5,'#b8835e');px(c,x+6+i*3,y-17,2,1,'#dfbd8a');}
    for(const xx of [x+23,x+29]){px(c,xx,y-15,4,7,'#7e998b');px(c,xx+1,y-17,2,3,'#8e9d88');px(c,xx+1,y-14,1,4,'#c7c8a2');}
    for(let i=0;i<3;i++){oval(c,x+14+i,y-4-i*2,16-i*2,3,'#a99c7a');px(c,x+18+i,y-4-i*2,7-i,1,'#d1bb93');}
    if(variant%2){px(c,x+53,y-39,1,9,'#877f6d');px(c,x+50,y-31,7,10,'#927960');flame(c,x+51,y-30,time,true);px(c,x+49,y-32,9,2,'#b5a07c');}
}

function mill(c:C,x:number,y:number,time:number):void {
    polygon(c,x,y,[[19,0],[24,-72],[45,-72],[51,0]],'#aaaF99');
    polygon(c,x,y,[[23,0],[28,-72],[37,-72],[38,0]],'#d0cfaa');
    tiledRoof(c,x+17,y-85,38,12,true);smallWindow(c,x+31,y-40,false,7,10);
    px(c,x+29,y-15,12,15,'#7b8e80');px(c,x+31,y-14,8,14,'#999f84');px(c,x+31,y-10,8,1,'#6f847a');
    px(c,x+17,y-2,36,3,'#b6bfa3');
    const hubX=x+35,hubY=y-58,angle=-.48+Math.floor(time*3)*.045;
    // Linen lattice sails rotate in pixel steps around one shared bearing.
    for(let blade=0;blade<4;blade++){
        const a=angle+blade*Math.PI/2,cos=Math.cos(a),sin=Math.sin(a);
        const rotate=(xx:number,yy:number):readonly [number,number]=>[Math.round(xx*cos-yy*sin),Math.round(xx*sin+yy*cos)];
        const tip=rotate(0,-36);line(c,hubX,hubY,hubX+tip[0],hubY+tip[1],'#897f6b');
        polygon(c,hubX,hubY,[[0,-10],[0,-36],[10,-36],[7,-10]].map(([xx,yy])=>rotate(xx,yy)),'#d4d0ab');
        for(let rib=-13;rib>=-35;rib-=6){const a=rotate(0,rib),b=rotate(8,rib);line(c,hubX+a[0],hubY+a[1],hubX+b[0],hubY+b[1],'#9da488');}
    }
    oval(c,hubX-4,hubY-4,9,9,'#887963');oval(c,hubX-2,hubY-2,5,5,'#c2ad81');
    px(c,x+11,y-7,6,7,'#929e78');px(c,x+12,y-9,4,2,'#b0b68a');
}

function bell(c:C,x:number,y:number,clock:boolean,time:number):void {
    masonry(c,x+14,y-88,35,88,'#a7b2a1','#cbd0b2','#8d9f94',2);
    px(c,x+15,y-86,3,84,'#d2d4b5');px(c,x+43,y-86,5,84,'#8f9f94');
    polygon(c,x+8,y-102,[[0,13],[4,9],[12,6],[17,0],[31,0],[34,6],[42,10],[47,13]],'#8c777c');
    px(c,x+6,y-88,51,3,'#c9c5a4');px(c,x+10,y-91,43,3,'#b09b84');px(c,x+30,y-110,2,9,'#bda378');
    stoneArch(c,x+21,y-79,21,29,'#c7c9ad','#e0d8b9','#889a91');
    px(c,x+30,y-75,2,7,'#9f8565');polygon(c,x+25,y-68,[[2,0],[10,0],[10,9],[13,13],[-1,13],[2,9]],'#b99c6e');px(c,x+26,y-57,11,2,'#dbc193');px(c,x+28,y-65,2,7,'#dfc495');px(c,x+30,y-54,3,3,'#9b8768');
    if(clock){
        oval(c,x+23,y-44,18,18,'#7e8b89');oval(c,x+25,y-42,14,14,'#d0c8a6');
        const hand=Math.floor(time*.8)*Math.PI/12;
        line(c,x+31,y-34,x+31+Math.round(Math.sin(hand)*5),y-34-Math.round(Math.cos(hand)*5),'#817e76');px(c,x+31,y-34,5,1,'#817e76');
        for(const [dx,dy] of [[0,-6],[6,0],[0,6],[-6,0]])px(c,x+31+dx,y-34+dy,1,1,'#9b8d76');
        const pendulum=Math.round(Math.sin(Math.floor(time*8)*Math.PI/16)*5);
        px(c,x+25,y-23,14,15,'#7c8c85');line(c,x+31,y-23,x+31+pendulum,y-12,'#d0b38c');oval(c,x+28+pendulum,y-15,7,7,'#ba9d71');px(c,x+29+pendulum,y-14,3,1,'#e0c395');
    }else{smallWindow(c,x+28,y-38,false,8,14);cloth(c,x+5,y-42,11,29,time);}
    px(c,x+10,y-7,43,7,'#9ba897');px(c,x+8,y-3,47,3,'#c6caae');
    foliage(c,x-8,y-15,'#638771','#8ba07b','#b0b791');
}

function fountain(c:C,x:number,y:number,inside:boolean,time:number):void {
    const dark=inside?'#807078':'#8ba28e',base=inside?'#ad8f83':'#bbc3a1',light=inside?'#d0b295':'#ddd6af';
    for(const xx of [x-4,x+73]){px(c,xx,y-39,5,37,dark);px(c,xx-3,y-41,11,3,base);px(c,xx+1,y-36,1,32,light);}
    oval(c,x+3,y-13,65,14,dark);oval(c,x+5,y-15,61,12,base);oval(c,x+10,y-14,51,6,'#8eb4a1');px(c,x+17,y-10,37,1,'#cfdbb5');
    px(c,x+31,y-49,10,36,dark);px(c,x+32,y-48,4,33,base);px(c,x+27,y-18,18,4,light);
    polygon(c,x+15,y-63,[[0,0],[43,0],[39,12],[33,17],[12,17],[5,12]],base);
    px(c,x+13,y-65,47,3,dark);px(c,x+15,y-65,43,1,light);px(c,x+23,y-60,3,9,light);px(c,x+26,y-51,7,2,light);
    for(const xx of [x+17,x+55]){
        waterRibbons(c,xx,y-59,3,44,time);
    }
    oval(c,x+30,y-76,13,11,dark);oval(c,x+31,y-77,11,10,base);px(c,x+33,y-76,3,2,light);
    px(c,x+36,y-82,2,7,dark);px(c,x+38,y-81,5,2,'#8fa47e');
    for(let step=0;step<3;step++)px(c,x+step*3-2,y+step*2,77-step*6,2,step%2?dark:base);
    for(const xx of [x+10,x+57]){px(c,xx,y-8,5,4,dark);px(c,xx+1,y-7,3,2,'#91ada0');px(c,xx+2,y-8,1,1,light);}
}

function archive(c:C,x:number,y:number,time:number,variant:number):void {
    masonry(c,x-4,y-72,83,73,'#87797b','#b49a8d','#6c6570',4);
    stoneArch(c,x+3,y-76,69,77,'#b19b8b','#d4b89a','#857577');
    polygon(c,x+13,y-62,[[0,14],[8,2],[18,0],[31,0],[43,6],[48,14],[48,61],[0,61]],'#78646a');
    for(let yy=-41;yy<-5;yy+=18){
        px(c,x+17,y+yy,40,2,'#b4987d');
        for(let i=0;i<7;i++){const h=9+(i*5)%6;px(c,x+18+i*5,y+yy-h,3,h,i%3?'#9e9b86':'#b5947d');px(c,x+18+i*5,y+yy-h+2,3,1,'#c4b396');}
    }
    px(c,x+36,y-59,2,58,'#b0957e');px(c,x+11,y-3,51,3,'#bba58d');
    px(c,x+13,y-88,48,12,'#8e7a71');px(c,x+15,y-87,44,10,'#c5ad8b');
    polygon(c,x+24,y-85,[[0,0],[12,1],[13,3],[15,1],[27,0],[27,7],[15,8],[13,10],[11,8],[0,7]],'#e0c8a3');px(c,x+37,y-83,1,7,'#977f6b');
    barrel(c,x-12,y-18,true);crate(c,x+67,y-14);
    // A reading desk varies the rhythm of casks and shelves; the opened page settles in four poses.
    px(c,x+19,y-15,45,4,'#795c5c');px(c,x+20,y-15,43,1,'#bd9a7e');px(c,x+22,y-11,3,11,'#8e7469');px(c,x+57,y-11,3,11,'#8e7469');
    const page=Math.floor(time*2+variant)%8,lift=page===5?4:page===6?2:0;
    polygon(c,x+27,y-21,[[0,0],[12,2],[23,-lift],[24,6],[12,8],[0,6]],'#d2bc97');
    line(c,x+39,y-19,x+39,y-13,'#937c6c');px(c,x+30,y-18,6,1,'#a4947a');px(c,x+42,y-18-lift*.5,6,1,'#a4947a');
    px(c,x+53,y-22,4,7,'#c6b393');px(c,x+54,y-24,1,3,'#836760');flame(c,x+53,y-29,time,true);
    if(variant%2){px(c,x+17,y-25,6,10,'#647e78');px(c,x+18,y-28,3,4,'#8da190');px(c,x+18,y-23,1,5,'#bbbaa0');}
}

function factory(c:C,x:number,y:number,variant:number,time:number):void {
    const bx=x+8,w=59;
    oval(c,bx,y-81,w,16,'#b4a691');px(c,bx,y-73,w,65,'#8e8e85');px(c,bx+3,y-73,w-13,66,'#a5a18c');px(c,bx+8,y-72,5,63,'#c4b79c');oval(c,bx,y-15,w,14,'#888b82');
    for(const yy of [-69,-35,-10]){
        px(c,bx-3,y+yy,w+6,4,'#938774');px(c,bx-2,y+yy,w+4,1,'#cfb992');
        for(let xx=4;xx<w;xx+=11)px(c,bx+xx,y+yy+2,1,1,'#d9c39c');
    }
    oval(c,bx+22,y-61,20,20,'#7e817d');oval(c,bx+25,y-58,14,14,'#d0c5a4');line(c,bx+32,y-51,bx+34+Math.round(Math.sin(time*.6)),y-56,'#9b786b');
    px(c,bx+19,y-27,28,11,'#8d8d7c');px(c,bx+21,y-25,24,1,'#beb59a');px(c,bx+25,y-21,16,1,'#beb59a');
    px(c,bx+4,y-4,7,6,'#77847b');px(c,bx+49,y-4,7,6,'#77847b');
    px(c,bx+w,y-58,18,8,'#81887b');px(c,bx+w+12,y-54,7,53,'#81887b');px(c,bx+w,y-57,17,2,'#baad8b');px(c,bx+w+13,y-54,2,51,'#baad8b');
    for(let yy=-48;yy<-2;yy+=17)px(c,bx+w+10,y+yy,11,3,'#959783');
    if(variant%2){px(c,bx-9,y-95,6,46,'#908e7d');px(c,bx-8,y-94,2,43,'#b7aa8c');px(c,bx-12,y-96,12,3,'#b5a58a');chimneyVapor(c,bx-6,y-99,time);}
    else{px(c,bx+19,y-91,21,12,'#9b9a87');px(c,bx+17,y-92,25,3,'#c2b598');}
    drive(c,bx+5,y-19,time);
}

function garden(c:C,x:number,y:number,variant:number,roots:boolean,time:number):void {
    if(variant%2===0){
        citrusTree(c,x+5,y-95,1,false,time);citrusTree(c,x+61,y-82,0,false,time+1);
        // A bench and irrigation trough tell the orchard's story at human scale.
        px(c,x+5,y-12,29,3,'#a19a77');px(c,x+8,y-9,3,9,'#7b8b6b');px(c,x+29,y-9,3,9,'#7b8b6b');
        px(c,x+6,y-19,2,8,'#7b8b6b');px(c,x+32,y-19,2,8,'#7b8b6b');px(c,x+6,y-19,28,3,'#b1ab80');
        px(c,x+45,y-5,28,5,'#9aaa89');px(c,x+47,y-5,24,1,'#c0c9a0');
    }else{
        const dark=roots?'#809677':'#889b83';
        stoneArch(c,x+4,y-69,86,69,dark,'#b7bea0','#6b8e78');px(c,x,y-71,94,3,'#c0c3a0');
        for(const [xx,yy] of [[-1,-79],[24,-84],[51,-81],[72,-73]])foliage(c,x+xx,y+yy,'#3c6e54','#679660','#9fba7b');
        for(const [xx,yy] of [[6,-53],[80,-48],[9,-30]]){px(c,x+xx,y+yy,2,22,'#5f875c');px(c,x+xx-2,y+yy+7,5,3,'#89aa6c');}
        for(const [xx,yy] of [[9,-68],[23,-75],[53,-71],[73,-62],[80,-41]]){
            const sway=Math.round(Math.sin(time*.8+xx)*1);px(c,x+xx+sway,y+yy,2,5,'#829267');
            px(c,x+xx-1+sway,y+yy+1,4,2,roots?'#b7c9a0':'#b89daa');px(c,x+xx+sway,y+yy+2,1,1,'#e0cfaa');
        }
        px(c,x+28,y-16,39,3,'#a3ad89');px(c,x+32,y-13,3,13,'#829a79');px(c,x+59,y-13,3,13,'#829a79');
        for(const xx of [x+33,x+54]){px(c,xx,y-20,5,4,'#c4c7a0');px(c,xx+1,y-21,3,1,'#d7d5b1');}
    }
}

function crown(c:C,x:number,y:number,time:number):void {
    for(const dx of [-4,72]){
        const xx=x+dx;
        masonry(c,xx,y-92,24,93,'#a19ba3','#bfb0ae','#8b8999',9);
        polygon(c,xx-3,y-110,[[0,18],[8,10],[14,0],[19,10],[30,18]],'#88758c');line(c,xx+10,y-106,xx-1,y-93,'#b297a1');
        px(c,xx-3,y-93,30,3,'#d3bcac');smallWindow(c,xx+8,y-80,true,7,16);smallWindow(c,xx+8,y-45,true,7,13);
    }
    stoneArch(c,x+18,y-74,55,74,'#b2a3a8','#dcc0ac','#928c9a');
    polygon(c,x+13,y-88,[[0,14],[32,0],[65,14]],'#9b8b9c');px(c,x+13,y-73,65,3,'#d7bda9');
    px(c,x+32,y-33,29,31,'#918594');for(let k=0;k<5;k++)px(c,x+34+k*6,y-32,1,29,'#c0aa9c');
    px(c,x+31,y-26,31,2,'#ac9690');px(c,x+30,y-14,33,2,'#ac9690');
    polygon(c,x+35,y-60,[[0,0],[5,5],[10,-2],[16,5],[22,0],[20,15],[2,15]],'#c9ad85');px(c,x+38,y-44,16,2,'#e1c599');
    for(const xx of [x+14,x+68])cloth(c,xx,y-68,8,30,time,true);
    px(c,x-8,y-3,108,3,'#baa9a4');
}

export function drawDeliciaLandmarks(c:C,sim:DeliciaSimulation,time:number):void {
    const cx=sim.cameraX/U,cy=sim.cameraY/U;
    (sim.stage.zones??[]).forEach((zone,index)=>{
        const x=Math.round((zone.x/U-cx)*.7+610/U),y=148-Math.round(cy*.56);
        if(!visible(x-18,150))return;
        switch(zone.landmark){
            case 'port':market(c,x,y,index,time);break;
            case 'mill':mill(c,x,y,time);break;
            case 'bell':bell(c,x,y,sim.stage.id==='delicia-relogio',time);break;
            case 'crown':crown(c,x-9,y,time);break;
            case 'archive':archive(c,x,y,time,index);break;
            case 'factory':factory(c,x,y,index,time);break;
            case 'garden':garden(c,x-10,y,index,sim.stage.id==='delicia-raizes',time);break;
            case 'chalice':fountain(c,x,y,sim.stage.biome==='cellar',time);break;
            case 'arches':
                if(sim.stage.biome==='aqueduct'){
                    const end=sim.stage.zones?.[index+1]?.x??sim.stage.width;
                    const bridge=sim.stage.floors.find(f=>f.requiresValve&&f.x>=zone.x&&f.x<end);
                    const source=bridge?.requiresValve??sim.stage.valves[0]?.id;
                    const restored=source!==undefined&&sim.valves.has(source);
                    // Set the bearing inside the arch opening, above the platform silhouette.
                    wheel(c,x+23,y-26,19,restored?time:0);
                    if(restored)waterRibbons(c,x+4,y-49,4,45,time);
                }
                for(let i=0;i<2;i++)stoneArch(c,x+i*45,y-52,45,52,'#a9bca6','#d3d5b2','#86a08f');
                px(c,x-3,y-54,96,3,'#cdd2ae');
                if(sim.stage.biome==='aqueduct'){
                    px(c,x+21,y-27,38,3,'#a2977a');px(c,x+22,y-27,36,1,'#d0bf97');
                    px(c,x+51,y-28,7,5,'#899b8a');px(c,x+52,y-28,2,5,'#bcc4a3');
                }
                px(c,x+34,y-66,24,12,'#98ac98');px(c,x+36,y-64,20,8,'#c9caab');
                for(const xx of [x+39,x+48]){px(c,xx,y-62,5,1,'#8b9e87');px(c,xx+1,y-60,4,1,'#8b9e87');}
                foliage(c,x+68,y-62,'#57856c','#84a176','#b3be8f');
                break;
        }
    });
}
