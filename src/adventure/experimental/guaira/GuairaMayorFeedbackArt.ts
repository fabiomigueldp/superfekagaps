import { MAYOR_PALETTE as P, type GuairaMayorArtState } from './GuairaMayorArt';
import { guairaPipeRoute } from './GuairaPipeArt';

const LOWER=guairaPipeRoute([[80,220],[116,220],[116,194],[252,194]]);
const UPPER=guairaPipeRoute([[246,156],[246,194],[252,194]]);
const RELEASE=guairaPipeRoute([[252,194],[36,194],[36,208]]);

/** Local feedback is behind the dangerous water and actors. No particles are
 * integrated here: immutable event ages come from the encounter's fixed clock. */
export function drawGuairaMayorFeedback(c:CanvasRenderingContext2D,m:GuairaMayorArtState,cx=0,cy=0,reduced=false){
    if(!Number.isFinite(cx)||!Number.isFinite(cy))return;
    cx=Math.round(cx);cy=Math.round(cy);
    const r=(x:number,y:number,w:number,h:number,color:string)=>{
        if(w<=0||h<=0)return;c.fillStyle=color;c.fillRect(Math.round(x)-cx,Math.round(y)-cy,Math.round(w),Math.round(h));
    };
    c.save();c.beginPath();c.rect(0,0,320,180);c.clip();
    for(const e of m.feedback??[]){
        if(![e.x,e.y,e.age,e.duration].every(Number.isFinite)||e.age<0||e.duration<=0||e.age>=e.duration)continue;
        const p=e.age/e.duration;
        if(e.kind==='interrupt'||e.kind==='drain'){
            const route=e.y<180?UPPER:LOWER;
            // A restrained pearl reflection travels inside the installed pipe.
            // It is deliberately different from the solid cyan damage volumes.
            const head=reduced?route.length-1:Math.min(route.length-1,Math.floor(p*1.45*route.length));
            for(let i=Math.max(0,head-13);i<=head;i++){
                const [x,y]=route[i];r(x-1,y-1,3,3,'#71988b');r(x,y,1,1,'#cfddbc');
            }
            const spread=reduced?3:2+Math.min(5,Math.floor(e.age/3));
            if(e.age<18||reduced){
                for(const dir of [-1,1]){
                    r(e.x+dir*(spread+4),e.y-3,2,1,P.creamLight);
                    r(e.x+dir*(spread+3),e.y-5,1,2,P.bronzeLight);
                }
                r(e.x-3,e.y-1,7,1,P.creamLight);r(e.x-2,e.y,5,1,P.creamLight);
            }
            if(head===route.length-1){
                r(248,185,9,2,'#cfddbc');r(250,184,5,1,'#91b3a0');
                r(249,187,1,2,'#cfddbc');r(255,187,1,2,'#cfddbc');
            }
        }else{
            // The removed wax seal visibly parts at its real socket; a success
            // on the upper back therefore changes the waterworks below it.
            if(reduced){
                r(e.x-3,186,7,1,P.creamLight);r(e.x-3,200,7,1,P.creamLight);
                r(e.x-3,187,1,3,P.bronzeLight);r(e.x+3,197,1,3,P.bronzeLight);
            }else{
                const separation=Math.floor(2+Math.min(1,p*1.6)*8);
                const drop=Math.round(p*p*22-Math.sin(p*Math.PI)*9);
                for(const side of [-1,1]){
                    const x=e.x+side*separation,y=e.y+drop+(side===1?2:0);
                    r(x-1,y-3,3,7,P.ink);r(x,y-2,2,5,P.sash);r(x,y-2,1,2,P.sashLight);
                    r(x-1,y-3,3,1,P.bronzeLight);r(x,y+2,2,1,P.bronzeShade);
                }
                if(e.age<12){
                    r(e.x-5,186,3,1,P.creamLight);r(e.x+3,185,3,1,P.creamLight);
                    r(e.x,182,1,3,P.bronzeLight);
                }
            }
            if(e.kind==='release'){
                const head=reduced?RELEASE.length-1:Math.min(RELEASE.length-1,Math.floor(p*1.6*RELEASE.length));
                for(let i=Math.max(0,head-18);i<=head;i++){
                    const [x,y]=RELEASE[i];r(x,y,1,1,'#d2e3c3');
                }
                if(head===RELEASE.length-1){
                    const radius=reduced?12:7+Math.floor(e.age/4)%18;
                    r(Math.max(18,36-radius),208,Math.min(2*radius,58),1,'#bcd5bb');
                    r(49,210,8,1,'#9cc4af');r(70,208,13,1,'#9cc4af');
                }
            }
        }
    }
    c.restore();
}
