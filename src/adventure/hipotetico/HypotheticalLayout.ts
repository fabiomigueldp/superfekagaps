/** Authored surfaces shared by the stage, scenery and projectile cover. */
export const CHASE_WIDTH = 4480;
export const CHASE_EXIT = 4352;
export const CHASE_CHECKPOINT = 2304;
export const CHASE_GAPS = [[36,40],[63,67],[128,133],[176,180],[186,190],[198,203],[216,222],[252,257]] as const;
export const CHASE_STEPS = [20,21,49,50,78,79,98,99,114,115,233,234] as const;
export const CHASE_DISTRICTS = [
    {x:0,name:'CAIS',material:'stone'}, {x:1120,name:'CARGA',material:'timber'},
    {x:2240,name:'COMPORTAS',material:'stone'}, {x:3360,name:'PORTARIA',material:'iron'},
] as const;
export type ChaseStrike='high'|'low'|'ram';
export interface ChaseVolley {kind:ChaseStrike;tell:number;duration:number;shots:readonly number[]}
export interface ChaseCue extends ChaseVolley {x:number;until:number;followup?:ChaseVolley}
/** Every change of lane has its own tell. Expired cues cannot queue an attack
 * over the next gap after a long detour or an interrupted pursuit. */
export const CHASE_ATTACKS:readonly ChaseCue[] = [
    {x:600,until:728,kind:'high',tell:52,duration:36,shots:[1,7,13]},
    {x:1248,until:1376,kind:'low',tell:48,duration:34,shots:[1,7,13]},
    {x:1728,until:1840,kind:'ram',tell:48,duration:52,shots:[12]},
    {x:2416,until:2544,kind:'high',tell:46,duration:36,shots:[1,6,11]},
    {x:2912,until:2992,kind:'low',tell:42,duration:34,shots:[1,6,11]},
    {x:3280,until:3408,kind:'ram',tell:44,duration:52,shots:[12]},
    {x:3664,until:3760,kind:'high',tell:42,duration:22,shots:[1,6,11],
        followup:{kind:'low',tell:34,duration:34,shots:[1,7,13]}},
];
export const CHASE_BREAKS = [
    {x:976,kind:'pier'}, {x:1552,kind:'crane'}, {x:2112,kind:'crane'},
    {x:2768,kind:'sluice'}, {x:3264,kind:'sluice'}, {x:4000,kind:'gantry'},
] as const;
export const CHASE_TERRACES = [
    { id: 'chase-terrace-entry', kind: 'support', x: 720, y: 192, width: 48, height: 7 },
    { id: 'chase-terrace-reward', kind: 'support', x: 800, y: 168, width: 64, height: 7 },
    { id: 'chase-terrace-exit', kind: 'support', x: 904, y: 192, width: 40, height: 7 },
    { id: 'chase-terrace-cargo-entry',kind:'support',x:1584,y:192,width:48,height:7 },
    { id: 'chase-terrace-cargo-mid',kind:'support',x:1664,y:168,width:64,height:7 },
    { id: 'chase-terrace-cargo-top',kind:'support',x:1760,y:152,width:64,height:7 },
    { id: 'chase-terrace-cargo-exit',kind:'support',x:1872,y:184,width:48,height:7 },
    { id: 'chase-terrace-final-entry',kind:'support',x:3296,y:192,width:48,height:7 },
    { id: 'chase-terrace-final-top',kind:'support',x:3376,y:168,width:64,height:7 },
    { id: 'chase-terrace-final-pier',kind:'support',x:3536,y:192,width:48,height:7 },
    { id: 'chase-terrace-lock-entry',kind:'support',x:2448,y:192,width:48,height:7 },
    { id: 'chase-terrace-lock-top',kind:'support',x:2528,y:168,width:80,height:7 },
    { id: 'chase-terrace-lock-exit',kind:'support',x:2640,y:184,width:48,height:7 },
] as const;
/** Gold treadles sit flush with real upper decks. The suspended load is behind
 * the player when released; taking the lower route never triggers it. */
export const CHASE_COUNTERS = [
    {id:'quay-load',deck:'chase-terrace-reward',pad:{x:834,y:168,width:22},load:{x:780,y:116,width:28,height:24},material:'timber'},
    {id:'lock-load',deck:'chase-terrace-lock-top',pad:{x:2564,y:168,width:22},load:{x:2512,y:116,width:28,height:24},material:'iron'},
    {id:'gate-load',deck:'chase-terrace-final-top',pad:{x:3400,y:168,width:22},load:{x:3352,y:116,width:28,height:24},material:'iron'},
] as const;
export const ARENA_BALCONIES = [
    { id: 'balcony-left', kind: 'support', x: 46, y: 184, width: 44, height: 7 },
    { id: 'balcony-right', kind: 'support', x: 224, y: 168, width: 48, height: 7 },
] as const;
export const ARENA_COLUMNS = [
    { x: 62, y: 184, width: 12, height: 40 },
    { x: 244, y: 168, width: 12, height: 56 },
] as const;
