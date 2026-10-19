/** A single inserted beat preserves the authored contacts in the rest of the street. */
export const HELICOPTER_SEQUENCE={start:304,duration:372,notice:28,draw:62,shoulder:126,fire:154,lower:292,stow:342} as const;
export const arrivalBeat=(storyTick:number)=>storyTick>=HELICOPTER_SEQUENCE.start?storyTick+HELICOPTER_SEQUENCE.duration:storyTick;
export const arrivalStoryTime=(tick:number)=>tick<HELICOPTER_SEQUENCE.start?tick:
    Math.max(HELICOPTER_SEQUENCE.start,tick-HELICOPTER_SEQUENCE.duration);
