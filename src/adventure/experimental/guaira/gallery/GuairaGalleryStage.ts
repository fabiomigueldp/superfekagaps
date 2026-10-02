import { STAGES } from '../../../campaign';
import { TileType as T } from '../../../../constants';
import type { AdventureStage } from '../../../types';

export const GUAIRA_GALLERY = Object.freeze({
    id: 'guaira-galeria', width: 44, height: 27, spawnX: 48, entryY: 176,
    firstStart: 160, firstEnd: 208, firstY: 176, firstLandingY: 240,
    checkpointX: 320, galleryY: 288,
    secondStart: 384, secondEnd: 432, secondY: 288, secondLandingY: 336,
    lowerY: 384, terraceY: 192, finishX: 656, mapHref: './guaira.html?at=town'
});

/** The checkpoint is a canonical local rebuild, not a saved copy of mutable tiles. */
export function guairaGalleryStage(firstOpened = false): AdventureStage {
    const G = GUAIRA_GALLERY, stage = structuredClone(STAGES[0]);
    stage.id = G.id; stage.name = 'GUAÍRA · GALERIA DOS REMENDOS';
    stage.subtitle = 'Acesso de serviço da Estrada do Vento · protótipo';
    delete stage.encounter;
    stage.level.id = 'experimental-guaira-galeria';
    stage.level.width = G.width; stage.level.height = G.height;
    stage.level.originX = 0; stage.level.originY = 0;
    stage.level.tiles = Array.from({ length: G.height }, (_, y) => Array.from({ length: G.width }, (_, x) => {
        if (x < 10 && y >= 11 || x >= 10 && x < 24 && y >= 18 || x >= 24 && y >= 24 ||
            x === 14 && y < 15 || x === 28 && y < 21 || x === 13 && y === 11 || x === 27 && y === 18 ||
            x >= 31 && x < 33 && y >= 21 || x >= 33 && x < 35 && y >= 18 ||
            x >= 35 && x < 38 && y >= 15 || x >= 38 && y >= 12) return T.GROUND;
        if (y === 11 && x >= 10 && x < 13) return firstOpened ? T.EMPTY : T.BRICK_BREAKABLE;
        if (y === 18 && x >= 24 && x < 27) return T.BRICK_BREAKABLE;
        if (y === 15 && x >= 10 && x < 12 || y === 21 && x >= 24 && x < 26) return T.PLATFORM;
        return T.EMPTY;
    }));
    stage.level.playerSpawn = { x: G.spawnX / 16, y: G.entryY / 16 };
    stage.level.enemies = []; stage.level.collectibles = []; stage.level.triggers = [];
    stage.level.checkpoints = []; stage.level.goalPosition = { x: 42, y: G.terraceY / 16 }; stage.level.isBossLevel = false;
    stage.mechanisms = []; stage.foes = []; stage.exits = []; stage.dialogues = []; stage.landmarks = []; stage.pickups = [];
    stage.checkpoints = [{ x: G.checkpointX / 16, y: G.galleryY / 16 }];
    stage.route = [{ x: G.spawnX, y: G.entryY }, { x: 176, y: G.firstLandingY },
        { x: G.checkpointX, y: G.galleryY }, { x: 400, y: G.secondLandingY },
        { x: 480, y: G.lowerY }, { x: G.finishX, y: G.terraceY }];
    return stage;
}
