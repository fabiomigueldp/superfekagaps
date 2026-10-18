import {box as r,pixelLine as line,oval} from '../../WorldPainting';
import {pixelText} from '../../../graphics/BitmapFont';
import {GUAIRA_COURSES,GUAIRA_MAINTENANCE_ROUTES,type GuairaCourseId} from './GuairaCourseDesign';
import type {WorldLevel} from '../../WorldPhysics';
import {drawGuairaFixedScaffold} from './GuairaScaffoldArt';

/** Rear structures explain the real decks without painting extra platforms.
 * Moving danger is drawn by the native enemies and connected hydraulic outlet. */
export function drawGuairaMaintenanceLandscape(c:CanvasRenderingContext2D,id:GuairaCourseId,cx:number,cy:number,level:WorldLevel){
    const d=GUAIRA_MAINTENANCE_ROUTES[id];if(!d)return;
    const g=GUAIRA_COURSES[id],x=g.start-Math.round(cx),f=g.floor-Math.round(cy),y=d.top-Math.round(cy);
    if(x+d.end<0||x+d.entry>320)return;
    const [left,right]=d.decks.at(-1)!,a=x+left,b=x+right;
    if(id==='travessia'){
        // The last balcony cantilevers from the real far bank. Keeping the
        // channel open behind it makes the lower jump and receiving lip legible.
        r(c,x+1060,y+7,5,f-y-7,'#a69876');r(c,x+1061,y+8,2,f-y-8,'#c2b18a');
        line(c,x+1060,f-8,a+7,y+10,'#a19474',3);
        r(c,a+4,y+7,b-a-8,3,'#9e9374');r(c,a+6,y+8,b-a-12,1,'#b8a985');
        r(c,a+25,y+17,59,13,'#aaa07e');pixelText(c,'ECLUSA',a+55,y+20,'#797b62',1,'center');
        for(const [l,rr,top,falling]of [...d.decks,...d.returns]){
            if(falling||top===d.top)continue;
            drawGuairaFixedScaffold(c,level,g.start+l,g.start+rr,top,cx,cy);
        }
        return;
    }
    // Recessed pump housing; its top is below the platform's collision edge.
    r(c,a+8,y+10,b-a-16,f-y-10,'#a69c7d');r(c,a+12,y+13,b-a-24,f-y-13,'#bab08c');
    for(let yy=y+28;yy<f;yy+=24){r(c,a+10,yy,b-a-20,2,'#99977a');r(c,a+12,yy+2,b-a-24,1,'#cabe98');}
    if(id==='respiros'){
        for(const dx of [26,88]){
            r(c,a+dx,y+38,35,50,'#8f947c');r(c,a+dx+3,y+41,29,44,'#a6b29a');
            for(let j=0;j<4;j++)r(c,a+dx+7,y+48+j*8,21,2,'#87998a');
            r(c,a+dx-2,y+88,39,3,'#989777');
        }
        pixelText(c,'RETORNO',a+58,y+17,'#797b62',1,'center');
        // Wet stains descend into the actual channel, not onto a safe cap.
        for(const dx of [20,62,110]){r(c,a+dx,f-28,4,28,'#8e987b');r(c,a+dx+4,f-15,2,15,'#9ba482');}
    }else if(id==='alivio'){
        pixelText(c,'COLETOR',a+70,y+17,'#797b62',1,'center');
        for(const dx of [38,104]){
            oval(c,a+dx,y+42,36,36,'#94967a');oval(c,a+dx+4,y+46,28,28,'#b7ac86');
            line(c,a+dx+18,y+48,a+dx+18,y+71,'#959578',2);line(c,a+dx+7,y+59,a+dx+29,y+59,'#959578',2);
        }
        // The patrol's travel is physically marked on its supported platform.
        r(c,x+d.guard.x-d.guard.range-4,y+6,d.guard.range*2+30,2,'#657c76');
        for(const stop of [d.guard.x-d.guard.range-4,d.guard.x+d.guard.range+24]){
            r(c,x+stop,y+4,3,7,'#657c76');r(c,x+stop,y+4,3,1,'#c4bb8c');
        }
    }
    for(const [l,rr,top,falling]of [...d.decks,...d.returns]){
        if(falling)continue;
        drawGuairaFixedScaffold(c,level,g.start+l,g.start+rr,top,cx,cy);
    }
}
