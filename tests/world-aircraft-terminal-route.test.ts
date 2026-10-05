import test from 'node:test';
import assert from 'node:assert/strict';
import { campaignAircraftRoute, campaignAircraftScale } from '../src/adventure/WorldAircraftTerminalRoute';
import { campaignAirportTerminal, GUAIRA_CAMPAIGN_ART } from '../src/adventure/GuairaCampaignArt';
import { sampleAircraftTravel } from '../src/adventure/WorldAircraftModel';

for (const [source, destination] of [['fabrica', 'guaira'], ['guaira', 'fabrica'], ['guaira', 'serra'], ['serra', 'guaira']] as const) {
    test(`${source} to ${destination} uses authored contact points and physical endpoint scales`, () => {
        const route = campaignAircraftRoute(source, destination);
        assert.deepEqual(sampleAircraftTravel(route, 0).ground, campaignAirportTerminal(source, true).rollStart ?? campaignAirportTerminal(source, true).runwayStart);
        assert.deepEqual(sampleAircraftTravel(route, Infinity).ground, campaignAirportTerminal(destination, true).rollStart ?? campaignAirportTerminal(destination, true).runwayStart);
        const sourceScale = GUAIRA_CAMPAIGN_ART[source].aircraftScale * GUAIRA_CAMPAIGN_ART[source].placement.scale;
        const targetScale = GUAIRA_CAMPAIGN_ART[destination].aircraftScale * GUAIRA_CAMPAIGN_ART[destination].placement.scale;
        assert.equal(campaignAircraftScale(source, destination, 0), sourceScale);
        assert.equal(campaignAircraftScale(source, destination, 2.1 / 7.4), sourceScale);
        assert.equal(campaignAircraftScale(source, destination, 6.1 / 7.4), targetScale);
        assert.equal(campaignAircraftScale(source, destination, 1), targetScale);
    });
}

const metricDistance = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot((a.x - b.x) * 1.6, a.y - b.y);
const angleDistance = (a: number, b: number) => Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b)));
for (const [source, destination] of [['fabrica', 'guaira'], ['guaira', 'fabrica'], ['guaira', 'serra'], ['serra', 'guaira']] as const) {
    test(`${source} to ${destination} keeps a straight clear low-altitude corridor and C2 cruise joins`, () => {
        const route = campaignAircraftRoute(source, destination), leaving = source === 'guaira';
        const corridor = route.runwayCorridors!;
        const boundaries = [.55, 2.1, 2.1 + corridor.departure, 4.1, 6.1 - corridor.arrival, 6.1, 7.4], eps = 1e-6;
        const before = JSON.stringify(route);
        for (const boundary of boundaries) {
            const a = sampleAircraftTravel(route, boundary - eps), b = sampleAircraftTravel(route, boundary + eps);
            assert.ok(metricDistance(a.position, b.position) < .00001, `position at ${boundary}`);
            assert.ok(Math.abs(a.speed - b.speed) < .00001, `speed at ${boundary}`);
            assert.ok(angleDistance(a.heading, b.heading) < .0001, `heading at ${boundary}`);
            assert.ok(Math.abs(a.altitude - b.altitude) < .00001, `altitude at ${boundary}`);
            assert.ok(Math.abs(a.bank - b.bank) < .00001, `bank at ${boundary}`);
            // The opposite terminal deliberately retains its original lift attitude.
            if (leaving || boundary !== 2.1) assert.ok(Math.abs(a.pitch - b.pitch) < .00001, `pitch at ${boundary}`);
        }
        const join = leaving ? 2.1 + corridor.departure : 6.1 - corridor.arrival, h = .0001;
        const p = (time: number) => sampleAircraftTravel(route, time).ground;
        const velocity = (time: number) => ({ x: (p(time + h).x - p(time - h).x) / (2 * h), y: (p(time + h).y - p(time - h).y) / (2 * h) });
        const a = velocity(join - h), b = velocity(join + h);
        assert.ok(metricDistance(a, b) < .00001, 'straight/Bézier velocity continuity');
        const acceleration = (side: number) => ({
            x: (p(join + side * 2 * h).x - 2 * p(join + side * h).x + p(join).x) / h ** 2,
            y: (p(join + side * 2 * h).y - 2 * p(join + side * h).y + p(join).y) / h ** 2,
        });
        const leftAcceleration = acceleration(-1), rightAcceleration = acceleration(1);
        assert.ok(metricDistance(leftAcceleration, { x: 0, y: 0 }) < .02, 'left acceleration tends to zero');
        assert.ok(metricDistance(rightAcceleration, { x: 0, y: 0 }) < .02, 'right acceleration tends to zero');
        assert.ok(metricDistance(leftAcceleration, rightAcceleration) < .02, 'C2 acceleration continuity');
        const heading = sampleAircraftTravel(route, leaving ? 2.1 : 6.1).heading;
        for (let i = 0; i <= 60; i++) {
            const pose = sampleAircraftTravel(route, (leaving ? 2.1 : 6.1 - corridor.arrival) + i / 60);
            assert.ok(angleDistance(pose.heading, heading) < 1e-9);
            assert.ok(Math.abs(pose.bank) < 1e-12);
            assert.ok(pose.altitude >= 0 && pose.altitude <= .24);
        }
        assert.equal(sampleAircraftTravel(route, join).altitude, .24);
        for (let i = 1; i <= 444; i++) {
            const now = sampleAircraftTravel(route, i / 60), previous = sampleAircraftTravel(route, (i - 1) / 60);
            assert.ok(angleDistance(now.heading, previous.heading) < 4 * Math.PI / 180, 'no abrupt midair pivot');
            if (i / 60 > 2.1 + corridor.departure && i / 60 < 6.1 - corridor.arrival) assert.ok(now.speed > .20, 'maintain airspeed through each turn');
        }
        assert.equal(sampleAircraftTravel(route, 7.4 - eps).complete, false);
        assert.equal(sampleAircraftTravel(route, 7.4).complete, true);
        assert.equal(sampleAircraftTravel(route, 1.15, true).complete, true);
        assert.equal(JSON.stringify(route), before);
    });
}

test('inset Guaíra roll contacts preserve physical strip and boarding metadata', () => {
    const terminal = campaignAirportTerminal('guaira'), projected = campaignAirportTerminal('guaira', true);
    assert.ok(terminal.rollStart && terminal.rollEnd);
    assert.equal(terminal.usableLengthMeters, 4.65);
    assert.notDeepEqual(terminal.rollStart, terminal.runwayStart);
    assert.notDeepEqual(terminal.rollEnd, terminal.runwayEnd);
    assert.deepEqual(terminal.boardingPath.at(-1), terminal.groundAnchor);
    assert.equal(projected.rollStart!.x, 3.65 + terminal.rollStart.x * 1.1);
    assert.equal(projected.rollEnd!.y, .05 + terminal.rollEnd.y * 1.1);
    assert.equal(campaignAircraftRoute('fabrica', 'serra').runwayCorridors, undefined);
});

test('a single optional inset contact is still projected into atlas coordinates', () => {
    const terminal = GUAIRA_CAMPAIGN_ART.guaira.terminal, end = terminal.rollEnd;
    try {
        delete terminal.rollEnd;
        const atlas = campaignAirportTerminal('guaira', true);
        assert.equal(atlas.rollStart!.x, 3.65 + terminal.rollStart!.x * 1.1);
        assert.equal(atlas.rollStart!.y, .05 + terminal.rollStart!.y * 1.1);
        assert.equal(atlas.rollEnd, undefined);
    } finally { terminal.rollEnd = end; }
});


for (const [source, destination] of [['fabrica', 'guaira'], ['serra', 'guaira'], ['guaira', 'fabrica'], ['guaira', 'serra']] as const) {
    test(`${source} to ${destination} preserves opposite-terminal poses and C2 mid-flight joins`, () => {
        const route = campaignAircraftRoute(source, destination), corridor = route.runwayCorridors!;
        const original = { ...corridor.oppositeTerminalContacts!, altitude: route.altitude, scale: route.scale };
        const approvedGuaira = { ...route, runwayCorridors: { ...corridor, oppositeTerminalContacts: undefined } };
        for (let tick = 0; tick <= 444; tick++) {
            const time = tick / 60, pose = sampleAircraftTravel(route, time);
            if (source !== 'guaira' && time <= 3.1 || destination !== 'guaira' && time >= 5.1) {
                assert.deepEqual(pose, sampleAircraftTravel(original, time), `exact original terminal pose at ${time}`);
            }
            if (source === 'guaira' && time <= 3.1 || destination === 'guaira' && time >= 5.1) {
                assert.deepEqual(pose, sampleAircraftTravel(approvedGuaira, time), `approved Guaíra corridor at ${time}`);
            }
        }
        const h = .0001, ground = (time: number) => sampleAircraftTravel(route, time).ground;
        for (const join of source === 'guaira' ? [4.1, 5.1] : [3.1, 4.1]) {
            const p = ground(join), left = sampleAircraftTravel(route, join - h), right = sampleAircraftTravel(route, join + h);
            assert.ok(metricDistance(left.ground, right.ground) < .0005, `position at ${join}`);
            assert.ok(Math.abs(left.speed - right.speed) < .003, `speed at ${join}`);
            assert.ok(angleDistance(left.heading, right.heading) < .003, `heading at ${join}`);
            const acceleration = (side: number) => ({
                x: (ground(join + side * 2 * h).x - 2 * ground(join + side * h).x + p.x) / h ** 2,
                y: (ground(join + side * 2 * h).y - 2 * ground(join + side * h).y + p.y) / h ** 2,
            });
            assert.ok(metricDistance(acceleration(-1), acceleration(1)) < .03, `C2 acceleration at ${join}`);
            assert.ok(Math.abs(left.bank - right.bank) < .001, `bank at ${join}`);
            assert.ok(Math.abs(left.altitude - right.altitude) < .0001, `altitude at ${join}`);
        }
        for (let tick = 0; tick <= 69; tick++) assert.deepEqual(sampleAircraftTravel(route, tick / 60, true), sampleAircraftTravel(approvedGuaira, tick / 60, true));
    });
}
