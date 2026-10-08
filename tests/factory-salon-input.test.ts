import assert from 'node:assert/strict';
import test, { type TestContext } from 'node:test';
import { Input } from '../src/engine/Input';

/** Narrow DOM boundary: selectors match tags/attributes and walk actual parents. */
class Element extends EventTarget {
    id = '';
    parentElement: Element | null = null;
    readonly children: Element[] = [];
    readonly attributes = new Map<string, string>();
    constructor(readonly tagName: string) { super(); }
    append(...children: Element[]) {
        for (const child of children) { child.parentElement = this; this.children.push(child); }
    }
    matches(selector: string): boolean {
        switch (selector) {
            case 'dialog[open]': return this.tagName === 'DIALOG' && this.attributes.has('open');
            case '[contenteditable]:not([contenteditable="false"])':
                return this.attributes.has('contenteditable') && this.attributes.get('contenteditable') !== 'false';
            case 'a[href]': return this.tagName === 'A' && this.attributes.has('href');
            case '.world-map': return this.attributes.get('class')?.split(/\s+/).includes('world-map') ?? false;
            case '.world-chapter-host': return this.attributes.get('class')?.split(/\s+/).includes('world-chapter-host') ?? false;
            case 'input': case 'textarea': case 'select': case 'button': case 'summary':
                return this.tagName === selector.toUpperCase();
            default: assert.fail(`Unimplemented selector: ${selector}`);
        }
    }
    closest(selector: string): Element | null {
        for (let node: Element | null = this; node; node = node.parentElement)
            if (selector.split(',').some(part => node!.matches(part.trim()))) return node;
        return null;
    }
}

function browser(t: TestContext) {
    const body = new Element('BODY'), campaignCanvas = new Element('CANVAS');
    campaignCanvas.id = 'game-canvas'; campaignCanvas.attributes.set('contenteditable', 'true');
    body.append(campaignCanvas);
    const window = Object.assign(new EventTarget(), {
        requestAnimationFrame() { assert.fail('Both inputs have an available canvas'); },
        cancelAnimationFrame() {}
    });
    const document = Object.assign(new EventTarget(), { hidden: false,
        getElementById(id: string): Element | null {
            function find(node: Element): Element | null {
                if (node.id === id) return node;
                for (const child of node.children) { const match = find(child); if (match) return match; }
                return null;
            }
            return find(body);
        }
    });
    const original = new Map<string, PropertyDescriptor | undefined>();
    for (const [name, value] of Object.entries({ window, document, HTMLElement: Element })) {
        original.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
        Object.defineProperty(globalThis, name, { configurable: true, value });
    }
    const inputs: Input[] = [];
    t.after(() => {
        for (const input of inputs) input.dispose();
        for (const [name, descriptor] of original) {
            if (descriptor) Object.defineProperty(globalThis, name, descriptor);
            else Reflect.deleteProperty(globalThis, name);
        }
    });
    const createInput = (canvas?: Element) => {
        const input = new Input(canvas as unknown as HTMLCanvasElement | undefined);
        inputs.push(input); return input;
    };
    const campaign = createInput(campaignCanvas);
    const dialog = new Element('DIALOG'), nav = new Element('NAV'), canvas = new Element('CANVAS');
    dialog.attributes.set('class', 'factory-salon');
    canvas.id = 'game-canvas'; canvas.attributes.set('contenteditable', 'true');
    function open() {
        // Same ownership/ID swap as FactoryCampaign.enterSalon().
        campaign.reset(); campaignCanvas.id = 'factory-campaign-canvas';
        dialog.attributes.set('open', '');
        return createInput(canvas);
    }
    dialog.append(nav, canvas); body.append(dialog);
    function key(type: 'keydown' | 'keyup', code: string, target = canvas, options: Record<string, unknown> = {}) {
        const event = new Event(type, { cancelable: true });
        const values = { target, code, key: code === 'Space' ? ' ' : code.startsWith('Key') ? code.slice(3).toLowerCase() : code,
            repeat: false, ...options };
        for (const [name, value] of Object.entries(values)) Object.defineProperty(event, name, { value });
        window.dispatchEvent(event); return event;
    }
    return { body, campaignCanvas, campaign, dialog, nav, canvas, createInput, open, key };
}

function assertNeutral(input: Input, message: string) {
    input.update();
    assert.ok(Object.values(input.getState()).every(value => value === false), message);
}

test('embedded chapter canvas owns input while the world canvas is suspended', t => {
    const h = browser(t), chapter = h.open();
    h.dialog.attributes.delete('open'); h.dialog.attributes.set('class', 'world-chapter-host');
    h.key('keydown', 'ArrowRight'); h.key('keydown', 'Space'); chapter.update();
    assert.equal(chapter.getState().right, true); assert.equal(chapter.getState().jumpPressed, true);
    assertNeutral(h.campaign, 'The world must not retain chapter input');
    h.key('keyup', 'ArrowRight', h.nav); h.key('keyup', 'Space', h.nav);
    chapter.update(); assert.equal(chapter.getState().right, false); assert.equal(chapter.getState().jump, false);
});

test('owned editable salon canvas accepts movement, jump and pause through its open dialog ancestor', t => {
    const h = browser(t), salon = h.open();
    assert.equal(h.canvas.matches('dialog[open]'), false);
    assert.equal(h.canvas.closest('dialog[open]'), h.dialog, 'The dialog is a genuine ancestor, not the canvas itself');
    assert.equal(h.canvas.closest('button, a[href], summary'), null);
    assert.equal(h.canvas.closest('input, textarea, select, [contenteditable]:not([contenteditable="false"])'), h.canvas);
    for (const [code, action] of [['KeyD', 'right'], ['KeyA', 'left'], ['Space', 'jump'],
        ['ShiftLeft', 'run'], ['ArrowDown', 'down']] as const) {
        assert.equal(h.key('keydown', code).defaultPrevented, true, `${code} belongs to salon gameplay`);
        salon.update(); assert.equal(salon.getState()[action], true, `${action} reaches the active salon`);
        assertNeutral(h.campaign, 'The background campaign must not capture salon keys');
        h.key('keyup', code); salon.update(); assert.equal(salon.getState()[action], false);
    }
    for (const [code, consume] of [['Escape', () => salon.consumePause()], ['Enter', () => salon.consumeStart()],
        ['KeyM', () => salon.consumeMute()]] as const) {
        assert.equal(h.key('keydown', code).defaultPrevented, true);
        salon.update(); assert.equal(consume(), true); assert.equal(consume(), false);
        assertNeutral(h.campaign, 'Salon commands cannot queue on the suspended campaign');
        h.key('keyup', code);
    }
});

test('salon and Guaíra dialog controls keep Escape, activation and navigation native', t => {
    const h = browser(t), salon = h.open();
    const guairaDialog = new Element('DIALOG'); guairaDialog.attributes.set('open', ''); h.body.append(guairaDialog);
    for (const shell of [h.dialog, guairaDialog]) {
        const targets = [shell];
        for (const tag of ['BUTTON', 'A', 'SUMMARY', 'INPUT', 'TEXTAREA', 'SELECT', 'DIV']) {
            const control = new Element(tag), child = new Element('SPAN');
            if (tag === 'A') control.attributes.set('href', '#chapter');
            if (tag === 'DIV') control.attributes.set('contenteditable', 'true');
            shell.append(control); control.append(child); targets.push(control, child);
            assert.equal(child.closest('dialog[open]'), shell);
        }
        for (const target of targets) for (const code of ['Escape', 'Enter', 'Space', 'ArrowDown', 'ArrowLeft', 'KeyD', 'KeyM']) {
            assert.equal(h.key('keydown', code, target).defaultPrevented, false, `${target.tagName}/${code} stays native`);
            h.key('keyup', code, target);
        }
    }
    assertNeutral(salon, 'Dialog controls must not feed salon gameplay');
    assertNeutral(h.campaign, 'Dialog controls must not feed the campaign');
});

test('an unrelated canvas, even with the gameplay ID, cannot feed the salon or campaign from a dialog', t => {
    const h = browser(t), salon = h.open(), otherCanvas = new Element('CANVAS');
    otherCanvas.id = 'game-canvas'; otherCanvas.attributes.set('contenteditable', 'true');
    h.dialog.append(otherCanvas);
    for (const code of ['KeyD', 'Space', 'Escape']) {
        assert.equal(h.key('keydown', code, otherCanvas).defaultPrevented, false);
        h.key('keyup', code, otherCanvas);
    }
    assertNeutral(salon, 'Only the exact owned canvas is a gameplay exception');
    assertNeutral(h.campaign, 'A matching ID cannot opt another canvas into campaign input');
});

test('salon Escape remains a single command when the shell pauses or resumes and resets input', t => {
    const h = browser(t), salon = h.open();
    for (let toggle = 0; toggle < 2; toggle++) {
        assert.equal(h.key('keydown', 'Escape').defaultPrevented, true);
        // FactoryCampaign handles Escape during bubbling; pause/resume resets
        // the lab input before its next update. Consuming alone is not a reset.
        salon.consumePause(); salon.reset();
        salon.update(); assert.equal(salon.consumePause(), false, 'No second pause is left for the simulation');
        assert.equal(h.key('keydown', 'Escape', h.canvas, { repeat: true }).defaultPrevented, true);
        salon.update(); assert.equal(salon.consumePause(), false, 'Holding Escape cannot re-toggle');
        h.key('keyup', 'Escape');
        assertNeutral(h.campaign, 'The background campaign cannot queue or resume from salon Escape');
    }
});

test('keyup on dialog UI releases previously held campaign and salon keys', t => {
    const h = browser(t);
    h.key('keydown', 'KeyD', h.campaignCanvas); h.key('keydown', 'Space', h.campaignCanvas);
    h.campaign.update(); assert.equal(h.campaign.getState().right, true); assert.equal(h.campaign.getState().jump, true);
    const control = new Element('BUTTON'); h.dialog.append(control); h.dialog.attributes.set('open', '');
    h.key('keyup', 'KeyD', control); h.key('keyup', 'Space', control); h.campaign.update();
    assert.equal(h.campaign.getState().right, false); assert.equal(h.campaign.getState().jump, false);
    assert.equal(h.campaign.getState().jumpReleased, true);
    const salon = h.open();
    h.key('keydown', 'KeyD'); h.key('keydown', 'Space'); salon.update();
    assert.equal(salon.getState().right, true); assert.equal(salon.getState().jump, true);
    h.key('keyup', 'KeyD', control); h.key('keyup', 'Space', control); salon.update();
    assert.equal(salon.getState().right, false); assert.equal(salon.getState().jump, false);
    assert.equal(salon.getState().jumpReleased, true);
    salon.update(); assert.equal(salon.getState().jumpReleased, false);
});

test('closing and reopening the salon restores campaign input and creates no stale actions', t => {
    const h = browser(t);
    for (let visit = 0; visit < 2; visit++) {
        const salon = h.open();
        h.key('keydown', 'KeyD'); h.key('keydown', 'Space'); salon.update();
        assert.equal(salon.getState().right, true); assert.equal(salon.getState().jumpPressed, true);
        salon.dispose(); h.dialog.attributes.delete('open');
        h.campaignCanvas.id = 'game-canvas'; h.campaign.reset();
        h.key('keyup', 'KeyD', h.campaignCanvas); h.key('keyup', 'Space', h.campaignCanvas);
        assertNeutral(h.campaign, 'Leaving discards old salon actions');
        h.key('keydown', 'KeyD', h.campaignCanvas); h.key('keydown', 'Space', h.campaignCanvas);
        h.campaign.update(); assert.equal(h.campaign.getState().right, true); assert.equal(h.campaign.getState().jumpPressed, true);
        assertNeutral(salon, 'Disposed salon listeners cannot resume');
        h.key('keyup', 'KeyD', h.campaignCanvas); h.key('keyup', 'Space', h.campaignCanvas);
    }
});

test('ordinary editable fields and native activation stay isolated outside dialogs', t => {
    const h = browser(t);
    for (const tag of ['INPUT', 'TEXTAREA', 'SELECT', 'DIV']) {
        const control = new Element(tag), child = new Element('SPAN');
        if (tag === 'DIV') control.attributes.set('contenteditable', 'true');
        h.body.append(control); control.append(child);
        for (const code of ['KeyD', 'Space', 'Escape']) {
            assert.equal(h.key('keydown', code, child).defaultPrevented, false);
            h.key('keyup', code, child);
        }
    }
    for (const tag of ['BUTTON', 'A', 'SUMMARY']) {
        const control = new Element(tag), child = new Element('SPAN');
        if (tag === 'A') control.attributes.set('href', '#chapter');
        h.body.append(control); control.append(child);
        for (const code of ['Enter', 'Space']) {
            assert.equal(h.key('keydown', code, child).defaultPrevented, false);
            h.key('keyup', code, child);
        }
    }
    assertNeutral(h.campaign, 'Editable and native UI never queue game actions');
    h.dialog.attributes.set('open', '');
    assert.equal(h.campaignCanvas.closest('dialog[open]'), null);
    assert.equal(h.key('keydown', 'KeyD', h.campaignCanvas).defaultPrevented, true,
        'An unrelated open dialog does not change target-based input handling');
    h.key('keyup', 'KeyD', h.campaignCanvas);
});
