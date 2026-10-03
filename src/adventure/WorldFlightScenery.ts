import { mapToScreen, type MapCamera, type MapPoint } from './WorldMapModel';
import type { AircraftPose } from './WorldAircraftModel';

type Polygon = readonly (readonly [number, number])[];
/** Fixed atlas geography, shared by outbound/return flights. No tiled wrapping,
 * elapsed-time scrolling, or integration drift: camera velocity is travel velocity.
 * These low floodplain banks occupy the channels between the authored terminals. */
export const FLIGHT_BANKS: readonly Polygon[] = [
    [[3.81,-.16],[3.94,-.22],[4.09,-.16],[4.16,-.04],[4.07,.04],[3.90,.02],[3.79,-.06]],
    [[3.48,.13],[3.57,.05],[3.68,.07],[3.72,.14],[3.66,.20],[3.53,.20]],
    [[3.10,.48],[3.27,.35],[3.45,.39],[3.58,.51],[3.49,.62],[3.25,.65],[3.11,.59]],
    [[3.29,.76],[3.50,.65],[3.74,.69],[3.80,.84],[3.67,.98],[3.41,.99],[3.25,.89]],
    [[3.63,.23],[3.78,.19],[3.91,.27],[3.94,.39],[3.83,.49],[3.65,.43],[3.57,.32]],
    [[3.09,-.15],[3.26,-.23],[3.49,-.18],[3.54,-.03],[3.41,.08],[3.21,.05]],
    [[3.70,1.12],[3.90,1.01],[4.12,1.08],[4.19,1.25],[3.97,1.36],[3.73,1.29]],
];
const FIELDS: readonly Polygon[] = [
    [[3.88,-.12],[3.96,-.16],[4.04,-.11],[3.96,-.06]],
    [[3.98,-.03],[4.06,-.08],[4.10,-.03],[4.05,.01]],
    [[3.55,.13],[3.59,.09],[3.65,.11],[3.61,.16]],
    [[3.20,.48],[3.29,.41],[3.40,.44],[3.34,.52]],
    [[3.36,.53],[3.43,.45],[3.51,.51],[3.46,.58]],
    [[3.32,.80],[3.47,.73],[3.57,.76],[3.42,.87]],
    [[3.45,.89],[3.60,.78],[3.72,.80],[3.64,.93]],
    [[3.66,.28],[3.76,.25],[3.83,.30],[3.73,.35]],
];
const CLOUDS = [[3.04,.18,.085],[3.51,-.20,.11],[3.91,.09,.075],[3.33,.93,.095],[4.19,.67,.10]] as const;
function polygon(ctx: CanvasRenderingContext2D, camera: MapCamera, points: Polygon, fill: string, dy = 0) {
    ctx.beginPath();
    points.forEach(([x,y], i) => { const p = mapToScreen({x,y: y + dy}, camera); if (i) ctx.lineTo(p.x,p.y); else ctx.moveTo(p.x,p.y); });
    ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
}
/** Ground first, then the existing airport artwork. Runways and scenery therefore
 * retain their existing ownership/layering; this never changes water-state art. */
export function paintFlightLandscape(ctx: CanvasRenderingContext2D, camera: MapCamera): void {
    ctx.save();
    FLIGHT_BANKS.forEach((bank, i) => {
        polygon(ctx, camera, bank, 'rgba(38,77,73,.18)', .024);
        polygon(ctx, camera, bank, '#537e78', .012);
        polygon(ctx, camera, bank, i === 5 ? '#73948c' : '#88a18b');
        ctx.strokeStyle = 'rgba(215,214,167,.38)'; ctx.lineWidth = 2; ctx.stroke();
    });
    FIELDS.forEach((field, i) => polygon(ctx, camera, field, ['#a5b08c','#789989','#b8b28b'][i % 3]));
    // Quiet rows on the cultivated floodplain. Gaps between banks remain canals.
    for (let i = 0; i < 5; i++) {
        const a = mapToScreen({x:3.47 + i*.025,y:.88-i*.018}, camera);
        const b = mapToScreen({x:3.56 + i*.025,y:.91-i*.018}, camera);
        ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);
        ctx.strokeStyle='rgba(67,105,86,.22)';ctx.lineWidth=2;ctx.stroke();
    }
    // Sparse low trees/reeds use the same top-lit, shallow isometric relief as
    // the islands. Authored clusters, not per-frame random noise.
    const scale = Math.min(camera.width / 1.6, camera.height) * camera.zoom;
    for (const [x,y] of [[3.84,-.08],[3.87,-.04],[3.91,-.02],[4.03,-.13],[4.06,-.11],[3.53,.15],[3.55,.17],[3.18,.55],[3.21,.57],[3.25,.58],[3.45,.61],[3.48,.58],
        [3.32,.87],[3.35,.90],[3.38,.92],[3.70,.87],[3.68,.90],
        [3.65,.35],[3.68,.38],[3.80,.39],[3.83,.36],[3.91,1.13],[3.97,1.16]] as const) {
        const p = mapToScreen({x,y},camera), r=scale*.008;
        ctx.fillStyle='rgba(34,67,56,.20)';ctx.beginPath();ctx.ellipse(p.x+r,p.y+r,r*1.8,r*.65,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#527965';ctx.beginPath();ctx.ellipse(p.x,p.y-r*.65,r,r*1.25,0,0,Math.PI*2);ctx.fill();
        ctx.fillStyle='#759780';ctx.beginPath();ctx.ellipse(p.x-r*.25,p.y-r*1.15,r*.7,r*.75,0,0,Math.PI*2);ctx.fill();
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
