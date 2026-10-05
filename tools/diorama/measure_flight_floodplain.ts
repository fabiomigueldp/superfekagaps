/** Optional native-Canvas QA, not a browser FPS claim or shipped dependency.
 * Usage: node --import tsx tools/diorama/measure_flight_floodplain.ts [baseline-module]
 * FEKA_CANVAS_MODULE can point to a locally installed @napi-rs/canvas package. */
import { createRequire } from 'node:module';
import { performance } from 'node:perf_hooks';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { paintFlightLandscape } from '../../src/adventure/WorldFlightScenery';
import type { MapCamera } from '../../src/adventure/WorldMapModel';

const require=createRequire(import.meta.url);
const { createCanvas }=require(process.env.FEKA_CANVAS_MODULE || '@napi-rs/canvas');
type Painter=typeof paintFlightLandscape;
const canvas=createCanvas(960,540), ctx=canvas.getContext('2d');
const cameras:MapCamera[]=[
    {center:{x:3.5,y:.5},width:960,height:540,zoom:.9},
    {center:{x:3.7,y:.6},width:960,height:540,zoom:.52},
];
function measure(paint:Painter) {
    const counts:Record<string,number>={};
    const count=(key:string)=>{counts[key]=(counts[key]||0)+1;};
    const recorder=new Proxy({}, {
        get:(_target,key)=>(..._args:unknown[])=>{
            count(String(key));
            if(key==='createLinearGradient') return {addColorStop(){count('addColorStop');}};
        },
        set:(_target,key,_value)=>{count(String(key));return true;},
    }) as CanvasRenderingContext2D;
    paint(recorder,cameras[0]);
    const milliseconds=cameras.map(camera=>{
        for(let i=0;i<30;i++) paint(ctx,camera);
        const batches=[];
        for(let batch=0;batch<5;batch++) {
            const start=performance.now();
            for(let i=0;i<100;i++) {ctx.clearRect(0,0,960,540);paint(ctx,camera);}
            batches.push((performance.now()-start)/100);
        }
        return Number(batches.sort((a,b)=>a-b)[2].toFixed(3));
    });
    return { calls:Object.values(counts).reduce((sum,n)=>sum+n,0), fills:counts.fill,
        gradients:counts.createLinearGradient, nativeRasterMedianMs:{normal:milliseconds[0],reduced:milliseconds[1]} };
}
const result:Record<string,unknown>={current:measure(paintFlightLandscape)};
if(process.argv[2]) {
    const baseline=await import(pathToFileURL(resolve(process.argv[2])).href);
    result.baseline=measure(baseline.paintFlightLandscape);
}
console.log(JSON.stringify(result,null,2));
