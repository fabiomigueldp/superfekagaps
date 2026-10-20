import type {CameraData,PlayerData} from '../../types';
import {box,oval,pixelLine,type Point} from '../WorldPainting';
import {clamp} from '../types';
import type {DinosaurPose} from './HypotheticalArt';
import type {ChaseContact,HypotheticalModel} from './HypotheticalModel';
import {dinosaurFootAnchor,dinosaurMouthPoint,smoothMotion} from './HypotheticalMotion';
import {drawCapturedHero,type CapturedHeroPose} from './HypotheticalCapturedHero';
import {CHASE_WATER_Y} from './HypotheticalChaseDetails';

export const CHASE_CAPTURE=Object.freeze({launch:65,catch:390,lift:720,swallow:810,hidden:1130,fade:1410,black:1710,duration:1910});
const ramp=(time:number,start:number,end:number)=>smoothMotion((time-start)/(end-start));
const mix=(a:number,b:number,t:number)=>a+(b-a)*t;
export type ChaseDefeatKind=ChaseContact['kind']|'fall';

/** Presentation only. Native damage has already decided the outcome, including
 * helmets and invulnerability. DeathTimer owns every pose, cue and transition. */
export class HypotheticalChaseDefeat {
    readonly origin:Point;
    readonly facing:number;
    readonly camera:Point;
    readonly feet:readonly [Point,Point];
    readonly kind:ChaseDefeatKind;
    constructor(readonly initial:DinosaurPose,player:PlayerData,view:CameraData,readonly contact:ChaseContact|null,readonly tick:number) {
        const p=player.deathOrigin??player.position;
        this.origin=[p.x+player.width/2,p.y+player.height/2-1];
        this.facing=player.facingRight?1:-1;
        this.kind=player.deathKind==='fall'?'fall':contact?.kind??'shot';
        this.camera=[view.x,view.y];
        this.feet=[dinosaurFootAnchor(initial.gait,true,(1-initial.bow)*initial.stride,initial.tuck,initial.brace),
            dinosaurFootAnchor(initial.gait,false,(1-initial.bow)*initial.stride,initial.tuck,initial.brace)];
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
        const a=this.initial,t=Math.max(0,ms),settle=ramp(t,65,360),brake=ramp(t,65,240)*4;
        const captured=this.kind==='caught',reach=clamp(this.origin[1]-(a.y-39),-14,24);
        const open=ramp(t,65,300),close=ramp(t,CHASE_CAPTURE.catch,470),lift=ramp(t,470,CHASE_CAPTURE.lift);
        const gulp=ramp(t,CHASE_CAPTURE.swallow,CHASE_CAPTURE.hidden),rest=ramp(t,1190,1450);
        const neck=captured?mix(reach,-9,lift)*(1-rest):0;
        const head=captured?mix(.08,-.22,lift)*(1-rest):0;
        const hinge=captured?(mix(.62,.24,close)*(1-gulp)+.045*gulp):.08;
        const p:DinosaurPose={...a,x:a.x+a.facing*brake,y:a.y,
            gait:a.gait,stride:a.stride*(1-settle),breath:0,bow:mix(a.bow,0,settle),
            compression:mix(a.compression,captured?3*Math.sin(Math.PI*clamp((t-65)/650,0,1)):0,settle),
            neckDrop:mix(a.neckDrop,neck,open),headPitch:mix(a.headPitch??0,head,open),
            jaw:mix(a.jaw,.12,settle),jawHinge:mix(a.jawHinge??a.jaw*.3,hinge,open),
            recoil:a.recoil*(1-settle),aim:mix(a.aim,.38,settle),reload:0,tuck:0,brace:0,
            tail:mix(a.tail,-.09*Math.sin(Math.PI*clamp(t/1100,0,1)),settle),
            cloth:reduced?0:a.cloth*(1-settle)+Math.sin(Math.max(0,t-65)/120)*1.3*(1-ramp(t,600,1150)),
            riderDrop:mix(a.riderDrop??0,2+2*close-2*lift,settle),
            riderLean:mix(a.riderLean??0,-5*open+7*lift-2*rest,settle),
            rein:mix(a.rein??0,1,settle),focus:1,eyeClose:t>450&&t<510?1:0,
            heat:a.heat*(1-settle),blink:false,flash:false,voice:0,swallow:t>=CHASE_CAPTURE.swallow&&t<1320?ramp(t,CHASE_CAPTURE.swallow,1320):0,
            feet:[this.settleFoot(0,brake,t),this.settleFoot(1,brake,t)],
            chaseGesture:{armSwing:mix(a.chaseGesture?.armSwing??0,-.2,settle),armFold:mix(a.chaseGesture?.armFold??0,.6*open*(1-rest),settle),
                reinSag:mix(a.chaseGesture?.reinSag??.5,.5,settle),reinFlutter:reduced?0:(1-settle)*(a.chaseGesture?.reinFlutter??0)}
        };
        if(captured&&t>=CHASE_CAPTURE.catch&&t<CHASE_CAPTURE.hidden)p.capturedHero={frame:Math.floor((t-65)/95)%4,swallow:gulp,facing:this.facing*a.facing};
        return p;
    }
    private settleFoot(index:0|1,brake:number,ms:number):Point {
        const [x,y]=this.feet[index];return [x-brake,mix(y,0,ramp(ms,65,210))];
    }
    mouthAt(ms:number):Point {
        const p=this.poseAt(ms),neck=-59+p.bow*25+p.breath+p.neckDrop+p.compression;
        const mouth=dinosaurMouthPoint(neck,p.jaw,p.headPitch,p.jawHinge);
        return [p.x+p.facing*mouth[0],p.y+mouth[1]];
    }
    heroAt(ms:number):CapturedHeroPose|null {
        if(this.kind!=='caught'||ms>=CHASE_CAPTURE.catch)return null;
        const t=clamp((ms-CHASE_CAPTURE.launch)/(CHASE_CAPTURE.catch-CHASE_CAPTURE.launch),0,1),u=smoothMotion(t);
        const target=this.mouthAt(CHASE_CAPTURE.catch),arc=Math.sin(Math.PI*t)*Math.min(28,16+Math.abs(target[0]-this.origin[0])*.16);
        return {x:mix(this.origin[0],target[0],u),y:mix(this.origin[1],target[1],u)-arc,
            angle:(-1.2+(this.poseAt(CHASE_CAPTURE.catch).headPitch??0))*u*this.initial.facing,facing:this.facing,frame:Math.floor(Math.max(0,ms-65)/95)%4,impact:ms<65};
    }
    cameraAt(ms:number,reduced:boolean):Point {
        if(reduced||this.kind!=='caught')return this.camera;
        const focus=this.mouthAt(CHASE_CAPTURE.catch),pan=ramp(ms,65,500);
        return [this.camera[0]+clamp(focus[0]-this.camera[0]-180,-18,18)*pan,this.camera[1]];
    }
    drawForeground(c:CanvasRenderingContext2D,ms:number,cx:number,cy:number,reduced:boolean) {
        const hero=this.heroAt(ms);
        if(hero)drawCapturedHero(c,{...hero,x:hero.x-cx,y:hero.y-cy});
        if(this.kind==='caught'){
            const p=this.poseAt(ms,reduced),brake=clamp((ms-65)/370,0,1);
            if(ms>=65&&brake<1)for(const [footX]of this.feet){
                const x=this.initial.x+this.initial.facing*footX-cx,y=p.y-cy;
                for(let i=0;i<(reduced?2:5);i++)box(c,x-i*3-p.facing*brake*14,y-2-Math.sin(brake*Math.PI)*(2+i),brake<.6?3:2,1,i%2?'#bdaa74':'#e7cb9c');
            }
            const hit=ms-CHASE_CAPTURE.catch;
            if(hit>=0&&hit<180){
                const [x,y]=this.mouthAt(ms),u=hit/180;
                for(let i=0;i<(reduced?2:5);i++){
                    const a=-Math.PI*.8+i*.46,r=7+u*11;
                    pixelLine(c,x-cx+Math.cos(a)*r,y-cy+Math.sin(a)*r,x-cx+Math.cos(a)*(r+3),y-cy+Math.sin(a)*(r+3),'#fff0ce');
                }
            }
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
