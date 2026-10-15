import { DisposalScope } from '../../../../engine/DisposalScope';
import { GuairaChapterAction } from './GuairaChapterAction';
import type { GuairaChapterControlsHelp } from './GuairaChapterControlsHelp';

/** A scene keeps its dimensions through play, pause, help and completion. */
export function chapterSceneChrome(scope: DisposalScope, canvas: HTMLCanvasElement, nav: HTMLElement,
    status: HTMLElement, primary: HTMLButtonElement, help: GuairaChapterControlsHelp,
    retry: HTMLButtonElement, map: HTMLButtonElement, sound: HTMLButtonElement, optional: boolean) {
    nav.setAttribute('data-scene-overlay', 'true');
    nav.setAttribute('data-state', 'loading');
    const menu = document.createElement('div'); menu.className = 'chapter-scene-menu';
    const heading = document.createElement('h2'); heading.className = 'chapter-scene-heading';
    heading.hidden = true;
    const headingArt = new GuairaChapterAction(heading, false, true);
    headingArt.setLabel('PAUSA', 'Pausa');
    const actions = document.createElement('div'); actions.className = 'chapter-scene-actions';
    const options = document.createElement('div'); options.className = 'chapter-game-options';
    options.id = 'chapter-pause-options'; options.setAttribute('role', 'group'); options.setAttribute('aria-label', 'Opções');
    const settings = document.createElement('button'), back = document.createElement('button');
    settings.type = back.type = 'button'; settings.id = 'chapter-options'; back.id = 'chapter-options-back';
    new GuairaChapterAction(settings, false, false, 128).setLabel('OPÇÕES', 'Opções');
    new GuairaChapterAction(back, false, false, 128).setLabel('VOLTAR', 'Voltar à pausa');
    settings.hidden = true;
    settings.setAttribute('aria-controls', options.id); settings.setAttribute('aria-expanded', 'false');
    options.append(sound, help.button, retry, back);
    actions.append(primary, settings, map);
    menu.append(heading, actions, options); nav.append(status, menu);
    const warning = document.createElement('p'); warning.className = 'chapter-save-warning';
    warning.setAttribute('role', 'alert'); warning.hidden = true; nav.append(warning);
    let state = 'loading', showingOptions = false;
    const active = () => !scope.isDisposed && !help.isOpen && !document.hidden;
    const focus = (element: HTMLElement) => { if (active()) element.focus({ preventScroll: true }); };
    const showOptions = (show: boolean, moveFocus = true) => {
        showingOptions = show;
        options.hidden = !show; actions.hidden = show;
        settings.setAttribute('aria-expanded', String(show));
        headingArt.setLabel(show ? 'OPÇÕES' : 'PAUSA', show ? 'Opções' : 'Pausa');
        if (moveFocus) focus(show ? sound : settings);
    };
    scope.listen(settings, 'click', () => { if (active() && state === 'paused') showOptions(true); });
    scope.listen(back, 'click', () => { if (active() && state === 'paused') showOptions(false); });
    // Install before the scene's Input. Escape closes options first, then resumes.
    scope.listen(window, 'keydown', event => {
        if (!active() || state !== 'paused' || event.ctrlKey || event.metaKey || event.altKey) return;
        if (event.key === 'Escape' && showingOptions) {
            event.preventDefault(); event.stopImmediatePropagation();
            if (!event.repeat) showOptions(false);
            return;
        }
        if (!['ArrowUp', 'ArrowDown', 'Home', 'End'].includes(event.key)) return;
        if (event.target !== canvas && !nav.contains(event.target as Node)) return;
        event.preventDefault(); event.stopImmediatePropagation();
        const buttons = (showingOptions ? [sound, help.button, retry, back] : [primary, settings, map])
            .filter(button => !button.hidden && !button.disabled);
        const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const next = event.key === 'Home' ? 0 : event.key === 'End' ? buttons.length - 1
            : (index + (event.key === 'ArrowUp' ? -1 : 1) + buttons.length) % buttons.length;
        if (buttons[next]) focus(buttons[next]);
    }, true);
    showOptions(false, false);
    return (paused: boolean, complete = false, storageWarning = '') => {
        if (warning.textContent !== storageWarning) warning.textContent = storageWarning;
        warning.hidden = !storageWarning;
        const next = paused ? 'paused' : complete ? 'complete' : 'playing';
        if (state === next) return;
        const ownedFocus = document.activeElement === canvas || nav.contains(document.activeElement);
        const previous = state; state = next;
        showOptions(false, false);
        nav.setAttribute('data-state', state);
        heading.hidden = state !== 'paused';
        settings.hidden = state !== 'paused';
        map.hidden = state === 'playing' || state === 'complete' && !optional;
        if (paused && ownedFocus) focus(primary);
        else if (previous === 'paused' && ownedFocus) focus(canvas);
    };
}
