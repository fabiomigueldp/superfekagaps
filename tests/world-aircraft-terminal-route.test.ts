import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignAircraftRoute, campaignAircraftScale } from '../src/adventure/WorldAircraftTerminalRoute';
import { campaignAirportTerminal, GUAIRA_CAMPAIGN_ART } from '../src/adventure/GuairaCampaignArt';
import { sampleAircraftTravel } from '../src/adventure/WorldAircraftModel';

for (const [source, destination] of [['fabrica', 'guaira'], ['guaira', 'fabrica'], ['guaira', 'serra'], ['serra', 'guaira']] as const) {
    test(`${source} to ${destination} uses authored contact points and physical endpoint scales`, () => {
        const route = campaignAircraftRoute(source, destination);
        assert.deepEqual(sampleAircraftTravel(route, 0).ground, campaignAirportTerminal(source, true).runwayStart);
        assert.deepEqual(sampleAircraftTravel(route, Infinity).ground, campaignAirportTerminal(destination, true).runwayStart);
        const sourceScale = GUAIRA_CAMPAIGN_ART[source].aircraftScale * GUAIRA_CAMPAIGN_ART[source].placement.scale;
        const targetScale = GUAIRA_CAMPAIGN_ART[destination].aircraftScale * GUAIRA_CAMPAIGN_ART[destination].placement.scale;
        assert.equal(campaignAircraftScale(source, destination, 0), sourceScale);
        assert.equal(campaignAircraftScale(source, destination, 2.1 / 7.4), sourceScale);
        assert.equal(campaignAircraftScale(source, destination, 6.1 / 7.4), targetScale);
        assert.equal(campaignAircraftScale(source, destination, 1), targetScale);
    });
}
