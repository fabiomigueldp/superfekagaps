import { fitText, panel, pixelText, wrapText } from '../graphics/BitmapFont';
import { workshopPanel, WORKSHOP_UI } from './WorldWorkshopUI';

/** Campaign and chapters compose these plates on the same 320 × 180 surface. */
export const WORLD_PAUSE_ACTIONS = Object.freeze([
    { x: 98, y: 59, width: 124, height: 20 },
    { x: 98, y: 83, width: 124, height: 20 },
    { x: 98, y: 107, width: 124, height: 20 },
]);
export const WORLD_DIALOGUE_ACTION = Object.freeze({ x: 215, y: 150, width: 80, height: 20 });
export const worldTextLines = (text: string, width: number): string[] => text.split('\n').flatMap(line => wrapText(line, width));

export function drawWorldPause(c: CanvasRenderingContext2D, stage: string): void {
    c.fillStyle = '#101d29c9'; c.fillRect(0, 0, 320, 180);
    const lines = wrapText(stage, 132);
    workshopPanel(c, 86, 31, 148, 118 + (lines.length - 1) * 10);
    pixelText(c, 'PAUSA', 160, 39, WORKSHOP_UI.paper, 2, 'center');
    lines.forEach((line, i) => pixelText(c, line, 160, 136 + i * 10, WORKSHOP_UI.muted, 1, 'center'));
}

export function drawWorldSettingsFrame(c: CanvasRenderingContext2D): void {
    c.fillStyle = WORKSHOP_UI.ink; c.fillRect(0, 0, 320, 180);
    workshopPanel(c, 62, 11, 196, 30);
    pixelText(c, 'OPÇÕES', 160, 20, WORKSHOP_UI.paper, 2, 'center');
}

export function drawWorldResult(c: CanvasRenderingContext2D, title: string, stage: string, result: string, detail = ''): void {
    panel(c, 32, 38, 256, 109);
    pixelText(c, title, 160, 51, WORKSHOP_UI.light, 2, 'center');
    pixelText(c, fitText(stage, 230), 160, 75, WORKSHOP_UI.paper, 1, 'center');
    pixelText(c, fitText(result, 238), 160, 94, '#a7c9d0', 1, 'center');
    if (detail) pixelText(c, fitText(detail, 238), 160, 106, '#a7c9d0', 1, 'center');
}

export function worldDialogueLayout(text: string) {
    const lines = worldTextLines(text, 270);
    const extra = Math.max(0, lines.length - 2) * 10;
    return { lines, top: 104 - extra, height: 69 + extra };
}

export function drawWorldDialogue(c: CanvasRenderingContext2D, speaker: string, text: string,
    accent: string, characters = text.length): void {
    // Measure the full sentence so the frame never jumps during the typewriter reveal.
    const { top, height } = worldDialogueLayout(text);
    panel(c, 12, top, 296, height, '#202d43', '#aac1cd');
    pixelText(c, speaker.toUpperCase(), 24, top + 9, accent);
    worldTextLines(text.slice(0, characters), 270).forEach((line, i) => pixelText(c, line, 24, top + 23 + i * 10, WORKSHOP_UI.paper));
}

export function drawWorldEncounterHud(c: CanvasRenderingContext2D, name: string, health: number,
    maxHealth: number, hint: string, pressure?: number): void {
    const lines = wrapText(hint, 184);
    const extra = Math.max(0, lines.length - 1) * 10;
    workshopPanel(c, 64, 20, 192, 30 + extra + (pressure === undefined ? 0 : 10));
    pixelText(c, fitText(name, 86), 72, 25, WORKSHOP_UI.paper);
    const stride = maxHealth <= 6 ? 13 : Math.max(2, Math.floor(78 / maxHealth));
    for (let i = 0; i < maxHealth; i++) {
        c.fillStyle = i < health ? '#f1a479' : '#4c5264';
        c.fillRect(169 + i * stride, 27, stride - (stride > 3 ? 3 : 1), 4);
    }
    lines.forEach((line, i) => pixelText(c, line, 160, 40 + i * 10, '#e5d6c3', 1, 'center'));
    if (pressure !== undefined) {
        pixelText(c, 'PRESSÃO', 72, 50 + extra, WORKSHOP_UI.muted);
        c.fillStyle = '#4c5264'; c.fillRect(120, 51 + extra, 128, 4);
        c.fillStyle = pressure > 75 ? '#f1a479' : '#8fdfc4';
        c.fillRect(120, 51 + extra, Math.round(128 * Math.max(0, Math.min(100, pressure)) / 100), 4);
    }
}
