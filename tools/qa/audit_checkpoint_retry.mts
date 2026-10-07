import { WorldGame } from '../../src/adventure/WorldGame';
import { ProgressStore } from '../../src/adventure/progress';
import { WorldTutorial } from '../../src/adventure/WorldTutorial';
import { STAGES } from '../../src/adventure/campaign';
import { isSolidTile } from '../../src/world/tileRules';
import type { AdventureStage } from '../../src/adventure/types';
import type { InputState } from '../../src/types';

const idle: InputState = { left: false, right: false, run: false, jump: false, down: false,
    start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
const noop = () => {};
function harness(stage: AdventureStage) {
    const game = Object.create(WorldGame.prototype) as any;
    let raw: string | null = null, input = { ...idle };
    const store = new ProgressStore({ getItem: () => raw, setItem: (_key, value) => { raw = value; } });
    Object.assign(game, { store, tutorial: new WorldTutorial(store),
        input: { reset: () => { input = { ...idle }; }, setMenuMode: noop, update: noop,
            consumeMute: () => false, consumePause: () => false, getState: () => ({ ...input }) },
        audio: new Proxy({}, { get: () => noop }), renderer: { advanceClock: noop, addImpact: noop },
        camera: { x: 0, y: 0, shakeTimer: 0 }, state: 'title', time: 0, toastTimer: 0, buttons: [] });
    game.load(stage.id, false, stage);
    if (game.state === 'dialogue') { game.dialogueTime = 10000; game.closeDialogue(); }
    return { game, step: (value: Partial<InputState> = {}) => { input = { ...idle, ...value }; game.update(1000 / 60); } };
}

const rows = [];
for (const stage of STAGES) for (const [index, cp] of stage.checkpoints.entries()) {
    const { game, step } = harness(stage);
    let player = game.player.data;
    // Fixture setup only: final approach, capture, death and resume all use runtime.
    player.position = { x: cp.x * 16 - 24, y: cp.y * 16 - player.height };
    player.isGrounded = true; player.velocity = { x: 0, y: 0 };
    for (let frame = 0; frame < 30 && game.checkpoint < index && !player.isDead; frame++) step({ right: true });
    const activated = game.checkpoint === index;
    if (!activated) {
        rows.push({ stage: stage.id, index, cp, activated, position: player.position, dead: player.isDead });
        continue;
    }
    const previous = game.player;
    previous.die('fall');
    for (let frame = 0; frame < 240 && game.player === previous; frame++) step();
    const spawn = game.player.getRect();
    let diedAt: number | null = null, supportedAt: number | null = null;
    for (let frame = 0; frame < 600; frame++) {
        step(); player = game.player.data;
        if (player.isGrounded && supportedAt === null) supportedAt = frame / 60;
        if (player.isDead) { diedAt = frame / 60; break; }
    }
    const embedded = [];
    for (let row = Math.floor(spawn.y / 16); row <= Math.floor((spawn.y + spawn.height - 1) / 16); row++)
        for (let col = Math.floor(spawn.x / 16); col <= Math.floor((spawn.x + spawn.width - 1) / 16); col++)
            if (isSolidTile(game.level.getTile(col, row))) embedded.push([col, row]);
    rows.push({ stage: stage.id, index, cp, activated, spawn, diedAt, supportedAt, embedded,
        resumed: game.player.getRect(),
        foes: stage.foes.filter(foe => Math.abs(foe.x - cp.x * 16) < 180),
        mechanisms: stage.mechanisms.filter(mechanism => Math.abs(mechanism.x - cp.x * 16) < 160) });
}
console.log(JSON.stringify(rows, null, 2));
