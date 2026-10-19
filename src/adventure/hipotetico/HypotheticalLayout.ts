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
/** Each cue begins in view; the terrain then asks the player to use the announced answer. */
export const CHASE_ATTACKS = [
    {x:600,kind:'high',tell:52}, {x:1248,kind:'low',tell:48}, {x:1728,kind:'ram',tell:48},
    {x:2416,kind:'high',tell:46}, {x:2880,kind:'low',tell:44}, {x:3520,kind:'ram',tell:44},
    {x:3824,kind:'low',tell:42},
] as const;
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
] as const;
export const ARENA_BALCONIES = [
    { id: 'balcony-left', kind: 'support', x: 46, y: 184, width: 44, height: 7 },
    { id: 'balcony-right', kind: 'support', x: 224, y: 168, width: 48, height: 7 },
] as const;
export const ARENA_COLUMNS = [
    { x: 62, y: 184, width: 12, height: 40 },
    { x: 244, y: 168, width: 12, height: 56 },
] as const;
