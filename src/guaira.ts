import { LabToolbarAction, labActionSize } from './adventure/experimental/JuiceLabToolbar';
import { GUAIRA_SELECTIONS, GuairaMapModel, guairaArrivalFromSearch, guairaReturnContextFromSearch, type GuairaSelection } from './adventure/experimental/guaira/GuairaMapModel';
import { guairaMapPresentation } from './adventure/experimental/guaira/GuairaMapPresentation';
import { approachGuairaCamera, guairaCamera, guairaScreenPoint, paintGuairaMap, paintGuairaWaterFrame, type GuairaCamera, GUAIRA_FEKA_PIXEL_WIDTH } from './adventure/experimental/guaira/GuairaMapArt';
import { GUAIRA_WATER_CONTRACT, GuairaWaterMotion, VisibleWaterClock } from './adventure/experimental/guaira/GuairaWaterMotion';

import { loadGuairaScene } from './adventure/experimental/guaira/GuairaMapLoader';

const assetRoot = './assets/world/experimental/guaira/';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;
type MarkerRect = { left: number; top: number; width: number; height: number };
/** The optional plate stays attached to its authored landmark or disappears; it never floats away to fit. */
export function guairaBairroMarkerFits(rect: MarkerRect, width: number, height: number, occupied: readonly MarkerRect[]): boolean {
    const gap = 6;
    return rect.width >= 44 && rect.height >= 44 && rect.left >= gap && rect.top >= gap &&
        rect.left + rect.width <= width - gap && rect.top + rect.height <= height - gap &&
        occupied.every(other => rect.left + rect.width + gap <= other.left || other.left + other.width + gap <= rect.left ||
            rect.top + rect.height + gap <= other.top || other.top + other.height + gap <= rect.top);
}

/** Own lifecycle, geometry and URLs; no WorldGame, campaign, progress, or storage imports. */
export function startGuairaMap(): () => void {
    const abort = new AbortController(), { signal } = abort;
    const canvas = element<HTMLCanvasElement>('guaira-canvas'), context = canvas.getContext('2d');
    const scene = document.querySelector<HTMLElement>('.guaira-scene')!;
    const loading = element('map-loading'), loadingPanel = element('map-loading-panel'), status = element('map-status');
    const enter = element<HTMLButtonElement>('map-enter'), skip = element<HTMLButtonElement>('map-skip');
    const returnButton = element<HTMLButtonElement>('map-return');
    const overviewButton = element<HTMLButtonElement>('map-overview');
    const detours = element<HTMLDialogElement>('map-detours');
    const patio = element<HTMLButtonElement>('map-detour-patio'), bairro = element<HTMLButtonElement>('map-detour-bairro');
    const dismiss = element<HTMLButtonElement>('map-detours-close');
    new LabToolbarAction(dismiss).setLabel('VOLTAR', 'Fechar desvios e voltar ao mapa');
    const destinations = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-map-destination]'));
    const markers = destinations.filter(button => button.classList.contains('guaira-marker'));
    new LabToolbarAction(element('map-exit')).setLabel('SAIR', 'Sair para o jogo principal');
    const enterArt = new LabToolbarAction(enter, true);
    enterArt.setLabel('ENTRAR', 'Entrar no destino selecionado');
    new LabToolbarAction(skip).setLabel('CHEGAR', 'Chegar agora, pulando a caminhada');
    const returnArt = new LabToolbarAction(returnButton);
    returnArt.setLabel('VOLTAR', 'Voltar ao curral pela estrada');
    const overviewArt = new LabToolbarAction(overviewButton);
    const destinationArt = destinations.map(button => {
        const destination = GUAIRA_SELECTIONS[button.dataset.mapDestination as GuairaSelection];
        const art = new LabToolbarAction(button);
        // Size plates before async scene loading: the canvas default is 300×150.
        art.setLabel(destination.short, `Ir a ${destination.title}`);
        return { button, art };
    });
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    const compactMarkers = matchMedia('(max-height:500px) and (max-width:759px)');
    let model: GuairaMapModel | null = null, image: HTMLImageElement | null = null;
    let camera: GuairaCamera | null = null, overview = false, frame = 0, previousTime = 0, lastArrival = '', previousState = '';
    let water: GuairaWaterMotion | undefined, paintedCamera: GuairaCamera | null = null;
    let paintedDistance = -1, paintedMoving = false, lastWaterPaint = -Infinity;
    const waterClock = new VisibleWaterClock();
    let width = 1, height = 1, ratio = 1, actionEpoch = 0, menuOpen = false, pendingResize = false, restoreDetoursOnVisible = false;
    let actionBindings = new AbortController(), menuBindings = new AbortController();
    let focusedMarker: HTMLButtonElement | null = null;
    const requestFrame = () => { if (!signal.aborted && !frame && !document.hidden && !menuOpen) frame = requestAnimationFrame(render); };
    const live = () => !!model && !!image && !signal.aborted && !model.closed && !document.hidden && loadingPanel.hidden;
    function rescueMarkerFocus(marker: HTMLButtonElement | null) {
        const active = document.activeElement;
        if (!marker || !live() || menuOpen || (active && active !== marker && active !== document.body && active !== document.documentElement)) return;
        focusedMarker = null;
        destinations.find(button => button.dataset.mapDestination === 'town' && !markers.includes(button) && !button.hidden && !button.disabled)?.focus();
    }
    function snapshot() {
        return { model, revision: model?.revision, selected: model?.selected, arrival: model?.arrival, epoch: actionEpoch };
    }
    function current(state: ReturnType<typeof snapshot>, inMenu = false): boolean {
        return live() && state.model === model && state.revision === model?.revision && state.selected === model?.selected &&
            state.arrival === model?.arrival && state.epoch === actionEpoch && menuOpen === inMenu && (!inMenu || detours.open);
    }
    // A press started on an old action must not activate its replacement after a newer choice, hide, or menu session.
    const presses = new Map<HTMLButtonElement, ReturnType<typeof snapshot>>();
    const handledClicks = new WeakSet<Event>();
    function guardButton(button: HTMLButtonElement, state: ReturnType<typeof snapshot>, action: () => void,
        actionSignal: AbortSignal, inMenu = false) {
        button.addEventListener('pointerdown', () => { presses.set(button, snapshot()); }, { signal: actionSignal });
        button.addEventListener('keydown', event => {
            if (event.key !== 'Enter' && event.key !== ' ') return;
            // Holding Enter across CHEGAR -> GALERIA is still one activation, never a new entry choice.
            if (event.repeat) { event.preventDefault(); return; }
            presses.set(button, snapshot());
        }, { signal: actionSignal });
        button.addEventListener('click', event => {
            if (handledClicks.has(event)) return;
            handledClicks.add(event);
            if (button.disabled || button.hidden || (markers.includes(button) && compactMarkers.matches) || !current(state, inMenu)) return;
            const press = presses.get(button); presses.delete(button);
            if (press && !current(press, inMenu)) return;
            action();
        }, { signal: actionSignal });
    }
    function dismissDetours(restoreFocus = true) {
        if (!menuOpen) return;
        menuOpen = false; actionEpoch++; menuBindings.abort();
        if (detours.open) detours.close();
        returnButton.setAttribute('aria-expanded', 'false');
        previousTime = 0; waterClock.suspend(); if (pendingResize) resize(); reflect(); requestFrame();
        if (restoreFocus && live() && !returnButton.hidden) returnButton.focus();
    }
    function navigate(href: string) {
        if (!live()) return;
        // Close the model before location.assign so even a duplicate native activation is terminal.
        model!.close(); actionEpoch++; dismissDetours(false); reflect();
        cancelAnimationFrame(frame); frame = 0; waterClock.suspend(); location.assign(href);
    }
    function showDetours() {
        if (!live() || menuOpen || !model?.canEnterJunction) return;
        menuOpen = true; actionEpoch++; cancelAnimationFrame(frame); frame = 0;
        previousTime = 0; waterClock.suspend();
        menuBindings.abort(); menuBindings = new AbortController();
        const state = snapshot();
        patio.disabled = false; bairro.disabled = false;
        guardButton(patio, state, () => { const href = model?.junctionHref(); if (href) navigate(href); }, menuBindings.signal, true);
        guardButton(bairro, state, () => {
            if (!model?.canEnterJunction) return;
            dismissDetours(false); select('bairro');
            (model?.moving ? skip : enter).focus();
        }, menuBindings.signal, true);
        guardButton(dismiss, state, () => dismissDetours(), menuBindings.signal, true);
        returnButton.setAttribute('aria-expanded', 'true');
        detours.showModal(); patio.focus(); reflect();
    }
    function bindActions() {
        actionBindings.abort(); actionBindings = new AbortController();
        const state = snapshot();
        for (const marker of markers) {
            guardButton(marker, state, () => select(marker.dataset.mapDestination as GuairaSelection), actionBindings.signal);
        }
        guardButton(returnButton, state, () => {
            if (model?.canEnterJunction) { showDetours(); return; }
            const href = model?.respirosHref();
            if (href) { navigate(href); return; }
            if (!model?.canEnterMayor) return;
            actionEpoch++; model.returnToCorral(); clearVisitURL(); previousTime = 0; reflect(); requestFrame();
            destinations.find(button => button.dataset.mapDestination === 'curral' && !markers.includes(button))?.focus();
        }, actionBindings.signal);
        guardButton(enter, state, () => {
            if (model?.canWalkToCorral) {
                actionEpoch++; model.walkToCorral(); clearVisitURL(); previousTime = 0; reflect(); requestFrame(); return;
            }
            const href = model?.enterHref(); if (href) navigate(href);
        }, actionBindings.signal);
        guardButton(skip, state, () => {
            if (!model?.moving) return;
            actionEpoch++; model.skip(); camera = null; reflect(); requestFrame(); enter.focus();
        }, actionBindings.signal);
    }
    function reflect() {
        if (!model) return;
        const key = `${model.revision}:${model.selected}:${model.arrival}:${model.moving}:${model.closed}:${model.returnContext}:${overview}:${actionEpoch}:${menuOpen}:${document.hidden}`;
        if (key === previousState) return;
        previousState = key;
        const presentation = guairaMapPresentation(model);
        element('map-title').textContent = presentation.title;
        element('map-description').textContent = presentation.description;
        status.textContent = presentation.status;
        enter.disabled = !live() || menuOpen || (!model.canEnter && !model.canWalkToCorral); skip.hidden = !model.moving;
        returnButton.hidden = !model.canEnterMayor && !model.canEnterJunction && !model.canEnterRespiros;
        returnButton.disabled = returnButton.hidden || !live() || menuOpen;
        returnArt.setLabel(model.canEnterJunction ? 'DESVIOS' : model.canEnterRespiros ? 'RESPIROS' : 'VOLTAR', model.canEnterJunction
            ? 'Desvios: entrar no Pátio ou caminhar ao Bairro da Vala Seca'
            : model.canEnterRespiros ? 'Passagem dos Respiros: explorar a irrigação, percurso opcional' : 'Voltar ao curral pela estrada');
        returnButton.setAttribute('aria-haspopup', model.canEnterJunction ? 'dialog' : 'false');
        returnButton.setAttribute('aria-expanded', String(menuOpen));
        enterArt.setLabel(presentation.action, presentation.actionName);
        overviewButton.setAttribute('aria-pressed', String(overview));
        overviewArt.setLabel(overview ? 'VER FEKA' : 'VER MAPA', overview ? 'Acompanhar Feka' : 'Ver mapa inteiro');
        for (const { button, art } of destinationArt) {
            const id = button.dataset.mapDestination as GuairaSelection;
            button.disabled = !live() || menuOpen; button.setAttribute('aria-pressed', String(id === model.selected));
            art.setLabel(GUAIRA_SELECTIONS[id].short, `Ir a ${GUAIRA_SELECTIONS[id].title}`);
        }
        bindActions();
        if (model.selected && !model.moving && lastArrival !== model.selected) {
            lastArrival = model.selected;
            const url = new URL(location.href); url.searchParams.set('at', GUAIRA_SELECTIONS[model.selected].arrival);
            // Canonicalizing duplicate arrivals must never revive a rejected visit.
            if (model.returnContext) url.searchParams.set('visit', model.returnContext);
            else url.searchParams.delete('visit');
            history.replaceState(null, '', url);
        }
    }
    function render(time: number) {
        frame = 0;
        if (signal.aborted || !model || model.closed || !image || !context || document.hidden || menuOpen) return;
        const dt = previousTime ? Math.min(.05, (time - previousTime) / 1000) : 1 / 60;
        previousTime = time;
        model.tick(dt);
        const target = guairaCamera(model.metadata, width, height, model.point, overview);
        camera = !camera || model.reducedMotion ? target : approachGuairaCamera(camera, target, dt);
        const seconds = waterClock.tick(time, !!water && !model.reducedMotion);
        const overlay = water ? { effect: water, seconds } : undefined;
        const fullPaint = !paintedCamera || camera.x !== paintedCamera.x || camera.y !== paintedCamera.y ||
            camera.imageWidth !== paintedCamera.imageWidth || model.distance !== paintedDistance || model.moving !== paintedMoving;
        context.setTransform(ratio, 0, 0, ratio, 0, 0);
        if (fullPaint) {
            paintGuairaMap(context, image, camera, model, time, overlay);
            paintedCamera = camera; paintedDistance = model.distance; paintedMoving = model.moving; lastWaterPaint = seconds;
        } else if (overlay && !model.reducedMotion && seconds - lastWaterPaint >= 1 / 30 - 1e-6) {
            paintGuairaWaterFrame(context, image, camera, model, time, overlay);
            lastWaterPaint = seconds;
        }
        if (fullPaint) {
            const placed: MarkerRect[] = [];
            for (const marker of markers.filter(button => button.dataset.mapDestination !== 'bairro')) {
                const destination = GUAIRA_SELECTIONS[marker.dataset.mapDestination as GuairaSelection];
                const p = guairaScreenPoint(model.metadata.nodes[destination.node], camera);
                const bounds = marker.getBoundingClientRect();
                const markerWidth = bounds.width || labActionSize(destination.short).width * 2;
                const wasFocused = document.activeElement === marker;
                marker.hidden = compactMarkers.matches || p.x < markerWidth / 2 + 3 || p.x > width - markerWidth / 2 - 3 || p.y < 0 || p.y + 58 > height;
                marker.style.left = `${p.x}px`; marker.style.top = `${p.y + 12}px`;
                if (marker.hidden && wasFocused) rescueMarkerFocus(marker);
                if (!marker.hidden) placed.push({ left: p.x - markerWidth / 2, top: p.y + 12, width: markerWidth, height: Math.max(44, bounds.height) });
            }
            const optional = markers.find(button => button.dataset.mapDestination === 'bairro');
            if (optional) {
                const p = guairaScreenPoint(model.metadata.nodes['guaira-2'], camera), actor = guairaScreenPoint(model.point, camera);
                const bounds = optional.getBoundingClientRect(), scale = camera.imageWidth * GUAIRA_FEKA_PIXEL_WIDTH;
                const markerWidth = bounds.width || labActionSize(GUAIRA_SELECTIONS.bairro.short).width * 2;
                placed.push({ left: actor.x - 8 * scale, top: actor.y - 26 * scale, width: 16 * scale, height: 29 * scale });
                const wasHidden = optional.hidden, wasFocused = document.activeElement === optional;
                optional.hidden = compactMarkers.matches || !guairaBairroMarkerFits({ left: p.x - markerWidth / 2, top: p.y + 12,
                    width: markerWidth, height: Math.max(44, bounds.height) }, width, height, placed);
                if (!wasHidden && optional.hidden) actionEpoch++;
                optional.style.left = `${p.x}px`; optional.style.top = `${p.y + 12}px`;
                if (optional.hidden && wasFocused) rescueMarkerFocus(optional);
            }
        }
        reflect();
        if (model.moving || camera.x !== target.x || camera.y !== target.y || camera.imageWidth !== target.imageWidth ||
            (water && !model.reducedMotion)) requestFrame();
    }
    function resize() {
        if (menuOpen) { pendingResize = true; return; }
        pendingResize = false;
        const bounds = scene.getBoundingClientRect(); width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
        ratio = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
        camera = null; paintedCamera = null; requestFrame();
    }
    function clearVisitURL() {
        const url = new URL(location.href);
        if (url.searchParams.has('visit')) { url.searchParams.delete('visit'); history.replaceState(null, '', url); }
    }
    function select(destination: GuairaSelection) {
        if (!live() || menuOpen || !model) return;
        actionEpoch++; model.select(destination); clearVisitURL(); previousTime = 0; reflect(); requestFrame();
    }
    for (const button of destinations.filter(button => !markers.includes(button))) button.addEventListener('click', () => select(button.dataset.mapDestination as GuairaSelection), { signal });
    detours.addEventListener('cancel', event => { event.preventDefault(); dismissDetours(); }, { signal });
    detours.addEventListener('close', () => { if (!detours.open) dismissDetours(); }, { signal });
    element('map-exit').addEventListener('click', disposeMap, { signal });
    overviewButton.addEventListener('click', () => { if (!live() || menuOpen) return; overview = !overview; reflect(); requestFrame(); }, { signal });
    document.addEventListener('keydown', event => {
        if (menuOpen || !live() || event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault(); select(event.key === 'ArrowLeft' ? 'town' : event.key === 'ArrowRight' ? 'curral' : 'subida');
        }
    }, { signal });
    // CSS may reset activeElement to body before matchMedia emits its change event.
    // Keep focus ownership only until an actual focus or pointer choice moves elsewhere.
    document.addEventListener('focusin', event => {
        const target = event.target as HTMLButtonElement;
        if (target === document.body && compactMarkers.matches && focusedMarker) return;
        focusedMarker = markers.includes(target) ? target : null;
    }, { signal });
    document.addEventListener('pointerdown', event => {
        if (event.target !== focusedMarker) focusedMarker = null;
    }, { signal, capture: true });
    compactMarkers.addEventListener('change', () => {
        // CSS can hide the whole group while every individual plate still fits the scene.
        // Map actions invalidate immediately; an open modal keeps its separate active choices.
        if (!menuOpen) actionEpoch++;
        if (compactMarkers.matches) {
            const markerHadFocus = markers.includes(document.activeElement as HTMLButtonElement)
                ? document.activeElement as HTMLButtonElement : focusedMarker;
            markers.forEach(marker => { marker.hidden = true; });
            rescueMarkerFocus(markerHadFocus);
        }
        paintedCamera = null; reflect(); requestFrame();
    }, { signal });
    motion.addEventListener('change', () => {
        actionEpoch++; dismissDetours(); model?.setReducedMotion(motion.matches); camera = null; paintedCamera = null; waterClock.suspend(); reflect(); requestFrame();
    }, { signal });
    document.addEventListener('visibilitychange', () => {
        if (document.hidden && menuOpen) restoreDetoursOnVisible = true;
        actionEpoch++; dismissDetours(false); previousTime = 0;
        waterClock.suspend(); reflect();
        if (document.hidden) { cancelAnimationFrame(frame); frame = 0; }
        else {
            if (restoreDetoursOnVisible && live() && !returnButton.hidden && !returnButton.disabled) returnButton.focus();
            restoreDetoursOnVisible = false; requestFrame();
        }
    }, { signal });
    window.addEventListener('resize', resize, { signal });
    const observer = new ResizeObserver(resize); observer.observe(scene);
    async function loadWater() {
        try {
            const atlas = new Image(); atlas.src = `${assetRoot}guaira-water-mask.png`; await atlas.decode();
            if (signal.aborted || model?.closed) return;
            if (atlas.naturalWidth !== GUAIRA_WATER_CONTRACT.atlasSize[0] || atlas.naturalHeight !== GUAIRA_WATER_CONTRACT.atlasSize[1]) return;
            water = new GuairaWaterMotion(atlas, GUAIRA_WATER_CONTRACT, document.createElement('canvas'));
            waterClock.suspend(); paintedCamera = null; requestFrame();
        } catch {
            // Decoration is optional: the already loaded map stays usable and static.
        }
    }
    async function load() {
        try {
            if (!context) throw new Error('Canvas indisponível');
            const { metadata, image: art } = await loadGuairaScene(async loadSignal => {
                const response = await fetch(`${assetRoot}guaira-diorama.meta.json`, { signal: loadSignal });
                if (!response.ok) throw new Error('Metadados indisponíveis');
                return response.json();
            }, async () => {
                const art = new Image(); art.src = `${assetRoot}guaira-diorama.webp`; await art.decode();
                if (art.naturalWidth !== 1920 || art.naturalHeight !== 1200) throw new Error('Maquete incompatível');
                return art;
            }, signal);
            if (signal.aborted) return;
            model = new GuairaMapModel(metadata, guairaArrivalFromSearch(location.search), guairaReturnContextFromSearch(location.search));
            model.setReducedMotion(motion.matches); image = art;
            loadingPanel.hidden = true; reflect(); resize();
            void loadWater();
        } catch {
            if (!signal.aborted) { loadingPanel.hidden = true; element('map-error').hidden = false; overviewButton.disabled = true; enter.hidden = true;
                element('map-title').textContent = 'Guaíra'; element('map-description').textContent = 'A maquete não carregou. Os experimentos continuam disponíveis acima.';
                status.textContent = ''; destinations.forEach(button => { button.hidden = true; }); }
        }
    }
    detours.close(); patio.disabled = true; bairro.disabled = true;
    overviewArt.setLabel('VER MAPA', 'Ver mapa inteiro');
    overviewButton.disabled = false; enter.hidden = false; element('map-error').hidden = true;
    loadingPanel.hidden = false; loading.textContent = 'Carregando a maquete…';
    destinations.forEach(button => { button.disabled = true; button.hidden = markers.includes(button); });
    enter.disabled = true; skip.hidden = true; returnButton.hidden = true; returnButton.disabled = true;
    void load();
    function disposeMap() {
        if (signal.aborted) return;
        model?.close(); actionEpoch++; dismissDetours(false); actionBindings.abort(); menuBindings.abort(); abort.abort();
        cancelAnimationFrame(frame); frame = 0; waterClock.suspend(); water = undefined; image = null; observer.disconnect();
    }
    return disposeMap;
}
let dispose = startGuairaMap();
window.addEventListener('pagehide', () => dispose());
window.addEventListener('pageshow', event => { if (event.persisted) dispose = startGuairaMap(); });
