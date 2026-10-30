/** The classList methods used by our fixtures, backed by the live class attribute. */
export function createClassList(element: Pick<Element, 'getAttribute' | 'setAttribute'>):
    Pick<DOMTokenList, 'add' | 'remove' | 'contains' | 'toggle'> {
    const tokens = () => new Set((element.getAttribute('class') ?? '').split(/[\t\n\f\r ]+/).filter(Boolean));
    const validate = (name: string) => {
        if (!name) throw new DOMException('Empty class token', 'SyntaxError');
        if (/[\t\n\f\r ]/.test(name)) throw new DOMException('Whitespace in class token', 'InvalidCharacterError');
    };
    const update = (next: Set<string>) => element.setAttribute('class', [...next].join(' '));
    return {
        contains(name) { return tokens().has(`${name}`); },
        add(...names) {
            names = names.map(name => `${name}`); names.forEach(validate);
            const next = tokens(); names.forEach(name => next.add(name)); update(next);
        },
        remove(...names) {
            names = names.map(name => `${name}`); names.forEach(validate);
            const next = tokens(); names.forEach(name => next.delete(name));
            // Removing from an element without a class attribute must not create it.
            if (element.getAttribute('class') !== null) update(next);
        },
        toggle(name, force) {
            name = `${name}`; validate(name);
            const next = tokens(), before = next.has(name), after = force === undefined ? !before : Boolean(force);
            // A forced no-op preserves whitespace/duplicates in the original attribute.
            if (after !== before) {
                if (after) next.add(name); else next.delete(name);
                update(next);
            }
            return after;
        },
    };
}
