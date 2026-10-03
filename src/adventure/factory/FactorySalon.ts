import type { Rect } from '../../types';
import type { AdventureSave } from '../types';
import { overlaps } from '../types';

/** Shared by campaign, scene art and QA. All coordinates are logical pixels. */
export const FACTORY_SALON = Object.freeze({
    stage: '3-3', victory: 'optional:factory-salon:turbosuco',
    door: Object.freeze({ x: 1776, y: 184, width: 24, height: 40 }),
    support: Object.freeze({ x: 1664, y: 224, width: 256 }),
    viewport: Object.freeze({ width: 320, height: 180 }),
    introFloor: 160, combatFloor: 224, arrivalCameraMaxY: 72,
    combatCamera: Object.freeze({ x: 0, y: 64 }),
});
export function atFactorySalon(stage: string, player: Rect, grounded: boolean): boolean {
    return stage === FACTORY_SALON.stage && grounded && overlaps(player, FACTORY_SALON.door);
}
/** Optional achievement uses the existing extensible v1 journal. Never finishes a stage. */
export function recordSalonVictory(save: AdventureSave): boolean {
    if (save.seen.includes(FACTORY_SALON.victory)) return false;
    // Put the result first; parseSave reserves an extra slot beyond the legacy 200.
    save.seen.unshift(FACTORY_SALON.victory);
    return true;
}
