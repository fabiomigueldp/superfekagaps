import { mapToScreen, type MapCamera, type MapPoint } from './WorldMapModel';
import type { AtlasBounds } from './WorldAtlasModel';
import type { CableCar } from './WorldCableModel';

export interface CableAtlasCrop { x: number; y: number; w: number; h: number }
export interface CableAtlasFrame {
    width: number;
    height: number;
    widthInMap: number;
    passengerFoot: MapPoint;
    passengerPixelScale: number;
    rear: CableAtlasCrop;
    foreground: CableAtlasCrop;
}
export interface AtlasCableCar {
    id: CableCar;
    foot: MapPoint;
    frame: CableAtlasFrame;
    assets: { rear: CanvasImageSource | null; foreground: CanvasImageSource | null };
}

export function validCableFrame(frame: CableAtlasFrame): boolean {
    return [frame.width, frame.height, frame.widthInMap, frame.passengerPixelScale].every(value => Number.isFinite(value) && value > 0) &&
        Number.isFinite(frame.passengerFoot.x) && Number.isFinite(frame.passengerFoot.y) &&
        frame.passengerFoot.x >= 0 && frame.passengerFoot.x <= frame.width && frame.passengerFoot.y >= 0 && frame.passengerFoot.y <= frame.height &&
        [frame.rear, frame.foreground].every(crop => !!crop && [crop.x, crop.y, crop.w, crop.h].every(Number.isFinite) &&
            crop.x >= 0 && crop.y >= 0 && crop.w === frame.width && crop.h === frame.height);
}

/** Cabin roofs and hangers fit around the same measured passenger foot as Feka. */
export function atlasCableBounds(car: AtlasCableCar): AtlasBounds {
    if (!validCableFrame(car.frame)) return { left: car.foot.x, right: car.foot.x, top: car.foot.y, bottom: car.foot.y };
    const frame = car.frame, pixelX = frame.widthInMap / frame.width, pixelY = pixelX * 1.6;
    return { left: car.foot.x - frame.passengerFoot.x * pixelX,
        right: car.foot.x + (frame.width - frame.passengerFoot.x) * pixelX,
        top: car.foot.y - frame.passengerFoot.y * pixelY,
        bottom: car.foot.y + (frame.height - frame.passengerFoot.y) * pixelY };
}

/** Stateless layer pass. The atlas owner draws Feka between the occupied car's
 * rear and foreground, while the counterweight car is drawn without a passenger.
 */
export function paintCableCarLayer(ctx: CanvasRenderingContext2D, camera: MapCamera, car: AtlasCableCar, foreground: boolean): void {
    const source = foreground ? car.assets.foreground : car.assets.rear;
    if (!source || !validCableFrame(car.frame) || !Number.isFinite(car.foot.x) || !Number.isFinite(car.foot.y)) return;
    const bounds = atlasCableBounds(car), top = mapToScreen({ x: bounds.left, y: bounds.top }, camera);
    const bottom = mapToScreen({ x: bounds.right, y: bounds.bottom }, camera), crop = foreground ? car.frame.foreground : car.frame.rear;
    ctx.save(); ctx.imageSmoothingEnabled = true;
    ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, top.x, top.y, bottom.x - top.x, bottom.y - top.y);
    ctx.restore();
}
