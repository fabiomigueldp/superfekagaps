/** Controlled media-query evaluation; event behavior follows MediaQueryList.
 * This does not parse CSS or infer pointer capabilities from reduced motion. */
const serialize = (query: string) => query.trim().replace(/\s+/g, ' ').replace(/\s*:\s*/g, ': ');

export class TestMediaQueryListEvent extends Event {
    constructor(private readonly query: string, private readonly value: boolean) { super('change'); }
    get media() { return this.query; }
    get matches() { return this.value; }
}

type Listener = EventListenerOrEventListenerObject;
interface Registration { type: string; callback: Listener; capture: boolean; wrapped: EventListener; releaseAbort(): void; }

class QueryList extends EventTarget {
    readonly listeners: Registration[] = [];
    private handler: EventListener | null = null;
    private readonly changed: EventListener = event => this.handler?.call(this, event);
    constructor(private readonly query: string, private value: boolean) { super(); }
    get media() { return this.query; }
    get matches() { return this.value; }
    get onchange() { return this.handler; }
    set onchange(callback: EventListener | null) {
        if (callback && !this.handler) QueryList.prototype.addEventListener.call(this, 'change', this.changed);
        if (!callback && this.handler) QueryList.prototype.removeEventListener.call(this, 'change', this.changed);
        this.handler = callback;
    }
    override addEventListener(type: string, callback: Listener | null, options?: boolean | AddEventListenerOptions) {
        const config = typeof options === 'boolean' ? { capture: options } : options ?? {}, capture = !!config.capture;
        if (!callback || config.signal?.aborted || this.listeners.some(item => item.type === type && item.callback === callback && item.capture === capture)) return;
        const remove = () => QueryList.prototype.removeEventListener.call(this, type, callback, { capture });
        const registration: Registration = { type, callback, capture,
            wrapped: event => {
                if (config.once) remove();
                if (typeof callback === 'function') callback.call(this, event); else callback.handleEvent(event);
            },
            releaseAbort: () => config.signal?.removeEventListener('abort', remove),
        };
        this.listeners.push(registration);
        super.addEventListener(type, registration.wrapped, { capture, passive: config.passive });
        config.signal?.addEventListener('abort', remove, { once: true });
    }
    override removeEventListener(type: string, callback: Listener | null, options?: boolean | EventListenerOptions) {
        const capture = typeof options === 'boolean' ? options : !!options?.capture;
        const index = this.listeners.findIndex(item => item.type === type && item.callback === callback && item.capture === capture);
        if (index < 0) return;
        const [registration] = this.listeners.splice(index, 1);
        super.removeEventListener(type, registration.wrapped, { capture }); registration.releaseAbort();
    }
    addListener(callback: EventListener | null) { QueryList.prototype.addEventListener.call(this, 'change', callback); }
    removeListener(callback: EventListener | null) { QueryList.prototype.removeEventListener.call(this, 'change', callback); }
    setValue(matches: boolean) { const changed = this.value !== matches; this.value = matches; return changed; }
    notify() { this.dispatchEvent(new TestMediaQueryListEvent(this.media, this.matches)); }
    dispose() {
        for (const { type, callback, capture } of [...this.listeners]) QueryList.prototype.removeEventListener.call(this, type, callback, { capture });
        this.handler = null;
    }
}

export function createMediaQueryHarness(initial: Record<string, boolean> = {}, legacy = false) {
    const values = new Map(Object.entries(initial).map(([query, matches]) => [serialize(query), matches]));
    const lists: QueryList[] = []; let disposed = false;
    const matching = (query: string) => lists.filter(list => list.media === serialize(query));
    const set = (query: string, matches: boolean, notify = true) => {
        if (disposed) return;
        values.set(serialize(query), matches);
        // All lists expose the new value before the first change callback runs.
        const changed = matching(query).filter(list => list.setValue(matches));
        if (notify) for (const list of changed) list.notify();
    };
    const matchMedia = (query: string) => {
        if (disposed) throw Error('Media-query harness disposed');
        const media = serialize(query), list = new QueryList(media, values.get(media) ?? false);
        if (legacy) for (const method of ['addEventListener', 'removeEventListener'])
            Object.defineProperty(list, method, { value: undefined });
        lists.push(list); return list;
    };
    return { matchMedia, set,
        listenerCount: (query?: string) => (query ? matching(query) : lists).reduce((sum, list) => sum + list.listeners.length, 0),
        /** Test control compatible with older fixtures that set state then emit change explicitly. */
        control(query: string) {
            return {
                get matches() { return values.get(serialize(query)) ?? false; },
                set matches(matches: boolean) { set(query, matches, false); },
                get listeners() { return matching(query).flatMap(list => list.listeners); },
                dispatch(type: string, fields: { matches?: boolean } = {}) {
                    if (type !== 'change') throw Error(`Unsupported media event: ${type}`);
                    if (disposed) return;
                    if (fields.matches !== undefined) set(query, fields.matches, false);
                    for (const list of matching(query)) list.notify();
                },
            };
        },
        dispose() { disposed = true; for (const list of lists) list.dispose(); lists.length = 0; },
    };
}
