import test from 'node:test';
import assert from 'node:assert/strict';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {CHASE_QUAYS,chaseReactionStarts,updateChaseReactions,chaseWorkerAt,chaseBirdAt,chaseQuayX,chaseQuayBase,chaseOutflowAt} from '../src/adventure/hipotetico/HypotheticalChaseLife';

test('quay reactions latch on the approaching pursuer, never on a camera move or a repeat visit',()=>{
    const starts=chaseReactionStarts(0);
    for(const [i,site]of CHASE_QUAYS.entries()){
        const threshold=site.x-50;
        updateChaseReactions(starts,100+i*100,threshold-.01);assert.equal(starts[i],-1);
        updateChaseReactions(starts,101+i*100,threshold);assert.equal(starts[i],101+i*100);
        const before=[...starts];updateChaseReactions(starts,102+i*100,threshold-300);assert.deepEqual(starts,before);
    }
    const before=[...starts];updateChaseReactions(starts,9999,9000);assert.deepEqual(starts,before);
});

test('retry at the sluices keeps earlier workers sheltered and birds gone without replaying their reactions',()=>{
    const model=new HypotheticalModel('chase',9,0,2304);
    for(const [i,site]of CHASE_QUAYS.entries()){
        const born=model.chaseReactions[i];
        if(site.x<2304){assert.ok(born<-1);assert.ok(chaseWorkerAt(-born).hidden);assert.ok(!chaseBirdAt(-born,0).visible);}
        else assert.equal(born,-1);
    }
    assert.equal(chaseOutflowAt(1000,1000).surge,0);
});

test('workers anticipate, accelerate and enter the doorway before disappearing; birds take off in staggered groups',()=>{
    let prior=chaseWorkerAt(-1),maxSpeed=0;
    for(let age=0;age<100;age++){
        const p=chaseWorkerAt(age);
        assert.ok(p.travel>=prior.travel);assert.ok(p.travel-prior.travel<1.1);
        assert.ok(Math.abs(p.speed-prior.speed)<.09);assert.ok(Math.abs(p.crateDrop-prior.crateDrop)<.6);
        if(age<9)assert.equal(p.travel,0);
        if(p.hidden)assert.ok(75-p.travel+5<47,'the complete silhouette has passed behind the jamb');
        maxSpeed=Math.max(maxSpeed,p.speed);prior=p;
    }
    assert.ok(maxSpeed>1);assert.equal(prior.speed,0);
    for(let i=0;i<3;i++){
        let last=chaseBirdAt(-1,i),launch=-1;
        for(let age=0;age<190;age++){
            const p=chaseBirdAt(age,i);
            if(p.flying&&launch<0){launch=age;assert.equal(last.x,0);assert.equal(p.x,0);}
            assert.ok(p.x-last.x<=.61&&p.y-last.y<=.49);last=p;
        }
        assert.equal(launch,22+i*6);assert.ok(!last.visible);
    }
});

test('district scenery remains anchored through camera boundaries and hydraulic surges decay after a single rupture',()=>{
    for(const s of CHASE_QUAYS)for(const camera of [0,143.9,144,400,2239,2240,4100]){
        assert.ok(Math.abs(chaseQuayX(s.x,camera+.25)-chaseQuayX(s.x,camera)+.09)<1e-9);
    }
    assert.equal(chaseQuayBase(64),129);assert.equal(chaseQuayBase(54)-chaseQuayBase(64),2);
    let prior=chaseOutflowAt(-1,-1),peak=0;
    for(let age=0;age<180;age++){
        const p=chaseOutflowAt(age,age-45);
        assert.ok(p.flow>=.35&&p.flow<=1.7);assert.ok(Math.abs(p.flow-prior.flow)<.12);
        if(age<45||age>=99)assert.equal(p.surge,0);
        peak=Math.max(peak,p.surge);prior=p;
    }
    assert.equal(peak,1);assert.equal(prior.flow,.35);
});
