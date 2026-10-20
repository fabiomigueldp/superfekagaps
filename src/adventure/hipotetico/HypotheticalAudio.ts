import type {ChaseSound} from './HypotheticalChasePerformance';
export type WeaponCue = ChaseSound | 'chase-scoop' | 'chase-catch' | 'chase-gulp' | 'chase-exhale' | 'shot' | 'impact' | 'splash' | 'collapse-water' | 'debris-land' | 'reload' | 'distant-shot' | 'distant-hit' | 'distant-crash' | 'distant-debris' | 'distant-thud'
    | 'guard-swipe' | 'guard-sweep' | 'guard-parry' | 'guard-stomp' | 'distant-roar' | 'distant-flutter' | 'distant-soft-hit'
    | 'distant-wood' | 'distant-stone' | 'distant-metal' | 'distant-creak' | 'distant-chain' | 'distant-leak' | 'distant-snort' | 'distant-grit' | 'distant-launch' | 'distant-rocket' | 'distant-blast' | 'distant-bell' | 'distant-rotor' | 'distant-engine-fail';
interface Route { context: BaseAudioContext; destination: AudioNode; enabled: boolean }

/** Short, owned voices on WorldAudio's existing effects bus. No new context or timers. */
export class HypotheticalAudio {
    private releases = new Set<() => void>();
    private buffers = new WeakMap<BaseAudioContext, AudioBuffer>();
    private disposed = false;
    constructor(private readonly route: () => Route | null) {}
    get activeVoices() { return this.releases.size; }
    sync() { const r=this.route(); if(!r?.enabled||r.context.state!=='running')this.cancel(); }
    cancel() { for(const release of [...this.releases])release(); }
    dispose() { this.disposed=true;this.cancel(); }
    play(kind: WeaponCue) {
        const route=this.route();
        if(this.disposed||!route?.enabled||route.context.state!=='running')return false;
        const {context:c,destination}=route,now=c.currentTime,distant=kind.startsWith('distant'),shot=kind.endsWith('shot'),crash=kind==='distant-crash',splash=kind==='splash';
        const contact=kind==='chase-exhale'?{duration:.23,filter:'bandpass' as BiquadFilterType,cutoff:1250,tail:340,noise:.08,pitch:115,end:75,body:.025,wave:'sine' as OscillatorType}:
            kind==='chase-scoop'?{duration:.22,filter:'bandpass' as BiquadFilterType,cutoff:750,tail:1700,noise:.1,pitch:115,end:170,body:.06,wave:'triangle' as OscillatorType}:
            kind==='chase-catch'?{duration:.15,filter:'lowpass' as BiquadFilterType,cutoff:1250,tail:230,noise:.16,pitch:158,end:55,body:.2,wave:'triangle' as OscillatorType}:
            kind==='chase-gulp'?{duration:.25,filter:'bandpass' as BiquadFilterType,cutoff:480,tail:180,noise:.035,pitch:180,end:65,body:.16,wave:'sine' as OscillatorType}:
            kind==='chase-step'?{duration:.12,filter:'lowpass' as BiquadFilterType,cutoff:560,tail:110,noise:.075,pitch:88,end:34,body:.14,wave:'triangle' as OscillatorType}:
            kind==='chase-wood'?{duration:.24,filter:'bandpass' as BiquadFilterType,cutoff:1800,tail:320,noise:.23,pitch:142,end:44,body:.17,wave:'triangle' as OscillatorType}:
            kind==='chase-metal'?{duration:.34,filter:'bandpass' as BiquadFilterType,cutoff:2350,tail:510,noise:.14,pitch:510,end:155,body:.13,wave:'sine' as OscillatorType}:
            kind==='chase-cable'?{duration:.18,filter:'highpass' as BiquadFilterType,cutoff:2600,tail:800,noise:.12,pitch:1100,end:330,body:.035,wave:'sine' as OscillatorType}:
            kind==='guard-swipe'?{duration:.14,filter:'bandpass' as BiquadFilterType,cutoff:2400,tail:600,noise:.14,pitch:620,end:240,body:.035,wave:'triangle' as OscillatorType}:
            kind==='guard-sweep'?{duration:.2,filter:'bandpass' as BiquadFilterType,cutoff:1700,tail:420,noise:.19,pitch:330,end:90,body:.07,wave:'triangle' as OscillatorType}:
            kind==='guard-parry'?{duration:.13,filter:'highpass' as BiquadFilterType,cutoff:3600,tail:1400,noise:.12,pitch:1600,end:1150,body:.08,wave:'sine' as OscillatorType}:
            kind==='guard-stomp'?{duration:.18,filter:'lowpass' as BiquadFilterType,cutoff:1000,tail:150,noise:.25,pitch:120,end:45,body:.19,wave:'triangle' as OscillatorType}:
            kind==='distant-roar'?{duration:.65,filter:'bandpass' as BiquadFilterType,cutoff:650,tail:160,noise:.3,pitch:104,end:42,body:.35,wave:'sawtooth' as OscillatorType}:
            kind==='distant-wood'?{duration:.16,filter:'bandpass' as BiquadFilterType,cutoff:1900,tail:540,noise:.31,pitch:174,end:74,body:.16,wave:'triangle' as OscillatorType}:
            kind==='distant-stone'?{duration:.27,filter:'lowpass' as BiquadFilterType,cutoff:1150,tail:240,noise:.34,pitch:112,end:46,body:.23,wave:'triangle' as OscillatorType}:
            kind==='distant-metal'?{duration:.36,filter:'bandpass' as BiquadFilterType,cutoff:2700,tail:840,noise:.14,pitch:710,end:395,body:.14,wave:'sine' as OscillatorType}:
            kind==='distant-creak'?{duration:.42,filter:'bandpass' as BiquadFilterType,cutoff:840,tail:230,noise:.12,pitch:96,end:64,body:.08,wave:'triangle' as OscillatorType}:
            kind==='distant-chain'?{duration:.3,filter:'highpass' as BiquadFilterType,cutoff:2500,tail:1550,noise:.11,pitch:1040,end:790,body:.045,wave:'sine' as OscillatorType}:
            kind==='distant-leak'?{duration:.65,filter:'bandpass' as BiquadFilterType,cutoff:3100,tail:1200,noise:.16,pitch:200,end:130,body:.006,wave:'sine' as OscillatorType}:
            kind==='distant-snort'?{duration:.24,filter:'bandpass' as BiquadFilterType,cutoff:1350,tail:330,noise:.21,pitch:98,end:65,body:.035,wave:'triangle' as OscillatorType}:
            kind==='distant-grit'?{duration:.14,filter:'highpass' as BiquadFilterType,cutoff:1700,tail:900,noise:.085,pitch:480,end:210,body:.008,wave:'sine' as OscillatorType}:
            kind==='distant-flutter'?{duration:.19,filter:'bandpass' as BiquadFilterType,cutoff:2200,tail:820,noise:.16,pitch:155,end:90,body:.008,wave:'triangle' as OscillatorType}:
            kind==='distant-soft-hit'?{duration:.095,filter:'lowpass' as BiquadFilterType,cutoff:1550,tail:330,noise:.22,pitch:118,end:66,body:.045,wave:'triangle' as OscillatorType}:
            kind==='distant-rotor'?{duration:.19,filter:'bandpass' as BiquadFilterType,cutoff:590,tail:180,noise:.13,pitch:68,end:56,body:.055,wave:'triangle' as OscillatorType}:
            kind==='distant-engine-fail'?{duration:.95,filter:'bandpass' as BiquadFilterType,cutoff:2300,tail:230,noise:.24,pitch:780,end:84,body:.12,wave:'sawtooth' as OscillatorType}:
            kind==='distant-launch'?{duration:.34,filter:'bandpass' as BiquadFilterType,cutoff:1900,tail:330,noise:.4,pitch:210,end:62,body:.22,wave:'triangle' as OscillatorType}:
            kind==='distant-rocket'?{duration:.3,filter:'bandpass' as BiquadFilterType,cutoff:900,tail:3100,noise:.24,pitch:180,end:470,body:.045,wave:'triangle' as OscillatorType}:
            kind==='distant-blast'?{duration:.64,filter:'lowpass' as BiquadFilterType,cutoff:2100,tail:100,noise:.55,pitch:94,end:29,body:.48,wave:'triangle' as OscillatorType}:
            kind==='distant-bell'?{duration:1.05,filter:'bandpass' as BiquadFilterType,cutoff:1800,tail:520,noise:.1,pitch:436,end:428,body:.27,wave:'sine' as OscillatorType}:
            kind==='distant-thud'?{duration:.18,filter:'lowpass' as BiquadFilterType,cutoff:820,tail:120,noise:.2,pitch:96,end:38,body:.38,wave:'triangle' as OscillatorType}:
            kind==='collapse-water'?{duration:.28,filter:'bandpass' as BiquadFilterType,cutoff:1600,tail:200,noise:.18,pitch:145,end:48,body:.12,wave:'sine' as OscillatorType}:
            kind==='debris-land'?{duration:.16,filter:'lowpass' as BiquadFilterType,cutoff:980,tail:170,noise:.18,pitch:110,end:42,body:.13,wave:'triangle' as OscillatorType}:
            kind==='distant-debris'?{duration:.24,filter:'bandpass' as BiquadFilterType,cutoff:1250,tail:180,noise:.36,pitch:96,end:35,body:.2,wave:'triangle' as OscillatorType}:null;
        const nodes:AudioNode[]=[],sources:AudioScheduledSourceNode[]=[];
        let done=false;
        const release=()=>{if(done)return;done=true;for(const s of sources){s.onended=null;try{s.stop();}catch{/* Already ended. */}}for(const n of nodes){try{n.disconnect();}catch{/* Closed device. */}}this.releases.delete(release);};
        try{
            // Bounded even when a background tab catches up several simulation steps.
            if(this.releases.size>=12)this.releases.values().next().value?.();
            this.releases.add(release);
            let buffer=this.buffers.get(c);
            if(!buffer){buffer=c.createBuffer(1,Math.ceil(c.sampleRate*.4),c.sampleRate);const data=buffer.getChannelData(0);let seed=1747;
                for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}this.buffers.set(c,buffer);}
            const noise=c.createBufferSource(),filter=c.createBiquadFilter(),env=c.createGain(),body=c.createOscillator(),low=c.createGain();
            nodes.push(noise,filter,env,body,low);sources.push(noise,body);noise.buffer=buffer;
            const duration=contact?.duration??(splash?.16:crash?.32:kind==='reload'?.045:shot?.18:.085),volume=crash?.55:kind==='distant-blast'?.4:distant?.24:1;
            noise.loop=duration>buffer.duration;
            filter.type=contact?.filter??(splash?'bandpass':kind==='reload'?'highpass':'lowpass');
            filter.frequency.setValueAtTime(contact?.cutoff??(splash?2100:crash?1100:distant?1500:shot?5800:6200),now);
            if(shot)filter.frequency.exponentialRampToValueAtTime(distant?780:2400,now+.018);
            filter.frequency.exponentialRampToValueAtTime(contact?.tail??(splash?280:crash?120:distant?300:shot?420:900),now+duration);
            env.gain.setValueAtTime(0,now);env.gain.linearRampToValueAtTime((contact?.noise??(splash?.095:crash?.42:shot?.46:.16))*volume,now+.001);
            if(shot)env.gain.exponentialRampToValueAtTime(.12*volume,now+.025);
            env.gain.exponentialRampToValueAtTime(.001,now+duration);
            body.type=contact?.wave??(shot||crash?'triangle':'sine');body.frequency.setValueAtTime(contact?.pitch??(splash?480:crash?82:shot?(distant?145:210):kind==='reload'?1600:1350),now);
            if(shot)body.frequency.exponentialRampToValueAtTime(88,now+.014);
            body.frequency.exponentialRampToValueAtTime(contact?.end??(splash?150:crash?32:shot?42:kind==='reload'?700:310),now+duration*.75);
            low.gain.setValueAtTime(0,now);low.gain.linearRampToValueAtTime((contact?.body??(splash?.04:crash?.42:shot?.43:.075))*volume,now+.003);low.gain.exponentialRampToValueAtTime(.001,now+duration);
            if(kind==='distant-rotor'){
                // Four blade beats per owned voice; no looping source survives pause.
                for(const [gain,peak] of [[env.gain,.13],[low.gain,.055]] as const){
                    gain.cancelScheduledValues(now);gain.setValueAtTime(.001,now);
                    for(let blade=0;blade<4;blade++){
                        const at=now+blade*.044;
                        gain.linearRampToValueAtTime(peak*volume,at+.006);
                        gain.exponentialRampToValueAtTime(.001,at+.039);
                    }
                }
            }
            if(kind==='distant-flutter'){
                env.gain.cancelScheduledValues(now);env.gain.setValueAtTime(.001,now);
                for(let wing=0;wing<3;wing++){
                    const at=now+wing*.058;
                    env.gain.linearRampToValueAtTime((.16-wing*.025)*volume,at+.011);
                    env.gain.exponentialRampToValueAtTime(.001,at+.052);
                }
            }
            noise.connect(filter);filter.connect(env);env.connect(destination);body.connect(low);low.connect(destination);
            if(kind==='distant-bell')for(const [ratio,level,length] of [[2.71,.11,.7],[4.08,.055,.38]]){
                const partial=c.createOscillator(),gain=c.createGain();nodes.push(partial,gain);sources.push(partial);
                partial.type='sine';partial.frequency.setValueAtTime(436*ratio,now);
                gain.gain.setValueAtTime(0,now);gain.gain.linearRampToValueAtTime(level*volume,now+.002);
                gain.gain.exponentialRampToValueAtTime(.001,now+length);
                partial.connect(gain);gain.connect(destination);partial.start(now);partial.stop(now+length+.01);
            }
            noise.onended=release;noise.start(now);body.start(now);noise.stop(now+duration+.015);body.stop(now+duration+.01);
            return true;
        }catch{release();return false;}
    }
}
