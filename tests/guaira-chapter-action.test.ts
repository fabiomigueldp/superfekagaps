import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { GuairaChapterAction } from '../src/adventure/experimental/guaira/chapter/GuairaChapterAction';
import { WORKSHOP_UI } from '../src/adventure/WorldWorkshopUI';
import { labActionSize } from '../src/adventure/experimental/JuiceLabToolbar';

function browser(t: TestContext, canvasAvailable = true) {
    const colors: string[] = [];
    const context = { fillStyle: '', imageSmoothingEnabled: true, setTransform() {}, clearRect() {},
        fillRect() { colors.push(this.fillStyle); } };
    class Element {
        className = ''; textContent = ''; title = ''; hidden = false; width = 0; height = 0;
        readonly children: Element[] = []; readonly attributes = new Map<string, string>();
        append(...children: Element[]) { this.children.push(...children); }
        setAttribute(name: string, value: string) { this.attributes.set(name, value); }
        getContext() { return canvasAvailable ? context : null; }
    }
    const old = Object.getOwnPropertyDescriptor(globalThis, 'document');
    Object.defineProperty(globalThis, 'document', { configurable: true, value: { createElement: () => new Element() } });
    t.after(() => { if (old) Object.defineProperty(globalThis, 'document', old); else Reflect.deleteProperty(globalThis, 'document'); });
    return { control: new Element(), colors, context };
}

test('chapter plates reuse Oficina colors while retaining native control names and 44px raster height', t => {
    const h = browser(t), action = new GuairaChapterAction(h.control as unknown as HTMLElement);
    action.setLabel('RECOMEÇAR', 'Recomeçar Travessia da Vala Seca nesta tentativa');
    const [canvas, text] = h.control.children;
    assert.equal(canvas.width, labActionSize('RECOMEÇAR').width * 2); assert.equal(canvas.height, 44);
    for (const color of [WORKSHOP_UI.ink, WORKSHOP_UI.panel, WORKSHOP_UI.brass, WORKSHOP_UI.paper]) assert.ok(h.colors.includes(color), color);
    assert.equal(canvas.attributes.get('aria-hidden'), 'true');
    assert.equal(text.textContent, 'Recomeçar Travessia da Vala Seca nesta tentativa');
    assert.equal(h.control.attributes.get('aria-label'), text.textContent); assert.equal(h.context.imageSmoothingEnabled, false);
    const painted = h.colors.length;
    action.setLabel('RECOMEÇAR', 'Recomeçar a tentativa opcional');
    assert.equal(h.colors.length, painted, 'Accessible copy changes do not repaint an unchanged label');
    assert.equal(h.control.attributes.get('aria-label'), 'Recomeçar a tentativa opcional');
});

test('chapter identity is bitmap gold without pretending to be an interactive plate', t => {
    const h = browser(t), name = new GuairaChapterAction(h.control as unknown as HTMLElement, false, true);
    name.setLabel('GUAÍRA', 'Guaíra');
    assert.ok(h.colors.length > 0); assert.deepEqual([...new Set(h.colors)], [WORKSHOP_UI.gold]);
    assert.equal(h.control.attributes.get('aria-label'), 'Guaíra');
});

test('chapter action remains readable without a Canvas context', t => {
    const h = browser(t, false), action = new GuairaChapterAction(h.control as unknown as HTMLElement, true);
    action.setLabel('ENTRAR', 'Entrar: Travessia da Vala Seca');
    assert.equal(h.control.children[0].hidden, true); assert.equal(h.control.children[1].className, '');
    assert.equal(h.control.children[1].textContent, 'Entrar: Travessia da Vala Seca');
});
