
import { LevelData } from '../../types';
import { DATA as LEVEL_0 } from './level_0_world1-1';
import { DATA as LEVEL_1 } from './level_1_world1-2';
import { DATA as LEVEL_2 } from './level_2_boss';

export const CAMPAIGN_LEVELS: { filename: string; data: LevelData }[] = [
    { filename: 'level_0_world1-1.ts', data: LEVEL_0 },
    { filename: 'level_1_world1-2.ts', data: LEVEL_1 },
    { filename: 'level_2_boss.ts', data: LEVEL_2 }
];

export const ALL_LEVELS = CAMPAIGN_LEVELS.map(entry => entry.data);
export const TOTAL_LEVELS = ALL_LEVELS.length;

export function getLevelByIndex(index: number): LevelData | null {
    if (index < 0 || index >= ALL_LEVELS.length) {
        return null;
    }
    return ALL_LEVELS[index];
}
