import type { AdventureStage } from '../../src/adventure/types';
import before from '../../tests/fixtures/campaign-jump-coins-before-natural.json';
export const previousJumpCoins = Object.fromEntries(Object.entries(before).map(([stage, rows]) => [stage, rows.map(([id, x, y]) => {
    if (typeof id !== 'string' || typeof x !== 'number' || typeof y !== 'number') throw new Error(`Malformed baseline coin in ${stage}`);
    return [id, x, y] as const;
})]));
/** The only approved geometry deltas. Restoring them and the old guide table
 * reconstructs9b73e115 for independently reproducible before/after checks. */
export const LANDING_SHELF_ADDITIONS: Readonly<Record<string, readonly [number, number][]>> = {
    '1-4': [[35, 11], [36, 11], [37, 11]],
    '5-1': [[122, 11]],
    '5-4': [[41, 11]],
};
export function beforeNaturalGuides(stage: AdventureStage): AdventureStage {
    const copy = structuredClone(stage);
    for (const [x, y] of LANDING_SHELF_ADDITIONS[stage.id] ?? []) copy.level.tiles[y][x] = 0;
    for (const [id, x, y] of previousJumpCoins[stage.id] ?? [])
        Object.assign(copy.pickups.find(p => p.id === id)!, { x, y });
    return copy;
}
