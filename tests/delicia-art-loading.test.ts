import test from 'node:test';
import assert from 'node:assert/strict';
import { DeliciaArt } from '../src/adventure/delicia/DeliciaArt';
import { DELICIA_ICONS, DELICIA_PIXEL_PALETTE, deliciaBossFrame, deliciaFoeFrame, deliciaProjectileFrame } from '../src/adventure/delicia/DeliciaPixelSprites';
import type { FoeType } from '../src/adventure/delicia/DeliciaContent';
import type { BossBeat } from '../src/adventure/delicia/DeliciaBoss';

test('native gameplay art is ready offline and creates no image requests',async t=>{
    const old=Object.getOwnPropertyDescriptor(globalThis,'Image');
    Object.defineProperty(globalThis,'Image',{configurable:true,value:class {constructor(){assert.fail('Gameplay must not download legacy painting atlases');}}});
    t.after(()=>old?Object.defineProperty(globalThis,'Image',old):Reflect.deleteProperty(globalThis,'Image'));
    const art=new DeliciaArt();await art.load();assert.equal(art.images.size,0);art.dispose();art.dispose();await art.load();assert.equal(art.images.size,0);
});

test('all enemy, boss and pickup frames have a complete native palette and stable frame boxes',()=>{
    const validate=(frame:readonly string[],w:number,h:number)=>{
        assert.equal(frame.length,h);assert.ok(frame.every(row=>row.length===w));
        const colors=new Set(frame.join(''));for(const color of colors)assert.ok(color in DELICIA_PIXEL_PALETTE,`Missing ${color}`);
        assert.ok(colors.size>=5);assert.ok(frame.join('').includes('K'),'Actors retain ink outlines');
    };
    for(const kind of ['pulp','beetle','wasp','roller','sentinel','bottler','mimic','bloom'] as FoeType[])
        for(const state of ['walk','tell','attack','stun'])for(const frame of [0,1,2,3])validate(deliciaFoeFrame(kind,state,(frame+.1)/(kind==='wasp'?14:7)),24,24);
    for(const character of ['jaja','guina'] as const)for(const beat of ['intro','idle','tell','attack','recover','stagger','transition','defeated'] as BossBeat[])
        for(const time of [0,.15,.3,.45]){const frame=deliciaBossFrame(character,beat,time);validate(frame,56,60);assert.ok(frame[59].includes('K'),'Feet retain their contact anchor');}
    for(const frame of Object.values(DELICIA_ICONS))validate(frame,12,12);
    for(const kind of ['heart','seed','juice'] as const)for(const friendly of [false,true])validate(deliciaProjectileFrame(kind,friendly),kind==='heart'?12:8,kind==='heart'?12:8);
});
