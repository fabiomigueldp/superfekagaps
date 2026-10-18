/** Authored surfaces shared by the stage, scenery and projectile cover. */
export const CHASE_GAPS = [[36, 40], [63, 67]] as const;
export const CHASE_STEPS = [20, 21, 49, 50, 78, 79] as const;
export const CHASE_TERRACES = [
    { id: 'chase-terrace-entry', kind: 'support', x: 720, y: 192, width: 48, height: 7 },
    { id: 'chase-terrace-reward', kind: 'support', x: 800, y: 168, width: 64, height: 7 },
    { id: 'chase-terrace-exit', kind: 'support', x: 904, y: 192, width: 40, height: 7 },
] as const;
export const ARENA_BALCONIES = [
    { id: 'balcony-left', kind: 'support', x: 46, y: 184, width: 44, height: 7 },
    { id: 'balcony-right', kind: 'support', x: 224, y: 168, width: 48, height: 7 },
] as const;
export const ARENA_COLUMNS = [
    { x: 62, y: 184, width: 12, height: 40 },
    { x: 244, y: 168, width: 12, height: 56 },
] as const;
