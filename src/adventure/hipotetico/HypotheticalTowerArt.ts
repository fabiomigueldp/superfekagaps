import {box,oval,pixelLine,polygon,type Point} from '../WorldPainting';
import {smoothMotion} from './HypotheticalMotion';
import {BASTION_TOWER,type HypotheticalTower} from './HypotheticalTower';

const P={dark:'#536e70',joint:'#6c8279',stone:'#94a18b',side:'#7e9384',light:'#b6b69a',cap:'#c5bb96',
    roof:'#718a80',roofLight:'#a8af94',deep:'#405f66',bell:'#ae986d',bellLight:'#d3b883',soot:'#5e7270'};
type Part='arch'|'shaft'|'belfry'|'roof';
const PARTS={arch:{y:-33,delay:70,time:84,x:-22,floor:-12,angle:-.32},
    shaft:{y:-54,delay:18,time:74,x:14,floor:-19,angle:.57},
    belfry:{y:-83,delay:28,time:98,x:42,floor:-29,angle:1.18},
    roof:{y:-104,delay:22,time:55,x:69,floor:-13,angle:.34}} as const;

export function towerPartMotion(part:Part,age:number,reduced=false){
    const p=PARTS[part],t=Math.max(0,Math.min(1,(age-p.delay)/p.time)),land=age-p.delay-p.time;
    const settle=reduced||land<0||land>24?0:Math.sin(land*Math.PI/12)*(1-land/24);
    const tremor=reduced||age<0||age>p.delay?0:Math.sin(age*1.3)*(1-age/(p.delay+1))*.75;
    return {x:p.x*smoothMotion(t)+tremor,y:p.y+(p.floor-p.y)*t*t-settle*2,
        angle:p.angle*Math.pow(t,1.3)+settle*.022};
}
function partPainter(c:CanvasRenderingContext2D,x:number,base:number,part:Part,age:number,reduced:boolean){
    const m=towerPartMotion(part,age,reduced),co=Math.cos(m.angle),si=Math.sin(m.angle),cy=PARTS[part].y;
    const point=(xx:number,yy:number):Point=>[x+m.x+xx*co-(yy-cy)*si,base+m.y+xx*si+(yy-cy)*co];
    const poly=(v:Point[],color:string)=>polygon(c,v.map(([xx,yy])=>point(xx,yy)),color);
    const line=(a:number,b:number,d:number,e:number,color:string,width=1)=>{
        const u=point(a,b),v=point(d,e);pixelLine(c,u[0],u[1],v[0],v[1],color,width);
    };
    const rect=(a:number,b:number,w:number,h:number,color:string)=>poly([[a,b],[a+w,b],[a+w,b+h],[a,b+h]],color);
    return {poly,line,rect,point};
}
function masonry(p:ReturnType<typeof partPainter>,top:number,height:number){
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
function bell(c:CanvasRenderingContext2D,x:number,y:number,angle:number){
    const co=Math.cos(angle),si=Math.sin(angle),at=(a:number,b:number):Point=>[x+a*co-b*si,y+a*si+b*co];
    polygon(c,[[-4,-7],[4,-7],[6,1],[10,5],[-10,5],[-6,1]].map(([a,b])=>at(a,b)),P.dark);
    polygon(c,[[-3,-6],[3,-6],[5,1],[8,3],[-8,3],[-5,1]].map(([a,b])=>at(a,b)),P.bell);
    for(const [a,b,d,e,col] of [[-3,-5,-4,1,P.bellLight],[-8,3,8,3,P.bellLight],[-1,6,2,6,P.dark]] as const){
        const u=at(a,b),v=at(d,e);pixelLine(c,u[0],u[1],v[0],v[1],col,2);
    }
}

/** The former static tower is assembled from the same parts before and after
 * the shot. Its foundation stays on the rear street at every camera height. */
export function drawBastionTower(c:CanvasRenderingContext2D,tower:HypotheticalTower,base:number,cameraX:number,reduced:boolean,time:number){
    const x=BASTION_TOWER.x-cameraX,age=tower.impactAge;
    if(x<-110||x>370)return;
    oval(c,x-34,base-5,75,8,P.joint);
    box(c,x-29,base-10,60,7,P.dark);box(c,x-28,base-11,58,3,P.light);box(c,x-26,base-24,52,13,P.stone);
    box(c,x-8,base-24,18,18,P.deep);pixelLine(c,x-7,base-23,x-7,base-5,P.side);
    for(const d of [-1,1]){
        polygon(c,[[x+d*19,base-29],[x+d*25,base-26],[x+d*31,base-6],[x+d*18,base-6]],P.side);
        pixelLine(c,x+d*20,base-27,x+d*22,base-9,P.light,2);
        box(c,x+d*22-3,base-16,7,1,P.joint);box(c,x+d*22-2,base-8,7,2,P.cap);
    }
    const arch=partPainter(c,x,base,'arch',age,reduced);masonry(arch,-42,18);
    arch.poly([[-9,-24],[-9,-33],[-6,-38],[0,-40],[7,-38],[10,-33],[10,-24]],P.deep);
    for(const d of [-1,1])arch.line(d*11,-25,d*11,-33,P.cap,2);
    arch.line(-7,-38,-3,-41,P.cap,2);arch.line(3,-41,8,-38,P.cap,2);
    const shaft=partPainter(c,x,base,'shaft',age,reduced);masonry(shaft,-66,24);
    shaft.rect(-25,-66,51,4,P.joint);shaft.line(-26,-66,26,-66,P.cap,2);shaft.line(-23,-62,23,-62,P.light);
    shaft.rect(-5,-58,11,10,P.side);shaft.poly([[0,-57],[4,-53],[0,-49],[-3,-53]],P.light);
    if(age>=0){
        shaft.line(-20,-63,-9,-59,P.dark,2);shaft.line(-9,-59,-3,-52,P.dark);shaft.line(-3,-52,8,-49,P.dark);
        if(age>10){shaft.line(2,-66,5,-59,P.deep);shaft.line(5,-59,15,-54,P.deep);}
    }
    const b=partPainter(c,x,base,'belfry',age,reduced);masonry(b,-102,36);
    b.poly([[-12,-69],[-12,-88],[-9,-95],[-3,-99],[4,-99],[11,-94],[14,-87],[14,-69]],P.dark);
    b.poly([[-9,-70],[-9,-87],[-6,-93],[0,-96],[7,-93],[11,-87],[11,-70]],P.deep);
    b.line(-12,-72,-12,-88,P.cap,2);b.line(14,-72,14,-88,P.side,2);
    b.line(-9,-94,-3,-98,P.light,2);b.line(3,-98,10,-94,P.light,2);
    b.line(-10,-88,12,-88,'#82917a',3);b.line(-9,-89,11,-89,P.light);
    b.line(-21,-69,22,-69,P.cap,2);
    for(const d of [-1,1]){b.rect(d*18-1,-99,3,25,P.light);b.line(d*19,-78,d*19,-75,P.side);}
    const roof=partPainter(c,x,base,'roof',age,reduced);
    roof.poly([[-30,-102],[-22,-109],[0,-114],[24,-109],[32,-102]],P.dark);
    roof.poly([[-25,-104],[-19,-108],[0,-111],[21,-107],[27,-104]],P.roof);
    roof.line(-26,-104,27,-104,P.roofLight);roof.line(-28,-102,30,-102,P.cap,2);
    for(let j=0;j<7;j++)roof.line(-19+j*6,-108+Math.abs(j-3)*.55,-22+j*7,-104,P.roofLight);
    roof.line(0,-111,0,-113,P.dark);roof.line(-4,-112,7,-112,P.light);roof.poly([[7,-113],[10,-112],[7,-111]],P.side);
    if(age<48){
        const sway=reduced?0:age<0?Math.sin(time/90)*.07:Math.sin(age/3)*.22;
        const p=b.point(Math.sin(sway)*8,-79);
        const u=b.point(0,-88);pixelLine(c,u[0],u[1],p[0],p[1]-6,P.bellLight,2);
        bell(c,p[0],p[1],towerPartMotion('belfry',age,reduced).angle+sway);
    }else{
        // The bell is released at its exact moving suspension, then rings on
        // landing before the heavier masonry reaches the street.
        const release=partPainter(c,x,base,'belfry',48,reduced).point(0,-79),t=Math.min(1,(age-48)/60);
        const settle=reduced||age>142?0:Math.sin((age-108)*.32)*Math.max(0,1-(age-108)/34)*.13;
        bell(c,release[0]+(x+59-release[0])*t,release[1]+(base-10-release[1])*t*t-Math.sin(Math.PI*t)*7,
            towerPartMotion('belfry',48,reduced).angle+(1.2-towerPartMotion('belfry',48,reduced).angle)*t+(t===1?settle:0));
    }
    if(age>28){
        pixelLine(c,x-25,base-24,x-18,base-20,P.dark);pixelLine(c,x+15,base-21,x+24,base-16,P.dark);
        box(c,x-15,base-7,3,2,P.side);box(c,x+27,base-5,6,2,P.light);
    }
}

/** All effects remain behind the playable plane; no camera takeover or
 * unmarked foreground hazard is introduced by this scenic event. */
export function drawTowerEffects(c:CanvasRenderingContext2D,t:HypotheticalTower,base:number,reduced:boolean){
    const x=BASTION_TOWER.x,age=t.impactAge,launchAge=t.launchAt<0?-1:t.tick-t.launchAt,l=t.launch;
    if(l&&launchAge<20&&launchAge>=0&&!reduced){
        const n=1-launchAge/20,length=(8+launchAge*.7)*n;
        const back=[l.backX-l.dx*length,base+l.backY-l.dy*length] as Point;
        polygon(c,[[l.backX+l.dy*3,base+l.backY-l.dx*3],back,[l.backX-l.dy*3,base+l.backY+l.dx*3]],'#c9ad7e');
        pixelLine(c,l.backX,base+l.backY,back[0],back[1],'#e5c58d',2);
    }
    if(l&&(t.rocket||age>=0&&age<34)){
        const end=t.rocket??{x,y:BASTION_TOWER.hitY},distance=Math.hypot(end.x-l.x,end.y-l.y);
        if(!reduced)for(let i=1;i<12;i++){
            const d=i/12*distance,fade=t.rocket?1:1-age/34;
            box(c,l.x+l.dx*d-l.dy*Math.sin(i)*2,base+l.y+l.dy*d,2+i%3,Math.max(1,2*fade),'#b0b2a0');
        }
        if(t.rocket){
            const r=t.rocket,pt=(a:number,b:number):Point=>[r.x+r.dx*a-r.dy*b,base+r.y+r.dy*a+r.dx*b];
            polygon(c,[pt(5,0),pt(-3,-2),pt(-5,0),pt(-3,2)],'#4f6869');
            polygon(c,[pt(5,0),pt(-2,-1),pt(-3,1)],'#c1bd98');
            polygon(c,[pt(-3,-1),pt(-9-r.age%3,0),pt(-3,1)],reduced?'#a69f83':'#e0bd7b');
        }
    }
    if(age<0)return;
    if(age<18){
        const radius=5+Math.min(age,8)*2,points:Point[]=[];
        for(let j=0;j<12;j++){
            const angle=j*Math.PI/6,r=radius*(j%2?.48:1);
            points.push([x+Math.cos(angle)*r,base+BASTION_TOWER.hitY+Math.sin(angle)*r*.8]);
        }
        polygon(c,points,reduced?'#acaa8c':age<6?'#e7cf97':'#ba956e');
        if(!reduced&&age<7){oval(c,x-5,base+BASTION_TOWER.hitY-5,10,10,'#f0dfae');}
    }
    for(let j=0;j<(reduced?12:28);j++){
        const born=j%6*3,a=age-born;if(a<0)continue;
        const vx=(j%9-4)*.44,vy=-.7-j%5*.35,g=.12;
        const flight=(-vy+Math.sqrt(vy*vy+2*g*59))/g,life=Math.min(a,flight);
        if(a>flight+70&&j>11)continue;
        const px=x+vx*life,py=base-64+vy*life+.5*g*life*life;
        pixelLine(c,px,py,px+2+j%3,py+(j%2?1:-1),j%4?P.stone:P.roof,2);box(c,px,py-1,2,1,P.light);
    }
    if(!reduced)for(let j=0;j<7;j++){
        const a=age-j*7;if(a<0||a>190)continue;
        const fade=Math.min(1,a/8)*(1-smoothMotion((a-100)/90)),w=(8+a*.13)*fade;
        const px=x-9+j%3*8+a*.13,py=base-66-a*.19-j%2*7;
        oval(c,px,py,w,Math.max(2,w*.65),j%2?'#8b988d':'#a4aa97');
        oval(c,px+2,py-2,w*.5,w*.32,'#b2b29b');
    }
    for(const [born,dx] of [[35,6],[77,69],[108,59],[126,42],[154,-22]]){
        const a=age-born;if(a<0||a>76)continue;
        const fade=1-a/76;
        for(let j=0;j<(reduced?2:6);j++){
            const px=x+dx+(j-2.5)*(3+a*.21),py=base-5-j%2*3-Math.sin(Math.PI*a/76)*3;
            box(c,px,py,(8+a*.12)*fade,3*fade,'#a7ad94');box(c,px+2,py-2,(4+a*.08)*fade,2*fade,'#bbb99c');
        }
    }
}
