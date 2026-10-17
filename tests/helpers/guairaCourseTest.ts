import type { WorldGame } from '../../src/adventure/WorldGame';

/** The older hydraulic rehearsals end at the original district boundary.
 * They still prove that lesson, but no longer prove completion of the level. */
export function introductionReached(g: WorldGame) {
    const end: Record<string,[number,number]> = {
        'guaira-travessia':[1472,192], 'guaira-patio-comportas':[880,208],
        'guaira-respiros':[1088,304], 'guaira-subida':[1264,144],
        'guaira-galeria':[656,192], 'guaira-camara-alivio':[592,336],
    };
    const point=end[g.stage.id],p=g.player.data;
    return !!point&&!p.isDead&&p.isGrounded&&p.position.x>=point[0]&&Math.abs(p.position.y+p.height-point[1])<.01;
}

export function replayPrefix(runs: Array<[number,string[]]>, frames: number): Array<[number,string[]]> {
    const result:Array<[number,string[]]>=[];
    for(const[n,k]of runs){if(frames<=0)break;const count=Math.min(n,frames);result.push([count,k]);frames-=count;}
    return result;
}
