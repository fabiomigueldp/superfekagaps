import type {WorldGame} from '../../src/adventure/WorldGame';
import {GUAIRA_COURSES} from '../../src/adventure/experimental/guaira/GuairaCourseDesign';
import {jetCycleTick} from '../../src/adventure/WorldMachineState';
import {dockControls} from './guairaDockController';

/** Rehearsal controls only: the production movement, water, damage, terrain,
 * checkpoints and clocks are never modified by these route authors. */
export function crossGuairaAqueduct(g:WorldGame,step:(keys:string[])=>void){
    const c=GUAIRA_COURSES.subida,{brake,land}=dockControls(g,step);brake();
    for(let n=0;n<120&&g.player.data.position.x<c.start+2320;n++)step(['ArrowRight']);brake();
    for(const[x,y,guard]of [[2408,112,undefined],[2472,96,undefined],[2544,96,':helmet:2528'],
        [2584,96,undefined],[2664,64,undefined],[2760,48,undefined]] as const)
        if(!land(c.start+x,y,guard))return false;
    const loader=g.foes.find(e=>e.spec.id.endsWith(':loader:2880'))!;
    for(let n=0;n<180&&loader.phase!=='recoil';n++)step([]);
    for(let n=0;n<12;n++)step(['ArrowRight','ShiftLeft']);
    return land(c.start+2896,48,':loader:2880');
}

export function crossGuairaInspection(g:WorldGame,step:(keys:string[])=>void,tunnel:boolean){
    const c=GUAIRA_COURSES.galeria,{brake,land}=dockControls(g,step);brake();
    const walk=(local:number)=>{for(let n=0;n<300&&g.player.data.position.x<c.start+local&&!g.player.data.isDead;n++)step(['ArrowRight']);brake();};
    const valve=g.objects.bodies.find(b=>b.id.endsWith(':inspection-outlet:valve'))!;
    const jet=g.objects.get(valve.link!)!;
    walk(1864);
    if(tunnel){
        if(!land(c.start+1920,c.floor))return false;
        for(let n=0;n<12;n++)step(['Space']);
        for(let n=0;n<100&&g.player.data.position.y+g.player.data.height<c.floor+96;n++)step(['ArrowDown']);
        // The low ceiling shortens the jump. Approach the guard before taking
        // off; the open corridor's long running jump is not valid down here.
        walk(2056);
        const guard=g.foes.find(e=>e.spec.id.endsWith(':helmet:2112'))!;
        for(let n=0;n<180&&guard.x>c.start+2100;n++)step([]);
        if(!land(c.start+2128,c.floor+96,':helmet:2112'))return false;
        walk(2200);step([]);
        for(let n=0;n<12;n++)step(['Space']);
        for(let n=0;n<90&&!jet.active;n++)step(['ArrowDown']);
        if(!jet.active)return false;
        for(const [x,y]of [[2272,c.floor+64],[2328,c.floor+32],[2392,c.floor]])
            if(!land(c.start+x,y))return false;
    }else{
        if(!land(c.start+2016,c.floor))return false;
        walk(2048);
        // Wait from dry masonry until a full crossing fits the real cycle.
        for(let n=0;n<300&&jetCycleTick(jet,g.objects.time)>650&&jetCycleTick(jet,g.objects.time)<2540;n++)step([]);
        walk(2216);
        if(!land(c.start+2392,c.floor))return false;
    }
    walk(2440);
    const loader=g.foes.find(e=>e.spec.id.endsWith(':loader:2560'))!;
    for(let n=0;n<180&&loader.phase!=='recoil';n++)step([]);
    for(let n=0;n<12;n++)step(['ArrowRight','ShiftLeft']);
    return land(c.start+2576,c.floor,':loader:2560');
}
