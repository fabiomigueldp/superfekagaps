import {handlingTiming,isHandling,AFTERMATH_SCALE,DEBRIS_GRIP_X} from './HypotheticalAftermathHandling';

/** Repeatable background performances use surviving wreckage, never reset a
 * demolished building or recreate an escaped person. Times are fixed steps. */
export const AFTERMATH_ACTIONS = ['ram','stomp','rake','tail','fire','bellow','haul','sift','wrench'] as const;
export type AftermathAction = typeof AFTERMATH_ACTIONS[number];
export const AFTERMATH_SCORES: readonly (readonly AftermathAction[])[] = [
    ['ram','haul','fire','wrench','rake','sift','bellow','tail','stomp'],
    ['tail','sift','stomp','haul','fire','ram','bellow','wrench','rake'],
    ['fire','wrench','rake','haul','bellow','stomp','sift','ram','tail'],
    ['stomp','sift','ram','tail','wrench','fire','haul','rake','bellow'],
];
export const AFTERMATH_PROPS = [
    {offset:118,top:-18,material:'timber' as const},
    {offset:202,top:-12,material:'stone' as const},
    {offset:310,top:-34,material:'iron' as const},
];
export function aftermathActionTiming(action:AftermathAction,variant:number){
    if(isHandling(action))return {beats:[],shots:[],duration:handlingTiming(action).duration};
    const beats=action==='ram'?[48]:action==='stomp'?(variant%2?[42,78]:[54])
        :action==='rake'?[42,68,91]:action==='tail'?[52]:action==='bellow'?[44]:[];
    const shots=action==='fire'?(variant%2?[36,42,48,74,80,86]:[40,46,52,58,84,90]):[];
    const duration=action==='rake'?124:action==='stomp'?120:action==='fire'?142:action==='bellow'?112:104;
    return {beats,shots,duration};
}
export function aftermathReach(action:AftermathAction){
    return action==='tail'?-54:action==='stomp'?12:action==='bellow'?0:action==='fire'?92
        :DEBRIS_GRIP_X*AFTERMATH_SCALE+(action==='ram'?8:action==='rake'?3:0);
}
