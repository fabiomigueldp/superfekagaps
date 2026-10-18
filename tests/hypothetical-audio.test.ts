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
    const {audio,context}=setup();const cues:WeaponCue[]=['shot','impact','distant-shot','distant-hit','reload'];
    for(let i=0;i<80;i++)audio.play(cues[i%cues.length]);
    assert.equal(audio.activeVoices,12);
    for(const n of context.nodes)n.onended?.();
    assert.equal(audio.activeVoices,0);assert.ok(context.nodes.every(n=>n.disconnected));audio.dispose();
});
