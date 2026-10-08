import test from 'node:test';
import assert from 'node:assert/strict';
import { ALL_DELICIA_STAGES } from '../src/adventure/delicia/DeliciaContent';
import { DeliciaSimulation, movingFloor, noDeliciaInput } from '../src/adventure/delicia/DeliciaSimulation';

test('all 36 upper seals have a physical route using the authored spring, jet, lift or held jump',()=>{
    let reached=0;
    for(const original of ALL_DELICIA_STAGES.filter(s=>!s.boss))for(const seal of original.pickups.filter(p=>p.kind==='seal')){
        // Individual geometry challenges start at the preceding checkpoint. Enemy
        // combat is exercised separately by campaign replays; no position warps
        // or velocity assignments happen after this challenge starts.
        const stage=structuredClone(original);stage.enemies=[];stage.hazards=stage.hazards.filter(h=>h.kind==='juice');stage.machines=stage.machines?.filter(m=>m.kind!=='press');
        const ground=stage.floors.find(f=>f.h>50&&f.x<seal.x&&f.x+f.w>seal.x)!;
        const upper=stage.floors.find(f=>f.h<50&&f.x<seal.x&&f.x+f.w>seal.x&&f.y<ground.y)!;
        const carrier=stage.floors.find(f=>['spring','lift'].includes(f.kind??'')&&f.x>ground.x&&f.x<upper.x);
        const jet=stage.machines?.find(m=>m.kind==='jet'&&m.x>ground.x&&m.x<ground.x+ground.w);
        stage.spawn={x:ground.x+105,y:ground.y-72};
        const sim=new DeliciaSimulation(stage);for(const valve of stage.valves.filter(v=>v.x<ground.x))sim.valves.add(valve.id);
        let reward=!carrier&&!jet,hold=0,wasHeld=false;
        for(let frame=0;frame<1800&&!sim.collected.has(seal.id)&&!sim.dead;frame++){
            const p=sim.player,feet=p.y+p.h,pose=carrier?movingFloor(carrier,sim.time):null;
            let jump=false;
            if(!reward){
                if(jet&&p.vy<-1800||carrier?.kind==='spring'&&p.vy<-2000)reward=true;
                if(carrier?.kind==='lift'&&p.grounded&&Math.abs(feet-pose!.y)<5&&feet<upper.y+160){reward=true;jump=true;}
            }
            const target=reward?seal.x-p.w/2:jet?jet.x+jet.w/2-p.w/2:pose!.x+pose!.w/2-p.w/2;
            const delta=target-p.x;
            if(p.grounded){
                if(reward&&feet>upper.y+4)jump=true;
                else if(!jet&&carrier&&Math.abs(delta)<65&&feet>pose!.y+3&&feet-pose!.y<220)jump=true;
            }
            if(jump)hold=30;const held=hold-->0;
            sim.update(1/60,{...noDeliciaInput(),right:delta>7,left:delta<-7,jump:held,jumpPressed:jump,jumpReleased:wasHeld&&!held,interact:true});wasHeld=held;
        }
        assert.ok(sim.collected.has(seal.id),`${seal.id}: x=${sim.player.x.toFixed(0)}, y=${sim.player.y.toFixed(0)}, target=${seal.x},${seal.y}, carrier=${carrier?.kind}, phase=${reward}`);
        assert.equal(sim.damageTaken,0,`${seal.id}: reward route must not require a damage boost`);reached++;
    }
    assert.equal(reached,36);
});
