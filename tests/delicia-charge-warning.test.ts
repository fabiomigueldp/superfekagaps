import assert from 'node:assert/strict';
import test from 'node:test';
import { DeliciaBoss, intersects } from '../src/adventure/delicia/DeliciaBoss';

for (const character of ['jaja','guina'] as const) for (const phase of [1,2,3])
for (const direction of [-1,1]) for (const assist of [false,true]) {
    test(`${character} phase ${phase}, direction ${direction}, assist ${assist}: charge tells the lower-body clearance`, () => {
        const boss = new DeliciaBoss(character,assist);
        boss.phase=phase;boss.hp=phase===1?boss.maxHp:phase===2?Math.floor(boss.maxHp*.6):Math.floor(boss.maxHp*.3);
        boss.start();
        const player={x:direction<0?150:1240,y:396,w:34,h:54}, dt=1/120;
        for(let tick=0;tick<8000&&!(boss.beat==='tell'&&boss.attack==='charge');tick++)boss.update(dt,player);
        assert.equal(boss.beat,'tell');assert.equal(boss.attack,'charge');assert.equal(boss.direction,direction);
        const start=boss.x,end=direction<0?260:1110,warning=boss.warnings[0];
        assert.deepEqual(warning,{x:Math.min(start,end),y:boss.y+60,w:Math.abs(start-end)+boss.w,h:boss.h-60});
        assert.equal(warning.y,365);assert.equal(warning.h,85);
        const airborne={x:warning.x+20,y:340,w:34,h:54};
        assert.ok(intersects(airborne,warning),'low airborne player remains inside the announced danger');
        assert.ok(!intersects({...airborne,y:warning.y-airborne.h},warning),'exact full clearance stays outside');
        let tellTicks=0;
        while(boss.beat==='tell') {
            const state=JSON.stringify(boss);assert.deepEqual(boss.warnings,[warning]);assert.equal(JSON.stringify(boss),state,'warning reads do not advance simulation');
            // Crossing to the opposite side cannot change the locked warning.
            boss.update(dt,{...player,x:direction<0?1240:150});tellTicks++;
        }
        assert.ok(Math.abs(tellTicks*dt-boss.tellDuration)<=dt+1e-9);
        assert.equal(boss.beat,'attack');
        let attackTicks=0;
        while(boss.beat==='attack') {
            boss.update(dt,player);attackTicks++;
            const progress=Math.min(1,attackTicks*dt/.85),expected=start+(end-start)*(progress*progress*(3-2*progress));
            assert.ok(Math.abs(boss.x-expected)<1e-8,'original smoothstep trajectory');
            if(boss.beat==='attack') {
                assert.deepEqual(boss.danger,[{x:boss.x+8,y:boss.y+60,w:boss.w-16,h:boss.h-60}]);
                const danger=boss.danger[0];assert.ok(danger.x>=warning.x&&danger.x+danger.w<=warning.x+warning.w);
                assert.equal(danger.y,warning.y);assert.equal(danger.h,warning.h);
            }
        }
        assert.ok(Math.abs(attackTicks*dt-.85)<=dt+1e-9);assert.equal(boss.beat,'recover');assert.deepEqual(boss.danger,[]);
    });
}
