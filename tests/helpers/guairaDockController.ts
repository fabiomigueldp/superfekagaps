import type {WorldGame} from '../../src/adventure/WorldGame';
import {GUAIRA_COURSES} from '../../src/adventure/experimental/guaira/GuairaCourseDesign';

/** QA controls only. Targets are read from live supports; the native player,
 * platform motors, collisions, damage and clocks remain untouched. */
export function dockControls(g:WorldGame,step:(keys:string[])=>void){
    const brake=()=>{for(let n=0;n<30&&Math.abs(g.player.data.velocity.x)>.35;n++)
        step(g.player.data.velocity.x>0?['ArrowLeft']:['ArrowRight']);
        for(let n=0;n<12&&Math.abs(g.player.data.velocity.x)>.03;n++)step([]);};
    const land=(x:number,y:number|(()=>number),guardId?:string,hold=24)=>{
        step([]);let airborne=false,jumped=0;
        for(let n=0;n<300&&!g.player.data.isDead;n++){
            const p=g.player.data,guard=guardId?g.foes.find(e=>!e.dead&&e.spec.id.endsWith(guardId)):undefined;
            const target=guard?guard.x+guard.width/2:x,top=typeof y==='number'?y:y();
            const feet=p.position.y+p.height,dx=target-p.position.x-p.width/2,v=p.velocity.x;
            if(p.isGrounded&&Math.abs(feet-top)<1&&Math.abs(dx)<8&&!guard){brake();return true;}
            let keys:string[]=[];
            if(dx>3)keys=v>0&&dx<v*v/.6*.65?['ArrowLeft']:['ArrowRight',...(dx>42?['ShiftLeft']:[])];
            if(dx< -3)keys=v<0&&-dx<v*v/.6*.65?['ArrowRight']:['ArrowLeft',...(dx< -42?['ShiftLeft']:[])];
            if(!airborne&&p.isGrounded&&(Math.abs(feet-top)>1||Math.abs(dx)>30||guard)){keys.push('Space');airborne=true;jumped=n;}
            else if(airborne&&!p.isGrounded&&n-jumped<hold)keys.push('Space');
            else if(p.isGrounded)airborne=false;
            if(guard&&Math.abs(dx)<18&&feet<guard.y&&p.velocity.y>=0)keys=keys.filter(k=>k!=='Space').concat('ArrowDown');
            step(keys);
        }
        return false;
    };
    return {brake,land};
}

export function crossGuairaTransfer(g:WorldGame,step:(keys:string[])=>void){
    const c=GUAIRA_COURSES.patio,{brake,land}=dockControls(g,step),marks:string[]=[];
    brake();
    const ride=(name:'a'|'b',centre:number)=>{
        const body=g.objects.bodies.find(b=>b.id.endsWith(':transfer-'+name))!;
        for(let n=0;n<450;n++){
            if((name==='a'?body.y>=c.floor+16:body.y<=c.floor-16)&&body.y<=body.py)break;
            step([]);
        }
        if(!land(c.start+centre,()=>body.y))return false;
        marks.push('board-'+name);
        // Use the actual ascending motor to gain the next receiving bank.
        for(let n=0;n<450&&body.y>c.floor-32;n++)step([]);
        marks.push('ride-'+name);return true;
    };
    if(g.player.data.position.x<c.start+2336){
        if(!land(c.start+2144,c.floor))return {ok:false,marks};
        if(!ride('a',2224))return {ok:false,marks};
        if(!land(c.start+2360,c.floor-48))return {ok:false,marks};marks.push('island');
    }
    if(!ride('b',2480))return {ok:false,marks};
    if(!land(c.start+2552,c.floor-48))return {ok:false,marks};marks.push('bank');
    for(let n=0;n<160&&g.player.data.position.x<c.start+2640&&!g.player.data.isDead;n++)step(['ArrowRight']);
    brake();
    return {ok:true,marks};
}

export function crossGuairaWarehouse(g:WorldGame,step:(keys:string[])=>void){
    const c=GUAIRA_COURSES.travessia,{brake,land}=dockControls(g,step);brake();
    for(const [x,y,guard]of [[1960,c.floor-48,0],[2104,c.floor-96,1],[2224,c.floor-96,0],
        [2360,c.floor-96,0],[2384,c.floor-96,0]])
        if(!land(c.start+x,y,guard?':helmet:2096':undefined))return false;
    for(let n=0;n<160&&g.player.data.position.x<c.start+2544&&!g.player.data.isDead;n++)step(['ArrowRight']);
    brake();
    return true;
}

export function crossGuairaRiceBanks(g:WorldGame,step:(keys:string[])=>void){
    const c=GUAIRA_COURSES.travessia,{brake,land}=dockControls(g,step);brake();
    const walk=(local:number)=>{for(let n=0;n<240&&g.player.data.position.x<c.start+local&&!g.player.data.isDead;n++)step(['ArrowRight','ShiftLeft']);brake();};
    walk(1960);
    if(!land(c.start+2060,c.floor,':loader:2048',12))return false;
    walk(2144);
    if(!land(c.start+2264,c.floor,undefined,12))return false;
    walk(2280);
    return land(c.start+2424,c.floor,undefined,12);
}
