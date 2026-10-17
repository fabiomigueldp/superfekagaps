import type {WorldGame} from '../../src/adventure/WorldGame';
import {GUAIRA_COURSES} from '../../src/adventure/experimental/guaira/GuairaCourseDesign';
import {continueGuairaCourse} from './guairaCourseController';

/** QA authoring only. Feedback controls use the live scene; all movement,
 * boarding, combat and valve activation remain ordinary native inputs. */
export function playGuairaFinale(g:WorldGame&{finished:boolean},id:'respiros'|'alivio',high:boolean,step:(keys:string[])=>void,wait=0){
    const c=GUAIRA_COURSES[id],marks:Array<{label:string;x:number;feet:number}>=[];
    const at=(label:string)=>{const p=g.player.data;marks.push({label,x:p.position.x,feet:p.position.y+p.height});};
    const brake=()=>{for(let i=0;i<30;i++){const p=g.player.data;if(Math.abs(p.velocity.x)<.1)break;step(p.velocity.x>0?['ArrowLeft']:['ArrowRight']);}};
    brake();for(let i=0;i<wait;i++)step([]);at('observe');
    const land=(local:number,y:number,attack=false)=>{
        step([]);let airborne=false,jumpStart=0;
        for(let n=0;n<240&&!g.player.data.isDead;n++){
            const guard=attack?g.foes.find(e=>!e.dead&&e.spec.id.includes(':course:helmet:1904')):undefined;
            const target=guard?guard.x+guard.width/2:c.start+local,p=g.player.data,feet=p.position.y+p.height;
            const dx=target-p.position.x-p.width/2,v=p.velocity.x;
            if(p.isGrounded&&Math.abs(feet-y)<1&&Math.abs(dx)<9&&!guard){at('land-'+local);return true;}
            let keys:string[]=[];
            if(dx>3)keys=v>0&&dx<v*v/.6*.65?['ArrowLeft']:['ArrowRight',...(dx>42?['ShiftLeft']:[])];
            if(dx< -3)keys=v<0&&-dx<v*v/.6*.65?['ArrowRight']:['ArrowLeft',...(dx< -42?['ShiftLeft']:[])];
            if(!airborne&&p.isGrounded&&(feet!==y||Math.abs(dx)>30||guard)){keys.push('Space');airborne=true;jumpStart=n;}
            else if(airborne&&!p.isGrounded&&n-jumpStart<24)keys.push('Space');
            else if(p.isGrounded)airborne=false;
            if(guard&&Math.abs(dx)<18&&feet<guard.y&&p.velocity.y>=0)keys=keys.filter(k=>k!=='Space').concat('ArrowDown');
            step(keys);
        }
        at('miss-'+local);return false;
    };
    if(high&&id==='respiros'){
        if(!land(2504,c.floor-48))return {marks,failed:'dock'};
        brake();
        const body=g.objects.bodies.find(b=>b.id.endsWith(':pump-carriage'))!;
        for(let n=0;n<650&&body.x>c.start+2544;n++)step([]);
        at('boarding');
        for(let n=0;n<120;n++){
            const p=g.player.data;
            if(p.isGrounded&&p.position.x>=c.start+2544&&p.position.x+p.width>body.x&&p.position.x<body.x+body.width)break;
            step(['ArrowRight']);
        }
        brake();at('aboard');
        for(let n=0;n<650&&body.x<c.start+2796;n++)step([]);
        at('arrival');if(!land(2864,c.floor-48))return {marks,failed:'arrival'};
    }else if(high){
        for(const[x,y,attack]of [[1712,c.floor-64,0],[1824,c.floor-128,0],[1912,c.floor-128,1],[1936,c.floor-128,0]])
            if(!land(x,y,!!attack))return {marks,failed:'platform-'+x};
        const valve=g.objects.bodies.find(b=>b.id.endsWith(':counterpressure-b:valve'))!;
        if(!valve.active){
            brake();step(['Space']);for(let n=0;n<12;n++)step(['Space']);
            for(let n=0;n<100&&!valve.active;n++)step(['ArrowDown']);
        }
        at('valve');if(!valve.active)return {marks,failed:'valve'};
        if(!land(2096,c.floor-48))return {marks,failed:'descent'};
    }
    const result=continueGuairaCourse(g,step);at('finish');return {marks,result};
}
