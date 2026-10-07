/** Temporary site-build switch. It is deliberately absent from saves and URLs. */
declare const __FEKA_DEVELOPMENT_UNLOCKED_SAVE__: boolean;
export function siteDevelopmentUnlockEnabled(): boolean {
    return typeof __FEKA_DEVELOPMENT_UNLOCKED_SAVE__ !== 'undefined' && __FEKA_DEVELOPMENT_UNLOCKED_SAVE__;
}

export const developmentSaveKey = (key: string): string => `${key}:development-unlocked-v1`;
type SaveStorage = Pick<Storage, 'getItem' | 'setItem'>;

/** Copy-on-read, write-only-to-development profile. Never overwrite the real save,
 * even during import, quota failure, chapter merges, or a later flag-off build. */
export function developmentProfileStorage(storage: SaveStorage | null, key: string, enabled: boolean): SaveStorage | null {
    if (!enabled || !storage) return storage;
    const profileKey = developmentSaveKey(key);
    const check = (requested: string) => { if (requested !== key) throw new Error('Wrong development save namespace'); };
    return {
        getItem(requested) { check(requested); return storage.getItem(profileKey) ?? storage.getItem(key); },
        setItem(requested, value) { check(requested); storage.setItem(profileKey, value); },
    };
}

// Access is runtime-only; copying/exporting JSON never fabricates earned results.
const developmentAccess = new WeakSet<object>();
export function withDevelopmentAccess<T extends object>(value: T, enabled: boolean): T {
    if (enabled) developmentAccess.add(value);
    return value;
}
export const hasDevelopmentAccess = (value: object): boolean => developmentAccess.has(value);
