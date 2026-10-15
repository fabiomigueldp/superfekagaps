import assert from 'node:assert/strict';
import test from 'node:test';
import { clipMapActorDepth, decodeMapDepth, mapDepthOccludes, type MapDepthField } from '../src/adventure/WorldMapDepth';

const field = (values: Uint16Array): MapDepthField => ({ left: 0, top: 0, widthInMap: 1, heightInMap: 1,
    width: 8, height: 8, values, unitMeters: 1/256, uprightDepthPerImageHeight: 25 });

test('lossless R:G camera depth decodes exact metres and empty pixels', () => {
    const decoded = decodeMapDepth(new Uint8ClampedArray([100,128,0,255, 255,255,0,255, 0,0,0,0]),3,1);
    assert.deepEqual(Array.from(decoded!),[25728,65535,65535]);
    assert.equal(decoded![0]/256,100.5);
    assert.equal(decodeMapDepth(new Uint8ClampedArray(4),2,1),null);
    assert.equal(decodeMapDepth(new Uint8ClampedArray(),0,1),null);
});

test('a foreground rail occludes while paving contact, distant scenery and missing depth do not', () => {
    const f=field(new Uint16Array(64).fill(100*256));
    assert.equal(mapDepthOccludes(f,3,4,100.10),false);
    assert.equal(mapDepthOccludes(f,3,4,101),true);
    assert.equal(mapDepthOccludes(f,3,4,99),false);
    f.values[4*8+3]=65535;
    assert.equal(mapDepthOccludes(f,3,4,200),false);
    assert.equal(mapDepthOccludes(f,-1,4,200),false);
    assert.equal(mapDepthOccludes(f,8,4,200),false);
    assert.equal(mapDepthOccludes(f,3,4,NaN),false);
});

test('foreground clipping is local, retains the upright head and respects the shared camera', () => {
    const rectangles: number[][]=[];let rule='';
    const c={beginPath(){},rect(...args:number[]){rectangles.push(args)},clip(value:string){rule=value}} as unknown as CanvasRenderingContext2D;
    const f=field(new Uint16Array(64).fill(65535));
    // Same distance at head and foot: perspective makes the head closer,
    // so only the foreground strip below it may occlude the sprite.
    f.values[3*8+4]=97*256;f.values[5*8+4]=97*256;
    clipMapActorDepth(c,{width:80,height:80,center:{x:.5,y:.5},zoom:1},{x:.5,y:.75},1,{field:f,distance:100});
    assert.equal(rule,'evenodd');assert.deepEqual(rectangles[0],[0,0,80,80]);
    assert.equal(rectangles.length,2);
    assert.ok(rectangles[1][1]>40,'Only the rail by the feet enters the foreground clip.');
    rectangles.length=0;
    clipMapActorDepth(c,{width:80,height:80,center:{x:.5,y:.5},zoom:1},{x:.5,y:.75},1,{field:f,distance:NaN});
    assert.equal(rectangles.length,0);
});
