import { parseGuairaMetadata, type GuairaMetadata } from './GuairaMapModel';

export interface GuairaSceneAsset<T> { metadata: GuairaMetadata; image: T }
/** Explicit errors settle immediately; slow connections remain loading with direct entry links. */
export async function loadGuairaScene<T>(
    metadata: (signal: AbortSignal) => Promise<unknown>, image: (signal: AbortSignal) => Promise<T>,
    parentSignal: AbortSignal,
): Promise<GuairaSceneAsset<T>> {
    const abort = new AbortController();
    let onParentAbort: () => void = () => {};
    try {
        const canceled = new Promise<never>((_, reject) => {
            onParentAbort = () => { abort.abort(); reject(new Error('Scene closed')); };
            parentSignal.addEventListener('abort', onParentAbort, { once: true });
            if (parentSignal.aborted) onParentAbort();
        });
        if (parentSignal.aborted) return await canceled;
        // Validate the JSON independently: a broken export must not wait for image.decode().
        const validMetadata = metadata(abort.signal).then(raw => {
            const parsed = parseGuairaMetadata(raw);
            if (!parsed) throw new Error('Invalid Guaíra metadata');
            return parsed;
        });
        const loaded = Promise.all([validMetadata, image(abort.signal)]).then(([parsed, art]) => ({ metadata: parsed, image: art }));
        const result = await Promise.race([loaded, canceled]);
        if (parentSignal.aborted) throw new Error('Scene closed');
        return result;
    } finally {
        parentSignal.removeEventListener('abort', onParentAbort); abort.abort();
    }
}
