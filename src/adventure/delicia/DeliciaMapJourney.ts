import metadata from '../../../public/assets/delicia/island-map.json';
import type { JourneyCapabilities, JourneyNetwork, JourneyState } from '../WorldJourneyModel';
import type { MapPoint } from '../WorldMapModel';
import { ALL_DELICIA_STAGES } from './DeliciaContent';
import { DELICIA_ATLAS } from './DeliciaIsland';
import { deliciaUnlocked, type DeliciaSave } from './DeliciaProgress';

export const deliciaAtlasPoint = (point: MapPoint): MapPoint => ({
    x: DELICIA_ATLAS.left + point.x * DELICIA_ATLAS.widthInMap,
    y: DELICIA_ATLAS.top + point.y * DELICIA_ATLAS.heightInMap,
});

/** Projected from the editable Blender centerlines, including both sanctuaries.
 * The same World journey engine owns travel, reversal, arrival and entry. */
export const DELICIA_JOURNEY: JourneyNetwork = {
    nodes: Object.fromEntries(Object.entries({ ...metadata.nodes, ...metadata.junctions })
        .map(([id, point]) => [id, deliciaAtlasPoint(point)])),
    edges: metadata.routes.map(route => ({ id: route.id, from: route.from, to: route.to,
        points: route.points.map(deliciaAtlasPoint), duration: route.duration, mode: 'walk' })),
};
const STAGE_ORDER = ALL_DELICIA_STAGES.map(stage => stage.id);

export const DELICIA_DEPTH = metadata.depth;
/** Arc lengths sample Feka's depth along the modeled paving. Navigation
 * centerlines are data only: the island art already contains the roads. */
const ROUTE_DEPTHS = metadata.routes.map(route => {
    const lengths = route.points.slice(1).map((p, i) => Math.hypot((p.x-route.points[i].x)*1.6, p.y-route.points[i].y));
    return { id: route.id, depths: route.depths, lengths, length: lengths.reduce((a,b) => a+b, 0) };
});

/** Use the same projected arc length and canonical (reversible) progress as
 * WorldJourneyModel.samplePath, so the foreground never jumps on retarget. */
export function deliciaJourneyDepth(journey: JourneyState): number | undefined {
    const leg = journey.legs[0];
    if (!leg) return (metadata.nodeDepths as Record<string, number>)[journey.node ?? journey.arrived];
    const route = ROUTE_DEPTHS.find(r => r.id === leg.id);
    if (!route) return undefined;
    if (leg.progress <= 0) return route.depths[0];
    if (leg.progress >= 1) return route.depths[route.depths.length-1];
    let distance = route.length * Math.max(0, Math.min(1, leg.progress));
    for (let i = 0; i < route.lengths.length; i++) {
        const length = route.lengths[i];
        if (length > 0 && distance < length) return route.depths[i] + (route.depths[i+1]-route.depths[i])*distance/length;
        distance -= length;
    }
    return route.depths[route.depths.length-1];
}

export function deliciaJourneyCapabilities(save: DeliciaSave): JourneyCapabilities {
    const availableStages = STAGE_ORDER.filter(id => deliciaUnlocked(id, save));
    const reachable = (id: string) => !STAGE_ORDER.includes(id) || availableStages.includes(id);
    return { stageOrder: STAGE_ORDER, availableStages,
        availableEdges: DELICIA_JOURNEY.edges.filter(edge => reachable(edge.from) && reachable(edge.to)).map(edge => edge.id) };
}
