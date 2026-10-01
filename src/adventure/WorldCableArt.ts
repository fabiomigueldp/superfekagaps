import { mapToScreen, type MapCamera, type MapPoint } from './WorldMapModel';
import type { AtlasBounds } from './WorldAtlasModel';

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
    /** Globally unique vehicle identity, normally its line's authored ride edge. */
    id: string;
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

/** Authored wire curves stay vector-sized rather than loading a mostly empty
 * spanning bitmap. Their knots include the measured passenger-grip offset. */
export function paintCableLines(ctx: CanvasRenderingContext2D, camera: MapCamera, paths: readonly (readonly MapPoint[])[]): void {
    const scale = Math.min(camera.width / 1.6, camera.height) * camera.zoom * 1.6;
    const width = Math.max(1, scale * .045 / 20.6);
    ctx.save(); ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    for (const path of paths) {
        if (path.length < 2 || path.some(point => !Number.isFinite(point.x) || !Number.isFinite(point.y))) continue;
        ctx.beginPath();
        path.forEach((point, index) => {
            const screen = mapToScreen(point, camera);
            if (index === 0) ctx.moveTo(screen.x, screen.y); else ctx.lineTo(screen.x, screen.y);
        });
        ctx.strokeStyle = '#314b62'; ctx.lineWidth = width; ctx.stroke();
        ctx.strokeStyle = '#879cac'; ctx.lineWidth = Math.max(.4, width * .35); ctx.stroke();
    }
    ctx.restore();
}
