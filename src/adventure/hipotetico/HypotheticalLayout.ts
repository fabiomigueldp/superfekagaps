/** Authored surfaces shared by the stage, scenery and projectile cover. */
export const CHASE_WIDTH = 8192;
export const CHASE_EXIT = 8064;
export const CHASE_CHECKPOINTS = [2240,4640,6560] as const;
export const CHASE_CHECKPOINT = CHASE_CHECKPOINTS[0];
// The long portico opening is crossed on its maintenance walk or fallen decks.
// All other openings fit the native running jump (no new movement ability).
export const CHASE_GAPS = [[36,40],[63,67],[128,133],[169,185],[203,208],
    [238,242],[282,287],[302,307],[333,339],[356,361],[371,377],
    [427,432],[451,456],[484,490],[493,498]] as const;
export const CHASE_STEPS = [20,21,49,50,78,79,114,115,213,214,297,298,385,386,437,438] as const;
export const CHASE_DISTRICTS = [
    {x:0,name:'CAIS',material:'stone'}, {x:1120,name:'CARGA',material:'timber'},
    {x:2240,name:'PORTICO',material:'iron'}, {x:3520,name:'COMPORTAS',material:'stone'},
    {x:4928,name:'PASSARELAS',material:'timber'}, {x:6560,name:'PORTARIA',material:'iron'},
] as const;
export function chaseDistrictAt(x:number){
    let index=0;for(let i=1;i<CHASE_DISTRICTS.length&&x>=CHASE_DISTRICTS[i].x;i++)index=i;return index;
}
export type ChaseStrike='high'|'low'|'ram';
export interface ChaseVolley {kind:ChaseStrike;tell:number;duration:number;shots:readonly number[]}
export interface ChaseCue extends ChaseVolley {x:number;until:number;followup?:ChaseVolley}
/** Every change of lane has its own tell. Expired cues cannot queue an attack
 * over the next gap after a long detour or an interrupted pursuit. */
export const CHASE_ATTACKS:readonly ChaseCue[] = [
    {x:600,until:728,kind:'high',tell:52,duration:36,shots:[1,7,13]},
    {x:1728,until:1840,kind:'ram',tell:48,duration:52,shots:[12]},
    {x:3056,until:3136,kind:'low',tell:40,duration:34,shots:[1,6,11]},
    {x:3376,until:3464,kind:'high',tell:46,duration:36,shots:[1,6,11]},
    {x:6080,until:6176,kind:'high',tell:46,duration:36,shots:[1,6,11]},
    {x:6944,until:7040,kind:'ram',tell:44,duration:52,shots:[12]},
    {x:7336,until:7432,kind:'high',tell:42,duration:22,shots:[1,6,11],
        followup:{kind:'low',tell:34,duration:34,shots:[1,7,13]}},
];
export const CHASE_BREAKS = [
    {x:976,kind:'pier'}, {x:1552,kind:'crane'}, {x:2112,kind:'crane'},
    {x:3656,kind:'sluice'}, {x:4464,kind:'sluice'}, {x:4896,kind:'crane'},
    {x:5824,kind:'pier'}, {x:6272,kind:'crane'}, {x:7096,kind:'gantry'}, {x:7904,kind:'gantry'},
] as const;
export const CHASE_TERRACES = [
    { id: 'chase-terrace-entry', kind: 'support', x: 720, y: 192, width: 48, height: 7 },
    { id: 'chase-terrace-reward', kind: 'support', x: 800, y: 168, width: 64, height: 7 },
    { id: 'chase-terrace-exit', kind: 'support', x: 904, y: 192, width: 40, height: 7 },
    { id: 'chase-terrace-cargo-entry',kind:'support',x:1584,y:192,width:48,height:7 },
    { id: 'chase-terrace-cargo-mid',kind:'support',x:1664,y:168,width:64,height:7 },
    { id: 'chase-terrace-cargo-top',kind:'support',x:1760,y:152,width:64,height:7 },
    { id: 'chase-terrace-cargo-exit',kind:'support',x:1872,y:184,width:48,height:7 },
    { id: 'chase-terrace-final-entry',kind:'support',x:6696,y:192,width:48,height:7 },
    { id: 'chase-terrace-final-top',kind:'support',x:6776,y:168,width:64,height:7 },
    { id: 'chase-terrace-final-pier',kind:'support',x:6896,y:192,width:48,height:7 },
    { id: 'chase-terrace-lock-entry',kind:'support',x:4016,y:192,width:64,height:7 },
    { id: 'chase-terrace-lock-top',kind:'support',x:4112,y:168,width:96,height:7 },
    { id: 'chase-terrace-lock-exit',kind:'support',x:4256,y:184,width:64,height:7 },
    { id: 'chase-terrace-lock-bank',kind:'support',x:4352,y:200,width:48,height:7 },
    { id: 'chase-terrace-portico-entry',kind:'support',x:2608,y:192,width:64,height:7 },
    { id: 'chase-terrace-portico-step',kind:'support',x:2672,y:168,width:40,height:7 },
    { id: 'chase-terrace-portico-walk-a',kind:'support',x:2720,y:144,width:64,height:7 },
    { id: 'chase-terrace-portico-walk-b',kind:'support',x:2816,y:144,width:64,height:7 },
    { id: 'chase-terrace-portico-walk-c',kind:'support',x:2912,y:176,width:64,height:7 },
    { id: 'chase-terrace-loader-entry',kind:'support',x:5040,y:192,width:48,height:7 },
    { id: 'chase-terrace-loader-perch',kind:'support',x:5136,y:168,width:80,height:7 },
    { id: 'chase-terrace-run-entry',kind:'support',x:5488,y:192,width:64,height:7 },
    { id: 'chase-terrace-run-mid',kind:'support',x:5584,y:168,width:80,height:7 },
    { id: 'chase-terrace-run-span',kind:'support',x:5696,y:152,width:64,height:7 },
    { id: 'chase-terrace-run-exit',kind:'support',x:5808,y:184,width:64,height:7 },
    { id: 'chase-terrace-run-pier',kind:'support',x:5920,y:192,width:64,height:7 },
    { id: 'chase-terrace-run-bank',kind:'support',x:6032,y:208,width:64,height:7 },
] as const;
/** Gold treadles sit flush with real upper decks. The suspended load is behind
 * the player when released; taking the lower route never triggers it. */
export const CHASE_COUNTERS = [
    {id:'quay-load',deck:'chase-terrace-reward',pad:{x:834,y:168,width:22},load:{x:780,y:116,width:28,height:24},material:'timber'},
    {id:'lock-load',deck:'chase-terrace-lock-top',pad:{x:4148,y:168,width:22},load:{x:4096,y:116,width:28,height:24},material:'iron'},
    {id:'gate-load',deck:'chase-terrace-final-top',pad:{x:6800,y:168,width:22},load:{x:6752,y:116,width:28,height:24},material:'iron'},
] as const;
export const CHASE_PORTICO={trigger:2240,fire:48,targetX:2720,targetY:110,settle:36,end:3056} as const;
export const CHASE_FALLEN_DECKS=[
    {id:'chase-fallen-a',x:2704,y:208,width:64,height:7,delay:0},
    {id:'chase-fallen-b',x:2800,y:208,width:64,height:7,delay:6},
    {id:'chase-fallen-c',x:2896,y:208,width:64,height:7,delay:12},
] as const;
export const CHASE_FLOOD={warningX:3824,sourceX:3968,endX:4512,speed:5,width:30,height:18} as const;
export const CHASE_LEAP={trigger:5488,until:5704,prepare:30,flight:44,landingX:5672,recover:24} as const;
export const CHASE_PATROLS=[
    {id:'chase-scout-cargo',role:'scout',x:1440,y:224,trigger:1264},
    {id:'chase-loader',role:'loader',x:5184,y:168,trigger:4912},
    {id:'chase-scout-gate',role:'scout',x:6784,y:224,trigger:6608},
] as const;
export const ARENA_BALCONIES = [
    { id: 'balcony-left', kind: 'support', x: 46, y: 184, width: 44, height: 7 },
    { id: 'balcony-right', kind: 'support', x: 224, y: 168, width: 48, height: 7 },
] as const;
export const ARENA_COLUMNS = [
    { x: 62, y: 184, width: 12, height: 40 },
    { x: 244, y: 168, width: 12, height: 56 },
] as const;
