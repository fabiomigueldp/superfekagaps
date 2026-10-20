import type {CameraData,PlayerData} from '../../types';
import {box,oval,pixelLine,type Point} from '../WorldPainting';
import {clamp} from '../types';
import type {DinosaurPose} from './HypotheticalArt';
import type {ChaseContact,HypotheticalModel} from './HypotheticalModel';
import {dinosaurFootAnchor,dinosaurHeadPoint,dinosaurMouthPoint,smoothMotion} from './HypotheticalMotion';
import {drawCapturedHero,type CapturedHeroPose} from './HypotheticalCapturedHero';
import {CHASE_WATER_Y,chaseDeckSpans,chaseMaterialAt} from './HypotheticalChaseDetails';
import type {WeaponCue} from './HypotheticalAudio';
import {drawCaptureEffects} from './HypotheticalCaptureEffects';

export const CHASE_CAPTURE=Object.freeze({launch:65,entry:225,catch:390,clamp:445,hold:500,lift:740,swallow:850,gulp:1010,hidden:1150,breath:1240,settle:1360,fade:1410,black:1710,duration:1910});
const ramp=(time:number,start:number,end:number)=>smoothMotion((time-start)/(end-start));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
const pulse=(time:number,start:number,peak:number,end:number)=>ramp(time,start,peak)*(1-ramp(time,peak,end));
const track=(time:number,keys:readonly (readonly [number,number])[])=>{
    for(let i=1;i<keys.length;i++)if(time<keys[i][0])return mix(keys[i-1][1],keys[i][1],ramp(time,keys[i-1][0],keys[i][0]));
    return keys[keys.length-1][1];
};
/** Directed poses: reaching, closing the arms, then bracing against the jaw.
 * Do not restart a flailing loop during the held beat or the swallow. */
export function captureFrameAt(ms:number) {
    const keys=[[65,0],[125,1],[185,2],[245,3],[305,4],[365,5],[CHASE_CAPTURE.clamp,6],[610,7],[735,6],[810,7],[955,6]] as const;
    let frame=0;for(const [at,pose]of keys){if(ms<at)break;frame=pose;}return frame;
}
export type ChaseDefeatKind=ChaseContact['kind']|'fall';

/** Presentation only. Native damage has already decided the outcome, including
 * helmets and invulnerability. DeathTimer owns every pose, cue and transition. */
export class HypotheticalChaseDefeat {
    readonly score=CHASE_CAPTURE;
    readonly origin:Point;
    readonly facing:number;
    readonly camera:Point;
    readonly feet:readonly [Point,Point];
    readonly kind:ChaseDefeatKind;
    readonly cues:ReadonlyArray<{at:number;cue:WeaponCue}>;
    constructor(readonly initial:DinosaurPose,player:PlayerData,view:CameraData,readonly contact:ChaseContact|null,readonly tick:number) {
        const p=player.deathOrigin??player.position;
        this.origin=[p.x+player.width/2,p.y+player.height/2-1];
        this.facing=player.facingRight?1:-1;
        this.kind=player.deathKind==='fall'?'fall':contact?.kind??'shot';
        this.camera=[view.x,view.y];
        this.feet=[dinosaurFootAnchor(initial.gait,true,(1-initial.bow)*initial.stride,initial.tuck,initial.brace),
            dinosaurFootAnchor(initial.gait,false,(1-initial.bow)*initial.stride,initial.tuck,initial.brace)];
        this.cues=this.kind==='caught'?[{at:90,cue:'chase-scoop'},{at:CHASE_CAPTURE.clamp,cue:'chase-catch'},
            {at:CHASE_CAPTURE.gulp,cue:'chase-gulp'},{at:CHASE_CAPTURE.breath,cue:'chase-exhale'},
            ...([0,1] as const).filter(i=>this.feet[i][1]<-1&&this.footPlant(i).supported)
                .map(i=>({at:this.footPlant(i).at,cue:'chase-step' as const}))].sort((a,b)=>a.at-b.at):[];
    }
    get hint(){
        return this.kind==='caught'?'ALCANCADO! R: RETOMAR O TRECHO':this.kind==='fall'?'CAIU NO RIO! R: RETOMAR O TRECHO'
            :this.kind==='wave'?'ONDA BAIXA: SALTE POR CIMA. R: RETOMAR':'ATINGIDO! USE ALTURA E ABRIGO. R: RETOMAR';
    }
    scenery(model:HypotheticalModel,ms:number):HypotheticalModel {
        const tick=this.tick+Math.floor(ms/(1000/60));
        return Object.assign(Object.create(model),{tick,
            dust:model.dust.filter(p=>tick-p.born<(p.kind==='shell'?64:40)),
            impacts:model.impacts.filter(p=>tick-p.born<180),
            terraceDebris:model.terraceDebris.filter(p=>tick-p.born<80),
            bridgeDebris:model.bridgeDebris.filter(p=>tick-p.born<48)});
    }
    poseAt(ms:number,reduced=false):DinosaurPose {
        const a=this.initial,t=Math.max(0,ms),settle=ramp(t,65,330),brake=this.brakeAt(t);
        const captured=this.kind==='caught',reach=clamp(this.origin[1]-(a.y-39),-14,24);
        const score=CHASE_CAPTURE,open=captured?ramp(t,65,310):settle,close=captured?ramp(t,score.catch,score.clamp):0;
        const lift=captured?ramp(t,score.hold,score.lift):0,gulp=captured?ramp(t,score.swallow,score.hidden):0;
        const rest=ramp(t,1180,score.settle),catchWeight=captured?pulse(t,score.clamp,score.clamp+38,score.hold+115):0;
        const planting=([0,1] as const).reduce((sum,i)=>sum+(this.feet[i][1]<-1?pulse(t,this.footPlant(i).at,this.footPlant(i).at+42,this.footPlant(i).at+170):0),0);
        const neck=captured?track(t,[[0,a.neckDrop],[65,a.neckDrop],[310,reach],[score.clamp,reach+1.4],[score.hold,reach+1.4],
            [score.lift,-8.5],[score.swallow,-8.5],[score.hidden,-5],[score.settle,0]]):mix(a.neckDrop,0,settle);
        const head=captured?track(t,[[0,a.headPitch??0],[65,a.headPitch??0],[310,.08],[score.clamp,.12],[score.hold,.12],
            [score.lift,-.24],[score.swallow,-.24],[score.hidden,-.13],[score.settle,0]]):mix(a.headPitch??0,0,settle);
        const hinge=captured?track(t,[[0,a.jawHinge??a.jaw*.3],[65,a.jawHinge??a.jaw*.3],[310,.57],[score.catch,.57],
            [score.clamp,.19],[score.hold,.25],[score.swallow,.25],[score.hidden,.045],[score.settle,.08]]):mix(a.jawHinge??a.jaw*.3,.08,settle);
        const lean=captured?track(t,[[0,a.riderLean??0],[65,a.riderLean??0],[195,-6],[score.catch,-3],
            [score.clamp+28,-6],[score.hold+60,-2.5],[score.lift+45,3],[score.hidden,1],[score.settle,0]]):mix(a.riderLean??0,0,settle);
        const p:DinosaurPose={...a,x:a.x+a.facing*brake,y:a.y,
            gait:a.gait,stride:a.stride*(1-settle),breath:0,bow:mix(a.bow,0,settle),
            compression:mix(a.compression,2.8*pulse(t,65,175,365)+planting*1.2+catchWeight*1.7,settle),
            neckDrop:neck,headPitch:head,
            jaw:mix(a.jaw,.12,settle),jawHinge:hinge,
            recoil:a.recoil*(1-settle),aim:mix(a.aim,.38,settle),reload:0,tuck:0,brace:0,
            tail:track(t,[[0,a.tail],[65,a.tail],[300,-.10],[660,.045],[1120,0]]),
            cloth:reduced?0:a.cloth*(1-settle)+1.5*pulse(t,95,210,450)+1.2*pulse(t,score.clamp+35,score.clamp+100,800),
            riderDrop:mix(a.riderDrop??0,1.5*open*(1-lift)+catchWeight*1.4,settle),riderLean:lean,
            riderHeadTilt:captured?track(t,[[0,0],[65,0],[190,-.07],[score.catch,.15],[score.clamp+35,.2],[score.lift,.07],[score.settle,0]]):0,
            rein:mix(a.rein??0,1,settle),focus:1,eyeClose:captured&&t>score.clamp&&t<score.clamp+55?1:0,
            heat:a.heat*(1-settle),blink:captured&&t>score.clamp+20&&t<score.clamp+65,flash:false,voice:0,
            swallow:captured&&t>=score.swallow&&t<score.settle?ramp(t,score.swallow,score.settle):0,
            captureDetail:captured?open:undefined,
            feet:[this.settleFoot(0,brake,t),this.settleFoot(1,brake,t)],
            chaseGesture:{armSwing:mix(a.chaseGesture?.armSwing??0,-.2,settle),armFold:mix(a.chaseGesture?.armFold??0,.6*open*(1-rest),settle),
                reinSag:mix(a.chaseGesture?.reinSag??.5,.2+lift*1.3-close*.1,settle),
                reinFlutter:reduced?0:(1-settle)*(a.chaseGesture?.reinFlutter??0)+catchWeight*.4}
        };
        if(captured&&t>=score.catch&&t<score.hidden)p.capturedHero={frame:captureFrameAt(t),swallow:gulp,facing:this.facing*a.facing,
            angle:track(t,[[score.catch,-1.2],[score.clamp,-1.24],[score.hold,-1.24],[645,-1.06],[score.swallow,-1.2],[score.hidden,-1.3]])};
        if(captured&&t>=score.entry&&t<score.catch){
            const hero=this.heroAt(t)!,neck=-59+p.bow*25+p.breath+p.neckDrop+p.compression;
            const local=dinosaurHeadPoint([(hero.x-p.x)*p.facing,hero.y-p.y],neck,-(p.headPitch??0));
            p.captureApproach={...hero,x:local[0],y:local[1],angle:hero.angle*p.facing-(p.headPitch??0),facing:hero.facing*p.facing};
        }
        return p;
    }
    private brakeAt(ms:number) {
        const t=clamp((ms-65)/175,0,1);return clamp(this.initial.stride*6,2,6)*(1-(1-t)**3);
    }
    footPlant(index:0|1) {
        const [x,y]=this.feet[index],world=this.initial.x+this.initial.facing*(x+3);
        return {x:world,y:this.initial.y,at:65+Math.sqrt(Math.max(0,-y)/.0009),
            supported:chaseDeckSpans(this.initial.x).some(s=>world>=s.x&&world<s.x+s.width),material:chaseMaterialAt(world)};
    }
    private settleFoot(index:0|1,brake:number,ms:number):Point {
        const [x,y]=this.feet[index],t=Math.max(0,ms-65);return [x-brake,Math.min(0,y+t*t*.0009)];
    }
    mouthAt(ms:number):Point {
        const p=this.poseAt(ms),neck=-59+p.bow*25+p.breath+p.neckDrop+p.compression;
        const mouth=dinosaurMouthPoint(neck,p.jaw,p.headPitch,p.jawHinge);
        return [p.x+p.facing*mouth[0],p.y+mouth[1]];
    }
    heroAt(ms:number):CapturedHeroPose|null {
        if(this.kind!=='caught'||ms>=CHASE_CAPTURE.catch)return null;
        const t=clamp((ms-CHASE_CAPTURE.launch)/(CHASE_CAPTURE.catch-CHASE_CAPTURE.launch),0,1);
        const target=this.mouthAt(CHASE_CAPTURE.catch),height=Math.min(12,7+Math.abs(target[0]-this.origin[0])*.06);
        // A ballistic arc gives the body a readable launch and falling velocity
        // at the catch; the jaw, rather than an easing function, stops Feka.
        return {x:mix(this.origin[0],target[0],t),y:mix(this.origin[1],target[1],t)-4*height*t*(1-t),
            angle:(-1.2+(this.poseAt(CHASE_CAPTURE.catch).headPitch??0))*smoothMotion(t)*this.initial.facing,
            facing:this.facing,frame:captureFrameAt(ms),impact:ms<65};
    }
    cameraAt(ms:number,reduced:boolean):Point {
        if(reduced||this.kind!=='caught')return this.camera;
        const focus=this.mouthAt(CHASE_CAPTURE.catch),pan=ramp(ms,65,350);
        return [this.camera[0]+clamp(focus[0]-this.camera[0]-180,-18,18)*pan,this.camera[1]];
    }
    drawForeground(c:CanvasRenderingContext2D,ms:number,cx:number,cy:number,reduced:boolean) {
        const hero=this.heroAt(ms);
        if(hero&&ms<CHASE_CAPTURE.entry)drawCapturedHero(c,{...hero,x:hero.x-cx,y:hero.y-cy});
        if(this.kind==='caught'){
            drawCaptureEffects(c,this,ms,cx,cy,reduced);
        }else if(this.kind!=='fall'&&ms<240){
            const x=(this.contact?.x??this.origin[0])-cx,y=(this.contact?.y??this.origin[1])-cy,u=ms/240;
            if(this.kind==='shot'&&ms<65){
                const dir=this.contact?.direction??1;
                pixelLine(c,x-dir*12,y,x-dir*2,y,'#d3a75c');pixelLine(c,x-dir*6,y,x,y,'#fff0ce');
            }
            if(this.kind==='wave'&&ms<180){
                const ground=this.initial.y-cy,spread=7+u*25;
                pixelLine(c,x-spread,ground-2,x-4,ground-2,'#e7cb9c');pixelLine(c,x+4,ground-2,x+spread,ground-2,'#bdaa74');
                for(let i=0;i<3;i++)box(c,x+(i-1)*spread*.7,ground-3-Math.sin(u*Math.PI)*(5+i*2),3,2,i===1?'#e7cb9c':'#556047');
            }
            for(let i=0;i<(reduced?3:8);i++){
                const angle=i*Math.PI/4,dist=4+u*(this.kind==='wave'?17:12);
                box(c,x+Math.cos(angle)*dist,y+Math.sin(angle)*dist+u*u*5,2,1,i%2?'#fff0ce':'#d3a75c');
            }
        }
    }
}

/** Contact with the painted river happens before falling below the map.
 * The same splash persists across the native fall/death boundary. */
export function drawChasePlayerSplash(c:CanvasRenderingContext2D,x:number,ms:number,cx:number,cy:number,reduced:boolean) {
    if(ms<0||ms>950)return;
    const age=ms/16.667,water=CHASE_WATER_Y-cy,xx=x-cx;
    if(ms<450)for(let i=0;i<(reduced?4:9);i++){
        const direction=i%2?1:-1,t=age,dx=direction*(2+t*(.35+(i%4)*.14)),dy=-t*(1.4+(i%3)*.35)+t*t*.075;
        if(dy>0)continue;
        box(c,xx+dx,water+dy,2,i%3===0?3:2,i%2?'#cce6cc':'#81b4ac');
    }
    for(let i=0;i<2;i++){
        const u=clamp((ms-i*115)/850,0,1);if(!u||u>.92)continue;
        const width=8+u*42;
        oval(c,xx-width/2,water-1+i,width,2,i?'#679f9b':'#b8d9c6');
        box(c,xx-width/2+3,water+i,width-6,1,'#457a7f');
    }
}
