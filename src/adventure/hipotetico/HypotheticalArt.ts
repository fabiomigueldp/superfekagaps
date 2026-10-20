import { drawGunMuzzle, drawGunTracer, drawGunImpact, drawGunCasing } from './HypotheticalGunfire';
import {drawChaseCollapse,drawChaseWave} from './HypotheticalChaseArt';
import {chasePerformance,type ChaseGesture} from './HypotheticalChasePerformance';
import {drawChaseFootfall} from './HypotheticalChaseImpactArt';
import { box, oval, pixelLine, polygon, type Point } from '../WorldPainting';
import { pixelText } from '../../graphics/BitmapFont';
import type { WorldLevel, WorldObjects } from '../WorldPhysics';
import { HYPOTHETICAL, type HypotheticalModel } from './HypotheticalModel';
import { dinosaurLeg, dinosaurTail, dinosaurHeadPoint, dinosaurJawPoint, dinosaurMouthPoint, hypotheticalMotion, riderBend, riderTorsoPoint, smoothMotion } from './HypotheticalMotion';
import { BACKDROP_RIG, backdropBaseline, type HypotheticalBackdrop } from './HypotheticalBackdrop';
import { drawBystanders,drawBystanderGround,drawBystanderEffects,drawCarriedBystander,type CarriedBystander } from './HypotheticalBystanders';
import {drawTowerSearchActors,drawTowerSearchDust} from './HypotheticalTowerSearchArt';
import {drawOpeningStreet,drawOpeningAftermath} from './HypotheticalOpening';
import {drawAftermathYards,drawAftermathEffects} from './HypotheticalAftermathArt';
import {drawDebrisPiece} from './HypotheticalDebrisArt';
import {AFTERMATH_SCALE,type HeldDebris} from './HypotheticalAftermathHandling';
import {drawTowerDebris,drawTowerEffects} from './HypotheticalTowerArt';
import {drawScenicShadow} from './HypotheticalSceneShadow';
import {drawLauncher,drawLauncherHands} from './HypotheticalLauncherArt';
import type {LauncherPose} from './HypotheticalTower';
import type {PlantedFeet} from './HypotheticalAftermathFooting';
import {drawHelicopterRear,drawHelicopterEffects} from './HypotheticalHelicopterArt';
import { drawHypotheticalScenery, drawHypotheticalRubble, drawHypotheticalDestruction, drawHypotheticalMasonry, drawHypotheticalFittings } from './HypotheticalScenery';
import { drawHypotheticalCanister } from './HypotheticalGuardArt';
export { drawHypotheticalGuard } from './HypotheticalGuardArt';

const P = { ink: '#172c36', deep: '#263f3d', shade: '#556047', hide: '#92845a', light: '#bdaa74',
    cream: '#e7cb9c', ivory: '#fff0ce', rust: '#8c5149', brick: '#ae7160', sky: '#cab29a',
    suit: '#304659', lapel: '#607487', skin: '#c58d68', face: '#edbc8e', hair: '#3c3034',
    brass: '#d3a75c', mint: '#99e0cf', hot: '#ffb267', scute:'#6e7953', skinLight:'#f7d2a6',
    mouth:'#593b40', tongue:'#bc796a', leather:'#583f38', stitch:'#b8885d', clothShade:'#203644' };
export interface DinosaurPose { x: number; y: number; facing: number; gait: number; stride: number; breath: number; bow: number; jaw: number; neckDrop: number; recoil: number; aim: number; tail: number; compression: number; tuck: number; reload: number; brace: number; heat: number; cloth: number; blink: boolean; daze: number; armor: number; flash: boolean; defeated: boolean; distant?: boolean; pivot?:number; headPitch?:number; jawHinge?:number; riderDrop?:number; riderLean?:number; rein?:number; focus?:number; eyeClose?:number; voice?:number; lookBack?:number; gore?:number; swallow?:number; heldDebris?:HeldDebris; launcher?:LauncherPose; carriedBystander?:CarriedBystander; feet?:PlantedFeet; chaseGesture?:ChaseGesture }
const fogPalette=new Map<string,string>();
function distantColor(color:string){
    if(!fogPalette.has(color)){
        const rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));
        fogPalette.set(color,'#'+rgb.map((v,i)=>Math.round(v*.66+[163,168,160][i]*.34).toString(16).padStart(2,'0')).join(''));
    }
    return fogPalette.get(color)!;
}

/** Front / three-quarter key pose during a planted turn, with both sides of the face visible. */
function drawDinosaurPivot(c:CanvasRenderingContext2D,p:DinosaurPose){
    // The turn has the same atmospheric palette as the side view, including costume accents.
    if(p.distant){
        const output=c;
        c={set fillStyle(color:string){output.fillStyle=distantColor(color);},
            fillRect(x:number,y:number,w:number,h:number){output.fillRect(x,y,w,h);}} as CanvasRenderingContext2D;
    }
    const profile=Math.sqrt(Math.max(0,1-(p.pivot??0)**2));
    const x=p.x,y=p.y,body=y-43+p.compression,head=x+p.facing*42*profile;
    const rect=(xx:number,yy:number,w:number,h:number,col:string)=>box(c,x+xx,y+yy,w,h,col);
    const saddle=y-64+p.compression,rider=saddle+(p.riderDrop??0),lean=p.riderLean??0;
    if(p.launcher){
        // Narrow rear view of the holstered tube while the actor turns.
        pixelLine(c,x-11,rider-7,x-16,rider-36,P.ink,5);pixelLine(c,x-12,rider-8,x-16,rider-35,'#637653',3);
        pixelLine(c,x-16,rider-34,x-15,rider-31,P.brass,2);
    }
    // The tail rotates behind the hips instead of disappearing at the key pose.
    const tail=x-p.facing*82*profile,root=x-p.facing*12;
    polygon(c,[[root,body-3],[tail,body-2],[tail,body+2],[root,body+20]],P.ink);
    polygon(c,[[root,body+1],[tail+p.facing*4,body],[root,body+16]],P.hide);
    pixelLine(c,root,body+1,tail+p.facing*5,body,P.light);
    for(const d of [-1,1]){
        const foot=x+d*14,lift=d===p.facing?0:3;
        pixelLine(c,x+d*11,body+15,foot,y-13-lift,P.ink,12);
        pixelLine(c,x+d*11,body+15,foot,y-13-lift,d<0?P.shade:P.hide,8);
        box(c,foot-9,y-7-lift,18,6,P.ink);box(c,foot-7,y-6-lift,14,4,P.hide);
        for(let i=0;i<3;i++)box(c,foot-6+i*5,y-3-lift,3,2,P.ivory);
    }
    const half=p.distant?17+4*profile:19+7*profile;
    oval(c,x-half,body-13,half*2,41,P.ink);oval(c,x-half+3,body-11,half*2-6,36,P.hide);
    oval(c,x-half+5,body+5,half*2-10,19,P.shade);
    polygon(c,[[x-9,body-7],[x+10,body-7],[x+8,body+15],[x+2,body+22],[x-7,body+16]],P.light);
    polygon(c,[[x-4,body-3],[x+4,body-3],[x+3,body+16],[x-1,body+19],[x-5,body+12]],P.cream);
    for(let row=0;row<4;row++)for(const d of [-1,1]){
        const sx=x+d*(11+row%2*3)-1,sy=body-5+row*6;
        polygon(c,[[sx-2,sy],[sx+2,sy-1],[sx+4,sy+2],[sx+1,sy+4],[sx-2,sy+2]],row<2?P.scute:P.hide);
        pixelLine(c,sx-1,sy,sx+2,sy-1,P.light);box(c,sx+2,sy+3,2,1,P.shade);
    }
    for(const d of [-1,1]){
        pixelLine(c,x+d*15,body+1,x+d*20,body+10,P.ink,5);
        pixelLine(c,x+d*15,body+1,x+d*20,body+10,P.light,2);
        pixelLine(c,x+d*20,body+10,x+d*15,body+14,P.hide,3);
        box(c,x+d*15-1,body+13,3,3,P.ivory);
    }
    polygon(c,[[x-16,body+8],[head-14,y-67+p.compression],[head+14,y-67+p.compression],[x+17,body+9]],P.hide);
    // Saddle, boots and jacket retain the same vertical anchors as the side pose.
    box(c,x-21,saddle,42,13,P.ink);box(c,x-18,saddle+2,36,7,P.rust);
    box(c,x-17,saddle+8,34,3,P.leather);
    for(let i=0;i<8;i++)box(c,x-16+i*4,saddle+2,2,1,P.stitch);
    for(let i=0;i<Math.min(9,p.armor);i++)box(c,x-16+i*4,saddle+5,2,2,P.brass);
    for(const d of [-1,1]){pixelLine(c,x+d*6,saddle-2,x+d*13,saddle+18,P.suit,6);box(c,x+d*13-3,saddle+16,7,6,P.ink);}
    polygon(c,[[x-13+lean*.7,rider-25],[x+12+lean*.7,rider-25],[x+16,rider-3],[x-16,rider-3]],P.ink);
    polygon(c,[[x-10+lean*.7,rider-23],[x+9+lean*.7,rider-23],[x+12,rider-5],[x-12,rider-5]],P.suit);
    polygon(c,[[x-10+lean*.7,rider-23],[x-5+lean*.7,rider-23],[x-6,rider-6],[x-12,rider-5]],P.clothShade);
    polygon(c,[[x-4+lean,rider-24],[x+5+lean,rider-24],[x+1,rider-11]],P.ivory);
    pixelLine(c,x-6+lean,rider-24,x-3,rider-14,P.lapel,2);pixelLine(c,x+6+lean,rider-24,x+3,rider-14,P.lapel,2);
    pixelLine(c,x-9+lean,rider-23,x+10,rider-5,'#367f60',5);pixelLine(c,x-8+lean,rider-22,x+10,rider-6,'#6fb17a',2);pixelLine(c,x-9+lean,rider-24,x+10,rider-6,P.brass);
    const hx=x+lean;
    polygon(c,[[hx-9,rider-39],[hx+7,rider-40],[hx+10,rider-31],[hx+6,rider-23],[hx-6,rider-23],[hx-11,rider-31]],P.ink);
    polygon(c,[[hx-7,rider-36],[hx+6,rider-37],[hx+7,rider-30],[hx+4,rider-25],[hx-5,rider-25],[hx-8,rider-31]],P.face);
    polygon(c,[[hx-8,rider-31],[hx-4,rider-29],[hx-3,rider-26],[hx+5,rider-27],[hx+4,rider-25],[hx-5,rider-25]],P.skin);
    pixelLine(c,hx-4,rider-25,hx+3,rider-25,P.skinLight);
    box(c,hx-8,rider-40,15,5,P.hair);box(c,hx-9,rider-36,3,5,P.hair);pixelLine(c,hx-7,rider-38,hx+4,rider-39,P.lapel);
    for(const d of [-1,1]){pixelLine(c,hx+d*6,rider-34,hx+d*2,rider-33,P.hair);box(c,hx+d*4-2,rider-32,4,1,P.ivory);box(c,hx+d*4-1,rider-32,2,1,P.ink);}
    box(c,hx,rider-31,2,3,P.skin);box(c,hx-1,rider-30,1,2,P.skinLight);pixelLine(c,hx-3,rider-27,hx+3,rider-27,P.hair);
    box(c,hx-10,rider-32,2,4,P.skin);box(c,hx+8,rider-32,2,4,P.skin);
    box(c,x-12,rider-17,27,4,P.ink);box(c,x-7,rider-17,17,1,P.lapel);box(c,x+4,rider-13,4,7,P.ink);
    for(const d of [-1,1]){pixelLine(c,x+d*12,rider-22,x+d*15,rider-12,P.suit,5);box(c,x+d*10-2,rider-15,4,4,P.face);}
    // A tapered brow, narrow snout and hinged jaw retain the dinosaur's silhouette.
    const ny=y-66+p.compression+p.neckDrop;
    const hw=p.distant?14+2*profile:16+5*profile,jaw=p.jaw*8;
    polygon(c,[[head-hw,ny-4],[head-hw+5,ny-11],[head+hw-5,ny-11],[head+hw,ny-4],[head+hw-3,ny+12],[head+hw-6,ny+20+jaw],[head-hw+6,ny+20+jaw],[head-hw+3,ny+12]],P.ink);
    polygon(c,[[head-hw+3,ny-3],[head-hw+6,ny-8],[head+hw-6,ny-8],[head+hw-3,ny-3],[head+hw-5,ny+10],[head-hw+5,ny+10]],P.hide);
    polygon(c,[[head-7,ny-6],[head+7,ny-6],[head+hw-6,ny+6],[head+hw-5,ny+10],[head-hw+5,ny+10],[head-hw+6,ny+6]],P.light);
    box(c,head-hw+5,ny+13,hw*2-10,3+jaw,P.mouth);
    box(c,head-6,ny+15+jaw*.6,12,2,P.tongue);
    pixelLine(c,head-hw+6,ny+18+jaw,head+hw-6,ny+18+jaw,P.cream);
    for(const d of [-1,1]){
        box(c,head+d*(hw-5)-2,ny-3,5,4,P.ink);box(c,head+d*(hw-5)-1,ny-2,2,2,P.brass);
        pixelLine(c,head+d*(hw-9),ny-5,head+d*(hw-2),ny-6,P.shade,2);
        box(c,head+d*6-1,ny+6,3,2,P.shade);
        box(c,head+d*7-1,ny+4,3,1,P.cream);box(c,head+d*4-1,ny-5,2,1,P.scute);
    }
    for(let i=0;i<5;i++)polygon(c,[[head-10+i*4,ny+11],[head-7+i*4,ny+11],[head-9+i*4,ny+15]],P.ivory);
    pixelLine(c,x-12,rider-11,head-hw+2,ny+13,P.rust);pixelLine(c,x+12,rider-11,head+hw-2,ny+13,P.rust);
    rect(-22,-2,6,1,P.shade);rect(18,-2,7,1,P.shade);
}

/** Pixel scan-converted rig. Every limb shares anchors with the saddle and rider. */
export function drawHypotheticalDinosaur(c: CanvasRenderingContext2D, pose: DinosaurPose) {
    if((pose.pivot??0)>.78){drawDinosaurPivot(c,pose);return;}
    const { x, y, facing: d } = pose, bow = pose.bow, bob = pose.breath;
    const profile=Math.sqrt(Math.max(0,1-(pose.pivot??0)**2));
    let riderBase:number|null=null,headFacing=1,skull=false;
    const headPoint=(point:Point)=>dinosaurHeadPoint(point,neck,pose.headPitch??0);
    const riderPoint=(xx:number,yy:number):Point=>skull?headPoint([xx,yy]):riderBase===null?[xx,yy]
        :riderTorsoPoint([xx*headFacing,yy],riderBase,pose.riderDrop??pose.tuck*18,pose.recoil-pose.tuck*10,pose.riderLean??0);
    const tint=(color:string)=>pose.distant?distantColor(color):color;
    const poly = (pts: Point[], color: string) => polygon(c, pts.map(([xx, yy]) => {
        const p=riderPoint(xx,yy);return [Math.round(x+p[0]*d*profile),Math.round(y+p[1])];
    }), tint(color));
    const line = (x1: number, y1: number, x2: number, y2: number, col: string, w = 1) => {
        const a=riderPoint(x1,y1),b=riderPoint(x2,y2);pixelLine(c,x+d*a[0]*profile,y+a[1],x+d*b[0]*profile,y+b[1],tint(col),w);
    };
    const rect = (xx: number, yy: number, w: number, h: number, col: string) => {
        if(riderBase!==null||skull){poly([[xx,yy],[xx+w,yy],[xx+w,yy+h],[xx,yy+h]],col);return;}
        box(c,x+(d>0?xx:-xx-w)*profile,y+yy,w*profile,h,tint(col));
    };
    const ell = (xx: number, yy: number, w: number, h: number, col: string) => {
        const a=riderPoint(xx,yy),b=riderPoint(xx,yy+h);oval(c,x+(d>0?a[0]:-a[0]-w)*profile,y+a[1],w*profile,b[1]-a[1],tint(col));
    };
    const body = -43 + bow * 13 + bob + pose.compression, neck = -59 + bow * 25 + bob + pose.neckDrop + pose.compression;
    const bone = (a:Point,b:Point,ra:number,rb:number,color:string) => {
        const length=Math.max(.01,Math.hypot(b[0]-a[0],b[1]-a[1])),nx=(b[1]-a[1])/length,ny=(a[0]-b[0])/length;
        poly([[a[0]+nx*ra,a[1]+ny*ra],[b[0]+nx*rb,b[1]+ny*rb],[b[0]-nx*rb,b[1]-ny*rb],[a[0]-nx*ra,a[1]-ny*ra]],color);
    };
    const forelimb=(rear:boolean)=>{
        const g=pose.chaseGesture!;
        const swing=g.armSwing*(rear?-1:1),upper=1.04+swing+g.armFold*.45,lower=-.24+swing*.3-g.armFold*.85;
        const shoulder:Point=[rear?23:27,body+(rear?4:-2)];
        const elbow:Point=[shoulder[0]+Math.cos(upper)*10,shoulder[1]+Math.sin(upper)*10];
        const wrist:Point=[elbow[0]+Math.cos(lower)*10,elbow[1]+Math.sin(lower)*10];
        bone(shoulder,elbow,3,2.5,P.ink);bone(elbow,wrist,2.5,1.7,P.ink);
        bone(shoulder,elbow,1.7,1.3,rear?P.shade:P.light);bone(elbow,wrist,1.5,.8,rear?P.shade:P.hide);
        ell(elbow[0]-1,elbow[1]-1,3,3,rear?P.deep:P.scute);
        for(let claw=0;claw<2;claw++){
            const curl=lower+.9+claw*.3+g.armFold*.3,ox=wrist[0]-claw*2,oy=wrist[1]+claw;
            line(ox,oy,ox+Math.cos(curl)*4,oy+Math.sin(curl)*4,P.ink,2);
            line(ox,oy,ox+Math.cos(curl)*3,oy+Math.sin(curl)*3,rear?P.light:P.ivory);
        }
    };
    const leg = (rear:boolean) => {
        const {hip,knee,hock,foot}=dinosaurLeg(body,pose.gait,rear,(1-bow)*pose.stride,pose.tuck,pose.brace,pose.feet?.[rear?0:1]);
        const shade=rear?P.deep:P.shade,hide=rear?P.shade:P.hide;
        bone(hip,knee,10,7,P.ink);bone(knee,hock,7,4,P.ink);
        ell(knee[0]-7,knee[1]-7,14,14,P.ink);
        bone(hip,knee,8,5,hide);bone(knee,hock,5,2,hide);
        ell(hip[0]-9,hip[1]-9,18,18,hide);ell(knee[0]-5,knee[1]-5,10,10,hide);
        bone([hip[0]-4,hip[1]+1],[knee[0]-1,knee[1]+2],4,3,shade);
        if(!rear){
            bone([hip[0]+2,hip[1]-3],[knee[0]+1,knee[1]-2],4,2,P.light);
            line(knee[0]+1,knee[1]+1,hock[0]+1,hock[1]-1,P.light,2);
            line(knee[0]-3,knee[1]+3,knee[0]+2,knee[1]+3,P.shade);
            for(let i=1;i<4;i++){
                const t=i/4;
                line(knee[0]+(hock[0]-knee[0])*t-2,knee[1]+(hock[1]-knee[1])*t,
                    knee[0]+(hock[0]-knee[0])*t+1,knee[1]+(hock[1]-knee[1])*t+1,P.shade);
            }
        }
        const [fx,fy]=foot;
        poly([[hock[0]-4,hock[1]-2],[hock[0]+3,hock[1]-2],[fx+4,fy-6],[fx+13,fy-4],[fx+15,fy-1],[fx-13,fy-1],[fx-14,fy-5]],P.ink);
        poly([[hock[0]-2,hock[1]],[hock[0]+2,hock[1]],[fx+4,fy-4],[fx+10,fy-3],[fx-11,fy-3]],hide);
        for(let i=0;i<3;i++){
            const toe=fx-2+i*5;
            line(toe-4,fy-5,toe,fy-4,shade);
            poly([[toe,fy-5],[toe+3,fy-4],[toe+4,fy-2],[toe,fy-2]],rear?P.light:P.ivory);
        }
    };
    const [root, bend, tip] = dinosaurTail(body-bob,pose.tail);
    // The same tapered distal section supplies the collision samples.
    poly([[root[0]+4,root[1]-12],[bend[0],bend[1]-7],[tip[0]-3,tip[1]-2],[tip[0],tip[1]+4],[bend[0],bend[1]+6],[root[0]+6,root[1]+9]],P.ink);
    poly([[root[0]+2,root[1]-8],[bend[0],bend[1]-4],[tip[0]+1,tip[1]],[bend[0],bend[1]+3],[root[0]+4,root[1]+5]],P.hide);
    line(root[0],root[1]-6,bend[0],bend[1]-3,P.light,2);line(bend[0],bend[1]-3,tip[0]+4,tip[1],P.light);
    for(let i=0;i<5;i++){
        const t=i/5,tx=bend[0]+(tip[0]-bend[0])*t,ty=bend[1]+(tip[1]-bend[1])*t;
        line(tx,ty-3,tx+3,ty+2-i*.4,P.scute,2);rect(tx-1,ty-3,2,1,P.light);
    }
    leg(true);
    if(pose.chaseGesture)forelimb(true);
    ell(-31,body-13,65,42,P.ink); ell(-28,body-11,59,37,pose.flash ? P.cream : P.hide);
    ell(-21,body-9,45,19,P.light); ell(-22,body+5,49,19,P.shade);
    poly([[-26,body-1],[-20,body-8],[-9,body-10],[-5,body-6],[-14,body-2],[-19,body+8],[-25,body+11]],'#a7966c');
    poly([[-17,body+18],[-9,body+10],[8,body+9],[19,body+4],[25,body+8],[17,body+18],[4,body+22]],'#716b4f');
    poly([[1,body+5],[19,body-10],[29,neck-7],[45,neck-7],[47,neck+17],[25,body+19],[12,body+23]],P.ink);
    poly([[5,body+5],[22,body-10],[30,neck-4],[41,neck-3],[42,neck+14],[23,body+16],[12,body+19]],P.hide);
    poly([[22,body+10],[33,neck+7],[40,neck+9],[38,neck+18],[23,body+18],[12,body+19]],P.cream);
    if((pose.swallow??0)>.02){
        const u=pose.swallow!,swell=Math.sin(Math.PI*u)*5.5;
        const bx=39-19*u,by=neck+17+(body+18-(neck+17))*u;
        poly([[bx-6,by-2],[bx+6,by-3],[bx+4,by+swell+2],[bx-4,by+swell+1]],P.ink);
        poly([[bx-5,by-2],[bx+5,by-2],[bx+3,by+swell],[bx-3,by+swell]],P.cream);
        line(bx-3,by+swell-1,bx+2,by+swell-1,P.light);
    }
    // Broad dorsal scutes and small flank clusters follow the rib cage.
    // Their coordinates belong to the body, so the texture cannot crawl while walking.
    for(const [xx,yy,w,h] of [[-23,-7,8,5],[-12,-10,9,5],[1,-10,8,5],[14,-7,7,5],[-19,1,6,4],[-8,-1,6,4],[4,0,6,4],[16,2,5,4],[-18,9,4,3],[-6,7,5,3],[7,8,4,3]]){
        poly([[xx,body+yy+1],[xx+2,body+yy],[xx+w-1,body+yy+1],[xx+w,body+yy+h-1],[xx+2,body+yy+h]],yy<0?P.scute:P.hide);
        line(xx+2,body+yy,xx+w-2,body+yy,yy<0?P.light:P.cream);
        rect(xx+w-2,body+yy+h-1,2,1,P.shade);
    }
    for(let i=0;i<3;i++){
        line(19+i*4,body+2-i*5,24+i*4,body+3-i*5,P.shade);
        line(25+i*4,neck+11+i*3,33+i*2,neck+13+i*3,P.light);
    }
    // Hinged lower jaw, teeth and palate. The eye keeps a readable 1px pupil.
    skull=(pose.headPitch??0)!==0;
    const jaw = pose.jawHinge===undefined?pose.jaw*13:0;
    const lowerJaw=(xx:number,yy:number):Point=>dinosaurJawPoint([xx,yy],neck,pose.jawHinge??0);
    poly([[26,neck-11],[47,neck-16],[66,neck-10],[70,neck+3],[61,neck+9],[30,neck+8]],P.ink);
    poly([[29,neck-9],[48,neck-13],[64,neck-8],[66,neck+2],[59,neck+5],[31,neck+5]],P.hide);
    poly([[31,neck-8],[48,neck-11],[62,neck-7],[57,neck-5],[38,neck-4]],P.light);
    poly([[31,neck-2],[39,neck-5],[44,neck-2],[42,neck+4],[36,neck+6],[31,neck+3]],P.shade);
    poly([[33,neck-1],[38,neck-3],[40,neck],[38,neck+3],[34,neck+3]],P.scute);
    line(43,neck+3,59,neck+2,P.light);line(32,neck-7,40,neck-9,P.cream);
    for(const [sx,sy] of [[43,-10],[57,-7],[60,-2],[45,0],[33,4]]){rect(sx,neck+sy,3,1,P.shade);rect(sx,neck+sy-1,2,1,P.light);}
    poly([[30,neck+6],[65,neck+5],lowerJaw(61,neck+17+jaw),lowerJaw(37,neck+15+jaw),[27,neck+10]],P.ink);
    poly([[32,neck+8],[62,neck+7],lowerJaw(59,neck+12+jaw),lowerJaw(38,neck+11+jaw)],P.mouth);
    poly([lowerJaw(36,neck+11+jaw*.4),lowerJaw(55,neck+11+jaw*.7),lowerJaw(59,neck+13+jaw),lowerJaw(39,neck+12+jaw)],P.tongue);
    poly([[29,neck+10],lowerJaw(37,neck+12+jaw),lowerJaw(60,neck+14+jaw),lowerJaw(59,neck+16+jaw),lowerJaw(37,neck+14+jaw)],P.hide);
    line(...lowerJaw(37,neck+14+jaw),...lowerJaw(57,neck+15+jaw),P.cream);
    line(32,neck+7,63,neck+6,P.rust);
    const mouth=dinosaurMouthPoint(neck,pose.jaw,pose.headPitch,pose.jawHinge);
    if(pose.heldDebris)drawDebrisPiece(c,x+d*mouth[0],y+mouth[1],pose.heldDebris,1/AFTERMATH_SCALE);
    if(pose.carriedBystander)drawCarriedBystander(c,pose.carriedBystander,
        x+d*mouth[0],y+mouth[1],1/AFTERMATH_SCALE);
    for(const [tx,length] of [[36,3],[41,5],[47,4],[53,5],[59,3]]){
        poly([[tx,neck+6],[tx+3,neck+6],[tx+1,neck+6+length]],P.ivory);
        if((pose.gore??0)>.2)poly([[tx,neck+6+length-2],[tx+2,neck+6+length-2],[tx+1,neck+6+length]],'#9e3237');
        if(jaw>3||(pose.jawHinge??0)>.09){
            poly([lowerJaw(tx+1,neck+13+jaw),lowerJaw(tx+3,neck+13+jaw),lowerJaw(tx+2,neck+10+jaw)],P.light);
            if((pose.gore??0)>.2)rect(tx+1,neck+10+jaw,2,2,'#8f292f');
        }
    }
    if((pose.gore??0)>.2){
        line(36,neck+14+jaw,58,neck+15+jaw,'#7a2228',2);
        line(40,neck+7,61,neck+6,'#9e3237');
        if((pose.gore??0)>.8&&jaw>4){
            line(42,neck+9,43,neck+11+jaw,'#9e3237');
            line(54,neck+9,53,neck+11+jaw,'#7a2228');
        }
    }
    rect(47,neck-7,7,4,P.ink);rect(49,neck-6,4,2,P.brass);rect(51,neck-6,1,2,P.ink);
    rect(49,neck-6,1,1,P.ivory);
    if(pose.defeated||(pose.eyeClose??0)>.5){rect(47,neck-7,7,4,P.hide);line(48,neck-5,53,neck-5,P.ink);}
    line(44,neck-10,49,neck-9,P.scute,2);line(49,neck-9,55,neck-8+(pose.focus??0),P.shade,2);
    rect(62,neck-4,3,2,P.ink);rect(61,neck-5,3,1,P.light);
    skull=false;
    if(pose.chaseGesture)forelimb(false);
    else{
        line(27,body-2,32,body+8,P.ink,5);line(29,body-2,33,body+7,P.light,2);
        line(33,body+7,42,body+5,P.hide,3);line(40,body+5,44,body+9,P.ivory);
    }
    leg(false);
    // Leather girth, riveted saddle and the breakable brass fasteners.
    const saddle = -64 + bow*39 + pose.compression;
    line(-11,body-10,-6,body+23,P.ink,5);line(-9,body-9,-5,body+21,P.rust,2);
    poly([[-24,saddle+4],[-15,saddle-2],[13,saddle-2],[20,saddle+8],[9,saddle+14],[-17,saddle+11]],P.ink);
    poly([[-20,saddle+5],[-13,saddle+1],[11,saddle+1],[15,saddle+8],[7,saddle+10],[-15,saddle+8]],P.rust);
    line(-17,saddle+3,11,saddle+3,P.brass,2);
    poly([[-20,saddle+5],[-16,saddle+8],[7,saddle+10],[13,saddle+8],[7,saddle+12],[-17,saddle+10]],P.leather);
    for(let i=0;i<6;i++)rect(-14+i*4,saddle+2,2,1,P.stitch);
    line(-9,body+2,-6,body+19,P.leather,2);rect(-9,body+13,5,5,P.brass);rect(-8,body+14,3,3,P.leather);
    for(let plate=0;plate<3;plate++){
        const xx=-16+plate*9,remaining=Math.max(0,Math.min(3,pose.armor-plate*3));
        rect(xx,saddle+5,8,6,P.ink);rect(xx+1,saddle+6,6,3,remaining?P.rust:P.shade);
        for(let stud=0;stud<remaining;stud++){rect(xx+1+stud*2,saddle+6,1,2,P.brass);rect(xx+1+stud*2,saddle+6,1,1,P.ivory);}
        if(!remaining)line(xx+2,saddle+6,xx+5,saddle+9,P.ink);
    }
    const bridle=headPoint([28,neck+9]),buckle=headPoint([48,neck+13]);
    line(12,saddle+3,...bridle,P.ink,2);line(...bridle,...buckle,P.rust,2);
    skull=(pose.headPitch??0)!==0;
    rect(44,neck+10,4,5,P.brass);rect(45,neck+11,2,2,P.ink);
    skull=false;
    if(pose.armor<=6){line(-17,saddle+10,-22-pose.cloth*.4,saddle+17,P.rust,2);line(-22-pose.cloth*.4,saddle+17,-20,saddle+19,P.brass);}
    if(pose.armor<=3){line(12,saddle+10,17+pose.cloth*.3,saddle+15,P.rust,2);rect(15,saddle+15,2,2,P.brass);}
    // Riding boots follow the saddle; jacket tails lag behind the stride.
    if(pose.launcher&&pose.launcher.draw<.35)drawLauncher({poly,line},pose,pose.launcher);
    poly([[-10,saddle-4],[7,saddle-5],[11,saddle+13],[5,saddle+18],[12,saddle+20],[11,saddle+24],[1,saddle+23],[-2,saddle+9],[-15,saddle+4]],P.ink);
    line(-7,saddle-2,3,saddle+9,P.suit,7);line(3,saddle+9,4,saddle+19,P.lapel,3);
    line(-8,saddle-2,1,saddle+5,P.clothShade,3);line(4,saddle+8,5,saddle+13,P.clothShade,2);
    rect(2,saddle+14,6,3,P.leather);rect(3,saddle+14,3,1,P.stitch);
    line(3,saddle+19,8,saddle+21,P.lapel);line(1,saddle+24,11,saddle+24,P.brass);
    line(10,saddle+11,13,saddle+23,P.leather);line(1,saddle+24,0,saddle+20,P.leather);
    const rider = saddle + (pose.riderDrop??pose.tuck*18), r = pose.recoil - pose.tuck * 10;
    riderBase=rider;
    poly([[-15-r,rider-23],[-5-r,rider-28],[10-r,rider-23],[14-r,rider-7],[7-r,rider+1],[-13-r,rider-2],[-23-r-pose.cloth,rider+5+Math.sin(pose.gait)*2-pose.cloth*.4]],P.ink);
    poly([[-17-r,rider-14],[-14-r,rider-3],[-20-r-pose.cloth,rider+1-pose.cloth*.4]],P.lapel);
    poly([[-14-r,rider-22],[-4-r,rider-26],[8-r,rider-21],[10-r,rider-8],[5-r,rider-3],[-13-r,rider-5]],P.suit);
    poly([[-14-r,rider-20],[-9-r,rider-22],[-8-r,rider-9],[-13-r,rider-5]],P.clothShade);
    poly([[-6-r,rider-26],[-3-r,rider-23],[-7-r,rider-18],[-4-r,rider-14],[-10-r,rider-18]],P.lapel);
    poly([[5-r,rider-24],[9-r,rider-21],[7-r,rider-16],[4-r,rider-12],[6-r,rider-20]],P.lapel);
    poly([[-3-r,rider-25],[5-r,rider-23],[3-r,rider-12],[-6-r,rider-21]],P.ivory);
    line(-13-r,rider-22,5-r,rider-4,'#367f60',5);line(-11-r,rider-22,5-r,rider-6,'#6fb17a',2);line(-12-r,rider-23,6-r,rider-5,P.brass);
    poly([[5-r,rider-6],[9-r,rider-5],[12-r-pose.cloth*.5,rider+5],[8-r-pose.cloth,rider+2]],'#367f60');
    line(9-r,rider-4,12-r-pose.cloth*.5,rider+4,P.brass);
    line(-11-r,rider-10,-7-r,rider-9,P.lapel);rect(7-r,rider-11,1,1,P.brass);
    line(8-r,rider-20,9-r,rider-10,P.lapel);rect(4-r,rider-7,2,2,P.brass);
    if(pose.armor<=6){line(-14-r,rider-10,-10-r,rider-8,P.lapel);rect(-12-r,rider-9,2,1,P.ink);}
    // The head absorbs less recoil than the shoulder; jaw, cheek and ear remain distinct.
    const hr=pose.recoil*.45-pose.tuck*10,faceY=rider+pose.recoil*.22,focus=pose.focus??0;
    const look=pose.lookBack??0;
    // Three authored head views retain their volume at pixel scale. The rifle and hands
    // stay on their existing anchors while the rider checks the refuge over his shoulder.
    headFacing=look>.82?-1:1;
    if(look>.18&&look<=.82){
        const turn=(look-.5)*-3;
        poly([[-10,faceY-38],[-5,faceY-42],[5,faceY-41],[10,faceY-36],[10,faceY-27],[6,faceY-22],[0,faceY-20],[-7,faceY-23],[-11,faceY-30]],P.ink);
        poly([[-8,faceY-36],[4,faceY-38],[8,faceY-34],[8,faceY-27],[4,faceY-23],[0,faceY-22],[-6,faceY-25],[-8,faceY-30]],P.face);
        poly([[-8,faceY-33],[-4,faceY-29],[-4,faceY-25],[0,faceY-22],[-6,faceY-25],[-8,faceY-29]],P.skin);
        poly([[-10,faceY-35],[-9,faceY-40],[-4,faceY-42],[5,faceY-41],[9,faceY-37],[7,faceY-35],[2,faceY-38],[-3,faceY-36],[-7,faceY-35]],P.hair);
        line(-7,faceY-39,-1,faceY-40,'#81766c');line(-4,faceY-37,4,faceY-39,'#62565a');
        for(const d of [-1,1]){
            line(d*7+turn,faceY-34,d*2+turn,faceY-33,P.hair,2);
            rect(d>0?2+turn:-6+turn,faceY-32,4,2,P.ivory);
            rect(d>0?3+turn:-5+turn,faceY-32,2,2,P.ink);
        }
        line(turn,faceY-32,turn-1,faceY-28,P.skinLight);rect(turn,faceY-30,2,3,P.skin);
        line(-3,faceY-26,4,faceY-26,P.hair);line(-2,faceY-23,3,faceY-23,P.skinLight);
        rect(-10,faceY-32,2,4,P.skin);rect(8,faceY-32,2,4,P.skin);
    }else{
    poly([[-10-hr,faceY-39],[1-hr,faceY-42],[8-hr,faceY-36],[9-hr,faceY-31],[11-hr,faceY-29],[9-hr,faceY-26],[8-hr,faceY-22],[3-hr,faceY-20],[-6-hr,faceY-23],[-11-hr,faceY-31]],P.ink);
    poly([[-8-hr,faceY-36],[2-hr,faceY-39],[6-hr,faceY-34],[7-hr,faceY-30],[9-hr,faceY-29],[7-hr,faceY-27],[6-hr,faceY-23],[2-hr,faceY-22],[-4-hr,faceY-25],[-8-hr,faceY-31]],P.face);
    poly([[-8-hr,faceY-31],[-4-hr,faceY-29],[-2-hr,faceY-26],[5-hr,faceY-26],[6-hr,faceY-23],[2-hr,faceY-22],[-5-hr,faceY-25]],P.skin);
    line(-3-hr,faceY-24,2-hr,faceY-22,P.skinLight);rect(1-hr,faceY-24,4,1,P.face);
    poly([[-10-hr,faceY-35],[-9-hr,faceY-40],[2-hr,faceY-42],[7-hr,faceY-38],[5-hr,faceY-35],[1-hr,faceY-37],[-4-hr,faceY-36],[-7-hr,faceY-32]],P.hair);
    line(-8-hr,faceY-38,-3-hr,faceY-40,'#81766c');line(-5-hr,faceY-37,1-hr,faceY-39,'#62565a');
    rect(-8-hr,faceY-32,3,5,P.skin);rect(-7-hr,faceY-31,1,2,P.skinLight);
    line(-1-hr,faceY-34,5-hr,faceY-34+focus,P.hair,2);
    rect(2-hr,faceY-32,4,2,P.ivory);rect(4-hr,faceY-32,2,2,P.ink);
    poly([[-2-hr,faceY-30],[2-hr,faceY-30],[4-hr,faceY-28],[0-hr,faceY-28]],P.skinLight);
    line(6-hr,faceY-30,7-hr,faceY-28,P.skin);
    line(0-hr,faceY-26,5-hr,faceY-26,P.hair);
    if((pose.voice??0)>.2){rect(1-hr,faceY-26,5,2+(pose.voice??0)*2,P.mouth);rect(2-hr,faceY-26,3,1,P.ivory);}
    if(pose.blink){rect(1-hr,faceY-33,6,3,P.face);line(2-hr,faceY-31,6-hr,faceY-31,P.hair);}
    if(pose.defeated){line(0-hr,faceY-33,4-hr,faceY-30,P.ink);line(0-hr,faceY-30,4-hr,faceY-33,P.ink);}
    }
    headFacing=1;riderBase=null;
    // Rifle and both hands use one angle, so muzzle flash aligns with the bullet.
    const lean=pose.riderLean??0,lower=pose.launcher?.rifleLower??0;
    const gx=(7-r+riderBend(14,lean))*(1-lower)-14*lower,gy=rider-14+lower*19,a=pose.aim*(1-lower)+lower*1.24;
    const gp=(xx:number,yy:number):Point=>[gx+Math.cos(a)*xx-Math.sin(a)*yy,gy+Math.sin(a)*xx+Math.cos(a)*yy];
    poly([gp(-2,-3),gp(22,-3),gp(22,-1),gp(31,-1),gp(31,2),gp(20,2),gp(19,5),gp(8,5),gp(6,2),gp(-2,4)],P.ink);
    poly([gp(3,-2),gp(21,-2),gp(21,1),gp(4,1)],P.lapel);
    line(...gp(-3,-3),...gp(-3,4),P.clothShade,2);
    line(...gp(4,2),...gp(17,2),P.shade);
    line(...gp(26,-2),...gp(26,-4),P.ink);line(...gp(26,-4),...gp(28,-4),P.lapel);
    for(let vent=0;vent<3;vent++)line(...gp(19+vent*3,-1),...gp(19+vent*3,1),pose.heat>.55?P.hot:P.shade);
    line(...gp(25,-1),...gp(30,-1),pose.heat>.8?P.cream:pose.heat>.45?P.brass:P.lapel);
    line(...gp(6,-1),...gp(12,-1),P.ink,2);
    line(...gp(10-pose.recoil*.6,-1),...gp(12-pose.recoil*.6,-1),pose.recoil>2?P.brass:P.ivory);
    const magazine=pose.reload*11;
    poly([gp(10,3+magazine),gp(17,3+magazine),gp(16,11+magazine),gp(11,10+magazine)],P.ink);
    line(...gp(12,5+magazine),...gp(12,9+magazine),P.lapel);line(...gp(14,5+magazine),...gp(14,9+magazine),P.shade);
    line(...gp(7,-4),...gp(16,-4),P.brass);line(...gp(3,-1),...gp(6,-1),P.ivory);
    if(pose.launcher&&lower>.001){
        line(-9,rider-23,...gp(4,0),P.leather,2);
        if(pose.launcher.draw>=.35)drawLauncher({poly,line},pose,pose.launcher);
        drawLauncherHands({poly,line},pose,pose.launcher,gp);
    }else{
    line(-8-r+riderBend(20,lean),rider-20,1-r+riderBend(9,lean),rider-9,P.suit,6);line(1-r+riderBend(9,lean),rider-9,...gp(8,4),P.skin,4);
    const grip=gp(18-pose.reload*6,3+pose.reload*9),rein=pose.rein??0;
    const hand:Point=[grip[0]*(1-rein)+(14-r)*rein,grip[1]*(1-rein)+(rider-2)*rein];
    const elbow:Point=[16-r-rein*8+riderBend(12,lean),rider-12+pose.reload*5];
    if(rein>.05){
        const loop=headPoint([28,neck+4]),g=pose.chaseGesture;
        // Slack belongs to the cord between the actual grip and bridle. It
        // tightens during anticipation, then relaxes as the rider recovers.
        if(g){
            const points:Point[]=Array.from({length:7},(_,i)=>{
                const t=i/6,s=Math.sin(t*Math.PI);
                return[hand[0]+(loop[0]-hand[0])*t+g.reinFlutter*s,hand[1]+(loop[1]-hand[1])*t+g.reinSag*s];
            });
            for(let i=1;i<points.length;i++)line(...points[i-1],...points[i],P.ink,2);
            for(let i=1;i<points.length;i++)line(...points[i-1],...points[i],P.rust);
        }else{line(...hand,...loop,P.ink,2);line(...hand,...loop,P.rust);}
        line(...loop,...buckle,P.rust);
    }
    line(6-r+riderBend(20,lean),rider-20,...elbow,P.suit,5);line(...elbow,...hand,P.suit,4);ell(hand[0]-1,hand[1]-2,5,4,P.face);
    line(...gp(6,4),...gp(7,6),P.face,2);
    }
    if(pose.defeated)for(let i=0;i<3;i++){
        const a=pose.daze+i*Math.PI*2/3,sx=Math.cos(a)*18,sy=rider-44+Math.sin(a)*4;
        rect(sx-2,sy,5,1,P.brass);rect(sx,sy-2,1,5,P.ivory);
    }
}

export function dinosaurPose(b: HypotheticalModel, cx: number, cy: number, reduced = false): DinosaurPose {
    const m=hypotheticalMotion(b);
    const pursuit=b.act==='chase'?chasePerformance(b,reduced):null;
    const activeTail=b.attack==='tail'&&['tell','attack'].includes(b.state);
    const focus=Math.max(b.state==='tell'?smoothMotion(b.age/b.warningTicks):b.state==='attack'?1:0,pursuit?.prepare??0);
    return { x: b.x-cx, y:b.y-cy, facing:b.visualFacing, pivot:b.pivot, gait:b.travel/11,
        ...m, breath:reduced||pursuit?0:Math.sin(b.tick/13)*.6, bow:b.bow,
        tail:reduced||activeTail||pursuit?m.tail:m.tail+(1-b.bow)*(Math.sin(b.tick/22)*.025-m.tuck*.08),
        headPitch:pursuit?.headPitch,jawHinge:pursuit?Math.min(.4,pursuit.jawHinge+m.jaw*.32):undefined,
        aim:b.weaponAngle,
        armor:b.health,heat:b.heat,cloth:reduced?0:Math.min(5,Math.abs(b.motionSpeed)*.7)+Math.sin(b.travel/11-.8)*m.stride*.9+Math.sin(b.tick/9)*.25+(pursuit?.cloth??0),
        chaseGesture:pursuit?.gesture,
        focus,eyeClose:(pursuit?.hit??0)>.9||!reduced&&b.state==='rest'&&b.tick%137<4?1:0,
        voice:b.state==='roar'?Math.max(0,Math.sin(b.age/9))*(1-smoothMotion((b.age-75)/30)):0,
        blink:(pursuit?.hit??0)>.92||b.state==='rest'&&b.tick%160<4,daze:reduced?0:b.age/14,
        flash:b.state==='hurt'&&b.age<12, defeated:b.won };
}

export function distantRiderPose(action:HypotheticalBackdrop,reduced=false):DinosaurPose {
    const m=action.motion,r=BACKDROP_RIG;
    if(action.aftermath.active){
        const pose=action.aftermath.pose(reduced),s=action.aftermath.tower.search,f=action.aftermath.yard?.forage;
        const carried=s.carried??(action.aftermath.phase==='forage'?f?.carried:undefined);
        const gore=Math.max(s.age>=242?(s.active?1:.85):0,f?.goreLevel??0);
        return {
            x:r.x,y:r.y+pose.lift/r.scale,...pose,
            daze:0,armor:9,flash:false,defeated:false,distant:true,heldDebris:action.aftermath.heldDebris,
            launcher:action.aftermath.district===3?action.aftermath.launcherPose:
                {draw:0,rifleLower:0,reach:0,aim:-.12,recoil:0,fired:action.helicopter.launchAt>=0},
            carriedBystander:carried,gore,
        };
    }
    const pose:DinosaurPose={x:r.x,y:r.y+m.lift/r.scale,facing:1,gait:action.travel/(r.scale*11),stride:action.stride,
        breath:0,bow:0,jaw:m.jaw,neckDrop:m.neckDrop,recoil:action.recoil,aim:action.angle,tail:m.tail,
        compression:m.compression,tuck:m.tuck,reload:0,brace:m.brace,heat:action.heat,
        cloth:reduced?0:Math.min(4,Math.abs(action.velocity)*1.8)+m.force*1.5,
        riderDrop:m.riderDrop,riderLean:m.riderLean,rein:m.rein,lookBack:m.lookBack,
        launcher:{draw:0,rifleLower:0,reach:0,aim:-.12,recoil:0,fired:m.district===3?action.aftermath.tower.destroyed:action.helicopter.launchAt>=0},
        blink:false,daze:0,armor:9,flash:false,defeated:false,distant:true,focus:m.force||action.muzzle?1:0,
        gore:m.district===0&&action.tick>=63?(action.tick<110?1:.75):0,
        voice:m.district===0&&action.tick>=63&&action.tick<90?.7:m.local>=m.impactTick&&m.local<m.impactTick+16?.65*(1-smoothMotion((m.local-m.impactTick-5)/11)):0};
    if(action.helicopter.active)return {...pose,...action.helicopter.body,stride:0,recoil:0,heat:0,
        cloth:reduced?0:.5+Math.sin(action.helicopter.age/19)*.35,launcher:action.helicopter.launcher};
    return pose;
}
const backgroundRigs=new WeakMap<CanvasRenderingContext2D,{canvas:HTMLCanvasElement;c:CanvasRenderingContext2D}>();
function drawDistantRider(c:CanvasRenderingContext2D,b:HypotheticalModel,base:number,reduced:boolean){
    const action=b.backdrop,r=BACKDROP_RIG;
    let rig=backgroundRigs.get(c);
    if(!rig){const canvas=document.createElement('canvas');canvas.width=r.width;canvas.height=r.height;rig={canvas,c:canvas.getContext('2d')!};backgroundRigs.set(c,rig);}
    rig.c.clearRect(0,0,r.width,r.height);
    const pose=distantRiderPose(action,reduced);
    drawHypotheticalDinosaur(rig.c,pose);
    // The projection stays on the street when the body lifts. It broadens and
    // softens in value, while still preserving every underlying paving mark.
    const height=Math.max(0,(r.y-pose.y)*r.scale),spread=Math.min(10,height*.22);
    drawScenicShadow(c,action.displayX-31-spread/2,base-2,64+spread,4,.26*(1-Math.min(.65,height/70)));
    if(!reduced&&!action.aftermath.active)for(const p of action.footfalls){
        const t=(action.tick-p.born)/28;
        for(let i=0;i<3;i++)box(c,p.x-5+i*4-t*(i+1),base-2-t*3-i%2,3,1,'#b5ad95');
    }
    const smoothing=c.imageSmoothingEnabled;c.imageSmoothingEnabled=false;
    c.drawImage(rig.canvas,0,0,r.width,r.height,Math.round(b.backgroundX-r.x*r.scale),Math.round(base-r.y*r.scale),r.width*r.scale,r.height*r.scale);
    c.imageSmoothingEnabled=smoothing;
    if(action.aftermath.active){
        const a=action.aftermath;
        if(a.muzzle>0){const m=a.barrel;drawGunMuzzle(c,m.x,base+m.y,m.dx,m.dy,a.muzzle,reduced,true);}
        for(const shell of a.casings)drawGunCasing(c,shell.x,base+shell.y,shell.direction,a.tick-shell.born,base,reduced,r.scale);
    }else{
        if(action.muzzle>0){const m=action.barrel;drawGunMuzzle(c,m.x,base+m.y,Math.cos(action.angle),Math.sin(action.angle),action.muzzle,reduced,true);}
        for(const shell of action.casings)drawGunCasing(c,shell.x,base+shell.y,1,action.tick-shell.born,base,reduced,r.scale);
    }
}

export function drawHypotheticalBackground(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    drawHypotheticalScenery(c,b,cx,cy,reduced);
    if(b.act==='siege'){
        const base=backdropBaseline(cy);
        c.save();c.translate(-Math.round(cx),0);
        // Rear street: physical scenery retains its depth in flight and at rest.
        drawHelicopterRear(c,b.backdrop.helicopter,base,reduced);
        drawHypotheticalRubble(c,b,base);
        drawTowerDebris(c,b.backdrop.aftermath.tower,base,reduced);
        drawBystanderGround(c,b.backdrop,base,reduced);
        drawOpeningStreet(c,b.backdrop.tick,base,reduced);
        drawBystanders(c,b.backdrop,base,reduced,true,undefined,b.backdrop.tick,'actors');
        drawAftermathYards(c,b.backdrop,base,cx,reduced);
        drawTowerSearchActors(c,b.backdrop,base,reduced);
        // Characters occlude the rear street; ground decals never paint over them.
        drawDistantRider(c,b,base,reduced);
        drawBystanders(c,b.backdrop,base,reduced,false,undefined,b.backdrop.tick,'actors');
        // Transient contact effects can cross silhouettes; settled solids cannot.
        drawBystanderEffects(c,b.backdrop,base,reduced);
        drawOpeningAftermath(c,b.backdrop.tick,base,reduced);
        drawHypotheticalDestruction(c,b,base,cy,reduced);
        drawAftermathEffects(c,b.backdrop.aftermath,base,reduced);
        drawTowerEffects(c,b.backdrop.aftermath.tower,base,reduced);
        drawHelicopterEffects(c,b.backdrop.helicopter,base,reduced);
        drawTowerSearchDust(c,b.backdrop,base,reduced);
        c.restore();
    }
}

export function drawHypotheticalTerrain(c:CanvasRenderingContext2D,level:WorldLevel,b:HypotheticalModel,cx:number,cy:number){
    drawHypotheticalMasonry(c,level,b,cx,cy);
}

export function drawHypotheticalObjects(c:CanvasRenderingContext2D,o:WorldObjects,b:HypotheticalModel,cx:number,cy:number,reduced=false){
    drawHypotheticalFittings(c,o,b,cx,cy,reduced);
    // Live projectiles stay readable in front of decorative braces and stores.
    for(const barrel of o.barrels)drawHypotheticalCanister(c,barrel,cx,cy);
}
export function drawHypotheticalCombat(c:CanvasRenderingContext2D,b:HypotheticalModel,cx:number,cy:number,reduced:boolean){
    const floor=HYPOTHETICAL.floor-cy;
    if(b.act==='chase')drawChaseCollapse(c,b,cx,cy,reduced);
    for(const mark of b.marks){const x=mark.x-cx,remain=Math.max(0,1-(b.tick-mark.born)/60);box(c,x-15,floor-2,30,2,P.hot);pixelLine(c,x-6,floor-8,x,floor-3,P.hot);pixelLine(c,x,floor-3,x+6,floor-8,P.hot);box(c,x-15,floor-4,30*remain,1,P.ivory);}
    if(b.act!=='siege'){
        const airborne=b.state==='attack'&&b.attack==='leap'&&b.age<58;
        if(b.state==='tell'||b.state==='turn'||b.state==='reload'||airborne){
            if(b.attack==='rifle'){
                const from=b.aim,to={x:b.targetX,y:b.targetY},locked=b.age>=(b.state==='reload'?b.reloadTicks:b.warningTicks)-24;
                const length=Math.hypot(to.x-from.x,to.y-from.y);
                // Reloading lowers the weapon first; the locked sight appears after it returns to aim.
                if(b.pivotAge>=12&&b.age>=12&&(b.state!=='reload'||b.age>=24))for(let t=0;t<length;t+=locked?5:9){const f=t/length;box(c,from.x+(to.x-from.x)*f-cx,from.y+(to.y-from.y)*f-cy,2,1,locked?P.ivory:P.hot);}
                box(c,to.x-cx-7,to.y-cy-1,14,1,P.hot);box(c,to.x-cx,to.y-cy-6,1,12,P.hot);
                if(locked){box(c,to.x-cx-8,to.y-cy-6,3,1,P.ivory);box(c,to.x-cx+6,to.y-cy+5,3,1,P.ivory);}
            }else if(b.attack==='leap'){box(c,b.targetX-cx-30,floor-2,60,2,P.hot);pixelText(c,'!',b.targetX-cx,floor-11,P.ivory);}
            else if(b.attack==='charge'||b.state==='turn')for(let i=0;i<4;i++){
                const dir=b.state==='turn'?b.turnFacing:b.facing,x=b.x-cx+dir*(38+i*14);pixelLine(c,x-dir*4,floor-12,x,floor-8,P.hot);pixelLine(c,x,floor-8,x-dir*4,floor-4,P.hot);
            }
            else if(b.attack==='tail')box(c,b.tailBox.x-cx,floor-2,b.tailBox.width,2,P.hot);
            else if(b.attack==='bite'){
                const x=b.biteEndX+(b.facing<0?-68:26)-cx;
                pixelLine(c,x,floor-7,x,floor-2,P.hot);pixelLine(c,x,floor-2,x+42,floor-2,P.hot);
                pixelLine(c,x+42,floor-2,x+42,floor-7,P.hot);
                for(let i=0;i<4;i++)polygon(c,[[x+5+i*9,floor-2],[x+8+i*9,floor-6],[x+11+i*9,floor-2]],P.hot);
            }
        }
        // A fixed ground shadow locates the body during the jump; it never suggests a platform.
        oval(c,b.x-cx-26,floor-4,52,5,P.deep);
        if(b.attack==='tail'&&b.state==='attack'&&b.age>=12&&b.age<=32){
            const path=dinosaurTail(-43,hypotheticalMotion(b).tail);
            pixelLine(c,b.x+b.facing*path[1][0]-cx,b.y+path[1][1]-cy-5,b.x+b.facing*path[2][0]-cx,b.y+path[2][1]-cy-5,P.cream);
        }
        drawHypotheticalDinosaur(c,dinosaurPose(b,cx,cy,reduced));
        if(b.heat>.55&&!reduced&&!b.won&&b.pivotAge>=12){
            const a=b.weaponAngle,s=b.rifleShoulder;
            const x=s.x-cx+b.facing*28*Math.cos(a),y=s.y-cy+28*Math.sin(a);
            for(let i=0;i<2;i++){const t=(b.tick+i*13)%32,dx=Math.sin((t+i*5)/7)*2;box(c,x+dx,y-3-t*.35,1,2,'#c0b2a1');}
        }
        if(b.muzzle>0){
            const p=b.aim,a=b.rifleAngle;
            drawGunMuzzle(c,p.x-cx,p.y-cy,b.facing*Math.cos(a),Math.sin(a),b.muzzle,reduced);
        }
        if(b.vulnerable){const w=b.weakpoint,x=w.x-cx,y=w.y-cy;pixelLine(c,x-3,y+3,x-3,y-3,P.mint);pixelLine(c,x-3,y-3,x+4,y-3,P.mint);pixelLine(c,x+w.width+3,y+3,x+w.width+3,y-3,P.mint);pixelLine(c,x+w.width+3,y-3,x+w.width-4,y-3,P.mint);}
    }
    for(const s of b.shots){
        const x=s.x-cx,y=s.y-cy;
        if(s.kind==='bullet')drawGunTracer(c,s,-cx,-cy,reduced);
        else if(s.kind==='wave'&&b.act==='chase')drawChaseWave(c,s,cx,cy,reduced);
        else if(s.kind==='wave'){
            const dir=s.vx<0?-1:1,px=(v:number)=>x+(dir>0?v:15-v),roll=s.age%8;
            polygon(c,[[px(0),y+12],[px(3),y+7],[px(6),y+2],[px(10),y+1],[px(12),y+7],[px(15),y+12]],P.ink);
            polygon(c,[[px(2),y+11],[px(6),y+5],[px(9),y+3],[px(11),y+8],[px(13),y+11]],P.brass);
            pixelLine(c,px(7),y+3,px(10),y+2,P.ivory);
            box(c,px(2+roll),y+8-Math.sin(roll/8*Math.PI)*4,2,2,P.cream);
            box(c,px(-3),y+11,3,1,P.shade);box(c,px(-6),y+11,2,1,P.cream);
        }
        else {polygon(c,[[x-3,y],[x+3,y-3],[x+9,y+1],[x+8,y+7],[x+1,y+8]],P.ink);polygon(c,[[x-1,y],[x+3,y-1],[x+7,y+2],[x+2,y+5]],P.cream);}
    }
    for(const p of b.impacts)drawGunImpact(c,p,b.tick,-cx,-cy,reduced);
    for(const p of b.dust){
        const age=b.tick-p.born;
        if(p.kind==='step'&&b.act==='chase'){
            drawChaseFootfall(c,p.x,p.y-cy,age,cx,reduced);continue;
        }
        if(p.kind==='skid'){
            for(let i=0;i<(reduced?2:5);i++){
                const dx=-(p.direction??1)*(age*.9+i*4),dy=-Math.sin(age/40*Math.PI)*(2+i);
                box(c,p.x+dx-cx,p.y+dy-cy-2,age<18?5:3,2,i%2?P.shade:P.cream);
            }
            continue;
        }
        if(p.kind==='clasp'){
            for(let i=0;i<(reduced?1:3);i++){
                const dx=(i-1)*age*.65,dy=-age*(1.8+i*.25)+age*age*.065;
                if(p.y+dy>HYPOTHETICAL.floor-2)continue;
                const x=p.x+dx-cx,y=p.y+dy-cy;
                box(c,x,y,age%8<4?3:1,3,P.ink);box(c,x,y,1,2,P.brass);box(c,x,y,1,1,P.ivory);
            }
            continue;
        }
        if(p.kind==='shell'){
            drawGunCasing(c,p.x-cx,p.y-cy,p.direction??1,age,floor,reduced);
            continue;
        }
        if(p.kind==='stone'&&age<13){
            const spread=age*2.5;
            pixelLine(c,p.x-cx-spread,p.y-cy-1,p.x-cx-spread-5,p.y-cy-1,P.cream);
            pixelLine(c,p.x-cx+spread,p.y-cy-1,p.x-cx+spread+5,p.y-cy-1,P.cream);
        }
        for(let i=0;i<(reduced?2:5);i++){
            const sign=i%2?-1:1,dx=sign*(i+2)*age*.12,dy=-Math.sin(age/40*Math.PI)*(i+2);
            box(c,p.x+dx-cx,p.y+dy-cy-2,age<20?3:2,age<20?3:2,p.kind==='hit'?P.mint:'#c2b185');
        }
    }
}

