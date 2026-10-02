import assert from 'node:assert/strict';
import test from 'node:test';
import { Renderer } from '../src/engine/Renderer';
import { guairaBrowser, Canvas } from './helpers/guairaLabHarness';

test('the DOM control opt-in suppresses only native action overlays and restores them on the same renderer', t => {
    const h = guairaBrowser(t, { touch: true });
    const canvases: Canvas[] = [];
    const original = h.document.createElement;
    h.document.createElement = (tag: string) => {
        const element = original(tag); if (element instanceof Canvas) canvases.push(element); return element;
    };
    const renderer = new Renderer();
    const painted = () => canvases.reduce((sum, canvas) => sum + canvas.drawCalls, 0);
    let before = painted(); renderer.drawTouchControls(); assert.ok(painted() > before, 'default native controls remain visible');
    renderer.setTouchControlsVisible(false);
    before = painted(); renderer.drawTouchControls(); assert.equal(painted(), before, 'DOM bar can avoid a duplicate overlay');
    renderer.drawIntroTouchControls('walk'); assert.ok(painted() > before, 'the separate introduction controls remain unchanged');
    renderer.setTouchControlsVisible(true);
    before = painted(); renderer.drawTouchControls(); assert.ok(painted() > before, 'disposal can restore the original controls');
});
