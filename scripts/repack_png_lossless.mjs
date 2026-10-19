// Authoring utility for Node.js 24 (the bundled runtime).
// Recompress only the PNG's zlib stream. Scanlines, filters, colour profile,
// palette, transparency and every non-IDAT chunk stay byte-for-byte intact.
import {readFileSync,writeFileSync} from 'node:fs';
import {inflateSync,deflateSync,crc32,constants} from 'node:zlib';
const write=process.argv.includes('--write');
for(const path of process.argv.slice(2).filter(p=>p!=='--write')){
    const source=readFileSync(path),chunks=[];
    if(source.subarray(0,8).toString('hex')!=='89504e470d0a1a0a')throw Error(`Not a PNG: ${path}`);
    for(let i=8;i<source.length;){
        const length=source.readUInt32BE(i),kind=source.toString('ascii',i+4,i+8);
        if(kind==='acTL')throw Error(`Animated PNG is outside this repacker: ${path}`);
        if(i+length+12>source.length)throw Error(`Truncated PNG: ${path}`);
        chunks.push({kind,bytes:source.subarray(i,i+length+12)});i+=length+12;
    }
    const compressed=Buffer.concat(chunks.filter(c=>c.kind==='IDAT').map(c=>c.bytes.subarray(8,-4)));
    const scanlines=inflateSync(compressed);
    const streams=[constants.Z_DEFAULT_STRATEGY,constants.Z_FILTERED].map(strategy=>deflateSync(scanlines,{level:9,strategy}));
    const best=streams.sort((a,b)=>a.length-b.length)[0];
    const chunk=Buffer.alloc(best.length+12);chunk.writeUInt32BE(best.length,0);chunk.write('IDAT',4);best.copy(chunk,8);
    chunk.writeUInt32BE(crc32(chunk.subarray(4,-4)),chunk.length-4);
    let inserted=false;
    const output=Buffer.concat([source.subarray(0,8),...chunks.flatMap(c=>{
        if(c.kind!=='IDAT')return [c.bytes];if(inserted)return [];inserted=true;return [chunk];
    })]);
    const saved=source.length-output.length;
    if(write&&saved>0)writeFileSync(path,output);
    console.log(JSON.stringify({path,before:source.length,after:output.length,saved,written:write&&saved>0}));
}
