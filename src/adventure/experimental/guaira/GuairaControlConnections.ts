import type { MovingBody } from '../../WorldPhysics';
import type { Point } from '../../WorldPainting';
import { drawGuairaPipe, drawGuairaPipeElbow, drawGuairaPipeFlow, drawGuairaPipeSaddle, guairaPipeRoute } from './GuairaPipeArt';

interface Connection {
    readonly vertices: readonly Point[];
    readonly flow: readonly Point[];
    readonly saddle: { x: number; y: number; vertical: boolean };
}
const connections = new WeakMap<MovingBody, { target: MovingBody; shape: string; connection: Connection }>();

/** Both directions are authored in world coordinates. The endpoint enters the
 * fixed outlet/hoist, never the travelling deck. No mirrored camera or clock. */
export function guairaControlConnection(control: MovingBody, target: MovingBody): Connection {
    const direction = target.x + target.width / 2 < control.x + control.width / 2 ? -1 : 1;
    const start = Math.round(control.x + control.width / 2), foot = Math.round(control.y + control.height);
    const edge = Math.round(direction === 1 ? target.x : target.x + target.width);
    const end = edge - direction * 16;
    const ey = Math.round(target.kind === 'jet' ? target.y + target.height + 6 : (target.to?.y ?? target.y) + 14);
    let sy = foot + 16;
    if (Math.abs(ey - sy) < 18) sy = ey + 24;
    const shape = [start, foot, end, sy, ey, edge, direction].join(',');
    const cached = connections.get(control);
    if (cached?.target === target && cached.shape === shape) return cached.connection;
    const vertices: Point[] = [[start, foot], [start, sy], [end, sy], [end, ey], [edge + direction * 4, ey]];
    // Mount on a real straight span, clear of elbows and ferrules. The compact
    // counterpressure return has only seven straight pixels horizontally: its
    // bracket belongs on the riser, not beyond the bend in empty space.
    const horizontal = Math.abs(end - start) >= 40;
    const saddle = horizontal ? { x: Math.round((start + end) / 2), y: sy, vertical: false }
        : { x: end, y: Math.round((sy + ey) / 2), vertical: true };
    const connection = { vertices, saddle, flow: guairaPipeRoute(vertices) };
    connections.set(control, { target, shape, connection });
    return connection;
}

/** Continuous bronze fittings are painted before their controls and outlets.
 * Each corner owns its nine pixels; straight pipes start beyond that footprint. */
export function drawGuairaControlConnection(c: CanvasRenderingContext2D, control: MovingBody, target: MovingBody,
    cx: number, cy: number, time: number, reduced: boolean) {
    const { vertices, flow, saddle } = guairaControlConnection(control, target);
    const wet = target.kind === 'jet' ? !target.active : target.active;
    cx = Math.round(cx); cy = Math.round(cy);
    for (let i = 0; i < vertices.length - 1; i++) {
        const a = vertices[i], b = vertices[i + 1], vertical = a[0] === b[0], axis = vertical ? 1 : 0;
        const forward = a[axis] < b[axis];
        const trimA = i === 0 ? 0 : 5, trimB = i === vertices.length - 2 ? 0 : 5;
        const low = Math.min(a[axis], b[axis]) + (forward ? trimA : trimB);
        const length = Math.abs(b[axis] - a[axis]) + 1 - trimA - trimB;
        drawGuairaPipe(c, (vertical ? a[0] - 4 : low) - cx, (vertical ? low : a[1] - 4) - cy,
            length, wet, time, reduced, vertical, 1, false);
    }
    for (let i = 1; i < vertices.length - 1; i++) {
        const [x, y] = vertices[i], before = vertices[i - 1], after = vertices[i + 1];
        drawGuairaPipeElbow(c, x - 4 - cx, y - 4 - cy, wet,
            before[0] < x || after[0] < x, before[1] < y || after[1] < y);
    }
    drawGuairaPipeSaddle(c, saddle.x - cx, saddle.y - cy, saddle.vertical);
    if (wet) drawGuairaPipeFlow(c, flow, cx, cy, time, reduced);
}
