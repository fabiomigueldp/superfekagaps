import {smoothMotion} from './HypotheticalMotion';
import {box,oval,pixelLine} from '../WorldPainting';

/**
 * Brutal cinematic opening sequence (ticks 0–110):
 * The dinosaur stalks in, coils, lunges at the fleeing petista NPC, clamps him in its front teeth,
 * violently thrashes and shakes him off the ground, rips him in half in a geyser of blood
 * and viscera (flinging the severed legs, arm and torn red star-shirt across the cobbles),
 * tosses the upper torso into its gaping jaws, crunches it down, and chews/gulps
 * before Flávio raises his rifle for the first courtyard volley.
 */
export const OPENING={
    notice:26,
    prepare:44,
    strike:52,
    clamp:63,
    contact:72,
    rip:75,
    toss:81,
    occluded:86,
    recover:96,
    join:110,
} as const;

const SCALE=.6875;

export function arrivalOpeningAt(tick:number){
    const wind=smoothMotion((tick-OPENING.prepare)/10),drive=smoothMotion((tick-OPENING.strike)/12);
    const release=smoothMotion((tick-84)/12),active=tick>=OPENING.prepare&&tick<OPENING.recover;
    const force=active?wind*(1-release):0;
    const thrashEnv=smoothMotion((tick-63)/3)*(1-smoothMotion((tick-73)/4));
    const ripEnv=smoothMotion((tick-71)/5)*(1-smoothMotion((tick-80)/6));
    const tossEnv=smoothMotion((tick-78)/3)*(1-smoothMotion((tick-83)/3));
    const chewEnv=smoothMotion((tick-86)/3)*(1-smoothMotion((tick-100)/5));
    const hit=smoothMotion((tick-62)/3)*(1-smoothMotion((tick-86)/10));
    const pull=smoothMotion((tick-64)/14)*(1-release);
    const joinX=-80+230*smoothMotion(OPENING.join/136);

    const u=Math.max(0,Math.min(1,tick/OPENING.prepare));
    const approach=-80+174*(.28*u+.72*smoothMotion(u));
    const thrashX=thrashEnv*Math.sin((tick-63)*.9)*1.8-ripEnv*1.5;
    const x=tick<OPENING.prepare?approach
        :tick<OPENING.strike?94-3*wind
        :tick<64?91+41*drive
        :tick<OPENING.occluded?132+thrashX
        :tick<OPENING.recover?132-4*release
        :128+(joinX-128)*smoothMotion((tick-OPENING.recover)/(OPENING.join-OPENING.recover));

    // Jaws open wide on lunge, slam shut at clamp (63), gnash during thrash, wrench open on rip (75),
    // open wide to toss the upper torso (81), crunch shut to devour (85), then chew twice (87–98).
    const openLunge=smoothMotion((tick-44)/10)*(1-smoothMotion((tick-60)/3));
    const gnash=thrashEnv*(.08+.24*Math.abs(Math.sin((tick-63)*.85)));
    const ripOpen=smoothMotion((tick-72)/3)*(1-smoothMotion((tick-76)/3))*.68;
    const tossOpen=tossEnv*.76;
    const chew=chewEnv*Math.max(0,Math.sin((tick-87)*.62))*.34;
    const crushClose=smoothMotion((tick-83)/3)*(1-smoothMotion((tick-98)/6))*.08;
    const jaw=Math.max(.1,Math.min(1.05,.18+openLunge*.84+gnash+ripOpen+tossOpen+chew-crushClose));

    // Neck drops low to street level to snatch the victim, shakes during thrash, wrenches high on rip,
    // and gulps during the chew.
    const thrashShake=thrashEnv*Math.sin((tick-63)*.75)*1.8;
    const gulp=chewEnv*-1.4*Math.sin((tick-86)*.5);
    const neckDrop=force*22-pull*16+thrashShake+gulp;

    const riderLean=force*(3.2-6.2*smoothMotion((tick-68)/8));
    const compression=force*4+hit*2.2-ripEnv*1.2+chewEnv*1.1;
    const riderDrop=force*4.5+hit*2;

    return {
        x,wind:active?wind:0,drive:active?drive:0,active,force,
        jaw,neckDrop,compression,brace:force*.8,tail:force*.18+ripEnv*.12,
        riderDrop,riderLean,rein:force,
        phase:!active?'march':tick<OPENING.strike?'prepare':tick<OPENING.clamp?'strike':tick<OPENING.occluded?'contact':'recover',
    };
}

/** Exact street-space coordinates of the dinosaur's front clamping teeth during the opening. */
export function openingJawAnchor(tick:number,base:number){
    const m=arrivalOpeningAt(Math.min(tick,OPENING.join));
    return {
        x:m.x+60*SCALE,
        y:base+(-50+m.neckDrop+m.compression+m.jaw*5)*SCALE,
        snoutX:m.x+66*SCALE,
        throatX:m.x+44*SCALE,
        jaw:m.jaw,
        neckDrop:m.neckDrop,
    };
}

function drawUpperJawClamp(c:CanvasRenderingContext2D,jx:number,jy:number,jaw:number){
    // Upper snout lip and blood-stained ivory canines overlapping the victim's chest so he is gripped inside the jaws.
    const topY=Math.round(jy-4-jaw*2);
    box(c,jx-8,topY-2,12,2,'#676f52');
    box(c,jx-7,topY,11,1,'#7d524c');
    for(const [dx,len] of [[-6,3],[-3,4],[0,3],[3,4]] as const){
        box(c,jx+dx,topY,2,len,'#e6dec5');
        box(c,jx+dx,topY+len-1,2,2,'#9e3237');
    }
}

function drawVictimInJaws(c:CanvasRenderingContext2D,tick:number,base:number){
    if(tick<OPENING.clamp||tick>=OPENING.occluded)return;
    const {x:jx,y:jy,jaw}=openingJawAnchor(tick,base);
    const ripped=tick>=OPENING.contact;

    if(!ripped){
        // Stage 3 & 4 (ticks 63–71): Full petista NPC gripped at the front teeth, sticking out against the wall
        // as the dinosaur lifts and violently shakes him!
        const t=tick-OPENING.clamp;
        const whip=Math.sin(t*1.2),kick=Math.sin(t*1.7);
        const cx=Math.round(jx+1),cy=Math.round(jy+1);

        // Frantically kicking legs dangling below the lower jaw.
        const hipX=cx+1+Math.round(whip*3),hipY=cy+5;
        const lFootX=hipX-3+Math.round(kick*4),lFootY=Math.min(base-1,hipY+7-Math.round(Math.abs(kick)*3));
        const rFootX=hipX+4-Math.round(kick*4),rFootY=Math.min(base-1,hipY+7-Math.round(Math.abs(1-kick)*3));
        pixelLine(c,hipX-1,hipY,lFootX,lFootY,'#485f62',2);
        pixelLine(c,hipX+1,hipY,rFootX,rFootY,'#667c79',2);
        box(c,lFootX-1,lFootY,3,1,'#89978a');
        box(c,rFootX-1,rFootY,3,1,'#89978a');

        // Torso in red 'star-shirt' clamped in the teeth, with the white 5-point star & spreading blood punctures.
        box(c,cx-4,cy-3,9,8,'#88434a');
        box(c,cx-3,cy-3,7,7,'#b55350');
        // White 5-point star on the chest.
        box(c,cx,cy-2,1,1,'#f0e6d7');
        box(c,cx-2,cy-1,5,1,'#f0e6d7');
        box(c,cx-1,cy,3,1,'#f0e6d7');
        box(c,cx-1,cy+1,1,1,'#f0e6d7');
        box(c,cx+1,cy+1,1,1,'#f0e6d7');
        // Deep crimson teeth punctures soaking the shirt.
        box(c,cx-3,cy-2,3,3,'#6e1e24');
        box(c,cx+1,cy,2,3,'#9e3237');
        box(c,cx-2,cy+2,5,2,'#7a2228');

        // Flailing arms reaching out in panic in front of the snout.
        const armY=cy-2+Math.round(whip*2);
        pixelLine(c,cx-2,cy-2,cx-6,armY-4,'#88434a',2);
        box(c,cx-7,armY-5,2,2,'#b18872');
        pixelLine(c,cx+3,cy-1,cx+9,armY-2-Math.round(kick*2),'#b55350',2);
        box(c,cx+9,armY-3-Math.round(kick*2),2,2,'#b18872');

        // Head thrown forward/up in agony outside the snout with open screaming mouth.
        const hx=cx+5+Math.round(whip*2),hy=cy-6+Math.round(Math.abs(whip));
        box(c,hx-2,hy,5,5,'#b18872');
        box(c,hx-2,hy-1,5,2,'#514e51');
        box(c,hx+1,hy+1,1,1,'#f0e6d7');
        box(c,hx+1,hy+2,2,2,'#4a181d');

        drawUpperJawClamp(c,jx,jy,jaw);
        return;
    }

    // Stage 5 (ticks 72–85): Ripped in half!
    // Only the severed upper torso, head and one arm remain in the jaws, tossed up at tick 81 and crunched at 84–85.
    const u=tick-OPENING.contact;
    const tossLift=tick>=79&&tick<84?Math.sin((tick-79)/5*Math.PI)*5:0;
    const crunch=smoothMotion((tick-82)/4);
    const cx=Math.round(jx-1-crunch*4),cy=Math.round(jy-tossLift+crunch*2);
    const h=Math.max(2,Math.round(6*(1-crunch*.45)));

    // Upper red star-shirt torso with jagged bloody severed ribcage/spine dangling below.
    box(c,cx-3,cy-2,7,h,'#88434a');
    box(c,cx-2,cy-2,5,Math.max(1,h-1),'#b55350');
    box(c,cx-1,cy-1,3,1,'#f0e6d7');
    // Jagged severed waist, exposed white ribs/spine and trailing viscera.
    box(c,cx-3,cy+h-2,7,3,'#6e1e24');
    box(c,cx-2,cy+h,5,2,'#a83236');
    box(c,cx,cy+h+1,1,3,'#e6dac3');
    box(c,cx-2,cy+h+1,1,2,'#e6dac3');
    pixelLine(c,cx+1,cy+h+1,cx+2,cy+h+4,'#8f292f');

    if(crunch<.75){
        // Remaining arm flailing limp as the upper body is tossed into the gullet.
        const armWave=Math.sin(u*1.3)*2;
        pixelLine(c,cx+3,cy-1,cx+8,cy-3+armWave,'#b55350',2);
        box(c,cx+8,cy-4+armWave,2,2,'#b18872');
        // Head snapping back into the jaws.
        const hx=cx+4,hy=cy-5;
        box(c,hx-2,hy,5,4,'#b18872');
        box(c,hx-2,hy-1,4,2,'#514e51');
        box(c,hx+1,hy+2,2,2,'#581c21');
    }

    drawUpperJawClamp(c,jx,jy,jaw);
}

/**
 * Full brutal aftermath & dismemberment physics:
 * - Persistent multi-layered crimson blood pools on the cobbles
 * - Severed lower body (pelvis + both legs + shoes + spine stub) flung in a ballistic arc and resting in blood
 * - Stretched visceral/blood tear strands when the torso and legs separate
 * - Severed arm in torn red sleeve and torn 'star-shirt' chest shreds with white star pixels
 * - Multi-wave arterial blood sprays, visceral chunks, blood mist, jaw drips, and knocked-off cap
 */
export function drawOpeningAftermath(c:CanvasRenderingContext2D,tick:number,base:number,reduced:boolean){
    const clampAge=tick-OPENING.clamp;
    if(clampAge<0)return;
    const ripAge=tick-OPENING.contact;
    const {x:jx,y:jy}=openingJawAnchor(tick,base);

    // 1. Expanding persistent blood pools on the street cobbles (visible in both normal and reduced motion).
    const pool1=smoothMotion(clampAge/26);
    if(pool1>0){
        const w1=Math.round(5+20*pool1);
        oval(c,172-w1*.5,base-2,w1,3,'#582026');
        oval(c,171-w1*.38,base-2,Math.max(2,w1-4),2,'#7a2930');
        box(c,169-Math.round(pool1*6),base-1,Math.max(2,Math.round(w1*.72)),1,'#9e383d');
        for(let i=0;i<6;i++){
            const sx=158+i*6+i%2*2,sy=base-1-(i%2);
            if(clampAge>3+i*3)box(c,sx,sy,2+(i%2),1,i%2?'#6e2227':'#8f3236');
        }
    }
    if(ripAge>=3){
        const pool2=smoothMotion((ripAge-3)/22);
        const w2=Math.round(4+18*pool2);
        oval(c,190-w2*.5,base-2,w2,3,'#521c22');
        oval(c,189-w2*.35,base-2,Math.max(2,w2-4),2,'#78282f');
        box(c,186-Math.round(pool2*4),base-1,Math.max(2,Math.round(w2*.68)),1,'#9c363b');
    }

    // 2. Torn shreds of the red 'star-shirt' (including white star pixels) fluttering down after the rip.
    if(ripAge>=0){
        const shreds=[
            {startX:173,startY:base-25,endX:168,endY:base-2,dur:20,star:true},
            {startX:171,startY:base-27,endX:161,endY:base-1,dur:17,star:false},
            {startX:175,startY:base-24,endX:181,endY:base-2,dur:22,star:false},
        ] as const;
        for(const [i,s] of shreds.entries()){
            const t=Math.min(1,ripAge/s.dur),air=!reduced&&t<1;
            const sx=air?s.startX+(s.endX-s.startX)*t+Math.sin(ripAge*.45+i)*2.5:s.endX;
            const sy=air?s.startY+(s.endY-s.startY)*t*t-Math.sin(t*Math.PI)*5:s.endY;
            box(c,sx,sy,s.star?5:3,2,'#88434a');
            box(c,sx+1,sy,s.star?3:2,1,'#b55350');
            if(s.star){
                // Torn white pixels from the 5-point star on the shredded shirt.
                box(c,sx+1,sy,1,1,'#f0e6d7');
                box(c,sx+2,sy+1,2,1,'#f0e6d7');
                box(c,sx,sy+1,1,1,'#6e1e24');
            }
        }
    }

    // 3. Severed arm in red sleeve, ripped off at tick 72 and landing at x=178.
    if(ripAge>=0){
        const t=Math.min(1,ripAge/16),air=!reduced&&t<1;
        const ax=air?173+5*t:178;
        const ay=air?base-26+24*t*t-Math.sin(t*Math.PI)*10:base-2;
        const tilt=air?Math.round(Math.sin(ripAge*.8)*2):0;
        // Bloody shoulder stump, red sleeve, forearm and hand.
        box(c,ax-2,ay,2,2,'#7a2228');
        box(c,ax-1,ay,3,2,'#b55350');
        pixelLine(c,ax+1,ay+1,ax+4,ay+1+tilt,'#b18872',2);
        box(c,ax+4,ay+tilt,2,2,'#c1a183');
    }

    // 4. Severed lower body (pelvis + both legs + shoes + exposed spine stub) flung in a ballistic arc to x=191.
    if(ripAge>=0){
        const flight=20,t=Math.min(1,ripAge/flight),air=!reduced&&t<1;
        const bounce=!reduced&&ripAge>=flight&&ripAge<flight+8?Math.sin((ripAge-flight)/8*Math.PI)*2.5:0;
        const lx=air?174+17*t:191;
        const ly=air?base-22+20*t*t-Math.sin(t*Math.PI)*14:base-2-bounce;
        const spin=air?ripAge*.38:1.45;
        const cos=Math.cos(spin),sin=Math.sin(spin);
        const pt=(u:number,v:number):[number,number]=>[Math.round(lx+u*cos-v*sin),Math.min(base-1,Math.round(ly+u*sin+v*cos))];

        const [wx,wy]=pt(0,0);
        const [k1x,k1y]=pt(-2,4),[f1x,f1y]=pt(-4,8);
        const [k2x,k2y]=pt(2,4),[f2x,f2y]=pt(5,7);

        // Visceral tear strands stretching between the upper torso in the jaws and the flying severed waist (ticks 72–78).
        if(!reduced&&ripAge<7){
            pixelLine(c,jx+1,jy+4,wx,wy-1,'#8f292f',2);
            pixelLine(c,jx-1,jy+3,wx-1,wy,'#c94a44',1);
        }

        // Articulated severed legs and shoes.
        pixelLine(c,wx-1,wy,k1x,k1y,'#485f62',2);
        pixelLine(c,k1x,k1y,f1x,f1y,'#485f62',2);
        box(c,f1x-1,f1y,3,1,'#89978a');

        pixelLine(c,wx+1,wy,k2x,k2y,'#667c79',2);
        pixelLine(c,k2x,k2y,f2x,f2y,'#667c79',2);
        box(c,f2x-1,f2y,3,1,'#89978a');

        // Jagged bloody pelvis/waist stump and protruding white spine bone.
        box(c,wx-3,wy-2,6,3,'#581c21');
        box(c,wx-2,wy-2,4,2,'#9e3237');
        box(c,wx-1,wy-3,2,1,'#c94a44');
        box(c,wx-2,wy-3,1,2,'#e6dac3');

        // Trailing blood drops from the severed waist while airborne.
        if(air){
            for(let i=1;i<=3;i++){
                const bt=Math.max(0,(ripAge-i*2)/flight);
                const bx=174+17*bt,by=base-22+20*bt*bt-Math.sin(bt*Math.PI)*14;
                box(c,bx-1,Math.min(base-1,by),2,1,i%2?'#9e3237':'#6e1e24');
            }
        }
    }

    // 5. Knocked-off cap flying in a parabola at the moment of the bite (tick 63) and resting at x=199.
    const hatT=Math.min(26,clampAge);
    const hatX=174+hatT*.95,hatY=Math.min(base-3,base-24-hatT*.65+hatT*hatT*.06);
    box(c,hatX,hatY,5,2,'#88675e');
    box(c,hatX-1,hatY+2,8,1,'#b7a187');
    box(c,hatX+1,hatY,2,1,'#7a2228');

    // 6. Victim clamped, thrashing and ripped apart inside the dinosaur's jaws (ticks 63–85).
    drawVictimInJaws(c,tick,base);

    if(reduced)return;

    // 7. Dynamic airborne gore, arterial blood jets, visceral chunks, mist and jaw drips.
    // Wave A: Initial bite puncture spray & dust (ticks 63–78).
    if(clampAge<16){
        const u=clampAge/16,env=Math.sin(Math.PI*u);
        for(let i=0;i<5;i++){
            const sx=170+(i-2)*u*14,sy=base-2-Math.sin(u*Math.PI)*(2+i%3);
            oval(c,sx,sy,Math.max(2,(6-i%3)*env),2+i%2,i%2?'#a8a48b':'#8a4b49');
        }
        for(let i=0;i<12;i++){
            const dir=i%2?1:-1,vx=dir*(.7+(i%5)*.4),vy=-1.5-(i%4)*.45;
            const bx=jx+vx*clampAge,by=Math.min(base-1,jy+vy*clampAge+.16*clampAge*clampAge);
            box(c,bx,by,i%3===0?2:1,i%4===0?2:1,i%2?'#c94a44':'#7a2228');
        }
    }

    // Wave B: Centrifugal blood arcs flung during the violent head-shake (ticks 64–72).
    if(tick>=64&&tick<75){
        for(let i=0;i<10;i++){
            const born=64+i%8,age=tick-born;
            if(age<0||age>10)continue;
            const dir=i%2?1:-1,vx=dir*(1.25+(i%3)*.48),vy=-1.0-(i%3)*.38;
            const bx=jx+vx*age,by=Math.min(base-1,jy+vy*age+.18*age*age);
            box(c,bx,by,2,1,i%2?'#c94a44':'#88262c');
        }
    }

    // Wave C: Massive dismemberment blood geyser, arterial jets & visceral chunks (ticks 72–98).
    if(ripAge>=0&&ripAge<26){
        if(ripAge<10){
            // High-pressure arterial blood streams shooting out from the tear.
            const s=2+ripAge*1.4;
            pixelLine(c,jx-2,jy,jx-4-s,jy-6-ripAge*.6,'#b53f3f',2);
            pixelLine(c,jx+3,jy-1,jx+7+s,jy-7-ripAge*.5,'#8f292f',2);
            pixelLine(c,jx+2,jy+2,jx+5+s*.9,jy+4+ripAge*.4,'#c94a44',1);
        }
        if(ripAge<14){
            // Crimson blood mist cloud around the jaws.
            const mEnv=Math.sin(ripAge/14*Math.PI);
            oval(c,jx-6-ripAge*.4,jy-5-ripAge*.2,10*mEnv,6*mEnv,'#7a2228');
            oval(c,jx+2+ripAge*.35,jy-3-ripAge*.2,9*mEnv,5*mEnv,'#a8383b');
        }
        // 20 ballistic blood droplets & visceral chunks raining onto the street.
        for(let i=0;i<20;i++){
            const vx=((i%7)-2.4)*(.58+(i%3)*.24),vy=-1.85-(i%5)*.44;
            const bx=jx+vx*ripAge,by=Math.min(base-1,jy+vy*ripAge+.15*ripAge*ripAge);
            const chunk=i%3===0;
            box(c,bx,by,chunk?2:1,chunk&&by<base-2?2:1,i%3===0?'#6e1e24':i%2?'#c94a44':'#942c31');
        }
    }

    // Wave D: Devouring crunch burst & blood dripping from the dinosaur's stained teeth/chin (ticks 83–108).
    const crunchAge=tick-83;
    if(crunchAge>=0&&crunchAge<12){
        for(let i=0;i<10;i++){
            const vx=((i%5)-2)*.8,vy=-1.0-(i%3)*.35;
            const bx=jx+vx*crunchAge,by=Math.min(base-1,jy+vy*crunchAge+.18*crunchAge*crunchAge);
            box(c,bx,by,1+(i%2),1,i%2?'#c94a44':'#6e1e24');
        }
    }
    if(tick>=84&&tick<109){
        for(let i=0;i<4;i++){
            const dropAge=(tick-84-i*5);
            if(dropAge<0||dropAge>11)continue;
            const dx=jx-4+i*3,dy=Math.min(base-1,jy+4+.24*dropAge*dropAge);
            box(c,dx,dy,1,dropAge<6?2:1,'#8f292f');
        }
    }
}
