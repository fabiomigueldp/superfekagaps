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
    assert.ok(a.calls.length<1200,'bounded landscape work including seven shoreline materials');
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
