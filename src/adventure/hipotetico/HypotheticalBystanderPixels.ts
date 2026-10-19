/** Inverse nearest-pixel sampling prevents pinholes when a small cloth patch rotates. */
export interface BystanderTexture { left:number; top:number; width:number; height:number; pixels:readonly (string|null)[] }
export function drawBystanderTexture(c:CanvasRenderingContext2D,t:BystanderTexture,x:number,y:number,angle=0,shear=0){
    const cos=Math.cos(angle),sin=Math.sin(angle),point=(u:number,v:number)=>{
        u-=v*shear;return [x+u*cos-v*sin,y+u*sin+v*cos];
    };
    const corners=[[t.left,t.top],[t.left+t.width,t.top],[t.left,t.top+t.height],[t.left+t.width,t.top+t.height]].map(([u,v])=>point(u,v));
    const left=Math.floor(Math.min(...corners.map(p=>p[0]))),right=Math.ceil(Math.max(...corners.map(p=>p[0])));
    const top=Math.floor(Math.min(...corners.map(p=>p[1]))),bottom=Math.ceil(Math.max(...corners.map(p=>p[1])));
    for(let yy=top;yy<bottom;yy++){
        let run=left,last:string|null=null;
        for(let xx=left;xx<=right;xx++){
            const dx=xx+.5-x,dy=yy+.5-y,v=-dx*sin+dy*cos,u=dx*cos+dy*sin+v*shear;
            const sx=Math.floor(u)-t.left,sy=Math.floor(v)-t.top;
            const color=xx<right&&sx>=0&&sx<t.width&&sy>=0&&sy<t.height?t.pixels[sy*t.width+sx]:null;
            if(color===last)continue;
            if(last){c.fillStyle=last;c.fillRect(run,yy,xx-run,1);}
            last=color;run=xx;
        }
    }
}

export function bystanderTexture(left:number,top:number,width:number,height:number,paint:(box:(x:number,y:number,w:number,h:number,color:string)=>void)=>void):BystanderTexture{
    const pixels:Array<string|null>=Array(width*height).fill(null);
    paint((x,y,w,h,color)=>{
        const minX=Math.max(left,Math.round(x)),minY=Math.max(top,Math.round(y));
        const maxX=Math.min(left+width,Math.round(x)+Math.round(w)),maxY=Math.min(top+height,Math.round(y)+Math.round(h));
        for(let yy=minY;yy<maxY;yy++)for(let xx=minX;xx<maxX;xx++)pixels[(yy-top)*width+xx-left]=color;
    });
    return {left,top,width,height,pixels};
}
