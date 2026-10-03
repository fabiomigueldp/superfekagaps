import { WorldAudio } from './WorldAudio';
import { WorldAircraftAudio } from './WorldAircraftAudio';
import type { Preferences } from './types';
import { loadAircraftAssets, paintAircraftTravel, type AircraftAssets } from './WorldAircraftArt';
import { sampleAircraftTravel, AIRCRAFT_TRAVEL_DURATION, AIRCRAFT_REDUCED_DURATION, type AircraftRoute } from './WorldAircraftModel';
import { campaignMapAsset, campaignAirportTerminal, loadCampaignRegionImage, paintCampaignRegion, type GuairaCampaignRegion } from './GuairaCampaignArt';
import { mapToScreen, type MapCamera } from './WorldMapModel';
import { WORLD_ATLAS_PLACEMENTS } from './WorldAtlasModel';
export type GuairaAirTerminal = 'factory' | 'guaira' | 'serra';
export interface GuairaFlightOptions {
    from: GuairaAirTerminal;
    to: GuairaAirTerminal;
    preferences?: Preferences;
    soundEnabled?: boolean;
    onArrive(): boolean | void;
    onCancel?(): void;
}
const names: Record<GuairaAirTerminal, string> = { factory: 'Fábrica', guaira: 'Guaíra', serra: 'Serra' };
const artRegion = (terminal: GuairaAirTerminal): GuairaCampaignRegion => terminal === 'factory' ? 'fabrica' : terminal;
function loadImage(path: string): Promise<HTMLImageElement | null> {
    return new Promise(resolve => {
        const image = new Image(); const timeout = setTimeout(() => finish(null), 12000);
        const finish = (value: HTMLImageElement | null) => { clearTimeout(timeout); image.onload = image.onerror = null; resolve(value); };
        image.onload = () => finish(image); image.onerror = () => finish(null); image.src = path;
    });
}
/** One explicit trip; persistence belongs solely to successful arrival. */
export function runGuairaFlight(options: GuairaFlightOptions): () => void {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog'); dialog.className = 'guaira-flight';
    dialog.setAttribute('aria-label', `Voo de ${names[options.from]} para ${names[options.to]}`);
    const canvas = document.createElement('canvas'); canvas.width = 960; canvas.height = 540;
    canvas.setAttribute('aria-hidden', 'true');
    const status = document.createElement('p'); status.setAttribute('aria-live', 'polite');
    const nav = document.createElement('nav'), skip = document.createElement('button'), cancel = document.createElement('button'), retry = document.createElement('button');
    skip.textContent = 'Pular viagem'; skip.disabled = true; retry.textContent = 'Tentar carregar novamente'; retry.hidden = true;
    cancel.textContent = `Cancelar · voltar à ${names[options.from]}`;
    nav.append(skip, cancel, retry); dialog.append(canvas, status, nav); document.body.append(dialog); dialog.showModal();
    let frame = 0, stopped = false, elapsed = 0, previous = performance.now(), assets: AircraftAssets | null = null, loading = false;
    const controller = new AbortController();
    const sound = options.preferences && options.soundEnabled !== false ? new WorldAudio({ ...options.preferences, music: 0, voice: 0 }) : null;
    sound?.unlock();
    const engine = new WorldAircraftAudio(() => {
        const route = sound?.getEffectsRoute();
        return route ? { ...route, enabled: route.enabled && (options.preferences?.effects ?? 0) > 0 } : null;
    });
    let engineStarted = false, focused = true;
    const blur = () => { focused = false; engine.setPaused(true); previous = performance.now(); };
    const focus = () => { focused = true; previous = performance.now(); };
    window.addEventListener('blur', blur); window.addEventListener('focus', focus);
    const close = (arrived: boolean) => {
        if (stopped) return;
        if (arrived && options.onArrive() === false) {
            cancelAnimationFrame(frame); engine.cancel();
            status.textContent = 'Não foi possível salvar a viagem. Seu progresso continua nesta página. Libere espaço/armazenamento e tente salvar novamente, ou cancele para continuar aqui.';
            skip.textContent = 'Tentar salvar e continuar'; return;
        }
        stopped = true; cancelAnimationFrame(frame); controller.abort(); engine.dispose(); sound?.dispose();
        window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); dialog.close(); dialog.remove();
        document.removeEventListener('visibilitychange', resetClock);
        if (previousFocus instanceof HTMLElement && previousFocus.isConnected) previousFocus.focus();
        if (!arrived) options.onCancel?.();
    };
    const resetClock = () => { previous = performance.now(); if (document.hidden) engine.setPaused(true); };
    document.addEventListener('visibilitychange', resetClock);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(false); });
    dialog.addEventListener('keydown', event => event.stopPropagation());
    skip.addEventListener('click', () => { if (assets) close(true); }); cancel.addEventListener('click', () => close(false));
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const duration = reduced ? AIRCRAFT_REDUCED_DURATION : AIRCRAFT_TRAVEL_DURATION;
    const source = artRegion(options.from), destination = artRegion(options.to);
    const from = campaignAirportTerminal(source, true), to = campaignAirportTerminal(destination, true);
    const route: AircraftRoute = { departureStart: from.runwayStart, departureLift: from.runwayEnd,
        arrivalTouchdown: to.runwayEnd, arrivalStop: to.runwayStart, altitude: .24, scale: .8 };
    const images = new Map<GuairaCampaignRegion, HTMLImageElement>(), bases = new Map<GuairaCampaignRegion, HTMLImageElement>();
    const paintBackground = (ctx: CanvasRenderingContext2D, camera: MapCamera) => {
        const sea = ctx.createLinearGradient(0, 0, 0, 540); sea.addColorStop(0, '#477f91'); sea.addColorStop(1, '#75aeb1');
        ctx.fillStyle = sea; ctx.fillRect(0, 0, 960, 540);
        for (const region of [source, destination]) {
            const base = bases.get(region);
            if (base && region !== 'guaira') {
                const placement = WORLD_ATLAS_PLACEMENTS[region === 'fabrica' ? 3 : 4];
                const a = mapToScreen(placement.origin, camera), b = mapToScreen({ x: placement.origin.x + 1, y: placement.origin.y + 1 }, camera);
                ctx.drawImage(base, a.x, a.y, b.x - a.x, b.y - a.y);
            }
            paintCampaignRegion(ctx, camera, region, images.get(region) ?? null, true);
        }
    };
    const tick = (now: number) => {
        if (stopped || !assets) return;
        if (!document.hidden && focused) elapsed += Math.min(.05, Math.max(0, (now - previous) / 1000));
        previous = now;
        const pose = sampleAircraftTravel(route, elapsed, reduced), ctx = canvas.getContext('2d');
        if (!engineStarted && !document.hidden && focused) engineStarted = engine.start(pose);
        engine.sync(pose);
        if (ctx) {
            const center = reduced ? { x: (route.departureStart.x + route.arrivalStop.x) / 2, y: (route.departureStart.y + route.arrivalStop.y) / 2 }
                : { x: pose.position.x, y: pose.position.y - .04 };
            const camera: MapCamera = { center, width: 960, height: 540, zoom: reduced ? .52 : 1.22 };
            paintBackground(ctx, camera); paintAircraftTravel(ctx, camera, pose, assets, elapsed);
        }
        const phases = { boarding: 'Embarcando no aeródromo', 'takeoff-roll': 'Decolando', climb: 'Ganhando altitude', cruise: 'Sobrevoando os canais', approach: 'Aproximação', 'landing-roll': 'Pousando', arrived: 'Chegada confirmada' };
        const message = `${names[options.from]} → ${names[options.to]} · ${phases[pose.stage]}`;
        if (status.textContent !== message) status.textContent = message;
        if (elapsed >= duration) close(true); else frame = requestAnimationFrame(tick);
    };
    const load = async () => {
        if (loading || stopped) return;
        loading = true; retry.hidden = true; status.textContent = 'Preparando o avião e os aeródromos…';
        const loaded = await Promise.all([loadAircraftAssets(controller.signal), ...[source, destination].map(async region => {
            const overlay = await loadCampaignRegionImage(region); if (overlay) images.set(region, overlay);
            if (region !== 'guaira') { const base = await loadImage(campaignMapAsset(`${region === 'fabrica' ? 'fabrica' : 'serra'}-diorama.webp`)); if (base) bases.set(region, base); }
            return !!overlay && (region === 'guaira' || bases.has(region));
        })]);
        loading = false; if (stopped) return;
        assets = loaded[0] as AircraftAssets | null;
        if (!assets || !loaded.slice(1).every(Boolean)) {
            assets = null; status.textContent = 'A viagem não carregou. Seu progresso e o ponto de partida foram preservados.'; retry.hidden = false; return;
        }
        skip.disabled = false; previous = performance.now(); frame = requestAnimationFrame(tick);
    };
    retry.addEventListener('click', () => { void load(); }); void load();
    return () => close(false);
}
