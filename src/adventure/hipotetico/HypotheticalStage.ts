import { STAGES } from '../campaign';
import { TileType } from '../../constants';
import type { AdventureStage, FoeSpec } from '../types';
import type { HypotheticalAct } from './HypotheticalModel';
import { ARENA_BALCONIES, CHASE_GAPS, CHASE_STEPS, CHASE_TERRACES } from './HypotheticalLayout';

export function hypotheticalStage(act: HypotheticalAct): AdventureStage {
    const s = structuredClone(STAGES[0]);
    s.id = `hipotetico-${act}`; s.name = 'FLÁVIO BOLSONARO HIPOTÉTICO';
    s.subtitle = act === 'chase' ? 'A ponte do impossível' : act === 'siege' ? 'Cerco ao pátio' : 'O último lacre';
    s.encounter = 'J1'; s.world = 3;
    s.level.id = s.id; s.level.width = act === 'chase' ? 100 : 20; s.level.height = 18;
    s.level.originX = 0; s.level.originY = 0;
    s.level.tiles = Array.from({ length: 18 }, (_, y) => Array.from({ length: s.level.width }, () => y >= 14 ? TileType.GROUND : TileType.EMPTY));
    s.level.playerSpawn = { x: act === 'chase' ? 6 : 8, y: 14 };
    s.level.enemies = []; s.level.collectibles = []; s.level.triggers = []; s.level.checkpoints = [];
    s.level.goalPosition = { x: s.level.width - 2, y: 14 }; s.level.isBossLevel = false;
    s.foes = []; s.exits = []; s.checkpoints = []; s.dialogues = []; s.pickups = []; s.mechanisms = []; s.landmarks = []; s.route = [];
    if (act === 'chase') {
        // The safe lower road and optional loading terraces converge before the second gap.
        for (const col of CHASE_STEPS) s.level.tiles[13][col] = TileType.GROUND;
        for (const [from,to] of CHASE_GAPS) for(let col=from;col<to;col++) for(let y=14;y<18;y++) s.level.tiles[y][col]=TileType.EMPTY;
        s.mechanisms=CHASE_TERRACES.map(p=>({...p}));
        for (let i=0;i<18;i++) {
            const x=192+i*68, top=[592,660,1040].some(p=>Math.abs(p-x)<50)?164:185;
            s.pickups.push({id:`hipotetico:run:${i}`,kind:'coin',x,y:top});
        }
        for(const [i,[x,y]] of [[744,164],[814,134],[850,141],[922,164]].entries())
            s.pickups.push({id:`hipotetico:terrace:${i}`,kind:'coin',x,y});
        s.pickups.push({id:'hipotetico:run:helmet',kind:'helmet',x:832,y:138});
    } else {
        s.mechanisms = ARENA_BALCONIES.map(p=>({...p}));
        if (act === 'duel') s.mechanisms.push(
            { id: 'cable-left', kind: 'switch', x: 28, y: 214, width: 20, height: 10, link: 'cable-right' },
            { id: 'cable-right', kind: 'switch', x: 272, y: 214, width: 20, height: 10, link: 'cable-left' },
        );
    }
    return s;
}

export function hypotheticalWave(wave: number, playerX: number): FoeSpec[] {
    // Each entrance is announced; choosing the opposite side prevents spawning on Feka.
    const left = playerX > 160, x = left ? 14 : 282;
    const specs: FoeSpec['kind'][][] = [['minion','helmet'],['charger','loader'],['helmet','minion','loader']];
    return specs[Math.max(0,Math.min(2,wave-1))].map((kind,i) => ({ id:`hipotetico:wave:${wave}:${i}`,kind,
        // Throwers occupy their balcony instead of hiding underneath a one-way floor.
        x: kind==='loader'?(left?56:238):x+(left?1:-1)*i*36,
        // Infantry can cross the courtyard; the old spawn-centered leash left half the arena uncontested.
        y:kind==='loader'?(left?184:168):224, range:320, behavior:'canal' }));
}
