import { STAGES } from '../../src/adventure/campaign';
import { TileType } from '../../src/constants';
import type { AdventureStage } from '../../src/adventure/types';

/** Painter-only fixture matching the measured contract; it is not a gameplay replay. */
export function respirosArtStage(): AdventureStage {
    const stage = structuredClone(STAGES[0]);
    stage.id = 'ART'; stage.name = 'PASSAGEM DOS RESPIROS';
    delete stage.encounter;
    Object.assign(stage.level, { width: 44, height: 24, originX: 0, originY: 0,
        tiles: Array.from({ length: 24 }, (_, y) => Array.from({ length: 44 }, () => y >= 19 ? TileType.GROUND : TileType.EMPTY)),
        playerSpawn: { x: 3, y: 19 }, enemies: [], collectibles: [], triggers: [], checkpoints: [],
        goalPosition: { x: 42, y: 19 }, isBossLevel: false });
    stage.mechanisms = [
        { id: 'proof-a', kind: 'jet', x: 160, y: 176, width: 96, height: 132, period: 4200, phase: 0 },
        { id: 'proof-b', kind: 'jet', x: 384, y: 176, width: 176, height: 132, period: 4200, phase: 2100 },
    ];
    stage.foes = []; stage.exits = []; stage.dialogues = []; stage.landmarks = []; stage.pickups = [];
    stage.checkpoints = [{ x: 19, y: 19 }]; stage.route = [];
    return stage;
}
