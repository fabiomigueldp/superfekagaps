import {box,pixelLine,polygon,type Point} from '../WorldPainting';
import {smoothMotion} from './HypotheticalMotion';
import {BASTION_TOWER,rocketTail,type HypotheticalTower} from './HypotheticalTower';
import {drawLauncherWarhead} from './HypotheticalLauncherArt';
import {AFTERMATH_SCALE} from './HypotheticalAftermathHandling';

/** Irregular, stepped clusters retain the game's pixel grid as they expand. */
function puff(c:CanvasRenderingContext2D,x:number,y:number,r:number,seed:number,color:string,light:string){
    const lean=(seed%3-1)*r*.12;
    polygon(c,[[x-r,y],[x-r*.75+lean,y-r*.45],[x-r*.2,y-r*.4],[x+lean,y-r*.75],[x+r*.5,y-r*.55],
        [x+r*.6,y-r*.15],[x+r,y],[x+r*.8,y+r*.25],[x+r*.1,y+r*.35],[x-r*.6,y+r*.25]],color);
    box(c,x-r*.5+seed%2,y-r*.32,r*.5,Math.max(1,r*.16),light);
    box(c,x+r*.1,y-r*.52,r*.3,Math.max(1,r*.13),light);
}
export function drawScenicRocket(c:CanvasRenderingContext2D,t:Pick<HypotheticalTower,'tick'|'launchAt'|'launch'|'trail'|'rocket'>,base:number,reduced:boolean){
    const launch=t.launch;if(!launch)return;
    const age=t.tick-t.launchAt,at=(x:number,y:number,a:number,b:number):Point=>
        [x+launch.dx*a-launch.dy*b,base+y+launch.dy*a+launch.dx*b];
    if(!reduced){
        // These exhaust points stay where they were emitted; the smoke is not
        // stretched between the moving missile and the barrel.
        const points=t.trail.map(p=>{
            const a=t.tick-p.born,eddy=Math.sin(p.seed*.53+a*.07)*(.15+smoothMotion(a/30)*.65);
            return {a,x:p.x+a*.065,y:base+p.y-a*.035+eddy,seed:p.seed};
        });
        for(let i=0;i<points.length;i++){
            const p=points[i],a=p.a,fade=1-smoothMotion((a-24)/64),r=1.25+a*.045,previous=points[i-1];
            // A young filament connects neighboring emissions. It unravels as
            // the expanding clusters drift, instead of becoming a dotted line.
            if(previous&&a<28){
                c.save();c.globalAlpha=.36*(1-smoothMotion(a/28));
                pixelLine(c,previous.x,previous.y,p.x,p.y,'#c8c5ab');c.restore();
            }
            c.save();c.globalAlpha=(a<12?.7:.55)*fade;
            puff(c,p.x,p.y,r,p.seed,a<24?'#c4c3ac':'#a7afa0','#c4c1a9');c.restore();
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
    const tail=rocketTail(r.age);
    if(r.age>0){
        polygon(c,[point(-8,-1.3),point(-tail,-.8),point(-tail,.8),point(-8,1.3)],'#536e66');
        pixelLine(c,...point(-8,-1),...point(-tail,-1),'#9ea78c');
    }
    if(r.age>=3){
        const motor=smoothMotion((r.age-2)/6),length=5+motor*(5+r.speed*.4)+(reduced?0:r.age%3);
        polygon(c,[point(-tail,-1.3),point(-tail-length,0),point(-tail,1.3)],reduced?'#aaac8b':'#dab77f');
        if(!reduced)polygon(c,[point(-tail,-.6),point(-tail-length*.65,0),point(-tail,.6)],'#f1dbab');
        const fin=1+2*smoothMotion((r.age-4)/4);
        polygon(c,[point(-tail+3,-1),point(-tail,-fin),point(-tail,fin),point(-tail+3,1)],'#61766c');
        pixelLine(c,...point(-tail,-fin),...point(-tail,fin),'#a4ab83');
    }
    drawLauncherWarhead({poly:(v,col)=>polygon(c,v,col),line:(x,y,xx,yy,col,width)=>pixelLine(c,x,y,xx,yy,col,width)},
        (a,b)=>point(a*AFTERMATH_SCALE,b*AFTERMATH_SCALE),{ink:'#47565a',green:'#79876d',lit:'#a4ab83'});
    if(r.age>4&&!reduced)pixelLine(c,...point(-2,-1),...point(-5,-2),'#d8c994');
}
function drawImpact(c:CanvasRenderingContext2D,t:HypotheticalTower,base:number,reduced:boolean){
    const a=t.impactAge,x=BASTION_TOWER.x,y=base+BASTION_TOWER.hitY,dx=t.launch?.dx??-1,dy=t.launch?.dy??0;
    const at=(u:number,v:number):Point=>[x+dx*u-dy*v,y+dy*u+dx*v];
    if(a<0)return;
    if(a<27){
        const envelope=smoothMotion((a+1)/3)*(1-smoothMotion((a-11)/16));
        const radius=(6+14*smoothMotion(a/7))*envelope,edge:Point[]=[];
        for(let j=0;j<14;j++){
            const angle=j*Math.PI/7,reach=radius*(j%3===0?.73:1);
            edge.push(at(Math.cos(angle)*reach+3,Math.sin(angle)*reach*.78));
        }
        polygon(c,edge,reduced?'#b4ae91':a<7?'#d1a579':a<15?'#b79675':'#a9a08a');
        if(!reduced&&a<14){
            const hot=radius*(1-smoothMotion((a-6)/8))*.65;
            puff(c,x+dx*3,y,hot,0,a<5?'#f0dba9':'#e5bc85','#f4e2b0');
        }
    }
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
        puff(c,px,py,4+age*.22,j,age<8&&!reduced?'#c6a178':'#9b9c87',age<8&&!reduced?'#e3c08c':'#bab39a');
        c.restore();
    }
    if(!reduced)for(const p of t.destruction.plumes){
        const age=a-p.born,fade=smoothMotion(age/8)*(1-smoothMotion((age-56)/112));
        const curl=Math.sin(age*.035+p.seed)*Math.min(2,age*.025);
        c.save();c.globalAlpha=fade*.64;
        puff(c,x+p.x+age*p.vx+curl,base+p.y+age*p.vy-age*age*.00022,
            p.radius+Math.sqrt(age)*.7,p.seed,'#8e9a8e','#afb09a');
        c.restore();
    }
}

/** Effects use the scenic bodies' contact points and times. Their draw order
 * stays behind Feka, enemies, foreground platforms and combat telegraphs. */
export function drawTowerEffects(c:CanvasRenderingContext2D,t:HypotheticalTower,base:number,reduced:boolean){
    drawScenicRocket(c,t,base,reduced);drawImpact(c,t,base,reduced);
    const age=t.impactAge,physics=t.destruction,x=BASTION_TOWER.x;if(age<0)return;
    for(const [i,p] of physics.chips.entries()){
        if(reduced&&i%3)continue;
        const a=age-p.born,fade=p.keep?1:1-smoothMotion((a-180)/60),co=Math.cos(p.angle),si=Math.sin(p.angle);
        const at=(u:number,v:number):Point=>[x+p.x+u*co-v*si,base+p.y+u*si+v*co],r=p.radius;
        c.save();c.globalAlpha=fade;
        const long=r*p.stretch,thin=p.material==='wood'?.45:p.material==='tile'?.6:1;
        const palette=p.material==='tile'?['#6f877e','#809084','#637d75']:p.material==='wood'?['#928f72','#7c8370','#a49e7d']:['#899884','#98a18a','#7f9281'];
        polygon(c,[at(-long,-r*.6*thin),at(long*.6,-r*thin),at(long,r*.4*thin),at(-long*.4,r*thin)],palette[p.shade]);
        pixelLine(c,...at(-long,-r*.6*thin),...at(long*.6,-r*thin),p.material==='wood'?'#b6aa87':'#bdba9a');
        if(p.rest){pixelLine(c,...at(-long*.35,r*.7*thin),...at(long*.6,r*.5*thin),'#718777');}
        if(!p.rest&&p.vy>1.8&&!reduced)pixelLine(c,x+p.x-p.vx,base+p.y-p.vy,x+p.x,base+p.y,'#9fa58c');
        c.restore();
    }
    for(const f of physics.fractures){
        const a=age-f.born,fade=1-smoothMotion((a-10)/60),wood=f.material==='wood',count=wood||reduced?2:5;
        for(let j=0;j<count;j++){
            c.save();c.globalAlpha=fade*.6;
            puff(c,x+f.x+(j-(count-1)/2)*(4+a*.13),base+f.y+a*.16,
                (2+a*.05)*(wood?.65:1),j,wood?'#a5a187':'#a5ac96','#bcb99e');c.restore();
        }
    }
    for(const hit of physics.contacts){
        const a=age-hit.born,fade=1-smoothMotion((a-8)/75),force=Math.min(1.5,hit.strength);
        if(force<.2)continue;
        const direction=Math.sign(hit.slide),bias=Math.min(1.3,Math.abs(hit.slide)*.25),bronze=hit.material==='bronze';
        for(let j=0;j<(reduced||bronze?2:5);j++){
            const side=j%2?-1:1,distance=(3+a*.18)*(1+j*.6)*force*(1+side*direction*bias*.4);
            const skid=direction*bias*Math.min(10,a*.3),px=x+hit.x+side*distance+skid;
            const py=base+hit.y-1-Math.sin(Math.PI*Math.min(1,a/80))*(3+j%2*3);
            c.save();c.globalAlpha=fade*(hit.first?.7:.35);
            puff(c,px,py,(3+a*.07)*force,j,'#a6ad95','#c0b99b');c.restore();
        }
        if(!reduced&&a<12)for(let j=0;j<4;j++){
            const px=x+hit.x+(j-1.5)*(2+a*.5)*force+hit.slide*a*.18,py=base+hit.y-1-a*.4+.025*a*a;
            box(c,px,py,hit.material==='tile'?2:1,1,bronze?'#c6b48a':'#cac0a1');
        }
    }
}
