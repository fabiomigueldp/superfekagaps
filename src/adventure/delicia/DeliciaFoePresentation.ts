import type { DeliciaEnemy } from './DeliciaSimulation';

/** Mechanical events choose the pose; only its small idle motion uses the visual clock. */
export function deliciaFoePresentation(enemy:DeliciaEnemy,playerX:number,simulationTime:number):{pose:string;flip:boolean;dormant:boolean} {
    let pose:string=enemy.state;
    const dormant=enemy.kind==='mimic'&&Math.abs(enemy.x-playerX)>160;
    if(enemy.state==='walk'){
        if((enemy.kind==='bloom'||enemy.kind==='bottler')&&enemy.shotAt!==undefined&&simulationTime-enemy.shotAt>=0&&simulationTime-enemy.shotAt<.24)pose='attack';
        if(enemy.kind==='mimic'&&!dormant)pose='attack';
    }
    // Wasp motion follows its authored sine path, rather than its unused walking velocity.
    const flip=enemy.kind==='wasp'&&enemy.state!=='stun'?Math.cos(simulationTime*1.6+enemy.phase)>0:enemy.vx>0;
    return {pose,flip,dormant};
}
