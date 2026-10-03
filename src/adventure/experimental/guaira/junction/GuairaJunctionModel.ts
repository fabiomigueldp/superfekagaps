import { STAGES } from '../../../campaign';
import type { AdventureStage } from '../../../types';
import { TileType as T } from '../../../../constants';

export type WaterOutlet = 'a' | 'b';

export const GUAIRA_JUNCTION = Object.freeze({
    id: 'guaira-patio-comportas', width: 60, height: 28,
    startY: 304, middleY: 256, terraceY: 208, dockY: 400, recoveryY: 400,
    maintenanceY: 176, exitGapStartX: 800, exitGapEndX: 848,
    entryPlateId: 'junction-entry-plate', middlePlateId: 'junction-middle-plate',
    liftAId: 'junction-deck-a', liftBId: 'junction-deck-b',
    checkpointX: 432, finishX: 880, warningMs: 400,
});

/** A switch requests a route; warning time is readable preparation, never a deadline. */
export class JunctionRouting {
    selected: WaterOutlet;
    supplied: WaterOutlet;
    warningRemaining = 0;
    constructor(outlet: WaterOutlet = 'b') { this.selected = this.supplied = outlet; }
    get warning() { return this.warningRemaining > 0; }
    step(requested: WaterOutlet, dt: number) {
        if (requested !== this.selected) {
            this.selected = requested;
            this.warningRemaining = requested === this.supplied ? 0 : GUAIRA_JUNCTION.warningMs;
            return;
        }
        this.warningRemaining = Math.max(0, this.warningRemaining - Math.max(0, dt));
        if (!this.warningRemaining) this.supplied = this.selected;
    }
}

/** Independent authored slice. All surfaces are native tiles or gated lifts. */
export function guairaJunctionStage(): AdventureStage {
    const g = GUAIRA_JUNCTION, stage = structuredClone(STAGES[0]);
    stage.id = g.id; stage.name = 'GUAÍRA · PÁTIO DAS COMPORTAS';
    stage.subtitle = 'Do bairro seco ao arrozal · protótipo isolado';
    delete stage.encounter;
    stage.level.id = 'experimental-guaira-junction';
    stage.level.width = g.width; stage.level.height = g.height;
    stage.level.originX = 0; stage.level.originY = 0;
    stage.level.tiles = Array.from({ length: g.height }, (_, y) => Array.from({ length: g.width }, (_, x) => {
        if (y >= 25) return T.GROUND;
        // Open underneath: a missed jump always has a dry route back to the inlet.
        if (y === 19 && x < 14 || y === 16 && x >= 24 && x < 36 ||
            y === 13 && (x >= 46 && x < 50 || x >= 53)) return T.PLATFORM;
        // Optional maintenance perch: keep A raised, or reverse the middle plate
        // to return here. It never gates the B route or the checkpoint.
        if (y === 11 && x >= 11 && x < 14) return T.PLATFORM;
        if (y === 22 && x >= 6 && x < 12) return T.PLATFORM;
        return T.EMPTY;
    }));
    stage.level.playerSpawn = { x: 3, y: 19 };
    stage.level.enemies = []; stage.level.collectibles = []; stage.level.triggers = [];
    stage.level.checkpoints = []; stage.level.goalPosition = { x: 55, y: 13 }; stage.level.isBossLevel = false;
    stage.mechanisms = [
        // Two real sentada plates toggle one another. This is the native selector
        // signal; neither plate directly moves a deck during the warning period.
        { id: g.entryPlateId, kind: 'switch', x: 160, y: 296, width: 32, height: 8, link: g.middlePlateId },
        { id: g.middlePlateId, kind: 'switch', x: 480, y: 248, width: 32, height: 8, link: g.entryPlateId },
        { id: g.liftAId, kind: 'lift', x: 224, y: g.dockY, width: 160, height: 8, to: { x: 224, y: g.middleY }, gated: true },
        { id: g.liftBId, kind: 'lift', x: 576, y: g.dockY, width: 160, height: 8, to: { x: 576, y: g.terraceY }, gated: true },
    ];
    stage.foes = []; stage.exits = []; stage.dialogues = []; stage.landmarks = [];
    stage.pickups = [176, 192, 208].map((x, i) => ({ id: `junction-maintenance-coin-${i + 1}`, kind: 'coin' as const, x, y: 154 }));
    stage.checkpoints = [{ x: 27, y: 16 }];
    stage.route = [{ x: 48, y: g.startY }, { x: 176, y: g.startY, switch: g.entryPlateId },
        { x: g.checkpointX, y: g.middleY }, { x: 496, y: g.middleY, switch: g.middlePlateId },
        { x: g.finishX, y: g.terraceY }];
    return stage;
}
