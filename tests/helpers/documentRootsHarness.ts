/** Roots of an already mounted HTML document; elements keep their fixture's DOM behavior. */
export function createDocumentRoots<T extends { append(...children: T[]): void }>(createElement: (tag: string) => T):
    { documentElement: T; body: T; fullscreenElement: T | null } {
    const documentElement = createElement('html'), body = createElement('body');
    documentElement.append(body);
    // Tests may set fullscreenElement explicitly to represent native browser state.
    return { documentElement, body, fullscreenElement: null };
}
