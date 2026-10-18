import type { WorldGame } from '../../WorldGame';
import { TileType as T, FALLING_PLATFORM_ARM_MS, FALLING_PLATFORM_FALL_MS } from '../../../constants';
import { supportsStanding, isOneWayTile } from '../../../world/tileRules';
import { box as r, pixelLine as line } from '../../WorldPainting';
import { pixelText } from '../../../graphics/BitmapFont';
import { GUAIRA_COURSES, guairaCourseDetours, type GuairaCourseId } from './GuairaCourseDesign';
import { guairaCourseGuidance, guairaDetourAt, guairaDetourRecovery, guairaWarehouseRoute, updateGuairaCourseNavigation } from './GuairaCourseGuidance';
import { drawGuairaCourseLandmark, drawGuairaCourseFinale } from './GuairaCourseLandmarks';
import { drawGuairaFoe } from './GuairaFoeArt';
import { drawGuairaFoeProjectiles } from './GuairaFoeProjectiles';
import { drawGuairaLandscape } from './GuairaScenery';
import { drawGuairaClayGrain, drawGuairaStoneFace } from './GuairaMaterials';
import { drawGuairaWorkshopBackground } from './GuairaWorkshopBackground';
import { drawGuairaNeighborhood } from './GuairaNeighborhoodArt';
import { drawGuairaFixedScaffold, guairaOrdinaryScaffolds } from './GuairaScaffoldArt';
import { drawGuairaControlConnection } from './GuairaControlConnections';
import { drawGuairaBridgeHoists } from './GuairaSluiceArt';
import { drawGuairaPressureOutlet } from './respiros/GuairaRespirosArt';
import { drawCarrier, drawCarrierTrack } from '../../WorldTransportArt';
import {drawGuairaDockLandscape} from './GuairaDockLandscape';
import {drawGuairaAqueductLandscape} from './GuairaAqueductLandscape';
import {drawGuairaMaintenanceLandscape} from './GuairaMaintenanceLandscape';
import {drawGuairaRiceLock} from './GuairaRiceLockLandscape';
import {guairaDetourCoinCount} from './GuairaCourseExploration';
import {drawGuairaControl, guairaLinkedControl} from './GuairaControlArt';

type CourseGame=WorldGame & {readonly reducedMotion:boolean;finished:boolean};
function region(c:CanvasRenderingContext2D,boundary:number,after:boolean,paint:()=>void) {
    const edge=Math.max(0,Math.min(320,Math.round(boundary)));
    if(after&&edge>=320||!after&&edge<=0)return;
    c.save();c.beginPath();c.rect(after?edge:0,0,after?320-edge:edge,180);c.clip();paint();c.restore();
}

/** Existing chapter palette and hardware continue into the authored districts.
 * Clipping at the world seam prevents old exit scenery covering new collision. */
export function installGuairaCourseArt(game:CourseGame,id:GuairaCourseId) {
    const a=game.art,g=GUAIRA_COURSES[id],oldBackground=a.background.bind(a),oldTerrain=a.terrain.bind(a),oldObjects=a.objects.bind(a);
    const falling=game.renderer.drawFallingPlatforms.bind(game.renderer);
    game.renderer.drawFallingPlatforms=(platforms,camera,ox=0,oy=0)=>falling(platforms.filter(p=>(p.col+ox)*16<g.start),camera,ox,oy);
    a.foe=(c,e,cx,cy)=>drawGuairaFoe(c,e,cx,cy,game.reducedMotion);
    a.background=(c,island,cx,cy,time,variant)=>{
        region(c,g.start-cx,false,()=>oldBackground(c,island,cx,cy,time,variant));
        region(c,g.start-cx,true,()=>{
            const t=game.reducedMotion?0:game.objects.time;
            const inside=id==='galeria'||id==='alivio';
            // Both sides of the join use the same sky/profile and parallax
            // coordinates. Switching village to rice here used to draw two suns.
            if(inside)drawGuairaWorkshopBackground(c,id,cx,cy,t,game.reducedMotion);
            else drawGuairaLandscape(c,cx,cy,t,game.reducedMotion,id==='subida'?'heights':id==='patio'?'junction':id==='travessia'?'village':'rice');
            drawGuairaNeighborhood(c,id,cx,cy,t,game.reducedMotion);
            drawGuairaCourseLandmark(c,id,cx,cy,t,game.reducedMotion,game.level);
            drawGuairaCourseFinale(c,id,cx,cy,t,game.reducedMotion);
            drawGuairaDockLandscape(c,id,cx,cy,t,game.reducedMotion);
            drawGuairaAqueductLandscape(c,id,cx,cy,t,game.reducedMotion);
            drawGuairaMaintenanceLandscape(c,id,cx,cy,game.level);
            if(id==='travessia')drawGuairaRiceLock(c,cx,cy,t,game.reducedMotion);
            for(const b of game.objects.bodies)if(b.id.includes(':course:')&&b.kind==='platform')
                drawCarrierTrack(c,b,cx,cy,game.level);
            for(const deck of guairaOrdinaryScaffolds(game.level,id,cx-24,cx+344))
                drawGuairaFixedScaffold(c,game.level,deck.left,deck.right,deck.top,cx,cy);
        });
    };
    a.terrain=(c,level,island,cx,cy,time,reduced)=>{
        region(c,g.start-cx,false,()=>oldTerrain(c,level,island,cx,cy,time,reduced));
        region(c,g.start-cx,true,()=>{
            const tiles=level.getRenderTiles(),x=Math.round(cx),y=Math.round(cy);
            const board=(xx:number,yy:number,falling:boolean,stress=0)=>{
                r(c,xx,yy,16,6,falling?'#8b6554':'#715b4d');r(c,xx,yy,16,2,falling?'#e4b37e':'#e5c897');
                r(c,xx+1,yy+2,14,2,falling?'#b68058':'#b18b60');r(c,xx+3,yy+4,2,1,'#574e45');
                r(c,xx+1,yy+3,1,1,'#d8ba8c');r(c,xx+13,yy+3,1,1,'#574e45');
                if(falling){
                    line(c,xx+6,yy,xx+8,yy+2,'#6b4a44');line(c,xx+8,yy+2,xx+5,yy+5,'#6b4a44');
                    // The widening split remains legible with motion reduced.
                    if(stress>0){r(c,xx+7,yy+2,2,2,'#493e3b');r(c,xx+5,yy+4,2+Math.floor(stress*2),2,'#493e3b');}
                }
            };
            for(let row=Math.max(0,Math.floor(cy/16));row<Math.min(level.data.height,Math.ceil((cy+180)/16));row++)
                for(let col=Math.max(g.start/16,Math.floor(cx/16));col<Math.min(level.data.width,Math.ceil((cx+320)/16));col++){
                    const tile=tiles[row]?.[col]??0,xx=col*16-x,yy=row*16-y;
                    if(!tile)continue;
                    if(isOneWayTile(tile)){board(xx,yy,tile===T.PLATFORM_FALLING);continue;}
                    if(tile===T.BRICK_BREAKABLE){
                        r(c,xx,yy,16,16,'#825344');r(c,xx+1,yy+1,14,13,'#c48258');r(c,xx+1,yy+1,14,2,'#ebc28a');
                        line(c,xx+8,yy+2,xx+5,yy+6,'#66483e');line(c,xx+5,yy+6,xx+10,yy+10,'#66483e');line(c,xx+10,yy+10,xx+7,yy+14,'#66483e');continue;
                    }
                    if(id==='galeria'||id==='alivio'||id==='subida')drawGuairaStoneFace(c,xx,yy,col,row);
                    else {r(c,xx,yy,16,16,'#b17b56');drawGuairaClayGrain(c,xx,yy,col,row);r(c,xx,yy+14,16,2,'#a16c50');}
                    if(!supportsStanding(tiles[row-1]?.[col]??0)){r(c,xx,yy,16,2,'#efd7a5');r(c,xx,yy+2,16,2,'#c5a878');r(c,xx,yy+4,16,1,'#745c4b');}
                    if(!supportsStanding(tiles[row]?.[col-1]??0))r(c,xx,yy+4,2,12,'#dfbc8c');
                    if(!supportsStanding(tiles[row]?.[col+1]??0))r(c,xx+14,yy+4,2,12,'#77594b');
                }
            for(const b of level.getFallingPlatformRenderData())if(b.col*16>=g.start){
                const shake=b.phase==='arming'&&!game.reducedMotion?(Math.floor(b.timer/40)%2?1:-1):0;
                const xx=b.col*16-x,yy=b.row*16-y;
                if(b.phase==='falling'){
                    const fall=Math.max(0,1-b.timer/FALLING_PLATFORM_FALL_MS),drop=Math.round(16*fall*fall),split=1+Math.floor(fall*3);
                    c.save();c.globalAlpha*=1-fall*.85;
                    for(const side of [-1,1]){
                        const fx=xx+(side<0?-split:9+split),fy=yy+drop+(side>0?2:0);
                        r(c,fx,fy,7,5,'#8b6554');r(c,fx,fy,7,1,'#e4b37e');r(c,fx+1,fy+2,5,1,'#b68058');
                        r(c,fx+(side<0?6:0),fy+3,1,3,'#b68058');
                    }
                    c.restore();
                }else board(xx+shake,yy,true,b.phase==='arming'?1-b.timer/FALLING_PLATFORM_ARM_MS+.01:0);
            }
        });
    };
    a.objects=(c,objects,cx,cy,time,world,level,structures)=>{
        region(c,g.start-cx,false,()=>oldObjects(c,objects,cx,cy,time,world,level,structures));
        region(c,g.start-cx,true,()=>{
            const x=Math.round(cx),y=Math.round(cy);
            // Feed pipes belong behind the operating hardware, regardless of
            // mechanism order in the stage. A leftward return cannot paint
            // over its own status plaque or over a neighbouring outlet.
            for(const b of objects.bodies)if(b.id.includes(':course:')&&b.kind==='switch'){
                const target=objects.get(b.link??'');
                if(target&&Math.max(b.x+b.width,target.x+target.width)>=cx-16&&Math.min(b.x,target.x)<=cx+336)
                    drawGuairaControlConnection(c,b,target,x,y,objects.time,game.reducedMotion);
            }
            for(const b of objects.bodies.filter(b=>b.id.includes(':course:'))) {
                if(b.x+b.width<cx-140||b.x>cx+450)continue;
                if(b.kind==='jet')drawGuairaPressureOutlet(c,b,cx,cy,objects.time,game.reducedMotion);
                if(b.kind==='platform')drawCarrier(c,b,cx,cy,objects.time,world??game.stage.world);
                if(b.kind==='lift') {
                    drawGuairaBridgeHoists(c,b,g.floor,b.to?.y??g.floor,cx,cy);
                    r(c,b.x-x,b.y-y,b.width,8,'#6f594c');r(c,b.x-x,b.y-y,b.width,2,'#e7c995');
                    for(let dx=1;dx<b.width;dx+=16){r(c,b.x+dx-x,b.y+2-y,14,3,'#ac845b');r(c,b.x+dx+4-x,b.y+4-y,2,2,'#5b5148');}
                }
                if(b.kind==='switch') {
                    const target=objects.get(b.link??'');
                    if(target)drawGuairaControl(c,b,guairaLinkedControl(b,target),x,y,objects.time,game.reducedMotion);
                }
            }
            for(const room of g.rooms) {
                const xx=g.start+room.at+56-x,yy=g.floor-y;
                if(xx< -100||xx>320)continue;
                r(c,xx+3,yy-27,3,27,'#8a7054');r(c,xx-9,yy-31,27,13,'#685c4d');r(c,xx-8,yy-30,25,10,'#c6ad7c');
                pixelText(c,'→',xx+4,yy-29,'#4f5446',1,'center');
            }
            for(const d of guairaCourseDetours(id)){
            const sx=g.start+d.entry+(d.entrySignOffset??0)-x,sy=d.entryY-y;
            // An upward arrow and coin identify an optional climb. The post ends
            // at its real first deck, and never suggests an invisible landing.
            r(c,sx+7,sy-28,2,28,'#8a7054');r(c,sx-4,sy-32,26,13,'#685c4d');
            r(c,sx-3,sy-31,24,10,'#c6ad7c');pixelText(c,'↑',sx+3,sy-30,'#4f5446',1,'center');
            r(c,sx+13,sy-29,4,6,'#826444');r(c,sx+14,sy-29,2,5,'#efd49b');
            for(const[,right,top]of d.returns)pixelText(c,'↓',g.start+right-8-x,top+9-y,'#809278',1,'center');
            }
            const door=g.finish-x,finishY=g.finishY??g.floor;
            r(c,door+18,finishY-60-y,5,60,'#806a50');r(c,door+19,finishY-61-y,3,4,'#e2c08c');
            r(c,door+23,finishY-57-y,28,16,'#687c60');pixelText(c,'→',door+37,finishY-52-y,'#f6e2b1',1,'center');
        });
        drawGuairaFoeProjectiles(c,objects,cx,cy,game.reducedMotion);
    };
}

/** Preview real receiving surfaces, including the maintenance well and dock
 * transfers, while keeping the full helmet below the campaign HUD. */
export function frameGuairaCourse(game:CourseGame,id:GuairaCourseId,snap=false,px=game.camera.x,py=game.camera.y){
    const g=GUAIRA_COURSES[id],p=game.player.data,x=p.position.x,feet=p.position.y+p.height;
    if(x<g.start-48)return false;
    const view=updateGuairaCourseNavigation(game,id,snap);
    const targetX=Math.max(0,Math.min(g.end-320,x-(view.direction===1?72:232)));
    // Reversing the look-ahead changes the target by 160 px. Bound that pan so
    // a real turn does not produce a one-frame sideways camera jolt.
    const panX=Math.max(-8,Math.min(8,(targetX-px)*.12));
    game.camera.x=Math.max(0,x-296,Math.min(g.end-320,x-24,snap?targetX:px+panX));
    const local=x-g.start;
    const detour=guairaDetourAt(game,id);
    // The last receiving surface is the real bank, not another high deck.
    // Include it so the final drop never asks the player to trust an unseen floor.
    const finaleDescent=id==='alivio'&&local>=1888&&local<2176&&feet<g.floor;
    const pumpWalk=id==='respiros'&&local>=2528&&local<2848;
    const warehouse=id==='travessia'&&guairaWarehouseRoute(game);
    const riceBanks=id==='travessia'&&local>=2112&&local<2400;
    const transfer=id==='patio'&&local>=2128&&local<2624;
    const inspection=id==='galeria'&&local>=1856&&local<2368&&feet>g.floor+4;
    const aqueduct=id==='subida'&&local>=2352;
    const movingLandings=transfer?game.objects.bodies.filter(b=>b.id.includes(':transfer-')).map(b=>[b.x-g.start,b.x-g.start+b.width,b.y]):[];
    // On the way back, use the actual approach platforms, including the older
    // hydraulic scaffolds and the current state of collapsing boards. Ground
    // below the whole branch is not a useful substitute for its next foothold.
    const returnApproach:number[][]=[];
    if(detour&&view.direction===-1){
        for(let col=Math.floor((x-180)/16);col*16<x+p.width/2;col++)
            for(let row=Math.ceil((feet+8)/16);row*16<g.floor;row++){
                const tile=game.level.getTile(col,row);
                if(tile===T.PLATFORM||tile===T.PLATFORM_FALLING)returnApproach.push([col*16-g.start,(col+1)*16-g.start,row*16]);
            }
        returnApproach.push([detour.entry-48,detour.entry-16,g.floor]);
        returnApproach.sort((a,b)=>b[1]-a[1]||a[2]-b[2]);
    }
    const landings=detour?view.direction===-1?returnApproach:[...detour.returns,[detour.end,detour.end+16,g.floor] as const]
        :finaleDescent?[[2080,2128,g.floor-48],[2144,2176,g.floor]]
        :pumpWalk?[[2592,2656,g.floor],[2704,2752,g.floor],[2800,2848,g.floor],[2848,2896,g.floor]]
        :warehouse?[[2208,2256,g.floor-96],[2336,2432,g.floor-96],[2432,2480,g.floor-64],[2480,2528,g.floor-32],[2528,2560,g.floor]]
        :riceBanks?[[2240,2304,g.floor],[2400,2432,g.floor]]
        :inspection?[[2256,2304,g.floor+64],[2304,2352,g.floor+32],[2368,2400,g.floor]]
        :aqueduct?[[2384,2432,112],[2448,2608,96],[2640,2688,64],[2736,2768,48]]
        :transfer?[...movingLandings,[2336,2384,g.floor-48],[2528,2560,g.floor-48],[2560,2592,g.floor-32],[2592,2624,g.floor-16],[2624,2656,g.floor]].sort((a,b)=>a[0]-b[0]):[];
    const nextReturn=landings.find(([left,right,top])=>(detour&&view.direction===-1
        ?right<local+p.width/2&&local-right<180:left>local+p.width/2&&left-local<180)&&top>feet+8);
    const receiving=detour&&!guairaDetourRecovery(game,id)?Math.min(g.floor,Math.max(detour.top+96,nextReturn?nextReturn[2]+16:0))
        :id==='galeria'&&(local>=176&&local<448||local>=1856&&local<2368)?g.floor+96
        :aqueduct?(local>=2704?48:local>=2448?96:g.floor):transfer?Math.max(g.floor,feet,nextReturn?nextReturn[2]:0):g.floor;
    const targetY=Math.min(receiving-164,p.position.y-50);
    const next=snap?targetY:py+Math.max(-6,Math.min(6,(targetY-py)*.18));
    const previewFloor=nextReturn?Math.min(py+8,p.position.y-38,nextReturn[2]-172):-Infinity;
    game.camera.y=Math.max(feet-168,previewFloor,Math.min(p.position.y-38,next));
    return true;
}

export function drawGuairaCourseHUD(game:CourseGame,id:GuairaCourseId){
    const room=guairaCourseGuidance(game,id);
    if(!room||game.finished||game.state==='paused')return;
    const c=game.renderer.getContext();
    r(c,0,0,233,22,'#2e3e3e');pixelText(c,room.name,8,3,'#f0ddae');
    const detour=guairaDetourAt(game,id);
    if(detour){
        const count=guairaDetourCoinCount(game,id,detour);
        pixelText(c,`${count.collected}/${count.total}`,225,3,count.collected===count.total?'#c6e5b2':'#f0ddae',1,'right');
    }
    pixelText(c,room.hint,8,13,'#b6d9cb');
}

export function guairaCourseStatus(game:CourseGame,id:GuairaCourseId,fallback:string){
    if(game.state!=='playing'||game.finished||game.player.data.isDead)return fallback;
    const detour=guairaDetourAt(game,id),count=detour?guairaDetourCoinCount(game,id,detour):null;
    const detail=(guairaCourseGuidance(game,id)?.detail??fallback)+(count?` · Desvio: ${count.collected}/${count.total} moedas · registro no mapa ao concluir a fase`:'');
    const saved=game.store.save.checkpoint,cp=saved?.stage===game.stage.id?game.stage.checkpoints[saved.index]:undefined,p=game.player.data;
    if(cp&&p.isGrounded&&Math.abs(p.position.x-cp.x*16)<24&&Math.abs(p.position.y+p.height-cp.y*16)<4){
        const place={travessia:'a travessia',patio:'o pátio',respiros:'a passagem',subida:'a subida',galeria:'a galeria',alivio:'a câmara'}[id];
        return `Ponto seguro nesta tentativa · ${detail} · sair e reentrar reinicia ${place}`;
    }
    return detail;
}
