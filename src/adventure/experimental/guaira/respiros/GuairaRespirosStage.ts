import { STAGES } from '../../../campaign';
import { TileType } from '../../../../constants';
import type { AdventureStage } from '../../../types';

export const GUAIRA_RESPIROS = Object.freeze({
    id: 'guaira-respiros', width: 44, height: 24, floor: 304,
    spawnX: 48, checkpointX: 304, finishX: 656, period: 4200,
    firstJetId: 'guaira-respiro-a', secondJetId: 'guaira-respiro-b',
    firstStart: 160, firstEnd: 256, secondStart: 384, secondEnd: 560,
    jetTop: 176, jetHeight: 132, mapHref: './guaira.html?at=rice', bossHref: './guaira-lab.html'
});

/** Isolated authored clone: never adds a campaign stage, exit or saved unlock. */
export function guairaRespirosStage(): AdventureStage {
    const G = GUAIRA_RESPIROS, stage = structuredClone(STAGES[0]);
    stage.id = G.id; stage.name = 'GUAÍRA · PASSAGEM DOS RESPIROS';
    stage.subtitle = 'Galeria de inspeção do arrozal · localidade fictícia';
    delete stage.encounter;
    stage.level.id = 'experimental-guaira-respiros';
    stage.level.width = G.width; stage.level.height = G.height;
    stage.level.originX = 0; stage.level.originY = 0;
    stage.level.tiles = Array.from({ length: G.height }, (_, y) =>
        Array.from({ length: G.width }, () => y >= G.floor / 16 ? TileType.GROUND : TileType.EMPTY));
    stage.level.playerSpawn = { x: G.spawnX / 16, y: G.floor / 16 };
    stage.level.enemies = []; stage.level.collectibles = []; stage.level.triggers = [];
    stage.level.checkpoints = []; stage.level.goalPosition = { x: 42, y: G.floor / 16 }; stage.level.isBossLevel = false;
    stage.mechanisms = [
        { id: G.firstJetId, kind: 'jet', x: G.firstStart, y: G.jetTop, width: G.firstEnd - G.firstStart,
            height: G.jetHeight, period: G.period, phase: 0 },
        { id: G.secondJetId, kind: 'jet', x: G.secondStart, y: G.jetTop, width: G.secondEnd - G.secondStart,
            height: G.jetHeight, period: G.period, phase: G.period / 2 }
    ];
    stage.foes = []; stage.exits = []; stage.dialogues = []; stage.landmarks = []; stage.pickups = [];
    stage.checkpoints = [{ x: G.checkpointX / 16, y: G.floor / 16 }];
    stage.route = [{ x: G.spawnX, y: G.floor }, { x: G.checkpointX, y: G.floor }, { x: G.finishX, y: G.floor }];
    return stage;
}
