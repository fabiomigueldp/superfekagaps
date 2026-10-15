import { paintMapActor, paintMapIsland, paintMapSea, type MapArtAssets } from './WorldMapArt';
import { atlasIslandCamera, localToAtlas, type AtlasBounds, type AtlasIslandDescriptor, type AtlasOverlayBounds } from './WorldAtlasModel';
import { mapToScreen, type MapCamera, type MapPoint } from './WorldMapModel';
import { paintCableCarLayer, paintCableLines, validCableFrame, type AtlasCableCar } from './WorldCableArt';
import { paintMaritimeBuoys, type AtlasMaritimeBuoy } from './WorldMaritimeArt';
import { paintVesselBow, paintVesselWake } from './WorldVesselArt';
import { VESSEL_HEAVE_CLEARANCE, VESSEL_MAX_ROTATION, type VesselMotion } from './WorldVesselMotion';
import { clipMapActorDepth, type MapActorOcclusion } from './WorldMapDepth';

export interface AtlasIslandLayer extends AtlasIslandDescriptor {
    assets: MapArtAssets;
    completed: readonly string[];
    secret: boolean;
    overlay?: AtlasIslandOverlay;
}
/** A small authored dock extension; its rectangle uses the island's local space. */
export interface AtlasIslandOverlay extends AtlasOverlayBounds {
    image: CanvasImageSource | null;
}
/** A connection spans fixed island placements and is already in atlas space. */
export interface AtlasConnectionOverlay extends AtlasOverlayBounds {
    image: CanvasImageSource | null;
}
export interface AtlasActor {
    point: MapPoint;
    walking: boolean;
    facingLeft: boolean;
    /** During boarding the actor can walk independently of the moored boat. */
    aboard: boolean;
    visible?: boolean;
    /** Only the occupied cabin gets a passenger between its authored layers. */
    cableCar?: string;
    /** Stable ferry identity; independent lines never borrow another hull. */
    boatId?: string;
    occlusion?: MapActorOcclusion;
}
export interface BoatAtlasCrop { x: number; y: number; w: number; h: number }
export interface BoatAtlasFrame {
    /** Uncropped dimensions of this heading, not of the entire sprite atlas. */
    width: number;
    height: number;
    /** Pixel coordinates in this frame of the passenger's foot on the deck. */
    passengerFoot: MapPoint;
    /** The invariant hull pivot, independently of the rotating passenger deck. */
    waterlineAnchor?: MapPoint;
    /** Full frame width in the same normalized x units as the island canvas. */
    widthInMap: number;
    /** Frame pixels per original Feka pixel; authored together with the deck. */
    passengerPixelScale: number;
    rear?: BoatAtlasCrop;
    foreground?: BoatAtlasCrop;
}
export interface BoatAtlasAssets {
    rear: CanvasImageSource | null;
    foreground: CanvasImageSource | null;
}
export interface AtlasBoat {
    id: string;
    foot: MapPoint;
    frame: BoatAtlasFrame;
    assets: BoatAtlasAssets;
    /** Radians in the authored world; the caller chooses the matching frame. */
    heading?: number;
    motion?: VesselMotion;
}
export interface AtlasPaintState {
    camera: MapCamera;
    time: number;
    reducedMotion: boolean;
    islands: readonly AtlasIslandLayer[];
    connections?: readonly AtlasConnectionOverlay[];
    buoys?: readonly AtlasMaritimeBuoy[];
    actor: AtlasActor;
    boats?: readonly AtlasBoat[];
    cableCars?: readonly AtlasCableCar[];
    cablePaths?: readonly (readonly MapPoint[])[];
}

/** Authored at 3× Feka pixels in a 384px frame with orthoScale 4.15 / 20.6.
 * Keep him the same world size while approaching and standing on the deck.
 */
const FEKA_PIXEL_MAP_WIDTH = (4.15 / 20.6) * 3 / 384;
const actorPixelMapWidth = (frame?: BoatAtlasFrame) => frame ? frame.widthInMap * frame.passengerPixelScale / frame.width : FEKA_PIXEL_MAP_WIDTH;
export function atlasActorScale(camera: MapCamera, frame?: BoatAtlasFrame): number {
    const pixelWidth = actorPixelMapWidth(frame);
    return Math.min(camera.width / 1.6, camera.height) * camera.zoom * 1.6 * pixelWidth;
}
/** Match the 16×26 actor and optional 9×3.2px shadow in world units. The
 * bounds fitter's 12px visual padding covers pixel rounding and the shadow's
 * fixed 1px upward offset, without imposing a close-view 44px focus margin. */
export function atlasActorBounds(foot: MapPoint, frame?: BoatAtlasFrame, shadow = true): AtlasBounds {
    const pixelWidth = actorPixelMapWidth(frame), radius = shadow ? 9 : 8;
    return { left: foot.x - radius * pixelWidth, right: foot.x + radius * pixelWidth,
        top: foot.y - 26 * 1.6 * pixelWidth, bottom: foot.y + (shadow ? 3.2 * 1.6 * pixelWidth : 0) };
}
function validFrame(frame: BoatAtlasFrame): boolean {
    return [frame.width, frame.height, frame.widthInMap, frame.passengerPixelScale].every(value => Number.isFinite(value) && value > 0) &&
        Number.isFinite(frame.passengerFoot.x) && Number.isFinite(frame.passengerFoot.y);
}
/** Bounds share the exact passenger anchor used for drawing, including tall roofs. */
export function atlasBoatBounds(foot: MapPoint, frame: BoatAtlasFrame, rotation = 0, heave = 0): AtlasBounds {
    if (!validFrame(frame)) return { left: foot.x, top: foot.y, right: foot.x, bottom: foot.y };
    foot = { x: foot.x, y: foot.y + (Number.isFinite(heave) ? heave : 0) };
    const mapPixelX = frame.widthInMap / frame.width, mapPixelY = mapPixelX * 1.6;
    const bounds = { left: foot.x - frame.passengerFoot.x * mapPixelX,
        right: foot.x + (frame.width - frame.passengerFoot.x) * mapPixelX,
        top: foot.y - frame.passengerFoot.y * mapPixelY,
        bottom: foot.y + (frame.height - frame.passengerFoot.y) * mapPixelY };
    if (!rotation || !Number.isFinite(rotation)) return bounds;
    const anchor = frame.waterlineAnchor ?? frame.passengerFoot;
    const pivot = { x: foot.x + (anchor.x - frame.passengerFoot.x) * mapPixelX,
        y: foot.y + (anchor.y - frame.passengerFoot.y) * mapPixelY };
    const corners = [bounds.left, bounds.right].flatMap(x => [bounds.top, bounds.bottom].map(y => {
        const dx = (x - pivot.x) * 1.6, dy = y - pivot.y;
        return { x: pivot.x + (dx * Math.cos(rotation) - dy * Math.sin(rotation)) / 1.6,
            y: pivot.y + dx * Math.sin(rotation) + dy * Math.cos(rotation) };
    }));
    return { left: Math.min(...corners.map(p => p.x)), right: Math.max(...corners.map(p => p.x)),
        top: Math.min(...corners.map(p => p.y)), bottom: Math.max(...corners.map(p => p.y)) };
}
/** Reserve the full sway envelope so camera fitting never follows each wave. */
export function atlasBoatFramingBounds(foot: MapPoint, frame: BoatAtlasFrame): AtlasBounds {
    const bounds = atlasBoatBounds(foot, frame);
    if (!validFrame(frame)) return bounds;
    const anchor = frame.waterlineAnchor ?? frame.passengerFoot;
    const radius = Math.hypot(Math.max(Math.abs(anchor.x), Math.abs(frame.width - anchor.x)),
        Math.max(Math.abs(anchor.y), Math.abs(frame.height - anchor.y))) * frame.widthInMap / frame.width * 1.6;
    const sway = 2 * radius * Math.sin(VESSEL_MAX_ROTATION / 2);
    return { left: bounds.left - sway / 1.6, right: bounds.right + sway / 1.6,
        top: bounds.top - sway - VESSEL_HEAVE_CLEARANCE, bottom: bounds.bottom + sway + VESSEL_HEAVE_CLEARANCE };
}
function paintBoatLayer(c: CanvasRenderingContext2D, camera: MapCamera, boat: AtlasBoat, foreground: boolean): void {
    const source = foreground ? boat.assets.foreground : boat.assets.rear;
    if (!source || !validFrame(boat.frame)) return;
    const { frame } = boat;
    const bounds = atlasBoatBounds(boat.foot, frame);
    const top = mapToScreen({ x: bounds.left, y: bounds.top }, camera);
    const bottom = mapToScreen({ x: bounds.right, y: bounds.bottom }, camera);
    const crop = foreground ? frame.foreground : frame.rear;
    if (crop && (![crop.x, crop.y, crop.w, crop.h].every(Number.isFinite) || crop.w <= 0 || crop.h <= 0)) return;
    c.save();
    c.imageSmoothingEnabled = true;
    if (crop) c.drawImage(source, crop.x, crop.y, crop.w, crop.h, top.x, top.y, bottom.x - top.x, bottom.y - top.y);
    else c.drawImage(source, top.x, top.y, bottom.x - top.x, bottom.y - top.y);
    c.restore();
}

// paintMapIsland's validated routes stay inside the full local [0, 1] bitmap.
// Its largest outside effects are the 10px secret badge and the 3.5px secret
// stroke with shadowBlur 7. Reserve three blur radii plus half the stroke and
// one filtering pixel; using alpha/art bounds would crop routes near the edge.
const ISLAND_PAINT_GUTTER = Math.ceil(Math.max(10, 3.5 / 2 + 3 * 7) + 1);
function islandOutsideViewport(camera: MapCamera): boolean {
    const top = mapToScreen({ x: 0, y: 0 }, camera), bottom = mapToScreen({ x: 1, y: 1 }, camera);
    return bottom.x < -ISLAND_PAINT_GUTTER || top.x > camera.width + ISLAND_PAINT_GUTTER ||
        bottom.y < -ISLAND_PAINT_GUTTER || top.y > camera.height + ISLAND_PAINT_GUTTER;
}

/** One pure scene pass: sea → optional buoys → fixed islands/routes → boat/Feka layers.
 * No events, DOM, image loading, canvas allocation or animation clock lives here.
 * The legacy distant-Porto decoration is intentionally absent from this scene.
 */
export function paintWorldAtlas(c: CanvasRenderingContext2D, state: AtlasPaintState): void {
    paintMapSea(c, state.camera, state.time, state.reducedMotion);
    if (!state.reducedMotion) for (const boat of state.boats ?? []) {
        const motion = boat.motion;
        if (!motion || !boat.assets.rear || !boat.assets.foreground || !validFrame(boat.frame) ||
            ![motion.speed, motion.screenHeading, motion.waterline.x, motion.waterline.y].every(Number.isFinite)) continue;
        const scale = atlasActorScale(state.camera, boat.frame);
        paintVesselWake(c, state.camera, motion, scale, state.time);
        if (motion.speed <= 0) continue;
        // The near-stern wash stays attached to the hull; the older foam above
        // remains in world space. Both fade continuously with propeller thrust.
        const speed = Math.min(1, motion.speed), strength = speed * speed * (3 - 2 * speed);
        const water = mapToScreen(motion.waterline, state.camera);
        const dx = Math.cos(motion.screenHeading), dy = Math.sin(motion.screenHeading);
        const stern = 15 * scale, length = 22 * strength * scale;
        c.save(); c.strokeStyle = `rgba(229,247,233,${.32 * strength})`; c.lineWidth = .7 * scale;
        for (const side of [-1, 1]) {
            c.beginPath(); c.moveTo(water.x - dx * stern - dy * side * 3 * scale, water.y - dy * stern + dx * side * 3 * scale);
            c.quadraticCurveTo(water.x - dx * (stern + length * .55) - dy * side * (3 + 2 * strength) * scale,
                water.y - dy * (stern + length * .55) + dx * side * (3 + 2 * strength) * scale,
                water.x - dx * (stern + length) - dy * side * (3 + 5 * strength) * scale,
                water.y - dy * (stern + length) + dx * side * (3 + 5 * strength) * scale);
            c.stroke();
        }
        c.restore();
        paintVesselBow(c, state.camera, motion, scale);
    }
    paintMaritimeBuoys(c, state.camera, state.buoys ?? [], state.time, state.reducedMotion);
    for (const island of state.islands) {
        const camera = atlasIslandCamera(state.camera, island.placement);
        // Fallback procedural scenery has different extents. Dock overlays may
        // reach into view even when this bitmap and all its routes are outside.
        if (!island.assets.island || !islandOutsideViewport(camera)) paintMapIsland(c, { ...island, camera,
            // The old Costa shadow is cropped at its image's right/bottom edges.
            // A continuous sea exposes that rectangle; keep only the terrain's
            // baked contact shading here, without changing the legacy painter.
            assets: { ...island.assets, shadow: null },
            time: state.time, reducedMotion: state.reducedMotion });
        const overlay = island.overlay;
        if (overlay?.image && [overlay.left, overlay.top, overlay.widthInMap, overlay.heightInMap].every(Number.isFinite) &&
            overlay.widthInMap > 0 && overlay.heightInMap > 0) {
            const top = mapToScreen(localToAtlas({ x: overlay.left, y: overlay.top }, island.placement), state.camera);
            const bottom = mapToScreen(localToAtlas({ x: overlay.left + overlay.widthInMap,
                y: overlay.top + overlay.heightInMap }, island.placement), state.camera);
            c.drawImage(overlay.image, top.x, top.y, bottom.x - top.x, bottom.y - top.y);
        }
    }
    for (const overlay of state.connections ?? []) {
        if (!overlay.image || ![overlay.left, overlay.top, overlay.widthInMap, overlay.heightInMap].every(Number.isFinite) ||
            overlay.widthInMap <= 0 || overlay.heightInMap <= 0) continue;
        const top = mapToScreen({ x: overlay.left, y: overlay.top }, state.camera);
        const bottom = mapToScreen({ x: overlay.left + overlay.widthInMap, y: overlay.top + overlay.heightInMap }, state.camera);
        c.drawImage(overlay.image, top.x, top.y, bottom.x - top.x, bottom.y - top.y);
    }
    paintCableLines(c, state.camera, state.cablePaths ?? []);
    const boats = (state.boats ?? []).filter(boat => boat.assets.rear && boat.assets.foreground && validFrame(boat.frame));
    const cableCars = (state.cableCars ?? []).filter(car => car.assets.rear && car.assets.foreground && validCableFrame(car.frame));
    const occupiedCabin = state.actor.aboard ? cableCars.find(car => car.id === state.actor.cableCar) : undefined;
    const occupiedBoat = state.actor.aboard && !state.actor.cableCar ? boats.find(boat => boat.id === state.actor.boatId) : undefined;
    let actorPainted = false;
    const actor = () => {
        actorPainted = true;
        const occluded = !occupiedCabin && !occupiedBoat ? state.actor.occlusion : undefined;
        if (occluded) {
            c.save();
            clipMapActorDepth(c, state.camera, state.actor.point, atlasActorScale(state.camera), occluded);
        }
        if (state.actor.visible !== false) paintMapActor(c, { camera: state.camera, marker: state.actor.point, time: state.time,
            reducedMotion: state.reducedMotion, walking: state.actor.walking, facingLeft: state.actor.facingLeft,
            scale: atlasActorScale(state.camera, occupiedCabin?.frame ?? occupiedBoat?.frame),
            shadow: !occupiedCabin && !occupiedBoat });
        if (occluded) c.restore();
    };
    // Keep each hull's rear, passenger and foreground together. A parked ferry
    // cannot accidentally capture the passenger riding a different connection.
    for (const boat of boats) {
        c.save();
        const heave = state.reducedMotion ? 0 : boat.motion?.heave ?? 0;
        if (heave && Number.isFinite(heave)) c.translate(0, heave * Math.min(state.camera.width / 1.6, state.camera.height) * state.camera.zoom);
        const rotation = state.reducedMotion ? 0 : boat.motion?.rotation ?? 0;
        if (rotation && Number.isFinite(rotation)) {
            const frame = boat.frame, anchor = frame.waterlineAnchor ?? frame.passengerFoot;
            const pixel = frame.widthInMap / frame.width;
            const pivot = mapToScreen({ x: boat.foot.x + (anchor.x - frame.passengerFoot.x) * pixel,
                y: boat.foot.y + (anchor.y - frame.passengerFoot.y) * pixel * 1.6 }, state.camera);
            c.translate(pivot.x, pivot.y); c.rotate(rotation); c.translate(-pivot.x, -pivot.y);
        }
        paintBoatLayer(c, state.camera, boat, false);
        if (boat === occupiedBoat) actor();
        paintBoatLayer(c, state.camera, boat, true);
        c.restore();
    }
    // Caller supplies physical back-to-front lane order. A passenger in the rear
    // car must not be painted artificially over a foreground counterweight car.
    for (const car of cableCars) {
        paintCableCarLayer(c, state.camera, car, false);
        if (car === occupiedCabin) actor();
        paintCableCarLayer(c, state.camera, car, true);
    }
    if (!actorPainted) actor();
}
