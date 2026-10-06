/** Frame metadata only: preserve the source pixels, ignore empty atlas gutters
 * when sizing a sprite, and place its visible foundation at the requested foot. */
export interface SpriteFrame { x:number; y:number; w:number; h:number }
export interface CharacterFrame extends SpriteFrame { anchorX:number; foot:number }

// The original character sheets are packed illustrations, not regular grids.
// In particular, row two starts above y=512 and several arms cross x=384.
// Explicit regions keep neighbouring heads out of frame one and retain limbs.
// Coordinates refer to the preserved 1536 × 1024 masters; pivots mark the feet.
const CHARACTER_REGIONS:Record<string,readonly (readonly number[])[]>={
 guina:[
  [40,8,296,468,196,468],[356,8,382,463,550,462],
  [738,132,407,362,982,465],[1120,56,409,416,1395,451],
  [6,480,431,493,180,963],[442,576,298,388,585,951],
  [738,493,416,474,944,952],[1160,565,365,390,1350,944],
 ],
 jaja:[
  [44,38,331,460,200,489],[398,100,387,394,596,482],
  [796,38,390,459,1013,486],[1178,120,350,374,1385,482],
  [8,650,445,322,242,953],[477,617,281,360,617,967],
  [803,492,355,490,984,975],[1163,695,365,294,1370,977],
 ],
 enemies:[
  [14,38,339,408,180,434],[380,136,394,312,590,438],
  [779,30,355,410,965,414],[1164,78,360,380,1340,449],
  [14,472,366,478,199,943],[390,480,399,470,599,938],
  [806,478,338,473,969,944],[1198,497,309,455,1358,944],
 ],
};
const characterCache=new WeakMap<HTMLImageElement,CharacterFrame[]>();

export function characterFrames(image:HTMLImageElement,character:'jaja'|'guina'|'enemies'):readonly CharacterFrame[] {
 const known=characterCache.get(image);if(known)return known;
 const sx=image.naturalWidth/1536,sy=image.naturalHeight/1024;
 const frames=CHARACTER_REGIONS[character].map(([x,y,w,h,anchorX,foot])=>({x:x*sx,y:y*sy,w:w*sx,h:h*sy,anchorX:anchorX*sx,foot:foot*sy}));
 characterCache.set(image,frames);return frames;
}

export function drawCharacterFrame(c:CanvasRenderingContext2D,image:HTMLImageElement,f:CharacterFrame,x:number,foot:number,scale:number):void {
 c.drawImage(image,f.x,f.y,f.w,f.h,x+(f.x-f.anchorX)*scale,foot+(f.y-f.foot)*scale,f.w*scale,f.h*scale);
}
const cache=new WeakMap<HTMLImageElement,Map<string,SpriteFrame[]>>();
// The v5 buildings have natural proportions and a few silhouettes cross the
// nominal cell boundaries. These source regions exclude adjacent buildings.
const LANDMARK_REGIONS:readonly (readonly number[])[]=[
 [16,100,375,311],[440,8,318,406],[791,143,428,271],
 [18,565,364,279],[426,470,350,374],[805,435,410,409],
 [12,923,385,340],[470,851,249,405],[767,862,455,410],
];

export function atlasFrames(image:HTMLImageElement,columns:number,rows:number,layout?:'landmarks-v5'):readonly SpriteFrame[] {
 let grids=cache.get(image);if(!grids){grids=new Map();cache.set(image,grids);}
 const key=`${columns}:${rows}:${layout??''}`,known=grids.get(key);if(known)return known;
 const canvas=document.createElement('canvas');canvas.width=image.naturalWidth;canvas.height=image.naturalHeight;
 const width=canvas.width,height=canvas.height;
 const c=canvas.getContext('2d',{willReadFrequently:true})!;c.drawImage(image,0,0);
 const {data}=c.getImageData(0,0,width,height),frames:SpriteFrame[]=[];
 for(let index=0;index<columns*rows;index++){
  const region=layout?LANDMARK_REGIONS[index]:undefined;
  const left=region?Math.round(region[0]*width/1224):Math.round(index%columns*width/columns);
  const right=region?Math.round((region[0]+region[2])*width/1224):Math.round((index%columns+1)*width/columns);
  const top=region?Math.round(region[1]*height/1285):Math.round(Math.floor(index/columns)*height/rows);
  const bottom=region?Math.round((region[1]+region[3])*height/1285):Math.round((Math.floor(index/columns)+1)*height/rows);
  let x0=right,x1=left,y0=bottom,y1=top;
  for(let y=top;y<bottom;y++)for(let x=left;x<right;x++)if(data[(y*width+x)*4+3]>32){x0=Math.min(x0,x);x1=Math.max(x1,x);y0=Math.min(y0,y);y1=Math.max(y1,y);}
  frames.push(x0<=x1&&y0<=y1?{x:x0,y:y0,w:x1-x0+1,h:y1-y0+1}:{x:left,y:top,w:right-left,h:bottom-top});
 }
 grids.set(key,frames);return frames;
}

export function drawAtlasSprite(c:CanvasRenderingContext2D,image:HTMLImageElement,index:number,columns:number,rows:number,x:number,foot:number,maxWidth:number,maxHeight:number,layout?:'landmarks-v5'):void {
 const f=atlasFrames(image,columns,rows,layout)[index],scale=Math.min(maxWidth/f.w,maxHeight/f.h);
 c.drawImage(image,f.x,f.y,f.w,f.h,x-f.w*scale/2,foot-f.h*scale,f.w*scale,f.h*scale);
}
