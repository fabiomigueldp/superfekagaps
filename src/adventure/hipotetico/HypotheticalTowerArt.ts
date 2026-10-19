import {box,oval,pixelLine,polygon,type Point} from '../WorldPainting';
import {BASTION_TOWER,type HypotheticalTower} from './HypotheticalTower';
import {towerBodyPoint,TOWER_RELEASE,type TowerPart} from './HypotheticalTowerPhysics';
import {smoothMotion} from './HypotheticalMotion';
import {drawScenicShadow} from './HypotheticalSceneShadow';
export {drawTowerEffects,drawTowerDebris} from './HypotheticalTowerEffects';

const P={dark:'#536e70',joint:'#6c8279',stone:'#94a18b',side:'#7e9384',light:'#b6b69a',cap:'#c5bb96',
    roof:'#718a80',roofLight:'#a8af94',deep:'#405f66',bell:'#ae986d',bellLight:'#d3b883',soot:'#5e7270'};
function partPainter(c:CanvasRenderingContext2D,x:number,base:number,part:TowerPart,tower:HypotheticalTower){
    const body=tower.destruction.bodies[part];
    const point=(xx:number,yy:number):Point=>{const p=towerBodyPoint(body,xx,yy);return [x+p[0],base+p[1]];};
    const poly=(v:Point[],color:string)=>polygon(c,v.map(([xx,yy])=>point(xx,yy)),color);
    const line=(a:number,b:number,d:number,e:number,color:string,width=1)=>{
        const u=point(a,b),v=point(d,e);pixelLine(c,u[0],u[1],v[0],v[1],color,width);
    };
    const rect=(a:number,b:number,w:number,h:number,color:string)=>poly([[a,b],[a+w,b],[a+w,b+h],[a,b+h]],color);
    return {poly,line,rect,point};
}
function brokenBelfry(c:CanvasRenderingContext2D,x:number,base:number,tower:HypotheticalTower){
    for(const [id,left,right] of [['pier-left',-23,-11],['pier-right',12,26]] as const){
        const p=partPainter(c,x,base,id,tower);
        p.poly([[left,-101],[left+5,-102],[right,-100],[right,-70],[right-3,-67],[left+2,-66],[left,-69]],P.dark);
        p.poly([[left+1,-99],[right-1,-98],[right-1,-72],[right-4,-69],[left+2,-68]],P.stone);
        p.line(left+2,-98,left+2,-69,P.light,2);p.line(right-1,-99,right-1,-71,P.side,2);
        for(let yy=-95;yy<-69;yy+=6){p.line(left+2,yy,right-2,yy,P.joint);p.line(left+3,yy+1,right-3,yy+1,P.light);}
        p.line(left+2,-82,right-3,-79,P.dark);p.line(right-3,-79,right-4,-75,P.dark);
        // The ends of the broken bell support stay attached to their jambs.
        const inner=id==='pier-left'?right:left,sign=id==='pier-left'?1:-1;
        p.poly([[inner-sign*3,-90],[inner+sign*5,-89],[inner+sign*3,-87],[inner+sign*6,-86],[inner-sign*3,-87]],'#7c8370');
        p.line(inner-sign*2,-89,inner+sign*3,-88,'#b4ac8a');
    }
    const lintel=partPainter(c,x,base,'lintel',tower);
    lintel.poly([[-11,-102],[12,-102],[12,-90],[7,-94],[0,-97],[-5,-94],[-11,-89]],P.joint);
    lintel.poly([[-9,-101],[10,-101],[10,-94],[0,-98],[-9,-94]],P.stone);
    lintel.line(-9,-101,10,-101,P.cap,2);lintel.line(-8,-95,-2,-98,P.light,2);lintel.line(3,-98,9,-95,P.light,2);
    const sill=partPainter(c,x,base,'sill',tower);
    sill.poly([[-11,-70],[12,-70],[10,-67],[4,-68],[-1,-66],[-9,-67]],P.side);sill.line(-10,-70,11,-70,P.cap,2);
}
function brokenRoof(c:CanvasRenderingContext2D,x:number,base:number,tower:HypotheticalTower){
    const left=partPainter(c,x,base,'roof-left',tower),right=partPainter(c,x,base,'roof-right',tower);
    left.poly([[-30,-102],[-22,-109],[0,-114],[-1,-109],[1,-106],[-1,-102]],P.dark);
    left.poly([[-25,-104],[-19,-108],[-2,-111],[-3,-104]],P.roof);
    right.poly([[0,-114],[24,-109],[32,-102],[0,-102],[2,-106],[0,-109]],P.dark);
    right.poly([[3,-110],[21,-107],[27,-104],[3,-104]],P.roof);
    left.line(-28,-102,-2,-102,P.cap,2);right.line(2,-102,30,-102,P.cap,2);
    for(let j=0;j<3;j++)left.line(-19+j*6,-108+Math.abs(j-3)*.55,-22+j*7,-104,P.roofLight);
    for(let j=4;j<7;j++)right.line(-19+j*6,-108+Math.abs(j-3)*.55,-22+j*7,-104,P.roofLight);
    left.line(-1,-111,-3,-105,P.side);right.line(2,-109,3,-105,P.side);
    // Split joists are exposed under the tiles instead of one rigid roof slab.
    left.line(-21,-101,-7,-101,'#9b9c82',2);left.line(-6,-103,-3,-100,'#c0b694');
    right.line(5,-101,22,-101,'#9b9c82',2);right.line(3,-103,6,-100,'#c0b694');
    right.line(1,-111,1,-113,P.dark);right.line(1,-112,7,-112,P.light);
}
function masonry(p:ReturnType<typeof partPainter>,top:number,height:number,broken=false){
    if(broken){
        const bottom=top+height;
        p.poly([[-23,top+2],[-15,top],[-9,top+3],[-3,top+1],[5,top+2],[12,top],[22,top+2],
            [26,top+4],[26,bottom-3],[19,bottom-1],[13,bottom-3],[8,bottom],[1,bottom-3],
            [-6,bottom],[-12,bottom-3],[-19,bottom],[-23,bottom-3]],P.joint);
        p.poly([[-20,top+3],[-14,top+2],[-8,top+5],[-2,top+3],[6,top+4],[12,top+2],[19,top+4],
            [19,bottom-3],[13,bottom-5],[8,bottom-2],[1,bottom-5],[-6,bottom-2],[-12,bottom-5],[-20,bottom-3]],P.stone);
        p.poly([[19,top+3],[26,top+4],[26,bottom-3],[19,bottom-1]],P.side);
        for(let yy=top+6,row=0;yy<bottom-4;yy+=6,row++){
            p.line(-20,yy,18,yy,P.joint);
            for(let col=0;col<3;col++){
                const xx=-17+col*13+(row%2?5:0);if(xx>16)continue;
                p.line(xx,yy-3,xx,yy,P.side);p.line(xx+1,yy-3,Math.min(17,xx+8),yy-3,P.light);
            }
        }
        for(const dx of [-22,18])for(let yy=top+4;yy<bottom-4;yy+=8){
            const h=Math.min(6,bottom-4-yy);p.rect(dx,yy,5,h,P.side);p.line(dx,yy,dx+4,yy,P.cap);
        }
        for(const [xx,yy] of [[-19,top+2],[-7,top+3],[8,top+2],[-17,bottom-3],[3,bottom-3]]){
            p.line(xx,yy,xx+5,yy+1,P.cap);p.line(xx,yy+1,xx+2,yy+3,P.side);
        }
        return;
    }
    p.rect(-23,top,46,height,P.joint);p.rect(-20,top+1,39,height-1,P.stone);
    p.poly([[19,top],[26,top+3],[26,top+height],[19,top+height]],P.side);
    for(let row=0;row<Math.floor(height/6);row++){
        const yy=top+row*6;p.line(-20,yy,19,yy,P.joint);
        for(let col=0;col<3;col++){
            const xx=-19+col*14+(row%2?6:0);if(xx>17)continue;
            p.line(xx,yy+1,xx,yy+5,P.side);p.line(xx+2,yy+1,Math.min(18,xx+9),yy+1,P.light);
        }
    }
    for(const dx of [-23,18])for(let row=0;row<Math.ceil(height/8);row++){
        const yy=top+row*8,h=Math.min(7,top+height-yy);p.rect(dx,yy,6,h,P.side);p.line(dx,yy,dx+5,yy,P.cap);p.line(dx,yy+1,dx,yy+h-1,P.light);
    }
}
function bell(c:CanvasRenderingContext2D,x:number,y:number,angle:number,clapper:number){
    const co=Math.cos(angle),si=Math.sin(angle),at=(a:number,b:number):Point=>[x+a*co-b*si,y+a*si+b*co];
    polygon(c,[[-4,-7],[4,-7],[6,1],[10,5],[-10,5],[-6,1]].map(([a,b])=>at(a,b)),P.dark);
    polygon(c,[[-3,-6],[3,-6],[5,1],[8,3],[-8,3],[-5,1]].map(([a,b])=>at(a,b)),P.bell);
    polygon(c,[[-7,4],[7,4],[5,6],[-5,6]].map(([a,b])=>at(a,b)),P.deep);
    for(const [a,b,d,e,col] of [[-3,-5,-4,1,P.bellLight],[-8,3,8,3,P.bellLight],[3,-4,5,1,'#8a8f72']] as const){
        const u=at(a,b),v=at(d,e);pixelLine(c,u[0],u[1],v[0],v[1],col,2);
    }
    const pivot=at(0,-2),tip=at(Math.sin(clapper)*8,-2+Math.cos(clapper)*8);
    pixelLine(c,...pivot,...tip,P.dark);box(c,tip[0]-1,tip[1],3,2,P.bellLight);
    const band1=at(-4,-1),band2=at(4,-1);pixelLine(c,...band1,...band2,'#c1aa7d');
}

/** The former static tower is assembled from the same parts before and after
 * the shot. Its foundation stays on the rear street at every camera height. */
export function drawBastionTower(c:CanvasRenderingContext2D,tower:HypotheticalTower,base:number,cameraX:number,reduced:boolean,time:number){
    const x=BASTION_TOWER.x-cameraX,age=tower.impactAge;
    if(x<-110||x>370)return;
    drawScenicShadow(c,x-34,base-5,75,8,.3);
    box(c,x-29,base-10,60,7,P.dark);box(c,x-28,base-11,58,3,P.light);box(c,x-26,base-24,52,13,P.stone);
    box(c,x-8,base-24,18,18,P.deep);pixelLine(c,x-7,base-23,x-7,base-5,P.side);
    for(const d of [-1,1]){
        polygon(c,[[x+d*19,base-29],[x+d*25,base-26],[x+d*31,base-6],[x+d*18,base-6]],P.side);
        pixelLine(c,x+d*20,base-27,x+d*22,base-9,P.light,2);
        box(c,x+d*22-3,base-16,7,1,P.joint);box(c,x+d*22-2,base-8,7,2,P.cap);
    }
    if(age>=0)for(const body of Object.values(tower.destruction.bodies)){
        if(body.hidden||body.attached)continue;
        const s=tower.destruction.shadow(body),near=1-smoothMotion(s.height/80),width=Math.max(8,s.width*(.48+near*.28));
        drawScenicShadow(c,x+body.x-width/2,base+s.y-1,width,near>.8?3:2,.16+near*.25);
    }
    const arch=partPainter(c,x,base,'arch',tower);masonry(arch,-42,18,age>=TOWER_RELEASE.arch);
    arch.poly([[-9,-24],[-9,-33],[-6,-38],[0,-40],[7,-38],[10,-33],[10,-24]],P.deep);
    for(const d of [-1,1])arch.line(d*11,-25,d*11,-33,P.cap,2);
    arch.line(-7,-38,-3,-41,P.cap,2);arch.line(3,-41,8,-38,P.cap,2);
    const shaft=partPainter(c,x,base,'shaft',tower);masonry(shaft,-66,24,age>=8);
    shaft.rect(-5,-58,11,10,P.side);shaft.poly([[0,-57],[4,-53],[0,-49],[-3,-53]],P.light);
    if(age<8){
        shaft.rect(-25,-66,51,4,P.joint);shaft.line(-26,-66,26,-66,P.cap,2);shaft.line(-23,-62,23,-62,P.light);
    }else{
        shaft.poly([[-25,-66],[-10,-66],[-5,-64],[-9,-61],[-24,-62]],P.side);
        shaft.poly([[7,-65],[25,-66],[26,-62],[12,-62]],P.side);
        shaft.line(-25,-66,-10,-66,P.cap,2);shaft.line(10,-65,25,-66,P.cap,2);
        shaft.poly([[-10,-64],[-4,-66],[4,-63],[7,-64],[12,-58],[7,-54],[1,-55],[-2,-58],[-9,-59]],P.soot);
        shaft.poly([[-7,-63],[-3,-64],[3,-61],[7,-61],[9,-58],[4,-56],[-1,-59],[-6,-59]],P.deep);
        shaft.poly([[-7,-63],[-3,-64],[-1,-61],[-3,-60]],'#b6ad8c');
        shaft.poly([[2,-57],[8,-59],[6,-55],[1,-55]],'#acaa8c');
        shaft.line(-8,-64,-1,-61,P.dark);shaft.line(1,-55,7,-54,P.light);
        shaft.line(7,-62,9,-59,P.light);shaft.line(-9,-58,-6,-56,P.joint);
    }
    if(age>=0){
        shaft.line(-20,-63,-9,-59,P.dark,2);
        if(age>4){shaft.line(-9,-59,-3,-52,P.dark);shaft.line(-3,-52,8,-49,P.dark);}
        if(age>10){shaft.line(2,-66,5,-59,P.deep);shaft.line(5,-59,15,-54,P.deep);shaft.line(14,-53,17,-50,P.light);}
    }
    const b=partPainter(c,x,base,'belfry',tower);
    if(tower.destruction.bodies.belfry.hidden)brokenBelfry(c,x,base,tower);
    else{
    masonry(b,-102,36,age>=28);
    b.poly([[-12,-69],[-12,-88],[-9,-95],[-3,-99],[4,-99],[11,-94],[14,-87],[14,-69]],P.dark);
    b.poly([[-9,-70],[-9,-87],[-6,-93],[0,-96],[7,-93],[11,-87],[11,-70]],P.deep);
    b.line(-12,-72,-12,-88,P.cap,2);b.line(14,-72,14,-88,P.side,2);
    b.line(-9,-94,-3,-98,P.light,2);b.line(3,-98,10,-94,P.light,2);
    b.line(-10,-88,12,-88,'#82917a',3);b.line(-9,-89,11,-89,P.light);
    if(age<28)b.line(-21,-69,22,-69,P.cap,2);
    else{b.line(-21,-69,-8,-69,P.cap,2);b.line(5,-70,21,-69,P.cap,2);b.line(-8,-69,-4,-73,P.dark);}
    for(const d of [-1,1]){b.rect(d*18-1,-99,3,25,P.light);b.line(d*19,-78,d*19,-75,P.side);}
    }
    if(tower.destruction.bodies.roof.hidden)brokenRoof(c,x,base,tower);
    else{
    const roof=partPainter(c,x,base,'roof',tower);
    roof.poly([[-30,-102],[-22,-109],[0,-114],[24,-109],[32,-102]],P.dark);
    roof.poly([[-25,-104],[-19,-108],[0,-111],[21,-107],[27,-104]],P.roof);
    roof.line(-26,-104,27,-104,P.roofLight);roof.line(-28,-102,30,-102,P.cap,2);
    for(let j=0;j<7;j++)roof.line(-19+j*6,-108+Math.abs(j-3)*.55,-22+j*7,-104,P.roofLight);
    roof.line(0,-111,0,-113,P.dark);roof.line(-4,-112,7,-112,P.light);roof.poly([[7,-113],[10,-112],[7,-111]],P.side);
    }
    const bronze=tower.destruction.bodies.bell,sway=age<0&&!reduced?Math.sin(time/90)*.07:0;
    if(bronze.attached){
        const u=b.point(0,-88);pixelLine(c,u[0],u[1],x+bronze.x+Math.sin(sway)*8,base+bronze.y-6,P.bellLight,2);
    }else if(!tower.destruction.bodies.belfry.hidden){
        const a=age-TOWER_RELEASE.bell,swing=Math.sin(a*.35)*Math.exp(-a/20)*2;
        b.line(0,-88,swing,-85,P.bellLight);b.line(swing,-85,swing-2,-83,P.side);
    }
    bell(c,x+bronze.x+Math.sin(sway)*8,base+bronze.y,bronze.angle+sway,age<0?-sway*.6:tower.destruction.clapper);
    if(age>28){
        pixelLine(c,x-25,base-24,x-18,base-20,P.dark);pixelLine(c,x+15,base-21,x+24,base-16,P.dark);
        box(c,x-15,base-7,3,2,P.side);box(c,x+27,base-5,6,2,P.light);
    }
    if(age>=0&&age<16&&!reduced){
        // The flash briefly catches nearby edges, rather than brightening the
        // entire scene or washing out the foreground combat silhouettes.
        c.save();c.globalAlpha=smoothMotion((age+1)/2)*(1-smoothMotion((age-3)/13))*.5;
        shaft.line(-23,-62,-11,-62,'#dcc29b',2);shaft.line(10,-62,23,-62,'#dcc29b',2);
        arch.line(-20,-41,20,-41,'#cab996');b.line(-20,-69,20,-69,'#dcc29b',2);
        b.line(13,-85,13,-71,'#cab996');
        const bronzeLight=partPainter(c,x,base,'bell',tower);bronzeLight.line(-7,-76,7,-76,'#e0c497');
        c.restore();
    }
}

