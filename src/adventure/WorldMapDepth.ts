import type { AtlasOverlayBounds } from './WorldAtlasModel';
import { mapToScreen, type MapCamera, type MapPoint } from './WorldMapModel';

/** Linear camera distance packed into R:G. 65535 means empty sky/water.
 * Decode once on load; rendering reads only the few pixels around Feka. */
export interface MapDepthField extends AtlasOverlayBounds {
    width: number;
    height: number;
    values: Uint16Array;
    unitMeters: number;
    uprightDepthPerImageHeight: number;
}
export interface MapActorOcclusion { field: MapDepthField; distance: number }

export function decodeMapDepth(rgba: Uint8ClampedArray, width: number, height: number): Uint16Array | null {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || rgba.length !== width * height * 4) return null;
    const values = new Uint16Array(width * height);
    for (let i = 0; i < values.length; i++) values[i] = rgba[i * 4 + 3] ? rgba[i * 4] * 256 + rgba[i * 4 + 1] : 65535;
    return values;
}

export function mapDepthOccludes(field: MapDepthField, x: number, y: number, distance: number): boolean {
    if (x < 0 || y < 0 || x >= field.width || y >= field.height || !Number.isFinite(distance)) return false;
    const value = field.values[Math.floor(y) * field.width + Math.floor(x)];
    // A small geometric bias keeps contact shadows and the paving under his
    // soles, while foreground rails still cover the appropriate sprite pixels.
    return value !== 65535 && value * field.unitMeters < distance - .12;
}

/** Clip the shared pixel actor against the authored island, without another
 * canvas, frame readback, material replacement or a separate animation clock.
 * The upright billboard's depth changes with height under an angled camera. */
export function clipMapActorDepth(c: CanvasRenderingContext2D, camera: MapCamera, foot: MapPoint,
    actorScale: number, occlusion: MapActorOcclusion): void {
    const { field, distance } = occlusion;
    if (!Number.isFinite(distance) || field.width <= 0 || field.height <= 0 || field.values.length !== field.width * field.height) return;
    const top = mapToScreen({ x: field.left, y: field.top }, camera);
    const bottom = mapToScreen({ x: field.left + field.widthInMap, y: field.top + field.heightInMap }, camera);
    const dx = (bottom.x - top.x) / field.width, dy = (bottom.y - top.y) / field.height;
    if (!(dx > 0 && dy > 0)) return;
    const p = mapToScreen(foot, camera), footY = (p.y - top.y) / dy;
    const left = Math.max(0, Math.floor((p.x - 10 * actorScale - 2 - top.x) / dx));
    const right = Math.min(field.width, Math.ceil((p.x + 10 * actorScale + 2 - top.x) / dx));
    const first = Math.max(0, Math.floor((p.y - 28 * actorScale - 2 - top.y) / dy));
    const last = Math.min(field.height, Math.ceil((p.y + 5 * actorScale + 2 - top.y) / dy));
    c.beginPath(); c.rect(0, 0, camera.width, camera.height);
    for (let y = first; y < last; y++) {
        const z = distance + (y + .5 - footY) * field.uprightDepthPerImageHeight / field.height;
        let start = -1;
        for (let x = left; x <= right; x++) {
            const hidden = x < right && mapDepthOccludes(field, x, y, z);
            if (hidden && start < 0) start = x;
            if (!hidden && start >= 0) {
                c.rect(top.x + start * dx, top.y + y * dy, (x - start) * dx, dy); start = -1;
            }
        }
    }
    c.clip('evenodd');
}
