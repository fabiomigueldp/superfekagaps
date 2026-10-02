import type { TestContext } from 'node:test';
import { GuairaGallery } from '../../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { guairaBrowser } from './guairaLabHarness';

/** Browser boundaries only. Every route step drives native Input through events. */
export function guairaGalleryBrowser(t: Pick<TestContext, 'after'>, options: { touch?: boolean; reducedMotion?: boolean } = {}) {
    const h = guairaBrowser(t, options);
    const create = () => new GuairaGallery(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
    let held = new Set<string>();
    function keys(nextKeys: string[]) {
        const next = new Set(nextKeys);
        if (options.touch) {
            const positions: Record<string, number> = { ArrowLeft: .08, ArrowRight: .22, ArrowDown: .5, ShiftLeft: .78, Space: .93 };
            const touches = [...next].map(key => ({ identifier: Object.keys(positions).indexOf(key) + 1, target: h.canvas, clientX: positions[key] * 640, clientY: 330 }));
            h.canvas.dispatch(touches.length ? 'touchstart' : 'touchend', { touches });
        } else {
            for (const code of held) if (!next.has(code)) h.window.dispatch('keyup', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
            for (const code of next) if (!held.has(code)) h.window.dispatch('keydown', { code, key: code === 'Space' ? ' ' : code, target: h.canvas });
        }
        held = next;
    }
    function run(game: GuairaGallery, count: number, nextKeys: string[] = []) {
        keys(nextKeys); for (let i = 0; i < count; i++) game.update(1000 / 60);
    }
    return { ...h, create, keys, run };
}
