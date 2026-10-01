import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
const source=fs.readFileSync(repo+'/src/assets/playerSpriteSpec.ts','utf8');
const atlas=fs.readFileSync(repo+'/src/adventure/WorldAtlasArt.ts','utf8');
// PixelGrid's dot and rect methods, reproduced exactly; hero below is read from real source.
class PixelGrid {
 constructor(width,height){this.width=width;this.height=height;this.cells=Array.from({length:height},()=>Array(width).fill('_'))}
 dot(x,y,color){x=Math.round(x);y=Math.round(y);if(x>=0&&y>=0&&x<this.width&&y<this.height)this.cells[y][x]=color;return this}
 rect(x,y,w,h,color){for(let yy=0;yy<h;yy++)for(let xx=0;xx<w;xx++)this.dot(x+xx,y+yy,color);return this}
 finish(){return this.cells.map(row=>row.join(''))}
}
const heroSource=source.slice(source.indexOf('function hero('),source.indexOf('\nconst helmet')).replace('function hero(pose: Pose, frame = 0): string[]','function hero(pose, frame = 0)');
const hero=new Function('PixelGrid',heroSource+'; return hero;')(PixelGrid);
const formula=atlas.match(/const FEKA_PIXEL_MAP_WIDTH = ([^;]+);/)[1];
if(!/^[0-9\s()+*/.]+$/.test(formula))throw Error('Unexpected atlas pixel formula');
console.log(JSON.stringify({source:'src/assets/playerSpriteSpec.ts; src/adventure/WorldAtlasArt.ts; src/adventure/WorldMapArt.ts',foot:[8,26],pixelMapWidth:Function('return '+formula)(),formula,frames:{idle:hero('idle'),...Object.fromEntries(Array.from({length:6},(_,i)=>['walk'+(i+1),hero('walk',i)]))}}));
