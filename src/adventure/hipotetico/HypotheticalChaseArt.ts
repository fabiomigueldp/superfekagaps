import {box,oval,pixelLine,polygon} from '../WorldPainting';
import {pixelText} from '../../graphics/BitmapFont';
import type {HypotheticalModel} from './HypotheticalModel';
import {CHASE_BREAKS,CHASE_CHECKPOINT,CHASE_DISTRICTS} from './HypotheticalLayout';

/** World-anchored landmarks make the changing construction and the route legible. */
export function drawChaseLandmarks(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    const floor=224-cy,base=floor-13;
    for(const [i,site] of CHASE_BREAKS.entries()){
        const x=site.x-cx;if(x<-140||x>430)continue;
        const at=b.chaseBreaks[i],age=at===-1?-1:b.tick-at,broken=age>=0;
        const crack=Math.max(0,Math.min(1,(b.x+96-site.x)/40));
        const metal=site.kind==='gantry'||site.kind==='sluice',ink=metal?'#526e73':'#6b786b',light=metal?'#94a99a':'#a6a58b';
        // Bolted feet stay in the ruins after the upper structure falls.
        for(const dx of [-25,33]){box(c,x+dx-5,base-5,15,6,ink);box(c,x+dx-3,base-4,11,1,light);}
        const height=site.kind==='crane'?78:site.kind==='sluice'?56:68;
        for(const dx of [-25,33]){
            const h=broken?22:height;box(c,x+dx,base-h,5,h,ink);box(c,x+dx+1,base-h+1,1,h-1,light);
            for(let yy=8;yy<h;yy+=14)box(c,x+dx+1,base-yy,2,1,'#b9b49a');
        }
        if(!broken||age<34){
            const t=broken?Math.min(34,age):0,drop=t*t*.065,shift=t*.75;
            pixelLine(c,x-26+shift,base-height+drop,x+39+shift,base-height+drop+t*.6,ink,6);
            pixelLine(c,x-26+shift,base-height-2+drop,x+39+shift,base-height-2+drop+t*.6,light,2);
            if(site.kind==='crane'){
                const swing=reduced?0:Math.sin(b.tick/35)*2;
                pixelLine(c,x+12+shift,base-height+drop,x+12+shift+swing,base-30+drop,'#617b72',1);
                box(c,x+3+shift+swing,base-30+drop,20,15,'#766f60');box(c,x+5+shift+swing,base-28+drop,16,2,'#b4a080');
                pixelLine(c,x+4+shift+swing,base-28+drop,x+21+shift+swing,base-17+drop,'#a18c70');
            }else if(site.kind==='sluice'){
                box(c,x-15+shift,base-height+7+drop,45,28,'#617c78');
                for(let j=0;j<5;j++)box(c,x-12+j*9+shift,base-height+9+drop,3,25,'#a0aa91');
                oval(c,x+4+shift,base-height+14+drop,10,10,'#b4ae8f');
            }else{
                pixelLine(c,x-23+shift,base-height+5+drop,x+33+shift,base-height+30+drop,ink,3);
                pixelLine(c,x+33+shift,base-height+4+drop,x-23+shift,base-height+30+drop,ink,3);
            }
        }
        if(!broken&&crack>.2){pixelLine(c,x-25,base-25,x-22,base-20,'#c2b59a');pixelLine(c,x+35,base-28,x+33,base-22,'#c2b59a');}
        if(broken){
            polygon(c,[[x-28,base],[x-18,base-7],[x-5,base-3],[x+3,base-9],[x+22,base],[x+42,base]],ink);
            pixelLine(c,x-18,base-6,x-7,base-2,light);
            if(age<50&&!reduced)for(let j=0;j<7;j++){
                const dx=(j-3)*age*.45,dy=-Math.sin(Math.min(1,age/50)*Math.PI)*(4+j%3*3);
                box(c,x+dx,base+dy-2,age<20?4:2,2,j%2?'#b6ae91':'#91a18c');
            }
        }
    }
    // Sector signs and the midpoint shelter are landmarks, never platforms or hazards.
    for(const [i,d] of CHASE_DISTRICTS.entries())if(i){
        const x=d.x+32-cx;if(x<-100||x>340)continue;
        box(c,x,base-49,4,49,'#577773');box(c,x-7,base-49,80,17,'#4f6a70');
        box(c,x-6,base-48,78,1,'#aab397');pixelText(c,d.name,x-2,base-44,'#c8c3a2');
    }
    const x=CHASE_CHECKPOINT-cx;
    if(x>-80&&x<360){
        box(c,x-10,base-62,5,62,'#566f70');box(c,x-14,base-65,16,5,'#b7ad8a');
        box(c,x-12,base-59,12,16,'#344e58');box(c,x-10,base-57,8,10,'#91d3bb');
        pixelLine(c,x-8,base-53,x-6,base-51,'#e1e6ba');pixelLine(c,x-6,base-51,x-3,base-55,'#e1e6ba');
        box(c,x-13,base-39,38,11,'#405e62');pixelText(c,'SALVO',x-10,base-37,'#b4d1b7');
    }
}

/** Debris is recorded when native collision is removed; drawing cannot advance the collapse. */
export function drawChaseCollapse(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    for(const p of b.bridgeDebris){
        const age=b.tick-p.born,x=p.x-cx,y=224-cy;if(x<-48||x>350)continue;
        const color=p.material===1?'#ac835f':p.material===3?'#789798':'#b7ab8b';
        if(age<22){
            const drop=age*age*.065,tilt=Math.min(6,age*.4);
            polygon(c,[[x+age*.18,y+drop],[x+15+age*.18,y+drop+tilt],[x+13+age*.18,y+5+drop+tilt],[x+age*.18,y+5+drop]],'#405865');
            pixelLine(c,x+age*.18,y+drop,x+14+age*.18,y+drop+tilt,color,2);
            if(!reduced)for(let i=0;i<3;i++)box(c,x+3+i*5-age*(i-1)*.15,y+4+drop-i*2,2,2,color);
        }
        if(age>=15&&age<38){
            const t=age-15;
            pixelLine(c,x-2-t*.5,240-cy,x+17+t*.5,240-cy,'#91bdaf');
            if(!reduced)for(const dir of [-1,1])box(c,x+8+dir*t*.7,240-cy-Math.sin(t/23*Math.PI)*6,2,2,'#c2d3b4');
        }
    }
}
