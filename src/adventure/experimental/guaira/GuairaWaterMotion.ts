import waterData from './GuairaWaterData.json';

/** Camera-projected water decoration. Routes, actors and canonical metadata stay independent.
 * The integrator owns scheduling: pass accumulated VISIBLE time, never RAF time.
 * Call between the base image and Feka. Region bounds are source-image pixels.
 */
export type Point3 = [number, number, number];
export interface WaterRegion { id: string; bounds: [number, number, number, number]; atlas: [number, number] }
export interface WaterContract {
    regions: WaterRegion[]; atlasSize: [number, number]; sourceSize: [number, number];
    projection: { origin: [number, number]; basis: { x: [number, number]; y: [number, number]; z: [number, number] } };
    channels: { a: Point3; b: Point3; edge: Point3; velocity: number }[];
    paddies: [number, number][];
}
export const GUAIRA_WATER_CONTRACT = waterData as unknown as WaterContract;

interface Camera { x: number; y: number; imageWidth: number }
export class GuairaWaterMotion {
    readonly ctx: CanvasRenderingContext2D;
    readonly regions: WaterRegion[];
    constructor(readonly atlas: CanvasImageSource, readonly contract: WaterContract, readonly canvas: HTMLCanvasElement) {
        this.regions = contract.regions;
        this.canvas.width = Math.max(...this.regions.map(r => r.bounds[2]));
        this.canvas.height = Math.max(...this.regions.map(r => r.bounds[3]));
        const context = this.canvas.getContext('2d');
        if (!context) throw new Error('Water canvas unavailable');
        this.ctx = context;
    }
    private project(p: Point3): [number, number] {
        const { origin:o, basis:b } = this.contract.projection;
        return [o[0]+p[0]*(b.x[0]-o[0])+p[1]*(b.y[0]-o[0])+p[2]*(b.z[0]-o[0]),
            o[1]+p[0]*(b.x[1]-o[1])+p[1]*(b.y[1]-o[1])+p[2]*(b.z[1]-o[1])];
    }
    private stroke(a: Point3, b: Point3, alpha: number, width: number, curve = 1): void {
        const p=this.project(a), q=this.project(b), c=this.ctx;
        c.globalAlpha=alpha; c.strokeStyle='#c0eff0'; c.lineWidth=width; c.lineCap='round';
        c.beginPath();c.moveTo(p[0],p[1]);
        c.quadraticCurveTo((p[0]+q[0])/2,(p[1]+q[1])/2+curve,q[0],q[1]);c.stroke();
    }
    private pattern(t: number): void {
        // Water moves in the authored world directions; the island/camera do not move.
        for (const {a,b,edge,velocity} of this.contract.channels) {
                const len=Math.hypot(...a.map((v,i)=>v-b[i]));
                const count=Math.max(3,Math.ceil(len*2.5));
                for (let i=0;i<count;i++) {
                    const u=(i/count+t*velocity/len)%1;
                    const p=a.map((n,j)=>n+(b[j]-n)*u) as Point3;
                    const start=p.map((n,j)=>n-edge[j]) as Point3, end=p.map((n,j)=>n+edge[j]) as Point3;
                    this.stroke(start,end,.24*Math.sin(Math.PI*u)**2,1.65,.7);
                }
        }
        for (const [cx,cy] of this.contract.paddies) {
                for (let i=0;i<10;i++) {
                    const phase=t*.13+i*1.971, xx=cx+Math.sin(i*2.73)*.76, yy=cy+Math.cos(i*4.7)*.58+Math.sin(phase)*.038;
                    const len=.15+(i%3)*.043;
                    this.stroke([xx-len/2,yy,1.813],[xx+len/2,yy-.025,1.813],.075+.095*(.5+.5*Math.sin(phase)),1.25,.8);
                }
        }
                // Quiet short wind ripples on the reservoir. No neon sparkles or rotation.
                for (let i=0;i<12;i++) {
                    const phase=t*.42+i*1.81, xx=4.5+Math.sin(i*2.4)*.66, yy=3.2+Math.cos(i*3.37)*.6+Math.sin(phase)*.035;
                    const len=.13+(i%4)*.042;
                    this.stroke([xx-len/2,yy,2.674],[xx+len/2,yy-.035,2.674],.09+.09*(.5+.5*Math.sin(phase)),1.3,.75);
                }
    }
    draw(ctx: CanvasRenderingContext2D, camera: Camera, visibleSeconds: number, reducedMotion = false): void {
        // A stable representative frame for reduced motion; no phase or shimmer changes.
        const time = reducedMotion ? 1.25 : Number.isFinite(visibleSeconds) ? Math.max(0,visibleSeconds) : 0, k=camera.imageWidth/1920, c=this.ctx;
        for (const region of this.regions) {
            const [x,y,w,h]=region.bounds, [ax,ay]=region.atlas;
            const dx=camera.x+x*k,dy=camera.y+y*k;
            // The caller may clip to these bounds and restore these same base-image regions.
            c.setTransform(1,0,0,1,0,0);c.globalCompositeOperation='source-over';c.globalAlpha=1;
            c.clearRect(0,0,this.canvas.width,this.canvas.height);c.translate(-x,-y);this.pattern(time);
            c.setTransform(1,0,0,1,0,0);c.globalAlpha=1;c.globalCompositeOperation='destination-in';
            c.drawImage(this.atlas,ax,ay,w,h,0,0,w,h);
            ctx.save();ctx.imageSmoothingEnabled=true;ctx.drawImage(this.canvas,0,0,w,h,dx,dy,w*k,h*k);ctx.restore();
        }
    }
}

/** Visible time excludes hidden/reduced-motion intervals and discarded controllers. */
export class VisibleWaterClock {
    seconds=0;
    private last: number|null=null;
    tick(nowMs:number,active:boolean):number {
        if(!active || !Number.isFinite(nowMs)){this.last=null;return this.seconds;}
        if(this.last!==null)this.seconds+=Math.max(0,Math.min(50,nowMs-this.last))/1000;
        this.last=nowMs;return this.seconds;
    }
    suspend():void {this.last=null;}
}
