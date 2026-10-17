import test from 'node:test';
import assert from 'node:assert/strict';
import { drawGuairaDistantSettlement } from '../src/adventure/experimental/guaira/GuairaDistantScenery';
import { drawGuairaWorkshopBackground } from '../src/adventure/experimental/guaira/GuairaWorkshopBackground';
import { drawGuairaAqueductArch } from '../src/adventure/experimental/guaira/GuairaAqueductLandscape';
import { drawGuairaLandscape } from '../src/adventure/experimental/guaira/GuairaScenery';
import { GUAIRA_COURSES } from '../src/adventure/experimental/guaira/GuairaCourseDesign';
import { guairaBrowser } from './helpers/guairaLabHarness';
import { GuairaTraversal } from '../src/adventure/experimental/guaira/GuairaTraversal';
import { GuairaJunction } from '../src/adventure/experimental/guaira/junction/GuairaJunction';
import { GuairaRespiros } from '../src/adventure/experimental/guaira/respiros/GuairaRespiros';
import { GuairaAscent } from '../src/adventure/experimental/guaira/GuairaAscent';
import { GuairaGallery } from '../src/adventure/experimental/guaira/gallery/GuairaGallery';
import { GuairaRelief } from '../src/adventure/experimental/guaira/relief/GuairaRelief';

class Pixels {
    fillStyle = ''; globalAlpha = 1; globalCompositeOperation = 'source-over';
    pixels = Array<string>(320 * 180).fill('');
    bounds = [0, 23, 320, 180]; pending = this.bounds;
    stack: {fillStyle:string;globalAlpha:number;globalCompositeOperation:string;bounds:number[]}[] = [];
    save() { this.stack.push({fillStyle:this.fillStyle,globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation,bounds:this.bounds}); }
    restore() { Object.assign(this,this.stack.pop()); }
    beginPath() {}
    rect(x:number,y:number,w:number,h:number) { this.pending = [x,y,x+w,y+h]; }
    clip() { this.bounds = this.bounds.map((v,i)=>i<2?Math.max(v,this.pending[i]):Math.min(v,this.pending[i])); }
    fillRect(x:number,y:number,w:number,h:number) {
        assert.ok([x,y,w,h].every(Number.isInteger), 'All painted edges stay on the native pixel grid');
        const left=Math.max(x,this.bounds[0]),right=Math.min(x+w,this.bounds[2]);
        if(right<=left)return;
        for(let yy=Math.max(y,this.bounds[1]);yy<Math.min(y+h,this.bounds[3]);yy++)this.pixels.fill(this.fillStyle,yy*320+left,yy*320+right);
    }
    get c() { return this as unknown as CanvasRenderingContext2D; }
}
function translated(a:Pixels,b:Pixels,dx:number,dy:number) {
    let compared=0;
    for(let y=23;y<180-dy;y++)for(let x=0;x<320-dx;x++) {
        assert.equal(b.pixels[y*320+x],a.pixels[(y+dy)*320+x+dx],`Background contact shifted at ${x},${y}`);compared++;
    }
    assert.ok(compared>10000);assert.ok(b.pixels.slice(0,23*320).every(color=>!color),'HUD clip stays intact');
}

for(const kind of ['village','junction','rice','heights']as const)
test(`${kind}: complete distant buildings, roots and fields share one parallax transform`,()=>{
    const a=new Pixels(),b=new Pixels();
    drawGuairaDistantSettlement(a.c,1300,80,4700,kind);
    drawGuairaDistantSettlement(b.c,1400,180,4700,kind);
    translated(a,b,46,36);
});

for(const id of ['galeria','alivio']as const)
test(`${id}: wall, windows and foundations keep their shape across camera translation`,()=>{
    const a=new Pixels(),b=new Pixels(),g=GUAIRA_COURSES[id];
    drawGuairaWorkshopBackground(a.c,id,g.start+16,g.floor-140,3100,false);
    drawGuairaWorkshopBackground(b.c,id,g.start+48,g.floor-120,3100,false);
    translated(a,b,32,20);assert.equal(a.stack.length,0);assert.equal(b.stack.length,0);
});

test('aqueduct opening rises to a real keystone and both piers reach the same foundation',()=>{
    const a=new Pixels();drawGuairaAqueductArch(a.c,50,30,165);
    const at=(x:number,y:number)=>a.pixels[y*320+x];
    assert.ok(at(114,40),'Keystone is masonry');
    assert.equal(at(114,49),'','Centre of the arch opens above its shoulders');
    assert.ok(at(82,60),'Curved spring carries the shoulder');
    assert.equal(at(82,72),'','Opening continues below the shoulder');
    for(const x of [60,160])for(let y=82;y<165;y++)assert.ok(at(x,y),'No pier terminates above its foundation');
});

test('Traversal uses one continuous sky at the original/expanded district seam',t=>{
    const h=guairaBrowser(t);
    for(const surface of [h.window,h.document,h.canvas])Object.assign(surface,{removeEventListener(){}});
    const g=new GuairaTraversal(h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement);
    const actual=new Pixels(),expected=new Pixels();g.time=g.objects.time=6400;
    g.art.background(actual.c,{id:1}as never,1400,0,g.time);
    drawGuairaLandscape(expected.c,1400,0,g.time,false,'village');
    assert.deepEqual(actual.pixels.slice(23*320,80*320),expected.pixels.slice(23*320,80*320),'Neither a second sun nor a second cloud profile appears at x1536');
    g.dispose();
});

for(const[id,Scene]of [['travessia',GuairaTraversal],['patio',GuairaJunction],['respiros',GuairaRespiros],
    ['subida',GuairaAscent],['galeria',GuairaGallery],['alivio',GuairaRelief]]as const)
for(const reducedMotion of [false,true])test(`${id}: expanded scenery is read-only and obeys pause/reduced motion (${reducedMotion})`,t=>{
    const h=guairaBrowser(t,{reducedMotion});
    for(const surface of [h.window,h.document,h.canvas])Object.assign(surface,{removeEventListener(){}});
    const g=new Scene(h.canvas as unknown as HTMLCanvasElement,h.status as unknown as HTMLElement);
    const course=GUAIRA_COURSES[id],c=g.renderer.getContext();let calls:unknown[][]=[];
    c.fillRect=(x,y,w,height)=>calls.push([c.fillStyle,x,y,w,height]);
    const paint=()=>{
        calls=[];const state=JSON.stringify({player:g.player.data,objects:g.objects,tiles:g.level.data.tiles,save:g.store.save});
        g.art.background(c,{id:1}as never,course.start+48,course.floor-140,g.time);
        assert.equal(JSON.stringify({player:g.player.data,objects:g.objects,tiles:g.level.data.tiles,save:g.store.save}),state);
        return calls;
    };
    g.time=g.objects.time=6400;const first=paint();g.time=g.objects.time=23700;
    if(reducedMotion)assert.deepEqual(paint(),first);
    g.time=g.objects.time=6400;assert.deepEqual(paint(),first);
    h.window.dispatch('blur');assert.equal(g.state,'paused');
    for(let i=0;i<120;i++)g.update(1000/60);
    assert.deepEqual(paint(),first);g.dispose();
});
