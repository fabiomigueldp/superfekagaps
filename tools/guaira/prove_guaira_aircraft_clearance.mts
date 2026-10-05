/** Full-sequence Guaíra aircraft corridor proof at 60 Hz.
 * Uses actual runtime motion, projection, background and aircraft painters.
 * Native Canvas only; no browser, DOM-layout or device coverage.
 * node --import tsx tools/guaira/prove_guaira_aircraft_clearance.mts OUTPUT REPOSITORY
 * WATER_CANVAS_MODULE can point to an existing @napi-rs/canvas installation.
 */
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const repo=process.argv[3] ?? process.cwd(), out=process.argv[2] ?? '/tmp/guaira-aircraft-clearance';
mkdirSync(out,{recursive:true});
const width=Number(process.env.PROOF_WIDTH ?? 960),height=Number(process.env.PROOF_HEIGHT ?? 540);
const {createCanvas,Image}=createRequire(import.meta.url)(process.env.WATER_CANVAS_MODULE ?? '@napi-rs/canvas');
const {campaignAircraftRoute,campaignAircraftScale}=await import(`${repo}/src/adventure/WorldAircraftTerminalRoute.ts`);
const {sampleAircraftTravel}=await import(`${repo}/src/adventure/WorldAircraftModel.ts`);
const {sampleAircraftCamera}=await import(`${repo}/src/adventure/WorldAircraftCamera.ts`);
const {paintAircraftTravel,aircraftFrameForHeading}=await import(`${repo}/src/adventure/WorldAircraftArt.ts`);
const {paintCampaignRegion,GUAIRA_CAMPAIGN_ART}=await import(`${repo}/src/adventure/GuairaCampaignArt.ts`);
const {localToAtlas,WORLD_ATLAS_PLACEMENTS}=await import(`${repo}/src/adventure/WorldAtlasModel.ts`);
const {mapToScreen}=await import(`${repo}/src/adventure/WorldMapModel.ts`);
const {paintFlightLandscape,paintFlightAtmosphere}=await import(`${repo}/src/adventure/WorldFlightScenery.ts`);
const load=async path=>{const img=new Image();await new Promise((ok,fail)=>{img.onload=ok;img.onerror=fail;img.src=readFileSync(`${repo}/public${path}`)});return img;};
const assets={image:await load('/assets/world/map/journey-aircraft.webp'),metadata:JSON.parse(readFileSync(`${repo}/public/assets/world/map/journey-aircraft.meta.json`,'utf8'))};
const images=new Map(),bases=new Map();for(const region of ['guaira','fabrica','serra']){images.set(region,await load(`/assets/world/map/guaira-campaign/${region}.webp`));if(region!=='guaira')bases.set(region,await load(`/assets/world/map/${region}-diorama.webp`));}
const records=[];
for(const [source,dest] of [['guaira','serra'],['guaira','fabrica'],['serra','guaira'],['fabrica','guaira']]){
 const route=campaignAircraftRoute(source,dest), leaving=source==='guaira';
 const times=Array.from({length:445},(_,i)=>i/60);
 const directory=`${out}/${source}-${dest}`;mkdirSync(directory,{recursive:true});
 const selected=new Set((leaving?[0,1.35,2.1,2.6,3.1,3.6,4.1,4.35,4.6,4.85,5.1,6.1]:[0,2.1,3.1,3.35,3.6,3.85,4.1,5.1,5.6,6.1,6.9,7.4]).map(t=>Math.round(t*60)));let tile=0;
 const sheet=createCanvas(1440,960), sh=sheet.getContext('2d');
 // Reuse one native surface per leg so long proofs have bounded memory.
 const canvas=createCanvas(width,height),c=canvas.getContext('2d');
 for(const [i,elapsed] of times.entries()){
  const pose=sampleAircraftTravel(route,elapsed,false);pose.scale=campaignAircraftScale(source,dest,pose.progress);
  const camera=sampleAircraftCamera(route,elapsed,{width,height,reducedMotion:false,departureFocus:localToAtlas({x:.5,y:.5},GUAIRA_CAMPAIGN_ART[source].placement),arrivalFocus:localToAtlas({x:.5,y:.5},GUAIRA_CAMPAIGN_ART[dest].placement)});
  const sea=c.createLinearGradient(0,0,0,height);sea.addColorStop(0,'#477f91');sea.addColorStop(1,'#75aeb1');c.fillStyle=sea;c.fillRect(0,0,width,height);paintFlightLandscape(c,camera);
  for(const region of [source,dest]){const base=bases.get(region);if(base&&!(GUAIRA_CAMPAIGN_ART[region].replacesBase&&images.has(region))){const pl=WORLD_ATLAS_PLACEMENTS[region==='fabrica'?3:4];const a=mapToScreen(pl.origin,camera),b=mapToScreen({x:pl.origin.x+1,y:pl.origin.y+1},camera);c.drawImage(base,a.x,a.y,b.x-a.x,b.y-a.y);}paintCampaignRegion(c,camera,region,images.get(region),true);}
  paintFlightAtmosphere(c,camera,pose);paintAircraftTravel(c,camera,pose,assets,elapsed);writeFileSync(`${directory}/${String(i).padStart(3,'0')}.png`,canvas.toBuffer('image/png'));
  if(selected.has(i)){
   const g=mapToScreen(pose.ground,camera), sx=Math.min(width-320,Math.max(0,g.x-160)),sy=Math.min(height-240,Math.max(0,g.y-160));
   const x=tile%4*360,y=Math.floor(tile/4)*320;tile++;
   sh.drawImage(canvas,sx,sy,320,240,x,y+22,360,270);sh.fillStyle='#172833';sh.fillRect(x,y,360,22);sh.fillStyle='#ffffff';sh.font='15px sans-serif';sh.fillText(`${source} → ${dest} ${elapsed.toFixed(2)}s: ${pose.stage}`,x+4,y+16);
  }
  records.push({source,destination:dest,elapsed,pose,frame:aircraftFrameForHeading(assets.metadata,pose.heading).index,camera});
 }
 writeFileSync(`${out}/${source}-${dest}-sheet.png`,sheet.toBuffer('image/png'));
}
const inputFiles = [
 'src/adventure/WorldAircraftModel.ts', 'src/adventure/WorldAircraftTerminalRoute.ts', 'src/adventure/GuairaCampaignArt.ts',
 'src/adventure/WorldAircraftCamera.ts', 'src/adventure/WorldAircraftArt.ts', 'src/adventure/WorldAtlasModel.ts',
 'src/adventure/WorldMapModel.ts', 'src/adventure/WorldMapArt.ts', 'src/adventure/WorldFlightScenery.ts', 'src/adventure/GuairaCampaignWaterData.json',
 'public/assets/world/map/journey-aircraft.webp', 'public/assets/world/map/journey-aircraft.meta.json',
 'public/assets/world/map/fabrica-diorama.webp', 'public/assets/world/map/serra-diorama.webp',
 ...['guaira', 'fabrica', 'serra'].flatMap(region => ['webp', 'meta.json'].map(ext => `public/assets/world/map/guaira-campaign/${region}.${ext}`)),
 'public/assets/world/map/guaira-campaign/guaira-water-restored.webp',
];
const inputs=Object.fromEntries(inputFiles.map(path=>[path,createHash('sha256').update(readFileSync(`${repo}/${path}`)).digest('hex')]));
writeFileSync(`${out}/poses.json`,JSON.stringify(records.map(({source,destination,elapsed,frame,pose})=>({source,destination,elapsed,frame,pose}))));
writeFileSync(`${out}/native-frame-report.json`,JSON.stringify({width,height,inputs,method:'Actual candidate runtime motion, camera, scale and flight painters, 4 full sequences at 60 Hz; native Canvas, no browser or device QA.',records},null,2));
console.log(JSON.stringify({frames:records.length,out}));
