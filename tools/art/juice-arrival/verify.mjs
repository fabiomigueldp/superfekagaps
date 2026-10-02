import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const require = createRequire(process.env.PLAYWRIGHT_PACKAGE_JSON ?? new URL('../../../package.json', import.meta.url));
const { chromium } = require('playwright');
import fs from 'node:fs';
const out=fileURLToPath(new URL('../../../docs/world/experimental/juice-arrival', import.meta.url));
fs.mkdirSync(out, {recursive:true});
const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',headless:true,args:['--no-sandbox']});
const page=await browser.newPage({viewport:{width:1024,height:850}});
const errors=[];page.on('pageerror',e=>errors.push(e.message));
await page.route(/\.(png|webp|jpg|woff2?|mp3|wav)(\?|$)/,r=>r.abort());
await page.goto((process.env.PROOF_ORIGIN ?? 'http://127.0.0.1:3000') + '/tools/art/juice-arrival/');
await page.waitForFunction(()=>window.arrivalProof);
await page.screenshot({path:out+'/desktop.png',fullPage:true});
for (const status of ['open','closed','complete']){
 await page.getByRole('button',{name:({open:'Aberto',closed:'Fechado',complete:'Concluído'})[status],exact:true}).click();
 const data=await page.locator('#arrival').evaluate(c=>c.toDataURL().split(',')[1]);
 fs.writeFileSync(out+'/'+status+'-native.png',Buffer.from(data,'base64'));
}
await page.getByRole('button',{name:'Aberto',exact:true}).click();
const measurements=await page.evaluate(()=>{
 const {drawJuiceFactoryArrival:draw,drawJuiceArrivalAtPortal:adapt,portal,camera,supportTiles}=window.arrivalProof;
 const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');
 const a={doorX:160,floorY:160};draw(x,a);const baseline=c.toDataURL();
 x.clearRect(0,0,320,180);draw(x,a);const deterministic=c.toDataURL()===baseline;
 const pixels=x.getImageData(0,0,320,180).data;let count=0,minX=320,minY=180,maxX=0,maxY=0;
 for(let y=0;y<180;y++)for(let xx=0;xx<320;xx++)if(pixels[(y*320+xx)*4+3]){count++;minX=Math.min(minX,xx);maxX=Math.max(maxX,xx);minY=Math.min(minY,y);maxY=Math.max(maxY,y)}
 x.clearRect(0,0,320,180);draw(x,{doorX:NaN,floorY:160});const invalidBlank=!x.getImageData(0,0,320,180).data.some(v=>v);
 x.fillStyle='#123456';x.globalAlpha=.7;const before=x.getTransform();draw(x,a);const after=x.getTransform();const statePreserved=x.fillStyle==='#123456'&&x.globalAlpha===.7&&before.e===after.e&&before.f===after.f;
 x.globalAlpha=1;x.clearRect(0,0,320,180);adapt(x,portal,camera);const adapted=c.toDataURL();
 x.clearRect(0,0,320,180);draw(x,{doorX:188,floorY:160});const adapterMatches=adapted===c.toDataURL();
 const supportSolid=supportTiles.length===16&&supportTiles.every(tile=>tile===supportTiles[0]&&tile!==0);
 const batches=[];for(let batch=0;batch<30;batch++){const start=performance.now();for(let i=0;i<100;i++)draw(x,a);batches.push((performance.now()-start)/100)}batches.sort((a,b)=>a-b);
 return {deterministic,invalidBlank,statePreserved,adapterMatches,supportSolid,opaquePixels:count,bounds:{minX,minY,maxX,maxY},drawCpuMs:{median:batches[15],p95:batches[28]},overlay:!!document.querySelector('vite-error-overlay'),buttons:document.querySelectorAll('button').length};
});
await page.setViewportSize({width:390,height:844});await page.emulateMedia({reducedMotion:'reduce'});
await page.screenshot({path:out+'/mobile-reduced-motion.png',fullPage:true});
measurements.mobile=await page.evaluate(()=>({overflow:document.documentElement.scrollWidth>innerWidth,canvas:document.querySelector('canvas').getBoundingClientRect().toJSON(),reducedMotion:matchMedia('(prefers-reduced-motion: reduce)').matches}));
measurements.errors=errors;measurements.externalTexturesBlocked=true;
fs.writeFileSync(out+'/validation.json',JSON.stringify(measurements,null,2));
console.log(JSON.stringify(measurements,null,2));await browser.close();
if(errors.length||!measurements.deterministic||!measurements.invalidBlank||!measurements.statePreserved||!measurements.adapterMatches||!measurements.supportSolid||measurements.mobile.overflow||measurements.overlay)process.exit(1);
