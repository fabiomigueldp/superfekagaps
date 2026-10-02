/**
 * Offline proof: real WorldGame replay + real Canvas painter serialized to SVG.
 * DOM/audio surfaces are stubbed. This is NOT browser/device QA or an FPS claim.
 * Run: node --import tsx scripts/prove_guaira_junction.ts [/tmp/guaira-junction-proof]
 */
import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { guairaJunctionBrowser } from '../tests/helpers/guairaJunctionHarness';
import { Canvas } from '../tests/helpers/guairaLabHarness';
import { GUAIRA_JUNCTION as G } from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import recording from '../tests/helpers/guairaJunctionReplay.json';

const output = process.argv[2] ?? '/tmp/guaira-junction-proof';
mkdirSync(output, { recursive: true });
const contexts = new WeakMap<object, SvgContext>();
const definitions: string[] = [];
const xml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
let serial = 0;

/** Records commands, including the real cached sprite canvases and composition. */
class SvgContext {
    fillStyle = '#000'; strokeStyle = '#000'; globalAlpha = 1; lineWidth = 1;
    imageSmoothingEnabled = false;
    pieces: string[] = [];
    private transform = ''; private path = ''; private clipId = '';
    private stack: Array<{ fillStyle: string; strokeStyle: string; globalAlpha: number; lineWidth: number; transform: string; clipId: string }> = [];
    private attrs(stroke = false) {
        return `transform="${this.transform}" opacity="${this.globalAlpha}" fill="${stroke ? 'none' : this.fillStyle}"${this.clipId ? ` clip-path="url(#${this.clipId})"` : ''}${stroke ? ` stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}"` : ''}`;
    }
    save() { this.stack.push({ fillStyle: this.fillStyle, strokeStyle: this.strokeStyle, globalAlpha: this.globalAlpha, lineWidth: this.lineWidth, transform: this.transform, clipId: this.clipId }); }
    restore() { Object.assign(this, this.stack.pop()); }
    setTransform(a: number, b: number, c: number, d: number, e: number, f: number) { this.transform = `matrix(${a} ${b} ${c} ${d} ${e} ${f})`; }
    translate(x: number, y: number) { this.transform += ` translate(${x} ${y})`; }
    scale(x: number, y: number) { this.transform += ` scale(${x} ${y})`; }
    rotate(a: number) { this.transform += ` rotate(${a * 180 / Math.PI})`; }
    beginPath() { this.path = ''; }
    closePath() { this.path += 'Z '; }
    moveTo(x: number, y: number) { this.path += `M${x} ${y} `; }
    lineTo(x: number, y: number) { this.path += `L${x} ${y} `; }
    rect(x: number, y: number, w: number, h: number) { this.path += `M${x} ${y}h${w}v${h}h${-w}Z `; }
    arc(x: number, y: number, radius: number) { this.path += `M${x - radius} ${y}a${radius} ${radius} 0 1 0 ${2 * radius} 0a${radius} ${radius} 0 1 0 ${-2 * radius} 0 `; }
    fill() { this.pieces.push(`<path d="${this.path}" ${this.attrs()}/>`); }
    stroke() { this.pieces.push(`<path d="${this.path}" ${this.attrs(true)}/>`); }
    clip() { this.clipId = `clip${serial++}`; definitions.push(`<clipPath id="${this.clipId}"><path d="${this.path}"/></clipPath>`); }
    clearRect() { this.pieces.length = 0; }
    fillRect(x: number, y: number, w: number, h: number) { this.pieces.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${this.attrs()}/>`); }
    strokeRect(x: number, y: number, w: number, h: number) { this.pieces.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${this.attrs(true)}/>`); }
    drawImage(source: { width: number; height: number }, ...args: number[]) {
        const recorded = contexts.get(source); assert.ok(recorded, 'Every image comes from a captured native pixel canvas');
        const [sx, sy, sw, sh, dx, dy, dw, dh] = args.length === 8 ? args : [0, 0, source.width, source.height, args[0], args[1], args[2] ?? source.width, args[3] ?? source.height];
        this.pieces.push(`<g ${this.attrs()}><svg x="${dx}" y="${dy}" width="${dw}" height="${dh}" viewBox="${sx} ${sy} ${sw} ${sh}">${recorded.pieces.join('')}</svg></g>`);
    }
}

class SvgCanvas extends Canvas {
    readonly recording = new SvgContext();
    constructor() { super(); contexts.set(this, this.recording); }
    override getContext() { return this.recording as unknown as CanvasRenderingContext2D; }
}

const cleanups: Array<() => void> = [];
const h = guairaJunctionBrowser({ after: fn => cleanups.push(fn as () => void) }, { touch: true, reducedMotion: true });
const screen = new SvgContext(); contexts.set(h.canvas, screen);
h.canvas.getContext = () => screen as unknown as CanvasRenderingContext2D;
const createElement = h.document.createElement, nativeBuffers: SvgCanvas[] = [];
h.document.createElement = tag => {
    if (tag !== 'canvas') return createElement(tag);
    const canvas = new SvgCanvas(); nativeBuffers.push(canvas); return canvas;
};
const game = h.create();
const samples = new Map<number, string>([[0,'entrada'],[100,'aviso-a'],[180,'embarcado-a'],[434,'ponto-seguro'],[448,'salto-segunda-placa'],[500,'desvio-b'],[580,'embarcado-b'],[878,'arrozal']]);
const images: Array<{ frame: number; file: string; state: unknown }> = [];
function capture(frame: number, label: string) {
    // The first two native canvases are the frame/composite buffers. Cached
    // sprite canvases remain intact exactly as they do in the normal renderer.
    screen.pieces = []; for (const canvas of nativeBuffers.slice(0, 2)) canvas.recording.pieces = [];
    game.render();
    const file = `${String(frame).padStart(4, '0')}-${label}.svg`;
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 640 360" shape-rendering="crispEdges"><title>Offline native Canvas command proof: ${xml(label)}</title><defs>${definitions.join('')}</defs>${screen.pieces.join('')}</svg>`;
    writeFileSync(join(output, file), svg.replace(/(fill|stroke)="(#[a-f\d]{6})([a-f\d]{2})"/gi,
        (_match, attr: string, color: string, alpha: string) => `${attr}="${color}" ${attr}-opacity="${parseInt(alpha,16)/255}"`));
    images.push({ frame, file, state: { player: game.player.data.position, camera: { x: game.camera.x, y: game.camera.y },
        selected: game.routing.selected, supplied: game.routing.supplied, warning: game.routing.warning,
        aY: game.objects.get(G.liftAId)!.y, bY: game.objects.get(G.liftBId)!.y, checkpoint: game.store.save.checkpoint?.index, finished: game.finished } });
}
capture(0, samples.get(0)!);
let frame = 0, carriedA = 0, carriedB = 0;
for (const [count, keys] of recording.runs as Array<[number, string[]]>) {
    h.keys(keys);
    for (let n = 0; n < count; n++) {
        game.update(recording.stepMs); frame++;
        const p = game.player.data; assert.equal(p.isDead, false); assert.equal(p.hasHelmet, true);
        for (const id of [G.liftAId, G.liftBId]) {
            const b = game.objects.get(id)!;
            if (p.isGrounded && b.y !== b.py && Math.abs(p.position.y + p.height - b.y) < .001 && p.position.x >= b.x && p.position.x + p.width <= b.x + b.width)
                if (id === G.liftAId) carriedA++; else carriedB++;
        }
        if (samples.has(frame)) capture(frame, samples.get(frame)!);
    }
}
assert.equal(game.finished, true); assert.equal(frame, recording.frames);
const result = { kind: 'offline-native-engine-proof', browserQA: false, deviceQA: false, stepMs: recording.stepMs,
    frames: frame, recordedSeconds: frame / 60, carriedAFrames: carriedA, carriedBFrames: carriedB,
    finished: game.finished, campaignWrites: h.storageCalls, mapReturnHref: game.mapReturnHref, images };
writeFileSync(join(output, 'proof.json'), JSON.stringify(result, null, 2));
writeFileSync(join(output, 'index.html'), `<!doctype html><html lang="pt-BR"><meta charset="utf-8"><title>Pátio das Comportas · prova offline</title><style>body{margin:32px auto;max-width:1120px;padding:0 20px;background:#28262b;color:#efdcbd;font:16px system-ui}section{margin:32px 0}img{display:block;width:100%;max-width:960px;image-rendering:pixelated;border:1px solid #ad8b65}p{line-height:1.5}code{color:#9bcec9}</style><h1>Pátio das Comportas</h1><p>Prova offline da engine e do pintor Canvas reais. O replay usa Input, Player, WorldGame e WorldObjects de produção, com fronteiras de DOM/áudio simuladas. As imagens são serializações SVG dos comandos Canvas, incluindo sprites, câmera e controles de toque reais. Não são capturas de navegador, teste em dispositivo nem medição de FPS.</p><p>Resultado: ${frame} frames, duas sentadas, A carregou Feka por ${carriedA} frames e B por ${carriedB}. Sem dano, moedas ou corrida. Retorno: <code>${game.mapReturnHref}</code>.</p>${images.map(item => `<section><h2>${xml(item.file.replace('.svg',''))}</h2><img alt="Prova offline no frame ${item.frame}" src="${item.file}"></section>`).join('')}</html>`);
console.log(JSON.stringify({ ...result, images: images.map(i => i.file), output }, null, 2));
for (const cleanup of cleanups) cleanup();
