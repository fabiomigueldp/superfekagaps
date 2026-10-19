import test from 'node:test';
import assert from 'node:assert/strict';
import { HypotheticalAudio, type WeaponCue } from '../src/adventure/hipotetico/HypotheticalAudio';

class Param {
    value=0; changes:number[]=[];
    setValueAtTime(v:number,_t:number){this.changes.push(v);}
    linearRampToValueAtTime(v:number,_t:number){this.changes.push(v);}
    exponentialRampToValueAtTime(v:number,_t:number){this.changes.push(v);}
}
class Node {
    gain=new Param();frequency=new Param();type='';buffer:unknown;onended:(()=>void)|null=null;
    destinations:Node[]=[];disconnected=false;started=false;stopped=false;
    connect(node:Node){this.destinations.push(node);}
    disconnect(){this.disconnected=true;}
    start(_t:number){this.started=true;}
    stop(_t?:number){this.stopped=true;}
}
class Context {
    currentTime=0;sampleRate=48000;state='running';nodes:Node[]=[];buffers=0;
    make(){const n=new Node();this.nodes.push(n);return n;}
    createBufferSource(){return this.make();}createBiquadFilter(){return this.make();}
    createGain(){return this.make();}createOscillator(){return this.make();}
    createBuffer(_channels:number,length:number,_rate:number){this.buffers++;return {getChannelData:()=>new Float32Array(length)};}
}
function setup(){const context=new Context(),destination=new Node(),route={context:context as unknown as BaseAudioContext,destination:destination as unknown as AudioNode,enabled:true};
    return {context,destination,route,audio:new HypotheticalAudio(()=>route)};}

test('weapon voices use the existing effects bus, reuse noise and keep distant gunfire quieter',()=>{
    const {context,destination,audio}=setup();
    audio.play('shot');const loud=Math.max(...context.nodes.flatMap(n=>n.gain.changes));
    const start=context.nodes.length;audio.play('distant-shot');
    const quiet=Math.max(...context.nodes.slice(start).flatMap(n=>n.gain.changes));
    assert.ok(quiet<loud*.3);assert.equal(context.buffers,1);assert.equal(audio.activeVoices,2);
    assert.equal(context.nodes.filter(n=>n.destinations.includes(destination)).length,4);
    audio.dispose();assert.equal(audio.activeVoices,0);assert.ok(context.nodes.every(n=>n.disconnected));
});

test('mute, pause and disposal stop weapon tails and never queue silent shots for later playback',()=>{
    const {context,route,audio}=setup();audio.play('shot');route.enabled=false;audio.sync();assert.equal(audio.activeVoices,0);
    let count=context.nodes.length;assert.equal(audio.play('impact'),false);assert.equal(context.nodes.length,count);
    route.enabled=true;audio.sync();assert.equal(audio.activeVoices,0);audio.play('reload');
    context.state='suspended';audio.sync();assert.equal(audio.activeVoices,0);
    count=context.nodes.length;assert.equal(audio.play('shot'),false);assert.equal(context.nodes.length,count);
    context.state='running';audio.sync();assert.equal(audio.activeVoices,0);audio.dispose();
    assert.equal(audio.play('shot'),false);assert.ok(context.nodes.every(n=>n.disconnected));
});

test('long barrages bound simultaneous voices and natural endings release their graphs',()=>{
    const {audio,context}=setup();const cues:WeaponCue[]=['shot','impact','splash','collapse-water','debris-land','distant-shot','distant-hit','reload','distant-crash','distant-debris','distant-thud'];
    for(let i=0;i<80;i++)audio.play(cues[i%cues.length]);
    assert.equal(audio.activeVoices,12);
    for(const n of context.nodes)n.onended?.();
    assert.equal(audio.activeVoices,0);assert.ok(context.nodes.every(n=>n.disconnected));audio.dispose();
});

test('distant destruction has a low impact body and obeys the same pause and ownership as gunfire',()=>{
    const {audio,context,route}=setup();assert.equal(audio.play('distant-crash'),true);
    assert.ok(context.nodes.some(n=>n.type==='triangle'&&n.frequency.changes[0]===82));
    assert.ok(context.nodes.some(n=>n.frequency.changes.includes(32)));
    assert.ok(context.nodes.some(n=>n.type==='lowpass'&&n.frequency.changes[0]===1100));
    assert.equal(audio.activeVoices,1);route.enabled=false;audio.sync();assert.equal(audio.activeVoices,0);
    assert.ok(context.nodes.every(n=>n.disconnected));assert.equal(audio.play('distant-crash'),false);
});

test('the masonry aftermath is quieter than its initial blow and never outlives pause',()=>{
    const {audio,context,route}=setup();audio.play('distant-crash');
    const blow=Math.max(...context.nodes.flatMap(n=>n.gain.changes)),start=context.nodes.length;
    audio.play('distant-debris');const nodes=context.nodes.slice(start);
    assert.ok(Math.max(...nodes.flatMap(n=>n.gain.changes))<blow*.5);
    assert.ok(nodes.some(n=>n.type==='bandpass'));
    route.enabled=false;audio.sync();assert.ok(nodes.every(n=>n.disconnected));assert.equal(audio.activeVoices,0);
});

test('rifle crack decays into a low body while impacts use a separate short metallic envelope',()=>{
    const {audio,context}=setup();audio.play('shot');
    assert.ok(context.nodes.some(n=>n.type==='triangle'&&n.frequency.changes.join(',')==='210,88,42'));
    assert.ok(context.nodes.some(n=>n.type==='lowpass'&&n.frequency.changes.join(',')==='5800,2400,420'));
    const begin=context.nodes.length;audio.play('impact');
    assert.ok(context.nodes.slice(begin).some(n=>n.type==='sine'&&n.frequency.changes.join(',')==='1350,310'));
    audio.dispose();assert.ok(context.nodes.every(n=>n.disconnected));
});


test('water contact uses a softer filtered splash on the same owned effects bus',()=>{
    const {audio,context}=setup();audio.play('impact');const strike=Math.max(...context.nodes.flatMap(n=>n.gain.changes));
    const start=context.nodes.length;audio.play('splash');const nodes=context.nodes.slice(start);
    assert.ok(nodes.some(n=>n.type==='bandpass'));assert.ok(Math.max(...nodes.flatMap(n=>n.gain.changes))<strike);
    audio.cancel();assert.equal(audio.activeVoices,0);assert.ok(nodes.every(n=>n.disconnected));
});

test('falling structures distinguish water from masonry without masking the rifle or leaving tails after pause',()=>{
    const {audio,context,route}=setup();audio.play('shot');const rifle=Math.max(...context.nodes.flatMap(n=>n.gain.changes));
    for(const cue of ['collapse-water','debris-land'] as const){
        const start=context.nodes.length;audio.play(cue);const nodes=context.nodes.slice(start);
        assert.ok(Math.max(...nodes.flatMap(n=>n.gain.changes))<rifle*.5);
        assert.ok(nodes.some(n=>n.type===(cue==='collapse-water'?'bandpass':'lowpass')));
        assert.ok(nodes.some(n=>n.frequency.changes.includes(cue==='collapse-water'?48:42)));
    }
    route.enabled=false;audio.sync();assert.equal(audio.activeVoices,0);assert.ok(context.nodes.every(n=>n.disconnected));
});
