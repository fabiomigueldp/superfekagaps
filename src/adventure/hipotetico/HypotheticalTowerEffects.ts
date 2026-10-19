import {box,pixelLine,polygon,type Point} from '../WorldPainting';
import {smoothMotion} from './HypotheticalMotion';
import {BASTION_TOWER,type HypotheticalTower} from './HypotheticalTower';
import {drawLauncherWarhead} from './HypotheticalLauncherArt';
import {AFTERMATH_SCALE} from './HypotheticalAftermathHandling';

/** Irregular, stepped clusters retain the game's pixel grid as they expand. */
function puff(c:CanvasRenderingContext2D,x:number,y:number,r:number,seed:number,color:string,light:string){
    polygon(c,[[x-r,y],[x-r*.75,y-r*.45],[x-r*.2,y-r*.4],[x,y-r*.75],[x+r*.5,y-r*.55],
        [x+r*.6,y-r*.15],[x+r,y],[x+r*.8,y+r*.25],[x+r*.1,y+r*.35],[x-r*.6,y+r*.25]],color);
    box(c,x-r*.5+seed%2,y-r*.32,r*.5,Math.max(1,r*.16),light);
    box(c,x+r*.1,y-r*.52,r*.3,Math.max(1,r*.13),light);
}
function drawRocket(c:CanvasRenderingContext2D,t:HypotheticalTower,base:number,reduced:boolean){
    const launch=t.launch;if(!launch)return;
    const age=t.tick-t.launchAt,at=(x:number,y:number,a:number,b:number):Point=>
        [x+launch.dx*a-launch.dy*b,base+y+launch.dy*a+launch.dx*b];
    if(!reduced){
        // These exhaust points stay where they were emitted; the smoke is not
        // stretched between the moving missile and the barrel.
        for(const p of t.trail){
            const a=t.tick-p.born,fade=1-smoothMotion((a-24)/64),r=(1.3+a*.035)*fade;
            c.save();c.globalAlpha=.7*fade;
            puff(c,p.x+a*.065,base+p.y-a*.035,r,p.seed,a<24?'#c4c3ac':'#a7afa0','#d0cab0');c.restore();
        }
        if(age<10){
            const extension=9+age*1.8,fade=1-smoothMotion(age/10);
            c.save();c.globalAlpha=fade;
            polygon(c,[at(launch.x,launch.y,-9,-2),at(launch.x,launch.y,extension,0),at(launch.x,launch.y,-9,2)],'#dbc797');
            c.restore();
        }
        if(age<14){
            const strength=1-smoothMotion(age/14),length=10+age*2.2;
            c.save();c.globalAlpha=strength;
            polygon(c,[at(launch.backX,launch.backY,0,-2),at(launch.backX,launch.backY,-length,-5),
                at(launch.backX,launch.backY,-length-5,0),at(launch.backX,launch.backY,-length,5),at(launch.backX,launch.backY,0,2)],'#bea17a');
            polygon(c,[at(launch.backX,launch.backY,0,-1),at(launch.backX,launch.backY,-length*.7,0),at(launch.backX,launch.backY,0,1)],'#ead6a5');
            c.restore();
        }
        for(let j=0;j<4;j++){
            const a=age-4-j*3;if(a<0||a>66)continue;
            const fade=1-smoothMotion((a-18)/48),point=at(launch.backX,launch.backY,-9-a*.35-j*4,(j%2?1:-1)*a*.06);
            c.save();c.globalAlpha=fade*.7;puff(c,point[0]+a*.04,point[1]-a*.07,3+a*.1,j,'#aab09b','#c0bba0');c.restore();
        }
    }
    const r=t.rocket;if(!r)return;
    const point=(a:number,b:number):Point=>[r.x+r.dx*a-r.dy*b,base+r.y+r.dy*a+r.dx*b];
    if(r.age>=3){
        const motor=smoothMotion((r.age-2)/6),length=5+motor*(5+r.speed*.4)+(reduced?0:r.age%3);
        polygon(c,[point(-8,-1.4),point(-8-length,0),point(-8,1.4)],reduced?'#aaac8b':'#dab77f');
        if(!reduced)polygon(c,[point(-8,-.6),point(-10-length*.55,0),point(-8,.6)],'#f1dbab');
        const fin=1+2*smoothMotion((r.age-4)/4);
        polygon(c,[point(-6,-1),point(-9,-fin),point(-9,fin),point(-6,1)],'#61766c');
        pixelLine(c,...point(-9,-fin),...point(-9,fin),'#a4ab83');
    }
    drawLauncherWarhead({poly:(v,col)=>polygon(c,v,col),line:(x,y,xx,yy,col,width)=>pixelLine(c,x,y,xx,yy,col,width)},
        (a,b)=>point(a*AFTERMATH_SCALE,b*AFTERMATH_SCALE),{ink:'#47565a',green:'#79876d',lit:'#a4ab83'});
}
function drawImpact(c:CanvasRenderingContext2D,t:HypotheticalTower,base:number,reduced:boolean){
    const a=t.impactAge,x=BASTION_TOWER.x,y=base+BASTION_TOWER.hitY,dx=t.launch?.dx??-1,dy=t.launch?.dy??0;
    const at=(u:number,v:number):Point=>[x+dx*u-dy*v,y+dy*u+dx*v];
    if(a<0)return;
    if(a<8){
        const scale=1+a*.35;
        polygon(c,[at(-5,-3),at(4,-7*scale),at(7,-2),at(17*scale,0),at(6,3),at(1,6*scale),at(-6,2)],
            reduced?'#b3b092':a<3?'#ead4a2':'#ceb48c');
        if(!reduced&&a<4)polygon(c,[at(-2,-2),at(7,-3),at(13,0),at(4,3)],'#f3e1b3');
    }
    if(!reduced&&a>=2&&a<17){
        const radius=7+a*1.7;
        c.save();c.globalAlpha=(1-a/17)*.65;
        for(let j=0;j<7;j++){
            const angle=-Math.PI*.8+j*.75;
            pixelLine(c,...at(Math.cos(angle)*radius,Math.sin(angle)*radius*.75),
                ...at(Math.cos(angle+.24)*radius,Math.sin(angle+.24)*radius*.75),'#d9c49b');
        }
        c.restore();
    }
    // Hot breach, outward dust, then a cooling plume; no full-screen flash.
    for(let j=0;j<(reduced?2:5);j++){
        const age=a-3-j*2;if(age<0||age>48)continue;
        const fade=1-smoothMotion((age-9)/39),angle=j*2.4;
        const px=x+Math.cos(angle)*(4+age*.32)+dx*age*.2,py=y+Math.sin(angle)*(3+age*.16)-age*.06;
        c.save();c.globalAlpha=fade;
        puff(c,px,py,(4+age*.32)*fade,j,age<8&&!reduced?'#c6a178':'#9b9c87',age<8&&!reduced?'#e3c08c':'#bab39a');
        c.restore();
    }
    if(!reduced)for(let j=0;j<6;j++){
        const age=a-8-j*9;if(age<0||age>180)continue;
        const fade=smoothMotion(age/10)*(1-smoothMotion((age-84)/96));
        c.save();c.globalAlpha=fade*.72;
        puff(c,x+(j%3-1)*7+age*.11,y-6-age*.19-j%2*5,6+age*.065,j,'#8e9a8e','#afb09a');
        c.restore();
    }
}

/** Effects use the scenic bodies' contact points and times. Their draw order
 * stays behind Feka, enemies, foreground platforms and combat telegraphs. */
export function drawTowerEffects(c:CanvasRenderingContext2D,t:HypotheticalTower,base:number,reduced:boolean){
    drawRocket(c,t,base,reduced);drawImpact(c,t,base,reduced);
    const age=t.impactAge,physics=t.destruction,x=BASTION_TOWER.x;if(age<0)return;
    for(const [i,p] of physics.chips.entries()){
        if(reduced&&i%3)continue;
        const a=age-p.born,fade=p.keep?1:1-smoothMotion((a-180)/60),co=Math.cos(p.angle),si=Math.sin(p.angle);
        const at=(u:number,v:number):Point=>[x+p.x+u*co-v*si,base+p.y+u*si+v*co],r=p.radius;
        c.save();c.globalAlpha=fade;
        polygon(c,[at(-r,-r*.6),at(r*.6,-r),at(r,r*.4),at(-r*.4,r)],p.material==='tile'?'#6f877e':'#899884');
        pixelLine(c,...at(-r,-r*.6),...at(r*.6,-r),'#bdba9a');
        if(!p.rest&&p.vy>1.8&&!reduced)pixelLine(c,x+p.x-p.vx,base+p.y-p.vy,x+p.x,base+p.y,'#9fa58c');
        c.restore();
    }
    for(const f of physics.fractures){
        const a=age-f.born,fade=1-smoothMotion((a-10)/60);
        for(let j=0;j<(reduced?2:5);j++){
            c.save();c.globalAlpha=fade*.6;
            puff(c,x+f.x+(j-2)*(4+a*.13),base+f.y+a*.16,2+a*.05,j,'#a5ac96','#bcb99e');c.restore();
        }
    }
    for(const hit of physics.contacts){
        const a=age-hit.born,fade=1-smoothMotion((a-8)/75),force=Math.min(1.5,hit.strength);
        if(force<.2)continue;
        for(let j=0;j<(reduced?2:5);j++){
            const side=j%2?-1:1,distance=(3+a*.18)*(1+j*.6)*force;
            const px=x+hit.x+side*distance,py=base+hit.y-1-Math.sin(Math.PI*Math.min(1,a/80))*(3+j%2*3);
            c.save();c.globalAlpha=fade*(hit.first?.7:.35);
            puff(c,px,py,(3+a*.07)*force,j,'#a6ad95','#c0b99b');c.restore();
        }
        if(!reduced&&a<12)for(let j=0;j<4;j++){
            const px=x+hit.x+(j-1.5)*(2+a*.5)*force,py=base+hit.y-1-a*.4+.025*a*a;
            box(c,px,py,1,1,'#cac0a1');
        }
    }
}
