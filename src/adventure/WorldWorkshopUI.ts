import { fitText, pixelText } from '../graphics/BitmapFont';

/** Source-native Oficina artwork: petrol metal, brass fittings, hard pixel edges. */
export const WORKSHOP_UI = Object.freeze({
    ink: '#101d29', panel: '#123547', raised: '#20495a', edge: '#648591',
    paper: '#f5efd3', muted: '#adc0c6', brass: '#98703b', gold: '#dfad56', light: '#ffe29a',
});
export const WORLD_HUD_HEIGHT = 16;
export const WORLD_HUD_HELMET = Object.freeze({ x: 143, y: 0 });

function bolt(c: CanvasRenderingContext2D, x: number, y: number): void {
    c.fillStyle = WORKSHOP_UI.brass; c.fillRect(x, y, 3, 3);
    c.fillStyle = WORKSHOP_UI.light; c.fillRect(x, y, 2, 1);
    c.fillStyle = WORKSHOP_UI.ink; c.fillRect(x + 1, y + 1, 1, 1);
}

export function workshopPanel(c: CanvasRenderingContext2D, x: number, y: number, width: number, height: number,
    selected = false, compact = false): void {
    c.fillStyle = WORKSHOP_UI.ink; c.fillRect(x, y, width, height);
    c.fillStyle = selected ? WORKSHOP_UI.gold : WORKSHOP_UI.brass;
    c.fillRect(x + 1, y + 1, width - 2, height - 2);
    c.fillStyle = selected ? WORKSHOP_UI.light : WORKSHOP_UI.panel;
    c.fillRect(x + 2, y + 2, width - 4, height - 4);
    c.fillStyle = selected ? '#f4c675' : WORKSHOP_UI.edge;
    c.fillRect(x + 3, y + 2, width - 6, 1);
    c.fillStyle = selected ? '#bd8643' : '#0b293a';
    c.fillRect(x + 2, y + height - 3, width - 4, 1);
    if (compact) {
        c.fillStyle = WORKSHOP_UI.gold;
        c.fillRect(x + 2, y + 2, 1, 1); c.fillRect(x + width - 3, y + 2, 1, 1);
        c.fillRect(x + 2, y + height - 3, 1, 1); c.fillRect(x + width - 3, y + height - 3, 1, 1);
    } else {
        bolt(c, x + 2, y + 2); bolt(c, x + width - 5, y + 2);
        bolt(c, x + 2, y + height - 5); bolt(c, x + width - 5, y + height - 5);
    }
}

export function workshopButton(c: CanvasRenderingContext2D, label: string, x: number, y: number,
    width: number, height: number, selected: boolean, _accent: string = WORKSHOP_UI.light): void {
    workshopPanel(c, x, y, width, height, selected);
    const textY = y + Math.floor((height - 7) / 2);
    if (selected) {
        // The original orange workshop tab with two crisp diagonal strokes.
        const tabX = x + width - 10, tabY = y + Math.floor((height - 10) / 2);
        c.fillStyle = '#d98c42'; c.fillRect(tabX, tabY, 6, 10);
        c.fillStyle = WORKSHOP_UI.ink;
        for (let row = 0; row < 10; row++) for (let column = 0; column < 6; column++)
            if ((column + row) % 6 < 2) c.fillRect(tabX + column, tabY + row, 1, 1);
        // The original gold pointer sits just left of the selected plate.
        c.fillStyle = WORKSHOP_UI.gold;
        for (let col = 0; col < 4; col++) c.fillRect(x - 7 + col, textY + col, 1, 7 - col * 2);
    }
    pixelText(c, fitText(label, width - 26), x + width / 2 + 2, textY,
        selected ? WORKSHOP_UI.ink : WORKSHOP_UI.paper, 1, 'center');
}

function coin(c: CanvasRenderingContext2D, x: number, y: number): void {
    c.fillStyle = WORKSHOP_UI.gold; c.fillRect(x + 1, y, 5, 7); c.fillRect(x, y + 1, 7, 5);
    c.fillStyle = WORKSHOP_UI.light; c.fillRect(x + 2, y + 1, 2, 4);
    c.fillStyle = '#a76d34'; c.fillRect(x + 5, y + 2, 1, 3);
}
function seal(c: CanvasRenderingContext2D, x: number, y: number): void {
    c.fillStyle = '#358d87'; c.fillRect(x + 1, y, 5, 7); c.fillRect(x, y + 1, 7, 5);
    c.fillStyle = '#8fdfc4'; c.fillRect(x + 2, y + 1, 3, 5); c.fillRect(x + 1, y + 2, 5, 3);
    c.fillStyle = '#56b6aa'; c.fillRect(x + 3, y + 2, 1, 3);
}

export function worldHudLabels(stageId: string, coins: number, seals: number) {
    return { stage: stageId, coins: String(Math.max(0, Math.floor(coins))).padStart(3, '0'), seals: `${seals}/3` };
}

export function drawWorkshopHud(c: CanvasRenderingContext2D, stageId: string, coins: number, seals: number): void {
    const labels = worldHudLabels(stageId, coins, seals);
    // Keep the original single plaque. Trim its unused right-hand length,
    // retain its dividers/icons, and reserve one small equipment compartment.
    workshopPanel(c, 4, 0, 160, WORLD_HUD_HEIGHT, false, true);
    pixelText(c, fitText(labels.stage, 23), 12, 5, WORKSHOP_UI.paper);
    c.fillStyle = WORKSHOP_UI.edge; c.fillRect(40, 4, 1, 8); c.fillRect(87, 4, 1, 8);
    coin(c, 48, 5); pixelText(c, fitText(labels.coins, 23), 60, 5, WORKSHOP_UI.paper);
    seal(c, 96, 5); pixelText(c, labels.seals, 108, 5, WORKSHOP_UI.paper);
    workshopPanel(c, 300, 0, 16, WORLD_HUD_HEIGHT, false, true);
    c.fillStyle = WORKSHOP_UI.paper; c.fillRect(304, 5, 2, 6); c.fillRect(309, 5, 2, 6);
}
