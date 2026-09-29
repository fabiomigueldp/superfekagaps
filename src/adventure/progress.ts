import type { AdventureSave, AdventureStage } from './types';
export const SAVE_KEY = 'super_feka_gaps_world_v1';
export const freshSave = (): AdventureSave => ({ version: 1, completed: [], seals: [], secrets: [], seen: [], selected: '1-1', checkpoint: null, times: {}, preferences: { music: .55, effects: .7, voice: .8, shake: true } });
const validId = (s: unknown): s is string => typeof s === 'string' && /^[1-6]-[1-5]$/.test(s);
export function parseSave(raw: string): AdventureSave {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || (data as {
        version?: unknown;
    }).version !== 1)
        throw Error('Versão de progresso não reconhecida.');
    const o = data as Record<string, unknown>, result = freshSave();
    const list = (key: string, predicate: (v: unknown) => boolean) => Array.isArray(o[key]) ? [...new Set((o[key] as unknown[]).filter(predicate))] as string[] : [];
    result.completed = list('completed', validId);
    result.secrets = list('secrets', v => typeof v === 'string' && /^[1-6]-3$/.test(v));
    result.seals = list('seals', v => typeof v === 'string' && /^[1-6]-[1-4]:s[123]$/.test(v));
    result.seen = list('seen', v => typeof v === 'string' && v.length < 100).slice(0, 200);
    result.selected = validId(o.selected) ? o.selected : '1-1';
    if (o.times && typeof o.times === 'object')
        for (const [id, n] of Object.entries(o.times))
            if (validId(id) && typeof n === 'number' && Number.isFinite(n) && n > 0)
                result.times[id] = n;
    const p = o.preferences as Record<string, unknown> | undefined;
    if (p && typeof p === 'object')
        for (const key of ['music', 'effects', 'voice'] as const) {
            const n = p[key];
            if (typeof n === 'number' && Number.isFinite(n))
                result.preferences[key] = Math.max(0, Math.min(1, n));
        }
    if (p && typeof p.shake === 'boolean')
        result.preferences.shake = p.shake;
    const cp = o.checkpoint as Record<string, unknown> | undefined;
    if (cp && validId(cp.stage) && Number.isInteger(cp.index) && Number(cp.index) >= 0 && Number(cp.index) < 20)
        result.checkpoint = { stage: cp.stage, index: Number(cp.index), helmet: cp.helmet === true };
    // A secret exit also constitutes completion; restore this invariant for older exports.
    for (const id of result.secrets)
        if (!result.completed.includes(id))
            result.completed.push(id);
    return result;
}
export function isUnlocked(id: string, save: AdventureSave): boolean {
    if (!validId(id))
        return false;
    const [w, n] = id.split('-').map(Number);
    if (w > 1 && !save.completed.includes(`${w - 1}-5`))
        return false;
    if (n === 1)
        return true;
    if (n === 5 && save.secrets.includes(`${w}-3`))
        return true;
    return save.completed.includes(`${w}-${n - 1}`);
}
export function finishStage(save: AdventureSave, id: string, exit: 'normal' | 'secret', seconds: number): void {
    if (!validId(id))
        throw Error('Fase inválida');
    if (exit === 'secret' && !id.endsWith('-3'))
        throw Error('Saída secreta inválida');
    if (!save.completed.includes(id))
        save.completed.push(id);
    if (exit === 'secret' && !save.secrets.includes(id))
        save.secrets.push(id);
    if (Number.isFinite(seconds) && seconds > 0)
        save.times[id] = Math.min(save.times[id] ?? Infinity, seconds);
    save.checkpoint = null;
    const [w, n] = id.split('-').map(Number);
    save.selected = exit === 'secret' ? `${w}-5` : n < 5 ? `${w}-${n + 1}` : w < 6 ? `${w + 1}-1` : id;
}
export class ProgressStore {
    save = freshSave();
    warning = '';
    private protected = false;
    constructor(private storage: Pick<Storage, 'getItem' | 'setItem'> | null) {
        try {
            const raw = storage?.getItem(SAVE_KEY);
            if (raw)
                this.save = parseSave(raw);
        }
        catch {
            this.warning = 'Não foi possível abrir o progresso. Exporte uma cópia antes de substituir.';
            this.protected = true;
        }
    }
    persist(): boolean {
        if (this.protected)
            return false;
        try {
            if (!this.storage)
                throw Error();
            this.storage.setItem(SAVE_KEY, JSON.stringify(this.save));
            this.warning = '';
            return true;
        }
        catch {
            this.warning = 'Progresso nesta sessão. Armazenamento indisponível.';
            return false;
        }
    }
    import(raw: string): void { const next = parseSave(raw); this.save = next; this.protected = false; this.persist(); }
    collect(id: string): boolean { if (this.save.seals.includes(id))
        return false; this.save.seals.push(id); this.persist(); return true; }
}
export function validateStage(stage: AdventureStage): string[] {
    const errors: string[] = [];
    const ids = new Set<string>();
    if (!validId(stage.id))
        errors.push('ID inválido');
    if (stage.level.tiles.length !== stage.level.height || stage.level.tiles.some(r => r.length !== stage.level.width))
        errors.push('Dimensões inválidas');
    for (const m of stage.mechanisms) {
        if (ids.has(m.id))
            errors.push(`Objeto duplicado: ${m.id}`);
        ids.add(m.id);
        if (![m.x, m.y, m.width, m.height].every(Number.isFinite) || m.width <= 0 || m.height <= 0)
            errors.push(`Geometria inválida: ${m.id}`);
    }
    for (const m of stage.mechanisms)
        if (m.link && !ids.has(m.link))
            errors.push(`Ligação ausente: ${m.link}`);
    for (const e of stage.exits)
        if (e.requires && !ids.has(e.requires))
            errors.push(`Saída sem mecanismo: ${e.requires}`);
    const seals = stage.pickups.filter(p => p.kind === 'seal');
    if (seals.length !== (stage.encounter ? 0 : 3))
        errors.push('Quantidade de selos inválida');
    if (new Set(stage.pickups.map(p => p.id)).size !== stage.pickups.length)
        errors.push('Coletáveis duplicados');
    if (stage.exits.filter(e => e.id === 'secret').length !== (stage.number === 3 ? 1 : 0))
        errors.push('Saída secreta inválida');
    return errors;
}
