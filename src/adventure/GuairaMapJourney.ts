import metadata from '../../public/assets/world/map/guaira-campaign/guaira-navigation.json';
import type { AdventureSave } from './types';
import { hasDevelopmentAccess } from './DevelopmentProgress';
import { isGuairaUnlocked } from './progress';
import { guairaChapterRoute } from './experimental/guaira/chapter/GuairaChapterProgress';
import { campaignMapAsset, GUAIRA_CAMPAIGN_PLACEMENT } from './GuairaCampaignArt';
import { localToAtlas } from './WorldAtlasModel';
import { createJourney, selectJourney, type JourneyCapabilities, type JourneyNetwork, type JourneyState } from './WorldJourneyModel';
import { createJourneyDepthSampler } from './WorldJourneyDepth';

const atlasPoint = (p: { x: number; y: number }) => localToAtlas(p, GUAIRA_CAMPAIGN_PLACEMENT);
export const GUAIRA_JOURNEY: JourneyNetwork = {
    nodes: Object.fromEntries(Object.entries({ ...metadata.nodes, ...metadata.junctions }).map(([id, p]) => [id, atlasPoint(p)])),
    edges: metadata.routes.map(r => ({ id: r.id, from: r.from, to: r.to, points: r.points.map(atlasPoint), duration: r.duration, mode: 'walk' })),
};
export const GUAIRA_MAP_DEPTH = campaignMapAsset(`guaira-campaign/guaira-depth.png?v=${metadata.revision}`);
/** Physical places authored alongside the routes in the editable island model. */
export const GUAIRA_LANDMARKS = metadata.landmarks;
export const GUAIRA_DEPTH = { ...metadata.depth, left: GUAIRA_CAMPAIGN_PLACEMENT.origin.x,
    top: GUAIRA_CAMPAIGN_PLACEMENT.origin.y, widthInMap: GUAIRA_CAMPAIGN_PLACEMENT.scale, heightInMap: GUAIRA_CAMPAIGN_PLACEMENT.scale };
export const guairaJourneyDepth = createJourneyDepthSampler(metadata);

/** The chapter owns receipts and opening choice; walking never grants either. */
export function guairaJourneyCapabilities(save: AdventureSave): JourneyCapabilities {
    const route = guairaChapterRoute(save.guaira.opening), next = route.find(id => !save.guaira.completed.includes(id));
    const alternative = save.guaira.opening === 'guaira-travessia' ? 'guaira-patio-comportas' : 'guaira-travessia';
    const stageOrder = [...route, alternative, 'gallery', 'relief'];
    const availableStages = isGuairaUnlocked(save) ? stageOrder.filter(id => id === next || id === 'gallery' || id === 'relief'
        || id === alternative || hasDevelopmentAccess(save) || save.guaira.completed.includes(id as typeof route[number])) : [];
    // All public streets remain traversable. Entry is gated by earned stages,
    // so a locked boss cannot strand a visitor on an optional side street.
    return { stageOrder, availableStages };
}

/** The flight ends at this actual boarding-path junction. Continue on foot;
 * never auto-enter a phase on landing or manufacture a completion receipt. */
export function guairaArrivalJourney(save: AdventureSave, selected: string, reducedMotion = false): JourneyState {
    const capabilities = guairaJourneyCapabilities(save);
    const initial = createJourney(save.guaira.opening, GUAIRA_JOURNEY, capabilities);
    return selectJourney({ ...initial, arrived: 'guaira-arrival', node: 'guaira-arrival',
        point: GUAIRA_JOURNEY.nodes['guaira-arrival'] }, selected, GUAIRA_JOURNEY, capabilities, { reducedMotion });
}

export function guairaDepartureJourney(journey: JourneyState, save: AdventureSave, reducedMotion = false): JourneyState {
    const capabilities = guairaJourneyCapabilities(save);
    return selectJourney(journey, 'guaira-arrival', GUAIRA_JOURNEY, {
        ...capabilities, stageOrder: [...capabilities.stageOrder!, 'guaira-arrival'],
        availableStages: [...capabilities.availableStages, 'guaira-arrival'],
    }, { reducedMotion });
}
