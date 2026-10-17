import type {WorldGame} from '../../src/adventure/WorldGame';
import {GUAIRA_COURSES,GUAIRA_MAINTENANCE_ROUTES} from '../../src/adventure/experimental/guaira/GuairaCourseDesign';
import {dockControls} from './guairaDockController';

/** Native controls for a later maintenance route; no scene state is written. */
export function crossGuairaMaintenance(g:WorldGame,step:(keys:string[])=>void,id:'respiros'|'alivio'){
    const c=GUAIRA_COURSES[id],d=GUAIRA_MAINTENANCE_ROUTES[id]!,{brake,land}=dockControls(g,step);
    brake();
    for(const [left,right,y]of d.decks.slice(0,2))if(!land(c.start+(left+right)/2,y))return false;
    // A wide fixed landing is provided before either machine. Arrival time
    // changes the wait, never the player's physics or the enemy's phase.
    if(!land(c.start+d.decks[2][0]+20,d.top))return false;
    const guard=g.foes.find(e=>e.spec.id.endsWith(':maintenance:guard'))!;
    if(id==='respiros')for(let n=0;n<300&&(guard.phase!=='rest'||guard.timer>500);n++)step([]);
    else for(let n=0;n<300&&!(guard.phase==='warning'&&guard.x<=guard.homeX-d.guard.range+1&&guard.timer<200);n++)step([]);
    if(!land(c.start+d.guard.x+12,d.top,':maintenance:guard',12))return false;
    if(!land(c.start+d.valve+16,d.top))return false;
    const outlet=g.objects.bodies.find(b=>b.id.endsWith(':course:'+d.outlet))!;
    for(let n=0;n<12;n++)step(['Space']);
    for(let n=0;n<100&&!outlet.active&&!g.player.data.isDead;n++)step(['ArrowDown']);brake();
    if(!outlet.active)return false;
    for(const [left,right,y]of d.returns)if(!land(c.start+(left+right)/2,y,undefined,8))return false;
    for(let n=0;n<100&&g.player.data.position.x<c.start+d.end&&!g.player.data.isDead;n++)step(['ArrowRight']);brake();
    return !g.player.data.isDead;
}
