import { Renderer } from '../../engine/Renderer';
import { panel, pixelText, fitText, wrapText } from '../../graphics/BitmapFont';
import { ART } from '../../graphics/palette';
import { drawTouchButtons, WORLD_TOUCH_BUTTONS, type TouchButton } from '../../graphics/touchControls';
import { CanvasMenuAccessibility, type CanvasMenuChoice, type CanvasMenuHost } from '../CanvasMenuAccessibility';
import { WorldHudAccessibility } from '../WorldHudAccessibility';
import { drawWorkshopHud, workshopButton, workshopPanel, WORKSHOP_UI } from '../WorldWorkshopUI';
import { drawWorldDialogue, drawWorldEncounterHud, drawWorldPause, drawWorldResult, drawWorldSettingsFrame, worldTextLines } from '../WorldSceneUI';
import type { DeliciaArt } from './DeliciaArt';
import type { DeliciaSimulation } from './DeliciaSimulation';

export interface DeliciaMenuChoice extends Omit<CanvasMenuChoice, 'label' | 'ariaLabel'> {
    label: string | (() => string);
    ariaLabel?: string | (() => string);
    run(): void;
}
export interface DeliciaMenu {
    id: string;
    kind: 'pause' | 'dialogue' | 'result' | 'settings' | 'journal' | 'title';
    title: string;
    text?: string | (() => string);
    detail?: string | (() => string);
    choices: DeliciaMenuChoice[];
    back?: () => void;
}
const read = (text?: string | (() => string)) => typeof text === 'function' ? text() : text ?? '';
export const DELICIA_TOUCH_BUTTONS: readonly TouchButton[] = [
    ...WORLD_TOUCH_BUTTONS,
    { x: 184, y: 99, width: 32, height: 29, label: 'SEM', key: 'j', name: 'Semente' },
    { x: 232, y: 99, width: 32, height: 29, label: 'REB', key: 'q', name: 'Rebater' },
    { x: 280, y: 99, width: 32, height: 29, label: 'ABR', key: 'e', name: 'Abrir' },
];

/** A chapter supplies content and actions; World owns its pixels, scale and native controls. */
export class DeliciaPresentation {
    readonly renderer: Renderer;
    readonly menus: CanvasMenuAccessibility;
    readonly hud: WorldHudAccessibility;
    private previousRenderer?: Renderer;

    constructor(canvas: HTMLCanvasElement, mount: HTMLElement, menuHost: CanvasMenuHost, pause: () => void) {
        this.previousRenderer = (window as unknown as { renderer?: Renderer }).renderer;
        this.renderer = new Renderer(canvas);
        this.menus = new CanvasMenuAccessibility(canvas, menuHost, mount);
        this.hud = new WorldHudAccessibility(canvas, pause, mount);
    }

    draw(sim: DeliciaSimulation | null, art: DeliciaArt, menu: DeliciaMenu | null, selected: number,
        options: { playing: boolean; reduced: boolean; shake: number; toast: string; banner: string; characters: number; status: string }): void {
        const { renderer } = this;
        renderer.startScene();
        const c = renderer.getContext();
        const scene = sim && (!menu || ['pause', 'dialogue', 'result'].includes(menu.kind));
        const seals = sim?.stage.pickups.filter(p => p.kind === 'seal' && sim.collected.has(p.id)).length ?? 0;
        const stage = sim ? (sim.stage.optional ? 'D-EX' : `D-${sim.stage.number}`) : '';
        this.hud.sync(options.playing, stage, sim?.coins ?? 0, seals, false, sim
            ? `${stage} · ${sim.player.health} vidas · ${sim.coins} laranjas · ${seals}/3 selos · ${sim.valves.size}/${sim.stage.valves.length} fontes` : '');
        if (scene) {
            c.save();
            if (options.shake > 0 && !options.reduced)
                c.translate(Math.round(Math.sin(sim.time * 95) * options.shake * 7), Math.round(Math.cos(sim.time * 71) * options.shake * 5));
            art.draw(c, sim, options.reduced, 1); c.restore();
            if (!this.hud.showsReadableStrip) {
                drawWorkshopHud(c, stage, sim.coins, seals);
                // Health occupies the equipment compartment; extra help uses the same compact count.
                pixelText(c, '♥', 138, 5, ART.redLight);
                pixelText(c, String(sim.player.health), 149, 5, WORKSHOP_UI.paper);
                if (sim.stage.valves.length && !sim.boss) {
                    workshopPanel(c, 168, 0, 55, 16, false, true);
                    pixelText(c, `F ${sim.valves.size}/${sim.stage.valves.length}`, 175, 5, ART.tealLight);
                }
            }
            if (sim.boss) drawWorldEncounterHud(c, sim.boss.character === 'jaja' ? 'Jajá' : 'Guina', sim.boss.hp,
                sim.boss.maxHp, sim.boss.cue, sim.boss.character === 'guina' ? sim.boss.pressure : undefined);
        } else { c.fillStyle = WORKSHOP_UI.ink; c.fillRect(0, 0, 320, 180); }

        if (menu) {
            const text = read(menu.text), detail = read(menu.detail);
            if (menu.kind === 'pause') drawWorldPause(c, text);
            else if (menu.kind === 'dialogue') drawWorldDialogue(c, menu.title, text, ART.tealLight, options.characters);
            else if (menu.kind === 'settings') {
                drawWorldSettingsFrame(c);
                if (text) wrapText(text, 282).forEach((line, i) => pixelText(c, line, 160, 120 + i * 10, WORKSHOP_UI.muted, 1, 'center'));
            } else if (menu.kind === 'journal') {
                panel(c, 12, 9, 296, 162, '#202d43', '#aac1cd');
                pixelText(c, fitText(menu.title, 272), 24, 18, ART.goldLight);
                worldTextLines(text, 272).forEach((line, i) => pixelText(c, line, 24, 36 + i * 10, WORKSHOP_UI.paper));
                if (detail) pixelText(c, fitText(detail, 270), 160, 126, WORKSHOP_UI.muted, 1, 'center');
            } else {
                const [stage = '', result = ''] = text.split('\n');
                drawWorldResult(c, menu.title, stage, result, detail);
            }
            const choices = menu.choices.map(choice => ({ ...choice, label: read(choice.label), ariaLabel: read(choice.ariaLabel) || read(choice.label) }));
            choices.forEach((choice, i) => workshopButton(c, choice.label, choice.x, choice.y, choice.width, choice.height, selected === i));
            this.menus.sync(menu.id, `${menu.title}${text ? ': ' + text : ''}`, choices, selected, options.status);
        } else this.menus.clear({ restoreFocus: false });

        // Same position and typography as campaign feedback, never on top of a conversation or menu.
        const feedback = !menu && (options.toast || options.banner);
        if (feedback) {
            const lines = wrapText(feedback, 272), y = sim?.boss ? 76 : 29;
            panel(c, 12, y, 296, 12 + lines.length * 10, '#202d43', '#aac1cd');
            lines.forEach((line, i) => pixelText(c, line, 24, y + 7 + i * 10, ART.goldLight));
        }
        if (options.playing && navigator.maxTouchPoints > 0) drawTouchButtons(c, DELICIA_TOUCH_BUTTONS);
        renderer.present();
    }

    hide(): void { this.menus.clear({ restoreFocus: false }); this.hud.sync(false, '', 0, 0, false); }
    dispose(): void {
        this.menus.dispose(); this.hud.dispose(); this.renderer.dispose();
        if (this.previousRenderer && !this.previousRenderer.isDisposed)
            (window as unknown as { renderer?: Renderer }).renderer = this.previousRenderer;
        this.previousRenderer = undefined;
    }
}
