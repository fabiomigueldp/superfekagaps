import { DELICIA_ASSETS } from './DeliciaContent';
/** Bounded audio ownership, original generated samples and graceful device fallback. */
export class DeliciaAudio {
    private context:AudioContext|null=null;private buffers=new Map<string,AudioBuffer>();private pending=new Map<string,Promise<AudioBuffer|null>>();
    private sources=new Set<AudioBufferSourceNode>();private musicSource:AudioBufferSourceNode|null=null;private musicGain:GainNode|null=null;
    private voiceSource:AudioBufferSourceNode|null=null;private track='';private playingTrack='';private paused=false;private disposed=false;private musicRequest=0;
    private masterGain:GainNode|null=null;private ambienceSource:AudioBufferSourceNode|null=null;private ambienceGain:GainNode|null=null;
    musicVolume=.45;effectsVolume=.7;muted=false;
    async unlock():Promise<void>{
        if(this.disposed)return;
        try{
            if(!this.context){this.context=new AudioContext();this.masterGain=this.context.createGain();this.masterGain.gain.value=this.muted?0:1;this.masterGain.connect(this.context.destination);}
            // The sound checkbox also unlocks audio from the pause menu; keep its playheads frozen.
            await (this.paused?this.context.suspend():this.context.resume());
            for(const name of ['collect','dash','seed','parry','pound','pressure','warning','boss-hit','victory'])void this.load(name);
            if(this.track)this.music(this.track);
        }catch{/* Silent gameplay remains usable on devices without audio. */}
    }
    private async load(name:string):Promise<AudioBuffer|null>{
        if(!this.context||this.disposed)return null;const existing=this.buffers.get(name);if(existing)return existing;const pending=this.pending.get(name);if(pending)return pending;
        const request=(async()=>{try{const response=await fetch(DELICIA_ASSETS+'audio/'+name+'.ogg');if(!response.ok||!this.context)return null;const buffer=await this.context.decodeAudioData(await response.arrayBuffer());if(this.disposed)return null;this.buffers.set(name,buffer);return buffer;}catch{return null;}finally{this.pending.delete(name);}})();
        this.pending.set(name,request);return request;
    }
    effect(name:string,volume=1):void{
        if(this.muted||this.paused||!this.context||this.disposed)return;
        if(name==='jump'){this.tone(name);return;}
        const buffer=this.buffers.get(name);if(!buffer){void this.load(name);this.tone(name);return;}
        if(this.sources.size>16)return;const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;gain.gain.value=this.effectsVolume*volume*.65;source.connect(gain);gain.connect(this.masterGain??this.context.destination);source.onended=()=>{this.sources.delete(source);source.disconnect();gain.disconnect();};this.sources.add(source);source.start();
    }
    private tone(name:string):void{
        const ctx=this.context;if(!ctx||this.muted)return;const o=ctx.createOscillator(),g=ctx.createGain();o.type='triangle';const frequency=name==='jump'?420:name==='collect'?980:180;o.frequency.setValueAtTime(frequency,ctx.currentTime);o.frequency.exponentialRampToValueAtTime(frequency*1.7,ctx.currentTime+.1);g.gain.setValueAtTime(this.effectsVolume*.06,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.13);o.connect(g);g.connect(this.masterGain??ctx.destination);o.onended=()=>{o.disconnect();g.disconnect();};o.start();o.stop(ctx.currentTime+.15);
    }
    music(name:string):void{
        if(this.track!==name)++this.musicRequest;this.track=name;
        // A decode may finish while paused; only a started source fulfills the requested track.
        if(this.playingTrack===name&&this.musicSource){this.ambience(name,this.musicRequest);return;}
        // Retrying the same track must not invalidate its pending dialogue voice.
        const request=this.musicRequest;
        void this.load(name).then(buffer=>{if(!buffer||this.disposed||this.paused||request!==this.musicRequest||!this.context||(this.playingTrack===name&&this.musicSource))return;
            const ctx=this.context,old=this.musicSource,oldGain=this.musicGain;const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.loop=true;
            // Small tail crossfade is accomplished by the gain ramp on a track transition.
            gain.gain.setValueAtTime(0,ctx.currentTime);gain.gain.linearRampToValueAtTime(this.muted?0:this.musicVolume*.7,ctx.currentTime+.65);source.connect(gain);gain.connect(this.masterGain??ctx.destination);source.start();this.musicSource=source;this.musicGain=gain;this.playingTrack=name;this.ambience(name,request);
            if(old&&oldGain){oldGain.gain.cancelScheduledValues(ctx.currentTime);oldGain.gain.setTargetAtTime(0,ctx.currentTime,.12);try{old.stop(ctx.currentTime+.6);}catch{}old.onended=()=>{old.disconnect();oldGain.disconnect();};}
        });
    }
    private ambience(track:string,request:number):void{
        if(track!=='orchard'){try{this.ambienceSource?.stop();}catch{}this.ambienceSource=null;this.ambienceGain=null;return;}
        if(this.paused||this.disposed||this.ambienceSource)return;void this.load('orchard-air').then(buffer=>{
            if(!buffer||!this.context||this.disposed||this.paused||this.ambienceSource||request!==this.musicRequest)return;
            const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;source.loop=true;gain.gain.value=this.effectsVolume*.08;source.connect(gain);gain.connect(this.masterGain??this.context.destination);source.onended=()=>{source.disconnect();gain.disconnect();};source.start();this.ambienceSource=source;this.ambienceGain=gain;
        });
    }
    voice(name:string):void{
        if(!name)return;const request=this.musicRequest;void this.load(name).then(buffer=>{if(!buffer||this.disposed||this.muted||this.paused||!this.context||request!==this.musicRequest)return;
            try{this.voiceSource?.stop();}catch{}const source=this.context.createBufferSource(),gain=this.context.createGain();source.buffer=buffer;gain.gain.value=this.effectsVolume*.8;source.connect(gain);gain.connect(this.masterGain??this.context.destination);this.voiceSource=source;
            this.musicGain?.gain.setTargetAtTime(this.musicVolume*.23,this.context.currentTime,.07);source.onended=()=>{source.disconnect();gain.disconnect();if(this.voiceSource===source){this.voiceSource=null;if(this.context)this.musicGain?.gain.setTargetAtTime(this.muted?0:this.musicVolume*.7,this.context.currentTime,.15);}};source.start();
        });
    }
    setVolume(music:number,effects:number):void{this.musicVolume=music;this.effectsVolume=effects;if(this.context){this.musicGain?.gain.setTargetAtTime(this.muted?0:music*.7,this.context.currentTime,.1);if(this.masterGain){this.masterGain.gain.cancelScheduledValues(this.context.currentTime);this.masterGain.gain.value=this.muted?0:1;}this.ambienceGain?.gain.setTargetAtTime(effects*.08,this.context.currentTime,.1);}}
    toggleMute():void{this.muted=!this.muted;this.setVolume(this.musicVolume,this.effectsVolume);if(this.muted){try{this.voiceSource?.stop();}catch{}}}
    pause(paused:boolean):void{this.paused=paused;if(paused){void this.context?.suspend();}else{void this.context?.resume();if(this.track)this.music(this.track);}}
    dispose():void{this.disposed=true;++this.musicRequest;for(const s of this.sources)try{s.stop();}catch{}for(const s of [this.musicSource,this.voiceSource,this.ambienceSource])try{s?.stop();}catch{}this.sources.clear();this.masterGain?.disconnect();void this.context?.close();this.context=null;this.buffers.clear();}
}
