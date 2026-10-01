import type { TestContext } from 'node:test';
import { GuairaMayorLab } from '../../src/adventure/experimental/guaira/GuairaMayorLab';
import { guairaBrowser } from './guairaLabHarness';

export function guairaMayorBrowser(t: Pick<TestContext, 'after'>, options: { touch?: boolean; reducedMotion?: boolean } = {}) {
    const h = guairaBrowser(t, options);
    const create = () => new GuairaMayorLab(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    let held = new Set<string>();
    function keys(nextKeys: string[]) {
        const next = new Set(nextKeys);
        for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        held = next;
    }
    function run(game: GuairaMayorLab, count: number, nextKeys: string[] = []) {
        keys(nextKeys); for (let i = 0; i < count; i++) game.update(1000 / 60);
    }
    return { ...h, create, keys, run };
}
