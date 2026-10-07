import { developmentProfileStorage, hasDevelopmentAccess, siteDevelopmentUnlockEnabled, withDevelopmentAccess } from './DevelopmentProgress';
import { freshGuairaChapterProgress, sanitizeGuairaChapterProgress, mergeGuairaChapterProgress, type GuairaChapterProgress } from './experimental/guaira/chapter/GuairaChapterProgress';
import type { AdventureSave, AdventureStage } from './types';
import { assertSaveCampaign } from './saveCampaign';
import { carrierMotionErrors } from './WorldCarrierMotion';
import { isSolidTile } from '../world/tileRules';
import { TILE_SIZE } from '../constants';
import { FACTORY_SALON } from './factory/FactorySalon';
export const SAVE_KEY = 'super_feka_gaps_world_v1';
export const freshSave = (): AdventureSave => ({ version: 1, guaira: freshGuairaChapterProgress(), completed: [], seals: [], secrets: [], seen: [], selected: '1-1', checkpoint: null, times: {}, preferences: { music: .55, effects: .7, voice: .8, shake: true } });
/** Fresh editor previews need a new read-through. Never call for an in-game retry. */
export function resetPreviewGuidance(save: AdventureSave): void {
    save.seen = save.seen.filter(id => !id.startsWith('dialogue:') && !id.startsWith('control:'));
}
const validId = (s: unknown): s is string => typeof s === 'string' && /^[1-6]-[1-5]$/.test(s);
export function parseSave(raw: string, developmentUnlocked = false): AdventureSave {
    const data: unknown = JSON.parse(raw);
    if (!data || typeof data !== 'object' || (data as {
        version?: unknown;
    }).version !== 1)
        throw Error('Versão de progresso não reconhecida.');
    const o = data as Record<string, unknown>, result = freshSave();
    assertSaveCampaign(o, 'world');
    const list = (key: string, predicate: (v: unknown) => boolean) => Array.isArray(o[key]) ? [...new Set((o[key] as unknown[]).filter(predicate))] as string[] : [];
    result.completed = list('completed', validId);
    result.guaira = sanitizeGuairaChapterProgress(o.guaira, developmentUnlocked);
    // A pre-chapter save earned Serra by completing 3-5. Preserve that promise.
    if (o.legacySerraAccess === true || (!o.guaira && result.completed.includes('3-5'))) result.legacySerraAccess = true;
    result.secrets = list('secrets', v => typeof v === 'string' && /^[1-6]-3$/.test(v));
    result.seals = list('seals', v => typeof v === 'string' && /^[1-6]-[1-4]:s[123]$/.test(v));
    // Dedicated story/result slots survive even a full legacy journal or a late
    // append. Keep the old 201 ordinary slots and the original relative order.
    const seen = list('seen', v => typeof v === 'string' && v.length < 100);
    let ordinary = 0;
    result.seen = seen.filter(id => id === FACTORY_SALON.passage || id === FACTORY_SALON.victory || ordinary++ < 201);
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
export function isGuairaUnlocked(save: AdventureSave): boolean { return hasDevelopmentAccess(save) || save.completed.includes('3-5'); }
export function canContinueFromGuaira(save: AdventureSave): boolean {
    return hasDevelopmentAccess(save) || save.legacySerraAccess === true || save.guaira?.completed.includes('guaira-prefeito') === true;
}
export function isUnlocked(id: string, save: AdventureSave): boolean {
    if (!validId(id))
        return false;
    if (hasDevelopmentAccess(save)) return true;
    const [w, n] = id.split('-').map(Number);
    if (w === 4 && !canContinueFromGuaira(save)) return false;
    if (w > 1 && !save.completed.includes(`${w - 1}-5`))
        return false;
    if (n === 1)
        return true;
    if (n === 5 && save.secrets.includes(`${w}-3`))
        return true;
    return save.completed.includes(`${w}-${n - 1}`);
}
export function finishStage(save: AdventureSave, id: string, exit: 'normal' | 'secret', seconds: number | null): void {
    if (!validId(id))
        throw Error('Fase inválida');
    if (exit === 'secret' && !id.endsWith('-3'))
        throw Error('Saída secreta inválida');
    if (!save.completed.includes(id))
        save.completed.push(id);
    if (exit === 'secret' && !save.secrets.includes(id))
        save.secrets.push(id);
    if (seconds !== null && Number.isFinite(seconds) && seconds > 0)
        save.times[id] = Math.min(save.times[id] ?? Infinity, seconds);
    save.checkpoint = null;
    const [w, n] = id.split('-').map(Number);
    save.selected = exit === 'secret' ? `${w}-5` : n < 5 ? `${w}-${n + 1}` : w < 6 ? `${w + 1}-1` : id;
}
export class ProgressStore {
    save = freshSave();
    warning = '';
    private protected = false;
    private readonly storage: Pick<Storage, 'getItem' | 'setItem'> | null;
    constructor(storage: Pick<Storage, 'getItem' | 'setItem'> | null, private readonly developmentUnlocked = siteDevelopmentUnlockEnabled()) {
        this.storage = developmentProfileStorage(storage, SAVE_KEY, developmentUnlocked);
        try {
            const raw = this.storage?.getItem(SAVE_KEY);
            if (raw)
                this.save = parseSave(raw, this.developmentUnlocked);
        }
        catch {
            this.warning = 'Não foi possível abrir o progresso. Exporte uma cópia antes de substituir.';
            this.protected = true;
        }
        this.applyDevelopmentAccess();
    }
    private applyDevelopmentAccess(): void {
        withDevelopmentAccess(this.save, this.developmentUnlocked);
        withDevelopmentAccess(this.save.guaira, this.developmentUnlocked);
    }
    persist(mergeChapter = true): boolean {
        if (this.protected)
            return false;
        try {
            if (!this.storage)
                throw Error();
            const existing = this.storage.getItem(SAVE_KEY);
            if (existing && mergeChapter) {
                const latest = parseSave(existing, this.developmentUnlocked);
                this.save.guaira = mergeGuairaChapterProgress(latest.guaira, this.save.guaira, this.developmentUnlocked);
                if (latest.legacySerraAccess) this.save.legacySerraAccess = true;
            }
            this.applyDevelopmentAccess();
            this.storage.setItem(SAVE_KEY, JSON.stringify(this.save));
            this.warning = '';
            return true;
        }
        catch {
            this.warning = 'Progresso nesta sessão. Armazenamento indisponível.';
            return false;
        }
    }
    /** Chapter writes merge with the latest campaign state, never overwrite it from a stale page. */
    updateGuaira(next: GuairaChapterProgress): boolean {
        if (this.protected) return false;
        try {
            const raw = this.storage?.getItem(SAVE_KEY);
            if (raw) this.save = parseSave(raw, this.developmentUnlocked);
        } catch {
            this.warning = 'Não foi possível atualizar o progresso. Exporte uma cópia antes de substituir.';
            this.protected = true; return false;
        }
        this.save.guaira = mergeGuairaChapterProgress(this.save.guaira, next, this.developmentUnlocked);
        this.applyDevelopmentAccess();
        return this.persist();
    }
    /** Import replaces progress only after the browser has saved the complete replacement. */
    import(raw: string): boolean {
        const next = parseSave(raw, this.developmentUnlocked);
        try {
            if (!this.storage) throw Error('Storage unavailable');
            this.storage.setItem(SAVE_KEY, JSON.stringify(next));
        } catch {
            this.warning = 'Importação não salva. Progresso anterior mantido.';
            return false;
        }
        this.save = next;
        this.applyDevelopmentAccess();
        this.protected = false;
        this.warning = '';
        return true;
    }
    /** First-time guidance survives retries, map returns and browser reloads. */
    markSeen(id: string): boolean {
        if (this.save.seen.includes(id))
            return false;
        this.save.seen.push(id);
        this.persist();
        return true;
    }
    collect(id: string): boolean { if (this.save.seals.includes(id))
        return false; this.save.seals.push(id); this.persist(); return true; }
}
export function validateStage(stage: AdventureStage): string[] {
    const errors: string[] = [];
    const solidAt = (x: number, y: number) => isSolidTile(stage.level.tiles[Math.floor(y / TILE_SIZE) - (stage.level.originY ?? 0)]
        ?.[Math.floor(x / TILE_SIZE) - (stage.level.originX ?? 0)]);
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
        const carrier = ['platform', 'lift', 'swing', 'support'].includes(m.kind);
        if (carrier) {
            const controlled = m.kind === 'support' || m.kind === 'lift' && (m.gated || stage.mechanisms.some(s => s.link === m.id));
            if (controlled) {
                if (m.to && ![m.to.x, m.to.y].every(Number.isFinite)) errors.push(`Destino deve ter coordenadas finitas: ${m.id}`);
                if (m.motion) errors.push(`Perfil automático não se aplica a equipamento controlado: ${m.id}`);
            } else errors.push(...carrierMotionErrors(m, stage.world === 4 ? 80 : 90).map(e => `${e}: ${m.id}`));
            if ((m.kind === 'lift' || m.kind === 'support') && m.to && m.to.x !== m.x)
                errors.push(`Guia vertical exige destino X igual à origem; use plataforma para trilho inclinado: ${m.id}`);
            if (m.kind === 'support' && m.to && m.to.y < m.y)
                errors.push(`Suporte de descida exige destino abaixo da origem; use elevador para subir: ${m.id}`);
            if (m.mounts) {
                if (!Array.isArray(m.mounts) || m.mounts.length !== 2 || m.mounts.some(mount => !mount
                    || ![mount.x, mount.y].every(Number.isFinite) || !['ground', 'wall'].includes(mount.kind)))
                    errors.push(`Apoios precisam de dois pontos fixos de solo ou parede: ${m.id}`);
                else for (const [index, mount] of m.mounts.entries()) {
                    // Match the actual 12 px foot / 6×14 px wall plate. Moving an
                    // assembly never manufactures terrain beneath its anchors.
                    const supported = mount.kind === 'ground'
                        ? [mount.x - 6, mount.x, mount.x + 5].every(x => solidAt(x, mount.y + 1) && !solidAt(x, mount.y - 1))
                        : [mount.x - 3, mount.x + 2].every(x => [mount.y - 7, mount.y + 6].every(y => solidAt(x, y)));
                    if (!supported) errors.push(`Apoio ${index + 1} sem base sólida; reposicione o apoio no terreno: ${m.id}`);
                }
            }
        }
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
