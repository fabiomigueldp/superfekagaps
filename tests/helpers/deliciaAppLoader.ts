import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { runInThisContext } from 'node:vm';
import ts from 'typescript';

/** Load the real app after its DOM exists, including window-owned module listeners. */
export function loadDeliciaApp() {
    const url = new URL('../../src/adventure/delicia/DeliciaApp.ts', import.meta.url), require = createRequire(url);
    const sourceRoot = new URL('../../src/', import.meta.url).pathname;
    const clearModules = () => {
        for (const path of Object.keys(require.cache)) if (path.startsWith(sourceRoot)) delete require.cache[path];
    };
    clearModules();
    const css = require.extensions['.css']; require.extensions['.css'] = () => {};
    const dispose = () => {
        if (css) require.extensions['.css'] = css; else delete require.extensions['.css'];
        clearModules();
    };
    try {
        // Vite's development flag is the only source substitution; handlers stay real.
        const source = readFileSync(url, 'utf8').replace('import.meta', '({env:{DEV:false}})');
        const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 } }).outputText;
        const module = { exports: {} as typeof import('../../src/adventure/delicia/DeliciaApp') };
        runInThisContext(`(function(require,module,exports){${compiled}\n})`, { filename: url.pathname })(require, module, module.exports);
        return { ...module.exports, require, dispose };
    } catch (error) { dispose(); throw error; }
}
