import { STAGES } from '../../../campaign';
import { TileType } from '../../../../constants';
import type { AdventureStage } from '../../../types';

export const GUAIRA_RESPIROS = Object.freeze({
    id: 'guaira-respiros', width: 72, height: 24, floor: 304,
    spawnX: 48, checkpointX: 304, finishX: 1088, period: 4200, secondPhase: 1200,
    firstJetId: 'guaira-respiro-a', secondJetId: 'guaira-respiro-b',
    firstStart: 160, firstEnd: 256, secondStart: 384, secondEnd: 560,
    finalCheckpointX: 624, thirdJetId: 'guaira-respiro-c', fourthJetId: 'guaira-respiro-d',
    thirdStart: 704, thirdEnd: 784, fourthStart: 880, fourthEnd: 992,
    finalRefugeX: 816, thirdPhase: 600, fourthPhase: 2700,
    shelfStart: 576, shelfEnd: 608, shelfTop: 288,
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
    // Optional maintenance shelf: native one-way tiles, with a dry floor underneath.
    for (let col = G.shelfStart / 16; col < G.shelfEnd / 16; col++) stage.level.tiles[G.shelfTop / 16][col] = TileType.PLATFORM;
    stage.level.playerSpawn = { x: G.spawnX / 16, y: G.floor / 16 };
    stage.level.enemies = []; stage.level.collectibles = []; stage.level.triggers = [];
    stage.level.checkpoints = []; stage.level.goalPosition = { x: G.finishX / 16, y: G.floor / 16 }; stage.level.isBossLevel = false;
    stage.mechanisms = [
        { id: G.firstJetId, kind: 'jet', x: G.firstStart, y: G.jetTop, width: G.firstEnd - G.firstStart,
            height: G.jetHeight, period: G.period, phase: 0 },
        { id: G.secondJetId, kind: 'jet', x: G.secondStart, y: G.jetTop, width: G.secondEnd - G.secondStart,
            // After observing A, walking to the refuge arrives before B charges.
            // Its full warning can be watched from safety before the longer crossing.
            height: G.jetHeight, period: G.period, phase: G.secondPhase },
        { id: G.thirdJetId, kind: 'jet', x: G.thirdStart, y: G.jetTop, width: G.thirdEnd - G.thirdStart,
            height: G.jetHeight, period: G.period, phase: G.thirdPhase },
        { id: G.fourthJetId, kind: 'jet', x: G.fourthStart, y: G.jetTop, width: G.fourthEnd - G.fourthStart,
            height: G.jetHeight, period: G.period, phase: G.fourthPhase }
    ];
    stage.foes = []; stage.exits = []; stage.dialogues = []; stage.landmarks = []; stage.pickups = [
        { id: 'respiros-shelf-a', kind: 'coin', x: 584, y: 252 },
        { id: 'respiros-shelf-b', kind: 'coin', x: 600, y: 252 }
    ];
    stage.checkpoints = [G.checkpointX, G.finalCheckpointX].map(x => ({ x: x / 16, y: G.floor / 16 }));
    stage.route = [{ x: G.spawnX, y: G.floor }, { x: G.checkpointX, y: G.floor }, { x: G.finalCheckpointX, y: G.floor }, { x: G.finalRefugeX, y: G.floor }, { x: G.finishX, y: G.floor }];
    return stage;
}
