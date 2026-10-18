export type WeaponCue = 'shot' | 'impact' | 'reload' | 'distant-shot' | 'distant-hit';
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
        const {context:c,destination}=route,now=c.currentTime,distant=kind.startsWith('distant'),shot=kind.endsWith('shot');
        const nodes:AudioNode[]=[],sources:AudioScheduledSourceNode[]=[];
        let done=false;
        const release=()=>{if(done)return;done=true;for(const s of sources){s.onended=null;try{s.stop();}catch{/* Already ended. */}}for(const n of nodes){try{n.disconnect();}catch{/* Closed device. */}}this.releases.delete(release);};
        try{
            // Bounded even when a background tab catches up several simulation steps.
            if(this.releases.size>=12)this.releases.values().next().value?.();
            this.releases.add(release);
            let buffer=this.buffers.get(c);
            if(!buffer){buffer=c.createBuffer(1,Math.ceil(c.sampleRate*.16),c.sampleRate);const data=buffer.getChannelData(0);let seed=1747;
                for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=seed/2147483648-1;}this.buffers.set(c,buffer);}
            const noise=c.createBufferSource(),filter=c.createBiquadFilter(),env=c.createGain(),body=c.createOscillator(),low=c.createGain();
            nodes.push(noise,filter,env,body,low);sources.push(noise,body);noise.buffer=buffer;
            const duration=kind==='reload'?.045:shot?.105:.065,volume=distant?.24:1;
            filter.type=kind==='reload'?'highpass':'lowpass';
            filter.frequency.setValueAtTime(distant?1250:shot?4700:6200,now);
            filter.frequency.exponentialRampToValueAtTime(distant?350:800,now+duration);
            env.gain.setValueAtTime(0,now);env.gain.linearRampToValueAtTime((shot?.38:.16)*volume,now+.002);env.gain.exponentialRampToValueAtTime(.001,now+duration);
            body.type=shot?'triangle':'sine';body.frequency.setValueAtTime(shot?180:kind==='reload'?1600:2300,now);
            body.frequency.exponentialRampToValueAtTime(shot?55:700,now+duration*.75);
            low.gain.setValueAtTime(0,now);low.gain.linearRampToValueAtTime((shot?.32:.075)*volume,now+.003);low.gain.exponentialRampToValueAtTime(.001,now+duration);
            noise.connect(filter);filter.connect(env);env.connect(destination);body.connect(low);low.connect(destination);
            noise.onended=release;noise.start(now);body.start(now);noise.stop(now+duration+.015);body.stop(now+duration+.01);
            return true;
        }catch{release();return false;}
    }
}
