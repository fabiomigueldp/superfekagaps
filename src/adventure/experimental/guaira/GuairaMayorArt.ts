/** Original, code-native art for the isolated Guaíra mayor experiment.
 * Art consumes readonly state. Collision, targeting and timing belong to the model.
 * The fictional role has no canonical personal name. Purple is cloth; water is cyan.
 */
export const MAYOR_PALETTE = Object.freeze({
    ink:'#453943', cream:'#efd5ae', creamLight:'#fff0cf', creamShade:'#c49e79', creamDark:'#9c7b64',
    skin:'#c58359', skinLight:'#efb87b', skinShade:'#9d6149', hair:'#716971', hairLight:'#95888c',
    sash:'#5c3f5e', sashLight:'#81617c', pants:'#52677e', pantsLight:'#75889b', pantsShade:'#3c4d63',
    boot:'#5f4840', bootLight:'#8b6750', sole:'#493a35', dust:'#b88959',
    bronze:'#bd8b4a', bronzeLight:'#e9be78', bronzeShade:'#855d3e', wood:'#a66542', woodLight:'#d29661',
    water:'#62bcca', waterLight:'#b9e9df', waterShade:'#397e90', warning:'#eebd69',
});
export type MayorPose = 'intro'|'idle'|'warning'|'stamp'|'recover'|'hurt'|'released';
export interface MayorRect { readonly x:number; readonly y:number; readonly width:number; readonly height:number }
export interface GuairaMayorArtState extends MayorRect {
    readonly state: MayorPose;
    readonly stateTick:number;
    readonly tick:number;
    readonly vulnerable?:boolean;
    readonly accessRequested?:boolean;
    readonly stampTarget:MayorRect|null;
    readonly publicWaterOpen:boolean;
    readonly sealsRemaining:number;
    readonly warningProgress?:number;
}

type Brush = ReturnType<typeof brush>;
const P = MAYOR_PALETTE;
function brush(c:CanvasRenderingContext2D) {
    const rect=(x:number,y:number,w:number,h:number,color:string)=>{ if(w<=0||h<=0)return; c.fillStyle=color;c.fillRect(Math.round(x),Math.round(y),Math.round(w),Math.round(h)); };
    const line=(x0:number,y0:number,x1:number,y1:number,color:string,width=1)=>{
        const n=Math.max(Math.abs(x1-x0),Math.abs(y1-y0),1);
        for(let i=0;i<=n;i++)rect(x0+(x1-x0)*i/n,y0+(y1-y0)*i/n,width,width,color);
    };
    const poly=(points:readonly (readonly [number,number])[],color:string)=>{
        const min=Math.min(...points.map(p=>p[1])),max=Math.max(...points.map(p=>p[1]));
        for(let y=Math.ceil(min);y<max;y++){
            const xs:number[]=[];
            for(let i=0;i<points.length;i++){const a=points[i],b=points[(i+1)%points.length];if((a[1]<=y&&b[1]>y)||(b[1]<=y&&a[1]>y))xs.push(a[0]+(y-a[1])/(b[1]-a[1])*(b[0]-a[0]));}
            xs.sort((a,b)=>a-b);for(let i=0;i+1<xs.length;i+=2)rect(Math.ceil(xs[i]),y,Math.floor(xs[i+1])-Math.ceil(xs[i])+1,1,color);
        }
    };
    return {rect,line,poly};
}
function wheel(b:Brush,x:number,y:number,flat=false){
    const {rect:r}=b;
    if(flat){
        r(x+2,y,9,1,P.ink);r(x,y+1,13,4,P.bronzeShade);r(x+1,y+1,11,3,P.bronze);
        r(x+3,y+2,3,1,P.ink);r(x+8,y+2,3,1,P.ink);r(x+5,y+1,3,3,P.bronzeLight);r(x+2,y+4,9,1,P.ink);return;
    }
    // A stepped circular rim with genuine transparent quadrants between four spokes.
    for(let yy=0;yy<15;yy++)for(let xx=0;xx<15;xx++){
        const d=(xx-7)*(xx-7)+(yy-7)*(yy-7);
        if(d>56||d<28)continue;
        r(x+xx-1,y+yy-1,1,1,d>44?P.ink:xx+yy<13?P.bronzeLight:P.bronze);
    }
    b.line(x+6,y+1,x+6,y+11,P.bronze);b.line(x+1,y+6,x+11,y+6,P.bronze);
    r(x+5,y+5,3,3,P.bronzeLight);r(x+6,y+6,1,1,P.bronzeShade);
}
function key(b:Brush,x:number,y:number,flat=false){
    if(flat){b.rect(x-19,y+1,25,3,P.ink);b.rect(x-18,y+1,21,1,P.bronzeLight);b.rect(x-18,y+2,21,1,P.bronze);wheel(b,x,y-1,true);return;}
    b.rect(x+5,y+11,3,26,P.ink);b.rect(x+5,y+12,2,23,P.bronze);b.rect(x+5,y+12,1,21,P.bronzeLight);b.rect(x+4,y+35,5,2,P.bronzeShade);wheel(b,x,y);
}
function stamp(b:Brush,x:number,y:number){
    const {rect:r}=b;
    r(x+3,y,5,2,P.ink);r(x+4,y+1,3,6,P.wood);r(x+4,y+1,1,4,P.woodLight);
    r(x,y+6,12,7,P.ink);r(x+1,y+6,10,5,P.wood);r(x+1,y+6,10,1,P.woodLight);
    r(x+2,y+8,8,3,P.sash);r(x+4,y+8,3,2,P.creamShade);r(x+1,y+12,10,1,P.ink);
}
function face(b:Brush,x:number,y:number,mood:'calm'|'frown'|'effort'|'surprise'){
    const {rect:r}=b;
    r(x+2,y,10,1,P.ink);r(x,y+1,13,11,P.ink);r(x+1,y+2,11,9,P.skin);
    r(x+3,y+3,9,5,P.skinLight);r(x+12,y+6,2,3,P.skin);r(x+12,y+6,1,1,P.skinLight);
    r(x+1,y+1,11,3,P.hair);r(x+2,y,8,2,P.hairLight);r(x,y+3,3,5,P.hair);r(x+1,y+4,1,2,P.hairLight);
    r(x+1,y+8,2,2,P.skinShade);r(x+5,y+11,6,2,P.skinShade);
    if(mood==='surprise'){
        r(x+5,y+5,3,3,P.creamLight);r(x+9,y+5,3,3,P.creamLight);r(x+7,y+6,1,2,P.ink);r(x+11,y+6,1,2,P.ink);r(x+8,y+9,3,3,P.ink);r(x+9,y+9,1,1,P.skinLight);
    }else{
        r(x+5,y+6,3,2,P.creamLight);r(x+9,y+6,3,2,P.creamLight);r(x+7,y+6,1,2,P.ink);r(x+11,y+6,1,2,P.ink);
        r(x+4,y+5,4,1,P.ink);r(x+9,y+5,3,1,P.ink);
        if(mood==='frown'){r(x+6,y+6,2,1,P.ink);r(x+9,y+6,1,1,P.ink);}
        r(x+7,y+10,5,1,P.skinShade);
        if(mood==='effort')r(x+8,y+9,4,2,P.creamLight);
    }
}
function boot(b:Brush,x:number,y:number,width=10){
    b.rect(x+1,y,width-2,6,P.ink);b.rect(x+1,y+1,width-3,4,P.boot);b.rect(x+2,y+1,width-5,1,P.bootLight);
    b.rect(x,y+4,width,3,P.sole);b.rect(x+1,y+4,width-2,2,P.boot);b.rect(x+1,y+5,3,1,P.dust);b.rect(x+width-3,y+5,2,1,P.dust);
}
function standingLegs(b:Brush,wide=false){
    const spread=wide?2:0;
    b.poly([[-8,-17],[0,-17],[-2-spread,-5],[-9-spread,-5]],P.ink);b.poly([[-7,-16],[-1,-16],[-3-spread,-6],[-8-spread,-6]],P.pantsShade);
    b.poly([[1,-17],[9,-16],[12+spread,-5],[4+spread,-5]],P.ink);b.poly([[2,-16],[8,-15],[11+spread,-6],[5+spread,-6]],P.pants);b.line(5,-14,8+spread,-8,P.pantsLight,2);
    boot(b,-12-spread,-7,11);boot(b,3+spread,-7,12);
}
function coat(b:Brush,lean=0){
    b.poly([[-11,-30],[-3,-32],[8+lean,-29],[11+lean,-13],[3,-15],[-2,-13],[-13,-13]],P.ink);
    b.poly([[-10,-29],[-3,-31],[7+lean,-28],[9+lean,-15],[3,-16],[-2,-14],[-11,-14]],P.creamShade);
    b.poly([[-8,-29],[-2,-31],[5+lean,-28],[7+lean,-16],[1,-17],[-2,-14],[-8,-15]],P.cream);
    b.poly([[-3,-31],[1,-25],[4,-30]],P.creamLight);b.line(-8,-27,-4,-28,P.creamLight,2);
    b.poly([[4,-29],[8,-28],[-8,-16],[-10,-18]],P.sash);b.line(4,-28,-6,-18,P.sashLight);
    b.rect(2,-20,2,2,P.bronze);b.rect(3,-16,2,2,P.bronzeShade);
}
function neutral(b:Brush,pose:MayorPose,tick:number,reduced:boolean){
    const {rect:r}=b;standingLegs(b,pose==='warning');
    key(b,-25,-40);
    coat(b);
    // Back arm holds the gate key at waist height.
    b.poly([[-10,-28],[-15,-27],[-18,-17],[-12,-15],[-8,-23]],P.ink);b.poly([[-11,-27],[-14,-26],[-16,-18],[-12,-17],[-9,-23]],P.cream);
    r(-17,-18,5,4,P.skinShade);r(-17,-18,4,2,P.skinLight);
    if(pose==='warning'){
        // Elbow and forearm create an open triangle, not a rotated idle arm.
        b.poly([[7,-29],[13,-27],[15,-36],[11,-42],[7,-40],[10,-35]],P.ink);
        b.poly([[8,-29],[12,-29],[13,-35],[10,-40],[8,-39],[11,-35]],P.cream);r(8,-42,5,4,P.skin);r(9,-42,3,2,P.skinLight);
        stamp(b,5,-50);
        face(b,-6,-40,'frown');
        // Three fixed blocks communicate the warning even with motion reduced.
        r(20,-47,2,4,P.warning);r(23,-43,4,2,P.warning);r(21,-39,2,2,P.warning);
    }else{
        b.poly([[7,-28],[12,-26],[14,-16],[8,-15],[5,-23]],P.ink);b.poly([[8,-27],[11,-25],[12,-18],[8,-17],[6,-23]],P.cream);
        r(9,-18,5,4,P.skin);r(10,-18,3,2,P.skinLight);stamp(b,9,-14);
        face(b,-6,-40,'calm');
        if(!reduced&&Math.floor(tick/120)%5===4)r(0,-34,6,1,P.skin);
    }
}
function stamping(b:Brush){
    const {rect:r}=b;standingLegs(b,true);key(b,-25,-35);
    // A forward chest and bent knee make a diagonal strike silhouette.
    b.poly([[-12,-29],[-5,-34],[8,-29],[12,-16],[4,-14],[-11,-17]],P.ink);
    b.poly([[-11,-28],[-5,-32],[7,-28],[10,-18],[3,-16],[-10,-18]],P.creamShade);
    b.poly([[-10,-28],[-4,-31],[5,-27],[7,-19],[-3,-18],[-10,-20]],P.cream);
    b.poly([[1,-31],[8,-28],[-9,-19],[-11,-22]],P.sash);b.line(1,-30,-9,-21,P.sashLight);
    face(b,-2,-38,'frown');
    b.poly([[8,-28],[14,-26],[18,-12],[11,-10],[7,-22]],P.ink);b.poly([[9,-27],[13,-25],[16,-13],[12,-12],[8,-22]],P.cream);r(13,-13,6,4,P.skin);r(14,-13,4,2,P.skinLight);
    stamp(b,12,-12);
    r(-19,-17,5,4,P.skin);r(-18,-17,3,2,P.skinLight);
}
function coveredRecovery(b:Brush){
    const {rect:r}=b;standingLegs(b,true);coat(b,1);face(b,-3,-40,'effort');
    // First effort stays upright and guarded. It is not an invitation to stomp.
    b.poly([[7,-28],[13,-25],[18,-12],[13,-10],[7,-21]],P.ink);
    b.poly([[8,-27],[12,-24],[16,-12],[14,-12],[8,-21]],P.cream);
    b.poly([[-10,-26],[-5,-26],[9,-12],[5,-10],[-10,-21]],P.creamShade);
    stamp(b,10,-12);r(9,-13,10,4,P.skinShade);r(10,-13,8,2,P.skinLight);r(14,-12,1,2,P.skinShade);
    key(b,-22,-2,true);
}
function recovering(b:Brush,vulnerable:boolean){
    const {rect:r}=b;
    // The back, supported by bent legs, stays exactly on the model's top plane.
    b.poly([[-8,-18],[0,-16],[-4,-7],[-12,-5],[-15,-8]],P.ink);b.poly([[-8,-17],[-1,-16],[-5,-8],[-12,-7]],P.pantsShade);
    b.poly([[2,-19],[10,-18],[9,-9],[13,-6],[5,-5],[1,-11]],P.ink);b.poly([[3,-18],[9,-17],[7,-10],[11,-7],[6,-7],[2,-11]],P.pants);
    boot(b,-16,-7,12);boot(b,4,-7,12);
    b.poly([[-11,-38],[-6,-40],[1,-40],[11,-31],[8,-16],[-1,-14],[-15,-22]],P.ink);
    b.poly([[-10,-37],[-6,-39],[0,-39],[10,-30],[7,-18],[-1,-16],[-13,-22]],P.creamShade);
    b.poly([[-9,-37],[-5,-39],[0,-39],[7,-31],[4,-22],[-3,-20],[-12,-24]],P.cream);
    b.line(-6,-39,0,-39,vulnerable?P.creamLight:P.cream);
    b.poly([[-10,-34],[-7,-37],[8,-26],[7,-22]],P.sash);b.line(-8,-34,5,-25,P.sashLight);
    face(b,5,-33,'effort');
    // Both hands pull a square stamp visibly stuck in the low control plate.
    b.poly([[9,-25],[15,-25],[20,-11],[14,-9],[9,-18]],P.ink);b.poly([[10,-24],[14,-23],[18,-12],[15,-11],[10,-18]],P.cream);
    b.poly([[2,-24],[7,-22],[12,-11],[7,-10],[1,-18]],P.creamShade);
    stamp(b,10,-12);r(10,-13,10,4,P.skinShade);r(11,-13,8,2,P.skinLight);r(15,-12,1,2,P.skinShade);
    key(b,-22,-2,true);
    // One small cyan sweat pixel is decorative, never the vulnerability cue.
    r(22,-30,1,2,P.water);r(21,-28,2,1,P.water);
}
function released(b:Brush){
    const {rect:r}=b;
    // Seated, unarmed and visibly surprised; no violent defeat treatment.
    b.poly([[-12,-11],[-4,-15],[7,-14],[14,-5],[9,-2],[-7,-3],[-15,-6]],P.ink);
    b.poly([[-11,-10],[-3,-13],[6,-12],[11,-5],[8,-4],[-7,-5],[-13,-7]],P.pants);boot(b,-16,-7,11);boot(b,9,-7,11);
    b.poly([[-10,-26],[5,-27],[11,-18],[8,-9],[-12,-9],[-15,-19]],P.ink);
    b.poly([[-9,-25],[4,-26],[9,-17],[7,-11],[-11,-11],[-13,-19]],P.cream);b.poly([[1,-26],[6,-23],[-9,-13],[-12,-15]],P.sash);
    face(b,-6,-36,'surprise');
    r(-17,-21,6,3,P.creamShade);r(-20,-21,4,4,P.skin);r(9,-22,6,3,P.cream);r(14,-22,4,4,P.skinLight);
    key(b,-23,-2,true);stamp(b,21,-11);
}

/** Feet are always y+height. The base art uses a 28×40 body; props are non-colliding. */
export function drawGuairaMayor(c:CanvasRenderingContext2D,m:GuairaMayorArtState,cx=0,cy=0,reducedMotion=false){
    if(![m.x,m.y,m.width,m.height,cx,cy].every(Number.isFinite))return;
    c.save();c.translate(Math.round(m.x+m.width/2-cx),Math.round(m.y+m.height-cy));c.scale(-1,1);
    const b=brush(c);
    if(m.state==='released')released(b);
    else if(m.state==='recover'){if(m.vulnerable)recovering(b,true);else coveredRecovery(b);}
    else if(m.state==='stamp')stamping(b);
    else if(m.state==='hurt'){
        recovering(b,false);
        // Clear recoil face and separated hands, no whole-body rotation or flashing.
        face(b,4,-36,'surprise');b.rect(20,-18,4,3,P.skinLight);b.rect(-17,-25,4,3,P.skin);
    }else neutral(b,m.state,m.tick,reducedMotion);
    c.restore();
}

/** Warning and active ink never extend beyond the model's exact locked rectangle. */
export function drawGuairaMayorStampTarget(c:CanvasRenderingContext2D,m:GuairaMayorArtState,cx=0,cy=0,_reducedMotion=false){
    const q=m.stampTarget;if(!q||(m.state!=='warning'&&m.state!=='stamp'))return;
    if(![q.x,q.y,q.width,q.height,cx,cy].every(Number.isFinite)||q.width<=0||q.height<=0)return;
    const x=Math.round(q.x-cx),y=Math.round(q.y-cy),w=Math.round(q.width),h=Math.round(q.height);
    c.save();c.beginPath();c.rect(x,y,w,h);c.clip();const b=brush(c),r=b.rect;
    if(m.state==='warning'){
        for(let xx=0;xx<w;xx+=8){r(x+xx,y,4,1,P.warning);r(x+xx,y+h-3,4,3,P.warning);}
        r(x,y,2,h,P.warning);r(x+w-2,y,2,h,P.warning);
        // Downward chevrons tie the fixed marked region to a closing order.
        for(let xx=13;xx<w-10;xx+=28){b.line(x+xx-3,y+5,x+xx,y+8,P.warning);b.line(x+xx,y+8,x+xx+3,y+5,P.warning);}
        // Eight pressure slots fill from the simulation's warning clock. They
        // stay inside the already warned vent and remain legible without motion.
        const progress=Number.isFinite(m.warningProgress)?Math.max(0,Math.min(1,m.warningProgress!)):0;
        const span=Math.max(0,w-8),filled=Math.floor(span*progress);
        r(x+4,y+h-8,span,4,P.ink);
        for(let i=0;i<8;i++){
            const start=Math.floor(i*span/8),end=Math.floor((i+1)*span/8)-2;
            r(x+4+start,y+h-7,Math.max(0,end-start),2,P.bronzeShade);
            r(x+4+start,y+h-7,Math.max(0,Math.min(end,filled)-start),2,P.warning);
        }
    }else{
        r(x,y,w,h,P.waterShade);r(x,y,w,1,P.waterLight);
        for(let xx=0;xx<w;xx+=8){r(x+xx,y+3,4,h-3,P.water);r(x+xx+1,y+2,2,Math.max(1,h-6),P.waterLight);}
        r(x,y,2,h,P.waterLight);r(x+w-2,y,2,h,P.waterLight);r(x,y+h-2,w,2,P.waterLight);
    }
    c.restore();
}
