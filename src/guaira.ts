import { LabToolbarAction } from './adventure/experimental/JuiceLabToolbar';
import { GUAIRA_DESTINATIONS, GuairaMapModel, guairaArrivalFromSearch, guairaReturnContextFromSearch, type GuairaDestination } from './adventure/experimental/guaira/GuairaMapModel';
import { guairaMapPresentation } from './adventure/experimental/guaira/GuairaMapPresentation';
import { approachGuairaCamera, guairaCamera, guairaScreenPoint, paintGuairaMap, paintGuairaWaterFrame, type GuairaCamera } from './adventure/experimental/guaira/GuairaMapArt';
import { GUAIRA_WATER_CONTRACT, GuairaWaterMotion, VisibleWaterClock } from './adventure/experimental/guaira/GuairaWaterMotion';

import { loadGuairaScene } from './adventure/experimental/guaira/GuairaMapLoader';

const assetRoot = './assets/world/experimental/guaira/';
const element = <T extends HTMLElement>(id: string) => document.getElementById(id) as T;

/** Own lifecycle, geometry and URLs; no WorldGame, campaign, progress, or storage imports. */
export function startGuairaMap(): () => void {
    const abort = new AbortController(), { signal } = abort;
    const canvas = element<HTMLCanvasElement>('guaira-canvas'), context = canvas.getContext('2d');
    const scene = document.querySelector<HTMLElement>('.guaira-scene')!;
    const loading = element('map-loading'), loadingPanel = element('map-loading-panel'), status = element('map-status');
    const enter = element<HTMLButtonElement>('map-enter'), skip = element<HTMLButtonElement>('map-skip');
    const returnButton = element<HTMLButtonElement>('map-return');
    const overviewButton = element<HTMLButtonElement>('map-overview');
    const destinations = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-map-destination]'));
    const markers = destinations.filter(button => button.classList.contains('guaira-marker'));
    new LabToolbarAction(element('map-exit')).setLabel('SAIR', 'Sair para o jogo principal');
    const enterArt = new LabToolbarAction(enter, true);
    enterArt.setLabel('ENTRAR', 'Entrar no destino selecionado');
    new LabToolbarAction(skip).setLabel('CHEGAR', 'Chegar agora, pulando a caminhada');
    new LabToolbarAction(returnButton).setLabel('VOLTAR', 'Voltar ao curral pela estrada');
    const overviewArt = new LabToolbarAction(overviewButton);
    const destinationArt = destinations.map(button => {
        const destination = GUAIRA_DESTINATIONS[button.dataset.mapDestination as GuairaDestination];
        const art = new LabToolbarAction(button);
        // Size plates before async scene loading: the canvas default is 300×150.
        art.setLabel(destination.short, `Ir a ${destination.title}`);
        return { button, art };
    });
    const motion = matchMedia('(prefers-reduced-motion: reduce)');
    let model: GuairaMapModel | null = null, image: HTMLImageElement | null = null;
    let camera: GuairaCamera | null = null, overview = false, frame = 0, previousTime = 0, lastArrival = '', previousState = '';
    let water: GuairaWaterMotion | undefined, paintedCamera: GuairaCamera | null = null;
    let paintedDistance = -1, paintedMoving = false, lastWaterPaint = -Infinity;
    const waterClock = new VisibleWaterClock();
    let width = 1, height = 1, ratio = 1;
    const requestFrame = () => { if (!signal.aborted && !frame && !document.hidden) frame = requestAnimationFrame(render); };
    function reflect() {
        if (!model) return;
        const key = `${model.selected}:${model.arrival}:${model.moving}:${model.closed}:${model.returnContext}:${overview}`;
        if (key === previousState) return;
        previousState = key;
        const presentation = guairaMapPresentation(model);
        element('map-title').textContent = presentation.title;
        element('map-description').textContent = presentation.description;
        status.textContent = presentation.status;
        enter.disabled = !model.canEnter && !model.canWalkToCorral; skip.hidden = !model.moving;
        returnButton.hidden = !model.canEnterMayor;
        returnButton.disabled = !model.canEnterMayor;
        enterArt.setLabel(presentation.action, presentation.actionName);
        overviewButton.setAttribute('aria-pressed', String(overview));
        overviewArt.setLabel(overview ? 'VER FEKA' : 'VER MAPA', overview ? 'Acompanhar Feka' : 'Ver mapa inteiro');
        for (const { button, art } of destinationArt) {
            const id = button.dataset.mapDestination as GuairaDestination;
            button.disabled = false; button.setAttribute('aria-pressed', String(id === model.selected));
            art.setLabel(GUAIRA_DESTINATIONS[id].short, `Ir a ${GUAIRA_DESTINATIONS[id].title}`);
        }
        if (model.selected && !model.moving && lastArrival !== model.selected) {
            lastArrival = model.selected;
            const url = new URL(location.href); url.searchParams.set('at', GUAIRA_DESTINATIONS[model.selected].arrival);
            // Canonicalizing duplicate arrivals must never revive a rejected visit.
            if (model.returnContext) url.searchParams.set('visit', model.returnContext);
            else url.searchParams.delete('visit');
            history.replaceState(null, '', url);
        }
    }
    function render(time: number) {
        frame = 0;
        if (signal.aborted || !model || model.closed || !image || !context || document.hidden) return;
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
        if (fullPaint) for (const marker of markers) {
            const node = GUAIRA_DESTINATIONS[marker.dataset.mapDestination as GuairaDestination].node;
            const p = guairaScreenPoint(model.metadata.nodes[node], camera);
            const markerWidth = marker.getBoundingClientRect().width || 116;
            marker.hidden = p.x < markerWidth / 2 + 3 || p.x > width - markerWidth / 2 - 3 || p.y < 0 || p.y + 58 > height;
            marker.style.left = `${p.x}px`; marker.style.top = `${p.y + 12}px`;
        }
        reflect();
        if (model.moving || camera.x !== target.x || camera.y !== target.y || camera.imageWidth !== target.imageWidth ||
            (water && !model.reducedMotion)) requestFrame();
    }
    function resize() {
        const bounds = scene.getBoundingClientRect(); width = Math.max(1, bounds.width); height = Math.max(1, bounds.height);
        ratio = Math.min(2, devicePixelRatio || 1); canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
        camera = null; paintedCamera = null; requestFrame();
    }
    function clearVisitURL() {
        const url = new URL(location.href);
        if (url.searchParams.has('visit')) { url.searchParams.delete('visit'); history.replaceState(null, '', url); }
    }
    function select(destination: GuairaDestination) {
        if (!model || model.closed) return;
        model.select(destination); clearVisitURL(); previousTime = 0; reflect(); requestFrame();
    }
    for (const button of destinations) button.addEventListener('click', () => select(button.dataset.mapDestination as GuairaDestination), { signal });
    returnButton.addEventListener('click', () => {
        if (!model?.canEnterMayor) return;
        model.returnToCorral(); clearVisitURL(); previousTime = 0; reflect(); requestFrame();
        destinations.find(button => button.dataset.mapDestination === 'curral' && !markers.includes(button))?.focus();
    }, { signal });
    skip.addEventListener('click', () => { model?.skip(); camera = null; reflect(); requestFrame(); enter.focus(); }, { signal });
    enter.addEventListener('click', () => {
        if (model?.canWalkToCorral) {
            model.walkToCorral(); clearVisitURL(); previousTime = 0; reflect(); requestFrame();
            return;
        }
        const href = model?.enterHref(); if (!href) return;
        model?.close(); reflect(); location.assign(href);
    }, { signal });
    overviewButton.addEventListener('click', () => { overview = !overview; reflect(); requestFrame(); }, { signal });
    document.addEventListener('keydown', event => {
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
        if (event.key === 'ArrowLeft' || event.key === 'ArrowRight' || event.key === 'ArrowUp') {
            event.preventDefault(); select(event.key === 'ArrowLeft' ? 'town' : event.key === 'ArrowRight' ? 'curral' : 'subida');
        }
    }, { signal });
    motion.addEventListener('change', () => {
        model?.setReducedMotion(motion.matches); camera = null; paintedCamera = null; waterClock.suspend(); reflect(); requestFrame();
    }, { signal });
    document.addEventListener('visibilitychange', () => {
        previousTime = 0;
        waterClock.suspend();
        if (document.hidden) { cancelAnimationFrame(frame); frame = 0; } else requestFrame();
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
    overviewArt.setLabel('VER MAPA', 'Ver mapa inteiro');
    overviewButton.disabled = false; enter.hidden = false; element('map-error').hidden = true;
    loadingPanel.hidden = false; loading.textContent = 'Carregando a maquete…';
    destinations.forEach(button => { button.disabled = true; button.hidden = markers.includes(button); });
    enter.disabled = true; skip.hidden = true; returnButton.hidden = true; returnButton.disabled = true;
    void load();
    return () => { model?.close(); abort.abort(); cancelAnimationFrame(frame); waterClock.suspend(); water = undefined; image = null; observer.disconnect(); };
}
let dispose = startGuairaMap();
window.addEventListener('pagehide', () => dispose());
window.addEventListener('pageshow', event => { if (event.persisted) dispose = startGuairaMap(); });
