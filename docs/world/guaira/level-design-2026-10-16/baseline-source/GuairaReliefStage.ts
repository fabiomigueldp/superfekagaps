import { STAGES } from '../../../campaign';
import { TileType as T } from '../../../../constants';
import type { AdventureStage } from '../../../types';
import type { WorldLevel } from '../../../WorldPhysics';

export const GUAIRA_RELIEF = Object.freeze({
    id: 'guaira-camara-alivio', width: 40, height: 24, floor: 336,
    spawnX: 32, checkpointX: 80, finishX: 592,
    lidStart: 240, lidEnd: 288, lidY: 160,
    jetId: 'relief-service-grate', jetStart: 384, jetEnd: 512, period: 4200, phase: 3300,
});

/** One actual hole releases the pressure; native pound and head hits both count. */
export function reliefOpen(level: WorldLevel) {
    const g = GUAIRA_RELIEF;
    for (let col = g.lidStart / 16; col < g.lidEnd / 16; col++)
        if (level.getTile(col, g.lidY / 16) === T.EMPTY) return true;
    return false;
}

/** A new attempt or checkpoint rebuild restores the obstruction and full jet cycle. */
export function guairaReliefStage(): AdventureStage {
    const g = GUAIRA_RELIEF, stage = structuredClone(STAGES[0]);
    stage.id = g.id; stage.name = 'GUAÍRA · CÂMARA DE ALÍVIO';
    stage.subtitle = 'Passar no intervalo ou abrir o alívio · protótipo isolado';
    delete stage.encounter;
    stage.level.id = 'experimental-guaira-relief';
    stage.level.width = g.width; stage.level.height = g.height;
    stage.level.originX = 0; stage.level.originY = 0;
    stage.level.tiles = Array.from({ length: g.height }, (_, row) => Array.from({ length: g.width }, (_, col) => {
        if (row >= g.floor / 16) return T.GROUND;
        if (row === 18 && col >= 7 && col < 11 || row === 14 && col >= 10 && col < 18 ||
            row === 10 && col === 14) return T.PLATFORM;
        if (row === 10 && col >= 15 && col < 18) return T.BRICK_BREAKABLE;
        return T.EMPTY;
    }));
    stage.level.playerSpawn = { x: g.spawnX / 16, y: g.floor / 16 };
    stage.level.enemies = []; stage.level.collectibles = []; stage.level.triggers = [];
    stage.level.checkpoints = []; stage.level.goalPosition = { x: g.finishX / 16, y: g.floor / 16 };
    stage.level.isBossLevel = false;
    stage.mechanisms = [{ id: g.jetId, kind: 'jet', x: g.jetStart, y: g.floor - 128,
        width: g.jetEnd - g.jetStart, height: 132, period: g.period, phase: g.phase }];
    stage.foes = []; stage.exits = []; stage.dialogues = []; stage.landmarks = []; stage.pickups = [];
    stage.checkpoints = [{ x: g.checkpointX / 16, y: g.floor / 16 }];
    stage.route = [{ x: g.spawnX, y: g.floor }, { x: g.checkpointX, y: g.floor },
        { x: 336, y: g.floor }, { x: g.finishX, y: g.floor }];
    return stage;
}
