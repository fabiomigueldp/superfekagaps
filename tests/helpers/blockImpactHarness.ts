import { GameState, TileType as T } from '../../src/constants';
import { Player } from '../../src/entities/Player';
import { Game } from '../../src/game/Game';
import { TriggerController } from '../../src/game/TriggerController';
import { STAGES } from '../../src/adventure/campaign';
import { Level } from '../../src/world/Level';
import type { TestContext } from 'node:test';
import { guairaBrowser } from './guairaLabHarness';
import type { InputState } from '../../src/types';
export const BLOCK_DT = 1000 / 60;
export const blockIdle: InputState = { left: false, right: false, jump: false, run: false, down: false,
    start: false, pause: false, mute: false, jumpPressed: false, jumpReleased: false, downPressed: false };
export function blockStage(tile = T.BRICK_BREAKABLE, originX = 0, originY = 0) {
    const stage = structuredClone(STAGES[0]);
    stage.id = 'QA'; stage.name = 'Block impact fixture';
    stage.mechanisms = []; stage.foes = []; stage.pickups = []; stage.dialogues = []; stage.exits = []; stage.checkpoints = [];
    stage.level = { id: stage.id, name: stage.name, width: 30, height: 15, originX, originY,
        tiles: Array.from({ length: 15 }, (_, row) => Array<number>(30).fill(row >= 10 ? T.GROUND : T.EMPTY)),
        playerSpawn: { x: 5 + originX, y: 10 + originY }, enemies: [], collectibles: [], triggers: [], checkpoints: [],
        goalPosition: { x: 28 + originX, y: 10 + originY }, timeLimit: 180, isBossLevel: false };
    stage.level.tiles[6][5] = tile;
    return stage;
}
/** Real classic update/collision/reward path; rendering and audio devices are stubbed. */
export function classicBlockHarness(tile = T.BRICK_BREAKABLE, helmet = false, originX = 0, originY = 0) {
    const level = new Level(blockStage(tile, originX, originY).level), player = new Player(5 + originX, 10 + originY);
    player.data.hasHelmet = helmet; player.data.isGrounded = true;
    const sounds: string[] = [], game = Object.create(Game.prototype) as any;
    let controls = { ...blockIdle };
    Object.assign(game, { state: GameState.PLAYING, level, player, minions: [], boss: null, score: 0, coins: 0, lives: 3,
        levelTime: 180, totalRunTime: 0, deathTimer: 0, collectibles: [], flags: [], particles: [], activeCheckpoint: null,
        triggerController: new TriggerController(), activeCameraOverride: null,
        camera: { x: 0, y: 0, targetX: 0, targetY: 0, shakeTimer: 0, shakeMagnitude: 0, bounds: level.getBounds() },
        input: { consumePause: () => false, getState: () => ({ ...controls }) },
        audio: new Proxy({}, { get: (_target, name) => () => sounds.push(String(name)) }), renderer: { addImpact() {} } });
    return { game, player, level, sounds, step(input: Partial<InputState> = {}) {
        controls = { ...blockIdle, ...input }; game.updatePlaying(BLOCK_DT);
    } };
}

/** The shared legacy fixture omits listener removal; supply it for terminal lifecycle assertions. */
export function blockBrowser(t: Pick<TestContext, 'after'>, options: { reducedMotion?: boolean } = {}) {
    const h = guairaBrowser(t, options);
    for (const target of [h.window, h.document, h.canvas, h.status, h.retry, h.pause, h.exit, h.ascent]) {
        Object.assign(target, { removeEventListener(type: string, listener: unknown, options?: boolean | { capture?: boolean }) {
            const events = target as unknown as { listeners: Map<string, { listener: unknown; capture: boolean }[]> };
            const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
            events.listeners.set(type, (events.listeners.get(type) ?? []).filter(entry => entry.listener !== listener || entry.capture !== capture));
        } });
    }
    return h;
}
