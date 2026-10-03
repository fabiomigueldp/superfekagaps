import { mapToScreen, type MapCamera, type MapPoint } from './WorldMapModel';
import type { AircraftPose } from './WorldAircraftModel';
export interface AircraftFrame {
    index: number;
    screenHeading: number;
    groundAnchor: MapPoint;
    passengerAnchor: MapPoint;
    propeller: MapPoint;
    propellerUp: MapPoint;
    propellerSide: MapPoint;
    wingTips: [MapPoint, MapPoint];
    flaps?: [MapPoint[], MapPoint[]];
    source: { x: number; y: number; width: number; height: number };
}
export interface AircraftMetadata {
    version: 1;
    kind: 'stol-courier';
    headingCount: number;
    frame: { width: number; height: number; widthInMap: number };
    frames: AircraftFrame[];
    atlas: { path: string; width: number; height: number };
}
export interface AircraftAssets { image: CanvasImageSource; metadata: AircraftMetadata }
const record = (v: unknown): Record<string, unknown> | null => v !== null && typeof v === 'object' ? v as Record<string, unknown> : null;
const finite = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const point = (v: unknown): v is MapPoint => { const p = record(v); return !!p && finite(p.x) && finite(p.y); };
export function parseAircraftMetadata(value: unknown): AircraftMetadata | null {
    const data = record(value), frame = record(data?.frame), atlas = record(data?.atlas);
    if (!data || data.version !== 1 || data.kind !== 'stol-courier' || data.headingCount !== 32 || !frame || !atlas ||
        !finite(frame.width) || frame.width < 1 || frame.width > 512 || !finite(frame.height) || frame.height < 1 || frame.height > 512 ||
        !finite(frame.widthInMap) || frame.widthInMap <= 0 || frame.widthInMap > 1 ||
        atlas.path !== '/assets/world/map/journey-aircraft.webp' || atlas.width !== frame.width * 8 || atlas.height !== frame.height * 4 ||
        !Array.isArray(data.frames) || data.frames.length !== 32) return null;
    for (const [index, raw] of data.frames.entries()) {
        const f = record(raw), source = record(f?.source);
        if (!f || f.index !== index || !finite(f.screenHeading) || !source || source.x !== (index % 8) * frame.width ||
            source.y !== Math.floor(index / 8) * frame.height || source.width !== frame.width || source.height !== frame.height ||
            !['groundAnchor', 'passengerAnchor', 'propeller', 'propellerUp', 'propellerSide'].every(key => point(f[key])) ||
            !Array.isArray(f.wingTips) || f.wingTips.length !== 2 || !f.wingTips.every(point) ||
            f.flaps !== undefined && (!Array.isArray(f.flaps) || f.flaps.length !== 2 ||
                !f.flaps.every(flap => Array.isArray(flap) && flap.length === 4 && flap.every(point)))) return null;
    }
    return data as unknown as AircraftMetadata;
}
/** No navigation side effects, and no silent success on missing/invalid artwork.
 * Callers keep the origin selected if this returns null. */
export async function loadAircraftAssets(signal?: AbortSignal): Promise<AircraftAssets | null> {
    const controller = new AbortController(), abort = () => controller.abort();
    signal?.addEventListener('abort', abort, { once: true });
    if (signal?.aborted) controller.abort();
    const timeout = setTimeout(abort, 12000);
    try {
        const response = await fetch('/assets/world/map/journey-aircraft.meta.json', { signal: controller.signal });
        if (!response.ok) return null;
        const metadata = parseAircraftMetadata(await response.json());
        if (!metadata || controller.signal.aborted) return null;
        const image = await new Promise<HTMLImageElement | null>(resolve => {
            const img = new Image();
            const finish = (result: HTMLImageElement | null) => {
                img.onload = null; img.onerror = null; controller.signal.removeEventListener('abort', canceled); resolve(result);
            };
            const canceled = () => { img.src = ''; finish(null); };
            controller.signal.addEventListener('abort', canceled, { once: true });
            img.onload = () => finish(img.naturalWidth === metadata.atlas.width && img.naturalHeight === metadata.atlas.height ? img : null);
            img.onerror = () => finish(null); img.src = metadata.atlas.path;
        });
        return image ? { image, metadata } : null;
    } catch { return null; }
    finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}
/** Closest genuine 3D view using projected heading, never an incorrect image flip. */
export function aircraftFrameForHeading(metadata: AircraftMetadata, heading: number): AircraftFrame {
    let best = metadata.frames[0], score = -Infinity;
    for (const frame of metadata.frames) {
        const match = Math.cos(frame.screenHeading - heading);
        if (match > score) { best = frame; score = match; }
    }
    return best;
}
/** Ground shadow + aircraft + articulated propeller. Stateless bounded VFX:
 * twelve ground-dust motes, two wingtip wisps; never water spray or contrails.
 * Aircraft cabin already contains the seated passenger; don't draw Feka on top. */
export function paintAircraftTravel(ctx: CanvasRenderingContext2D, camera: MapCamera, pose: AircraftPose, assets: AircraftAssets, elapsedSeconds: number): void {
    if (![pose.position.x, pose.position.y, pose.ground.x, pose.ground.y, pose.scale, pose.heading].every(Number.isFinite) || pose.scale <= 0) return;
    const frame = aircraftFrameForHeading(assets.metadata, pose.heading), shape = assets.metadata.frame;
    const screen = mapToScreen(pose.position, camera), ground = mapToScreen(pose.ground, camera);
    const scale = Math.min(camera.width / 1.6, camera.height) * camera.zoom * 1.6 * shape.widthInMap * pose.scale / shape.width;
    if (!Number.isFinite(scale) || scale <= 0) return;
    const elapsed = Number.isFinite(elapsedSeconds) ? Math.max(0, elapsedSeconds) : 0;
    const rotation = pose.reducedMotion ? 0 : pose.bank + pose.pitch * Math.cos(pose.heading);
    ctx.save(); ctx.imageSmoothingEnabled = true;
    // Contact shadow stays on the ground; widening and fading makes lift legible.
    ctx.save(); ctx.translate(ground.x, ground.y); ctx.rotate(pose.heading);
    ctx.fillStyle = `rgba(28,39,37,${.23 / (1 + pose.altitude * 12)})`;
    ctx.beginPath(); ctx.ellipse(0, 0, 75 * scale * (1 + pose.altitude), 24 * scale * (1 + pose.altitude * 2), 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    if (!pose.reducedMotion && pose.dust > 0) {
        ctx.save(); ctx.translate(ground.x, ground.y); ctx.rotate(pose.heading);
        for (let i = 0; i < 12; i++) {
            const age = (elapsed * 2.7 + i * .618) % 1;
            ctx.fillStyle = `rgba(205,175,126,${pose.dust * (1 - age) * .25})`;
            ctx.beginPath(); ctx.ellipse((-8 - age * 80) * scale, (Math.sin(i * 2.4) * (4 + age * 13) - age * 7) * scale,
                (2 + age * 8) * scale, (1.5 + age * 4) * scale, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    }
    ctx.translate(screen.x, screen.y); ctx.rotate(rotation); ctx.scale(scale, scale); ctx.translate(-frame.groundAnchor.x, -frame.groundAnchor.y);
    const rect = frame.source;
    ctx.drawImage(assets.image, rect.x, rect.y, rect.width, rect.height, 0, 0, shape.width, shape.height);
    // Projected hinged flaps give the wing a subtle loaded response. The hinge
    // stays fixed; only the trailing edge deflects. No elastic/cartoon wobble.
    if (!pose.reducedMotion && frame.flaps) {
        const load = pose.stage === 'takeoff-roll' || pose.stage === 'landing-roll' ? .9 : pose.altitude > 0 ? .28 : 0;
        for (const [sideIndex, flap] of frame.flaps.entries()) {
            const deflect = load * 2 + pose.bank * (sideIndex ? -9 : 9);
            ctx.fillStyle = sideIndex ? '#d6cba7' : '#e1d6b2'; ctx.strokeStyle = 'rgba(48,105,105,.65)'; ctx.lineWidth = .55;
            ctx.beginPath();
            flap.forEach((p, i) => { const y = p.y + (i > 1 ? deflect : 0); if (!i) ctx.moveTo(p.x, y); else ctx.lineTo(p.x, y); });
            ctx.closePath(); ctx.fill(); ctx.stroke();
        }
    }
    // The propeller lives in its true projected Y/Z plane, not a screen circle.
    const origin = frame.propeller, up = { x: frame.propellerUp.x - origin.x, y: frame.propellerUp.y - origin.y },
        side = { x: frame.propellerSide.x - origin.x, y: frame.propellerSide.y - origin.y };
    ctx.save(); ctx.transform(side.x, side.y, up.x, up.y, origin.x, origin.y);
    if (!pose.reducedMotion && pose.propellerSpeed > 12) {
        ctx.fillStyle = 'rgba(228,217,183,.13)'; ctx.beginPath(); ctx.arc(0, 0, 1, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = 'rgba(244,221,160,.27)'; ctx.lineWidth = .04; ctx.stroke();
        ctx.globalAlpha = .18;
    }
    const angle = pose.reducedMotion || pose.complete ? .45 : elapsed * 22;
    ctx.rotate(angle); ctx.fillStyle = '#394642';
    ctx.fillRect(-.08, -.96, .16, 1.92); ctx.fillStyle = '#e6bd65';
    ctx.fillRect(-.08, -.96, .16, .14); ctx.fillRect(-.08, .82, .16, .14); ctx.restore();
    if (!pose.reducedMotion && pose.airWisps > .01) {
        ctx.strokeStyle = `rgba(241,239,211,${pose.airWisps * .25})`; ctx.lineWidth = 1.1;
        for (const wing of frame.wingTips) {
            ctx.beginPath(); ctx.moveTo(wing.x, wing.y);
            ctx.quadraticCurveTo(wing.x - Math.cos(pose.heading) * 18, wing.y - Math.sin(pose.heading) * 18 - 3,
                wing.x - Math.cos(pose.heading) * 38, wing.y - Math.sin(pose.heading) * 38 + Math.sin(elapsed * 3) * 2); ctx.stroke();
        }
    }
    ctx.restore();
}
