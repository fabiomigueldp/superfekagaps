import {box,pixelLine,polygon,type Point} from '../WorldPainting';
import type {AftermathFlock,YardBird} from './HypotheticalAftermathFlock';
import {drawScenicShadow} from './HypotheticalSceneShadow';

const palettes=[
    {body:'#c4c6b2',light:'#dcdbc1',wing:'#8daba1',shade:'#65817e',ink:'#415e61',beak:'#bcaa78'},
    {body:'#92a9a2',light:'#b4beb0',wing:'#687e83',shade:'#566e78',ink:'#3c555f',beak:'#aa9c81'},
];
function bird(c:CanvasRenderingContext2D,b:YardBird,base:number,tick:number,reduced:boolean){
    const p=palettes[b.kind],x=b.x,y=base+b.y,age=tick-b.since;
    const flight=b.state==='flight'||b.state==='arrive',fall=b.state==='fall',rest=b.state==='rest';
    const crouch=b.state==='alert'?Math.sin(Math.min(1,age/8)*Math.PI)*1.6:0;
    const peck=b.state==='perch'&&!reduced?Math.max(0,Math.sin(age*.045+b.phase)-.82)*11:0;
    const angle=fall?b.angle:flight?b.angle*b.facing:rest?b.angle:0,cos=Math.cos(angle),sin=Math.sin(angle);
    const at=(u:number,v:number):Point=>[x+(u*cos-v*sin)*b.facing,y+u*sin+v*cos+crouch];
    const line=(a:number,d:number,e:number,f:number,color:string,width=1)=>pixelLine(c,...at(a,d),...at(e,f),color,width);
    const patch=(points:Point[],color:string)=>polygon(c,points.map(q=>at(...q)),color);
    if(fall&&!reduced){const height=Math.max(0,-4-b.y);drawScenicShadow(c,x-3-height*.02,base-2,7+height*.04,1,.2);}
    if(rest){
        const fade=Math.max(0,Math.min(1,(1500-(tick-b.landedAt))/150));
        c.save();c.globalAlpha*=fade;
        patch([[-5,0],[-2,-2],[3,-2],[5,0],[3,2],[-3,2]],p.shade);
        line(-3,-1,2,-1,p.body,2);line(-3,0,-7,2,p.wing,2);line(4,0,6,1,p.beak);
        c.restore();return;
    }
    // Each wing has shoulder, wrist and separated primary feathers. The far
    // wing trails the near wing rather than forming a symmetrical V every frame.
    if(flight||fall){
        const phase=(tick-b.launchAt)*.31+b.phase;
        const flap=fall?-.2:reduced?.45:Math.sin(phase);
        for(const far of [true,false]){
            const reach=far?-.8:1,tip=fall?3:flap*(far?6:8),wrist=tip*.6;
            patch([[0,0],[reach*4,-wrist-1],[reach*9,-tip],[reach*7,-tip+2],[reach*3,2]],far?p.shade:p.wing);
            line(reach*2,0,reach*6,-wrist,far?p.wing:p.light,2);
            for(let i=0;i<3;i++)line(reach*(6+i),-tip+i*.4,reach*(9+i),-tip+1+i*.7,far?p.shade:p.wing);
        }
    }else{
        line(-2,3,-2,5,p.beak);line(2,3,2,5,p.beak);
        patch([[-5,-1],[-3,-3],[2,-2],[4,1],[0,3],[-4,2]],p.wing);
    }
    patch([[-5,0],[-2,-2],[3,-2],[5,0],[2,3],[-2,2]],p.body);
    line(-4,-1,1,-2,p.light);line(-4,1,-7,2,p.shade,2);
    if(!flight&&!fall){line(-3,-1,1,1,p.shade);line(-2,-2,2,-1,p.light);}
    patch([[2+peck*.3,-3+peck],[5+peck*.3,-3+peck],[6+peck*.3,peck],[3+peck*.3,1+peck]],p.body);
    line(5+peck*.3,-1+peck,7+peck*.3,peck,p.beak);
    if(fall)line(4,-2,5,-1,p.ink);
    else{const eye=at(4+peck*.3,-2+peck);box(c,...eye,1,1,p.ink);}
    if(b.hitAt>=0&&tick-b.hitAt<3&&!reduced){line(-2,-4,0,-2,p.light);line(-4,1,-6,3,p.light);}
}

export function drawAftermathFlock(c:CanvasRenderingContext2D,flock:AftermathFlock,base:number,tick:number,reduced:boolean){
    for(const b of flock.remains)bird(c,b,base,tick,reduced);
    for(const b of flock.birds)if(tick>=b.since||b.state!=='arrive')bird(c,b,base,tick,reduced);
    if(reduced)return;
    for(const p of flock.feathers){
        const age=tick-p.born,turn=Math.sin(age*.14+p.seed),sway=Math.sin(age*.08+p.seed)*Math.min(3,age*.08);
        if(age>80&&(p.seed+Math.floor(age/4))%3===0)continue;
        pixelLine(c,p.x+sway,base+p.y,p.x+sway+turn*3,base+p.y+1,'#b7c4b4');
        box(c,p.x+sway,base+p.y,1,1,'#79958d');
    }
}
