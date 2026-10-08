import { PixelGrid } from '../../graphics/pixels';
export type Point=readonly [number,number];

/** Raster-only authoring helpers; compiled frames use the shared World SpriteAtlas. */
export function shape(g:PixelGrid,points:readonly Point[],color:string):void {
    for(let y=Math.max(0,Math.floor(Math.min(...points.map(p=>p[1]))));y<Math.min(g.height,Math.ceil(Math.max(...points.map(p=>p[1]))));y++){
        const cuts:number[]=[];
        for(let i=0,j=points.length-1;i<points.length;j=i++){
            const a=points[j],b=points[i];
            if((a[1]>y+.5)!==(b[1]>y+.5))cuts.push(a[0]+(y+.5-a[1])*(b[0]-a[0])/(b[1]-a[1]));
        }
        cuts.sort((a,b)=>a-b);
        for(let i=0;i+1<cuts.length;i+=2)g.rect(Math.ceil(cuts[i]-.5),y,Math.ceil(cuts[i+1]-.5)-Math.ceil(cuts[i]-.5),1,color);
    }
}
export function oval(g:PixelGrid,x:number,y:number,w:number,h:number,color:string):void {
    x=Math.round(x);y=Math.round(y);w=Math.round(w);h=Math.round(h);
    for(let row=0;row<h;row++){
        const inset=Math.round(w*.5*(1-Math.sqrt(Math.max(0,1-((row+.5)/h*2-1)**2))));
        g.rect(x+inset,y+row,w-inset*2,1,color);
    }
}
export function rim(g:PixelGrid,x:number,y:number,w:number,h:number,fill:string,light:string):void {
    g.rect(x,y,w,h,'K').rect(x+1,y+1,w-2,h-2,fill).rect(x+1,y+1,w-2,1,light);
}
export function eye(g:PixelGrid,x:number,y:number,closed=false,angry=false):void {
    if(closed){g.line(x,y,x+2,y+2,'K').line(x+2,y,x,y+2,'K');return;}
    g.rect(x,y,3,3,'W').rect(x,y+1,2,2,'K').dot(x+1,y,'w');
    if(angry)g.line(x-1,y-1,x+3,y,'K');
}
export function arm(g:PixelGrid,points:readonly Point[],base:string,light:string,shade:string):void {
    for(const [pass,r] of [[0,3],[1,2]] as const)for(let i=1;i<points.length;i++){
        const [x,y]=points[i-1],[ex,ey]=points[i],steps=Math.max(Math.abs(ex-x),Math.abs(ey-y),1);
        for(let j=0;j<=steps;j++)oval(g,x+(ex-x)*j/steps-r,y+(ey-y)*j/steps-r,r*2+1,r*2+1,pass?base:'K');
    }
    for(let i=1;i<points.length;i++)g.line(points[i-1][0]-1,points[i-1][1]-1,points[i][0]-1,points[i][1]-1,light);
    const [x,y]=points[points.length-1];oval(g,x-4,y-3,9,8,'K');oval(g,x-3,y-2,7,6,base);g.rect(x-2,y-2,3,1,light).rect(x+2,y+1,1,2,shade).dot(x,y+2,shade);
}
