import { copyFileSync, mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { basename, dirname, extname, join, relative, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import type { Plugin, ResolvedConfig } from 'vite';

// Exact reviewed files, not extension/directory globs. New assets ship by default.
// Sources and development galleries remain available under public/ and docs/.
export const REVIEW_ONLY_ASSETS = [
    'assets/branding/super-feka-gaps-remaster-cover-abismo.png',
    'assets/branding/super-feka-gaps-remaster-cover-classic.png',
    'assets/branding/super-feka-gaps-remaster-cover-vertical.png',
    'assets/branding/super-feka-gaps-remaster-cover.png',
    'assets/sprites/yasmin.png',
    ...['bielzao', 'calabrezzo', 'joaozao', 'mapa', 'mundo-1', 'mundo-2', 'mundo-3', 'mundo-4', 'mundo-5', 'mundo-6']
        .map(name => `assets/world/audio/${name}.wav`),
    ...['aqui_e_o_joao_namorado_da_yasmin_1.92s', 'eu_sou_o_namorado_dela_1.14s', 'para_de_encher_o_saco_0.96s',
        'porra_nenhuma_0.36s', 'sei_que_voce_quer_0.66s', 'voce_nao_vai_ter_0.66s']
        .map(name => `assets/audio/vo/joaozao/${name}.webm`),
] as const;
const excluded = new Set<string>(REVIEW_ONLY_ASSETS);
// Repository budget, not a hosting quota: about 4.6 MB of headroom after this audit.
export const BUILD_SIZE_LIMIT = 45_000_000;

function filesIn(directory: string, prefix = ''): string[] {
    return readdirSync(join(directory, prefix), { withFileTypes: true }).flatMap(entry => {
        const name = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isSymbolicLink()) throw new Error(`Unexpected asset symlink: ${name}`);
        return entry.isDirectory() ? filesIn(directory, name) : [name];
    }).sort();
}

export function copyPublishedAssets(publicDir: string, outDir: string) {
    const source = resolve(publicDir), destination = resolve(outDir);
    const overlaps = (a: string, b: string) => { const r = relative(a, b); return !r || (!r.startsWith('..') && !r.startsWith('/')); };
    if (overlaps(source, destination) || overlaps(destination, source)) throw new Error('Build output must be separate from public sources');
    let omittedBytes = 0, omittedFiles = 0;
    // Per-copy state: a later build may recreate or use a different output directory.
    const directories = new Set<string>();
    for (const name of filesIn(source)) {
        if (excluded.has(name)) { omittedBytes += statSync(join(source, name)).size; omittedFiles++; continue; }
        const target = join(destination, name);
        const directory = dirname(target);
        if (!directories.has(directory)) {
            mkdirSync(directory, { recursive: true });
            directories.add(directory);
        }
        copyFileSync(join(source, name), target);
    }
    return { omittedFiles, omittedBytes };
}

export function inspectBuildOutput(outDir: string, maxBytes = BUILD_SIZE_LIMIT) {
    const files = filesIn(outDir);
    if (!files.includes('index.html')) throw new Error('Missing built index.html');
    for (const name of files) {
        if (excluded.has(name)) throw new Error(`Review-only asset leaked into output: ${name}`);
        // These developer galleries construct asset URLs dynamically. Publishing them
        // requires revisiting this policy and their assets together.
        if (name.startsWith('docs/')) throw new Error(`Documentation output requires a fresh asset audit: ${name}`);
        if (!['.html', '.js', '.css', '.json', '.webmanifest'].includes(extname(name))) continue;
        const text = readFileSync(join(outDir, name), 'utf8');
        for (const asset of REVIEW_ONLY_ASSETS) {
            if (text.includes(asset) || text.includes(basename(asset))) {
                throw new Error(`Output ${name} references excluded asset ${asset}`);
            }
        }
    }
    const entries = files.map(path => ({ path, bytes: statSync(join(outDir, path)).size }));
    const bytes = entries.reduce((sum, file) => sum + file.bytes, 0);
    if (bytes > maxBytes) throw new Error(`Build output is ${bytes} bytes, above the ${maxBytes}-byte repository budget`);
    const extensions = new Map<string, { extension: string; files: number; bytes: number }>();
    for (const file of entries) {
        const extension = extname(file.path).toLowerCase();
        const group = extensions.get(extension) ?? { extension, files: 0, bytes: 0 };
        group.files++;
        group.bytes += file.bytes;
        extensions.set(extension, group);
    }
    return {
        files: files.length, bytes, maxBytes, headroomBytes: maxBytes - bytes,
        byExtension: [...extensions.values()].sort((a, b) => b.bytes - a.bytes || a.extension.localeCompare(b.extension)),
        largestFiles: [...entries].sort((a, b) => b.bytes - a.bytes).slice(0, 10),
    };
}

export function publishedAssetsPlugin(): Plugin {
    let config: ResolvedConfig;
    return {
        name: 'feka-published-assets',
        apply: 'build',
        configResolved(resolved) { config = resolved; },
        writeBundle() {
            if (!config.publicDir) throw new Error('The asset policy requires the project public directory');
            const outDir = resolve(config.root, config.build.outDir);
            const started = performance.now();
            const omitted = copyPublishedAssets(config.publicDir, outDir);
            const copied = performance.now();
            const size = inspectBuildOutput(outDir);
            const inspected = performance.now();
            console.log(`[feka-output] ${size.files} files, ${size.bytes} bytes; omitted ${omitted.omittedFiles} review files (${omitted.omittedBytes} bytes)`);
            if (process.env.FEKA_BUILD_PROFILE === '1') {
                console.log(`[feka-output-profile] ${JSON.stringify({
                    copyMs: Number((copied - started).toFixed(3)),
                    inspectMs: Number((inspected - copied).toFixed(3)),
                    headroomBytes: size.headroomBytes,
                })}`);
            }
        },
    };
}
