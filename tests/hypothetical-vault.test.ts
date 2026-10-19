import test from 'node:test';
import assert from 'node:assert/strict';
import { HypotheticalGuard } from '../src/adventure/hipotetico/HypotheticalGuards';
import { GUARD_VAULT, planGuardVault } from '../src/adventure/hipotetico/HypotheticalGuardVault';
import { guardPose, drawHypotheticalGuard } from '../src/adventure/hipotetico/HypotheticalGuardArt';
import { hypotheticalStage } from '../src/adventure/hipotetico/HypotheticalStage';
import { WorldLevel, WorldObjects } from '../src/adventure/WorldPhysics';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
const dt=1000/60;
function setup(rise=68,wave=2){
    const level=new WorldLevel(hypotheticalStage('duel').level);
    const objects=new WorldObjects([{id:'perch',kind:'support',x:148,y:224-rise,width:64,height:7}]);
    level.bodies=objects.bodies;
    const team:HypotheticalGuard[]=[],e=new HypotheticalGuard({id:'flanker',kind:'minion',x:94,y:224,behavior:'canal',range:320},wave,()=>team,{left:12,right:300});
    team.push(e);
    const player={x:170,y:200-rise,width:14,height:24};
    return {e,level,objects,team,player,step:(p=player)=>e.update(dt,level,objects,p)};
}

test('a flanker acquires an occupied perch, not a passing jump, and the first district retains its simpler defender',()=>{
    const a=setup();
    for(let n=0;n<90;n++)a.step({...a.player,y:a.player.y-6});
    assert.equal(a.e.vaultTarget,null);
    const b=setup();for(let n=0;n<15;n++){b.step();assert.equal(b.e.vaultTarget,null);}
    b.step();assert.ok(b.e.vaultTarget);assert.equal(b.e.timer,0);assert.equal(b.e.phase,'warning');
    const intro=setup(40,1);for(let n=0;n<180;n++)intro.step();assert.equal(intro.e.vaultTarget,null);
});

test('landing requires a real, reachable deck and never overlaps a living ally',()=>{
    const {e,level,team,player}=setup();
    assert.ok(planGuardVault(e,player,level,team));
    assert.equal(planGuardVault(e,{...player,x:290},level,team),null);
    const ally=new HypotheticalGuard({id:'ally',kind:'loader',x:169,y:156,behavior:'canal'},2);
    team.push(ally);assert.equal(planGuardVault(e,player,level,team),null);
    ally.dead=true;assert.ok(planGuardVault(e,player,level,team));
    level.bodies=[];assert.equal(planGuardVault(e,player,level,team),null);
});

test('the full tell locks its landing; native one-way collision catches every authored height and gives a real recovery',()=>{
    for(const rise of [28,36,40,56,64,68]){
        const {e,step,player}=setup(rise);
        while(!e.vaultTarget)step();
        const target={...e.vaultTarget},direction=e.facing,warningAt=e.age,x=e.x;
        while(e.phase==='warning'){
            step({...player,x:45,y:200});assert.deepEqual(e.vaultTarget,target);assert.equal(e.facing,direction);assert.equal(e.x,x);assert.equal(e.danger,null);
        }
        assert.ok(e.age-warningAt>=GUARD_VAULT.warning);
        let tucked=false;
        while(e.phase==='attack'){
            step({...player,x:45,y:200});
            if(e.phase==='attack'){
                const pose=guardPose(e);tucked||=pose.left[1]<-2;
                assert.equal(e.danger,null);assert.equal(guardPose(e,true).tuck,pose.tuck);
            }
        }
        assert.ok(tucked);assert.equal(e.y+e.height,target.floor);assert.ok(Math.abs(e.x-target.x)<.01);
        assert.equal(e.vaultLandedAt,e.age);assert.equal(e.phase,'rest');
        for(let n=0;n<62;n++){step({...player,x:45,y:200});assert.equal(e.phase,'rest');}
        while(e.vaultTarget)step({...player,x:45,y:200});
        assert.equal(e.phase,'walk');
        for(let n=0;n<160;n++)step({...player,x:45,y:200});
        assert.equal(e.y+e.height,224,'a flanker can leave the perch and rejoin the road');
    }
});

test('an ordinary top hit cancels the airborne defender; no landing or extra attack survives his defeat',()=>{
    const {e,step}=setup();while(e.phase!=='attack')step();for(let n=0;n<10;n++)step();
    const hit={x:e.x+1,y:e.y-23,width:14,height:24};
    assert.equal(e.contact(hit,{...hit,y:hit.y-4},true,false),'kill');
    for(let n=0;n<180;n++)step();
    assert.equal(e.dead,true);assert.equal(e.danger,null);assert.equal(e.vaultLandedAt,-Infinity);
});

test('vault effects are read-only paintings, including reduced motion and frozen updates',t=>{
    const h=sceneLifecycleBrowser(t),{e,step,level,objects,player}=setup();
    while(e.phase!=='attack')step();for(let n=0;n<12;n++)step();
    const before=JSON.stringify(e);
    for(const reduced of [false,true])drawHypotheticalGuard(h.canvas.getContext(),e,0,64,reduced);
    for(const dt of [0,-1,NaN,Infinity])e.update(dt,level,objects,player);
    assert.equal(JSON.stringify(e),before);
});

test('a real ariete collision emits one impact; an ordinary brake with a recent stomp flash does not',t=>{
    const h=sceneLifecycleBrowser(t),{level,objects,player}=setup();
    const charger=()=>new HypotheticalGuard({id:'ram',kind:'charger',x:200,y:224,behavior:'canal'},2,()=>[],{left:190,right:240});
    const e=charger();e.phase='attack';e.timer=200;e.facing=1;
    for(let n=0;n<40&&e.phase==='attack';n++)e.update(dt,level,objects,player);
    assert.equal(e.phase,'rest');assert.equal(e.impactAt,e.age);
    const before=JSON.stringify(e);
    for(const reduced of [false,true])drawHypotheticalGuard(h.canvas.getContext(),e,0,64,reduced);
    assert.equal(JSON.stringify(e),before);
    const impact=e.impactAt;e.update(dt,level,objects,player);assert.equal(e.impactAt,impact);
    const brake=charger();brake.phase='attack';brake.timer=715;brake.flash=100;
    brake.update(dt,level,objects,player);
    assert.equal(brake.phase,'rest');assert.equal(brake.impactAt,-Infinity);
});
