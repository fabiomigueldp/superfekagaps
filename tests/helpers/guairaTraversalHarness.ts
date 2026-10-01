import type { TestContext } from 'node:test';
import { GuairaTraversal } from '../../src/adventure/experimental/guaira/GuairaTraversal';
import { Element, guairaBrowser } from './guairaLabHarness';

/** Reuse browser boundaries; Input, Player, WorldObjects and Renderer stay real. */
export function guairaTraversalBrowser(t: Pick<TestContext, 'after'>, options: { touch?: boolean; reducedMotion?: boolean } = {}) {
    const h = guairaBrowser(t, options);
    const boss = new Element(); boss.id = 'traversal-boss'; boss.tagName = 'A'; boss.hidden = true;
    const get = h.document.getElementById;
    h.document.getElementById = (id: string) => id === boss.id ? boss : get(id);
    const create = () => new GuairaTraversal(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    let held = new Set<string>();
    function keys(nextKeys: string[]) {
        const next = new Set(nextKeys);
        for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        held = next;
    }
    function run(game: GuairaTraversal, count: number, nextKeys: string[] = []) {
        keys(nextKeys); for (let i = 0; i < count; i++) game.update(1000 / 60);
    }
    return { ...h, boss, create, keys, run };
}
