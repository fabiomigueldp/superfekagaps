import test from 'node:test';
import assert from 'node:assert/strict';
import {HypotheticalBackdrop} from '../src/adventure/hipotetico/HypotheticalBackdrop';
import {bloodDrop,drawBlood} from '../src/adventure/hipotetico/HypotheticalBlood';

test('persistent blood is created once per real bullet contact, never by an alert or missed shot',()=>{
    const b=new HypotheticalBackdrop(true);
    for(let tick=1;tick<=1800;tick++){
        const count=b.blood.length;b.update(tick);
        const contacts=b.people.filter(p=>p.hitAt===tick);
        assert.equal(b.blood.length-count,contacts.length);
        for(const hit of b.blood.slice(count)){
            const person=b.people[hit.actor],impact=b.impacts.find(p=>p.born===tick&&p.material==='cloth');
            assert.equal(person.hitAt,tick);assert.ok(impact);
            assert.deepEqual([hit.x,hit.y],[impact.x,impact.y]);assert.equal(hit.floor,(person.depth??0)-1);
        }
        assert.equal(new Set(b.blood.map(p=>p.actor)).size,b.blood.length);
        assert.ok(b.blood.length<=b.people.length);
    }
    assert.equal(b.blood.length,10);assert.equal(b.blood.length,b.casualties);
});

test('droplets settle on their actor street, retain their position and never fall through it',()=>{
    const b=new HypotheticalBackdrop(true);for(let t=1;t<=1800;t++)b.update(t);
    for(const hit of b.blood)for(const direction of [-1,1])for(let i=0;i<6;i++){
        const contact={...hit,direction};let previousX=hit.x;
        for(let age=0;age<100;age++){
            const drop=bloodDrop(contact,i,hit.born+age);
            assert.ok(Number.isFinite(drop.x)&&Number.isFinite(drop.y));assert.ok(drop.y<=hit.floor);
            assert.ok((drop.x-previousX)*direction>=-1e-8);previousX=drop.x;
        }
        const landed=bloodDrop(contact,i,hit.born+100),later=bloodDrop(contact,i,hit.born+10000);
        assert.equal(landed.grounded,true);assert.equal(landed.y,hit.floor);
        assert.deepEqual([landed.x,landed.y,landed.width],[later.x,later.y,later.width]);
    }
});

test('settled marks remain visible in reduced motion and repeated drawing never changes scene state',()=>{
    const b=new HypotheticalBackdrop(true);for(let t=1;t<=700;t++)b.update(t);
    const before=JSON.stringify(b),paint=(reduced:boolean)=>{
        const pixels:string[]=[];
        const c={fillStyle:'',fillRect(x:number,y:number,w:number,h:number){pixels.push([x,y,w,h,this.fillStyle].join(','));}};
        drawBlood(c as unknown as CanvasRenderingContext2D,b,116,reduced,false);
        drawBlood(c as unknown as CanvasRenderingContext2D,b,116,reduced,true);return pixels;
    };
    const ordinary=paint(false);assert.ok(ordinary.length>30);assert.deepEqual(paint(true),ordinary);
    assert.equal(JSON.stringify(b),before);b.cancel();assert.equal(b.blood.length,6);
});
