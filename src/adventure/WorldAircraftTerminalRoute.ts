import { GUAIRA_CAMPAIGN_ART, campaignAirportTerminal, type GuairaCampaignRegion } from './GuairaCampaignArt';
import { AIRCRAFT_TRAVEL_DURATION, type AircraftRoute } from './WorldAircraftModel';

/** Broad airborne bends keep the heading moving through the turn instead
 * of slowing to a pivot. Coordinates use the fixed atlas/camera contract; the
 * first/last three controls are derived from the runway to preserve C2 joins. */
const CAMPAIGN_FLIGHT_BENDS = {
    'guaira:fabrica': [{ x: 3.901460, y: -0.501432 }, { x: 3.431835, y: 0.971253 }],
    'fabrica:guaira': [{ x: 3.425376, y: 0.955866 }, { x: 3.878875, y: -0.620914 }],
    'guaira:serra': [{ x: 3.829484, y: -0.234646 }, { x: 3.920664, y: 1.037330 }],
    'serra:guaira': [{ x: 3.921638, y: 1.026759 }, { x: 3.813935, y: -0.328134 }],
} as const;

/** All contacts are projected by the same camera that rendered the terminal. */
export function campaignAircraftRoute(source: GuairaCampaignRegion, destination: GuairaCampaignRegion): AircraftRoute {
    const from = campaignAirportTerminal(source, true), to = campaignAirportTerminal(destination, true);
    return { departureStart: from.rollStart ?? from.runwayStart, departureLift: from.rollEnd ?? from.runwayEnd,
        arrivalTouchdown: to.rollEnd ?? to.runwayEnd, arrivalStop: to.rollStart ?? to.runwayStart, altitude: .24,
        ...(source === 'guaira' || destination === 'guaira' ? { runwayCorridors: {
            departure: source === 'guaira' ? 1 : .6,
            arrival: destination === 'guaira' ? 1 : .6,
            ...(source === 'serra' ? { departureOffshoreClimb: true } : {}),
            ...(destination === 'serra' ? { arrivalOffshoreClimb: true } : {}),
            bendControls: CAMPAIGN_FLIGHT_BENDS[`${source}:${destination}` as keyof typeof CAMPAIGN_FLIGHT_BENDS],
        } } : {}),
        scale: campaignAircraftScale(source, destination, 0) };
}
/** Stay at the authored physical size on either runway; change projection only aloft. */
export function campaignAircraftScale(source: GuairaCampaignRegion, destination: GuairaCampaignRegion, progress: number): number {
    const a = GUAIRA_CAMPAIGN_ART[source], b = GUAIRA_CAMPAIGN_ART[destination];
    const t = Math.max(0, Math.min(1, (progress * AIRCRAFT_TRAVEL_DURATION - 2.1) / 4));
    const blend = t * t * (3 - 2 * t);
    const from = a.aircraftScale * a.placement.scale, to = b.aircraftScale * b.placement.scale;
    return from + (to - from) * blend;
}
