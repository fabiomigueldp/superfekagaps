import type { WorldGame } from '../../src/adventure/WorldGame';
import { GUAIRA_COURSES, type GuairaCourseId } from '../../src/adventure/experimental/guaira/GuairaCourseDesign';
import { jetCycleTick } from '../../src/adventure/WorldMachineState';
import { supportsStanding } from '../../src/world/tileRules';
import { TileType as T } from '../../src/constants';
import {crossGuairaTransfer,crossGuairaRiceBanks} from './guairaDockController';
import {crossGuairaAqueduct,crossGuairaInspection} from './guairaAqueductController';
import {crossGuairaRiceLock} from './guairaSluiceController';

/** Adaptive QA driver for recovery cases whose clocks differ from the fixed
 * complete tapes. It reads the scene and sends ordinary controls only. */
export function continueGuairaCourse(g:WorldGame&{finished:boolean},step:(keys:string[])=>void,maxFrames=5000){
    const ids:Record<string,GuairaCourseId>={'guaira-travessia':'travessia','guaira-patio-comportas':'patio','guaira-respiros':'respiros',
        'guaira-subida':'subida','guaira-galeria':'galeria','guaira-camara-alivio':'alivio'};
    const id=ids[g.stage.id],course=GUAIRA_COURSES[id];
    if(!course)throw Error('Guaíra course required');
    let jumpUntil=0,restUntil=0,poundAt=0,locked=false,frames=0,damage=0;
    for(;frames<maxFrames&&!g.finished&&!g.player.data.isDead;frames++){
        const p=g.player.data,x=p.position.x,feet=p.position.y+p.height;
        if(id==='travessia'&&x>=course.start+576&&x<course.start+784&&p.isGrounded&&feet===course.floor){
            const ok=crossGuairaRiceLock(g,keys=>{const helmet=g.player.data.hasHelmet;step(keys);frames++;if(helmet&&!g.player.data.hasHelmet)damage++;});
            if(!ok)break;
            jumpUntil=restUntil=poundAt=0;locked=false;continue;
        }
        if((id==='subida'&&x>=course.start+2272&&x<course.start+2352||id==='galeria'&&x>=course.start+1696&&x<course.start+1808)&&p.isGrounded){
            const advance=(keys:string[])=>{const helmet=g.player.data.hasHelmet;step(keys);frames++;if(helmet&&!g.player.data.hasHelmet)damage++;};
            const ok=id==='subida'?crossGuairaAqueduct(g,advance):crossGuairaInspection(g,advance,false);
            if(!ok)break;
            jumpUntil=restUntil=poundAt=0;locked=false;continue;
        }
        if(id==='travessia'&&x>=course.start+1808&&x<course.start+1904&&p.isGrounded){
            const ok=crossGuairaRiceBanks(g,keys=>{const helmet=g.player.data.hasHelmet;step(keys);frames++;if(helmet&&!g.player.data.hasHelmet)damage++;});
            if(!ok)break;
            jumpUntil=restUntil=poundAt=0;locked=false;continue;
        }
        if(id==='patio'&&x>=course.start+2016&&x<course.start+2176&&p.isGrounded){
            const result=crossGuairaTransfer(g,keys=>{const helmet=g.player.data.hasHelmet;step(keys);frames++;if(helmet&&!g.player.data.hasHelmet)damage++;});
            if(!result.ok)break;
            jumpUntil=restUntil=poundAt=0;locked=false;continue;
        }
        let keys=['ArrowRight','ShiftLeft'];
        if(frames<restUntil)keys=[];
        else if(poundAt&&frames>=poundAt){keys=['ArrowDown'];if(p.isGrounded){poundAt=0;jumpUntil=0;restUntil=frames+18;locked=false;}}
        else if(frames<jumpUntil)keys=[...(locked?[]:['ArrowRight','ShiftLeft']),'Space'];
        else if(locked){keys=p.velocity.x>.2?['ArrowLeft']:[];if(p.isGrounded){locked=false;restUntil=frames+8;}}
        else if(p.isGrounded){
            const plate=g.objects.bodies.find(b=>b.id.includes(':course:')&&b.kind==='switch'&&!b.active&&b.y+8===feet&&b.x-x<1&&b.x+b.width>x+7);
            const lid=id==='galeria'&&x>=course.start+224&&x<course.start+267&&feet===course.floor;
            if(plate||lid){locked=true;jumpUntil=frames+12;poundAt=frames+13;keys=['Space'];}
            else {
                const jet=g.objects.bodies.find(b=>b.kind==='jet'&&!b.active&&b.x+b.width>x&&b.x-(x+p.width)<(feet<course.floor?140:42)&&b.x>x);
                const tick=jet?jetCycleTick(jet,g.objects.time):0,crossMs=jet?(jet.width+Math.max(60,jet.x-x+24))/3.5*1000/60:0;
                if(jet&&feet>jet.y&&tick>1800-crossMs-180&&tick<2540){
                    keys=x+p.width>jet.x-4||x+p.width+Math.max(0,p.velocity.x*6)>jet.x-4&&p.velocity.x>.1?['ArrowLeft']:[];
                } else {
                    const col=g.level.worldToCol(x+p.width+16),row=g.level.worldToRow(feet+1);
                    const obstacle=g.level.getTile(col,g.level.worldToRow(feet-8));
                    const enemy=g.foes.find(e=>!e.dead&&e.x+e.width>x&&e.x-x<92&&e.x-x>8&&Math.abs(e.y+e.height-feet)<32);
                    const barrel=g.objects.barrels.find(b=>b.life>0&&b.x>x&&b.x-x<78&&b.y+16>=feet-24);
                    const bridge=g.objects.bodies.find(b=>b.kind==='lift'&&b.id.includes(':course:bridge')&&x+p.width+20>=b.x&&x<b.x);
                    const gap=!supportsStanding(g.level.getTile(col,row))&&!g.objects.bodies.some(b=>['lift','platform','support'].includes(b.kind)&&Math.abs(b.y-feet)<3&&x+p.width+16>=b.x&&x+p.width+16<b.x+b.width);
                    if(bridge&&(!bridge.active||Math.abs(bridge.y-bridge.to!.y)>1))keys=[];
                    else if(gap||enemy||barrel||supportsStanding(obstacle)&&obstacle!==T.PLATFORM&&obstacle!==T.PLATFORM_FALLING){
                        if(id==='galeria'&&x>=course.start+192&&x<course.start+272&&feet===course.floor)keys=['ArrowRight'];
                        else {jumpUntil=frames+24;keys.push('Space');}
                    }
                }
            }
        }
        if(id==='galeria'&&x>=course.start+260&&x<course.start+304&&feet<course.floor+80&&!p.isGrounded&&!poundAt)keys=[];
        // Leave room to jump again when a patrol occupies the far end of a
        // raised landing. Continuing to run can turn a safe landing into a side hit.
        if(!p.isGrounded&&!locked&&!poundAt&&p.velocity.y>0&&g.foes.some(e=>!e.dead&&e.y<course.floor-40&&feet<e.y&&e.x>x+p.width&&e.x-x<64)){
            locked=true;jumpUntil=0;keys=['ArrowLeft'];
        }
        // An enemy hop and the next channel are separate decisions. If the
        // projected landing lies in water while a bank is still below us,
        // release the run and land before committing to another jump.
        if(!p.isGrounded&&!locked&&!poundAt&&p.velocity.y>=-3&&p.velocity.x>1&&feet<course.floor){
            const fall=(-p.velocity.y+Math.sqrt(p.velocity.y*p.velocity.y+course.floor-feet))/.5;
            const row=g.level.worldToRow(course.floor+1),at=g.level.worldToCol(x+p.width/2),landing=g.level.worldToCol(x+p.width/2+p.velocity.x*fall);
            if(supportsStanding(g.level.getTile(at,row))&&!supportsStanding(g.level.getTile(landing,row))&&landing<g.level.data.width){locked=true;keys=['ArrowLeft'];jumpUntil=0;}
        }
        if(!p.isGrounded&&frames>=jumpUntil&&p.velocity.y<0&&g.foes.some(e=>e.dead&&e.deadTimer<120)){locked=true;keys=[];}
        const helmet=p.hasHelmet;step(keys);if(helmet&&!g.player.data.hasHelmet)damage++;
    }
    return {frames,damage,dead:g.player.data.isDead,finished:g.finished};
}
