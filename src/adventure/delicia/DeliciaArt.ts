import { PLAYER_PALETTE, PLAYER_SPRITES, PLAYER_WALK } from '../../assets/playerSpriteSpec';
import { SpriteAtlas } from '../../graphics/pixels';
import { DELICIA_ASSETS, type Box, type StagePickup } from './DeliciaContent';
import { DeliciaSimulation, movingFloor, steamPhase, type DeliciaEnemy } from './DeliciaSimulation';
import type { DeliciaBoss, BossMissile } from './DeliciaBoss';
import { drawLandmarks, drawMachine, drawAtmosphere, drawSetDressing } from './DeliciaScenery';
import { drawPlatformSupports, drawTerrain } from './DeliciaTerrain';
import { characterFrames, drawCharacterFrame } from './DeliciaSpriteFrames';
import { panel, pixelText } from '../../graphics/BitmapFont';
import { ART } from '../../graphics/palette';
const TAU=Math.PI*2;
const ellipse=(c:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,color:string)=>{c.fillStyle=color;c.beginPath();c.ellipse(x,y,rx,ry,0,0,TAU);c.fill();};
const rect=(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,color:string,r=0)=>{c.fillStyle=color;c.beginPath();c.roundRect(x,y,w,h,r);c.fill();};
const line=(c:CanvasRenderingContext2D,x:number,y:number,x2:number,y2:number,width:number,color:string)=>{c.strokeStyle=color;c.lineWidth=width;c.lineCap='round';c.beginPath();c.moveTo(x,y);c.lineTo(x2,y2);c.stroke();};
function shade(c:CanvasRenderingContext2D,x:number,y:number,w:number,h:number,a:string,b:string):CanvasGradient{const g=c.createLinearGradient(x,y,x+w,y+h);g.addColorStop(0,a);g.addColorStop(1,b);return g;}
function circle(c:CanvasRenderingContext2D,x:number,y:number,r:number,a:string,b:string):void{c.fillStyle=shade(c,x-r,y-r,r*2,r*2,a,b);c.beginPath();c.arc(x,y,r,0,TAU);c.fill();}
export class DeliciaArt {
    readonly atlas=new SpriteAtlas();readonly images=new Map<string,HTMLImageElement>();private disposed=false;
    private poses=new WeakMap<DeliciaBoss,{pose:number;from:number;at:number}>();
    // Title, island and portraits belong to their DOM/CSS views, not this gameplay cache.
    async load():Promise<void>{await Promise.all(['backdrop','environment-atlas','props','boss-atlas','enemies-v2','jaja-motion-v2','guina-motion-v2','landmarks-v2','terrain-v2'].map(name=>new Promise<void>(resolve=>{const img=new Image();img.onload=()=>{if(!this.disposed)this.images.set(name,img);resolve();};img.onerror=()=>resolve();img.src=DELICIA_ASSETS+name+'.webp'+(name==='landmarks-v2'||name==='props'?'?v=5':'');})));}
    dispose():void{this.disposed=true;this.images.clear();}
    draw(c:CanvasRenderingContext2D,sim:DeliciaSimulation,reduced=false):void{
        const {stage}=sim,time=reduced?0:sim.time,cx=sim.cameraX,cy=sim.cameraY;c.clearRect(0,0,960,540);c.imageSmoothingEnabled=true;
        const environment=this.images.get('environment-atlas'),cell=stage.biome==='harbor'?0:stage.biome==='reservoir'?1:stage.biome==='cellar'?2:stage.biome==='refinery'||stage.biome==='citadel'?3:-1;
        const bg=cell>=0&&environment?environment:this.images.get('backdrop');if(bg){
            const sw=cell>=0&&environment?bg.naturalWidth/2:bg.naturalWidth,sh=cell>=0&&environment?bg.naturalHeight/2:bg.naturalHeight,sx=cell>=0&&environment?(cell%2)*sw:0,sy=cell>=0&&environment?Math.floor(cell/2)*sh:0;
            const scale=Math.max(1260/sw,710/sh),width=sw*scale,height=sh*scale,offset=cx*.045%width;
            for(let x=-offset;x<960;x+=width)c.drawImage(bg,sx,sy,sw,sh,x,-cy*.08-(height-710)*.4,width,height);
        }else{c.fillStyle=shade(c,0,0,0,540,'#bce1d5','#174755');c.fillRect(0,0,960,540);}
        const interior=['cellar','refinery','citadel'].includes(stage.biome);
        c.fillStyle=interior?'#163c4560':'#cadfc840';c.fillRect(0,0,960,540);
        const distance=c.createLinearGradient(0,220,0,540);distance.addColorStop(0,'#74988800');distance.addColorStop(1,interior?'#244c5a85':'#b4cab288');c.fillStyle=distance;c.fillRect(0,0,960,540);
        drawSetDressing(c,sim,this.images.get('props'));
        drawLandmarks(c,sim,time,this.images.get('landmarks-v2'));drawAtmosphere(c,sim,time);
        c.save();c.translate(-cx,-cy);
        drawPlatformSupports(c,sim);
        for(const h of stage.hazards)if(h.x>cx-180&&h.x<cx+1100){
            if(h.kind==='juice')this.juice(c,h,time);
            if(h.kind==='steam')this.steam(c,h,steamPhase(sim.time,h.period,h.phase),time);
        }
        stage.floors.forEach((f,index)=>{if(f.x+f.w<cx-180||f.x>cx+1100)return;if((sim.crumble.get(index)??0)>1)return;if(!sim.floorAvailable(f)){c.setLineDash([5,9]);line(c,f.x,f.y,f.x+f.w,f.y,2,'#b2eac066');c.setLineDash([]);return;}drawTerrain(c,f,movingFloor(f,sim.time),time,sim.crumble.get(index)??0,this.images.get('terrain-v2'));});
        for(const machine of stage.machines??[])if(machine.x>cx-150&&machine.x<cx+1110)drawMachine(c,machine,sim,time);
        if(sim.boss){for(const gap of sim.boss.gaps){rect(c,gap.x,450,gap.w,450,'#152c37');this.juice(c,{...gap,y:600,h:200},time);line(c,gap.x,450,gap.x+gap.w,450,5,'#e7a346');}this.bossWarning(c,sim.boss,time);}
        for(const valve of stage.valves){if(Math.abs(valve.x-cx)>1100)continue;const active=sim.boss?!sim.valveReady(valve.id):sim.valves.has(valve.id);this.valve(c,valve.x,valve.y,active,time,sim.nearbyValve?.id===valve.id);}
        stage.checkpoints.forEach((cp,index)=>{if(Math.abs(cp.x-cx)>1100)return;line(c,cp.x,cp.y+54,cp.x,cp.y-26,5,'#ddd5ad');c.fillStyle=index<=sim.checkpoint?'#8ae0b2':'#efe0b7';c.beginPath();c.moveTo(cp.x,cp.y-25);c.lineTo(cp.x+35,cp.y-19+Math.sin(time*3)*3);c.lineTo(cp.x,cp.y+2);c.fill();});
        for(const pickup of stage.pickups)if(!sim.collected.has(pickup.id)&&pickup.x>cx-80&&pickup.x<cx+1040)this.pickup(c,pickup,time);
        for(const e of sim.enemies)if(e.state!=='dead'&&e.x>cx-100&&e.x<cx+1060)this.enemy(c,e,time);
        for(const m of [...sim.projectiles,...(sim.boss?.missiles??[])])this.projectile(c,m,time);
        this.gate(c,stage.gate,sim.gateOpen,time);
        if(sim.boss)this.boss(c,sim.boss,time);
        const p=sim.player;c.save();c.imageSmoothingEnabled=false;ellipse(c,p.x+p.w*.5,p.y+p.h+2,21,5,'#102b3766');
        // The stopped decorative clock suppresses blinking, not the protection cue.
        if(reduced&&p.invincible>0){c.beginPath();c.ellipse(p.x+p.w/2,p.y+p.h/2,25,33,0,0,TAU);c.strokeStyle='#173738';c.lineWidth=5;c.stroke();c.strokeStyle='#f2cf89';c.lineWidth=2;c.stroke();}
        if(p.parryTime>0){c.strokeStyle='#a5f2e2';c.lineWidth=3;c.beginPath();c.arc(p.x+17,p.y+25,38,0,TAU);c.stroke();for(let i=0;i<3;i++){const a=time*12+i*TAU/3;ellipse(c,p.x+17+Math.cos(a)*38,p.y+25+Math.sin(a)*38,4,4,'#fff7d6');}}
        if(p.invincible<=0||Math.floor(time*13)%2===0){
            const sprite=p.pounding?PLAYER_SPRITES.sit:!p.grounded?(p.vy<0?PLAYER_SPRITES.jump:PLAYER_SPRITES.fall):Math.abs(p.vx)>15?PLAYER_WALK[Math.floor(p.walk)%PLAYER_WALK.length]:PLAYER_SPRITES.idle;
            c.translate(p.x+p.w*.5,p.y+p.h);const squish=1+(p.land>0?.1:0);c.scale(squish,1/squish);this.atlas.draw(c,sprite,PLAYER_PALETTE,-16,-52,p.facing<0,2);
        }c.restore();c.imageSmoothingEnabled=true;
        for(const part of sim.particles){c.globalAlpha=Math.min(1,part.life/part.max);ellipse(c,part.x,part.y,part.size,part.size,part.color);}c.globalAlpha=1;c.restore();
        const vignette=c.createRadialGradient(480,255,220,480,255,590);vignette.addColorStop(0,'#142f3700');vignette.addColorStop(1,'#142f3766');c.fillStyle=vignette;c.fillRect(0,0,960,540);
    }
    private juice(c:CanvasRenderingContext2D,b:Box,time:number):void{
        c.fillStyle=shade(c,b.x,b.y,0,180,'#ffc45b','#b86726');c.beginPath();c.moveTo(b.x,b.y);
        for(let i=0;i<=b.w;i+=8)c.lineTo(b.x+i,b.y+Math.sin(i*.055+time*3)*5);c.lineTo(b.x+b.w,b.y+b.h);c.lineTo(b.x,b.y+b.h);c.fill();
        for(let i=0;i<b.w/30;i++)ellipse(c,b.x+10+i*30,b.y+Math.sin(i+time*2)*4,7,2,'#fff0b3a3');
    }
    private steam(c:CanvasRenderingContext2D,b:Box,phase:string,time:number):void{
        rect(c,b.x-8,b.y+b.h-12,b.w+16,16,'#b69752',4);if(phase==='safe'){ellipse(c,b.x+b.w/2,b.y+b.h-14,5,3,'#89d2ad');return;}
        if(phase==='tell'){c.globalAlpha=.25+Math.sin(time*13)*.12;rect(c,b.x-10,b.y-15,b.w+20,b.h+15,'#ffc457',5);c.globalAlpha=1;return;}
        for(let j=0;j<8;j++){const yy=b.y+(j*17+time*180)%b.h;ellipse(c,b.x+b.w/2+Math.sin(j+time*10)*6,yy,14+(8-j)*1.1,14,'#ffd29a9e');}line(c,b.x+b.w/2,b.y+b.h,b.x+b.w/2,b.y,8,'#ffc362b9');
    }
    private pickup(c:CanvasRenderingContext2D,p:StagePickup,time:number):void{
        const y=p.y+Math.sin(time*3+p.x)*4;if(p.kind==='orange'){circle(c,p.x,y,10,'#ffe184','#ed902e');ellipse(c,p.x+2,y-10,5,2,'#71a755');line(c,p.x-4,y-4,p.x-2,y-6,2,'#fff0bc');}
        else if(p.kind==='heart'){c.fillStyle='#ee8c75';c.font='28px Georgia';c.fillText('♥',p.x-14,y+10);}
        else{c.save();c.translate(p.x,y);c.rotate(Math.sin(time)*.12);c.fillStyle=p.kind==='memory'?'#a8e6ce':'#f5d779';c.beginPath();c.moveTo(0,-18);c.lineTo(14,0);c.lineTo(0,18);c.lineTo(-14,0);c.closePath();c.fill();line(c,-2,-10,-2,8,2,'#fff7d4');c.restore();}
    }
    private valve(c:CanvasRenderingContext2D,x:number,y:number,active:boolean,time:number,near:boolean):void{
        rect(c,x-20,y-8,40,8,'#b59a64',3);rect(c,x-9,y-40,18,33,'#315f54',4);line(c,x-5,y-12,x-5,y-38,2,'#81aa86');
        line(c,x+8,y-27,x+25,y-27,7,'#a88e5a');line(c,x+25,y-27,x+25,y-49,5,'#a88e5a');
        circle(c,x+25,y-56,10,'#e1c98b','#8e794e');ellipse(c,x+25,y-56,7,7,'#ede5bb');line(c,x+25,y-56,x+25+(active?4:-4),y-60,2,'#48685a');
        circle(c,x,y-42,19,active?'#c1e5a7':'#f0c56f',active?'#639d75':'#a87d39');ellipse(c,x,y-42,13,13,'#294d4a');
        for(let i=0;i<4;i++){const a=i*TAU/4+(active?time*.4:0);line(c,x,y-42,x+Math.cos(a)*15,y-42+Math.sin(a)*15,3,active?'#a8d5a1':'#ddba72');}
        ellipse(c,x,y-42,4,4,'#f6df9f');
        if(near){panel(c,x-63,y-112,126,29,ART.ink,ART.rockLight);pixelText(c,active?'ABERTA':'E · ABRIR',x,y-103,ART.paper,2,'center');}
    }
    private enemy(c:CanvasRenderingContext2D,e:DeliciaEnemy,time:number):void{
        const bob=e.kind==='roller'?0:e.state==='stun'?Math.sin(time*20)*2:Math.sin(time*5+e.phase)*2,x=e.x+e.w/2,y=e.y+e.h/2+bob;
        if(e.kind!=='wasp')ellipse(c,x,e.y+e.h+3,e.w*.52,5,'#15383d55');
        const sheet=this.images.get('enemies-v2');if(sheet){
            const order=['pulp','beetle','wasp','roller','sentinel','bottler','mimic','bloom'],index=order.indexOf(e.kind),roller=e.kind==='roller';
            c.save();c.translate(x,e.y+(roller?e.h/2:e.h)+bob);c.scale(e.vx>0?-1:1,1);
            const squash=e.state==='tell'?1.08:1+Math.sin(time*(e.kind==='wasp'?18:7)+e.phase)*.025;c.scale(squash,1/squash);
            if(e.kind==='roller')c.rotate(time*e.vx*.012);else c.rotate(e.state==='attack'?-.18:e.state==='tell'?.08:Math.sin(time*5+e.phase)*.018);
            if((e.flash??0)>0)c.filter='brightness(1.7)';
            const frame=characterFrames(sheet,'enemies')[index],height=roller?50:e.kind==='wasp'?43:52,scale=Math.min((roller?50:66)/frame.w,height/(frame.foot-frame.y));
            drawCharacterFrame(c,sheet,frame,0,roller?25:0,scale);c.restore();
            if(e.state==='tell'){rect(c,x-9,e.y-30,18,24,'#3c4440',6);c.fillStyle='#ffe3a0';c.font='bold 20px sans-serif';c.fillText('!',x-3,e.y-12);}
            if(e.state==='stun')for(let i=0;i<3;i++){const a=time*4+i*TAU/3;circle(c,x+Math.cos(a)*23,e.y-10+Math.sin(a)*6,3,'#fff4af','#d3b158');}
            return;
        }
        if(e.kind==='wasp'){ellipse(c,x-20,y-15,22,9,'#f5e6b5a8');ellipse(c,x+20,y-15,22,9,'#f5e6b5a8');circle(c,x,y,19,'#fbd670','#cf8f34');line(c,x-4,y-16,x-4,y+16,5,'#354b3d');}
        else if(e.kind==='bottler'){rect(c,x-15,y-20,30,43,'#72b8a1',9);rect(c,x-7,y-29,14,14,'#d4ab55',3);rect(c,x-11,y,22,14,'#edb445',3);}
        else if(e.kind==='sentinel'){circle(c,x,y,24,'#d9b46b','#6f815b');rect(c,x-23,y-25,46,13,'#c5a351',7);rect(c,x-15,y-9,30,13,'#203f3e',4);}
        else if(e.kind==='mimic'){rect(c,x-24,y-23,48,47,'#a47643',8);for(let j=0;j<2;j++)line(c,x-24,y-14+j*26,x+24,y-14+j*26,4,'#d0a85d');}
        else if(e.kind==='roller'){circle(c,x,y,25,'#e3c06e','#716f46');c.save();c.translate(x,y);c.rotate(time*e.vx*.025);for(let j=0;j<8;j++){const a=j*TAU/8;line(c,Math.cos(a)*14,Math.sin(a)*14,Math.cos(a)*23,Math.sin(a)*23,5,'#d9b45f');}c.restore();}
        else if(e.kind==='beetle'){ellipse(c,x,y,23,19,'#96ab55');line(c,x,y-17,x,y+17,3,'#315c42');for(let i=0;i<2;i++)line(c,x-20+i*40,y+8,x-30+i*60,y+21,3,'#446747');}
        else{ellipse(c,x,y+5,24+Math.sin(time*4)*2,20,'#e8a84f');ellipse(c,x,y-7,16,15,'#ffd285');}
        for(const dx of [-8,8]){ellipse(c,x+dx,y-4,5,7,'#fff0cb');ellipse(c,x+dx+Math.sign(e.vx)*1.5,y-3,2,3,'#203638');}
        if(e.state==='tell'){c.font='bold 22px sans-serif';c.fillStyle='#ffd174';c.fillText('!',x-3,e.y-14);}
        if(e.state==='stun'){for(let i=0;i<3;i++){const a=time*4+i*TAU/3;circle(c,x+Math.cos(a)*24,e.y-8+Math.sin(a)*5,3,'#fff4af','#d3b158');}}
    }
    private projectile(c:CanvasRenderingContext2D,m:BossMissile,time:number):void{
        const x=m.x+m.w/2,y=m.y+m.h/2;
        if(m.kind==='wave'){
            c.save();c.translate(x,m.y+m.h);c.scale(Math.sign(m.vx)||1,1);c.fillStyle=shade(c,-32,-30,64,30,'#ffe5a0',m.friendly?'#69cbb8':'#ed9e37');c.beginPath();c.moveTo(-33,0);c.quadraticCurveTo(-16,-10,-12,-25);c.bezierCurveTo(-4,-45,31,-30,23,-16);c.quadraticCurveTo(17,-27,8,-22);c.quadraticCurveTo(15,-10,33,0);c.closePath();c.fill();line(c,-20,-8,18,-6,2,'#fff3c4');c.restore();
        }else if(m.kind==='heart'){c.save();c.translate(x,y);c.rotate(Math.sin(time*5)*.18);c.fillStyle=m.friendly?'#a7ead8':'#ee9cac';c.font='28px Georgia';c.fillText('♥',-12,10);c.restore();}
        else if(m.kind==='seed'){ellipse(c,x,y,8,5,m.friendly?'#f8db81':'#9fb155');line(c,x-9*Math.sign(m.vx),y,x-20*Math.sign(m.vx),y,2,'#fff0b755');}
        else{circle(c,x,y,12,'#ffe193','#e79934');ellipse(c,x-3,y-4,3,4,'#fff2c0');}
    }
    private gate(c:CanvasRenderingContext2D,g:Box,open:boolean,time:number):void{
        const foot=g.y+g.h;
        for(const x of [g.x,g.x+g.w-14]){
            c.fillStyle=shade(c,x,g.y,14,0,'#ecd6a8','#a3956d');c.fillRect(x,g.y+4,14,g.h-4);
            for(let yy=g.y+22;yy<foot-10;yy+=19)line(c,x+1,yy,x+13,yy,1,'#887d5b88');
            rect(c,x-4,foot-9,22,9,'#c2b087',2);line(c,x-2,foot-8,x+16,foot-8,2,'#f2dcab');
        }
        rect(c,g.x-7,g.y-8,g.w+14,16,'#bcaa7b',3);line(c,g.x-5,g.y-7,g.x+g.w+5,g.y-7,3,'#efdaab');
        rect(c,g.x+g.w/2-8,g.y-12,16,23,'#dbc491',3);
        c.strokeStyle='#d9c18d';c.lineWidth=6;c.beginPath();c.arc(g.x+g.w/2,g.y+31,(g.w-22)/2,Math.PI,TAU);c.stroke();
        circle(c,g.x+g.w/2,g.y-2,5,open?'#d5efb2':'#e9c06f',open?'#709e6d':'#9b885c');
        if(open){for(let i=0;i<5;i++){const yy=g.y+15+(time*35+i*17)%75;ellipse(c,g.x+12+(i*11)%38,yy,3,3,'#fce6a9');}}
        else{for(let i=0;i<3;i++)line(c,g.x+18+i*13,g.y+25,g.x+18+i*13,foot,3,'#556e55');line(c,g.x+14,g.y+55,g.x+g.w-14,g.y+55,3,'#9a9b6a');}
    }
    private bossWarning(c:CanvasRenderingContext2D,b:DeliciaBoss,time:number):void{
        if(b.beat==='tell'){
            for(const w of b.warnings){c.globalAlpha=.12+b.progress*.2;rect(c,w.x,b.attack==='gap'?420:w.y,w.w,b.attack==='gap'?30:Math.min(w.h,450-w.y),'#ffd178');c.globalAlpha=1;for(let x=w.x;x<w.x+w.w-12;x+=24)line(c,x,444,x+12,432,3,'#ffdc80');line(c,w.x,448,w.x+w.w*b.progress,448,4,'#fff1b0');}
            if(b.attack==='cup'){c.strokeStyle='#ffe7a799';c.lineWidth=3;c.setLineDash([5,8]);c.beginPath();c.ellipse(b.target.x+50,447,60+b.phase*20,7,0,0,TAU);c.stroke();c.setLineDash([]);}
        }
        for(const d of b.danger){c.fillStyle=shade(c,d.x,0,0,d.h,'#fbe39188','#f08b3277');c.fillRect(d.x,d.y,d.w,d.h);line(c,d.x+d.w/2,d.y,d.x+d.w/2,d.y+d.h,8,'#ffc766');for(let i=0;i<8;i++){const yy=d.y+(time*230+i*47)%d.h;ellipse(c,d.x+10+(i*23)%Math.max(1,d.w-15),yy,5,10,'#ffe9ab99');}}
        if(b.beat==='transition'){const radius=35+b.beatTime*210;c.strokeStyle='#ffe2a178';c.lineWidth=6;c.beginPath();c.ellipse(b.x+48,450,radius,radius*.19,0,0,TAU);c.stroke();}
    }
    private animatedBoss(c:CanvasRenderingContext2D,b:DeliciaBoss,time:number):boolean {
        const sheet=this.images.get(b.character+'-motion-v2');if(!sheet)return false;
        const pose=b.beat==='defeated'?7:b.beat==='transition'?6:b.beat==='recover'||b.beat==='stagger'?5:b.beat==='tell'?(b.attack==='court'?4:1):b.beat==='attack'?(b.attack==='charge'?3:b.character==='guina'&&b.attack==='court'?4:b.character==='jaja'&&b.attack!=='cup'?4:2):0;
        let state=this.poses.get(b);if(!state){state={pose,from:pose,at:b.time};this.poses.set(b,state);}if(state.pose!==pose){state.from=state.pose;state.pose=pose;state.at=b.time;}
        const blend=Math.min(1,(b.time-state.at)/.115),attack=b.beat==='attack',windup=b.beat==='tell'?b.progress:0;
        const pulse=attack?Math.sin(Math.min(1,b.beatTime/.32)*Math.PI):0,breath=Math.sin(time*3)*.012;
        const stretch=b.beat==='transition'?1+Math.sin(b.beatTime*4)*.025:1+breath-windup*.035+pulse*.05;
        ellipse(c,b.x+48,453,55+(attack?pulse*12:0),9,'#0e303866');c.save();c.translate(b.x+48,b.y+b.h);c.scale(b.direction>0?-1:1,1);
        c.rotate(b.beat==='tell'?-.035*windup:b.beat==='attack'&&b.attack==='charge'?Math.sin(time*29)*.025:Math.sin(time*2)*.008);
        c.scale(1/stretch,stretch);c.translate(attack&&b.attack==='charge'?Math.sin(time*22)*2:0,attack&&b.attack==='charge'?-Math.abs(Math.sin(time*22))*5:0);
        const frames=characterFrames(sheet,b.character),scale=172/(frames[0].foot-frames[0].y);
        const draw=(frame:number,alpha:number)=>{c.globalAlpha=alpha;if(b.hitFlash>0)c.filter='brightness(1.65)';drawCharacterFrame(c,sheet,frames[frame],0,0,scale);};
        if(blend<1)draw(state.from,1-blend);draw(pose,blend);c.globalAlpha=1;c.filter='none';
        if(b.shield){c.strokeStyle='#f2cf8988';c.lineWidth=3;c.beginPath();c.ellipse(0,-80,66,90,0,0,TAU);c.stroke();for(let i=0;i<8;i++){const a=time*.4+i*TAU/8;ellipse(c,Math.cos(a)*66,-80+Math.sin(a)*90,3,3,'#ffde93');}}
        if(b.vulnerable){c.fillStyle='#bcf6d7';c.font='bold 12px sans-serif';c.textAlign='center';c.fillText('ABERTO',0,-199);c.textAlign='left';}
        c.restore();return true;
    }
    private boss(c:CanvasRenderingContext2D,b:DeliciaBoss,time:number):void{
        if(this.animatedBoss(c,b,time))return;
        const x=b.x+48,foot=b.y+b.h,stagger=b.vulnerable,bob=Math.sin(time*3)*2,lean=b.beat==='tell'?b.progress*.13:b.attack==='charge'&&b.beat==='attack'?-.28:stagger?.12:0;
        const atlas=this.images.get('boss-atlas');if(atlas){
            ellipse(c,x,foot+3,60,10,'#17373866');c.save();c.translate(x,foot);c.rotate(lean*.6);const breath=1+Math.sin(time*3)*.008;c.scale(b.direction>0?-breath:breath,b.beat==='defeated'?.65:1/breath);c.translate(0,bob);
            const row=b.beat==='tell'||b.beat==='attack'?1:stagger||b.beat==='recover'||b.beat==='defeated'?2:0;
            const cellW=atlas.naturalWidth/2,cellH=atlas.naturalHeight/3,column=b.character==='jaja'?0:1;
            c.imageSmoothingEnabled=true;c.drawImage(atlas,column*cellW,row*cellH,cellW,cellH,-87,-173,174,174);
            if(b.shield){c.strokeStyle='#eed18399';c.lineWidth=3;c.beginPath();c.ellipse(0,-82,72,90,0,0,TAU);c.stroke();}
            if(stagger)for(let i=0;i<3;i++){const a=time*3+i*TAU/3;circle(c,Math.cos(a)*45,-177+Math.sin(a)*6,4,'#fff1b3','#cbac60');}
            c.restore();return;
        }
        ellipse(c,x,foot+3,60,10,'#17373866');c.save();c.translate(x,foot);c.rotate(lean);if(b.beat==='defeated')c.scale(1.1,.7);c.translate(0,bob);
        const skin=b.character==='guina'?'#9e6442':'#d9a278',dark=b.character==='guina'?'#69402f':'#a97552',cloth=b.character==='guina'?'#56384e':'#457357';
        const swing=b.beat==='attack'?Math.sin(time*20)*8:Math.sin(time*3)*2;
        for(let i=0;i<2;i++){const xx=i?18:-18;line(c,xx,-35,xx+swing*(i?1:-1),-10,22,'#273e38');ellipse(c,xx+(i?7:-7),-4,21,9,'#1e3634');}
        c.fillStyle=shade(c,-40,-118,80,100,cloth,b.character==='guina'?'#2a3540':'#294e40');c.beginPath();c.roundRect(-42,-110,84,86,[25,25,12,12]);c.fill();
        if(b.character==='guina'){
            for(let i=0;i<2;i++){ellipse(c,i?38:-38,-99,23,13,'#c5a052');ellipse(c,i?38:-38,-102,20,8,'#e1bf76');line(c,i?25:-25,-95,i?18:-18,-37,3,'#d3aa5b');}rect(c,-27,-43,54,10,'#b28c48',3);
        }else{for(let i=0;i<2;i++){line(c,i?23:-23,-105,i?20:-20,-50,9,'#dab776');}rect(c,-28,-83,56,51,'#4c825d',7);line(c,-18,-61,18,-61,2,'#bda65d');}
        for(let i=0;i<2;i++){
            const arm=i?1:-1,raised=b.beat==='tell'&&((b.attack==='cup'&&i===0)||(b.attack==='gap'&&i===1));const handY=raised?-147:-55+swing;
            line(c,arm*37,-96,arm*58,-74+(raised?-25:0),23,b.character==='guina'?cloth:'#f1dfb3');line(c,arm*58,-74+(raised?-25:0),arm*61,handY,18,skin);ellipse(c,arm*61,handY,13,15,skin);
            for(let finger=0;finger<3;finger++)line(c,arm*58+finger*3,handY-4,arm*58+finger*3,handY+5,1,dark);
            if(b.character==='jaja'&&i===0){rect(c,-78,handY-36,34,36,'#e4c378',6);rect(c,-75,handY-33,28,26,'#efa936',5);line(c,-61,handY,-61,handY+11,4,'#dcb866');ellipse(c,-61,handY+12,18,4,'#d5ab55');}
        }
        circle(c,0,-72,14,'#ebc36e','#a28142');circle(c,0,-72,10,'#f7b84b','#da9237');line(c,0,-72,6,-79,2,'#664b35');
        ellipse(c,0,-121,31,34,skin);ellipse(c,-27,-121,6,10,skin);ellipse(c,27,-121,6,10,skin);
        if(b.character==='jaja'){ellipse(c,0,-107,26,21,'#584432');ellipse(c,0,-111,20,10,skin);for(let i=0;i<2;i++)ellipse(c,i?25:-25,-143,9,16,'#4e4436');}
        for(const dx of [-12,12]){ellipse(c,dx,-129,8,7,'#fff0d1');ellipse(c,dx+(b.direction<0?-2:2),-129,3.5,4,'#263b36');line(c,dx-7,-141,dx+6,-144+(dx<0?2:0),4,b.character==='guina'?'#49352f':'#634832');}
        ellipse(c,2,-118,8,5,dark);line(c,-9,-106,11,-109,3,'#54392e');if(b.character==='guina'){line(c,-13,-111,2,-113,4,'#46322c');line(c,2,-113,15,-110,4,'#46322c');}
        if(b.shield){c.strokeStyle='#eed18388';c.lineWidth=3;c.beginPath();c.ellipse(0,-85,70,90,0,0,TAU);c.stroke();}
        if(stagger){for(let i=0;i<3;i++){const a=time*3+i*TAU/3;circle(c,Math.cos(a)*45,-170+Math.sin(a)*6,4,'#fff1b3','#cbac60');}}
        c.restore();
    }
}
