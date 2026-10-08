import { PixelGrid, animationIndex, type PixelFrame } from '../../graphics/pixels';
import { ART } from '../../graphics/palette';
import type { FoeType } from './DeliciaContent';
import type { BossBeat } from './DeliciaBoss';
import { oval, shape } from './DeliciaSpriteDrawing';
import { paintDeliciaFoe, type DeliciaFoePose } from './DeliciaFoeSprites';
import { paintDeliciaBoss } from './DeliciaBossSprites';

export const DELICIA_PIXEL_PALETTE = {
    _: null, K: ART.ink, k: ART.inkLight, W: ART.paper, w: ART.white,
    S: ART.skin, s: ART.skinDark, L: ART.skinLight, H: ART.hair, h: ART.hairLight,
    O: ART.orange, o: ART.orangeDark, l: ART.orangeLight,
    Y: ART.gold, y: ART.goldDark, I: ART.goldLight,
    G: ART.leaf, g: ART.leafDark, E: ART.leafLight, e: ART.leafTip,
    T: ART.teal, t: ART.tealDark, D: ART.tealLight,
    N: ART.rock, n: ART.rockDark, A: ART.rockLight, a: ART.rockTop,
    P: ART.purple, p: ART.purpleDark, Q: ART.purpleLight,
    R: ART.red, r: ART.redDark, F: ART.redLight,
    B: ART.blue, b: ART.blueDark, C: ART.blueLight,
    U: ART.soil, u: ART.soilDark, V: ART.soilLight, v: ART.soilTop,
} as const;

const FOE_KINDS:FoeType[]=['pulp','beetle','wasp','roller','sentinel','bottler','mimic','bloom'];
const poses:DeliciaFoePose[]=['walk','tell','attack','stun'];
const foes=Object.fromEntries(FOE_KINDS.map(kind=>[kind,Object.fromEntries(poses.map(pose=>
    [pose,[0,1,2,3].map(f=>paintDeliciaFoe(kind,pose,f))]))])) as Record<FoeType,Record<string,PixelFrame[]>>;
export function deliciaFoeFrame(kind:FoeType,pose:string,time:number):PixelFrame {
    return (foes[kind][pose]??foes[kind].walk)[animationIndex(time*1000,4,1000/(kind==='wasp'?14:7))];
}

const beats:BossBeat[]=['intro','idle','tell','attack','recover','stagger','transition','defeated'];
const bosses=Object.fromEntries((['jaja','guina'] as const).map(character=>[character,Object.fromEntries(beats.map(beat=>
    [beat,[0,1,2,3].map(f=>paintDeliciaBoss(character,beat,f))]))])) as Record<'jaja'|'guina',Record<BossBeat,PixelFrame[]>>;
export function deliciaBossFrame(character:'jaja'|'guina',beat:BossBeat,time:number):PixelFrame {
    return bosses[character][beat][animationIndex(time*1000,4,1000/7)];
}

function icon(kind:'orange'|'heart'|'seal'|'memory'):PixelFrame {
    const g=new PixelGrid(12,12);
    if(kind==='orange'){
        oval(g,1,3,10,9,'K');oval(g,2,3,8,8,'o');oval(g,2,3,7,7,'O');
        g.rect(3,4,3,1,'I').dot(3,5,'l').dot(7,8,'l').dot(4,9,'y');
        g.line(6,3,7,0,'u').stamp(['_gGG','gGEg','_gg_'],7,0).dot(5,3,'g');
    }else if(kind==='heart'){
        g.stamp(['_KKK_KKK_','KRFRKRFRK','KFWFRRrrK','KFRRRRrrK','KRRRRrrrK','_KRRRrrK_','__KRrrK__','___KrK___','____K____'],1,2);
    }else if(kind==='seal'){
        g.stamp(['__KK____KK__','__KrK__KrK__','___KrKKrK___'],0,9);
        g.stamp(['___KKKKK___','__KIIYYYK__','_KIYyyyyYK_','_KIyIYIyyK_','_KYyYYYyyK_','_KYyyYyyyK_','_KYyIIIyyK_','__KYyyyYK__','___KKKKK___'],0,1);
    }else{
        shape(g,[[6,0],[10,5],[11,8],[9,11],[3,11],[1,8],[2,5]],'K');
        shape(g,[[6,1],[9,5],[10,8],[8,10],[4,10],[2,8],[3,5]],'t');
        shape(g,[[6,2],[8,5],[8,8],[6,10],[3,8],[3,6]],'T');
        g.line(6,2,3,7,'D').rect(4,7,2,1,'W').rect(6,5,2,2,'D').dot(8,8,'T');
    }
    return g.finish();
}
export const DELICIA_ICONS={orange:icon('orange'),heart:icon('heart'),seal:icon('seal'),memory:icon('memory')};

function projectile(kind:'seed'|'juice'|'heart',friendly:boolean):PixelFrame {
    const g=new PixelGrid(kind==='heart'?12:8,kind==='heart'?12:8);
    if(kind==='heart'){
        g.stamp(['__KK___KK__','_KQQK_KQQK_','KQPpQKQPpQK','KQPPPPPPppK','_KPPPPPPpK_','__KPPPPpK__','___KPPpK___','____KpK____','_____K_____'],0,1);
        if(friendly){g.line(2,3,4,3,'D').line(8,3,9,3,'D').dot(5,7,'I');}
        else{g.dot(3,4,'F').dot(8,4,'F').rect(4,7,3,1,'r');}
    }else if(kind==='seed'){
        g.stamp(['___KK___','__KVyK__','_KVvyK__','KVIUyK__','KvUUyK__','_KUuK___','__KK____','________'],0,0);
        if(friendly)g.line(3,1,1,4,'I').dot(2,5,'Y');
    }else{
        g.stamp(['___KK___','___KlK__','__KlOK__','_KlOOoK_','KlIOOooK','KOOOOooK','_KOOooK_','__KKKK__'],0,0);
        if(friendly)g.line(4,1,2,4,'D').dot(2,5,'W');
    }
    return g.finish();
}
const missiles={seed:[projectile('seed',false),projectile('seed',true)],juice:[projectile('juice',false),projectile('juice',true)],heart:[projectile('heart',false),projectile('heart',true)]};
export function deliciaProjectileFrame(kind:'seed'|'juice'|'heart',friendly:boolean):PixelFrame{return missiles[kind][Number(friendly)];}
