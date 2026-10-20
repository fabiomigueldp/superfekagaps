/** Small owner for listeners and resources whose lifetime is one mounted scene. */
export class DisposalScope {
    private closed = false;
    private readonly cleanups = new Set<() => void>();

    get isDisposed(): boolean { return this.closed; }

    /** Runs immediately when registered after disposal; each cleanup runs at most once. */
    add(cleanup: () => void): () => void {
        let active = true;
        const release = () => {
            if (!active) return;
            active = false; this.cleanups.delete(release); cleanup();
        };
        if (this.closed) release(); else this.cleanups.add(release);
        return release;
    }

    listen<K extends keyof WindowEventMap>(target: Window, type: K, listener: (event: WindowEventMap[K]) => void, options?: boolean | AddEventListenerOptions): () => void;
    listen<K extends keyof DocumentEventMap>(target: Document, type: K, listener: (event: DocumentEventMap[K]) => void, options?: boolean | AddEventListenerOptions): () => void;
    listen<K extends keyof HTMLElementEventMap>(target: HTMLElement, type: K, listener: (event: HTMLElementEventMap[K]) => void, options?: boolean | AddEventListenerOptions): () => void;
    listen(target: EventTarget, type: string, listener: EventListener, options?: boolean | AddEventListenerOptions): () => void;
    listen(target: EventTarget, type: string, listener: (event: any) => void, options?: boolean | AddEventListenerOptions): () => void {
        if (this.closed) return () => {};
        const guarded: EventListener = event => { if (!this.closed) listener(event); };
        target.addEventListener(type, guarded, options);
        const capture = typeof options === 'boolean' ? options : options?.capture ?? false;
        return this.add(() => target.removeEventListener(type, guarded, capture));
    }

    dispose(): void {
        if (this.closed) return;
        this.closed = true;
        // A failed device cleanup must not strand unrelated listeners/resources.
        for (const release of [...this.cleanups].reverse()) {
            try { release(); } catch (error) { console.warn('Scene cleanup failed', error); }
        }
    }
}
