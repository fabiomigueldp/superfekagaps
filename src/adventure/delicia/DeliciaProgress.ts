import { developmentProfileStorage, hasDevelopmentAccess, siteDevelopmentUnlockEnabled, withDevelopmentAccess } from '../DevelopmentProgress';
import { ALL_DELICIA_STAGES, DELICIA_STAGES } from './DeliciaContent';
import { assertSaveCampaign } from '../saveCampaign';
export const DELICIA_SAVE_KEY = 'super_feka_delicia_v1';
export interface DeliciaSave {
    version: 1; completed: string[]; collected: string[]; lore: string[]; selected: string;
    times: Record<string,number>; checkpoint: {stage:string;index:number;valves:string[]} | null;
    music: number; effects: number; reducedMotion: boolean; assists: boolean; medals:Record<string,string[]>;
}
export const freshDeliciaSave = (): DeliciaSave => ({version:1,completed:[],collected:[],lore:['carta'],selected:'delicia-1',times:{},checkpoint:null,music:.45,effects:.7,reducedMotion:false,assists:false,medals:{}});
export const DELICIA_MEDALS={clean:'Travessia sem dano',seals:'Os três selos',tempo:'Ritmo cítrico',parry:'Mestre da rebatida'} as const;
export function awardDeliciaMedals(save:DeliciaSave,id:string,run:{eligible:boolean;damage:number;seals:number;seconds:number;parries:number}):string[]{
    if(!valid(id)||!run.eligible||save.assists)return[];
    const stage=ALL_DELICIA_STAGES.find(s=>s.id===id)!,earned:string[]=[];
    if(run.damage===0)earned.push('clean');if(!stage.boss&&run.seals===3)earned.push('seals');
    if(stage.parTime&&run.seconds<=stage.parTime)earned.push('tempo');if(stage.boss&&run.parries>=3)earned.push('parry');
    save.medals[id]=[...new Set([...(save.medals[id]??[]),...earned])];return earned;
}
const valid = (id: unknown): id is string => typeof id === 'string' && ALL_DELICIA_STAGES.some(s=>s.id===id);
export function parseDeliciaSave(raw:string): DeliciaSave {
    const d:unknown=JSON.parse(raw); if(!d||typeof d!=='object'||(d as {version?:unknown}).version!==1) throw new Error('Progresso da Delícia inválido.');
    const data=d as Record<string,unknown>, s=freshDeliciaSave();
    assertSaveCampaign(data, 'delicia');
    for(const key of ['completed','collected','lore'] as const) if(Array.isArray(data[key])) s[key]=[...new Set((data[key] as unknown[]).filter((v):v is string=>typeof v==='string'&&v.length<100&&(key!=='completed'||valid(v))))].slice(0,2000);
    if(valid(data.selected)) s.selected=data.selected;
    if(data.times&&typeof data.times==='object') for(const [id,time] of Object.entries(data.times)) if(valid(id)&&typeof time==='number'&&Number.isFinite(time)&&time>0) s.times[id]=time;
    if(data.medals&&typeof data.medals==='object')for(const [id,value] of Object.entries(data.medals))if(valid(id)&&Array.isArray(value))s.medals[id]=[...new Set(value.filter((v):v is string=>typeof v==='string'&&Object.hasOwnProperty.call(DELICIA_MEDALS,v)))];
    const cp=data.checkpoint as Record<string,unknown>|null; if(cp&&valid(cp.stage)&&Number.isInteger(cp.index)&&Number(cp.index)>=0&&Number(cp.index)<ALL_DELICIA_STAGES.find(stage=>stage.id===cp.stage)!.checkpoints.length) s.checkpoint={stage:cp.stage,index:Number(cp.index),valves:Array.isArray(cp.valves)?cp.valves.filter((v):v is string=>typeof v==='string'&&ALL_DELICIA_STAGES.find(stage=>stage.id===cp.stage)!.valves.some(valve=>valve.id===v)):[]};
    for(const key of ['music','effects'] as const) if(typeof data[key]==='number'&&Number.isFinite(data[key])) s[key]=Math.max(0,Math.min(1,data[key] as number));
    for(const key of ['reducedMotion','assists'] as const) if(typeof data[key]==='boolean') s[key]=data[key] as boolean;
    if(!s.lore.includes('carta'))s.lore.unshift('carta'); return s;
}
export function deliciaUnlocked(id:string, save:DeliciaSave):boolean {
    if (hasDevelopmentAccess(save)) return valid(id);
    const i=DELICIA_STAGES.findIndex(s=>s.id===id);
    if(i>=0) return i===0||save.completed.includes(DELICIA_STAGES[i-1].id)||save.completed.includes(id);
    return id==='delicia-raizes'?save.completed.includes('delicia-3'):id==='delicia-relogio'?save.completed.includes('delicia-9'):false;
}
export function completeDeliciaStage(save:DeliciaSave,id:string,seconds:number,recordEligible=true):void {
    if(!valid(id)||!deliciaUnlocked(id,save)) throw new Error('Fase da Delícia indisponível.');
    if(!save.completed.includes(id)) save.completed.push(id);
    if(Number.isFinite(seconds)&&seconds>0&&!save.assists&&recordEligible) save.times[id]=Math.min(save.times[id]??Infinity,seconds);
    const index=DELICIA_STAGES.findIndex(s=>s.id===id); save.selected=DELICIA_STAGES[Math.min(DELICIA_STAGES.length-1,index+1)]?.id??id;
    save.checkpoint=null;
    if(id==='delicia-6'&&!save.lore.includes('jaja')) save.lore.push('jaja');
    if(id==='delicia-12') for(const lore of ['recomeço','delicia'])if(!save.lore.includes(lore))save.lore.push(lore);
}
export class DeliciaStore {
    save=freshDeliciaSave(); warning=''; private protected=false;
    // Last successfully loaded/written bytes, never advanced by a failed write.
    // Refuse stale snapshots rather than merging settings, checkpoints or earnings.
    private storedRaw: string | null = null;
    // Storage-only marker makes even an identical deliberate import a replacement.
    private replacementId: string | undefined;
    private readReplacementId(raw: string): string | undefined {
        const value = JSON.parse(raw)?.replacementId;
        if (value === undefined) return undefined; // Existing v1 saves remain valid.
        if (typeof value !== 'string' || !value.startsWith('v1:') || value.length <= 3 || value.length > 128)
            throw Error('Unrecognized progress replacement marker');
        return value;
    }
    private readonly storage:Pick<Storage,'getItem'|'setItem'>|null;
    constructor(storage:Pick<Storage,'getItem'|'setItem'>|null, private readonly developmentUnlocked=siteDevelopmentUnlockEnabled()) {
        this.storage=developmentProfileStorage(storage,DELICIA_SAVE_KEY,developmentUnlocked);
        try {
            const raw = this.storage?.getItem(DELICIA_SAVE_KEY) ?? null;
            if (raw !== null) {
                const next = parseDeliciaSave(raw);
                this.replacementId = this.readReplacementId(raw);
                this.save = next;
            }
            this.storedRaw = raw;
        } catch {this.protected=true;this.warning='Progresso não pôde ser lido. Exporte uma cópia antes de importar outro.';}
        withDevelopmentAccess(this.save,developmentUnlocked);
    }
    persist():boolean {
        if(this.protected)return false;
        try {
            if (!this.storage) throw Error();
            // localStorage has no atomic compare-and-set: this guards observed stale
            // writers, not truly simultaneous writes or older unguarded game builds.
            if (this.storage.getItem(DELICIA_SAVE_KEY) !== this.storedRaw) {
                this.warning = 'Progresso alterado em outra aba. Exporte esta sessão antes de recarregar.';
                return false;
            }
            const raw = JSON.stringify({ ...this.save, replacementId: this.replacementId });
            this.storage.setItem(DELICIA_SAVE_KEY, raw);
            this.storedRaw = raw;
            this.warning = '';
            return true;
        } catch {this.warning='Progresso salvo apenas nesta sessão.';return false;}
    }
    /** Explicit import can recover protected storage; ordinary autosaves cannot. */
    import(raw:string):boolean {
        const next = parseDeliciaSave(raw);
        let replacementId: string, storedRaw: string;
        try {
            if (!this.storage) throw Error();
            replacementId = `v1:${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`}`;
            storedRaw = JSON.stringify({ ...next, replacementId });
            this.storage.setItem(DELICIA_SAVE_KEY, storedRaw);
        } catch {this.warning='Importação não foi salva. Progresso anterior mantido.';return false;}
        this.storedRaw = storedRaw;
        this.replacementId = replacementId;
        this.save=withDevelopmentAccess(next,this.developmentUnlocked);this.protected=false;this.warning='';return true;
    }
    collect(id:string,lore?:string):void {if(!this.save.collected.includes(id))this.save.collected.push(id);if(lore&&!this.save.lore.includes(lore))this.save.lore.push(lore);this.persist();}
}
