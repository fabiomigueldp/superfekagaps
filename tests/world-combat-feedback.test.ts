import assert from 'node:assert/strict';
import test from 'node:test';
import { secretCannonHarness, DT } from './helpers/worldSecretCannonHarness';
import { WorldFoe } from '../src/adventure/WorldEnemies';
import { WorldAudio } from '../src/adventure/WorldAudio';
import { combatSparks } from '../src/adventure/WorldCombatFeedback';
import { ART } from '../src/graphics/palette';
import { GroundPoundState } from '../src/types';

function contact(kind: 'charger' | 'helmet' | 'minion', phase = 'warning', pound = false) {
    const h = secretCannonHarness(), g = h.game;
    const enemy = new WorldFoe({ id: 'feedback', kind, x: 1600, y: 150 });
    enemy.phase = phase as typeof enemy.phase;
    g.foes = [enemy];
    Object.assign(g.player.data, {
        position: { x: enemy.x + 3, y: enemy.y - g.player.data.height - 1 },
        velocity: { x: 0, y: 2 }, isGrounded: false, invincibleTimer: 0,
        respawnRevealTimer: 0, groundPoundState: pound ? GroundPoundState.FALL : GroundPoundState.NONE
    });
    h.effects.length = 0; g.sparks = [];
    g.update(DT);
    return { ...h, enemy };
}

test('helmet loss has its own cue while preserving position, velocity and 1000 ms immunity', () => {
    const h = secretCannonHarness(), g = h.game;
    Object.assign(g.player.data, { hasHelmet: true, invincibleTimer: 0, velocity: { x: 2, y: 3 } });
    const before = structuredClone(g.player.data);
    g.hurt(g.player.getCenter().x + 20);
    assert.deepEqual(g.player.data, { ...before, hasHelmet: false, invincibleTimer: 1000 });
    assert.deepEqual(h.effects, ['helmetLoss']);
    assert.equal(g.sparks.length, 6);
    g.hurt();
    assert.deepEqual(h.effects, ['helmetLoss']);
    assert.equal(g.sparks.length, 6, 'The same immunity prevents repeated shield cues.');
});

test('lethal damage retains its original hit/death cue and source-dependent launch', () => {
    const h = secretCannonHarness(), g = h.game;
    g.player.data.invincibleTimer = 0;
    const expected = structuredClone(g.player.data);
    g.player.die('hit', g.player.getCenter().x + 20);
    const death = structuredClone(g.player.data);
    Object.assign(g.player.data, expected);
    g.hurt(g.player.getCenter().x + 20);
    assert.deepEqual(g.player.data, death);
    assert.deepEqual(h.effects, ['hit', 'death']);
    assert.equal(g.sparks.length, 0);
});

test('blocked charger stomp preserves bounce, flash, HP, phase and immunity; cue occurs once', () => {
    const { game: g, enemy, effects } = contact('charger');
    assert.equal(enemy.dead, false); assert.equal(enemy.hp, 1);
    assert.equal(enemy.phase, 'warning'); assert.equal(enemy.flash, 100);
    assert.deepEqual(g.player.data.velocity, { x: 0, y: -7 });
    assert.equal(g.player.data.position.y, enemy.y - g.player.data.height);
    assert.equal(g.player.data.isGrounded, false);
    assert.equal(g.player.data.groundPoundState, GroundPoundState.NONE);
    assert.equal(g.player.data.invincibleTimer, 150);
    assert.equal(g.hitStop, 0); assert.equal(g.camera.shakeTimer, 0);
    assert.deepEqual(effects, ['blockedStomp']); assert.equal(g.sparks.length, 4);
    g.update(DT);
    assert.deepEqual(effects, ['blockedStomp']);
});

test('charger vulnerability and successful helmet/ordinary attacks retain their original feedback', () => {
    for (const h of [contact('charger', 'rest'), contact('charger', 'warning', true), contact('minion', 'walk')]) {
        assert.equal(h.enemy.dead, true); assert.deepEqual(h.effects, ['hit']);
        assert.equal(h.game.player.data.velocity.y, -7); assert.equal(h.game.sparks.length, 9);
    }
    const h = contact('helmet');
    assert.equal(h.enemy.dead, false); assert.equal(h.enemy.armor, false);
    assert.equal(h.enemy.phase, 'stunned'); assert.equal(h.enemy.flash, 250);
    assert.deepEqual(h.effects, ['break']); assert.equal(h.game.sparks.length, 7);
});

test('sparse neutral block particles freeze during pause and expire on the existing simulation clock', () => {
    const { game: g } = contact('charger');
    assert.ok(g.sparks.every((s: { color: string }) => [ART.paper, ART.muted].includes(s.color as typeof ART.paper)));
    g.pause(); const frozen = structuredClone(g.sparks);
    for (let i = 0; i < 30; i++) g.update(DT);
    assert.deepEqual(g.sparks, frozen);
    g.resume();
    for (let i = 0; i < 13; i++) g.updateSparks(DT);
    assert.deepEqual(g.sparks, []);
    const a = combatSparks('helmetLoss', 30, 40), b = combatSparks('helmetLoss', 30, 40);
    assert.deepEqual(a, b); a[0].x++;
    assert.notDeepEqual(a, b, 'Each event owns its particles.');
});

class Param {
    value = 0;
    events: number[][] = [];
    setValueAtTime(v: number, t: number) { this.events.push([v, t]); }
    linearRampToValueAtTime(v: number, t: number) { this.events.push([v, t]); }
    exponentialRampToValueAtTime(v: number, t: number) { this.events.push([v, t]); }
    setTargetAtTime(v: number, t: number) { this.events.push([v, t]); }
}
class AudioNode {
    gain = new Param(); frequency = new Param(); type = '';
    destinations: AudioNode[] = []; disconnected = false;
    startAt: number | null = null; stopAt: number | null = null; onended?: () => void;
    connect(n: AudioNode) { this.destinations.push(n); }
    disconnect() { this.disconnected = true; }
    start(t: number) { this.startAt = t; }
    stop(t: number) { this.stopAt = t; }
}
class Context {
    state = 'running'; currentTime = 1; nodes: AudioNode[] = []; destination = new AudioNode(); resumes = 0; suspends = 0;
    make() { const node = new AudioNode(); this.nodes.push(node); return node; }
    createGain() { return this.make(); }
    createOscillator() { return this.make(); }
    resume() { this.resumes++; return Promise.resolve(); }
    suspend() { this.suspends++; return Promise.resolve(); }
}
test('combat cues use the effects bus, bounded original tones and natural-end disconnection', () => {
    const world = new WorldAudio({ music: .5, effects: .6, voice: .7, shake: true });
    const context = new Context(), bus = context.createGain();
    Object.assign(world, { ctx: context, effects: bus });
    for (const kind of ['blockedStomp', 'helmetLoss']) world.sfx(kind);
    const sources = context.nodes.filter(n => n.startAt !== null);
    assert.equal(sources.length, 6);
    assert.ok(sources.every(n => n.type !== 'square' && n.stopAt! - context.currentTime <= .181));
    assert.ok(sources.every(n => n.destinations[0].destinations[0] === bus));
    sources.forEach(n => n.onended?.());
    assert.ok(context.nodes.slice(1).every(n => n.disconnected));
    assert.equal(context.resumes, 0);
});

test('new cues never unlock, resume or queue while uninitialized, muted, effects-off, paused or suspended', () => {
    const world = new WorldAudio({ music: .5, effects: .6, voice: .7, shake: true });
    world.sfx('helmetLoss'); assert.equal(world.getEffectsRoute(), null);
    const context = new Context(), bus = context.createGain();
    Object.assign(world, { ctx: context, effects: bus, music: new AudioNode(), voice: new AudioNode() });
    world.toggle(); world.sfx('helmetLoss'); world.toggle();
    world.preferences.effects = 0; world.sfx('blockedStomp'); world.preferences.effects = .6;
    world.pause(true); world.sfx('helmetLoss'); world.unlock();
    assert.equal(context.resumes, 0); assert.equal(context.suspends, 1);
    world.pause(false);
    context.state = 'suspended'; world.sfx('blockedStomp'); context.state = 'running';
    assert.equal(context.nodes.length, 1, 'Restoring the route must not replay rejected cues.');
    assert.equal(context.resumes, 1, 'Only explicit resume unlocks the context.');
    world.sfx('blockedStomp'); assert.equal(context.nodes.length, 5);
    assert.equal(bus.gain.events.at(-1)![0], .6 * .3, 'The existing effects volume remains in control.');
});
