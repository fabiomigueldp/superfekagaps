/** Authored native animation plates. Positions, fractures and shot poses are
 * staged, not obtained from a gameplay run. No assertions or browser. */
import {mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {sceneLifecycleBrowser} from '../tests/helpers/sceneLifecycleHarness';
import {HypotheticalModel} from '../src/adventure/hipotetico/HypotheticalModel';
import {hypotheticalStage} from '../src/adventure/hipotetico/HypotheticalStage';
import {WorldLevel} from '../src/adventure/WorldPhysics';
import {drawHypotheticalBackground,drawHypotheticalTerrain,drawHypotheticalCombat,drawHypotheticalDinosaur,dinosaurPose} from '../src/adventure/hipotetico/HypotheticalArt';
import {CHASE_BREAKS} from '../src/adventure/hipotetico/HypotheticalLayout';
import {CHASE_STRIKE_REACH,chasePerformance} from '../src/adventure/hipotetico/HypotheticalChasePerformance';
import {chaseCollapsedEdge} from '../src/adventure/hipotetico/HypotheticalChaseDetails';
import {pixelText} from '../src/graphics/BitmapFont';
import {dinosaurFootAnchor} from '../src/adventure/hipotetico/HypotheticalMotion';

const [destination,canvasModule]=process.argv.slice(2),out=resolve(destination),stills=process.argv.includes('--stills');
mkdirSync(join(out,'frames'),{recursive:true});
const {createCanvas}=await import(pathToFileURL(resolve(canvasModule)).href);
const clean:Array<()=>void>=[],h=sceneLifecycleBrowser({after:f=>clean.push(f as ()=>void)}),create=h.document.createElement;
h.document.createElement=((tag:string)=>tag==='canvas'?createCanvas(1,1):create(tag)) as typeof create;
const screen=createCanvas(320,180),c=screen.getContext('2d');c.imageSmoothingEnabled=false;
const film=createCanvas(960,588),fc=film.getContext('2d');fc.imageSmoothingEnabled=false;
const board=createCanvas(1280,816),bc=board.getContext('2d');bc.imageSmoothingEnabled=false;
const poses=createCanvas(1280,408),pc=poses.getContext('2d');pc.imageSmoothingEnabled=false;
bc.fillStyle=pc.fillStyle='#122830';bc.fillRect(0,0,1280,816);pc.fillRect(0,0,1280,408);
const scenes=[{index:0,name:'madeira'},{index:1,name:'guindaste'},{index:3,name:'comporta'},{index:5,name:'portico'}];
let movieFrame=0;
const records:object[]=[];
try{
    for(const [row,scene]of scenes.entries()){
        const site=CHASE_BREAKS[scene.index],stage=hypotheticalStage('chase'),level=new WorldLevel(stage.level),b=new HypotheticalModel('chase');
        const origin=site.x-CHASE_STRIKE_REACH,impactAt=744,speed=3.5;
        b.state='rest';b.age=80;b.facing=1;b.motionSpeed=speed;b.velocity=speed;
        let erased=0;
        for(let frame=0;frame<150;frame++){
            const age=frame-24,tick=720+frame;b.tick=tick;
            b.x=origin+age*speed;b.travel=b.x+18;
            b.chaseBreaks=CHASE_BREAKS.map((_,i)=>i<scene.index?-1000:i===scene.index&&age>=0?impactAt:-1);
            b.chaseReactions=b.chaseReactions.map((_,i)=>i*400<site.x?680:-1);
            b.bridgeDebris=[];b.dust=[];
            const edge=chaseCollapsedEdge(b.x)/16;
            while(erased<edge){for(let y=13;y<18;y++)level.data.tiles[y][erased]=0;erased++;}
            for(let col=Math.max(0,edge-5);col<edge;col++)if(stage.level.tiles[14][col]){
                const born=tick-Math.floor((b.x-32-(col+1)*16)/speed);
                b.bridgeDebris.push({x:col*16,born,material:Math.floor(col*16/1120)});
            }
            const lastStep=Math.floor(b.travel/(Math.PI*11));
            for(let s=lastStep-1;s<=lastStep;s++){
                const stepTravel=s*Math.PI*11,foot=dinosaurFootAnchor(stepTravel/11,s%2===1,1,0,0);
                const since=(b.travel-stepTravel)/speed;
                b.dust.push({kind:'step',x:b.x-since*speed+foot[0]+3,y:224,born:tick-since});
            }
            const cx=b.x-40-chasePerformance(b).framing;
            const paint=(reduced=false)=>{
                drawHypotheticalBackground(c,b,cx,64,reduced);drawHypotheticalTerrain(c,level,b,cx,64);
                drawHypotheticalCombat(c,b,cx,64,reduced);
            };
            const column=[-7,3,20,40].indexOf(age);
            if(!stills&&frame%2===0){
                paint();fc.fillStyle='#122830';fc.fillRect(0,0,960,588);fc.drawImage(screen,0,48,960,540);
                pixelText(fc,scene.name.toUpperCase()+' / PREPARAR - ATINGIR - ATRAVESSAR',14,11,'#e2c28b',2);
                pixelText(fc,'COMPOSICAO DIRIGIDA / TEMPO NATIVO / SEM SIMULACAO DE PARTIDA',14,34,'#afc1b5');
                writeFileSync(join(out,'frames',String(movieFrame++).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
            }
            if(column>=0){
                paint();const file=scene.name+'-'+column+'.png';writeFileSync(join(out,file),screen.toBuffer('image/png'));
                const x=column*320,y=row*204;bc.drawImage(screen,x,y+24);
                pixelText(bc,scene.name.toUpperCase()+' / '+['PREPARAR','CONTATO','QUEDA','PASSAGEM'][column],x+7,y+8,'#e2c28b');
                records.push({file,age,cameraX:cx,bossX:b.x});
                if(row===1){
                    pc.fillStyle='#263f48';pc.fillRect(column*320,28,320,360);
                    const pose=dinosaurPose(b,b.x-150,64);
                    const sprite=createCanvas(320,180),sc=sprite.getContext('2d');sc.imageSmoothingEnabled=false;
                    drawHypotheticalDinosaur(sc,pose);pc.drawImage(sprite,60,24,160,150,column*320,48,320,300);
                    pixelText(pc,['ANTECIPACAO','IMPACTO','REACAO','RETOMADA'][column],column*320+8,12,'#e2c28b',2);
                }
                if(column===1){paint(true);writeFileSync(join(out,scene.name+'-reduced.png'),screen.toBuffer('image/png'));}
            }
        }
        console.log('Composed '+scene.name);
    }
    // A separate isolated plate keeps the complete tail and stride visible.
    const b=new HypotheticalModel('chase');b.x=440;b.state='attack';b.attack='rifle';b.facing=1;b.motionSpeed=3.5;b.velocity=3.5;
    for(let frame=0;frame<180;frame+=2){
        if(stills)break;
        b.tick=900+frame;b.age=30+frame;b.travel=frame*3.5;b.targetX=b.x+240;b.targetY=145;
        b.muzzle=frame%36<6?5-frame%6:0;
        c.fillStyle='#263f48';c.fillRect(0,0,320,180);
        drawHypotheticalCombat(c,b,b.x-154,64,false);
        fc.fillStyle='#122830';fc.fillRect(0,0,960,588);fc.drawImage(screen,0,48,960,540);
        pixelText(fc,'PASSADA / CAVALEIRO / RECUO DA ARMA',14,11,'#e2c28b',2);
        pixelText(fc,'ESTUDO DE POSE EM MOVIMENTO / SEM COMBATE',14,34,'#afc1b5');
        writeFileSync(join(out,'frames',String(movieFrame++).padStart(5,'0')+'.png'),film.toBuffer('image/png'));
    }
    writeFileSync(join(out,'chase-impacts.png'),board.toBuffer('image/png'));
    writeFileSync(join(out,'rider-motion.png'),poses.toBuffer('image/png'));
    writeFileSync(join(out,'art-study.json'),JSON.stringify({kind:'directed native chase animation',fps:30,frames:movieFrame,
        gameplay:false,browser:false,audio:false,records,
        scope:'Authored positions, fracture ages and terrain masks; native motion, destruction, geometry, particles and framing. No gameplay validation.'},null,2));
}finally{for(const cleanup of clean.reverse())cleanup();}
