import { PixelGrid, type PixelFrame } from '../../graphics/pixels';
import type { BossBeat } from './DeliciaBoss';
import { arm, oval, rim, shape } from './DeliciaSpriteDrawing';

function mug(g:PixelGrid,x:number,y:number,guina:boolean):void {
    if(guina){
        shape(g,[[x,y],[x+14,y],[x+13,y+8],[x+9,y+11],[x+5,y+11],[x+1,y+7]],'K');
        shape(g,[[x+1,y+1],[x+13,y+1],[x+12,y+7],[x+8,y+10],[x+5,y+9],[x+2,y+6]],'y');
        g.rect(x+2,y+1,10,2,'I').rect(x+3,y+3,8,2,'O').rect(x+3,y+5,2,3,'Y').dot(x+5,y+8,'I');
        g.rect(x+6,y+10,3,6,'K').rect(x+6,y+10,2,5,'Y');rim(g,x+2,y+15,11,3,'Y','I');
    }else{
        oval(g,x+8,y+2,7,9,'K');oval(g,x+9,y+3,5,7,'V');oval(g,x+10,y+4,3,5,'K');
        rim(g,x,y,11,13,'U','a');g.rect(x+2,y+3,7,1,'O').rect(x+2,y+4,2,7,'V').rect(x+7,y+4,1,7,'u');
        g.rect(x+1,y+3,9,1,'a').rect(x+1,y+10,9,2,'N').rect(x+2,y+10,7,1,'A');
        g.rect(x+2,y+1,7,1,'I').dot(x+2,y+2,'l');
    }
}

function face(g:PixelGrid,x:number,y:number,guina:boolean,pose:BossBeat,f:number):void {
    const down=pose==='recover'||pose==='stagger',defeated=pose==='defeated',tell=pose==='tell';
    oval(g,x-2,y+9,31,18,'K');oval(g,x,y,28,26,'K');oval(g,x+1,y+1,26,23,'s');oval(g,x+1,y+1,22,22,'S');
    oval(g,x+3,y+2,17,7,'L');g.rect(x,y+12,3,6,'L').rect(x+26,y+13,2,4,'S').dot(x+25,y+15,'u');
    // Asymmetrical cheek and nose highlights stay consistent with the World light source.
    g.rect(x+3,y+18,4,2,'L').rect(x+20,y+19,3,2,'s');
    if(guina){
        shape(g,[[x+1,y+4],[x+5,y-2],[x+21,y-3],[x+28,y+2],[x+27,y+12],[x+24,y+10],[x+23,y+5],[x+12,y+6],[x+7,y+3]],'H');
        g.rect(x+7,y,10,2,'h').rect(x+23,y+4,2,8,'h');
        if(!defeated){
            shape(g,[[x+4,y-4],[x+7,y-4],[x+9,y],[x+13,y-6],[x+16,y-6],[x+18,y],[x+22,y-4],[x+25,y-4],[x+24,y+4],[x+6,y+4]],'K');
            shape(g,[[x+5,y-3],[x+7,y-3],[x+9,y+1],[x+14,y-5],[x+15,y-5],[x+18,y+1],[x+23,y-3],[x+24,y-3],[x+23,y+3],[x+7,y+3]],'Y');
            g.rect(x+7,y+2,16,1,'I').dot(x+14,y-4,'I').rect(x+13,y,3,2,'R').dot(x+13,y,'F');
        }
    }else{
        g.rect(x+1,y+8,3,10,'H').rect(x+24,y+7,3,12,'H').rect(x+24,y+9,1,6,'h');
        shape(g,[[x+3,y+17],[x+8,y+19],[x+14,y+18],[x+20,y+18],[x+25,y+15],[x+25,y+23],[x+21,y+27],[x+8,y+27],[x+3,y+23]],'H');
        g.line(x+5,y+22,x+11,y+25,'h').rect(x+12,y+26,6,1,'h').dot(x+22,y+23,'h');
    }
    if(pose==='stagger'){
        for(const xx of [x+5,x+17])g.line(xx,y+11,xx+4,y+14,'K').line(xx+4,y+11,xx,y+14,'K');
    }else if(down||defeated||(pose==='idle'&&f===3)){
        g.line(x+5,y+13,x+9,y+12,'K').line(x+17,y+12,x+22,y+13,'K');
        if(defeated)g.dot(x+5,y+10,'h').dot(x+22,y+10,'h');
    }else{
        g.rect(x+4,y+10,7,5,'W').rect(x+17,y+10,7,5,'W');g.rect(x+4,y+11,3,4,'K').rect(x+17,y+11,3,4,'K').dot(x+5,y+10,'w').dot(x+18,y+10,'w');
        g.line(x+3,y+7,x+11,y+(tell?10:8),'H').line(x+16,y+(tell?10:8),x+24,y+7,'H');
    }
    g.rect(x+11,y+13,6,5,'s').rect(x+11,y+13,4,3,'L').dot(x+15,y+17,'u');
    if(guina){
        shape(g,[[x+5,y+20],[x+9,y+17],[x+13,y+19],[x+17,y+17],[x+22,y+19],[x+25,y+18],[x+23,y+22],[x+18,y+21],[x+14,y+20],[x+10,y+21]],'H');g.dot(x+8,y+19,'h').dot(x+20,y+19,'h');
    }
    const mouthY=y+(guina?23:21);
    g.rect(x+10,mouthY,9,2,'K');g.rect(x+11,mouthY,6,1,defeated?'s':'W');
    if(pose==='attack'||pose==='stagger')g.rect(x+11,mouthY+1,6,2,'K').rect(x+13,mouthY+2,3,1,'r');
}

export function paintDeliciaBoss(character:'jaja'|'guina',pose:BossBeat,f:number):PixelFrame {
    const g=new PixelGrid(56,60),guina=character==='guina',tell=pose==='tell',attack=pose==='attack',defeated=pose==='defeated';
    const down=pose==='recover'||pose==='stagger'||defeated;
    const drop=defeated?8:pose==='stagger'?5:pose==='recover'?3:tell?0:pose==='transition'?-1:f===1?1:0;
    const lean=attack?-2:pose==='stagger'?2:0,step=attack?[2,0,-2,0][f]:0;
    const cloth=guina?'P':'T',light=guina?'Q':'D',shade=guina?'p':'t';
    if(guina){
        shape(g,[[13,26+drop],[43,24+drop],[51+(f%2),49],[45,55],[34,52],[22,55],[8,51]],'K');
        shape(g,[[14,27+drop],[42,26+drop],[49,49],[44,52],[33,49],[22,52],[10,49]],'p');
        g.line(12,41,11,49,'Q').line(44,34,48,49,'P').line(13,50,20,52,'Y').line(35,51,44,53,'y');
    }
    shape(g,[[15,45],[26,46],[24-step,56],[13-step,57],[12-step,53]],'K');
    shape(g,[[30,46],[42,44],[43+step,56],[31+step,57]],'K');
    g.rect(16,47,7,8,guina?'p':'U').rect(32,47,7,8,guina?'p':'U').rect(16,48,2,5,guina?'P':'V').rect(32,48,2,5,guina?'P':'V');
    for(const xx of [10-step,30+step]){
        rim(g,xx,55,16,5,'H','h');g.rect(xx+2,56,6,1,'A').rect(xx+2,58,12,1,'N');
        g.rect(xx+9,55,4,2,guina?'y':'U').dot(xx+10,55,guina?'I':'v');
    }
    const rightY=attack?29:pose==='transition'?24:down?44:40;
    arm(g,[[40,30+drop*.4],[47,35],[49,rightY]],'S','L','s');
    oval(g,37,28+drop*.3,12,13,'K');oval(g,38,29+drop*.3,10,10,shade);g.rect(40,30+drop*.3,3,2,cloth);
    shape(g,[[16+lean,24+drop],[36+lean,24+drop],[44,33+drop*.4],[45,47],[39,52],[16,52],[9,46],[11,33+drop*.4]],'K');
    shape(g,[[16+lean,26+drop],[35+lean,26+drop],[41,33+drop*.4],[43,46],[38,50],[17,50],[11,45],[13,33+drop*.4]],shade);
    oval(g,12,28+drop,28,20-drop*.4,cloth);g.rect(14,33+drop,2,9-drop*.5,light);
    if(guina){
        shape(g,[[21+lean,27+drop],[33+lean,27+drop],[37,40],[33,47],[22,47],[19,38]],'y');
        shape(g,[[22+lean,28+drop],[31+lean,28+drop],[34,38],[31,44],[23,44],[21,37]],'Y');
        g.line(23,29+drop,23,39,'I').rect(22,39,11,1,'y').rect(24,43,7,1,'I');
        oval(g,25,32+drop*.4,6,6,'o');g.rect(27,33+drop*.4,2,2,'l').line(28,32+drop*.4,30,31+drop*.4,'g');
        for(const xx of [14,38]){g.rect(xx,30+drop*.4,5,4,'Y').rect(xx,30+drop*.4,5,1,'I');g.rect(xx+1,34+drop*.4,1,2,'y');}
        g.line(18,27+drop,23,34+drop,'I').line(35,27+drop,31,34+drop,'I');
    }else{
        // A stitched work apron, wooden buttons and a citrus pocket belong to the source keeper.
        g.line(19,26+drop,21,43,'W').line(35,26+drop,35,43,'a');
        shape(g,[[21,33+drop],[35,33+drop],[39,49],[19,49]],'K');
        shape(g,[[22,34+drop],[34,34+drop],[37,48],[20,48]],'t');g.line(22,35+drop,22,45,'D');
        rim(g,24,39+drop*.4,10,7,'T','D');g.rect(26,41+drop*.4,5,2,'t').dot(25,45,'a').dot(34,45,'a');
        for(const xx of [20,36])g.dot(xx,48,'a');g.rect(17,30+drop,2,2,'v').rect(36,30+drop,2,2,'v');
    }
    g.rect(13,48,29,3,'K').rect(14,48,27,1,'y');rim(g,25,47,8,5,'Y','I');g.rect(28,49,2,1,'o');
    const handY=tell?14:attack?32:defeated?48:pose==='transition'?23:down?44:40;
    const elbowY=tell?27:attack?34:37+drop*.5;
    arm(g,[[15,31+drop*.4],[8,elbowY],[7,handY]],'S','L','s');
    oval(g,8,28+drop*.4,12,12,'K');oval(g,9,29+drop*.4,10,9,cloth);g.rect(10,30+drop*.4,3,4,light);
    if(guina){g.rect(8,31+drop*.4,10,2,'Y').rect(9,31+drop*.4,8,1,'I');g.rect(4,handY+1,3,2,'Y').dot(4,handY+1,'I');}
    // The vessel is held in a bent, connected arm in every phase.
    mug(g,0,handY-(guina?13:10),guina);
    face(g,14+lean,7+drop,guina,pose,f);
    if(pose==='stagger'){
        for(const [xx,yy] of [[3,15],[48,7],[47,21]])g.rect(xx,yy,3,1,'I').rect(xx+1,yy-1,1,3,'Y');
    }
    if(defeated&&guina){g.rect(43,54,10,4,'y').rect(44,54,8,1,'I').rect(43,51,2,4,'Y').rect(47,50,2,5,'Y').rect(51,52,2,3,'Y');}
    return g.finish();
}
