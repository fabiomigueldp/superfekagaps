import type { LevelData } from '../types';
import { parseLevelFromText, serializeLevelToTS } from './levelSerialization';

/** Local level storage through the File System Access API (Chrome/Edge). */
export class FileSystemManager {
    private dirHandle: FileSystemDirectoryHandle | null = null;
    private readonly loadedFiles = new Map<string, string>();
    private saving = false;

    get isSupported(): boolean {
        return typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';
    }

    /** Canceling the picker keeps the previously mounted directory intact. */
    async mount(): Promise<boolean> {
        if (!this.isSupported) throw new Error('Este navegador não permite abrir pastas locais. Use Chrome ou Edge, ou importe um arquivo.');
        try {
            const directory = await window.showDirectoryPicker({ id: 'fekagaps-levels', mode: 'readwrite', startIn: 'documents' });
            this.dirHandle = directory;
            this.loadedFiles.clear();
            return true;
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') return false;
            throw error;
        }
    }

    get isMounted(): boolean {
        return this.dirHandle !== null;
    }

    private directory(): FileSystemDirectoryHandle {
        if (!this.dirHandle) throw new Error('Abra a pasta src/data/levels antes de salvar.');
        return this.dirHandle;
    }

    private checkFilename(filename: string): void {
        if (!filename || /[\\/\u0000]/.test(filename) || !filename.endsWith('.ts') || filename.endsWith('.d.ts') || filename.toLowerCase() === 'index.ts') {
            throw new Error('Escolha um arquivo de nível .ts; index.ts e caminhos de outras pastas não são permitidos.');
        }
    }

    async listLevels(): Promise<string[]> {
        const files: string[] = [];
        for await (const entry of this.directory().values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && entry.name.toLowerCase() !== 'index.ts') files.push(entry.name);
        }
        return files.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    }

    private async readContent(filename: string): Promise<{ directory: FileSystemDirectoryHandle; content: string }> {
        this.checkFilename(filename);
        const directory = this.directory();
        const file = await (await directory.getFileHandle(filename)).getFile();
        const content = await file.text();
        return { directory, content };
    }

    async readFile(filename: string): Promise<string> {
        const { directory, content } = await this.readContent(filename);
        if (directory === this.dirHandle) this.loadedFiles.set(filename, content);
        return content;
    }

    async readLevel(filename: string): Promise<LevelData> {
        const { directory, content } = await this.readContent(filename);
        const data = parseLevelFromText(content);
        // A failed import must not authorize overwriting a newer, invalid file on disk.
        if (directory === this.dirHandle) this.loadedFiles.set(filename, content);
        return data;
    }

    async saveLevel(filename: string, data: LevelData): Promise<void> {
        this.checkFilename(filename);
        const directory = this.directory();
        if (this.saving) throw new Error('Aguarde o salvamento atual terminar.');
        // Validate before opening a writable stream, so invalid input cannot damage a file.
        const content = serializeLevelToTS(data);
        const previousContent = this.loadedFiles.get(filename);
        this.saving = true;
        let writable: FileSystemWritableFileStream | undefined;
        try {
            const handle = await directory.getFileHandle(filename, { create: previousContent === undefined });
            if (previousContent !== undefined && await (await handle.getFile()).text() !== previousContent) {
                throw new Error('Este arquivo foi alterado fora do editor. Exporte suas alterações antes de reabrir o arquivo.');
            }
            writable = await handle.createWritable();
            await writable.write(content);
            await writable.close();
            if (directory === this.dirHandle) this.loadedFiles.set(filename, content);
        } catch (error) {
            // The browser commits the temporary file only on close; abort a failed write.
            if (writable) {
                try { await writable.abort(); } catch { /* Preserve the original failure. */ }
            }
            throw error;
        } finally {
            this.saving = false;
        }
    }
}
