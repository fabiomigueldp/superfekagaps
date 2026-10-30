import { readFile } from 'node:fs/promises';

/** Node logic fixtures do not apply styles; browser tests and Vite load real CSS. */
export async function load(url, context, nextLoad) {
    if (url.startsWith('file:') && new URL(url).pathname.endsWith('.css')) {
        // Still require a readable local file. Only side-effect imports are supported.
        await readFile(new URL(url));
        return { format: 'module', source: 'export {};', shortCircuit: true };
    }
    return nextLoad(url, context);
}
