export type WeaponCue = 'shot' | 'impact' | 'splash' | 'collapse-water' | 'debris-land' | 'reload' | 'distant-shot' | 'distant-hit' | 'distant-crash' | 'distant-debris';
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
        const contact=kind==='collapse-water'?{duration:.28,filter:'bandpass' as BiquadFilterType,cutoff:1600,tail:200,noise:.18,pitch:145,end:48,body:.12,wave:'sine' as OscillatorType}:
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
            const duration=contact?.duration??(splash?.16:crash?.32:kind==='reload'?.045:shot?.18:.085),volume=crash?.55:distant?.24:1;
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
            noise.connect(filter);filter.connect(env);env.connect(destination);body.connect(low);low.connect(destination);
            noise.onended=release;noise.start(now);body.start(now);noise.stop(now+duration+.015);body.stop(now+duration+.01);
            return true;
        }catch{release();return false;}
    }
}
