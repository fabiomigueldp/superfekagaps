import { pixelText, textWidth } from '../graphics/BitmapFont';
import { ART } from '../graphics/palette';

const KINDS = ['stage', 'selected', 'complete', 'locked', 'selected-complete', 'dock-right', 'dock-left'] as const;
type BaseMapSignKind = typeof KINDS[number];
export type MapSignKind = BaseMapSignKind | 'factory-right';
export type MapSignDirection = 'left' | 'right';
export interface MapTravelSign { label: string; direction: MapSignDirection; wide?: boolean }
interface Point { x: number; y: number }
interface Rect extends Point { width: number; height: number }
export interface MapSignFrame {
    kind: MapSignKind;
    sourceRect: Rect;
    displaySize: { width: number; height: number };
    dpr: 2;
    foot: Point;
    letterCenter: Point;
    usableFace: Rect;
    letterPixelScale: 2;
}
export interface MapSignMetadata { width: number; height: number; frames: Record<BaseMapSignKind, MapSignFrame> }
export interface MapSignAtlas { metadata: MapSignMetadata; image: HTMLImageElement }
export interface MapFactorySignAtlas { frame: MapSignFrame; image: HTMLImageElement }
const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);
const finite = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);
const point = (value: unknown): value is Point => object(value) && finite(value.x) && finite(value.y);
const rect = (value: unknown): value is Rect => point(value) && object(value) && finite(value.width) && finite(value.height) && value.width > 0 && value.height > 0;

/** Invalid optional decoration never replaces the legible procedural signs. */
export function parseMapSignMetadata(value: unknown): MapSignMetadata | null {
    if (!object(value) || value.version !== 1 || !object(value.atlas) || value.atlas.image !== 'signs-atlas.webp' ||
        !Number.isInteger(value.atlas.width) || !Number.isInteger(value.atlas.height) ||
        !finite(value.atlas.width) || !finite(value.atlas.height) || value.atlas.width <= 0 || value.atlas.height <= 0 ||
        value.atlas.width > 2048 || value.atlas.height > 2048 || !Array.isArray(value.frames) || value.frames.length !== KINDS.length) return null;
    const frames = {} as Record<BaseMapSignKind, MapSignFrame>;
    for (const raw of value.frames) {
        if (!object(raw) || typeof raw.kind !== 'string' || !KINDS.includes(raw.kind as BaseMapSignKind)) return null;
        const kind = raw.kind as BaseMapSignKind, dock = kind.startsWith('dock-'), width = dock ? 104 : 56, height = dock ? 56 : 58;
        if (frames[kind] || raw.dpr !== 2 || raw.letterPixelScale !== 2 || !object(raw.displaySize) ||
            raw.displaySize.width !== width || raw.displaySize.height !== height || !rect(raw.sourceRect) ||
            ![raw.sourceRect.x, raw.sourceRect.y, raw.sourceRect.width, raw.sourceRect.height].every(Number.isInteger) ||
            raw.sourceRect.x < 0 || raw.sourceRect.y < 0 || raw.sourceRect.width !== width * 2 || raw.sourceRect.height !== height * 2 ||
            raw.sourceRect.x + raw.sourceRect.width > value.atlas.width || raw.sourceRect.y + raw.sourceRect.height > value.atlas.height ||
            !point(raw.foot) || raw.foot.x < 0 || raw.foot.x > width || raw.foot.y < 0 || raw.foot.y > height ||
            !rect(raw.usableFace) || raw.usableFace.x < 0 || raw.usableFace.y < 0 ||
            raw.usableFace.x + raw.usableFace.width > width || raw.usableFace.y + raw.usableFace.height > height ||
            !point(raw.letterCenter)) return null;
        const text = dock ? 'PORTO' : '6-5', x = Math.round(raw.letterCenter.x - textWidth(text, 2) / 2), y = Math.round(raw.letterCenter.y - 7);
        if (x < raw.usableFace.x || x + textWidth(text, 2) > raw.usableFace.x + raw.usableFace.width ||
            y < raw.usableFace.y || y + 14 > raw.usableFace.y + raw.usableFace.height) return null;
        frames[kind] = { kind, sourceRect: { ...raw.sourceRect }, displaySize: { width, height }, dpr: 2,
            foot: { ...raw.foot }, letterCenter: { ...raw.letterCenter }, usableFace: { ...raw.usableFace }, letterPixelScale: 2 };
    }
    return KINDS.every(kind => frames[kind]) ? { width: value.atlas.width, height: value.atlas.height, frames } : null;
}

/** The wider Factory face is optional; invalid geometry keeps its procedural fallback. */
export function parseMapFactorySignMetadata(value: unknown): MapSignFrame | null {
    if (!object(value) || value.version !== 1 || !object(value.atlas) || value.atlas.image !== 'signs-factory.webp' ||
        value.atlas.width !== 256 || value.atlas.height !== 112 || !Array.isArray(value.frames) || value.frames.length !== 1) return null;
    const raw = value.frames[0], width = 128, height = 56;
    if (!object(raw) || raw.kind !== 'factory-right' || raw.dpr !== 2 || raw.letterPixelScale !== 2 ||
        !object(raw.displaySize) || raw.displaySize.width !== width || raw.displaySize.height !== height ||
        !rect(raw.sourceRect) || raw.sourceRect.x !== 0 || raw.sourceRect.y !== 0 || raw.sourceRect.width !== 256 || raw.sourceRect.height !== 112 ||
        !point(raw.foot) || raw.foot.x < 0 || raw.foot.x > width || raw.foot.y < 0 || raw.foot.y > height ||
        !rect(raw.usableFace) || raw.usableFace.x < 0 || raw.usableFace.y < 0 ||
        raw.usableFace.x + raw.usableFace.width > width || raw.usableFace.y + raw.usableFace.height > height ||
        !point(raw.letterCenter)) return null;
    const textWidthPx = textWidth('FÁBRICA', 2), x = Math.round(raw.letterCenter.x - textWidthPx / 2), y = Math.round(raw.letterCenter.y - 7);
    if (x < raw.usableFace.x || x + textWidthPx > raw.usableFace.x + raw.usableFace.width ||
        y - 4 < raw.usableFace.y || y + 14 > raw.usableFace.y + raw.usableFace.height) return null;
    return { kind: 'factory-right', sourceRect: { ...raw.sourceRect }, displaySize: { width, height }, dpr: 2,
        foot: { ...raw.foot }, letterCenter: { ...raw.letterCenter }, usableFace: { ...raw.usableFace }, letterPixelScale: 2 };
}
function loadSignImage(url: string, width: number, height: number, signal: AbortSignal): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
        if (signal.aborted) { resolve(null); return; }
        const image = new Image(); image.decoding = 'async';
        const finish = (result: HTMLImageElement | null) => {
            image.onload = null; image.onerror = null; signal.removeEventListener('abort', aborted); resolve(result);
        };
        const aborted = () => finish(null);
        image.onload = () => finish(!signal.aborted && image.naturalWidth === width && image.naturalHeight === height ? image : null);
        image.onerror = () => finish(null);
        signal.addEventListener('abort', aborted, { once: true });
        image.src = url;
    });
}
/** One base load is shared by all stage and short-arrow canvases. */
export async function loadMapSignAtlas(prefix: string, signal: AbortSignal): Promise<MapSignAtlas | null> {
    if (signal.aborted || typeof Image === 'undefined') return null;
    try {
        const response = await fetch(prefix + 'signs-atlas.meta.json', { signal });
        const metadata = response.ok ? parseMapSignMetadata(await response.json()) : null;
        if (!metadata || signal.aborted) return null;
        const image = await loadSignImage(prefix + 'signs-atlas.webp', metadata.width, metadata.height, signal);
        return image && !signal.aborted ? { image, metadata } : null;
    } catch { return null; }
}
/** Requested only when the cargo-bridge sign or Factory region is visible. */
export async function loadMapFactorySignAtlas(prefix: string, signal: AbortSignal): Promise<MapFactorySignAtlas | null> {
    if (signal.aborted || typeof Image === 'undefined') return null;
    try {
        const response = await fetch(prefix + 'signs-factory.meta.json', { signal });
        const frame = response.ok ? parseMapFactorySignMetadata(await response.json()) : null;
        if (!frame || signal.aborted) return null;
        const image = await loadSignImage(prefix + 'signs-factory.webp', 256, 112, signal);
        return image && !signal.aborted ? { image, frame } : null;
    } catch { return null; }
}

export function mapStageSignKind(selected: boolean, completed: boolean, open: boolean): BaseMapSignKind {
    return !open ? 'locked' : completed ? selected ? 'selected-complete' : 'complete' : selected ? 'selected' : 'stage';
}
function paint(canvas: HTMLCanvasElement, image: HTMLImageElement, frame: MapSignFrame, text: string): CanvasRenderingContext2D | null {
    const size = frame.displaySize, source = frame.sourceRect;
    canvas.width = size.width * frame.dpr; canvas.height = size.height * frame.dpr;
    // The button's geometry stays unchanged; only the transparent canvas follows
    // the measured foot. Integer CSS pixels preserve the original bitmap glyphs.
    canvas.style.transform = `translate(${Math.round(size.width / 2 - frame.foot.x)}px, ${Math.round(size.height - frame.foot.y)}px)`;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;
    ctx.setTransform(2, 0, 0, 2, 0, 0); ctx.imageSmoothingEnabled = false;
    ctx.drawImage(image, source.x, source.y, source.width, source.height, 0, 0, size.width, size.height);
    pixelText(ctx, text, Math.round(frame.letterCenter.x - textWidth(text, 2) / 2), Math.round(frame.letterCenter.y - 7), ART.ink, 2);
    return ctx;
}
export function paintPhysicalStageSign(canvas: HTMLCanvasElement, atlas: MapSignAtlas | null, id: string,
    selected: boolean, completed: boolean, open: boolean): boolean {
    if (!atlas) return false;
    const kind = mapStageSignKind(selected, completed, open), ctx = paint(canvas, atlas.image, atlas.metadata.frames[kind], id);
    if (!ctx) return false;
    // One original bitmap pointer complements the subtle brass strip at 1×.
    // The locked frame keeps its attached pin and the combined frame its pennant.
    if (selected) pixelText(ctx, '↓', 28, 0, ART.ink, 2, 'center');
    return true;
}
/** Explicit text and direction distinguish ferry PORTO from the return bridge PORTO. */
export function paintPhysicalTravelSign(canvas: HTMLCanvasElement, atlas: MapSignAtlas | null, factory: MapFactorySignAtlas | null,
    sign: MapTravelSign, available: boolean): boolean {
    const frame = sign.wide ? factory?.frame : atlas?.metadata.frames[sign.direction === 'left' ? 'dock-left' : 'dock-right'];
    const image = sign.wide ? factory?.image : atlas?.image;
    if (!frame || !image || (sign.wide && sign.direction !== 'right') || textWidth(sign.label, 2) > frame.usableFace.width) return false;
    const ctx = paint(canvas, image, frame, sign.label);
    if (!ctx) return false;
    if (!available) {
        // Every arrow keeps its timber support and attached gate on the departure side.
        const postX = sign.wide ? 24 : sign.direction === 'left' ? 80 : 23;
        ctx.fillStyle = ART.ink; ctx.fillRect(postX, 33, 2, 5);
        ctx.fillStyle = ART.gold; ctx.fillRect(postX - 1, 35, 4, 1);
    }
    return true;
}
/** Retained for the original Costa↔Porto callers. */
export function paintPhysicalDockSign(canvas: HTMLCanvasElement, atlas: MapSignAtlas | null, world: number, available: boolean): boolean {
    return paintPhysicalTravelSign(canvas, atlas, null, { label: world === 1 ? 'COSTA' : 'PORTO', direction: world === 1 ? 'left' : 'right' }, available);
}
