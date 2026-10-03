import { GUAIRA_CAMPAIGN_ART, campaignAirportTerminal, type GuairaCampaignRegion } from './GuairaCampaignArt';
import { AIRCRAFT_TRAVEL_DURATION, type AircraftRoute } from './WorldAircraftModel';

/** All contacts are projected by the same camera that rendered the terminal. */
export function campaignAircraftRoute(source: GuairaCampaignRegion, destination: GuairaCampaignRegion): AircraftRoute {
    const from = campaignAirportTerminal(source, true), to = campaignAirportTerminal(destination, true);
    return { departureStart: from.runwayStart, departureLift: from.runwayEnd,
        arrivalTouchdown: to.runwayEnd, arrivalStop: to.runwayStart, altitude: .24,
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
