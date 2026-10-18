import { box as r, pixelLine as line } from '../../WorldPainting';
import { pixelText } from '../../../graphics/BitmapFont';
import type { MovingBody } from '../../WorldPhysics';

/** Enamel is reserved for the controls, aged brass for their plumbing. Water's
 * bright cyan remains exclusive to the actual jets. Shape also carries state. */
export const GUAIRA_CONTROL_COLORS = Object.freeze({
    ink: '#38494a', shadow: '#655447', brass: '#b48b58', edge: '#d6b77d',
    enamel: '#f2dfaf', recess: '#596964', quiet: '#99856b',
    ready: '#a9cfaf', working: '#ebbd70',
});
const P = GUAIRA_CONTROL_COLORS;
export type GuairaControlPhase = 'available' | 'moving' | 'settled' | 'warning' | 'locked';
type ControlBody = Pick<MovingBody, 'x' | 'y' | 'width' | 'height'> & { readonly changedAt?: number };
export interface GuairaControlState {
    readonly kind: 'bridge' | 'isolation' | 'route';
    readonly phase: GuairaControlPhase;
    readonly progress: number;
    readonly direction?: -1 | 1;
    readonly circuit?: 'C';
    readonly supplied?: 'a' | 'b';
    readonly selected?: 'a' | 'b';
}
const clamp = (n: number) => Math.max(0, Math.min(1, Number.isFinite(n) ? n : 0));

/** Travel is read from the receiving deck, not from the button or render clock.
 * Isolation means closed, not merely a jet between its dangerous cycles. */
export function guairaLinkedControl(control: ControlBody, target: MovingBody): GuairaControlState {
    const direction = target.x + target.width / 2 < control.x + control.width / 2 ? -1 : 1;
    if (target.kind === 'jet') return { kind: 'isolation', phase: target.active ? 'settled' : 'available',
        progress: target.active ? 1 : 0, direction };
    const home = target.home?.y ?? target.y, top = target.to?.y ?? home;
    const progress = home === top ? Number(target.active) : clamp((target.y - home) / (top - home));
    const moving = target.y !== (target.active ? top : home);
    return { kind: 'bridge', phase: moving ? 'moving' : target.active ? 'settled' : 'available', progress, direction };
}

/** The cast sole stays flush with the true body. Only its spring-loaded tread
 * compresses; rendering neither shifts collision nor advances the mechanism. */
export function drawGuairaControlBase(c: CanvasRenderingContext2D, b: ControlBody, cx: number, cy: number,
    time: number, reduced: boolean, phase: GuairaControlPhase, progress = 0) {
    const x = Math.round(b.x - cx), y = Math.round(b.y - cy), w = Math.round(b.width), h = Math.round(b.height);
    const age = b.changedAt === undefined ? Infinity : time - b.changedAt;
    const press = !reduced && age >= 0 && age < 160 ? age >= 20 && age < 80 ? 2 : 1 : 0;
    const tone = phase === 'settled' ? P.ready : phase === 'moving' || phase === 'warning' ? P.working : phase === 'locked' ? P.quiet : P.enamel;
    r(c, x, y, w, h, P.ink);
    r(c, x + 1, y + 2, w - 2, h - 3, P.shadow);
    r(c, x + 2, y + 1 + press, w - 4, 3, P.brass);
    r(c, x + 3, y + 1 + press, w - 6, 1, tone);
    r(c, x + 6, y + 3, w - 12, h - 4, P.ink);
    for (const dx of [2, w - 4]) {
        r(c, x + dx, y + h - 3, 2, 2, P.edge);
        r(c, x + dx, y + h - 2, 1, 1, P.shadow);
    }
    // A recessed sight window is filled only by the real response. Amber
    // remains amber while a bridge is still travelling in either direction.
    r(c, x + w - 8, y + 3, 2, 3, P.quiet);
    const fill = Math.round(clamp(progress) * 3);
    if (fill) r(c, x + w - 8, y + 6 - fill, 2, fill, phase === 'moving' || phase === 'warning' ? P.working : P.ready);
}

function arrow(c: CanvasRenderingContext2D, x: number, y: number, d: -1 | 1, color: string) {
    r(c, x, y + 2, 5, 1, color);
    r(c, x + 2, y, 1, 5, color);
    r(c, x + (d === 1 ? 3 : 1), y + 1, 1, 3, color);
}

/** Small screwed-on plaques identify the result; the impact arrow remains in
 * the tread. No floating marker, unsupported glyph or decorative flashing. */
export function drawGuairaControl(c: CanvasRenderingContext2D, b: ControlBody, state: GuairaControlState,
    cx: number, cy: number, time: number, reduced: boolean) {
    const x = Math.round(b.x - cx), y = Math.round(b.y - cy), w = Math.round(b.width);
    const px = x + Math.floor((w - 24) / 2), py = y - 18;
    for (const dx of [6, 16]) {
        r(c, px + dx, py + 13, 2, 5, P.shadow);
        r(c, px + dx, py + 13, 1, 5, P.edge);
    }
    r(c, px, py + 1, 24, 12, P.ink); r(c, px + 1, py, 22, 14, P.ink);
    r(c, px + 2, py + 1, 20, 11, P.brass); r(c, px + 2, py + 2, 20, 9, P.enamel);
    for (const dx of [1, 22]) r(c, px + dx, py + 6, 1, 1, P.edge);
    if (state.kind === 'route') {
        // The large letter is the supplied ramal. During transfer the smaller
        // arrow points to the requested one; it cannot announce it as ready.
        pixelText(c, (state.supplied ?? 'b').toUpperCase(), px + 4, py + 3, P.ink);
        if (state.phase === 'warning') {
            arrow(c, px + 10, py + 4, 1, P.shadow);
            pixelText(c, (state.selected ?? 'a').toUpperCase(), px + 16, py + 3, P.ink);
        } else {
            r(c, px + 14, py + 5, 5, 1, P.ink); r(c, px + 18, py + 4, 1, 5, P.ink);
            r(c, px + 14, py + 7, 5, 1, P.ink);
        }
    } else if (state.kind === 'bridge') {
        r(c, px + 4, py + 4, 2, 6, P.shadow); r(c, px + 11, py + 4, 2, 6, P.shadow);
        const deckY = py + 8 - Math.round(clamp(state.progress) * 4);
        r(c, px + 5, deckY, 7, 2, P.ink);
        arrow(c, px + 16, py + 4, state.direction ?? 1, P.ink);
    } else {
        // A closed transverse gate visibly interrupts the three etched jets.
        for (const dx of [4, 7, 10]) r(c, px + dx, py + 3, 1, 5, P.recess);
        r(c, px + 3, py + 9, 10, 1, P.ink);
        if (state.phase === 'settled') { r(c, px + 3, py + 5, 10, 2, P.ink); r(c, px + 4, py + 5, 8, 1, P.brass); }
        if (state.circuit) pixelText(c, state.circuit, px + 16, py + 3, P.ink);
        else arrow(c, px + 16, py + 4, state.direction ?? 1, P.ink);
    }
    r(c, px + 4, py + 12, 16, 1, P.shadow);
    const n = Math.round(clamp(state.progress) * 16);
    if (n) r(c, px + 4, py + 12, n, 1, state.phase === 'moving' || state.phase === 'warning' ? P.working : P.ready);
    drawGuairaControlBase(c, b, cx, cy, time, reduced, state.phase, state.progress);
    const mx = x + Math.floor(w / 2) - 2;
    // Explicit five-pixel impact glyph, including after isolation: these
    // switches toggle and can be operated again, unlike a one-use lid.
    r(c, mx, y + 3, 1, 3, P.enamel); r(c, mx - 2, y + 4, 5, 1, P.enamel);
    r(c, mx - 1, y + 5, 3, 1, P.enamel); r(c, mx, y + 6, 1, 1, P.enamel);
}

/** Brittle pressure tiles keep their clay fracture language, with an inset
 * relief seal. The stamp disappears with its exact native tile, never spans a
 * broken opening and never suggests an indestructible metal lid. */
export function drawGuairaReliefLidTile(c: CanvasRenderingContext2D, x: number, y: number) {
    x = Math.round(x); y = Math.round(y);
    r(c, x, y, 16, 16, '#825344'); r(c, x + 1, y + 1, 14, 13, '#c48258');
    r(c, x + 1, y + 1, 14, 2, '#ebc28a'); r(c, x + 2, y + 14, 12, 1, '#9b6249');
    r(c, x + 4, y + 4, 8, 8, P.ink); r(c, x + 5, y + 4, 6, 7, P.enamel);
    r(c, x + 7, y + 5, 2, 3, P.shadow); r(c, x + 6, y + 7, 4, 2, P.shadow);
    r(c, x + 7, y + 9, 2, 1, P.shadow);
    line(c, x + 2, y + 5, x + 5, y + 8, '#66483e');
    line(c, x + 5, y + 8, x + 3, y + 12, '#66483e');
    line(c, x + 13, y + 8, x + 10, y + 12, '#66483e');
    line(c, x + 10, y + 12, x + 11, y + 15, '#66483e');
}
