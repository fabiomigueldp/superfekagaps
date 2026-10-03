import test from 'node:test';
import assert from 'node:assert/strict';
import { FLIGHT_BANKS, paintFlightLandscape, paintFlightAtmosphere } from '../src/adventure/WorldFlightScenery';
import { sampleAircraftTravel,createAircraftRoute } from '../src/adventure/WorldAircraftModel';
const camera={center:{x:3.5,y:.3},width:960,height:540,zoom:1.22};
function recorder() {
    const calls: unknown[][]=[];
    const ctx=new Proxy({},{get:(_target,key)=> (...args: unknown[])=> {
        calls.push([key,...args]);
        if(key==='createRadialGradient')return {addColorStop:()=>{}};
    },set:(_target,key,value)=>{calls.push([key,value]);return true;}}) as CanvasRenderingContext2D;
    return {ctx,calls};
}
test('fixed finite geography is deterministic and independent of trip direction or elapsed clock',()=>{
    const a=recorder(),b=recorder();paintFlightLandscape(a.ctx,camera);paintFlightLandscape(b.ctx,camera);
    assert.deepEqual(a.calls,b.calls);
    assert.ok(FLIGHT_BANKS.flat().every(p=>p.every(Number.isFinite)));
    assert.ok(a.calls.length<900,'bounded landscape work');
    assert.equal(a.calls.filter(c=>c[0]==='save').length,a.calls.filter(c=>c[0]==='restore').length);
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
