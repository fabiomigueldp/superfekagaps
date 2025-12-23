import { LevelData } from '../types';

/**
 * Manages access to the local file system for saving levels directly.
 * Uses the File System Access API (Chrome/Edge only).
 */
export class FileSystemManager {
    private dirHandle: FileSystemDirectoryHandle | null = null;

    constructor() {
        // Check support
        if (!('showDirectoryPicker' in window)) {
            console.warn('FileSystem Access API not supported in this browser.');
        }
    }

    /**
     * Prompts user to select the 'src/data/levels' folder.
     */
    async mount(): Promise<boolean> {
        try {
            this.dirHandle = await window.showDirectoryPicker({
                id: 'fekagaps-levels',
                mode: 'readwrite',
                startIn: 'documents'
            });
            console.log('Mounted:', this.dirHandle.name);
            return true;
        } catch (e) {
            console.error('Failed to mount directory:', e);
            return false;
        }
    }

    get isMounted(): boolean {
        return this.dirHandle !== null;
    }

    /**
     * Lists all .ts files in the directory
     */
    async listLevels(): Promise<string[]> {
        if (!this.dirHandle) throw new Error('Not mounted');
        const files: string[] = [];
        for await (const entry of this.dirHandle.values()) {
            if (entry.kind === 'file' && entry.name.endsWith('.ts') && entry.name !== 'index.ts') {
                files.push(entry.name);
            }
        }
        return files.sort();
    }

    async readFile(filename: string): Promise<string> {
        if (!this.dirHandle) throw new Error('Not mounted');
        try {
            const fileHandle = await this.dirHandle.getFileHandle(filename);
            const file = await fileHandle.getFile();
            return await file.text();
        } catch (e) {
            console.error('Error reading file:', e);
            throw e;
        }
    }

    /**
     * Saves the level data to a specific file.
       * Serializes the LevelData object back into a valid TypeScript file string.
       */
    async saveLevel(filename: string, data: LevelData): Promise<void> {
        if (!this.dirHandle) throw new Error('Not mounted');

        // Generate TypeScript content
        const fileContent = this.serializeLevelToTS(data);

        try {
            const fileHandle = await this.dirHandle.getFileHandle(filename, { create: true });
            const writable = await fileHandle.createWritable();
            await writable.write(fileContent);
            await writable.close();
            console.log(`Saved ${filename} successfully.`);
        } catch (e) {
            console.error(`Error saving ${filename}:`, e);
            throw e;
        }
    }

    /**
     * Converts the LevelData object into a formatted TypeScript file string.
     * We need to recreate the imports and correct syntax.
     */
    private serializeLevelToTS(data: LevelData): string {
        // Custom replacer to handle potential circular refs or formatting if needed.
        // However, JSON.stringify doesn't handle Enum names (it outputs raw values/strings).
        // Luckily, our game uses string enums for most things, or numbers for Tiles.

        // We want the output to be readable, so we format the 'tiles' array specially
        // to look like a grid in the text file.

        const clone = { ...data };
        const tiles = clone.tiles;
        // Remove tiles from clone temporarily to stringify the rest
        (clone as any).tiles = '___TILES_PLACEHOLDER___';

        let json = JSON.stringify(clone, null, 2);

        // Fix imports
        let output = `import { LevelData, EnemyType } from '../../types';\n\n`;
        output += `export const DATA: LevelData = `;

        // Restore tiles with nice formatting
        const tilesString = '[\n' + tiles.map(row => '    [' + row.join(', ') + ']').join(',\n') + '\n  ]';

        json = json.replace('"___TILES_PLACEHOLDER___"', tilesString);

        // Cleanup JSON keys to look more like standard TS object if desired, 
        // but JSON format is valid TS (valid JS object).
        // We should fix specific Enums if they are numbers acting as strings, 
        // but our EnemyType is string-based, so JSON.stringify keeps them as "MINION".
        // We can replace "MINION" with EnemyType.MINION if we want perfect code style,
        // but string literals work fine.

        output += json + ';\n';

        return output;
    }
}
