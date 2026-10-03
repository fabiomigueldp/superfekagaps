import { parseSave } from './progress';

export type ProgressImportResult = 'imported' | 'unreadable' | 'invalid' | 'storage-unavailable' | 'cancelled';

/** Separate file access, validation and durable commit; stale chooser reads never write. */
export async function importProgressFile(
    file: { text(): Promise<string> },
    store: { import(raw: string): boolean },
    isActive: () => boolean = () => true,
): Promise<ProgressImportResult> {
    let raw: string;
    try { raw = await file.text(); }
    catch { return isActive() ? 'unreadable' : 'cancelled'; }
    if (!isActive()) return 'cancelled';
    try { parseSave(raw); }
    catch { return 'invalid'; }
    try { return store.import(raw) ? 'imported' : 'storage-unavailable'; }
    catch { return 'storage-unavailable'; }
}

export function progressImportMessage(result: Exclude<ProgressImportResult, 'cancelled'>): string {
    switch (result) {
        case 'imported': return 'Progresso importado.';
        case 'unreadable': return 'Falha ao ler. Selecione de novo.';
        case 'invalid': return 'Save inválido ou incompatível.';
        case 'storage-unavailable': return 'Falha ao salvar. Progresso mantido.';
    }
}
