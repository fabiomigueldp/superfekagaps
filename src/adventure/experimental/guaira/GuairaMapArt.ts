import { PLAYER_PALETTE, PLAYER_SPRITES, PLAYER_WALK } from '../../../assets/playerSpriteSpec';
import type { GuairaMetadata, GuairaPoint, GuairaMapModel } from './GuairaMapModel';

export interface GuairaCamera { x: number; y: number; imageWidth: number; width: number; height: number }
/** Decorative water owns only authored source-image regions, never navigation. */
export interface GuairaMapWaterEffect {
    readonly regions: ReadonlyArray<{ bounds: readonly [number, number, number, number] }>;
    draw(ctx: CanvasRenderingContext2D, camera: GuairaCamera, visibleSeconds: number, reducedMotion: boolean): void;
}
/** Same physical pixel scale as the Blender sprite clearance audit. */
export const GUAIRA_FEKA_PIXEL_WIDTH = (4.15 / 20.6) * 3 / 384;
export function guairaScreenPoint(p: GuairaPoint, camera: GuairaCamera): GuairaPoint {
    return { x: camera.x + p.x * camera.imageWidth, y: camera.y + p.y * camera.imageWidth / 1.6 };
}
export function guairaCamera(metadata: GuairaMetadata, width: number, height: number, focus: GuairaPoint, overview: boolean): GuairaCamera {
    const w = Math.max(1, width), h = Math.max(1, height), b = metadata.artBounds;
    const fit = Math.min(Math.max(1, w - 24) / (b.right - b.left), Math.max(1, h - 24) * 1.6 / (b.bottom - b.top));
    // Phones follow the road at a readable scale; overview remains available at all sizes.
    const imageWidth = overview || w >= 760 ? fit : Math.max(fit, Math.min(1000, w / .43, h * 1.6 / .48));
    const fullHeight = imageWidth / 1.6;
    const centerX = overview || w >= 760 ? (b.left + b.right) / 2 : focus.x;
    const centerY = overview || w >= 760 ? (b.top + b.bottom) / 2 : focus.y - .05;
    const clamp = (v: number, low: number, high: number) => low > high ? (low + high) / 2 : Math.max(low, Math.min(high, v));
    return { width: w, height: h, imageWidth,
        x: clamp(w / 2 - centerX * imageWidth, w - b.right * imageWidth - 12, 12 - b.left * imageWidth),
        y: clamp(h / 2 - centerY * fullHeight, h - b.bottom * fullHeight - 12, 12 - b.top * fullHeight) };
}
export function approachGuairaCamera(current: GuairaCamera, target: GuairaCamera, seconds: number): GuairaCamera {
    const t = 1 - Math.exp(-Math.max(0, Math.min(seconds, .05)) * 14);
    const lerp = (a: number, b: number) => Math.abs(a - b) < .08 ? b : a + (b - a) * t;
    return { ...target, x: lerp(current.x, target.x), y: lerp(current.y, target.y), imageWidth: lerp(current.imageWidth, target.imageWidth) };
}
export function paintGuairaMap(ctx: CanvasRenderingContext2D, image: CanvasImageSource, camera: GuairaCamera, model: GuairaMapModel, time: number,
    water?: { effect: GuairaMapWaterEffect; seconds: number }): void {
    const { width, height } = camera;
    ctx.clearRect(0, 0, width, height);
    const bg = ctx.createLinearGradient(0, 0, width, height);
    bg.addColorStop(0, '#24494f'); bg.addColorStop(1, '#142e37');
    ctx.fillStyle = bg; ctx.fillRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(image, camera.x, camera.y, camera.imageWidth, camera.imageWidth / 1.6);
    water?.effect.draw(ctx, camera, water.seconds, model.reducedMotion);
    // The Blender roads already explain the connection. Never draw a synthetic line over water.
    const p = guairaScreenPoint(model.point, camera), scale = camera.imageWidth * GUAIRA_FEKA_PIXEL_WIDTH;
    ctx.fillStyle = '#25353b55'; ctx.beginPath(); ctx.ellipse(p.x, p.y - 1, scale * 8, scale * 2.6, 0, 0, Math.PI * 2); ctx.fill();
    const frame = model.moving && !model.reducedMotion ? PLAYER_WALK[Math.floor(time / 95) % PLAYER_WALK.length] : PLAYER_SPRITES.idle;
    ctx.imageSmoothingEnabled = false;
    for (let row = 0; row < frame.length; row++) for (let col = 0; col < frame[row].length; col++) {
        const color = PLAYER_PALETTE[frame[row][col]]; if (!color) continue;
        ctx.fillStyle = color;
        ctx.fillRect(Math.round(p.x - 8 * scale + (model.facingLeft ? 15 - col : col) * scale),
            Math.round(p.y - frame.length * scale + row * scale), Math.ceil(scale), Math.ceil(scale));
    }
}

/** A stationary map restores only water regions; Feka is repainted above any overlap. */
export function paintGuairaWaterFrame(ctx: CanvasRenderingContext2D, image: CanvasImageSource, camera: GuairaCamera,
    model: GuairaMapModel, time: number, water: { effect: GuairaMapWaterEffect; seconds: number }): void {
    const scale = camera.imageWidth / 1920;
    ctx.save();
    try {
        ctx.beginPath();
        for (const { bounds: [x, y, width, height] } of water.effect.regions) {
            // The small border includes interpolation pixels without widening the water mask.
            const left = Math.floor(camera.x + x * scale) - 2, top = Math.floor(camera.y + y * scale) - 2;
            const right = Math.ceil(camera.x + (x + width) * scale) + 2, bottom = Math.ceil(camera.y + (y + height) * scale) + 2;
            ctx.rect(left, top, right - left, bottom - top);
        }
        ctx.clip();
        paintGuairaMap(ctx, image, camera, model, time, water);
    } finally {
        ctx.restore();
    }
}
