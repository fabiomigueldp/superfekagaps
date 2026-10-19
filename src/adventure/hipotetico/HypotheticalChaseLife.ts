/** Quiet actions on the far quay use the same clock as the pursuit. */
export const CHASE_QUAYS = Array.from({length:12},(_,i)=>({
    x:i*400, kind:(['quay','cargo','water','port'] as const)[Math.floor(i/3)],
    worker:[0,1,3,4,7,9,10].includes(i), birds:[0,2,4,6,10].includes(i),
}));
const unit=(n:number)=>Math.max(0,Math.min(1,n));
const ease=(n:number)=>{const t=unit(n);return t*t*(3-2*t);};

/** Shared breeze for cloth, reeds and exhaust. World position supplies phase,
 * so panning the camera never restarts or synchronizes neighbouring props. */
export function chaseWindAt(tick:number,worldX:number,reduced:boolean){
    if(reduced)return 0;
    return Math.sin(tick/53-worldX*.0021)*.7+Math.sin(tick/117+worldX*.0013)*.3;
}

/** Quiet, staggered work before the warning. No simulation state or random
 * draws are consumed by painting these small gestures. */
export function chaseWorkAt(tick:number,index:number,reduced:boolean){
    const phase=(reduced?index*.8:tick/36+index*1.73),stroke=Math.sin(phase);
    return {stroke:reduced?0:stroke,bend:reduced?.25:Math.max(0,stroke)*.8,
        glance:reduced?0:Math.max(0,Math.sin(phase*.37)-.8)*5,
        breath:reduced?0:Math.sin(tick/31+index)*.35};
}

/** The projection is independent of which camera tile happens to be visible. */
export const chaseQuayX=(worldX:number,cameraX:number)=>96+(worldX-cameraX)*.36;
export const chaseQuayBase=(cameraY:number)=>129+(64-cameraY)*.2;
export const CHASE_SHORE={edge:5,water:19,boat:26,outlet:11} as const;
/** One section through the shore: buildings and feet rest on the street, the wall
 * reaches the water, and skiffs sit in the canal in front of that wall. */
export function chaseQuaySection(cameraY:number){
    const ground=chaseQuayBase(cameraY);
    return {ground,rear:ground-9,edge:ground+CHASE_SHORE.edge,water:ground+CHASE_SHORE.water,
        boat:ground+CHASE_SHORE.boat,outlet:ground+CHASE_SHORE.outlet};
}

/** The oar enters slowly, pulls under the water and returns clear of the surface. */
export function chaseOarAt(tick:number,index:number,reduced:boolean){
    const phase=(reduced?0:tick/27)+index*2,stroke=Math.sin(phase),wet=Math.max(0,Math.cos(phase));
    return {stroke,wet,lift:Math.max(0,-Math.cos(phase))*3,bob:reduced?0:Math.sin(tick/61+index)*.6};
}
export const chaseReactionStarts=(start:number)=>CHASE_QUAYS.map(s=>s.x<start?-1000:-1);
export function updateChaseReactions(starts:number[],tick:number,pursuerX:number){
    for(const [i,s]of CHASE_QUAYS.entries())if(starts[i]===-1&&pursuerX+210>=s.x+160)starts[i]=tick;
}

export function chaseWorkerAt(age:number){
    const travel=34*ease((age-9)/49),speed=age>9&&age<58?204/49*unit((age-9)/49)*(1-unit((age-9)/49)):0;
    return {travel,speed,notice:ease(age/8),duck:ease((age-49)/11),hidden:age>=60,
        stride:Math.sin(travel*.62)*Math.min(2,speed*2),crateDrop:3*ease(age/8)};
}
export function chaseBirdAt(age:number,index:number){
    const t=age<0?-1:age-17-index*6,fly=Math.max(0,t-5),travel=fly<12?fly*fly*.025:.6*fly-3.6;
    return {flying:t>=5,crouch:t>=0&&t<5?Math.sin(t/5*Math.PI):0,
        x:travel,y:Math.min(70,fly*.48),wing:Math.sin(fly*.34+index)*3,visible:t<150};
}
export function chaseQuayReaction(age:number,reduced:boolean){
    const t=Math.max(0,age);
    return {gust:reduced||age<0?0:Math.sin(t/6)*Math.exp(-t/32)*3,
        bell:reduced||age<0?0:Math.sin(t/4)*Math.exp(-t/30)*.4,
        shutter:1-ease((age-5)/22),signal:age>=7};
}

/** The valve closes on warning; a ruptured main then sends one finite surge into the canal. */
export function chaseOutflowAt(age:number,breakAge:number){
    const valve=1-.65*ease((age-8)/34);
    const surge=breakAge>=0&&breakAge<54?Math.sin(unit(breakAge/10)*Math.PI/2)*(1-ease((breakAge-14)/40)):0;
    return {flow:valve+surge*.7,surge};
}
