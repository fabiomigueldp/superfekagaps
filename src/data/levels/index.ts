
import { LevelData } from '../../types';
import { DATA as LEVEL_0 } from './level_0_world1-1';
import { DATA as LEVEL_1 } from './level_1_world1-2';
import { DATA as LEVEL_2 } from './level_2_boss';

export const ALL_LEVELS: LevelData[] = [
    LEVEL_0,
    LEVEL_1,
    LEVEL_2
];

// Helper functions that used to be in levels.ts
export const TOTAL_LEVELS = ALL_LEVELS.length;

export function getLevelByIndex(index: number): LevelData | null {
    if (index < 0 || index >= ALL_LEVELS.length) {
        return null;
    }
    return ALL_LEVELS[index];
}

export function getLevelById(id: string): LevelData | null {
    return ALL_LEVELS.find(level => level.id === id) || null;
}
