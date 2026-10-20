import {box,oval,pixelLine} from '../WorldPainting';
import type {HypotheticalChaseDefeat} from './HypotheticalChaseDefeat';

/** Each emission samples its world anchor once at the scored contact time.
 * Drawing at a later time cannot drag the cloud along with the moving jaw. */
export function drawCaptureEffects(c:CanvasRenderingContext2D,defeat:HypotheticalChaseDefeat,ms:number,cx:number,cy:number,reduced:boolean) {
    const score=defeat.score,d=defeat.initial.facing;
    for(const i of [0,1] as const){
        const plant=defeat.footPlant(i),age=ms-plant.at;
        if(!plant.supported||age<0||age>440)continue;
        const palette=plant.material==='timber'?['#82745b','#bea17d','#e5c59b']:plant.material==='iron'?['#536669','#8b9b98','#c0cac0']:['#687773','#a6b4a0','#d3dac0'];
        const x=plant.x-cx,y=plant.y-cy;
        c.save();c.globalAlpha=Math.min(1,(440-age)/140);
        for(let j=0;j<(reduced?3:7);j++){
            const drift=-d*(.018+j*.003),rise=.018+(j%3)*.012;
            const px=x+(j-3)*2+drift*age,py=Math.min(y-1,y-1-rise*age+.00012*age*age);
            box(c,px,py,j%3===0?3:2,age<200?2:1,palette[j%3]);
            if(j%3===0&&age<160)box(c,px,py,1,1,palette[2]);
        }
        if(age<150){
            const spread=4+age*.04;
            pixelLine(c,x-spread,y-1,x-2,y-1,palette[1]);pixelLine(c,x+2,y-1,x+spread,y-1,palette[0]);
        }
        c.restore();
    }
    const contactAge=ms-score.clamp;
    if(contactAge>=0&&contactAge<250){
        const [wx,wy]=defeat.mouthAt(score.clamp),x=wx-cx,y=wy-cy;
        c.save();c.globalAlpha=Math.min(1,(250-contactAge)/110);
        for(let i=0;i<(reduced?3:7);i++){
            const angle=-2.5+i*.46,speed=.037+(i%3)*.009;
            const vx=Math.cos(angle)*speed*d,vy=Math.sin(angle)*speed;
            const px=x+vx*contactAge,py=y+vy*contactAge+.00012*contactAge*contactAge;
            if(contactAge<90){
                const length=2+(i%2);
                pixelLine(c,px,py,px+Math.cos(angle)*length*d,py+Math.sin(angle)*length,i%2?'#fff0ce':'#e0c597');
            }else box(c,px,py,1,1,i%2?'#d1dfc6':'#bdaa74');
        }
        c.restore();
    }
    // A few droplets leave the lip as it closes, then fall independently of it.
    const spray=ms-score.clamp-25;
    if(!reduced&&spray>=0&&spray<360){
        const [wx,wy]=defeat.mouthAt(score.clamp+25);
        for(let i=0;i<3;i++){
            const x=wx-cx+d*(10+spray*(.025+i*.01)),y=wy-cy-2-spray*(.02+i*.009)+spray*spray*.00018;
            if(y>=defeat.initial.y-cy-1)continue;
            box(c,x,y,1,i===1&&spray<100?3:2,i===1?'#eef0d0':'#a4beb0');
        }
    }
    const breath=ms-score.breath;
    if(breath>=0&&breath<230){
        const [wx,wy]=defeat.mouthAt(score.breath),x=wx-cx+d*8,y=wy-cy-11;
        c.save();c.globalAlpha=(1-breath/230)*(reduced?.28:.55);
        for(let i=0;i<(reduced?1:3);i++){
            const t=Math.max(0,breath-i*25),width=2+t*.018;
            oval(c,x+d*t*.037+i*d*3,y-t*.012+i,width,2+t*.006,i%2?'#e7d8b6':'#b8c3af');
        }
        c.restore();
    }
}
