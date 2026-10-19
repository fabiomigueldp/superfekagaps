import test from 'node:test';
import assert from 'node:assert/strict';
import {drawChaseQuayGround} from '../src/adventure/hipotetico/HypotheticalChaseQuayArt';
import {chaseQuaySection,chaseOarAt,CHASE_QUAYS,chaseQuayX} from '../src/adventure/hipotetico/HypotheticalChaseLife';
import {drawHypotheticalScenery} from '../src/adventure/hipotetico/HypotheticalScenery';
import {HypotheticalModel,HYPOTHETICAL} from '../src/adventure/hipotetico/HypotheticalModel';

function shore(cameraX:number,cameraY:number){
    const pixels=new Map<string,string>();
    const context={fillStyle:'',fillRect(x:number,y:number,w:number,h:number){
        for(let yy=Math.max(0,y);yy<Math.min(180,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(320,x+w);xx++)
            pixels.set(`${xx},${yy}`,this.fillStyle);
    }};
    drawChaseQuayGround(context as unknown as CanvasRenderingContext2D,cameraX,cameraY);
    return pixels;
}

test('the street and retaining wall support every frontage without holes at parallax cell boundaries',()=>{
    for(const camera of [0,143.9,144,399.9,1644.4,2239.9,4100])for(const cy of [64,54,39]){
        const pixels=shore(camera,cy),s=chaseQuaySection(cy);
        for(let x=0;x<320;x++)for(let y=Math.round(s.ground);y<Math.round(s.water);y++)
            assert.ok(pixels.has(`${x},${y}`),`water seam under street at ${camera}, ${cy}: ${x}, ${y}`);
        for(const site of CHASE_QUAYS){
            for(const foot of [8,39,65,119]){
                const x=Math.round(chaseQuayX(site.x,camera)+foot);
                if(x>=0&&x<320)assert.ok(pixels.has(`${x},${Math.round(s.ground)}`),'facade and fixtures must touch land');
            }
        }
        // The foreground channel must stay clear, even where the playable deck breaks.
        for(let x=0;x<320;x++)for(let y=Math.ceil(s.water+3);y<180;y++)assert.ok(!pixels.has(`${x},${y}`));
    }
});

test('masonry translates rigidly with its frontage instead of drifting as a second parallax layer',()=>{
    const initial=shore(0,64),travel=shore(100,64),raised=shore(100,14);
    for(let x=0;x<284;x++)for(let y=108;y<152;y++){
        assert.equal(initial.get(`${x+36},${y}`),travel.get(`${x},${y}`));
        assert.equal(travel.get(`${x},${y}`),raised.get(`${x},${y+10}`));
    }
});

test('skiffs float in front of the wall and their oars only generate a wake during the submerged stroke',()=>{
    for(const cy of [-16,39,64]){
        const s=chaseQuaySection(cy);
        assert.ok(s.edge>s.ground&&s.outlet>s.edge&&s.outlet<s.water);
        assert.ok(s.boat-6>=s.water,'the whole hull stays on the water side of the quay');
        assert.ok(s.boat<240-cy,'rear boats stay farther away than the foreground splash plane');
    }
    for(let index=0;index<4;index++){
        let previous=chaseOarAt(0,index,false),wet=0,dry=0;
        for(let tick=.25;tick<360;tick+=.25){
            const pose=chaseOarAt(tick,index,false);
            assert.ok(Math.abs(pose.stroke-previous.stroke)<.01&&Math.abs(pose.bob-previous.bob)<.003);
            if(pose.lift>0){assert.equal(pose.wet,0);dry++;}
            if(pose.wet>.1){assert.equal(pose.lift,0);wet++;}
            previous=pose;
        }
        assert.ok(wet>300&&dry>300);
        assert.deepEqual(chaseOarAt(0,index,true),chaseOarAt(1000,index,true));
    }
});

test('the destination portal pillars and threshold meet the actual bridge deck, not the distant street',()=>{
    const model=new HypotheticalModel('chase',9);
    for(const cx of [4120,4140.5])for(const cy of [54,63.5,64]){
        const pixels=new Map<string,string>();
        const c={fillStyle:'',save(){},restore(){},beginPath(){},rect(){},clip(){},
            fillRect(x:number,y:number,w:number,h:number){
                for(let yy=Math.max(0,y);yy<Math.min(180,y+h);yy++)for(let xx=Math.max(0,x);xx<Math.min(320,x+w);xx++)
                    pixels.set(`${xx},${yy}`,this.fillStyle);
            }};
        drawHypotheticalScenery(c as unknown as CanvasRenderingContext2D,model,cx,cy,true);
        const x=HYPOTHETICAL.chaseEnd-cx-49,y=Math.round(HYPOTHETICAL.floor-cy)-1;
        for(const dx of [7,88])assert.equal(pixels.get(`${Math.round(x+dx)},${y}`),'#839b88','plinth reaches the last row above the real deck');
        assert.equal(pixels.get(`${Math.round(x+49)},${y}`),'#81998b','door threshold shares the same ground');
    }
});
