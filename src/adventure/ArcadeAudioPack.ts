import type { WorldSample, WorldSamplePack } from './WorldSampleAudio';

const clip = (id: string, gain: number): WorldSample => ({ path: `assets/audio/arcade-r2/${id}.wav`, gain });
const pair = (id: string, gain: number) => [clip(`${id}-a`, gain), clip(`${id}-b`, gain)];
const music = (id: string, end: number): WorldSample => ({ path: `assets/audio/arcade-r2/music-${id}.mp3`, gain: 2, loop: { start: 0, end } });
const bed = (id: string, gain: number): WorldSample => ({ ...clip(id, gain), loop: { start: 0, end: 1.68 } });
const common = { jump: pair('jump', .8), warning: pair('warning', .85), pressure: pair('pressure', .7) };
const industrial = { ...common, jet: pair('discharge', .65), cannon: pair('discharge', .65) };

/** Derived from verified arcade-r2 originals; artistic audition remains pending. */
export const ARCADE_AUDIO_PACK: WorldSamplePack = { scenes: {
    'guaira-travessia': { music: music('a', 24), effects: common },
    'guaira-patio-comportas': { music: music('a', 24), effects: common },
    'guaira-galeria': { music: music('a', 24), effects: common },
    'guaira-subida': { music: music('b', 26 + 2 / 3), effects: common },
    'guaira-respiros': { music: music('b', 26 + 2 / 3), effects: common },
    'guaira-lab': { effects: common },
    'guaira-prefeito': { effects: common },
    'juice-lab': { effects: industrial, ambience: { juice: bed('juice-a', .65), 'juice-enraged': bed('juice-b', .55) } },
    ...Object.fromEntries(['3-1', '3-2', '3-3', '3-4', '3-5'].map(id => [id, { effects: industrial }])),
} };

/** This bed is requested only by the chapter's accepted-water state, near its source. */
export const GUAIRA_MAP_AUDIO_PACK: WorldSamplePack = { scenes: {
    'accepted-water': { effects: {}, ambience: { water: bed('water-a', .9), 'water-alternate': bed('water-b', .9) } },
} };
