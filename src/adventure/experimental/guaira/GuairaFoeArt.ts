import type { WorldFoe } from '../../WorldEnemies';
import { box as r, pixelLine as line, oval, polygon } from '../../WorldPainting';
import { pixelText } from '../../../graphics/BitmapFont';
import { drawGuairaBarrel } from './GuairaFoeProjectiles';

/** Guaíra's canal scavengers share the campaign enemy rules. Shell, claws and
 * carried drum make their different defenses/actions visible before contact. */
export function drawGuairaFoe(c: CanvasRenderingContext2D, e: WorldFoe, cx: number, cy: number, reduced = false) {
    if (e.dead && e.deadTimer >= 360 || e.x + e.width < cx - 12 || e.x > cx + 332) return;
    const x=Math.round(e.x-cx), y=Math.round(e.y-cy), armored=e.spec.kind==='helmet'&&e.armor;
    const charging=e.spec.kind==='charger', loading=e.spec.kind==='loader',sweeping=e.spec.kind==='agitator',riding=e.spec.kind==='rail';
    const walking=Math.abs(e.motionX)>.01&&!e.dead;
    const pose=reduced||!walking?0:Math.floor(e.distance/3)%8;
    const stride=[0,1,2,1,0,-1,-2,-1][pose];
    const preparing=!e.dead&&e.phase==='warning', attacking=!e.dead&&e.phase==='attack', resting=!e.dead&&e.phase==='rest';
    const brace=preparing?(charging?1+Math.min(2,Math.floor(e.timer/270)):2):charging&&resting?Math.max(0,3-Math.floor(e.timer/470)):0;
    const recoil=e.phase==='recoil'?Math.max(0,3-Math.floor(e.timer/120)):0;
    const pinching=e.spec.kind==='minion', stunned=e.phase==='stunned';
    const shell=sweeping||riding?['#354e52','#527b78','#82aaa0','#bfd3b0']
        :charging?['#503b43','#874d47','#bc7860','#e4b587']
        :loading?['#59463d','#9b704b','#c59a62','#e7cb8b']
        :armored?['#394e51','#597571','#8da18c','#cccfaa']
        :['#543940','#ad594c','#d58260','#f1ba7e'];
    c.save();
    if(e.dead)c.globalAlpha=Math.max(0,1-e.deadTimer/360);
    else if(!reduced&&e.flash>0&&Math.floor(e.flash/45)%2)c.globalAlpha=.55;
    oval(c,x+1,y+e.height-2,e.width-2,3,'#705b4c');
    c.translate(x+Math.floor(e.width/2),y+e.height-(e.dead?Math.round(Math.sin(e.deadTimer/360*Math.PI)*10):0));
    c.scale(e.facing<0?-1:1,1);
    const w=Math.floor(e.width/2), bob=reduced||!walking?0:[0,0,-1,-1,0,0,1,1][pose];
    const top=-e.height+brace+recoil+bob;
    // Alternating planted feet and hinged claws, with the shell kept stable.
    if(!riding)for(const side of [-1,1])for(let leg=0;leg<3;leg++) {
        const beat=(pose+leg*2+(side>0?4:0))%8;
        const reach=walking&&!reduced?[-2,-1,1,2,2,0,-2,-3][beat]:preparing?-1:0;
        const lift=walking&&!reduced?[0,0,0,0,1,2,2,1][beat]:0;
        const knee=side*(w-1)+reach, foot=side*(w+2)+reach;
        line(c,side*(w-4),-8+leg+bob,knee,-5+leg-lift,shell[0],2);
        line(c,knee,-5+leg-lift,foot,-2-lift,shell[1]);
        r(c,foot-(side<0?2:0),-2-lift,3,2,shell[0]);r(c,knee,-5+leg-lift,2,1,shell[2]);
    }
    polygon(c,[[-w+1,top+8],[-w+4,top+4],[w-4,top+4],[w-1,top+8],[w-2,-4],[-w+2,-4]],shell[0]);
    r(c,-w+2,top+7,e.width-4,9,shell[1]);r(c,-w+4,top+5,e.width-8,7,shell[2]);
    r(c,-w+4,top+5,e.width-8,1,shell[3]);r(c,-w+3,top+8,2,3,shell[3]);
    for(let rib=0;rib<3;rib++){r(c,-w+3,top+12+rib*2,e.width-6,1,shell[0]);r(c,-2,top+11+rib*2,4,1,shell[2]);}
    const blink=!reduced&&!preparing&&!attacking&&!stunned&&e.age%2700>2580;
    r(c,1,top+3,3,5,shell[0]);r(c,2,top+2,3,3,'#f7dfab');r(c,4,top+3,1,blink?1:2,'#40363a');
    r(c,-5,top+3,2,4,shell[0]);r(c,-5,top+2,3,2,'#e5c68d');r(c,-3,top+3,1,1,'#40363a');
    r(c,1,top+10,4,1,shell[0]);r(c,2,top+11,2,1,shell[3]);
    if(!loading){
        const clawY=preparing?top+8:top+10+(reduced||!walking?0:Math.sign(stride));
        line(c,w-3,top+12,w+2-(preparing?2:0),clawY+2,'#69423e');
        r(c,w-1,clawY,5,5,'#723e40');r(c,w,clawY,4,2,'#e2a06c');r(c,w+2,clawY+3,3,2,'#c57352');
        r(c,-w-3,top+11,5,4,'#9b4d43');r(c,-w-3,top+10,4,2,'#d98a5d');
    }else if(e.phase==='recoil'){
        const hand=top+7+(reduced?3:Math.min(5,Math.floor(e.timer/75)));
        line(c,w-3,top+12,w+4,hand,shell[0],2);r(c,w+2,hand,5,3,shell[2]);r(c,w+4,hand,3,1,shell[3]);
        line(c,-w+3,top+12,-w-1,top+14,shell[0],2);r(c,-w-3,top+13,4,3,shell[1]);
    }
    if(pinching&&attacking){
        // The amber pincer exactly covers the native forward danger band.
        const active=!!e.danger, reach=active?8:4, yy=-e.height+10;
        line(c,w-3,top+12,w+reach-3,yy+4,shell[0],2);
        polygon(c,[[w-2,yy+2],[w+1,yy],[w+reach,yy],[w+reach,yy+3],[w+reach-2,yy+4],
            [w+reach,yy+5],[w+reach,yy+8],[w+1,yy+8],[w-2,yy+6]],shell[0]);
        r(c,w-1,yy+2,4,4,shell[2]);r(c,w+1,yy+1,reach-1,2,shell[3]);r(c,w+1,yy+5,reach-1,2,shell[1]);
        r(c,w+reach-2,yy+2,2,active?4:1,shell[2]);r(c,w+1,yy+2,2,1,'#ffe2a2');
    }
    if(armored) {
        r(c,-w,top+1,e.width,7,'#5b6662');r(c,-w+1,top-1,e.width-2,6,'#909e84');
        r(c,-w+3,top-2,e.width-6,2,'#d5c79a');r(c,-w+2,top+1,e.width-4,2,'#b4baa0');
        r(c,-2,top-2,3,8,'#657a73');r(c,-w,top+6,e.width,2,'#dbc28e');
        for(const dx of [-w+2,w-3])r(c,dx,top+4,2,1,'#eee0ac');
        for(const dx of [-5,3]){r(c,dx,top,2,4,'#748d82');r(c,dx,top,1,3,'#dbe0b6');}
    } else if(e.spec.kind==='helmet') {
        // A broken rim remains, making the one-hit exposed state unmistakable.
        r(c,-w+1,top+1,4,3,'#657a73');r(c,w-4,top+2,3,2,'#8fa58d');
        line(c,-3,top+5,0,top+8,'#593c44');
        if(stunned){r(c,-6,top-4,2,2,'#f8d78e');r(c,5,top-2,2,2,'#f8d78e');}
    }
    if(charging) {
        r(c,-w+2,top+1,e.width-5,5,'#7f6958');r(c,-w+3,top,e.width-7,2,'#ceb58a');
        r(c,w-2,top+3,5,3,'#f3dca3');r(c,w+2,top+1,2,3,'#f3dca3');
        for(let plate=0;plate<3;plate++){r(c,-w+4+plate*5,top-1+(plate%2),3,4,'#685f53');r(c,-w+4+plate*5,top-1+(plate%2),3,1,'#e2c999');}
        r(c,w-1,top+6,4,4,'#6d4d42');r(c,w+2,top+6,3,1,'#ebcc98');
        if(resting){
            // The lowered forehead and split plates reveal a physical target;
            // recovery is readable from the silhouette, not only a HUD caption.
            r(c,-6,top,12,6,'#4b5b50');r(c,-4,top+1,8,4,'#a7c99d');r(c,-2,top+1,4,1,'#e7dfad');
            for(const side of [-1,1]){const sx=side<0?-w+1:5;
                line(c,sx,top+2,sx+(side<0?-2:5),top-2,'#685f53',3);
                line(c,sx,top+1,sx+(side<0?-2:5),top-3,'#ceb58a');}
            r(c,w+1,top+7,3,1,'#40363a');
        }else if(preparing){
            r(c,w-1,top+5,5,2,'#503b43');r(c,w+2,top+7,2,1,'#ffe1a0');
            if(!reduced){const scrape=Math.floor(e.timer/90)%3;r(c,-w-3-scrape,-1,2,1,'#d4b890');}
        }
        if(attacking&&!reduced)for(let i=0;i<3;i++)r(c,-w-4-i*5,-2-i,4-i,1,'#d4b890');
    }
    if(loading && e.phase!=='recoil') {
        const wind=preparing?Math.min(1,e.timer/e.warningDuration):0;
        const lift=Math.min(1,wind/.42), release=Math.max(0,(wind-.72)/.28);
        const bx=Math.round(-w+(w-3)*lift+(w+3)*release);
        const by=Math.round((-e.height-3)-(8+(e.highThrow?5:0))*lift+(7+(e.highThrow?5:0))*release);
        line(c,w-3,top+12,bx+12,by+12,'#62463e',2);
        line(c,-w+3,top+12,bx+2,by+12,'#62463e',2);
        drawGuairaBarrel(c,bx,by);
        for(const hand of [bx-1,bx+12]){r(c,hand,by+12,3,3,shell[1]);r(c,hand,by+12,3,1,shell[3]);}
        if(preparing&&e.highThrow){line(c,w+4,top-13,w+8,top-17,'#f0d58f');line(c,w+8,top-17,w+12,top-13,'#f0d58f');}
    }
    if(sweeping){
        // Folded paddles become a bright, continuous barrier across the exact
        // native attack band, including its extension and retraction.
        const spin=reduced?0:Math.floor(e.timer/55)%8;
        const band=-e.height+9,reach=attacking?w+e.sweepReach:w-2;
        r(c,-w+2,top+2,e.width-4,4,attacking?'#bf704f':'#688b85');
        r(c,-w+3,top+2,e.width-6,1,attacking?'#f3bf76':'#b5d1b0');
        if(attacking){
            r(c,-reach,band+4,reach*2,4,'#63464a');r(c,-reach,band+4,reach*2,1,'#efb66f');
            for(const side of [-1,1]){
                const xx=side<0?-reach:reach-6;
                r(c,xx,band,6,12,'#a95e46');r(c,xx,band,6,2,'#f4d293');
                const shine=[0,1,2,3,4,3,2,1][spin];r(c,xx+shine,band+2,2,8,'#e7b779');
                r(c,xx+(side<0?0:4),band+4,2,5,'#de9460');
            }
            r(c,-4,band+2,8,8,'#73534a');r(c,-3,band+2,6,2,'#f0c88b');
            line(c,spin%2?-2:0,band+4,spin%2?2:0,band+8,'#f2d49a',2);
        }else{
            for(const side of [-1,1]){
                const xx=side<0?-w:w-5,raise=preparing?Math.min(5,Math.floor(e.timer/150)):0;
                r(c,xx,band+3-raise,5,8,'#617e77');r(c,xx,band+3-raise,4,2,'#c4c69b');
            }
            if(preparing){
                const edge=w+(e.canal?12:8);
                for(const side of [-1,1]){r(c,side*edge-(side<0?0:3),-2,3,2,'#e9bb78');r(c,side*edge,-4,1,2,'#e9bb78');}
            }
        }
    }
    if(riding){
        // A steel cradle and rolling wheels distinguish it from a walking crab.
        const open=!e.blocksStomp&&!e.dead,hinge=open?(reduced?3:Math.min(3,Math.floor(e.timer/50))):0;
        // Folded legs stay inside the cradle. The roof closes while rolling,
        // and the two panels retract during the real braking opportunity.
        for(const side of [-1,1])line(c,side*4,-10,side*8,-7,'#82aaa0',2);
        if(open){
            r(c,-6,top+1,12,7,'#354e52');r(c,-4,top+2,8,5,'#b9d5a4');r(c,-2,top+2,4,1,'#f0e0ac');
            for(const side of [-1,1]){const sx=side<0?-w-1:w-4;
                r(c,sx,top-hinge,5,7,'#465e5f');r(c,sx,top-hinge,5,1,'#c3cda4');
                r(c,sx+1,top+2-hinge,2,3,'#92aaa0');}
        }else{
            r(c,-w,top-1,e.width,9,'#354e52');r(c,-w+1,top,e.width-2,6,'#698b85');
            r(c,-w+3,top-2,e.width-6,2,'#bac9a4');r(c,-1,top,2,7,'#354e52');
            for(const xx of [-w+3,w-4])r(c,xx,top+3,2,1,'#d7d4ab');
        }
        r(c,-w,-7,e.width,5,'#465e5f');r(c,-w+1,-7,e.width-2,1,'#b9bd96');
        for(const xx of [-w+3,w-5]){line(c,xx,-9,xx+2,-7,'#263d48');line(c,xx+2,-9,xx,-7,'#b1bea1');}
        for(const xx of [-w+3,w-4]){
            r(c,xx-3,-5,7,5,'#283f48');r(c,xx-2,-5,5,1,'#9eb6aa');r(c,xx-2,-4,5,3,'#647d78');
            r(c,xx,-4,1,3,'#d0c9a0');r(c,xx-2,-3,5,1,'#d0c9a0');
            if(!reduced&&Math.floor(e.distance/3)%2)line(c,xx-1,-4,xx+1,-2,'#344e55');
        }
        r(c,-w-2,-6,3,3,'#ad9c73');r(c,w-1,-6,3,3,'#ad9c73');
        if(preparing){r(c,w-1,-6,4,2,'#dfad66');r(c,w+3,-5,2,1,'#f3d496');}
        if(preparing&&!reduced&&e.timer<150){const spread=Math.floor(e.timer/30);
            for(const side of [-1,1]){r(c,side*(w+2+spread),-2,2,1,'#e4c68a');r(c,side*(w+spread),-4,1,1,'#a7c1b0');}}
    }
    c.restore();
    if(e.dead)return;
    if(preparing) {
        const wy=y-(loading?20:10);
        if(riding){const mid=x+e.width/2;line(c,mid,wy-5,mid,wy-1,'#d8e6b5');line(c,mid-2,wy-3,mid,wy-1,'#d8e6b5');line(c,mid+2,wy-3,mid,wy-1,'#d8e6b5');}
        else pixelText(c,'!',x+e.width/2,wy-5,'#fff0b6',1,'center');
        const progress=Math.min(1,e.timer/e.warningDuration);
        r(c,x-1,wy+4,e.width+2,3,'#4c3d42');r(c,x,wy+5,Math.floor(e.width*(riding?1-progress:progress)),1,riding?'#b9d5a4':'#efbc6c');
        if(charging)pixelText(c,e.facing<0?'←':'→',x+e.width/2+e.facing*25,y+e.height-10,'#ffe1a0',1,'center');
        if(riding)pixelText(c,e.facing<0?'←':'→',x+e.width/2,y-19,'#d5e5c0',1,'center');
    }
    if(sweeping&&attacking)pixelText(c,'!',x+e.width/2,y-11,'#ffe0a0',1,'center');
    if(charging&&resting)pixelText(c,'...',x+e.width/2,y-7,'#d0e6c9',1,'center');
    if(e.spec.kind==='helmet'&&!e.armor&&e.phase==='stunned') {
        const t=Math.min(1,e.timer/700),dy=reduced?0:Math.round(-24*t+28*t*t),dx=reduced?-6:-6-Math.round(t*12);
        c.save();c.globalAlpha=reduced?1:Math.min(1,(1-t)*4);
        r(c,x+dx,y-8+dy,12,4,'#809285');r(c,x+dx+2,y-9+dy,8,2,'#dacb9e');
        r(c,x+dx+1,y-5+dy,10,1,'#556f6b');r(c,x+dx+5,y-8+dy,2,4,'#afbd98');c.restore();
    }
}
