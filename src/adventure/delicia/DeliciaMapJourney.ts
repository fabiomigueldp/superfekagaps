import metadata from '../../../public/assets/delicia/island-map.json';
import type { JourneyCapabilities, JourneyNetwork } from '../WorldJourneyModel';
import type { MapPoint } from '../WorldMapModel';
import { ALL_DELICIA_STAGES } from './DeliciaContent';
import { createJourneyDepthSampler } from '../WorldJourneyDepth';
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
export const deliciaJourneyDepth = createJourneyDepthSampler(metadata);

export function deliciaJourneyCapabilities(save: DeliciaSave): JourneyCapabilities {
    const availableStages = STAGE_ORDER.filter(id => deliciaUnlocked(id, save));
    const reachable = (id: string) => !STAGE_ORDER.includes(id) || availableStages.includes(id);
    return { stageOrder: STAGE_ORDER, availableStages,
        availableEdges: DELICIA_JOURNEY.edges.filter(edge => reachable(edge.from) && reachable(edge.to)).map(edge => edge.id) };
}
