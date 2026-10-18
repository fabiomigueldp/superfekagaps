/* Render the production weapon synth, then place its cues at the native replay's exact ticks. */
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const [source,destination]=process.argv.slice(2);assert.ok(source&&destination);
const tape=JSON.parse(fs.readFileSync(source,'utf8')),rate=48000;
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'msedge'});
 let samples;
 try{
  const page=await browser.newPage();await page.goto((process.env.FEKA_UI_URL||'http://localhost:3000')+'/');
  samples=await page.evaluate(async rate=>{
   const {HypotheticalAudio}=await import('/src/adventure/hipotetico/HypotheticalAudio.ts');
   const result={};
   for(const kind of ['shot','impact','reload','distant-shot','distant-hit']){
    const context=new OfflineAudioContext(1,Math.ceil(rate*.18),rate),bus=context.createGain();bus.gain.value=.18;bus.connect(context.destination);
    // Only the offline device boundary differs. The production voice owns every envelope and oscillator.
    const routeContext=new Proxy(context,{get(target,key){if(key==='state')return 'running';const value=Reflect.get(target,key,target);return typeof value==='function'?value.bind(target):value;}});
    const audio=new HypotheticalAudio(()=>({context:routeContext,destination:bus,enabled:true}));
    if(!audio.play(kind))throw Error('Could not render '+kind);
    const buffer=await context.startRendering();result[kind]=Array.from(buffer.getChannelData(0));audio.dispose();
   }
   return result;
  },rate);
 }finally{await browser.close();}
 const mix=new Float32Array(Math.ceil(tape.seconds*rate));
 for(const cue of tape.cues){const sample=samples[cue.kind],offset=Math.round(cue.frame/60*rate);assert.ok(sample);for(let i=0;i<sample.length&&offset+i<mix.length;i++)mix[offset+i]+=sample[i];}
 let peak=0,energy=0;for(const s of mix){peak=Math.max(peak,Math.abs(s));energy+=s*s;}
 assert.ok(peak>0&&peak<.95,'Sound must be audible without clipping');
 const wav=Buffer.alloc(44+mix.length*2);wav.write('RIFF');wav.writeUInt32LE(wav.length-8,4);wav.write('WAVEfmt ',8);wav.writeUInt32LE(16,16);wav.writeUInt16LE(1,20);wav.writeUInt16LE(1,22);wav.writeUInt32LE(rate,24);wav.writeUInt32LE(rate*2,28);wav.writeUInt16LE(2,32);wav.writeUInt16LE(16,34);wav.write('data',36);wav.writeUInt32LE(mix.length*2,40);
 for(let i=0;i<mix.length;i++)wav.writeInt16LE(Math.round(Math.max(-1,Math.min(1,mix[i]))*32767),44+i*2);
 fs.mkdirSync(path.dirname(path.resolve(destination)),{recursive:true});fs.writeFileSync(destination,wav);
 const report={productionSynth:true,weaponEffectsOnly:true,cues:tape.cues.length,seconds:tape.seconds,peak,rms:Math.sqrt(energy/mix.length),sampleRate:rate};
 fs.writeFileSync(destination+'.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
