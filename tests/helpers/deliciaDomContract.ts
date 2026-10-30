import type { Document } from 'happy-dom';

/** Runs unchanged against Happy DOM and the local Chromium document. No layout assumptions. */
export async function deliciaDomContract(document: Document) {
    const window = document.defaultView!, root = document.createElement('section'); document.body.append(root);
    const label = document.createElement('label'), input = document.createElement('input'), text = document.createTextNode(' <b>Ajuda</b> & ');
    input.type = 'checkbox'; label.append(input, text); root.append(label);
    const button = document.createElement('button'); button.textContent = 'Continuar'; label.append(button);
    const snapshots: unknown[] = [];
    snapshots.push({ phase: 'text', text: label.textContent, nodes: Array.from(label.childNodes, node => node.nodeType),
        elements: Array.from(label.children, node => node.tagName), parent: text.parentNode === label });
    root.append(text); text.data = 'Movido';
    snapshots.push({ phase: 'move', text: root.textContent, labelNodes: label.childNodes.length, parent: text.parentNode === root });
    root.dataset.controlCapture = 'true'; root.className = 'base base'; root.classList.toggle('touch', true);
    snapshots.push({ phase: 'queries', capture: document.querySelector('[data-control-capture="true"]') === root,
        matches: button.matches('button:not(:disabled)'), closest: button.closest('section.base') === root,
        className: root.getAttribute('class'), controls: Array.from(root.querySelectorAll('button:not(:disabled),input')).map(node => node.tagName) });
    const events: string[] = [];
    const capture = () => events.push('window:capture'), bubble = () => events.push('window:bubble');
    window.addEventListener('contract-event', capture, true); window.addEventListener('contract-event', bubble);
    label.addEventListener('contract-event', () => events.push('label:capture'), true);
    label.addEventListener('contract-event', () => events.push('label:bubble'));
    button.addEventListener('contract-event', event => { events.push('button'); event.preventDefault(); });
    const event = new window.Event('contract-event', { bubbles: true, cancelable: true });
    const accepted = button.dispatchEvent(event);
    Reflect.apply(window.removeEventListener, window, ['contract-event', capture, true]); window.removeEventListener('contract-event', bubble);
    snapshots.push({ phase: 'events', events: [...events], accepted, prevented: event.defaultPrevented, target: event.target === button });
    const focus: string[] = [];
    button.addEventListener('blur', event => { focus.push(event instanceof window.FocusEvent && event.relatedTarget === input ? 'blur-to-input' : 'wrong-blur'); });
    input.addEventListener('focus', event => { focus.push(event instanceof window.FocusEvent && event.relatedTarget === button ? 'focus-from-button' : 'wrong-focus'); });
    button.focus(); input.focus();
    // Capture this step now; later modal autofocus/restoration is browser-managed.
    snapshots.push({ phase: 'focus', focus: [...focus], active: document.activeElement === input });
    input.click();
    const select = document.createElement('select');
    for (const value of ['keyboard', 'controller']) { const option = document.createElement('option'); option.value = value; select.append(option); }
    root.append(select); select.value = 'controller';
    snapshots.push({ phase: 'form', checked: input.checked, value: select.value, selected: select.selectedOptions[0]?.value });
    const details = document.createElement('details'), summary = document.createElement('summary'), nested = document.createElement('button');
    details.append(summary, nested); root.append(details);
    const closed = nested.closest('details:not([open]) > :not(summary)') === nested;
    details.open = true;
    snapshots.push({ phase: 'details', closed, open: details.hasAttribute('open'), hiddenByDetails: !!nested.closest('details:not([open]) > :not(summary)') });
    const dialog = document.createElement('dialog'), heading = document.createElement('h2'); heading.tabIndex = -1;
    dialog.append(heading); document.body.append(dialog); dialog.showModal(); heading.focus();
    snapshots.push({ phase: 'dialog', open: document.querySelector('dialog[open]') === dialog, containsFocus: dialog.contains(document.activeElement) });
    dialog.close(); button.focus();
    await new Promise(resolve => setTimeout(resolve, 0));
    snapshots.push({ phase: 'close', open: dialog.open, restored: document.activeElement === button });
    dialog.remove(); root.replaceChildren();
    snapshots.push({ phase: 'detach', empty: root.childNodes.length === 0, labelConnected: label.isConnected,
        textParent: text.parentNode, captureConnected: document.querySelector('[data-control-capture="true"]') === root });
    root.remove();
    return snapshots;
}
