import test from 'node:test';
import assert from 'node:assert/strict';
import { freshSave } from '../src/adventure/progress';
import { campaignMapDirection, guairaTravelDirections } from '../src/adventure/CampaignWayfinding';
import { showGuairaRegion } from '../src/adventure/WorldGuairaRegion';

test('Factory completion gives a physical route before a failed Serra selection', () => {
    const save = freshSave();
    assert.equal(campaignMapDirection(save, '3-5', '3-5', false), '');
    assert.equal(guairaTravelDirections(save, '3-5').available, false);
    save.completed = ['3-5'];
    assert.match(campaignMapDirection(save, '3-5', '3-5', false), /voe até Guaíra e libere a água com o Prefeito/);
    assert.equal(campaignMapDirection(save, '3-5', '4-1', false), '');
    assert.equal(campaignMapDirection(save, '3-5', '3-5', true), '');
    save.guaira.completed = ['guaira-prefeito'];
    assert.match(campaignMapDirection(save, '3-5', '3-5', false), /embarque de lá para a Serra/);
});

test('legacy access keeps its route and never claims water was released', () => {
    const save = freshSave(); save.completed = ['3-5']; save.legacySerraAccess = true;
    const before = JSON.stringify(save);
    assert.match(guairaTravelDirections(save, '3-5').route, /acesso antigo/);
    assert.equal(guairaTravelDirections(save, '5-1').approach, '4-1');
    assert.equal(JSON.stringify(save), before);
    save.completed.push('4-1', '4-2');
    assert.equal(guairaTravelDirections(save, '5-1').approach, '4-3');
    assert.match(campaignMapDirection(save, '4-2', '4-2', false), /Revisitar Guaíra/);
    assert.equal(campaignMapDirection(save, '4-3', '4-3', false), '');
});

class Element extends EventTarget {
    children: Element[] = []; textContent = ''; disabled = false; isConnected = true;
    className = ''; id = ''; src = ''; alt = ''; dataset: Record<string, string> = {};
    append(...children: Element[]) { this.children.push(...children); }
    setAttribute() {} showModal() {} close() {} focus() {}
    remove() { this.isConnected = false; }
    click() { if (!this.disabled) this.dispatchEvent(new Event('click')); }
}

test('region control distinguishes approach, flight, locked boarding and Serra revisits', () => {
    const body = new Element();
    Object.assign(globalThis, { document: { body, activeElement: null, createElement: () => new Element() }, HTMLElement: Element });
    const save = freshSave(), calls: string[] = [];
    const callbacks = { fly: (from: string) => calls.push(from), goToFactory: () => calls.push('approach-factory'), goToSerra: () => calls.push('approach-serra') };
    const button = () => body.children.at(-1)!.children.at(-1)!.children[0];
    let close = showGuairaRegion(save, '3-5', callbacks);
    assert.equal(button().disabled, true); button().click(); assert.deepEqual(calls, []); close();
    save.completed = ['3-5'];
    close = showGuairaRegion(save, '2-5', callbacks);
    assert.equal(button().textContent, 'Ir à Fábrica para embarcar'); button().click();
    assert.deepEqual(calls, ['approach-factory']);
    close = showGuairaRegion(save, '3-5', callbacks);
    assert.equal(button().textContent, 'Voar da Fábrica para Guaíra'); button().click();
    assert.deepEqual(calls, ['approach-factory', 'factory']);
    close = showGuairaRegion(save, '4-1', callbacks);
    assert.equal(button().textContent, 'Voar da Serra para Guaíra');
    assert.match(body.children.at(-1)!.children[3].textContent, /Revisita a Guaíra/);
    button().click(); assert.deepEqual(calls, ['approach-factory', 'factory', 'serra']);
});
