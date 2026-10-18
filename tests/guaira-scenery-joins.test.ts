import test from 'node:test';
import assert from 'node:assert/strict';
import { sceneLifecycleBrowser } from './helpers/sceneLifecycleHarness';
import type { WorldGame } from '../src/adventure/WorldGame';
import { GuairaTraversal } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { GuairaJunction } from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import { GuairaRespiros } from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import { GuairaAscent } from '../src/adventure/experimental/guaira/GuairaAscent';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';
import { GUAIRA_COURSES } from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import { GUAIRA_NEIGHBORHOODS, drawGuairaNeighborhoodBuilding } from '../src/adventure/experimental/guaira/GuairaNeighborhoodArt';
import { guairaOrdinaryScaffolds, guairaScaffoldFoot, drawGuairaFixedScaffold } from '../src/adventure/experimental/guaira/GuairaScaffoldArt';
import { isSolidTile } from '../src/world/tileRules';
import { TileType as T } from '../src/constants';

const scenes = [['travessia',GuairaTraversal],['patio',GuairaJunction],['respiros',GuairaRespiros],
    ['subida',GuairaAscent],['galeria',GuairaGallery],['alivio',GuairaRelief]] as const;
class Raster {
    fillStyle='';pixels=Array<string>(320*180).fill('');
    fillRect(x:number,y:number,w:number,h:number) {
        assert.ok([x,y,w,h].every(Number.isInteger));
        const left=Math.max(0,x),right=Math.min(320,x+w);if(right<=left)return;
        for(let yy=Math.max(0,y);yy<Math.min(180,y+h);yy++)this.pixels.fill(this.fillStyle,yy*320+left,yy*320+right);
    }
    get c(){return this as unknown as CanvasRenderingContext2D;}
}

for(const[id,Scene]of scenes)if(GUAIRA_NEIGHBORHOODS[id])
test(`${id}: authored neighbourhood roots and building footings meet solid ground over their full width`,t=>{
    const h=sceneLifecycleBrowser(t),g=h.create<WorldGame>(Scene),course=GUAIRA_COURSES[id];
    for(const prop of GUAIRA_NEIGHBORHOODS[id]!) {
        const floor=prop.floor??course.floor;
        const left=course.start+prop.x+(prop.kind==='tree'?prop.width/2:5);
        const right=prop.kind==='tree'?left+1:course.start+prop.x+prop.width-5;
        for(let x=left;x<right;x++)assert.ok(isSolidTile(g.level.getTile(Math.floor(x/16),floor/16)),`${prop.kind} at ${prop.x}: footing crosses air at ${x}`);
    }
    g.dispose();
});

for(const[id,Scene]of scenes)test(`${id}: complete rear frames follow fixed native decks and never close a fragile opening`,t=>{
    const h=sceneLifecycleBrowser(t),g=h.create<WorldGame>(Scene),course=GUAIRA_COURSES[id];
    const before=JSON.stringify(g.level.data),all=guairaOrdinaryScaffolds(g.level,id);assert.ok(all.length>0);
    for(const deck of all){
        for(let x=deck.left;x<deck.right;x+=16)assert.equal(g.level.getTile(x/16,deck.top/16),T.PLATFORM);
        for(const x of [deck.left+5,deck.right-7]){
            const foot=guairaScaffoldFoot(g.level,x,deck.top);
            assert.ok(foot.y>deck.top+6);
            if(foot.masonry)assert.ok(isSolidTile(g.level.getTile(Math.floor(x/16),foot.y/16)));
            else assert.ok(foot.y>g.level.data.height*16,'An open channel cannot acquire a floating concrete foot');
        }
    }
    // The complete run must survive entering from either side of a viewport.
    for(let camera=course.start;camera<course.end;camera+=37){
        const visible=guairaOrdinaryScaffolds(g.level,id,camera-24,camera+344);
        for(const deck of all.filter(d=>d.right>camera&&d.left<camera+320))
            assert.ok(visible.some(d=>JSON.stringify(d)===JSON.stringify(deck)),'Clipping must not relocate the legs');
    }
    assert.equal(JSON.stringify(g.level.data),before);g.dispose();
});

test('the inspection piling above Traversal’s first gap continues below the open channel',t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaTraversal),course=GUAIRA_COURSES.travessia;
    const foot=guairaScaffoldFoot(g.level,course.start+325,64);
    assert.equal(foot.masonry,false);assert.ok(foot.y>course.floor+64);
    const c=new Raster();drawGuairaFixedScaffold(c.c,g.level,course.start+320,course.start+368,64,course.start+300,100);
    assert.ok(c.pixels[125*320+24],'Piling remains visible below the nominal y192 floor in the empty gap');g.dispose();
});

test('a gallery support finds the actual lowered inspection stair instead of the nominal floor',t=>{
    const h=sceneLifecycleBrowser(t),g=h.create(GuairaGallery),course=GUAIRA_COURSES.galeria;
    assert.deepEqual(guairaScaffoldFoot(g.level,course.start+352,course.floor-64),{y:course.floor+64,masonry:true});g.dispose();
});

for(const kind of ['home','store','pump']as const)test(`${kind}: animation leaves masonry, sill, eaves and drain connected`,()=>{
    const paint=(time:number,x=40,foot=160)=>{const c=new Raster();drawGuairaNeighborhoodBuilding(c.c,kind,x,foot,112,100,time,2048);return c.pixels;};
    const initial=paint(0),later=paint(9400);
    assert.deepEqual(later.slice(134*320),initial.slice(134*320),'Animation cannot move the foundation or door sill');
    if(kind==='pump')assert.notDeepEqual(initial,later,'Fan articulation stays visible inside its fixed grille');
    const moved=paint(9400,13,147);
    for(let y=0;y<167;y++)for(let x=0;x<293;x++)assert.equal(moved[y*320+x],later[(y+13)*320+x+27],'A camera translation moves the entire building without changing its local detail');
});
