import assert from 'node:assert/strict';
import test from 'node:test';
import {Level} from '../src/world/Level';
import {TileType as T,FALLING_PLATFORM_MIN_CONTACT_MS,FALLING_PLATFORM_ARM_MS,FALLING_PLATFORM_FALL_MS,FALLING_PLATFORM_RESPAWN_MS} from '../src/constants';
import type {LevelData,Rect} from '../src/types';

function boards(originX=0,originY=0){
    const tiles=Array.from({length:8},()=>Array<number>(8).fill(T.EMPTY));
    tiles[3][2]=tiles[3][3]=tiles[3][4]=T.PLATFORM_FALLING;
    return new Level({width:8,height:8,tiles,originX,originY} as LevelData);
}

for(const[ox,oy]of [[0,0],[-5,-3],[3,2]])for(const edge of [false,true])
test(`fragile support gives way under both feet or an overhanging foot, origin=${ox},${oy}, edge=${edge}`,()=>{
    const level=boards(ox,oy),top=level.rowToWorldY(3);
    let rect:Rect={x:level.colToWorldX(edge?5:3)-(edge?1:6),y:top-24,width:14,height:24};
    let vy=0,arming=false,fell=false;
    for(let i=0;i<80;i++){
        level.clearFallingPlatformTouches();
        const collision=level.resolveCollision(rect,{x:0,y:vy=Math.min(8,vy+.5)},rect);
        rect={...rect,...collision.position};vy=collision.velocity.y;
        if(collision.grounded)level.markFallingPlatformSupport(rect);
        level.updateFallingPlatforms(1000/60);
        arming ||= level.getFallingPlatformRenderData().some(b=>b.phase==='arming');
        fell ||= rect.y+rect.height>top+32;
    }
    assert.ok(arming,'weight produces the visible warning before the fall');
    assert.ok(fell,'an untouched neighbouring edge cannot hold the player forever');
    assert.equal(level.getTile(edge?2:4,3),T.PLATFORM_FALLING,'distant boards stay intact');
    level.updateFallingPlatforms(FALLING_PLATFORM_RESPAWN_MS+FALLING_PLATFORM_FALL_MS);
    assert.equal(level.getTile(edge?4:3,3),T.PLATFORM_FALLING,'support returns for another attempt');
});

test('brief contact, exact edges and an unrelated support do not arm extra boards',()=>{
    const level=boards();
    const feet:Rect={x:32,y:24,width:16,height:24};
    level.markFallingPlatformSupport(feet);
    level.updateFallingPlatforms(1000/60);
    assert.deepEqual(level.getFallingPlatformRenderData().map(b=>b.col),[2],'a shared edge without overlap bears no weight');
    level.clearFallingPlatformTouches();level.updateFallingPlatforms(1000/60);
    assert.equal(level.getFallingPlatformRenderData().length,0,'jumping away before the warning leaves the board intact');
    level.markFallingPlatformSupport({...feet,y:20});
    level.updateFallingPlatforms(FALLING_PLATFORM_MIN_CONTACT_MS+FALLING_PLATFORM_ARM_MS);
    assert.equal(level.getFallingPlatformRenderData().length,0,'a moving support above a board does not press the board below');
});
