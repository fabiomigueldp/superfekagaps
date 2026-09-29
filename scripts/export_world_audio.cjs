// Offline renders use the same original score and oscillators as the runtime.
const {chromium}=require(process.env.PLAYWRIGHT_PATH||'playwright');const fs=require('node:fs');const path=require('node:path');
const out=path.resolve(__dirname,'../public/assets/world/audio');
(async()=>{fs.mkdirSync(out,{recursive:true});const browser=await chromium.launch({executablePath:process.env.CHROME_PATH,headless:true,args:['--no-sandbox']});try{
 const page=await browser.newPage();await page.goto(process.env.GAME_URL||'http://127.0.0.1:3000');
 const tracks=[...Array.from({length:6},(_,i)=>({name:`mundo-${i+1}`,theme:i,boss:false})),{name:'mapa',theme:6,boss:false},{name:'joaozao',theme:0,boss:true},{name:'bielzao',theme:1,boss:true},{name:'calabrezzo',theme:2,boss:true}];
 for(const track of tracks){const result=await page.evaluate(async({theme,boss})=>{
  const {musicNotes}=await import('/src/adventure/WorldAudio.ts');const tempo=musicNotes(theme,0,boss).tempo,duration=tempo*128,sampleRate=22050;
  const ctx=new OfflineAudioContext(1,Math.ceil(duration*sampleRate),sampleRate);const master=ctx.createGain();master.gain.value=.14;master.connect(ctx.destination);
  for(let step=0;step<128;step++){const t=step*tempo;for(const n of musicNotes(theme,step,boss).notes){const source=ctx.createOscillator(),gain=ctx.createGain();source.frequency.value=n.frequency;source.type=n.type;gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(n.volume,t+.008);gain.gain.exponentialRampToValueAtTime(.001,t+n.duration);source.connect(gain);gain.connect(master);source.start(t);source.stop(t+n.duration+.015);}}
  const buffer=await ctx.startRendering(),samples=buffer.getChannelData(0),bytes=new Uint8Array(samples.length*2),view=new DataView(bytes.buffer);let peak=0;
  for(let i=0;i<samples.length;i++){peak=Math.max(peak,Math.abs(samples[i]));const fade=Math.min(1,i/110,(samples.length-1-i)/110);view.setInt16(i*2,Math.round(Math.max(-1,Math.min(1,samples[i]*fade))*32767),true);}
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return {data:btoa(binary),sampleRate,duration,peak};
 },track);
 const pcm=Buffer.from(result.data,'base64'),header=Buffer.alloc(44);header.write('RIFF',0);header.writeUInt32LE(pcm.length+36,4);header.write('WAVEfmt ',8);header.writeUInt32LE(16,16);header.writeUInt16LE(1,20);header.writeUInt16LE(1,22);header.writeUInt32LE(result.sampleRate,24);header.writeUInt32LE(result.sampleRate*2,28);header.writeUInt16LE(2,32);header.writeUInt16LE(16,34);header.write('data',36);header.writeUInt32LE(pcm.length,40);fs.writeFileSync(path.join(out,track.name+'.wav'),Buffer.concat([header,pcm]));track.duration=result.duration;track.peak=result.peak;
 }fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({source:'src/adventure/WorldAudio.ts',format:'PCM 16-bit mono 22050 Hz',tracks},null,2));console.log(`Exportadas ${tracks.length} faixas originais.`);
 }finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
