import test from 'node:test';
import assert from 'node:assert/strict';
import { drawGuairaFacadeFinish, drawGuairaTiledRoof } from '../src/adventure/experimental/guaira/GuairaBuildingFinish';
import { drawGuairaWorkshopWall } from '../src/adventure/experimental/guaira/GuairaWorkshopBackground';
import { drawGuairaCorralOutbuildings } from '../src/adventure/experimental/guaira/GuairaCorralScenery';
import { drawMayorTown, drawMayorCivicRoom } from '../src/adventure/experimental/guaira/GuairaMayorTownArt';
import { drawRespirosBackground } from '../src/adventure/experimental/guaira/respiros/GuairaRespirosArt';
import { drawJunctionBackground } from '../src/adventure/experimental/guaira/junction/GuairaJunctionArt';
import { JunctionRouting } from '../src/adventure/experimental/guaira/junction/GuairaJunctionModel';

class Pixels {
    fillStyle='';globalAlpha=1;globalCompositeOperation='source-over';pixels=Array<string>(320*180).fill('');
    bounds=[0,0,320,180];pending=this.bounds;
    stack:Array<{fillStyle:string;globalAlpha:number;globalCompositeOperation:string;bounds:number[]}>=[];
    save(){this.stack.push({fillStyle:this.fillStyle,globalAlpha:this.globalAlpha,globalCompositeOperation:this.globalCompositeOperation,bounds:this.bounds});}
    restore(){Object.assign(this,this.stack.pop());}
    beginPath(){}
    rect(x:number,y:number,w:number,h:number){this.pending=[x,y,x+w,y+h];}
    clip(){this.bounds=this.bounds.map((v,i)=>i<2?Math.max(v,this.pending[i]):Math.min(v,this.pending[i]));}
    fillRect(x:number,y:number,w:number,h:number){
        assert.ok([x,y,w,h].every(Number.isInteger),'Architecture remains on the native pixel grid');
        const left=Math.max(this.bounds[0],x),right=Math.min(this.bounds[2],x+w);if(right<=left)return;
        for(let yy=Math.max(this.bounds[1],y);yy<Math.min(this.bounds[3],y+h);yy++)this.pixels.fill(this.fillStyle,yy*320+left,yy*320+right);
    }
    get c(){return this as unknown as CanvasRenderingContext2D;}
    at(x:number,y:number){return this.pixels[y*320+x];}
}

for(const id of ['galeria','alivio']as const)test(`${id}: old and expanded workshop courses form one world-anchored wall`,()=>{
    const a=new Pixels(),b=new Pixels();
    drawGuairaWorkshopWall(a.c,id,560,96);drawGuairaWorkshopWall(b.c,id,597,117);
    for(let y=0;y<159;y++)for(let x=0;x<283;x++)assert.equal(b.at(x,y),a.at(x+37,y+21),'No cornice follows the screen instead of the wall');
    assert.ok(a.pixels.every(Boolean));assert.ok(b.pixels.every(Boolean));
});

for(const width of [56,94,161])test(`facade ${width}px: tiled eave, continuous drain and footing stay connected when clipped`,()=>{
    const paint=(x:number,y:number)=>{const p=new Pixels();drawGuairaTiledRoof(p.c,x,y,width);drawGuairaFacadeFinish(p.c,x,y+17,width,y+87);return p;};
    const a=paint(40,35),b=paint(-3,22);
    for(let y=0;y<167;y++)for(let x=0;x<277;x++)assert.equal(b.at(x,y),a.at(x+43,y+13));
    for(let y=51;y<124;y++)assert.ok(a.at(40+width-8,y),'The drain must reach both the eave and the foundation');
    assert.ok(!a.pixels.includes('#f2d69b'),'Scenery does not borrow the safe landing cap');
});

test('corral motion stays within the fixed wheel and above the combat lane',()=>{
    const paint=(time:number,reduced=false)=>{const p=new Pixels();drawGuairaCorralOutbuildings(p.c,0,64,time,reduced);return p;};
    const first=paint(0),later=paint(2500);let differences=0;
    for(let y=0;y<180;y++)for(let x=0;x<320;x++)if(first.at(x,y)!==later.at(x,y)){
        differences++;assert.ok(x>=228&&x<=248&&y>=74&&y<=94,'Only the wheel turns; buildings, footing and axle remain fixed');
    }
    assert.ok(differences>20);assert.deepEqual(paint(2500,true).pixels,first.pixels);
    assert.ok(first.pixels.slice(110*320).every(p=>!p),'The quiet y174 combat field stays clear');
});

test('mayor washing posts reach their masonry and rain-chain links meet the eave and drain shoe',()=>{
    const street=new Pixels();drawMayorTown(street.c,0,64,2000,false);
    for(const x of [12,40])for(let y=178;y<192;y++)assert.equal(street.at(x,y-64),'#a99a7c');
    const room=new Pixels();drawMayorCivicRoom(room.c,0,64,2000,false);
    for(let y=103;y<159;y++)assert.ok(room.at(316,y-64),`The rain chain is disconnected at ${y}`);
});

test('Respiros paddy slopes into the continuation instead of ending in a vertical screen-wide earth slab',()=>{
    const p=new Pixels();drawRespirosBackground(p.c,1000,144,0,true);
    assert.equal(p.at(130,146),'#c4946c','The soil continues beneath the sloping bank');
    for(let y=96;y<142;y++)assert.notEqual(p.at(151,y),'#c4946c','No earth wall at the x1152 district join');
});

test('the Patio final paddy has a complete sloping toe inside its district instead of a clipped edge',()=>{
    const p=new Pixels();drawJunctionBackground(p.c,800,60,0,true,new JunctionRouting());
    for(let x=154;x<160;x++)for(let y=106;y<148;y++)
        assert.ok(!['#b7a078','#aa956f'].includes(p.at(x,y)),'The bank ends before x960');
    assert.equal(p.at(147,144),'#aa956f','A visible sloping side remains before the join');
});
