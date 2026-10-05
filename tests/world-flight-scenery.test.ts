import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHT_BANKS, paintFlightLandscape, paintFlightAtmosphere } from '../src/adventure/WorldFlightScenery';
import { sampleAircraftTravel,createAircraftRoute } from '../src/adventure/WorldAircraftModel';
const camera={center:{x:3.5,y:.3},width:960,height:540,zoom:1.22};
function recorder() {
    const calls: unknown[][]=[];
    const ctx=new Proxy({},{get:(_target,key)=> (...args: unknown[])=> {
        calls.push([key,...args]);
        if(key==='createRadialGradient'||key==='createLinearGradient')return {addColorStop:(...stops: unknown[])=>{calls.push(['addColorStop',...stops]);}};
    },set:(_target,key,value)=>{calls.push([key,typeof value==='object'?'gradient':value]);return true;}}) as CanvasRenderingContext2D;
    return {ctx,calls};
}
test('fixed finite geography is deterministic and independent of trip direction or elapsed clock',()=>{
    const a=recorder(),b=recorder();paintFlightLandscape(a.ctx,camera);paintFlightLandscape(b.ctx,camera);
    assert.deepEqual(a.calls,b.calls);
    assert.ok(FLIGHT_BANKS.flat().every(p=>p.every(Number.isFinite)));
    assert.ok(a.calls.length<1200,'bounded landscape work including rounded shores, relief and batched foliage');
    assert.equal(a.calls.filter(c=>c[0]==='save').length,a.calls.filter(c=>c[0]==='restore').length);
});
test('bank lighting and water contact stay attached to atlas geography as the camera pans',()=>{
    const a=recorder(),b=recorder();paintFlightLandscape(a.ctx,camera);
    const moved={...camera,center:{x:camera.center.x+.2,y:camera.center.y-.1}};
    paintFlightLandscape(b.ctx,moved);
    const gradients=(calls:unknown[][])=>calls.filter(c=>c[0]==='createLinearGradient');
    assert.equal(gradients(a.calls).length,FLIGHT_BANKS.length);
    const scale=Math.min(camera.width/1.6,camera.height)*camera.zoom;
    for(const [i,gradient] of gradients(a.calls).entries()){
        const next=gradients(b.calls)[i];
        assert.ok(Math.abs(Number(next[1])-Number(gradient[1])+.2*scale*1.6)<1e-8);
        assert.ok(Math.abs(Number(next[2])-Number(gradient[2])-.1*scale)<1e-8);
        assert.ok(Math.abs(Number(next[3])-Number(gradient[3])+.2*scale*1.6)<1e-8);
        assert.ok(Math.abs(Number(next[4])-Number(gradient[4])-.1*scale)<1e-8);
    }
    assert.deepEqual(a.calls.filter(c=>c[0]==='addColorStop'),b.calls.filter(c=>c[0]==='addColorStop'),'sunlight does not rotate or vary with travel direction');
});
test('shoreline relief and shallows scale with the world instead of becoming a thick reduced-motion outline',()=>{
    const a=recorder(),b=recorder();paintFlightLandscape(a.ctx,camera);
    paintFlightLandscape(b.ctx,{...camera,zoom:camera.zoom*.4});
    const widths=(calls:unknown[][])=>calls.filter(c=>c[0]==='lineWidth').slice(0,FLIGHT_BANKS.length*2).map(c=>Number(c[1]));
    widths(a.calls).forEach((width,i)=>assert.ok(Math.abs(widths(b.calls)[i]-width*.4)<1e-8));
    const first=(kind:string)=>a.calls.findIndex(c=>c[0]===kind);
    assert.ok(first('stroke')<first('createLinearGradient'),'water contact sits underneath the turf, not over the fields');
});
test('camera travel moves fixed banks oppositely with no cycling or wrapped coordinates',()=>{
    const a=recorder(),b=recorder();paintFlightLandscape(a.ctx,camera);
    paintFlightLandscape(b.ctx,{...camera,center:{x:3.6,y:.3}});
    const ax=a.calls.find(c=>c[0]==='moveTo')!,bx=b.calls.find(c=>c[0]==='moveTo')!;
    assert.ok(Number(bx[1])<Number(ax[1]));assert.equal(ax[2],bx[2]);
});
test('atmosphere is absent on runways and reduced motion excludes directional speed streaks',()=>{
    const route=createAircraftRoute(),ground=recorder(),reduced=recorder(),air=recorder();
    paintFlightAtmosphere(ground.ctx,camera,sampleAircraftTravel(route,1));assert.equal(ground.calls.length,0);
    paintFlightAtmosphere(reduced.ctx,camera,sampleAircraftTravel(route,.5,true));
    assert.equal(reduced.calls.filter(c=>c[0]==='lineTo').length,0);
    paintFlightAtmosphere(air.ctx,camera,sampleAircraftTravel(route,4));
    assert.equal(air.calls.filter(c=>c[0]==='lineTo').length,3);
    assert.equal(air.calls.filter(c=>c[0]==='save').length,air.calls.filter(c=>c[0]==='restore').length);
});

type Point=readonly [number,number];
function contains(bank:readonly Point[],point:Point):boolean {
    let inside=false;
    for(let i=0,j=bank.length-1;i<bank.length;j=i++) {
        const [x,y]=bank[i],[px,py]=bank[j];
        if((y>point[1])!==(py>point[1]) && point[0]<(px-x)*(point[1]-y)/(py-y)+x) inside=!inside;
    }
    return inside;
}
const cross=(a:Point,b:Point,c:Point)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
test('authored floodplain has distinct shoal, spit and connected banks without crossing shorelines',()=>{
    const areas=FLIGHT_BANKS.map(bank=>Math.abs(bank.reduce((sum,a,i)=>{
        const b=bank[(i+1)%bank.length]; return sum+a[0]*b[1]-b[0]*a[1];
    },0))/2);
    assert.ok(Math.min(...areas)<Math.max(...areas)*.08,'the upstream shoal stays subordinate to the broad bank');
    const concave=FLIGHT_BANKS.filter(bank=>bank.some((a,i)=>cross(a,bank[(i+1)%bank.length],bank[(i+2)%bank.length])<-.0001));
    assert.ok(concave.length>=3,'inlets and headlands break the repeated convex tile silhouette');
    for(const bank of FLIGHT_BANKS) for(let i=0;i<bank.length;i++) for(let j=i+2;j<bank.length;j++) {
        if(i===0 && j===bank.length-1) continue;
        const a=bank[i],b=bank[(i+1)%bank.length],c=bank[j],d=bank[(j+1)%bank.length];
        assert.ok(!(cross(a,b,c)*cross(a,b,d)<0 && cross(c,d,a)*cross(c,d,b)<0),'shoreline must not cross itself');
    }
});
test('river corridor remains open through the composed banks',()=>{
    const channel:Point[]=[[3.0,.25],[3.35,.28],[3.55,.30],[3.57,.45],[3.63,.52],[3.80,.60],[4.0,.70]];
    for(let i=0;i<channel.length-1;i++) for(let step=0;step<=20;step++) {
        const t=step/20,a=channel[i],b=channel[i+1];
        const p:Point=[a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t];
        assert.ok(FLIGHT_BANKS.every(bank=>!contains(bank,p)),`water corridor blocked at ${p}`);
    }
});
test('rounded shores retain world-space control points and batch material fills',()=>{
    const a=recorder(),b=recorder(); paintFlightLandscape(a.ctx,camera);
    paintFlightLandscape(b.ctx,{...camera,zoom:camera.zoom*.4});
    const curves=(calls:unknown[][])=>calls.filter(c=>c[0]==='quadraticCurveTo');
    assert.ok(curves(a.calls).length>0);
    curves(a.calls).forEach((curve,i)=>{
        for(let coordinate=1;coordinate<=4;coordinate++) {
            const center=coordinate%2?camera.width/2:camera.height/2;
            assert.ok(Math.abs(Number(curves(b.calls)[i][coordinate])-center-(Number(curve[coordinate])-center)*.4)<1e-8);
        }
    });
    assert.ok(a.calls.filter(c=>c[0]==='fill').length<40,'shore materials and foliage use compound fills');
});
