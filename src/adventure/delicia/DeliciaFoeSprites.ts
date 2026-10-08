import { PixelGrid, type PixelFrame } from '../../graphics/pixels';
import type { FoeType } from './DeliciaContent';
import { eye, oval, rim, shape } from './DeliciaSpriteDrawing';

export type DeliciaFoePose='walk'|'tell'|'attack'|'stun';

function pulp(g:PixelGrid,pose:DeliciaFoePose,f:number):void {
    const stun=pose==='stun',tell=pose==='tell',attack=pose==='attack';
    const squash=stun?3:tell?2:[0,1,0,-1][f],top=8+squash;
    const left=attack?1:3,right=attack?20:21;
    shape(g,[[left+5,top],[14,top-1],[right-1,top+4],[right,19],[19,22],[5,22],[left,19],[left,top+5]],'K');
    shape(g,[[left+5,top+1],[14,top],[right-2,top+5],[right-1,19],[18,21],[6,21],[left+1,18],[left+1,top+5]],'o');
    oval(g,left+1,top+1,15,12-squash,'O');oval(g,left+3,top+1,9,4,'l');
    g.rect(left+5,top+1,4,1,'I').dot(16,top+5,'l').dot(5,18,'l').dot(16,19,'y');
    g.line(12,top,12,top-4,'u').line(12,top-2,16,top-5,'g');
    shape(g,[[12,top-4],[14,top-7],[20,top-6],[17,top-3]],'g');g.line(14,top-4,18,top-5,'E');
    shape(g,[[11,top-3],[7,top-5],[6,top-3],[10,top-1]],'G');
    eye(g,5,top+5,stun,tell);eye(g,13,top+5,stun,tell);
    if(attack){g.rect(6,top+9,9,4,'K').rect(7,top+9,6,1,'W').rect(10,top+11,3,1,'R');}
    else g.line(9,top+10,12,top+10+(tell?-1:1),'o');
    const step=pose==='walk'?[0,1,0,-1][f]:0;
    g.rect(3-step,21,7,3,'K').rect(4-step,21,4,1,'o');g.rect(15+step,21,6,3,'K').rect(16+step,21,3,1,'o');
}

function beetle(g:PixelGrid,pose:DeliciaFoePose,f:number):void {
    const stun=pose==='stun',low=pose==='tell'||stun?2:0,bob=pose==='walk'?[0,1,0,0][f]:0,y=low+bob;
    const step=pose==='walk'?[1,0,-1,0][f]:0;
    for(const [xx,sign] of [[5,-1],[12,1],[19,-1]]){
        g.line(xx,16+y,xx+sign*2,20,'K').line(xx+sign*2,20,xx+sign*(3+step),22,'K');
        g.dot(xx+sign*2,20,'U');g.rect(xx+sign*(3+step),22,3,1,'k');
    }
    oval(g,5,5+y,18,16-low,'K');oval(g,6,6+y,16,13-low,'g');
    shape(g,[[8,7+y],[12,5+y],[17,6+y],[21,10+y],[20,16+y],[17,18+y],[7,16+y]],'G');
    shape(g,[[8,8+y],[12,6+y],[16,7+y],[18,10+y],[12,10+y],[9,13+y],[7,12+y]],'E');
    g.rect(11,7+y,4,1,'e').line(16,9+y,18,15+y,'g').dot(20,12+y,'e').line(9,15+y,14,17+y,'g');
    oval(g,1,11+y,9,9-low,'K');oval(g,2,12+y,7,6-low,'g');
    eye(g,2,12+y,stun,pose==='attack');g.rect(2,18,4,1,'y');
    g.line(5,11+y,3,7+y,'K').line(3,7+y,1,7+y,'K').dot(1,6+y,'Y');
    g.line(8,11+y,7,7+y,'g').dot(7,6+y,'E');
    if(pose==='attack')g.line(0,17,2,16,'I');
    if(stun)g.line(12,9+y,15,11+y,'a').line(15,9+y,12,11+y,'a');
}

function wasp(g:PixelGrid,pose:DeliciaFoePose,f:number):void {
    const stun=pose==='stun',attack=pose==='attack',bob=stun?2:f%2;
    const wing=stun?2:f;
    const wings=[
        [[8,11],[4,7],[3,2],[6,1],[12,5],[13,11]],
        [[8,11],[1,8],[0,5],[4,4],[10,7],[13,11]],
        [[8,11],[2,11],[1,14],[4,16],[11,13],[13,11]],
        [[8,11],[3,9],[2,4],[5,3],[11,7],[13,11]],
    ] as const;
    for(const dx of [7,0]){
        const points=wings[wing].map(([x,y])=>[Math.min(23,x+dx),y] as const);shape(g,points,'K');
        const middle=points.map(([x,y])=>[Math.round((x+(9+dx))*.5),Math.round((y+8)*.5)] as const);shape(g,middle,dx?'a':'D');
        g.line(9+dx,10,points[2][0]+1,points[2][1]+1,dx?'D':'W');
    }
    g.line(19,16+bob,23,17+bob,'K').dot(22,17+bob,'I');
    oval(g,8,10+bob,13,10,'K');oval(g,9,11+bob,11,8,'y');oval(g,9,11+bob,10,5,'Y');
    for(const xx of [12,17])g.line(xx,11+bob,xx-1,18+bob,'K');g.rect(10,11+bob,2,1,'I').dot(18,12+bob,'I');
    oval(g,3,10+bob,9,10,'K');oval(g,4,11+bob,7,7,'Y');eye(g,4,12+bob,stun,pose==='tell');
    g.line(5,10+bob,3,7+bob,'K').dot(3,6+bob,'y').line(8,10+bob,9,8+bob,'K');
    g.line(9,19+bob,7,22,'K').line(14,19+bob,15,22,'K');
    if(attack)g.rect(2,16+bob,3,2,'K').dot(2,16+bob,'W');
}

function roller(g:PixelGrid,pose:DeliciaFoePose,f:number):void {
    const stun=pose==='stun',tell=pose==='tell',attack=pose==='attack',dy=stun?2:0;
    oval(g,2,3+dy,20,21-dy,'K');oval(g,3,4+dy,18,18-dy,'y');oval(g,4,4+dy,15,16-dy,'Y');
    for(const [xx,yy,w,h] of [[8,2,7,2],[0,10,3,7],[21,10,3,7],[7,21,9,3]])rim(g,xx,yy,w,h,'y','Y');
    oval(g,6,7+dy,12,12-dy,'K');oval(g,7,8+dy,10,10-dy,'N');
    for(let i=0;i<4;i++){
        const a=i*Math.PI/2+(stun?0:f*Math.PI/8),dx=Math.round(Math.cos(a)*7),dy=Math.round(Math.sin(a)*7);
        g.line(12,13,12+dx,13+dy,'y').dot(12+dx,13+dy,'I');
    }
    rim(g,7,8+dy,10,7,attack?'o':tell?'y':'n',attack?'l':'A');
    if(stun){g.line(9,11+dy,11,13+dy,'D').line(11,11+dy,9,13+dy,'D').rect(14,12+dy,2,1,'A');}
    else{g.rect(9,10+dy,2,2,tell?'I':'D').rect(14,10+dy,2,2,tell?'I':'D');if(attack)g.line(8,9,16,11,'Y');}
    g.rect(9,17+dy,6,1,'A').dot(5,9,'I').dot(17,19,'y');
    g.line(11,4,11,1,'K').rect(tell?13:10,0,tell?4:3,2,tell?'I':'Y');
    if(tell)g.line(12,3,14,1,'Y');
}

function sentinel(g:PixelGrid,pose:DeliciaFoePose,f:number):void {
    const stun=pose==='stun',tell=pose==='tell',attack=pose==='attack',dy=stun?2:pose==='walk'&&f===1?1:0;
    const step=pose==='walk'?[0,1,0,-1][f]:0;
    g.rect(7-step,19,4,4,'n').rect(15+step,19,4,4,'n');
    rim(g,4-step,21,7,3,'N','A');rim(g,14+step,21,8,3,'N','A');
    shape(g,[[7,10+dy],[18,10+dy],[21,18],[17,22],[7,22],[5,17]],'K');
    g.rect(7,11+dy,12,9-dy,'N').rect(8,12+dy,3,6-dy,'A').rect(17,12+dy,2,7-dy,'n');
    rim(g,11,15+dy,6,5-dy,stun?'t':'y',stun?'D':'I');g.rect(9,20,8,1,'Y');
    g.rect(20,13+dy,3,6,'K').rect(20,14+dy,2,3,'A');
    // Rounded sallet, brim and neck guard replace the square robot cap.
    shape(g,[[5,8+dy],[6,4+dy],[10,2+dy],[17,3+dy],[20,6+dy],[22,7+dy],[21,10+dy],[6,10+dy]],'K');
    shape(g,[[6,7+dy],[8,4+dy],[12,3+dy],[17,4+dy],[19,7+dy],[21,8+dy],[6,9+dy]],'Y');
    g.line(8,5+dy,13,4+dy,'I').rect(17,5+dy,2,3,'y').rect(5,8+dy,17,1,'I');
    g.rect(8,9+dy,12,4,'K');
    if(stun)g.line(10,10+dy,13,12+dy,'D').line(13,10+dy,10,12+dy,'D').rect(16,11+dy,2,1,'A');
    else g.rect(9,10+dy,3,1,tell?'I':'D').rect(16,10+dy,2,1,tell?'I':'D');
    const shieldY=attack?9:tell?10:13;
    shape(g,[[1,shieldY],[7,shieldY-1],[8,shieldY+6],[5,shieldY+10],[1,shieldY+7]],'K');
    shape(g,[[2,shieldY+1],[6,shieldY],[7,shieldY+5],[4,shieldY+8],[2,shieldY+6]],'y');
    g.line(2,shieldY+1,2,shieldY+6,'I').rect(3,shieldY+2,3,3,'Y').dot(4,shieldY+3,'I');
}

function bottler(g:PixelGrid,pose:DeliciaFoePose,f:number):void {
    const stun=pose==='stun',tell=pose==='tell',attack=pose==='attack',sway=attack?-2:0,dy=stun?2:0;
    // A narrow neck, rounded shoulders and translucent edges read as glass.
    shape(g,[[8+sway,3+dy],[15+sway,3+dy],[15+sway,7+dy],[19,10+dy],[20,19],[17,22],[6,22],[4,19],[5,10+dy],[8+sway,7+dy]],'K');
    shape(g,[[9+sway,4+dy],[14+sway,4+dy],[14+sway,8+dy],[18,11+dy],[18,19],[16,21],[7,21],[6,18],[6,11+dy],[9+sway,8+dy]],'t');
    g.rect(7,10+dy,3,9-dy,'T').rect(7,11+dy,1,5,'D').rect(17,12+dy,1,6-dy,'T');
    const fluid=stun?18:tell?13:15+(f===2?1:0);g.rect(8,fluid,8,5,'o').rect(8,fluid,7,2,'O').dot(8,fluid,'l');
    if(!attack)rim(g,7+sway,tell?0:2+dy,10,4,'Y','I');
    else{g.rect(5,7,9,2,'Y').rect(4,7,3,2,'K').dot(4,7,'D');}
    if(tell){g.rect(10,4,3,3,'T').dot(12,0,'W');}
    eye(g,7,10+dy,stun,tell);eye(g,13,10+dy,stun,tell);
    g.rect(6,16+dy,12,4-dy,'W').rect(7,17+dy,3,1,'y').rect(12,17+dy,4,1,'o');
    g.rect(4,22,7,2,'K').rect(14,22,7,2,'K').dot(6,22,'A').dot(16,22,'A');
}

function mimic(g:PixelGrid,pose:DeliciaFoePose,f:number):void {
    const stun=pose==='stun',attack=pose==='attack',tell=pose==='tell',dy=stun?2:pose==='walk'&&f%2?1:0;
    oval(g,3,4+dy,19,19-dy,'K');oval(g,4,5+dy,17,16-dy,'u');oval(g,5,5+dy,14,15-dy,'U');
    for(const xx of [6,11,17])g.line(xx,8+dy,xx-1,19,'u');g.rect(6,8+dy,2,10-dy,'V').rect(12,8+dy,1,9-dy,'V');
    oval(g,4,3+dy,17,5,'K');oval(g,5,4+dy,15,3,'V');g.line(7,5+dy,18,5+dy,'U').dot(14,5+dy,'v');
    for(const yy of [8+dy,19]){g.rect(3,yy,19,2,'n').rect(4,yy,16,1,'A').dot(6,yy,'a').dot(18,yy+1,'Y');}
    if(attack){
        g.rect(5,12,15,7,'K').rect(7,16,11,2,'p').rect(10,17,6,2,'R');
        for(const xx of [6,11,17])g.rect(xx,12,2,2,'W');g.rect(8,17,2,2,'I').rect(17,17,2,2,'I');
        g.rect(6,10,4,1,'I').rect(14,10,4,1,'I');
    }else{
        g.rect(6,11+dy,4,4,'u').rect(14,11+dy,4,4,'u');eye(g,6,12+dy,stun,tell);eye(g,14,12+dy,stun,tell);
        g.rect(7,17,11,1,'u');if(tell)g.rect(9,17,7,1,'W');
    }
    const step=pose==='walk'||attack?[0,1,0,-1][f]:0;g.rect(3-step,22,6,2,'K').rect(16+step,22,6,2,'K').dot(4-step,22,'V').dot(18+step,22,'V');
}

function bloom(g:PixelGrid,pose:DeliciaFoePose,f:number):void {
    const stun=pose==='stun',tell=pose==='tell',attack=pose==='attack';
    const hx=attack?7:tell?12:10+(pose==='walk'&&f===3?1:0),hy=stun?12:tell?8:7+(f===1?1:0);
    g.line(12,23,13,16,'K').line(13,16,hx+1,hy+4,'K').line(13,22,14,16,'g').line(14,16,hx+2,hy+4,'G');
    shape(g,[[12,21],[6,17],[1,18],[3,22],[10,23]],'K');shape(g,[[11,21],[6,18],[3,19],[5,21]],'G');g.line(5,19,9,21,'E');
    shape(g,[[14,20],[18,16],[23,17],[21,21],[14,23]],'K');shape(g,[[15,20],[19,17],[21,18],[20,20]],'G');g.line(17,19,20,18,'e');
    const petals=tell?[[0,-5,5,7],[-4,-2,6,7],[4,-2,6,7],[-2,3,8,6]]:[[-2,-7,7,9],[-8,-2,9,8],[4,-3,9,8],[-5,4,8,8],[2,4,8,7]];
    for(const [dx,dy,w,h] of petals){oval(g,hx+dx,hy+dy,w,h,'K');oval(g,hx+dx+1,hy+dy+1,w-2,h-2,tell?'R':'P');g.rect(hx+dx+2,hy+dy+2,Math.max(1,w-5),1,tell?'F':'Q');}
    oval(g,hx-3,hy-1,10,10,'y');oval(g,hx-3,hy,8,7,'Y');g.dot(hx-1,hy,'I');
    if(attack){oval(g,hx-6,hy+1,8,7,'K');oval(g,hx-5,hy+2,5,5,'y');g.rect(hx-5,hy+3,3,3,'K').dot(hx-4,hy+2,'I');}
    else{eye(g,hx-2,hy+2,stun,tell);g.dot(hx+4,hy+3,stun?'k':'K').rect(hx+1,hy+6,3,1,'o');}
    g.rect(9,23,8,1,'K');
}

const painters:Record<FoeType,(g:PixelGrid,pose:DeliciaFoePose,frame:number)=>void>={pulp,beetle,wasp,roller,sentinel,bottler,mimic,bloom};
export function paintDeliciaFoe(kind:FoeType,pose:DeliciaFoePose,frame:number):PixelFrame {
    const g=new PixelGrid(24,24);painters[kind](g,pose,frame);return g.finish();
}
