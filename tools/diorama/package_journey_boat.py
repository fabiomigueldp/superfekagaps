"""Package the 64 genuine Blender headings without changing their world size.

python package_journey_boat.py --render-dir RENDERS --output-dir ASSETS
Optional --verify-against FROZEN compares the new image and metadata byte-for-byte.
The legacy journey-boat.webp image is never written by this packager.
"""
from pathlib import Path
from PIL import Image
import json, hashlib, math, argparse
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--render-dir',required=True)
parser.add_argument('--output-dir',required=True)
parser.add_argument('--verify-against')
args=parser.parse_args()
render=Path(args.render_dir).expanduser().resolve();out=Path(args.output_dir).expanduser().resolve();out.mkdir(parents=True,exist_ok=True)
frozen=Path(args.verify_against).expanduser().resolve() if args.verify_against else None
if frozen==out:parser.error('Verification output must differ from the frozen assets')
meta=json.loads((render/'boat.meta.json').read_text());assert len(meta['frames'])==64
assert meta.get('headingCount')==64 and meta.get('samples')==48
assert [f['index'] for f in meta['frames']]==list(range(64))
raw_w,raw_h=meta['frame']['width'],meta['frame']['height'];assert (raw_w,raw_h)==(384,288)
images={};bounds=[];raw_edges={}
for f in meta['frames']:
    for name in ['base','foreground']:
        image=Image.open(render/f"heading-{f['index']}-{name}.png").convert('RGBA');assert image.size==(raw_w,raw_h)
        alpha=image.getchannel('A');box=alpha.getbbox();assert box is not None
        edges=[alpha.crop(r).getextrema()[1] for r in [(0,0,raw_w,2),(0,0,2,raw_h),(raw_w-2,0,raw_w,raw_h),(0,raw_h-2,raw_w,raw_h)]]
        assert max(edges)==0, (f['index'],name,edges)
        raw_edges[f"{f['index']}-{name}"]=edges;bounds.append(box);images[(f['index'],name)]=image
bbox=[min(b[0] for b in bounds),min(b[1] for b in bounds),max(b[2] for b in bounds),max(b[3] for b in bounds)]
crop=(max(0,math.floor((bbox[0]-4)/2)*2),max(0,math.floor((bbox[1]-4)/2)*2),min(raw_w,math.ceil((bbox[2]+4)/2)*2),min(raw_h,math.ceil((bbox[3]+4)/2)*2))
w,h=crop[2]-crop[0],crop[3]-crop[1]
atlas=Image.new('RGBA',(w*8,h*16))
for f in meta['frames']:
    f['sourceRects']={}
    for layer,offset in [('base',0),('foreground',8)]:
        im=images[(f['index'],layer)].crop(crop);x=f['index']%8*w;y=(f['index']//8+offset)*h
        atlas.alpha_composite(im,(x,y));f['sourceRects'][layer]={'x':x,'y':y,'width':w,'height':h}
    for anchor in ['passengerFoot','waterlineAnchor']:
        pixels={key:round(f[anchor][key]*(raw_w if key=='x' else raw_h)-crop[0 if key=='x' else 1],4) for key in ['x','y']}
        f[anchor+'Pixels']=pixels;f[anchor]={key:round(value/(w if key=='x' else h),9) for key,value in pixels.items()}
    f['widthInMap']=round(meta['orthoScale']/20.6*w/raw_w,9)
meta['frame']={'width':w,'height':h,'widthInMap':round(meta['orthoScale']/20.6*w/raw_w,9)}
meta['rawFrame']={'width':raw_w,'height':raw_h,'crop':{'x':crop[0],'y':crop[1],'width':w,'height':h},'referenceWidthInMap':round(meta['orthoScale']/20.6,9)}
meta['passengerPixelScale']=3
meta['source']='tools/diorama/render_journey_boat.py'
meta['packager']='tools/diorama/package_journey_boat.py'
meta['note']='64 genuine Blender headings with a common alpha-safe crop. Same camera, orthoScale and pixels per world unit as the original 384px-wide boat; only vertical padding and transparent borders change. Anchor the hull at waterlineAnchorPixels, then draw the actor at its separate passengerFootPixels between base and foreground.'
path=out/'journey-boat-64.webp';atlas.save(path,'WEBP',quality=82,method=6,alpha_quality=100)
meta['atlas']={'path':'/assets/world/map/journey-boat-64.webp','width':atlas.width,'height':atlas.height,'bytes':path.stat().st_size,'sha256':hashlib.sha256(path.read_bytes()).hexdigest()}
decoded=Image.open(path).convert('RGBA');packed_edges=[]
for f in meta['frames']:
    for layer in ['base','foreground']:
        r=f['sourceRects'][layer];a=decoded.crop((r['x'],r['y'],r['x']+w,r['y']+h)).getchannel('A')
        edge=max(a.crop(r).getextrema()[1] for r in [(0,0,w,2),(0,0,2,h),(w-2,0,w,h),(0,h-2,w,h)])
        assert edge==0,(f['index'],layer,edge);packed_edges.append(edge)
reference_pixel_width=(meta['orthoScale']/20.6)/raw_w
metadata_path=out/'journey-boat.meta.json';metadata_path.write_text(json.dumps(meta,indent=2)+'\n')
validation={'headingCount':64,'samples':48,'rawFrame':[raw_w,raw_h],'commonAlphaBounds':bbox,'crop':list(crop),'frame':[w,h],'atlasSize':list(atlas.size),'imageBytes':path.stat().st_size,'metadataBytes':metadata_path.stat().st_size,'decodedRGBABytes':atlas.width*atlas.height*4,'uncroppedDecodedRGBABytes':raw_w*raw_h*128*4,'imageSha256':meta['atlas']['sha256'],'metadataSha256':hashlib.sha256(metadata_path.read_bytes()).hexdigest(),'all128RawAndPackedLayerEdgesTransparent':True,'actorWorldWidthRatio':(meta['frame']['widthInMap']/w)/reference_pixel_width,'anchors':{anchor:{key:[min(f[anchor][key] for f in meta['frames']),max(f[anchor][key] for f in meta['frames'])] for key in ['x','y']} for anchor in ['waterlineAnchorPixels','passengerFootPixels']},'headingProjection':meta['headingProjection'],'rawEdgeAlpha':raw_edges}
(out/'journey-boat-64-validation.json').write_text(json.dumps(validation,indent=2)+'\n')
if frozen:
    comparison={name:(out/name).read_bytes()==(frozen/name).read_bytes() for name in ['journey-boat-64.webp','journey-boat.meta.json']}
    if not all(comparison.values()):raise ValueError(f'Frozen asset comparison failed: {comparison}')
    print(json.dumps({'frozenByteComparison':comparison}))
print(json.dumps({k:v for k,v in validation.items() if k!='rawEdgeAlpha'},indent=2))
