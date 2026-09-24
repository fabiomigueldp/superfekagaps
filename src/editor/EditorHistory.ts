/** Bounded document history. One entry per gesture, never one per pointer move. */
export class EditorHistory<T> {
    private entries: string[] = [];
    private index = -1;
    private saved = '';

    constructor(private readonly limit = 50) {}

    reset(value: T): void {
        this.entries = [JSON.stringify(value)];
        this.index = 0;
        this.saved = this.entries[0];
    }

    record(value: T): boolean {
        const snapshot = JSON.stringify(value);
        if (snapshot === this.entries[this.index]) return false;
        this.entries.splice(this.index + 1);
        this.entries.push(snapshot);
        if (this.entries.length > this.limit) this.entries.shift();
        this.index = this.entries.length - 1;
        return true;
    }

    undo(): T | null {
        return this.canUndo ? JSON.parse(this.entries[--this.index]) as T : null;
    }

    redo(): T | null {
        return this.canRedo ? JSON.parse(this.entries[++this.index]) as T : null;
    }

    markSaved(value: T): void { this.saved = JSON.stringify(value); }
    isDirty(value: T): boolean { return JSON.stringify(value) !== this.saved; }
    get canUndo(): boolean { return this.index > 0; }
    get canRedo(): boolean { return this.index < this.entries.length - 1; }
}
