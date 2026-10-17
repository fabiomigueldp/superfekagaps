import { mayorStampWater, mayorWaveWater, mayorJetWater, mayorRushWater } from './GuairaMayorWater';
import type { MayorSalvo, MayorFeedback, MayorRush, MayorState } from './GuairaMayorModel';

/** Original, code-native art for the Guaíra mayor encounter.
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
export type MayorPose = MayorState;
export interface MayorRect { readonly x:number; readonly y:number; readonly width:number; readonly height:number }
export interface MayorCounterpressure {
    readonly phase:'warning'|'active';
    readonly rect:Readonly<MayorRect>;
    readonly ticksRemaining:number;
    readonly progress:number;
}
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
    readonly opening?:Readonly<MayorRect>;
    readonly recoveryProgress?:number;
    readonly counterpressure?:Readonly<MayorCounterpressure>|null;
    readonly facing?:-1|1;
    readonly motionProgress?:number;
    readonly waveWarning?:boolean;
    readonly waves?:readonly (MayorRect & {readonly direction:-1|1;readonly age:number})[];
    readonly canOpenRegister?:boolean;
    readonly salvo?:Readonly<MayorSalvo>|null;
    readonly jets?:readonly (MayorRect & {readonly direction:-1|1;readonly age:number})[];
    readonly pressureInterrupted?:boolean;
    readonly feedback?:readonly Readonly<MayorFeedback>[];
    readonly rush?:Readonly<MayorRush>|null;
    readonly crossfire?:Readonly<MayorSalvo>|null;
    readonly attacksCancelled?:boolean;
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
function face(b:Brush,x:number,y:number,mood:'calm'|'frown'|'effort'|'surprise',blink=false){
    const {rect:r}=b;
    r(x+2,y,10,1,P.ink);r(x,y+1,13,11,P.ink);r(x+1,y+2,11,9,P.skin);
    r(x+3,y+3,9,5,P.skinLight);r(x+12,y+6,2,3,P.skin);r(x+12,y+6,1,1,P.skinLight);
    r(x+1,y+1,11,3,P.hair);r(x+2,y,8,2,P.hairLight);r(x,y+3,3,5,P.hair);r(x+1,y+4,1,2,P.hairLight);
    r(x+1,y+8,2,2,P.skinShade);r(x+5,y+11,6,2,P.skinShade);
    // Temple, ear and jaw are separate pixel clusters, not a flat skin block.
    r(x+2,y+5,1,3,P.skinLight);r(x+3,y+9,2,1,P.skinShade);r(x+4,y+10,2,1,P.skin);
    if(mood==='surprise'){
        r(x+5,y+5,3,3,P.creamLight);r(x+9,y+5,3,3,P.creamLight);r(x+7,y+6,1,2,P.ink);r(x+11,y+6,1,2,P.ink);r(x+8,y+9,3,3,P.ink);r(x+9,y+9,1,1,P.skinLight);
    }else{
        if(blink){
            r(x+5,y+6,3,2,P.skinLight);r(x+9,y+6,3,2,P.skinLight);
            r(x+5,y+7,3,1,P.skinShade);r(x+9,y+7,3,1,P.skinShade);
        }else{
            r(x+5,y+6,3,2,P.creamLight);r(x+9,y+6,3,2,P.creamLight);r(x+7,y+6,1,2,P.ink);r(x+11,y+6,1,2,P.ink);
        }
        r(x+4,y+5,4,1,P.ink);r(x+9,y+5,3,1,P.ink);
        if(mood==='frown'){r(x+6,y+6,2,1,P.ink);r(x+9,y+6,1,1,P.ink);}
        r(x+7,y+10,5,1,P.skinShade);
        r(x+8,y+8,4,1,P.hair);r(x+9,y+8,2,1,P.hairLight);
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
    b.rect(-4,-23,3,3,P.bronzeShade);b.rect(-4,-23,2,2,P.bronzeLight);b.rect(-3,-22,1,1,P.sash);
    b.line(5+lean,-25,6+lean,-19,P.creamLight);b.rect(2+lean,-22,3,1,P.creamDark);
    b.rect(2,-20,2,2,P.bronze);b.rect(3,-16,2,2,P.bronzeShade);b.line(-9,-19,-10,-16,P.creamDark);
}
/** Three authored arm silhouettes share the existing warning deadline.
 * The carimbo is already raised on the first tick. Feet, torso and head stay
 * planted; reduced motion holds the familiar fully raised warning throughout.
 */
function warningArm(b:Brush,progress:number|undefined,reduced:boolean){
    const {rect:r}=b;
    const beat=reduced||!Number.isFinite(progress)?2:Math.min(2,Math.floor(Math.max(0,Math.min(1,progress!))*3));
    if(beat===0){
        b.poly([[7,-29],[12,-26],[19,-29],[20,-37],[15,-38],[15,-32],[10,-33]],P.ink);
        b.poly([[8,-29],[12,-28],[17,-30],[18,-36],[16,-36],[16,-31],[10,-31]],P.cream);
        r(15,-37,5,4,P.skin);r(16,-37,3,2,P.skinLight);
    }else if(beat===1){
        b.poly([[7,-29],[13,-27],[18,-33],[16,-40],[12,-42],[9,-39],[13,-35],[11,-33]],P.ink);
        b.poly([[8,-29],[12,-29],[16,-34],[14,-39],[12,-40],[11,-39],[14,-35],[11,-31]],P.cream);
        r(12,-40,5,4,P.skin);r(13,-40,3,2,P.skinLight);
    }else{
        // Elbow and forearm create an open triangle, not a rotated idle arm.
        b.poly([[7,-29],[13,-27],[15,-36],[11,-42],[7,-40],[10,-35]],P.ink);
        b.poly([[8,-29],[12,-29],[13,-35],[10,-40],[8,-39],[11,-35]],P.cream);
        r(8,-42,5,4,P.skin);r(9,-42,3,2,P.skinLight);
    }
    const x=[12,9,5][beat],y=[-44,-48,-50][beat];
    stamp(b,x,y);
    // Solid marks accompany the raised tool, never blink or imply new danger.
    r(x+15,y+3,2,4,P.warning);r(x+18,y+7,4,2,P.warning);r(x+16,y+11,2,2,P.warning);
}
function neutral(b:Brush,pose:MayorPose,tick:number,reduced:boolean,warningProgress?:number){
    const {rect:r}=b;
    if(pose==='idle'&&!reduced){
        const stride=[0,2,4,2,0,-2,-4,-2][Math.floor(tick/4)%8];
        b.poly([[-8,-17],[0,-17],[-3+stride,-6],[-10+stride,-6]],P.ink);
        b.poly([[-7,-16],[-1,-16],[-4+stride,-7],[-9+stride,-7]],P.pantsShade);
        b.poly([[1,-17],[9,-16],[11-stride,-6],[3-stride,-6]],P.ink);
        b.poly([[2,-16],[8,-15],[10-stride,-7],[4-stride,-7]],P.pants);
        boot(b,-12+stride,-7,11);boot(b,3-stride,-7,12);
    }else standingLegs(b,pose==='warning');
    key(b,-25,-40);
    coat(b);
    // Back arm holds the gate key at waist height.
    b.poly([[-10,-28],[-15,-27],[-18,-17],[-12,-15],[-8,-23]],P.ink);b.poly([[-11,-27],[-14,-26],[-16,-18],[-12,-17],[-9,-23]],P.cream);
    r(-17,-18,5,4,P.skinShade);r(-17,-18,4,2,P.skinLight);
    if(pose==='warning'){
        warningArm(b,warningProgress,reduced);
        face(b,-6,-40,'frown');
    }else{
        b.poly([[7,-28],[12,-26],[14,-16],[8,-15],[5,-23]],P.ink);b.poly([[8,-27],[11,-25],[12,-18],[8,-17],[6,-23]],P.cream);
        r(9,-18,5,4,P.skin);r(10,-18,3,2,P.skinLight);stamp(b,9,-14);
        // Six simulation ticks (100 ms), not the old two-second partial mask.
        // Reduced motion keeps the eyes open; a paused tick repeats exactly.
        face(b,-6,-40,'calm',!reduced&&tick%300>=274&&tick%300<280);
    }
}
function stamping(base:Brush,compression=0){
    standingLegs(base,true);key(base,-25,-37);
    // Compress the torso into planted knees, never the boots through the deck.
    const b:Brush={rect:(x,y,w,h,color)=>base.rect(x,y+compression,w,h,color),
        line:(x0,y0,x1,y1,color,w)=>base.line(x0,y0+compression,x1,y1+compression,color,w),
        poly:(points,color)=>base.poly(points.map(([x,y])=>[x,y+compression] as const),color)};
    const {rect:r}=b;
    // A forward chest and bent knee make a diagonal strike silhouette.
    b.poly([[-12,-29],[-5,-34],[8,-29],[12,-16],[4,-14],[-11,-17]],P.ink);
    b.poly([[-11,-28],[-5,-32],[7,-28],[10,-18],[3,-16],[-10,-18]],P.creamShade);
    b.poly([[-10,-28],[-4,-31],[5,-27],[7,-19],[-3,-18],[-10,-20]],P.cream);
    b.poly([[1,-31],[8,-28],[-9,-19],[-11,-22]],P.sash);b.line(1,-30,-9,-21,P.sashLight);
    face(b,-2,-38,'frown');
    b.poly([[8,-28],[14,-26],[18,-12],[11,-10],[7,-22]],P.ink);b.poly([[9,-27],[13,-25],[16,-13],[12,-12],[8,-22]],P.cream);r(13,-13,6,4,P.skin);r(14,-13,4,2,P.skinLight);
    stamp(b,12,-13-compression);
    r(-19,-17,5,4,P.skin);r(-18,-17,3,2,P.skinLight);
}

/** The key winds the bypass shut, then the mayor throws his weight into an order.
 * Feet brace and the arms change silhouette; no whole-sprite rotation/scaling. */
function commanding(b:Brush,m:GuairaMayorArtState,reduced:boolean){
    const shot=m.salvo,release=m.state==='jetBurst';
    const beat=release?(m.stateTick<8?3:2):reduced?2:Math.min(2,Math.floor((shot?.progress??0)*3));
    standingLegs(b,true);coat(b,beat===3?3:0);
    key(b,beat>=2?-14:-24,beat>=2?-24:-40+beat*2,beat>=2);
    b.poly([[-10,-28],[-16,-26],[-20,-19],[-16,-15],[-8,-22]],P.ink);
    b.poly([[-10,-27],[-15,-25],[-18,-19],[-15,-17],[-9,-22]],P.creamShade);
    b.rect(-19,-19,5,4,P.skinLight);
    face(b,beat===3?-2:-6,-40,release?'effort':'frown');
    const handX=[13,19,27,24][beat],handY=[-35,-38,-30,-20][beat];
    b.poly([[7,-29],[12,-29],[handX+3,handY],[handX+4,handY+5],[12,-20],[7,-23]],P.ink);
    b.poly([[8,-28],[11,-28],[handX+2,handY+1],[handX+2,handY+3],[12,-22],[8,-24]],P.cream);
    stamp(b,handX-3,handY-8);b.rect(handX,handY,5,4,P.skin);b.rect(handX,handY,3,2,P.skinLight);
    // Each pip is a miniature pipe phrase: height and direction of every shot.
    // The current shot has a cream frame; spent shots remain quiet and readable.
    for(let i=0;i<(shot?.total??2);i++){
        const column=(m.facing??-1)===-1?(shot?.total??2)-1-i:i;
        const x=-14+column*11,entry=shot?.sequence?.[i],current=i===(shot?.shot??1)-1;
        b.rect(x,-52,10,9,P.ink);b.rect(x+1,-51,8,7,current?P.bronzeShade:P.creamDark);
        if(current){b.rect(x,-52,10,1,P.creamLight);b.rect(x,-44,10,1,P.creamLight);}
        const y=entry?.lane==='low'?-46:-49,dir=(entry?.direction??-1)*(m.facing??-1);
        const color=i<(shot?.shot??1)-1?P.creamShade:current?P.warning:P.creamLight;
        b.rect(x+2,y,6,1,color);
        const tip=x+(dir===1?7:2);b.rect(tip-dir,y-1,1,3,color);b.rect(tip-dir*2,y-2,1,1,color);b.rect(tip-dir*2,y+2,1,1,color);
    }
}
function interruptedRecovery(b:Brush,tick:number){
    // Three authored beats absorb the back-pressure, then return to the stuck
    // stamp pose. This is used only while the back is still guarded.
    const beat=Math.min(2,Math.floor(Math.max(0,tick)/6));
    standingLegs(b,true);coat(b,beat===0?-2:1);face(b,[-8,-5,-3][beat],-40,'surprise');
    key(b,-22,-4,true);
    b.poly([[-10,-27],[-18,-29],[-20,-23],[-12,-20]],P.ink);
    b.poly([[-10,-26],[-17,-27],[-18,-24],[-12,-22]],P.creamShade);
    b.rect(-21,-26,5,4,P.skinLight);
    const hand=[-32,-27,-19][beat];
    b.poly([[7,-28],[13,-27],[18,hand],[22,hand+4],[14,-19],[8,-21]],P.ink);
    b.poly([[8,-27],[12,-26],[18,hand+2],[19,hand+4],[13,-21],[9,-23]],P.cream);
    stamp(b,17,hand-7);b.rect(18,hand,5,4,P.skin);b.rect(19,hand,3,2,P.skinLight);
}

/** Planted anticipation, eight weight-shifting strides and a heel-first skid.
 * Boots and the low water crest share the floor; the loose sash trails the turn.
 * Reduced motion holds one readable pose but retains all physical travel. */
function rushing(b:Brush,m:GuairaMayorArtState,reduced:boolean){
    const rush=m.rush,warning=m.state==='rushWarning',braking=m.state==='brake';
    // Strides follow distance, so boots settle as the physical rush slows.
    const beat=reduced?2:Math.floor((rush?.distance??0)/6)%8;
    const stopping=!!rush?.stopping,skid=braking||stopping;
    const settle=braking&&!reduced?Math.min(1,m.stateTick/20):0;
    const stride=warning?2:skid?Math.round(8-settle*6):[-6,-2,4,8,6,2,-4,-8][beat];
    const lift=warning||skid?0:[4,6,3,0,0,1,3,5][beat];
    const landing=warning&&rush?.pass===1?Math.max(0,3-Math.floor(m.stateTick/3)):0;
    const compression=reduced?1:warning?Math.max(landing,Math.floor((rush?.progress??0)*3)):braking?Math.round(3*(1-settle)):stopping?2:1;
    b.poly([[-9,-16],[0,-16],[-5+stride,-7-lift],[-12+stride,-4-lift],[-15+stride,-9-lift]],P.ink);
    b.poly([[-8,-15],[-1,-15],[-6+stride,-8-lift],[-11+stride,-6-lift],[-13+stride,-9-lift]],P.pantsShade);
    b.poly([[0,-17],[8,-17],[13-stride,-7],[6-stride,-3],[0,-9]],P.ink);
    b.poly([[1,-16],[7,-16],[11-stride,-8],[6-stride,-5],[2,-10]],P.pants);
    b.line(6,-15,8-stride,-8,P.pantsLight,2);
    boot(b,-15+stride,-7-lift,11);boot(b,5-stride,-7,12);
    const lean=reduced?3:braking?Math.round(-3+settle*3):stopping?-3:warning?Math.floor((rush?.progress??0)*3):Math.round(Math.min(4,(rush?.speed??0)*.7));
    const upper:Brush={rect:(x,y,w,h,color)=>b.rect(x+lean,y+compression,w,h,color),
        line:(x0,y0,x1,y1,color,w)=>b.line(x0+lean,y0+compression,x1+lean,y1+compression,color,w),
        poly:(points,color)=>b.poly(points.map(([x,y])=>[x+lean,y+compression] as const),color)};
    coat(upper,4);face(upper,-1,-39,warning?'frown':'effort');
    // The back hand sweeps the key low; the forward elbow braces the stamp.
    key(upper,-22,-22,true);
    upper.poly([[-10,-27],[-17,-24],[-19,-19],[-13,-16],[-7,-23]],P.ink);
    upper.poly([[-10,-26],[-15,-23],[-17,-20],[-13,-18],[-8,-23]],P.creamShade);
    upper.rect(-19,-20,5,4,P.skinLight);
    upper.poly([[9,-27],[16,-25],[21,-16],[17,-12],[12,-19],[8,-21]],P.ink);
    upper.poly([[10,-26],[15,-24],[19,-16],[17,-14],[13,-20],[9,-22]],P.cream);
    stamp(upper,17,warning?-20:-17);upper.rect(17,-17,5,4,P.skin);upper.rect(18,-17,3,2,P.skinLight);
    const tail=reduced?-1:warning?-1:braking?Math.round(3-settle*4):stopping?2:[-3,-2,0,1,0,-2,-3,-4][beat];
    upper.poly([[-7,-21],[-13,-18],[-24,-20+tail],[-29,-24+tail],[-18,-24+tail],[-10,-24]],P.ink);
    upper.poly([[-8,-21],[-13,-19],[-23,-21+tail],[-26,-23+tail],[-18,-23+tail],[-10,-23]],P.sash);
    upper.line(-13,-20,-23,-22+tail,P.sashLight);
    // A two-stroke pictogram advertises the return pass before it happens.
    if(warning&&rush){
        for(let i=0;i<rush.total;i++){
            const x=-9+i*12,color=i===rush.pass-1?P.creamLight:P.bronzeShade;
            b.rect(x,-49,9,7,P.ink);b.rect(x+1,-48,7,5,color);
            const dir=i===rush.pass-1?1:-1,tip=x+(dir===1?6:2);
            b.rect(x+2,-46,5,1,P.ink);b.rect(tip-dir,-47,1,3,P.ink);
        }
    }
}
/** Authored flight poses: folded knees on ascent, extended boots before landing. */
function airborne(b:Brush,progress:number,returning:boolean){
    // Six foot placements release both knees before contact. The final boots
    // meet the support plane instead of jumping there from the tucked pose.
    const pose=Math.min(5,Math.max(0,Math.floor(progress*6)));
    const foot=[-13,-14,-12,-9,-5,-2][pose],rear=[-14,-15,-13,-11,-8,-7][pose];
    b.poly([[-9,-19],[0,-18],[-4,rear+4],[-12,rear+6],[-16,rear+1]],P.ink);
    b.poly([[-8,-18],[-1,-17],[-5,rear+3],[-11,rear+4],[-14,rear+1]],P.pantsShade);
    b.poly([[1,-18],[9,-17],[14,foot-5],[7,foot],[0,-11]],P.ink);
    b.poly([[2,-17],[8,-16],[12,foot-5],[7,foot-2],[2,-11]],P.pants);
    boot(b,-18,rear,11);boot(b,6,foot-5,12);coat(b,2);
    // The heavy key trails behind; the carimbo leads the downward attack.
    key(b,-26,-31,returning);
    b.poly([[-10,-28],[-16,-25],[-20,-20],[-16,-17],[-9,-23]],P.creamShade);
    b.rect(-20,-20,5,4,P.skin);face(b,-3,-41,'effort');
    // The loose end follows the three authored flight beats, with a held apex.
    const tail=[-2,-3,-2,0,1,2][pose];
    b.poly([[-9,-20],[-12,-17],[-20,-19+tail],[-17,-23+tail]],P.ink);
    b.poly([[-10,-20],[-12,-18],[-18,-20+tail],[-17,-22+tail]],P.sash);b.line(-12,-19,-17,-21+tail,P.sashLight);
    if(returning){
        b.poly([[7,-29],[12,-27],[18,-22],[15,-18],[8,-23]],P.cream);
        stamp(b,15,-24);b.rect(14,-23,5,4,P.skinLight);
    }else warningArm(b,progress<.65?1:.2,false);
}
function coveredRecovery(b:Brush,tick=0,reduced=false){
    const pull=reduced?0:[0,1,2,2,1,0,0,0][Math.floor(Math.max(0,tick)/9)%8];
    const {rect:r}=b;standingLegs(b,true);coat(b,1);face(b,-3,-40+pull,'effort');
    // First effort stays upright and guarded. It is not an invitation to stomp.
    b.poly([[7,-28],[13,-25-pull],[18,-12],[13,-10],[7,-21]],P.ink);
    b.poly([[8,-27],[12,-24-pull],[16,-12],[14,-12],[8,-21]],P.cream);
    b.poly([[-10,-26],[-5,-26],[9,-12],[5,-10],[-10,-21]],P.creamShade);
    stamp(b,10,-13);r(9,-13,10,4,P.skinShade);r(10,-13,8,2,P.skinLight);r(14,-12,1,2,P.skinShade);
    key(b,-22,-4,true);
}
function pressureOrder(b:Brush,pulse:Readonly<MayorCounterpressure>){
    const {rect:r}=b;
    // The stamp comes free of its socket, extends toward the seam, then orders
    // the discharge down. All action stays forward of the exposed upper back.
    const progress=Number.isFinite(pulse.progress)?Math.max(0,Math.min(1,pulse.progress)):0;
    const pose=pulse.phase==='active'?2:progress<.35?0:1;
    face(b,5,-33,pose===2?'effort':'frown');
    // The rear hand braces the knee; it never rises over the hit opening.
    b.poly([[1,-24],[7,-22],[10,-14],[5,-12],[0,-18]],P.creamShade);
    r(5,-15,5,3,P.skinShade);r(6,-15,3,1,P.skinLight);
    if(pose===0){
        b.poly([[9,-25],[14,-25],[18,-21],[20,-28],[25,-27],[23,-16],[17,-15],[10,-19]],P.ink);
        b.poly([[10,-24],[13,-24],[18,-19],[21,-25],[23,-25],[21,-17],[18,-17],[11,-20]],P.cream);
        stamp(b,18,-35);r(21,-28,5,4,P.skin);r(21,-28,3,2,P.skinLight);
    }else if(pose===1){
        b.poly([[9,-25],[15,-25],[21,-22],[29,-24],[31,-19],[21,-16],[12,-19]],P.ink);
        b.poly([[10,-24],[14,-24],[21,-20],[28,-22],[29,-20],[21,-18],[13,-20]],P.cream);
        stamp(b,25,-31);r(28,-24,5,4,P.skin);r(28,-24,3,2,P.skinLight);
        // A tightened mouth and extended hand make the order readable at rest.
        r(12,-23,4,1,P.ink);
    }else{
        b.poly([[9,-25],[15,-23],[22,-16],[28,-14],[26,-9],[18,-11],[10,-19]],P.ink);
        b.poly([[10,-24],[14,-22],[21,-14],[26,-13],[25,-11],[19,-13],[11,-20]],P.cream);
        stamp(b,23,-17);r(25,-14,6,4,P.skinShade);r(25,-14,4,2,P.skinLight);
    }
    key(b,-22,-4,true);
}
function recovering(b:Brush,vulnerable:boolean,pulse?:Readonly<MayorCounterpressure>|null,tick=0,reduced=false){
    const {rect:r}=b;
    const pull=reduced?0:[0,1,2,2,1,0,0,0][Math.floor(Math.max(0,tick)/9)%8];
    // The back, supported by bent legs, stays exactly on the model's top plane.
    b.poly([[-8,-18],[0,-16],[-4,-7],[-12,-5],[-15,-8]],P.ink);b.poly([[-8,-17],[-1,-16],[-5,-8],[-12,-7]],P.pantsShade);
    b.poly([[2,-19],[10,-18],[9,-9],[13,-6],[5,-5],[1,-11]],P.ink);b.poly([[3,-18],[9,-17],[7,-10],[11,-7],[6,-7],[2,-11]],P.pants);
    boot(b,-16,-7,12);boot(b,4,-7,12);
    b.poly([[-11,-38],[-6,-40],[1,-40],[11,-31],[8,-16],[-1,-14],[-15,-22]],P.ink);
    b.poly([[-10,-37],[-6,-39],[0,-39],[10,-30],[7,-18],[-1,-16],[-13,-22]],P.creamShade);
    b.poly([[-9,-37],[-5,-39],[0,-39],[7,-31],[4,-22],[-3,-20],[-12,-24]],P.cream);
    b.line(-6,-39,0,-39,vulnerable?P.creamLight:P.cream);
    b.poly([[-10,-34],[-7,-37],[8,-26],[7,-22]],P.sash);b.line(-8,-34,5,-25,P.sashLight);
    b.line(-11,-28,-7,-24,P.creamLight);b.line(-8,-21,-3,-19,P.creamDark);
    b.rect(-3,-30,3,2,P.bronzeShade);b.rect(-3,-30,2,1,P.bronzeLight);
    if(pulse){pressureOrder(b,pulse);return;}
    face(b,5,-33+pull,pull===0?'frown':'effort');
    // Both hands pull a square stamp visibly stuck in the low control plate.
    // Elbows lift and the head strains; the tool, boots and vulnerable back
    // remain anchored. Silhouette changes never move the gameplay opening.
    b.poly([[9,-25],[15+pull,-25-pull],[20,-11],[14,-9],[9,-18]],P.ink);
    b.poly([[10,-24],[14+pull,-23-pull],[18,-12],[15,-11],[10,-18]],P.cream);
    b.line(16+pull,-21-pull,18,-15,P.creamLight);
    b.poly([[2,-24],[7-pull,-22-pull],[12,-11],[7,-10],[1,-18]],P.creamShade);
    stamp(b,10,-13);r(10,-13,10,4,P.skinShade);r(11,-13,8,2,P.skinLight);r(15,-12,1,2,P.skinShade);
    key(b,-22,-4,true);
    // A short, local sweat cycle follows exertion, without global flashing.
    const sweat=reduced?0:Math.floor(Math.max(0,tick)/6)%12;
    if(sweat<8){const sy=-31+Math.floor(sweat/2);r(22,sy,1,2,P.water);r(21,sy+2,2,1,P.water);}
}
function released(b:Brush,tick:number,reduced:boolean){
    const {rect:r}=b;
    const settle=reduced?2:Math.min(2,Math.floor(Math.max(0,tick)/12));
    // Seated, unarmed and visibly surprised; no violent defeat treatment.
    b.poly([[-12,-11],[-4,-15],[7,-14],[14,-5],[9,-2],[-7,-3],[-15,-6]],P.ink);
    b.poly([[-11,-10],[-3,-13],[6,-12],[11,-5],[8,-4],[-7,-5],[-13,-7]],P.pants);boot(b,-16,-7,11);boot(b,9,-7,11);
    b.poly([[-10,-26],[5,-27],[11,-18],[8,-9],[-12,-9],[-15,-19]],P.ink);
    b.poly([[-9,-25],[4,-26],[9,-17],[7,-11],[-11,-11],[-13,-19]],P.cream);b.poly([[1,-26],[6,-23],[-9,-13],[-12,-15]],P.sash);
    face(b,-6,-36+settle,reduced||tick>=48?'calm':'surprise',!reduced&&tick%180>=154&&tick%180<160);
    r(-17,-21+settle,6,3,P.creamShade);r(-20,-21+settle,4,4,P.skin);
    r(9,-22+settle,6,3,P.cream);r(14,-22+settle,4,4,P.skinLight);
    key(b,-23,-4,true);stamp(b,21,-13);
}

/** A downward contact cue, separate from the amber seam warning and cyan water.
 * The small cream rail is time left in this recovery, never remaining seals.
 * It stays visible during pressure because jumping to the back is still valid.
 */
function openingCue(c:CanvasRenderingContext2D,m:GuairaMayorArtState,cx:number,cy:number){
    const q=m.opening;
    if(m.state!=='recover'||!m.vulnerable||!q||!Number.isFinite(m.recoveryProgress))return;
    if(![q.x,q.y,q.width].every(Number.isFinite)||q.width<4)return;
    const x=Math.round(q.x-cx),y=Math.round(q.y-cy),w=Math.round(q.width);
    const remaining=1-Math.max(0,Math.min(1,m.recoveryProgress!));
    const b=brush(c),r=b.rect,mid=x+Math.floor(w/2);
    // Fixed silhouette, no bobbing or blinking. The last tick retains one pip.
    r(x,y-7,w,3,P.ink);r(x+1,y-6,w-2,1,P.creamDark);
    r(x+1,y-6,Math.ceil((w-2)*remaining),1,P.creamLight);
    r(mid-3,y-4,7,1,P.ink);r(mid-2,y-3,5,1,P.ink);r(mid-1,y-2,3,1,P.ink);
    r(mid-2,y-4,5,1,P.creamLight);r(mid-1,y-3,3,1,P.creamLight);r(mid,y-2,1,1,P.creamLight);
}

/** Feet are always y+height. The base art uses a 28×40 body; props are non-colliding. */
export function drawGuairaMayor(c:CanvasRenderingContext2D,m:GuairaMayorArtState,cx=0,cy=0,reducedMotion=false){
    if(![m.x,m.y,m.width,m.height,cx,cy].every(Number.isFinite))return;
    // A ground shadow anchors the jump without pretending to be a collision surface.
    if(m.state==='leap'||m.state==='returning'||m.state==='vault'){
        const center=m.x+m.width/2,feet=m.y+m.height;
        const ground=center>=224&&feet<=160?160:center>=16&&center<=48&&feet<=176?176:224;
        const shadow=brush(c),sx=Math.round(m.x+m.width/2-cx),sy=Math.round(ground-cy);
        shadow.rect(sx-12,sy-2,24,2,P.creamDark);shadow.rect(sx-8,sy-3,16,1,P.creamDark);
    }
    c.save();c.translate(Math.round(m.x+m.width/2-cx),Math.round(m.y+m.height-cy));c.scale(m.facing??-1,1);
    const b=brush(c);
    if(m.state==='released')released(b,m.stateTick,reducedMotion);
    else if(m.state==='rushWarning'||m.state==='rush'||m.state==='brake')rushing(b,m,reducedMotion);
    else if(m.state==='vault')airborne(b,m.rush?.progress??.5,true);
    else if(m.state==='jetWarning'||m.state==='jetBurst')commanding(b,m,reducedMotion);
    else if(m.state==='recover'){
        if(m.vulnerable)recovering(b,true,m.counterpressure,m.stateTick,reducedMotion);
        else if(m.pressureInterrupted&&m.stateTick<18&&!reducedMotion)interruptedRecovery(b,m.stateTick);
        else coveredRecovery(b,m.stateTick,reducedMotion);
    }
    else if(m.state==='leap'||m.state==='returning')airborne(b,m.motionProgress??.5,m.state==='returning');
    else if(m.state==='stamp'){
        // Impact compression and recovery are separate poses, not sprite scaling.
        if(m.stateTick<8)stamping(b,2);
        else if(m.stateTick<16)stamping(b);
        else coveredRecovery(b);
    }
    else if(m.state==='hurt'){
        c.translate(m.stateTick<12?3:m.stateTick<24?-1:0,0);recovering(b,false);
        // Clear recoil face and separated hands, no whole-body rotation or flashing.
        face(b,4,-36,'surprise');b.rect(20,-18,4,3,P.skinLight);b.rect(-17,-25,4,3,P.skin);
    }else neutral(b,m.state,m.tick,reducedMotion,m.warningProgress);
    c.restore();
    c.save();openingCue(c,m,cx,cy);c.restore();
}

/** The leading crest passes in front of the boots. It uses the very same
 * contours as contact; neither foam nor highlights enlarge the hit area. */
export function drawGuairaMayorRushForeground(c:CanvasRenderingContext2D,m:GuairaMayorArtState,cx=0,cy=0,reduced=false){
    const rush=m.rush;
    if(m.attacksCancelled||rush?.phase!=='active')return;
    const q=rush.rect;
    c.save();c.beginPath();
    c.rect(Math.round(q.x-cx+(rush.direction===1?q.width-16:0)),Math.round(q.y-cy),16,q.height);
    c.rect(Math.round(q.x-cx),Math.round(q.y+q.height-3-cy),q.width,3);c.clip();
    drawRushWater(c,m,rush,cx,cy,reduced);c.restore();
}

function drawRushWater(c:CanvasRenderingContext2D,m:GuairaMayorArtState,rush:Readonly<MayorRush>,cx:number,cy:number,reduced:boolean){
    const water=brush(c),q=rush.rect,sections=mayorRushWater(q,rush.direction);
    c.save();c.beginPath();
    for(const part of sections)c.rect(Math.round(part.x-cx),Math.round(part.y-cy),part.width,part.height);
    c.clip();water.rect(q.x-cx,q.y-cy,q.width,q.height,P.waterShade);
    const beat=reduced?0:Math.floor(m.stateTick/2);
    for(const part of sections){
        water.rect(part.x-cx+1,part.y-cy+1,part.width-2,part.height-1,P.water);
        water.rect(part.x-cx,part.y-cy,part.width,1,P.waterLight);
    }
    for(let y=4;y<q.height;y+=5){
        const offset=(beat*3+y)%16;
        water.rect(q.x-cx+offset,q.y-cy+y,12,1,P.waterLight);
    }
    water.rect(q.x-cx,q.y-cy+q.height-2,q.width,2,P.waterLight);c.restore();
}

/** Warning and active ink never extend beyond the model's exact locked rectangle. */
export function drawGuairaMayorStampTarget(c:CanvasRenderingContext2D,m:GuairaMayorArtState,cx=0,cy=0,_reducedMotion=false){
    if(m.attacksCancelled)return;
    const water=brush(c);
    const rush=m.rush;
    if(rush&&(rush.phase==='approach'||rush.phase==='warning')){
        const q=rush.lane,x=q.x-cx,y=q.y-cy;
        water.rect(x,y+q.height-3,q.width,3,P.ink);water.rect(x,y+q.height-2,q.width,1,P.warning);
        water.rect(x,y,2,q.height,P.warning);water.rect(x+q.width-2,y,2,q.height,P.warning);
        for(let xx=x+12;xx<x+q.width-12;xx+=28){
            water.line(xx-rush.direction*4,y+8,xx,y+12,P.warning,2);
            water.line(xx,y+12,xx-rush.direction*4,y+16,P.warning,2);
        }
        const x0=m.x+m.width/2-cx;
        water.rect(x0-13,y-7,26,4,P.ink);
        water.rect(x0-12,y-6,24*(rush.phase==='warning'?rush.progress:0),2,P.warning);
    }
    if(rush?.phase==='active'){
        drawRushWater(c,m,rush,cx,cy,_reducedMotion);
    }
    // A narrow lane outline communicates height and origin without filling the
    // arena. It is only a tell: only the solid cyan packets can make contact.
    const salvo=m.salvo??m.crossfire;
    if(salvo?.phase==='warning'){
        const q=salvo.rect,x=q.x-cx,y=q.y-cy,source=salvo.direction===1?x:x+q.width-16;
        water.rect(x,y-2,q.width,1,P.ink);water.rect(x,y-1,q.width,1,P.warning);
        water.rect(x,y+q.height,q.width,1,P.warning);water.rect(x,y+q.height+1,q.width,1,P.ink);
        for(let xx=x+24;xx<x+q.width-20;xx+=40){
            water.line(xx-salvo.direction*4,y+4,xx,y+8,P.warning);
            water.line(xx,y+8,xx-salvo.direction*4,y+12,P.warning);
        }
        water.rect(source,y-8,16,5,P.ink);water.rect(source+1,y-7,14,3,P.bronzeShade);
        water.rect(source+1,y-7,Math.ceil(14*salvo.progress),3,P.warning);
    }
    for(const jet of m.jets??[]){
        const x=Math.round(jet.x-cx),y=Math.round(jet.y-cy),w=jet.width,h=jet.height;
        c.save();c.beginPath();
        for(const q of mayorJetWater(jet))c.rect(Math.round(q.x-cx),Math.round(q.y-cy),q.width,q.height);
        c.clip();water.rect(x,y,w,h,P.waterShade);
        water.rect(x+2,y+3,w-4,h-6,P.water);
        const beat=_reducedMotion?0:Math.floor(jet.age/2)%4;
        for(let yy=3;yy<h-2;yy+=4){
            const xx=(yy+beat*3)%11;
            water.rect(x+xx,y+yy,Math.min(10,w-xx-2),1,P.waterLight);
        }
        const nose=jet.direction===1?x+w-3:x;
        water.rect(nose,y+4,3,h-8,P.waterLight);
        const shoulder=jet.direction===1?x+w-7:x+4;
        water.rect(shoulder,y+2,3,3,P.waterLight);water.rect(shoulder,y+h-5,3,3,P.waterLight);
        water.rect(x+10,y+1,w-18,1,P.waterLight);water.rect(x+8,y+h-2,w-16,1,P.water);
        c.restore();
    }
    // Travelling pressure has a solid bounded body on every dangerous tick.
    for(const wave of m.waves??[]){
        const x=Math.round(wave.x-cx),y=Math.round(wave.y-cy),w=wave.width,h=wave.height;
        c.save();c.beginPath();
        for(const part of mayorWaveWater(wave))c.rect(Math.round(part.x-cx),Math.round(part.y-cy),part.width,part.height);
        c.clip();
        water.rect(x,y,w,h,P.waterShade);
        const step=_reducedMotion?0:Math.floor(wave.age/3)%4;
        for(let row=0;row<h;row+=3){
            const inset=(row+step)%7;
            water.rect(x+inset,y+row,w-inset,2,P.water);
        }
        const front=wave.direction>0?x+w-3:x+2,back=front-wave.direction*9;
        water.rect(Math.min(front,back),y,10,2,P.waterLight);
        water.line(front-wave.direction*2,y+3,front,y+7,P.waterLight,2);
        water.line(front,y+7,front-wave.direction*5,y+10,P.waterLight,2);
        water.rect(Math.min(front-wave.direction*5,back),y+11,6,2,P.water);
        water.rect(x+2,y+h-3,w-4,2,P.waterLight);
        c.restore();
    }
    if(m.waveWarning&&m.stampTarget){
        // Physical floor conduits announce the two outgoing waves before impact.
        const q=m.stampTarget;
        for(const [start,end,dir] of [[0,q.x,-1],[q.x+q.width,320,1]]){
            for(let xx=start+8;xx<end-6;xx+=24){
                water.line(xx-dir*3-cx,218-cy,xx-cx,221-cy,P.warning);
                water.line(xx-cx,221-cy,xx-dir*3-cx,224-cy,P.warning);
            }
        }
    }
    const pulse=m.state==='recover'?m.counterpressure:null;
    const q=pulse?.rect??m.stampTarget;if(!q||(!pulse&&m.state!=='warning'&&m.state!=='leap'&&m.state!=='stamp'))return;
    if(![q.x,q.y,q.width,q.height,cx,cy].every(Number.isFinite)||q.width<=0||q.height<=0)return;
    const x=Math.round(q.x-cx),y=Math.round(q.y-cy),w=Math.round(q.width),h=Math.round(q.height);
    c.save();c.beginPath();c.rect(x,y,w,h);c.clip();const b=brush(c),r=b.rect;
    if(pulse){
        // The seam is a separate, frozen pressure chamber. Every warning and
        // active pixel stays in the same model rectangle, including both ends.
        const progress=Number.isFinite(pulse.progress)?Math.max(0,Math.min(1,pulse.progress)):0;
        if(pulse.phase==='warning'){
            // Dark inner edges preserve contrast against the warm stone room.
            r(x,y,w,2,P.ink);r(x,y+h-3,w,3,P.ink);r(x,y,2,h,P.ink);r(x+w-2,y,2,h,P.ink);
            r(x,y,1,h,P.warning);r(x+w-1,y,1,h,P.warning);
            for(let xx=2;xx<w-2;xx+=6)r(x+xx,y,Math.min(3,w-2-xx),1,P.warning);
            r(x,y+h-2,w,2,P.warning);
            for(let xx=8;xx<w-4;xx+=14){
                b.line(x+xx-4,y+8,x+xx,y+4,P.ink,2);b.line(x+xx,y+4,x+xx+4,y+8,P.ink,2);
                b.line(x+xx-3,y+8,x+xx,y+5,P.warning);b.line(x+xx,y+5,x+xx+3,y+8,P.warning);
            }
            const span=Math.max(0,w-8),filled=Math.floor(span*progress);
            r(x+3,y+h-8,w-6,5,P.bronzeShade);r(x+4,y+h-7,span,3,P.ink);
            for(let i=0;i<4;i++){
                const start=Math.floor(i*span/4),end=Math.floor((i+1)*span/4)-1;
                r(x+4+start,y+h-6,Math.max(0,end-start),1,P.bronze);
                r(x+4+start,y+h-6,Math.max(0,Math.min(end,filled)-start),1,P.warning);
            }
        }else{
            // A solid bounded body is dangerous on its first AND last tick.
            // Moving highlights use only pulse progress, so pausing freezes it.
            r(x,y,w,h,P.waterShade);
            const step=_reducedMotion?0:Math.floor(progress*8);
            for(let xx=3;xx<w-2;xx+=7){
                r(x+xx,y+2,3,h-3,P.water);
                r(x+xx,y+2+(step+xx)%4,1,Math.max(1,h-8),P.waterLight);
            }
            r(x,y,w,1,P.waterLight);r(x,y,2,h,P.waterLight);r(x+w-2,y,2,h,P.waterLight);r(x,y+h-2,w,2,P.waterLight);
            // The narrow base stripe empties with the model's active phase.
            r(x+3,y+h-4,Math.max(0,w-6),1,P.waterShade);
            r(x+3,y+h-4,Math.floor(Math.max(0,w-6)*(1-progress)),1,P.waterLight);
        }
    }else if(m.state==='warning'||m.state==='leap'){
        for(let xx=0;xx<w;xx+=8){r(x+xx,y,4,1,P.warning);r(x+xx,y+h-3,4,3,P.warning);}
        r(x,y,2,h,P.warning);r(x+w-2,y,2,h,P.warning);
        // Downward chevrons tie the fixed marked region to a closing order.
        for(let xx=13;xx<w-10;xx+=28){b.line(x+xx-3,y+5,x+xx,y+8,P.warning);b.line(x+xx,y+8,x+xx+3,y+5,P.warning);}
        // Eight pressure slots fill from the simulation's warning clock. They
        // stay inside the already warned vent and remain legible without motion.
        const progress=m.state==='leap'?1:Number.isFinite(m.warningProgress)?Math.max(0,Math.min(1,m.warningProgress!)):0;
        const span=Math.max(0,w-8),filled=Math.floor(span*progress);
        r(x+4,y+h-8,span,4,P.ink);
        for(let i=0;i<8;i++){
            const start=Math.floor(i*span/8),end=Math.floor((i+1)*span/8)-2;
            r(x+4+start,y+h-7,Math.max(0,end-start),2,P.bronzeShade);
            r(x+4+start,y+h-7,Math.max(0,Math.min(end,filled)-start),2,P.warning);
        }
    }else{
        // Shared stepped shoulders replace the aquarium-like rectangular wall.
        c.beginPath();
        const sections=mayorStampWater(q);
        for(const part of sections)c.rect(Math.round(part.x-cx),Math.round(part.y-cy),part.width,part.height);
        c.clip();r(x,y,w,h,P.waterShade);
        const flow=_reducedMotion?0:Math.floor(m.stateTick/2);
        for(let xx=0;xx<w;xx+=9){
            r(x+xx,y+3,6,h-3,P.water);
            for(let yy=-8;yy<h;yy+=11)r(x+xx+1,y+((yy+flow*2+xx+h)%h),3,4,P.waterLight);
        }
        for(const part of sections){
            const px=Math.round(part.x-cx),py=Math.round(part.y-cy);
            r(px,py,part.width,1,P.waterLight);
            for(let xx=2;xx<part.width-4;xx+=8)r(px+xx,py+1,4,1+(flow+xx)%2,P.waterLight);
        }
        r(x,y+h-2,w,2,P.waterLight);
    }
    c.restore();
}
