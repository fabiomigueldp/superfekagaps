import { smoothMotion } from './HypotheticalMotion';

export type HandlingAction = 'haul' | 'sift' | 'wrench' | 'shake';
export type DebrisMaterial = 'timber' | 'stone' | 'iron';
export interface LooseDebris {
    x:number; y:number; angle:number; vx:number; vy:number; spin:number;
    held:boolean; moving:boolean; settling:boolean; bounces:number;
}
export interface AftermathProp {
    material:DebrisMaterial; wear:number; struckAt:number; force:number; cueAt:number; handledAt:number;
    piece:LooseDebris|null; hinge:number; hingeVelocity:number; hingeFacing:number; driven:boolean;
    scars:Array<{x:number;y:number}>;
}
export interface HeldDebris { material:'timber'|'stone'; angle:number; wear:number }
export const AFTERMATH_SCALE=.6875;
export const DEBRIS_GRIP_X=56;
export const handlingForMaterial=(material:DebrisMaterial):HandlingAction=>
    material==='timber'?'haul':material==='stone'?'sift':'wrench';
export const isHandling=(action:string):action is HandlingAction=>action==='haul'||action==='sift'||action==='wrench'||action==='shake';
export const handlesMaterial=(action:HandlingAction,material:DebrisMaterial)=>
    action===handlingForMaterial(material)||action==='shake'&&material==='timber';
export const SHAKE_BEATS=[112,138,164] as const;

export function createAftermathProp(material:DebrisMaterial):AftermathProp {
    return {material,wear:0,struckAt:-1,force:0,cueAt:-1,handledAt:-1000,hinge:0,hingeVelocity:0,hingeFacing:1,driven:false,scars:[],
        piece:material==='iron'?null:{x:material==='timber'?0:-3,y:material==='timber'?-22:-15,
            angle:material==='timber'?-.11:0,vx:0,vy:0,spin:0,held:false,moving:false,settling:false,bounces:0}};
}
export function handlingTiming(action:HandlingAction){
    return action==='haul'?{grip:54,yield:78,release:154,duration:212}
        :action==='shake'?{grip:52,yield:78,release:194,duration:250}
        :action==='sift'?{grip:58,yield:80,release:132,duration:192}
        :{grip:56,yield:82,release:128,duration:190};
}
const bump=(a:number,start:number,rise:number,hold:number,end:number)=>
    smoothMotion((a-start)/rise)*(1-smoothMotion((a-hold)/(end-hold)));

/** One performance drives the neck, reins, prop and release. Weight is held
 * before it yields; the rider counters the pull a few frames after the animal. */
export function handlingMotion(action:HandlingAction,age:number,variant:number){
    const t=handlingTiming(action),reach=smoothMotion(age/38)*(1-smoothMotion((age-t.duration+30)/30));
    const effort=bump(age,t.grip-8,18,t.yield+5,t.yield+28)*(.84+.16*Math.cos((age-t.grip)*Math.PI/12));
    const raise=smoothMotion((age-t.yield)/30)*(1-smoothMotion((age-t.release+3)/35));
    const inspect=bump(age,t.release+5,18,t.duration-34,t.duration-12);
    const toss=bump(age,t.release-16,16,t.release+3,t.release+25);
    const opening=bump(age,26,18,t.grip-8,t.grip);
    const release=bump(age,t.release-4,4,t.release+9,t.release+24);
    const stoneGrip=action==='sift'?smoothMotion((age-t.grip+12)/12)*(1-smoothMotion((age-t.release)/20)):0;
    const sniff=(bump(age,20,9,33,43)+bump(age,t.release+10,8,t.release+23,t.release+35))*.7;
    const timber=action==='haul'||action==='shake';
    const shake=action==='shake'?SHAKE_BEATS.reduce((v,beat,i)=>v+bump(age,beat-12,12,beat+2,beat+17)*(i%2?-1:1),0):0;
    return {reach,effort,raise,inspect,toss,sniff,shake,
        pull:action==='wrench'?0:raise*(timber?12:7)-toss*3+shake*3,
        height:raise*(timber?24:13)+toss*(timber?7:3)+shake*7,
        jaw:.1+opening*.38+stoneGrip*.62+release*(action==='sift'?.2:.43),
        angle:timber?-.11+raise*(variant%2?.31:-.27)+toss*.28+shake*.38:raise*.32-toss*.13,
        hinge:action==='wrench'?(smoothMotion((age-t.yield)/28)*1.08
            +bump(age,t.grip,10,t.grip+12,t.yield)*.12):0,
    };
}
/** Bottom handle of a top-hinged shutter; shared by the teeth and the art. */
export function shutterHandle(prop:AftermathProp){
    return {x:-prop.hingeFacing*Math.sin(prop.hinge)*22,y:-38+Math.cos(prop.hinge)*29};
}

/** Local, bounded debris physics, also allowed to settle after leaving a yard.
 * A piece is transferred between pile, jaw and ground, never duplicated. */
export function stepAftermathProp(prop:AftermathProp):{x:number;y:number;strength:number}|null {
    let contact:{x:number;y:number;strength:number}|null=null;
    const p=prop.piece;
    const floor=()=>prop.material==='timber'?-1-Math.abs(Math.sin(p!.angle))*15-Math.abs(Math.cos(p!.angle))*3:-6;
    if(p?.settling&&!p.held){
        if(prop.material==='timber')p.angle=Math.abs(p.angle)<.01?0:p.angle*.75;
        p.y=floor();
    }
    if(p?.moving&&!p.held){
        p.x+=p.vx;p.y+=p.vy;p.vy+=.12;p.angle+=p.spin;
        if(p.x<-38||p.x>38){p.x=Math.max(-38,Math.min(38,p.x));p.vx*=-.25;p.spin*=.5;}
        if(p.y>=floor()){
            const speed=p.vy;p.y=floor();
            contact={x:p.x,y:p.y,strength:Math.min(.85,.2+Math.abs(speed)*.13)};
            if(speed>1.05&&p.bounces<2){p.vy=-speed*.28;p.vx*=.55;p.spin*=.45;p.bounces++;}
            else{p.moving=false;p.settling=true;p.vx=0;p.vy=0;p.spin=0;}
        }
    }
    if(!prop.driven&&(prop.hinge>0||Math.abs(prop.hingeVelocity)>.001)){
        prop.hingeVelocity=(prop.hingeVelocity-prop.hinge*.028)*.96;
        prop.hinge+=prop.hingeVelocity;
        if(prop.hinge<0){
            const speed=Math.abs(prop.hingeVelocity);prop.hinge=0;prop.hingeVelocity=speed>.018?speed*.28:0;
            if(speed>.018)contact={x:0,y:-9,strength:Math.min(1,speed*6)};
        }
    }
    return contact;
}
