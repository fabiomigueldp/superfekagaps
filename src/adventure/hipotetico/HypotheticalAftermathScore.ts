/** Repeatable background performances use surviving wreckage, never reset a
 * demolished building or recreate an escaped person. Times are fixed steps. */
export const AFTERMATH_ACTIONS = ['ram','stomp','rake','tail','fire','bellow'] as const;
export type AftermathAction = typeof AFTERMATH_ACTIONS[number];
export const AFTERMATH_SCORES: readonly (readonly AftermathAction[])[] = [
    ['ram','fire','rake','bellow','tail','stomp'],
    ['tail','stomp','fire','ram','bellow','rake'],
    ['fire','rake','bellow','stomp','ram','tail'],
    ['stomp','ram','tail','fire','rake','bellow'],
];
export const AFTERMATH_PROPS = [
    {offset:118,top:-18,material:'timber' as const},
    {offset:202,top:-12,material:'stone' as const},
    {offset:310,top:-34,material:'iron' as const},
];
export function aftermathActionTiming(action:AftermathAction,variant:number){
    const beats=action==='ram'?[48]:action==='stomp'?(variant%2?[42,78]:[54])
        :action==='rake'?[42,68,91]:action==='tail'?[52]:action==='bellow'?[44]:[];
    const shots=action==='fire'?(variant%2?[36,42,48,74,80,86]:[40,46,52,58,84,90]):[];
    const duration=action==='rake'?124:action==='stomp'?120:action==='fire'?142:action==='bellow'?112:104;
    return {beats,shots,duration};
}
export function aftermathReach(action:AftermathAction){
    return action==='tail'?-54:action==='stomp'?12:action==='bellow'?0:action==='fire'?92:50;
}
