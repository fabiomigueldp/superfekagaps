import { writeFileSync } from 'node:fs';
import { STAGES } from '../src/adventure/campaign';
import { CAMPAIGN_JUMP_COINS } from '../src/adventure/campaignJumpCoins';
import { CAMPAIGN_NATURAL_GUIDES } from './lib/campaignNaturalGuides';
import { placeNaturalGuide } from './lib/naturalGuidePlacement';
import { traceNaturalApproach, approachCoins } from './lib/naturalCoinApproach';
import { previousJumpCoins } from './lib/naturalGuideBaseline';
const generated = structuredClone(CAMPAIGN_JUMP_COINS) as Record<string, [string, number, number][]>;
for (const guide of CAMPAIGN_NATURAL_GUIDES) {
    const stage = STAGES.find(s => s.id === guide.stage)!;
    const { points, reference, traces } = placeNaturalGuide(stage, guide);
    for (const [i, p] of points.entries()) {
        const id = `${stage.id}:c${guide.firstCoin + i}`, index = generated[stage.id].findIndex(p => p[0] === id);
        if (index < 0) throw new Error(`Missing stable ID ${id}`);
        generated[stage.id][index] = [id, p.x, p.y];
    }
    const revised = structuredClone(stage);
    for (const [i, p] of points.entries()) Object.assign(revised.pickups.find(c => c.id === `${stage.id}:c${guide.firstCoin + i}`)!, p);
    const revisedTrace = traceNaturalApproach(revised, guide, guide.reference);
    const old = structuredClone(stage);
    for (const [id, x, y] of previousJumpCoins[stage.id]) Object.assign(old.pickups.find(p => p.id === id)!, { x, y });
    const oldTrace = traceNaturalApproach(old, guide, guide.reference);
    const ids = new Set(approachCoins(stage, guide).map(p => p.id));
    const count = (t: typeof reference) => t.collected.filter(id => ids.has(id)).length;
    console.log(`${guide.stage}:${guide.firstCoin} ${count(oldTrace)}/${guide.count} → ${count(revisedTrace)}/${guide.count}; ${guide.name}; ${traces.length} speed(s)`);
}
if (process.argv.includes('--write')) {
    const source = Object.entries(generated).map(([stage, points]) => `    '${stage}': [\n${points.map(p => `        ${JSON.stringify(p)},`).join('\n')}\n    ],`).join('\n');
    writeFileSync('src/adventure/campaignJumpCoins.ts', `/** Native approach-derived guides: node --import tsx scripts/generate_natural_guides.ts --write.\n * Coordinates preserve every existing pickup identity; the secret-shuttle ride stays unchanged. */\nexport const CAMPAIGN_JUMP_COINS: Readonly<Record<string, readonly (readonly [string, number, number])[]>> = {\n${source}\n};\n`);
}
