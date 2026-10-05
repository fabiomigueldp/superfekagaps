import { pixelText, textWidth, wrapText } from '../../graphics/BitmapFont';
import { ART } from '../../graphics/palette';

export const element = <K extends keyof HTMLElementTagNameMap>(tag: K, className = '', text = ''): HTMLElementTagNameMap[K] => {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
};

/** Use the actual World lettering, with a text equivalent for assistive technology. */
export function lettering(text: string, color: string = ART.paper, scale = 2, lineWidth = 240): HTMLSpanElement {
    const root = element('span', 'dl-lettering');
    const lines = wrapText(text, lineWidth);
    const width = Math.max(1, ...lines.map(line => textWidth(line)));
    const canvas = element('canvas', 'dl-bitmap');
    canvas.width = width * scale;
    canvas.height = (lines.length * 12 + 1) * scale;
    canvas.setAttribute('aria-hidden', 'true');
    const context = canvas.getContext('2d');
    if (context) lines.forEach((line, index) => pixelText(context, line, 0, (3 + index * 12) * scale, color, scale));
    root.append(canvas, element('span', 'dl-sr-only', text));
    return root;
}

export function heading(text: string, level: 1 | 2 = 1, scale = 2): HTMLHeadingElement {
    const node = element(level === 1 ? 'h1' : 'h2');
    node.append(lettering(text, ART.goldLight, scale, scale === 3 ? 126 : 208));
    return node;
}

export function button(text: string, action: () => void, className = 'dl-button'): HTMLButtonElement {
    const node = element('button', className);
    node.type = 'button';
    node.append(lettering(text));
    node.addEventListener('click', action);
    return node;
}

export function worldLink(): HTMLAnchorElement {
    const node = element('a', 'dl-button dl-world-link');
    node.href = './';
    node.append(lettering('Voltar ao World'));
    return node;
}

export const formatTime = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, '0')}`;
