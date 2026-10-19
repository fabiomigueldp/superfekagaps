import { box, oval, pixelLine, polygon } from '../WorldPainting';
import { HypotheticalVanguard, VANGUARD } from './HypotheticalVanguard';

const P={ink:'#192e3b',cloth:'#34586a',shade:'#233d50',steel:'#94b9bc',edge:'#d1e4cf',
    gold:'#e9b65e',red:'#bd6852',skin:'#d5a17f',boot:'#23333e'};

/** Armor, boots and scarf follow the simulated action, with active weapon arcs
 * confined to the same side/height as the contact rectangle. */
export function drawVanguard(c:CanvasRenderingContext2D,e:HypotheticalVanguard,cx:number,cy:number,reduced=false){
    if(e.dead&&e.deadTimer>420)return;
    const foot=e.y+e.height-cy,x=e.x+e.width/2-cx,sign=e.facing;
    const tell=e.phase==='warning'?Math.min(1,e.actionTicks/e.tellTicks):0;
    const attack=e.phase==='attack',rest=e.phase==='rest'||e.phase==='stunned';
    const progress=attack?Math.min(1,e.actionTicks/VANGUARD.rushTicks):0;
    const crouch=e.dead?14:e.phase==='stunned'?4:attack&&e.move==='vault'?(e.landed?4:0):tell*3;
    const lean=attack&&e.move!=='vault'?4*Math.sin(progress*Math.PI):tell*-2;
    const stride=e.motionX?Math.sin(e.distance/4):0,lift=attack&&e.move==='vault'&&!e.landed?5:0;
    if(e.landing&&!e.dead&&['warning','attack'].includes(e.phase)){
        const tx=e.landing.x+10-cx,ty=e.landing.y-cy;
        pixelLine(c,tx-14,ty-1,tx+14,ty-1,P.gold);
        for(const d of [-1,1]){pixelLine(c,tx+d*14,ty-1,tx+d*10,ty-5,P.gold);box(c,tx+d*10-1,ty-8,2,2,P.edge);}
    }
    oval(c,x-12,224-cy-2,24,3,'#344a50');
    c.save();c.translate(Math.round(x),Math.round(foot));c.scale(sign,1);
    const q=(xx:number,yy:number,w:number,h:number,color:string)=>box(c,xx,yy,w,h,color);
    if(e.flash>0&&Math.floor(e.flash/55)%2===0)c.globalAlpha=.6;
    // Far arm and a short scarf, segmented so it bends during a committed dash.
    const flutter=reduced?0:Math.sin(e.age/95)*2;
    polygon(c,[[-4+lean,-23+crouch],[-13,-22+crouch+flutter],[-20,-18+crouch+flutter],[-12,-26+crouch],[-4+lean,-26+crouch]],P.red);
    pixelLine(c,-5,-19+crouch,-10,-12+crouch,P.ink,4);
    const feet=[[-5-stride*3,-Math.max(0,stride)*3-lift],[6+stride*3,-Math.max(0,-stride)*3-lift]];
    for(const [i,f] of feet.entries()){
        const kx=(f[0]+(i?3:-3))/2+(lift?3:0),ky=-7+crouch*.4-lift*.6;
        pixelLine(c,i?3:-3,-12+crouch,kx,ky,P.ink,5);
        pixelLine(c,kx,ky,f[0],f[1]-2,i?P.cloth:P.shade,4);
        q(kx-2,ky-2,4,3,P.steel);q(f[0]-3,f[1]-3,7,3,P.boot);q(f[0]+2,f[1]-3,2,1,P.steel);
    }
    polygon(c,[[-8+lean,-24+crouch],[5+lean,-24+crouch],[8,-11+crouch],[-7,-11+crouch]],P.ink);
    polygon(c,[[-6+lean,-23+crouch],[4+lean,-23+crouch],[5,-13+crouch],[-5,-13+crouch]],P.cloth);
    q(-6+lean,-23+crouch,5,5,P.steel);q(-5+lean,-23+crouch,3,1,P.edge);
    pixelLine(c,1+lean,-23+crouch,-3,-14+crouch,P.gold,2);q(-5,-13+crouch,11,2,P.shade);
    q(0,-13+crouch,3,2,P.gold);q(5,-17+crouch,3,5,P.ink);q(5,-17+crouch,2,1,P.steel);
    // Open face and angular crest distinguish him from the shield guard.
    q(-3+lean,-31+crouch,9,8,P.ink);q(-2+lean,-28+crouch,8,5,P.skin);
    q(-4+lean,-32+crouch,9,5,P.cloth);q(-3+lean,-32+crouch,7,1,P.steel);
    q(-1+lean,-34+crouch,3,3,P.gold);q(3+lean,-27+crouch,3,2,P.ink);q(5+lean,-27+crouch,1,1,P.edge);
    if(!e.exposed&&!e.dead){
        // Raised brow guard is the same gold as a native blocked stomp. It
        // retracts during recovery, revealing the vulnerable head silhouette.
        pixelLine(c,-4+lean,-30+crouch,7+lean,-30+crouch,P.gold,2);
        pixelLine(c,7+lean,-30+crouch,8+lean,-26+crouch,P.gold,2);
    }
    const armX=attack?12+Math.sin(progress*Math.PI)*7:rest?8:7-tell*4;
    const armY=-17+crouch-(tell*5);
    pixelLine(c,5+lean,-22+crouch,armX-3,armY-2,P.ink,5);
    pixelLine(c,armX-3,armY-2,armX,armY,P.steel,3);q(armX-1,armY-1,3,3,P.skin);
    const bladeX=attack?armX+7:armX+2,bladeY=attack?armY-2:armY-12;
    pixelLine(c,armX,armY,bladeX,bladeY,P.ink,4);pixelLine(c,armX,armY,bladeX,bladeY,P.steel,2);
    q(bladeX,bladeY,2,2,P.edge);q(armX-2,armY,5,2,P.gold);
    if(e.danger&&e.move!=='vault'){
        polygon(c,[[16,-23],[27,-18],[28,-11],[23,-8],[25,-14]],P.gold);
        pixelLine(c,23,-22,29,-16,P.edge);pixelLine(c,29,-16,28,-10,P.edge);
    }
    if(tell>0){q(-9,-37,18,2,P.ink);q(-8,-37,Math.round(16*tell),1,e.strike?P.red:P.gold);}
    c.restore();
    if(!e.dead){
        for(let i=0;i<VANGUARD.health;i++){box(c,x-9+i*5,foot-41,4,3,P.ink);if(i<e.hp)box(c,x-8+i*5,foot-40,2,1,e.enraged?P.red:P.gold);}
        if(e.landed&&e.phase==='attack')for(const d of [-1,1]){
            const age=e.landingAge;box(c,x+d*(12+age*2)-3,foot-3-age%3,5,2,P.steel);
            pixelLine(c,x+d*8,foot-1,x+d*(15+age*2),foot-1,P.gold);
        }
    }
}
