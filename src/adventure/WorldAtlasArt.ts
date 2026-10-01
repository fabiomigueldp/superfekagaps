import { paintMapActor, paintMapIsland, paintMapSea, type MapArtAssets } from './WorldMapArt';
import { atlasIslandCamera, localToAtlas, type AtlasBounds, type AtlasIslandDescriptor, type AtlasOverlayBounds } from './WorldAtlasModel';
import { mapToScreen, type MapCamera, type MapPoint } from './WorldMapModel';
import { paintCableCarLayer, paintCableLines, validCableFrame, type AtlasCableCar } from './WorldCableArt';

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
}
export interface BoatAtlasCrop { x: number; y: number; w: number; h: number }
export interface BoatAtlasFrame {
    /** Uncropped dimensions of this heading, not of the entire sprite atlas. */
    width: number;
    height: number;
    /** Pixel coordinates in this frame of the passenger's foot on the deck. */
    passengerFoot: MapPoint;
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
    foot: MapPoint;
    frame: BoatAtlasFrame;
    assets: BoatAtlasAssets;
    /** Radians in the authored world; the caller chooses the matching frame. */
    heading?: number;
}
export interface AtlasPaintState {
    camera: MapCamera;
    time: number;
    reducedMotion: boolean;
    islands: readonly AtlasIslandLayer[];
    connections?: readonly AtlasConnectionOverlay[];
    actor: AtlasActor;
    boat?: AtlasBoat;
    cableCars?: readonly AtlasCableCar[];
    cablePaths?: readonly (readonly MapPoint[])[];
}

/** Authored at 3× Feka pixels in a 384px frame with orthoScale 4.15 / 20.6.
 * Keep him the same world size while approaching and standing on the deck.
 */
const FEKA_PIXEL_MAP_WIDTH = (4.15 / 20.6) * 3 / 384;
export function atlasActorScale(camera: MapCamera, frame?: BoatAtlasFrame): number {
    const pixelWidth = frame ? frame.widthInMap * frame.passengerPixelScale / frame.width : FEKA_PIXEL_MAP_WIDTH;
    return Math.min(camera.width / 1.6, camera.height) * camera.zoom * 1.6 * pixelWidth;
}
function validFrame(frame: BoatAtlasFrame): boolean {
    return [frame.width, frame.height, frame.widthInMap, frame.passengerPixelScale].every(value => Number.isFinite(value) && value > 0) &&
        Number.isFinite(frame.passengerFoot.x) && Number.isFinite(frame.passengerFoot.y);
}
/** Bounds share the exact passenger anchor used for drawing, including tall roofs. */
export function atlasBoatBounds(foot: MapPoint, frame: BoatAtlasFrame): AtlasBounds {
    if (!validFrame(frame)) return { left: foot.x, top: foot.y, right: foot.x, bottom: foot.y };
    const mapPixelX = frame.widthInMap / frame.width, mapPixelY = mapPixelX * 1.6;
    return { left: foot.x - frame.passengerFoot.x * mapPixelX,
        right: foot.x + (frame.width - frame.passengerFoot.x) * mapPixelX,
        top: foot.y - frame.passengerFoot.y * mapPixelY,
        bottom: foot.y + (frame.height - frame.passengerFoot.y) * mapPixelY };
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

/** One pure scene pass: sea → both fixed islands/routes → boat/Feka layers.
 * No events, DOM, image loading, canvas allocation or animation clock lives here.
 * The legacy distant-Porto decoration is intentionally absent from this scene.
 */
export function paintWorldAtlas(c: CanvasRenderingContext2D, state: AtlasPaintState): void {
    paintMapSea(c, state.camera, state.time, state.reducedMotion);
    for (const island of state.islands) {
        paintMapIsland(c, { ...island, camera: atlasIslandCamera(state.camera, island.placement),
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
    const boat = state.boat, cableCars = (state.cableCars ?? []).filter(car => car.assets.rear && car.assets.foreground && validCableFrame(car.frame));
    const occupiedCabin = state.actor.aboard ? cableCars.find(car => car.id === state.actor.cableCar) : undefined;
    // An incomplete or unavailable atlas never becomes a placeholder drawing.
    const hasBoat = !!boat?.assets.rear && validFrame(boat.frame);
    if (boat && hasBoat) {
        paintBoatLayer(c, state.camera, boat, false);
        if (!state.actor.aboard || state.actor.cableCar) paintBoatLayer(c, state.camera, boat, true);
    }
    let actorPainted = false;
    const actor = () => {
        actorPainted = true;
        if (state.actor.visible !== false) paintMapActor(c, { camera: state.camera, marker: state.actor.point, time: state.time,
            reducedMotion: state.reducedMotion, walking: state.actor.walking, facingLeft: state.actor.facingLeft,
            scale: atlasActorScale(state.camera, occupiedCabin?.frame ?? (boat && validFrame(boat.frame) ? boat.frame : undefined)),
            shadow: !state.actor.aboard || (state.actor.cableCar ? !occupiedCabin : !hasBoat) });
    };
    // Caller supplies physical back-to-front lane order. A passenger in the rear
    // car must not be painted artificially over a foreground counterweight car.
    for (const car of cableCars) {
        paintCableCarLayer(c, state.camera, car, false);
        if (car === occupiedCabin) actor();
        paintCableCarLayer(c, state.camera, car, true);
    }
    if (!actorPainted) actor();
    if (boat && hasBoat && state.actor.aboard && !state.actor.cableCar) paintBoatLayer(c, state.camera, boat, true);
}
