import type { JumpWitness, CarrierWitness } from './jumpCoinTrajectory';
export interface CampaignJumpPlan {
    stage: string;
    name: string;
    firstCoin: number;
    count: number;
    witness: JumpWitness | CarrierWitness;
    /** Finish the coin ribbon before a distinct equipment/seal reward at landing. */
    endTrim?: number;
    /** Full-width safe landing, in pixels; a 1 px corner contact is not sufficient. */
    landing: [number, number, number];
}
const walk = (x: number, feetY: number): JumpWitness => ({ x, feetY, run: false, hold: 60, approachFrames: 7 });
const run = (x: number, feetY: number): JumpWitness => ({ x, feetY, run: true, hold: 60, approachFrames: 12 });
/** Deliberate local traversal choices, never inferred from a decorative curve.
 * Most hold jump through landing; no frame-perfect release is required. */
export const CAMPAIGN_JUMP_PLANS: CampaignJumpPlan[] = [
    { stage: '1-1', name: 'First recoverable gap', firstCoin: 4, count: 7, witness: walk(400,192), landing: [496,784,224] },
    { stage: '1-1', name: 'Lighthouse descent', firstCoin: 19, count: 6, witness: walk(2192,192), landing: [2288,2560,224] },
    { stage: '1-2', name: 'First broken bridge', firstCoin: 4, count: 6, witness: walk(320,224), landing: [384,496,208] },
    { stage: '1-2', name: 'Second broken bridge', firstCoin: 10, count: 6, witness: walk(720,208), landing: [784,912,192] },
    { stage: '1-2', name: 'Rising broken bridge', firstCoin: 16, count: 7, witness: walk(1616,208), landing: [1696,1808,176] },
    { stage: '1-3', name: 'Upper route entrance', firstCoin: 4, count: 7, witness: walk(224,224), landing: [304,448,192] },
    { stage: '1-3', name: 'Upper route return', firstCoin: 11, count: 7, witness: walk(1088,208), landing: [1184,1280,224] },
    { stage: '1-4', name: 'Cliff stepping stone', firstCoin: 4, count: 8, witness: walk(448,192), landing: [512,560,176] },
    { stage: '1-4', name: 'Long cliff descent', firstCoin: 12, count: 9, witness: run(1472,176), landing: [1568,1680,192] },
    { stage: '2-1', name: 'Cargo roof transfer', firstCoin: 4, count: 10, witness: run(848,176), landing: [1024,1216,208] },
    { stage: '2-3', name: 'Container roof to lower bank', firstCoin: 4, count: 7, endTrim: 4, witness: run(480,176), landing: [608,864,224] },
    { stage: '2-3', name: 'Optional secret shuttle ride', firstCoin: 11, count: 9, witness: { carrier: 'secretLift', offsetX: 24 }, landing: [1824,2080,80] },
    { stage: '2-4', name: 'High cargo roof descent', firstCoin: 4, count: 10, witness: run(912,144), landing: [1088,1344,224] },
    { stage: '2-4', name: 'Dispatch roof descent', firstCoin: 14, count: 10, witness: run(2016,160), landing: [2192,2432,208] },
    { stage: '3-1', name: 'Belt departure to receiving floor', firstCoin: 4, count: 7, witness: walk(520,192), landing: [608,928,224] },
    { stage: '3-1', name: 'Tank roof to belt floor', firstCoin: 11, count: 9, witness: run(1088,176), landing: [1248,1520,224] },
    { stage: '3-2', name: 'Optional maintenance catwalk', firstCoin: 0, count: 5, endTrim: 5, witness: walk(1776,128), landing: [1856,1920,112] },
    { stage: '3-4', name: 'First pressure-room descent', firstCoin: 4, count: 10, witness: run(880,160), landing: [1056,1312,224] },
    { stage: '3-4', name: 'Second pressure-room descent', firstCoin: 14, count: 10, witness: run(1904,144), landing: [2080,2320,224] },
    { stage: '5-1', name: 'Cold-stock descent', firstCoin: 4, count: 10, witness: run(480,192), landing: [656,912,224] },
    { stage: '5-1', name: 'Cold-stock raised exit', firstCoin: 14, count: 11, witness: run(1824,192), landing: [1968,2192,144] },
    { stage: '5-4', name: 'Ice roof ascent', firstCoin: 4, count: 10, witness: run(528,192), landing: [672,896,144] },
    { stage: '5-4', name: 'Ice roof descent', firstCoin: 14, count: 10, witness: run(1872,144), landing: [2048,2288,224] },
    { stage: '6-4', name: 'Final high descent', firstCoin: 4, count: 11, witness: run(1024,128), landing: [1216,1488,224] },
    { stage: '6-4', name: 'Final bridge approach', firstCoin: 15, count: 10, witness: run(2080,144), landing: [2272,2464,208] },
];
