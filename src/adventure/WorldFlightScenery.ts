import { mapToScreen, type MapCamera, type MapPoint } from './WorldMapModel';
import type { AircraftPose } from './WorldAircraftModel';

type Polygon = readonly (readonly [number, number])[];
/** Fixed atlas geography, shared by outbound/return flights. No tiled wrapping,
 * elapsed-time scrolling, or integration drift: camera velocity is travel velocity.
 * These low floodplain banks occupy the channels between the authored terminals. */
export const FLIGHT_BANKS: readonly Polygon[] = [
    // The eastern bank has two broad lobes joined by a narrow, recessed neck.
    // Its inlet faces the western spit, giving the water a readable bend.
    [[3.81,-.16],[3.92,-.21],[4.05,-.16],[4.13,-.08],[4.09,-.01],[3.98,.035],
        [3.89,.02],[3.84,.07],[3.86,.15],[3.91,.25],[3.93,.35],[3.86,.44],
        [3.76,.46],[3.62,.39],[3.59,.31],[3.69,.24],[3.77,.22],[3.78,.12],
        [3.76,.035],[3.80,-.055]],
    // A low upstream shoal, not another miniature farm tile.
    [[3.49,.13],[3.56,.08],[3.63,.075],[3.70,.13],[3.66,.16],[3.59,.15],[3.53,.18]],
    // West-facing spit with a sheltered bite in its southern shore.
    [[3.08,.49],[3.18,.44],[3.27,.36],[3.35,.38],[3.41,.42],[3.44,.47],
        [3.53,.50],[3.56,.55],[3.48,.60],[3.39,.62],[3.34,.59],[3.31,.555],
        [3.26,.58],[3.20,.615],[3.10,.59],[3.07,.54]],
    // One long southern floodplain replaces the two unrelated lower cutouts.
    // A narrow neck and a deep eastern inlet leave the river corridor open.
    [[3.26,.79],[3.40,.72],[3.52,.67],[3.67,.71],[3.77,.75],[3.80,.84],
        [3.74,.91],[3.69,.95],[3.72,1.035],[3.80,1.09],[3.91,1.04],[4.07,1.10],
        [4.15,1.21],[4.08,1.29],[3.96,1.33],[3.81,1.30],[3.70,1.24],
        [3.67,1.12],[3.64,1.04],[3.57,.985],[3.42,.97],[3.29,.92],[3.24,.87]],
    // A quiet, darker foothill shelf remains behind the mountain terminal.
    [[3.08,-.14],[3.18,-.20],[3.29,-.23],[3.42,-.19],[3.50,-.12],
        [3.53,-.03],[3.45,.015],[3.38,.07],[3.30,.04],[3.20,.06],[3.13,.005]],
];
type ShoreSegment = { start: readonly [number, number]; control: readonly [number, number]; end: readonly [number, number] };
type Shore = { segments: readonly ShoreSegment[]; shadedRuns: readonly (readonly ShoreSegment[])[]; litRuns: readonly (readonly ShoreSegment[])[]; top: number; bottom: number };
const insetCorner = (corner: readonly [number, number], neighbor: readonly [number, number]): readonly [number, number] => [corner[0]+(neighbor[0]-corner[0])*.24,corner[1]+(neighbor[1]-corner[1])*.24];
const midpoint = (a: readonly [number, number], b: readonly [number, number]): readonly [number, number] => [(a[0]+b[0])/2,(a[1]+b[1])/2];
// One quadratic per authored corner: gently rounded headlands and concave inlets,
// not random erosion or per-frame tessellation. Reused by every material layer.
const BANK_SHORES: readonly Shore[] = FLIGHT_BANKS.map(bank => {
    const segments=bank.map((control,i) => ({ start:insetCorner(control,bank[(i+bank.length-1)%bank.length]),control,
        end:insetCorner(control,bank[(i+1)%bank.length]) }));
    const faces=segments.flatMap((segment,i) => {
        const previous=segments[(i+segments.length-1)%segments.length].end;
        return [{start:previous,control:midpoint(previous,segment.start),end:segment.start},segment];
    });
    const runs = (accept:(face:ShoreSegment)=>boolean): ShoreSegment[][] => {
        const result: ShoreSegment[][]=[];
        for (const face of faces) {
            if (!accept(face)) continue;
            const last=result.at(-1), end=last?.at(-1)?.end;
            if (end && end[0]===face.start[0] && end[1]===face.start[1]) last!.push(face); else result.push([face]);
        }
        return result;
    };
    return { segments,
        shadedRuns:runs(({start,end})=>end[0]<start[0] && Math.abs(end[1]-start[1])>(start[0]-end[0])*.5),
        litRuns:runs(({start,end})=>end[0]>start[0]),
        top:Math.min(...bank.map(p=>p[1])),bottom:Math.max(...bank.map(p=>p[1])) };
});
const FIELDS: readonly Polygon[] = [
    [[3.87,-.12],[3.95,-.16],[4.025,-.12],[4.055,-.08],[3.965,-.055],[3.90,-.075]],
    [[3.20,.475],[3.285,.41],[3.355,.435],[3.38,.47],[3.33,.52],[3.255,.53]],
    [[3.385,.525],[3.435,.49],[3.505,.525],[3.475,.56],[3.42,.575]],
    [[3.32,.81],[3.455,.745],[3.555,.775],[3.525,.81],[3.425,.875]],
    [[3.47,.90],[3.59,.81],[3.71,.81],[3.695,.865],[3.625,.925]],
    [[3.66,.315],[3.74,.265],[3.815,.30],[3.84,.34],[3.75,.365]],
];
// Broad flood-deposited margins occupy only the inside of the lower bank bends.
// They follow the land's shape instead of outlining every edge with a foam ring.
const SILT: readonly Polygon[] = [
    [[3.49,.135],[3.56,.105],[3.63,.105],[3.685,.13],[3.635,.137],[3.575,.128],[3.53,.155]],
    [[3.105,.535],[3.16,.56],[3.22,.565],[3.27,.545],[3.305,.53],[3.28,.565],[3.22,.592],[3.145,.572]],
    [[3.705,.985],[3.73,1.05],[3.81,1.12],[3.91,1.08],[3.97,1.09],[3.90,1.115],
        [3.81,1.15],[3.755,1.12],[3.715,1.07]],
];
const TREES = [[3.86,-.08],[3.89,-.045],[3.93,-.02],[4.03,-.13],[4.06,-.10],[3.585,.11],[3.61,.12],[3.16,.52],[3.19,.535],[3.23,.54],[3.43,.595],[3.47,.575],
        [3.32,.87],[3.35,.895],[3.39,.92],[3.72,.86],[3.69,.89],[3.675,1.025],[3.71,1.085],[3.73,1.11],
        [3.65,.35],[3.68,.38],[3.80,.39],[3.83,.36],[3.79,.14],[3.81,.17],[3.85,.215],[3.91,1.20],[3.97,1.23]] as const;
const CLOUDS = [[3.04,.18,.085],[3.51,-.20,.11],[3.91,.09,.075],[3.33,.93,.095],[4.19,.67,.10]] as const;
function polygon(ctx: CanvasRenderingContext2D, camera: MapCamera, points: Polygon, fill: string | CanvasGradient, dy = 0) {
    ctx.beginPath();
    points.forEach(([x,y], i) => { const p = mapToScreen({x,y: y + dy}, camera); if (i) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y); });
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
function shorePath(ctx: CanvasRenderingContext2D, camera: MapCamera, shore: Shore, dy = 0) {
    ctx.beginPath();
    const start = mapToScreen({ x: shore.segments[0].start[0], y: shore.segments[0].start[1]+dy },camera);
    ctx.moveTo(start.x,start.y);
    for (const {start,control,end} of shore.segments) {
        const a=mapToScreen({x:start[0],y:start[1]+dy},camera); ctx.lineTo(a.x,a.y);
        const c = mapToScreen({x:control[0],y:control[1]+dy},camera), p = mapToScreen({x:end[0],y:end[1]+dy},camera);
        ctx.quadraticCurveTo(c.x,c.y,p.x,p.y);
    }
    ctx.closePath();
}
/** A low earthen bank, with its water contact below the turf. Relief and lighting
 * belong to atlas space, so the return trip sees the same shore from the same sun. */
function paintBank(ctx: CanvasRenderingContext2D, camera: MapCamera, shore: Shore, index: number, scale: number) {
    const depth = .014;
    shorePath(ctx,camera,shore,depth+.009); ctx.fillStyle='rgba(30,65,62,.16)'; ctx.fill();
    shorePath(ctx,camera,shore,depth); ctx.fillStyle='#85836a'; ctx.fill();
    ctx.strokeStyle = 'rgba(151,186,167,.24)'; ctx.lineWidth = scale * .015; ctx.stroke();
    // The lowered footprint supplies the sun-facing earth. Shade only steeper
    // exposed faces, batched into one path per bank; keep their curved contour.
    ctx.beginPath();
    for (const run of shore.shadedRuns) {
        const a=mapToScreen({x:run[0].start[0],y:run[0].start[1]},camera), d=depth*scale;
        ctx.moveTo(a.x,a.y);
        for (const {control,end} of run) {
            const c=mapToScreen({x:control[0],y:control[1]},camera), b=mapToScreen({x:end[0],y:end[1]},camera);
            ctx.quadraticCurveTo(c.x,c.y,b.x,b.y);
        }
        const end=run[run.length-1].end, b=mapToScreen({x:end[0],y:end[1]},camera);
        ctx.lineTo(b.x,b.y+d);
        for (let i=run.length-1;i>=0;i--) {
            const {start,control}=run[i], c=mapToScreen({x:control[0],y:control[1]},camera), a=mapToScreen({x:start[0],y:start[1]},camera);
            ctx.quadraticCurveTo(c.x,c.y+d,a.x,a.y+d);
        }
        ctx.closePath();
    }
    ctx.fillStyle='#697967'; ctx.fill();
    const a=mapToScreen({x:0,y:shore.top},camera), b=mapToScreen({x:0,y:shore.bottom},camera);
    const turf=ctx.createLinearGradient(a.x,a.y,b.x,b.y);
    turf.addColorStop(0,index===4?'#81998a':'#a0ab8d');
    turf.addColorStop(1,index===4?'#708b7c':'#839b80');
    shorePath(ctx,camera,shore); ctx.fillStyle=turf; ctx.fill();
    ctx.beginPath();
    for (const run of shore.litRuns) {
        const a=mapToScreen({x:run[0].start[0],y:run[0].start[1]},camera); ctx.moveTo(a.x,a.y);
        for (const {control,end} of run) {
            const c=mapToScreen({x:control[0],y:control[1]},camera), b=mapToScreen({x:end[0],y:end[1]},camera);
            ctx.quadraticCurveTo(c.x,c.y,b.x,b.y);
        }
    }
    ctx.strokeStyle='rgba(218,218,168,.36)'; ctx.lineWidth=scale*.002; ctx.stroke();
}
/** Ground first, then the existing airport artwork. Runways and scenery therefore
 * retain their existing ownership/layering; this never changes water-state art. */
export function paintFlightLandscape(ctx: CanvasRenderingContext2D, camera: MapCamera): void {
    ctx.save();
    const scale = Math.min(camera.width / 1.6, camera.height) * camera.zoom;
    BANK_SHORES.forEach((bank, i) => paintBank(ctx, camera, bank, i, scale));
    SILT.forEach(bank => polygon(ctx,camera,bank,'rgba(192,184,137,.38)'));
    FIELDS.forEach((field, i) => polygon(ctx, camera, field, ['#a5b08c','#b3b18a','#789989'][i % 3]));
    // Quiet rows on the cultivated floodplain. Gaps between banks remain canals.
    for (let i = 0; i < 5; i++) {
        const a = mapToScreen({x:3.47 + i*.025,y:.88-i*.018}, camera);
        const b = mapToScreen({x:3.56 + i*.025,y:.91-i*.018}, camera);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.strokeStyle='rgba(67,105,86,.22)';ctx.lineWidth=scale*.003;ctx.stroke();
    }
    // Sparse low trees/reeds use the same top-lit, shallow isometric relief as
    // the islands. Authored clusters, not per-frame random noise.
    const trees = TREES.map(([x,y])=>mapToScreen({x,y},camera));
    const r=scale*.008;
    // Three bounded compound paths keep the authored foliage cheap, even when
    // the static reduced-motion camera can see the entire river landscape.
    for (const [color,dx,dy,rx,ry] of [
        ['rgba(34,67,56,.20)',1,1,1.8,.65],['#527965',0,-.65,1,1.25],['#759780',-.25,-1.15,.7,.75],
    ] as const) {
        ctx.fillStyle=color; ctx.beginPath();
        for (const p of trees) {
            ctx.moveTo(p.x+(dx+rx)*r,p.y+dy*r);
            ctx.ellipse(p.x+dx*r,p.y+dy*r,rx*r,ry*r,0,0,Math.PI*2);
        }
        ctx.fill();
    }
    // Northern foothills stay in the atlas north of the floodplain, never scrolling
    // into a runway as a screen-space decoration.
    polygon(ctx,camera,[[3.16,-.08],[3.28,-.27],[3.41,-.08],[3.32,.01]],'#638781');
    polygon(ctx,camera,[[3.28,-.27],[3.41,-.08],[3.32,.01]],'#567971');
    polygon(ctx,camera,[[3.28,-.27],[3.32,-.20],[3.27,-.21],[3.24,-.19]],'#9caf9e');
    ctx.restore();
}
/** Clouds are below the aircraft and above terrain. Their finite atlas anchors
 * move with a slightly nearer camera plane; reduced motion uses the static camera
 * unchanged. No clouds are accumulated or spawned on replay. */
export function paintFlightAtmosphere(ctx: CanvasRenderingContext2D, camera: MapCamera, pose: AircraftPose): void {
    const strength = pose.reducedMotion ? .10 : Math.min(1, pose.altitude / .10);
    if (strength <= 0) return;
    ctx.save();ctx.globalAlpha = strength;
    const cloudCamera = pose.reducedMotion ? camera : { ...camera, zoom: camera.zoom * 1.12 };
    const scale = Math.min(camera.width / 1.6, camera.height) * cloudCamera.zoom;
    for (const [x,y,r] of CLOUDS) {
        const p = mapToScreen({x,y}, cloudCamera);
        ctx.save();ctx.translate(p.x,p.y);ctx.rotate(-.12);ctx.scale(1,.34);
        const radius=r*scale*1.7, mist=ctx.createRadialGradient(-radius*.18,-radius*.1,0,0,0,radius);
        mist.addColorStop(0,'rgba(238,242,225,.48)');mist.addColorStop(.5,'rgba(228,239,222,.24)');mist.addColorStop(1,'rgba(228,239,222,0)');
        ctx.fillStyle=mist;ctx.beginPath();ctx.arc(0,0,radius,0,Math.PI*2);ctx.fill();ctx.restore();
    }
    // Direction and length come from the actual pose, never a constant sideways
    // conveyor. Keep the center clear for the silhouette and the bottom for controls.
    if (!pose.reducedMotion && pose.speed > .02) {
        const length = Math.min(34, 8 + pose.speed * 65);
        const center: MapPoint = mapToScreen(pose.position,camera);
        ctx.strokeStyle='rgba(238,245,222,.23)';ctx.lineWidth=1.2;
        for (const [x,y] of [[-255,-70],[260,100],[-185,125]] as const) {
            const px=center.x+x, py=center.y+y;
            ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(px-Math.cos(pose.heading)*length,py-Math.sin(pose.heading)*length);ctx.stroke();
        }
    }
    ctx.restore();
}
