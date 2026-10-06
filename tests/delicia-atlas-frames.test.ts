import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {atlasFrames,drawAtlasSprite} from '../src/adventure/delicia/DeliciaSpriteFrames';

type CanvasBackend={
 createCanvas:(width:number,height:number)=>HTMLCanvasElement;
 loadImage:(path:string)=>Promise<HTMLImageElement>;
};
const require=createRequire(import.meta.url);
let nativeCanvasPath:string|undefined;
try{nativeCanvasPath=require.resolve('@napi-rs/canvas');}
catch(error){if((error as NodeJS.ErrnoException).code!=='MODULE_NOT_FOUND')throw error;}
const nativeCanvas:CanvasBackend|undefined=nativeCanvasPath?require(nativeCanvasPath):undefined;

async function withCanvas(create:()=>HTMLCanvasElement,run:(counts:{canvases:number;width:number;height:number;draws:number;readbacks:number})=>void|Promise<void>){
 const previous=Object.getOwnPropertyDescriptor(globalThis,'document');
 const counts={canvases:0,width:0,height:0,draws:0,readbacks:0};
 Object.defineProperty(globalThis,'document',{configurable:true,value:{createElement(tag:string){
  assert.equal(tag,'canvas');counts.canvases++;
  const canvas=create();
  return {
   get width(){counts.width++;return canvas.width;},set width(value:number){canvas.width=value;},
   get height(){counts.height++;return canvas.height;},set height(value:number){canvas.height=value;},
   getContext(kind:string,options:CanvasRenderingContext2DSettings){
    assert.equal(kind,'2d');assert.deepEqual(options,{willReadFrequently:true});
    const context=canvas.getContext('2d',options) as CanvasRenderingContext2D;
    return {
     drawImage(image:HTMLImageElement,x:number,y:number){counts.draws++;context.drawImage(image,x,y);},
     getImageData(x:number,y:number,width:number,height:number){
      counts.readbacks++;
      assert.deepEqual([x,y,width,height],[0,0,canvas.width,canvas.height]);
      return context.getImageData(x,y,width,height);
     },
    };
   },
  };
 }}});
 try{await run(counts);}finally{
  if(previous)Object.defineProperty(globalThis,'document',previous);
  else Reflect.deleteProperty(globalThis,'document');
 }
}

test('atlas scan preserves alpha threshold, rounded cells, empty fallback, drawing and cache keys with constant dimension reads',async()=>{
 const data=new Uint8ClampedArray(7*5*4);
 const alpha=(x:number,y:number,value:number)=>{data[(y*7+x)*4+3]=value;};
 alpha(0,0,32);alpha(1,1,33); // 32 remains transparent; 33 determines the first crop.
 alpha(2,0,255);alpha(4,2,255); // Both corners of the odd-width middle cell.
 alpha(6,4,255);
 const image={naturalWidth:7,naturalHeight:5} as HTMLImageElement;
 const context={
  drawImage(source:HTMLImageElement,x:number,y:number){assert.strictEqual(source,image);assert.deepEqual([x,y],[0,0]);},
  getImageData(){return {data};},
 };
 await withCanvas(()=>({width:0,height:0,getContext:()=>context}) as unknown as HTMLCanvasElement,counts=>{
  const frames=atlasFrames(image,3,2);
  assert.deepEqual(frames,[
   {x:1,y:1,w:1,h:1},{x:2,y:0,w:3,h:3},{x:5,y:0,w:2,h:3},
   {x:0,y:3,w:2,h:2},{x:2,y:3,w:3,h:2},{x:6,y:4,w:1,h:1},
  ]);
  const whole=atlasFrames(image,1,1);
  assert.deepEqual(whole,[{x:1,y:0,w:6,h:5}]);assert.notStrictEqual(whole,frames);
  assert.strictEqual(atlasFrames(image,3,2),frames);assert.strictEqual(atlasFrames(image,1,1),whole);
  const draws:unknown[][]=[];
  drawAtlasSprite({drawImage:(...args:unknown[])=>draws.push(args)} as unknown as CanvasRenderingContext2D,image,1,3,2,100,90,60,30);
  assert.deepEqual(draws,[[image,2,0,3,3,85,60,30,30]]);
  assert.deepEqual(counts,{canvases:2,width:2,height:2,draws:2,readbacks:2});
 });
});

test('native shipped atlases retain all 15 crops and cache identities with one dimension read per canvas',
 {skip:nativeCanvas?false:'Optional @napi-rs/canvas is not installed'},async()=>{
  const native=nativeCanvas!;
  const props=await native.loadImage(fileURLToPath(new URL('../public/assets/delicia/props.webp',import.meta.url)));
  const landmarks=await native.loadImage(fileURLToPath(new URL('../public/assets/delicia/landmarks-v2.webp',import.meta.url)));
  // Captured from the unmodified resolver at 20feb1d; keep exact pixel bounds.
  const expectedProps=[[40,147,447,307],[537,194,462,239],[1039,173,446,277],[57,713,427,169],[585,560,365,343],[1066,608,411,300]];
  const expectedLandmarks=[[25,113,358,283],[459,16,275,382],[812,161,391,235],[31,583,336,250],[432,483,336,345],[819,450,389,380],[24,933,360,307],[485,857,213,385],[786,874,417,375]];
  const rects=(values:number[][])=>values.map(([x,y,w,h])=>({x,y,w,h}));
  await withCanvas(()=>native.createCanvas(1,1),counts=>{
   const propFrames=atlasFrames(props,3,2),landmarkFrames=atlasFrames(landmarks,3,3,'landmarks-v5');
   assert.deepEqual(propFrames,rects(expectedProps));assert.deepEqual(landmarkFrames,rects(expectedLandmarks));
   assert.strictEqual(atlasFrames(props,3,2),propFrames);
   assert.strictEqual(atlasFrames(landmarks,3,3,'landmarks-v5'),landmarkFrames);
   assert.deepEqual(counts,{canvases:2,width:2,height:2,draws:2,readbacks:2});
   // The same image's grid layout remains a separate entry from its authored regions.
   const gridFrames=atlasFrames(landmarks,3,3);
   assert.notStrictEqual(gridFrames,landmarkFrames);
   assert.strictEqual(atlasFrames(landmarks,3,3),gridFrames);
   assert.strictEqual(atlasFrames(landmarks,3,3,'landmarks-v5'),landmarkFrames);
   assert.deepEqual(counts,{canvases:3,width:3,height:3,draws:3,readbacks:3});
  });
 });
