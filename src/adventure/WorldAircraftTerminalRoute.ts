import { GUAIRA_CAMPAIGN_ART, campaignAirportTerminal, type GuairaCampaignRegion } from './GuairaCampaignArt';
import { AIRCRAFT_TRAVEL_DURATION, type AircraftRoute } from './WorldAircraftModel';

/** Broad high-altitude bends keep the heading moving through the turn instead
 * of slowing to a pivot. Coordinates use the fixed atlas/camera contract; the
 * first/last three controls are derived from the runway to preserve C2 joins. */
const CAMPAIGN_FLIGHT_BENDS = {
    'guaira:fabrica': [{ x: 3.774336, y: -0.179560 }, { x: 3.475730, y: 0.334151 }],
    'fabrica:guaira': [{ x: 3.492586, y: 0.155663 }, { x: 3.756852, y: -0.208959 }],
    'guaira:serra': [{ x: 3.580899, y: -0.391775 }, { x: 3.834447, y: 0.567860 }],
    'serra:guaira': [{ x: 3.881590, y: 0.557952 }, { x: 3.548688, y: -0.395247 }],
} as const;

/** All contacts are projected by the same camera that rendered the terminal. */
export function campaignAircraftRoute(source: GuairaCampaignRegion, destination: GuairaCampaignRegion): AircraftRoute {
    const from = campaignAirportTerminal(source, true), to = campaignAirportTerminal(destination, true);
    return { departureStart: from.rollStart ?? from.runwayStart, departureLift: from.rollEnd ?? from.runwayEnd,
        arrivalTouchdown: to.rollEnd ?? to.runwayEnd, arrivalStop: to.rollStart ?? to.runwayStart, altitude: .24,
        ...(source === 'guaira' || destination === 'guaira' ? { runwayCorridors: {
            departure: source === 'guaira' ? 1 : 0, arrival: destination === 'guaira' ? 1 : 0,
            bendControls: CAMPAIGN_FLIGHT_BENDS[`${source}:${destination}` as keyof typeof CAMPAIGN_FLIGHT_BENDS],
            oppositeTerminalContacts: { departureStart: from.runwayStart, departureLift: from.runwayEnd,
                arrivalTouchdown: to.runwayEnd, arrivalStop: to.runwayStart },
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
