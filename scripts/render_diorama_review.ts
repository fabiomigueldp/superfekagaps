/** Offline visual check of the production Canvas painter. No browser or local server.
 * The caption/UI overlay is an SVG facsimile for composition review, not a browser screenshot.
 * Run: node --import tsx scripts/render_diorama_review.ts; inkscape docs/world/diorama/costa-review.svg -o docs/world/diorama/costa-review.png
 */
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { paintWorldMap, frameMapPins, mapActorScale, parseMapMetadata } from '../src/adventure/WorldMapArt';
import { getMapCamera, mapToScreen } from '../src/adventure/WorldMapModel';
import { ISLANDS, STAGES } from '../src/adventure/campaign';

const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
class Gradient {
    readonly stops: string[] = [];
    constructor(readonly id: string, readonly type: string, readonly dimensions: string) {}
    addColorStop(offset: number, color: string) { this.stops.push(`<stop offset="${offset}" stop-color="${color}"/>`); }
    toString() { return `url(#${this.id})`; }
    svg() { return `<${this.type} id="${this.id}" gradientUnits="userSpaceOnUse" ${this.dimensions}>${this.stops.join('')}</${this.type}>`; }
}
class SvgCanvas {
    fillStyle: string | Gradient = '#000'; strokeStyle: string | Gradient = '#000'; globalAlpha = 1; lineWidth = 1;
    lineCap = 'butt'; font = '12px sans-serif'; textAlign = 'left'; textBaseline = 'alphabetic'; shadowColor = ''; shadowBlur = 0;
    private transform = ''; private dash: number[] = []; private path = '';
    private stack: Array<Record<string, unknown>> = [];
    readonly pieces: string[] = []; readonly gradients: Gradient[] = [];
    clearRect() { this.pieces.length = 0; }
    createLinearGradient(x1: number, y1: number, x2: number, y2: number) { const g = new Gradient(`g${this.gradients.length}`, 'linearGradient', `x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"`); this.gradients.push(g); return g; }
    createRadialGradient(x1: number, y1: number, _r1: number, x2: number, y2: number, r2: number) { const g = new Gradient(`g${this.gradients.length}`, 'radialGradient', `fx="${x1}" fy="${y1}" cx="${x2}" cy="${y2}" r="${r2}"`); this.gradients.push(g); return g; }
    private attrs(stroke = false) { return `transform="${this.transform}" opacity="${this.globalAlpha}" fill="${stroke ? 'none' : this.fillStyle}"${stroke ? ` stroke="${this.strokeStyle}" stroke-width="${this.lineWidth}" stroke-linecap="${this.lineCap}" stroke-linejoin="round" stroke-dasharray="${this.dash.join(' ')}"` : ''}`; }
    save() { const copy: Record<string, unknown> = {}; for (const k of ['fillStyle', 'strokeStyle', 'globalAlpha', 'lineWidth', 'lineCap', 'font', 'textAlign', 'textBaseline', 'transform', 'dash']) copy[k] = (this as unknown as Record<string, unknown>)[k]; this.stack.push(copy); }
    restore() { Object.assign(this, this.stack.pop()); }
    translate(x: number, y: number) { this.transform += ` translate(${x} ${y})`; }
    scale(x: number, y: number) { this.transform += ` scale(${x} ${y})`; }
    setLineDash(dash: number[]) { this.dash = dash; }
    beginPath() { this.path = ''; }
    moveTo(x: number, y: number) { this.path += `M ${x} ${y} `; }
    lineTo(x: number, y: number) { this.path += `L ${x} ${y} `; }
    quadraticCurveTo(x: number, y: number, a: number, b: number) { this.path += `Q ${x} ${y} ${a} ${b} `; }
    closePath() { this.path += 'Z '; }
    ellipse(x: number, y: number, rx: number, ry: number) { this.path += `M ${x-rx} ${y} a ${rx} ${ry} 0 1 0 ${rx*2} 0 a ${rx} ${ry} 0 1 0 ${-rx*2} 0 `; }
    arc(x: number, y: number, r: number) { this.ellipse(x, y, r, r); }
    fill() { this.pieces.push(`<path d="${this.path}" ${this.attrs()}/>`); }
    stroke() { this.pieces.push(`<path d="${this.path}" ${this.attrs(true)}/>`); }
    fillRect(x: number, y: number, w: number, h: number) { this.pieces.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${this.attrs()}/>`); }
    fillText(text: string, x: number, y: number) { this.pieces.push(`<text x="${x}" y="${y}" style="font:${this.font}" text-anchor="${this.textAlign === 'center' ? 'middle' : 'start'}" dominant-baseline="${this.textBaseline === 'middle' ? 'central' : 'auto'}" ${this.attrs()}>${escape(text)}</text>`); }
    drawImage(img: { src: string }, x: number, y: number, w: number, h: number) { this.pieces.push(`<image href="${img.src}" x="${x}" y="${y}" width="${w}" height="${h}" ${this.attrs()}/>`); }
}
const root = 'public/assets/world/map/';
const asset = (file: string) => existsSync(root + file) ? { src: `data:image/${file.endsWith('webp') ? 'webp' : 'png'};base64,${readFileSync(root + file).toString('base64')}` } as unknown as CanvasImageSource : null;
const metadata = parseMapMetadata(JSON.parse(readFileSync(root + 'costa-diorama.meta.json', 'utf8')))!;
const image = asset('costa-diorama.webp');
const output = 'docs/world/diorama'; mkdirSync(output, { recursive: true });
const text = (x: number, y: number, value: string, size: number, color: string, extra = '') => `<text x="${x}" y="${y}" fill="${color}" font-size="${size}" font-family="Arial,sans-serif" ${extra}>${escape(value)}</text>`;
const cases = [{ name: 'costa-review', w: 1440, h: 900, footer: 202, selected: 0, secret: false }, { name: 'costa-secret-review', w: 1440, h: 900, footer: 202, selected: 4, secret: true }, { name: 'costa-mobile-review', w: 390, h: 844, footer: 259, selected: 0, secret: false }];
for (const v of cases) {
    const c = new SvgCanvas(), sceneH = v.h - v.footer;
    let camera = getMapCamera(v.selected, { overview: false }, v.w, sceneH), focus = metadata.nodes[`1-${v.selected + 1}`];
    const fitHeight = Math.min(v.w / 1.6, sceneH); camera.zoom = v.w < 600 ? Math.min(1.25, Math.max(.45, (sceneH - 140) / (fitHeight * .93))) : 1.04;
    camera.center = { x: .5 + (focus.x - .5) * .12, y: .52 + (focus.y - .52) * .035 - (v.w < 600 ? 60 / (fitHeight * camera.zoom) : 0) };
    camera = frameMapPins(camera, Object.fromEntries(Object.entries(metadata.nodes).map(([id, p]) => [Number(id.split('-')[1]) - 1, p])), v.selected, v.w < 600);
    const start = performance.now();
    paintWorldMap(c as unknown as CanvasRenderingContext2D, { camera, world: 1, time: 4000, reducedMotion: false, metadata,
        assets: { island: image, shadow: asset('costa-shadow.webp'), port: asset('porto-distant.webp') }, secret: v.secret, completed: v.secret ? ['1-1', '1-2', '1-3'] : [], marker: focus, walking: false, facingLeft: false });
    const paintMs = performance.now() - start;
    const ui: string[] = [], mobile = v.w < 600;
    for (let n = 0; n < 5; n++) {
        const q = mapToScreen(metadata.nodes[`1-${n + 1}`], camera), selected = v.selected === n; if (selected) q.y -= mapActorScale(camera) * 26 + 4;
        ui.push(`<path d="M ${q.x-6} ${q.y-15} L ${q.x} ${q.y-4} L ${q.x+6} ${q.y-15}" fill="#dfbd7c"/><circle cx="${q.x}" cy="${q.y-(mobile ? 31 : 34)}" r="${mobile ? 16 : 21}" fill="${selected ? '#f5d586' : '#435e66'}" stroke="${selected ? '#fff0b3' : '#b7bca1'}" stroke-width="3"/>`, text(q.x, q.y - (mobile ? 26 : 28), String(n + 1), mobile ? 14 : 17, selected ? '#244453' : '#e7ecdb', 'text-anchor="middle" font-weight="bold"'));
    }
    ui.push(text(mobile ? 22 : 40, mobile ? 29 : 44, 'SUPER FEKA GAPS  /  WORLD', mobile ? 7 : 10, '#c4deda', 'letter-spacing="2.7" font-weight="bold"'), text(mobile ? 22 : 40, mobile ? 69 : 93, 'ARQUIPÉLAGO  /  ILHA 01', mobile ? 8 : 10, '#add9d3', 'letter-spacing="3"'), `<text x="${mobile ? 22 : 40}" y="${mobile ? 107 : 145}" fill="#fff4da" font-size="${mobile ? 31 : 49}" font-family="Georgia,serif" font-weight="bold" letter-spacing="-1.8">Costa dos Gaps</text>`);
    if (!mobile) ui.push(text(40, 176, 'Toda grande aventura começa com um gap.', 14, '#c0ddd5', 'font-style="italic"'));
    ui.push(text(v.w - (mobile ? 26 : 270), mobile ? 32 : 47, '↗ Ver panorama', mobile ? 10 : 12, '#eee8d0', mobile ? 'text-anchor="end"' : ''), text(v.w - 27, mobile ? 73 : 47, '0/30 fases · ✦ 0/72 selos', mobile ? 9 : 12, '#fae5ae', 'text-anchor="end"'));
    ui.push(`<rect y="${sceneH}" width="${v.w}" height="${v.footer}" fill="#142e40"/>`);
    const x = mobile ? 20 : 40;
    ui.push(text(x, sceneH + 30, `1-${v.selected+1}  ·  ${v.selected ? 'O GRANDE ENCONTRO' : 'A CHEGADA'}`, 10, '#c5d1ba', 'letter-spacing="1.6"'), `<text x="${x}" y="${sceneH+59}" fill="#fff0d5" font-family="Georgia,serif" font-size="${mobile ? 23 : 25}">${STAGES[v.selected].name}</text>`);
    if (mobile) ui.push(text(x, sceneH + 78, 'O primeiro passo de uma grande viagem.', 11, '#a9c4c4'), text(x, sceneH + 93, 'A praia guarda mais do que parece.', 11, '#a9c4c4'));
    else ui.push(text(x, sceneH + 82, v.selected ? 'Joãozão está na ponte. É aqui que a travessia fica pessoal.' : 'O primeiro passo de uma grande viagem. A praia guarda mais do que parece.', 12, '#a9c4c4'));
    const bx = v.w - (mobile ? 163 : 230), by = sceneH + (mobile ? 110 : 44);
    ui.push(`<rect x="${bx}" y="${by}" width="${mobile ? 143 : 190}" height="43" rx="9" fill="#f5d586" stroke="#ffe6a4"/>`, text(bx + (mobile ? 71.5 : 95), by + 27, 'Jogar fase  →', 13, '#253c4a', 'text-anchor="middle" font-weight="bold"'));
    if (v.secret) ui.push(text(v.w - 40, sceneH + 25, '✦ Atalho 3 → 5 descoberto', 11, '#dcb6f3', 'text-anchor="end"'));
    const gap = mobile ? 5 : 8, margin = mobile ? 14 : 32, cols = mobile ? 3 : 6, cw = (v.w - margin*2 - gap*(cols-1))/cols, y0 = sceneH + (mobile ? 174 : 125);
    ISLANDS.forEach((island,i)=>{ const ix=margin+(i%cols)*(cw+gap), iy=y0+Math.floor(i/cols)*39; ui.push(`<rect x="${ix}" y="${iy}" width="${cw}" height="34" rx="6" fill="${i===0?'#2a4953':'#1b394b'}" stroke="${i===0?'#d9bd79':'#1b394b'}"/>`,text(ix+9,iy+21,`${i+1}   ${island.name}`,mobile?8:10,i===0?'#fbe5b8':'#94aeb5')); });
    if (!mobile) ui.push(text(v.w/2,v.h-10,'← → fases   ·   ↑ ↓ ilhas   ·   Enter jogar   ·   Esc menu',9,'#6f939f','text-anchor="middle" letter-spacing="1"'));
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${v.w}" height="${v.h}" viewBox="0 0 ${v.w} ${v.h}"><defs>${c.gradients.map(g=>g.svg()).join('')}<clipPath id="scene"><rect width="${v.w}" height="${sceneH}"/></clipPath></defs><g clip-path="url(#scene)">${c.pieces.join('')}</g>${ui.join('')}</svg>`;
    writeFileSync(`${output}/${v.name}.svg`, svg.replace(/(fill|stroke|stop-color)="(#[a-fA-F0-9]{6})([a-fA-F0-9]{2})"/g, (_match, attr, color, alpha) => `${attr}="${color}" ${attr === 'stop-color' ? 'stop' : attr}-opacity="${parseInt(alpha,16)/255}"`));
    console.log(JSON.stringify({ case: v.name, commands: c.pieces.length, serializationMs: Math.round(paintMs*100)/100, note: 'SVG command serialization only, not browser raster cost or FPS' }));
}
