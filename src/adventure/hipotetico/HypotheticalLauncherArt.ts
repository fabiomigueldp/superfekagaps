import type {Point} from '../WorldPainting';
import {launcherGeometry,type LauncherPose} from './HypotheticalTower';
import {riderBend} from './HypotheticalMotion';

interface Painter {
    poly:(points:Point[],color:string)=>void;
    line:(x:number,y:number,xx:number,yy:number,color:string,width?:number)=>void;
}
type Body=Parameters<typeof launcherGeometry>[0];
const P={ink:'#172c36',green:'#637653',lit:'#a5ad74',metal:'#607487',wood:'#8c6751',brass:'#c5ac73',suit:'#304659',skin:'#edbc8e'};

/** Tip-relative sprite shared by the loaded round and its first flight frame. */
export function drawLauncherWarhead(p:Painter,at:(x:number,y:number)=>Point,colors:Pick<typeof P,'ink'|'green'|'lit'>=P){
    p.poly([at(-12,-2),at(-7,-4),at(0,0),at(-7,4),at(-12,2)],colors.ink);
    p.poly([at(-10,-1),at(-7,-3),at(-2,0),at(-7,2)],colors.green);
    p.line(...at(-8,-2),...at(-4,-1),colors.lit);
}

/** A compact shoulder prop with a distinct tube, padded grip and open exhaust.
 * The strapped and deployed views are one rigid object, not swapped sprites. */
export function drawLauncher(p:Painter,body:Body,l:LauncherPose){
    const g=launcherGeometry(body,l),at=g.point;
    p.poly([at(-20,-5),at(-14,-3),at(28,-3),at(31,0),at(28,3),at(-14,3),at(-20,5)],P.ink);
    p.poly([at(-17,-3),at(26,-2),at(28,0),at(26,2),at(-17,3)],P.green);
    p.line(...at(-14,-2),...at(25,-2),P.lit);
    p.line(...at(-19,-4),...at(-19,4),P.metal,2);p.line(...at(-20,-2),...at(-20,2),P.ink,2);
    for(const band of [-11,13,26]){p.line(...at(band,-3),...at(band,3),P.ink,2);p.line(...at(band,-2),...at(band,0),P.brass);}
    p.poly([at(-5,2),at(9,2),at(9,5),at(-5,5)],P.wood);p.line(...at(-3,3),...at(7,3),P.brass);
    p.poly([at(2,4),at(6,4),at(5,10),at(1,9)],P.ink);p.line(...at(3,5),...at(3,8),P.wood,2);
    p.line(...at(6,-3),...at(6,-8),P.ink,2);p.line(...at(6,-8),...at(12,-8),P.metal,2);
    p.line(...at(12,-8),...at(12,-5),P.ink);p.line(...at(7,-7),...at(10,-7),P.brass);
    if(!l.fired){
        drawLauncherWarhead(p,(x,y)=>at(39+x,y));
    }else{p.line(...at(29,-2),...at(29,2),P.ink,2);p.line(...at(28,-3),...at(30,-3),P.metal);}
    const saddle=-64+body.bow*39+body.compression;
    if(l.draw<.25){
        p.line(-24,saddle-12,-14,saddle-9,P.wood,2);p.line(-24,saddle-11,-15,saddle-8,P.brass);
    }
}

export function drawLauncherHands(p:Painter,body:Body,l:LauncherPose,rifle:(x:number,y:number)=>Point){
    const g=launcherGeometry(body,l),rider=-64+body.bow*39+body.compression+(body.riderDrop??0),lean=body.riderLean??0;
    const blend=(a:Point,b:Point):Point=>[a[0]+(b[0]-a[0])*l.reach,a[1]+(b[1]-a[1])*l.reach];
    const right=blend(rifle(8,4),g.trigger),left=blend(rifle(18,3),g.support);
    const shoulderR:Point=[-8+riderBend(20,lean),rider-20],shoulderL:Point=[6+riderBend(20,lean),rider-20];
    const elbowR:Point=[(shoulderR[0]+right[0])*.5-4,(shoulderR[1]+right[1])*.5+8];
    const elbowL:Point=[(shoulderL[0]+left[0])*.5+5,(shoulderL[1]+left[1])*.5+7];
    for(const [shoulder,elbow,hand] of [[shoulderR,elbowR,right],[shoulderL,elbowL,left]]){
        p.line(...shoulder,...elbow,P.ink,6);p.line(...elbow,...hand,P.ink,5);
        p.line(...shoulder,...elbow,P.suit,4);p.line(...elbow,...hand,P.suit,3);
        p.line(hand[0]-1,hand[1]-1,hand[0]+1,hand[1]+1,P.skin,3);
    }
}
