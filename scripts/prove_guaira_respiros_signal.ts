/** Offline, actual production-Canvas before/after proof; no browser or device QA.
 * node --import tsx scripts/prove_guaira_respiros_signal.ts OUTPUT CANVAS_MODULE BASELINE_ART
 * Uses an already installed @napi-rs/canvas; does not install or fetch anything.
 */
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { GuairaRespiros } from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import * as afterArt from '../src/adventure/experimental/guaira/respiros/GuairaRespirosArt';
import { jetCycle } from '../src/adventure/WorldMachineState';
import { guairaBrowser } from '../tests/helpers/guairaLabHarness';
import { pixelText } from '../src/graphics/BitmapFont';

interface NativeCanvas { width: number; height: number; getContext(type: '2d'): CanvasRenderingContext2D; toBuffer(type: 'image/png'): Buffer }
const [outputArg, canvasModuleArg, baselineArg] = process.argv.slice(2);
assert.ok(outputArg && canvasModuleArg && baselineArg, 'Provide output, installed Canvas module, and baseline art paths.');
const output = resolve(outputArg), baselinePath = resolve(baselineArg);
const { createCanvas } = await import(pathToFileURL(resolve(canvasModuleArg)).href) as { createCanvas(w: number, h: number): NativeCanvas };
const beforeArt = await import(pathToFileURL(baselinePath).href) as typeof afterArt;
mkdirSync(output, { recursive: true });
const cleanups: Array<() => void> = [], h = guairaBrowser({ after: fn => cleanups.push(fn as () => void) }, { touch: true });
const visible = createCanvas(640,360);
h.canvas.getContext = () => visible.getContext('2d');
const createElement = h.document.createElement;
h.document.createElement = tag => tag === 'canvas' ? createCanvas(1,1) as unknown as ReturnType<typeof createElement> : createElement(tag);
const game = new GuairaRespiros(h.canvas as unknown as HTMLCanvasElement, h.status as unknown as HTMLElement);
game.store.save.preferences.shake = false;
const samples = [
    { name: 'charging', time: 1600 }, { name: 'active', time: 2100 },
    { name: 'retracting', time: 2480 }, { name: 'dry', time: 2650 },
    { name: 'last-danger', time: 2499 }, { name: 'first-dry', time: 2499.5 },
    { name: 'rise-zero-height', time: 1800 }, { name: 'idle', time: 3000 },
];
const sheet = createCanvas(1280, samples.length * 202), sc = sheet.getContext('2d');
sc.imageSmoothingEnabled = false; sc.fillStyle = '#493c43'; sc.fillRect(0,0,sheet.width,sheet.height);
const overview = createCanvas(640,4*202), oc = overview.getContext('2d');
oc.imageSmoothingEnabled = false; oc.fillStyle = '#493c43'; oc.fillRect(0,0,overview.width,overview.height);
const records: Array<Record<string, unknown>> = [];
let changedPixels = 0;
for (const [row, sample] of samples.entries()) {
    const pixels: Uint8ClampedArray[] = [];
    for (const [version, art] of [['before', beforeArt], ['after', afterArt]] as const) for (const reduced of [false,true]) {
        game.art.background = (c,_island,cx,cy) => art.drawRespirosBackground(c,cx,cy,game.objects.time,reduced);
        game.art.terrain = (c,level,_island,cx,cy) => art.drawRespirosTerrain(c,level,cx,cy);
        game.art.objects = (c,objects,cx,cy) => art.drawRespirosObjects(c,objects,cx,cy,objects.time,reduced);
        game.renderer.setTouchControlsVisible(reduced);
        game.time = game.objects.time = sample.time;
        game.camera.x = 80; game.camera.y = 144;
        game.player.data.position.x = 128;
        const before = JSON.stringify({ objects: game.objects, player: game.player.data, camera: game.camera });
        game.render();
        assert.equal(JSON.stringify({ objects: game.objects, player: game.player.data, camera: game.camera }),before);
        const ctx = game.renderer.getContext(), native = ctx.canvas as unknown as NativeCanvas;
        assert.deepEqual([native.width,native.height],[320,180]);
        const data = native.toBuffer('image/png'), file = `${version}-${sample.name}-${reduced ? 'reduced-touch' : 'normal'}-native.png`;
        writeFileSync(join(output,file),data);
        pixels.push(ctx.getImageData(0,0,320,180).data);
        const column = (version === 'after' ? 2 : 0) + (reduced ? 1 : 0);
        pixelText(sc, `${version.toUpperCase()} / ${sample.name.toUpperCase()}`,column*320+4,row*202+3,'#f0d29a');
        pixelText(sc, reduced ? 'REDUCED + TOUCH' : 'NORMAL',column*320+4,row*202+12,'#f0d29a');
        sc.drawImage(native as unknown as CanvasImageSource,column*320,row*202+22);
        if (row<4 && !reduced) {
            const x=version==='after'?320:0;
            pixelText(oc,`${version.toUpperCase()} / ${sample.name.toUpperCase()}`,x+4,row*202+7,'#f0d29a');
            oc.drawImage(native as unknown as CanvasImageSource,x,row*202+22);
        }
        records.push({file,time:sample.time,reduced,touch:reduced,phase:jetCycle(game.objects.bodies[0],sample.time).phase,
            dangerHeight:jetCycle(game.objects.bodies[0],sample.time).height,sha256:createHash('sha256').update(data).digest('hex')});
    }
    for (const reduced of [false,true]) {
        const before = pixels[reduced ? 1 : 0], after = pixels[reduced ? 3 : 2];
        let changed = 0;
        for (let p=0;p<320*180;p++) {
            if ([0,1,2,3].every(ch => before[p*4+ch] === after[p*4+ch])) continue;
            changed++; const x=p%320,y=Math.floor(p/320);
            assert.ok(game.objects.bodies.some(body => x>=body.x-80-14 && x<body.x-80-1 && y>=96 && y<109),
                `Change outside the status plates: ${sample.name}, ${x},${y}`);
            assert.ok(!game.objects.bodies.some(body => {
                const d=jetCycle(body,sample.time).danger;
                return d && x>=d.x-80 && x<d.x+d.width-80 && y>=d.y-144 && y<d.y+d.height-144;
            }), 'Status plate must not obscure dangerous liquid');
        }
        assert.ok(changed>0); changedPixels+=changed;
    }
    // Crown pixels are identical with reduced motion and native fallback controls.
    for (let y=96;y<109;y++) for (let x=66;x<79;x++) for(let ch=0;ch<4;ch++)
        assert.equal(pixels[2][(y*320+x)*4+ch],pixels[3][(y*320+x)*4+ch]);
}
writeFileSync(join(output,'before-after-native-sheet.png'),sheet.toBuffer('image/png'));
writeFileSync(join(output,'before-after-native-four-states.png'),overview.toBuffer('image/png'));
const result={kind:'offline-production-canvas',browserQA:false,deviceQA:false,authoredPoses:true,nativeSize:'320x180',
    baselineSourceSha256:createHash('sha256').update(readFileSync(baselinePath)).digest('hex'),
    afterSourceSha256:createHash('sha256').update(readFileSync(resolve('src/adventure/experimental/guaira/respiros/GuairaRespirosArt.ts'))).digest('hex'),
    changedPixels,changesConfinedToPlates:true,waterNeverObscured:true,reducedMotionPlateParity:true,records};
writeFileSync(join(output,'proof.json'),JSON.stringify(result,null,2));
console.log(JSON.stringify({output,...result},null,2));
// The browser-boundary harness restores its globals; no animation loop started.
for (const cleanup of cleanups) cleanup();
