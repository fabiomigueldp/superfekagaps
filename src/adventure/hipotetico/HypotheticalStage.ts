import { STAGES } from '../campaign';
import { TileType } from '../../constants';
import type { AdventureStage } from '../types';
import type { HypotheticalAct } from './HypotheticalModel';
import { ARENA_BALCONIES, CHASE_GAPS, CHASE_STEPS, CHASE_TERRACES, CHASE_WIDTH, CHASE_CHECKPOINT } from './HypotheticalLayout';
import { SIEGE_SECTORS, SIEGE_WIDTH, SIEGE_LINKS, SIEGE_APPROACH, SIEGE_SIDE_ROUTES, SIEGE_CARGO_LIFT, siegeGarrison } from './HypotheticalSiege';
import {ARRIVAL} from './HypotheticalArrival';

export function hypotheticalStage(act: HypotheticalAct): AdventureStage {
    const s = structuredClone(STAGES[0]);
    s.id = `hipotetico-${act}`; s.name = 'FLÁVIO BOLSONARO HIPOTÉTICO';
    s.subtitle = act === 'chase' ? 'A ponte do impossível' : act === 'siege' ? 'A travessia do arsenal' : 'O último lacre';
    s.encounter = 'J1'; s.world = 3;
    s.level.id = s.id; s.level.width = act === 'chase' ? CHASE_WIDTH/16 : act === 'siege' ? SIEGE_WIDTH / 16 : 20; s.level.height = 18;
    s.level.originX = 0; s.level.originY = 0;
    s.level.tiles = Array.from({ length: 18 }, (_, y) => Array.from({ length: s.level.width }, () => y >= 14 ? TileType.GROUND : TileType.EMPTY));
    s.level.playerSpawn = { x: act === 'chase' ? 6 : act === 'siege' ? 3 : 8, y: 14 };
    s.level.enemies = []; s.level.collectibles = []; s.level.triggers = []; s.level.checkpoints = [];
    s.level.goalPosition = { x: s.level.width - 2, y: 14 }; s.level.isBossLevel = false;
    s.foes = []; s.exits = []; s.checkpoints = []; s.dialogues = []; s.pickups = []; s.mechanisms = []; s.landmarks = []; s.route = [];
    if (act === 'chase') {
        // Continuous lower route with three optional loading/scaffold routes.
        for (const col of CHASE_STEPS) s.level.tiles[13][col] = TileType.GROUND;
        for (const [from,to] of CHASE_GAPS) for(let col=from;col<to;col++) for(let y=14;y<18;y++) s.level.tiles[y][col]=TileType.EMPTY;
        s.mechanisms=CHASE_TERRACES.map(p=>({...p}));
        for (let i=0;i<18;i++) {
            const x=192+i*68, top=[592,660,1040].some(p=>Math.abs(p-x)<50)?164:185;
            s.pickups.push({id:`hipotetico:run:${i}`,kind:'coin',x,y:top});
        }
        for(const [i,[x,y]] of [[776,136],[814,118],[850,141],[922,94]].entries())
            s.pickups.push({id:`hipotetico:terrace:${i}`,kind:'coin',x,y});
        s.pickups.push({id:'hipotetico:run:helmet',kind:'helmet',x:832,y:138});
        for(const [i,[from,to]] of CHASE_GAPS.entries())if(i>=2)
            for(const [j,t] of [.15,.5,.85].entries())s.pickups.push({id:`hipotetico:span:${i}:${j}`,kind:'coin',x:from*16+(to-from)*16*t,y:174-Math.sin(t*Math.PI)*18});
        for(const [i,p] of CHASE_TERRACES.entries())if(i>=3)
            s.pickups.push({id:`hipotetico:terrace:${i+1}`,kind:'coin',x:p.x+p.width/2,y:p.y-26});
        s.pickups.push({id:'hipotetico:mid:helmet',kind:'helmet',x:CHASE_CHECKPOINT+32,y:193});
    } else if (act === 'siege') {
        s.mechanisms.push({id:'arrival-forecourt',kind:'target',x:ARRIVAL.firstGateX,y:ARRIVAL.gateY,width:12,height:ARRIVAL.gateHeight,gated:true});
        s.mechanisms.push({id:'arrival-gate',kind:'target',x:ARRIVAL.gateX,y:ARRIVAL.gateY,width:12,height:ARRIVAL.gateHeight,gated:true});
        for (const [i, sector] of SIEGE_SECTORS.entries()) {
            s.foes.push(...siegeGarrison(i));
            s.mechanisms.push(...sector.platforms.map((p,j)=>i===1&&j===1?structuredClone(SIEGE_CARGO_LIFT)
                :({...p, id:`siege-scaffold-${i}-${j}`,kind:'support' as const,height:7})),
                {id:`siege-gate-${i}`,kind:'target',x:sector.gate,y:0,width:16,height:224,gated:true});
            for (const [j,p] of sector.platforms.entries())
                s.pickups.push({id:`hipotetico:route:${i}:${j}`,kind:'coin',x:p.x+12,y:i===1&&j===1?126:p.y-22});
        }
        s.mechanisms.push(...SIEGE_LINKS.map(p=>({...p})),...SIEGE_SIDE_ROUTES.map(p=>structuredClone(p)));
        for(const [i,p] of SIEGE_SIDE_ROUTES.entries())
            for(const [j,dx] of [9,25].entries())s.pickups.push({id:`hipotetico:flank:${i}:${j}`,kind:'coin',x:p.x+dx,y:p.y-22});
        for(const [i,x] of [396,434,816,854].entries())
            s.pickups.push({id:`hipotetico:link:${i}`,kind:'coin',x:x+SIEGE_APPROACH,y:i%2?138:158});
        s.pickups.push({id:'hipotetico:siege:helmet',kind:'helmet',x:900+SIEGE_APPROACH,y:158});
        s.pickups.push({id:'hipotetico:bastion:helmet',kind:'helmet',x:1532,y:194});
        for(const [i,x] of [1484,1524].entries())
            s.pickups.push({id:`hipotetico:bastion:approach:${i}`,kind:'coin',x,y:i?146:160});
    } else {
        s.mechanisms = ARENA_BALCONIES.map(p=>({...p}));
        if (act === 'duel') s.mechanisms.push(
            { id: 'cable-left', kind: 'switch', x: 28, y: 214, width: 20, height: 10, link: 'cable-right' },
            { id: 'cable-right', kind: 'switch', x: 272, y: 214, width: 20, height: 10, link: 'cable-left' },
        );
    }
    return s;
}
