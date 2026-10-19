import test from 'node:test';
import assert from 'node:assert/strict';
import {CHASE_TERRACES,CHASE_BREAKS} from '../src/adventure/hipotetico/HypotheticalLayout';
import {chaseRuinAt,chaseTerraceFeet,chaseTerraceFall,chaseSplashAt,CHASE_WATER_Y} from '../src/adventure/hipotetico/HypotheticalChaseDetails';
import {drawChaseTerrace} from '../src/adventure/hipotetico/HypotheticalChaseArt';
import {HypotheticalModel,HYPOTHETICAL} from '../src/adventure/hipotetico/HypotheticalModel';

test('detaching a terrace preserves every support, bracket and cap pixel before gravity starts',()=>{
    // Compare occupied pixels, allowing only the walkable ivory edge to lose its emphasis.
    function paint(p:typeof CHASE_TERRACES[number],age?:number){
        const pixels=new Set<string>(),c={fillStyle:'',fillRect(x:number,y:number,w:number,h:number){for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++)pixels.add(`${xx},${yy}`);}};
        drawChaseTerrace(c as unknown as CanvasRenderingContext2D,p,p.x,0,age);return pixels;
    }
    for(const terrace of CHASE_TERRACES){
        assert.deepEqual(paint(terrace,0),paint(terrace,3));
        const rest=paint(terrace),fall=paint(terrace,0),wet=chaseTerraceFeet(terrace).filter(f=>terrace.y+f.v===CHASE_WATER_Y);
        const differences=[...rest].filter(pixel=>!fall.has(pixel));
        assert.ok(differences.every(pixel=>Number(pixel.split(',')[1])===CHASE_WATER_Y));
        assert.ok(differences.length<=wet.length*10);assert.equal([...fall].filter(pixel=>!rest.has(pixel)).length,0);
    }
});

test('each full-size terrace meets the water before its cap splash, and keeps all drops for their complete flight',()=>{
    for(const p of CHASE_TERRACES){
        let first=-1;
        for(let age=0;age<80;age++){
            const fall=chaseTerraceFall(p,age),bottom=p.y+fall.drop+p.width*Math.sin(fall.turn)+7*Math.cos(fall.turn);
            if(fall.splashAge>=0){if(first<0)first=age;assert.ok(bottom>=CHASE_WATER_Y-.001);}
            else assert.ok(bottom<CHASE_WATER_Y+.001);
            const s=chaseSplashAt(fall.splashAge,true);
            if(s.dropVisible)assert.ok(age<80&&s.height>=0);
        }
        assert.ok(first>20&&first<40);
    }
    for(const large of [false,true]){
        let previous=0,landed=false;
        for(let age=0;age<40;age+=.25){
            const p=chaseSplashAt(age,large);assert.ok(p.height>=0&&p.height<=11);
            if(!p.dropVisible&&age>1&&!landed){assert.ok(previous<.45);assert.equal(p.height,0);landed=true;}
            previous=p.height;
        }
        assert.ok(landed);
    }
});

test('beams and gate panels land on the bank, bounce and settle instead of sinking through the masonry',()=>{
    for(const height of [58,69,78]){
        let before=chaseRuinAt(0,height);
        for(let age=.25;age<120;age+=.25){
            const p=chaseRuinAt(age,height),bottom=p.beamDrop+66*Math.sin(p.beamTurn)+4*Math.cos(p.beamTurn);
            const panel=p.panelDrop+46*Math.sin(p.panelTurn)+29*Math.cos(p.panelTurn);
            assert.ok(bottom<=height+.002);assert.ok(panel<=height-9+.002);
            for(const [drop,turn]of [[p.postDrop,p.leftTurn],[p.rightPostDrop,p.rightTurn]]){
                const lowest=-22+drop+3.5*Math.sin(turn);assert.ok(lowest<.002);
                if(age>90)assert.ok(Math.abs(lowest)<.002,'fallen posts stay on top of the foundation');
            }
            assert.ok(Math.abs(p.beamX-before.beamX)<.25);assert.ok(Math.abs(p.beamDrop-before.beamDrop)<1.2);
            if(age>90){assert.ok(Math.abs(bottom-height)<.002);assert.ok(Math.abs(panel-(height-9))<.002);}
            before=p;
        }
    }
});

test('water and bank impact sounds occur once at contact, including after batched simulation steps',()=>{
    for(const batch of [1,6]){
        const b=new HypotheticalModel('chase',9,0,2304);b.state='rest';b.tick=100;
        b.terraceDebris=CHASE_TERRACES.slice(0,3).map(p=>({...p,born:100}));
        b.chaseBreaks=CHASE_BREAKS.map(()=>100);let water=0,bank=0;
        for(let i=0;i<120;i+=batch){
            b.update(HYPOTHETICAL.step*batch,{x:2304,y:200,width:14,height:24});
            water+=b.events.filter(e=>e==='collapse-water').length;bank+=b.events.filter(e=>e==='debris-land').length;
        }
        assert.equal(water,3);assert.equal(bank,6);assert.equal(b.terraceDebris.length,0);
    }
    const retry=new HypotheticalModel('chase',9,0,2304);retry.update(HYPOTHETICAL.step*6,{x:2304,y:200,width:14,height:24});
    assert.ok(!retry.events.includes('collapse-water'));assert.ok(!retry.events.includes('debris-land'));
});
