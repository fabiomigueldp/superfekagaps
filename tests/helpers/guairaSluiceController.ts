import type {WorldGame} from '../../src/adventure/WorldGame';
import {GUAIRA_COURSES} from '../../src/adventure/experimental/guaira/GuairaCourseDesign';
import {jetCycle} from '../../src/adventure/WorldMachineState';
import {dockControls} from './guairaDockController';

/** Live observation and ordinary input only; waiting changes the hydraulic
 * phase naturally. The dry pier is a deliberate stop before the second jump. */
export function crossGuairaRiceLock(g:WorldGame,step:(keys:string[])=>void,route:'low'|'high'|'recover'|'return'='low'){
    const c=GUAIRA_COURSES.travessia,{brake,land}=dockControls(g,step);
    const outlet=g.objects.bodies.find(b=>b.id.endsWith(':lock-outlet'))!;
    brake();
    const walk=(target:number)=>{for(let n=0;n<220&&g.player.data.position.x<c.start+target&&!g.player.data.isDead;n++)step(['ArrowRight']);brake();};
    if(route!=='low'){
        for(const [x,y]of [[676,144],[772,96],[884,96]])if(!land(c.start+x,y))return false;
        if(route==='recover'){
            for(let n=0;n<240&&!(g.player.data.isGrounded&&g.player.data.position.y+g.player.data.height===c.floor);n++)step([]);
            if(!g.player.data.isGrounded)return false;
            return crossGuairaRiceLock(g,step);
        }
        for(const [x,y,guard]of [[976,48,0],[1038,48,1]])
            if(!land(c.start+x,y,guard?':maintenance:guard':undefined))return false;
        if(!land(c.start+1048,48))return false;
        for(let n=0;n<12;n++)step(['Space']);step(['ArrowDown']);
        for(let n=0;n<120&&!outlet.active;n++)step(['ArrowDown']);
        if(!outlet.active)return false;
        if(route==='return'){
            if(!land(c.start+1108,112,undefined,8)||!land(c.start+1048,48))return false;
            for(const [x,y]of [[976,48],[884,96],[772,96],[676,144],[624,192]])
                if(!land(c.start+x,y,undefined,y>g.player.data.position.y+g.player.data.height?8:24))return false;
            return crossGuairaRiceLock(g,step);
        }
        for(const [x,y]of [[1108,112],[1172,192]])if(!land(c.start+x,y,undefined,8))return false;
    }else{
        const bridge=g.objects.bodies.find(b=>b.id.endsWith(':course:bridge:784'))!;
        if(!bridge.active&&g.player.data.position.x<c.start+784){
            walk(712);
            for(let n=0;n<12;n++)step(['Space']);step(['ArrowDown']);
            for(let n=0;n<180&&(!bridge.active||Math.abs(bridge.y-c.floor)>1);n++)step([]);
            if(!bridge.active)return false;
        }
        walk(896);
        for(let n=0;n<300&&!outlet.active&&jetCycle(outlet,g.objects.time).phase!=='idle';n++)step([]);
        walk(940);
        if(!land(c.start+1076,c.floor,undefined,18))return false;
        walk(1152);
    }
    return !g.player.data.isDead;
}
