import type { JourneyState } from './WorldJourneyModel';
import type { MapPoint } from './WorldMapModel';

/** Authored camera depth sampled with the exact projected arc-length metric
 * used by WorldJourneyModel, including mid-edge reversals and stair risers. */
export function createJourneyDepthSampler(metadata: {
    nodeDepths: Record<string, number>;
    routes: readonly { id: string; points: readonly MapPoint[]; depths: readonly number[] }[];
}): (journey: JourneyState) => number | undefined {
    const routes = new Map(metadata.routes.map(route => {
        const lengths = route.points.slice(1).map((p, i) => Math.hypot((p.x - route.points[i].x) * 1.6, p.y - route.points[i].y));
        return [route.id, { depths: route.depths, lengths, length: lengths.reduce((a, b) => a + b, 0) }];
    }));
    return journey => {
        const leg = journey.legs[0];
        if (!leg) return metadata.nodeDepths[journey.node ?? journey.arrived];
        const route = routes.get(leg.id);
        if (!route) return undefined;
        if (leg.progress <= 0) return route.depths[0];
        if (leg.progress >= 1) return route.depths[route.depths.length - 1];
        let distance = route.length * leg.progress;
        for (let i = 0; i < route.lengths.length; i++) {
            const length = route.lengths[i];
            if (length > 0 && distance < length) return route.depths[i] + (route.depths[i + 1] - route.depths[i]) * distance / length;
            distance -= length;
        }
        return route.depths[route.depths.length - 1];
    };
}
