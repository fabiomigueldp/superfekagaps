import { box, oval, pixelLine, polygon } from '../WorldPainting';
import { HypotheticalVanguard, VANGUARD } from './HypotheticalVanguard';
import { smoothMotion } from './HypotheticalMotion';
import {vanguardLandingSpan} from './HypotheticalVanguardTactics';

const P={ink:'#192e3b',cloth:'#34586a',shade:'#233d50',steel:'#94b9bc',edge:'#d1e4cf',
    gold:'#e9b65e',red:'#bd6852',skin:'#d5a17f',boot:'#23333e'};

export function vanguardFoot(distance:number,side:number):[number,number]{
    const t=((distance+side*10)%20+20)%20;
    if(t<12)return [6-t,0];
    const u=(t-12)/8;return [-6+12*smoothMotion(u),-Math.sin(u*Math.PI)*4];
}

/** Armor, boots and scarf follow the simulated action, with active weapon arcs
 * confined to the same side/height as the contact rectangle. */
export function drawVanguard(c:CanvasRenderingContext2D,e:HypotheticalVanguard,cx:number,cy:number,reduced=false){
    if(e.dead&&e.deadTimer>420)return;
    const foot=e.y+e.height-cy,x=e.x+e.width/2-cx;
    const pivot=e.pivotProgress,sign=pivot<.5?e.pivotFrom:e.facing;
    if(e.dead){
        const t=smoothMotion(e.deadTimer/280),rise=Math.sin(t*Math.PI)*8;
        oval(c,x-15,foot-2,32,3,'#344a50');
        polygon(c,[[x-11,foot-4],[x-6,foot-15*(1-t)-5],[x+5,foot-13*(1-t)-4],
            [x+16,foot-3],[x+11,foot],[x-12,foot]],P.ink);
        pixelLine(c,x-7,foot-7*(1-t)-3,x+7,foot-3,P.cloth,3);
        pixelLine(c,x-3,foot-6*(1-t)-4,x+4,foot-4,P.steel,2);
        box(c,x-10-e.facing*t*9,foot-9-rise,8,3,P.cloth);
        box(c,x-9-e.facing*t*9,foot-9-rise,6,1,P.gold);
        const blade=x+e.facing*(17+t*12);
        pixelLine(c,blade,foot-3,blade+e.facing*10,foot-4-rise*.5,P.ink,3);
        pixelLine(c,blade,foot-3,blade+e.facing*10,foot-4-rise*.5,P.steel);
        polygon(c,[[x-10,foot-3],[x-21,foot-2],[x-16,foot-5],[x-8,foot-6]],P.red);
        return;
    }
    const tell=e.phase==='warning'?Math.min(1,e.actionTicks/e.tellTicks):0;
    const attack=e.phase==='attack',rest=e.phase==='rest'||e.phase==='stunned';
    const progress=attack?Math.min(1,e.actionTicks/e.attackDuration):0;
    const release=smoothMotion(e.actionTicks/6),thrust=smoothMotion(progress/.26)*(1-smoothMotion((progress-.65)/.35));
    const sweep=e.move==='sweep',cross=e.move==='cross',airborne=attack&&e.move==='vault'&&!e.landed;
    const crouch=e.dead?14:e.phase==='stunned'?4:sweep?(attack?6*thrust+4*(1-release):tell*5)
        :attack&&e.move==='vault'?(e.landed?4:3*(1-release))
        :attack?3*(1-release):rest&&e.landed?4*(1-smoothMotion(e.actionTicks/10)):tell*3;
    const lean=e.phase==='stunned'?-3:attack&&e.move!=='vault'?-2*(1-release)+(sweep?6:4)*thrust
        :airborne?2:tell*-2;
    const lift=airborne?(e.vy<0?6:2+4*(1-smoothMotion(e.vy/8)))*release:0;
    if(e.landing&&!e.dead&&['warning','attack'].includes(e.phase)){
        const span=vanguardLandingSpan(e.landing),ty=e.landing.y-cy;
        pixelLine(c,span.left-cx,ty-1,span.right-cx,ty-1,P.gold);
        for(const [at,d] of [[span.left,1],[span.right,-1]]){
            pixelLine(c,at-cx,ty-1,at-cx+d*4,ty-5,P.gold);box(c,at-cx+d*4-1,ty-8,2,2,P.edge);
        }
    }
    const shadow=e.vy===0?foot:(e.landing?.y??224)-cy;
    oval(c,x-12,shadow-2,24,3,'#344a50');
    c.save();c.translate(Math.round(x),Math.round(foot));c.scale(sign,1);
    const q=(xx:number,yy:number,w:number,h:number,color:string)=>box(c,xx,yy,w,h,color);
    if(e.flash>0&&Math.floor(e.flash/55)%2===0)c.globalAlpha=.6;
    // Far arm and a short scarf, segmented so it bends during a committed dash.
    const flutter=reduced?0:Math.sin(e.age/95)*.7+Math.min(4,Math.abs(e.motionX))*.6;
    polygon(c,[[-4+lean,-23+crouch],[-13,-22+crouch+flutter],[-21-flutter,-19+crouch+flutter],
        [-16,-26+crouch],[-4+lean,-26+crouch]],'#6d4141');
    polygon(c,[[-4+lean,-24+crouch],[-13,-23+crouch+flutter],[-19-flutter,-21+crouch+flutter],
        [-13,-26+crouch],[-4+lean,-26+crouch]],P.red);
    pixelLine(c,-7+lean,-25+crouch,-14,-24+crouch+flutter,'#e49c73');
    pixelLine(c,-5,-19+crouch,-10,-12+crouch,P.ink,4);
    const stepDirection=e.motionX*e.facing<0?-1:1;
    const feet=[0,1].map(side=>{
        const p=e.motionX&&!airborne?vanguardFoot(e.distance,side):[0,0];
        return [(side?4:-4)+p[0]*stepDirection+(sweep&&attack?(side?5:-4)*thrust:0),p[1]-lift*(side?.6:1)];
    });
    for(const [i,f] of feet.entries()){
        const kx=(f[0]+(i?3:-3))/2+(lift?3:0),ky=-7+crouch*.4-lift*.6;
        pixelLine(c,i?3:-3,-12+crouch,kx,ky,P.ink,5);
        pixelLine(c,kx,ky,f[0],f[1]-2,i?P.cloth:P.shade,4);
        q(kx-2,ky-2,4,3,P.steel);q(kx-1,ky-2,2,1,P.edge);
        pixelLine(c,kx,ky+2,f[0],f[1]-4,'#476578');
        q(f[0]-3,f[1]-3,7,3,P.boot);q(f[0]-2,f[1]-4,3,1,'#6a797d');q(f[0]+2,f[1]-3,2,1,P.steel);
    }
    polygon(c,[[-8+lean,-24+crouch],[5+lean,-24+crouch],[8,-11+crouch],[-7,-11+crouch]],P.ink);
    polygon(c,[[-6+lean,-23+crouch],[4+lean,-23+crouch],[5,-13+crouch],[-5,-13+crouch]],P.cloth);
    q(-6+lean,-23+crouch,5,5,P.steel);q(-5+lean,-23+crouch,3,1,P.edge);
    q(-6+lean,-19+crouch,4,1,'#64858f');q(-5+lean,-22+crouch,1,1,P.gold);
    polygon(c,[[0+lean,-22+crouch],[4+lean,-21+crouch],[4,-16+crouch],[-1,-16+crouch]],'#547b89');
    pixelLine(c,lean,-21+crouch,3+lean,-21+crouch,P.steel);q(2,-18+crouch,2,1,'#8aa5a7');
    q(-4,-17+crouch,3,1,'#1e3445');q(-4,-15+crouch,2,1,'#63818a');
    pixelLine(c,1+lean,-23+crouch,-3,-14+crouch,P.gold,2);q(-5,-13+crouch,11,2,P.shade);
    q(0,-13+crouch,3,2,P.gold);q(5,-17+crouch,3,5,P.ink);q(5,-17+crouch,2,1,P.steel);
    polygon(c,[[-6,-10+crouch],[-1,-10+crouch],[-2,-6+crouch],[-7,-7+crouch]],P.shade);
    q(-5,-10+crouch,3,1,'#6a8690');q(5,-14+crouch,2,1,P.gold);
    // Open face and angular crest distinguish him from the shield guard.
    q(-3+lean,-31+crouch,9,8,P.ink);q(-2+lean,-28+crouch,8,5,P.skin);
    q(-4+lean,-32+crouch,9,5,P.cloth);q(-3+lean,-32+crouch,7,1,P.steel);
    q(-3+lean,-30+crouch,2,2,'#628591');q(-2+lean,-24+crouch,5,1,'#a17065');
    q(-1+lean,-34+crouch,3,3,e.exposed?'#99e0cf':P.gold);q(3+lean,-27+crouch,3,2,P.ink);q(5+lean,-27+crouch,1,1,P.edge);
    if(!e.exposed&&!e.dead){
        // Raised brow guard is the same gold as a native blocked stomp. It
        // retracts during recovery, revealing the vulnerable head silhouette.
        pixelLine(c,-4+lean,-30+crouch,7+lean,-30+crouch,P.gold,2);
        pixelLine(c,7+lean,-30+crouch,8+lean,-26+crouch,P.gold,2);
    }
    const armX=sweep?(attack?8+17*thrust:8-tell*5):attack?(cross?-1+9*release+10*Math.sin(progress*Math.PI):3+5*release+14*thrust):rest?8:7-tell*(cross?8:4);
    const armY=sweep?-17+11*(attack?thrust:tell):attack&&cross?-27+crouch+17*Math.sin(progress*Math.PI)+10*smoothMotion((progress-.65)/.35)
        :-17+crouch-(attack?5*(1-release):tell*(cross?10:5));
    pixelLine(c,5+lean,-22+crouch,armX-3,armY-2,P.ink,5);
    pixelLine(c,armX-3,armY-2,armX,armY,P.steel,3);q(armX-1,armY-1,3,3,P.skin);
    const extension=attack?thrust:0;
    const bladeX=armX+2+(sweep?12:7)*extension,bladeY=armY-12+(sweep?12:cross?17:10)*extension;
    pixelLine(c,armX,armY,bladeX,bladeY,P.ink,4);pixelLine(c,armX,armY,bladeX,bladeY,P.steel,2);
    q(bladeX,bladeY,2,2,P.edge);q(armX-2,armY,5,2,P.gold);
    if(tell>0){
        q(-9,-38,18,2,P.ink);q(-8,-38,Math.round(16*tell),1,e.strike?P.red:P.gold);
        if(sweep){pixelLine(c,10,-5,19,-5,P.gold);pixelLine(c,19,-5,16,-8,P.edge);}
        if(e.strike)q(-2,-42,4,2,P.red);
    }
    c.restore();
    const danger=e.danger;
    if(danger&&e.move!=='vault'){
        const edge=(e.facing>0?danger.x+danger.width-1:danger.x)-cx,yy=danger.y-cy;
        // The bright edge has the real reach and height, even during the low cut.
        pixelLine(c,edge-e.facing*5,yy,edge,yy+3,e.strike?P.red:P.gold);
        pixelLine(c,edge,yy+3,edge,yy+danger.height-3,P.edge);
        pixelLine(c,edge,yy+danger.height-3,edge-e.facing*7,yy+danger.height-1,P.gold);
    }
    if(!e.dead){
        for(let i=0;i<VANGUARD.health;i++){box(c,x-12+i*5,foot-47,4,3,P.ink);if(i<e.hp)box(c,x-11+i*5,foot-46,2,1,e.enraged?P.red:P.gold);}
        if(!reduced&&Math.abs(e.motionX)>3&&!airborne){
            for(let i=0;i<3;i++)box(c,x-e.facing*(9+i*5),foot-2-i%2,3-i%2,1,i%2?'#93a79c':'#688d91');
        }
        if(e.landed&&e.phase==='attack')for(const d of [-1,1]){
            const age=e.landingAge;box(c,x+d*(12+age*2)-3,foot-3-age%3,5,2,P.steel);
            pixelLine(c,x+d*8,foot-1,x+d*(15+age*2),foot-1,P.gold);
            if(!reduced)for(let i=0;i<3;i++){
                const reach=10+age*(1.2+i*.35),rise=Math.max(0,age*(1+i*.1)-age*age*.1);
                box(c,x+d*reach,foot-2-rise,3-i%2,2,i%2?'#a6b3a5':'#7f9694');
            }
        }
    }
}
